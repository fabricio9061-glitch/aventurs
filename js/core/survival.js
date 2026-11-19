/* ============================================================
   Aventurs — Survival System
   v1.6.2

   Sistema de supervivencia: estados de hambre escalonados
   con consecuencias progresivas.

   Estados (definidos por % de food / maxFood):
     - sated       (>75%)    sin penalizaciones
     - normal      (50-75%)  sin penalizaciones
     - hungry      (25-50%)  -1 dodge, mensaje narrativo ocasional
     - weak        (5-25%)   -2 speed, -1 daño, no curarse pasivamente
     - starving    (0-5%)    -3 speed, -2 daño, -2 dodge, pierde HP
     - dying       (0% + HP en zona crítica) — se acerca a muerte

   API:
     A.Survival.getStatus()       - { id, label, color, penalties }
     A.Survival.applyTurnTick()   - llamado tras una acción larga
     A.Survival.shouldShowWarning() - si toca mostrar mensaje
     A.Survival.getStatPenalty(stat) - 0..N para deducir
     A.Survival.deathByStarvation()  - dispara muerte específica
   ============================================================ */

(function (A) {
  'use strict';

  // Definición de estados (orden de mejor a peor)
  const STATES = [
    { id: 'sated', minPct: 75, label: 'Saciado', color: '#6b8e23', penalties: {} },
    { id: 'normal', minPct: 50, label: 'Normal', color: '#a0a89c', penalties: {} },
    { id: 'hungry', minPct: 25, label: 'Hambriento', color: '#c4a850', penalties: { dodge: 1 } },
    { id: 'weak', minPct: 5, label: 'Débil', color: '#c47830', penalties: { speed: 2, damage: 1, restPenalty: true } },
    { id: 'starving', minPct: 0, label: 'Inanición', color: '#8d2818', penalties: { speed: 3, damage: 2, dodge: 2, hpDrain: true, restPenalty: true } },
  ];

  function getPlayer() {
    return A.State && A.State.player;
  }

  /**
   * Devuelve el estado de hambre actual.
   */
  function getStatus() {
    const p = getPlayer();
    if (!p) return STATES[1];
    const pct = (p.food / p.maxFood) * 100;
    for (const s of STATES) {
      if (pct >= s.minPct) return s;
    }
    return STATES[STATES.length - 1];
  }

  /**
   * Devuelve el penalty aplicable a un stat por el estado actual.
   * Returns 0 si no hay penalty.
   */
  function getStatPenalty(stat) {
    const s = getStatus();
    return (s.penalties && s.penalties[stat]) || 0;
  }

  /**
   * Aplica el tick de hambre tras una acción larga (combate, descanso largo, viaje).
   * - Reduce food
   * - Si food=0 y player.hp > 1, drena HP
   * - Emite eventos para que UI se actualice
   */
  function applyTurnTick(reason) {
    const p = getPlayer();
    if (!p || p.hp <= 0) return;

    // Reducir food por la acción
    if (p.food > 0) {
      p.food -= 1;
      A.Bus.emit('player:food-changed', { food: p.food, max: p.maxFood });
    }

    // Aplicar daño por inanición
    const status = getStatus();
    if (status.penalties.hpDrain && p.food === 0) {
      const hpLost = 1;
      // v3.3: el hambre mata a cualquiera (al compañero jugado en esta compu, el grupo
      // le avisa en la suya: ver A.Death)
      p.hp = Math.max(0, p.hp - hpLost);
      A.Bus.emit('player:hp-changed', { current: p.hp });
      // v3.3: el aviso dice claro que esto sí mata (es lo único que termina la partida)
      A.State.addChronicle({
        type: 'note',
        text: p.hp <= 3
          ? `Te estás muriendo de hambre: perdiste ${hpLost} de vida y te quedan ${p.hp}. Si llegás a 0, la partida termina. Comé algo ya.`
          : `Estás muriéndote de hambre. Perdiste ${hpLost} de salud. El hambre es lo único que te puede matar para siempre: comé algo.`,
      });
      // Si llegó a 0, muerte por inanición
      if (p.hp <= 0) {
        deathByStarvation(reason);
        return;
      }
    } else if (status.id === 'weak' && Math.random() < 0.3) {
      // Mensajes narrativos ocasionales
      A.State.addChronicle({
        type: 'note',
        text: 'Te cuesta mantenerte en pie. Necesitás comer.',
      });
    } else if (status.id === 'hungry' && Math.random() < 0.15) {
      A.State.addChronicle({
        type: 'note',
        text: 'El estómago te suena. Mejor que comas algo pronto.',
      });
    }

    A.State.persist();
  }

  /**
   * Determina si toca mostrar warning visual al usuario.
   */
  function shouldShowWarning() {
    const s = getStatus();
    return s.id === 'weak' || s.id === 'starving';
  }

  /**
   * Muerte por inanición: dispara evento 'player:died-starvation'
   * con info de causa de muerte (no teleport al pueblo).
   */
  function deathByStarvation(lastReason) {
    const p = getPlayer();
    if (!p) return;
    const w = A.State.world;
    const region = w && w.regionId ? A.Data.getById('regions', w.regionId) : null;
    const day = (w && w.day) || 1;

    // v3.3: la pantalla y el aviso al grupo los maneja A.Death
    if (A.Death) {
      A.Death.kill('starvation', { regionId: w ? w.regionId : null, text: `El hambre te consumió en ${region ? region.name : 'el camino'}. No volviste a levantarte.`, lastReason });
      return;
    }
    A.State.addChronicle({
      type: 'system',
      text: `${p.name} cayó por inanición en ${region ? region.name : 'el camino'}. Sobreviviste ${day} día${day > 1 ? 's' : ''}.`,
    });
    A.Bus.emit('player:died', { cause: 'starvation' });
  }

  // ============================================================
  // v3.1: cada raza come lo suyo
  //
  // Cada comida tiene uno o más tipos (carne, fruta, aceite...).
  // Cada raza tiene una dieta:
  //   fav   tipos que le encantan: llenan x1,5
  //   half  tipos que le rinden poco: llenan la mitad ('*' = todo lo que no es fav)
  //   only  si está, SOLO come esos tipos (el robot, el vampiro, el hada)
  // Lo "mágico" (ambrosía, huevo de fénix) lo come cualquiera.
  // Una comida del editor sin tipo cuenta como comida común.
  // ============================================================

  const FOOD_KINDS = {
    carne: 'carne', pescado: 'pescado', fruta: 'fruta', verdura: 'verdura', pan: 'pan y masas',
    dulce: 'dulces', granja: 'huevos y queso', guiso: 'comida casera', bebida: 'bebidas', hongo: 'hongos',
    sangre: 'sangre', aceite: 'aceite', nectar: 'néctar', brasa: 'brasas', algas: 'algas', magico: 'comida mágica', comun: 'comida común',
  };

  const KIND_OF = {
    pan: ['pan'], galletas: ['pan', 'dulce'], arroz: ['pan'], fideos: ['pan', 'guiso'], pan_elfico: ['pan'],
    queso: ['granja'], huevos: ['granja'],
    carne_seca: ['carne'], sal_conservante: ['carne'], carne_bestia: ['carne'], carne_ave: ['carne'], carne_reptil: ['carne'],
    carne_dragon: ['carne'], carne_gigante: ['carne'], carne_insecto: ['carne'], carne_pez: ['pescado'],
    pollo_asado: ['carne', 'guiso'], pastel_carne: ['carne', 'pan'], tocino: ['carne'], filete: ['carne'],
    estofado: ['carne', 'guiso', 'verdura'], sopa: ['guiso', 'verdura'], festin_real: ['guiso', 'carne', 'pan', 'fruta'],
    manzana: ['fruta'], uvas: ['fruta'], frutillas: ['fruta'], naranja: ['fruta'], platano: ['fruta'], sandia: ['fruta'], baya_negra: ['fruta'],
    zanahoria: ['verdura'], cebolla: ['verdura'], tomate: ['verdura'], papa_asada: ['verdura'], choclo: ['verdura'], ensalada: ['verdura'], cactus_carnoso: ['verdura'],
    champinones: ['hongo', 'verdura'],
    miel: ['dulce', 'nectar'], jalea_real: ['dulce', 'nectar'], dulces: ['dulce'],
    cerveza: ['bebida'], vino: ['bebida'], hidromiel: ['bebida', 'nectar'],
    ambrosia: ['magico'], huevo_fenix: ['magico'],
    lata_aceite: ['aceite'], bateria_runica: ['aceite'],
    botella_sangre: ['sangre'], copa_sangre: ['sangre'],
    frasco_nectar: ['nectar'], gel_algas: ['algas'], carbon_ardiente: ['brasa'],
  };

  const DIETS = {
    humano: { label: 'De todo', fav: [], half: [] },
    elfo: { label: 'Frutas, verduras y pan', fav: ['fruta', 'verdura', 'pan', 'nectar'], half: ['carne', 'pescado'] },
    mediano: { label: 'De todo, y mucho', fav: ['pan', 'dulce', 'granja', 'guiso'], half: [] },
    draconido: { label: 'Carne', fav: ['carne', 'pescado'], half: ['fruta', 'verdura', 'dulce'] },
    vampiro: { label: 'Sangre', only: ['sangre', 'carne'], fav: ['sangre'], half: [], start: [['botella_sangre', 3]], startText: '3 botellas de sangre' },
    enano: { label: 'Carne y cerveza', fav: ['carne', 'bebida'], half: [] },
    orco: { label: 'Carne', fav: ['carne'], half: ['fruta', 'verdura', 'dulce'] },
    robot: { label: 'Aceite', only: ['aceite'], fav: [], half: [], start: [['lata_aceite', 3]], startText: '3 latas de aceite' },
    goliat: { label: 'Carne y guisos', fav: ['carne', 'guiso'], half: [] },
    minotauro: { label: 'Verduras, fruta y pan', fav: ['verdura', 'fruta', 'pan'], half: ['carne', 'pescado'] },
    gnomo: { label: 'Dulces y hongos', fav: ['dulce', 'hongo'], half: [] },
    alienigena: { label: 'Algas y hongos', fav: ['algas', 'hongo'], half: '*', start: [['gel_algas', 3]], startText: '3 geles de algas' },
    infernal: { label: 'Brasas y carne', fav: ['brasa', 'carne'], half: ['fruta', 'verdura'], start: [['carbon_ardiente', 2], ['pan', 1]], startText: 'carbón ardiente y pan' },
    angel: { label: 'Pan, miel y fruta', fav: ['pan', 'dulce', 'fruta', 'nectar'], half: ['carne'] },
    hada: { label: 'Néctar, miel y fruta', only: ['nectar', 'dulce', 'fruta'], fav: ['nectar'], half: [], start: [['frasco_nectar', 3]], startText: '3 frascos de néctar' },
    // v3.3
    licantropo: { label: 'Carne, cuanto más cruda mejor', fav: ['carne'], half: ['fruta', 'verdura', 'dulce', 'pan'], start: [['carne_seca', 3]], startText: '3 tiras de carne seca' },
    elfo_oscuro: { label: 'Hongos, carne y pan', fav: ['hongo', 'carne'], half: ['fruta', 'dulce'] },
    driade: { label: 'Fruta, verdura y néctar', fav: ['fruta', 'verdura', 'nectar'], half: ['carne', 'pescado'] },
  };
  const DEFAULT_DIET = DIETS.humano;
  const FAV_MULT = 1.5;
  const HALF_MULT = 0.5;

  function dietOf(raceOrPlayer) {
    const id = typeof raceOrPlayer === 'string' ? raceOrPlayer : raceOrPlayer && raceOrPlayer.raceId;
    const d = DIETS[id] || DEFAULT_DIET;
    return { id: DIETS[id] ? id : 'humano', start: [['pan', 3]], startText: 'algo de comida', ...d };
  }

  function isFood(item) {
    return !!item && (item.subtype === 'food' || (item.effect && item.effect.type === 'food'));
  }

  function kindsOf(item) {
    if (!item) return [];
    if (item.foodKind) return Array.isArray(item.foodKind) ? item.foodKind : [item.foodKind];
    return KIND_OF[item.id] || ['comun'];
  }

  const listY = (arr) => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} y ${arr[arr.length - 1]}`);
  const kindWords = (kinds) => listY(kinds.map((k) => FOOD_KINDS[k] || k));

  /**
   * Cuánto le rinde una comida a un héroe.
   * { mult, kind: 'fav'|'normal'|'half'|'no', why }  mult 0 = no la come.
   */
  function foodFor(p, item) {
    if (!isFood(item)) return { mult: 1, kind: 'normal', why: '' };
    const d = dietOf(p);
    const kinds = kindsOf(item);
    if (kinds.includes('magico')) return { mult: 1, kind: 'normal', why: '' };
    const race = A.Data && A.Data.getById ? A.Data.getById('races', p && p.raceId) : null;
    const who = race ? race.name : 'Tu raza';
    if (d.only && !kinds.some((k) => d.only.includes(k))) {
      return { mult: 0, kind: 'no', why: `${who === 'Tu raza' ? 'No lo comés' : `Un ${who.toLowerCase()} no come eso`}: solo ${kindWords(d.only)}.` };
    }
    if (kinds.some((k) => (d.fav || []).includes(k))) return { mult: FAV_MULT, kind: 'fav', why: '' };
    const half = d.half === '*' ? true : kinds.every((k) => (d.half || []).includes(k));
    if (half) return { mult: HALF_MULT, kind: 'half', why: '' };
    return { mult: 1, kind: 'normal', why: '' };
  }

  /** Cuánto llena de verdad (con la dieta). */
  function foodAmount(p, item, base) {
    const f = foodFor(p, item);
    if (f.mult <= 0 || !(base > 0)) return 0;
    return Math.max(1, Math.round(base * f.mult));
  }

  /** Frase corta para la ficha: qué come y qué le rinde. */
  function describeDiet(raceOrPlayer) {
    const d = dietOf(raceOrPlayer);
    const parts = [];
    if (d.only) parts.push(`Solo come ${kindWords(d.only)}.`);
    if ((d.fav || []).length) parts.push(`Le encanta: ${kindWords(d.fav)} (llena más).`);
    if (d.half === '*') parts.push('Lo demás le rinde la mitad.');
    else if ((d.half || []).length) parts.push(`${kindWords(d.half).replace(/^./, (c) => c.toUpperCase())}: le rinde la mitad.`);
    if (!parts.length) parts.push('Come de todo.');
    return parts.join(' ');
  }

  /** Comida con la que arranca un personaje nuevo. */
  function startFood(raceId) {
    return dietOf(raceId).start.map(([itemId, qty]) => ({ itemId, qty }));
  }

  /** ¿Tiene en la mochila algo que pueda comer? */
  function hasEdible(p) {
    for (const s of (p && p.inventory) || []) {
      const it = A.Data.getById('items', s.itemId);
      if (isFood(it) && foodFor(p, it).mult > 0) return true;
    }
    return false;
  }

  A.Survival = {
    STATES,
    getStatus,
    getStatPenalty,
    applyTurnTick,
    shouldShowWarning,
    deathByStarvation,
    // v3.1: dietas
    FOOD_KINDS,
    DIETS,
    dietOf,
    isFood,
    kindsOf,
    foodFor,
    foodAmount,
    describeDiet,
    startFood,
    hasEdible,
  };
})(window.Aventurs);
