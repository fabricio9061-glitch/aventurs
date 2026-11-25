/* ============================================================
   Aventurs — Técnicas de nacimiento de los guerreros (v3.10)

   Del dossier de razas: cada raza guerrera trae una técnica propia, una vez por
   pelea, con un botón en el combate. Los números crecen por tramo de nivel
   (1-4 · 5-8 · 9-10). La pelea la ejecuta combat.js (playerTechnique).
   Medido con tools/hordas.js: era lo que faltaba para que los guerreros
   no quedaran 30 puntos abajo de los magos contra grupos.
   ============================================================ */
(function (A) {
  'use strict';
  const band = (p) => (A.Passives && A.Passives.band ? A.Passives.band(p) : 0);
  const DICE = ['1d4', '1d6', '1d8'];

  const TECH = {
    enano: {
      id: 'guardia_piedra', name: 'Guardia de piedra', icon: 'shield',
      text: (b) => `Te plantás como una roca: +${[2, 3, 4][b]} de armadura por 2 rondas. No gasta tu ataque: pegás igual.`,
      buff: (b) => ({ armor: [2, 3, 4][b] }), turns: 2, free: true,
      say: 'Clavás los pies en el suelo y levantás la guardia: sos una roca.',
    },
    orco: {
      id: 'rugido_guerra', name: 'Rugido de guerra', icon: 'warning',
      text: (b) => `Un rugido que te enciende: +${[1, 2, 3][b]} de daño por 2 rondas (en grupo, tus compañeros +1). No gasta tu ataque.`,
      buff: (b) => ({ damage: [1, 2, 3][b] }), turns: 2, allies: { damage: 1 }, free: true,
      say: 'Soltás un rugido de guerra que hace temblar a tus enemigos.',
    },
    licantropo: {
      id: 'aullido_manada', name: 'Aullido de manada', icon: 'paw',
      text: (b) => `Aullás a la luna: +1 de precisión${b === 2 ? ' y +1 de daño' : ''} por 2 rondas (en grupo, tus compañeros también +1 de precisión). No gasta tu ataque.`,
      buff: (b) => ({ precision: 1, damage: [0, 0, 1][b] }), turns: 2, allies: { precision: 1 }, free: true,
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

  A.Techniques = { TECH, of, info, used, markUsed, band };
})(window.Aventurs);
