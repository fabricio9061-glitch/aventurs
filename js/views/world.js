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
    // v1.8.0: nunca avanzar el viaje solo mientras hay un combate o un modal abierto
    if (A.State.combat || (A.State.ui && A.State.ui.openModal)) return;
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
      if (!stillTraveling || A.State.combat) return;
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

  // ---------- v2.0: el resultado de la última acción (descansar) ----------
  let lastNote = null;

  function icon(name, size, cls) { return A.UI ? A.UI.icon(name, size, cls) : ''; }
  function esc(s) { return A.Utils.escapeHtml(String(s == null ? '' : s)); }

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

    const npcs = A.Data.npcsInRegion(region.id);
    const enemies = A.Data.enemiesInRegion(region.id);
    const neighbors = A.Travel.neighbors();
    const isCombatRegion = region.type === 'combat';
    const isSafeRegion = region.type === 'safe';
    const night = A.Time ? A.Time.isNight() : false;
    const p = A.State.player;
    const minLvl = (region.unlockConditions && region.unlockConditions.minLevel) || 1;
    const todo = questsHere(region);

    // v2.3: descansar afuera cura hasta un tope y después hay que moverse
    const restI = A.Explore && A.Explore.restInfo ? A.Explore.restInfo() : null;
    const restLabel = restI ? restI.label : (night ? 'Dormir' : 'Descansar');
    const restDesc = restI ? restI.desc : (night ? 'Hasta mañana.' : 'Un rato a la sombra. Pasa la tarde.');
    const restLocked = !!(restI && restI.locked);

    mainEl.innerHTML = `
      <section class="world2">
        <header class="region2 ${isSafeRegion ? 'is-safe' : 'is-danger'} biome-${esc(region.biome)}">
          <div class="region2-art">${A.UI ? A.UI.biomeIcon(region, 72) : ''}</div>
          <div class="region2-info">
            <div class="region2-kicker">
              <span class="region2-tag ${isSafeRegion ? 'is-safe' : 'is-danger'}">${icon(isSafeRegion ? 'shield' : 'swords', 14)}<span>${isSafeRegion ? 'Zona segura' : 'Zona de peligro'}</span></span>
              <span class="region2-tag">Nivel ${minLvl}+</span>
              <span class="region2-tag is-soft">${esc(biomeLabel(region.biome))}</span>
            </div>
            <h1 class="region2-name">${esc(region.name)}</h1>
            <p class="region2-desc">${esc(region.description)}</p>
          </div>
        </header>

        ${lastNote ? `
          <div class="note2" role="status">
            ${icon(lastNote.icon || 'tent', 28)}
            <div class="note2-main"><p>${esc(lastNote.text)}</p>${A.UI ? A.UI.chips(lastNote.chips) : ''}</div>
            <button class="note2-x" data-note-close aria-label="Cerrar">×</button>
          </div>` : ''}

        <section class="acts2 ${isCombatRegion ? 'has-3' : 'has-2'}">
          ${isCombatRegion ? `
            <button class="act2 is-main" data-action="explore">
              <span class="act2-icon">${icon('search', 40)}</span>
              <span class="act2-text"><span class="act2-label">Explorar</span><span class="act2-desc">Siempre pasa algo: criaturas, tesoros, peligros.</span></span>
            </button>` : ''}
          <button class="act2 ${restLocked ? 'is-tired' : ''}" data-action="rest" ${restLocked ? 'aria-disabled="true"' : ''}>
            <span class="act2-icon">${icon(night ? 'moon' : 'tent', 40)}</span>
            <span class="act2-text"><span class="act2-label">${restLabel}</span><span class="act2-desc">${restDesc}</span></span>
          </button>
          ${neighbors.length > 0 ? `
            <button class="act2" data-action="open-travel">
              <span class="act2-icon">${icon('map', 40)}</span>
              <span class="act2-text"><span class="act2-label">Viajar</span><span class="act2-desc">${neighbors.length} ${neighbors.length === 1 ? 'camino' : 'caminos'} desde acá.</span></span>
            </button>` : ''}
        </section>

        ${todo.length ? `
          <section class="block2 todo2">
            <h2 class="block2-title">${icon('quest', 18)}<span>Para hacer acá</span></h2>
            <ul class="todo2-list">
              ${todo.map((t) => `<li>${icon(t.main ? 'crown' : 'scroll', 18)}<span><b>${esc(t.title)}</b> · ${esc(t.text)}</span>${t.count ? `<span class="num todo2-count">${t.count}</span>` : ''}</li>`).join('')}
            </ul>
          </section>` : ''}

        ${npcs.length ? `
          <section class="block2">
            <h2 class="block2-title">${icon('talk', 18)}<span>Habitantes</span></h2>
            <div class="npc2-grid">
              ${npcs.map((n) => npcCard(n)).join('')}
            </div>
          </section>
        ` : ''}

        ${isCombatRegion && enemies.length ? `
          <section class="block2">
            <h2 class="block2-title">${icon('skulls', 18)}<span>Criaturas de la zona</span><span class="block2-hint">El número es la dificultad del dado para pegarles</span></h2>
            <div class="creature-strip">
              ${enemies.slice(0, 8).map((e) => `
                <button class="creature-chip" data-creature="${esc(e.id)}" title="${esc(e.name)}: dificultad del dado ${e.difficulty != null ? e.difficulty : 10}">
                  <span class="creature-icon">${enemySprite(e, 32)}</span>
                  <span>${esc(e.name)}</span>
                  ${A.ItemSprites && A.ItemSprites.dcBadge ? A.ItemSprites.dcBadge(e.difficulty != null ? e.difficulty : 10, { size: 24, cls: 'creature-dc' }) : ''}
                </button>
              `).join('')}
              ${enemies.length > 8 ? `
                <button class="creature-chip is-overflow" data-show-all="${esc(region.id)}">
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

  /** Objetivos de misiones activas que se cumplen en esta zona. */
  function questsHere(region) {
    if (!A.Quests) return [];
    const out = [];
    const here = new Set(A.Data.enemiesInRegion(region.id).map((e) => e.id));
    for (const q of A.Quests.activeList()) {
      q.objectives.forEach((o, i) => {
        const pr = A.Quests.objectiveProgress(q, i);
        if (pr.done) return;
        const ids = o.type === 'kill' ? (Array.isArray(o.enemy) ? o.enemy : [o.enemy]) : [];
        const fits = (o.type === 'explore' && o.region === region.id)
          || (o.type === 'kill' && ids.some((id) => here.has(id)))
          || (o.type === 'talk' && A.Data.npcsInRegion(region.id).some((n) => n.id === o.npc));
        if (fits) out.push({ title: q.title, main: q.main, text: A.Quests.objectiveText(o), count: (o.count || 1) > 1 ? `${pr.have}/${pr.need}` : '' });
      });
    }
    return out;
  }

  /**
   * v1.7.0: Selector de modo de viaje (manual / auto / fast)
   */
  function renderTravelModeSelector() {
    const mode = (A.State.prefs && A.State.prefs.travelMode) || 'manual';
    const isAuto = mode === 'auto' || mode === 'fast';
    return `
      <div class="travel-mode-selector ${isAuto ? 'is-active' : ''}" role="group" aria-label="Modo de viaje">
        <button type="button" class="travel-mode-btn ${mode === 'manual' ? 'is-selected' : ''}" data-travel-mode="manual" title="Manual: avanzás vos">
          <span class="travel-mode-icon">${icon('boot', 16)}</span>
          <span class="travel-mode-label">Manual</span>
        </button>
        <button type="button" class="travel-mode-btn ${mode === 'auto' ? 'is-selected' : ''}" data-travel-mode="auto" title="Auto: avanza solo cada 2 segundos y frena en los encuentros">
          <span class="travel-mode-icon">${icon('hourglass', 16)}</span>
          <span class="travel-mode-label">Auto</span>
        </button>
        <button type="button" class="travel-mode-btn ${mode === 'fast' ? 'is-selected' : ''}" data-travel-mode="fast" title="Rápido: avanza solo cada medio segundo">
          <span class="travel-mode-icon">${icon('run', 16)}</span>
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
              <div class="travel-endpoint-icon">${A.UI ? A.UI.biomeIcon(fromR, 36) : ''}</div>
              <div class="travel-endpoint-name">${A.Utils.escapeHtml(fromR ? fromR.name : t.fromId)}</div>
              <div class="travel-endpoint-label dim">Origen</div>
            </div>
            ${renderRoutePath(t)}
            <div class="travel-endpoint travel-endpoint-to">
              <div class="travel-endpoint-icon">${A.UI ? A.UI.biomeIcon(toR, 36) : ''}</div>
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
              <span class="travel-log-title">${icon('book', 16)} Bitácora</span>
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
            <span class="travel-route-marker-icon">${icon('pin', 22)}</span>
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
          <div class="travel-stage-icon">${icon('compass', 48)}</div>
          <div class="travel-stage-title">El camino te espera</div>
          <div class="travel-stage-desc dim">Cada paso te acerca al destino. ¿Qué encontrarás?</div>
        </div>
      `;
    // v1.7.0: si está en modo auto/fast, mostrar indicador de progresión automática
    const mode = (A.State.prefs && A.State.prefs.travelMode) || 'manual';
    const autoIndicator = (mode === 'auto' || mode === 'fast')
      ? `<div class="travel-auto-indicator is-${mode}">
           <span class="travel-auto-dot"></span>
           <span class="travel-auto-text">${mode === 'fast' ? 'Avanzando rápido...' : 'Avanzando solo...'}</span>
         </div>`
      : '';
    return `
      <div class="travel-stage-content">
        ${stageContent}
        ${autoIndicator}
      </div>
      <div class="travel-actions-v2">
        <button class="btn-primary btn-travel-step" data-travel-action="step" ${mode !== 'manual' ? 'title="Avanzar manualmente (cancela auto)"' : ''}>
          <span class="btn-icon">${icon('boot', 20)}</span>
          <span>Avanzar${mode !== 'manual' ? ' ahora' : ''}</span>
        </button>
        <button class="btn-ghost" data-travel-action="cancel">Volver al origen</button>
      </div>
    `;
  }

  /**
   * v1.6.9: Renderiza el último evento como una "tarjeta de stage" grande.
   */
  // v2.0: cada tipo de suceso del camino con su ícono pixel
  const EVENT_ICON = {
    narrative: 'feather', minor_loot: 'coins', biome_loot: 'herb', treasure: 'chest',
    damage: 'trap', heal: 'heart', nothing: 'boot',
  };

  function eventIcon(ev, size) {
    if (ev.kind === 'creature' && ev.enemyId) return enemySprite(ev.enemyId, size);
    return icon(EVENT_ICON[ev.kind] || 'feather', size);
  }

  function renderStageEvent(ev) {
    const k = ev.kind || 'narrative';
    const themeMap = {
      narrative: { cls: 'is-narrative', title: 'Algo en el camino' },
      minor_loot: { cls: 'is-loot', title: '¡Encontraste algo!' },
      biome_loot: { cls: 'is-biome-loot', title: 'Hallazgo del camino' },
      creature: { cls: 'is-creature', title: 'Encuentro' },
      treasure: { cls: 'is-loot', title: 'Tesoro' },
      damage: { cls: 'is-danger', title: 'Peligro' },
      heal: { cls: 'is-heal', title: 'Buen presagio' },
    };
    const theme = themeMap[k] || themeMap.narrative;
    return `
      <div class="travel-stage-card ${theme.cls}">
        <div class="travel-stage-card-icon">${eventIcon(ev, 48)}</div>
        <div class="travel-stage-card-content">
          <div class="travel-stage-card-title">${theme.title}</div>
          <div class="travel-stage-card-text">${esc(ev.text || '')}</div>
        </div>
      </div>
    `;
  }

  function eventLogRow(e) {
    return `
      <div class="travel-log-row">
        <span class="travel-log-icon">${eventIcon(e, 20)}</span>
        <span class="travel-log-text">${esc(e.text || '...')}</span>
      </div>
    `;
  }

  // v1.9.0: sprites en pixel art en lugar de emojis
  function enemySprite(enemyOrId, size) {
    return A.Sprites ? A.Sprites.html(enemyOrId, { size }) : '';
  }

  function encounterSprites(ev) {
    const list = (ev.enemies && ev.enemies.length) ? ev.enemies : [ev.enemyId];
    const shown = list.slice(0, 4);
    const size = shown.length === 1 ? 72 : shown.length === 2 ? 56 : 44;
    return shown.map((x) => enemySprite(x, size)).join('') + (list.length > 4 ? `<span class="encounter-more">+${list.length - 4}</span>` : '');
  }

  function renderEncounter(ev) {
    const enemy = A.Data.getById('enemies', ev.enemyId);
    const isGroup = (ev.enemies || []).length > 1;
    const groupSize = (ev.enemies || []).length;
    return `
      <div class="travel-encounter travel-encounter-v2">
        <div class="encounter-header">
          <div class="encounter-icon-big ${isGroup ? 'is-group' : ''}">${encounterSprites(ev)}</div>
          <div class="encounter-header-text">
            <div class="encounter-title-v2">${isGroup ? `Aparecieron ${groupSize} enemigos` : `Apareció ${A.Utils.escapeHtml(ev.enemyName)}`}</div>
            <div class="encounter-meta-v2">
              ${isGroup ? `<span class="dim">${A.Utils.escapeHtml(ev.enemyName)}</span>` : `
                <span class="pill pill-tier">Nivel ${ev.tier}</span>
                <span class="pill pill-cat-${ev.category || 'normal'}">${categoryLabel(ev.category)}</span>
                ${enemy && A.ItemSprites && A.ItemSprites.dcBadge ? A.ItemSprites.dcBadge(enemy.difficulty != null ? enemy.difficulty : 10, { size: 26 }) : ''}
                ${ev.tameable ? `<span class="pill pill-tameable">${icon('paw', 14)} Domable</span>` : ''}
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
            <span class="btn-icon">${icon('swords', 20)}</span>
            <span>Pelear</span>
          </button>
          ${!isGroup && enemy && enemy.tameable && !A.State.player.pet && A.Tame && ['ok', 'missing-item'].includes(A.Tame.canTame(enemy.id).ok ? 'ok' : A.Tame.canTame(enemy.id).reason) ? `
            <button class="btn-secondary encounter-btn-tame" data-travel-action="tame" data-enemy-id="${A.Utils.escapeHtml(ev.enemyId)}">
              <span class="btn-icon">${icon('paw', 20)}</span>
              <span>Intentar domar</span>
            </button>
          ` : ''}
          ${(() => {
            const odds = calculateAvoidOdds(ev);
            return `<button class="btn-ghost encounter-btn-avoid" data-travel-action="avoid" title="D20+${odds.speedBonus} contra dificultad ${odds.dc}">
              <span class="btn-icon">${icon('run', 20)}</span>
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
    // v2.4: la velocidad real (el peso del equipo frena)
    const speed = (A.Balance && A.Balance.playerCombatStats ? A.Balance.playerCombatStats(p).speed : (p.stats && p.stats.speed)) || 10;
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
    const cls = e.kind === 'creature' ? 'is-creature' : '';
    return `
      <div class="travel-event ${cls}">
        <span class="travel-event-icon">${eventIcon(e, 18)}</span>
        <span class="travel-event-text">${A.Utils.escapeHtml(e.text || '...')}</span>
      </div>
    `;
  }

  // ---------- Helpers de render ----------

  function npcCard(n) {
    const marker = A.Quests ? A.Quests.markerFor(n.id) : null;
    const offers = [];
    if ((n.sells || []).length) offers.push('Comercia');
    if (n.role === 'blacksmith') offers.push('Forja');
    if ((n.teaches || []).length) offers.push('Enseña magia');
    if (n.services && n.services.restCost != null) offers.push('Posada');
    if (A.Quests && A.Quests.list().some((q) => q.giver === n.id)) offers.push('Encargos');
    return `
      <button class="npc2-card ${marker ? 'has-quest' : ''}" data-npc="${esc(n.id)}">
        ${A.UI ? A.UI.portrait(n, 56, marker) : ''}
        <span class="npc2-card-info">
          <span class="npc2-card-name">${esc(n.name)}</span>
          <span class="npc2-card-role">${esc(n.roleName || roleLabel(n.role))}</span>
          ${offers.length ? `<span class="npc2-card-offers">${esc(offers.join(' · '))}</span>` : ''}
        </span>
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
        <div class="travel-icon">${A.UI ? A.UI.biomeIcon(n, 28) : ''}</div>
        <div class="travel-info">
          <div class="travel-name">${A.Utils.escapeHtml(n.name)}</div>
          <div class="travel-meta">
            <span class="pill ${dangerClass}">${dangerLabel}</span>
            <span class="pill pill-tier">Nivel ${n.tier[0]}${n.tier[1] !== n.tier[0] ? `–${n.tier[1]}` : ''}</span>
            <span class="dim">${dist === 1 ? 'Cerca' : dist === 2 ? 'Medio camino' : 'Lejos'}</span>
            ${enemiesCount ? `<span class="dim">· ${enemiesCount} criaturas</span>` : ''}
          </div>
          ${locked ? `<div class="travel-locked-msg">${icon('lock', 14)} ${esc(travelCheck.error || 'Bloqueada')}</div>` : ''}
        </div>
        <div class="travel-arrow dim">${locked ? icon('lock', 16) : '›'}</div>
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
      hills: 'Colinas', meadow: 'Pradera', darkwood: 'Bosque oscuro', dream: 'Bosque encantado',
      grove: 'Santuario', gothic: 'Ciudad de la noche', pirate: 'Puerto pirata', bloodwood: 'Jardín maldito',
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
    const nc = mainEl.querySelector('[data-note-close]');
    if (nc) nc.addEventListener('click', () => { lastNote = null; render(); });
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
              last.text = `Esquivaste a ${enemyName}.`;
              A.State.addChronicle({
                type: 'travel',
                text: `Esquivaste a ${enemyName} sin que te vieran (dado ${result.roll}+${result.speedBonus} contra ${result.dc}).`,
              });
              A.State.persist();
              A.Travel.step();
            } else {
              // Fallaste: combate empieza con desventaja (enemigos atacan primero)
              last.resolved = true;
              last.text = `Te detectaron al intentar evitar a ${enemyName}.`;
              A.State.addChronicle({
                type: 'travel',
                text: `Quisiste esquivar a ${enemyName}, pero te vieron (dado ${result.roll}+${result.speedBonus} contra ${result.dc}). Te atacan primero.`,
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
      // v1.8.0: antes el error solo iba a la consola y parecía que "no pasaba nada"
      if (result.locked) { onTravelLocked(targetId); return; }
      // v1.9.1: el aviso alcanza; no se guarda el error en las crónicas
      A.State.openModal('confirm', { title: 'No podés viajar', body: result.error });
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
      lastNote = null;
      A.State.ui.showMap = true;
      A.Bus.emit('view:changed');
      return;
    }
    if (action === 'rest') {
      // v2.0: descansar siempre hace algo (siesta de día, dormir de noche)
      const res = A.Explore ? A.Explore.rest() : null;
      if (res && res.kind !== 'night-event') {
        lastNote = { icon: res.kind === 'sleep' ? 'moon' : 'tent', text: res.text, chips: res.chips };
      } else {
        lastNote = null;
      }
      render();
      return;
    }
    if (action === 'explore') {
      lastNote = null;
      if (A.Explore) A.Explore.explore();
      render();
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
