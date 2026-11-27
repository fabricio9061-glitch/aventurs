/* ============================================================
   Aventurs — Escuelas de raza (v3.13, dossier secciones 7 a 9)

   Cada raza tiene su escuela (12 de magia) o su disciplina (6 de guerrero)
   con siete poderes: el de nacimiento y los de los niveles 5, 9, 13, 17, 21 y 25.
     - Niveles 5, 13 y 21: los enseña su maestro (se pagan).
     - Niveles 9, 17 y 25: el maestro te pone una prueba (misión). Al entregarla, te lo enseña.
   v3.14: es la única magia que hay: los sabios ya no enseñan hechizos comunes y los
   pergaminos no se aprenden. Lo que ya habías aprendido se quita y se devuelve
   (migrateMagic, una sola vez por personaje).
   Los datos están en js/data/seed-escuelas.js (escuelas), seed-spells/npcs (hechizos, maestros y
   pruebas) y en js/systems/techniques.js (las técnicas de los guerreros).
   Lo que hacen en la pelea lo resuelve js/systems/combat.js.

   API:
     of(raceId) / forPlayer(p)   la escuela
     powers(p)                   los siete poderes, con su estado (para las pantallas)
     teach(p, id, source)        aprende un poder (lo usan el maestro y las pruebas)
     learnAt(npcId, id)          aprender con el maestro (paga)
     band(p) / diceOf(spell, p)  el tramo de nivel y el dado de daño de un hechizo de escuela
   ============================================================ */

