/* ============================================================
   Aventurs — Misiones (v2.0)

   Guarda el avance en player.quests:
     { active: { [id]: { progress: [n, n, ...], day } }, done: [id, ...] }

   Escucha lo que pasa en el juego (Bus) y avanza los objetivos:
     combat:victory  -> kill
     explore:done    -> explore
     region:changed  -> visit
     talkTo(npcId)   -> talk (lo llama la pantalla del habitante)
   collect y have se miran en la mochila en el momento.

   Las que tienen turnIn hay que entregarlas al que las dio; las otras
   se cobran solas apenas se cumplen. Si la siguiente de la cadena es
   "auto", empieza sola.
   ============================================================ */

(function (A) {
  'use strict';

  // v2.2: las misiones también se pueden editar (Data.quests = juego + cambios del editor)
  function list() { return (A.Data && A.Data.quests && A.Data.quests.length ? A.Data.quests : (A.Seed && A.Seed.quests)) || []; }
  function get(id) { return list().find((q) => q.id === id) || null; }
  function player() { return A.State.player; }

  function state() {
    const p = player();
    if (!p) return { active: {}, done: [] };
    if (!p.quests || typeof p.quests !== 'object') p.quests = { active: {}, done: [] };
    if (!p.quests.active) p.quests.active = {};
    if (!Array.isArray(p.quests.done)) p.quests.done = [];
    return p.quests;
  }

  function isDone(id) { return state().done.includes(id); }
  function isActive(id) { return !!state().active[id]; }

  function countItem(itemId) {
    const p = player();
    if (!p) return 0;
    let n = 0;
    for (const s of p.inventory || []) if (s.itemId === itemId) n += s.qty || 0;
    if (p.equipment && (p.equipment.weapon === itemId || p.equipment.armor === itemId)) n += 1;
    return n;
  }

  function npcName(id) {
    const n = A.Data.getById('npcs', id);
    return n ? n.name : id;
  }
  function regionName(id) {
    const r = A.Data.getById('regions', id);
    return r ? r.name : id;
  }
  function enemyName(id, plural) {
    const e = A.Data.getById('enemies', id);
    const base = e ? e.name.toLowerCase() : id;
    if (!plural) return base;
    if (/[aeiouáéó]$/i.test(base)) return base + 's';
    if (/z$/i.test(base)) return base.slice(0, -1) + 'ces';
    return base + 'es';
  }
  function itemName(id) {
    const it = A.Inventory && A.Inventory.resolveData ? A.Inventory.resolveData(id) : A.Data.getById('items', id);
    return it ? it.name : id;
  }

  // ============================================================
  // Objetivos
  // ============================================================

  /** Texto de un objetivo, ej: "Derrotá 3 esqueletos". */
  function objectiveText(o) {
    if (o.text) return o.text;
    const n = o.count || 1;
    switch (o.type) {
      case 'kill': {
        const ids = Array.isArray(o.enemy) ? o.enemy : [o.enemy];
        const names = ids.map((id) => enemyName(id, n > 1));
        return `Derrotá ${n > 1 ? n + ' ' : 'a '}${names.join(' o ')}`;
      }
      case 'collect': return `Conseguí ${n > 1 ? n + ' × ' : ''}${itemName(o.item)}`;
      case 'have': return `Conseguí ${itemName(o.item)}`;
      case 'explore': return `Explorá ${regionName(o.region)}${n > 1 ? ` (${n} veces)` : ''}`;
      case 'visit': return `Llegá a ${regionName(o.region)}`;
      case 'talk': return `Hablá con ${npcName(o.npc)}`;
      default: return 'Objetivo';
    }
  }

  /** Avance { have, need, done } de un objetivo de una misión activa. */
  function objectiveProgress(q, i) {
    const o = q.objectives[i];
    const need = o.count || 1;
    if (o.type === 'collect' || o.type === 'have') {
      const have = Math.min(need, countItem(o.item));
      return { have, need, done: have >= need };
    }
    const st = state().active[q.id];
    const have = Math.min(need, st && st.progress ? (st.progress[i] || 0) : 0);
    return { have, need, done: have >= need };
  }

  function allObjectivesDone(q) {
    return q.objectives.every((_, i) => objectiveProgress(q, i).done);
  }

  // ============================================================
  // Estado de cada misión
  // ============================================================

  /** 'done' | 'ready' (lista para entregar) | 'active' | 'available' | 'locked' | 'hidden' */
  function status(id) {
    const q = get(id);
    if (!q) return 'hidden';
    if (isDone(id)) return 'done';
    if (isActive(id)) return allObjectivesDone(q) && q.turnIn ? 'ready' : 'active';
    if (q.requires && !isDone(q.requires)) return 'hidden';
    if (q.auto) return 'hidden';
    const lvl = (player() && player().level) || 1;
    if (q.minLevel && lvl < q.minLevel) return 'locked';
    return 'available';
  }

  /** Misiones que ofrece, espera o recibe un habitante. */
  function forNpc(npcId) {
    const out = { offer: [], locked: [], ready: [], active: [], talk: [] };
    for (const q of list()) {
      const st = status(q.id);
      if (q.giver === npcId) {
        if (st === 'available') out.offer.push(q);
        else if (st === 'locked') out.locked.push(q);
        else if (st === 'ready') out.ready.push(q);
        else if (st === 'active') out.active.push(q);
      }
      // Misiones activas que piden hablar con este habitante
      if (st === 'active' || st === 'ready') {
        q.objectives.forEach((o, i) => {
          if (o.type === 'talk' && o.npc === npcId && !objectiveProgress(q, i).done) out.talk.push(q);
        });
      }
    }
    return out;
  }

  /** Marca para el retrato: 'ready' (?), 'offer' (!), 'talk' (?) o null. */
  function markerFor(npcId) {
    const f = forNpc(npcId);
    if (f.ready.length) return 'ready';
    if (f.talk.length) return 'talk';
    if (f.offer.length) return 'offer';
    return null;
  }

  function activeList() {
    const ids = Object.keys(state().active);
    return ids.map(get).filter(Boolean).sort((a, b) => (b.main ? 1 : 0) - (a.main ? 1 : 0));
  }
  function doneList() { return state().done.map(get).filter(Boolean); }

  // ============================================================
  // Acciones
  // ============================================================

  function startQuest(id, silent) {
    const q = get(id);
    if (!q || isDone(id) || isActive(id)) return false;
    state().active[id] = { progress: q.objectives.map(() => 0), day: (A.State.world && A.State.world.day) || 1 };
    // Objetivos que ya están cumplidos al aceptar (ej: ya estás en la región)
    q.objectives.forEach((o, i) => {
      if (o.type === 'visit' && A.State.world && A.State.world.regionId === o.region) state().active[id].progress[i] = 1;
    });
    if (!silent) A.State.addChronicle({ type: 'quest', text: `Nueva misión: ${q.title}.` });
    A.Bus.emit('quest:started', { id });
    A.State.persist();
    checkAuto();
    return true;
  }

  /** Aceptar una misión que ofrece un habitante. */
  function accept(id) {
    if (status(id) !== 'available') return false;
    return startQuest(id);
  }

  function grantReward(q) {
    const r = q.reward || {};
    const out = { text: '' };
    if (r.coins) { out.coins = r.coins; out.coinsFlat = true; }
    if (r.xp) { out.xp = r.xp; out.xpFlat = true; }
    if (r.items) out.items = r.items.map(([id, n]) => [id, n, n]);
    return A.Rewards ? A.Rewards.apply(out, {}) : [];
  }

  function complete(id) {
    const q = get(id);
    if (!q || !isActive(id)) return null;
    // Las misiones de "juntar" se llevan los objetos
    for (const o of q.objectives) {
      if (o.type === 'collect') A.State.removeItem(o.item, o.count || 1);
    }
    delete state().active[id];
    state().done.push(id);
    const chips = grantReward(q);
    const line = chips.map((c) => (A.Rewards ? A.Rewards.chipText(c) : '')).filter(Boolean).join(', ');
    A.State.addChronicle({ type: 'quest', text: `Misión cumplida: ${q.title}. ${q.done || ''}${line ? ` (${line})` : ''}`.trim() });
    A.Bus.emit('quest:completed', { id, chips });
    A.Bus.emit('inventory:changed');
    // La que sigue en la cadena
    const next = q.next ? get(q.next) : null;
    if (next && next.auto) startQuest(next.id);
    A.State.persist();
    return { quest: q, chips };
  }

  /** Entregar una misión lista (la llama la pantalla del habitante). */
  function turnIn(id) {
    if (status(id) !== 'ready') return null;
    return complete(id);
  }

  /** Las que se cobran solas (sin volver con nadie). */
  function checkAuto() {
    let changed = false;
    for (const q of activeList()) {
      if (!q.turnIn && allObjectivesDone(q)) {
        const res = complete(q.id);
        if (res) {
          changed = true;
          A.Bus.emit('quest:auto-completed', { id: q.id, chips: res.chips });
        }
      }
    }
    return changed;
  }

  function bump(pred) {
    let any = false;
    for (const q of activeList()) {
      const st = state().active[q.id];
      q.objectives.forEach((o, i) => {
        if (!pred(o)) return;
        const need = o.count || 1;
        if ((st.progress[i] || 0) >= need) return;
        st.progress[i] = (st.progress[i] || 0) + 1;
        any = true;
        if (st.progress[i] >= need) {
          A.State.addChronicle({ type: 'quest', text: `${q.title}: cumpliste "${objectiveText(o)}".` });
        }
      });
    }
    if (any) {
      A.Bus.emit('quest:progress', {});
      checkAuto();
      A.State.persist();
    }
    return any;
  }

  /** Hablar con un habitante (cumple los objetivos "talk"). */
  function talkTo(npcId) {
    return bump((o) => o.type === 'talk' && o.npc === npcId);
  }

  // ============================================================
  // Escuchar el juego
  // ============================================================

  function onVictory({ enemyIds }) {
    for (const eid of enemyIds || []) {
      bump((o) => o.type === 'kill' && (Array.isArray(o.enemy) ? o.enemy.includes(eid) : o.enemy === eid));
    }
  }

  function onExplore({ regionId }) { bump((o) => o.type === 'explore' && o.region === regionId); }
  function onRegion({ toId }) { bump((o) => o.type === 'visit' && o.region === toId); }

  function onInventory() {
    // "have": puede cumplirse al conseguir el objeto (y cobrarse sola)
    if (activeList().some((q) => !q.turnIn && q.objectives.some((o) => o.type === 'have' || o.type === 'collect'))) checkAuto();
  }

  /** Al empezar una partida nueva: la primera misión del hilo principal ya está esperando en el guardia. */
  function onCreated() { state(); }

  if (A.Bus) {
    A.Bus.on('combat:victory', onVictory);
    A.Bus.on('explore:done', onExplore);
    A.Bus.on('region:changed', onRegion);
    A.Bus.on('inventory:changed', onInventory);
    A.Bus.on('player:created', onCreated);
  }

  A.Quests = {
    list,
    get,
    status,
    forNpc,
    markerFor,
    activeList,
    doneList,
    objectiveText,
    objectiveProgress,
    allObjectivesDone,
    accept,
    turnIn,
    talkTo,
    checkAuto,
    npcName,
  };
})(window.Aventurs);
