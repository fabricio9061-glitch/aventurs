/* ============================================================
   Aventurs — View: Character Creator
   Grid 3x3 de razas + input nombre + card de resumen.
   ============================================================ */

(function (A) {
  'use strict';

  let rootEl = null;
  let selectedRaceId = null;
  let inputName = '';

  // v1.6.3: tema visual por raza (color principal + acento)
  const RACE_THEMES = {
    humano:    { primary: '#a89060', accent: '#d4a437', tag: 'Equilibrado' },
    elfo:      { primary: '#5a8a4a', accent: '#7ab058', tag: 'Ágil' },
    orco:      { primary: '#7a3018', accent: '#a04020', tag: 'Agresivo' },
    enano:     { primary: '#7a5018', accent: '#9c6820', tag: 'Tanque' },
    gnomo:     { primary: '#3a5070', accent: '#5070a0', tag: 'Mago' },
    dracon:    { primary: '#a04018', accent: '#d46a20', tag: 'Épico' },
    dracónido: { primary: '#a04018', accent: '#d46a20', tag: 'Épico' },
    robot:     { primary: '#3a587a', accent: '#5078a0', tag: 'Tecnológico' },
    alien:     { primary: '#5a3870', accent: '#8050a0', tag: 'Extraño' },
    alienigena:{ primary: '#5a3870', accent: '#8050a0', tag: 'Extraño' },
    mediano:   { primary: '#5a7048', accent: '#7c9560', tag: 'Hábil' },
    undead:    { primary: '#3a3848', accent: '#605870', tag: 'No-muerto' },
  };

  function themeForRace(raceId) {
    return RACE_THEMES[raceId] || RACE_THEMES[raceId.toLowerCase()] || { primary: '#a89060', accent: '#d4a437', tag: 'Híbrido' };
  }

  function render() {
    if (!rootEl) return;
    const races = A.Data.races;
    const selected = selectedRaceId ? races.find((r) => r.id === selectedRaceId) : null;
    const stats = selected ? A.Seed.statsForRace(selected.id) : null;
    const theme = selected ? themeForRace(selected.id) : null;

    rootEl.innerHTML = `
      <div class="char-page char-page-v2">
        <header class="char-header-bar">
          <div class="brand-mini">
            <span>⚔️</span><span>Aventurs</span>
          </div>
          <button class="btn-ghost" data-action="open-editor">Editor</button>
        </header>

        <div class="char-create-v2">
          <div class="char-title-block">
            <h1 class="char-title">Nueva aventura</h1>
            <p class="char-sub muted">Elegí tu héroe. Las decisiones serias vienen después.</p>
          </div>

          <div class="char-layout-2col">
            <!-- Columna izquierda: preview grande de la raza seleccionada -->
            <aside class="char-preview-panel ${selected ? 'has-selection' : ''}" ${selected ? `style="--race-primary: ${theme.primary}; --race-accent: ${theme.accent};"` : ''}>
              ${selected ? renderRacePreview(selected, stats, theme) : `
                <div class="char-preview-empty">
                  <div class="char-preview-empty-icon">⚔️</div>
                  <div class="char-preview-empty-text">Seleccioná una raza<br>para ver su perfil</div>
                </div>
              `}
            </aside>

            <!-- Columna derecha: selector de razas + nombre + botón -->
            <section class="char-selector-panel">
              <div class="char-section-label">Razas disponibles</div>
              <div class="race-grid race-grid-v2">
                ${races.map((r) => raceCard(r)).join('')}
              </div>

              <div class="char-form-block">
                <label class="char-label" for="char-name">Nombre del personaje</label>
                <input id="char-name" class="char-input char-input-v2" type="text" maxlength="24"
                       value="${A.Utils.escapeHtml(inputName)}" placeholder="Si lo dejás vacío, te asignamos uno...">
                ${selectedRaceId && !inputName.trim() ? `<div class="char-input-hint dim">Se generará uno aleatorio al comenzar.</div>` : ''}

                <button class="btn-primary char-create-btn" id="btn-create" ${!selectedRaceId ? 'disabled' : ''}>
                  ${selected ? `⚔️ Comenzar como ${A.Utils.escapeHtml(selected.name)}` : 'Comenzar aventura'}
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    `;

    bindEvents();
  }

  /**
   * v1.6.3: Preview grande de la raza seleccionada (columna izquierda).
   */
  function renderRacePreview(race, stats, theme) {
    const baseDmg = (stats.damage > 0) ? `1d3+${stats.damage}` : '1d3';
    // Barras visuales: estimadas a partir de stats típicos
    const bars = [
      { label: 'Salud', val: stats.maxHp, max: 30, color: '#c4513a' },
      { label: 'Maná', val: stats.maxMana, max: 25, color: '#3a78c4' },
      { label: 'Velocidad', val: stats.speed, max: 18, color: '#7a9c3a' },
      { label: 'Armadura', val: stats.armor, max: 8, color: '#8d6a30' },
      { label: 'Esquiva', val: stats.dodge, max: 10, color: '#a87838' },
    ];
    return `
      <div class="race-preview-content">
        <div class="race-preview-icon">${race.icon}</div>
        <div class="race-preview-name">${A.Utils.escapeHtml(race.name)}</div>
        <div class="race-preview-type">${theme.tag} · ${typeLabel(race.combatType)}</div>
        <p class="race-preview-desc">${A.Utils.escapeHtml(race.description)}</p>

        <div class="race-preview-stats">
          ${bars.map((b) => `
            <div class="race-stat-row">
              <span class="race-stat-label">${b.label}</span>
              <div class="race-stat-bar"><span style="width:${Math.min(100, (b.val / b.max) * 100)}%; background:${b.color}"></span></div>
              <span class="race-stat-val num">${b.val}</span>
            </div>
          `).join('')}
        </div>

        <div class="race-preview-extras">
          <div class="race-extra-row">
            <span class="dim">Daño base sin arma:</span>
            <span class="num">${baseDmg}</span>
          </div>
        </div>
      </div>
    `;
  }

  function raceCard(race) {
    const isSel = race.id === selectedRaceId;
    const stats = A.Seed.statsForRace(race.id);
    const theme = themeForRace(race.id);
    return `
      <button class="race-card race-card-v2 ${isSel ? 'is-selected' : ''}" data-race="${race.id}"
              style="--race-primary: ${theme.primary}; --race-accent: ${theme.accent};">
        <div class="race-icon">${race.icon}</div>
        <div class="race-name">${A.Utils.escapeHtml(race.name)}</div>
        <div class="race-tag">${theme.tag}</div>
        <div class="race-mini-stats num">
          <span title="Salud">❤ ${stats.maxHp}</span>
          <span title="Velocidad">⚡ ${stats.speed}</span>
          ${stats.maxMana > 0 ? `<span title="Maná">✦ ${stats.maxMana}</span>` : ''}
        </div>
      </button>
    `;
  }

  function renderSummary(race, stats) {
    // v1.5.8: el daño base sin arma es 1d3, más el bonus de raza si existe.
    // Esto es coherente con el resto del juego: el daño es siempre dados.
    const baseDmg = (stats.damage > 0)
      ? `1d3+${stats.damage}`
      : '1d3';
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
          <div class="big-stat" title="Daño base sin arma (puños). Con arma equipada se reemplaza por el daño del arma."><div class="big-stat-label dim">Daño base</div><div class="big-stat-val num">${baseDmg}</div></div>
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
        // v1.5.8: solo desactivar si no hay raza (nombre es opcional)
        const btn = rootEl.querySelector('#btn-create');
        if (btn) btn.disabled = !selectedRaceId;
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

  // v1.5.8: nombres de fantasía para asignación aleatoria si el campo está vacío
  const RANDOM_NAMES = [
    'Ardan', 'Kael', 'Elian', 'Lyra', 'Nara', 'Daren', 'Kira', 'Thalos',
    'Iriel', 'Bruma', 'Ronan', 'Eira', 'Fenris', 'Selene', 'Orion', 'Vesna',
    'Cael', 'Mirena', 'Theron', 'Astrid', 'Lucan', 'Yara', 'Drogan', 'Sira',
    'Brenn', 'Talia', 'Rorik', 'Zaira', 'Halden', 'Mira',
  ];

  function pickRandomName() {
    return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
  }

  function onCreate() {
    if (!selectedRaceId) return;
    // v1.5.8: si el nombre está vacío o solo espacios, asignar uno aleatorio
    const trimmed = inputName.trim();
    const finalName = trimmed || pickRandomName();
    A.State.createCharacter({ name: finalName, raceId: selectedRaceId });
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
