/* ============================================================
   Aventurs — Editor v2.2: prueba de combate

   Simula cientos de peleas rápidas (sin animaciones) entre un
   aventurero "de prueba" y una criatura o un grupo, con las mismas
   reglas del juego: dado de 20 + precisión contra defensa, 1 siempre
   falla, 20 es crítico (doble daño), la armadura resta.

   El aventurero de prueba es un Humano del nivel que elijas, con el
   mejor equipo común que podría tener a ese nivel, sin pociones ni
   hechizos. Sirve para comparar, no para predecir al milímetro.

   v3.11: las criaturas usan sus pasivas con las cuentas del juego
   (skills.js) y los jefes, sus trucos (invocar, tentáculos, cabezas,
   curarse, furia). Lo medido con el motor completo está en
   js/data/seed-jefes-medidos.js (node tools/jefes.js --datos).
   ============================================================ */

(function (A) {
  'use strict';

  const d20 = () => 1 + Math.floor(Math.random() * 20);
  const roll = (n) => (A.Utils && A.Utils.rollDice ? A.Utils.rollDice(n) : 1);

  // ---------- aventurero de prueba ----------

  const heroCache = new Map();

  function gearFor(p) {
    const lvl = p.level || 1;
    const ok = (x) => (x.tier || 1) <= lvl && (['common', 'uncommon', 'rare'].includes(x.rarity || 'common')
      // v3.11: en las Tierras Altas, el equipo astral (se vende) y el del alba (se forja) es épico
      || (x.rarity === 'epic' && (x.tier || 1) >= 13 && x.alto));
    const avg = (w) => (A.Balance ? A.Balance.avgOf(w.damage) : 1);
    const score = (w) => {
      const fit = A.Balance.weaponFit ? A.Balance.weaponFit(p, w) : { atk: 0, dmg: 0 };
      return avg(w) + fit.dmg + fit.atk * 0.6;
    };
    // v3.4: cada clase, sus armas (los magos, las de mago; los demás, las comunes)
    const weapons = A.Data.weapons.filter((w) => ok(w) && !w.starter && (!A.Balance.canWield || A.Balance.canWield(p, w).ok))
      .sort((a, b) => (score(b) + (b.magic ? 3 : 0)) - (score(a) + (a.magic ? 3 : 0)));
    const armors = A.Data.armors.filter(ok).sort((a, b) => (b.tier - a.tier) || ((b.defense || 0) - (a.defense || 0)));
    if (lvl > 1) {
      if (weapons[0]) p.equipment.weapon = weapons[0].id;
      if (armors[0]) p.equipment.armor = armors[0].id;
    }
  }

  /** { p, st, weapon } de un aventurero de prueba. */
  function heroAt(level, raceId = 'humano') {
    const key = `${raceId}:${level}`;
    if (heroCache.has(key)) return heroCache.get(key);
    const base = A.Seed.statsForRace(raceId) || A.Seed.statsForRace('humano');
    const magic = A.Seed.raceHasMagic(raceId);
    const p = {
      name: 'Prueba', raceId, level: 1, xp: 0,
      hp: base.maxHp, maxHp: base.maxHp, mana: magic ? base.maxMana : 0, maxMana: magic ? base.maxMana : 0,
      hasMagic: magic, food: 20, maxFood: 20, effects: [], spells: [], inventory: [],
      stats: { speed: base.speed, precision: base.precision, armor: base.armor, damage: base.damage, dodge: base.dodge },
      equipment: { weapon: 'daga', armor: 'tunica_cuero' },
    };
    while (p.level < level && A.Progression) A.Progression.applyLevelUp(p);
    gearFor(p);
    // Las cuentas del juego miran el hambre del personaje actual: un rato lo cambiamos por el de prueba
    const saved = A.State.player;
    let st;
    try { A.State.player = p; st = A.Balance.playerCombatStats(p); } finally { A.State.player = saved; }
    const out = { p, st, weapon: A.Data.getById('weapons', p.equipment.weapon) || null };
    heroCache.set(key, out);
    return out;
  }

  function clearCache() { heroCache.clear(); calib = null; }

  // ---------- una pelea ----------

  // v3.11: lo que hacen los jefes también cuenta en la prueba (invocar, los tentáculos del Kraken, las tres cabezas)
  function bossTricks(es) {
    const add = [];
    for (const e of es) {
      const ids = A.Skills && A.Skills.idsOf ? A.Skills.idsOf(e) : [];
      if (ids.includes('ocho_tentaculos')) {
        for (let i = 0; i < 8; i++) { const t = instanceOf(A.Data.getById('enemies', 'tentaculo_kraken') || {}); if (t && t.maxHp) { t.hp = t.maxHp; t.guard = e; add.push(t); } }
        e.hidden = true;
      }
      if (ids.includes('tres_cabezas')) e.heads = 3;
      // v3.11: lo que más pesa de los jefes en una pelea larga (como en el juego: skills.js y combat.js)
      if (ids.includes('curarse')) e.selfHeal = { amount: 0.25, uses: 2, cd: 0 };
      if (ids.includes('venenoso')) e.venom = true;
      if (e.category === 'boss' || ids.includes('enfurecer')) e.canRage = true;
      const sk = ids.find((id) => /^invocar|^llamar_manada/.test(id));
      const data = A.Data.getById('enemies', e.id) || {};
      const raw = (A.Skills && A.Skills.SUMMONS && A.Skills.SUMMONS[e.id]) || data.summons;
      if (sk && raw) {
        const spec = typeof raw === 'string' ? { id: raw, count: 1 } : { ...raw };
        const lib = A.Skills.get ? A.Skills.get(sk) : null;
        if (lib && lib.count) spec.count = lib.count;
        e.summon = spec;
      }
    }
    return add;
  }
  function summonNow(e) {
    const out = [];
    const d = A.Data.getById('enemies', e.summon.id);
    for (let i = 0; d && i < (e.summon.count || 1); i++) { const s = instanceOf(d); s.maxHp = Math.max(1, Math.round(s.maxHp * (e.summon.hp || (e.summon.weak ? 0.6 : 1)))); s.hp = s.maxHp; out.push(s); }
    e.summon = null;
    return out;
  }

  // v3.11: las pasivas de las criaturas, con las mismas cuentas del juego (skills.js): colas del kitsune, ilusiones,
  // piel gruesa, caparazón, regeneración, renacer, espinas, cuerpo de fuego, manada, líder...
  const SK = () => A.Skills || {};
  const NO_MODS = { attack: 0, defense: 0, armor: 0 };
  function modsOf(e, es) { try { return SK().statMods ? SK().statMods(e, { enemies: es }) : NO_MODS; } catch (err) { return NO_MODS; } }

  function oneFight(hero, foes, power) {
    const { p, st, weapon } = hero;
    const dmgExpr = weapon ? weapon.damage : '1d2';
    let hp = p.maxHp;
    const es = foes.map((f) => ({ ...f, hp: f.maxHp }));
    es.push(...bossTricks(es));
    const actors = [{ k: 'p', speed: st.speed, tie: Math.random() }]
      .concat(es.map((e, i) => ({ k: 'e', i, speed: e.speed || 10, tie: Math.random() })))
      .sort((a, b) => (b.speed - a.speed) || (b.tie - a.tie));
    let powerCd = 0;
    let poison = 0, burn = 0; // v3.11: turnos de veneno (1 por turno) y de fuego (2 por turno) que le quedan al aventurero
    const headMult = ((SK().get && SK().get('tres_cabezas')) || {}).mult || 0.6;
    for (let round = 1; round <= 40; round++) {
      // el jefe llama a los suyos en su segunda ronda (y pelean desde la siguiente)
      if (round === 2) for (const e of es.slice()) if (e.summon && e.hp > 0) { for (const s of summonNow(e)) { es.push(s); actors.push({ k: 'e', i: es.length - 1, speed: s.speed || 10, tie: 0 }); } }
      for (const e of es) if (e.hidden && !es.some((g) => g.guard === e && g.hp > 0)) e.hidden = false;
      for (const a of actors) {
        if (hp <= 0) return { win: false, rounds: round, hp: 0 };
        if (a.k === 'p') {
          if (powerCd > 0) powerCd -= 1;
          if (poison > 0) { poison -= 1; hp -= 1; }
          if (burn > 0) { burn -= 1; hp -= 2; }
          if (hp <= 0) return { win: false, rounds: round, hp: 0 };
          const alive = es.filter((e) => e.hp > 0 && !e.hidden);
          if (!alive.length) break;
          const t = alive.sort((x, y) => x.hp - y.hp)[0];
          const usePower = power && powerCd === 0;
          if (usePower) powerCd = power.cooldown;
          const r = d20();
          if (r === 1) continue;
          const crit = r === 20;
          const tm = modsOf(t, es);
          if (!crit && r + st.attack < (t.difficulty || 10) + tm.defense) continue;
          if (SK().dodgeHit && SK().dodgeHit(t, { hit: true, crit })) continue; // ilusión, escurridizo, etéreo
          let raw = Math.max(0, roll(dmgExpr) + (st.damageBonus || 0));
          if (usePower) raw *= power.mult;
          if (crit) raw *= 2;
          let dmg = Math.max(1, Math.round(raw) - (t.armor || 0) - (tm.armor || 0));
          if (SK().softenHit) dmg = SK().softenHit(t, dmg).dmg; // caparazón, piel gruesa
          t.hp -= dmg;
          if (t.hp <= 0 && SK().tryRevive) SK().tryRevive(t); // renacer, aguante
          const re = SK().reactions ? SK().reactions(t) : null; // espinas, cuerpo de fuego
          if (re && re.thorns) hp -= re.thorns;
          if (re && re.burn && Math.random() < re.burn) burn = Math.max(burn, 2);
        } else {
          const e = es[a.i];
          if (e.hp <= 0 || e.hidden) continue;
          if (SK().growTails) SK().growTails(e); // kitsune: una cola por turno (con nueve se cura)
          // regeneración (como en el juego: 1,5% por turno en los jefes, 3% en las demás, hasta un cuarto por pelea)
          const g = SK().regenOf ? SK().regenOf(e) : 0;
          if (g > 0) { const got = Math.min(g, e.maxHp - e.hp); e.hp += got; e._regenUsed = (e._regenUsed || 0) + g; }
          // los jefes se enfurecen con la mitad de la vida
          if (e.canRage && !e.raged && e.hp <= e.maxHp / 2) { e.raged = true; e.dmgMult = (e.dmgMult || 1) * ((A.Balance.BOSS && A.Balance.BOSS.rage) || 1.2); }
          // curarse: con la mitad de la vida o menos, a veces se cura un cuarto (dos veces por pelea)
          if (e.selfHeal) { if (e.selfHeal.cd > 0) e.selfHeal.cd -= 1; else if (e.selfHeal.uses > 0 && e.hp <= e.maxHp / 2 && Math.random() < 0.45) { e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp * e.selfHeal.amount)); e.selfHeal.uses -= 1; e.selfHeal.cd = 4; continue; } }
          const em = modsOf(e, es);
          for (let h = 0; h < (e.heads || 1); h++) {
            const r = d20();
            if (r === 1) continue;
            const crit = r === 20;
            if (!crit && r + (e.attack || 0) + (em.attack || 0) < st.defense) continue;
            const bonus = SK().bonusDamage ? SK().bonusDamage(e).mult : 1; // colas del kitsune, emboscada
            const fury = SK().damageMult ? SK().damageMult(e) : 1; // Furia (criaturas)
            let raw = roll(e.damage || 1) * (e.heads ? headMult : 1) * (e.dmgMult || 1) * bonus * fury;
            if (crit) raw *= 2;
            hp -= Math.max(1, Math.round(raw) - (st.armor || 0));
            if (e.venom && Math.random() < 0.35) poison = Math.max(poison, 3);
          }
        }
        for (const g of es) if (g.hidden && !es.some((x) => x.guard === g && x.hp > 0)) g.hidden = false;
      }
      if (es.every((e) => e.hp <= 0)) return { win: true, rounds: round, hp };
    }
    return { win: false, rounds: 40, hp };
  }

  function instanceOf(enemyData) {
    const inst = A.Encounter.spawnInstance({ ...enemyData, drops: [] });
    return inst;
  }

  /** Muchas peleas contra una criatura (o grupo). */
  function fight(enemyDatas, level, n = 300, opts = {}) {
    const hero = heroAt(level, opts.raceId);
    const power = opts.power && A.Balance.TUNE ? { ...A.Balance.TUNE.warriorPower } : null;
    let wins = 0, rounds = 0, hpLeft = 0;
    for (let i = 0; i < n; i++) {
      const foes = enemyDatas.map(instanceOf);
      const r = oneFight(hero, foes, power);
      if (r.win) { wins++; hpLeft += Math.max(0, r.hp) / hero.p.maxHp; }
      rounds += r.rounds;
    }
    const one = enemyDatas.length === 1 ? instanceOf(enemyDatas[0]) : null;
    const hitPct = (need) => Math.max(5, Math.min(95, (21 - need) * 5));
    const needHero = one ? Math.max(2, Math.min(20, one.difficulty - hero.st.attack)) : null;
    const needFoe = one ? Math.max(2, Math.min(20, hero.st.defense - (one.attack || 0))) : null;
    const avgFoe = one ? Math.max(1, A.Balance.avgOf(one.damage || 1) - (hero.st.armor || 0)) : null;
    const avgHero = one ? Math.max(1, A.Balance.avgOf(hero.weapon ? hero.weapon.damage : '1d2') + (hero.st.damageBonus || 0) - (one.armor || 0)) : null;
    return {
      n, level,
      win: wins / n,
      rounds: rounds / n,
      hpLeft: wins ? hpLeft / wins : 0,
      hero: { hp: hero.p.maxHp, attack: hero.st.attack, defense: hero.st.defense, armor: hero.st.armor, weapon: hero.weapon ? hero.weapon.name : 'puños', damage: hero.weapon ? hero.weapon.damage : '1d2', bonus: hero.st.damageBonus || 0 },
      needHero, needFoe,
      hitHero: needHero ? hitPct(needHero) : null,
      hitFoe: needFoe ? hitPct(needFoe) : null,
      hitsToKill: one ? Math.ceil(one.maxHp / avgHero) : null,
      hitsToDie: one ? Math.ceil(hero.p.maxHp / avgFoe) : null,
    };
  }

  // ---------- cómo son las criaturas del juego (para comparar) ----------

  let calib = null;
  /** Lo que cuesta una pelea: vida que pierde el aventurero (perder = 1). */
  const costFrom = (r) => (1 - r.win) + r.win * (1 - r.hpLeft);

  /**
   * Rango normal de % de victorias por tipo de criatura (con las del juego base),
   * y el "costo" típico de cada tipo (v2.3: lo usa Sugerir números).
   */
  function calibration() {
    if (calib) return calib;
    const byCat = {};
    for (const e of (A.Seed && A.Seed.enemies) || A.Data.enemies) {
      const r = fight([e], Math.max(1, Math.min(A.Progression ? A.Progression.MAX_LEVEL : 20, e.tier || 1)), 120);
      const k = e.category || 'normal';
      (byCat[k] = byCat[k] || { win: [], cost: [] });
      byCat[k].win.push(r.win);
      byCat[k].cost.push(costFrom(r));
    }
    calib = {};
    for (const k of Object.keys(byCat)) {
      const q = (arr, f) => { const xs = arr.slice().sort((a, b) => a - b); return xs[Math.max(0, Math.min(xs.length - 1, Math.round(f * (xs.length - 1))))]; };
      calib[k] = { lo: q(byCat[k].win, 0.1), hi: q(byCat[k].win, 0.9), mid: q(byCat[k].win, 0.5), cost: q(byCat[k].cost, 0.5) };
    }
    return calib;
  }

  // ---------- v2.3: sugerir números ----------

  /** Formas de ser: reparten el mismo poder de otra manera. */
  const STYLES = {
    pareja: { label: 'Pareja', hint: 'Todo en la media de su nivel.', hp: 1, dmg: 1, armor: 0, def: 0, speed: 0 },
    aguanta: { label: 'Aguanta mucho', hint: 'Mucha vida, pega menos.', hp: 1.3, dmg: 0.8, armor: 0, def: 0, speed: -2 },
    pega: { label: 'Pega fuerte', hint: 'Golpes duros, poca vida.', hp: 0.8, dmg: 1.25, armor: 0, def: 0, speed: 0 },
    rapida: { label: 'Rápida', hint: 'Ataca primero y cuesta pegarle.', hp: 0.85, dmg: 0.95, armor: 0, def: 1, speed: 4 },
    acorazada: { label: 'Acorazada', hint: 'Mucha armadura, menos vida.', hp: 0.85, dmg: 0.9, armor: 2, def: 0, speed: -2 },
  };

  /** La forma que más se le parece a una criatura (para empezar). */
  function guessStyle(d) {
    if (!d || !A.Balance) return 'pareja';
    const c = A.Balance.enemyStats(d.tier || 1, d.category || 'normal');
    const hp = (d.health || c.health) / c.health;
    const dmg = A.Balance.avgOf(d.damage || c.damage) / c.damageAvg;
    if ((d.armor || 0) >= c.armor + 2) return 'acorazada';
    if ((d.speed || 10) >= 14) return 'rapida';
    if (dmg / hp > 1.25) return 'pega';
    if (hp / dmg > 1.25) return 'aguanta';
    return 'pareja';
  }

  /**
   * Números sugeridos para una criatura: la curva de su nivel y tipo, con su
   * forma de ser, y la vida afinada con peleas de prueba para que cueste lo
   * mismo que las del juego de su mismo tipo.
   */
  function suggest(d, styleId) {
    const tier = Math.max(1, Math.min(A.Progression ? A.Progression.MAX_LEVEL : 20, d.tier || 1));
    const category = d.category || 'normal';
    const st = STYLES[styleId] || STYLES.pareja;
    const c = A.Balance.enemyStats(tier, category);
    const target = (calibration()[category] || calibration().normal || {}).cost;
    const out = {
      damage: A.Balance.damageToNotation(c.damageAvg * st.dmg),
      attack: c.attack,
      difficulty: c.difficulty + st.def,
      armor: Math.max(0, c.armor + st.armor),
      // la velocidad es parte de su forma de ser: solo cambia si la forma lo pide
      speed: (() => {
        const cur = d.speed || (category === 'weak' ? 12 : 10);
        if (st.speed > 0) return Math.min(20, Math.max(cur, 10 + st.speed));
        if (st.speed < 0) return Math.max(3, Math.min(cur, 10 + st.speed));
        return cur;
      })(),
      health: Math.max(3, Math.round(c.health * st.hp)),
    };
    if (target != null) {
      const test = (hp) => costFrom(fight([{ ...d, ...out, health: hp }], tier, 160));
      let lo = Math.max(3, Math.round(out.health * 0.5));
      let hi = Math.max(lo + 1, Math.round(out.health * 1.8));
      // el costo sube con la vida: búsqueda por mitades
      for (let i = 0; i < 7 && hi - lo > 1; i++) {
        const mid = Math.round((lo + hi) / 2);
        if (test(mid) > target) hi = mid; else lo = mid;
      }
      out.health = Math.abs(test(lo) - target) <= Math.abs(test(hi) - target) ? lo : hi;
    }
    const r = fight([{ ...d, ...out }], tier, 300);
    return { ...out, style: styleId, win: r.win, cost: costFrom(r), target };
  }

  // ---------- una zona ----------

  /** Peleas típicas de una zona (con lo guardado) a un nivel. */
  function zone(regionId, level, n = 150) {
    const groups = new Map();
    let wins = 0, size = 0, done = 0;
    for (let i = 0; i < n; i++) {
      const g = A.Encounter.generate(regionId, { level });
      if (!g || !g.length) continue;
      done++;
      size += g.length;
      const datas = g.map((inst) => A.Data.getById('enemies', inst.id)).filter(Boolean);
      const r = oneFight(heroAt(level), datas.map(instanceOf));
      if (r.win) wins++;
      const key = g.map((x) => x.id).sort().join('+');
      const row = groups.get(key) || { key, names: g.map((x) => x.name).join(' + '), n: 0, lost: 0 };
      row.n++;
      if (!r.win) row.lost++;
      groups.set(key, row);
    }
    const worst = Array.from(groups.values()).filter((x) => x.lost > 0).sort((a, b) => (b.lost / b.n) - (a.lost / a.n) || b.n - a.n).slice(0, 3);
    return { n: done, win: done ? wins / done : 0, size: done ? size / done : 0, worst, kinds: groups.size };
  }

  A.EditorSim = { heroAt, fight, zone, calibration, clearCache, STYLES, guessStyle, suggest, costFrom };
})(window.Aventurs);
