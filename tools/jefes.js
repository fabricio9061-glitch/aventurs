/* ============================================================
   Aventurs — Pruebas contra jefes (v3.10; v3.11: hasta el nivel 20 y en su guarida)

   Cada jefe contra un guerrero (orco), un híbrido (humano) y un mago (gnomo)
   del nivel del jefe y de dos niveles más, solos. Mismas semillas en cada corrida.

   Uso:  node tools/jefes.js [--peleas=60] [--guardar=x.json] [--comparar=x.json]
         node tools/jefes.js --datos     -> además escribe js/data/seed-jefes-medidos.js
                                            (lo muestra el editor en la prueba de combate de cada jefe)
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
    const lvl = Math.min(A.Progression.MAX_LEVEL || 20, b.tier + plus); // v3.11: hasta el 20
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

// v3.11: lo medido, para el editor (con la "firma" de los números del jefe: si los cambiás, el editor avisa)
if (args.datos) {
  const firma = (d) => [d.health, d.damage, d.attack, d.difficulty, d.armor, d.tier].join('|');
  const pc = (x) => Math.round(x * 100);
  const datos = Object.assign({}, (A.Seed && A.Seed.jefesMedidos) || {}); // se suman a los que ya estaban
  for (const id of Object.keys(datos)) { const d = A.Data.getById('enemies', id); if (!d || d.category !== 'boss') delete datos[id]; } // v3.12: los que dejaron de ser jefes
  for (const row of out) {
    const d = A.Data.getById('enemies', row.id);
    datos[row.id] = {
      firma: firma(d), peleas: PELEAS,
      nivel: RAZAS.map((r) => pc(row.res[`${r}+0`].gana)),
      mas2: RAZAS.map((r) => pc(row.res[`${r}+2`].gana)),
      nivelMas2: Math.min(A.Progression.MAX_LEVEL || 20, row.tier + 2),
    };
  }
  const file = require('path').join(__dirname, '..', 'js', 'data', 'seed-jefes-medidos.js');
  const txt = `/* Aventurs — jefes medidos con el motor del juego (node tools/jefes.js --datos).
   % de peleas que gana un orco (guerrero), un humano (híbrido) y un gnomo (mago), solos,
   del nivel del jefe y de dos niveles más. Lo muestra el editor en la prueba de combate.
   Generado: ${new Date().toISOString().slice(0, 10)}. */
(function (A) {
  'use strict';
  A.Seed = A.Seed || {};
  A.Seed.jefesMedidos = ${JSON.stringify(datos, null, 1).replace(/\n\s*/g, ' ')};
})(window.Aventurs);
`;
  fs.writeFileSync(file, txt);
  console.log('Datos para el editor: ' + file);
}
