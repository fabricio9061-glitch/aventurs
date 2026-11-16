/* ============================================================
   Aventurs — Seed: Items
   Monedas, consumibles, materiales.

   subtype:
     coin       -> stack ilimitado, slot dedicado
     potion     -> consumible curativo
     food       -> consumible nutricional
     scroll     -> efecto especial
     material   -> ingrediente de crafting
     misc       -> otros (linterna, etc.)
   ============================================================ */

(function (A) {
  'use strict';

  const ITEMS = [
    // --- Monedas ---
    { id:'coin_copper', rarity:'common', name:'Moneda de cobre', type:'item', subtype:'coin', icon:'🥉', value:1, weight:0, stack:9999,
      description:'La moneda más común. Cien valen una de plata.' },
    { id:'coin_silver', rarity:'common', name:'Moneda de plata', type:'item', subtype:'coin', icon:'🥈', value:100, weight:0, stack:9999,
      description:'Cien de cobre, una de plata. Cien de plata, una de oro.' },
    { id:'coin_gold', rarity:'common', name:'Moneda de oro', type:'item', subtype:'coin', icon:'🥇', value:10000, weight:0, stack:9999,
      description:'Pesada y brillante. La paga de un mes para un guardia, el precio de un buen caballo.' },

    // --- Pociones y curativos ---
    { id:'pocion_curacion_menor', rarity:'uncommon', name:'Poción de curación menor', type:'item', subtype:'potion', icon:'🧪', value:16, weight:1,
      effect:{ type:'heal', amount:'1d8+2' }, stack:99,
      description:'Líquido rojo y dulzón. Cierra heridas pequeñas.' },
    { id:'pocion_curacion', rarity:'uncommon', name:'Poción de curación', type:'item', subtype:'potion', icon:'🧪', value:31, weight:1,
      effect:{ type:'heal', amount:'2d8+4' }, stack:99,
      description:'Brilla suavemente al moverla. Funciona en heridas serias.' },
    { id:'pocion_mana_menor', rarity:'uncommon', name:'Poción de maná menor', type:'item', subtype:'potion', icon:'🧪', value:15, weight:1,
      effect:{ type:'mana', amount:'1d6+2' }, stack:99,
      description:'Azul como agua de glaciar. Restaura un poco de maná.' },
    { id:'pocion_mana', rarity:'uncommon', name:'Poción de maná', type:'item', subtype:'potion', icon:'🧪', value:31, weight:1,
      effect:{ type:'mana', amount:'2d6+4' }, stack:99,
      description:'Frío al tacto incluso en verano. Restaura maná considerable.' },
    { id:'antidoto', rarity:'common', name:'Antídoto', type:'item', subtype:'potion', icon:'🧪', value:12, weight:1,
      effect:{ type:'cure', status:'poison' }, stack:99,
      description:'Verde y amargo. Limpia el veneno de la sangre.' },
    { id:'elixir_fuerza', rarity:'rare', name:'Elixir de fuerza', type:'item', subtype:'potion', icon:'🧪', value:50, weight:1,
      effect:{ type:'buff', stat:'damage', amount:2, duration:5 }, stack:99,
      description:'Sabe a hierro. Las manos tiemblan de poder durante un rato.' },

    // === v1.7.2: Consumibles y amuletos crafteables con materiales de bioma ===
    { id:'te_de_hierbas', rarity:'uncommon', name:'Té de hierbas', type:'item', subtype:'potion', icon:'🍵', value:19, weight:0,
      healAmount:8, stack:99,
      description:'Hierbas silvestres hervidas. Calma el cuerpo y cierra heridas leves.' },
    { id:'pocion_lodo', rarity:'uncommon', name:'Poción de lodo curativo', type:'item', subtype:'potion', icon:'🟤', value:34, weight:0,
      healAmount:14, stack:99,
      description:'Hongos de pantano macerados. Huele horrible, sana bien.' },
    { id:'amuleto_fuego', rarity:'epic', name:'Amuleto de fuego', type:'item', subtype:'material', icon:'🔥', value:450, weight:0, stack:1,
      description:'Una gema ígnea engarzada en obsidiana. Irradia un calor protector. Permite resistir el calor extremo de zonas volcánicas.' },
    { id:'talisman_arcano', rarity:'epic', name:'Talismán arcano', type:'item', subtype:'material', icon:'🔮', value:320, weight:0, stack:1,
      description:'Cristal de maná atado con polvo arcano. Vibra cerca de la magia antigua.' },
    { id:'sal_conservante', rarity:'uncommon', name:'Carne salada', type:'item', subtype:'food', icon:'🥩', value:14, weight:1,
      foodValue:12, stack:99,
      description:'Carne curada con sal de dunas. Dura semanas sin pudrirse.' },
    { id:'collar_perlas', rarity:'epic', name:'Collar de perlas', type:'item', subtype:'material', icon:'📿', value:600, weight:0, stack:1,
      description:'Perlas pequeñas hiladas en hilo de plata. Vale una fortuna en cualquier mercado.' },

    // --- Comida ---
    { id:'pan', rarity:'common', name:'Pan', type:'item', subtype:'food', icon:'🍞', value:4, weight:0,
      effect:{ type:'food', amount:3 }, stack:99,
      description:'Duro pero llena.' },
    { id:'queso', rarity:'common', name:'Queso', type:'item', subtype:'food', icon:'🧀', value:6, weight:0,
      effect:{ type:'food', amount:5 }, stack:99,
      description:'Curado por meses. Resiste cualquier camino.' },
    { id:'carne_seca', rarity:'common', name:'Carne seca', type:'item', subtype:'food', icon:'🥩', value:10, weight:0,
      effect:{ type:'food', amount:8 }, stack:99,
      description:'Salada y dura. Sostiene a un hombre días enteros.' },

    // --- Pergaminos / Misc ---
    { id:'pergamino_escape', rarity:'uncommon', name:'Pergamino de escape', type:'item', subtype:'scroll', icon:'📜', value:40, weight:0,
      effect:{ type:'escape' }, stack:10,
      description:'Al romperlo, el aire se cierra a tu alrededor y te lleva lejos del peligro.' },
    { id:'linterna', rarity:'common', name:'Linterna', type:'item', subtype:'misc', icon:'🔦', value:25, weight:1,
      description:'Aceite y mecha. Espanta más que la oscuridad.' },
    { id:'cuerda', rarity:'common', name:'Cuerda', type:'item', subtype:'misc', icon:'🪢', value:10, weight:1,
      description:'Diez metros de cáñamo trenzado. Más útil de lo que parece.' },

    // --- Items de doma (Fase 2) ---
    { id:'carne_cruda', rarity:'common', name:'Carne cruda', type:'item', subtype:'tame', icon:'🥩', value:5, weight:0, stack:99,
      description:'Trozo sangrante. Las bestias la huelen a una legua.' },
    { id:'pescado_fresco', rarity:'common', name:'Pescado fresco', type:'item', subtype:'tame', icon:'🐟', value:8, weight:0, stack:99,
      description:'Recién sacado del agua. Útil con bestias marinas.' },
    { id:'semillas', rarity:'common', name:'Semillas', type:'item', subtype:'tame', icon:'🌾', value:3, weight:0, stack:99,
      description:'Granos secos. Atraen aves y criaturas pequeñas.' },

    // --- Carnes específicas (drops de combate, comestibles tras cocinar) ---
    { id:'carne_bestia', rarity:'common', name:'Carne de bestia', type:'item', subtype:'food', icon:'🥩', value:4, weight:0, stack:99, foodValue:3,
      description:'Carne roja de mamífero salvaje. Sustanciosa, alimenta bien después de cocinada.' },
    { id:'carne_ave', rarity:'common', name:'Carne de ave', type:'item', subtype:'food', icon:'🍗', value:2, weight:0, stack:99, foodValue:2,
      description:'Carne blanca de pájaro. Más liviana que la de bestia, igual te llena.' },
    { id:'carne_pez', rarity:'common', name:'Carne de pez', type:'item', subtype:'food', icon:'🐟', value:2, weight:0, stack:99, foodValue:2,
      description:'Filete fresco. Si lo dejás más de un día sin cocinar, te arrepentís.' },
    { id:'carne_reptil', rarity:'common', name:'Carne de reptil', type:'item', subtype:'food', icon:'🦎', value:2, weight:0, stack:99, foodValue:2,
      description:'Sabe rara, pero alimenta. Mejor con sal y mucho fuego.' },
    { id:'carne_dragon', rarity:'common', name:'Carne de dragón', type:'item', subtype:'food', icon:'🐲', value:10, weight:0, stack:99, foodValue:8,
      description:'Trozo del bicho más temible que mataste. Calienta el cuerpo aunque esté cruda.' },
    { id:'carne_insecto', rarity:'common', name:'Pulpa de insecto', type:'item', subtype:'food', icon:'🦗', value:2, weight:0, stack:99, foodValue:1,
      description:'Pulpa amarillenta de exoesqueleto. No es lujo, pero te saca de un mal día.' },
    { id:'carne_gigante', rarity:'common', name:'Carne de gigante', type:'item', subtype:'food', icon:'🍖', value:7, weight:1, stack:50, foodValue:6,
      description:'Pieza enorme. Una sola te alcanza para tres comidas.' },

    // --- Pergaminos de hechizo (Fase 3) ---
    // Cada pergamino enseña un hechizo al usarlo. Drops de enemigos arcanos.
    { id:'pergamino_chispa', rarity:'uncommon', name:'Pergamino: Chispa', type:'item', subtype:'scroll_spell', icon:'📜', value:80, weight:0, stack:10,
      teachesSpell:'chispa',
      description:'Tinta de plata sobre vitela. Al leerlo en voz alta, el hechizo se graba en tu mente.' },
    { id:'pergamino_llama', rarity:'uncommon', name:'Pergamino: Llama', type:'item', subtype:'scroll_spell', icon:'📜', value:160, weight:0, stack:10,
      teachesSpell:'llama',
      description:'Bordes chamuscados. Las palabras parecen arder cuando las miras fijo.' },
    { id:'pergamino_rayo_helado', rarity:'uncommon', name:'Pergamino: Rayo helado', type:'item', subtype:'scroll_spell', icon:'📜', value:160, weight:0, stack:10,
      teachesSpell:'rayo_helado',
      description:'El rollo está frío al tacto, aunque haga calor.' },
    { id:'pergamino_curacion', rarity:'uncommon', name:'Pergamino: Curación', type:'item', subtype:'scroll_spell', icon:'📜', value:200, weight:0, stack:10,
      teachesSpell:'curacion',
      description:'Tinta dorada sobre pergamino blanco. Huele a hierbas frescas.' },
    { id:'pergamino_bola_fuego', rarity:'rare', name:'Pergamino: Bola de fuego', type:'item', subtype:'scroll_spell', icon:'📜', value:600, weight:0, stack:10,
      teachesSpell:'bola_de_fuego',
      description:'Sello quebrado de un mago muerto. Manos torpes no deberían tocarlo.' },
    { id:'pergamino_tormenta', rarity:'epic', name:'Pergamino: Tormenta arcana', type:'item', subtype:'scroll_spell', icon:'📜', value:1500, weight:0, stack:5,
      teachesSpell:'tormenta_arcana',
      description:'El cielo se nubla cuando lo destapas. Mejor no leer adentro.' },
    { id:'pergamino_aliento_dragon', rarity:'legendary', name:'Pergamino: Aliento de dragón', type:'item', subtype:'scroll_spell', icon:'📜', value:5000, weight:0, stack:3,
      teachesSpell:'aliento_de_dragon',
      description:'Escrito en sangre dracónica. Solo magos con sangre antigua pueden leerlo sin morir.' },

    // --- Bolsas como items (v1.5.1) ---
    // Los items con subtype 'bag' se "usan" para equipar la bolsa correspondiente.
    // Los recibís como drop de enemigos o comprándolos a NPCs.
    { id:'item_bag_reforzada', rarity:'common', name:'Mochila reforzada', type:'item', subtype:'bag', icon:'🎒', value:90, weight:0, stack:1,
      equipsBag:'bag_reforzada',
      description:'Cuero curtido sobre lona. 14 espacios. Úsala para reemplazar tu mochila actual.' },
    { id:'item_bag_large', rarity:'uncommon', name:'Mochila grande', type:'item', subtype:'bag', icon:'🎒', value:250, weight:0, stack:1,
      equipsBag:'bag_large',
      description:'Una buena bolsa. 16 espacios. Úsala para reemplazar tu mochila actual.' },
    { id:'item_bag_advanced', rarity:'rare', name:'Mochila avanzada', type:'item', subtype:'bag', icon:'🎒', value:700, weight:0, stack:1,
      equipsBag:'bag_advanced',
      description:'Cosida con cuero de bestia y broches de hierro. 24 espacios. Úsala para reemplazar tu mochila actual.' },
    { id:'item_bag_arcane', rarity:'epic', name:'Mochila arcana', type:'item', subtype:'bag', icon:'🎒', value:2000, weight:0, stack:1,
      equipsBag:'bag_arcane',
      description:'Por dentro es más grande que por fuera. 32 espacios. Solo magos saben cómo se hacen.' },

    // --- Materiales de crafting ---
    { id:'mat_hierro', rarity:'common', name:'Lingote de hierro', type:'item', subtype:'material', icon:'⛓️', value:22, weight:1, stack:99,
      description:'Metal común, base de toda forja honesta.' },
    { id:'mat_cuero', rarity:'uncommon', name:'Cuero curtido', type:'item', subtype:'material', icon:'🟫', value:16, weight:1, stack:99,
      description:'Tira de cuero curtido. Para armaduras y correas.' },
    { id:'mat_madera', rarity:'common', name:'Madera dura', type:'item', subtype:'material', icon:'🪵', value:7, weight:1, stack:99,
      description:'Roble, fresno, ébano. Madera para mangos y bastones.' },
    { id:'mat_hueso', rarity:'uncommon', name:'Hueso', type:'item', subtype:'material', icon:'🦴', value:16, weight:1, stack:99,
      description:'Hueso limpio, útil en talismanes y empuñaduras.' },
    { id:'mat_colmillo', rarity:'rare', name:'Colmillo', type:'item', subtype:'material', icon:'🦷', value:25, weight:0, stack:99,
      description:'Diente de bestia. Algunos sirven como arma improvisada.' },
    { id:'mat_piel_lobo', rarity:'uncommon', name:'Piel de lobo', type:'item', subtype:'material', icon:'🐺', value:16, weight:1, stack:99,
      description:'Pelaje gris. Caliente, resistente, codiciado.' },
    { id:'mat_veneno', rarity:'rare', name:'Glándula de veneno', type:'item', subtype:'material', icon:'🟢', value:25, weight:0, stack:99,
      description:'Pulpa verde y viscosa. Untar una hoja con esto cambia las reglas.' },
    { id:'mat_escama_dragon', rarity:'rare', name:'Escama de dragón', type:'item', subtype:'material', icon:'🐉', value:160, weight:0, stack:99,
      description:'Pesada como el plomo, dura como el acero. Pieza rarísima.' },
    { id:'mat_sangre_dragon', rarity:'epic', name:'Sangre de dragón', type:'item', subtype:'material', icon:'🩸', value:401, weight:0, stack:99,
      description:'Hierve a temperatura ambiente. Ingrediente de todo lo prohibido.' },
    { id:'mat_esencia', rarity:'rare', name:'Esencia espectral', type:'item', subtype:'material', icon:'💨', value:76, weight:0, stack:99,
      description:'Bruma luminosa atrapada en frasco. Lo que queda cuando los muertos se rinden.' },
    { id:'mat_gema_arcana', rarity:'epic', name:'Gema arcana', type:'item', subtype:'material', icon:'💎', value:91, weight:0, stack:99,
      description:'Cristal con luz interior. Las usan los magos como pilas.' },

    /* ====== Metales y minerales ====== */
    { id:'mat_acero', rarity:'rare', name:'Lingote de acero', type:'item', subtype:'material', icon:'⚒️', value:60, weight:1, stack:99,
      description:'Hierro forjado y carburado. Más duro, más caro, irrompible bajo presión normal.' },
    { id:'mat_plata', rarity:'rare', name:'Lingote de plata', type:'item', subtype:'material', icon:'🤍', value:80, weight:1, stack:99,
      description:'Brilla suave, repele lo impío. Forjadores la usan para armas contra no-muertos.' },
    { id:'mat_oro', rarity:'epic', name:'Lingote de oro', type:'item', subtype:'material', icon:'🟨', value:300, weight:1, stack:99,
      description:'Pesado, blando, deseado. Sirve poco como arma, mucho como soborno.' },
    { id:'mat_cobre', rarity:'common', name:'Lingote de cobre', type:'item', subtype:'material', icon:'🟧', value:8, weight:1, stack:99,
      description:'Maleable y conductor. Base de aleaciones y de los conjuros eléctricos.' },
    { id:'mat_carbon', rarity:'common', name:'Carbón', type:'item', subtype:'material', icon:'⚫', value:5, weight:1, stack:99,
      description:'Necesario para forjar. Negro como la noche, caliente como el verano.' },

    /* ====== Telas, cueros y fibras ====== */
    { id:'mat_cuero_grueso', rarity:'uncommon', name:'Cuero grueso', type:'item', subtype:'material', icon:'🟫', value:34, weight:1, stack:99,
      description:'Curtido de bestia mayor. Resiste lo que el cuero común no.' },
    { id:'mat_tela', rarity:'common', name:'Tela', type:'item', subtype:'material', icon:'🧵', value:11, weight:0, stack:99,
      description:'Lino y lana tejidos. Para túnicas, vendas y velas.' },
    { id:'mat_seda', rarity:'rare', name:'Seda', type:'item', subtype:'material', icon:'🪷', value:111, weight:0, stack:99,
      description:'Hilo brillante de gusano de seda. Liviana y firme.' },
    { id:'mat_hilo', rarity:'common', name:'Hilo', type:'item', subtype:'material', icon:'🪡', value:3, weight:0, stack:99,
      description:'Para coser cuero, tela o ego herido.' },
    { id:'mat_cuerda', rarity:'common', name:'Cuerda', type:'item', subtype:'material', icon:'🪢', value:11, weight:0, stack:99,
      description:'Trenzada de cáñamo. Salva vidas, mata bandidos.' },

    /* ====== Gemas ====== */
    { id:'mat_rubi', rarity:'epic', name:'Rubí', type:'item', subtype:'material', icon:'🔴', value:250, weight:0, stack:99,
      description:'Rojo como brasa. Almacena calor mágico.' },
    { id:'mat_zafiro', rarity:'epic', name:'Zafiro', type:'item', subtype:'material', icon:'🔵', value:250, weight:0, stack:99,
      description:'Azul profundo. Vibra con los hechizos de hielo.' },
    { id:'mat_esmeralda', rarity:'epic', name:'Esmeralda', type:'item', subtype:'material', icon:'🟢', value:250, weight:0, stack:99,
      description:'Verde como hoja joven. Ligada a la vida y los venenos.' },
    { id:'mat_diamante', rarity:'legendary', name:'Diamante', type:'item', subtype:'material', icon:'💠', value:800, weight:0, stack:99,
      description:'Cristal eterno. Solo el diamante corta el diamante.' },
    { id:'mat_amatista', rarity:'epic', name:'Amatista', type:'item', subtype:'material', icon:'🟣', value:180, weight:0, stack:99,
      description:'Violeta tornasolado. Aclara la mente del que la mira.' },
    { id:'mat_topacio', rarity:'epic', name:'Topacio', type:'item', subtype:'material', icon:'🟡', value:160, weight:0, stack:99,
      description:'Amarillo solar. Calienta cuando se sostiene.' },

    /* ====== Partes orgánicas básicas ====== */
    { id:'mat_garra', rarity:'uncommon', name:'Garra', type:'item', subtype:'material', icon:'🪨', value:11, weight:0, stack:99,
      description:'Curva, dura, manchada. De algo que no quiso soltar.' },
    { id:'mat_cuerno', rarity:'common', name:'Cuerno', type:'item', subtype:'material', icon:'🐂', value:22, weight:1, stack:99,
      description:'Material para mangos, copas y silbidos de batalla.' },
    { id:'mat_escama', rarity:'uncommon', name:'Escama', type:'item', subtype:'material', icon:'🐟', value:16, weight:0, stack:99,
      description:'Dura y articulada. De pez, reptil o algo que prefiere no contarte.' },
    { id:'mat_piel', rarity:'uncommon', name:'Piel', type:'item', subtype:'material', icon:'🟫', value:11, weight:1, stack:99,
      description:'Sin curtir. Hay que trabajarla antes de usarla.' },
    { id:'mat_pluma', rarity:'uncommon', name:'Pluma', type:'item', subtype:'material', icon:'🪶', value:11, weight:0, stack:99,
      description:'Liviana y vistosa. Para flechas, plumines o buenos sombreros.' },
    { id:'mat_ala_murcielago', rarity:'rare', name:'Ala de murciélago', type:'item', subtype:'material', icon:'🦇', value:25, weight:0, stack:99,
      description:'Membrana fina con olor a noche húmeda.' },
    { id:'mat_ojo_magico', rarity:'epic', name:'Ojo mágico', type:'item', subtype:'material', icon:'👁️', value:200, weight:0, stack:99,
      description:'Te mira aunque vos no lo mires.' },
    { id:'mat_corazon', rarity:'rare', name:'Corazón', type:'item', subtype:'material', icon:'❤️', value:60, weight:0, stack:99,
      description:'Todavía tibio. Algunos rituales no funcionan sin uno.' },
    { id:'mat_gelatina', rarity:'common', name:'Gelatina', type:'item', subtype:'material', icon:'🟢', value:7, weight:0, stack:99,
      description:'Lo que dejó el slime. Pegajosa, ligeramente ácida.' },
    { id:'mat_ectoplasma', rarity:'rare', name:'Ectoplasma', type:'item', subtype:'material', icon:'👻', value:76, weight:0, stack:99,
      description:'Sustancia espectral. Sale de los muertos enojados.' },
    { id:'mat_esencia_sombra', rarity:'rare', name:'Esencia de sombra', type:'item', subtype:'material', icon:'🌑', value:160, weight:0, stack:99,
      description:'No proyecta sombra. Ella ES la sombra.' },

    /* ====== Esencias elementales ====== */
    { id:'mat_brasa_elemental', rarity:'rare', name:'Brasa elemental', type:'item', subtype:'material', icon:'🔥', value:76, weight:0, stack:99,
      description:'Arde sin consumirse. Quema al tacto descuidado.' },
    { id:'mat_esencia_hielo', rarity:'rare', name:'Esencia de hielo', type:'item', subtype:'material', icon:'❄️', value:120, weight:0, stack:99,
      description:'No se derrite. Apaga llamas con solo acercarse.' },
    { id:'mat_chispa_tormenta', rarity:'rare', name:'Chispa de tormenta', type:'item', subtype:'material', icon:'⚡', value:140, weight:0, stack:99,
      description:'Crepita en la mano. Mejor con guantes aislantes.' },

    /* ====== Partes específicas de bestia ====== */
    { id:'mat_piel_oso', rarity:'uncommon', name:'Piel de oso', type:'item', subtype:'material', icon:'🐻', value:34, weight:1, stack:99,
      description:'Gruesa y peluda. Calienta, también le cae bien al pueblo.' },
    { id:'mat_cola_rata', rarity:'common', name:'Cola de rata', type:'item', subtype:'material', icon:'🐀', value:5, weight:0, stack:99,
      description:'Pequeña y rosa. La piden los alquimistas raros.' },
    { id:'mat_seda_arana', rarity:'rare', name:'Seda de araña', type:'item', subtype:'material', icon:'🕸️', value:25, weight:0, stack:99,
      description:'Más resistente que el acero por peso. Pegajosa al inicio.' },
    { id:'mat_oreja_goblin', rarity:'common', name:'Oreja de goblin', type:'item', subtype:'material', icon:'👂', value:7, weight:0, stack:99,
      description:'Trofeo despreciable. La guardia paga por cada par.' },
    { id:'mat_sangre_troll', rarity:'rare', name:'Sangre de troll', type:'item', subtype:'material', icon:'🩸', value:160, weight:0, stack:99,
      description:'Regenera al beberla. También quema la garganta.' },
    { id:'mat_ceniza_fenix', rarity:'epic', name:'Ceniza de fénix', type:'item', subtype:'material', icon:'🪶', value:842, weight:0, stack:99,
      description:'Tibia siempre. De ella renacen los que merecen otra oportunidad.' },
    { id:'mat_cuerno_unicornio', rarity:'legendary', name:'Cuerno de unicornio', type:'item', subtype:'material', icon:'🦄', value:2000, weight:1, stack:99,
      description:'Espiral perfecta. Cura cualquier veneno y maldición.' },
    { id:'mat_cuerno_demonio', rarity:'epic', name:'Cuerno de demonio', type:'item', subtype:'material', icon:'😈', value:581, weight:1, stack:99,
      description:'Negro carbón. Gritos lejanos al acercarlo al oído.' },
    { id:'mat_pluma_angel', rarity:'legendary', name:'Pluma de ángel', type:'item', subtype:'material', icon:'😇', value:1200, weight:0, stack:99,
      description:'Pesa nada y a la vez todo. Brilla suavemente en la oscuridad.' },
    { id:'mat_tinta_kraken', rarity:'rare', name:'Tinta de kraken', type:'item', subtype:'material', icon:'🦑', value:708, weight:0, stack:99,
      description:'Negra y eterna. Lo que se escribe con esto no se borra.' },
    { id:'mat_escama_sirena', rarity:'epic', name:'Escama de sirena', type:'item', subtype:'material', icon:'🧜', value:276, weight:0, stack:99,
      description:'Iridiscente. Permite respirar bajo agua un buen rato.' },
    { id:'mat_nucleo_golem', rarity:'legendary', name:'Núcleo de golem', type:'item', subtype:'material', icon:'⚙️', value:663, weight:1, stack:99,
      description:'Late con ritmo lento de piedra. Da vida a cuerpos sin alma.' },
    { id:'mat_craneo', rarity:'uncommon', name:'Cráneo', type:'item', subtype:'material', icon:'💀', value:16, weight:1, stack:99,
      description:'Vacío. Lo que quedó cuando todo lo demás se fue.' },
    { id:'mat_carne_zombi', rarity:'common', name:'Carne de zombi', type:'item', subtype:'material', icon:'🧟', value:7, weight:1, stack:99,
      description:'Olor inmencionable. Algunos rituales la requieren fresca.' },
    { id:'mat_garra_licantropo', rarity:'rare', name:'Garra de licántropo', type:'item', subtype:'material', icon:'🐺', value:160, weight:0, stack:99,
      description:'Negra como brea. Corta plata sin perder filo.' },
    { id:'mat_colmillo_vampiro', rarity:'rare', name:'Colmillo de vampiro', type:'item', subtype:'material', icon:'🦇', value:232, weight:0, stack:99,
      description:'Hueco por dentro. Aún tiene sed.' },
    { id:'mat_ojo_basilisco', rarity:'legendary', name:'Ojo de basilisco', type:'item', subtype:'material', icon:'🐍', value:700, weight:0, stack:99,
      description:'Sigue mirando. No lo abras directo, mejor de costado.' },
    { id:'mat_colmillo_hidra', rarity:'rare', name:'Colmillo de hidra', type:'item', subtype:'material', icon:'🐲', value:489, weight:0, stack:99,
      description:'Crece de nuevo si se lo arranca al monstruo. Por suerte no en tu inventario.' },
    { id:'mat_pua_manticora', rarity:'rare', name:'Púa de mantícora', type:'item', subtype:'material', icon:'🦂', value:232, weight:0, stack:99,
      description:'Punta retorcida con veneno paralizante.' },
    { id:'mat_melena_quimera', rarity:'rare', name:'Melena de quimera', type:'item', subtype:'material', icon:'🦁', value:337, weight:1, stack:99,
      description:'Tres tipos de pelo en una. Caótica como la criatura.' },

    /* ====== Marítimos ====== */
    { id:'mat_perla', rarity:'rare', name:'Perla', type:'item', subtype:'material', icon:'⚪', value:111, weight:0, stack:99,
      description:'Lágrima de molusco. Pequeña, perfecta, valiosa.' },
    { id:'mat_caparazon', rarity:'rare', name:'Caparazón', type:'item', subtype:'material', icon:'🐢', value:36, weight:1, stack:99,
      description:'Domo curvo de queratina. Para escudos livianos.' },
    { id:'mat_diente_tiburon', rarity:'common', name:'Diente de tiburón', type:'item', subtype:'material', icon:'🦈', value:32, weight:0, stack:99,
      description:'Triangular y dentado. Filo natural.' },

    /* ====== Hierbas y plantas ====== */
    { id:'mat_hierba_curativa', rarity:'common', name:'Hierba curativa', type:'item', subtype:'material', icon:'🌿', value:22, weight:0, stack:99,
      description:'Hojas verdes con olor a menta y abuela. Base de toda poción.' },
    { id:'mat_flor_mana', rarity:'uncommon', name:'Flor de maná', type:'item', subtype:'material', icon:'🌸', value:35, weight:0, stack:99,
      description:'Pétalos azules brillantes. Crece donde la magia respira.' },
    { id:'mat_belladona', rarity:'common', name:'Belladona', type:'item', subtype:'material', icon:'🍇', value:46, weight:0, stack:99,
      description:'Bayas oscuras y muerte dulce. Útil para venenos y para sicarios.' },
    { id:'mat_raiz_arcana', rarity:'uncommon', name:'Raíz arcana', type:'item', subtype:'material', icon:'🪵', value:72, weight:0, stack:99,
      description:'Late suavemente. Rezuma magia bruta.' },
    { id:'mat_hongo_rojo', rarity:'common', name:'Hongo rojo', type:'item', subtype:'material', icon:'🍄', value:46, weight:0, stack:99,
      description:'Carnoso y sospechoso. Causa visiones a los temerarios.' },
    { id:'mat_hongo_azul', rarity:'uncommon', name:'Hongo azul', type:'item', subtype:'material', icon:'🟦', value:20, weight:0, stack:99,
      description:'Brilla en cuevas. Calma la sed y los nervios.' },
    { id:'mat_loto_negro', rarity:'epic', name:'Loto negro', type:'item', subtype:'material', icon:'🪷', value:300, weight:0, stack:99,
      description:'Florece en aguas malditas. Los druidas lo veneran.' },
    { id:'mat_mandragora', rarity:'epic', name:'Mandrágora', type:'item', subtype:'material', icon:'🌱', value:180, weight:0, stack:99,
      description:'Grita al arrancarla. La raíz vale lo que el grito.' },

    /* ====== Misceláneos ====== */
    { id:'mat_vendaje', rarity:'common', name:'Vendaje', type:'item', subtype:'material', icon:'🩹', value:22, weight:0, stack:99,
      description:'Tela limpia preparada. Detiene sangrado leve.' },

    /* ====== Llaves (especiales) ====== */
    { id:'item_llave_oxidada', rarity:'common', name:'Llave oxidada', type:'item', subtype:'key', icon:'🔑', value:10, weight:0, stack:99,
      description:'Apenas funciona. Para cerraduras simples y olvidadas.' },
    { id:'item_llave_laton', rarity:'uncommon', name:'Llave de latón', type:'item', subtype:'key', icon:'🗝️', value:50, weight:0, stack:99,
      description:'Brillo amarillo. Abre cofres comunes.' },
    { id:'item_llave_plata', rarity:'rare', name:'Llave de plata', type:'item', subtype:'key', icon:'🗝️', value:200, weight:0, stack:99,
      description:'Pesada y fría. Para cofres bien guardados.' },
    { id:'item_llave_dorada', rarity:'epic', name:'Llave dorada', type:'item', subtype:'key', icon:'🗝️', value:800, weight:0, stack:99,
      description:'Brilla incluso en la oscuridad. Abre lo que vale la pena.' },

    /* ====== Drops menores adicionales (para enemigos comunes) ====== */
    { id:'mat_pelo_rata', rarity:'common', name:'Pelo de rata', type:'item', subtype:'material', icon:'🐁', value:5, weight:0, stack:99,
      description:'Sucio y áspero. A los alquimistas les sirve.' },
    { id:'mat_pata_arana', rarity:'common', name:'Pata de araña', type:'item', subtype:'material', icon:'🕷️', value:5, weight:0, stack:99,
      description:'Articulada y peluda. Útil en pociones repulsivas.' },
    { id:'mat_oreja_murcielago', rarity:'uncommon', name:'Oreja de murciélago', type:'item', subtype:'material', icon:'🦇', value:11, weight:0, stack:99,
      description:'Tan grande como su pequeña cabeza. Buena audición incluida.' },
    { id:'mat_diente_lobo', rarity:'common', name:'Diente de lobo', type:'item', subtype:'material', icon:'🐺', value:7, weight:0, stack:99,
      description:'Curvo y filoso. Para collares y trampas.' },
    { id:'mat_nariz_goblin', rarity:'common', name:'Nariz de goblin', type:'item', subtype:'material', icon:'👃', value:7, weight:0, stack:99,
      description:'Bulbosa y olorosa. Mejor no preguntes para qué la quieren.' },
    { id:'mat_dedo_esqueleto', rarity:'common', name:'Dedo de esqueleto', type:'item', subtype:'material', icon:'🦴', value:7, weight:0, stack:99,
      description:'Hueso fino y reseco. Componente de hechizos necromantes.' },
    { id:'mat_ojo_zombi', rarity:'uncommon', name:'Ojo de zombi', type:'item', subtype:'material', icon:'👁️', value:16, weight:0, stack:99,
      description:'Lechoso y blando. Aún parpadea a veces.' },
    { id:'mat_nucleo_slime', rarity:'uncommon', name:'Núcleo de slime', type:'item', subtype:'material', icon:'🟢', value:16, weight:0, stack:99,
      description:'El "cerebro" del slime. Sigue temblando.' },
    { id:'mat_cola_diablillo', rarity:'uncommon', name:'Cola de diablillo', type:'item', subtype:'material', icon:'😈', value:34, weight:0, stack:99,
      description:'Termina en punta. Caliente al tacto.' },
    { id:'mat_escama_kobold', rarity:'common', name:'Escama de kobold', type:'item', subtype:'material', icon:'🦎', value:7, weight:0, stack:99,
      description:'Pequeña y verdosa. Reflejo opaco.' },

    // === v1.7.1: Recursos por bioma específico ===

    // --- Forest ---
    { id:'hierba_silvestre', rarity:'common', name:'Hierba silvestre', type:'item', subtype:'material', icon:'🌿', value:3, weight:0, stack:99,
      description:'Hojas resistentes. Sirven para tés y vendajes.' },
    { id:'baya_negra', rarity:'common', name:'Baya negra', type:'item', subtype:'food', icon:'🫐', value:4, weight:0, foodValue:3, stack:99,
      description:'Dulce y ácida. Mancha los dedos.' },
    { id:'pluma_extraña', rarity:'uncommon', name:'Pluma extraña', type:'item', subtype:'material', icon:'🪶', value:15, weight:0, stack:99,
      description:'No es de un ave conocida. Brilla un poco con la luz.' },

    // --- Plains ---
    { id:'espiga_dorada', rarity:'common', name:'Espiga dorada', type:'item', subtype:'material', icon:'🌾', value:4, weight:0, stack:99,
      description:'Grano salvaje. Se puede moler o comer crudo.' },
    { id:'flor_silvestre', rarity:'common', name:'Flor silvestre', type:'item', subtype:'material', icon:'🌼', value:8, weight:0, stack:99,
      description:'Pétalos blancos. Los herboristas pagan por ellas.' },

    // --- Mountain ---
    { id:'fragmento_cuarzo', rarity:'uncommon', name:'Fragmento de cuarzo', type:'item', subtype:'material', icon:'💠', value:24, weight:1, stack:99,
      description:'Cristal duro y frío. Se quiebra en seis caras.' },
    { id:'mineral_hierro', rarity:'uncommon', name:'Mineral de hierro', type:'item', subtype:'material', icon:'⛏️', value:24, weight:1, stack:99,
      description:'Roca oscura con vetas. El herrero lo necesita.' },

    // --- Desert ---
    { id:'cactus_carnoso', rarity:'common', name:'Cactus carnoso', type:'item', subtype:'food', icon:'🌵', value:5, weight:1, foodValue:4, stack:99,
      description:'Espinoso por fuera, jugoso por dentro. Saca la sed.' },
    { id:'sal_de_dunas', rarity:'uncommon', name:'Sal de dunas', type:'item', subtype:'material', icon:'🧂', value:12, weight:0, stack:99,
      description:'Cristales blancos. Conserva la carne mucho tiempo.' },
    { id:'aguja_escorpion', rarity:'uncommon', name:'Aguja de escorpión', type:'item', subtype:'material', icon:'🦂', value:30, weight:0, stack:99,
      description:'Curva y fina. Aún destila algo viscoso.' },

    // --- Swamp ---
    { id:'hongo_pantanoso', rarity:'uncommon', name:'Hongo pantanoso', type:'item', subtype:'material', icon:'🍄', value:14, weight:0, stack:99,
      description:'Crece donde el agua se pudre. Útil para venenos suaves.' },
    { id:'piel_anfibio', rarity:'uncommon', name:'Piel de anfibio', type:'item', subtype:'material', icon:'🐸', value:24, weight:0, stack:99,
      description:'Resbalosa. La buscan los alquimistas.' },

    // --- Coast / Sea ---
    { id:'concha_iridiscente', rarity:'common', name:'Concha iridiscente', type:'item', subtype:'material', icon:'🐚', value:15, weight:0, stack:99,
      description:'Cambia de color según la luz. No suena al oído.' },
    { id:'perla_pequeña', rarity:'uncommon', name:'Perla pequeña', type:'item', subtype:'material', icon:'⚪', value:34, weight:0, stack:99,
      description:'Redonda y lisa. Vale lo que pesa.' },

    // --- Cave / Crypt ---
    { id:'hongo_luminoso', rarity:'uncommon', name:'Hongo luminoso', type:'item', subtype:'material', icon:'🟢', value:18, weight:0, stack:99,
      description:'Despide una luz tenue. Crece en piedra oscura.' },
    { id:'moneda_antigua', rarity:'rare', name:'Moneda antigua', type:'item', subtype:'material', icon:'🪙', value:53, weight:0, stack:99,
      description:'Lleva un rostro borrado por los siglos. Algunos coleccionistas pagan caro.' },
    { id:'fragmento_hueso_antiguo', rarity:'uncommon', name:'Fragmento de hueso antiguo', type:'item', subtype:'material', icon:'🦴', value:35, weight:0, stack:99,
      description:'Liviano y frío. Tallado con símbolos que ya nadie lee.' },

    // --- Volcano ---
    { id:'obsidiana', rarity:'uncommon', name:'Obsidiana', type:'item', subtype:'material', icon:'⬛', value:40, weight:1, stack:99,
      description:'Vidrio volcánico. Filo natural si se rompe bien.' },
    { id:'fragmento_lava', rarity:'uncommon', name:'Fragmento de lava enfriada', type:'item', subtype:'material', icon:'🟥', value:28, weight:1, stack:99,
      description:'Aún tibio al tacto. Pesa más de lo que parece.' },
    { id:'gema_ignea', rarity:'epic', name:'Gema ígnea', type:'item', subtype:'material', icon:'🔶', value:200, weight:0, stack:99,
      description:'Roja como brasa, pero fría. Vale una pequeña fortuna.' },

    // --- Ruins ---
    { id:'fragmento_runa', rarity:'rare', name:'Fragmento de runa', type:'item', subtype:'material', icon:'🪨', value:45, weight:0, stack:99,
      description:'Piedra tallada con símbolos. La mitad de algo más grande.' },
    { id:'reliquia_olvidada', rarity:'rare', name:'Reliquia olvidada', type:'item', subtype:'material', icon:'⚱️', value:111, weight:1, stack:99,
      description:'Metálica y pesada. Nadie recuerda para qué servía.' },

    // --- Arcane ---
    { id:'cristal_mana', rarity:'rare', name:'Cristal de maná', type:'item', subtype:'material', icon:'🔷', value:60, weight:0, stack:99,
      description:'Vibra en la mano. Los magos lo usan en talismanes.' },
    { id:'polvo_arcano', rarity:'uncommon', name:'Polvo arcano', type:'item', subtype:'material', icon:'✨', value:35, weight:0, stack:99,
      description:'Plateado y suave. Una pizca cambia un hechizo.' },

    // ---------- v2.1: piratas, sueños y vampiros ----------
    {"id": "ron_anejo", "rarity": "uncommon", "name": "Ron añejo", "type": "item", "subtype": "potion", "icon": "", "value": 16, "weight": 1, "effect": {"type": "heal", "amount": "1d6+3"}, "stack": 99, "description": "Quema la garganta y te devuelve el ánimo. Los piratas juran que también cura."},
    {"id": "vial_sangre", "rarity": "uncommon", "name": "Vial de sangre", "type": "item", "subtype": "potion", "icon": "", "value": 31, "weight": 1, "effect": {"type": "heal", "amount": "2d6+6"}, "stack": 99, "description": "Espesa, tibia y roja como un rubí. En Velmora la toman como vino; a vos te cierra las heridas."},
    {"id": "doblon", "rarity": "uncommon", "name": "Doblón de oro", "type": "item", "subtype": "material", "icon": "", "value": 34, "weight": 0, "stack": 99, "description": "Moneda pirata de oro macizo. Los mercaderes la aceptan sin hacer preguntas."},
    {"id": "polvo_hada", "rarity": "common", "name": "Polvo de hada", "type": "item", "subtype": "material", "icon": "", "value": 22, "weight": 0, "stack": 99, "description": "Brilla un rato en la palma y después se apaga. Los alquimistas lo usan para pociones de maná."},
    {"id": "flor_sueno", "rarity": "uncommon", "name": "Flor del sueño", "type": "item", "subtype": "material", "icon": "", "value": 50, "weight": 0, "stack": 99, "description": "Una flor pálida que solo abre de noche. Su perfume da sueño hasta a los osos."},
    {"id": "rosa_carmesi", "rarity": "common", "name": "Flor carmesí", "type": "item", "subtype": "material", "icon": "", "value": 67, "weight": 0, "stack": 99, "description": "Rosa de pétalos rojo oscuro de los jardines de Velmora. Las boticarias la pagan bien."},
  ];

  A.Seed = A.Seed || {};
  A.Seed.items = ITEMS;
})(window.Aventurs);
