/* ============================================================
   Aventurs — View: Inventory (Tab Inventario)

   Cambios v1.1.0:
     - Mochila equipada arriba con botón "Cambiar mochila".
     - Grid de slots según la capacidad de la mochila (slots vacíos
       se muestran como espacios disponibles).
     - Equipamiento (arma/armadura) sigue arriba.
   ============================================================ */

(function (A) {
  'use strict';

  let mainEl = null;

  function render() {
    if (!mainEl) return;
    const p = A.State.player;
    if (!p) { mainEl.innerHTML = ''; return; }

    const weapon = p.equipment.weapon ? A.Data.getById('weapons', p.equipment.weapon) : null;
    const armor = p.equipment.armor ? A.Data.getById('armors', p.equipment.armor) : null;
    const bag = A.Data.getById('bags', p.bagId) || A.Data.getById('bags', A.State.DEFAULT_BAG_ID);
    const cap = bag ? bag.slots : 10;
    const used = A.State.inventoryUsedSlots();

    // Items no-coin
    const items = (p.inventory || []).filter((s) => {
      const it = A.Data.getById('items', s.itemId);
      return !it || it.subtype !== 'coin';
    });

    // Slots: items + relleno vacío hasta cap
    const cells = [];
    for (let i = 0; i < cap; i++) {
      if (items[i]) cells.push(renderSlot(items[i]));
      else cells.push(`<div class="bag-slot is-empty" aria-label="Slot vacío"></div>`);
    }

    mainEl.innerHTML = `
      <section class="inv-view">

        <div class="inv-header">
          <h2 class="tab-title">Inventario</h2>
          <div class="inv-cap dim">${used} / ${cap} slots</div>
        </div>

        <section class="inv-block">
          <div class="block-title">Equipado</div>
          <div class="equip-grid">
            ${equipSlot('Arma', weapon, 'weapon')}
            ${equipSlot('Armadura', armor, 'armor')}
          </div>
        </section>

        <section class="inv-block">
          <div class="bag-header">
            <div class="bag-title">
              <span class="bag-icon-big">${bag ? bag.icon : '🎒'}</span>
              <div>
                <div class="bag-name">${A.Utils.escapeHtml(bag ? bag.name : 'Mochila')}</div>
                <div class="bag-meta dim">${cap} slots · ${rarityLabel(bag ? bag.rarity : 'common')}</div>
              </div>
            </div>
            <button class="btn-secondary" data-action="change-bag">Cambiar mochila</button>
          </div>
          <div class="bag-grid">
            ${cells.join('')}
          </div>
        </section>

      </section>
    `;

    bindEvents();
  }

  function renderSlot(slot) {
    const data = A.Inventory.resolveData(slot.itemId);
    if (!data) return `<div class="bag-slot is-empty"></div>`;
    const icon = data.icon || '📦';
    const qty = slot.qty > 1 ? `<span class="bag-slot-qty num">${slot.qty}</span>` : '';
    return `
      <button class="bag-slot is-filled" data-item="${A.Utils.escapeHtml(slot.itemId)}" title="${A.Utils.escapeHtml(data.name)}">
        <span class="bag-slot-icon">${icon}</span>
        <span class="bag-slot-name">${A.Utils.escapeHtml(data.name)}</span>
        ${qty}
      </button>
    `;
  }

  function equipSlot(label, equipped, slotName) {
    if (!equipped) {
      return `
        <div class="equip-card is-empty">
          <div class="equip-slot-label dim">${label}</div>
          <div class="equip-empty muted">Sin equipar</div>
        </div>
      `;
    }
    const isWeapon = slotName === 'weapon';
    const stat = isWeapon ? `Daño ${equipped.damage}` : `Defensa +${equipped.defense}`;
    return `
      <div class="equip-card">
        <div class="equip-slot-label dim">${label}</div>
        <div class="equip-card-body">
          <div class="equip-item-icon">${equipped.icon || '⚔️'}</div>
          <div class="equip-item-info">
            <div class="equip-item-name">${A.Utils.escapeHtml(equipped.name)}</div>
            <div class="equip-item-stat num">${stat}</div>
            <div class="equip-item-rarity dim">${rarityLabel(equipped.rarity)} · Tier ${equipped.tier}</div>
          </div>
          <button class="btn-mini" data-unequip="${slotName}">Quitar</button>
        </div>
      </div>
    `;
  }

  function rarityLabel(r) {
    return ({ common: 'Común', uncommon: 'Poco común', rare: 'Raro', epic: 'Épico', legendary: 'Legendario' })[r] || r;
  }

  function bindEvents() {
    mainEl.querySelectorAll('[data-item]').forEach((btn) => {
      btn.addEventListener('click', () => {
        A.State.openModal('item-detail', { itemId: btn.dataset.item });
      });
    });
    mainEl.querySelectorAll('[data-unequip]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        A.Inventory.unequip(btn.dataset.unequip);
      });
    });
    mainEl.querySelectorAll('[data-action="change-bag"]').forEach((btn) => {
      btn.addEventListener('click', () => A.State.openModal('change-bag'));
    });
  }

  // Re-render automático ante cambios
  A.Bus.on('inventory:changed', () => {
    if (A.State.ui.activeTab === 'inventory') render();
  });
  A.Bus.on('inventory:equipped', () => {
    if (A.State.ui.activeTab === 'inventory') render();
  });
  A.Bus.on('inventory:unequipped', () => {
    if (A.State.ui.activeTab === 'inventory') render();
  });
  A.Bus.on('bag:equipped', () => {
    if (A.State.ui.activeTab === 'inventory') render();
  });

  const InventoryView = {
    mount(container) {
      mainEl = container;
      render();
    },
    unmount() {
      if (mainEl) mainEl.innerHTML = '';
    },
    rerender: render,
  };

  A.Views = A.Views || {};
  A.Views.Inventory = InventoryView;
})(window.Aventurs);
