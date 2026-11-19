/* ============================================================
   Aventurs — Simulador de balance (Node.js, no se carga en el juego)

   Carga el código REAL del juego (datos + sistemas) sin navegador y
   simula miles de combates para medir el balance.

   Uso (desde la carpeta del proyecto):
     node tools/simulador.js            -> informe completo
     node tools/simulador.js razas      -> solo razas
     node tools/simulador.js enemigos   -> solo curva de enemigos
     node tools/simulador.js mascota    -> combates con y sin mascota
     node tools/simulador.js economia   -> monedas y XP por combate
     node tools/simulador.js viaje      -> pasos y niveles del mapa
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// Orden de carga = mismo orden que index.html (sin vistas ni DOM)
function scriptList() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const all = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  const skip = ['js/views/', 'js/editor/', 'js/vendor/', 'js/app.js', 'js/core/ui-recover.js', 'js/core/tag-input.js'];
  return all.filter((f) => !skip.some((s) => f.startsWith(s)));
}

/**
 * Crea un "navegador falso" con el juego cargado.
 * Los setTimeout se encolan y se ejecutan con drain().
 */
function createGame() {
  const store = {};
  const queue = [];
  const sandbox = {
    console: { log() {}, info() {}, debug() {}, warn() {}, error: (...a) => console.error(...a) },
    setTimeout: (fn) => { queue.push(fn); return queue.length; },
    clearTimeout() {},
    setInterval() { return 0; },
    clearInterval() {},
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of scriptList()) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
  }
  const A = sandbox.Aventurs;
  A.Data.init();
  function drain(limit = 100000) {
    let n = 0;
    while (queue.length && n < limit) { queue.shift()(); n++; }
  }
  // Math del juego (el sandbox tiene el suyo): sirve para fijar el azar en pruebas
  const GameMath = vm.runInContext('Math', sandbox);
  return { A, drain, queue, GameMath };
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/** Sube al personaje hasta `level` aplicando las mismas mejoras que en el juego. */
function setLevel(G, p, level) {
  const { A } = G;
  while (p.level < level && A.Progression) A.Progression.applyLevelUp(p);
  if (A.Progression) p.xp = A.Progression.xpForLevel(p.level);
  if (p.hasMagic) {
    // Hechizos que un mago de ese nivel podría haber aprendido
    // (los hechizos de raza son solo de su raza)
    // v2.5: respetando quién puede aprender cada uno (los grandes de área, solo magos)
    for (const s of A.Data.spells) {
      if ((s.tier || 1) > level || s.racial || s.fromScroll || p.spells.includes(s.id)) continue; // v3.3: los de pergamino se compran
      if (A.Spellbook && A.Spellbook.canLearn && !A.Spellbook.canLearn(p, s).ok) continue;
      p.spells.push(s.id);
    }
  }
}

/** Equipo "comprado" acorde al nivel: el mejor arma/armadura común o poco común de tier <= nivel. */
function gearForLevel(G, p) {
  const { A } = G;
  const lvl = p.level || 1;
  const ok = (x) => (x.tier || 1) <= lvl && ['common', 'uncommon', 'rare'].includes(x.rarity || 'common');
  const avg = (w) => (A.Balance ? A.Balance.avgOf(w.damage) : 1);
  // v2.0: cada clase elige el arma que mejor le queda (los magos, bastones)
  const type = A.Balance.classOf ? A.Balance.classOf(p) : 'hybrid';
  const score = (w) => {
    const fit = A.Balance.weaponFit ? A.Balance.weaponFit(p, w) : { atk: 0, dmg: 0 };
    let s = avg(w) + fit.dmg + fit.atk * 0.6;
    if (type === 'mage' && w.magic) s += 3;
    if (type === 'hybrid' && w.magic) s += 0.5;
    return s;
  };
  // v3.3: los magos solo usan armas mágicas; las armas de raza no se compran
  const weapons = A.Data.weapons.filter((w) => ok(w) && !w.starter && (p.hasMagic ? true : !w.magic) && (type !== 'mage' || w.magic));
  weapons.sort((a, b) => score(b) - score(a));
  const armors = A.Data.armors.filter(ok).sort((a, b) => (b.tier - a.tier) || (b.defense - a.defense));
  if (lvl > 1) {
    if (weapons[0]) p.equipment.weapon = weapons[0].id;
    if (armors[0]) p.equipment.armor = armors[0].id;
  }
}

