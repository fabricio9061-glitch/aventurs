/* ============================================================
   Aventurs — View: Combat (v1.9.1)
   - Tarjetas de tamaño fijo: todas tienen las mismas filas
     (nombre, vida, barra fina, 4 stats). Los efectos van como
     íconos sobre el sprite, así nunca agrandan la tarjeta.
   - Narrador: cuenta cada acción con palabras, cuando cae el dado
   - Crónica en prosa; las tiradas técnicas se ven con "Ver tiradas"
   - Sin emojis: íconos pixelados (A.ItemSprites.icon) y sprites
   - Lo que el dado todavía no decidió no se muestra (vida, relato)
   - Solo se redibuja la parte que cambió: los botones no se
     reemplazan mientras tocás, y los clics van por delegación
   - Si tocás Atacar en el turno de otro, el ataque queda en cola
   ============================================================ */

(function (A) {
  'use strict';

  let mainEl = null;
  let unsubs = [];
  let resultTimer = null;
  let revealTimer = null;
  let queueTimer = null;
  let queuedAction = null;

  let layout = null;          // 'arena' | 'result' | 'empty'
  let lastHtml = {};          // sección -> HTML dibujado
  let lastSayKey = null;
  let resultFor = null;

  const SECTIONS = ['header', 'arena', 'narrator', 'actions', 'loghead', 'loglist'];

  const ROLLS_KEY = 'aventurs:combat-rolls';
  let showRolls = readRollsPref();
  function readRollsPref() { try { return localStorage.getItem(ROLLS_KEY) === '1'; } catch (e) { return false; } }
  function saveRollsPref(v) { try { localStorage.setItem(ROLLS_KEY, v ? '1' : '0'); } catch (e) { /* sin almacenamiento */ } }

  function Fx() { return A.CombatFx; }
  function esc(s) { return A.Utils.escapeHtml(String(s == null ? '' : s)); }
  function icon(name, size, cls) { return A.ItemSprites && A.ItemSprites.icon ? A.ItemSprites.icon(name, { size, cls }) : ''; }
  const now = () => performance.now();

  // ============================================================
  // Render
  // ============================================================

  function render() {
    if (!mainEl) return;
    const c = A.State.combat;
    if (!c) {
      layout = 'empty';
      lastHtml = {};
      mainEl.innerHTML = `<div class="empty-tab">Sin combate activo.</div>`;
      return;
    }
    if (c.result) {
      const wait = Fx() ? Fx().resultWait() : 0;
      if (wait > 0) {
        renderArena(c, true);
        clearTimeout(resultTimer);
        resultTimer = setTimeout(render, wait + 30);
        return;
      }
      renderResult(c);
      return;
    }
    renderArena(c, false);
  }

  /** Lo que ya pasó: corta en la primera acción cuyo dado todavía no cayó. */
  function revealedLog(c) {
    const log = c.log || [];
    const t = now();
    clearTimeout(revealTimer);
    for (let i = 0; i < log.length; i++) {
      if (log[i]._at != null && log[i]._at > t + 5) {
        revealTimer = setTimeout(render, log[i]._at - t + 20);
        return log.slice(0, i);
      }
    }
    return log;
  }

  function renderArena(c, frozen) {
    const log = c.log || [];
    const shown = revealedLog(c);
    const busy = shown.length < log.length;
    const snap = busy && shown.length ? shown[shown.length - 1]._hp || null : null;
    const ready = !frozen && !busy && isPlayerTurnLocal(c);
    const say = narratorParts(shown);

    const secs = {
      header: headerHtml(c, frozen, snap),
      arena: arenaHtml(c, frozen, snap),
      narrator: say.html,
      actions: actionsHtml(c, frozen, ready, busy),
      loghead: logHeadHtml(),
      loglist: `<div class="combat-log-list" id="combat-log-list" data-sec="loglist">${chronicleHtml(shown, { rolls: showRolls, combat: c })}</div>`,
    };

    const root = layout === 'arena' ? mainEl.querySelector('.combat-view.cb') : null;
    if (!root) {
      layout = 'arena';
      resultFor = null;
      mainEl.innerHTML = `
        <section class="combat-view cb">
          ${secs.header}
          <div class="cb-stage">${secs.arena}${secs.narrator}</div>
          ${secs.actions}
          <section class="cb-log">${secs.loghead}${secs.loglist}</section>
        </section>`;
      lastHtml = { ...secs };
      const list = mainEl.querySelector('[data-sec="loglist"]');
      if (list) list.scrollTop = list.scrollHeight;
    } else {
      for (const k of SECTIONS) {
        if (lastHtml[k] === secs[k]) continue;
        const old = root.querySelector(`[data-sec="${k}"]`);
        const tpl = document.createElement('template');
        tpl.innerHTML = secs[k].trim();
        const fresh = tpl.content.firstElementChild;
        if (!old || !fresh) continue;
        if (k === 'loglist') {
          const stick = old.scrollTop + old.clientHeight >= old.scrollHeight - 40;
          const prevTop = old.scrollTop;
          old.replaceWith(fresh);
          fresh.scrollTop = stick ? fresh.scrollHeight : prevTop;
        } else {
          old.replaceWith(fresh);
        }
        lastHtml[k] = secs[k];
      }
    }

    if (say.key !== lastSayKey) {
      lastSayKey = say.key;
      const n = mainEl.querySelector('[data-sec="narrator"]');
      if (n && say.key !== 'none') n.classList.add('is-new');
    }
    if (Fx()) Fx().afterRender();
    if (ready) maybeRunQueued();
  }

  function isPlayerTurnLocal(c) {
    if (!c || !c.initiative) return false;
    const cur = c.initiative[c.currentActorIdx];
    return !!cur && cur.kind === 'player';
  }

  /** Si tocaste Atacar en el turno de otro, sale apenas te toca (y el dado anterior cayó). */
  function maybeRunQueued() {
    if (!queuedAction) return;
    clearTimeout(queueTimer);
    queueTimer = setTimeout(() => {
      const c = A.State.combat;
      if (!queuedAction || !c || c.result || !isPlayerTurnLocal(c)) return;
      if (revealedLog(c).length < (c.log || []).length) return; // todavía rueda un dado
      const q = queuedAction;
      queuedAction = null;
      if (q === 'attack') A.Combat.playerAttack();
    }, 150);
  }

  // ============================================================
  // Cabecera
  // ============================================================

  function headerHtml(c, frozen, snap) {
    return `
      <header class="cb-header" data-sec="header">
        <div class="cb-title">
          ${icon('swords', 32, 'cb-title-icon')}
          <span class="cb-title-text">Combate</span>
          <span class="cb-round">Ronda ${c.round}</span>
        </div>
        ${turnQueueHtml(c, frozen, snap)}
      </header>`;
  }

  function turnQueueHtml(c, frozen, snap) {
    if (!c.initiative || c.initiative.length === 0) return '';
    const items = c.initiative.map((a, idx) => {
      const isActive = !frozen && idx === c.currentActorIdx;
      const kindCls = a.kind === 'enemy' ? 'is-enemy' : a.kind === 'pet' ? 'is-pet' : 'is-player';
      return `<span class="turn-queue-item ${kindCls} ${isActive ? 'is-active' : ''} ${isActorDead(c, a, snap) ? 'is-dead' : ''}">${esc(a.name)}</span>`;
    }).join('<span class="turn-queue-arrow">›</span>');
    return `<div class="combat-turn-queue">${items}</div>`;
  }

  /** Con la foto de vida (snap) no se adelanta una muerte que el dado todavía no mostró. */
  function isActorDead(c, actor, snap) {
    const hpOf = (key, cur) => (snap && snap[key] != null ? snap[key] : cur);
    if (actor.kind === 'enemy') {
      const inst = c.enemies.find((e) => e.instanceId === actor.id);
      return !inst || hpOf(`enemy:${inst.instanceId}`, inst.hp) <= 0;
    }
    if (actor.kind === 'player') return hpOf('player', A.State.player.hp) <= 0;
    if (actor.kind === 'pet') return !A.State.player.pet || hpOf('pet', A.State.player.pet.health) <= 0;
    return false;
  }

  // ============================================================
  // Arena y tarjetas (todas con la misma estructura)
  // ============================================================

  function arenaHtml(c, frozen, snap) {
    const p = A.State.player;
    const target = frozen ? null : A.Combat.getTarget();
    const targetId = target ? target.instanceId : null;
    const cur = frozen ? null : (c.initiative ? c.initiative[c.currentActorIdx] : null);
    const showPet = p.pet && (p.pet.health > 0 || (Fx() && Fx().isDying('pet')) || (snap && snap.pet > 0));
    const n = c.enemies.length;
    const units = n + 1 + (showPet ? 1 : 0);
    const shown = (key, value) => (snap && snap[key] != null ? snap[key] : value);

    return `
      <div class="cb-arena ${c.ambush ? 'is-ambush' : ''} units-${Math.min(units, 7)} enemies-${Math.min(n, 5)}" data-sec="arena">
        <div class="cb-side cb-allies">
          ${playerCard(p, cur && cur.kind === 'player', c, shown)}
          ${showPet ? petCard(p.pet, cur && cur.kind === 'pet', shown) : ''}
        </div>
        <div class="cb-vs" aria-hidden="true"><span>VS</span></div>
        <div class="cb-side cb-enemies">
          ${c.enemies.map((e, i) => enemyCard(e, i, e.instanceId === targetId && !frozen,
            cur && cur.kind === 'enemy' && cur.id === e.instanceId, shown)).join('')}
        </div>
      </div>`;
  }

  function pct(cur, max) {
    if (!max) return 0;
    return Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
  }

  function mods(entity) {
    return A.Balance && A.Balance.statusMods ? A.Balance.statusMods(entity) : { attackPenalty: 0, defensePenalty: 0 };
  }

  function effectsHtml(effects) {
    const list = effects || [];
    if (!list.length) return '';
    const max = list.length > 4 ? 3 : 4;
    const chips = list.slice(0, max).map((ef) => {
      const label = A.Combat.effectLabel ? A.Combat.effectLabel(ef.type) : ef.type;
      return `<span class="cb-fx effect-${esc(ef.type)}" title="${esc(label)}: ${ef.turns} ${ef.turns === 1 ? 'turno' : 'turnos'}">${icon(ef.type, 16, 'px-soft')}<b>${ef.turns}</b></span>`;
    }).join('');
    const more = list.length > max ? `<span class="cb-fx cb-fx-more" title="${list.length - max} efectos más">+${list.length - max}</span>` : '';
    return `<div class="cb-fx-row">${chips}${more}</div>`;
  }

  function stat(label, value, title, down) {
    return `<span class="cb-stat ${down ? 'is-down' : ''}" title="${esc(title)}"><i>${label}</i><b>${esc(value)}</b></span>`;
  }

  function unitCard(u) {
    const hpP = pct(u.hp, u.hpMax);
    const hpState = hpP < 25 ? 'is-critical' : hpP < 50 ? 'is-warning' : '';
    const sub = u.sub
      ? `<div class="cb-subbar ${u.sub.cls}" title="${esc(u.sub.title)}"><span style="width:${pct(u.sub.cur, u.sub.max)}%"></span></div>`
      : '<div class="cb-subbar is-empty" aria-hidden="true"></div>';
    const tag = u.clickable ? 'button' : 'div';
    const cls = ['cb-unit', `is-${u.kind}`, u.cat ? `cat-${u.cat}` : '',
      u.isActive ? 'is-active' : '', u.isTarget ? 'is-target' : '', u.dead ? 'is-dead' : '', u.ko ? 'is-ko' : ''].filter(Boolean).join(' ');
    const attrs = [
      tag === 'button' ? 'type="button"' : '',
      `class="${cls}"`,
      `data-fx-key="${esc(u.key)}"`,
      u.targetId ? `data-target="${esc(u.targetId)}"` : '',
      `style="--i:${u.i || 0}"`,
      u.dead && tag === 'button' ? 'disabled' : '',
      `title="${esc(u.title || u.name)}"`,
    ].filter(Boolean).join(' ');
    return `
      <${tag} ${attrs}>
        <div class="cb-sprite">
          ${effectsHtml(u.effects)}
          ${u.sprite}
          <span class="cb-shadow"></span>
          ${u.isTarget && !u.dead ? '<span class="cb-target-mark" aria-label="objetivo">▼</span>' : ''}
        </div>
        <div class="cb-plate">
          <div class="cb-plate-head">
            <span class="cb-name">${esc(u.name)}</span>
            <span class="cb-badges">${u.badges || ''}</span>
          </div>
          <div class="cb-hp">
            <div class="bar ${u.barCls} ${hpState}"><i class="bar-lag" style="width:${hpP}%"></i><span data-bar-key="hp:${esc(u.key)}" data-bar-owner="${esc(u.key)}" style="width:${hpP}%"></span></div>
            <span class="cb-hp-num num">${Math.max(0, u.hp)}<small>/${u.hpMax}</small></span>
          </div>
          ${sub}
          <div class="cb-stats">${u.stats.join('')}</div>
        </div>
        ${u.dead ? '<div class="cb-dead-tag">Caído</div>' : ''}
      </${tag}>`;
  }

  function playerCard(p, isActive, c, shown) {
    const race = A.Data.getById('races', p.raceId);
    const st = A.Balance && A.Balance.playerCombatStats ? A.Balance.playerCombatStats(p) : { attack: 0, defense: 10, armor: 0 };
    const m = mods(p);
    const composed = A.Combat.composePlayerDamage ? A.Combat.composePlayerDamage(p) : null;
    const dmg = composed ? String(composed.expression).replace(/\s+/g, '') : '1d3';
    const dmgTip = composed && composed.components ? composed.components.map((x) => `${x.label}: ${x.expr}`).join(' · ') : 'Daño de tu arma';
    const hp = c && c.result === 'defeat' ? 0 : shown('player', p.hp);
    const mana = shown('mana', p.mana);
    return unitCard({
      kind: 'player', key: 'player', i: 0, isActive,
      name: p.name, title: `${p.name} · ${race ? race.name : ''} de nivel ${p.level}`,
      badges: `<span class="cb-badge is-gold">Nv ${p.level}</span>`,
      sprite: A.Sprites ? A.Sprites.heroFor(p, { size: 128 }) : '',
      hp, hpMax: p.maxHp, barCls: 'bar-hp',
      sub: p.hasMagic ? { cls: 'is-mana', cur: mana, max: p.maxMana, title: `Maná ${mana}/${p.maxMana}` } : null,
      effects: p.effects,
      stats: [
        stat('ATQ', `+${st.attack || 0}`, 'Ataque: lo que sumás al D20 para pegar', m.attackPenalty > 0),
        stat('DEF', st.defense, 'Defensa: lo que el enemigo tiene que sacar para pegarte', m.defensePenalty > 0),
        stat('DAÑO', dmg, dmgTip),
        stat('ARM', st.armor || 0, 'Armadura: se resta a cada golpe que recibís'),
      ],
    });
  }

  function petCard(pet, isActive, shown) {
    const lvl = pet.level || 1;
    const m = mods(pet);
    const atk = (pet.attack != null ? pet.attack : (A.Balance && A.Balance.Pet ? A.Balance.Pet.attack(lvl) : 1)) - m.attackPenalty;
    const hp = shown('pet', pet.health);
    return unitCard({
      kind: 'pet', key: 'pet', i: 1, isActive, ko: hp <= 0,
      name: pet.name, title: `${pet.name}, tu mascota (nivel ${lvl})`,
      badges: `<span class="cb-badge is-green">Nv ${lvl}</span>`,
      sprite: A.Sprites ? A.Sprites.petHtml(pet, { size: 96 }) : '',
      hp, hpMax: pet.maxHealth, barCls: 'bar-pet-hp',
      sub: pet.food != null ? { cls: 'is-food', cur: pet.food, max: pet.maxFood || 10, title: `Saciedad ${pet.food}/${pet.maxFood || 10}` } : null,
      effects: pet.effects,
      stats: [
        stat('ATQ', `+${atk}`, 'Ataque de tu mascota', m.attackPenalty > 0),
        stat('DEF', 8 + (pet.dodge || 0) - m.defensePenalty, 'Defensa de tu mascota', m.defensePenalty > 0),
        stat('DAÑO', String(pet.damage || '1d3').replace(/\s+/g, ''), 'Daño de tu mascota'),
        stat('ARM', pet.armor || 0, 'Armadura de tu mascota'),
      ],
    });
  }

  function enemyCard(e, idx, isTarget, isActive, shown) {
    const key = `enemy:${e.instanceId}`;
    const hp = shown(key, e.hp);
    const dying = Fx() && Fx().isDying(key);
    const dead = hp <= 0 && !dying;
    const cat = e.category || 'normal';
    const m = mods(e);
    const catBadge = cat === 'boss' ? '<span class="cb-badge is-cat-boss">Jefe</span>'
      : cat === 'strong' ? '<span class="cb-badge is-cat-strong">Fuerte</span>' : '';
    return unitCard({
      kind: 'enemy', key, targetId: e.instanceId, clickable: true, i: idx + 2,
      cat, isTarget: isTarget && !dead, isActive, dead,
      name: e.displayName, title: dead ? `${e.displayName} (caído)` : `${e.displayName}: tocá para apuntarle`,
      badges: `<span class="cb-badge" title="Nivel de peligro">T${e.tier}</span>${catBadge}`,
      sprite: A.Sprites ? A.Sprites.html(e, { size: 128 }) : '',
      hp, hpMax: e.maxHp, barCls: 'bar-enemy-hp',
      sub: null,
      effects: e.effects,
      stats: [
        stat('ATQ', `+${(e.attack || 0) - m.attackPenalty}`, 'Ataque: lo que suma al D20', m.attackPenalty > 0),
        stat('DEF', (e.difficulty || 10) - m.defensePenalty, 'Defensa: lo que tenés que sacar con D20 + ataque', m.defensePenalty > 0),
        stat('DAÑO', String(e.damage || '1d3').replace(/\s+/g, ''), 'Daño de sus golpes'),
        stat('ARM', e.armor || 0, 'Armadura: se resta a tus golpes'),
      ],
    });
  }

  // ============================================================
  // Narrador (las dos últimas frases)
  // ============================================================

  function narratorParts(shown) {
    const picked = [];
    for (let i = shown.length - 1; i >= 0 && picked.length < 2; i--) {
      const e = shown[i];
      if (!e.say || !e.say.text) continue;
      if (e.fx && e.fx.kind === 'reward') continue; // el botín se ve en el resultado
      picked.unshift({ e, i });
    }
    if (!picked.length) {
      return { key: 'none', html: `<div class="cb-narrator" data-sec="narrator"><p class="cb-say is-now tone-neutral">El aire se pone tenso…</p></div>` };
    }
    const last = picked[picked.length - 1];
    const prev = picked.length > 1 ? picked[0] : null;
    const key = `${last.i}:${last.e.ts}`;
    return {
      key,
      html: `
        <div class="cb-narrator" data-sec="narrator" data-say="${esc(key)}" role="status" aria-live="polite">
          ${prev ? `<p class="cb-say is-prev tone-${prev.e.say.tone}">${esc(prev.e.say.text)}</p>` : ''}
          <p class="cb-say is-now tone-${last.e.say.tone}">${esc(last.e.say.text)}</p>
        </div>`,
    };
  }

  // ============================================================
  // Acciones
  // ============================================================

  function waitingText(c, busy) {
    const cur = c && c.initiative ? c.initiative[c.currentActorIdx] : null;
    let txt = 'Nueva ronda…';
    if (cur && cur.kind === 'player') txt = busy ? 'Ya casi es tu turno…' : 'Tu turno.';
    else if (cur && cur.kind === 'pet') txt = `Turno de ${esc(cur.name)}, tu mascota…`;
    else if (cur && cur.kind === 'enemy') {
      const inst = c.enemies.find((e) => e.instanceId === cur.id);
      txt = `Turno de ${esc(inst ? inst.displayName : cur.name)}…`;
    } else if (cur) txt = 'Esperando…';
    if (queuedAction === 'attack') txt += ' <strong>Tu ataque sale apenas te toque.</strong>';
    return txt;
  }

  function tameInfoFor(c, p) {
    const alive = (c.enemies || []).filter((e) => e.hp > 0);
    if (p.pet || alive.length !== 1 || !A.Tame) return null;
    const one = alive[0];
    const data = A.Data.getById('enemies', one.id);
    if (!data || !data.tameable) return null;
    const check = A.Tame.canTame(data.id, one.instanceId);
    if (check.ok) return { instanceId: one.instanceId, chance: Math.round(A.Tame.chanceFor(data, one) * 100) };
    if (check.reason === 'missing-item') {
      const item = A.Data.getById('items', check.requiredItemId);
      return { instanceId: one.instanceId, disabled: true, tooltip: `Necesitás ${item ? item.name : check.requiredItemId} para intentar domarlo` };
    }
    if (check.reason === 'instance-failed') return { disabled: true, tooltip: 'Esta criatura ya desconfía de vos' };
    if (check.reason === 'level-too-low') return { disabled: true, tooltip: `Necesitás nivel ${check.requiredLevel} para domarla` };
    return null;
  }

  function actionsHtml(c, frozen, ready, busy) {
    if (frozen) {
      return `<section class="cb-actions is-waiting" data-sec="actions"><div class="cb-turn-line">&nbsp;</div><div class="cb-action-row is-empty"></div></section>`;
    }
    const p = A.State.player;
    const spells = A.Combat.availableSpells();
    const items = A.Combat.availableItems();
    const tame = tameInfoFor(c, p);
    const target = A.Combat.getTarget();
    const hit = target && A.Combat.hitChanceVs ? A.Combat.hitChanceVs(target) : null;
    const attackIcon = p.equipment && p.equipment.weapon && A.ItemSprites
      ? A.ItemSprites.html(p.equipment.weapon, { size: 32 }) : icon('fist', 32);
    const off = !ready;

    const btn = (action, iconHtml, label, opts = {}) => `
      <button type="button" class="combat-action-btn cb-btn ${opts.cls || ''}" data-combat-action="${action}" ${opts.disabled ? 'disabled' : ''} title="${esc(opts.title || label)}" ${opts.attrs || ''}>
        <span class="cb-btn-icon">${iconHtml}</span>
        <span class="cb-btn-text">
          <span class="combat-action-label">${label}</span>
          <span class="cb-btn-hint">${opts.hint || '&nbsp;'}</span>
        </span>
      </button>`;

    return `
      <section class="cb-actions ${ready ? 'is-your-turn' : 'is-waiting'}" data-sec="actions">
        <div class="cb-turn-line">${ready ? '<strong>Tu turno.</strong> Elegí qué hacer. Tocá a un enemigo para apuntarle.' : waitingText(c, busy)}</div>
        <div class="combat-action-row cb-action-row">
          ${btn('attack', attackIcon, 'Atacar', {
            cls: `is-primary ${queuedAction === 'attack' ? 'is-queued' : ''}`,
            title: ready ? 'Atacar al objetivo marcado' : 'Tocalo ahora y atacás apenas te toque',
            hint: hit != null ? `${Math.round(hit * 100)}% de pegar` : '',
          })}
          ${p.hasMagic ? btn('spell', icon('spell', 32), 'Hechizo', {
            disabled: off || spells.length === 0,
            title: spells.length === 0 ? 'No conocés hechizos' : 'Lanzar un hechizo',
            hint: `${p.mana}/${p.maxMana} maná`,
          }) : ''}
          ${btn('item', icon('potion', 32), 'Objeto', {
            disabled: off || items.length === 0,
            title: items.length === 0 ? 'No tenés pociones ni comida' : 'Usar una poción o comida',
            hint: items.length ? `${items.length} a mano` : 'nada a mano',
          })}
          ${tame ? btn('tame', icon('paw', 32), 'Domar', {
            cls: 'combat-action-tame',
            disabled: off || tame.disabled,
            title: tame.tooltip || 'Intentar domesticarla',
            hint: tame.chance != null ? `${tame.chance}% de lograrlo` : 'no se puede',
            attrs: `data-tame-instance-id="${esc(tame.instanceId || '')}"`,
          }) : ''}
          ${btn('flee', icon('boot', 32), 'Huir', {
            disabled: off,
            title: 'Intentar escapar (hasta 2 intentos)',
            hint: `${Math.max(0, 2 - (c.fleeAttempts || 0))} intentos`,
          })}
        </div>
      </section>`;
  }

  // ============================================================
  // Crónica en prosa (la usan también el resultado y el historial)
  // ============================================================

  function logHeadHtml() {
    return `
      <div class="combat-log-header" data-sec="loghead">
        <span class="combat-log-title">Crónica del combate</span>
        <label class="cb-rolls-toggle" title="Muestra los dados y las cuentas de cada acción">
          <input type="checkbox" data-combat-toggle="rolls" ${showRolls ? 'checked' : ''}>
          <span>Ver tiradas</span>
        </label>
      </div>`;
  }

  function whoKey(fx) {
    if (!fx) return null;
    if (['attack', 'spell', 'heal', 'cast', 'flee'].includes(fx.kind)) return fx.actor || 'player';
    if (['tick', 'status', 'stun', 'death', 'tamed', 'tame-fail'].includes(fx.kind)) return fx.target;
    return null;
  }

  function lineAvatar(entry, c) {
    const fx = entry.fx || {};
    const p = A.State.player;
    const key = whoKey(fx);
    if (key === 'player') return A.Sprites ? A.Sprites.heroFor(p, { size: 32 }) : '';
    if (key === 'pet' && p.pet) return A.Sprites ? A.Sprites.petHtml(p.pet, { size: 32 }) : '';
    if (key && String(key).startsWith('enemy:') && c) {
      const inst = (c.enemies || []).find((e) => `enemy:${e.instanceId}` === key);
      if (inst && A.Sprites) return A.Sprites.html(inst, { size: 32 });
    }
    if (fx.kind === 'reward') {
      if (fx.levelUp) return icon('up', 32);
      if (fx.coins) return icon('coin', 32);
      if (fx.items && fx.items[0] && A.ItemSprites) return A.ItemSprites.html(fx.items[0].itemId, { size: 32 });
      return icon('xp', 32);
    }
    if (fx.kind === 'start') return icon('swords', 32);
    if (fx.kind === 'defeat') return icon('skull', 32);
    return '';
  }

  function rollsHtml(entry) {
    const parts = [];
    if (entry.roll != null) {
      const bonus = entry.bonus ? ` ${entry.bonus > 0 ? '+' : '−'} ${Math.abs(entry.bonus)} = <b>${entry.total}</b>` : '';
      const vs = entry.vs != null ? ` contra ${esc(entry.vsLabel === 'DC huida' ? 'huida' : (entry.vsLabel || 'defensa'))} <b>${entry.vs}</b>` : '';
      const nat = entry.roll === 20 ? 'is-nat20' : entry.roll === 1 ? 'is-nat1' : '';
      parts.push(`<span class="die-pill ${nat}">${entry.roll}</span> D20${bonus}${vs}`);
    }
    if (entry.dmg != null && entry.dmg > 0 && (entry.result === 'hit' || entry.result === 'crit' || (entry.fx && entry.fx.kind === 'spell'))) {
      const dice = entry.damageDice ? `<span class="dice-pill">${esc(String(entry.damageDice).replace(/\s+/g, ''))}</span> ` : '';
      const red = entry.targetArmor && entry.rawDmg != null ? ` (${entry.rawDmg} − ${entry.targetArmor} de armadura)` : '';
      const life = entry.hpAfter != null ? ` · queda ${entry.hpAfter}/${entry.hpMax}` : '';
      parts.push(`${dice}<b>${entry.dmg}</b> de daño${red}${life}`);
    }
    if (!parts.length && entry.text && entry.fx && ['tick', 'heal'].includes(entry.fx.kind)) parts.push(esc(entry.text));
    return parts.length ? `<div class="cb-rolls">${parts.join('<span class="cb-rolls-sep">·</span>')}</div>` : '';
  }

  function chronicleHtml(entries, opts = {}) {
    const c = opts.combat || A.State.combat;
    const out = [];
    for (const e of entries || []) {
      if (e.type === 'turn-header') {
        out.push(`<div class="combat-log-divider"><span>Ronda ${e.turnNumber || ''}</span></div>`);
        continue;
      }
      const say = e.say && e.say.text ? e.say : null;
      if (!say) {
        if (opts.rolls && e.text) out.push(`<div class="cb-line is-tech"><span class="cb-line-who"></span><span class="cb-line-body"><span class="cb-line-text">${esc(e.text)}</span></span></div>`);
        continue;
      }
      out.push(`
        <div class="cb-line tone-${say.tone}">
          <span class="cb-line-who">${lineAvatar(e, c)}</span>
          <span class="cb-line-body">
            <span class="cb-line-text">${esc(say.text)}</span>
            ${opts.rolls ? rollsHtml(e) : ''}
          </span>
        </div>`);
    }
    return out.length ? out.join('') : '<div class="cb-line is-empty">Todavía no pasó nada.</div>';
  }

  // ============================================================
  // Resultado
  // ============================================================

  function coinChip(copper) {
    const g = Math.floor(copper / 10000);
    const s = Math.floor((copper % 10000) / 100);
    const cu = copper % 100;
    const coin = (id, n, word) => (n ? `<span class="cb-coin">${A.ItemSprites ? A.ItemSprites.html(id, { size: 32 }) : ''}<span><b>${n}</b> ${word}</span></span>` : '');
    const words = A.Narrator ? A.Narrator.coinsInWords(copper) : `${copper} cobre`;
    return `<span class="cb-chip is-coins" title="${esc(words)}">${coin('coin_gold', g, 'oro')}${coin('coin_silver', s, 'plata')}${coin('coin_copper', cu, 'cobre')}</span>`;
  }

  function rewardChips(c) {
    const chips = [];
    let coins = 0;
    for (const e of c.log || []) {
      const fx = e.fx || {};
      if (fx.kind !== 'reward') continue;
      if (fx.xp) chips.push(`<span class="cb-chip">${icon('xp', 32)}<span><b>+${fx.xp}</b> experiencia</span></span>`);
      if (fx.coins) coins += fx.coins;
      if (fx.levelUp) chips.push(`<span class="cb-chip is-gold">${icon('up', 32)}<span>¡Nivel <b>${fx.levelUp}</b>!</span></span>`);
      if (fx.petXp && A.State.player.pet) chips.push(`<span class="cb-chip">${A.Sprites ? A.Sprites.petHtml(A.State.player.pet, { size: 32 }) : ''}<span><b>+${fx.petXp}</b> para ${esc(A.State.player.pet.name)}</span></span>`);
      for (const it of fx.items || []) {
        const d = A.Inventory && A.Inventory.resolveData ? A.Inventory.resolveData(it.itemId) : null;
        chips.push(`<span class="cb-chip">${A.ItemSprites ? A.ItemSprites.html(it.itemId, { size: 32 }) : ''}<span>${esc(d ? d.name : it.itemId)}${it.qty > 1 ? ` <b>×${it.qty}</b>` : ''}</span></span>`);
      }
    }
    if (coins > 0) chips.splice(Math.min(1, chips.length), 0, coinChip(coins));
    return chips;
  }

  function renderResult(c) {
    if (layout === 'result' && resultFor === c && mainEl.querySelector('.cb-result')) return;
    layout = 'result';
    resultFor = c;
    lastHtml = {};
    const r = c.result;
    const meta = {
      victory: { title: '¡Victoria!', icon: 'trophy', sub: 'El silencio vuelve al camino.' },
      tamed: { title: '¡Domesticada!', icon: 'heart', sub: 'Tenés una nueva compañera de viaje. Dale de comer lo que le gusta y descansá para curarla.' },
      defeat: { title: 'Caíste…', icon: 'skull', sub: 'Despertás en el pueblo, magullado. Vas a necesitar curarte.' },
      flee: { title: 'Escapaste', icon: 'boot', sub: 'Corriste hasta perderlos de vista.' },
    }[r] || { title: 'Fin del combate', icon: 'swords', sub: '' };
    const chips = rewardChips(c);
    const foes = c.enemies.map((e) => `<span class="cb-result-foe ${e.hp <= 0 ? 'is-fallen' : ''}" title="${esc(e.displayName)}">${A.Sprites ? A.Sprites.html(e, { size: 64 }) : ''}</span>`).join('');

    mainEl.innerHTML = `
      <section class="combat-result cb-result is-${r}">
        <div class="cb-result-card">
          <div class="cb-result-icon">${icon(meta.icon, 64)}</div>
          <h2 class="cb-result-title">${meta.title}</h2>
          <p class="cb-result-sub">${esc(meta.sub)}</p>
          <div class="cb-result-foes">${foes}</div>
          ${chips.length ? `<div class="cb-rewards">${chips.join('')}</div>` : ''}
          <button type="button" class="btn-primary cb-continue" data-combat-action="finish">Continuar</button>
          <details class="cb-result-log">
            <summary>Leer la crónica completa</summary>
            <div class="combat-result-log">${chronicleHtml(c.log, { rolls: showRolls, combat: c })}</div>
          </details>
        </div>
      </section>`;
  }

  // ============================================================
  // Eventos (delegados: sobreviven a los redibujos parciales)
  // ============================================================

  function onClick(ev) {
    if (!mainEl) return;
    const actEl = ev.target.closest ? ev.target.closest('[data-combat-action]') : null;
    if (actEl && mainEl.contains(actEl)) {
      if (!actEl.disabled) doAction(actEl.dataset.combatAction, actEl);
      return;
    }
    const tEl = ev.target.closest ? ev.target.closest('[data-target]') : null;
    if (tEl && mainEl.contains(tEl) && !tEl.disabled) A.Combat.setTarget(tEl.dataset.target);
  }

  function onChange(ev) {
    const t = ev.target;
    if (t && t.matches && t.matches('[data-combat-toggle="rolls"]')) {
      showRolls = !!t.checked;
      saveRollsPref(showRolls);
      render();
    }
  }

  function doAction(action, el) {
    const c = A.State.combat;
    if (action === 'attack') {
      const ready = c && !c.result && isPlayerTurnLocal(c) && revealedLog(c).length === (c.log || []).length;
      if (ready) A.Combat.playerAttack();
      else { queuedAction = queuedAction === 'attack' ? null : 'attack'; render(); }
    } else if (action === 'flee') A.Combat.playerFlee();
    else if (action === 'spell') A.State.openModal('combat-spell');
    else if (action === 'item') A.State.openModal('combat-item');
    else if (action === 'show-full-log') A.State.openModal('combat-full-log');
    else if (action === 'tame') {
      const instanceId = el.dataset.tameInstanceId;
      if (instanceId && A.Combat.playerTame) { A.Combat.playerTame(instanceId); render(); }
    } else if (action === 'finish') {
      const res = c && c.result;
      const wasVictory = res === 'victory' || res === 'tamed';
      const fromTravel = c && c.fromTravel;
      A.Combat.finish();
      if (wasVictory && fromTravel && A.State.traveling) A.Travel.step();
      if (A.Views.Shell && A.Views.Shell.rerender) A.Views.Shell.rerender();
    }
  }

  function subscribe() {
    unsubs.push(A.Bus.on('combat:started', () => { queuedAction = null; render(); introIfNew(); }));
    unsubs.push(A.Bus.on('combat:turn', render));
    unsubs.push(A.Bus.on('combat:action', (entry) => {
      if (Fx()) Fx().prepare(entry);
      render();
      if (Fx()) Fx().play(entry);
    }));
    unsubs.push(A.Bus.on('combat:ended', () => { queuedAction = null; render(); }));
    unsubs.push(A.Bus.on('combat:target-changed', render));
  }

  function unsubscribe() {
    unsubs.forEach((u) => u && u());
    unsubs = [];
  }

  // Combates que ya tuvieron su animación de entrada
  const introduced = new WeakSet();
  function introIfNew() {
    const c = A.State.combat;
    if (!c || c.result || introduced.has(c)) return;
    introduced.add(c);
    if (Fx()) Fx().start({ ambush: c.ambush });
  }

  function detach() {
    if (!mainEl) return;
    mainEl.removeEventListener('click', onClick);
    mainEl.removeEventListener('change', onChange);
  }

  const CombatView = {
    mount(container) {
      if (mainEl !== container) {
        detach();
        mainEl = container;
        layout = null;
        lastHtml = {};
        mainEl.addEventListener('click', onClick);
        mainEl.addEventListener('change', onChange);
      }
      if (Fx()) Fx().mount(container, { rerender: render });
      render();
      introIfNew();
      unsubscribe();
      subscribe();
    },
    unmount() {
      unsubscribe();
      clearTimeout(resultTimer);
      clearTimeout(revealTimer);
      clearTimeout(queueTimer);
      if (Fx()) Fx().unmount();
      detach();
      if (mainEl) mainEl.innerHTML = '';
      mainEl = null;
      queuedAction = null;
      layout = null;
      lastHtml = {};
      lastSayKey = null;
      resultFor = null;
    },
    isMounted() { return !!mainEl; },
    rerender: render,
    chronicleHtml,
  };

  A.Views = A.Views || {};
  A.Views.Combat = CombatView;
})(window.Aventurs);
