/* ============================================================
   Aventurs — Travel system (v1.8.0)

   Cómo funciona un viaje:
     - start(targetId): solo a regiones conectadas y si cumplís sus
       requisitos (nivel mínimo, items, regiones visitadas).
       Calcula los pasos con calculateTravelSteps (3 a 12, ida = vuelta).
     - step(): avanza un paso. Cada 2 pasos se come 1 de comida y la
       mascota pierde 1 de saciedad. En cada paso puede pasar algo:
         - criatura (28% hacia zonas peligrosas): combate o domar
         - hallazgos del bioma, monedas (según el tier) o narrativa
       El último paso es la llegada (sin evento).
     - cancel(): volvés a la región de origen.

   Progresión del mapa: cada región pide un nivel mínimo igual al tier
   más bajo de sus enemigos (ver js/data/seed-regions.js).
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
   * v1.8.0: Pasos de una ruta. Es SIMÉTRICO: ir de A a B tarda lo mismo que de B a A.
   *   base      = 4 + 3 × distancia de la ruta (la mayor de las dos regiones: 1..3)
   *   terreno   = el más difícil de los dos: montaña/volcán +3, desierto/pantano +2,
   *               llanura/camino -1
   *   carga     = mochila al 70% +1, al 90% +2
   *   velocidad = la real (con el peso del equipo): 14+ -1, 7 o menos +1
   * Resultado entre 5 y 18 pasos (v3.1: viajes más largos).
   * Se come 1 de comida cada 4 pasos, y en cada paso hay menos chance de
   * cruzarse con criaturas: la comida y las peleas de un viaje quedan parecidas.
   */
  function terrainCost(region) {
    const biome = region ? region.biome : '';
    const biomeStr = (Array.isArray(biome) ? biome.join(',') : String(biome || '')).toLowerCase();
    if (/montaña|mountain|volcán|volcano|nieve|snow/.test(biomeStr)) return 3;
    if (/desierto|desert|pantano|swamp/.test(biomeStr)) return 2;
    if (/camino|road|llanura|plains/.test(biomeStr)) return -1;
    return 0;
  }

  function calculateTravelSteps(target, from) {
    const origin = from || A.Data.getById('regions', State().world && State().world.regionId);
    const routeDistance = clamp(Math.max(target.distance || 1, (origin && origin.distance) || 1), 1, 3);
    let steps = 4 + 3 * routeDistance;
    steps += Math.max(terrainCost(target), terrainCost(origin));

    const player = A.State && A.State.player;
    if (player && Array.isArray(player.inventory)) {
      const usedSlots = A.State.inventoryUsedSlots ? A.State.inventoryUsedSlots() : player.inventory.length;
      const bag = A.Data.getById('bags', player.bagId || 'bag_basic');
      const totalSlots = bag ? bag.slots : 10;
      const fillPct = (usedSlots / totalSlots) * 100;
      if (fillPct >= 90) steps += 2;
      else if (fillPct >= 70) steps += 1;
    }
    if (player && player.stats && A.Balance) {
      const speed = A.Balance.playerCombatStats(player).speed;
      if (speed >= 14) steps -= 1;
      else if (speed <= 7) steps += 1;
    }
    const T = (A.Balance && A.Balance.Travel) || { STEPS_MIN: 5, STEPS_MAX: 18 };
    return Math.max(T.STEPS_MIN, Math.min(T.STEPS_MAX, steps));
  }

  /** v3.3: el héroe de esta compu murió (la pantalla de muerte está por salir). */
  function heroDead() {
    const me = A.State.me ? A.State.me() : State().player;
    return !!(me && me.dead);
  }

  function start(targetId) {
    if (heroDead()) return { ok: false, error: 'Tu aventura terminó.' };
    // v1.8.0: devolver el motivo real (nivel, items, ya viajando, sin camino)
    const check = canTravelToDetailed(targetId);
    if (!check.ok) {
      return { ok: false, error: check.error || 'No se puede viajar a esa región desde aquí.', locked: !!check.locked };
    }
    if (A.State.combat) return { ok: false, error: 'Estás en combate.' };
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
    // v3.3: si moriste en el camino, el viaje no sigue
    if (heroDead()) return { ok: false, error: 'Tu aventura terminó.' };

    t.currentStep += 1;

    // Consumir food por paso (v3.0: en grupo, cada uno come lo suyo)
    const group = A.Party && A.Party.combatHeroes ? A.Party.combatHeroes() : null;
    if (group && group.length > 1) {
      for (const h of group) A.State.withHero(h, () => A.State.consumeFoodForStep());
    } else {
      A.State.consumeFoodForStep();
    }

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
    // v1.8.0: la chance de encuentro sale de Balance.Travel. Si el destino es seguro
    // pero venís de una zona peligrosa, los encuentros salen de la zona de origen.
    const fromCombat = fromRegion && fromRegion.type === 'combat';
    const TB = (A.Balance && A.Balance.Travel && A.Balance.Travel.CREATURE_CHANCE) || { combat: 0.28, safe: 0.06 };
    const creature = isCombat ? TB.combat : (fromCombat ? TB.combat * 0.6 : TB.safe);
    const rest = 1 - creature;
    const weights = isCombat
      ? { nothing: rest * 0.50, minor_loot: rest * 0.12, biome_loot: rest * 0.20, creature, narrative: rest * 0.18 }
      : { nothing: rest * 0.48, minor_loot: rest * 0.11, biome_loot: rest * 0.16, creature, narrative: rest * 0.25 };

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
    // v2.1: biomas nuevos
    hills: [
      { itemId: 'mineral_hierro',   weight: 30, qty: [1, 1], msg: 'Una piedra con vetas de hierro entre el pasto.' },
      { itemId: 'hierba_silvestre', weight: 40, qty: [1, 3], msg: 'Hierbas duras que crecen entre las grietas.' },
      { itemId: 'fragmento_cuarzo', weight: 20, qty: [1, 1], msg: 'Un cristal de cuarzo asoma de la tierra.' },
      { itemId: 'mat_pluma',        weight: 10, qty: [1, 2], msg: 'Plumas de arpía enganchadas en una roca.' },
    ],
    meadow: [
      { itemId: 'flor_silvestre',   weight: 40, qty: [1, 3], msg: 'Flores que crecen más altas que vos.' },
      { itemId: 'fragmento_hueso_antiguo', weight: 30, qty: [1, 1], msg: 'Un hueso gigante, del tamaño de un brazo.' },
      { itemId: 'espiga_dorada',    weight: 30, qty: [1, 4], msg: 'Espigas doradas que nadie cosechó.' },
      { itemId: 'hierba_vida',      weight: 4,  qty: [1, 1], msg: 'Entre las flores altas, una hoja dorada que late: una hierba de la vida.' },
    ],
    darkwood: [
      { itemId: 'mat_hongo_rojo',   weight: 35, qty: [1, 2], msg: 'Hongos rojos al pie de un árbol muerto.' },
      { itemId: 'mat_belladona',    weight: 25, qty: [1, 1], msg: 'Bayas negras que más vale no comer.' },
      { itemId: 'hierba_silvestre', weight: 25, qty: [1, 2], msg: 'Hierbas que crecen en la sombra.' },
      { itemId: 'mat_piel_lobo',    weight: 15, qty: [1, 1], msg: 'Un mechón de pelo de lobo enganchado en una rama.' },
    ],
    dream: [
      { itemId: 'polvo_hada',       weight: 40, qty: [1, 2], msg: 'Polvo brillante que cae de las hojas.' },
      { itemId: 'flor_sueno',       weight: 30, qty: [1, 1], msg: 'Una flor pálida que se abre al verte.' },
      { itemId: 'cristal_mana',     weight: 15, qty: [1, 1], msg: 'Un cristal que zumba como una abeja.' },
      { itemId: 'hierba_silvestre', weight: 15, qty: [1, 2], msg: 'Hierbas con rocío que no se seca.' },
    ],
    grove: [
      { itemId: 'mat_hierba_curativa', weight: 50, qty: [1, 2], msg: 'Hierba curativa que los druidas dejan crecer.' },
      { itemId: 'flor_silvestre',      weight: 50, qty: [1, 2], msg: 'Flores alrededor de las piedras.' },
      { itemId: 'hierba_vida',         weight: 8,  qty: [1, 1], msg: 'Entre las raíces del roble, una hoja dorada que late. ¡Una hierba de la vida!' },
    ],
    pirate: [
      { itemId: 'ron_anejo',        weight: 30, qty: [1, 1], msg: 'Una botella de ron olvidada en un barril.' },
      { itemId: 'doblon',           weight: 20, qty: [1, 1], msg: 'Un doblón de oro entre las tablas del muelle.' },
      { itemId: 'mat_cuerda',       weight: 50, qty: [1, 2], msg: 'Cuerda de barco en buen estado.' },
    ],
    gothic: [
      { itemId: 'rosa_carmesi',     weight: 40, qty: [1, 1], msg: 'Una flor carmesí sobre una reja.' },
      { itemId: 'moneda_antigua',   weight: 40, qty: [1, 2], msg: 'Monedas viejas con la cara de un conde.' },
      { itemId: 'vial_sangre',      weight: 20, qty: [1, 1], msg: 'Un vial sellado con lacre rojo.' },
    ],
    bloodwood: [
      { itemId: 'rosa_carmesi',     weight: 45, qty: [1, 2], msg: 'Flores carmesí que trepan sobre una tumba.' },
      { itemId: 'mat_hueso',        weight: 25, qty: [1, 2], msg: 'Huesos limpios entre las raíces.' },
      { itemId: 'mat_ala_murcielago', weight: 30, qty: [1, 1], msg: 'Un ala de murciélago enorme.' },
    ],
    forest: [
      { itemId: 'hierba_silvestre', weight: 40, qty: [1, 3], msg: 'Recogiste hierbas silvestres del suelo.' },
      { itemId: 'baya_negra',       weight: 35, qty: [1, 4], msg: 'Encontraste un arbusto con bayas negras maduras.' },
      { itemId: 'pluma_extraña',    weight: 8,  qty: [1, 1], msg: 'Una pluma de colores raros tirada en el camino.' },
      { itemId: 'hierba_vida',      weight: 3,  qty: [1, 1], msg: 'Una hoja dorada que late entre los helechos: una hierba de la vida.' },
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
      { itemId: 'obsidiana',        weight: 15, qty: [1, 1], msg: 'Vidrio negro y liso brilla en la pared de la cueva.' },
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
  function resolveBiomeLoot(region, opts = {}) {
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

    // v3.2: en grupo se reparte de a uno, por turnos (al explorar ya viene repartido: opts.solo)
    if (!opts.solo && inGroup()) {
      const got = giveItemsToGroup(entry.itemId, qty);
      if (!got.length) return { kind: 'narrative', icon: '', text: `Vieron ${itemData.name.toLowerCase()} en el camino, pero no le entra a nadie en la mochila.`, biome };
      // v3.3: cada uno encuentra lo suyo
      const all = got.length === travelers().length;
      return {
        kind: 'biome_loot', itemId: entry.itemId, itemName: itemData.name, icon: '', qty, biome,
        split: got.map((g) => ({ hid: A.State.hidOf(g.hero), name: g.hero.name, qty: g.qty })),
        text: `${entry.msg} (${itemData.name} ×${qty} ${all ? 'para cada uno' : `para ${got.map((g) => g.hero.name).join(' y ')}`})`,
      };
    }

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
      icon: '',
      qty,
      biome,
      text: `${entry.msg} (${itemData.name} ×${qty})`,
    };
  }

  function resolveLoot(region) {
    // v1.8.0: monedas encontradas acordes al tier de la zona
    const tier = region && Array.isArray(region.tier) ? region.tier[0] : 1;
    const maxCoins = A.Balance ? Math.max(3, Math.round(A.Balance.Economy.coinBase(tier) * 2)) : 10;
    const amount = 1 + Math.floor(Math.random() * maxCoins);
    // v3.2: en grupo, cada uno su parte
    if (inGroup()) {
      const each = giveCoinsToGroup(amount);
      return { kind: 'minor_loot', amount: each, each: true, text: `Cada uno encuentra ${A.Currency.formatPrice(each)} en el camino.` };
    }
    A.Currency.add(amount);
    return {
      kind: 'minor_loot',
      amount,
      text: `Encontraste ${amount} de cobre en el camino.`,
    };
  }

  function resolveCreature(region) {
    const t = State().traveling;
    const target = A.Data.getById('regions', t.toId);
    // v1.8.0: si el destino es seguro, la criatura sale de la región de origen
    const sourceId = target && target.type === 'combat' ? t.toId : t.fromId;
    let group = A.Encounter.generate(sourceId);
    if (!group || group.length === 0) return null;
    // v3.3: en grupo ya vienen las que se suman por ser más: el cartel dice exactamente cuáles son
    if (A.Combat && A.Combat.prepareGroup) group = A.Combat.prepareGroup(group);

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
      // v2.1: biomas nuevos
      hills: [
        { text: 'El viento silba entre las lomas peladas.', icon: '' },
        { text: 'Humo de una fogata a lo lejos. Mejor no averiguar de quién.', icon: '' },
        { text: 'Una piedra rodó sola cuesta abajo. O casi sola.', icon: '' },
        { text: 'Desde lo alto se ve el camino que dejaste atrás.', icon: '' },
      ],
      meadow: [
        { text: 'El pasto te llega a la cintura y se mueve como el mar.', icon: '' },
        { text: 'Una costilla gigante sale de la tierra como un arco.', icon: '' },
        { text: 'Huellas enormes, más grandes que tu cuerpo entero.', icon: '' },
        { text: 'Un rebaño pasta tranquilo. Demasiado tranquilo.', icon: '' },
      ],
      darkwood: [
        { text: 'Los árboles se inclinan cuando pasás.', icon: '' },
        { text: 'Alguien susurra tu nombre. No hay nadie.', icon: '' },
        { text: 'Un aullido lejano, y después silencio.', icon: '' },
        { text: 'La luna no llega al suelo de este bosque.', icon: '' },
      ],
      dream: [
        { text: 'Las hojas brillan como si tuvieran luz propia.', icon: '' },
        { text: 'Una risa de hada se escucha y se apaga.', icon: '' },
        { text: 'Por un momento no sabés si estás despierto.', icon: '' },
        { text: 'Un ciervo de luz cruza el camino y se desvanece.', icon: '' },
      ],
      grove: [
        { text: 'Piedras antiguas marcan el camino al santuario.', icon: '' },
        { text: 'El aire huele a tierra mojada y a madera vieja.', icon: '' },
        { text: 'Un druida te saluda con la cabeza y sigue en silencio.', icon: '' },
      ],
      gothic: [
        { text: 'Torres negras recortadas contra la luna.', icon: '' },
        { text: 'Un carruaje pasa sin hacer ruido.', icon: '' },
        { text: 'Las ventanas tienen luz, pero nadie se asoma.', icon: '' },
        { text: 'Una campana da las doce. Otra vez.', icon: '' },
      ],
      pirate: [
        { text: 'Gritos, risas y vidrios rotos desde una taberna.', icon: '' },
        { text: 'Una bandera negra flamea en el mástil más alto.', icon: '' },
        { text: 'Huele a ron, a pescado y a pólvora.', icon: '' },
      ],
      bloodwood: [
        { text: 'Rosales rojos trepan sobre lápidas de mármol.', icon: '' },
        { text: 'Un murciélago enorme te pasa rozando.', icon: '' },
        { text: 'El rocío de las hojas es rojo.', icon: '' },
        { text: 'Una risa elegante se escucha entre los árboles.', icon: '' },
      ],
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
    const icon = '';
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
    const group = inGroup();
    if (type === 'treasure') {
      const amount = A.Utils.rollDice(ev.amount || '1d10');
      // v3.2: en grupo, cada uno su parte
      if (group) {
        const each = giveCoinsToGroup(amount);
        return { kind: 'minor_loot', amount: each, each: true, text: `Cada uno encuentra ${A.Currency.formatPrice(each)} escondidos.` };
      }
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
      if (group) {
        const got = giveItemsToGroup(ev.reward, 1);
        if (got.length) return { kind: 'find', text: `Encontraron: ${item.name}, uno para ${got.length === travelers().length ? 'cada uno' : got.map((g) => g.hero.name).join(' y ')}.`, reward: ev.reward };
        return { kind: 'narrative', text: `Encontraron algo (${item.name}) pero no le entra a nadie en la mochila.` };
      }
      const ok = A.State.addItem(ev.reward, 1);
      if (ok) return { kind: 'find', text: `Encontraste: ${item.name}.`, reward: ev.reward };
      return { kind: 'narrative', text: `Encontraste algo (${item.name}) pero no entró en la mochila.` };
    }
    if (type === 'damage') {
      // v3.3: las trampas del camino pueden matar (ver A.Death)
      const hurt = (h, dmg, flavor) => {
        const hit = () => A.State.withHero(h, () => A.State.damagePlayer(dmg));
        if (A.Death) A.Death.during('trap', { text: `${flavor}. No volviste a levantarte.` }, hit); else hit();
      };
      if (group) {
        // v3.3: no a todos: a algunos al azar
        const flavor = ev.effect || 'Algo los lastimó';
        const hits = unluckyTravelers().map((h) => {
          const dmg = Math.max(0, Math.min(A.Utils.rollDice(ev.amount || '1d4'), h.hp || 0));
          if (dmg > 0) hurt(h, dmg, ev.effect || 'Algo te lastimó');
          return { hero: h, dmg, dead: !!h.dead };
        });
        const dead = hits.filter((x) => x.dead).map((x) => x.hero.name);
        return {
          kind: 'event_damage',
          text: `${flavor}. ${hits.length > 1 ? 'Les toca a' : 'Le toca a'} ${hits.map((x) => `${x.hero.name} (-${x.dmg})`).join(', ')}.${dead.length ? ` ${dead.length > 1 ? `${dead.slice(0, -1).join(', ')} y ${dead[dead.length - 1]}` : dead[0]} no se ${dead.length > 1 ? 'levantan' : 'levanta'} más.` : ''}`,
          dmg: Math.max(0, ...hits.map((x) => x.dmg)),
          group: true,
        };
      }
      const p = State().player;
      const dmg = Math.max(0, Math.min(A.Utils.rollDice(ev.amount || '1d4'), p.hp || 0));
      const flavor = ev.effect || 'Algo te lastimó';
      if (dmg > 0) hurt(p, dmg, flavor);
      const low = p.hp > 0 && p.hp <= Math.max(3, Math.round(p.maxHp * 0.3)) ? ' Te queda poca vida: otra trampa te puede matar. Descansá o tomá una poción.' : '';
      return { kind: 'event_damage', text: `${flavor}. -${dmg} de salud.${p.hp <= 0 ? ' No volviste a levantarte.' : low}`, dmg };
    }
    if (type === 'heal') {
      if (group) {
        const got = travelers().map((h) => {
          const before = h.hp;
          A.State.withHero(h, () => A.State.healHp(A.Utils.rollDice(ev.amount || '1d6')));
          return { hero: h, amount: h.hp - before };
        });
        return { kind: 'event_heal', text: `Algo los reconfortó: ${got.map((x) => `${x.hero.name} +${x.amount}`).join(', ')} de salud.`, amount: Math.max(0, ...got.map((x) => x.amount)), group: true };
      }
      const amount = A.Utils.rollDice(ev.amount || '1d6');
      A.State.healHp(amount);
      return { kind: 'event_heal', text: `Algo te reconfortó. +${amount} de salud.`, amount };
    }
    return null;
  }

  // ---------- Helpers ----------

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function State() { return A.State; }

  // ---------- v3.2: en grupo lo que se encuentra se reparte ----------

  /** Los que viajan juntos (en solitario, vos). */
  function travelers() {
    const g = A.Party && A.Party.combatHeroes ? A.Party.combatHeroes() : null;
    return g && g.length > 1 ? g : [State().player];
  }
  function inGroup() { return travelers().length > 1; }

  /** v3.3: un hallazgo en grupo: cada uno encuentra lo suyo (al que no le entra, se queda sin). Devuelve [{ hero, qty }]. */
  function giveItemsToGroup(itemId, qty) {
    const out = [];
    for (const h of travelers()) {
      if (A.State.withHero(h, () => A.State.addItem(itemId, qty))) out.push({ hero: h, qty });
    }
    return out;
  }

  /** v3.3: monedas en grupo: cada uno se lleva lo mismo que si viajara solo. */
  function giveCoinsToGroup(total) {
    for (const h of travelers()) A.State.withHero(h, () => A.Currency.add(total));
    return total;
  }

  /** v3.3: lo malo del camino le toca a uno al azar seguro y a cada uno de los demás con la mitad de chance. */
  function unluckyTravelers() {
    if (A.Explore && A.Explore.unlucky) return A.Explore.unlucky(travelers());
    return travelers();
  }

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
    resolveBiomeLootStandalone: (region) => resolveBiomeLoot(region, { solo: true }),
    neighbors,
    start,
    step,
    cancel,
    complete,
    resolveEvent,
    calculateTravelSteps,
    travel, // legacy alias
    _test: { executeRegionEvent, resolveLoot, resolveBiomeLoot }, // v3.2: para las pruebas
  };
})(window.Aventurs);
