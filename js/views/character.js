/* ============================================================
   Aventurs — View: Creación de personaje (v3.0)
   - 15 razas en 3 filas de 5: Híbridos, Guerreros y Magos
   - Botón "Al azar": los dados eligen una raza (se puede volver a tirar)
   - Cada raza muestra su pasiva (js/systems/passives.js)
   - A la derecha, la ficha de la raza elegida + nombre + botón
   - Todo entra en la pantalla sin scroll (desde 1280x640)
   - Sin emojis: retratos e íconos en pixel art
   ============================================================ */

(function (A) {
  'use strict';

  let rootEl = null;
  let selectedRaceId = 'humano';
  let inputName = '';
  let rolledId = null;     // la última raza que salió con los dados
  let rolling = null;      // timer de la tirada en curso

  // Color de cada raza (anillo del retrato y detalles)
  const RACE_COLORS = {
    humano: '#c9a24a', elfo: '#6fa04a', mediano: '#b07a3a', draconido: '#c0582a',
    enano: '#a8743a', orco: '#5f8f34', robot: '#5a86b0', goliat: '#7a8ea8',
    gnomo: '#4a6ab0', alienigena: '#7a58b0', infernal: '#b8382a', angel: '#e0c060',
    // v3.0
    vampiro: '#9a2a3a', minotauro: '#8a5a2a', hada: '#c070c0',
    // v3.3
    licantropo: '#7a6a5a', elfo_oscuro: '#6a4a9a', driade: '#5a9a4a',
  };

  const GROUPS = [
    { type: 'hybrid', name: 'Híbridos', desc: 'Arma y algo de magia: el maná vuelve al pegar' },
    { type: 'warrior', name: 'Guerreros', desc: 'Sin magia, pero maestros con las armas' },
    { type: 'mage', name: 'Magos', desc: 'Magia en cada turno: el maná les vuelve solo' },
  ];

  const TYPE_LINE = { hybrid: 'Híbrido · arma y magia: pegar le da maná', warrior: 'Guerrero · golpe fuerte y maestría con armas', mage: 'Mago · el maná le vuelve solo' };
  // v3.1: las cuentas salen de la configuración del juego (si cambian, el texto acompaña)
  const T = () => (A.Balance && A.Balance.TUNE) || {};
  const TYPE_KIT = {
    get hybrid() {
      const t = T(); const on = t.hybridManaOnHit || 1; const every = t.hybridManaEvery || 0;
      return `Usa las armas comunes (las de mago no). Cada golpe con arma que acierta le devuelve ${on} de maná${every > 0 ? ` (${on + 1} desde el nivel ${every + 1})` : ''}; fuera de eso, el maná no le vuelve solo. Magia corta: su hechizo de raza, Chispa, Llama, Rayo helado, Segundo aliento (se cura a sí mismo) y 6 pergaminos de combate.`;
    },
    get warrior() {
      return `Golpe fuerte: doble daño, una vez cada 5 turnos. Maestría: +1 de daño con las armas comunes (+2 desde el nivel 5) y +1 de precisión con las pesadas; las de mago no las usa. Gana ${(T().hpPerLevel || {}).warrior || 7} de vida por nivel, más que nadie.`;
    },
    // v3.3: solo armas mágicas, y Curación es solo para ellos · v3.4: sin su arma de mago no lanza; aprende todo
    mage: 'Vive de la magia: aprende todos los hechizos (Curación, los de área y los de todos los pergaminos). Solo usa armas de mago (bastones, varitas, cetros, orbes y tomos), que le suman poder mágico; sin una puesta no puede lanzar hechizos. Es el más frágil de todos.',
  };
  /** El texto de la clase para esta raza (al mago se le suma lo que le cuesta Curación, con su descuento si tiene). */
  function kitText(type, race) {
    const base = TYPE_KIT[type] || TYPE_KIT.hybrid;
    if (type !== 'mage') return base;
    const cura = A.Data.getById('spells', 'curacion');
    if (!cura) return base;
    const cost = A.Passives && A.Passives.spellCost ? A.Passives.spellCost({ raceId: race.id, level: 1 }, cura) : cura.manaCost;
    return `${base} Curación le cuesta ${cost} de maná y se usa cada ${cura.cooldown || 1} turnos.`;
  }

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
          ${race.combatType === 'hybrid' && !regen ? '' /* v3.1: lo cuenta el texto de la clase, abajo */ : `<span class="cc-passive-text cc-regen">${regen
            ? `Recupera maná solo: +${A.Balance.regenLabel(regen.turn)} por turno${regen.turn % 1 ? ' en promedio' : ''}${T().mageRegenEvery > 0 ? ` (+1 más desde el nivel ${T().mageRegenEvery + 1})` : ''} y ${Math.round(regen.win * 100)}% al ganar.`
            : 'No recupera maná solo: pociones o dormir.'}</span>`}
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
    const cols = Math.max(4, Math.min(6, Math.max(...grouped.map((g) => g.races.length))));

    rootEl.innerHTML = `
      <div class="cc-page cc3">
        <header class="cc-topbar">
          <div class="cc-brand">${icon('swords', 28)}<span>Aventurs</span></div>
          <div class="cc-top-actions">
            ${accountChip()}
            ${!A.Accounts || A.Accounts.canEdit() ? '<button class="cc-editor-btn" data-action="open-editor">Editor</button>' : ''}
          </div>
        </header>

        <main class="cc-main">
          <div class="cc-layout">
            <section class="cc-picker" aria-label="Razas" style="--cc-cols:${cols}">
              <div class="cc-heading">
                <div class="cc-heading-text">
                  <h1 class="cc-title">Nueva aventura</h1>
                  <p class="cc-sub">Elegí tu raza. Todas tienen el mismo poder, repartido distinto, y una pasiva propia.</p>
                </div>
                <button type="button" class="cc-random" data-action="random" title="Que los dados elijan tu raza">
                  ${icon('dice', 26)}<span>Al azar</span>
                </button>
              </div>
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
                <div class="cc-form-row">
                  <input id="char-name" class="cc-input" type="text" maxlength="24" autocomplete="off"
                         value="${esc(inputName)}" placeholder="Si lo dejás vacío, te damos uno">
                  <button class="cc-start" id="btn-create" ${!selected ? 'disabled' : ''}>
                    ${icon('swords', 24)}<span>${selected ? `Comenzar como ${esc(selected.name)}` : 'Elegí una raza'}</span>
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    `;
    bindEvents();
  }

  /** v3.0: con qué cuenta entraste (y para salir). */
  function accountChip() {
    const acc = A.Accounts && A.Accounts.info ? A.Accounts.info() : null;
    if (!acc) return '';
    return `<span class="cc-account">${icon('user', 20)}<span>${esc(acc.name)}</span><button class="cc-logout" data-action="logout" title="Cerrar sesión">${icon('logout', 18)}<span>Salir</span></button></span>`;
  }

  function raceCard(race) {
    const isSel = race.id === selectedRaceId;
    const pas = passiveOf(race);
    return `
      <button type="button" class="cc-race ${isSel ? 'is-selected' : ''}" data-race="${esc(race.id)}"
              style="--race-color:${colorOf(race.id)}" aria-pressed="${isSel ? 'true' : 'false'}" title="${esc(race.name)}${pas ? ` · ${esc(pas.name)}` : ''}">
        <span class="cc-race-portrait">${portrait(race, 56)}</span>
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

  /** Con qué arranca y qué come (v3.1: la comida depende de la raza). HTML. */
  function startKitHtml(race) {
    const diet = A.Survival && A.Survival.dietOf ? A.Survival.dietOf(race.id) : null;
    const food = diet && diet.startText ? diet.startText : 'algo de comida';
    const eats = diet ? `<span class="cc-diet" title="${esc(A.Survival.describeDiet(race.id))}">Come: ${esc(diet.label.toLowerCase())}${diet.only ? ' (nada más)' : ''}.</span> ` : '';
    // v3.3: cada raza con su arma · v3.5: también cada raza de mago, con su arma de mago
    const w = A.Data.getById('weapons', race.startWeapon) || A.Data.getById('weapons', race.combatType === 'mage' ? 'varita' : 'daga');
    const wName = w ? w.name.toLowerCase() : 'daga';
    return `${eats}Empieza con ${esc(wName)}, túnica de cuero, dos pociones y ${esc(food)}.`;
  }

  /** v3.1: lo que suma al explorar un personaje nuevo de esta raza (Fuerza, Agilidad...). */
  function exploreBox(race, st, magic) {
    if (!A.Explore || !A.Explore.sheet || !st) return '';
    const fake = {
      raceId: race.id, level: 1, hasMagic: magic, effects: [],
      stats: { speed: st.speed, precision: st.precision, armor: st.armor, damage: st.damage, dodge: st.dodge },
      equipment: { weapon: race.startWeapon || 'daga', armor: 'tunica_cuero', accessory: null },
    };
    let list = [];
    try { list = A.Explore.sheet(fake, { noHunger: true }); } catch (e) { return ''; }
    const sign = (v) => (v > 0 ? `+${v}` : `${v}`);
    return `
          <div class="cc-xstats">
            <div class="cc-xstats-title">Al explorar (se suma al dado) · ${list.reduce((t, x) => t + x.value, 0)} puntos, como todas las razas</div>
            ${list.map((x) => `<div class="cc-xstat" title="${esc(`${x.label}: ${x.hint} Se suma al dado de 20 cuando una escena pide ${x.label}.`)}">${icon(x.icon, 16)}<b class="num">${sign(x.value)}</b><span>${esc(x.label)}</span></div>`).join('')}
          </div>`;
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
    const type = race.combatType || 'hybrid';
    const classBox = `
      <div class="cc-passive cc-class">
        <span class="cc-passive-icon">${icon(type === 'warrior' ? 'fist' : type === 'mage' ? 'spell' : 'swords', 32)}</span>
        <span class="cc-passive-body">
          <span class="cc-passive-label">${type === 'warrior' ? 'Guerrero' : type === 'mage' ? 'Mago' : 'Híbrido'}</span>
          <span class="cc-passive-text">${esc(kitText(type, race))}</span>
        </span>
      </div>`;
    return `
      <div class="cc-hero">
        <div class="cc-hero-portrait">${portrait(race, 104)}</div>
        <div class="cc-hero-text">
          <h2 class="cc-hero-name">${esc(race.name)}${rolledId === race.id ? `<span class="cc-rolled">${icon('dice', 16)}<span>Al azar</span></span>` : ''}</h2>
          <div class="cc-hero-type">${esc(TYPE_LINE[type] || TYPE_LINE.hybrid)}</div>
          <p class="cc-desc">${esc(race.description)}</p>
        </div>
      </div>

      <div class="cc-cols">
        <div class="cc-col">
          ${pas ? `
            <div class="cc-passive">
              <span class="cc-passive-icon">${icon(pas.icon, 32)}</span>
              <span class="cc-passive-body">
                <span class="cc-passive-label">Pasiva</span>
                <span class="cc-passive-name">${esc(pas.name)}</span>
                <span class="cc-passive-text">${esc(pas.text)}</span>
              </span>
            </div>` : ''}
          ${magic ? magicBox(race) : classBox}
          ${magic ? `<p class="cc-kit is-class">${esc(kitText(type, race))}</p>` : ''}
        </div>
        <div class="cc-col">
          <div class="cc-bars">
            ${bar('Vida', st.maxHp, rg.maxHp, '#c4513a')}
            ${bar('Maná', magic ? st.maxMana : 0, rg.maxMana, '#3a78c4', 'Sin magia')}
            ${bar('Velocidad', st.speed, rg.speed, '#7a9c3a')}
          </div>
          <div class="cc-stats">
            <div class="cc-stat" title="Se suma al dado para acertar"><span>Precisión</span><b>+${st.precision + (A.Passives && A.Passives.precisionBonus ? A.Passives.precisionBonus({ raceId: race.id, level: 1 }) : 0)}</b><small>Se suma al dado para acertar</small></div>
            <div class="cc-stat" title="Lo que sacás al acertar"><span>Daño</span><b>${dmg}</b><small>Al acertar: ${dmgRange.min}&nbsp;a&nbsp;${dmgRange.max}</small></div>
            <div class="cc-stat" title="Lo que el enemigo necesita sacar para pegarte"><span>Defensa</span><b>${8 + st.dodge}</b><small>Lo que necesitan para pegarte</small></div>
            <div class="cc-stat" title="Se resta de cada golpe que recibís"><span>Armadura</span><b>${st.armor + startArmor}</b><small>Se resta de cada golpe</small></div>
          </div>
          ${exploreBox(race, st, magic)}
          <p class="cc-kit cc-startkit">${startKitHtml(race)}</p>
        </div>
      </div>
    `;
  }

  // ============================================================
  // Eventos
  // ============================================================

  function bindEvents() {
    rootEl.querySelectorAll('[data-race]').forEach((card) => {
      card.addEventListener('click', () => {
        stopRoll();
        selectedRaceId = card.dataset.race;
        rolledId = null;
        render();
        const again = rootEl.querySelector(`[data-race="${selectedRaceId}"]`);
        if (again) again.focus({ preventScroll: true });
      });
    });
    const rnd = rootEl.querySelector('[data-action="random"]');
    if (rnd) rnd.addEventListener('click', rollRandom);
    const input = rootEl.querySelector('#char-name');
    if (input) {
      input.addEventListener('input', (e) => { inputName = e.target.value; });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') onCreate(); });
    }
    const create = rootEl.querySelector('#btn-create');
    if (create) create.addEventListener('click', onCreate);
    const editorBtn = rootEl.querySelector('[data-action="open-editor"]');
    if (editorBtn) editorBtn.addEventListener('click', () => { if (!A.Accounts || A.Accounts.canEdit()) A.Views.Editor.mount(rootEl); });
    const out = rootEl.querySelector('[data-action="logout"]');
    if (out) out.addEventListener('click', () => { if (A.Accounts) A.Accounts.logout(); });
  }

  // ============================================================
  // Al azar: los dados pasan por varias razas y se quedan en una
  // ============================================================

  function stopRoll() {
    if (rolling) clearTimeout(rolling);
    rolling = null;
    if (rootEl) rootEl.querySelectorAll('.cc-race.is-rolling').forEach((c) => c.classList.remove('is-rolling'));
  }

  function rollRandom() {
    const ids = A.Data.races.map((r) => r.id);
    if (!ids.length || !rootEl) return;
    stopRoll();
    const pool = ids.length > 1 ? ids.filter((id) => id !== selectedRaceId) : ids;
    const finalId = pool[Math.floor(Math.random() * pool.length)];
    const land = () => {
      stopRoll();
      selectedRaceId = finalId;
      rolledId = finalId;
      render();
      const card = rootEl && rootEl.querySelector(`[data-race="${finalId}"]`);
      if (card) {
        card.classList.add('is-landed');
        card.focus({ preventScroll: true });
        if (card.scrollIntoView && window.innerWidth <= 920) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    };
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { land(); return; }
    const btn = rootEl.querySelector('[data-action="random"]');
    if (btn) btn.classList.add('is-rolling');
    let step = 0;
    const steps = 11;
    let last = selectedRaceId;
    const tick = () => {
      if (!rootEl) return;
      rootEl.querySelectorAll('.cc-race.is-rolling').forEach((c) => c.classList.remove('is-rolling'));
      if (step >= steps) { land(); return; }
      const opts = ids.filter((id) => id !== last);
      last = step === steps - 1 ? finalId : opts[Math.floor(Math.random() * opts.length)];
      const card = rootEl.querySelector(`[data-race="${last}"]`);
      if (card) card.classList.add('is-rolling');
      step++;
      rolling = setTimeout(tick, 45 + step * step * 2.4);
    };
    tick();
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
    if (!selectedRaceId || rolling) return;
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
      rolledId = null;
      render();
    },
    unmount() {
      stopRoll();
      if (rootEl) rootEl.innerHTML = '';
    },
  };

  A.Views = A.Views || {};
  A.Views.Character = CharacterView;
})(window.Aventurs);
