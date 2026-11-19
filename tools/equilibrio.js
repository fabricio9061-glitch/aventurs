/* ============================================================
   Aventurs — Pruebas de equilibrio (Node.js, no se carga en el juego)

   Usa el simulador (tools/simulador.js), que carga el código REAL del
   juego, y mide qué parte de las rachas gana cada raza en seis pruebas.
   Cada racha arranca con su propia semilla, siempre la misma: dos
   corridas (antes y después de un cambio) ven las mismas criaturas y
   arrancan con las mismas tiradas, así la diferencia es el cambio y no
   la suerte.

   Uso (desde la carpeta del proyecto):
     node tools/equilibrio.js                        -> las 18 razas (tarda unos minutos)
     node tools/equilibrio.js --rapido               -> la cuarta parte de las rachas
     node tools/equilibrio.js --razas=robot,enano    -> solo esas razas
     node tools/equilibrio.js --guardar=antes.json   -> guarda los resultados en un archivo
     node tools/equilibrio.js --comparar=antes.json  -> muestra cuánto cambió cada número

   Las seis pruebas:
     1v1   1 contra 1 al nivel 1: 20 peleas contra cada criatura de nivel 1 y 2
     nv1   5 peleas seguidas al nivel 1 contra criaturas de nivel 1 y 2 (1.000 rachas)
     nv3   5 peleas seguidas al nivel 3, criaturas de nivel 3 y 4 (1.000 rachas)
     nv6   5 peleas seguidas al nivel 6, criaturas de nivel 5 y 6 (2.000 rachas)
     par   3 peleas al nivel 6, cada una contra 2 criaturas iguales de nivel 5 y 6 (1.000)
     nv10  5 peleas seguidas al nivel 10, criaturas de nivel 9 y 10 (1.000 rachas)
   Sin descanso, pociones, mascota ni accesorios; con el mejor equipo común
   del nivel y todos los hechizos que la clase aprende hasta ahí. Sin jefes.

   Metas (las mismas del documento de equilibrio):
     - La mejor y la peor clase no se separan más de 10 puntos en nv6 y nv10,
       ni más de 15 en nv3 y par.
     - Ninguna raza queda más de 8 puntos por debajo del promedio de su clase.
     - En 1 contra 1, todas ganan al menos el 88%.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const S = require('./simulador.js');

const PRUEBAS = ['d1', 'r1', 'r3', 'r6', 'p6', 'r10'];
const NOMBRE = { d1: '1v1', r1: 'nv1', r3: 'nv3', r6: 'nv6', p6: 'par', r10: 'nv10' };
const CLASES = { warrior: 'guerrero', hybrid: 'híbrido', mage: 'mago' };

// ---------- Azar con semilla ----------
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

/**
 * Mide las razas pedidas. Devuelve [{ id, name, cls, d1, r1, r3, r6, p6, r10 }] con valores de 0 a 1.
 * `preparar(G)` (opcional) cambia el juego antes de medir, para probar una idea sin tocar el código.
 */
