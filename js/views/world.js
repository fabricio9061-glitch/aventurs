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

    const VISIBLE_CHIPS = 7;
    const visibleEnemies = enemies.slice(0, VISIBLE_CHIPS);
    const overflowCount = Math.max(0, enemies.length - VISIBLE_CHIPS);

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
              ${visibleEnemies.map((e) => `
                <button class="creature-chip" data-creature="${A.Utils.escapeHtml(e.id)}" title="${A.Utils.escapeHtml(e.name)} · Tier ${e.tier} · ${e.category}">
                  <span class="creature-icon">${e.icon || '👹'}</span>
                  <span>${A.Utils.escapeHtml(e.name)}</span>
                </button>
              `).join('')}
              ${overflowCount > 0 ? `
                <button class="creature-chip is-overflow" data-show-all="${A.Utils.escapeHtml(region.id)}">
                  <span>+${overflowCount}</span>
                </button>
              ` : ''}
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

  function renderTraveling() {
    const t = A.State.traveling;
    const fromR = A.Data.getById('regions', t.fromId);
    const toR = A.Data.getById('regions', t.toId);
    const pctNum = Math.round((t.currentStep / t.totalSteps) * 100);
    const lastEvent = t.events[t.events.length - 1] || null;

    // Si último evento es una criatura sin resolver, ofrecer opciones
    const pending = lastEvent && lastEvent.kind === 'creature' && !lastEvent.resolved;

    mainEl.innerHTML = `
      <section class="travel-view">
        <header class="travel-header">
          <div class="travel-route">
            <span class="travel-from">${fromR ? fromR.icon : '📍'} ${A.Utils.escapeHtml(fromR ? fromR.name : t.fromId)}</span>
            <span class="travel-arrow-big">→</span>
            <span class="travel-to">${toR ? toR.icon : '📍'} ${A.Utils.escapeHtml(toR ? toR.name : t.toId)}</span>
          </div>
        </header>

        <div class="travel-progress">
          <div class="travel-progress-meta">
            <span class="dim">Paso ${t.currentStep} de ${t.totalSteps}</span>
            <span class="num">${pctNum}%</span>
          </div>
          <div class="bar bar-travel"><span style="width:${pctNum}%"></span></div>
        </div>

        ${pending ? renderEncounter(lastEvent) : `
          <div class="travel-events">
            ${t.events.length === 0 ? `
              <div class="muted">El camino está tranquilo. Da el primer paso.</div>
            ` : t.events.slice().reverse().map(eventRow).join('')}
          </div>

          <div class="travel-actions">
            <button class="btn-primary" data-travel-action="step">Avanzar</button>
            <button class="btn-ghost" data-travel-action="cancel">Volver al origen</button>
          </div>
        `}
      </section>
    `;

    bindTravelEvents();
  }

  function renderEncounter(ev) {
    const enemy = A.Data.getById('enemies', ev.enemyId);
    return `
      <div class="travel-encounter">
        <div class="encounter-icon">${ev.icon || '👹'}</div>
        <div class="encounter-body">
          <div class="encounter-title">Apareció ${A.Utils.escapeHtml(ev.enemyName)}</div>
          <div class="encounter-meta dim">
            <span class="pill pill-tier">Tier ${ev.tier}</span>
            <span class="pill">${categoryLabel(ev.category)}</span>
            ${ev.tameable ? `<span class="pill pill-tameable">Domable</span>` : ''}
          </div>
          <p class="encounter-desc">${enemy && enemy.tameable
            ? 'Te observa con curiosidad. Quizás puedas acercarte sin pelear.'
            : 'No parece dispuesto a parlamentar.'}</p>
          <div class="encounter-actions">
            <button class="btn-primary" data-travel-action="fight" data-enemy-id="${A.Utils.escapeHtml(ev.enemyId)}">Pelear</button>
            ${enemy && enemy.tameable && !A.State.player.pet ? `
              <button class="btn-secondary" data-travel-action="tame" data-enemy-id="${A.Utils.escapeHtml(ev.enemyId)}">Intentar domar</button>
            ` : ''}
            <button class="btn-ghost" data-travel-action="avoid">Evitar</button>
          </div>
        </div>
      </div>
    `;
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

  function categoryLabel(c) {
    return ({ weak: 'Débil', normal: 'Normal', strong: 'Fuerte', boss: 'Jefe' })[c] || c;
  }

  // ---------- Bindings ----------

  function bindEvents() {
    mainEl.querySelectorAll('[data-travel]').forEach((btn) => {
      btn.addEventListener('click', () => onTravel(btn.dataset.travel));
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
    mainEl.querySelectorAll('[data-travel-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.travelAction;
        if (action === 'step') {
          A.Travel.step();
        } else if (action === 'cancel') {
          A.Travel.cancel();
        } else if (action === 'avoid') {
          // Marcar el último evento creature como resuelto y avanzar
          const t = A.State.traveling;
          const last = t.events[t.events.length - 1];
          if (last && last.kind === 'creature') {
            last.resolved = true;
            last.text = `Evitaste a ${last.enemyName} sin pelear.`;
          }
          A.State.persist();
          A.Travel.step();
        } else if (action === 'tame') {
          A.State.openModal('tame', { enemyId: btn.dataset.enemyId, fromTravel: true });
        } else if (action === 'fight') {
          // Marcar evento como resuelto e iniciar combate
          const t = A.State.traveling;
          const last = t.events[t.events.length - 1];
          if (last && last.kind === 'creature') {
            last.resolved = true;
            last.text = `Peleaste contra ${last.enemyName}.`;
          }
          A.State.persist();
          A.Combat.start({ enemyId: btn.dataset.enemyId, fromTravel: true });
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

  function onAction(action) {
    if (action === 'rest') {
      A.State.fullRest();
      A.State.addChronicle({ type: 'rest', text: 'Descansaste. Recuperaste salud y maná.' });
    } else if (action === 'explore') {
      // Roll: 60% encuentro, 25% loot menor, 15% nada
      const r = Math.random();
      if (r < 0.60) {
        // Spawn enemigo según pesos de la región
        const enemy = pickEnemyByWeight(A.State.world.regionId);
        if (enemy) {
          A.State.addChronicle({ type: 'note', text: `Te encontraste con ${enemy.name} mientras explorabas.` });
          A.Combat.start({ enemyId: enemy.id, fromTravel: false });
          return;
        }
        A.State.addChronicle({ type: 'note', text: 'Recorriste la zona pero no encontraste nada.' });
      } else if (r < 0.85) {
        const coins = 3 + Math.floor(Math.random() * 12);
        A.Currency.add(coins);
        A.State.addChronicle({ type: 'loot', text: `Encontraste ${coins} monedas de cobre escondidas.` });
      } else {
        A.State.addChronicle({ type: 'note', text: 'No encontraste nada útil esta vez.' });
      }
    }
  }

  function pickEnemyByWeight(regionId) {
    const enemies = A.Data.enemiesInRegion(regionId);
    if (!enemies.length) return null;
    // Weighted pick por categoría (mismo balance que travel)
    const byCat = { weak: [], normal: [], strong: [], boss: [] };
    for (const e of enemies) {
      const c = e.category || 'normal';
      if (byCat[c]) byCat[c].push(e);
    }
    const catWeights = {};
    if (byCat.weak.length) catWeights.weak = 0.40;
    if (byCat.normal.length) catWeights.normal = 0.40;
    if (byCat.strong.length) catWeights.strong = 0.15;
    if (byCat.boss.length) catWeights.boss = 0.05;
    if (Object.keys(catWeights).length === 0) return null;
    const cat = A.Utils.weightedPick(catWeights);
    const pool = byCat[cat];
    const weighted = {};
    pool.forEach((e, i) => { weighted[i] = e.spawnWeight || 1.0; });
    const idx = parseInt(A.Utils.weightedPick(weighted), 10);
    return pool[idx] || pool[0];
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
