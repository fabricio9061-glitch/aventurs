/* ============================================================
   Aventurs — View: Shell (v1.2.0)

   Cambios v1.2.0:
     - Tab "Inventario" eliminada del nav. La mochila vive completamente
       en el sidebar derecho (todos los slots según capacidad).
     - Si State.combat está activo, el main muestra Combat view en vez de
       lo que diga la tab activa.
     - Sidebar ya no tiene mini-grid de 10; ahora muestra el grid completo
       de la mochila (5..32 slots).
   ============================================================ */

(function (A) {
  'use strict';

  let rootEl = null;
  let mainEl = null;
  let sidebarEl = null;
  let chroniclesEl = null;
  let unsubscribers = [];

  function tabConfig() {
    return [
      { id: 'world', label: 'Mundo', view: 'World' },
    ];
  }

  function render() {
    if (!rootEl) return;
    const tabs = tabConfig();
    const activeTab = A.State.ui.activeTab || 'world';
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
          ${tabs.length > 1 ? `
            <nav class="shell-nav">
              ${tabs.map((t) => `
                <button class="nav-tab ${t.id === validTab ? 'is-active' : ''}" data-tab="${t.id}">
                  ${A.Utils.escapeHtml(t.label)}
                </button>
              `).join('')}
            </nav>
          ` : `<div class="shell-nav-spacer"></div>`}
          <div class="shell-actions">
            <button class="btn-ghost" data-action="rules">Reglas</button>
            <button class="btn-ghost" data-action="editor">Editor</button>
            <button class="btn-ghost" data-action="menu">Menú</button>
          </div>
        </header>

        <div class="shell-body">
          <aside class="shell-chronicles" id="shell-chronicles"></aside>
          <main class="shell-main" id="shell-main"></main>
          <aside class="shell-sidebar" id="shell-sidebar"></aside>
        </div>

        <footer class="shell-footer">
          <span class="version-pill">v1.5.2</span>
        </footer>
      </div>
    `;

    mainEl = rootEl.querySelector('#shell-main');
    sidebarEl = rootEl.querySelector('#shell-sidebar');
    chroniclesEl = rootEl.querySelector('#shell-chronicles');

    bindEvents();
    renderSidebar();
    renderChroniclesPanel();
    renderActiveView();
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
    const bag = A.Data.getById('bags', p.bagId) || A.Data.getById('bags', 'bag_starter');

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

          <div class="bar-row">
            <span class="bar-label">Comida</span>
            <span class="bar-val num">${p.food || 0}/${p.maxFood || 20}</span>
          </div>
          <div class="bar bar-food"><span style="width:${pct(p.food || 0, p.maxFood || 20)}%"></span></div>
        </div>

        <div class="stat-grid">
          <div class="stat"><div class="stat-label dim">Daño</div><div class="stat-val num">${p.stats.damage}</div></div>
          <div class="stat"><div class="stat-label dim">Armadura</div><div class="stat-val num">${p.stats.armor}</div></div>
          <div class="stat"><div class="stat-label dim">Esquiva</div><div class="stat-val num">${p.stats.dodge}</div></div>
          <div class="stat"><div class="stat-label dim">Velocidad</div><div class="stat-val num">${p.stats.speed}</div></div>
        </div>

        <div class="equip-block">
          <div class="block-subtitle dim">Equipado</div>
          <div class="equip-grid-side">
            ${equipMini('Arma', weapon, 'weapon')}
            ${equipMini('Armadura', armor, 'armor')}
            ${equipMini('Mochila', bag, 'bag')}
          </div>
        </div>

        ${p.pet ? `
          <div class="pet-row">
            <span class="pet-icon">${p.pet.icon || '🐾'}</span>
            <span class="dim">Mascota</span>
            <span>${A.Utils.escapeHtml(p.pet.name)}</span>
          </div>
        ` : ''}

        ${renderBag(bag)}

        ${region ? `<div class="loc-pill"><span>${region.icon || '📍'}</span> <span>${A.Utils.escapeHtml(region.name)}</span></div>` : ''}
      </div>
    `;

    bindSidebarEvents();
  }

  function equipMini(label, equipped, slotName) {
    if (!equipped) {
      return `<div class="equip-mini is-empty"><div class="dim">${label}</div><div class="faint">—</div></div>`;
    }
    let stat = '';
    if (slotName === 'weapon') stat = `${equipped.damage}`;
    else if (slotName === 'armor') stat = `+${equipped.defense}`;
    else if (slotName === 'bag') stat = `${equipped.slots} sl`;
    const dataAttr = slotName === 'bag'
      ? `data-equipped-bag="${A.Utils.escapeHtml(equipped.id)}"`
      : `data-equipped-slot="${slotName}"`;
    return `
      <button class="equip-mini equip-mini-clickable" ${dataAttr}>
        <div class="dim">${label}</div>
        <div class="equip-mini-content">
          <span class="equip-mini-icon">${equipped.icon || '⚔️'}</span>
          <span class="equip-mini-name">${A.Utils.escapeHtml(equipped.name)}</span>
        </div>
        <div class="equip-mini-stat num">${stat}</div>
      </button>
    `;
  }

  function renderBag(bag) {
    const p = A.State.player;
    const cap = bag ? bag.slots : 5;
    const used = A.State.inventoryUsedSlots();

    const items = (p.inventory || []).filter((s) => {
      const it = A.Data.getById('items', s.itemId);
      return !it || it.subtype !== 'coin';
    });

    const cells = [];
    for (let i = 0; i < cap; i++) {
      const slot = items[i];
      if (slot) {
        const data = A.Inventory.resolveData(slot.itemId);
        const icon = data ? (data.icon || '📦') : '📦';
        const qty = slot.qty > 1 ? `<span class="bag-side-qty num">${slot.qty}</span>` : '';
        cells.push(`
          <button class="bag-side-slot is-filled" data-mini-item="${A.Utils.escapeHtml(slot.itemId)}" title="${A.Utils.escapeHtml(data ? data.name : slot.itemId)}">
            <span class="bag-side-icon">${icon}</span>
            ${qty}
          </button>
        `);
      } else {
        cells.push(`<div class="bag-side-slot is-empty"></div>`);
      }
    }

    return `
      <div class="bag-side-block">
        <div class="bag-side-header">
          <div>
            <span class="dim">Mochila</span>
            <span class="num"> ${used} / ${cap}</span>
          </div>
          <span class="dim small">${bag ? A.Utils.escapeHtml(bag.name) : ''}</span>
        </div>
        <div class="bag-side-grid" style="grid-template-columns: repeat(${cap <= 5 ? 5 : cap <= 16 ? 4 : 5}, 1fr)">
          ${cells.join('')}
        </div>
      </div>
    `;
  }

  function renderActiveView() {
    if (!mainEl) return;
    // Si hay combate activo, renderizar Combat
    if (A.State.combat) {
      A.Views.Combat.mount(mainEl);
      return;
    }
    const tab = A.State.ui.activeTab || 'world';
    const map = { world: 'World' };
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

  function renderChroniclesPanel() {
    if (!chroniclesEl) return;
    // Crónicas vienen en state.chronicles con unshift (más nuevo PRIMERO).
    // Para el panel queremos: cronológico, más nuevo abajo. Tomamos las últimas 50.
    const all = A.State.chronicles || [];
    const recent = all.slice(0, 50).slice().reverse(); // más viejo primero, nuevo al final
    chroniclesEl.innerHTML = `
      <div class="chronicles-side-card">
        <div class="chronicles-side-header">
          <span class="dim">📜 Crónicas</span>
          <span class="dim small">${all.length}</span>
        </div>
        <div class="chronicles-side-list" id="chronicles-side-list">
          ${recent.length === 0
            ? `<div class="muted small">Aún no hay historia.</div>`
            : recent.map(chronicleRow).join('')}
        </div>
      </div>
    `;
    // Auto-scroll al fondo (donde está la entrada más reciente)
    const list = chroniclesEl.querySelector('#chronicles-side-list');
    if (list) {
      requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
    }
  }

  function chronicleRow(e) {
    const icons = {
      combat: '⚔️', loot: '💰', heal: '💚', shop: '🏪',
      travel: '🗺️', craft: '⚒️', spell: '📖', rest: '🌙',
      item: '🎒', note: '📝', system: '·', region: '📍',
    };
    const icon = icons[e.type] || '·';
    return `
      <div class="chronicle-side-row">
        <span class="chronicle-side-icon">${icon}</span>
        <span class="chronicle-side-text">${A.Utils.escapeHtml(e.text)}</span>
      </div>
    `;
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
    // Click en una pieza equipada (arma/armadura) → modal con opción Quitar
    sidebarEl.querySelectorAll('[data-equipped-slot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slot = btn.dataset.equippedSlot;
        const itemId = slot === 'weapon' ? A.State.player.equipment.weapon : A.State.player.equipment.armor;
        if (itemId) A.State.openModal('item-detail', { itemId, equipped: true });
      });
    });
    // Click en mochila equipada → modal especial de mochila
    sidebarEl.querySelectorAll('[data-equipped-bag]').forEach((btn) => {
      btn.addEventListener('click', () => {
        A.State.openModal('equipped-bag', { bagId: btn.dataset.equippedBag });
      });
    });
  }

  function handleAction(action) {
    if (action === 'editor') A.Views.Editor.mount(rootEl);
    else if (action === 'rules') A.State.openModal('rules');
    else if (action === 'menu') A.State.openModal('menu');
    else if (action === 'open-magic') A.State.openModal('magic');
  }

  function pct(cur, max) {
    if (!max) return 0;
    return Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
  }

  function xpForLevel(lvl) {
    return 50 * lvl * lvl;
  }

  function subscribe() {
    unsubscribers.push(A.Bus.on('view:changed', renderActiveView));
    unsubscribers.push(A.Bus.on('player:hp-changed', renderSidebar));
    unsubscribers.push(A.Bus.on('player:mana-changed', renderSidebar));
    unsubscribers.push(A.Bus.on('player:xp-changed', renderSidebar));
    unsubscribers.push(A.Bus.on('player:leveled', renderSidebar));
    unsubscribers.push(A.Bus.on('inventory:changed', renderSidebar));
    unsubscribers.push(A.Bus.on('inventory:equipped', renderSidebar));
    unsubscribers.push(A.Bus.on('inventory:unequipped', renderSidebar));
    unsubscribers.push(A.Bus.on('bag:equipped', renderSidebar));
    unsubscribers.push(A.Bus.on('currency:changed', renderSidebar));
    unsubscribers.push(A.Bus.on('region:changed', () => { renderSidebar(); renderActiveView(); }));
    unsubscribers.push(A.Bus.on('travel:started', renderActiveView));
    unsubscribers.push(A.Bus.on('travel:step', renderActiveView));
    unsubscribers.push(A.Bus.on('travel:completed', () => { renderSidebar(); renderActiveView(); }));
    unsubscribers.push(A.Bus.on('travel:cancelled', renderActiveView));
    unsubscribers.push(A.Bus.on('combat:started', renderActiveView));
    unsubscribers.push(A.Bus.on('combat:ended', () => { renderSidebar(); renderActiveView(); }));
    unsubscribers.push(A.Bus.on('tame:success', renderSidebar));
    // Crónicas: refresh panel izquierdo cada vez que se agrega entrada
    unsubscribers.push(A.Bus.on('chronicle:added', renderChroniclesPanel));
    unsubscribers.push(A.Bus.on('tame:lost', renderSidebar));
    unsubscribers.push(A.Bus.on('chronicle:added', () => {
      if (A.State.ui.activeTab === 'chronicles') renderActiveView();
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
