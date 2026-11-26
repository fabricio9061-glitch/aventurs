/* ============================================================
   Aventurs — v3.11: las Tierras Altas (niveles 11 a 20)
   - Al este del reino, pasando la Bruma: diez lugares nuevos, el
     Bastión del Alba (pueblo) y cinco jefes con su guarida.
   - Criaturas de nivel 10 a 20 (sus números salen de la curva de
     Balance.enemyStats; el dibujo, de una criatura conocida con otros colores).
   - Equipo de oricalco (12), astral (15) y del alba (18), y lo que sueltan los jefes.
   - Hechizos nuevos que enseña la sabia del Bastión, y pociones supremas.
   - El Devorador de Mundos se invoca en el Trono del Vacío con lo que
     sueltan los otros cuatro jefes de las Tierras Altas.
   Se carga después de seed-v311.js.
   ============================================================ */

(function (A) {
  'use strict';

  const S = A.Seed || (A.Seed = {});
  const B = A.Balance;
  const byId = (list, id) => (list || []).find((x) => x && x.id === id);
  const uniq = (arr) => [...new Set(arr)];
  for (const k of ['regions', 'enemies', 'items', 'weapons', 'armors', 'spells', 'npcs', 'recipes']) S[k] = S[k] || [];

  function link(a, b) {
    const ra = byId(S.regions, a);
    const rb = byId(S.regions, b);
    if (!ra || !rb) return;
    ra.connections = uniq([...(ra.connections || []), b]);
    rb.connections = uniq([...(rb.connections || []), a]);
  }
  const ENC = (w, max = 3) => ({ minEnemies: 1, maxEnemies: max, allowMixed: true, spawnWeights: w || { weak: 25, normal: 50, strong: 25, boss: 0 } });
  function place(r, links) {
    if (byId(S.regions, r.id)) return;
    S.regions.push(Object.assign({ type: 'combat', distance: 2, icon: '', labelAt: 'b', encounter: ENC(), connections: [], _source: 'v311' }, r));
    for (const l of links) link(r.id, l);
  }
  function curve(tier, cat, prof = {}) {
    const st = B.enemyStats(tier, cat, prof);
    return { health: st.health, damage: st.damage, armor: Math.max(0, st.armor + (prof.arm || 0)), attack: Math.max(0, st.attack + (prof.atk || 0)), difficulty: st.difficulty + (prof.def || 0) };
  }
  function creature(o) {
    if (byId(S.enemies, o.id)) return byId(S.enemies, o.id);
    const cat = o.category || 'normal';
    const e = Object.assign({
      icon: '', category: cat, tags: [], biome: [], speed: 10, regions: [],
      spawn: { min: 1, max: cat === 'normal' ? 2 : 1, weight: 1, groupable: cat !== 'boss' },
      tameable: false, autoLoot: cat !== 'boss', _source: 'v311',
    }, curve(o.tier, cat, o.prof || {}), o);
    if (o.base || o.colors) e.sprite = Object.assign({ t: o.base }, o.colors || {});
    delete e.prof; delete e.base; delete e.colors; delete e.mats;
    e.drops = [B.Economy.coinDrop(e)].concat((o.mats || []).map(([itemId, chance]) => ({ itemId, chance, source: 'v311' })));
    S.enemies.push(e);
    return e;
  }
  const item = (o) => { if (!byId(S.items, o.id)) S.items.push(Object.assign({ type: 'item', icon: '', weight: 0, stack: 99, _source: 'v311' }, o)); };
  const weapon = (o) => {
    if (byId(S.weapons, o.id)) return;
    S.weapons.push(Object.assign({ type: 'weapon', icon: '', magic: false, value: B.Economy.gearPrice(o.tier, o.rarity, 'weapon'), alto: true, _source: 'v311' }, o));
  };
  const armor = (o) => {
    if (byId(S.armors, o.id)) return;
    S.armors.push(Object.assign({ type: 'armor', icon: '', magic: false, value: B.Economy.gearPrice(o.tier, o.rarity, 'armor'), alto: true, _source: 'v311' }, o));
  };

  // ---------------------------------------------------------------
  // 1) Materiales, pociones y lo que sueltan los jefes
  // ---------------------------------------------------------------
  item({ id: 'mat_oricalco', name: 'Oricalco', subtype: 'material', rarity: 'rare', value: 260, description: 'Un metal rojizo que brilla como el atardecer. Más duro que el acero y más liviano.' });
  item({ id: 'mat_cristal_astral', name: 'Cristal astral', subtype: 'material', rarity: 'epic', value: 900, description: 'Un cristal con estrellas adentro. Si lo acercás al oído, zumba.' });
  item({ id: 'mat_esencia_vacio', name: 'Esencia del vacío', subtype: 'material', rarity: 'epic', value: 2600, description: 'Un frasco con algo que no es luz ni sombra. Pesa más de lo que debería.' });
  item({ id: 'mat_escama_ancestral', name: 'Escama ancestral', subtype: 'material', rarity: 'rare', value: 520, description: 'De una bestia tan vieja como las montañas. No la raya ni el diamante.' });
  item({ id: 'pocion_curacion_suprema', name: 'Poción de curación suprema', subtype: 'potion', rarity: 'epic', tier: 13, value: 700, weight: 1,
    effect: { type: 'heal', amount: '6d10+20' }, description: 'Dorada y tibia. Cierra hasta las heridas que no se ven.' });
  item({ id: 'pocion_mana_suprema', name: 'Poción de maná suprema', subtype: 'potion', rarity: 'epic', tier: 13, value: 650, weight: 1,
    effect: { type: 'mana', amount: '5d8+15' }, description: 'Azul profundo, con chispas que suben como burbujas.' });
  item({ id: 'elixir_vida', name: 'Elixir de vida', subtype: 'potion', rarity: 'legendary', tier: 17, value: 3200, weight: 1,
    effect: { type: 'heal', amount: '10d10+40' }, description: 'Dicen que una gota alcanza para resucitar un árbol seco.' });
  // Los cuatro sellos del Devorador (cada jefe de las Tierras Altas suelta el suyo)
  item({ id: 'corazon_fenix', name: 'Corazón del Fénix', subtype: 'material', rarity: 'legendary', value: 5000, stack: 10, description: 'Late todavía, y quema. Uno de los cuatro sellos del Trono del Vacío.' });
  item({ id: 'corona_escarcha', name: 'Corona de escarcha', subtype: 'material', rarity: 'legendary', value: 6000, stack: 10, description: 'Hielo que nunca se derrite, con forma de corona. Uno de los cuatro sellos del Trono del Vacío.' });
  item({ id: 'nucleo_primordial', name: 'Núcleo primordial', subtype: 'material', rarity: 'legendary', value: 7000, stack: 10, description: 'El corazón de piedra del primer gólem. Uno de los cuatro sellos del Trono del Vacío.' });
  item({ id: 'velo_sombras', name: 'Velo de las sombras', subtype: 'material', rarity: 'legendary', value: 8000, stack: 10, description: 'Una tela que no se puede mirar de frente. Uno de los cuatro sellos del Trono del Vacío.' });

  // ---------------------------------------------------------------
  // 2) Equipo de las Tierras Altas
  //    Oricalco (12, raro) · Astral (15, épico) · Del alba (18, épico) · de los jefes (legendario)
  //    Medido para que a su nivel peleen como el equipo del 9-10 contra las criaturas del 9-10.
  // ---------------------------------------------------------------
  const W = [
    // [id, nombre, dado, peso, extra]
    ['espada_oricalco', 'Espada de oricalco', '3d8+3', 3, { tier: 12, rarity: 'rare' }],
    ['hacha_oricalco', 'Hacha de oricalco', '3d10+2', 6, { tier: 12, rarity: 'rare' }],
    ['martillo_oricalco', 'Martillo de oricalco', '4d8', 7, { tier: 12, rarity: 'rare' }],
    ['lanza_oricalco', 'Lanza de oricalco', '3d8+4', 5, { tier: 12, rarity: 'rare' }],
    ['arco_oricalco', 'Arco de oricalco', '3d8+2', 2, { tier: 12, rarity: 'rare' }],
    ['daga_oricalco', 'Daga de oricalco', '3d6+3', 1, { tier: 12, rarity: 'rare' }],
    ['baston_oricalco', 'Bastón de oricalco', '3d6+2', 2, { tier: 12, rarity: 'rare', magic: true }],
    ['espada_astral', 'Espada astral', '4d8+2', 3, { tier: 15, rarity: 'epic' }],
    ['hacha_astral', 'Hacha astral', '4d10', 6, { tier: 15, rarity: 'epic' }],
    ['martillo_astral', 'Martillo astral', '5d8', 7, { tier: 15, rarity: 'epic' }],
    ['lanza_astral', 'Lanza astral', '4d8+3', 5, { tier: 15, rarity: 'epic' }],
    ['arco_astral', 'Arco astral', '4d8+1', 2, { tier: 15, rarity: 'epic' }],
    ['daga_astral', 'Daga astral', '4d6+3', 1, { tier: 15, rarity: 'epic' }],
    ['baston_astral', 'Bastón astral', '4d6+2', 2, { tier: 15, rarity: 'epic', magic: true }],
    ['espada_alba', 'Espada del alba', '5d8+3', 3, { tier: 18, rarity: 'epic' }],
    ['hacha_alba', 'Hacha del alba', '5d10+2', 6, { tier: 18, rarity: 'epic' }],
    ['martillo_alba', 'Martillo del alba', '6d8+2', 8, { tier: 18, rarity: 'epic' }],
    ['lanza_alba', 'Lanza del alba', '5d8+4', 5, { tier: 18, rarity: 'epic' }],
    ['arco_alba', 'Arco del alba', '5d8+2', 2, { tier: 18, rarity: 'epic' }],
    ['daga_alba', 'Daga del alba', '5d6+4', 1, { tier: 18, rarity: 'epic' }],
    ['baston_alba', 'Bastón del alba', '5d6+3', 2, { tier: 18, rarity: 'epic', magic: true }],
    // de los jefes
    ['espada_fenix', 'Espada del Fénix', '4d8+3', 3, { tier: 13, rarity: 'legendary', statusEffect: { type: 'fire', chance: 0.35, turns: 3, value: 4 } }],
    ['lanza_escarcha', 'Lanza de escarcha', '4d8+4', 5, { tier: 15, rarity: 'legendary', statusEffect: { type: 'cold', chance: 0.35, turns: 3, value: 4 } }],
    ['martillo_primordial', 'Martillo primordial', '6d8+2', 8, { tier: 17, rarity: 'legendary', statusEffect: { type: 'shock', chance: 0.3, turns: 2, value: 4 } }],
    ['guadana_sombras', 'Guadaña de las sombras', '5d8+5', 5, { tier: 19, rarity: 'legendary', statusEffect: { type: 'bleed', chance: 0.35, turns: 3, value: 5 } }],
    ['fin_del_mundo', 'Fin del Mundo', '6d8+6', 4, { tier: 20, rarity: 'legendary', statusEffect: { type: 'bleed', chance: 0.4, turns: 3, value: 6 } }],
    ['cetro_vacio', 'Cetro del vacío', '6d6+4', 2, { tier: 20, rarity: 'legendary', magic: true }],
  ];
  const DESC = {
    oricalco: 'Forjada en oricalco: más dura que el acero y casi no pesa.',
    astral: 'Brilla con luz de estrellas. Corta como si el aire no existiera.',
    alba: 'Templada con el primer rayo del día. Las sombras le tienen miedo.',
    espada_fenix: 'Arde sin quemar a quien la empuña. Lo que toca, se prende fuego.',
    lanza_escarcha: 'La punta está tan fría que el aire se congela a su paso.',
    martillo_primordial: 'Pesa como una montaña. Cuando pega, la tierra tiembla y suelta chispas.',
    guadana_sombras: 'La hoja no refleja nada. Las heridas que deja no se cierran.',
    fin_del_mundo: 'La espada del Devorador. Lo que corta, no deja de sangrar.',
    cetro_vacio: 'Un cetro que bebe la luz. La magia sale de él más negra y más fuerte.',
  };
  for (const [id, name, damage, weight, extra] of W) {
    const kind = id.split('_').slice(1).join('_');
    weapon(Object.assign({ id, name, damage, weight, description: DESC[id] || DESC[kind] || '' }, extra));
  }
  const ARM = [
    // [id, nombre, armadura, esquiva, peso, extra]
    ['placa_oricalco', 'Placa de oricalco', 9, 0, 7, { tier: 12, rarity: 'rare' }],
    ['cuero_oricalco', 'Cuero con oricalco', 7, 2, 3, { tier: 12, rarity: 'rare' }],
    ['tunica_bruma', 'Túnica de la bruma', 5, 3, 1, { tier: 12, rarity: 'rare', magic: true, mana: 12 }],
    ['placa_astral', 'Placa astral', 10, 0, 7, { tier: 15, rarity: 'epic' }],
    ['malla_astral', 'Malla astral', 8, 2, 4, { tier: 15, rarity: 'epic' }],
    ['manto_astral', 'Manto astral', 6, 4, 1, { tier: 15, rarity: 'epic', magic: true, mana: 16 }],
    ['placa_alba', 'Placa del alba', 11, 1, 7, { tier: 18, rarity: 'epic' }],
    ['escamas_alba', 'Escamas del alba', 9, 3, 4, { tier: 18, rarity: 'epic' }],
    ['vestiduras_alba', 'Vestiduras del alba', 7, 5, 1, { tier: 18, rarity: 'epic', magic: true, mana: 20 }],
    ['coraza_ancestral', 'Coraza ancestral', 12, 2, 6, { tier: 20, rarity: 'legendary' }],
    ['manto_vacio', 'Manto del vacío', 8, 6, 1, { tier: 20, rarity: 'legendary', magic: true, mana: 26 }],
  ];
  const ADESC = {
    oricalco: 'Placas de oricalco: aguantan lo que partiría al acero.', bruma: 'Tejida con hilos de niebla. Cuesta acertarle a quien la lleva.',
    astral: 'Con el brillo frío de las estrellas.', alba: 'Hecha con la luz del amanecer: liviana y casi irrompible.',
    coraza_ancestral: 'Escamas de las bestias más viejas del mundo, una sobre otra.', manto_vacio: 'Hecho de algo que no debería existir. Se lleva la magia hasta el fondo.',
  };
  for (const [id, name, def, dodge, weight, extra] of ARM) {
    const kind = Object.keys(ADESC).find((k) => id.includes(k));
    armor(Object.assign({ id, name, defense: def, dodge, weight, description: ADESC[id] || ADESC[kind] || '' }, extra));
  }

  // ---------------------------------------------------------------
  // 3) Hechizos nuevos (los enseña Seren, la sabia del Bastión)
  // ---------------------------------------------------------------
  const spell = (o) => { if (!byId(S.spells, o.id)) S.spells.push(Object.assign({ icon: '', _source: 'v311' }, o)); };
  spell({ id: 'rayo_estelar', name: 'Rayo estelar', iconName: 'star', damage: '5d6', manaCost: 12, tier: 12, school: 'arcane', cooldown: 1,
    description: 'Un rayo de luz de estrellas contra un enemigo.' });
  spell({ id: 'meteoro', name: 'Meteoro', iconName: 'fireball', damage: '3d8', manaCost: 16, tier: 13, school: 'fire', area: true, mageOnly: true, cooldown: 3,
    statusEffect: { type: 'fire', chance: 0.3, turns: 2, value: 4 }, description: 'Una roca en llamas cae del cielo sobre todos tus enemigos. Solo para magos.' });
  spell({ id: 'curacion_suprema', name: 'Curación suprema', iconName: 'heal', heal: '6d8+10', manaCost: 14, tier: 14, school: 'holy', cooldown: 4,
    description: 'Una luz cálida que cierra cualquier herida.' });
  spell({ id: 'juicio_divino', name: 'Juicio divino', iconName: 'sun', damage: '6d8', manaCost: 18, tier: 15, school: 'holy', mageOnly: true, cooldown: 2,
    description: 'Una columna de luz cae sobre un enemigo. Solo para magos.' });
  spell({ id: 'ventisca_eterna', name: 'Ventisca eterna', iconName: 'cold', damage: '4d6', manaCost: 18, tier: 16, school: 'ice', area: true, mageOnly: true, cooldown: 3,
    statusEffect: { type: 'cold', chance: 0.4, turns: 2, value: 3 }, description: 'Una tormenta de hielo que congela a todos tus enemigos. Solo para magos.' });
  spell({ id: 'tormenta_vacio', name: 'Tormenta del vacío', iconName: 'arcane', damage: '5d6', manaCost: 24, tier: 18, school: 'arcane', area: true, mageOnly: true, cooldown: 4,
    description: 'Se abre un hueco en el aire y se traga un pedazo de cada enemigo. Solo para magos.' });

  // ---------------------------------------------------------------
  // 4) Lugares
  // ---------------------------------------------------------------
  place({ id: 'paso_bruma', name: 'Paso de la Bruma', biome: 'mountain', tier: [10, 12], pos: { x: 1335, y: 330 }, labelAt: 't',
    description: 'Un paso entre montañas donde la niebla no se levanta nunca. Del otro lado empiezan las Tierras Altas.',
    unlockConditions: { minLevel: 10 }, encounter: ENC({ weak: 25, normal: 50, strong: 25, boss: 0 }, 2) }, ['velmora', 'nido_de_dragones']);
  place({ id: 'bastion_alba', name: 'Bastión del Alba', type: 'safe', biome: 'village', tier: [11, 11], pos: { x: 1450, y: 400 }, labelAt: 'b',
    description: 'La última fortaleza de los hombres. Murallas blancas, estandartes dorados y viajeros que vienen a probar suerte.',
    unlockConditions: { minLevel: 11 }, distance: 1 }, ['paso_bruma']);
  place({ id: 'bosque_petreo', name: 'Bosque Petrificado', biome: 'forest', tier: [11, 13], pos: { x: 1420, y: 205 }, labelAt: 't',
    description: 'Un incendio antiguo convirtió los árboles en piedra. Entre los troncos grises anidan cosas que miran fijo.',
    unlockConditions: { minLevel: 11 } }, ['bastion_alba']);
  place({ id: 'tundra_eterna', name: 'Tundra Eterna', biome: 'mountain', tier: [12, 14], pos: { x: 1565, y: 120 }, labelAt: 'b',
    description: 'Hielo hasta donde da la vista. El viento canta y, a lo lejos, algo enorme camina.',
    unlockConditions: { minLevel: 12 } }, ['bosque_petreo']);
  place({ id: 'cienaga_primordial', name: 'Ciénaga Primordial', biome: 'swamp', tier: [13, 15], pos: { x: 1420, y: 585 }, labelAt: 'b',
    description: 'Un pantano de antes de que existieran los hombres. El barro respira.',
    unlockConditions: { minLevel: 13 } }, ['bastion_alba', 'jardin_carmesi']);
  place({ id: 'ruinas_celestes', name: 'Ruinas Celestes', biome: 'ruins', tier: [14, 16], pos: { x: 1600, y: 300 }, labelAt: 'r',
    description: 'Una ciudad que cayó del cielo. Las columnas flotan un palmo sobre el suelo.',
    unlockConditions: { minLevel: 14 } }, ['bastion_alba', 'tundra_eterna']);
  place({ id: 'desierto_cristal', name: 'Desierto de Cristal', biome: 'desert', tier: [15, 17], pos: { x: 1590, y: 520 }, labelAt: 'b',
    description: 'La arena se volvió vidrio con algún fuego viejo. Al mediodía, el brillo te deja ciego.',
    unlockConditions: { minLevel: 15 } }, ['cienaga_primordial', 'ruinas_celestes']);
  place({ id: 'abismo_sombras', name: 'Abismo de las Sombras', biome: 'crypt', tier: [16, 18], pos: { x: 1720, y: 185 }, labelAt: 'b',
    description: 'Una grieta donde la luz se pierde. Las sombras de abajo no son de nadie.',
    unlockConditions: { minLevel: 16 } }, ['tundra_eterna', 'ruinas_celestes']);
  place({ id: 'cumbre_mundo', name: 'Cumbre del Mundo', biome: 'mountain', tier: [18, 20], pos: { x: 1735, y: 400 }, labelAt: 'l',
    description: 'La montaña más alta. Desde arriba se ve todo el reino… y las cosas que lo miran desde el cielo.',
    unlockConditions: { minLevel: 18 } }, ['ruinas_celestes', 'abismo_sombras', 'desierto_cristal']);
  place({ id: 'fin_mundo', name: 'El Fin del Mundo', biome: 'abyss', tier: [19, 20], pos: { x: 1700, y: 690 }, labelAt: 'b',
    description: 'Acá el mapa termina. El suelo se corta y abajo no hay nada: ni agua, ni fuego, ni fondo.',
    unlockConditions: { minLevel: 19 } }, ['desierto_cristal', 'cumbre_mundo']);

  // ---------------------------------------------------------------
  // 5) Criaturas (nivel 10 a 20)
  //    prof: forma de ser (hp/dmg 0,75..1,35; arm/def/atk suman). base: de quién copia el dibujo.
  // ---------------------------------------------------------------
  const C = (o) => creature(o);
  // Paso de la Bruma (10-12)
  C({ id: 'lobo_bruma', name: 'Lobo de la bruma', tier: 10, family: ['beast'], tags: ['pack'], biome: ['mountain'], speed: 14, regions: ['paso_bruma'],
    base: 'lobo', colors: { b: '#b8c0cc', c: '#e4e8f0', e: '#7ad8ff' }, skills: ['manada', 'mordida'], mats: [['mat_piel_lobo', 0.5], ['mat_colmillo', 0.4]],
    spawn: { min: 1, max: 3, weight: 1.2, groupable: true }, description: 'Aparece y desaparece en la niebla. Cuando lo ves, ya tenés los dientes encima.' });
  C({ id: 'espectro_bruma', name: 'Espectro de la bruma', tier: 11, family: ['undead', 'spirit'], tags: ['ethereal'], biome: ['mountain'], speed: 12, regions: ['paso_bruma'],
    base: 'espectro', colors: { b: '#dfe8f0', c: '#a8c0d8', e: '#ffffff' }, skills: ['etereo', 'miedo', 'drenar'], mats: [['mat_ectoplasma', 0.6]],
    description: 'Viajeros que se perdieron en el paso. Todavía buscan la salida, y te agarran del brazo para que no te vayas.' });
  C({ id: 'grifo_tormenta', name: 'Grifo de la tormenta', category: 'strong', tier: 11, family: ['beast', 'flying'], tags: ['flying'], biome: ['mountain'], speed: 15, regions: ['paso_bruma'],
    base: 'grifo', colors: { b: '#3a4a7a', c: '#ffe070' }, skills: ['vuelo', 'picotazo', 'rafaga'], mats: [['mat_pluma', 0.7], ['mat_chispa_tormenta', 0.4]],
    description: 'Anida en las cumbres donde caen los rayos. Sus plumas chisporrotean.' });
  C({ id: 'gigante_niebla', name: 'Gigante de la niebla', category: 'strong', tier: 12, prof: { hp: 1.25, dmg: 1.1 }, family: ['giant'], tags: ['big'], biome: ['mountain'], speed: 8, regions: ['paso_bruma', 'bosque_petreo'],
    base: 'ogro', colors: { b: '#9aa4b4', c: '#5a6478' }, skills: ['gigante', 'pisoton', 'aguante'], mats: [['mat_hueso', 0.6], ['mat_oricalco', 0.25]],
    description: 'Tan alto que la cabeza le queda en la niebla. Solo ves las piernas… y después el pie.' });
  // Bosque Petrificado (11-13)
  C({ id: 'treant_piedra', name: 'Treant de piedra', tier: 11, prof: { hp: 1.2, dmg: 0.9, arm: 2 }, family: ['plant', 'construct'], tags: ['slow'], biome: ['forest'], speed: 7, regions: ['bosque_petreo'],
    base: 'ent', colors: { b: '#7a7a74', c: '#a8a8a0', a: '#c8c8b8' }, skills: ['piel_gruesa', 'pisoton', 'regeneracion'], mats: [['mat_madera', 0.5], ['mat_oricalco', 0.2]],
    description: 'Un árbol de piedra que todavía camina. Despacio, pero sin parar.' });
  C({ id: 'cocatriz', name: 'Cocatriz', tier: 12, family: ['beast', 'flying'], tags: ['gaze'], biome: ['forest'], speed: 13, regions: ['bosque_petreo'],
    base: 'halcon', colors: { b: '#6a8a3a', c: '#c8a040', e: '#ff4040' }, skills: ['picotazo', 'mirada', 'vuelo'], mats: [['mat_pluma', 0.6], ['mat_ojo_basilisco', 0.2]],
    description: 'Mitad gallo, mitad serpiente. Dicen que los árboles de este bosque la miraron a los ojos.' });
  C({ id: 'basilisco', name: 'Basilisco', category: 'strong', tier: 12, family: ['reptile'], tags: ['gaze', 'poison'], biome: ['forest'], speed: 10, regions: ['bosque_petreo'],
    base: 'naga', colors: { b: '#3a6a3a', c: '#8ac060', e: '#ffd040' }, skills: ['mirada', 'venenoso', 'colmillos_veneno'], mats: [['mat_ojo_basilisco', 0.7], ['mat_escama_ancestral', 0.3]],
    description: 'El rey de las serpientes. Si sostenés su mirada, te volvés parte del paisaje.' });
  C({ id: 'gargola_antigua', name: 'Gárgola antigua', category: 'strong', tier: 13, prof: { arm: 2 }, family: ['construct', 'flying'], tags: ['flying'], biome: ['forest', 'ruins'], speed: 12, regions: ['bosque_petreo'],
    base: 'gargola', colors: { b: '#4a4a52', c: '#7a7a86', e: '#ff7a30' }, skills: ['vuelo', 'piel_gruesa', 'constructo', 'zarpazo'], mats: [['mat_nucleo_golem', 0.3], ['mat_oricalco', 0.35]],
    description: 'Una gárgola tan vieja que ya no recuerda qué cuidaba. Ataca a todo lo que se mueve, por las dudas.' });
  // Tundra Eterna (12-14)
  C({ id: 'lobo_escarcha', name: 'Lobo de escarcha', tier: 12, family: ['beast'], tags: ['pack', 'cold'], biome: ['mountain'], speed: 14, regions: ['tundra_eterna'],
    base: 'huargo', colors: { b: '#e8f0f8', c: '#9ac8e8', e: '#3a8aff' }, skills: ['manada', 'mordida', 'cuerpo_hielo'], mats: [['mat_piel_lobo', 0.6], ['mat_esencia_hielo', 0.3]],
    spawn: { min: 1, max: 3, weight: 1.2, groupable: true }, description: 'Su aliento congela la nieve en el aire. Cazan en manada y no se cansan nunca.' });
  C({ id: 'mamut', name: 'Mamut lanudo', tier: 13, prof: { hp: 1.3, dmg: 1.05 }, family: ['beast'], tags: ['big'], biome: ['mountain'], speed: 8, regions: ['tundra_eterna'],
    base: 'oso', colors: { b: '#6a4a2a', c: '#a07a4a', a: '#f0e8d0' }, skills: ['piel_gruesa', 'embestida', 'pisoton'], mats: [['mat_piel_oso', 0.6], ['mat_cuerno', 0.5], ['carne_gigante', 0.5]],
    description: 'Una montaña de pelo con colmillos. Tranquilo, hasta que no.' });
  C({ id: 'yeti_anciano', name: 'Yeti anciano', category: 'strong', tier: 13, family: ['beast', 'giant'], tags: ['cold'], biome: ['mountain'], speed: 10, regions: ['tundra_eterna'],
    base: 'yeti', colors: { b: '#f4f8fc', c: '#b8c8d8' }, skills: ['gigante', 'aguante', 'rugido', 'cuerpo_hielo'], mats: [['mat_esencia_hielo', 0.5], ['mat_piel_oso', 0.5]],
    description: 'El abuelo de todos los yetis. Tiene cicatrices de cazadores que ya no están.' });
  C({ id: 'elem_ventisca', name: 'Elemental de ventisca', category: 'strong', tier: 14, family: ['elemental'], tags: ['cold'], biome: ['mountain'], speed: 13, regions: ['tundra_eterna'],
    base: 'elem_hielo', colors: { b: '#dff4ff', c: '#7ab8f0', e: '#ffffff' }, skills: ['cuerpo_hielo', 'ventisca', 'esencia'], mats: [['mat_esencia_hielo', 0.8], ['mat_cristal_astral', 0.15]],
    description: 'Una tormenta de nieve que aprendió a odiar.' });
  // Ciénaga Primordial (13-15)
  C({ id: 'gusano_cienaga', name: 'Gusano de la ciénaga', tier: 13, prof: { hp: 1.2 }, family: ['beast'], tags: ['big'], biome: ['swamp'], speed: 8, regions: ['cienaga_primordial'],
    base: 'gusano_arena', colors: { b: '#4a5a2a', c: '#8a9a4a' }, skills: ['piel_gruesa', 'tragar', 'acido'], mats: [['mat_gelatina', 0.5], ['mat_veneno', 0.4]],
    description: 'Sale del barro sin avisar. Lo que traga, no vuelve.' });
  // v3.11.4: era "Hidra joven", pero tenía más nivel que la Hidra del Pantano (9): ahora es una hidra primordial,
  // más vieja que la del Pantano (el id sigue siendo "hidra_joven" para no tocar las partidas guardadas)
  C({ id: 'hidra_joven', name: 'Hidra primordial', category: 'strong', tier: 13, family: ['reptile', 'dragon'], tags: ['poison'], biome: ['swamp'], speed: 10, regions: ['cienaga_primordial'],
    base: 'hidra', colors: { b: '#3a5a2a', c: '#7a9a40' }, skills: ['regeneracion', 'venenoso', 'doble'], mats: [['mat_colmillo_hidra', 0.5], ['mat_escama_ancestral', 0.3]],
    description: 'De las hidras que había antes que los hombres: más grande y más vieja que la del Pantano, con musgo entre las escamas. Muerde con dos cabezas a la vez y se cura sola.' });
  C({ id: 'naga_ancestral', name: 'Naga ancestral', category: 'strong', tier: 14, family: ['reptile', 'humanoid', 'arcane'], tags: ['magic'], biome: ['swamp'], speed: 11, regions: ['cienaga_primordial'],
    base: 'naga', colors: { b: '#2a5a5a', c: '#60c0b0', a: '#e0c060' }, skills: ['mente_arcana', 'hechizo', 'colmillos_veneno', 'agarre'], mats: [['mat_escama_sirena', 0.5], ['mat_gema_arcana', 0.35]],
    description: 'Una reina serpiente que habla con voz de agua. Sus hechizos son tan viejos como la ciénaga.' });
  C({ id: 'lodo_primordial', name: 'Lodo primordial', tier: 15, prof: { hp: 1.3, dmg: 0.85 }, family: ['ooze'], tags: ['acid'], biome: ['swamp'], speed: 6, regions: ['cienaga_primordial'],
    base: 'slime', colors: { b: '#3a4a1a', c: '#7a8a2a', e: '#ffe070' }, skills: ['gelatinoso', 'acido', 'regeneracion'], mats: [['mat_gelatina', 0.8]],
    description: 'La primera cosa viva del mundo. No tiene apuro: tiene hambre.' });
  // Ruinas Celestes (14-16)
  C({ id: 'guardian_celeste', name: 'Guardián celeste', category: 'strong', tier: 14, prof: { arm: 2, hp: 1.1 }, family: ['construct'], tags: ['guard'], biome: ['ruins'], speed: 9, regions: ['ruinas_celestes'],
    base: 'golem', colors: { b: '#e8e0d0', c: '#ffffff', a: '#e0c060', e: '#7ad8ff' }, skills: ['constructo', 'guardia', 'piel_gruesa'], mats: [['mat_nucleo_golem', 0.4], ['mat_cristal_astral', 0.25]],
    description: 'Lo hicieron para cuidar una ciudad que ya no existe. Sigue cumpliendo.' });
  C({ id: 'elem_arcano_mayor', name: 'Elemental arcano mayor', tier: 15, family: ['elemental', 'arcane'], tags: ['magic'], biome: ['ruins', 'arcane'], speed: 12, regions: ['ruinas_celestes'],
    base: 'elem_arcano', colors: { b: '#8a5ae0', c: '#e0c8ff', e: '#ffffff' }, skills: ['esencia', 'hechizo', 'antimagia'], mats: [['mat_gema_arcana', 0.6], ['mat_cristal_astral', 0.2]],
    description: 'Magia pura con forma de remolino. Se come los hechizos que le tirás.' });
  C({ id: 'angel_caido', name: 'Ángel caído', category: 'strong', tier: 15, family: ['humanoid', 'celestial', 'flying'], tags: ['magic', 'flying'], biome: ['ruins'], speed: 13, regions: ['ruinas_celestes', 'abismo_sombras'],
    base: 'sucubo', colors: { b: '#d8d0e0', c: '#3a2a4a', a: '#e0c060' }, skills: ['vuelo', 'hechizo', 'maldicion'], mats: [['mat_pluma_angel', 0.6], ['mat_esencia_sombra', 0.3]],
    description: 'Cuidaba la ciudad del cielo. Cuando cayó la ciudad, cayó con ella… y algo se le rompió por dentro.' });
  C({ id: 'esfinge', name: 'Esfinge', category: 'strong', tier: 16, family: ['beast', 'arcane', 'flying'], tags: ['flying'], biome: ['ruins', 'desert'], speed: 12, regions: ['ruinas_celestes'],
    base: 'manticora', colors: { b: '#d8b060', c: '#f0d890', a: '#3a6ab0' }, skills: ['vuelo', 'mirada', 'encantar'], mats: [['mat_melena_quimera', 0.4], ['mat_topacio', 0.4]],
    description: 'Cuerpo de león, alas de águila y una pregunta que nadie supo contestar.' });
  // Desierto de Cristal (15-17)
  C({ id: 'escorpion_cristal', name: 'Escorpión de cristal', tier: 15, prof: { arm: 2 }, family: ['insect'], tags: ['poison'], biome: ['desert'], speed: 12, regions: ['desierto_cristal'],
    base: 'escorpion', colors: { b: '#a8d8f0', c: '#ffffff', e: '#ff4080' }, skills: ['picadura', 'caparazon'], mats: [['mat_cristal_astral', 0.3], ['mat_veneno', 0.5]],
    spawn: { min: 1, max: 3, weight: 1.1, groupable: true }, description: 'Transparente como el vidrio. Lo ves cuando ya te picó.' });
  C({ id: 'golem_cristal', name: 'Gólem de cristal', category: 'strong', tier: 16, prof: { arm: 3, dmg: 0.95 }, family: ['construct'], tags: ['slow'], biome: ['desert'], speed: 8, regions: ['desierto_cristal'],
    base: 'golem', colors: { b: '#a8d8f0', c: '#e8f8ff', e: '#7ad8ff' }, skills: ['constructo', 'destello', 'piel_gruesa'], mats: [['mat_cristal_astral', 0.5], ['mat_nucleo_golem', 0.4]],
    description: 'Un gigante de vidrio que junta el sol y te lo tira a los ojos.' });
  C({ id: 'djinn', name: 'Djinn', category: 'strong', tier: 16, family: ['elemental', 'arcane'], tags: ['magic'], biome: ['desert'], speed: 14, regions: ['desierto_cristal'],
    base: 'mago_oscuro', colors: { b: '#3ab0c0', c: '#e0c060', a: '#ffffff' }, skills: ['hechizo', 'rafaga', 'ilusion'], mats: [['mat_gema_arcana', 0.5], ['mat_topacio', 0.4]],
    description: 'Un espíritu del viento del desierto. No concede deseos: los cobra.' });
  C({ id: 'gusano_cristal', name: 'Gran gusano de cristal', category: 'strong', tier: 17, prof: { hp: 1.25 }, family: ['beast'], tags: ['big'], biome: ['desert'], speed: 9, regions: ['desierto_cristal'],
    base: 'gusano_arena', colors: { b: '#a8d0e8', c: '#ffffff' }, skills: ['tragar', 'terremoto', 'piel_gruesa'], mats: [['mat_cristal_astral', 0.5]],
    description: 'Nada bajo el vidrio como si fuera agua. Cuando sale, la arena llueve en pedazos.' });
  // Abismo de las Sombras (16-18)
  C({ id: 'sombra_viviente', name: 'Sombra viviente', tier: 16, family: ['spirit', 'undead'], tags: ['ethereal', 'dark'], biome: ['crypt'], speed: 13, regions: ['abismo_sombras'],
    base: 'fantasma', colors: { b: '#1a1420', c: '#4a3a5a', e: '#c090ff' }, skills: ['etereo', 'oscuridad', 'drenar'], mats: [['mat_esencia_sombra', 0.6]],
    spawn: { min: 1, max: 3, weight: 1.1, groupable: true }, description: 'La sombra de alguien que ya no está. Se te pega a los pies y te chupa el calor.' });
  C({ id: 'caballero_abismo', name: 'Caballero del abismo', category: 'strong', tier: 17, prof: { arm: 2 }, family: ['undead', 'humanoid'], tags: ['armored'], biome: ['crypt'], speed: 10, regions: ['abismo_sombras'],
    base: 'cab_muerte', colors: { b: '#2a1e3a', c: '#7a5aa0', e: '#c090ff' }, skills: ['no_muerto', 'guardia', 'aturdir'], mats: [['mat_esencia_sombra', 0.5], ['mat_acero', 0.5]],
    description: 'Juró defender el abismo y cumplió: ni la muerte lo sacó de ahí.' });
  C({ id: 'devorador_almas', name: 'Devorador de almas', tier: 17, family: ['aberration'], tags: ['gaze'], biome: ['crypt'], speed: 11, regions: ['abismo_sombras'],
    base: 'contemplador', colors: { b: '#3a1a3a', c: '#a03a6a', e: '#ffe070' }, skills: ['abismal', 'mirada', 'drenar', 'miedo'], mats: [['mat_ojo_magico', 0.6], ['mat_esencia_vacio', 0.1]],
    description: 'Un ojo con hambre. Lo que mira, se apaga un poco.' });
  C({ id: 'demonio_sombras', name: 'Demonio de las sombras', category: 'strong', tier: 17, // v3.11.5: era 18 (el Demonio mayor, jefe, es 18) family: ['demon'], tags: ['dark'], biome: ['crypt', 'hell'], speed: 12, regions: ['abismo_sombras'],
    base: 'demonio_mayor', colors: { b: '#2a1a3a', c: '#6a3a8a', e: '#ff3a3a' }, skills: ['oscuridad', 'miedo', 'cuerpo_fuego'], mats: [['mat_cuerno_demonio', 0.6], ['mat_esencia_sombra', 0.5], ['mat_esencia_vacio', 0.12]],
    description: 'Un demonio hecho de oscuridad. Donde pisa, las antorchas se apagan.' });
  // Cumbre del Mundo (18-20)
  C({ id: 'roc', name: 'Roc', tier: 18, prof: { hp: 1.15 }, family: ['beast', 'flying'], tags: ['flying', 'big'], biome: ['mountain'], speed: 15, regions: ['cumbre_mundo'],
    base: 'aguila', colors: { b: '#6a4a2a', c: '#e0c080', a: '#f0a020' }, skills: ['vuelo', 'picotazo', 'rafaga'], mats: [['mat_pluma', 0.8], ['carne_ave', 0.6]],
    description: 'Un pájaro tan grande que caza mamuts. Para él, vos sos una lombriz.' });
  C({ id: 'titan_celeste', name: 'Titán celeste', category: 'strong', tier: 18, // v3.11.5: era 19 (el Titán, jefe, es 19) prof: { hp: 1.2 }, family: ['giant', 'celestial'], tags: ['big'], biome: ['mountain'], speed: 8, regions: ['cumbre_mundo'],
    base: 'titan', colors: { b: '#e8e0d0', c: '#ffffff', a: '#e0c060' }, skills: ['gigante', 'terremoto', 'aguante'], mats: [['mat_cristal_astral', 0.5], ['mat_escama_ancestral', 0.3]],
    description: 'Uno de los que sostienen el cielo. Bajó a ver quién hace tanto ruido.' });
  C({ id: 'dragon_tormenta', name: 'Dragón de la tormenta', category: 'strong', tier: 18, // v3.11.5: era 19 (Dragón anciano 19, Alamuerte 20) family: ['dragon', 'flying'], tags: ['flying', 'storm'], biome: ['mountain'], speed: 14, regions: ['cumbre_mundo'],
    base: 'dragon_joven', colors: { b: '#2a3a7a', c: '#7a9ae0', e: '#fff070' }, skills: ['vuelo', 'rafaga', 'barrido', 'aliento_hielo'], mats: [['mat_escama_ancestral', 0.6], ['mat_chispa_tormenta', 0.6], ['carne_dragon', 0.5]],
    description: 'Vuela dentro de las nubes de tormenta. Cuando ruge, cae un rayo.' });
  // El Fin del Mundo (19-20)
  C({ id: 'horror_vacio', name: 'Horror del vacío', category: 'strong', tier: 19, family: ['aberration'], tags: ['void'], biome: ['abyss'], speed: 11, regions: ['fin_mundo'],
    base: 'contemplador', colors: { b: '#0e0a16', c: '#4a2a7a', e: '#7affb0' }, skills: ['abismal', 'mirada', 'vision_abismo'], mats: [['mat_esencia_vacio', 0.35]],
    description: 'No tiene forma fija. Mirarlo cansa, y pensar en él, más.' });
  C({ id: 'sierpe_vacio', name: 'Sierpe del vacío', tier: 20, family: ['aberration', 'reptile'], tags: ['void'], biome: ['abyss'], speed: 12, regions: ['fin_mundo'],
    base: 'serp_marina', colors: { b: '#16101e', c: '#5a3a8a', e: '#c090ff' }, skills: ['agarre', 'tragar', 'abismal'], mats: [['mat_esencia_vacio', 0.3], ['mat_escama_ancestral', 0.4]],
    description: 'Nada en la nada. Se enrosca en lo que encuentra y lo arrastra hacia abajo.' });
  C({ id: 'heraldo_vacio', name: 'Heraldo del vacío', category: 'strong', tier: 20, family: ['humanoid', 'arcane'], tags: ['magic', 'void'], biome: ['abyss'], speed: 12, regions: ['fin_mundo'],
    base: 'mago_oscuro', colors: { b: '#1a1426', c: '#6a4aa0', a: '#c090ff' }, skills: ['mente_arcana', 'hechizo', 'maldicion', 'antimagia'], mats: [['mat_esencia_vacio', 0.4], ['mat_gema_arcana', 0.5]],
    description: 'Anuncia la llegada del Devorador. Tiene la voz de todos los que se tragó.' });

  // ---------------------------------------------------------------
  // 6) Los jefes de las Tierras Altas y sus guaridas
  // ---------------------------------------------------------------
  const BOSS = (o) => creature(Object.assign({ category: 'boss', autoLoot: false, spawn: { min: 1, max: 1, weight: 1, groupable: false } }, o));
  BOSS({ id: 'fenix_ancestral', name: 'Fénix Ancestral', tier: 12, prof: { hp: 0.7 }, family: ['beast', 'flying', 'elemental'], tags: ['fire', 'flying'], biome: ['forest'], speed: 15,
    base: 'fenix', colors: { b: '#fff4c0', c: '#ffb030', a: '#ff6a20' }, skills: ['vuelo', 'cuerpo_fuego', 'aliento_fuego', 'renacer', 'enfurecer'],
    mats: [['corazon_fenix', 1], ['mat_ceniza_fenix', 0.9], ['espada_fenix', 0.25], ['mat_oricalco', 0.6]],
    description: 'El primer fénix. Quemó el bosque una vez, hace mil años, y lo volvió piedra. Cuando cae, renace.' });
  BOSS({ id: 'rey_escarcha', name: 'Rey de la Escarcha', tier: 14, prof: { hp: 0.95 }, family: ['undead', 'humanoid'], tags: ['cold', 'leader'], biome: ['mountain'], speed: 10,
    base: 'cab_muerte', colors: { b: '#c8e4f8', c: '#5a8ac0', a: '#ffffff', e: '#3ad8ff' }, skills: ['cuerpo_hielo', 'ventisca', 'aliento_hielo', 'invocar', 'enfurecer'],
    summons: { id: 'lobo_escarcha', count: 1 },
    mats: [['corona_escarcha', 1], ['mat_esencia_hielo', 0.9], ['lanza_escarcha', 0.25], ['mat_cristal_astral', 0.5]],
    description: 'Un rey que se negó a morir y se congeló en su trono. Sus lobos todavía le obedecen.' });
  BOSS({ id: 'golem_primordial', name: 'Gólem Primordial', tier: 16, prof: { hp: 1.05, arm: 1 }, family: ['construct', 'giant'], tags: ['big'], biome: ['desert'], speed: 7,
    base: 'golem_lava', colors: { b: '#5a4a3a', c: '#ffb030', e: '#fff070' }, skills: ['constructo', 'gigante', 'terremoto', 'pisoton', 'aguante', 'enfurecer'],
    mats: [['nucleo_primordial', 1], ['mat_nucleo_golem', 0.9], ['martillo_primordial', 0.25], ['mat_cristal_astral', 0.6]],
    description: 'El primero de todos los gólems, hecho cuando la tierra todavía estaba caliente. Despertó con hambre de piedra.' });
  BOSS({ id: 'reina_sombras', name: 'Reina de las Sombras', tier: 18, family: ['humanoid', 'arcane', 'spirit'], tags: ['dark', 'magic'], biome: ['crypt'], speed: 13,
    base: 'bruja', colors: { b: '#2a1e2e', c: '#6a3a9a', a: '#c090ff', e: '#ff4080' }, skills: ['ilusion', 'oscuridad', 'maldicion', 'miedo', 'invocar', 'enfurecer'],
    summons: { id: 'sombra_viviente', count: 2 },
    mats: [['velo_sombras', 1], ['mat_esencia_sombra', 0.9], ['guadana_sombras', 0.25], ['mat_esencia_vacio', 0.4]],
    description: 'Gobierna todo lo que no tiene luz. Sus súbditos son sombras de gente que se animó a entrar.' });
  BOSS({ id: 'devorador', name: 'El Devorador de Mundos', tier: 20, prof: { hp: 1.1, dmg: 1.0 }, family: ['aberration', 'giant', 'legendary'], tags: ['void', 'ancient'], biome: ['abyss'], speed: 10,
    base: 'cthulhu', colors: { b: '#120c1a', c: '#4a2a7a', a: '#7affb0', e: '#ff3a3a' }, skills: ['abismal', 'gigante', 'vision_abismo', 'agarre', 'terremoto', 'invocar', 'enfurecer'],
    summons: { id: 'horror_vacio', count: 1, hp: 0.6 },
    mats: [['fin_del_mundo', 0.5], ['cetro_vacio', 0.5], ['coraza_ancestral', 0.3], ['manto_vacio', 0.3], ['mat_esencia_vacio', 1]],
    description: 'Ya se comió otros mundos. Dormía al borde de este, esperando que alguien lo despertara.' });

  const lair = S.lair;
  if (lair) {
    lair({ id: 'nido_fenix', name: 'Nido del Fénix', boss: 'fenix_ancestral', parents: ['bosque_petreo'], biome: 'volcano', pos: { x: 1345, y: 130 }, labelAt: 'l',
      description: 'Un nido de piedra en el árbol más alto del bosque petrificado. El aire tiembla de calor.' });
    lair({ id: 'trono_escarcha', name: 'Trono de Escarcha', boss: 'rey_escarcha', parents: ['tundra_eterna'], biome: 'mountain', pos: { x: 1500, y: 42 }, labelAt: 'l',
      description: 'Un palacio de hielo azul. En el trono, un rey cubierto de escarcha abre los ojos.' });
    lair({ id: 'forja_primordial', name: 'Forja Primordial', boss: 'golem_primordial', parents: ['desierto_cristal'], biome: 'volcano', pos: { x: 1530, y: 640 }, labelAt: 'b',
      description: 'Un horno del tamaño de una montaña, apagado hace mil años. Algo adentro se mueve.' });
    lair({ id: 'palacio_sombras', name: 'Palacio de las Sombras', boss: 'reina_sombras', parents: ['abismo_sombras'], biome: 'crypt', pos: { x: 1780, y: 90 }, labelAt: 'l',
      description: 'Un palacio que solo se ve con los ojos cerrados. Adentro, la Reina te estaba esperando.' });
    lair({ id: 'trono_vacio', name: 'Trono del Vacío', boss: 'devorador', parents: ['fin_mundo'], biome: 'abyss', pos: { x: 1610, y: 790 }, labelAt: 'l',
      description: 'Una plataforma de piedra sobre la nada. Cuatro huecos en el suelo esperan sus sellos.',
      altar: { name: 'Los cuatro sellos', items: [['corazon_fenix', 1], ['corona_escarcha', 1], ['nucleo_primordial', 1], ['velo_sombras', 1]],
        text: 'El Devorador duerme del otro lado. Para despertarlo, poné los cuatro sellos de los jefes de las Tierras Altas: el Corazón del Fénix, la Corona de escarcha, el Núcleo primordial y el Velo de las sombras.' } });
  }

  // ---------------------------------------------------------------
  // 7) La gente del Bastión del Alba
  // ---------------------------------------------------------------
  const npc = (o) => { if (!byId(S.npcs, o.id)) S.npcs.push(Object.assign({ icon: '', sprite: '', services: {}, _source: 'v311' }, o)); };
  npc({ id: 'npc_herrera_bastion', name: 'Brunhild la herrera', role: 'blacksmith', roleName: 'Herrera', region: 'bastion_alba',
    dialog: ['El oricalco no se dobla: se doma.', 'Traeme cristal astral y te hago algo que brille de verdad.', 'Más allá de la Bruma, el acero común es papel.'],
    sells: ['espada_oricalco', 'hacha_oricalco', 'martillo_oricalco', 'lanza_oricalco', 'arco_oricalco', 'daga_oricalco', 'placa_oricalco', 'cuero_oricalco',
      'espada_astral', 'hacha_astral', 'martillo_astral', 'lanza_astral', 'arco_astral', 'daga_astral', 'placa_astral', 'malla_astral', 'mat_oricalco'],
    crafts: ['forge'] });
  npc({ id: 'npc_sabia_bastion', name: 'Seren la sabia', role: 'sage', roleName: 'Sabia', region: 'bastion_alba',
    dialog: ['Allá arriba la magia es más vieja. Y más hambrienta.', 'Te enseño lo que sé si tu maná aguanta.', 'El Devorador no es un cuento. Ojalá lo fuera.'],
    sells: ['pocion_curacion_suprema', 'pocion_mana_suprema', 'baston_oricalco', 'tunica_bruma', 'baston_astral', 'manto_astral', 'mat_gema_arcana'],
    teaches: ['rayo_estelar', 'meteoro', 'curacion_suprema', 'juicio_divino', 'ventisca_eterna', 'tormenta_vacio'],
    crafts: ['enchant', 'alchemy'] });
  npc({ id: 'npc_posadero_bastion', name: 'Odo el posadero', role: 'tavernkeeper', roleName: 'Posadero', region: 'bastion_alba',
    dialog: ['Cama caliente y sopa espesa: lo único que no cambia en las Tierras Altas.', 'Los que vuelven de la Cumbre no hablan mucho.', 'Si vas al Fin del Mundo, pagá la cuenta antes.'],
    sells: ['pan', 'queso', 'carne_seca', 'pocion_curacion_mayor', 'pocion_mana', 'hierba_vida', 'pocion_curacion_suprema'],
    services: { restCost: 400 }, crafts: ['alchemy'] });

  // ---------------------------------------------------------------
  // 8) Recetas: el equipo del alba se forja (no se vende) y el elixir se prepara
  // ---------------------------------------------------------------
  const recipe = (o) => { if (!byId(S.recipes, o.id)) S.recipes.push(Object.assign({ _source: 'v311' }, o)); };
  const ALBA = [['espada_alba', 'forge'], ['hacha_alba', 'forge'], ['martillo_alba', 'forge'], ['lanza_alba', 'forge'], ['arco_alba', 'forge'], ['daga_alba', 'forge'],
    ['placa_alba', 'forge'], ['escamas_alba', 'forge'], ['baston_alba', 'enchant'], ['vestiduras_alba', 'enchant']];
  for (const [id, workshop] of ALBA) {
    const w = byId(S.weapons, id) || byId(S.armors, id);
    if (!w) continue;
    recipe({ id: `r_${id}`, name: w.name, result: id, workshop, tier: 18,
      ingredients: [{ itemId: 'mat_cristal_astral', qty: 3 }, { itemId: 'mat_esencia_vacio', qty: 1 }, { itemId: 'mat_oricalco', qty: 4 }],
      description: 'Oricalco templado con cristal astral y una gota de vacío.' });
  }
  recipe({ id: 'r_elixir_vida', name: 'Elixir de vida', result: 'elixir_vida', workshop: 'alchemy', tier: 17,
    ingredients: [{ itemId: 'hierba_vida', qty: 3 }, { itemId: 'mat_ceniza_fenix', qty: 1 }, { itemId: 'mat_cristal_astral', qty: 1 }],
    description: 'Tres hierbas de la vida, ceniza de fénix y un cristal que guarda la luz.' });
})(window.Aventurs);
