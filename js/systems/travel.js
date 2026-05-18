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

    // v1.7.1: agregamos biome_loot al mix (hallazgos específicos del bioma)
    const weights = isCombat
      ? { nothing: 0.35, minor_loot: 0.08, biome_loot: 0.12, creature: 0.35, narrative: 0.10 }
      : { nothing: 0.45, minor_loot: 0.10, biome_loot: 0.15, creature: 0.08, narrative: 0.22 };

    const kind = A.Utils.weightedPick(weights);

    switch (kind) {
      case 'minor_loot': return resolveLoot(region);
      case 'biome_loot': return resolveBiomeLoot(region) || resolveLoot(region); // fallback si bioma no tiene pool
      case 'creature': return resolveCreature(region);
      case 'narrative': return resolveNarrative(region);
      case 'nothing':
      default: return null;
    }
  }

  /**
   * v1.7.1: Recursos específicos por bioma. Cada bioma tiene un pool de items
   * con peso de rareza propio.
   */
  const BIOME_LOOT_POOLS = {
    forest: [
      { itemId: 'hierba_silvestre', weight: 40, qty: [1, 3], msg: 'Recogiste hierbas silvestres del suelo.' },
      { itemId: 'baya_negra',       weight: 35, qty: [1, 4], msg: 'Encontraste un arbusto con bayas negras maduras.' },
      { itemId: 'pluma_extraña',    weight: 8,  qty: [1, 1], msg: 'Una pluma de colores raros tirada en el camino.' },
      { itemId: 'mat_pluma',        weight: 17, qty: [1, 2], msg: 'Plumas comunes en el suelo.' },
    ],
    plains: [
      { itemId: 'espiga_dorada',  weight: 45, qty: [1, 5], msg: 'Tomaste espigas doradas de la pradera.' },
      { itemId: 'flor_silvestre', weight: 35, qty: [1, 2], msg: 'Recogiste flores silvestres del campo.' },
      { itemId: 'hierba_silvestre', weight: 20, qty: [1, 3], msg: 'Hierbas comunes al borde del camino.' },
    ],
    mountain: [
      { itemId: 'fragmento_cuarzo', weight: 40, qty: [1, 2], msg: 'Un fragmento de cuarzo entre las rocas.' },
      { itemId: 'mineral_hierro',   weight: 30, qty: [1, 2], msg: 'Vetas de hierro asomando entre la piedra.' },
      { itemId: 'mat_cuerno',       weight: 20, qty: [1, 1], msg: 'Un cuerno viejo tirado en un sendero.' },
      { itemId: 'gema_ignea',       weight: 10, qty: [1, 1], msg: '¡Una gema brillante incrustada en la roca!' },
    ],
    desert: [
      { itemId: 'cactus_carnoso',   weight: 40, qty: [1, 2], msg: 'Cortaste pulpa de un cactus seco.' },
      { itemId: 'sal_de_dunas',     weight: 30, qty: [1, 4], msg: 'Cristales de sal entre la arena.' },
      { itemId: 'aguja_escorpion',  weight: 20, qty: [1, 1], msg: 'Un escorpión muerto con la aguja intacta.' },
      { itemId: 'fragmento_hueso_antiguo', weight: 10, qty: [1, 1], msg: 'Huesos blanqueados de un viajero olvidado.' },
    ],
    swamp: [
      { itemId: 'hongo_pantanoso', weight: 45, qty: [1, 3], msg: 'Hongos creciendo sobre tronco podrido.' },
      { itemId: 'piel_anfibio',    weight: 25, qty: [1, 1], msg: 'Una rana enorme dejó su piel.' },
      { itemId: 'hierba_silvestre', weight: 20, qty: [1, 2], msg: 'Hierbas medicinales del pantano.' },
      { itemId: 'pocion_curacion_menor', weight: 10, qty: [1, 1], msg: 'Una poción olvidada en el barro.' },
    ],
    coast: [
      { itemId: 'concha_iridiscente', weight: 50, qty: [1, 3], msg: 'Conchas que cambian de color al sol.' },
      { itemId: 'perla_pequeña',      weight: 15, qty: [1, 1], msg: '¡Una perla pequeña entre las conchas!' },
      { itemId: 'sal_de_dunas',       weight: 25, qty: [1, 3], msg: 'Sal del mar cristalizada en las rocas.' },
      { itemId: 'moneda_antigua',     weight: 10, qty: [1, 1], msg: 'Una moneda oxidada que trajo la marea.' },
    ],
    sea: [
      { itemId: 'concha_iridiscente', weight: 40, qty: [1, 2], msg: 'El barco pasa sobre un banco de conchas.' },
      { itemId: 'perla_pequeña',      weight: 20, qty: [1, 1], msg: 'Tu red sube algo brillante: una perla.' },
      { itemId: 'mat_escama_pez',     weight: 30, qty: [1, 4], msg: 'Escamas de pez quedan en cubierta.' },
      { itemId: 'fragmento_runa',     weight: 10, qty: [1, 1], msg: 'Un fragmento tallado emerge entre las olas.' },
    ],
    cave: [
      { itemId: 'hongo_luminoso',   weight: 40, qty: [1, 2], msg: 'Hongos que iluminan tu camino.' },
      { itemId: 'fragmento_cuarzo', weight: 25, qty: [1, 2], msg: 'Cristales en el techo de la cueva.' },
      { itemId: 'mineral_hierro',   weight: 20, qty: [1, 2], msg: 'Una veta de hierro en la pared.' },
      { itemId: 'moneda_antigua',   weight: 15, qty: [1, 1], msg: 'Una moneda en una grieta. ¿Quién la dejó?' },
    ],
    crypt: [
      { itemId: 'moneda_antigua',          weight: 35, qty: [1, 2], msg: 'Monedas oxidadas entre los nichos.' },
      { itemId: 'fragmento_hueso_antiguo', weight: 30, qty: [1, 2], msg: 'Huesos tallados con símbolos antiguos.' },
      { itemId: 'reliquia_olvidada',       weight: 15, qty: [1, 1], msg: 'Una reliquia que nadie reclamó.' },
      { itemId: 'hongo_luminoso',          weight: 20, qty: [1, 1], msg: 'Un hongo creciendo entre piedras frías.' },
    ],
    graveyard: [
      { itemId: 'moneda_antigua',          weight: 40, qty: [1, 2], msg: 'Monedas dejadas como ofrenda.' },
      { itemId: 'fragmento_hueso_antiguo', weight: 30, qty: [1, 1], msg: 'Un hueso tallado a los pies de una tumba.' },
      { itemId: 'flor_silvestre',          weight: 20, qty: [1, 2], msg: 'Flores marchitas pero aún útiles.' },
      { itemId: 'reliquia_olvidada',       weight: 10, qty: [1, 1], msg: 'Algo metálico apartado entre las lápidas.' },
    ],
    volcano: [
      { itemId: 'obsidiana',        weight: 40, qty: [1, 2], msg: 'Fragmentos negros de vidrio volcánico.' },
      { itemId: 'fragmento_lava',   weight: 30, qty: [1, 1], msg: 'Lava endurecida, todavía tibia.' },
      { itemId: 'gema_ignea',       weight: 15, qty: [1, 1], msg: '¡Una gema ígnea brillando entre la piedra!' },
      { itemId: 'mineral_hierro',   weight: 15, qty: [1, 1], msg: 'Hierro fundido en formas raras.' },
    ],
    hell: [
      { itemId: 'fragmento_lava',  weight: 35, qty: [1, 2], msg: 'El suelo escupe trozos de roca caliente.' },
      { itemId: 'gema_ignea',      weight: 25, qty: [1, 1], msg: 'Una gema ardiente entre cenizas.' },
      { itemId: 'obsidiana',       weight: 20, qty: [1, 2], msg: 'Obsidiana negra como tinta.' },
      { itemId: 'mat_cola_diablillo', weight: 20, qty: [1, 1], msg: 'Una cola arrancada en una pelea ajena.' },
    ],
    ruins: [
      { itemId: 'fragmento_runa',     weight: 35, qty: [1, 1], msg: 'Una runa rota entre los escombros.' },
      { itemId: 'reliquia_olvidada',  weight: 25, qty: [1, 1], msg: 'Una reliquia entre piedras caídas.' },
      { itemId: 'moneda_antigua',     weight: 30, qty: [1, 3], msg: 'Monedas viejas pegadas al barro seco.' },
      { itemId: 'fragmento_hueso_antiguo', weight: 10, qty: [1, 1], msg: 'Restos humanos entre las ruinas.' },
    ],
    arcane: [
      { itemId: 'cristal_mana',    weight: 40, qty: [1, 1], msg: 'Un cristal vibrante en el aire denso.' },
      { itemId: 'polvo_arcano',    weight: 35, qty: [1, 3], msg: 'Polvo plateado flotando sin caer.' },
      { itemId: 'fragmento_runa',  weight: 15, qty: [1, 1], msg: 'Una runa fresca grabada en piedra reciente.' },
      { itemId: 'gema_ignea',      weight: 10, qty: [1, 1], msg: 'Una gema con magia residual.' },
    ],
    lair: [
      { itemId: 'mat_escama_kobold', weight: 30, qty: [1, 3], msg: 'Escamas dispersas en el suelo.' },
      { itemId: 'fragmento_hueso_antiguo', weight: 25, qty: [1, 2], msg: 'Huesos de presas anteriores.' },
      { itemId: 'obsidiana',         weight: 20, qty: [1, 1], msg: 'Un trozo de obsidiana en una pila.' },
      { itemId: 'gema_ignea',        weight: 15, qty: [1, 1], msg: 'Una gema escondida en el nido.' },
      { itemId: 'reliquia_olvidada', weight: 10, qty: [1, 1], msg: 'Algo de un aventurero anterior.' },
    ],
    abyss: [
      { itemId: 'cristal_mana',   weight: 30, qty: [1, 1], msg: 'Un cristal flotando en la oscuridad.' },
      { itemId: 'polvo_arcano',   weight: 30, qty: [1, 2], msg: 'Polvo plateado que se asienta a tus pies.' },
      { itemId: 'fragmento_hueso_antiguo', weight: 20, qty: [1, 2], msg: 'Huesos antiguos que no pertenecen acá.' },
      { itemId: 'reliquia_olvidada', weight: 20, qty: [1, 1], msg: 'Algo metálico de un pasado lejano.' },
    ],
    village: [
      { itemId: 'pan',             weight: 40, qty: [1, 2], msg: 'Te regalan pan recién horneado.' },
      { itemId: 'queso',           weight: 30, qty: [1, 1], msg: 'Un quesero te ofrece una rebanada.' },
      { itemId: 'flor_silvestre',  weight: 15, qty: [1, 2], msg: 'Un niño te ofrece flores del jardín.' },
      { itemId: 'coin_copper',     weight: 15, qty: [3, 8], msg: 'Encontraste monedas tiradas en el mercado.' },
    ],
  };

  /**
   * v1.7.1: Resuelve un hallazgo específico del bioma.
   * Devuelve null si el bioma no tiene pool definido (cae a minor_loot regular).
   */
  function resolveBiomeLoot(region) {
    const biome = region ? region.biome : 'plains';
    const pool = BIOME_LOOT_POOLS[biome];
    if (!pool || pool.length === 0) return null;

    // Pick weighted del pool
    const totalWeight = pool.reduce((sum, e) => sum + (e.weight || 1), 0);
    let r = Math.random() * totalWeight;
    let entry = pool[0];
    for (const e of pool) {
      r -= (e.weight || 1);
      if (r <= 0) { entry = e; break; }
    }

    // Validar que el item existe
    const itemData = A.Data.getById('items', entry.itemId);
    if (!itemData) return null;

    // Calcular cantidad
    const [qMin, qMax] = entry.qty || [1, 1];
    const qty = qMin + Math.floor(Math.random() * (qMax - qMin + 1));

    // Agregar al inventario
    const added = A.State.addItem(entry.itemId, qty);
    if (!added) {
      // Mochila llena: devolver mensaje informativo en vez de loot
      return {
        kind: 'narrative',
        icon: '🎒',
        text: `Viste ${itemData.name.toLowerCase()} en el camino pero tu mochila está llena.`,
        biome,
      };
    }

    return {
      kind: 'biome_loot',
      itemId: entry.itemId,
      itemName: itemData.name,
      icon: itemData.icon || '🎁',
      qty,
      biome,
      text: `${entry.msg} (${itemData.icon || '📦'} ${itemData.name} ×${qty})`,
    };
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
    // v1.6.9: narrativas por bioma expandidas (5+ por bioma) con icons y kinds variados
    const NARRATIVES = {
      forest: [
        { text: 'El viento mueve las copas y nada se mueve abajo.', icon: '🍃' },
        { text: 'Encontrás huellas frescas, no humanas.', icon: '🐾' },
        { text: 'Una rama cruje a tu derecha. Cuando mirás, no hay nada.', icon: '🌳' },
        { text: 'Bayas raras crecen entre las raíces. Ninguna tiene nombre conocido.', icon: '🍒' },
        { text: 'Pájaros que callan al pasar. Vuelven a cantar cuando ya estás lejos.', icon: '🐦' },
      ],
      plains: [
        { text: 'El camino se extiende vacío hasta el horizonte.', icon: '🌾' },
        { text: 'Ves el polvo de un jinete a lo lejos. Ya no está cuando mirás de nuevo.', icon: '💨' },
        { text: 'Una piedra marcada con runas. Las runas no significan nada que entiendas.', icon: '🪨' },
        { text: 'El sol pega fuerte. El silencio también.', icon: '☀️' },
        { text: 'Encontrás un pañuelo abandonado. Nadie lo reclama.', icon: '🧣' },
      ],
      graveyard: [
        { text: 'El aire huele a tierra removida.', icon: '⚰️' },
        { text: 'Una vela apagada sobre una lápida sin nombre.', icon: '🕯️' },
        { text: 'Las flores marchitas tienen los pétalos hacia adentro. No es natural.', icon: '🥀' },
        { text: 'Pasos detrás tuyo. Te detenés. Los pasos también.', icon: '👻' },
        { text: 'Un nombre tachado en una piedra. Casi parece el tuyo.', icon: '✒️' },
      ],
      swamp: [
        { text: 'Burbujas suben sin razón a la superficie del agua.', icon: '💧' },
        { text: 'El barro guarda tus pisadas más profundo de lo que debería.', icon: '🦶' },
        { text: 'Algo se mueve bajo la superficie. Cuando mirás, no hay nada.', icon: '🐊' },
        { text: 'El olor a podrido viene en oleadas, después se va, después vuelve.', icon: '🍂' },
        { text: 'Mosquitos te ignoran. Algo más los está atrayendo.', icon: '🦟' },
      ],
      coast: [
        { text: 'Una gaviota grita y vuelve a callar.', icon: '🌊' },
        { text: 'Olor a sal y madera mojada.', icon: '🌬️' },
        { text: 'Las olas dejan algo brillante. Cuando te acercás, ya no está.', icon: '✨' },
        { text: 'Una botella sin mensaje, llena de arena.', icon: '🍾' },
        { text: 'Restos de un naufragio que el mar trajo de vuelta.', icon: '⚓' },
      ],
      mountain: [
        { text: 'El eco de algo cayendo, lejos.', icon: '⛰️' },
        { text: 'Encontrás una bota gastada. Solo una.', icon: '🥾' },
        { text: 'El aire se vuelve fino. Pensás dos veces lo que pensás.', icon: '🌬️' },
        { text: 'Un pico nevado refleja el sol como un cristal.', icon: '🏔️' },
        { text: 'Una avalancha distante. No te llega.', icon: '🌨️' },
      ],
      desert: [
        { text: 'La arena se mueve aunque no haya viento.', icon: '🏜️' },
        { text: 'Una sombra cruza el sol.', icon: '☀️' },
        { text: 'Huesos blanqueados de una criatura que no reconocés.', icon: '🦴' },
        { text: 'El espejismo de una ciudad. Parpadeás y desaparece.', icon: '🌫️' },
        { text: 'Una caravana abandonada. Las huellas terminan en seco.', icon: '🐪' },
      ],
      cave: [
        { text: 'El silencio adentro pesa más que afuera.', icon: '🕳️' },
        { text: 'Sentís una corriente de aire que no debería estar ahí.', icon: '💨' },
        { text: 'Goteo lento desde algún lugar arriba. No ves de dónde.', icon: '💧' },
        { text: 'Tu antorcha tiembla, pero no hay viento.', icon: '🔥' },
        { text: 'Pinturas en las paredes. Los dibujos te miran.', icon: '🎨' },
      ],
      ruins: [
        { text: 'Una pared se sostiene como si la sostuvieran adentro.', icon: '🏛️' },
        { text: 'Hay tallados que ya no se entienden.', icon: '📜' },
        { text: 'Un altar caído pero limpio. Alguien lo cuida.', icon: '⚱️' },
        { text: 'Pasos antiguos en el polvo. Recientes.', icon: '👣' },
        { text: 'Un eco de palabras en una lengua muerta.', icon: '🗣️' },
      ],
      crypt: [
        { text: 'Tus pasos suenan más fuerte de lo que deberían.', icon: '🪦' },
        { text: 'Algo se cierra a tus espaldas. Cuando girás, está abierto.', icon: '🚪' },
        { text: 'Polvo flotando en haces de luz que no tienen origen.', icon: '✨' },
        { text: 'Una placa metálica con tu nombre grabado. La fecha está en blanco.', icon: '🪙' },
        { text: 'El frío sube por las piedras hasta tus piernas.', icon: '❄️' },
      ],
      sea: [
        { text: 'El barco cruje contra una ola que no estaba.', icon: '⛵' },
        { text: 'Un canto lejano. Te tapás los oídos.', icon: '🎶' },
        { text: 'Una sombra enorme bajo el casco. Después nada.', icon: '🐋' },
        { text: 'El horizonte se inclina, pero nadie más lo nota.', icon: '🌊' },
        { text: 'Estrellas que no existen en ninguna carta.', icon: '⭐' },
      ],
      volcano: [
        { text: 'La piedra está caliente al tacto.', icon: '🌋' },
        { text: 'El humo sube en columnas que parecen mirar.', icon: '💨' },
        { text: 'El suelo vibra cada tanto. Acompasado.', icon: '🪨' },
        { text: 'Una flor crece sobre lava enfriada. No debería.', icon: '🌺' },
        { text: 'El aire huele a azufre y a algo vivo.', icon: '🔥' },
      ],
      hell: [
        { text: 'Algo recuerda tu nombre antes de que lo digas.', icon: '👁️' },
        { text: 'El cielo rojo no cambia. Te empieza a doler.', icon: '🩸' },
        { text: 'Una voz pregunta cosas que vos no querés responder.', icon: '🗣️' },
        { text: 'Los recuerdos buenos se sienten lejos. Los malos, cerca.', icon: '💀' },
        { text: 'Algo te toca el hombro. No hay nadie.', icon: '🤚' },
      ],
      lair: [
        { text: 'Cáscaras del tamaño de un escudo.', icon: '🥚' },
        { text: 'Marcas de garras en piedra dura.', icon: '🐾' },
        { text: 'Calor en el aire. Algo respira cerca.', icon: '🐲' },
        { text: 'Un montículo de huesos limpios. Demasiado limpios.', icon: '🦴' },
        { text: 'El olor a metal viejo y a algo dulce.', icon: '⚒️' },
      ],
      abyss: [
        { text: 'La oscuridad responde cuando la mirás.', icon: '🕳️' },
        { text: 'Una luz lejana abajo. Te alejás.', icon: '💡' },
        { text: 'El piso parece sólido. La sensación de caer no se va.', icon: '⬇️' },
        { text: 'Tu sombra se queda atrás un instante.', icon: '🌑' },
      ],
      arcane: [
        { text: 'El aire vibra. Tu piel también.', icon: '✨' },
        { text: 'Sentís el zumbido del maná, aunque no lo invoques.', icon: '🔮' },
        { text: 'Glifos flotantes que se apagan al pasar.', icon: '📜' },
        { text: 'El tiempo se siente lento. Después rápido. Después raro.', icon: '⏳' },
      ],
      village: [
        { text: 'Niños riendo en alguna calle.', icon: '👦' },
        { text: 'Pan recién horneado en el aire.', icon: '🍞' },
        { text: 'Un mercader te saluda con una inclinación cortés.', icon: '🧑‍🌾' },
        { text: 'Música suave desde una taberna cercana.', icon: '🎵' },
        { text: 'Un perro te sigue unos pasos y vuelve a su casa.', icon: '🐕' },
      ],
    };
    const list = NARRATIVES[biome] || NARRATIVES.plains;
    const choice = A.Utils.randomOf(list);
    const text = typeof choice === 'string' ? choice : choice.text;
    const icon = typeof choice === 'string' ? '✨' : (choice.icon || '✨');
    return { kind: 'narrative', text, icon, biome };
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
    // v1.7.1: helper público para explorar (genera biome_loot fuera del flow de travel)
    resolveBiomeLootStandalone: resolveBiomeLoot,
    neighbors,
    start,
    step,
    cancel,
    complete,
    resolveEvent,
    travel, // legacy alias
  };
})(window.Aventurs);
