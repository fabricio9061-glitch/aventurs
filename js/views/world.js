/* ============================================================
   Aventurs — View: World (Tab Mundo)
   Vista principal cuando no hay combate.
   - Muestra región actual con narrativa
   - NPCs visibles si la región es safe
   - Acciones (Explorar, Descansar)
   - Lista de viajes posibles
   ============================================================ */

(function (A) {
  'use strict';

  let mainEl = null;

  function render() {
    if (!mainEl) return;
    const w = A.State.world;
    if (!w) { mainEl.innerHTML = ''; return; }

    const region = A.Data.getById('regions', w.regionId);
    if (!region) {
      mainEl.innerHTML = `<div class="empty-tab">Región desconocida.</div>`;
      return;
    }

    const npcs = region.type === 'safe' ? A.Data.npcsInRegion(region.id) : [];
    const enemies = A.Data.enemiesInRegion(region.id);
    const neighbors = A.Travel.neighbors();

    mainEl.innerHTML = `
      <section class="world-view">

        <header class="region-banner ${region.type === 'safe' ? 'is-safe' : 'is-combat'}">
          <div class="region-icon-big">${region.icon || '📍'}</div>
          <div class="region-id">
            <div class="region-name">${A.Utils.escapeHtml(region.name)}</div>
            <div class="region-meta">
              <span class="pill ${region.type === 'safe' ? 'pill-safe' : 'pill-combat'}">
                ${region.type === 'safe' ? 'Zona segura' : 'Zona de combate'}
              </span>
              <span class="pill pill-tier">Tier ${region.tier[0]}–${region.tier[1]}</span>
              <span class="dim">${biomeLabel(region.biome)}</span>
            </div>
          </div>
        </header>

        <p class="region-desc">${A.Utils.escapeHtml(region.description)}</p>

        ${npcs.length ? `
          <section class="region-block">
            <div class="block-title">Habitantes</div>
            <div class="npc-grid">
              ${npcs.map((n) => npcCard(n)).join('')}
            </div>
          </section>
        ` : ''}

        <section class="region-block">
          <div class="block-title">Acciones</div>
          <div class="action-row">
            ${region.type === 'combat' ? `
              <button class="action-card" data-action="explore">
                <span class="action-icon">🔎</span>
                <span class="action-label">Explorar</span>
                <span class="action-desc dim">Buscar criaturas, tesoro o pistas.</span>
              </button>
            ` : ''}
            <button class="action-card" data-action="rest">
              <span class="action-icon">🌙</span>
              <span class="action-label">Descansar</span>
              <span class="action-desc dim">Recupera salud y maná.</span>
            </button>
          </div>
        </section>

        ${region.type === 'combat' && enemies.length ? `
          <section class="region-block">
            <div class="block-title">Criaturas que merodean</div>
            <div class="creature-strip">
              ${enemies.slice(0, 8).map((e) => `
                <div class="creature-chip" title="${A.Utils.escapeHtml(e.name)} · Tier ${e.tier} · ${e.category}">
                  <span class="creature-icon">${e.icon || '👹'}</span>
                  <span>${A.Utils.escapeHtml(e.name)}</span>
                </div>
              `).join('')}
              ${enemies.length > 8 ? `<div class="creature-chip dim">+${enemies.length - 8}</div>` : ''}
            </div>
          </section>
        ` : ''}

        <section class="region-block">
          <div class="block-title">Viajar</div>
          ${neighbors.length === 0 ? `
            <div class="muted">No hay caminos desde aquí.</div>
          ` : `
            <div class="travel-list">
              ${neighbors.map((n) => travelCard(n)).join('')}
            </div>
          `}
        </section>

      </section>
    `;

    bindEvents();
  }

  function npcCard(n) {
    const role = roleLabel(n.role);
    return `
      <button class="npc-card" data-npc="${n.id}">
        <div class="npc-icon">${n.icon || '🧑'}</div>
        <div class="npc-info">
          <div class="npc-name">${A.Utils.escapeHtml(n.name)}</div>
          <div class="npc-role dim">${role}</div>
        </div>
      </button>
    `;
  }

  function travelCard(n) {
    const dangerLabel = n.type === 'safe' ? 'Seguro' : 'Combate';
    const dangerClass = n.type === 'safe' ? 'pill-safe' : 'pill-combat';
    const enemiesCount = A.Data.enemiesInRegion(n.id).length;
    const dist = n.distance || 1;
    return `
      <button class="travel-card" data-travel="${n.id}">
        <div class="travel-icon">${n.icon || '📍'}</div>
        <div class="travel-info">
          <div class="travel-name">${A.Utils.escapeHtml(n.name)}</div>
          <div class="travel-meta">
            <span class="pill ${dangerClass}">${dangerLabel}</span>
            <span class="pill pill-tier">T${n.tier[0]}–${n.tier[1]}</span>
            <span class="dim">${dist === 1 ? 'Cerca' : dist === 2 ? 'Medio camino' : 'Lejos'}</span>
            ${enemiesCount ? `<span class="dim">· ${enemiesCount} criaturas</span>` : ''}
          </div>
        </div>
        <div class="travel-arrow dim">→</div>
      </button>
    `;
  }

  function biomeLabel(b) {
    const map = {
      village: 'Aldea', forest: 'Bosque', graveyard: 'Cementerio',
      plains: 'Llanura', swamp: 'Pantano', coast: 'Costa',
      arcane: 'Tierras arcanas', mountain: 'Montaña', desert: 'Desierto',
      ruins: 'Ruinas', crypt: 'Cripta', cave: 'Cueva',
      sea: 'Mar abierto', volcano: 'Volcán', hell: 'Infierno',
      lair: 'Guarida', abyss: 'Abismo',
    };
    return map[b] || b;
  }

  function roleLabel(role) {
    const map = {
      merchant: 'Mercader', shopkeeper: 'Comerciante', vendor: 'Vendedor',
      blacksmith: 'Herrero', innkeeper: 'Posadero', tavernkeeper: 'Tabernero',
      healer: 'Curandero', priest: 'Sacerdote', sage: 'Sabio',
      wizard: 'Mago', mage: 'Mago', quest: 'Tiene un encargo',
      guard: 'Guardia',
    };
    return map[role] || role;
  }

  function bindEvents() {
    mainEl.querySelectorAll('[data-travel]').forEach((btn) => {
      btn.addEventListener('click', () => onTravel(btn.dataset.travel));
    });
    mainEl.querySelectorAll('[data-npc]').forEach((btn) => {
      btn.addEventListener('click', () => onNpc(btn.dataset.npc));
    });
    mainEl.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => onAction(btn.dataset.action));
    });
  }

  function onTravel(targetId) {
    if (!A.Travel.canTravelTo(targetId)) return;
    A.Travel.travel(targetId);
  }

  function onNpc(npcId) {
    A.State.openModal('npc', { npcId });
  }

  function onAction(action) {
    if (action === 'rest') {
      A.State.fullRest();
      A.State.addChronicle({ type: 'rest', text: 'Descansaste. Recuperaste salud y maná.' });
    } else if (action === 'explore') {
      // En Fase 1 explorar es un placeholder con mensaje. Fase 2 dispara combate.
      A.State.addChronicle({
        type: 'note',
        text: 'Recorriste la zona pero no encontraste nada nuevo. (Combate llega en Fase 2.)',
      });
      // Re-render para que se vea reflejada la crónica si está en esa tab
    }
  }

  const WorldView = {
    mount(container) {
      mainEl = container;
      render();
    },
    unmount() {
      if (mainEl) mainEl.innerHTML = '';
    },
  };

  A.Views = A.Views || {};
  A.Views.World = WorldView;
})(window.Aventurs);
