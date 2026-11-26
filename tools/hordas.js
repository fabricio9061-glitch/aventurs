/* ============================================================
   Aventurs — Pruebas contra grupos (hordas) por raza (v3.9)

   Mide cada raza contra 1, 3, 5 y 8 criaturas iguales, en los niveles 1, 5 y 10.
   Igual que tools/equilibrio.js: carga el código REAL del juego (simulador.js),
   y cada pelea arranca con su propia semilla (la misma en cada corrida), así
   comparar antes y después muestra el efecto del cambio y no la suerte.

   Uso (desde la carpeta del proyecto):
     node tools/hordas.js                          -> las 18 razas
     node tools/hordas.js --razas=vampiro,orco     -> solo esas
     node tools/hordas.js --peleas=100             -> peleas por prueba (300 por defecto)
     node tools/hordas.js --guardar=antes.json     -> guarda los resultados
     node tools/hordas.js --comparar=antes.json    -> muestra cuánto cambió

   Pruebas (nivel del personaje · cuántas criaturas · de qué nivel):
     n1x1  nivel 1 · 1 · criaturas de nivel 2-3      n1x3  nivel 1 · 3 · nivel 1-2
     n5x1  nivel 5 · 1 · nivel 7-8                   n5x3  nivel 5 · 3 · nivel 4-5
     n5x5  nivel 5 · 5 · nivel 3-4                   n5x8  nivel 5 · 8 · nivel 1-2
     n10x1 nivel 10 · 1 · nivel 8-9                  n10x3 nivel 10 · 3 · nivel 7-8
     n10x5 nivel 10 · 5 · nivel 6-7                  n10x8 nivel 10 · 8 · nivel 4-5
   (Más difíciles que el juego normal a propósito: así se ve qué raza aguanta más.)
   Sin pociones, mascota ni accesorios; con el mejor equipo común del nivel. Sin jefes.

   Por raza y prueba: % de victorias, rondas promedio, vida que queda al ganar,
   veces por pelea que se nota la pasiva y que se usa el hechizo de nacimiento.
   ============================================================ */
'use strict';
const fs = require('fs');
const S = require('./simulador.js');

const PRUEBAS = [
  { id: 'n1x1', nivel: 1, n: 1, tiers: [2, 3] },
  { id: 'n1x3', nivel: 1, n: 3, tiers: [1, 2] },
  { id: 'n5x1', nivel: 5, n: 1, tiers: [7, 8] },
  { id: 'n5x3', nivel: 5, n: 3, tiers: [4, 5] },
  { id: 'n5x5', nivel: 5, n: 5, tiers: [3, 4] },
  { id: 'n5x8', nivel: 5, n: 8, tiers: [1, 2] },
  { id: 'n10x1', nivel: 10, n: 1, tiers: [8, 9] },
  { id: 'n10x3', nivel: 10, n: 3, tiers: [7, 8] },
  { id: 'n10x5', nivel: 10, n: 5, tiers: [6, 7] },
  { id: 'n10x8', nivel: 10, n: 8, tiers: [4, 5] },
  // v3.11: el tope subió a 20
  { id: 'n15x3', nivel: 15, n: 3, tiers: [12, 13] },
  { id: 'n15x5', nivel: 15, n: 5, tiers: [11, 12] },
  { id: 'n20x3', nivel: 20, n: 3, tiers: [17, 18] },
  { id: 'n20x5', nivel: 20, n: 5, tiers: [15, 16] },
  // v3.12: el tope subió a 25
  { id: 'n25x3', nivel: 25, n: 3, tiers: [22, 23] },
  { id: 'n25x5', nivel: 25, n: 5, tiers: [20, 21] },
];
const CLASES = { warrior: 'guerrero', hybrid: 'híbrido', mage: 'mago' };

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function semilla(prueba, n) {
  let h = 2166136261;
  for (const ch of prueba) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h ^ Math.imul(n + 1, 2654435761)) >>> 0;
}

