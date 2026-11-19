/* ============================================================
   Aventurs — Seed: NPCs
   4 NPCs hardcoded en regiones safe.

   Modelo:
     id, name, role, region, dialog [array de strings], icon, sprite,
     sells [item ids opcional, mercaderes], teaches [spell ids opcional, sages],
     prices {itemId: customPrice} opcional override de precios,
     services {restCost, healCost} opcional para tabernero/curandero.
     crafts ['forge'|'alchemy'|'enchant'] opcional (v3.3): qué taller tiene.
       Los herreros, si no dicen nada, tienen forja y encantamiento.

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
      sells:['hierba_vida'],
      services:{ restCost:10 },
      // v3.3: con lo que juntes, te prepara pociones
      crafts:['alchemy'],
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
      teaches:['chispa', 'llama', 'rayo_helado', 'curacion', 'segundo_aliento', 'bola_de_fuego'],
      services:{},
      // v3.3: encantamientos (bastones, amuletos, talismanes) y también pociones
      crafts:['enchant', 'alchemy'],
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
    // ---------- v2.1: ciudades nuevas ----------
    {"id": "npc_herrero_piedrahonda", "name": "Grimbold el herrero", "role": "blacksmith", "region": "aldea_piedrahonda", "icon": "", "sprite": "", "look": "dwarf", "dialog": ["El acero enano no se dobla. Tampoco yo.", "Las minas de al lado se llenaron de kobolds. Me quedé sin mineral.", "Si me traés material, te hago lo que pidas."], "sells": ["martillo_enano", "hacha_de_mano", "maza", "lanza", "cuero_reforzado", "cota_de_malla", "mat_hierro", "item_bag_reforzada"], "services": {}},
    {"id": "npc_tabernera_piedrahonda", "name": "Brenna", "role": "tavernkeeper", "roleName": "Tabernera de El Martillo y la Gema", "region": "aldea_piedrahonda", "icon": "", "sprite": "", "look": "dwarf_woman", "dialog": ["¡Bienvenido a El Martillo y la Gema! El estofado está caliente.", "Los mineros ya no bajan. Dicen que algo come la piedra allá abajo.", "Una cama, un plato y nadie que te moleste. Eso vendo."], "sells": ["pan", "queso", "carne_seca", "te_de_hierbas"], "services": {"restCost": 8}},
    {"id": "npc_tabernero_calavera", "name": "Tuerto Salvo", "role": "tavernkeeper", "roleName": "Tabernero pirata", "region": "puerto_calavera", "icon": "", "sprite": "", "look": "pirate", "dialog": ["Acá no se pregunta nombre ni pasado. Se paga por adelantado.", "Perdí el ojo por un doblón. Valió la pena.", "Si ves velas negras en el horizonte, corré."], "sells": ["ron_anejo", "pescado_fresco", "carne_seca"], "services": {"restCost": 15}},
    {"id": "npc_contrabandista_calavera", "name": "Mara la contrabandista", "role": "merchant", "roleName": "Contrabandista", "region": "puerto_calavera", "icon": "", "sprite": "", "look": "pirate_woman", "dialog": ["Lo que buscás lo tengo. Lo que no buscás, también.", "No preguntes de dónde salió. Preguntá cuánto cuesta.", "El ron se vende solo. La discreción, más cara."], "sells": ["sable_pirata", "ron_anejo", "pocion_curacion", "antidoto", "cuerda", "linterna", "ballesta", "item_bag_large"], "services": {}},
    {"id": "npc_druida_santuario", "name": "Sylveth la druida", "role": "sage", "roleName": "Druida", "region": "santuario_roble", "icon": "", "sprite": "", "look": "druid", "dialog": ["El bosque sueña. Y últimamente tiene pesadillas.", "Caminá despacio. Acá todo escucha.", "Las hadas no son malas. Solo aburridas."], "sells": ["hierba_vida", "pocion_curacion", "pocion_mana", "te_de_hierbas", "mat_hierba_curativa", "baston", "varita"], "teaches": ["curacion", "segundo_aliento", "rayo_helado", "llama"], "services": {}, "crafts": ["alchemy"]},
    {"id": "npc_condesa_velmora", "name": "Condesa Ilyana", "role": "noble", "roleName": "Noble de Velmora", "region": "velmora", "icon": "", "sprite": "", "look": "noble", "dialog": ["Un mortal en Velmora. Qué... refrescante.", "Nosotros no cazamos. Ya no. Los salvajes del jardín, en cambio...", "La noche es larga. Tenemos tiempo para negocios."], "sells": [], "services": {}},
    {"id": "npc_boticaria_velmora", "name": "Orsolya la boticaria", "role": "merchant", "roleName": "Boticaria", "region": "velmora", "icon": "", "sprite": "", "look": "noble_apothecary", "dialog": ["¿Sangre, hierbas o venenos? Todo en frascos elegantes.", "La flor carmesí solo crece entre tumbas. Por eso es tan cara.", "No temas. Acá los clientes vuelven siempre."], "sells": ["hierba_vida", "vial_sangre", "pocion_curacion", "pocion_mana", "antidoto", "elixir_fuerza", "katana", "espada_runica"], "services": {"restCost": 40}, "crafts": ["alchemy"]},
  ];

  A.Seed = A.Seed || {};
  A.Seed.npcs = NPCS;
})(window.Aventurs);
