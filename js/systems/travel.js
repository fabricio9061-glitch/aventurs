/* ============================================================
   Aventurs — Travel
   Sistema de viaje entre regiones.

   En Fase 1: viaje directo a regiones conectadas.
   En Fase 4: encuentros aleatorios al cruzar regiones de combate
   con `distance > 1`. Por ahora `distance` es solo descriptivo.
   ============================================================ */

(function (A) {
  'use strict';

  /**
   * ¿Puede el jugador viajar de currentId a targetId?
   * Solo si están conectados directamente.
   */
  function canTravelTo(targetId) {
    const w = A.State.world;
    if (!w) return false;
    const region = A.Data.getById('regions', w.regionId);
    if (!region) return false;
    return (region.connections || []).includes(targetId);
  }

  /**
   * Devuelve las regiones conectadas a la actual con info de cada una.
   */
  function neighbors() {
    const w = A.State.world;
    if (!w) return [];
    const region = A.Data.getById('regions', w.regionId);
    if (!region) return [];
    return (region.connections || [])
      .map((id) => A.Data.getById('regions', id))
      .filter(Boolean);
  }

  /**
   * Realiza el viaje. No requiere combate ni encuentros en Fase 1.
   */
  function travel(targetId) {
    if (!canTravelTo(targetId)) return false;
    A.State.setRegion(targetId);
    return true;
  }

  A.Travel = {
    canTravelTo,
    neighbors,
    travel,
  };
})(window.Aventurs);
