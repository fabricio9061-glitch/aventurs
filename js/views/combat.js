/* ============================================================
   Aventurs — View: Combat (v1.4.0)
   Cards expandidas con stats, animación de dado, log detallado.
   ============================================================ */

(function (A) {
  'use strict';

  let mainEl = null;
  let unsubs = [];
  let lastLogLength = 0;
  let pendingDieAnims = [];

  function render() {
    if (!mainEl) return;
    const c = A.State.combat;
    if (!c) {
      mainEl.innerHTML = `<div class="empty-tab">Sin combate activo.</div>`;
      lastLogLength = 0;
      return;
    }
    if (c.result) { renderResult(); return; }

    const isPlayerTurn = c.turn === 'player';
    const p = A.State.player;
    const alive = A.Combat.aliveEnemies();
    const target = A.Combat.getTarget();
    const targetId = target ? target.instanceId : null;

    mainEl.innerHTML = `
      <section class="combat-view">

        <header class="combat-header-bar">
          <div class="combat-title">
            <span class="combat-icon">⚔️</span>
            <span>Combate</span>
          </div>
          <div class="combat-turn-badge">
            ${alive.length} enemigo${alive.length !== 1 ? 's' : ''} · Turno ${c.round}
          </div>
        </header>

        <div class="combat-arena">
          ${renderPlayerCard(p)}
          <div class="combat-vs">⚔</div>
          <div class="combat-enemies-strip">
            ${c.enemies.map((e) => renderEnemyCard(e, e.instanceId === targetId)).join('')}
          </div>
        </div>

        ${alive.length > 1 ? `
          <div class="combat-target-row">
            <span class="dim">🎯 Objetivo:</span>
            ${alive.map((e) => `
              <button class="combat-target-btn ${e.instanceId === targetId ? 'is-active' : ''}"
                      data-target="${A.Utils.escapeHtml(e.instanceId)}">
                ${A.Utils.escapeHtml(e.displayName)}
              </button>
            `).join('')}
          </div>
        ` : ''}

        ${p.pet ? renderPetMini(p.pet) : ''}

        <section class="combat-log">
          <div class="combat-log-divider">— Turno ${c.round} —</div>
          <div class="combat-log-list" id="combat-log-list">
            ${c.log.slice().reverse().map(logRow).join('')}
          </div>
        </section>

        <section class="combat-actions">
          ${isPlayerTurn ? renderActions() : `
            <div class="combat-waiting muted">⏳ El enemigo está actuando...</div>
          `}
        </section>

      </section>
    `;

    bindEvents();

    // Si hubo entradas nuevas con tirada, animar el dado
    flushDieAnimations();
  }

  function renderPlayerCard(p) {
    const race = A.Data.getById('races', p.raceId);
    const weapon = p.equipment.weapon ? A.Data.getById('weapons', p.equipment.weapon) : null;
    const armor = p.equipment.armor ? A.Data.getById('armors', p.equipment.armor) : null;
    const totalArmor = (p.stats.armor || 0) + (armor ? armor.defense : 0);
    const dmgStr = weapon ? weapon.damage : '1d3';
    const playerAC = 10 + totalArmor;

    return `
      <div class="combat-card combat-card-player">
        <div class="combat-card-icon">${race ? race.icon : '👤'}</div>
        <div class="combat-card-name">${A.Utils.escapeHtml(p.name)}</div>
        <div class="combat-card-meta dim">${race ? race.name : ''} · Nv ${p.level}</div>

        <div class="combat-card-hp">
          <div class="bar bar-hp"><span style="width:${pct(p.hp, p.maxHp)}%"></span></div>
          <div class="combat-card-hp-text num">❤ ${p.hp}/${p.maxHp}</div>
        </div>
        ${p.hasMagic ? `
          <div class="combat-card-mana">
            <div class="bar bar-mana"><span style="width:${pct(p.mana, p.maxMana)}%"></span></div>
            <div class="combat-card-mana-text num">✦ ${p.mana}/${p.maxMana}</div>
          </div>
        ` : ''}

        <div class="combat-card-stats">
          <div class="card-stat" title="Daño">⚔️ ${dmgStr}${p.stats.damage ? `+${p.stats.damage}` : ''}</div>
          <div class="card-stat" title="AC (defensa)">🛡️ ${playerAC}</div>
          <div class="card-stat" title="Velocidad">⚡ ${p.stats.speed || 10}</div>
          <div class="card-stat" title="Precisión">🎯 ${p.stats.precision || 0}</div>
        </div>
      </div>
    `;
  }

  function renderEnemyCard(e, isTarget) {
    const dead = e.hp <= 0;
    const cls = `combat-card combat-card-enemy ${isTarget && !dead ? 'is-target' : ''} ${dead ? 'is-dead' : ''}`;
    const enemyData = A.Data.getById('enemies', e.id);
    const damageStr = enemyData ? `${enemyData.damage}` : `${e.damage}`;
    const enemyAC = e.difficulty || (10 + (e.armor || 0));
    const coinRange = enemyData && enemyData.coinLoot ? `${enemyData.coinLoot[0]}-${enemyData.coinLoot[1]}` : '?';

    return `
      <button class="${cls}" data-target="${A.Utils.escapeHtml(e.instanceId)}" ${dead ? 'disabled' : ''}>
        <div class="combat-card-icon">${e.icon || '👹'}</div>
        <div class="combat-card-name">${A.Utils.escapeHtml(e.displayName)}</div>
        <div class="combat-card-meta dim">T${e.tier} · ${categoryLabel(e.category)}</div>

        <div class="combat-card-hp">
          <div class="bar bar-enemy-hp"><span style="width:${pct(e.hp, e.maxHp)}%"></span></div>
          <div class="combat-card-hp-text num">❤ ${e.hp}/${e.maxHp}</div>
        </div>

        <div class="combat-card-stats">
          <div class="card-stat" title="Daño">⚔️ ${damageStr}</div>
          <div class="card-stat" title="Defensa">🛡️ ${e.armor || 0}</div>
          <div class="card-stat" title="Velocidad">⚡ ${e.speed || 0}</div>
          <div class="card-stat" title="Dificultad de impacto">🎯 ${e.difficulty || enemyAC}</div>
        </div>

        <div class="combat-card-loot dim">💰 ${coinRange}c</div>

        ${dead ? `<div class="combat-card-dead-tag">caído</div>` : ''}
      </button>
    `;
  }

  function renderPetMini(pet) {
    return `
      <div class="combat-pet">
        <span class="combat-pet-icon">${pet.icon || '🐾'}</span>
        <div class="combat-pet-info">
          <div class="combat-pet-name">${A.Utils.escapeHtml(pet.name)} <span class="dim">mascota</span></div>
          <div class="bar bar-pet-hp"><span style="width:${pct(pet.health, pet.maxHealth)}%"></span></div>
        </div>
        <span class="combat-pet-hp num">❤ ${pet.health}/${pet.maxHealth}</span>
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
    const title = isVictory ? '¡Victoria!' : isDefeat ? 'Caíste...' : 'Escapaste';
    const icon = isVictory ? '🏆' : isDefeat ? '💀' : '🏃';
    const subtitle = isVictory ? `Venciste el encuentro.`
                  : isDefeat ? `Despertás en el pueblo. Necesitas curarte.`
                  : `Lograste escapar.`;

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

  // ---------- Log row con tiradas detalladas ----------

  function logRow(entry) {
    const cls = `combat-log-row is-${entry.type}`;
    // Sistema simple: solo texto
    if (!entry.roll) {
      return `<div class="${cls}"><span class="log-bullet">·</span><span class="combat-log-text">${A.Utils.escapeHtml(entry.text || '')}</span></div>`;
    }

    // Estructurada: header + sub-líneas indentadas tipo árbol
    const resultIcon = ({ hit: '✓', crit: '★', miss: '✕', fumble: '💥' })[entry.result] || '·';
    const resultClass = `result-${entry.result}`;

    const headerLine = `
      <div class="log-line log-header ${resultClass}">
        <span class="log-bullet">⚔️</span>
        <span class="log-text">${A.Utils.escapeHtml(entry.text)}</span>
      </div>
    `;

    const dieAnimId = `die_${entry.ts}_${Math.floor(Math.random() * 1000)}`;
    pendingDieAnims.push({ id: dieAnimId, value: entry.roll });

    const rollLine = `
      <div class="log-line log-sub">
        <span class="log-tree">├─</span>
        <span class="die-anim" id="${dieAnimId}" data-final="${entry.roll}">
          <span class="die-cube">
            <span class="die-face die-face-final">${entry.roll}</span>
          </span>
        </span>
        <span class="log-text">D20 = <strong>${entry.roll}</strong>${entry.bonus ? ` + ${entry.bonus} bono = <strong>${entry.total}</strong>` : ''} vs ${entry.vsLabel || 'objetivo'} <strong>${entry.vs}</strong></span>
      </div>
    `;

    let resultLine = '';
    if (entry.result === 'crit') {
      resultLine = `
        <div class="log-line log-sub result-crit">
          <span class="log-tree">├─</span>
          <span class="log-icon">★</span>
          <span class="log-text">¡Crítico! Daño doblado.</span>
        </div>
      `;
    } else if (entry.result === 'fumble') {
      resultLine = `
        <div class="log-line log-sub result-fumble">
          <span class="log-tree">└─</span>
          <span class="log-icon">💥</span>
          <span class="log-text">Pifia natural (1).</span>
        </div>
      `;
    } else if (entry.result === 'miss') {
      resultLine = `
        <div class="log-line log-sub result-miss">
          <span class="log-tree">└─</span>
          <span class="log-icon">✕</span>
          <span class="log-text">No llegó.</span>
        </div>
      `;
    }

    let dmgLine = '';
    if (entry.dmg != null && (entry.result === 'hit' || entry.result === 'crit')) {
      const dmgInfo = entry.damageDice ? ` (${entry.damageDice})` : '';
      dmgLine = `
        <div class="log-line log-sub result-hit">
          <span class="log-tree">└─</span>
          <span class="log-icon">⚔️</span>
          <span class="log-text">${entry.dmg} de daño${dmgInfo}. (HP: ${entry.hpAfter}/${entry.hpMax})</span>
        </div>
      `;
    }

    return `<div class="${cls}">${headerLine}${rollLine}${resultLine}${dmgLine}</div>`;
  }

  function flushDieAnimations() {
    if (!pendingDieAnims.length) return;
    requestAnimationFrame(() => {
      pendingDieAnims.forEach(({ id, value }) => {
        const el = mainEl.querySelector('#' + id);
        if (!el) return;
        // Ya viene marcado con cube, solo le agregamos clase para que dispare la animación
        el.classList.add('is-rolling');
      });
      pendingDieAnims = [];
    });
  }

  function pct(cur, max) {
    if (!max) return 0;
    return Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
  }

  function categoryLabel(c) {
    return ({ weak: 'Débil', normal: 'Normal', strong: 'Fuerte', boss: 'Jefe' })[c] || c;
  }

  function bindEvents() {
    mainEl.querySelectorAll('[data-target]').forEach((b) => {
      if (b.disabled) return;
      b.addEventListener('click', () => A.Combat.setTarget(b.dataset.target));
    });
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
          if (wasVictory && fromTravel && A.State.traveling) A.Travel.step();
          if (A.Views.Shell && A.Views.Shell.rerender) A.Views.Shell.rerender();
        }
      });
    });
  }

  function subscribe() {
    unsubs.push(A.Bus.on('combat:turn', render));
    unsubs.push(A.Bus.on('combat:action', render));
    unsubs.push(A.Bus.on('combat:ended', render));
    unsubs.push(A.Bus.on('combat:target-changed', render));
  }

  function unsubscribe() {
    unsubs.forEach((u) => u && u());
    unsubs = [];
  }

  const CombatView = {
    mount(container) {
      mainEl = container;
      lastLogLength = 0;
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
