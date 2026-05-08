/* ============================================================
   Aventurs — Travel system (progresivo)

   Funcionamiento:
     - start(targetId): inicia un viaje desde la región actual.
       Define totalSteps según distance del destino (2..4).
       Guarda en State.traveling.
       Emite travel:started.

     - step(): avanza un paso. Resuelve un evento aleatorio.
       Emite travel:step y travel:event si aplica.
       Si currentStep alcanza totalSteps, completa el viaje:
         - mueve al jugador al destino
         - limpia State.traveling
         - emite travel:completed.

     - cancel(): cancela el viaje (vuelve al origen). Solo permitido
       si no hay enemigo bloqueando (no implementado en Fase 1, siempre
       se puede cancelar).

   Eventos (resolveEvent es llamado internamente por step):
     - nothing       (45%) -> sin texto
     - minor_loot    (15%) -> 1d10 cobre
     - creature      (30%) -> { enemyId } - aparece criatura. Si tameable,
                              opciones evitar/intentar domar. Si no
                              tameable, solo evitar (Fase 1 sin combate).
     - narrative     (10%) -> flavor text contextual al bioma
   ============================================================ */

(function (A) {
  'use strict';

  /**
   * ¿Puede el jugador viajar a targetId desde la actual?
   * Verifica conexión, viaje en curso, y reqEncounters de la región destino.
   * v1.6.4: Soporta unlockConditions con minLevel, requiredItems, requiredRegions.
   * Devuelve { ok, error?, locked?, requirements? }
   */
  function canTravelToDetailed(targetId) {
    if (State().traveling && !State().traveling.completed) {
      return { ok: false, error: 'Ya estás viajando.' };
    }
    const w = State().world;
    if (!w) return { ok: false, error: 'Sin región actual.' };
    const region = A.Data.getById('regions', w.regionId);
    if (!region) return { ok: false, error: 'Región actual inválida.' };
    if (!(region.connections || []).includes(targetId)) {
      return { ok: false, error: 'No hay camino directo a esa región.' };
    }
    const target = A.Data.getById('regions', targetId);
    if (!target) return { ok: false, error: 'Región destino inválida.' };

    const requirements = evaluateRegionRequirements(target);
    const allMet = requirements.every((r) => r.met);
    if (!allMet) {
      const customMsg = (target.unlockConditions && target.unlockConditions.warningText) || null;
      const failed = requirements.filter((r) => !r.met);
      const errMsg = customMsg || `Faltan ${failed.length} requisito${failed.length > 1 ? 's' : ''}: ${failed.map((r) => r.label).join(', ')}.`;
      return {
        ok: false,
        locked: true,
        error: errMsg,
        requirements,
      };
    }

    return { ok: true, requirements };
  }

  /**
   * v1.6.4: Evalúa requisitos completos de una región (data-driven).
   * Devuelve array de { id, label, met, current, target, hint }
   */
  function evaluateRegionRequirements(region) {
    const result = [];
    const player = State().player;
    const conds = region.unlockConditions || {};

    // 1. Encuentros completados (legacy reqEncounters O unlockConditions.reqEncounters)
    const reqEnc = conds.reqEncounters || region.reqEncounters || 0;
    if (reqEnc > 0) {
      const have = State().totalEncounters();
      result.push({
        id: 'encounters',
        label: `${reqEnc} encuentros`,
        met: have >= reqEnc,
        current: have,
        target: reqEnc,
        hint: `Completá ${reqEnc - have} encuentros más.`,
      });
    }

    // 2. Nivel mínimo
    if (conds.minLevel && player) {
      const lvl = player.level || 1;
      result.push({
        id: 'level',
        label: `Nivel ${conds.minLevel}`,
        met: lvl >= conds.minLevel,
        current: lvl,
        target: conds.minLevel,
        hint: `Subí a nivel ${conds.minLevel}.`,
      });
    }

    // 3. Items requeridos
    if (Array.isArray(conds.requiredItems) && conds.requiredItems.length > 0) {
      for (const itemId of conds.requiredItems) {
        const itemData = A.Data.getById('items', itemId)
                      || A.Data.getById('weapons', itemId)
                      || A.Data.getById('armors', itemId);
        const itemName = itemData ? itemData.name : itemId;
        const has = (player && player.inventory || []).some((s) => s.itemId === itemId && s.qty > 0);
        result.push({
          id: 'item:' + itemId,
          label: itemName,
          met: has,
          current: has ? 1 : 0,
          target: 1,
          hint: `Conseguí ${itemName}.`,
        });
      }
    }

    // 4. Regiones requeridas (visitadas previamente)
    if (Array.isArray(conds.requiredRegions) && conds.requiredRegions.length > 0) {
      const visited = new Set((State().world && State().world.visited) || []);
      for (const regId of conds.requiredRegions) {
        const regData = A.Data.getById('regions', regId);
        const regName = regData ? regData.name : regId;
        result.push({
          id: 'region:' + regId,
          label: regName,
          met: visited.has(regId),
          current: visited.has(regId) ? 1 : 0,
          target: 1,
          hint: `Visitá ${regName} antes.`,
        });
      }
    }

    return result;
  }

  function canTravelTo(targetId) {
    return canTravelToDetailed(targetId).ok;
  }

  function neighbors() {
    const w = State().world;
    if (!w) return [];
    const region = A.Data.getById('regions', w.regionId);
    if (!region) return [];
    return (region.connections || [])
      .map((id) => A.Data.getById('regions', id))
      .filter(Boolean);
  }

  /**
   * Inicia viaje a targetId.
   * Devuelve { ok: bool, error?: string, traveling? }
   */
  /**
   * v1.6.2: Calcula pasos dinámicos según múltiples factores:
   * - distance del destino (1-5)
   * - tipo de bioma del target (montaña, volcán = más lento)
   * - peso de la mochila / cantidad de items
   * - velocidad del personaje (más rápido = menos pasos)
   *
   * Devuelve un número de pasos balanceado, pero ya no "fijo a 4".
   */
  function calculateTravelSteps(target) {
    const distance = clamp(target.distance || 1, 1, 5);
    // Base: distancia × 4 (antes era ×2). Distancia 1 = 4 pasos, 5 = 20.
    let steps = distance * 4;

    // Modificador por bioma del destino
    const biome = target.biome || '';
    const biomeStr = Array.isArray(biome) ? biome.join(',') : String(biome);
    if (/montaña|mountain|volcán|volcano|nieve|snow/.test(biomeStr.toLowerCase())) {
      steps += distance * 2; // montañas son lentas
    } else if (/desierto|desert|pantano|swamp/.test(biomeStr.toLowerCase())) {
      steps += distance; // desiertos/pantanos algo lentos
    } else if (/camino|road|llanura|plains/.test(biomeStr.toLowerCase())) {
      steps -= 1; // caminos son más rápidos
    }

    // Modificador por tier (zonas de mayor tier = más peligrosas/lejanas)
    const tier = Array.isArray(target.tier) ? target.tier[0] : (target.tier || 1);
    if (tier >= 5) steps += 4;
    else if (tier >= 3) steps += 2;

    // Modificador por peso de la mochila
    const player = A.State && A.State.player;
    if (player && Array.isArray(player.inventory)) {
      const usedSlots = A.State.inventoryUsedSlots ? A.State.inventoryUsedSlots() : player.inventory.length;
      const bag = A.Data.getById('bags', player.bagId || 'bag_basic');
      const totalSlots = bag ? bag.slots : 10;
      const fillPct = (usedSlots / totalSlots) * 100;
      if (fillPct >= 90) steps += 3;       // muy cargado
      else if (fillPct >= 70) steps += 2;
      else if (fillPct >= 50) steps += 1;
    }

    // Modificador por velocidad del jugador
    if (player && player.stats && player.stats.speed) {
      const speed = player.stats.speed;
      if (speed >= 18) steps -= 2;        // muy rápido
      else if (speed >= 14) steps -= 1;
      else if (speed <= 6) steps += 2;    // muy lento
    }

    // Clamp al final: mínimo 3, máximo 60
    return Math.max(3, Math.min(60, steps));
  }

  function start(targetId) {
    if (!canTravelTo(targetId)) {
      return { ok: false, error: 'No se puede viajar a esa región desde aquí.' };
    }
    const target = A.Data.getById('regions', targetId);
    if (!target) return { ok: false, error: 'Región inválida.' };

    // v1.6.2: pasos dinámicos según factores
    const totalSteps = calculateTravelSteps(target);
    const fromId = State().world.regionId;

    State().traveling = {
      fromId,
      toId: targetId,
      totalSteps,
      currentStep: 0,
      events: [],
      completed: false,
    };
    State().persist();

    A.Bus.emit('travel:started', { fromId, toId: targetId, totalSteps });
    A.State.addChronicle({
      type: 'travel',
      text: `Partiste hacia ${target.name}. (${totalSteps} pasos estimados)`,
    });
    return { ok: true, traveling: State().traveling };
  }

  /**
   * Avanza un paso del viaje. Resuelve un evento.
   * Devuelve { ok: bool, traveling, event?, completed? }
   */
  function step() {
    const t = State().traveling;
    if (!t || t.completed) return { ok: false, error: 'No hay viaje activo.' };

    t.currentStep += 1;

    // Consumir food por paso
    A.State.consumeFoodForStep();

    // v1.6.2: Si murió de hambre o HP=0 mientras viajaba, MUERTE REAL.
    // No más teleport al pueblo. La crónica ya se generó por Survival.
    if (State().player.hp <= 0) {
      State().traveling = null;
      // El evento player:died-starvation o player:died ya se emitió por Survival.
      // Si el HP llegó a 0 sin estar en starvation, igual disparar muerte normal.
      if (A.Survival && A.Survival.getStatus().id === 'starving') {
        // Survival.deathByStarvation() ya disparó player:died-starvation
      } else {
        A.Bus.emit('player:died', { cause: 'travel-injury' });
      }
      return { ok: false, error: 'Caíste en el camino.', died: true };
    }

    // Si es el último paso, no resolvemos evento (paso final = llegar)
    let event = null;
    if (t.currentStep < t.totalSteps) {
      event = resolveEvent();
      if (event) {
        t.events.push(event);
        A.Bus.emit('travel:event', { kind: event.kind, payload: event });
      }
    }

    A.Bus.emit('travel:step', { currentStep: t.currentStep, totalSteps: t.totalSteps });

    if (t.currentStep >= t.totalSteps) {
      complete();
      return { ok: true, traveling: t, event, completed: true };
    }

    State().persist();
    return { ok: true, traveling: t, event };
  }

  function complete() {
    const t = State().traveling;
    if (!t) return;
    const fromId = t.fromId;
    const toId = t.toId;
    t.completed = true;
    State().traveling = null;
    State().setRegion(toId);
    // v1.5.9: viajar avanza 2 unidades de tiempo
    if (A.Time) A.Time.advance(2, 'travel');
    A.Bus.emit('travel:completed', { fromId, toId });
  }

  /**
   * Cancela el viaje y vuelve al jugador a la región de origen.
   */
  function cancel() {
    const t = State().traveling;
    if (!t) return;
    const fromId = t.fromId;
    State().traveling = null;
    State().persist();
    A.Bus.emit('travel:cancelled', { fromId });
    A.State.addChronicle({ type: 'travel', text: 'Decidiste volver atrás.' });
  }

  // ---------- Resolución de eventos ----------

  function resolveEvent() {
    const target = A.Data.getById('regions', State().traveling.toId);
    const fromRegion = A.Data.getById('regions', State().traveling.fromId);
    const region = target || fromRegion;
    const isCombat = target && target.type === 'combat';

    // Primero probar eventos custom de la región (treasure/find/damage/heal)
    if (target && Array.isArray(target.events) && target.events.length > 0) {
      const customEvent = resolveRegionEvent(target);
      if (customEvent) return customEvent;
    }

    // Pesos según si la región destino es safe o combat
    const weights = isCombat
      ? { nothing: 0.40, minor_loot: 0.10, creature: 0.40, narrative: 0.10 }
      : { nothing: 0.55, minor_loot: 0.15, creature: 0.10, narrative: 0.20 };

    const kind = A.Utils.weightedPick(weights);

    switch (kind) {
      case 'minor_loot': return resolveLoot(region);
      case 'creature': return resolveCreature(region);
      case 'narrative': return resolveNarrative(region);
      case 'nothing':
      default: return null;
    }
  }

  function resolveLoot(region) {
    const amount = 1 + Math.floor(Math.random() * 10);
    A.Currency.add(amount);
    return {
      kind: 'minor_loot',
      amount,
      text: `Encontraste ${amount} de cobre en el camino.`,
    };
  }

  function resolveCreature(region) {
    const targetId = State().traveling.toId;
    // Generar grupo de enemigos via Encounter (respeta encounter config de la región)
    const group = A.Encounter.generate(targetId);
    if (!group || group.length === 0) return null;

    // El primer enemigo del grupo determina el ícono y nombre principales
    const main = group[0];
    const groupDesc = A.Encounter.describeGroup(group);

    return {
      kind: 'creature',
      enemies: group,            // array de instancias listas para combate
      enemyId: main.id,          // legacy: id del primer enemigo (para domar etc.)
      enemyName: groupDesc,
      icon: main.icon,
      tameable: !!A.Data.getById('enemies', main.id)?.tameable,
      category: main.category,
      tier: main.tier,
      text: `Aparecieron en el camino: ${groupDesc}.`,
    };
  }

  function resolveNarrative(region) {
    const biome = region ? region.biome : 'plains';
    const NARRATIVES = {
      forest: ['El viento mueve las copas y nada se mueve abajo.', 'Encontrás huellas frescas, no humanas.'],
      plains: ['El camino se extiende vacío hasta el horizonte.', 'Ves el polvo de un jinete a lo lejos. Ya no está cuando mirás de nuevo.'],
      graveyard: ['El aire huele a tierra removida.', 'Una vela apagada sobre una lápida sin nombre.'],
      swamp: ['Burbujas suben sin razón a la superficie del agua.', 'El barro guarda tus pisadas más profundo de lo que debería.'],
      coast: ['Una gaviota grita y vuelve a callar.', 'Olor a sal y madera mojada.'],
      mountain: ['El eco de algo cayendo, lejos.', 'Encontrás una bota gastada. Solo una.'],
      desert: ['La arena se mueve aunque no haya viento.', 'Una sombra cruza el sol.'],
      cave: ['El silencio adentro pesa más que afuera.', 'Sentís una corriente de aire que no debería estar ahí.'],
      ruins: ['Una pared se sostiene como si la sostuvieran adentro.', 'Hay tallados que ya no se entienden.'],
      crypt: ['Tus pasos suenan más fuerte de lo que deberían.', 'Algo se cierra a tus espaldas. Cuando girás, está abierto.'],
      sea: ['El barco cruje contra una ola que no estaba.', 'Un canto lejano. Te tapás los oídos.'],
      volcano: ['La piedra está caliente al tacto.', 'El humo sube en columnas que parecen mirar.'],
      hell: ['Algo recuerda tu nombre antes de que lo digas.', 'El cielo rojo no cambia. Te empieza a doler.'],
      lair: ['Cáscaras del tamaño de un escudo.', 'Marcas de garras en piedra dura.'],
      abyss: ['La oscuridad responde cuando la mirás.', 'Una luz lejana abajo. Te alejás.'],
      arcane: ['El aire vibra. Tu piel también.', 'Sentís el zumbido del maná, aunque no lo invoques.'],
      village: ['Niños riendo en alguna calle.', 'Pan recién horneado en el aire.'],
    };
    const list = NARRATIVES[biome] || NARRATIVES.plains;
    const text = A.Utils.randomOf(list);
    return { kind: 'narrative', text };
  }

  /**
   * Resuelve un evento específico de la región (definido en region.events).
   * Devuelve { kind, text, ... } o null si no aplica.
   */
  function resolveRegionEvent(region) {
    if (!region || !Array.isArray(region.events) || region.events.length === 0) return null;
    // Cada evento tiene su chance. Probar cada uno; si pega, ejecutar.
    for (const ev of region.events) {
      if (Math.random() * 100 < (ev.chance || 0)) {
        return executeRegionEvent(ev);
      }
    }
    return null;
  }

  function executeRegionEvent(ev) {
    const type = ev.type;
    if (type === 'treasure') {
      const amount = A.Utils.rollDice(ev.amount || '1d10');
      A.Currency.add(amount);
      return {
        kind: 'minor_loot',
        amount,
        text: `Encontraste ${A.Currency.formatPrice(amount)} escondidos.`,
      };
    }
    if (type === 'find' && ev.reward) {
      const item = A.Data.getById('items', ev.reward) ||
                   A.Data.getById('weapons', ev.reward) ||
                   A.Data.getById('armors', ev.reward);
      if (!item) return null;
      const ok = A.State.addItem(ev.reward, 1);
      if (ok) return { kind: 'find', text: `Encontraste: ${item.name}.`, reward: ev.reward };
      return { kind: 'narrative', text: `Encontraste algo (${item.name}) pero no entró en la mochila.` };
    }
    if (type === 'damage') {
      const dmg = A.Utils.rollDice(ev.amount || '1d4');
      A.State.damagePlayer(dmg);
      const flavor = ev.effect || 'Algo te lastimó';
      return { kind: 'event_damage', text: `${flavor}. -${dmg} de salud.`, dmg };
    }
    if (type === 'heal') {
      const amount = A.Utils.rollDice(ev.amount || '1d6');
      A.State.healHp(amount);
      return { kind: 'event_heal', text: `Algo te reconfortó. +${amount} de salud.`, amount };
    }
    return null;
  }

  // ---------- Helpers ----------

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function State() { return A.State; }

  /**
   * Compatibilidad con código que llamaba a Travel.travel(targetId)
   * ahora viaja con un solo step instantáneo (legacy).
   * En general, las views deben usar start() + UI de viaje.
   */
  function travel(targetId) {
    return start(targetId);
  }

  A.Travel = {
    canTravelTo,
    canTravelToDetailed,
    evaluateRegionRequirements,
    neighbors,
    start,
    step,
    cancel,
    complete,
    resolveEvent,
    travel, // legacy alias
  };
})(window.Aventurs);
