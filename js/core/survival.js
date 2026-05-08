/* ============================================================
   Aventurs — Survival System
   v1.6.2

   Sistema de supervivencia: estados de hambre escalonados
   con consecuencias progresivas.

   Estados (definidos por % de food / maxFood):
     - sated       (>75%)    sin penalizaciones
     - normal      (50-75%)  sin penalizaciones
     - hungry      (25-50%)  -1 dodge, mensaje narrativo ocasional
     - weak        (5-25%)   -2 speed, -1 daño, no curarse pasivamente
     - starving    (0-5%)    -3 speed, -2 daño, -2 dodge, pierde HP
     - dying       (0% + HP en zona crítica) — se acerca a muerte

   API:
     A.Survival.getStatus()       - { id, label, color, penalties }
     A.Survival.applyTurnTick()   - llamado tras una acción larga
     A.Survival.shouldShowWarning() - si toca mostrar mensaje
     A.Survival.getStatPenalty(stat) - 0..N para deducir
     A.Survival.deathByStarvation()  - dispara muerte específica
   ============================================================ */

(function (A) {
  'use strict';

  // Definición de estados (orden de mejor a peor)
  const STATES = [
    { id: 'sated', minPct: 75, label: 'Saciado', color: '#6b8e23', penalties: {} },
    { id: 'normal', minPct: 50, label: 'Normal', color: '#a0a89c', penalties: {} },
    { id: 'hungry', minPct: 25, label: 'Hambriento', color: '#c4a850', penalties: { dodge: 1 } },
    { id: 'weak', minPct: 5, label: 'Débil', color: '#c47830', penalties: { speed: 2, damage: 1, restPenalty: true } },
    { id: 'starving', minPct: 0, label: 'Inanición', color: '#8d2818', penalties: { speed: 3, damage: 2, dodge: 2, hpDrain: true, restPenalty: true } },
  ];

  function getPlayer() {
    return A.State && A.State.player;
  }

  /**
   * Devuelve el estado de hambre actual.
   */
  function getStatus() {
    const p = getPlayer();
    if (!p) return STATES[1];
    const pct = (p.food / p.maxFood) * 100;
    for (const s of STATES) {
      if (pct >= s.minPct) return s;
    }
    return STATES[STATES.length - 1];
  }

  /**
   * Devuelve el penalty aplicable a un stat por el estado actual.
   * Returns 0 si no hay penalty.
   */
  function getStatPenalty(stat) {
    const s = getStatus();
    return (s.penalties && s.penalties[stat]) || 0;
  }

  /**
   * Aplica el tick de hambre tras una acción larga (combate, descanso largo, viaje).
   * - Reduce food
   * - Si food=0 y player.hp > 1, drena HP
   * - Emite eventos para que UI se actualice
   */
  function applyTurnTick(reason) {
    const p = getPlayer();
    if (!p || p.hp <= 0) return;

    // Reducir food por la acción
    if (p.food > 0) {
      p.food -= 1;
      A.Bus.emit('player:food-changed', { food: p.food, max: p.maxFood });
    }

    // Aplicar daño por inanición
    const status = getStatus();
    if (status.penalties.hpDrain && p.food === 0) {
      const hpLost = 1;
      p.hp = Math.max(0, p.hp - hpLost);
      A.Bus.emit('player:hp-changed', { current: p.hp });
      A.State.addChronicle({
        type: 'note',
        text: `Estás muriéndote de hambre. Perdiste ${hpLost} de salud.`,
      });
      // Si llegó a 0, muerte por inanición
      if (p.hp <= 0) {
        deathByStarvation(reason);
        return;
      }
    } else if (status.id === 'weak' && Math.random() < 0.3) {
      // Mensajes narrativos ocasionales
      A.State.addChronicle({
        type: 'note',
        text: 'Te cuesta mantenerte en pie. Necesitás comer.',
      });
    } else if (status.id === 'hungry' && Math.random() < 0.15) {
      A.State.addChronicle({
        type: 'note',
        text: 'El estómago te suena. Mejor que comas algo pronto.',
      });
    }

    A.State.persist();
  }

  /**
   * Determina si toca mostrar warning visual al usuario.
   */
  function shouldShowWarning() {
    const s = getStatus();
    return s.id === 'weak' || s.id === 'starving';
  }

  /**
   * Muerte por inanición: dispara evento 'player:died-starvation'
   * con info de causa de muerte (no teleport al pueblo).
   */
  function deathByStarvation(lastReason) {
    const p = getPlayer();
    if (!p) return;
    const w = A.State.world;
    const region = w && w.regionId ? A.Data.getById('regions', w.regionId) : null;
    const day = (w && w.day) || 1;

    A.State.addChronicle({
      type: 'system',
      text: `${p.name} cayó por inanición en ${region ? region.name : 'el camino'}. Sobreviviste ${day} día${day > 1 ? 's' : ''}.`,
    });

    A.Bus.emit('player:died-starvation', {
      cause: 'starvation',
      regionId: w ? w.regionId : null,
      regionName: region ? region.name : 'el camino',
      day: day,
      level: p.level,
      lastReason,
    });
    // Disparar también el genérico player:died para handlers existentes
    A.Bus.emit('player:died', { cause: 'starvation' });
  }

  A.Survival = {
    STATES,
    getStatus,
    getStatPenalty,
    applyTurnTick,
    shouldShowWarning,
    deathByStarvation,
  };
})(window.Aventurs);
