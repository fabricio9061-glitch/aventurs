/* ============================================================
   Aventurs — Encounter system (v1.3.0)
   Genera grupos de enemigos para combate, según config de región.

   Lógica:
     1. Lee region.encounter (default si no existe).
     2. Decide cantidad de enemigos: random(min, max).
     3. Filtra candidatos: enemigos que aparecen en la región y
        coinciden con tier de la región.
     4. Si allowMixed=true: weighted-pick de enemigos individuales
        según category->spawnWeights y luego dentro de la categoría
        según enemy.spawn.weight. Pueden ser distintos.
     5. Si allowMixed=false: elige UN tipo de enemigo y arma un grupo
        respetando enemy.spawn.min y enemy.spawn.max.
     6. Respeta spawn.groupable: enemigos no agrupables solo aparecen
        de a uno (max=1 efectivo).

   Output: array de "instancias" listas para combate:
     [ { id, instanceId, name, icon, hp, maxHp, damage, armor, speed,
         difficulty, category, tier, family[], tags[] }, ... ]
   ============================================================ */

(function (A) {
  'use strict';

  // Default si la región no declara encounter
  const DEFAULT_ENCOUNTER = {
    minEnemies: 1,
    maxEnemies: 2,
    allowMixed: true,
    spawnWeights: { weak: 40, normal: 40, strong: 15, boss: 5 },
  };

  /**
   * Devuelve la config de encounter para una región (o default).
   */
  function configFor(regionId) {
    const region = A.Data.getById('regions', regionId);
    if (!region) return null;
    if (!region.encounter) return { region, cfg: { ...DEFAULT_ENCOUNTER } };
    return { region, cfg: { ...DEFAULT_ENCOUNTER, ...region.encounter } };
  }

  // ---------- v2.1: el peligro se adapta a tu nivel ----------
  // Las criaturas de más nivel que vos aparecen menos y siempre solas;
  // los jefes van solos y en un grupo hay como mucho una "fuerte".
  function playerLevel() {
    const p = A.State && A.State.player;
    return p ? (p.level || 1) : 99;
  }
  function levelFactor(e, lvl) {
    // una "fuerte" cuenta como un nivel más; un jefe, dos; una "débil", uno menos
    const extra = ({ weak: -1, strong: 1, boss: 2 })[e.category] || 0;
    const d = (e.tier || 1) + extra - lvl;
    if (d <= 0) return 1;
    if (d === 1) return 0.55;
    if (d === 2) return 0.25;
    return 0.1;
  }
  // Si una misión te pide derrotar a alguien de esta zona, aparece mucho más seguido
  let targetsCache = null;
  function questTargets() {
    const set = new Set();
    if (!A.Quests || !A.Quests.activeList) return set;
    for (const q of A.Quests.activeList()) {
      q.objectives.forEach((o, i) => {
        if (o.type !== 'kill' || A.Quests.objectiveProgress(q, i).done) return;
        for (const id of (Array.isArray(o.enemy) ? o.enemy : [o.enemy])) set.add(id);
      });
    }
    return set;
  }
  function spawnFactor(e, lvl) {
    return levelFactor(e, lvl) * (targetsCache && targetsCache.has(e.id) ? 8 : 1);
  }

  // ---------- v3.1: criaturas de día y de noche ----------
  const UNDERGROUND = ['cave', 'crypt', 'hell', 'abyss'];
  function isUnderground(region) {
    const b = region && region.biome;
    return (Array.isArray(b) ? b : [b]).some((x) => UNDERGROUND.includes(x));
  }
  /** ¿Sale ahora? (las de noche, de noche o de madrugada; las de día, de mañana o de tarde) */
  function activeNow(e, region, at) {
    if (!e || !e.time || e.time === 'any') return true;
    if (region && isUnderground(region)) return true;
    const night = at ? at === 'night' : (A.Time && A.Time.isNight ? A.Time.isNight() : false);
    return e.time === 'night' ? night : !night;
  }
  /** Texto corto para mostrar cuándo sale: "De noche", "De día" o "". */
  function timeLabel(e) {
    if (!e || !e.time || e.time === 'any') return '';
    return e.time === 'night' ? 'Sale de noche' : 'Sale de día';
  }

  function mustGoAlone(e, lvl) {
    return (e.tier || 1) > lvl || e.category === 'boss';
  }

  /**
   * Genera un grupo de enemigos para la región dada.
   * Devuelve array de instancias (puede estar vacío si no hay candidatos).
   */
  /** opts.level: nivel a usar en vez del tuyo (lo usa el editor para probar zonas). */
  /**
   * Arma el grupo de criaturas de un encuentro en la región.
   * v2.5: a veces una sale de élite (alfa, campeón o mayor). opts.noElite la evita.
   */
  function generate(regionId, opts = {}) {
    const group = buildGroup(regionId, opts);
    return opts.noElite ? group : maybeElite(group);
  }

  // ============================================================
  // v2.5: Élite
  // ============================================================

  /** "alfa" para bestias, "campeón/campeona" para gente y no muertos, "mayor" para lo demás. */
  function eliteTitle(inst) {
    const fam = inst.family || [];
    const fem = A.Narrator && A.Narrator.isFem ? A.Narrator.isFem(inst.id) : false;
    if (fam.includes('spirit')) return 'mayor';
    if (fam.includes('humanoid') || fam.includes('fey') || fam.includes('giant') || fam.includes('undead')) return fem ? 'campeona' : 'campeón';
    if (fam.includes('beast') || fam.includes('insect') || fam.includes('marine') || fam.includes('dragon')) return 'alfa';
    return 'mayor';
  }

  /** "2d4+1" con 25% más de daño promedio -> "2d4+3". Si no se puede, null. */
  function boostDice(expr, mult) {
    const m = /^\s*(\d+)d(\d+)\s*([+-]\s*\d+)?\s*$/.exec(String(expr || ''));
    if (!m) return null;
    const n = +m[1];
    const f = +m[2];
    const flat = m[3] ? +m[3].replace(/\s/g, '') : 0;
    const avg = (n * (f + 1)) / 2 + flat;
    const total = flat + Math.max(1, Math.round(avg * (mult - 1)));
    return `${n}d${f}${total >= 0 ? '+' : ''}${total}`;
  }

  /** Convierte una instancia en élite: más vida, más daño, +1 a todo y la pasiva Líder. */
  function makeElite(inst) {
    const EL = (A.Balance && A.Balance.ELITE) || null;
    if (!inst || !EL || inst.elite) return inst;
    inst.elite = true;
    inst.eliteTitle = eliteTitle(inst);
    inst.baseName = inst.name;
    inst.name = `${inst.name} ${inst.eliteTitle}`;
    inst.displayName = inst.name;
    inst.maxHp = Math.round((inst.maxHp || 1) * EL.hp);
    inst.hp = inst.maxHp;
    const dice = boostDice(inst.damage, EL.dmg);
    if (dice) inst.damage = dice; else inst.dmgMult = EL.dmg;
    inst.attack = (inst.attack || 0) + EL.atk;
    inst.difficulty = (inst.difficulty || 10) + EL.def;
    if ((inst.tier || 1) >= EL.armorFromTier) inst.armor = (inst.armor || 0) + 1;
    inst.speed = (inst.speed || 10) + EL.speed;
    inst.skills = (inst.skills || []).filter((s) => s !== 'lider').concat('lider');
    return inst;
  }

  /** Tira la chance de élite para un grupo (una sola por grupo, nunca un jefe). */
  function maybeElite(group) {
    const EL = A.Balance && A.Balance.ELITE;
    if (!EL || !Array.isArray(group) || !group.length) return group;
    const pool = group.filter((e) => e.category !== 'boss');
    if (!pool.length) return group;
    const chance = group.length > 1 ? EL.chanceGroup : EL.chanceSolo;
    if (Math.random() >= chance) return group;
    // la especie con más miembros pone al jefe de la manada
    const count = {};
    for (const e of pool) count[e.id] = (count[e.id] || 0) + 1;
    const top = Math.max(...Object.values(count));
    const ids = Object.keys(count).filter((id) => count[id] === top);
    const id = ids[Math.floor(Math.random() * ids.length)];
    const list = pool.filter((e) => e.id === id);
    makeElite(list[Math.floor(Math.random() * list.length)]);
    return group;
  }

  function buildGroup(regionId, opts = {}) {
    const conf = configFor(regionId);
    if (!conf) return [];
    const { region, cfg } = conf;

    let candidates = A.Data.enemiesInRegion(regionId);
    if (candidates.length === 0) return [];
    // v3.1: solo las que salen a esta hora (si no queda ninguna, cualquiera)
    if (!opts.anyTime) {
      const now = candidates.filter((e) => activeNow(e, region, opts.at));
      if (now.length) candidates = now;
    }

    // Cantidad de enemigos
    // v2.1: mientras no llegues al tier más alto de la zona, los grupos son de uno menos
    const topTier = (region.tier && region.tier[1]) || 1;
    const lvlNow = opts.level != null ? opts.level : playerLevel();
    const maxE = Math.max(cfg.minEnemies || 1, (cfg.maxEnemies || 1) - (lvlNow < topTier && (cfg.maxEnemies || 1) > 2 ? 1 : 0));
    const count = randInt(cfg.minEnemies || 1, maxE);
    if (count <= 0) return [];

    // Agrupar por categoría
    const byCat = { weak: [], normal: [], strong: [], boss: [] };
    for (const e of candidates) {
      const c = e.category || 'normal';
      if (byCat[c]) byCat[c].push(e);
    }

    // Pesos por categoría desde la región (filtrar sólo categorías con candidatos)
    // v2.1: cada categoría pesa según qué tan accesibles son sus criaturas para tu nivel
    const lvl = opts.level != null ? opts.level : playerLevel();
    targetsCache = opts.level != null ? new Set() : questTargets();
    const sw = cfg.spawnWeights || {};
    const catWeights = {};
    for (const cat of ['weak', 'normal', 'strong', 'boss']) {
      if (byCat[cat].length > 0 && (sw[cat] || 0) > 0) {
        const fit = byCat[cat].reduce((s, e) => s + spawnFactor(e, lvl), 0) / byCat[cat].length;
        catWeights[cat] = sw[cat] * fit;
      }
    }
    if (Object.keys(catWeights).length === 0) return [];

    // ---- Modo mixto ----
    if (cfg.allowMixed) {
      const result = [];
      const counts = {}; // { enemyId: cuántos hay }
      let attempts = 0;
      const maxAttempts = count * 5;

      // v1.5.9: Si en algún punto entra un enemigo solitario (groupable: false),
      // ese encuentro queda con SOLO ese enemigo, sin nadie más.
      let lockedSolo = false;

      while (result.length < count && attempts < maxAttempts) {
        attempts++;
        if (lockedSolo) break; // ya hay un solitario, no agregar más

        const cat = A.Utils.weightedPick(catWeights);
        const enemy = pickFromCategory(byCat[cat], lvl);
        if (!enemy) continue;
        // v2.1: los de más nivel que vos y los jefes van solos; una sola "fuerte" por grupo
        if (mustGoAlone(enemy, lvl)) {
          if (result.length > 0) continue;
          result.push(spawnInstance(enemy));
          break;
        }
        if (enemy.category === 'strong' && result.some((r) => r.category === 'strong')) continue;
        const groupable = enemy.spawn && enemy.spawn.groupable !== false;
        const enemyMax = (enemy.spawn && enemy.spawn.max) || 1;
        const here = counts[enemy.id] || 0;

        // Si llegó al max permitido del enemigo, descartar
        if (here >= enemyMax) continue;

        // v1.5.9: Si NO es agrupable y ya hay alguien en result, descartar.
        // (no lo dejamos entrar a un grupo existente)
        if (!groupable && result.length > 0) continue;

        // v1.5.9: Si NO es agrupable y va a entrar primero, después no puede haber nadie más
        if (!groupable) {
          lockedSolo = true;
        }

        // v1.5.9: Si ya hay enemigos en result y este enemy tiene allowedGroupWith,
        // verificar compatibilidad. Si no se permite, descartar.
        if (result.length > 0 && !canGroupWith(enemy, result)) continue;

        result.push(spawnInstance(enemy));
        counts[enemy.id] = here + 1;
      }
      return result;
    }

    // ---- Modo NO mixto: un solo tipo, grupo respetando spawn.min/max ----
    const cat = A.Utils.weightedPick(catWeights);
    const baseEnemy = pickFromCategory(byCat[cat], lvl);
    if (!baseEnemy) return [];

    const groupable = baseEnemy.spawn && baseEnemy.spawn.groupable !== false;
    if (!groupable || mustGoAlone(baseEnemy, lvl) || baseEnemy.category === 'strong') return [spawnInstance(baseEnemy)];

    const min = (baseEnemy.spawn && baseEnemy.spawn.min) || 1;
    const max = Math.min(count, (baseEnemy.spawn && baseEnemy.spawn.max) || 1);
    const groupSize = clamp(count, min, max);
    const result = [];
    for (let i = 0; i < groupSize; i++) result.push(spawnInstance(baseEnemy));
    return result;
  }

  /**
   * v1.5.9: Verifica si un enemigo puede agruparse con un conjunto existente.
   * Reglas (en orden):
   * 1. Si enemy.allowedGroupWith existe (array de ids o tags), solo permite si todos
   *    los del grupo matchean por id o por tag.
   * 2. Si enemy.groupTags existe, todos los del grupo deben compartir al menos
   *    un tag con enemy.groupTags.
   * 3. Si nada de lo anterior, permite (por defecto sí se puede).
   *
   * Esto es para casos como: "el lobo puede agruparse con jabalíes pero no con orcos".
   */
  function canGroupWith(enemy, existingGroup) {
    if (!existingGroup || existingGroup.length === 0) return true;
    if (enemy.allowedGroupWith && Array.isArray(enemy.allowedGroupWith) && enemy.allowedGroupWith.length > 0) {
      const allowed = new Set(enemy.allowedGroupWith);
      // Si el ID del enemigo está siempre permitido (mismo tipo)
      allowed.add(enemy.id);
      for (const g of existingGroup) {
        const matchById = allowed.has(g.id);
        const matchByTag = (g.family || []).some((f) => allowed.has(f)) ||
                            (g.tags || []).some((t) => allowed.has(t));
        if (!matchById && !matchByTag) return false;
      }
    }
    if (enemy.groupTags && Array.isArray(enemy.groupTags) && enemy.groupTags.length > 0) {
      const myTags = new Set(enemy.groupTags);
      for (const g of existingGroup) {
        const otherTags = new Set(g.groupTags || []);
        const intersect = [...myTags].some((t) => otherTags.has(t));
        if (!intersect) return false;
      }
    }
    return true;
  }

  /**
   * Picks an enemy from a category list, weighted by enemy.spawn.weight.
   */
  function pickFromCategory(list, lvl) {
    if (!list || list.length === 0) return null;
    const w = {};
    list.forEach((e, i) => {
      w[i] = ((e.spawn && e.spawn.weight) || 1) * (lvl ? spawnFactor(e, lvl) : 1);
    });
    const idx = parseInt(A.Utils.weightedPick(w), 10);
    return list[idx] || list[0];
  }

  /**
   * Si el enemigo elegido no es agrupable y ya está en el grupo,
   * busca otra opción aleatoria de cualquier categoría disponible.
   */
  function pickAnyOther(byCat, catWeights, currentGroup) {
    const flat = [];
    for (const cat of Object.keys(catWeights)) {
      for (const e of byCat[cat]) {
        const groupable = e.spawn && e.spawn.groupable !== false;
        if (!groupable && currentGroup.some((g) => g.id === e.id)) continue;
        flat.push(e);
      }
    }
    if (flat.length === 0) return null;
    return flat[Math.floor(Math.random() * flat.length)];
  }

  /**
   * Crea una instancia de combate para un enemigo dado.
   */
  function spawnInstance(enemyData) {
    const instanceId = 'e_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 10000);
    const inst = {
      instanceId,
      id: enemyData.id,
      name: enemyData.name,
      icon: enemyData.icon,
      hp: enemyData.health,
      maxHp: enemyData.health,
      damage: enemyData.damage, // v1.6.7: enemigos tienen un único campo damage final
      armor: enemyData.armor || 0,
      speed: enemyData.speed || 10,
      // v1.8.0: attack = bonus al D20 cuando ataca; difficulty = su defensa.
      // Si el enemigo viene de una versión vieja del editor sin estos campos, se calculan.
      attack: enemyData.attack != null ? enemyData.attack : defaultAttack(enemyData),
      difficulty: enemyData.difficulty != null ? enemyData.difficulty : defaultDefense(enemyData),
      category: enemyData.category,
      tier: enemyData.tier,
      family: (enemyData.family || []).slice(),
      tags: (enemyData.tags || []).slice(),
      skills: (enemyData.skills || []).slice(), // v2.5: pasivas y activas de la especie
      effects: [],
      equippedWeapon: null,
      equippedArmor: null,
    };

    // v1.5.9 / v1.6.7: Auto-equipar humanoides solo si tienen flag equipmentEnabled o
    // no tienen damage definido. El daño compuesto NO aplica a enemigos: si se equipa,
    // el arma reemplaza el damage (no suma como en el jugador).
    const shouldAutoEquip = inst.family.includes('humanoid') &&
      (enemyData.equipmentEnabled === true || !inst.damage);

    if (shouldAutoEquip) {
      const equipped = pickHumanoidEquipment(inst);
      if (equipped.weapon) {
        inst.equippedWeapon = equipped.weapon.id;
        inst.damage = equipped.weapon.damage;
      } else {
        // Sin arma: usa '1d3' (puños base)
        inst.damage = inst.damage || '1d3';
      }
      if (equipped.armor) {
        inst.equippedArmor = equipped.armor.id;
        inst.armor = (inst.armor || 0) + equipped.armor.defense;
        // Armaduras pesadas reducen velocidad
        inst.speed = Math.max(1, inst.speed - (equipped.armor.weight || 0));
      }
    }
    // Si NO se autoequipa, inst.damage queda con el valor del seed (definido por el editor).
    // Eso es coherente: el daño "1d6" del seed manda, no se sustituye por una espada random.

    return inst;
  }

  /**
   * Para enemigos humanoides, decide qué arma/armadura llevan según su tier.
   * Devuelve { weapon: WeaponData|null, armor: ArmorData|null }
   */
  function pickHumanoidEquipment(enemy) {
    const tier = enemy.tier || 1;
    const weapons = (window.Aventurs.Data.weapons || []).filter((w) => !w.magic);
    const armors = (window.Aventurs.Data.armors || []);
    if (weapons.length === 0) return { weapon: null, armor: null };
    // Filtrar por tier acorde
    const eligibleWeapons = weapons.filter((w) => Math.abs((w.tier || 1) - tier) <= 1);
    const eligibleArmors = armors.filter((a) => Math.abs((a.tier || 1) - tier) <= 1);

    let weapon = null;
    let armor = null;

    // Probabilidad de tener arma según tier
    // tier 1-2: 60%, tier 3-4: 80%, tier 5+: 95%
    const weaponChance = tier <= 2 ? 0.6 : tier <= 4 ? 0.8 : 0.95;
    if (Math.random() < weaponChance && eligibleWeapons.length > 0) {
      weapon = eligibleWeapons[Math.floor(Math.random() * eligibleWeapons.length)];
    }
    // Probabilidad de tener armadura
    // tier 1-2: 25%, tier 3-4: 50%, tier 5+: 75%
    const armorChance = tier <= 2 ? 0.25 : tier <= 4 ? 0.5 : 0.75;
    if (Math.random() < armorChance && eligibleArmors.length > 0) {
      armor = eligibleArmors[Math.floor(Math.random() * eligibleArmors.length)];
    }
    return { weapon, armor };
  }

  // ---- Helpers ----

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  /**
   * Helper de UI: agrupa instancias por id y devuelve "Lobo A, Lobo B" o "Lobo".
   * Útil para textos del log y narrativa.
   */
  function describeGroup(instances) {
    const counts = new Map();
    const names = new Map();
    for (const i of instances) {
      // v2.5: la élite va aparte ("2× Lobo, Lobo alfa")
      const key = i.elite ? `${i.id}#elite` : i.id;
      counts.set(key, (counts.get(key) || 0) + 1);
      if (!names.has(key)) {
        const e = A.Data.getById('enemies', i.id);
        names.set(key, i.elite ? i.name : (e ? e.name : i.id));
      }
    }
    const parts = [];
    for (const [key, n] of counts) {
      const name = names.get(key);
      parts.push(n > 1 ? `${n}× ${name}` : name);
    }
    return parts.join(', ');
  }

  function defaultAttack(e) {
    const B = A.Balance;
    if (!B) return 1;
    const cat = B.CATEGORY[e.category] || B.CATEGORY.normal;
    return Math.max(0, B.Enemy.attack(e.tier) + cat.atk);
  }

  function defaultDefense(e) {
    const B = A.Balance;
    if (!B) return 10;
    const cat = B.CATEGORY[e.category] || B.CATEGORY.normal;
    return B.Enemy.defense(e.tier) + cat.def;
  }

  A.Encounter = {
    generate,
    configFor,
    describeGroup,
    makeElite,
    eliteTitle,
    spawnInstance,
    DEFAULT_ENCOUNTER,
    // v3.1
    activeNow,
    timeLabel,
    isUnderground,
  };
})(window.Aventurs);
