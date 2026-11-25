/* ============================================================
   Aventurs — v3.9: cambios de mundo y de objetos
   - La Torre del Mago: pueblo sin peleas, pero con criaturas en el camino
   - Aldea de los Faroles, al lado de la Torre: posada, comida y un buhonero
   - Criaturas del camino a la Torre (aprendices renegados, chispas, gólem de tinta)
   - Tiendas ordenadas: la comida en la taberna; el mercader, equipo y pociones
   - Varitas que de verdad mejoran (para que un mago no espere hasta la Torre)
   - Recetas para casi todos los materiales que antes solo servían para vender
   - Las llaves abren cofres
   Se carga después de las semillas (index.html) y las retoca.
   ============================================================ */

(function (A) {
  'use strict';

  const S = A.Seed || (A.Seed = {});
  const byId = (list, id) => (list || []).find((x) => x && x.id === id);
  const uniq = (arr) => [...new Set(arr)];

  // ---------------------------------------------------------------
  // 1) Lugares
  // ---------------------------------------------------------------
  const torre = byId(S.regions, 'torre_del_mago');
  if (torre) {
    torre.type = 'road'; // adentro no se pelea; en el camino hacia acá, sí
    torre.tier = [3, 4]; // las criaturas del camino: de nivel 3 y 4
    torre.connections = uniq([...(torre.connections || []), 'aldea_faroles']);
  }
  if (!byId(S.regions, 'aldea_faroles')) {
    (S.regions = S.regions || []).push({
      id: 'aldea_faroles', name: 'Aldea de los Faroles', type: 'safe', biome: 'village', tier: [4, 4],
      connections: ['torre_del_mago'], distance: 1, pos: { x: 905, y: 668 }, labelAt: 'b', icon: '',
      description: 'Faroles de vidrio azul cuelgan sobre la calle. Aprendices cansados, un horno de pan y una posada con olor a sopa.',
      unlockConditions: { minLevel: 4 },
      events: [{ type: 'find', chance: 6, reward: 'pan' }],
    });
  }

  // ---------------------------------------------------------------
  // 2) Gente de la aldea
  // ---------------------------------------------------------------
  const FOODS = ['pan', 'queso', 'carne_seca', 'galletas', 'manzana', 'huevos', 'dulces', 'zanahoria', 'tomate', 'cebolla'];
  const RACE_FOODS = ['lata_aceite', 'botella_sangre', 'frasco_nectar', 'gel_algas', 'carbon_ardiente'];
  S.npcs = S.npcs || [];
  if (!byId(S.npcs, 'npc_posadera_faroles')) {
    S.npcs.push({
      id: 'npc_posadera_faroles', name: 'Ilda la posadera', role: 'tavernkeeper', roleName: 'Posadera', region: 'aldea_faroles', icon: '', sprite: '',
      dialog: [
        'Los aprendices de la Torre vienen a comer acá: allá arriba solo hay libros.',
        'Doce de cobre la cama, con sopa incluida. El plato solo, mucho menos.',
        'Si vas por el camino de la Torre, cuidate de las chispas: queman la ropa.',
      ],
      sells: uniq(['hierba_vida', 'pocion_curacion_menor', ...FOODS, ...RACE_FOODS]),
      services: { restCost: 12 },
      crafts: ['alchemy'],
    });
  }
  if (!byId(S.npcs, 'npc_buhonero_faroles')) {
    S.npcs.push({
      id: 'npc_buhonero_faroles', name: 'Tobin el buhonero', role: 'merchant', roleName: 'Buhonero', region: 'aldea_faroles', icon: '', sprite: '',
      dialog: [
        'Traigo de todo un poco: lo que los aprendices venden cuando se quedan sin cobre.',
        'Las varitas rúnicas las hace un enano del puerto. Son mejores de lo que parecen.',
        '¿Una llave vieja? Algún cofre del camino te la va a agradecer.',
      ],
      sells: [
        'pocion_curacion', 'pocion_mana', 'antidoto', 'pocion_velocidad', 'pocion_regeneracion',
        'perg_misil_arcano', 'perg_escudo', 'perg_prisa', 'perg_purificar',
        'varita_runica', 'cetro_arcano', 'espada_larga', 'alfanje', 'ballesta', 'lanza',
        'cota_de_malla', 'tabardo_arcano', 'cuero_tachonado',
        'acc_amuleto_sabiduria', 'acc_trebol', 'cuerda', 'linterna', 'item_llave_oxidada',
      ],
      services: {},
      crafts: ['enchant'],
    });
  }

  // ---------------------------------------------------------------
  // 3) Tiendas ordenadas
  //    La comida y las comidas de raza pasan a la taberna del pueblo;
  //    el mercader se queda con equipo, pociones, pergaminos y herramientas.
  // ---------------------------------------------------------------
  const merc = byId(S.npcs, 'npc_mercader_pueblo');
  const tab = byId(S.npcs, 'npc_tabernero_pueblo');
  if (merc && tab) {
    const food = (merc.sells || []).filter((id) => ['pan', 'queso', 'carne_seca', 'carne_cruda', 'semillas', 'manzana', 'zanahoria', 'huevos', 'cebolla', 'tomate', 'galletas', 'dulces', ...RACE_FOODS].includes(id));
    merc.sells = (merc.sells || []).filter((id) => !food.includes(id));
    tab.sells = uniq([...(tab.sells || []), ...food]);
  }
  // Las demás tabernas también venden algo de comer
  for (const id of ['npc_tabernera_piedrahonda', 'npc_tabernero_calavera']) {
    const n = byId(S.npcs, id);
    if (n) n.sells = uniq([...(n.sells || []), 'pan', 'queso', 'carne_seca']);
  }
  // Encantar también en el santuario y con la boticaria
  for (const id of ['npc_druida_santuario', 'npc_boticaria_velmora']) {
    const n = byId(S.npcs, id);
    if (n) n.crafts = uniq([...(n.crafts || []), 'enchant']);
  }

  // ---------------------------------------------------------------
  // 4) Varitas que mejoran de verdad (antes la varita era igual que la de inicio)
  // ---------------------------------------------------------------
  // (medido: subirle el daño de golpe a las varitas dejaba a los magos 20 puntos arriba en el nivel 3;
  //  lo que un mago necesita antes de la Torre es más poder mágico, no más golpe)
  const runica = byId(S.weapons, 'varita_runica');
  if (runica) { runica.spellBonus = 1; runica.description = 'Runas grabadas a fuego: +1 de poder mágico extra (sus hechizos pegan como con un cetro). La venden los herreros de Piedrahonda y del Puerto.'; }

  // Curación y Segundo aliento ya no son lo mismo
  const cur = byId(S.spells, 'curacion');
  if (cur) { cur.cleanse = true; cur.description = 'Las heridas se cierran al pronunciar la palabra correcta, y se va el veneno, el sangrado, el fuego, el frío y la maldición. Podés curarte a vos o a un compañero (también a una mascota). Solo para magos; un turno sí y otro no.'; }
  const sa = byId(S.spells, 'segundo_aliento');
  // (medido con tools/equilibrio.js: con un tercio de lo que falta, 4 de maná, los híbridos ganaban 15 a 40 puntos más)
  if (sa) { sa.heal = '1d6+1'; sa.healMissing = 0.15; sa.manaCost = 5; sa.cooldown = 3; sa.description = 'Juntás aire y apretás los dientes: cuanto más herido estás, más te curás (1d6+1 y el 15% de la vida que te falta). Solo a vos; cada tres turnos. Curar a otros y limpiar venenos es cosa de magos.'; }

  // Los hechizos de nacimiento tiran el dado (el dardo arcano del humano ya no es seguro)
  const dardo = byId(S.spells, 'dardo_arcano');
  if (dardo) {
    dardo.sure = false;
    dardo.description = 'Un proyectil de energía pura que deja una marca arcana: tu próximo golpe con arma contra ese blanco hace más daño (+1; +2 desde el nivel 5; +3 y mejor puntería desde el 9). La marca es solo tuya y dura dos rondas. Tira el dado como tu arma.';
  }

  // ---------------------------------------------------------------
  // 5) Criaturas del camino a la Torre
  // ---------------------------------------------------------------
  S.enemies = S.enemies || [];
  const drop = (itemId, chance, extra) => ({ itemId, chance, source: 'manual', ...(extra || {}) });
  const coins = (a, b) => drop('coin_copper', 0.9, { qtyMin: a, qtyMax: b });
  const NEW_FOES = [
    {
      id: 'aprendiz_renegado', name: 'Aprendiz renegado', icon: '', family: ['humanoid', 'arcane'], category: 'normal', tier: 3,
      tags: ['magic'], biome: ['arcane', 'coast'], health: 22, damage: '1d10', attack: 2, difficulty: 10, armor: 0, speed: 11,
      drops: [coins(8, 20), drop('polvo_arcano', 0.3), drop('perg_misil_arcano', 0.12), drop('mat_tela', 0.3), drop('pocion_mana_menor', 0.15), drop('varita', 0.04)],
      regions: ['torre_del_mago'], spawn: { min: 1, max: 2, weight: 1, groupable: true }, tameable: false, autoLoot: true,
      skills: ['escurridizo', 'hechizo'],
    },
    {
      id: 'chispa_arcana', name: 'Chispa arcana', icon: '', family: ['elemental', 'arcane'], category: 'weak', tier: 3,
      tags: ['magic', 'flying'], biome: ['arcane'], health: 12, damage: '1d6+1', attack: 1, difficulty: 10, armor: 0, speed: 16,
      drops: [drop('polvo_arcano', 0.35), drop('cristal_mana', 0.06), drop('mat_chispa_tormenta', 0.03)],
      regions: ['torre_del_mago'], spawn: { min: 1, max: 3, weight: 1, groupable: true }, tameable: false, autoLoot: true,
      skills: ['vuelo', 'hechizo'],
    },
    {
      id: 'golem_tinta', name: 'Gólem de tinta', icon: '', family: ['construct', 'arcane'], category: 'normal', tier: 4,
      tags: ['magic'], biome: ['arcane'], health: 30, damage: '2d6', attack: 2, difficulty: 11, armor: 2, speed: 6,
      drops: [coins(10, 24), drop('fragmento_runa', 0.18), drop('mat_gema_arcana', 0.05), drop('polvo_arcano', 0.25), drop('perg_escudo', 0.1)],
      regions: ['torre_del_mago'], spawn: { min: 1, max: 1, weight: 0.7, groupable: false }, tameable: false, autoLoot: true,
      skills: ['constructo', 'aturdir', 'guardia'],
    },
  ];
  for (const f of NEW_FOES) if (!byId(S.enemies, f.id)) S.enemies.push(f);
  // El diablillo de las montañas también ronda el camino de la Torre
  const imp = byId(S.enemies, 'diablillo');
  if (imp) imp.regions = uniq([...(imp.regions || []), 'torre_del_mago']);

  // Lo que comen (antes el panda y el unicornio "comían carnes")
  for (const [id, diet] of [['panda', 'herbivoro'], ['unicornio', 'herbivoro'], ['ciervo_astral', 'herbivoro'], ['tortuga', 'herbivoro'], ['polilla_onirica', 'herbivoro'], ['loro_pirata', 'herbivoro']]) {
    const e = byId(S.enemies, id);
    if (e && !e.diet) e.diet = diet;
  }

  // ---------------------------------------------------------------
  // 6) Recetas: casi todo material sirve para algo
  //    (los ingredientes suman un poco menos de lo que vale lo que sale)
  // ---------------------------------------------------------------
  const R = (id, name, result, workshop, tier, ingredients, description) => ({
    id: `r39_${id}`, name, result, workshop, tier, description,
    ingredients: ingredients.map(([itemId, qty]) => ({ itemId, qty: qty || 1 })),
  });
  const RECIPES = [
    // --- Forja: armas ---
    R('hacha_de_mano', 'Forjar hacha de mano', 'hacha_de_mano', 'forge', 2, [['mat_hierro'], ['mat_garra']], 'Hierro y una garra de bestia como filo de respaldo.'),
    R('lanza', 'Forjar lanza', 'lanza', 'forge', 3, [['mat_madera', 2], ['mat_hierro'], ['mat_hueso']], 'Asta de madera, punta de hierro y un hueso como contrapeso.'),
    R('arco_corto', 'Tensar arco corto', 'arco_corto', 'forge', 2, [['mat_madera', 2], ['mat_cuerda'], ['mat_pluma']], 'Madera, cuerda y plumas para las flechas.'),
    R('maza', 'Forjar maza', 'maza', 'forge', 3, [['mat_hierro', 2], ['mat_madera'], ['mat_cobre', 2]], 'Cabeza de hierro con remaches de cobre.'),
    R('martillo_enano', 'Forjar martillo enano', 'martillo_enano', 'forge', 3, [['mat_hierro', 2], ['mat_carbon', 2], ['mat_madera']], 'Hierro templado con carbón, a la manera enana.'),
    R('estoque', 'Forjar estoque', 'estoque', 'forge', 3, [['mat_acero'], ['mat_madera']], 'Una hoja fina de acero.'),
    R('cimitarra', 'Forjar cimitarra', 'cimitarra', 'forge', 3, [['mat_acero'], ['mat_piel']], 'Acero curvo con el mango forrado en piel.'),
    R('mandoble', 'Forjar mandoble', 'mandoble', 'forge', 5, [['mat_acero', 2], ['mat_cuero_grueso'], ['mat_cuerno']], 'Dos barras de acero y un pomo de cuerno.'),
    R('hacha_de_guerra', 'Forjar hacha de guerra', 'hacha_de_guerra', 'forge', 6, [['mat_acero', 3], ['mat_piel_oso'], ['mat_garra', 4]], 'Acero, mango forrado en piel de oso y garras en el filo.'),
    R('martillo_de_guerra', 'Forjar martillo de guerra', 'martillo_de_guerra', 'forge', 6, [['mat_acero', 3], ['mat_plata']], 'Acero macizo con un núcleo de plata.'),
    R('hacha_runica', 'Forjar hacha rúnica', 'hacha_runica', 'forge', 8, [['mat_acero', 2], ['mat_plata', 2], ['fragmento_runa', 5]], 'Runas engarzadas en el acero.'),
    R('matamuertos', 'Forjar matamuertos', 'matamuertos', 'forge', 8, [['mat_plata', 4], ['mat_ectoplasma', 3], ['mat_acero', 3]], 'Plata para lo que no debería caminar.'),
    R('espadon', 'Forjar espadón', 'espadon', 'forge', 8, [['mat_oro'], ['mat_acero', 5], ['mat_plata', 2]], 'Una hoja enorme con guarda de oro.'),
    R('matadragones', 'Forjar matadragones', 'matadragones', 'forge', 9, [['mat_diamante'], ['mat_acero', 4], ['mat_escama_dragon']], 'Filo de diamante, templado contra la escama.'),
    // --- Forja: armaduras ---
    R('ropa_acolchada', 'Coser ropa acolchada', 'ropa_acolchada', 'forge', 1, [['mat_tela', 2], ['mat_piel']], 'Dos capas de tela y una de piel.'),
    R('pieles', 'Coser pieles', 'pieles', 'forge', 2, [['mat_piel_lobo', 2], ['mat_hilo', 2]], 'Piel de lobo cosida en capas.'),
    R('brigantina', 'Forjar brigantina', 'brigantina', 'forge', 3, [['mat_tela', 2], ['mat_hierro'], ['mat_cobre', 2]], 'Placas chicas remachadas entre telas.'),
    R('cuero_tachonado', 'Forjar cuero tachonado', 'cuero_tachonado', 'forge', 3, [['mat_cuero_grueso', 2], ['mat_cobre']], 'Cuero grueso con tachas de cobre.'),
    R('cota_anillas', 'Forjar cota de anillas', 'cota_anillas', 'forge', 3, [['mat_hierro', 3], ['mat_cuero']], 'Anillas de hierro cosidas sobre cuero.'),
    R('armadura_huesos', 'Armar armadura de huesos', 'armadura_huesos', 'forge', 3, [['mat_hueso', 3], ['mat_craneo'], ['mat_cuerda']], 'Huesos atados con cuerda. Da miedo y protege.'),
    R('cota_de_malla', 'Forjar cota de malla', 'cota_de_malla', 'forge', 4, [['mat_acero', 2]], 'Miles de anillas de acero.'),
    R('quitina', 'Armar armadura de quitina', 'quitina', 'forge', 4, [['mat_caparazon', 2], ['mat_pata_arana', 4], ['mat_seda_arana']], 'Caparazones unidos con seda de araña.'),
    R('armadura_escamas', 'Forjar armadura de escamas', 'armadura_escamas', 'forge', 5, [['mat_escama', 6], ['mat_escama_kobold', 4], ['mat_cuero_grueso']], 'Escamas superpuestas sobre cuero grueso.'),
    R('coraza_acero', 'Forjar coraza de acero', 'coraza_acero', 'forge', 5, [['mat_acero', 2], ['mat_cuero_grueso'], ['mat_carbon', 2]], 'Acero batido a golpe de carbón.'),
    R('armadura_placas', 'Forjar armadura de placas', 'armadura_placas', 'forge', 6, [['mat_acero', 4], ['mat_plata']], 'Placas de acero con bordes de plata.'),
    R('armadura_coral', 'Armar armadura de coral', 'armadura_coral', 'forge', 6, [['mat_caparazon', 3], ['mat_diente_tiburon', 3], ['mat_perla']], 'Caparazón, dientes de tiburón y una perla en el pecho.'),
    R('armadura_obsidiana', 'Forjar armadura de obsidiana', 'armadura_obsidiana', 'forge', 8, [['obsidiana', 8], ['mat_acero', 4], ['mat_carbon', 4]], 'Placas de vidrio volcánico sobre acero.'),
    R('armadura_volcanica', 'Forjar armadura volcánica', 'armadura_volcanica', 'forge', 8, [['fragmento_lava', 6], ['mat_brasa_elemental', 3], ['mat_acero', 4]], 'Todavía tibia por dentro.'),
    R('armadura_escarcha', 'Forjar armadura de escarcha', 'armadura_escarcha', 'forge', 8, [['mat_esencia_hielo', 3], ['mat_acero', 4]], 'Acero que nunca se calienta.'),
    R('armadura_tormenta', 'Forjar armadura de tormenta', 'armadura_tormenta', 'forge', 8, [['mat_chispa_tormenta', 3], ['mat_acero', 3]], 'Chispea cuando te pegan.'),
    // --- Forja: accesorios sencillos ---
    R('anillo_cobre', 'Forjar anillo de cobre', 'acc_anillo_cobre', 'forge', 1, [['mat_cobre', 3]], 'Un anillo sencillo.'),
    R('colgante_hueso', 'Tallar colgante de hueso', 'acc_colgante_hueso', 'forge', 1, [['mat_hueso'], ['mat_hilo', 2]], 'Un hueso tallado colgado de un hilo.'),
    R('botas_velocidad', 'Coser botas ligeras', 'acc_botas_velocidad', 'forge', 4, [['mat_cuero_grueso'], ['mat_pluma', 2], ['mat_seda_arana']], 'Suela de cuero grueso, plumas en el talón.'),
    R('guantelete_poder', 'Forjar guantelete de poder', 'acc_guantelete_poder', 'forge', 6, [['mat_garra_licantropo'], ['mat_acero', 2]], 'Acero con garras de licántropo en los nudillos.'),
    // --- Alquimia ---
    R('vendaje', 'Hacer vendas', 'mat_vendaje', 'alchemy', 1, [['mat_tela', 2]], 'Tela limpia cortada en tiras.'),
    R('pocion_regeneracion', 'Preparar poción de regeneración', 'pocion_regeneracion', 'alchemy', 2, [['mat_gelatina', 2], ['mat_nucleo_slime']], 'Lo que hace que un slime se vuelva a armar.'),
    R('pocion_velocidad', 'Preparar poción de velocidad', 'pocion_velocidad', 'alchemy', 2, [['mat_ala_murcielago'], ['mat_pluma']], 'Polvo de ala de murciélago y una pluma molida.'),
    R('pocion_piel_piedra', 'Preparar poción de piel de piedra', 'pocion_piel_piedra', 'alchemy', 3, [['mat_escama', 2], ['mat_cuerno']], 'Escamas y cuerno molidos: la piel se endurece.'),
    R('pocion_invisibilidad', 'Preparar poción de invisibilidad', 'pocion_invisibilidad', 'alchemy', 4, [['polvo_hada', 2], ['mat_hongo_azul']], 'Polvo de hada y un hongo que brilla en la oscuridad.'),
    R('pocion_contra_fuego', 'Preparar poción contra el fuego', 'pocion_contra_fuego', 'alchemy', 2, [['mat_escama_kobold', 2]], 'Las escamas de kobold no se queman.'),
    R('pocion_contra_frio', 'Preparar poción contra el frío', 'pocion_contra_frio', 'alchemy', 2, [['mat_pelo_rata', 2], ['mat_cola_rata']], 'Caldo de rata. Calienta, no preguntes cómo.'),
    R('elixir_fuerza', 'Preparar elixir de fuerza', 'elixir_fuerza', 'alchemy', 3, [['mat_oreja_goblin', 2], ['mat_nariz_goblin', 2], ['mat_cuerno']], 'Receta goblin. Huele mal, funciona.'),
    R('pocion_mana_mayor', 'Preparar poción de maná mayor', 'pocion_mana_mayor', 'alchemy', 4, [['mat_flor_mana'], ['mat_hongo_azul']], 'Flor de maná destilada con hongo azul.'),
    R('elixir_vida', 'Preparar elixir de vida', 'elixir_vida', 'alchemy', 7, [['mat_mandragora'], ['mat_vendaje']], 'Raíz de mandrágora sobre vendas limpias.'),
    // --- Encantar: pergaminos ---
    R('perg_veneno', 'Escribir pergamino de veneno', 'perg_veneno', 'enchant', 2, [['mat_veneno'], ['mat_tela']], 'Tinta de veneno sobre tela.'),
    R('perg_maldicion', 'Escribir pergamino de maldición', 'perg_maldicion', 'enchant', 3, [['mat_belladona']], 'Belladona hervida hasta hacer tinta.'),
    R('perg_terror', 'Escribir pergamino de terror', 'perg_terror', 'enchant', 3, [['mat_ojo_zombi'], ['mat_dedo_esqueleto', 2], ['mat_carne_zombi', 2]], 'Restos de no muertos y una mano firme.'),
    R('perg_precision', 'Escribir pergamino de precisión', 'perg_precision', 'enchant', 2, [['mat_oreja_murcielago', 2], ['mat_pluma']], 'Oído de murciélago: nunca falla.'),
    R('perg_espinas', 'Escribir pergamino de espinas', 'perg_espinas', 'enchant', 3, [['aguja_escorpion'], ['mat_garra']], 'Agujas y garras en la tinta.'),
    R('perg_furia', 'Escribir pergamino de furia', 'perg_furia', 'enchant', 4, [['mat_hongo_rojo'], ['mat_garra', 2]], 'Hongo rojo y garras: sale enojado.'),
    R('perg_reflejar', 'Escribir pergamino de reflejo', 'perg_reflejar', 'enchant', 5, [['concha_iridiscente', 4], ['polvo_arcano']], 'Conchas que devuelven la luz.'),
    R('perg_perdicion', 'Escribir pergamino de perdición', 'perg_perdicion', 'enchant', 8, [['mat_loto_negro', 2]], 'El loto negro no perdona.'),
    // --- Encantar: accesorios ---
    R('trebol', 'Encantar trébol de la suerte', 'acc_trebol', 'enchant', 2, [['espiga_dorada', 5], ['polvo_hada', 2]], 'Espigas doradas y polvo de hada.'),
    R('talisman_fortuna', 'Encantar talismán de la fortuna', 'acc_talisman_fortuna', 'enchant', 3, [['doblon', 2]], 'Dos doblones de pirata, fundidos con suerte.'),
    R('amuleto_sabiduria', 'Encantar amuleto de sabiduría', 'acc_amuleto_sabiduria', 'enchant', 3, [['mat_raiz_arcana']], 'Una raíz arcana tallada.'),
    R('amuleto_iniciativa', 'Encantar amuleto de iniciativa', 'acc_amuleto_iniciativa', 'enchant', 4, [['mat_pluma', 3], ['mat_ala_murcielago', 2], ['mat_hilo']], 'Plumas y alas: te movés antes.'),
    R('perla_purificadora', 'Encantar perla purificadora', 'acc_perla_purificadora', 'enchant', 4, [['perla_pequeña', 3]], 'Tres perlas chicas que limpian el veneno.'),
    R('gema_mana', 'Encantar gema de maná', 'acc_gema_mana', 'enchant', 4, [['cristal_mana'], ['polvo_arcano']], 'Un cristal que guarda maná.'),
    R('escudo_magico', 'Encantar escudo mágico', 'acc_escudo_magico', 'enchant', 5, [['mat_topacio']], 'Un topacio que frena la magia.'),
    R('cruz_sagrada', 'Bendecir cruz sagrada', 'acc_cruz_sagrada', 'enchant', 5, [['mat_plata'], ['mat_ectoplasma']], 'Plata bendecida contra lo que no descansa.'),
    R('capa_evasion', 'Coser capa de evasión', 'acc_capa_evasion', 'enchant', 5, [['mat_seda'], ['mat_ala_murcielago']], 'Seda que se mueve sola.'),
    R('anillo_critico', 'Encantar anillo crítico', 'acc_anillo_critico', 'enchant', 6, [['mat_amatista'], ['mat_plata'], ['mat_garra', 3]], 'Amatista en plata: buscás el punto débil.'),
    R('anillo_espinas', 'Encantar anillo de espinas', 'acc_anillo_espinas', 'enchant', 6, [['mat_pua_manticora'], ['mat_plata']], 'Una púa de mantícora engarzada.'),
    R('amuleto_vampirico', 'Encantar amuleto vampírico', 'acc_amuleto_vampirico', 'enchant', 7, [['mat_colmillo_vampiro'], ['mat_plata', 2]], 'Un colmillo que todavía tiene sed.'),
    R('zafiro_glacial', 'Encantar zafiro glacial', 'acc_zafiro_glacial', 'enchant', 7, [['mat_zafiro'], ['mat_esencia_hielo'], ['mat_plata']], 'Un zafiro que nunca se entibia.'),
    R('rubi_fenix', 'Encantar rubí del fénix', 'acc_rubi_fenix', 'enchant', 7, [['mat_rubi'], ['mat_brasa_elemental', 2]], 'Un rubí con una brasa adentro.'),
    R('orbe_regeneracion', 'Encantar orbe de regeneración', 'acc_orbe_regeneracion', 'enchant', 7, [['mat_esmeralda'], ['mat_corazon', 2], ['mat_nucleo_slime', 2]], 'Late despacio, como un corazón.'),
    R('brazalete_contra', 'Encantar brazalete de contraataque', 'acc_brazalete_contra', 'enchant', 7, [['mat_melena_quimera'], ['mat_plata']], 'Melena de quimera trenzada en plata.'),
    R('superviviente', 'Encantar amuleto del superviviente', 'acc_amuleto_superviviente', 'enchant', 9, [['collar_perlas'], ['talisman_arcano'], ['mat_corazon', 3], ['mat_oro']], 'El collar de perlas y el talismán arcano, unidos con oro.'),
    R('guantes_dobles', 'Encantar guantes dobles', 'acc_guantes_dobles', 'enchant', 9, [['mat_ojo_basilisco'], ['mat_seda', 3], ['mat_oro']], 'El ojo del basilisco ve el segundo golpe.'),
    // --- Encantar: armas y ropas mágicas ---
    R('grimorio', 'Encuadernar grimorio', 'grimorio', 'enchant', 6, [['mat_ojo_magico'], ['mat_cuero'], ['polvo_arcano']], 'Un ojo mágico en la tapa.'),
    R('baston_trueno', 'Tallar bastón del trueno', 'baston_trueno', 'enchant', 6, [['mat_chispa_tormenta'], ['mat_madera', 2], ['mat_esencia']], 'Madera con una tormenta adentro.'),
    R('baston_oscuro', 'Tallar bastón oscuro', 'baston_oscuro', 'enchant', 7, [['mat_cuerno_demonio'], ['mat_madera', 2]], 'Un cuerno de demonio como puño.'),
    R('cetro_abisal', 'Tallar cetro abisal', 'cetro_abisal', 'enchant', 9, [['mat_tinta_kraken'], ['mat_perla', 3], ['mat_escama_sirena']], 'Tinta de kraken, perlas y escama de sirena.'),
    R('vengador_sagrado', 'Forjar vengador sagrado', 'vengador_sagrado', 'enchant', 9, [['mat_cuerno_unicornio'], ['mat_plata']], 'El cuerno de un unicornio, hecho espada.'),
    R('ropajes_oscuros', 'Coser ropajes oscuros', 'ropajes_oscuros', 'enchant', 6, [['mat_esencia_sombra', 2]], 'Tela hecha de sombra.'),
    R('manto_brujo', 'Coser manto de brujo', 'manto_brujo', 'enchant', 6, [['mat_esencia_sombra'], ['mat_seda'], ['mat_tela', 4]], 'Seda, tela y un poco de sombra.'),
    R('armadura_cristal', 'Armar armadura de cristal', 'armadura_cristal', 'enchant', 7, [['mat_nucleo_golem'], ['mat_gema_arcana']], 'El núcleo de un gólem, hecho coraza.'),
    R('manto_celestial', 'Coser manto celestial', 'manto_celestial', 'enchant', 9, [['mat_pluma_angel'], ['mat_seda', 2]], 'Plumas de ángel sobre seda.'),
    R('plumas_fenix', 'Coser manto de plumas de fénix', 'plumas_fenix', 'enchant', 9, [['mat_ceniza_fenix', 2], ['mat_seda', 3]], 'Ceniza que se vuelve pluma.'),
  ];
  S.recipes = S.recipes || [];
  for (const r of RECIPES) if (!byId(S.recipes, r.id)) S.recipes.push(r);

  // ---------------------------------------------------------------
  // 7) Las llaves abren cofres
  // ---------------------------------------------------------------
  const KEY_OPTS = {
    cofre_enterrado: { key: 'item_llave_oxidada', label: 'Abrirlo con la llave oxidada', text: 'La llave gira con un chirrido. Adentro, bien guardado, hay más de lo que esperabas.', coins: 6, loot: 2 },
    cofre_pirata: { key: 'item_llave_laton', label: 'Abrirlo con la llave de latón', text: 'La cerradura cede sin pelear. Doblones, una botella y algo envuelto en tela.', coins: 10, loot: 2 },
    g_cofre_hierro: { key: 'item_llave_plata', label: 'Abrirlo con la llave de plata', text: 'La llave de plata entra justo. El cofre se abre solo, como si te esperara.', coins: 14, loot: 3 },
  };
  // Herramientas que antes solo servían para vender: la linterna y la cuerda
  const TOOL_OPTS = {
    eco_cueva: { label: 'Iluminar con la linterna', needs: { item: 'linterna', consume: false }, ok: { text: 'La linterna muestra lo que eran: murciélagos colgando del techo. Se van volando y, donde estaban, brilla algo.', loot: 1, xp: 0.3 } },
    paso_estrecho: { label: 'Atarte con la cuerda y cruzar', needs: { item: 'cuerda', consume: false }, ok: { text: 'Atás la cuerda a una roca y cruzás sin apuro. Del otro lado encontrás el bolso de alguien que no tuvo cuerda.', coins: 3, loot: 1, xp: 0.3 } },
    vagoneta: { label: 'Iluminar con la linterna', needs: { item: 'linterna', consume: false }, ok: { text: 'Con luz se ve el camino entre las vías: al final hay mineral que nadie se llevó.', items: [['mineral_hierro', 1, 2]], xp: 0.25 } },
  };
  for (const ev of S.events || []) {
    const t = TOOL_OPTS[ev.id];
    if (t && Array.isArray(ev.options) && !ev.options.some((o) => o.needs && o.needs.item === t.needs.item)) ev.options.splice(Math.max(0, ev.options.length - 1), 0, t);
  }
  for (const ev of S.events || []) {
    const k = KEY_OPTS[ev.id];
    if (!k || !Array.isArray(ev.options) || ev.options.some((o) => o.needs && o.needs.item === k.key)) continue;
    ev.options.splice(Math.max(0, ev.options.length - 1), 0, {
      label: k.label, needs: { item: k.key },
      ok: { text: k.text, coins: k.coins, loot: k.loot, xp: 0.25 },
    });
  }

  // ---------------------------------------------------------------
  // 8) Misiones acordes a lo que sueltan las criaturas
  //    (medido con tools: con la misión activa, las que tienen lo pedido salen más seguido;
  //     acá se suman fuentes a lo que solo tenía una criatura fuerte)
  // ---------------------------------------------------------------
  const addDrop = (enemyId, itemId, chance) => {
    const e = byId(S.enemies, enemyId);
    if (!e) return;
    e.drops = e.drops || [];
    if (!e.drops.some((d) => d.itemId === itemId)) e.drops.push({ itemId, chance, source: 'v39' });
  };
  const addFind = (regionId, itemId, chance) => {
    const r = byId(S.regions, regionId);
    if (!r) return;
    r.events = r.events || [];
    if (!r.events.some((ev) => ev.type === 'find' && ev.reward === itemId)) r.events.push({ type: 'find', chance, reward: itemId });
  };
  // Rosas carmesí: antes solo la noble vampira (criatura fuerte): 10 peleas para tres rosas
  addDrop('siervo_sangre', 'rosa_carmesi', 0.3);
  addDrop('vampiro', 'rosa_carmesi', 0.35);
  addFind('jardin_carmesi', 'rosa_carmesi', 12);
  // Perlitas: antes solo los ahogados
  addDrop('cangrejo', 'perla_pequeña', 0.3);
  addFind('costa_naufragios', 'perla_pequeña', 8);
  // Colmillos de hidra: la hidra suelta siempre el suyo
  const hidra = byId(S.enemies, 'hidra');
  if (hidra) for (const d of hidra.drops || []) if (d.itemId === 'mat_colmillo_hidra') d.chance = Math.max(d.chance || 0, 0.9);
})(window.Aventurs);
