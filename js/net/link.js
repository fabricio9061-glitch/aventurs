/* ============================================================
   Aventurs — Conexión entre jugadores (v3.0)

   Jugar en grupo no necesita un servidor propio: los navegadores se
   conectan directo entre sí (WebRTC) con PeerJS (js/vendor/peerjs.min.js).
   Para encontrarse usan el servidor gratuito de PeerJS, solo al principio.

     host(code)  abre un grupo con un código ("K7Q2XP") y espera
     join(code)  se conecta al grupo de ese código
     send(msg)   manda un objeto (se parte en trozos si es grande)

   El anfitrión puede tener varias conexiones (una por invitado); el
   invitado, una sola. Cada conexión manda un latido cada 4 segundos: si
   pasan 20 sin noticias, se da por cortada.

   Para probar sin internet: localStorage 'aventurs:peer' con
     {"host":"127.0.0.1","port":9000,"path":"/myapp","secure":false}
   apunta a un servidor PeerJS propio.
   ============================================================ */

(function (A) {
  'use strict';

  const PREFIX = 'aventurs-v3-';
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I/L: fácil de dictar
  const CODE_LEN = 6;
  const CHUNK = 15000;        // caracteres por trozo (los canales aceptan poco por mensaje)
  const BEAT_MS = 4000;       // latido
  const DEAD_MS = 20000;      // sin noticias en este tiempo: conexión cortada
  const OPEN_TIMEOUT = 15000; // tiempo para encontrar el grupo

  let peer = null;
  let role = null;            // 'host' | 'guest'
  const conns = new Map();    // peerId -> Conn
  let beatTimer = null;
  const handlers = { message: [], open: [], close: [], error: [] };

  function on(ev, fn) { handlers[ev].push(fn); return () => { handlers[ev] = handlers[ev].filter((f) => f !== fn); }; }
  function fire(ev, ...args) { for (const fn of handlers[ev].slice()) { try { fn(...args); } catch (e) { console.error('[Link]', ev, e); } } }

  function available() { return typeof window !== 'undefined' && typeof window.Peer === 'function'; }

  function newCode() {
    let out = '';
    const rnd = (window.crypto && window.crypto.getRandomValues) ? window.crypto.getRandomValues(new Uint32Array(CODE_LEN)) : null;
    for (let i = 0; i < CODE_LEN; i++) {
      const n = rnd ? rnd[i] : Math.floor(Math.random() * 1e9);
      out += ALPHABET[n % ALPHABET.length];
    }
    return out;
  }

  /** "k7q-2xp" -> "K7Q2XP" (acepta minúsculas, guiones y espacios). */
  function cleanCode(code) {
    return String(code || '').toUpperCase().split('').filter((ch) => ALPHABET.includes(ch)).join('').slice(0, CODE_LEN);
  }
  function prettyCode(code) { const c = cleanCode(code); return c.length === 6 ? `${c.slice(0, 3)}-${c.slice(3)}` : c; }

  function peerOptions() {
    let o = {};
    try { o = JSON.parse(localStorage.getItem('aventurs:peer') || '{}') || {}; } catch (e) { o = {}; }
    return Object.assign({ debug: 0 }, o);
  }

  // ============================================================
  // Una conexión (con trozos y latido)
  // ============================================================

  class Conn {
    constructor(dc) {
      this.dc = dc;
      this.peerId = dc.peer;
      this.parts = new Map();
      this.lastSeen = Date.now();
      this.closed = false;
      this.seq = 0;
      dc.on('data', (data) => this.recv(data));
      dc.on('close', () => this.close('closed'));
      dc.on('error', (err) => { console.warn('[Link] canal:', err && err.type); });
    }

    send(obj) {
      if (this.closed || !this.dc || !this.dc.open) return false;
      let str;
      try { str = JSON.stringify(obj); } catch (e) { console.error('[Link] no se pudo armar el mensaje', e); return false; }
      try {
        if (str.length <= CHUNK) {
          this.dc.send(`J${str}`);
        } else {
          const id = (++this.seq).toString(36);
          const n = Math.ceil(str.length / CHUNK);
          for (let i = 0; i < n; i++) this.dc.send(`C${id}|${i}|${n}|${str.slice(i * CHUNK, (i + 1) * CHUNK)}`);
        }
        return true;
      } catch (e) {
        console.warn('[Link] no se pudo mandar:', e && e.message);
        return false;
      }
    }

    recv(data) {
      this.lastSeen = Date.now();
      if (typeof data !== 'string' || !data.length) return;
      const kind = data[0];
      if (kind === 'B') return; // latido
      if (kind === 'J') { this.deliver(data.slice(1)); return; }
      if (kind === 'C') {
        const a = data.indexOf('|');
        const b = data.indexOf('|', a + 1);
        const c = data.indexOf('|', b + 1);
        if (a < 0 || b < 0 || c < 0) return;
        const id = data.slice(1, a);
        const i = Number(data.slice(a + 1, b));
        const n = Number(data.slice(b + 1, c));
        const part = data.slice(c + 1);
        let box = this.parts.get(id);
        if (!box) { box = { n, got: 0, list: new Array(n) }; this.parts.set(id, box); }
        if (box.list[i] == null) { box.list[i] = part; box.got += 1; }
        if (box.got >= box.n) {
          this.parts.delete(id);
          this.deliver(box.list.join(''));
        }
      }
    }

    deliver(str) {
      let msg = null;
      try { msg = JSON.parse(str); } catch (e) { console.warn('[Link] mensaje roto'); return; }
      fire('message', msg, this.peerId);
    }

    beat() {
      if (this.closed) return;
      if (Date.now() - this.lastSeen > DEAD_MS) { this.close('timeout'); return; }
      try { if (this.dc && this.dc.open) this.dc.send('B'); } catch (e) { /* se cierra solo */ }
    }

    close(why) {
      if (this.closed) return;
      this.closed = true;
      try { this.dc.close(); } catch (e) { /* ya estaba cerrada */ }
      conns.delete(this.peerId);
      fire('close', this.peerId, why || 'closed');
    }
  }

  function startBeat() {
    if (beatTimer) return;
    beatTimer = setInterval(() => { for (const c of [...conns.values()]) c.beat(); }, BEAT_MS);
  }
  function stopBeat() { clearInterval(beatTimer); beatTimer = null; }

  function adopt(dc) {
    const c = new Conn(dc);
    conns.set(c.peerId, c);
    startBeat();
    fire('open', c.peerId);
    return c;
  }

  // ============================================================
  // Errores en palabras
  // ============================================================

  function errorText(err) {
    const t = err && err.type;
    if (t === 'peer-unavailable') return 'No hay ningún grupo abierto con ese código. Revisalo o pedile uno nuevo.';
    if (t === 'unavailable-id') return 'Ese código ya está en uso.';
    if (t === 'browser-incompatible') return 'Este navegador no puede jugar en grupo. Probá con Chrome, Edge o Firefox actualizados.';
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'No se pudo llegar al servidor para encontrarse. Revisá la conexión a internet y probá de nuevo.';
    if (t === 'disconnected') return 'Se perdió la conexión con el servidor.';
    if (t === 'timeout') return 'No respondió nadie. Revisá el código y que tu compañero tenga el grupo abierto.';
    return 'No se pudo conectar. Probá de nuevo en un rato.';
  }

  // ============================================================
  // Abrir o unirse
  // ============================================================

  /** Abre un grupo. Devuelve una promesa con el código. */
  function host(code) {
    close();
    if (!available()) return Promise.reject({ type: 'browser-incompatible' });
    role = 'host';
    const wanted = cleanCode(code) || newCode();
    return new Promise((resolve, reject) => {
      let done = false;
      const p = new window.Peer(PREFIX + wanted, peerOptions());
      peer = p;
      const timer = setTimeout(() => { if (!done) { done = true; reject({ type: 'network' }); } }, OPEN_TIMEOUT);
      p.on('open', () => { if (done) return; done = true; clearTimeout(timer); resolve(wanted); });
      p.on('connection', (dc) => {
        dc.on('open', () => adopt(dc));
      });
      p.on('disconnected', () => {
        // perdió el servidor (los que ya están conectados siguen): reintenta para que puedan entrar otros
        if (peer === p && !p.destroyed) setTimeout(() => { try { if (peer === p && !p.destroyed) p.reconnect(); } catch (e) { /* nada */ } }, 2000);
      });
      p.on('error', (err) => {
        if (!done) { done = true; clearTimeout(timer); reject(err); return; }
        if (err && err.type !== 'peer-unavailable') fire('error', err);
      });
    });
  }

  /** Se une a un grupo. Devuelve una promesa que se cumple con la conexión abierta. */
  function join(code) {
    close();
    if (!available()) return Promise.reject({ type: 'browser-incompatible' });
    role = 'guest';
    const target = PREFIX + cleanCode(code);
    return new Promise((resolve, reject) => {
      let done = false;
      const p = new window.Peer(peerOptions());
      peer = p;
      const timer = setTimeout(() => { if (!done) { done = true; reject({ type: 'timeout' }); } }, OPEN_TIMEOUT + 5000);
      p.on('open', () => {
        const dc = p.connect(target, { reliable: true, serialization: 'raw' });
        dc.on('open', () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          adopt(dc);
          resolve(true);
        });
      });
      p.on('error', (err) => {
        if (!done) { done = true; clearTimeout(timer); reject(err); return; }
        fire('error', err);
      });
    });
  }

  /** Manda a una conexión (peerId) o a todas. */
  function send(msg, peerId) {
    if (peerId) {
      const c = conns.get(peerId);
      return c ? c.send(msg) : false;
    }
    let ok = false;
    for (const c of conns.values()) ok = c.send(msg) || ok;
    return ok;
  }

  function drop(peerId) {
    const c = conns.get(peerId);
    if (c) c.close('dropped');
  }

  function close() {
    stopBeat();
    for (const c of [...conns.values()]) c.close('closed');
    conns.clear();
    if (peer) { try { peer.destroy(); } catch (e) { /* nada */ } }
    peer = null;
    role = null;
  }

  A.Link = {
    PREFIX,
    available,
    newCode,
    cleanCode,
    prettyCode,
    errorText,
    host,
    join,
    send,
    drop,
    close,
    on,
    role: () => role,
    peers: () => [...conns.keys()],
    isOpen: () => conns.size > 0,
  };
})(window.Aventurs);
