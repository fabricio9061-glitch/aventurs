/* ============================================================
   Aventurs — v3.13: el mundo con sentido

   1) Cada guarida sale de una zona de su nivel (como mucho, 3 niveles abajo del jefe).
      Antes había jefes de nivel 14 a 20 colgando de zonas de nivel 3 a 10:
        - Ysera (19): ahora se llega por una zona nueva, el Linde del Sueño (17-19),
          en las Tierras Altas. Ya no sale del Bosque de los Sueños (5-6).
        - Aurelion Sol (19) y Alamuerte (20): sus guaridas salen de una zona nueva,
          los Picos del Dragón (17-20), arriba del Nido de Dragones (8-10).
        - La Hidra (14): su lago ahora está en la Ciénaga Primordial (13-15), no en el Pantano (3-4).
        - El Titán (19): su monte ahora está junto a la Cumbre del Mundo (18-20), no en los Picos Helados (5-8).
        - Volibear (18): su cumbre ahora sale del Abismo de las Sombras (16-18), no de la Tundra (12-14).
        - El Demonio mayor baja a nivel 11: su círculo está en el Fondo del Volcán (7-10)
          y lo que suelta (el Báculo y la Armadura del vacío) es de nivel 9 y 10.
   2) Las dos zonas nuevas traen criaturas propias.
   Se carga después de seed-v313.js.
   ============================================================ */

