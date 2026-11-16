/* ============================================================
   Aventurs — Seed: Eventos de exploración (v2.0)

   Cada vez que explorás una zona de combate pasa ALGO: o aparece una
   criatura (y elegís cómo encararla) o te toca una de estas escenas.

   Modelo de escena:
     id, biomes: ['forest', ...] o ['any'], weight, icon (ícono pixel),
     title, text, options: [opción, opción, (opción)]

   Opción:
     label            texto del botón
     check            { stat, dc } — se tira D20 + tu bonus contra dc.
                      stat: fuerza | agilidad | ingenio | punteria | suerte
                      La dificultad sube sola con el tier de la zona.
     needs            { coins: m } o { food: n }: lo que cuesta elegirla
     ok / fail        resultado si sale bien o mal (sin check: solo ok)

   Resultado:
     text             lo que pasa
     coins: m         monedas (m × lo que suelta un enemigo de la zona)
     items: [[id, min, max], ...]   objetos
     loot: n          n objetos del bioma (hierbas, minerales, etc.)
     heal / hurt: f   vida (fracción de tu vida máxima; nunca te mata)
     mana: f          maná (fracción)
     food: n          comida (+ o -)
     xp: m            experiencia (m × lo que da un enemigo de la zona)
     time: n          tiempo extra que perdés
     fight: {}        empieza un combate ({ surprise } actuás primero,
                      { ambush } te atacan primero)
   ============================================================ */

