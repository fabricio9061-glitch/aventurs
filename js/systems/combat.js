/* ============================================================
   Aventurs — Combat system (Fase 2)
   Combate por turnos contra un único enemigo (Fase 2.0).
   En fases siguientes se puede ampliar a múltiples enemigos a la vez.

   Estado de combate (A.State.combat):
     {
       enemy: { id, name, icon, hp, maxHp, damage, armor, speed, difficulty, ... },
       turn: 'player' | 'enemy',
       round: number,
       log: [ { ts, type, text } ],   // entradas del log
       result: null | 'victory' | 'defeat' | 'flee',
       fromTravel: bool,              // si vino de un encuentro de viaje
     }

   API:
     start({ enemyId, fromTravel })   inicia combate contra enemy
     playerAttack()                   acción atacar
     playerSpell(spellId)             lanzar hechizo
     playerUseItem(itemId)            usar consumible
     playerFlee()                     intentar huir
     finish()                         limpia el combate

   Reglas:
     - AC del enemigo = enemy.difficulty || 10 + enemy.armor
     - AC del jugador = 10 + player.stats.armor + (armor equipado defense || 0)
     - Tirada ataque = d20 + floor(precision/2)
     - Daño jugador con arma = rollDice(weapon.damage) + stats.damage; si no, 1d3 + stats.damage
     - Crit en 20 (doble daño)
     - Hechizos: rollDice(spell.damage) o spell.heal; consume manaCost
     - Huir: 50% + 5*(player.speed - enemy.speed)/10. Mínimo 25%, máximo 90%.
     - Mascota: tras la acción del jugador (si la acción no fue huir/usar item),
       la mascota ataca al enemigo con d20 + 0 vs AC; daño = pet.damage.
     - Enemigo: tira d20 + floor(damage/4) vs AC del jugador. Daño = enemy.damage.
       Si hay mascota, 50% el enemigo la ataca a ella en vez del jugador.
   ============================================================ */

