/* ============================================================
   Aventurs — Seed: Razas (v1.9.2 — 12 razas con pasiva)
   NINGUNA es más fuerte que otra: el "presupuesto" de poder (stats +
   pasiva) es el mismo, repartido distinto. Se mide con:
     node tools/simulador.js razas

   Tipos (5 de cada uno; v3.0 suma Vampiro, Minotauro y Hada):
     hybrid  (Humano, Elfo, Mediano, Dracónido, Vampiro) -> magia + arma
     warrior (Enano, Orco, Robot, Goliat, Minotauro)     -> sin magia, más vida y daño
     mage    (Gnomo, Alienígena, Infernal, Ángel, Hada)  -> más maná, menos vida

   passive: id de la pasiva (textos y reglas en js/systems/passives.js).

   Al subir de nivel: vida +6 (warrior y hybrid), +5 (mage); maná +5 (mage)
   o +3 (hybrid). v2.0: los guerreros tienen maestría con armas y los magos
   más poder mágico (ver weaponFit y spellPowerOf en js/core/balance.js).
   Todos arrancan con Daga + Túnica de cuero; los que usan magia,
   además saben Chispa.

   v2.1:
     startSpell  hechizo con el que nace la raza (js/data/seed-spells.js)
     manaRegen   solo magos: { turn: maná por turno en combate (sube con el nivel),
                 win: parte del maná que vuelve al ganar una pelea }.
                 Los híbridos no recuperan maná solos: pociones o dormir.

   bonuses son DELTAS sobre la base universal:
     hp 24, mana 12 (solo si tiene magia), speed 10, precision 1,
     armor 0, damage 0, dodge 5
   ============================================================ */

