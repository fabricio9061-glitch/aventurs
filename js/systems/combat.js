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
    const enemyDifficulty = target.difficulty || 10;
    const precBonus = Math.floor((p.stats.precision || 0) / 2);
    const roll = A.Utils.dice(20);
    const total = roll + precBonus;

    if (roll === 1) {
      addLog(c, 'player', {
        text: `Atacaste a ${target.displayName}`,
        actor: p.name, target: target.displayName,
        roll, bonus: precBonus, total, vs: enemyDifficulty, vsLabel: 'Dif',
        result: 'fumble',
      });
    } else if (total >= enemyDifficulty || roll === 20) {
      const weaponId = p.equipment.weapon;
      const weapon = weaponId ? A.Data.getById('weapons', weaponId) : null;
      const damageDice = weapon ? weapon.damage : '1d3';
      const damageRoll = A.Utils.rollDice(damageDice);
      let rawDmg = damageRoll + (p.stats.damage || 0);
      const isCrit = roll === 20;
      // CRIT: x2 ANTES de armadura
      if (isCrit) rawDmg *= 2;
      // Armadura como REDUCCIÓN
      const targetArmor = target.armor || 0;
      const finalDmg = Math.max(0, rawDmg - targetArmor);
      target.hp = Math.max(0, target.hp - finalDmg);
      addLog(c, 'player', {
        text: `Atacaste a ${target.displayName}`,
        actor: p.name, target: target.displayName,
        weapon: weapon ? weapon.name : 'puños',
        damageDice,
        roll, bonus: precBonus, total, vs: enemyDifficulty, vsLabel: 'Dif',
        rawDmg, targetArmor, dmg: finalDmg, hpAfter: target.hp, hpMax: target.maxHp,
        result: isCrit ? 'crit' : (finalDmg === 0 ? 'blocked' : 'hit'),
      });
      if (target.hp <= 0) {
        addLog(c, 'system', { text: `${target.displayName} cayó.`, killed: target.displayName });
      }
    } else {
      addLog(c, 'player', {
        text: `Atacaste a ${target.displayName}`,
        actor: p.name, target: target.displayName,
        roll, bonus: precBonus, total, vs: enemyDifficulty, vsLabel: 'Dif',
        result: 'miss',
      });
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
        const rawDmg = A.Utils.rollDice(spell.damage);
        const targetArmor = t.armor || 0;
        // Hechizos: misma reducción de armadura
        const finalDmg = Math.max(0, rawDmg - targetArmor);
        t.hp = Math.max(0, t.hp - finalDmg);
        addLog(c, 'player', {
          text: `${spell.name} hiere a ${t.displayName}`,
          actor: p.name, target: t.displayName,
          roll: rawDmg, bonus: 0, total: rawDmg, vs: targetArmor, vsLabel: 'Armadura',
          rawDmg, targetArmor, dmg: finalDmg, hpAfter: t.hp, hpMax: t.maxHp,
          spell: spell.name,
          result: finalDmg === 0 ? 'blocked' : 'hit',
        });
        if (t.hp <= 0) addLog(c, 'system', { text: `${t.displayName} cayó.` });
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
    const enemyDifficulty = target.difficulty || 10;
    const targetArmor = target.armor || 0;
    const roll = A.Utils.dice(20);
    if (roll >= enemyDifficulty || roll === 20) {
      let rawDmg = pet.damage;
      const isCrit = roll === 20;
      if (isCrit) rawDmg *= 2;
      const finalDmg = Math.max(0, rawDmg - targetArmor);
      target.hp = Math.max(0, target.hp - finalDmg);
      addLog(c, 'pet', {
        text: `${pet.name} ataca a ${target.displayName}`,
        actor: pet.name, target: target.displayName,
        roll, bonus: 0, total: roll, vs: enemyDifficulty, vsLabel: 'Dif',
        rawDmg, targetArmor, dmg: finalDmg, hpAfter: target.hp, hpMax: target.maxHp,
        result: isCrit ? 'crit' : (finalDmg === 0 ? 'blocked' : 'hit'),
      });
      if (target.hp <= 0) addLog(c, 'system', { text: `${target.displayName} cayó por la mascota.` });
    } else {
      addLog(c, 'pet', {
        text: `${pet.name} ataca a ${target.displayName}`,
        actor: pet.name, target: target.displayName,
        roll, bonus: 0, total: roll, vs: enemyDifficulty, vsLabel: 'Dif',
        result: 'miss',
      });
    }
  }

  // ---------- Turno del enemigo ----------

  function enemyTurn() {
    const c = State().combat;
    if (!c || c.result || c.turn !== 'enemy') return;
    const p = State().player;
    const equipArmor = p.equipment.armor ? A.Data.getById('armors', p.equipment.armor) : null;
    const playerArmor = (p.stats.armor || 0) + (equipArmor ? equipArmor.defense : 0);
    // Para esquiva del jugador: dificultad de impacto = 10 + dodge
    const playerDifficulty = 10 + (p.stats.dodge || 0);

    for (const enemy of aliveEnemies()) {
      if (p.hp <= 0) break;
      const enemyAtkBonus = Math.floor((enemy.damage || 0) / 4);
      const pet = p.pet;
      const targetPet = pet && pet.health > 0 && Math.random() < 0.4;
      const targetDifficulty = targetPet ? (10 + (pet.dodge || 0)) : playerDifficulty;
      const targetArmor = targetPet ? (pet.armor || 0) : playerArmor;
      const targetName = targetPet ? pet.name : p.name;

      const roll = A.Utils.dice(20);
      const total = roll + enemyAtkBonus;

      if (roll === 1) {
        addLog(c, 'enemy', {
          text: `${enemy.displayName} ataca a ${targetName}`,
          actor: enemy.displayName, target: targetName,
          roll, bonus: enemyAtkBonus, total, vs: targetDifficulty, vsLabel: 'Dif',
          result: 'fumble',
        });
      } else if (total >= targetDifficulty || roll === 20) {
        // Daño base, crit x2 antes de armadura
        let rawDmg = enemy.damage;
        const isCrit = roll === 20;
        if (isCrit) rawDmg *= 2;
        const finalDmg = Math.max(0, rawDmg - targetArmor);
        if (targetPet) {
          pet.health = Math.max(0, pet.health - finalDmg);
          addLog(c, 'enemy', {
            text: `${enemy.displayName} hiere a ${pet.name}`,
            actor: enemy.displayName, target: pet.name,
            roll, bonus: enemyAtkBonus, total, vs: targetDifficulty, vsLabel: 'Dif',
            rawDmg, targetArmor, dmg: finalDmg, hpAfter: pet.health, hpMax: pet.maxHealth,
            result: isCrit ? 'crit' : (finalDmg === 0 ? 'blocked' : 'hit'),
          });
          if (pet.health <= 0) {
            addLog(c, 'system', { text: `${pet.name} cayó. La perdiste.` });
            A.Bus.emit('tame:lost', { name: pet.name });
            p.pet = null;
          }
        } else {
          if (finalDmg > 0) A.State.damagePlayer(finalDmg);
          addLog(c, 'enemy', {
            text: `${enemy.displayName} te hiere`,
            actor: enemy.displayName, target: p.name,
            roll, bonus: enemyAtkBonus, total, vs: targetDifficulty, vsLabel: 'Dif',
            rawDmg, targetArmor, dmg: finalDmg, hpAfter: p.hp, hpMax: p.maxHp,
            result: isCrit ? 'crit' : (finalDmg === 0 ? 'blocked' : 'hit'),
          });
        }
      } else {
        addLog(c, 'enemy', {
          text: `${enemy.displayName} ataca a ${targetName}`,
          actor: enemy.displayName, target: targetName,
          roll, bonus: enemyAtkBonus, total, vs: targetDifficulty, vsLabel: 'Dif',
          result: 'miss',
        });
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
    addLog(c, 'system', { text: `Ganaste ${totalXp} XP.` });
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
      addLog(c, 'system', { text: `¡Subiste al nivel ${A.State.player.level}! Te recuperas por completo.` });
      A.Bus.emit('player:leveled', { newLevel: A.State.player.level });
    }

    // Loot: monedas (acumular total) y drops (agrupar por itemId)
    let totalCoins = 0;
    const aggregatedDrops = {}; // { itemId: { item, qty } }

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
          const item = A.Data.getById('items', d.itemId)
                    || A.Data.getById('weapons', d.itemId)
                    || A.Data.getById('armors', d.itemId);
          if (ok && item) {
            if (!aggregatedDrops[d.itemId]) aggregatedDrops[d.itemId] = { item, qty: 0 };
            aggregatedDrops[d.itemId].qty += 1;
          } else if (!ok) {
            addLog(c, 'loot', { text: `Hubo botín pero no entró en la mochila.` });
          }
        }
      }
    }
    if (totalCoins > 0) {
      A.Currency.add(totalCoins);
      addLog(c, 'loot', { text: `Recogiste ${A.Currency.formatPrice(totalCoins)}.` });
    }
    // Mostrar drops agregados como una sola línea
    const dropList = Object.values(aggregatedDrops);
    if (dropList.length > 0) {
      const dropStr = dropList.map((d) =>
        d.qty > 1 ? `${d.item.icon} ${d.item.name} ×${d.qty}` : `${d.item.icon} ${d.item.name}`
      ).join(', ');
      addLog(c, 'loot', { text: `Botín: ${dropStr}` });
    }

    // Incrementar contador de región
    if (A.State.world && A.State.world.regionId) {
      A.State.incrementRegionEncounters(A.State.world.regionId);
      const total = A.State.encountersInRegion(A.State.world.regionId);
      addLog(c, 'system', { text: `Encuentros completados aquí: ${total}.` });
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

  /**
   * Agrega una entrada al log. Soporta dos formatos:
   *   addLog(c, type, text)              // simple
   *   addLog(c, type, { text, roll, vs, total, result, dmg, target })
   *     roll: número del d20 (para animación)
   *     vs: dificultad o AC contra la que se tiró
   *     total: roll + bonus (si hay)
   *     result: 'hit' | 'miss' | 'crit' | 'fumble'
   *     dmg: daño infligido (si aplica)
   *     target: nombre del objetivo (display)
   *     text: línea principal del log
   */
  function addLog(c, type, payload) {
    const entry = { ts: Date.now(), type };
    if (typeof payload === 'string') {
      entry.text = payload;
    } else {
      Object.assign(entry, payload);
    }
    c.log.push(entry);
    A.Bus.emit('combat:action', entry);
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
