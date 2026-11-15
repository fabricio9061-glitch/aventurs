/* ============================================================
   Aventurs — Seed: Armaduras (v1.8.0)
   defense: resta daño a cada golpe recibido.
   dodge (armaduras mágicas): suma a tu defensa (más difícil que te peguen).
   Peso: si arma + armadura pesan más de 4, cada punto extra resta velocidad.
   ============================================================ */

(function (A) {
  'use strict';

  const ARMORS = [
    { id:'tunica_tela', name:'Túnica de tela', type:'armor', icon:'👘', defense:0, value:10, rarity:'common', tier:1, weight:1, magic:false,
      description:'Apenas un trapo cosido. Mejor que nada.' },

    { id:'tunica_cuero', name:'Túnica de cuero', type:'armor', icon:'🥋', defense:1, value:30, rarity:'common', tier:1, weight:2, magic:false,
      description:'Cuero curtido sobre lana. Cómoda y silenciosa.' },

    { id:'cuero_reforzado', name:'Cuero reforzado', type:'armor', icon:'🦺', defense:2, value:44, rarity:'common', tier:2, weight:3, magic:false,
      description:'Placas de cuero hervido remachadas con bronce.' },

    { id:'brigantina', name:'Brigantina', type:'armor', icon:'🦺', tier:3, rarity:'common', weight:3, magic:false, defense:2, value:63,
      description:'Chapas de hierro remachadas bajo tela gruesa. Barata y honesta.' },

    { id:'cota_de_malla', name:'Cota de malla', type:'armor', icon:'⛓️', defense:3, value:119, rarity:'uncommon', tier:4, weight:5, slots:2, magic:false,
      description:'Anillos de hierro entrelazados. Pesa, pero detiene aceros.' },

    { id:'tabardo_arcano', name:'Tabardo arcano', type:'armor', icon:'🧥', defense:2, value:119, rarity:'uncommon', tier:4, weight:2, magic:true, dodge:2,
      description:'Bordado con hilos de plata. Dispersa hechizos hostiles antes de tocar la piel.' },

    { id:'coraza_acero', name:'Coraza de acero', type:'armor', icon:'🛡️', tier:5, rarity:'uncommon', weight:5, magic:false, defense:3, value:172,
      description:'Peto y espaldar de acero templado. Suena como una campana al recibir golpes.' },

    { id:'armadura_placas', name:'Armadura de placas', type:'armor', icon:'🛡️', defense:4, value:327, rarity:'rare', tier:6, weight:8, slots:2, magic:false,
      description:'Acero pulido sobre cuero. Pesada como una sentencia.' },

    { id:'manto_brujo', name:'Manto del brujo', type:'armor', icon:'🧙', defense:3, value:327, rarity:'rare', tier:6, weight:2, magic:true, dodge:2,
      description:'Tejido con cabellos de no-muerto. Quien lo viste roba magia al aire.' },

    { id:'armadura_runica', name:'Armadura rúnica', type:'armor', icon:'🛡️', tier:7, rarity:'rare', weight:5, magic:false, defense:4, value:474,
      description:'Las runas se encienden un instante antes de cada impacto.' },

    { id:'armadura_obsidiana', name:'Armadura de obsidiana', type:'armor', icon:'⬛', tier:8, rarity:'rare', weight:6, magic:false, defense:5, value:687,
      description:'Vidrio volcánico tallado en escamas. Fría al tacto incluso junto a la lava.' },

    { id:'manto_estelar', name:'Manto estelar', type:'armor', icon:'🌌', tier:9, rarity:'epic', weight:2, magic:true, dodge:3, defense:5, value:1466,
      description:'Tejido con hilos de luz de estrellas muertas. Los golpes resbalan como si no estuvieras ahí.' },

    { id:'placa_dragon', name:'Placa de dragón', type:'armor', icon:'🐲', defense:7, value:3400, rarity:'legendary', tier:10, weight:7, slots:2, magic:true, dodge:3,
      description:'Forjada con escamas de dragón anciano. El fuego se desliza sin marcarla.' },
  ];

  A.Seed = A.Seed || {};
  A.Seed.armors = ARMORS;
})(window.Aventurs);
