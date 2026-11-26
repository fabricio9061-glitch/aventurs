/* ============================================================
   Aventurs — Seed: Misiones (v3.0)

   Hilo principal: "La sombra del dragón" (18 capítulos, del Pueblo
   Inicial al Nido de Dragones, pasando por todo el mapa) + encargos
   de los habitantes de cada pueblo y ciudad.

   Modelo:
     id, title, giver (id del NPC que la da), main (hilo principal)
     chapter    número de capítulo (solo las de la historia)
     minLevel   nivel para que te la ofrezcan
     requires   id de otra misión que tiene que estar terminada
     auto       empieza sola cuando termina la anterior (sin hablar)
     offer      lo que dice el NPC al ofrecerla
     text       resumen para el diario
     objectives [{ type, ... , count }]
        kill     { enemy: id | [ids], count }   derrotar criaturas
        collect  { item, count, from? }   juntar y ENTREGAR (se los lleva)
                 from: criaturas que lo sueltan (la mitad de las veces)
                 solo mientras la misión lo pide
        have     { item }          tener el objeto (no se lo lleva)
        explore  { region, count } explorar una zona
        visit    { region }        llegar a una zona
        talk     { npc }           hablar con alguien
        text     (opcional) cómo se lee el objetivo en el diario
     turnIn     true: hay que volver con el que la dio para cobrar
     done       lo que te dicen al terminar
     reward     { coins, xp, items: [[id, cant]] } (valores fijos)
     next       la misión que sigue en la cadena

   v3.0: la experiencia de las misiones está pensada para la tabla de
   niveles nueva: hechas en su nivel dan cerca de un tercio de lo que
   pide subir; el resto sale de pelear.
   ============================================================ */

