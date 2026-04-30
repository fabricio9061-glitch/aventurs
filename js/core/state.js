/* ============================================================
   Aventurs — State
   Estado de la partida actual + persistencia.

   Estructura:
     player     - { name, raceId, level, xp, hp, maxHp, mana, maxMana,
                    stats: {speed, precision, armor, damage, dodge},
                    equipment: {weapon, armor},
                    inventory: [{itemId, qty}],
                    coins: {copper, silver, gold},
                    spells: [spellId] }
     world      - { regionId, visited:[regionId], npcsTalked:[npcId] }
     combat     - null o { ... } (Fase 2)
     ui         - { activeTab, openModal, modalPayload }
     chronicles - [{ ts, type, text, regionId }]
   ============================================================ */

(function (A) {
  'use strict';

  const STORAGE_KEY = 'aventurs:save';
  const INVENTORY_SLOTS = 10;

  const State = {
    player: null,
    world: null,
    combat: null,
    ui: { activeTab: 'world', openModal: null, modalPayload: null },
    chronicles: [],

    // ---------- Lifecycle ----------

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        State.player = data.player || null;
        State.world = data.world || null;
        State.combat = null;
        State.ui = data.ui || { activeTab: 'world', openModal: null, modalPayload: null };
        State.chronicles = data.chronicles || [];
        A.Bus.emit('state:loaded');
        return true;
      } catch (err) {
        console.warn('[State] Save corrupto, ignorado:', err);
        return false;
      }
    },

    persist() {
      try {
        const data = {
          player: State.player,
          world: State.world,
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
      State.ui = { activeTab: 'world', openModal: null, modalPayload: null };
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

      State.player = {
        name: (name || 'Aventurero').trim().slice(0, 24),
        raceId,
        level: 1,
        xp: 0,
        hp: stats.maxHp,
        maxHp: stats.maxHp,
        mana: stats.maxMana,
        maxMana: stats.maxMana,
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
          { itemId: 'pan', qty: 3 },
        ],
        coins: { copper: 50, silver: 0, gold: 0 },
        spells: [],
      };

      State.world = {
        regionId: 'pueblo_inicial',
        visited: ['pueblo_inicial'],
        npcsTalked: [],
      };

      State.ui = { activeTab: 'world', openModal: null, modalPayload: null };
      State.chronicles = [];
      State.addChronicle({ type: 'system', text: `${State.player.name} comienza su aventura en el Pueblo Inicial.` });

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

    inventoryUsedSlots() {
      if (!State.player) return 0;
      // Las monedas no cuentan slots
      return State.player.inventory.filter((s) => {
        const item = A.Data.getById('items', s.itemId);
        return !item || item.subtype !== 'coin';
      }).length;
    },

    inventoryCapacity() {
      return INVENTORY_SLOTS;
    },

    inventoryHasSpace() {
      return State.inventoryUsedSlots() < State.inventoryCapacity();
    },

    addItem(itemId, qty = 1) {
      if (!State.player) return false;
      const item = A.Data.getById('items', itemId);
      if (!item) return false;

      // Las monedas se manejan aparte
      if (item.subtype === 'coin') {
        State.addCoinsByItemId(itemId, qty);
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

      if (!State.inventoryHasSpace()) {
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

    // ---------- Monedas ----------

    addCoinsByItemId(itemId, qty) {
      if (!State.player) return;
      if (itemId === 'coin_copper') State.player.coins.copper += qty;
      else if (itemId === 'coin_silver') State.player.coins.silver += qty;
      else if (itemId === 'coin_gold') State.player.coins.gold += qty;
      A.Currency.normalize();
      A.Bus.emit('currency:changed', { ...State.player.coins });
      State.persist();
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

    INVENTORY_SLOTS,
  };

  A.State = State;
})(window.Aventurs);
