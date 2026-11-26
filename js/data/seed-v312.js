/* ============================================================
   Aventurs — v3.12: el Cielo, el Espacio y el Infierno profundo
   - El tope de nivel sube a 25. Más allá de las Tierras Altas hay tres
     reinos sin pueblos (todo lo que vive ahí es enemigo):
       · El Cielo (desde la Cumbre del Mundo): los nueve coros de ángeles,
         en sus tres jerarquías, y Dios en la Cuna del Sol.
       · El Espacio (desde la Cumbre del Mundo): alienígenas, robots y la
         Mente Colmena en el corazón de la nave nodriza.
       · El Infierno profundo (desde el Fin del Mundo): los siete pecados,
         el Cancerbero, el barquero del Estigia y Satanás en su trono.
     Ninguno es "el jefe final": el juego va a seguir creciendo.
   - Zonas que estaban casi vacías (el Abismo Marino, el Fondo del Volcán, el Nido
     de Dragones…) ahora tienen criaturas propias, con habilidades nuevas;
     y las que no tenían nada que ver con su zona se mudaron.
   - Equipo estelar (21, se vende en el Bastión), del crepúsculo (23) y
     eterno (25), los dos últimos se forjan. Hechizos y pociones nuevas.
   - Tres armas legendarias: Agonía de Escarcha, Martillo Maldito y Crematoria.
   - Los materiales valen según el nivel de la criatura más fácil que los suelta.
   Se carga después de seed-v311-alto.js.
   ============================================================ */