function newCharacter(G, raceId, opts = {}) {
  const { A } = G;
  A.State.reset && A.State.reset();
  A.State.createCharacter({ name: 'Sim', raceId });
  const p = A.State.player;
  if (opts.level && opts.level > 1) setLevel(G, p, opts.level);
  if (opts.gear !== false) gearForLevel(G, p);
  if (opts.weapon !== undefined) p.equipment.weapon = opts.weapon;
  if (opts.armor !== undefined) p.equipment.armor = opts.armor;
  if (opts.noItems) {
    p.inventory = p.inventory.filter((s) => s.itemId.startsWith('coin_'));
  }
  if (opts.pet) {
    p.pet = opts.pet(G);
  }
  p.food = p.maxFood;
  return p;
}

function spawn(G, enemyId) {
  const { A } = G;
  const e = A.Data.getById('enemies', enemyId);
  if (A.Encounter.spawnInstance) return A.Encounter.spawnInstance(e);
  // Compatibilidad con la versión vieja (spawnInstance no exportado)
  return {
    instanceId: 'e_' + Math.random().toString(36).slice(2),
    id: e.id, name: e.name, icon: e.icon,
    hp: e.health, maxHp: e.health, damage: e.damage,
    armor: e.armor || 0, speed: e.speed || 10,
    dodge: e.dodge || Math.max(0, Math.floor((e.speed || 10) / 4)),
    difficulty: e.difficulty, category: e.category, tier: e.tier,
    family: (e.family || []).slice(), tags: (e.tags || []).slice(),
    effects: [],
  };
}

/**
 * IA del jugador: cura si está bajo; si no, elige lo que más daño
 * esperado hace este turno (arma o hechizo), como haría alguien que piensa.
 */
