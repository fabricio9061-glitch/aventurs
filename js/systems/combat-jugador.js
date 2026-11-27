/* ============================================================
   Aventurs — Pelea (4/8): lo que hace el jugador: atacar, técnicas, disciplinas y hechizos
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
  function heroesOf(...a) { return C.heroesOf(...a); }
  function allyTarget(...a) { return C.allyTarget(...a); }
  function healAlly(...a) { return C.healAlly(...a); }
  function petBackInFight(...a) { return C.petBackInFight(...a); }
  function fxKey(...a) { return C.fxKey(...a); }
  function spellElement(...a) { return C.spellElement(...a); }
  function isPlayerTurn(...a) { return C.isPlayerTurn(...a); }
  function playerStats(...a) { return C.playerStats(...a); }
  function enemyStats(...a) { return C.enemyStats(...a); }
  function rollPlayerDamage(...a) { return C.rollPlayerDamage(...a); }
  function attackRoll(...a) { return C.attackRoll(...a); }
  function playerRollOpts(...a) { return C.playerRollOpts(...a); }
  function shieldPlayer(...a) { return C.shieldPlayer(...a); }
  function announceGuard(...a) { return C.announceGuard(...a); }
  function pickOne(...a) { return C.pickOne(...a); }
  function mitigate(...a) { return C.mitigate(...a); }
  function applyStatus(...a) { return C.applyStatus(...a); }
  function removeStatus(...a) { return C.removeStatus(...a); }
  function inflict(...a) { return C.inflict(...a); }
  function weaponBane(...a) { return C.weaponBane(...a); }
  function weaponSpecials(...a) { return C.weaponSpecials(...a); }
  function maybeInflictStatusOnHit(...a) { return C.maybeInflictStatusOnHit(...a); }
  function checkEnd(...a) { return C.checkEnd(...a); }
  function enemyDown(...a) { return C.enemyDown(...a); }
  function getTarget(...a) { return C.getTarget(...a); }
  function hittableEnemies(...a) { return C.hittableEnemies(...a); }
  function SC(...a) { return C.SC(...a); }
  function addBuffTo(...a) { return A.ItemFx.addBuffTo(...a); } // v3.22.4
  function personalMark(...a) { return C.personalMark(...a); }
  function placePersonalMark(...a) { return C.placePersonalMark(...a); }
  function arcaneEcho(...a) { return C.arcaneEcho(...a); }
  function schoolOnHit(...a) { return C.schoolOnHit(...a); }
  function isSchoolCast(...a) { return C.isSchoolCast(...a); }
  function schoolBuff(...a) { return C.schoolBuff(...a); }
  function schoolCast(...a) { return C.schoolCast(...a); }
  function orbitalStrike(...a) { return C.orbitalStrike(...a); }
  function stunTarget(...a) { return C.stunTarget(...a); }
  function itemCtx(...a) { return C.itemCtx(...a); }
  function afterPlayerAction(...a) { return C.afterPlayerAction(...a); }
  function petKnockedOut(...a) { return C.petKnockedOut(...a); }
  function allyKey(...a) { return C.allyKey(...a); }
  function summonAlly(...a) { return C.summonAlly(...a); }
  function addLog(...a) { return C.addLog(...a); }

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
  // ---------- v3.10: técnicas de nacimiento de los guerreros (una vez por pelea) ----------
  function techniqueInfo() {
    const c = State().combat;
    const p = State().player;
    const t = A.Techniques ? A.Techniques.info(p) : null;
    if (!t) return null;
    return { ...t, used: A.Techniques.used(c, p) };
  }
  function playerTechnique(techId) {
    const c = State().combat;
    if (!c || c.result || !isPlayerTurn(c)) return;
    const p = State().player;
    // v3.13: las técnicas de disciplina (niveles 5 y 9) van por otro lado
    const D = techId && A.Techniques && A.Techniques.get ? A.Techniques.get(techId) : null;
    if (D) { playerDiscipline(c, p, D); return; }
    const T = A.Techniques ? A.Techniques.of(p) : null;
    if (!T || A.Techniques.used(c, p)) return;
    A.Techniques.markUsed(c, p);
    const b = A.Techniques.band(p);
    addLog(c, 'player', { text: `${T.name}.`, fx: { kind: 'buff', target: 'player', label: T.name, icon: T.icon }, say: { text: T.say, tone: 'crit' } });
    if (T.buff) {
      const mods = T.buff(b);
      addBuffTo(p, { source: T.id, name: T.name, mods, turns: T.turns || 2 }); // v3.22.4: se acumula
      // en grupo, a tus compañeros también
      if (T.allies && c.party) {
        for (const h of heroesOf(c)) {
          if (h === p || h.hp <= 0) continue;
          addBuffTo(h, { source: `${T.id}:aliado`, name: T.name, mods: { ...T.allies }, turns: T.turns || 2 });
        }
      }
      // v3.11 (dossier): el Aullido de manada además llama a un lobo que pelea a tu lado unas rondas
      if (T.wolf) {
        const W = T.wolf;
        const lv = Math.max(1, p.level || 1);
        const wolf = summonAlly(c, p, { kind: 'wolf', species: 'lobo', name: 'Lobo de la manada', hp: W.hp[b], damage: W.dmg[b], attack: W.prec + Math.floor(lv / 3), defense: W.def + Math.floor(lv / 2), attacks: W.attacks[b], speed: 12 });
        addLog(c, 'system', { text: `La manada responde: llega un lobo (${wolf.hp} de vida, ${wolf.damage}, ${wolf.attacksLeft} ataques).`, fx: { kind: 'summon', actor: allyKey(wolf) }, say: { text: `La manada responde al aullido: un lobo sale de entre las sombras y se pone a tu lado. Va a atacar ${wolf.attacksLeft} veces, desde la próxima ronda.`, tone: 'good' } });
      }
      // no gasta el ataque: el guerrero pega igual en este turno
      if (T.free) {
        const target = getTarget();
        if (target) playerStrike(c, p, target, {});
      }
    } else if (T.area) {
      const dice = T.area.dice(b);
      for (const e of hittableEnemies()) {
        const dmg = Math.max(1, A.Utils.rollDice(dice));
        e.hp = Math.max(0, e.hp - dmg);
        addLog(c, 'player', { text: `${T.name}: ${e.displayName} recibe ${dmg} de daño.`, target: e.displayName, dmg, hpAfter: e.hp, hpMax: e.maxHp, result: 'hit', fx: { kind: 'spell', actor: 'player', target: fxKey(e), element: 'shock' }, say: { text: `La descarga sacude a ${A.Skills ? A.Skills.noun(e) : e.displayName}: ${dmg} de daño.`, tone: 'good' } });
        if (e.hp <= 0) enemyDown(c, e, 'player');
        else if (T.area.status) inflict(c, e, T.area.status, { turns: T.area.turns || 2, source: T.id });
      }
    } else if (T.sweep) {
      const foes = hittableEnemies();
      const m = foes.length >= 2 ? T.sweep : (T.sweepSolo || 1);
      for (const e of foes) if (e.hp > 0) playerStrike(c, p, e, { mult: m });
    } else if (T.gore) {
      const target = getTarget();
      if (target) {
        const before = target.hp;
        playerStrike(c, p, target, { mult: T.gore.mult, prec: T.gore.prec, noCharge: true });
        if (target.hp > 0 && target.hp < before && T.gore.status) inflict(c, target, T.gore.status, { turns: T.gore.turns || 2, source: T.id });
      }
    }
    checkEnd();
    if (!c.result) afterPlayerAction();
  }

  // ---------- v3.13: disciplinas de los guerreros (dossier, sección 9) ----------
  /** Las técnicas de disciplina que sabés, con su espera (para la pantalla y la IA). */
  function disciplineInfo() {
    const c = State().combat;
    const p = State().player;
    if (!A.Techniques || !A.Techniques.known || !p) return [];
    return A.Techniques.known(p).map((t) => A.Techniques.discInfo(c, p, t));
  }
  /** No gastan maná: ocupan tu ataque del turno y quedan en espera (nunca se suman al Golpe fuerte). */
  function playerDiscipline(c, p, T) {
    if (!(p.techniques || []).includes(T.id) || T.race !== p.raceId) return;
    const wait = A.Techniques.waitOf(c, T.id);
    if (wait > 0) {
      addLog(c, 'system', { text: `${T.name} todavía no: ${wait === 1 ? 'lista en tu próximo turno' : `lista en ${wait} turnos`}.`, fx: { kind: 'note' } });
      return;
    }
    A.Techniques.setWait(c, T);
    const b = A.Techniques.band(p);
    addLog(c, 'player', { text: `${T.name}.`, fx: { kind: 'buff', target: 'player', label: T.name, icon: T.icon }, say: { text: T.say, tone: 'crit' } });
    const target = getTarget();
    const statusOn = (e, st) => { if (st && e.hp > 0 && Math.random() < (st.chance || 1)) inflict(c, e, st.type, { turns: st.turns || 1, value: st.value || 1, source: T.id }); };
    if (T.strike && target) {
      let mult = T.strike.mult || 1;
      const vs = T.strike.vsStatus;
      if (vs && (target.effects || []).some((e) => vs.types.includes(e.type))) mult = vs.mult;
      const r = playerStrike(c, p, target, { mult, prec: T.strike.prec || 0 });
      const hit = !!(r && r.hit);
      if (hit && target.hp > 0 && T.bleed) inflict(c, target, 'bleed', { turns: T.bleed.turns || 3, value: T.bleed.value(b), source: T.id });
      if (hit && target.hp > 0 && T.mark) {
        placePersonalMark(c, p, target, { prec: T.mark.prec, turns: T.mark.turns, label: 'presa' });
        addLog(c, 'system', { text: `${target.displayName} es tu presa: le pegás con +${T.mark.prec} de precisión (${T.mark.turns} rondas).`, fx: { kind: 'status', target: fxKey(target), effect: 'bleed' } });
      }
      if (T.cleave) {
        const other = hittableEnemies().find((e) => e !== target && e.hp > 0);
        if (other) playerStrike(c, p, other, { mult: T.cleave.mult });
      }
      if (T.splash) { // a los demás (no a tu blanco)
        for (const e of hittableEnemies()) {
          if (e === target || e.hp <= 0) continue;
          const r2 = playerStrike(c, p, e, { mult: T.splash.mult || 0.5 });
          if (r2 && r2.hit) statusOn(e, T.splash.status);
        }
      }
      if (hit && target.hp > 0 && T.strike.status) statusOn(target, T.strike.status);
      if (T.chase && target.hp <= 0) {
        const foes = hittableEnemies();
        if (foes.length) {
          const next = pickOne(foes);
          addLog(c, 'system', { text: `Saltás sobre ${next.displayName}.`, fx: { kind: 'note' }, say: { text: `Tu presa cae y ya estás saltando sobre ${A.Skills ? A.Skills.noun(next) : next.displayName}.`, tone: 'crit' } });
          const r2 = playerStrike(c, p, next, { mult: T.chase.mult });
          if (r2 && r2.hit && next.hp > 0 && T.bleed) inflict(c, next, 'bleed', { turns: T.bleed.turns || 3, value: T.bleed.value(b), source: T.id });
        }
      }
    }
    if (T.double) {
      for (let i = 0; i < (T.double.n || 2) && !c.result; i++) {
        const t = getTarget();
        if (!t) break;
        playerStrike(c, p, t, { mult: T.double.mult || 1 });
      }
    }
    if (T.sweep) {
      for (const e of hittableEnemies()) {
        if (e.hp <= 0) continue;
        const r = playerStrike(c, p, e, { mult: T.sweep.mult || 1 });
        if (r && r.hit) statusOn(e, T.sweep.status);
      }
    }
    if (T.random) {
      for (let i = 0; i < (T.random.hits || 2) && !c.result; i++) {
        const foes = hittableEnemies();
        if (!foes.length) break;
        const e = pickOne(foes);
        const r = playerStrike(c, p, e, { mult: T.random.mult || 1 });
        if (r && r.hit) statusOn(e, T.random.status);
      }
    }
    if (T.foes) {
      const v = T.foes.value(b);
      const hit = hittableEnemies().filter((e) => e.hp > 0 && applyStatus(e, T.foes.status, { turns: T.foes.turns || 2, value: v, source: T.id }));
      if (hit.length) addLog(c, 'system', { text: `${hit.length === 1 ? hit[0].displayName : 'Tus enemigos'} ${hit.length === 1 ? 'queda' : 'quedan'} desequilibrado${hit.length === 1 ? '' : 's'} (−${v} de precisión en su próximo ataque).`, fx: { kind: 'note' } });
    }
    if (T.buff && p.hp > 0) {
      const mods = T.buff.mods(b);
      const buff = addBuffTo(p, { source: T.id, name: T.name, stat: Object.keys(mods)[0] || (T.buff.touch ? 'reflect' : 'armor'), mods, turns: T.buff.turns || 2, school: true });
      if (T.buff.touch) buff.touch = { status: T.buff.touch.status, chance: T.buff.touch.chance || 0, turns: T.buff.touch.turns || 2, value: 1, zap: T.buff.touch.zap ? T.buff.touch.zap(b) : 0 };
      if (T.buff.allies && c.party) {
        for (const h of heroesOf(c)) {
          if (h === p || h.hp <= 0) continue;
          addBuffTo(h, { source: `${T.id}:aliado`, name: T.name, stat: Object.keys(T.buff.allies)[0], mods: { ...T.buff.allies }, turns: T.buff.turns || 2 });
        }
      }
    }
    checkEnd();
    if (!c.result) afterPlayerAction();
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
    // v3.9: la marca de tu Dardo arcano (solo la tuya) afina la puntería desde el nivel 9
    const mark = P() && P().markOf ? P().markOf(c, p, target) : null;
    // v3.11: Embestida arrolladora: el primer ataque a cada criatura apunta mejor
    const rushP = P() && P().rushPrec ? P().rushPrec(c, p, target) : 0;
    // v3.13: los sellos y marcas de escuela que son tuyos (Sello de duelo, Rastro de presa)
    const pmark = personalMark(c, p, target);
    const r = attackRoll(st.attack + (mark ? mark.prec : 0) + (opts.prec || 0) + rushP + (pmark ? pmark.prec : 0), es.defense, playerRollOpts(p));
    const weaponName = st.weapon ? st.weapon.name : 'puños';
    if (r.lucky) addLog(c, 'system', { text: 'Suerte: sacaste un 1 y el dado se vuelve a tirar.', fx: { kind: 'passive', passive: 'suerte' } });
    // v2.5: Escurridizo (el primero) y Etéreo (1 de cada 4) hacen fallar un golpe que pegaba.
    // El golpe fuerte del guerrero no se esquiva con esos trucos (ni lo frena un caparazón).
    // (v3.11: la Embestida del minotauro ya no hace que el primer ataque no falle: ver rushBonus)
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
      if (dodge) { miss.text = `${target.displayName} evita el golpe (${A.Skills.get(dodge.skill).name}).`; miss.say = { text: dodge.say, tone: 'neutral' }; miss.dodgeSkill = dodge.skill; }
      addLog(c, 'player', miss);
      return r;
    }
    const dmgRoll = rollPlayerDamage(p);
    let rawDmg = dmgRoll.total;
    // v3.3: Cazador de sombras (elfo oscuro): más daño a lo que ya tiene algo malo encima
    const shadow = P() && P().shadowBonusVs ? P().shadowBonusVs(p, target) : 0;
    rawDmg += shadow;
    if (pw) rawDmg *= pw.mult;
    if (opts.mult) rawDmg = Math.max(1, Math.round(rawDmg * opts.mult)); // v3.10: técnicas (barrido, cornada)
    if (r.crit) rawDmg = Math.round(rawDmg * (P() ? P().critMult(p) : 2));
    // v3.9: después del crítico (no se duplican): Frenesí vampírico, forma bestial y la marca del Dardo arcano
    const frenzy = P() && P().frenzyDamage ? P().frenzyDamage(c, p) : 0;
    const beast = P() && P().beastDamage ? P().beastDamage(c, p) : 0;
    const markDmg = mark ? mark.bonus : 0;
    // v3.11 (dossier): también después del crítico: Golpe de gigante (nv 9), Instinto salvaje (uno por turno),
    // Embestida arrolladora (el primero a cada criatura) y la descarga del Núcleo de sobrecarga (cada 2 aciertos)
    const giant = r.crit && P() && P().afterCrit ? P().afterCrit(p) : 0;
    const instinct = !opts.counter && P() && P().instinctBonus ? P().instinctBonus(c, p) : null;
    const rush = P() && P().rushBonus ? P().rushBonus(c, p, target) : 0;
    const core = P() && P().coreHit ? P().coreHit(c, p) : null;
    const extras = [];
    if (frenzy) extras.push({ label: 'Frenesí', n: frenzy });
    if (beast) extras.push({ label: 'bestia', n: beast });
    if (markDmg) extras.push({ label: 'marca', n: markDmg });
    if (giant) extras.push({ label: 'gigante', n: giant });
    if (instinct) extras.push({ label: 'instinto', n: instinct.n });
    if (rush) extras.push({ label: 'embestida', n: rush });
    if (core) extras.push({ label: 'descarga', n: core.main });
    // v3.12: armas legendarias que pegan más contra ciertas criaturas (Crematoria contra no muertos y demonios)
    const wbane = weaponBane(st.weapon, target);
    if (wbane) extras.push({ label: st.weapon.bane.label || 'arma', n: wbane });
    const sealDmg = pmark ? pmark.dmg || 0 : 0; // v3.13
    if (sealDmg) extras.push({ label: pmark.label || 'sello', n: sealDmg });
    rawDmg += frenzy + beast + markDmg + giant + (instinct ? instinct.n : 0) + rush + (core ? core.main : 0) + wbane + sealDmg;
    let finalDmg = mitigate(rawDmg, es.armor, r.crit);
    // v2.5: Caparazón / Gelatinoso: el primer golpe hace la mitad (el golpe fuerte lo rompe)
    const soft = A.Skills && !pw ? A.Skills.softenHit(target, finalDmg) : { dmg: finalDmg, skill: null };
    finalDmg = soft.dmg;
    target.hp = Math.max(0, target.hp - finalDmg);
    if (mark) P().consumeMark(target);
    let passive = null;
    if (r.crit && P() && P().has(p, 'golpe_gigante')) passive = 'golpe_gigante';
    else if (r.crit && r.roll < 20 && P() && P().has(p, 'ojo_certero')) passive = 'ojo_certero';
    else if (core) passive = 'cuerpo_metal';
    else if (rush) passive = 'embestida';
    else if (instinct && instinct.angry) passive = 'furia';
    else if (shadow) passive = 'cazador_sombras';
    else if (frenzy) passive = 'colmillos';
    else if (beast) passive = 'sangre_lobo';
    addLog(c, 'player', {
      passive,
      extras: extras.length ? extras : undefined,
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
    // v3.14: también Sed insaciable y Señor de la noche (vampiro)
    const lsAcc = A.Accessories ? A.Accessories.bonus(p, 'lifesteal') : 0;
    const lsBuff = A.ItemFx ? (A.ItemFx.buffMods(p).lifesteal || 0) : 0;
    const ls = lsAcc + lsBuff;
    if (ls > 0 && finalDmg > 0 && p.hp > 0 && p.hp < p.maxHp) {
      const before = p.hp;
      A.State.healHp(Math.max(1, Math.round(finalDmg * ls)));
      if (p.hp > before) addLog(c, 'system', { text: `Robo de vida: +${p.hp - before}.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: p.hp - before }, say: { text: lsBuff > lsAcc ? `Tu sed bebe de la herida: recuperás ${p.hp - before} de vida.` : `Tu amuleto bebe de la herida: recuperás ${p.hp - before} de vida.`, tone: 'good' } });
    }
    // v3.11: la descarga del Núcleo de sobrecarga salta a otra criatura (desde el nivel 5)
    if (core) {
      const others = hittableEnemies().filter((e) => e !== target);
      const arcTo = core.arc > 0 && others.length ? others[Math.floor(Math.random() * others.length)] : null;
      addLog(c, 'system', {
        text: `¡Sobrecarga! +${core.main} de daño${arcTo ? ` y ${core.arc} a ${arcTo.displayName}` : ''}.`,
        passive: 'cuerpo_metal',
        fx: { kind: 'buff', target: 'player', label: `¡Sobrecarga! +${core.main}`, icon: 'spark' },
        say: { text: `Tu núcleo se sobrecarga y el golpe suelta una descarga: +${core.main} de daño${arcTo ? `, y un arco eléctrico le salta a ${A.Skills ? A.Skills.noun(arcTo) : arcTo.displayName} (${core.arc})` : ''}.`, tone: 'good' },
      });
      if (arcTo) {
        arcTo.hp = Math.max(0, arcTo.hp - core.arc);
        addLog(c, 'player', { text: `La descarga alcanza a ${arcTo.displayName}: ${core.arc} de daño.`, target: arcTo.displayName, dmg: core.arc, hpAfter: arcTo.hp, hpMax: arcTo.maxHp, result: 'hit', fx: { kind: 'spell', actor: 'player', target: fxKey(arcTo), element: 'shock', chain: true }, say: { text: '', tone: 'good' } });
        if (arcTo.hp <= 0) enemyDown(c, arcTo, 'player');
      }
    }
    // v3.11: Embestida arrolladora: el golpe desequilibra (menos precisión en su próximo ataque; no se suma)
    const stagger = target.hp > 0 && finalDmg >= 0 && P() && P().rushStagger ? P().rushStagger(p) : 0;
    if (stagger > 0) applyStatus(target, 'stagger', { turns: 2, value: stagger, source: 'embestida' });
    if (rush) addLog(c, 'system', { text: `¡Embestida! +${rush} de daño.`, passive: 'embestida', fx: { kind: 'buff', target: 'player', label: `¡Embestida! +${rush}`, icon: 'fist' }, say: { text: `Entrás con los cuernos por delante: la primera embestida contra ${A.Skills ? A.Skills.noun(target) : target.displayName} pega +${rush}${target.hp > 0 ? ' y la deja desequilibrada' : ''}.`, tone: 'good' } });
    if (instinct && instinct.angry) addLog(c, 'system', { text: `Instinto salvaje: +${instinct.n} de daño.`, passive: 'furia', fx: { kind: 'buff', target: 'player', label: `Instinto +${instinct.n}`, icon: 'fist' }, say: { text: `Te hirieron y el instinto salvaje te enciende: ese golpe pega +${instinct.n}.`, tone: 'good' } });
    // v3.9: la marca del Dardo arcano se gasta con este golpe
    if (markDmg > 0) addLog(c, 'system', { text: `Marca arcana: +${markDmg} de daño.`, fx: { kind: 'buff', target: 'player', label: `Marca +${markDmg}`, icon: 'arcane' }, say: { text: `La marca arcana que dejó tu dardo estalla con el golpe: +${markDmg} de daño.`, tone: 'good' } });
    // v3.0 / v3.9: Sed de sangre (vampiro): parte del daño vuelve como vida (más en Frenesí)
    const bite = P() && P().lifestealFrom ? P().lifestealFrom(p, finalDmg, c) : 0;
    if (bite > 0 && p.hp < p.maxHp) {
      const before = p.hp;
      A.State.healHp(bite);
      if (p.hp > before) addLog(c, 'system', { text: `Sed de sangre: +${p.hp - before} de vida.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: p.hp - before, passive: 'colmillos' }, say: { text: `Probás su sangre: recuperás ${p.hp - before} de vida.`, tone: 'good' } });
    }
    // v3.9: cada golpe con arma que hace daño junta una gota de sangre (con tres, Frenesí)
    if (finalDmg > 0 && P() && P().bloodCharge) {
      const bc = P().bloodCharge(c, p);
      if (bc && bc.ready) addLog(c, 'system', { text: 'Tres gotas de sangre: Frenesí en tu próximo turno.', fx: { kind: 'note' }, say: { text: 'Tres gotas de sangre. En tu próximo turno, el Frenesí.', tone: 'good' } });
    }
    if (target.hp > 0 && finalDmg > 0) maybeInflictStatusOnHit(st.weapon, target, c); // v3.9: si la armadura lo paró, no
    if (finalDmg > 0) weaponSpecials(c, p, st.weapon, target, finalDmg); // v3.12: armas legendarias
    if (target.hp > 0) arcaneEcho(c, p, target); // v3.13: Resonancia arcana (humano)
    // Sangre de dragón: a veces el golpe prende fuego
    if (target.hp > 0 && P() && Math.random() < P().burnChance(p)) {
      if (applyStatus(target, 'fire', { turns: 2, value: P().burnValue(p), source: 'sangre_dragon' })) {
        addLog(c, 'system', { text: `${target.displayName} se prende fuego.`, fx: { kind: 'status', target: fxKey(target), effect: 'fire', passive: 'sangre_dragon' } });
      }
    }
    // v3.3: Cazador de sombras (elfo oscuro): a veces el golpe envenena (y después pega más fuerte)
    if (target.hp > 0 && P() && P().shadowPoison && Math.random() < P().shadowPoison(p)) {
      if (applyStatus(target, 'poison', { turns: 3, value: P().shadowPoisonDmg ? P().shadowPoisonDmg(p) : 1, source: 'cazador_sombras' })) {
        addLog(c, 'system', { text: `El veneno de tu hoja entra en ${target.displayName}.`, fx: { kind: 'status', target: fxKey(target), effect: 'poison', passive: 'cazador_sombras' } });
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
    if (!re.burn && !re.chill && !re.thorns && !re.dread) return;
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
    // v3.8: Horror del abismo: tocarlo de cerca da miedo
    if (re.dread && Math.random() < re.dread) {
      inflict(c, victim, 'fear', { turns: 2, value: 1, source: target.id, say: { text: who === 'pet' ? `${A.Skills.noun(victim).replace(/^./, (ch) => ch.toUpperCase())} mira a ${n} de cerca y se encoge de miedo.` : `Al golpearlo ves de cerca a ${n} y un miedo antiguo te paraliza las manos.`, tone: 'bad' } });
    }
    if (re.thorns > 0) {
      if (who === 'pet') {
        victim.health = Math.max(0, victim.health - re.thorns);
        addLog(c, 'system', { text: `${victim.name} se lastima con las espinas (-${re.thorns}).`, fx: { kind: 'tick', target: 'pet', amount: re.thorns, effect: 'bleed', skill: 'espinas', skillOn: fxKey(target) }, say: { text: `${A.Skills.noun(victim).replace(/^./, (ch) => ch.toUpperCase())} se lastima con las espinas de ${n}: ${re.thorns} de daño.`, tone: 'bad' } });
        if (victim.health <= 0) petKnockedOut(c, victim);
      } else {
        const ab = shieldPlayer(c, p, re.thorns, { tick: true });
        A.State.damagePlayer(ab.dmg);
        addLog(c, 'system', { text: `Espinas: -${ab.dmg} de vida.`, fx: { kind: 'tick', target: 'player', amount: ab.dmg, effect: 'bleed', skill: 'espinas', skillOn: fxKey(target) }, say: { text: `Te lastimás con las espinas de ${n}: ${ab.dmg} de daño.`, tone: 'bad' } });
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

  /** v3.3: cuántos turnos te faltan para volver a usar un hechizo (0 = listo). */
  function spellWait(c, spell) {
    return c && c.spellCd && spell ? (c.spellCd[spell.id] || 0) : 0;
  }
  /** v3.3: para la pantalla: { wait, ready, hit (0..1 contra tu objetivo), sure } */
  function spellInfo(spellId) {
    const c = State().combat;
    const spell = A.Data.getById('spells', spellId);
    if (!spell) return null;
    let wait = spellWait(c, spell);
    // v3.13: un hechizo rápido por turno
    const quickUsed = !!(spell.quick && c && c.quickTurn && c.quickTurn === c.turnStartedFor);
    if (quickUsed && !wait) return { wait: 0, ready: false, hit: 1, sure: true, quickUsed: true };
    let hit = 1;
    if (spell.damage && !spell.sure) {
      const t = getTarget();
      const def = t ? enemyStats(t).defense : 10;
      hit = B().hitChance(playerStats().attack + (B().SPELL_HIT || 2), def);
    }
    return { wait, ready: wait === 0, hit, sure: !!spell.sure || !spell.damage };
  }

  function playerSpell(spellId, on) {
    const c = State().combat;
    if (!c || c.result || !isPlayerTurn(c)) return;
    const p = State().player;
    if (!p.hasMagic) return;
    const spell = A.Data.getById('spells', spellId);
    if (!spell || !(p.spells || []).includes(spellId)) return;
    // v3.4: el mago necesita su arma de mago (bastón, varita...) puesta para lanzar
    const cast = B().canCast ? B().canCast(p) : { ok: true };
    if (!cast.ok) { addLog(c, 'system', { text: cast.why, fx: { kind: 'note' } }); return; }
    // v3.2: la curación se le puede tirar a tu mascota o a un compañero
    // v3.3: Segundo aliento (selfOnly) solo te cura a vos
    const ally = spell.heal ? allyTarget(spell.selfOnly ? 'self' : on) : null;
    if (spell.heal) {
      if (!ally) return;
      const isPet = ally.kind === 'pet';
      const full = isPet ? ally.ref.health >= ally.ref.maxHealth : ally.ref.hp >= ally.ref.maxHp;
      if (full) {
        addLog(c, 'system', { text: ally.self ? 'Ya tenés la vida completa.' : `${ally.name} ya tiene la vida completa.`, fx: { kind: 'note' } });
        return;
      }
      // v3.3: al caído ya no lo levanta la curación: hace falta una hierba de la vida
      const down = isPet ? (ally.ref.health || 0) <= 0 : (ally.ref.hp || 0) <= 0;
      if (down) {
        addLog(c, 'system', { text: `${ally.name} está ${isPet ? 'inconsciente' : 'caído'}: para levantarlo hace falta una hierba de la vida.`, fx: { kind: 'note' } });
        return;
      }
    }
    if ((p.effects || []).some((e) => e.type === 'silence')) {
      addLog(c, 'system', { text: 'Estás silenciado: no podés lanzar hechizos.', fx: { kind: 'note' } });
      return;
    }
    // v3.13: los hechizos rápidos de escuela no gastan el turno, pero uno solo por turno
    if (spell.quick && c.quickTurn && c.quickTurn === c.turnStartedFor) {
      addLog(c, 'system', { text: 'Ya usaste un hechizo rápido en este turno: ahora atacá o lanzá otro hechizo.', fx: { kind: 'note' } });
      return;
    }
    // v3.3: los hechizos con espera
    const wait = spellWait(c, spell);
    if (wait > 0) {
      addLog(c, 'system', { text: `${spell.name} todavía no: ${wait === 1 ? 'listo en tu próximo turno' : `listo en ${wait} turnos`}.`, fx: { kind: 'note' } });
      return;
    }
    const cost = P() ? P().spellCost(p, spell, c) : spell.manaCost;
    if (p.mana < cost) {
      addLog(c, 'system', { text: `No te alcanza el maná para ${spell.name}.`, fx: { kind: 'note' } });
      return;
    }
    A.State.setMana(p.mana - cost);
    // v3.11: Ingenio (gnomo): el descuento extra de los primeros hechizos caros de la pelea
    if (P() && P().ingenioUse && P().ingenioUse(c, p, spell)) addLog(c, 'system', { text: `Ingenio: ${spell.name} te costó ${cost} de maná.`, passive: 'ingenio', fx: { kind: 'note' }, say: { text: `Tu ingenio encuentra un atajo: ${spell.name.toLowerCase()} te cuesta ${cost} de maná.`, tone: 'good' } });
    if (spell.cooldown > 0) { if (!c.spellCd) c.spellCd = {}; c.spellCd[spell.id] = spell.cooldown; }
    // v3.11: la Llama interior ya no va en el poder (se suma después del crítico, por blanco)
    const power = playerStats().spellPower;
    const flame = spell.damage && P() && P().spellBonus ? P().spellBonus(p, spell) : 0;

    if (spell.heal) {
      // v2.1: la curación suma solo la mitad del poder mágico (si no, con maná que vuelve solo sería vida infinita)
      // v3.14: las curaciones de nacimiento (ángel y dríade) crecen por tramo de nivel
      let heal = A.Utils.rollDice(spell.bandHeal && SC() ? SC().val(spell.bandHeal, SC().band(p)) : spell.heal) + Math.floor(power / 2);
      // v3.9: Segundo aliento cura más cuanto más herido estás (se suma una parte de lo que te falta)
      if (spell.healMissing && (!ally || ally.self)) heal += Math.round(Math.max(0, p.maxHp - p.hp) * spell.healMissing);
      const boost = A.Accessories ? A.Accessories.bonus(p, 'heal') : 0; // v2.4: Cruz sagrada
      if (boost > 0) heal = Math.round(heal * (1 + boost));
      // v3.9: Curación también limpia (veneno, sangrado, fuego, frío, maldición)
      let cleansed = [];
      if (spell.cleanse) {
        const who = ally && !ally.self ? ally.ref : p;
        const BAD = ['poison', 'bleed', 'fire', 'cold', 'curse'];
        cleansed = (who.effects || []).filter((e) => BAD.includes(e.type)).map((e) => e.type);
        if (cleansed.length) who.effects = (who.effects || []).filter((e) => !BAD.includes(e.type));
      }
      const cleanTxt = cleansed.length ? ` y le saca ${[...new Set(cleansed)].map((t) => (A.Combat && A.Combat.effectLabel ? A.Combat.effectLabel(t) : t).toLowerCase()).join(' y ')}` : '';
      if (ally && !ally.self) {
        const r = healAlly(ally, heal);
        if (ally.kind === 'pet' && r.revived) petBackInFight(c, ally.owner);
        const who = ally.ownerName ? `${ally.name} (de ${ally.ownerName})` : ally.name;
        addLog(c, 'player', {
          text: `Lanzaste ${spell.name} sobre ${who}: +${r.hp} de vida${r.revived ? ' (se levanta)' : ''}.`,
          fx: { kind: 'heal', actor: 'player', target: ally.key, amount: r.hp },
          say: { text: r.revived ? `Lanzás ${spell.name.toLowerCase()} sobre ${who} y se levanta con ${r.hp} de vida.` : `Lanzás ${spell.name.toLowerCase()} sobre ${who}: recupera ${r.hp} de vida${cleanTxt}.`, tone: 'good' },
        });
      } else {
        const before = p.hp;
        A.State.healHp(heal);
        addLog(c, 'player', { text: `Lanzaste ${spell.name} y recuperaste ${p.hp - before} de salud.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: p.hp - before, icon: '' }, ...(cleanTxt ? { say: { text: `Lanzás ${spell.name.toLowerCase()}: recuperás ${p.hp - before} de vida${cleanTxt.replace(' y le saca', ' y te saca')}.`, tone: 'good' } } : {}) });
      }
      // v3.14: Bálsamo de savia: además cura un poco por turno (al héroe que curaste)
      if (spell.hot && SC()) {
        const who = ally && !ally.self ? (ally.kind === 'hero' || (!ally.kind && ally.ref && ally.ref.maxHp) ? ally.ref : null) : p;
        if (who && who.hp > 0) {
          const regen = SC().val(spell.hot.regen, SC().band(p));
          schoolBuff(who, Object.assign({}, spell, { id: `${spell.id}:vida` }), { turns: spell.hot.turns || 2, stat: 'regen', mods: { regen } }, SC().band(p));
          addLog(c, 'system', { text: `${spell.name}: +${regen} de vida por turno (${spell.hot.turns || 2} turnos).`, fx: { kind: 'note' } });
        }
      }
    } else if (spell.damage) {
      let targets = spell.area ? hittableEnemies() : [getTarget()].filter(Boolean);
      // v3.13: los de cadena (Tormenta conductora) empiezan por tu blanco
      if (spell.area && spell.chain) { const mt = getTarget(); if (mt) targets = [mt].concat(targets.filter((e) => e !== mt)); }
      const dice = SC() ? SC().diceOf(spell, p) : spell.damage; // v3.13: los de escuela crecen por tramo de nivel
      const chainDice = SC() && spell.chain ? SC().chainOf(spell, p) : null;
      let refunded = false;
      // v3.3: los hechizos de daño tiran el dado como un arma (con +2): pueden fallar y,
      // con 20, son críticos. Los de área tiran una vez: se compara con la defensa de cada una.
      // v3.9: todos los hechizos de daño tiran el dado (también el Dardo arcano, que antes no fallaba)
      const bonus = playerStats().attack + (B().SPELL_HIT || 2);
      const r = spell.sure ? null : attackRoll(bonus, 0, playerRollOpts(p));
      if (r && r.lucky) addLog(c, 'system', { text: 'Suerte: sacaste un 1 y el dado se vuelve a tirar.', fx: { kind: 'passive', passive: 'suerte' } });
      // v3.14: Moneda al aire (mediano): a veces pega el doble (se tira una vez por hechizo)
      const luckyHit = !!(spell.lucky && Math.random() < (spell.lucky.chance || 0.5));
      if (spell.lucky) addLog(c, 'system', { text: luckyHit ? `¡Salió cara! ${spell.name} pega el doble.` : 'Salió ceca: pega normal.', fx: { kind: 'note' }, say: { text: luckyHit ? 'La moneda gira en el aire y cae de cara: ¡doble!' : 'La moneda cae de ceca. Igual pega.', tone: luckyHit ? 'crit' : 'neutral' } });
      let landed = 0;
      let drained = 0;
      targets.forEach((t, i) => {
        const def = enemyStats(t).defense;
        // v3.11: el 20 llega siempre; el crítico de 19 (elfo, anillo) solo si llega a la defensa de esta criatura
        const hit = !r || r.roll === 20 || (!r.fumble && r.total >= def);
        const tcrit = !!(r && r.crit && hit);
        const roll = r && i === 0 ? { roll: r.roll, bonus, total: r.total, vs: def, vsLabel: 'defensa' } : {};
        const noun = A.Skills ? A.Skills.noun(t) : t.displayName;
        if (!hit) {
          addLog(c, 'player', {
            text: r.fumble ? `${spell.name} se te escapa de las manos y no le da a nadie` : `${spell.name} no alcanza a ${t.displayName}`,
            actor: p.name, target: t.displayName, actorIcon: '', spell: spell.name,
            ...roll, result: r.fumble ? 'fumble' : 'evaded',
            fx: { kind: 'spell', actor: 'player', target: fxKey(t), element: spellElement(spell), icon: '', miss: true, chain: i > 0 },
            spellId: spell.id,
            say: {
              text: r.fumble ? `Se te traba la palabra: ${spell.name.toLowerCase()} se deshace en el aire.` : `Lanzás ${spell.name.toLowerCase()}, pero ${noun} se corre a tiempo.`,
              tone: 'bad',
            },
          });
          return;
        }
        landed += 1;
        // v3.13: lo que tenía antes del golpe (para hacer explotar la quemadura o devolver maná)
        const hadDet = !!(spell.detonate && (t.effects || []).some((e) => e.type === spell.detonate.status));
        const hadRefund = !!(spell.refund && (t.effects || []).some((e) => e.type === spell.refund.status));
        const tDice = chainDice && i > 0 ? chainDice : dice;
        let rawDmg = A.Utils.rollDice(tDice) + power;
        // v3.3: Cazador de sombras también con hechizos
        const shadowS = P() && P().shadowBonusVs ? P().shadowBonusVs(p, t) : 0;
        rawDmg += shadowS;
        // v3.14: más daño contra lo que ya tiene un estado (Daga de sombra, Bobina de Tesla) o tu sello (Estocada sellada)
        const vsS = spell.vsStatus && (t.effects || []).some((e) => spell.vsStatus.types.includes(e.type));
        const vsM = spell.vsMarked && personalMark(c, p, t);
        const dmgMult = (vsS ? spell.vsStatus.mult || 1.5 : 1) * (vsM ? spell.vsMarked : 1) * (luckyHit ? spell.lucky.mult || 2 : 1);
        if (dmgMult !== 1) rawDmg = Math.max(1, Math.round(rawDmg * dmgMult));
        if (tcrit) rawDmg *= 2;
        rawDmg += flame; // v3.11: Llama interior, después del crítico
        // v3.13: Sello de cenizas: si ya se quemaba, la quemadura explota (daño de más) y se apaga
        const det = hadDet ? A.Utils.rollDice(SC().val(spell.detonate.dice, SC().band(p))) : 0;
        rawDmg += det;
        const armor = Math.floor((t.armor || 0) / 2);
        // v3.9: la magia siempre hace al menos 1 (la armadura para golpes, no hechizos)
        let finalDmg = mitigate(rawDmg, armor, true);
        // v3.12: los escudos (de fe, de fuerza, de monedas) también frenan los hechizos
        const shield = A.Skills && A.Skills.shieldAbsorb ? A.Skills.shieldAbsorb(t, finalDmg) : { dmg: finalDmg, skill: null };
        finalDmg = shield.dmg;
        t.hp = Math.max(0, t.hp - finalDmg);
        addLog(c, 'player', {
          text: tcrit ? `¡${spell.name} crítico a ${t.displayName}!` : `${spell.name} hiere a ${t.displayName}`,
          ...(shield.skill ? { softened: shield.skill } : {}),
          actor: p.name, target: t.displayName, actorIcon: '',
          rawDmg, targetArmor: armor, dmg: finalDmg, hpAfter: t.hp, hpMax: t.maxHp,
          damageDice: power ? `${tDice}+${power}` : tDice,
          extras: flame || det ? [flame ? { label: 'llama', n: flame } : null, det ? { label: 'explosión', n: det } : null].filter(Boolean) : undefined,
          spell: spell.name, ...roll, result: tcrit ? 'crit' : 'hit',
          fx: { kind: 'spell', actor: 'player', target: fxKey(t), element: spellElement(spell), icon: '', crit: tcrit, chain: i > 0 },
          spellId: spell.id,
          ...(shadowS ? { passive: 'cazador_sombras' } : {}),
          ...(tcrit ? { say: { text: `¡${spell.name} le da de lleno a ${noun}: el doble de daño, ${finalDmg}!`, tone: 'crit' } } : {}),
        });
        if (det) {
          removeStatus(t, spell.detonate.status);
          addLog(c, 'system', { text: `${spell.name}: la quemadura explota (+${det}).`, fx: { kind: 'note' }, say: { text: `La quemadura de ${noun} explota con la ceniza: ${det} de daño de más, y se apaga.`, tone: 'good' } });
        }
        if (t.hp > 0 && finalDmg > 0 && !det) maybeInflictStatusOnHit(spell, t, c);
        if (t.hp > 0) schoolOnHit(c, p, spell, t);
        if (hadRefund && !refunded && p.mana < p.maxMana) {
          refunded = true;
          const before = p.mana;
          A.State.setMana(Math.min(p.maxMana, p.mana + spell.refund.mana));
          if (p.mana > before) addLog(c, 'system', { text: `${spell.name}: recuperás ${p.mana - before} de maná.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: 0, mana: p.mana - before }, say: { text: `El circuito se cierra sobre ${noun}, que ya estaba electrizado: te vuelven ${p.mana - before} de maná.`, tone: 'good' } });
        }
        // v3.9: el Dardo arcano del humano marca al blanco (su próximo golpe con arma le hace más daño)
        if (t.hp > 0 && spell.id === 'dardo_arcano' && P() && P().has(p, 'determinacion') && P().placeMark) {
          const mk = P().placeMark(c, p, t);
          addLog(c, 'system', { text: `${t.displayName} queda marcado (+${mk.bonus} a tu próximo golpe con arma).`, fx: { kind: 'note' }, say: { text: `El dardo deja una marca arcana en ${noun}: tu próximo golpe con arma le hace +${mk.bonus}${mk.prec ? ' y apuntás mejor' : ''}.`, tone: 'good' } });
        }
        if (t.hp > 0 && spell.stun) stunTarget(c, t, spell.stun, spell); // v3.3: Congelar, Trueno
        else if (t.hp > 0 && spell.stunChance && !(spell.noBoss && t.category === 'boss') && Math.random() < spell.stunChance) stunTarget(c, t, 1, spell); // v3.3: Enredadera · v3.13: noBoss
        drained += finalDmg;
        if (t.hp <= 0) enemyDown(c, t, 'spell');
      });
      const targetsHit = landed;
      // v3.11 (dossier): Polvo de hada: una vez por ronda, el hechizo que le dio a su blanco lo marea
      const mainT = targets[0];
      if (mainT && mainT.hp > 0 && landed > 0 && P() && P().fairyHex) {
        const fh = P().fairyHex(c, p);
        if (fh) {
          applyStatus(mainT, 'stagger', { turns: 2, value: fh.stagger, source: 'polvo_hada' });
          if (fh.expose) applyStatus(mainT, 'exposed', { turns: 1, value: fh.expose, source: 'polvo_hada' });
          const nn = A.Skills ? A.Skills.noun(mainT) : mainT.displayName;
          addLog(c, 'system', { text: `Polvo de hada: ${mainT.displayName} queda mareado (−${fh.stagger} de precisión${fh.expose ? `, −${fh.expose} de defensa` : ''}).`, passive: 'polvo_hada', fx: { kind: 'status', target: fxKey(mainT), effect: 'stagger', passive: 'polvo_hada' }, say: { text: `El polvo de hada que va con tu hechizo marea a ${nn}: su próximo ataque tiene −${fh.stagger} de precisión${fh.expose ? ` y se defiende peor (−${fh.expose})` : ''}.`, tone: 'good' } });
        }
      }
      // v3.11 (dossier): Apoyo orbital: la nave nodriza bombardea con tu hechizo de daño (si está lista)
      if (P() && P().orbitalFire && hittableEnemies().length) orbitalStrike(c, p, mainT);
      // v3.13: Niebla de sangre: una parte de todo el daño vuelve como vida (solo a vos)
      if (spell.drainPct && drained > 0 && p.hp < p.maxHp) {
        const before = p.hp;
        A.State.healHp(Math.max(1, Math.floor(drained * spell.drainPct)));
        if (p.hp > before) addLog(c, 'system', { text: `${spell.name}: +${p.hp - before} de vida.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: p.hp - before }, say: { text: `La niebla vuelve a vos cargada de sangre: recuperás ${p.hp - before} de vida.`, tone: 'good' } });
      }
      // v3.3: Drenar vida: la mitad del daño vuelve como vida
      if (spell.drain && drained > 0 && p.hp < p.maxHp) {
        const before = p.hp;
        A.State.healHp(Math.max(1, Math.floor(drained / 2)));
        if (p.hp > before) addLog(c, 'system', { text: `${spell.name}: +${p.hp - before} de vida.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: p.hp - before }, say: { text: `La vida que le sacás pasa a vos: recuperás ${p.hp - before}.`, tone: 'good' } });
      }
      // v2.1: hechizos que además te curan (Luz sagrada) — v3.3: si pegó
      if (spell.selfHeal && targetsHit && p.hp < p.maxHp) {
        const before = p.hp;
        // v3.9: en Frenesí vampírico, el Toque vampírico cura 1 más
        const frenzyHeal = spell.id === 'toque_vampirico' && P() && P().frenzyOn && P().frenzyOn(c, p) ? (P().TUNE.colmillos.touchHeal || 0) : 0;
        A.State.healHp((Number(spell.selfHeal) || 0) + Math.floor(power / 2) + frenzyHeal);
        if (p.hp > before) addLog(c, 'system', { text: `${spell.name} te devuelve ${p.hp - before} de vida.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: p.hp - before } });
      }
      // v3.14: hechizos de daño que además curan, mejoran o duermen (Corazón del bosque, El reino de los sueños)
      if (isSchoolCast(spell) && !c.result && p.hp > 0) schoolCast(c, p, spell, { afterDamage: true });
    } else if (spell.effect && A.ItemFx) {
      // v3.3: los hechizos de los pergaminos que no son de daño hacen lo mismo que el pergamino
      const asItem = { id: spell.id, name: spell.name, subtype: 'spell', effect: { ...spell.effect, combat: true } };
      const res = A.ItemFx.useInCombat(c, asItem, itemCtx(c));
      if (!res.ok) {
        // no se pudo (no había a quién apuntarle): no gasta maná ni espera
        A.State.setMana(Math.min(p.maxMana, p.mana + cost));
        if (c.spellCd) delete c.spellCd[spell.id];
        if (res.why) addLog(c, 'system', { text: res.why, fx: { kind: 'note' } });
        State().persist();
        return;
      }
    } else if (isSchoolCast(spell)) {
      // v3.13: los de escuela que no son de daño (mejoras, grupo, pacto, sueño)
      const res = schoolCast(c, p, spell);
      if (!res.ok) {
        A.State.setMana(Math.min(p.maxMana, p.mana + cost));
        if (c.spellCd) delete c.spellCd[spell.id];
        if (res.why) addLog(c, 'system', { text: res.why, fx: { kind: 'note' } });
        State().persist();
        return;
      }
      // v3.13: rápido: seguís en tu turno (después atacás o lanzás otro hechizo)
      if (spell.quick) {
        c.quickTurn = c.turnStartedFor;
        State().persist();
        if (checkEnd()) return;
        A.Bus.emit('combat:action', { actor: 'player' });
        A.Bus.emit('combat:turn', { actor: 'player', round: c.round, keep: true });
        return;
      }
    } else {
      addLog(c, 'player', { text: `Lanzaste ${spell.name}.`, fx: { kind: 'cast', actor: 'player', icon: '' } });
    }
    afterPlayerAction();
  }


  Object.assign(C, { playerAttack, powerInfo, techniqueInfo, playerTechnique, disciplineInfo, playerDiscipline, playerPowerAttack, doPlayerAttack, playerStrike, hitReactions, maybeDropEquippedWeapon, spellWait, spellInfo, playerSpell });
})(window.Aventurs);
