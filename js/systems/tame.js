/* ============================================================
   Aventurs — Tame system (v1.2.0)
   Domesticación de criaturas instintivas.

   Reglas:
     - Solo si enemy.tameable === true.
     - Solo una mascota a la vez.
     - Necesita el item enemy.tameItem (ej: carne_cruda, pescado_fresco, semillas).
       Si el enemigo no declara tameItem, default 'carne_cruda'.
     - El item se CONSUME al intentar (sea éxito o fracaso).

   Probabilidad de éxito según categoría:
     weak   -> 70%
     normal -> 50%
     strong -> 25%
     boss   -> 10%
   Bonus por nivel del jugador: +5% por nivel sobre 1, hasta +25%.

   Pet creada incluye: id, species, name, icon, tier, family, tags,
   health, maxHealth, damage, armor, speed, since.
   ============================================================ */

(function (A) {
  'use strict';

  const BASE_CHANCE = {
    weak: 0.70,
    normal: 0.50,
    strong: 0.25,
    boss: 0.10,
  };

  const DEFAULT_TAME_ITEM = 'carne_cruda';

  /**
   * Devuelve el item necesario para domar la criatura (o default).
   */
  function requiredItem(enemy) {
    if (!enemy) return DEFAULT_TAME_ITEM;
    return enemy.tameItem || DEFAULT_TAME_ITEM;
  }

  /**
   * Calcula la probabilidad final de éxito (0..1) para un enemigo dado el
   * nivel actual del jugador.
   */
  function chanceFor(enemy) {
    const base = BASE_CHANCE[enemy.category] || 0.40;
    const lvl = (A.State.player && A.State.player.level) || 1;
    const bonus = Math.min(0.25, Math.max(0, (lvl - 1) * 0.05));
    return Math.min(0.95, base + bonus);
  }

  /**
   * Verifica si se puede intentar domar.
   * Devuelve { ok, reason?, requiredItemId?, missingItem? }
   */
  function canTame(enemyId) {
    const enemy = A.Data.getById('enemies', enemyId);
    if (!enemy) return { ok: false, reason: 'enemy-not-found' };
    if (!enemy.tameable) return { ok: false, reason: 'not-tameable' };
    if (A.State.player.pet) return { ok: false, reason: 'already-have-pet' };
    const itemId = requiredItem(enemy);
    const haveIt = (A.State.player.inventory || []).some(
      (s) => s.itemId === itemId && s.qty > 0
    );
    if (!haveIt) return { ok: false, reason: 'missing-item', requiredItemId: itemId };
    return { ok: true, requiredItemId: itemId };
  }

  /**
   * Intenta domar. Consume el item necesario. Devuelve:
   *   { success, chance, roll, itemConsumed, pet?, reason? }
   */
  function attempt(enemyId) {
    const check = canTame(enemyId);
    if (!check.ok) {
      A.Bus.emit('tame:failed', { enemyId, reason: check.reason });
      return { success: false, reason: check.reason, requiredItemId: check.requiredItemId };
    }

    const enemy = A.Data.getById('enemies', enemyId);
    const itemId = check.requiredItemId;
    const itemData = A.Data.getById('items', itemId);
    const itemName = itemData ? itemData.name : itemId;

    // Consumir el item
    A.State.removeItem(itemId, 1);

    const chance = chanceFor(enemy);
    const roll = Math.random();
    const success = roll < chance;

    A.Bus.emit('tame:attempt', { enemyId, success, chance, roll });

    if (!success) {
      A.State.addChronicle({
        type: 'note',
        text: `Le ofreciste ${itemName} a ${enemy.name} pero no se dejó acercar. (${Math.round(chance * 100)}% de éxito)`,
      });
      A.Bus.emit('tame:failed', { enemyId, chance, roll });
      return { success: false, chance, roll, itemConsumed: itemId };
    }

    // Éxito
    const pet = {
      id: 'pet_' + Date.now().toString(36),
      species: enemy.id,
      name: enemy.name,
      icon: enemy.icon,
      tier: enemy.tier,
      family: enemy.family || [],
      tags: enemy.tags || [],
      health: enemy.health,
      maxHealth: enemy.health,
      damage: enemy.damage,
      armor: enemy.armor,
      speed: enemy.speed,
      since: Date.now(),
    };

    A.State.player.pet = pet;
    A.State.persist();
    A.State.addChronicle({
      type: 'system',
      text: `Aceptó ${itemName}. Domaste a ${enemy.name}. Ahora te acompaña.`,
    });
    A.Bus.emit('tame:success', { petId: pet.id, name: pet.name });
    return { success: true, chance, roll, itemConsumed: itemId, pet };
  }

  function release() {
    const p = A.State.player;
    if (!p || !p.pet) return false;
    const name = p.pet.name;
    p.pet = null;
    A.State.persist();
    A.State.addChronicle({ type: 'note', text: `Liberaste a ${name}.` });
    A.Bus.emit('tame:released', { name });
    return true;
  }

  // Lo dejamos por compat con código anterior que puede usar TARGET_BY_CAT.
  // Ya no se usa internamente (ahora chance%).
  const TARGET_BY_CAT = { weak: 10, normal: 13, strong: 17, boss: 20 };

  A.Tame = {
    canTame,
    attempt,
    release,
    requiredItem,
    chanceFor,
    BASE_CHANCE,
    TARGET_BY_CAT,
    DEFAULT_TAME_ITEM,
  };
})(window.Aventurs);
