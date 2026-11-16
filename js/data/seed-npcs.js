/* ============================================================
   Aventurs — Seed: NPCs
   4 NPCs hardcoded en regiones safe.

   Modelo:
     id, name, role, region, dialog [array de strings], icon, sprite,
     sells [item ids opcional, mercaderes], teaches [spell ids opcional, sages],
     prices {itemId: customPrice} opcional override de precios,
     services {restCost, healCost} opcional para tabernero/curandero.

   Roles: merchant | shopkeeper | vendor | blacksmith | innkeeper |
          tavernkeeper | healer | priest | sage | wizard | mage | quest | guard
   ============================================================ */

(function (A) {
  'use strict';

  const NPCS = [
    {
      id:'npc_mercader_pueblo',
      name:'Borgan el mercader',
      role:'merchant',
      region:'pueblo_inicial',
      icon:'🧑‍🌾',
      sprite:'',
      dialog:[
        'Compra y vende, viajero. Tengo lo que pidas si pagas bien.',
        'Las pociones siempre escasean por estos lados.',
        'Si traes pieles o colmillos limpios, te doy buen precio.',
      ],
      sells:['pocion_curacion_menor', 'pocion_mana_menor', 'antidoto', 'pan', 'queso', 'carne_seca', 'carne_cruda', 'semillas', 'cuerda', 'linterna', 'daga', 'espada_corta', 'tunica_cuero', 'item_bag_reforzada'],
      services:{},
    },
    {
      id:'npc_tabernero_pueblo',
      name:'Maela la tabernera',
      role:'tavernkeeper',
      roleName:'Tabernera',
      region:'pueblo_inicial',
      icon:'🍺',
      sprite:'',
      dialog:[
        'Sentate, viajero. La cerveza es honesta y la cama, blanda.',
        'Diez de cobre por una noche. Sin preguntas.',
        'Hay algo en el bosque, dicen. Mejor no salir de noche.',
      ],
      sells:[],
      services:{ restCost:10 },
    },
    {
      id:'npc_herrero_puerto',
      name:'Druss el herrero',
      role:'blacksmith',
      region:'puerto',
      icon:'⚒️',
      sprite:'',
      dialog:[
        'Trae materiales, hago el resto.',
        'El acero del puerto es el mejor del reino, no te lo voy a discutir.',
        'Si vas al volcán, vuelve con escamas. Te interesa lo que puedo hacer con eso.',
      ],
      sells:['hacha_de_mano', 'arco_corto', 'maza', 'lanza', 'espada_larga', 'ballesta', 'cuero_reforzado', 'brigantina', 'cota_de_malla', 'coraza_acero', 'mat_hierro', 'mat_cuero', 'item_bag_large'],
      services:{},
    },
    {
      id:'npc_sabio_torre',
      name:'Velrith el sabio',
      role:'sage',
      region:'torre_del_mago',
      icon:'🧙',
      sprite:'',
      dialog:[
        'No todo se aprende. Algunas cosas se reciben.',
        'Si tu mente es firme y tu maná suficiente, te enseño lo que sé.',
        'La magia no perdona la pereza. Tampoco yo.',
      ],
      sells:['pocion_curacion', 'pocion_mana', 'pergamino_escape', 'baston', 'varita', 'cetro_arcano', 'tabardo_arcano', 'mat_gema_arcana', 'item_bag_arcane'],
      teaches:['chispa', 'llama', 'rayo_helado', 'curacion', 'bola_de_fuego'],
      services:{},
    },
    // ---------- v2.0: dan misiones ----------
    {
      id:'npc_guardia_pueblo',
      name:'Tomas el guardia',
      role:'guard',
      region:'pueblo_inicial',
      icon:'',
      sprite:'',
      dialog:[
        'Mantené los ojos abiertos. Últimamente pasan cosas raras en el bosque.',
        'Si ves algo que vuela y escupe fuego, corré. Después me contás.',
        'El cementerio está inquieto. Los muertos no descansan como antes.',
      ],
      sells:[],
      services:{},
    },
    {
      id:'npc_capitana_puerto',
      name:'Irena la capitana',
      role:'captain',
      roleName:'Capitana del puerto',
      region:'puerto',
      icon:'',
      sprite:'',
      dialog:[
        'El mar no perdona a los distraídos. Yo tampoco.',
        'Veinte años navegando y nunca vi un cielo como el de la otra noche.',
        'Si buscás trabajo, en el Camino Real sobran bandidos.',
      ],
      sells:['pescado_fresco', 'pocion_curacion_menor', 'cuerda', 'sal_conservante'],
      services:{},
    },
  ];

  A.Seed = A.Seed || {};
  A.Seed.npcs = NPCS;
})(window.Aventurs);
