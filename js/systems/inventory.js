/* ============================================================
   Aventurs — Inventory
   Equipar arma/armadura, usar consumibles, tirar items.
   La capacidad y el storage están en State; este system aplica reglas.
   ============================================================ */

(function (A) {
  'use strict';

  /**
   * Devuelve el "slot type" de un item: 'weapon', 'armor', 'consumable', 'material', 'misc'.
   */
  function classifyItem(itemId) {
    if (!itemId) return null;
    if (A.Data.getById('weapons', itemId)) return 'weapon';
    if (A.Data.getById('armors', itemId)) return 'armor';
    const item = A.Data.getById('items', itemId);
    if (!item) return null;
    if (item.subtype === 'potion' || item.subtype === 'food') return 'consumable';
    if (item.subtype === 'scroll' || item.subtype === 'scroll_spell') return 'scroll';
    if (item.subtype === 'tame') return 'tame';
    if (item.subtype === 'material') return 'material';
    if (item.subtype === 'bag') return 'bag';
    return item.subtype || 'misc';
  }

  /**
   * Resuelve el "objeto Data" de un id, sea arma, armadura o item.
   */
  function resolveData(itemId) {
    return (
      A.Data.getById('weapons', itemId) ||
      A.Data.getById('armors', itemId) ||
      A.Data.getById('items', itemId) ||
      null
    );
  }

  /**
   * Equipa un item del inventario.
   * Si ya hay algo equipado en ese slot, lo devuelve al inventario.
   */
  function equip(itemId) {
    const p = A.State.player;
    if (!p) return false;

    const kind = classifyItem(itemId);
    if (kind !== 'weapon' && kind !== 'armor') return false;

    // Verificar que está en el inventario
    const slot = p.inventory.find((s) => s.itemId === itemId);
    if (!slot) return false;

    const slotName = kind === 'weapon' ? 'weapon' : 'armor';
    const currentlyEquippedId = p.equipment[slotName];

    // Quitar del inventario el item a equipar
    A.State.removeItem(itemId, 1);

    // Si había algo equipado, devolverlo al inventario (siempre cabe porque acabamos de liberar un slot)
    if (currentlyEquippedId) {
      A.State.addItem(currentlyEquippedId, 1);
    }

    p.equipment[slotName] = itemId;

    A.Bus.emit('inventory:equipped', { slot: slotName, itemId });
    A.Bus.emit('inventory:changed');
    A.State.persist();
    return true;
  }

  /**
   * Desequipa el slot indicado ('weapon' o 'armor').
   * Requiere espacio en el inventario.
   */
  function unequip(slotName) {
    const p = A.State.player;
    if (!p) return false;
    const equippedId = p.equipment[slotName];
    if (!equippedId) return false;

    if (!A.State.inventoryHasSpace()) {
      A.Bus.emit('inventory:full');
      return false;
    }

    p.equipment[slotName] = null;
    A.State.addItem(equippedId, 1);
    A.Bus.emit('inventory:unequipped', { slot: slotName, itemId: equippedId });
    A.State.persist();
    return true;
  }

  /**
   * Usa un consumible del inventario. Aplica su efecto.
   * Solo válido fuera de combate (en combate hay otro flujo desde Combat).
   */
  function use(itemId) {
    const p = A.State.player;
    if (!p) return false;
    const item = A.Data.getById('items', itemId);
    if (!item) return false;
    if (!p.inventory.find((s) => s.itemId === itemId)) return false;

    // Pergamino que enseña hechizo
    if (item.subtype === 'scroll_spell') {
      const spellId = item.teachesSpell;
      if (!spellId) return false;
      if (!p.hasMagic) {
        A.State.addChronicle({
          type: 'note',
          text: `Intentaste leer ${item.name} pero las palabras no significan nada. Tu sangre no canaliza maná.`,
        });
        return false;
      }
      const spell = A.Data.getById('spells', spellId);
      if (!spell) return false;
      if ((p.spells || []).includes(spellId)) {
        A.State.addChronicle({
          type: 'note',
          text: `Ya conocías ${spell.name}. El pergamino se quedó intacto.`,
        });
        return false;
      }
      p.spells = p.spells || [];
      p.spells.push(spellId);
      A.State.removeItem(itemId, 1);
      A.State.addChronicle({
        type: 'spell',
        text: `Aprendiste ${spell.name} del pergamino.`,
      });
      A.Bus.emit('spell:learned', { spellId, source: 'scroll' });
      A.State.persist();
      return true;
    }

    // Bolsa: la equipa y consume el item
    if (item.subtype === 'bag') {
      const newBagId = item.equipsBag;
      if (!newBagId) return false;
      const newBag = A.Data.getById('bags', newBagId);
      if (!newBag) return false;
      // Si ya tiene esa misma bolsa, no hace nada
      if (p.bagId === newBagId) {
        A.State.addChronicle({
          type: 'note',
          text: `Ya tenías equipada una ${newBag.name}.`,
        });
        return false;
      }
      // Verificar que los items actuales caben en la nueva
      const used = A.State.inventoryUsedSlots();
      if (used > newBag.slots) {
        A.State.addChronicle({
          type: 'note',
          text: `La ${newBag.name} (${newBag.slots} slots) no alcanza para tus ${used} cosas. Vacía algo primero.`,
        });
        return false;
      }
      // Equipar la nueva
      const oldBag = A.Data.getById('bags', p.bagId);
      const oldBagId = p.bagId;
      // Consumir el item ANTES de cambiar la bolsa
      A.State.removeItem(itemId, 1);
      // Setear directamente (evitar setBag que valida)
      p.bagId = newBagId;
      // Si la bolsa vieja era diferente y "merece" devolverse como item, lo agregamos
      // (solo si la vieja es upgrade-able, o sea no la basic).
      // Para la basic NO devolvemos item (regalo del comienzo).
      // Para las otras, sí: devolvemos un item con equipsBag = oldBagId.
      if (oldBagId && oldBagId !== 'bag_basic' && oldBag) {
        // Buscar qué item-proxy tiene equipsBag === oldBagId
        const oldItemProxy = A.Data.items.find((it) => it.subtype === 'bag' && it.equipsBag === oldBagId);
        if (oldItemProxy) {
          // Tratar de meterlo. Si no entra, se pierde con aviso.
          const ok = A.State.addItem(oldItemProxy.id, 1);
          if (!ok) {
            A.State.addChronicle({
              type: 'note',
              text: `Tu ${oldBag.name} anterior se perdió (mochila nueva sin espacio).`,
            });
          }
        }
      }
      A.State.addChronicle({
        type: 'item',
        text: `Cambiaste a ${newBag.name} (${newBag.slots} espacios).`,
      });
      A.Bus.emit('bag:equipped', { bagId: newBagId });
      A.State.persist();
      return true;
    }

    const ef = item.effect;
    if (!ef) return false;

    let applied = false;
    let chronicleText = '';

    // v1.6.1: Item puede tener efectos combinados (food + heal)
    // El consumo aplica TODOS los efectos del item simultáneamente.
    // Los items declaran sus efectos en `effect: { type, amount, heal, hungerRestore, manaRestore }`
    // o el item tiene los campos directos `healAmount`, `hungerRestore`, `foodValue`, `manaRestore`.
    const effects = [];

    // 1. Curación de HP — múltiples fuentes posibles
    let healAmount = 0;
    if (ef.type === 'heal') healAmount += A.Utils.rollDice(ef.amount);
    if (ef.heal) healAmount += A.Utils.rollDice(ef.heal);
    if (item.healAmount) healAmount += item.healAmount;

    // 2. Restauración de comida
    let hungerAmount = 0;
    if (ef.type === 'food') hungerAmount += ef.amount || ef.hungerRestore || 0;
    if (ef.hungerRestore) hungerAmount += ef.hungerRestore;
    if (item.hungerRestore) hungerAmount += item.hungerRestore;
    // foodValue del seed (carnes, pan, frutas) suma directo al hunger
    if (item.foodValue) hungerAmount += item.foodValue;

    // 3. Restauración de maná
    let manaAmount = 0;
    if (ef.type === 'mana') manaAmount += A.Utils.rollDice(ef.amount);
    if (ef.manaRestore) manaAmount += A.Utils.rollDice(ef.manaRestore);

    // Aplicar
    if (healAmount > 0) {
      const before = p.hp;
      A.State.healHp(healAmount);
      const recovered = p.hp - before;
      if (recovered > 0) effects.push(`+${recovered} salud`);
    }
    if (hungerAmount > 0) {
      const before = p.food || 0;
      const maxFood = p.maxFood || 100;
      p.food = Math.min(maxFood, before + hungerAmount);
      const restored = p.food - before;
      if (restored > 0) effects.push(`+${restored} comida`);
      A.Bus.emit('player:food-changed', { current: p.food, max: maxFood });
    }
    if (manaAmount > 0) {
      const before = p.mana || 0;
      A.State.setMana(before + manaAmount);
      const recovered = p.mana - before;
      if (recovered > 0) effects.push(`+${recovered} maná`);
    }

    if (effects.length > 0) {
      chronicleText = `Usaste ${item.name}: ${effects.join(', ')}.`;
      applied = true;
    } else {
      // Casos especiales que no tocan stats numéricos
      switch (ef.type) {
        case 'cure':
        case 'buff':
        case 'escape':
          chronicleText = `Usaste ${item.name}. (efecto disponible en combate)`;
          applied = true;
          break;
        default:
          // Si no aplicó nada, intentar warning
          if (item.subtype === 'food' && (p.food || 0) >= (p.maxFood || 100)) {
            chronicleText = `${item.name}: ya estás saciado, no podés comer más.`;
            return false;
          } else if (item.subtype === 'potion' && p.hp >= p.maxHp) {
            chronicleText = `${item.name}: ya estás con salud completa.`;
            return false;
          }
      }
    }

    if (applied) {
      A.State.removeItem(itemId, 1);
      if (chronicleText) A.State.addChronicle({ type: 'item', text: chronicleText });
    }
    return applied;
  }

  function drop(itemId) {
    A.State.dropItem(itemId);
    const data = resolveData(itemId);
    if (data) A.State.addChronicle({ type: 'item', text: `Tiraste ${data.name}.` });
  }

  A.Inventory = {
    classifyItem,
    resolveData,
    equip,
    unequip,
    use,
    drop,
  };
})(window.Aventurs);
