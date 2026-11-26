/* ============================================================
   Aventurs — Oficios: en qué gastar la plata (v3.20)

   Herrero   - mejora el arma y la armadura que tenés puestas, de +1 a +5.
               Cada nivel pide monedas (según lo que vale la pieza) y
               Gemas de temple (1, 2, 3, 4 y 5: quince para llegar a +5).
               Cada + da un punto: el arma, precisión en +1, +3 y +4 y
               daño en +2 y +5; la armadura, defensa y armadura igual.
               Con tu nivel: +1 desde el 5, +2 desde el 9 ... +5 desde el 21.
               La mejora queda en esa pieza (p.forge[id]) aunque la guardes.
   Posada    - comidas especiales: llenan la panza y dan una ayudita
               por un día entero (p.meal). Una por vez.
   Carruaje  - de un pueblo que ya conocés a otro, sin peleas en el camino.
               En grupo lo toma el anfitrión y viajan todos.
   Lucirse   - marcos para tu retrato y títulos (p.look, p.owned).
   ============================================================ */

(function (A) {
  'use strict';

  const MAX = 5;
  const GEM = 'gema_temple';
  /** Parte del valor de la pieza que cuesta cada nivel (+1 a +5): llegar a +5 sale 15 veces lo que vale. */
  const COST_MULT = [0.8, 1.6, 2.8, 4, 6];
  const GEMS = [1, 2, 3, 4, 5];
  const MIN_COST = [30, 60, 120, 200, 320];

  function St() { return A.State; }
  function gearOf(p, slot) {
    const id = p && p.equipment ? p.equipment[slot] : null;
    if (!id) return null;
    return A.Data.getById(slot === 'weapon' ? 'weapons' : 'armors', id);
  }

  // ---------------- Herrero ----------------

  function levelOf(p, id) { return (p && p.forge && id && p.forge[id]) || 0; }

  /** Lo que suma una pieza con esa mejora. */
  // v3.20 (medido): cada nivel suma 1 punto, más precisión que daño (el daño pesa mucho más en la pelea).
  // +1 precisión · +2 daño · +3 precisión · +4 precisión · +5 daño (la armadura igual: defensa y armadura)
  const SOFT = [0, 1, 1, 2, 3, 3];
  const HARD = [0, 0, 1, 1, 1, 2];
  function bonusAt(slot, lvl) {
    const l = Math.max(0, Math.min(MAX, lvl || 0));
    return slot === 'weapon' ? { damage: HARD[l], precision: SOFT[l], armor: 0, defense: 0 } : { damage: 0, precision: 0, armor: HARD[l], defense: SOFT[l] };
  }

  /** Hasta qué + te deja llegar el herrero con tu nivel: +1 desde el 5, +2 desde el 9... +5 desde el 21. */
  function capFor(level) { return Math.max(0, Math.min(MAX, Math.floor(((level || 1) - 1) / 4))); }

  /** Lo que suman el arma y la armadura mejoradas que tenés puestas. */
  function gearBonus(p) {
    const out = { damage: 0, precision: 0, armor: 0, defense: 0 };
    if (!p || !p.forge || !p.equipment) return out;
    for (const slot of ['weapon', 'armor']) {
      const lvl = levelOf(p, p.equipment[slot]);
      if (!lvl) continue;
      const b = bonusAt(slot, lvl);
      for (const k of Object.keys(out)) out[k] += b[k];
    }
    return out;
  }

  function bonusText(slot, lvl) {
    const b = bonusAt(slot, lvl);
    const bits = [];
    if (b.damage) bits.push(`+${b.damage} de daño`);
    if (b.precision) bits.push(`+${b.precision} de precisión`);
    if (b.armor) bits.push(`+${b.armor} de armadura`);
    if (b.defense) bits.push(`+${b.defense} de defensa`);
    return bits.join(' y ') || 'nada';
  }

  function gemsHave(p) {
    return ((p && p.inventory) || []).filter((s) => s.itemId === GEM).reduce((n, s) => n + (s.qty || 0), 0);
  }

  /** Lo que pide el próximo nivel de la pieza puesta en ese lugar. */
  function nextUpgrade(p, slot) {
    const item = gearOf(p, slot);
    if (!item) return { item: null, slot, ok: false, why: slot === 'weapon' ? 'No tenés un arma puesta.' : 'No tenés una armadura puesta.' };
    const lvl = levelOf(p, item.id);
    if (lvl >= MAX) return { item, slot, lvl, max: true, ok: false, why: 'Ya está en +5: más no se puede.' };
    const cap = capFor(p.level);
    if (lvl >= cap) return { item, slot, lvl, ok: false, capped: true, why: cap === 0 ? 'Recién desde el nivel 5 te mejoro algo: antes no aguantás el acero templado.' : `Con tu nivel llego hasta +${cap}. +${cap + 1} recién desde el nivel ${(cap + 1) * 4 + 1}.` };
    const coins = Math.max(MIN_COST[lvl], Math.round((item.value || 0) * COST_MULT[lvl]));
    const gems = GEMS[lvl];
    const have = gemsHave(p);
    let why = '';
    if (have < gems) why = `Te faltan ${gems - have} ${gems - have === 1 ? 'Gema de temple' : 'Gemas de temple'}.`;
    else if (!A.Currency.canPay(coins)) why = 'No te alcanza la plata.';
    return { item, slot, lvl, next: lvl + 1, coins, gems, have, ok: !why, why };
  }

  function upgrade(slot) {
    const p = St().player;
    const u = nextUpgrade(p, slot);
    if (!u.ok) return { ok: false, error: u.why };
    if (!A.Currency.pay(u.coins)) return { ok: false, error: 'No te alcanza la plata.' };
    let left = u.gems;
    while (left > 0) {
      const s = p.inventory.find((x) => x.itemId === GEM);
      if (!s) break;
      const take = Math.min(left, s.qty);
      St().removeItem(GEM, take);
      left -= take;
    }
    p.forge = p.forge || {};
    p.forge[u.item.id] = u.next;
    St().addChronicle({ type: 'craft', text: `El herrero dejó ${u.item.name} en +${u.next}.` });
    St().persist();
    A.Bus.emit('inventory:changed');
    return { ok: true, item: u.item, level: u.next };
  }

  /** "Espada larga +3" (o el nombre solo, sin mejora). */
  function nameWith(p, item) {
    if (!item) return '';
    const lvl = levelOf(p, item.id);
    return lvl ? `${item.name} +${lvl}` : item.name;
  }

  // ---------------- Posada: comidas especiales ----------------

  const MEALS = [
    { id: 'guiso', name: 'Guiso del cazador', desc: 'Carne y papas que pegan fuerte.', mods: { damage: 1 }, mult: 1.2 },
    { id: 'sopa', name: 'Sopa espesa de la casa', desc: 'Te deja el cuerpo duro como un tronco.', mods: { armor: 1 }, mult: 1.2 },
    { id: 'pastel', name: 'Pastel de miel y nueces', desc: 'Dulce y liviano: la mano firme.', mods: { precision: 1 }, mult: 1.2 },
    { id: 'banquete', name: 'Banquete de la casa', desc: 'Lo mejor que sale de la cocina.', mods: { damage: 1, precision: 1, armor: 1 }, mult: 5 },
  ];
  const MEAL_LASTS = 20; // un día entero (20 unidades de tiempo)

  function now() {
    const w = St().world;
    return w ? (w.day || 1) * 20 + (w.timeProgress || 0) : 0;
  }

  function mealOf(p) {
    const m = p && p.meal;
    if (!m) return null;
    const def = MEALS.find((x) => x.id === m.id);
    if (!def || now() >= (m.until || 0)) return null;
    return { ...def, until: m.until, left: m.until - now() };
  }

  function mealBonus(p) {
    const m = mealOf(p);
    const out = { damage: 0, precision: 0, armor: 0, defense: 0 };
    if (m) for (const k of Object.keys(m.mods)) out[k] += m.mods[k];
    return out;
  }

  function mealPrice(npc, meal) {
    const cost = (npc && npc.services && npc.services.restCost) || 10;
    return Math.max(5, Math.round(cost * meal.mult));
  }

  function modsText(mods) {
    const N = { damage: 'de daño', precision: 'de precisión', armor: 'de armadura', defense: 'de defensa' };
    return Object.keys(mods).map((k) => `+${mods[k]} ${N[k]}`).join(', ');
  }

  function eat(npcId, mealId) {
    const npc = A.Data.getById('npcs', npcId);
    const meal = MEALS.find((m) => m.id === mealId);
    const p = St().player;
    if (!npc || !meal || !p) return { ok: false, error: 'No hay esa comida.' };
    const price = mealPrice(npc, meal);
    if (!A.Currency.pay(price)) return { ok: false, error: 'No te alcanza la plata.' };
    p.meal = { id: meal.id, until: now() + MEAL_LASTS };
    St().modifyFood((p.maxFood || 20) - (p.food || 0));
    St().addChronicle({ type: 'rest', text: `Comiste ${meal.name.toLowerCase()} en lo de ${npc.name}: ${modsText(meal.mods)} por un día.` });
    St().persist();
    A.Bus.emit('inventory:changed');
    return { ok: true };
  }

  // ---------------- Carruaje ----------------

  /** Saltos por el mapa entre dos regiones (por los caminos). */
  function hops(fromId, toId) {
    if (fromId === toId) return 0;
    const seen = new Set([fromId]);
    let edge = [fromId];
    for (let d = 1; d < 40 && edge.length; d++) {
      const next = [];
      for (const id of edge) {
        const r = A.Data.getById('regions', id);
        for (const c of (r && r.connections) || []) {
          if (seen.has(c)) continue;
          if (c === toId) return d;
          seen.add(c);
          next.push(c);
        }
      }
      edge = next;
    }
    // los caminos van en un solo sentido en algunos datos: también hacia atrás
    for (const r of A.Data.regions || []) if ((r.connections || []).includes(fromId) && r.id === toId) return 1;
    return 6;
  }

  function topTier(r) { return Array.isArray(r.tier) ? Math.max(...r.tier) : (r.tier || 1); }

  function coachTrips() {
    const w = St().world;
    if (!w) return [];
    const here = A.Data.getById('regions', w.regionId);
    const curve = A.Balance && A.Balance.Economy ? A.Balance.Economy.priceCurve : (t) => Math.pow(1.45, t - 1);
    return (w.visited || [])
      .map((id) => A.Data.getById('regions', id))
      .filter((r) => r && r.type === 'safe' && r.id !== w.regionId)
      .map((r) => {
        const n = hops(w.regionId, r.id);
        const tier = Math.max(topTier(r), here ? topTier(here) : 1);
        return { region: r, hops: n, price: Math.max(15, Math.round(12 * curve(tier) * n)), time: Math.min(10, 2 * n) };
      })
      .sort((a, b) => a.hops - b.hops || a.price - b.price);
  }

  function coachBlocked() {
    if (St().combat) return 'Estás en una pelea.';
    if (St().traveling && !St().traveling.completed) return 'Ya estás de viaje.';
    const P = A.Party;
    if (P && P.guestTogether && P.guestTogether()) return 'En grupo, el carruaje lo toma quien armó el grupo: viajan todos juntos.';
    return '';
  }

  function takeCoach(toId) {
    const why = coachBlocked();
    if (why) return { ok: false, error: why };
    const trip = coachTrips().find((t) => t.region.id === toId);
    if (!trip) return { ok: false, error: 'El carruaje no va para allá.' };
    if (!A.Currency.pay(trip.price)) return { ok: false, error: 'No te alcanza la plata.' };
    St().addChronicle({ type: 'travel', text: `Subiste al carruaje hacia ${trip.region.name}.` });
    if (A.Time) A.Time.advance(trip.time, 'coach');
    St().setRegion(toId);
    A.Bus.emit('travel:completed', { fromId: null, toId, coach: true });
    return { ok: true, region: trip.region };
  }

  // ---------------- Lucirse ----------------

  const FRAMES = [
    { id: 'bronce', name: 'Marco de bronce', price: 300, color: '#b87333' },
    { id: 'plata', name: 'Marco de plata', price: 1500, color: '#cfd6dc' },
    { id: 'esmeralda', name: 'Marco de esmeralda', price: 4000, color: '#3fae6a' },
    { id: 'zafiro', name: 'Marco de zafiro', price: 4000, color: '#3f7fd6' },
    { id: 'rubi', name: 'Marco de rubí', price: 8000, color: '#d23a4a' },
    { id: 'amatista', name: 'Marco de amatista', price: 8000, color: '#9a5ad0' },
    { id: 'obsidiana', name: 'Marco de obsidiana', price: 25000, color: '#2a2230' },
    { id: 'estelar', name: 'Marco estelar', price: 100000, color: '#8fd8ff', minLevel: 15 },
  ];
  const TITLES = [
    { id: 'caminos', text: 'de los Caminos', price: 200 },
    { id: 'sinmiedo', text: 'Sin Miedo', price: 800 },
    { id: 'corazon', text: 'Corazón de Hierro', price: 2500, minLevel: 5 },
    { id: 'tormenta', text: 'Ojo de la Tormenta', price: 6000, minLevel: 8 },
    { id: 'rompe', text: 'Rompemontañas', price: 12000, minLevel: 10 },
    { id: 'sombra', text: 'Sombra del Reino', price: 30000, minLevel: 12 },
    { id: 'leyenda', text: 'Leyenda Viva', price: 150000, minLevel: 18 },
  ];

  function owned(p, kind, id) { return !!(p && p.owned && (p.owned[kind] || []).includes(id)); }

  function lookOf(p) {
    const l = (p && p.look) || {};
    const frame = FRAMES.find((f) => f.id === l.frame) || null;
    const title = TITLES.find((t) => t.id === l.title) || null;
    return { frame, title };
  }

  /** Compra (si no la tenía) y se la pone; si ya la tenía puesta, se la saca. */
  function wear(kind, id) {
    const p = St().player;
    const list = kind === 'frames' ? FRAMES : TITLES;
    const def = list.find((x) => x.id === id);
    if (!p || !def) return { ok: false, error: 'No existe.' };
    p.owned = p.owned || { frames: [], titles: [] };
    p.owned[kind] = p.owned[kind] || [];
    p.look = p.look || {};
    const key = kind === 'frames' ? 'frame' : 'title';
    if (!owned(p, kind, id)) {
      if (def.minLevel && (p.level || 1) < def.minLevel) return { ok: false, error: `Se vende desde el nivel ${def.minLevel}.` };
      if (!A.Currency.pay(def.price)) return { ok: false, error: 'No te alcanza la plata.' };
      p.owned[kind].push(id);
      St().addChronicle({ type: 'note', text: kind === 'frames' ? `Te compraste un ${def.name.toLowerCase()} para tu retrato.` : `Ahora te dicen "${def.text}".` });
      p.look[key] = id;
    } else {
      p.look[key] = p.look[key] === id ? null : id;
    }
    St().persist();
    A.Bus.emit('inventory:changed');
    return { ok: true };
  }

  A.Oficios = {
    MAX, GEM, levelOf, bonusAt, capFor, bonusText, gearBonus, nextUpgrade, upgrade, nameWith, gemsHave,
    MEALS, mealOf, mealBonus, mealPrice, modsText, eat,
    coachTrips, coachBlocked, takeCoach, hops,
    FRAMES, TITLES, owned, lookOf, wear,
  };
})(window.Aventurs);
