/* ============================================================
   Aventurs — Jugar en grupo (v3.0)

   De 2 a 4 jugadores (v3.2), cada uno en su compu (o en varias ventanas):
     - El ANFITRIÓN abre el grupo y les pasa el código a los demás.
     - Cada INVITADO se une con ese código y trae su personaje, su mochila
       y su mascota (todo sigue guardado en SU compu).

   Juntos o separados:
     - Juntos: viajan, exploran y pelean a la par. El anfitrión elige a dónde
       viajar; cualquiera de los dos puede explorar o descansar; en las
       peleas cada uno juega su turno.
     - Separados: cada uno juega por su lado (y ve dónde anda el otro).
       Para volver a juntarse, "Ir con ..." (te lleva hasta donde está).

   Cómo funciona por dentro:
     - El juego "de verdad" de lo compartido (combate, escenas, viaje) corre
       en la compu del anfitrión. Las acciones del invitado viajan por la red
       (rpc) y el anfitrión las juega con el héroe del invitado en contexto
       (A.State.withHero).
     - El anfitrión le manda al invitado una "foto" del estado (snap): el
       mundo, el viaje, la escena, el combate (solo lo nuevo del registro) y
       los dos héroes. El invitado la dibuja con las mismas pantallas.
     - Mientras hay algo compartido en curso, el héroe del invitado lo maneja
       el anfitrión (owned). Al terminar, se lo devuelve y el invitado lo
       guarda en su compu. El resto del tiempo (tiendas, mochila, misiones),
       el invitado juega local y le avisa al anfitrión cada cambio.
   ============================================================ */

