/* ============================================================
   Aventurs — Currency
   Cobre, plata, oro. Conversión 100:1.

   Estructura interna en State.player.coins:
     { copper, silver, gold }

   El sistema mantiene la representación normalizada (cobre < 100,
   plata < 100) para que se vea bien en UI, pero soporta cualquier
   acumulación intermedia.
   ============================================================ */

(function (A) {
  'use strict';

  const COPPER_PER_SILVER = 100;
  const SILVER_PER_GOLD = 100;
  const COPPER_PER_GOLD = COPPER_PER_SILVER * SILVER_PER_GOLD;

  /**
   * Convierte cualquier { copper, silver, gold } a cobre total.
   */
  function toCopper(coins) {
    if (!coins) return 0;
    return (coins.copper || 0) + (coins.silver || 0) * COPPER_PER_SILVER + (coins.gold || 0) * COPPER_PER_GOLD;
  }

  /**
   * Convierte un total en cobre a { copper, silver, gold } normalizado.
   */
  function fromCopper(copperTotal) {
    let total = Math.max(0, Math.floor(copperTotal));
    const gold = Math.floor(total / COPPER_PER_GOLD);
    total -= gold * COPPER_PER_GOLD;
    const silver = Math.floor(total / COPPER_PER_SILVER);
    total -= silver * COPPER_PER_SILVER;
    return { copper: total, silver, gold };
  }

  /**
   * Normaliza el wallet del jugador (sube cobre→plata, plata→oro cuando corresponde).
   */
  function normalize() {
    const p = A.State.player;
    if (!p) return;
    const total = toCopper(p.coins);
    p.coins = fromCopper(total);
  }

  /**
   * Suma N cobre al jugador (puede ser positivo o negativo).
   */
  function add(copperDelta) {
    const p = A.State.player;
    if (!p) return;
    const total = toCopper(p.coins) + copperDelta;
    p.coins = fromCopper(Math.max(0, total));
    A.Bus.emit('currency:changed', { ...p.coins });
    A.State.persist();
  }

  /**
   * ¿Puede pagar N cobre?
   */
  function canPay(copperAmount) {
    const p = A.State.player;
    if (!p) return false;
    return toCopper(p.coins) >= copperAmount;
  }

  /**
   * Intenta pagar. Devuelve true si pudo, false si no.
   */
  function pay(copperAmount) {
    if (!canPay(copperAmount)) return false;
    add(-copperAmount);
    return true;
  }

  /**
   * Formatea un total en cobre como "1g 23p 45c" para UI.
   */
  function format(copperAmount) {
    const c = fromCopper(copperAmount);
    const parts = [];
    if (c.gold) parts.push(`${c.gold}g`);
    if (c.silver) parts.push(`${c.silver}p`);
    if (c.copper || parts.length === 0) parts.push(`${c.copper}c`);
    return parts.join(' ');
  }

  /**
   * Formatea el wallet del jugador (lo mismo que format pero leído desde State).
   */
  function formatWallet() {
    const p = A.State.player;
    if (!p) return '';
    return format(toCopper(p.coins));
  }

  A.Currency = {
    toCopper,
    fromCopper,
    normalize,
    add,
    canPay,
    pay,
    format,
    formatWallet,
    COPPER_PER_SILVER,
    SILVER_PER_GOLD,
    COPPER_PER_GOLD,
  };
})(window.Aventurs);