(function (A) {
  'use strict';

  const EVENTS = [
    // ============================================================
    // Cualquier zona
    // ============================================================
    {
      id: 'viajero_herido', biomes: ['any'], weight: 3, icon: 'heart',
      title: 'Un viajero herido',
      text: 'Contra una piedra descansa un viajero con la pierna vendada a las apuradas. Te mira con alivio y te pide ayuda.',
      options: [
        { label: 'Curarle la herida', check: { stat: 'ingenio', dc: 10 },
          ok: { text: 'Limpiás la herida y la vendás bien. Agradecido, te da unas monedas y te cuenta por dónde no conviene andar.', coins: 2, xp: 0.5 },
          fail: { text: 'Hacés lo que podés con lo que tenés. No quedó prolijo, pero el viajero te agradece igual.', xp: 0.25 } },
        { label: 'Compartir tu comida', needs: { food: 3 },
          ok: { text: 'Comen juntos en silencio. Antes de irse te deja un frasco que llevaba guardado.', food: -3, items: [['pocion_curacion_menor', 1, 1]], xp: 0.3 } },
        { label: 'Seguir tu camino',
          ok: { text: 'Le deseás suerte y seguís. A los pocos pasos, todavía sentís su mirada en la espalda.' } },
      ],
    },
    {
      id: 'cofre_enterrado', biomes: ['any'], weight: 3, icon: 'chest',
      title: 'Un cofre a medio enterrar',
      text: 'La tierra removida deja ver la tapa de un cofre con herrajes oxidados. Alguien lo escondió con apuro.',
      options: [
        { label: 'Forzar la tapa', check: { stat: 'fuerza', dc: 12 },
          ok: { text: 'La tapa cede con un crujido seco. Adentro hay monedas envueltas en un trapo.', coins: 4, loot: 1 },
          fail: { text: 'Tirás con todo y la bisagra te muerde la mano. La tapa ni se mueve.', hurt: 0.1 } },
        { label: 'Buscar trampas primero', check: { stat: 'ingenio', dc: 12 },
          ok: { text: 'Encontrás una aguja escondida en la cerradura y la desarmás. El cofre se abre sin pelear.', coins: 4, loot: 1, xp: 0.25 },
          fail: { text: 'No ves la aguja hasta que te pincha. El cofre se abre, pero te sangra el dedo.', coins: 3, hurt: 0.15 } },
        { label: 'Dejarlo donde está',
          ok: { text: 'Algo en ese cofre no te gusta. Lo tapás con tierra y seguís.' } },
      ],
    },
    {
      id: 'fuente_clara', biomes: ['any'], weight: 2, icon: 'potion',
      title: 'Agua clara',
      text: 'Entre las piedras brota un hilo de agua fría y transparente. El lugar está tranquilo.',
      options: [
        { label: 'Beber y descansar un rato',
          ok: { text: 'El agua te devuelve el aliento. Te quedás un rato hasta que se te pasa el cansancio.', heal: 0.25, mana: 0.25, time: 1 } },
        { label: 'Lavarte las heridas',
          ok: { text: 'El agua fría arde un poco, pero las heridas quedan limpias.', heal: 0.35 } },
      ],
    },
    {
      id: 'huellas_frescas', biomes: ['any'], weight: 3, icon: 'tracks',
      title: 'Huellas frescas',
      text: 'Las huellas cruzan el sendero y se pierden entre la maleza. Lo que sea que las dejó, pasó hace muy poco.',
      options: [
        { label: 'Seguirlas sin hacer ruido', check: { stat: 'agilidad', dc: 11 },
          ok: { text: 'Lo encontrás antes de que te encuentre. Tenés la ventaja.', fight: { surprise: true } },
          fail: { text: 'Pisás una rama. Lo que seguías ahora te sigue a vos.', fight: { ambush: true } } },
        { label: 'Estudiarlas desde lejos', check: { stat: 'ingenio', dc: 10 },
          ok: { text: 'Por el tamaño y el paso, sabés qué es y hacia dónde va. Aprendés algo del lugar.', xp: 0.5 },
          fail: { text: 'Las huellas se mezclan con otras. No sacás nada en limpio.', xp: 0.1 } },
      ],
    },
    {
      id: 'mercader_ambulante', biomes: ['any'], weight: 2, icon: 'bag',
      title: 'Un mercader ambulante',
      text: 'Un mercader con una mula cargada hasta las orejas te saluda desde lejos. "¿Algo para el camino, viajero?"',
      options: [
        { label: 'Comprarle una poción', needs: { coins: 3 },
          ok: { text: 'Te vende una poción y te desea buena suerte.', coins: -3, items: [['pocion_curacion_menor', 1, 1]] } },
        { label: 'Regatear', check: { stat: 'ingenio', dc: 13 },
          ok: { text: 'Se ríe, se queja y al final te regala una poción "por la conversación".', items: [['pocion_curacion_menor', 1, 1]] },
          fail: { text: 'Se ofende y se va murmurando. La mula te mira con desprecio.' } },
        { label: 'Preguntarle por el camino',
          ok: { text: 'Te cuenta qué hay más adelante y qué conviene evitar.', xp: 0.3 } },
      ],
    },
    {
      id: 'campamento_abandonado', biomes: ['any'], weight: 2, icon: 'campfire',
      title: 'Un campamento abandonado',
      text: 'Una fogata apagada, una manta rota y una olla dada vuelta. Quien estuvo acá se fue con prisa.',
      options: [
        { label: 'Revisar las cosas', check: { stat: 'ingenio', dc: 10 },
          ok: { text: 'Debajo de la manta hay una bolsita con monedas y algo de comida.', coins: 2, items: [['carne_seca', 1, 2]] },
          fail: { text: 'Solo encontrás un pan duro. Algo es algo.', items: [['pan', 1, 1]] } },
        { label: 'Prender el fuego y descansar',
          ok: { text: 'El fuego vuelve a crepitar. Comés tranquilo y recuperás fuerzas.', heal: 0.2, food: 2, time: 1 } },
      ],
    },
    {
      id: 'piedra_runica', biomes: ['any'], weight: 1, icon: 'arcane',
      title: 'Una piedra con runas',
      text: 'Una piedra alta, cubierta de musgo, tiene runas que brillan apenas cuando te acercás.',
      options: [
        { label: 'Tocar las runas', check: { stat: 'ingenio', dc: 13 },
          ok: { text: 'Un calor suave te recorre los brazos. Te sentís despejado y lleno de energía.', mana: 1, heal: 0.2, xp: 0.5 },
          fail: { text: 'La piedra te devuelve una descarga que te tira al piso.', hurt: 0.15 } },
        { label: 'Copiar los símbolos',
          ok: { text: 'Copiás los símbolos con paciencia. Algún sabio va a saber qué dicen.', xp: 0.4 } },
      ],
    },

    // ============================================================
    // Bosque
    // ============================================================
    {
      id: 'panal', biomes: ['forest'], weight: 3, icon: 'food',
      title: 'Un panal enorme',
      text: 'De una rama alta cuelga un panal del tamaño de un barril. Las abejas zumban, ocupadas.',
      options: [
        { label: 'Trepar a buscar la miel', check: { stat: 'agilidad', dc: 11 },
          ok: { text: 'Subís, cortás un buen pedazo y bajás antes de que se den cuenta. La miel es oscura y espesa.', food: 6, heal: 0.15 },
          fail: { text: 'Las abejas te encuentran a mitad de camino. Bajás más rápido de lo que subiste.', hurt: 0.15 } },
        { label: 'Ahumarlas primero', check: { stat: 'ingenio', dc: 12 },
          ok: { text: 'El humo las adormece. Te llevás la miel sin una sola picadura.', food: 6, heal: 0.15 },
          fail: { text: 'El humo las enoja más. Te vas corriendo, con la ropa llena de abejas.', hurt: 0.1 } },
        { label: 'Dejarlas en paz',
          ok: { text: 'Hay batallas que no vale la pena pelear.' } },
      ],
    },
    {
      id: 'ciervo_blanco', biomes: ['forest'], weight: 2, icon: 'eye',
      title: 'El ciervo blanco',
      text: 'Entre los árboles, un ciervo blanco te mira fijo. Dicen que solo se deja ver por quien tiene buen corazón.',
      options: [
        { label: 'Seguirlo', check: { stat: 'agilidad', dc: 12 },
          ok: { text: 'Te lleva hasta un claro escondido, lleno de hierbas y luz. Descansás ahí como nunca.', heal: 1, loot: 2, xp: 0.3 },
          fail: { text: 'Lo perdés de vista y das vueltas una hora hasta encontrar el sendero.', time: 2, food: -2 } },
        { label: 'Dejarlo ir',
          ok: { text: 'El ciervo inclina la cabeza y desaparece. Te queda una sensación de calma.', heal: 0.15, xp: 0.2 } },
      ],
    },
    {
      id: 'trampa_cazador', biomes: ['forest', 'plains'], weight: 2, icon: 'trap',
      title: 'Una trampa de cazador',
      text: 'Un zorro quedó atrapado en una trampa de hierro. Te gruñe, pero está agotado.',
      options: [
        { label: 'Abrir la trampa', check: { stat: 'fuerza', dc: 10 },
          ok: { text: 'Abrís las mandíbulas de hierro. El zorro se escapa cojeando y, antes de perderse, te mira un instante.', xp: 0.5 },
          fail: { text: 'La trampa se cierra de nuevo y te agarra los dedos. El zorro aprovecha y se escapa igual.', hurt: 0.1, xp: 0.25 } },
        { label: 'Desarmarla con cuidado', check: { stat: 'ingenio', dc: 11 },
          ok: { text: 'Soltás el resorte sin lastimar a nadie. Te quedás con la cuerda de la trampa.', items: [['cuerda', 1, 1]], xp: 0.3 },
          fail: { text: 'El resorte salta y te golpea la mano. El zorro sale disparado.', hurt: 0.1 } },
      ],
    },
    {
      id: 'hongos_brillantes', biomes: ['forest', 'swamp', 'cave'], weight: 2, icon: 'herb',
      title: 'Hongos que brillan',
      text: 'Un círculo de hongos brilla con una luz verde apagada. Huelen a tierra mojada y a algo dulce.',
      options: [
        { label: 'Probar uno', check: { stat: 'suerte', dc: 11 },
          ok: { text: 'Sabe raro, pero te despeja la cabeza y te calienta el cuerpo.', mana: 0.5, heal: 0.2 },
          fail: { text: 'Te da vueltas el estómago durante un buen rato.', hurt: 0.1, food: -2 } },
        { label: 'Juntar algunos para vender',
          ok: { text: 'Los envolvés con cuidado. Algún alquimista los va a querer.', loot: 1 } },
      ],
    },

    // ============================================================
    // Cementerio, criptas y catacumbas
    // ============================================================
    {
      id: 'tumba_abierta', biomes: ['graveyard', 'crypt'], weight: 3, icon: 'skull',
      title: 'Una tumba abierta',
      text: 'La tierra de esta tumba está removida y fresca. Desde abajo llega un olor a humedad... y un ruido.',
      options: [
        { label: 'Bajar a mirar', check: { stat: 'agilidad', dc: 11 },
          ok: { text: 'Bajás sin hacer ruido. Entre los huesos brillan monedas viejas.', coins: 3, items: [['moneda_antigua', 1, 2]] },
          fail: { text: 'Resbalás en el barro y caés sobre algo que se mueve.', fight: { ambush: true } } },
        { label: 'Esperar escondido', check: { stat: 'ingenio', dc: 11 },
          ok: { text: 'Lo que sale de la tumba no te ve venir.', fight: { surprise: true } },
          fail: { text: 'Te aburrís esperando y cuando te asomás, ya te estaba mirando.', fight: {} } },
        { label: 'Taparla y rezar',
          ok: { text: 'Echás tierra y decís unas palabras. El ruido se calma.', xp: 0.3 } },
      ],
    },
    {
      id: 'ofrendas', biomes: ['graveyard'], weight: 2, icon: 'coin',
      title: 'Ofrendas en una lápida',
      text: 'Sobre una lápida hay velas apagadas, flores secas y un puñado de monedas.',
      options: [
        { label: 'Tomar las monedas', check: { stat: 'suerte', dc: 11 },
          ok: { text: 'Nadie protesta. Las monedas pesan más de lo que parecía.', coins: 3 },
          fail: { text: 'Apenas las tocás, una figura pálida se levanta de la tumba.', fight: { ambush: true } } },
        { label: 'Dejar una moneda tuya', needs: { coins: 1 },
          ok: { text: 'Prendés una vela y dejás tu moneda. Una paz extraña te acompaña al irte.', coins: -1, heal: 0.4, mana: 0.4 } },
      ],
    },
    {
      id: 'sarcofago', biomes: ['crypt', 'ruins'], weight: 2, icon: 'lock',
      title: 'Un sarcófago sellado',
      text: 'Un sarcófago de piedra con el nombre borrado. La tapa tiene un mecanismo de engranajes oxidados.',
      options: [
        { label: 'Descifrar el mecanismo', check: { stat: 'ingenio', dc: 14 },
          ok: { text: 'Los engranajes giran y la tapa se corre sola. Adentro: joyas y una reliquia.', coins: 5, items: [['reliquia_olvidada', 1, 1]], xp: 0.5 },
          fail: { text: 'Algo hace clic. Una nube de polvo venenoso te llena los pulmones.', hurt: 0.2 } },
        { label: 'Correr la tapa a la fuerza', check: { stat: 'fuerza', dc: 15 },
          ok: { text: 'Con un esfuerzo enorme corrés la tapa. Las joyas siguen ahí.', coins: 5, loot: 1 },
          fail: { text: 'La tapa no se mueve y el ruido despierta a alguien.', fight: {} } },
      ],
    },

    // ============================================================
    // Camino y llanuras
    // ============================================================
    {
      id: 'carreta_volcada', biomes: ['plains'], weight: 3, icon: 'gear',
      title: 'Una carreta volcada',
      text: 'Una carreta está tumbada al costado del camino. El carretero intenta levantarla solo, sin suerte.',
      options: [
        { label: 'Ayudar a levantarla', check: { stat: 'fuerza', dc: 12 },
          ok: { text: 'Entre los dos la enderezan. El carretero te paga el favor con generosidad.', coins: 4, xp: 0.3 },
          fail: { text: 'La rueda se te escapa y te golpea la pierna. Al final la levantan entre tres.', hurt: 0.1, coins: 1 } },
        { label: 'Arreglar la rueda', check: { stat: 'ingenio', dc: 12 },
          ok: { text: 'Ves que el eje está flojo y lo acomodás. El carretero te da pan y queso para el camino.', items: [['pan', 2, 2], ['queso', 1, 1]], xp: 0.3 },
          fail: { text: 'No le encontrás la vuelta. El carretero suspira y te agradece igual.' } },
      ],
    },
    {
      id: 'patrulla', biomes: ['plains'], weight: 2, icon: 'shield',
      title: 'Una patrulla del reino',
      text: 'Tres soldados te cortan el paso. "¿A dónde vas tan apurado?", pregunta el que parece el jefe.',
      options: [
        { label: 'Hablar con calma', check: { stat: 'ingenio', dc: 10 },
          ok: { text: 'Les contás de dónde venís. Te dejan pasar y te avisan de unos bandidos más adelante.', xp: 0.4 },
          fail: { text: 'No les gusta tu tono. Te cobran un "peaje" antes de dejarte ir.', coins: -1 } },
        { label: 'Ofrecerles ayuda',
          ok: { text: 'Les ayudás a cargar unas bolsas. Te pagan por las molestias.', coins: 2, time: 1 } },
      ],
    },

    // ============================================================
    // Pantano
    // ============================================================
    {
      id: 'fuego_fatuo', biomes: ['swamp'], weight: 3, icon: 'spark',
      title: 'Una luz entre la niebla',
      text: 'Una luz azul flota sobre el agua quieta, como si te invitara a seguirla.',
      options: [
        { label: 'Seguir la luz', check: { stat: 'ingenio', dc: 13 },
          ok: { text: 'La luz se detiene sobre un bulto hundido: un tesoro que el pantano se tragó hace años.', coins: 6, xp: 0.3 },
          fail: { text: 'La luz se apaga y quedás hundido en el barro hasta la cintura.', hurt: 0.2, food: -2 } },
        { label: 'Darle la espalda',
          ok: { text: 'Conocés las historias. Te alejás sin mirar atrás.', xp: 0.2 } },
      ],
    },
    {
      id: 'sanguijuelas', biomes: ['swamp'], weight: 2, icon: 'bleed',
      title: 'Agua hasta las rodillas',
      text: 'El único paso es por un charco largo de agua negra. Algo se mueve debajo.',
      options: [
        { label: 'Cruzar rápido', check: { stat: 'agilidad', dc: 12 },
          ok: { text: 'Cruzás en cuatro saltos. Del otro lado encontrás hierbas raras.', loot: 1 },
          fail: { text: 'Salís lleno de sanguijuelas. Arrancarlas duele.', hurt: 0.15 } },
        { label: 'Buscar otro camino',
          ok: { text: 'Das un rodeo largo, pero llegás seco.', time: 1, loot: 1 } },
      ],
    },

    // ============================================================
    // Montañas
    // ============================================================
    {
      id: 'veta_mineral', biomes: ['mountain', 'cave'], weight: 3, icon: 'hammer',
      title: 'Una veta brillante',
      text: 'En la pared de roca brilla una veta de mineral. Con algo de esfuerzo se podría sacar.',
      options: [
        { label: 'Picar la roca', check: { stat: 'fuerza', dc: 12 },
          ok: { text: 'A golpes sacás buenos trozos. Uno brilla como si tuviera fuego adentro.', items: [['mineral_hierro', 1, 2], ['gema_ignea', 0, 1]] },
          fail: { text: 'La roca se desprende de golpe y te cae en el hombro.', hurt: 0.15, items: [['mineral_hierro', 1, 1]] } },
        { label: 'Buscar donde se quiebra fácil', check: { stat: 'ingenio', dc: 12 },
          ok: { text: 'Encontrás la grieta justa y la veta sale entera.', items: [['mineral_hierro', 2, 2], ['obsidiana', 0, 1]] },
          fail: { text: 'Solo sacás polvo y piedritas.' } },
      ],
    },
    {
      id: 'paso_estrecho', biomes: ['mountain'], weight: 2, icon: 'boot',
      title: 'Un paso estrecho',
      text: 'El sendero se angosta sobre un barranco. Abajo, el río suena muy lejos.',
      options: [
        { label: 'Cruzar rápido', check: { stat: 'agilidad', dc: 12 },
          ok: { text: 'Cruzás sin mirar abajo. Del otro lado, la vista es increíble.', xp: 0.4 },
          fail: { text: 'Una piedra se suelta bajo tu pie. Te salvás de milagro, pero te raspás entero.', hurt: 0.2 } },
        { label: 'Ir pegado a la pared, despacio',
          ok: { text: 'Tardás el doble, pero llegás entero.', time: 1, xp: 0.2 } },
      ],
    },
    {
      id: 'nido_aguila', biomes: ['mountain'], weight: 1, icon: 'star',
      title: 'Un nido en la cornisa',
      text: 'En una cornisa hay un nido enorme. Entre las ramas brilla algo que alguna vez fue de un viajero.',
      options: [
        { label: 'Trepar hasta el nido', check: { stat: 'agilidad', dc: 13 },
          ok: { text: 'Llegás, agarrás lo que brilla y bajás antes de que vuelva el dueño del nido.', coins: 5, items: [['mat_pluma', 1, 3]] },
          fail: { text: 'El dueño del nido vuelve antes de lo pensado.', fight: { ambush: true } } },
        { label: 'Tirar piedras para voltearlo', check: { stat: 'punteria', dc: 13 },
          ok: { text: 'El nido cae y con él unas monedas viejas.', coins: 4 },
          fail: { text: 'Las piedras rebotan y casi te dan a vos.' } },
      ],
    },

    // ============================================================
    // Desierto
    // ============================================================
    {
      id: 'espejismo', biomes: ['desert'], weight: 3, icon: 'sun',
      title: 'Un oasis en el horizonte',
      text: 'El aire tiembla con el calor. A lo lejos aparece un oasis... o eso parece.',
      options: [
        { label: 'Caminar hacia él', check: { stat: 'ingenio', dc: 12 },
          ok: { text: 'Es real. Agua fresca, dátiles y sombra. Descansás como un rey.', heal: 0.5, food: 5 },
          fail: { text: 'El oasis se aleja con cada paso. Volvés con la boca seca.', hurt: 0.1, food: -3 } },
        { label: 'Seguir la ruta marcada',
          ok: { text: 'No te dejás engañar. Al costado del camino encontrás algo útil.', loot: 1 } },
      ],
    },
    {
      id: 'tormenta_arena', biomes: ['desert'], weight: 2, icon: 'storm',
      title: 'Tormenta de arena',
      text: 'El cielo se pone amarillo y el viento empieza a levantar la arena. Tenés segundos para decidir.',
      options: [
        { label: 'Cubrirte detrás de una roca', check: { stat: 'agilidad', dc: 11 },
          ok: { text: 'Llegás a tiempo. Cuando pasa la tormenta, la arena dejó al descubierto unos huesos con monedas.', coins: 3, items: [['fragmento_hueso_antiguo', 1, 1]] },
          fail: { text: 'La arena te golpea la cara y te desorienta.', hurt: 0.15, time: 1 } },
        { label: 'Seguir caminando con la cara tapada', check: { stat: 'fuerza', dc: 13 },
          ok: { text: 'Avanzás contra el viento sin parar. Salís del otro lado más fuerte.', xp: 0.5 },
          fail: { text: 'El viento te tumba una y otra vez.', hurt: 0.2 } },
      ],
    },

    // ============================================================
    // Ruinas
    // ============================================================
    {
      id: 'mecanismo_antiguo', biomes: ['ruins'], weight: 3, icon: 'gear',
      title: 'Una puerta de piedra',
      text: 'Una puerta de piedra con símbolos tallados. En el centro hay tres discos que se pueden girar.',
      options: [
        { label: 'Girar los discos', check: { stat: 'ingenio', dc: 14 },
          ok: { text: 'Los símbolos encajan y la puerta se abre. Adentro hay una cámara intacta.', coins: 6, items: [['fragmento_runa', 1, 1]], xp: 0.5 },
          fail: { text: 'Un dardo sale de la pared y te roza el brazo.', hurt: 0.2 } },
        { label: 'Buscar otra entrada', check: { stat: 'agilidad', dc: 12 },
          ok: { text: 'Te metés por una grieta en el techo y caés justo al lado del tesoro.', coins: 5 },
          fail: { text: 'La grieta da a un nido de criaturas.', fight: { ambush: true } } },
      ],
    },

    // ============================================================
    // Cuevas
    // ============================================================
    {
      id: 'vidrio_negro', biomes: ['cave', 'volcano'], weight: 3, icon: 'trap',
      title: 'Vidrio negro en las paredes',
      text: 'Las paredes de la cueva tienen vetas de vidrio negro, liso como un espejo. Los herreros lo pagan bien.',
      options: [
        { label: 'Sacarlo con cuidado', check: { stat: 'ingenio', dc: 12 },
          ok: { text: 'Separás los trozos sin quebrarlos.', items: [['obsidiana', 1, 2]] },
          fail: { text: 'El vidrio se parte y te corta la mano.', hurt: 0.15, items: [['obsidiana', 0, 1]] } },
        { label: 'Arrancarlo a golpes', check: { stat: 'fuerza', dc: 12 },
          ok: { text: 'A los golpes sacás un buen trozo entero.', items: [['obsidiana', 1, 1]] },
          fail: { text: 'Las esquirlas vuelan por todos lados.', hurt: 0.2 } },
      ],
    },
    {
      id: 'eco_cueva', biomes: ['cave'], weight: 2, icon: 'eye',
      title: 'Ojos en la oscuridad',
      text: 'Al fondo del túnel brillan dos ojos. Después cuatro. Después seis.',
      options: [
        { label: 'Adelantarte en silencio', check: { stat: 'agilidad', dc: 13 },
          ok: { text: 'Llegás hasta ellos sin que te escuchen.', fight: { surprise: true } },
          fail: { text: 'Tu antorcha te delata.', fight: { ambush: true } } },
        { label: 'Retroceder despacio', check: { stat: 'suerte', dc: 10 },
          ok: { text: 'Los ojos se cierran uno a uno. Salís de ahí sin un rasguño.' },
          fail: { text: 'No te dejan irte tan fácil.', fight: {} } },
      ],
    },

    // ============================================================
    // Mar y abismo
    // ============================================================
    {
      id: 'red_flotante', biomes: ['sea', 'abyss'], weight: 3, icon: 'scroll',
      title: 'Una red a la deriva',
      text: 'Una red de pescadores flota junto al barco. Algo pesado quedó enredado adentro.',
      options: [
        { label: 'Subirla a bordo', check: { stat: 'fuerza', dc: 12 },
          ok: { text: 'Entre peces muertos aparece un cofrecito con monedas y perlas.', coins: 4, items: [['perla_pequeña', 1, 1]] },
          fail: { text: 'La red se engancha y casi te arrastra al agua.', hurt: 0.15 } },
        { label: 'Cortarla con cuidado', check: { stat: 'ingenio', dc: 11 },
          ok: { text: 'Liberás solo lo que sirve.', loot: 2 },
          fail: { text: 'Se te escapa todo al fondo.' } },
      ],
    },
    {
      id: 'canto_sirena', biomes: ['sea', 'abyss', 'coast'], weight: 2, icon: 'arcane',
      title: 'Un canto sobre el agua',
      text: 'Un canto dulce llega desde las olas. Los marineros se tapan los oídos con cera.',
      options: [
        { label: 'Resistir el canto', check: { stat: 'ingenio', dc: 13 },
          ok: { text: 'Te aferrás al mástil hasta que el canto se apaga. Te sentís más fuerte por dentro.', xp: 0.6, mana: 0.5 },
          fail: { text: 'Te asomás demasiado y caés al agua helada.', hurt: 0.2 } },
        { label: 'Taparte los oídos',
          ok: { text: 'Hacés como los marineros y esperás. Uno te convida algo de comer.', food: 2 } },
      ],
    },

    // ============================================================
    // Volcán, infierno y guarida de dragones
    // ============================================================
    {
      id: 'rio_lava', biomes: ['volcano', 'hell'], weight: 3, icon: 'fire',
      title: 'Un río de lava',
      text: 'Un río de roca fundida corta el camino. Hay piedras flotando que podrían servir de puente.',
      options: [
        { label: 'Saltar de piedra en piedra', check: { stat: 'agilidad', dc: 14 },
          ok: { text: 'Cruzás con el calor en la cara. Del otro lado hay gemas que el fuego dejó al descubierto.', items: [['gema_ignea', 1, 1]], xp: 0.5 },
          fail: { text: 'Una piedra se hunde y la lava te salpica las piernas.', hurt: 0.25 } },
        { label: 'Rodear por las rocas altas',
          ok: { text: 'Tardás mucho más, pero llegás. Juntás lava endurecida en el camino.', time: 2, items: [['fragmento_lava', 1, 1]] } },
      ],
    },
    {
      id: 'huevo_dragon', biomes: ['lair', 'volcano'], weight: 2, icon: 'breath',
      title: 'Un huevo tibio',
      text: 'Entre huesos y cenizas descansa un huevo enorme, tibio al tacto. La madre no debe andar lejos.',
      options: [
        { label: 'Llevarte las escamas del nido', check: { stat: 'agilidad', dc: 14 },
          ok: { text: 'Juntás escamas sueltas sin hacer ruido y te alejás.', items: [['mat_escama_dragon', 1, 2]], xp: 0.5 },
          fail: { text: 'Un rugido sacude la caverna.', fight: { ambush: true } } },
        { label: 'Irte antes de que vuelva',
          ok: { text: 'Hay cosas que es mejor no despertar. Te vas con el corazón a mil.', xp: 0.3 } },
      ],
    },
  ];

  /**
   * Frases para las escenas con criaturas: dónde aparecen según el bioma.
   * El texto se arma solo con el nombre del grupo.
   */
  const CREATURE_PLACES = {
    forest: ['entre los árboles', 'junto a un tronco caído', 'en un claro del bosque'],
    graveyard: ['entre las lápidas', 'junto a una cripta abierta', 'detrás de un ángel de piedra'],
    plains: ['al costado del camino', 'entre los pastos altos', 'cerca de un molino abandonado'],
    swamp: ['entre la niebla', 'sobre un tronco podrido', 'en la orilla de un charco negro'],
    mountain: ['en una cornisa', 'detrás de unas rocas', 'en la entrada de una cueva'],
    desert: ['sobre una duna', 'a la sombra de una roca', 'entre unos huesos blanqueados'],
    ruins: ['entre columnas caídas', 'en un patio en ruinas', 'junto a una estatua sin cabeza'],
    crypt: ['al final de un pasillo', 'entre los nichos', 'junto a un sarcófago'],
    cave: ['en el fondo del túnel', 'junto a un lago subterráneo', 'entre estalagmitas'],
    sea: ['sobre la cubierta', 'entre las olas', 'junto al casco del barco'],
    volcano: ['junto a una grieta humeante', 'sobre la roca negra', 'entre columnas de vapor'],
    hell: ['entre llamas negras', 'sobre un puente de huesos', 'en un pozo de azufre'],
    lair: ['sobre un montón de huesos', 'en la boca de la guarida', 'entre escamas viejas'],
    abyss: ['en la oscuridad del fondo', 'entre corales muertos', 'junto a un templo hundido'],
  };

  A.Seed = A.Seed || {};
  A.Seed.events = EVENTS;
  A.Seed.creaturePlaces = CREATURE_PLACES;
})(window.Aventurs);
