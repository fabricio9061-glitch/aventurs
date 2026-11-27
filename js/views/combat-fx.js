/* ============================================================
   Aventurs — Efectos de combate (v1.9.1; v3.16: golpes con peso,
   hechizos que viajan, partículas por elemento, botín que salta)
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
   v3.22: cada arma pega distinto, estados y curas con dibujo propio
   (ver "cada arma pega distinto" más abajo).
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

  function findBar(key) {
    const el = root && root.querySelector(`[data-bar-key="${String(key).replace(/"/g, '')}"]`);
    return el ? el.parentElement : null;
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
    const bar = el.parentElement;
    if (finished) { barTweens.delete(key); if (lag) lag.style.width = `${target}%`; if (bar) bar.classList.remove('is-dropping', 'is-rising'); return; }
    // v3.16: la barra brilla mientras baja (blanco) o sube (verde)
    if (bar) {
      const on = t < t0 + tw.dur + 120;
      bar.classList.toggle('is-dropping', on && tw.to < tw.from);
      bar.classList.toggle('is-rising', on && tw.to > tw.from);
      if (on) later(t0 + tw.dur + 140 - t, () => { const b2 = findBar(key); if (b2) b2.classList.remove('is-dropping', 'is-rising'); });
    }

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
    // v3.11: Instinto salvaje, Núcleo de sobrecarga, Embestida arrolladora, Apoyo orbital, Polvo de hada, Ingenio
    if (['furia', 'cuerpo_metal', 'embestida', 'mente_expansiva', 'polvo_hada', 'ingenio', 'bendicion'].includes(entry.passive) && entry.type === 'system') return { id: entry.passive, on: selfKey(entry), hero: true };
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
        // v3.22: cada arma (o boca, o garra) pega distinto
        const style = entry._style || (entry._style = attackStyle(entry));
        if (style.kind === 'arrow') {
          later(at - t - 300, () => playCardFx(fx.actor, lunge === 'fx-lunge-left' ? 'fx-shoot-left' : 'fx-shoot-right', 380));
          later(at - t - ARROW_MS, () => arrowFly(fx.actor, fx.target, entry.result === 'evaded' || entry.result === 'fumble'));
        } else {
          later(at - t - 170, () => { playCardFx(fx.actor, lunge, 380); speedLines(fx.actor, lunge === 'fx-lunge-left' ? -1 : 1); });
        }
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
        // v3.16: el hechizo viaja de quien lo lanza a quien lo recibe
        if (fx.target && (fx.actor || me) !== fx.target) later(at - t - BOLT_MS, () => bolt(fx.actor || me, fx.target, fx.element || 'arcane'));
        later(at - t, () => {
          // v3.3: el hechizo puede fallar
          if (fx.miss) { floatText(fx.target, entry.result === 'fumble' ? '¡Pifia!' : 'Esquiva', 'is-miss'); return; }
          burst(fx.target, fx.element || 'arcane');
          shockwave(fx.target, fx.element || 'arcane', !!fx.crit);
          elementFx(fx.target, fx.element || 'arcane', !!fx.crit);
          if (entry.dmg != null) hitShake(fx.target, entry.dmg, !!fx.crit);
          if (entry.dmg != null && isHeroKey(fx.target)) hurtVignette(!!fx.crit);
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
          if (fx.amount > 0) healBeam(fx.target || me, false); else if (fx.mana > 0) healBeam(fx.target || me, true);
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
            buffAura(k);
            playCardFx(k, 'fx-heal', 500);
          }
        });
        break;
      }
      case 'tick': {
        later(at - t, () => {
          floatNumber(fx.target, `-${fx.amount}`, `is-tick is-tick-${fx.effect || 'poison'}`, fx.effect || 'poison');
          playCardFx(fx.target, 'fx-hit-soft', 320);
          effectFx(fx.target, fx.effect || 'poison', 5);
        });
        break;
      }
      case 'status': {
        later(at - t, () => { floatText(fx.target, effectName(fx.effect), `is-status is-status-${fx.effect}`, 0, statusIcon(fx.effect)); effectFx(fx.target, fx.effect, 9, true); });
        break;
      }
      case 'stun': {
        later(at - t, () => {
          floatText(fx.target, 'Aturdido', 'is-status is-status-shock', 0, 'shock');
          effectFx(fx.target, 'stun', 0, true);
          playCardFx(fx.target, 'fx-stun', 600);
        });
        break;
      }
      case 'death': {
        later(at - t, () => {
          playCardFx(fx.target, 'fx-die', DEATH_MS);
          if (!entry.fled) shatter(fx.target);
          const r = spriteRect(fx.target);
          if (r) spawn('fx-soul', r.left + r.width / 2, r.top + r.height * 0.35, pxIcon('skull', 32), 1100);
          if (r && !entry.fled && String(fx.target).startsWith('enemy')) lootDrop(r);
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
      const style = entry._style || (entry._style = attackStyle(entry));
      styleHit(style, fx.actor, target, crit);
      if (crit) critBurst(target);
      sparks(target, crit ? 14 : 8, crit ? 'crit' : 'hit');
      playCardFx(target, crit ? 'fx-hit-crit' : 'fx-hit', crit ? 560 : 420);
      impactRing(target, crit);
      if (!crit) hitShake(target, entry.dmg || 0, false);
      if (isHeroKey(target)) hurtVignette(crit || hpFraction(target, entry.dmg || 0) >= 0.3);
      if (isHeroKey(target) && (entry.passive === 'piel_roca' || entry.passive === 'determinacion' || entry.passive === 'bendicion') && A.Passives) {
        const info = A.Passives.info(entry.passive, A.State.player);
        if (info) later(260, () => floatText(target, info.name, 'is-status is-passive', -20, info.icon));
      }
      if (crit) {
        const label = entry.passive === 'golpe_gigante' ? '¡GOLPE DE GIGANTE!' : entry.passive === 'ojo_certero' ? '¡OJO CERTERO!' : '¡CRÍTICO!';
        floatText(target, label, 'is-crit-label', -34);
        critZoom(target);
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
  // v3.16: golpes con peso, hechizos que viajan y botín que salta
  // ---------------------------------------------------------------

  const BOLT_MS = 260;

  /** Qué parte de su vida máxima es este daño (lo lee de la tarjeta). */
  function hpFraction(key, dmg) {
    const el = findEl(key);
    const small = el && el.querySelector('.cb-hp-num small');
    const max = small ? parseInt(String(small.textContent).replace(/\D/g, ''), 10) : 0;
    return max > 0 ? dmg / max : 0;
  }

  /** La arena se sacude un poco con los golpes fuertes (los críticos ya la sacuden). */
  function hitShake(key, dmg, crit) {
    if (crit) { critZoom(key); return; }
    const f = hpFraction(key, dmg);
    if (f >= 0.3) playCardFx('arena', 'fx-arena-bump-strong', 300);
    else if (f >= 0.12 || (isHeroKey(key) && f > 0)) playCardFx('arena', 'fx-arena-bump', 240);
  }

  function arenaRect() {
    const arena = root && root.querySelector('.cb-arena');
    return arena ? arena.getBoundingClientRect() : null;
  }

  /** Bordes rojos cuando te pegan. */
  function hurtVignette(strong) {
    const r = arenaRect();
    if (!r) return;
    const v = spawn(`fx-hurt${strong ? ' is-strong' : ''}`, r.left, r.top, null, 520);
    if (v) { v.style.width = `${r.width}px`; v.style.height = `${r.height}px`; }
  }

  function impactRing(key, crit) {
    const r = spriteRect(key);
    if (!r) return;
    spawn(`fx-impact${crit ? ' is-crit' : ''}`, r.left + r.width / 2, r.top + r.height / 2, null, 420);
  }

  /** Rayas de velocidad detrás del que se tira a pegar. */
  function speedLines(key, dir) {
    const r = spriteRect(key);
    if (!r) return;
    for (let i = 0; i < 3; i++) {
      const x = dir > 0 ? r.left + r.width * 0.15 : r.right - r.width * 0.15;
      const l = spawn(`fx-speed${dir < 0 ? ' is-left' : ''}`, x, r.top + r.height * (0.35 + i * 0.18), null, 380);
      if (l) l.style.animationDelay = `${i * 40}ms`;
    }
  }

  /** El hechizo vuela de una tarjeta a la otra, dejando chispas. */
  function bolt(fromKey, toKey, element) {
    const a = spriteRect(fromKey);
    const b = spriteRect(toKey);
    if (!a || !b) return;
    const x0 = a.left + a.width / 2;
    const y0 = a.top + a.height * 0.45;
    const dx = b.left + b.width / 2 - x0;
    const dy = b.top + b.height * 0.45 - y0;
    if (element === 'shock') return; // el rayo cae del cielo (elementFx)
    const o = spawn(`fx-orb is-${element}`, x0, y0, null, BOLT_MS + 40);
    if (o) {
      o.style.setProperty('--dx', `${dx}px`);
      o.style.setProperty('--dy', `${dy}px`);
      o.style.setProperty('--rot', `${Math.atan2(dy, dx)}rad`);
      o.style.animationDuration = `${BOLT_MS}ms`;
    }
    for (let i = 1; i <= 5; i++) {
      const k = i / 6;
      const p = spawn(`fx-trail is-${element}`, x0 + dx * k, y0 + dy * k + (Math.random() * 10 - 5), null, 520);
      if (p) p.style.animationDelay = `${Math.round(BOLT_MS * k)}ms`;
    }
  }

  /** Partículas propias de cada elemento al pegar. */
  function elementFx(key, element, crit) {
    const r = spriteRect(key);
    if (!r) return;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const n = crit ? 14 : 9;
    if (element === 'shock') {
      const z = spawn('fx-lightning', cx, r.top + r.height * 0.55, '<svg viewBox="0 0 40 160" preserveAspectRatio="none"><polyline points="22,0 12,52 26,60 10,112 24,118 16,160" /></svg>', 420);
      if (z) z.style.height = `${Math.max(120, r.top + r.height * 0.55)}px`;
      flash();
      return;
    }
    if (element === 'holy') { spawn('fx-pillar', cx, r.bottom, null, 700); }
    if (element === 'arcane') { spawn('fx-rune', cx, cy, null, 700); }
    if (element === 'dark') { spawn('fx-void', cx, cy, null, 900); }
    if (element === 'ice') { iceShards(r, crit ? 7 : 5); }
    if (element === 'fire') { flames(r, crit ? 6 : 4); }
    if (element === 'earth') { rocks(r, crit ? 9 : 6); return; }
    for (let i = 0; i < n; i++) {
      const p = spawn(`fx-mote is-${element}`, cx + (Math.random() * r.width * 0.7 - r.width * 0.35), cy + (Math.random() * r.height * 0.5 - r.height * 0.1), null, 1000);
      if (!p) continue;
      const up = element === 'fire' || element === 'poison' || element === 'holy' || element === 'dark';
      p.style.setProperty('--dx', `${Math.random() * 40 - 20}px`);
      p.style.setProperty('--dy', `${up ? -(30 + Math.random() * 50) : 20 + Math.random() * 40}px`);
      p.style.setProperty('--rot', `${Math.round(Math.random() * 180)}deg`);
      p.style.animationDelay = `${Math.round(Math.random() * 140)}ms`;
    }
  }

  /** La criatura que cae suelta una bolsita que rebota. */
  function lootDrop(r) {
    const d = spawn('fx-drop', r.left + r.width / 2, r.top + r.height * 0.6, pxIcon('bag', 24), 1300);
    if (d) d.style.setProperty('--dx', `${(Math.random() < 0.5 ? -1 : 1) * (18 + Math.round(Math.random() * 14))}px`);
  }

  // ---------------------------------------------------------------
  // v3.19: crítico con acercamiento, onda de los hechizos y la criatura que se desarma en píxeles
  // ---------------------------------------------------------------

  /** En un crítico la arena se frena un instante y se acerca al golpe. */
  function critZoom(key) {
    const arena = root && root.querySelector('.cb-arena');
    const r = spriteRect(key);
    if (arena && r) {
      const a = arena.getBoundingClientRect();
      arena.style.setProperty('--zx', `${Math.round(r.left + r.width / 2 - a.left)}px`);
      arena.style.setProperty('--zy', `${Math.round(r.top + r.height / 2 - a.top)}px`);
    }
    playCardFx('arena', 'fx-arena-crit', 640);
  }

  /** Un anillo que se abre donde explota el hechizo. */
  function shockwave(key, element, crit) {
    const r = spriteRect(key);
    if (!r) return;
    spawn(`fx-shockwave is-${element}${crit ? ' is-crit' : ''}`, r.left + r.width / 2, r.top + r.height / 2, null, 620);
  }

  /** La criatura se desarma: toma los colores de su dibujo y los tira en cuadraditos. */
  function shatter(key) {
    const el = findEl(key);
    const img = el && el.querySelector('.cb-sprite > .px-sprite img');
    if (!img || !layer) return;
    const r = img.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const GRID = 14;
    let data = null;
    try {
      const cv = document.createElement('canvas');
      cv.width = GRID; cv.height = GRID;
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, GRID, GRID);
      data = ctx.getImageData(0, 0, GRID, GRID).data;
    } catch (err) { data = null; }
    const cell = r.width / GRID;
    let n = 0;
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        let color = '#6b5434';
        if (data) {
          const i = (y * GRID + x) * 4;
          if (data[i + 3] < 90) continue;
          color = `rgb(${data[i]}, ${data[i + 1]}, ${data[i + 2]})`;
        } else if (Math.random() < 0.6) continue;
        if (n > 110) break;
        n++;
        const p = spawn('fx-pixel', r.left + x * cell, r.top + y * cell, null, 1250);
        if (!p) continue;
        p.style.width = p.style.height = `${Math.max(3, Math.round(cell))}px`;
        p.style.background = color;
        p.style.setProperty('--dx', `${Math.round((x - GRID / 2) * (3 + Math.random() * 5))}px`);
        p.style.setProperty('--dy', `${Math.round(-30 - Math.random() * 70 + y * 2)}px`);
        p.style.setProperty('--rot', `${Math.round(Math.random() * 360 - 180)}deg`);
        p.style.animationDelay = `${Math.round(120 + (GRID - y) * 18 + Math.random() * 90)}ms`;
      }
    }
  }

  // ---------------------------------------------------------------
  // v3.22: cada arma pega distinto (corte, hachazo, mazazo, estocada,
  // puñalada, flecha, mordida, zarpazo, picotazo, puñetazo, varita),
  // las armas con fuego/hielo/rayo/veneno/sangrado lo muestran al pegar,
  // y los estados, los venenos que pican, las curas y las mejoras tienen
  // su propio dibujo.
  // ---------------------------------------------------------------

  const ARROW_MS = 240;
  const STYLE_RX = [
    [/arco|ballesta|honda|flecha|dardo|rifle|pistola|arcabuz/, 'arrow'],
    [/maza|martillo|garrote|porra|mazo|nudillo|cachiporra|mangual|lucero|yunque|pu[ñn]o|guante/, 'smash'],
    [/hacha|guada[ñn]a|segur|cuchilla de carnicero/, 'chop'],
    [/lanza|tridente|pica|alabarda|estoque|florete|jabalina|arp[oó]n|cuerno/, 'thrust'],
    [/daga|pu[ñn]al|cuchillo|navaja|estilete|colmillo de vidrio/, 'stab'],
    [/colmillo|garra|zarpa/, 'claw'],
    [/varita|bast[oó]n|cetro|b[aá]culo|vara\b|vara |orbe|grimorio|tomo/, 'staff'],
  ];
  const SKILL_RX = [
    [/mord|colmill|dentell|fauce|trag/, 'bite'],
    [/garra|zarpa|ara[ñn]|desgarr/, 'claw'],
    [/picot|pico|aguij|pinch|espina|p[uú]a/, 'peck'],
    [/flech|dispar|arco|lanzar|escup|proyect/, 'arrow'],
    [/embest|carga|cabez|aplast|pis[oa]|golpe|pu[ñn]|cola|coz|tromp|derrib|mazazo/, 'smash'],
    [/tajo|corte|espad|filo|hoja|cuchill/, 'slash'],
    [/estocad|lanza|ensart|cuerno/, 'thrust'],
  ];
  const WEAPON_ELEMENT = { fire: 'fire', cold: 'ice', shock: 'shock', poison: 'poison', bleed: 'bleed', blind: 'holy', curse: 'dark' };
  const TAG_ELEMENT = { fire: 'fire', poison: 'poison', acid: 'poison', holy: 'holy', void: 'dark', curse: 'dark', sin: 'dark', blood: 'bleed', ice: 'ice', cold: 'ice', frost: 'ice', shock: 'shock', storm: 'shock' };

  function matchRx(list, txt) {
    for (const [rx, kind] of list) if (rx.test(txt)) return kind;
    return null;
  }

  function weaponByName(name) {
    if (!name || !A.Data || !A.Data.weapons) return null;
    return A.Data.weapons.find((w) => w.name === name) || null;
  }

  function weaponStyle(w, name) {
    const txt = `${(w && w.id) || ''} ${(w && w.name) || name || ''}`.toLowerCase();
    let kind = matchRx(STYLE_RX, txt);
    if (!kind) kind = w && w.magic ? 'staff' : 'slash';
    const se = w && w.statusEffect && w.statusEffect.type;
    return { kind, element: WEAPON_ELEMENT[se] || null };
  }

  /** Qué dibujo lleva este ataque. Solo mira datos (no cambia nada de la pelea). */
  function attackStyle(entry) {
    const fx = entry.fx || {};
    const actor = String(fx.actor || '');
    const skillTxt = String(entry.skill || '').toLowerCase().replace(/_/g, ' ');
    try {
      if (actor === 'player' || actor.startsWith('hero:')) {
        if (!entry.weapon || entry.weapon === 'puños') return { kind: 'punch', element: null };
        return weaponStyle(weaponByName(entry.weapon), entry.weapon);
      }
      if (actor === 'pet' || actor.startsWith('pet:')) {
        return { kind: matchRx(SKILL_RX, skillTxt) || (Math.random() < 0.5 ? 'bite' : 'claw'), element: null };
      }
      if (actor.startsWith('enemy:')) {
        const c = A.State && A.State.combat;
        const inst = c && c.enemies ? c.enemies.find((e) => `enemy:${e.instanceId}` === actor) : null;
        if (!inst) return { kind: 'slash', element: null };
        const tags = (inst.tags || []).concat(inst.family || []);
        let element = null;
        for (const tg of tags) if (TAG_ELEMENT[tg]) { element = TAG_ELEMENT[tg]; break; }
        if (inst.equippedWeapon) {
          const w = A.Data.getById('weapons', inst.equippedWeapon);
          const st = weaponStyle(w);
          return { kind: st.kind, element: st.element || element };
        }
        const fromSkill = matchRx(SKILL_RX, skillTxt);
        if (fromSkill) return { kind: fromSkill, element };
        const own = (inst.skills || []).join(' ').toLowerCase().replace(/_/g, ' ');
        const fromOwn = matchRx(SKILL_RX, own);
        if (fromOwn) return { kind: fromOwn, element };
        const fam = inst.family || [];
        const has = (k) => fam.includes(k) || tags.includes(k);
        if (has('flying') && (has('beast') || has('insect'))) return { kind: 'peck', element };
        if (has('construct') || has('giant') || has('big') || has('heavy') || has('elemental')) return { kind: 'smash', element };
        if (has('beast') || has('dragon') || has('reptile') || has('insect') || has('aberration')) return { kind: Math.random() < 0.5 ? 'bite' : 'claw', element };
        if (has('spirit') || has('ethereal')) return { kind: 'claw', element: element || 'dark' };
        if (has('plant')) return { kind: 'smash', element };
        return { kind: 'slash', element };
      }
    } catch (err) { /* si algo falta, queda el corte de siempre */ }
    return { kind: 'slash', element: null };
  }

  function centerOf(key) {
    const r = spriteRect(key);
    return r ? { r, x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  }

  /** De qué lado viene el golpe (+1 = de la izquierda). */
  function sideOf(actorKey, targetKey) {
    const a = spriteRect(actorKey);
    const b = spriteRect(targetKey);
    if (a && b) return a.left + a.width / 2 <= b.left + b.width / 2 ? 1 : -1;
    return String(actorKey || '').startsWith('enemy') ? -1 : 1;
  }

  function styleHit(style, actorKey, key, crit) {
    const c = centerOf(key);
    if (!c) return;
    const { r, x, y } = c;
    const dir = sideOf(actorKey, key);
    const size = Math.max(60, Math.min(150, r.width * 1.1));
    const put = (cls, px, py, ttl, vars, html) => {
      const el = spawn(cls, px, py, html || null, ttl);
      if (el && vars) for (const k in vars) el.style.setProperty(k, vars[k]);
      return el;
    };
    switch (style.kind) {
      case 'chop': {
        // hachazo: un tajo grueso de arriba abajo y astillas que caen
        put(`fx-chop${crit ? ' is-crit' : ''}`, x, y, 460, { '--s': `${size}px`, '--a': `${dir > 0 ? 62 : 118}deg` });
        for (let i = 0; i < (crit ? 8 : 5); i++) put('fx-chip', x + (Math.random() * 30 - 15), y, 700, { '--dx': `${dir * (10 + Math.random() * 40)}px`, '--dy': `${20 + Math.random() * 40}px`, '--rot': `${Math.round(Math.random() * 360)}deg` });
        break;
      }
      case 'smash': {
        // mazazo: grieta en estrella, polvo abajo y la arena se sacude
        put(`fx-crack${crit ? ' is-crit' : ''}`, x, y, 620, { '--s': `${size * 0.9}px`, '--rot': `${Math.round(Math.random() * 60)}deg` }, '<svg viewBox="0 0 100 100"><path d="M50 50 L18 30 M50 50 L30 88 M50 50 L86 22 M50 50 L92 66 M50 50 L56 6 M50 50 L8 58 M30 36 L22 18 M70 32 L80 40 M62 72 L70 90" /></svg>');
        for (let i = 0; i < (crit ? 6 : 4); i++) put('fx-dust', r.left + r.width * (0.15 + Math.random() * 0.7), r.bottom - 6, 760, { '--dx': `${(Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 26)}px` });
        playCardFx('arena', crit ? 'fx-arena-bump-strong' : 'fx-arena-bump', 280);
        break;
      }
      case 'thrust': {
        // estocada: una línea rápida que atraviesa
        put(`fx-thrust${crit ? ' is-crit' : ''}${dir < 0 ? ' is-left' : ''}`, x, y + (Math.random() * 16 - 8), 380, { '--s': `${size * 1.3}px` });
        put('fx-pierce', x, y, 420);
        break;
      }
      case 'stab': {
        // puñalada: dos pinchazos seguidos
        for (let i = 0; i < 2; i++) {
          const el = put(`fx-thrust is-short${dir < 0 ? ' is-left' : ''}${crit ? ' is-crit' : ''}`, x + (i ? 8 : -6), y + (i ? 10 : -8), 420, { '--s': `${size * 0.8}px` });
          if (el) el.style.animationDelay = `${i * 110}ms`;
          const p = put('fx-pierce is-small', x + (i ? 8 : -6), y + (i ? 10 : -8), 520);
          if (p) p.style.animationDelay = `${i * 110}ms`;
        }
        break;
      }
      case 'arrow': {
        // la flecha se clava y tiembla un poquito
        put(`fx-arrow-stuck${dir < 0 ? ' is-left' : ''}`, x - dir * 6, y - r.height * 0.05, 820, null, arrowSvg());
        put('fx-pierce is-small', x, y, 420);
        break;
      }
      case 'bite': {
        // mordida: dos filas de dientes que se cierran
        const s = Math.max(56, Math.min(120, r.width * 0.85));
        put('fx-jaw is-top', x, y, 520, { '--s': `${s}px` }, teethSvg(false));
        put('fx-jaw is-bottom', x, y, 520, { '--s': `${s}px` }, teethSvg(true));
        if (crit) for (let i = 0; i < 4; i++) put('fx-mote is-bleed', x + (Math.random() * 30 - 15), y + 8, 900, { '--dx': `${Math.random() * 30 - 15}px`, '--dy': `${25 + Math.random() * 30}px`, '--rot': '0deg' });
        break;
      }
      case 'claw': {
        // zarpazo: tres rayas paralelas
        const a = dir > 0 ? -55 : -125;
        for (let i = 0; i < 3; i++) {
          const el = put(`fx-claw${crit ? ' is-crit' : ''}`, x + (i - 1) * 14, y + (i - 1) * 6, 480, { '--a': `${a}deg`, '--s': `${size * 0.9}px` });
          if (el) el.style.animationDelay = `${i * 45}ms`;
        }
        break;
      }
      case 'peck': {
        // picotazo: puntitos rápidos
        for (let i = 0; i < 3; i++) {
          const p = put('fx-pierce is-small', x + (Math.random() * 30 - 15), y + (Math.random() * 30 - 15), 380);
          if (p) p.style.animationDelay = `${i * 70}ms`;
        }
        break;
      }
      case 'punch': {
        // puñetazo: estrellita de historieta
        put(`fx-pow${crit ? ' is-crit' : ''}`, x, y, 460, { '--s': `${size * 0.7}px`, '--rot': `${Math.round(Math.random() * 40 - 20)}deg` });
        break;
      }
      case 'staff': {
        // varitazo: un golpecito con chispas mágicas
        slash(key, crit);
        sparks(key, 6, 'spell-arcane');
        spawn('fx-rune is-small', x, y, null, 600);
        break;
      }
      default: {
        // espada: el corte de siempre + una media luna
        slash(key, crit);
        put(`fx-arc${crit ? ' is-crit' : ''}${dir < 0 ? ' is-left' : ''}`, x, y, 420, { '--s': `${size}px` });
      }
    }
    if (style.element) weaponElement(r, style.element, crit);
  }

  /** El arma tiene fuego, hielo, rayo, veneno o hace sangrar: se ve un poco al pegar. */
  function weaponElement(r, element, crit) {
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (element === 'shock') {
      for (let i = 0; i < (crit ? 3 : 2); i++) {
        const z = spawn('fx-zap', cx + (Math.random() * r.width * 0.6 - r.width * 0.3), cy + (Math.random() * 30 - 15), '<svg viewBox="0 0 20 40"><polyline points="12,0 4,18 12,20 6,40" /></svg>', 360);
        if (z) z.style.animationDelay = `${i * 70}ms`;
      }
      return;
    }
    if (element === 'fire') flames(r, crit ? 4 : 2);
    if (element === 'ice') iceShards(r, crit ? 4 : 3);
    const kind = element === 'bleed' ? 'bleed' : element;
    const n = crit ? 7 : 4;
    for (let i = 0; i < n; i++) {
      const p = spawn(`fx-mote is-${kind}`, cx + (Math.random() * r.width * 0.5 - r.width * 0.25), cy + (Math.random() * 20 - 10), null, 900);
      if (!p) continue;
      const down = kind === 'bleed' || kind === 'ice';
      p.style.setProperty('--dx', `${Math.random() * 36 - 18}px`);
      p.style.setProperty('--dy', `${down ? 22 + Math.random() * 30 : -(22 + Math.random() * 36)}px`);
      p.style.setProperty('--rot', `${Math.round(Math.random() * 120)}deg`);
      p.style.animationDelay = `${Math.round(Math.random() * 100)}ms`;
    }
  }

  function arrowSvg() {
    return '<svg viewBox="0 0 48 12"><path class="sh" d="M6 6 H40" /><path class="hd" d="M40 2 L48 6 L40 10 Z" /><path class="fl" d="M0 1 L8 6 L0 11 L4 6 Z" /></svg>';
  }

  function teethSvg(bottom) {
    return bottom
      ? '<svg viewBox="0 0 100 30"><path d="M4 28 L14 4 L24 28 L34 6 L44 28 L54 4 L64 28 L74 6 L84 28 L94 4 L98 28 Z" /></svg>'
      : '<svg viewBox="0 0 100 30"><path d="M4 2 L14 26 L24 2 L34 24 L44 2 L54 26 L64 2 L74 24 L84 2 L94 26 L98 2 Z" /></svg>';
  }

  /** La flecha sale del arquero y vuela hasta el blanco (o pasa de largo si esquiva). */
  function arrowFly(fromKey, toKey, miss) {
    const a = spriteRect(fromKey);
    const b = spriteRect(toKey);
    if (!a || !b) return;
    const x0 = a.left + a.width / 2;
    const y0 = a.top + a.height * 0.45;
    let dx = b.left + b.width / 2 - x0;
    let dy = b.top + b.height * 0.45 - y0;
    if (miss) { dx *= 1.35; dy = dy * 1.35 - 30; }
    const o = spawn('fx-arrow', x0, y0, arrowSvg(), ARROW_MS + 60);
    if (!o) return;
    o.style.setProperty('--dx', `${dx}px`);
    o.style.setProperty('--dy', `${dy}px`);
    o.style.setProperty('--rot', `${Math.atan2(dy, dx)}rad`);
    o.style.animationDuration = `${ARROW_MS}ms`;
  }

  /** Crítico: rayos de luz detrás del golpe. */
  function critBurst(key) {
    const c = centerOf(key);
    if (!c) return;
    const s = Math.max(120, Math.min(240, c.r.width * 1.8));
    const el = spawn('fx-crit-rays', c.x, c.y, null, 640);
    if (el) el.style.setProperty('--s', `${s}px`);
  }

  function flames(r, n) {
    for (let i = 0; i < n; i++) {
      const f = spawn('fx-flame', r.left + r.width * (0.2 + Math.random() * 0.6), r.top + r.height * (0.55 + Math.random() * 0.3), null, 900);
      if (!f) continue;
      f.style.setProperty('--h', `${16 + Math.round(Math.random() * 16)}px`);
      f.style.animationDelay = `${Math.round(Math.random() * 180)}ms`;
    }
  }

  function iceShards(r, n) {
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const s = spawn('fx-shard', cx, cy, null, 820);
      if (!s) continue;
      s.style.setProperty('--dx', `${Math.cos(ang) * (26 + Math.random() * 22)}px`);
      s.style.setProperty('--dy', `${Math.sin(ang) * (26 + Math.random() * 22)}px`);
      s.style.setProperty('--rot', `${ang + Math.PI / 2}rad`);
    }
  }

  function rocks(r, n) {
    for (let i = 0; i < n; i++) {
      const p = spawn('fx-rock', r.left + r.width * (0.2 + Math.random() * 0.6), r.top + r.height * (0.3 + Math.random() * 0.4), null, 900);
      if (!p) continue;
      p.style.setProperty('--dx', `${Math.random() * 60 - 30}px`);
      p.style.setProperty('--dy', `${30 + Math.random() * 40}px`);
      p.style.setProperty('--rot', `${Math.round(Math.random() * 360)}deg`);
    }
    for (let i = 0; i < 3; i++) {
      const d = spawn('fx-dust', r.left + r.width * (0.2 + Math.random() * 0.6), r.bottom - 6, null, 760);
      if (d) d.style.setProperty('--dx', `${(Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 26)}px`);
    }
  }

  /**
   * Lo que se ve cuando un estado entra (big) o cuando pica en su turno:
   * burbujas de veneno, llamitas, gotas de sangre, escarcha, chispas,
   * estrellitas del aturdido, una marca oscura de la maldición…
   */
  function effectFx(key, effect, n, big) {
    const c = centerOf(key);
    if (!c) return;
    const { r, x, y } = c;
    const rnd = (a, b) => a + Math.random() * (b - a);
    switch (effect) {
      case 'poison': case 'corrode': {
        for (let i = 0; i < n; i++) {
          const b = spawn('fx-bubble', r.left + r.width * rnd(0.2, 0.8), r.top + r.height * rnd(0.45, 0.8), null, 1100);
          if (!b) continue;
          const s = Math.round(rnd(5, 11));
          b.style.width = b.style.height = `${s}px`;
          b.style.setProperty('--dy', `${-rnd(30, 60)}px`);
          b.style.animationDelay = `${Math.round(rnd(0, 260))}ms`;
        }
        if (big) spawn('fx-cloud is-poison', x, y + r.height * 0.1, null, 1100);
        break;
      }
      case 'fire': flames(r, big ? 7 : 4); break;
      case 'bleed': {
        for (let i = 0; i < n; i++) {
          const p = spawn('fx-mote is-bleed', r.left + r.width * rnd(0.3, 0.7), y + rnd(-10, 10), null, 900);
          if (!p) continue;
          p.style.setProperty('--dx', `${rnd(-10, 10)}px`);
          p.style.setProperty('--dy', `${rnd(26, 50)}px`);
          p.style.setProperty('--rot', '0deg');
          p.style.animationDelay = `${Math.round(rnd(0, 200))}ms`;
        }
        break;
      }
      case 'cold': {
        iceShards(r, big ? 6 : 4);
        if (big) spawn('fx-frost', x, y, null, 1100);
        break;
      }
      case 'shock': weaponElement(r, 'shock', big); break;
      case 'stun': case 'prone': {
        const ring = spawn('fx-stars', x, r.top + r.height * 0.12, `${pxIcon('star', 12)}${pxIcon('star', 12)}${pxIcon('star', 12)}`, 1300);
        if (ring) ring.style.setProperty('--w', `${Math.max(40, r.width * 0.6)}px`);
        break;
      }
      case 'curse': case 'fear': case 'noheal': case 'blind': case 'silence': {
        spawn(`fx-sigil is-${effect}`, x, y, null, 1100);
        for (let i = 0; i < 6; i++) {
          const p = spawn('fx-mote is-dark', x + rnd(-r.width * 0.3, r.width * 0.3), y + rnd(-10, 20), null, 1000);
          if (!p) continue;
          p.style.setProperty('--dx', `${rnd(-14, 14)}px`);
          p.style.setProperty('--dy', `${-rnd(26, 50)}px`);
          p.style.setProperty('--rot', '0deg');
          p.style.animationDelay = `${Math.round(rnd(0, 200))}ms`;
        }
        break;
      }
      case 'grab': spawn('fx-bind', x, y, null, 1000); break;
      case 'stagger': case 'exposed': spawn('fx-swirl', x, r.top + r.height * 0.15, null, 1000); break;
      case 'rally': case 'fury': case 'guard': case 'vigor': case 'immune': buffAura(key); break;
      default: break;
    }
  }

  /** Cura: una columna de luz verde que sube y un aro en el piso (azul si es maná). */
  function healBeam(key, mana) {
    const c = centerOf(key);
    if (!c) return;
    const { r, x } = c;
    const b = spawn(`fx-heal-beam${mana ? ' is-mana' : ''}`, x, r.bottom, null, 900);
    if (b) { b.style.width = `${Math.max(40, r.width * 0.7)}px`; b.style.height = `${r.height * 1.15}px`; }
    const g = spawn(`fx-heal-ring${mana ? ' is-mana' : ''}`, x, r.bottom - 4, null, 900);
    if (g) g.style.setProperty('--w', `${Math.max(50, r.width * 0.9)}px`);
    for (let i = 0; i < 5; i++) {
      const p = spawn(`fx-plus${mana ? ' is-mana' : ''}`, r.left + r.width * (0.2 + Math.random() * 0.6), r.top + r.height * (0.5 + Math.random() * 0.4), '+', 1000);
      if (p) p.style.animationDelay = `${Math.round(Math.random() * 300)}ms`;
    }
  }

  /** Mejora: un aro dorado que sube por la tarjeta. */
  function buffAura(key) {
    const c = centerOf(key);
    if (!c) return;
    const a = spawn('fx-buff-ring', c.x, c.r.bottom - 6, null, 900);
    if (a) a.style.setProperty('--w', `${Math.max(50, c.r.width * 0.9)}px`);
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
      stagger: 'Desequilibrado', exposed: 'Expuesto', // v3.11
      noheal: 'Herida maldita', // v3.15
      vigor: '¡Más vida!', // v3.21.7
      immune: 'Inmune', fury: '¡Furia!', steal: '¡Te roba!',
    })[type] || type;
  }

  /** v2.5: ícono del número flotante de cada estado. */
  function statusIcon(type) {
    const map = { stun: 'hourglass', curse: 'skull', prone: 'arrow-down', fear: 'warning', grab: 'lock', corrode: 'poison', rally: 'arrow-up', guard: 'shield', immune: 'star', fury: 'fist', steal: 'coins', stagger: 'target', exposed: 'arrow-down', noheal: 'heart', vigor: 'heart' };
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
