/* ============================================================
   Aventurs — View: Magic (helper)

   En v1.1.0 Magia ya no es una tab. La vista la consume el modal
   "magic" (ver modals.js). Acá exponemos un helper para que
   modals.js pueda renderizar el contenido del grimorio.
   ============================================================ */

(function (A) {
  'use strict';

  function renderHtml() {
    const p = A.State.player;
    if (!p) return '';
    if (!p.hasMagic) {
      return `
        <div class="empty-card">
          <div class="empty-icon">🚫</div>
          <div class="empty-title">Sin afinidad mágica</div>
          <div class="empty-text muted">
            Tu raza y herencia no te permiten canalizar maná. La magia no es para todos.
          </div>
        </div>
      `;
    }

    const knownIds = p.spells || [];
    const known = knownIds.map((id) => A.Data.getById('spells', id)).filter(Boolean);

    return `
      <div class="magic-modal-body">
        <div class="mana-readout">
          <span class="dim">Maná disponible</span>
          <span class="num">${p.mana} / ${p.maxMana}</span>
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
      </div>
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

  A.Views = A.Views || {};
  A.Views.Magic = {
    renderHtml,
    // mount() ya no se usa porque Magia no es tab. Lo dejamos como noop por compatibilidad.
    mount(container) {
      container.innerHTML = renderHtml();
    },
    unmount() {},
  };
})(window.Aventurs);
