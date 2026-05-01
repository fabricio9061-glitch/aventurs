/* ============================================================
   Aventurs — View: Combat (Fase 2)
   Pantalla de combate. Se monta sobre #shell-main cuando
   State.combat existe.

   Layout:
     - Cabecera: nombre del enemigo + barra de HP enemigo
     - Cuerpo: log de acciones (último arriba)
     - Acciones del jugador: Atacar, Hechizo, Item, Huir
     - Si combate terminó: pantalla de resultado
   ============================================================ */

(function (A) {
  'use strict';

  let mainEl = null;
  let unsubs = [];

  function render() {
    if (!mainEl) return;
    const c = A.State.combat;
    if (!c) {
      mainEl.innerHTML = `<div class="empty-tab">Sin combate activo.</div>`;
      return;
    }

    // Resultado
    if (c.result) {
      renderResult();
      return;
    }

    const e = c.enemy;
    const enemyHpPct = pct(e.hp, e.maxHp);
    const isPlayerTurn = c.turn === 'player';
    const p = A.State.player;

    mainEl.innerHTML = `
      <section class="combat-view">

        <header class="combat-enemy-banner">
          <div class="combat-enemy-icon">${e.icon || '👹'}</div>
          <div class="combat-enemy-info">
            <div class="combat-enemy-name">${A.Utils.escapeHtml(e.name)}</div>
            <div class="combat-enemy-meta">
              <span class="pill pill-tier">Tier ${e.tier}</span>
              <span class="pill">${categoryLabel(e.category)}</span>
              <span class="dim">Ronda ${c.round}</span>
            </div>
            <div class="combat-hp-row">
              <span class="dim">Salud</span>
              <span class="num">${e.hp} / ${e.maxHp}</span>
            </div>
            <div class="bar bar-enemy-hp"><span style="width:${enemyHpPct}%"></span></div>
          </div>
        </header>

        ${p.pet ? renderPetMini(p.pet) : ''}

        <section class="combat-log">
          <div class="block-title">Combate</div>
          <div class="combat-log-list">
            ${c.log.slice().reverse().map(logRow).join('')}
          </div>
        </section>

        <section class="combat-actions">
          <div class="block-title">${isPlayerTurn ? 'Tu turno' : 'Turno enemigo...'}</div>
          ${isPlayerTurn ? renderActions() : `
            <div class="combat-waiting muted">El enemigo está actuando.</div>
          `}
        </section>

      </section>
    `;

    bindEvents();
  }

  function renderPetMini(pet) {
    return `
      <div class="combat-pet">
        <span class="combat-pet-icon">${pet.icon || '🐾'}</span>
        <span class="combat-pet-name">${A.Utils.escapeHtml(pet.name)}</span>
        <span class="combat-pet-hp num">${pet.health}/${pet.maxHealth}</span>
        <div class="bar bar-pet-hp"><span style="width:${pct(pet.health, pet.maxHealth)}%"></span></div>
      </div>
    `;
  }

  function renderActions() {
    const p = A.State.player;
    const spells = A.Combat.availableSpells();
    const items = A.Combat.availableItems();

    return `
      <div class="combat-action-grid">
        <button class="combat-action" data-combat-action="attack">
          <span class="combat-action-icon">⚔️</span>
          <span class="combat-action-label">Atacar</span>
        </button>
        ${p.hasMagic ? `
          <button class="combat-action" data-combat-action="spell" ${spells.length === 0 ? 'disabled' : ''}>
            <span class="combat-action-icon">✨</span>
            <span class="combat-action-label">Hechizo${spells.length === 0 ? ' (sin hechizos)' : ''}</span>
          </button>
        ` : ''}
        <button class="combat-action" data-combat-action="item" ${items.length === 0 ? 'disabled' : ''}>
          <span class="combat-action-icon">🧪</span>
          <span class="combat-action-label">Usar item${items.length === 0 ? ' (sin items)' : ''}</span>
        </button>
        <button class="combat-action" data-combat-action="flee">
          <span class="combat-action-icon">🏃</span>
          <span class="combat-action-label">Huir</span>
        </button>
      </div>
    `;
  }

  function renderResult() {
    const c = A.State.combat;
    const isVictory = c.result === 'victory';
    const isDefeat = c.result === 'defeat';
    const isFlee = c.result === 'flee';

    const title = isVictory ? '¡Victoria!' : isDefeat ? 'Caíste...' : 'Escapaste';
    const icon = isVictory ? '🏆' : isDefeat ? '💀' : '🏃';
    const subtitle = isVictory ? `Venciste a ${c.enemy.name}.`
                  : isDefeat ? `Despertás en el pueblo. Necesitas curarte.`
                  : `Lograste escapar de ${c.enemy.name}.`;

    mainEl.innerHTML = `
      <section class="combat-result">
        <div class="combat-result-icon">${icon}</div>
        <h2 class="combat-result-title">${title}</h2>
        <p class="combat-result-sub muted">${A.Utils.escapeHtml(subtitle)}</p>

        <div class="combat-result-log">
          ${c.log.slice().reverse().map(logRow).join('')}
        </div>

        <button class="btn-primary" data-combat-action="finish">Continuar</button>
      </section>
    `;
    bindEvents();
  }

  function logRow(entry) {
    const cls = `combat-log-row is-${entry.type}`;
    return `
      <div class="${cls}">
        <span class="combat-log-text">${A.Utils.escapeHtml(entry.text)}</span>
      </div>
    `;
  }

  function pct(cur, max) {
    if (!max) return 0;
    return Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
  }

  function categoryLabel(c) {
    return ({ weak: 'Débil', normal: 'Normal', strong: 'Fuerte', boss: 'Jefe' })[c] || c;
  }

  function bindEvents() {
    mainEl.querySelectorAll('[data-combat-action]').forEach((b) => {
      b.addEventListener('click', () => {
        const action = b.dataset.combatAction;
        if (action === 'attack') A.Combat.playerAttack();
        else if (action === 'flee') A.Combat.playerFlee();
        else if (action === 'spell') A.State.openModal('combat-spell');
        else if (action === 'item') A.State.openModal('combat-item');
        else if (action === 'finish') {
          const wasVictory = A.State.combat && A.State.combat.result === 'victory';
          const fromTravel = A.State.combat && A.State.combat.fromTravel;
          A.Combat.finish();
          // Si vino de un encuentro de viaje y ganó, continuar el viaje
          if (wasVictory && fromTravel && A.State.traveling) {
            A.Travel.step();
          }
          // Re-render del shell para volver a Mundo
          if (A.Views.Shell && A.Views.Shell.rerender) A.Views.Shell.rerender();
        }
      });
    });
  }

  function subscribe() {
    unsubs.push(A.Bus.on('combat:turn', render));
    unsubs.push(A.Bus.on('combat:action', render));
    unsubs.push(A.Bus.on('combat:ended', render));
  }

  function unsubscribe() {
    unsubs.forEach((u) => u && u());
    unsubs = [];
  }

  const CombatView = {
    mount(container) {
      mainEl = container;
      render();
      unsubscribe();
      subscribe();
    },
    unmount() {
      unsubscribe();
      if (mainEl) mainEl.innerHTML = '';
    },
    rerender: render,
  };

  A.Views = A.Views || {};
  A.Views.Combat = CombatView;
})(window.Aventurs);
