/* ============================================================
   Aventurs — LootIntelligence (AutoLoot)
   Modelo B: sugiere drops, el admin acepta o rechaza en editor.
   NUNCA agrega drops automáticamente en runtime.

   Reglas de detección:
     1. Por family: cada family tiene un set de items asociados
     2. Por tags: tags como 'fire', 'poison', etc. agregan items específicos
     3. Por coincidencia de nombre: si el nombre del enemigo contiene una
        palabra clave (lobo, dragón, oso, etc.), agrega el material asociado

   Devuelve array de { itemId, chance, reason }.
   El editor muestra estas sugerencias y vos las aceptás (las promueve a
   enemy.drops con source:'auto') o las rechazás (las esconde).
   ============================================================ */

(function (A) {
  'use strict';

  // Tabla de drops por familia
  const FAMILY_DROPS = {
    beast:    [{ itemId: 'mat_piel_lobo', chance: 0.3 }, { itemId: 'mat_colmillo', chance: 0.2 }, { itemId: 'carne_seca', chance: 0.25 }],
    insect:   [{ itemId: 'mat_veneno', chance: 0.15 }],
    undead:   [{ itemId: 'mat_hueso', chance: 0.4 }, { itemId: 'mat_esencia', chance: 0.1 }],
    spirit:   [{ itemId: 'mat_esencia', chance: 0.35 }],
    demon:    [{ itemId: 'mat_esencia', chance: 0.2 }, { itemId: 'mat_gema_arcana', chance: 0.1 }],
    dragon:   [{ itemId: 'mat_escama_dragon', chance: 0.5 }, { itemId: 'mat_sangre_dragon', chance: 0.25 }, { itemId: 'mat_colmillo', chance: 0.4 }],
    humanoid: [{ itemId: 'coin_copper', chance: 0.5 }, { itemId: 'mat_cuero', chance: 0.2 }],
    construct:[{ itemId: 'mat_hierro', chance: 0.3 }, { itemId: 'mat_gema_arcana', chance: 0.15 }],
    elemental:[{ itemId: 'mat_gema_arcana', chance: 0.2 }],
    plant:    [{ itemId: 'mat_madera', chance: 0.4 }],
    marine:   [{ itemId: 'mat_colmillo', chance: 0.15 }],
    aquatic:  [{ itemId: 'mat_colmillo', chance: 0.1 }],
    arcane:   [{ itemId: 'mat_gema_arcana', chance: 0.3 }],
    flying:   [],
    giant:    [],
    legendary:[],
  };

  // Drops por tag
  const TAG_DROPS = {
    poison:    [{ itemId: 'mat_veneno', chance: 0.35 }],
    fire:      [{ itemId: 'mat_gema_arcana', chance: 0.1 }],
    arcane:    [{ itemId: 'mat_gema_arcana', chance: 0.25 }],
    magic:     [{ itemId: 'mat_gema_arcana', chance: 0.15 }],
  };

  // Detección por palabras en el nombre (fallback)
  const NAME_HINTS = [
    { words: ['lobo'], drops: [{ itemId: 'mat_piel_lobo', chance: 0.5 }, { itemId: 'mat_colmillo', chance: 0.3 }] },
    { words: ['oso'], drops: [{ itemId: 'mat_piel_lobo', chance: 0.3 }, { itemId: 'mat_colmillo', chance: 0.4 }] },
    { words: ['dragon', 'dragón'], drops: [{ itemId: 'mat_escama_dragon', chance: 0.6 }, { itemId: 'mat_sangre_dragon', chance: 0.3 }] },
    { words: ['esqueleto', 'zombi', 'lich', 'cadaver'], drops: [{ itemId: 'mat_hueso', chance: 0.6 }] },
    { words: ['arana', 'araña', 'escorpion', 'escorpión'], drops: [{ itemId: 'mat_veneno', chance: 0.4 }] },
  ];

  function normalize(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Devuelve drops sugeridos para un enemigo dado.
   * Combina las 3 fuentes y de-duplica por itemId (el chance más alto gana).
   */
  function suggestDrops(enemy) {
    if (!enemy) return [];
    const suggestions = new Map(); // itemId -> { chance, reason }

    const add = (itemId, chance, reason) => {
      if (!itemId) return;
      // Si ya existe en drops manuales del enemigo, no sugerir
      const manual = (enemy.drops || []).some((d) => d.itemId === itemId);
      if (manual) return;
      const prev = suggestions.get(itemId);
      if (!prev || prev.chance < chance) {
        suggestions.set(itemId, { itemId, chance, reason });
      }
    };

    // 1. Por familia
    for (const f of enemy.family || []) {
      const drops = FAMILY_DROPS[f] || [];
      for (const d of drops) add(d.itemId, d.chance, `family:${f}`);
    }

    // 2. Por tags
    for (const t of enemy.tags || []) {
      const drops = TAG_DROPS[t] || [];
      for (const d of drops) add(d.itemId, d.chance, `tag:${t}`);
    }

    // 3. Por nombre
    const nameNorm = normalize(enemy.name);
    for (const hint of NAME_HINTS) {
      if (hint.words.some((w) => nameNorm.includes(normalize(w)))) {
        for (const d of hint.drops) add(d.itemId, d.chance, `name`);
      }
    }

    // Filtra items que no existen en Data
    const result = [];
    for (const sug of suggestions.values()) {
      const item = A.Data ? A.Data.getById('items', sug.itemId) : null;
      if (item) result.push(sug);
    }
    return result;
  }

  /**
   * Resuelve drops finales en runtime: combina los manuales + los auto aceptados.
   * Los auto aceptados son los que el admin promovió desde el editor (y quedan
   * guardados en enemy.drops con source:'auto').
   * Como NUNCA hay drops auto en runtime sin que pasen por el editor primero,
   * acá simplemente devolvemos enemy.drops tal cual.
   */
  function resolveDrops(enemy) {
    return (enemy && enemy.drops) || [];
  }

  A.LootIntelligence = {
    suggestDrops,
    resolveDrops,
    FAMILY_DROPS,
    TAG_DROPS,
  };
})(window.Aventurs);