function playerAI(G) {
  const { A } = G;
  const p = A.State.player;
  const c = A.State.combat;
  const alive = A.Combat.aliveEnemies();
  const P = A.Passives;
  const cost = (s) => (P ? P.spellCost(p, s) : s.manaCost);
  // Cura con poción si queda poca vida
  if (p.hp < p.maxHp * 0.35) {
    const pot = (p.inventory || []).find((s) => {
      const it = A.Data.getById('items', s.itemId);
      return it && it.subtype === 'potion' && it.effect && it.effect.type === 'heal';
    });
    // v3.3: las pociones no gastan el turno (hasta 3): si se pudo, después sigue jugando
    if (pot && A.Combat.playerUseItem(pot.itemId)) return;
  }
  // Curación propia si queda poca vida (v3.1: o si dos golpes fuertes te tumban,
  // como haría alguien con poca vida: antes se curaba tarde y caía con maná de sobra)
  const maxHit = alive.reduce((m, e) => Math.max(m, A.Utils.diceRange ? A.Utils.diceRange(String(e.damage || '1d4')).max : 6), 0);
  const danger = p.hp <= maxHit * 2 && p.hp < p.maxHp * 0.7;
  // v3.3: los hechizos con espera no siempre están listos
  const ready = (s) => !A.Combat.spellInfo || A.Combat.spellInfo(s.id).ready;
  if (p.hasMagic && (p.hp < p.maxHp * 0.45 || danger)) {
    const heal = A.Combat.availableSpells().find((s) => s.heal && p.mana >= cost(s) && ready(s));
    if (heal) { A.Combat.playerSpell(heal.id); return; }
  }
  // Apuntar al enemigo con menos vida
  const weakest = alive.slice().sort((a, b) => a.hp - b.hp)[0];
  if (weakest && c.targetInstanceId !== weakest.instanceId) A.Combat.setTarget(weakest.instanceId);
  const avg = (n) => (A.Balance ? A.Balance.avgOf(n) : 1);
  // Daño esperado del arma contra el objetivo
  const st = A.Balance.playerCombatStats(p);
  const comp = A.Combat.composePlayerDamage(p);
  const def = (weakest && (weakest.difficulty || 10)) || 10;
  const arm = (weakest && weakest.armor) || 0;
  const hit = A.Balance.hitChance(st.attack, def);
  const weaponEV = hit * Math.max(1, avg(comp.expression.replace(/ - \d+$/, '')) - arm);
  // Mejor hechizo de daño que alcance.
  // v3.1: como haría una persona, guarda maná para una Curación (si la sabe),
  // salvo que el hechizo termine la pelea o tenga a varios en el área.
  let best = null;
  if (p.hasMagic) {
    const power = st.spellPower + (P ? P.spellBonus(p) : 0);
    const healSpell = A.Combat.availableSpells().find((s) => s.heal);
    const reserve = healSpell ? cost(healSpell) : 0;
    for (const s of A.Combat.availableSpells()) {
      if (!s.damage || p.mana < cost(s) || !ready(s)) continue;
      const each = Math.max(1, avg(s.damage) + power - Math.floor(arm / 2));
      const finishes = weakest && each >= weakest.hp && alive.length === 1;
      if (p.mana - cost(s) < reserve && !finishes && !(s.area && alive.length > 1)) continue;
      // v3.3: los hechizos de daño pueden fallar (y con 20 hacen el doble)
      const sHit = s.sure ? 1 : (A.Combat.spellInfo ? A.Combat.spellInfo(s.id).hit : 1);
      const ev = each * (s.area ? alive.length : 1) * (s.sure ? 1 : sHit + 0.05);
      if (!best || ev > best.ev) best = { s, ev };
    }
  }
  if (best && best.ev >= weaponEV) { A.Combat.playerSpell(best.s.id); return; }
  // v2.1.1: los guerreros usan el golpe fuerte apenas está listo
  const pw = A.Combat.powerInfo ? A.Combat.powerInfo() : null;
  if (pw && pw.ready) { A.Combat.playerPowerAttack(); return; }
  A.Combat.playerAttack();
}

/**
 * Corre un combate completo. Devuelve { result, rounds, hpLeft, petKO }.
 */
function runFight(G, enemyIds, opts = {}) {
  const { A, drain } = G;
  const enemies = enemyIds.map((id) => spawn(G, id));
  A.Combat.start({ enemies });
  let safety = 0;
  while (safety++ < 2000) {
    drain();
    const c = A.State.combat;
    if (!c || c.result) break;
    const cur = c.initiative[c.currentActorIdx];
    if (!cur || cur.kind !== 'player') { drain(); continue; }
    playerAI(G);
  }
  const c = A.State.combat;
  const out = {
    result: c ? c.result : 'none',
    rounds: c ? c.round : 0,
    hpLeft: A.State.player.hp / A.State.player.maxHp,
    petKO: !!(A.State.player.pet && A.State.player.pet.health <= 0),
  };
  if (c) A.Combat.finish();
  return out;
}

function pct(n) { return (n * 100).toFixed(0).padStart(3) + '%'; }

function enemiesByTier(G) {
  const by = {};
  for (const e of G.A.Data.enemies) (by[e.tier] = by[e.tier] || []).push(e);
  return by;
}

// ------------------------------------------------------------
// Informes
// ------------------------------------------------------------

