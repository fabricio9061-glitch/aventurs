/* ============================================================
   Aventurs — Editor (Admin)
   Toma toda la pantalla. Permite editar todos los seeds + overrides.

   Tipos editables:
     regions, races, weapons, armors, items, enemies, npcs, spells, recipes, pets

   Por entidad:
     - Sidebar lista filtrable por nombre
     - Panel de edición con form dinámico según tipo
     - Botones: Guardar, Eliminar, Duplicar
     - Para enemies: panel de drops sugeridos por LootIntelligence

   Cambios se persisten en aventurs:content (overrides) y mergean con seed al
   recargar Data.

   Modelo simple: cuando guardas/eliminas/duplicas, se actualiza overrides[type]
   y se llama Data.init() para que las vistas recojan los cambios.
   ============================================================ */

(function (A) {
  'use strict';

  let host = null;
  let prevHostHtml = null;
  let activeType = 'regions';
  let activeId = null;
  let filterText = '';
  let dirty = false;
  let editingDraft = null;

  const TYPES = [
    { key: 'regions', label: 'Regiones', icon: '🗺️' },
    { key: 'races', label: 'Razas', icon: '👤' },
    { key: 'weapons', label: 'Armas', icon: '⚔️' },
    { key: 'armors', label: 'Armaduras', icon: '🛡️' },
    { key: 'items', label: 'Items', icon: '🎒' },
    { key: 'bags', label: 'Mochilas', icon: '🧳' },
    { key: 'enemies', label: 'Enemigos', icon: '👹' },
    { key: 'npcs', label: 'NPCs', icon: '🧑' },
    { key: 'spells', label: 'Hechizos', icon: '✨' },
    { key: 'recipes', label: 'Recetas', icon: '⚒️' },
  ];

  function mount(container) {
    host = container;
    prevHostHtml = host.innerHTML;
    host.innerHTML = '';
    activeType = 'regions';
    activeId = null;
    filterText = '';
    editingDraft = null;
    dirty = false;
    A.Bus.emit('editor:opened');
    render();
  }

  function unmount() {
    if (!host) return;
    A.Data.init();
    A.Bus.emit('editor:content-changed');
    host.innerHTML = prevHostHtml || '';
    host = null;
    prevHostHtml = null;
    A.Bus.emit('editor:closed');
  }

  function render() {
    if (!host) return;

    const list = currentList();
    const filtered = list.filter((e) => {
      if (!filterText) return true;
      const t = filterText.toLowerCase();
      return (e.name || '').toLowerCase().includes(t) || (e.id || '').toLowerCase().includes(t);
    });

    const validation = A.Validate.run();

    host.innerHTML = `
      <div class="editor-shell">
        <header class="editor-header">
          <div class="editor-brand">
            <span>🛠️</span>
            <span>Editor de contenido</span>
          </div>
          <div class="editor-status">
            ${dirty ? `<span class="dim">Cambios sin guardar</span>` : `<span class="dim">Todo guardado</span>`}
          </div>
          <div class="editor-actions">
            ${validation.length ? `
              <button class="btn-ghost" data-editor-action="show-validation">⚠ Avisos (${validation.length})</button>
            ` : ''}
            <button class="btn-primary" data-editor-action="back">Volver al juego</button>
          </div>
        </header>

        <div class="editor-body">
          <aside class="editor-types">
            ${TYPES.map((t) => `
              <button class="editor-type ${t.key === activeType ? 'is-active' : ''}" data-type="${t.key}">
                <span class="type-icon">${t.icon}</span>
                <span class="type-label">${t.label}</span>
                <span class="type-count num dim">${A.Data[t.key].length}</span>
              </button>
            `).join('')}
          </aside>

          <section class="editor-list">
            <div class="list-toolbar">
              <input class="list-search" type="text" placeholder="Buscar..."
                     value="${A.Utils.escapeHtml(filterText)}">
              <button class="btn-secondary" data-editor-action="new">+ Nuevo</button>
            </div>
            ${activeType === 'enemies' ? `
              <div class="list-toolbar-secondary">
                <button class="btn-mini btn-audit-all" data-editor-action="audit-all-enemies">🔍 Auditar todos los enemigos</button>
              </div>
            ` : ''}
            <div class="list-items">
              ${filtered.map((e) => `
                <button class="list-item ${e.id === activeId ? 'is-active' : ''} ${e._source === 'editor' ? 'is-edited' : ''}"
                        data-id="${A.Utils.escapeHtml(e.id)}">
                  <div class="list-item-name">${A.Utils.escapeHtml(e.name || '(sin nombre)')}</div>
                  <div class="list-item-meta dim">${A.Utils.escapeHtml(e.id)}${e._source === 'editor' ? ' · editado' : ''}</div>
                </button>
              `).join('') || '<div class="muted small">Vacío.</div>'}
            </div>
          </section>

          <section class="editor-detail">
            ${activeId ? renderEditor() : `<div class="empty-card detail-empty"><div class="empty-icon">←</div><div class="empty-title">Selecciona un elemento</div><div class="empty-text muted">O crea uno nuevo con "+".</div></div>`}
          </section>
        </div>
      </div>
    `;

    bindEvents();
  }

  function currentList() {
    return A.Data[activeType] || [];
  }

  function getById(id) {
    return currentList().find((e) => e.id === id);
  }

  function startDraft(entity) {
    editingDraft = JSON.parse(JSON.stringify(entity));
    dirty = false;
  }

  function selectEntity(id) {
    activeId = id;
    const entity = getById(id);
    if (entity) startDraft(entity);
    else editingDraft = null;
    render();
  }

  function newEntity() {
    const id = 'nuevo_' + Date.now().toString(36);
    const tpl = blankTemplate(activeType, id);
    activeId = id;
    editingDraft = tpl;
    dirty = true;
    saveDraft(true);
    render();
  }

  function saveDraft(silent = false) {
    if (!editingDraft) return;
    const overrides = A.Data.getOverrides();
    overrides[activeType] = overrides[activeType] || [];
    const idx = overrides[activeType].findIndex((e) => e.id === editingDraft.id);
    const clean = JSON.parse(JSON.stringify(editingDraft));
    delete clean._source;
    if (idx >= 0) overrides[activeType][idx] = clean;
    else overrides[activeType].push(clean);

    // Si el id estaba marcado como deleted, lo desmarcamos al re-crearlo
    if (overrides._deleted && overrides._deleted[activeType]) {
      overrides._deleted[activeType] = overrides._deleted[activeType].filter((x) => x !== clean.id);
    }

    A.Data.saveOverrides(overrides);
    A.Data.init();
    dirty = false;
    if (!silent) render();
  }

  function deleteEntity() {
    if (!activeId) return;
    const overrides = A.Data.getOverrides();
    overrides[activeType] = (overrides[activeType] || []).filter((e) => e.id !== activeId);
    overrides._deleted = overrides._deleted || {};
    overrides._deleted[activeType] = overrides._deleted[activeType] || [];
    if (!overrides._deleted[activeType].includes(activeId)) {
      overrides._deleted[activeType].push(activeId);
    }
    A.Data.saveOverrides(overrides);
    A.Data.init();
    activeId = null;
    editingDraft = null;
    dirty = false;
    render();
  }

  function duplicateEntity() {
    if (!editingDraft) return;
    const newId = editingDraft.id + '_copia_' + Date.now().toString(36).slice(-4);
    const dup = JSON.parse(JSON.stringify(editingDraft));
    dup.id = newId;
    dup.name = (dup.name || 'Copia') + ' (copia)';
    activeId = newId;
    editingDraft = dup;
    dirty = true;
    saveDraft();
  }

  function blankTemplate(type, id) {
    const base = { id, name: 'Nuevo' };
    switch (type) {
      case 'regions':
        return { ...base, type: 'safe', biome: 'plains', tier: [1, 2], connections: [], distance: 1, icon: '📍', description: '',
                 encounter: { minEnemies: 1, maxEnemies: 2, allowMixed: true, spawnWeights: { weak: 40, normal: 40, strong: 15, boss: 5 } } };
      case 'races':
        return { ...base, icon: '👤', combatType: 'hybrid', bonuses: { hp: 0, mana: 0, speed: 0, precision: 0, armor: 0, damage: 0, dodge: 0 }, description: '' };
      case 'weapons':
        return { ...base, type: 'weapon', icon: '⚔️', damage: '1d4', value: 10, rarity: 'common', tier: 1, weight: 1, magic: false, description: '' };
      case 'armors':
        return { ...base, type: 'armor', icon: '🛡️', defense: 1, value: 10, rarity: 'common', tier: 1, weight: 1, magic: false, description: '' };
      case 'items':
        return { ...base, type: 'item', subtype: 'misc', icon: '📦', value: 5, weight: 0, description: '' };
      case 'enemies':
        return { ...base, icon: '👹', family: ['humanoid'], category: 'normal', tier: 1, tags: [], biome: ['plains'],
                 health: 10, damage: 2, difficulty: 8, armor: 0, speed: 8, coinLoot: [0, 5], drops: [], regions: [],
                 spawn: { min: 1, max: 1, weight: 1.0, groupable: true },
                 tameable: false, tameItem: '', autoLoot: true };
      case 'npcs':
        return { ...base, role: 'merchant', region: 'pueblo_inicial', icon: '🧑', dialog: [''], sells: [], teaches: [], services: {} };
      case 'spells':
        return { ...base, icon: '✨', damage: '1d4', manaCost: 2, tier: 1, school: 'arcane', description: '' };
      case 'recipes':
        return { ...base, ingredients: [], result: '', workshop: 'forge', tier: 1, description: '' };
      case 'pets':
        return { ...base, icon: '🐾', species: 'beast', tier: 1, health: 10, damage: 2, speed: 8, armor: 0, tameDifficulty: 20, description: '' };
      case 'bags':
        return { ...base, icon: '🎒', slots: 10, value: 0, rarity: 'common', tier: 1, description: '' };
      default:
        return base;
    }
  }

  function renderEditor() {
    if (!editingDraft) return '';
    const e = editingDraft;
    let body = '';
    switch (activeType) {
      case 'regions': body = formRegions(e); break;
      case 'races': body = formRaces(e); break;
      case 'weapons': body = formWeapons(e); break;
      case 'armors': body = formArmors(e); break;
      case 'items': body = formItems(e); break;
      case 'enemies': body = formEnemies(e); break;
      case 'npcs': body = formNpcs(e); break;
      case 'spells': body = formSpells(e); break;
      case 'recipes': body = formRecipes(e); break;
      case 'pets': body = formPets(e); break;
      case 'bags': body = formBags(e); break;
    }
    return `
      <div class="detail-toolbar">
        <button class="btn-primary" data-editor-action="save" ${dirty ? '' : 'disabled'}>Guardar</button>
        <button class="btn-secondary" data-editor-action="duplicate">Duplicar</button>
        <button class="btn-danger" data-editor-action="delete">Eliminar</button>
      </div>
      <form class="editor-form">
        ${body}
      </form>
    `;
  }

  // ---------- Forms ----------

  function row(label, html) {
    return `<div class="form-row"><label>${A.Utils.escapeHtml(label)}</label>${html}</div>`;
  }

  function inp(field, value, type = 'text', extra = '') {
    return `<input class="form-input" data-field="${field}" type="${type}" value="${A.Utils.escapeHtml(value ?? '')}" ${extra}>`;
  }

  function txt(field, value, rows = 3) {
    return `<textarea class="form-input" data-field="${field}" rows="${rows}">${A.Utils.escapeHtml(value ?? '')}</textarea>`;
  }

  function sel(field, value, options) {
    return `<select class="form-input" data-field="${field}">
      ${options.map((o) => `<option value="${A.Utils.escapeHtml(o.value)}" ${o.value === value ? 'selected' : ''}>${A.Utils.escapeHtml(o.label)}</option>`).join('')}
    </select>`;
  }

  function chk(field, value) {
    return `<label class="form-check">
      <input data-field="${field}" type="checkbox" ${value ? 'checked' : ''}>
    </label>`;
  }

  function arr(field, value) {
    return `<input class="form-input" data-field="${field}" data-array="csv" type="text" value="${A.Utils.escapeHtml((value || []).join(', '))}" placeholder="separados por coma">`;
  }

  function tier2(field, value) {
    const v = Array.isArray(value) ? value : [1, 1];
    return `<div class="form-tier">
      <input class="form-input form-tier-input" data-field="${field}" data-array-index="0" type="number" min="1" max="10" value="${v[0]}">
      <span class="dim">a</span>
      <input class="form-input form-tier-input" data-field="${field}" data-array-index="1" type="number" min="1" max="10" value="${v[1]}">
    </div>`;
  }

  function formRegions(e) {
    return [
      row('ID', inp('id', e.id)),
      row('Nombre', inp('name', e.name)),
      row('Tipo', sel('type', e.type, [{value:'safe',label:'Zona segura'},{value:'combat',label:'Zona de combate'}])),
      row('Bioma', sel('biome', e.biome, [
        {value:'village',label:'Aldea'},{value:'forest',label:'Bosque'},{value:'graveyard',label:'Cementerio'},
        {value:'plains',label:'Llanura'},{value:'swamp',label:'Pantano'},{value:'coast',label:'Costa'},
        {value:'arcane',label:'Arcano'},{value:'mountain',label:'Montaña'},{value:'desert',label:'Desierto'},
        {value:'ruins',label:'Ruinas'},{value:'crypt',label:'Cripta'},{value:'cave',label:'Cueva'},
        {value:'sea',label:'Mar'},{value:'volcano',label:'Volcán'},{value:'hell',label:'Infierno'},
        {value:'lair',label:'Guarida'},{value:'abyss',label:'Abismo'},
      ])),
      row('Tier (rango)', tier2('tier', e.tier)),
      row('Conexiones (ids)', arr('connections', e.connections)),
      row('Distancia', inp('distance', e.distance, 'number')),
      row('Icono', inp('icon', e.icon)),
      row('Descripción', txt('description', e.description, 4)),
      row('Encuentros requeridos (desbloqueo)', inp('reqEncounters', e.reqEncounters || 0, 'number', 'min="0" max="50"')),
      `<div class="form-row form-row-block">
        <label>Configuración de encuentros (solo combat)</label>
        <div class="encounter-block">
          ${[
            row('Mín. enemigos', inp('encounter.minEnemies', (e.encounter||{}).minEnemies ?? 1, 'number', 'min="1" max="8"')),
            row('Máx. enemigos', inp('encounter.maxEnemies', (e.encounter||{}).maxEnemies ?? 2, 'number', 'min="1" max="8"')),
            row('Permite mezcla', chk('encounter.allowMixed', (e.encounter||{}).allowMixed !== false)),
            row('Peso weak (%)', inp('encounter.spawnWeights.weak', ((e.encounter||{}).spawnWeights||{}).weak ?? 40, 'number', 'min="0" max="100"')),
            row('Peso normal (%)', inp('encounter.spawnWeights.normal', ((e.encounter||{}).spawnWeights||{}).normal ?? 40, 'number', 'min="0" max="100"')),
            row('Peso strong (%)', inp('encounter.spawnWeights.strong', ((e.encounter||{}).spawnWeights||{}).strong ?? 15, 'number', 'min="0" max="100"')),
            row('Peso boss (%)', inp('encounter.spawnWeights.boss', ((e.encounter||{}).spawnWeights||{}).boss ?? 5, 'number', 'min="0" max="100"')),
          ].join('')}
        </div>
      </div>`,
    ].join('');
  }

  function formRaces(e) {
    e.bonuses = e.bonuses || { hp: 0, mana: 0, speed: 0, precision: 0, armor: 0, damage: 0, dodge: 0 };
    return [
      row('ID', inp('id', e.id)),
      row('Nombre', inp('name', e.name)),
      row('Icono', inp('icon', e.icon)),
      row('Tipo de combate', sel('combatType', e.combatType, [
        {value:'warrior',label:'Guerrero'},{value:'mage',label:'Mago'},{value:'hybrid',label:'Híbrido'},
      ])),
      row('Probabilidad magia (0-1, solo hybrid)', inp('magicChance', e.magicChance ?? 0.4, 'number', 'min="0" max="1" step="0.05"')),
      row('Bonus HP', inp('bonuses.hp', e.bonuses.hp, 'number')),
      row('Bonus Maná', inp('bonuses.mana', e.bonuses.mana, 'number')),
      row('Bonus Velocidad', inp('bonuses.speed', e.bonuses.speed, 'number')),
      row('Bonus Precisión', inp('bonuses.precision', e.bonuses.precision, 'number')),
      row('Bonus Armadura', inp('bonuses.armor', e.bonuses.armor, 'number')),
      row('Bonus Daño', inp('bonuses.damage', e.bonuses.damage, 'number')),
      row('Bonus Esquiva', inp('bonuses.dodge', e.bonuses.dodge, 'number')),
      row('Descripción', txt('description', e.description, 3)),
    ].join('');
  }

  function formWeapons(e) {
    return [
      row('ID', inp('id', e.id)),
      row('Nombre', inp('name', e.name)),
      row('Icono', inp('icon', e.icon)),
      row('Daño (notación)', inp('damage', e.damage)),
      row('Valor (cobre)', inp('value', e.value, 'number')),
      row('Rareza', sel('rarity', e.rarity, [
        {value:'common',label:'Común'},{value:'uncommon',label:'Poco común'},{value:'rare',label:'Raro'},
        {value:'epic',label:'Épico'},{value:'legendary',label:'Legendario'},
      ])),
      row('Tier', inp('tier', e.tier, 'number', 'min="1" max="10"')),
      row('Peso', inp('weight', e.weight, 'number')),
      row('Mágica', chk('magic', e.magic)),
      row('Descripción', txt('description', e.description, 3)),
    ].join('');
  }

  function formArmors(e) {
    return [
      row('ID', inp('id', e.id)),
      row('Nombre', inp('name', e.name)),
      row('Icono', inp('icon', e.icon)),
      row('Defensa', inp('defense', e.defense, 'number')),
      row('Valor (cobre)', inp('value', e.value, 'number')),
      row('Rareza', sel('rarity', e.rarity, [
        {value:'common',label:'Común'},{value:'uncommon',label:'Poco común'},{value:'rare',label:'Raro'},
        {value:'epic',label:'Épico'},{value:'legendary',label:'Legendario'},
      ])),
      row('Tier', inp('tier', e.tier, 'number', 'min="1" max="10"')),
      row('Peso', inp('weight', e.weight, 'number')),
      row('Mágica', chk('magic', e.magic)),
      row('Descripción', txt('description', e.description, 3)),
    ].join('');
  }

  function formItems(e) {
    return [
      row('ID', inp('id', e.id)),
      row('Nombre', inp('name', e.name)),
      row('Icono', inp('icon', e.icon)),
      row('Subtipo', sel('subtype', e.subtype, [
        {value:'coin',label:'Moneda'},{value:'potion',label:'Poción'},{value:'food',label:'Comida'},
        {value:'scroll',label:'Pergamino'},{value:'material',label:'Material'},{value:'misc',label:'Misc'},
      ])),
      row('Valor (cobre)', inp('value', e.value, 'number')),
      row('Peso', inp('weight', e.weight, 'number')),
      row('Stack máx (opcional)', inp('stack', e.stack || '', 'number')),
      row('Descripción', txt('description', e.description, 3)),
    ].join('');
  }

  function formEnemies(e) {
    const suggested = A.LootIntelligence.suggestDrops(e);
    const sug = A.AutoBalance.suggestEnemyStats(e);
    const audit = A.AutoBalance.auditEnemy(e);

    const dropsHtml = (e.drops || []).map((d, i) => `
      <div class="drop-row">
        <input class="form-input" data-drop-field="itemId" data-drop-index="${i}" type="text" value="${A.Utils.escapeHtml(d.itemId)}">
        <input class="form-input drop-chance" data-drop-field="chance" data-drop-index="${i}" type="number" min="0" max="1" step="0.05" value="${d.chance}">
        ${d.source === 'auto' ? `<span class="pill pill-auto">auto</span>` : ''}
        <button class="btn-mini" data-drop-action="remove" data-drop-index="${i}">×</button>
      </div>
    `).join('');

    const sugHtml = suggested.length ? suggested.map((s) => `
      <div class="drop-suggestion">
        <span>${A.Utils.escapeHtml(s.itemId)} <span class="dim">(${Math.round(s.chance*100)}% · ${s.reason})</span></span>
        <button class="btn-mini" data-drop-action="accept" data-drop-itemid="${A.Utils.escapeHtml(s.itemId)}" data-drop-chance="${s.chance}">+ Aceptar</button>
      </div>
    `).join('') : '<div class="muted small">Sin sugerencias para este enemigo.</div>';

    const fullAudit = A.AutoBalance.auditEnemyFull(e);
    const fullAuditHtml = `
      <div class="autobalance-full" id="autobalance-full" style="display:none">
        <div class="autobalance-full-header">
          <span class="dim small">Reporte completo: ${fullAudit.length} campos</span>
          <span class="autobalance-legend">
            <span class="ab-badge ab-ok">OK</span>
            <span class="ab-badge ab-warning">Desvío leve</span>
            <span class="ab-badge ab-critical">Desvío crítico</span>
          </span>
        </div>
        <div class="autobalance-full-list">
          ${fullAudit.map((a) => `
            <div class="autobalance-full-row ab-${a.status}">
              <span class="autobalance-full-field">${A.Utils.escapeHtml(a.label)}</span>
              <span class="autobalance-full-cur"><span class="dim">actual:</span> <strong>${A.Utils.escapeHtml(String(a.current ?? '—'))}</strong>${a.isDamageDice ? ` <span class="dim">(~${a.currentNum.toFixed(1)})</span>` : ''}</span>
              <span class="autobalance-full-sug"><span class="dim">sugerido:</span> <strong>${a.suggested}</strong></span>
              <span class="autobalance-full-delta">${a.delta}% desvío</span>
              ${a.status !== 'ok' ? `<button class="btn-mini" data-audit-apply="${a.field}" data-audit-value="${a.suggested}">Aplicar</button>` : '<span class="ab-check">✓</span>'}
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const auditHtml = audit.length ? `
      <div class="autobalance-audit">
        <div class="audit-title dim">AutoBalance sugiere (desvíos críticos):</div>
        ${audit.map((a) => `
          <div class="audit-row">
            <span>${a.field}: actual ${a.current} → sugerido ${a.suggested}</span>
            <button class="btn-mini" data-audit-apply="${a.field}" data-audit-value="${a.suggested}">Aplicar</button>
          </div>
        `).join('')}
      </div>
    ` : '<div class="muted small">Stats coherentes con tier+category+family.</div>';

    return [
      row('ID', inp('id', e.id)),
      row('Nombre', inp('name', e.name)),
      row('Icono', inp('icon', e.icon)),
      row('Tier', inp('tier', e.tier, 'number', 'min="1" max="10"')),
      row('Category', sel('category', e.category, [
        {value:'weak',label:'Débil'},{value:'normal',label:'Normal'},{value:'strong',label:'Fuerte'},{value:'boss',label:'Jefe'},
      ])),
      row('Family (csv)', arr('family', e.family)),
      row('Tags (csv)', arr('tags', e.tags)),
      row('Biome (csv)', arr('biome', e.biome)),
      row('Salud', inp('health', e.health, 'number')),
      row('Daño (dados o número)', inp('damage', e.damage, 'text', 'placeholder="1d6+1"')),
      row('Daño base sin arma', inp('baseDamage', e.baseDamage || '', 'text', 'placeholder="1d3 (humanoides sin arma)"')),
      row('Dificultad', inp('difficulty', e.difficulty, 'number')),
      row('Armadura', inp('armor', e.armor, 'number')),
      row('Velocidad', inp('speed', e.speed, 'number')),
      row('Esquiva', inp('dodge', e.dodge ?? Math.max(0, Math.floor((e.speed || 10) / 4)), 'number')),
      row('Loot mínimo (cobre)', inp('coinLoot.0', (e.coinLoot||[0,0])[0], 'number')),
      row('Loot máximo (cobre)', inp('coinLoot.1', (e.coinLoot||[0,0])[1], 'number')),
      row('Regiones (csv)', arr('regions', e.regions)),
      row('Spawn min (por encuentro)', inp('spawn.min', (e.spawn||{}).min ?? 1, 'number', 'min="1" max="8"')),
      row('Spawn max (por encuentro)', inp('spawn.max', (e.spawn||{}).max ?? 1, 'number', 'min="1" max="8"')),
      row('Spawn weight (peso relativo)', inp('spawn.weight', (e.spawn||{}).weight ?? 1.0, 'number', 'min="0" max="5" step="0.1"')),
      row('Agrupable (groupable)', chk('spawn.groupable', (e.spawn||{}).groupable !== false)),
      row('Domable', chk('tameable', e.tameable)),
      row('Item para domar (id)', inp('tameItem', e.tameItem || '', 'text')),
      row('AutoLoot habilitado', chk('autoLoot', e.autoLoot)),
      `<div class="form-row form-row-block">
        <label>Drops manuales</label>
        <div class="drops-block">
          ${dropsHtml || '<div class="muted small">Ninguno.</div>'}
          <button class="btn-mini" data-drop-action="add">+ Agregar drop</button>
        </div>
      </div>`,
      `<div class="form-row form-row-block">
        <label>Drops sugeridos (LootIntelligence)</label>
        <div class="drops-suggestions">${sugHtml}</div>
      </div>`,
      `<div class="form-row form-row-block">
        <label>AutoBalance</label>
        <div class="autobalance-block">
          <div class="dim small">Stats sugeridos: HP ${sug.health}, daño ${sug.damage}, dificultad ${sug.difficulty}, armadura ${sug.armor}, velocidad ${sug.speed}.</div>
          ${auditHtml}
          <div class="autobalance-actions">
            <button class="btn-mini" data-action="autobalance-toggle-full">📊 Generar reporte completo</button>
            <button class="btn-mini" data-action="autobalance-apply-all">Aplicar todos los sugeridos</button>
          </div>
          ${fullAuditHtml}
        </div>
      </div>`,
    ].join('');
  }

  function formNpcs(e) {
    const dialogText = (e.dialog || []).join('\n');
    return [
      row('ID', inp('id', e.id)),
      row('Nombre', inp('name', e.name)),
      row('Icono', inp('icon', e.icon)),
      row('Rol', sel('role', e.role, [
        {value:'merchant',label:'Mercader'},{value:'shopkeeper',label:'Comerciante'},{value:'vendor',label:'Vendedor'},
        {value:'blacksmith',label:'Herrero'},{value:'tavernkeeper',label:'Tabernero'},{value:'innkeeper',label:'Posadero'},
        {value:'healer',label:'Curandero'},{value:'priest',label:'Sacerdote'},{value:'sage',label:'Sabio'},
        {value:'wizard',label:'Mago'},{value:'mage',label:'Mago'},{value:'guard',label:'Guardia'},{value:'quest',label:'Encargo'},
      ])),
      row('Región', inp('region', e.region)),
      row('Diálogos (uno por línea)', `<textarea class="form-input" data-field="dialog" data-array="lines" rows="4">${A.Utils.escapeHtml(dialogText)}</textarea>`),
      row('Vende (csv ids)', arr('sells', e.sells)),
      row('Enseña hechizos (csv ids)', arr('teaches', e.teaches)),
      row('Costo descansar (cobre)', inp('services.restCost', (e.services||{}).restCost ?? '', 'number')),
    ].join('');
  }

  function formSpells(e) {
    return [
      row('ID', inp('id', e.id)),
      row('Nombre', inp('name', e.name)),
      row('Icono', inp('icon', e.icon)),
      row('Daño (opcional, notación)', inp('damage', e.damage || '')),
      row('Cura (opcional, notación)', inp('heal', e.heal || '')),
      row('Costo de maná', inp('manaCost', e.manaCost, 'number')),
      row('Tier', inp('tier', e.tier, 'number', 'min="1" max="10"')),
      row('Escuela', sel('school', e.school, [
        {value:'arcane',label:'Arcana'},{value:'fire',label:'Fuego'},{value:'ice',label:'Hielo'},
        {value:'holy',label:'Sagrada'},{value:'shadow',label:'Sombras'},{value:'nature',label:'Naturaleza'},
      ])),
      row('Área', chk('area', e.area)),
      row('Descripción', txt('description', e.description, 3)),
    ].join('');
  }

  function formRecipes(e) {
    const ingText = (e.ingredients || []).map((i) => `${i.itemId}:${i.qty}`).join(', ');
    return [
      row('ID', inp('id', e.id)),
      row('Nombre', inp('name', e.name)),
      row('Ingredientes (id:cantidad, csv)', `<input class="form-input" data-field="ingredients" data-array="ingredients" type="text" value="${A.Utils.escapeHtml(ingText)}" placeholder="mat_hierro:1, mat_madera:1">`),
      row('Resultado (id)', inp('result', e.result)),
      row('Taller', sel('workshop', e.workshop, [
        {value:'forge',label:'Herrería'},{value:'alchemy',label:'Alquimia'},{value:'enchant',label:'Encantamiento'},
      ])),
      row('Tier', inp('tier', e.tier, 'number', 'min="1" max="10"')),
      row('Descripción', txt('description', e.description, 3)),
    ].join('');
  }

  function formPets(e) {
    return [
      row('ID', inp('id', e.id)),
      row('Nombre', inp('name', e.name)),
      row('Icono', inp('icon', e.icon)),
      row('Especie', inp('species', e.species)),
      row('Tier', inp('tier', e.tier, 'number', 'min="1" max="10"')),
      row('Salud', inp('health', e.health, 'number')),
      row('Daño', inp('damage', e.damage, 'number')),
      row('Velocidad', inp('speed', e.speed, 'number')),
      row('Armadura', inp('armor', e.armor, 'number')),
      row('Dificultad de doma', inp('tameDifficulty', e.tameDifficulty, 'number')),
      row('Comida requerida (id)', inp('requiredFood', e.requiredFood)),
      row('Descripción', txt('description', e.description, 3)),
    ].join('');
  }

  function formBags(e) {
    return [
      row('ID', inp('id', e.id)),
      row('Nombre', inp('name', e.name)),
      row('Icono', inp('icon', e.icon)),
      row('Slots', inp('slots', e.slots, 'number', 'min="1" max="100"')),
      row('Valor (cobre)', inp('value', e.value, 'number')),
      row('Rareza', sel('rarity', e.rarity, [
        {value:'common',label:'Común'},{value:'uncommon',label:'Poco común'},{value:'rare',label:'Raro'},
        {value:'epic',label:'Épico'},{value:'legendary',label:'Legendario'},
      ])),
      row('Tier', inp('tier', e.tier, 'number', 'min="1" max="10"')),
      row('Descripción', txt('description', e.description, 3)),
    ].join('');
  }

  // ---------- Bindings ----------

  function bindEvents() {
    host.querySelectorAll('[data-type]').forEach((b) => {
      b.addEventListener('click', () => {
        if (dirty && !confirm('Tienes cambios sin guardar. ¿Cambiar de tipo y descartarlos?')) return;
        activeType = b.dataset.type;
        activeId = null;
        editingDraft = null;
        filterText = '';
        dirty = false;
        render();
      });
    });
    const search = host.querySelector('.list-search');
    if (search) {
      search.addEventListener('input', (ev) => {
        filterText = ev.target.value;
        // Re-render solo la lista no es trivial sin perder foco; hacemos un re-render parcial:
        const list = host.querySelector('.list-items');
        if (!list) return;
        const filtered = currentList().filter((e) => {
          if (!filterText) return true;
          const t = filterText.toLowerCase();
          return (e.name || '').toLowerCase().includes(t) || (e.id || '').toLowerCase().includes(t);
        });
        list.innerHTML = filtered.map((e) => `
          <button class="list-item ${e.id === activeId ? 'is-active' : ''} ${e._source === 'editor' ? 'is-edited' : ''}"
                  data-id="${A.Utils.escapeHtml(e.id)}">
            <div class="list-item-name">${A.Utils.escapeHtml(e.name || '(sin nombre)')}</div>
            <div class="list-item-meta dim">${A.Utils.escapeHtml(e.id)}${e._source === 'editor' ? ' · editado' : ''}</div>
          </button>
        `).join('') || '<div class="muted small">Vacío.</div>';
        list.querySelectorAll('[data-id]').forEach((b) => {
          b.addEventListener('click', () => selectEntity(b.dataset.id));
        });
      });
    }
    host.querySelectorAll('.list-item').forEach((b) => {
      b.addEventListener('click', () => selectEntity(b.dataset.id));
    });
    host.querySelectorAll('[data-editor-action]').forEach((b) => {
      b.addEventListener('click', () => {
        const a = b.dataset.editorAction;
        if (a === 'back') {
          if (dirty && !confirm('Tienes cambios sin guardar. ¿Salir igual?')) return;
          unmount();
          // Re-mount Shell o Character
          if (A.State.hasGame()) A.Views.Shell.mount(host);
          else A.Views.Character.mount(host);
        } else if (a === 'new') {
          newEntity();
        } else if (a === 'save') {
          saveDraft();
        } else if (a === 'delete') {
          if (confirm('¿Eliminar este elemento? Si era del seed original, queda oculto.')) deleteEntity();
        } else if (a === 'duplicate') {
          duplicateEntity();
        } else if (a === 'show-validation') {
          alert(A.Validate.run().map((v) => `[${v.level}] ${v.collection}/${v.entityId}: ${v.msg}`).join('\n') || 'Sin avisos.');
        } else if (a === 'audit-all-enemies') {
          openAuditWizard();
        }
      });
    });

    // Inputs de campos
    host.querySelectorAll('[data-field]').forEach((el) => {
      const handler = () => {
        const field = el.dataset.field;
        let val;
        if (el.type === 'checkbox') {
          val = el.checked;
        } else if (el.type === 'number') {
          val = el.value === '' ? '' : Number(el.value);
        } else {
          val = el.value;
        }

        // Arrays especiales
        if (el.dataset.array === 'csv') {
          val = String(val).split(',').map((s) => s.trim()).filter(Boolean);
        } else if (el.dataset.array === 'lines') {
          val = String(val).split('\n').map((s) => s.trim()).filter(Boolean);
        } else if (el.dataset.array === 'ingredients') {
          val = String(val).split(',').map((s) => s.trim()).filter(Boolean).map((pair) => {
            const [itemId, qty] = pair.split(':').map((x) => x.trim());
            return { itemId, qty: Number(qty || 1) };
          });
        }

        if (el.dataset.arrayIndex != null) {
          // tier2 inputs
          const idx = Number(el.dataset.arrayIndex);
          editingDraft[field] = editingDraft[field] || [0, 0];
          editingDraft[field][idx] = Number(val);
        } else if (field.includes('.')) {
          // path tipo "bonuses.hp" o "coinLoot.0" o "services.restCost"
          const parts = field.split('.');
          let target = editingDraft;
          for (let i = 0; i < parts.length - 1; i++) {
            const p = parts[i];
            if (target[p] == null) target[p] = isNaN(Number(parts[i+1])) ? {} : [];
            target = target[p];
          }
          target[parts[parts.length - 1]] = val;
        } else {
          editingDraft[field] = val;
        }
        dirty = true;
        // Habilitar botón guardar
        const saveBtn = host.querySelector('[data-editor-action="save"]');
        if (saveBtn) saveBtn.disabled = false;
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });

    // Drops actions
    host.querySelectorAll('[data-drop-action]').forEach((b) => {
      b.addEventListener('click', (ev) => {
        ev.preventDefault();
        const action = b.dataset.dropAction;
        editingDraft.drops = editingDraft.drops || [];
        if (action === 'add') {
          editingDraft.drops.push({ itemId: '', chance: 0.1 });
        } else if (action === 'remove') {
          const i = Number(b.dataset.dropIndex);
          editingDraft.drops.splice(i, 1);
        } else if (action === 'accept') {
          const itemId = b.dataset.dropItemid;
          const chance = Number(b.dataset.dropChance);
          editingDraft.drops.push({ itemId, chance, source: 'auto' });
        }
        dirty = true;
        render();
      });
    });

    // Drop field updates
    host.querySelectorAll('[data-drop-field]').forEach((el) => {
      const handler = () => {
        const field = el.dataset.dropField;
        const idx = Number(el.dataset.dropIndex);
        editingDraft.drops = editingDraft.drops || [];
        if (!editingDraft.drops[idx]) return;
        editingDraft.drops[idx][field] = field === 'chance' ? Number(el.value) : el.value;
        dirty = true;
      };
      el.addEventListener('input', handler);
    });

    // AutoBalance apply
    host.querySelectorAll('[data-audit-apply]').forEach((b) => {
      b.addEventListener('click', (ev) => {
        ev.preventDefault();
        editingDraft[b.dataset.auditApply] = Number(b.dataset.auditValue);
        dirty = true;
        render();
      });
    });
    const applyAll = host.querySelector('[data-action="autobalance-apply-all"]');
    if (applyAll) {
      applyAll.addEventListener('click', (ev) => {
        ev.preventDefault();
        const sug = A.AutoBalance.suggestEnemyStats(editingDraft);
        Object.assign(editingDraft, sug);
        dirty = true;
        render();
      });
    }
    // Toggle del panel "Reporte completo de autobalance"
    const toggleFull = host.querySelector('[data-action="autobalance-toggle-full"]');
    if (toggleFull) {
      toggleFull.addEventListener('click', (ev) => {
        ev.preventDefault();
        const panel = host.querySelector('#autobalance-full');
        if (!panel) return;
        const isOpen = panel.style.display !== 'none';
        panel.style.display = isOpen ? 'none' : 'block';
        toggleFull.textContent = isOpen ? '📊 Generar reporte completo' : '📊 Ocultar reporte';
      });
    }
  }

  // ============================================================
  // v1.5.7e — AUDIT WIZARD: recorre todos los enemigos con desbalance
  // ============================================================
  let auditWizardState = {
    open: false,
    items: [],     // [{enemy, audit: [...]}]
    cursor: 0,     // índice actual en items
    appliedCount: 0,
    skippedCount: 0,
  };

  function openAuditWizard() {
    // Generar lista de TODOS los enemigos con al menos un campo desbalanceado (warning o critical)
    const all = A.Data.enemies || [];
    const items = [];
    for (const enemy of all) {
      const audit = A.AutoBalance.auditEnemyFull(enemy);
      const issues = audit.filter((a) => a.status !== 'ok');
      if (issues.length > 0) {
        items.push({ enemy, audit, issues });
      }
    }
    auditWizardState = {
      open: true,
      items,
      cursor: 0,
      appliedCount: 0,
      skippedCount: 0,
    };
    renderAuditWizard();
  }

  function closeAuditWizard() {
    auditWizardState.open = false;
    const overlay = document.getElementById('audit-wizard-overlay');
    if (overlay) overlay.remove();
    // Re-render del editor por si cambiamos un enemigo activo
    render();
  }

  function renderAuditWizard() {
    let overlay = document.getElementById('audit-wizard-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'audit-wizard-overlay';
      overlay.className = 'audit-wizard-overlay';
      document.body.appendChild(overlay);
    }

    const { items, cursor, appliedCount, skippedCount } = auditWizardState;

    if (items.length === 0) {
      overlay.innerHTML = `
        <div class="audit-wizard-modal">
          <header class="audit-wizard-header">
            <h2>🔍 Auditoría de enemigos</h2>
            <button class="modal-close" data-audit-close>✕</button>
          </header>
          <div class="audit-wizard-body audit-empty">
            <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
            <h3>Todo bien balanceado</h3>
            <p class="muted">No hay enemigos con desvíos significativos respecto a la sugerencia de AutoBalance.</p>
          </div>
          <footer class="audit-wizard-footer">
            <button class="btn-primary" data-audit-close>Cerrar</button>
          </footer>
        </div>
      `;
      bindAuditWizardEvents(overlay);
      return;
    }

    if (cursor >= items.length) {
      // Final del wizard
      overlay.innerHTML = `
        <div class="audit-wizard-modal">
          <header class="audit-wizard-header">
            <h2>🔍 Auditoría completa</h2>
            <button class="modal-close" data-audit-close>✕</button>
          </header>
          <div class="audit-wizard-body audit-empty">
            <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
            <h3>Auditoría completada</h3>
            <p>Revisaste <strong>${items.length}</strong> enemigos con desvíos.</p>
            <p>Aplicaste cambios en <strong>${appliedCount}</strong> · Salteaste <strong>${skippedCount}</strong>.</p>
          </div>
          <footer class="audit-wizard-footer">
            <button class="btn-primary" data-audit-close>Cerrar</button>
          </footer>
        </div>
      `;
      bindAuditWizardEvents(overlay);
      return;
    }

    const current = items[cursor];
    const enemy = current.enemy;
    const audit = current.audit;

    overlay.innerHTML = `
      <div class="audit-wizard-modal">
        <header class="audit-wizard-header">
          <div>
            <h2>🔍 Auditoría de enemigos</h2>
            <div class="audit-wizard-progress">
              <span class="dim">Enemigo</span>
              <strong>${cursor + 1}</strong>
              <span class="dim">de</span>
              <strong>${items.length}</strong>
              <span class="dim">·</span>
              <span class="dim">${appliedCount} aplicados, ${skippedCount} salteados</span>
            </div>
          </div>
          <button class="modal-close" data-audit-close>✕</button>
        </header>

        <div class="audit-wizard-body">
          <aside class="audit-wizard-sidebar">
            <div class="audit-wizard-sidebar-title dim">Cola de revisión</div>
            <div class="audit-wizard-list">
              ${items.map((it, i) => {
                const numIssues = it.issues.length;
                const hasCritical = it.issues.some((iss) => iss.status === 'critical');
                const cls = `audit-wizard-list-item ${i === cursor ? 'is-active' : ''} ${i < cursor ? 'is-done' : ''} ${hasCritical ? 'has-critical' : ''}`;
                return `
                  <button class="${cls}" data-audit-jump="${i}">
                    <span class="audit-wizard-list-icon">${it.enemy.icon || '👹'}</span>
                    <span class="audit-wizard-list-name">${A.Utils.escapeHtml(it.enemy.name || it.enemy.id)}</span>
                    <span class="audit-wizard-list-badge ab-${hasCritical ? 'critical' : 'warning'}">${numIssues}</span>
                  </button>
                `;
              }).join('')}
            </div>
          </aside>

          <main class="audit-wizard-main">
            <div class="audit-wizard-enemy-header">
              <span class="audit-wizard-enemy-icon">${enemy.icon || '👹'}</span>
              <div>
                <h3 class="audit-wizard-enemy-name">${A.Utils.escapeHtml(enemy.name || enemy.id)}</h3>
                <div class="audit-wizard-enemy-meta dim">
                  Tier ${enemy.tier} ·
                  ${enemy.category} ·
                  ${(enemy.family || []).join(', ')}
                </div>
              </div>
            </div>

            <div class="audit-wizard-stats">
              ${audit.map((a) => `
                <div class="audit-wizard-stat-row ab-${a.status}">
                  <div class="audit-wizard-stat-field">
                    <span class="ab-badge ab-${a.status}">${a.status === 'ok' ? 'OK' : a.status === 'warning' ? 'LEVE' : 'CRÍTICO'}</span>
                    <strong>${A.Utils.escapeHtml(a.label)}</strong>
                  </div>
                  <div class="audit-wizard-stat-values">
                    <span class="audit-wizard-stat-current"><span class="dim">actual</span> <strong>${A.Utils.escapeHtml(String(a.current ?? '—'))}</strong>${a.isDamageDice ? ` <span class="dim">(~${a.currentNum.toFixed(1)})</span>` : ''}</span>
                    <span class="audit-wizard-stat-arrow dim">→</span>
                    <span class="audit-wizard-stat-suggested"><span class="dim">sugerido</span> <strong>${a.suggested}</strong></span>
                    <span class="audit-wizard-stat-delta dim">(${a.delta}% desvío)</span>
                  </div>
                </div>
              `).join('')}
            </div>

            <div class="audit-wizard-actions-info dim">
              💡 "Aplicar todos" usará la sugerencia de AutoBalance para los campos desbalanceados.
              "Saltar" deja el enemigo sin cambios y pasa al siguiente.
            </div>
          </main>
        </div>

        <footer class="audit-wizard-footer">
          <button class="btn-secondary" data-audit-action="prev" ${cursor === 0 ? 'disabled' : ''}>← Anterior</button>
          <button class="btn-secondary" data-audit-action="skip">Saltar</button>
          <button class="btn-primary" data-audit-action="apply">✓ Aplicar todos los sugeridos</button>
          <button class="btn-ghost" data-audit-close>Cerrar</button>
        </footer>
      </div>
    `;

    bindAuditWizardEvents(overlay);
  }

  function bindAuditWizardEvents(overlay) {
    overlay.querySelectorAll('[data-audit-close]').forEach((b) => {
      b.addEventListener('click', closeAuditWizard);
    });
    overlay.querySelectorAll('[data-audit-action]').forEach((b) => {
      b.addEventListener('click', () => {
        const a = b.dataset.auditAction;
        if (a === 'skip') {
          auditWizardState.skippedCount++;
          auditWizardState.cursor++;
          renderAuditWizard();
        } else if (a === 'prev') {
          if (auditWizardState.cursor > 0) {
            auditWizardState.cursor--;
            renderAuditWizard();
          }
        } else if (a === 'apply') {
          applyCurrentAudit();
        }
      });
    });
    overlay.querySelectorAll('[data-audit-jump]').forEach((b) => {
      b.addEventListener('click', () => {
        const idx = Number(b.dataset.auditJump);
        if (idx >= 0 && idx < auditWizardState.items.length) {
          auditWizardState.cursor = idx;
          renderAuditWizard();
        }
      });
    });
    // Click fuera del modal cierra
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAuditWizard();
    });
  }

  function applyCurrentAudit() {
    const current = auditWizardState.items[auditWizardState.cursor];
    if (!current) return;
    const enemy = current.enemy;
    const sug = A.AutoBalance.suggestEnemyStats(enemy);
    // Tomamos los campos desbalanceados (warning/critical) y los aplicamos
    const overrides = A.Data.getOverrides();
    overrides.enemies = overrides.enemies || [];
    // Hacer una copia limpia del enemigo actual y aplicarle los cambios
    const idx = overrides.enemies.findIndex((e) => e.id === enemy.id);
    let target = idx >= 0 ? overrides.enemies[idx] : JSON.parse(JSON.stringify(enemy));
    delete target._source;
    for (const a of current.audit) {
      if (a.status === 'ok') continue;
      const newVal = sug[a.field];
      if (newVal == null) continue;
      target[a.field] = newVal;
    }
    if (idx >= 0) overrides.enemies[idx] = target;
    else overrides.enemies.push(target);
    A.Data.saveOverrides(overrides);
    A.Data.init();
    auditWizardState.appliedCount++;
    auditWizardState.cursor++;
    dirty = true;
    renderAuditWizard();
  }

  const Editor = { mount, unmount };

  A.Views = A.Views || {};
  A.Views.Editor = Editor;
})(window.Aventurs);
