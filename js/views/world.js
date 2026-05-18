/* ============================================================
   Aventurs — View: World (Tab Mundo)

   Cambios v1.1.0:
     - Botón "+X" criaturas abre modal con todas las criaturas de la región.
     - Botón "Viajar" inicia viaje progresivo via Travel.start.
     - Si hay viaje en curso, muestra panel especial con barra de progreso
       y botones "Continuar" / "Volver".
   ============================================================ */

(function (A) {
  'use strict';

  let mainEl = null;

  // v1.7.0: timer del modo auto/rápido
  let autoStepTimer = null;
  let autoStepDelay = 2000; // ms entre pasos en modo auto

  function clearAutoStepTimer() {
    if (autoStepTimer) {
      clearTimeout(autoStepTimer);
      autoStepTimer = null;
    }
  }

  /**
   * v1.7.0: Inicia el timer de auto-step si el modo es 'auto' o 'fast'.
   * Pausa automáticamente al aparecer un evento que requiere decisión.
   */
  function scheduleAutoStep() {
    clearAutoStepTimer();
    const t = A.State.traveling;
    if (!t || t.completed) return;
    const mode = (A.State.prefs && A.State.prefs.travelMode) || 'manual';
    if (mode === 'manual') return;

    // No avanzar si hay evento sin resolver
    const lastEvent = t.events[t.events.length - 1];
    if (lastEvent && lastEvent.kind === 'creature' && !lastEvent.resolved) return;

    const delay = mode === 'fast' ? 500 : 2000; // rápido = 500ms, auto = 2s
    autoStepDelay = delay;
    autoStepTimer = setTimeout(() => {
      autoStepTimer = null;
      const stillTraveling = A.State.traveling && !A.State.traveling.completed;
      if (!stillTraveling) return;
      const result = A.Travel.step();
      // Re-render
      render();
      // Encadenar siguiente paso si corresponde
      if (result && result.ok) scheduleAutoStep();
    }, delay);
  }

  function setTravelMode(mode) {
    if (!['manual', 'auto', 'fast'].includes(mode)) return;
    A.State.prefs = A.State.prefs || {};
    A.State.prefs.travelMode = mode;
    A.State.persist();
    if (mode === 'manual') {
      clearAutoStepTimer();
    } else {
      scheduleAutoStep();
    }
  }

  function render() {
    if (!mainEl) return;
    const w = A.State.world;
    if (!w) { mainEl.innerHTML = ''; return; }

    // Si hay viaje en curso: render del panel de viaje
    if (A.State.traveling && !A.State.traveling.completed) {
      renderTraveling();
      return;
    }

    const region = A.Data.getById('regions', w.regionId);
    if (!region) {
      mainEl.innerHTML = `<div class="empty-tab">Región desconocida.</div>`;
      return;
    }

    const npcs = region.type === 'safe' ? A.Data.npcsInRegion(region.id) : [];
    const enemies = A.Data.enemiesInRegion(region.id);
    const neighbors = A.Travel.neighbors();
    const isCombatRegion = region.type === 'combat';
    const isSafeRegion = region.type === 'safe';

    // Total de encuentros aquí
    const encountersHere = A.State.encountersInRegion ? A.State.encountersInRegion(region.id) : 0;

    mainEl.innerHTML = `
      <section class="world-view">

        <header class="region-hero ${isSafeRegion ? 'is-safe' : 'is-combat'}">
          <div class="region-hero-icon">${region.icon || '📍'}</div>
          <div class="region-hero-info">
            <div class="region-hero-name">${A.Utils.escapeHtml(region.name)}</div>
            <div class="region-hero-meta">
              <span class="pill ${isSafeRegion ? 'pill-safe' : 'pill-combat'}">
                ${isSafeRegion ? 'Zona segura' : 'Zona de combate'}
              </span>
              <span class="pill pill-tier">Tier ${region.tier[0]}–${region.tier[1]}</span>
              <span class="dim">${biomeLabel(region.biome)}</span>
              ${encountersHere > 0 ? `<span class="dim">· ${encountersHere} encuentros aquí</span>` : ''}
            </div>
            <p class="region-hero-desc">${A.Utils.escapeHtml(region.description)}</p>
          </div>
        </header>

        <section class="action-grid-main">
          ${isCombatRegion ? `
            <button class="action-card-main" data-action="explore">
              <div class="action-card-icon">🔎</div>
              <div class="action-card-text">
                <div class="action-card-label">Explorar</div>
                <div class="action-card-desc">Buscar criaturas, tesoros y eventos.</div>
              </div>
            </button>
          ` : ''}
          <button class="action-card-main" data-action="rest">
            <div class="action-card-icon">🌙</div>
            <div class="action-card-text">
              <div class="action-card-label">Descansar</div>
              <div class="action-card-desc">${isSafeRegion ? 'Recupera salud completa.' : 'Recupera 50% de salud al raso.'}</div>
            </div>
          </button>
          ${neighbors.length > 0 ? `
            <button class="action-card-main" data-action="open-travel">
              <div class="action-card-icon">🗺️</div>
              <div class="action-card-text">
                <div class="action-card-label">Viajar</div>
                <div class="action-card-desc">${neighbors.length} ${neighbors.length === 1 ? 'destino disponible' : 'destinos disponibles'}.</div>
              </div>
            </button>
          ` : ''}
          ${isSafeRegion && npcs.some((n) => n.role === 'blacksmith') ? `
            <button class="action-card-main" data-action="open-craft">
              <div class="action-card-icon">⚒️</div>
              <div class="action-card-text">
                <div class="action-card-label">Crafteo</div>
                <div class="action-card-desc">Hay un herrero acá. Podés forjar objetos.</div>
              </div>
            </button>
          ` : ''}
        </section>

        ${npcs.length ? `
          <section class="region-block">
            <div class="block-title">Habitantes</div>
            <div class="npc-grid">
              ${npcs.map((n) => npcCard(n)).join('')}
            </div>
          </section>
        ` : ''}

        ${isCombatRegion && enemies.length ? `
          <section class="region-block">
            <div class="block-title">Criaturas que merodean</div>
            <div class="creature-strip">
              ${enemies.slice(0, 8).map((e) => `
                <button class="creature-chip" data-creature="${A.Utils.escapeHtml(e.id)}" title="${A.Utils.escapeHtml(e.name)} · Tier ${e.tier} · ${e.category}">
                  <span class="creature-icon">${e.icon || '👹'}</span>
                  <span>${A.Utils.escapeHtml(e.name)}</span>
                </button>
              `).join('')}
              ${enemies.length > 8 ? `
                <button class="creature-chip is-overflow" data-show-all="${A.Utils.escapeHtml(region.id)}">
                  <span>+${enemies.length - 8}</span>
                </button>
              ` : ''}
            </div>
          </section>
        ` : ''}

      </section>
    `;

    bindEvents();
  }

  /**
   * v1.7.0: Selector de modo de viaje (manual / auto / fast)
   */
  function renderTravelModeSelector() {
    const mode = (A.State.prefs && A.State.prefs.travelMode) || 'manual';
    const isAuto = mode === 'auto' || mode === 'fast';
    return `
      <div class="travel-mode-selector ${isAuto ? 'is-active' : ''}" role="group" aria-label="Modo de viaje">
        <button type="button" class="travel-mode-btn ${mode === 'manual' ? 'is-selected' : ''}" data-travel-mode="manual" title="Manual: avanzás vos haciendo click">
          <span class="travel-mode-icon">👣</span>
          <span class="travel-mode-label">Manual</span>
        </button>
        <button type="button" class="travel-mode-btn ${mode === 'auto' ? 'is-selected' : ''}" data-travel-mode="auto" title="Auto: avanza solo cada 2s, pausa en eventos">
          <span class="travel-mode-icon">▶️</span>
          <span class="travel-mode-label">Auto</span>
        </button>
        <button type="button" class="travel-mode-btn ${mode === 'fast' ? 'is-selected' : ''}" data-travel-mode="fast" title="Rápido: avanza solo cada 0.5s">
          <span class="travel-mode-icon">⏩</span>
          <span class="travel-mode-label">Rápido</span>
        </button>
      </div>
    `;
  }

  function renderTraveling() {
    const t = A.State.traveling;
    const fromR = A.Data.getById('regions', t.fromId);
    const toR = A.Data.getById('regions', t.toId);
    const pctNum = Math.round((t.currentStep / t.totalSteps) * 100);
    const lastEvent = t.events[t.events.length - 1] || null;

    // Si último evento es una criatura sin resolver, ofrecer opciones
    const pending = lastEvent && lastEvent.kind === 'creature' && !lastEvent.resolved;

    // v1.6.9: bioma del destino para temática visual
    const targetBiome = (toR && toR.biome) || 'plains';

    mainEl.innerHTML = `
      <section class="travel-view travel-view-v2 travel-biome-${targetBiome}">
        <header class="travel-header-v2">
          <div class="travel-route-v2">
            <div class="travel-endpoint travel-endpoint-from">
              <div class="travel-endpoint-icon">${fromR ? fromR.icon : '📍'}</div>
              <div class="travel-endpoint-name">${A.Utils.escapeHtml(fromR ? fromR.name : t.fromId)}</div>
              <div class="travel-endpoint-label dim">Origen</div>
            </div>
            ${renderRoutePath(t)}
            <div class="travel-endpoint travel-endpoint-to">
              <div class="travel-endpoint-icon">${toR ? toR.icon : '📍'}</div>
              <div class="travel-endpoint-name">${A.Utils.escapeHtml(toR ? toR.name : t.toId)}</div>
              <div class="travel-endpoint-label dim">Destino</div>
            </div>
          </div>
          <div class="travel-progress-v2">
            <span class="travel-progress-step">Paso ${t.currentStep} de ${t.totalSteps}</span>
            ${renderTravelModeSelector()}
            <span class="travel-progress-pct num">${pctNum}%</span>
          </div>
        </header>

        <div class="travel-body-v2">
          <main class="travel-stage-v2">
            ${pending ? renderEncounter(lastEvent) : renderTravelStage(t, lastEvent)}
          </main>
          <aside class="travel-log-v2">
            <div class="travel-log-header">
              <span class="travel-log-title">📖 Bitácora</span>
              <span class="travel-log-count dim">${t.events.length} evento${t.events.length === 1 ? '' : 's'}</span>
            </div>
            <div class="travel-log-list">
              ${t.events.length === 0
                ? `<div class="travel-log-empty muted">Acabás de salir. Avanzá para empezar la bitácora.</div>`
                : t.events.slice().reverse().map(eventLogRow).join('')}
            </div>
          </aside>
        </div>
      </section>
    `;

    bindTravelEvents();

    // v1.7.0: si el modo es auto/fast, programar el próximo paso
    scheduleAutoStep();
  }

  /**
   * v1.6.9: Ruta visual con hitos (SVG path con marker de avance)
   */
  function renderRoutePath(t) {
    const totalSteps = t.totalSteps || 1;
    const currentStep = t.currentStep || 0;
    const pctNum = (currentStep / totalSteps) * 100;
    // Generar nodos cada cierta cantidad de pasos (max 5 hitos visuales)
    const numCheckpoints = Math.min(5, Math.max(2, Math.floor(totalSteps / 3)));
    const checkpoints = [];
    for (let i = 1; i < numCheckpoints; i++) {
      const stepAt = Math.round((totalSteps / numCheckpoints) * i);
      checkpoints.push({
        x: (i / numCheckpoints) * 100,
        passed: currentStep >= stepAt,
      });
    }
    return `
      <div class="travel-route-path">
        <div class="travel-route-line">
          <div class="travel-route-line-fill" style="width: ${pctNum}%"></div>
          ${checkpoints.map((cp) => `
            <div class="travel-route-checkpoint ${cp.passed ? 'is-passed' : ''}" style="left: ${cp.x}%">
              <span class="travel-route-checkpoint-dot"></span>
            </div>
          `).join('')}
          <div class="travel-route-marker" style="left: ${pctNum}%" title="Tu posición">
            <span class="travel-route-marker-icon">🚶</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * v1.6.9: Stage central del viaje. Si hay último evento, lo muestra grande;
   * si no, muestra el botón "Avanzar" prominente.
   */
  function renderTravelStage(t, lastEvent) {
    const stageContent = lastEvent
      ? renderStageEvent(lastEvent)
      : `
        <div class="travel-stage-empty">
          <div class="travel-stage-icon">🌅</div>
          <div class="travel-stage-title">El camino te espera</div>
          <div class="travel-stage-desc dim">Cada paso te acerca al destino. ¿Qué encontrarás?</div>
        </div>
      `;
    // v1.7.0: si está en modo auto/fast, mostrar indicador de progresión automática
    const mode = (A.State.prefs && A.State.prefs.travelMode) || 'manual';
    const autoIndicator = (mode === 'auto' || mode === 'fast')
      ? `<div class="travel-auto-indicator is-${mode}">
           <span class="travel-auto-dot"></span>
           <span class="travel-auto-text">${mode === 'fast' ? '⏩ Avanzando rápido...' : '▶️ Avanzando solo...'}</span>
         </div>`
      : '';
    return `
      <div class="travel-stage-content">
        ${stageContent}
        ${autoIndicator}
      </div>
      <div class="travel-actions-v2">
        <button class="btn-primary btn-travel-step" data-travel-action="step" ${mode !== 'manual' ? 'title="Avanzar manualmente (cancela auto)"' : ''}>
          <span class="btn-icon">👣</span>
          <span>Avanzar${mode !== 'manual' ? ' ahora' : ''}</span>
        </button>
        <button class="btn-ghost" data-travel-action="cancel">Volver al origen</button>
      </div>
    `;
  }

  /**
   * v1.6.9: Renderiza el último evento como una "tarjeta de stage" grande.
   */
  function renderStageEvent(ev) {
    const k = ev.kind || 'narrative';
    const themeMap = {
      narrative: { icon: ev.icon || '✨', cls: 'is-narrative', title: 'Algo en el camino' },
      minor_loot: { icon: '💰', cls: 'is-loot', title: '¡Encontraste algo!' },
      biome_loot: { icon: ev.icon || '🎁', cls: 'is-biome-loot', title: 'Hallazgo del bioma' },
      creature: { icon: ev.icon || '👹', cls: 'is-creature', title: 'Encuentro' },
      treasure: { icon: '🎁', cls: 'is-loot', title: 'Tesoro' },
      damage: { icon: '⚠️', cls: 'is-danger', title: 'Peligro' },
      heal: { icon: '💚', cls: 'is-heal', title: 'Buen presagio' },
    };
    const theme = themeMap[k] || themeMap.narrative;
    return `
      <div class="travel-stage-card ${theme.cls}">
        <div class="travel-stage-card-icon">${theme.icon}</div>
        <div class="travel-stage-card-content">
          <div class="travel-stage-card-title">${theme.title}</div>
          <div class="travel-stage-card-text">${A.Utils.escapeHtml(ev.text || '')}</div>
        </div>
      </div>
    `;
  }

  /**
   * v1.6.9: Fila de bitácora (más compacta que la stage, ordenada por inverso)
   */
  function eventLogRow(e) {
    const icons = {
      minor_loot: '💰', biome_loot: e.icon || '🎁',
      creature: '👹', narrative: e.icon || '✨', nothing: '·',
      treasure: '🎁', damage: '⚠️', heal: '💚',
    };
    return `
      <div class="travel-log-row">
        <span class="travel-log-icon">${icons[e.kind] || (e.icon || '·')}</span>
        <span class="travel-log-text">${A.Utils.escapeHtml(e.text || '...')}</span>
      </div>
    `;
  }

  function renderEncounter(ev) {
    const enemy = A.Data.getById('enemies', ev.enemyId);
    const isGroup = (ev.enemies || []).length > 1;
    const groupSize = (ev.enemies || []).length;
    return `
      <div class="travel-encounter travel-encounter-v2">
        <div class="encounter-header">
          <div class="encounter-icon-big">${ev.icon || '👹'}</div>
          <div class="encounter-header-text">
            <div class="encounter-title-v2">${isGroup ? `Aparecieron ${groupSize} enemigos` : `Apareció ${A.Utils.escapeHtml(ev.enemyName)}`}</div>
            <div class="encounter-meta-v2">
              ${isGroup ? `<span class="dim">${A.Utils.escapeHtml(ev.enemyName)}</span>` : `
                <span class="pill pill-tier">Tier ${ev.tier}</span>
                <span class="pill pill-cat-${ev.category || 'normal'}">${categoryLabel(ev.category)}</span>
                ${ev.tameable ? `<span class="pill pill-tameable">🐾 Domable</span>` : ''}
              `}
            </div>
          </div>
        </div>
        <p class="encounter-desc-v2">${isGroup
          ? 'Vienen juntos por el camino. Mejor decidir rápido.'
          : (enemy && enemy.tameable
            ? 'Te observa con curiosidad. Quizás puedas acercarte sin pelear.'
            : 'No parece dispuesto a parlamentar.')}</p>
        <div class="encounter-actions-v2">
          <button class="btn-primary encounter-btn-fight" data-travel-action="fight" data-enemy-id="${A.Utils.escapeHtml(ev.enemyId)}">
            <span class="btn-icon">⚔️</span>
            <span>Pelear</span>
          </button>
          ${!isGroup && enemy && enemy.tameable && !A.State.player.pet ? `
            <button class="btn-secondary encounter-btn-tame" data-travel-action="tame" data-enemy-id="${A.Utils.escapeHtml(ev.enemyId)}">
              <span class="btn-icon">🐾</span>
              <span>Intentar domar</span>
            </button>
          ` : ''}
          ${(() => {
            const odds = calculateAvoidOdds(ev);
            return `<button class="btn-ghost encounter-btn-avoid" data-travel-action="avoid" title="D20+${odds.speedBonus} vs DC ${odds.dc}">
              <span class="btn-icon">💨</span>
              <span>Evitar (${odds.chancePct}%)</span>
            </button>`;
          })()}
        </div>
      </div>
    `;
  }

  /**
   * v1.6.4: Calcula la dificultad de evitar un encuentro.
   * Devuelve { dc, bonus, chancePct } donde:
   *   - dc: dificultad a superar (8-18 según peligro)
   *   - bonus: D20 + (speed/4) + ajustes de hambre/noche/peso
   *   - chancePct: probabilidad estimada de éxito
   */
  function calculateAvoidOdds(event) {
    const p = A.State.player;
    if (!p) return { dc: 10, bonus: 0, chancePct: 50 };

    // DC base por peligro: tier máximo del enemigo
    let dc = 8;
    let enemies = (event && Array.isArray(event.enemies) && event.enemies.length > 0)
      ? event.enemies
      : (event && event.enemyId ? [{ tier: (A.Data.getById('enemies', event.enemyId) || {}).tier || 1 }] : []);
    const maxTier = enemies.reduce((acc, e) => Math.max(acc, e.tier || 1), 1);
    dc = 8 + Math.min(10, maxTier - 1);

    // Más enemigos = más difícil
    if (enemies.length > 1) dc += (enemies.length - 1) * 2;

    // Modificador por hambre (Survival.weak/starving)
    if (A.Survival) {
      const status = A.Survival.getStatus();
      if (status.id === 'weak') dc += 1;
      if (status.id === 'starving') dc += 2;
    }

    // Modificador nocturno
    if (A.Time && A.Time.isNight()) dc += 1;

    // Bonus del jugador: D20 promedio (10.5) + speed/4
    const speed = (p.stats && p.stats.speed) || 10;
    const speedBonus = Math.floor(speed / 4);

    // Probabilidad: P(D20 + speedBonus >= dc) = (21 - (dc - speedBonus)) / 20
    const need = Math.max(1, dc - speedBonus);
    const successOutcomes = Math.max(0, Math.min(20, 21 - need));
    const chancePct = Math.round((successOutcomes / 20) * 100);

    return { dc, speedBonus, chancePct };
  }

  /**
   * v1.6.4: Tirada de D20 + speedBonus contra dc. Devuelve resultado.
   */
  function rollAvoid(event) {
    const odds = calculateAvoidOdds(event);
    const roll = 1 + Math.floor(Math.random() * 20);
    const total = roll + odds.speedBonus;
    const success = total >= odds.dc;
    return { roll, speedBonus: odds.speedBonus, total, dc: odds.dc, success };
  }

  function eventRow(e) {
    const icons = {
      minor_loot: '💰', creature: '👹', narrative: '✨', nothing: '·',
    };
    const cls = e.kind === 'creature' ? 'is-creature' : '';
    return `
      <div class="travel-event ${cls}">
        <span class="travel-event-icon">${icons[e.kind] || '·'}</span>
        <span class="travel-event-text">${A.Utils.escapeHtml(e.text || '...')}</span>
      </div>
    `;
  }

  // ---------- Helpers de render ----------

  function npcCard(n) {
    return `
      <button class="npc-card" data-npc="${n.id}">
        <div class="npc-icon">${n.icon || '🧑'}</div>
        <div class="npc-info">
          <div class="npc-name">${A.Utils.escapeHtml(n.name)}</div>
          <div class="npc-role dim">${roleLabel(n.role)}</div>
        </div>
      </button>
    `;
  }

  function travelCard(n) {
    const dangerLabel = n.type === 'safe' ? 'Seguro' : 'Combate';
    const dangerClass = n.type === 'safe' ? 'pill-safe' : 'pill-combat';
    const enemiesCount = A.Data.enemiesInRegion(n.id).length;
    const dist = n.distance || 1;
    const travelCheck = A.Travel.canTravelToDetailed(n.id);
    const locked = !travelCheck.ok && travelCheck.locked;
    const cls = `travel-card ${locked ? 'is-locked' : ''}`;
    return `
      <button class="${cls}" data-travel="${n.id}" ${locked ? 'data-locked="1"' : ''}>
        <div class="travel-icon">${n.icon || '📍'}</div>
        <div class="travel-info">
          <div class="travel-name">${A.Utils.escapeHtml(n.name)}</div>
          <div class="travel-meta">
            <span class="pill ${dangerClass}">${dangerLabel}</span>
            <span class="pill pill-tier">T${n.tier[0]}–${n.tier[1]}</span>
            <span class="dim">${dist === 1 ? 'Cerca' : dist === 2 ? 'Medio camino' : 'Lejos'}</span>
            ${enemiesCount ? `<span class="dim">· ${enemiesCount} criaturas</span>` : ''}
          </div>
          ${locked ? `<div class="travel-locked-msg">🔒 Necesitas ${travelCheck.required} encuentros completados (llevás ${travelCheck.have}).</div>` : ''}
        </div>
        <div class="travel-arrow dim">${locked ? '🔒' : '→'}</div>
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

  function categoryLabel(c) {
    return ({ weak: 'Débil', normal: 'Normal', strong: 'Fuerte', boss: 'Jefe' })[c] || c;
  }

  // ---------- Bindings ----------

  function bindEvents() {
    mainEl.querySelectorAll('[data-travel]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.locked === '1') {
          onTravelLocked(btn.dataset.travel);
        } else {
          onTravel(btn.dataset.travel);
        }
      });
    });
    mainEl.querySelectorAll('[data-npc]').forEach((btn) => {
      btn.addEventListener('click', () => A.State.openModal('npc', { npcId: btn.dataset.npc }));
    });
    mainEl.querySelectorAll('[data-creature]').forEach((btn) => {
      btn.addEventListener('click', () => A.State.openModal('creature', { enemyId: btn.dataset.creature }));
    });
    mainEl.querySelectorAll('[data-show-all]').forEach((btn) => {
      btn.addEventListener('click', () => A.State.openModal('all-creatures', { regionId: btn.dataset.showAll }));
    });
    mainEl.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => onAction(btn.dataset.action));
    });
  }

  function bindTravelEvents() {
    // v1.7.0: bind del selector de modo
    mainEl.querySelectorAll('[data-travel-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.travelMode;
        setTravelMode(mode);
        render(); // re-render para actualizar el selector visual
      });
    });

    mainEl.querySelectorAll('[data-travel-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        // v1.7.0: cualquier acción manual cancela el timer de auto
        clearAutoStepTimer();
        const action = btn.dataset.travelAction;
        if (action === 'step') {
          A.Travel.step();
          // Re-render se hace via Bus, pero también iniciamos próximo auto-step
          setTimeout(scheduleAutoStep, 100);
        } else if (action === 'cancel') {
          A.Travel.cancel();
        } else if (action === 'avoid') {
          // v1.6.4: Evitar requiere tirada D20+speedBonus vs DC del encuentro
          const t = A.State.traveling;
          const last = t.events[t.events.length - 1];
          if (last && last.kind === 'creature') {
            const result = rollAvoid(last);
            const enemyName = last.enemyName || 'al enemigo';
            if (result.success) {
              last.resolved = true;
              last.text = `Evitaste a ${enemyName} (D20=${result.roll}+${result.speedBonus} ≥ ${result.dc}).`;
              A.State.addChronicle({
                type: 'travel',
                text: `Intentaste evitar a ${enemyName}. D20=${result.roll}+${result.speedBonus} vs DC ${result.dc}. Lo lograste.`,
              });
              A.State.persist();
              A.Travel.step();
            } else {
              // Fallaste: combate empieza con desventaja (enemigos atacan primero)
              last.resolved = true;
              last.text = `Te detectaron al intentar evitar a ${enemyName}.`;
              A.State.addChronicle({
                type: 'travel',
                text: `Intentaste evitar a ${enemyName}. D20=${result.roll}+${result.speedBonus} vs DC ${result.dc}. Falla. El combate empieza con desventaja.`,
              });
              A.State.persist();
              if (last.enemies && last.enemies.length > 0) {
                A.Combat.start({ enemies: last.enemies, fromTravel: true, ambush: true });
              } else {
                A.Combat.start({ enemyId: btn.dataset.enemyId || last.enemyId, fromTravel: true, ambush: true });
              }
            }
          } else {
            // Fallback: si no hay enemigo, simplemente avanzar
            A.State.persist();
            A.Travel.step();
          }
        } else if (action === 'tame') {
          A.State.openModal('tame', { enemyId: btn.dataset.enemyId, fromTravel: true });
        } else if (action === 'fight') {
          const t = A.State.traveling;
          const last = t.events[t.events.length - 1];
          if (last && last.kind === 'creature') {
            last.resolved = true;
            last.text = `Peleaste contra ${last.enemyName}.`;
          }
          A.State.persist();
          // Si el evento trae enemies[] (grupo), usar esos; si no, fallback a enemyId individual
          if (last && Array.isArray(last.enemies) && last.enemies.length > 0) {
            A.Combat.start({ enemies: last.enemies, fromTravel: true });
          } else {
            A.Combat.start({ enemyId: btn.dataset.enemyId, fromTravel: true });
          }
        }
      });
    });
  }

  function onTravel(targetId) {
    const result = A.Travel.start(targetId);
    if (!result.ok && result.error) {
      console.warn('[Travel]', result.error);
    }
  }

  function onTravelLocked(targetId) {
    const check = A.Travel.canTravelToDetailed(targetId);
    if (check.locked) {
      // Mostrar mensaje
      A.State.openModal('confirm', {
        title: 'Región bloqueada',
        body: check.error,
      });
    }
  }

  function onAction(action) {
    if (action === 'open-travel') {
      A.State.ui.showMap = true;
      A.Bus.emit('view:changed');
      return;
    }
    if (action === 'open-craft') {
      // Si hay un herrero en la región, abrir su craft. Si no, mostrar info.
      const region = A.Data.getById('regions', A.State.world.regionId);
      const npcs = A.Data.npcsInRegion(region.id);
      const blacksmith = npcs.find((n) => n.role === 'blacksmith');
      if (blacksmith) {
        A.State.openModal('npc', { npcId: blacksmith.id, tab: 'craft' });
      } else {
        A.State.addChronicle({ type: 'note', text: 'Acá no hay herrero. Buscá uno en otro pueblo.' });
      }
      return;
    }
    if (action === 'rest') {
      // v1.5.9: Descansar solo es posible de noche
      if (A.Time && !A.Time.canRest()) {
        A.State.addChronicle({
          type: 'note',
          text: 'No podés descansar a plena luz del día. Esperá a que caiga la noche.',
        });
        return;
      }
      // Descanso al raso: solo +50% HP, sin maná ni food
      const p = A.State.player;
      let healMult = 0.5;
      // v1.6.2: si tenés hambre severa, no descansás bien
      if (A.Survival) {
        const status = A.Survival.getStatus();
        if (status.penalties.restPenalty) {
          healMult = status.id === 'starving' ? 0.1 : 0.25;
        }
      }
      const heal = Math.floor(p.maxHp * healMult);
      const before = p.hp;
      A.State.healHp(heal);
      const recovered = p.hp - before;
      let restNote = `Descansaste durante la noche. +${recovered} salud.`;
      if (A.Survival && A.Survival.getStatus().penalties.restPenalty) {
        restNote += ` Tu hambre te impide descansar bien.`;
      }
      A.State.addChronicle({ type: 'rest', text: restNote });
      // Avanzar el tiempo hasta la mañana del día siguiente
      if (A.Time) A.Time.passTo('day');
    } else if (action === 'explore') {
      const region = A.Data.getById('regions', A.State.world.regionId);
      // v1.5.9: explorar avanza 1 unidad de tiempo
      if (A.Time) A.Time.advance(1, 'explore');
      // v1.6.2: explorar consume hambre cada 2 acciones (no cada acción)
      if (A.Survival && A.State.player) {
        A.State.player._exploreCounter = (A.State.player._exploreCounter || 0) + 1;
        if (A.State.player._exploreCounter % 2 === 0) {
          A.Survival.applyTurnTick('explore');
        }
      }
      // Primero probar eventos custom de la región
      if (region && Array.isArray(region.events) && region.events.length > 0) {
        for (const ev of region.events) {
          if (Math.random() * 100 < (ev.chance || 0)) {
            executeRegionEventInline(ev);
            return;
          }
        }
      }
      // v1.6.4: balance rebalanceado a favor de eventos pacíficos
      // 35% combate, 65% pacífico (rastros, monedas, observación, recursos, hallazgos)
      const r = Math.random();
      if (r < 0.35) {
        // Combate (antes era 60%)
        const group = A.Encounter.generate(A.State.world.regionId);
        if (group && group.length > 0) {
          const desc = A.Encounter.describeGroup(group);
          A.State.addChronicle({ type: 'note', text: `Te encontraste con ${desc} mientras explorabas.` });
          A.Combat.start({ enemies: group, fromTravel: false });
          return;
        }
        A.State.addChronicle({ type: 'note', text: 'Recorriste la zona pero no encontraste nada.' });
      } else if (r < 0.50) {
        // 15%: monedas escondidas
        const coins = 3 + Math.floor(Math.random() * 12);
        A.State.addItem('coin_copper', coins);
        A.State.addChronicle({ type: 'loot', text: `Encontraste ${coins} monedas de cobre escondidas.` });
      } else if (r < 0.62) {
        // 12%: criatura observando desde lejos (no combate)
        const peacefulMessages = [
          'Viste un ciervo pasar entre los árboles. Te observa un instante y desaparece.',
          'Una sombra se mueve a lo lejos. Algo te observa, pero no se acerca.',
          'Un pájaro graznó al verte. Voló al horizonte sin más.',
          'Escuchaste pasos cerca. Cuando miraste, ya no había nadie.',
          'Una criatura desconocida cruzó el camino. No quiso pelear.',
        ];
        A.State.addChronicle({ type: 'note', text: peacefulMessages[Math.floor(Math.random() * peacefulMessages.length)] });
      } else if (r < 0.74) {
        // 12%: rastros / signos
        const trackMessages = [
          'Encontraste huellas frescas en el suelo. Algo grande pasó hace poco.',
          'Marcas de garras en un árbol. Algún animal marcó territorio.',
          'Una fogata apagada con cenizas tibias. Alguien estuvo acá hace horas.',
          'Restos de un campamento abandonado. Nada útil quedó.',
          'Plumas raras esparcidas por el suelo. ¿Pelea de aves?',
        ];
        A.State.addChronicle({ type: 'note', text: trackMessages[Math.floor(Math.random() * trackMessages.length)] });
      } else if (r < 0.86) {
        // 12%: v1.7.1: recurso del bioma de la región actual (usa el mismo pool de travel)
        const region = A.Data.getById('regions', A.State.world.regionId);
        const biomeResult = A.Travel.resolveBiomeLootStandalone
          ? A.Travel.resolveBiomeLootStandalone(region)
          : null;
        if (biomeResult && biomeResult.kind === 'biome_loot') {
          A.State.addChronicle({ type: 'loot', text: biomeResult.text });
        } else if (biomeResult && biomeResult.kind === 'narrative') {
          // Mochila llena
          A.State.addChronicle({ type: 'note', text: biomeResult.text });
        } else {
          // Fallback: item genérico
          const resourceItems = ['pan', 'queso', 'manzana', 'fruta_silvestre', 'hierba_curativa'];
          const validItems = resourceItems.filter((id) => A.Data.getById('items', id));
          if (validItems.length > 0) {
            const itemId = validItems[Math.floor(Math.random() * validItems.length)];
            const item = A.Data.getById('items', itemId);
            const ok = A.State.addItem(itemId, 1);
            if (ok) A.State.addChronicle({ type: 'loot', text: `Encontraste ${item.icon || ''} ${item.name} en el camino.` });
            else A.State.addChronicle({ type: 'note', text: 'Encontraste algo útil pero no entró en tu mochila.' });
          } else {
            A.State.addChronicle({ type: 'note', text: 'Recorriste la zona, sin novedad.' });
          }
        }
      } else {
        // 14%: nada útil (viento, paisaje, etc)
        const idleMessages = [
          'Solo el viento entre los árboles. Recorriste la zona en silencio.',
          'Caminaste un buen rato. Nada que destacar.',
          'El paisaje sigue igual. No hay novedades.',
          'Un día tranquilo. Nada que reportar.',
        ];
        A.State.addChronicle({ type: 'note', text: idleMessages[Math.floor(Math.random() * idleMessages.length)] });
      }
    }
  }

  function executeRegionEventInline(ev) {
    if (ev.type === 'treasure') {
      const amount = A.Utils.rollDice(ev.amount || '1d10');
      A.Currency.add(amount);
      A.State.addChronicle({ type: 'loot', text: `Encontraste ${A.Currency.formatPrice(amount)} escondidos.` });
    } else if (ev.type === 'find' && ev.reward) {
      const item = A.Data.getById('items', ev.reward) ||
                   A.Data.getById('weapons', ev.reward) ||
                   A.Data.getById('armors', ev.reward);
      if (item && A.State.addItem(ev.reward, 1)) {
        A.State.addChronicle({ type: 'loot', text: `Encontraste: ${item.name}.` });
      }
    } else if (ev.type === 'damage') {
      const dmg = A.Utils.rollDice(ev.amount || '1d4');
      A.State.damagePlayer(dmg);
      const flavor = ev.effect || 'Algo te lastimó';
      A.State.addChronicle({ type: 'note', text: `${flavor}. -${dmg} de salud.` });
    } else if (ev.type === 'heal') {
      const amount = A.Utils.rollDice(ev.amount || '1d6');
      A.State.healHp(amount);
      A.State.addChronicle({ type: 'rest', text: `Algo te reconfortó. +${amount} de salud.` });
    }
  }

  const WorldView = {
    mount(container) {
      mainEl = container;
      render();
    },
    unmount() {
      // v1.7.0: limpiar timer de auto-step al cambiar de vista
      clearAutoStepTimer();
      if (mainEl) mainEl.innerHTML = '';
    },
  };

  A.Views = A.Views || {};
  A.Views.World = WorldView;
})(window.Aventurs);
