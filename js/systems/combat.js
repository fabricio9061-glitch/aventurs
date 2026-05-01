/* ============================================================
   Aventurs — Combat system (v1.3.0 — multi-enemigo)

   Estado de combate (A.State.combat):
     {
       enemies: [ { instanceId, id, name, icon, hp, maxHp, damage,
                    armor, speed, difficulty, category, tier,
                    family[], tags[] } ],
       targetInstanceId: string | null,    // a quién apunta el jugador
       turn: 'player' | 'enemy',
       round: number,
       log: [ { ts, type, text } ],
       result: null | 'victory' | 'defeat' | 'flee',
       fromTravel: bool,
     }

   API:
     start({ enemies | enemyId | regionId, fromTravel })
     setTarget(instanceId)
     playerAttack()                       (usa target actual)
     playerSpell(spellId)
     playerUseItem(itemId)
     playerFlee()
     finish()

   Selección de objetivo:
     - Si la player no eligió uno, autoselecciona el primer enemigo vivo.
     - Si el target actual murió, salta al siguiente vivo.
   ============================================================ */

(function (A) {
  'use strict';

  function State() { return A.State; }

  // ---------- Iniciar combate ----------

  /**
   * Inicia combate con uno de estos modos:
   *   - { enemies: [instances...], fromTravel? }   (instancias prearmadas)
   *   - { enemyId: 'rata', fromTravel? }           (un solo enemigo, compat con encuentros viejos)
   *   - { regionId: 'xxx', fromTravel? }           (genera grupo via Encounter)
   */
  function start(opts = {}) {
    let instances = null;

    if (Array.isArray(opts.enemies) && opts.enemies.length > 0) {
      instances = opts.enemies;
    } else if (opts.enemyId) {
      const enemyData = A.Data.getById('enemies', opts.enemyId);
      if (!enemyData) return false;
      instances = [{
        instanceId: 'e_' + Date.now().toString(36),
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
        family: enemyData.family || [],
        tags: enemyData.tags || [],
      }];
    } else if (opts.regionId) {
      instances = A.Encounter.generate(opts.regionId);
    }

    if (!instances || instances.length === 0) return false;

    // Asignar letras (A, B, C...) si hay múltiples del mismo id
    assignLabels(instances);

    const combat = {
      enemies: instances,
      targetInstanceId: instances[0].instanceId,
      turn: null,
      round: 1,
      log: [],
      result: null,
      fromTravel: !!opts.fromTravel,
    };

    State().combat = combat;

    // Iniciativa: el jugador arranca si su velocidad >= mayor velocidad enemiga
    const playerSpeed = State().player.stats.speed || 10;
    const maxEnemySpeed = Math.max(...instances.map((e) => e.speed || 10));
    combat.turn = playerSpeed >= maxEnemySpeed ? 'player' : 'enemy';

    addLog(combat, 'system', `Comienza el combate contra ${A.Encounter.describeGroup(instances)}.`);
    A.Bus.emit('combat:started', { count: instances.length });
    State().persist();

    if (combat.turn === 'enemy') {
      setTimeout(enemyTurn, 600);
    }
    return true;
  }

  /**
   * Si hay varios enemigos del mismo tipo, ponerles letra (Lobo A, Lobo B...).
   */
  function assignLabels(instances) {
    const counts = {};
    for (const e of instances) {
      counts[e.id] = (counts[e.id] || 0) + 1;
    }
    const idx = {};
    for (const e of instances) {
      if (counts[e.id] > 1) {
        idx[e.id] = (idx[e.id] || 0) + 1;
        const letter = String.fromCharCode(64 + idx[e.id]); // A, B, C...
        e.label = letter;
        e.displayName = `${e.name} ${letter}`;
      } else {
        e.label = '';
        e.displayName = e.name;
      }
    }
  }

  // ---------- Targeting ----------

  function setTarget(instanceId) {
    const c = State().combat;
    if (!c) return;
    const t = c.enemies.find((e) => e.instanceId === instanceId && e.hp > 0);
    if (t) {
      c.targetInstanceId = instanceId;
      State().persist();
      A.Bus.emit('combat:target-changed', { instanceId });
    }
  }

  function getTarget() {
    const c = State().combat;
    if (!c) return null;
    let t = c.enemies.find((e) => e.instanceId === c.targetInstanceId && e.hp > 0);
    if (!t) {
      // El target murió o no existe: autoseleccionar el primer vivo
      t = c.enemies.find((e) => e.hp > 0);
      if (t) c.targetInstanceId = t.instanceId;
    }
    return t || null;
  }

  function aliveEnemies() {
    const c = State().combat;
    if (!c) return [];
    return c.enemies.filter((e) => e.hp > 0);
  }

  // ---------- Acciones del jugador ----------

  function playerAttack() {
    const c = State().combat;
    if (!c || c.result || c.turn !== 'player') return;
    const target = getTarget();
    if (!target) { onVictory(); return; }
    const p = State().player;
    const enemyAC = target.difficulty || (10 + (target.armor || 0));
    const precBonus = Math.floor((p.stats.precision || 0) / 2);
    const roll = A.Utils.dice(20);
    const total = roll + precBonus;

    if (roll === 1) {
      addLog(c, 'player', `Atacaste a ${target.displayName}: D20=1, fallo crítico.`);
    } else if (total >= enemyAC || roll === 20) {
      const weaponId = p.equipment.weapon;
      const weapon = weaponId ? A.Data.getById('weapons', weaponId) : null;
      const damageDice = weapon ? weapon.damage : '1d3';
      let dmg = A.Utils.rollDice(damageDice) + (p.stats.damage || 0);
      const isCrit = roll === 20;
      if (isCrit) dmg *= 2;
      dmg = Math.max(1, dmg);
      target.hp = Math.max(0, target.hp - dmg);
      addLog(c, 'player',
        `${isCrit ? '¡Crítico! ' : ''}Atacaste a ${target.displayName}: D20=${roll}+${precBonus}=${total} vs AC ${enemyAC} → ${dmg} de daño. (${target.hp}/${target.maxHp})`);

      if (target.hp <= 0) {
        addLog(c, 'system', `${target.displayName} cayó.`);
      }
    } else {
      addLog(c, 'player', `Atacaste a ${target.displayName}: D20=${roll}+${precBonus}=${total} vs AC ${enemyAC}, no llegó.`);
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
      // Si el hechizo es de área, daña a todos los enemigos vivos
      const targets = spell.area ? aliveEnemies() : [getTarget()].filter(Boolean);
      for (const t of targets) {
        const dmg = A.Utils.rollDice(spell.damage);
        t.hp = Math.max(0, t.hp - dmg);
        addLog(c, 'player', `${spell.name} hiere a ${t.displayName}: ${dmg} de daño. (${t.hp}/${t.maxHp})`);
        if (t.hp <= 0) addLog(c, 'system', `${t.displayName} cayó.`);
      }
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
    const fastest = Math.max(...aliveEnemies().map((e) => e.speed || 10));
    const speedDiff = (p.stats.speed || 10) - fastest;
    const chance = Math.max(0.25, Math.min(0.90, 0.50 + speedDiff * 0.05));
    const roll = Math.random();
    if (roll < chance) {
      addLog(c, 'system', 'Lograste escapar.');
      c.result = 'flee';
      A.Bus.emit('combat:ended', { result: 'flee' });
      State().persist();
    } else {
      addLog(c, 'system', 'No pudiste escapar. Los enemigos te alcanzan.');
      c.turn = 'enemy';
      State().persist();
      setTimeout(enemyTurn, 600);
    }
  }

  // ---------- Después de la acción del jugador ----------

  function afterPlayerAction({ skipPet = false } = {}) {
    const c = State().combat;
    if (!c) return;

    if (aliveEnemies().length === 0) { onVictory(); return; }

    // Mascota ataca a un enemigo vivo
    if (!skipPet && State().player.pet) {
      petTurn();
      if (aliveEnemies().length === 0) { onVictory(); return; }
    }

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
    const alive = aliveEnemies();
    if (alive.length === 0) return;
    const target = alive[Math.floor(Math.random() * alive.length)];
    const enemyAC = target.difficulty || (10 + (target.armor || 0));
    const roll = A.Utils.dice(20);
    if (roll >= enemyAC || roll === 20) {
      const dmg = Math.max(1, pet.damage);
      target.hp = Math.max(0, target.hp - dmg);
      addLog(c, 'pet', `${pet.name} ataca a ${target.displayName}: D20=${roll} vs AC ${enemyAC} → ${dmg} de daño. (${target.hp}/${target.maxHp})`);
      if (target.hp <= 0) addLog(c, 'system', `${target.displayName} cayó por la mascota.`);
    } else {
      addLog(c, 'pet', `${pet.name} ataca a ${target.displayName} pero falla. (D20=${roll} vs AC ${enemyAC})`);
    }
  }

  // ---------- Turno del enemigo ----------

  function enemyTurn() {
    const c = State().combat;
    if (!c || c.result || c.turn !== 'enemy') return;
    const p = State().player;
    const equipArmor = p.equipment.armor ? A.Data.getById('armors', p.equipment.armor) : null;
    const playerAC = 10 + (p.stats.armor || 0) + (equipArmor ? equipArmor.defense : 0);

    for (const enemy of aliveEnemies()) {
      if (p.hp <= 0) break;
      const enemyAtkBonus = Math.floor((enemy.damage || 0) / 4);
      const pet = p.pet;
      const targetPet = pet && pet.health > 0 && Math.random() < 0.4;
      const targetAC = targetPet ? (10 + (pet.armor || 0)) : playerAC;
      const targetName = targetPet ? pet.name : 'ti';

      const roll = A.Utils.dice(20);
      const total = roll + enemyAtkBonus;

      if (roll === 1) {
        addLog(c, 'enemy', `${enemy.displayName} ataca a ${targetName}: D20=1, fallo crítico.`);
      } else if (total >= targetAC || roll === 20) {
        let dmg = enemy.damage;
        if (roll === 20) dmg *= 2;
        dmg = Math.max(1, dmg);
        if (targetPet) {
          pet.health = Math.max(0, pet.health - dmg);
          addLog(c, 'enemy',
            `${roll === 20 ? '¡Crítico! ' : ''}${enemy.displayName} hiere a ${pet.name}: D20=${roll}+${enemyAtkBonus}=${total} vs AC ${targetAC} → ${dmg} de daño. (${pet.health}/${pet.maxHealth})`);
          if (pet.health <= 0) {
            addLog(c, 'system', `${pet.name} cayó. La perdiste.`);
            A.Bus.emit('tame:lost', { name: pet.name });
            p.pet = null;
          }
        } else {
          A.State.damagePlayer(dmg);
          addLog(c, 'enemy',
            `${roll === 20 ? '¡Crítico! ' : ''}${enemy.displayName} te hiere: D20=${roll}+${enemyAtkBonus}=${total} vs AC ${targetAC} → ${dmg} de daño. (${p.hp}/${p.maxHp})`);
        }
      } else {
        addLog(c, 'enemy', `${enemy.displayName} ataca a ${targetName}: D20=${roll}+${enemyAtkBonus}=${total} vs AC ${targetAC}, no llegó.`);
      }
    }

    if (p.hp <= 0) { onDefeat(); return; }

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

    // XP: suma de todos los enemigos vencidos
    let totalXp = 0;
    for (const e of c.enemies) {
      const catBonus = ({ weak: 1, normal: 2, strong: 5, boss: 15 })[e.category] || 2;
      totalXp += (e.tier || 1) * 5 + (e.tier || 1) * catBonus;
    }
    A.State.player.xp = (A.State.player.xp || 0) + totalXp;
    addLog(c, 'system', `Ganaste ${totalXp} XP.`);
    A.Bus.emit('player:xp-changed', { current: A.State.player.xp });

    // Level up
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

    // Loot: monedas y drops por cada enemigo
    let totalCoins = 0;
    for (const inst of c.enemies) {
      const enemyData = A.Data.getById('enemies', inst.id);
      if (!enemyData) continue;
      if (enemyData.coinLoot) {
        const [min, max] = enemyData.coinLoot;
        const coins = min + Math.floor(Math.random() * (max - min + 1));
        if (coins > 0) totalCoins += coins;
      }
      for (const d of enemyData.drops || []) {
        if (Math.random() < (d.chance || 0)) {
          const ok = A.State.addItem(d.itemId, 1);
          const item = A.Data.getById('items', d.itemId);
          if (ok && item) addLog(c, 'loot', `Conseguiste: ${item.name} (de ${inst.displayName}).`);
          else if (!ok) addLog(c, 'loot', `Hubo botín pero no entró en la mochila.`);
        }
      }
    }
    if (totalCoins > 0) {
      A.Currency.add(totalCoins);
      addLog(c, 'loot', `Recogiste ${totalCoins} monedas en total.`);
    }

    A.State.addChronicle({
      type: 'combat',
      text: `Venciste a ${A.Encounter.describeGroup(c.enemies)} (+${totalXp} XP).`,
    });
    A.Bus.emit('combat:ended', { result: 'victory', xp: totalXp });
    State().persist();
  }

  function onDefeat() {
    const c = State().combat;
    if (!c) return;
    c.result = 'defeat';
    addLog(c, 'system', `Caíste en combate.`);
    A.State.player.hp = 1;
    A.State.player.mana = Math.floor(A.State.player.maxMana / 2);
    A.State.world.regionId = 'pueblo_inicial';
    A.State.traveling = null;
    A.State.addChronicle({
      type: 'combat',
      text: `Caíste contra ${A.Encounter.describeGroup(c.enemies)}. Despertás de vuelta en el pueblo.`,
    });
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

  function availableSpells() {
    const p = State().player;
    if (!p.hasMagic) return [];
    return (p.spells || []).map((id) => A.Data.getById('spells', id)).filter(Boolean);
  }

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
    setTarget,
    getTarget,
    aliveEnemies,
    playerAttack,
    playerSpell,
    playerUseItem,
    playerFlee,
    availableSpells,
    availableItems,
  };
})(window.Aventurs);
