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

    // ---- Calcular iniciativa ----
    // El orden lo determina la VELOCIDAD pura. Solo cuando hay empate de velocidad
    // entre 2+ combatientes, esos combatientes tiran d20 entre sí para desempatar.
    const p = State().player;
    const initiative = [];
    const playerEffSpeed = effectivePlayerSpeed(p);
    initiative.push({
      kind: 'player',
      id: 'player',
      name: p.name,
      speed: playerEffSpeed,
      tieRoll: 0, // se asigna abajo si hay empate
    });
    if (p.pet && p.pet.health > 0) {
      initiative.push({
        kind: 'pet',
        id: 'pet',
        name: p.pet.name,
        speed: p.pet.speed || 10,
        tieRoll: 0,
      });
    }
    for (const inst of instances) {
      initiative.push({
        kind: 'enemy',
        id: inst.instanceId,
        name: inst.displayName,
        speed: inst.speed || 10,
        tieRoll: 0,
      });
    }

    // Detectar empates: agrupar por speed
    const bySpeed = {};
    for (const a of initiative) {
      if (!bySpeed[a.speed]) bySpeed[a.speed] = [];
      bySpeed[a.speed].push(a);
    }
    // Asignar tieRoll a los empatados
    const tieGroups = []; // para loguear
    for (const speedKey of Object.keys(bySpeed)) {
      const group = bySpeed[speedKey];
      if (group.length > 1) {
        for (const a of group) {
          a.tieRoll = A.Utils.dice(20);
        }
        tieGroups.push({ speed: parseInt(speedKey, 10), members: group });
      }
    }

    // Ordenar: speed desc, luego tieRoll desc
    initiative.sort((a, b) => {
      if (b.speed !== a.speed) return b.speed - a.speed;
      return b.tieRoll - a.tieRoll;
    });

    const combat = {
      enemies: instances,
      targetInstanceId: instances[0].instanceId,
      round: 1,
      initiative,
      currentActorIdx: 0,
      log: [],
      result: null,
      fromTravel: !!opts.fromTravel,
    };

    // Para compatibilidad con código que mira c.turn, derivamos
    combat.turn = currentTurnKind(combat);

    State().combat = combat;

    addLog(combat, 'system', { text: `Comienza el combate contra ${A.Encounter.describeGroup(instances)}.` });
    addLog(combat, 'system', { text: `Orden por velocidad: ${initiative.map((i) => `${i.name} (vel ${i.speed})`).join(' → ')}` });
    // Si hubo empates, loguear el desempate por d20
    for (const tg of tieGroups) {
      const desc = tg.members
        .map((m) => `${m.name}: ${m.tieRoll}`)
        .join(', ');
      addLog(combat, 'system', { text: `⚖️ Empate de velocidad ${tg.speed} → desempate D20: ${desc}` });
    }
    addTurnHeader(combat, 1);

    A.Bus.emit('combat:started', { count: instances.length });
    State().persist();

    // Si el primer turno NO es del jugador, ejecutar automaticamente
    setTimeout(() => advanceIfNotPlayer(), 600);
    return true;
  }

  function currentTurnKind(combat) {
    const cur = combat.initiative[combat.currentActorIdx];
    return cur ? cur.kind : 'player';
  }

  function isPlayerTurn(combat) {
    if (!combat || !combat.initiative) return false;
    const cur = combat.initiative[combat.currentActorIdx];
    return cur && cur.kind === 'player';
  }

  /**
   * Calcula la velocidad efectiva del jugador, descontando el peso del equipo.
   *   speed_efectiva = stats.speed - sum(weight de equipos)
   * Mínimo 1.
   */
  function effectivePlayerSpeed(player) {
    if (!player) return 10;
    let speed = player.stats.speed || 10;
    let totalWeight = 0;
    if (player.equipment.weapon) {
      const w = A.Data.getById('weapons', player.equipment.weapon);
      if (w && w.weight) totalWeight += w.weight;
    }
    if (player.equipment.armor) {
      const a = A.Data.getById('armors', player.equipment.armor);
      if (a && a.weight) totalWeight += a.weight;
    }
    return Math.max(1, speed - totalWeight);
  }

  // ============================================================
  // Status effects (sangrado, veneno, fuego, frío, eléctrico)
  // ============================================================
  // Modelo: cada combatiente tiene .effects = [{type, turns, value, source}]
  //   - bleed: daño por turno, ACUMULA stacks (cada stack añade su value)
  //   - poison: daño por turno, ACUMULA stacks
  //   - fire: daño por turno, NO acumula (refresh el efecto)
  //   - cold: reduce dodge en `value` puntos mientras dure
  //   - shock: probabilidad de aturdir (perder turno)

  function applyStatus(target, type, opts = {}) {
    if (!target) return;
    if (!target.effects) target.effects = [];
    const turns = opts.turns || 3;
    const value = opts.value || 1;
    const source = opts.source || 'unknown';

    if (type === 'fire') {
      // Refresh, no stack
      const existing = target.effects.find((e) => e.type === 'fire');
      if (existing) {
        existing.turns = Math.max(existing.turns, turns);
        existing.value = Math.max(existing.value, value);
        return;
      }
    }

    if (type === 'cold' || type === 'shock' || type === 'blind' || type === 'silence') {
      // Refresh, no stack
      const existing = target.effects.find((e) => e.type === type);
      if (existing) {
        existing.turns = Math.max(existing.turns, turns);
        existing.value = Math.max(existing.value, value);
        return;
      }
    }

    // bleed y poison: stack
    target.effects.push({ type, turns, value, source });
  }

  function removeStatus(target, type) {
    if (!target || !target.effects) return;
    target.effects = target.effects.filter((e) => e.type !== type);
  }

  /**
   * Aplica efectos de tick por turno. Llamado al final del turno del enemigo
   * (afecta al jugador) y al final del turno del jugador (afecta a enemigos).
   */
  function processStatusTickOnPlayer(c) {
    const p = State().player;
    if (!p || p.hp <= 0) return;
    if (!p.effects) p.effects = [];
    let totalDamage = 0;
    const effectLogs = [];

    for (const ef of p.effects) {
      ef.turns -= 1;
      if (ef.type === 'bleed' || ef.type === 'poison' || ef.type === 'fire') {
        totalDamage += ef.value;
        effectLogs.push({ type: ef.type, value: ef.value });
      }
    }
    p.effects = p.effects.filter((e) => e.turns > 0);

    if (totalDamage > 0) {
      A.State.damagePlayer(totalDamage);
      const summary = effectLogs
        .map((e) => `${effectLabel(e.type)} ${e.value}`)
        .join(', ');
      addLog(c, 'system', {
        text: `Efectos: ${summary}. -${totalDamage} salud (HP ${p.hp}/${p.maxHp})`,
      });
    }
  }

  function processStatusTickOnEnemy(c, enemy) {
    if (!enemy || enemy.hp <= 0) return;
    if (!enemy.effects) enemy.effects = [];
    let totalDamage = 0;
    const effectLogs = [];

    for (const ef of enemy.effects) {
      ef.turns -= 1;
      if (ef.type === 'bleed' || ef.type === 'poison' || ef.type === 'fire') {
        totalDamage += ef.value;
        effectLogs.push({ type: ef.type, value: ef.value });
      }
    }
    enemy.effects = enemy.effects.filter((e) => e.turns > 0);

    if (totalDamage > 0) {
      enemy.hp = Math.max(0, enemy.hp - totalDamage);
      const summary = effectLogs
        .map((e) => `${effectLabel(e.type)} ${e.value}`)
        .join(', ');
      addLog(c, 'system', {
        text: `${enemy.displayName} sufre ${summary} (-${totalDamage}, HP ${enemy.hp}/${enemy.maxHp})`,
      });
      if (enemy.hp <= 0) {
        addLog(c, 'system', { text: `${enemy.displayName} cayó por los efectos.` });
      }
    }
  }

  function effectLabel(type) {
    return ({
      bleed: '🩸 sangrado',
      poison: '☠️ veneno',
      fire: '🔥 fuego',
      cold: '❄️ frío',
      shock: '⚡ choque',
      blind: '🌫️ ceguera',
      silence: '🤐 silencio',
    })[type] || type;
  }

  /**
   * Aplica un efecto al impactar (probabilístico) según el arma o hechizo.
   * Se llama desde playerAttack o spell cast.
   */
  function maybeInflictStatusOnHit(weapon, target) {
    if (!weapon || !target) return;
    // weapon.statusEffect = { type, chance, turns, value }
    const eff = weapon.statusEffect;
    if (!eff) return;
    if (Math.random() > (eff.chance || 0)) return;
    applyStatus(target, eff.type, {
      turns: eff.turns || 3,
      value: eff.value || 1,
      source: weapon.id,
    });
  }

  /**
   * Tira el daño de un enemigo. Acepta:
   *  - notación de dados ('1d6', '2d4+1')
   *  - número (legacy fallback)
   */
  function rollDamage(notationOrNumber) {
    if (typeof notationOrNumber === 'number') return notationOrNumber;
    if (typeof notationOrNumber !== 'string') return 1;
    return A.Utils.rollDice(notationOrNumber);
  }

  /**
   * Calcula el bonus de ataque del enemigo a partir de su daño.
   * Para dados, usamos el "máximo posible" / 4 como bonus.
   */
  function computeAtkBonus(damageNotation) {
    if (typeof damageNotation === 'number') return Math.floor(damageNotation / 4);
    if (typeof damageNotation !== 'string') return 0;
    // Parse "NdM+K"
    const match = damageNotation.match(/^(\d+)d(\d+)(?:\+(\d+))?$/);
    if (!match) return 0;
    const dice = parseInt(match[1], 10);
    const sides = parseInt(match[2], 10);
    const bonus = parseInt(match[3] || '0', 10);
    const maxDmg = dice * sides + bonus;
    return Math.floor(maxDmg / 4);
  }

  function addTurnHeader(c, n) {
    addLog(c, 'turn-header', { text: `── Turno ${n} ──`, turnNumber: n });
  }

  /**
   * Avanza al siguiente actor vivo. Si no es el jugador, ejecuta su turno.
   * Si es el jugador, queda esperando input.
   */
  function advanceIfNotPlayer() {
    const c = State().combat;
    if (!c || c.result) return;
    // Verificar fin de combate
    if (aliveEnemies().length === 0) { onVictory(); A.Bus.emit('combat:ended', { result: 'victory' }); return; }
    if (State().player.hp <= 0) { onDefeat(); A.Bus.emit('combat:ended', { result: 'defeat' }); return; }

    const cur = c.initiative[c.currentActorIdx];
    if (!cur) {
      // Ronda terminada: nueva ronda
      c.round += 1;
      c.currentActorIdx = 0;
      addTurnHeader(c, c.round);
      State().persist();
      A.Bus.emit('combat:turn', { round: c.round });
      setTimeout(() => advanceIfNotPlayer(), 600);
      return;
    }

    // Saltear actores muertos
    if (cur.kind === 'enemy') {
      const inst = c.enemies.find((e) => e.instanceId === cur.id);
      if (!inst || inst.hp <= 0) {
        c.currentActorIdx += 1;
        return advanceIfNotPlayer();
      }
    } else if (cur.kind === 'pet') {
      if (!State().player.pet || State().player.pet.health <= 0) {
        c.currentActorIdx += 1;
        return advanceIfNotPlayer();
      }
    } else if (cur.kind === 'player') {
      if (State().player.hp <= 0) {
        c.currentActorIdx += 1;
        return advanceIfNotPlayer();
      }
    }

    c.turn = cur.kind;
    State().persist();
    A.Bus.emit('combat:turn', { actor: cur.kind, round: c.round });

    if (cur.kind === 'enemy') {
      const inst = c.enemies.find((e) => e.instanceId === cur.id);
      setTimeout(() => executeEnemyAction(inst), 700);
    } else if (cur.kind === 'pet') {
      setTimeout(() => executePetAction(), 600);
    }
    // Si es player, queda esperando input. Las funciones playerAttack/spell/etc llaman
    // a afterPlayerAction() que avanza el índice.
  }

  function nextActor() {
    const c = State().combat;
    if (!c) return;
    c.currentActorIdx += 1;
    // Si superó el array, advanceIfNotPlayer va a iniciar nueva ronda
    if (c.currentActorIdx >= c.initiative.length) {
      c.currentActorIdx = c.initiative.length; // (queda fuera del array para que advance arranque ronda)
    }
    setTimeout(() => advanceIfNotPlayer(), 400);
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
    if (!c || c.result || !isPlayerTurn(c)) return;
    const target = getTarget();
    if (!target) { onVictory(); return; }
    const p = State().player;
    const precBonus = Math.floor((p.stats.precision || 0) / 2);
    const roll = A.Utils.dice(20);
    const total = roll + precBonus;

    // Modelo simplificado: 1 = fumble (falla), 20 = crítico (no esquivable),
    // resto = el defensor intenta esquivar con d20+(dodge/2) ≥ 12
    if (roll === 1) {
      addLog(c, 'player', {
        text: `Atacaste a ${target.displayName} pero fallaste por completo`,
        actor: p.name, target: target.displayName, actorIcon: '🗡️',
        roll, bonus: precBonus, total,
        result: 'fumble',
      });
    } else {
      const weaponId = p.equipment.weapon;
      const weapon = weaponId ? A.Data.getById('weapons', weaponId) : null;
      const damageDice = weapon ? weapon.damage : '1d3';
      const isCrit = roll === 20;

      // El defensor intenta esquivar (excepto en críticos)
      const enemyDodgeStat = target.dodge || 0;
      const dodgeBonus = Math.floor(enemyDodgeStat / 2);
      const dodgeRoll = A.Utils.dice(20);
      const dodgeTotal = dodgeRoll + dodgeBonus;
      const dodgeDifficulty = 12;
      const enemyEvades = !isCrit && dodgeTotal >= dodgeDifficulty;

      if (enemyEvades) {
        addLog(c, 'player', {
          text: `${target.displayName} esquivó tu ataque`,
          actor: p.name, target: target.displayName, actorIcon: '🗡️',
          weapon: weapon ? weapon.name : 'puños',
          roll, bonus: precBonus, total,
          dodgeRoll, dodgeBonus, dodgeTotal, dodgeVs: dodgeDifficulty,
          result: 'evaded',
        });
      } else {
        const damageRoll = A.Utils.rollDice(damageDice);
        let rawDmg = damageRoll + (p.stats.damage || 0);
        if (isCrit) rawDmg *= 2;
        const targetArmor = target.armor || 0;
        const finalDmg = Math.max(0, rawDmg - targetArmor);
        target.hp = Math.max(0, target.hp - finalDmg);
        addLog(c, 'player', {
          text: isCrit ? `¡Golpe crítico a ${target.displayName}!` : `Atacaste a ${target.displayName}`,
          actor: p.name, target: target.displayName, actorIcon: '🗡️',
          weapon: weapon ? weapon.name : 'puños',
          damageDice,
          roll, bonus: precBonus, total,
          dodgeRoll: isCrit ? null : dodgeRoll, dodgeTotal: isCrit ? null : dodgeTotal, dodgeVs: dodgeDifficulty,
          rawDmg, targetArmor, dmg: finalDmg, hpAfter: target.hp, hpMax: target.maxHp,
          result: isCrit ? 'crit' : (finalDmg === 0 ? 'blocked' : 'hit'),
        });

        if (finalDmg > 0 && weapon) {
          maybeInflictStatusOnHit(weapon, target);
        }

        if (target.hp <= 0) {
          addLog(c, 'system', { text: `${target.displayName} cayó.`, killed: target.displayName });
          maybeDropEquippedWeapon(c, target);
        }
      }
    }

    if (target && target.hp > 0) processStatusTickOnEnemy(c, target);
    afterPlayerAction();
  }

  /**
   * Si el enemigo es humanoide y tenía un arma equipada (equippedWeapon),
   * tirar probabilidad de drop. Lo llamamos al matarlo.
   */
  function maybeDropEquippedWeapon(c, enemy) {
    if (!enemy.equippedWeapon) return;
    if (Math.random() > 0.20) return; // 20% de drop
    const ok = A.State.addItem(enemy.equippedWeapon, 1);
    if (ok) {
      const w = A.Data.getById('weapons', enemy.equippedWeapon);
      if (w) addLog(c, 'loot', { text: `Recogiste ${w.name} de ${enemy.displayName}.` });
    }
  }

  function playerSpell(spellId) {
    const c = State().combat;
    if (!c || c.result || !isPlayerTurn(c)) return;
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
    if (!c || c.result || !isPlayerTurn(c)) return;
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
    if (!c || c.result || !isPlayerTurn(c)) return;

    // Inicializar contador de intentos en el combate si no está
    if (c.fleeAttempts === undefined) c.fleeAttempts = 0;

    if (c.fleeAttempts >= 2) {
      addLog(c, 'system', { text: 'Ya intentaste huir 2 veces. No podés volver a intentarlo.' });
      return;
    }

    c.fleeAttempts += 1;
    const p = State().player;
    const fastest = Math.max(...aliveEnemies().map((e) => e.speed || 10));
    // Dificultad de huida: 10 + (speed enemigo más rápido - speed jugador efectiva), capeado 8-18
    const playerSpeed = effectivePlayerSpeed(p);
    const fleeDC = Math.max(8, Math.min(18, 10 + (fastest - playerSpeed)));
    const fleeRoll = A.Utils.dice(20);
    const fleeBonus = Math.floor(playerSpeed / 4);
    const fleeTotal = fleeRoll + fleeBonus;

    if (fleeTotal >= fleeDC) {
      addLog(c, 'system', {
        text: `Lograste escapar (intento ${c.fleeAttempts}/2).`,
        roll: fleeRoll, bonus: fleeBonus, total: fleeTotal, vs: fleeDC, vsLabel: 'DC huida',
        result: 'hit',
      });
      c.result = 'flee';
      A.Bus.emit('combat:ended', { result: 'flee' });
      State().persist();
    } else {
      // Fallaste: log + el enemigo más rápido te pega gratis
      const remaining = 2 - c.fleeAttempts;
      addLog(c, 'system', {
        text: `Intento de huida fallido (${c.fleeAttempts}/2). ${remaining > 0 ? 'Te queda 1 intento.' : 'No podés volver a intentar.'}`,
        roll: fleeRoll, bonus: fleeBonus, total: fleeTotal, vs: fleeDC, vsLabel: 'DC huida',
        result: 'miss',
      });
      // Enemigo más rápido pega
      const fastestEnemy = aliveEnemies().reduce((a, b) => ((b.speed || 0) > (a.speed || 0) ? b : a));
      if (fastestEnemy) {
        addLog(c, 'system', { text: `${fastestEnemy.displayName} aprovecha tu fallo y te ataca.` });
        executeFreeAttack(fastestEnemy);
      }
      // Avanzar al siguiente actor (perdés turno)
      if (p.hp <= 0) { onDefeat(); A.Bus.emit('combat:ended', { result: 'defeat' }); return; }
      afterPlayerAction();
    }
  }

  /**
   * Ataque "gratis" de un enemigo, sin pasar por la cola de iniciativa.
   * Usado cuando el jugador falla huir.
   */
  function executeFreeAttack(enemy) {
    const c = State().combat;
    if (!c || c.result) return;
    const p = State().player;
    const equipArmor = p.equipment.armor ? A.Data.getById('armors', p.equipment.armor) : null;
    const playerArmor = (p.stats.armor || 0) + (equipArmor ? equipArmor.defense : 0);
    const damageNotation = enemy.damage;
    const rawDmg = rollDamage(damageNotation);
    const finalDmg = Math.max(0, rawDmg - playerArmor);
    if (finalDmg > 0) A.State.damagePlayer(finalDmg);
    addLog(c, 'enemy', {
      text: `${enemy.displayName} te golpea por la huida fallida`,
      actor: enemy.displayName, target: p.name,
      rawDmg, targetArmor: playerArmor, dmg: finalDmg,
      hpAfter: p.hp, hpMax: p.maxHp,
      damageDice: damageNotation,
      result: finalDmg === 0 ? 'blocked' : 'hit',
    });
  }

  // ---------- Después de la acción del jugador ----------

  function afterPlayerAction() {
    const c = State().combat;
    if (!c) return;
    State().persist();
    // Forzar re-render del view para que se vea la acción del jugador ANTES
    // de avanzar al siguiente actor (especialmente importante si era el último turno
    // y se va a agregar un turn-header nueva ronda)
    A.Bus.emit('combat:action', { actor: 'player' });
    if (aliveEnemies().length === 0) { onVictory(); A.Bus.emit('combat:ended', { result: 'victory' }); return; }
    nextActor();
  }

  /**
   * Acción de la mascota. La invoca advanceIfNotPlayer cuando el actor actual es 'pet'.
   */
  function executePetAction() {
    const c = State().combat;
    if (!c || c.result) return;
    const pet = State().player.pet;
    if (!pet || pet.health <= 0) { nextActor(); return; }
    const alive = aliveEnemies();
    if (alive.length === 0) { nextActor(); return; }
    const target = alive[Math.floor(Math.random() * alive.length)];
    const targetDodge = target.dodge || 0;
    const targetArmor = target.armor || 0;
    const petIcon = pet.icon || '🐾';
    const roll = A.Utils.dice(20);

    if (roll === 1) {
      addLog(c, 'pet', {
        text: `${pet.name} ataca a ${target.displayName} pero falla`,
        actor: pet.name, target: target.displayName, actorIcon: petIcon,
        roll, bonus: 0, total: roll,
        result: 'fumble',
      });
    } else {
      const isCrit = roll === 20;
      const dodgeBonus = Math.floor(targetDodge / 2);
      const dodgeRoll = A.Utils.dice(20);
      const dodgeTotal = dodgeRoll + dodgeBonus;
      const dodgeDifficulty = 12;
      const evaded = !isCrit && dodgeTotal >= dodgeDifficulty;

      if (evaded) {
        addLog(c, 'pet', {
          text: `${target.displayName} esquivó el ataque de ${pet.name}`,
          actor: pet.name, target: target.displayName, actorIcon: petIcon,
          roll, bonus: 0, total: roll,
          dodgeRoll, dodgeBonus, dodgeTotal, dodgeVs: dodgeDifficulty,
          result: 'evaded',
        });
      } else {
        let rawDmg = rollDamage(pet.damage);
        if (isCrit) rawDmg *= 2;
        const finalDmg = Math.max(0, rawDmg - targetArmor);
        target.hp = Math.max(0, target.hp - finalDmg);
        addLog(c, 'pet', {
          text: isCrit ? `${pet.name} golpea CRÍTICO a ${target.displayName}` : `${pet.name} ataca a ${target.displayName}`,
          actor: pet.name, target: target.displayName, actorIcon: petIcon,
          damageDice: pet.damage,
          roll, bonus: 0, total: roll,
          dodgeRoll: isCrit ? null : dodgeRoll, dodgeTotal: isCrit ? null : dodgeTotal, dodgeVs: dodgeDifficulty,
          rawDmg, targetArmor, dmg: finalDmg, hpAfter: target.hp, hpMax: target.maxHp,
          result: isCrit ? 'crit' : (finalDmg === 0 ? 'blocked' : 'hit'),
        });
        if (target.hp <= 0) addLog(c, 'system', { text: `${target.displayName} cayó por la mascota.` });
      }
    }
    nextActor();
  }

  // alias legacy
  function petTurn() { executePetAction(); }

  // ---------- Turno del enemigo (un enemigo individual) ----------

  function executeEnemyAction(enemy) {
    const c = State().combat;
    if (!c || c.result) return;
    if (!enemy || enemy.hp <= 0) { nextActor(); return; }

    const p = State().player;
    const equipArmor = p.equipment.armor ? A.Data.getById('armors', p.equipment.armor) : null;
    const playerArmor = (p.stats.armor || 0) + (equipArmor ? equipArmor.defense : 0);

    const damageNotation = enemy.damage;
    const enemyAtkBonus = computeAtkBonus(damageNotation);
    const pet = p.pet;
    const targetPet = pet && pet.health > 0 && Math.random() < 0.4;
    const targetArmor = targetPet ? (pet.armor || 0) : playerArmor;
    const targetName = targetPet ? pet.name : p.name;
    const targetDodge = targetPet ? (pet.dodge || 0) : (p.stats.dodge || 0);
    const enemyIcon = enemy.icon || '👹';

    const roll = A.Utils.dice(20);
    const total = roll + enemyAtkBonus;

    // Modelo simplificado: 1 = fumble, 20 = crítico, defensor esquiva con d20+(dodge/2) ≥ 12
    if (roll === 1) {
      addLog(c, 'enemy', {
        text: `${enemy.displayName} ataca a ${targetName} pero falla por completo`,
        actor: enemy.displayName, target: targetName, actorIcon: enemyIcon,
        roll, bonus: enemyAtkBonus, total,
        result: 'fumble',
      });
    } else {
      // El defensor intenta esquivar (excepto en críticos)
      const isCrit = roll === 20;
      const dodgeBonus = Math.floor(targetDodge / 2);
      const dodgeRoll = A.Utils.dice(20);
      const dodgeTotal = dodgeRoll + dodgeBonus;
      const dodgeDifficulty = 12;
      const evaded = !isCrit && dodgeTotal >= dodgeDifficulty;

      if (evaded) {
        addLog(c, 'enemy', {
          text: `${enemy.displayName} ataca pero ${targetName} esquiva`,
          actor: enemy.displayName, target: targetName, actorIcon: enemyIcon,
          roll, bonus: enemyAtkBonus, total,
          dodgeRoll, dodgeBonus, dodgeTotal, dodgeVs: dodgeDifficulty,
          result: 'evaded',
        });
      } else {
        let rawDmg = rollDamage(damageNotation);
        if (isCrit) rawDmg *= 2;
        const finalDmg = Math.max(0, rawDmg - targetArmor);
        if (targetPet) {
          pet.health = Math.max(0, pet.health - finalDmg);
          addLog(c, 'enemy', {
            text: isCrit ? `${enemy.displayName} golpea CRÍTICO a ${pet.name}` : `${enemy.displayName} hiere a ${pet.name}`,
            actor: enemy.displayName, target: pet.name, actorIcon: enemyIcon,
            roll, bonus: enemyAtkBonus, total,
            dodgeRoll: isCrit ? null : dodgeRoll, dodgeTotal: isCrit ? null : dodgeTotal, dodgeVs: dodgeDifficulty,
            rawDmg, targetArmor, dmg: finalDmg, hpAfter: pet.health, hpMax: pet.maxHealth,
            damageDice: damageNotation,
            result: isCrit ? 'crit' : (finalDmg === 0 ? 'blocked' : 'hit'),
          });
          if (pet.health <= 0) {
            // v1.5.9: la mascota queda en 0 HP, no se elimina.
            // El jugador puede curarla con poción o descansar para recuperarla.
            pet.health = 0;
            addLog(c, 'system', { text: `${pet.name} cayó inconsciente.` });
            A.Bus.emit('pet:knocked-out', { name: pet.name });
          }
        } else {
          if (finalDmg > 0) A.State.damagePlayer(finalDmg);
          addLog(c, 'enemy', {
            text: isCrit ? `${enemy.displayName} golpea CRÍTICO a ${p.name}` : `${enemy.displayName} te hiere`,
            actor: enemy.displayName, target: p.name, actorIcon: enemyIcon,
            roll, bonus: enemyAtkBonus, total,
            dodgeRoll: isCrit ? null : dodgeRoll, dodgeTotal: isCrit ? null : dodgeTotal, dodgeVs: dodgeDifficulty,
            rawDmg, targetArmor, dmg: finalDmg, hpAfter: p.hp, hpMax: p.maxHp,
            damageDice: damageNotation,
            result: isCrit ? 'crit' : (finalDmg === 0 ? 'blocked' : 'hit'),
          });
        }
      }
    }

    // Procesar efectos de estado al final del turno del enemigo (ej: sangrado en player)
    processStatusTickOnPlayer(c);

    if (p.hp <= 0) { onDefeat(); A.Bus.emit('combat:ended', { result: 'defeat' }); return; }
    nextActor();
  }

  // alias legacy
  function enemyTurn() {
    const c = State().combat;
    if (!c) return;
    const cur = c.initiative[c.currentActorIdx];
    if (cur && cur.kind === 'enemy') {
      const inst = c.enemies.find((e) => e.instanceId === cur.id);
      if (inst) executeEnemyAction(inst);
    }
  }

  // ---------- Resultado ----------

  function onVictory() {
    const c = State().combat;
    if (!c) return;
    c.result = 'victory';

    // v1.5.9: combatir avanza 1 unidad de tiempo
    if (A.Time) A.Time.advance(1, 'combat');

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

    // v1.5.9: La mascota también gana XP si participó (estaba viva al menos al inicio).
    // Sube de nivel con thresholds más simples.
    const pet = A.State.player.pet;
    if (pet) {
      const petXp = Math.floor(totalXp * 0.5); // mascota gana 50% de la XP del player
      pet.xp = (pet.xp || 0) + petXp;
      pet.level = pet.level || 1;
      pet.xpNeeded = pet.xpNeeded || pet.level * 30;
      addLog(c, 'system', { text: `${pet.name} ganó ${petXp} XP.` });
      // Level up de la mascota
      while (pet.xp >= pet.xpNeeded) {
        pet.xp -= pet.xpNeeded;
        pet.level += 1;
        pet.maxHealth = (pet.maxHealth || 12) + 3;
        pet.health = pet.maxHealth; // se recupera al subir nivel
        pet.xpNeeded = pet.level * 30;
        addLog(c, 'system', { text: `¡${pet.name} subió al nivel ${pet.level}! +3 salud máxima.` });
        A.Bus.emit('pet:leveled', { name: pet.name, level: pet.level });
      }
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
          // v1.6.0: cantidad random entre qtyMin y qtyMax (default 1-1)
          const qMin = Math.max(1, d.qtyMin || 1);
          const qMax = Math.max(qMin, d.qtyMax || qMin);
          const dropQty = qMin + Math.floor(Math.random() * (qMax - qMin + 1));
          const ok = A.State.addItem(d.itemId, dropQty);
          const item = A.Data.getById('items', d.itemId)
                    || A.Data.getById('weapons', d.itemId)
                    || A.Data.getById('armors', d.itemId);
          if (ok && item) {
            if (!aggregatedDrops[d.itemId]) aggregatedDrops[d.itemId] = { item, qty: 0 };
            aggregatedDrops[d.itemId].qty += dropQty;
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
    effectivePlayerSpeed,
    applyStatus,
    removeStatus,
    effectLabel,
  };
})(window.Aventurs);
