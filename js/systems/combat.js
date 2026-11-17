/* ============================================================
   Aventurs — Combat system (v1.8.0 — reglas unificadas)

   Orden de turnos:
     - Al empezar se arma la iniciativa por VELOCIDAD (jugador, mascota
       y cada enemigo). Empates: D20 entre los empatados.
     - Cada ronda actúan todos en ese orden. Los caídos se saltean.
     - Si te emboscan (falló evitar el encuentro), los enemigos van primero.

   Al empezar el turno de cada combatiente:
     - Sangrado / veneno / fuego le hacen daño.
     - Choque eléctrico: 35% de quedar aturdido y perder el turno.
     - Se descuenta 1 turno a cada efecto.

   Ataque (jugador, mascota y enemigos usan la MISMA regla):
     D20 + ataque >= defensa del objetivo -> pega.
     1 natural = falla. 20 natural = crítico (daño x2, no se puede evitar).
     Daño = dados - armadura (mínimo 1 si pega).
     Frío: -2 defensa y -1 ataque. Ceguera: -4 ataque.

   Hechizos: no se esquivan, la armadura cuenta la mitad, suman poder mágico.

   Mascota:
     - Ataca al mismo enemigo que vos (si cae, al que tenga menos vida).
     - Los enemigos le pegan a ella 30% de las veces.
     - A 0 de vida queda inconsciente: no actúa ni gana XP ese combate.
       Despierta con una poción o descansando (ver js/systems/tame.js).
     - Con hambre (saciedad 0) pega la mitad.

   v2.4: accesorios (A.Accessories) y pociones/pergaminos (A.ItemFx):
     mejoras por turnos, espinas, robo de vida, doble golpe, contraataque,
     superviviente, iniciativa, y pergaminos de daño, aturdir y maldecir.

   v2.5: habilidades de las criaturas (A.Skills): pasivas (Manada, Caparazón,
     Etéreo, Regeneración, Renacer...) y activas que a veces usan en su turno
     (Mordida feroz, Telaraña, Aliento de fuego...). Algunas se resisten con
     una tirada (D20 + fuerza, agilidad o ingenio). Estados nuevos: derribado,
     miedo, atrapado (no podés huir) y ácido. Criaturas de élite (alfa,
     campeón, mayor) con mejor botín.

   API:
     start({ enemies | enemyId | regionId, fromTravel, ambush, surprise, opening })
     setTarget(instanceId), getTarget(), aliveEnemies()
     playerAttack(), playerSpell(spellId), playerUseItem(itemId)
     playerTame(instanceId), playerFlee(), finish()
   ============================================================ */

