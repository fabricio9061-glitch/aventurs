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

   v3.0 (cuentas y grupo):
   account:changed            - { user }   entró o salió una cuenta
   party:changed              - { }        cambió el grupo (alguien entró, salió, se separó)
   party:status               - { text }   aviso corto del grupo (conectando, error...)
   ============================================================ */

(function (A) {
  'use strict';

  const handlers = new Map(); // event -> Set<fn>

  // v3.0: mientras se juega el turno del COMPAÑERO (en la compu del anfitrión), los
  // eventos de pantalla esperan a que vuelva el héroe propio: así la ficha y el
  // combate nunca se dibujan con los datos del otro. Los oyentes de sistema
  // (misiones, descanso) se marcan con { sys: true } y responden en el acto.
  let deferDepth = 0;
  let deferred = [];
  // Eventos que no tienen sentido para la pantalla propia si los generó el compañero
  const DROP_FOREIGN = new Set(['player:died', 'player:died-starvation']);

  function call(fn, event, payload) {
    try {
      fn(payload);
    } catch (err) {
      console.error(`[Bus] Handler error for "${event}":`, err);
    }
  }

  const Bus = {
    /** opts.sys: oyente de sistema (responde aunque se esté jugando el turno del compañero). */
    on(event, handler, opts) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      if (opts && opts.sys) handler._sys = true;
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
      for (const fn of [...set]) {
        if (deferDepth > 0 && !fn._sys) {
          if (!DROP_FOREIGN.has(event)) deferred.push([fn, event, payload]);
          continue;
        }
        call(fn, event, payload);
      }
    },

    /** v3.0: solo los oyentes de pantalla (el invitado redibuja lo que le manda el anfitrión). */
    emitView(event, payload) {
      const set = handlers.get(event);
      if (!set) return;
      for (const fn of [...set]) if (!fn._sys) call(fn, event, payload);
    },

    /** v3.0: empieza/termina un tramo con los eventos de pantalla en espera. */
    beginDefer() { deferDepth += 1; },
    endDefer() {
      deferDepth = Math.max(0, deferDepth - 1);
      if (deferDepth > 0 || !deferred.length) return;
      const list = deferred;
      deferred = [];
      for (const [fn, event, payload] of list) {
        // si el oyente se dio de baja mientras esperaba, no se llama
        const set = handlers.get(event);
        if (set && set.has(fn)) call(fn, event, payload);
      }
    },
    isDeferring() { return deferDepth > 0; },

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
