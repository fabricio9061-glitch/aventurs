/* ============================================================
   Aventurs — Time System v2
   v1.6.1

   Sistema de tiempo basado en acciones (no tiempo real).
   4 fases del día con tonos visuales distintos.

   Ciclo de 20 unidades:
     0-4   morning    🌅 (tonos cálidos claros)
     5-9   afternoon  ☀️ (dorado claro)
     10-14 night      🌙 (azul oscuro)
     15-19 dawn       🌌 (violeta tenue)

   API:
     A.Time.advance(units, reason)
     A.Time.isDay()    - morning o afternoon
     A.Time.isNight()  - night o dawn
     A.Time.canRest()  - solo en night o dawn
     A.Time.passTo(phase)  - salta directo a una fase
     A.Time.format()       - "Día 3 · Atardecer"
     A.Time.icon()         - icono según fase
     A.Time.colorTheme()   - { bg, accent } colores temáticos
     A.Time.phaseLabel()   - 'Mañana', 'Tarde', 'Noche', 'Madrugada'

   Eventos:
     time:advanced
     time:phase-changed
     time:day-changed
   ============================================================ */

(function (A) {
  'use strict';

  // 4 fases × 5 unidades cada una = 20 unidades por día completo
  const PHASE_DURATION = 5;
  const FULL_CYCLE = PHASE_DURATION * 4; // 20

  // Definición de fases
  const PHASES = [
    { id: 'morning',   start: 0,  end: 4,  label: 'Mañana',    icon: '🌅',
      bg: '#fff5e0', accent: '#d4a437', textColor: '#5a3a10' },
    { id: 'afternoon', start: 5,  end: 9,  label: 'Tarde',     icon: '☀️',
      bg: '#fff1c4', accent: '#c8862e', textColor: '#5a3a10' },
    { id: 'night',     start: 10, end: 14, label: 'Noche',     icon: '🌙',
      bg: '#1a2438', accent: '#8da7d6', textColor: '#dde6f5' },
    { id: 'dawn',      start: 15, end: 19, label: 'Madrugada', icon: '🌌',
      bg: '#2a1a3a', accent: '#a88dd6', textColor: '#e6dde6' },
  ];

  function getWorld() {
    return A.State && A.State.world;
  }

  function getPhaseByProgress(p) {
    if (p < 5) return PHASES[0];
    if (p < 10) return PHASES[1];
    if (p < 15) return PHASES[2];
    return PHASES[3];
  }

  function ensureFields() {
    const w = getWorld();
    if (!w) return null;
    if (typeof w.timeProgress === 'undefined') w.timeProgress = 0;
    if (typeof w.day === 'undefined') w.day = 1;
    // Migrar 'timeOfDay' (v1.5.9 v1) -> phase (v1.6.1 v2)
    if (typeof w.phase === 'undefined') {
      if (w.timeOfDay === 'night') w.phase = 'night';
      else w.phase = 'morning';
    }
    return w;
  }

  function syncPhase(w) {
    const p = getPhaseByProgress(w.timeProgress);
    w.phase = p.id;
    w.timeOfDay = (p.id === 'morning' || p.id === 'afternoon') ? 'day' : 'night';
  }

  function advance(units, reason) {
    const w = ensureFields();
    if (!w) return;
    units = Math.max(0, units || 1);

    const prevPhase = w.phase;
    const prevDay = w.day;

    w.timeProgress = (w.timeProgress || 0) + units;

    while (w.timeProgress >= FULL_CYCLE) {
      w.timeProgress -= FULL_CYCLE;
      w.day = (w.day || 1) + 1;
    }

    syncPhase(w);

    A.Bus.emit('time:advanced', { units, reason, world: w });

    if (w.phase !== prevPhase) {
      A.Bus.emit('time:phase-changed', { from: prevPhase, to: w.phase, world: w });
      // Crónica solo en transiciones notables (noche / mañana)
      if (w.phase === 'night' && prevPhase !== 'night') {
        try { A.State.addChronicle({ type: 'system', text: `Cae la noche en ${getRegionName()}.` }); } catch (e) {}
      } else if (w.phase === 'morning' && prevPhase !== 'morning') {
        try { A.State.addChronicle({ type: 'system', text: `Amanece un nuevo día en ${getRegionName()}.` }); } catch (e) {}
      }
    }

    if (w.day !== prevDay) {
      A.Bus.emit('time:day-changed', { from: prevDay, to: w.day, world: w });
    }

    if (A.State && typeof A.State.persist === 'function') {
      try { A.State.persist(); } catch (e) {}
    }
  }

  /**
   * Salta a una fase específica del día actual o siguiente.
   */
  function passTo(targetPhase) {
    const w = ensureFields();
    if (!w) return;
    const target = PHASES.find((p) => p.id === targetPhase);
    if (!target) return;
    const current = getPhaseByProgress(w.timeProgress);
    if (current.id === targetPhase) return;

    let advanceUnits;
    if (target.start > w.timeProgress) {
      advanceUnits = target.start - w.timeProgress;
    } else {
      advanceUnits = (FULL_CYCLE - w.timeProgress) + target.start;
    }
    advance(advanceUnits, 'pass-to:' + targetPhase);
  }

  function isDay() {
    const w = ensureFields();
    if (!w) return true;
    return w.phase === 'morning' || w.phase === 'afternoon';
  }

  function isNight() {
    const w = ensureFields();
    if (!w) return false;
    return w.phase === 'night' || w.phase === 'dawn';
  }

  function canRest() {
    return isNight();
  }

  function currentPhase() {
    const w = ensureFields();
    if (!w) return PHASES[0];
    return PHASES.find((p) => p.id === w.phase) || PHASES[0];
  }

  function format() {
    const w = ensureFields();
    if (!w) return '';
    const p = currentPhase();
    return `Día ${w.day} · ${p.label}`;
  }

  function icon() {
    return currentPhase().icon;
  }

  function phaseLabel() {
    return currentPhase().label;
  }

  function colorTheme() {
    const p = currentPhase();
    return { bg: p.bg, accent: p.accent, textColor: p.textColor, phase: p.id };
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
    currentPhase,
    format,
    icon,
    phaseLabel,
    colorTheme,
    PHASES,
    PHASE_DURATION,
    FULL_CYCLE,
  };
})(window.Aventurs);
