/* ============================================================
   Aventurs — Pasivas de raza (v1.9.2)
   Cada raza tiene UNA pasiva, siempre activa. Acá viven los textos
   y las reglas; el combate (js/systems/combat.js) y las fórmulas
   (js/core/balance.js) llaman a estas funciones.

   Las que suman números crecen un poco con el nivel, así no quedan
   chicas cuando el personaje avanza.

   El balance (que ninguna raza sea mejor que otra contando su pasiva)
   se mide con: node tools/simulador.js razas
   ============================================================ */

(function (A) {
  'use strict';

  // v2.2.1: números de las pasivas que se afinan con el simulador
  const TUNE = {
    // v3.11 (dossier): los números van por tramo de nivel (1-4 · 5-8 · 9-12 · 13-16 · 17-20)
    // Golpe de gigante: crítico desde 18 (si el golpe llega: v3.11), doble daño y algo más por tramo; precisión extra.
    // (v3.11 medido: con +1 de precisión y nada extra hasta el nv 9 quedaba 14 puntos abajo en el nv 1 y 9 en el 15-20;
    //  con +2 y +2/+2/+3/+4/+6 queda a 1-3 puntos del promedio de los guerreros)
    gigante: { critMin: 18, mult: 2, prec: 2, precLevel: 1, afterCrit: [2, 2, 3, 4, 6] },
    certero: { critMin: 19, prec: 3, afterCrit: [0, 1, 1, 2, 3] }, // Ojo certero: críticos con 19-20 y precisión extra · v3.11 (dossier): +1 tras el crítico desde el nv 5
    suerte: { dodge: 0.15 },               // Suerte: parte de los golpes que te iban a pegar, fallan · v3.3: 15% (era 10%)
    // v3.11 (dossier): Piel de roca por ronda: los primeros golpes de cada ronda te hacen menos (nunca menos de 1)
    // (v3.11 medido: con -1 a los dos primeros, en las rachas de nv 1 y 3 quedaba 7 y 16 puntos abajo: los golpes grandes
    //  le pesaban más que antes; con -2 al primero se queda donde estaba y contra grupos sube 20 puntos)
    roca: { cut: [2, 2, 3, 3, 4], hits: [1, 2, 2, 3, 3] },
    // v3.11 (dossier): Instinto salvaje (orco; el id sigue siendo "furia"): tu primer golpe de cada turno pega más,
    // y más todavía si te hirieron desde tu turno anterior (no hace falta tener poca vida)
    instinto: { base: [1, 2, 2, 3, 3], hurt: [3, 4, 5, 6, 7] }, // (medido: con +1/+2 quedaba 1 a 3 puntos abajo de la Furia)
    furia: { at: 0.75 },                   // (hasta v3.10) Furia: se encendía con 3/4 de la vida o menos
    // v3.11 (dossier): Núcleo de sobrecarga (robot; el id sigue siendo "cuerpo_metal"): cada 2 golpes que aciertan, una descarga
    nucleo: { every: 2, main: [3, 4, 5, 7, 9], arc: [1, 1, 2, 3, 4] }, // (medido: con +2/+3/+4 perdía 3-4 puntos sin el blindaje)
    // (hasta v3.10) blindaje 1 (2 desde nv 6): v3.11 lo saca (el dossier pide no sumar dos pasivas).
    // v3.11: armadura por tramo (medido: desde el nivel 9 quedaba 8 a 11 puntos abajo de los otros guerreros)
    metal: { armor: [0, 0, 1, 2, 3], shield: [0, 0], shieldLevel: 6 },
    determinacion: { keep: 0.1 },         // Determinación: con cuánta vida quedás (parte de la máxima; 0 = con 1)
    sangre: { chance: 0.33 },              // Sangre de dragón: chance de prender fuego al pegar
    // v3.0
    // v3.9 (dossier de razas): Sed de sangre — Frenesí vampírico. Robo de vida por tramo de nivel
    // (1-4 · 5-8 · 9-10); 3 golpes de arma que hacen daño = Frenesí en tus 2 turnos siguientes.
    // v3.11: del 13 al 20 el robo queda como en el dossier (16% y 30%): con golpes grandes ya roba mucho
    // (medido: con 18-20% y 33-36% ganaba 91-94% en el 15-20, 11-15 puntos sobre los híbridos)
    colmillos: { steal: [0.12, 0.14, 0.16, 0.16, 0.16], frenzySteal: [0.2, 0.25, 0.3, 0.3, 0.3], frenzyDmg: [1, 2, 3, 3, 4], charges: 3, turns: 2, touchHeal: 1 },
    // v3.11 (dossier): Embestida arrolladora: tu primer golpe que acierta a CADA criatura pega más, y cada golpe
    // la desequilibra (menos precisión en su próximo ataque). Antes: el primer ataque de la pelea no fallaba (x1,5)
    // (v3.11 medido: con +2/+3/+4 quedaba 8-10 puntos abajo en las rachas; el primer ataque a cada una también apunta mejor)
    embestida: { first: [4, 5, 6, 7, 8], stagger: [1, 2, 2, 3, 3], prec: [2, 2, 2, 3, 3] },
    // Polvo de hada: al empezar, una criatura (no jefe) se duerme. v3.11 (dossier): además, una vez por ronda,
    // tu hechizo de daño marea a su blanco (menos precisión en su próximo ataque; en nv 9, también menos defensa)
    hada: { turns: 1, stagger: [1, 2, 2, 3, 3], expose: [0, 0, 1, 1, 2] },
    // v3.11 (dossier): Bendición divina: al empezar cada ronda, una luz protege al más herido del grupo
    bendicion: { absorb: [1, 2, 3, 4, 5], uses: [2, 3, 3, 4, 4] },
    ingenio: { pct: 0.2, min: 1, big: 5, extra: [0, 1, 1, 2, 2], spells: [0, 1, 2, 2, 3] }, // Ingenio (gnomo): -20% (mínimo 1) · v3.11: 1 menos en los primeros hechizos de 5 o más
    // v3.11 (dossier): Llama interior: +1/+2/+3 a un blanco; en área, +1 a cada uno (después del crítico)
    llama: { single: [3, 4, 5, 6, 7], area: [1, 2, 2, 3, 3] },
    // v3.11 (dossier): Apoyo orbital (alienígena; el id sigue siendo "mente_expansiva"): la nave nodriza bombardea
    // con tu hechizo de daño: tu blanco (dado) y cada una de las demás (fijo). Después espera 3 turnos tuyos.
    orbital: { main: ['1d3', '1d6', '1d8', '1d10', '2d6'], others: [1, 2, 2, 3, 3], wait: 3 }, // (medido: con 1d4 en el nivel 1 ganaba 15 puntos más)
    // v3.3: razas nuevas
    // v3.9 (dossier): Sangre lunar (licántropo): 2 turnos en forma bestial y 1 normal, y así.
    // En forma bestial: +daño con arma y vida al empezar el turno, con un tope por pelea (no se cura toda).
    // start: 1 = la bestia sale en tu primer turno (medido: con start 2, como decía el dossier, quedaba 10 puntos
    // abajo en los niveles 1 y 3, porque esas peleas duran 2 o 3 rondas; con 1 queda en el promedio de los guerreros)
    lobo: { dmg: [1, 1, 2, 2, 3], regen: [1, 2, 3, 4, 5], cap: [4, 6, 8, 10, 12], start: 1, beast: 2, rest: 1 },
    // Cazador de sombras (elfo oscuro). 'actual' (50% de veneno y +3, +1 cada 4 niveles) o 'gradual' (dossier: 30/40/50% y +1/+2/+3).
    // v3.9: medido, la gradual lo dejaba 11 a 14 puntos abajo en los niveles 1 y 3 (ya era el híbrido más flojo): se queda la actual
    // v3.11: poisonDmg = veneno por turno de tu hoja (por tramo) · always = daño extra aunque la criatura no tenga nada encima
    // (medido: con 50% y veneno de 1 quedaba 7-9 puntos abajo de los híbridos en el nv 6, en parejas y en el 15-20;
    //  con 60%, veneno 1/1/2/2/3 y +0/+1/+1/+2/+2 a las demás queda a 0-7 puntos)
    sombras: { mode: 'actual', poison: [0.3, 0.4, 0.5, 0.5, 0.5], bonusBand: [1, 2, 3, 4, 5], bonus: 3, every: 4, poisonOld: 0.6, poisonDmg: [1, 1, 2, 2, 3], always: [0, 1, 1, 2, 2] },
    // v3.9 (dossier): Dardo arcano (humano) marca al blanco: tu próximo golpe con arma que le acierta hace más daño
    dardo: { bonus: [1, 2, 3, 4, 5], prec: [0, 0, 1, 1, 2], rounds: 2 },
    espinas: { dmg: 1, every: 4 },         // Corteza espinosa (dríade): el que te pega de cerca se lastima
  };
  // v3.3: los estados malos que cuenta el Cazador de sombras
  const BAD_FX = ['poison', 'fire', 'bleed', 'blind', 'cold', 'curse', 'stun', 'shock', 'sleep'];
  const pctTxt = (x) => `${Math.round(x * 100)}%`;
  const NUM = { 1: 'uno', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco' };
  const oneIn = (x) => (x > 0 ? `uno de cada ${Math.round(1 / x)}` : 'ninguno');
  /** v3.3: "una de cada 4 veces" si es exacto; si no, "el 40% de las veces". */
  const freqTxt = (x) => (x > 0 && Math.abs(1 / x - Math.round(1 / x)) < 0.01 ? `una de cada ${Math.round(1 / x)} veces` : `el ${pctTxt(x)} de las veces`);

  const lvl = (p) => Math.max(1, (p && p.level) || 1);
  const step = (p, every) => Math.floor((lvl(p) - 1) / every);

  // ---------- Textos (el {n} se completa según el nivel) ----------
  const LIST = {
    determinacion: {
      name: 'Determinación', icon: 'heart',
      text: () => (TUNE.determinacion.keep > 0
        ? `Una vez por combate, el golpe que te iba a voltear te deja en pie con el ${pctTxt(TUNE.determinacion.keep)} de tu vida.`
        : 'Una vez por combate, un golpe que te iba a voltear te deja en pie con 1 de vida.'),
    },
    ojo_certero: {
      name: 'Ojo certero', icon: 'target',
      text: (p) => { const a = (TUNE.certero.afterCrit || [])[band(p)] || 0; return `+${TUNE.certero.prec} de precisión, y tus ataques son críticos con ${TUNE.certero.critMin} o más en el dado, si llegan (el 20 llega siempre)${a ? `; tus críticos suman +${a}` : ''}.`; },
    },
    suerte: {
      name: 'Suerte', icon: 'clover',
      text: () => `${oneIn(TUNE.suerte.dodge).replace(/^u/, 'U')} golpes que te iban a pegar termina fallando (${pctTxt(TUNE.suerte.dodge)}).`,
    },
    sangre_dragon: {
      name: 'Sangre de dragón', icon: 'fire',
      text: () => `Tus golpes prenden fuego al enemigo ${oneIn(TUNE.sangre.chance).replace(/^uno/, 'una')} veces. El fuego no te hace nada.`,
    },
    piel_roca: {
      name: 'Piel de roca', icon: 'shield',
      // v3.11 (dossier): por ronda, no por pelea
      text: (p) => { const b = band(p); const T = TUNE.roca; return `Los ${NUM[T.hits[b]] || T.hits[b]} primeros golpes que recibís en cada ronda te hacen ${T.cut[b]} menos de daño (nunca menos de 1).`; },
    },
    furia: { // v3.11: Instinto salvaje (el id sigue siendo "furia" para no tocar las partidas guardadas)
      name: 'Instinto salvaje', icon: 'fist',
      text: (p) => { const b = band(p); const T = TUNE.instinto; return `Tu primer golpe con arma que acierta en cada turno hace +${T.base[b]} de daño; si te hirieron desde tu turno anterior, +${T.hurt[b]}.`; },
    },
    cuerpo_metal: { // v3.11: Núcleo de sobrecarga (el id sigue siendo "cuerpo_metal")
      name: 'Núcleo de sobrecarga', icon: 'spark',
      text: (p) => { const b = band(p); const T = TUNE.nucleo; const arm = armorBonus(p); return `Cada golpe con arma que acierta carga tu núcleo. Con ${NUM[T.every] || T.every} cargas, ese golpe suelta una descarga: +${T.main[b]} de daño${T.arc[b] ? ` y ${T.arc[b]} a otra criatura` : ''}. El veneno y el sangrado no te afectan.${arm ? ` +${arm} de armadura.` : ''}`; },
    },
    golpe_gigante: {
      name: 'Golpe de gigante', icon: 'hammer',
      text: (p) => {
        const g = TUNE.gigante;
        const when = g.critMin < 20 ? `con ${g.critMin} o más en el dado, si el golpe llega (el 20 llega siempre),` : 'con 20 en el dado';
        const how = g.mult === 2 ? 'el doble' : g.mult === 3 ? 'el triple' : `x${String(g.mult).replace('.', ',')}`;
        const after = (g.afterCrit || [])[band(p)] || 0;
        return `Tus ataques son críticos ${when} y hacen ${how} de daño${after ? `, y +${after} más` : ''}.${g.prec ? (g.precLevel > 1 ? ` Desde el nivel ${g.precLevel}, +${g.prec} de precisión.` : ` Además, +${g.prec} de precisión.`) : ''}`;
      },
    },
    ingenio: {
      name: 'Ingenio', icon: 'book',
      text: (p) => {
        const T = TUNE.ingenio; const b = band(p); const n = T.spells[b];
        const base = `Tus hechizos cuestan menos maná: ${T.pct === 0.25 ? 'un cuarto' : T.pct === 0.2 ? 'un quinto' : pctTxt(T.pct)} menos, y como mínimo ${T.min} menos.`;
        return n > 0 ? `${base} En cada pelea, ${n === 1 ? 'el primer hechizo' : `los ${NUM[n] || n} primeros hechizos`} de ${T.big} o más de maná ${n === 1 ? 'cuesta' : 'cuestan'} ${T.extra[b]} menos todavía.` : base;
      },
    },
    mente_expansiva: { // v3.11: Apoyo orbital (el id sigue siendo "mente_expansiva")
      name: 'Apoyo orbital', icon: 'signal',
      text: (p) => { const b = band(p); const T = TUNE.orbital; return `Tu nave nodriza te cuida desde el cielo: cuando lanzás un hechizo de daño, bombardea a tu blanco (${T.main[b]}) y a cada una de las demás criaturas (${T.others[b]}). Después tarda ${NUM[T.wait] || T.wait} turnos tuyos en volver a disparar. Además recuperás un poco más de maná que los otros magos.`; },
    },
    llama_interior: {
      name: 'Llama interior', icon: 'fireball',
      text: (p) => { const b = band(p); const T = TUNE.llama; return `Tus hechizos de daño a un solo blanco hacen +${T.single[b]}; los de área, +${T.area[b]} a cada criatura.`; },
    },
    bendicion: {
      name: 'Bendición divina', icon: 'sun',
      text: (p) => { const b = band(p); const T = TUNE.bendicion; return `Al empezar cada ronda, una luz protege al más herido del grupo (vos también contás): le frena ${T.absorb[b]} del próximo golpe. Hasta ${NUM[T.uses[b]] || T.uses[b]} golpes frenados por pelea.`; },
    },
    // v3.0: razas nuevas
    colmillos: { // v3.9: Sed de sangre (el id sigue siendo "colmillos" para no tocar las partidas guardadas)
      name: 'Sed de sangre', icon: 'heart',
      text: (p) => { const b = band(p); const T = TUNE.colmillos; return `Cada golpe con arma que hace daño te devuelve el ${pctTxt(T.steal[b])} como vida y junta una gota de sangre. Con ${T.charges} gotas entrás en Frenesí vampírico tus ${T.turns} turnos siguientes: robás el ${pctTxt(T.frenzySteal[b])} y pegás +${T.frenzyDmg[b]}.`; },
    },
    embestida: {
      name: 'Embestida arrolladora', icon: 'fist',
      text: (p) => { const b = band(p); const T = TUNE.embestida; return `Tu primer golpe que acierta a cada criatura de la pelea hace +${T.first[b]} de daño. Cada golpe tuyo que acierta la deja desequilibrada: −${T.stagger[b]} de precisión en su próximo ataque.`; },
    },
    polvo_hada: {
      name: 'Polvo de hada', icon: 'stars',
      text: (p) => { const b = band(p); const T = TUNE.hada; return `Al empezar cada pelea, una de las criaturas (nunca un jefe) se queda dormida y pierde su primer turno. Además, una vez por ronda, tu hechizo de daño marea a su blanco: −${T.stagger[b]} de precisión en su próximo ataque${T.expose[b] ? ` y −${T.expose[b]} de defensa hasta su turno` : ''}.`; },
    },
    // v3.3: razas nuevas
    sangre_lobo: { // v3.9: Sangre lunar (antes Sangre de lobo)
      name: 'Sangre lunar', icon: 'moon',
      text: (p) => { const b = band(p); const T = TUNE.lobo; return `Desde tu ${T.start === 1 ? 'primer' : 'segundo'} turno de cada pelea te transformás: ${T.beast} turnos en forma bestial y ${T.rest} normal, y así. En forma bestial pegás +${T.dmg[b]} y recuperás ${T.regen[b]} de vida al empezar el turno (hasta ${T.cap[b]} por pelea).`; },
    },
    cazador_sombras: {
      name: 'Cazador de sombras', icon: 'eye',
      text: (p) => { const pd = shadowPoisonDmg(p); const al = shadowAlways(p); return `Tus golpes con arma envenenan ${freqTxt(shadowPoisonChance(p))}${pd > 1 ? ` (${pd} de daño por turno)` : ''}. Tus golpes y hechizos hacen +${shadowAmount(p)} de daño a las criaturas que ya tienen algo malo encima: veneno, fuego, sangrado, ceguera, frío, maldición, o que están aturdidas o dormidas${al ? `; a las demás, +${al}` : ''}.`; },
    },
    corteza_espinosa: {
      name: 'Corteza espinosa', icon: 'shield',
      text: (p) => `Cada criatura que te pega de cerca se clava tus espinas y recibe ${thornsAmount(p)} de daño (sube con el nivel).`,
    },
  };

  // ---------- Números que crecen con el nivel ----------
  /** v3.11: Llama interior: a un blanco o a cada uno en área (después del crítico; no cura ni sube las quemaduras). */
  function spellAmount(p, area) {
    const b = band(p);
    // (medido: con +3 desde el nivel 1 ganaba 20 puntos más que antes en el nivel 1; en el 1 es +2)
    return area ? TUNE.llama.area[b] : Math.min(TUNE.llama.single[b], 1 + lvl(p));
  }
  // v3.3
  /** v3.9: tramos de nivel del dossier de razas (v3.11: cinco, hasta el 20) */
  /** Tramo de nivel: 1-4 · 5-8 · 9-12 · 13-16 · 17-20 (v3.11: el tope subió a 20). */
  function band(p) { const l = lvl(p); return Math.max(0, Math.min(4, Math.floor((l - 1) / 4))); }
  function shadowAmount(p) { return TUNE.sombras.mode === 'gradual' ? TUNE.sombras.bonusBand[band(p)] : TUNE.sombras.bonus + step(p, TUNE.sombras.every); }
  function shadowPoisonChance(p) { return TUNE.sombras.mode === 'gradual' ? TUNE.sombras.poison[band(p)] : TUNE.sombras.poisonOld; }
  function thornsAmount(p) { return TUNE.espinas.dmg + step(p, TUNE.espinas.every); }

  // ---------- Consultas ----------
  function raceOf(p) {
    return p && A.Data && A.Data.getById ? A.Data.getById('races', p.raceId) : null;
  }

  function idOf(p) {
    const r = raceOf(p);
    return r && r.passive && LIST[r.passive] ? r.passive : null;
  }

  function has(p, id) { return idOf(p) === id; }

  /** { id, name, icon, text } de la pasiva del jugador (o de un id). */
  function info(playerOrId, p) {
    const id = typeof playerOrId === 'string' ? playerOrId : idOf(playerOrId);
    const who = typeof playerOrId === 'string' ? p : playerOrId;
    if (!id || !LIST[id]) return null;
    const d = LIST[id];
    return { id, name: d.name, icon: d.icon, text: d.text(who || { level: 1 }) };
  }

  // ---------- Ataque ----------
  function critMin(p) {
    if (has(p, 'golpe_gigante')) return TUNE.gigante.critMin;
    return has(p, 'ojo_certero') ? TUNE.certero.critMin : 20;
  }
  function critMult(p) { return has(p, 'golpe_gigante') ? TUNE.gigante.mult : 2; }
  /** v2.2.1: Suerte ya no vuelve a tirar los 1 (casi no se notaba). */
  function rerollOnes() { return false; }
  /** v2.2.1: precisión extra (Ojo certero). */
  function precisionBonus(p) {
    if (has(p, 'ojo_certero')) return TUNE.certero.prec;
    // v3.1: el Goliat afina la puntería con los años
    if (has(p, 'golpe_gigante') && TUNE.gigante.prec && Math.max(1, (p && p.level) || 1) >= TUNE.gigante.precLevel) return TUNE.gigante.prec;
    return 0;
  }
  /** v2.2.1: armadura extra (Cuerpo de metal). */
  function armorBonus(p) {
    if (!has(p, 'cuerpo_metal')) return 0;
    const a = TUNE.metal.armor;
    return Array.isArray(a) ? (a[band(p)] || 0) : (a || 0); // v3.11: por tramo (en los niveles altos, chapa más gruesa)
  }
  /** v3.1: blindaje del Robot al empezar cada pelea. */
  function shieldOf(p) { return Math.max(1, (p && p.level) || 1) >= TUNE.metal.shieldLevel ? TUNE.metal.shield[1] : TUNE.metal.shield[0]; }
  /** (hasta v3.10) blindaje que quedaba en la pelea: v3.11 ya no hay blindaje. */
  function shieldLeft() { return 0; }
  /** v3.1: lo que se usa una vez por pelea es de cada héroe (en grupo no se comparte). */
  function heroKey(p, k) { return A.State && A.State.hidOf && p ? `${k}:${A.State.hidOf(p)}` : k; }
  /** v2.2.1: chance de que un golpe que te iba a pegar falle (Suerte). */
  function luckyDodge(p) { return has(p, 'suerte') ? TUNE.suerte.dodge : 0; }
  function burnChance(p) { return has(p, 'sangre_dragon') ? TUNE.sangre.chance : 0; }
  function burnValue(p) { return 1 + step(p, 2); }

  /** (hasta v3.10) daño extra de la Furia en el dado. v3.11: el Instinto salvaje se suma en el golpe (instinctBonus). */
  function damageBonus() { return 0; }

  // ---------- Magia ----------
  /** Costo base del hechizo para esta clase (v3.1: Curación cuesta 6 a los magos). */
  function baseCost(p, spell) {
    let base = (spell && spell.manaCost) || 0;
    const cc = spell && spell.classCost;
    if (cc && A.Balance && A.Balance.classOf) { const k = A.Balance.classOf(p); if (cc[k] != null) base = cc[k]; }
    return base;
  }
  /**
   * Maná que cuesta un hechizo. Con la pelea (c), el Ingenio del gnomo suma su descuento extra en los
   * primeros hechizos caros (v3.11); sin pelea, el costo de siempre.
   */
  function spellCost(p, spell, c) {
    const base = baseCost(p, spell);
    if (!has(p, 'ingenio') || base <= 1) return base;
    let cost = Math.max(1, base - Math.max(TUNE.ingenio.min, Math.round(base * TUNE.ingenio.pct)));
    if (c && ingenioExtraLeft(c, p, spell) > 0) cost = Math.max(1, cost - TUNE.ingenio.extra[band(p)]);
    return cost;
  }
  /** v3.11: ¿cuántos hechizos caros con descuento extra le quedan en esta pelea? (0 si este no es caro) */
  function ingenioExtraLeft(c, p, spell) {
    if (!c || !has(p, 'ingenio') || baseCost(p, spell) < TUNE.ingenio.big) return 0;
    const b = band(p);
    if (!TUNE.ingenio.extra[b]) return 0;
    const used = (c.passives || {})[heroKey(p, 'ingenio')] || 0;
    return Math.max(0, TUNE.ingenio.spells[b] - used);
  }
  /** v3.11: se lanzó un hechizo caro con el descuento extra. */
  function ingenioUse(c, p, spell) {
    if (ingenioExtraLeft(c, p, spell) <= 0) return false;
    const u = c.passives || (c.passives = {});
    const k = heroKey(p, 'ingenio');
    u[k] = (u[k] || 0) + 1;
    return true;
  }
  /** v3.11: Llama interior (spell = el hechizo, para saber si es de área). */
  function spellBonus(p, spell) { return has(p, 'llama_interior') ? spellAmount(p, !!(spell && spell.area)) : 0; }
  /** Mente expansiva: maná al empezar tu turno, en las rondas pares. */
  function manaPerTurn() {
    // v2.1: la recuperación de maná ahora es de todos los magos (Balance.manaRegenOf)
    return 0;
  }

  // ---------- Defensa ----------
  function immune(p, type) {
    if (has(p, 'cuerpo_metal')) return type === 'poison' || type === 'bleed';
    if (has(p, 'sangre_dragon')) return type === 'fire';
    return false;
  }

  /** (hasta v3.10) la Bendición curaba al quedar con media vida. v3.11: protege al más herido (blessRound). */
  function blessingHeal() { return 0; }

  /**
   * Ajusta el daño que va a recibir el jugador.
   * c.passives recuerda lo que ya se usó en este combate.
   * opts.tick = true para veneno/fuego/sangrado (Piel de roca solo frena golpes).
   * Devuelve { dmg, passive } (passive: la que actuó, o null).
   */
  function absorbHit(c, p, dmg, opts = {}) {
    if (!c || !p) return { dmg, passive: null };
    const used = c.passives || (c.passives = {});
    let out = dmg;
    let tag = null;
    let absorbed = 0;
    let roca = 0;
    let blessed = 0;
    let blessBy = null;
    // v3.11 (dossier): Piel de roca por ronda (la armadura ya se restó; nunca baja de 1)
    if (!opts.tick && has(p, 'piel_roca') && out > 1) {
      const k = heroKey(p, 'roca');
      const b = band(p);
      let s = used[k];
      if (!s || typeof s !== 'object' || s.round !== c.round) s = used[k] = { round: c.round, n: 0 };
      if (s.n < TUNE.roca.hits[b]) {
        s.n += 1;
        roca = Math.min(TUNE.roca.cut[b], out - 1);
        out -= roca;
        tag = 'piel_roca';
      }
    }
    // v3.11 (dossier): la protección de la Bendición divina (de un ángel: puede ser de un compañero)
    if (!opts.tick && out > 0 && c.blessings) {
      const k = blessKey(p);
      const bl = c.blessings[k];
      if (bl && bl.amount > 0) {
        blessed = Math.min(bl.amount, out);
        out -= blessed;
        absorbed = blessed;
        blessBy = bl.byName || null;
        delete c.blessings[k];
        // (en la pelea, no en las pasivas de cada héroe: en grupo, el golpe lo recibe otro)
        c.blessUses = c.blessUses || {};
        c.blessUses[bl.by] = (c.blessUses[bl.by] || 0) + 1;
        if (!tag) tag = 'bendicion';
      }
    }
    // v3.11: el Instinto salvaje (orco) recuerda que te hirieron (golpes directos, no veneno ni espinas)
    if (!opts.tick && out > 0 && has(p, 'furia')) instinctState(c, p).hurt = true;
    if (has(p, 'determinacion') && !used[heroKey(p, 'determinacion')] && p.hp > 0 && p.hp - out <= 0) {
      used[heroKey(p, 'determinacion')] = true;
      // v2.2.1: quedás en pie con una parte de tu vida (si tenías menos, te cura hasta ahí)
      const keep = Math.max(1, Math.round((p.maxHp || 1) * (TUNE.determinacion.keep || 0)));
      if (p.hp > keep) {
        out = p.hp - keep;
      } else {
        out = 0;
        if (keep > p.hp && A.State && A.State.healHp && A.State.player === p) A.State.healHp(keep - p.hp);
      }
      tag = 'determinacion';
    }
    return { dmg: out, passive: tag, absorbed, roca, blessed, blessBy };
  }

  // ---------- v3.0 ----------
  /** Sed de sangre: vida que recuperás de un golpe con arma (más en Frenesí). */
  function lifestealFrom(p, dmg, c) {
    if (!has(p, 'colmillos') || !p || p.hp <= 0 || dmg <= 0) return 0;
    const T = TUNE.colmillos;
    const rate = frenzyOn(c || (A.State && A.State.combat), p) ? T.frenzySteal[band(p)] : T.steal[band(p)];
    // la parte con coma se redondea a la suerte: 0,6 -> 1 el 60% de las veces
    const x = dmg * rate;
    return Math.floor(x) + (Math.random() < x - Math.floor(x) ? 1 : 0);
  }
  // ---------- v3.9: Frenesí vampírico ----------
  function bloodState(c, p) {
    const u = c.passives || (c.passives = {});
    const k = heroKey(p, 'sangre');
    return u[k] || (u[k] = { charges: 0, frenzy: 0, pending: false, lastRound: -1 });
  }
  function frenzyOn(c, p) { return !!(c && has(p, 'colmillos') && bloodState(c, p).frenzy > 0); }
  function frenzyDamage(c, p) { return frenzyOn(c, p) ? TUNE.colmillos.frenzyDmg[band(p)] : 0; }
  /** Un golpe tuyo con arma que hizo daño junta una gota (una por ronda; en Frenesí, no). { charges, ready } o null */
  function bloodCharge(c, p) {
    if (!c || !has(p, 'colmillos')) return null;
    const s = bloodState(c, p);
    if (s.frenzy > 0 || s.pending || s.lastRound === c.round) return null;
    s.lastRound = c.round;
    s.charges = Math.min(TUNE.colmillos.charges, s.charges + 1);
    if (s.charges >= TUNE.colmillos.charges) { s.charges = 0; s.pending = true; return { charges: TUNE.colmillos.charges, ready: true }; }
    return { charges: s.charges, ready: false };
  }
  /** Al empezar tu turno: 'start' (empieza el Frenesí), 'end' (se terminó) o null. */
  function bloodTurn(c, p) {
    if (!c || !has(p, 'colmillos')) return null;
    const s = bloodState(c, p);
    let ev = null;
    if (s.frenzy > 0) { s.frenzy -= 1; if (s.frenzy === 0) ev = 'end'; }
    if (s.pending) { s.pending = false; s.frenzy = TUNE.colmillos.turns; ev = 'start'; }
    return ev;
  }
  /** Para la pantalla: { charges, max, frenzy } */
  function bloodInfo(c, p) { if (!c || !has(p, 'colmillos')) return null; const s = bloodState(c, p); return { charges: s.charges, max: TUNE.colmillos.charges, frenzy: s.frenzy, pending: s.pending }; }
  /** (hasta v3.10) el primer ataque de la pelea no fallaba. v3.11: Embestida arrolladora (rushBonus). */
  function chargeReady() { return false; }
  function chargeMult() { return 1; }
  /** Polvo de hada: ¿duerme a alguien al empezar? */
  function fairyDust(p) { return has(p, 'polvo_hada') ? TUNE.hada.turns : 0; }

  // ---------- v3.3 ----------
  // ---------- v3.9: Sangre lunar ----------
  function lunarState(c, p) {
    const u = c.passives || (c.passives = {});
    const k = heroKey(p, 'luna');
    return u[k] || (u[k] = { turn: 0, beast: false, healed: 0 });
  }
  /** Al empezar tu turno: { event: 'beast'|'human'|null, heal, beast } (la vida se aplica afuera). */
  function lunarTurn(c, p) {
    if (!c || !has(p, 'sangre_lobo') || !p || p.hp <= 0) return null;
    const T = TUNE.lobo;
    const s = lunarState(c, p);
    s.turn += 1;
    const t = s.turn - T.start;
    const beast = t >= 0 && (t % (T.beast + T.rest)) < T.beast;
    const event = beast && !s.beast ? 'beast' : !beast && s.beast ? 'human' : null;
    s.beast = beast;
    let heal = 0;
    if (beast) heal = Math.max(0, Math.min(T.regen[band(p)], T.cap[band(p)] - s.healed, (p.maxHp || 0) - (p.hp || 0)));
    return { event, heal, beast };
  }
  function lunarHealed(c, p, n) { if (c && n > 0) lunarState(c, p).healed += n; }
  function beastOn(c, p) { return !!(c && has(p, 'sangre_lobo') && lunarState(c, p).beast); }
  function beastDamage(c, p) { return beastOn(c, p) ? TUNE.lobo.dmg[band(p)] : 0; }
  function lunarInfo(c, p) { if (!c || !has(p, 'sangre_lobo')) return null; const s = lunarState(c, p); return { beast: s.beast, healed: s.healed, cap: TUNE.lobo.cap[band(p)] }; }
  /** (v3.8; ya no se usa: Sangre de lobo curaba todos los turnos) */
  function wolfRegen() { return 0; }

  // ---------- v3.9: marca del Dardo arcano (solo el humano que la puso la aprovecha) ----------
  function markOf(c, p, target) {
    if (!c || !target || !target.arcaneMark || !p) return null;
    const m = target.arcaneMark;
    if (m.owner !== heroKey(p, 'dardo') || c.round > m.until) return null;
    return m;
  }
  function placeMark(c, p, target) {
    if (!c || !target || !p) return null;
    const b = band(p);
    target.arcaneMark = { owner: heroKey(p, 'dardo'), bonus: TUNE.dardo.bonus[b], prec: TUNE.dardo.prec[b], until: c.round + TUNE.dardo.rounds };
    return target.arcaneMark;
  }
  function consumeMark(target) { if (target) delete target.arcaneMark; }
  /** Cazador de sombras: daño extra contra una criatura con un estado malo. */
  function shadowBonusVs(p, target) {
    if (!has(p, 'cazador_sombras') || !target) return 0;
    return (target.effects || []).some((e) => BAD_FX.includes(e.type) && (e.turns == null || e.turns > 0)) ? shadowAmount(p) : shadowAlways(p);
  }
  /** v3.11: Cazador de sombras: daño extra contra cualquier criatura (desde el tramo que diga TUNE). */
  function shadowAlways(p) { return has(p, 'cazador_sombras') ? ((TUNE.sombras.always || [])[band(p)] || 0) : 0; }
  /** v3.11: Cazador de sombras: veneno por turno de tu hoja. */
  function shadowPoisonDmg(p) { return (TUNE.sombras.poisonDmg || [])[band(p)] || 1; }
  /** v3.3: Cazador de sombras: chance de envenenar con un golpe de arma (v3.9: crece con el nivel). */
  function shadowPoison(p) { return has(p, 'cazador_sombras') ? shadowPoisonChance(p) : 0; }
  /** Corteza espinosa: daño que se lleva el que te pega de cerca. */
  function thornsOf(p) { return has(p, 'corteza_espinosa') ? thornsAmount(p) : 0; }

  /** ¿Se acaba de activar la Furia? (se avisa una sola vez por combate) */
  function furyJustStarted(c, p) {
    if (!c || !has(p, 'furia') || damageBonus(p) <= 0) return false;
    const used = c.passives || (c.passives = {});
    if (used[heroKey(p, 'fury')]) return false;
    used[heroKey(p, 'fury')] = true;
    return true;
  }


  // ============================================================
  // v3.11 (dossier de razas, segunda parte)
  // ============================================================

  // ---------- Golpe de gigante: daño extra después del crítico (nv 9-10) ----------
  function afterCrit(p) {
    if (has(p, 'golpe_gigante')) return (TUNE.gigante.afterCrit || [])[band(p)] || 0;
    if (has(p, 'ojo_certero')) return (TUNE.certero.afterCrit || [])[band(p)] || 0;
    return 0;
  }

  // ---------- Instinto salvaje (orco) ----------
  function instinctState(c, p) {
    const u = c.passives || (c.passives = {});
    const k = heroKey(p, 'instinto');
    return u[k] || (u[k] = { ready: false, angry: false, hurt: false });
  }
  /** Al empezar tu turno: tu primer golpe que acierta suma (más si te hirieron desde tu turno anterior). */
  function instinctTurn(c, p) {
    if (!c || !has(p, 'furia')) return;
    const s = instinctState(c, p);
    s.ready = true;
    s.angry = s.hurt;
    s.hurt = false;
  }
  /** El daño extra de este golpe (y lo gasta: uno por turno). { n, angry } o null */
  function instinctBonus(c, p) {
    if (!c || !has(p, 'furia')) return null;
    const s = instinctState(c, p);
    if (!s.ready) return null;
    s.ready = false;
    const b = band(p);
    return { n: s.angry ? TUNE.instinto.hurt[b] : TUNE.instinto.base[b], angry: s.angry };
  }
  /** Para la tarjeta: lo que suma tu próximo golpe (o 0 si ya lo usaste en este turno). */
  function instinctInfo(c, p) {
    if (!c || !has(p, 'furia')) return null;
    const s = instinctState(c, p);
    const b = band(p);
    const angry = s.ready ? s.angry : s.hurt;
    return { ready: s.ready, angry, n: angry ? TUNE.instinto.hurt[b] : TUNE.instinto.base[b] };
  }

  // ---------- Núcleo de sobrecarga (robot) ----------
  function coreState(c, p) {
    const u = c.passives || (c.passives = {});
    const k = heroKey(p, 'nucleo');
    return u[k] || (u[k] = { charges: 0 });
  }
  /** Un golpe con arma que acertó: suma una carga. Con la segunda, descarga: { main, arc } (si no, null). */
  function coreHit(c, p) {
    if (!c || !has(p, 'cuerpo_metal')) return null;
    const s = coreState(c, p);
    s.charges += 1;
    if (s.charges < TUNE.nucleo.every) return null;
    s.charges = 0;
    const b = band(p);
    return { main: TUNE.nucleo.main[b], arc: TUNE.nucleo.arc[b] };
  }
  function coreInfo(c, p) { if (!c || !has(p, 'cuerpo_metal')) return null; return { charges: coreState(c, p).charges, max: TUNE.nucleo.every }; }

  // ---------- Embestida arrolladora (minotauro) ----------
  /** Primer golpe que acierta a ESTA criatura en la pelea (como mucho una vez por ronda): el daño extra, o 0. */
  function rushBonus(c, p, target) {
    if (!c || !target || !has(p, 'embestida')) return 0;
    const u = c.passives || (c.passives = {});
    const k = heroKey(p, 'embestida');
    const s = u[k] && typeof u[k] === 'object' ? u[k] : (u[k] = { hit: {}, round: -1 });
    if (s.hit[target.instanceId] || s.round === c.round) return 0;
    s.hit[target.instanceId] = true;
    s.round = c.round;
    return TUNE.embestida.first[band(p)];
  }
  /** Precisión extra del primer ataque contra una criatura que todavía no embestiste. */
  function rushPrec(c, p, target) {
    if (!c || !target || !has(p, 'embestida')) return 0;
    const s = (c.passives || {})[heroKey(p, 'embestida')];
    if (s && typeof s === 'object' && (s.hit[target.instanceId] || s.round === c.round)) return 0;
    return (TUNE.embestida.prec || [])[band(p)] || 0;
  }
  /** Cuánta precisión le saca cada golpe que acierta (hasta su próximo ataque; no se suma). */
  function rushStagger(p) { return has(p, 'embestida') ? TUNE.embestida.stagger[band(p)] : 0; }

  // ---------- Apoyo orbital (alienígena) ----------
  function orbitalState(c, p) {
    const u = c.passives || (c.passives = {});
    const k = heroKey(p, 'nave');
    return u[k] || (u[k] = { wait: 0, shots: 0 });
  }
  /** Lanzaste un hechizo de daño: si la nave está lista, dispara. { main (dado), others } o null. */
  function orbitalFire(c, p) {
    if (!c || !has(p, 'mente_expansiva')) return null;
    const s = orbitalState(c, p);
    if (s.wait > 0) return null;
    s.wait = TUNE.orbital.wait;
    s.shots += 1;
    const b = band(p);
    return { main: TUNE.orbital.main[b], others: TUNE.orbital.others[b] };
  }
  /** Al empezar tu turno, la nave se recarga un poco. */
  function orbitalTurn(c, p) { if (c && has(p, 'mente_expansiva')) { const s = orbitalState(c, p); if (s.wait > 0) s.wait -= 1; } }
  function orbitalInfo(c, p) { if (!c || !has(p, 'mente_expansiva')) return null; const s = orbitalState(c, p); return { wait: s.wait, ready: s.wait === 0, shots: s.shots }; }

  // ---------- Bendición divina (ángel) ----------
  function blessKey(p) { return heroKey(p, 'b'); }
  /** Golpes que ya frenó la Bendición de este ángel en la pelea. */
  function blessUsed(c, angel) { return ((c && c.blessUses) || {})[blessKey(angel)] || 0; }
  function blessLeft(c, angel) { return has(angel, 'bendicion') ? Math.max(0, TUNE.bendicion.uses[band(angel)] - blessUsed(c, angel)) : 0; }
  /**
   * Al empezar cada ronda: cada ángel protege al más herido del grupo (por parte de la vida; si empatan,
   * el que tiene menos vida; si siguen empatados, el ángel mismo). Una protección por héroe.
   * heroes: los héroes en la pelea. Devuelve [{ angel, target, amount, fresh }] (fresh: no la tenía).
   */
  function blessRound(c, heroes) {
    if (!c) return [];
    const angels = (heroes || []).filter((h) => h && h.hp > 0 && has(h, 'bendicion'));
    if (!angels.length) return [];
    c.blessings = c.blessings || {};
    const out = [];
    // las protecciones que no se usaron se vuelven a repartir (no gastan carga)
    for (const a of angels) for (const k of Object.keys(c.blessings)) if (c.blessings[k].by === blessKey(a)) delete c.blessings[k];
    for (const a of angels) {
      if (blessLeft(c, a) <= 0) continue;
      const pool = heroes.filter((h) => h && h.hp > 0 && !c.blessings[blessKey(h)]);
      if (!pool.length) continue;
      pool.sort((x, y) => (x.hp / x.maxHp - y.hp / y.maxHp) || (x.hp - y.hp) || ((x === a ? 0 : 1) - (y === a ? 0 : 1)));
      const t = pool[0];
      const amount = TUNE.bendicion.absorb[band(a)];
      const prev = (c._blessPrev || {})[blessKey(a)];
      c.blessings[blessKey(t)] = { by: blessKey(a), byName: t === a ? null : a.name, amount };
      out.push({ angel: a, target: t, amount, fresh: prev !== blessKey(t) });
      (c._blessPrev = c._blessPrev || {})[blessKey(a)] = blessKey(t);
    }
    return out;
  }
  /** Para la tarjeta: la protección que tiene este héroe ahora. */
  function blessOn(c, p) { return c && c.blessings ? c.blessings[blessKey(p)] || null : null; }

  // ---------- Polvo de hada: tu hechizo marea a su blanco (una vez por ronda) ----------
  function fairyHex(c, p) {
    if (!c || !has(p, 'polvo_hada')) return null;
    const u = c.passives || (c.passives = {});
    const k = heroKey(p, 'hadaRonda');
    if (u[k] === c.round) return null;
    u[k] = c.round;
    const b = band(p);
    return { stagger: TUNE.hada.stagger[b], expose: TUNE.hada.expose[b] };
  }

  A.Passives = {
    TUNE,
    LIST,
    precisionBonus,
    armorBonus,
    luckyDodge,
    info,
    idOf,
    has,
    critMin,
    critMult,
    rerollOnes,
    burnChance,
    burnValue,
    damageBonus,
    spellCost,
    spellBonus,
    manaPerTurn,
    immune,
    blessingHeal,
    shieldOf,
    shieldLeft,
    absorbHit,
    furyJustStarted,
    // v3.0
    lifestealFrom,
    chargeReady,
    chargeMult,
    fairyDust,
    // v3.3
    wolfRegen,
    // v3.9 (dossier de razas)
    band,
    frenzyOn, frenzyDamage, bloodCharge, bloodTurn, bloodInfo,
    lunarTurn, lunarHealed, beastOn, beastDamage, lunarInfo,
    markOf, placeMark, consumeMark,
    shadowPoison, shadowPoisonDmg, shadowAlways,
    shadowBonusVs,
    thornsOf,
    BAD_FX,
    // v3.11 (dossier, segunda parte)
    afterCrit,
    instinctTurn, instinctBonus, instinctInfo,
    coreHit, coreInfo,
    rushBonus, rushStagger, rushPrec,
    orbitalFire, orbitalTurn, orbitalInfo,
    blessRound, blessOn, blessLeft,
    fairyHex,
    ingenioUse, ingenioExtraLeft, baseCost,
  };
})(window.Aventurs);
