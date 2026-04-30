/* ============================================================
   Aventurs — Data
   Fuente de verdad del contenido del juego.

   Carga A.Seed.* (definidos en js/data/seed-*.js) y los mergea con
   los overrides del editor (localStorage:aventurs:content).

   Las vistas y systems leen siempre Data.regions, Data.weapons, etc.
   ============================================================ */

(function (A) {
  'use strict';

  const STORAGE_KEY = 'aventurs:content';

  const COLLECTIONS = ['regions', 'races', 'weapons', 'armors', 'items', 'enemies', 'spells', 'recipes', 'npcs', 'pets'];

  const Data = {
    regions: [], races: [], weapons: [], armors: [], items: [],
    enemies: [], spells: [], recipes: [], npcs: [], pets: [],

    init() {
      const overrides = Data._loadOverrides();
      const seed = A.Seed || {};

      for (const key of COLLECTIONS) {
        const seedList = (seed[key] || []).map((e) => ({ ...e, _source: 'seed' }));
        const overrideList = (overrides[key] || []).map((e) => ({ ...e, _source: 'editor' }));

        // Override por id: si el editor edita un id del seed, gana el editor.
        const byId = new Map();
        for (const e of seedList) byId.set(e.id, e);
        for (const e of overrideList) byId.set(e.id, e);

        // Items eliminados desde el editor se marcan en overrides._deleted[key]
        const deleted = new Set((overrides._deleted && overrides._deleted[key]) || []);
        for (const id of deleted) byId.delete(id);

        Data[key] = [...byId.values()];
      }

      console.log('[Data] Inicializado. Counts:', Data._counts());
    },

    /**
     * Devuelve una entidad por id desde la colección indicada.
     */
    getById(collection, id) {
      const list = Data[collection];
      if (!list) return null;
      return list.find((e) => e.id === id) || null;
    },

    /**
     * Devuelve todas las entidades de una colección filtradas por predicado.
     */
    where(collection, fn) {
      const list = Data[collection] || [];
      return list.filter(fn);
    },

    /**
     * Devuelve enemigos que pueden aparecer en una región.
     * Filtra por:
     *   - regions[] del enemigo incluye la regionId
     *   - el tier del enemigo está dentro del rango de la región
     */
    enemiesInRegion(regionId) {
      const region = Data.getById('regions', regionId);
      if (!region) return [];
      const [tMin, tMax] = region.tier || [1, 1];
      return Data.enemies.filter((e) => {
        const inRegion = (e.regions || []).includes(regionId);
        const tierOk = e.tier >= tMin && e.tier <= tMax;
        return inRegion && tierOk;
      });
    },

    /**
     * Devuelve NPCs que viven en una región.
     */
    npcsInRegion(regionId) {
      return Data.npcs.filter((n) => n.region === regionId);
    },

    /**
     * Persiste overrides del editor.
     */
    saveOverrides(overrides) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
      } catch (err) {
        console.error('[Data] No se pudo guardar overrides:', err);
      }
    },

    /**
     * Devuelve los overrides actuales (para que el editor los maneje).
     */
    getOverrides() {
      return Data._loadOverrides();
    },

    _loadOverrides() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch (err) {
        console.warn('[Data] Overrides corruptos, ignorados:', err);
        return {};
      }
    },

    _counts() {
      const out = {};
      for (const k of COLLECTIONS) out[k] = Data[k].length;
      return out;
    },

    COLLECTIONS,
  };

  A.Data = Data;
})(window.Aventurs);
