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

   API:
     start({ enemies | enemyId | regionId, fromTravel, ambush })
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
    if (p.pet) p.pet.effects = [];

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

    if (combat.ambush) {
      const firstEnemyIdx = initiative.findIndex((e) => e.kind === 'enemy');
      if (firstEnemyIdx > 0) combat.initiative = initiative.slice(firstEnemyIdx).concat(initiative.slice(0, firstEnemyIdx));
    } else if (combat.surprise) {
      // v2.0: los agarraste desprevenidos: vos (y tu mascota) actúan primero
      const mine = initiative.filter((e) => e.kind !== 'enemy');
      const theirs = initiative.filter((e) => e.kind === 'enemy');
      combat.initiative = mine.concat(theirs);
    }
    combat.turn = currentTurnKind(combat);
    State().combat = combat;

    addLog(combat, 'system', { text: `Comienza el combate contra ${A.Encounter.describeGroup(instances)}.`, fx: { kind: 'start', group: A.Encounter.describeGroup(instances), ambush: combat.ambush } });
    if (combat.ambush) addLog(combat, 'system', { text: 'Te emboscaron. Los enemigos atacan primero.' });
    if (combat.surprise) addLog(combat, 'system', { text: 'Los agarraste desprevenidos. Actuás primero.' });
    addLog(combat, 'system', { text: `Orden por velocidad: ${combat.initiative.map((i) => `${i.name} (vel ${i.speed})`).join(' → ')}` });
    for (const tg of tieGroups) {
      addLog(combat, 'system', { text: `Empate de velocidad ${tg.speed}, desempate con D20: ${tg.members.map((m) => `${m.name}: ${m.tieRoll}`).join(', ')}` });
    }
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
    return {
      attack: (pet.attack != null ? pet.attack : B().Pet.attack(pet.level || 1)) - fx.attackPenalty,
      defense: 8 + (pet.dodge || 0) - fx.defensePenalty,
      armor: pet.armor || 0,
    };
  }

  function enemyStats(inst) {
    const fx = B().statusMods(inst);
    return {
      attack: (inst.attack || 0) - fx.attackPenalty,
      defense: (inst.difficulty || 10) - fx.defensePenalty,
      armor: inst.armor || 0,
    };
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
    return P() ? { critMin: P().critMin(p), reroll1: P().rerollOnes(p) } : {};
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
    if (target === State().player && P() && P().immune(target, type)) return false;
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
    })[type] || type;
  }

  /** Arma o hechizo con statusEffect: chance de aplicarlo al pegar. */
  function maybeInflictStatusOnHit(source, target, c) {
    if (!source || !target || !source.statusEffect) return;
    const eff = source.statusEffect;
    if (Math.random() > (eff.chance || 0)) return;
    applyStatus(target, eff.type, { turns: eff.turns || 3, value: eff.value || 1, source: source.id });
    if (c) addLog(c, 'system', { text: `${targetName(target)} sufre ${effectLabel(eff.type)}.`, fx: { kind: 'status', target: fxKey(target), effect: eff.type } });
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
      if (ef.type === 'bleed' || ef.type === 'poison' || ef.type === 'fire') {
        dmg += ef.value;
        if (!tickType) tickType = ef.type;
        parts.push(`${effectLabel(ef.type)} ${ef.value}`);
      }
      if (ef.type === 'shock' && Math.random() < STUN_CHANCE) stunned = true;
      ef.turns -= 1;
    }
    entity.effects = entity.effects.filter((e) => e.turns > 0);

    const name = targetName(entity);
    if (dmg > 0) {
      if (kind === 'player') {
        const ab = P() ? P().absorbHit(c, entity, dmg, { tick: true }) : { dmg, passive: null };
        A.State.damagePlayer(ab.dmg);
        addLog(c, 'system', { text: `Efectos: ${parts.join(', ')}. -${ab.dmg} salud (HP ${entity.hp}/${entity.maxHp})`, passive: ab.passive, fx: { kind: 'tick', target: 'player', amount: ab.dmg, effect: tickType } });
        if (entity.hp <= 0) return { skip: true, died: true };
        maybeAnnounceFury(c, entity);
      } else if (kind === 'pet') {
        entity.health = Math.max(0, entity.health - dmg);
        addLog(c, 'system', { text: `${name} sufre ${parts.join(', ')} (-${dmg}, HP ${entity.health}/${entity.maxHealth})`, fx: { kind: 'tick', target: 'pet', amount: dmg, effect: tickType } });
        if (entity.health <= 0) { petKnockedOut(c, entity); return { skip: true }; }
      } else {
        entity.hp = Math.max(0, entity.hp - dmg);
        addLog(c, 'system', { text: `${name} sufre ${parts.join(', ')} (-${dmg}, HP ${entity.hp}/${entity.maxHp})`, fx: { kind: 'tick', target: fxKey(entity), amount: dmg, effect: tickType } });
        if (entity.hp <= 0) { addLog(c, 'system', { text: `${name} cayó por los efectos.`, killed: name, fx: { kind: 'death', target: fxKey(entity) } }); return { skip: true }; }
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
    // v2.1: los magos recuperan maná al empezar cada turno (cada raza, una cantidad distinta)
    const mana = B().manaRegenOf ? B().manaRegenOf(p).turn : 0;
    if (mana > 0 && p.hasMagic && p.mana < p.maxMana && c.round > 1) {
      const before = p.mana;
      A.State.setMana(Math.min(p.maxMana, p.mana + mana));
      addLog(c, 'system', { text: `Recuperás ${p.mana - before} de maná.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: 0, mana: p.mana - before, quiet: true } });
    }
  }

  function nextActor() {
    const c = State().combat;
    if (!c) return;
    c.currentActorIdx += 1;
    if (c.currentActorIdx >= c.initiative.length) c.currentActorIdx = c.initiative.length;
    later(c, () => advanceIfNotPlayer(), NEXT_DELAY);
  }

  function assignLabels(instances) {
    const counts = {};
    for (const e of instances) counts[e.id] = (counts[e.id] || 0) + 1;
    const idx = {};
    for (const e of instances) {
      if (counts[e.id] > 1) {
        idx[e.id] = (idx[e.id] || 0) + 1;
        e.label = String.fromCharCode(64 + idx[e.id]);
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
    const st = playerStats();
    const es = enemyStats(target);
    const r = attackRoll(st.attack, es.defense, playerRollOpts(p));
    const weaponName = st.weapon ? st.weapon.name : 'puños';
    if (r.lucky) addLog(c, 'system', { text: 'Suerte: sacaste un 1 y el dado se vuelve a tirar.', fx: { kind: 'passive', passive: 'suerte' } });

    if (!r.hit) {
      addLog(c, 'player', {
        power: !!pw,
        text: r.fumble ? `Atacaste a ${target.displayName} pero fallaste por completo` : `${target.displayName} esquivó tu ${pw ? 'golpe fuerte' : 'ataque'}`,
        actor: p.name, target: target.displayName, actorIcon: '', weapon: weaponName,
        roll: r.roll, bonus: st.attack, total: r.total, vs: es.defense, vsLabel: 'defensa',
        result: r.fumble ? 'fumble' : 'evaded',
        fx: { kind: 'attack', actor: 'player', target: fxKey(target) },
      });
    } else {
      const dmgRoll = rollPlayerDamage(p);
      let rawDmg = dmgRoll.total;
      if (pw) rawDmg *= pw.mult;
      if (r.crit) rawDmg *= P() ? P().critMult(p) : 2;
      const finalDmg = mitigate(rawDmg, es.armor);
      target.hp = Math.max(0, target.hp - finalDmg);
      let passive = null;
      if (r.crit && P() && P().has(p, 'golpe_gigante')) passive = 'golpe_gigante';
      else if (r.crit && r.roll < 20) passive = 'ojo_certero';
      addLog(c, 'player', {
        passive,
        power: !!pw,
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
        fx: { kind: 'attack', actor: 'player', target: fxKey(target) },
      });
      if (target.hp > 0) maybeInflictStatusOnHit(st.weapon, target, c);
      // Sangre de dragón: a veces el golpe prende fuego
      if (target.hp > 0 && P() && Math.random() < P().burnChance(p)) {
        applyStatus(target, 'fire', { turns: 2, value: P().burnValue(p), source: 'sangre_dragon' });
        addLog(c, 'system', { text: `${target.displayName} se prende fuego.`, fx: { kind: 'status', target: fxKey(target), effect: 'fire', passive: 'sangre_dragon' } });
      }
      if (target.hp <= 0) {
        addLog(c, 'system', { text: `${target.displayName} cayó.`, killed: target.displayName, fx: { kind: 'death', target: fxKey(target) } });
        maybeDropEquippedWeapon(c, target);
      }
    }
    afterPlayerAction();
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
      const heal = A.Utils.rollDice(spell.heal) + Math.floor(power / 2);
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
        if (t.hp <= 0) addLog(c, 'system', { text: `${t.displayName} cayó.`, killed: t.displayName, fx: { kind: 'death', target: fxKey(t) } });
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

  function playerUseItem(itemId) {
    const c = State().combat;
    if (!c || c.result || !isPlayerTurn(c)) return;
    const item = A.Data.getById('items', itemId);
    if (!item) return;
    const slot = State().player.inventory.find((s) => s.itemId === itemId);
    if (!slot) return;
    const before = State().player.hp;
    const beforeMana = State().player.mana;
    const used = A.Inventory.use(itemId);
    if (!used) return;
    const hpDelta = State().player.hp - before;
    const manaDelta = State().player.mana - beforeMana;
    let text = `Usaste ${item.name}.`;
    if (hpDelta > 0) text += ` (+${hpDelta} salud)`;
    if (manaDelta > 0) text += ` (+${manaDelta} maná)`;
    addLog(c, 'player', { text, fx: { kind: 'heal', actor: 'player', target: 'player', amount: hpDelta, mana: manaDelta, icon: '' } });
    afterPlayerAction();
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

  function playerFlee() {
    const c = State().combat;
    if (!c || c.result || !isPlayerTurn(c)) return;
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
    const ps = petStats(pet);
    const es = enemyStats(target);
    const r = attackRoll(ps.attack, es.defense);
    const petIcon = '';
    const hungry = (pet.food != null && pet.food <= 0);

    if (!r.hit) {
      addLog(c, 'pet', {
        text: r.fumble ? `${pet.name} ataca a ${target.displayName} pero falla` : `${target.displayName} esquivó el ataque de ${pet.name}`,
        actor: pet.name, target: target.displayName, actorIcon: petIcon,
        roll: r.roll, bonus: ps.attack, total: r.total, vs: es.defense, vsLabel: 'defensa',
        result: r.fumble ? 'fumble' : 'evaded',
        fx: { kind: 'attack', actor: 'pet', target: fxKey(target) },
      });
    } else {
      let rawDmg = rollDamage(pet.damage);
      if (r.crit) rawDmg *= 2;
      if (hungry) rawDmg = Math.max(1, Math.floor(rawDmg / 2));
      const finalDmg = mitigate(rawDmg, es.armor);
      target.hp = Math.max(0, target.hp - finalDmg);
      addLog(c, 'pet', {
        text: (r.crit ? `${pet.name} golpea CRÍTICO a ${target.displayName}` : `${pet.name} ataca a ${target.displayName}`) + (hungry ? ' (con hambre, pega la mitad)' : ''),
        actor: pet.name, target: target.displayName, actorIcon: petIcon, damageDice: pet.damage,
        roll: r.roll, bonus: ps.attack, total: r.total, vs: es.defense, vsLabel: 'defensa',
        rawDmg, targetArmor: es.armor, dmg: finalDmg, hpAfter: target.hp, hpMax: target.maxHp,
        result: r.crit ? 'crit' : 'hit',
        fx: { kind: 'attack', actor: 'pet', target: fxKey(target) },
      });
      if (target.hp <= 0) addLog(c, 'system', { text: `${target.displayName} cayó por la mascota.`, killed: target.displayName, fx: { kind: 'death', target: fxKey(target) } });
    }
    State().persist();
    A.Bus.emit('combat:action', { actor: 'pet' });
    if (checkEnd()) return;
    nextActor();
  }

  // ============================================================
  // Enemigos
  // ============================================================

  /**
   * Un golpe de un enemigo. forcePlayer: no puede elegir a la mascota.
   */
  function enemyStrike(c, enemy, opts = {}) {
    const p = State().player;
    const pet = p.pet;
    const targetPet = !opts.forcePlayer && pet && pet.health > 0 && Math.random() < PET_TARGET_CHANCE;
    const es = enemyStats(enemy);
    let defense, armor, targetName;
    if (targetPet) {
      const ps = petStats(pet);
      defense = ps.defense; armor = ps.armor; targetName = pet.name;
    } else {
      const st = playerStats();
      defense = st.defense; armor = st.armor; targetName = p.name;
    }
    const r = attackRoll(es.attack, defense);
    const enemyIcon = '';
    const damageNotation = enemy.damage;

    if (!r.hit) {
      addLog(c, 'enemy', {
        text: r.fumble ? `${enemy.displayName} ataca a ${targetName} pero falla por completo` : `${enemy.displayName} ataca pero ${targetName} esquiva`,
        actor: enemy.displayName, target: targetName, actorIcon: enemyIcon,
        roll: r.roll, bonus: es.attack, total: r.total, vs: defense, vsLabel: 'defensa',
        result: r.fumble ? 'fumble' : 'evaded',
        fx: { kind: 'attack', actor: fxKey(enemy), target: targetPet ? 'pet' : 'player' },
      });
      return;
    }
    let rawDmg = rollDamage(damageNotation);
    if (r.crit) rawDmg *= 2;
    let finalDmg = mitigate(rawDmg, armor);
    let passive = null;
    const victim = targetPet ? pet : p;
    if (targetPet) {
      pet.health = Math.max(0, pet.health - finalDmg);
    } else {
      const ab = P() ? P().absorbHit(c, p, finalDmg) : { dmg: finalDmg, passive: null };
      finalDmg = ab.dmg;
      passive = ab.passive;
      A.State.damagePlayer(finalDmg);
    }
    addLog(c, 'enemy', {
      text: opts.free ? `${enemy.displayName} te golpea por la huida fallida`
        : r.crit ? `${enemy.displayName} golpea CRÍTICO a ${targetName}`
        : targetPet ? `${enemy.displayName} hiere a ${pet.name}` : `${enemy.displayName} te hiere`,
      actor: enemy.displayName, target: targetName, actorIcon: enemyIcon, damageDice: damageNotation,
      roll: r.roll, bonus: es.attack, total: r.total, vs: defense, vsLabel: 'defensa',
      rawDmg, targetArmor: armor, dmg: finalDmg, passive,
      hpAfter: targetPet ? pet.health : p.hp, hpMax: targetPet ? pet.maxHealth : p.maxHp,
      result: r.crit ? 'crit' : 'hit',
      fx: { kind: 'attack', actor: fxKey(enemy), target: targetPet ? 'pet' : 'player' },
    });
    if (!targetPet) maybeAnnounceFury(c, p);
    // Efectos por tags del enemigo (veneno, fuego, hielo, ácido)
    if (targetPet ? pet.health > 0 : p.hp > 0) {
      for (const tag of enemy.tags || []) {
        const te = TAG_EFFECTS[tag];
        if (te && Math.random() < TAG_EFFECT_CHANCE) {
          const took = applyStatus(victim, te.type, { turns: te.turns, value: 1 + Math.floor(((enemy.tier || 1) - 1) / 3), source: enemy.id });
          if (took) addLog(c, 'system', { text: `${targetName} sufre ${effectLabel(te.type)}.`, fx: { kind: 'status', target: targetPet ? 'pet' : 'player', effect: te.type } });
          else addLog(c, 'system', { text: `${targetName} no sufre ${effectLabel(te.type)} (pasiva).`, fx: { kind: 'passive', passive: P() ? P().idOf(p) : null, effect: te.type } });
          break;
        }
      }
    }
    if (targetPet && pet.health <= 0) petKnockedOut(c, pet);
  }

  function executeEnemyAction(enemy) {
    const c = State().combat;
    if (!c || c.result) return;
    if (!enemy || enemy.hp <= 0) { nextActor(); return; }
    enemyStrike(c, enemy);
    State().persist();
    A.Bus.emit('combat:action', { actor: 'enemy' });
    if (checkEnd()) return;
    nextActor();
  }

  // ============================================================
  // Resultado
  // ============================================================

  /** XP, subida de nivel, XP de mascota y loot de los enemigos indicados. */
  function grantRewards(c, defeated) {
    const p = A.State.player;
    let totalXp = 0;
    for (const e of defeated) totalXp += A.Progression.xpForEnemy(e);
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
    for (const inst of defeated) {
      const enemyData = A.Data.getById('enemies', inst.id);
      if (!enemyData) continue;
      // v2.0: cada enemigo suelta monedas SIEMPRE, según su peligro
      const sure = B().Economy && B().Economy.coinsFor ? B().Economy.coinsFor(enemyData) : 0;
      if (sure > 0) {
        totalCoins += sure;
        if (A.Currency && A.Currency.add) A.Currency.add(sure); else A.State.addItem('coin_copper', sure);
      }
      for (const d of enemyData.drops || []) {
        // las monedas automáticas ya se pagaron arriba; solo cuentan las puestas a mano en el editor
        if (d.itemId === 'coin_copper' && (d.source === 'balance' || d.source === 'auto' || !d.source)) continue;
        if (Math.random() >= (d.chance || 0)) continue;
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
    if (A.Narrator) {
      try { entry.say = A.Narrator.say(entry, c); } catch (err) { entry.say = null; }
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
      return it && (it.subtype === 'potion' || it.subtype === 'food');
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
  };
})(window.Aventurs);
