/* ============================================================
   Aventurs — Seed: Misiones (v2.0)

   Hilo principal: "La sombra del dragón" (8 capítulos, del Pueblo
   Inicial al Nido de Dragones) + encargos de los habitantes.

   Modelo:
     id, title, giver (id del NPC que la da), main (hilo principal)
     minLevel   nivel para que te la ofrezcan
     requires   id de otra misión que tiene que estar terminada
     auto       empieza sola cuando termina la anterior (sin hablar)
     offer      lo que dice el NPC al ofrecerla
     text       resumen para el diario
     objectives [{ type, ... , count }]
        kill     { enemy: id | [ids], count }   derrotar criaturas
        collect  { item, count }   juntar y ENTREGAR (se los lleva)
        have     { item }          tener el objeto (no se lo lleva)
        explore  { region, count } explorar una zona
        visit    { region }        llegar a una zona
        talk     { npc }           hablar con alguien
     turnIn     true: hay que volver con el que la dio para cobrar
     done       lo que te dicen al terminar
     reward     { coins, xp, items: [[id, cant]] } (valores fijos)
     next       la misión que sigue en la cadena
   ============================================================ */

(function (A) {
  'use strict';

  const QUESTS = [
    // ============================================================
    // Hilo principal: La sombra del dragón
    // ============================================================
    {
      id: 'mq1_humo', main: true, chapter: 1, giver: 'npc_guardia_pueblo',
      title: 'Humo sobre el bosque',
      offer: 'Anoche se vio humo sobre el Bosque Sombrío. Esta mañana encontramos árboles quemados... desde la copa para abajo. Andá a mirar qué pasa y volvé a contarme.',
      text: 'Tomas el guardia vio humo sobre el Bosque Sombrío. Explorá el bosque y volvé a contarle.',
      objectives: [{ type: 'explore', region: 'bosque_sombrio', count: 3 }],
      turnIn: true,
      done: 'Árboles quemados desde arriba y olor a azufre... Esto no lo hizo ningún incendio común.',
      reward: { xp: 30, coins: 20 },
      next: 'mq2_puerto',
    },
    {
      id: 'mq2_puerto', main: true, chapter: 2, giver: 'npc_guardia_pueblo', requires: 'mq1_humo',
      title: 'El camino del este',
      offer: 'Los mercaderes del Camino Real hablan de una sombra con alas que cruza de noche. Irena, la capitana del Puerto, vio algo desde el mar. Buscala.',
      text: 'Una sombra con alas cruza el cielo de noche. Viajá al Puerto y hablá con Irena, la capitana.',
      objectives: [{ type: 'visit', region: 'puerto' }, { type: 'talk', npc: 'npc_capitana_puerto' }],
      done: 'Irena te recibe en el muelle: "¿Vos también la viste? Entonces no estoy loca."',
      reward: { xp: 60, coins: 40 },
      next: 'mq3_sabio',
    },
    {
      id: 'mq3_sabio', main: true, chapter: 3, giver: 'npc_capitana_puerto', requires: 'mq2_puerto',
      title: 'Fuego sobre el mar',
      offer: 'Hace tres noches una llamarada cruzó el cielo hacia las montañas. Mis marineros dicen que era un dragón. Velrith, el sabio de la torre, sabe de estas cosas.',
      text: 'Irena vio una llamarada volar hacia las montañas. Preguntale al sabio Velrith en la Torre del Mago.',
      objectives: [{ type: 'talk', npc: 'npc_sabio_torre' }],
      done: 'Velrith cierra el libro despacio: "Un dragón despertó. Y no está solo."',
      reward: { xp: 80, coins: 40 },
      next: 'mq4_diablillos',
    },
    {
      id: 'mq4_diablillos', main: true, chapter: 4, giver: 'npc_sabio_torre', requires: 'mq3_sabio', minLevel: 4,
      title: 'Los sirvientes del fuego',
      offer: 'Los diablillos de las Montañas se volvieron osados: sirven a algo más grande. Derrotá a tres y traeme una de sus colas. Quiero ver qué fuego los alimenta.',
      text: 'Velrith cree que los diablillos de las Montañas sirven al dragón. Derrotá tres y llevale una cola.',
      objectives: [{ type: 'kill', enemy: 'diablillo', count: 3 }, { type: 'collect', item: 'mat_cola_diablillo', count: 1 }],
      turnIn: true,
      done: 'La cola todavía humea. "Fuego de dragón", murmura Velrith. "El nido está más allá del volcán."',
      reward: { xp: 150, coins: 80, items: [['pocion_curacion', 1]] },
      next: 'mq5_amuleto',
    },
    {
      id: 'mq5_amuleto', main: true, chapter: 5, giver: 'npc_sabio_torre', requires: 'mq4_diablillos', auto: true,
      title: 'El amuleto de fuego',
      offer: 'Nadie entra al volcán sin un Amuleto de fuego. Hace falta una gema ígnea y dos obsidianas.',
      text: 'Para entrar al Volcán necesitás un Amuleto de fuego: una gema ígnea (Montañas) y dos obsidianas (Cuevas Ancestrales). Druss, el herrero del Puerto, sabe forjarlo.',
      objectives: [{ type: 'have', item: 'amuleto_fuego' }],
      done: 'El amuleto late tibio contra tu pecho. El calor ya no te asusta.',
      reward: { xp: 250 },
      next: 'mq6_volcan',
    },
    {
      id: 'mq6_volcan', main: true, chapter: 6, giver: 'npc_sabio_torre', requires: 'mq5_amuleto', auto: true,
      title: 'El corazón del volcán',
      offer: 'Con el amuleto podés entrar al Volcán.',
      text: 'Con el amuleto puesto, llegá al Volcán. Desde ahí se ve el camino al nido.',
      objectives: [{ type: 'visit', region: 'volcan' }],
      done: 'El aire tiembla de calor. Allá arriba, entre el humo, algo grande se mueve.',
      reward: { xp: 300 },
      next: 'mq7_guardian',
    },
    {
      id: 'mq7_guardian', main: true, chapter: 7, giver: 'npc_sabio_torre', requires: 'mq6_volcan', auto: true,
      title: 'El guardián del cráter',
      offer: 'Un dragón joven cuida el paso al nido.',
      text: 'Un dragón joven cuida el paso hacia el Nido de Dragones. Derrotalo.',
      objectives: [{ type: 'kill', enemy: 'dragon_joven', count: 1 }],
      done: 'El dragón joven cae entre las rocas. El paso al nido queda libre.',
      reward: { xp: 400, coins: 300 },
      next: 'mq8_sombra',
    },
    {
      id: 'mq8_sombra', main: true, chapter: 8, giver: 'npc_sabio_torre', requires: 'mq7_guardian', auto: true,
      title: 'La sombra del dragón',
      offer: 'El dragón anciano espera en su nido.',
      text: 'El dragón anciano espera en el Nido de Dragones. Terminá con la sombra que cubre el reino.',
      objectives: [{ type: 'kill', enemy: 'dragon_anciano', count: 1 }],
      done: 'La sombra que cubría el reino se disipa. Tu nombre se va a cantar en todas las tabernas.',
      reward: { xp: 1000, coins: 1000 },
    },

    // ============================================================
    // Encargos del Pueblo Inicial
    // ============================================================
    {
      id: 'sq_colmillos', giver: 'npc_mercader_pueblo',
      title: 'Dientes de lobo',
      offer: 'Traeme tres dientes de lobo y te pago bien. Los alquimistas de la ciudad me los sacan de las manos.',
      text: 'Borgan, el mercader, te paga por tres dientes de lobo. Los lobos andan por el Bosque Sombrío y el Camino Real.',
      objectives: [{ type: 'collect', item: 'mat_diente_lobo', count: 3 }],
      turnIn: true,
      done: '"¡Lindos dientes! Tomá, te los ganaste."',
      reward: { coins: 45, items: [['pocion_curacion_menor', 2]] },
    },
    {
      id: 'sq_ratas', giver: 'npc_tabernero_pueblo',
      title: 'Ratas en el sótano',
      offer: 'Las ratas se están comiendo mis quesos. Vienen del bosque y del cementerio. Si matás cuatro, la próxima comida va por la casa.',
      text: 'Maela, la tabernera, quiere que mates cuatro ratas (comunes o gigantes).',
      objectives: [{ type: 'kill', enemy: ['rata', 'rata_gigante'], count: 4 }],
      turnIn: true,
      done: '"¡Por fin silencio en el sótano!" Maela te sirve un plato bien cargado.',
      reward: { coins: 25, xp: 25, items: [['carne_seca', 2], ['queso', 1]] },
    },
    {
      id: 'sq_huesos', giver: 'npc_guardia_pueblo', minLevel: 2,
      title: 'Huesos inquietos',
      offer: 'De noche se escuchan huesos que caminan en el cementerio. Derrotá a tres esqueletos y la gente va a dormir tranquila.',
      text: 'Tomas el guardia te pide derrotar tres esqueletos en el Cementerio.',
      objectives: [{ type: 'kill', enemy: 'esqueleto', count: 3 }],
      turnIn: true,
      done: '"Gracias. Esta noche voy a hacer la ronda sin temblar."',
      reward: { coins: 50, xp: 50 },
    },

    // ============================================================
    // Encargos del Puerto
    // ============================================================
    {
      id: 'sq_bandidos', giver: 'npc_capitana_puerto', minLevel: 3,
      title: 'Bandidos del camino',
      offer: 'Mis cargamentos no llegan: los bandidos del Camino Real los asaltan. Derrotá a tres y te pago como a un marinero.',
      text: 'Irena te paga por derrotar a tres bandidos del Camino Real.',
      objectives: [{ type: 'kill', enemy: 'bandido', count: 3 }],
      turnIn: true,
      done: '"Así me gusta. El mar y el camino, limpios."',
      reward: { coins: 120, xp: 80 },
    },
    {
      id: 'sq_perlas', giver: 'npc_capitana_puerto', minLevel: 3,
      title: 'Perlas para un collar',
      offer: 'Mi hija cumple años. Quiero regalarle un collar, pero las perlas buenas están en la costa y en alta mar. Traeme tres.',
      text: 'Irena quiere tres perlas pequeñas. Aparecen en la costa y en alta mar.',
      objectives: [{ type: 'collect', item: 'perla_pequeña', count: 3 }],
      turnIn: true,
      done: 'Irena sonríe por primera vez: "Va a estar feliz."',
      reward: { coins: 220, xp: 60 },
    },
    {
      id: 'sq_hierro', giver: 'npc_herrero_puerto', minLevel: 4,
      title: 'Hierro para la forja',
      offer: 'Se me terminó el hierro y tengo encargos atrasados. Traeme cuatro trozos de mineral de hierro de las Montañas o las Cuevas.',
      text: 'Druss, el herrero, necesita cuatro trozos de mineral de hierro.',
      objectives: [{ type: 'collect', item: 'mineral_hierro', count: 4 }],
      turnIn: true,
      done: '"Buen hierro. Con esto saco una espada por día."',
      reward: { coins: 140, xp: 90, items: [['mat_acero', 1]] },
    },

    // ============================================================
    // Encargos de la Torre del Mago
    // ============================================================
    {
      id: 'sq_polvo', giver: 'npc_sabio_torre', minLevel: 4,
      title: 'Polvo de estrellas',
      offer: 'Para mis estudios necesito polvo arcano. Se junta en el aire alrededor de esta torre, si sabés mirar. Traeme tres puñados.',
      text: 'Velrith quiere tres puñados de polvo arcano. Se encuentra viajando cerca de la Torre.',
      objectives: [{ type: 'collect', item: 'polvo_arcano', count: 3 }],
      turnIn: true,
      done: '"Excelente. La magia agradece a quien la junta con paciencia."',
      reward: { xp: 120, items: [['pocion_mana', 2]] },
    },
    // ============================================================
    // v2.1: encargos de las ciudades nuevas
    // ============================================================
    {"id": "sq_minas", "giver": "npc_herrero_piedrahonda", "minLevel": 2, "title": "Kobolds en las minas", "offer": "Los kobolds se metieron en las Minas Olvidadas y no me dejan sacar mineral. Sacame de encima a cuatro y te forjo algo que valga la pena.", "text": "Grimbold quiere que derrotes a cuatro kobolds en las Minas Olvidadas.", "objectives": [{"type": "kill", "enemy": "kobold", "count": 4}], "turnIn": true, "done": "\"¡Ja! Ya se escuchan los picos otra vez.\" Grimbold te da un martillo recién templado.", "reward": {"coins": 40, "xp": 60, "items": [["martillo_enano", 1]]}},
    {"id": "sq_cuarzo", "giver": "npc_tabernera_piedrahonda", "minLevel": 2, "title": "Cuarzo para las lámparas", "offer": "Las lámparas de la taberna funcionan con cuarzo y se me terminó. En las minas hay de sobra. Traeme dos trozos.", "text": "Brenna necesita dos fragmentos de cuarzo para las lámparas de la taberna.", "objectives": [{"type": "collect", "item": "fragmento_cuarzo", "count": 2}], "turnIn": true, "done": "\"¡Ahora sí, luz!\" Brenna te sirve una cena para el camino.", "reward": {"coins": 35, "xp": 40, "items": [["carne_seca", 2], ["pan", 2]]}},
    {"id": "sq_capitan", "giver": "npc_tabernero_calavera", "minLevel": 5, "title": "La cabeza del capitán", "offer": "Hay un capitán en el Mar de las Calaveras que no le paga a nadie, ni siquiera a mí. Hundilo y te pago el doble de lo que él debe.", "text": "Tuerto Salvo paga por derrotar al capitán pirata del Mar de las Calaveras.", "objectives": [{"type": "kill", "enemy": "capitan_pirata", "count": 1}], "turnIn": true, "done": "\"¡Por fin! Esta noche invita la casa.\" Tuerto Salvo cuenta los doblones dos veces.", "reward": {"coins": 260, "xp": 180}},
    {"id": "sq_ron", "giver": "npc_contrabandista_calavera", "minLevel": 5, "title": "Ron para el puerto", "offer": "Los piratas de la costa esconden ron del bueno. Traeme cuatro botellas y nadie se entera.", "text": "Mara compra cuatro botellas de ron añejo. Los piratas de la costa las llevan encima.", "objectives": [{"type": "collect", "item": "ron_anejo", "count": 4}], "turnIn": true, "done": "Mara guarda las botellas sin mirarlas y te pasa una bolsa pesada.", "reward": {"coins": 140, "xp": 80}},
    {"id": "sq_pesadillas", "giver": "npc_druida_santuario", "minLevel": 5, "title": "Sueños rotos", "offer": "El Bosque de los Sueños tiene pesadillas que caminan. Si derrotás a tres, el bosque va a poder descansar.", "text": "Sylveth la druida te pide derrotar tres pesadillas en el Bosque de los Sueños.", "objectives": [{"type": "kill", "enemy": "pesadilla", "count": 3}], "turnIn": true, "done": "Sylveth cierra los ojos y sonríe: \"Ya duerme tranquilo.\"", "reward": {"xp": 200, "items": [["pocion_mana", 2], ["pocion_curacion", 1]]}},
    {"id": "sq_bestias", "giver": "npc_condesa_velmora", "minLevel": 7, "title": "Sangre salvaje", "offer": "Las bestias del Jardín Carmesí nos avergüenzan. Cazalas por nosotros: tres alcanzan para que entiendan el mensaje.", "text": "La condesa Ilyana quiere que derrotes a tres bestias de sangre en el Jardín Carmesí.", "objectives": [{"type": "kill", "enemy": "bestia_sangre", "count": 3}], "turnIn": true, "done": "\"Eficiente. Me gusta.\" La condesa deja caer un saco de oro sobre la mesa.", "reward": {"coins": 420, "xp": 320}},
    {"id": "sq_flores", "giver": "npc_boticaria_velmora", "minLevel": 7, "title": "Flores entre tumbas", "offer": "La flor carmesí solo crece en el Jardín. Traeme tres y te pago en sangre... embotellada, claro.", "text": "Orsolya la boticaria quiere tres flores carmesí del Jardín Carmesí.", "objectives": [{"type": "collect", "item": "rosa_carmesi", "count": 3}], "turnIn": true, "done": "Orsolya huele las flores y se le iluminan los ojos.", "reward": {"coins": 150, "xp": 150, "items": [["vial_sangre", 2]]}},
  ];

  A.Seed = A.Seed || {};
  A.Seed.quests = QUESTS;
})(window.Aventurs);
