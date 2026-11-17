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

  // ---------- v3.0: en grupo ----------
  function me() { return A.State.me ? A.State.me() : A.State.player; }
  function localHid() { return A.State.hidOf ? A.State.hidOf(me()) : 'me'; }
  function heroOf(hid) { return A.State.heroById ? A.State.heroById(hid) : null; }
  /** Los héroes de la pelea, el propio primero. */
  function partyHeroes(c) {
    if (!c || !c.party) return [];
    const mine = localHid();
    const ids = (c.heroIds || []).slice().sort((a, b) => (a === mine ? -1 : b === mine ? 1 : 0));
    return ids.map((hid) => ({ hid, hero: heroOf(hid), gone: (c.goneHids || []).includes(hid) })).filter((x) => x.hero);
  }
  /** La frase de una acción, contada para esta compu (la del compañero, en tercera persona). */
  function sayFor(e) {
    if (!e || !e.say || !e.say.text) return null;
    if (!e.hid || e.hid === localHid() || !A.Persp) return { text: e.say.text, who: null };
    const h = heroOf(e.hid);
    const name = h ? h.name : 'Tu compañero';
    const text = A.Persp.third(e.say.text, name);
    return { text, who: A.Persp.named(text, name) ? null : name };
  }
  function techFor(e) {
    if (!e || !e.text) return '';
    if (!e.hid || e.hid === localHid() || !A.Persp) return e.text;
    const h = heroOf(e.hid);
    return A.Persp.third(e.text, h ? h.name : 'Tu compañero');
  }
  function whoTag(who) { return who ? `<b class="cb-who">${esc(who)}</b> ` : ''; }
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
        <section class="combat-view cb is-arena">
          ${secs.header}
          <div class="cb-stage">${secs.arena}${secs.narrator}</div>
          ${secs.actions}
          <section class="cb-log">${secs.loghead}${secs.loglist}</section>
        </section>`;
      lastHtml = { ...secs };
      fitToScreen();
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

  /**
   * v2.3: el combate entra entero en la pantalla (la crónica se desplaza por dentro).
   * Se mide dónde empieza la vista para darle el alto justo, y la página vuelve arriba.
   */
  function fitToScreen() {
    const view = mainEl && mainEl.querySelector('.combat-view.is-arena');
    if (!view) return;
    if (window.scrollY > 0) window.scrollTo(0, 0);
    const top = Math.round(view.getBoundingClientRect().top + window.scrollY);
    view.style.setProperty('--cb-top', `${top}px`);
  }
  function onResize() { fitToScreen(); }

  function isPlayerTurnLocal(c) {
    if (!c || !c.initiative) return false;
    const cur = c.initiative[c.currentActorIdx];
    if (!cur || cur.kind !== 'player') return false;
    // v3.0: en grupo, solo el turno de tu héroe
    return !c.party || cur.hid === localHid();
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
      const ally = c.party && a.kind !== 'enemy' && a.hid !== localHid();
      const kindCls = (a.kind === 'enemy' ? 'is-enemy' : a.kind === 'pet' ? 'is-pet' : 'is-player') + (ally ? ' is-ally' : '');
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
    if (c.party && (actor.kind === 'player' || actor.kind === 'pet')) {
      const h = heroOf(actor.hid);
      if (!h || (c.goneHids || []).includes(actor.hid)) return true;
      if (actor.kind === 'player') return hpOf(`hero:${actor.hid}`, h.hp) <= 0;
      return !h.pet || hpOf(`pet:${actor.hid}`, h.pet.health) <= 0;
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
    const n = c.enemies.length;
    const shown = (key, value) => (snap && snap[key] != null ? snap[key] : value);
    let allies = '';
    let units = n;
    if (c.party) {
      // v3.0: los dos héroes (el tuyo primero) con sus mascotas
      let i = 0;
      for (const { hid, hero, gone } of partyHeroes(c)) {
        const hk = `hero:${hid}`;
        const pk = `pet:${hid}`;
        const ally = hid !== localHid();
        allies += playerCard(hero, cur && cur.kind === 'player' && cur.hid === hid, c, shown, { key: hk, i: i++, ally, gone });
        units += 1;
        const pet = hero.pet;
        const showPet = pet && (pet.health > 0 || (Fx() && Fx().isDying(pk)) || (snap && snap[pk] > 0));
        if (showPet) { allies += petCard(pet, cur && cur.kind === 'pet' && cur.hid === hid, shown, { key: pk, i: i++, owner: ally ? hero.name : null }); units += 1; }
      }
    } else {
      const showPet = p.pet && (p.pet.health > 0 || (Fx() && Fx().isDying('pet')) || (snap && snap.pet > 0));
      allies = playerCard(p, cur && cur.kind === 'player', c, shown) + (showPet ? petCard(p.pet, cur && cur.kind === 'pet', shown) : '');
      units += 1 + (showPet ? 1 : 0);
    }

    return `
      <div class="cb-arena ${c.ambush ? 'is-ambush' : ''} ${c.party ? 'is-party' : ''} units-${Math.min(units, 9)} enemies-${Math.min(n, 5)}" data-sec="arena">
        <div class="cb-side cb-allies">
          ${allies}
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
    const max = list.length > 3 ? 2 : 3; // a la derecha va el dado: entran 3
    const chips = list.slice(0, max).map((ef) => {
      // v2.4: mejoras de pociones y pergaminos, aturdido y maldición también se ven
      const ch = A.ItemFx ? A.ItemFx.chip(ef) : { icon: ef.type, label: A.Combat.effectLabel ? A.Combat.effectLabel(ef.type) : ef.type, cls: ef.type };
      return `<span class="cb-fx effect-${esc(ch.cls || ef.type)}" title="${esc(ch.label)}: ${ef.turns} ${ef.turns === 1 ? 'turno' : 'turnos'}">${icon(ch.icon, 16, 'px-soft')}<b>${ef.turns}</b></span>`;
    }).join('');
    const more = list.length > max ? `<span class="cb-fx cb-fx-more" title="${list.length - max} efectos más">+${list.length - max}</span>` : '';
    return `<div class="cb-fx-row">${chips}${more}</div>`;
  }

  /** state: true o 'down' (bajó por un estado) · 'up' (subió: envalentonado, en guardia...). */
  function stat(label, value, title, state) {
    const long = String(value).length > 6 ? 'is-long' : '';
    const cls = state === 'up' ? 'is-up' : state ? 'is-down' : '';
    return `<span class="cb-stat ${cls} ${long}" title="${esc(title)}"><i>${label}</i><b>${esc(value)}</b></span>`;
  }

  /** v2.5: los números reales de la criatura en esta pelea (estados y pasivas incluidos). */
  function enemyNow(e) {
    if (A.Combat.enemyStats) return A.Combat.enemyStats(e);
    const m = mods(e);
    return { attack: (e.attack || 0) - m.attackPenalty, defense: (e.difficulty || 10) - m.defensePenalty, armor: e.armor || 0 };
  }
  const updown = (now, base) => (now > base ? 'up' : now < base ? 'down' : null);

  /** "2d4+1" con +1 -> "2d4+2"; si no se puede leer, "2d4+1+1". */
  function withFlat(dice, n) {
    if (!n) return dice;
    const m = /^(\d+d\d+)([+-]\d+)?$/.exec(dice);
    if (!m) return `${dice}${n > 0 ? '+' : ''}${n}`;
    const total = (m[2] ? Number(m[2]) : 0) + n;
    return total ? `${m[1]}${total > 0 ? '+' : ''}${total}` : m[1];
  }

  function unitCard(u) {
    const hpP = pct(u.hp, u.hpMax);
    const hpState = hpP < 25 ? 'is-critical' : hpP < 50 ? 'is-warning' : '';
    const sub = u.sub
      ? `<div class="cb-subbar ${u.sub.cls}" title="${esc(u.sub.title)}"><span style="width:${pct(u.sub.cur, u.sub.max)}%"></span></div>`
      : '<div class="cb-subbar is-empty" aria-hidden="true"></div>';
    const tag = u.clickable ? 'button' : 'div';
    const cls = ['cb-unit', `is-${u.kind}`, u.cat ? `cat-${u.cat}` : '', u.elite ? 'is-elite' : '',
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
          ${u.dc != null && A.ItemSprites && A.ItemSprites.dcBadge ? A.ItemSprites.dcBadge(u.dc, { size: 34, cls: 'cb-dc', title: u.dcTitle }) : ''}
          ${u.sprite}
          <span class="cb-shadow"></span>
          ${u.isTarget && !u.dead ? '<span class="cb-target-mark" aria-label="objetivo">▼</span>' : ''}
        </div>
        <div class="cb-plate">
          ${u.elite ? `<span class="cb-elite-mark" aria-hidden="true">${icon('elite', 40)}</span>` : ''}
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

  function playerCard(p, isActive, c, shown, o = {}) {
    const key = o.key || 'player';
    const race = A.Data.getById('races', p.raceId);
    const st = A.Balance && A.Balance.playerCombatStats ? A.Balance.playerCombatStats(p) : { attack: 0, defense: 10, armor: 0 };
    const m = mods(p);
    const composed = A.Combat.composePlayerDamage ? A.Combat.composePlayerDamage(p) : null;
    const dmg = composed ? (A.Utils.compactDice ? A.Utils.compactDice(composed.expression) : String(composed.expression).replace(/\s+/g, '')) : '1d3';
    const dmgTip = composed && composed.components ? composed.components.map((x) => `${x.label}: ${x.expr}`).join(' · ') : 'Daño de tu arma';
    const hp = c && c.result === 'defeat' ? 0 : shown(key, p.hp);
    const mana = shown(o.key ? key.replace(/^hero:/, 'mana:') : 'mana', p.mana);
    return unitCard({
      kind: o.ally ? 'player is-ally' : 'player', key, i: o.i || 0, isActive, dead: !!o.gone, ko: !o.gone && hp <= 0 && !!c.party,
      name: p.name, title: `${p.name} · ${race ? race.name : ''} de nivel ${p.level}${o.ally ? ' (tu compañero)' : ''}`,
      badges: `${o.ally ? '<span class="cb-badge is-ally" title="Tu compañero">Aliado</span>' : ''}<span class="cb-badge is-gold">Nv ${p.level}</span>`,
      sprite: A.Sprites ? A.Sprites.heroFor(p, { size: 128 }) : '',
      hp, hpMax: p.maxHp, barCls: 'bar-hp',
      sub: p.hasMagic ? { cls: 'is-mana', cur: mana, max: p.maxMana, title: `Maná ${mana}/${p.maxMana}` } : null,
      effects: p.effects,
      dc: st.defense,
      dcTitle: o.ally ? `Defensa de ${p.name}: ${st.defense}.` : `Tu defensa: un enemigo tiene que llegar a ${st.defense} (dado de 20 + su precisión) para pegarte.${m.defensePenalty > 0 ? ' Bajó por el frío.' : ''}`,
      stats: [
        stat('PREC', `+${st.attack || 0}`, 'Precisión: lo que sumás al dado de 20 para acertar', m.attackPenalty > 0),
        stat('DAÑO', dmg, dmgTip),
        stat('ARM', st.armor || 0, 'Armadura: se resta a cada golpe que recibís'),
        stat('VEL', st.speed || 10, 'Velocidad: el más rápido actúa primero'),
      ],
    });
  }

  function petCard(pet, isActive, shown, o = {}) {
    const key = o.key || 'pet';
    const lvl = pet.level || 1;
    const m = mods(pet);
    const atk = (pet.attack != null ? pet.attack : (A.Balance && A.Balance.Pet ? A.Balance.Pet.attack(lvl) : 1)) - m.attackPenalty;
    const hp = shown(key, pet.health);
    return unitCard({
      kind: o.owner ? 'pet is-ally' : 'pet', key, i: o.i != null ? o.i : 1, isActive, ko: hp <= 0,
      name: pet.name, title: o.owner ? `${pet.name}, la mascota de ${o.owner} (nivel ${lvl})` : `${pet.name}, tu mascota (nivel ${lvl})`,
      badges: `<span class="cb-badge is-green">Nv ${lvl}</span>`,
      sprite: A.Sprites ? A.Sprites.petHtml(pet, { size: 96 }) : '',
      hp, hpMax: pet.maxHealth, barCls: 'bar-pet-hp',
      sub: pet.food != null ? { cls: 'is-food', cur: pet.food, max: pet.maxFood || 10, title: `Saciedad ${pet.food}/${pet.maxFood || 10}` } : null,
      effects: pet.effects,
      dc: 8 + (pet.dodge || 0) - m.defensePenalty,
      dcTitle: `Dificultad de tu mascota: un enemigo tiene que llegar a ${8 + (pet.dodge || 0) - m.defensePenalty} para pegarle.`,
      stats: [
        stat('PREC', `+${atk}`, 'Precisión de tu mascota: lo que suma al dado para acertar', m.attackPenalty > 0),
        stat('DAÑO', String(pet.damage || '1d3').replace(/\s+/g, ''), 'Daño de tu mascota'),
        stat('ARM', pet.armor || 0, 'Armadura de tu mascota'),
        stat('VEL', pet.speed || 10, 'Velocidad de tu mascota'),
      ],
    });
  }

  function enemyCard(e, idx, isTarget, isActive, shown) {
    const key = `enemy:${e.instanceId}`;
    const hp = shown(key, e.hp);
    const dying = Fx() && Fx().isDying(key);
    const dead = hp <= 0 && !dying;
    const cat = e.category || 'normal';
    const now = enemyNow(e);
    // v2.5: la élite lleva su marca (y le gana a "Fuerte")
    // (para que entre el nombre, la élite muestra su título en vez del nivel: "Lobo [ALFA]")
    const catBadge = e.elite ? `<span class="cb-badge is-elite" title="Criatura de élite (nivel ${e.tier}): más vida, más daño y mejor botín">${esc(e.eliteTitle || 'Élite')}</span>`
      : cat === 'boss' ? '<span class="cb-badge is-cat-boss">Jefe</span>'
      : cat === 'strong' ? '<span class="cb-badge is-cat-strong">Fuerte</span>' : '';
    const shownName = e.elite && e.baseName ? `${e.baseName}${e.label ? ` ${e.label}` : ''}` : e.displayName;
    const skills = A.Skills ? A.Skills.listFor(e).map((sk) => sk.name).join(', ') : '';
    const fx = mods(e);
    // v2.5: envalentonado (+daño) o con miedo (-daño): se suma al dado ("2d4+1" -> "2d4+2")
    const dmgTxt = withFlat(String(e.damage || '1d3').replace(/\s+/g, ''), -(fx.damagePenalty || 0));
    return unitCard({
      kind: 'enemy', key, targetId: e.instanceId, clickable: true, i: idx + 2,
      cat, elite: !!e.elite, isTarget: isTarget && !dead, isActive, dead,
      name: shownName,
      title: dead ? `${e.displayName} (caído)` : `${e.displayName}: tocá para apuntarle${skills ? `\nHabilidades: ${skills}` : ''}`,
      badges: `${e.elite ? '' : `<span class="cb-badge" title="Nivel de peligro">Nv ${e.tier}</span>`}${catBadge}`,
      sprite: A.Sprites ? A.Sprites.html(e, { size: 128 }) : '',
      hp, hpMax: e.maxHp, barCls: 'bar-enemy-hp',
      sub: null,
      effects: e.effects,
      dc: now.defense,
      dcTitle: dcText(e, now.defense),
      stats: [
        stat('PREC', `+${now.attack}`, 'Precisión: lo que suma al dado de 20 para pegarte', updown(now.attack, e.attack || 0)),
        stat('DAÑO', dmgTxt, 'Daño de sus golpes', fx.damagePenalty < 0 ? 'up' : fx.damagePenalty > 0 ? 'down' : null),
        stat('ARM', now.armor, 'Armadura: se resta a tus golpes', updown(now.armor, e.armor || 0)),
        stat('VEL', e.speed || 10, 'Velocidad: el más rápido actúa primero'),
      ],
    });
  }

  /** Lo que tenés que sacar en el D20 para pegarle (con tu ataque). */
  function neededRoll(defense) {
    const p = A.State.player;
    const st = A.Balance && A.Balance.playerCombatStats ? A.Balance.playerCombatStats(p) : { attack: 0 };
    return Math.max(2, Math.min(20, defense - (st.attack || 0)));
  }

  function dcText(e, dcNow) {
    const dc = dcNow != null ? dcNow : (e.difficulty || 10);
    const need = neededRoll(dc);
    return `Dificultad del dado: ${dc}. Con tu precisión necesitás sacar ${need} o más en el dado de 20${need >= 20 ? ' (solo con un 20)' : ''}.`;
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
    // v3.0: lo del compañero, contado sobre él
    const sl = sayFor(last.e);
    const sp = prev ? sayFor(prev.e) : null;
    return {
      key,
      html: `
        <div class="cb-narrator" data-sec="narrator" data-say="${esc(key)}" role="status" aria-live="polite">
          ${prev ? `<p class="cb-say is-prev tone-${prev.e.say.tone}">${whoTag(sp.who)}${esc(sp.text)}</p>` : ''}
          <p class="cb-say is-now tone-${last.e.say.tone}">${whoTag(sl.who)}${esc(sl.text)}</p>
        </div>`,
    };
  }

  // ============================================================
  // Acciones
  // ============================================================

  function waitingText(c, busy) {
    const cur = c && c.initiative ? c.initiative[c.currentActorIdx] : null;
    let txt = 'Nueva ronda…';
    const allyTurn = c && c.party && cur && cur.kind !== 'enemy' && cur.hid !== localHid();
    const owner = allyTurn ? heroOf(cur.hid) : null;
    if (c && c.party && me() && me().hp <= 0) txt = 'Caíste: tu compañero sigue peleando. Si ganan, te levantás.';
    else if (allyTurn && cur.kind === 'player') txt = `Turno de ${esc(cur.name)}: le toca elegir qué hacer…`;
    else if (allyTurn && cur.kind === 'pet') txt = `Turno de ${esc(cur.name)}, la mascota de ${esc(owner ? owner.name : 'tu compañero')}…`;
    else if (cur && cur.kind === 'player') txt = busy ? 'Ya casi es tu turno…' : 'Tu turno.';
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

  /**
   * v2.1: en tu turno se explica el golpe con los números de ESTA pelea:
   * con cuánto acertás (precisión) y cuánta vida sacás (daño).
   */
  function damageRangeVs(p, target, mult = 1) {
    try {
      const r = A.Combat.composePlayerDamage(p).range;
      const arm = target ? enemyNow(target).armor : 0;
      return { min: Math.max(1, r.min * mult - arm), max: Math.max(1, r.max * mult - arm) };
    } catch (err) { return null; }
  }
  const rangeTxt = (r) => (r.min === r.max ? `${r.min}` : `${r.min}&nbsp;a&nbsp;${r.max}`);

  function yourTurnText(c, p, target, need, hit) {
    if (!target || need == null) return '<strong>Tu turno.</strong> Elegí qué hacer.';
    const range = damageRangeVs(p, target);
    const many = A.Combat.aliveEnemies().length > 1;
    const pctTxt = hit != null ? ` (${Math.round(hit * 100)}%)` : '';
    return `<strong>Tu turno.</strong> Para acertarle a ${esc(target.displayName || target.name)} necesitás <b>${need} o más</b> en el dado${pctTxt}.`
      + (range ? ` Si acertás le sacás <b>${rangeTxt(range)}</b> de vida.` : '')
      + (many ? ' Tocá a otro enemigo para cambiar de objetivo.' : '');
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
    const need = target ? neededRoll(enemyNow(target).defense) : null;
    const flee = A.Combat.canFlee ? A.Combat.canFlee() : { ok: true };
    const dmgRange = target ? damageRangeVs(p, target) : null;
    const power = A.Combat.powerInfo ? A.Combat.powerInfo() : null;
    const attackIcon = p.equipment && p.equipment.weapon && A.ItemSprites
      ? A.ItemSprites.html(p.equipment.weapon, { size: 32 }) : icon('fist', 32);
    const off = !ready;

    const btn = (action, iconHtml, label, opts = {}) => `
      <button type="button" class="combat-action-btn cb-btn ${opts.cls || ''}" data-combat-action="${action}" ${opts.disabled ? 'disabled' : ''} title="${esc(opts.title || label)}" ${opts.attrs || ''}>
        <span class="cb-btn-icon">${iconHtml}</span>
        <span class="cb-btn-text">
          <span class="combat-action-label">${label}</span>
          <span class="cb-btn-hint">${opts.hint || '&nbsp;'}</span>
          ${opts.hint2 ? `<span class="cb-btn-hint is-2">${opts.hint2}</span>` : ''}
        </span>
      </button>`;

    return `
      <section class="cb-actions ${ready ? 'is-your-turn' : 'is-waiting'}" data-sec="actions">
        <div class="cb-turn-line">${ready ? yourTurnText(c, p, target, need, hit) : waitingText(c, busy)}</div>
        <div class="combat-action-row cb-action-row">
          ${queuedAction === 'attack' && !ready ? btn('attack', attackIcon, 'Atacar', {
            cls: 'is-primary is-queued',
            title: 'Tu ataque está en cola: sale apenas te toque. Tocalo de nuevo para cancelarlo.',
            hint: 'Sale apenas te toque',
            hint2: 'Tocá de nuevo para cancelar',
          }) : btn('attack', attackIcon, 'Atacar', {
            cls: 'is-primary',
            title: ready ? 'Atacar al objetivo marcado' : 'Tocalo ahora y atacás apenas te toque',
            hint: need != null ? `Acierto ${hit != null ? `${Math.round(hit * 100)}% ` : ''}(${need}+)` : '',
            hint2: dmgRange ? `Daño ${rangeTxt(dmgRange)}` : '',
          })}
          ${power ? btn('power', icon('swords', 32), 'Golpe fuerte', {
            cls: power.ready ? 'is-power' : '',
            disabled: off || !power.ready,
            title: power.ready ? `Un ataque con el doble de daño. Después tenés que esperar ${power.cooldown - 1} turnos.` : 'Todavía no: se recarga un turno por vez',
            hint: power.ready ? (target ? `Daño ${rangeTxt(damageRangeVs(p, target, power.mult))}` : 'Doble daño') : `Listo en ${power.wait} turno${power.wait === 1 ? '' : 's'}`,
            hint2: power.ready ? 'Doble daño' : '',
          }) : ''}
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
          ${btn('flee', icon(flee.ok ? 'boot' : 'lock', 32), 'Huir', {
            disabled: off || !flee.ok,
            title: flee.ok ? 'Intentar escapar (hasta 2 intentos)' : flee.why,
            hint: flee.ok ? `${Math.max(0, 2 - (c.fleeAttempts || 0))} intentos` : ((A.State.player.effects || []).some((e) => e.type === 'grab') ? 'Atrapado' : 'Sin intentos'),
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
    if (['attack', 'spell', 'heal', 'cast', 'flee', 'save'].includes(fx.kind)) return fx.actor || 'player';
    if (['tick', 'status', 'stun', 'death', 'tamed', 'tame-fail'].includes(fx.kind)) return fx.target;
    if (fx.kind === 'summon' || fx.kind === 'note') return fx.actor || null; // v2.5
    if (fx.kind === 'passive') return 'player';
    return null;
  }

  function lineAvatar(entry, c) {
    const fx = entry.fx || {};
    const p = A.State.player;
    let key = whoKey(fx);
    // v3.0: en grupo, "player"/"pet" sin dueño son del héroe de la frase
    if (entry.hid && key === 'player') key = `hero:${entry.hid}`;
    if (entry.hid && key === 'pet') key = `pet:${entry.hid}`;
    if (key && String(key).startsWith('hero:')) { const h = heroOf(String(key).slice(5)); return h && A.Sprites ? A.Sprites.heroFor(h, { size: 32 }) : ''; }
    if (key && String(key).startsWith('pet:')) { const h = heroOf(String(key).slice(4)); return h && h.pet && A.Sprites ? A.Sprites.petHtml(h.pet, { size: 32 }) : ''; }
    if (key === 'player') return A.Sprites ? A.Sprites.heroFor(p, { size: 32 }) : '';
    if (key === 'pet' && p.pet) return A.Sprites ? A.Sprites.petHtml(p.pet, { size: 32 }) : '';
    if (key && String(key).startsWith('enemy:') && c) {
      const inst = (c.enemies || []).find((e) => `enemy:${e.instanceId}` === key);
      if (inst && A.Sprites) return A.Sprites.html(inst, { size: 32 });
    }
    if (fx.kind === 'reward') {
      if (fx.levelUp) return icon('up', 32);
      if (fx.coins) return icon('coin', 32);
      if (fx.mana) return icon('spell', 32);
      if (fx.hp) return icon('heart', 32);
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
      const vs = entry.vs != null ? ` contra ${entry.vsLabel === 'DC huida' ? 'huida' : 'dificultad'} <b>${entry.vs}</b>` : '';
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
        if (opts.rolls && e.text) out.push(`<div class="cb-line is-tech"><span class="cb-line-who"></span><span class="cb-line-body"><span class="cb-line-text">${esc(techFor(e))}</span></span></div>`);
        continue;
      }
      const told = sayFor(e) || { text: say.text, who: null };
      out.push(`
        <div class="cb-line tone-${say.tone} ${e.hid && e.hid !== localHid() ? 'is-ally' : ''}">
          <span class="cb-line-who">${lineAvatar(e, c)}</span>
          <span class="cb-line-body">
            <span class="cb-line-text">${whoTag(told.who)}${esc(told.text)}</span>
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
      if (c.party && e.hid && e.hid !== localHid()) continue; // v3.0: lo que ganó el compañero, en su compu
      if (fx.xp) chips.push(`<span class="cb-chip">${icon('xp', 32)}<span><b>+${fx.xp}</b> experiencia</span></span>`);
      if (fx.coins) coins += fx.coins;
      if (fx.levelUp) chips.push(`<span class="cb-chip is-gold">${icon('up', 32)}<span>¡Nivel <b>${fx.levelUp}</b>!</span></span>`);
      if (fx.mana) chips.push(`<span class="cb-chip">${icon('spell', 32)}<span><b>+${fx.mana}</b> de maná</span></span>`);
      if (fx.hp) chips.push(`<span class="cb-chip">${icon('heart', 32)}<span><b>+${fx.hp}</b> de vida</span></span>`);
      if (fx.petXp && me() && me().pet) chips.push(`<span class="cb-chip">${A.Sprites ? A.Sprites.petHtml(me().pet, { size: 32 }) : ''}<span><b>+${fx.petXp}</b> para ${esc(me().pet.name)}</span></span>`);
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
    // v3.0: en grupo, en plural
    if (c.party) {
      if (r === 'defeat') { meta.title = 'Cayeron…'; meta.sub = 'Despiertan en el pueblo, magullados. Van a necesitar curarse.'; }
      if (r === 'flee') { meta.title = 'Escaparon'; meta.sub = 'Corrieron hasta perderlos de vista.'; }
    }
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
    } else if (action === 'power') {
      const ready = c && !c.result && isPlayerTurnLocal(c) && revealedLog(c).length === (c.log || []).length;
      if (ready && A.Combat.playerPowerAttack) A.Combat.playerPowerAttack();
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
      // v3.0: en grupo, el viaje lo sigue el anfitrión
      const guest = A.Party && A.Party.guestTogether && A.Party.guestTogether();
      if (wasVictory && fromTravel && A.State.traveling && !guest) A.Travel.step();
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
      window.removeEventListener('resize', onResize);
      window.addEventListener('resize', onResize);
      render();
      introIfNew();
      unsubscribe();
      subscribe();
    },
    unmount() {
      unsubscribe();
      window.removeEventListener('resize', onResize);
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
