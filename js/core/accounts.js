/* ============================================================
   Aventurs — Cuentas (v3.0)

   Cada jugador entra con su usuario y su contraseña, y tiene su propia
   partida. Las cuentas viven en ESTA compu (en el navegador): no hay
   servidor. Si jugás en otra compu, creás la cuenta ahí.

     - La contraseña no se guarda: se guarda su "huella" (PBKDF2 con sal),
       así nadie la puede leer desde el navegador.
     - El usuario del dueño (OWNER) es el único que ve el Editor. Para
       crearlo hace falta la llave del dueño (solo la conoce él; acá está
       guardada nada más su huella).
     - La primera cuenta que se crea en una compu puede quedarse con la
       partida que había de antes (versiones viejas, sin cuentas).

   Guardado:
     localStorage 'aventurs:accounts' = { users: { usuario: {...} }, last }
     localStorage 'aventurs:remember' = usuario que entra solo al abrir
     sessionStorage 'aventurs:session' = usuario de esta pestaña
     la partida: 'aventurs:save:usuario' (ver js/core/state.js)
   ============================================================ */

(function (A) {
  'use strict';

  const KEY = 'aventurs:accounts';
  const REMEMBER = 'aventurs:remember';
  const SESSION = 'aventurs:session';
  const LEGACY_SAVE = 'aventurs:save';
  const ITER = 100000;

  // El dueño del juego (el que puede usar el Editor)
  const OWNER = 'anibal9061';
  // Huella de la llave del dueño (PBKDF2-SHA256, 150.000 vueltas). La llave no está en el código.
  const OWNER_SALT = 'aventurs-owner-v3';
  const OWNER_ITER = 150000;
  const OWNER_HASH = '8aa76ae24fb01f008da0a7b0a76e62e2e9aa922fd9804187d7e4b34a4821151f';

  let current = null;

  // ============================================================
  // Guardado
  // ============================================================

  function readDb() {
    try {
      const db = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
      if (!db.users || typeof db.users !== 'object') db.users = {};
      return db;
    } catch (e) { return { users: {} }; }
  }
  function writeDb(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); return true; } catch (e) { return false; } }
  function ss(get, val) {
    try {
      if (get) return sessionStorage.getItem(SESSION);
      if (val) sessionStorage.setItem(SESSION, val); else sessionStorage.removeItem(SESSION);
    } catch (e) { /* sin almacenamiento de sesión */ }
    return null;
  }
  function ls(k, val) {
    try {
      if (val === undefined) return localStorage.getItem(k);
      if (val === null) localStorage.removeItem(k); else localStorage.setItem(k, val);
    } catch (e) { /* nada */ }
    return null;
  }

  /** "  Fabri.9061 " -> "fabri.9061" */
  function norm(name) { return String(name || '').trim().toLowerCase(); }
  function validName(name) {
    const n = norm(name);
    if (n.length < 3) return 'El usuario tiene que tener al menos 3 letras.';
    if (n.length > 20) return 'El usuario puede tener hasta 20 letras.';
    if (!/^[a-z0-9ñ._-]+$/.test(n)) return 'Usá solo letras, números, punto, guion o guion bajo (sin espacios).';
    return null;
  }

  // ============================================================
  // Huellas (PBKDF2 con WebCrypto; si no hay, SHA-256 repetido)
  // ============================================================

  function toHex(buf) { return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join(''); }
  function randomSalt() {
    const a = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(a);
    else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    return toHex(a.buffer);
  }

  async function pbkdf2(password, salt, iter) {
    const subtle = window.crypto && window.crypto.subtle;
    const enc = new TextEncoder();
    if (subtle) {
      const keyMat = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
      const bits = await subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: iter, hash: 'SHA-256' }, keyMat, 256);
      return toHex(bits);
    }
    // Sin WebCrypto (abrir el archivo de forma rara): SHA-256 repetido, menos fuerte pero sirve
    let h = `${salt}:${password}`;
    for (let i = 0; i < 2000; i++) h = sha256(h);
    return `s:${h}`;
  }

  // SHA-256 chiquito (solo para el caso sin WebCrypto)
  function sha256(ascii) {
    const rr = (v, a) => (v >>> a) | (v << (32 - a));
    const K = [];
    const H = [];
    let p = 0;
    const isC = {};
    for (let c = 2; p < 64; c++) {
      if (!isC[c]) {
        for (let i = 0; i < 313; i += c) isC[i] = c;
        if (p < 8) H[p] = (Math.pow(c, 0.5) * 0x100000000) | 0;
        K[p++] = (Math.pow(c, 1 / 3) * 0x100000000) | 0;
      }
    }
    const bytes = unescape(encodeURIComponent(ascii));
    const words = [];
    const len = bytes.length * 8;
    let s = `${bytes}\x80`;
    while (s.length % 64 - 56) s += '\x00';
    for (let i = 0; i < s.length; i++) words[i >> 2] |= s.charCodeAt(i) << ((3 - i) % 4) * 8;
    words[words.length] = (len / 0x100000000) | 0;
    words[words.length] = len;
    let hash = H.slice(0, 8);
    for (let j = 0; j < words.length;) {
      const w = words.slice(j, j += 16);
      const old = hash;
      hash = hash.slice(0, 8);
      for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15];
        const w2 = w[i - 2];
        const a = hash[0];
        const e = hash[4];
        const t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + K[i]
          + (w[i] = i < 16 ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        const t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0].concat(hash);
        hash[4] = (hash[4] + t1) | 0;
      }
      for (let i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0;
    }
    let out = '';
    for (let i = 0; i < 8; i++) for (let j = 3; j + 1; j--) { const b = (hash[i] >> (j * 8)) & 255; out += (b < 16 ? '0' : '') + b.toString(16); }
    return out;
  }

  /** ¿Es la llave del dueño? (acepta minúsculas, guiones y espacios) */
  async function checkOwnerKey(key) {
    let clean = String(key || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length < 10) return false;
    if (!clean.startsWith('AVT')) clean = `AVT${clean}`;
    try {
      const h = await pbkdf2(clean, OWNER_SALT, OWNER_ITER);
      return h === OWNER_HASH;
    } catch (e) { return false; }
  }

  // ============================================================
  // API
  // ============================================================

  function list() {
    const db = readDb();
    return Object.keys(db.users).map((k) => ({ key: k, name: db.users[k].name || k, owner: !!db.users[k].owner, last: db.users[k].last || 0, hero: heroSummary(k) }))
      .sort((a, b) => (b.last || 0) - (a.last || 0));
  }

  /** Nombre, raza y nivel del personaje guardado en una cuenta (para la lista de entrada). */
  function heroSummary(key) {
    try {
      const raw = localStorage.getItem(`${LEGACY_SAVE}:${key}`);
      if (!raw) return null;
      const p = (JSON.parse(raw) || {}).player;
      return p ? { name: p.name, raceId: p.raceId, level: p.level } : null;
    } catch (e) { return null; }
  }

  /** La partida de antes de las cuentas (si existe y nadie la tomó). */
  function legacySave() {
    try {
      const raw = localStorage.getItem(LEGACY_SAVE);
      if (!raw) return null;
      const p = (JSON.parse(raw) || {}).player;
      return p ? { name: p.name, raceId: p.raceId, level: p.level } : null;
    } catch (e) { return null; }
  }

  function exists(name) { return !!readDb().users[norm(name)]; }
  function isOwnerName(name) { return norm(name) === OWNER; }

  function begin(key, remember) {
    current = key;
    ss(false, key);
    if (remember) ls(REMEMBER, key);
    const db = readDb();
    if (db.users[key]) { db.users[key].last = Date.now(); db.last = key; writeDb(db); }
    if (A.Bus) A.Bus.emit('account:changed', { user: key });
  }

  /**
   * Crear cuenta. opts: { ownerKey, takeLegacy, remember }
   * Devuelve { ok, error?, tookLegacy? }
   */
  async function register(name, password, opts = {}) {
    const bad = validName(name);
    if (bad) return { ok: false, error: bad };
    const key = norm(name);
    if (exists(key)) return { ok: false, error: 'Ese usuario ya existe en esta compu. Entrá con su contraseña.' };
    if (!password || String(password).length < 4) return { ok: false, error: 'La contraseña tiene que tener al menos 4 letras o números.' };
    let owner = false;
    if (key === OWNER) {
      if (!(await checkOwnerKey(opts.ownerKey))) return { ok: false, error: 'Este usuario es el del dueño del juego: para crearlo hace falta su llave.', needKey: true };
      owner = true;
    }
    const salt = randomSalt();
    const hash = await pbkdf2(String(password), salt, ITER);
    const db = readDb();
    db.users[key] = { name: String(name).trim(), salt, hash, iter: ITER, created: Date.now(), last: Date.now(), owner };
    if (!writeDb(db)) return { ok: false, error: 'No se pudo guardar (¿el navegador está en modo privado?).' };
    // La partida de antes, si la querés
    let tookLegacy = false;
    if (opts.takeLegacy && legacySave()) {
      try {
        localStorage.setItem(`${LEGACY_SAVE}:${key}`, localStorage.getItem(LEGACY_SAVE));
        localStorage.removeItem(LEGACY_SAVE);
        tookLegacy = true;
      } catch (e) { /* queda donde estaba */ }
    }
    begin(key, opts.remember !== false);
    return { ok: true, tookLegacy };
  }

  async function login(name, password, opts = {}) {
    const key = norm(name);
    const db = readDb();
    const u = db.users[key];
    if (!u) return { ok: false, error: 'No hay ninguna cuenta con ese usuario en esta compu.' };
    const hash = await pbkdf2(String(password || ''), u.salt, u.iter || ITER);
    if (hash !== u.hash) return { ok: false, error: 'La contraseña no es correcta.' };
    begin(key, opts.remember !== false);
    return { ok: true };
  }

  /** Cambiar la contraseña de una cuenta de esta compu con la llave del dueño (si alguien se la olvidó). */
  async function resetWithKey(name, ownerKey, newPassword) {
    const key = norm(name);
    const db = readDb();
    const u = db.users[key];
    if (!u) return { ok: false, error: 'No hay ninguna cuenta con ese usuario en esta compu.' };
    if (!(await checkOwnerKey(ownerKey))) return { ok: false, error: 'La llave del dueño no es correcta.' };
    if (!newPassword || String(newPassword).length < 4) return { ok: false, error: 'La contraseña nueva tiene que tener al menos 4 letras o números.' };
    u.salt = randomSalt();
    u.iter = ITER;
    u.hash = await pbkdf2(String(newPassword), u.salt, ITER);
    writeDb(db);
    return { ok: true };
  }

  function logout() {
    if (A.Party && A.Party.role) A.Party.leave();
    current = null;
    ss(false, null);
    ls(REMEMBER, null);
    if (A.Bus) A.Bus.emit('account:changed', { user: null });
  }

  /** Al abrir: la cuenta de esta pestaña, o la que quedó recordada. */
  function resume() {
    const db = readDb();
    const fromTab = ss(true);
    const remembered = ls(REMEMBER);
    const key = (fromTab && db.users[fromTab]) ? fromTab : (remembered && db.users[remembered]) ? remembered : null;
    current = key;
    if (key) ss(false, key);
    return key;
  }

  function info(key) {
    const u = readDb().users[key || current];
    return u ? { key: key || current, name: u.name, owner: !!u.owner } : null;
  }

  /** El Editor: solo la cuenta del dueño. */
  function canEdit() {
    const u = current ? readDb().users[current] : null;
    return !!(u && u.owner);
  }

  A.Accounts = {
    OWNER,
    current: () => current,
    info,
    list,
    exists,
    isOwnerName,
    legacySave,
    register,
    login,
    logout,
    resume,
    resetWithKey,
    checkOwnerKey,
    canEdit,
    validName,
  };
})(window.Aventurs);
