/* ============================================================
   Aventurs — Validate
   Chequea coherencia de Data: conexiones bidireccionales, refs
   rotas, items inválidos, regiones aisladas, etc.

   Devuelve array de { level, msg, entityId, collection }.
   level: 'error' | 'warn' | 'info'.
   ============================================================ */

(function (A) {
  'use strict';

  function run(opts = {}) {
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
        // v2.1: un enemigo también puede soltar un arma o una armadura
        if (!itemIds.has(d.itemId) && !A.Data.getById('weapons', d.itemId) && !A.Data.getById('armors', d.itemId)) {
          out.push({ level: 'error', collection: 'enemies', entityId: e.id, msg: `"${e.name}" tiene drop a item inexistente "${d.itemId}".` });
        }
      }
      if (!e.tier || e.tier < 1 || e.tier > 99) {
        out.push({ level: 'warn', collection: 'enemies', entityId: e.id, msg: `"${e.name}" sin tier válido.` });
      }
      // v1.8.0: coherencia de domesticación
      if (e.tameable) {
        const smart = (e.family || []).some((f) => ['humanoid', 'demon', 'undead', 'arcane', 'dragon'].includes(f));
        if (e.category === 'boss' || smart) {
          out.push({ level: 'warn', collection: 'enemies', entityId: e.id, msg: `"${e.name}" está marcado como domable pero es ${e.category === 'boss' ? 'un jefe' : 'inteligente'}: nunca se va a poder domar.` });
        }
        if (e.tameItem && !itemIds.has(e.tameItem)) {
          out.push({ level: 'error', collection: 'enemies', entityId: e.id, msg: `"${e.name}" pide para domar un item inexistente "${e.tameItem}".` });
        }
      }
      // v1.8.0: el enemigo tiene que poder aparecer en alguna de sus regiones (tier dentro del rango)
      const fits = (e.regions || []).some((rid) => {
        const r = D.regions.find((x) => x.id === rid);
        return r && Array.isArray(r.tier) && e.tier >= r.tier[0] && e.tier <= r.tier[1];
      });
      if ((e.regions || []).length && !fits) {
        out.push({ level: 'warn', collection: 'enemies', entityId: e.id, msg: `"${e.name}" (tier ${e.tier}) no entra en el rango de tier de ninguna de sus regiones: nunca aparece.` });
      }
    }

    // v1.8.0: regiones de combate sin enemigos posibles
    for (const region of D.regions) {
      if (region.type !== 'combat' || !Array.isArray(region.tier)) continue;
      const count = D.enemies.filter((e) => (e.regions || []).includes(region.id) && e.tier >= region.tier[0] && e.tier <= region.tier[1]).length;
      if (count === 0) {
        out.push({ level: 'error', collection: 'regions', entityId: region.id, msg: `"${region.name}" no tiene enemigos de su tier: no habrá encuentros.` });
      }
      for (const iid of ((region.unlockConditions || {}).requiredItems || [])) {
        if (!itemIds.has(iid)) {
          out.push({ level: 'error', collection: 'regions', entityId: region.id, msg: `"${region.name}" pide un item inexistente "${iid}".` });
        }
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

    // ---------- v2.2: misiones y escenas ----------
    const npcIds = new Set(D.npcs.map((n) => n.id));
    const enemyIds = new Set(D.enemies.map((e) => e.id));
    const anyItem = (id) => itemIds.has(id) || !!D.weapons.find((w) => w.id === id) || !!D.armors.find((a) => a.id === id);
    const questIds = new Set((D.quests || []).map((q) => q.id));
    for (const q of D.quests || []) {
      const name = q.title || q.id;
      if (q.giver && !npcIds.has(q.giver)) out.push({ level: 'error', collection: 'quests', entityId: q.id, msg: `"${name}" la da alguien que no existe ("${q.giver}").` });
      if (!Array.isArray(q.objectives) || !q.objectives.length) out.push({ level: 'warn', collection: 'quests', entityId: q.id, msg: `"${name}" no tiene objetivos: se cumple sola.` });
      for (const o of q.objectives || []) {
        if (o.type === 'kill') {
          for (const id of (Array.isArray(o.enemy) ? o.enemy : [o.enemy])) if (!enemyIds.has(id)) out.push({ level: 'error', collection: 'quests', entityId: q.id, msg: `"${name}" pide derrotar una criatura que no existe ("${id}").` });
        }
        if ((o.type === 'collect' || o.type === 'have') && !anyItem(o.item)) out.push({ level: 'error', collection: 'quests', entityId: q.id, msg: `"${name}" pide un objeto que no existe ("${o.item}").` });
        if ((o.type === 'explore' || o.type === 'visit') && !regionIds.has(o.region)) out.push({ level: 'error', collection: 'quests', entityId: q.id, msg: `"${name}" manda a un lugar que no existe ("${o.region}").` });
        if (o.type === 'talk' && !npcIds.has(o.npc)) out.push({ level: 'error', collection: 'quests', entityId: q.id, msg: `"${name}" pide hablar con alguien que no existe ("${o.npc}").` });
      }
      for (const [id] of ((q.reward || {}).items || [])) if (!anyItem(id)) out.push({ level: 'error', collection: 'quests', entityId: q.id, msg: `"${name}" da de premio un objeto que no existe ("${id}").` });
      if (q.requires && !questIds.has(q.requires)) out.push({ level: 'error', collection: 'quests', entityId: q.id, msg: `"${name}" espera una misión que no existe ("${q.requires}").` });
      if (q.next && !questIds.has(q.next)) out.push({ level: 'error', collection: 'quests', entityId: q.id, msg: `"${name}" sigue con una misión que no existe ("${q.next}").` });
    }
    for (const ev of D.events || []) {
      const name = ev.title || ev.id;
      if (!Array.isArray(ev.options) || !ev.options.length) out.push({ level: 'error', collection: 'events', entityId: ev.id, msg: `"${name}" no tiene opciones para elegir.` });
      for (const o of ev.options || []) {
        for (const r of [o.ok, o.fail]) for (const it of (r && r.items) || []) if (!anyItem(it[0])) out.push({ level: 'error', collection: 'events', entityId: ev.id, msg: `"${name}" da un objeto que no existe ("${it[0]}").` });
      }
      for (const rid of ev.regions || []) if (!regionIds.has(rid)) out.push({ level: 'error', collection: 'events', entityId: ev.id, msg: `"${name}" es de un lugar que no existe ("${rid}").` });
    }

    if (out.length && !opts.quiet) {
      console.warn('[Validate] Avisos:', out);
    }
    return out;
  }

  A.Validate = { run };
})(window.Aventurs);
