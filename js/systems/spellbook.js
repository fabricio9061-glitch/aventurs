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
   ============================================================ */

(function (A) {
  'use strict';

  function spellOf(x) { return typeof x === 'string' ? A.Data.getById('spells', x) : x; }

  function classOf(p) { return A.Balance && A.Balance.classOf ? A.Balance.classOf(p) : 'hybrid'; }

  /** ¿Puede aprenderlo? { ok, why, known, mageOnly, hybridOnly, racial } */
  function canLearn(p, spellOrId) {
    const spell = spellOf(spellOrId);
    if (!spell) return { ok: false, why: 'Ese hechizo no existe.' };
    if (!p || !p.hasMagic) return { ok: false, why: 'No podés canalizar magia.' };
    if ((p.spells || []).includes(spell.id)) return { ok: false, why: 'Ya lo conocés.', known: true };
    const race = spell.racial || spell.race;
    if (race && typeof race === 'string' && race !== p.raceId) return { ok: false, why: 'Es un hechizo de otra raza.', racial: true };
    if (spell.mageOnly && classOf(p) !== 'mage') return { ok: false, why: 'Solo los magos pueden aprenderlo.', mageOnly: true };
    if (spell.hybridOnly && classOf(p) !== 'hybrid') return { ok: false, why: 'Solo los híbridos pueden aprenderlo.', hybridOnly: true };
    // v3.3: los hechizos de los pergaminos piden su nivel
    if (spell.fromScroll && (p.level || 1) < (spell.tier || 1)) return { ok: false, why: `Necesitás nivel ${spell.tier} para aprenderlo.`, level: spell.tier };
    return { ok: true, why: '' };
  }

  /** Hechizos de una lista que este personaje podría aprender. */
  function learnable(p, ids) {
    return (ids || []).map(spellOf).filter((s) => s && canLearn(p, s).ok);
  }

  A.Spellbook = { canLearn, learnable };
})(window.Aventurs);
