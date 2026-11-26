/* ============================================================
   Aventurs — Pantallas del grupo (v3.0)

   - Panel "Grupo" (A.ModalViews.party): crear un grupo y pasar el
     código, unirse con un código, ver a los compañeros, separarse,
     volver a juntarse y salir. v3.2: de 2 a 4 jugadores.
   - En la barra lateral, una fila finita por compañero (sidebar).
   - Avisos cortos abajo de la pantalla (toast).
   ============================================================ */

(function (A) {
  'use strict';

  const U = () => A.UI;
  let typedCode = '';
  let busy = false;

  function esc(s) { return A.Utils.escapeHtml(String(s == null ? '' : s)); }
  function icon(name, size, cls) { return A.UI ? A.UI.icon(name, size, cls) : ''; }
  function pct(cur, max) { return !max ? 0 : Math.max(0, Math.min(100, Math.round((cur / max) * 100))); }
  function regionName(id) { const r = id ? A.Data.getById('regions', id) : null; return r ? r.name : ''; }

  // ============================================================
  // Avisos
  // ============================================================

  let toastTimer = null;
  function toast(text, kind, iconName) {
    if (!text || typeof document === 'undefined') return;
    let el = document.querySelector('.pt-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'pt-toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.className = `pt-toast is-${kind || 'info'}`;
    el.innerHTML = `${icon(iconName || (kind === 'bad' ? 'warning' : 'party'), 22)}<span>${esc(text)}</span>`;
    // forzar la animación
    void el.offsetWidth;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), 4200);
  }

  // ============================================================
  // Ficha de un miembro
  // ============================================================

  function heroSprite(m, size) {
    if (!A.Sprites) return '';
    const w = m.weapon && A.Data ? A.Data.getById('weapons', m.weapon) : null;
    return A.Sprites.heroHtml(m.raceId, { size, weapon: A.Sprites.weaponKindOf ? A.Sprites.weaponKindOf(w) : undefined });
  }

  function whereLine(m, me) {
    if (!m) return '';
    if (m.together) return `Juntos${m.regionId ? ` en ${regionName(m.regionId)}` : ''}`;
    return m.regionId ? `Por su cuenta en ${regionName(m.regionId)}` : 'Por su cuenta';
  }

  function memberCard(m, isMe) {
    const race = A.Data.getById('races', m.raceId);
    const pet = m.pet;
    return `
      <div class="pt-member ${isMe ? 'is-me' : ''} ${m.together ? 'is-together' : 'is-apart'}">
        <span class="pt-member-hero">${heroSprite(m, 64)}</span>
        <div class="pt-member-main">
          <div class="pt-member-name">
            <b>${esc(m.name)}</b>
            ${m.host ? '<span class="pt-badge is-host">Anfitrión</span>' : ''}
            ${isMe ? '<span class="pt-badge">Vos</span>' : ''}
          </div>
          <div class="pt-member-sub">${esc(race ? race.name : '')} · Nivel ${m.level || 1}</div>
          <div class="pt-member-bars">
            <span class="pt-bar is-hp" title="Vida ${m.hp}/${m.maxHp}"><span style="width:${pct(m.hp, m.maxHp)}%"></span></span>
            ${m.hasMagic ? `<span class="pt-bar is-mana" title="Maná ${m.mana}/${m.maxMana}"><span style="width:${pct(m.mana, m.maxMana)}%"></span></span>` : ''}
          </div>
          <div class="pt-member-where">${icon(m.together ? 'party' : 'map', 14)}<span>${esc(isMe && !A.Party.isHost() ? (m.together ? 'Juntos' : 'Por tu cuenta') : whereLine(m))}</span></div>
        </div>
        ${pet ? `<span class="pt-member-pet" title="${esc(pet.name)} (nivel ${pet.level || 1})">${A.Sprites ? A.Sprites.petHtml({ species: pet.species, name: pet.name }, { size: 40 }) : ''}<span class="pt-bar is-pet"><span style="width:${pct(pet.health, pet.maxHealth)}%"></span></span></span>` : ''}
        ${isMe ? '' : giveCoinsHtml(m)}
      </div>`;
  }

  /** v3.2: pasarle monedas (las cosas se pasan desde cada objeto de la mochila). */
  function giveCoinsHtml(m) {
    if (!A.Party.canGive || !A.Party.give || A.Party.status !== 'connected') return '';
    const can = A.Party.canGive();
    if (!can.ok) return '';
    const have = A.Currency ? A.Currency.toCopper() : 0;
    if (have <= 0) return '';
    return `
        <div class="pt-give">
          <input type="number" min="1" max="${have}" step="1" inputmode="numeric" placeholder="cobre" data-coins-for="${esc(m.hid)}" aria-label="Cuánto cobre le das a ${esc(m.name)}">
          <button class="btn-ghost btn-sm" data-party-coins="${esc(m.hid)}">${icon('coins', 14)}<span>Darle monedas</span></button>
          <span class="dim">Tenés ${esc(A.Currency.formatPrice(have))}. Las cosas se pasan desde la mochila.</span>
        </div>`;
  }

  // ============================================================
  // Panel
  // ============================================================

  function howItWorks() {
    return `
      <ul class="pt-how">
        <li>${icon('party', 18)}<span><b>Juntos</b> (de 2 a 4): viajan, exploran y pelean a la par. El que creó el grupo elige a dónde viajar; todos pueden explorar y descansar, y en las peleas cada uno juega su turno con su mascota.</span></li>
        <li>${icon('map', 18)}<span><b>Separados</b>: cada uno juega por su lado. Para volver a juntarse, "Ir con..." en este panel te lleva hasta donde está el grupo.</span></li>
        <li>${icon('coins', 18)}<span><b>Lo que ganan se reparte</b>: experiencia, monedas y hallazgos. Lo malo (una trampa, un ladrón) les toca a todos.</span></li>
        <li>${icon('bag', 18)}<span>Cada uno se queda con su personaje y su mochila, y se pueden pasar cosas entre ustedes. Todo se guarda en la compu de cada uno.</span></li>
      </ul>`;
  }

  function render() {
    const P = A.Party;
    const st = P.status;
    const role = P.role;
    let body = '';

    if (!role || st === 'idle' || st === 'error') {
      const last = P.lastCode('guest');
      body = `
        <p class="pt-lead">Jugá con alguien en su compu: cada uno con su personaje, su mochila y su mascota.</p>
        ${st === 'error' && P.error ? `<div class="pt-error">${icon('warning', 20)}<span>${esc(P.error)}</span></div>` : ''}
        <div class="pt-choices">
          <section class="pt-choice">
            <h3>${icon('crown', 20)}<span>Crear un grupo</span></h3>
            <p>Te damos un código de 6 letras para pasarle a tu compañero.</p>
            <button class="btn-primary pt-btn" data-party="create" ${busy ? 'disabled' : ''}>${icon('party', 20)}<span>Crear grupo</span></button>
          </section>
          <section class="pt-choice">
            <h3>${icon('key', 20)}<span>Unirme a un grupo</span></h3>
            <p>Escribí el código que te pasaron.</p>
            <div class="pt-join">
              <input class="pt-code-input" data-party-code maxlength="9" autocomplete="off" spellcheck="false" placeholder="K7Q-2XP" value="${esc(typedCode || (last ? A.Link.prettyCode(last) : ''))}">
              <button class="btn-primary pt-btn" data-party="join" ${busy ? 'disabled' : ''}>${icon('swords', 18)}<span>Unirme</span></button>
            </div>
          </section>
        </div>
        ${howItWorks()}`;
    } else if (st === 'opening' || st === 'connecting' || st === 'joining') {
      body = `
        <div class="pt-wait">
          <span class="pt-spinner" aria-hidden="true"></span>
          <p>${st === 'opening' ? 'Abriendo el grupo…' : st === 'connecting' ? 'Buscando el grupo…' : 'Entrando al grupo…'}</p>
        </div>
        <div class="pt-actions"><button class="btn-ghost" data-party="leave">Cancelar</button></div>`;
    } else if (st === 'busy') {
      body = `
        <div class="pt-wait">
          <span class="pt-spinner" aria-hidden="true"></span>
          <p>${esc(P.hostName())} está peleando o viajando. Entrás apenas termine…</p>
        </div>
        <div class="pt-actions"><button class="btn-ghost" data-party="leave">Cancelar</button></div>`;
    } else if (role === 'host' && st === 'waiting') {
      body = `
        <div class="pt-codebox">
          <span class="pt-code-label">Código del grupo</span>
          <span class="pt-code" data-party-codeval>${esc(A.Link.prettyCode(P.code))}</span>
          <button class="btn-ghost pt-copy" data-party="copy">${icon('copy', 16)}<span>Copiar</span></button>
        </div>
        <p class="pt-lead">Pasale este código a tus compañeros (pueden ser hasta ${(P.MAX_MEMBERS || 4) - 1}). Cada uno abre el juego en su compu, toca <b>Grupo</b> y lo escribe en <b>Unirme a un grupo</b>.</p>
        <div class="pt-wait is-small"><span class="pt-spinner" aria-hidden="true"></span><p>Esperando que se una alguien…</p></div>
        <div class="pt-actions"><button class="btn-ghost is-danger" data-party="leave">${icon('logout', 18)}<span>Cerrar el grupo</span></button></div>`;
    } else {
      // conectados
      const me = P.localHid;
      const list = P.members();
      const ordered = list.filter((m) => m.hid === me).concat(list.filter((m) => m.hid !== me));
      const allies = P.allies ? P.allies() : [P.ally()].filter(Boolean);
      const guest = role === 'guest';
      const apart = allies.filter((m) => !m.together && m.hid !== P.hostHid);
      const together = guest ? P.guestTogether() : allies.some((m) => m.together);
      const owned = P.guestOwned();
      const room = (P.MAX_MEMBERS || 4) - list.length;
      const actions = [];
      if (guest && together) actions.push(`<button class="btn-ghost" data-party="separate" ${owned ? 'disabled title="Esperá a que termine la pelea, el viaje o la escena"' : ''}>${icon('map', 18)}<span>Separarme</span></button>`);
      // v3.9: juntarse solo si están en el mismo lugar (ya no te lleva hasta donde está)
      const hostM = list.find((m) => m.hid === P.hostHid);
      const myRegion = A.State.world ? A.State.world.regionId : null;
      const sameSpot = !hostM || !hostM.regionId || hostM.regionId === myRegion;
      const hostPlace = hostM && hostM.regionId ? (A.Data.getById('regions', hostM.regionId) || {}).name : '';
      if (guest && !together) actions.push(sameSpot
        ? `<button class="btn-primary" data-party="regroup">${icon('party', 18)}<span>Juntarme con ${esc(P.hostName())}</span></button>`
        : `<button class="btn-ghost" disabled title="Tienen que estar en el mismo lugar">${icon('map', 18)}<span>Viajá a ${esc(hostPlace || 'donde está')} para juntarte</span></button>`);
      actions.push(`<button class="btn-ghost is-danger" data-party="leave">${icon('logout', 18)}<span>${guest ? 'Salir del grupo' : 'Cerrar el grupo'}</span></button>`);
      body = `
        <div class="pt-head-line">
          <span class="pt-online">${icon('signal', 16)}<span>Conectados</span></span>
          <span class="pt-code-small">Código <b>${esc(A.Link.prettyCode(P.code))}</b></span>
        </div>
        <div class="pt-members">${ordered.map((m) => memberCard(m, m.hid === me)).join('')}</div>
        <p class="pt-note">${guest
          ? (together ? `Van juntos. ${esc(P.hostName())} elige a dónde viajar; todos pueden avanzar en el camino, explorar y descansar.` : `Estás por tu cuenta. Cuando estés en el mismo lugar que ${esc(P.hostName())}, tocá "Juntarme".`)
          : (!apart.length ? 'Van juntos. Vos elegís a dónde viajar; todos pueden explorar y descansar.'
            : `${esc(apart.map((m) => m.name).join(', '))} ${apart.length > 1 ? 'andan' : 'anda'} por su cuenta. ${apart.length > 1 ? 'Pueden' : 'Puede'} volver con vos cuando quiera${apart.length > 1 ? 'n' : ''}.`)}</p>
        ${!guest && room > 0 ? `<p class="pt-note is-room">${icon('key', 14)}<span>Pueden entrar ${room === 1 ? 'uno más' : `${room} más`} con el código <b>${esc(A.Link.prettyCode(P.code))}</b>.</span></p>` : ''}
        <div class="pt-actions">${actions.join('')}</div>`;
    }

    return `
      <div class="modal pt-modal" role="dialog" aria-modal="true" aria-label="Jugar en grupo">
        <header class="modal-header">
          <h2 class="modal-title">${icon('party', 26)}<span>Jugar en grupo</span></h2>
          <button class="modal-close" data-modal-close aria-label="Cerrar">×</button>
        </header>
        <div class="modal-body">${body}</div>
      </div>`;
  }

  async function act(what, overlay) {
    const P = A.Party;
    if (what === 'create') {
      busy = true;
      rerender();
      const r = await P.create();
      busy = false;
      if (r && !r.ok && r.error) toast(r.error, 'bad');
      rerender();
    } else if (what === 'join') {
      const input = overlay.querySelector('[data-party-code]');
      typedCode = input ? input.value : typedCode;
      busy = true;
      rerender();
      const r = await P.join(typedCode);
      busy = false;
      if (r && !r.ok && r.error) toast(r.error, 'bad');
      rerender();
    } else if (what === 'leave') {
      P.leave();
      rerender();
    } else if (what === 'separate') {
      const r = P.separate();
      if (r && r.error) toast(r.error, 'bad');
    } else if (what === 'regroup') {
      const r = P.regroup();
      if (r && r.error) toast(r.error, 'bad');
    } else if (what === 'copy') {
      const code = A.Link.prettyCode(P.code);
      try {
        await navigator.clipboard.writeText(code);
        toast('Código copiado.', 'good');
      } catch (e) {
        const el = overlay.querySelector('[data-party-codeval]');
        if (el && window.getSelection) { const r = document.createRange(); r.selectNodeContents(el); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
        toast('Seleccioná el código y copialo con Ctrl+C.');
      }
    }
  }

  function bind(overlay) {
    overlay.querySelectorAll('[data-party]').forEach((b) => {
      b.addEventListener('click', () => { if (!b.disabled) act(b.dataset.party, overlay); });
    });
    // v3.2: darle monedas a un compañero
    overlay.querySelectorAll('[data-party-coins]').forEach((b) => {
      b.addEventListener('click', () => {
        const hid = b.dataset.partyCoins;
        const input = [...overlay.querySelectorAll('[data-coins-for]')].find((x) => x.dataset.coinsFor === hid);
        const n = Math.floor(Number(input && input.value) || 0);
        if (n <= 0) { toast('Escribí cuánto cobre le das.', 'bad'); return; }
        const r = A.Party.give(hid, '$coins', n);
        if (r && !r.ok && r.why) toast(r.why, 'bad');
        else rerender();
      });
    });
    const input = overlay.querySelector('[data-party-code]');
    if (input) {
      input.addEventListener('input', () => {
        const pretty = A.Link.prettyCode(input.value);
        typedCode = pretty;
        if (input.value !== pretty && pretty.length <= 7) input.value = pretty;
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') act('join', overlay); });
    }
  }

  function rerender() {
    if (A.State.ui && A.State.ui.openModal === 'party') A.State.openModal('party', A.State.ui.modalPayload || {});
  }

  // ============================================================
  // v3.2: compañeros en la barra lateral (una fila finita por cada uno)
  // ============================================================

  /** ¿Va con vos ahora? (si sos invitado y te separaste, nadie va con vos) */
  function withMe(m) { return A.Party.withMe ? A.Party.withMe(m) : !!(m && m.together); }
  /** Los datos al día: si su héroe está acá (van juntos), de ahí; si no, la ficha que mandó. */
  function liveOf(m) {
    const h = A.State.party && A.State.party.heroes ? A.State.party.heroes[m.hid] : null;
    if (!h) return m;
    return Object.assign({}, m, {
      name: h.name, level: h.level, raceId: h.raceId,
      hp: h.hp, maxHp: h.maxHp, mana: h.mana, maxMana: h.maxMana, hasMagic: !!h.hasMagic,
      weapon: h.equipment ? h.equipment.weapon : m.weapon,
      pet: h.pet ? { name: h.pet.name, species: h.pet.species, health: h.pet.health, maxHealth: h.pet.maxHealth, level: h.pet.level || 1 } : null,
    });
  }
  function hasMates() {
    return !!(A.Party && A.Party.role && A.Party.status === 'connected' && (A.Party.allies ? A.Party.allies().length : A.Party.ally()));
  }
  // v3.17: una fila finita por compañero: cara con nivel, nombre, vida (y maná), su mascota y dónde está
  function mateRow(m0) {
    const m = liveOf(m0);
    const near = withMe(m0);
    const down = (m.hp || 0) <= 0;
    const pet = m.pet;
    const petDown = pet && pet.health <= 0;
    const where = near ? 'Con vos' : whereLine(m0);
    const hpP = pct(m.hp, m.maxHp);
    return `
      <button class="sb-mate ${near ? 'is-near' : 'is-apart'} ${down ? 'is-down' : ''} ${hpP < 30 && !down ? 'is-low' : ''}" data-action="party" title="${esc(`${m.name}, nivel ${m.level || 1}. Vida ${m.hp}/${m.maxHp}${m.hasMagic ? `, maná ${m.mana}/${m.maxMana}` : ''}${pet ? `. ${pet.name}: ${pet.health}/${pet.maxHealth}` : ''}. ${where}.`)}">
        <span class="sb-mate-face ${m.look && m.look.frame ? `lk-${esc(m.look.frame)}` : ''}">${heroSprite(m, 26)}<i class="sb-mate-lvl">${m.level || 1}</i></span>
        <b class="sb-mate-name">${esc(m.name)}</b>
        <span class="sb-mate-bars">
          <span class="sb-mate-bar is-hp"><span style="width:${hpP}%"></span><em class="num">${down ? 'Caído' : `${m.hp}/${m.maxHp}`}</em></span>
          ${m.hasMagic ? `<span class="sb-mate-bar is-mana"><span style="width:${pct(m.mana, m.maxMana)}%"></span></span>` : ''}
        </span>
        ${pet ? `<span class="sb-mate-pet ${petDown ? 'is-down' : ''}" title="${esc(`${pet.name}: ${pet.health}/${pet.maxHealth}`)}">${A.Sprites && A.Sprites.petHtml ? A.Sprites.petHtml(pet, { size: 20 }) : icon('paw', 12)}<i style="width:${pct(pet.health, pet.maxHealth)}%"></i></span>` : '<span class="sb-mate-pet is-none"></span>'}
        <span class="sb-mate-where ${near ? 'is-near' : ''}" title="${esc(where)}">${icon(near ? 'party' : 'map', 12)}</span>
      </button>`;
  }
  /** La sección del grupo arriba de todo en la barra lateral. */
  function sidebar() {
    if (!A.Party || !A.Party.role) return '';
    const P = A.Party;
    if (P.status === 'waiting' && P.isHost()) {
      return `<button class="sb-party-wait" data-action="party">${icon('party', 20)}<span><b>Grupo abierto</b><small>Código ${esc(A.Link.prettyCode(P.code))}: pasáselo a tus compañeros</small></span></button>`;
    }
    const mates = P.allies ? P.allies() : [P.ally()].filter(Boolean);
    if (!mates.length) {
      if (['connecting', 'joining', 'busy', 'opening'].includes(P.status)) return `<button class="sb-party-wait" data-action="party"><span class="pt-spinner is-tiny"></span><span><b>Conectando…</b></span></button>`;
      return '';
    }
    const total = mates.length + 1;
    return `
      <section class="sb-party">
        <h3 class="sb-title"><span>Tu grupo</span><button class="sb-title-link" data-action="party" title="Ver el grupo">${icon('party', 12)}<span>${total} de ${P.MAX_MEMBERS || 4}</span></button></h3>
        <div class="sb-mates">${mates.map(mateRow).join('')}</div>
      </section>`;
  }

  // ============================================================
  // Ficha del compañero en la barra lateral (v3.0, se deja por compatibilidad)
  // ============================================================

  function allyCard() {
    if (!A.Party || !A.Party.role) return '';
    const P = A.Party;
    if (P.status === 'waiting' && P.isHost()) {
      return `<button class="ally-card is-waiting" data-action="party">${icon('party', 28)}<span class="ally-main"><span class="ally-name">Grupo abierto</span><span class="ally-where">Código ${esc(A.Link.prettyCode(P.code))}: pasáselo a tu compañero</span></span></button>`;
    }
    const m = P.ally();
    if (!m) {
      if (['connecting', 'joining', 'busy', 'opening'].includes(P.status)) return `<button class="ally-card is-waiting" data-action="party"><span class="pt-spinner is-tiny"></span><span class="ally-main"><span class="ally-name">Conectando…</span></span></button>`;
      return '';
    }
    const together = P.isGuest() ? P.guestTogether() : m.together;
    return `
      <button class="ally-card ${together ? 'is-together' : 'is-apart'}" data-action="party" title="Tu grupo: tocá para ver más">
        <span class="ally-hero">${heroSprite(m, 40)}<span class="ally-lvl">${m.level || 1}</span></span>
        <span class="ally-main">
          <span class="ally-name">${esc(m.name)}${m.pet ? ` <span class="ally-pet">y ${esc(m.pet.name)}</span>` : ''}</span>
          <span class="ally-bars">
            <span class="pt-bar is-hp" title="Vida ${m.hp}/${m.maxHp}"><span style="width:${pct(m.hp, m.maxHp)}%"></span></span>
            ${m.hasMagic ? `<span class="pt-bar is-mana" title="Maná ${m.mana}/${m.maxMana}"><span style="width:${pct(m.mana, m.maxMana)}%"></span></span>` : ''}
          </span>
          <span class="ally-where">${icon(together ? 'party' : 'map', 12)}<span>${esc(together ? 'Juntos' : whereLine(m))}</span></span>
        </span>
      </button>`;
  }

  /** Botón del encabezado (con un puntito de estado). */
  function headerButton() {
    const P = A.Party;
    const st = P && P.role ? (P.status === 'connected' ? 'is-on' : 'is-wait') : '';
    return `<button class="btn-ghost head-btn pt-head-btn ${st}" data-action="party" title="Jugar en grupo">${icon('party', 18)}<span>Grupo</span>${st ? '<i class="pt-dot"></i>' : ''}</button>`;
  }

  A.ModalViews = A.ModalViews || {};
  A.ModalViews.party = { render: () => render(), bind };

  A.Views = A.Views || {};
  A.Views.Party = { toast, allyCard, sidebar, hasMates, headerButton, rerender };

  if (A.Bus) {
    A.Bus.on('party:changed', rerender);
    A.Bus.on('party:status', (e) => { if (e && e.text) toast(e.text); });
  }
  // v3.13: lo que no entra por el tope se vende solo: un aviso
  if (A.Bus) A.Bus.on('inventory:capped', (ev) => { if (ev && typeof toast === 'function') toast(`Llevás el máximo de ${ev.name} (${ev.cap}): lo que sobraba se vendió.`, 'good', 'coins'); });
})(window.Aventurs);
