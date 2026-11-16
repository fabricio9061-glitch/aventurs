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
    gigante: { critMin: 18, mult: 2 },     // Golpe de gigante: desde qué número es crítico y cuánto multiplica
    certero: { critMin: 19, prec: 2 },     // Ojo certero: críticos con 19-20 y precisión extra
    suerte: { dodge: 0.1 },                // Suerte: parte de los golpes que te iban a pegar, fallan
    metal: { armor: 0 },                   // Cuerpo de metal: armadura extra (medido: con +1 el robot quedaba muy fuerte)
    determinacion: { keep: 0.15 },         // Determinación: con cuánta vida quedás (parte de la máxima; 0 = con 1)
    sangre: { chance: 0.33 },              // Sangre de dragón: chance de prender fuego al pegar
  };
  const pctTxt = (x) => `${Math.round(x * 100)}%`;
  const oneIn = (x) => (x > 0 ? `uno de cada ${Math.round(1 / x)}` : 'ninguno');

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
      text: () => 'El primer golpe que recibís en cada combate te hace la mitad de daño.',
    },
    furia: {
      name: 'Furia', icon: 'fist',
      text: (p) => `Con la mitad de la vida o menos, tus golpes hacen +${furyAmount(p)} de daño.`,
    },
    cuerpo_metal: {
      name: 'Cuerpo de metal', icon: 'gear',
      text: () => (TUNE.metal.armor > 0
        ? `+${TUNE.metal.armor} de armadura, y el veneno y el sangrado no te afectan.`
        : 'El veneno y el sangrado no te afectan.'),
    },
    golpe_gigante: {
      name: 'Golpe de gigante', icon: 'hammer',
      text: () => {
        const g = TUNE.gigante;
        const when = g.critMin < 20 ? `con ${g.critMin} o más en el dado (no solo con 20)` : 'con 20 en el dado';
        const how = g.mult === 2 ? 'el doble' : g.mult === 3 ? 'el triple' : `x${String(g.mult).replace('.', ',')}`;
        return `Tus ataques son críticos ${when} y hacen ${how} de daño.`;
      },
    },
    ingenio: {
      name: 'Ingenio', icon: 'book',
      text: () => 'Tus hechizos cuestan menos maná: un cuarto menos, y como mínimo 1 menos.',
    },
    mente_expansiva: {
      name: 'Mente expansiva', icon: 'arcane',
      text: () => 'Recuperás más maná que cualquier otro mago: 1 más en cada turno, y más al ganar.',
    },
    llama_interior: {
      name: 'Llama interior', icon: 'fireball',
      text: (p) => `Tus hechizos de daño hacen +${spellAmount(p)}.`,
    },
    bendicion: {
      name: 'Bendición', icon: 'heal',
      text: (p) => `La primera vez en cada combate que quedás con la mitad de la vida o menos, una luz te cura ${blessAmount(p)} de vida.`,
    },
  };

  // ---------- Números que crecen con el nivel ----------
  function furyAmount(p) { return 2 + step(p, 4); }      // 2 · 3 (nv 5) · 4 (nv 9)
  function spellAmount(p) { return 1 + Math.floor(lvl(p) / 2); } // 1 · 2 (nv 2) · 3 (nv 4) · 4 (nv 6) · 5 (nv 8) · 6 (nv 10)
  function manaAmount() { return 1; }                    // fijo: con más nivel ya sobra maná
  function blessAmount(p) { return Math.max(3, Math.round(((p && p.maxHp) || 24) * 0.1)); } // 10% de la vida máxima (mínimo 3)

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
  function precisionBonus(p) { return has(p, 'ojo_certero') ? TUNE.certero.prec : 0; }
  /** v2.2.1: armadura extra (Cuerpo de metal). */
  function armorBonus(p) { return has(p, 'cuerpo_metal') ? TUNE.metal.armor : 0; }
  /** v2.2.1: chance de que un golpe que te iba a pegar falle (Suerte). */
  function luckyDodge(p) { return has(p, 'suerte') ? TUNE.suerte.dodge : 0; }
  function burnChance(p) { return has(p, 'sangre_dragon') ? TUNE.sangre.chance : 0; }
  function burnValue(p) { return 1 + step(p, 2); }

  /** Daño extra de la Furia (solo con la mitad de la vida o menos). */
  function damageBonus(p) {
    if (!has(p, 'furia') || !p || p.hp <= 0) return 0;
    return p.hp <= p.maxHp / 2 ? furyAmount(p) : 0;
  }

  // ---------- Magia ----------
  function spellCost(p, spell) {
    const base = (spell && spell.manaCost) || 0;
    if (!has(p, 'ingenio') || base <= 1) return base;
    return Math.max(1, base - Math.max(1, Math.round(base * 0.25)));
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
    if (used.blessing) return 0;
    used.blessing = true;
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
    if (!opts.tick && has(p, 'piel_roca') && !used.roca && out > 1) {
      used.roca = true;
      out = Math.max(1, Math.ceil(out / 2));
      tag = 'piel_roca';
    }
    if (has(p, 'determinacion') && !used.determinacion && p.hp > 0 && p.hp - out <= 0) {
      used.determinacion = true;
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
    return { dmg: out, passive: tag };
  }

  /** ¿Se acaba de activar la Furia? (se avisa una sola vez por combate) */
  function furyJustStarted(c, p) {
    if (!c || !has(p, 'furia') || damageBonus(p) <= 0) return false;
    const used = c.passives || (c.passives = {});
    if (used.fury) return false;
    used.fury = true;
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
    absorbHit,
    furyJustStarted,
  };
})(window.Aventurs);
