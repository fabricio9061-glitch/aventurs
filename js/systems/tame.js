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

  // Sistema de dados por rareza:
  //   common   -> D24 (baja dificultad: cualquier resultado >=10 da bien)
  //   uncommon -> D24 también
  //   rare     -> D30
  //   epic     -> D60
  //   legendary-> D100
  //
  // El éxito requiere que el roll caiga dentro del rango "favorable" del dado:
  //   D24: success si roll <= 12 (50%)
  //   D30: success si roll <= 12 (40%)
  //   D60: success si roll <= 18 (30%)
  //   D100: success si roll <= 20 (20%)
  // Bonus por nivel: +5% por nivel sobre 1 (cap +25%)
  //
  // Si la criatura no tiene rarity, fallback usa category (boss=legendary, etc).

  const RARITY_DICE = {
    common: { sides: 24, threshold: 12 },     // ~50%
    uncommon: { sides: 24, threshold: 10 },   // ~42%
    rare: { sides: 30, threshold: 12 },       // ~40%
    epic: { sides: 60, threshold: 18 },       // ~30%
    legendary: { sides: 100, threshold: 20 }, // ~20%
  };

  const CATEGORY_TO_RARITY = {
    weak: 'common',
    normal: 'common',
    strong: 'rare',
    boss: 'epic',
  };

  function diceConfigFor(enemy) {
    const rarity = enemy.rarity || CATEGORY_TO_RARITY[enemy.category] || 'common';
    return RARITY_DICE[rarity] || RARITY_DICE.common;
  }

  const DEFAULT_TAME_ITEM = 'carne_cruda';

  function requiredItem(enemy) {
    if (!enemy) return DEFAULT_TAME_ITEM;
    return enemy.tameItem || DEFAULT_TAME_ITEM;
  }

  function isInstinctive(enemy) {
    if (!enemy || !enemy.family) return false;
    // No domesticables: humanoides, magos, demonios, no-muertos, dragones (inteligentes)
    const intelligent = ['humanoid', 'demon', 'undead', 'arcane', 'dragon'];
    return !enemy.family.some((f) => intelligent.includes(f));
  }

  /**
   * Probabilidad estimada (informativa para UI).
   */
  function chanceFor(enemy) {
    const dc = diceConfigFor(enemy);
    let chance = dc.threshold / dc.sides;
    const lvl = (A.State.player && A.State.player.level) || 1;
    const bonus = Math.min(0.25, Math.max(0, (lvl - 1) * 0.05));
    return Math.min(0.95, chance + bonus);
  }

  function canTame(enemyId) {
    const enemy = A.Data.getById('enemies', enemyId);
    if (!enemy) return { ok: false, reason: 'enemy-not-found' };
    if (!enemy.tameable) return { ok: false, reason: 'not-tameable' };
    if (!isInstinctive(enemy)) return { ok: false, reason: 'not-instinctive' };
    if (A.State.player.pet) return { ok: false, reason: 'already-have-pet' };
    // No re-intentar si ya falló antes con esta especie
    if (A.State.player.failedTames && A.State.player.failedTames.includes(enemy.id)) {
      return { ok: false, reason: 'already-failed' };
    }
    const itemId = requiredItem(enemy);
    const haveIt = (A.State.player.inventory || []).some(
      (s) => s.itemId === itemId && s.qty > 0
    );
    if (!haveIt) return { ok: false, reason: 'missing-item', requiredItemId: itemId };
    return { ok: true, requiredItemId: itemId };
  }

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

    const dc = diceConfigFor(enemy);
    const lvl = (A.State.player.level || 1);
    const lvlBonus = Math.min(5, Math.max(0, (lvl - 1)));
    const roll = 1 + Math.floor(Math.random() * dc.sides);
    const effectiveThreshold = dc.threshold + lvlBonus;
    const success = roll <= effectiveThreshold;

    A.Bus.emit('tame:attempt', { enemyId, success, roll, dice: `D${dc.sides}`, threshold: effectiveThreshold });

    if (!success) {
      // Marcar este enemyId como ya fallido (no se puede reintentar)
      if (!A.State.player.failedTames) A.State.player.failedTames = [];
      if (!A.State.player.failedTames.includes(enemy.id)) {
        A.State.player.failedTames.push(enemy.id);
      }
      A.State.addChronicle({
        type: 'note',
        text: `Le ofreciste ${itemName} a ${enemy.name}. Tirada D${dc.sides}: ${roll} (necesitabas ≤${effectiveThreshold}). No se dejó acercar y huyó. No vas a poder domesticar a otro de esta especie.`,
      });
      A.State.persist();
      A.Bus.emit('tame:failed', { enemyId, roll });
      return { success: false, roll, dice: `D${dc.sides}`, itemConsumed: itemId };
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
      dodge: enemy.dodge || Math.max(0, Math.floor((enemy.speed || 10) / 4)),
      since: Date.now(),
    };

    A.State.player.pet = pet;
    A.State.persist();
    A.State.addChronicle({
      type: 'system',
      text: `Tirada D${dc.sides}: ${roll}. ¡Domaste a ${enemy.name}! Ahora te acompaña.`,
    });
    A.Bus.emit('tame:success', { petId: pet.id, name: pet.name });
    return { success: true, roll, dice: `D${dc.sides}`, itemConsumed: itemId, pet };
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

  A.Tame = {
    canTame,
    attempt,
    release,
    requiredItem,
    chanceFor,
    diceConfigFor,
    isInstinctive,
    DEFAULT_TAME_ITEM,
    RARITY_DICE,
  };
})(window.Aventurs);
