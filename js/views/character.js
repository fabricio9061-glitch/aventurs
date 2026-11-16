/* ============================================================
   Aventurs — View: Creación de personaje (v1.9.2)
   - 12 razas en 3 filas de 4: Híbridos, Guerreros y Magos
   - Cada raza muestra su pasiva (js/systems/passives.js)
   - A la derecha, la ficha de la raza elegida + nombre + botón
   - Sin emojis: retratos e íconos en pixel art
   ============================================================ */

(function (A) {
  'use strict';

  let rootEl = null;
  let selectedRaceId = 'humano';
  let inputName = '';

  // Color de cada raza (anillo del retrato y detalles)
  const RACE_COLORS = {
    humano: '#c9a24a', elfo: '#6fa04a', mediano: '#b07a3a', draconido: '#c0582a',
    enano: '#a8743a', orco: '#5f8f34', robot: '#5a86b0', goliat: '#7a8ea8',
    gnomo: '#4a6ab0', alienigena: '#7a58b0', infernal: '#b8382a', angel: '#e0c060',
  };

  const GROUPS = [
    { type: 'hybrid', name: 'Híbridos', desc: 'Arma y algo de magia: el maná no vuelve solo' },
    { type: 'warrior', name: 'Guerreros', desc: 'Sin magia, pero maestros con las armas' },
    { type: 'mage', name: 'Magos', desc: 'Magia en cada turno: el maná les vuelve solo' },
  ];

  const TYPE_LINE = { hybrid: 'Híbrido · arma y algo de magia', warrior: 'Guerrero · maestría con armas', mage: 'Mago · el maná le vuelve solo' };
  const TYPE_KIT = {
    hybrid: 'Usa cualquier arma sin problema. Su maná no vuelve solo: lo recupera con pociones o durmiendo, así que sus hechizos son para los momentos clave.',
    warrior: 'Maestría: +1 de daño con cualquier arma (+2 desde el nivel 5) y +1 de precisión con armas pesadas.',
    mage: 'Vive de la magia. Las armas pesadas le quitan 3 de precisión, y es el más frágil de todos.',
  };

  /** v2.1: el hechizo con el que nace la raza y cuánto maná recupera. */
  function magicBox(race) {
    const spell = race.startSpell ? A.Data.getById('spells', race.startSpell) : null;
    if (!spell) return '';
    const regen = race.manaRegen || null;
    const what = [
      spell.damage ? `${spell.damage} de daño${spell.area ? ' a todos' : ''}` : '',
      spell.selfHeal ? 'te cura un poco' : '',
      spell.statusEffect ? ({ fire: 'puede quemar', poison: 'envenena', blind: 'puede cegar', shock: 'puede aturdir', cold: 'enfría' })[spell.statusEffect.type] || '' : '',
      `${A.Passives && A.Passives.spellCost ? A.Passives.spellCost({ raceId: race.id, level: 1 }, spell) : spell.manaCost} de maná`,
    ].filter(Boolean).join(' · ');
    return `
      <div class="cc-passive cc-spell">
        <span class="cc-passive-icon">${A.ItemSprites ? A.ItemSprites.spellIcon(spell, { size: 32 }) : ''}</span>
        <span class="cc-passive-body">
          <span class="cc-passive-label">Hechizo de nacimiento</span>
          <span class="cc-passive-name">${esc(spell.name)}</span>
          <span class="cc-passive-text">${esc(what)}</span>
          <span class="cc-passive-text cc-regen">${regen
            ? `Recupera maná solo: +${regen.turn} por turno y ${Math.round(regen.win * 100)}% al ganar.`
            : 'No recupera maná solo: pociones o dormir.'}</span>
        </span>
      </div>`;
  }

  function esc(s) { return A.Utils.escapeHtml(String(s == null ? '' : s)); }
  function icon(name, size, cls) { return A.ItemSprites ? A.ItemSprites.icon(name, { size, cls }) : ''; }
  function colorOf(id) { return RACE_COLORS[id] || '#c9a24a'; }
  function portrait(race, size) {
    return A.Sprites && A.Sprites.heroHtml ? A.Sprites.heroHtml(race.id, { size, weapon: 'dagger' }) : '';
  }
  function passiveOf(race) {
    return A.Passives && race.passive ? A.Passives.info(race.passive, { level: 1, maxHp: A.Seed.statsForRace(race.id).maxHp }) : null;
  }

  // ============================================================
  // Render
  // ============================================================

  function render() {
    if (!rootEl) return;
    const races = A.Data.races;
    if (!races.find((r) => r.id === selectedRaceId)) selectedRaceId = races[0] ? races[0].id : null;
    const selected = races.find((r) => r.id === selectedRaceId) || null;

    const grouped = GROUPS.map((g) => ({ ...g, races: races.filter((r) => (r.combatType || 'hybrid') === g.type) }))
      .filter((g) => g.races.length);
    // Razas nuevas del editor con otro tipo: van al final
    const known = new Set(GROUPS.map((g) => g.type));
    const others = races.filter((r) => !known.has(r.combatType || 'hybrid'));
    if (others.length) grouped.push({ type: 'other', name: 'Otras', desc: '', races: others });

    rootEl.innerHTML = `
      <div class="cc-page">
        <header class="cc-topbar">
          <div class="cc-brand">${icon('swords', 28)}<span>Aventurs</span></div>
          <button class="cc-editor-btn" data-action="open-editor">Editor</button>
        </header>

        <main class="cc-main">
          <div class="cc-heading">
            <h1 class="cc-title">Nueva aventura</h1>
            <p class="cc-sub">Elegí tu raza. Todas tienen el mismo poder, repartido distinto, y una pasiva propia.</p>
          </div>

          <div class="cc-layout">
            <section class="cc-picker" aria-label="Razas">
              ${grouped.map((g) => `
                <div class="cc-group">
                  <div class="cc-group-head">
                    <span class="cc-group-name">${esc(g.name)}</span>
                    <span class="cc-group-desc">${esc(g.desc)}</span>
                  </div>
                  <div class="cc-grid">
                    ${g.races.map((r) => raceCard(r)).join('')}
                  </div>
                </div>
              `).join('')}
            </section>

            <aside class="cc-detail" ${selected ? `style="--race-color:${colorOf(selected.id)}"` : ''}>
              ${selected ? detailHtml(selected) : ''}
              <div class="cc-form">
                <label class="cc-label" for="char-name">Nombre</label>
                <input id="char-name" class="cc-input" type="text" maxlength="24" autocomplete="off"
                       value="${esc(inputName)}" placeholder="Si lo dejás vacío, te damos uno">
                <button class="cc-start" id="btn-create" ${!selected ? 'disabled' : ''}>
                  ${icon('swords', 24)}<span>${selected ? `Comenzar como ${esc(selected.name)}` : 'Elegí una raza'}</span>
                </button>
              </div>
            </aside>
          </div>
        </main>
      </div>
    `;
    bindEvents();
  }

  function raceCard(race) {
    const isSel = race.id === selectedRaceId;
    const pas = passiveOf(race);
    return `
      <button type="button" class="cc-race ${isSel ? 'is-selected' : ''}" data-race="${esc(race.id)}"
              style="--race-color:${colorOf(race.id)}" aria-pressed="${isSel ? 'true' : 'false'}" title="${esc(race.name)}${pas ? ` · ${esc(pas.name)}` : ''}">
        <span class="cc-race-portrait">${portrait(race, 64)}</span>
        <span class="cc-race-name">${esc(race.name)}</span>
        ${pas ? `<span class="cc-race-passive">${icon(pas.icon, 16, 'px-soft')}<span>${esc(pas.name)}</span></span>` : '<span class="cc-race-passive is-empty"></span>'}
      </button>
    `;
  }

  /** Rango de cada stat entre todas las razas, para que las barras comparen bien. */
  function ranges() {
    const out = {};
    for (const r of A.Data.races) {
      const st = A.Seed.statsForRace(r.id);
      if (!st) continue;
      for (const k of ['maxHp', 'maxMana', 'speed']) {
        const v = st[k];
        if (k === 'maxMana' && !v) continue;
        out[k] = out[k] || { min: v, max: v };
        out[k].min = Math.min(out[k].min, v);
        out[k].max = Math.max(out[k].max, v);
      }
    }
    return out;
  }

  function bar(label, value, range, color, emptyText) {
    if (!value) {
      return `<div class="cc-bar-row is-off"><span class="cc-bar-label">${label}</span><span class="cc-bar"><span style="width:0"></span></span><span class="cc-bar-val">${emptyText || '—'}</span></div>`;
    }
    const span = range && range.max > range.min ? (value - range.min) / (range.max - range.min) : 1;
    const w = Math.round(38 + 62 * span);
    return `<div class="cc-bar-row"><span class="cc-bar-label">${label}</span><span class="cc-bar"><span style="width:${w}%;background:${color}"></span></span><span class="cc-bar-val num">${value}</span></div>`;
  }

  function detailHtml(race) {
    const st = A.Seed.statsForRace(race.id);
    const magic = A.Seed.raceHasMagic ? A.Seed.raceHasMagic(race.id) : race.combatType !== 'warrior';
    const pas = passiveOf(race);
    const rg = ranges();
    const mastery = race.combatType === 'warrior' ? 1 : 0;
    const dmgBonus = st.damage + mastery;
    const dmg = dmgBonus > 0 ? `1d4+${dmgBonus}` : '1d4';
    const dmgRange = A.Balance && A.Balance.rangeOf ? A.Balance.rangeOf(dmg) : { min: 1, max: 4 };
    const tunic = A.Data.getById('armors', 'tunica_cuero');
    const startArmor = tunic ? (tunic.defense || 0) : 0;
    return `
      <div class="cc-hero">
        <div class="cc-hero-portrait">${portrait(race, 128)}</div>
        <div class="cc-hero-text">
          <h2 class="cc-hero-name">${esc(race.name)}</h2>
          <div class="cc-hero-type">${esc(TYPE_LINE[race.combatType] || TYPE_LINE.hybrid)}</div>
        </div>
      </div>
      <p class="cc-desc">${esc(race.description)}</p>

      ${pas ? `
        <div class="cc-passive">
          <span class="cc-passive-icon">${icon(pas.icon, 32)}</span>
          <span class="cc-passive-body">
            <span class="cc-passive-label">Pasiva</span>
            <span class="cc-passive-name">${esc(pas.name)}</span>
            <span class="cc-passive-text">${esc(pas.text)}</span>
          </span>
        </div>` : ''}

      <div class="cc-bars">
        ${bar('Vida', st.maxHp, rg.maxHp, '#c4513a')}
        ${bar('Maná', magic ? st.maxMana : 0, rg.maxMana, '#3a78c4', 'Sin magia')}
        ${bar('Velocidad', st.speed, rg.speed, '#7a9c3a')}
      </div>

      <div class="cc-stats">
        <div class="cc-stat"><span>Precisión</span><b>+${st.precision}</b><small>Se suma al dado para acertar</small></div>
        <div class="cc-stat"><span>Daño</span><b>${dmg}</b><small>Lo que sacás al acertar: ${dmgRange.min}&nbsp;a&nbsp;${dmgRange.max}</small></div>
        <div class="cc-stat"><span>Defensa</span><b>${8 + st.dodge}</b><small>Lo que el enemigo necesita para pegarte</small></div>
        <div class="cc-stat"><span>Armadura</span><b>${st.armor + startArmor}</b><small>Se resta de cada golpe que recibís</small></div>
      </div>
      <p class="cc-kit is-class">${esc(TYPE_KIT[race.combatType] || TYPE_KIT.hybrid)}</p>

      ${magic ? magicBox(race) : ''}
      <p class="cc-kit">Empieza con daga, túnica de cuero, dos pociones y algo de comida.</p>
    `;
  }

  // ============================================================
  // Eventos
  // ============================================================

  function bindEvents() {
    rootEl.querySelectorAll('[data-race]').forEach((card) => {
      card.addEventListener('click', () => {
        selectedRaceId = card.dataset.race;
        render();
        const again = rootEl.querySelector(`[data-race="${selectedRaceId}"]`);
        if (again) again.focus({ preventScroll: true });
      });
    });
    const input = rootEl.querySelector('#char-name');
    if (input) {
      input.addEventListener('input', (e) => { inputName = e.target.value; });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') onCreate(); });
    }
    const create = rootEl.querySelector('#btn-create');
    if (create) create.addEventListener('click', onCreate);
    const editorBtn = rootEl.querySelector('[data-action="open-editor"]');
    if (editorBtn) editorBtn.addEventListener('click', () => A.Views.Editor.mount(rootEl));
  }

  // Nombres de fantasía si el campo queda vacío
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
    const finalName = inputName.trim() || pickRandomName();
    A.State.createCharacter({ name: finalName, raceId: selectedRaceId });
    selectedRaceId = 'humano';
    inputName = '';
    A.Views.Shell.mount(rootEl);
  }

  const CharacterView = {
    mount(container) {
      rootEl = container;
      selectedRaceId = 'humano';
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
