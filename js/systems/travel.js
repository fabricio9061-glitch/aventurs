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
   * Devuelve { ok, error?, locked? }
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
    // Verificar reqEncounters
    if (target.reqEncounters && target.reqEncounters > 0) {
      const totalEncounters = State().totalEncounters();
      if (totalEncounters < target.reqEncounters) {
        return {
          ok: false,
          locked: true,
          error: `Necesitas ${target.reqEncounters} encuentros completados para ir allí. Llevás ${totalEncounters}.`,
          required: target.reqEncounters,
          have: totalEncounters,
        };
      }
    }
    return { ok: true };
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
  function start(targetId) {
    if (!canTravelTo(targetId)) {
      return { ok: false, error: 'No se puede viajar a esa región desde aquí.' };
    }
    const target = A.Data.getById('regions', targetId);
    if (!target) return { ok: false, error: 'Región inválida.' };

    const totalSteps = clamp(target.distance || 1, 1, 3) * 2 + 2; // 4..8 pasos según distancia
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
      text: `Partiste hacia ${target.name}.`,
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

    // Si murió de hambre/HP=0 mientras viajaba
    if (State().player.hp <= 0) {
      // Volver al pueblo, no perder progreso
      State().traveling = null;
      State().player.hp = 1;
      State().setRegion('pueblo_inicial');
      A.State.addChronicle({ type: 'note', text: 'Te encontraron desmayado en el camino. Te llevaron al pueblo.' });
      return { ok: false, error: 'Caíste en el camino.' };
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
    neighbors,
    start,
    step,
    cancel,
    complete,
    resolveEvent,
    travel, // legacy alias
  };
})(window.Aventurs);