(function (A) {
  'use strict';

  const QUESTS = [
    // ============================================================
    // Hilo principal: La sombra del dragón
    // Acto I: el humo (niveles 1 a 3)
    // ============================================================
    {
      id: 'mq1_humo', main: true, chapter: 1, giver: 'npc_guardia_pueblo',
      title: 'Humo sobre el bosque',
      offer: 'Anoche se vio humo sobre el Bosque Sombrío. Esta mañana encontramos árboles quemados... desde la copa para abajo. Andá a mirar qué pasa y volvé a contarme.',
      text: 'Tomas el guardia vio humo sobre el Bosque Sombrío. Explorá el bosque y volvé a contarle.',
      objectives: [{ type: 'explore', region: 'bosque_sombrio', count: 3 }],
      turnIn: true,
      done: 'Árboles quemados desde arriba y olor a azufre... Esto no lo hizo ningún incendio común.',
      reward: { xp: 20, coins: 20 },
      next: 'mq1b_tumba',
    },
    {
      id: 'mq1b_tumba', main: true, chapter: 2, giver: 'npc_guardia_pueblo', requires: 'mq1_humo',
      title: 'Garras en la tumba',
      offer: 'Hay más. Anoche alguien abrió la cripta grande del Cementerio: la reja está doblada y la piedra tiene marcas de garras quemadas. Los muertos andan inquietos desde entonces. Fijate qué buscaban.',
      text: 'Alguien abrió la cripta grande del Cementerio y dejó marcas de garras quemadas. Explorá el Cementerio, calmá a los muertos que se levantaron y volvé con Tomas.',
      objectives: [
        { type: 'explore', region: 'cementerio', count: 2 },
        { type: 'kill', enemy: ['esqueleto', 'zombi'], count: 2 },
      ],
      turnIn: true,
      done: 'Entre los huesos revueltos encontraste una escama negra, grande como tu mano y tibia todavía. Tomas no la quiere ni tocar: "Eso no es de ningún bicho de por acá."',
      reward: { xp: 20, coins: 25, items: [['pocion_curacion_menor', 1]] },
      next: 'mq1c_aldea',
    },
    {
      id: 'mq1c_aldea', main: true, chapter: 3, giver: 'npc_guardia_pueblo', requires: 'mq1b_tumba', minLevel: 2,
      title: 'La aldea de los mineros',
      offer: 'Llevale esa escama a Grimbold, el herrero de Piedrahonda. Los enanos conocen cada metal y cada bicho que vive debajo de la tierra. Tomá el Camino Real hacia el norte.',
      text: 'Tomas quiere que Grimbold, el herrero de Piedrahonda, vea la escama negra. Llegá a la aldea y hablá con él.',
      objectives: [{ type: 'visit', region: 'aldea_piedrahonda' }, { type: 'talk', npc: 'npc_herrero_piedrahonda' }],
      done: 'Grimbold pesa la escama en la mano y deja de sonreír: "Dragón. Y de los viejos."',
      reward: { xp: 20, coins: 15 },
      next: 'mq1d_kobolds',
    },
    {
      id: 'mq1d_kobolds', main: true, chapter: 4, giver: 'npc_herrero_piedrahonda', requires: 'mq1c_aldea', minLevel: 2,
      title: 'Cantos en las minas',
      offer: 'Desde hace una semana los kobolds de las Minas Olvidadas cantan de noche. Los kobolds les rezan a los dragones, ¿sabías? Si uno despertó, lo sienten. Bajá, callalos un poco y traeme el ídolo al que le cantan.',
      text: 'Los kobolds de las Minas Olvidadas le cantan a un dragón. Explorá las minas y quitales el ídolo para que lo vea Grimbold.',
      objectives: [
        { type: 'explore', region: 'minas_olvidadas', count: 2 },
        { type: 'collect', item: 'idolo_kobold', count: 1, from: ['kobold'], text: 'Quitale el ídolo a los kobolds' },
      ],
      turnIn: true,
      done: 'Grimbold da vuelta el ídolo: un dragón negro sobre un barco en llamas. "Esto pasó en el mar. Andá al Puerto: Irena, la capitana, sabe todo lo que pasa en el agua."',
      reward: { xp: 30, coins: 30 },
      next: 'mq2_puerto',
    },
    {
      id: 'mq2_puerto', main: true, chapter: 5, giver: 'npc_herrero_piedrahonda', requires: 'mq1d_kobolds', minLevel: 3,
      title: 'El camino del este',
      offer: 'Seguí el Camino Real hasta el Puerto y buscá a Irena, la capitana. Si alguien vio un barco quemarse, fue ella.',
      text: 'El ídolo de los kobolds muestra un barco en llamas. Viajá al Puerto y hablá con Irena, la capitana.',
      objectives: [{ type: 'visit', region: 'puerto' }, { type: 'talk', npc: 'npc_capitana_puerto' }],
      done: 'Irena te recibe en el muelle: "¿Vos también la viste? Entonces no estoy loca."',
      reward: { xp: 30, coins: 30 },
      next: 'mq2b_bitacora',
    },
    {
      id: 'mq2b_bitacora', main: true, chapter: 6, giver: 'npc_capitana_puerto', requires: 'mq2_puerto', minLevel: 3,
      title: 'Lo que trajo la marea',
      offer: 'Hace tres noches una llamarada cayó del cielo sobre La Gaviota, un barco mercante, frente a la Costa de los Naufragios. No quedó nadie. Los piratas ya están saqueando los restos. Si recuperás la bitácora del capitán, vamos a saber qué vio.',
      text: 'Un barco ardió frente a la Costa de los Naufragios. Explorá la costa y recuperá la bitácora del capitán: la tienen los piratas... o el mar.',
      objectives: [
        { type: 'explore', region: 'costa_naufragios', count: 2 },
        { type: 'collect', item: 'bitacora_quemada', count: 1, from: ['grumete_pirata', 'contrabandista', 'pirata', 'ahogado'], text: 'Recuperá la bitácora (piratas y ahogados de la costa)' },
      ],
      turnIn: true,
      done: 'Irena lee la última página en voz baja: "Fuego desde el cielo. Alas negras. Iba hacia las montañas." Se queda un rato mirando el mar.',
      reward: { xp: 50, coins: 60 },
      next: 'mq3_sabio',
    },

    // Acto II: el fuego (niveles 4 a 6)
    {
      id: 'mq3_sabio', main: true, chapter: 7, giver: 'npc_capitana_puerto', requires: 'mq2b_bitacora', minLevel: 4,
      title: 'Fuego sobre el mar',
      offer: 'Alas negras que vuelan hacia las montañas... Mis marineros dicen que era un dragón. Velrith, el sabio de la torre, sabe de estas cosas. La Torre del Mago está al este del Puerto.',
      text: 'La bitácora habla de alas negras que volaban hacia las montañas. Preguntale al sabio Velrith en la Torre del Mago.',
      objectives: [{ type: 'talk', npc: 'npc_sabio_torre' }],
      done: 'Velrith cierra el libro despacio: "Un dragón despertó. Y no está solo."',
      reward: { xp: 40, coins: 30 },
      next: 'mq4_diablillos',
    },
    {
      id: 'mq4_diablillos', main: true, chapter: 8, giver: 'npc_sabio_torre', requires: 'mq3_sabio', minLevel: 4,
      title: 'Los sirvientes del fuego',
      offer: 'Los diablillos de las Montañas se volvieron osados: sirven a algo más grande. Derrotá a tres y traeme una de sus colas. Quiero ver qué fuego los alimenta.',
      text: 'Velrith cree que los diablillos de las Montañas sirven al dragón. Derrotá tres y llevale una cola.',
      objectives: [{ type: 'kill', enemy: 'diablillo', count: 3 }, { type: 'collect', item: 'mat_cola_diablillo', count: 1 }],
      turnIn: true,
      done: 'La cola todavía humea. "Fuego de dragón", murmura Velrith. "Y no de cualquiera: de uno que ya quemó este reino una vez."',
      reward: { xp: 110, coins: 80, items: [['pocion_curacion', 1]] },
      next: 'mq4b_tomo',
    },
    {
      id: 'mq4b_tomo', main: true, chapter: 9, giver: 'npc_sabio_torre', requires: 'mq4_diablillos', minLevel: 5,
      title: 'La biblioteca de Antorcha',
      offer: 'Hace trescientos años un dragón negro quemó la fortaleza de Antorcha, y alguien logró dormirlo. En su biblioteca había un tomo que contaba cómo. Hoy las ruinas están llenas de drows y magos oscuros. Traeme ese tomo.',
      text: 'En las Ruinas de Antorcha había un tomo que cuenta cómo se durmió al dragón negro. Explorá las ruinas y recuperalo: lo tiene alguno de los que viven ahí.',
      objectives: [
        { type: 'explore', region: 'ruinas_antorcha', count: 2 },
        { type: 'collect', item: 'tomo_antorcha', count: 1, from: ['drow', 'banshee', 'mago_oscuro', 'nigromante'], text: 'Recuperá el tomo (drows, banshees y magos de las ruinas)' },
      ],
      turnIn: true,
      done: 'Velrith pasa las hojas chamuscadas con cuidado. "Lo durmió una druida, con la savia del Gran Roble. Si todavía quedan druidas, van a saber qué pasó."',
      reward: { xp: 140, coins: 120 },
      next: 'mq4c_roble',
    },
    {
      id: 'mq4c_roble', main: true, chapter: 10, giver: 'npc_sabio_torre', requires: 'mq4b_tomo', minLevel: 5,
      title: 'La savia del Gran Roble',
      offer: 'Los druidas viven en el Santuario del Roble, del otro lado del Bosque de los Sueños. Se entra por el Bosque Sombrío. Cruzalo sin dormirte y hablá con quien cuide el roble.',
      text: 'Al dragón negro lo durmió una druida. Cruzá el Bosque de los Sueños hasta el Santuario del Roble y hablá con la druida.',
      objectives: [{ type: 'visit', region: 'santuario_roble' }, { type: 'talk', npc: 'npc_druida_santuario' }],
      done: 'Sylveth te escucha sin interrumpir. "El sueño de un dragón no se rompe solo. Alguien lo despertó, y a propósito."',
      reward: { xp: 60, coins: 40 },
      next: 'mq4d_sueno',
    },
    {
      id: 'mq4d_sueno', main: true, chapter: 11, giver: 'npc_druida_santuario', requires: 'mq4c_roble', minLevel: 6,
      title: 'Lo que sueña el bosque',
      offer: 'Este bosque guarda todo lo que se sueña cerca de él. Traeme dos flores del sueño y derrotá a una pesadilla: con su sombra y las flores preparo una infusión para ver quién despertó al dragón.',
      text: 'Sylveth necesita dos flores del sueño y que derrotes una pesadilla del Bosque de los Sueños para ver quién despertó al dragón.',
      objectives: [
        { type: 'collect', item: 'flor_sueno', count: 2, from: ['hada_traviesa', 'polilla_onirica'] },
        { type: 'kill', enemy: 'pesadilla', count: 1 },
      ],
      turnIn: true,
      done: 'Sylveth bebe la infusión y cierra los ojos. "Veo una túnica gris como la ceniza y una voz que le canta al dragón en una lengua muerta. Para seguirla vas a tener que cruzar el fuego."',
      reward: { xp: 180, coins: 100, items: [['pocion_mana', 1]] },
      next: 'mq5_amuleto',
    },
    {
      id: 'mq5_amuleto', main: true, chapter: 12, giver: 'npc_sabio_torre', requires: 'mq4d_sueno', auto: true,
      title: 'El amuleto de fuego',
      offer: 'Nadie entra al volcán sin un Amuleto de fuego. Hace falta una gema ígnea y dos obsidianas.',
      text: 'Para entrar al Volcán necesitás un Amuleto de fuego: una gema ígnea (Montañas) y dos obsidianas (Cuevas Ancestrales). Druss, el herrero del Puerto, sabe forjarlo.',
      objectives: [{ type: 'have', item: 'amuleto_fuego' }],
      done: 'El amuleto late tibio contra tu pecho. El calor ya no te asusta.',
      reward: { xp: 180 },
      next: 'mq5b_ceniza',
    },

    // Acto III: la ceniza (niveles 7 a 10)
    {
      id: 'mq5b_ceniza', main: true, chapter: 13, giver: 'npc_druida_santuario', requires: 'mq5_amuleto', auto: true,
      title: 'Ceniza en Velmora',
      offer: 'Los de túnica gris compran huesos y sangre en Velmora.',
      text: 'Dicen que los de túnica gris compran huesos y sangre en Velmora. La condesa Ilyana sabe quién compra qué en su ciudad: andá a verla.',
      objectives: [{ type: 'visit', region: 'velmora' }, { type: 'talk', npc: 'npc_condesa_velmora' }],
      done: 'La condesa sonríe sin mostrar los dientes. "Los encapuchados. Me compran lo que nadie quiere y no pagan impuestos. Ayudame y te digo quiénes son."',
      reward: { xp: 100, coins: 50 },
      next: 'mq5c_sellos',
    },
    {
      id: 'mq5c_sellos', main: true, chapter: 14, giver: 'npc_condesa_velmora', requires: 'mq5b_ceniza', minLevel: 7,
      title: 'Los sellos de las catacumbas',
      offer: 'Cada luna, los encapuchados bajan a las Catacumbas y rompen los sellos de las tumbas viejas. Los muertos que despiertan llevan esos sellos encima. Traeme dos y te digo a quién sirven.',
      text: 'Los encapuchados rompen los sellos de las Catacumbas. Explorá las catacumbas y conseguí dos sellos de ceniza para la condesa Ilyana.',
      objectives: [
        { type: 'explore', region: 'catacumbas', count: 2 },
        { type: 'collect', item: 'sello_ceniza', count: 2, from: ['espectro', 'aparicion', 'cab_muerte', 'medusa'], text: 'Conseguí sellos de ceniza (los muertos de las catacumbas)' },
      ],
      turnIn: true,
      done: 'La condesa raspa la ceniza de un sello: debajo hay un nombre grabado. "Morvaith. Un lich que se hace llamar el Heraldo del Dragón. Él lo despertó. Si el dragón vuela, él manda." Te da una cajita de hueso: "Su filacteria. Con esto y tres cráneos, lo despertás en su cripta."',
      reward: { xp: 330, coins: 300, items: [['filacteria_rota', 1]] },
      next: 'mq6_volcan',
    },
    {
      id: 'mq6_volcan', main: true, chapter: 15, giver: 'npc_sabio_torre', requires: 'mq5c_sellos', auto: true,
      title: 'El corazón del volcán',
      offer: 'Con el amuleto podés entrar al Volcán.',
      text: 'Con el amuleto puesto, llegá al Volcán. Desde ahí se ve el camino al nido.',
      objectives: [{ type: 'visit', region: 'volcan' }],
      done: 'El aire tiembla de calor. Allá arriba, entre el humo, algo grande se mueve.',
      reward: { xp: 220 },
      next: 'mq7_guardian',
    },
    {
      id: 'mq7_guardian', main: true, chapter: 16, giver: 'npc_sabio_torre', requires: 'mq6_volcan', auto: true,
      title: 'El guardián del cráter',
      offer: 'Un dragón joven cuida el paso al nido.',
      text: 'Un dragón joven cuida el paso hacia el Nido de Dragones. Derrotalo.',
      objectives: [{ type: 'kill', enemy: 'dragon_joven', count: 1 }],
      done: 'El dragón joven cae entre las rocas. El paso al nido queda libre.',
      reward: { xp: 450, coins: 300 },
      next: 'mq7b_heraldo',
    },
    {
      id: 'mq7b_heraldo', main: true, chapter: 17, giver: 'npc_sabio_torre', requires: 'mq7_guardian', auto: true,
      title: 'El Heraldo de la Ceniza',
      offer: 'Morvaith duerme en su cripta, debajo de las Catacumbas.',
      text: 'Morvaith, el lich que despertó al dragón, duerme en la Cripta del Lich, debajo de las Catacumbas. Despertalo en el altar con su filacteria y tres cráneos. Sin su heraldo, el dragón queda solo.',
      objectives: [{ type: 'kill', enemy: 'lich', count: 1, text: 'Derrotá a Morvaith, el lich' }],
      done: 'El lich se deshace en ceniza gris. Lejos, un rugido sacude las montañas: el dragón sabe que ahora está solo.',
      reward: { xp: 700, coins: 500 },
      next: 'mq8_sombra',
    },
    {
      id: 'mq8_sombra', main: true, chapter: 18, giver: 'npc_sabio_torre', requires: 'mq7b_heraldo', auto: true,
      title: 'La sombra del dragón',
      offer: 'El dragón anciano espera en su nido.',
      text: 'El dragón anciano espera en su cima, sobre el Nido de Dragones. Terminá con la sombra que cubre el reino.',
      objectives: [{ type: 'kill', enemy: 'dragon_anciano', count: 1, text: 'Derrotá al dragón anciano' }],
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
      reward: { coins: 25, xp: 10, items: [['carne_seca', 2], ['queso', 1]] },
    },
    {
      id: 'sq_zorros', giver: 'npc_tabernero_pueblo',
      title: 'Zorros en el gallinero',
      offer: 'Los zorros del Bosque Sombrío se me llevan las gallinas de a una. Si espantás a tres, te pago en monedas y en huevos, que todavía me quedan algunos.',
      text: 'Maela quiere que derrotes a tres zorros del Bosque Sombrío.',
      objectives: [{ type: 'kill', enemy: 'zorro', count: 3 }],
      turnIn: true,
      done: '"¡Mis gallinas te lo agradecen!" Maela te envuelve media docena de huevos.',
      reward: { coins: 30, xp: 10, items: [['huevos', 2]] },
    },
    {
      id: 'sq_perros', giver: 'npc_mercader_pueblo',
      title: 'Perros en los llanos',
      offer: 'Una jauría de perros salvajes asusta a mis mulas en los Llanos del Alba. Sin mulas no hay mercadería. ¿Te encargás de tres?',
      text: 'Borgan quiere que derrotes a tres perros salvajes en los Llanos del Alba.',
      objectives: [{ type: 'kill', enemy: 'perro_salvaje', count: 3 }],
      turnIn: true,
      done: '"Ahora mis mulas van a poder pasar tranquilas."',
      reward: { coins: 35, xp: 10, items: [['pocion_curacion_menor', 1]] },
    },
    {
      id: 'sq_huesos', giver: 'npc_guardia_pueblo', minLevel: 2,
      title: 'Huesos inquietos',
      offer: 'De noche se escuchan huesos que caminan en el cementerio. Derrotá a tres esqueletos y la gente va a dormir tranquila.',
      text: 'Tomas el guardia te pide derrotar tres esqueletos en el Cementerio.',
      objectives: [{ type: 'kill', enemy: 'esqueleto', count: 3 }],
      turnIn: true,
      done: '"Gracias. Esta noche voy a hacer la ronda sin temblar."',
      reward: { coins: 50, xp: 15 },
    },
    {
      id: 'sq_sapos', giver: 'npc_tabernero_pueblo', minLevel: 3,
      title: 'Sopa de pantano',
      offer: 'Mi abuela hacía una sopa de sapo del pantano que te dejaba como nuevo. Traeme dos pieles de anfibio y la probamos.',
      text: 'Maela necesita dos pieles de anfibio. Los sapos gigantes del Pantano las tienen.',
      objectives: [{ type: 'collect', item: 'piel_anfibio', count: 2 }],
      turnIn: true,
      done: 'La sopa huele raro, pero cae de maravilla.',
      reward: { coins: 60, xp: 20, items: [['sopa', 2]] },
    },

    // ============================================================
    // Encargos de Piedrahonda
    // ============================================================
    {"id": "sq_minas", "giver": "npc_herrero_piedrahonda", "minLevel": 2, "title": "Kobolds en las minas", "offer": "Los kobolds se metieron en las Minas Olvidadas y no me dejan sacar mineral. Sacame de encima a cuatro y te forjo algo que valga la pena.", "text": "Grimbold quiere que derrotes a cuatro kobolds en las Minas Olvidadas.", "objectives": [{"type": "kill", "enemy": "kobold", "count": 4}], "turnIn": true, "done": "\"¡Ja! Ya se escuchan los picos otra vez.\" Grimbold te da un martillo recién templado.", "reward": {"coins": 40, "xp": 15, "items": [["martillo_enano", 1]]}},
    {"id": "sq_cuarzo", "giver": "npc_tabernera_piedrahonda", "minLevel": 2, "title": "Cuarzo para las lámparas", "offer": "Las lámparas de la taberna funcionan con cuarzo y se me terminó. En las minas hay de sobra. Traeme dos trozos.", "text": "Brenna necesita dos fragmentos de cuarzo para las lámparas de la taberna.", "objectives": [{"type": "collect", "item": "fragmento_cuarzo", "count": 2}], "turnIn": true, "done": "\"¡Ahora sí, luz!\" Brenna te sirve una cena para el camino.", "reward": {"coins": 35, "xp": 10, "items": [["carne_seca", 2], ["pan", 2]]}},
    {
      id: 'sq_escarabajos', giver: 'npc_herrero_piedrahonda', minLevel: 3,
      title: 'Escarabajos en las vetas',
      offer: 'Unos escarabajos del tamaño de un perro se comen las vetas de hierro de las minas. Así no hay forja que aguante. Aplastá a tres.',
      text: 'Grimbold quiere que derrotes a tres escarabajos mineros en las Minas Olvidadas.',
      objectives: [{ type: 'kill', enemy: 'escarabajo_minero', count: 3 }],
      turnIn: true,
      done: '"¡Eso! Tomá, de la última veta que me dejaron."',
      reward: { coins: 70, xp: 25, items: [['mineral_hierro', 2]] },
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
      reward: { coins: 120, xp: 30 },
    },
    {
      id: 'sq_perlas', giver: 'npc_capitana_puerto', minLevel: 3,
      title: 'Perlas para un collar',
      offer: 'Mi hija cumple años. Quiero regalarle un collar, pero las perlas buenas están en la costa y en alta mar. Traeme tres.',
      text: 'Irena quiere tres perlas pequeñas. Aparecen en la costa y en alta mar.',
      objectives: [{ type: 'collect', item: 'perla_pequeña', count: 3 }],
      turnIn: true,
      done: 'Irena sonríe por primera vez: "Va a estar feliz."',
      reward: { coins: 220, xp: 20 },
    },
    {
      id: 'sq_ahogados', giver: 'npc_capitana_puerto', minLevel: 4,
      title: 'Los que el mar devuelve',
      offer: 'De noche, los ahogados de la Costa de los Naufragios salen del agua y caminan hacia el Puerto. Algunos eran mis marineros. Dales descanso: con tres alcanza para que los demás entiendan.',
      text: 'Irena te pide derrotar a tres ahogados en la Costa de los Naufragios.',
      objectives: [{ type: 'kill', enemy: 'ahogado', count: 3 }],
      turnIn: true,
      done: 'Irena se saca el sombrero un momento. "Gracias. Ahora sí descansan."',
      reward: { coins: 120, xp: 40, items: [['pocion_curacion', 1]] },
    },
    {
      id: 'sq_hierro', giver: 'npc_herrero_puerto', minLevel: 4,
      title: 'Hierro para la forja',
      offer: 'Se me terminó el hierro y tengo encargos atrasados. Traeme cuatro trozos de mineral de hierro de las Montañas o las Cuevas.',
      text: 'Druss, el herrero, necesita cuatro trozos de mineral de hierro.',
      objectives: [{ type: 'collect', item: 'mineral_hierro', count: 4 }],
      turnIn: true,
      done: '"Buen hierro. Con esto saco una espada por día."',
      reward: { coins: 140, xp: 40, items: [['mat_acero', 1]] },
    },
    {
      id: 'sq_orcos', giver: 'npc_herrero_puerto', minLevel: 4,
      title: 'Orcos en las colinas',
      offer: 'Los orcos de las Colinas Rotas emboscan a los carros que me traen carbón. Si derrotás a tres, te hago un descuento de amigo... bueno, te pago.',
      text: 'Druss te paga por derrotar a tres orcos de las Colinas Rotas.',
      objectives: [{ type: 'kill', enemy: 'orco', count: 3 }],
      turnIn: true,
      done: '"Ya llegó el carbón. Que se note en el acero."',
      reward: { coins: 130, xp: 40 },
    },
    {
      id: 'sq_troll', giver: 'npc_herrero_puerto', minLevel: 6,
      title: 'Sangre de troll',
      offer: 'Dicen que el acero templado en sangre de troll no se rompe nunca. Quiero probarlo. Los trolls viven en las Cuevas Ancestrales... y se curan solos, así que pegá fuerte.',
      text: 'Druss quiere sangre de troll para templar acero. Los trolls viven en las Cuevas Ancestrales.',
      objectives: [{ type: 'kill', enemy: 'troll', count: 1 }, { type: 'collect', item: 'mat_sangre_troll', count: 1 }],
      turnIn: true,
      done: 'Druss hunde una hoja al rojo en la sangre verde. El vapor huele horrible. "¡Perfecta!"',
      reward: { coins: 220, xp: 110, items: [['mat_acero', 2]] },
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
      reward: { xp: 40, items: [['pocion_mana', 2]] },
    },
    {
      id: 'sq_momias', giver: 'npc_sabio_torre', minLevel: 5,
      title: 'Reliquias del desierto',
      offer: 'Las momias del Desierto custodian reliquias de un reino que ni yo conozco. Derrotá a dos y traeme una reliquia: quiero leer lo que tiene grabado.',
      text: 'Velrith quiere una reliquia olvidada del Desierto. Las momias las cuidan.',
      objectives: [{ type: 'kill', enemy: 'momia', count: 2 }, { type: 'collect', item: 'reliquia_olvidada', count: 1 }],
      turnIn: true,
      done: '"Fascinante. Un reino entero que se tragó la arena." Velrith ya no te mira: está leyendo.',
      reward: { coins: 150, xp: 60 },
    },
    {
      id: 'sq_hidra', giver: 'npc_sabio_torre', minLevel: 9,
      title: 'El colmillo de la hidra',
      offer: 'Para un hechizo que estoy estudiando necesito un colmillo de hidra. La hidra vive en su lago, en el corazón del Pantano. Tiene tres cabezas y muerde con las tres, así que cortá rápido.',
      text: 'Velrith necesita un colmillo de la hidra del Lago de la Hidra (en el Pantano).',
      objectives: [{ type: 'kill', enemy: 'hidra', count: 1, text: 'Derrotá a la hidra' }, { type: 'collect', item: 'mat_colmillo_hidra', count: 1 }],
      turnIn: true,
      done: 'Velrith guarda el colmillo en una caja de plomo. "No lo toques. Nunca."',
      reward: { coins: 800, xp: 200, items: [['pocion_mana_mayor', 2]] },
    },

    // ============================================================
    // Encargos de Puerto Calavera
    // ============================================================
    {"id": "sq_capitan", "giver": "npc_tabernero_calavera", "minLevel": 5, "title": "La cabeza del capitán", "offer": "Hay un capitán en el Mar de las Calaveras que no le paga a nadie, ni siquiera a mí. Hundilo y te pago el doble de lo que él debe.", "text": "Tuerto Salvo paga por derrotar al capitán pirata del Mar de las Calaveras.", "objectives": [{"type": "kill", "enemy": "capitan_pirata", "count": 1}], "turnIn": true, "done": "\"¡Por fin! Esta noche invita la casa.\" Tuerto Salvo cuenta los doblones dos veces.", "reward": {"coins": 260, "xp": 70}},
    {"id": "sq_ron", "giver": "npc_contrabandista_calavera", "minLevel": 5, "title": "Ron para el puerto", "offer": "Los piratas de la costa esconden ron del bueno. Traeme cuatro botellas y nadie se entera.", "text": "Mara compra cuatro botellas de ron añejo. Los piratas de la costa las llevan encima.", "objectives": [{"type": "collect", "item": "ron_anejo", "count": 4}], "turnIn": true, "done": "Mara guarda las botellas sin mirarlas y te pasa una bolsa pesada.", "reward": {"coins": 140, "xp": 40}},
    {
      id: 'sq_monedas', giver: 'npc_contrabandista_calavera', minLevel: 5,
      title: 'Monedas de otro reino',
      offer: 'Compro monedas antiguas. No pregunto de dónde salen. Los grumetes de la costa y las momias del desierto las llevan encima. Tres, y hablamos de precio.',
      text: 'Mara compra tres monedas antiguas. Las llevan los grumetes piratas y las momias.',
      objectives: [{ type: 'collect', item: 'moneda_antigua', count: 3 }],
      turnIn: true,
      done: 'Mara muerde cada moneda antes de pagarte. "Auténticas. Un placer."',
      reward: { coins: 220, xp: 40 },
    },
    {
      id: 'sq_tiburones', giver: 'npc_tabernero_calavera', minLevel: 6,
      title: 'Aletas en el agua',
      offer: 'Los tiburones se están comiendo a mis clientes... bueno, a los que se caen al agua borrachos. Igual es malo para el negocio. Bajá a tres.',
      text: 'Tuerto Salvo paga por derrotar a tres tiburones en el Mar de las Calaveras o en Alta Mar.',
      objectives: [{ type: 'kill', enemy: 'tiburon', count: 3 }],
      turnIn: true,
      done: '"¡A la salud de los que no se comieron!" Tuerto Salvo te sirve un vaso y te pasa una bolsa.',
      reward: { coins: 250, xp: 100 },
    },
    {
      id: 'sq_kraken', giver: 'npc_tabernero_calavera', minLevel: 9,
      title: 'El monstruo del abismo',
      offer: 'Hay un kraken en un remolino al lado del Abismo Marino que hundió más barcos que todos los piratas juntos. Primero vas a tener que cortarle los tentáculos. El que lo mate no paga nunca más en esta taberna. Y encima le doy esto.',
      text: 'Tuerto Salvo ofrece una fortuna por derrotar al kraken del Remolino del Kraken (al lado del Abismo Marino).',
      objectives: [{ type: 'kill', enemy: 'kraken', count: 1, text: 'Derrotá al kraken' }],
      turnIn: true,
      done: 'En Puerto Calavera no se habla de otra cosa. Tuerto Salvo cumple: te paga y te sirve la primera de muchas.',
      reward: { coins: 1500, xp: 200, items: [['elixir_vida', 1]] },
    },

    // ============================================================
    // Encargos del Santuario del Roble
    // ============================================================
    {"id": "sq_pesadillas", "giver": "npc_druida_santuario", "minLevel": 5, "title": "Sueños rotos", "offer": "El Bosque de los Sueños tiene pesadillas que caminan. Si derrotás a tres, el bosque va a poder descansar.", "text": "Sylveth la druida te pide derrotar tres pesadillas en el Bosque de los Sueños.", "objectives": [{"type": "kill", "enemy": "pesadilla", "count": 3}], "turnIn": true, "done": "Sylveth cierra los ojos y sonríe: \"Ya duerme tranquilo.\"", "reward": {"xp": 70, "items": [["pocion_mana", 2], ["pocion_curacion", 1]]}},
    {
      id: 'sq_huargos', giver: 'npc_druida_santuario', minLevel: 6,
      title: 'Aullidos entre los árboles',
      offer: 'Los huargos del Bosque de los Susurros bajaron hasta el borde del santuario. Cazan a los ciervos de luz. Si derrotás a tres, la manada se va a alejar.',
      text: 'Sylveth te pide derrotar a tres huargos en el Bosque de los Susurros.',
      objectives: [{ type: 'kill', enemy: 'huargo', count: 3 }],
      turnIn: true,
      done: '"Los ciervos ya vuelven a beber del arroyo. Gracias."',
      reward: { xp: 100, items: [['pocion_curacion', 2]] },
    },
    {
      id: 'sq_bruja', giver: 'npc_druida_santuario', minLevel: 7,
      title: 'La bruja del bosque',
      offer: 'Una bruja se instaló en el Bosque de los Susurros y les enseña a los árboles a odiar. Eso no se cura con savia. Hay que sacarla.',
      text: 'Sylveth quiere que derrotes a la bruja del Bosque de los Susurros.',
      objectives: [{ type: 'kill', enemy: 'bruja', count: 1, text: 'Derrotá a la bruja del bosque' }],
      turnIn: true,
      done: 'Los árboles dejan de susurrar. Sylveth apoya la mano en la corteza del roble y respira hondo.',
      reward: { xp: 150, items: [['pocion_mana_mayor', 1]] },
    },

    // ============================================================
    // Encargos de Velmora
    // ============================================================
    {"id": "sq_bestias", "giver": "npc_condesa_velmora", "minLevel": 7, "title": "Sangre salvaje", "offer": "Las bestias del Jardín Carmesí nos avergüenzan. Cazalas por nosotros: tres alcanzan para que entiendan el mensaje.", "text": "La condesa Ilyana quiere que derrotes a tres bestias de sangre en el Jardín Carmesí.", "objectives": [{"type": "kill", "enemy": "bestia_sangre", "count": 3}], "turnIn": true, "done": "\"Eficiente. Me gusta.\" La condesa deja caer un saco de oro sobre la mesa.", "reward": {"coins": 420, "xp": 160}},
    {"id": "sq_flores", "giver": "npc_boticaria_velmora", "minLevel": 7, "title": "Flores entre tumbas", "offer": "La flor carmesí solo crece en el Jardín. Traeme tres y te pago en sangre... embotellada, claro.", "text": "Orsolya la boticaria quiere tres flores carmesí del Jardín Carmesí.", "objectives": [{"type": "collect", "item": "rosa_carmesi", "count": 3}], "turnIn": true, "done": "Orsolya huele las flores y se le iluminan los ojos.", "reward": {"coins": 150, "xp": 120, "items": [["vial_sangre", 2]]}},
    {
      id: 'sq_senor', giver: 'npc_condesa_velmora', minLevel: 8,
      title: 'El señor de la noche',
      offer: 'En el castillo de la colina vive un vampiro que se cree dueño de Velmora. Es viejo, rico y muy maleducado. Quiero que deje de existir.',
      text: 'La condesa Ilyana quiere que derrotes al Señor vampiro del Castillo de Velmora.',
      objectives: [{ type: 'kill', enemy: 'senor_vampiro', count: 1, text: 'Derrotá al Señor vampiro' }],
      turnIn: true,
      done: '"Por fin un poco de paz en mi jardín." La condesa te entrega un cofre que pesa más de lo que parece.',
      reward: { coins: 900, xp: 180 },
    },
  ];

  // ============================================================
  // Objetos de misión: no se compran; los sueltan las criaturas
  // que dice cada objetivo, solo mientras la misión los pide.
  // ============================================================
  const QUEST_ITEMS = [
    { id: 'idolo_kobold', rarity: 'uncommon', name: 'Ídolo de los kobolds', type: 'item', subtype: 'material', icon: '', value: 6, weight: 0, stack: 9, quest: true,
      description: 'Un dragón tallado en hueso y pintado de rojo. Los kobolds le cantaban de noche.' },
    { id: 'bitacora_quemada', rarity: 'uncommon', name: 'Bitácora quemada', type: 'item', subtype: 'material', icon: '', value: 6, weight: 0, stack: 9, quest: true,
      description: 'El diario del capitán de La Gaviota. Las últimas páginas huelen a humo.' },
    { id: 'tomo_antorcha', rarity: 'rare', name: 'Tomo de Antorcha', type: 'item', subtype: 'material', icon: '', value: 10, weight: 0, stack: 9, quest: true,
      description: 'Un libro chamuscado de la vieja biblioteca de Antorcha. Cuenta cómo se durmió al dragón negro.' },
    { id: 'sello_ceniza', rarity: 'rare', name: 'Sello de ceniza', type: 'item', subtype: 'material', icon: '', value: 10, weight: 0, stack: 9, quest: true,
      description: 'Un disco de piedra cubierto de ceniza gris. Debajo hay un nombre grabado.' },
  ];

  A.Seed = A.Seed || {};
  A.Seed.quests = QUESTS;
  A.Seed.items = A.Seed.items || [];
  for (const it of QUEST_ITEMS) if (!A.Seed.items.some((x) => x.id === it.id)) A.Seed.items.push(it);
})(window.Aventurs);
