/* ============================================================
   Aventurs — Editor v2.2: prueba de combate

   Simula cientos de peleas rápidas (sin animaciones) entre un
   aventurero "de prueba" y una criatura o un grupo, con las mismas
   reglas del juego: dado de 20 + precisión contra defensa, 1 siempre
   falla, 20 es crítico (doble daño), la armadura resta.

   El aventurero de prueba es un Humano del nivel que elijas, con el
   mejor equipo común que podría tener a ese nivel, sin pociones ni
   hechizos. Sirve para comparar, no para predecir al milímetro.
   ============================================================ */

(function (A) {
  'use strict';

  const d20 = () => 1 + Math.floor(Math.random() * 20);
  const roll = (n) => (A.Utils && A.Utils.rollDice ? A.Utils.rollDice(n) : 1);

  // ---------- aventurero de prueba ----------

  const heroCache = new Map();

  function gearFor(p) {
    const lvl = p.level || 1;
    const ok = (x) => (x.tier || 1) <= lvl && ['common', 'uncommon', 'rare'].includes(x.rarity || 'common');
    const avg = (w) => (A.Balance ? A.Balance.avgOf(w.damage) : 1);
    const score = (w) => {
      const fit = A.Balance.weaponFit ? A.Balance.weaponFit(p, w) : { atk: 0, dmg: 0 };
      return avg(w) + fit.dmg + fit.atk * 0.6;
    };
    const weapons = A.Data.weapons.filter((w) => ok(w) && !w.magic).sort((a, b) => score(b) - score(a));
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

  function oneFight(hero, foes, power) {
    const { p, st, weapon } = hero;
    const dmgExpr = weapon ? weapon.damage : '1d2';
    let hp = p.maxHp;
    const es = foes.map((f) => ({ ...f, hp: f.maxHp }));
    const actors = [{ k: 'p', speed: st.speed, tie: Math.random() }]
      .concat(es.map((e, i) => ({ k: 'e', i, speed: e.speed || 10, tie: Math.random() })))
      .sort((a, b) => (b.speed - a.speed) || (b.tie - a.tie));
    let powerCd = 0;
    for (let round = 1; round <= 40; round++) {
      for (const a of actors) {
        if (hp <= 0) return { win: false, rounds: round, hp: 0 };
        if (a.k === 'p') {
          if (powerCd > 0) powerCd -= 1;
          const alive = es.filter((e) => e.hp > 0);
          if (!alive.length) break;
          const t = alive.sort((x, y) => x.hp - y.hp)[0];
          const usePower = power && powerCd === 0;
          if (usePower) powerCd = power.cooldown;
          const r = d20();
          if (r === 1) continue;
          const crit = r === 20;
          if (!crit && r + st.attack < t.difficulty) continue;
          let raw = Math.max(0, roll(dmgExpr) + (st.damageBonus || 0));
          if (usePower) raw *= power.mult;
          if (crit) raw *= 2;
          t.hp -= Math.max(1, raw - (t.armor || 0));
        } else {
          const e = es[a.i];
          if (e.hp <= 0) continue;
          const r = d20();
          if (r === 1) continue;
          const crit = r === 20;
          if (!crit && r + (e.attack || 0) < st.defense) continue;
          let raw = roll(e.damage || 1);
          if (crit) raw *= 2;
          hp -= Math.max(1, raw - (st.armor || 0));
        }
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
  /** Rango normal de % de victorias por tipo de criatura (con las del juego base). */
  function calibration() {
    if (calib) return calib;
    const byCat = {};
    for (const e of (A.Seed && A.Seed.enemies) || A.Data.enemies) {
      const r = fight([e], Math.max(1, Math.min(10, e.tier || 1)), 120);
      (byCat[e.category || 'normal'] = byCat[e.category || 'normal'] || []).push(r.win);
    }
    calib = {};
    for (const k of Object.keys(byCat)) {
      const xs = byCat[k].sort((a, b) => a - b);
      const q = (f) => xs[Math.max(0, Math.min(xs.length - 1, Math.round(f * (xs.length - 1))))];
      calib[k] = { lo: q(0.1), hi: q(0.9), mid: q(0.5) };
    }
    return calib;
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

  A.EditorSim = { heroAt, fight, zone, calibration, clearCache };
})(window.Aventurs);
