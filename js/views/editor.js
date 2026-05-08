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
    host._editorActionDelegated = false;
    host.innerHTML = prevHostHtml || '';
    host = null;
    prevHostHtml = null;
    A.Bus.emit('editor:closed');
  }

  /**
   * Exporta los overrides actuales como descarga JSON.
   * Permite al usuario hacer backup antes de actualizar versión.
   */
  function exportOverrides() {
    const overrides = A.Data.getOverrides();
    const blob = new Blob([JSON.stringify(overrides, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `aventurs-content-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Importa overrides desde un archivo JSON. Reemplaza los actuales tras confirmar.
   */
  function importOverrides() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (typeof data !== 'object' || data === null) {
            throw new Error('Archivo no es un objeto JSON válido');
          }
          // Validar al menos una colección esperada
          const valid = ['regions', 'races', 'weapons', 'armors', 'items', 'enemies', 'spells', 'recipes', 'npcs', 'pets', 'bags', '_deleted'];
          const found = Object.keys(data).filter((k) => valid.includes(k));
          if (found.length === 0) {
            throw new Error('Archivo no parece un export válido del editor');
          }
          if (!confirm(`Importar overrides desde el archivo?\n\nEsto REEMPLAZA todos tus cambios actuales del editor.\n\nColecciones a importar: ${found.join(', ')}`)) return;
          A.Data.saveOverrides(data);
          A.Data.init();
          A.Bus.emit('editor:content-changed');
          render();
          alert('Importado correctamente.');
        } catch (err) {
          alert('Error al importar: ' + err.message);
        }
      };
      reader.readAsText(file);
    });
    input.click();
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
            <button class="btn-ghost" data-editor-action="export-overrides" title="Descarga un archivo .json con todos tus cambios del editor">📥 Exportar</button>
            <button class="btn-ghost" data-editor-action="import-overrides" title="Carga un archivo .json con cambios del editor">📤 Importar</button>
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
    // v1.6.0: warning si hay cambios sin guardar
    if (dirty && editingDraft && editingDraft.id !== id) {
      if (!confirm('Tienes cambios sin guardar en el elemento actual. ¿Cambiar de elemento y descartar?')) return;
    }
    activeId = id;
    const entity = getById(id);
    if (entity) startDraft(entity);
    else editingDraft = null;
    dirty = false;
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

  /**
   * v1.6.0: Descartar cambios sin guardar.
   * Recarga el draft desde el dato persistido (overrides o seed).
   */
  function discardChanges() {
    if (!editingDraft || !dirty) return;
    if (!confirm('¿Descartar todos los cambios sin guardar?')) return;
    const id = editingDraft.id;
    const original = getById(id);
    if (original) {
      startDraft(original);
    } else {
      editingDraft = null;
      activeId = null;
    }
    dirty = false;
    render();
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
                 health: 10, damage: 2, difficulty: 8, armor: 0, speed: 8, drops: [], regions: [],
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
        <button class="btn-secondary" data-editor-action="discard" ${dirty ? '' : 'disabled'} title="Descartar cambios sin guardar">↶ Descartar cambios</button>
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

  /**
   * Tag-input field: muestra un placeholder div que se monta con A.TagInput
   * después del render. Persiste el valor en el draft via data-field.
   *
   * field: nombre del campo en el draft (ej: 'regions', 'sells', 'teaches')
   * value: array de ids actuales
   * collection: 'items'|'enemies'|'regions'|'spells' (qué buscar)
   * placeholder: texto del input
   * filter: función opcional para filtrar opciones
   */
  function tagsField(field, value, collection, placeholder = 'Buscar...', filter = null) {
    const filterKey = filter ? `:${filter}` : '';
    const safeId = field.replace(/[^a-zA-Z0-9_]/g, '_');
    return `<div
      class="tag-input-placeholder"
      data-tag-input-mount="${safeId}"
      data-tag-field="${field}"
      data-tag-collection="${collection}"
      data-tag-placeholder="${A.Utils.escapeHtml(placeholder)}"
      data-tag-value='${A.Utils.escapeHtml(JSON.stringify(value || []))}'
      ${filter ? `data-tag-filter="${filter}"` : ''}
    ></div>`;
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
    // Enemigos asignados a esta región
    const tier = Array.isArray(e.tier) ? e.tier : [e.tier || 1, e.tier || 1];
    const tierMin = tier[0], tierMax = tier[1];
    const allEnemies = A.Data.enemies || [];
    const assignedEnemies = allEnemies.filter((en) => (en.regions || []).includes(e.id));
    const tierMatches = assignedEnemies.filter((en) => en.tier >= tierMin && en.tier <= tierMax);
    const tierMisfits = assignedEnemies.filter((en) => en.tier < tierMin || en.tier > tierMax);
    const candidates = allEnemies.filter((en) =>
      en.tier >= tierMin && en.tier <= tierMax && !(en.regions || []).includes(e.id)
    );

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
      `<div class="form-row form-row-block">
        <label>Conexiones</label>
        <div class="connections-editor-block">
          <input class="form-input" data-field="connections" data-array="csv" type="text" value="${A.Utils.escapeHtml((e.connections || []).join(', '))}" placeholder="separadas por coma">
          <button type="button" class="btn-mini btn-graph-editor" onclick="window.Aventurs.openGraphEditor && window.Aventurs.openGraphEditor()">🗺️ Abrir editor visual de conexiones</button>
        </div>
      </div>`,
      row('Distancia', inp('distance', e.distance, 'number')),
      row('Icono', inp('icon', e.icon)),
      row('Descripción', txt('description', e.description, 4)),
      row('Encuentros requeridos (desbloqueo)', inp('reqEncounters', e.reqEncounters || 0, 'number', 'min="0" max="50"')),
      // v1.6.4: Bloque de requisitos de desbloqueo (data-driven)
      `<div class="form-row form-row-block">
        <label>🔒 Condiciones de desbloqueo</label>
        <div class="unlock-conditions-block">
          <div class="form-row-mini">
            <span class="dim small">Nivel mínimo del jugador</span>
            <input class="form-input" data-field="unlockConditions.minLevel" type="number" min="0" max="100" value="${(e.unlockConditions && e.unlockConditions.minLevel) || 0}">
          </div>
          <div class="form-row-mini">
            <span class="dim small">Items requeridos (IDs separados por coma)</span>
            <input class="form-input" data-field="unlockConditions.requiredItems" data-array="csv" type="text" value="${A.Utils.escapeHtml(((e.unlockConditions && e.unlockConditions.requiredItems) || []).join(', '))}" placeholder="ej: amuleto_fuego, brujula">
          </div>
          <div class="form-row-mini">
            <span class="dim small">Regiones que deben haberse visitado (IDs separados por coma)</span>
            <input class="form-input" data-field="unlockConditions.requiredRegions" data-array="csv" type="text" value="${A.Utils.escapeHtml(((e.unlockConditions && e.unlockConditions.requiredRegions) || []).join(', '))}" placeholder="ej: cuevas_ancestrales">
          </div>
          <div class="form-row-mini">
            <span class="dim small">Mensaje custom mostrado al jugador (opcional)</span>
            <input class="form-input" data-field="unlockConditions.warningText" type="text" value="${A.Utils.escapeHtml((e.unlockConditions && e.unlockConditions.warningText) || '')}" placeholder="ej: 'Tu personaje no soportaría el calor extremo.'">
          </div>
        </div>
      </div>`,
      `<div class="form-row form-row-block">
        <label>Enemigos en esta región (${assignedEnemies.length})</label>
        <div class="region-enemies-block">
          <div class="region-enemies-actions">
            <button type="button" class="btn-mini btn-region-autobalance" onclick="window.Aventurs.openRegionEnemyEditor && window.Aventurs.openRegionEnemyEditor('${A.Utils.escapeHtml(e.id)}')">🎲 Auto-asignar enemigos por tier</button>
            ${tierMisfits.length > 0 ? `<button type="button" class="btn-mini btn-mini-danger" onclick="window.Aventurs.removeRegionMisfits && window.Aventurs.removeRegionMisfits('${A.Utils.escapeHtml(e.id)}')" title="Quita los enemigos cuyo tier está fuera del rango de la región">⚠ Quitar ${tierMisfits.length} fuera de tier</button>` : ''}
            <span class="dim small">Tier ${tierMin}-${tierMax} · ${tierMatches.length} ok · ${tierMisfits.length} fuera</span>
          </div>
          ${assignedEnemies.length === 0 ? '<div class="muted small" style="padding:12px">Sin enemigos asignados. Click en "Auto-asignar" para llenar.</div>' : (() => {
            // Agrupar por tier
            const byTier = {};
            for (const en of assignedEnemies) {
              const t = en.tier || 1;
              if (!byTier[t]) byTier[t] = [];
              byTier[t].push(en);
            }
            const tiers = Object.keys(byTier).map(Number).sort((a, b) => a - b);
            return tiers.map((t) => {
              const list = byTier[t];
              const tierOk = t >= tierMin && t <= tierMax;
              return `
                <div class="region-enemies-tier-group">
                  <div class="region-enemies-tier-header ${tierOk ? '' : 'is-mismatch'}">
                    <span>Tier ${t} (${list.length})${tierOk ? '' : ' · ⚠ fuera de tier'}</span>
                  </div>
                  <div class="region-enemies-tier-content">
                    ${list.map((en) => `
                      <span class="region-enemy-tag ${tierOk ? '' : 'is-mismatch'}" title="${en.category || ''}">
                        <span>${en.icon || '👹'}</span>
                        <span>${A.Utils.escapeHtml(en.name)}</span>
                        <span class="cat-pill cat-${en.category || 'normal'}">${en.category || 'norm'}</span>
                      </span>
                    `).join('')}
                  </div>
                </div>
              `;
            }).join('');
          })()}
          ${candidates.length > 0 ? `<div class="dim small">💡 Hay ${candidates.length} enemigos candidatos del tier ${tierMin}-${tierMax} no asignados todavía.</div>` : ''}
        </div>
      </div>`,
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

  // ============================================================
  // v1.5.7k — REGION ENEMY EDITOR: asignar enemigos a una región
  // ============================================================
  function openRegionEnemyEditor(regionId) {
    const region = A.Data.getById('regions', regionId);
    if (!region) {
      alert('Región no encontrada: ' + regionId);
      return;
    }
    const tier = Array.isArray(region.tier) ? region.tier : [region.tier || 1, region.tier || 1];
    const tierMin = tier[0], tierMax = tier[1];

    let overlay = document.getElementById('region-enemy-editor-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'region-enemy-editor-overlay';
    overlay.className = 'audit-wizard-overlay';
    document.body.appendChild(overlay);

    function renderModal() {
      // v1.5.7p-fix: leer enemies fresh cada vez para reflejar overrides recientes
      const allEnemies = A.Data.enemies || [];
      const assigned = allEnemies.filter((en) => (en.regions || []).includes(regionId));
      const tierOk = assigned.filter((en) => en.tier >= tierMin && en.tier <= tierMax);
      const tierBad = assigned.filter((en) => en.tier < tierMin || en.tier > tierMax);
      const candidates = allEnemies.filter((en) =>
        en.tier >= tierMin && en.tier <= tierMax && !(en.regions || []).includes(regionId)
      ).sort((a, b) => a.tier - b.tier || (a.name || '').localeCompare(b.name || ''));

      overlay.innerHTML = `
        <div class="audit-wizard-modal" style="max-width:1000px">
          <header class="audit-wizard-header">
            <div>
              <h2>🎲 Enemigos en ${A.Utils.escapeHtml(region.name)}</h2>
              <div class="audit-wizard-progress">
                <span class="dim">Tier de la región:</span>
                <strong>${tierMin}–${tierMax}</strong>
                <span class="dim">·</span>
                <span class="dim">${assigned.length} asignados</span>
                <span class="dim">·</span>
                <span class="dim">${candidates.length} candidatos en tier</span>
              </div>
            </div>
            <button class="modal-close" data-region-enemy-close type="button">✕</button>
          </header>

          <div class="audit-wizard-body" style="grid-template-columns: 1fr 1fr">
            <main class="audit-wizard-main">
              <div class="region-enemy-section-title">✓ Asignados a esta región (${assigned.length})</div>
              ${assigned.length === 0 ? '<div class="muted small">Ninguno aún. Agregá desde la columna de candidatos →</div>' : `
                <div class="region-enemy-list">
                  ${assigned.map((en) => `
                    <div class="region-enemy-row ${en.tier >= tierMin && en.tier <= tierMax ? 'is-ok' : 'is-mismatch'}">
                      <span class="region-enemy-icon">${en.icon || '👹'}</span>
                      <span class="region-enemy-name">${A.Utils.escapeHtml(en.name)}</span>
                      <span class="region-enemy-tier">T${en.tier}</span>
                      <span class="region-enemy-cat dim">${en.category || ''}</span>
                      <button class="btn-mini btn-mini-danger" type="button" data-region-action="remove" data-enemy-id="${A.Utils.escapeHtml(en.id)}">Quitar</button>
                    </div>
                  `).join('')}
                </div>
              `}

              ${tierBad.length > 0 ? `
                <div class="region-enemy-warning">
                  ⚠ ${tierBad.length} fuera de tier (recomendado quitar)
                </div>
              ` : ''}

              <div class="audit-wizard-actions-info dim" style="margin-top:16px">
                💡 "Auto-asignar por tier" agrega 5–8 enemigos candidatos del tier de la región (mezclando categorías weak/normal/strong).
              </div>

              <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
                <button class="btn-secondary" type="button" data-region-action="auto-assign">🎲 Auto-asignar por tier</button>
                <button class="btn-secondary" type="button" data-region-action="clear">Vaciar todo</button>
              </div>
            </main>

            <aside class="audit-wizard-main" style="border-left:1px solid var(--border)">
              <div class="region-enemy-section-title">+ Candidatos en tier ${tierMin}–${tierMax} (${candidates.length})</div>
              <input class="form-input region-enemy-search" type="text" placeholder="Buscar enemigo..." id="region-enemy-search">
              ${candidates.length === 0 ? '<div class="muted small">No hay candidatos en este tier que no estén ya asignados.</div>' : `
                <div class="region-enemy-list" id="region-enemy-candidates">
                  ${candidates.map((en) => `
                    <div class="region-enemy-row" data-enemy-name="${A.Utils.escapeHtml((en.name||'').toLowerCase())}">
                      <span class="region-enemy-icon">${en.icon || '👹'}</span>
                      <span class="region-enemy-name">${A.Utils.escapeHtml(en.name)}</span>
                      <span class="region-enemy-tier">T${en.tier}</span>
                      <span class="region-enemy-cat dim">${en.category || ''}</span>
                      <button class="btn-mini" type="button" data-region-action="add" data-enemy-id="${A.Utils.escapeHtml(en.id)}">+ Agregar</button>
                    </div>
                  `).join('')}
                </div>
              `}
            </aside>
          </div>

          <footer class="audit-wizard-footer">
            <button class="btn-primary" type="button" data-region-enemy-close>Cerrar</button>
          </footer>
        </div>
      `;
      bindModalEvents();
    }

    function bindModalEvents() {
      overlay.querySelectorAll('[data-region-enemy-close]').forEach((b) => {
        b.addEventListener('click', () => overlay.remove());
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
      });
      overlay.querySelectorAll('[data-region-action]').forEach((b) => {
        b.addEventListener('click', () => {
          const action = b.dataset.regionAction;
          if (action === 'add') {
            assignEnemyToRegion(b.dataset.enemyId, regionId);
          } else if (action === 'remove') {
            unassignEnemyFromRegion(b.dataset.enemyId, regionId);
          } else if (action === 'auto-assign') {
            autoAssignByTier(regionId, tierMin, tierMax);
          } else if (action === 'clear') {
            if (confirm('¿Quitar TODOS los enemigos de esta región?')) {
              clearRegionEnemies(regionId);
            }
          }
          renderModal();
        });
      });
      // Búsqueda en candidatos
      const search = overlay.querySelector('#region-enemy-search');
      if (search) {
        search.addEventListener('input', () => {
          const q = search.value.toLowerCase();
          overlay.querySelectorAll('#region-enemy-candidates [data-enemy-name]').forEach((row) => {
            const matches = !q || row.dataset.enemyName.includes(q);
            row.style.display = matches ? '' : 'none';
          });
        });
      }
    }

    renderModal();
  }

  function assignEnemyToRegion(enemyId, regionId) {
    const overrides = A.Data.getOverrides();
    overrides.enemies = overrides.enemies || [];
    let target = overrides.enemies.find((e) => e.id === enemyId);
    if (!target) {
      const seed = A.Data.getById('enemies', enemyId);
      if (!seed) return;
      target = JSON.parse(JSON.stringify(seed));
      delete target._source;
      overrides.enemies.push(target);
    }
    target.regions = target.regions || [];
    if (!target.regions.includes(regionId)) target.regions.push(regionId);
    A.Data.saveOverrides(overrides);
    A.Data.init();
    dirty = true;
    if (editingDraft && editingDraft.id === regionId) render();
  }

  function unassignEnemyFromRegion(enemyId, regionId) {
    const overrides = A.Data.getOverrides();
    overrides.enemies = overrides.enemies || [];
    let target = overrides.enemies.find((e) => e.id === enemyId);
    if (!target) {
      const seed = A.Data.getById('enemies', enemyId);
      if (!seed) return;
      target = JSON.parse(JSON.stringify(seed));
      delete target._source;
      overrides.enemies.push(target);
    }
    target.regions = (target.regions || []).filter((r) => r !== regionId);
    A.Data.saveOverrides(overrides);
    A.Data.init();
    dirty = true;
    if (editingDraft && editingDraft.id === regionId) render();
  }

  function autoAssignByTier(regionId, tierMin, tierMax) {
    const allEnemies = A.Data.enemies || [];
    const candidates = allEnemies.filter((en) =>
      en.tier >= tierMin && en.tier <= tierMax && !(en.regions || []).includes(regionId)
    );
    // Mezcla balanceada: 50% weak, 30% normal, 15% strong, 5% boss
    const byCategory = { weak: [], normal: [], strong: [], boss: [] };
    for (const c of candidates) {
      const cat = c.category || 'normal';
      if (byCategory[cat]) byCategory[cat].push(c);
    }
    // Shuffle simple
    const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
    Object.values(byCategory).forEach(shuffle);

    // Seleccionar: hasta 4 weak, 2 normal, 1 strong, 1 boss
    const target = [
      ...byCategory.weak.slice(0, 4),
      ...byCategory.normal.slice(0, 2),
      ...byCategory.strong.slice(0, 1),
      ...byCategory.boss.slice(0, 1),
    ];

    if (target.length === 0) {
      alert('No hay enemigos candidatos sin asignar en el tier de esta región.');
      return;
    }
    for (const e of target) {
      assignEnemyToRegion(e.id, regionId);
    }
    alert(`Auto-asignados ${target.length} enemigos a la región.`);
  }

  function clearRegionEnemies(regionId) {
    const overrides = A.Data.getOverrides();
    overrides.enemies = overrides.enemies || [];
    const allEnemies = A.Data.enemies || [];
    for (const en of allEnemies) {
      if ((en.regions || []).includes(regionId)) {
        let target = overrides.enemies.find((e) => e.id === en.id);
        if (!target) {
          target = JSON.parse(JSON.stringify(en));
          delete target._source;
          overrides.enemies.push(target);
        }
        target.regions = (target.regions || []).filter((r) => r !== regionId);
      }
    }
    A.Data.saveOverrides(overrides);
    A.Data.init();
    dirty = true;
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
    e.statusEffect = e.statusEffect || null;
    const eff = e.statusEffect || { type: '', chance: 0, turns: 0, value: 0 };
    const hasEffect = !!e.statusEffect;
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
      row('Slots (1 normal, 2 voluminoso)', inp('slots', e.slots ?? 1, 'number', 'min="1" max="3"')),
      row('Mágica', chk('magic', e.magic)),
      `<div class="form-row form-row-block">
        <label>Efecto al impactar</label>
        <div class="weapon-effect-block">
          <label class="weapon-effect-toggle">
            <input type="checkbox" data-weapon-effect-toggle ${hasEffect ? 'checked' : ''}>
            <span>${hasEffect ? 'Activo' : 'Sin efecto especial'}</span>
          </label>
          <div class="weapon-effect-fields ${hasEffect ? '' : 'is-disabled'}">
            ${row('Tipo', sel('statusEffect.type', eff.type, [
              {value:'bleed', label:'🩸 Sangrado (HP)'},
              {value:'fire', label:'🔥 Fuego (HP, refresh)'},
              {value:'cold', label:'❄️ Frío (slow, refresh)'},
              {value:'shock', label:'⚡ Aturdir (skip turn, refresh)'},
              {value:'poison', label:'☠️ Veneno (HP, acumula)'},
            ]))}
            ${row('Probabilidad (0–1)', inp('statusEffect.chance', eff.chance, 'number', 'min="0" max="1" step="0.05"'))}
            ${row('Turnos', inp('statusEffect.turns', eff.turns, 'number', 'min="1" max="10"'))}
            ${row('Valor (daño/turno o intensidad)', inp('statusEffect.value', eff.value, 'number', 'min="0" max="20"'))}
          </div>
          <div class="dim small">
            💡 Sangrado/Veneno: daño por turno = "valor". Fuego/Frío/Aturdir: efecto refresh (no acumula).
            Probabilidad 0.20 = 20% por golpe.
          </div>
        </div>
      </div>`,
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

    // v1.5.7p: Datalist combinado de items + weapons + armors
    // Permite que enemigos dropeen armas y armaduras además de items.
    const itemDatalistId = 'editor-drops-datalist';
    const allDroppables = [
      ...((A.Data.items || []).map((it) => ({ ...it, _kind: 'item' }))),
      ...((A.Data.weapons || []).map((w) => ({ ...w, _kind: 'weapon' }))),
      ...((A.Data.armors || []).map((a) => ({ ...a, _kind: 'armor' }))),
    ];
    const itemDatalistHtml = `<datalist id="${itemDatalistId}">${
      allDroppables.map((it) => {
        const kindLabel = it._kind === 'weapon' ? '⚔️ arma' : it._kind === 'armor' ? '🛡️ armadura' : 'item';
        return `<option value="${A.Utils.escapeHtml(it.id)}">${A.Utils.escapeHtml(it.name || it.id)} — ${kindLabel} (${A.Utils.escapeHtml(it.id)})</option>`;
      }).join('')
    }</datalist>`;

    const dropsHtml = itemDatalistHtml + (e.drops || []).map((d, i) => {
      const item = A.Inventory.resolveData(d.itemId);
      const itemIcon = item ? (item.icon || '📦') : '⚠️';
      const itemName = item ? item.name : '(no existe)';
      const chancePct = Math.round((d.chance || 0) * 100);
      const isAuto = d.source === 'auto';
      const qtyMin = d.qtyMin || 1;
      const qtyMax = d.qtyMax || 1;
      const kindBadge = item ?
        (item.type === 'weapon' ? '<span class="drop-kind-badge drop-kind-weapon" title="Arma">⚔️</span>'
        : item.type === 'armor' ? '<span class="drop-kind-badge drop-kind-armor" title="Armadura">🛡️</span>'
        : '') : '';
      return `
        <div class="drop-row-v2">
          <span class="drop-row-icon">${itemIcon}</span>
          <div class="drop-row-info">
            <div class="drop-row-name">${A.Utils.escapeHtml(itemName)} ${kindBadge}</div>
            <input class="form-input drop-row-id" data-drop-field="itemId" data-drop-index="${i}" type="text" value="${A.Utils.escapeHtml(d.itemId)}" list="${itemDatalistId}" placeholder="Buscar item, arma o armadura...">
          </div>
          <div class="drop-row-qty" title="Cantidad mínima – máxima al dropear">
            <input class="form-input drop-qty-input" data-drop-field="qtyMin" data-drop-index="${i}" type="number" min="1" max="99" step="1" value="${qtyMin}" title="Cantidad mínima">
            <span class="drop-qty-sep">–</span>
            <input class="form-input drop-qty-input" data-drop-field="qtyMax" data-drop-index="${i}" type="number" min="1" max="99" step="1" value="${qtyMax}" title="Cantidad máxima">
          </div>
          <div class="drop-row-chance">
            <input class="form-input drop-chance-pct" data-drop-field="chance" data-drop-index="${i}" type="number" min="0" max="100" step="1" value="${chancePct}">
            <span class="drop-chance-suffix">%</span>
          </div>
          <span class="drop-row-source ${isAuto ? 'is-auto' : 'is-manual'}" title="${isAuto ? 'Aceptado desde sugerencia' : 'Agregado manualmente'}">
            ${isAuto ? 'AUTO' : 'MANUAL'}
          </span>
          <button class="drop-row-remove" data-drop-action="remove" data-drop-index="${i}" type="button" title="Quitar este drop">×</button>
        </div>
      `;
    }).join('');

    const sugHtml = suggested.length ? suggested.map((s) => {
      const item = A.Inventory.resolveData(s.itemId);
      const icon = item ? (item.icon || '📦') : '📦';
      const name = item ? item.name : s.itemId;
      const kindBadge = item ?
        (item.type === 'weapon' ? '<span class="drop-kind-badge drop-kind-weapon" title="Arma">⚔️</span>'
        : item.type === 'armor' ? '<span class="drop-kind-badge drop-kind-armor" title="Armadura">🛡️</span>'
        : '') : '';
      return `
        <div class="drop-suggestion-v2">
          <span class="drop-sug-icon">${icon}</span>
          <div class="drop-sug-info">
            <div class="drop-sug-name">${A.Utils.escapeHtml(name)} ${kindBadge}</div>
            <div class="drop-sug-meta dim">${Math.round(s.chance*100)}% · ${A.Utils.escapeHtml(s.reason)}</div>
          </div>
          <button class="btn-mini" data-drop-action="accept" data-drop-itemid="${A.Utils.escapeHtml(s.itemId)}" data-drop-chance="${s.chance}" type="button">+ Aceptar</button>
          <button class="btn-mini btn-mini-danger" data-drop-action="reject" data-drop-itemid="${A.Utils.escapeHtml(s.itemId)}" type="button">✕ Rechazar</button>
        </div>
      `;
    }).join('') : '<div class="muted small">Sin sugerencias para este enemigo.</div>';

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
      row('Regiones', tagsField('regions', e.regions, 'regions', 'Buscar región...')),
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
          ${dropsHtml || '<div class="muted small" style="padding:12px">Ninguno todavía. Agregá uno con el botón de abajo o aceptá una sugerencia.</div>'}
          <button class="drop-add-btn" data-drop-action="add" type="button">+ Agregar drop manual</button>
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
      row('Vende', tagsField('sells', e.sells, 'items', 'Buscar item...')),
      row('Enseña hechizos', tagsField('teaches', e.teaches, 'spells', 'Buscar hechizo...')),
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

    // === EVENT DELEGATION para todos los data-editor-action ===
    // Más robusto que listeners individuales: un solo listener en host
    // captura clicks de cualquier botón, presente o futuro, dentro del editor.
    if (!host._editorActionDelegated) {
      host._editorActionDelegated = true;
      host.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-editor-action]');
        if (!btn || !host.contains(btn)) return;
        const a = btn.dataset.editorAction;
        console.log('[Editor] click action:', a);
        try {
          if (a === 'back') {
            if (dirty && !confirm('Tienes cambios sin guardar. ¿Salir igual?')) return;
            unmount();
            if (A.State.hasGame()) A.Views.Shell.mount(host);
            else A.Views.Character.mount(host);
          } else if (a === 'new') {
            newEntity();
          } else if (a === 'save') {
            saveDraft();
          } else if (a === 'discard') {
            discardChanges();
          } else if (a === 'delete') {
            if (confirm('¿Eliminar este elemento? Si era del seed original, queda oculto.')) deleteEntity();
          } else if (a === 'duplicate') {
            duplicateEntity();
          } else if (a === 'show-validation') {
            alert(A.Validate.run().map((v) => `[${v.level}] ${v.collection}/${v.entityId}: ${v.msg}`).join('\n') || 'Sin avisos.');
          } else if (a === 'audit-all-enemies') {
            openAuditWizard();
          } else if (a === 'open-graph-editor') {
            console.log('[Editor] llamando openGraphEditor()...');
            openGraphEditor();
          } else if (a === 'export-overrides') {
            exportOverrides();
          } else if (a === 'import-overrides') {
            importOverrides();
          }
        } catch (err) {
          console.error('[Editor] Error en handler:', a, err);
          alert(`Error en acción "${a}": ${err.message}\n\nVer consola.`);
        }
      });
    }

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
        editingDraft.dropsBlacklist = editingDraft.dropsBlacklist || [];
        if (action === 'add') {
          editingDraft.drops.push({ itemId: '', chance: 0.1 });
        } else if (action === 'remove') {
          const i = Number(b.dataset.dropIndex);
          editingDraft.drops.splice(i, 1);
        } else if (action === 'accept') {
          const itemId = b.dataset.dropItemid;
          const chance = Number(b.dataset.dropChance);
          // Quitar de blacklist si estaba
          editingDraft.dropsBlacklist = editingDraft.dropsBlacklist.filter((id) => id !== itemId);
          if (!editingDraft.drops.some((d) => d.itemId === itemId)) {
            editingDraft.drops.push({ itemId, chance, source: 'auto' });
          }
        } else if (action === 'reject') {
          const itemId = b.dataset.dropItemid;
          if (!editingDraft.dropsBlacklist.includes(itemId)) {
            editingDraft.dropsBlacklist.push(itemId);
          }
          // Si estaba en drops, quitarlo
          editingDraft.drops = editingDraft.drops.filter((d) => d.itemId !== itemId);
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

        // v1.6.4: clonar el drop antes de mutar para asegurar reactividad
        const newDrop = { ...editingDraft.drops[idx] };

        if (field === 'chance') {
          const pct = Number(el.value);
          newDrop.chance = Math.max(0, Math.min(1, pct / 100));
        } else if (field === 'qtyMin' || field === 'qtyMax') {
          newDrop[field] = Math.max(1, Math.min(99, parseInt(el.value, 10) || 1));
          // Asegurar qtyMax >= qtyMin
          if (newDrop.qtyMin && newDrop.qtyMax && newDrop.qtyMin > newDrop.qtyMax) {
            if (field === 'qtyMin') newDrop.qtyMax = newDrop.qtyMin;
            else newDrop.qtyMin = newDrop.qtyMax;
          }
        } else {
          newDrop[field] = el.value;
        }

        // Reemplazar en el array (también con nueva referencia para forzar reactividad)
        editingDraft.drops = editingDraft.drops.map((d, i) => i === idx ? newDrop : d);
        dirty = true;
        // v1.6.4: habilitar botón Guardar (estaba olvidado)
        const saveBtn = host.querySelector('[data-editor-action="save"]');
        if (saveBtn) saveBtn.disabled = false;
        const discardBtn = host.querySelector('[data-editor-action="discard"]');
        if (discardBtn) discardBtn.disabled = false;
      };
      // v1.6.4: escuchar tanto input como change (number inputs son inconsistentes)
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
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

    // === Toggle de weapon statusEffect ===
    host.querySelectorAll('[data-weapon-effect-toggle]').forEach((cb) => {
      cb.addEventListener('change', () => {
        if (!editingDraft) return;
        if (cb.checked) {
          // Activar: si no hay statusEffect, crear default
          if (!editingDraft.statusEffect) {
            editingDraft.statusEffect = { type: 'bleed', chance: 0.20, turns: 3, value: 1 };
          }
        } else {
          // Desactivar: borrar
          editingDraft.statusEffect = null;
        }
        dirty = true;
        render();
      });
    });

    // === Mount de tag-inputs (autocomplete) ===
    host.querySelectorAll('[data-tag-input-mount]').forEach((placeholder) => {
      try {
        const field = placeholder.dataset.tagField;
        const collection = placeholder.dataset.tagCollection;
        const phText = placeholder.dataset.tagPlaceholder || 'Buscar...';
        let initial = [];
        try { initial = JSON.parse(placeholder.dataset.tagValue || '[]'); } catch (e) {}
        if (!A.TagInput) {
          console.warn('A.TagInput no cargado');
          return;
        }
        A.TagInput.create({
          container: placeholder,
          value: initial,
          collection,
          placeholder: phText,
          onChange: (newValue) => {
            // Actualizar el draft con el nuevo array
            if (editingDraft) {
              editingDraft[field] = newValue;
              dirty = true;
            }
          },
        });
      } catch (err) {
        console.error('[TagInput] Error montando:', placeholder, err);
      }
    });
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
    dropQty: {},   // v1.6.1: { enemyId: { itemId: { min, max } } } - overrides de qty antes de aceptar
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
      dropQty: {},
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
                    <span class="audit-wizard-stat-current">
                      <span class="dim">actual</span>
                      <input class="form-input audit-stat-input" type="text" value="${A.Utils.escapeHtml(String(a.current ?? ''))}" data-audit-stat-edit="${A.Utils.escapeHtml(a.field)}">
                      ${a.isDamageDice ? ` <span class="dim">(~${a.currentNum.toFixed(1)})</span>` : ''}
                    </span>
                    <span class="audit-wizard-stat-arrow dim">→</span>
                    <span class="audit-wizard-stat-suggested"><span class="dim">sugerido</span> <strong>${a.suggested}</strong></span>
                    <span class="audit-wizard-stat-delta dim">(${a.delta}% desvío)</span>
                    <button class="btn-mini" type="button" data-audit-stat-apply="${A.Utils.escapeHtml(a.field)}" data-audit-stat-value="${A.Utils.escapeHtml(String(a.suggested))}">Usar sugerido</button>
                  </div>
                </div>
              `).join('')}
            </div>

            ${(() => {
              const drops = A.LootIntelligence ? A.LootIntelligence.suggestDrops(enemy) : [];
              const manualDrops = enemy.drops || [];
              const blacklist = enemy.dropsBlacklist || [];
              if (!drops.length && !manualDrops.length && !blacklist.length) return '';

              const manualRows = manualDrops.map((d, i) => {
                const item = A.Inventory.resolveData(d.itemId);
                const name = item ? item.name : d.itemId;
                const icon = item ? (item.icon || '📦') : '📦';
                const chancePct = Math.round((d.chance || 0) * 100);
                const isAuto = d.source === 'auto';
                const qtyMin = d.qtyMin || 1;
                const qtyMax = d.qtyMax || 1;
                const kindBadge = item ?
                  (item.type === 'weapon' ? '<span class="drop-kind-badge drop-kind-weapon" title="Arma">⚔️</span>'
                  : item.type === 'armor' ? '<span class="drop-kind-badge drop-kind-armor" title="Armadura">🛡️</span>'
                  : '') : '';
                return `
                  <div class="drop-row-v2 is-manual">
                    <span class="drop-row-icon">${icon}</span>
                    <div class="drop-row-info">
                      <div class="drop-row-name">${A.Utils.escapeHtml(name)} ${kindBadge}</div>
                      <div class="drop-row-id-text dim">${A.Utils.escapeHtml(d.itemId)}</div>
                    </div>
                    <div class="drop-row-qty" title="Cantidad min – max">
                      <input class="form-input drop-qty-input" data-wizard-current-qty="min" data-current-itemid="${A.Utils.escapeHtml(d.itemId)}" type="number" min="1" max="99" step="1" value="${qtyMin}" title="Cantidad mínima">
                      <span class="drop-qty-sep">–</span>
                      <input class="form-input drop-qty-input" data-wizard-current-qty="max" data-current-itemid="${A.Utils.escapeHtml(d.itemId)}" type="number" min="1" max="99" step="1" value="${qtyMax}" title="Cantidad máxima">
                    </div>
                    <div class="drop-row-chance">
                      <input class="form-input drop-chance-pct" data-wizard-drop-chance="${A.Utils.escapeHtml(d.itemId)}" type="number" min="0" max="100" step="1" value="${chancePct}">
                      <span class="drop-chance-suffix">%</span>
                    </div>
                    <span class="drop-row-source ${isAuto ? 'is-auto' : 'is-manual'}">${isAuto ? 'AUTO' : 'MANUAL'}</span>
                    <button class="drop-row-remove" data-audit-drop-action="remove-manual" data-drop-itemid="${A.Utils.escapeHtml(d.itemId)}" type="button" title="Quitar este drop">×</button>
                  </div>
                `;
              }).join('');

              const sugRows = drops.map((d) => {
                const item = A.Inventory.resolveData(d.itemId);
                const name = item ? item.name : d.itemId;
                const icon = item ? (item.icon || '📦') : '📦';
                const kindBadge = item ?
                  (item.type === 'weapon' ? '<span class="drop-kind-badge drop-kind-weapon" title="Arma">⚔️</span>'
                  : item.type === 'armor' ? '<span class="drop-kind-badge drop-kind-armor" title="Armadura">🛡️</span>'
                  : '') : '';
                // v1.6.1: qty editable antes de aceptar
                const qtyOverride = (auditWizardState.dropQty && auditWizardState.dropQty[enemy.id] && auditWizardState.dropQty[enemy.id][d.itemId]) || {};
                const qtyMin = qtyOverride.min || d.qtyMin || 1;
                const qtyMax = qtyOverride.max || d.qtyMax || 1;
                return `
                  <div class="drop-row-v2 is-suggested">
                    <span class="drop-row-icon">${icon}</span>
                    <div class="drop-row-info">
                      <div class="drop-row-name">${A.Utils.escapeHtml(name)} ${kindBadge}</div>
                      <div class="drop-row-meta dim">${A.Utils.escapeHtml(d.reason)}</div>
                    </div>
                    <div class="drop-row-qty" title="Cantidad min – max">
                      <input class="form-input drop-qty-input" data-wizard-sug-qty="min" data-sug-itemid="${A.Utils.escapeHtml(d.itemId)}" type="number" min="1" max="99" step="1" value="${qtyMin}" title="Cantidad mínima">
                      <span class="drop-qty-sep">–</span>
                      <input class="form-input drop-qty-input" data-wizard-sug-qty="max" data-sug-itemid="${A.Utils.escapeHtml(d.itemId)}" type="number" min="1" max="99" step="1" value="${qtyMax}" title="Cantidad máxima">
                    </div>
                    <div class="drop-row-chance-display">
                      <span class="num">${Math.round(d.chance * 100)}%</span>
                    </div>
                    <button class="btn-mini" data-audit-drop-action="accept" data-drop-itemid="${A.Utils.escapeHtml(d.itemId)}" data-drop-chance="${d.chance}" type="button">✓ Aceptar</button>
                    <button class="btn-mini btn-mini-danger" data-audit-drop-action="reject" data-drop-itemid="${A.Utils.escapeHtml(d.itemId)}" type="button">✕ Rechazar</button>
                  </div>
                `;
              }).join('');

              const blRows = blacklist.length ? `
                <div class="audit-wizard-drops-bl-title dim">Rechazados (no se sugieren más)</div>
                ${blacklist.map((id) => {
                  const item = A.Inventory.resolveData(id);
                  const name = item ? item.name : id;
                  const icon = item ? (item.icon || '📦') : '📦';
                  return `
                    <div class="drop-row-v2 is-blacklist">
                      <span class="drop-row-icon">${icon}</span>
                      <div class="drop-row-info">
                        <div class="drop-row-name">${A.Utils.escapeHtml(name)}</div>
                        <div class="drop-row-meta dim">rechazado</div>
                      </div>
                      <span class="drop-row-chance-display dim">—</span>
                      <button class="btn-mini" data-audit-drop-action="unreject" data-drop-itemid="${A.Utils.escapeHtml(id)}" type="button">Restaurar</button>
                    </div>
                  `;
                }).join('')}
              ` : '';

              return `
                <div class="audit-wizard-drops">
                  <div class="audit-wizard-drops-title">📦 Drops del enemigo</div>
                  ${manualDrops.length ? `<div class="audit-wizard-drops-section-title dim">Drops actuales (${manualDrops.length})</div>` : ''}
                  ${manualRows}
                  ${drops.length ? `<div class="audit-wizard-drops-section-title dim">Sugeridos por LootIntelligence (${drops.length})</div>` : ''}
                  ${sugRows}
                  ${blRows}
                </div>
              `;
            })()}

            <div class="audit-wizard-actions-info dim">
              💡 "Aplicar todos" usará la sugerencia de AutoBalance para los campos desbalanceados.
              Los drops aceptados se guardan en el enemigo. Los rechazados no vuelven a sugerirse.
            </div>
          </main>
        </div>

        <footer class="audit-wizard-footer audit-wizard-footer-v2">
          <div class="audit-footer-left">
            <button class="btn-secondary" data-audit-action="prev" ${cursor === 0 ? 'disabled' : ''}>← Anterior</button>
            <button class="btn-ghost" data-audit-action="skip" title="Saltar este sin cambios">Saltar</button>
          </div>
          <div class="audit-footer-center">
            <button class="btn-secondary audit-btn-apply-stats" data-audit-action="apply" title="Aplica los stats sugeridos">✓ Stats</button>
            <button class="btn-secondary audit-btn-apply-drops" data-audit-action="accept-all-drops" title="Acepta todas las sugerencias de drops">✓ Drops</button>
            <button class="btn-primary audit-btn-apply-all" data-audit-action="apply-all" title="Aplica stats + drops sugeridos en un click">✓ Aplicar todo</button>
          </div>
          <div class="audit-footer-right">
            <button class="btn-primary" data-audit-action="next" ${cursor >= auditWizardState.items.length - 1 ? 'disabled' : ''}>Siguiente →</button>
            <button class="btn-ghost btn-tiny" data-audit-close title="Cerrar auditoría">✕</button>
          </div>
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
        } else if (a === 'next') {
          if (auditWizardState.cursor < auditWizardState.items.length - 1) {
            auditWizardState.cursor++;
            renderAuditWizard();
          }
        } else if (a === 'apply') {
          applyCurrentAudit();
        } else if (a === 'accept-all-drops') {
          // v1.6.1: aceptar todos los drops sugeridos del enemigo actual
          acceptAllDropsForCurrentAudit();
        } else if (a === 'apply-all') {
          // v1.6.4: aplicar stats + drops sugeridos en un solo click
          applyCurrentAudit();
          acceptAllDropsForCurrentAudit();
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

    // === Drops del wizard: aceptar / rechazar / restaurar / quitar ===
    overlay.querySelectorAll('[data-audit-drop-action]').forEach((b) => {
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const action = b.dataset.auditDropAction;
        const itemId = b.dataset.dropItemid;
        const chance = parseFloat(b.dataset.dropChance) || 0.3;
        if (!itemId) return;

        const current = auditWizardState.items[auditWizardState.cursor];
        if (!current) return;
        const enemy = current.enemy;

        applyDropAction(enemy, action, itemId, chance);
        // v1.6.3: feedback visual breve
        const label = action === 'accept' ? '✓ Drop aceptado'
                    : action === 'reject' ? '✕ Drop rechazado'
                    : action === 'unreject' ? '↻ Drop restaurado'
                    : action === 'remove-manual' ? 'Drop eliminado'
                    : 'Acción aplicada';
        showWizardToast(label, action === 'reject' || action === 'remove-manual' ? 'info' : 'success');
        renderAuditWizard();
      });
    });

    // === Wizard: cantidades de drops editables ===
    overlay.querySelectorAll('[data-wizard-drop-chance]').forEach((input) => {
      input.addEventListener('change', (ev) => {
        const itemId = input.dataset.wizardDropChance;
        const pct = Number(input.value);
        const newChance = Math.max(0, Math.min(1, pct / 100));
        const current = auditWizardState.items[auditWizardState.cursor];
        if (!current) return;
        const enemy = current.enemy;
        // Actualizar drop manual con nueva chance
        applyDropChanceChange(enemy, itemId, newChance);
        // No re-render para no perder foco
      });
    });

    // v1.6.1: bind para qty editable de sugerencias (antes de aceptar)
    overlay.querySelectorAll('[data-wizard-sug-qty]').forEach((input) => {
      input.addEventListener('change', (ev) => {
        const which = input.dataset.wizardSugQty; // 'min' o 'max'
        const itemId = input.dataset.sugItemid;
        const val = Math.max(1, Math.min(99, parseInt(input.value, 10) || 1));
        const current = auditWizardState.items[auditWizardState.cursor];
        if (!current) return;
        const enemyId = current.enemy.id;
        auditWizardState.dropQty[enemyId] = auditWizardState.dropQty[enemyId] || {};
        auditWizardState.dropQty[enemyId][itemId] = auditWizardState.dropQty[enemyId][itemId] || {};
        auditWizardState.dropQty[enemyId][itemId][which] = val;
        // Asegurar que qtyMax >= qtyMin
        const o = auditWizardState.dropQty[enemyId][itemId];
        if (o.min && o.max && o.min > o.max) {
          if (which === 'min') o.max = o.min;
          else o.min = o.max;
        }
        // No re-render para no perder foco
      });
    });

    // v1.6.4: bind para qty editable de drops ACTUALES (ya en enemy.drops)
    // Modificarlos persiste en overrides al instante.
    overlay.querySelectorAll('[data-wizard-current-qty]').forEach((input) => {
      input.addEventListener('change', (ev) => {
        const which = input.dataset.wizardCurrentQty; // 'min' o 'max'
        const itemId = input.dataset.currentItemid;
        const val = Math.max(1, Math.min(99, parseInt(input.value, 10) || 1));
        const current = auditWizardState.items[auditWizardState.cursor];
        if (!current) return;
        const enemy = current.enemy;
        applyCurrentDropQty(enemy, itemId, which, val);
        // No re-render para mantener foco; el toast da feedback
        showWizardToast(`✓ Cantidad ${which} = ${val}`, 'success');
      });
    });

    // === Stats editables inline: input change y "Usar sugerido" ===
    overlay.querySelectorAll('[data-audit-stat-edit]').forEach((input) => {
      input.addEventListener('change', (ev) => {
        const field = input.dataset.auditStatEdit;
        const current = auditWizardState.items[auditWizardState.cursor];
        if (!current) return;
        let value = input.value;
        // Para campos numéricos, parsear
        if (['health', 'difficulty', 'armor', 'speed'].includes(field)) {
          value = Number(value);
          if (isNaN(value)) return;
        }
        applyStatChange(current.enemy, field, value);
        renderAuditWizard();
      });
    });

    overlay.querySelectorAll('[data-audit-stat-apply]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const field = btn.dataset.auditStatApply;
        let value = btn.dataset.auditStatValue;
        const current = auditWizardState.items[auditWizardState.cursor];
        if (!current) return;
        if (['health', 'difficulty', 'armor', 'speed'].includes(field)) {
          value = Number(value);
        }
        applyStatChange(current.enemy, field, value);
        renderAuditWizard();
      });
    });

    // Click fuera del modal cierra
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAuditWizard();
    });
  }

  /**
   * Aplica una acción de drop al enemigo y persiste como override:
   * - accept:        agrega a enemy.drops con source:'auto'
   * - reject:        agrega a enemy.dropsBlacklist
   * - unreject:      quita de dropsBlacklist
   * - remove-manual: quita de enemy.drops
   */
  function applyDropAction(enemy, action, itemId, chance) {
    const overrides = A.Data.getOverrides();
    overrides.enemies = overrides.enemies || [];
    let target = overrides.enemies.find((e) => e.id === enemy.id);
    if (!target) {
      target = JSON.parse(JSON.stringify(enemy));
      delete target._source;
      overrides.enemies.push(target);
    }
    target.drops = target.drops || [];
    target.dropsBlacklist = target.dropsBlacklist || [];

    if (action === 'accept') {
      // Si ya está en blacklist, quitarla
      target.dropsBlacklist = target.dropsBlacklist.filter((id) => id !== itemId);
      // Si ya está en drops, no duplicar
      if (!target.drops.some((d) => d.itemId === itemId)) {
        // v1.6.1: usar qty editado en wizard si existe
        const qOv = (auditWizardState.dropQty && auditWizardState.dropQty[enemy.id] && auditWizardState.dropQty[enemy.id][itemId]) || {};
        target.drops.push({
          itemId,
          chance,
          qtyMin: qOv.min || 1,
          qtyMax: qOv.max || qOv.min || 1,
          source: 'auto',
        });
      }
    } else if (action === 'reject') {
      if (!target.dropsBlacklist.includes(itemId)) {
        target.dropsBlacklist.push(itemId);
      }
      // Si estaba en drops, quitarlo también
      target.drops = target.drops.filter((d) => d.itemId !== itemId);
    } else if (action === 'unreject') {
      target.dropsBlacklist = target.dropsBlacklist.filter((id) => id !== itemId);
    } else if (action === 'remove-manual') {
      target.drops = target.drops.filter((d) => d.itemId !== itemId);
    }

    A.Data.saveOverrides(overrides);
    A.Data.init();
    dirty = true;
    // v1.6.3: SYNC reactivo completo (modelo + audit)
    const updated = A.Data.getById('enemies', enemy.id);
    if (updated && auditWizardState.items[auditWizardState.cursor]) {
      auditWizardState.items[auditWizardState.cursor].enemy = updated;
      auditWizardState.items[auditWizardState.cursor].audit = A.AutoBalance.auditEnemyFull(updated);
      auditWizardState.items[auditWizardState.cursor].issues =
        auditWizardState.items[auditWizardState.cursor].audit.filter((a) => a.status !== 'ok');
    }
  }

  /**
   * Cambia la chance de un drop manual existente y persiste como override.
   */
  function applyDropChanceChange(enemy, itemId, newChance) {
    const overrides = A.Data.getOverrides();
    overrides.enemies = overrides.enemies || [];
    let target = overrides.enemies.find((e) => e.id === enemy.id);
    if (!target) {
      target = JSON.parse(JSON.stringify(enemy));
      delete target._source;
      overrides.enemies.push(target);
    }
    target.drops = target.drops || [];
    const drop = target.drops.find((d) => d.itemId === itemId);
    if (drop) {
      drop.chance = Math.max(0, Math.min(1, newChance));
      A.Data.saveOverrides(overrides);
      A.Data.init();
      dirty = true;
      // Actualizar referencia en wizard state
      const updated = A.Data.getById('enemies', enemy.id);
      if (updated && auditWizardState.items[auditWizardState.cursor]) {
        auditWizardState.items[auditWizardState.cursor].enemy = updated;
      }
    }
  }

  /**
   * v1.6.4: Modifica qtyMin o qtyMax de un drop actual del enemigo.
   * which: 'min' | 'max'. Persiste como override.
   */
  function applyCurrentDropQty(enemy, itemId, which, value) {
    const overrides = A.Data.getOverrides();
    overrides.enemies = overrides.enemies || [];
    let target = overrides.enemies.find((e) => e.id === enemy.id);
    if (!target) {
      target = JSON.parse(JSON.stringify(enemy));
      delete target._source;
      overrides.enemies.push(target);
    }
    target.drops = target.drops || [];
    const drop = target.drops.find((d) => d.itemId === itemId);
    if (!drop) return;
    if (which === 'min') {
      drop.qtyMin = Math.max(1, Math.min(99, value));
      if (drop.qtyMax && drop.qtyMin > drop.qtyMax) drop.qtyMax = drop.qtyMin;
    } else if (which === 'max') {
      drop.qtyMax = Math.max(1, Math.min(99, value));
      if (drop.qtyMin && drop.qtyMax < drop.qtyMin) drop.qtyMin = drop.qtyMax;
    }
    A.Data.saveOverrides(overrides);
    A.Data.init();
    dirty = true;
    const updated = A.Data.getById('enemies', enemy.id);
    if (updated && auditWizardState.items[auditWizardState.cursor]) {
      auditWizardState.items[auditWizardState.cursor].enemy = updated;
    }
  }

  /**
   * Aplica cambio en un stat individual (health, damage, difficulty, armor, speed)
   * y persiste como override.
   */
  function applyStatChange(enemy, field, value) {
    const overrides = A.Data.getOverrides();
    overrides.enemies = overrides.enemies || [];
    let target = overrides.enemies.find((e) => e.id === enemy.id);
    if (!target) {
      target = JSON.parse(JSON.stringify(enemy));
      delete target._source;
      overrides.enemies.push(target);
    }
    target[field] = value;

    A.Data.saveOverrides(overrides);
    A.Data.init();
    dirty = true;
    // Re-calcular audit del enemigo actual para reflejar el cambio
    const updated = A.Data.getById('enemies', enemy.id);
    if (updated && auditWizardState.items[auditWizardState.cursor]) {
      auditWizardState.items[auditWizardState.cursor].enemy = updated;
      // Re-correr el audit para actualizar status (ok/warning/critical)
      const newAudit = A.AutoBalance.auditEnemyFull(updated);
      const issues = newAudit.filter((a) => a.status !== 'ok');
      auditWizardState.items[auditWizardState.cursor].audit = newAudit;
      auditWizardState.items[auditWizardState.cursor].issues = issues;
    }
  }

  /**
   * v1.6.3: Aplica los stats sugeridos del enemigo actual.
   * Reactivo: actualiza el modelo, recalcula la auditoría y re-renderiza.
   * NO avanza cursor automáticamente — el usuario decide cuándo pasar al siguiente.
   */
  function applyCurrentAudit() {
    const current = auditWizardState.items[auditWizardState.cursor];
    if (!current) return;
    const enemy = current.enemy;
    const sug = A.AutoBalance.suggestEnemyStats(enemy);

    const overrides = A.Data.getOverrides();
    overrides.enemies = overrides.enemies || [];
    const idx = overrides.enemies.findIndex((e) => e.id === enemy.id);
    let target = idx >= 0 ? overrides.enemies[idx] : JSON.parse(JSON.stringify(enemy));
    delete target._source;

    let appliedFields = 0;
    for (const a of current.audit) {
      if (a.status === 'ok') continue;
      const newVal = sug[a.field];
      if (newVal == null) continue;
      target[a.field] = newVal;
      appliedFields++;
    }

    if (appliedFields === 0) {
      showWizardToast('Nada para aplicar — todos los stats ya están OK', 'info');
      return;
    }

    if (idx >= 0) overrides.enemies[idx] = target;
    else overrides.enemies.push(target);

    A.Data.saveOverrides(overrides);
    A.Data.init();

    // v1.6.3: SYNC reactivo — re-leer enemigo, recalcular auditoría, re-renderizar
    const updated = A.Data.getById('enemies', enemy.id);
    if (updated) {
      auditWizardState.items[auditWizardState.cursor].enemy = updated;
      auditWizardState.items[auditWizardState.cursor].audit = A.AutoBalance.auditEnemyFull(updated);
      auditWizardState.items[auditWizardState.cursor].issues =
        auditWizardState.items[auditWizardState.cursor].audit.filter((a) => a.status !== 'ok');
    }

    auditWizardState.appliedCount++;
    dirty = true;
    renderAuditWizard();
    showWizardToast(`✓ ${appliedFields} stat${appliedFields > 1 ? 's' : ''} aplicado${appliedFields > 1 ? 's' : ''}`, 'success');
  }

  /**
   * v1.6.3: Acepta todos los drops sugeridos del enemigo actual.
   * Reactivo: actualiza, recalcula, re-renderiza, feedback visual.
   */
  function acceptAllDropsForCurrentAudit() {
    const current = auditWizardState.items[auditWizardState.cursor];
    if (!current) return;
    const enemy = current.enemy;
    if (!A.LootIntelligence) return;
    const suggested = A.LootIntelligence.suggestDrops(enemy);
    if (!suggested || suggested.length === 0) {
      showWizardToast('No hay sugerencias de drops para este enemigo', 'info');
      return;
    }
    const rejected = new Set(enemy.dropsBlacklist || []);
    const existingDropIds = new Set((enemy.drops || []).map((d) => d.itemId));
    const validSug = suggested.filter((s) =>
      !rejected.has(s.itemId) && !existingDropIds.has(s.itemId)
    );
    if (validSug.length === 0) {
      showWizardToast('Ya tenés todas las sugerencias aceptadas o rechazadas', 'info');
      return;
    }

    const overrides = A.Data.getOverrides();
    overrides.enemies = overrides.enemies || [];
    const idx = overrides.enemies.findIndex((e) => e.id === enemy.id);
    let target = idx >= 0 ? overrides.enemies[idx] : JSON.parse(JSON.stringify(enemy));
    delete target._source;
    target.drops = target.drops || [];

    let added = 0;
    for (const s of validSug) {
      const wizardQty = (auditWizardState.dropQty && auditWizardState.dropQty[enemy.id] && auditWizardState.dropQty[enemy.id][s.itemId]) || {};
      target.drops.push({
        itemId: s.itemId,
        chance: s.chance || 0.3,
        qtyMin: wizardQty.min || s.qtyMin || 1,
        qtyMax: wizardQty.max || s.qtyMax || 1,
        source: 'auto',
      });
      added++;
    }

    if (idx >= 0) overrides.enemies[idx] = target;
    else overrides.enemies.push(target);
    A.Data.saveOverrides(overrides);
    A.Data.init();

    // v1.6.3: SYNC reactivo
    const updated = A.Data.getById('enemies', enemy.id);
    if (updated) {
      auditWizardState.items[auditWizardState.cursor].enemy = updated;
      auditWizardState.items[auditWizardState.cursor].audit = A.AutoBalance.auditEnemyFull(updated);
      auditWizardState.items[auditWizardState.cursor].issues =
        auditWizardState.items[auditWizardState.cursor].audit.filter((a) => a.status !== 'ok');
    }

    dirty = true;
    renderAuditWizard();
    showWizardToast(`✓ ${added} drop${added > 1 ? 's' : ''} aceptado${added > 1 ? 's' : ''}`, 'success');
  }

  /**
   * v1.6.3: Toast flotante para feedback del wizard de auditoría.
   * Aparece arriba a la derecha, desaparece después de 2.5s.
   */
  function showWizardToast(text, type) {
    type = type || 'info';
    let toastWrap = document.getElementById('audit-toast-wrap');
    if (!toastWrap) {
      toastWrap = document.createElement('div');
      toastWrap.id = 'audit-toast-wrap';
      document.body.appendChild(toastWrap);
    }
    const toast = document.createElement('div');
    toast.className = `audit-toast audit-toast-${type}`;
    toast.textContent = text;
    toastWrap.appendChild(toast);
    // Forzar reflow para animación
    toast.offsetHeight;
    toast.classList.add('is-visible');
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ============================================================
  // v1.5.7f — GRAPH EDITOR: editor visual de conexiones de regiones
  // ============================================================
  let graphState = {
    open: false,
    nodes: {},      // id → {x, y}
    selected: null, // nodeId seleccionado para conectar
    drag: null,     // {nodeId, offsetX, offsetY}
    pan: { x: 0, y: 0 },
    zoom: 1.0,
    panDrag: null,
  };

  const GRAPH_STORAGE_KEY = 'aventurs:graph_positions';

  function loadGraphPositions() {
    // v1.6.0: prioridad — leer pos de cada region (override > seed)
    // Si una región tiene region.pos, usarlo. Si no, fallback al storage legacy.
    const result = {};
    const regions = A.Data.regions || [];
    for (const r of regions) {
      if (r.pos && typeof r.pos.x === 'number' && typeof r.pos.y === 'number') {
        result[r.id] = { x: r.pos.x, y: r.pos.y };
      }
    }
    // Fallback: legacy localStorage key (para no perder posiciones viejas)
    try {
      const raw = localStorage.getItem(GRAPH_STORAGE_KEY);
      if (raw) {
        const legacy = JSON.parse(raw);
        for (const id of Object.keys(legacy)) {
          if (!result[id]) result[id] = legacy[id];
        }
      }
    } catch (e) {}
    return result;
  }

  function saveGraphPositions() {
    // v1.6.0: persistir las posiciones EN cada region como pos:{x,y} en el override.
    // Esto hace que: (a) viajen con export/import, (b) el mapa principal las lea.
    try {
      const overrides = A.Data.getOverrides();
      overrides.regions = overrides.regions || [];
      const regions = A.Data.regions || [];
      for (const id of Object.keys(graphState.nodes)) {
        const pos = graphState.nodes[id];
        if (!pos || typeof pos.x !== 'number') continue;
        // Buscar override existente o crear uno
        let target = overrides.regions.find((r) => r.id === id);
        if (!target) {
          const seed = regions.find((r) => r.id === id);
          if (!seed) continue;
          target = JSON.parse(JSON.stringify(seed));
          delete target._source;
          overrides.regions.push(target);
        }
        target.pos = { x: pos.x, y: pos.y };
      }
      A.Data.saveOverrides(overrides);
      A.Data.init();
      // Compat: también guardamos legacy
      localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify(graphState.nodes));
    } catch (e) {
      console.warn('[GraphEditor] Error guardando posiciones:', e);
    }
  }

  /**
   * Layout inicial automático: si las regiones no tienen posición guardada,
   * BFS desde la actualmente abierta y poner en anillos concéntricos.
   */
  function autoLayout() {
    const allRegions = A.Data.regions || [];
    const startId = editingDraft && editingDraft.id ? editingDraft.id : (allRegions[0] && allRegions[0].id);
    if (!startId) return;

    const dist = {};
    dist[startId] = 0;
    const queue = [startId];
    while (queue.length > 0) {
      const id = queue.shift();
      const reg = allRegions.find((r) => r.id === id);
      if (!reg) continue;
      for (const cid of (reg.connections || [])) {
        if (dist[cid] === undefined) {
          dist[cid] = dist[id] + 1;
          queue.push(cid);
        }
      }
    }
    // Las que no quedaron conectadas, las pongo a una distancia "extrema"
    for (const r of allRegions) {
      if (dist[r.id] === undefined) dist[r.id] = 99;
    }

    const rings = {};
    for (const r of allRegions) {
      const d = dist[r.id];
      if (!rings[d]) rings[d] = [];
      rings[d].push(r);
    }

    const cx = 500, cy = 350;
    const radii = [0, 130, 240, 340, 430, 520];

    for (const dStr of Object.keys(rings)) {
      const d = parseInt(dStr, 10);
      const ring = rings[d];
      const radius = d === 99 ? 600 : (radii[d] != null ? radii[d] : radii[radii.length - 1] + (d - radii.length + 1) * 80);
      if (d === 0) {
        graphState.nodes[ring[0].id] = graphState.nodes[ring[0].id] || { x: cx, y: cy };
      } else {
        const n = ring.length;
        const angleOffset = -Math.PI / 2 + (d * 0.3);
        for (let i = 0; i < n; i++) {
          const angle = angleOffset + (2 * Math.PI * i) / n;
          const targetX = cx + Math.cos(angle) * radius;
          const targetY = cy + Math.sin(angle) * radius;
          if (!graphState.nodes[ring[i].id]) {
            graphState.nodes[ring[i].id] = { x: targetX, y: targetY };
          }
        }
      }
    }
  }

  function openGraphEditor() {
    try {
      console.log('[GraphEditor] Abriendo editor visual de conexiones...');

      // Si hay un draft sin guardar, guardarlo silenciosamente para que
      // las conexiones del editor visual reflejen lo que está en pantalla
      if (editingDraft && dirty) {
        console.log('[GraphEditor] Guardando draft pendiente antes de abrir...');
        try { saveDraft(true); } catch (e) { console.warn('No se pudo guardar draft:', e); }
      }

      // Cargar posiciones persistidas
      const saved = loadGraphPositions();
      graphState.nodes = { ...saved };
      graphState.selected = null;
      graphState.drag = null;
      graphState.panDrag = null;
      graphState.pan = { x: 0, y: 0 };
      graphState.zoom = 1.0;

      // Layout automático para nodos sin posición previa
      autoLayout();

      graphState.open = true;
      console.log('[GraphEditor] Posiciones calculadas, renderizando...', Object.keys(graphState.nodes).length, 'nodos');
      renderGraphEditor();
      console.log('[GraphEditor] Render completo. Overlay:', document.getElementById('graph-editor-overlay') ? 'SÍ existe en DOM' : 'NO existe en DOM');
    } catch (err) {
      console.error('[GraphEditor] ERROR al abrir:', err);
      alert('Error al abrir editor visual: ' + err.message + '\n\nVer consola para detalles.');
    }
  }

  function closeGraphEditor() {
    saveGraphPositions();
    graphState.open = false;
    const overlay = document.getElementById('graph-editor-overlay');
    if (overlay) overlay.remove();
    // Re-render por si cambió algo
    render();
  }

  function renderGraphEditor() {
    let overlay = document.getElementById('graph-editor-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'graph-editor-overlay';
      overlay.className = 'graph-editor-overlay';
      document.body.appendChild(overlay);
    }

    const allRegions = A.Data.regions || [];
    const editingId = editingDraft && editingDraft.id;

    // Garantía: TODA región debe tener posición antes de calcular viewBox
    // Si autoLayout no la asignó (caso raro), le pongo una por defecto
    let fallbackX = 100;
    for (const r of allRegions) {
      if (!graphState.nodes[r.id] || typeof graphState.nodes[r.id].x !== 'number' || isNaN(graphState.nodes[r.id].x)) {
        graphState.nodes[r.id] = { x: fallbackX, y: 100 };
        fallbackX += 80;
      }
    }

    // Calcular bounds del viewBox (todos los nodos + padding)
    const xs = allRegions.map((r) => graphState.nodes[r.id].x);
    const ys = allRegions.map((r) => graphState.nodes[r.id].y);
    const padding = 100;
    const minX = (xs.length ? Math.min(...xs) : 0) - padding;
    const maxX = (xs.length ? Math.max(...xs) : 1000) + padding;
    const minY = (ys.length ? Math.min(...ys) : 0) - padding;
    const maxY = (ys.length ? Math.max(...ys) : 700) + padding;
    const w = Math.max(100, maxX - minX);
    const h = Math.max(100, maxY - minY);

    // Líneas (conexiones únicas) - leemos directamente de Data
    const drawnEdges = new Set();
    const lines = [];
    for (const r of allRegions) {
      const pos = graphState.nodes[r.id];
      if (!pos) continue;
      for (const cid of (r.connections || [])) {
        const other = graphState.nodes[cid];
        if (!other) continue;
        const edgeKey = [r.id, cid].sort().join('::');
        if (drawnEdges.has(edgeKey)) continue;
        drawnEdges.add(edgeKey);
        // Línea destacada si toca el nodo editado o seleccionado
        const touchesEditing = r.id === editingId || cid === editingId;
        const touchesSelected = graphState.selected && (r.id === graphState.selected || cid === graphState.selected);
        const cls = `graph-edge ${touchesEditing ? 'is-editing' : ''} ${touchesSelected ? 'is-selected' : ''}`;
        lines.push(`<line x1="${pos.x.toFixed(1)}" y1="${pos.y.toFixed(1)}" x2="${other.x.toFixed(1)}" y2="${other.y.toFixed(1)}" class="${cls}" />`);
      }
    }

    // Nodos
    const nodes = allRegions.map((r) => {
      const pos = graphState.nodes[r.id];
      if (!pos) return '';
      const isEditing = r.id === editingId;
      const isSelected = r.id === graphState.selected;
      const radius = isEditing ? 32 : 26;
      const biomeCls = r.biome ? `biome-${r.biome}` : '';
      const cls = `graph-node ${isEditing ? 'is-editing' : ''} ${isSelected ? 'is-selected' : ''} is-${r.type} ${biomeCls}`;
      return `
        <g class="${cls}" data-graph-region="${A.Utils.escapeHtml(r.id)}" transform="translate(${pos.x.toFixed(1)} ${pos.y.toFixed(1)})">
          <circle cx="0" cy="0" r="${radius}" />
          <text x="0" y="2" text-anchor="middle" dominant-baseline="middle" font-size="${isEditing ? 24 : 20}">${r.icon || '📍'}</text>
          <text x="0" y="${(radius + 14)}" text-anchor="middle" font-size="11" class="graph-node-label">${A.Utils.escapeHtml(r.name)}</text>
        </g>
      `;
    }).join('');

    overlay.innerHTML = `
      <div class="graph-editor-modal">
        <header class="graph-editor-header">
          <div>
            <h2>🗺️ Editor visual de conexiones</h2>
            <div class="graph-editor-status dim">
              ${graphState.selected
                ? `Seleccionado: <strong>${A.Utils.escapeHtml(getRegionName(graphState.selected))}</strong> · click en otro nodo para conectar/desconectar · Esc cancela`
                : `Click en un nodo para seleccionar · arrastrá para mover · arrastrá vacío para pan`
              }
            </div>
          </div>
          <button class="modal-close" data-graph-close>✕</button>
        </header>

        <div class="graph-editor-canvas" data-graph-canvas>
          <svg class="graph-svg" viewBox="${minX} ${minY} ${w} ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
            <g class="graph-transform-g" transform="translate(${graphState.pan.x} ${graphState.pan.y}) scale(${graphState.zoom})">
              <g class="graph-edges">${lines.join('')}</g>
              <g class="graph-nodes">${nodes}</g>
            </g>
          </svg>
          <div class="graph-zoom-controls">
            <button class="map-zoom-btn" data-graph-zoom="in" title="Zoom in">+</button>
            <button class="map-zoom-btn" data-graph-zoom="out" title="Zoom out">−</button>
            <button class="map-zoom-btn" data-graph-zoom="reset" title="Reset">⊙</button>
          </div>
        </div>

        <footer class="graph-editor-footer">
          <div class="graph-editor-legend">
            <span class="dim">Leyenda:</span>
            <span class="graph-legend-item"><span class="dot" style="background:var(--gold)"></span>región editada</span>
            <span class="graph-legend-item"><span class="dot" style="background:#5a9233"></span>seleccionada</span>
            <span class="dim">·</span>
            <span class="dim">Las conexiones son bidireccionales</span>
          </div>
          <div class="graph-editor-actions">
            <button class="btn-secondary" data-graph-action="auto-layout" title="Reordenar automáticamente (no guarda)">↻ Re-acomodar</button>
            <button class="btn-secondary" data-graph-action="reset-layout" title="Borrar todas las posiciones guardadas">✕ Restablecer</button>
            <button class="btn-primary" data-graph-action="save-layout" title="Guardar las posiciones actuales en cada región">💾 Guardar layout</button>
            <button class="btn-secondary" data-graph-close>Cerrar</button>
          </div>
        </footer>
      </div>
    `;

    bindGraphEditorEvents(overlay);
  }

  function getRegionName(id) {
    const r = (A.Data.regions || []).find((x) => x.id === id);
    return r ? r.name : id;
  }

  function bindGraphEditorEvents(overlay) {
    // Close button
    overlay.querySelectorAll('[data-graph-close]').forEach((b) => {
      b.addEventListener('click', closeGraphEditor);
    });

    // Click fuera del modal cierra
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeGraphEditor();
    });

    // Esc cancela selección, segundo Esc cierra
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        if (graphState.selected) {
          graphState.selected = null;
          renderGraphEditor();
        } else {
          closeGraphEditor();
        }
      }
    };
    document.addEventListener('keydown', escHandler);
    overlay._escHandler = escHandler;

    // Zoom buttons
    overlay.querySelectorAll('[data-graph-zoom]').forEach((b) => {
      b.addEventListener('click', () => {
        const action = b.dataset.graphZoom;
        if (action === 'in') graphState.zoom = Math.min(3, graphState.zoom * 1.25);
        else if (action === 'out') graphState.zoom = Math.max(0.4, graphState.zoom / 1.25);
        else if (action === 'reset') { graphState.zoom = 1; graphState.pan = { x: 0, y: 0 }; }
        applyGraphTransform(overlay);
      });
    });

    // Wheel zoom
    const canvas = overlay.querySelector('[data-graph-canvas]');
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.111;
      graphState.zoom = Math.max(0.4, Math.min(3, graphState.zoom * delta));
      applyGraphTransform(overlay);
    }, { passive: false });

    // Auto-layout button
    overlay.querySelectorAll('[data-graph-action="auto-layout"]').forEach((b) => {
      b.addEventListener('click', () => {
        // Forzar re-layout: borrar posiciones actuales (en memoria, no persistidas)
        graphState.nodes = {};
        autoLayout();
        renderGraphEditor();
      });
    });

    // v1.6.0: Guardar layout button
    overlay.querySelectorAll('[data-graph-action="save-layout"]').forEach((b) => {
      b.addEventListener('click', () => {
        saveGraphPositions();
        // Feedback visual: cambiar texto del botón temporalmente
        const original = b.textContent;
        b.textContent = '✓ Guardado';
        b.disabled = true;
        setTimeout(() => {
          b.textContent = original;
          b.disabled = false;
        }, 1500);
      });
    });

    // v1.6.0: Restablecer layout — borra posiciones guardadas en regions y graph_positions
    overlay.querySelectorAll('[data-graph-action="reset-layout"]').forEach((b) => {
      b.addEventListener('click', () => {
        if (!confirm('¿Borrar todas las posiciones guardadas y volver al layout automático?')) return;
        // Borrar pos de cada region en overrides
        try {
          const overrides = A.Data.getOverrides();
          overrides.regions = (overrides.regions || []).map((r) => {
            const cp = { ...r };
            delete cp.pos;
            return cp;
          });
          A.Data.saveOverrides(overrides);
          A.Data.init();
          // Borrar legacy
          localStorage.removeItem(GRAPH_STORAGE_KEY);
        } catch (e) { console.warn('reset-layout error:', e); }
        graphState.nodes = {};
        autoLayout();
        renderGraphEditor();
      });
    });

    // Node interactions: drag o click para conectar
    overlay.querySelectorAll('[data-graph-region]').forEach((g) => {
      let mouseDownX = 0, mouseDownY = 0, mouseDownTime = 0;
      let didMove = false;

      g.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        mouseDownX = e.clientX;
        mouseDownY = e.clientY;
        mouseDownTime = Date.now();
        didMove = false;
        graphState.drag = {
          nodeId: g.dataset.graphRegion,
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          startNodeX: graphState.nodes[g.dataset.graphRegion].x,
          startNodeY: graphState.nodes[g.dataset.graphRegion].y,
        };
        document.addEventListener('mousemove', onNodeMove);
        document.addEventListener('mouseup', onNodeUp);
      });

      function onNodeMove(e) {
        if (!graphState.drag) return;
        const dx = e.clientX - graphState.drag.startMouseX;
        const dy = e.clientY - graphState.drag.startMouseY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didMove = true;
        if (didMove) {
          // Convertir delta de pantalla a delta del SVG (considerando zoom)
          const svg = overlay.querySelector('.graph-svg');
          const rect = svg.getBoundingClientRect();
          const vb = svg.viewBox.baseVal;
          const scaleX = vb.width / rect.width;
          const scaleY = vb.height / rect.height;
          graphState.nodes[graphState.drag.nodeId] = {
            x: graphState.drag.startNodeX + dx * scaleX / graphState.zoom,
            y: graphState.drag.startNodeY + dy * scaleY / graphState.zoom,
          };
          // Update solo el transform del nodo y las líneas conectadas (eficiente)
          updateNodePosition(overlay, graphState.drag.nodeId);
        }
      }

      function onNodeUp(e) {
        document.removeEventListener('mousemove', onNodeMove);
        document.removeEventListener('mouseup', onNodeUp);
        if (!graphState.drag) return;
        const dt = Date.now() - mouseDownTime;
        const draggedId = graphState.drag.nodeId;
        graphState.drag = null;

        if (!didMove && dt < 600) {
          // Click puro → seleccionar / conectar
          handleNodeClick(draggedId);
        } else {
          // Fue drag: persistir posiciones
          saveGraphPositions();
        }
      }
    });

    // Pan canvas (al hacer mousedown en zona vacía)
    const canvasEl = overlay.querySelector('[data-graph-canvas]');
    canvasEl.addEventListener('mousedown', (e) => {
      // Solo si el target ES el canvas o el svg (no un nodo)
      if (e.target.closest('[data-graph-region]')) return;
      if (e.button !== 0) return;
      graphState.panDrag = {
        startX: e.clientX, startY: e.clientY,
        startPanX: graphState.pan.x, startPanY: graphState.pan.y,
      };
      canvasEl.style.cursor = 'grabbing';
      document.addEventListener('mousemove', onPanMove);
      document.addEventListener('mouseup', onPanUp);
    });

    function onPanMove(e) {
      if (!graphState.panDrag) return;
      const dx = e.clientX - graphState.panDrag.startX;
      const dy = e.clientY - graphState.panDrag.startY;
      graphState.pan.x = graphState.panDrag.startPanX + dx;
      graphState.pan.y = graphState.panDrag.startPanY + dy;
      applyGraphTransform(overlay);
    }
    function onPanUp() {
      document.removeEventListener('mousemove', onPanMove);
      document.removeEventListener('mouseup', onPanUp);
      graphState.panDrag = null;
      canvasEl.style.cursor = 'grab';
    }
  }

  function applyGraphTransform(overlay) {
    const g = overlay.querySelector('.graph-transform-g');
    if (!g) return;
    g.setAttribute('transform', `translate(${graphState.pan.x} ${graphState.pan.y}) scale(${graphState.zoom})`);
  }

  function updateNodePosition(overlay, nodeId) {
    const pos = graphState.nodes[nodeId];
    if (!pos) return;
    // Update node transform
    const nodeEl = overlay.querySelector(`[data-graph-region="${nodeId}"]`);
    if (nodeEl) {
      nodeEl.setAttribute('transform', `translate(${pos.x.toFixed(1)} ${pos.y.toFixed(1)})`);
    }
    // Update líneas conectadas (esto es "barato": re-renderizamos el grupo .graph-edges)
    const allRegions = A.Data.regions || [];
    const drawnEdges = new Set();
    const editingId = editingDraft && editingDraft.id;
    const lines = [];
    for (const r of allRegions) {
      const ppos = graphState.nodes[r.id];
      if (!ppos) continue;
      for (const cid of (r.connections || [])) {
        const other = graphState.nodes[cid];
        if (!other) continue;
        const edgeKey = [r.id, cid].sort().join('::');
        if (drawnEdges.has(edgeKey)) continue;
        drawnEdges.add(edgeKey);
        const touchesEditing = r.id === editingId || cid === editingId;
        const touchesSelected = graphState.selected && (r.id === graphState.selected || cid === graphState.selected);
        const cls = `graph-edge ${touchesEditing ? 'is-editing' : ''} ${touchesSelected ? 'is-selected' : ''}`;
        lines.push(`<line x1="${ppos.x.toFixed(1)}" y1="${ppos.y.toFixed(1)}" x2="${other.x.toFixed(1)}" y2="${other.y.toFixed(1)}" class="${cls}" />`);
      }
    }
    const edgesGroup = overlay.querySelector('.graph-edges');
    if (edgesGroup) edgesGroup.innerHTML = lines.join('');
  }

  function handleNodeClick(nodeId) {
    if (!graphState.selected) {
      graphState.selected = nodeId;
      renderGraphEditor();
      return;
    }
    if (graphState.selected === nodeId) {
      // Click en el mismo: deseleccionar
      graphState.selected = null;
      renderGraphEditor();
      return;
    }
    // Toggle conexión bidireccional entre selected y nodeId
    toggleConnection(graphState.selected, nodeId);
    graphState.selected = null;
    renderGraphEditor();
  }

  /**
   * Activa o desactiva una conexión bidireccional entre dos regiones.
   * Persiste el cambio como override del editor.
   */
  function toggleConnection(idA, idB) {
    if (idA === idB) return;
    const overrides = A.Data.getOverrides();
    overrides.regions = overrides.regions || [];

    [idA, idB].forEach((thisId, i) => {
      const otherId = i === 0 ? idB : idA;
      // Buscar la región (override > seed)
      let target = overrides.regions.find((r) => r.id === thisId);
      if (!target) {
        const seed = A.Data.regions.find((r) => r.id === thisId);
        if (!seed) return;
        target = JSON.parse(JSON.stringify(seed));
        overrides.regions.push(target);
      }
      target.connections = target.connections || [];
      const idx = target.connections.indexOf(otherId);
      if (idx >= 0) target.connections.splice(idx, 1);
      else target.connections.push(otherId);
    });

    A.Data.saveOverrides(overrides);
    A.Data.init();
    dirty = true;
    // Si la región editada cambió sus conexiones, reflejarlo en editingDraft
    if (editingDraft && (editingDraft.id === idA || editingDraft.id === idB)) {
      const fresh = A.Data.regions.find((r) => r.id === editingDraft.id);
      if (fresh) {
        editingDraft.connections = [...(fresh.connections || [])];
      }
    }
  }

  /**
   * v1.6.0: Quita todos los enemigos asignados a una región cuyo tier
   * está fuera del rango de la región. Se persiste como override.
   */
  function removeRegionMisfits(regionId) {
    const region = A.Data.getById('regions', regionId);
    if (!region) return;
    const tier = Array.isArray(region.tier) ? region.tier : [region.tier || 1, region.tier || 1];
    const tierMin = tier[0], tierMax = tier[1];
    const allEnemies = A.Data.enemies || [];
    const misfits = allEnemies.filter((en) =>
      (en.regions || []).includes(regionId) &&
      (en.tier < tierMin || en.tier > tierMax)
    );
    if (misfits.length === 0) {
      alert('No hay enemigos fuera de tier para quitar.');
      return;
    }
    if (!confirm(`¿Quitar ${misfits.length} enemigos de esta región?\n\n${misfits.map((e) => `- ${e.name} (T${e.tier})`).join('\n')}`)) return;
    for (const en of misfits) {
      unassignEnemyFromRegion(en.id, regionId);
    }
    if (editingDraft && editingDraft.id === regionId) render();
  }

  const Editor = { mount, unmount };

  A.Views = A.Views || {};
  A.Views.Editor = Editor;
  // Exponer funciones para que los onclick inline las puedan llamar
  A.openGraphEditor = openGraphEditor;
  A.openRegionEnemyEditor = openRegionEnemyEditor;
  A.removeRegionMisfits = removeRegionMisfits;
})(window.Aventurs);
