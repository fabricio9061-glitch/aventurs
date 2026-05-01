/* ============================================================
   Aventurs — NPC system (v1.4.0)
   Tienda funcional, enseñar hechizos, descanso pago.

   API:
     buy(npcId, itemId)            -> { ok, error? }
     sell(itemId)                  -> { ok, error?, copperReceived }
     learnSpell(npcId, spellId)    -> { ok, error?, costPaid }
     restAt(npcId)                 -> { ok, error? }

   Reglas:
     - Comprar: paga el value del item al NPC. Si no alcanza, falla.
       Si el inventario está lleno, falla.
     - Vender: recibe la mitad del value (redondeado). El item se quita.
       No se venden monedas, materiales sin valor 0, equipamiento equipado.
     - Aprender hechizo: cuesta tier * 100 cobre. Falla si el jugador no
       tiene magia, ya conoce el hechizo, o no le alcanza el cobre.
     - Descansar: cuesta lo que diga npc.services.restCost. Restaura HP/maná.
   ============================================================ */

(function (A) {
  'use strict';

  // ---------- Tienda ----------

  function getNpcSellPrice(npc, itemId) {
    const data = A.Inventory.resolveData(itemId);
    if (!data) return null;
    const base = data.value || 0;
    // Si el NPC define un precio custom, usarlo
    if (npc.prices && typeof npc.prices[itemId] === 'number') return npc.prices[itemId];
    return base;
  }

  function buy(npcId, itemId) {
    const npc = A.Data.getById('npcs', npcId);
    if (!npc) return { ok: false, error: 'NPC no encontrado.' };
    if (!(npc.sells || []).includes(itemId)) {
      return { ok: false, error: 'Este NPC no vende eso.' };
    }
    const price = getNpcSellPrice(npc, itemId);
    if (price == null) return { ok: false, error: 'Precio no disponible.' };
    if (!A.Currency.canPay(price)) {
      return { ok: false, error: `No te alcanza. Cuesta ${price} cobre.` };
    }
    if (!A.State.inventoryHasSpace()) {
      // Excepción: si es stackeable y ya hay slot, sí cabe
      const item = A.Data.getById('items', itemId);
      const exists = A.State.player.inventory.find((s) => s.itemId === itemId);
      const stackable = item && item.stack && item.stack > 1 && exists;
      if (!stackable) return { ok: false, error: 'Mochila llena.' };
    }
    A.Currency.pay(price);
    A.State.addItem(itemId, 1);
    A.State.addChronicle({
      type: 'shop',
      text: `Compraste ${A.Inventory.resolveData(itemId).name} por ${price}c a ${npc.name}.`,
    });
    A.Bus.emit('shop:bought', { npcId, itemId, price });
    return { ok: true, price };
  }

  function sell(itemId) {
    const data = A.Inventory.resolveData(itemId);
    if (!data) return { ok: false, error: 'Item no encontrado.' };
    // No vender monedas
    if (data.subtype === 'coin') return { ok: false, error: 'Las monedas no se venden.' };
    // No vender items equipados
    const p = A.State.player;
    if (p.equipment.weapon === itemId || p.equipment.armor === itemId) {
      return { ok: false, error: 'Quita el item primero.' };
    }
    const slot = p.inventory.find((s) => s.itemId === itemId);
    if (!slot) return { ok: false, error: 'No tenés ese item.' };
    const baseValue = data.value || 0;
    const sellPrice = Math.max(1, Math.floor(baseValue / 2));
    A.State.removeItem(itemId, 1);
    A.Currency.add(sellPrice);
    A.State.addChronicle({
      type: 'shop',
      text: `Vendiste ${data.name} por ${sellPrice}c.`,
    });
    A.Bus.emit('shop:sold', { itemId, sellPrice });
    return { ok: true, copperReceived: sellPrice };
  }

  // ---------- Aprender hechizos ----------

  function spellPrice(spellId) {
    const spell = A.Data.getById('spells', spellId);
    if (!spell) return 0;
    return Math.max(50, (spell.tier || 1) * 100);
  }

  function learnSpell(npcId, spellId) {
    const npc = A.Data.getById('npcs', npcId);
    if (!npc) return { ok: false, error: 'NPC no encontrado.' };
    if (!(npc.teaches || []).includes(spellId)) {
      return { ok: false, error: 'Este NPC no enseña ese hechizo.' };
    }
    const p = A.State.player;
    if (!p.hasMagic) return { ok: false, error: 'No podés canalizar magia.' };
    if ((p.spells || []).includes(spellId)) {
      return { ok: false, error: 'Ya conoces ese hechizo.' };
    }
    const price = spellPrice(spellId);
    if (!A.Currency.canPay(price)) {
      return { ok: false, error: `Cuesta ${price} cobre.` };
    }
    A.Currency.pay(price);
    p.spells = p.spells || [];
    p.spells.push(spellId);
    const spell = A.Data.getById('spells', spellId);
    A.State.addChronicle({
      type: 'spell',
      text: `${npc.name} te enseñó ${spell.name}. Pagaste ${price}c.`,
    });
    A.Bus.emit('spell:learned', { spellId, source: 'npc', npcId });
    A.State.persist();
    return { ok: true, costPaid: price };
  }

  // ---------- Descansar pago ----------

  function restAt(npcId) {
    const npc = A.Data.getById('npcs', npcId);
    if (!npc) return { ok: false, error: 'NPC no encontrado.' };
    const cost = (npc.services && npc.services.restCost != null) ? npc.services.restCost : null;
    if (cost == null) return { ok: false, error: 'Este NPC no ofrece descanso.' };
    if (!A.Currency.canPay(cost)) return { ok: false, error: `Cuesta ${cost}c.` };
    A.Currency.pay(cost);
    A.State.fullRest();
    A.State.addChronicle({
      type: 'rest',
      text: `Pasaste la noche en lo de ${npc.name}. Pagaste ${cost}c.`,
    });
    A.Bus.emit('rest:done', { npcId, cost });
    return { ok: true };
  }

  A.NPC = {
    buy,
    sell,
    learnSpell,
    restAt,
    spellPrice,
    getNpcSellPrice,
  };
})(window.Aventurs);