function medir({ razas = null, peleas = 300, preparar = null, alTerminar = null } = {}) {
  const G = S.createGame();
  const { A } = G;
  if (preparar) preparar(G);
  const porNivel = {};
  for (const e of A.Data.enemies) if (e.category !== 'boss' && (e.regions || []).length) (porNivel[e.tier] = porNivel[e.tier] || []).push(e);
  const filas = [];
  for (const r of A.Data.races) {
    if (razas && !razas.includes(r.id)) continue;
    const x = { id: r.id, name: r.name, cls: r.combatType, pruebas: {} };
    for (const pr of PRUEBAS) {
      const lista = pr.tiers.flatMap((t) => porNivel[t] || []);
      let gan = 0, rondas = 0, vida = 0, pas = 0, nac = 0;
      for (let k = 0; k < peleas; k++) {
        const s = semilla(pr.id, k);
        G.GameMath.random = mulberry32(s);
        const elegir = mulberry32(s ^ 0x9E3779B9);
        const e = lista[Math.floor(elegir() * lista.length)];
        S.newCharacter(G, r.id, { level: pr.nivel, noItems: true });
        // la pelea, mirando la crónica para contar la pasiva y el hechizo de nacimiento
        const enemies = Array(pr.n).fill(e.id).map((id) => S.spawn(G, id));
        A.Combat.start({ enemies });
        let safety = 0;
        while (safety++ < 3000) {
          G.drain();
          const c = A.State.combat;
          if (!c || c.result) break;
          const cur = c.initiative[c.currentActorIdx];
          if (!cur || cur.kind !== 'player') { G.drain(); continue; }
          S.playerAI(G);
        }
        const c = A.State.combat;
        const p = A.State.player;
        if (c && c.result === 'victory') { gan++; vida += p.hp / p.maxHp; }
        rondas += c ? c.round : 0;
        for (const en of (c && c.log) || []) {
          const pid = en.passive || (en.fx && en.fx.passive);
          if (pid && pid === r.passive) pas++;
          if (r.startSpell && en.spellId === r.startSpell && !(en.fx && en.fx.chain)) nac++;
        }
        if (c) A.Combat.finish();
      }
      x.pruebas[pr.id] = { gana: gan / peleas, rondas: rondas / peleas, vida: gan ? vida / gan : 0, pasiva: pas / peleas, nacimiento: nac / peleas };
    }
    filas.push(x);
    if (alTerminar) alTerminar(x);
  }
  return filas;
}

function leerArgs(argv) {
  const o = {};
  for (const a of argv) { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); if (m) o[m[1]] = m[2] == null ? true : m[2]; }
  return o;
}
const pct = (v) => (v == null ? '  - ' : String(Math.round(v * 100)).padStart(4));
function principal() {
  const args = leerArgs(process.argv.slice(2));
  const razas = args.razas ? String(args.razas).split(',') : null;
  const peleas = args.peleas ? parseInt(args.peleas, 10) : 300;
  const antes = args.comparar ? JSON.parse(fs.readFileSync(args.comparar, 'utf8')) : null;
  const t0 = Date.now();
  console.log(`Aventurs · contra grupos (${peleas} peleas por prueba). % de victorias${antes ? ' (entre paréntesis, el cambio)' : ''}.`);
  console.log('Raza         Clase     ' + PRUEBAS.map((p) => p.id.padStart(7)).join('') + '   rondas n10x8 · pasiva/pelea n5x5');
  const filas = medir({
    razas, peleas,
    alTerminar: (x) => {
      const a = antes && antes.find((y) => y.id === x.id);
      const cel = (id) => {
        const v = x.pruebas[id].gana;
        if (!a || !a.pruebas[id]) return pct(v).padStart(7);
        const d = Math.round((v - a.pruebas[id].gana) * 100);
        return `${pct(v)}${d ? `(${d > 0 ? '+' : ''}${d})` : ''}`.padStart(7);
      };
      console.log(`${x.name.padEnd(12)} ${(CLASES[x.cls] || x.cls).padEnd(9)} ${PRUEBAS.map((p) => cel(p.id)).join('')}   ${x.pruebas.n10x8.rondas.toFixed(1).padStart(5)} · ${x.pruebas.n5x5.pasiva.toFixed(2)}`);
    },
  });
  // promedios por clase
  for (const cls of ['warrior', 'hybrid', 'mage']) {
    const fs2 = filas.filter((f) => f.cls === cls);
    if (!fs2.length) continue;
    const prom = (id) => fs2.reduce((s, f) => s + f.pruebas[id].gana, 0) / fs2.length;
    console.log(`${'Promedio'.padEnd(12)} ${CLASES[cls].padEnd(9)} ${PRUEBAS.map((p) => pct(prom(p.id)).padStart(7)).join('')}`);
  }
  console.log(`Tardó ${Math.round((Date.now() - t0) / 1000)} segundos.`);
  if (args.guardar) { fs.writeFileSync(args.guardar, JSON.stringify(filas, null, 1)); console.log('Guardado en ' + args.guardar); }
}
if (require.main === module) principal();
module.exports = { medir, PRUEBAS };
