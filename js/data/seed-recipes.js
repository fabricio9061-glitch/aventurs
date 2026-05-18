/* ============================================================
   Aventurs — Seed: Recetas
   Crafting solo en regiones safe con NPC herrero.

   Modelo:
     id, name, ingredients [{itemId, qty}], result itemId,
     workshop ('forge'|'alchemy'|'enchant'), tier.
   ============================================================ */

(function (A) {
  'use strict';

  const RECIPES = [
    { id:'r_daga', name:'Forjar daga', ingredients:[{itemId:'mat_hierro',qty:1},{itemId:'mat_madera',qty:1}],
      result:'daga', workshop:'forge', tier:1,
      description:'Hierro y madera dura. Cualquier herrero puede.' },

    { id:'r_espada_corta', name:'Forjar espada corta', ingredients:[{itemId:'mat_hierro',qty:2},{itemId:'mat_madera',qty:1}],
      result:'espada_corta', workshop:'forge', tier:2,
      description:'Una hoja recta y un buen mango. Lleva una mañana entera.' },

    { id:'r_tunica_cuero', name:'Coser túnica de cuero', ingredients:[{itemId:'mat_cuero',qty:2}],
      result:'tunica_cuero', workshop:'forge', tier:1,
      description:'Cuero, hilo y agua hervida. Listo en una tarde.' },

    { id:'r_cuero_reforzado', name:'Coser cuero reforzado', ingredients:[{itemId:'mat_cuero',qty:3},{itemId:'mat_hierro',qty:1}],
      result:'cuero_reforzado', workshop:'forge', tier:2,
      description:'Placas de cuero con remaches de hierro. Más resistencia.' },

    { id:'r_pocion_curacion_menor', name:'Preparar poción de curación menor', ingredients:[{itemId:'mat_piel_lobo',qty:1},{itemId:'mat_madera',qty:1}],
      result:'pocion_curacion_menor', workshop:'alchemy', tier:1,
      description:'Hierbas y grasa de lobo, hervidas con paciencia.' },

    { id:'r_antidoto', name:'Preparar antídoto', ingredients:[{itemId:'mat_veneno',qty:1},{itemId:'mat_madera',qty:1}],
      result:'antidoto', workshop:'alchemy', tier:2,
      description:'Veneno destilado contra veneno. Paradoja útil.' },

    { id:'r_espada_larga', name:'Forjar espada larga', ingredients:[{itemId:'mat_hierro',qty:4},{itemId:'mat_madera',qty:1},{itemId:'mat_cuero',qty:1}],
      result:'espada_larga', workshop:'forge', tier:4,
      description:'Más hierro, mejor temple, mejor empuñadura.' },

    { id:'r_baston_arcano', name:'Tallar bastón arcano', ingredients:[{itemId:'mat_madera',qty:2},{itemId:'mat_gema_arcana',qty:1},{itemId:'mat_sangre_dragon',qty:1}],
      result:'baston_arcano', workshop:'enchant', tier:6,
      description:'Madera teñida en sangre, gema engarzada con runas.' },

    { id:'r_colmillo_de_dragon', name:'Forjar colmillo de dragón', ingredients:[{itemId:'mat_colmillo',qty:1},{itemId:'mat_escama_dragon',qty:2},{itemId:'mat_sangre_dragon',qty:1}],
      result:'colmillo_de_dragon', workshop:'enchant', tier:10,
      description:'Solo un dios o un loco intentaría esta receta.' },

    // === v1.7.2: Recetas con materiales de bioma ===
    { id:'r_daga_obsidiana', name:'Tallar daga de obsidiana', ingredients:[{itemId:'obsidiana',qty:2},{itemId:'mat_madera',qty:1}],
      result:'daga_obsidiana', workshop:'forge', tier:3,
      description:'La obsidiana se astilla en un filo natural. Mango de madera curada.' },

    { id:'r_lanza_hueso', name:'Tallar lanza de hueso', ingredients:[{itemId:'fragmento_hueso_antiguo',qty:2},{itemId:'mat_madera',qty:1}],
      result:'lanza_hueso', workshop:'forge', tier:4,
      description:'Hueso antiguo afilado contra piedra. Liviano y mortal.' },

    { id:'r_cetro_igneo', name:'Engarzar cetro ígneo', ingredients:[{itemId:'gema_ignea',qty:1},{itemId:'fragmento_cuarzo',qty:2},{itemId:'mat_madera',qty:1}],
      result:'cetro_igneo', workshop:'enchant', tier:6,
      description:'La gema ígnea, sujeta con cuarzo, libera su calor a voluntad.' },

    { id:'r_arco_pluma', name:'Montar arco de pluma extraña', ingredients:[{itemId:'pluma_extraña',qty:2},{itemId:'mat_madera',qty:2},{itemId:'mat_cuero',qty:1}],
      result:'arco_pluma', workshop:'forge', tier:5,
      description:'Las plumas extrañas guían la flecha más lejos de lo natural.' },

    { id:'r_te_de_hierbas', name:'Preparar té de hierbas', ingredients:[{itemId:'hierba_silvestre',qty:3}],
      result:'te_de_hierbas', workshop:'alchemy', tier:1,
      description:'Hierbas silvestres hervidas con paciencia.' },

    { id:'r_pocion_lodo', name:'Macerar poción de lodo', ingredients:[{itemId:'hongo_pantanoso',qty:2},{itemId:'hierba_silvestre',qty:1}],
      result:'pocion_lodo', workshop:'alchemy', tier:2,
      description:'Hongos de pantano y hierbas. Asqueroso pero efectivo.' },

    { id:'r_amuleto_fuego', name:'Forjar amuleto de fuego', ingredients:[{itemId:'gema_ignea',qty:1},{itemId:'obsidiana',qty:2}],
      result:'amuleto_fuego', workshop:'enchant', tier:6,
      description:'Una gema ígnea sellada en obsidiana. Protege del calor extremo.' },

    { id:'r_talisman_arcano', name:'Encantar talismán arcano', ingredients:[{itemId:'cristal_mana',qty:2},{itemId:'polvo_arcano',qty:3}],
      result:'talisman_arcano', workshop:'enchant', tier:5,
      description:'Cristal de maná atado con polvo arcano. Resuena con la magia.' },

    { id:'r_sal_conservante', name:'Salar carne', ingredients:[{itemId:'sal_de_dunas',qty:2},{itemId:'carne_bestia',qty:1}],
      result:'sal_conservante', workshop:'alchemy', tier:1,
      description:'Carne curada en sal de dunas. Aguanta semanas.' },

    { id:'r_collar_perlas', name:'Hilar collar de perlas', ingredients:[{itemId:'perla_pequeña',qty:5}],
      result:'collar_perlas', workshop:'enchant', tier:4,
      description:'Cinco perlas pequeñas en hilo de plata. Una fortuna.' },
  ];

  A.Seed = A.Seed || {};
  A.Seed.recipes = RECIPES;
})(window.Aventurs);
