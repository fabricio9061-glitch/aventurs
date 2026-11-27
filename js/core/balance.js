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
     Hechizo: v3.3: tira el dado con +2 (SPELL_HIT) y puede fallar; la armadura cuenta la mitad

   Escala: un personaje de nivel N está pensado para pelear contra
   enemigos de tier N. Contra un enemigo "normal" de su tier gana casi
   siempre y pierde ~25-30% de su vida.
   ============================================================ */

(function (A) {
  'use strict';

  // v2.2.1: números de las clases que se afinan con el simulador (tools/simulador.js)
  const Balance_TUNE = {
    hpPerLevel: { warrior: 8, hybrid: 6, mage: 5 },   // vida que gana cada clase al subir de nivel (v3.1: guerreros 8; no se curan con magia y quedaban últimos desde el nivel 3)
    manaPerLevel: { hybrid: 3, mage: 4 },             // maná que gana cada clase al subir de nivel
    warriorPower: { mult: 2, cooldown: 5 },           // Golpe fuerte: x2 de daño, después esperar
    hybridManaOnHit: 1,                               // maná que recupera un híbrido al acertar con el arma
    hybridManaEvery: 8,                               // ...y 1 más cada tantos niveles (0 = no crece) · v3.1: 8 (2 por golpe recién al nivel 9; antes al 6 y arrasaban)
    mageRegenEvery: 4,                                // el maná por turno de los magos sube 1 cada tantos niveles (0 = no crece) · v3.1: 4 (niveles 5 y 9; antes 4, 7 y 10)
    mageRegenUpTo: 16,                                // v3.12: ...hasta este nivel (después crece el maná máximo, no lo de cada turno)
    mageWinFrom: 13, mageWinHigh: 0.5,                // v3.12: desde este nivel, lo que vuelve al ganar es la mitad, sin bajar del 10% (los magos encadenaban peleas sin cansarse)
  };

  // v3.11: el tope sube de 10 a 20 (para vos, tu mascota y las criaturas) · v3.12: hasta el 25 (el Cielo, el Espacio y el Infierno profundo)
  const MAX_LEVEL = 25;
  const MAX_TIER = 25;

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
  // v3.11: del 11 al 20 la curva sube un poco más despacio (el equipo y la vida del jugador
  // crecen más lento que antes del 10). Medido con tools/equilibrio.js (rachas nv15 y nv20).
  const Enemy = {
    hp(t) { t = clampTier(t); return Math.round(t <= 10 ? 13 + 4.5 * (t - 1) : 53.5 + 4.0 * (t - 10)); },
    dmg(t) { t = clampTier(t); return t <= 10 ? 4.0 + 1.35 * (t - 1) : 16.15 + 1.1 * (t - 10); },          // daño promedio por golpe
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
    // v3.12: para los niveles 21 a 25 (con pasos intermedios: de 6d10 a 7d10 había mucho salto)
    ['6d10+3', 36], ['7d10+3', 41.5],
    ['8d10', 44], ['9d10', 49.5], ['10d10', 55], ['11d10', 60.5], ['12d10', 66],
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
    // v3.11: del 10 al 20 cuesta más (de unas 30 peleas por nivel a unas 45; en total, unas 2,5 veces lo del 1 al 10)
    // v3.12: del 20 al 25 (el Cielo, el Espacio y el Infierno profundo), cada nivel pide un poco más
    XP_TABLE: [100, 210, 470, 850, 1300, 1850, 2900, 3700, 4500, 8500, 10500, 12800, 15400, 18300, 21500, 25000, 29000, 33500, 38500, 44000, 50500, 57500, 65500, 74500],
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
        maxMana: hasMagic ? ((Balance_TUNE.manaPerLevel || {})[combatType === 'mage' ? 'mage' : 'hybrid'] || 3) : 0,
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

  // ---------- v3.4: cada clase, sus armas ----------
  // Armas de mago (las que tienen "magic"): bastones, varitas, cetros, orbes y tomos.
  // Solo las usan los magos, y les suman poder mágico. Guerreros e híbridos usan las comunes.
  const MAGE_WEAPONS_TXT = 'bastones, varitas, cetros, orbes y tomos';
  function isMageWeapon(w) { return !!(w && w.magic); }
  /** Poder mágico que le suma un arma de mago a los hechizos del mago. */
  // v3.9: algunas armas de mago suman poder extra (la varita rúnica)
  function mageWeaponPower(w) { return isMageWeapon(w) ? 1 + Math.floor((w.tier || 1) / 4) + (w.spellBonus || 0) : 0; }

  /**
   * Cómo le queda un arma a cada clase: { type, atk, dmg, spell, note, blocked }.
   *   guerrero: maestría (+daño, y +precisión con las pesadas) con las armas comunes
   *   híbrido: las comunes, sin ventajas (su magia sale de pegar)
   *   mago: solo las de mago; le suman poder mágico
   */
  function weaponFit(p, weapon) {
    const type = classOf(p);
    const lvl = Math.max(1, (p && p.level) || 1);
    const w = weapon ? weapon.weight || 0 : 0;
    const heavy = w >= 4;
    const magicW = isMageWeapon(weapon);
    const out = { type, atk: 0, dmg: 0, spell: 0, note: '' };
    if (!weapon) return out;
    if (type === 'mage') {
      if (!magicW) { out.blocked = true; out.note = `Los magos solo usan armas de mago (${MAGE_WEAPONS_TXT}).`; return out; }
      out.spell = mageWeaponPower(weapon);
      out.note = `Arma de mago: +${out.spell} de poder mágico a tus hechizos.`;
      return out;
    }
    if (magicW) { out.blocked = true; out.note = 'Es un arma de mago: solo la pueden usar los magos.'; return out; }
    if (type === 'warrior') {
      out.dmg = 1 + Math.floor((lvl - 1) / 4);
      if (heavy) out.atk = 1;
      out.note = `Maestría con armas: +${out.dmg} de daño${out.atk ? ' y +1 de precisión' : ''}.`;
    }
    return out;
  }

  /** ¿Puede usar esta arma? { ok, why } (v3.4: las de mago, solo los magos; los magos, solo esas) */
  function canWield(p, weapon) {
    if (!weapon) return { ok: true, why: '' };
    const mage = classOf(p) === 'mage';
    if (mage && !isMageWeapon(weapon)) return { ok: false, why: `Los magos solo usan armas de mago (${MAGE_WEAPONS_TXT}).` };
    if (!mage && isMageWeapon(weapon)) return { ok: false, why: 'Es un arma de mago: solo la pueden usar los magos.' };
    return { ok: true, why: '' };
  }

  /** v3.4: ¿puede lanzar hechizos ahora? El mago necesita su arma de mago puesta. { ok, why } */
  function canCast(p) {
    if (!p || !p.hasMagic) return { ok: false, why: 'No podés canalizar magia.' };
    if (classOf(p) !== 'mage') return { ok: true, why: '' };
    const w = p.equipment && p.equipment.weapon && A.Data && A.Data.getById ? A.Data.getById('weapons', p.equipment.weapon) : null;
    if (isMageWeapon(w)) return { ok: true, why: '' };
    return { ok: false, why: 'Sin un arma de mago (bastón, varita, cetro, orbe o tomo) no podés lanzar hechizos.' };
  }

  // v3.3: los hechizos de daño tiran el dado como un arma, con esta ayuda
  const SPELL_HIT = 2;

  /** Poder mágico: los magos lo tienen más alto y crece más rápido; su arma de mago suma (v3.4: solo ellos la usan). */
  function spellPowerOf(p, weapon) {
    const type = classOf(p);
    const lvl = Math.max(1, (p && p.level) || 1);
    if (type === 'mage') return Math.floor(lvl / 2) + mageWeaponPower(weapon);
    if (type === 'hybrid') return Math.floor((lvl - 1) / 2);
    return 0;
  }

  /**
   * v2.1: recuperación de maná. Solo los magos recuperan solos:
   *   turn - maná al empezar cada turno tuyo en combate
   *   win  - parte del maná máximo que vuelve al ganar la pelea
   *   step - (v3.3, opcional) cuánto suma cada escalón de nivel (si no, 1)
   * Los híbridos devuelven 0 y 0: pociones o dormir.
   */
  function manaRegenOf(p) {
    if (!p || !p.hasMagic) return { turn: 0, win: 0 };
    const race = A.Data && A.Data.getById ? A.Data.getById('races', p.raceId) : null;
    const type = (race && race.combatType) || 'hybrid';
    const base = (race && race.manaRegen) || (type === 'mage' ? { turn: 1, win: 0.2 } : { turn: 0, win: 0 });
    // v2.2.1: con más nivel vuelve más maná por turno (+1 desde nivel 5, +2 desde nivel 9)
    const every = Balance_TUNE.mageRegenEvery;
    const lvl = Math.min(Math.max(1, p.level || 1), base.upTo || Balance_TUNE.mageRegenUpTo || 99); // v3.12: deja de crecer en el 16 (el infernal, en el 20)
    const extra = every > 0 && (base.turn || 0) > 0 ? Math.floor((lvl - 1) / every) * (base.step || 1) : 0;
    const high = (p.level || 1) >= (Balance_TUNE.mageWinFrom || 99);
    const win = high ? Math.max(Math.min(base.win || 0, 0.1), (base.win || 0) * (Balance_TUNE.mageWinHigh || 1)) : (base.win || 0); // (nunca menos del 10%)
    return { turn: (base.turn || 0) + extra, win };
  }

  /** v3.3: el maná por turno puede tener coma (1,5 = 1 un turno y 2 el siguiente): así se escribe. */
  function regenLabel(n) { return String(Math.round((Number(n) || 0) * 10) / 10).replace('.', ','); }

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
    // v3.9: el vínculo con tu mascota (despierta y comida)
    const bond = A.Tame && A.Tame.ownerBond ? A.Tame.ownerBond(p) : { precision: 0, defense: 0, armor: 0, damage: 0, speed: 0, spell: 0 };
    const weaponPrec = weapon && weapon.precision ? weapon.precision : 0;
    // v3.20: lo que mejoró el herrero (+1 a +5)
    const O = A.Oficios;
    const fg = O ? O.gearBonus(p) : { damage: 0, precision: 0, armor: 0, defense: 0 };
    const ex = fg;
    // v3.20: cuánto sube o baja cada número por algo de afuera (equipo, comida, pociones, mascota, hambre, estados, peso)
    const accN = (k) => acc(k) + (bm[k] || 0) + (bond[k] || 0);
    const mods = {
      precision: (fit.atk || 0) + weaponPrec + accN('precision') + ex.precision - fx.attackPenalty,
      damage: (fit.dmg || 0) + accN('damage') + ex.damage - pen('damage') - (fx.damagePenalty || 0),
      defense: accN('defense') + ex.defense - pen('dodge') - fx.defensePenalty,
      armor: accN('armor') + ex.armor - (fx.armorPenalty || 0),
      speed: accN('speed') - w.penalty - pen('speed'),
      spell: (fit.spell || 0) + (bond.spell || 0),
    };
    return {
      fit,
      mods,
      forge: fg,
      attack: (p.stats.precision || 0) + fit.atk + weaponPrec + acc('precision') + bm.precision - fx.attackPenalty + (A.Passives && A.Passives.precisionBonus ? A.Passives.precisionBonus(p) : 0) + (bond.precision || 0) + ex.precision,
      defense: 8 + (p.stats.dodge || 0) + (armor && armor.dodge ? armor.dodge : 0) + acc('defense') + bm.defense - pen('dodge') - fx.defensePenalty + (bond.defense || 0) + ex.defense,
      // v2.5: el ácido de las criaturas te baja la armadura
      armor: Math.max(0, (p.stats.armor || 0) + (armor ? armor.defense || 0 : 0) + acc('armor') + bm.armor + (A.Passives && A.Passives.armorBonus ? A.Passives.armorBonus(p) : 0) - (fx.armorPenalty || 0) + (bond.armor || 0) + ex.armor),
      // v1.9.2: + Furia del orco (v3.3: con tres cuartos de la vida o menos) · v2.0: + maestría del guerrero · v2.5: - miedo
      damageBonus: (p.stats.damage || 0) - pen('damage') + fit.dmg + acc('damage') + bm.damage + (A.Passives ? A.Passives.damageBonus(p) : 0) - (fx.damagePenalty || 0) + (bond.damage || 0) + ex.damage,
      // El peso solo frena si pasa de 4 (una daga y ropa no pesan nada)
      speed: Math.max(1, (p.stats.speed || 10) - w.penalty + acc('speed') + bm.speed - pen('speed') + (bond.speed || 0)),
      weight: w.total,
      weightPenalty: w.penalty,
      weapon,
      armorItem: armor,
      spellPower: spellPowerOf(p, weapon) + (bond.spell || 0),
      bond,
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
      // v3.22.4: los efectos se acumulan; los de número fijo suben la mitad por cada carga de más
      const k = (base) => stackedFixed(base, ef.stacks);
      if (ef.type === 'cold') { out.defensePenalty += k(2); out.attackPenalty += k(1); }
      if (ef.type === 'blind') out.attackPenalty += k(4);
      // v2.4: Pergamino de maldición: -N a su precisión y a su defensa
      if (ef.type === 'curse') { out.attackPenalty += v; out.defensePenalty += v; }
      if (ef.type === 'prone') out.defensePenalty += k(3);
      if (ef.type === 'fear') { out.attackPenalty += k(2); out.damagePenalty += k(1); }
      if (ef.type === 'grab') out.attackPenalty += k(2);
      if (ef.type === 'corrode') out.armorPenalty += k(2);
      if (ef.type === 'rally') { out.attackPenalty -= v; out.damagePenalty -= v; }
      if (ef.type === 'guard') out.defensePenalty -= v;
      // v3.11: desequilibrado (Embestida, Polvo de hada): -N de precisión hasta su próximo ataque; expuesto: -N de defensa
      if (ef.type === 'stagger') out.attackPenalty += v;
      if (ef.type === 'exposed') out.defensePenalty += v;
    }
    return out;
  }

  // ---------- v3.22.4: efectos que se acumulan ----------
  // Volver a aplicar un efecto le suma una carga (hasta STACK_MAX): el daño por turno,
  // los bonus y las penalizaciones se multiplican por las cargas y los turnos se renuevan.
  // Los que no tienen número (aturdido, silencio, herida maldita) suman un turno por carga.
  const STACK_MAX = 3;
  const STACK_TURNS = { stun: true, silence: true, noheal: true };
  function stackedFixed(base, stacks) {
    const s = Math.max(1, Math.min(STACK_MAX, stacks || 1));
    return base + Math.round(base / 2) * (s - 1);
  }
  /** Pone el efecto o le suma una carga. Devuelve el efecto. */
  function stackEffect(target, type, turns, value, source, extra) {
    target.effects = target.effects || [];
    turns = Math.max(1, turns || 1);
    value = Number(value) || 1;
    const old = target.effects.find((e) => e.type === type);
    if (!old) {
      const ef = Object.assign({ type, turns, value, source: source || 'unknown', stacks: 1, per: value }, extra || {});
      target.effects.push(ef);
      return ef;
    }
    const was = old.stacks || 1;
    const per = Math.max(old.per || Math.round((Number(old.value) || 1) / was), value);
    old.stacks = Math.min(STACK_MAX, was + 1);
    old.per = per;
    if (STACK_TURNS[type]) {
      old.turns = Math.min(Math.max(old.turns, turns) + (old.stacks > was ? 1 : 0), turns + STACK_MAX - 1);
      old.value = Math.max(Number(old.value) || 1, value);
    } else {
      old.turns = Math.max(old.turns, turns);
      old.value = per * old.stacks;
    }
    if (source) old.source = source;
    return old;
  }
  /** Igual para las mejoras (pociones, hechizos, mascotas): los números de la mejora se multiplican. */
  function stackBuff(old, mods, turns) {
    const was = old.stacks || 1;
    const base = old.baseMods || old.mods || {};
    const next = {};
    for (const key of Object.keys(mods || {})) {
      const a = base[key];
      const b = mods[key];
      next[key] = typeof b === 'number' ? Math.max(typeof a === 'number' ? a : 0, b) : b;
    }
    for (const key of Object.keys(base)) if (!(key in next)) next[key] = base[key];
    old.baseMods = next;
    old.stacks = Math.min(STACK_MAX, was + 1);
    const out = {};
    for (const key of Object.keys(next)) {
      const v = next[key];
      // esquivar el próximo golpe y la ventaja no se multiplican; robar vida y espinas suben la mitad
      if (typeof v !== 'number' || key === 'dodgeNext' || key === 'advantage') out[key] = v;
      else if (key === 'lifesteal' || key === 'reflect') out[key] = Math.min(0.9, v * (1 + 0.5 * (old.stacks - 1)));
      else out[key] = v * old.stacks;
    }
    old.mods = out;
    old.turns = Math.max(old.turns || 0, turns || 0);
    old.fresh = true;
    return old;
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
    bossHp: 2.1,     // un jefe (o élite) solo: más vida... (v3.10: 2,3; v3.11: 2,1, porque los jefes ya son más fuertes solos y traen más invocaciones)
    bossDmg: 1.4,    // ...y más daño (v3.10: 1,45)
    share: 0.42,     // parte de la experiencia, las monedas y el botín de la pelea que se lleva cada uno
    // v3.2: la pelea se reparte más (antes 0.6 con dos): cada uno se lleva más o menos
    // 3/4 de lo que ganaría peleando solo (las peleas en grupo son más cortas y seguras).
    shares: { 3: 0.37, 4: 0.3 },
    // v3.2: grupos de hasta 4. Cada héroe de más (después del segundo) suma esto
    // (medido con el simulador: tres o cuatro pierden más o menos la vida que pierde uno solo)
    perHero: { extra: 0.5, maxEnemies: 1, hp: 0.35, dmg: 0.15, bossHp: 1.0, bossDmg: 0.25 },
  };
  // v3.10: los jefes también solos (vida y daño). Medido con tools/jefes.js
  // v3.11: más fuertes (pedido: "dales más dificultad a todos"). Medido con tools/jefes.js:
  // a su mismo nivel se les gana entre 1 y 7 de cada 10 veces según el jefe y la clase; con dos niveles más, casi siempre.
  const BOSS = { hp: 1.3, dmg: 1.12, rage: 1.25 }; // rage: cuánto más pega enfurecido (con la mitad de la vida)
  // v3.14: por cada mascota que pelea contra un jefe, el jefe tiene esto de más (vida y daño)
  const PET_BOSS = { hp: 0.5, dmg: 0.15 };
  // v3.14: lo que se recupera de vida al ganar una pelea (el respiro), solo magos e híbridos
  // v3.15: 15% -> 25% los magos y 30% los híbridos (la prueba "de a dos" los dejaba 23 puntos abajo de los guerreros)
  const WIN_HEAL = { mage: 0.25, hybrid: 0.30 };
  // v3.15: cuánto corta la curación la herida maldita (y la maldición de sangre)
  const NOHEAL_CUT = 0.5;

  /**
   * v3.2: cómo se ponen las criaturas según cuántos héroes pelean juntos.
   * Con 2 queda como antes (PARTY); el 3.º y el 4.º suman PARTY.perHero cada uno.
   * share: la parte de lo que da la pelea para cada uno (PARTY.share / PARTY.shares).
   *
   * partyShare(n): lo que se encuentra (escenas, viaje) se reparte con un premio
   * chico por ir en grupo (2: 60% cada uno · 3: 47% · 4: 40%).
   */
  function partyShare(n) {
    const k = Math.max(0, Math.round(n || 1) - 1);
    if (!k) return 1;
    return Math.min(1, (1 + 0.2 * k) / (k + 1));
  }
  function partyScale(n) {
    const heroes = Math.max(1, Math.min(4, Math.round(n || 1)));
    if (heroes <= 1) return { extra: 0, maxEnemies: 99, hp: 1, dmg: 1, bossHp: 1, bossDmg: 1, share: 1 };
    const more = heroes - 2;
    const ph = PARTY.perHero || {};
    return {
      extra: PARTY.extra + (ph.extra || 0) * more,
      maxEnemies: PARTY.maxEnemies + (ph.maxEnemies || 0) * more,
      hp: PARTY.hp + (ph.hp || 0) * more,
      dmg: PARTY.dmg + (ph.dmg || 0) * more,
      bossHp: PARTY.bossHp + (ph.bossHp || 0) * more,
      bossDmg: PARTY.bossDmg + (ph.bossDmg || 0) * more,
      share: heroes === 2 ? PARTY.share : ((PARTY.shares || {})[heroes] || partyShare(heroes)),
    };
  }

  const ELITE = {
    chanceSolo: 0.05,  // si aparece sola
    chanceGroup: 0.09, // si viene en grupo (una sola del grupo)
    chanceBoss: 0.1,   // v3.12: un jefe sale en su forma suprema (élite) una de cada diez veces
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
  // v3.12 (economía): hasta el nivel 10 todo sube x1,45 por nivel; desde el 11, x1,2. Antes seguía x1,45 y en el
  // 20 una criatura soltaba 40 veces más que en el 10 (las pociones, la comida y los materiales quedaban regalados).
  // Las monedas, el precio del equipo y lo que valen los materiales usan la misma curva: se compra lo mismo con las
  // peleas de siempre, pero sin inflación.
  const PRICE_SLOW_FROM = 10;
  const PRICE_SLOW = 1.2;
  function priceCurve(t) {
    t = clampTier(t);
    return Math.pow(1.45, Math.min(t, PRICE_SLOW_FROM) - 1) * Math.pow(PRICE_SLOW, Math.max(0, t - PRICE_SLOW_FROM));
  }
  const Economy = {
    priceCurve,
    /** v3.13: cuánto multiplica el precio cada rareza (equipo y accesorios). */
    RARITY_PRICE: { common: 1, uncommon: 1.4, rare: 2, epic: 3.2, legendary: 5.5 },
    RARITY_PRICE_OLD: { common: 1, uncommon: 1.3, rare: 1.7, epic: 2.5, legendary: 4 },
    /** Cobre promedio que suelta un enemigo normal de tier t. */
    coinBase(t) { return 2.5 * priceCurve(t); },

    /**
     * v2.0: monedas SEGURAS de un enemigo (siempre suelta algo).
     * Más si es de más tier o si es fuerte/jefe; ±20% de azar.
     */
    coinsFor(enemy, rnd = Math.random) {
      if (!enemy) return 0;
      const avg = Economy.coinBase(enemy.tier) * cat(enemy.category).coin;
      return Math.max(1, Math.round(avg * (0.8 + 0.4 * rnd())));
    },

    /**
     * v3.15: quién carga monedas. Los humanoides, muertos vivientes, demonios, dragones,
     * gigantes, arcanos y espíritus, sí; las bestias, insectos, plantas, elementales,
     * babosas, gólems y bichos del mar, no (lo compensan con materiales que valen más).
     * `coins: true/false` en la criatura manda sobre esto.
     */
    COIN_FAMILIES: ['humanoid', 'demon', 'undead', 'dragon', 'giant', 'arcane', 'spirit'],
    carriesCoins(enemy) {
      if (!enemy) return false;
      if (enemy.coins === true || enemy.coins === false) return enemy.coins;
      return (enemy.family || []).some((f) => Economy.COIN_FAMILIES.includes(f));
    },

    /** Drop de monedas listo para enemy.drops. */
    coinDrop(enemy) {
      const avg = Economy.coinBase(enemy.tier) * cat(enemy.category).coin;
      const fam = enemy.family || [];
      // Bestias e insectos no cargan monedas: casi nunca sueltan, pero dejan materiales
      const carries = Economy.carriesCoins(enemy);
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
      const RAR = Economy.RARITY_PRICE; // v3.13: la rareza vale más (antes 1 · 1,3 · 1,7 · 2,5 · 4)
      const base = 25 * priceCurve(t) * (RAR[rarity] || 1);
      return Math.round(base * (kind === 'armor' ? 1.2 : 1));
    },

    /**
     * v3.14: lo que cobra una tienda sobre el valor de cada cosa. Medido con lo que gana un jugador
     * por nivel (peleas, escenas y misiones): un arma común de tu nivel costaba el 8% de lo que
     * ganás en un nivel; ahora, un tercio. Vender sigue dando la mitad del valor (sin el recargo).
     */
    // v3.15: equipo ×4 -> ×4,5 (con el botín nuevo, desde el nivel 7 se gana entre 20% y 40% más por nivel)
    SHOP_MARKUP: { gear: 4.5, potion: 2, scroll: 2.5, food: 2.5, material: 3, other: 2.5 },
    shopMarkup(item) {
      const M = Economy.SHOP_MARKUP;
      if (!item) return 1;
      if (item.type === 'weapon' || item.type === 'armor' || item.damage != null || item.defense != null || item.subtype === 'accessory' || item.subtype === 'bag' || item.slots != null) return M.gear;
      if (item.subtype === 'potion') return M.potion;
      if (item.subtype === 'scroll' || item.subtype === 'scroll_spell') return M.scroll;
      if (item.subtype === 'food') return M.food;
      if (item.subtype === 'material') return M.material;
      return M.other;
    },

    /** Precio para aprender un hechizo con un NPC (v3.14: los de escuela, con el recargo del equipo). */
    spellPrice(spell) {
      return Math.max(30, Math.round(Economy.gearPrice((spell && spell.tier) || 1) * 1.5 * Economy.SHOP_MARKUP.gear));
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
  // v3.1: viajes más largos (más pasos), con la misma comida y las mismas peleas por viaje
  const Travel = {
    STEPS_MIN: 5,
    STEPS_MAX: 18,
    /** Cada cuántos pasos se consume 1 de comida. */
    STEPS_PER_FOOD: 4,
    /** Probabilidad de encuentro por paso según tipo de destino. */
    CREATURE_CHANCE: { combat: 0.15, safe: 0.03 },
  };

  A.Balance = {
    PARTY,
    BOSS,
    PET_BOSS,
    WIN_HEAL,
    NOHEAL_CUT,
    partyScale,
    partyShare,
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
    canWield,  // v3.3 (v3.4: las de mago, solo los magos)
    canCast,   // v3.4
    isMageWeapon, // v3.4
    mageWeaponPower, // v3.4
    MAGE_WEAPONS_TXT, // v3.4
    SPELL_HIT, // v3.3
    manaRegenOf,
    regenLabel, // v3.3: "1,5"
    hpRegenOf,
    warriorPower,
    manaOnHit,
    TUNE: Balance_TUNE,
    spellPowerOf,
    classOf,
    statusMods,
    STACK_MAX,
    stackEffect,
    stackBuff,
    stackedFixed,
    Pet,
    Economy,
    Travel,
  };
  // Atajo: la progresión se usa mucho
  A.Progression = Progression;
})(window.Aventurs);
