/* ============================================================
   Aventurs — Seed: Razas (v1.9.2 — 12 razas con pasiva)
   NINGUNA es más fuerte que otra: el "presupuesto" de poder (stats +
   pasiva) es el mismo, repartido distinto. Se mide con:
     node tools/simulador.js razas

   Tipos (6 de cada uno; v3.0 suma Vampiro, Minotauro y Hada; v3.3, Elfo
   oscuro, Licántropo y Dríade):
     hybrid  (Humano, Elfo, Mediano, Dracónido, Vampiro, Elfo oscuro) -> magia + arma
     warrior (Enano, Orco, Robot, Goliat, Minotauro, Licántropo)       -> sin magia, más vida y daño
     mage    (Gnomo, Alienígena, Infernal, Ángel, Hada, Dríade)        -> más maná, menos vida

   passive: id de la pasiva (textos y reglas en js/systems/passives.js).

   Al subir de nivel: vida +6 (warrior y hybrid), +5 (mage); maná +5 (mage)
   o +3 (hybrid). v2.0: los guerreros tienen maestría con armas y los magos
   más poder mágico (ver weaponFit y spellPowerOf en js/core/balance.js).
   v3.3: cada raza arranca con su arma (startWeapon) y Túnica de cuero;
   los magos, con su propia arma de mago (v3.5). Las armas de raza valen lo mismo que la vieja
   daga (1d4): cambia la forma, no la fuerza.

   v2.1:
     startSpell  hechizo con el que nace la raza (js/data/seed-spells.js)
     manaRegen   solo magos: { turn: maná por turno en combate (sube con el nivel),
                 win: parte del maná que vuelve al ganar una pelea }.
                 Los híbridos no recuperan maná solos: pociones o dormir.

   v3.6: TODAS con el mismo poder: bonuses = lo de su clase + 3 puntos de raza
   (ver CLASS_BASE y COST abajo), y explore (lo que suman al explorar) da 5 para todas.

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
      startWeapon: 'espada_recluta', // v3.3: el arma con la que nace
      name: 'Humano',
      icon: '🧑',
      sprite: '',
      combatType: 'hybrid',
      magic: true,
      passive: 'determinacion',
      startSpell: 'dardo_arcano',
      bonuses: { hp: 2, mana: 0, speed: 2, precision: 2, armor: 0, damage: 0, dodge: 1 }, // v3.6: clase + 3 puntos de raza
      explore: { fuerza: 1, agilidad: 1, ingenio: 1, punteria: 1, suerte: 1 }, // v3.6: al explorar, 5 puntos para todos
      description: 'Adaptables y tercos. Equilibrados en todo, dominantes en nada, y nunca se dan por vencidos.',
    },
    {
      id: 'elfo',
      startWeapon: 'arco_rama', // v3.3: el arma con la que nace
      name: 'Elfo',
      icon: '🧝',
      sprite: '',
      combatType: 'hybrid',
      magic: true,
      passive: 'ojo_certero',
      startSpell: 'flecha_lunar',
      bonuses: { hp: 0, mana: 2, speed: 2, precision: 2, armor: 0, damage: 0, dodge: 1 }, // v3.6: clase + 3 puntos de raza
      explore: { fuerza: 0, agilidad: 2, ingenio: 1, punteria: 2, suerte: 0 }, // v3.6: al explorar, 5 puntos para todos
      description: 'Ágiles y de instinto certero. Viven mil años bajo los bosques antiguos y rara vez bajan al mundo de los hombres.',
    },
    {
      id: 'mediano',
      startWeapon: 'cuchillo_caza', // v3.3: el arma con la que nace
      name: 'Mediano',
      icon: '🧚',
      sprite: '',
      combatType: 'hybrid',
      magic: true,
      passive: 'suerte',
      startSpell: 'dardo_venenoso',
      bonuses: { hp: 0, mana: 0, speed: 3, precision: 1, armor: 0, damage: 0, dodge: 2 }, // v3.6: clase + 3 puntos de raza
      explore: { fuerza: 0, agilidad: 1, ingenio: 0, punteria: 1, suerte: 3 }, // v3.6: al explorar, 5 puntos para todos
      description: 'Pequeños y silenciosos. Lo que pierden en fuerza lo ganan en velocidad, picardía y una suerte que no se explica.',
    },
    {
      id: 'draconido',
      startWeapon: 'hacha_escamas', // v3.3: el arma con la que nace
      name: 'Dracónido',
      icon: '🐉',
      sprite: '',
      combatType: 'hybrid',
      magic: true,
      passive: 'sangre_dragon',
      startSpell: 'aliento_de_brasas',
      bonuses: { hp: 2, mana: 0, speed: 1, precision: 1, armor: 1, damage: 0, dodge: 1 }, // v3.6: clase + 3 puntos de raza
      explore: { fuerza: 2, agilidad: 0, ingenio: 1, punteria: 1, suerte: 1 }, // v3.6: al explorar, 5 puntos para todos
      description: 'Descendientes de dragones antiguos. Escamas duras, sangre caliente y orgullo más antiguo que los reinos.',
    },

    // v3.0: el quinto híbrido
    {
      id: 'vampiro',
      startWeapon: 'punal_sangre', // v3.3: el arma con la que nace
      name: 'Vampiro',
      icon: '',
      sprite: '',
      combatType: 'hybrid',
      magic: true,
      passive: 'colmillos',
      startSpell: 'toque_vampirico',
      bonuses: { hp: 2, mana: 0, speed: 2, precision: 1, armor: 0, damage: 0, dodge: 2 }, // v3.6: clase + 3 puntos de raza
      explore: { fuerza: 1, agilidad: 2, ingenio: 1, punteria: 0, suerte: 1 }, // v3.6: al explorar, 5 puntos para todos
      description: 'Hijos de la noche que aprendieron a caminar bajo el sol. Cada herida que abren les devuelve un poco de vida.',
    },

    // ---------- Guerreros: sin magia ----------
    {
      id: 'enano',
      startWeapon: 'martillo_minero', // v3.3: el arma con la que nace
      name: 'Enano',
      icon: '🧔',
      sprite: '',
      combatType: 'warrior',
      magic: false,
      passive: 'piel_roca',
      bonuses: { hp: 6, mana: 0, speed: -1, precision: 1, armor: 0, damage: 0, dodge: -1 }, // v3.6: clase + 3 puntos de raza
      explore: { fuerza: 3, agilidad: 0, ingenio: 1, punteria: 1, suerte: 0 }, // v3.6: al explorar, 5 puntos para todos
      description: 'Bajos y robustos. Su cuerpo soporta golpes que partirían a un humano y su voluntad no cede ante nada.',
    },
    {
      id: 'orco',
      startWeapon: 'garrote_hueso', // v3.3: el arma con la que nace
      name: 'Orco',
      icon: '👹',
      sprite: '',
      combatType: 'warrior',
      magic: false,
      passive: 'furia',
      bonuses: { hp: 6, mana: 0, speed: -1, precision: 1, armor: 0, damage: 0, dodge: -1 }, // v3.6: clase + 3 puntos de raza
      explore: { fuerza: 3, agilidad: 1, ingenio: 0, punteria: 1, suerte: 0 }, // v3.6: al explorar, 5 puntos para todos
      description: 'Brutales en combate. La furia es su lenguaje, y cuanto más sangran, más fuerte pegan.',
    },
    {
      id: 'robot',
      startWeapon: 'maza_engranajes', // v3.3: el arma con la que nace
      name: 'Robot',
      icon: '🤖',
      sprite: '',
      combatType: 'warrior',
      magic: false,
      passive: 'cuerpo_metal',
      bonuses: { hp: 2, mana: 0, speed: -1, precision: 1, armor: 1, damage: 0, dodge: -1 }, // v3.6: clase + 3 puntos de raza
      explore: { fuerza: 2, agilidad: 0, ingenio: 2, punteria: 1, suerte: 0 }, // v3.6: al explorar, 5 puntos para todos
      description: 'Construidos, no nacidos. Inmunes al cansancio, al veneno y a la duda, pero ajenos por completo a la magia.',
    },
    {
      id: 'goliat',
      startWeapon: 'porra_piedra', // v3.3: el arma con la que nace
      name: 'Goliat',
      icon: '🗿',
      sprite: '',
      combatType: 'warrior',
      magic: false,
      passive: 'golpe_gigante',
      bonuses: { hp: 10, mana: 0, speed: -2, precision: 0, armor: 0, damage: 0, dodge: -1 }, // v3.6: clase + 3 puntos de raza
      explore: { fuerza: 3, agilidad: 0, ingenio: 0, punteria: 2, suerte: 0 }, // v3.6: al explorar, 5 puntos para todos
      description: 'Gigantes de piel de piedra que viven en las cumbres. Lentos para empezar, pero cuando aciertan, aplastan.',
    },

    // v3.0: el quinto guerrero
    {
      id: 'minotauro',
      startWeapon: 'hacha_cuerno', // v3.3: el arma con la que nace
      name: 'Minotauro',
      icon: '',
      sprite: '',
      combatType: 'warrior',
      magic: false,
      passive: 'embestida',
      bonuses: { hp: 8, mana: 0, speed: -1, precision: 0, armor: 0, damage: 0, dodge: -1 }, // v3.6: clase + 3 puntos de raza
      explore: { fuerza: 3, agilidad: 1, ingenio: 0, punteria: 0, suerte: 1 }, // v3.6: al explorar, 5 puntos para todos
      description: 'Fuertes como toros y tercos como montañas. Entran a cada pelea con los cuernos por delante.',
    },

    // ---------- Magos: mucha magia, menos vida ----------
    {
      id: 'gnomo',
      startWeapon: 'varita_engranajes', // v3.5: su arma de mago (solo para magos)
      name: 'Gnomo',
      icon: '🧙',
      sprite: '',
      combatType: 'mage',
      magic: true,
      passive: 'ingenio',
      startSpell: 'descarga', manaRegen: { turn: 1, win: 0.2 },
      bonuses: { hp: -10, mana: 6, speed: 1, precision: 2, armor: 0, damage: 0, dodge: 2 }, // v3.6: clase + 3 puntos de raza
      explore: { fuerza: 0, agilidad: 1, ingenio: 3, punteria: 1, suerte: 0 }, // v3.6: al explorar, 5 puntos para todos
      description: 'Inventores natos y de mente curiosa. Encuentran la forma de hacer más magia con menos esfuerzo.',
    },
    {
      id: 'alienigena',
      startWeapon: 'cetro_plasma', // v3.5: su arma de mago (solo para magos)
      name: 'Alienígena',
      icon: '👽',
      sprite: '',
      combatType: 'mage',
      magic: true,
      passive: 'mente_expansiva',
      // v3.11 (dossier): la Mente expansiva se cambió por el Apoyo orbital. Medido: con el maná de los otros magos
      // quedaba 28 puntos abajo en el nivel 3; con un poco más (1,25 por turno, antes 1,5) queda en su lugar
      startSpell: 'rayo_de_plasma', manaRegen: { turn: 1.25, win: 0.25, step: 1.25 },
      bonuses: { hp: -8, mana: 4, speed: 2, precision: 1, armor: 0, damage: 0, dodge: 2 }, // v3.6: clase + 3 puntos de raza
      explore: { fuerza: 0, agilidad: 2, ingenio: 3, punteria: 0, suerte: 0 }, // v3.6: al explorar, 5 puntos para todos
      description: 'Visitantes de mundos lejanos. Desde el cielo, su nave nodriza los cuida y bombardea a quien se les ponga enfrente.',
    },
    {
      id: 'infernal',
      startWeapon: 'baston_ascuas', // v3.5: su arma de mago (solo para magos)
      name: 'Infernal',
      icon: '😈',
      sprite: '',
      combatType: 'mage',
      magic: true,
      passive: 'llama_interior',
      startSpell: 'ascua_infernal', manaRegen: { turn: 1, win: 0.15, upTo: 20 }, // v3.12: su maná por turno crece hasta el 20 (los demás magos, hasta el 16): vive de su maná
      bonuses: { hp: -8, mana: 4, speed: 1, precision: 2, armor: 0, damage: 0, dodge: 2 }, // v3.6: clase + 3 puntos de raza
      explore: { fuerza: 1, agilidad: 0, ingenio: 3, punteria: 1, suerte: 0 }, // v3.6: al explorar, 5 puntos para todos
      description: 'Nacidos con sangre de demonio. Llevan el fuego del abismo en las venas y lo vuelcan en cada hechizo.',
    },
    {
      id: 'angel',
      startWeapon: 'baculo_luz', // v3.5: su arma de mago (solo para magos)
      name: 'Ángel',
      icon: '👼',
      sprite: '',
      combatType: 'mage',
      magic: true,
      passive: 'bendicion',
      startSpell: 'luz_sagrada', manaRegen: { turn: 1, win: 0.25 },
      bonuses: { hp: -6, mana: 4, speed: 1, precision: 1, armor: 0, damage: 0, dodge: 2 }, // v3.6: clase + 3 puntos de raza
      explore: { fuerza: 0, agilidad: 1, ingenio: 2, punteria: 1, suerte: 1 }, // v3.6: al explorar, 5 puntos para todos
      description: 'Guardianes bajados del cielo. Una luz suave los acompaña y les cierra las heridas en plena batalla.',
    },
    // v3.0: la quinta maga
    {
      id: 'hada',
      startWeapon: 'varita_hada', // v3.5: su arma de mago (solo para magos)
      name: 'Hada',
      icon: '',
      sprite: '',
      combatType: 'mage',
      magic: true,
      passive: 'polvo_hada',
      startSpell: 'chispas_de_hada', manaRegen: { turn: 1, win: 0.2 },
      bonuses: { hp: -8, mana: 2, speed: 2, precision: 1, armor: 0, damage: 0, dodge: 3 }, // v3.6: clase + 3 puntos de raza
      explore: { fuerza: 0, agilidad: 2, ingenio: 2, punteria: 0, suerte: 1 }, // v3.6: al explorar, 5 puntos para todos
      description: 'Chiquitas, rapidísimas y traviesas. A su paso dejan un polvo brillante que adormece a cualquiera.',
    },
    // ---------- v3.3: tres razas nuevas (una de cada tipo) ----------
    {
      id: 'licantropo',
      startWeapon: 'colmillo_lobo', // v3.3: el arma con la que nace
      name: 'Licántropo',
      icon: '',
      sprite: '',
      combatType: 'warrior',
      magic: false,
      passive: 'sangre_lobo',
      bonuses: { hp: 4, mana: 0, speed: 1, precision: 0, armor: 0, damage: 0, dodge: -1 }, // v3.6: clase + 3 puntos de raza
      explore: { fuerza: 2, agilidad: 2, ingenio: 0, punteria: 1, suerte: 0 }, // v3.6: al explorar, 5 puntos para todos
      description: 'Mitad persona, mitad lobo. Mientras pelea, las heridas se le cierran solas.',
    },
    {
      id: 'elfo_oscuro',
      startWeapon: 'punal_obsidiana', // v3.3: el arma con la que nace
      name: 'Elfo oscuro',
      icon: '',
      sprite: '',
      combatType: 'hybrid',
      magic: true,
      passive: 'cazador_sombras',
      startSpell: 'manto_oscuridad',
      bonuses: { hp: 4, mana: 0, speed: 2, precision: 1, armor: 0, damage: 0, dodge: 1 }, // v3.6: clase + 3 puntos de raza
      explore: { fuerza: 1, agilidad: 2, ingenio: 1, punteria: 1, suerte: 0 }, // v3.6: al explorar, 5 puntos para todos
      description: 'Los elfos que se fueron a vivir bajo tierra. Sus hojas envenenan, y pegan más fuerte a lo que ya está envenenado, ciego o herido.',
    },
    {
      id: 'driade',
      startWeapon: 'vara_sauce', // v3.3: el arma con la que nace
      name: 'Dríade',
      icon: '',
      sprite: '',
      combatType: 'mage',
      magic: true,
      passive: 'corteza_espinosa',
      startSpell: 'enredadera', manaRegen: { turn: 1, win: 0.2 },
      bonuses: { hp: -8, mana: 4, speed: 1, precision: 1, armor: 0, damage: 0, dodge: 3 }, // v3.6: clase + 3 puntos de raza
      explore: { fuerza: 1, agilidad: 1, ingenio: 2, punteria: 1, suerte: 0 }, // v3.6: al explorar, 5 puntos para todos
      description: 'Espíritus de los árboles con forma de persona. Su corteza tiene espinas: el que le pega de cerca, se lastima.',
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
  // ---------- v3.6: todas las razas con el mismo poder ----------
  // bonuses = lo de la clase (CLASS_BASE) + exactamente RACE_POINTS puntos de raza.
  // Lo que cuesta cada cosa (COST): +2 de vida, +2 de maná, +1 de velocidad, +1 de
  // precisión o +1 de esquiva = 1 punto; +1 de armadura o +1 de daño = 2 puntos.
  // Bajar algo devuelve puntos (el enano es más lento y por eso tiene más vida).
  // Al explorar (explore), todas suman EXPLORE_POINTS entre Fuerza, Agilidad, Ingenio,
  // Puntería y Suerte. Lo prueba v36/engine/budget_test.js.
  const CLASS_BASE = {
    warrior: { hp: 2, mana: 0, speed: -1, precision: 0, armor: 0, damage: 0, dodge: -1 },
    hybrid: { hp: 0, mana: 0, speed: 1, precision: 1, armor: 0, damage: 0, dodge: 1 },
    mage: { hp: -10, mana: 2, speed: 1, precision: 1, armor: 0, damage: 0, dodge: 2 },
  };
  const COST = { hp: 0.5, mana: 0.5, speed: 1, precision: 1, dodge: 1, armor: 2, damage: 2 };
  const RACE_POINTS = 3;
  const EXPLORE_POINTS = 5;
  /** Puntos de raza que usa (lo que tiene de más sobre su clase). Debe dar RACE_POINTS. */
  function racePoints(raceOrId) {
    const race = typeof raceOrId === 'string' ? findRace(raceOrId) : raceOrId;
    if (!race) return 0;
    const base = CLASS_BASE[race.combatType] || CLASS_BASE.hybrid;
    const b = race.bonuses || {};
    let t = 0;
    for (const k of Object.keys(COST)) t += ((b[k] || 0) - (base[k] || 0)) * COST[k];
    return Math.round(t * 10) / 10;
  }
  /** Puntos de explorar (Fuerza + Agilidad + Ingenio + Puntería + Suerte). Debe dar EXPLORE_POINTS. */
  function explorePoints(raceOrId) {
    const race = typeof raceOrId === 'string' ? findRace(raceOrId) : raceOrId;
    const e = (race && race.explore) || {};
    return ['fuerza', 'agilidad', 'ingenio', 'punteria', 'suerte'].reduce((t, k) => t + (e[k] || 0), 0);
  }

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
  A.Seed.racePoints = racePoints; // v3.6
  A.Seed.explorePoints = explorePoints;
  A.Seed.RACE_BUDGET = { CLASS_BASE, COST, RACE_POINTS, EXPLORE_POINTS };
  A.Seed.raceHasMagic = raceHasMagic;
  A.Seed.rollMagicForRace = rollMagicForRace;
})(window.Aventurs);
