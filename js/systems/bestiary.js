/* ============================================================
   Aventurs — Bestiario (v3.1)

   Las criaturas aparecen como "???" hasta que las ves.
   Se guarda en player.bestiary:
     { [enemyId]: { seen, killed, studied, day } }
       seen     cuántas veces la viste (en una escena o una pelea)
       killed   cuántas veces la venciste
       studied  la observaste con calma ("Observar" al explorar)
       day      el día que la viste por primera vez

   Lo que se ve de cada una:
     sin ver   silueta y "???"
     vista     nombre, nivel, dónde y cuándo sale, vida, daño y dado
     conocida  (observada o vencida 3 veces) además sus habilidades y su botín

   Partidas de antes de la v3.1: se dan por vistas las criaturas de las
   zonas donde ya peleaste.
   ============================================================ */

(function (A) {
  'use strict';

  const KNOW_KILLS = 3; // vencerla 3 veces enseña lo mismo que observarla

  function player() { return A.State && A.State.player; }

  function migrate(p) {
    const out = {};
    const enc = p.regionEncounters || {};
    for (const rid of Object.keys(enc)) {
      const n = enc[rid] || 0;
      if (n <= 0) continue;
      for (const e of A.Data.enemiesInRegion(rid)) {
        if (e.category === 'boss') continue;
        if (n >= 5 || (e.tier || 1) <= (p.level || 1)) out[e.id] = { seen: 1, killed: 0, day: 0 };
      }
    }
    return out;
  }

  function book() {
    const p = player();
    if (!p) return {};
    if (!p.bestiary || typeof p.bestiary !== 'object' || Array.isArray(p.bestiary)) p.bestiary = migrate(p);
    return p.bestiary;
  }

  function entry(id) { return book()[id] || null; }
  function isKnown(id) { const e = entry(id); return !!(e && ((e.seen || 0) > 0 || (e.killed || 0) > 0 || e.studied)); }
  function isStudied(id) { const e = entry(id); return !!(e && (e.studied || (e.killed || 0) >= KNOW_KILLS)); }

  function touch(id) {
    const b = book();
    if (!b[id]) b[id] = { seen: 0, killed: 0, day: (A.State.world && A.State.world.day) || 1 };
    return b[id];
  }

  function idsOf(list) {
    const out = [];
    for (const x of list || []) {
      const id = typeof x === 'string' ? x : x && x.id;
      if (id && !out.includes(id) && A.Data.getById('enemies', id)) out.push(id);
    }
    return out;
  }

  /** La viste: si es la primera vez, entra al bestiario (y se avisa). */
  function see(list) {
    if (!player()) return [];
    const fresh = [];
    for (const id of idsOf(list)) {
      const e = touch(id);
      if (!(e.seen || 0) && !(e.killed || 0) && !e.studied) fresh.push(id);
      e.seen = (e.seen || 0) + 1;
    }
    const hid = A.State.hidOf ? A.State.hidOf(player()) : 'me';
    for (const id of fresh) {
      const data = A.Data.getById('enemies', id);
      A.State.addChronicle({ type: 'note', text: `Nueva criatura en el bestiario: ${data ? data.name : id}.` });
      A.Bus.emit('bestiary:new', { enemyId: id, hid });
    }
    return fresh;
  }

  function kill(list) {
    // cada una cuenta (tres zorros son tres vencidas)
    for (const x of list || []) {
      const id = typeof x === 'string' ? x : x && x.id;
      if (!id || !A.Data.getById('enemies', id)) continue;
      const e = touch(id);
      e.killed = (e.killed || 0) + 1;
      if (!e.seen) e.seen = 1;
    }
  }

  /** La observaste con calma: se ve todo de ella. */
  function study(list) {
    const fresh = [];
    for (const id of idsOf(list)) {
      const e = touch(id);
      if (!e.seen) e.seen = 1;
      if (!isStudied(id)) fresh.push(id);
      e.studied = true;
    }
    return fresh;
  }

  function counts() {
    const all = A.Data.enemies || [];
    let known = 0;
    let studied = 0;
    for (const e of all) {
      if (isKnown(e.id)) known++;
      if (isStudied(e.id)) studied++;
    }
    return { known, studied, total: all.length };
  }

  /** Lo que suelta (sin las monedas), para mostrarlo cuando ya la conocés. */
  function dropsOf(e) {
    const seen = new Set();
    const out = [];
    for (const d of (e && e.drops) || []) {
      if (!d || !d.itemId || d.itemId.startsWith('coin_') || !(d.chance > 0) || seen.has(d.itemId)) continue;
      const it = A.Inventory && A.Inventory.resolveData ? A.Inventory.resolveData(d.itemId) : A.Data.getById('items', d.itemId);
      if (!it) continue;
      seen.add(d.itemId);
      out.push({ id: d.itemId, name: it.name, chance: d.chance });
    }
    return out.sort((a, b) => b.chance - a.chance);
  }

  if (A.Bus) {
    // de sistema: cuenta para cada héroe del grupo en su propio bestiario
    A.Bus.on('combat:victory', ({ enemyIds }) => kill(enemyIds), { sys: true });
    // aviso en pantalla (solo para el que la descubrió en esta compu)
    A.Bus.on('bestiary:new', ({ enemyId, hid }) => {
      const me = A.State.me ? A.State.me() : player();
      if (hid && A.State.hidOf && me && hid !== A.State.hidOf(me)) return;
      const data = A.Data.getById('enemies', enemyId);
      if (data && A.Views && A.Views.Party && A.Views.Party.toast) A.Views.Party.toast(`Nueva en el bestiario: ${data.name}`, 'good', 'skulls');
    });
  }

  A.Bestiary = { entry, isKnown, isStudied, see, kill, study, counts, dropsOf, KNOW_KILLS };
})(window.Aventurs);
