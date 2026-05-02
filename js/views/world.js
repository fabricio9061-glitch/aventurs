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
          ${isSafeRegion ? `
            <button class="action-card-main" data-action="open-craft">
              <div class="action-card-icon">⚒️</div>
              <div class="action-card-text">
                <div class="action-card-label">Crafteo</div>
                <div class="action-card-desc">Crear objetos con materiales.</div>
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
    const isGroup = (ev.enemies || []).length > 1;
    const groupSize = (ev.enemies || []).length;
    return `
      <div class="travel-encounter">
        <div class="encounter-icon">${ev.icon || '👹'}</div>
        <div class="encounter-body">
          <div class="encounter-title">${isGroup ? `Aparecieron ${groupSize} enemigos` : `Apareció ${A.Utils.escapeHtml(ev.enemyName)}`}</div>
          <div class="encounter-meta dim">
            ${isGroup ? `<span>${A.Utils.escapeHtml(ev.enemyName)}</span>` : `
              <span class="pill pill-tier">Tier ${ev.tier}</span>
              <span class="pill">${categoryLabel(ev.category)}</span>
              ${ev.tameable ? `<span class="pill pill-tameable">Domable</span>` : ''}
            `}
          </div>
          <p class="encounter-desc">${isGroup
            ? 'Vienen juntos por el camino. Mejor decidir rápido.'
            : (enemy && enemy.tameable
              ? 'Te observa con curiosidad. Quizás puedas acercarte sin pelear.'
              : 'No parece dispuesto a parlamentar.')}</p>
          <div class="encounter-actions">
            <button class="btn-primary" data-travel-action="fight" data-enemy-id="${A.Utils.escapeHtml(ev.enemyId)}">Pelear</button>
            ${!isGroup && enemy && enemy.tameable && !A.State.player.pet ? `
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
      // Descanso al raso: solo +50% HP, sin maná ni food
      const p = A.State.player;
      const heal = Math.floor(p.maxHp / 2);
      const before = p.hp;
      A.State.healHp(heal);
      const recovered = p.hp - before;
      A.State.addChronicle({
        type: 'rest',
        text: `Descansaste un rato. +${recovered} salud. (Para recuperar maná y comida, buscá una posada.)`,
      });
    } else if (action === 'explore') {
      const region = A.Data.getById('regions', A.State.world.regionId);
      // Primero probar eventos custom de la región
      if (region && Array.isArray(region.events) && region.events.length > 0) {
        for (const ev of region.events) {
          if (Math.random() * 100 < (ev.chance || 0)) {
            executeRegionEventInline(ev);
            return;
          }
        }
      }
      const r = Math.random();
      if (r < 0.60) {
        // Generar grupo via Encounter (respeta encounter config de la región)
        const group = A.Encounter.generate(A.State.world.regionId);
        if (group && group.length > 0) {
          const desc = A.Encounter.describeGroup(group);
          A.State.addChronicle({ type: 'note', text: `Te encontraste con ${desc} mientras explorabas.` });
          A.Combat.start({ enemies: group, fromTravel: false });
          return;
        }
        A.State.addChronicle({ type: 'note', text: 'Recorriste la zona pero no encontraste nada.' });
      } else if (r < 0.85) {
        const coins = 3 + Math.floor(Math.random() * 12);
        A.Currency.add(coins);
        A.State.addChronicle({ type: 'loot', text: `Encontraste ${A.Currency.formatPrice(coins)} escondidos.` });
      } else {
        A.State.addChronicle({ type: 'note', text: 'No encontraste nada útil esta vez.' });
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
      if (mainEl) mainEl.innerHTML = '';
    },
  };

  A.Views = A.Views || {};
  A.Views.World = WorldView;
})(window.Aventurs);