function medir({ razas = null, escala = 1, preparar = null, alTerminarRaza = null } = {}) {
  const G = S.createGame();
  const { A } = G;
  if (preparar) preparar(G);

  // Las tiradas del juego usan el Math de adentro del juego; las criaturas de cada racha, otro
  // azar aparte: así el orden de las criaturas es el mismo aunque una pelea dure distinto.
  function fijarAzar(prueba, n) {
    const s = semilla(prueba, n);
    G.GameMath.random = mulberry32(s);
    return mulberry32(s ^ 0x9E3779B9);
  }

  const porNivel = {};
  for (const e of A.Data.enemies) (porNivel[e.tier] = porNivel[e.tier] || []).push(e);
  const criaturas = (niveles) => niveles.flatMap((t) => (porNivel[t] || []).filter((e) => e.category !== 'boss'));

  function racha(prueba, raza, nivel, niveles, cuantas, rachas, largo) {
    const lista = criaturas(niveles);
    let ganadas = 0;
    for (let n = 0; n < rachas; n++) {
      const elegir = fijarAzar(prueba, n);
      S.newCharacter(G, raza, { level: nivel, noItems: true });
      let f = 0;
      for (; f < largo; f++) {
        const e = lista[Math.floor(elegir() * lista.length)];
        if (S.runFight(G, Array(cuantas).fill(e.id)).result !== 'victory') break;
      }
      if (f === largo) ganadas++;
    }
    return ganadas / rachas;
  }

  function duelo(raza, nivel, niveles, peleas) {
    let ganadas = 0, total = 0, n = 0;
    for (const e of criaturas(niveles)) {
      for (let k = 0; k < peleas; k++) {
        fijarAzar('d1', n++);
        S.newCharacter(G, raza, { level: nivel, noItems: true });
        total++;
        if (S.runFight(G, [e.id]).result === 'victory') ganadas++;
      }
    }
    return total ? ganadas / total : 0;
  }

  const cant = (n) => Math.max(50, Math.round(n * escala));
  const filas = [];
  for (const r of A.Data.races) {
    if (razas && !razas.includes(r.id)) continue;
    const x = { id: r.id, name: r.name, cls: r.combatType };
    x.d1 = duelo(r.id, 1, [1, 2], Math.max(5, Math.round(20 * escala)));
    x.r1 = racha('r1', r.id, 1, [1, 2], 1, cant(1000), 5);
    x.r3 = racha('r3', r.id, 3, [3, 4], 1, cant(1000), 5);
    x.r6 = racha('r6', r.id, 6, [5, 6], 1, cant(2000), 5);
    x.p6 = racha('p6', r.id, 6, [5, 6], 2, cant(1000), 3);
    x.r10 = racha('r10', r.id, 10, [9, 10], 1, cant(1000), 5);
    filas.push(x);
    if (alTerminarRaza) alTerminarRaza(x);
  }
  return filas;
}

/** Promedio de cada clase en cada prueba. */
function promedios(filas) {
  const out = {};
  for (const c of Object.keys(CLASES)) {
    const g = filas.filter((r) => r.cls === c);
    if (!g.length) continue;
    out[c] = {};
    for (const k of PRUEBAS) out[c][k] = g.reduce((s, r) => s + r[k], 0) / g.length;
  }
  return out;
}

/**
 * Revisa las metas. Devuelve una lista de { ok, texto }.
 * Las metas de clase (distancias y "abajo de su clase") solo valen con todas las razas:
 * con menos, el promedio no representa a la clase. Para eso, `deClase: false`.
 */
function revisar(filas, { deClase = true } = {}) {
  const prom = promedios(filas);
  const res = [];
  const clases = Object.keys(prom);
  if (deClase && clases.length > 1) {
    const topes = { r3: 15, r6: 10, p6: 15, r10: 10 };
    for (const k of Object.keys(topes)) {
      const v = clases.map((c) => prom[c][k]);
      const dist = Math.round((Math.max(...v) - Math.min(...v)) * 100);
      res.push({ ok: dist <= topes[k], texto: `distancia entre clases en ${NOMBRE[k]}: ${dist} puntos (máximo ${topes[k]})` });
    }
  }
  if (deClase) {
    const abajo = [];
    for (const r of filas) {
      const g = filas.filter((x) => x.cls === r.cls);
      if (g.length < 2) continue;
      for (const k of PRUEBAS) {
        const d = Math.round((r[k] - prom[r.cls][k]) * 100);
        if (d < -8) abajo.push(`${r.name} en ${NOMBRE[k]} (${d})`);
      }
    }
    res.push({ ok: !abajo.length, texto: abajo.length ? `más de 8 puntos abajo de su clase: ${abajo.join(', ')}` : 'ninguna raza queda más de 8 puntos abajo de su clase' });
  }
  const flojas = filas.filter((r) => r.d1 < 0.88).map((r) => `${r.name} (${Math.round(r.d1 * 100)}%)`);
  res.push({ ok: !flojas.length, texto: flojas.length ? `ganan menos del 88% en 1 contra 1: ${flojas.join(', ')}` : 'todas ganan al menos el 88% en 1 contra 1' });
  return res;
}

