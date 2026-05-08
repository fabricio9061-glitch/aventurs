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

    // 2.5. v1.5.8: Sistema de recuperación UI
    if (A.UIRecover) {
      A.UIRecover.installEscHandler();
      A.UIRecover.installWatchdog();
      console.log('[UIRecover] Listo. Triple ESC = recovery. window.Aventurs.UIRecover.run() para forzar.');
    }

    // 3. Cargar partida si existe
    const loaded = A.State.load();
    if (loaded) {
      console.log('[State] Partida cargada:', A.State.player ? A.State.player.name : '(sin nombre)');
    } else {
      console.log('[State] Sin partida guardada. Va al creador.');
    }

    // 4. Game over handling
    A.Bus.on('player:died', (payload) => {
      // v1.6.2: si fue muerte específica por inanición, mostrar pantalla narrativa
      if (payload && payload.cause === 'starvation') {
        // El handler 'player:died-starvation' renderiza la pantalla
        return;
      }
      setTimeout(() => {
        if (confirm('Has caído en combate. ¿Empezar una nueva aventura?')) {
          A.State.reset();
          mountRoot();
        }
      }, 100);
    });

    // v1.6.2: pantalla narrativa de muerte por inanición
    A.Bus.on('player:died-starvation', (payload) => {
      setTimeout(() => {
        showStarvationDeathScreen(payload);
      }, 200);
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

  /**
   * v1.6.2: Pantalla narrativa de muerte por inanición.
   * No teleport, muestra info: lugar, días sobrevividos, opción reaparecer.
   */
  function showStarvationDeathScreen(info) {
    // Limpiar overlays existentes
    document.querySelectorAll('.modal-overlay, .death-overlay').forEach((el) => el.remove());

    const overlay = document.createElement('div');
    overlay.className = 'death-overlay';
    overlay.innerHTML = `
      <div class="death-screen">
        <div class="death-icon">💀</div>
        <h1 class="death-title">Caíste por inanición</h1>
        <div class="death-narrative">
          <p>El hambre te consumió. No volviste a levantarte.</p>
        </div>
        <div class="death-stats">
          <div class="death-stat">
            <div class="death-stat-label">Lugar de muerte</div>
            <div class="death-stat-val">${A.Utils.escapeHtml(info.regionName || 'el camino')}</div>
          </div>
          <div class="death-stat">
            <div class="death-stat-label">Días sobrevividos</div>
            <div class="death-stat-val">${info.day || 1}</div>
          </div>
          <div class="death-stat">
            <div class="death-stat-label">Nivel alcanzado</div>
            <div class="death-stat-val">${info.level || 1}</div>
          </div>
          <div class="death-stat">
            <div class="death-stat-label">Causa</div>
            <div class="death-stat-val">Inanición</div>
          </div>
        </div>
        <div class="death-actions">
          <button class="btn-primary death-btn" data-death-action="restart">Empezar nueva aventura</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-death-action="restart"]').addEventListener('click', () => {
      overlay.remove();
      A.State.reset();
      mountRoot();
    });
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
