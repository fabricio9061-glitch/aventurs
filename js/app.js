/* ============================================================
   Aventurs — App
   Bootstrap: inicializa Data, valida, carga State, monta vista raíz.

   Si hay partida guardada -> Shell.
   Si no -> Character (creador).
   ============================================================ */

(function (A) {
  'use strict';

  function boot() {
    console.log('[Aventurs] v3.21.8');

    // 1. Cargar contenido del juego (seeds + overrides del editor)
    A.Data.init();

    // 2. Validar coherencia
    const warnings = A.Validate.run();
    if (warnings.length === 0) {
      console.log('[Validate] Sin avisos.');
    } else {
      console.warn('[Validate]', warnings.length, 'avisos. Ver editor para detalles.');
    }

    // 2.5. v1.5.8: Sistema de recuperación UI
    if (A.UIRecover) {
      A.UIRecover.installEscHandler();
      A.UIRecover.installWatchdog();
      console.log('[UIRecover] Listo. Triple ESC = recovery. window.Aventurs.UIRecover.run() para forzar.');
    }

    // 3. v3.0: cuentas. Si nadie entró en esta pestaña, primero la pantalla de entrar.
    if (A.Accounts) A.Accounts.resume();

    // 4. v3.3: la muerte la maneja js/systems/death.js (trampas, hambre y el dado
    // de rescate al caer en una pelea). Esta pantalla sale ahí.

    // 5. Montar vista raíz (entrar, crear personaje o jugar)
    enter();
    A.Bus.on('account:changed', enter);

    console.log('[Aventurs] Listo. Bus events:', A.Bus.debug());
  }

  /** v3.0: según la cuenta: la pantalla de entrar, o su partida. */
  function enter() {
    const app = document.getElementById('app');
    if (!app) return;
    if (A.Views.Shell && A.Views.Shell.unmount) A.Views.Shell.unmount();
    if (A.Views.Login && A.Views.Login.unmount) A.Views.Login.unmount();
    A.State.unload();
    if (A.Accounts && !A.Accounts.current()) {
      A.Views.Login.mount(app);
      return;
    }
    const loaded = A.State.load();
    console.log(loaded ? `[State] Partida cargada: ${A.State.player ? A.State.player.name : '(sin nombre)'}` : '[State] Sin partida guardada. Va al creador.');
    mountRoot();
  }

  function mountRoot() {
    const app = document.getElementById('app');
    if (!app) {
      console.error('[Aventurs] No se encontró #app en el DOM.');
      return;
    }
    if (A.State.hasGame()) {
      A.Views.Shell.mount(app);
      // v3.3: si tu héroe murió (y se recargó la página), vuelve la pantalla de muerte
      if (A.Death) setTimeout(() => A.Death.check(), 300);
    } else {
      A.Views.Character.mount(app);
    }
  }

  // Re-mount si la partida se resetea (por ejemplo desde el menú "Borrar todo")
  // En este flujo concreto se hace un location.reload() pero queda la opción.
  A.Bus.on('state:reset', mountRoot);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.Aventurs);
