/* ============================================================
   Aventurs — View: Shell
   Header + main + sidebar + footer. Monta tabs según State.ui.activeTab.
   ============================================================ */

(function (A) {
  'use strict';

  let rootEl = null;
  let mainEl = null;
  let sidebarEl = null;
  let unsubscribers = [];

  function tabConfig() {
    return [
      { id: 'world', label: 'Mundo', view: 'World' },
      { id: 'inventory', label: 'Inventario', view: 'Inventory' },
      { id: 'magic', label: 'Magia', view: 'Magic' },
      { id: 'chronicles', label: 'Crónicas', view: 'Chronicles' },
    ];
  }

  function render() {
    if (!rootEl) return;
    const player = A.State.player;
    const region = player ? A.Data.getById('regions', A.State.world.regionId) : null;
    const tabs = tabConfig();
    const activeTab = A.State.ui.activeTab || 'world';

    rootEl.innerHTML = `
      <div class="game-shell">
        <header class="shell-header">
          <div class="shell-brand">
            <span class="brand-icon">⚔️</span>
            <span class="brand-name">Aventurs</span>
          </div>
          <nav class="shell-nav">
            ${tabs.map((t) => `
              <button class="nav-tab ${t.id === activeTab ? 'is-active' : ''}" data-tab="${t.id}">
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
          <span class="version-pill">v1.0.0 · Fase 1</span>
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

    sidebarEl.innerHTML = `
      <div class="sidebar-card">
        <div class="char-header">
          <div class="char-avatar">${race ? race.icon : '👤'}</div>
          <div class="char-id">
            <div class="char-name">${A.Utils.escapeHtml(p.name)}</div>
            <div class="char-meta dim">${race ? race.name : '—'} · Nv ${p.level}</div>
          </div>
        </div>

        <div class="bar-group">
          <div class="bar-row">
            <span class="bar-label">Salud</span>
            <span class="bar-val num">${p.hp}/${p.maxHp}</span>
          </div>
          <div class="bar bar-hp"><span style="width:${pct(p.hp, p.maxHp)}%"></span></div>

          <div class="bar-row">
            <span class="bar-label">Maná</span>
            <span class="bar-val num">${p.mana}/${p.maxMana}</span>
          </div>
          <div class="bar bar-mana"><span style="width:${pct(p.mana, p.maxMana)}%"></span></div>

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

        ${region ? `<div class="loc-pill"><span>${region.icon || '📍'}</span> <span>${A.Utils.escapeHtml(region.name)}</span></div>` : ''}
      </div>
    `;
  }

  function renderActiveTab() {
    if (!mainEl) return;
    const tab = A.State.ui.activeTab || 'world';
    const map = { world: 'World', inventory: 'Inventory', magic: 'Magic', chronicles: 'Chronicles' };
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
      btn.addEventListener('click', () => {
        A.State.setTab(btn.dataset.tab);
      });
    });
    rootEl.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action));
    });
  }

  function handleAction(action) {
    if (action === 'editor') {
      A.Views.Editor.mount(rootEl);
    } else if (action === 'rules') {
      A.State.openModal('rules');
    } else if (action === 'menu') {
      A.State.openModal('menu');
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
    unsubscribers.push(A.Bus.on('state:changed', render));
    unsubscribers.push(A.Bus.on('player:hp-changed', renderSidebar));
    unsubscribers.push(A.Bus.on('player:mana-changed', renderSidebar));
    unsubscribers.push(A.Bus.on('player:xp-changed', renderSidebar));
    unsubscribers.push(A.Bus.on('player:leveled', renderSidebar));
    unsubscribers.push(A.Bus.on('inventory:changed', renderSidebar));
    unsubscribers.push(A.Bus.on('inventory:equipped', renderSidebar));
    unsubscribers.push(A.Bus.on('inventory:unequipped', renderSidebar));
    unsubscribers.push(A.Bus.on('currency:changed', renderSidebar));
    unsubscribers.push(A.Bus.on('region:changed', () => { renderSidebar(); renderActiveTab(); }));
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
