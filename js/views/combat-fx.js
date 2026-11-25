/* ============================================================
   Aventurs — Efectos de combate (v1.9.1)
   Todo lo que se mueve en la pelea:
     - el D20 que rueda en el centro de la arena y cae en el número real
     - el que ataca se tira hacia adelante, el golpeado tiembla
     - números de daño, críticos, esquivas, curas, veneno, aturdido
     - barras de vida que bajan con "estela" cuando cae el dado
     - el enemigo que muere se desvanece antes de pasar al resultado

   La vista de combate se vuelve a dibujar seguido; por eso:
     - los efectos flotantes viven en una capa fija aparte (.fx-layer)
     - las animaciones de las tarjetas se re-aplican después de cada
       render con un delay negativo, así no se cortan a la mitad
   La capa no captura clics (pointer-events: none): nunca tapa botones.
   ============================================================ */

(function (A) {
  'use strict';

  const DICE_ROLL_MS = 560;   // lo que tarda en rodar
  const DICE_HOLD_MS = 950;   // lo que queda visible el resultado
  const DICE_GAP_MS = 420;    // mínimo entre un dado y el siguiente
  const DEATH_MS = 700;
  const CAST_MS = 360;
  const READ_MS = 850;        // v2.3: cada frase del narrador queda a la vista al menos esto
  const ADD_MS = 640;         // v2.3: la precisión vuela al dado y se suma (antes del veredicto)

  let layer = null;
  let root = null;
  let rerender = null;
  let holdUntil = 0;
  let diceFreeAt = 0;
  let lastAt = 0;
  let lastSayAt = 0;
  let currentDice = null;
  let rollTimer = null;
  const timers = new Set();

  const cardFx = new Map();        // id -> { key, cls, start, dur }
  const barTweens = new Map();     // barKey -> tween
  const lastPct = new Map();       // barKey -> último % dibujado
  const impactAt = new Map();      // fxKey -> momento del impacto pendiente
  const dyingUntil = new Map();    // fxKey -> fin de la animación de muerte

  const now = () => performance.now();

  function later(ms, fn) {
    const id = setTimeout(() => { timers.delete(id); try { fn(); } catch (e) { console.error(e); } }, Math.max(0, ms));
    timers.add(id);
    return id;
  }

  // ---------------------------------------------------------------
  // Montaje
  // ---------------------------------------------------------------

  function mount(rootEl, opts = {}) {
    root = rootEl;
    rerender = opts.rerender || null;
    if (!layer || !document.body.contains(layer)) {
      layer = document.createElement('div');
      layer.className = 'fx-layer';
      layer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(layer);
    }
  }

  function unmount() {
    timers.forEach((id) => clearTimeout(id));
    timers.clear();
    clearInterval(rollTimer);
    if (layer) layer.remove();
    layer = null;
    root = null;
    rerender = null;
    currentDice = null;
    resetState();
  }

  function resetState() {
    cardFx.clear(); barTweens.clear(); lastPct.clear(); impactAt.clear(); dyingUntil.clear(); calloutAt.clear();
    holdUntil = 0;
    diceFreeAt = 0;
    lastAt = 0;
    lastSayAt = 0;
  }

  /** Combate nuevo: limpia y hace la entrada de la arena. */
  function start(opts = {}) {
    resetState();
    if (layer) layer.innerHTML = '';
    playCardFx('arena', 'fx-arena-enter', 900);
    later(80, () => banner(opts.ambush ? '¡Emboscada!' : '¡Combate!', opts.ambush ? 'is-danger' : ''));
  }

  // ---------------------------------------------------------------
  // Helpers de DOM
  // ---------------------------------------------------------------

  function findEl(key) {
    if (!root) return null;
    if (key === 'arena') return root.querySelector('.cb-arena');
    return root.querySelector(`[data-fx-key="${String(key).replace(/"/g, '')}"]`);
  }

  function spriteRect(key) {
    const el = findEl(key);
    if (!el) return null;
    const spr = el.querySelector('.cb-sprite') || el;
    return spr.getBoundingClientRect();
  }

  function spawn(cls, x, y, html, ttl) {
    if (!layer) return null;
    const el = document.createElement('div');
    el.className = cls;
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    if (html != null) el.innerHTML = html;
    layer.appendChild(el);
    later(ttl, () => el.remove());
    return el;
  }

  function esc(s) { return A.Utils && A.Utils.escapeHtml ? A.Utils.escapeHtml(String(s)) : String(s); }

  // ---------------------------------------------------------------
  // Animaciones de tarjeta (sobreviven a los re-render)
  // ---------------------------------------------------------------

  function playCardFx(key, cls, dur) {
    if (!key) return;
    // una sola animación de movimiento por tarjeta
    for (const [id, f] of cardFx) {
      if (f.key === key) {
        cardFx.delete(id);
        const old = findEl(key);
        if (old) old.classList.remove(f.cls);
      }
    }
    const id = `${key}|${cls}|${Math.random()}`;
    cardFx.set(id, { key, cls, start: now(), dur });
    const el = findEl(key);
    if (el) {
      el.classList.remove(cls);
      el.style.setProperty('--fx-delay', '0ms');
      void el.offsetWidth;
      el.classList.add(cls);
      el.__fxId = id;
    }
    later(dur + 20, () => {
      if (!cardFx.has(id)) return;
      cardFx.delete(id);
      const e2 = findEl(key);
      if (e2) e2.classList.remove(cls);
    });
  }

  // ---------------------------------------------------------------
  // Barras con estela
  // ---------------------------------------------------------------

  function tweenValue(from, to, start, delay, dur, t) {
    const t0 = start + delay;
    if (t <= t0) return from;
    if (t >= t0 + dur) return to;
    const k = (t - t0) / dur;
    return from + (to - from) * (1 - Math.pow(1 - k, 3));
  }

  function tweenBar(el, t) {
    const key = el.dataset.barKey;
    const target = parseFloat(el.style.width) || 0;
    let tw = barTweens.get(key);
    if (!tw && lastPct.has(key) && lastPct.get(key) !== target) {
      const owner = el.dataset.barOwner;
      const at = impactAt.get(owner) || 0;
      tw = { from: lastPct.get(key), to: target, start: t, delay: Math.max(0, at - t), dur: 480 };
      barTweens.set(key, tw);
    } else if (tw && tw.to !== target) {
      const cur = tweenValue(tw.from, tw.to, tw.start, tw.delay, tw.dur, t);
      tw = { from: cur, to: target, start: t, delay: 0, dur: 420 };
      barTweens.set(key, tw);
    }
    lastPct.set(key, target);
    const lag = el.parentElement ? el.parentElement.querySelector('.bar-lag') : null;
    if (!tw) { if (lag) lag.style.width = `${target}%`; return; }

    const t0 = tw.start + tw.delay;
    const lagDelay = tw.delay + 300;
    const lagDur = 650;
    const finished = t >= tw.start + lagDelay + lagDur;
    if (finished) { barTweens.delete(key); if (lag) lag.style.width = `${target}%`; return; }

    // barra principal
    const cur = tweenValue(tw.from, tw.to, tw.start, tw.delay, tw.dur, t);
    el.style.transition = 'none';
    el.style.width = `${cur}%`;
    void el.offsetWidth;
    if (t < t0 + tw.dur) {
      el.style.transition = `width ${Math.max(30, t0 + tw.dur - Math.max(t, t0))}ms cubic-bezier(.25,.8,.3,1) ${Math.max(0, t0 - t)}ms`;
    }
    el.style.width = `${target}%`;

    // estela (solo cuando baja)
    if (lag) {
      if (tw.to >= tw.from) { lag.style.transition = 'none'; lag.style.width = `${target}%`; return; }
      const l0 = tw.start + lagDelay;
      const lcur = tweenValue(tw.from, tw.to, tw.start, lagDelay, lagDur, t);
      lag.style.transition = 'none';
      lag.style.width = `${lcur}%`;
      void lag.offsetWidth;
      lag.style.transition = `width ${Math.max(30, l0 + lagDur - Math.max(t, l0))}ms ease-in ${Math.max(0, l0 - t)}ms`;
      lag.style.width = `${target}%`;
    }
  }

  /**
   * Llamar después de cada render de la vista de combate.
   * Solo toca los elementos NUEVOS (la vista redibuja por partes): a uno
   * que ya tiene la animación corriendo no se le cambia el delay, si no
   * saltaría hacia adelante.
   */
  function afterRender() {
    if (!root) return;
    const t = now();
    for (const [id, f] of cardFx) {
      const elapsed = t - f.start;
      if (elapsed >= f.dur) { cardFx.delete(id); continue; }
      const el = findEl(f.key);
      if (!el || el.__fxId === id) continue;
      el.style.setProperty('--fx-delay', `-${Math.round(elapsed)}ms`);
      el.classList.add(f.cls);
      el.__fxId = id;
    }
    root.querySelectorAll('[data-bar-key]').forEach((el) => tweenBar(el, t));
  }

  // ---------------------------------------------------------------
  // Dado D20
  // ---------------------------------------------------------------

  const D20_SVG = `
    <svg viewBox="0 0 100 100" class="fx-d20-svg" aria-hidden="true">
      <polygon class="d20-body" points="50,2 93,27 93,73 50,98 7,73 7,27"/>
      <polygon class="d20-face" points="50,23 81,71 19,71"/>
      <g class="d20-edges">
        <polyline points="7,27 50,23 93,27"/>
        <line x1="50" y1="2" x2="50" y2="23"/>
        <polyline points="93,27 81,71 93,73"/>
        <polyline points="7,27 19,71 7,73"/>
        <polyline points="19,71 50,98 81,71"/>
      </g>
    </svg>`;

  function verdictOf(entry) {
    const isFlee = entry.fx && entry.fx.kind === 'flee';
    if (isFlee) return entry.result === 'hit' ? { cls: 'hit', text: '¡Escapás!' } : { cls: 'miss', text: 'No lográs huir' };
    // v3.3: el dado de rescate (al perder una pelea)
    if (entry.fx && entry.fx.kind === 'save' && entry.fx.rescue) return entry.result === 'hit' ? { cls: 'hit', text: mine(entry) ? '¡Te encuentran!' : '¡Lo encuentran!' } : { cls: 'miss', text: 'Nadie viene…' };
    // v2.5: tirada para resistir una habilidad
    if (entry.fx && entry.fx.kind === 'save') return entry.result === 'hit' ? { cls: 'hit', text: '¡Resistís!' } : { cls: 'miss', text: 'No resistís' };
    // v3.9: el dado de la doma
    if (entry.fx && entry.fx.kind === 'tame') return entry.result === 'hit' ? { cls: 'crit', text: '¡Se deja domar!' } : { cls: 'miss', text: 'Desconfía' };
    if (entry.result === 'crit') return { cls: 'crit', text: '¡Crítico!' };
    if (entry.result === 'hit') return entry.power ? { cls: 'crit', text: '¡Golpe fuerte!' } : { cls: 'hit', text: '¡Impacto!' };
    if (entry.result === 'fumble') return { cls: 'fumble', text: '¡Pifia!' };
    return { cls: 'miss', text: 'Esquiva' };
  }

  function diceAnchor() {
    if (!root) return null;
    const vs = root.querySelector('.cb-vs');
    const el = vs && vs.offsetParent ? vs : root.querySelector('.cb-arena');
    return el ? el.getBoundingClientRect() : null;
  }

  /** v2.3: ¿se anima la suma de la precisión? (con 1 o 20 el dado decide solo) */
  function addMsFor(entry) {
    if (!entry || entry.roll == null || !entry.bonus || entry.total == null) return 0;
    if (entry.roll === 1 || entry.roll === 20) return 0;
    return ADD_MS;
  }

  /** La precisión sale del número PREC de la tarjeta y vuela hasta el dado. */
  function flyBonus(entry, diceEl, numEl, addMs) {
    const bonus = entry.bonus;
    const dieEl = diceEl.querySelector('.fx-dice-die');
    if (!dieEl) return;
    const d = dieEl.getBoundingClientRect();
    const tx = d.left + d.width / 2;
    const ty = d.top + d.height / 2;
    const actorEl = entry.fx ? findEl(entry.fx.actor) : null;
    const statEl = actorEl ? actorEl.querySelector('.cb-stat') : null;
    const f = statEl ? statEl.getBoundingClientRect() : null;
    const side = entry.fx && String(entry.fx.actor || '').startsWith('enemy') ? 1 : -1;
    const sx = f ? f.left + f.width / 2 : tx + side * 130;
    const sy = f ? f.top + f.height / 2 : ty;
    const what = entry.fx && entry.fx.kind === 'flee' ? 'para huir' : entry.fx && entry.fx.kind === 'save' ? (entry.fx.stat || 'para resistir') : 'precisión';
    const chip = spawn(`fx-bonus ${bonus < 0 ? 'is-neg' : ''}`, sx, sy,
      `<b>${bonus > 0 ? '+' : '−'}${Math.abs(bonus)}</b><small>${what}</small>`, addMs + 300);
    if (!chip) return;
    const fly = Math.round(addMs * 0.62);
    const dx = Math.round(tx - sx);
    const dy = Math.round(ty - sy);
    if (chip.animate) {
      chip.animate([
        { transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(1.15)', opacity: 1, offset: 0.22 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.75)`, opacity: 1 },
      ], { duration: fly, easing: 'cubic-bezier(.45, 0, .25, 1)', fill: 'forwards' });
    }
    later(fly, () => {
      chip.remove();
      if (!diceEl.isConnected) return;
      diceEl.classList.add('is-adding');
      // el número del dado cuenta hasta el total
      const from = entry.roll;
      const to = entry.total;
      const steps = Math.max(1, Math.abs(to - from));
      const span = Math.max(80, addMs - fly - 90);
      for (let i = 1; i <= steps; i++) {
        later(Math.round((span * i) / steps), () => {
          if (!numEl.isConnected) return;
          numEl.textContent = from + Math.sign(to - from) * i;
        });
      }
    });
  }

  function showDice(entry, startAt) {
    later(startAt - now(), () => {
      if (!layer || !root) return;
      const r = diceAnchor();
      if (!r) return;
      clearInterval(rollTimer);
      if (currentDice) currentDice.remove();
      const side = entry.fx && String(entry.fx.actor || '').startsWith('enemy') ? 'enemy' : 'ally';
      const v = verdictOf(entry);
      const addMs = entry._addMs || 0;
      const el = spawn(`fx-dice is-rolling is-${side}`, r.left + r.width / 2, r.top + r.height / 2,
        `<div class="fx-dice-die">${D20_SVG}<span class="fx-dice-num">${1 + Math.floor(Math.random() * 20)}</span></div>
         <div class="fx-dice-caption"></div>`, DICE_ROLL_MS + addMs + DICE_HOLD_MS + 400);
      if (!el) return;
      currentDice = el;
      const numEl = el.querySelector('.fx-dice-num');
      const capEl = el.querySelector('.fx-dice-caption');
      rollTimer = setInterval(() => { numEl.textContent = 1 + Math.floor(Math.random() * 20); }, 60);
      const reveal = () => {
        if (!el.isConnected) return;
        if (addMs) numEl.textContent = entry.total;
        el.classList.remove('is-raw', 'is-adding', 'is-landed');
        void el.offsetWidth; // vuelve a saltar
        el.classList.add('is-landed', `is-${v.cls}`);
        const bonus = entry.bonus ? ` ${entry.bonus > 0 ? '+' : '−'} ${Math.abs(entry.bonus)} = <b>${entry.total}</b>` : '';
        const vs = entry.vs != null ? ` <span class="fx-dice-vs">vs ${entry.vsLabel === 'DC huida' ? 'huida' : entry.vsLabel === 'rescate' ? 'rescate' : 'dificultad'} ${entry.vs}</span>` : '';
        capEl.innerHTML = `<div class="fx-dice-verdict">${v.text}</div><div class="fx-dice-math"><b>${entry.roll}</b>${bonus}${vs}</div>`;
      };
      later(DICE_ROLL_MS, () => {
        clearInterval(rollTimer);
        if (!el.isConnected) return;
        numEl.textContent = entry.roll;
        el.classList.remove('is-rolling');
        if (!addMs) { reveal(); return; }
        // v2.3: primero el dado solo, después se le suma la precisión
        el.classList.add('is-landed', 'is-raw');
        capEl.innerHTML = `<div class="fx-dice-math is-raw">Sacaste <b>${entry.roll}</b>${entry.vs != null ? ` <span class="fx-dice-vs">· necesita ${entry.vs}</span>` : ''}</div>`;
        flyBonus(entry, el, numEl, addMs);
      });
      if (addMs) later(DICE_ROLL_MS + addMs, reveal);
      later(DICE_ROLL_MS + addMs + DICE_HOLD_MS, () => el.classList.add('is-leaving'));
    });
  }

  // ---------------------------------------------------------------
  // Preparar (antes del render) y reproducir (después)
  // ---------------------------------------------------------------

  /**
   * Calcula cuándo "pega" cada acción, para que la barra de vida
   * y la muerte esperen al dado. Se llama ANTES de re-dibujar.
   */
  function prepare(entry) {
    if (!entry) return;
    const t = now();
    // v2.3: el narrador cuenta una cosa por vez. Si dos frases caían juntas (tu golpe y
    // el sangrado del enemigo), la primera ni se llegaba a leer.
    const says = !!(entry.say && entry.say.text) && !(entry.fx && entry.fx.kind === 'reward');
    const minAt = says && lastSayAt ? lastSayAt + READ_MS : 0;
    if (!entry.fx) {
      if (says) {
        entry._at = Math.max(t, minAt);
        lastSayAt = entry._at;
        lastAt = Math.max(lastAt, entry._at);
      }
      return;
    }
    const fx = entry.fx;
    // v3.3: los hechizos de daño también tiran el dado
    if (entry.roll != null && (fx.kind === 'attack' || fx.kind === 'flee' || fx.kind === 'save' || fx.kind === 'spell' || fx.kind === 'tame')) {
      const addMs = addMsFor(entry);
      const startAt = Math.max(t, diceFreeAt, minAt - DICE_ROLL_MS - addMs);
      entry._diceAt = startAt;
      entry._addMs = addMs;
      entry._at = startAt + DICE_ROLL_MS + addMs;
      diceFreeAt = entry._at + DICE_GAP_MS;
    } else if (fx.kind === 'spell') {
      // v3.3: en los de área, las demás criaturas reciben el golpe después del dado
      entry._at = Math.max(t + CAST_MS, impactAt.get(fx.target) || 0, fx.chain ? lastAt + 140 : 0);
    } else if (fx.kind === 'passive' || (fx.kind === 'heal' && fx.passive)) {
      // las pasivas se ven después de lo que las provocó
      entry._at = Math.max(t + 120, lastAt + 220);
    } else if (fx.kind === 'heal' || fx.kind === 'cast' || fx.kind === 'buff') {
      entry._at = Math.max(t + 200, fx.kind === 'buff' ? lastAt + 200 : 0);
    } else if (fx.kind === 'death' || fx.kind === 'status' || fx.kind === 'tamed') {
      entry._at = Math.max(t, (impactAt.get(fx.target) || 0) + (fx.kind === 'death' ? 120 : 260));
    } else {
      entry._at = t;
    }
    if (says && entry._at < minAt) entry._at = minAt;
    if (says) lastSayAt = entry._at;
    if (fx.target && (fx.kind === 'attack' || fx.kind === 'spell' || fx.kind === 'tick' || fx.kind === 'heal' || fx.kind === 'save')) {
      impactAt.set(fx.target, entry._at);
    }
    if (fx.kind === 'death' && fx.target) {
      dyingUntil.set(fx.target, entry._at + DEATH_MS);
    }
    lastAt = Math.max(lastAt, entry._at);
    // v3.3: el dado de rescate se ve entero (y se va) antes de que salga el resultado
    holdUntil = Math.max(holdUntil, entry._at + (fx.kind === 'death' ? DEATH_MS + 350 : fx.rescue ? DICE_HOLD_MS + 450 : 850));
  }

  /** v3.0: la tarjeta del héroe de esta frase (en grupo, "hero:<id>"; solo, "player"). */
  function selfKey(entry) { return entry && entry.hid ? `hero:${entry.hid}` : 'player'; }
  /** v3.0: ¿es la tarjeta de un héroe? ("player" o "hero:<id>") */
  function isHeroKey(k) { return k === 'player' || String(k || '').startsWith('hero:'); }
  /** "¡Resistís!" para vos; "¡Resiste!" para el compañero. */
  function mine(entry) { return !entry || !entry.hid || !A.State.me || A.State.hidOf(A.State.me()) === entry.hid; }

  // ---------------------------------------------------------------
  // v3.1: habilidades de las criaturas (y de las mascotas)
  // Activa: un cartel con el nombre arriba de la criatura y un brillo.
  // Pasiva: un cartel más chico y un destello (Escurridizo, Caparazón...).
  // ---------------------------------------------------------------

  const calloutAt = new Map(); // "<tarjeta>|<habilidad>" -> último cartel

  /** { id, on, hero } de la habilidad (o pasiva de raza) que actúa en esta frase, o null. */
  function skillOf(entry) {
    const fx = entry.fx || {};
    if (fx.skill) return { id: fx.skill, on: fx.skillOn || fx.actor || fx.target };
    if (entry.dodgeSkill) return { id: entry.dodgeSkill, on: fx.target };
    if (entry.softened) return { id: entry.softened, on: fx.target };
    if (entry.skill && fx.actor && !isHeroKey(fx.actor)) return { id: entry.skill, on: fx.actor };
    // v3.1: las pasivas de raza también se anuncian (Piel de roca, Suerte, Furia...)
    if (fx.kind === 'passive' && fx.passive) return { id: fx.passive, on: selfKey(entry), hero: true };
    if (fx.passive && (fx.kind === 'heal' || fx.kind === 'status')) return { id: fx.passive, on: selfKey(entry), hero: true };
    if (entry.passive && fx.target && isHeroKey(fx.target)) return { id: entry.passive, on: fx.target, hero: true };
    // v3.3: Cazador de sombras y Corteza espinosa se anuncian sobre el héroe
    if (entry.passive === 'cazador_sombras' || entry.passive === 'corteza_espinosa' || entry.passive === 'colmillos' || entry.passive === 'sangre_lobo') return { id: entry.passive, on: selfKey(entry), hero: true };
    return null;
  }

  /** Nombre, ícono y si es pasiva, de una habilidad de criatura o de una pasiva de raza. */
  function calloutData(sk) {
    if (sk.hero) {
      const info = A.Passives && A.Passives.info ? A.Passives.info(sk.id, A.State.player) : null;
      return info ? { name: info.name, icon: info.icon, kind: 'passive' } : null;
    }
    return A.Skills && A.Skills.get ? A.Skills.get(sk.id) : null;
  }

  function skillCallout(entry, delay) {
    const sk = skillOf(entry);
    if (!sk || !sk.on) return;
    const data = calloutData(sk);
    if (!data) return;
    const key = `${sk.on}|${sk.id}`;
    const t = now() + Math.max(0, delay);
    if ((calloutAt.get(key) || -1e9) > t - 1600) return; // las de varios golpes, una vez
    calloutAt.set(key, t);
    const passive = data.kind === 'passive';
    later(delay, () => {
      const r = spriteRect(sk.on);
      if (!r) return;
      spawn(`fx-skill-pill ${passive ? 'is-passive' : 'is-active'}`, r.left + r.width / 2, r.top - (passive ? 4 : 10),
        `${pxIcon(data.icon || 'star', passive ? 14 : 18)}<span>${esc(data.name)}</span>`, passive ? 1300 : 1600);
      playCardFx(sk.on, passive ? 'fx-skill-pas' : 'fx-skill-act', passive ? 700 : 900);
      if (!passive) {
        const ring = spawn('fx-skill-ring', r.left + r.width / 2, r.top + r.height / 2, null, 800);
        if (ring) ring.style.setProperty('--c', /poison|acid/.test(data.icon || '') ? '#6fbf3a' : /bleed/.test(data.icon || '') ? '#d0342c' : /fire/.test(data.icon || '') ? '#ff8a2a' : /cold|ice/.test(data.icon || '') ? '#7cc6ff' : '#f2c14e');
      }
    });
  }

  function play(entry) {
    if (!entry || !entry.fx || !layer || !root) return;
    const fx = entry.fx;
    const t = now();
    const at = entry._at != null ? entry._at : t;
    const me = selfKey(entry);
    // v3.1: la habilidad se anuncia apenas empieza la acción (antes de que caiga el dado)
    if (skillOf(entry)) skillCallout(entry, (entry._diceAt != null ? entry._diceAt : at) - t - (entry._diceAt != null ? 0 : 120));

    switch (fx.kind) {
      case 'attack': {
        if (entry._diceAt != null) showDice(entry, entry._diceAt);
        const lunge = String(fx.actor || '').startsWith('enemy') ? 'fx-lunge-left' : 'fx-lunge-right';
        later(at - t - 170, () => playCardFx(fx.actor, lunge, 380));
        later(at - t, () => impact(entry));
        break;
      }
      case 'save': {
        // v2.5: el dado para resistir una habilidad de la criatura
        if (entry._diceAt != null) showDice(entry, entry._diceAt);
        later(at - t, () => {
          // v3.3: el dado de rescate
          if (fx.rescue) floatText(me, entry.result === 'hit' ? '¡Rescate!' : 'Nadie viene…', entry.result === 'hit' ? 'is-status is-buff' : 'is-miss', -20, entry.result === 'hit' ? 'heart' : 'skull');
          else if (entry.result === 'hit') floatText(me, mine(entry) ? '¡Resistís!' : '¡Resiste!', 'is-status is-buff', -20, 'shield');
        });
        break;
      }
      case 'summon': {
        later(at - t, () => {
          sparkles(fx.target, 'summon');
          floatText(fx.target, '¡Aparece!', 'is-status is-status-summon', 0, 'skulls');
          playCardFx(fx.target, 'fx-summon', 700);
        });
        break;
      }
      case 'flee': {
        if (entry._diceAt != null) showDice(entry, entry._diceAt);
        later(at - t, () => {
          if (entry.result === 'hit') playCardFx(me, 'fx-flee', 600);
          else floatText(me, mine(entry) ? 'No escapás' : 'No escapan', 'is-miss');
        });
        break;
      }
      case 'spell': {
        if (entry._diceAt != null) showDice(entry, entry._diceAt);
        if (!fx.chain) {
          playCardFx(fx.actor || me, 'fx-cast', CAST_MS + 120);
          castGlow(fx.actor || me, fx.element);
        }
        later(at - t, () => {
          // v3.3: el hechizo puede fallar
          if (fx.miss) { floatText(fx.target, entry.result === 'fumble' ? '¡Pifia!' : 'Esquiva', 'is-miss'); return; }
          burst(fx.target, fx.element || 'arcane');
          if (entry.dmg != null) floatNumber(fx.target, `-${entry.dmg}`, `is-dmg is-spell-${fx.element || 'arcane'}${fx.crit ? ' is-crit' : ''}`);
          playCardFx(fx.target, 'fx-hit', 420);
        });
        break;
      }
      case 'heal': {
        later(at - t, () => {
          if (fx.amount > 0) floatNumber(fx.target || me, `+${fx.amount}`, 'is-heal');
          if (fx.mana > 0) later(fx.amount > 0 ? 220 : 0, () => floatNumber(fx.target || me, `+${fx.mana}`, 'is-mana'));
          sparkles(fx.target || me, 'heal');
          playCardFx(fx.target || me, 'fx-heal', 600);
        });
        break;
      }
      case 'cast': {
        playCardFx(fx.actor || me, 'fx-cast', 480);
        castGlow(fx.actor || me, 'arcane');
        break;
      }
      case 'buff': {
        // v2.4: mejoras, accesorios que actúan (doble golpe, contraataque, superviviente)
        // v3.2: also = otras tarjetas que reciben la misma mejora (el aullido de la mascota en grupo)
        later(at - t, () => {
          for (const k of [fx.target || me].concat(Array.isArray(fx.also) ? fx.also : [])) {
            floatText(k, fx.label || 'Mejora', 'is-status is-buff', -20, fx.icon || 'star');
            playCardFx(k, 'fx-heal', 500);
          }
        });
        break;
      }
      case 'tick': {
        later(at - t, () => {
          floatNumber(fx.target, `-${fx.amount}`, `is-tick is-tick-${fx.effect || 'poison'}`, fx.effect || 'poison');
          playCardFx(fx.target, 'fx-hit-soft', 320);
        });
        break;
      }
      case 'status': {
        later(at - t, () => floatText(fx.target, effectName(fx.effect), `is-status is-status-${fx.effect}`, 0, statusIcon(fx.effect)));
        break;
      }
      case 'stun': {
        later(at - t, () => {
          floatText(fx.target, 'Aturdido', 'is-status is-status-shock', 0, 'shock');
          playCardFx(fx.target, 'fx-stun', 600);
        });
        break;
      }
      case 'death': {
        later(at - t, () => {
          playCardFx(fx.target, 'fx-die', DEATH_MS);
          const r = spriteRect(fx.target);
          if (r) spawn('fx-soul', r.left + r.width / 2, r.top + r.height * 0.35, pxIcon('skull', 32), 1100);
        });
        later(at - t + DEATH_MS + 30, () => { if (rerender) rerender(); });
        break;
      }
      case 'passive': {
        // v3.1: se anuncia con el cartel de pasiva (skillCallout)
        break;
      }
      case 'tame': {
        // v3.9: tirás el dado con la comida en la mano; si sale, corazones; si no, se eriza
        if (entry._diceAt != null) showDice(entry, entry._diceAt);
        playCardFx(fx.actor, 'fx-lunge-right', 380);
        later(at - t, () => {
          if (entry.result === 'hit') { sparkles(fx.target, 'love'); floatText(fx.target, '¡Confía en vos!', 'is-status is-status-tamed', -10, 'paw'); }
          else { playCardFx(fx.target, 'fx-tame-no', 600); floatText(fx.target, 'Desconfía', 'is-miss', -10, 'paw'); }
        });
        break;
      }
      case 'tamed': {
        later(at - t, () => {
          sparkles(fx.target, 'love');
          floatText(fx.target, '¡Domesticado!', 'is-status is-status-tamed');
        });
        break;
      }
      default: break;
    }
  }

  // ---------------------------------------------------------------
  // Impacto de un ataque con dado
  // ---------------------------------------------------------------

  function impact(entry) {
    const fx = entry.fx;
    const target = fx.target;
    if (!target) return;
    const res = entry.result;
    if (res === 'hit' || res === 'crit') {
      const crit = res === 'crit';
      floatNumber(target, `-${entry.dmg || 0}`, crit ? 'is-dmg is-crit' : 'is-dmg');
      slash(target, crit);
      sparks(target, crit ? 14 : 8, crit ? 'crit' : 'hit');
      playCardFx(target, crit ? 'fx-hit-crit' : 'fx-hit', crit ? 560 : 420);
      if (isHeroKey(target) && (entry.passive === 'piel_roca' || entry.passive === 'determinacion') && A.Passives) {
        const info = A.Passives.info(entry.passive, A.State.player);
        if (info) later(260, () => floatText(target, info.name, 'is-status is-passive', -20, info.icon));
      }
      if (crit) {
        const label = entry.passive === 'golpe_gigante' ? '¡GOLPE DE GIGANTE!' : entry.passive === 'ojo_certero' ? '¡OJO CERTERO!' : '¡CRÍTICO!';
        floatText(target, label, 'is-crit-label', -34);
        playCardFx('arena', 'fx-arena-shake', 420);
        flash();
      }
    } else if (res === 'evaded') {
      floatText(target, 'Esquiva', 'is-miss');
      playCardFx(target, String(target).startsWith('enemy') ? 'fx-dodge-right' : 'fx-dodge-left', 420);
      whoosh(target);
    } else if (res === 'fumble') {
      floatText(fx.actor, '¡Pifia!', 'is-fumble');
      later(80, () => playCardFx(fx.actor, 'fx-stumble', 460));
    }
  }

  // ---------------------------------------------------------------
  // Piezas visuales
  // ---------------------------------------------------------------

  /** Ícono pixelado (reemplaza a los emojis). */
  function pxIcon(name, size) {
    return A.ItemSprites && A.ItemSprites.icon ? A.ItemSprites.icon(name, { size: size || 16, cls: size && size >= 32 ? '' : 'px-soft' }) : '';
  }

  function floatNumber(key, text, cls, iconName) {
    const r = spriteRect(key);
    if (!r) return;
    const jitter = (Math.random() * 24) - 12;
    spawn(`fx-num ${cls || ''}`, r.left + r.width / 2 + jitter, r.top + r.height * 0.3, `${esc(text)}${iconName ? pxIcon(iconName, 16) : ''}`, 1300);
  }

  function floatText(key, text, cls, dy = 0, iconName) {
    const r = spriteRect(key);
    if (!r) return;
    spawn(`fx-text ${cls || ''}`, r.left + r.width / 2, r.top + r.height * 0.15 + dy, `${iconName ? pxIcon(iconName, 16) : ''}${esc(text)}`, 1300);
  }

  function slash(key, crit) {
    const r = spriteRect(key);
    if (!r) return;
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const a = -35 + (Math.random() * 20 - 10);
    const s1 = spawn(`fx-slash ${crit ? 'is-crit' : ''}`, x, y, null, 420);
    if (s1) s1.style.setProperty('--a', `${a}deg`);
    if (crit) {
      const s2 = spawn('fx-slash is-crit', x, y, null, 420);
      if (s2) { s2.style.setProperty('--a', `${a + 70}deg`); s2.style.animationDelay = '60ms'; }
    }
  }

  function sparks(key, count, kind) {
    const r = spriteRect(key);
    if (!r) return;
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * (kind === 'crit' ? 60 : 38);
      const p = spawn(`fx-spark is-${kind}`, x, y, null, 750);
      if (!p) continue;
      p.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
      p.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
      p.style.animationDelay = `${Math.random() * 60}ms`;
    }
  }

  function whoosh(key) {
    const r = spriteRect(key);
    if (!r) return;
    for (let i = 0; i < 3; i++) {
      const w = spawn('fx-whoosh', r.left + r.width * 0.2, r.top + r.height * (0.3 + i * 0.2), null, 500);
      if (w) w.style.animationDelay = `${i * 50}ms`;
    }
  }

  function burst(key, element) {
    const r = spriteRect(key);
    if (!r) return;
    spawn(`fx-burst is-${element}`, r.left + r.width / 2, r.top + r.height / 2, null, 700);
    sparks(key, 10, `spell-${element}`);
  }

  function castGlow(key, element) {
    const r = spriteRect(key);
    if (!r) return;
    spawn(`fx-cast-ring is-${element || 'arcane'}`, r.left + r.width / 2, r.top + r.height / 2, null, 650);
  }

  function sparkles(key, kind) {
    const r = spriteRect(key);
    if (!r) return;
    const glyph = pxIcon(kind === 'love' ? 'heart' : kind === 'summon' ? 'spark' : 'heal', 16);
    for (let i = 0; i < 6; i++) {
      const s = spawn(`fx-sparkle is-${kind}`, r.left + r.width * (0.2 + Math.random() * 0.6), r.top + r.height * (0.45 + Math.random() * 0.4), glyph, 1100);
      if (s) s.style.animationDelay = `${i * 70}ms`;
    }
  }

  function flash() {
    if (!root) return;
    const arena = root.querySelector('.cb-arena');
    if (!arena) return;
    const r = arena.getBoundingClientRect();
    const f = spawn('fx-flash', r.left, r.top, null, 260);
    if (f) { f.style.width = `${r.width}px`; f.style.height = `${r.height}px`; }
  }

  function banner(text, cls) {
    if (!root) return;
    const arena = root.querySelector('.cb-arena');
    if (!arena) return;
    const r = arena.getBoundingClientRect();
    spawn(`fx-banner ${cls || ''}`, r.left + r.width / 2, r.top + Math.min(r.height / 2, 140), esc(text), 1400);
  }

  function effectName(type) {
    return ({
      bleed: 'Sangrado', poison: 'Envenenado', fire: 'En llamas', cold: 'Congelado', shock: 'Electrizado', blind: 'Cegado', silence: 'Silenciado', stun: 'Paralizado', curse: 'Maldito',
      // v2.5
      prone: 'Derribado', fear: 'Asustado', grab: 'Atrapado', corrode: 'Corroído', rally: '¡Envalentonado!', guard: 'En guardia',
      immune: 'Inmune', fury: '¡Furia!', steal: '¡Te roba!',
    })[type] || type;
  }

  /** v2.5: ícono del número flotante de cada estado. */
  function statusIcon(type) {
    const map = { stun: 'hourglass', curse: 'skull', prone: 'arrow-down', fear: 'warning', grab: 'lock', corrode: 'poison', rally: 'arrow-up', guard: 'shield', immune: 'star', fury: 'fist', steal: 'coins' };
    return map[type] || type;
  }

  // ---------------------------------------------------------------
  // Consultas de la vista
  // ---------------------------------------------------------------

  /** ms que hay que esperar antes de mostrar la pantalla de resultado. */
  function resultWait() { return Math.max(0, holdUntil - now()); }

  /** true mientras un combatiente está "muriendo" (todavía no se lo dibuja caído). */
  function isDying(key) { return (dyingUntil.get(key) || 0) > now(); }

  A.CombatFx = { mount, unmount, start, prepare, play, afterRender, resultWait, isDying, playCardFx };
})(window.Aventurs);
