/* ============================================================
   Aventurs — Seed: Armaduras
   ============================================================ */

(function (A) {
  'use strict';

  const ARMORS = [
    { id:'tunica_tela', name:'Túnica de tela', type:'armor', icon:'👘', defense:0, value:15, rarity:'common', tier:1, weight:1, magic:false,
      description:'Apenas un trapo cosido. Mejor que nada.' },

    { id:'tunica_cuero', name:'Túnica de cuero', type:'armor', icon:'🥋', defense:1, value:30, rarity:'common', tier:1, weight:2, magic:false,
      description:'Cuero curtido sobre lana. Cómoda y silenciosa.' },

    { id:'cuero_reforzado', name:'Cuero reforzado', type:'armor', icon:'🦺', defense:2, value:80, rarity:'common', tier:2, weight:3, magic:false,
      description:'Placas de cuero hervido remachadas con bronce.' },

    { id:'cota_de_malla', name:'Cota de malla', type:'armor', icon:'⛓️', defense:3, value:200, rarity:'uncommon', tier:4, weight:5, slots:2,magic:false,
      description:'Anillos de hierro entrelazados. Pesa, pero detiene aceros.' },

    { id:'tabardo_arcano', name:'Tabardo arcano', type:'armor', icon:'🧥', defense:2, value:240, rarity:'uncommon', tier:4, weight:2, magic:true,
      description:'Bordado con hilos de plata. Dispersa hechizos hostiles antes de tocar la piel.' },

    { id:'armadura_placas', name:'Armadura de placas', type:'armor', icon:'🛡️', defense:5, value:500, rarity:'rare', tier:6, weight:8, slots:2,magic:false,
      description:'Acero pulido sobre cuero. Pesada como una sentencia.' },

    { id:'manto_brujo', name:'Manto del brujo', type:'armor', icon:'🧙', defense:3, value:600, rarity:'rare', tier:6, weight:2, magic:true,
      description:'Tejido con cabellos de no-muerto. Quien lo viste roba magia al aire.' },

    { id:'placa_dragon', name:'Placa de dragón', type:'armor', icon:'🐲', defense:8, value:2000, rarity:'legendary', tier:10, weight:7, slots:2,magic:true,
      description:'Forjada con escamas de dragón anciano. El fuego se desliza sin marcarla.' },
  ];

  A.Seed = A.Seed || {};
  A.Seed.armors = ARMORS;
})(window.Aventurs);
