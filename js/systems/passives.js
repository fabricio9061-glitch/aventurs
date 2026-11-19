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
    gigante: { critMin: 18, mult: 2, prec: 1, precLevel: 5 }, // Golpe de gigante: crítico desde 18, doble daño; v3.1: +1 de precisión desde el nivel 5
    certero: { critMin: 19, prec: 2 },     // Ojo certero: críticos con 19-20 y precisión extra
    suerte: { dodge: 0.15 },               // Suerte: parte de los golpes que te iban a pegar, fallan · v3.3: 15% (era 10%)
    roca: { hits: 2 },                     // Piel de roca (enano): cuántos golpes por pelea te hacen la mitad · v3.3: 2 (era 1)
    furia: { at: 0.75 },                   // Furia (orco): se enciende con esta parte de la vida o menos · v3.3: 3/4 (era la mitad)
    metal: { armor: 0, shield: [1, 2], shieldLevel: 6 }, // Cuerpo de metal: blindaje por pelea (1; 2 desde el nivel 6). v3.1
    determinacion: { keep: 0.15 },         // Determinación: con cuánta vida quedás (parte de la máxima; 0 = con 1)
    sangre: { chance: 0.33 },              // Sangre de dragón: chance de prender fuego al pegar
    // v3.0
    colmillos: { steal: 0.15 },             // Colmillos (vampiro): parte del daño con arma vuelve como vida
    embestida: { mult: 1.5, powerMult: 1.1 },              // Embestida (minotauro): el primer ataque de la pelea pega seguro y más fuerte
    hada: { turns: 1 },                    // Polvo de hada: al empezar, una criatura (no jefe) se duerme
    // v3.1
    bendicion: { pct: 0.1, min: 3 },       // Bendición (ángel): cuánto cura (parte de la vida máxima)
    ingenio: { pct: 0.2, min: 1 },         // Ingenio (gnomo): hechizos más baratos (parte del costo, con un mínimo) · v3.1: 20% (era 25%: el mago más fuerte)
    // v3.3: razas nuevas
    lobo: { regen: [1, 1, 2], every: 4, below: 0.5 }, // Sangre de lobo (licántropo): con la mitad de la vida o menos, vida al empezar cada turno de pelea (1 · 2 desde nv 9) · medido: con 1/2/3 siempre ganaba 15 puntos más que los otros guerreros
    sombras: { bonus: 3, every: 4, poison: 0.4 }, // Cazador de sombras (elfo oscuro): daño extra a lo que ya tiene un estado malo, y sus golpes a veces envenenan · medido: sin el veneno quedaba 20 puntos abajo
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
        return `Tus ataques son críticos ${when} y hacen ${how} de daño.${g.prec ? ` Desde el nivel ${g.precLevel}, +${g.prec} de precisión.` : ''}`;
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
    colmillos: {
      name: 'Colmillos', icon: 'bleed',
      text: () => `Cada golpe con arma que acierta te devuelve el ${pctTxt(TUNE.colmillos.steal)} del daño como vida (si da menos de 1, la suerte decide).`,
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
    sangre_lobo: {
      name: 'Sangre de lobo', icon: 'heart',
      text: (p) => {
        const when = TUNE.lobo.below >= 1 ? 'Al empezar cada uno de tus turnos en una pelea' : `Con ${TUNE.lobo.below === 0.5 ? 'la mitad' : TUNE.lobo.below === 0.75 ? 'tres cuartos' : pctTxt(TUNE.lobo.below)} de la vida o menos, al empezar cada uno de tus turnos`;
        const grows = TUNE.lobo.regen.slice(1).map((n, i) => (n !== TUNE.lobo.regen[i] && lvl(p) < 1 + TUNE.lobo.every * (i + 1) ? `${n} desde el nivel ${1 + TUNE.lobo.every * (i + 1)}` : '')).filter(Boolean);
        return `${when}, recuperás ${wolfAmount(p)} de vida${grows.length ? ` (sube con el nivel: ${grows.join(', ')})` : ''}.`;
      },
    },
    cazador_sombras: {
      name: 'Cazador de sombras', icon: 'eye',
      text: (p) => `${TUNE.sombras.poison > 0 ? `Tus golpes con arma envenenan ${freqTxt(TUNE.sombras.poison)}. ` : ''}Tus golpes y hechizos hacen +${shadowAmount(p)} de daño a las criaturas que ya tienen algo malo encima: veneno, fuego, sangrado, ceguera, frío, maldición, o que están aturdidas o dormidas.`,
    },
    corteza_espinosa: {
      name: 'Corteza espinosa', icon: 'shield',
      text: (p) => `Cada criatura que te pega de cerca se clava tus espinas y recibe ${thornsAmount(p)} de daño (sube con el nivel).`,
    },
  };

  // ---------- Números que crecen con el nivel ----------
  function furyAmount(p) { return 2 + step(p, 4); }      // 2 · 3 (nv 5) · 4 (nv 9)
  function furyWhen() { const a = TUNE.furia.at; return a === 0.75 ? 'tres cuartos' : a === 0.5 ? 'la mitad' : pctTxt(a); }
  function spellAmount(p) { return 1 + Math.floor(lvl(p) / 2); } // 1 · 2 (nv 2) · 3 (nv 4) · 4 (nv 6) · 5 (nv 8) · 6 (nv 10)
  function manaAmount() { return 1; }                    // fijo: con más nivel ya sobra maná
  function blessAmount(p) { return Math.max(TUNE.bendicion.min, Math.round(((p && p.maxHp) || 24) * TUNE.bendicion.pct)); } // parte de la vida máxima (con un mínimo)
  // v3.3
  function wolfAmount(p) { const r = TUNE.lobo.regen; return r[Math.min(r.length - 1, step(p, TUNE.lobo.every))]; }
  function shadowAmount(p) { return TUNE.sombras.bonus + step(p, TUNE.sombras.every); }
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
  /** Colmillos: vida que recuperás de un golpe con arma. */
  function lifestealFrom(p, dmg) {
    if (!has(p, 'colmillos') || !p || p.hp <= 0 || dmg <= 0) return 0;
    // la parte con coma se redondea a la suerte: 0,6 -> 1 el 60% de las veces
    const x = dmg * TUNE.colmillos.steal;
    return Math.floor(x) + (Math.random() < x - Math.floor(x) ? 1 : 0);
  }
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
  /** Sangre de lobo: vida al empezar tu turno (0 si no es tu raza). */
  function wolfRegen(p) { return has(p, 'sangre_lobo') && p && p.hp > 0 && p.hp < p.maxHp && p.hp <= p.maxHp * TUNE.lobo.below ? wolfAmount(p) : 0; }
  /** Cazador de sombras: daño extra contra una criatura con un estado malo. */
  function shadowBonusVs(p, target) {
    if (!has(p, 'cazador_sombras') || !target) return 0;
    return (target.effects || []).some((e) => BAD_FX.includes(e.type) && (e.turns == null || e.turns > 0)) ? shadowAmount(p) : 0;
  }
  /** v3.3: Cazador de sombras: chance de envenenar con un golpe de arma. */
  function shadowPoison(p) { return has(p, 'cazador_sombras') ? TUNE.sombras.poison || 0 : 0; }
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
    shadowPoison,
    shadowBonusVs,
    thornsOf,
    BAD_FX,
  };
})(window.Aventurs);
