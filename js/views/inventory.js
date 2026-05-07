/* ============================================================
   Aventurs — View: Inventory (placeholder v1.2.0)

   En v1.2.0 el inventario completo vive en el sidebar derecho como
   grid (todos los slots según mochila equipada). Ya no es una tab.

   Este archivo se mantiene para compatibilidad por si algo viejo
   intenta llamar A.Views.Inventory.mount.
   ============================================================ */

(function (A) {
  'use strict';

  A.Views = A.Views || {};
  A.Views.Inventory = {
    mount(container) {
      container.innerHTML = `<div class="empty-tab muted">El inventario ahora se ve en el panel derecho.</div>`;
    },
    unmount() {},
  };
})(window.Aventurs);
