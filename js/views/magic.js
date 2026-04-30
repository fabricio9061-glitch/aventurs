/* ============================================================
   Aventurs — View: Magic (Tab Magia)
   Grimorio del jugador. En Fase 1 solo se ven los hechizos
   aprendidos (vacío por defecto, se aprenden con NPC sabio en Fase 3).
   En combate Fase 2 se podrán lanzar.
   ============================================================ */

(function (A) {
  'use strict';

  let mainEl = null;

  function render() {
    if (!mainEl) return;
    const p = A.State.player;
    if (!p) { mainEl.innerHTML = ''; return; }

    const knownIds = p.spells || [];
    const known = knownIds
      .map((id) => A.Data.getById('spells', id))
      .filter(Boolean);

    mainEl.innerHTML = `
      <section class="magic-view">

        <div class="magic-header">
          <h2 class="tab-title">Grimorio</h2>
          <div class="mana-readout">
            <span class="dim">Maná disponible</span>
            <span class="num">${p.mana} / ${p.maxMana}</span>
          </div>
        </div>

        ${known.length === 0 ? `
          <div class="empty-card">
            <div class="empty-icon">📖</div>
            <div class="empty-title">Aún no conoces hechizos</div>
            <div class="empty-text muted">
              Busca a Velrith en la Torre del Mago. Si tu maná alcanza y tu mente está firme, puede enseñarte.
            </div>
          </div>
        ` : `
          <div class="spell-grid">
            ${known.map(spellCard).join('')}
          </div>
        `}

      </section>
    `;
  }

  function spellCard(s) {
    const isDamage = !!s.damage;
    const isHeal = !!s.heal;
    const value = isDamage ? `${s.damage} daño` : isHeal ? `${s.heal} cura` : '—';
    const canCast = (A.State.player.mana || 0) >= s.manaCost;
    return `
      <div class="spell-card ${canCast ? '' : 'is-disabled'}">
        <div class="spell-icon">${s.icon || '✨'}</div>
        <div class="spell-name">${A.Utils.escapeHtml(s.name)}</div>
        <div class="spell-value num">${value}</div>
        <div class="spell-cost dim">Maná ${s.manaCost} · T${s.tier}</div>
        <p class="spell-desc">${A.Utils.escapeHtml(s.description || '')}</p>
      </div>
    `;
  }

  // Re-render al cambiar maná
  A.Bus.on('player:mana-changed', () => {
    if (A.State.ui.activeTab === 'magic') render();
  });

  const MagicView = {
    mount(container) {
      mainEl = container;
      render();
    },
    unmount() {
      if (mainEl) mainEl.innerHTML = '';
    },
  };

  A.Views = A.Views || {};
  A.Views.Magic = MagicView;
})(window.Aventurs);
