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
   * Solo si están conectadas y no hay viaje en curso.
   */
  function canTravelTo(targetId) {
    if (State().traveling && !State().traveling.completed) return false;
    const w = State().world;
    if (!w) return false;
    const region = A.Data.getById('regions', w.regionId);
    if (!region) return false;
    return (region.connections || []).includes(targetId);
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

    // Pesos según si la región destino es safe o combat
    const weights = isCombat
      ? { nothing: 0.40, minor_loot: 0.15, creature: 0.35, narrative: 0.10 }
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
    // Buscar entre los enemigos de las dos regiones (origen y destino).
    // Limitamos a tier <= maxTier de la región destino para no spawnar ogros
    // entre pueblo y bosque.
    const targetId = State().traveling.toId;
    const candidates = A.Data.enemiesInRegion(targetId);
    if (!candidates.length) return null;

    // Pesos por categoría: weak 50, normal 35, strong 12, boss 3
    const byCat = { weak: [], normal: [], strong: [], boss: [] };
    for (const e of candidates) {
      const c = e.category || 'normal';
      if (byCat[c]) byCat[c].push(e);
    }
    const catWeights = {};
    if (byCat.weak.length) catWeights.weak = 0.50;
    if (byCat.normal.length) catWeights.normal = 0.35;
    if (byCat.strong.length) catWeights.strong = 0.12;
    if (byCat.boss.length) catWeights.boss = 0.03;
    if (Object.keys(catWeights).length === 0) return null;

    const cat = A.Utils.weightedPick(catWeights);
    // Dentro de la categoría, weighted pick por spawnWeight (más alto = más probable)
    const pool = byCat[cat];
    const weighted = {};
    pool.forEach((e, i) => {
      weighted[i] = (typeof e.spawnWeight === 'number' ? e.spawnWeight : 1.0);
    });
    const idx = parseInt(A.Utils.weightedPick(weighted), 10);
    const enemy = pool[idx] || A.Utils.randomOf(pool);
    if (!enemy) return null;

    return {
      kind: 'creature',
      enemyId: enemy.id,
      enemyName: enemy.name,
      icon: enemy.icon,
      tameable: !!enemy.tameable,
      category: enemy.category,
      tier: enemy.tier,
      text: `Apareció ${enemy.name} en el camino.`,
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
    neighbors,
    start,
    step,
    cancel,
    complete,
    resolveEvent,
    travel, // legacy alias
  };
})(window.Aventurs);
