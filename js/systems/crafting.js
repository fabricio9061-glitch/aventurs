/* ============================================================
   Aventurs — Crafting system (v1.4.0)
   Crea items a partir de recetas. Solo se accede desde NPC herrero
   en regiones safe.

   API:
     canCraft(recipeId)        -> { ok, missing? [{itemId, qty, have}] }
     craft(recipeId)           -> { ok, error? }
     recipesForWorkshop(ws)    -> array de recetas
   ============================================================ */

(function (A) {
  'use strict';

  function recipesForWorkshop(workshop) {
    return A.Data.recipes.filter((r) => r.workshop === workshop);
  }

  function canCraft(recipeId) {
    const recipe = A.Data.getById('recipes', recipeId);
    if (!recipe) return { ok: false, error: 'Receta no encontrada.' };
    const p = A.State.player;
    const missing = [];
    for (const ing of recipe.ingredients || []) {
      const slot = p.inventory.find((s) => s.itemId === ing.itemId);
      const have = slot ? slot.qty : 0;
      if (have < ing.qty) {
        missing.push({ itemId: ing.itemId, qty: ing.qty, have });
      }
    }
    if (missing.length > 0) return { ok: false, missing };

    // Verificar espacio: contar slots usados después de consumir ingredientes y agregar resultado.
    // Un ingrediente que se consume EXACTAMENTE (have === qty) y no es coin libera un slot.
    let projectedUsed = A.State.inventoryUsedSlots();
    for (const ing of recipe.ingredients || []) {
      const slot = p.inventory.find((s) => s.itemId === ing.itemId);
      const item = A.Data.getById('items', ing.itemId);
      const isCoin = item && item.subtype === 'coin';
      if (slot && slot.qty === ing.qty && !isCoin) projectedUsed -= 1;
    }
    // Resultado: si ya hay slot stackeable con espacio, no agrega nuevo. Si no, suma 1.
    const result = A.Data.getById('items', recipe.result) ||
                   A.Data.getById('weapons', recipe.result) ||
                   A.Data.getById('armors', recipe.result);
    const exists = p.inventory.find((s) => s.itemId === recipe.result);
    const stackable = result && result.stack && result.stack > 1 && exists;
    if (!stackable) projectedUsed += 1;

    if (projectedUsed > A.State.inventoryCapacity()) {
      return { ok: false, error: 'Mochila llena.' };
    }

    return { ok: true };
  }

  function craft(recipeId) {
    const recipe = A.Data.getById('recipes', recipeId);
    if (!recipe) return { ok: false, error: 'Receta no encontrada.' };
    const check = canCraft(recipeId);
    if (!check.ok) {
      if (check.missing) return { ok: false, error: 'Faltan materiales.' };
      return { ok: false, error: check.error };
    }
    // Consumir ingredientes
    for (const ing of recipe.ingredients || []) {
      A.State.removeItem(ing.itemId, ing.qty);
    }
    // Agregar resultado
    A.State.addItem(recipe.result, 1);
    const result = A.Data.getById('items', recipe.result) ||
                   A.Data.getById('weapons', recipe.result) ||
                   A.Data.getById('armors', recipe.result);
    const resultName = result ? result.name : recipe.result;
    A.State.addChronicle({
      type: 'craft',
      text: `Creaste ${resultName} en el taller.`,
    });
    A.Bus.emit('craft:success', { recipeId, result: recipe.result });
    return { ok: true };
  }

  A.Crafting = {
    canCraft,
    craft,
    recipesForWorkshop,
  };
})(window.Aventurs);