/** Razas: % de victoria 1 contra 1 vs cada enemigo de cierto tier, en cierto nivel. */
function reportRaces(G, { level = 1, tiers = [1, 2], fights = 60, weapon = null, noItems = true } = {}) {
  const { A } = G;
  const byTier = enemiesByTier(G);
  const rows = [];
  for (const race of A.Data.races) {
    let wins = 0, total = 0, hpSum = 0, roundsSum = 0;
    for (const t of tiers) {
      for (const e of byTier[t] || []) {
        for (let i = 0; i < fights; i++) {
          newCharacter(G, race.id, { level, weapon: weapon === null ? undefined : weapon, noItems });
          const r = runFight(G, [e.id]);
          total++;
          if (r.result === 'victory') { wins++; hpSum += r.hpLeft; }
          roundsSum += r.rounds;
        }
      }
    }
    const p = A.State.player;
    rows.push({
      raza: race.name,
      magia: p.hasMagic ? 'sí' : 'no',
      victorias: pct(wins / total),
      vidaRestante: pct(wins ? hpSum / wins : 0),
      rondas: (roundsSum / total).toFixed(1),
    });
  }
  return rows;
}

/**
 * Racha: N combates seguidos SIN descansar (la vida y el maná no se recuperan).
 * Mide cuántos combates aguanta cada raza en promedio.
 */
function reportStreak(G, { level = 1, tiers = [1, 2], streak = 5, runs = 300 } = {}) {
  const { A } = G;
  const byTier = enemiesByTier(G);
  const pool = tiers.flatMap((t) => (byTier[t] || []).filter((e) => e.category !== 'boss'));
  const rows = [];
  for (const race of A.Data.races) {
    let survived = 0, foughtSum = 0;
    for (let r = 0; r < runs; r++) {
      newCharacter(G, race.id, { level, noItems: true });
      let fought = 0;
      for (let f = 0; f < streak; f++) {
        const e = pool[Math.floor(Math.random() * pool.length)];
        const res = runFight(G, [e.id]);
        if (res.result !== 'victory') break;
        fought++;
        A.State.player.hp = Math.max(1, A.State.player.hp);
      }
      foughtSum += fought;
      if (fought === streak) survived++;
    }
    rows.push({ raza: race.name, rachaCompleta: pct(survived / runs), combatesPromedio: (foughtSum / runs).toFixed(2) });
  }
  return rows;
}

