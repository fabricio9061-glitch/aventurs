/* ============================================================
   Aventurs — UI Recovery v1
   v1.5.8

   Sistema de recuperación de estado UI sin recargar la página.
   Diagnostica y limpia overlays huérfanos, listeners colgados,
   modales sin cerrar, y restaura interacción del body.

   API:
     A.UIRecover.run()       - ejecuta recuperación completa
     A.UIRecover.diagnose()  - solo loguea estado, no modifica
     A.UIRecover.installEscHandler() - habilita ESC ESC ESC para recovery

   Trigger automático:
     - Triple tecla ESC (3 esc en menos de 1 segundo)
     - Llamada manual: window.Aventurs.UIRecover.run()
   ============================================================ */

(function (A) {
  'use strict';

  /**
   * Identificadores de overlays/modales conocidos en el sistema.
   * Si quedan en el DOM después de un flujo cerrado, los limpia.
   */
  const KNOWN_OVERLAY_IDS = [
    'modal-root',
    'modal-overlay',
    'audit-wizard-overlay',
    'graph-editor-overlay',
    'region-enemy-editor-overlay',
    'imported-modal',
  ];

  /**
   * Selectores de overlays que deberían tener un parent específico
   * para no quedar huérfanos en el body.
   */
  const ORPHAN_SELECTORS = [
    '.modal-overlay',
    '.audit-wizard-overlay',
  ];

  function diagnose() {
    const report = {
      timestamp: new Date().toISOString(),
      bodyPointerEvents: document.body.style.pointerEvents,
      bodyOverflow: document.body.style.overflow,
      activeElement: document.activeElement && document.activeElement.tagName,
      overlays: [],
      orphans: [],
      stateModal: A.State && A.State.modal ? A.State.modal.id : null,
      uiFlags: {},
    };

    // Buscar overlays conocidos en DOM
    for (const id of KNOWN_OVERLAY_IDS) {
      const el = document.getElementById(id);
      if (el) {
        report.overlays.push({
          id,
          visible: el.offsetParent !== null || el.style.display !== 'none',
          children: el.children.length,
          zIndex: el.style.zIndex || getComputedStyle(el).zIndex,
        });
      }
    }

    // Buscar overlays huérfanos por selector
    for (const sel of ORPHAN_SELECTORS) {
      document.querySelectorAll(sel).forEach((el) => {
        if (!KNOWN_OVERLAY_IDS.includes(el.id)) {
          report.orphans.push({
            selector: sel,
            id: el.id || '(sin id)',
            classes: el.className,
            children: el.children.length,
          });
        }
      });
    }

    // Flags conocidos en el state de UI
    if (A.State && A.State.ui) {
      report.uiFlags = {
        showMap: A.State.ui.showMap,
        activeTab: A.State.ui.activeTab,
      };
    }

    return report;
  }

  function logDiagnose() {
    const r = diagnose();
    console.group('[UIRecover] Diagnóstico');
    console.log('timestamp:', r.timestamp);
    console.log('body.pointerEvents:', r.bodyPointerEvents || '(default)');
    console.log('body.overflow:', r.bodyOverflow || '(default)');
    console.log('overlays detectados:', r.overlays);
    console.log('overlays huérfanos:', r.orphans);
    console.log('A.State.modal:', r.stateModal);
    console.log('A.State.ui flags:', r.uiFlags);
    console.groupEnd();
    return r;
  }

  function run({ silent = false } = {}) {
    if (!silent) {
      console.log('[UIRecover] Iniciando recuperación...');
    }

    const before = diagnose();
    let actions = 0;

    try {
      // 1. Cerrar modal del state si está abierto
      if (A.State && A.State.modal) {
        try { A.State.closeModal(); } catch (e) {}
        actions++;
      }

      // 2. Cerrar mapa si está abierto en el state
      if (A.State && A.State.ui && A.State.ui.showMap) {
        A.State.ui.showMap = false;
        try { A.Bus.emit('ui:map-toggle'); } catch (e) {}
        actions++;
      }

      // 3. Eliminar overlays conocidos del DOM
      for (const id of KNOWN_OVERLAY_IDS) {
        const el = document.getElementById(id);
        if (el && el.id !== 'modal-root') {
          // modal-root es persistente, solo limpiar contenido
          el.remove();
          actions++;
        } else if (el && el.id === 'modal-root') {
          // Limpiar contenido del modal-root
          if (el.children.length > 0) {
            el.innerHTML = '';
            actions++;
          }
        }
      }

      // 4. Eliminar overlays huérfanos por selector
      for (const sel of ORPHAN_SELECTORS) {
        document.querySelectorAll(sel).forEach((el) => {
          el.remove();
          actions++;
        });
      }

      // 5. Restaurar pointer-events y overflow del body
      if (document.body.style.pointerEvents) {
        document.body.style.pointerEvents = '';
        actions++;
      }
      if (document.body.style.overflow === 'hidden') {
        document.body.style.overflow = '';
        actions++;
      }

      // 6. Cerrar combat si está colgado (estado intermedio)
      if (A.State && A.State.combat && A.State.combat.phase === 'closed') {
        A.State.combat = null;
        actions++;
      }

      // 7. Cancelar viaje si está colgado sin progreso
      if (A.State && A.State.world && A.State.world.traveling) {
        const t = A.State.world.traveling;
        const stuck = t.startedAt && (Date.now() - t.startedAt > 60000);
        if (stuck) {
          A.State.world.traveling = null;
          actions++;
        }
      }

      // 8. Emitir event de re-render para forzar refresh
      try {
        A.Bus.emit('ui:force-recover');
        A.Bus.emit('view:changed');
      } catch (e) {}

    } catch (err) {
      console.error('[UIRecover] Error durante recuperación:', err);
    }

    if (!silent) {
      console.log(`[UIRecover] Recuperación completa. Acciones: ${actions}`);
      if (actions === 0) {
        console.log('[UIRecover] No se detectaron problemas. Estado limpio.');
      }
    }

    return { before, actions };
  }

  /**
   * Triple ESC: presiona 3 veces ESC en menos de 1 segundo.
   */
  let escPresses = [];
  function installEscHandler() {
    document.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape') return;
      const now = Date.now();
      escPresses.push(now);
      // Limpiar presses viejos (>1 segundo)
      escPresses = escPresses.filter((t) => now - t < 1000);
      if (escPresses.length >= 3) {
        escPresses = [];
        console.warn('[UIRecover] Triple ESC detectado — ejecutando recovery');
        run();
      }
    }, true);
  }

  /**
   * Watchdog: detecta si la app se quedó "trabada" (sin eventos del usuario
   * por mucho tiempo después de una transición). En la práctica solo loguea.
   */
  let lastUserEvent = Date.now();
  function installWatchdog() {
    const events = ['click', 'keydown', 'pointerdown', 'wheel'];
    for (const ev of events) {
      document.addEventListener(ev, () => { lastUserEvent = Date.now(); }, true);
    }
    // No interferimos con la app, solo logueamos cada 30s si hay overlay sospechoso
    setInterval(() => {
      const r = diagnose();
      if (r.orphans.length > 0) {
        console.warn('[UIRecover] Watchdog: detectados overlays huérfanos', r.orphans);
      }
    }, 30000);
  }

  A.UIRecover = {
    run,
    diagnose: logDiagnose,
    installEscHandler,
    installWatchdog,
  };
})(window.Aventurs);
