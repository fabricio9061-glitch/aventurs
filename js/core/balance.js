/* ============================================================
   Aventurs — Balance (v1.8.0)
   Fuente única de todas las fórmulas del juego. Si querés que algo
   sea más fácil o más difícil, se cambia ACÁ y todo el juego se
   ajusta solo (enemigos, mascota, loot, precios, niveles).

   Regla de oro del combate (para todos: jugador, mascota y enemigos):
     Ataque:  D20 + ataque  >=  defensa del objetivo  -> pega
              D20 natural 1  -> falla siempre
              D20 natural 20 -> crítico (daño x2), pega siempre
     Daño:    dados - armadura del objetivo (si pega, mínimo 1)
     Hechizo: no se esquiva, la armadura cuenta la mitad

   Escala: un personaje de nivel N está pensado para pelear contra
   enemigos de tier N. Contra un enemigo "normal" de su tier gana casi
   siempre y pierde ~25-30% de su vida.
   ============================================================ */

(function (A) {
  'use strict';

  // v2.2.1: números de las clases que se afinan con el simulador (tools/simulador.js)
  const Balance_TUNE = {
    hpPerLevel: { warrior: 7, hybrid: 6, mage: 5 },   // vida que gana cada clase al subir de nivel (v2.5: guerreros 7, aguantan las habilidades de las criaturas)
    warriorPower: { mult: 2, cooldown: 5 },           // Golpe fuerte: x2 de daño, después esperar
    hybridManaOnHit: 1,                               // maná que recupera un híbrido al acertar con el arma
    hybridManaEvery: 5,                               // ...y 1 más cada tantos niveles (0 = no crece) · v2.5: 5 (antes 4)
    mageRegenEvery: 3,                                // el maná por turno de los magos se multiplica cada tantos niveles (0 = no crece) · v2.5: 3 (antes 4)
  };

  const MAX_LEVEL = 10;
  const MAX_TIER = 10;

  // ---------- v2.4: rarezas ----------
  // value: cuánto vale un material (por la moneda base de su nivel)
  // drop: con qué probabilidad lo suelta una criatura normal
  const RARITY = {
    common: { label: 'Común', color: '#8a7a68', value: 2, drop: 0.4, order: 0 },
    uncommon: { label: 'Poco común', color: '#4a8a3a', value: 4.5, drop: 0.22, order: 1 },
    rare: { label: 'Raro', color: '#3a6ac8', value: 10, drop: 0.1, order: 2 },
    epic: { label: 'Épico', color: '#8a4ac8', value: 25, drop: 0.05, order: 3 },
    legendary: { label: 'Legendario', color: '#d0861a', value: 60, drop: 0.02, order: 4 },
  };

  // ---------- Categorías de enemigo ----------
  // hp/dmg: multiplicadores. atk/def: suman al ataque/defensa.
  // coin/xp: multiplicadores de recompensa.
  const CATEGORY = {
    weak:   { hp: 0.6, dmg: 0.75, atk: -1, def: -1, coin: 0.6, xp: 0.6, label: 'Débil' },
    normal: { hp: 1.0, dmg: 1.0,  atk: 0,  def: 0,  coin: 1.0, xp: 1.0, label: 'Normal' },
    strong: { hp: 1.35, dmg: 1.1, atk: 1,  def: 0,  coin: 1.8, xp: 1.8, label: 'Fuerte' },
    boss:   { hp: 2.6,  dmg: 1.25, atk: 2, def: 1,  coin: 6.0, xp: 6.0, label: 'Jefe' },
  };

  function clampTier(t) { return Math.max(1, Math.min(MAX_TIER, Math.round(t || 1))); }
  function cat(c) { return CATEGORY[c] || CATEGORY.normal; }

  // ---------- Curva de enemigos (categoría normal) ----------
  const Enemy = {
    hp(t) { t = clampTier(t); return Math.round(13 + 4.5 * (t - 1)); },
    dmg(t) { t = clampTier(t); return 4.0 + 1.35 * (t - 1); },          // daño promedio por golpe
    armor(t) { t = clampTier(t); return Math.floor((t - 1) / 2); },
    attack(t) { t = clampTier(t); return 1 + Math.floor((t - 1) / 2); },  // bonus al D20
    defense(t) { t = clampTier(t); return 8 + (t - 1); },                 // D20 a superar
  };

  /**
   * Stats sugeridos para un enemigo según tier y categoría.
   * profile (opcional) = { hp, dmg, armor } multiplicadores de la especie
   * (ej: tortuga = mucha vida, poco daño). Se recortan a 0.75..1.35 para
   * que ninguna especie rompa la curva.
   */
  function enemyStats(tier, category = 'normal', profile = {}) {
    const c = cat(category);
    const clampF = (v) => Math.max(0.75, Math.min(1.35, v || 1));
    const hpF = clampF(profile.hp);
    const dmgF = clampF(profile.dmg);
    const avgDmg = Enemy.dmg(tier) * c.dmg * dmgF;
    return {
      health: Math.max(4, Math.round(Enemy.hp(tier) * c.hp * hpF)),
      damage: damageToNotation(avgDmg),
      damageAvg: avgDmg,
      armor: Math.max(0, Enemy.armor(tier) + (profile.armor || 0)),
      attack: Math.max(0, Enemy.attack(tier) + c.atk),
      difficulty: Math.max(5, Enemy.defense(tier) + c.def),
    };
  }

  // ---------- Dados ----------
  const DICE_PRESETS = [
    ['1d2', 1.5], ['1d3', 2], ['1d4', 2.5], ['1d6', 3.5], ['1d4+1', 3.5], ['1d6+1', 4.5],
    ['1d8', 4.5], ['1d8+1', 5.5], ['1d10', 5.5], ['2d4+1', 6], ['1d12', 6.5], ['2d6', 7],
    ['2d6+1', 8], ['2d8', 9], ['2d8+1', 10], ['3d6', 10.5], ['3d6+1', 11.5], ['3d6+2', 12.5],
    ['3d8', 13.5], ['3d8+1', 14.5], ['3d8+2', 15.5], ['4d6+2', 16], ['3d10+1', 17.5],
    ['4d8', 18], ['3d10+3', 19.5], ['4d8+2', 20], ['4d10', 22], ['5d8', 22.5], ['4d10+2', 24],
    ['5d10', 27.5], ['6d10', 33], ['7d10', 38.5],
  ];

  function damageToNotation(avg) {
    if (!(avg > 0)) return '1';
    let best = DICE_PRESETS[0];
    for (const p of DICE_PRESETS) {
      if (Math.abs(p[1] - avg) < Math.abs(best[1] - avg)) best = p;
    }
    return best[0];
  }

  /** Promedio de una notación de dados ('2d6+1' -> 8). Acepta números. */
  function avgOf(notation) {
    if (typeof notation === 'number') return notation;
    const parts = String(notation || '').replace(/\s+/g, '').split('+');
    let total = 0;
    for (const part of parts) {
      if (!part) continue;
      const m = part.match(/^(\d+)d(\d+)(-\d+)?$/i);
      if (m) total += (+m[1]) * ((+m[2]) + 1) / 2 + (m[3] ? +m[3] : 0);
      else total += Number(part) || 0;
    }
    return total;
  }

  /** Mínimo y máximo de una notación de dados ('1d4+1' -> { min: 2, max: 5 }). */
  function rangeOf(notation) {
    if (typeof notation === 'number') return { min: notation, max: notation };
    let min = 0, max = 0;
    const re = /([+-]?)\s*(\d+)d(\d+)|([+-]?)\s*(\d+)/gi;
    let m;
    const str = String(notation || '');
    while ((m = re.exec(str))) {
      if (m[2]) { const sg = m[1] === '-' ? -1 : 1; const n = +m[2], f = +m[3]; if (sg > 0) { min += n; max += n * f; } else { min -= n * f; max -= n; } }
      else if (m[5]) { const v = (m[4] === '-' ? -1 : 1) * (+m[5]); min += v; max += v; }
    }
    return { min, max };
  }

  // ---------- Probabilidad de impacto ----------
  /** Chance de pegar con D20 + ataque >= defensa (1 falla, 20 pega). */
  function hitChance(attack, defense) {
    const need = defense - attack;          // número mínimo del D20
    const ok = 21 - Math.max(2, Math.min(20, need));
    return Math.max(1, Math.min(19, ok)) / 20;
  }

  // ---------- Progresión del jugador ----------
  const Progression = {
    MAX_LEVEL,

    /** XP que da un enemigo al morir. */
    xpForEnemy(enemy) {
      const t = clampTier(enemy && enemy.tier);
      const base = 8 + 6 * (t - 1) + 1.2 * (t - 1) * (t - 1);
      return Math.max(1, Math.round(base * cat(enemy && enemy.category).xp));
    },

    /**
     * XP necesaria para pasar de nivel L a L+1.
     * v3.0: subir cuesta bastante más que antes (antes se llegaba al 10 en unas
     * 70 peleas). Medido con el simulador en la zona de cada nivel: del 1 al 2
     * son unas 8 peleas y va subiendo hasta unas 25 (unas 150 en total).
     */
    XP_TABLE: [100, 210, 470, 850, 1300, 1850, 2900, 3700, 4500],
    /** v3.0: la tabla de antes (para pasar las partidas viejas sin perder lo avanzado). */
    XP_TABLE_V2: [45, 100, 250, 390, 580, 820, 1240, 1800, 1950],
    xpToNext(level) {
      const L = Math.max(1, Math.min(MAX_LEVEL - 1, level));
      return Progression.XP_TABLE[L - 1];
    },

    /**
     * v3.0: la experiencia depende de la diferencia entre tu nivel y el de la criatura.
     * Las de tu nivel o más dan todo (un poco más si son más fuertes); las que quedaron
     * atrás dan cada vez menos, así no se sube de nivel matando lo fácil.
     */
    LEVEL_GAP: { above: 0.1, aboveMax: 3, below: [1, 0.75, 0.45, 0.2, 0.1] },
    levelGapMult(level, tier) {
      const g = Progression.LEVEL_GAP;
      const d = clampTier(tier) - Math.max(1, level || 1);
      if (d >= 0) return 1 + g.above * Math.min(g.aboveMax, d);
      const i = Math.min(g.below.length - 1, -d);
      return g.below[i];
    },

    /** XP total acumulada necesaria para llegar a nivel L. */
    xpForLevel(level) {
      let total = 0;
      for (let l = 1; l < Math.min(level, MAX_LEVEL + 1); l++) total += Progression.xpToNext(l);
      return total;
    },

    /**
     * Lo que gana el jugador al subir AL nivel `newLevel`.
     * La vida depende del tipo de raza (los guerreros no tienen magia,
     * así que compensan con más vida; los magos con más maná).
     */
    gainsForLevel(newLevel, hasMagic, combatType) {
      // v2.1.1: el guerrero es el que más aguanta
      const HP_BY_TYPE = Balance_TUNE.hpPerLevel;
      return {
        maxHp: HP_BY_TYPE[combatType] || 6,
        precision: 1,
        dodge: newLevel % 2 === 1 ? 1 : 0,     // niveles 3, 5, 7, 9
        damage: newLevel % 3 === 1 ? 1 : 0,    // niveles 4, 7, 10
        maxMana: hasMagic ? (combatType === 'mage' ? 4 : 3) : 0,
      };
    },

    /** Aplica UN nivel al jugador. Devuelve texto con las mejoras. */
    applyLevelUp(p) {
      if (!p || p.level >= MAX_LEVEL) return null;
      p.level += 1;
      const race = A.Data && A.Data.getById ? A.Data.getById('races', p.raceId) : null;
      const g = Progression.gainsForLevel(p.level, p.hasMagic, race ? race.combatType : 'hybrid');
      p.maxHp += g.maxHp;
      p.stats.precision = (p.stats.precision || 0) + g.precision;
      p.stats.dodge = (p.stats.dodge || 0) + g.dodge;
      p.stats.damage = (p.stats.damage || 0) + g.damage;
      if (p.hasMagic) p.maxMana += g.maxMana;
      p.hp = p.maxHp;
      p.mana = p.maxMana;
      const parts = [`+${g.maxHp} vida`, `+${g.precision} precisión`];
      if (g.dodge) parts.push(`+${g.dodge} esquiva`);
      if (g.damage) parts.push(`+${g.damage} daño`);
      if (g.maxMana) parts.push(`+${g.maxMana} maná`);
      return parts.join(', ');
    },

    /**
     * Revisa si el jugador tiene XP para subir (puede subir varios niveles).
     * Devuelve array de { level, text }.
     */
    checkLevelUp(p) {
      const out = [];
      while (p && p.level < MAX_LEVEL && (p.xp || 0) >= Progression.xpForLevel(p.level + 1)) {
        const text = Progression.applyLevelUp(p);
        out.push({ level: p.level, text });
      }
      return out;
    },

    /** Nivel mínimo recomendado para entrar a una región de cierto tier. */
    minLevelForTier(tierMin) {
      return Math.max(1, Math.min(MAX_LEVEL, tierMin || 1));
    },
  };

  // ---------- v2.0: cada clase pelea distinto ----------
  /**
   * Cómo le queda un arma a una clase:
   *   guerrero: maestría (+daño que crece con el nivel) y +1 al ataque con armas medianas o pesadas
   *   híbrido:  normal con todas las armas (y con magia a medias)
   *   mago:     las pesadas le dan -3 al ataque y las medianas no mágicas -1; su fuerte es la magia
   */
  function classOf(p) {
    const race = p && A.Data && A.Data.getById ? A.Data.getById('races', p.raceId) : null;
    return (race && race.combatType) || 'hybrid';
  }

  /**
   * v2.1.1: Golpe fuerte de los guerreros (su "hechizo"): doble daño,
   * y después hay que esperar unos turnos. null si no es guerrero.
   */
  function warriorPower(p) {
    return classOf(p) === 'warrior' ? { ...Balance_TUNE.warriorPower } : null;
  }

  /** v2.2.1: los híbridos recuperan maná cada vez que aciertan con el arma. */
  function manaOnHit(p) {
    if (!(p && p.hasMagic && classOf(p) === 'hybrid')) return 0;
    const every = Balance_TUNE.hybridManaEvery;
    return Balance_TUNE.hybridManaOnHit + (every > 0 ? Math.floor((Math.max(1, p.level || 1) - 1) / every) : 0);
  }

  /**
   * v2.1.1: vida que se recupera al ganar una pelea (parte de la vida máxima).
   * Por ahora ninguna clase la trae de base; una raza puede tenerla (hpRegen.win).
   */
  function hpRegenOf(p) {
    if (!p) return { win: 0 };
    const race = A.Data && A.Data.getById ? A.Data.getById('races', p.raceId) : null;
    if (race && race.hpRegen && typeof race.hpRegen.win === 'number') return { win: race.hpRegen.win };
    return { win: 0 };
  }

  function weaponFit(p, weapon) {
    const type = classOf(p);
    const lvl = Math.max(1, (p && p.level) || 1);
    const w = weapon ? weapon.weight || 0 : 0;
    const heavy = w >= 4;
    const medium = w >= 2 && w < 4;
    const magicW = !!(weapon && weapon.magic);
    const out = { type, atk: 0, dmg: 0, note: '' };
    if (type === 'warrior') {
      out.dmg = 1 + Math.floor((lvl - 1) / 4);
      if (heavy) out.atk = 1;
      out.note = `Maestría con armas: +${out.dmg} de daño${out.atk ? ' y +1 de precisión' : ''}.`;
    } else if (type === 'mage') {
      if (heavy) { out.atk = -3; out.note = 'Muy pesada para un mago: -3 de precisión.'; }
      else if (medium && !magicW) { out.atk = -1; out.note = 'Incómoda para un mago: -1 de precisión.'; }
      else if (magicW) out.note = 'Arma mágica: potencia tus hechizos.';
    }
    return out;
  }

  /** Poder mágico: los magos lo tienen más alto y crece más rápido. */
  function spellPowerOf(p, weapon) {
    const type = classOf(p);
    const lvl = Math.max(1, (p && p.level) || 1);
    const wBonus = weapon && weapon.magic ? 1 + Math.floor((weapon.tier || 1) / 4) : 0;
    if (type === 'mage') return Math.floor(lvl / 2) + wBonus;
    if (type === 'hybrid') return Math.floor((lvl - 1) / 2) + wBonus;
    return 0;
  }

  /**
   * v2.1: recuperación de maná. Solo los magos recuperan solos:
   *   turn - maná al empezar cada turno tuyo en combate
   *   win  - parte del maná máximo que vuelve al ganar la pelea
   * Los híbridos devuelven 0 y 0: pociones o dormir.
   */
  function manaRegenOf(p) {
    if (!p || !p.hasMagic) return { turn: 0, win: 0 };
    const race = A.Data && A.Data.getById ? A.Data.getById('races', p.raceId) : null;
    const type = (race && race.combatType) || 'hybrid';
    const base = (race && race.manaRegen) || (type === 'mage' ? { turn: 1, win: 0.2 } : { turn: 0, win: 0 });
    // v2.2.1: con más nivel vuelve más maná por turno (+1 desde nivel 5, +2 desde nivel 9)
    const every = Balance_TUNE.mageRegenEvery;
    const extra = every > 0 && (base.turn || 0) > 0 ? Math.floor((Math.max(1, p.level || 1) - 1) / every) : 0;
    return { turn: (base.turn || 0) + extra, win: base.win || 0 };
  }

  // ---------- Stats de combate del jugador (incluye equipo, accesorio, mejoras y hambre) ----------
  /** v2.4: el peso de arma y armadura frena: cada punto por encima de 4 es -1 de velocidad. */
  const FREE_WEIGHT = 4;
  function weightOf(p) {
    const weapon = p && p.equipment && p.equipment.weapon ? A.Data.getById('weapons', p.equipment.weapon) : null;
    const armor = p && p.equipment && p.equipment.armor ? A.Data.getById('armors', p.equipment.armor) : null;
    const total = (weapon ? weapon.weight || 0 : 0) + (armor ? armor.weight || 0 : 0);
    return { total, free: FREE_WEIGHT, penalty: Math.max(0, total - FREE_WEIGHT) };
  }

  function playerCombatStats(p) {
    if (!p) return null;
    const weapon = p.equipment && p.equipment.weapon ? A.Data.getById('weapons', p.equipment.weapon) : null;
    const armor = p.equipment && p.equipment.armor ? A.Data.getById('armors', p.equipment.armor) : null;
    const pen = (stat) => (A.Survival && A.Survival.getStatPenalty ? A.Survival.getStatPenalty(stat) : 0);
    const fx = statusMods(p);
    const w = weightOf(p);
    const fit = weaponFit(p, weapon);
    // v2.4: accesorio puesto y mejoras de pociones o pergaminos
    const acc = (k) => (A.Accessories ? A.Accessories.bonus(p, k) : 0);
    const bm = A.ItemFx ? A.ItemFx.buffMods(p) : { damage: 0, armor: 0, precision: 0, defense: 0, speed: 0 };
    const weaponPrec = weapon && weapon.precision ? weapon.precision : 0;
    return {
      fit,
      attack: (p.stats.precision || 0) + fit.atk + weaponPrec + acc('precision') + bm.precision - fx.attackPenalty + (A.Passives && A.Passives.precisionBonus ? A.Passives.precisionBonus(p) : 0),
      defense: 8 + (p.stats.dodge || 0) + (armor && armor.dodge ? armor.dodge : 0) + acc('defense') + bm.defense - pen('dodge') - fx.defensePenalty,
      // v2.5: el ácido de las criaturas te baja la armadura
      armor: Math.max(0, (p.stats.armor || 0) + (armor ? armor.defense || 0 : 0) + acc('armor') + bm.armor + (A.Passives && A.Passives.armorBonus ? A.Passives.armorBonus(p) : 0) - (fx.armorPenalty || 0)),
      // v1.9.2: + Furia del orco (solo con la mitad de la vida o menos) · v2.0: + maestría del guerrero · v2.5: - miedo
      damageBonus: (p.stats.damage || 0) - pen('damage') + fit.dmg + acc('damage') + bm.damage + (A.Passives ? A.Passives.damageBonus(p) : 0) - (fx.damagePenalty || 0),
      // El peso solo frena si pasa de 4 (una daga y ropa no pesan nada)
      speed: Math.max(1, (p.stats.speed || 10) - w.penalty + acc('speed') + bm.speed - pen('speed')),
      weight: w.total,
      weightPenalty: w.penalty,
      weapon,
      armorItem: armor,
      spellPower: spellPowerOf(p, weapon),
    };
  }

  /**
   * Penalizaciones por efectos de estado (frío, ceguera, maldición...).
   * v2.5: derribado (-3 defensa), miedo (-2 precisión, -1 daño), atrapado (-2 precisión),
   * ácido (-2 armadura). Y lo que ayuda a las criaturas: envalentonado (+precisión y daño)
   * y en guardia (+defensa), que se cuentan como penalización negativa.
   */
  function statusMods(entity) {
    const out = { attackPenalty: 0, defensePenalty: 0, armorPenalty: 0, damagePenalty: 0 };
    for (const ef of (entity && entity.effects) || []) {
      const v = Number(ef.value) || 1;
      if (ef.type === 'cold') { out.defensePenalty += 2; out.attackPenalty += 1; }
      if (ef.type === 'blind') out.attackPenalty += 4;
      // v2.4: Pergamino de maldición: -N a su precisión y a su defensa
      if (ef.type === 'curse') { out.attackPenalty += v; out.defensePenalty += v; }
      if (ef.type === 'prone') out.defensePenalty += 3;
      if (ef.type === 'fear') { out.attackPenalty += 2; out.damagePenalty += 1; }
      if (ef.type === 'grab') out.attackPenalty += 2;
      if (ef.type === 'corrode') out.armorPenalty += 2;
      if (ef.type === 'rally') { out.attackPenalty -= v; out.damagePenalty -= v; }
      if (ef.type === 'guard') out.defensePenalty -= v;
    }
    return out;
  }

  // ---------- Élite (v2.5) ----------
  // A veces una criatura sale "alfa", "campeón" o "mayor": más vida, más daño, mejor botín.
  // v3.0: en grupo vienen más criaturas (y un poco más fuertes) y cada uno se lleva una parte
  // (medido con el simulador: dos héroes juntos pierden más o menos lo mismo que uno solo)
  const PARTY = {
    extra: 0.6,      // criaturas de más: una parte del grupo (copias de las comunes)
    maxEnemies: 5,   // tope de criaturas en la arena
    hp: 1.15,        // vida de cada criatura
    dmg: 1.1,        // daño de cada criatura
    bossHp: 1.9,     // un jefe (o élite) solo: más vida...
    bossDmg: 1.35,   // ...y más daño
    share: 0.6,      // parte de la experiencia, las monedas y el botín que se lleva cada uno
  };

  const ELITE = {
    chanceSolo: 0.05,  // si aparece sola
    chanceGroup: 0.09, // si viene en grupo (una sola del grupo)
    hp: 1.5, dmg: 1.2, atk: 1, def: 1, armorFromTier: 4, speed: 1,
    xp: 2.5, coin: 2.5, drop: 1.5,
  };

  // ---------- Mascota ----------
  const Pet = {
    /** Vida de la mascota según su nivel (antes del perfil de especie). */
    hp(level) { return Math.round(16 + 6 * (Math.max(1, level) - 1)); },
    /** Daño promedio por golpe según nivel. */
    dmg(level) { return 2.2 + 0.6 * (Math.max(1, level) - 1); },
    attack(level) { return Math.max(1, level); },
    armor(level) { return Math.floor((Math.max(1, level) - 1) / 3); },
    /** XP para que la mascota suba de nivel (recibe la mitad de la XP del jugador). */
    xpToNext(level) { return Math.round(Progression.xpToNext(level) / 2); },
    MAX_FOOD: 10,
  };

  // ---------- Economía ----------
  const Economy = {
    /** Cobre promedio que suelta un enemigo normal de tier t. */
    coinBase(t) { t = clampTier(t); return 2.5 * Math.pow(1.45, t - 1); },

    /**
     * v2.0: monedas SEGURAS de un enemigo (siempre suelta algo).
     * Más si es de más tier o si es fuerte/jefe; ±20% de azar.
     */
    coinsFor(enemy, rnd = Math.random) {
      if (!enemy) return 0;
      const avg = Economy.coinBase(enemy.tier) * cat(enemy.category).coin;
      return Math.max(1, Math.round(avg * (0.8 + 0.4 * rnd())));
    },

    /** Drop de monedas listo para enemy.drops. */
    coinDrop(enemy) {
      const avg = Economy.coinBase(enemy.tier) * cat(enemy.category).coin;
      const fam = enemy.family || [];
      // Bestias e insectos no cargan monedas: casi nunca sueltan, pero dejan materiales
      const carries = fam.some((f) => ['humanoid', 'demon', 'undead', 'dragon', 'giant', 'arcane', 'spirit'].includes(f));
      const chance = carries ? 0.9 : 0.35;
      const perDrop = avg / chance;
      return {
        itemId: 'coin_copper',
        chance,
        qtyMin: Math.max(1, Math.round(perDrop * 0.6)),
        qtyMax: Math.max(1, Math.round(perDrop * 1.4)),
        source: 'balance',
      };
    },

    /** Precio de armas y armaduras por tier y rareza (en cobre). */
    gearPrice(t, rarity = 'common', kind = 'weapon') {
      const RAR = { common: 1, uncommon: 1.3, rare: 1.7, epic: 2.5, legendary: 4 };
      const base = 25 * Math.pow(1.45, clampTier(t) - 1) * (RAR[rarity] || 1);
      return Math.round(base * (kind === 'armor' ? 1.2 : 1));
    },

    /** Precio para aprender un hechizo con un NPC. */
    spellPrice(spell) {
      return Math.max(30, Math.round(Economy.gearPrice((spell && spell.tier) || 1) * 1.5));
    },

    /** Valor máximo razonable de un material que suelta un enemigo de tier t. */
    materialCap(t) { return Math.round(Economy.coinBase(t) * 10); },

    // ---------- v2.4: rarezas, botín y consumibles ----------

    /** Valor de un material según el nivel de la criatura más fácil que lo suelta y su rareza. */
    materialValue(t, rarity = 'common') {
      return Math.max(1, Math.round(Economy.coinBase(t) * (RARITY[rarity] || RARITY.common).value));
    },

    /** Probabilidad de que una criatura suelte un objeto de esa rareza. */
    dropChance(rarity = 'common', category = 'normal') {
      const base = (RARITY[rarity] || RARITY.common).drop;
      const mult = ({ weak: 0.9, normal: 1, strong: 1.25, boss: 1.6 })[category] || 1;
      return Math.min(0.85, Math.round(base * mult * 100) / 100);
    },

    /**
     * Precio de comidas, pociones y pergaminos según lo que dan:
     * 2,4 de cobre por punto de vida, 2,8 por punto de maná, 1,2 por punto de comida,
     * y las mejoras según cuánto ayudan y cuántos turnos duran.
     */
    consumablePrice(item) {
      if (!item) return 0;
      const ef = item.effect || {};
      const hpAt = (t) => 24 + 6 * (clampTier(t || 1) - 1);
      let v = 0;
      if (ef.type === 'heal') v += ef.pct ? ef.pct * hpAt(item.tier) * 2.4 * 1.2 : avgOf(ef.amount) * 2.4;
      if (ef.type === 'mana') v += avgOf(ef.amount) * 2.8;
      if (ef.type === 'food') v += (ef.amount || 0) * 1.2;
      if (ef.heal && ef.type !== 'heal') v += avgOf(ef.heal) * 2.4;
      if (item.foodValue) v += item.foodValue * 1.2;
      if (item.healAmount) v += item.healAmount * 2.4;
      if (ef.type === 'cure') v += 12;
      if (ef.type === 'escape') v += 40;
      if (ef.type === 'buff') {
        const PER = { damage: 5, armor: 5, precision: 3, defense: 3, regen: 2.4, invisible: 30, resist: 3, immune: 6, reflect: 40, invincible: 60, speed: 2 };
        const turns = ef.duration || 3;
        let per = (PER[ef.stat] || 3) * (ef.amount || 1);
        for (const k of Object.keys(ef.also || {})) per += (PER[k] || 3) * Math.max(0, ef.also[k]);
        v += per * turns;
      }
      return Math.max(2, Math.round(v));
    },

    /**
     * v3.0: precio de los pergaminos de combate según lo que hacen (y nunca menos
     * que lo que vale algo de su nivel y rareza). Antes los comunes costaban como
     * una manzana: un Misil arcano (1d8+2 que nunca falla) estaba a 9 de cobre.
     *   daño seguro: 3,2 por punto (x2,2 si es a todos) · estados y aturdir aparte
     *   mejoras: como las pociones, un poco menos (duran poco)
     */
    scrollPrice(item) {
      if (!item) return 0;
      const ef = item.effect || {};
      let v = 0;
      if (ef.type === 'damage') {
        v = avgOf(ef.dice) * 3.2;
        if (ef.status) v += (ef.status.turns || 2) * (ef.status.value || 1) * 2.8;
        if (ef.stun) v += 22 * ef.stun;
        if (ef.drain) v += avgOf(ef.dice) * 2.4;
        if (ef.all) v *= 2.2;
      } else if (ef.type === 'stun') v = 24 * (ef.turns || 1) * (ef.all ? 2.5 : 1) + (ef.status ? 10 : 0);
      else if (ef.type === 'curse') v = (ef.amount || 1) * (ef.duration || 3) * 3.5;
      else if (ef.type === 'cleanse') v = 14 + (ef.pct || 0) * 72;
      else if (ef.type === 'survivor') v = 70;
      else if (ef.type === 'restore') v = 160;
      else if (ef.type === 'buff') v = Economy.consumablePrice(item) * 0.7;
      else v = Economy.consumablePrice(item);
      const byTier = Economy.gearPrice(item.tier || 1, item.rarity || 'common') * 0.35;
      return Math.max(4, Math.round(Math.max(byTier, v * 1.3)));
    },
  };

  // ---------- Viaje ----------
  const Travel = {
    STEPS_MIN: 3,
    STEPS_MAX: 12,
    /** Cada cuántos pasos se consume 1 de comida. */
    STEPS_PER_FOOD: 2,
    /** Probabilidad de encuentro por paso según tipo de destino. */
    CREATURE_CHANCE: { combat: 0.28, safe: 0.06 },
  };

  A.Balance = {
    PARTY,
    MAX_LEVEL,
    CATEGORY,
    ELITE,
    RARITY,
    Enemy,
    enemyStats,
    damageToNotation,
    avgOf,
    rangeOf,
    hitChance,
    Progression,
    playerCombatStats,
    weightOf,
    FREE_WEIGHT,
    weaponFit,
    manaRegenOf,
    hpRegenOf,
    warriorPower,
    manaOnHit,
    TUNE: Balance_TUNE,
    spellPowerOf,
    classOf,
    statusMods,
    Pet,
    Economy,
    Travel,
  };
  // Atajo: la progresión se usa mucho
  A.Progression = Progression;
})(window.Aventurs);
