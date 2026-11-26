/* ============================================================
   Aventurs — Spellbook (v2.5)
   Quién puede aprender cada hechizo.

   - Hace falta canalizar magia (magos e híbridos).
   - Los hechizos de raza son solo de su raza.
   - v2.5: los hechizos marcados "mageOnly" (los grandes de área: Bola de
     fuego, Tormenta arcana, Aliento de dragón) solo los aprenden los magos.
     Un híbrido que ya los sabía de antes, los conserva.
   - v3.3: Curación también es solo para magos, y los hechizos que se
     aprenden de los pergaminos (fromScroll) piden tener su nivel.
   - v3.3: Segundo aliento es solo para híbridos (hybridOnly): se curan a sí mismos.
   - v3.4: los magos aprenden todo. Los híbridos, solo los marcados "hybrid":
     Chispa, Llama, Rayo helado, Segundo aliento y 6 pergaminos de combate
     (Misil arcano, Quemar, Ojo de halcón, Fuerza arcana, Piel de piedra y
     Furia salvaje). Nunca los de área ni los de curar a otros.
   - v3.14: nada de eso se aprende más: la magia es solo la de tu raza (la de
     nacimiento y la de tu escuela, ver js/systems/schools.js).
   ============================================================ */

(function (A) {
  'use strict';

  function spellOf(x) { return typeof x === 'string' ? A.Data.getById('spells', x) : x; }

  function classOf(p) { return A.Balance && A.Balance.classOf ? A.Balance.classOf(p) : 'hybrid'; }

  /** v3.4: quién lo puede aprender: 'race' (de nacimiento), 'hybrid' (solo híbridos),
   *  'both' (magos e híbridos) o 'mage' (solo magos: todo lo que no está marcado para híbridos). */
  function who(spellOrId) {
    const spell = spellOf(spellOrId);
    if (!spell) return 'mage';
    if (spell.racial || spell.race) return 'race';
    if (spell.hybridOnly) return 'hybrid';
    return spell.hybrid && !spell.mageOnly ? 'both' : 'mage';
  }

  /** ¿Puede aprenderlo? { ok, why, known, mageOnly, hybridOnly, racial } */
  function canLearn(p, spellOrId) {
    const spell = spellOf(spellOrId);
    if (!spell) return { ok: false, why: 'Ese hechizo no existe.' };
    if (!p || !p.hasMagic) return { ok: false, why: 'No podés canalizar magia.' };
    if ((p.spells || []).includes(spell.id)) return { ok: false, why: 'Ya lo conocés.', known: true };
    const race = spell.racial || spell.race;
    if (race && typeof race === 'string' && race !== p.raceId) return { ok: false, why: 'Es un hechizo de otra raza.', racial: true };
    // v3.14: la magia es de tu raza: los hechizos comunes ya no los enseña nadie
    if (A.Schools && A.Schools.isOwnMagic && !A.Schools.isOwnMagic(p, spell)) return { ok: false, why: 'Ya no se enseña: tu magia es la de la escuela de tu raza.', retired: true };
    if (spell.hybridOnly && classOf(p) !== 'hybrid') return { ok: false, why: 'Solo los híbridos pueden aprenderlo.', hybridOnly: true };
    if (who(spell) === 'mage' && classOf(p) !== 'mage') return { ok: false, why: 'Solo los magos pueden aprenderlo.', mageOnly: true };
    // v3.3: los hechizos de los pergaminos piden su nivel
    if (spell.fromScroll && (p.level || 1) < (spell.tier || 1)) return { ok: false, why: `Necesitás nivel ${spell.tier} para aprenderlo.`, level: spell.tier };
    // v3.13: los de escuela los enseña tu maestro (nivel 5) o su prueba (nivel 9)
    if (spell.schoolRank) {
      if ((p.level || 1) < spell.schoolRank) return { ok: false, why: `Necesitás nivel ${spell.schoolRank} para aprenderlo.`, level: spell.schoolRank };
      return { ok: false, why: 'Lo enseña el maestro de tu escuela.', school: true };
    }
    return { ok: true, why: '' };
  }

  /** Hechizos de una lista que este personaje podría aprender. */
  function learnable(p, ids) {
    return (ids || []).map(spellOf).filter((s) => s && canLearn(p, s).ok);
  }

  A.Spellbook = { canLearn, learnable, who };
})(window.Aventurs);
