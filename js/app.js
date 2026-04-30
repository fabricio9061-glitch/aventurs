/* ============================================================
   Aventurs — App
   Bootstrap: inicializa Data, valida, carga State, monta vista raíz.

   Si hay partida guardada -> Shell.
   Si no -> Character (creador).
   ============================================================ */

(function (A) {
  'use strict';

  function boot() {
    console.log('[Aventurs] Booting v1.0.0 — Fase 1');

    // 1. Cargar contenido del juego (seeds + overrides del editor)
    A.Data.init();

    // 2. Validar coherencia
    const warnings = A.Validate.run();
    if (warnings.length === 0) {
      console.log('[Validate] Sin avisos.');
    } else {
      console.warn('[Validate]', warnings.length, 'avisos. Ver editor para detalles.');
    }

    // 3. Cargar partida si existe
    const loaded = A.State.load();
    if (loaded) {
      console.log('[State] Partida cargada:', A.State.player ? A.State.player.name : '(sin nombre)');
    } else {
      console.log('[State] Sin partida guardada. Va al creador.');
    }

    // 4. Game over handling
    A.Bus.on('player:died', () => {
      // En Fase 2 implementamos pantalla de game over.
      // Por ahora, una alerta simple y reset.
      setTimeout(() => {
        if (confirm('Has caído en combate. ¿Empezar una nueva aventura?')) {
          A.State.reset();
          mountRoot();
        }
      }, 100);
    });

    // 5. Montar vista raíz
    mountRoot();

    console.log('[Aventurs] Listo. Bus events:', A.Bus.debug());
  }

  function mountRoot() {
    const app = document.getElementById('app');
    if (!app) {
      console.error('[Aventurs] No se encontró #app en el DOM.');
      return;
    }
    if (A.State.hasGame()) {
      A.Views.Shell.mount(app);
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
