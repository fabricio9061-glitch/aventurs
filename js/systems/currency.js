/* ============================================================
   Aventurs — Currency (v1.5.0)
   Monedas multi-tier viviendo como items en el inventario.

   Conversión:
     100 cobre = 1 plata
     100 plata = 1 oro
     => 1 oro = 10.000 cobre

   API:
     count()        -> { copper, silver, gold }
     toCopper()     -> total expresado en cobre
     canPay(c)      -> bool
     pay(c)         -> bool, paga c cobre desbarajustando monedas grandes si hace falta
     add(c)         -> agrega c cobre, auto-converte a plata/oro al llegar a 100/10000
     formatPrice(c) -> "2🥈 50🥉" para mostrar precios
     formatWallet() -> "🥇3 🥈12 🥉50" para mostrar billetera completa
     isCoinId(id)   -> bool

   Las monedas no consumen slots (subtype 'coin' es ignorado por inventoryUsedSlots).
   ============================================================ */

(function (A) {
  'use strict';

  const COIN_IDS = ['coin_copper', 'coin_silver', 'coin_gold'];
  const COPPER_PER_SILVER = 100;
  const SILVER_PER_GOLD = 100;
  const COPPER_PER_GOLD = COPPER_PER_SILVER * SILVER_PER_GOLD; // 10000

  function isCoinId(id) {
    return COIN_IDS.includes(id);
  }

  function getCoinSlot(coinId) {
    if (!A.State.player) return null;
    return A.State.player.inventory.find((s) => s.itemId === coinId);
  }

  function setCoinQty(coinId, qty) {
    if (!A.State.player) return;
    const inv = A.State.player.inventory;
    const idx = inv.findIndex((s) => s.itemId === coinId);
    if (qty <= 0) {
      if (idx >= 0) inv.splice(idx, 1);
      return;
    }
    if (idx >= 0) inv[idx].qty = qty;
    else inv.push({ itemId: coinId, qty });
  }

  function count() {
    const copper = (getCoinSlot('coin_copper') || {}).qty || 0;
    const silver = (getCoinSlot('coin_silver') || {}).qty || 0;
    const gold = (getCoinSlot('coin_gold') || {}).qty || 0;
    return { copper, silver, gold };
  }

  function toCopper() {
    const c = count();
    return c.copper + c.silver * COPPER_PER_SILVER + c.gold * COPPER_PER_GOLD;
  }

  function canPay(amount) {
    return toCopper() >= amount;
  }

  /**
   * Agrega una cantidad de cobre. Auto-convierte a plata y oro.
   */
  function add(amountInCopper) {
    if (!A.State.player) return;
    if (amountInCopper <= 0) return;

    let total = toCopper() + amountInCopper;
    distribute(total);
    A.Bus.emit('currency:changed', count());
    A.Bus.emit('inventory:changed');
    A.State.persist();
  }

  /**
   * Paga una cantidad en cobre. Desarma monedas grandes si hace falta.
   * Devuelve true si pudo pagar, false si no alcanza.
   */
  function pay(amountInCopper) {
    if (!A.State.player) return false;
    if (amountInCopper <= 0) return true;
    let total = toCopper();
    if (total < amountInCopper) return false;
    distribute(total - amountInCopper);
    A.Bus.emit('currency:changed', count());
    A.Bus.emit('inventory:changed');
    A.State.persist();
    return true;
  }

  /**
   * Distribuye un total en cobre como monedas óptimas (más oro posible).
   */
  function distribute(totalCopper) {
    if (totalCopper < 0) totalCopper = 0;
    const gold = Math.floor(totalCopper / COPPER_PER_GOLD);
    let rest = totalCopper - gold * COPPER_PER_GOLD;
    const silver = Math.floor(rest / COPPER_PER_SILVER);
    rest = rest - silver * COPPER_PER_SILVER;
    const copper = rest;
    setCoinQty('coin_gold', gold);
    setCoinQty('coin_silver', silver);
    setCoinQty('coin_copper', copper);
  }

  /**
   * Formatea un precio (en cobre) como "2🥈 50🥉" o "1🥇 23🥉".
   * Si vale 0 → "Gratis".
   */
  function formatPrice(amountInCopper) {
    if (!amountInCopper || amountInCopper <= 0) return 'Gratis';
    const gold = Math.floor(amountInCopper / COPPER_PER_GOLD);
    let rest = amountInCopper - gold * COPPER_PER_GOLD;
    const silver = Math.floor(rest / COPPER_PER_SILVER);
    const copper = rest - silver * COPPER_PER_SILVER;
    const parts = [];
    if (gold > 0) parts.push(`${gold}🥇`);
    if (silver > 0) parts.push(`${silver}🥈`);
    if (copper > 0 || parts.length === 0) parts.push(`${copper}🥉`);
    return parts.join(' ');
  }

  /**
   * Formatea la billetera completa "🥇3 🥈12 🥉50".
   */
  function formatWallet() {
    const c = count();
    const parts = [];
    if (c.gold > 0) parts.push(`🥇${c.gold}`);
    if (c.silver > 0) parts.push(`🥈${c.silver}`);
    parts.push(`🥉${c.copper}`); // siempre mostramos cobre aunque sea 0
    return parts.join(' ');
  }

  // Para compatibilidad con código viejo que esperaba .toCopper(player.coins)
  function toCopperFromObj(coinsLike) {
    if (!coinsLike) return 0;
    const cu = coinsLike.copper || 0;
    const si = coinsLike.silver || 0;
    const go = coinsLike.gold || 0;
    return cu + si * COPPER_PER_SILVER + go * COPPER_PER_GOLD;
  }

  A.Currency = {
    count,
    toCopper,
    toCopperFromObj,
    canPay,
    pay,
    add,
    distribute,
    formatPrice,
    formatWallet,
    isCoinId,
    COIN_IDS,
    COPPER_PER_SILVER,
    SILVER_PER_GOLD,
    COPPER_PER_GOLD,
  };
})(window.Aventurs);