(function (A) {
  'use strict';

  const RACES = [
    // ---------- Híbridos: arma y magia ----------
    {
      id: 'humano',
      name: 'Humano',
      icon: '🧑',
      sprite: '',
      combatType: 'hybrid',
      magic: true,
      passive: 'determinacion',
      startSpell: 'dardo_arcano',
      bonuses: { hp: 3, mana: 0, speed: 1, precision: 1, armor: 0, damage: 0, dodge: 1 },
      description: 'Adaptables y tercos. Equilibrados en todo, dominantes en nada, y nunca se dan por vencidos.',
    },
    {
      id: 'elfo',
      name: 'Elfo',
      icon: '🧝',
      sprite: '',
      combatType: 'hybrid',
      magic: true,
      passive: 'ojo_certero',
      startSpell: 'flecha_lunar',
      bonuses: { hp: 3, mana: 2, speed: 3, precision: 2, armor: 0, damage: 0, dodge: 1 },
      description: 'Ágiles y de instinto certero. Viven mil años bajo los bosques antiguos y rara vez bajan al mundo de los hombres.',
    },
    {
      id: 'mediano',
      name: 'Mediano',
      icon: '🧚',
      sprite: '',
      combatType: 'hybrid',
      magic: true,
      passive: 'suerte',
      startSpell: 'dardo_venenoso',
      bonuses: { hp: 1, mana: 0, speed: 3, precision: 1, armor: 0, damage: 0, dodge: 2 },
      description: 'Pequeños y silenciosos. Lo que pierden en fuerza lo ganan en velocidad, picardía y una suerte que no se explica.',
    },
    {
      id: 'draconido',
      name: 'Dracónido',
      icon: '🐉',
      sprite: '',
      combatType: 'hybrid',
      magic: true,
      passive: 'sangre_dragon',
      startSpell: 'aliento_de_brasas',
      bonuses: { hp: 2, mana: 0, speed: 0, precision: 1, armor: 1, damage: 1, dodge: 0 },
      description: 'Descendientes de dragones antiguos. Escamas duras, sangre caliente y orgullo más antiguo que los reinos.',
    },

    // v3.0: el quinto híbrido
    {
      id: 'vampiro',
      name: 'Vampiro',
      icon: '',
      sprite: '',
      combatType: 'hybrid',
      magic: true,
      passive: 'colmillos',
      startSpell: 'toque_vampirico',
      bonuses: { hp: 1, mana: 0, speed: 2, precision: 1, armor: 0, damage: 0, dodge: 1 },
      description: 'Hijos de la noche que aprendieron a caminar bajo el sol. Cada herida que abren les devuelve un poco de vida.',
    },

    // ---------- Guerreros: sin magia ----------
    {
      id: 'enano',
      name: 'Enano',
      icon: '🧔',
      sprite: '',
      combatType: 'warrior',
      magic: false,
      passive: 'piel_roca',
      bonuses: { hp: 3, mana: 0, speed: -2, precision: 1, armor: 0, damage: 0, dodge: -1 },
      description: 'Bajos y robustos. Su cuerpo soporta golpes que partirían a un humano y su voluntad no cede ante nada.',
    },
    {
      id: 'orco',
      name: 'Orco',
      icon: '👹',
      sprite: '',
      combatType: 'warrior',
      magic: false,
      passive: 'furia',
      bonuses: { hp: 1, mana: 0, speed: 0, precision: 1, armor: 0, damage: 0, dodge: 0 },
      description: 'Brutales en combate. La furia es su lenguaje, y cuanto más sangran, más fuerte pegan.',
    },
    {
      id: 'robot',
      name: 'Robot',
      icon: '🤖',
      sprite: '',
      combatType: 'warrior',
      magic: false,
      passive: 'cuerpo_metal',
      bonuses: { hp: 2, mana: 0, speed: -1, precision: 1, armor: 1, damage: 0, dodge: -1 }, // v3.1: vida 3 -> 2 (ahora tiene blindaje)
      description: 'Construidos, no nacidos. Inmunes al cansancio, al veneno y a la duda, pero ajenos por completo a la magia.',
    },
    {
      id: 'goliat',
      name: 'Goliat',
      icon: '🗿',
      sprite: '',
      combatType: 'warrior',
      magic: false,
      passive: 'golpe_gigante',
      bonuses: { hp: 8, mana: 0, speed: -2, precision: 0, armor: 0, damage: 0, dodge: 0 },
      description: 'Gigantes de piel de piedra que viven en las cumbres. Lentos para empezar, pero cuando aciertan, aplastan.',
    },

    // v3.0: el quinto guerrero
    {
      id: 'minotauro',
      name: 'Minotauro',
      icon: '',
      sprite: '',
      combatType: 'warrior',
      magic: false,
      passive: 'embestida',
      bonuses: { hp: 5, mana: 0, speed: -1, precision: 0, armor: 0, damage: 0, dodge: -1 },
      description: 'Fuertes como toros y tercos como montañas. Entran a cada pelea con los cuernos por delante.',
    },

    // ---------- Magos: mucha magia, menos vida ----------
    {
      id: 'gnomo',
      name: 'Gnomo',
      icon: '🧙',
      sprite: '',
      combatType: 'mage',
      magic: true,
      passive: 'ingenio',
      startSpell: 'descarga', manaRegen: { turn: 1, win: 0.2 },
      bonuses: { hp: -8, mana: 4, speed: 1, precision: 2, armor: 0, damage: 0, dodge: 2 },
      description: 'Inventores natos y de mente curiosa. Encuentran la forma de hacer más magia con menos esfuerzo.',
    },
    {
      id: 'alienigena',
      name: 'Alienígena',
      icon: '👽',
      sprite: '',
      combatType: 'mage',
      magic: true,
      passive: 'mente_expansiva',
      startSpell: 'rayo_de_plasma', manaRegen: { turn: 2, win: 0.3 },
      bonuses: { hp: -8, mana: 1, speed: 2, precision: 1, armor: 0, damage: 0, dodge: 2 },
      description: 'Visitantes de mundos lejanos. Sus mentes beben de corrientes de energía que los nativos apenas perciben.',
    },
    {
      id: 'infernal',
      name: 'Infernal',
      icon: '😈',
      sprite: '',
      combatType: 'mage',
      magic: true,
      passive: 'llama_interior',
      startSpell: 'ascua_infernal', manaRegen: { turn: 1, win: 0.15 },
      bonuses: { hp: -6, mana: 4, speed: 1, precision: 2, armor: 0, damage: 0, dodge: 2 }, // v3.1: esquiva 1 -> 2 (era el mago más flojo)
      description: 'Nacidos con sangre de demonio. Llevan el fuego del abismo en las venas y lo vuelcan en cada hechizo.',
    },
    {
      id: 'angel',
      name: 'Ángel',
      icon: '👼',
      sprite: '',
      combatType: 'mage',
      magic: true,
      passive: 'bendicion',
      startSpell: 'luz_sagrada', manaRegen: { turn: 1, win: 0.25 },
      bonuses: { hp: -6, mana: 1, speed: 1, precision: 1, armor: 0, damage: 0, dodge: 2 },
      description: 'Guardianes bajados del cielo. Una luz suave los acompaña y les cierra las heridas en plena batalla.',
    },
    // v3.0: la quinta maga
    {
      id: 'hada',
      name: 'Hada',
      icon: '',
      sprite: '',
      combatType: 'mage',
      magic: true,
      passive: 'polvo_hada',
      startSpell: 'chispas_de_hada', manaRegen: { turn: 1, win: 0.2 },
      bonuses: { hp: -9, mana: 2, speed: 3, precision: 1, armor: 0, damage: 0, dodge: 3 },
      description: 'Chiquitas, rapidísimas y traviesas. A su paso dejan un polvo brillante que adormece a cualquiera.',
    },
  ];

  const BASE_STATS = {
    hp: 24,
    mana: 12,
    speed: 10,
    precision: 1,
    armor: 0,
    damage: 0,
    dodge: 5,
  };

  function findRace(raceId) {
    const fromData = A.Data && A.Data.getById ? A.Data.getById('races', raceId) : null;
    return fromData || RACES.find((r) => r.id === raceId) || null;
  }

  /**
   * Stats finales de un personaje nuevo según raza.
   * Devuelve { hp, maxHp, mana, maxMana, speed, precision, armor, damage, dodge }.
   */
  function statsForRace(raceId) {
    const race = findRace(raceId);
    if (!race) return null;
    const b = race.bonuses || {};
    const magic = raceHasMagic(raceId);
    const mana = magic ? BASE_STATS.mana + (b.mana || 0) : 0;
    return {
      hp: BASE_STATS.hp + (b.hp || 0),
      maxHp: BASE_STATS.hp + (b.hp || 0),
      mana,
      maxMana: mana,
      speed: BASE_STATS.speed + (b.speed || 0),
      precision: BASE_STATS.precision + (b.precision || 0),
      armor: BASE_STATS.armor + (b.armor || 0),
      damage: BASE_STATS.damage + (b.damage || 0),
      dodge: BASE_STATS.dodge + (b.dodge || 0),
    };
  }

  /** ¿La raza usa magia? (fijo por raza, sin azar) */
  function raceHasMagic(raceId) {
    const race = findRace(raceId);
    if (!race) return false;
    if (typeof race.magic === 'boolean') return race.magic;
    return race.combatType !== 'warrior';
  }

  /** Compatibilidad: antes era al azar, ahora es fijo por raza. */
  function rollMagicForRace(raceId) {
    return raceHasMagic(raceId);
  }

  A.Seed = A.Seed || {};
  A.Seed.races = RACES;
  A.Seed.baseStats = BASE_STATS;
  A.Seed.statsForRace = statsForRace;
  A.Seed.raceHasMagic = raceHasMagic;
  A.Seed.rollMagicForRace = rollMagicForRace;
})(window.Aventurs);
