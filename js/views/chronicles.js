/* ============================================================
   Aventurs — View: Chronicles (Tab Crónicas)
   Historial inverso de eventos del jugador.

   Tipos: combat, loot, heal, shop, travel, craft, spell, rest, item, note, system.
   ============================================================ */

(function (A) {
  'use strict';

  let mainEl = null;

  const TYPE_ICONS = {
    combat: '⚔️', loot: '💰', heal: '💚', shop: '🏪',
    travel: '🗺️', craft: '⚒️', spell: '📖', rest: '🌙',
    item: '🎒', note: '📝', system: '✨',
  };

  function render() {
    if (!mainEl) return;
    const entries = A.State.chronicles || [];

    mainEl.innerHTML = `
      <section class="chronicles-view">
        <div class="chronicles-header">
          <h2 class="tab-title">Crónicas</h2>
          <div class="chronicles-count dim">${entries.length} ${entries.length === 1 ? 'entrada' : 'entradas'}</div>
        </div>

        ${entries.length === 0 ? `
          <div class="empty-card">
            <div class="empty-icon">📜</div>
            <div class="empty-title">Sin historia aún</div>
            <div class="empty-text muted">
              Cada cosa que hagas queda anotada acá: combates, viajes, descubrimientos.
            </div>
          </div>
        ` : `
          <ul class="chronicle-list">
            ${entries.map(entryRow).join('')}
          </ul>
        `}
      </section>
    `;
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
