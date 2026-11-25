/* ============================================================
   Aventurs — Pruebas contra jefes (v3.10)

   Cada jefe contra un guerrero (orco), un híbrido (humano) y un mago (gnomo)
   del nivel del jefe y de dos niveles más, solos. Mismas semillas en cada corrida.

   Uso:  node tools/jefes.js [--peleas=60] [--guardar=x.json] [--comparar=x.json]
   ============================================================ */
'use strict';
const fs = require('fs');
const S = require('./simulador.js');
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] == null ? true : m[2]] : [a, true]; }));
const PELEAS = +(args.peleas || 60);
const G = S.createGame(); const { A } = G;
if (args.boss) { const [hp, dmg, rage] = String(args.boss).split(',').map(Number); Object.assign(A.Balance.BOSS, { hp, dmg, rage }); } // --boss=1.15,1.05,1.2
const RAZAS = ['orco', 'humano', 'gnomo'];
const out = [];
const antes = args.comparar ? JSON.parse(fs.readFileSync(args.comparar, 'utf8')) : null;
const SOLO = args.jefes ? String(args.jefes).split(',') : null; // --jefes=kyubi,kraken
for (const b of A.Data.enemies.filter((e) => e.category === 'boss' && (!SOLO || SOLO.includes(e.id))).sort((x, y) => x.tier - y.tier)) {
  const row = { id: b.id, tier: b.tier, res: {} };
  for (const plus of [0, 2]) {
    const lvl = Math.min(10, b.tier + plus);
    for (const r of RAZAS) {
      let win = 0, rounds = 0;
      for (let k = 0; k < PELEAS; k++) {
        G.GameMath.random = mulberry32((k + 1) * 7919 + b.tier * 31 + plus);
        S.newCharacter(G, r, { level: lvl });
        A.Combat.start({ enemies: [S.spawn(G, b.id)] });
        let s = 0;
        while (s++ < 3000) { G.drain(); const c = A.State.combat; if (!c || c.result) break; const cur = c.initiative[c.currentActorIdx]; if (!cur || cur.kind !== 'player') continue; S.playerAI(G); }
        const c = A.State.combat;
        if (c && c.result === 'victory') win++;
        rounds += c ? c.round : 0;
        if (c) A.Combat.finish();
      }
      row.res[`${r}+${plus}`] = { gana: win / PELEAS, rondas: rounds / PELEAS };
    }
  }
  out.push(row);
  const a = antes && antes.find((x) => x.id === b.id);
  const cel = (k) => { const v = Math.round(row.res[k].gana * 100); const d = a && a.res[k] ? v - Math.round(a.res[k].gana * 100) : null; return `${String(v).padStart(3)}${d ? `(${d > 0 ? '+' : ''}${d})` : ''}`.padEnd(9); };
  console.log(`${b.name.padEnd(24)} nv${String(b.tier).padStart(2)}  mismo nivel: ${RAZAS.map((r) => cel(`${r}+0`)).join(' ')}  +2 niveles: ${RAZAS.map((r) => cel(`${r}+2`)).join(' ')}`);
}
if (args.guardar) fs.writeFileSync(args.guardar, JSON.stringify(out, null, 1));