function report(section) {
  const G = createGame();
  const { A } = G;
  const out = [];
  const want = (s) => !section || section === s;

  if (want('razas')) {
    out.push('\n=== RAZAS: nivel 1, equipo inicial, sin pociones, 1 vs 1 contra tier 1-2 ===');
    console.log(out.pop());
    console.table(reportRaces(G, { level: 1, tiers: [1, 2] }));
    if (A.Progression) {
      console.log('\n=== RAZAS: nivel 5 contra tier 4-5 (con equipo de su tier) ===');
      console.table(reportRaces(G, { level: 5, tiers: [4, 5], fights: 30 }));
      console.log('\n=== RAZAS: racha de 5 combates seguidos sin descansar (nivel 1, tier 1-2) ===');
      console.table(reportStreak(G, { level: 1, tiers: [1, 2] }));
      console.log('\n=== RAZAS: racha de 5 combates seguidos sin descansar (nivel 6, tier 5-6) ===');
      console.table(reportStreak(G, { level: 6, tiers: [5, 6], runs: 200 }));
    }
  }

  if (want('enemigos')) {
    console.log('\n=== ENEMIGOS: Humano promedio vs cada tier (nivel = tier) ===');
    const byTier = enemiesByTier(G);
    const rows = [];
    for (const t of Object.keys(byTier).map(Number).sort((a, b) => a - b)) {
      for (const cat of ['weak', 'normal', 'strong', 'boss']) {
        const list = byTier[t].filter((e) => e.category === cat);
        if (!list.length) continue;
        let wins = 0, total = 0, hp = 0;
        for (const e of list) {
          for (let i = 0; i < 30; i++) {
            newCharacter(G, 'humano', { level: A.Progression ? t : 1, noItems: true });
            const r = runFight(G, [e.id]);
            total++;
            if (r.result === 'victory') { wins++; hp += r.hpLeft; }
          }
        }
        rows.push({ tier: t, categoria: cat, cantidad: list.length, victorias: pct(wins / total), vidaRestante: pct(wins ? hp / wins : 0) });
      }
    }
    console.table(rows);
  }

  if (want('mascota') && A.Tame) {
    console.log('\n=== MASCOTA: Humano nivel 3 vs grupos de tier 2-3, con y sin mascota ===');
    const byTier = enemiesByTier(G);
    const pool = [...(byTier[2] || []), ...(byTier[3] || [])].filter((e) => e.category !== 'boss');
    const rows = [];
    for (const withPet of [false, true]) {
      let wins = 0, total = 0, ko = 0;
      for (let i = 0; i < 300; i++) {
        const group = [pool[i % pool.length].id, pool[(i * 7) % pool.length].id];
        newCharacter(G, 'humano', {
          level: A.Progression ? 3 : 1, noItems: true,
          pet: withPet ? (GG) => (GG.A.Tame.createPet ? GG.A.Tame.createPet(GG.A.Data.getById('enemies', 'lobo'), 3) : null) : null,
        });
        const r = runFight(G, group);
        total++;
        if (r.result === 'victory') wins++;
        if (r.petKO) ko++;
      }
      rows.push({ mascota: withPet ? 'lobo' : 'ninguna', victorias: pct(wins / total), mascotaKO: withPet ? pct(ko / total) : '-' });
    }
    console.table(rows);
  }

  if (want('economia')) {
    console.log('\n=== ECONOMÍA: monedas y XP promedio por enemigo (por tier) ===');
    const byTier = enemiesByTier(G);
    const rows = [];
    for (const t of Object.keys(byTier).map(Number).sort((a, b) => a - b)) {
      let coins = 0, n = 0, xp = 0;
      for (const e of byTier[t]) {
        // v2.0: monedas seguras por enemigo (Balance.Economy.coinsFor)
        const E = A.Balance && A.Balance.Economy;
        if (E && E.coinsFor) coins += E.coinBase(e.tier) * ((A.Balance.CATEGORY[e.category] || A.Balance.CATEGORY.normal).coin);
        if (A.Progression && A.Progression.xpForEnemy) xp += A.Progression.xpForEnemy(e);
        n++;
      }
      const weapons = A.Data.weapons.filter((w) => w.tier === t);
      const avgW = weapons.length ? weapons.reduce((s, w) => s + (w.value || 0), 0) / weapons.length : 0;
      rows.push({
        tier: t,
        cobrePorEnemigo: (coins / n).toFixed(1),
        xpPorEnemigo: A.Progression ? (xp / n).toFixed(0) : '-',
        precioArmaPromedio: avgW ? avgW.toFixed(0) : '-',
        combatesParaArma: avgW && coins ? (avgW / (coins / n * 1.6)).toFixed(0) : '-',
      });
    }
    console.table(rows);
    if (A.Progression) {
      console.log('XP necesaria por nivel:', [2, 3, 4, 5, 6, 7, 8, 9, 10].map((l) => `${l}:${A.Progression.xpForLevel(l)}`).join('  '));
    }
  }

  if (want('viaje') && A.Travel) {
    console.log('\n=== VIAJE: pasos por ruta (ida = vuelta) y nivel mínimo ===');
    newCharacter(G, 'humano', {});
    const rows = [];
    const seen = new Set();
    for (const r of A.Data.regions) {
      for (const to of r.connections || []) {
        const key = [r.id, to].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const target = A.Data.getById('regions', to);
        const ida = A.Travel.calculateTravelSteps ? A.Travel.calculateTravelSteps(target, r) : '-';
        const vuelta = A.Travel.calculateTravelSteps ? A.Travel.calculateTravelSteps(r, target) : '-';
        rows.push({ ruta: `${r.id} ↔ ${to}`, ida, vuelta, nivelDestino: (target.unlockConditions || {}).minLevel || 1, nivelOrigen: (r.unlockConditions || {}).minLevel || 1 });
      }
    }
    console.table(rows);
  }
}

if (require.main === module) {
  report(process.argv[2]);
}

module.exports = { createGame, newCharacter, runFight, spawn, reportRaces, setLevel, gearForLevel, playerAI };
