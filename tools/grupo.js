/* ============================================================
   Aventurs — Simulador de grupo (v3.11, del dossier de razas)

   Pelea con 2 a 4 héroes juntos, con las mismas reglas que el juego
   en grupo (el motor de combate de verdad, sin la red): cada héroe
   juega con la IA del simulador en su turno. Sirve para medir lo que
   solo pasa en grupo: la Bendición del ángel que protege al más
   herido, el Rugido y el Aullido que ayudan a los compañeros, el lobo,
   y lo que suben los jefes y los grupos de criaturas cuando son más.

   Uso:
     node tools/grupo.js --heroes=enano,angel --jefes=kyubi,kraken [--peleas=40] [--mas=0,2]
     node tools/grupo.js --heroes=orco,humano,gnomo,angel --criaturas=lobo_bruma*3 --nivel=11
   Escribe el % de victorias del grupo (y cuántos quedan en pie).
   ============================================================ */
'use strict';
const S = require('./simulador.js');

function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Arma un grupo de héroes del nivel pedido y deja el juego "en grupo" (sin red). */
function armarGrupo(G, razas, nivel) {
  const { A } = G;
  const heroes = razas.map((r, i) => {
    const h = S.newCharacter(G, r, { level: nivel, noItems: true });
    h._hid = `h${i + 1}`;
    h.name = `${h.name} ${i + 1}`;
    return h;
  });
  A.State.player = heroes[0];
  A.State.party = { localHid: 'h1', heroes: Object.fromEntries(heroes.map((h) => [h._hid, h])), order: heroes.map((h) => h._hid) };
  A.Party = A.Party || {};
  A.Party.combatHeroes = () => (heroes.length > 1 ? heroes : null);
  return heroes;
}

/** Una pelea del grupo contra unas instancias. Devuelve { win, rondas, enPie }. */
function pelear(G, heroes, instancias, extra = {}) {
  const { A } = G;
  A.Combat.start(Object.assign({ enemies: instancias }, extra));
  let s = 0;
  while (s++ < 6000) {
    G.drain();
    const c = A.State.combat;
    if (!c || c.result) break;
    const cur = c.initiative[c.currentActorIdx];
    if (!cur || cur.kind !== 'player') continue;
    const h = A.State.heroById(cur.hid) || heroes[0];
    A.State.withHero(h, () => S.playerAI(G));
  }
  const c = A.State.combat;
  const out = { win: !!(c && c.result === 'victory'), rondas: c ? c.round : 0, enPie: heroes.filter((h) => h.hp > 0).length };
  if (c) A.Combat.finish();
  return out;
}

function principal() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] == null ? true : m[2]] : [a, true]; }));
  const G = S.createGame();
  const { A } = G;
  const razas = String(args.heroes || 'enano,angel').split(',');
  const peleas = +(args.peleas || 40);
  const filas = [];
  if (args.criaturas) {
    // --criaturas=lobo_bruma*3,gigante_niebla
    const lista = String(args.criaturas).split(',').flatMap((x) => { const [id, n] = x.split('*'); return Array(+(n || 1)).fill(id); });
    const nivel = +(args.nivel || 10);
    let gana = 0, pie = 0, rondas = 0;
    for (let k = 0; k < peleas; k++) {
      G.GameMath.random = mulberry32((k + 1) * 104729 + nivel);
      const heroes = armarGrupo(G, razas, nivel);
      let inst = lista.map((id) => S.spawn(G, id));
      if (A.Combat.prepareGroup) inst = A.Combat.prepareGroup(inst);
      const r = pelear(G, heroes, inst);
      if (r.win) { gana++; pie += r.enPie; }
      rondas += r.rondas;
    }
    console.log(`${razas.join('+')} (nv ${nivel}) contra ${lista.join(', ')}: gana ${Math.round(gana / peleas * 100)}% · quedan en pie ${gana ? (pie / gana).toFixed(1) : '-'} de ${razas.length} · ${(rondas / peleas).toFixed(1)} rondas`);
    return;
  }
  const jefes = args.jefes ? String(args.jefes).split(',') : A.Data.enemies.filter((e) => e.category === 'boss').map((e) => e.id);
  const mas = String(args.mas || '0,2').split(',').map(Number);
  for (const id of jefes) {
    const b = A.Data.getById('enemies', id);
    if (!b) continue;
    const res = [];
    for (const plus of mas) {
      const nivel = Math.min(A.Progression.MAX_LEVEL, (b.tier || 1) + plus);
      let gana = 0, pie = 0;
      for (let k = 0; k < peleas; k++) {
        G.GameMath.random = mulberry32((k + 1) * 7919 + b.tier * 31 + plus + razas.length * 101);
        const heroes = armarGrupo(G, razas, nivel);
        let inst = [S.spawn(G, b.id)];
        if (A.Combat.prepareGroup) inst = A.Combat.prepareGroup(inst);
        const r = pelear(G, heroes, inst);
        if (r.win) { gana++; pie += r.enPie; }
      }
      res.push(`${plus ? `+${plus}` : 'mismo nivel'}: ${String(Math.round(gana / peleas * 100)).padStart(3)}% (en pie ${gana ? (pie / gana).toFixed(1) : '-'})`);
    }
    filas.push({ id, res });
    console.log(`${b.name.padEnd(24)} nv${String(b.tier).padStart(2)}  ${razas.join('+')}  ${res.join('   ')}`);
  }
}

if (require.main === module) principal();
module.exports = { armarGrupo, pelear };
