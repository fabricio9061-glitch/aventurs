/* ============================================================
   Aventurs — Voz del narrador (v3.1)

   El narrador lee en voz alta lo que pasa: las peleas, las escenas al
   explorar y lo que encontrás en el camino. Usa la voz que trae el
   navegador (Web Speech API): primero una en español de Latinoamérica,
   después cualquier español.

   Se prende y se apaga desde el Menú (o con el parlante del combate).
   Es de esta compu, no de la partida: localStorage 'aventurs:voice'
     { on, rate }   rate: 1 normal, 1.25 rápida

   Si llegan muchas frases juntas, lee las últimas (no se atrasa).
   ============================================================ */

(function (A) {
  'use strict';

  const KEY = 'aventurs:voice';
  const MAX_QUEUE = 3;
  const LATAM = ['es-ar', 'es-uy', 'es-419', 'es-us', 'es-mx', 'es-co', 'es-cl', 'es-pe', 'es-ve'];

  let prefs = load();
  let queue = [];
  let speaking = false;
  let current = null;
  let guard = null;

  function supported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
  }

  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
      return { on: !!v.on, rate: Number(v.rate) || 1 };
    } catch (e) {
      return { on: false, rate: 1 };
    }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* nada */ } }

  function voices() {
    try { return window.speechSynthesis.getVoices() || []; } catch (e) { return []; }
  }

  /** La mejor voz en español que tenga el navegador. */
  function pickVoice() {
    const list = voices().filter((v) => /^es\b|^es[-_]/i.test(v.lang || ''));
    if (!list.length) return null;
    const lang = (v) => String(v.lang || '').toLowerCase().replace('_', '-');
    for (const tag of LATAM) {
      const found = list.filter((v) => lang(v).startsWith(tag));
      if (found.length) return found.find((v) => !v.localService) || found[0];
    }
    return list.find((v) => lang(v) === 'es-es') || list[0];
  }

  /** Limpia el texto para que suene bien: sin símbolos raros ni espacios de más. */
  function clean(text) {
    return String(text || '')
      .replace(/[«»"“”]/g, '')
      .replace(/×/g, ' por ')
      .replace(/\s*·\s*/g, ', ')
      .replace(/…/g, '...')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function pump() {
    if (speaking || !queue.length || !supported()) return;
    const text = queue.shift();
    const u = new window.SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'es-AR';
    u.rate = prefs.rate || 1;
    u.pitch = 0.95;
    speaking = true;
    current = u;
    const done = () => {
      if (current !== u) return;
      clearTimeout(guard);
      speaking = false;
      current = null;
      pump();
    };
    u.onend = done;
    u.onerror = done;
    // por si el navegador no avisa que terminó (pasa en algunas versiones)
    clearTimeout(guard);
    guard = setTimeout(done, Math.min(20000, 2500 + text.length * 90));
    try { window.speechSynthesis.speak(u); } catch (e) { done(); }
  }

  /** Lee una frase. opts.now: corta lo que estaba leyendo y lee esta. */
  function say(text, opts = {}) {
    if (!prefs.on || !supported()) return false;
    const t = clean(text);
    if (!t) return false;
    if (opts.now) stop();
    queue.push(t);
    // si se juntan muchas, quedan las últimas
    while (queue.length > MAX_QUEUE) queue.shift();
    pump();
    return true;
  }

  function stop() {
    queue = [];
    speaking = false;
    current = null;
    clearTimeout(guard);
    try { if (supported()) window.speechSynthesis.cancel(); } catch (e) { /* nada */ }
  }

  function setOn(on) {
    prefs.on = !!on;
    save();
    if (!prefs.on) stop();
    else say('La voz del narrador está encendida.', { now: true });
    if (A.Bus) A.Bus.emit('voice:changed', { on: prefs.on });
  }

  function setRate(rate) {
    prefs.rate = Math.max(0.7, Math.min(1.6, Number(rate) || 1));
    save();
    if (A.Bus) A.Bus.emit('voice:changed', { on: prefs.on, rate: prefs.rate });
  }

  // las voces del navegador a veces llegan tarde
  if (supported()) {
    try { window.speechSynthesis.onvoiceschanged = () => { voices(); }; } catch (e) { /* nada */ }
  }

  A.Voice = {
    supported,
    isOn: () => !!prefs.on,
    rate: () => prefs.rate || 1,
    setOn,
    toggle: () => setOn(!prefs.on),
    setRate,
    say,
    stop,
    voiceName: () => { const v = pickVoice(); return v ? v.name : null; },
    hasSpanish: () => !!pickVoice(),
  };
})(window.Aventurs);
