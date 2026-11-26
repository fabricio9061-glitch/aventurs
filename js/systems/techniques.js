/* ============================================================
   Aventurs — Técnicas de nacimiento de los guerreros (v3.10)

   Del dossier de razas: cada raza guerrera trae una técnica propia, una vez por
   pelea, con un botón en el combate. Los números crecen por tramo de nivel
   (1-4 · 5-8 · 9-12 · 13-16 · 17-20). La pelea la ejecuta combat.js (playerTechnique).
   Medido con tools/hordas.js: era lo que faltaba para que los guerreros
   no quedaran 30 puntos abajo de los magos contra grupos.
   ============================================================ */
(function (A) {
  'use strict';
  const band = (p) => (A.Passives && A.Passives.band ? A.Passives.band(p) : 0);
  const DICE = ['1d4', '1d6', '1d8', '1d10', '2d6'];

  const TECH = {
    enano: {
      id: 'guardia_piedra', name: 'Guardia de piedra', icon: 'shield',
      text: (b) => `Te plantás como una roca: +${[2, 3, 4, 5, 6][b]} de armadura por 2 rondas. No gasta tu ataque: pegás igual.`,
      buff: (b) => ({ armor: [2, 3, 4, 5, 6][b] }), turns: 2, free: true,
      say: 'Clavás los pies en el suelo y levantás la guardia: sos una roca.',
    },
    orco: {
      id: 'rugido_guerra', name: 'Rugido de guerra', icon: 'warning',
      text: (b) => `Un rugido que te enciende: +${[1, 2, 3, 4, 5][b]} de daño por 2 rondas (en grupo, tus compañeros +1). No gasta tu ataque.`,
      buff: (b) => ({ damage: [1, 2, 3, 4, 5][b] }), turns: 2, allies: { damage: 1 }, free: true,
      say: 'Soltás un rugido de guerra que hace temblar a tus enemigos.',
    },
    licantropo: {
      id: 'aullido_manada', name: 'Aullido de manada', icon: 'paw',
      // v3.11 (dossier): además llama a un lobo que pelea a tu lado (no es tu mascota: se va al terminar)
      // (medido: con el lobo Y el ataque en el mismo turno subía 10 a 20 puntos; sin el ataque queda parejo, como pedía el dossier)
      text: (b) => `Aullás a la luna: +1 de precisión${[0, 0, 1, 1, 2][b] ? ` y +${[0, 0, 1, 1, 2][b]} de daño` : ''} por 2 rondas (en grupo, tus compañeros también +1 de precisión), y un lobo de la manada pelea a tu lado: ${WOLF.hp[b]} de vida, ${WOLF.dmg[b]} de daño, ${WOLF.attacks[b]} ataques desde la ronda siguiente.${TECH.licantropo.free ? ' No gasta tu ataque.' : ' Ese turno no atacás.'}`,
      buff: (b) => ({ precision: 1, damage: [0, 0, 1, 1, 2][b] }), turns: 2, allies: { precision: 1 }, free: false,
      wolf: null, // se completa abajo
      say: 'Aullás a la luna y la manada que llevás adentro te responde.',
    },
    robot: {
      id: 'pulso_interferencia', name: 'Pulso de interferencia', icon: 'spark',
      text: (b) => `Una descarga a todos los enemigos: ${DICE[b]} de daño a cada uno, y quedan encandilados (pegan peor) 2 rondas.`,
      area: { dice: (b) => DICE[b], status: 'blind', turns: 2 },
      say: 'Tu núcleo suelta un pulso que llena el aire de chispas.',
    },
    goliat: {
      id: 'barrido_colosal', name: 'Barrido colosal', icon: 'swords',
      text: () => 'Un golpe con tu arma que alcanza a todos los enemigos (cada uno con su tirada), con el 70% del daño. Si hay uno solo, le pega un 30% más fuerte.',
      sweep: 0.7, sweepSolo: 1.3,
      say: 'Girás con el arma bien abierta y barrés todo lo que tenés enfrente.',
    },
    minotauro: {
      id: 'cornada_brutal', name: 'Cornada brutal', icon: 'swords',
      text: () => 'Una cornada con el 50% más de daño y +1 de precisión; si pega, lo voltea un turno (le cuesta defenderse). No se suma a tu Embestida.',
      gore: { mult: 1.5, prec: 1, status: 'prone', turns: 1 },
      say: 'Bajás la cabeza y cargás con toda tu fuerza.',
    },
  };

  // v3.11: el lobo del Aullido (dossier: 6/10/14 de vida, 1d4 / 1d4+1 / 1d6+1, 2/3/3 ataques).
  // Precisión +2 y defensa 10, más un tercio y la mitad del nivel del licántropo.
  const WOLF = { hp: [6, 10, 14, 18, 22], dmg: ['1d4', '1d4+1', '1d6+1', '1d8+1', '1d8+3'], attacks: [2, 3, 3, 3, 4], prec: 2, def: 10 };
  TECH.licantropo.wolf = WOLF;

  // ---------------------------------------------------------------
  // v3.13 (dossier, sección 9): las disciplinas de los guerreros. Dos técnicas más por raza
  // (niveles 5 y 9) que se aprenden con su maestro. No gastan maná, ocupan tu ataque del turno
  // y tienen espera (en turnos tuyos). Nunca se suman al Golpe fuerte (son otra acción).
  // Lo que hacen (lo ejecuta combat.js, playerDiscipline):
  //   strike { mult, prec, vsStatus: { types, mult } }  un golpe con tu arma a tu blanco
  //   double { mult, n }        varios golpes seguidos (si el blanco cae, siguen con otro)
  //   sweep { mult, status }    un golpe a cada enemigo (cada uno con su tirada)
  //   random { hits, mult, status }  golpes a enemigos al azar
  //   cleave { mult }           además, un golpe a otro enemigo
  //   splash { mult, status }   además, un golpe a cada uno de los demás (no a tu blanco)
  //   chase { mult }            si tu blanco cae, saltás sobre otro
  //   buff { turns, mods(b), allies }  una mejora para vos (y tus compañeros)
  //   foes { status, value(b), turns }  un estado a todos los enemigos
  //   bleed { value(b), turns } y mark { prec, turns }  sobre tu blanco, si le pegaste
  //   ai: cuándo la usa el simulador ('always' apenas está lista, 'area2' con 2 o más enemigos)
  // ---------------------------------------------------------------
  const MUR = [2, 3, 3, 4, 5];
  const CLAMOR = [2, 2, 3, 3, 4];
  const ZAP = [2, 3, 4, 5, 6];
  const PREY = [1, 2, 2, 3, 3];
  const HUNT = [2, 2, 3, 3, 4];
  const pct = (x) => `${Math.round(x * 100)}%`;
  const DISC = {
    enano: [
      { id: 'muralla_piedra', rank: 5, name: 'Muralla de piedra', icon: 'shield', cd: 4, ai: 'always',
        strike: { mult: 1 }, buff: { turns: 2, mods: (b) => ({ armor: MUR[b] }), allies: { armor: 1 } },
        text: (b) => `Pegás con la guardia alta: un golpe normal y, por 2 rondas, +${MUR[b]} de armadura (en grupo, tus compañeros +1).`,
        say: 'Levantás la guardia y avanzás como una pared de piedra.' },
      { id: 'fortaleza_ancestral', rank: 9, name: 'Fortaleza ancestral', icon: 'crown', cd: 6, ai: 'always',
        strike: { mult: 1 }, buff: { turns: 2, mods: () => ({ dmgTaken: 0.3 }) },
        text: () => 'Un golpe y te volvés una fortaleza: por 2 rondas, todo el daño que recibís baja un 30%.',
        say: 'Te plantás como una fortaleza de tus ancestros: nada te mueve.' },
    ],
    orco: [
      { id: 'clamor_salvaje', rank: 5, name: 'Clamor salvaje', icon: 'warning', cd: 4, ai: 'always',
        strike: { mult: 1.2 }, foes: { status: 'stagger', value: (b) => CLAMOR[b], turns: 2 },
        text: (b) => `Un grito salvaje y un golpe al ${pct(1.2)}: todos los enemigos quedan desequilibrados (−${CLAMOR[b]} de precisión en su próximo ataque).`,
        say: 'Soltás un clamor salvaje que hace temblar las piernas de tus enemigos.' },
      { id: 'horda_imparable', rank: 9, name: 'Horda imparable', icon: 'swords', cd: 5, ai: 'always',
        double: { n: 2, mult: 1 },
        text: () => 'Dos golpes seguidos, cada uno con su tirada y con todo tu daño. Si el primero tumba a tu blanco, el segundo va a otro.',
        say: 'Atacás como una horda entera: un golpe, y otro, sin respirar.' },
    ],
    robot: [
      { id: 'campo_electromagnetico', rank: 5, name: 'Campo electromagnético', icon: 'spark', cd: 5, ai: 'always',
        strike: { mult: 1 }, buff: { turns: 2, mods: () => ({}), touch: { status: 'shock', chance: 0.3, turns: 2, zap: (b) => ZAP[b] } },
        text: (b) => `Un golpe normal y un campo te rodea 2 rondas: el que te pega de cerca recibe una descarga de ${ZAP[b]} y puede quedar electrizado (30%).`,
        say: 'Tu núcleo zumba y un campo eléctrico te envuelve.' },
      { id: 'protocolo_asalto', rank: 9, name: 'Protocolo de asalto', icon: 'target', cd: 5, ai: 'always',
        strike: { mult: 1.5, prec: 4, vsStatus: { types: ['shock', 'blind', 'stun'], mult: 2 } },
        text: () => 'Un golpe calculado: +4 de precisión y el 150% del daño; contra un blanco electrizado, ciego o aturdido, el doble.',
        say: 'Calculás el ángulo perfecto y golpeás.' },
    ],
    goliat: [
      { id: 'onda_impacto', rank: 5, name: 'Onda de impacto', icon: 'hammer', cd: 4, ai: 'always',
        strike: { mult: 1.3, status: { type: 'prone', chance: 0.3, turns: 1 } }, splash: { mult: 0.5, status: { type: 'prone', chance: 0.3, turns: 1 } },
        text: () => `Golpeás el suelo con todo: tu blanco recibe un golpe al ${pct(1.3)} y los demás, uno al ${pct(0.5)}; cualquiera puede caer derribado (30%).`,
        say: 'Golpeás el suelo con todo y la onda tira a tus enemigos para atrás.' },
      { id: 'ruptura_terreno', rank: 9, name: 'Ruptura de terreno', icon: 'hammer', cd: 5, ai: 'area2',
        sweep: { mult: 1, status: { type: 'prone', chance: 0.5, turns: 1 } },
        text: () => 'Partís el suelo bajo tus enemigos: todos reciben tu daño entero (cada uno con su tirada) y la mitad cae derribada.',
        say: 'El suelo se parte bajo tus pies y se traga a tus enemigos.' },
    ],
    minotauro: [
      { id: 'rompelineas', rank: 5, name: 'Rompelíneas', icon: 'swords', cd: 4, ai: 'always',
        strike: { mult: 1.3 }, cleave: { mult: 0.6 },
        text: () => `Cargás a través de la fila: tu blanco recibe un golpe al ${pct(1.3)} y otro enemigo, uno al ${pct(0.6)}.`,
        say: 'Cargás con la cabeza baja y atravesás la fila enemiga.' },
      { id: 'tormenta_cuernos', rank: 9, name: 'Tormenta de cuernos', icon: 'swords', cd: 6, ai: 'always',
        random: { hits: 3, mult: 0.8, status: { type: 'prone', chance: 0.3, turns: 1 } },
        text: () => `Tres cornadas a enemigos al azar, cada una con su tirada y el ${pct(0.8)} del daño; cada una puede derribar (30%).`,
        say: 'Girás como una tormenta y repartís cornadas para todos lados.' },
    ],
    licantropo: [
      { id: 'rastro_presa', rank: 5, name: 'Rastro de presa', icon: 'paw', cd: 4, ai: 'always',
        strike: { mult: 1 }, bleed: { value: (b) => PREY[b], turns: 3 }, mark: { prec: 2, turns: 3 },
        text: (b) => `Marcás a tu presa y le pegás: si acertás, sangra (${PREY[b]} por turno, 3 turnos) y por 3 rondas le pegás con +2 de precisión. La marca es tuya.`,
        say: 'Olés a tu presa y le clavás los dientes: ya no se te escapa.' },
      { id: 'caceria_lunar', rank: 9, name: 'Cacería lunar', icon: 'moon', cd: 5, ai: 'always',
        strike: { mult: 1.4 }, bleed: { value: (b) => HUNT[b], turns: 3 }, chase: { mult: 0.7 },
        text: (b) => `Un salto feroz: un golpe al ${pct(1.4)} que hace sangrar (${HUNT[b]} por turno). Si tumbás a tu presa, saltás sobre otra con un golpe al ${pct(0.7)}.`,
        say: 'La luna te llena y saltás sobre tu presa.' },
    ],
  };
  const DISC_BY_ID = {};
  for (const race of Object.keys(DISC)) for (const t of DISC[race]) DISC_BY_ID[t.id] = Object.assign(t, { race });

  function of(p) {
    if (!p || !A.Balance || A.Balance.classOf(p) !== 'warrior') return null;
    return TECH[p.raceId] || null;
  }
  function info(p) {
    const t = of(p);
    return t ? { id: t.id, name: t.name, icon: t.icon, text: t.text(band(p)), free: !!t.free } : null;
  }
  function key(c, p) { return c && c.party && A.State.hidOf ? A.State.hidOf(p) : 'solo'; }
  function used(c, p) { return !!(c && c.techUsed && c.techUsed[key(c, p)]); }
  function markUsed(c, p) { c.techUsed = Object.assign({}, c.techUsed || {}, { [key(c, p)]: true }); }

  // ---------- v3.13: disciplinas ----------
  function get(id) { return DISC_BY_ID[id] || null; }
  /** Las técnicas de disciplina de tu raza (las dos, aprendidas o no). */
  function discOf(p) { return p && A.Balance && A.Balance.classOf(p) === 'warrior' ? (DISC[p.raceId] || []) : []; }
  /** Las que ya aprendiste (las de tu raza que figuran en p.techniques). */
  function known(p) { const k = (p && p.techniques) || []; return discOf(p).filter((t) => k.includes(t.id)); }
  /** Turnos que faltan para poder usarla (la espera es de cada héroe: va en c.techCd). */
  function waitOf(c, id) { return c && c.techCd ? (c.techCd[id] || 0) : 0; }
  function setWait(c, t) { if (!c.techCd) c.techCd = {}; c.techCd[t.id] = t.cd; }
  /** Para la pantalla: { id, name, icon, text, rank, cd, wait, ready } */
  function discInfo(c, p, t) {
    return { id: t.id, name: t.name, icon: t.icon, text: t.text(band(p)), rank: t.rank, cd: t.cd, wait: waitOf(c, t.id), ready: !waitOf(c, t.id) };
  }

  A.Techniques = { TECH, WOLF, DISC, of, info, used, markUsed, band, get, discOf, known, waitOf, setWait, discInfo };
})(window.Aventurs);
