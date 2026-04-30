/* ============================================================
   Aventurs — View: Shell
   Header + main + sidebar + footer.

   Cambios v1.1.0:
     - Quitada la tab "Magia" del nav.
     - Agregado botón "Magia" en el sidebar al lado del nombre, solo si
       player.hasMagic === true.
     - Sidebar agrega mini-grid 2x5 del inventario debajo de los stats.
     - Header indicador de viaje en curso.
   ============================================================ */

(function (A) {
  'use strict';

  let rootEl = null;
  let mainEl = null;
  let sidebarEl = null;
  let unsubscribers = [];

  function tabConfig() {
    // Magia ya NO es una tab; queda accesible solo desde botón en sidebar.
    return [
      { id: 'world', label: 'Mundo', view: 'World' },
      { id: 'inventory', label: 'Inventario', view: 'Inventory' },
      { id: 'chronicles', label: 'Crónicas', view: 'Chronicles' },
    ];
  }

  function render() {
    if (!rootEl) return;
    const player = A.State.player;
    const tabs = tabConfig();
    const activeTab = A.State.ui.activeTab || 'world';
    // Si viene de save anterior con activeTab='magic' y ahora no es tab, lo redirigimos.
    let validTab = activeTab;
    if (!tabs.find((t) => t.id === activeTab)) {
      validTab = 'world';
      A.State.ui.activeTab = 'world';
    }

    rootEl.innerHTML = `
      <div class="game-shell">
        <header class="shell-header">
          <div class="shell-brand">
            <span class="brand-icon">⚔️</span>
            <span class="brand-name">Aventurs</span>
          </div>
          <nav class="shell-nav">
            ${tabs.map((t) => `
              <button class="nav-tab ${t.id === validTab ? 'is-active' : ''}" data-tab="${t.id}">
                ${A.Utils.escapeHtml(t.label)}
              </button>
            `).join('')}
          </nav>
          <div class="shell-actions">
            <button class="btn-ghost" data-action="rules">Reglas</button>
            <button class="btn-ghost" data-action="editor">Editor</button>
            <button class="btn-ghost" data-action="menu">Menú</button>
          </div>
        </header>

        <div class="shell-body">
          <main class="shell-main" id="shell-main"></main>
          <aside class="shell-sidebar" id="shell-sidebar"></aside>
        </div>

        <footer class="shell-footer">
          <span class="version-pill">v1.1.0 · Fase 1</span>
        </footer>
      </div>
    `;

    mainEl = rootEl.querySelector('#shell-main');
    sidebarEl = rootEl.querySelector('#shell-sidebar');

    bindEvents();
    renderSidebar();
    renderActiveTab();
  }

  function renderSidebar() {
    if (!sidebarEl) return;
    const p = A.State.player;
    if (!p) { sidebarEl.innerHTML = ''; return; }

    const race = A.Data.getById('races', p.raceId);
    const weapon = p.equipment.weapon ? A.Data.getById('weapons', p.equipment.weapon) : null;
    const armor = p.equipment.armor ? A.Data.getById('armors', p.equipment.armor) : null;
    const xpToNext = xpForLevel(p.level + 1);
    const region = A.State.world ? A.Data.getById('regions', A.State.world.regionId) : null;
    const bag = A.Data.getById('bags', p.bagId) || A.Data.getById('bags', A.State.DEFAULT_BAG_ID);

    sidebarEl.innerHTML = `
      <div class="sidebar-card">
        <div class="char-header">
          <div class="char-avatar">${race ? race.icon : '👤'}</div>
          <div class="char-id">
            <div class="char-name-row">
              <span class="char-name">${A.Utils.escapeHtml(p.name)}</span>
              ${p.hasMagic ? `<button class="magic-btn" data-action="open-magic" title="Magia">✨</button>` : ''}
            </div>
            <div class="char-meta dim">${race ? race.name : '—'} · Nv ${p.level}</div>
          </div>
        </div>

        <div class="bar-group">
          <div class="bar-row">
            <span class="bar-label">Salud</span>
            <span class="bar-val num">${p.hp}/${p.maxHp}</span>
          </div>
          <div class="bar bar-hp"><span style="width:${pct(p.hp, p.maxHp)}%"></span></div>

          ${p.hasMagic ? `
            <div class="bar-row">
              <span class="bar-label">Maná</span>
              <span class="bar-val num">${p.mana}/${p.maxMana}</span>
            </div>
            <div class="bar bar-mana"><span style="width:${pct(p.mana, p.maxMana)}%"></span></div>
          ` : ''}

          <div class="bar-row">
            <span class="bar-label">XP</span>
            <span class="bar-val num">${p.xp}/${xpToNext}</span>
          </div>
          <div class="bar bar-xp"><span style="width:${pct(p.xp, xpToNext)}%"></span></div>
        </div>

        <div class="stat-grid">
          <div class="stat"><div class="stat-label dim">Daño</div><div class="stat-val num">${p.stats.damage}</div></div>
          <div class="stat"><div class="stat-label dim">Armadura</div><div class="stat-val num">${p.stats.armor}</div></div>
          <div class="stat"><div class="stat-label dim">Esquiva</div><div class="stat-val num">${p.stats.dodge}</div></div>
          <div class="stat"><div class="stat-label dim">Velocidad</div><div class="stat-val num">${p.stats.speed}</div></div>
        </div>

        <div class="equip-block">
          <div class="equip-row">
            <span class="dim">Arma</span>
            <span>${weapon ? A.Utils.escapeHtml(weapon.name) : '<span class="faint">—</span>'}</span>
          </div>
          <div class="equip-row">
            <span class="dim">Armadura</span>
            <span>${armor ? A.Utils.escapeHtml(armor.name) : '<span class="faint">—</span>'}</span>
          </div>
        </div>

        <div class="coins-row">
          <span class="dim">Monedas</span>
          <span class="num">${A.Currency.formatWallet()}</span>
        </div>

        ${p.pet ? `
          <div class="pet-row">
            <span class="pet-icon">${p.pet.icon || '🐾'}</span>
            <span class="dim">Mascota</span>
            <span>${A.Utils.escapeHtml(p.pet.name)}</span>
          </div>
        ` : ''}

        ${renderMiniInventory(bag)}

        ${region ? `<div class="loc-pill"><span>${region.icon || '📍'}</span> <span>${A.Utils.escapeHtml(region.name)}</span></div>` : ''}
      </div>
    `;

    bindSidebarEvents();
  }

  function renderMiniInventory(bag) {
    const p = A.State.player;
    const cap = bag ? bag.slots : 10;
    const used = A.State.inventoryUsedSlots();
    const visibleSlots = 10; // 2x5 grid

    // No-coin inventory items
    const items = (p.inventory || []).filter((s) => {
      const it = A.Data.getById('items', s.itemId);
      return !it || it.subtype !== 'coin';
    });
    const visible = items.slice(0, visibleSlots);
    const overflow = Math.max(0, items.length - visibleSlots);

    const cells = [];
    for (let i = 0; i < visibleSlots; i++) {
      const slot = visible[i];
      if (slot) {
        const data = A.Inventory.resolveData(slot.itemId);
        const icon = data ? (data.icon || '📦') : '📦';
        const qty = slot.qty > 1 ? `<span class="mini-qty num">${slot.qty}</span>` : '';
        cells.push(`
          <button class="mini-slot is-filled" data-mini-item="${A.Utils.escapeHtml(slot.itemId)}" title="${A.Utils.escapeHtml(data ? data.name : slot.itemId)}">
            <span class="mini-icon">${icon}</span>
            ${qty}
          </button>
        `);
      } else {
        cells.push(`<div class="mini-slot is-empty"></div>`);
      }
    }

    return `
      <div class="mini-inv-block">
        <div class="mini-inv-header">
          <span class="dim">Mochila</span>
          <span class="num">${used} / ${cap}</span>
        </div>
        <div class="mini-grid">
          ${cells.join('')}
        </div>
        ${overflow > 0 ? `<button class="mini-overflow" data-action="open-inventory">+${overflow} más en inventario</button>` : ''}
      </div>
    `;
  }

  function renderActiveTab() {
    if (!mainEl) return;
    const tab = A.State.ui.activeTab || 'world';
    const map = { world: 'World', inventory: 'Inventory', chronicles: 'Chronicles' };
    const viewName = map[tab];
    const view = A.Views[viewName];
    if (view && view.mount) {
      view.mount(mainEl);
    } else {
      mainEl.innerHTML = `<div class="empty-tab">Vista "${tab}" pendiente.</div>`;
    }
  }

  function bindEvents() {
    rootEl.querySelectorAll('.nav-tab').forEach((btn) => {
      btn.addEventListener('click', () => A.State.setTab(btn.dataset.tab));
    });
    rootEl.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action));
    });
  }

  function bindSidebarEvents() {
    sidebarEl.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action));
    });
    sidebarEl.querySelectorAll('[data-mini-item]').forEach((btn) => {
      btn.addEventListener('click', () => {
        A.State.openModal('item-detail', { itemId: btn.dataset.miniItem });
      });
    });
  }

  function handleAction(action) {
    if (action === 'editor') {
      A.Views.Editor.mount(rootEl);
    } else if (action === 'rules') {
      A.State.openModal('rules');
    } else if (action === 'menu') {
      A.State.openModal('menu');
    } else if (action === 'open-magic') {
      A.State.openModal('magic');
    } else if (action === 'open-inventory') {
      A.State.setTab('inventory');
    }
  }

  function pct(cur, max) {
    if (!max) return 0;
    return Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
  }

  function xpForLevel(lvl) {
    return 50 * lvl * lvl;
  }

  function subscribe() {
    unsubscribers.push(A.Bus.on('view:changed', renderActiveTab));
    unsubscribers.push(A.Bus.on('player:hp-changed', renderSidebar));
    unsubscribers.push(A.Bus.on('player:mana-changed', renderSidebar));
    unsubscribers.push(A.Bus.on('player:xp-changed', renderSidebar));
    unsubscribers.push(A.Bus.on('player:leveled', renderSidebar));
    unsubscribers.push(A.Bus.on('inventory:changed', renderSidebar));
    unsubscribers.push(A.Bus.on('inventory:equipped', renderSidebar));
    unsubscribers.push(A.Bus.on('inventory:unequipped', renderSidebar));
    unsubscribers.push(A.Bus.on('bag:equipped', renderSidebar));
    unsubscribers.push(A.Bus.on('currency:changed', renderSidebar));
    unsubscribers.push(A.Bus.on('region:changed', () => { renderSidebar(); renderActiveTab(); }));
    unsubscribers.push(A.Bus.on('travel:started', () => renderActiveTab()));
    unsubscribers.push(A.Bus.on('travel:step', () => renderActiveTab()));
    unsubscribers.push(A.Bus.on('travel:completed', () => { renderSidebar(); renderActiveTab(); }));
    unsubscribers.push(A.Bus.on('travel:cancelled', renderActiveTab));
    unsubscribers.push(A.Bus.on('tame:success', renderSidebar));
    unsubscribers.push(A.Bus.on('chronicle:added', () => {
      if (A.State.ui.activeTab === 'chronicles') renderActiveTab();
    }));
    unsubscribers.push(A.Bus.on('modal:open', renderModals));
    unsubscribers.push(A.Bus.on('modal:close', renderModals));
  }

  function renderModals() {
    if (A.Views && A.Views.Modals && A.Views.Modals.render) {
      A.Views.Modals.render(rootEl);
    }
  }

  const ShellView = {
    mount(container) {
      rootEl = container;
      render();
      subscribe();
      renderModals();
    },
    unmount() {
      unsubscribers.forEach((u) => u && u());
      unsubscribers = [];
      if (rootEl) rootEl.innerHTML = '';
    },
    rerender: render,
  };

  A.Views = A.Views || {};
  A.Views.Shell = ShellView;
})(window.Aventurs);
