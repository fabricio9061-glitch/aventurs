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

  const COLLECTIONS = ['regions', 'races', 'weapons', 'armors', 'items', 'enemies', 'spells', 'recipes', 'npcs', 'pets', 'bags'];

  const Data = {
    regions: [], races: [], weapons: [], armors: [], items: [],
    enemies: [], spells: [], recipes: [], npcs: [], pets: [], bags: [],

    init() {
      const overrides = Data._loadOverrides();
      const seed = A.Seed || {};

      // Logging para detectar pérdida de overrides
      const overrideCounts = {};
      for (const k of COLLECTIONS) {
        overrideCounts[k] = (overrides[k] || []).length;
      }
      const totalOverrides = Object.values(overrideCounts).reduce((a, b) => a + b, 0);

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
      if (totalOverrides > 0) {
        console.log('[Data] Overrides activos:', overrideCounts);
      }

      // v1.6.1: migración coinLoot → drop coin_copper
      // Cada enemigo con coinLoot:[min,max] se convierte en un drop:
      //   { itemId: 'coin_copper', qtyMin, qtyMax, chance: 1.0, source: 'auto' }
      // y coinLoot se elimina. Si el enemigo es del editor (override), se
      // persiste el cambio. Si es del seed, solo aplica en runtime.
      let migrated = 0;
      for (const en of Data.enemies) {
        if (!en.coinLoot) continue;
        if (!Array.isArray(en.coinLoot) || en.coinLoot.length < 2) continue;
        const [cMin, cMax] = en.coinLoot;
        if (cMax <= 0) { delete en.coinLoot; continue; }
        en.drops = en.drops || [];
        // No duplicar si ya existe un drop coin_copper migrado
        const hasCoin = en.drops.some((d) => d.itemId === 'coin_copper' && d._migratedFromCoinLoot);
        if (!hasCoin) {
          en.drops.push({
            itemId: 'coin_copper',
            qtyMin: cMin,
            qtyMax: cMax,
            chance: 1.0,
            source: 'auto',
            _migratedFromCoinLoot: true,
          });
          migrated++;
        }
        delete en.coinLoot;
      }

      // Persistir migración en overrides para enemigos editados (si tenían coinLoot)
      if (migrated > 0) {
        try {
          const ov = Data._loadOverrides();
          let ovChanged = false;
          for (const en of (ov.enemies || [])) {
            if (en.coinLoot) {
              const [cMin, cMax] = en.coinLoot;
              en.drops = en.drops || [];
              const hasCoin = en.drops.some((d) => d.itemId === 'coin_copper' && d._migratedFromCoinLoot);
              if (!hasCoin && cMax > 0) {
                en.drops.push({
                  itemId: 'coin_copper',
                  qtyMin: cMin,
                  qtyMax: cMax,
                  chance: 1.0,
                  source: 'auto',
                  _migratedFromCoinLoot: true,
                });
              }
              delete en.coinLoot;
              ovChanged = true;
            }
          }
          if (ovChanged) Data.saveOverrides(ov);
        } catch (e) { console.warn('[Data] Error persistiendo migración coinLoot:', e); }
        console.log(`[Data] Migrados ${migrated} enemigos: coinLoot → drops coin_copper`);
      }
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
