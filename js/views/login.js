/* ============================================================
   Aventurs — Entrar o crear cuenta (v3.0)
   Lo primero que se ve al abrir el juego si nadie entró en esta
   pestaña. Las cuentas son de esta compu (ver js/core/accounts.js).
   ============================================================ */

(function (A) {
  'use strict';

  let rootEl = null;
  let tab = 'login';     // 'login' | 'create' | 'forgot'
  let msg = null;        // { kind, text }
  let busy = false;
  const form = { user: '', pass: '', pass2: '', key: '', takeLegacy: true, remember: true, newPass: '' };

  function esc(s) { return A.Utils.escapeHtml(String(s == null ? '' : s)); }
  function icon(name, size) { return A.ItemSprites ? A.ItemSprites.icon(name, { size }) : ''; }
  function heroImg(raceId, size) { return A.Sprites && A.Sprites.heroHtml ? A.Sprites.heroHtml(raceId || 'humano', { size }) : ''; }

  function accountChips() {
    const list = A.Accounts.list();
    if (!list.length) return '';
    return `
      <div class="lg-accounts">
        <span class="lg-accounts-label">Cuentas en esta compu</span>
        <div class="lg-accounts-list">
          ${list.slice(0, 6).map((a) => `
            <button type="button" class="lg-acc ${form.user && form.user.toLowerCase() === a.key ? 'is-on' : ''}" data-lg-pick="${esc(a.key)}" title="Entrar como ${esc(a.name)}">
              <span class="lg-acc-hero">${heroImg(a.hero ? a.hero.raceId : 'humano', 36)}</span>
              <span class="lg-acc-text">
                <b>${esc(a.name)}</b>
                <small>${a.hero ? `${esc(a.hero.name)} · Nv ${a.hero.level}` : 'Sin personaje todavía'}</small>
              </span>
            </button>`).join('')}
        </div>
      </div>`;
  }

  function loginHtml() {
    return `
      ${accountChips()}
      <label class="lg-label" for="lg-user">Usuario</label>
      <input id="lg-user" class="lg-input" data-lg="user" autocomplete="username" spellcheck="false" value="${esc(form.user)}" placeholder="Tu usuario">
      <label class="lg-label" for="lg-pass">Contraseña</label>
      <input id="lg-pass" class="lg-input" data-lg="pass" type="password" autocomplete="current-password" value="${esc(form.pass)}" placeholder="Tu contraseña">
      <label class="lg-check"><input type="checkbox" data-lg="remember" ${form.remember ? 'checked' : ''}><span>Recordarme en esta compu</span></label>
      <button class="cc-start lg-go" data-lg-do="login" ${busy ? 'disabled' : ''}>${icon('swords', 22)}<span>Entrar</span></button>
      <button type="button" class="lg-link" data-lg-tab="forgot">¿Te olvidaste la contraseña?</button>`;
  }

  function createHtml() {
    const legacy = A.Accounts.legacySave();
    const first = !A.Accounts.list().length;
    const owner = A.Accounts.isOwnerName(form.user);
    const race = legacy ? A.Data.getById('races', legacy.raceId) : null;
    return `
      <label class="lg-label" for="lg-user">Usuario</label>
      <input id="lg-user" class="lg-input" data-lg="user" autocomplete="username" spellcheck="false" value="${esc(form.user)}" placeholder="Letras y números, sin espacios">
      <div class="lg-row">
        <span>
          <label class="lg-label" for="lg-pass">Contraseña</label>
          <input id="lg-pass" class="lg-input" data-lg="pass" type="password" autocomplete="new-password" value="${esc(form.pass)}" placeholder="Al menos 4">
        </span>
        <span>
          <label class="lg-label" for="lg-pass2">Repetila</label>
          <input id="lg-pass2" class="lg-input" data-lg="pass2" type="password" autocomplete="new-password" value="${esc(form.pass2)}" placeholder="Otra vez">
        </span>
      </div>
      ${owner ? `
        <label class="lg-label" for="lg-key">Llave del dueño</label>
        <input id="lg-key" class="lg-input is-key" data-lg="key" autocomplete="off" spellcheck="false" value="${esc(form.key)}" placeholder="AVT-XXXX-XXXX-XXXX">
        <p class="lg-hint">${icon('key', 16)}<span>Este usuario es el del dueño del juego (el único que ve el Editor). Se crea una sola vez por compu, con la llave.</span></p>` : ''}
      ${legacy && first ? `
        <label class="lg-check is-legacy"><input type="checkbox" data-lg="takeLegacy" ${form.takeLegacy ? 'checked' : ''}>
          <span class="lg-legacy-hero">${heroImg(legacy.raceId, 32)}</span>
          <span>Quedarme con la partida que ya hay en esta compu: <b>${esc(legacy.name)}</b>, ${esc(race ? race.name : '')} de nivel ${legacy.level}.</span>
        </label>` : ''}
      <label class="lg-check"><input type="checkbox" data-lg="remember" ${form.remember ? 'checked' : ''}><span>Recordarme en esta compu</span></label>
      <button class="cc-start lg-go" data-lg-do="create" ${busy ? 'disabled' : ''}>${icon('plus', 22)}<span>Crear cuenta</span></button>`;
  }

  function forgotHtml() {
    return `
      <p class="lg-hint is-block">${icon('key', 16)}<span>Las cuentas viven en esta compu y la contraseña no se puede ver. Con la <b>llave del dueño</b> del juego se le pone una contraseña nueva a cualquier cuenta de acá.</span></p>
      <label class="lg-label" for="lg-user">Usuario</label>
      <input id="lg-user" class="lg-input" data-lg="user" spellcheck="false" value="${esc(form.user)}">
      <label class="lg-label" for="lg-key">Llave del dueño</label>
      <input id="lg-key" class="lg-input is-key" data-lg="key" autocomplete="off" spellcheck="false" value="${esc(form.key)}" placeholder="AVT-XXXX-XXXX-XXXX">
      <label class="lg-label" for="lg-new">Contraseña nueva</label>
      <input id="lg-new" class="lg-input" data-lg="newPass" type="password" autocomplete="new-password" value="${esc(form.newPass)}">
      <button class="cc-start lg-go" data-lg-do="forgot" ${busy ? 'disabled' : ''}>${icon('key', 22)}<span>Cambiar la contraseña</span></button>
      <button type="button" class="lg-link" data-lg-tab="login">Volver</button>`;
  }

  function render() {
    if (!rootEl) return;
    const first = !A.Accounts.list().length;
    if (first && tab === 'login') tab = 'create';
    rootEl.innerHTML = `
      <div class="lg-page">
        <div class="lg-art" aria-hidden="true">
          ${['humano', 'minotauro', 'elfo', 'hada', 'orco', 'vampiro'].map((r, i) => `<span class="lg-art-hero" style="--i:${i}">${heroImg(r, 96)}</span>`).join('')}
        </div>
        <main class="lg-card" role="main">
          <div class="lg-brand">${icon('swords', 34)}<span>Aventurs</span></div>
          <p class="lg-sub">${first ? 'Creá tu cuenta para empezar. Cada jugador tiene la suya y su propia partida.' : 'Entrá con tu cuenta para seguir tu aventura.'}</p>
          ${tab !== 'forgot' ? `
            <div class="lg-tabs" role="tablist">
              <button class="lg-tab ${tab === 'login' ? 'is-on' : ''}" data-lg-tab="login" role="tab" ${first ? 'disabled' : ''}>Entrar</button>
              <button class="lg-tab ${tab === 'create' ? 'is-on' : ''}" data-lg-tab="create" role="tab">Crear cuenta</button>
            </div>` : '<h2 class="lg-title">Contraseña olvidada</h2>'}
          ${msg ? `<div class="lg-msg is-${msg.kind}">${icon(msg.kind === 'bad' ? 'warning' : 'check', 18)}<span>${esc(msg.text)}</span></div>` : ''}
          <form class="lg-form" autocomplete="on" onsubmit="return false">
            ${tab === 'create' ? createHtml() : tab === 'forgot' ? forgotHtml() : loginHtml()}
          </form>
          <p class="lg-foot">Las cuentas se guardan en este navegador, no en internet. En otra compu, creá la cuenta ahí.</p>
        </main>
      </div>`;
    bind();
  }

  function readInputs() {
    rootEl.querySelectorAll('[data-lg]').forEach((el) => {
      const k = el.dataset.lg;
      form[k] = el.type === 'checkbox' ? el.checked : el.value;
    });
  }

  function bind() {
    rootEl.querySelectorAll('[data-lg-tab]').forEach((b) => b.addEventListener('click', () => {
      readInputs();
      tab = b.dataset.lgTab;
      msg = null;
      render();
      focusFirst();
    }));
    rootEl.querySelectorAll('[data-lg-pick]').forEach((b) => b.addEventListener('click', () => {
      readInputs();
      form.user = b.dataset.lgPick;
      form.pass = '';
      msg = null;
      render();
      const p = rootEl.querySelector('[data-lg="pass"]');
      if (p) p.focus();
    }));
    rootEl.querySelectorAll('[data-lg]').forEach((el) => {
      el.addEventListener('input', () => {
        const before = A.Accounts.isOwnerName(form.user);
        readInputs();
        // si se escribe el usuario del dueño, aparece el campo de la llave
        if (tab === 'create' && el.dataset.lg === 'user' && before !== A.Accounts.isOwnerName(form.user)) {
          const pos = el.selectionStart;
          render();
          const again = rootEl.querySelector('[data-lg="user"]');
          if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) { /* nada */ } }
        }
      });
      el.addEventListener('change', readInputs);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { readInputs(); submit(); } });
    });
    rootEl.querySelectorAll('[data-lg-do]').forEach((b) => b.addEventListener('click', () => { readInputs(); submit(); }));
  }

  function focusFirst() {
    const el = rootEl && (rootEl.querySelector('[data-lg="user"]:not([value]), [data-lg="user"][value=""]') || rootEl.querySelector('[data-lg="pass"]') || rootEl.querySelector('[data-lg="user"]'));
    if (el) el.focus();
  }

  async function submit() {
    if (busy) return;
    msg = null;
    busy = true;
    const wasForgot = tab === 'forgot';
    render();
    let r;
    try {
      if (tab === 'create') {
        if (form.pass !== form.pass2) r = { ok: false, error: 'Las dos contraseñas no son iguales.' };
        else r = await A.Accounts.register(form.user, form.pass, { ownerKey: form.key, takeLegacy: form.takeLegacy, remember: form.remember });
      } else if (tab === 'forgot') {
        r = await A.Accounts.resetWithKey(form.user, form.key, form.newPass);
        if (r.ok) { tab = 'login'; form.pass = ''; form.key = ''; form.newPass = ''; msg = { kind: 'good', text: 'Listo: ya podés entrar con la contraseña nueva.' }; }
      } else {
        r = await A.Accounts.login(form.user, form.pass, { remember: form.remember });
      }
    } catch (e) {
      r = { ok: false, error: 'Algo salió mal. Probá de nuevo.' };
    }
    busy = false;
    if (r && r.ok && wasForgot) {
      render();
      const p = rootEl && rootEl.querySelector('[data-lg="pass"]');
      if (p) p.focus();
      return;
    }
    if (!r || !r.ok) {
      msg = { kind: 'bad', text: (r && r.error) || 'No se pudo.' };
      render();
      focusFirst();
      return;
    }
    // adentro: el resto lo hace app.js (account:changed)
    form.pass = ''; form.pass2 = ''; form.key = '';
    if (r.tookLegacy) msg = null;
  }

  const LoginView = {
    mount(container) {
      rootEl = container;
      msg = null;
      busy = false;
      tab = A.Accounts.list().length ? 'login' : 'create';
      const last = A.Accounts.list()[0];
      if (last && !form.user) form.user = last.key;
      render();
      focusFirst();
    },
    unmount() { if (rootEl) rootEl.innerHTML = ''; rootEl = null; },
  };

  A.Views = A.Views || {};
  A.Views.Login = LoginView;
})(window.Aventurs);
