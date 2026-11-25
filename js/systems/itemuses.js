/* ============================================================
   Aventurs — v3.9: para qué sirve cada objeto
   Junta en un solo lugar todo lo que se puede hacer con un objeto:
   con qué se fabrica, para qué receta sirve, qué misión lo pide,
   a quién doma, qué cofre abre y si tu mascota lo come.
   Lo usan la ficha del objeto, la tienda y la forja.
   ============================================================ */

(function (A) {
  'use strict';

  const WORKSHOP = { forge: 'forja', alchemy: 'alquimia', enchant: 'encantamiento' };

  function data(id) { return A.Inventory && A.Inventory.resolveData ? A.Inventory.resolveData(id) : null; }
  function nameOf(id) { const d = data(id); return d ? d.name : id; }

  /** "a, b y c" (corta a los primeros n). */
  function listOf(names, n = 4) {
    const u = [...new Set(names)];
    const shown = u.slice(0, n);
    const rest = u.length - shown.length;
    const base = shown.length > 1 ? `${shown.slice(0, -1).join(', ')} y ${shown[shown.length - 1]}` : (shown[0] || '');
    return rest > 0 ? `${shown.join(', ')} y ${rest} más` : base;
  }

  /** Quién hace cada taller (para decir "en lo de ..."). */
  function makersOf(workshop) {
    return (A.Data.npcs || []).filter((n) => {
      const ws = Array.isArray(n.crafts) ? n.crafts : (n.role === 'blacksmith' ? ['forge', 'enchant'] : []);
      return ws.includes(workshop);
    }).map((n) => n.name);
  }

  /** Recetas donde el objeto es ingrediente. */
  function recipesUsing(id) {
    return (A.Data.recipes || []).filter((r) => (r.ingredients || []).some((i) => i.itemId === id));
  }
  /** Recetas que lo fabrican. */
  function recipesMaking(id) {
    return (A.Data.recipes || []).filter((r) => r.result === id);
  }

  /**
   * Lista de usos: [{ icon, text, kind }].
   *   kind: craft | made | quest | tame | pet | key | sell
   */
  function of(id, opts = {}) {
    const d = data(id);
    if (!d) return [];
    const out = [];

    // Sirve para fabricar
    const using = recipesUsing(id);
    if (using.length) {
      out.push({ kind: 'craft', icon: 'anvil', text: `Sirve para hacer ${listOf(using.map((r) => nameOf(r.result)))}.` });
    }

    // Se fabrica
    for (const r of recipesMaking(id).slice(0, 2)) {
      const ing = (r.ingredients || []).map((i) => `${i.qty > 1 ? `${i.qty} × ` : ''}${nameOf(i.itemId)}`);
      const who = makersOf(r.workshop);
      out.push({ kind: 'made', icon: r.workshop === 'alchemy' ? 'potion' : r.workshop === 'enchant' ? 'arcane' : 'anvil',
        text: `Se puede hacer (${WORKSHOP[r.workshop] || r.workshop}) con ${listOf(ing, 5)}${who.length ? `: en lo de ${listOf(who, 2)}` : ''}.` });
    }

    // Misiones que lo piden
    const quests = (A.Data.quests || []).filter((q) => (q.objectives || []).some((o) => o.type === 'collect' && o.item === id));
    if (quests.length) {
      out.push({ kind: 'quest', icon: 'quest', text: `Lo piden en ${quests.length > 1 ? 'las misiones' : 'la misión'} ${listOf(quests.map((q) => `"${q.title || q.name || q.id}"`), 3)}.` });
    }

    // Domar
    const tames = (A.Data.enemies || []).filter((e) => e.tameable && e.tameItem === id);
    if (tames.length) out.push({ kind: 'tame', icon: 'paw', text: `Sirve para domar: ${listOf(tames.map((e) => e.name.toLowerCase()), 5)}.` });

    // La comida de tu mascota
    const p = A.State && A.State.player;
    if (p && p.pet && A.Tame && A.Tame.dietInfo && A.Tame.dietInfo(p.pet).foods.includes(id)) out.push({ kind: 'pet', icon: 'paw', text: `${p.pet.name} lo come (le llena la panza).` });

    // Llaves y otros objetos que piden las escenas
    const scenes = (A.Data.events || A.Seed.events || []).filter((ev) => (ev.options || []).some((o) => o.needs && o.needs.item === id));
    if (scenes.length) {
      const isKey = /llave/.test(id);
      out.push({ kind: 'key', icon: isKey ? 'chest' : 'map', text: isKey
        ? `Abre ${scenes.length > 1 ? 'cofres' : 'un cofre'} que podés encontrar explorando (se gasta).`
        : `Te da una opción más en algunas escenas al explorar (${listOf(scenes.map((ev) => (ev.title || ev.id).toLowerCase()), 3)}).` });
    }

    // Lugares que lo piden para entrar
    const places = (A.Data.regions || []).filter((r) => ((r.unlockConditions && r.unlockConditions.items) || []).some((x) => (x.itemId || x) === id));
    if (places.length) out.push({ kind: 'key', icon: 'map', text: `Lo necesitás para entrar a ${listOf(places.map((r) => r.name))}.` });

    // Si no sirve para otra cosa: al menos se vende
    if (opts.withSell !== false && !out.length && d.value) {
      out.push({ kind: 'sell', icon: 'coins', text: `Por ahora solo sirve para vender (te dan ${Math.max(1, Math.floor(d.value / 2))} de cobre).` });
    }
    return out;
  }

  A.ItemUses = { of, recipesUsing, recipesMaking, makersOf };
})(window.Aventurs);
