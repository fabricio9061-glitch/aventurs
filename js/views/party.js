/* ============================================================
   Aventurs — Pantallas del grupo (v3.0)

   - Panel "Grupo" (A.ModalViews.party): crear un grupo y pasar el
     código, unirse con un código, ver al compañero, separarse,
     volver a juntarse y salir.
   - Ficha chiquita del compañero en la barra lateral (allyCard).
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
  function toast(text, kind) {
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
    el.innerHTML = `${icon(kind === 'bad' ? 'warning' : 'party', 22)}<span>${esc(text)}</span>`;
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
      </div>`;
  }

  // ============================================================
  // Panel
  // ============================================================

  function howItWorks() {
    return `
      <ul class="pt-how">
        <li>${icon('party', 18)}<span><b>Juntos</b>: viajan, exploran y pelean a la par. El que creó el grupo elige a dónde viajar; los dos pueden explorar y descansar, y en las peleas cada uno juega su turno con su mascota.</span></li>
        <li>${icon('map', 18)}<span><b>Separados</b>: cada uno juega por su lado. Para volver a juntarse, "Ir con..." en este panel te lleva hasta donde está el otro.</span></li>
        <li>${icon('bag', 18)}<span>Cada uno se queda con su personaje, su mochila y lo que gana. Todo se guarda en la compu de cada uno.</span></li>
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
        <p class="pt-lead">Pasale este código a tu compañero. Él abre el juego en su compu, toca <b>Grupo</b> y lo escribe en <b>Unirme a un grupo</b>.</p>
        <div class="pt-wait is-small"><span class="pt-spinner" aria-hidden="true"></span><p>Esperando que se una alguien…</p></div>
        <div class="pt-actions"><button class="btn-ghost is-danger" data-party="leave">${icon('logout', 18)}<span>Cerrar el grupo</span></button></div>`;
    } else {
      // conectados
      const me = P.localHid;
      const list = P.members();
      const ordered = list.filter((m) => m.hid === me).concat(list.filter((m) => m.hid !== me));
      const ally = P.ally();
      const guest = role === 'guest';
      const together = guest ? P.guestTogether() : !!(ally && ally.together);
      const owned = P.guestOwned();
      const actions = [];
      if (guest && together) actions.push(`<button class="btn-ghost" data-party="separate" ${owned ? 'disabled title="Esperá a que termine la pelea, el viaje o la escena"' : ''}>${icon('map', 18)}<span>Separarme</span></button>`);
      if (guest && !together) actions.push(`<button class="btn-primary" data-party="regroup">${icon('party', 18)}<span>Ir con ${esc(P.hostName())}</span></button>`);
      actions.push(`<button class="btn-ghost is-danger" data-party="leave">${icon('logout', 18)}<span>${guest ? 'Salir del grupo' : 'Cerrar el grupo'}</span></button>`);
      body = `
        <div class="pt-head-line">
          <span class="pt-online">${icon('signal', 16)}<span>Conectados</span></span>
          <span class="pt-code-small">Código <b>${esc(A.Link.prettyCode(P.code))}</b></span>
        </div>
        <div class="pt-members">${ordered.map((m) => memberCard(m, m.hid === me)).join('')}</div>
        <p class="pt-note">${guest
          ? (together ? `Van juntos. ${esc(P.hostName())} elige a dónde viajar; los dos pueden explorar y descansar.` : `Estás por tu cuenta. Cuando quieras, "Ir con ${esc(P.hostName())}" te lleva hasta donde está.`)
          : (ally && ally.together ? 'Van juntos. Vos elegís a dónde viajar; los dos pueden explorar y descansar.' : `${esc(ally ? ally.name : 'Tu compañero')} anda por su cuenta. Puede volver con vos cuando quiera.`)}</p>
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
  // Ficha del compañero en la barra lateral
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
  A.Views.Party = { toast, allyCard, headerButton, rerender };

  if (A.Bus) {
    A.Bus.on('party:changed', rerender);
    A.Bus.on('party:status', (e) => { if (e && e.text) toast(e.text); });
  }
})(window.Aventurs);
