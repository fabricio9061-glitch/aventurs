/* ============================================================
   Aventurs — Time System v1
   v1.5.9

   Sistema de tiempo basado en acciones (no tiempo real).
   Cada acción del jugador avanza el tiempo:
     - Explorar:   1 unidad
     - Combatir:   1 unidad
     - Craftear:   1 unidad
     - Viajar:     2 unidades
     - Descansar:  avanza hasta el día siguiente (a la mañana)

   Estados:
     - day (mañana / tarde) - 0-9 unidades
     - night (noche)         - 10-19 unidades
     - dawn (al pasar 20)    - +1 día, vuelve a day:0

   API:
     A.Time.advance(units, reason)  - avanza el tiempo
     A.Time.isDay()                 - boolean
     A.Time.isNight()               - boolean
     A.Time.canRest()               - solo de noche
     A.Time.passTo(timeOfDay)       - salta directo a 'day' o 'night'
     A.Time.format()                - 'Día 3, mediodía' / 'Día 4, noche'

   Eventos:
     time:advanced   - cualquier avance
     time:phase-changed - cambió de día a noche o viceversa
     time:day-changed - empezó nuevo día
   ============================================================ */

(function (A) {
  'use strict';

  const DAY_DURATION = 10;   // 0-9 = día
  const NIGHT_DURATION = 10; // 10-19 = noche
  const FULL_CYCLE = DAY_DURATION + NIGHT_DURATION;

  function getWorld() {
    return A.State && A.State.world;
  }

  function ensureFields() {
    const w = getWorld();
    if (!w) return null;
    if (typeof w.timeOfDay === 'undefined') w.timeOfDay = 'day';
    if (typeof w.day === 'undefined') w.day = 1;
    if (typeof w.timeProgress === 'undefined') w.timeProgress = 0;
    return w;
  }

  /**
   * Avanza el tiempo en N unidades. Si cruza el ciclo cambia phase/día.
   */
  function advance(units, reason) {
    const w = ensureFields();
    if (!w) return;
    units = Math.max(0, units || 1);

    const prevPhase = w.timeOfDay;
    const prevDay = w.day;

    w.timeProgress = (w.timeProgress || 0) + units;

    // Normalizar: si pasó del ciclo completo, sumar días
    while (w.timeProgress >= FULL_CYCLE) {
      w.timeProgress -= FULL_CYCLE;
      w.day = (w.day || 1) + 1;
    }

    // Determinar fase actual según progress
    if (w.timeProgress < DAY_DURATION) {
      w.timeOfDay = 'day';
    } else {
      w.timeOfDay = 'night';
    }

    // Eventos
    A.Bus.emit('time:advanced', { units, reason, world: w });

    if (w.timeOfDay !== prevPhase) {
      A.Bus.emit('time:phase-changed', { from: prevPhase, to: w.timeOfDay, world: w });
      // Crónica
      const text = w.timeOfDay === 'night'
        ? `Cae la noche en ${getRegionName()}.`
        : `Amanece un nuevo día en ${getRegionName()}.`;
      try { A.State.addChronicle({ type: 'system', text }); } catch (e) {}
    }

    if (w.day !== prevDay) {
      A.Bus.emit('time:day-changed', { from: prevDay, to: w.day, world: w });
    }

    if (A.State && typeof A.State.persist === 'function') {
      try { A.State.persist(); } catch (e) {}
    }
  }

  /**
   * Salta directo a una fase del día actual (ej: descansar hasta el día).
   */
  function passTo(targetPhase) {
    const w = ensureFields();
    if (!w) return;
    if (targetPhase === 'day' && w.timeOfDay === 'night') {
      // Avanzar hasta entrar en day del siguiente día
      const remaining = FULL_CYCLE - w.timeProgress;
      advance(remaining, 'rest');
    } else if (targetPhase === 'night' && w.timeOfDay === 'day') {
      const remaining = DAY_DURATION - w.timeProgress;
      advance(remaining, 'wait');
    }
  }

  function isDay() {
    const w = ensureFields();
    return w && w.timeOfDay === 'day';
  }

  function isNight() {
    const w = ensureFields();
    return w && w.timeOfDay === 'night';
  }

  function canRest() {
    return isNight();
  }

  function format() {
    const w = ensureFields();
    if (!w) return '';
    const phaseLabel = w.timeOfDay === 'day' ? 'día' : 'noche';
    return `Día ${w.day}, ${phaseLabel}`;
  }

  function icon() {
    const w = ensureFields();
    if (!w) return '☀️';
    if (w.timeOfDay === 'night') return '🌙';
    // Subdividir el día en 3 visuales
    if (w.timeProgress < 3) return '🌅'; // mañana
    if (w.timeProgress < 7) return '☀️'; // mediodía
    return '🌇'; // tarde
  }

  function getRegionName() {
    const w = getWorld();
    if (!w || !w.regionId) return 'el mundo';
    const r = A.Data && A.Data.getById('regions', w.regionId);
    return r ? r.name : 'el mundo';
  }

  A.Time = {
    advance,
    passTo,
    isDay,
    isNight,
    canRest,
    format,
    icon,
    DAY_DURATION,
    NIGHT_DURATION,
    FULL_CYCLE,
  };
})(window.Aventurs);
