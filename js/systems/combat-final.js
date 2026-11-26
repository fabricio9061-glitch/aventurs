/* ============================================================
   Aventurs — Pelea (8/8): victoria, derrota, botín, registro y la API (A.Combat)
   La pelea está repartida en js/systems/combat*.js. Cada parte deja sus
   funciones en A._pelea y usa las de las otras por su nombre.
   ============================================================ */

(function (A) {
  'use strict';
  const C = (A._pelea = A._pelea || {});
  const { FREE_ITEMS, QUEST_DROP_CHANCE, kit } = C;
  // De las otras partes
  function State(...a) { return C.State(...a); }
  function B(...a) { return C.B(...a); }
  function freeItem(...a) { return C.freeItem(...a); }
  function hidOf(...a) { return C.hidOf(...a); }
  function ctxHid(...a) { return C.ctxHid(...a); }
  function heroesOf(...a) { return C.heroesOf(...a); }
  function allyTargets(...a) { return C.allyTargets(...a); }
  function swapHero(...a) { return C.swapHero(...a); }
  function dropHero(...a) { return C.dropHero(...a); }
  function prepareGroup(...a) { return C.prepareGroup(...a); }
  function fxKey(...a) { return C.fxKey(...a); }
  function start(...a) { return C.start(...a); }
  function isPlayerTurn(...a) { return C.isPlayerTurn(...a); }
  function playerStats(...a) { return C.playerStats(...a); }
  function effectivePlayerSpeed(...a) { return C.effectivePlayerSpeed(...a); }
  function petStats(...a) { return C.petStats(...a); }
  function enemyStats(...a) { return C.enemyStats(...a); }
  function composePlayerDamage(...a) { return C.composePlayerDamage(...a); }
  function applyStatus(...a) { return C.applyStatus(...a); }
  function removeStatus(...a) { return C.removeStatus(...a); }
  function effectLabel(...a) { return C.effectLabel(...a); }
  function checkEnd(...a) { return C.checkEnd(...a); }
  function enemyDown(...a) { return C.enemyDown(...a); }
  function setTarget(...a) { return C.setTarget(...a); }
  function getTarget(...a) { return C.getTarget(...a); }
  function aliveEnemies(...a) { return C.aliveEnemies(...a); }
  function hittableEnemies(...a) { return C.hittableEnemies(...a); }
  function playerAttack(...a) { return C.playerAttack(...a); }
  function powerInfo(...a) { return C.powerInfo(...a); }
  function techniqueInfo(...a) { return C.techniqueInfo(...a); }
  function playerTechnique(...a) { return C.playerTechnique(...a); }
  function disciplineInfo(...a) { return C.disciplineInfo(...a); }
  function playerPowerAttack(...a) { return C.playerPowerAttack(...a); }
  function spellInfo(...a) { return C.spellInfo(...a); }
  function playerSpell(...a) { return C.playerSpell(...a); }
  function playerUseItem(...a) { return C.playerUseItem(...a); }
  function playerTame(...a) { return C.playerTame(...a); }
  function canFlee(...a) { return C.canFlee(...a); }
  function playerFlee(...a) { return C.playerFlee(...a); }
  function allyKey(...a) { return C.allyKey(...a); }
  function alliesOf(...a) { return C.alliesOf(...a); }
  function summonAlly(...a) { return C.summonAlly(...a); }
  function enemyStrike(...a) { return C.enemyStrike(...a); }
  function hurtPlayer(...a) { return C.hurtPlayer(...a); }

  // ============================================================
  // Resultado
  // ============================================================

  /** XP, subida de nivel, XP de mascota y loot de los enemigos indicados. */
  function grantRewards(c, defeated) {
    const p = A.State.player;
    const acc = (k) => (A.Accessories ? A.Accessories.bonus(p, k) : 0);
    const EL = B().ELITE || { xp: 1, coin: 1, drop: 1 };
    // v3.3: en grupo cada uno gana lo mismo que si hubiera peleado solo: lo que dan las
    // criaturas "de la pelea de uno" (las que se sumaron por ser más no dan premio extra).
    // Antes se repartía (v3.2) y en grupos grandes se tardaba mucho en subir de nivel.
    const share = 1;
    const pool = c && c.party
      ? defeated.slice().sort((a, b) => (a._copy ? 1 : 0) - (b._copy ? 1 : 0)).slice(0, c.baseCount || defeated.length)
      : defeated;
    // v2.5: la élite da más; lo invocado, la mitad de XP y nada de botín
    const xpMult = (e) => (e.fled ? 0.5 : 1) * (e.elite ? EL.xp : 1) * (e.summoned ? 0.5 : 1) * (e.shiny ? 2 : 1) * (e.miniBoss ? 2.5 : 1); // v3.9: la brillante, el doble · v3.11.1: mini jefe ×2,5
    let totalXp = 0;
    // v3.0: la experiencia depende también de la diferencia de nivel (ver Progression.levelGapMult)
    for (const e of pool) totalXp += Math.round(A.Progression.xpForEnemy(e) * xpMult(e) * (A.Progression.levelGapMult ? A.Progression.levelGapMult(p.level, e.tier) : 1));
    totalXp = Math.round(totalXp * share);
    // v2.4: Amuleto de sabiduría
    if (acc('xp') > 0) totalXp = Math.round(totalXp * (1 + acc('xp')));
    if (totalXp > 0) {
      p.xp = (p.xp || 0) + totalXp;
      addLog(c, 'system', { text: `Ganaste ${totalXp} XP.`, fx: { kind: 'reward', xp: totalXp } });
      A.Bus.emit('player:xp-changed', { current: p.xp, toNext: A.Progression.xpForLevel(p.level + 1) });
      for (const lv of A.Progression.checkLevelUp(p)) {
        addLog(c, 'system', { text: `¡Subiste al nivel ${lv.level}! ${lv.text}. Te recuperás por completo.`, fx: { kind: 'reward', levelUp: lv.level } });
        A.State.addChronicle({ type: 'system', text: `¡Subiste al nivel ${lv.level}! ${lv.text}.` });
        A.Bus.emit('player:leveled', { newLevel: lv.level });
      }
    }

    // Mascota: gana la mitad de la XP si terminó consciente
    const pet = p.pet;
    // v3.9: con hambre no aprende nada
    if (pet && pet.health > 0 && totalXp > 0 && pet.food != null && pet.food <= 0) addLog(c, 'system', { text: `${pet.name} no ganó experiencia: tenía hambre.`, fx: { kind: 'note' }, say: { text: `${pet.name} peleó con la panza vacía: no aprende nada esta vez.`, tone: 'bad' } });
    else if (pet && pet.health > 0 && totalXp > 0 && A.Tame && A.Tame.addPetXp) {
      const petXp = Math.floor(totalXp / 2);
      addLog(c, 'system', { text: `${pet.name} ganó ${petXp} XP.`, fx: { kind: 'reward', petXp } });
      for (const msg of A.Tame.addPetXp(pet, petXp)) addLog(c, 'system', { text: msg, fx: { kind: 'note' } });
    }

    // v3.14: después de ganar, un respiro: el que pelea con magia recupera parte de la vida
    // (desde que curarse con magia es de pocas razas, sin esto magos e híbridos no aguantaban dos peleas seguidas)
    // (solo magos e híbridos: los guerreros nunca se curaban con magia y ya aguantaban igual)
    // v3.15: puede ser un número o uno por clase ({ mage, hybrid })
    const cls = B().classOf ? B().classOf(p) : null;
    const WH = B().WIN_HEAL || 0;
    const breath = p.hasMagic && cls && cls !== 'warrior' ? (typeof WH === 'number' ? WH : (WH[cls] || 0)) : 0;
    if (breath > 0 && p.hp > 0 && p.hp < p.maxHp) {
      const before = p.hp;
      A.State.healHp(Math.max(1, Math.round(p.maxHp * breath)));
      if (p.hp > before) addLog(c, 'system', { text: `Un respiro después de la pelea: +${p.hp - before} de vida.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: p.hp - before } });
    }

    // Loot
    let totalCoins = 0;
    const aggregated = {};
    // v2.4: Talismán de la fortuna y Trébol; y lo que pide una misión en curso cae más seguido
    const goldMult = 1 + acc('gold');
    // v3.9: las brillantes dejan una gema (según su nivel) y el triple de monedas
    const SHINY_GEMS = [['perla_pequeña', 'fragmento_cuarzo'], ['mat_amatista', 'mat_topacio'], ['mat_rubi', 'mat_zafiro', 'mat_esmeralda']];
    for (const inst of defeated) {
      if (!inst.shiny || inst.summoned) continue;
      const band = (inst.tier || 1) <= 3 ? 0 : (inst.tier || 1) <= 6 ? 1 : 2;
      const pool = SHINY_GEMS[band].filter((id) => A.Inventory.resolveData(id));
      const gem = pool[Math.floor(Math.random() * pool.length)];
      if (gem && A.State.addItem(gem, 1)) {
        const gd = A.Inventory.resolveData(gem);
        addLog(c, 'loot', { text: `${inst.displayName} deja ${gd.name}.`, fx: { kind: 'reward', items: [{ itemId: gem, qty: 1 }] }, say: { text: `Donde cayó ${A.Skills ? A.Skills.noun(inst) : inst.displayName} queda brillando: ${gd.name.toLowerCase()}.`, tone: 'good' } });
      }
    }
    const dropMult = 1 + acc('drops');
    const wanted = A.Quests && A.Quests.wantedItems ? A.Quests.wantedItems() : new Set();
    for (const inst of defeated) {
      const enemyData = A.Data.getById('enemies', inst.id);
      if (!enemyData) continue;
      // v2.5: lo que te robó, vuelve (v3.0: al que se lo robó)
      if (inst.stolen > 0 && (!inst.stolenFrom || !c || !c.party || inst.stolenFrom === hidOf(p))) {
        if (A.Currency && A.Currency.add) A.Currency.add(inst.stolen);
        addLog(c, 'loot', { text: `Recuperás lo que te robó ${inst.displayName}.`, fx: { kind: 'note' }, say: { text: `Recuperás lo que te robó ${A.Skills ? A.Skills.noun(inst) : inst.displayName}: ${A.Narrator ? A.Narrator.coinsInWords(inst.stolen) : inst.stolen}.`, tone: 'good' } });
        inst.stolen = 0;
      }
      if (inst.fled) continue; // v3.15: la que huyó se llevó lo suyo
      if (inst.summoned || !pool.includes(inst)) continue; // lo invocado (y lo que se sumó por ser más) no deja monedas ni botín
      const eliteMult = (inst.elite ? EL.coin : 1) * (inst.shiny ? 3 : 1); // v3.9: brillante, el triple
      const eliteDrop = (inst.elite ? EL.drop : 1) * share;
      // v2.0: cada enemigo suelta monedas según su peligro
      // v3.15: solo los que cargan monedas (las bestias y los bichos, no: dejan materiales que valen más)
      const carriesCoins = !B().Economy || !B().Economy.carriesCoins || B().Economy.carriesCoins(enemyData);
      const sure = carriesCoins && B().Economy && B().Economy.coinsFor ? Math.round(B().Economy.coinsFor(enemyData) * goldMult * eliteMult * share) : 0;
      if (sure > 0) {
        totalCoins += sure;
        if (A.Currency && A.Currency.add) A.Currency.add(sure); else A.State.addItem('coin_copper', sure);
      }
      for (const d of enemyData.drops || []) {
        // las monedas automáticas ya se pagaron arriba; solo cuentan las puestas a mano en el editor
        if (d.itemId === 'coin_copper' && (d.source === 'balance' || d.source === 'auto' || !d.source)) continue;
        let chance = Math.min(0.95, (d.chance || 0) * dropMult * eliteDrop);
        if (wanted.has(d.itemId)) chance = Math.max(chance, QUEST_DROP_CHANCE);
        if (Math.random() >= chance) continue;
        const qMin = Math.max(1, d.qtyMin || 1);
        const qMax = Math.max(qMin, d.qtyMax || qMin);
        const qty = qMin + Math.floor(Math.random() * (qMax - qMin + 1));
        if (d.itemId === 'coin_copper') {
          totalCoins += qty;
          if (A.Currency && A.Currency.add) A.Currency.add(qty); else A.State.addItem(d.itemId, qty);
          continue;
        }
        const ok = A.State.addItem(d.itemId, qty);
        const item = A.Inventory.resolveData ? A.Inventory.resolveData(d.itemId) : A.Data.getById('items', d.itemId);
        if (ok && item) {
          if (!aggregated[d.itemId]) aggregated[d.itemId] = { item, qty: 0 };
          aggregated[d.itemId].qty += qty;
        } else if (!ok) {
          addLog(c, 'loot', { text: 'Hubo botín pero no entró en la mochila.' });
        }
      }
      // v3.0: objetos de misión que suelta esta criatura solo mientras la misión los pide
      for (const itemId of (A.Quests && A.Quests.questDropsFor ? A.Quests.questDropsFor(inst.id) : [])) {
        if (Math.random() >= QUEST_DROP_CHANCE) continue;
        const item = A.Inventory.resolveData ? A.Inventory.resolveData(itemId) : A.Data.getById('items', itemId);
        if (!item) continue;
        if (A.State.addItem(itemId, 1)) {
          if (!aggregated[itemId]) aggregated[itemId] = { item, qty: 0 };
          aggregated[itemId].qty += 1;
        } else {
          addLog(c, 'loot', { text: 'Hubo botín pero no entró en la mochila.' });
        }
      }
      // v3.20: Gema de temple (para el herrero): las élite y los jefes, a veces
      const temple = enemyData.category === 'boss' ? 0.35 : inst.elite ? 0.12 : 0;
      if (temple > 0 && Math.random() < temple && A.Data.getById('items', 'gema_temple')) {
        if (A.State.addItem('gema_temple', 1)) {
          const item = A.Data.getById('items', 'gema_temple');
          if (!aggregated.gema_temple) aggregated.gema_temple = { item, qty: 0 };
          aggregated.gema_temple.qty += 1;
        }
      }
    }
    // v3.9: la rata y el loro encuentran monedas de más
    const bondCoins = A.Tame && A.Tame.ownerBond ? A.Tame.ownerBond(State().player).coins : 0;
    if (totalCoins > 0 && bondCoins > 0) {
      const extra = Math.max(1, Math.round(totalCoins * bondCoins));
      A.Currency.add(extra);
      totalCoins += extra;
    }
    if (totalCoins > 0) addLog(c, 'loot', { text: `Recogiste ${A.Narrator ? A.Narrator.coinsInWords(totalCoins) : A.Currency.formatPrice(totalCoins)}.`, fx: { kind: 'reward', coins: totalCoins } });
    const dropList = Object.values(aggregated);
    if (dropList.length > 0) {
      addLog(c, 'loot', {
        text: `Botín: ${dropList.map((d) => (d.qty > 1 ? `${d.item.name} ×${d.qty}` : d.item.name)).join(', ')}`,
        fx: { kind: 'reward', items: dropList.map((d) => ({ itemId: d.item.id, qty: d.qty })) },
      });
    }
    return totalXp;
  }

  function onVictory() {
    const c = State().combat;
    if (!c || c.result) return;
    c.result = 'victory';
    if (A.Time) A.Time.advance(1, 'combat');

    let firstXp = 0;
    // v3.0: cada héroe recibe lo suyo en su contexto (sus misiones, su diario)
    for (const pw of heroesOf(c)) {
      A.State.withHero(pw, () => {
        if (c.party && pw.hp <= 0) {
          pw.hp = 1;
          addLog(c, 'system', { text: `${pw.name} se levanta con 1 de vida.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: 1 }, say: { text: 'Te levantás del suelo con 1 de vida.', tone: 'neutral' } });
        }
        if (A.Survival) A.Survival.applyTurnTick('combat');
        if (A.Tame && A.Tame.consumePetFood) A.Tame.consumePetFood(1);

        const totalXp = grantRewards(c, c.enemies);
        if (pw === State().me()) firstXp = totalXp;
        // v3.11: le ganaste al jefe en su guarida: vuelve al día siguiente
        if (c.lair && A.Lairs && A.Lairs.recordWin) A.Lairs.recordWin(pw, c.lair);

        // v2.1: al ganar, los magos recuperan parte del maná
        const winShare = B().manaRegenOf ? B().manaRegenOf(pw).win : 0;
        if (winShare > 0 && pw.hasMagic && pw.mana < pw.maxMana) {
          const before = pw.mana;
          A.State.setMana(Math.min(pw.maxMana, pw.mana + Math.max(1, Math.round(pw.maxMana * winShare))));
          if (pw.mana > before) addLog(c, 'system', { text: `Recuperás ${pw.mana - before} de maná.`, fx: { kind: 'reward', mana: pw.mana - before } });
        }
        // v2.1.1: los guerreros tienen aguante: al ganar recuperan parte de la vida
        const hpShare = B().hpRegenOf ? B().hpRegenOf(pw).win : 0;
        if (hpShare > 0 && pw.hp > 0 && pw.hp < pw.maxHp) {
          const before = pw.hp;
          A.State.healHp(Math.max(1, Math.round(pw.maxHp * hpShare)));
          if (pw.hp > before) addLog(c, 'system', { text: `Recuperás ${pw.hp - before} de vida.`, fx: { kind: 'reward', hp: pw.hp - before } });
        }

        if (A.State.world && A.State.world.regionId) {
          A.State.incrementRegionEncounters(A.State.world.regionId);
          if (!c.party) addLog(c, 'system', { text: `Encuentros completados aquí: ${A.State.encountersInRegion(A.State.world.regionId)}.` });
        }
        A.State.addChronicle({ type: 'combat', text: `Venciste a ${A.Narrator && A.Narrator.groupPhrase ? A.Narrator.groupPhrase(c.enemies).text : A.Encounter.describeGroup(c.enemies)} (+${totalXp} XP).` });
        // v2.0: para las misiones ("mata 3 esqueletos")
        A.Bus.emit('combat:victory', { enemyIds: c.enemies.filter((e) => !e.fled).map((e) => e.id), regionId: A.State.world ? A.State.world.regionId : null });
      });
    }
    A.Bus.emit('combat:ended', { result: 'victory', xp: firstXp });
    State().persist();
  }

  /** Terminó porque domaste al último enemigo: recompensa por los que cayeron. */
  function endCombatTamed(instanceId) {
    const c = State().combat;
    if (!c || c.result) return;
    c.result = 'tamed';
    if (A.Time) A.Time.advance(1, 'combat');
    const defeated = c.enemies.filter((e) => e.hp <= 0 && e.instanceId !== instanceId);
    const tamer = State().player;
    const tamed = c.enemies.find((e) => e.instanceId === instanceId);
    addLog(c, 'system', { text: `${tamed ? tamed.name : 'La criatura'} ahora te acompaña.`, fx: tamed ? { kind: 'tamed', target: fxKey(tamed) } : undefined });
    // v3.0: lo de los caídos se reparte entre todos
    let xp = 0;
    for (const h of heroesOf(c)) {
      A.State.withHero(h, () => {
        const got = grantRewards(c, defeated);
        if (h === tamer) xp = got;
        if (got > 0) A.State.addChronicle({ type: 'combat', text: `Combate terminado al domar (+${got} XP).` });
      });
    }
    A.Bus.emit('combat:ended', { result: 'tamed', xp });
    State().persist();
  }

  function onDefeat() {
    const c = State().combat;
    if (!c || c.result) return;
    c.result = 'defeat';
    addLog(c, 'system', { text: c.party ? 'Cayeron en combate.' : 'Caíste en combate.', fx: { kind: 'defeat' } });
    // v3.3: nadie te levantó: cada uno tira su dado de rescate. Si sale, alguien te
    // encuentra y te lleva al pueblo; si no, tu aventura termina (A.Death).
    const group = A.Narrator && A.Narrator.groupPhrase ? A.Narrator.groupPhrase(c.enemies).text : A.Encounter.describeGroup(c.enemies);
    const regionId = A.State.world ? A.State.world.regionId : null;
    c.rescue = {};
    for (const p of heroesOf(c)) {
      A.State.withHero(p, () => {
        p.effects = [];
        if (p.pet) p.pet.effects = [];
        const r = A.Death ? A.Death.rescueRoll(p, { regionId, petUp: !!(p.pet && p.pet.health > 0) }) : null;
        if (!r) { // sin el módulo de la muerte: como antes
          p.hp = 1;
          p.mana = Math.floor(p.maxMana / 2);
          A.State.addChronicle({ type: 'combat', text: `Caíste contra ${group}. Despertás de vuelta en el pueblo.` });
          return;
        }
        r.name = p.name; // para contarlo en las otras compus
        c.rescue[hidOf(p)] = r;
        const dice = A.Death.rollText(r);
        addLog(c, 'system', {
          text: r.ok ? `Dado de rescate: ${dice}. ${r.by} te encontró y te llevó al pueblo.` : `Dado de rescate: ${dice}. Nadie te encontró a tiempo.`,
          roll: r.roll, bonus: r.bonus, total: r.total, vs: r.dc, vsLabel: 'rescate', result: r.ok ? 'hit' : 'miss',
          fx: { kind: 'save', actor: 'player', target: 'player', stat: 'ayuda', rescue: true },
          say: {
            text: r.ok
              ? (r.crit ? `${r.by} te encuentra, te cura las heridas y te lleva al pueblo.` : `${r.by} te encuentra tirado y te lleva al pueblo.`)
              : 'Nadie pasa por ahí. Tu aventura termina acá.',
            tone: r.ok ? 'good' : 'bad',
          },
        });
        if (r.ok) {
          p.hp = r.crit ? Math.max(1, Math.round(p.maxHp / 2)) : 1;
          p.mana = Math.floor(p.maxMana / 2);
          A.State.addChronicle({ type: 'combat', text: `Caíste contra ${group}. ${r.by} te encontró y te llevó al pueblo (dado de rescate: ${dice}).` });
        } else {
          A.Death.killHero(p, 'combat', { text: `Caíste contra ${group} y nadie te encontró a tiempo (dado de rescate: ${dice}).`, regionId });
        }
      });
    }
    // el que había huido antes (el anfitrión) no despierta en el pueblo: siguió su camino
    const me = State().me ? State().me() : State().player;
    const hostOut = c.party && (c.fledHids || []).includes(hidOf(me));
    if (!hostOut) {
      A.State.world.regionId = 'pueblo_inicial';
      A.State.traveling = null;
    }
    A.Bus.emit('combat:ended', { result: 'defeat' });
    State().persist();
  }

  function finish() {
    const c = State().combat;
    const heroes = c && c.party ? heroesOf(c) : [State().player];
    for (const p of heroes) {
      if (!p) continue;
      p.effects = [];
      if (p.pet) p.pet.effects = [];
    }
    State().combat = null;
    State().persist();
  }

  // ============================================================
  // Helpers
  // ============================================================

  function addLog(c, type, payload) {
    const entry = { ts: Date.now(), type };
    if (typeof payload === 'string') entry.text = payload;
    else Object.assign(entry, payload);
    // v1.9.1: el narrador cuenta la acción con palabras (se elige una sola vez)
    // v2.4: si la acción trae su propia frase (objetos, accesorios), se usa esa
    if (A.Narrator && !entry.say) {
      try { entry.say = A.Narrator.say(entry, c); } catch (err) { entry.say = null; }
    } else if (entry.say && entry.say.text && A.Narrator && A.Narrator.contract) {
      entry.say.text = A.Narrator.contract(entry.say.text); // "a el orco" -> "al orco"
    }
    // v3.0: en grupo, de quién es la frase ("vos" = ese héroe) y a qué tarjeta va cada efecto
    // (las líneas del grupo entero, como el comienzo de la pelea, no son de nadie)
    if (c.party && !(entry.fx && entry.fx.kind === 'start')) {
      const hid = ctxHid();
      entry.hid = hid;
      if (entry.fx) {
        for (const k of ['actor', 'target', 'from']) {
          if (entry.fx[k] === 'player') entry.fx[k] = `hero:${hid}`;
          else if (entry.fx[k] === 'pet') entry.fx[k] = `pet:${hid}`;
        }
        if (Array.isArray(entry.fx.also)) entry.fx.also = entry.fx.also.map((k) => (k === 'player' ? `hero:${hid}` : k === 'pet' ? `pet:${hid}` : k));
      }
    }
    // v1.9.1: foto de la vida de todos después de esta acción. La vista la usa
    // para no adelantar el resultado mientras el dado todavía rueda.
    entry._hp = hpSnapshot(c);
    c.log.push(entry);
    A.Bus.emit('combat:action', entry);
  }

  function hpSnapshot(c) {
    const snap = {};
    if (c.party) {
      // v3.0: la vida de cada héroe y cada mascota del grupo
      for (const h of heroesOf(c)) {
        const hid = hidOf(h);
        snap[`hero:${hid}`] = h.hp;
        snap[`mana:${hid}`] = h.mana;
        if (h.pet) snap[`pet:${hid}`] = h.pet.health;
      }
    } else {
      const p = State().player;
      snap.player = p.hp;
      snap.mana = p.mana;
      if (p.pet) snap.pet = p.pet.health;
    }
    for (const e of c.enemies || []) snap[fxKey(e)] = e.hp;
    for (const a of c.allies || []) snap[allyKey(a)] = a.hp; // v3.11
    return snap;
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
      return it && (it.subtype === 'potion' || it.subtype === 'food' || it.subtype === 'scroll');
    });
  }

  /** Para la UI: chance de pegarle a un enemigo (0..1). */
  function hitChanceVs(instance) {
    if (!instance) return 0;
    return B().hitChance(playerStats().attack, enemyStats(instance).defense);
  }

  A.Combat = {
    start,
    finish,
    setTarget,
    getTarget,
    aliveEnemies,
    playerAttack,
    playerPowerAttack,
    playerTechnique, techniqueInfo, // v3.10
    disciplineInfo, // v3.13
    powerInfo,
    playerSpell,
    playerUseItem,
    playerTame,
    playerFlee,
    endCombatTamed,
    availableSpells,
    availableItems,
    effectivePlayerSpeed,
    composePlayerDamage,
    applyStatus,
    removeStatus,
    effectLabel,
    hitChanceVs,
    // v2.5
    canFlee,
    enemyStats,
    petStats,
    kit,
    // v3.0: grupo
    heroesOf,
    dropHero,
    isPlayerTurn,
    // v3.2: pociones y curación para la mascota y los compañeros
    allyTargets,
    // v3.3: las criaturas preparadas para el grupo (para mostrarlas antes de pelear)
    prepareGroup,
    // v3.3
    spellInfo,
    FREE_ITEMS,
    freeItem,
    itemsLeft: () => { const c = State().combat; return Math.max(0, FREE_ITEMS - ((c && c.itemsTurn) || 0)); },
    _swapHero: swapHero,
    // v3.11: aliados invocados (lobo del Aullido)
    summonAlly, alliesOf,
    hittableEnemies,
    _checkEnd: checkEnd, // para las pruebas
    _enemyDown: enemyDown, // v3.12: para las pruebas (estallido, dividirse)
    _enemyStrikeForTest: enemyStrike, _hurtPlayerForTest: hurtPlayer, // v3.13: para las pruebas (escuelas)
  };

  Object.assign(C, { grantRewards, onVictory, endCombatTamed, onDefeat, finish, addLog, hpSnapshot, availableSpells, availableItems, hitChanceVs });
})(window.Aventurs);
