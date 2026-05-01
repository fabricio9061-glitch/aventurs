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

    switch (ef.type) {
      case 'heal': {
        const amount = A.Utils.rollDice(ef.amount);
        A.State.healHp(amount);
        chronicleText = `Usaste ${item.name} y recuperaste ${amount} de salud.`;
        applied = true;
        break;
      }
      case 'mana': {
        const amount = A.Utils.rollDice(ef.amount);
        A.State.setMana(p.mana + amount);
        chronicleText = `Usaste ${item.name} y recuperaste ${amount} de maná.`;
        applied = true;
        break;
      }
      case 'food': {
        A.State.healHp(ef.amount || 1);
        chronicleText = `Comiste ${item.name}. Recuperás ${ef.amount} de salud.`;
        applied = true;
        break;
      }
      case 'cure':
      case 'buff':
      case 'escape':
        // En Fase 1 estos no hacen nada (Fase 2 con combate)
        chronicleText = `Usaste ${item.name}. (efecto disponible en combate)`;
        applied = true;
        break;
      default:
        break;
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
