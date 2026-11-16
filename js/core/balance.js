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

  const MAX_LEVEL = 10;
  const MAX_TIER = 10;

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

    /** XP necesaria para pasar de nivel L a L+1 (~9 combates de su tier). */
    xpToNext(level) {
      const L = Math.max(1, Math.min(MAX_LEVEL, level));
      const tierXp = 8 + 6 * (L - 1) + 1.2 * (L - 1) * (L - 1);
      return Math.round((tierXp * 14) / 5) * 5;
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
      const HP_BY_TYPE = { warrior: 6, hybrid: 6, mage: 5 };
      return {
        maxHp: HP_BY_TYPE[combatType] || 6,
        precision: 1,
        dodge: newLevel % 2 === 1 ? 1 : 0,     // niveles 3, 5, 7, 9
        damage: newLevel % 3 === 1 ? 1 : 0,    // niveles 4, 7, 10
        maxMana: hasMagic ? (combatType === 'mage' ? 5 : 3) : 0,
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
      out.note = `Maestría con armas: +${out.dmg} de daño${out.atk ? ' y +1 al ataque' : ''}.`;
    } else if (type === 'mage') {
      if (heavy) { out.atk = -3; out.note = 'Muy pesada para un mago: -3 al ataque.'; }
      else if (medium && !magicW) { out.atk = -1; out.note = 'Incómoda para un mago: -1 al ataque.'; }
      else if (magicW) out.note = 'Arma mágica: potencia tus hechizos.';
    }
    return out;
  }

  /** Poder mágico: los magos lo tienen más alto y crece más rápido. */
  function spellPowerOf(p, weapon) {
    const type = classOf(p);
    const lvl = Math.max(1, (p && p.level) || 1);
    const wBonus = weapon && weapon.magic ? 1 + Math.floor((weapon.tier || 1) / 3) : 0;
    if (type === 'mage') return 1 + Math.floor(lvl / 2) + wBonus;
    if (type === 'hybrid') return Math.floor((lvl - 1) / 2) + wBonus;
    return 0;
  }

  // ---------- Stats de combate del jugador (incluye equipo y hambre) ----------
  function playerCombatStats(p) {
    if (!p) return null;
    const weapon = p.equipment && p.equipment.weapon ? A.Data.getById('weapons', p.equipment.weapon) : null;
    const armor = p.equipment && p.equipment.armor ? A.Data.getById('armors', p.equipment.armor) : null;
    const pen = (stat) => (A.Survival && A.Survival.getStatPenalty ? A.Survival.getStatPenalty(stat) : 0);
    const fx = statusMods(p);
    const weight = (weapon ? weapon.weight || 0 : 0) + (armor ? armor.weight || 0 : 0);
    const fit = weaponFit(p, weapon);
    return {
      fit,
      attack: (p.stats.precision || 0) + fit.atk - fx.attackPenalty,
      defense: 8 + (p.stats.dodge || 0) + (armor && armor.dodge ? armor.dodge : 0) - pen('dodge') - fx.defensePenalty,
      armor: (p.stats.armor || 0) + (armor ? armor.defense || 0 : 0),
      // v1.9.2: + Furia del orco (solo con la mitad de la vida o menos) · v2.0: + maestría del guerrero
      damageBonus: (p.stats.damage || 0) - pen('damage') + fit.dmg + (A.Passives ? A.Passives.damageBonus(p) : 0),
      // El peso solo frena si pasa de 4 (una daga y ropa no pesan nada)
      speed: Math.max(1, (p.stats.speed || 10) - Math.max(0, weight - 4) - pen('speed')),
      weapon,
      armorItem: armor,
      spellPower: spellPowerOf(p, weapon),
    };
  }

  /** Penalizaciones por efectos de estado (frío, ceguera). */
  function statusMods(entity) {
    const out = { attackPenalty: 0, defensePenalty: 0 };
    for (const ef of (entity && entity.effects) || []) {
      if (ef.type === 'cold') { out.defensePenalty += 2; out.attackPenalty += 1; }
      if (ef.type === 'blind') out.attackPenalty += 4;
    }
    return out;
  }

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
    MAX_LEVEL,
    CATEGORY,
    Enemy,
    enemyStats,
    damageToNotation,
    avgOf,
    hitChance,
    Progression,
    playerCombatStats,
    weaponFit,
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
