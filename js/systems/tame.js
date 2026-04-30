/* ============================================================
   Aventurs — Tame system
   Domesticación de criaturas instintivas.

   Reglas:
     - Solo se puede intentar domar si enemy.tameable === true.
     - Solo una mascota a la vez. Si ya hay pet, hay que liberarla
       primero (release).

   Mecánica de tirada (Fase 1, simple):
     roll = d20 + (player.level - 1)
     target depende de category:
       weak   -> 10
       normal -> 13
       strong -> 17
       boss   -> 20
     éxito si roll >= target

   Una mascota es:
     {
       id, species (enemyId), name, icon, tier, family[], tags[],
       health, maxHealth, damage, armor, speed,
       since: timestamp
     }
   En Fase 1 se guarda pero no participa en combate.
   ============================================================ */

(function (A) {
  'use strict';

  const TARGET_BY_CAT = {
    weak: 10,
    normal: 13,
    strong: 17,
    boss: 20,
  };

  function canTame(enemyId) {
    const enemy = A.Data.getById('enemies', enemyId);
    if (!enemy) return { ok: false, reason: 'enemy-not-found' };
    if (!enemy.tameable) return { ok: false, reason: 'not-tameable' };
    if (A.State.player.pet) return { ok: false, reason: 'already-have-pet' };
    return { ok: true };
  }

  /**
   * Intenta domar. Devuelve { success: bool, roll, target, pet?, reason? }
   */
  function attempt(enemyId) {
    const check = canTame(enemyId);
    if (!check.ok) return { success: false, reason: check.reason };

    const enemy = A.Data.getById('enemies', enemyId);
    const target = TARGET_BY_CAT[enemy.category] || 13;
    const roll = A.Utils.dice(20) + (A.State.player.level - 1);
    const success = roll >= target;

    A.Bus.emit('tame:attempt', { enemyId, success, roll, target });

    if (!success) {
      A.State.addChronicle({
        type: 'note',
        text: `${enemy.name} no se dejó acercar. (tirada ${roll} contra ${target})`,
      });
      A.Bus.emit('tame:failed', { enemyId, roll, target });
      return { success: false, roll, target };
    }

    // Éxito: crear mascota
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
      text: `Domaste a ${enemy.name}. Ahora te acompaña.`,
    });
    A.Bus.emit('tame:success', { petId: pet.id, name: pet.name });
    return { success: true, roll, target, pet };
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
    TARGET_BY_CAT,
  };
})(window.Aventurs);
