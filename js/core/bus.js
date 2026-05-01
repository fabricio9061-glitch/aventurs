/* ============================================================
   Aventurs — Bus
   Pub/sub global. Lista cerrada de eventos como contrato.

   EVENTOS DEFINIDOS (no usar otros sin agregarlos acá):

   state:loaded               - Save cargado al inicio
   state:saved                - Persistencia escrita
   state:reset                - Save borrado (nueva partida o borrar todo)

   player:created             - Personaje recién creado
   player:hp-changed          - { current, max, delta }
   player:mana-changed        - { current, max, delta }
   player:xp-changed          - { current, toNext }
   player:leveled             - { newLevel }
   player:died                - Game over

   inventory:changed          - Algo del inventario cambió
   inventory:equipped         - { slot, itemId }
   inventory:unequipped       - { slot, itemId }
   inventory:full             - Intento de agregar con inventario lleno

   bag:equipped               - { bagId }       Mochila cambiada

   currency:changed           - { copper, silver, gold }

   region:changed             - { fromId, toId }
   region:visited             - { regionId }

   travel:started             - { fromId, toId, totalSteps }
   travel:step                - { currentStep, totalSteps }
   travel:event               - { kind, payload }    Evento durante viaje
   travel:completed           - { fromId, toId }
   travel:cancelled           - { fromId }

   tame:attempt               - { enemyId, success, chance, roll }
   tame:success               - { petId, name }
   tame:failed                - { enemyId, reason?, chance?, roll? }
   tame:released              - { name }
   tame:lost                  - { name }     Mascota cayó en combate

   combat:started             - { enemyId }
   combat:turn                - { actor, turnNumber }
   combat:action              - { type, text }
   combat:ended               - { result, xp? }    result = 'victory'|'defeat'|'flee'

   combat:started             - { enemies }
   combat:turn                - { actor, turnNumber }
   combat:action              - { type, ... }
   combat:ended               - { result: 'win'|'flee'|'death', loot? }

   npc:opened                 - { npcId }
   npc:closed                 - { npcId }

   modal:open                 - { id, payload }
   modal:close                - { id }

   chronicle:added            - { entry }

   editor:content-changed     - { type, id }   tras crear/editar/borrar contenido
   editor:opened              - Editor montado
   editor:closed              - Editor desmontado

   view:changed               - { tab }   cambio de tab principal del juego
   ============================================================ */

(function (A) {
  'use strict';

  const handlers = new Map(); // event -> Set<fn>

  const Bus = {
    on(event, handler) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event).add(handler);
      return () => Bus.off(event, handler);
    },

    off(event, handler) {
      const set = handlers.get(event);
      if (set) set.delete(handler);
    },

    emit(event, payload) {
      const set = handlers.get(event);
      if (!set) return;
      // Copia para permitir off() durante emit sin romper iteración
      [...set].forEach((fn) => {
        try {
          fn(payload);
        } catch (err) {
          console.error(`[Bus] Handler error for "${event}":`, err);
        }
      });
    },

    /**
     * Quita todos los handlers de un evento o de todos los eventos.
     * Útil para tests y para reset entre vistas.
     */
    clear(event) {
      if (event) handlers.delete(event);
      else handlers.clear();
    },

    /**
     * Debug: listar eventos con suscriptores activos.
     */
    debug() {
      const out = {};
      for (const [event, set] of handlers) out[event] = set.size;
      return out;
    },
  };

  A.Bus = Bus;
})(window.Aventurs);
