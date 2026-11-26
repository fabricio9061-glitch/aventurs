/* ============================================================
   Aventurs — Pelea (6/8): huir, la mascota y los aliados invocados
   La pelea está repartida en js/systems/combat*.js. Cada parte deja sus
   funciones en A._pelea y usa las de las otras por su nombre.
   ============================================================ */

(function (A) {
  'use strict';
  const C = (A._pelea = A._pelea || {});
  // De las otras partes
  function State(...a) { return C.State(...a); }
  function B(...a) { return C.B(...a); }
  function P(...a) { return C.P(...a); }
  function hidOf(...a) { return C.hidOf(...a); }
  function heroesOf(...a) { return C.heroesOf(...a); }
  function joinY(...a) { return C.joinY(...a); }
  function fxKey(...a) { return C.fxKey(...a); }
  function isPlayerTurn(...a) { return C.isPlayerTurn(...a); }
  function effectivePlayerSpeed(...a) { return C.effectivePlayerSpeed(...a); }
  function petStats(...a) { return C.petStats(...a); }
  function enemyStats(...a) { return C.enemyStats(...a); }
  function rollEnemyDamage(...a) { return C.rollEnemyDamage(...a); }
  function attackRoll(...a) { return C.attackRoll(...a); }
  function rollDamage(...a) { return C.rollDamage(...a); }
  function mitigate(...a) { return C.mitigate(...a); }
  function removeStatus(...a) { return C.removeStatus(...a); }
  function checkEnd(...a) { return C.checkEnd(...a); }
  function enemyDown(...a) { return C.enemyDown(...a); }
  function nextActor(...a) { return C.nextActor(...a); }
  function aliveEnemies(...a) { return C.aliveEnemies(...a); }
  function hittableEnemies(...a) { return C.hittableEnemies(...a); }
  function hitReactions(...a) { return C.hitReactions(...a); }
  function enemyStrike(...a) { return C.enemyStrike(...a); }
  function addLog(...a) { return C.addLog(...a); }

  // ============================================================
  // v3.3: huir en grupo
  //   El que huye se va solo, con su mascota: deja la pelea y sigue por su
  //   cuenta (se separa del grupo). Los demás siguen peleando contra las
  //   mismas criaturas. Si el que huye era el último en pie, huyen todos
  //   y se llevan a los caídos.
  // ============================================================

  /** Los compañeros que siguen en pie (sin contarte). En solitario, ninguno. */
  function othersStanding(c, p) {
    return c && c.party ? heroesOf(c).filter((h) => h !== p && h.hp > 0) : [];
  }

  /** Te vas de la pelea vos solo: tu turno pasa y los demás siguen. */
  function leaveFight(c, p) {
    const hid = hidOf(p);
    c.fledHids = (c.fledHids || []).concat([hid]);
    p.effects = [];
    if (p.pet) p.pet.effects = [];
    A.Bus.emit('combat:hero-fled', { hid });
    // el grupo se entera (el que huyó sigue por su cuenta; si era el anfitrión, al terminar)
    if (A.Party && A.Party.heroFled) A.Party.heroFled(hid);
    State().persist();
    if (checkEnd()) return;
    nextActor();
  }

  /** Huyen todos (el que huyó era el último en pie): los caídos se levantan con 1 de vida. */
  function everyoneFlees(c) {
    if (c.party) {
      const carried = [];
      for (const h of heroesOf(c)) {
        if (h.hp > 0) continue;
        A.State.withHero(h, () => { h.hp = 1; });
        carried.push(h.name);
      }
      if (carried.length) {
        addLog(c, 'system', {
          text: `Te llevás a ${joinY(carried)} a la rastra (con 1 de vida).`, fx: { kind: 'note' },
          say: { text: `Antes de irte, te cargás a ${joinY(carried)} y ${carried.length > 1 ? 'los' : 'lo'} sacás de ahí.`, tone: 'good' },
        });
      }
    }
    c.result = 'flee';
    A.Bus.emit('combat:ended', { result: 'flee' });
    State().persist();
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
      // v3.3: en grupo el que huye se va solo y los demás siguen peleando.
      // Si era el último en pie, huyen todos (y se llevan a los caídos).
      const alone = othersStanding(c, p).length > 0;
      addLog(c, 'system', {
        text: alone ? `Lograste escapar (intento ${c.fleeAttempts}/2). Seguís por tu cuenta.` : `Lograste escapar (intento ${c.fleeAttempts}/2).`,
        roll: fleeRoll, bonus: fleeBonus, total: fleeTotal, vs: fleeDC, vsLabel: 'DC huida', result: 'hit',
        fx: { kind: 'flee', actor: 'player' },
        ...(alone ? { say: { text: 'Salís corriendo y los perdés de vista. Tus compañeros se quedan peleando sin vos.', tone: 'neutral' } } : {}),
      });
      if (alone) leaveFight(c, p);
      else everyoneFlees(c);
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
    if (p.hp <= 0) {
      // v3.0: en grupo, si queda alguien en pie la pelea sigue
      if (checkEnd()) return;
      afterPlayerAction();
      return;
    }
    afterPlayerAction();
  }

  /** v3.3: usaste una poción, comida o hierba: el turno sigue siendo tuyo. */
  function keepTurnAfterItem(c) {
    c.itemsTurn = (c.itemsTurn || 0) + 1;
    State().persist();
    if (checkEnd()) return;
    A.Bus.emit('combat:turn', { actor: 'player', round: c.round, keep: true });
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
    const alive = hittableEnemies();
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
    if (A.Skills && A.Skills.bonusDamage) raw *= A.Skills.bonusDamage(pet).mult; // v3.8: colas
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
    const dodge = A.Skills ? A.Skills.dodgeHit(target, r, pet) : null;
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
      else if (typeof opts.say === 'function' && !r.fumble) { const ms = opts.say('miss', {}); if (ms) miss.say = ms; } // v3.9: la activa que falla también se nombra
      addLog(c, 'pet', miss);
      return { hit: false };
    }
    let rawDmg = rollPetDamage(pet, opts.mult || 1);
    if (r.crit) rawDmg *= 2;
    let finalDmg = mitigate(rawDmg, opts.pierce ? 0 : es.armor, r.crit);
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
    if (s && finalDmg > 0) entry.say = s; // v3.9: si la armadura lo paró, lo cuenta el narrador
    addLog(c, 'pet', entry);
    if (opts.onHit && target.hp > 0) opts.onHit({ dmg: finalDmg, crit: r.crit });
    hitReactions(c, target, 'pet');
    if (target.hp <= 0) enemyDown(c, target, 'pet');
    return { hit: true, crit: r.crit, dmg: finalDmg };
  }

  // ============================================================
  // v3.11 (dossier): aliados invocados — el lobo del Aullido de manada
  // No es una mascota: no ocupa su lugar, no come ni sube de nivel, y se va
  // cuando termina la pelea, cuando cae o cuando hizo sus ataques.
  // Ataca al blanco de su dueño; las criaturas lo pueden atacar.
  // ============================================================

  const ALLY_TARGET_CHANCE = 0.30;
  function allyKey(a) { return `ally:${a.aid}`; }
  function allyOwnerKey(c, h) { return c && c.party ? hidOf(h) : 'solo'; }
  /** Los aliados invocados de un héroe que siguen en la pelea. */
  function alliesOf(c, h) {
    if (!c || !c.allies || !h) return [];
    const k = allyOwnerKey(c, h);
    return c.allies.filter((a) => a.owner === k && a.hp > 0 && a.attacksLeft > 0);
  }
  /** spec: { kind, species, name, hp, damage, attack, defense, attacks, speed } */
  function summonAlly(c, owner, spec) {
    const k = allyOwnerKey(c, owner);
    // no se juntan dos del mismo dueño: el nuevo reemplaza al anterior
    c.allies = (c.allies || []).filter((a) => !(a.owner === k && a.kind === spec.kind));
    c.allySeq = (c.allySeq || 0) + 1;
    const a = {
      aid: `a${c.allySeq}`, kind: spec.kind, species: spec.species, owner: k, ownerName: owner.name,
      name: spec.name, hp: spec.hp, maxHp: spec.hp, damage: spec.damage, attack: spec.attack, defense: spec.defense,
      armor: 0, attacksLeft: spec.attacks, maxAttacks: spec.attacks, born: c.round, effects: [],
    };
    c.allies.push(a);
    c.initiative.push({ kind: 'ally', id: allyKey(a), aid: a.aid, hid: c.party ? hidOf(owner) : undefined, name: a.name, speed: spec.speed || 12, tieRoll: 0 });
    return a;
  }

  function executeAllyAction(a) {
    const c = State().combat;
    if (!c || c.result) return;
    if (!a || a.hp <= 0 || a.attacksLeft <= 0) { nextActor(); return; }
    const target = petTarget();
    if (!target) { nextActor(); return; }
    allyStrike(c, a, target);
    a.attacksLeft -= 1;
    if (a.attacksLeft <= 0 && a.hp > 0 && !c.result) {
      addLog(c, 'system', { text: `${a.name} se va.`, fx: { kind: 'death', target: allyKey(a) }, say: { text: `Cumplida su parte, ${lowerFirst(a.name)} aúlla una vez más y se pierde entre las sombras.`, tone: 'neutral' } });
    }
    State().persist();
    A.Bus.emit('combat:action', { actor: 'ally' });
    if (checkEnd()) return;
    nextActor();
  }
  function lowerFirst(t) { return String(t).charAt(0).toLowerCase() + String(t).slice(1); }

  /** El golpe de un aliado invocado (como el de una mascota, sin habilidades). */
  function allyStrike(c, a, target) {
    const es = enemyStats(target);
    const r = attackRoll(a.attack, es.defense);
    const dodge = A.Skills ? A.Skills.dodgeHit(target, r, { name: a.name, species: a.species, id: a.species }) : null;
    if (dodge) { r.hit = false; r.crit = false; }
    const n = A.Skills ? A.Skills.noun(target) : target.displayName;
    const base = { actor: a.name, target: target.displayName, roll: r.roll, bonus: a.attack, total: r.total, vs: es.defense, vsLabel: 'defensa', fx: { kind: 'attack', actor: allyKey(a), target: fxKey(target) } };
    if (!r.hit) {
      addLog(c, 'pet', { ...base, text: r.fumble ? `${a.name} ataca a ${target.displayName} pero falla` : `${target.displayName} esquivó a ${a.name}`, result: r.fumble ? 'fumble' : 'evaded', say: { text: dodge ? dodge.say : `${a.name} salta sobre ${n}, pero no lo alcanza.`, tone: 'neutral' } });
      return { hit: false };
    }
    let raw = rollDamage(a.damage);
    if (r.crit) raw *= 2;
    let dmg = mitigate(raw, es.armor, r.crit);
    const soft = A.Skills ? A.Skills.softenHit(target, dmg) : { dmg, skill: null };
    dmg = soft.dmg;
    target.hp = Math.max(0, target.hp - dmg);
    addLog(c, 'pet', {
      ...base, text: `${a.name} ${r.crit ? 'muerde CRÍTICO a' : 'muerde a'} ${target.displayName}`,
      damageDice: a.damage, rawDmg: raw, targetArmor: es.armor, dmg, hpAfter: target.hp, hpMax: target.maxHp, result: r.crit ? 'crit' : 'hit', softened: soft.skill,
      say: { text: dmg > 0 ? `${a.name} ${r.crit ? 'se prende del cuello de' : 'muerde a'} ${n}: ${dmg} de daño.` : `${a.name} muerde a ${n}, pero no le hace nada.`, tone: r.crit ? 'crit' : 'good' },
    });
    if (target.hp <= 0) enemyDown(c, target, 'pet');
    return { hit: true, crit: r.crit, dmg };
  }

  /** Una criatura ataca a un aliado invocado (sin estados ni robo: cae o no cae). */
  function strikeAlly(c, enemy, a, opts = {}) {
    const es = enemyStats(enemy);
    const atk = es.attack + (opts.atkMod || 0);
    const r = attackRoll(atk, a.defense);
    if ((enemy.effects || []).some((e) => e.type === 'stagger')) removeStatus(enemy, 'stagger');
    const E = A.Narrator && A.Narrator.enemyNoun ? A.Narrator.enemyNoun(enemy) : enemy.displayName;
    const capE = E.charAt(0).toUpperCase() + E.slice(1);
    const base = { actor: enemy.displayName, target: a.name, roll: r.roll, bonus: atk, total: r.total, vs: a.defense, vsLabel: 'defensa', skill: opts.skill || null, fx: { kind: 'attack', actor: fxKey(enemy), target: allyKey(a) } };
    if (!r.hit) {
      addLog(c, 'enemy', { ...base, text: `${enemy.displayName} ataca a ${a.name} pero falla`, result: r.fumble ? 'fumble' : 'evaded', say: { text: `${capE} se tira sobre ${lowerFirst(a.name)}, que lo esquiva de un salto.`, tone: 'good' } });
      return { hit: false, toPet: false, toAlly: true };
    }
    let raw = rollEnemyDamage(enemy, { mult: opts.mult || 1 });
    if (r.crit) raw *= 2;
    const dmg = mitigate(raw, opts.pierce ? 0 : a.armor, r.crit);
    a.hp = Math.max(0, a.hp - dmg);
    addLog(c, 'enemy', { ...base, text: `${enemy.displayName} hiere a ${a.name}`, damageDice: enemy.damage, rawDmg: raw, targetArmor: a.armor, dmg, hpAfter: a.hp, hpMax: a.maxHp, result: r.crit ? 'crit' : 'hit', say: { text: `${capE} ${r.crit ? 'destroza' : 'hiere'} a ${lowerFirst(a.name)}: ${dmg} de daño.`, tone: 'bad' } });
    if (a.hp <= 0) addLog(c, 'system', { text: `${a.name} cayó.`, fx: { kind: 'death', target: allyKey(a) }, say: { text: `${a.name} cae y se deshace en sombras.`, tone: 'bad' } });
    return { hit: true, crit: r.crit, dmg, toPet: false, toAlly: true };
  }


  Object.assign(C, { othersStanding, leaveFight, everyoneFlees, canFlee, playerFlee, keepTurnAfterItem, afterPlayerAction, petKnockedOut, petTarget, executePetAction, rollPetDamage, petStrike, allyKey, allyOwnerKey, alliesOf, summonAlly, executeAllyAction, lowerFirst, allyStrike, strikeAlly, ALLY_TARGET_CHANCE });
})(window.Aventurs);