(function (A) {
  'use strict';

  const S = A.Seed || (A.Seed = {});
  const B = A.Balance;
  for (const k of ['regions', 'enemies', 'items', 'quests']) S[k] = S[k] || [];
  const SRC = 'v313';
  const byId = (list, id) => (list || []).find((x) => x && x.id === id);
  const uniq = (arr) => [...new Set(arr)];

  // ---------- ayudas ----------
  function link(a, b) {
    const ra = byId(S.regions, a), rb = byId(S.regions, b);
    if (!ra || !rb) return;
    ra.connections = uniq([...(ra.connections || []), b]);
    rb.connections = uniq([...(rb.connections || []), a]);
  }
  function unlink(a, b) {
    const ra = byId(S.regions, a), rb = byId(S.regions, b);
    if (ra) ra.connections = (ra.connections || []).filter((x) => x !== b);
    if (rb) rb.connections = (rb.connections || []).filter((x) => x !== a);
  }
  /** Mueve una guarida: nueva posición, de qué zona sale y (si hace falta) otra descripción. */
  function moveLair(id, o) {
    const r = byId(S.regions, id);
    if (!r) return;
    for (const c of (r.connections || []).slice()) unlink(id, c);
    if (o.pos) r.pos = o.pos;
    if (o.labelAt) r.labelAt = o.labelAt;
    if (o.description) r.description = o.description;
    if (o.biome) r.biome = o.biome;
    for (const p of o.from) link(id, p);
  }
  const ENC = (w, max = 3) => ({ minEnemies: 1, maxEnemies: max, allowMixed: true, spawnWeights: w || { weak: 20, normal: 50, strong: 30, boss: 0 } });
  function place(r, links) {
    if (byId(S.regions, r.id)) return;
    S.regions.push(Object.assign({ type: 'combat', distance: 2, icon: '', labelAt: 'b', encounter: ENC(), connections: [], _source: SRC }, r));
    for (const l of links) link(r.id, l);
  }
  function curve(tier, cat, prof = {}) {
    const st = B.enemyStats(tier, cat, prof);
    return { health: st.health, damage: st.damage, armor: Math.max(0, st.armor + (prof.arm || 0)), attack: Math.max(0, st.attack + (prof.atk || 0)), difficulty: st.difficulty + (prof.def || 0) };
  }
  /** Una criatura nueva (como en seed-v312.js): base es de quién copia el dibujo; colors, su paleta. */
  function creature(o) {
    if (byId(S.enemies, o.id)) return byId(S.enemies, o.id);
    const cat = o.category || 'normal';
    const e = Object.assign({
      icon: '', category: cat, tags: [], biome: [], speed: 10, regions: [],
      spawn: { min: 1, max: cat === 'normal' ? 2 : 1, weight: 1, groupable: cat !== 'boss' },
      tameable: false, autoLoot: cat !== 'boss', _source: SRC,
    }, curve(o.tier, cat, o.prof || {}), o);
    if (o.base || o.colors) e.sprite = Object.assign({ t: o.base }, o.colors || {});
    delete e.prof; delete e.base; delete e.colors; delete e.mats;
    e.drops = [B.Economy.coinDrop(e)].concat((o.mats || []).map(([itemId, chance]) => ({ itemId, chance, source: SRC })));
    S.enemies.push(e);
    return e;
  }
  const addRegion = (enemyId, regionId) => { const e = byId(S.enemies, enemyId); if (e) e.regions = uniq([...(e.regions || []), regionId]); };

  // ---------------------------------------------------------------
  // 1) Ysera: el Linde del Sueño (17-19) y su guarida, en las Tierras Altas
  // ---------------------------------------------------------------
  place({ id: 'linde_sueno', name: 'Linde del Sueño', biome: 'dream', tier: [17, 19], pos: { x: 1525, y: 450 }, labelAt: 'r',
    description: 'Donde el mundo despierto se gasta, empieza el Sueño Esmeralda: árboles de luz verde, una niebla tibia y criaturas que no se sabe si existen o si alguien las está soñando.',
    unlockConditions: { minLevel: 17 } }, ['ruinas_celestes', 'desierto_cristal']);
  moveLair('sueno_esmeralda', { from: ['linde_sueno'], pos: { x: 1470, y: 510 }, labelAt: 'l',
    description: 'En el fondo del Linde del Sueño, el bosque se vuelve verde esmeralda y el aire, tibio como un sueño. En el centro duerme una dragona enorme… con los ojos cerrados, pero te está viendo.' });

  creature({ id: 'pesadilla_esmeralda', name: 'Pesadilla esmeralda', tier: 17, family: ['spirit'], tags: ['shadow', 'dream'], biome: ['dream'], speed: 12, regions: ['linde_sueno'],
    base: 'pesadilla', colors: { b: '#1f4a3a', c: '#7a4aa8', e: '#9effb0' },
    skills: ['etereo', 'miedo', 'polvo_sueno'], mats: [['flor_sueno', 0.4], ['mat_ectoplasma', 0.5], ['mat_esencia', 0.3]],
    description: 'Un mal sueño que se escapó del Sueño Esmeralda. Corre entre los árboles como un caballo de humo verde y deja a todos con sueño.' });
  creature({ id: 'durmiente', name: 'Durmiente', category: 'weak', tier: 17, family: ['undead', 'spirit'], tags: ['dream'], biome: ['dream'], speed: 8, regions: ['linde_sueno'],
    base: 'fantasma', colors: { b: '#a8e0b8', c: '#5a9a78', e: '#e8fff0' },
    skills: ['etereo', 'drenar'], mats: [['mat_ectoplasma', 0.5], ['flor_sueno', 0.25]],
    description: 'Un aventurero que se durmió en el Linde y nunca despertó. Camina con los ojos cerrados y te roba un poco de vida para seguir soñando.' });
  creature({ id: 'hada_pesadilla', name: 'Hada de la pesadilla', tier: 18, family: ['fey', 'humanoid'], tags: ['dream', 'flying'], biome: ['dream'], speed: 14, regions: ['linde_sueno'],
    base: 'hada_traviesa', colors: { b: '#3a2a5a', c: '#7a3a9a', e: '#ff7af0' },
    skills: ['vuelo', 'polvo_sueno', 'ilusion'], mats: [['polvo_hada', 0.5], ['flor_sueno', 0.35], ['mat_esencia', 0.3]],
    description: 'Un hada que se quedó a vivir en las pesadillas. Se ríe igual que las otras, pero su polvo da sueños feos.' });
  creature({ id: 'arbol_sonador', name: 'Árbol soñador', category: 'strong', tier: 18, family: ['plant'], tags: ['dream', 'nature'], biome: ['dream'], speed: 6, regions: ['linde_sueno'],
    base: 'ent', colors: { b: '#2a6a5a', c: '#5ad0a0', a: '#b0ffd8' },
    skills: ['gigante', 'espinas', 'regeneracion', 'agarre'], mats: [['mat_madera', 0.8], ['mat_raiz_arcana', 0.4], ['flor_sueno', 0.3]],
    description: 'Un árbol viejísimo que sueña despierto. Las ramas se le mueven solas y, si lo lastimás, la corteza se le cierra mientras duerme.' });
  creature({ id: 'dragon_esmeralda', name: 'Dragón esmeralda', category: 'strong', tier: 19, family: ['dragon', 'flying'], tags: ['dream', 'nature', 'flying'], biome: ['dream'], speed: 13, regions: ['linde_sueno'],
    base: 'dragon_joven', colors: { b: '#2f8a4e', c: '#9ee0a8', e: '#7ad8ff' }, prof: { hp: 0.95, dmg: 0.9 },
    skills: ['vuelo', 'aliento_sueno', 'barrido'], mats: [['mat_escama_dragon', 0.6], ['mat_escama_ancestral', 0.2], ['flor_sueno', 0.4], ['mat_sangre_dragon', 0.15]],
    description: 'Un dragón de la bandada de Ysera. Cuida el camino al Sueño Esmeralda y duerme a los que se acercan con su aliento verde.' });

  // ---------------------------------------------------------------
  // 2) Aurelion Sol y Alamuerte: los Picos del Dragón (17-20)
  // ---------------------------------------------------------------
  place({ id: 'picos_dragon', name: 'Picos del Dragón', biome: 'mountain', tier: [17, 20], pos: { x: 1330, y: 230 }, labelAt: 'b',
    description: 'Arriba del Nido de Dragones, donde ya no llegan los dragones jóvenes, viven los viejos. Las piedras están negras de fuego y el viento huele a azufre.',
    unlockConditions: { minLevel: 17 } }, ['bosque_petreo']);
  moveLair('cima_dragon', { from: ['picos_dragon'],
    description: 'El pico más alto de los Picos del Dragón, tan alto que de noche las estrellas se pueden tocar. Ahí descansa Aurelion Sol, el dragón que las forjó.' });
  moveLair('trono_alamuerte', { from: ['picos_dragon'],
    description: 'Una caverna de roca fundida en los Picos del Dragón. Las placas de metal de Alamuerte brillan en la oscuridad como brasas.' });
  creature({ id: 'guiverno_ancestral', name: 'Guiverno ancestral', tier: 17, family: ['dragon', 'flying'], tags: ['flying', 'poison'], biome: ['mountain'], speed: 13, regions: ['picos_dragon'],
    base: 'guiverno', colors: { b: '#4a3a2a', c: '#a07a4a', e: '#ffd040' },
    skills: ['vuelo', 'picadura', 'picada'], mats: [['mat_garra', 0.6], ['carne_dragon', 0.5], ['mat_escama_dragon', 0.3]],
    description: 'Un guiverno viejo y enorme, con la cola llena de veneno. Caza desde las piedras más altas y cae en picada.' });
  creature({ id: 'draconido_elite', name: 'Dracónido de élite', tier: 17, family: ['humanoid', 'dragon'], tags: ['fire'], biome: ['mountain'], speed: 11, regions: ['picos_dragon'],
    base: 'draconido_salvaje', colors: { b: '#6a1a1a', c: '#c8a040', e: '#ffcc00' },
    skills: ['ignifugo', 'furia', 'aliento_fuego'], mats: [['mat_escama', 0.6], ['mat_escama_dragon', 0.3], ['mat_sangre_dragon', 0.1]],
    description: 'Los guerreros que juraron cuidar a Alamuerte. Tienen escamas de oro viejo y escupen fuego igual que sus amos.' });
  creature({ id: 'sacerdote_dragon', name: 'Gran sacerdote del dragón', category: 'strong', tier: 18, family: ['humanoid', 'arcane'], tags: ['fire', 'arcane'], biome: ['mountain'], speed: 10, regions: ['picos_dragon'],
    base: 'mago_oscuro', colors: { b: '#c89070', c: '#3a0a0a', a: '#ffcf40', e: '#ff4a00' }, prof: { hp: 0.9, dmg: 0.9 },
    skills: ['valiente', 'curar_aliados', 'hechizo', 'grito'], mats: [['mat_escama_dragon', 0.5], ['mat_sangre_dragon', 0.25], ['pocion_mana_suprema', 0.15]],
    description: 'El que dirige a los cultistas del dragón. Reza en voz alta mientras pelea y cura a los que pelean a su lado.' });
  addRegion('dragon_tormenta', 'picos_dragon');
  addRegion('dragon_anciano', 'picos_dragon');

  // ---------------------------------------------------------------
  // 3) Las guaridas que estaban lejos de su nivel
  // ---------------------------------------------------------------
  moveLair('lago_hidra', { from: ['cienaga_primordial'], pos: { x: 1330, y: 668 }, labelAt: 'b',
    description: 'Un lago verde y caliente en el fondo de la Ciénaga Primordial. Tres cabezas se asoman a la vez y se te quedan mirando.' });
  moveLair('monte_titan', { from: ['cumbre_mundo'], pos: { x: 1790, y: 285 }, labelAt: 'b',
    description: 'Al lado de la Cumbre del Mundo hay una montaña que tiene ojos. El Titán se sentó acá hace mil años y todavía no se levantó.' });
  moveLair('cumbre_tormenta', { from: ['abismo_sombras'],
    description: 'Un pico pelado al norte del Abismo de las Sombras donde la tormenta no para nunca. Entre rayo y rayo se ve una sombra enorme, blanca, de un oso que camina en dos patas.' });
  link('cubil_tarrasca', 'volcan'); // la Tarrasca (10): también desde el Volcán (8-9), no solo desde el Desierto (5-6)
  { const r = byId(S.regions, 'cubil_tarrasca'); if (r) r.description = 'Una hondonada entre la arena del Desierto y las rocas del Volcán, con un caparazón enorme en el medio. Si lo mirás bien, respira.'; }
  // El Demonio mayor baja a nivel 11 (su círculo está en el Fondo del Volcán, de nivel 7 a 10)
  {
    const d = byId(S.enemies, 'demonio_mayor');
    const r = byId(S.regions, 'circulo_infernal');
    if (d && d.tier !== 11) {
      Object.assign(d, curve(11, 'boss', { hp: 0.95, dmg: 0.9 }), { tier: 11 });
      const coin = (d.drops || []).findIndex((x) => x.itemId === 'coin_copper');
      if (coin >= 0) d.drops[coin] = B.Economy.coinDrop(d);
    }
    if (r) { r.tier = [11, 11]; r.unlockConditions = Object.assign({}, r.unlockConditions, { minLevel: 11 }); }
  }
  // "Demonio de las sombras" (17) se llama ahora "Engendro de las sombras": un jefe no puede tener
  // una versión común con más nivel (el Demonio mayor es de nivel 11)
  { const e = byId(S.enemies, 'demonio_sombras'); if (e && e.name === 'Demonio de las sombras') e.name = 'Engendro de las sombras'; }
  // Textos que nombraban los lugares viejos
  {
    const q = byId(S.quests, 'sq_hidra');
    if (q) {
      q.offer = 'Para un hechizo que estoy estudiando necesito un colmillo de hidra. La hidra vive en su lago, en el fondo de la Ciénaga Primordial. Tiene tres cabezas y muerde con las tres, así que cortá rápido.';
      q.text = 'Velrith necesita un colmillo de la hidra del Lago de la Hidra (en la Ciénaga Primordial). Es de nivel 14.';
    }
    const mq = byId(S.quests, 'mq8_sombra');
    if (mq) {
      mq.offer = 'El dragón que despertó Morvaith es Alamuerte, el más fuerte de todos los dragones. Espera en su trono, en los Picos del Dragón (arriba del Nido de Dragones): antes de ir, hacete fuerte en las Tierras Altas.';
      mq.text = 'Alamuerte espera en su trono, en los Picos del Dragón (es para nivel 20: se llega desde el Bosque Petrificado). Terminá con la sombra que cubre el reino.';
    }
  }

  // ---------------------------------------------------------------
  // 4) Topes de cantidad: cuántos de cada objeto podés llevar
  //    (antes casi todo llegaba a 99). Lo que sobra se vende solo (State.addItem).
  //    Pociones: las chicas 10, las normales 8, las mayores 5, las supremas y divinas 3,
  //    el Elixir de vida 2 y el eterno 1. Pergaminos: 5 los comunes y 1 los legendarios.
  //    Los materiales alcanzan siempre para dos veces la receta que más pide.
  // ---------------------------------------------------------------
  const CAP = {
    potion: { common: 10, uncommon: 8, rare: 5, epic: 3, legendary: 1 },
    scroll: { common: 5, uncommon: 4, rare: 3, epic: 2, legendary: 1 },
    scroll_spell: { common: 2, uncommon: 2, rare: 1, epic: 1, legendary: 1 },
    food: { common: 20, uncommon: 12, rare: 8, epic: 5, legendary: 3 },
    material: { common: 40, uncommon: 25, rare: 15, epic: 8, legendary: 4 },
    key: { common: 5, uncommon: 5, rare: 3, epic: 2, legendary: 1 },
    tame: { common: 10, uncommon: 10, rare: 5, epic: 3, legendary: 2 },
  };
  const CAP_ID = { pocion_curacion_menor: 10, pocion_mana_menor: 10, ron_anejo: 10, antidoto: 10, te_de_hierbas: 10, elixir_vida: 2, hierba_vida: 3, pergamino_escape: 3 };
  const need = {};
  for (const r of S.recipes || []) for (const ing of r.ingredients || []) need[ing.itemId] = Math.max(need[ing.itemId] || 0, ing.qty || 1);
  for (const it of S.items) {
    if (!it || it.quest || it.subtype === 'coin' || !(it.stack > 1)) continue; // los que son de a uno siguen de a uno
    const table = CAP[it.subtype];
    if (!table && !CAP_ID[it.id]) continue;
    let cap = CAP_ID[it.id] || (table && (table[it.rarity || 'common'] || table.common)) || it.stack;
    if (it.subtype === 'material') cap = Math.max(cap, (need[it.id] || 0) * 2);
    it.stack = cap;
  }

  // ---------------------------------------------------------------
  // 5) Economía: que el valor de cada cosa tenga sentido
  //  a) La rareza vale más: poco común ×1,4, rara ×2, épica ×3,2 y legendaria ×5,5 del precio
  //     de una común de su nivel (antes ×1,3 · ×1,7 · ×2,5 · ×4). Se recalcula todo el equipo
  //     que seguía la fórmula vieja; lo que tiene un precio puesto a mano (lo de arranque) queda igual.
  //  b) Las pociones valen según el nivel para el que sirven: unas 5 peleas de ese nivel
  //     (las de curar y maná), 4 las de mejora y más los elixires. Nunca bajan.
  // ---------------------------------------------------------------
  {
    const E = B.Economy;
    const NEW = E.RARITY_PRICE, OLD = E.RARITY_PRICE_OLD;
    const near = (a, b) => b > 0 && Math.abs(a / b - 1) <= 0.2;
    const regear = (list, kind) => {
      for (const g of list || []) {
        if (!g || !g.value || !g.rarity || g.rarity === 'common') continue;
        const t = g.tier || 1;
        const now = E.gearPrice(t, g.rarity, kind);
        const was = Math.round(now * (OLD[g.rarity] || 1) / (NEW[g.rarity] || 1));
        if (near(g.value, now)) continue;          // ya tiene el precio nuevo
        if (near(g.value, was)) g.value = now;     // seguía la fórmula vieja: precio nuevo
      }
    };
    regear(S.weapons, 'weapon');
    regear(S.armors, 'armor');
    regear((S.items || []).filter((i) => i.subtype === 'accessory'), 'weapon');
    const POT = {
      pocion_curacion_menor: [1, 5], pocion_mana_menor: [1, 5], ron_anejo: [2, 5], te_de_hierbas: [2, 5],
      pocion_curacion: [4, 5], pocion_mana: [4, 5], vial_sangre: [4, 5],
      pocion_curacion_mayor: [8, 5], pocion_mana_mayor: [8, 5], elixir_vida: [10, 8],
      pocion_curacion_suprema: [14, 5], pocion_mana_suprema: [14, 5],
      pocion_curacion_divina: [21, 5], pocion_mana_divina: [21, 5], elixir_eterno: [24, 10],
      pocion_piel_piedra: [4, 4], pocion_velocidad: [4, 4], pocion_regeneracion: [5, 4], pocion_invisibilidad: [7, 4],
      pocion_contra_fuego: [5, 3], pocion_contra_frio: [5, 3], elixir_fuerza: [5, 4], hierba_vida: [5, 6],
    };
    for (const [id, [t, k]] of Object.entries(POT)) {
      const it = byId(S.items, id);
      if (!it) continue;
      it.tier = it.tier || t;
      it.value = Math.max(it.value || 0, Math.round(E.coinBase(t) * k));
    }
  }
})(window.Aventurs);
