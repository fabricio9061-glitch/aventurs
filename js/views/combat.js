/* ============================================================
   Aventurs — View: Combat (placeholder Fase 2)
   La pantalla de combate llega en Fase 2 cuando se implementen
   los systems combat.js, npc.js, explore.js, etc.

   Por ahora la dejo como vista vacía que se puede invocar pero no se usa.
   ============================================================ */

(function (A) {
  'use strict';

  const CombatView = {
    mount(container) {
      container.innerHTML = `
        <section class="empty-card">
          <div class="empty-icon">⚔️</div>
          <div class="empty-title">El combate aún no está implementado</div>
          <div class="empty-text muted">
            Esta vista se activa en Fase 2, cuando empiece a haber encuentros y rondas por turno.
          </div>
        </section>
      `;
    },
    unmount() {},
  };

  A.Views = A.Views || {};
  A.Views.Combat = CombatView;
})(window.Aventurs);
