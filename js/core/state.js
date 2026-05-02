/* ============================================================
   Aventurs — State
   Estado de la partida actual + persistencia.

   Estructura:
     player     - { name, raceId, level, xp, hp, maxHp, mana, maxMana,
                    hasMagic, bagId, pet,
                    stats: {speed, precision, armor, damage, dodge},
                    equipment: {weapon, armor},
                    inventory: [{itemId, qty}],
                    coins: {copper, silver, gold},
                    spells: [spellId] }
     world      - { regionId, visited:[regionId], npcsTalked:[npcId] }
     combat     - null o { ... } (Fase 2)
     traveling  - null o { fromId, toId, totalSteps, currentStep, events, completed }
     ui         - { activeTab, openModal, modalPayload }
     chronicles - [{ ts, type, text, regionId }]
   ============================================================ */

(function (A) {
  'use strict';

  const STORAGE_KEY = 'aventurs:save';
  const DEFAULT_BAG_ID = 'bag_basic';

  const State = {
    player: null,
    world: null,
    combat: null,
    traveling: null,
    ui: { activeTab: 'world', openModal: null, modalPayload: null, showMap: false },
    chronicles: [],

    // ---------- Lifecycle ----------

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        const player = data.player || null;
        // v1.5.0: cambio mayor en estructura (monedas, food, armadura). Si el save
        // es anterior, forzamos reset y avisamos.
        if (player && (!player.schemaVersion || player.schemaVersion < 15)) {
          console.log('[State] Save pre-v1.5.0 detectado. Reseteando para evitar incompatibilidades.');
          State._pendingMigrationNotice = true;
          try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
          return false;
        }
        State.player = player;
        State.world = data.world || null;
        State.combat = null;
        State.traveling = data.traveling || null;
        State.ui = data.ui || { activeTab: 'world', openModal: null, modalPayload: null };
        State.chronicles = data.chronicles || [];
        State._migrate();
        A.Bus.emit('state:loaded');
        return true;
      } catch (err) {
        console.warn('[State] Save corrupto, ignorado:', err);
        return false;
      }
    },

    /**
     * Migración silenciosa de saves anteriores a la estructura nueva.
     */
    _migrate() {
      const p = State.player;
      if (!p) return;
      let dirty = false;
      const fromVersion = p.schemaVersion || 0;

      if (p.hasMagic === undefined) {
        p.hasMagic = A.Seed.rollMagicForRace(p.raceId);
        if (!p.hasMagic) { p.mana = 0; p.maxMana = 0; }
        dirty = true;
      }
      if (!p.bagId) { p.bagId = 'bag_basic'; dirty = true; }
      // v1.5.1: bag_starter eliminada, se reemplaza por bag_basic
      if (p.bagId === 'bag_starter') { p.bagId = 'bag_basic'; dirty = true; }
      if (p.pet === undefined) { p.pet = null; dirty = true; }
      if (!p.spells) { p.spells = []; dirty = true; }

      // v15: monedas pasan a items en inventario
      if (fromVersion < 15) {
        if (p.coins && (p.coins.copper || p.coins.silver || p.coins.gold)) {
          // Convertir player.coins a items
          const totalCopper = (p.coins.copper || 0)
                            + (p.coins.silver || 0) * 100
                            + (p.coins.gold || 0) * 10000;
          // Limpiar monedas previas en inventario por si las hay
          p.inventory = (p.inventory || []).filter((s) =>
            !['coin_copper', 'coin_silver', 'coin_gold'].includes(s.itemId)
          );
          // Distribuir el total como items
          if (totalCopper > 0) {
            const gold = Math.floor(totalCopper / 10000);
            let rest = totalCopper - gold * 10000;
            const silver = Math.floor(rest / 100);
            const copper = rest - silver * 100;
            if (gold > 0) p.inventory.push({ itemId: 'coin_gold', qty: gold });
            if (silver > 0) p.inventory.push({ itemId: 'coin_silver', qty: silver });
            if (copper > 0) p.inventory.push({ itemId: 'coin_copper', qty: copper });
          }
          delete p.coins;
        }
        // food / maxFood
        if (p.food === undefined) p.food = 20;
        if (p.maxFood === undefined) p.maxFood = 20;
        // contador de encuentros por región
        if (!p.regionEncounters) p.regionEncounters = {};
        dirty = true;
      }

      // v1.5.5b: effects y failedTames
      if (!p.effects) { p.effects = []; dirty = true; }
      if (!p.failedTames) { p.failedTames = []; dirty = true; }

      if (!p.schemaVersion || p.schemaVersion < 15) {
        p.schemaVersion = 15;
        dirty = true;
      }
      if (dirty) {
        State.persist();
        console.log('[State] Save migrado a estructura v1.5.0');
      }
    },

    persist() {
      try {
        const data = {
          player: State.player,
          world: State.world,
          traveling: State.traveling,
          ui: State.ui,
          chronicles: State.chronicles,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        A.Bus.emit('state:saved');
      } catch (err) {
        console.error('[State] No se pudo guardar:', err);
      }
    },

    reset() {
      State.player = null;
      State.world = null;
      State.combat = null;
      State.traveling = null;
      State.ui = { activeTab: 'world', openModal: null, modalPayload: null, showMap: false };
      State.chronicles = [];
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      A.Bus.emit('state:reset');
    },

    hasGame() {
      return !!State.player;
    },

    // ---------- Crear personaje ----------

    /**
     * Crea el personaje y lo coloca en pueblo_inicial.
     */
    createCharacter({ name, raceId }) {
      const stats = A.Seed.statsForRace(raceId);
      if (!stats) throw new Error('Raza inválida: ' + raceId);

      const hasMagic = A.Seed.rollMagicForRace(raceId);

      State.player = {
        name: (name || 'Aventurero').trim().slice(0, 24),
        raceId,
        level: 1,
        xp: 0,
        hp: stats.maxHp,
        maxHp: stats.maxHp,
        mana: hasMagic ? stats.maxMana : 0,
        maxMana: hasMagic ? stats.maxMana : 0,
        food: 20,
        maxFood: 20,
        hasMagic,
        bagId: DEFAULT_BAG_ID,
        pet: null,
        regionEncounters: {}, // { regionId: count }
        effects: [],            // efectos de estado activos en combate
        failedTames: [],        // ids de enemigos cuya domesticación ya falló
        stats: {
          speed: stats.speed,
          precision: stats.precision,
          armor: stats.armor,
          damage: stats.damage,
          dodge: stats.dodge,
        },
        equipment: { weapon: null, armor: null },
        inventory: [
          { itemId: 'pocion_curacion_menor', qty: 2 },
          { itemId: 'pan', qty: 2 },
          { itemId: 'carne_cruda', qty: 2 },
          { itemId: 'coin_copper', qty: 50 }, // 50 cobre inicial
        ],
        spells: [],
        schemaVersion: 15,
      };

      State.world = {
        regionId: 'pueblo_inicial',
        visited: ['pueblo_inicial'],
        npcsTalked: [],
      };

      State.traveling = null;
      State.ui = { activeTab: 'world', openModal: null, modalPayload: null, showMap: false };
      State.chronicles = [];
      const magicNote = hasMagic ? ' Sentís el zumbido del maná en las venas.' : '';
      State.addChronicle({ type: 'system', text: `${State.player.name} comienza su aventura en el Pueblo Inicial.${magicNote}` });

      A.Bus.emit('player:created', { player: State.player });
      State.persist();
    },

    // ---------- Mutators de jugador ----------

    setHp(amount) {
      if (!State.player) return;
      const before = State.player.hp;
      State.player.hp = A.Utils.clamp(amount, 0, State.player.maxHp);
      A.Bus.emit('player:hp-changed', {
        current: State.player.hp,
        max: State.player.maxHp,
        delta: State.player.hp - before,
      });
      if (State.player.hp <= 0) A.Bus.emit('player:died');
    },

    healHp(amount) {
      if (!State.player) return;
      State.setHp(State.player.hp + amount);
    },

    damagePlayer(amount) {
      if (!State.player) return;
      State.setHp(State.player.hp - amount);
    },

    setMana(amount) {
      if (!State.player) return;
      const before = State.player.mana;
      State.player.mana = A.Utils.clamp(amount, 0, State.player.maxMana);
      A.Bus.emit('player:mana-changed', {
        current: State.player.mana,
        max: State.player.maxMana,
        delta: State.player.mana - before,
      });
    },

    fullRest() {
      if (!State.player) return;
      State.setHp(State.player.maxHp);
      State.setMana(State.player.maxMana);
    },

    // ---------- Travel ----------

    setRegion(regionId) {
      if (!State.world) return;
      const fromId = State.world.regionId;
      State.world.regionId = regionId;
      if (!State.world.visited.includes(regionId)) {
        State.world.visited.push(regionId);
        A.Bus.emit('region:visited', { regionId });
      }
      A.Bus.emit('region:changed', { fromId, toId: regionId });
      const region = A.Data.getById('regions', regionId);
      State.addChronicle({
        type: 'travel',
        text: `Llegaste a ${region ? region.name : regionId}.`,
        regionId,
      });
      State.persist();
    },

    // ---------- Inventario ----------

    /**
     * Devuelve cuántos slots ocupa un item dado (1 por default, 2 para items voluminosos).
     * Las monedas no ocupan slots (se manejan aparte).
     */
    itemSlots(itemId) {
      const item = A.Data.getById('items', itemId)
                || A.Data.getById('weapons', itemId)
                || A.Data.getById('armors', itemId);
      if (!item) return 0;
      if (item.subtype === 'coin') return 0;
      return item.slots || 1;
    },

    inventoryUsedSlots() {
      if (!State.player) return 0;
      // Sumar slots de cada item (no cantidad). Monedas = 0 slots.
      return State.player.inventory.reduce((acc, s) => {
        return acc + State.itemSlots(s.itemId);
      }, 0);
    },

    inventoryCapacity() {
      if (!State.player) return 0;
      const bag = A.Data.getById('bags', State.player.bagId || DEFAULT_BAG_ID);
      return bag ? bag.slots : 10;
    },

    /**
     * ¿Hay espacio para un item de N slots?
     */
    inventoryHasSpaceFor(itemId) {
      const need = State.itemSlots(itemId);
      if (need === 0) return true; // monedas
      return State.inventoryUsedSlots() + need <= State.inventoryCapacity();
    },

    inventoryHasSpace() {
      return State.inventoryUsedSlots() < State.inventoryCapacity();
    },

    /**
     * Cambia la mochila equipada. Falla si la nueva tiene menos slots que items
     * actuales en el inventario.
     * Devuelve { ok: bool, error?: string }
     */
    setBag(bagId) {
      if (!State.player) return { ok: false, error: 'Sin personaje.' };
      const bag = A.Data.getById('bags', bagId);
      if (!bag) return { ok: false, error: 'Mochila inexistente.' };
      const used = State.inventoryUsedSlots();
      if (used > bag.slots) {
        return { ok: false, error: `La mochila tiene ${bag.slots} slots y tu inventario ocupa ${used}. Tirá o guardá algo primero.` };
      }
      State.player.bagId = bagId;
      A.Bus.emit('bag:equipped', { bagId });
      A.Bus.emit('inventory:changed');
      State.persist();
      return { ok: true };
    },

    addItem(itemId, qty = 1) {
      if (!State.player) return false;
      // Buscar en items, weapons, armors (orden de prioridad)
      const item = A.Data.getById('items', itemId)
                || A.Data.getById('weapons', itemId)
                || A.Data.getById('armors', itemId);
      if (!item) return false;

      // Las monedas se manejan aparte vía Currency
      if (item.subtype === 'coin') {
        // Convertir a cobre y delegar a Currency.add (auto-distribuye)
        const valueInCopper = (item.value || 1) * qty;
        A.Currency.add(valueInCopper);
        return true;
      }

      const existing = State.player.inventory.find((s) => s.itemId === itemId);
      const stackable = item.stack && item.stack > 1;

      if (existing && stackable) {
        existing.qty = Math.min(existing.qty + qty, item.stack);
        A.Bus.emit('inventory:changed');
        State.persist();
        return true;
      }

      if (!State.inventoryHasSpaceFor(itemId)) {
        A.Bus.emit('inventory:full');
        return false;
      }

      State.player.inventory.push({ itemId, qty });
      A.Bus.emit('inventory:changed');
      State.persist();
      return true;
    },

    removeItem(itemId, qty = 1) {
      if (!State.player) return false;
      const slot = State.player.inventory.find((s) => s.itemId === itemId);
      if (!slot) return false;
      slot.qty -= qty;
      if (slot.qty <= 0) {
        State.player.inventory = State.player.inventory.filter((s) => s !== slot);
      }
      A.Bus.emit('inventory:changed');
      State.persist();
      return true;
    },

    dropItem(itemId) {
      if (!State.player) return;
      State.player.inventory = State.player.inventory.filter((s) => s.itemId !== itemId);
      A.Bus.emit('inventory:changed');
      State.persist();
    },

    // ---------- Comida (food) ----------

    /**
     * Modifica food por delta (positivo o negativo). Cap en 0..maxFood.
     */
    modifyFood(delta) {
      if (!State.player) return;
      State.player.food = Math.max(0, Math.min(State.player.maxFood, State.player.food + delta));
      A.Bus.emit('player:food-changed', { food: State.player.food });
      State.persist();
    },

    /**
     * Aplica el desgaste de food por viaje. Si llegó a 0, perder HP.
     */
    consumeFoodForStep() {
      if (!State.player) return;
      if (State.player.food > 0) {
        State.player.food -= 1;
        A.Bus.emit('player:food-changed', { food: State.player.food });
      } else {
        // Hambriento: pierde 1 HP por paso
        const hpLost = 1;
        State.player.hp = Math.max(0, State.player.hp - hpLost);
        A.Bus.emit('player:hp-changed', { current: State.player.hp });
        State.addChronicle({ type: 'note', text: 'Tenías hambre. Perdiste 1 de salud.' });
      }
      State.persist();
    },

    /**
     * Incrementa el contador de encuentros para una región.
     * Usado para el sistema de progresión por logros (reqEncounters).
     */
    incrementRegionEncounters(regionId) {
      if (!State.player) return;
      if (!State.player.regionEncounters) State.player.regionEncounters = {};
      State.player.regionEncounters[regionId] = (State.player.regionEncounters[regionId] || 0) + 1;
      State.persist();
    },

    encountersInRegion(regionId) {
      if (!State.player || !State.player.regionEncounters) return 0;
      return State.player.regionEncounters[regionId] || 0;
    },

    totalEncounters() {
      if (!State.player || !State.player.regionEncounters) return 0;
      return Object.values(State.player.regionEncounters).reduce((a, b) => a + b, 0);
    },

    // ---------- Crónicas ----------

    addChronicle({ type, text, regionId }) {
      const entry = {
        ts: Date.now(),
        type: type || 'note',
        text: text || '',
        regionId: regionId || (State.world && State.world.regionId) || null,
      };
      State.chronicles.unshift(entry);
      // Cap razonable para que el localStorage no crezca infinito
      if (State.chronicles.length > 500) State.chronicles.length = 500;
      A.Bus.emit('chronicle:added', { entry });
    },

    // ---------- UI ----------

    setTab(tab) {
      if (State.ui.activeTab === tab) return;
      State.ui.activeTab = tab;
      A.Bus.emit('view:changed', { tab });
      State.persist();
    },

    openModal(id, payload = null) {
      State.ui.openModal = id;
      State.ui.modalPayload = payload;
      A.Bus.emit('modal:open', { id, payload });
    },

    closeModal() {
      const id = State.ui.openModal;
      State.ui.openModal = null;
      State.ui.modalPayload = null;
      A.Bus.emit('modal:close', { id });
    },

    DEFAULT_BAG_ID,
  };

  A.State = State;
})(window.Aventurs);
