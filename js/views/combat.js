/* ============================================================
   Aventurs — View: Combat (v1.5.2)
   - Cards de combatiente con stats
   - Log agrupado por turno con header "── Turno N ──"
   - Dados estables (roll snapshoteado en entry.roll, no se re-randomiza)
   - Barra de acciones horizontal con botones chicos
   - Colores diferenciados: jugador (dorado), enemigo (rojo), mascota (verde)
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
    if (c.result) { renderResult(); return; }

    const isPlayerTurnNow = isPlayerTurnLocal(c);
    const p = A.State.player;
    const alive = A.Combat.aliveEnemies();
    const target = A.Combat.getTarget();
    const targetId = target ? target.instanceId : null;
    const currentActor = c.initiative ? c.initiative[c.currentActorIdx] : null;
    const currentActorName = currentActor ? currentActor.name : '—';

    mainEl.innerHTML = `
      <section class="combat-view">

        <header class="combat-header-bar">
          <div class="combat-title">
            <span class="combat-icon">⚔️</span>
            <span>Combate · Turno ${c.round}</span>
          </div>
          ${renderTurnQueue(c)}
        </header>

        <div class="combat-arena">
          ${renderPlayerCard(p, currentActor && currentActor.kind === 'player')}
          <div class="combat-vs">⚔</div>
          <div class="combat-enemies-strip">
            ${c.enemies.map((e) => renderEnemyCard(e, e.instanceId === targetId, currentActor && currentActor.kind === 'enemy' && currentActor.id === e.instanceId)).join('')}
          </div>
        </div>

        ${p.pet ? renderPetMini(p.pet, currentActor && currentActor.kind === 'pet') : ''}

        <section class="combat-actions-bar ${isPlayerTurnNow ? '' : 'is-disabled'}">
          ${renderActions(isPlayerTurnNow)}
        </section>

        <section class="combat-log">
          ${renderLogHeader(c)}
          <div class="combat-log-list" id="combat-log-list">
            ${renderCurrentTurnLog(c)}
          </div>
        </section>

      </section>
    `;

    bindEvents();
    const list = mainEl.querySelector('#combat-log-list');
    if (list) list.scrollTop = list.scrollHeight;
  }

  /**
   * Cola de turnos arriba a la derecha del header.
   * Estilo: Búho B → Aníbal → Búho A → Zorro (el actual destacado)
   */
  function renderTurnQueue(c) {
    if (!c.initiative || c.initiative.length === 0) return '';
    const items = c.initiative.map((a, idx) => {
      const isActive = idx === c.currentActorIdx;
      const isDead = isActorDead(c, a);
      const cls = `turn-queue-item ${isActive ? 'is-active' : ''} ${isDead ? 'is-dead' : ''}`;
      return `<span class="${cls}">${A.Utils.escapeHtml(a.name)}</span>`;
    }).join('<span class="turn-queue-arrow">›</span>');
    return `<div class="combat-turn-queue">${items}</div>`;
  }

  function isActorDead(c, actor) {
    if (actor.kind === 'enemy') {
      const inst = c.enemies.find((e) => e.instanceId === actor.id);
      return !inst || inst.hp <= 0;
    }
    if (actor.kind === 'player') return A.State.player.hp <= 0;
    if (actor.kind === 'pet') return !A.State.player.pet || A.State.player.pet.health <= 0;
    return false;
  }

  /**
   * Header del log: muestra el número de turno actual y un botón para ver historial completo.
   */
  function renderLogHeader(c) {
    const turnHeaders = (c.log || []).filter((e) => e.type === 'turn-header');
    const totalTurns = turnHeaders.length;
    return `
      <div class="combat-log-header">
        <span class="combat-log-title">Acciones del turno ${c.round}</span>
        ${totalTurns > 1 ? `
          <button class="btn-mini" data-combat-action="show-full-log">Ver historial completo</button>
        ` : ''}
      </div>
    `;
  }

  /**
   * Devuelve el log SOLO del turno actual (desde el último turn-header).
   */
  function renderCurrentTurnLog(c) {
    if (!c.log || c.log.length === 0) return '<div class="muted small">Sin acciones aún en este turno.</div>';
    // Encontrar índice del último turn-header
    let startIdx = 0;
    for (let i = c.log.length - 1; i >= 0; i--) {
      if (c.log[i].type === 'turn-header') { startIdx = i; break; }
    }
    const slice = c.log.slice(startIdx);
    return renderLogGroupedByTurn(slice);
  }

  function isPlayerTurnLocal(c) {
    if (!c || !c.initiative) return false;
    const cur = c.initiative[c.currentActorIdx];
    return cur && cur.kind === 'player';
  }

  // ---------- Cards ----------

  function renderPlayerCard(p, isActive) {
    const race = A.Data.getById('races', p.raceId);
    const weapon = p.equipment.weapon ? A.Data.getById('weapons', p.equipment.weapon) : null;
    const armor = p.equipment.armor ? A.Data.getById('armors', p.equipment.armor) : null;
    const totalArmor = (p.stats.armor || 0) + (armor ? armor.defense : 0);
    const dmgStr = weapon ? weapon.damage : '1d3';
    const baseSpeed = p.stats.speed || 10;
    const effSpeed = A.Combat.effectivePlayerSpeed ? A.Combat.effectivePlayerSpeed(p) : baseSpeed;
    const speedDelta = effSpeed - baseSpeed;
    const speedLabel = speedDelta < 0 ? `${effSpeed} <span class="log-faint">(${baseSpeed}${speedDelta})</span>` : `${effSpeed}`;

    return `
      <div class="combat-card combat-card-player ${isActive ? 'is-active' : ''}">
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

        ${renderEffectsBadges(p.effects)}

        <div class="combat-card-stats">
          <div class="card-stat" title="Daño del arma">⚔️ ${dmgStr}${p.stats.damage ? `+${p.stats.damage}` : ''}</div>
          <div class="card-stat" title="Armadura (reduce daño recibido)">🛡️ ${totalArmor}</div>
          <div class="card-stat" title="Velocidad efectiva (con peso del equipo)">⚡ ${speedLabel}</div>
          <div class="card-stat" title="Esquiva: tirás D20+${Math.floor((p.stats.dodge || 0) / 2)} ≥ 12 al ser atacado">💨 ${p.stats.dodge || 0}</div>
        </div>
      </div>
    `;
  }

  function renderEnemyCard(e, isTarget, isActive) {
    const dead = e.hp <= 0;
    const cls = `combat-card combat-card-enemy ${isTarget && !dead ? 'is-target' : ''} ${isActive ? 'is-active' : ''} ${dead ? 'is-dead' : ''}`;
    // Usar el damage de la instancia (con arma equipada si la tiene), no del seed
    const damageStr = `${e.damage}`;
    const weapon = e.equippedWeapon ? A.Data.getById('weapons', e.equippedWeapon) : null;

    return `
      <button class="${cls}" data-target="${A.Utils.escapeHtml(e.instanceId)}" ${dead ? 'disabled' : ''}>
        <div class="combat-card-icon">${e.icon || '👹'}</div>
        <div class="combat-card-name">${A.Utils.escapeHtml(e.displayName)}</div>
        <div class="combat-card-meta dim">T${e.tier} · ${categoryLabel(e.category)}${weapon ? ` · ${weapon.icon || '⚔️'}` : ''}</div>

        <div class="combat-card-hp">
          <div class="bar bar-enemy-hp"><span style="width:${pct(e.hp, e.maxHp)}%"></span></div>
          <div class="combat-card-hp-text num">❤ ${e.hp}/${e.maxHp}</div>
        </div>

        ${renderEffectsBadges(e.effects)}

        <div class="combat-card-stats">
          <div class="card-stat" title="Daño">⚔️ ${damageStr}</div>
          <div class="card-stat" title="Armadura (reduce daño recibido)">🛡️ ${e.armor || 0}</div>
          <div class="card-stat" title="Velocidad">⚡ ${e.speed || 0}</div>
          <div class="card-stat" title="Esquiva: tira D20+${Math.floor((e.dodge || 0) / 2)} ≥ 12 al ser atacado">💨 ${e.dodge || 0}</div>
        </div>

        ${dead ? `<div class="combat-card-dead-tag">caído</div>` : ''}
      </button>
    `;
  }

  function renderEffectsBadges(effects) {
    if (!effects || effects.length === 0) return '';
    return `
      <div class="combat-effects-row">
        ${effects.map((ef) => `
          <span class="effect-badge effect-${ef.type}" title="${A.Utils.escapeHtml(A.Combat.effectLabel(ef.type))} (${ef.turns} turnos)">
            ${effectIcon(ef.type)}<span class="effect-turns">${ef.turns}</span>
          </span>
        `).join('')}
      </div>
    `;
  }

  function effectIcon(type) {
    return ({
      bleed: '🩸', poison: '☠️', fire: '🔥',
      cold: '❄️', shock: '⚡', blind: '🌫️', silence: '🤐',
    })[type] || '·';
  }

  function renderPetMini(pet, isActive) {
    return `
      <div class="combat-pet ${isActive ? 'is-active' : ''}">
        <span class="combat-pet-icon">${pet.icon || '🐾'}</span>
        <div class="combat-pet-info">
          <div class="combat-pet-name">${A.Utils.escapeHtml(pet.name)} <span class="dim">mascota</span></div>
          <div class="bar bar-pet-hp"><span style="width:${pct(pet.health, pet.maxHealth)}%"></span></div>
        </div>
        <span class="combat-pet-hp num">❤ ${pet.health}/${pet.maxHealth}</span>
      </div>
    `;
  }

  // ---------- Action bar (horizontal) ----------

  function renderActions(isPlayerTurnNow) {
    const p = A.State.player;
    const spells = A.Combat.availableSpells();
    const items = A.Combat.availableItems();
    const disabled = !isPlayerTurnNow;
    return `
      <div class="combat-action-row">
        <button class="combat-action-btn" data-combat-action="attack" ${disabled ? 'disabled' : ''} title="Atacar">
          <span class="combat-action-icon">⚔️</span>
          <span class="combat-action-label">Atacar</span>
        </button>
        ${p.hasMagic ? `
          <button class="combat-action-btn" data-combat-action="spell" ${disabled || spells.length === 0 ? 'disabled' : ''} title="Hechizo">
            <span class="combat-action-icon">✨</span>
            <span class="combat-action-label">Hechizo</span>
          </button>
        ` : ''}
        <button class="combat-action-btn" data-combat-action="item" ${disabled || items.length === 0 ? 'disabled' : ''} title="Usar item">
          <span class="combat-action-icon">🧪</span>
          <span class="combat-action-label">Item</span>
        </button>
        <button class="combat-action-btn" data-combat-action="flee" ${disabled ? 'disabled' : ''} title="Huir">
          <span class="combat-action-icon">🏃</span>
          <span class="combat-action-label">Huir</span>
        </button>
      </div>
      ${disabled ? `<div class="combat-waiting muted">Esperando turno...</div>` : ''}
    `;
  }

  // ---------- Result ----------

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
          ${renderLogGroupedByTurn(c.log)}
        </div>

        <button class="btn-primary" data-combat-action="finish">Continuar</button>
      </section>
    `;
    bindEvents();
  }

  // ---------- Log: agrupar por turn-header ----------

  function renderLogGroupedByTurn(entries) {
    if (!entries || entries.length === 0) return '';
    // Recorremos el log y emitimos:
    //  - entry con type==='turn-header' como divider visible
    //  - resto como filas
    const out = [];
    for (const e of entries) {
      if (e.type === 'turn-header') {
        out.push(`<div class="combat-log-divider">${A.Utils.escapeHtml(e.text)}</div>`);
      } else {
        out.push(logRow(e));
      }
    }
    return out.join('');
  }

  function logRow(entry) {
    const cls = `combat-log-row is-${entry.type}`;
    if (!entry.roll && !entry.dmg && !entry.dodgeRoll) {
      return `<div class="${cls}"><span class="log-bullet">·</span><span class="combat-log-text">${A.Utils.escapeHtml(entry.text || '')}</span></div>`;
    }

    const headerLine = `
      <div class="log-line log-header result-${entry.result || ''}">
        <span class="log-bullet">${actorIcon(entry.type, entry)}</span>
        <span class="log-text">${A.Utils.escapeHtml(entry.text)}</span>
      </div>
    `;

    let parts = [headerLine];

    // 1) Tirada de impacto
    if (entry.roll) {
      const totalPart = entry.bonus ? ` +${entry.bonus} = <strong>${entry.total}</strong>` : '';
      parts.push(`
        <div class="log-line log-sub">
          <span class="log-tree">├─</span>
          <span class="die-pill" title="Dado de impacto">${entry.roll}</span>
          <span class="log-text">Ataque: D20=<strong>${entry.roll}</strong>${totalPart}</span>
        </div>
      `);
    }

    // 2) Tirada de esquiva del defensor (si la hubo)
    if (entry.dodgeRoll != null) {
      const evadedClass = entry.result === 'evaded' ? 'result-evaded' : '';
      const dodgeTotalPart = entry.dodgeBonus ? ` +${entry.dodgeBonus} = <strong>${entry.dodgeTotal}</strong>` : '';
      parts.push(`
        <div class="log-line log-sub ${evadedClass}">
          <span class="log-tree">├─</span>
          <span class="die-pill die-pill-dodge" title="Dado de esquiva">${entry.dodgeRoll}</span>
          <span class="log-text">Esquiva: D20=<strong>${entry.dodgeRoll}</strong>${dodgeTotalPart} vs DC <strong>${entry.dodgeVs || 12}</strong></span>
        </div>
      `);
    }

    // 3) Resultado especial
    if (entry.result === 'crit') {
      parts.push(`
        <div class="log-line log-sub result-crit">
          <span class="log-tree">├─</span>
          <span class="log-icon">★</span>
          <span class="log-text">¡Crítico! Daño x2 (no se puede esquivar)</span>
        </div>
      `);
    } else if (entry.result === 'fumble') {
      parts.push(`
        <div class="log-line log-sub result-fumble">
          <span class="log-tree">└─</span>
          <span class="log-icon">💥</span>
          <span class="log-text">Pifia natural (1).</span>
        </div>
      `);
    } else if (entry.result === 'miss') {
      parts.push(`
        <div class="log-line log-sub result-miss">
          <span class="log-tree">└─</span>
          <span class="log-icon">✕</span>
          <span class="log-text">No llegó al objetivo.</span>
        </div>
      `);
    } else if (entry.result === 'evaded') {
      parts.push(`
        <div class="log-line log-sub result-evaded">
          <span class="log-tree">└─</span>
          <span class="log-icon">💨</span>
          <span class="log-text">¡Esquivó!</span>
        </div>
      `);
    } else if (entry.result === 'blocked') {
      parts.push(`
        <div class="log-line log-sub result-blocked">
          <span class="log-tree">└─</span>
          <span class="log-icon">🛡</span>
          <span class="log-text">Armadura ${entry.targetArmor || 0} ≥ daño ${entry.rawDmg || 0}. Bloqueado.</span>
        </div>
      `);
    }

    // 4) Línea de daño aplicado
    if (entry.dmg != null && entry.dmg > 0 && (entry.result === 'hit' || entry.result === 'crit')) {
      const reduction = entry.targetArmor && entry.rawDmg
        ? ` <span class="log-faint">(daño ${entry.rawDmg} − armadura ${entry.targetArmor})</span>`
        : '';
      const diceTag = entry.damageDice
        ? `<span class="dice-pill" title="Dado de daño">${A.Utils.escapeHtml(entry.damageDice)}</span>`
        : '';
      parts.push(`
        <div class="log-line log-sub result-hit">
          <span class="log-tree">└─</span>
          <span class="log-icon">⚔️</span>
          <span class="log-text">${diceTag}<strong>${entry.dmg}</strong> de daño${reduction}. <span class="log-faint">HP: ${entry.hpAfter}/${entry.hpMax}</span></span>
        </div>
      `);
    }

    return `<div class="${cls}">${parts.join('')}</div>`;
  }

  function actorIcon(type, entry) {
    // Si el entry tiene actorIcon (icono real del actor), úsalo
    if (entry && entry.actorIcon) return entry.actorIcon;
    if (type === 'player') return '🗡️';
    if (type === 'enemy') return '👹';
    if (type === 'pet') return '🐾';
    if (type === 'loot') return '💰';
    if (type === 'system') return '·';
    return '·';
  }

  // ---------- Helpers ----------

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
      if (b.disabled) return;
      b.addEventListener('click', () => {
        const action = b.dataset.combatAction;
        if (action === 'attack') A.Combat.playerAttack();
        else if (action === 'flee') A.Combat.playerFlee();
        else if (action === 'spell') A.State.openModal('combat-spell');
        else if (action === 'item') A.State.openModal('combat-item');
        else if (action === 'show-full-log') A.State.openModal('combat-full-log');
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
