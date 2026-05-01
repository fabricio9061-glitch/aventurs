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
      while (result.length < count && attempts < maxAttempts) {
        attempts++;
        const cat = A.Utils.weightedPick(catWeights);
        const enemy = pickFromCategory(byCat[cat]);
        if (!enemy) continue;
        const groupable = enemy.spawn && enemy.spawn.groupable !== false;
        const enemyMax = (enemy.spawn && enemy.spawn.max) || 1;
        const here = counts[enemy.id] || 0;
        // Si no es agrupable y ya hay uno, descartar
        if (!groupable && here > 0) continue;
        // Si llegó al max permitido del enemigo, descartar
        if (here >= enemyMax) continue;

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
    return {
      instanceId,
      id: enemyData.id,
      name: enemyData.name,
      icon: enemyData.icon,
      hp: enemyData.health,
      maxHp: enemyData.health,
      damage: enemyData.damage,
      armor: enemyData.armor,
      speed: enemyData.speed,
      difficulty: enemyData.difficulty,
      category: enemyData.category,
      tier: enemyData.tier,
      family: (enemyData.family || []).slice(),
      tags: (enemyData.tags || []).slice(),
    };
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