(function (A) {
  'use strict';

  const VERSION = 4;        // si cambian los mensajes, sube y avisa "actualicen los dos" (v3.2: 4)
  const MAX_MEMBERS = 4;     // v3.2: hasta cuatro jugadores
  const SNAP_MS = 50;       // juntar cambios antes de mandar la foto
  const HERO_MS = 150;      // juntar cambios del invitado antes de mandarlos
  const STATUS_MS = 1200;   // estado mientras están separados
  const RETRY_MS = 2500;    // el anfitrión está ocupado: volver a pedir entrar

  const PASS = Symbol('pass');

  const P = {
    role: null,             // 'host' | 'guest' | null
    status: 'idle',         // idle | opening | waiting | connecting | joining | busy | connected | error
    error: '',
    code: '',
    hostHid: null,
    localHid: null,
    together: true,         // (invitado) si está junto al anfitrión
    members: {},            // hid -> ficha corta (nombre, nivel, vida, dónde está...)
    peerOf: {},             // (anfitrión) hid -> conexión
    hidOfPeer: {},          // (anfitrión) conexión -> hid
    outChron: {},           // (anfitrión) crónicas pendientes para cada invitado
    outNotes: {},           // (anfitrión) avisos y pantallas pendientes
    dirty: {},              // (anfitrión) héroes del invitado que cambiaron acá
    sent: {},               // (anfitrión) lo último mandado a cada uno
    sceneSeq: 0,            // (anfitrión) cambia cada vez que se abre/cambia la escena
    mirror: { owned: false, combatId: null, dismissed: null, sceneKey: null, sceneOpen: false },
    rpcSeq: 0,
    pending: new Map(),
    adopting: false,
    serializing: false,
    retryTimer: null,
    gifts: new Map(),       // v3.2: lo que diste y todavía no llegó (si no llega, vuelve)
  };

  const ORIG = {};

  // ============================================================
  // Utilidades
  // ============================================================

  function changed() { A.Bus.emitView('party:changed', {}); }
  function toast(text, kind) { if (A.Views && A.Views.Party && A.Views.Party.toast) A.Views.Party.toast(text, kind); }
  function say(text) { A.Bus.emitView('party:status', { text }); }

  function myHid() {
    const user = A.Accounts && A.Accounts.current ? A.Accounts.current() : null;
    if (user) return user;
    try {
      let id = localStorage.getItem('aventurs:hid');
      if (!id) { id = `jugador-${Math.floor(Math.random() * 1e6).toString(36)}`; localStorage.setItem('aventurs:hid', id); }
      return id;
    } catch (e) { return 'jugador'; }
  }

  function isActive() { return !!P.role && (P.status === 'connected' || P.status === 'waiting'); }
  function isHost() { return P.role === 'host'; }
  function isGuest() { return P.role === 'guest'; }
  function guestHids() { return Object.keys(P.members).filter((h) => h !== P.hostHid); }
  function guestsTogether() { return guestHids().filter((h) => P.members[h] && P.members[h].together && P.members[h].online !== false); }
  /** (invitado) ¿está jugando junto al anfitrión? */
  function guestTogether() { return isGuest() && P.status === 'connected' && P.together; }
  /** (invitado) ¿el anfitrión maneja su héroe ahora (pelea, escena, viaje)? */
  function guestOwned() { return guestTogether() && P.mirror.owned; }

  function hostName() {
    const m = P.members[P.hostHid];
    return m ? m.name : 'tu compañero';
  }
  function allyHid() {
    if (isHost()) return guestHids()[0] || null;
    if (isGuest()) return P.hostHid;
    return null;
  }
  /** v3.2: ¿este compañero anda con vos ahora? (si sos invitado y te separaste, nadie) */
  function withMe(m) {
    if (!m) return false;
    if (isHost()) return !!m.together;
    if (!guestTogether()) return false;
    return m.hid === P.hostHid || !!m.together;
  }
  /** v3.2: los compañeros (todos menos vos): el anfitrión primero, después en el orden en que entraron. */
  function allyHids() {
    if (!P.role) return [];
    const ids = Object.keys(P.members).filter((h) => h !== P.localHid);
    return ids.sort((a, b) => (a === P.hostHid ? -1 : b === P.hostHid ? 1 : 0));
  }

  /** Ficha corta de un héroe (para el panel y la barra lateral). */
  function memberOf(h, extra = {}) {
    if (!h) return null;
    const pet = h.pet ? { name: h.pet.name, species: h.pet.species, health: h.pet.health, maxHealth: h.pet.maxHealth, level: h.pet.level || 1 } : null;
    return Object.assign({
      hid: A.State.hidOf(h),
      name: h.name,
      raceId: h.raceId,
      level: h.level,
      hp: h.hp, maxHp: h.maxHp,
      mana: h.mana, maxMana: h.maxMana, hasMagic: !!h.hasMagic,
      food: h.food, maxFood: h.maxFood,
      weapon: h.equipment ? h.equipment.weapon : null,
      pet,
      regionId: A.State.world ? A.State.world.regionId : null,
      // v3.1: para verlo en el mapa en medio de un viaje
      traveling: A.State.traveling ? { fromId: A.State.traveling.fromId, toId: A.State.traveling.toId, step: A.State.traveling.currentStep || 0, total: A.State.traveling.totalSteps || 1 } : null,
      online: true,
    }, extra);
  }

  function membersList() { return Object.values(P.members).map((m) => ({ ...m })); }

  function setRegistry(localHid, hero) {
    hero._hid = localHid;
    A.State.party = { localHid, heroes: { [localHid]: hero }, order: [localHid] };
  }
  function addToRegistry(hid, hero) {
    if (!A.State.party) return;
    hero._hid = hid;
    A.State.party.heroes[hid] = hero;
    if (!A.State.party.order.includes(hid)) A.State.party.order.push(hid);
  }
  function removeFromRegistry(hid) {
    if (!A.State.party) return;
    delete A.State.party.heroes[hid];
    A.State.party.order = A.State.party.order.filter((h) => h !== hid);
  }

  /** Los héroes que pelean juntos (en la compu del anfitrión). null si no hay grupo. */
  function combatHeroes() {
    if (!isHost() || !A.State.party) return null;
    const me = A.State.me();
    if (!me) return null;
    const list = [me];
    for (const hid of guestsTogether()) {
      const h = A.State.heroById(hid);
      if (h && h !== me) list.push(h);
    }
    return list.length > 1 ? list : null;
  }

  /** (anfitrión) ¿hay algo compartido en curso? (pelea, viaje, escena) */
  function hostBusy() {
    return !!(A.State.combat || (A.State.traveling && !A.State.traveling.completed) || (A.State.ui && A.State.ui.openModal === 'event'));
  }

  // ============================================================
  // Anfitrión
  // ============================================================

  async function create() {
    if (!A.State.player) return { ok: false, error: 'Primero creá tu personaje.' };
    if (P.role) leave(true);
    if (!A.Link || !A.Link.available()) return { ok: false, error: A.Link ? A.Link.errorText({ type: 'browser-incompatible' }) : 'No se pudo cargar la conexión.' };
    P.role = 'host';
    P.status = 'opening';
    P.error = '';
    P.localHid = myHid();
    P.hostHid = P.localHid;
    changed();
    let code;
    try {
      code = await A.Link.host(lastCode('host'));
    } catch (err) {
      if (err && err.type === 'unavailable-id') {
        try { code = await A.Link.host(A.Link.newCode()); } catch (e2) { return fail(e2); }
      } else {
        return fail(err);
      }
    }
    if (P.role !== 'host') return { ok: false };
    P.code = code;
    saveCode('host', code);
    P.status = 'waiting';
    const me = A.State.me();
    setRegistry(P.localHid, me);
    P.members = { [P.localHid]: memberOf(me, { together: true, host: true }) };
    changed();
    return { ok: true, code };
  }

  function fail(err) {
    P.status = 'error';
    P.error = A.Link ? A.Link.errorText(err) : 'No se pudo conectar.';
    const role = P.role;
    if (A.Link) A.Link.close();
    P.role = null;
    A.State.party = null;
    changed();
    return { ok: false, error: P.error, role };
  }

  function hostOnMessage(msg, peerId) {
    const hid = P.hidOfPeer[peerId] || null;
    switch (msg.t) {
      case 'hello': return hostHello(msg, peerId);
      case 'hero': {
        if (!hid || !msg.hero) return;
        // mientras hay algo compartido en curso, manda la copia de acá
        if (hostBusy() && P.members[hid] && P.members[hid].together) return;
        addToRegistry(hid, msg.hero);
        P.members[hid] = memberOf(msg.hero, { together: P.members[hid] ? P.members[hid].together : true, regionId: P.members[hid] && !P.members[hid].together ? P.members[hid].regionId : (A.State.world && A.State.world.regionId) });
        changed();
        scheduleSnap();
        return;
      }
      case 'status': {
        if (!hid || !msg.member) return;
        P.members[hid] = Object.assign({}, P.members[hid] || {}, msg.member, { hid, together: P.members[hid] ? P.members[hid].together : false });
        changed();
        scheduleSnap(); // v3.2: los otros invitados también lo ven en el mapa
        return;
      }
      case 'together': return hostTogether(hid, msg, peerId);
      case 'rpc': {
        if (!hid) return;
        const res = runRpc(hid, msg.fn, msg.args || []);
        A.Link.send({ t: 'rpcres', id: msg.id, ...res }, peerId);
        scheduleSnap();
        return;
      }
      case 'resync': {
        if (hid && P.sent[hid]) { P.sent[hid].combatId = null; P.sent[hid].logLen = 0; }
        scheduleSnap();
        return;
      }
      case 'bye': if (hid) removeMember(hid, 'left'); return;
      // v3.2: pasarse cosas (el anfitrión hace de cartero)
      case 'gift': {
        if (!hid || !msg.to) return;
        const fwd = Object.assign({}, msg, { from: hid, fromName: (A.State.heroById(hid) || P.members[hid] || {}).name || 'Tu compañero' });
        if (msg.to === P.localHid) { receiveGift(fwd); return; }
        if (!P.peerOf[msg.to]) { A.Link.send({ t: 'giftres', id: msg.id, to: hid, ok: false, why: 'gone' }, peerId); return; }
        A.Link.send(fwd, P.peerOf[msg.to]);
        return;
      }
      case 'giftres': {
        if (!msg.to) return;
        if (msg.to === P.localHid) { onGiftRes(msg); return; }
        if (P.peerOf[msg.to]) A.Link.send(msg, P.peerOf[msg.to]);
        return;
      }
      default:
    }
  }

  function hostHello(msg, peerId) {
    if (msg.v !== VERSION) {
      A.Link.send({ t: 'reject', why: 'version' }, peerId);
      setTimeout(() => A.Link.drop(peerId), 500);
      return;
    }
    const known = P.hidOfPeer[peerId];
    if (!known && Object.keys(P.members).length >= MAX_MEMBERS) {
      A.Link.send({ t: 'reject', why: 'full' }, peerId);
      setTimeout(() => A.Link.drop(peerId), 500);
      return;
    }
    if (!msg.hero || !msg.hero.name) return;
    // Si la pelea o el viaje ya empezaron, que espere a que terminen
    if (hostBusy()) { A.Link.send({ t: 'busy', name: A.State.me().name }, peerId); return; }
    let hid = known || String(msg.hid || 'invitado');
    if (!known) { const base = hid; let n = 2; while (P.members[hid]) hid = `${base}#${n++}`; }
    const hero = msg.hero;
    addToRegistry(hid, hero);
    P.peerOf[hid] = peerId;
    P.hidOfPeer[peerId] = hid;
    P.members[hid] = memberOf(hero, { together: true, regionId: A.State.world ? A.State.world.regionId : null });
    P.sent[hid] = {};
    P.outChron[hid] = [];
    P.outNotes[hid] = [];
    P.status = 'connected';
    A.Link.send({ t: 'welcome', hid, hostHid: P.hostHid, code: P.code, members: membersList() }, peerId);
    A.State.addChronicle({ type: 'system', text: `${hero.name} se unió a tu grupo.` });
    toast(`${hero.name} se unió a tu grupo.`, 'good');
    changed();
    sendSnap(hid);
    scheduleSnap(); // v3.2: los que ya estaban también se enteran
  }

  function hostTogether(hid, msg, peerId) {
    if (!hid || !P.members[hid]) return;
    const m = P.members[hid];
    if (msg.on) {
      if (hostBusy()) { A.Link.send({ t: 'busy', name: A.State.me().name, regroup: true }, peerId); return; }
      if (msg.hero) addToRegistry(hid, msg.hero);
      m.together = true;
      m.regionId = A.State.world ? A.State.world.regionId : null;
      toast(`${m.name} se juntó con vos.`, 'good');
    } else {
      if (hostBusy()) { A.Link.send({ t: 'busy', name: A.State.me().name, separate: true }, peerId); return; }
      m.together = false;
      toast(`${m.name} sigue por su cuenta.`);
    }
    changed();
    sendSnap(hid);
    scheduleSnap(); // v3.2: los demás también lo ven
  }

  function removeMember(hid, why) {
    const m = P.members[hid];
    if (!m || hid === P.hostHid) return;
    if (A.State.combat && A.State.combat.party && A.Combat && A.Combat.dropHero) A.Combat.dropHero(hid);
    const peerId = P.peerOf[hid];
    delete P.members[hid];
    delete P.peerOf[hid];
    if (peerId) delete P.hidOfPeer[peerId];
    // Si estaba en la pelea, su héroe queda hasta que termine (para las tarjetas); si no, se va
    if (!(A.State.combat && A.State.combat.party && (A.State.combat.heroIds || []).includes(hid))) removeFromRegistry(hid);
    if (!guestHids().length) P.status = 'waiting';
    A.State.addChronicle({ type: 'system', text: why === 'left' ? `${m.name} dejó el grupo.` : `Se cortó la conexión con ${m.name}.` });
    toast(why === 'left' ? `${m.name} dejó el grupo.` : `Se cortó la conexión con ${m.name}.`, 'bad');
    if (peerId && why === 'left') setTimeout(() => A.Link.drop(peerId), 300);
    changed();
    scheduleSnap(); // v3.2: los demás se enteran de que se fue
  }

  // ---------- Fotos del estado ----------

  let snapTimer = null;
  function scheduleSnap() {
    if (!isHost() || !guestHids().length) return;
    if (snapTimer) return;
    snapTimer = setTimeout(() => {
      snapTimer = null;
      for (const hid of guestHids()) sendSnap(hid);
    }, SNAP_MS);
  }

  function pickWorld(w) {
    if (!w) return null;
    return { regionId: w.regionId, day: w.day, phase: w.phase, timeOfDay: w.timeOfDay, timeProgress: w.timeProgress, restLock: !!w.restLock };
  }

  function stripEntry(e) {
    const out = {};
    for (const k of Object.keys(e)) if (k !== '_at') out[k] = e[k];
    return out;
  }

  function combatFor(hid, sent) {
    const c = A.State.combat;
    const guest = A.State.heroById(hid);
    if (!c || !c.party || !(c.heroIds || []).includes(hid) || !guest) {
      sent.combatId = null;
      sent.logLen = 0;
      return null;
    }
    // En el contexto del invitado: su objetivo, su Golpe fuerte, sus pasivas
    P.serializing = true;
    try {
      return A.State.withHero(guest, () => {
      const copy = {};
      for (const k of Object.keys(c)) if (k !== 'log' && k !== 'heroCtx') copy[k] = c[k];
      const from = sent.combatId === c.id ? Math.min(sent.logLen || 0, c.log.length) : 0;
      copy.logFrom = from;
      copy.logAdd = c.log.slice(from).map(stripEntry);
      sent.combatId = c.id;
      sent.logLen = c.log.length;
      return JSON.parse(JSON.stringify(copy));
      });
    } finally {
      P.serializing = false;
    }
  }

  function sendSnap(hid) {
    const m = P.members[hid];
    const peerId = P.peerOf[hid];
    if (!m || !peerId) return;
    const snap = { t: 'snap', v: VERSION, hostHid: P.hostHid, together: !!m.together };
    // la ficha del anfitrión al día
    P.members[P.hostHid] = memberOf(A.State.me(), { together: true, host: true });
    snap.members = membersList();
    if (m.together) {
      const busy = hostBusy();
      const sent = P.sent[hid] || (P.sent[hid] = {});
      snap.owned = busy;
      snap.world = pickWorld(A.State.world);
      snap.traveling = A.State.traveling || null;
      snap.heroes = { [P.hostHid]: A.State.me() };
      // v3.2: los otros compañeros que van juntos (para sus tarjetas y la barra del costado)
      const c = A.State.combat;
      const others = new Set(guestsTogether().concat(c && c.party ? (c.heroIds || []) : []));
      for (const oh of others) {
        if (oh === hid || oh === P.hostHid) continue;
        const h = A.State.heroById(oh);
        if (h) snap.heroes[oh] = h;
      }
      const guest = A.State.heroById(hid);
      // el héroe del invitado va cuando lo maneja el anfitrión, cuando cambió acá o al devolvérselo
      if (guest && (busy || P.dirty[hid] || sent.owned)) {
        snap.heroes[hid] = guest;
        P.dirty[hid] = false;
      }
      sent.owned = busy;
      const open = A.State.ui && A.State.ui.openModal === 'event';
      snap.scene = open ? A.State.ui.modalPayload : null;
      snap.sceneSeq = open ? P.sceneSeq : 0;
      snap.combat = combatFor(hid, sent);
    }
    if (P.outChron[hid] && P.outChron[hid].length) { snap.chron = P.outChron[hid]; P.outChron[hid] = []; }
    if (P.outNotes[hid] && P.outNotes[hid].length) { snap.notes = P.outNotes[hid]; P.outNotes[hid] = []; }
    A.Link.send(snap, peerId);
  }

  // ---------- Acciones del invitado ----------

  /** Las acciones que el invitado puede pedir (se juegan con su héroe en contexto). */
  const RPC = {
    'Combat.playerAttack': (o) => { if (o && o.target) ORIG['Combat.setTarget'](o.target); return ORIG['Combat.playerAttack'](); },
    'Combat.playerPowerAttack': (o) => { if (o && o.target) ORIG['Combat.setTarget'](o.target); return ORIG['Combat.playerPowerAttack'](); },
    'Combat.playerSpell': (o, spellId, on) => { if (o && o.target) ORIG['Combat.setTarget'](o.target); return ORIG['Combat.playerSpell'](spellId, on); },
    'Combat.playerUseItem': (o, itemId, on) => { if (o && o.target) ORIG['Combat.setTarget'](o.target); return ORIG['Combat.playerUseItem'](itemId, on); },
    'Combat.playerTame': (o, instanceId) => ORIG['Combat.playerTame'](instanceId),
    'Combat.playerFlee': () => ORIG['Combat.playerFlee'](),
    'Combat.setTarget': (o, id) => ORIG['Combat.setTarget'](id),
    'Explore.explore': () => ORIG['Explore.explore'](),
    'Explore.choose': (o, idx, opts) => ORIG['Explore.choose'](idx, opts || {}),
    'Explore.proceed': () => ORIG['Explore.proceed'](),
    'Explore.rest': () => ORIG['Explore.rest'](),
    'Inventory.equip': (o, ...a) => ORIG['Inventory.equip'](...a),
    'Inventory.unequip': (o, ...a) => ORIG['Inventory.unequip'](...a),
    'Inventory.use': (o, ...a) => ORIG['Inventory.use'](...a),
    'Inventory.drop': (o, ...a) => ORIG['Inventory.drop'](...a),
    'Tame.feed': (o, ...a) => ORIG['Tame.feed'](...a),
    'Tame.healWithPotion': (o, ...a) => ORIG['Tame.healWithPotion'](...a),
  };

  function plain(v) {
    if (v === undefined) return null;
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; }
  }

  function runRpc(hid, fn, args) {
    const hero = A.State.heroById(hid);
    const m = P.members[hid];
    if (!hero || !m || !m.together) return { ok: false, error: 'Ahora no están juntos.' };
    const f = RPC[fn];
    if (!f) return { ok: false, error: 'Eso no se puede hacer en grupo.' };
    let result = null;
    try {
      A.State.withHero(hero, () => { result = f(...args); });
    } catch (e) {
      console.error('[Party] rpc', fn, e);
      return { ok: false, error: 'Algo salió mal.' };
    }
    return { ok: true, result: plain(result) };
  }

  // ---------- Lo que se le avisa al compañero ----------

  function pushChronicle(hid, entry) {
    if (!isHost()) return;
    (P.outChron[hid] || (P.outChron[hid] = [])).push(entry);
    scheduleSnap();
  }

  /** Un aviso para un héroe (descansó, encontró algo...): si es el propio se muestra acá. */
  function notify(hid, note) {
    if (!note) return;
    if (!isHost() || hid === P.localHid) { showNote(note); return; }
    (P.outNotes[hid] || (P.outNotes[hid] = [])).push({ note });
    scheduleSnap();
  }

  /** Abre una pantalla en la compu del compañero (ej.: domar la criatura que eligió). */
  function openRemoteModal(hid, id, payload) {
    if (!isHost()) return;
    (P.outNotes[hid] || (P.outNotes[hid] = [])).push({ modal: id, payload });
    scheduleSnap();
  }

  function showNote(note) {
    if (A.Views && A.Views.World && A.Views.World.showNote) A.Views.World.showNote(note);
    else if (note.text) toast(note.text);
  }

  // ============================================================
  // Invitado
  // ============================================================

  async function join(code) {
    if (!A.State.player) return { ok: false, error: 'Primero creá tu personaje.' };
    const clean = A.Link ? A.Link.cleanCode(code) : '';
    if (!clean || clean.length < 6) return { ok: false, error: 'El código tiene 6 letras y números (por ejemplo K7Q-2XP).' };
    if (A.State.combat || A.State.traveling) return { ok: false, error: 'Terminá la pelea o el viaje antes de unirte.' };
    if (P.role) leave(true);
    if (!A.Link || !A.Link.available()) return { ok: false, error: A.Link ? A.Link.errorText({ type: 'browser-incompatible' }) : 'No se pudo cargar la conexión.' };
    P.role = 'guest';
    P.status = 'connecting';
    P.error = '';
    P.code = clean;
    P.localHid = myHid();
    P.together = true;
    changed();
    try {
      await A.Link.join(clean);
    } catch (err) {
      return fail(err);
    }
    if (P.role !== 'guest') return { ok: false };
    saveCode('guest', clean);
    P.status = 'joining';
    changed();
    sendHello();
    return { ok: true };
  }

  function sendHello() {
    clearTimeout(P.retryTimer);
    if (!isGuest()) return;
    A.Link.send({ t: 'hello', v: VERSION, hid: P.localHid, hero: A.State.me(), world: pickWorld(A.State.world) });
  }

  function guestOnMessage(msg) {
    switch (msg.t) {
      case 'welcome': {
        P.localHid = msg.hid;
        P.hostHid = msg.hostHid;
        P.code = msg.code || P.code;
        P.status = 'connected';
        P.together = true;
        P.members = {};
        for (const m of msg.members || []) P.members[m.hid] = m;
        setRegistry(P.localHid, A.State.me());
        A.State.addChronicle({ type: 'system', text: `Te uniste al grupo de ${hostName()}.` });
        toast(`Te uniste al grupo de ${hostName()}.`, 'good');
        changed();
        return;
      }
      case 'busy': {
        P.status = msg.regroup || msg.separate ? 'connected' : 'busy';
        const who = msg.name || hostName();
        if (msg.separate) toast(`${who} está en medio de algo. Separate cuando termine.`);
        else if (msg.regroup) toast(`${who} está en medio de algo. Probá en un rato.`);
        else say(`${who} está peleando o viajando. Entrás apenas termine…`);
        changed();
        if (!msg.regroup && !msg.separate) P.retryTimer = setTimeout(sendHello, RETRY_MS);
        return;
      }
      case 'reject': {
        const why = msg.why === 'full' ? `El grupo ya está completo (son ${MAX_MEMBERS} jugadores como mucho).`
          : msg.why === 'version' ? 'El que creó el grupo tiene otra versión del juego. Actualicen todos con Ctrl+F5.'
            : 'No te dejaron entrar.';
        P.error = why;
        leave(true);
        P.status = 'error';
        P.error = why;
        changed();
        return;
      }
      case 'snap': return applySnap(msg);
      case 'gift': return receiveGift(msg);
      case 'giftres': return onGiftRes(msg);
      case 'rpcres': {
        const cb = P.pending.get(msg.id);
        if (cb) { P.pending.delete(msg.id); cb(msg); }
        if (!msg.ok && msg.error) toast(msg.error, 'bad');
        return;
      }
      case 'bye': {
        const name = hostName();
        leave(true);
        A.State.addChronicle({ type: 'system', text: `${name} cerró el grupo. Seguís por tu cuenta.` });
        toast(`${name} cerró el grupo. Seguís por tu cuenta.`);
        changed();
        return;
      }
      default:
    }
  }

  function rpc(fn, args, onResult) {
    const id = `${Date.now().toString(36)}${(++P.rpcSeq).toString(36)}`;
    if (onResult) P.pending.set(id, onResult);
    const ok = A.Link.send({ t: 'rpc', id, fn, args: plain(args) || [] });
    if (!ok) toast('No hay conexión con tu compañero.', 'bad');
  }

  // ---------- Aplicar la foto del anfitrión ----------

  function applySnap(snap) {
    P.members = {};
    for (const m of snap.members || []) P.members[m.hid] = m;
    P.hostHid = snap.hostHid || P.hostHid;
    if (P.status !== 'connected') P.status = 'connected';
    const wasTogether = P.together;
    P.together = !!snap.together;

    if (snap.chron) for (const e of snap.chron) addMyChronicle(e);

    if (!snap.together) {
      if (wasTogether) exitMirror();
      changed();
      if (snap.notes) for (const n of snap.notes) handleNote(n);
      return;
    }
    if (!A.State.party) setRegistry(P.localHid, A.State.me());

    // Los compañeros (para sus tarjetas). v3.2: pueden ser hasta tres
    const heroes = snap.heroes || {};
    for (const hid of Object.keys(heroes)) {
      if (hid === P.localHid) continue;
      const h = heroes[hid];
      h._hid = hid;
      A.State.party.heroes[hid] = h;
      if (!A.State.party.order.includes(hid)) {
        if (hid === P.hostHid) A.State.party.order.unshift(hid); else A.State.party.order.push(hid);
      }
    }
    // los que ya no van juntos se borran (salvo que sigan en la pelea, por sus tarjetas)
    const fighting = snap.combat && Array.isArray(snap.combat.heroIds) ? snap.combat.heroIds : (A.State.combat && A.State.combat.party ? A.State.combat.heroIds || [] : []);
    for (const hid of Object.keys(A.State.party.heroes)) {
      if (hid === P.localHid || heroes[hid] || fighting.includes(hid)) continue;
      delete A.State.party.heroes[hid];
      A.State.party.order = A.State.party.order.filter((x) => x !== hid);
    }

    const wasOwned = P.mirror.owned;
    P.mirror.owned = !!snap.owned;
    const mine = snap.heroes && snap.heroes[P.localHid];
    if (mine) adoptHero(mine);
    if (!wasOwned && P.mirror.owned) closeLocalModals();

    applyWorld(snap.world, !wasTogether);
    applyTravel(snap.traveling);
    applyCombat(snap.combat);
    applyScene(snap.scene, snap.sceneSeq);
    if (snap.notes) for (const n of snap.notes) handleNote(n);
    // guardar en esta compu cómo quedó todo (sin mandárselo de vuelta)
    P.adopting = true;
    try { A.State.persist(); } finally { P.adopting = false; }
    A.Bus.emitView('player:hp-changed', {});
    changed();
  }

  /** Toma la copia de su héroe que manda el anfitrión (y la guarda en esta compu). */
  function adoptHero(hero) {
    hero._hid = P.localHid;
    P.adopting = true;
    try {
      A.State.player = hero;
      if (A.State.party) A.State.party.heroes[P.localHid] = hero;
      A.State.persist();
    } finally {
      P.adopting = false;
    }
  }

  function addMyChronicle(e) {
    if (!e || !e.text) return;
    const list = A.State.chronicles || (A.State.chronicles = []);
    const last = list[0];
    if (last && last.text === e.text && last.day === e.day) { last.count = (last.count || 1) + 1; last.ts = e.ts || Date.now(); }
    else list.unshift({ ts: e.ts || Date.now(), type: e.type || 'note', text: e.text, regionId: e.regionId || null, day: e.day || null });
    if (list.length > 500) list.length = 500;
    A.Bus.emitView('chronicle:added', { entry: list[0] });
  }

  function applyWorld(w, teleport) {
    if (!w || !A.State.world) return;
    const world = A.State.world;
    const from = world.regionId;
    const phase = world.phase;
    const day = world.day;
    Object.assign(world, w);
    if (!Array.isArray(world.visited)) world.visited = [];
    if (w.regionId && !world.visited.includes(w.regionId)) world.visited.push(w.regionId);
    if (from !== w.regionId) {
      const region = A.Data.getById('regions', w.regionId);
      if (teleport) {
        P.adopting = true;
        try { A.State.addChronicle({ type: 'travel', text: `Te juntaste con ${hostName()} en ${region ? region.name : w.regionId}.` }); } finally { P.adopting = false; }
      }
      A.Bus.emitView('region:changed', { fromId: from, toId: w.regionId });
    }
    if (phase !== world.phase || day !== world.day) A.Bus.emitView('time:phase-changed', {});
    else A.Bus.emitView('time:advanced', {});
  }

  function applyTravel(t) {
    const had = !!A.State.traveling;
    A.State.traveling = t || null;
    if (!had && t) A.Bus.emitView('travel:started', {});
    else if (had && !t) A.Bus.emitView('travel:completed', {});
    else if (t) A.Bus.emitView('travel:step', {});
  }

  const MIRROR_FIELDS_OPTIONAL = ['passives', 'itemUsed', 'itemSurvivor', 'powerCd', 'targetInstanceId', 'result', 'goneHids', 'fleeAttempts'];

  function applyCombat(cs) {
    const cur = A.State.combat;
    if (!cs) {
      if (cur && P.mirror.combatId) {
        if (cur.result) return; // el resultado queda hasta que toque Continuar
        A.State.combat = null;
        P.mirror.combatId = null;
        A.Bus.emitView('combat:ended', {});
      }
      return;
    }
    if (P.mirror.dismissed === cs.id) return; // ya lo cerró
    if (!cur || cur.id !== cs.id) {
      if (cs.logFrom !== 0) { A.Link.send({ t: 'resync' }); return; }
      const c = {};
      for (const k of Object.keys(cs)) if (k !== 'logFrom' && k !== 'logAdd') c[k] = cs[k];
      c.log = [];
      A.State.combat = c;
      P.mirror.combatId = cs.id;
      A.Bus.emitView('combat:started', {});
      appendLog(c, cs.logAdd || []);
      if (c.result) A.Bus.emitView('combat:ended', { result: c.result });
      return;
    }
    if (cs.logFrom > cur.log.length) { A.Link.send({ t: 'resync' }); return; }
    const hadResult = cur.result;
    for (const k of MIRROR_FIELDS_OPTIONAL) if (!(k in cs)) delete cur[k];
    for (const k of Object.keys(cs)) if (k !== 'logFrom' && k !== 'logAdd' && k !== 'log') cur[k] = cs[k];
    const fresh = (cs.logAdd || []).slice(cur.log.length - cs.logFrom);
    appendLog(cur, fresh);
    if (!hadResult && cur.result) A.Bus.emitView('combat:ended', { result: cur.result });
    else if (!fresh.length) A.Bus.emitView('combat:turn', {});
  }

  function appendLog(c, entries) {
    for (const e of entries) {
      c.log.push(e);
      A.Bus.emitView('combat:action', e);
    }
  }

  function applyScene(sc, seq) {
    const ui = A.State.ui;
    const open = ui.openModal === 'event' && P.mirror.sceneOpen;
    if (sc) {
      const key = `${seq}`;
      if (!open || key !== P.mirror.sceneKey) {
        P.mirror.sceneKey = key;
        P.mirror.sceneOpen = true;
        A.State.openModal('event', sc);
      } else {
        ui.modalPayload = sc;
      }
    } else if (open) {
      P.mirror.sceneOpen = false;
      P.mirror.sceneKey = null;
      A.State.closeModal();
    } else {
      P.mirror.sceneOpen = false;
    }
  }

  /** Si el anfitrión empezó algo compartido, las pantallas propias (tienda, mochila) se cierran. */
  function closeLocalModals() {
    const id = A.State.ui && A.State.ui.openModal;
    if (!id || id === 'event' || id === 'party' || id === 'journal' || id === 'rules' || String(id).startsWith('combat-')) return;
    A.State.closeModal();
    toast(`${hostName()} empezó algo: van juntos.`);
  }

  function handleNote(n) {
    if (!n) return;
    if (n.note) showNote(n.note);
    if (n.modal) A.State.openModal(n.modal, n.payload || {});
  }

  /** Sale del modo "espejo": lo compartido se borra y queda el héroe propio como estaba. */
  function exitMirror() {
    if (A.State.combat && P.mirror.combatId) A.State.combat = null;
    if (A.State.ui && A.State.ui.openModal === 'event' && P.mirror.sceneOpen) A.State.closeModal();
    if (A.State.traveling) {
      // si el anfitrión iba viajando, el invitado queda en el lugar de salida
      A.State.world.regionId = A.State.traveling.fromId || A.State.world.regionId;
      A.State.traveling = null;
    }
    P.mirror = { owned: false, combatId: null, dismissed: null, sceneKey: null, sceneOpen: false };
    if (A.State.party && A.State.party.heroes) {
      for (const hid of Object.keys(A.State.party.heroes)) if (hid !== P.localHid) delete A.State.party.heroes[hid];
    }
    A.State.persist();
    if (A.Views && A.Views.Shell && A.Views.Shell.rerender) A.Views.Shell.rerender();
  }

  // ---------- Juntos / separados ----------

  function separate() {
    if (!guestTogether()) return { ok: false };
    if (P.mirror.owned || A.State.combat) return { ok: false, error: `Esperá a que termine lo que están haciendo con ${hostName()}.` };
    A.Link.send({ t: 'together', on: false });
    return { ok: true };
  }

  function regroup() {
    if (!isGuest() || P.status !== 'connected' || P.together) return { ok: false };
    if (A.State.combat || A.State.traveling) return { ok: false, error: 'Terminá la pelea o el viaje primero.' };
    A.Link.send({ t: 'together', on: true, hero: A.State.me() });
    return { ok: true };
  }

  // ============================================================
  // v3.2: pasarse cosas entre jugadores
  //   El que da la saca de su mochila y la manda (por el anfitrión).
  //   El que recibe la guarda y avisa. Si no le entra, está ocupado o no
  //   contesta, vuelve a la mochila del que la dio (nada se pierde).
  // ============================================================

  const GIFT_MS = 15000;

  /** ¿Se puede dar algo ahora? { ok, why } */
  function canGive() {
    if (!P.role || P.status !== 'connected') return { ok: false, why: 'Para pasar cosas tienen que estar en un grupo.' };
    if (A.State.combat && !A.State.combat.result) return { ok: false, why: 'En plena pelea no se pueden pasar cosas.' };
    if (isHost() && hostBusy()) return { ok: false, why: 'Esperá a que termine el viaje o la escena.' };
    if (isGuest() && (P.mirror.owned || (A.State.traveling && !A.State.traveling.completed))) return { ok: false, why: 'Esperá a que termine el viaje o la escena.' };
    if (!allyHids().length) return { ok: false, why: 'No hay nadie más en el grupo.' };
    return { ok: true };
  }

  function itemLabel(itemId, qty) {
    const d = A.Inventory && A.Inventory.resolveData ? A.Inventory.resolveData(itemId) : A.Data.getById('items', itemId);
    if (itemId === '$coins') return A.Currency.formatPrice(qty);
    return `${d ? d.name : 'algo'}${qty > 1 ? ` ×${qty}` : ''}`;
  }

  /** Dar a un compañero. itemId '$coins' = monedas (qty en cobre). */
  function give(toHid, itemId, qty) {
    const can = canGive();
    if (!can.ok) return can;
    const m = P.members[toHid];
    if (!m || toHid === P.localHid || (isHost() && !P.peerOf[toHid])) return { ok: false, why: 'Ese compañero ya no está en el grupo.' };
    const me = A.State.me();
    let n = Math.max(1, Math.floor(Number(qty) || 1));
    if (itemId === '$coins') {
      if (!A.Currency.canPay(n)) return { ok: false, why: 'No tenés tanto.' };
      A.State.withHero(me, () => A.Currency.pay(n));
    } else {
      const d = A.Inventory && A.Inventory.resolveData ? A.Inventory.resolveData(itemId) : null;
      const slot = (me.inventory || []).find((s) => s.itemId === itemId);
      if (!d || !slot) return { ok: false, why: 'No lo tenés en la mochila.' };
      if (d.subtype === 'coin') return { ok: false, why: 'Las monedas se pasan desde el panel del grupo.' };
      n = Math.min(n, slot.qty);
      A.State.withHero(me, () => A.State.removeItem(itemId, n));
    }
    const id = `g${Date.now().toString(36)}${(++P.rpcSeq).toString(36)}`;
    const g = { to: toHid, name: m.name, itemId, qty: n };
    g.timer = setTimeout(() => giftBack(id, 'timeout'), GIFT_MS);
    P.gifts.set(id, g);
    const msg = { t: 'gift', id, from: P.localHid, fromName: me.name, to: toHid, itemId, qty: n };
    if (isHost()) A.Link.send(msg, P.peerOf[toHid]);
    else A.Link.send(msg);
    A.State.persist();
    toast(`Le estás pasando ${itemLabel(itemId, n)} a ${m.name}…`);
    return { ok: true, pending: true };
  }

  /** Llega algo de un compañero. */
  function receiveGift(msg) {
    const me = A.State.me();
    let ok = false;
    let why = '';
    const coins = msg.itemId === '$coins';
    const d = coins ? null : (A.Inventory && A.Inventory.resolveData ? A.Inventory.resolveData(msg.itemId) : null);
    if (!me || (!coins && !d)) why = 'unknown';
    else if (isGuest() && P.mirror.owned) why = 'busy';
    else if (coins) { A.State.withHero(me, () => A.Currency.add(msg.qty)); ok = true; }
    else {
      const slot = (me.inventory || []).find((s) => s.itemId === msg.itemId);
      const stack = d.stack || 1;
      if (slot && stack > 1 && slot.qty + msg.qty > stack) why = 'full';
      else ok = !!A.State.withHero(me, () => A.State.addItem(msg.itemId, msg.qty));
      if (!ok && !why) why = 'full';
    }
    const from = msg.fromName || 'Tu compañero';
    if (ok) {
      const text = `${from} te dio ${itemLabel(msg.itemId, msg.qty)}.`;
      A.State.withHero(me, () => A.State.addChronicle({ type: 'loot', text }));
      toast(text, 'good', coins ? 'coins' : 'bag');
      A.Bus.emit('inventory:changed');
      A.State.persist();
    }
    const res = { t: 'giftres', id: msg.id, to: msg.from, ok, why };
    if (isHost()) { if (P.peerOf[msg.from]) A.Link.send(res, P.peerOf[msg.from]); }
    else A.Link.send(res);
  }

  /** La respuesta del que recibía. */
  function onGiftRes(msg) {
    const g = P.gifts.get(msg.id);
    if (!g) return;
    if (!msg.ok) { giftBack(msg.id, msg.why || 'fail'); return; }
    clearTimeout(g.timer);
    P.gifts.delete(msg.id);
    const text = `Le diste ${itemLabel(g.itemId, g.qty)} a ${g.name}.`;
    A.State.withHero(A.State.me(), () => A.State.addChronicle({ type: 'loot', text }));
    toast(text, 'good', g.itemId === '$coins' ? 'coins' : 'bag');
  }

  /** No llegó: vuelve a tu mochila (aunque esté llena: no se pierde). */
  function giftBack(id, why) {
    const g = P.gifts.get(id);
    if (!g) return;
    clearTimeout(g.timer);
    P.gifts.delete(id);
    const me = A.State.me();
    if (!me) return;
    A.State.withHero(me, () => {
      if (g.itemId === '$coins') { A.Currency.add(g.qty); return; }
      if (!A.State.addItem(g.itemId, g.qty)) {
        me.inventory.push({ itemId: g.itemId, qty: g.qty });
        A.Bus.emit('inventory:changed');
        A.State.persist();
      }
    });
    const reason = why === 'full' ? `a ${g.name} no le entra en la mochila`
      : why === 'busy' ? `${g.name} está en medio de algo`
        : why === 'gone' ? `${g.name} ya no está en el grupo` : `no le llegó a ${g.name}`;
    toast(`No se pudo: ${reason}. Te devolvimos ${itemLabel(g.itemId, g.qty)}.`, 'bad');
  }

  // ============================================================
  // Salir
  // ============================================================

  function leave(silent) {
    clearTimeout(P.retryTimer);
    // v3.2: lo que estaba en camino vuelve
    for (const id of [...P.gifts.keys()]) giftBack(id, 'gone');
    clearTimeout(snapTimer);
    snapTimer = null;
    const role = P.role;
    if (role && A.Link) {
      try { A.Link.send({ t: 'bye' }); } catch (e) { /* nada */ }
      setTimeout(() => A.Link.close(), 150);
    }
    if (role === 'guest') exitMirror();
    if (role === 'host' && A.State.combat && A.State.combat.party && A.Combat && A.Combat.dropHero) {
      for (const hid of guestHids()) A.Combat.dropHero(hid);
    }
    P.role = null;
    P.status = 'idle';
    P.members = {};
    P.peerOf = {};
    P.hidOfPeer = {};
    P.outChron = {};
    P.outNotes = {};
    P.dirty = {};
    P.sent = {};
    P.pending.clear();
    P.together = true;
    P.mirror = { owned: false, combatId: null, dismissed: null, sceneKey: null, sceneOpen: false };
    if (!(A.State.combat && A.State.combat.party)) A.State.party = null;
    if (!silent) changed();
  }

  function onLinkClose(peerId) {
    if (isHost()) {
      const hid = P.hidOfPeer[peerId];
      if (hid) removeMember(hid, 'lost');
      return;
    }
    if (isGuest()) {
      const name = hostName();
      const was = P.status;
      leave(true);
      if (was === 'connected' || was === 'joining' || was === 'busy') {
        A.State.addChronicle({ type: 'system', text: `Se cortó la conexión con ${name}. Seguís por tu cuenta.` });
        toast(`Se cortó la conexión con ${name}. Seguís por tu cuenta.`, 'bad');
      }
      changed();
    }
  }

  // ---------- Último código (para volver a conectarse rápido) ----------

  function saveCode(role, code) { try { sessionStorage.setItem(`aventurs:party:${role}`, code); } catch (e) { /* nada */ } }
  function lastCode(role) { try { return sessionStorage.getItem(`aventurs:party:${role}`) || ''; } catch (e) { return ''; } }

  // ============================================================
  // El invitado: lo compartido se pide al anfitrión
  // ============================================================

  function stub(name) {
    if (name === 'Explore.choose' || name === 'Explore.rest') return null;
    if (name.startsWith('Combat.player')) return { pending: true };
    return { ok: true, pending: true };
  }

  function guestRoute(name, args) {
    if (!isGuest() || P.status !== 'connected') return PASS;
    // Viajar: en grupo decide el anfitrión
    if (name.startsWith('Travel.')) {
      if (!P.together) return PASS;
      return { ok: false, error: `En grupo, el que elige a dónde ir es ${hostName()}. Para ir por tu cuenta, tocá "Separarse" en el grupo.` };
    }
    if (!P.together) return PASS;

    if (name === 'Combat.start') return false; // las peleas en grupo las arranca el anfitrión
    if (name.startsWith('Combat.')) {
      if (!A.State.combat || !P.mirror.combatId) return PASS;
      if (name === 'Combat.finish') {
        P.mirror.dismissed = A.State.combat.id;
        A.State.combat = null;
        P.mirror.combatId = null;
        return undefined;
      }
      if (name === 'Combat.setTarget') {
        const c = A.State.combat;
        const t = c.enemies.find((e) => e.instanceId === args[0] && e.hp > 0);
        if (t) { c.targetInstanceId = args[0]; A.Bus.emitView('combat:target-changed', { instanceId: args[0] }); }
        rpc(name, [{}, args[0]]);
        return undefined;
      }
      rpc(name, [{ target: A.State.combat.targetInstanceId }].concat(args));
      return stub(name);
    }
    if (name === 'Explore.explore') {
      rpc(name, [{}]);
      return { ok: true, pending: true };
    }
    if (name === 'Explore.rest') {
      rpc(name, [{}], (res) => { if (res && res.ok && res.result && res.result.text) showNote({ icon: res.result.kind === 'sleep' ? 'moon' : 'tent', text: res.result.text, chips: res.result.chips || [] }); });
      return null;
    }
    if (name === 'Explore.choose' || name === 'Explore.proceed') {
      if (!(A.State.ui.openModal === 'event' && P.mirror.sceneOpen)) return PASS;
      rpc(name, [{}].concat(args));
      return stub(name);
    }
    // Mochila y mascota: si el anfitrión maneja el héroe, se pide allá
    if (P.mirror.owned) {
      rpc(name, [{}].concat(args));
      return { ok: true, pending: true };
    }
    return PASS;
  }

  function wrap(obj, objName, fnName) {
    if (!obj || typeof obj[fnName] !== 'function') return;
    const key = `${objName}.${fnName}`;
    const orig = obj[fnName];
    ORIG[key] = orig;
    obj[fnName] = function (...args) {
      const r = guestRoute(key, args);
      if (r !== PASS) return r;
      return orig.apply(this, args);
    };
  }

  function installWrappers() {
    ['playerAttack', 'playerPowerAttack', 'playerSpell', 'playerUseItem', 'playerTame', 'playerFlee', 'setTarget', 'finish', 'start'].forEach((f) => wrap(A.Combat, 'Combat', f));
    ['explore', 'choose', 'proceed', 'rest'].forEach((f) => wrap(A.Explore, 'Explore', f));
    ['start', 'step', 'cancel'].forEach((f) => wrap(A.Travel, 'Travel', f));
    ['equip', 'unequip', 'use', 'drop'].forEach((f) => wrap(A.Inventory, 'Inventory', f));
    ['feed', 'healWithPotion'].forEach((f) => wrap(A.Tame, 'Tame', f));
    // El anfitrión: lo que corre con el héroe del invitado lo marca para mandárselo
    const origWith = A.State.withHero;
    A.State.withHero = function (hero, fn) {
      const out = origWith.call(A.State, hero, fn);
      if (isHost() && !P.serializing && hero && hero !== A.State.me() && hero._hid) {
        P.dirty[hero._hid] = true;
        scheduleSnap();
      }
      return out;
    };
  }

  // ============================================================
  // Oyentes
  // ============================================================

  let heroTimer = null;
  let statusAt = 0;
  let statusSig = '';
  function onSaved() {
    if (isHost()) { scheduleSnap(); return; }
    if (!isGuest() || P.status !== 'connected' || P.adopting) return;
    if (P.together && !P.mirror.owned) {
      clearTimeout(heroTimer);
      heroTimer = setTimeout(() => {
        if (guestTogether() && !P.mirror.owned) A.Link.send({ t: 'hero', hero: A.State.me() });
      }, HERO_MS);
    } else if (!P.together) {
      // v3.1: si cambió de lugar o avanzó el viaje, se avisa enseguida (para el mapa del compañero)
      const t = A.State.traveling;
      const sig = `${A.State.world ? A.State.world.regionId : ''}|${t ? `${t.toId}:${t.currentStep}` : ''}`;
      if (sig === statusSig && Date.now() - statusAt <= STATUS_MS) return;
      statusSig = sig;
      statusAt = Date.now();
      A.Link.send({ t: 'status', member: memberOf(A.State.me(), { together: false }) });
    }
  }

  function init() {
    if (!A.Link) return;
    installWrappers();
    A.Link.on('message', (msg, peerId) => {
      if (!msg || !msg.t) return;
      if (isHost()) hostOnMessage(msg, peerId);
      else if (isGuest()) guestOnMessage(msg);
    });
    A.Link.on('close', onLinkClose);
    A.Link.on('error', (err) => { if (P.role) toast(A.Link.errorText(err), 'bad'); });
    const SYS = { sys: true };
    A.Bus.on('state:saved', onSaved, SYS);
    for (const ev of ['combat:started', 'combat:action', 'combat:turn', 'combat:ended', 'travel:started', 'travel:step', 'travel:completed', 'travel:cancelled', 'region:changed', 'time:phase-changed']) {
      A.Bus.on(ev, () => scheduleSnap(), SYS);
    }
    A.Bus.on('modal:open', (e) => { if (e && e.id === 'event' && isHost()) P.sceneSeq += 1; scheduleSnap(); }, SYS);
    A.Bus.on('modal:close', () => scheduleSnap(), SYS);
    // Las misiones de "llegar a" también cuentan para el compañero que viaja con vos
    A.Bus.on('region:changed', (e) => {
      if (!isHost() || A.State.isForeign()) return;
      for (const hid of guestsTogether()) {
        const h = A.State.heroById(hid);
        if (h) A.State.withHero(h, () => { if (A.Quests && A.Quests.onRegion) A.Quests.onRegion(e); });
      }
    }, SYS);
    // Cerrar la pestaña: avisar
    if (typeof window.addEventListener === 'function') {
      window.addEventListener('beforeunload', () => { if (P.role) { try { A.Link.send({ t: 'bye' }); } catch (e) { /* nada */ } } });
    }
  }

  A.Party = {
    VERSION,
    // estado
    get role() { return P.role; },
    get status() { return P.status; },
    get error() { return P.error; },
    get code() { return P.code; },
    get localHid() { return P.localHid; },
    get hostHid() { return P.hostHid; },
    members: () => membersList(),
    member: (hid) => P.members[hid] || null,
    allyHid,
    ally: () => { const h = allyHid(); return h ? P.members[h] || null : null; },
    allyHero: () => { const h = allyHid(); return h && A.State.party ? A.State.party.heroes[h] || null : null; },
    // v3.2: grupos de hasta 4
    MAX_MEMBERS,
    allyHids,
    allies: () => allyHids().map((h) => P.members[h]).filter(Boolean),
    withMe,
    canGive,
    give,
    isActive,
    isHost,
    isGuest,
    isTogether: () => (isHost() ? guestsTogether().length > 0 : guestTogether()),
    guestTogether,
    guestOwned,
    hostBusy,
    hostName,
    lastCode,
    // acciones
    create,
    join,
    leave: () => leave(false),
    separate,
    regroup,
    // motor
    combatHeroes,
    pushChronicle,
    notify,
    openRemoteModal,
    toast,
    _P: P,
    _ORIG: ORIG,
    _sendSnap: () => { for (const hid of guestHids()) sendSnap(hid); },
  };

  init();
})(window.Aventurs);
