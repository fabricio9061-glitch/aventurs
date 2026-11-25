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
    gigante: { critMin: 18, mult: 2, prec: 1, precLevel: 1 }, // Golpe de gigante: crítico desde 18, doble daño; +1 de precisión (v3.9: desde el nivel 1; medido: quedaba 9 puntos abajo de los guerreros en el nivel 1)
    certero: { critMin: 19, prec: 3 },     // Ojo certero: críticos con 19-20 y precisión extra
    suerte: { dodge: 0.15 },               // Suerte: parte de los golpes que te iban a pegar, fallan · v3.3: 15% (era 10%)
    roca: { hits: 2 },                     // Piel de roca (enano): cuántos golpes por pelea te hacen la mitad · v3.3: 2 (era 1)
    furia: { at: 0.75 },                   // Furia (orco): se enciende con esta parte de la vida o menos · v3.3: 3/4 (era la mitad)
    metal: { armor: 0, shield: [1, 2], shieldLevel: 6 }, // Cuerpo de metal: blindaje por pelea (1; 2 desde el nivel 6). v3.1
    determinacion: { keep: 0.1 },         // Determinación: con cuánta vida quedás (parte de la máxima; 0 = con 1)
    sangre: { chance: 0.33 },              // Sangre de dragón: chance de prender fuego al pegar
    // v3.0
    // v3.9 (dossier de razas): Sed de sangre — Frenesí vampírico. Robo de vida por tramo de nivel
    // (1-4 · 5-8 · 9-10); 3 golpes de arma que hacen daño = Frenesí en tus 2 turnos siguientes.
    colmillos: { steal: [0.12, 0.14, 0.16], frenzySteal: [0.2, 0.25, 0.3], frenzyDmg: [1, 2, 3], charges: 3, turns: 2, touchHeal: 1 },
    embestida: { mult: 1.5, powerMult: 1.1 },              // Embestida (minotauro): el primer ataque de la pelea pega seguro y más fuerte
    hada: { turns: 1 },                    // Polvo de hada: al empezar, una criatura (no jefe) se duerme
    // v3.1
    bendicion: { pct: 0.1, min: 3 },       // Bendición (ángel): cuánto cura (parte de la vida máxima)
    ingenio: { pct: 0.2, min: 1 },         // Ingenio (gnomo): hechizos más baratos (parte del costo, con un mínimo) · v3.1: 20% (era 25%: el mago más fuerte)
    llama: { base: 1, from: 3 },                               // Llama interior (infernal): daño extra de los hechizos (base + la mitad del nivel)
    // v3.3: razas nuevas
    // v3.9 (dossier): Sangre lunar (licántropo): 2 turnos en forma bestial y 1 normal, y así.
    // En forma bestial: +daño con arma y vida al empezar el turno, con un tope por pelea (no se cura toda).
    // start: 1 = la bestia sale en tu primer turno (medido: con start 2, como decía el dossier, quedaba 10 puntos
    // abajo en los niveles 1 y 3, porque esas peleas duran 2 o 3 rondas; con 1 queda en el promedio de los guerreros)
    lobo: { dmg: [1, 1, 2], regen: [1, 2, 3], cap: [4, 6, 8], start: 1, beast: 2, rest: 1 },
    // Cazador de sombras (elfo oscuro). 'actual' (50% de veneno y +3, +1 cada 4 niveles) o 'gradual' (dossier: 30/40/50% y +1/+2/+3).
    // v3.9: medido, la gradual lo dejaba 11 a 14 puntos abajo en los niveles 1 y 3 (ya era el híbrido más flojo): se queda la actual
    sombras: { mode: 'actual', poison: [0.3, 0.4, 0.5], bonusBand: [1, 2, 3], bonus: 3, every: 4, poisonOld: 0.5 },
    // v3.9 (dossier): Dardo arcano (humano) marca al blanco: tu próximo golpe con arma que le acierta hace más daño
    dardo: { bonus: [1, 2, 3], prec: [0, 0, 1], rounds: 2 },
    espinas: { dmg: 1, every: 4 },         // Corteza espinosa (dríade): el que te pega de cerca se lastima
  };
  // v3.3: los estados malos que cuenta el Cazador de sombras
  const BAD_FX = ['poison', 'fire', 'bleed', 'blind', 'cold', 'curse', 'stun', 'shock', 'sleep'];
  const pctTxt = (x) => `${Math.round(x * 100)}%`;
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
      text: () => `+${TUNE.certero.prec} de precisión, y tus ataques son críticos con ${TUNE.certero.critMin} o más en el dado (no solo con 20).`,
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
      text: () => (TUNE.roca.hits > 1
        ? `Los ${({ 2: 'dos', 3: 'tres', 4: 'cuatro' })[TUNE.roca.hits] || TUNE.roca.hits} primeros golpes que recibís en cada combate te hacen la mitad de daño.`
        : 'El primer golpe que recibís en cada combate te hace la mitad de daño.'),
    },
    furia: {
      name: 'Furia', icon: 'fist',
      text: (p) => `Con ${furyWhen()} de la vida o menos, tus golpes hacen +${furyAmount(p)} de daño.`,
    },
    cuerpo_metal: {
      name: 'Cuerpo de metal', icon: 'gear',
      // v3.1: además del veneno y el sangrado, arranca cada pelea con blindaje
      text: (p) => `Cada pelea arrancás con ${shieldOf(p)} de blindaje: frena ese daño antes de que te toque la vida${shieldOf(p) < TUNE.metal.shield[1] ? ` (${TUNE.metal.shield[1]} desde el nivel ${TUNE.metal.shieldLevel})` : ''}. El veneno y el sangrado no te afectan.${TUNE.metal.armor > 0 ? ` +${TUNE.metal.armor} de armadura.` : ''}`,
    },
    golpe_gigante: {
      name: 'Golpe de gigante', icon: 'hammer',
      text: () => {
        const g = TUNE.gigante;
        const when = g.critMin < 20 ? `con ${g.critMin} o más en el dado (no solo con 20)` : 'con 20 en el dado';
        const how = g.mult === 2 ? 'el doble' : g.mult === 3 ? 'el triple' : `x${String(g.mult).replace('.', ',')}`;
        return `Tus ataques son críticos ${when} y hacen ${how} de daño.${g.prec ? (g.precLevel > 1 ? ` Desde el nivel ${g.precLevel}, +${g.prec} de precisión.` : ` Además, +${g.prec} de precisión.`) : ''}`;
      },
    },
    ingenio: {
      name: 'Ingenio', icon: 'book',
      text: () => `Tus hechizos cuestan menos maná: ${TUNE.ingenio.pct === 0.25 ? 'un cuarto' : TUNE.ingenio.pct === 0.2 ? 'un quinto' : pctTxt(TUNE.ingenio.pct)} menos, y como mínimo ${TUNE.ingenio.min} menos.`,
    },
    mente_expansiva: {
      name: 'Mente expansiva', icon: 'arcane',
      // v3.3: con los números de verdad (1,5 por turno al empezar; crece más rápido que el de los otros magos)
      text: (p) => {
        const B = A.Balance;
        if (!B || !B.manaRegenOf) return 'Recuperás más maná que cualquier otro mago, en cada turno y al ganar.';
        const lv = lvl(p);
        const me = B.manaRegenOf({ hasMagic: true, raceId: 'alienigena', level: lv }).turn;
        const every = (B.TUNE && B.TUNE.mageRegenEvery) || 0;
        const other = 1 + (every > 0 ? Math.floor((lv - 1) / every) : 0);
        return `Recuperás más maná que cualquier otro mago: ${B.regenLabel(me)} por turno${me % 1 ? ' en promedio' : ''} (los demás, ${other}), y más al ganar una pelea.`;
      },
    },
    llama_interior: {
      name: 'Llama interior', icon: 'fireball',
      text: (p) => `Tus hechizos de daño hacen +${spellAmount(p)}.`,
    },
    bendicion: {
      name: 'Bendición', icon: 'heal',
      text: (p) => `La primera vez en cada combate que quedás con la mitad de la vida o menos, una luz te cura ${blessAmount(p)} de vida.`,
    },
    // v3.0: razas nuevas
    colmillos: { // v3.9: Sed de sangre (el id sigue siendo "colmillos" para no tocar las partidas guardadas)
      name: 'Sed de sangre', icon: 'heart',
      text: (p) => { const b = band(p); const T = TUNE.colmillos; return `Cada golpe con arma que hace daño te devuelve el ${pctTxt(T.steal[b])} como vida y junta una gota de sangre. Con ${T.charges} gotas entrás en Frenesí vampírico tus ${T.turns} turnos siguientes: robás el ${pctTxt(T.frenzySteal[b])} y pegás +${T.frenzyDmg[b]}.`; },
    },
    embestida: {
      name: 'Embestida', icon: 'fist',
      text: () => `Tu primer ataque en cada pelea no falla y hace x${String(TUNE.embestida.mult).replace('.', ',')} de daño (x${String(TUNE.embestida.powerMult).replace('.', ',')} si es un Golpe fuerte).`,
    },
    polvo_hada: {
      name: 'Polvo de hada', icon: 'stars',
      text: () => 'Al empezar cada pelea, una de las criaturas (nunca un jefe) se queda dormida y pierde su primer turno.',
    },
    // v3.3: razas nuevas
    sangre_lobo: { // v3.9: Sangre lunar (antes Sangre de lobo)
      name: 'Sangre lunar', icon: 'moon',
      text: (p) => { const b = band(p); const T = TUNE.lobo; return `Desde tu ${T.start === 1 ? 'primer' : 'segundo'} turno de cada pelea te transformás: ${T.beast} turnos en forma bestial y ${T.rest} normal, y así. En forma bestial pegás +${T.dmg[b]} y recuperás ${T.regen[b]} de vida al empezar el turno (hasta ${T.cap[b]} por pelea).`; },
    },
    cazador_sombras: {
      name: 'Cazador de sombras', icon: 'eye',
      text: (p) => `Tus golpes con arma envenenan ${freqTxt(shadowPoisonChance(p))}. Tus golpes y hechizos hacen +${shadowAmount(p)} de daño a las criaturas que ya tienen algo malo encima: veneno, fuego, sangrado, ceguera, frío, maldición, o que están aturdidas o dormidas.`,
    },
    corteza_espinosa: {
      name: 'Corteza espinosa', icon: 'shield',
      text: (p) => `Cada criatura que te pega de cerca se clava tus espinas y recibe ${thornsAmount(p)} de daño (sube con el nivel).`,
    },
  };

  // ---------- Números que crecen con el nivel ----------
  function furyAmount(p) { return 2 + step(p, 4); }      // 2 · 3 (nv 5) · 4 (nv 9)
  function furyWhen() { const a = TUNE.furia.at; return a === 0.75 ? 'tres cuartos' : a === 0.5 ? 'la mitad' : pctTxt(a); }
  function spellAmount(p) { return TUNE.llama.base + Math.floor(lvl(p) / 2) + (lvl(p) >= TUNE.llama.from ? 1 : 0); } // 1 · 2 (nv 2) · 3 (nv 4) · 4 (nv 6) · 5 (nv 8) · 6 (nv 10)
  function manaAmount() { return 1; }                    // fijo: con más nivel ya sobra maná
  function blessAmount(p) { return Math.max(TUNE.bendicion.min, Math.round(((p && p.maxHp) || 24) * TUNE.bendicion.pct)); } // parte de la vida máxima (con un mínimo)
  // v3.3
  /** v3.9: tramos de nivel del dossier de razas: 1-4 · 5-8 · 9-10 */
  function band(p) { const l = lvl(p); return l >= 9 ? 2 : l >= 5 ? 1 : 0; }
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
  function armorBonus(p) { return has(p, 'cuerpo_metal') ? TUNE.metal.armor : 0; }
  /** v3.1: blindaje del Robot al empezar cada pelea. */
  function shieldOf(p) { return Math.max(1, (p && p.level) || 1) >= TUNE.metal.shieldLevel ? TUNE.metal.shield[1] : TUNE.metal.shield[0]; }
  /** Lo que todavía queda de blindaje en esta pelea (para mostrarlo en la tarjeta). */
  function shieldLeft(c, p) {
    if (!has(p, 'cuerpo_metal')) return 0;
    const used = (c && c.passives) || {};
    const k = heroKey(p, 'blindaje');
    return used[k] == null ? shieldOf(p) : used[k];
  }
  /** v3.1: lo que se usa una vez por pelea es de cada héroe (en grupo no se comparte). */
  function heroKey(p, k) { return A.State && A.State.hidOf && p ? `${k}:${A.State.hidOf(p)}` : k; }
  /** v2.2.1: chance de que un golpe que te iba a pegar falle (Suerte). */
  function luckyDodge(p) { return has(p, 'suerte') ? TUNE.suerte.dodge : 0; }
  function burnChance(p) { return has(p, 'sangre_dragon') ? TUNE.sangre.chance : 0; }
  function burnValue(p) { return 1 + step(p, 2); }

  /** Daño extra de la Furia (solo con la mitad de la vida o menos). */
  function damageBonus(p) {
    if (!has(p, 'furia') || !p || p.hp <= 0) return 0;
    return p.hp <= p.maxHp * TUNE.furia.at ? furyAmount(p) : 0;
  }

  // ---------- Magia ----------
  function spellCost(p, spell) {
    let base = (spell && spell.manaCost) || 0;
    // v3.1: algunos hechizos cuestan distinto según la clase (Curación: 6 para los magos)
    const cc = spell && spell.classCost;
    if (cc && A.Balance && A.Balance.classOf) { const k = A.Balance.classOf(p); if (cc[k] != null) base = cc[k]; }
    if (!has(p, 'ingenio') || base <= 1) return base;
    return Math.max(1, base - Math.max(TUNE.ingenio.min, Math.round(base * TUNE.ingenio.pct)));
  }
  function spellBonus(p) { return has(p, 'llama_interior') ? spellAmount(p) : 0; }
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

  /** Bendición: cura una vez por combate al quedar con la mitad de la vida o menos. */
  function blessingHeal(c, p) {
    if (!c || !has(p, 'bendicion') || !p || p.hp <= 0 || p.hp > p.maxHp / 2) return 0;
    const used = c.passives || (c.passives = {});
    if (used[heroKey(p, 'blessing')]) return 0;
    used[heroKey(p, 'blessing')] = true;
    return blessAmount(p);
  }

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
    // v3.1: Blindaje del Robot (frena el daño de los golpes hasta gastarse)
    if (!opts.tick && has(p, 'cuerpo_metal') && out > 0) {
      const k = heroKey(p, 'blindaje');
      if (used[k] == null) used[k] = shieldOf(p);
      const take = Math.min(used[k], out);
      if (take > 0) { used[k] -= take; out -= take; absorbed = take; tag = 'cuerpo_metal'; }
    }
    // v3.3: los primeros golpes (TUNE.roca.hits) de cada pelea
    if (!opts.tick && has(p, 'piel_roca') && (Number(used[heroKey(p, 'roca')]) || 0) < TUNE.roca.hits && out > 1) {
      used[heroKey(p, 'roca')] = (Number(used[heroKey(p, 'roca')]) || 0) + 1;
      out = Math.max(1, Math.ceil(out / 2));
      tag = 'piel_roca';
    }
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
    return { dmg: out, passive: tag, absorbed };
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
  /** Embestida: ¿este es el primer ataque de la pelea? (se marca como usado) */
  function chargeReady(c, p) {
    if (!c || !has(p, 'embestida')) return false;
    const used = c.passives || (c.passives = {});
    if (used.embestida) return false;
    used.embestida = true;
    return true;
  }
  function chargeMult(power) { return power ? TUNE.embestida.powerMult : TUNE.embestida.mult; }
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
    return (target.effects || []).some((e) => BAD_FX.includes(e.type) && (e.turns == null || e.turns > 0)) ? shadowAmount(p) : 0;
  }
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
    shadowPoison,
    shadowBonusVs,
    thornsOf,
    BAD_FX,
  };
})(window.Aventurs);
