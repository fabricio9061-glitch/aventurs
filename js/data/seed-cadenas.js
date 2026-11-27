/* ============================================================
   Aventurs — Escenas en cadena (v3.23)
   Escenas que no terminan en un click: lo que elegís abre otro paso
   (outcome.next -> ev.steps[...]). Algunas terminan con un punto de
   explorar para siempre (outcome.train: 'ingenio', o 'any' = tu número
   más bajo), hasta 3 por número.

   Dos partes:
     1) A escenas que ya existían se les agrega un paso más (link()).
     2) Escenas nuevas, para ir solo y en grupo (party: true).
   Carga después de seed-events.js y antes de data.js.
   ============================================================ */

(function (A) {
  'use strict';
  A.Seed = A.Seed || {};
  const list = A.Seed.events = A.Seed.events || [];
  const byId = (id) => list.find((e) => e.id === id);

  const WILD = ['forest', 'plains', 'cave', 'swamp', 'hills', 'coast', 'mountain', 'dream', 'desert', 'ruins', 'darkwood', 'crypt', 'meadow', 'bloodwood', 'graveyard', 'volcano', 'hell', 'lair'];

  /**
   * Agrega pasos a una escena que ya existía.
   *   links: [[índice de opción, 'ok' | 'fail', 'paso']]
   * Lo que ya daba esa opción se mantiene (es el premio del primer paso).
   */
  function link(id, steps, links, extra) {
    const ev = byId(id);
    if (!ev) return;
    ev.steps = Object.assign({}, ev.steps || {}, steps);
    for (const [i, k, step] of links) {
      const o = ev.options && ev.options[i];
      if (o && o[k]) o[k].next = step;
    }
    if (extra) Object.assign(ev, extra);
  }

  // ============================================================
  // 1) Escenas de antes, con un paso más
  // ============================================================

  link('cofre_enterrado', {
    fondo_falso: {
      title: 'El fondo del cofre',
      text: 'Con el cofre vacío, golpeás la madera del fondo y suena hueca. Hay algo más abajo, y una segunda cerradura, más chiquita.',
      options: [
        { label: 'Abrir el fondo falso con cuidado', check: { stat: 'ingenio', dc: 13 }, ok: { text: 'La cerradura cede con un clic suave. Abajo hay una bolsa de cuero con monedas de otra época y un papel doblado.', coins: 3, items: [['moneda_antigua', 1, 2]], xp: 0.4 }, fail: { text: 'La madera se astilla y lo que había abajo se rompe en pedazos. Se salvan unas monedas.', coins: 1 } },
        { label: 'Romperlo de un golpe', check: { stat: 'fuerza', dc: 12 }, ok: { text: 'El fondo salta en astillas. Entre los restos hay una bolsita intacta.', coins: 3, loot: 1 }, fail: { text: 'El golpe rebota y te deja la muñeca dolorida.', hurt: 0.08 } },
        { label: 'Con lo que hay alcanza', ok: { text: 'Cerrás el cofre y lo volvés a tapar. Que lo encuentre otro.' } },
      ],
    },
  }, [[1, 'ok', 'fondo_falso'], [2, 'ok', 'fondo_falso']]);

  link('piedra_runica', {
    runas_copiadas: {
      title: 'Lo que dicen las runas',
      text: 'Con los símbolos copiados, empezás a ver un patrón: se repiten de a tres, como un verso. Si lo leés en voz alta, quizás la piedra responda.',
      options: [
        { label: 'Leer el verso en voz alta', check: { stat: 'ingenio', dc: 14 }, ok: { text: 'Las runas se encienden una por una. Algo de lo que dicen se te queda grabado: ahora ves las cosas un poco más claras.', train: 'ingenio', xp: 0.6, mana: 0.5 }, fail: { text: 'Te trabás en la segunda palabra y la piedra chisporrotea. Te zumban los oídos un buen rato.', hurt: 0.1 } },
        { label: 'Guardarlo para un sabio', ok: { text: 'Doblás el papel y lo guardás. Algún día va a valer algo.', xp: 0.3 } },
      ],
    },
  }, [[1, 'ok', 'runas_copiadas']]);

  link('ciervo_blanco', {
    claro_ciervo: {
      title: 'El claro escondido',
      text: 'El ciervo se detiene en el borde del claro y te mira. Después da unos pasos hacia un sendero que se pierde entre la niebla, como esperando que lo sigas otra vez.',
      options: [
        { label: 'Seguirlo más adentro', check: { stat: 'agilidad', dc: 14 }, ok: { text: 'Corrés detrás de él entre raíces y piedras sin tropezar una sola vez. Cuando desaparece, te das cuenta de que ahora te movés distinto: más liviano.', train: 'agilidad', xp: 0.5 }, fail: { text: 'La niebla se cierra y el ciervo ya no está. Volvés al claro con las rodillas raspadas.', hurt: 0.06, time: 1 } },
        { label: 'Quedarte a descansar', ok: { text: 'Te recostás en el pasto tibio. Cuando abrís los ojos, el ciervo ya se fue y vos estás como nuevo.', heal: 0.3, mana: 0.3, time: 1 } },
      ],
    },
  }, [[0, 'ok', 'claro_ciervo']]);

  link('fuego_fatuo', {
    bulto_hundido: {
      title: 'El bulto en el barro',
      text: 'La luz se apaga sobre un baúl medio hundido. Las burbujas que suben del barro dicen que algo respira ahí cerca.',
      options: [
        { label: 'Sacar el baúl a la fuerza', check: { stat: 'fuerza', dc: 13 }, ok: { text: 'Tirás con todo y el pantano lo suelta con un ruido de sopapa. Adentro, seco de milagro, hay más de lo que esperabas.', coins: 3, loot: 1, xp: 0.3 }, fail: { text: 'El baúl no se mueve, pero lo que respiraba en el barro sí.', fight: { ambush: true } } },
        { label: 'Abrirlo ahí mismo, rápido', check: { stat: 'suerte', dc: 12 }, ok: { text: 'La tapa se abre de una. Metés la mano, agarrás lo primero que tocás y te alejás.', coins: 2, items: [['fragmento_runa', 1, 1]] }, fail: { text: 'La tapa está trabada y el barro te sigue tragando las botas.', hurt: 0.1, food: -1 } },
        { label: 'Irte antes de que salga', ok: { text: 'Ya tenés lo tuyo. Te vas sin mirar atrás.' } },
      ],
    },
  }, [[0, 'ok', 'bulto_hundido']]);

  link('mecanismo_antiguo', {
    camara: {
      title: 'La cámara intacta',
      text: 'Las paredes de la cámara están cubiertas de dibujos: gente que mide estrellas, que pesa piedras, que cuenta pasos. En el centro hay un cofre de bronce.',
      options: [
        { label: 'Estudiar los dibujos', check: { stat: 'ingenio', dc: 13 }, ok: { text: 'Te sentás a mirarlos con calma y de a poco entendés cómo pensaban los que construyeron esto. Algo de eso te queda.', train: 'ingenio', xp: 0.4, time: 1 }, fail: { text: 'Por más que mirás, no le encontrás la vuelta. Se te va la tarde.', time: 2 } },
        { label: 'Abrir el cofre de bronce', check: { stat: 'fuerza', dc: 13 }, ok: { text: 'La tapa pesa como una puerta, pero se abre. Adentro hay joyas verdes de óxido y monedas que ya nadie usa.', coins: 4, items: [['moneda_antigua', 1, 2]] }, fail: { text: 'Al forzarlo, el piso se hunde un dedo y del techo cae una lluvia de piedritas.', hurt: 0.12 } },
        { label: 'Salir con lo que tenés', ok: { text: 'Hay lugares que es mejor no apurar. Salís y la puerta se cierra sola detrás tuyo.' } },
      ],
    },
  }, [[0, 'ok', 'camara']]);

  link('fantasma_triste', {
    anillo: {
      title: 'El anillo del fantasma',
      text: 'El fantasma mira el anillo en tu mano y deja de llorar. "Llevalo a mi tumba, por favor. Está detrás de la capilla." El anillo pesa más de lo que parece... y brilla lindo.',
      options: [
        { label: 'Llevarlo a su tumba', ok: { text: 'Lo dejás sobre la lápida. El fantasma sonríe por primera vez y se va con la luz. Te queda una calma rara, como si hubieras dormido una noche entera.', heal: 0.4, mana: 0.4, xp: 0.6, time: 1 } },
        { label: 'Quedártelo', check: { stat: 'suerte', dc: 13 }, ok: { text: 'El fantasma no dice nada: solo se desvanece. El anillo es tuyo, y vale lo suyo.', coins: 4, items: [['reliquia_olvidada', 1, 1]] }, fail: { text: 'El fantasma se da vuelta. Ya no llora: grita.', fight: {} } },
      ],
    },
  }, [[0, 'ok', 'anillo']]);

  link('ermitano', {
    ermitano_ensena: {
      title: 'Los trucos del ermitaño',
      text: 'El viejo se ríe: "Sabés escuchar. Eso es raro." Se levanta, agarra un bastón y te ofrece enseñarte una sola cosa. Hay que elegir.',
      options: [
        { label: 'Que te enseñe a moverte sin ruido', check: { stat: 'agilidad', dc: 13 }, ok: { text: 'Te hace caminar sobre hojas secas hasta que no suenan. Al final del día lo lográs.', train: 'agilidad', xp: 0.3, time: 1 }, fail: { text: 'Cada paso suena como una rama partida. El viejo se ríe y te manda a casa.', time: 1 } },
        { label: 'Que te enseñe a leer el monte', check: { stat: 'ingenio', dc: 13 }, ok: { text: 'Te enseña a ver dónde pasó un animal, de dónde viene la lluvia y qué hongos no tocar. Lo vas a usar siempre.', train: 'ingenio', xp: 0.3, time: 1 }, fail: { text: 'Te llena la cabeza de nombres de plantas que se te mezclan todos.', time: 1 } },
        { label: 'Que te enseñe a tirar con la honda', check: { stat: 'punteria', dc: 13 }, ok: { text: 'Al quinto intento le das a la piña. Al décimo, a la del medio.', train: 'punteria', xp: 0.3, time: 1 }, fail: { text: 'Le das a todo menos a la piña. Un tiro casi le rompe la ventana.', time: 1 } },
      ],
    },
  }, [[0, 'ok', 'ermitano_ensena']]);

  link('perro_perdido', {
    granja: {
      title: 'La granja',
      text: 'La dueña del perro te cuenta que algo le está robando las gallinas de noche. "Si me ayudás, te pago bien."',
      options: [
        { label: 'Esperar escondido con un arco', check: { stat: 'punteria', dc: 12 }, ok: { text: 'A medianoche aparece un zorro gordo. Un tiro y se va corriendo para no volver. La granjera te paga y te llena la bolsa.', coins: 3, food: 2, xp: 0.4, time: 1 }, fail: { text: 'El zorro es más rápido que tu flecha. Se lleva una gallina y tu orgullo.', time: 1 } },
        { label: 'Arreglar el corral', check: { stat: 'fuerza', dc: 11 }, ok: { text: 'Clavás tablas nuevas toda la tarde. Esa noche no entra nada.', coins: 2, food: 1, xp: 0.3, time: 1 }, fail: { text: 'Te martillás un dedo. El corral queda, más o menos.', hurt: 0.05, time: 1 } },
        { label: 'Agradecer y seguir', ok: { text: 'Le deseás suerte con las gallinas y seguís viaje. El perro te acompaña hasta la tranquera.' } },
      ],
    },
  }, [[0, 'ok', 'granja']]);

  link('restos_aventurero', {
    diario_pista: {
      title: 'La última página',
      text: 'El diario habla de un escondite: "Dejé lo mejor detrás de la piedra con la marca. Si no vuelvo, que lo use alguien que no sea tan tonto como yo."',
      options: [
        { label: 'Buscar la piedra con la marca', check: { stat: 'ingenio', dc: 13 }, ok: { text: 'La marca está gastada pero se ve. Detrás hay un paquete envuelto en cuero, seco y entero.', coins: 3, loot: 2, xp: 0.4 }, fail: { text: 'Movés la piedra equivocada. Lo que mató al aventurero vivía justo ahí.', fight: { ambush: true } } },
        { label: 'Dejar el diario con él', ok: { text: 'Cerrás el diario y se lo dejás en las manos. Hay cosas que no son tuyas.', xp: 0.2 } },
      ],
    },
  }, [[1, 'ok', 'diario_pista']]);

  link('mina_abandonada', {
    mina_fondo: {
      title: 'El fondo de la mina',
      text: 'La veta sigue hacia abajo por un pozo viejo. Hay una escalera de madera, pero le faltan peldaños. Desde el fondo llega un brillo de colores.',
      options: [
        { label: 'Bajar por la escalera', check: { stat: 'agilidad', dc: 13 }, ok: { text: 'Bajás saltando los huecos. Abajo, la pared está llena de cristales que nadie llegó a sacar.', items: [['fragmento_cuarzo', 1, 2]], loot: 1, xp: 0.4 }, fail: { text: 'Un peldaño se parte y terminás abajo de golpe. Te levantás con las manos vacías y la espalda dolorida.', hurt: 0.15 } },
        { label: 'Atar una soga y bajar despacio', needs: { item: 'cuerda', consume: false }, ok: { text: 'Con la soga bajás sin apuro. Te tomás tu tiempo para sacar lo mejor.', items: [['fragmento_cuarzo', 1, 2], ['mat_gema_arcana', 1, 1]], xp: 0.3, time: 1 } },
        { label: 'Salir con lo que tenés', ok: { text: 'La mina cruje como si estuviera de acuerdo. Salís al sol.' } },
      ],
    },
  }, [[0, 'ok', 'mina_fondo']]);

  link('viajero_herido', {
    viajero_charla: {
      title: 'El viajero agradecido',
      text: 'Con la pierna vendada, el viajero se anima a hablar. Fue explorador del reino durante treinta años. "Te puedo enseñar algo, si me ayudás a llegar al camino."',
      options: [
        { label: 'Acompañarlo y escucharlo', check: { stat: 'ingenio', dc: 14 }, ok: { text: 'Todo el camino te cuenta trucos de viejo explorador. Cuando se despide, ya no mirás el monte igual.', train: 'any', xp: 0.4, time: 1 }, fail: { text: 'Habla tanto y tan rápido que no retenés casi nada. Al menos llegó sano.', xp: 0.2, time: 1 } },
        { label: 'Prestarle el hombro y nada más', ok: { text: 'Lo dejás en el camino real. Te paga lo que puede.', coins: 2, time: 1 } },
      ],
    },
  }, [[0, 'ok', 'viajero_charla']]);

  link('huellas_frescas', {
    huellas_madriguera: {
      title: 'La madriguera',
      text: 'Las huellas terminan en una madriguera entre raíces. Adentro algo duerme y respira fuerte. Alrededor hay restos de sus comidas... y cosas que no se comió.',
      options: [
        { label: 'Atacar mientras duerme', check: { stat: 'agilidad', dc: 12 }, ok: { text: 'Te acercás sin un ruido.', fight: { surprise: true, wound: 0.2 } }, fail: { text: 'Se despierta justo cuando estás encima.', fight: {} } },
        { label: 'Revolver lo que dejó', check: { stat: 'suerte', dc: 11 }, ok: { text: 'Entre huesos y plumas hay una bolsita de alguien que no tuvo tanta suerte.', coins: 2, items: [['mat_pluma', 1, 2]] }, fail: { text: 'Pisás un hueso que cruje. Adentro, algo deja de roncar.', fight: { ambush: true } } },
        { label: 'Irte, ya sabés dónde vive', ok: { text: 'Lo anotás y te vas. Mejor encontrarlo cuando vos quieras.', xp: 0.2 } },
      ],
    },
  }, [[1, 'ok', 'huellas_madriguera']]);

  link('sarcofago', {
    sarcofago_tapa: {
      title: 'La tapa por dentro',
      text: 'Del lado de adentro de la tapa hay algo escrito con letras finitas, como un consejo para quien la abriera.',
      options: [
        { label: 'Leer la inscripción', check: { stat: 'ingenio', dc: 14 }, ok: { text: 'Es un acertijo y lo resolvés. Al decir la respuesta, sentís que algo se acomoda en tu cabeza.', train: 'ingenio', xp: 0.5 }, fail: { text: 'Leés mal una palabra. El dueño del sarcófago abre los ojos.', fight: { ambush: true } } },
        { label: 'Cerrar y salir', ok: { text: 'Volvés a poner la tapa con respeto. Ya tenés lo tuyo.' } },
      ],
    },
  }, [[0, 'ok', 'sarcofago_tapa']]);

  link('g_puerta_palancas', {
    g_sala: {
      title: 'La sala detrás de la puerta',
      text: 'Detrás de la puerta hay una sala larga con estatuas a los costados. Al fondo, sobre un pedestal, un cofre. Las estatuas tienen las espadas levantadas.',
      options: [
        { label: 'Que el más atento revise el piso', check: { stat: 'ingenio', dc: 13, best: true }, ok: { text: 'Encuentra las baldosas que mueven las estatuas y las marcan con tiza. Cruzan en fila y abren el cofre sin un rasguño.', coins: 4, loot: 1, xp: 0.5 }, fail: { text: 'Se le escapa una baldosa. Una espada de piedra baja de golpe.', hurt: 0.15 } },
        { label: 'Correr todos al cofre a la vez', check: { stat: 'agilidad', dc: 14, together: true }, ok: { text: 'Las estatuas bajan las espadas, pero ustedes ya pasaron. Abren el cofre entre risas.', coins: 5, loot: 1, xp: 0.3 }, fail: { text: 'Las estatuas se mueven más rápido de lo que pensaban. No son solo estatuas.', fight: { ambush: true } } },
        { label: 'Con lo de la puerta alcanza', ok: { text: 'Las estatuas no les gustan nada. Cierran la puerta y siguen.' } },
      ],
    },
  }, [[0, 'ok', 'g_sala'], [1, 'ok', 'g_sala']]);

  link('g_bestia_trampa', {
    g_bestia_guia: {
      title: 'La bestia vuelve',
      text: 'Al rato, la bestia aparece otra vez en el sendero. No gruñe: los mira y camina unos pasos hacia el monte, y vuelve a mirarlos.',
      options: [
        { label: 'Seguirla entre todos', check: { stat: 'agilidad', dc: 13, together: true }, ok: { text: 'Los lleva hasta el campamento del cazador que puso la trampa. Está vacío, lleno de pieles y herramientas. Entre todos aprenden un par de cosas del monte mirando cómo vivía.', loot: 2, xp: 0.5, train: 'any' }, fail: { text: 'La bestia va demasiado rápido y la pierden entre los árboles. Vuelven tarde y con hambre.', time: 2, food: -1 } },
        { label: 'Dejarla ir', ok: { text: 'La bestia los mira un rato largo y se va. Algunos dicen que la van a volver a ver.', xp: 0.2 } },
      ],
    },
  }, [[0, 'ok', 'g_bestia_guia'], [1, 'ok', 'g_bestia_guia']]);

  // ============================================================
  // 2) Escenas nuevas en cadena (solo)
  // ============================================================

  const NEW = [
    {
      id: 'c_mapa_botella', biomes: ['forest', 'plains', 'hills', 'coast', 'meadow', 'swamp', 'desert'], weight: 2, icon: 'map',
      title: 'Un mapa en una botella',
      text: 'Entre unas piedras hay una botella con el corcho lacrado. Adentro se ve un papel enrollado con una X roja.',
      options: [
        { label: 'Leer el mapa', check: { stat: 'ingenio', dc: 11 }, ok: { text: 'El dibujo es torpe, pero reconocés el río y una roca partida. La X no está lejos.', next: 'roca' }, fail: { text: 'El papel se deshace al abrirlo. Solo queda la X, sin nada alrededor.', xp: 0.1 } },
        { label: 'Romper la botella y venderla', ok: { text: 'El vidrio es lindo. Algo te van a dar.', coins: 1 } },
      ],
      steps: {
        roca: {
          title: 'La roca partida',
          text: 'Encontrás la roca. El mapa dice "veinte pasos hacia donde muere el sol". Hay dos caminos posibles y uno tiene marcas de pala viejas.',
          options: [
            { label: 'Contar los pasos hacia el oeste', check: { stat: 'ingenio', dc: 13 }, ok: { text: 'Veinte pasos exactos te dejan sobre tierra blanda.', next: 'cavar', bonus: 2 }, fail: { text: 'Te equivocás de oeste. Cavás un buen rato en el lugar equivocado.', time: 1, next: 'cavar' } },
            { label: 'Seguir las marcas de pala', check: { stat: 'suerte', dc: 12 }, ok: { text: 'Las marcas te llevan derecho. Alguien vino antes, pero se fue con las manos vacías.', next: 'cavar' }, fail: { text: 'Las marcas son de otro que buscaba lo mismo. Y todavía está acá.', fight: { ambush: true } } },
          ],
        },
        cavar: {
          title: 'Donde está la X',
          text: 'La pala choca con algo duro. Es la tapa de un cajón. Escuchás voces en el camino: alguien viene.',
          options: [
            { label: 'Sacarlo rápido', check: { stat: 'fuerza', dc: 12 }, ok: { text: 'Lo sacás de un tirón y te escondés con él antes de que lleguen. Adentro, monedas y un par de cosas finas.', coins: 5, loot: 2, xp: 0.6 }, fail: { text: 'No llegás. Los que venían eran los dueños del mapa.', fight: {} } },
            { label: 'Taparlo y esperar a que pasen', check: { stat: 'agilidad', dc: 12 }, ok: { text: 'Pasan de largo sin verte. Después cavás tranquilo.', coins: 5, loot: 1, xp: 0.5, time: 1 }, fail: { text: 'Te ven agachado sobre el pozo. No preguntan.', fight: { ambush: true } } },
          ],
        },
      },
    },
    {
      id: 'c_nino_perdido', biomes: ['forest', 'plains', 'hills', 'meadow', 'darkwood'], solo: true, weight: 2, icon: 'tracks',
      title: 'Un chico perdido',
      text: 'Una mujer corre por el sendero gritando un nombre. Su hijo salió a juntar leña y no volvió. Ya es casi de noche.',
      options: [
        { label: 'Buscar su rastro', check: { stat: 'ingenio', dc: 11 }, ok: { text: 'Encontrás pisadas chiquitas que se meten en el monte.', next: 'rastro' }, fail: { text: 'Das vueltas sin encontrar nada. Por suerte, el chico aparece solo un rato después, asustado pero entero.', xp: 0.2, time: 1 } },
        { label: 'Prometerle avisar si lo ves', ok: { text: 'Le prometés estar atento y seguís. No te sale de la cabeza en todo el día.' } },
      ],
      steps: {
        rastro: {
          title: 'Pisadas en el monte',
          text: 'Las pisadas llegan a un arroyo. Del otro lado, entre los árboles, se escucha un llanto... y también un gruñido.',
          options: [
            { label: 'Cruzar corriendo', check: { stat: 'agilidad', dc: 12 }, ok: { text: 'Cruzás saltando piedras y llegás justo. El chico está trepado a un árbol y abajo hay algo con dientes.', next: 'arbol' }, fail: { text: 'Te resbalás y caés al agua helada. Salís empapado, pero seguís.', hurt: 0.08, next: 'arbol' } },
            { label: 'Hacer ruido para espantar lo que sea', check: { stat: 'fuerza', dc: 12 }, ok: { text: 'Gritás y golpeás un tronco con todo. El gruñido se aleja. El chico baja del árbol llorando y te abraza.', next: 'vuelta' }, fail: { text: 'Lo que gruñía no se asusta. Viene a ver quién hace tanto ruido.', fight: {} } },
          ],
        },
        arbol: {
          title: 'El chico en el árbol',
          text: 'El chico se agarra a una rama. Abajo, la bestia todavía no te vio.',
          options: [
            { label: 'Atacar antes de que te vea', ok: { text: 'Te tirás encima mientras mira para arriba.', fight: { surprise: true } } },
            { label: 'Tirarle algo lejos para distraerla', check: { stat: 'punteria', dc: 12 }, ok: { text: 'La piedra suena entre los arbustos y la bestia va a ver. Bajás al chico y se van en silencio.', next: 'vuelta' }, fail: { text: 'La piedra le pega en la cabeza. Ahora sí te vio.', fight: { ambush: true } } },
          ],
        },
        vuelta: {
          title: 'De vuelta',
          text: 'La madre corre hacia ustedes y abraza al chico como si no lo hubiera visto nunca. Después te mira a vos sin saber qué decir.',
          options: [
            { label: 'Aceptar lo que te ofrece', ok: { text: 'Te da todo lo que tenía guardado y un pan todavía tibio. Esta noche dormís en su casa.', coins: 3, items: [['pan', 1, 2]], heal: 0.4, xp: 0.8 } },
            { label: 'No aceptar nada', ok: { text: 'Le decís que no hace falta. El chico te cuenta, antes de irte, todos los secretos del monte que conoce. Algunos son buenos de verdad.', xp: 0.8, train: 'any' } },
          ],
        },
      },
    },
    {
      id: 'c_torre_mago', biomes: ['ruins', 'mountain', 'darkwood', 'dream', 'hills', 'swamp'], weight: 1, icon: 'arcane',
      title: 'La torre del mago',
      text: 'Una torre de piedra, torcida como un dedo viejo, se levanta sola en el medio de la nada. La puerta está entreabierta y adentro hay una escalera en caracol.',
      options: [
        { label: 'Subir al primer piso', check: { stat: 'agilidad', dc: 11 }, ok: { text: 'Algunos escalones se mueven solos, pero los esquivás.', next: 'biblioteca' }, fail: { text: 'Un escalón desaparece bajo tu pie y te golpeás la rodilla. Llegás igual, rengueando.', hurt: 0.08, next: 'biblioteca' } },
        { label: 'Golpear la puerta y preguntar', check: { stat: 'suerte', dc: 12 }, ok: { text: 'Nadie contesta, pero la puerta se abre del todo. Parece una invitación.', next: 'biblioteca', bonus: 1 }, fail: { text: 'Algo contesta desde adentro. No es el mago.', fight: {} } },
        { label: 'Dejar la torre en paz', ok: { text: 'Las torres de magos solos no traen nada bueno. Seguís.' } },
      ],
      steps: {
        biblioteca: {
          title: 'La biblioteca',
          text: 'El primer piso es una biblioteca. Los libros se acomodan solos en los estantes cuando pasás. Uno flota hacia vos y se abre.',
          options: [
            { label: 'Leer el libro que se abrió', check: { stat: 'ingenio', dc: 13 }, ok: { text: 'Es un manual de pociones. Copiás una receta y seguís subiendo con la cabeza llena de ideas.', xp: 0.4, mana: 0.5, next: 'laboratorio' }, fail: { text: 'Las letras se mueven mientras las leés. Te mareás y el libro se cierra de golpe en tu nariz.', hurt: 0.05, next: 'laboratorio' } },
            { label: 'Llevarte un par de libros', check: { stat: 'suerte', dc: 13 }, ok: { text: 'Agarrás dos libros y los guardás. Nadie protesta.', coins: 3, next: 'laboratorio' }, fail: { text: 'Los libros se te escapan de las manos y vuelan a picotearte como pájaros.', hurt: 0.1, next: 'laboratorio' } },
          ],
        },
        laboratorio: {
          title: 'El laboratorio',
          text: 'En el segundo piso hay frascos burbujeando sobre fuegos que nadie prendió. Tres pociones terminadas esperan en una mesa: una roja, una azul y una que cambia de color.',
          options: [
            { label: 'Llevarte la roja y la azul', ok: { text: 'Las guardás con cuidado. Son pociones de verdad.', items: [['pocion_curacion_menor', 1, 1], ['pocion_mana_menor', 1, 1]], next: 'cima' } },
            { label: 'Probar la que cambia de color', check: { stat: 'suerte', dc: 13 }, ok: { text: 'Sabe a menta y a tormenta. Sentís que tus pies pisan más firme que nunca.', train: 'suerte', next: 'cima' }, fail: { text: 'Te salen burbujas por las orejas un rato largo. No es grave, pero duele.', hurt: 0.12, next: 'cima' } },
          ],
        },
        cima: {
          title: 'La cima de la torre',
          text: 'Arriba de todo hay un telescopio de bronce apuntando a un lugar del cielo, y un muñeco de madera con túnica de mago sentado al lado. Del mago, ni rastro.',
          options: [
            { label: 'Mirar por el telescopio', check: { stat: 'ingenio', dc: 14 }, ok: { text: 'Ves el mundo entero desde arriba: caminos, ríos, lugares que no conocías. Cuando bajás la vista, entendés el mapa como nunca.', train: 'ingenio', xp: 0.8 }, fail: { text: 'Ves estrellas, muchas estrellas. Lindas, pero no te dicen nada.', xp: 0.3 } },
            { label: 'Revisar la túnica del muñeco', check: { stat: 'agilidad', dc: 12 }, ok: { text: 'En los bolsillos hay un pergamino y una bolsa de monedas. El muñeco gira la cabeza para mirarte, pero ya te fuiste.', coins: 4, items: [['pergamino_escape', 1, 1]], xp: 0.5 }, fail: { text: 'El muñeco te agarra la muñeca. No era un muñeco.', fight: { ambush: true } } },
          ],
        },
      },
    },
    {
      id: 'c_circulo_pruebas', biomes: WILD, weight: 1, icon: 'star',
      title: 'El círculo de las tres pruebas',
      text: 'Un círculo de piedras altas. Sobre la primera hay tallado: "Fuerza, pie y cabeza. Quien pase las tres, sale distinto de como entró."',
      options: [
        { label: 'Empezar la primera prueba', ok: { text: 'Entrás al círculo y una piedra enorme se cruza en tu camino.', next: 'fuerza' } },
        { label: 'No entrar', ok: { text: 'No te hace falta salir distinto. Seguís igual que antes.' } },
      ],
      steps: {
        fuerza: {
          title: 'Primera prueba: fuerza',
          text: 'Una piedra del tamaño de un barril tapa la salida hacia la segunda piedra. Hay que moverla.',
          options: [
            { label: 'Empujarla', check: { stat: 'fuerza', dc: 13 }, ok: { text: 'La piedra rueda despacio y se abre el paso.', xp: 0.3, next: 'pie' }, fail: { text: 'La piedra no se mueve. El círculo se apaga y te deja afuera.', hurt: 0.05 } },
            { label: 'Hacer palanca con un tronco', check: { stat: 'ingenio', dc: 14 }, ok: { text: 'No es fuerza, pero el círculo lo acepta. Pasás.', xp: 0.2, next: 'pie' }, fail: { text: 'El tronco se parte. El círculo se apaga.', time: 1 } },
          ],
        },
        pie: {
          title: 'Segunda prueba: pie',
          text: 'El piso entre la segunda y la tercera piedra se llena de agujeros que se abren y se cierran como bocas.',
          options: [
            { label: 'Cruzar saltando', check: { stat: 'agilidad', dc: 13 }, ok: { text: 'Saltás de piedra en piedra sin mirar atrás.', xp: 0.3, next: 'cabeza' }, fail: { text: 'Un agujero te muerde el tobillo. El círculo se apaga.', hurt: 0.1 } },
            { label: 'Esperar el ritmo y pasar', check: { stat: 'suerte', dc: 13 }, ok: { text: 'Los agujeros tienen un ritmo, y lo encontrás. Pasás caminando.', xp: 0.2, next: 'cabeza' }, fail: { text: 'El ritmo cambia justo cuando entrás. Salís despedido.', hurt: 0.1 } },
          ],
        },
        cabeza: {
          title: 'Tercera prueba: cabeza',
          text: 'La última piedra tiene una boca tallada que habla: "Tengo ciudades sin casas, ríos sin agua y bosques sin árboles. ¿Qué soy?"',
          options: [
            { label: 'Responder: "Un mapa"', check: { stat: 'ingenio', dc: 12 }, ok: { text: 'La piedra sonríe. Las tres piedras se encienden a la vez y una luz te atraviesa. Salís del círculo distinto, como prometía.', train: 'any', xp: 1 }, fail: { text: 'Lo decís, pero dudás al final. La piedra se ríe y el círculo se apaga. Algo aprendiste igual.', xp: 0.5 } },
            { label: 'Responder: "Un sueño"', ok: { text: 'La piedra suspira. "Lindo, pero no." El círculo se apaga despacio.', xp: 0.3 } },
          ],
        },
      },
    },
    {
      id: 'c_contrabandistas', biomes: ['coast', 'sea', 'swamp', 'pirate'], time: 'night', weight: 2, icon: 'chest',
      title: 'Luces en la orilla',
      text: 'Una lancha sin bandera llega a la orilla con las luces apagadas. Unos hombres bajan cajones y los esconden en una cueva.',
      options: [
        { label: 'Acercarte a escuchar', check: { stat: 'agilidad', dc: 12 }, ok: { text: 'Te escondés detrás de unas rocas. Hablan de un cargamento y de un guardia al que le pagaron para no ver.', next: 'cueva' }, fail: { text: 'Una piedra rueda bajo tu bota. Los contrabandistas sacan cuchillos.', fight: { ambush: true } } },
        { label: 'Irte antes de que te vean', ok: { text: 'No es asunto tuyo. Te vas por donde viniste.' } },
      ],
      steps: {
        cueva: {
          title: 'La cueva de los cajones',
          text: 'La lancha se va. En la cueva quedan los cajones y un solo guardia, dormitando sobre un barril.',
          options: [
            { label: 'Llevarte un cajón sin despertarlo', check: { stat: 'agilidad', dc: 13 }, ok: { text: 'Te llevás el cajón más chico. Pesa como si tuviera oro... y algo tiene.', coins: 4, items: [['ron_anejo', 1, 1]], loot: 1, xp: 0.4 }, fail: { text: 'El guardia abre un ojo. Después los dos. Después silba.', fight: {} } },
            { label: 'Despertarlo y negociar', check: { stat: 'ingenio', dc: 13 }, ok: { text: 'Le hacés entender que sabés todo. Prefiere pagarte para que te olvides.', coins: 5, xp: 0.4, next: 'trato' }, fail: { text: 'No le gusta tu tono. Saca el cuchillo.', fight: {} } },
          ],
        },
        trato: {
          title: 'Un trato',
          text: '"Si de verdad sabés callarte", dice el guardia, "mañana hay otro viaje. Necesitamos a alguien con buena puntería en la proa."',
          options: [
            { label: 'Aceptar el trabajo', check: { stat: 'punteria', dc: 13 }, ok: { text: 'La noche siguiente cuidás la lancha. Hay un susto con una patrulla, pero tu puntería los saca del apuro. Te pagan el doble y te enseñan a tirar con el barco moviéndose.', coins: 4, train: 'punteria', xp: 0.5, time: 2 }, fail: { text: 'Fallás un tiro fácil y te bajan en la primera playa sin pagarte.', time: 2 } },
            { label: 'Agarrar la plata e irte', ok: { text: 'Ya cobraste. No hace falta meterse más.' } },
          ],
        },
      },
    },
    {
      id: 'c_nido_grifo', biomes: ['mountain', 'hills'], time: 'day', weight: 1, icon: 'feather',
      title: 'Plumas doradas',
      text: 'Una pluma dorada, larga como un brazo, cae del cielo justo a tus pies. Arriba, en un pico, algo enorme hace un nido.',
      options: [
        { label: 'Empezar a trepar', check: { stat: 'fuerza', dc: 12 }, ok: { text: 'Subís a pulso la primera pared. Arriba hay una cornisa donde descansar.', items: [['mat_pluma', 1, 1]], next: 'cornisa' }, fail: { text: 'Las manos te resbalan a mitad de la pared. Bajás con los dedos lastimados.', hurt: 0.1 } },
        { label: 'Quedarte con la pluma', ok: { text: 'Con una alcanza. Debe valer algo.', items: [['mat_pluma', 1, 2]] } },
      ],
      steps: {
        cornisa: {
          title: 'La cornisa',
          text: 'Desde la cornisa se ve el nido. Una sombra gigante da vueltas en el cielo: es un grifo, y todavía no te vio.',
          options: [
            { label: 'Seguir mientras está lejos', check: { stat: 'agilidad', dc: 13 }, ok: { text: 'Trepás rápido aprovechando que vuela del otro lado.', next: 'nido' }, fail: { text: 'Una piedra se suelta y el grifo gira la cabeza. Bajás antes de que llegue, con el corazón en la boca.', hurt: 0.08 } },
            { label: 'Esperar a que se vaya', check: { stat: 'suerte', dc: 12 }, ok: { text: 'Después de un rato largo, el grifo se va a cazar.', next: 'nido', bonus: 2, time: 1 }, fail: { text: 'El grifo baja a la cornisa de al lado a descansar. No hay forma de pasar.', time: 1 } },
          ],
        },
        nido: {
          title: 'El nido',
          text: 'El nido está hecho de ramas, huesos y cosas que brillan. Hay tres huevos dorados y un montón de plumas sueltas.',
          options: [
            { label: 'Juntar plumas y lo que brilla', ok: { text: 'Llenás la bolsa de plumas y de cosas que el grifo le robó a algún viajero. Bajar te enseña más que subir.', items: [['mat_pluma', 2, 3]], coins: 3, loot: 1, train: 'agilidad', xp: 0.6 } },
            { label: 'Llevarte un huevo', check: { stat: 'suerte', dc: 15 }, ok: { text: 'Te lo llevás envuelto en tu capa. Vale una fortuna.', coins: 8, xp: 0.6 }, fail: { text: 'Un chillido parte el aire. La madre volvió.', fight: { ambush: true } } },
          ],
        },
      },
    },
    {
      id: 'c_pozo_profundo', biomes: ['cave', 'crypt', 'ruins', 'lair'], weight: 2, icon: 'trap',
      title: 'Un pozo sin fondo',
      text: 'Un pozo redondo baja hacia la oscuridad. Si tirás una piedra, tarda mucho en sonar. En el borde hay una cadena oxidada que baja.',
      options: [
        { label: 'Bajar por la cadena', check: { stat: 'fuerza', dc: 12 }, ok: { text: 'Bajás mano a mano. A mitad de camino hay una puerta en la pared del pozo.', next: 'puerta' }, fail: { text: 'La cadena se suelta un tramo y quedás colgando. Subís como podés.', hurt: 0.1 } },
        { label: 'Tirar una antorcha para ver', check: { stat: 'ingenio', dc: 11 }, ok: { text: 'La antorcha ilumina una puerta a mitad del pozo y huesos en el fondo. Ya sabés a dónde ir y qué evitar.', next: 'puerta', bonus: 2 }, fail: { text: 'La antorcha se apaga en el aire. No ves nada.', xp: 0.1 } },
      ],
      steps: {
        puerta: {
          title: 'La puerta en la pared',
          text: 'La puerta está tallada en la roca, con una manija de hierro. Del otro lado se escucha agua... y algo que raspa.',
          options: [
            { label: 'Abrir y entrar', check: { stat: 'agilidad', dc: 12 }, ok: { text: 'Entrás a una cámara seca, con cofres podridos y un altar. Lo que raspaba era una rata enorme que se escapa.', coins: 4, loot: 1, next: 'altar' }, fail: { text: 'Lo que raspaba no era una rata.', fight: { ambush: true } } },
            { label: 'Volver a subir', ok: { text: 'Mejor no. Subís a la luz con los brazos cansados.', xp: 0.2 } },
          ],
        },
        altar: {
          title: 'El altar del fondo',
          text: 'Sobre el altar hay una copa de piedra con agua que no se evapora nunca. Al lado, una inscripción: "Bebe quien no teme".',
          options: [
            { label: 'Beber', check: { stat: 'suerte', dc: 12 }, ok: { text: 'El agua está helada y te llena de fuerza. Algo cambia en tus brazos.', train: 'fuerza', heal: 0.3, xp: 0.5 }, fail: { text: 'El agua quema como fuego frío. Te deja temblando un buen rato.', hurt: 0.15, xp: 0.3 } },
            { label: 'Llevarte la copa', check: { stat: 'fuerza', dc: 13 }, ok: { text: 'La copa sale del altar con un crujido. Pesa, pero vale lo que pesa.', items: [['reliquia_olvidada', 1, 1]], xp: 0.4 }, fail: { text: 'El altar no la suelta y algo se despierta en el fondo del pozo.', fight: {} } },
          ],
        },
      },
    },
    {
      id: 'c_caravana', biomes: ['desert', 'plains', 'hills', 'coast'], time: 'day', weight: 2, icon: 'bag',
      title: 'Una caravana pide escolta',
      text: 'Una caravana de cuatro carros se detiene a tu lado. La jefa te mira de arriba abajo: "Pagamos bien si nos acompañás hasta el próximo pozo. Dicen que hay bandidos."',
      options: [
        { label: 'Aceptar', ok: { text: 'Te subís al primer carro. El sol pega fuerte y el camino es largo.', next: 'emboscada', time: 1 } },
        { label: 'Venderles algo de comida', needs: { food: 2 }, ok: { text: 'Te pagan más de lo que vale.', food: -2, coins: 3 } },
        { label: 'Decir que no', ok: { text: 'La jefa se encoge de hombros y sigue.' } },
      ],
      steps: {
        emboscada: {
          title: 'Los bandidos',
          text: 'A mitad de camino, unos jinetes bajan de una loma y rodean los carros. El que manda pide la mitad de la carga "o todo, si se ponen difíciles".',
          options: [
            { label: 'Pelear', ok: { text: 'Bajás del carro con el arma en la mano.', fight: { guard: true } } },
            { label: 'Convencerlos de que no vale la pena', check: { stat: 'ingenio', dc: 13 }, ok: { text: 'Les decís que en los carros hay soldados escondidos. Te creen, y se van.', next: 'pozo' }, fail: { text: 'Se ríen. Uno baja del caballo.', fight: { ambush: true } } },
            { label: 'Tirarle al jefe desde el carro', check: { stat: 'punteria', dc: 13 }, ok: { text: 'Le volás el sombrero de un tiro. Los demás entienden el mensaje y se van al galope.', next: 'pozo', xp: 0.3 }, fail: { text: 'Fallás. Ahora están enojados.', fight: {} } },
          ],
        },
        pozo: {
          title: 'El pozo',
          text: 'Llegan al pozo sin perder un carro. La jefa cuenta las monedas y te las da sin regatear. "Si querés, seguí con nosotros: siempre hace falta alguien como vos."',
          options: [
            { label: 'Cobrar y despedirte', ok: { text: 'Te vas con la bolsa llena y la cantimplora también.', coins: 5, food: 2, xp: 0.6 } },
            { label: 'Pedir que te enseñen a leer el desierto', check: { stat: 'ingenio', dc: 12 }, ok: { text: 'Los guías te enseñan a orientarte con el sol y las piedras. Te pagan un poco menos, pero vale más.', coins: 3, train: 'ingenio', xp: 0.5, time: 1 }, fail: { text: 'Te explican, pero entre el calor y el cansancio no te queda nada. Te pagan igual.', coins: 4 } },
          ],
        },
      },
    },

    // ============================================================
    // 3) Escenas nuevas en cadena (en grupo: todo en plural)
    // ============================================================
    {
      id: 'g_c_puente', biomes: ['forest', 'mountain', 'hills', 'swamp', 'darkwood', 'plains'], party: true, weight: 2, icon: 'hammer',
      title: 'Un puente caído',
      text: 'El puente sobre la quebrada se vino abajo. Quedan los postes de los dos lados y tablas tiradas por todas partes.',
      options: [
        { label: 'Juntar madera entre todos', check: { stat: 'fuerza', dc: 12, together: true }, ok: { text: 'En un rato tienen tablas y troncos de sobra.', next: 'g_cuerdas' }, fail: { text: 'La madera está podrida. Pierden la tarde y tienen que rodear.', time: 2 } },
        { label: 'Rodear la quebrada', ok: { text: 'Es más largo, pero nadie se cae.', time: 2 } },
      ],
      steps: {
        g_cuerdas: {
          title: 'Atar las cuerdas',
          text: 'Alguien tiene que cruzar primero con la soga para atarla del otro lado. Hay una cornisa angosta por la pared.',
          options: [
            { label: 'Que cruce el más ágil', check: { stat: 'agilidad', dc: 13, best: true }, ok: { text: 'Cruza pegado a la pared, sin mirar abajo, y ata la soga del otro lado. Los demás aplauden.', next: 'g_cruzar' }, fail: { text: 'Se resbala en la mitad y queda colgando de la soga. Lo suben entre todos, raspado y pálido.', hurt: 0.1, next: 'g_cruzar' } },
            { label: 'Que el de mejor puntería tire la soga', check: { stat: 'punteria', dc: 13, best: true }, ok: { text: 'Ata una piedra a la soga y la tira. Se enrosca justo en el poste.', next: 'g_cruzar', bonus: 2 }, fail: { text: 'La soga cae a la quebrada. Tienen que bajar a buscarla.', time: 1, next: 'g_cruzar' } },
          ],
        },
        g_cruzar: {
          title: 'El puente nuevo',
          text: 'Con la soga atada, arman un puente de tablas que se mueve con el viento. Ahora hay que cruzarlo.',
          options: [
            { label: 'Cruzar de a uno, despacio', check: { stat: 'agilidad', dc: 12, together: true }, ok: { text: 'Cruzan todos. Del otro lado, un viajero que esperaba les da las gracias y unas monedas. Hacer algo así entre todos les enseña cosas que solos no aprenderían.', coins: 3, xp: 0.6, train: 'any' }, fail: { text: 'Una tabla cede bajo alguno. Llegan, pero con un susto y un tobillo torcido.', hurt: 0.1, xp: 0.3 } },
            { label: 'Cobrarles a los que quieran cruzar', check: { stat: 'ingenio', dc: 12, best: true }, ok: { text: 'Se quedan un rato cobrando peaje. Hay mucha gente esperando.', coins: 5, xp: 0.3, time: 1 }, fail: { text: 'Nadie quiere pagar por un puente así. Cruzan y siguen.', time: 1 } },
          ],
        },
      },
    },
    {
      id: 'g_c_guardian', biomes: ['ruins', 'crypt', 'desert', 'mountain', 'cave'], party: true, weight: 2, icon: 'shield',
      title: 'El guardián de piedra',
      text: 'Un gigante de piedra, sentado delante de un portal, abre los ojos cuando se acercan. "Tres preguntas. Uno contesta, todos pagan si se equivoca."',
      options: [
        { label: 'Aceptar el desafío', ok: { text: 'El guardián se acomoda y levanta un dedo de piedra.', next: 'g_preg1' } },
        { label: 'Buscar otra entrada entre todos', check: { stat: 'agilidad', dc: 14, together: true }, ok: { text: 'Por detrás hay un hueco. Pasan sin que el guardián se dé cuenta.', coins: 3, loot: 1 }, fail: { text: 'El guardián los ve dando vueltas y se levanta.', fight: {} } },
        { label: 'Irse', ok: { text: 'El guardián cierra los ojos otra vez. Tiene todo el tiempo del mundo.' } },
      ],
      steps: {
        g_preg1: {
          title: 'Primera pregunta',
          text: '"¿Qué se rompe sin tocarlo?"',
          options: [
            { label: 'Que conteste el más sabio: "El silencio"', check: { stat: 'ingenio', dc: 12, best: true }, ok: { text: 'El guardián asiente y la tierra tiembla un poco. Una de las tres runas del portal se enciende.', xp: 0.3, next: 'g_preg2' }, fail: { text: 'Lo dice, pero duda al final. El guardián les da un golpecito de castigo que los manda al piso.', hurt: 0.1, next: 'g_preg2' } },
            { label: 'Contestar todos juntos a los gritos', check: { stat: 'suerte', dc: 13 }, ok: { text: 'Uno de los gritos es el correcto. El guardián se ríe, por primera vez en siglos.', xp: 0.2, next: 'g_preg2' }, fail: { text: 'El guardián se tapa los oídos y se enoja.', fight: {} } },
          ],
        },
        g_preg2: {
          title: 'Segunda pregunta',
          text: '"Esta no es de palabras." El guardián señala una piedra redonda tan grande como él. "Llévenla hasta el portal."',
          options: [
            { label: 'Empujarla entre todos', check: { stat: 'fuerza', dc: 14, together: true }, ok: { text: 'La piedra rueda y encaja en el portal. La segunda runa se enciende.', xp: 0.3, next: 'g_preg3' }, fail: { text: 'La piedra se les viene encima en una bajada. Alguno queda magullado.', hurt: 0.15, next: 'g_preg3' } },
            { label: 'Que el más listo arme una rampa', check: { stat: 'ingenio', dc: 13, best: true }, ok: { text: 'Con tablas y piedras arman una rampa y la piedra rueda sola.', xp: 0.3, next: 'g_preg3' }, fail: { text: 'La rampa se rompe. Pierden un buen rato hasta lograrlo a la fuerza.', time: 2, next: 'g_preg3' } },
          ],
        },
        g_preg3: {
          title: 'Última pregunta',
          text: '"Uno de ustedes tiene que tirar esta lanza y darle al centro de la luna que tallé en esa pared." Está lejísimos.',
          options: [
            { label: 'Que tire el de mejor puntería', check: { stat: 'punteria', dc: 14, best: true }, ok: { text: 'La lanza vuela y se clava en el centro. El portal se abre y el guardián se aparta: adentro hay un tesoro de otra época. Todos salen sabiendo más que cuando entraron.', coins: 6, loot: 2, xp: 0.8, train: 'any' }, fail: { text: 'La lanza pega en el borde. El guardián suspira: "Casi." Les deja llevarse algo igual.', coins: 3, xp: 0.4 } },
          ],
        },
      },
    },
    {
      id: 'g_c_torneo', biomes: ['plains', 'meadow', 'hills', 'forest'], party: true, time: 'day', weight: 1, icon: 'trophy',
      title: 'Las fiestas del pueblo',
      text: 'En un pueblito hacen las fiestas de la cosecha. Hay banderines, cerveza y un cartel: "Torneo de tres pruebas. Premio para el grupo ganador."',
      options: [
        { label: 'Anotarse', needs: { coins: 1 }, ok: { text: 'Pagan la entrada y les dan una cinta de colores.', coins: -1, next: 'g_tiro' } },
        { label: 'Mirar desde la tribuna', ok: { text: 'Comen, toman algo y se ríen un rato. Hacía falta.', heal: 0.2, food: 1, time: 1 } },
      ],
      steps: {
        g_tiro: {
          title: 'Primera prueba: tiro al blanco',
          text: 'Una manzana sobre un poste a treinta pasos. El público grita.',
          options: [
            { label: 'Que tire el de mejor puntería', check: { stat: 'punteria', dc: 13, best: true }, ok: { text: 'La manzana vuela en pedazos. La gente aplaude de pie.', xp: 0.2, next: 'g_pulseada', bonus: 1 }, fail: { text: 'Le pasa cerca. Otros lo hacen mejor, pero siguen en carrera.', next: 'g_pulseada' } },
          ],
        },
        g_pulseada: {
          title: 'Segunda prueba: la cuerda',
          text: 'Tirar de una cuerda contra el grupo de los herreros del pueblo, que tienen brazos como troncos.',
          options: [
            { label: 'Tirar todos juntos', check: { stat: 'fuerza', dc: 14, together: true }, ok: { text: 'Los herreros terminan en el barro. Nadie lo puede creer.', xp: 0.2, next: 'g_carrera', bonus: 1 }, fail: { text: 'Los arrastran por todo el campo. El público se ríe, ustedes también.', next: 'g_carrera' } },
            { label: 'Atar la cuerda a un poste sin que vean', check: { stat: 'ingenio', dc: 13, best: true }, ok: { text: 'Los herreros tiran y tiran y no entienden nada. Ganan, más o menos honestamente.', next: 'g_carrera' }, fail: { text: 'Los descubren. Los descalifican entre abucheos.', time: 1 } },
          ],
        },
        g_carrera: {
          title: 'Última prueba: la carrera',
          text: 'Una carrera de postas alrededor de la plaza. Cada uno corre un tramo.',
          options: [
            { label: 'Correr con todo', check: { stat: 'agilidad', dc: 13, together: true }, ok: { text: '¡Ganan el torneo! Les dan una bolsa de monedas, un jamón y una corona de flores a cada uno. Y aprenden un par de trucos de los otros competidores.', coins: 5, items: [['carne_seca', 1, 2]], xp: 0.7, train: 'any' }, fail: { text: 'Llegan segundos por un pelo. Igual les dan un premio consuelo y mucha comida.', coins: 2, food: 2, xp: 0.4 } },
          ],
        },
      },
    },
    {
      id: 'g_c_naufragio', biomes: ['coast', 'sea', 'pirate', 'abyss'], party: true, weight: 2, icon: 'scroll',
      title: 'Un barco encallado',
      text: 'Un barco mercante quedó encallado entre las rocas, inclinado de costado. Las olas lo golpean y cruje, pero todavía no se hunde.',
      options: [
        { label: 'Subir a bordo entre todos', check: { stat: 'agilidad', dc: 12, together: true }, ok: { text: 'Se ayudan a trepar por el casco mojado y llegan a la cubierta.', next: 'g_cubierta' }, fail: { text: 'Una ola los barre de las rocas. Llegan a la orilla empapados y golpeados.', hurt: 0.1 } },
        { label: 'Juntar lo que trae el agua', ok: { text: 'En la orilla hay cajas rotas y alguna cosa útil.', loot: 1, time: 1 } },
      ],
      steps: {
        g_cubierta: {
          title: 'La cubierta inclinada',
          text: 'La cubierta está torcida y resbalosa. Hay una escotilla que baja a la bodega y un camarote del capitán con la puerta trabada.',
          options: [
            { label: 'Bajar a la bodega', ok: { text: 'Bajan con cuidado. El agua llega a las rodillas y algo se mueve entre los barriles.', next: 'g_bodega' } },
            { label: 'Que el más fuerte abra el camarote', check: { stat: 'fuerza', dc: 13, best: true }, ok: { text: 'La puerta salta. Adentro hay un cofre del capitán y un mapa de cartas marinas.', coins: 4, items: [['doblon', 1, 2]], xp: 0.4, next: 'g_bodega' }, fail: { text: 'El barco se inclina más con los golpes. Mejor bajar antes de que se dé vuelta.', next: 'g_bodega' } },
          ],
        },
        g_bodega: {
          title: 'La bodega inundada',
          text: 'Entre los barriles flotan cajones sellados. El casco cruje cada vez más fuerte.',
          options: [
            { label: 'Sacar cajones haciendo cadena', check: { stat: 'fuerza', dc: 13, together: true }, ok: { text: 'Se pasan los cajones de mano en mano hasta la orilla. Justo cuando sale el último, el barco se parte en dos.', coins: 4, loot: 2, xp: 0.6 }, fail: { text: 'El barco se mueve y un barril aplasta a alguno contra la pared. Salen con lo poco que agarraron.', hurt: 0.15, coins: 2 } },
            { label: 'Ver qué se mueve entre los barriles', check: { stat: 'ingenio', dc: 12, best: true }, ok: { text: 'Lo ven antes de que los vea.', fight: { surprise: true } }, fail: { text: 'Sale del agua de golpe.', fight: { ambush: true } } },
          ],
        },
      },
    },
  ];

  for (const ev of NEW) if (!byId(ev.id)) list.push(ev);
})(window.Aventurs);
