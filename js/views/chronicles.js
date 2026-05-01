/* ============================================================
   Aventurs — View: Chronicles (v1.4.0)
   Historial con filtros por tipo y agrupación por sesión.
   ============================================================ */

(function (A) {
  'use strict';

  let mainEl = null;
  let activeFilter = 'all';

  const TYPE_ICONS = {
    combat: '⚔️', loot: '💰', heal: '💚', shop: '🏪',
    travel: '🗺️', craft: '⚒️', spell: '📖', rest: '🌙',
    item: '🎒', note: '📝', system: '✨',
  };

  const FILTERS = [
    { id: 'all', label: 'Todo', icon: '·' },
    { id: 'combat', label: 'Combate', icon: '⚔️' },
    { id: 'loot', label: 'Botín', icon: '💰' },
    { id: 'travel', label: 'Viajes', icon: '🗺️' },
    { id: 'shop', label: 'Tienda', icon: '🏪' },
    { id: 'spell', label: 'Magia', icon: '📖' },
    { id: 'craft', label: 'Crafting', icon: '⚒️' },
  ];

  function render() {
    if (!mainEl) return;
    const all = A.State.chronicles || [];
    const filtered = activeFilter === 'all' ? all : all.filter((e) => e.type === activeFilter);
    const grouped = groupByDay(filtered);

    mainEl.innerHTML = `
      <section class="chronicles-view">
        <div class="chronicles-header">
          <h2 class="tab-title">Crónicas</h2>
          <div class="chronicles-count dim">${all.length} ${all.length === 1 ? 'entrada' : 'entradas'}</div>
        </div>

        <div class="chronicles-filters">
          ${FILTERS.map((f) => {
            const count = f.id === 'all' ? all.length : all.filter((e) => e.type === f.id).length;
            const cls = `chronicle-filter ${f.id === activeFilter ? 'is-active' : ''}`;
            return `
              <button class="${cls}" data-filter="${f.id}">
                <span class="filter-icon">${f.icon}</span>
                <span class="filter-label">${f.label}</span>
                <span class="filter-count num dim">${count}</span>
              </button>
            `;
          }).join('')}
        </div>

        ${filtered.length === 0 ? `
          <div class="empty-card">
            <div class="empty-icon">📜</div>
            <div class="empty-title">${activeFilter === 'all' ? 'Sin historia aún' : `Sin entradas de ${FILTERS.find((f)=>f.id===activeFilter)?.label.toLowerCase()}`}</div>
            <div class="empty-text muted">
              ${activeFilter === 'all'
                ? 'Cada cosa que hagas queda anotada acá: combates, viajes, descubrimientos.'
                : 'Probá con otro filtro.'}
            </div>
          </div>
        ` : `
          ${grouped.map(([dayLabel, entries]) => `
            <div class="chronicle-day">
              <div class="chronicle-day-label dim">${A.Utils.escapeHtml(dayLabel)}</div>
              <ul class="chronicle-list">
                ${entries.map(entryRow).join('')}
              </ul>
            </div>
          `).join('')}
        `}
      </section>
    `;

    bindEvents();
  }

  function groupByDay(entries) {
    if (entries.length === 0) return [];
    const groups = new Map();
    for (const e of entries) {
      const d = new Date(e.ts);
      const key = d.toISOString().slice(0, 10);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    }
    // Ordenar por más reciente
    const sorted = Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    return sorted.map(([key, list]) => [labelForDay(key), list]);
  }

  function labelForDay(key) {
    const today = new Date().toISOString().slice(0, 10);
    if (key === today) return 'Hoy';
    const d = new Date(key);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
  }

  function entryRow(e) {
    const icon = TYPE_ICONS[e.type] || '·';
    const time = A.Utils.formatTime(new Date(e.ts));
    const region = e.regionId ? A.Data.getById('regions', e.regionId) : null;
    const regionLabel = region ? region.name : '';
    return `
      <li class="chronicle-row">
        <div class="chronicle-icon">${icon}</div>
        <div class="chronicle-body">
          <div class="chronicle-text">${A.Utils.escapeHtml(e.text)}</div>
          <div class="chronicle-meta dim">${time}${regionLabel ? ` · ${A.Utils.escapeHtml(regionLabel)}` : ''}</div>
        </div>
      </li>
    `;
  }

  function bindEvents() {
    mainEl.querySelectorAll('[data-filter]').forEach((b) => {
      b.addEventListener('click', () => {
        activeFilter = b.dataset.filter;
        render();
      });
    });
  }

  const ChroniclesView = {
    mount(container) {
      mainEl = container;
      render();
    },
    unmount() {
      if (mainEl) mainEl.innerHTML = '';
    },
  };

  A.Views = A.Views || {};
  A.Views.Chronicles = ChroniclesView;
})(window.Aventurs);
