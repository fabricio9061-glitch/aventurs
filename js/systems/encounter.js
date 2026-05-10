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

  /**
   * Genera un grupo de enemigos para la región dada.
   * Devuelve array de instancias (puede estar vacío si no hay candidatos).
   */
  function generate(regionId) {
    const conf = configFor(regionId);
    if (!conf) return [];
    const { region, cfg } = conf;

    const candidates = A.Data.enemiesInRegion(regionId);
    if (candidates.length === 0) return [];

    // Cantidad de enemigos
    const count = randInt(cfg.minEnemies || 1, cfg.maxEnemies || 1);
    if (count <= 0) return [];

    // Agrupar por categoría
    const byCat = { weak: [], normal: [], strong: [], boss: [] };
    for (const e of candidates) {
      const c = e.category || 'normal';
      if (byCat[c]) byCat[c].push(e);
    }

    // Pesos por categoría desde la región (filtrar sólo categorías con candidatos)
    const sw = cfg.spawnWeights || {};
    const catWeights = {};
    for (const cat of ['weak', 'normal', 'strong', 'boss']) {
      if (byCat[cat].length > 0 && (sw[cat] || 0) > 0) {
        catWeights[cat] = sw[cat];
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
        const enemy = pickFromCategory(byCat[cat]);
        if (!enemy) continue;
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
    const baseEnemy = pickFromCategory(byCat[cat]);
    if (!baseEnemy) return [];

    const groupable = baseEnemy.spawn && baseEnemy.spawn.groupable !== false;
    if (!groupable) return [spawnInstance(baseEnemy)];

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
  function pickFromCategory(list) {
    if (!list || list.length === 0) return null;
    const w = {};
    list.forEach((e, i) => {
      w[i] = (e.spawn && e.spawn.weight) || 1;
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
      dodge: enemyData.dodge || Math.max(0, Math.floor((enemyData.speed || 10) / 4)),
      difficulty: enemyData.difficulty,
      category: enemyData.category,
      tier: enemyData.tier,
      family: (enemyData.family || []).slice(),
      tags: (enemyData.tags || []).slice(),
      effects: [],
      equippedWeapon: null,
      equippedArmor: null,
    };

    // v1.5.9 / v1.6.7: Auto-equipar humanoides solo si tienen flag equipmentEnabled o
    // no tienen damage definido. El daño compuesto NO aplica a enemigos: si se equipa,
    // el arma reemplaza el damage (no suma como en el jugador).
    const shouldAutoEquip = inst.family.includes('humanoid') &&
      (inst.equipmentEnabled === true || !inst.damage);

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
    for (const i of instances) counts.set(i.id, (counts.get(i.id) || 0) + 1);
    const parts = [];
    for (const [id, n] of counts) {
      const e = A.Data.getById('enemies', id);
      const name = e ? e.name : id;
      parts.push(n > 1 ? `${n}× ${name}` : name);
    }
    return parts.join(', ');
  }

  A.Encounter = {
    generate,
    configFor,
    describeGroup,
    DEFAULT_ENCOUNTER,
  };
})(window.Aventurs);
