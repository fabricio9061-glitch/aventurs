/* ============================================================
   Aventurs — View: Character Creator
   Grid 3x3 de razas + input nombre + card de resumen.
   ============================================================ */

(function (A) {
  'use strict';

  let rootEl = null;
  let selectedRaceId = null;
  let inputName = '';

  function render() {
    if (!rootEl) return;
    const races = A.Data.races;
    const selected = selectedRaceId ? races.find((r) => r.id === selectedRaceId) : null;
    const stats = selected ? A.Seed.statsForRace(selected.id) : null;

    rootEl.innerHTML = `
      <div class="char-page">
        <header class="char-header-bar">
          <div class="brand-mini">
            <span>⚔️</span><span>Aventurs</span>
          </div>
          <button class="btn-ghost" data-action="open-editor">Editor</button>
        </header>

        <div class="char-create">
          <h1 class="char-title">Nueva aventura</h1>
          <p class="char-sub muted">Elige una raza y un nombre. Las decisiones serias vienen después.</p>

          <div class="char-form">
            <label class="char-label" for="char-name">Nombre del personaje</label>
            <input id="char-name" class="char-input" type="text" maxlength="24"
                   value="${A.Utils.escapeHtml(inputName)}" placeholder="¿Cómo te llamas?">

            <div class="char-section-label">Raza</div>
            <div class="race-grid">
              ${races.map((r) => raceCard(r)).join('')}
            </div>

            ${selected ? renderSummary(selected, stats) : `
              <div class="char-summary-empty muted">Selecciona una raza para ver sus stats.</div>
            `}

            <div class="char-actions">
              <button class="btn-primary" id="btn-create"
                      ${(!selectedRaceId || !inputName.trim()) ? 'disabled' : ''}>
                Comenzar aventura
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    bindEvents();
  }

  function raceCard(race) {
    const isSel = race.id === selectedRaceId;
    const stats = A.Seed.statsForRace(race.id);
    return `
      <button class="race-card ${isSel ? 'is-selected' : ''}" data-race="${race.id}">
        <div class="race-icon">${race.icon}</div>
        <div class="race-name">${A.Utils.escapeHtml(race.name)}</div>
        <div class="race-type dim">${typeLabel(race.combatType)}</div>
        <div class="race-mini-stats num">
          <span title="Salud">❤ ${stats.maxHp}</span>
          <span title="Velocidad">⚡ ${stats.speed}</span>
          ${race.combatType !== 'warrior' || stats.maxMana > 0 ? `<span title="Maná">✦ ${stats.maxMana}</span>` : ''}
        </div>
      </button>
    `;
  }

  function renderSummary(race, stats) {
    return `
      <div class="char-summary">
        <div class="char-summary-icon">${race.icon}</div>
        <div class="char-summary-info">
          <div class="char-summary-name">${A.Utils.escapeHtml(race.name)}</div>
          <div class="char-summary-type dim">${typeLabel(race.combatType)}</div>
          <p class="char-summary-desc">${A.Utils.escapeHtml(race.description)}</p>
        </div>
        <div class="char-summary-stats">
          <div class="big-stat"><div class="big-stat-label dim">Salud</div><div class="big-stat-val num">${stats.maxHp}</div></div>
          <div class="big-stat"><div class="big-stat-label dim">Maná</div><div class="big-stat-val num">${stats.maxMana}</div></div>
          <div class="big-stat"><div class="big-stat-label dim">Velocidad</div><div class="big-stat-val num">${stats.speed}</div></div>
          <div class="big-stat"><div class="big-stat-label dim">Armadura</div><div class="big-stat-val num">${stats.armor}</div></div>
          <div class="big-stat"><div class="big-stat-label dim">Daño</div><div class="big-stat-val num">${stats.damage}</div></div>
          <div class="big-stat"><div class="big-stat-label dim">Esquiva</div><div class="big-stat-val num">${stats.dodge}</div></div>
        </div>
      </div>
    `;
  }

  function typeLabel(t) {
    if (t === 'warrior') return 'Guerrero';
    if (t === 'mage') return 'Mago';
    return 'Híbrido';
  }

  function bindEvents() {
    rootEl.querySelectorAll('.race-card').forEach((card) => {
      card.addEventListener('click', () => {
        selectedRaceId = card.dataset.race;
        render();
      });
    });
    const input = rootEl.querySelector('#char-name');
    if (input) {
      input.addEventListener('input', (e) => {
        inputName = e.target.value;
        // Re-habilitar botón sin re-render completo (evita perder foco)
        const btn = rootEl.querySelector('#btn-create');
        if (btn) btn.disabled = !selectedRaceId || !inputName.trim();
      });
      input.focus();
    }
    const create = rootEl.querySelector('#btn-create');
    if (create) {
      create.addEventListener('click', onCreate);
    }
    const editorBtn = rootEl.querySelector('[data-action="open-editor"]');
    if (editorBtn) {
      editorBtn.addEventListener('click', () => {
        A.Views.Editor.mount(rootEl);
      });
    }
  }

  function onCreate() {
    if (!selectedRaceId || !inputName.trim()) return;
    A.State.createCharacter({ name: inputName.trim(), raceId: selectedRaceId });
    selectedRaceId = null;
    inputName = '';
    A.Views.Shell.mount(rootEl);
  }

  const CharacterView = {
    mount(container) {
      rootEl = container;
      selectedRaceId = null;
      inputName = '';
      render();
    },
    unmount() {
      if (rootEl) rootEl.innerHTML = '';
    },
  };

  A.Views = A.Views || {};
  A.Views.Character = CharacterView;
})(window.Aventurs);