(function (A) {
  'use strict';

  const S = A.Seed || (A.Seed = {});
  const B = A.Balance;
  const byId = (list, id) => (list || []).find((x) => x && x.id === id);
  const uniq = (arr) => [...new Set(arr)];
  for (const k of ['regions', 'enemies', 'items', 'weapons', 'armors', 'spells', 'npcs', 'recipes']) S[k] = S[k] || [];
  const SRC = 'v312';

  // ---------------------------------------------------------------
  // Ayudas (las mismas de seed-v311-alto.js)
  // ---------------------------------------------------------------
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
    S.regions.push(Object.assign({ type: 'combat', distance: 2, icon: '', labelAt: 'b', encounter: ENC(), connections: [], _source: SRC }, r));
    for (const l of links) link(r.id, l);
  }
  function curve(tier, cat, prof = {}) {
    const st = B.enemyStats(tier, cat, prof);
    return { health: st.health, damage: st.damage, armor: Math.max(0, st.armor + (prof.arm || 0)), attack: Math.max(0, st.attack + (prof.atk || 0)), difficulty: st.difficulty + (prof.def || 0) };
  }
  /** Una criatura nueva. base: de quién copia el dibujo (una criatura o una raza de los héroes); colors: su paleta; shape: su forma. */
  function creature(o) {
    if (byId(S.enemies, o.id)) return byId(S.enemies, o.id);
    const cat = o.category || 'normal';
    const e = Object.assign({
      icon: '', category: cat, tags: [], biome: [], speed: 10, regions: [],
      spawn: { min: 1, max: cat === 'normal' ? 2 : 1, weight: 1, groupable: cat !== 'boss' },
      tameable: false, autoLoot: cat !== 'boss', _source: SRC,
    }, curve(o.tier, cat, o.prof || {}), o);
    if (o.base || o.colors || o.shape) e.sprite = Object.assign({ t: o.base }, o.colors || {}, o.shape ? { o: o.shape } : {});
    delete e.prof; delete e.base; delete e.colors; delete e.mats; delete e.shape;
    e.drops = [B.Economy.coinDrop(e)].concat((o.mats || []).map(([itemId, chance]) => ({ itemId, chance, source: SRC })));
    S.enemies.push(e);
    return e;
  }
  const C = (o) => creature(o);
  const BOSS = (o) => creature(Object.assign({ category: 'boss', autoLoot: false, spawn: { min: 1, max: 1, weight: 1, groupable: false } }, o));
  const item = (o) => { if (!byId(S.items, o.id)) S.items.push(Object.assign({ type: 'item', icon: '', weight: 0, stack: 99, _source: SRC }, o)); };
  const weapon = (o) => {
    if (byId(S.weapons, o.id)) return;
    S.weapons.push(Object.assign({ type: 'weapon', icon: '', magic: false, value: B.Economy.gearPrice(o.tier, o.rarity, 'weapon'), alto: true, _source: SRC }, o));
  };
  const armor = (o) => {
    if (byId(S.armors, o.id)) return;
    S.armors.push(Object.assign({ type: 'armor', icon: '', magic: false, value: B.Economy.gearPrice(o.tier, o.rarity, 'armor'), alto: true, _source: SRC }, o));
  };
  const spell = (o) => { if (!byId(S.spells, o.id)) S.spells.push(Object.assign({ icon: '', _source: SRC }, o)); };
  const recipe = (o) => { if (!byId(S.recipes, o.id)) S.recipes.push(Object.assign({ _source: SRC }, o)); };
  /** Que una criatura suelte algo (sin repetir). */
  function drop(enemyId, itemId, chance) {
    const e = byId(S.enemies, enemyId);
    if (!e) return;
    e.drops = (e.drops || []).filter((d) => d.itemId !== itemId).concat([{ itemId, chance, source: SRC }]);
  }
  /** Cambia las zonas donde vive una criatura. */
  function regionsOf(id, fn) {
    const e = byId(S.enemies, id);
    if (e) e.regions = uniq(fn((e.regions || []).slice()));
  }
  const setTier = (id, tier) => { const r = byId(S.regions, id); if (r) r.tier = tier; };

  // ---------------------------------------------------------------
  // 1) Materiales, pociones y lo que sueltan los jefes nuevos
  // ---------------------------------------------------------------
  item({ id: 'mat_metal_estelar', name: 'Metal estelar', subtype: 'material', rarity: 'rare', value: 0,
    description: 'Un metal que no figura en ningún libro: cayó del cielo o vino en una nave. Liviano, frío y casi imposible de rayar.' });
  item({ id: 'mat_luz_sagrada', name: 'Luz sagrada', subtype: 'material', rarity: 'epic', value: 0,
    description: 'Un poco de luz que no se apaga nunca, guardada en un frasco. Calienta las manos y el corazón.' });
  item({ id: 'mat_hierro_infernal', name: 'Hierro infernal', subtype: 'material', rarity: 'epic', value: 0,
    description: 'Hierro forjado en el fondo del infierno. Siempre está tibio y huele a azufre.' });
  item({ id: 'mat_esencia_pecado', name: 'Esencia de pecado', subtype: 'material', rarity: 'rare', value: 0,
    description: 'Un frasquito con algo espeso y oscuro. Dicen que cada pecado tiene su color.' });
  item({ id: 'pocion_curacion_divina', name: 'Poción de curación divina', subtype: 'potion', rarity: 'epic', tier: 21, value: 2800, weight: 1,
    effect: { type: 'heal', amount: '8d10+30' }, description: 'Blanca y tibia, con una luz que se mueve adentro. Cierra cualquier herida.' });
  item({ id: 'pocion_mana_divina', name: 'Poción de maná divina', subtype: 'potion', rarity: 'epic', tier: 21, value: 2600, weight: 1,
    effect: { type: 'mana', amount: '7d8+20' }, description: 'Azul como el cielo de noche, con estrellas que suben como burbujas.' });
  item({ id: 'elixir_eterno', name: 'Elixir eterno', subtype: 'potion', rarity: 'legendary', tier: 24, value: 9000, weight: 1,
    effect: { type: 'heal', amount: '12d10+60' }, description: 'Una gota de luz, una de fuego y una de estrellas. Dicen que quien lo toma no envejece ese día.' });

  // ---------------------------------------------------------------
  // 2) Equipo de nivel 21 a 25
  //    Estelar (21, épico, se vende en el Bastión) · Del crepúsculo (23, épico, se forja con luz y fuego)
  //    Eterno (25, épico, se forja con los tres reinos) · de los jefes (legendario)
  //    Las armas legendarias: Agonía de Escarcha (Rey de la Escarcha), Martillo Maldito (Titán), Crematoria (Dios).
  // ---------------------------------------------------------------
  const W = [
    // [id, nombre, dado, peso, extra]
    ['espada_estelar', 'Espada estelar', '6d8+2', 3, { tier: 21, rarity: 'epic' }],
    ['hacha_estelar', 'Hacha estelar', '6d10', 6, { tier: 21, rarity: 'epic' }],
    ['martillo_estelar', 'Martillo estelar', '7d8+1', 8, { tier: 21, rarity: 'epic' }],
    ['lanza_estelar', 'Lanza estelar', '6d8+3', 5, { tier: 21, rarity: 'epic' }],
    ['arco_estelar', 'Arco estelar', '6d8+1', 2, { tier: 21, rarity: 'epic' }],
    ['daga_estelar', 'Daga estelar', '6d6+4', 1, { tier: 21, rarity: 'epic' }],
    ['baston_estelar', 'Bastón estelar', '6d6+3', 2, { tier: 21, rarity: 'epic', magic: true }],
    ['espada_crepusculo', 'Espada del crepúsculo', '6d8+5', 3, { tier: 23, rarity: 'epic' }],
    ['hacha_crepusculo', 'Hacha del crepúsculo', '6d10+3', 6, { tier: 23, rarity: 'epic' }],
    ['martillo_crepusculo', 'Martillo del crepúsculo', '7d8+4', 8, { tier: 23, rarity: 'epic' }],
    ['lanza_crepusculo', 'Lanza del crepúsculo', '6d8+6', 5, { tier: 23, rarity: 'epic' }],
    ['arco_crepusculo', 'Arco del crepúsculo', '6d8+4', 2, { tier: 23, rarity: 'epic' }],
    ['daga_crepusculo', 'Daga del crepúsculo', '6d6+7', 1, { tier: 23, rarity: 'epic' }],
    ['baston_crepusculo', 'Bastón del crepúsculo', '6d6+6', 2, { tier: 23, rarity: 'epic', magic: true }],
    ['espada_eterna', 'Espada eterna', '7d8+3', 3, { tier: 25, rarity: 'epic' }],
    ['hacha_eterna', 'Hacha eterna', '7d10', 6, { tier: 25, rarity: 'epic' }],
    ['martillo_eterno', 'Martillo eterno', '8d8+2', 8, { tier: 25, rarity: 'epic' }],
    ['lanza_eterna', 'Lanza eterna', '7d8+4', 5, { tier: 25, rarity: 'epic' }],
    ['arco_eterno', 'Arco eterno', '7d8+2', 2, { tier: 25, rarity: 'epic' }],
    ['daga_eterna', 'Daga eterna', '7d6+6', 1, { tier: 25, rarity: 'epic' }],
    ['baston_eterno', 'Bastón eterno', '7d6+5', 2, { tier: 25, rarity: 'epic', magic: true }],
    // de los jefes
    ['tridente_infernal', 'Tridente infernal', '7d8+6', 5, { tier: 25, rarity: 'legendary', statusEffect: { type: 'fire', chance: 0.35, turns: 3, value: 7 } }],
    ['baston_colmena', 'Bastón de la colmena', '7d6+8', 2, { tier: 25, rarity: 'legendary', magic: true, spellBonus: 2 }],
    // las legendarias (lo suyo: bane, drain y chain, ver combat.js)
    ['agonia_escarcha', 'Agonía de Escarcha', '4d8+5', 4, { tier: 15, rarity: 'legendary', statusEffect: { type: 'cold', chance: 0.3, turns: 2, value: 4 }, drain: 0.15 }],
    ['martillo_maldito', 'Martillo Maldito', '6d8+5', 8, { tier: 20, rarity: 'legendary', statusEffect: { type: 'shock', chance: 0.3, turns: 2, value: 5 }, chain: 10 }],
    ['crematoria', 'Crematoria', '7d8+8', 4, { tier: 25, rarity: 'legendary', statusEffect: { type: 'fire', chance: 0.3, turns: 3, value: 7 },
      bane: { families: ['undead', 'demon'], bonus: 8, label: 'Crematoria' } }],
  ];
  const DESC = {
    estelar: 'Forjada con metal estelar. Brilla con una luz fría, como las estrellas que la vieron caer.',
    crepusculo: 'Templada con luz del cielo y fuego del infierno a la vez. Tiene un color que no es de día ni de noche.',
    eterna: 'Hecha con lo mejor de los tres reinos. No se mella, no se oxida y no se olvida.',
    eterno: 'Hecho con lo mejor de los tres reinos. No se mella, no se oxida y no se olvida.',
    tridente_infernal: 'El tridente de Satanás. Las heridas que deja siguen ardiendo.',
    baston_colmena: 'Un bastón que piensa. Cuando lanzás un hechizo, sentís que te ayuda a apuntar.',
    agonia_escarcha: 'Una espada de hielo negro con runas que brillan azul. Cada herida que hace congela… y le devuelve a quien la empuña un poco de vida robada.',
    martillo_maldito: 'Un martillo de piedra negra que retumba como un trueno. Cuando pega, un rayo salta a otro enemigo.',
    crematoria: 'Una espada dorada que arde con fuego sagrado. Los no muertos y los demonios le temen: contra ellos pega mucho más fuerte.',
  };
  for (const [id, name, damage, weight, extra] of W) {
    const kind = id.split('_').slice(1).join('_');
    weapon(Object.assign({ id, name, damage, weight, description: DESC[id] || DESC[kind] || '' }, extra));
  }
  const ARM = [
    // [id, nombre, armadura, esquiva, peso, extra]
    ['placa_estelar', 'Placa estelar', 12, 1, 7, { tier: 21, rarity: 'epic' }],
    ['malla_estelar', 'Malla estelar', 10, 3, 4, { tier: 21, rarity: 'epic' }],
    ['tunica_estelar', 'Túnica estelar', 8, 5, 1, { tier: 21, rarity: 'epic', magic: true, mana: 24 }],
    ['placa_crepusculo', 'Placa del crepúsculo', 13, 1, 7, { tier: 23, rarity: 'epic' }],
    ['malla_crepusculo', 'Malla del crepúsculo', 11, 3, 4, { tier: 23, rarity: 'epic' }],
    ['manto_crepusculo', 'Manto del crepúsculo', 9, 6, 1, { tier: 23, rarity: 'epic', magic: true, mana: 28 }],
    ['placa_eterna', 'Placa eterna', 14, 2, 7, { tier: 25, rarity: 'epic' }],
    ['malla_eterna', 'Malla eterna', 12, 4, 4, { tier: 25, rarity: 'epic' }],
    ['manto_eterno', 'Manto eterno', 10, 6, 1, { tier: 25, rarity: 'epic', magic: true, mana: 32 }],
    // de los jefes
    ['coraza_infernal', 'Coraza infernal', 15, 2, 7, { tier: 25, rarity: 'legendary' }],
    ['traje_estelar', 'Traje de la colmena', 13, 5, 3, { tier: 25, rarity: 'legendary' }],
    ['manto_sol', 'Manto del sol', 11, 7, 1, { tier: 25, rarity: 'legendary', magic: true, mana: 40 }],
  ];
  const ADESC = {
    estelar: 'Placas de metal estelar: frías al tacto y más duras que cualquier cosa de este mundo.',
    crepusculo: 'Luz y fuego trabajados juntos. Brilla dorada de un lado y roja del otro.',
    eterna: 'Hecha con lo mejor de los tres reinos. Lo que la golpea, rebota.',
    eterno: 'Tejido con hilos de luz, de fuego y de estrellas. Casi no pesa.',
    coraza_infernal: 'La armadura de los guardias de Satanás. Quema a quien la mira, no a quien la lleva.',
    traje_estelar: 'Un traje que se ajusta solo al cuerpo y endurece donde lo van a golpear.',
    manto_sol: 'Un manto tejido con rayos de sol. Abriga, protege y llena de magia.',
  };
  for (const [id, name, def, dodge, weight, extra] of ARM) {
    const kind = Object.keys(ADESC).find((k) => id === k) || Object.keys(ADESC).find((k) => id.endsWith(k));
    armor(Object.assign({ id, name, defense: def, dodge, weight, description: ADESC[id] || ADESC[kind] || '' }, extra));
  }

  // ---------------------------------------------------------------
  // 3) Hechizos nuevos (los enseña Seren, la sabia del Bastión)
  // ---------------------------------------------------------------
  spell({ id: 'lanza_luz', name: 'Lanza de luz', iconName: 'sun', damage: '6d8+3', manaCost: 20, tier: 21, school: 'holy', cooldown: 1,
    description: 'Una lanza de luz contra un enemigo.' });
  spell({ id: 'lluvia_estrellas', name: 'Lluvia de estrellas', iconName: 'stars', damage: '5d6', manaCost: 26, tier: 22, school: 'arcane', area: true, mageOnly: true, cooldown: 3,
    description: 'Caen estrellas sobre todos tus enemigos. Solo para magos.' });
  spell({ id: 'curacion_divina', name: 'Curación divina', iconName: 'heal', heal: '6d8+12', manaCost: 26, tier: 23, school: 'holy', cooldown: 4,
    description: 'Una luz del cielo más alto cierra tus heridas.' });
  spell({ id: 'llamas_infierno', name: 'Llamas del infierno', iconName: 'fireball', damage: '5d6+3', manaCost: 30, tier: 24, school: 'fire', area: true, mageOnly: true, cooldown: 3,
    statusEffect: { type: 'fire', chance: 0.3, turns: 2, value: 5 }, description: 'Fuego del fondo del infierno sobre todos tus enemigos. Solo para magos.' });
  spell({ id: 'singularidad', name: 'Singularidad', iconName: 'arcane', damage: '7d8', manaCost: 34, tier: 25, school: 'arcane', mageOnly: true, cooldown: 3,
    description: 'Un punto negro que se traga la luz… y un pedazo enorme de un enemigo. Solo para magos.' });

  // ---------------------------------------------------------------
  // 4) Zonas que estaban vacías o con criaturas que no tenían nada que ver
  // ---------------------------------------------------------------
  // Se mudan (cada una se queda donde tiene sentido)
  regionsOf('contemplador', (l) => l.filter((r) => r !== 'abismo_marino'));      // es de las ruinas arcanas
  regionsOf('cab_muerte', (l) => l.filter((r) => r !== 'infierno'));             // es de las catacumbas y la fortaleza
  regionsOf('sucubo', (l) => l.filter((r) => r !== 'jardin_carmesi').concat(['infierno'])); // es un demonio
  regionsOf('golem', (l) => l.filter((r) => r !== 'picos_helados'));             // de piedra: en las cuevas
  regionsOf('golem_lava', (l) => l.filter((r) => r !== 'ruinas_perdidas'));      // de lava: en el volcán
  regionsOf('aguila', (l) => l.filter((r) => r !== 'puerto'));                   // en el puerto, gaviotas
  regionsOf('serp_marina', (l) => l.concat(['abismo_marino']));
  regionsOf('dragon_joven', (l) => l.concat(['nido_de_dragones']));
  // El necrófago come muertos: del Pantano a las Ruinas de Antorcha, con los nigromantes (sube al 5)
  {
    const g = byId(S.enemies, 'necrofago');
    if (g && g.tier === 4) Object.assign(g, curve(5, 'normal'), { tier: 5, regions: ['ruinas_antorcha'] });
  }
  // Para que entren los que se mudaron
  setTier('infierno', [7, 10]);
  setTier('abismo_marino', [7, 10]);
  setTier('nido_de_dragones', [8, 10]);

  // Abismo Marino (7-10)
  C({ id: 'pez_abisal', name: 'Pez abisal', tier: 8, family: ['beast', 'aquatic'], tags: ['light'], biome: ['abyss'], speed: 12, regions: ['abismo_marino'],
    base: 'tiburon', colors: { b: '#1a2238', c: '#3a4a6a', e: '#7affff' }, skills: ['emboscada', 'destello', 'mordida'], mats: [['mat_diente_tiburon', 0.5], ['perla_pequeña', 0.25]],
    spawn: { min: 1, max: 3, weight: 1.1, groupable: true },
    description: 'Un pez negro con una lucecita colgando delante de la boca. Si seguís la luz, la boca te sigue a vos.' });
  C({ id: 'medusa_abisal', name: 'Medusa abisal', tier: 8, prof: { hp: 0.9 }, family: ['beast', 'aquatic'], tags: ['poison'], biome: ['abyss'], speed: 9, regions: ['abismo_marino'],
    base: 'fantasma', colors: { b: '#8a5ac8', c: '#e0b8ff', e: '#ffffff' }, skills: ['gelatinoso', 'espinas', 'paralizar'], mats: [['mat_gelatina', 0.6], ['mat_veneno', 0.35]],
    description: 'Flota en la oscuridad como una lámpara rota. Si la tocás, te quema; si te toca, te deja duro.' });
  C({ id: 'calamar_gigante', name: 'Calamar gigante', category: 'strong', tier: 9, family: ['beast', 'aquatic'], tags: ['big'], biome: ['abyss'], speed: 11, regions: ['abismo_marino'],
    base: 'tentaculo', colors: { b: '#a03a3a', c: '#e07a6a', e: '#ffee00' }, skills: ['sumergirse', 'agarre', 'nube_tinta'], mats: [['mat_tinta_kraken', 0.35], ['mat_perla', 0.2]],
    description: 'Te agarra con un brazo, te tira tinta con otro y se hunde con los otros ocho. Cuando hay otros con él, no lo alcanzás nunca.' });
  C({ id: 'cangrejo_abisal', name: 'Cangrejo abisal', tier: 9, prof: { hp: 1.1, arm: 2, dmg: 0.9 }, family: ['beast', 'aquatic'], tags: ['armored'], biome: ['abyss'], speed: 7, regions: ['abismo_marino'],
    base: 'cangrejo', colors: { b: '#3a3a5a', c: '#6a6a9a', a: '#c0c0e0', e: '#7affff' }, skills: ['caparazon', 'piel_gruesa', 'agarre'], mats: [['mat_caparazon', 0.6], ['mat_perla', 0.25]],
    description: 'Del tamaño de un carro, con un caparazón que nunca vio el sol. Sus pinzas parten anclas.' });
  C({ id: 'sacerdote_profundo', name: 'Sacerdote profundo', category: 'strong', tier: 10, prof: { hp: 0.9, dmg: 0.9 }, family: ['humanoid', 'aquatic', 'arcane'], tags: ['magic'], biome: ['abyss'], speed: 10, regions: ['abismo_marino'],
    base: 'profundo', colors: { b: '#2a5a6a', c: '#3a2a5a', a: '#e0c060', e: '#7affb0' }, shape: { weapon: 'staff', cloak: true },
    skills: ['mente_arcana', 'curar_aliados', 'hechizo', 'maldicion', 'invocar'], summons: { id: 'pez_abisal', count: 1 },
    mats: [['mat_escama_sirena', 0.4], ['mat_gema_arcana', 0.3], ['idolo_rlyeh', 0.08]],
    description: 'Le reza a algo que duerme en el fondo. Cuando reza, el agua se enfría, los peces vienen y las heridas de los suyos se cierran.' });

  // Fondo del Volcán (7-10; el id sigue siendo 'infierno')
  C({ id: 'sabueso_infernal', name: 'Sabueso infernal', tier: 8, family: ['beast', 'demon'], tags: ['fire', 'pack'], biome: ['hell'], speed: 14, regions: ['infierno'],
    base: 'huargo', colors: { b: '#3a1a14', c: '#7a2a1a', a: '#ffb040', e: '#ff6a00' }, skills: ['manada', 'cuerpo_fuego', 'mordida'], mats: [['mat_colmillo', 0.5], ['fragmento_lava', 0.4]],
    spawn: { min: 1, max: 3, weight: 1.2, groupable: true },
    description: 'Los perros del infierno. Huelen el miedo, cazan en jauría y escupen brasas cuando ladran.' });
  C({ id: 'alma_condenada', name: 'Alma condenada', tier: 8, family: ['spirit', 'undead'], tags: ['ethereal'], biome: ['hell'], speed: 11, regions: ['infierno'],
    base: 'aparicion', colors: { b: '#5a2a2a', c: '#a05a4a', e: '#ffcc40' }, skills: ['etereo', 'drenar', 'chillido'], mats: [['mat_ectoplasma', 0.6], ['mat_esencia', 0.3]],
    description: 'Alguien que no pagó lo que debía. Arrastra sus cadenas y te pide, llorando, que lo acompañes.' });
  C({ id: 'demonio_menor', name: 'Demonio menor', tier: 9, family: ['demon'], tags: ['fire'], biome: ['hell'], speed: 12, regions: ['infierno'],
    base: 'diablillo', colors: { b: '#8a2a1a', c: '#3a0a0a', e: '#ffd040' }, shape: { size: 'small', weapon: 'none', claws: true },
    skills: ['estallido', 'zarpazo', 'ignifugo'], mats: [['mat_cuerno_demonio', 0.25], ['mat_cola_diablillo', 0.5], ['sello_infernal', 0.04]],
    description: 'Un diablillo que creció. Tiene tanto fuego adentro que, cuando muere, revienta.' });
  C({ id: 'torturador', name: 'Torturador', category: 'strong', tier: 10, prof: { hp: 0.9, dmg: 0.9 }, family: ['demon', 'humanoid'], tags: ['fire'], biome: ['hell'], speed: 9, regions: ['infierno'],
    base: 'demonio_mayor', colors: { b: '#6a3a3a', c: '#2a1a1a', e: '#ff3020' }, shape: { size: 'large', wings: false, weapon: 'whip', hat: 'hood' },
    skills: ['pacto_sangre', 'agarre', 'aturdir'], mats: [['mat_cuerno_demonio', 0.4], ['mat_cuerda', 0.5], ['sello_infernal', 0.06]],
    description: 'Se encarga de que nadie se vaya del infierno antes de tiempo. Lo que te saca de sangre, se lo queda.' });

  // Nido de Dragones (8-10)
  C({ id: 'cultista_dragon', name: 'Cultista del dragón', tier: 9, family: ['humanoid', 'arcane'], tags: ['magic', 'fire'], biome: ['lair'], speed: 11, regions: ['nido_de_dragones'],
    base: 'mago_oscuro', colors: { b: '#c89070', c: '#8a1a1a', a: '#ffb030', e: '#ff6a00' }, shape: { hat: 'hood' },
    skills: ['valiente', 'curar_aliados', 'hechizo', 'grito'], mats: [['mat_escama_dragon', 0.3], ['mat_tela', 0.5], ['mat_sangre_dragon', 0.12]],
    description: 'Le reza a los dragones y les cura las heridas en plena pelea. A cambio, espera que no se lo coman.' });
  C({ id: 'dragon_rojo', name: 'Dragón rojo', category: 'strong', tier: 10, prof: { hp: 0.9, dmg: 0.9 }, family: ['dragon', 'flying'], tags: ['fire', 'flying'], biome: ['lair'], speed: 13, regions: ['nido_de_dragones'],
    base: 'dragon_joven', colors: { b: '#b02a1a', c: '#f07a3a', e: '#ffee00' }, skills: ['vuelo', 'aliento_fuego', 'ignifugo', 'barrido'],
    mats: [['mat_escama_dragon', 0.7], ['mat_sangre_dragon', 0.4], ['carne_dragon', 0.5]],
    description: 'Un dragón adulto, todavía no anciano. Cuida el nido como si fueran sus monedas, y escupe fuego antes de preguntar.' });

  // Pantano (3-4)
  C({ id: 'fuego_fatuo', name: 'Fuego fatuo', category: 'weak', tier: 4, family: ['spirit'], tags: ['ethereal', 'light'], biome: ['swamp'], speed: 13, regions: ['pantano'], time: 'night',
    base: 'chispa_arcana', colors: { b: '#3a8a6a', c: '#9affc0', e: '#ffffff' }, skills: ['etereo', 'destello', 'estallido'], mats: [['polvo_arcano', 0.4], ['hongo_luminoso', 0.4]],
    description: 'Una lucecita que flota sobre el agua y te invita a seguirla. Si la apagás, revienta.' });
  C({ id: 'sanguijuela_gigante', name: 'Sanguijuela gigante', tier: 3, family: ['beast'], tags: ['blood'], biome: ['swamp'], speed: 8, regions: ['pantano'],
    base: 'gusano_arena', colors: { b: '#3a2a2a', c: '#6a4a3a', e: '#ff3030' }, skills: ['beber_sangre', 'escurridizo'], mats: [['vial_sangre', 0.3], ['mat_gelatina', 0.4]],
    description: 'Larga como un brazo y con hambre de sangre. Se te pega cuando cruzás el agua y no se suelta.' });

  // Puerto (3)
  C({ id: 'gaviota_ladrona', name: 'Gaviota ladrona', category: 'weak', tier: 3, family: ['beast', 'flying'], tags: ['flying'], biome: ['coast'], speed: 15, regions: ['puerto'],
    base: 'halcon', colors: { b: '#e8e8e0', c: '#ffffff', a: '#f0c030', e: '#101010', wg: '#9aa0a8' }, skills: ['vuelo', 'robar', 'picotazo'],
    mats: [['mat_pluma', 0.6], ['moneda_antigua', 0.08]], spawn: { min: 1, max: 3, weight: 1.2, groupable: true },
    description: 'Grita, te roba el almuerzo y se va volando. A veces se lleva también la bolsa de monedas.' });

  // Catacumbas (7-8)
  C({ id: 'momia_real', name: 'Momia real', category: 'strong', tier: 8, family: ['undead', 'humanoid'], tags: ['curse'], biome: ['crypt'], speed: 8, regions: ['catacumbas'],
    base: 'momia', colors: { b: '#c8b080', c: '#a08850', a: '#e0c040', e: '#40a0ff' }, shape: { hat: 'crown', weapon: 'staff' },
    skills: ['no_muerto', 'maldicion', 'invocar', 'lider'], summons: { id: 'momia', count: 1 },
    mats: [['mat_vendaje', 0.7], ['moneda_antigua', 0.4], ['mat_oro', 0.1]],
    description: 'Un rey que se hizo vendar para no irse nunca. Sus sirvientes todavía le obedecen y se levantan cuando los llama.' });

  // Cumbre del Mundo (18-20) y El Fin del Mundo (19-20)
  C({ id: 'elem_rayo', name: 'Elemental del rayo', category: 'strong', tier: 19, prof: { dmg: 0.9 }, family: ['elemental'], tags: ['storm', 'shock'], biome: ['mountain'], speed: 15, regions: ['cumbre_mundo'],
    base: 'elem_arcano', colors: { b: '#3a5aa0', c: '#fff070', e: '#ffffff' }, skills: ['esencia', 'hechizo', 'rafaga', 'estallido'],
    mats: [['mat_chispa_tormenta', 0.8], ['mat_cristal_astral', 0.2]],
    description: 'Una tormenta con forma de persona. Donde pisa, se te pone el pelo de punta; cuando cae, revienta en chispas.' });
  C({ id: 'eco_vacio', name: 'Eco del vacío', tier: 19, prof: { hp: 0.85 }, family: ['spirit', 'aberration'], tags: ['void', 'ethereal'], biome: ['abyss'], speed: 12, regions: ['fin_mundo'],
    base: 'fantasma', colors: { b: '#1a1426', c: '#4a3a6a', e: '#c090ff' }, skills: ['etereo', 'dividirse', 'vision_abismo'],
    mats: [['mat_esencia_vacio', 0.2], ['mat_ectoplasma', 0.5]],
    description: 'Lo que queda de algo que el Devorador se comió. Si lo partís, se vuelve dos.' });

  // ---------------------------------------------------------------
  // 5) Los tres reinos: lugares
  // ---------------------------------------------------------------
  // El Cielo (arriba)
  place({ id: 'puertas_cielo', name: 'Puertas del Cielo', biome: 'sky', tier: [21, 22], pos: { x: 1935, y: 255 }, labelAt: 'b',
    description: 'Una escalera de nubes sube desde la Cumbre del Mundo hasta un portón de luz. Del otro lado no hay pueblos ni amigos: los ángeles ponen a prueba a todo el que llega.',
    unlockConditions: { minLevel: 21 } }, ['cumbre_mundo']);
  place({ id: 'salones_luz', name: 'Salones de la Luz', biome: 'sky', tier: [22, 24], pos: { x: 2090, y: 150 }, labelAt: 'b',
    description: 'Salones sin techo, con columnas de luz sólida. Acá viven los coros del medio: los que mandan, los que curan y los que pelean contra el infierno.',
    unlockConditions: { minLevel: 23 } }, ['puertas_cielo']);
  place({ id: 'empireo', name: 'El Empíreo', biome: 'sky', tier: [24, 25], pos: { x: 2250, y: 95 }, labelAt: 'b',
    description: 'El cielo más alto, donde la luz no deja sombra. Ruedas de fuego llenas de ojos, leones con alas y ángeles que arden.',
    unlockConditions: { minLevel: 24 } }, ['salones_luz']);
  // El Espacio (en el medio)
  place({ id: 'camino_estrellas', name: 'Camino de las Estrellas', biome: 'space', tier: [21, 22], pos: { x: 1955, y: 440 }, labelAt: 'b',
    description: 'Desde la Cumbre del Mundo, un sendero de polvo de estrellas sube y sube hasta que el cielo se pone negro. No hay aire, pero de alguna forma respirás.',
    unlockConditions: { minLevel: 21 } }, ['cumbre_mundo']);
  place({ id: 'luna_rota', name: 'La Luna Rota', biome: 'space', tier: [21, 24], pos: { x: 2120, y: 380 }, labelAt: 'b',
    description: 'Una luna partida en pedazos que flotan. Entre las grietas anidan cosas que no son de este mundo.',
    unlockConditions: { minLevel: 22 } }, ['camino_estrellas']);
  place({ id: 'nave_nodriza', name: 'La Nave Nodriza', biome: 'space', tier: [23, 25], pos: { x: 2270, y: 470 }, labelAt: 'b',
    description: 'Una nave más grande que una ciudad, con luces que parpadean y pasillos que zumban. Todos los de adentro piensan lo mismo al mismo tiempo.',
    unlockConditions: { minLevel: 24 } }, ['luna_rota']);
  // El Infierno profundo (abajo)
  place({ id: 'rio_estigia', name: 'Río Estigia', biome: 'hell', tier: [21, 22], pos: { x: 1915, y: 655 }, labelAt: 'b',
    description: 'Desde el Fin del Mundo se baja y se baja hasta un río negro que no refleja nada. Del otro lado empieza el infierno de verdad.',
    unlockConditions: { minLevel: 21 } }, ['fin_mundo']);
  place({ id: 'circulo_pecados', name: 'Círculo de los Pecados', biome: 'hell', tier: [22, 24], pos: { x: 2075, y: 730 }, labelAt: 'b',
    description: 'Siete círculos de piedra, uno adentro del otro. En cada uno manda un pecado distinto, y cada pecado tiene su demonio.',
    unlockConditions: { minLevel: 22 } }, ['rio_estigia']);
  place({ id: 'ciudad_dite', name: 'Ciudad de Dite', biome: 'hell', tier: [24, 25], pos: { x: 2240, y: 655 }, labelAt: 'b',
    description: 'Una ciudad de murallas al rojo vivo. Las torres echan humo y las calles están hechas de brasas.',
    unlockConditions: { minLevel: 24 } }, ['circulo_pecados']);

  // ---------------------------------------------------------------
  // 6) Las criaturas de los reinos (nivel 21 a 25)
  // ---------------------------------------------------------------
  // ----- El Cielo: los nueve coros, en sus tres jerarquías. No te odian: te ponen a prueba. -----
  const ANGEL = 'angel';
  // Tercera jerarquía (Puertas del Cielo): Ángeles, Arcángeles y Principados
  C({ id: 'angel_coro', name: 'Ángel', tier: 21, family: ['celestial', 'humanoid', 'flying'], tags: ['holy', 'flying'], biome: ['sky'], speed: 13, regions: ['puertas_cielo'],
    base: ANGEL, shape: { weapon: 'spear' }, skills: ['vuelo', 'escudo_fe', 'juicio'], mats: [['mat_pluma_angel', 0.3], ['mat_luz_sagrada', 0.15]],
    description: 'El más chico de los coros, y el más cercano a la gente. No te odia: te pone a prueba, y te mira con pena mientras te pega.' });
  C({ id: 'arcangel', name: 'Arcángel', category: 'strong', tier: 22, family: ['celestial', 'humanoid', 'flying'], tags: ['holy', 'flying'], biome: ['sky'], speed: 13, regions: ['puertas_cielo'],
    base: ANGEL, colors: { m: '#e8c860', a: '#e8c860' }, shape: { size: 'large', outfit: 'armor', lower: 'legs', weapon: 'bigsword' },
    skills: ['vuelo', 'escudo_fe', 'barrido', 'valiente'], mats: [['mat_pluma_angel', 0.4], ['mat_luz_sagrada', 0.25], ['mat_oro', 0.2]],
    description: 'Los generales del cielo. Pelean con espadas de fuego y no retroceden nunca.' });
  C({ id: 'principado', name: 'Principado', tier: 22, family: ['celestial', 'humanoid', 'flying'], tags: ['holy', 'flying'], biome: ['sky'], speed: 12, regions: ['puertas_cielo', 'salones_luz'],
    base: ANGEL, colors: { c: '#e8d8f8', a: '#c090ff' }, shape: { hat: 'crown', weapon: 'staff' },
    skills: ['vuelo', 'curar_aliados', 'grito'], mats: [['mat_pluma_angel', 0.35], ['mat_luz_sagrada', 0.2], ['cristal_mana', 0.4]],
    description: 'Cuidan reinos y pueblos enteros. Cuando hay otros ángeles cerca, los cura y los anima.' });
  // Segunda jerarquía (Salones de la Luz): Potestades, Virtudes y Dominaciones
  C({ id: 'potestad', name: 'Potestad', category: 'strong', tier: 23, prof: { arm: 1 }, family: ['celestial', 'humanoid'], tags: ['holy', 'armored'], biome: ['sky'], speed: 11, regions: ['salones_luz'],
    base: ANGEL, colors: { m: '#c8d0e0', a: '#e0c060', c: '#3a5aa0' }, shape: { outfit: 'armor', lower: 'legs', hat: 'helmet', weapon: 'hammer', shield: 'kite' },
    skills: ['escudo_fe', 'aturdir', 'juicio', 'pureza'], mats: [['mat_luz_sagrada', 0.3], ['mat_plata', 0.5]],
    description: 'Los guardianes de la frontera entre el cielo y el infierno. Te pegan como si fueras un demonio, por las dudas.' });
  C({ id: 'virtud', name: 'Virtud', tier: 23, family: ['celestial', 'humanoid', 'flying'], tags: ['holy', 'flying'], biome: ['sky'], speed: 12, regions: ['salones_luz'],
    base: ANGEL, colors: { c: '#d8f8e8', a: '#80e0a0', g: '#c0ffd0' }, shape: { weapon: 'wand' },
    skills: ['vuelo', 'regeneracion_divina', 'curar_aliados', 'destello'], mats: [['mat_luz_sagrada', 0.3], ['hierba_vida', 0.4]],
    description: 'Hace milagros. Por donde pasa crecen flores y se cierran las heridas… las de los suyos.' });
  C({ id: 'dominacion', name: 'Dominación', category: 'strong', tier: 24, prof: { dmg: 0.9 }, family: ['celestial', 'humanoid', 'flying'], tags: ['holy', 'leader'], biome: ['sky'], speed: 12, regions: ['salones_luz', 'empireo'],
    base: ANGEL, colors: { c: '#6a3aa0', cl2: '#3a2060', m: '#e0c060', a: '#e0c060' }, shape: { hat: 'crown', outfit: 'armor', lower: 'legs', weapon: 'sword', cloak: true },
    skills: ['lider', 'invocar', 'juicio', 'escudo_fe'], summons: { id: 'angel_coro', count: 1, hp: 0.6 },
    mats: [['mat_luz_sagrada', 0.35], ['mat_oro', 0.3]],
    description: 'Dan las órdenes a los ángeles de abajo. Con un gesto, llaman a otro para que te pruebe.' });
  // Primera jerarquía (El Empíreo): Tronos, Querubines y Serafines
  C({ id: 'trono', name: 'Trono', category: 'strong', tier: 24, prof: { dmg: 0.92 }, family: ['celestial', 'arcane'], tags: ['holy', 'gaze', 'fire'], biome: ['sky'], speed: 10, regions: ['empireo'],
    base: 'contemplador', colors: { b: '#e0b040', c: '#fff0a0', tc: '#ffffff', e: '#3a6aff' },
    skills: ['antimagia', 'cuerpo_fuego', 'juicio', 'escudo_fe'], mats: [['mat_luz_sagrada', 0.4], ['mat_ojo_magico', 0.4]],
    description: 'Una rueda de fuego dentro de otra rueda, llena de ojos. No tiene boca: te juzga con la mirada, y cuando te mira, tu magia se calla.' });
  C({ id: 'querubin', name: 'Querubín', category: 'strong', tier: 25, prof: { dmg: 0.9 }, family: ['celestial', 'beast', 'flying'], tags: ['holy', 'flying', 'guard'], biome: ['sky'], speed: 13, regions: ['empireo'],
    base: 'manticora', colors: { b: '#e0c070', c: '#fff0c0', h: '#f0d090', wg: '#ffffff', a: '#ffffff', e: '#3a6ab8' }, shape: { wings: 'feather', tail: 'bushy' },
    skills: ['vuelo', 'guardia', 'barrido', 'escudo_fe', 'rugido'], mats: [['mat_luz_sagrada', 0.45], ['mat_pluma_angel', 0.5], ['mat_melena_quimera', 0.3]],
    description: 'León, toro, águila y hombre a la vez. Cuida la puerta del jardín más viejo del mundo y no deja pasar a nadie.' });
  C({ id: 'serafin', name: 'Serafín', category: 'strong', tier: 25, prof: { hp: 0.9, dmg: 0.85 }, family: ['celestial', 'humanoid', 'flying', 'elemental'], tags: ['holy', 'fire', 'flying'], biome: ['sky'], speed: 14, regions: ['empireo'],
    base: ANGEL, colors: { b: '#fff0c0', h: '#ffb030', c: '#ff8a30', cl2: '#c04a10', wg: '#ffd060', a: '#fff070', f: '#ffd040', e: '#ffffff' }, shape: { size: 'large', fire: true, eyes: 'glow', weapon: 'none' },
    skills: ['vuelo', 'cuerpo_fuego', 'gracia_sol', 'juicio'], mats: [['mat_luz_sagrada', 0.5], ['mat_pluma_angel', 0.6], ['mat_ceniza_fenix', 0.2]],
    description: 'Los que arden. Tienen seis alas, y con dos se tapan la cara, porque ni ellos se animan a mirar lo que cuidan.' });

  // ----- El Espacio -----
  C({ id: 'gris', name: 'Alienígena gris', tier: 21, family: ['humanoid', 'arcane', 'alien'], tags: ['magic'], biome: ['space'], speed: 12, regions: ['camino_estrellas', 'luna_rota'],
    base: 'alienigena', colors: { b: '#a8b0b8', c: '#3a3a4a', e: '#101010' }, shape: { weapon: 'gun' },
    skills: ['mente_arcana', 'telepatia', 'abduccion', 'disparo'], mats: [['mat_metal_estelar', 0.3], ['cristal_mana', 0.3]],
    description: 'Cabeza grande, ojos negros y un aparato que brilla. Te mira como vos mirarías un bicho raro.' });
  C({ id: 'dron', name: 'Dron explorador', category: 'weak', tier: 21, family: ['construct', 'alien'], tags: ['flying'], biome: ['space'], speed: 15, regions: ['camino_estrellas'],
    base: 'robot', colors: { a: '#40e0ff', e: '#ff3030', m: '#9aa4b4' }, shape: { size: 'small', weapon: 'gun' },
    skills: ['constructo', 'campo_fuerza', 'disparo'], mats: [['mat_metal_estelar', 0.4], ['bateria_runica', 0.3]],
    spawn: { min: 1, max: 3, weight: 1.1, groupable: true },
    description: 'Una bola de metal que vuela, te saca fotos y después te dispara. Un campo que zumba lo protege de los primeros golpes.' });
  C({ id: 'medusa_estelar', name: 'Medusa estelar', tier: 22, prof: { hp: 0.9 }, family: ['beast', 'alien'], tags: ['flying', 'light'], biome: ['space'], speed: 11, regions: ['camino_estrellas'],
    base: 'fantasma', colors: { b: '#3a2a8a', c: '#a0e0ff', e: '#ffffff' }, skills: ['vuelo', 'paralizar', 'estallido'],
    mats: [['mat_gelatina', 0.6], ['mat_cristal_astral', 0.2]],
    description: 'Flota entre las estrellas comiendo luz. Si la reventás, revienta con vos cerca.' });
  C({ id: 'larva_colmena', name: 'Larva de la colmena', tier: 22, family: ['beast', 'insect', 'alien'], tags: ['acid'], biome: ['space'], speed: 8, regions: ['luna_rota'],
    base: 'gusano_arena', colors: { b: '#6a8a3a', c: '#c0e080', e: '#ff40ff' }, skills: ['dividirse', 'acido'],
    mats: [['mat_gelatina', 0.6], ['mat_veneno', 0.4]],
    description: 'Blanda, babosa y con hambre. Si la partís al medio, ahora tenés dos.' });
  C({ id: 'cazador_estelar', name: 'Cazador estelar', category: 'strong', tier: 22, family: ['humanoid', 'alien'], tags: ['hunter'], biome: ['space'], speed: 14, regions: ['luna_rota'],
    base: 'hombre_lagarto', colors: { b: '#5a6a4a', c: '#3a3a3a', a: '#c0c0c0', e: '#ff3030' }, shape: { weapon: 'spear', mask: true },
    skills: ['emboscada', 'ilusion', 'zarpazo', 'disparo'], mats: [['mat_metal_estelar', 0.35], ['mat_garra', 0.6], ['mat_colmillo', 0.4]],
    description: 'Viaja de mundo en mundo buscando la presa más difícil. Se vuelve invisible, te espera y salta. Esta vez la presa sos vos.' });
  C({ id: 'soldado_colmena', name: 'Soldado de la colmena', tier: 23, family: ['insect', 'alien'], tags: ['pack'], biome: ['space'], speed: 12, regions: ['luna_rota', 'nave_nodriza'],
    base: 'escorpion', colors: { b: '#2a3a2a', c: '#5a7a4a', a: '#c0ff40', e: '#ff40ff' }, skills: ['manada', 'caparazon', 'picadura'],
    mats: [['mat_caparazon', 0.5], ['mat_metal_estelar', 0.15]], spawn: { min: 1, max: 3, weight: 1.2, groupable: true },
    description: 'Uno solo no es nada. Pero nunca viene uno solo.' });
  C({ id: 'gusano_lunar', name: 'Gusano lunar', category: 'strong', tier: 23, prof: { hp: 1.25 }, family: ['beast', 'alien'], tags: ['big'], biome: ['space'], speed: 9, regions: ['luna_rota'],
    base: 'gusano_arena', colors: { b: '#9a9aa8', c: '#d8d8e0', e: '#7affff' }, skills: ['piel_gruesa', 'tragar', 'terremoto'],
    mats: [['fragmento_cuarzo', 0.6], ['mat_cristal_astral', 0.3]],
    description: 'Nada bajo el polvo de la luna. Cuando sale, la luna tiembla.' });
  C({ id: 'robot_centinela', name: 'Robot centinela', category: 'strong', tier: 24, prof: { arm: 2, dmg: 0.92 }, family: ['construct', 'alien'], tags: ['armored'], biome: ['space'], speed: 9, regions: ['nave_nodriza'],
    base: 'robot', colors: { m: '#5a6070', c: '#3a404a', a: '#ff3030', g: '#ff3030', e: '#ff3030' }, shape: { size: 'large', weapon: 'gun' },
    skills: ['constructo', 'campo_fuerza', 'rayo_desintegrador'], mats: [['mat_metal_estelar', 0.55], ['bateria_runica', 0.4]],
    description: 'Cuida la nave nodriza. No duerme, no come y no falla dos veces.' });
  C({ id: 'comandante_gris', name: 'Comandante gris', category: 'strong', tier: 24, prof: { dmg: 0.92 }, family: ['humanoid', 'arcane', 'alien'], tags: ['magic', 'leader'], biome: ['space'], speed: 12, regions: ['nave_nodriza'],
    base: 'alienigena', colors: { b: '#8a9aa8', c: '#2a1a4a', cl2: '#1a1030', a: '#e0c060', e: '#101010' }, shape: { cloak: true, weapon: 'gun' },
    skills: ['telepatia', 'antimagia', 'invocar', 'lider'], summons: { id: 'gris', count: 1 },
    mats: [['mat_metal_estelar', 0.45], ['mat_gema_arcana', 0.4]],
    description: 'El que da las órdenes en la nave. Con un aparato te deja sin magia, y nunca pelea solo: llama a otro gris y te lo tira encima.' });

  // ----- El Infierno profundo: el Cancerbero, el barquero y los siete pecados -----
  //   (cada pecado es un demonio, pero se llaman "Pecado de…": así ninguno parece una versión del Demonio mayor, que es jefe de nivel 18)
  C({ id: 'cancerbero', name: 'Cancerbero', category: 'strong', tier: 21, prof: { hp: 1.1 }, family: ['beast', 'demon'], tags: ['fire', 'guard'], biome: ['hell'], speed: 13, regions: ['rio_estigia'],
    base: 'huargo', colors: { b: '#4a2620', c: '#9a4a2a', a: '#ffd040', e: '#ff3010' }, shape: { heads: 3, neck: 1, head: 3.5, snout: 3.2 },
    skills: ['doble', 'cuerpo_fuego', 'rugido', 'mordida'], mats: [['mat_colmillo', 0.7], ['mat_hierro_infernal', 0.2]],
    description: 'El perro de tres cabezas que cuida la entrada. Una duerme, una vigila y la otra tiene hambre.' });
  C({ id: 'barquero', name: 'Barquero del Estigia', tier: 21, family: ['undead', 'humanoid'], tags: ['ethereal'], biome: ['hell'], speed: 10, regions: ['rio_estigia'],
    base: 'lich', colors: { c: '#2a2a3a', e: '#7affb0' }, shape: { hat: 'hood', weapon: 'staff' },
    skills: ['no_muerto', 'drenar', 'aturdir'], mats: [['moneda_antigua', 0.6], ['mat_ectoplasma', 0.4], ['mat_esencia_pecado', 0.1]],
    description: 'Cruza las almas al otro lado del río. Si no tenés con qué pagarle, te cobra de otra forma.' });
  C({ id: 'pecado_pereza', name: 'Pecado de la pereza', tier: 22, prof: { hp: 1.2, dmg: 0.85 }, family: ['demon'], tags: ['sin'], biome: ['hell'], speed: 6, regions: ['rio_estigia', 'circulo_pecados'],
    base: 'demonio_mayor', colors: { b: '#6a7a5a', c: '#3a4a2a', e: '#ffee80' }, shape: { size: 'large', belly: true, wings: false, weapon: 'none' },
    skills: ['bostezo', 'aguante', 'piel_gruesa'], mats: [['mat_esencia_pecado', 0.3], ['mat_cuerno_demonio', 0.3]],
    description: 'Ni se levanta para pelear. Bosteza, y el sueño se te mete en los huesos.' });
  C({ id: 'pecado_gula', name: 'Pecado de la gula', category: 'strong', tier: 22, prof: { hp: 1.25 }, family: ['demon', 'giant'], tags: ['sin', 'big'], biome: ['hell'], speed: 7, regions: ['circulo_pecados'],
    base: 'ogro', colors: { b: '#8a4a3a', c: '#3a2a1a', e: '#ffcc00' }, shape: { belly: true, horns: 'big', mouth: 'teeth' },
    skills: ['tragar', 'pacto_sangre', 'regeneracion'], mats: [['mat_esencia_pecado', 0.35], ['carne_gigante', 0.5]],
    description: 'Come y come y nunca se llena. Si te traga, te digiere peleando; y lo que te saca, lo usa para curarse.' });
  C({ id: 'pecado_avaricia', name: 'Pecado de la avaricia', tier: 23, family: ['demon'], tags: ['sin'], biome: ['hell'], speed: 11, regions: ['circulo_pecados'],
    base: 'demonio_mayor', colors: { b: '#5a4a1a', c: '#7a5a10', a: '#ffd040', m: '#ffd040', e: '#ffee00' }, shape: { size: 'medium', hat: 'crown', wings: false, outfit: 'suit', weapon: 'none' },
    skills: ['robar', 'escudo_oro', 'maldicion'], mats: [['mat_esencia_pecado', 0.35], ['mat_oro', 0.5], ['doblon', 0.6]],
    description: 'Cuenta monedas que no son suyas. Te roba la bolsa y se esconde detrás de una pared de oro.' });
  C({ id: 'pecado_envidia', name: 'Pecado de la envidia', category: 'strong', tier: 23, family: ['demon'], tags: ['sin'], biome: ['hell'], speed: 12, regions: ['circulo_pecados'],
    base: 'demonio_mayor', colors: { b: '#3a6a3a', c: '#1a3a1a', e: '#a0ff40' }, shape: { size: 'medium', outfit: 'robe', lower: 'robe', eyes: 'glow', weapon: 'none' },
    skills: ['espinas', 'maldicion', 'oscuridad'], mats: [['mat_esencia_pecado', 0.4], ['mat_esmeralda', 0.3]],
    description: 'Quiere todo lo que tenés. Cada golpe que le das, te lo devuelve un poco.' });
  C({ id: 'pecado_lujuria', name: 'Pecado de la lujuria', tier: 24, family: ['demon'], tags: ['sin', 'charm'], biome: ['hell'], speed: 13, regions: ['circulo_pecados', 'ciudad_dite'],
    base: 'sucubo', colors: { b: '#a04a7a', c: '#3a1030', e: '#ff80c0' }, skills: ['encantar', 'drenar', 'vuelo', 'ilusion'],
    mats: [['mat_esencia_pecado', 0.4], ['mat_rubi', 0.3]],
    description: 'Te promete lo que más querés y te hace olvidar a qué viniste. Cuando te das cuenta, ya es tarde.' });
  C({ id: 'pecado_ira', name: 'Pecado de la ira', category: 'strong', tier: 24, prof: { dmg: 0.92 }, family: ['demon'], tags: ['sin', 'fire'], biome: ['hell'], speed: 12, regions: ['ciudad_dite'],
    base: 'balrog', colors: { b: '#7a1a0a', e: '#ffee00' }, shape: { size: 'large' },
    skills: ['furia', 'doble', 'cuerpo_fuego', 'rugido'], mats: [['mat_esencia_pecado', 0.45], ['mat_hierro_infernal', 0.3]],
    description: 'Nunca dejó de estar enojado. Cuanto más lo lastimás, más fuerte pega.' });
  C({ id: 'pecado_soberbia', name: 'Pecado de la soberbia', category: 'strong', tier: 25, prof: { dmg: 0.9 }, family: ['demon', 'celestial', 'humanoid'], tags: ['sin', 'leader'], biome: ['hell'], speed: 13, regions: ['ciudad_dite'],
    base: ANGEL, colors: { b: '#d8c8c8', h: '#1a1018', c: '#1a1018', cl2: '#3a1030', wg: '#2a1a2a', a: '#d4af37', e: '#ff2a2a' }, shape: { wings: 'bat', hat: 'crown', horns: 'curved', weapon: 'bigsword' },
    skills: ['valiente', 'lider', 'fuego_infernal', 'juicio'], mats: [['mat_esencia_pecado', 0.5], ['mat_hierro_infernal', 0.35], ['mat_pluma_angel', 0.3]],
    description: 'Fue el más hermoso de los ángeles y todavía se cree mejor que vos. Pelea con la luz que se llevó del cielo y con el fuego que encontró abajo.' });

  // ---------------------------------------------------------------
  // 7) Los tres jefes de los reinos (nivel 25). No son los jefes finales:
  //    como los demás, vuelven al día siguiente, y el juego va a seguir creciendo.
  // ---------------------------------------------------------------
  BOSS({ id: 'dios', name: 'Dios', tier: 25, prof: { hp: 0.75, dmg: 0.85 }, family: ['celestial', 'legendary'], tags: ['holy', 'light', 'ancient'], biome: ['sky'], speed: 14,
    base: ANGEL, colors: { b: '#ffe0c8', h: '#ffd860', c: '#ffffff', cl2: '#f0e0b0', a: '#ffd040', g: '#fff6a0', e: '#7ad8ff', wg: '#ffffff' },
    shape: { size: 'tiny', hair: 'curly', hat: 'halo', outfit: 'robe', lower: 'robe', weapon: 'none', eyes: 'glow', pose: 'up', wings: 'feather' },
    skills: ['regeneracion_divina', 'escudo_fe', 'gracia_sol', 'juicio', 'invocar', 'enfurecer'], summons: { id: 'angel_coro', count: 1, hp: 0.6 },
    defeatText: '{E} deja de brillar, se ríe y aplaude: pasaste la prueba. Mañana te va a estar esperando otra vez.',
    mats: [['crematoria', 0.3], ['manto_sol', 0.3], ['mat_luz_sagrada', 1], ['mat_pluma_angel', 1], ['elixir_eterno', 0.5]],
    description: 'Tiene la forma de un bebé que se ríe, pero en sus manitos cabe toda la luz del mundo. Brilla como el sol del mediodía y sus heridas se cierran solas. No es una pelea para ganar: es una prueba, para ver si sos digno.' });
  BOSS({ id: 'satanas', name: 'Satanás', tier: 25, prof: { hp: 1.0, dmg: 0.95 }, family: ['demon', 'giant', 'legendary'], tags: ['fire', 'ancient'], biome: ['hell'], speed: 12,
    base: 'demonio_mayor', colors: { b: '#8a0a0a', c: '#1a0505', wg: '#2a0505', a: '#d4af37', h: '#0a0505', e: '#ffd040', f: '#ff4010' }, shape: { hat: 'crown', weapon: 'trident', fire: true },
    skills: ['cuerpo_fuego', 'fuego_infernal', 'pacto_sangre', 'miedo', 'invocar', 'enfurecer'], summons: { id: 'cancerbero', count: 1, hp: 0.5 },
    defeatText: '{E} cae de rodillas y se hunde en su propio fuego. Desde abajo se escucha su risa: "Volvé mañana".',
    mats: [['tridente_infernal', 0.3], ['coraza_infernal', 0.3], ['mat_hierro_infernal', 1], ['mat_esencia_pecado', 1], ['elixir_eterno', 0.5]],
    description: 'El señor del infierno profundo. Sentado en un trono de huesos y brasas, espera a los que se creen más fuertes que él. Lo que te saca de vida, se lo queda.' });
  BOSS({ id: 'mente_colmena', name: 'La Mente Colmena', tier: 25, prof: { hp: 1.2, dmg: 0.9 }, family: ['aberration', 'alien', 'legendary'], tags: ['magic', 'ancient'], biome: ['space'], speed: 11,
    base: 'contemplador', colors: { b: '#d080a0', c: '#f0b0c8', tc: '#ffffff', e: '#40ff80' },
    skills: ['mente_arcana', 'campo_fuerza', 'telepatia', 'rayo_desintegrador', 'invocar_dos', 'enfurecer'], summons: { id: 'soldado_colmena', count: 2, hp: 0.5 },
    mats: [['baston_colmena', 0.3], ['traje_estelar', 0.3], ['mat_metal_estelar', 1], ['mat_cristal_astral', 1], ['elixir_eterno', 0.5]],
    description: 'Un cerebro del tamaño de una casa, flotando en un tanque de luz verde. Piensa por todos los de la colmena… y ahora piensa en vos: te habla adentro de la cabeza y llama a sus soldados.' });

  const lair = S.lair;
  if (lair) {
    lair({ id: 'cuna_sol', name: 'Cuna del Sol', boss: 'dios', parents: ['empireo'], biome: 'sky', pos: { x: 2340, y: 215 }, labelAt: 'l',
      description: 'Una cuna de oro flotando en el centro de un sol. Adentro, un bebé se ríe. Todo brilla tanto que cuesta mirar.' });
    lair({ id: 'nucleo_colmena', name: 'Núcleo de la Colmena', boss: 'mente_colmena', parents: ['nave_nodriza'], biome: 'space', pos: { x: 2345, y: 355 }, labelAt: 't',
      description: 'En el centro de la nave, un tanque enorme de luz verde. Adentro flota un cerebro que te estaba esperando.' });
    lair({ id: 'trono_satanas', name: 'Trono de Satanás', boss: 'satanas', parents: ['ciudad_dite'], biome: 'hell', pos: { x: 2330, y: 780 }, labelAt: 'l',
      description: 'En el fondo del infierno, un trono de huesos y fuego. El que está sentado ahí no se levanta por cualquiera.' });
  }

  // ---------------------------------------------------------------
  // 7b) Ysera, la dragona del Sueño Esmeralda (nivel 19)
  //     Aspecto de los sueños: la titán Eonar le dio poder para velar por la naturaleza y cuidar el
  //     Sueño Esmeralda. Su guarida está al lado del Bosque de los Sueños (donde se asoma Alafeliz,
  //     que la sirve). Por debajo de Alamuerte, que sigue siendo el más fuerte de los dragones.
  // ---------------------------------------------------------------
  weapon({ id: 'baculo_sueno', name: 'Báculo del Sueño Esmeralda', damage: '5d6+6', weight: 2, tier: 19, rarity: 'legendary', magic: true, spellBonus: 3,
    description: 'Una rama del árbol más viejo del Sueño Esmeralda, regalo de Ysera. La magia sale de él tibia y verde, y pega más fuerte.' });
  BOSS({ id: 'ysera', name: 'Ysera', tier: 19, family: ['dragon', 'flying', 'legendary'], tags: ['nature', 'flying', 'ancient'], biome: ['dream'], speed: 14,
    base: 'dragon_anciano', colors: { b: '#2f8a4e', c: '#9ee0a8', a: '#f0f6d0', wg: '#3f6a8a', e: '#7ad8ff' },
    health: 220, damage: '5d10+2', attack: 12, difficulty: 27, armor: 8,
    skills: ['vuelo', 'regeneracion', 'aliento_sueno', 'polvo_sueno', 'barrido', 'invocar', 'enfurecer'], summons: { id: 'brightwing', count: 1 },
    mats: [['baculo_sueno', 0.25], ['flor_sueno', 1], ['mat_escama_ancestral', 0.6], ['mat_sangre_dragon', 0.4], ['elixir_vida', 0.3]],
    description: 'La dragona verde más antigua, Aspecto de los sueños. La titán Eonar le dio poder para velar por la naturaleza y cuidar el Sueño Esmeralda. Duerme con los ojos cerrados, pero lo ve todo; su aliento te hunde en un sueño del que cuesta salir, y cuando la apurás, Alafeliz llega volando a ayudarla.' });
  if (lair) {
    lair({ id: 'sueno_esmeralda', name: 'El Sueño Esmeralda', boss: 'ysera', parents: ['bosque_suenos'], biome: 'dream', pos: { x: 48, y: 165 }, labelAt: 'b',
      description: 'Un claro donde el bosque se vuelve verde esmeralda y el aire, tibio como un sueño. En el centro duerme una dragona enorme… con los ojos cerrados, pero te está viendo.' });
  }

  // ---------------------------------------------------------------
  // 7c) Lo que se pidió el 26/11
  //   - La zona "Infierno" del volcán se llama Fondo del Volcán (el infierno de verdad es el Infierno profundo).
  //   - El dragón anciano deja de ser jefe: ahora es una criatura fuerte que caza en la Cumbre del Mundo.
  //     Su cima es ahora la Cima Estelar, de Aurelion Sol (dragón celestial que forja estrellas, nivel 19).
  //   - Volibear (Valhir, la Tormenta Implacable), semidiós del Norte, de la guerra y la tormenta (nivel 18),
  //     en la Cumbre de la Tormenta, sobre la Tundra Eterna.
  //   Alamuerte sigue siendo el más fuerte de los dragones.
  // ---------------------------------------------------------------
  {
    const inf = byId(S.regions, 'infierno');
    if (inf) {
      inf.name = 'Fondo del Volcán';
      inf.description = 'Abajo de todo, donde se junta la lava del volcán: ríos de magma, cielo rojo y demonios que suben desde más abajo todavía.';
    }
  }
  {
    const d = byId(S.enemies, 'dragon_anciano');
    if (d && d.category === 'boss') {
      Object.assign(d, curve(19, 'strong', { hp: 1.15 }), {
        category: 'strong', regions: ['cumbre_mundo'], biome: ['mountain'], autoLoot: true,
        spawn: { min: 1, max: 1, weight: 0.6, groupable: false },
        skills: ['vuelo', 'ignifugo', 'aliento_fuego', 'barrido'],
        description: 'Un dragón viejísimo que dejó el nido y ahora caza en la Cumbre del Mundo. Ya no es el que más se teme: arriba suyo están Alamuerte y el que bajó de las estrellas.',
      });
      d.drops = [B.Economy.coinDrop(d)].concat((d.drops || []).filter((x) => x.itemId !== 'coin_copper').map((x) => {
        if (x.itemId === 'mat_escama_ancestral') return { ...x, chance: 0.25 };
        if (x.itemId === 'mat_sangre_dragon') return { ...x, chance: 0.2 };
        return x;
      }));
    }
  }
  weapon({ id: 'hoja_estrellas', name: 'Hoja de las Estrellas', damage: '5d8+6', weight: 3, tier: 19, rarity: 'legendary',
    statusEffect: { type: 'fire', chance: 0.25, turns: 2, value: 5 },
    description: 'Una espada forjada en el corazón de una estrella por Aurelion Sol. Brilla en la oscuridad y a veces prende fuego lo que corta.' });
  armor({ id: 'piel_valhir', name: 'Piel de Valhir', defense: 11, dodge: 3, weight: 4, tier: 18, rarity: 'legendary',
    description: 'La piel blanca de la Tormenta Implacable, con chispas que todavía corren entre los pelos. Abriga y protege.' });
  BOSS({ id: 'aurelion_sol', name: 'Aurelion Sol', tier: 19, family: ['dragon', 'flying', 'celestial', 'legendary'], tags: ['fire', 'flying', 'ancient', 'light'], biome: ['lair'], speed: 14,
    base: 'dragon_anciano', colors: { b: '#1e2a6a', c: '#4a6ad0', a: '#f0d060', wg: '#2a3a8a', e: '#ffffff' },
    health: 205, damage: '5d10+3', attack: 13, difficulty: 28, armor: 8,
    skills: ['vuelo', 'ignifugo', 'caida_cielo', 'aliento_fuego', 'barrido', 'enfurecer'],
    mats: [['hoja_estrellas', 0.25], ['mat_cristal_astral', 1], ['mat_escama_ancestral', 0.6], ['mat_metal_estelar', 0.5], ['elixir_vida', 0.3]],
    description: 'El dragón celestial que forja estrellas. Tiene el cuerpo del color del cielo de noche y una corona de oro; cuando ruge, el cielo se abre y caen estrellas. Bajó a descansar a la cima más alta del nido y no le gusta que lo molesten. Alamuerte es más fuerte, pero él es más viejo que el sol.' });
  {
    const cima = byId(S.regions, 'cima_dragon');
    const as = byId(S.enemies, 'aurelion_sol');
    if (cima && as) {
      cima.name = 'Cima Estelar';
      cima.boss = 'aurelion_sol';
      cima.tier = [as.tier, as.tier];
      cima.unlockConditions = Object.assign({}, cima.unlockConditions, { minLevel: as.tier });
      cima.description = 'La cumbre más alta del Nido de Dragones, tan alta que de noche las estrellas se pueden tocar. Ahí descansa Aurelion Sol, el dragón que las forjó.';
      as.regions = ['cima_dragon'];
    }
  }
  BOSS({ id: 'volibear', name: 'Volibear', tier: 18, family: ['beast', 'giant', 'legendary'], tags: ['storm', 'shock', 'ancient'], biome: ['mountain'], speed: 13,
    base: 'oso', colors: { b: '#d8dce8', c: '#9aa8c8', a: '#5ad0ff', e: '#7af0ff' },
    shape: { len: 22, h: 14, cx: 18, leg: 6, legW: 3, head: 5.6, snout: 3.4, snoutH: 3.4, claws: true, back: 'spikes', eyes: 'glow', hump: true },
    prof: { hp: 0.95, dmg: 0.8 },
    skills: ['furia', 'escudo_tormenta', 'rompecielos', 'aturdir', 'mordida', 'enfurecer'],
    mats: [['piel_valhir', 0.3], ['mat_chispa_tormenta', 1], ['mat_piel_oso', 1], ['mat_garra', 0.8], ['elixir_vida', 0.25]],
    description: 'Valhir, la Tormenta Implacable: un semidiós antiguo del Norte, de la guerra y la tormenta, con forma de oso gigante. Donde pisa caen rayos, un escudo de relámpagos lo cubre y, cuanto más lo lastimás, más fuerte pelea.' });
  if (lair) {
    lair({ id: 'cumbre_tormenta', name: 'Cumbre de la Tormenta', boss: 'volibear', parents: ['tundra_eterna'], biome: 'mountain', pos: { x: 1655, y: 48 }, labelAt: 'r',
      description: 'Un pico pelado sobre la Tundra Eterna donde la tormenta no para nunca. Entre rayo y rayo se ve una sombra enorme, blanca, de un oso que camina en dos patas.' });
  }

  // ---------------------------------------------------------------
  // 8) Las armas legendarias en los jefes de siempre
  // ---------------------------------------------------------------
  drop('rey_escarcha', 'agonia_escarcha', 0.12);   // la espada del rey que no quiso morir
  drop('titan', 'martillo_maldito', 0.15);         // el martillo de los truenos
  drop('dragon_rojo', 'mat_escama_ancestral', 0.05);
  drop('elem_rayo', 'mat_metal_estelar', 0.05);    // a veces trae algo de arriba

  // ---------------------------------------------------------------
  // 9) La gente del Bastión del Alba (el último pueblo)
  // ---------------------------------------------------------------
  const addTo = (npcId, key, ids) => { const n = byId(S.npcs, npcId); if (n) n[key] = uniq((n[key] || []).concat(ids)); };
  addTo('npc_herrera_bastion', 'sells', ['espada_estelar', 'hacha_estelar', 'martillo_estelar', 'lanza_estelar', 'arco_estelar', 'daga_estelar', 'placa_estelar', 'malla_estelar', 'mat_metal_estelar']);
  addTo('npc_sabia_bastion', 'sells', ['pocion_curacion_divina', 'pocion_mana_divina', 'baston_estelar', 'tunica_estelar']);
  addTo('npc_sabia_bastion', 'teaches', ['lanza_luz', 'lluvia_estrellas', 'curacion_divina', 'llamas_infierno', 'singularidad']);
  addTo('npc_posadero_bastion', 'sells', ['pocion_curacion_divina']);
  addTo('npc_herrera_bastion', 'dialog', ['Arriba de la Cumbre hay metal que cayó de las estrellas. Traémelo y te forjo lo que nadie vio.']);
  addTo('npc_sabia_bastion', 'dialog', ['Más arriba del cielo hay otro cielo. Y más abajo del infierno, otro infierno. Ninguno es amigo.']);

  // ---------------------------------------------------------------
  // 10) Recetas: lo del crepúsculo y lo eterno se forja; el elixir eterno se prepara
  // ---------------------------------------------------------------
  const forge = (ids, tier, ingredients, description) => {
    for (const id of ids) {
      const w = byId(S.weapons, id) || byId(S.armors, id);
      if (!w) continue;
      recipe({ id: `r_${id}`, name: w.name, result: id, workshop: w.magic ? 'enchant' : 'forge', tier, ingredients, description });
    }
  };
  forge(['espada_crepusculo', 'hacha_crepusculo', 'martillo_crepusculo', 'lanza_crepusculo', 'arco_crepusculo', 'daga_crepusculo', 'baston_crepusculo',
    'placa_crepusculo', 'malla_crepusculo', 'manto_crepusculo'], 23,
  [{ itemId: 'mat_luz_sagrada', qty: 2 }, { itemId: 'mat_hierro_infernal', qty: 2 }, { itemId: 'mat_metal_estelar', qty: 3 }],
  'Metal estelar templado con luz del cielo y fuego del infierno.');
  forge(['espada_eterna', 'hacha_eterna', 'martillo_eterno', 'lanza_eterna', 'arco_eterno', 'daga_eterna', 'baston_eterno',
    'placa_eterna', 'malla_eterna', 'manto_eterno'], 25,
  [{ itemId: 'mat_luz_sagrada', qty: 3 }, { itemId: 'mat_hierro_infernal', qty: 3 }, { itemId: 'mat_metal_estelar', qty: 4 }, { itemId: 'mat_esencia_vacio', qty: 1 }],
  'Lo mejor de los tres reinos, y una gota de vacío para que no se rompa nunca.');
  recipe({ id: 'r_elixir_eterno', name: 'Elixir eterno', result: 'elixir_eterno', workshop: 'alchemy', tier: 24,
    ingredients: [{ itemId: 'hierba_vida', qty: 3 }, { itemId: 'mat_luz_sagrada', qty: 1 }, { itemId: 'mat_hierro_infernal', qty: 1 }, { itemId: 'mat_metal_estelar', qty: 1 }],
    description: 'Tres hierbas de la vida, una gota de luz, una de fuego y una de estrellas.' });

  // ---------------------------------------------------------------
  // 11) Economía: las partes de criaturas valen según el nivel de la criatura más fácil que las suelta
  //     (nunca bajan). No se tocan los materiales comunes que se venden o se usan para fabricar desde
  //     el principio (metales, gemas, telas, cueros, maderas…): un lingote vale lo mismo lo suelte quien lo suelte.
  // ---------------------------------------------------------------
  const GENERIC = /^mat_(hierro|acero|plata|oro|cobre|carbon|madera|tela|seda|hilo|cuerda|cuero|cuero_grueso|piel|rubi|zafiro|esmeralda|diamante|amatista|topacio|perla|vendaje|hierba_curativa|flor_mana|belladona|raiz_arcana|hongo_rojo|hongo_azul|loto_negro|mandragora|gelatina|gema_arcana|oricalco)$/;
  const SOFT = { common: 1, uncommon: 2, rare: 4, epic: 8, legendary: 16 }; // veces las monedas de una criatura de ese nivel
  const sold = new Set(S.npcs.flatMap((n) => n.sells || []));
  const firstTier = {};
  for (const e of S.enemies) {
    for (const d of e.drops || []) {
      if (!d || !d.itemId || /^coin_/.test(d.itemId)) continue;
      firstTier[d.itemId] = Math.min(firstTier[d.itemId] || 99, e.tier || 1);
    }
  }
  for (const it of S.items) {
    if (it.subtype !== 'material' || !/^mat_/.test(it.id) || GENERIC.test(it.id) || sold.has(it.id) || !firstTier[it.id]) continue;
    const fair = Math.round(B.Economy.coinBase(firstTier[it.id]) * (SOFT[it.rarity] || SOFT.common));
    if (!(it.value >= fair)) it.value = fair;
  }
  // Los materiales de los reinos (con ellos se forja lo del crepúsculo y lo eterno)
  const REALM_VALUE = { mat_metal_estelar: 1200, mat_luz_sagrada: 2500, mat_hierro_infernal: 2500, mat_esencia_pecado: 1500 };
  for (const [id, v] of Object.entries(REALM_VALUE)) { const it = byId(S.items, id); if (it) it.value = v; }
})(window.Aventurs);
