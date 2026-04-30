/* ============================================================
   Aventurs — Seed: Razas
   9 razas hardcoded. Stats balanceados por combatType.
   El editor permite override manual.

   combatType:
     warrior  -> +HP, +armor, +damage, -mana
     mage     -> +mana, +precision, -HP, -armor
     hybrid   -> stats medios en todo

   Stat bonuses son DELTAS sobre la base universal:
     baseHP=20, baseMana=10, baseSpeed=10, basePrecision=0,
     baseArmor=0, baseDamage=0, baseDodge=5
   ============================================================ */

(function (A) {
  'use strict';

  const RACES = [
    {
      id: 'humano',
      name: 'Humano',
      icon: '🧑',
      sprite: '',
      combatType: 'hybrid',
      magicChance: 0.40,
      bonuses: { hp: 4, mana: 2, speed: 1, precision: 1, armor: 0, damage: 0, dodge: 1 },
      description: 'Adaptables y resistentes. Equilibrados en todo, dominantes en nada. La raza más común de los reinos del centro.',
    },
    {
      id: 'elfo',
      name: 'Elfo',
      icon: '🧝',
      sprite: '',
      combatType: 'hybrid',
      magicChance: 0.70,
      bonuses: { hp: -2, mana: 4, speed: 3, precision: 2, armor: 0, damage: 0, dodge: 2 },
      description: 'Ágiles y de instinto certero. Viven mil años bajo los bosques antiguos y rara vez bajan al mundo de los hombres.',
    },
    {
      id: 'enano',
      name: 'Enano',
      icon: '🧔',
      sprite: '',
      combatType: 'warrior',
      bonuses: { hp: 6, mana: -2, speed: -2, precision: 0, armor: 2, damage: 1, dodge: -1 },
      description: 'Bajos y robustos. Su cuerpo soporta golpes que partirían a un humano y su voluntad no cede ante nada.',
    },
    {
      id: 'orco',
      name: 'Orco',
      icon: '👹',
      sprite: '',
      combatType: 'warrior',
      bonuses: { hp: 5, mana: -3, speed: 0, precision: -1, armor: 1, damage: 3, dodge: 0 },
      description: 'Brutales en combate. La furia es su lenguaje y la fuerza su única medida del valor.',
    },
    {
      id: 'mediano',
      name: 'Mediano',
      icon: '🧚',
      sprite: '',
      combatType: 'hybrid',
      magicChance: 0.30,
      bonuses: { hp: -3, mana: 1, speed: 4, precision: 2, armor: 0, damage: 0, dodge: 4 },
      description: 'Pequeños y silenciosos. Lo que pierden en fuerza lo ganan en velocidad y picardía.',
    },
    {
      id: 'gnomo',
      name: 'Gnomo',
      icon: '🧙',
      sprite: '',
      combatType: 'mage',
      bonuses: { hp: -3, mana: 5, speed: 1, precision: 2, armor: 0, damage: -1, dodge: 1 },
      description: 'Inventores natos y de mente curiosa. La magia y la mecánica les vienen de la sangre.',
    },
    {
      id: 'alienigena',
      name: 'Alienígena',
      icon: '👽',
      sprite: '',
      combatType: 'mage',
      bonuses: { hp: -4, mana: 7, speed: 2, precision: 3, armor: 0, damage: -2, dodge: 2 },
      description: 'Visitantes de mundos lejanos. Sus mentes alcanzan corrientes de energía que los nativos apenas perciben.',
    },
    {
      id: 'robot',
      name: 'Robot',
      icon: '🤖',
      sprite: '',
      combatType: 'warrior',
      bonuses: { hp: 8, mana: -10, speed: -1, precision: 1, armor: 3, damage: 1, dodge: -2 },
      description: 'Construidos, no nacidos. Inmunes al cansancio y a la duda, pero ajenos por completo a la magia.',
    },
    {
      id: 'draconido',
      name: 'Dracónido',
      icon: '🐉',
      sprite: '',
      combatType: 'hybrid',
      magicChance: 0.60,
      bonuses: { hp: 3, mana: 3, speed: 0, precision: 0, armor: 1, damage: 2, dodge: 0 },
      description: 'Descendientes de dragones antiguos. Escamas duras, sangre caliente y orgullo más antiguo que los reinos.',
    },
  ];

  // Bases universales de un personaje nivel 1.
  const BASE_STATS = {
    hp: 20,
    mana: 10,
    speed: 10,
    precision: 0,
    armor: 0,
    damage: 0,
    dodge: 5,
  };

  /**
   * Calcula stats finales de un personaje según raza.
   * Devuelve { hp, maxHp, mana, maxMana, speed, precision, armor, damage, dodge }.
   */
  function statsForRace(raceId) {
    const race = RACES.find((r) => r.id === raceId);
    if (!race) return null;
    const b = race.bonuses;
    return {
      hp: BASE_STATS.hp + b.hp,
      maxHp: BASE_STATS.hp + b.hp,
      mana: BASE_STATS.mana + b.mana,
      maxMana: BASE_STATS.mana + b.mana,
      speed: BASE_STATS.speed + b.speed,
      precision: BASE_STATS.precision + b.precision,
      armor: BASE_STATS.armor + b.armor,
      damage: BASE_STATS.damage + b.damage,
      dodge: BASE_STATS.dodge + b.dodge,
    };
  }

  /**
   * Decide si un personaje recién creado puede usar magia, según su raza.
   *   - mage   -> siempre true
   *   - warrior-> siempre false
   *   - hybrid -> roll contra magicChance (default 0.40 si no está definido)
   *
   * Devuelve true / false.
   */
  function rollMagicForRace(raceId) {
    const race = RACES.find((r) => r.id === raceId);
    if (!race) return false;
    if (race.combatType === 'mage') return true;
    if (race.combatType === 'warrior') return false;
    const chance = typeof race.magicChance === 'number' ? race.magicChance : 0.40;
    return Math.random() < chance;
  }

  A.Seed = A.Seed || {};
  A.Seed.races = RACES;
  A.Seed.baseStats = BASE_STATS;
  A.Seed.statsForRace = statsForRace;
  A.Seed.rollMagicForRace = rollMagicForRace;
})(window.Aventurs);