(function (A) {
  'use strict';

  function State() { return A.State; }
  function B() { return A.Balance; }
  function P() { return A.Passives; }

  /**
   * v1.9.2: programa una acción del combate solo si cuando llegue el momento
   * sigue siendo el MISMO combate (si terminó y empezó otro, se descarta).
   */
  function later(c, fn, ms) {
    setTimeout(() => { if (State().combat === c) fn(); }, ms);
  }

  const STUN_CHANCE = 0.35;
  const PET_TARGET_CHANCE = 0.30;

  // Efectos que meten los enemigos según sus tags
  const TAG_EFFECTS = {
    poison: { type: 'poison', turns: 3 },
    disease: { type: 'poison', turns: 3 },
    fire: { type: 'fire', turns: 2 },
    ice: { type: 'cold', turns: 2 },
    acid: { type: 'bleed', turns: 2 },
  };
  const TAG_EFFECT_CHANCE = 0.25;
  // v2.5: sangrado y veneno se acumulan hasta 3 a la vez
  const MAX_STACKS = 3;
  // v2.5: lo que suman los guerreros para resistir con agilidad o ingenio
  const WARRIOR_SAVE = 2;
  // v2.4: si una misión en curso pide un objeto y todavía te falta, cae al menos la mitad de las veces
  const QUEST_DROP_CHANCE = 0.5;

  // Ritmo del combate (ms). Dan tiempo a que se vea el dado y el golpe.
  const ENEMY_DELAY = 900;
  const PET_DELAY = 800;
  const NEXT_DELAY = 300;

  /** Clave que usa la vista para ubicar a cada combatiente (animaciones). */
  function fxKey(entity) {
    if (!entity) return null;
    if (entity === State().player) return 'player';
    if (State().player && entity === State().player.pet) return 'pet';
    return entity.instanceId ? `enemy:${entity.instanceId}` : null;
  }

  /** Elemento visual del hechizo (para el color del destello). */
  function spellElement(spell) {
    if (!spell) return 'arcane';
    if (spell.statusEffect && spell.statusEffect.type) {
      const t = spell.statusEffect.type;
      if (t === 'fire') return 'fire';
      if (t === 'cold') return 'ice';
      if (t === 'shock') return 'shock';
      if (t === 'poison') return 'poison';
    }
    const txt = `${spell.id || ''} ${spell.name || ''}`.toLowerCase();
    if (/fuego|llama|ígne|igne|bola|fire/.test(txt)) return 'fire';
    if (/hielo|escarcha|frío|frio|ice/.test(txt)) return 'ice';
    if (/rayo|chispa|trueno|eléctr|electr/.test(txt)) return 'shock';
    if (/veneno|ácido|acido|toxi/.test(txt)) return 'poison';
    if (/luz|sagrad|divin/.test(txt)) return 'holy';
    return 'arcane';
  }

  // ============================================================
  // Inicio
  // ============================================================

  function start(opts = {}) {
    let instances = null;

    if (Array.isArray(opts.enemies) && opts.enemies.length > 0) {
      instances = opts.enemies;
    } else if (opts.enemyId) {
      const enemyData = A.Data.getById('enemies', opts.enemyId);
      if (!enemyData) return false;
      instances = [A.Encounter.spawnInstance(enemyData)];
    } else if (opts.regionId) {
      instances = A.Encounter.generate(opts.regionId);
    }
    if (!instances || instances.length === 0) return false;

    // Instancias viejas (partidas guardadas) pueden no tener attack/difficulty
    for (const inst of instances) normalizeInstance(inst);
    assignLabels(instances);

    const p = State().player;
    p.effects = [];
    if (p.pet) {
      p.pet.effects = [];
      // v2.5: las habilidades de la mascota arrancan listas en cada pelea
      p.pet._cds = {}; p.pet._used = {}; p.pet._uses = {}; p.pet._turns = 0; p.pet._regenUsed = 0;
    }

    const initiative = [];
    initiative.push({ kind: 'player', id: 'player', name: p.name, speed: effectivePlayerSpeed(p), tieRoll: 0 });
    if (p.pet && p.pet.health > 0) {
      initiative.push({ kind: 'pet', id: 'pet', name: p.pet.name, speed: p.pet.speed || 10, tieRoll: 0 });
    }
    for (const inst of instances) {
      initiative.push({ kind: 'enemy', id: inst.instanceId, name: inst.displayName, speed: inst.speed || 10, tieRoll: 0 });
    }

    // Empates de velocidad: D20 entre los empatados
    const bySpeed = {};
    for (const a of initiative) (bySpeed[a.speed] = bySpeed[a.speed] || []).push(a);
    const tieGroups = [];
    for (const key of Object.keys(bySpeed)) {
      const group = bySpeed[key];
      if (group.length > 1) {
        for (const a of group) a.tieRoll = A.Utils.dice(20);
        tieGroups.push({ speed: Number(key), members: group });
      }
    }
    initiative.sort((a, b) => (b.speed - a.speed) || (b.tieRoll - a.tieRoll));

    const combat = {
      enemies: instances,
      targetInstanceId: instances[0].instanceId,
      round: 1,
      initiative,
      currentActorIdx: 0,
      turnStartedFor: null,
      log: [],
      result: null,
      fromTravel: !!opts.fromTravel,
      ambush: !!opts.ambush && !opts.surprise,
      surprise: !!opts.surprise,
    };

    // v2.4: Amuleto de la iniciativa: actuás primero (menos si te emboscan)
    const goFirst = !combat.ambush && A.Accessories && A.Accessories.has(p, 'first') && combat.initiative[0] && combat.initiative[0].kind !== 'player';
    if (combat.ambush) {
      const firstEnemyIdx = initiative.findIndex((e) => e.kind === 'enemy');
      if (firstEnemyIdx > 0) combat.initiative = initiative.slice(firstEnemyIdx).concat(initiative.slice(0, firstEnemyIdx));
    } else if (combat.surprise) {
      // v2.0: los agarraste desprevenidos: vos (y tu mascota) actúan primero
      const mine = initiative.filter((e) => e.kind !== 'enemy');
      const theirs = initiative.filter((e) => e.kind === 'enemy');
      combat.initiative = mine.concat(theirs);
    } else if (goFirst) {
      combat.initiative = initiative.filter((e) => e.kind === 'player').concat(initiative.filter((e) => e.kind !== 'player'));
    }
    combat.turn = currentTurnKind(combat);
    State().combat = combat;

    addLog(combat, 'system', { text: `Comienza el combate contra ${A.Encounter.describeGroup(instances)}.`, fx: { kind: 'start', group: A.Encounter.describeGroup(instances), ambush: combat.ambush } });
    if (combat.ambush) addLog(combat, 'system', { text: 'Te emboscaron. Los enemigos atacan primero.' });
    if (combat.surprise) addLog(combat, 'system', { text: 'Los agarraste desprevenidos. Actuás primero.' });
    if (goFirst && !combat.surprise) addLog(combat, 'system', { text: 'Amuleto de la iniciativa: actuás primero.', fx: { kind: 'buff', target: 'player', label: 'Primero', icon: 'boot' }, say: { text: 'Tu amuleto zumba: te movés antes que nadie.', tone: 'good' } });
    addLog(combat, 'system', { text: `Orden por velocidad: ${combat.initiative.map((i) => `${i.name} (vel ${i.speed})`).join(' → ')}` });
    for (const tg of tieGroups) {
      addLog(combat, 'system', { text: `Empate de velocidad ${tg.speed}, desempate con D20: ${tg.members.map((m) => `${m.name}: ${m.tieRoll}`).join(', ')}` });
    }
    // v2.5: lo que pasó al explorar antes de la pelea (te picó la araña, los heriste por sorpresa...)
    applyOpening(combat, opts.opening);
    addTurnHeader(combat, 1);

    A.Bus.emit('combat:started', { count: instances.length });
    State().persist();
    later(combat, () => advanceIfNotPlayer(), 500);
    return true;
  }

  function normalizeInstance(inst) {
    const cat = B().CATEGORY[inst.category] || B().CATEGORY.normal;
    if (inst.attack == null) inst.attack = Math.max(0, B().Enemy.attack(inst.tier) + cat.atk);
    if (inst.difficulty == null) inst.difficulty = B().Enemy.defense(inst.tier) + cat.def;
    if (!inst.effects) inst.effects = [];
    if (!inst.displayName) inst.displayName = inst.name;
    // v2.5: instancias de partidas viejas no traen las habilidades
    if (!Array.isArray(inst.skills)) {
      const d = A.Data.getById('enemies', inst.id);
      inst.skills = d && Array.isArray(d.skills) ? d.skills.slice() : [];
    }
  }

  /**
   * v2.5: lo que trae la pelea desde la exploración.
   * opening = [{ type: 'status', status, turns, value, say } | { type: 'damage', amount, say }]
   */
  function applyOpening(c, opening) {
    if (!Array.isArray(opening) || !opening.length) return;
    const p = State().player;
    for (const o of opening) {
      if (!o) continue;
      if (o.type === 'damage' && o.amount > 0) {
        const before = p.hp;
        A.State.damagePlayer(Math.min(o.amount, Math.max(0, p.hp - 1))); // nunca te mata antes de empezar
        const lost = before - p.hp;
        if (lost > 0) addLog(c, 'system', { text: `Empezás la pelea con ${lost} de vida menos.`, fx: { kind: 'tick', target: 'player', amount: lost, effect: o.effect || 'bleed' }, say: { text: o.say || `Empezás la pelea herido: perdés ${lost} de vida.`, tone: 'bad' } });
      } else if (o.type === 'status' && o.status) {
        inflict(c, p, o.status, { turns: o.turns || 2, value: o.value || 1, source: 'explore', say: o.say ? { text: o.say, tone: 'bad' } : null });
      } else if (o.type === 'note' && o.say) {
        addLog(c, 'system', { text: o.say, fx: { kind: 'note' }, say: { text: o.say, tone: o.tone || 'good' } });
      }
    }
  }

  function currentTurnKind(combat) {
    const cur = combat.initiative[combat.currentActorIdx];
    return cur ? cur.kind : 'player';
  }

  function isPlayerTurn(combat) {
    if (!combat || !combat.initiative) return false;
    const cur = combat.initiative[combat.currentActorIdx];
    return !!cur && cur.kind === 'player';
  }

  // ============================================================
  // Stats derivados
  // ============================================================

  function playerStats() { return B().playerCombatStats(State().player); }

  /** Velocidad efectiva del jugador (resta el peso del equipo que pase de 4). */
  function effectivePlayerSpeed(player) {
    if (!player) return 10;
    return B().playerCombatStats(player).speed;
  }

  function petStats(pet) {
    const fx = B().statusMods(pet);
    const sk = A.Skills ? A.Skills.statMods(pet, null) : { attack: 0, defense: 0, armor: 0 };
    return {
      attack: (pet.attack != null ? pet.attack : B().Pet.attack(pet.level || 1)) - fx.attackPenalty + sk.attack,
      defense: 8 + (pet.dodge || 0) - fx.defensePenalty + sk.defense,
      armor: Math.max(0, (pet.armor || 0) - (fx.armorPenalty || 0) + sk.armor),
    };
  }

  /** v2.5: suma las pasivas (Manada, Líder, Vuela) y los estados (guardia, ácido, derribado...). */
  function enemyStats(inst) {
    const fx = B().statusMods(inst);
    const sk = A.Skills ? A.Skills.statMods(inst, State().combat) : { attack: 0, defense: 0, armor: 0 };
    return {
      attack: (inst.attack || 0) - fx.attackPenalty + sk.attack,
      defense: (inst.difficulty || 10) - fx.defensePenalty + sk.defense,
      armor: Math.max(0, (inst.armor || 0) - (fx.armorPenalty || 0) + sk.armor),
    };
  }

  /** v2.5: daño de un golpe de criatura (miedo, envalentonado, Furia, élite y lo que pida la habilidad). */
  function rollEnemyDamage(enemy, opts = {}) {
    const fx = B().statusMods(enemy);
    let raw = rollDamage(enemy.damage) + (opts.flat || 0) - (fx.damagePenalty || 0);
    if (enemy.dmgMult) raw *= enemy.dmgMult;
    const fury = A.Skills ? A.Skills.damageMult(enemy) : 1;
    if (fury > 1) {
      raw *= fury;
      const c = State().combat;
      if (c && !enemy._furySaid) {
        enemy._furySaid = true;
        const n = A.Skills.noun(enemy);
        addLog(c, 'system', { text: `${enemy.displayName} se enfurece: pega más fuerte.`, fx: { kind: 'status', target: fxKey(enemy), effect: 'fury' }, say: { text: `Con las heridas, ${n} se enfurece: pega más fuerte.`, tone: 'bad' } });
      }
    }
    if (opts.mult) raw *= opts.mult;
    return Math.max(1, Math.round(raw));
  }

  /**
   * Daño del jugador: arma (o puños 1d3) + bonus de daño.
   * Devuelve { expression, components, range }.
   */
  function composePlayerDamage(player) {
    if (!player) return { expression: '1d3', components: [], range: { min: 1, max: 3 } };
    const st = B().playerCombatStats(player);
    const components = [];
    if (st.weapon && st.weapon.damage) {
      components.push({ source: 'weapon', label: st.weapon.name, expr: st.weapon.damage, icon: '' });
    } else {
      components.push({ source: 'race', label: 'Puños', expr: '1d3', icon: '' });
    }
    if (st.damageBonus > 0) components.push({ source: 'modifier', label: 'Bonus de daño', expr: `+${st.damageBonus}`, icon: '' });
    let expression = components.map((c) => c.expr).join(' + ');
    if (st.damageBonus < 0) expression += ` - ${Math.abs(st.damageBonus)}`;
    expression = expression.replace(/\+\s*\+/g, '+').replace(/\s+/g, ' ').trim();
    const range = A.Utils.diceRange(expression.replace(/ - \d+$/, ''));
    if (st.damageBonus < 0) { range.min = Math.max(1, range.min + st.damageBonus); range.max = Math.max(1, range.max + st.damageBonus); }
    return { expression, components, range, bonus: st.damageBonus };
  }

  function rollPlayerDamage(player) {
    const composed = composePlayerDamage(player);
    const positive = composed.expression.replace(/ - \d+$/, '');
    const res = A.Utils.rollDiceCompound(positive);
    let total = res.total;
    if (composed.bonus < 0) total = Math.max(1, total + composed.bonus);
    return { total, composed, res };
  }

  /**
   * Tirada única de ataque.
   * opts.critMin: desde qué número es crítico (Ojo certero: 19).
   * opts.reroll1: un 1 natural se vuelve a tirar (Suerte).
   */
  function attackRoll(attack, defense, opts = {}) {
    let roll = A.Utils.dice(20);
    let lucky = false;
    if (roll === 1 && opts.reroll1) { lucky = true; roll = A.Utils.dice(20); }
    const total = roll + attack;
    const fumble = roll === 1;
    const crit = roll >= (opts.critMin || 20);
    const hit = crit || (!fumble && total >= defense);
    return { roll, total, fumble, crit, hit, lucky };
  }

  /** Opciones de tirada del jugador según su pasiva. */
  function playerRollOpts(p) {
    const base = P() ? { critMin: P().critMin(p), reroll1: P().rerollOnes(p) } : { critMin: 20 };
    // v2.4: Anillo del golpe certero: críticos desde más abajo
    const extra = A.Accessories ? A.Accessories.bonus(p, 'crit') : 0;
    if (extra > 0) base.critMin = Math.max(2, (base.critMin || 20) - extra);
    return base;
  }

  /**
   * v2.4: todo lo que protege al jugador antes de perder vida:
   * pasivas de raza (Piel de roca, Determinación) y luego objetos
   * (Invencible, Amuleto del superviviente, Pergamino de resurrección).
   */
  function shieldPlayer(c, p, dmg, opts = {}) {
    const ab = P() ? P().absorbHit(c, p, dmg, opts) : { dmg, passive: null };
    const gd = A.ItemFx ? A.ItemFx.guard(c, p, ab.dmg) : { dmg: ab.dmg, tag: null };
    return { dmg: gd.dmg, passive: ab.passive, guard: gd.tag };
  }

  /** Cuenta lo que hizo un objeto que te salvó (después del golpe). */
  function announceGuard(c, tag) {
    if (!tag || tag === 'invincible') return;
    const p = State().player;
    if (tag === 'survivor') {
      const it = A.Data.getById('items', p.equipment && p.equipment.accessory);
      addLog(c, 'system', { text: `${it ? it.name : 'Tu amuleto'}: quedás con 1 de vida.`, fx: { kind: 'buff', target: 'player', label: '¡En pie!', icon: 'heart' }, say: { text: `¡Tu ${(it ? it.name : 'amuleto').toLowerCase()} brilla! El golpe que te iba a matar te deja con 1 de vida.`, tone: 'crit' } });
    } else if (tag === 'resurrect') {
      addLog(c, 'system', { text: `Pergamino de resurrección: quedás con ${p.hp} de vida.`, fx: { kind: 'buff', target: 'player', label: '¡En pie!', icon: 'heart' }, say: { text: `¡La luz del pergamino te sostiene! Quedás en pie con ${p.hp} de vida.`, tone: 'crit' } });
    }
  }

  /** v2.4: ¿te protege algo de este efecto? { passive } (raza) o { name } (equipo o mejora). */
  function immunityOf(p, type) {
    if (P() && P().immune(p, type)) return { passive: P().idOf(p) };
    return A.ItemFx ? A.ItemFx.immunityOf(p, type) : null;
  }

  /**
   * Después de que te pegan: Furia (se avisa la primera vez) y
   * Bendición (te cura una vez por combate al quedar con media vida).
   */
  function maybeAnnounceFury(c, p) {
    if (!P() || !p || p.hp <= 0) return;
    if (P().furyJustStarted(c, p)) {
      addLog(c, 'system', {
        text: `Furia: tus golpes hacen +${P().damageBonus(p)} de daño.`,
        fx: { kind: 'passive', passive: 'furia', amount: P().damageBonus(p) },
      });
    }
    const bless = P().blessingHeal(c, p);
    if (bless > 0) {
      const before = p.hp;
      A.State.healHp(bless);
      addLog(c, 'system', { text: `Bendición: +${p.hp - before} de vida.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: p.hp - before, passive: 'bendicion' } });
    }
  }

  function rollDamage(notationOrNumber) {
    if (typeof notationOrNumber === 'number') return notationOrNumber;
    if (typeof notationOrNumber !== 'string') return 1;
    return A.Utils.rollDice(notationOrNumber);
  }

  /** Si pega, el daño final es como mínimo 1. */
  function mitigate(raw, armor) { return Math.max(1, raw - (armor || 0)); }

  // ============================================================
  // Efectos de estado
  // ============================================================

  function applyStatus(target, type, opts = {}) {
    if (!target) return false;
    if (target === State().player && immunityOf(target, type)) return false;
    // v2.5: inmunidades de las criaturas (no muertos, constructos, cuerpo de fuego...)
    if (target.instanceId && A.Skills && A.Skills.immune(target, type)) return false;
    if (!target.effects) target.effects = [];
    const turns = opts.turns || 3;
    const value = opts.value || 1;
    const source = opts.source || 'unknown';
    if (type !== 'bleed' && type !== 'poison') {
      // fuego, frío, choque, ceguera, silencio: se refrescan, no se acumulan
      const existing = target.effects.find((e) => e.type === type);
      if (existing) {
        existing.turns = Math.max(existing.turns, turns);
        existing.value = Math.max(existing.value, value);
        return true;
      }
    } else {
      // v2.5: sangrado y veneno se acumulan, pero hasta 3 a la vez (el más viejo se renueva)
      const same = target.effects.filter((e) => e.type === type);
      if (same.length >= MAX_STACKS) {
        const oldest = same.reduce((a, b) => (a.turns <= b.turns ? a : b));
        oldest.turns = Math.max(oldest.turns, turns);
        oldest.value = Math.max(oldest.value, value);
        oldest.source = source;
        return true;
      }
    }
    target.effects.push({ type, turns, value, source });
    return true;
  }

  function removeStatus(target, type) {
    if (!target || !target.effects) return;
    target.effects = target.effects.filter((e) => e.type !== type);
  }

  function effectLabel(type) {
    return ({
      bleed: 'sangrado', poison: 'veneno', fire: 'fuego', cold: 'frío',
      shock: 'choque', blind: 'ceguera', silence: 'silencio',
      stun: 'aturdido', curse: 'maldición', buff: 'mejora',
      // v2.5
      prone: 'derribado', fear: 'miedo', grab: 'atrapado', corrode: 'ácido',
      rally: 'envalentonado', guard: 'en guardia',
    })[type] || type;
  }

  // v2.5: cómo se nombra cada estado en "X no te hace nada"
  const STATUS_NOUN = {
    poison: 'el veneno', fire: 'el fuego', cold: 'el frío', shock: 'la descarga', bleed: 'el sangrado',
    blind: 'la ceguera', silence: 'el silencio', stun: 'el aturdimiento', curse: 'la maldición',
    prone: 'el golpe', fear: 'el miedo', grab: 'el agarre', corrode: 'el ácido',
  };
  // y cómo lo dice una criatura inmune
  const IMMUNE_LINE = {
    bleed: '{E} no sangra.', poison: 'El veneno no le hace nada a {e}.', fire: 'El fuego no le hace nada a {e}.',
    cold: 'El frío no le hace nada a {e}.', fear: '{E} no conoce el miedo.', prone: 'No hay forma de tirar al suelo a {e}.',
    grab: 'No hay forma de agarrar a {e}.', blind: '{E} no se encandila.',
  };

  /**
   * v2.5: aplica un estado y lo cuenta. Si es inmune, cuenta por qué.
   * opts.quiet: sin frase (ya la dijo la tirada) · opts.say: frase propia.
   */
  function inflict(c, victim, type, opts = {}) {
    if (!victim || !c) return false;
    if (applyStatus(victim, type, opts)) {
      const entry = { text: `${targetName(victim)} sufre ${effectLabel(type)}.`, fx: { kind: 'status', target: fxKey(victim), effect: type } };
      if (opts.quiet) entry.say = { text: '', tone: 'bad' };
      else if (opts.say && opts.say.text) entry.say = opts.say;
      addLog(c, 'system', entry);
      return true;
    }
    immuneNote(c, victim, type);
    return false;
  }

  function immuneNote(c, victim, type) {
    const p = State().player;
    const label = effectLabel(type);
    if (victim === p) {
      const im = immunityOf(p, type) || {};
      if (im.passive) {
        addLog(c, 'system', { text: `${p.name} no sufre ${label} (pasiva).`, fx: { kind: 'passive', passive: im.passive, effect: type } });
      } else {
        addLog(c, 'system', {
          text: `${p.name} no sufre ${label} (${im.name || 'protección'}).`,
          fx: { kind: 'buff', target: 'player', label: 'Inmune', icon: 'star' },
          say: { text: `${im.name ? `Gracias a ${im.name.toLowerCase()}, ` : ''}${STATUS_NOUN[type] || 'eso'} no te hace nada.`.replace(/^./, (ch) => ch.toUpperCase()), tone: 'good' },
        });
      }
      return;
    }
    if (victim.instanceId && A.Skills) {
      const im = A.Skills.immune(victim, type);
      if (!im) return;
      addLog(c, 'system', {
        text: `${victim.displayName} no sufre ${label} (${im.name}).`,
        fx: { kind: 'status', target: fxKey(victim), effect: 'immune' },
        say: { text: A.Skills.fill(IMMUNE_LINE[type] || `{E} no sufre ${label}.`, victim), tone: 'neutral' },
      });
    }
  }

  /** Arma o hechizo con statusEffect: chance de aplicarlo al pegar. */
  function maybeInflictStatusOnHit(source, target, c) {
    if (!source || !target || !source.statusEffect) return;
    const eff = source.statusEffect;
    if (Math.random() > (eff.chance || 0)) return;
    if (!c) { applyStatus(target, eff.type, { turns: eff.turns || 3, value: eff.value || 1, source: source.id }); return; }
    // v2.5: el arma cuenta lo que hizo ("Tu daga abre una herida que sangra")
    const line = A.ItemFx && A.ItemFx.weaponProcLine ? A.ItemFx.weaponProcLine(source, target) : null;
    inflict(c, target, eff.type, { turns: eff.turns || 3, value: eff.value || 1, source: source.id, say: line ? { text: line, tone: 'good' } : null });
  }

  function targetName(t) {
    if (!t) return '';
    if (t === State().player) return t.name;
    return t.displayName || t.name;
  }

  /**
   * Procesa los efectos al empezar el turno de un combatiente.
   * Devuelve { skip: true } si queda aturdido o muere.
   */
  function startOfTurn(c, kind, entity) {
    if (!entity || !entity.effects || entity.effects.length === 0) return { skip: false };
    let dmg = 0;
    let tickType = null;
    const parts = [];
    let stunned = false;
    for (const ef of entity.effects) {
      // v2.4: las mejoras (pociones, pergaminos) se descuentan después de cada acción tuya
      if (ef.type === 'buff') continue;
      if (ef.type === 'bleed' || ef.type === 'poison' || ef.type === 'fire') {
        dmg += ef.value;
        if (!tickType) tickType = ef.type;
        parts.push(`${effectLabel(ef.type)} ${ef.value}`);
      }
      if (ef.type === 'shock' && Math.random() < STUN_CHANCE) stunned = true;
      if (ef.type === 'stun') stunned = true; // v2.4: pergaminos que paralizan
      ef.turns -= 1;
    }
    entity.effects = entity.effects.filter((e) => e.type === 'buff' || e.turns > 0);

    const name = targetName(entity);
    if (dmg > 0) {
      if (kind === 'player') {
        const ab = shieldPlayer(c, entity, dmg, { tick: true });
        A.State.damagePlayer(ab.dmg);
        addLog(c, 'system', { text: `Efectos: ${parts.join(', ')}. -${ab.dmg} salud (HP ${entity.hp}/${entity.maxHp})`, passive: ab.passive, fx: { kind: 'tick', target: 'player', amount: ab.dmg, effect: tickType } });
        announceGuard(c, ab.guard);
        if (entity.hp <= 0) return { skip: true, died: true };
        maybeAnnounceFury(c, entity);
      } else if (kind === 'pet') {
        entity.health = Math.max(0, entity.health - dmg);
        addLog(c, 'system', { text: `${name} sufre ${parts.join(', ')} (-${dmg}, HP ${entity.health}/${entity.maxHealth})`, fx: { kind: 'tick', target: 'pet', amount: dmg, effect: tickType } });
        if (entity.health <= 0) { petKnockedOut(c, entity); return { skip: true }; }
      } else {
        entity.hp = Math.max(0, entity.hp - dmg);
        addLog(c, 'system', { text: `${name} sufre ${parts.join(', ')} (-${dmg}, HP ${entity.hp}/${entity.maxHp})`, fx: { kind: 'tick', target: fxKey(entity), amount: dmg, effect: tickType } });
        // v2.5: el fénix puede renacer acá también
        if (entity.hp <= 0 && enemyDown(c, entity, 'tick')) return { skip: true };
      }
    }
    if (stunned) {
      addLog(c, 'system', { text: kind === 'player' ? 'Estás aturdido y perdés el turno.' : `${name} está aturdido y pierde el turno.`, fx: { kind: 'stun', target: kind === 'player' ? 'player' : kind === 'pet' ? 'pet' : fxKey(entity) } });
      return { skip: true };
    }
    return { skip: false };
  }

  // ============================================================
  // Flujo de turnos
  // ============================================================

  function addTurnHeader(c, n) {
    addLog(c, 'turn-header', { text: `── Turno ${n} ──`, turnNumber: n });
  }

  function checkEnd() {
    const c = State().combat;
    if (!c || c.result) return true;
    if (aliveEnemies().length === 0) { onVictory(); A.Bus.emit('combat:ended', { result: 'victory' }); return true; }
    if (State().player.hp <= 0) { onDefeat(); A.Bus.emit('combat:ended', { result: 'defeat' }); return true; }
    return false;
  }

  function advanceIfNotPlayer() {
    const c = State().combat;
    if (!c || c.result) return;
    if (checkEnd()) return;

    const cur = c.initiative[c.currentActorIdx];
    if (!cur) {
      c.round += 1;
      c.currentActorIdx = 0;
      addTurnHeader(c, c.round);
      State().persist();
      A.Bus.emit('combat:turn', { round: c.round });
      later(c, () => advanceIfNotPlayer(), 350);
      return;
    }

    // Saltear caídos
    let entity = null;
    if (cur.kind === 'enemy') {
      entity = c.enemies.find((e) => e.instanceId === cur.id);
      if (!entity || entity.hp <= 0) { c.currentActorIdx += 1; return advanceIfNotPlayer(); }
    } else if (cur.kind === 'pet') {
      entity = State().player.pet;
      if (!entity || entity.health <= 0) { c.currentActorIdx += 1; return advanceIfNotPlayer(); }
    } else {
      entity = State().player;
      if (entity.hp <= 0) { c.currentActorIdx += 1; return advanceIfNotPlayer(); }
    }

    // Efectos al inicio del turno (una sola vez por turno)
    const turnKey = `${c.round}:${c.currentActorIdx}`;
    if (c.turnStartedFor !== turnKey) {
      c.turnStartedFor = turnKey;
      if (cur.kind === 'player') {
        // v2.1.1: el golpe fuerte se recarga un turno por vez
        if (c.powerCd > 0) c.powerCd -= 1;
        playerTurnPassives(c, entity);
      } else {
        creatureTurnPassives(c, cur.kind, entity); // v2.5: Regeneración
      }
      const st = startOfTurn(c, cur.kind, entity);
      if (checkEnd()) return;
      if (st.skip) {
        A.Bus.emit('combat:action', { actor: cur.kind });
        nextActor();
        return;
      }
    }

    c.turn = cur.kind;
    State().persist();
    A.Bus.emit('combat:turn', { actor: cur.kind, round: c.round });

    // Pausas pensadas para que se vea el dado y el golpe de cada uno
    if (cur.kind === 'enemy') later(c, () => executeEnemyAction(entity), ENEMY_DELAY);
    else if (cur.kind === 'pet') later(c, () => executePetAction(), PET_DELAY);
    // Jugador: espera input
  }

  /** Pasivas que actúan al empezar tu turno (en silencio: solo el número flotante). */
  function playerTurnPassives(c, p) {
    if (!p) return;
    // v2.4: Orbe de regeneración y Poción/Pergamino de regenerar
    const regen = (A.Accessories ? A.Accessories.bonus(p, 'regen') : 0) + (A.ItemFx ? A.ItemFx.buffMods(p).regen : 0);
    if (regen > 0 && p.hp > 0 && p.hp < p.maxHp) {
      const before = p.hp;
      A.State.healHp(regen);
      if (p.hp > before) addLog(c, 'system', { text: `Regeneración: +${p.hp - before} de vida.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: p.hp - before }, say: { text: `Tus heridas se cierran solas: +${p.hp - before} de vida.`, tone: 'good' } });
    }
    // v2.1: los magos recuperan maná al empezar cada turno (cada raza, una cantidad distinta)
    const mana = B().manaRegenOf ? B().manaRegenOf(p).turn : 0;
    if (mana > 0 && p.hasMagic && p.mana < p.maxMana && c.round > 1) {
      const before = p.mana;
      A.State.setMana(Math.min(p.maxMana, p.mana + mana));
      addLog(c, 'system', { text: `Recuperás ${p.mana - before} de maná.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: 0, mana: p.mana - before, quiet: true } });
    }
  }

  /** v2.5: Regeneración de criaturas y mascotas al empezar su turno (el fuego la frena). */
  function creatureTurnPassives(c, kind, x) {
    if (!A.Skills || !x) return;
    const n = A.Skills.regenOf(x);
    if (!n) return;
    const isPetX = kind === 'pet';
    const noun = A.Skills.noun(x);
    if (n < 0) {
      if (!x._regenBlockSaid) {
        x._regenBlockSaid = true;
        addLog(c, 'system', { text: `${targetName(x)} no se regenera: está en llamas.`, fx: { kind: 'note' }, say: { text: `El fuego no deja que ${noun} se regenere.`, tone: isPetX ? 'bad' : 'good' } });
      }
      return;
    }
    const hp = isPetX ? x.health : x.hp;
    const max = isPetX ? x.maxHealth : x.maxHp;
    if (hp <= 0 || hp >= max) return;
    const got = Math.min(n, max - hp);
    if (isPetX) x.health += got; else x.hp += got;
    x._regenUsed = (x._regenUsed || 0) + got; // tope por pelea
    addLog(c, 'system', {
      text: `${targetName(x)} se regenera: +${got}.`,
      fx: { kind: 'heal', actor: fxKey(x), target: fxKey(x), amount: got },
      say: { text: `Las heridas de ${noun} se cierran solas: recupera ${got} de vida.`, tone: isPetX ? 'good' : 'bad' },
    });
  }

  /**
   * v2.5: una criatura llegó a 0. Si tiene Renacer, vuelve (y devuelve false).
   * how: 'player' | 'spell' | 'pet' | 'tick' | 'item' | 'thorns'
   */
  function enemyDown(c, t, how) {
    if (!t || t.hp > 0) return false;
    if (A.Skills && A.Skills.tryRevive(t)) {
      const n = A.Skills.noun(t);
      addLog(c, 'system', {
        text: `${t.displayName} renace con ${t.hp} de vida.`,
        fx: { kind: 'heal', actor: fxKey(t), target: fxKey(t), amount: t.hp },
        say: { text: `¡${n.charAt(0).toUpperCase()}${n.slice(1)} estalla en llamas y renace de sus cenizas con ${t.hp} de vida!`, tone: 'bad' },
      });
      return false;
    }
    const text = how === 'pet' ? `${t.displayName} cayó por la mascota.` : how === 'tick' ? `${t.displayName} cayó por los efectos.` : `${t.displayName} cayó.`;
    addLog(c, 'system', { text, killed: t.displayName, fx: { kind: 'death', target: fxKey(t) } });
    if (how === 'player' || how === 'item') maybeDropEquippedWeapon(c, t);
    return true;
  }

  function nextActor() {
    const c = State().combat;
    if (!c) return;
    c.currentActorIdx += 1;
    if (c.currentActorIdx >= c.initiative.length) c.currentActorIdx = c.initiative.length;
    later(c, () => advanceIfNotPlayer(), NEXT_DELAY);
  }

  /** Letras para los repetidos ("Lobo A", "Lobo B"). v2.5: por nombre, así el "Lobo alfa" queda aparte. */
  function assignLabels(instances) {
    const counts = {};
    for (const e of instances) counts[e.name] = (counts[e.name] || 0) + 1;
    const idx = {};
    for (const e of instances) {
      if (counts[e.name] > 1) {
        idx[e.name] = (idx[e.name] || 0) + 1;
        e.label = String.fromCharCode(64 + idx[e.name]);
        e.displayName = `${e.name} ${e.label}`;
      } else {
        e.label = '';
        e.displayName = e.name;
      }
    }
  }

  // ============================================================
  // Objetivo
  // ============================================================

  function setTarget(instanceId) {
    const c = State().combat;
    if (!c) return;
    const t = c.enemies.find((e) => e.instanceId === instanceId && e.hp > 0);
    if (t) {
      c.targetInstanceId = instanceId;
      State().persist();
      A.Bus.emit('combat:target-changed', { instanceId });
    }
  }

  function getTarget() {
    const c = State().combat;
    if (!c) return null;
    let t = c.enemies.find((e) => e.instanceId === c.targetInstanceId && e.hp > 0);
    if (!t) {
      t = c.enemies.find((e) => e.hp > 0);
      if (t) c.targetInstanceId = t.instanceId;
    }
    return t || null;
  }

  function aliveEnemies() {
    const c = State().combat;
    if (!c) return [];
    return c.enemies.filter((e) => e.hp > 0);
  }

  // ============================================================
  // Acciones del jugador
  // ============================================================

  function playerAttack() { doPlayerAttack(false); }

  /** v2.1.1: Golpe fuerte (guerreros): doble daño y después unos turnos de espera. */
  function powerInfo() {
    const c = State().combat;
    const p = State().player;
    const info = B().warriorPower ? B().warriorPower(p) : null;
    if (!info) return null;
    const wait = c && c.powerCd > 0 ? c.powerCd : 0;
    return { ...info, wait, ready: wait === 0 };
  }
  function playerPowerAttack() {
    const info = powerInfo();
    if (!info || !info.ready) return;
    doPlayerAttack(true);
  }

  function doPlayerAttack(power) {
    const c = State().combat;
    if (!c || c.result || !isPlayerTurn(c)) return;
    const target = getTarget();
    if (!target) { checkEnd(); return; }
    const p = State().player;
    const pw = power ? (B().warriorPower ? B().warriorPower(p) : null) : null;
    if (pw) c.powerCd = pw.cooldown;
    playerStrike(c, p, target, { pw });
    // v2.4: Guantes del doble golpe: a veces pegás otra vez
    const dbl = A.Accessories ? A.Accessories.bonus(p, 'double') : 0;
    if (dbl > 0 && p.hp > 0 && Math.random() < dbl) {
      const t2 = getTarget();
      if (t2) {
        addLog(c, 'system', { text: '¡Doble golpe!', fx: { kind: 'buff', target: 'player', label: 'Doble golpe', icon: 'swords' }, say: { text: 'Tu brazo es más rápido que su guardia: ¡pegás otra vez!', tone: 'crit' } });
        playerStrike(c, p, t2, {});
      }
    }
    afterPlayerAction();
  }

  /**
   * Un golpe del jugador con el arma (también el doble golpe y el contraataque).
   * opts.pw: golpe fuerte del guerrero · opts.counter: contraataque.
   */
  function playerStrike(c, p, target, opts = {}) {
    const pw = opts.pw || null;
    const st = playerStats();
    const es = enemyStats(target);
    const r = attackRoll(st.attack, es.defense, playerRollOpts(p));
    const weaponName = st.weapon ? st.weapon.name : 'puños';
    if (r.lucky) addLog(c, 'system', { text: 'Suerte: sacaste un 1 y el dado se vuelve a tirar.', fx: { kind: 'passive', passive: 'suerte' } });
    // v2.5: Escurridizo (el primero) y Etéreo (1 de cada 4) hacen fallar un golpe que pegaba.
    // El golpe fuerte del guerrero no se esquiva con esos trucos (ni lo frena un caparazón).
    const dodge = A.Skills && !pw ? A.Skills.dodgeHit(target, r) : null;
    if (dodge) { r.hit = false; r.crit = false; }

    if (!r.hit) {
      const miss = {
        power: !!pw,
        counter: !!opts.counter,
        text: r.fumble ? `Atacaste a ${target.displayName} pero fallaste por completo` : `${target.displayName} esquivó tu ${pw ? 'golpe fuerte' : 'ataque'}`,
        actor: p.name, target: target.displayName, actorIcon: '', weapon: weaponName,
        roll: r.roll, bonus: st.attack, total: r.total, vs: es.defense, vsLabel: 'defensa',
        result: r.fumble ? 'fumble' : 'evaded',
        fx: { kind: 'attack', actor: 'player', target: fxKey(target) },
      };
      if (dodge) { miss.text = `${target.displayName} evita el golpe (${A.Skills.get(dodge.skill).name}).`; miss.say = { text: dodge.say, tone: 'neutral' }; }
      addLog(c, 'player', miss);
      return r;
    }
    const dmgRoll = rollPlayerDamage(p);
    let rawDmg = dmgRoll.total;
    if (pw) rawDmg *= pw.mult;
    if (r.crit) rawDmg = Math.round(rawDmg * (P() ? P().critMult(p) : 2));
    let finalDmg = mitigate(rawDmg, es.armor);
    // v2.5: Caparazón / Gelatinoso: el primer golpe hace la mitad (el golpe fuerte lo rompe)
    const soft = A.Skills && !pw ? A.Skills.softenHit(target, finalDmg) : { dmg: finalDmg, skill: null };
    finalDmg = soft.dmg;
    target.hp = Math.max(0, target.hp - finalDmg);
    let passive = null;
    if (r.crit && P() && P().has(p, 'golpe_gigante')) passive = 'golpe_gigante';
    else if (r.crit && r.roll < 20 && P() && P().has(p, 'ojo_certero')) passive = 'ojo_certero';
    addLog(c, 'player', {
      passive,
      power: !!pw,
      counter: !!opts.counter,
      text: r.crit ? `¡Golpe crítico${pw ? ' y fuerte' : ''} a ${target.displayName}!` : (pw ? `¡Golpe fuerte a ${target.displayName}!` : `Atacaste a ${target.displayName}`),
      actor: p.name, target: target.displayName, actorIcon: '', weapon: weaponName,
      damageDice: dmgRoll.composed.expression,
      damageBreakdown: dmgRoll.composed.components.map((cmp, i) => ({
        label: cmp.label, expr: cmp.expr,
        rolled: dmgRoll.res.components && dmgRoll.res.components[i] ? dmgRoll.res.components[i].rolled : 0,
        icon: cmp.icon,
      })),
      roll: r.roll, bonus: st.attack, total: r.total, vs: es.defense, vsLabel: 'defensa',
      rawDmg, targetArmor: es.armor, dmg: finalDmg, hpAfter: target.hp, hpMax: target.maxHp,
      result: r.crit ? 'crit' : 'hit',
      softened: soft.skill,
      fx: { kind: 'attack', actor: 'player', target: fxKey(target) },
    });
    // v2.2.1: los híbridos recuperan maná al acertar con el arma
    const moh = B().manaOnHit ? B().manaOnHit(p) : 0;
    if (moh > 0 && p.mana < p.maxMana) {
      const before = p.mana;
      A.State.setMana(Math.min(p.maxMana, p.mana + moh));
      if (p.mana > before) addLog(c, 'system', { text: `Recuperás ${p.mana - before} de maná.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: 0, mana: p.mana - before, quiet: true } });
    }
    // v2.4: Amuleto vampírico: parte del daño vuelve como vida
    const ls = A.Accessories ? A.Accessories.bonus(p, 'lifesteal') : 0;
    if (ls > 0 && p.hp > 0 && p.hp < p.maxHp) {
      const before = p.hp;
      A.State.healHp(Math.max(1, Math.round(finalDmg * ls)));
      if (p.hp > before) addLog(c, 'system', { text: `Robo de vida: +${p.hp - before}.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: p.hp - before }, say: { text: `Tu amuleto bebe de la herida: recuperás ${p.hp - before} de vida.`, tone: 'good' } });
    }
    if (target.hp > 0) maybeInflictStatusOnHit(st.weapon, target, c);
    // Sangre de dragón: a veces el golpe prende fuego
    if (target.hp > 0 && P() && Math.random() < P().burnChance(p)) {
      if (applyStatus(target, 'fire', { turns: 2, value: P().burnValue(p), source: 'sangre_dragon' })) {
        addLog(c, 'system', { text: `${target.displayName} se prende fuego.`, fx: { kind: 'status', target: fxKey(target), effect: 'fire', passive: 'sangre_dragon' } });
      }
    }
    // v2.5: tocar a ciertas criaturas duele (Cuerpo de fuego, de hielo, Espinas)
    hitReactions(c, target, 'player');
    if (target.hp <= 0) enemyDown(c, target, 'player');
    return r;
  }

  /** v2.5: lo que le pasa al que golpea con un arma a una criatura con Cuerpo de fuego/hielo o Espinas. */
  function hitReactions(c, target, who) {
    if (!A.Skills || !target) return;
    const re = A.Skills.reactions(target);
    if (!re.burn && !re.chill && !re.thorns) return;
    const p = State().player;
    const victim = who === 'pet' ? p.pet : p;
    if (!victim || (who === 'pet' ? victim.health <= 0 : victim.hp <= 0)) return;
    const n = A.Skills.noun(target);
    const tier = target.tier || 1;
    if (re.burn && Math.random() < re.burn) {
      inflict(c, victim, 'fire', { turns: 1, value: A.Skills.valueFor('fire', tier), source: target.id, say: { text: who === 'pet' ? `${A.Skills.noun(victim).replace(/^./, (ch) => ch.toUpperCase())} se quema al tocar a ${n}.` : `Te quemás al tocar a ${n}.`, tone: 'bad' } });
    }
    if (re.chill && Math.random() < re.chill) {
      inflict(c, victim, 'cold', { turns: 1, value: 1, source: target.id, say: { text: who === 'pet' ? `${A.Skills.noun(victim).replace(/^./, (ch) => ch.toUpperCase())} se congela al tocar a ${n}.` : `El frío de ${n} te sube por los brazos.`, tone: 'bad' } });
    }
    if (re.thorns > 0) {
      if (who === 'pet') {
        victim.health = Math.max(0, victim.health - re.thorns);
        addLog(c, 'system', { text: `${victim.name} se lastima con las espinas (-${re.thorns}).`, fx: { kind: 'tick', target: 'pet', amount: re.thorns, effect: 'bleed' }, say: { text: `${A.Skills.noun(victim).replace(/^./, (ch) => ch.toUpperCase())} se lastima con las espinas de ${n}: ${re.thorns} de daño.`, tone: 'bad' } });
        if (victim.health <= 0) petKnockedOut(c, victim);
      } else {
        const ab = shieldPlayer(c, p, re.thorns, { tick: true });
        A.State.damagePlayer(ab.dmg);
        addLog(c, 'system', { text: `Espinas: -${ab.dmg} de vida.`, fx: { kind: 'tick', target: 'player', amount: ab.dmg, effect: 'bleed' }, say: { text: `Te lastimás con las espinas de ${n}: ${ab.dmg} de daño.`, tone: 'bad' } });
        announceGuard(c, ab.guard);
      }
    }
  }

  function maybeDropEquippedWeapon(c, enemy) {
    if (!enemy.equippedWeapon) return;
    if (Math.random() > 0.20) return;
    const ok = A.State.addItem(enemy.equippedWeapon, 1);
    if (ok) {
      const w = A.Data.getById('weapons', enemy.equippedWeapon);
      if (w) addLog(c, 'loot', { text: `Recogiste ${w.name} de ${enemy.displayName}.`, fx: { kind: 'reward', items: [{ itemId: w.id, qty: 1 }] } });
    }
  }

  function playerSpell(spellId) {
    const c = State().combat;
    if (!c || c.result || !isPlayerTurn(c)) return;
    const p = State().player;
    if (!p.hasMagic) return;
    const spell = A.Data.getById('spells', spellId);
    if (!spell || !(p.spells || []).includes(spellId)) return;
    if ((p.effects || []).some((e) => e.type === 'silence')) {
      addLog(c, 'system', { text: 'Estás silenciado: no podés lanzar hechizos.', fx: { kind: 'note' } });
      return;
    }
    const cost = P() ? P().spellCost(p, spell) : spell.manaCost;
    if (p.mana < cost) {
      addLog(c, 'system', { text: `No te alcanza el maná para ${spell.name}.`, fx: { kind: 'note' } });
      return;
    }
    A.State.setMana(p.mana - cost);
    const power = playerStats().spellPower + (spell.damage && P() ? P().spellBonus(p) : 0);

    if (spell.heal) {
      // v2.1: la curación suma solo la mitad del poder mágico (si no, con maná que vuelve solo sería vida infinita)
      let heal = A.Utils.rollDice(spell.heal) + Math.floor(power / 2);
      const boost = A.Accessories ? A.Accessories.bonus(p, 'heal') : 0; // v2.4: Cruz sagrada
      if (boost > 0) heal = Math.round(heal * (1 + boost));
      const before = p.hp;
      A.State.healHp(heal);
      addLog(c, 'player', { text: `Lanzaste ${spell.name} y recuperaste ${p.hp - before} de salud.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: p.hp - before, icon: '' } });
    } else if (spell.damage) {
      const targets = spell.area ? aliveEnemies() : [getTarget()].filter(Boolean);
      for (const t of targets) {
        const rawDmg = A.Utils.rollDice(spell.damage) + power;
        const armor = Math.floor((t.armor || 0) / 2);
        const finalDmg = mitigate(rawDmg, armor);
        t.hp = Math.max(0, t.hp - finalDmg);
        addLog(c, 'player', {
          text: `${spell.name} hiere a ${t.displayName}`,
          actor: p.name, target: t.displayName, actorIcon: '',
          rawDmg, targetArmor: armor, dmg: finalDmg, hpAfter: t.hp, hpMax: t.maxHp,
          damageDice: power ? `${spell.damage}+${power}` : spell.damage,
          spell: spell.name, result: 'hit',
          fx: { kind: 'spell', actor: 'player', target: fxKey(t), element: spellElement(spell), icon: '' },
        });
        if (t.hp > 0) maybeInflictStatusOnHit(spell, t, c);
        if (t.hp <= 0) enemyDown(c, t, 'spell');
      }
      // v2.1: hechizos que además te curan (Luz sagrada)
      if (spell.selfHeal && targets.length && p.hp < p.maxHp) {
        const before = p.hp;
        A.State.healHp((Number(spell.selfHeal) || 0) + Math.floor(power / 2));
        if (p.hp > before) addLog(c, 'system', { text: `${spell.name} te devuelve ${p.hp - before} de vida.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: p.hp - before } });
      }
    } else {
      addLog(c, 'player', { text: `Lanzaste ${spell.name}.`, fx: { kind: 'cast', actor: 'player', icon: '' } });
    }
    afterPlayerAction();
  }

  /** v2.4: lo que necesita ItemFx para que un objeto actúe en la pelea. */
  function itemCtx(c) {
    return {
      log: (type, payload) => addLog(c, type, payload),
      alive: aliveEnemies,
      target: getTarget,
      fxKey,
      applyStatus,
      effectLabel,
      died: (t) => { enemyDown(c, t, 'item'); },
    };
  }

  /** Usa una poción, comida o pergamino (gasta el turno). Devuelve true si se usó. */
  function playerUseItem(itemId) {
    const c = State().combat;
    if (!c || c.result) return false;
    if (!isPlayerTurn(c)) {
      addLog(c, 'system', { text: 'Esperá tu turno para usar algo.', fx: { kind: 'note' } });
      return false;
    }
    const item = A.Data.getById('items', itemId);
    if (!item) return false;
    const p = State().player;
    if (!p.inventory.find((s) => s.itemId === itemId)) return false;
    if (!A.ItemFx) return false;
    const res = A.ItemFx.useInCombat(c, item, itemCtx(c));
    if (!res.ok) {
      if (res.why) addLog(c, 'system', { text: res.why, fx: { kind: 'note' } });
      State().persist();
      return false;
    }
    A.State.removeItem(itemId, 1);
    if (res.escape) {
      addLog(c, 'system', {
        text: `Rompiste ${item.name} y escapaste.`, result: 'hit',
        fx: { kind: 'flee', actor: 'player' },
        say: { text: 'Rompés el pergamino: el aire se cierra a tu alrededor y aparecés lejos de la pelea.', tone: 'good' },
      });
      c.result = 'flee';
      A.Bus.emit('combat:ended', { result: 'flee' });
      State().persist();
      return true;
    }
    afterPlayerAction();
    return true;
  }

  /**
   * Intentar domar desde el combate. Usa el turno: si falla, siguen los enemigos.
   * Solo se puede con el último enemigo en pie.
   */
  function playerTame(instanceId) {
    const c = State().combat;
    if (!c || c.result || !isPlayerTurn(c) || !A.Tame) return null;
    const inst = c.enemies.find((e) => e.instanceId === instanceId && e.hp > 0);
    if (!inst) return null;
    const result = A.Tame.attempt(inst.id, instanceId);
    if (result && result.success) {
      endCombatTamed(instanceId);
      return result;
    }
    addLog(c, 'player', {
      text: result && result.reason ? `No se pudo domar (${A.Tame.reasonText(result.reason)}).` : `${inst.displayName} rechaza la comida y te ataca.`,
      fx: result && result.reason ? { kind: 'note' } : { kind: 'tame-fail', target: fxKey(inst) },
    });
    if (!result || result.itemConsumed) afterPlayerAction();
    return result;
  }

  /** v2.5: ¿podés intentar huir? { ok, why } (atrapado no se puede). */
  function canFlee() {
    const c = State().combat;
    const p = State().player;
    if (!c || !p) return { ok: false, why: '' };
    if ((p.effects || []).some((e) => e.type === 'grab')) return { ok: false, why: 'Estás atrapado: no podés huir.' };
    if ((c.fleeAttempts || 0) >= 2) return { ok: false, why: 'Ya intentaste huir dos veces.' };
    return { ok: true, why: '' };
  }

  function playerFlee() {
    const c = State().combat;
    if (!c || c.result || !isPlayerTurn(c)) return;
    if ((State().player.effects || []).some((e) => e.type === 'grab')) {
      addLog(c, 'system', { text: 'Estás atrapado: no podés huir.', fx: { kind: 'note' } });
      return;
    }
    if (c.fleeAttempts === undefined) c.fleeAttempts = 0;
    if (c.fleeAttempts >= 2) {
      addLog(c, 'system', { text: 'Ya intentaste huir dos veces: no hay escapatoria.', fx: { kind: 'note' } });
      return;
    }
    c.fleeAttempts += 1;
    const p = State().player;
    const fastest = Math.max(...aliveEnemies().map((e) => e.speed || 10));
    const playerSpeed = effectivePlayerSpeed(p);
    const fleeDC = Math.max(8, Math.min(18, 10 + (fastest - playerSpeed)));
    let fleeRoll = A.Utils.dice(20);
    if (fleeRoll === 1 && P() && P().rerollOnes(p)) {
      addLog(c, 'system', { text: 'Suerte: sacaste un 1 y el dado se vuelve a tirar.', fx: { kind: 'passive', passive: 'suerte' } });
      fleeRoll = A.Utils.dice(20);
    }
    const fleeBonus = Math.floor(playerSpeed / 4);
    const fleeTotal = fleeRoll + fleeBonus;

    if (fleeTotal >= fleeDC) {
      addLog(c, 'system', {
        text: `Lograste escapar (intento ${c.fleeAttempts}/2).`,
        roll: fleeRoll, bonus: fleeBonus, total: fleeTotal, vs: fleeDC, vsLabel: 'DC huida', result: 'hit',
        fx: { kind: 'flee', actor: 'player' },
      });
      c.result = 'flee';
      A.Bus.emit('combat:ended', { result: 'flee' });
      State().persist();
      return;
    }
    const remaining = 2 - c.fleeAttempts;
    addLog(c, 'system', {
      text: `Intento de huida fallido (${c.fleeAttempts}/2). ${remaining > 0 ? 'Te queda 1 intento.' : 'No podés volver a intentar.'}`,
      roll: fleeRoll, bonus: fleeBonus, total: fleeTotal, vs: fleeDC, vsLabel: 'DC huida', result: 'miss',
      fx: { kind: 'flee', actor: 'player' },
    });
    const fastestEnemy = aliveEnemies().reduce((a, b) => ((b.speed || 0) > (a.speed || 0) ? b : a));
    if (fastestEnemy) {
      addLog(c, 'system', { text: `${fastestEnemy.displayName} aprovecha tu fallo y te ataca.` });
      enemyStrike(c, fastestEnemy, { forcePlayer: true, free: true });
    }
    if (p.hp <= 0) { onDefeat(); A.Bus.emit('combat:ended', { result: 'defeat' }); return; }
    afterPlayerAction();
  }

  function afterPlayerAction() {
    const c = State().combat;
    if (!c) return;
    if (A.ItemFx) A.ItemFx.tickBuffs(State().player); // v2.4: las mejoras duran tantos turnos tuyos
    State().persist();
    A.Bus.emit('combat:action', { actor: 'player' });
    if (checkEnd()) return;
    nextActor();
  }

  // ============================================================
  // Mascota
  // ============================================================

  function petKnockedOut(c, pet) {
    pet.health = 0;
    pet.effects = [];
    addLog(c, 'system', { text: `${pet.name} cayó inconsciente. Despierta con una poción o descansando.`, fx: { kind: 'death', target: 'pet' } });
    A.Bus.emit('pet:knocked-out', { name: pet.name });
  }

  /** Elige objetivo: el mismo que el jugador; si no está vivo, el de menos vida. */
  function petTarget() {
    const alive = aliveEnemies();
    if (!alive.length) return null;
    const c = State().combat;
    const focus = alive.find((e) => e.instanceId === c.targetInstanceId);
    if (focus) return focus;
    return alive.slice().sort((a, b) => a.hp - b.hp)[0];
  }

  function executePetAction() {
    const c = State().combat;
    if (!c || c.result) return;
    const pet = State().player.pet;
    if (!pet || pet.health <= 0) { nextActor(); return; }
    const target = petTarget();
    if (!target) { nextActor(); return; }
    // v2.5: a veces usa una habilidad de su especie (mordida, aliento, telaraña...)
    const usedSkill = A.Skills ? A.Skills.petTurn(c, pet, target) : false;
    if (!usedSkill) petStrike(c, pet, target, {});
    State().persist();
    A.Bus.emit('combat:action', { actor: 'pet' });
    if (checkEnd()) return;
    nextActor();
  }

  /** Daño de un golpe de la mascota (con hambre pega la mitad; Furia de su especie). */
  function rollPetDamage(pet, mult = 1) {
    const fx = B().statusMods(pet);
    let raw = rollDamage(pet.damage) - (fx.damagePenalty || 0);
    if (A.Skills) raw *= A.Skills.damageMult(pet);
    raw *= mult || 1;
    if (pet.food != null && pet.food <= 0) raw = raw / 2;
    return Math.max(1, Math.round(raw));
  }

  /**
   * v2.5: un golpe de la mascota. opts: atkMod, mult, pierce, say(kind, info), onHit(info).
   * Devuelve { hit, crit, dmg }.
   */
  function petStrike(c, pet, target, opts = {}) {
    const ps = petStats(pet);
    const es = enemyStats(target);
    const atk = ps.attack + (opts.atkMod || 0);
    const r = attackRoll(atk, es.defense);
    const hungry = (pet.food != null && pet.food <= 0);
    const dodge = A.Skills ? A.Skills.dodgeHit(target, r) : null;
    if (dodge) { r.hit = false; r.crit = false; }

    if (!r.hit) {
      const miss = {
        text: r.fumble ? `${pet.name} ataca a ${target.displayName} pero falla` : `${target.displayName} esquivó el ataque de ${pet.name}`,
        actor: pet.name, target: target.displayName, actorIcon: '',
        roll: r.roll, bonus: atk, total: r.total, vs: es.defense, vsLabel: 'defensa',
        result: r.fumble ? 'fumble' : 'evaded',
        fx: { kind: 'attack', actor: 'pet', target: fxKey(target) },
      };
      if (dodge) miss.say = { text: dodge.say.replace(/^Tu golpe/, 'El golpe'), tone: 'neutral' };
      addLog(c, 'pet', miss);
      return { hit: false };
    }
    let rawDmg = rollPetDamage(pet, opts.mult || 1);
    if (r.crit) rawDmg *= 2;
    let finalDmg = mitigate(rawDmg, opts.pierce ? 0 : es.armor);
    const soft = A.Skills ? A.Skills.softenHit(target, finalDmg) : { dmg: finalDmg, skill: null };
    finalDmg = soft.dmg;
    target.hp = Math.max(0, target.hp - finalDmg);
    const entry = {
      text: (r.crit ? `${pet.name} golpea CRÍTICO a ${target.displayName}` : `${pet.name} ataca a ${target.displayName}`) + (hungry ? ' (con hambre, pega la mitad)' : ''),
      actor: pet.name, target: target.displayName, actorIcon: '', damageDice: pet.damage,
      roll: r.roll, bonus: atk, total: r.total, vs: es.defense, vsLabel: 'defensa',
      rawDmg, targetArmor: opts.pierce ? 0 : es.armor, dmg: finalDmg, hpAfter: target.hp, hpMax: target.maxHp,
      result: r.crit ? 'crit' : 'hit',
      softened: soft.skill,
      fx: { kind: 'attack', actor: 'pet', target: fxKey(target) },
    };
    const s = typeof opts.say === 'function' ? opts.say('hit', { crit: r.crit, dmg: finalDmg }) : null;
    if (s) entry.say = s;
    addLog(c, 'pet', entry);
    if (opts.onHit && target.hp > 0) opts.onHit({ dmg: finalDmg, crit: r.crit });
    hitReactions(c, target, 'pet');
    if (target.hp <= 0) enemyDown(c, target, 'pet');
    return { hit: true, crit: r.crit, dmg: finalDmg };
  }

  // ============================================================
  // Enemigos
  // ============================================================

  /**
   * Un golpe de un enemigo. forcePlayer: no puede elegir a la mascota.
   * v2.5 (habilidades): forcePet, atkMod, mult, pierce (sin armadura), noTags,
   *   say(kind, info) frases propias, onHit(victim, info) lo que deja si pega.
   * Devuelve { hit, crit, dmg, toPet }.
   */
  function enemyStrike(c, enemy, opts = {}) {
    const p = State().player;
    const pet = p.pet;
    const petUp = !!(pet && pet.health > 0);
    if (opts.forcePet && !petUp) return { hit: false, toPet: false };
    const targetPet = opts.forcePet ? true : (!opts.forcePlayer && petUp && Math.random() < PET_TARGET_CHANCE);
    const es = enemyStats(enemy);
    const atk = es.attack + (opts.atkMod || 0);
    let defense, armor, targetName;
    if (targetPet) {
      const ps = petStats(pet);
      defense = ps.defense; armor = ps.armor; targetName = pet.name;
    } else {
      const st = playerStats();
      defense = st.defense; armor = st.armor; targetName = p.name;
    }
    if (opts.pierce) armor = 0;
    const r = attackRoll(atk, defense);
    // v2.2.1: Suerte: parte de los golpes que te iban a pegar, fallan
    let lucky = false;
    if (r.hit && !targetPet && P() && P().luckyDodge && Math.random() < P().luckyDodge(p)) {
      r.hit = false;
      r.crit = false;
      lucky = true;
    }
    // v2.4: invisible (poción o pergamino): no te encuentra
    let unseen = false;
    const mods = A.ItemFx ? A.ItemFx.buffMods(p) : {};
    if (r.hit && !targetPet && mods.invisible) {
      r.hit = false;
      r.crit = false;
      unseen = true;
    }
    const enemyIcon = '';
    const damageNotation = enemy.damage;
    const E = A.Narrator && A.Narrator.enemyNoun ? A.Narrator.enemyNoun(enemy) : enemy.displayName;
    const capE = E.charAt(0).toUpperCase() + E.slice(1);
    const sayFn = typeof opts.say === 'function' ? opts.say : null;

    if (!r.hit) {
      const missEntry = {
        passive: lucky ? 'suerte' : null,
        skill: opts.skill || null,
        text: r.fumble ? `${enemy.displayName} ataca a ${targetName} pero falla por completo` : lucky ? `¡Suerte! El golpe de ${enemy.displayName} pasa de largo` : unseen ? `${enemy.displayName} no te encuentra` : `${enemy.displayName} ataca pero ${targetName} esquiva`,
        actor: enemy.displayName, target: targetName, actorIcon: enemyIcon,
        roll: r.roll, bonus: atk, total: r.total, vs: defense, vsLabel: 'defensa',
        result: r.fumble ? 'fumble' : 'evaded',
        fx: { kind: 'attack', actor: fxKey(enemy), target: targetPet ? 'pet' : 'player' },
      };
      if (opts.label) missEntry.text += ` (${opts.label})`;
      if (unseen && !r.fumble) missEntry.say = { text: `${capE} te busca, pero no te ve: el golpe pasa de largo.`, tone: 'good' };
      else if (sayFn && !r.fumble && !lucky) { const s = sayFn('miss', { toPet: targetPet }); if (s) missEntry.say = s; }
      addLog(c, 'enemy', missEntry);
      // v2.4: Brazalete de contraataque: cuando te fallan, a veces devolvés el golpe
      const counter = !targetPet && A.Accessories ? A.Accessories.bonus(p, 'counter') : 0;
      if (counter > 0 && p.hp > 0 && enemy.hp > 0 && !c.result && Math.random() < counter) {
        addLog(c, 'system', { text: 'Contraataque.', fx: { kind: 'buff', target: 'player', label: 'Contraataque', icon: 'swords' }, say: { text: 'Lo esquivás y aprovechás el hueco para devolver el golpe.', tone: 'good' } });
        playerStrike(c, p, enemy, { counter: true });
      }
      return { hit: false, toPet: targetPet };
    }
    let rawDmg = rollEnemyDamage(enemy, { mult: opts.mult || 1 });
    if (r.crit) rawDmg *= 2;
    let finalDmg = mitigate(rawDmg, armor);
    let passive = null;
    let guard = null;
    const victim = targetPet ? pet : p;
    if (targetPet) {
      pet.health = Math.max(0, pet.health - finalDmg);
    } else {
      const ab = shieldPlayer(c, p, finalDmg);
      finalDmg = ab.dmg;
      passive = ab.passive;
      guard = ab.guard;
      A.State.damagePlayer(finalDmg);
    }
    const hitEntry = {
      text: opts.free ? `${enemy.displayName} te golpea por la huida fallida`
        : r.crit ? `${enemy.displayName} golpea CRÍTICO a ${targetName}`
        : targetPet ? `${enemy.displayName} hiere a ${pet.name}` : `${enemy.displayName} te hiere`,
      skill: opts.skill || null,
      actor: enemy.displayName, target: targetName, actorIcon: enemyIcon, damageDice: damageNotation,
      roll: r.roll, bonus: atk, total: r.total, vs: defense, vsLabel: 'defensa',
      rawDmg, targetArmor: armor, dmg: finalDmg, passive,
      hpAfter: targetPet ? pet.health : p.hp, hpMax: targetPet ? pet.maxHealth : p.maxHp,
      result: r.crit ? 'crit' : 'hit',
      fx: { kind: 'attack', actor: fxKey(enemy), target: targetPet ? 'pet' : 'player' },
    };
    if (opts.label) hitEntry.text += ` (${opts.label})`;
    if (guard === 'invincible') hitEntry.say = { text: `${capE} te pega con todo, pero el golpe rebota: no te hace nada.`, tone: 'good' };
    else if (sayFn) {
      const s = sayFn('hit', { toPet: targetPet, crit: r.crit, dmg: finalDmg });
      if (s) {
        if (passive && A.Narrator && A.Narrator.passiveSuffix) s.text += A.Narrator.passiveSuffix(passive);
        hitEntry.say = s;
      }
    }
    addLog(c, 'enemy', hitEntry);
    announceGuard(c, guard);
    if (!targetPet) maybeAnnounceFury(c, p);
    // v2.4: Anillo de espinas y Pergamino de espinas/reflejar: el que te pega se lastima
    if (!targetPet && finalDmg > 0 && enemy.hp > 0) {
      const frac = (A.Accessories ? A.Accessories.bonus(p, 'thorns') : 0) + (mods.reflect || 0);
      if (frac > 0) {
        const back = Math.max(1, Math.round(finalDmg * frac));
        enemy.hp = Math.max(0, enemy.hp - back);
        addLog(c, 'system', {
          text: `Espinas: ${enemy.displayName} recibe ${back} de daño.`,
          fx: { kind: 'tick', target: fxKey(enemy), amount: back, effect: 'bleed' },
          say: { text: `${capE} se lastima con tus espinas: ${back} de daño.`, tone: 'good' },
        });
        if (enemy.hp <= 0) enemyDown(c, enemy, 'thorns');
      }
    }
    // v2.5: Sed de sangre: se cura con lo que te saca
    if (enemy.hp > 0 && finalDmg > 0 && A.Skills) {
      const ls = A.Skills.lifesteal(enemy);
      if (ls > 0) healEnemy(c, enemy, Math.max(1, Math.round(finalDmg * ls)), { say: '{E} se relame con tu sangre: recupera {n} de vida.' });
    }
    const victimUp = targetPet ? pet.health > 0 : p.hp > 0;
    // v2.5: lo que deja la habilidad (estado, robo, drenar)
    if (opts.onHit && victimUp && finalDmg > 0) opts.onHit(victim, { dmg: finalDmg, toPet: targetPet, crit: r.crit });
    // Efectos por tags del enemigo (veneno, fuego, hielo, ácido). v2.5: Venenoso, el doble de seguido
    if (!opts.noTags && finalDmg > 0 && (targetPet ? pet.health > 0 : p.hp > 0)) {
      const venom = A.Skills ? A.Skills.poisonBoost(enemy) : false;
      const tags = (enemy.tags || []).slice();
      if (venom && !tags.includes('poison')) tags.push('poison');
      for (const tag of tags) {
        const te = TAG_EFFECTS[tag];
        const chance = TAG_EFFECT_CHANCE * (venom && te && te.type === 'poison' ? 1.4 : 1);
        if (te && Math.random() < chance) {
          inflict(c, victim, te.type, { turns: te.turns, value: 1 + Math.floor(((enemy.tier || 1) - 1) / 3), source: enemy.id });
          break;
        }
      }
    }
    if (targetPet && pet.health <= 0) petKnockedOut(c, pet);
    return { hit: true, crit: r.crit, dmg: finalDmg, toPet: targetPet };
  }

  /** v2.5: una criatura recupera vida (Curarse, Drenar, Sed de sangre). */
  function healEnemy(c, enemy, n, opts = {}) {
    if (!enemy || enemy.hp <= 0 || n <= 0) return 0;
    const before = enemy.hp;
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + n);
    const got = enemy.hp - before;
    if (got <= 0) return 0;
    if (opts.cast) addLog(c, 'enemy', { text: `${enemy.displayName} se cura.`, fx: { kind: 'cast', actor: fxKey(enemy), element: 'holy' }, say: { text: '', tone: 'bad' } });
    addLog(c, 'enemy', {
      text: `${enemy.displayName} recupera ${got} de vida.`,
      fx: { kind: 'heal', actor: fxKey(enemy), target: fxKey(enemy), amount: got },
      say: { text: A.Skills.fill(opts.say || '{E} recupera {n} de vida.', enemy, { n: got }), tone: 'bad' },
    });
    return got;
  }

  function executeEnemyAction(enemy) {
    const c = State().combat;
    if (!c || c.result) return;
    if (!enemy || enemy.hp <= 0) { nextActor(); return; }
    // v2.5: a veces usa una habilidad (si no, el ataque de siempre)
    const usedSkill = A.Skills ? A.Skills.enemyTurn(c, enemy) : false;
    if (!usedSkill) enemyStrike(c, enemy);
    State().persist();
    A.Bus.emit('combat:action', { actor: 'enemy' });
    if (checkEnd()) return;
    nextActor();
  }

  // ============================================================
  // v2.5: herramientas para las habilidades (js/systems/skills.js)
  // ============================================================

  /** Tirada para resistir una habilidad: D20 + tu modificador contra la dificultad. Devuelve true si resistís. */
  function playerSave(c, enemy, stat, opts = {}) {
    const p = State().player;
    const dc = A.Skills ? A.Skills.saveDC(enemy, opts.dcMod) : 10;
    let roll = A.Utils.dice(20);
    if (roll === 1 && P() && P().rerollOnes(p)) {
      addLog(c, 'system', { text: 'Suerte: sacaste un 1 y el dado se vuelve a tirar.', fx: { kind: 'passive', passive: 'suerte' } });
      roll = A.Utils.dice(20);
    }
    // v2.5: los guerreros aguantan: +2 para resistir con agilidad o ingenio (en fuerza ya son buenos)
    const tough = stat !== 'fuerza' && B().classOf && B().classOf(p) === 'warrior' ? WARRIOR_SAVE : 0;
    const mod = (A.Explore && A.Explore.statMod ? A.Explore.statMod(stat, p) : 0) + tough;
    const total = roll + mod;
    const ok = roll === 20 || (roll !== 1 && total >= dc);
    const statName = (A.Skills && A.Skills.STAT_NAME[stat]) || stat;
    const text = ok ? opts.resist : opts.fail;
    addLog(c, 'system', {
      text: `Tirada de ${statName} para resistir ${opts.label || 'la habilidad'}: ${ok ? 'resistís' : 'no resistís'}.`,
      roll, bonus: mod, total, vs: dc, vsLabel: 'DC resistir', result: ok ? 'hit' : 'miss',
      fx: { kind: 'save', actor: 'player', target: 'player', stat: statName, from: fxKey(enemy) },
      say: { text: text ? A.Skills.fill(text, enemy) : '', tone: ok ? 'good' : 'bad' },
    });
    return ok;
  }

  /** Daño sin tirada de ataque (alientos, hechizos, temblores). Devuelve lo que te sacó. */
  function hurtPlayer(c, enemy, dmg, opts = {}) {
    const p = State().player;
    const ab = shieldPlayer(c, p, Math.max(0, dmg));
    A.State.damagePlayer(ab.dmg);
    let say = opts.say ? A.Skills.fill(opts.say, enemy, { d: ab.dmg }) : '';
    if (say && ab.passive && A.Narrator && A.Narrator.passiveSuffix) say += A.Narrator.passiveSuffix(ab.passive);
    addLog(c, 'enemy', {
      text: `${enemy.displayName} te hace ${ab.dmg} de daño.`,
      actor: enemy.displayName, target: p.name, dmg: ab.dmg, hpAfter: p.hp, hpMax: p.maxHp, passive: ab.passive, result: 'hit',
      fx: { kind: 'spell', actor: fxKey(enemy), target: 'player', element: opts.element || 'earth' },
      say: ab.guard === 'invincible' ? { text: 'Te alcanza de lleno, pero rebota: no te hace nada.', tone: 'good' } : { text: say, tone: 'bad' },
    });
    announceGuard(c, ab.guard);
    if (p.hp > 0) maybeAnnounceFury(c, p);
    return ab.dmg;
  }

  function hurtPet(c, enemy, dmg, opts = {}) {
    const pet = State().player.pet;
    if (!pet || pet.health <= 0) return 0;
    const got = Math.max(0, Math.min(pet.health, dmg));
    pet.health -= got;
    addLog(c, 'enemy', {
      text: `${enemy.displayName} le hace ${got} de daño a ${pet.name}.`,
      actor: enemy.displayName, target: pet.name, dmg: got, hpAfter: pet.health, hpMax: pet.maxHealth, result: 'hit',
      fx: { kind: 'spell', actor: fxKey(enemy), target: 'pet', element: opts.element || 'earth' },
      say: { text: A.Skills.fill(opts.say || '{P} recibe {d} de daño.', enemy, { d: got }), tone: 'bad' },
    });
    if (pet.health <= 0) petKnockedOut(c, pet);
    return got;
  }

  /** Daño directo de tu mascota (alientos o hechizos de su especie). */
  function hurtEnemy(c, t, dmg, opts = {}) {
    if (!t || t.hp <= 0) return 0;
    const got = Math.max(1, dmg);
    t.hp = Math.max(0, t.hp - got);
    addLog(c, opts.actor === 'pet' ? 'pet' : 'player', {
      text: `${t.displayName} recibe ${got} de daño.`,
      target: t.displayName, dmg: got, hpAfter: t.hp, hpMax: t.maxHp, result: 'hit',
      fx: { kind: 'spell', actor: opts.actor || 'pet', target: fxKey(t), element: opts.element || 'earth' },
      say: { text: opts.say || `${A.Skills.noun(t)} recibe ${got} de daño.`, tone: 'good' },
    });
    if (t.hp <= 0) enemyDown(c, t, 'pet');
    return got;
  }

  function healPet(c, n, opts = {}) {
    const pet = State().player.pet;
    if (!pet || pet.health <= 0 || n <= 0) return 0;
    const before = pet.health;
    pet.health = Math.min(pet.maxHealth, pet.health + n);
    const got = pet.health - before;
    if (got > 0) addLog(c, 'pet', { text: `${pet.name} recupera ${got} de vida.`, fx: { kind: 'heal', actor: 'pet', target: 'pet', amount: got }, say: { text: A.Skills.fill(opts.say || '{P} recupera {n} de vida.', null, { n: got }), tone: 'good' } });
    return got;
  }

  /** Invoca una criatura que se suma a la pelea (actúa al final de la ronda). */
  function summonEnemy(c, by, id) {
    const data = A.Data.getById('enemies', id);
    if (!data || !A.Encounter || !A.Encounter.spawnInstance) return null;
    const inst = A.Encounter.spawnInstance(data);
    normalizeInstance(inst);
    inst.summoned = true;
    c.enemies.push(inst);
    assignLabels(c.enemies);
    c.initiative.push({ kind: 'enemy', id: inst.instanceId, name: inst.displayName, speed: inst.speed || 10, tieRoll: 0 });
    return inst;
  }

  const kit = {
    strike: (enemy, opts) => enemyStrike(State().combat, enemy, opts),
    petStrike: (pet, target, opts) => petStrike(State().combat, pet, target, opts),
    save: (enemy, stat, opts) => playerSave(State().combat, enemy, stat, opts),
    status: (victim, type, opts) => inflict(State().combat, victim, type, opts),
    immune: (victim, type) => (victim === State().player ? immunityOf(victim, type) : (A.Skills ? A.Skills.immune(victim, type) : null)),
    log: (type, payload) => addLog(State().combat, type, payload),
    hurtPlayer: (enemy, dmg, opts) => hurtPlayer(State().combat, enemy, dmg, opts),
    hurtPet: (enemy, dmg, opts) => hurtPet(State().combat, enemy, dmg, opts),
    hurtEnemy: (t, dmg, opts) => hurtEnemy(State().combat, t, dmg, opts),
    healEnemy: (enemy, n, opts) => healEnemy(State().combat, enemy, n, opts),
    healPet: (n, opts) => healPet(State().combat, n, opts),
    summon: (by, id) => summonEnemy(State().combat, by, id),
    rollDamage: (enemy, opts) => rollEnemyDamage(enemy, opts),
    rollPetDamage: (pet, mult) => rollPetDamage(pet, mult),
    playerStats: () => playerStats(),
    alive: () => aliveEnemies(),
    fxKey,
  };

  // ============================================================
  // Resultado
  // ============================================================

  /** XP, subida de nivel, XP de mascota y loot de los enemigos indicados. */
  function grantRewards(c, defeated) {
    const p = A.State.player;
    const acc = (k) => (A.Accessories ? A.Accessories.bonus(p, k) : 0);
    const EL = B().ELITE || { xp: 1, coin: 1, drop: 1 };
    // v2.5: la élite da más; lo invocado, la mitad de XP y nada de botín
    const xpMult = (e) => (e.elite ? EL.xp : 1) * (e.summoned ? 0.5 : 1);
    let totalXp = 0;
    for (const e of defeated) totalXp += Math.round(A.Progression.xpForEnemy(e) * xpMult(e));
    // v2.4: Amuleto de sabiduría
    if (acc('xp') > 0) totalXp = Math.round(totalXp * (1 + acc('xp')));
    if (totalXp > 0) {
      p.xp = (p.xp || 0) + totalXp;
      addLog(c, 'system', { text: `Ganaste ${totalXp} XP.`, fx: { kind: 'reward', xp: totalXp } });
      A.Bus.emit('player:xp-changed', { current: p.xp, toNext: A.Progression.xpForLevel(p.level + 1) });
      for (const lv of A.Progression.checkLevelUp(p)) {
        addLog(c, 'system', { text: `¡Subiste al nivel ${lv.level}! ${lv.text}. Te recuperás por completo.`, fx: { kind: 'reward', levelUp: lv.level } });
        A.State.addChronicle({ type: 'system', text: `¡Subiste al nivel ${lv.level}! ${lv.text}.` });
        A.Bus.emit('player:leveled', { newLevel: lv.level });
      }
    }

    // Mascota: gana la mitad de la XP si terminó consciente
    const pet = p.pet;
    if (pet && pet.health > 0 && totalXp > 0 && A.Tame && A.Tame.addPetXp) {
      const petXp = Math.floor(totalXp / 2);
      addLog(c, 'system', { text: `${pet.name} ganó ${petXp} XP.`, fx: { kind: 'reward', petXp } });
      for (const msg of A.Tame.addPetXp(pet, petXp)) addLog(c, 'system', { text: msg, fx: { kind: 'note' } });
    }

    // Loot
    let totalCoins = 0;
    const aggregated = {};
    // v2.4: Talismán de la fortuna y Trébol; y lo que pide una misión en curso cae más seguido
    const goldMult = 1 + acc('gold');
    const dropMult = 1 + acc('drops');
    const wanted = A.Quests && A.Quests.wantedItems ? A.Quests.wantedItems() : new Set();
    for (const inst of defeated) {
      const enemyData = A.Data.getById('enemies', inst.id);
      if (!enemyData) continue;
      // v2.5: lo que te robó, vuelve
      if (inst.stolen > 0) {
        if (A.Currency && A.Currency.add) A.Currency.add(inst.stolen);
        addLog(c, 'loot', { text: `Recuperás lo que te robó ${inst.displayName}.`, fx: { kind: 'note' }, say: { text: `Recuperás lo que te robó ${A.Skills ? A.Skills.noun(inst) : inst.displayName}: ${A.Narrator ? A.Narrator.coinsInWords(inst.stolen) : inst.stolen}.`, tone: 'good' } });
        inst.stolen = 0;
      }
      if (inst.summoned) continue; // lo invocado no deja monedas ni botín
      const eliteMult = inst.elite ? EL.coin : 1;
      const eliteDrop = inst.elite ? EL.drop : 1;
      // v2.0: cada enemigo suelta monedas SIEMPRE, según su peligro
      const sure = B().Economy && B().Economy.coinsFor ? Math.round(B().Economy.coinsFor(enemyData) * goldMult * eliteMult) : 0;
      if (sure > 0) {
        totalCoins += sure;
        if (A.Currency && A.Currency.add) A.Currency.add(sure); else A.State.addItem('coin_copper', sure);
      }
      for (const d of enemyData.drops || []) {
        // las monedas automáticas ya se pagaron arriba; solo cuentan las puestas a mano en el editor
        if (d.itemId === 'coin_copper' && (d.source === 'balance' || d.source === 'auto' || !d.source)) continue;
        let chance = Math.min(0.95, (d.chance || 0) * dropMult * eliteDrop);
        if (wanted.has(d.itemId)) chance = Math.max(chance, QUEST_DROP_CHANCE);
        if (Math.random() >= chance) continue;
        const qMin = Math.max(1, d.qtyMin || 1);
        const qMax = Math.max(qMin, d.qtyMax || qMin);
        const qty = qMin + Math.floor(Math.random() * (qMax - qMin + 1));
        if (d.itemId === 'coin_copper') {
          totalCoins += qty;
          if (A.Currency && A.Currency.add) A.Currency.add(qty); else A.State.addItem(d.itemId, qty);
          continue;
        }
        const ok = A.State.addItem(d.itemId, qty);
        const item = A.Inventory.resolveData ? A.Inventory.resolveData(d.itemId) : A.Data.getById('items', d.itemId);
        if (ok && item) {
          if (!aggregated[d.itemId]) aggregated[d.itemId] = { item, qty: 0 };
          aggregated[d.itemId].qty += qty;
        } else if (!ok) {
          addLog(c, 'loot', { text: 'Hubo botín pero no entró en la mochila.' });
        }
      }
    }
    if (totalCoins > 0) addLog(c, 'loot', { text: `Recogiste ${A.Narrator ? A.Narrator.coinsInWords(totalCoins) : A.Currency.formatPrice(totalCoins)}.`, fx: { kind: 'reward', coins: totalCoins } });
    const dropList = Object.values(aggregated);
    if (dropList.length > 0) {
      addLog(c, 'loot', {
        text: `Botín: ${dropList.map((d) => (d.qty > 1 ? `${d.item.name} ×${d.qty}` : d.item.name)).join(', ')}`,
        fx: { kind: 'reward', items: dropList.map((d) => ({ itemId: d.item.id, qty: d.qty })) },
      });
    }
    return totalXp;
  }

  function onVictory() {
    const c = State().combat;
    if (!c || c.result) return;
    c.result = 'victory';
    if (A.Time) A.Time.advance(1, 'combat');
    if (A.Survival) A.Survival.applyTurnTick('combat');
    if (A.Tame && A.Tame.consumePetFood) A.Tame.consumePetFood(1);

    const totalXp = grantRewards(c, c.enemies);

    // v2.1: al ganar, los magos recuperan parte del maná
    const pw = State().player;
    const winShare = B().manaRegenOf ? B().manaRegenOf(pw).win : 0;
    if (winShare > 0 && pw.hasMagic && pw.mana < pw.maxMana) {
      const before = pw.mana;
      A.State.setMana(Math.min(pw.maxMana, pw.mana + Math.max(1, Math.round(pw.maxMana * winShare))));
      if (pw.mana > before) addLog(c, 'system', { text: `Recuperás ${pw.mana - before} de maná.`, fx: { kind: 'reward', mana: pw.mana - before } });
    }
    // v2.1.1: los guerreros tienen aguante: al ganar recuperan parte de la vida
    const hpShare = B().hpRegenOf ? B().hpRegenOf(pw).win : 0;
    if (hpShare > 0 && pw.hp > 0 && pw.hp < pw.maxHp) {
      const before = pw.hp;
      A.State.healHp(Math.max(1, Math.round(pw.maxHp * hpShare)));
      if (pw.hp > before) addLog(c, 'system', { text: `Recuperás ${pw.hp - before} de vida.`, fx: { kind: 'reward', hp: pw.hp - before } });
    }

    if (A.State.world && A.State.world.regionId) {
      A.State.incrementRegionEncounters(A.State.world.regionId);
      addLog(c, 'system', { text: `Encuentros completados aquí: ${A.State.encountersInRegion(A.State.world.regionId)}.` });
    }
    A.State.addChronicle({ type: 'combat', text: `Venciste a ${A.Narrator && A.Narrator.groupPhrase ? A.Narrator.groupPhrase(c.enemies).text : A.Encounter.describeGroup(c.enemies)} (+${totalXp} XP).` });
    // v2.0: para las misiones ("mata 3 esqueletos")
    A.Bus.emit('combat:victory', { enemyIds: c.enemies.map((e) => e.id), regionId: A.State.world ? A.State.world.regionId : null });
    A.Bus.emit('combat:ended', { result: 'victory', xp: totalXp });
    State().persist();
  }

  /** Terminó porque domaste al último enemigo: recompensa por los que cayeron. */
  function endCombatTamed(instanceId) {
    const c = State().combat;
    if (!c || c.result) return;
    c.result = 'tamed';
    if (A.Time) A.Time.advance(1, 'combat');
    const defeated = c.enemies.filter((e) => e.hp <= 0 && e.instanceId !== instanceId);
    const xp = grantRewards(c, defeated);
    const tamed = c.enemies.find((e) => e.instanceId === instanceId);
    addLog(c, 'system', { text: `${tamed ? tamed.name : 'La criatura'} ahora te acompaña.`, fx: tamed ? { kind: 'tamed', target: fxKey(tamed) } : undefined });
    if (xp > 0) A.State.addChronicle({ type: 'combat', text: `Combate terminado al domar (+${xp} XP).` });
    A.Bus.emit('combat:ended', { result: 'tamed', xp });
    State().persist();
  }

  function onDefeat() {
    const c = State().combat;
    if (!c || c.result) return;
    c.result = 'defeat';
    addLog(c, 'system', { text: 'Caíste en combate.', fx: { kind: 'defeat' } });
    const p = A.State.player;
    p.hp = 1;
    p.mana = Math.floor(p.maxMana / 2);
    p.effects = [];
    A.State.world.regionId = 'pueblo_inicial';
    A.State.traveling = null;
    A.State.addChronicle({ type: 'combat', text: `Caíste contra ${A.Encounter.describeGroup(c.enemies)}. Despertás de vuelta en el pueblo.` });
    A.Bus.emit('combat:ended', { result: 'defeat' });
    State().persist();
  }

  function finish() {
    const p = State().player;
    if (p) {
      p.effects = [];
      if (p.pet) p.pet.effects = [];
    }
    State().combat = null;
    State().persist();
  }

  // ============================================================
  // Helpers
  // ============================================================

  function addLog(c, type, payload) {
    const entry = { ts: Date.now(), type };
    if (typeof payload === 'string') entry.text = payload;
    else Object.assign(entry, payload);
    // v1.9.1: el narrador cuenta la acción con palabras (se elige una sola vez)
    // v2.4: si la acción trae su propia frase (objetos, accesorios), se usa esa
    if (A.Narrator && !entry.say) {
      try { entry.say = A.Narrator.say(entry, c); } catch (err) { entry.say = null; }
    } else if (entry.say && entry.say.text && A.Narrator && A.Narrator.contract) {
      entry.say.text = A.Narrator.contract(entry.say.text); // "a el orco" -> "al orco"
    }
    // v1.9.1: foto de la vida de todos después de esta acción. La vista la usa
    // para no adelantar el resultado mientras el dado todavía rueda.
    entry._hp = hpSnapshot(c);
    c.log.push(entry);
    A.Bus.emit('combat:action', entry);
  }

  function hpSnapshot(c) {
    const p = State().player;
    const snap = { player: p.hp, mana: p.mana };
    if (p.pet) snap.pet = p.pet.health;
    for (const e of c.enemies || []) snap[fxKey(e)] = e.hp;
    return snap;
  }

  function availableSpells() {
    const p = State().player;
    if (!p.hasMagic) return [];
    return (p.spells || []).map((id) => A.Data.getById('spells', id)).filter(Boolean);
  }

  function availableItems() {
    const p = State().player;
    return (p.inventory || []).filter((s) => {
      const it = A.Data.getById('items', s.itemId);
      return it && (it.subtype === 'potion' || it.subtype === 'food' || it.subtype === 'scroll');
    });
  }

  /** Para la UI: chance de pegarle a un enemigo (0..1). */
  function hitChanceVs(instance) {
    if (!instance) return 0;
    return B().hitChance(playerStats().attack, enemyStats(instance).defense);
  }

  A.Combat = {
    start,
    finish,
    setTarget,
    getTarget,
    aliveEnemies,
    playerAttack,
    playerPowerAttack,
    powerInfo,
    playerSpell,
    playerUseItem,
    playerTame,
    playerFlee,
    endCombatTamed,
    availableSpells,
    availableItems,
    effectivePlayerSpeed,
    composePlayerDamage,
    applyStatus,
    removeStatus,
    effectLabel,
    hitChanceVs,
    // v2.5
    canFlee,
    enemyStats,
    petStats,
    kit,
  };
})(window.Aventurs);
