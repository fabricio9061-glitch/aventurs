/* ============================================================
   Aventurs — View: Inventory (Tab Inventario)
   Equipamiento (arma, armadura) + grid de items.
   Click en item abre modal item-detail con Equipar/Usar/Tirar.
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

    mainEl.innerHTML = `
      <section class="inv-view">

        <div class="inv-header">
          <h2 class="tab-title">Inventario</h2>
          <div class="inv-cap dim">
            ${A.State.inventoryUsedSlots()} / ${A.State.inventoryCapacity()} espacios
          </div>
        </div>

        <section class="inv-block">
          <div class="block-title">Equipado</div>
          <div class="equip-grid">
            ${equipSlot('Arma', weapon, 'weapon')}
            ${equipSlot('Armadura', armor, 'armor')}
          </div>
        </section>

        <section class="inv-block">
          <div class="block-title">Mochila</div>
          ${p.inventory.length === 0 ? `
            <div class="muted">No llevas nada.</div>
          ` : `
            <div class="item-list">
              ${p.inventory.map((slot) => itemRow(slot)).join('')}
            </div>
          `}
        </section>

      </section>
    `;

    bindEvents();
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

  function itemRow(slot) {
    const data = A.Inventory.resolveData(slot.itemId);
    if (!data) return '';
    const kind = A.Inventory.classifyItem(slot.itemId);
    const typeLabel = kindLabel(kind);
    const icon = data.icon || '📦';
    const qtyStr = slot.qty > 1 ? `×${slot.qty}` : '';

    return `
      <button class="item-row" data-item="${slot.itemId}">
        <div class="item-icon">${icon}</div>
        <div class="item-info">
          <div class="item-name">${A.Utils.escapeHtml(data.name)} <span class="num dim">${qtyStr}</span></div>
          <div class="item-meta dim">${typeLabel}${kind === 'weapon' ? ` · Daño ${data.damage}` : ''}${kind === 'armor' ? ` · Defensa +${data.defense}` : ''}</div>
        </div>
        <div class="item-arrow dim">›</div>
      </button>
    `;
  }

  function kindLabel(k) {
    return {
      weapon: 'Arma', armor: 'Armadura', consumable: 'Consumible',
      material: 'Material', misc: 'Objeto', coin: 'Moneda',
    }[k] || 'Objeto';
  }

  function rarityLabel(r) {
    return {
      common: 'Común', uncommon: 'Poco común', rare: 'Raro',
      epic: 'Épico', legendary: 'Legendario',
    }[r] || r;
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
  }

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

  A.Views = A.Views || {};
  A.Views.Inventory = InventoryView;
})(window.Aventurs);