// ---------- Texto para la consola ----------
const pc = (v) => Math.round(v * 100);
function celda(v, antes) {
  const n = String(pc(v)).padStart(3);
  if (antes == null) return n.padStart(5);
  const d = pc(v) - pc(antes);
  const ds = d === 0 ? '  =' : (d > 0 ? '+' : '') + d;
  return `${n}${('(' + ds.trim() + ')').padStart(5)}`;
}
function linea(nombre, clase, x, antes) {
  return `${nombre.padEnd(12)} ${clase.padEnd(9)} ` + PRUEBAS.map((k) => celda(x[k], antes ? antes[k] : null)).join(' ');
}
function encabezado(comparando) {
  const ancho = comparando ? 8 : 5;
  return `${'Raza'.padEnd(12)} ${'Clase'.padEnd(9)} ` + PRUEBAS.map((k) => NOMBRE[k].padStart(ancho)).join(' ');
}

function leerArgs(argv) {
  const o = {};
  for (const a of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) o[m[1]] = m[2] === undefined ? true : m[2];
  }
  return o;
}

function principal() {
  const args = leerArgs(process.argv.slice(2));
  const escala = args.escala ? Number(args.escala) : (args.rapido ? 0.25 : 1);
  const razas = args.razas ? String(args.razas).split(',').map((s) => s.trim()).filter(Boolean) : null;
  let previo = null;
  if (args.comparar) {
    previo = JSON.parse(fs.readFileSync(path.resolve(String(args.comparar)), 'utf8'));
  }
  const antesDe = (id) => (previo ? (previo.filas || []).find((r) => r.id === id) : null);

  console.log(`Aventurs · pruebas de equilibrio (escala ${escala}: ${Math.round(2000 * escala)} rachas al nivel 6, ${Math.round(1000 * escala)} en las demás)`);
  if (previo) console.log(`Comparando con ${args.comparar}: entre paréntesis, cuánto cambió cada número.`);
  console.log('Los números son el porcentaje de rachas (o de peleas, en 1v1) que gana cada raza.\n');
  console.log(encabezado(!!previo));
  const t0 = Date.now();
  const filas = medir({
    razas,
    escala,
    alTerminarRaza: (x) => console.log(linea(x.name, CLASES[x.cls] || x.cls, x, antesDe(x.id))),
  });
  if (!filas.length) { console.log('No encontré esas razas. Fijate los nombres (por ejemplo: robot, enano, gnomo).'); return; }

  console.log('');
  const prom = promedios(filas);
  const promPrevio = previo ? promedios(previo.filas || []) : null;
  for (const c of Object.keys(prom)) {
    const ant = promPrevio && promPrevio[c] ? promPrevio[c] : null;
    console.log(linea('Promedio', CLASES[c], prom[c], ant));
  }
  console.log('');
  const todas = !razas;
  for (const r of revisar(filas, { deClase: todas })) console.log(`${r.ok ? '  ok   ' : '  FALLA'} ${r.texto}`);
  if (!todas) console.log('  (las metas de cada clase se revisan solo con todas las razas: sin --razas)');
  if (escala < 1) console.log(`  (con menos rachas el azar pesa más: cada número puede moverse unos ${escala <= 0.25 ? 4 : 3} puntos)`);
  console.log(`\nTardó ${Math.round((Date.now() - t0) / 1000)} segundos.`);

  if (args.guardar) {
    const archivo = path.resolve(String(args.guardar));
    fs.writeFileSync(archivo, JSON.stringify({ fecha: new Date().toISOString(), escala, filas }, null, 1));
    console.log(`Guardado en ${archivo}`);
  }
}

if (require.main === module) principal();

module.exports = { medir, promedios, revisar, PRUEBAS, NOMBRE, CLASES };
