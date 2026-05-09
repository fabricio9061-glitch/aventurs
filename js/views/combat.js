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
          <div class="combat-allies">
            ${renderPlayerCard(p, currentActor && currentActor.kind === 'player')}
            ${p.pet && p.pet.health > 0 ? renderPetCard(p.pet, currentActor && currentActor.kind === 'pet') : ''}
          </div>
          <div class="combat-vs">⚔</div>
          <div class="combat-enemies-strip">
            ${c.enemies.map((e) => renderEnemyCard(e, e.instanceId === targetId, currentActor && currentActor.kind === 'enemy' && currentActor.id === e.instanceId)).join('')}
          </div>
        </div>

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
    // Encontrar los ÚLTIMOS DOS turn-headers (para que veas el turno actual + el anterior)
    // Esto evita el bug donde la última acción del jugador en un turno N
    // no se muestra porque ya empezó el turno N+1.
    const turnHeaderIdx = [];
    for (let i = c.log.length - 1; i >= 0; i--) {
      if (c.log[i].type === 'turn-header') {
        turnHeaderIdx.unshift(i);
        if (turnHeaderIdx.length >= 2) break;
      }
    }
    let startIdx = turnHeaderIdx.length > 0 ? turnHeaderIdx[0] : 0;
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
    const speedLabel = speedDelta < 0 ? `${effSpeed}<span class="ally-stat-delta">${speedDelta}</span>` : `${effSpeed}`;
    const xpToNext = 50 * (p.level + 1) * (p.level + 1);
    const hpPct = pct(p.hp, p.maxHp);
    const hpColorClass = hpPct < 25 ? 'is-critical' : hpPct < 50 ? 'is-warning' : '';

    return `
      <div class="ally-card player-card player-card-hero ${isActive ? 'is-active' : ''}">
        <div class="ally-card-header">
          <span class="ally-card-icon ally-card-icon-hero">${race ? race.icon : '👤'}</span>
          <div class="ally-card-id">
            <div class="ally-card-name ally-card-name-hero">${A.Utils.escapeHtml(p.name)}</div>
            <div class="ally-card-meta">
              <span class="player-race-pill">${race ? race.name : ''}</span>
              <span class="player-level-badge">Nv ${p.level}</span>
            </div>
          </div>
        </div>
        <div class="ally-card-bars">
          <div class="bar-row">
            <span class="bar-label">Salud</span>
            <span class="bar-val num">${p.hp}/${p.maxHp}</span>
          </div>
          <div class="bar bar-hp ${hpColorClass}"><span style="width:${hpPct}%"></span></div>
          ${p.hasMagic ? `
            <div class="bar-row">
              <span class="bar-label">Maná</span>
              <span class="bar-val num">${p.mana}/${p.maxMana}</span>
            </div>
            <div class="bar bar-mana"><span style="width:${pct(p.mana, p.maxMana)}%"></span></div>
          ` : ''}
          <div class="bar-row">
            <span class="bar-label">XP</span>
            <span class="bar-val num">${p.xp}/${xpToNext}</span>
          </div>
          <div class="bar bar-xp"><span style="width:${pct(p.xp, xpToNext)}%"></span></div>
        </div>
        ${renderEffectsBadges(p.effects)}
        <div class="ally-card-stats">
          <span class="ally-stat" title="Daño del arma${p.stats.damage ? ' + bonus' : ''}"><span class="dim">DMG</span> <span class="num">${dmgStr}${p.stats.damage ? `+${p.stats.damage}` : ''}</span></span>
          <span class="ally-stat" title="Armadura"><span class="dim">ARM</span> <span class="num">${totalArmor}</span></span>
          <span class="ally-stat" title="Velocidad"><span class="dim">VEL</span> <span class="num">${speedLabel}</span></span>
          <span class="ally-stat" title="Esquiva"><span class="dim">ESQ</span> <span class="num">${p.stats.dodge || 0}</span></span>
        </div>
      </div>
    `;
  }

  function renderEnemyCard(e, isTarget, isActive) {
    const dead = e.hp <= 0;
    const catClass = `enemy-cat-${e.category || 'normal'}`;
    const tierClass = e.tier >= 7 ? 'enemy-tier-elite' : e.tier >= 4 ? 'enemy-tier-mid' : 'enemy-tier-low';
    const cls = `ally-card enemy-card ${catClass} ${tierClass} ${isTarget && !dead ? 'is-target' : ''} ${isActive ? 'is-active' : ''} ${dead ? 'is-dead' : ''}`;
    const damageStr = `${e.damage}`;
    const weapon = e.equippedWeapon ? A.Data.getById('weapons', e.equippedWeapon) : null;
    const hpPct = pct(e.hp, e.maxHp);
    // v1.6.6: color de la barra HP según porcentaje
    const hpColorClass = hpPct < 25 ? 'is-critical' : hpPct < 50 ? 'is-warning' : '';

    return `
      <button type="button" class="${cls}" data-target="${A.Utils.escapeHtml(e.instanceId)}" ${dead ? 'disabled' : ''}>
        <div class="ally-card-header">
          <span class="ally-card-icon">${e.icon || '👹'}</span>
          <div class="ally-card-id">
            <div class="ally-card-name">${A.Utils.escapeHtml(e.displayName)}</div>
            <div class="ally-card-meta">
              <span class="enemy-tier-badge">T${e.tier}</span>
              <span class="enemy-cat-badge">${categoryLabel(e.category)}</span>
              ${weapon ? `<span class="enemy-weapon-badge" title="${A.Utils.escapeHtml(weapon.name)}">${weapon.icon || '⚔️'}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="ally-card-bars">
          <div class="bar-row">
            <span class="bar-label">Salud</span>
            <span class="bar-val num">${e.hp}/${e.maxHp}</span>
          </div>
          <div class="bar bar-enemy-hp ${hpColorClass}"><span style="width:${hpPct}%"></span></div>
        </div>
        ${renderEffectsBadges(e.effects)}
        <div class="ally-card-stats">
          <span class="ally-stat" title="Daño"><span class="dim">DMG</span> <span class="num">${damageStr}</span></span>
          <span class="ally-stat" title="Armadura"><span class="dim">ARM</span> <span class="num">${e.armor || 0}</span></span>
          <span class="ally-stat" title="Velocidad"><span class="dim">VEL</span> <span class="num">${e.speed || 0}</span></span>
          <span class="ally-stat" title="Esquiva"><span class="dim">ESQ</span> <span class="num">${e.dodge || 0}</span></span>
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

  /**
   * v1.5.9: Card aliada de mascota (al lado del player, no barra horizontal abajo).
   * Layout consistente con renderPlayerCard.
   */
  function renderPetCard(pet, isActive) {
    const lvl = pet.level || 1;
    const xp = pet.xp || 0;
    const xpNeeded = (pet.xpNeeded || (lvl * 30));
    return `
      <div class="ally-card pet-card ${isActive ? 'is-active' : ''}">
        <div class="ally-card-header">
          <span class="ally-card-icon">${pet.icon || '🐾'}</span>
          <div class="ally-card-id">
            <div class="ally-card-name">${A.Utils.escapeHtml(pet.name)}</div>
            <div class="ally-card-meta dim">mascota · Nv ${lvl}</div>
          </div>
        </div>
        <div class="ally-card-bars">
          <div class="bar-row">
            <span class="bar-label">Salud</span>
            <span class="bar-val num">${pet.health}/${pet.maxHealth}</span>
          </div>
          <div class="bar bar-hp"><span style="width:${pct(pet.health, pet.maxHealth)}%"></span></div>
          <div class="bar-row">
            <span class="bar-label">XP</span>
            <span class="bar-val num">${xp}/${xpNeeded}</span>
          </div>
          <div class="bar bar-xp"><span style="width:${pct(xp, xpNeeded)}%"></span></div>
        </div>
        <div class="ally-card-stats">
          <span class="ally-stat" title="Daño"><span class="dim">DMG</span> <span class="num">${pet.damage || '1d3'}</span></span>
          <span class="ally-stat" title="Armadura"><span class="dim">ARM</span> <span class="num">${pet.armor || 0}</span></span>
          <span class="ally-stat" title="Velocidad"><span class="dim">VEL</span> <span class="num">${pet.speed || 8}</span></span>
        </div>
      </div>
    `;
  }

  // ---------- Action bar (horizontal) ----------

  function renderActions(isPlayerTurnNow) {
    const p = A.State.player;
    const spells = A.Combat.availableSpells();
    const items = A.Combat.availableItems();
    const disabled = !isPlayerTurnNow;

    // v1.6.4: Domesticación contextual
    // El botón aparece solo si:
    //   1) El jugador no tiene mascota
    //   2) Queda exactamente 1 enemigo vivo
    //   3) Ese enemigo es domable (tameable + isInstinctive)
    //   4) El jugador tiene el item requerido
    const c = A.State.combat;
    const aliveEnemies = (c.enemies || []).filter((e) => e.hp > 0);
    let tameInfo = null;
    if (!p.pet && aliveEnemies.length === 1 && A.Tame) {
      const onlyOne = aliveEnemies[0];
      const enemyData = A.Data.getById('enemies', onlyOne.id);
      if (enemyData && enemyData.tameable) {
        const check = A.Tame.canTame(enemyData.id, onlyOne.instanceId);
        if (check.ok) {
          tameInfo = {
            enemyId: enemyData.id,
            instanceId: onlyOne.instanceId,
            chance: A.Tame.chanceFor ? Math.round(A.Tame.chanceFor(enemyData) * 100) : null,
            requiredItem: check.requiredItemId,
          };
        } else if (check.reason === 'missing-item') {
          // Mostrar disabled con tooltip explicativo
          const itemData = A.Data.getById('items', check.requiredItemId);
          tameInfo = {
            enemyId: enemyData.id,
            instanceId: onlyOne.instanceId,
            disabled: true,
            tooltip: `Necesitás ${itemData ? itemData.name : check.requiredItemId} para intentar domarlo`,
          };
        } else if (check.reason === 'instance-failed') {
          tameInfo = {
            disabled: true,
            tooltip: 'Esta criatura ya desconfía de vos',
          };
        }
      }
    }

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
        ${tameInfo ? `
          <button class="combat-action-btn combat-action-tame" data-combat-action="tame" data-tame-enemy-id="${A.Utils.escapeHtml(tameInfo.enemyId || '')}" data-tame-instance-id="${A.Utils.escapeHtml(tameInfo.instanceId || '')}" ${disabled || tameInfo.disabled ? 'disabled' : ''} title="${A.Utils.escapeHtml(tameInfo.tooltip || (`Intentar domesticar (${tameInfo.chance != null ? tameInfo.chance + '%' : ''})`))}">
            <span class="combat-action-icon">🐾</span>
            <span class="combat-action-label">Domesticar${tameInfo.chance != null ? ` <span class="tame-chance">(${tameInfo.chance}%)</span>` : ''}</span>
          </button>
        ` : ''}
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
        else if (action === 'tame') {
          // v1.6.4: Domesticación contextual desde combate
          const enemyId = b.dataset.tameEnemyId;
          const instanceId = b.dataset.tameInstanceId;
          if (enemyId && A.Tame) {
            const result = A.Tame.attempt(enemyId, instanceId);
            if (result && result.success) {
              // Se domó: el combate termina (la mascota ya está asignada al player)
              A.Combat.endCombatTamed && A.Combat.endCombatTamed();
              if (!A.Combat.endCombatTamed) {
                // Fallback: forzar fin del combate
                if (A.State.combat) A.State.combat.result = 'tamed';
                A.Bus.emit('combat:ended', { result: 'tamed' });
              }
            }
            render();
          }
        }
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
    unsubs.push(A.Bus.on('combat:action', (entry) => {
      render();
      // Después del render, lanzar feedback visual sobre la card recién pintada
      requestAnimationFrame(() => {
        try { spawnFeedback(entry); } catch (e) { /* silencioso */ }
      });
    }));
    unsubs.push(A.Bus.on('combat:ended', render));
    unsubs.push(A.Bus.on('combat:target-changed', render));
  }

  /**
   * Genera feedback visual (números flotantes, shake) sobre la card del target
   * según el resultado de la acción.
   */
  function spawnFeedback(entry) {
    if (!entry || !mainEl) return;
    if (!entry.target) return;

    // Encontrar la card del target en el DOM
    let targetCardEl = null;
    if (entry.target === A.State.player.name) {
      targetCardEl = mainEl.querySelector('.combat-card-player');
    } else {
      const enemyCards = mainEl.querySelectorAll('.combat-card-enemy');
      enemyCards.forEach((card) => {
        const nameEl = card.querySelector('.combat-card-name');
        if (nameEl && nameEl.textContent.trim() === entry.target) {
          targetCardEl = card;
        }
      });
    }
    if (!targetCardEl) return;

    if (entry.result === 'hit') {
      const dmg = entry.dmg || 0;
      if (dmg > 0) {
        spawnFloatingNumber(targetCardEl, `-${dmg}`, 'damage');
        shakeElement(targetCardEl);
        flashCard(targetCardEl, 'damage');
        spawnSlash(targetCardEl, 'damage');
        spawnParticles(targetCardEl, 'damage', 8);
      }
    } else if (entry.result === 'crit') {
      const dmg = entry.dmg || 0;
      if (dmg > 0) {
        spawnFloatingNumber(targetCardEl, `-${dmg}`, 'crit');
        shakeElement(targetCardEl, 'strong');
        flashCard(targetCardEl, 'crit');
        spawnSlash(targetCardEl, 'crit');
        spawnParticles(targetCardEl, 'crit', 14);
        // Pequeño zoom rebote
        zoomCard(targetCardEl);
      }
    } else if (entry.result === 'evaded') {
      spawnFloatingText(targetCardEl, '¡Esquivó!', 'evaded');
      flashCard(targetCardEl, 'evaded');
      spawnDodgePuff(targetCardEl);
    } else if (entry.result === 'blocked') {
      spawnFloatingText(targetCardEl, 'Bloqueado', 'blocked');
      flashCard(targetCardEl, 'blocked');
      shakeElement(targetCardEl, 'soft');
    } else if (entry.result === 'miss') {
      spawnFloatingText(targetCardEl, 'Falló', 'miss');
    } else if (entry.result === 'fumble') {
      // El atacante mismo se ve afectado: buscamos su card si es enemigo
      // (si es player, es el log que muestra el fumble)
      spawnFloatingText(targetCardEl, 'Falló feo', 'miss');
    }
  }

  function spawnFloatingNumber(el, text, kind) {
    const num = document.createElement('div');
    num.className = `combat-floating-num is-${kind}`;
    num.textContent = text;
    el.appendChild(num);
    setTimeout(() => { try { num.remove(); } catch (e) {} }, 1200);
  }

  function spawnFloatingText(el, text, kind) {
    const t = document.createElement('div');
    t.className = `combat-floating-text is-${kind}`;
    t.textContent = text;
    el.appendChild(t);
    setTimeout(() => { try { t.remove(); } catch (e) {} }, 1200);
  }

  function shakeElement(el, intensity = 'normal') {
    el.classList.remove('is-shaking', 'is-shaking-strong', 'is-shaking-soft');
    void el.offsetWidth;
    if (intensity === 'strong') el.classList.add('is-shaking-strong');
    else if (intensity === 'soft') el.classList.add('is-shaking-soft');
    else el.classList.add('is-shaking');
    setTimeout(() => {
      try { el.classList.remove('is-shaking', 'is-shaking-strong', 'is-shaking-soft'); }
      catch (e) {}
    }, intensity === 'strong' ? 500 : 350);
  }

  /**
   * Aplica un "flash" de color al borde y fondo de la card (rojo daño, naranja crit, etc).
   */
  function flashCard(el, kind) {
    const cls = `is-flash-${kind}`;
    el.classList.remove('is-flash-damage', 'is-flash-crit', 'is-flash-evaded', 'is-flash-blocked');
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => { try { el.classList.remove(cls); } catch (e) {} }, 600);
  }

  /**
   * Slash diagonal que cruza la card brevemente (efecto de tajo).
   */
  function spawnSlash(el, kind) {
    const slash = document.createElement('div');
    slash.className = `combat-slash is-${kind}`;
    // Ángulo aleatorio para variar (-60 a -30)
    const angle = -45 + (Math.random() * 30 - 15);
    slash.style.setProperty('--slash-angle', `${angle}deg`);
    el.appendChild(slash);
    setTimeout(() => { try { slash.remove(); } catch (e) {} }, 500);
  }

  /**
   * Partículas que salen desde el centro de la card al recibir golpe.
   * count: cantidad de partículas
   */
  function spawnParticles(el, kind, count) {
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = `combat-particle is-${kind}`;
      // Dirección aleatoria
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 40; // px de distancia final
      const dx = Math.cos(angle) * speed;
      const dy = Math.sin(angle) * speed;
      p.style.setProperty('--dx', `${dx.toFixed(0)}px`);
      p.style.setProperty('--dy', `${dy.toFixed(0)}px`);
      // Tamaño y delay aleatorio
      const size = 4 + Math.random() * 4;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      const delay = Math.random() * 80;
      p.style.animationDelay = `${delay}ms`;
      el.appendChild(p);
      setTimeout(() => { try { p.remove(); } catch (e) {} }, 800 + delay);
    }
  }

  /**
   * "Puff" de esquiva: pequeñas líneas en arco que indican que el ataque pasó de largo.
   */
  function spawnDodgePuff(el) {
    for (let i = 0; i < 5; i++) {
      const p = document.createElement('div');
      p.className = 'combat-dodge-puff';
      const angle = -120 + i * 60; // arco de 60° de spread
      const speed = 25 + Math.random() * 15;
      const rad = angle * Math.PI / 180;
      const dx = Math.cos(rad) * speed;
      const dy = Math.sin(rad) * speed;
      p.style.setProperty('--dx', `${dx.toFixed(0)}px`);
      p.style.setProperty('--dy', `${dy.toFixed(0)}px`);
      p.style.animationDelay = `${i * 30}ms`;
      el.appendChild(p);
      setTimeout(() => { try { p.remove(); } catch (e) {} }, 700);
    }
  }

  /**
   * Pequeño zoom rebote en críticos (escala 1.0 → 1.08 → 1.0).
   */
  function zoomCard(el) {
    el.classList.remove('is-zooming');
    void el.offsetWidth;
    el.classList.add('is-zooming');
    setTimeout(() => { try { el.classList.remove('is-zooming'); } catch (e) {} }, 400);
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
