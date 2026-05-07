/* ============================================================
   Aventurs — Validate
   Chequea coherencia de Data: conexiones bidireccionales, refs
   rotas, items inválidos, regiones aisladas, etc.

   Devuelve array de { level, msg, entityId, collection }.
   level: 'error' | 'warn' | 'info'.
   ============================================================ */

(function (A) {
  'use strict';

  function run() {
    const out = [];
    const D = A.Data;
    if (!D) return out;

    // ---------- Regiones ----------
    const regionIds = new Set(D.regions.map((r) => r.id));

    for (const region of D.regions) {
      if (!region.id || !region.name) {
        out.push({ level: 'error', collection: 'regions', entityId: region.id || '?', msg: 'Región sin id o nombre.' });
        continue;
      }
      if (!Array.isArray(region.connections) || region.connections.length === 0) {
        out.push({ level: 'warn', collection: 'regions', entityId: region.id, msg: `"${region.name}" no tiene conexiones (región aislada).` });
      } else {
        for (const cid of region.connections) {
          if (!regionIds.has(cid)) {
            out.push({ level: 'error', collection: 'regions', entityId: region.id, msg: `"${region.name}" conecta a región inexistente "${cid}".` });
            continue;
          }
          const other = D.regions.find((r) => r.id === cid);
          if (other && !(other.connections || []).includes(region.id)) {
            out.push({ level: 'error', collection: 'regions', entityId: region.id, msg: `Conexión no bidireccional: "${region.name}" → "${other.name}" pero no de vuelta.` });
          }
        }
      }
      if (!Array.isArray(region.tier) || region.tier.length !== 2) {
        out.push({ level: 'warn', collection: 'regions', entityId: region.id, msg: `"${region.name}" sin rango de tier definido.` });
      }
    }

    // ---------- Enemigos ----------
    const itemIds = new Set(D.items.map((i) => i.id));
    for (const e of D.enemies) {
      if (!e.id || !e.name) {
        out.push({ level: 'error', collection: 'enemies', entityId: e.id || '?', msg: 'Enemigo sin id o nombre.' });
        continue;
      }
      for (const rid of e.regions || []) {
        if (!regionIds.has(rid)) {
          out.push({ level: 'error', collection: 'enemies', entityId: e.id, msg: `"${e.name}" declarado en región inexistente "${rid}".` });
        }
      }
      for (const d of e.drops || []) {
        if (!itemIds.has(d.itemId)) {
          out.push({ level: 'error', collection: 'enemies', entityId: e.id, msg: `"${e.name}" tiene drop a item inexistente "${d.itemId}".` });
        }
      }
      if (!e.tier || e.tier < 1 || e.tier > 99) {
        out.push({ level: 'warn', collection: 'enemies', entityId: e.id, msg: `"${e.name}" sin tier válido.` });
      }
    }

    // ---------- NPCs ----------
    const spellIds = new Set(D.spells.map((s) => s.id));
    for (const n of D.npcs) {
      if (!n.id || !n.name) {
        out.push({ level: 'error', collection: 'npcs', entityId: n.id || '?', msg: 'NPC sin id o nombre.' });
        continue;
      }
      if (n.region && !regionIds.has(n.region)) {
        out.push({ level: 'error', collection: 'npcs', entityId: n.id, msg: `"${n.name}" en región inexistente "${n.region}".` });
      }
      for (const sid of n.sells || []) {
        if (!itemIds.has(sid) && !D.weapons.find((w) => w.id === sid) && !D.armors.find((a) => a.id === sid)) {
          out.push({ level: 'error', collection: 'npcs', entityId: n.id, msg: `"${n.name}" vende item inexistente "${sid}".` });
        }
      }
      for (const sid of n.teaches || []) {
        if (!spellIds.has(sid)) {
          out.push({ level: 'error', collection: 'npcs', entityId: n.id, msg: `"${n.name}" enseña hechizo inexistente "${sid}".` });
        }
      }
    }

    // ---------- Recetas ----------
    const allCraftableIds = new Set([
      ...D.weapons.map((w) => w.id),
      ...D.armors.map((a) => a.id),
      ...D.items.map((i) => i.id),
    ]);
    for (const r of D.recipes) {
      if (!r.id || !r.result) {
        out.push({ level: 'error', collection: 'recipes', entityId: r.id || '?', msg: 'Receta sin id o resultado.' });
        continue;
      }
      if (!allCraftableIds.has(r.result)) {
        out.push({ level: 'error', collection: 'recipes', entityId: r.id, msg: `Receta "${r.name}" produce item inexistente "${r.result}".` });
      }
      for (const ing of r.ingredients || []) {
        if (!itemIds.has(ing.itemId)) {
          out.push({ level: 'error', collection: 'recipes', entityId: r.id, msg: `Receta "${r.name}" requiere ingrediente inexistente "${ing.itemId}".` });
        }
      }
    }

    if (out.length) {
      console.warn('[Validate] Avisos:', out);
    }
    return out;
  }

  A.Validate = { run };
})(window.Aventurs);
