/* ============================================================
   Aventurs — Escuelas de raza (v3.13, dossier secciones 7 a 9)

   Cada raza tiene su escuela (12 de magia) o su disciplina (6 de guerrero)
   con tres poderes: el de nacimiento, el de nivel 5 y el de nivel 9.
     - Nivel 5: lo enseña su maestro (se paga como un hechizo de nivel 5).
     - Nivel 9: el maestro te pone una prueba (misión). Al entregarla, te lo enseña.
   Los datos están en js/data/seed-v313.js (escuelas, hechizos, maestros y
   pruebas) y en js/systems/techniques.js (las técnicas de los guerreros).
   Lo que hacen en la pelea lo resuelve js/systems/combat.js.

   API:
     of(raceId) / forPlayer(p)   la escuela
     powers(p)                   los tres poderes, con su estado (para las pantallas)
     teach(p, id, source)        aprende un poder (lo usan el maestro y las pruebas)
     learnAt(npcId, id)          aprender con el maestro (paga)
     band(p) / diceOf(spell, p)  el tramo de nivel y el dado de daño de un hechizo de escuela
   ============================================================ */

(function (A) {
  'use strict';

  const RANKS = [5, 9];

  function list() { return (A.Seed && A.Seed.schools) || []; }
  function of(raceId) { return list().find((s) => s.race === raceId) || null; }
  function forPlayer(p) { return p ? of(p.raceId) : null; }
  function isMaster(npc) { return !!(npc && npc.school && of(npc.school)); }
  function masterOf(raceId) { const s = of(raceId); return s ? A.Data.getById('npcs', s.master) : null; }

  /** Tramo de nivel (el mismo de las pasivas): 1-4 · 5-8 · 9-12 · 13-16 · 17+ */
  function band(p) { return A.Passives && A.Passives.band ? A.Passives.band(p) : 0; }
  /** Un número que puede venir por tramo ([2, 3, 4, 5, 6]) o fijo. */
  function val(x, b) { return Array.isArray(x) ? x[Math.max(0, Math.min(x.length - 1, b))] : x; }
  /** El dado de daño de un hechizo para este personaje (los de escuela crecen por tramo). */
  function diceOf(spell, p) {
    if (!spell) return null;
    return spell.bandDice ? val(spell.bandDice, band(p)) : spell.damage;
  }
  /** El dado de los demás en un hechizo en cadena (Tormenta conductora). */
  function chainOf(spell, p) { return spell && spell.chain ? val(spell.chain, band(p)) : null; }

  function isTech(id) { return !!(A.Techniques && A.Techniques.get && A.Techniques.get(id)); }
  function birthTech(raceId) { return A.Techniques && A.Techniques.TECH ? A.Techniques.TECH[raceId] : null; }
  /** Los datos de un poder: { kind: 'spell'|'tech'|'birth', data } */
  function powerOf(id, raceId) {
    const sp = A.Data.getById('spells', id);
    if (sp) return { kind: 'spell', data: sp };
    if (isTech(id)) return { kind: 'tech', data: A.Techniques.get(id) };
    const bt = birthTech(raceId);
    if (bt && bt.id === id) return { kind: 'birth', data: bt };
    return null;
  }
  function knows(p, id) {
    if (!p) return false;
    if ((p.spells || []).includes(id) || (p.techniques || []).includes(id)) return true;
    const bt = birthTech(p.raceId);
    return !!(bt && bt.id === id); // la técnica de nacimiento la tiene siempre
  }

  function regionName(id) { const r = id ? A.Data.getById('regions', id) : null; return r ? r.name : ''; }
  function priceOf(rank) {
    const B = A.Balance;
    return B && B.Economy && B.Economy.spellPrice ? B.Economy.spellPrice({ tier: rank }) : rank * 40;
  }
  function questStatus(id) { return A.Quests && A.Quests.status ? A.Quests.status(id) : 'hidden'; }

  /** Texto corto de lo que hace un poder (para las listas). */
  function whatOf(p, pw) {
    if (!pw) return '';
    const b = band(p);
    if (pw.kind === 'tech' || pw.kind === 'birth') return pw.data.text ? pw.data.text(b) : '';
    return pw.data.description || '';
  }

  /**
   * Los tres poderes de tu escuela, con su estado:
   *   known  ya lo tenés
   *   learn  el maestro te lo puede enseñar ahora (nivel 5)
   *   level  todavía no tenés el nivel
   *   trial  tenés el nivel: pedile la prueba al maestro (nivel 9)
   *   doing  la prueba está en curso · ready: volvé con el maestro
   */
  function powers(p) {
    const sc = forPlayer(p);
    if (!sc) return [];
    const master = A.Data.getById('npcs', sc.master);
    const out = [];
    const birth = powerOf(sc.birth, p.raceId);
    if (birth) out.push({ rank: 1, id: sc.birth, kind: birth.kind, data: birth.data, name: birth.data.name, text: whatOf(p, birth), state: 'known' });
    for (const rank of RANKS) {
      const id = sc[`r${rank}`];
      const pw = powerOf(id, p.raceId);
      if (!pw) continue;
      let state = 'known';
      if (!knows(p, id)) {
        if ((p.level || 1) < rank) state = 'level';
        else if (rank === 5) state = 'learn';
        else {
          const qs = questStatus(sc.trial);
          state = qs === 'active' ? 'doing' : qs === 'ready' ? 'ready' : 'trial';
        }
      }
      out.push({ rank, id, kind: pw.kind, data: pw.data, name: pw.data.name, text: whatOf(p, pw), state, price: rank === 5 ? priceOf(rank) : 0,
        master: master ? master.name : '', where: master ? regionName(master.region) : '' });
    }
    return out;
  }

  /** Lo que sigue para este personaje (para los avisos): la primera que puede aprender o la prueba. */
  function nextStep(p) {
    const sc = forPlayer(p);
    if (!sc) return null;
    const row = powers(p).find((r) => r.state === 'learn' || r.state === 'trial' || r.state === 'ready');
    if (!row) return null;
    const verb = row.state === 'learn' ? `te puede enseñar ${row.name}` : row.state === 'ready' ? `te espera para enseñarte ${row.name}` : `te tiene una prueba para aprender ${row.name}`;
    return { row, text: `${row.master}, en ${row.where}, ${verb}.` };
  }

  /** ¿Te lo puede enseñar este maestro ahora? { ok, why, price } */
  function canLearnAt(p, npc, id) {
    if (!p || !npc) return { ok: false, why: 'No hay nadie para enseñarte.' };
    const sc = of(npc.school);
    if (!sc || sc.race !== p.raceId) return { ok: false, why: 'Este maestro enseña a otra raza.' };
    if (knows(p, id)) return { ok: false, why: 'Ya lo sabés.', known: true };
    if (id !== sc.r5) return { ok: false, why: id === sc.r9 ? 'Ese se aprende pasando la prueba del maestro.' : 'No lo enseña.' };
    if ((p.level || 1) < 5) return { ok: false, why: 'Necesitás nivel 5.', level: 5 };
    const price = priceOf(5);
    if (A.Currency && !A.Currency.canPay(price)) return { ok: false, why: `Cuesta ${price} cobre.`, price, money: true };
    return { ok: true, why: '', price };
  }

  /** Aprende un poder de la escuela (sin pagar: lo usan el maestro y las pruebas). */
  function teach(p, id, source) {
    if (!p || !id || knows(p, id)) return false;
    const pw = powerOf(id, p.raceId);
    if (!pw) return false;
    if (pw.kind === 'spell') { p.spells = p.spells || []; p.spells.push(id); }
    else if (pw.kind === 'tech') { p.techniques = p.techniques || []; p.techniques.push(id); }
    else return false;
    if (A.Bus) A.Bus.emit('school:learned', { id, source: source || 'school' });
    return true;
  }

  /** Aprender con el maestro (paga). { ok, error, price } */
  function learnAt(npcId, id) {
    const npc = A.Data.getById('npcs', npcId);
    const p = A.State.player;
    const can = canLearnAt(p, npc, id);
    if (!can.ok) return { ok: false, error: can.why };
    A.Currency.pay(can.price);
    teach(p, id, 'master');
    const pw = powerOf(id, p.raceId);
    A.State.addChronicle({ type: 'spell', text: `${npc.name} te enseñó ${pw.data.name}. Pagaste ${can.price}c.` });
    if (A.Bus) A.Bus.emit('spell:learned', { spellId: id, source: 'npc', npcId });
    A.State.persist();
    return { ok: true, price: can.price };
  }

  // ---------- Avisos ----------
  function toast(text) {
    if (A.Views && A.Views.Party && A.Views.Party.toast) A.Views.Party.toast(text, 'good', 'book');
  }
  /** Al llegar al nivel 5 o 9: tu maestro te espera. */
  function onLeveled(ev) {
    const p = A.State && A.State.player;
    const lv = ev && ev.newLevel;
    if (!p || !RANKS.includes(lv)) return;
    const sc = forPlayer(p);
    if (!sc) return;
    const id = sc[`r${lv}`];
    if (!id || knows(p, id)) return;
    const master = A.Data.getById('npcs', sc.master);
    const pw = powerOf(id, p.raceId);
    if (!master || !pw) return;
    const how = lv === 5 ? `te puede enseñar ${pw.data.name}` : `te tiene una prueba para enseñarte ${pw.data.name}`;
    const text = `${sc.name}: ${master.name}, en ${regionName(master.region)}, ${how}.`;
    A.State.addChronicle({ type: 'system', text });
    toast(text);
  }
  /** v3.13: a los personajes que ya pasaron el nivel 5, un aviso (una sola vez) de que llegaron las escuelas. */
  function onLoaded() {
    const p = A.State && A.State.player;
    if (!p || p.schoolNotice || (p.level || 1) < 5) return;
    const step = nextStep(p);
    p.schoolNotice = 1;
    if (!step) return;
    const sc = forPlayer(p);
    const text = `Novedad: la escuela de tu raza (${sc.name}). ${step.text}`;
    A.State.addChronicle({ type: 'system', text });
    setTimeout(() => toast(text), 900);
    A.State.persist();
  }
  if (A.Bus) {
    A.Bus.on('player:leveled', onLeveled);
    A.Bus.on('state:loaded', onLoaded);
    A.Bus.on('player:created', () => { const p = A.State && A.State.player; if (p) p.schoolNotice = 1; });
  }

  A.Schools = { RANKS, list, of, forPlayer, isMaster, masterOf, band, val, diceOf, chainOf, powerOf, knows, powers, nextStep, canLearnAt, teach, learnAt, priceOf };
})(window.Aventurs);
