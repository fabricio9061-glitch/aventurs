/* ============================================================
   Aventurs — Pelea (2/8): reglas: estadísticas, dados, daño y estados
   La pelea está repartida en js/systems/combat*.js. Cada parte deja sus
   funciones en A._pelea y usa las de las otras por su nombre.
   ============================================================ */

(function (A) {
  'use strict';
  const C = (A._pelea = A._pelea || {});
  const { STUN_CHANCE, MAX_STACKS } = C;
  // De las otras partes
  function State(...a) { return C.State(...a); }
  function B(...a) { return C.B(...a); }
  function P(...a) { return C.P(...a); }
  function fxKey(...a) { return C.fxKey(...a); }
  function enemyDown(...a) { return C.enemyDown(...a); }
  function hittableEnemies(...a) { return C.hittableEnemies(...a); }
  function petKnockedOut(...a) { return C.petKnockedOut(...a); }
  function addLog(...a) { return C.addLog(...a); }

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
    // v3.8: las colas del kitsune y la Emboscada
    const bonus = A.Skills && A.Skills.bonusDamage ? A.Skills.bonusDamage(enemy) : { mult: 1 };
    raw *= bonus.mult;
    if (bonus.ambush) {
      const c = State().combat;
      const n = A.Skills.noun(enemy);
      if (c) addLog(c, 'system', { text: `${enemy.displayName} ataca por sorpresa.`, fx: { kind: 'note', actor: fxKey(enemy), skill: 'emboscada' }, say: { text: `${n.charAt(0).toUpperCase()}${n.slice(1)} ataca por sorpresa: el golpe viene con todo.`, tone: 'bad' } });
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
    // v3.13: Destino favorable (mediano): tirás dos dados y te quedás con el mejor
    if (opts.adv) roll = Math.max(roll, A.Utils.dice(20));
    let lucky = false;
    if (roll === 1 && opts.reroll1) { lucky = true; roll = A.Utils.dice(20); }
    const total = roll + attack;
    const fumble = roll === 1;
    // v3.11 (dossier): el 20 pega siempre; un 18 o 19 (Goliat, Elfo, Anillo del golpe certero) es crítico
    // solo si el golpe llega a la defensa (antes acertaba siempre)
    const hit = roll === 20 || (!fumble && total >= defense);
    const crit = hit && roll >= (opts.critMin || 20);
    return { roll, total, fumble, crit, hit, lucky };
  }

  /** Opciones de tirada del jugador según su pasiva. */
  function playerRollOpts(p) {
    const base = P() ? { critMin: P().critMin(p), reroll1: P().rerollOnes(p) } : { critMin: 20 };
    // v2.4: Anillo del golpe certero: críticos desde más abajo
    const extra = A.Accessories ? A.Accessories.bonus(p, 'crit') : 0;
    if (extra > 0) base.critMin = Math.max(2, (base.critMin || 20) - extra);
    if (A.ItemFx && A.ItemFx.buffMods(p).advantage > 0) base.adv = true; // v3.13
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
    // v3.11: cuánto sacó la Piel de roca y cuánto frenó la Bendición divina (para contarlo)
    return { dmg: gd.dmg, passive: ab.passive, guard: gd.tag, absorbed: ab.absorbed || 0, roca: ab.roca || 0, blessed: ab.blessed || 0, blessBy: ab.blessBy || null };
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
  /**
   * v3.9: la armadura se resta del daño. Si la armadura es igual o mayor que
   * el golpe, lo para del todo (0). Un crítico siempre hace al menos 1.
   */
  function pickOne(list) { return list[Math.floor(Math.random() * list.length)]; }
  function mitigate(raw, armor, crit) {
    const d = raw - (armor || 0);
    return crit ? Math.max(1, d) : Math.max(0, d);
  }

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
      // v3.11
      stagger: 'desequilibrado', exposed: 'expuesto',
      noheal: 'herida maldita', // v3.15
    })[type] || type;
  }

  // v2.5: cómo se nombra cada estado en "X no te hace nada"
  const STATUS_NOUN = {
    poison: 'el veneno', fire: 'el fuego', cold: 'el frío', shock: 'la descarga', bleed: 'el sangrado',
    blind: 'la ceguera', silence: 'el silencio', stun: 'el aturdimiento', curse: 'la maldición',
    prone: 'el golpe', fear: 'el miedo', grab: 'el agarre', corrode: 'el ácido', noheal: 'la maldición',
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

  // ============================================================
  // v3.12: lo único de algunas armas legendarias
  //   bane:  { families: [...], bonus: N, label } -> +N contra esas criaturas (Crematoria)
  //   drain: 0..1 -> esa parte del daño vuelve como vida (Agonía de Escarcha)
  //   chain: N -> un rayo salta a otra criatura y le hace N (Martillo Maldito)
  // ============================================================
  function weaponBane(w, target) {
    const b = w && w.bane;
    if (!b || !target || !b.bonus) return 0;
    const fam = target.family || [];
    return (b.families || []).some((f) => fam.includes(f)) ? b.bonus : 0;
  }
  function weaponSpecials(c, p, w, target, dmg) {
    if (!w || !c) return;
    if (w.drain && p.hp > 0 && p.hp < p.maxHp) {
      const before = p.hp;
      A.State.healHp(Math.max(1, Math.round(dmg * w.drain)));
      const got = p.hp - before;
      if (got > 0) addLog(c, 'system', { text: `${w.name}: +${got} de vida.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: got }, say: { text: `${w.name} bebe del golpe: recuperás ${got} de vida.`, tone: 'good' } });
    }
    if (w.chain) {
      const others = hittableEnemies().filter((e) => e !== target && e.hp > 0);
      const to = others[Math.floor(Math.random() * others.length)];
      if (to) {
        const n = Math.max(1, w.chain);
        to.hp = Math.max(0, to.hp - n);
        addLog(c, 'player', { text: `Un rayo salta de ${w.name} a ${to.displayName}: ${n} de daño.`, target: to.displayName, dmg: n, hpAfter: to.hp, hpMax: to.maxHp, result: 'hit', fx: { kind: 'spell', actor: 'player', target: fxKey(to), element: 'shock', chain: true }, say: { text: `Un rayo salta de ${w.name} y alcanza a ${A.Skills ? A.Skills.noun(to) : to.displayName}: ${n} de daño.`, tone: 'good' } });
        if (to.hp <= 0) enemyDown(c, to, 'player');
      }
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


  Object.assign(C, { playerStats, effectivePlayerSpeed, petStats, enemyStats, rollEnemyDamage, composePlayerDamage, rollPlayerDamage, attackRoll, playerRollOpts, shieldPlayer, announceGuard, immunityOf, maybeAnnounceFury, rollDamage, pickOne, mitigate, applyStatus, removeStatus, effectLabel, inflict, immuneNote, weaponBane, weaponSpecials, maybeInflictStatusOnHit, targetName, startOfTurn, STATUS_NOUN, IMMUNE_LINE });
})(window.Aventurs);