(function (A) {
  'use strict';

  function State() { return A.State; }

  // ---------- Iniciar combate ----------

  function start({ enemyId, fromTravel = false }) {
    const enemyData = A.Data.getById('enemies', enemyId);
    if (!enemyData) return false;

    const combat = {
      enemy: {
        id: enemyData.id,
        name: enemyData.name,
        icon: enemyData.icon,
        hp: enemyData.health,
        maxHp: enemyData.health,
        damage: enemyData.damage,
        armor: enemyData.armor,
        speed: enemyData.speed,
        difficulty: enemyData.difficulty,
        category: enemyData.category,
        tier: enemyData.tier,
      },
      turn: null, // se decide por iniciativa
      round: 1,
      log: [],
      result: null,
      fromTravel,
    };

    State().combat = combat;

    // Iniciativa: quien tenga más velocidad arranca
    const playerSpeed = State().player.stats.speed || 10;
    const enemySpeed = enemyData.speed || 10;
    combat.turn = playerSpeed >= enemySpeed ? 'player' : 'enemy';

    addLog(combat, 'system', `Comienza el combate contra ${enemyData.name}.`);
    A.Bus.emit('combat:started', { enemyId });
    State().persist();

    // Si arranca el enemigo, ejecutar su turno automáticamente
    if (combat.turn === 'enemy') {
      setTimeout(enemyTurn, 600);
    }
    return true;
  }

  // ---------- Acciones del jugador ----------

  function playerAttack() {
    const c = State().combat;
    if (!c || c.result || c.turn !== 'player') return;
    const p = State().player;
    const enemyAC = c.enemy.difficulty || (10 + (c.enemy.armor || 0));
    const precBonus = Math.floor((p.stats.precision || 0) / 2);
    const roll = A.Utils.dice(20);
    const total = roll + precBonus;

    if (roll === 1) {
      addLog(c, 'player', `Fallaste estrepitosamente. (1 natural)`);
    } else if (total >= enemyAC || roll === 20) {
      // Daño
      const weaponId = p.equipment.weapon;
      const weapon = weaponId ? A.Data.getById('weapons', weaponId) : null;
      const damageDice = weapon ? weapon.damage : '1d3';
      let dmg = A.Utils.rollDice(damageDice) + (p.stats.damage || 0);
      const isCrit = roll === 20;
      if (isCrit) dmg *= 2;
      dmg = Math.max(1, dmg);
      c.enemy.hp = Math.max(0, c.enemy.hp - dmg);
      addLog(c, 'player', `${isCrit ? '¡Crítico! ' : ''}Atacaste con ${weapon ? weapon.name : 'tus puños'}: ${dmg} de daño. (${c.enemy.hp}/${c.enemy.maxHp})`);
    } else {
      addLog(c, 'player', `Tu ataque no llegó (tirada ${total} contra AC ${enemyAC}).`);
    }

    afterPlayerAction();
  }

  function playerSpell(spellId) {
    const c = State().combat;
    if (!c || c.result || c.turn !== 'player') return;
    const p = State().player;
    if (!p.hasMagic) return;

    const spell = A.Data.getById('spells', spellId);
    if (!spell) return;
    if (!(p.spells || []).includes(spellId)) return;
    if (p.mana < spell.manaCost) {
      addLog(c, 'system', `Maná insuficiente para ${spell.name}.`);
      return;
    }

    A.State.setMana(p.mana - spell.manaCost);

    if (spell.heal) {
      const heal = A.Utils.rollDice(spell.heal);
      A.State.healHp(heal);
      addLog(c, 'player', `Lanzaste ${spell.name} y recuperaste ${heal} de salud.`);
    } else if (spell.damage) {
      const dmg = A.Utils.rollDice(spell.damage);
      c.enemy.hp = Math.max(0, c.enemy.hp - dmg);
      addLog(c, 'player', `Lanzaste ${spell.name}: ${dmg} de daño. (${c.enemy.hp}/${c.enemy.maxHp})`);
    } else {
      addLog(c, 'player', `Lanzaste ${spell.name}.`);
    }

    afterPlayerAction();
  }

  function playerUseItem(itemId) {
    const c = State().combat;
    if (!c || c.result || c.turn !== 'player') return;
    const item = A.Data.getById('items', itemId);
    if (!item) return;
    const slot = State().player.inventory.find((s) => s.itemId === itemId);
    if (!slot) return;

    const before = State().player.hp;
    const beforeMana = State().player.mana;
    const used = A.Inventory.use(itemId);
    if (!used) return;

    const hpDelta = State().player.hp - before;
    const manaDelta = State().player.mana - beforeMana;
    let text = `Usaste ${item.name}.`;
    if (hpDelta > 0) text += ` (+${hpDelta} salud)`;
    if (manaDelta > 0) text += ` (+${manaDelta} maná)`;
    addLog(c, 'player', text);

    afterPlayerAction({ skipPet: true });
  }

  function playerFlee() {
    const c = State().combat;
    if (!c || c.result || c.turn !== 'player') return;
    const p = State().player;
    const speedDiff = (p.stats.speed || 10) - (c.enemy.speed || 10);
    const chance = Math.max(0.25, Math.min(0.90, 0.50 + speedDiff * 0.05));
    const roll = Math.random();
    if (roll < chance) {
      addLog(c, 'system', 'Lograste escapar.');
      c.result = 'flee';
      A.Bus.emit('combat:ended', { result: 'flee' });
      State().persist();
    } else {
      addLog(c, 'system', 'No pudiste escapar. El enemigo te alcanza.');
      // Pierde el turno y enemigo ataca
      c.turn = 'enemy';
      State().persist();
      setTimeout(enemyTurn, 600);
    }
  }

  // ---------- Después de la acción del jugador ----------

  function afterPlayerAction({ skipPet = false } = {}) {
    const c = State().combat;
    if (!c) return;

    // Verificar muerte del enemigo
    if (c.enemy.hp <= 0) {
      onVictory();
      return;
    }

    // Mascota ataca (si la hay y no se usó item)
    if (!skipPet && State().player.pet) {
      petTurn();
      if (c.enemy.hp <= 0) {
        onVictory();
        return;
      }
    }

    // Pasa el turno al enemigo
    c.turn = 'enemy';
    State().persist();
    A.Bus.emit('combat:turn', { actor: 'enemy', turnNumber: c.round });
    setTimeout(enemyTurn, 600);
  }

  function petTurn() {
    const c = State().combat;
    if (!c || c.result) return;
    const pet = State().player.pet;
    if (!pet || pet.health <= 0) return;
    const enemyAC = c.enemy.difficulty || (10 + (c.enemy.armor || 0));
    const roll = A.Utils.dice(20);
    if (roll >= enemyAC || roll === 20) {
      const dmg = Math.max(1, pet.damage);
      c.enemy.hp = Math.max(0, c.enemy.hp - dmg);
      addLog(c, 'pet', `${pet.name} ataca: ${dmg} de daño. (${c.enemy.hp}/${c.enemy.maxHp})`);
    } else {
      addLog(c, 'pet', `${pet.name} ataca pero falla.`);
    }
  }

  // ---------- Turno del enemigo ----------

  function enemyTurn() {
    const c = State().combat;
    if (!c || c.result || c.turn !== 'enemy') return;
    const p = State().player;
    const equipArmor = p.equipment.armor ? A.Data.getById('armors', p.equipment.armor) : null;
    const playerAC = 10 + (p.stats.armor || 0) + (equipArmor ? equipArmor.defense : 0);
    const enemyAtkBonus = Math.floor((c.enemy.damage || 0) / 4);

    // ¿A quién ataca? Si hay mascota viva, 50% la ataca a ella
    const pet = p.pet;
    const targetPet = pet && pet.health > 0 && Math.random() < 0.5;
    const targetAC = targetPet ? (10 + (pet.armor || 0)) : playerAC;

    const roll = A.Utils.dice(20);
    const total = roll + enemyAtkBonus;
    const targetName = targetPet ? pet.name : 'ti';

    if (roll === 1) {
      addLog(c, 'enemy', `${c.enemy.name} ataca a ${targetName} pero tropieza. (1 natural)`);
    } else if (total >= targetAC || roll === 20) {
      let dmg = c.enemy.damage;
      if (roll === 20) dmg *= 2;
      dmg = Math.max(1, dmg);
      if (targetPet) {
        pet.health = Math.max(0, pet.health - dmg);
        addLog(c, 'enemy', `${roll === 20 ? '¡Crítico! ' : ''}${c.enemy.name} hiere a ${pet.name}: ${dmg} de daño. (${pet.health}/${pet.maxHealth})`);
        if (pet.health <= 0) {
          addLog(c, 'system', `${pet.name} cayó. La perdiste.`);
          A.Bus.emit('tame:lost', { name: pet.name });
          p.pet = null;
        }
      } else {
        A.State.damagePlayer(dmg);
        addLog(c, 'enemy', `${roll === 20 ? '¡Crítico! ' : ''}${c.enemy.name} te hiere: ${dmg} de daño. (${p.hp}/${p.maxHp})`);
      }
    } else {
      addLog(c, 'enemy', `${c.enemy.name} ataca a ${targetName} pero falla.`);
    }

    if (p.hp <= 0) {
      onDefeat();
      return;
    }

    // Pasa el turno al jugador, sube ronda
    c.turn = 'player';
    c.round += 1;
    State().persist();
    A.Bus.emit('combat:turn', { actor: 'player', turnNumber: c.round });
  }

  // ---------- Resultado ----------

  function onVictory() {
    const c = State().combat;
    if (!c) return;
    c.result = 'victory';

    // XP
    const enemyData = A.Data.getById('enemies', c.enemy.id);
    const catBonus = ({ weak: 1, normal: 2, strong: 5, boss: 15 })[c.enemy.category] || 2;
    const xp = (c.enemy.tier || 1) * 5 + (c.enemy.tier || 1) * catBonus;
    A.State.player.xp = (A.State.player.xp || 0) + xp;
    addLog(c, 'system', `Ganaste ${xp} XP.`);
    A.Bus.emit('player:xp-changed', { current: A.State.player.xp });

    // Level up?
    const xpForNext = 50 * (A.State.player.level + 1) * (A.State.player.level + 1);
    if (A.State.player.xp >= xpForNext) {
      A.State.player.level += 1;
      A.State.player.maxHp += 5;
      A.State.player.hp = A.State.player.maxHp;
      if (A.State.player.hasMagic) {
        A.State.player.maxMana += 3;
        A.State.player.mana = A.State.player.maxMana;
      }
      addLog(c, 'system', `¡Subiste al nivel ${A.State.player.level}! Te recuperas por completo.`);
      A.Bus.emit('player:leveled', { newLevel: A.State.player.level });
    }

    // Loot: monedas
    if (enemyData && enemyData.coinLoot) {
      const [min, max] = enemyData.coinLoot;
      const coins = min + Math.floor(Math.random() * (max - min + 1));
      if (coins > 0) {
        A.Currency.add(coins);
        addLog(c, 'loot', `Encontraste ${coins} monedas de cobre.`);
      }
    }

    // Loot: drops
    const drops = (enemyData && enemyData.drops) || [];
    for (const d of drops) {
      if (Math.random() < (d.chance || 0)) {
        const ok = A.State.addItem(d.itemId, 1);
        const item = A.Data.getById('items', d.itemId);
        if (ok && item) {
          addLog(c, 'loot', `Conseguiste: ${item.name}.`);
        } else if (!ok) {
          addLog(c, 'loot', `Hubo botín pero no entró en la mochila.`);
        }
      }
    }

    A.State.addChronicle({ type: 'combat', text: `Venciste a ${c.enemy.name} (+${xp} XP).` });
    A.Bus.emit('combat:ended', { result: 'victory', xp });
    State().persist();
  }

  function onDefeat() {
    const c = State().combat;
    if (!c) return;
    c.result = 'defeat';
    addLog(c, 'system', `Caíste en combate.`);
    // Volver al pueblo con HP=1, sin perder inventario, sin XP del combate
    A.State.player.hp = 1;
    A.State.player.mana = Math.floor(A.State.player.maxMana / 2);
    A.State.world.regionId = 'pueblo_inicial';
    A.State.traveling = null;
    A.State.addChronicle({ type: 'combat', text: `Caíste contra ${c.enemy.name}. Despertás de vuelta en el pueblo.` });
    A.Bus.emit('combat:ended', { result: 'defeat' });
    State().persist();
  }

  function finish() {
    State().combat = null;
    State().persist();
  }

  // ---------- Helpers ----------

  function addLog(c, type, text) {
    c.log.push({ ts: Date.now(), type, text });
    A.Bus.emit('combat:action', { type, text });
  }

  /**
   * Devuelve el spell que el jugador puede lanzar (para UI).
   */
  function availableSpells() {
    const p = State().player;
    if (!p.hasMagic) return [];
    return (p.spells || [])
      .map((id) => A.Data.getById('spells', id))
      .filter(Boolean);
  }

  /**
   * Devuelve los items consumibles que el jugador puede usar.
   */
  function availableItems() {
    const p = State().player;
    return (p.inventory || []).filter((s) => {
      const it = A.Data.getById('items', s.itemId);
      return it && (it.subtype === 'potion' || it.subtype === 'food');
    });
  }

  A.Combat = {
    start,
    finish,
    playerAttack,
    playerSpell,
    playerUseItem,
    playerFlee,
    availableSpells,
    availableItems,
  };
})(window.Aventurs);