(function (A) {
  'use strict';

  const RANKS = [5, 9, 13, 17, 21, 25];
  /** v3.14: los que enseña el maestro pagando; los demás (9, 17, 25) se ganan con una prueba. */
  const PAID = [5, 13, 21];
  const isPaid = (rank) => PAID.includes(rank);
  /** La prueba de cada nivel (la de 9 es la de la v3.13). */
  function trialOf(sc, rank) { return !sc ? null : rank === 9 ? sc.trial : rank === 17 ? sc.trial17 : rank === 25 ? sc.trial25 : null; }

  function list() { return (A.Seed && A.Seed.schools) || []; }
  function of(raceId) { return list().find((s) => s.race === raceId) || null; }
  function forPlayer(p) { return p ? of(p.raceId) : null; }
  function isMaster(npc) { return !!(npc && npc.school && of(npc.school)); }
  function masterOf(raceId) { const s = of(raceId); return s ? A.Data.getById('npcs', s.master) : null; }
  /** v3.21.6: dónde vive el maestro de una raza: { school, npc, region, fem }. */
  function whereMaster(raceId) {
    const s = of(raceId); const npc = s ? A.Data.getById('npcs', s.master) : null;
    if (!npc) return null;
    return { school: s, npc, region: A.Data.getById('regions', npc.region) || null, fem: /^Maestra/.test(npc.roleName || '') };
  }

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
   * Los siete poderes de tu escuela, con su estado:
   *   known  ya lo tenés
   *   learn  el maestro te lo puede enseñar ahora (niveles 5, 13 y 21)
   *   level  todavía no tenés el nivel
   *   trial  tenés el nivel: pedile la prueba al maestro (niveles 9, 17 y 25)
   *   doing  la prueba está en curso · ready: volvé con el maestro
   */
  function powers(p) {
    const sc = forPlayer(p);
    if (!sc) return [];
    const master = A.Data.getById('npcs', sc.master);
    const out = [];
    const birth = powerOf(sc.birth, p.raceId);
    if (birth) out.push({ rank: 1, id: sc.birth, kind: birth.kind, data: birth.data, name: birth.data.name, text: whatOf(p, birth), state: 'known' });
    // v3.14: el ángel y la dríade nacen también con su curación
    const heal = sc.heal ? powerOf(sc.heal, p.raceId) : null;
    if (heal) out.push({ rank: 1, id: sc.heal, kind: heal.kind, data: heal.data, name: heal.data.name, text: whatOf(p, heal), state: knows(p, sc.heal) ? 'known' : 'learn', birthHeal: true });
    for (const rank of RANKS) {
      const id = sc[`r${rank}`];
      const pw = powerOf(id, p.raceId);
      if (!pw) continue;
      let state = 'known';
      if (!knows(p, id)) {
        if ((p.level || 1) < rank) state = 'level';
        else if (isPaid(rank)) state = 'learn';
        else {
          const qs = questStatus(trialOf(sc, rank));
          state = qs === 'active' ? 'doing' : qs === 'ready' ? 'ready' : 'trial';
        }
      }
      out.push({ rank, id, kind: pw.kind, data: pw.data, name: pw.data.name, text: whatOf(p, pw), state, price: isPaid(rank) ? priceOf(rank) : 0, paid: isPaid(rank), trial: isPaid(rank) ? null : trialOf(sc, rank),
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
    if (sc.heal && id === sc.heal) return { ok: true, why: '', price: 0 }; // v3.14: la curación de nacimiento (si faltara)
    const rank = RANKS.find((r) => sc[`r${r}`] === id);
    if (!rank) return { ok: false, why: 'No lo enseña.' };
    if (!isPaid(rank)) return { ok: false, why: 'Ese se aprende pasando la prueba del maestro.' };
    if ((p.level || 1) < rank) return { ok: false, why: `Necesitás nivel ${rank}.`, level: rank };
    const price = priceOf(rank);
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

  // ---------- v3.14: la magia es de tu raza ----------
  /** ¿Es magia de tu raza? (la de nacimiento o la de tu escuela) */
  function isOwnMagic(p, spellOrId) {
    const sp = typeof spellOrId === 'string' ? A.Data.getById('spells', spellOrId) : spellOrId;
    if (!sp || !p) return false;
    if (sp.racial || sp.race) return (sp.racial || sp.race) === p.raceId;
    const race = A.Data.getById('races', p.raceId);
    return !!(race && race.startSpell === sp.id); // una raza nueva del editor que nace con un hechizo común
  }
  /** Lo que costaba aprender un hechizo antes de la v3.14 (para devolverlo). */
  function oldSpellPrice(sp) {
    const E = A.Balance && A.Balance.Economy;
    const curve = E && E.priceCurve ? E.priceCurve((sp && sp.tier) || 1) : 1;
    return Math.max(30, Math.round(25 * curve * 1.5));
  }
  /**
   * v3.14: saca los hechizos que no son de tu raza y devuelve lo que costaron: el
   * pergamino si lo aprendiste de un pergamino, o las monedas si te lo enseñó un sabio.
   * Los Pergaminos de hechizo que quedaban en la mochila se venden solos. Una sola vez
   * por personaje (p.magicV314). Devuelve { removed, scrolls, coins } o null.
   */
  function migrateMagic(p) {
    if (!p || p.magicV314) return null;
    p.magicV314 = 1;
    const removed = [], scrolls = [];
    let coins = 0;
    const isMe = p === (A.State && A.State.player);
    const give = (id) => {
      if (isMe && A.State.addItem) { A.State.addItem(id, 1); return; }
      const slot = (p.inventory = p.inventory || []).find((x) => x.itemId === id);
      if (slot) slot.qty += 1; else p.inventory.push({ itemId: id, qty: 1 });
    };
    for (const id of (p.spells || []).slice()) {
      const sp = A.Data.getById('spells', id);
      if (sp && isOwnMagic(p, sp)) continue;
      p.spells = p.spells.filter((x) => x !== id);
      if (!sp) continue;
      removed.push(sp.name);
      const scroll = sp.fromScroll && A.Data.getById('items', sp.fromScroll) ? A.Data.getById('items', sp.fromScroll) : null;
      if (scroll) { give(scroll.id); scrolls.push(scroll.name); } else coins += oldSpellPrice(sp);
    }
    const sc = forPlayer(p);
    let healed = null;
    if (sc && sc.heal && !(p.spells || []).includes(sc.heal) && A.Data.getById('spells', sc.heal)) { (p.spells = p.spells || []).push(sc.heal); healed = A.Data.getById('spells', sc.heal).name; }
    const retired = (A.Seed && A.Seed.retiredItems) || [];
    let sold = 0;
    for (const slot of (p.inventory || []).slice()) {
      if (!retired.includes(slot.itemId)) continue;
      const it = A.Data.getById('items', slot.itemId);
      sold += Math.max(1, Math.floor(((it && it.value) || 2) / 2)) * (slot.qty || 1);
      p.inventory = p.inventory.filter((x) => x !== slot);
    }
    coins += sold;
    if (coins > 0) {
      if (isMe && A.Currency) A.Currency.add(coins);
      else { const slot = (p.inventory = p.inventory || []).find((x) => x.itemId === 'coin_copper'); if (slot) slot.qty += coins; else p.inventory.push({ itemId: 'coin_copper', qty: coins }); }
    }
    return { removed, scrolls, coins, sold, healed };
  }

  // ---------- Avisos ----------
  function toast(text) {
    if (A.Views && A.Views.Party && A.Views.Party.toast) A.Views.Party.toast(text, 'good', 'book');
  }
  /** Al llegar al nivel 5, 9, 13, 17, 21 o 25: tu maestro te espera. */
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
    const how = isPaid(lv) ? `te puede enseñar ${pw.data.name}` : `te tiene una prueba para enseñarte ${pw.data.name}`;
    const text = `${sc.name}: ${master.name}, en ${regionName(master.region)}, ${how}.`;
    A.State.addChronicle({ type: 'system', text });
    toast(text);
  }
  /** v3.13: a los personajes que ya pasaron el nivel 5, un aviso (una sola vez) de que llegaron las escuelas. */
  function onLoaded() {
    const p = A.State && A.State.player;
    if (!p) return;
    // v3.14: la magia común se va (una sola vez), con lo que costó de vuelta
    const mig = migrateMagic(p);
    if (mig && (mig.removed.length || mig.sold || mig.healed)) {
      const parts = [];
      if (mig.removed.length) parts.push(`ya no sabés ${mig.removed.join(', ')} (la magia ahora es solo la de tu raza)`);
      if (mig.scrolls.length) parts.push(`te devolvieron ${mig.scrolls.length === 1 ? 'el pergamino' : `${mig.scrolls.length} pergaminos`} (se usan en la pelea)`);
      if (mig.coins > 0) parts.push(`te devolvieron ${A.Currency && A.Currency.formatPrice ? A.Currency.formatPrice(mig.coins) : `${mig.coins} de cobre`}${mig.sold ? ' (con lo de los Pergaminos de hechizo, que ya no existen)' : ''}`);
      if (mig.healed) parts.push(`tu raza se cura con su propia magia: ya sabés ${mig.healed}`);
      const text = `Cambios de la versión 3.14: ${parts.join('; ')}.`;
      A.State.addChronicle({ type: 'system', text });
      setTimeout(() => toast('La magia ahora es solo la de tu raza: lo que habías aprendido de los sabios te lo devolvieron.'), 1400);
      A.State.persist();
    }
    if (p.schoolNotice || (p.level || 1) < 5) return;
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
    A.Bus.on('player:created', () => {
      const p = A.State && A.State.player;
      if (!p) return;
      p.schoolNotice = 1;
      p.magicV314 = 1;
      const sc = forPlayer(p); // v3.14: el ángel y la dríade nacen sabiendo curarse
      if (sc && sc.heal && A.Data.getById('spells', sc.heal) && !(p.spells || []).includes(sc.heal)) (p.spells = p.spells || []).push(sc.heal);
    });
  }

  A.Schools = { RANKS, PAID, isPaid, trialOf, list, of, forPlayer, isMaster, masterOf, whereMaster, band, val, diceOf, chainOf, powerOf, knows, powers, nextStep, canLearnAt, teach, learnAt, priceOf, migrateMagic, isOwnMagic };
})(window.Aventurs);
