/* ============================================================
   Aventurs — v3.11: los jefes en su guarida
   - Cada jefe vive en su propia guarida (un destino del mapa, al lado de su zona)
     y ya no sale de sorpresa al explorar. En la guarida lo desafiás cuando quieras;
     si le ganás, vuelve al día siguiente.
   - Algunos se invocan en un altar con objetos (Cthulhu, el Lich, el Demonio mayor
     y, en las tierras altas, el Devorador de Mundos).
   - La Torre del Archimago: destino nuevo (antes vivía en el Abismo Marino).
   - El Kraken arranca con 8 tentáculos (no se le puede pegar hasta cortarlos)
     y la Hidra muerde con sus tres cabezas.
   - Jefes nuevos: el Rey Goblin, la Reina Araña y el Ent Anciano.
   - La Kitsune de nueve colas, más fuerte (era la más floja de los jefes).
   Se carga después de las semillas y de seed-v39.js.
   ============================================================ */

(function (A) {
  'use strict';

  const S = A.Seed || (A.Seed = {});
  const B = A.Balance;
  const byId = (list, id) => (list || []).find((x) => x && x.id === id);
  const uniq = (arr) => [...new Set(arr)];
  S.regions = S.regions || [];
  S.enemies = S.enemies || [];
  S.items = S.items || [];

  // ---------------------------------------------------------------
  // Ayudas
  // ---------------------------------------------------------------
  /** Une dos lugares en el mapa (ida y vuelta). */
  function link(a, b) {
    const ra = byId(S.regions, a);
    const rb = byId(S.regions, b);
    if (!ra || !rb) return;
    ra.connections = uniq([...(ra.connections || []), b]);
    rb.connections = uniq([...(rb.connections || []), a]);
  }
  /** Un objeto nuevo (si ya existe, no lo toca). */
  function item(o) {
    if (byId(S.items, o.id)) return;
    S.items.push(Object.assign({ type: 'item', icon: '', weight: 0, stack: 99, _source: 'v311' }, o));
  }
  /** Que una criatura suelte algo (sin repetir). */
  function drop(enemyId, itemId, chance, extra = {}) {
    const e = byId(S.enemies, enemyId);
    if (!e) return;
    e.drops = (e.drops || []).filter((d) => d.itemId !== itemId).concat([Object.assign({ itemId, chance, source: 'v311' }, extra)]);
  }
  /** Stats de una criatura nueva según la curva (Balance.enemyStats) y su forma de ser. */
  function curve(tier, cat, prof = {}) {
    const st = B.enemyStats(tier, cat, prof);
    return {
      health: st.health,
      damage: st.damage,
      armor: Math.max(0, st.armor + (prof.arm || 0)),
      attack: Math.max(0, st.attack + (prof.atk || 0)),
      difficulty: st.difficulty + (prof.def || 0),
    };
  }
  /** Una criatura nueva. o.base: de quién copia el dibujo; o.colors: { b, c, a, e }. */
  function creature(o) {
    if (byId(S.enemies, o.id)) return byId(S.enemies, o.id);
    const cat = o.category || 'normal';
    const st = curve(o.tier, cat, o.prof || {});
    const e = Object.assign({
      icon: '', category: cat, tags: [], biome: [], speed: 10, regions: [],
      spawn: { min: 1, max: cat === 'normal' ? 2 : 1, weight: 1, groupable: cat !== 'boss' },
      tameable: false, autoLoot: true, _source: 'v311',
    }, st, o);
    if (o.base || o.colors) e.sprite = Object.assign({ t: o.base }, o.colors || {});
    delete e.prof; delete e.base; delete e.colors; delete e.mats;
    const coin = B.Economy.coinDrop(e);
    e.drops = [coin].concat((o.mats || []).map(([itemId, chance]) => ({ itemId, chance, source: 'v311' })));
    S.enemies.push(e);
    return e;
  }

  // ---------------------------------------------------------------
  // 1) Objetos para los altares
  // ---------------------------------------------------------------
  item({ id: 'idolo_rlyeh', name: "Ídolo de R'lyeh", subtype: 'material', rarity: 'epic', value: 900, stack: 10,
    description: 'Una figurita verdosa con tentáculos en la cara. Está húmeda aunque la sequés. En el Altar de Cthulhu, sirve para llamarlo.' });
  item({ id: 'filacteria_rota', name: 'Filacteria rota', subtype: 'material', rarity: 'epic', value: 800, stack: 10,
    description: 'Una cajita de hueso con runas. Algo adentro todavía late. En la Cripta del Lich, sirve para despertarlo.' });
  item({ id: 'sello_infernal', name: 'Sello infernal', subtype: 'material', rarity: 'epic', value: 850, stack: 10,
    description: 'Un disco de hierro negro que quema al tacto. En el Círculo de Invocación, abre la puerta al Demonio mayor.' });

  // ---------------------------------------------------------------
  // 2) Jefes nuevos (niveles 3 a 6) y el tentáculo del Kraken
  // ---------------------------------------------------------------
  creature({
    id: 'rey_goblin', name: 'Rey Goblin', category: 'boss', tier: 3, prof: { hp: 1.0, dmg: 0.9 },
    family: ['humanoid', 'goblinoid'], tags: ['leader'], biome: ['cave'], speed: 11,
    base: 'goblin', colors: { c: '#c9a24a', a: '#ffd040' },
    skills: ['lider', 'robar', 'invocar', 'enfurecer'], summons: { id: 'goblin', count: 1 },
    mats: [['mat_oreja_goblin', 0.9], ['mat_oro', 0.4], ['mat_rubi', 0.15]],
    spawn: { min: 1, max: 1, weight: 1, groupable: false }, autoLoot: false,
    description: 'Se sentó en un trono de chatarra y se puso una corona de lata. Grita órdenes y sus goblins obedecen.',
  });
  creature({
    id: 'reina_arana', name: 'Reina Araña', category: 'boss', tier: 5, prof: { hp: 1.05, dmg: 1.05 },
    family: ['beast', 'insect'], tags: ['poison'], biome: ['cave'], speed: 12,
    base: 'arana', colors: { b: '#3a1a3a', c: '#9a3aa0', e: '#ff4040' },
    skills: ['venenoso', 'telarana', 'invocar', 'enfurecer'], summons: { id: 'arana', count: 3 },
    mats: [['mat_seda_arana', 0.9], ['mat_veneno', 0.7], ['mat_amatista', 0.2]],
    spawn: { min: 1, max: 1, weight: 1, groupable: false }, autoLoot: false,
    description: 'Del tamaño de un carro. Teje en la oscuridad y sus crías bajan del techo cuando ella las llama.',
  });
  creature({
    id: 'ent_anciano', name: 'Ent Anciano', category: 'boss', tier: 6, prof: { hp: 1.15, dmg: 0.9 },
    family: ['plant', 'giant'], tags: ['ancient'], biome: ['dream', 'forest'], speed: 7,
    base: 'ent', colors: { b: '#4a3a24', c: '#5a8a3a', a: '#a0d070' },
    skills: ['piel_gruesa', 'regeneracion', 'espinas', 'pisoton', 'enfurecer'],
    mats: [['mat_madera', 0.9], ['mat_esmeralda', 0.25], ['hierba_vida', 0.5]],
    spawn: { min: 1, max: 1, weight: 1, groupable: false }, autoLoot: false,
    description: 'El árbol más viejo del bosque. Lleva mil años dormido y no le gusta que lo despierten.',
  });
  creature({
    id: 'tentaculo_kraken', name: 'Tentáculo del Kraken', category: 'weak', tier: 10, prof: { hp: 0.6, dmg: 0.75 },
    family: ['marine', 'aquatic'], tags: ['aquatic', 'grab'], biome: ['abyss'], speed: 9,
    base: 'tentaculo', colors: { b: '#5a2a5a', c: '#b06ab0' },
    skills: ['lobo_mar', 'agarre'], regions: [],
    mats: [['mat_tinta_kraken', 0.15]],
    spawn: { min: 1, max: 1, weight: 0, groupable: true },
    description: 'Uno de los brazos del Kraken. Mientras quede uno en pie, el Kraken se queda abajo.',
  });

  // ---------------------------------------------------------------
  // 2b) v3.11.1: Alafeliz (antes "Brightwing"), la mini jefa del Sueño Esmeralda.
  //     Ya no vive en el Desierto: se asoma al Bosque de los Sueños, sola y de vez en cuando.
  //     Medido (1 contra 1, orco/humano/gnomo): con 43 de vida se le ganaba siempre;
  //     con esto, a su nivel 75/66/69% y con dos niveles más, 99-100%.
  // ---------------------------------------------------------------
  const alafeliz = byId(S.enemies, 'brightwing');
  if (alafeliz) {
    Object.assign(alafeliz, {
      name: 'Alafeliz', miniBoss: true, category: 'strong', tier: 6,
      family: ['dragon', 'fey', 'flying'], tags: ['magic', 'flying'], biome: ['dream'],
      regions: ['bosque_suenos'],
      health: 110, damage: '2d8+4', attack: 6, difficulty: 15, armor: 2, speed: 15,
      skills: ['vuelo', 'ilusion', 'polvo_sueno', 'hechizo', 'curarse'],
      spawn: { min: 1, max: 1, weight: 0.35, groupable: false },
      tameable: false, autoLoot: false,
      description: 'Una dragona feérica del Sueño Esmeralda: chiquita, risueña y traviesa. Cuando la vas a tocar se vuelve humo, te duerme con su polvo de hada y se cura si la apurás. De vez en cuando se asoma al Bosque de los Sueños.',
    });
    // mini jefa: el doble de monedas que una criatura fuerte y mejor botín
    const coin = B.Economy.coinDrop(alafeliz);
    alafeliz.drops = [Object.assign({}, coin, { qtyMin: coin.qtyMin * 2, qtyMax: coin.qtyMax * 2 })]
      .concat((alafeliz.drops || []).filter((d) => d.itemId !== 'coin_copper'));
    drop('brightwing', 'polvo_hada', 0.8);
    drop('brightwing', 'mat_esencia', 0.5);
    drop('brightwing', 'mat_escama_dragon', 0.35);
  }
  // en el Desierto, en su lugar, el escorpión gigante
  creature({
    id: 'escorpion_gigante', name: 'Escorpión gigante', category: 'normal', tier: 6, prof: { hp: 1.0, dmg: 1.0 },
    family: ['beast', 'insect'], tags: ['poison'], biome: ['desert'], speed: 10,
    base: 'escorpion', colors: { b: '#6a4420', c: '#b07a3a', e: '#ff5030' },
    skills: ['venenoso', 'picadura', 'agarre'], regions: ['desierto'],
    mats: [['mat_veneno', 0.5], ['mat_caparazon', 0.3]],
    description: 'Del tamaño de un perro grande. Se entierra en la arena y sale cuando pasás por arriba.',
  });

  // ---------------------------------------------------------------
  // 3) Los jefes de siempre: más fuertes y con mecánica propia
  // ---------------------------------------------------------------
  const kyubi = byId(S.enemies, 'kyubi');
  // Era la más floja en el editor (74 de vida, 2d6+3), pero el editor no contaba sus invocaciones (v3.11 sí).
  // Medido con jefes.js: con 92 de vida y 2d8+3, a dos niveles más se le ganaba 43-75%; con esto, 80%.
  if (kyubi) Object.assign(kyubi, { health: 84, damage: '2d6+4', attack: 5, difficulty: 15, armor: 2 });
  const lich = byId(S.enemies, 'lich');
  if (lich) Object.assign(lich, { health: 125, attack: 8 }); // se invoca: tiene que valer el viaje
  const demonio = byId(S.enemies, 'demonio_mayor');
  if (demonio) Object.assign(demonio, { health: 125 });
  const leviatan = byId(S.enemies, 'leviatan');
  if (leviatan) Object.assign(leviatan, { health: 104, attack: 7, difficulty: 16 });
  const hidra = byId(S.enemies, 'hidra');
  if (hidra) hidra.skills = uniq((hidra.skills || []).filter((s) => s !== 'doble').concat(['tres_cabezas', 'curarse'])); // sus cabezas muerden cada turno; a veces se cura
  const kraken = byId(S.enemies, 'kraken');
  if (kraken) kraken.skills = uniq((kraken.skills || []).concat(['ocho_tentaculos']));
  const archimago = byId(S.enemies, 'archimago');
  if (archimago) { archimago.skills = uniq((archimago.skills || []).concat(['invocar'])); archimago.summons = { id: 'aprendiz_renegado', count: 2 }; }

  // Lo que sueltan para las invocaciones
  drop('profundo', 'idolo_rlyeh', 0.08);
  drop('ahogado', 'idolo_rlyeh', 0.03);
  drop('nigromante', 'filacteria_rota', 0.1);
  drop('cab_muerte', 'filacteria_rota', 0.06);
  drop('diablillo', 'sello_infernal', 0.05);
  drop('sucubo', 'sello_infernal', 0.08);

  // ---------------------------------------------------------------
  // 4) Las guaridas
  //    type 'lair': un solo jefe (boss); sin peleas de sorpresa adentro ni en el camino.
  //    altar: { name, items: [[id, cantidad]], text }: hay que ofrecer eso para que aparezca.
  // ---------------------------------------------------------------
  function lair(o) {
    const boss = byId(S.enemies, o.boss);
    if (!boss || byId(S.regions, o.id)) return;
    const t = boss.tier || 1;
    S.regions.push({
      id: o.id, name: o.name, type: 'lair', boss: o.boss, biome: o.biome || 'lair', tier: [t, t],
      connections: [], distance: 1, pos: o.pos, labelAt: o.labelAt || 'b', icon: '',
      description: o.description,
      unlockConditions: Object.assign({ minLevel: o.minLevel || t }, o.unlock || {}),
      encounter: { minEnemies: 0, maxEnemies: 0, allowMixed: false, spawnWeights: { weak: 0, normal: 0, strong: 0, boss: 0 } },
      altar: o.altar ? { name: o.altar.name, items: o.altar.items.map(([id, qty]) => ({ id, qty: qty || 1 })), text: o.altar.text } : null,
      _source: 'v311',
    });
    for (const p of o.parents) link(o.id, p);
    boss.regions = [o.id]; // el jefe vive solo en su guarida
  }
  S.lair = lair; // para las tierras altas (seed-v311-alto.js)

  lair({ id: 'trono_goblin', name: 'Trono del Rey Goblin', boss: 'rey_goblin', parents: ['minas_olvidadas'], biome: 'cave', pos: { x: 425, y: 168 }, labelAt: 't',
    description: 'Una caverna llena de cosas robadas. Al fondo, sobre un trono de chatarra, un goblin con corona te mira con desprecio.' });
  lair({ id: 'nido_reina_arana', name: 'Nido de la Reina Araña', boss: 'reina_arana', parents: ['montanas'], biome: 'cave', pos: { x: 742, y: 262 }, labelAt: 'r',
    description: 'Telarañas gruesas como cuerdas tapan la entrada. Adentro, algo enorme se mueve sin hacer ruido.' });
  lair({ id: 'corazon_bosque', name: 'Corazón del Bosque', boss: 'ent_anciano', parents: ['bosque_suenos'], biome: 'grove', pos: { x: 300, y: 98 }, labelAt: 't',
    description: 'Un claro donde los árboles se inclinan hacia el centro, como si escucharan. Ahí duerme el más viejo de todos.' });
  lair({ id: 'santuario_nueve_colas', name: 'Santuario de las Nueve Colas', boss: 'kyubi', parents: ['bosque_susurros'], biome: 'darkwood', pos: { x: 40, y: 392 }, labelAt: 'r',
    description: 'Un templo de madera roja escondido entre la niebla. Huele a incienso y a fuego azul.' });
  lair({ id: 'fosa_leviatan', name: 'Fosa del Leviatán', boss: 'leviatan', parents: ['alta_mar'], biome: 'sea', pos: { x: 880, y: 818 }, labelAt: 'r',
    description: 'El agua se vuelve negra de golpe: el fondo desaparece. Algo largo y enorme da vueltas abajo.' });
  lair({ id: 'torre_archimago', name: 'Torre del Archimago', boss: 'archimago', parents: ['torre_del_mago', 'ruinas_perdidas'], biome: 'arcane', pos: { x: 905, y: 520 }, labelAt: 'r',
    description: 'Una torre negra que no proyecta sombra. Las escaleras cambian de lugar y, arriba de todo, el Archimago te espera.' });
  lair({ id: 'cripta_lich', name: 'Cripta del Lich', boss: 'lich', parents: ['catacumbas'], biome: 'crypt', pos: { x: 1110, y: 258 }, labelAt: 'r',
    description: 'Una cripta sellada debajo de las catacumbas. En el altar del centro hay un hueco con forma de cajita.',
    altar: { name: 'Altar de hueso', items: [['filacteria_rota', 1], ['mat_craneo', 3]], text: 'El Lich no está: duerme en su filacteria. Poné la filacteria rota y tres cráneos en el altar y despertalo.' } });
  lair({ id: 'castillo_velmora', name: 'Castillo de Velmora', boss: 'senor_vampiro', parents: ['velmora'], biome: 'gothic', pos: { x: 1262, y: 470 }, labelAt: 'r',
    description: 'El castillo que vigila Velmora desde la colina. Las ventanas están tapiadas y adentro siempre es de noche.' });
  lair({ id: 'circulo_infernal', name: 'Círculo de Invocación', boss: 'demonio_mayor', parents: ['infierno'], biome: 'hell', pos: { x: 1098, y: 44 }, labelAt: 'l',
    description: 'Un círculo grabado en la roca, con velas negras que no se apagan nunca. Falta algo en el centro.',
    altar: { name: 'Círculo de invocación', items: [['sello_infernal', 1], ['mat_cuerno_demonio', 2]], text: 'El Demonio mayor no viene solo: hay que abrirle la puerta. Poné el sello infernal y dos cuernos de demonio en el centro del círculo.' } });
  lair({ id: 'lago_hidra', name: 'Lago de la Hidra', boss: 'hidra', parents: ['pantano'], biome: 'swamp', pos: { x: 410, y: 760 }, labelAt: 'b',
    description: 'Un lago verde en el corazón del pantano. Tres cabezas se asoman a la vez y se te quedan mirando.' });
  lair({ id: 'grieta_balrog', name: 'Grieta del Balrog', boss: 'balrog', parents: ['volcan'], biome: 'volcano', pos: { x: 918, y: 56 }, labelAt: 'l',
    description: 'Una grieta que baja hasta el fuego de la tierra. Del fondo sube un calor que no es de este mundo.' });
  lair({ id: 'cima_dragon', name: 'Cima del Dragón Anciano', boss: 'dragon_anciano', parents: ['nido_de_dragones'], biome: 'lair', pos: { x: 1262, y: 168 }, labelAt: 'r',
    description: 'La cumbre más alta del nido. Huesos de héroes, montañas de oro y un dragón que duerme con un ojo abierto.' });
  lair({ id: 'trono_alamuerte', name: 'Trono de Alamuerte', boss: 'alamuerte', parents: ['nido_de_dragones'], biome: 'lair', pos: { x: 1262, y: 270 }, labelAt: 'r',
    description: 'Una caverna de roca fundida. Las placas de metal de Alamuerte brillan en la oscuridad como brasas.' });
  lair({ id: 'remolino_kraken', name: 'Remolino del Kraken', boss: 'kraken', parents: ['abismo_marino'], biome: 'abyss', pos: { x: 1112, y: 828 }, labelAt: 'r',
    description: 'Un remolino que no para nunca. Abajo, en el ojo del agua, algo con ocho brazos espera.' });
  lair({ id: 'altar_cthulhu', name: 'Altar de Cthulhu', boss: 'cthulhu', parents: ['abismo_marino'], biome: 'abyss', pos: { x: 1095, y: 752 }, labelAt: 'r', // v3.11.1: más arriba (abajo no entraba el nombre)
    description: "Una piedra negra en el fondo del mar, con dibujos que duelen de mirar. Los profundos rezan acá.",
    altar: { name: 'Altar de Cthulhu', items: [['idolo_rlyeh', 1], ['mat_perla', 3]], text: "Cthulhu duerme en R'lyeh. Para llamarlo, poné el Ídolo de R'lyeh y tres perlas en el altar." } });
  lair({ id: 'monte_titan', name: 'Monte del Titán', boss: 'titan', parents: ['picos_helados'], biome: 'mountain', pos: { x: 605, y: 30 }, labelAt: 'l',
    description: 'Lo que parecía una montaña tiene ojos. El Titán se sentó acá hace mil años y todavía no se levantó.' });
  lair({ id: 'cubil_tarrasca', name: 'Cubil de la Tarrasca', boss: 'tarrasca', parents: ['desierto'], biome: 'desert', pos: { x: 952, y: 222 }, labelAt: 'r',
    description: 'Una hondonada en la arena con un caparazón enorme en el medio. Si lo mirás bien, respira.' });
})(window.Aventurs);
