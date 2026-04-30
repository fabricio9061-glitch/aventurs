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
  ];

  A.Seed = A.Seed || {};
  A.Seed.recipes = RECIPES;
})(window.Aventurs);
