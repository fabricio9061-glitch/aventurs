/* ============================================================
   Aventurs — LootIntelligence (AutoLoot) v2 — v1.5.7i
   Modelo B: sugiere drops, el admin acepta o rechaza en editor.
   NUNCA agrega drops automáticamente en runtime.

   Estrategia v2:
     - Reglas por NOMBRE específico (lobo, oso, perro, gato, águila…)
       son la fuente principal. Asignan los drops correctos para cada
       criatura concreta.
     - Las reglas por FAMILY son ahora muy genéricas — solo materiales
       universales (huesos para undead, esencia para spirits…). Ya no
       sugieren cosas como "piel de lobo" a todas las beasts.
     - Las reglas por TAG complementan (poison → veneno, fire → brasa).
     - Una blacklist por family rechaza drops imposibles (un ave nunca
       dropea piel de lobo aunque alguna regla lo sugiera).

   Devuelve array de { itemId, chance, reason }.
   ============================================================ */

(function (A) {
  'use strict';

  function normalize(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Drops por familia — SOLO materiales genéricos universales de esa familia.
   */
  const FAMILY_DROPS = {
    beast:    [], // VACÍO: cada bestia tiene su drop específico por nombre
    insect:   [{ itemId: 'mat_pata_arana', chance: 0.10 }],
    undead:   [{ itemId: 'mat_hueso', chance: 0.45 }, { itemId: 'mat_craneo', chance: 0.10 }],
    spirit:   [{ itemId: 'mat_ectoplasma', chance: 0.40 }, { itemId: 'mat_esencia', chance: 0.20 }],
    demon:    [{ itemId: 'mat_esencia_sombra', chance: 0.20 }, { itemId: 'mat_cuerno_demonio', chance: 0.10 }],
    dragon:   [{ itemId: 'mat_escama_dragon', chance: 0.50 }, { itemId: 'mat_sangre_dragon', chance: 0.25 }, { itemId: 'mat_garra', chance: 0.30 }],
    humanoid: [{ itemId: 'coin_copper', chance: 0.50 }, { itemId: 'mat_cuero', chance: 0.20 }],
    construct:[{ itemId: 'mat_hierro', chance: 0.30 }, { itemId: 'mat_nucleo_golem', chance: 0.05 }],
    elemental:[{ itemId: 'mat_gema_arcana', chance: 0.20 }],
    plant:    [{ itemId: 'mat_madera', chance: 0.40 }, { itemId: 'mat_hierba_curativa', chance: 0.20 }],
    marine:   [{ itemId: 'mat_escama', chance: 0.25 }, { itemId: 'mat_caparazon', chance: 0.10 }],
    aquatic:  [{ itemId: 'mat_escama', chance: 0.20 }],
    arcane:   [{ itemId: 'mat_gema_arcana', chance: 0.30 }, { itemId: 'mat_esencia', chance: 0.15 }],
    flying:   [{ itemId: 'mat_pluma', chance: 0.35 }],
    giant:    [{ itemId: 'mat_piel', chance: 0.25 }, { itemId: 'mat_hueso', chance: 0.20 }],
    legendary:[],
  };

  /**
   * Drops por TAG — refuerzan o agregan según habilidades especiales.
   */
  const TAG_DROPS = {
    poison:    [{ itemId: 'mat_veneno', chance: 0.40 }],
    fire:      [{ itemId: 'mat_brasa_elemental', chance: 0.30 }],
    cold:      [{ itemId: 'mat_esencia_hielo', chance: 0.30 }],
    shock:     [{ itemId: 'mat_chispa_tormenta', chance: 0.30 }],
    arcane:    [{ itemId: 'mat_gema_arcana', chance: 0.25 }],
    magic:     [{ itemId: 'mat_gema_arcana', chance: 0.15 }],
    bleed:     [{ itemId: 'mat_garra', chance: 0.25 }],
    flying:    [{ itemId: 'mat_pluma', chance: 0.30 }],
    nocturnal: [{ itemId: 'mat_ala_murcielago', chance: 0.15 }],
    aquatic:   [{ itemId: 'mat_escama', chance: 0.15 }],
  };

  /**
   * NAME_RULES — cada criatura específica con sus drops correctos.
   */
  const NAME_RULES = [
    // ===== Mamíferos terrestres =====
    { words: ['lobo'],          notWords: ['licantropo', 'lobizon'],
      drops: [{ itemId: 'mat_piel_lobo', chance: 0.45 }, { itemId: 'mat_diente_lobo', chance: 0.50 }, { itemId: 'mat_colmillo', chance: 0.20 }] },
    { words: ['oso'],           notWords: [],
      drops: [{ itemId: 'mat_piel_oso', chance: 0.55 }, { itemId: 'mat_garra', chance: 0.40 }, { itemId: 'mat_colmillo', chance: 0.25 }] },
    { words: ['perro', 'sabueso', 'mastin', 'mastín'], notWords: [],
      drops: [{ itemId: 'mat_piel', chance: 0.35 }, { itemId: 'mat_diente_lobo', chance: 0.20 }] },
    { words: ['gato', 'felino', 'pantera', 'leopardo', 'jaguar', 'tigre', 'leon', 'león'], notWords: ['licantropo'],
      drops: [{ itemId: 'mat_piel', chance: 0.40 }, { itemId: 'mat_garra', chance: 0.45 }] },
    { words: ['zorro'],          notWords: [],
      drops: [{ itemId: 'mat_piel', chance: 0.50 }, { itemId: 'mat_diente_lobo', chance: 0.15 }] },
    { words: ['jabali', 'jabalí', 'cerdo'], notWords: [],
      drops: [{ itemId: 'mat_piel', chance: 0.40 }, { itemId: 'mat_colmillo', chance: 0.45 }] },
    { words: ['ciervo', 'venado', 'alce'], notWords: [],
      drops: [{ itemId: 'mat_cuerno', chance: 0.55 }, { itemId: 'mat_piel', chance: 0.40 }] },
    { words: ['toro', 'minotauro', 'bisonte'], notWords: [],
      drops: [{ itemId: 'mat_cuerno', chance: 0.60 }, { itemId: 'mat_piel', chance: 0.40 }] },

    // ===== Roedores =====
    { words: ['rata'], notWords: [],
      drops: [{ itemId: 'mat_pelo_rata', chance: 0.60 }, { itemId: 'mat_cola_rata', chance: 0.45 }] },
    { words: ['conejo', 'liebre'], notWords: [],
      drops: [{ itemId: 'mat_piel', chance: 0.50 }] },

    // ===== Aves rapaces =====
    { words: ['aguila', 'águila', 'halcon', 'halcón', 'cuervo', 'buho', 'búho', 'lechuza'], notWords: [],
      drops: [{ itemId: 'mat_pluma', chance: 0.60 }, { itemId: 'mat_garra', chance: 0.40 }] },
    { words: ['ave', 'pajaro', 'pájaro'], notWords: ['fenix', 'fénix'],
      drops: [{ itemId: 'mat_pluma', chance: 0.55 }] },

    // ===== Reptiles =====
    { words: ['serpiente', 'cobra', 'vibora', 'víbora'], notWords: ['kraken', 'hidra'],
      drops: [{ itemId: 'mat_escama', chance: 0.50 }, { itemId: 'mat_veneno', chance: 0.40 }] },
    { words: ['lagarto', 'kobold'], notWords: [],
      drops: [{ itemId: 'mat_escama_kobold', chance: 0.50 }, { itemId: 'mat_escama', chance: 0.20 }] },
    { words: ['tortuga'], notWords: [],
      drops: [{ itemId: 'mat_caparazon', chance: 0.65 }] },

    // ===== Insectos / arácnidos =====
    { words: ['araña', 'arana', 'tarantula', 'tarántula'], notWords: [],
      drops: [{ itemId: 'mat_pata_arana', chance: 0.50 }, { itemId: 'mat_seda_arana', chance: 0.30 }, { itemId: 'mat_veneno', chance: 0.35 }] },
    { words: ['escorpion', 'escorpión'], notWords: [],
      drops: [{ itemId: 'mat_veneno', chance: 0.50 }, { itemId: 'mat_caparazon', chance: 0.25 }] },
    { words: ['abeja', 'avispa'], notWords: [],
      drops: [{ itemId: 'mat_veneno', chance: 0.40 }] },

    // ===== Murciélagos =====
    { words: ['murcielago', 'murciélago'], notWords: [],
      drops: [{ itemId: 'mat_ala_murcielago', chance: 0.55 }, { itemId: 'mat_oreja_murcielago', chance: 0.40 }] },

    // ===== Acuáticos =====
    { words: ['tiburon', 'tiburón'], notWords: [],
      drops: [{ itemId: 'mat_diente_tiburon', chance: 0.65 }, { itemId: 'mat_escama', chance: 0.30 }] },
    { words: ['pez', 'pescado'], notWords: [],
      drops: [{ itemId: 'mat_escama', chance: 0.55 }] },
    { words: ['kraken', 'pulpo', 'calamar'], notWords: [],
      drops: [{ itemId: 'mat_tinta_kraken', chance: 0.50 }] },
    { words: ['sirena'], notWords: [],
      drops: [{ itemId: 'mat_escama_sirena', chance: 0.55 }, { itemId: 'mat_perla', chance: 0.25 }] },

    // ===== Dragones =====
    { words: ['dragon', 'dragón', 'wyvern', 'drake'], notWords: [],
      drops: [{ itemId: 'mat_escama_dragon', chance: 0.60 }, { itemId: 'mat_sangre_dragon', chance: 0.30 }, { itemId: 'mat_garra', chance: 0.40 }] },
    { words: ['hidra'], notWords: [],
      drops: [{ itemId: 'mat_colmillo_hidra', chance: 0.50 }, { itemId: 'mat_escama', chance: 0.40 }] },
    { words: ['basilisco'], notWords: [],
      drops: [{ itemId: 'mat_ojo_basilisco', chance: 0.45 }, { itemId: 'mat_escama', chance: 0.35 }] },

    // ===== No-muertos =====
    { words: ['esqueleto', 'lich'], notWords: [],
      drops: [{ itemId: 'mat_hueso', chance: 0.60 }, { itemId: 'mat_dedo_esqueleto', chance: 0.35 }, { itemId: 'mat_craneo', chance: 0.20 }] },
    { words: ['zombi', 'zombie', 'cadaver', 'cadáver', 'ghoul'], notWords: [],
      drops: [{ itemId: 'mat_carne_zombi', chance: 0.55 }, { itemId: 'mat_ojo_zombi', chance: 0.30 }, { itemId: 'mat_hueso', chance: 0.30 }] },
    { words: ['fantasma', 'espectro', 'wraith', 'aparicion', 'aparición'], notWords: [],
      drops: [{ itemId: 'mat_ectoplasma', chance: 0.50 }, { itemId: 'mat_esencia', chance: 0.30 }] },
    { words: ['vampiro'], notWords: ['murcielago'],
      drops: [{ itemId: 'mat_colmillo_vampiro', chance: 0.55 }] },
    { words: ['banshee'], notWords: [],
      drops: [{ itemId: 'mat_ectoplasma', chance: 0.60 }] },

    // ===== Demonios =====
    { words: ['diablillo', 'imp'], notWords: [],
      drops: [{ itemId: 'mat_cola_diablillo', chance: 0.50 }, { itemId: 'mat_brasa_elemental', chance: 0.20 }] },
    { words: ['demonio'], notWords: ['diablillo'],
      drops: [{ itemId: 'mat_cuerno_demonio', chance: 0.45 }, { itemId: 'mat_esencia_sombra', chance: 0.30 }] },
    { words: ['licantropo', 'licántropo', 'lobizon', 'lobizón', 'hombre lobo'], notWords: [],
      drops: [{ itemId: 'mat_garra_licantropo', chance: 0.50 }, { itemId: 'mat_piel_lobo', chance: 0.35 }] },

    // ===== Goblinoides =====
    { words: ['goblin'], notWords: [],
      drops: [{ itemId: 'mat_oreja_goblin', chance: 0.50 }, { itemId: 'mat_nariz_goblin', chance: 0.30 }] },
    { words: ['orco', 'ogro'], notWords: [],
      drops: [{ itemId: 'mat_cuero_grueso', chance: 0.30 }, { itemId: 'mat_colmillo', chance: 0.30 }] },
    { words: ['troll'], notWords: [],
      drops: [{ itemId: 'mat_sangre_troll', chance: 0.40 }, { itemId: 'mat_piel', chance: 0.35 }] },

    // ===== Slimes =====
    { words: ['slime', 'gelatina', 'limo', 'baba'], notWords: [],
      drops: [{ itemId: 'mat_gelatina', chance: 0.60 }, { itemId: 'mat_nucleo_slime', chance: 0.30 }] },

    // ===== Constructos =====
    { words: ['golem'], notWords: [],
      drops: [{ itemId: 'mat_nucleo_golem', chance: 0.30 }, { itemId: 'mat_hierro', chance: 0.40 }] },

    // ===== Místicos =====
    { words: ['unicornio'], notWords: [],
      drops: [{ itemId: 'mat_cuerno_unicornio', chance: 0.50 }, { itemId: 'mat_pluma', chance: 0.20 }] },
    { words: ['fenix', 'fénix'], notWords: [],
      drops: [{ itemId: 'mat_ceniza_fenix', chance: 0.45 }, { itemId: 'mat_pluma', chance: 0.40 }, { itemId: 'mat_brasa_elemental', chance: 0.30 }] },
    { words: ['angel', 'ángel', 'serafin', 'serafín'], notWords: [],
      drops: [{ itemId: 'mat_pluma_angel', chance: 0.45 }] },
    { words: ['quimera'], notWords: [],
      drops: [{ itemId: 'mat_melena_quimera', chance: 0.50 }, { itemId: 'mat_garra', chance: 0.35 }] },
    { words: ['manticora', 'mantícora'], notWords: [],
      drops: [{ itemId: 'mat_pua_manticora', chance: 0.45 }, { itemId: 'mat_melena_quimera', chance: 0.20 }] },

    // ===== Plantas =====
    { words: ['ent', 'treant', 'arbol', 'árbol'], notWords: [],
      drops: [{ itemId: 'mat_madera', chance: 0.60 }, { itemId: 'mat_raiz_arcana', chance: 0.20 }] },
    { words: ['hongo'], notWords: [],
      drops: [{ itemId: 'mat_hongo_rojo', chance: 0.40 }, { itemId: 'mat_hongo_azul', chance: 0.25 }] },
  ];

  /**
   * Filtros de SEGURIDAD por familia: rechaza drops que NO pegan con la familia.
   */
  const FAMILY_BLACKLIST = {
    flying:    ['mat_piel_lobo', 'mat_piel_oso', 'mat_piel', 'mat_colmillo', 'mat_diente_lobo', 'mat_carne_zombi', 'mat_escama_dragon'],
    insect:    ['mat_piel_lobo', 'mat_piel_oso', 'mat_piel', 'mat_pluma', 'mat_diente_lobo', 'mat_colmillo', 'mat_cuerno'],
    undead:    [],
    construct: ['mat_piel_lobo', 'mat_piel_oso', 'mat_piel', 'mat_carne_zombi', 'mat_pluma', 'mat_sangre_dragon', 'mat_sangre_troll', 'mat_hierba_curativa'],
    elemental: ['mat_piel_lobo', 'mat_piel_oso', 'mat_piel', 'mat_carne_zombi', 'mat_pluma', 'mat_diente_lobo', 'mat_colmillo'],
    plant:     ['mat_piel_lobo', 'mat_piel_oso', 'mat_piel', 'mat_carne_zombi', 'mat_pluma', 'mat_diente_lobo', 'mat_colmillo'],
    spirit:    ['mat_piel_lobo', 'mat_piel_oso', 'mat_piel', 'mat_carne_zombi', 'mat_pluma', 'mat_diente_lobo', 'mat_colmillo', 'mat_garra'],
  };

  function suggestDrops(enemy) {
    if (!enemy) return [];
    const suggestions = new Map();

    const families = enemy.family || [];
    const tags = enemy.tags || [];
    const blacklist = new Set();
    for (const f of families) {
      const bl = FAMILY_BLACKLIST[f] || [];
      for (const id of bl) blacklist.add(id);
    }

    const add = (itemId, chance, reason) => {
      if (!itemId) return;
      if (blacklist.has(itemId)) return;
      const manual = (enemy.drops || []).some((d) => d.itemId === itemId);
      if (manual) return;
      const prev = suggestions.get(itemId);
      if (!prev || prev.chance < chance) {
        suggestions.set(itemId, { itemId, chance, reason });
      }
    };

    // 1. Por NOMBRE
    const nameNorm = normalize(enemy.name);
    for (const rule of NAME_RULES) {
      const positive = (rule.words || []).some((w) => nameNorm.includes(normalize(w)));
      if (!positive) continue;
      const negative = (rule.notWords || []).some((w) => nameNorm.includes(normalize(w)));
      if (negative) continue;
      for (const d of rule.drops) add(d.itemId, d.chance, `name:${(rule.words[0])}`);
    }

    // 2. Por familia
    for (const f of families) {
      const drops = FAMILY_DROPS[f] || [];
      for (const d of drops) add(d.itemId, d.chance, `family:${f}`);
    }

    // 3. Por tags
    for (const t of tags) {
      const drops = TAG_DROPS[t] || [];
      for (const d of drops) add(d.itemId, d.chance, `tag:${t}`);
    }

    // Filtra items que no existen
    const result = [];
    for (const sug of suggestions.values()) {
      const item = A.Data ? A.Data.getById('items', sug.itemId) : null;
      if (item) result.push(sug);
    }
    result.sort((a, b) => b.chance - a.chance);
    return result;
  }

  function resolveDrops(enemy) {
    return (enemy && enemy.drops) || [];
  }

  A.LootIntelligence = {
    suggestDrops,
    resolveDrops,
    FAMILY_DROPS,
    TAG_DROPS,
    NAME_RULES,
  };
})(window.Aventurs);
