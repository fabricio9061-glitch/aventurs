/* ============================================================
   Aventurs — Seed: Eventos de exploración (v2.0)

   Cada vez que explorás una zona de combate pasa ALGO: o aparece una
   criatura (y elegís cómo encararla) o te toca una de estas escenas.

   Modelo de escena:
     id, biomes: ['forest', ...] o ['any'], weight, icon (ícono pixel),
     time: 'night' | 'day' (opcional, v3.1: solo a esa hora),
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

    // ============================================================
    // v2.1: zonas nuevas
    // ============================================================
    {
      id: 'vagoneta', biomes: ['cave'], weight: 2, icon: 'hammer',
      title: 'Una vagoneta abandonada',
      text: 'Sobre los rieles quedó una vagoneta a medio llenar de mineral. Las ruedas están trabadas por el óxido.',
      options: [
        { label: 'Empujarla hasta la salida', check: { stat: 'fuerza', dc: 11 },
          ok: { text: 'La vagoneta cede con un chirrido. Te llevás lo mejor de la carga.', items: [['mineral_hierro', 1, 2], ['fragmento_cuarzo', 0, 1]] },
          fail: { text: 'Se te escapa cuesta abajo y casi te lleva con ella.', hurt: 0.12 } },
        { label: 'Revolver la carga a mano',
          ok: { text: 'Entre piedras sin valor aparece algo que brilla.', items: [['fragmento_cuarzo', 1, 1]], time: 1 } },
      ],
    },
    {
      id: 'campamento_orco', biomes: ['hills'], weight: 3, icon: 'campfire',
      title: 'Un campamento orco',
      text: 'Detrás de una loma humea un campamento orco. Los guerreros duermen la siesta junto a un montón de botín.',
      options: [
        { label: 'Robar sin despertarlos', check: { stat: 'agilidad', dc: 13 },
          ok: { text: 'Te llevás un saco de monedas y nadie abre un ojo.', coins: 5 },
          fail: { text: 'Una olla cae al piso. Todos se despiertan a la vez.', fight: { ambush: true } } },
        { label: 'Atacar mientras duermen', check: { stat: 'fuerza', dc: 11 },
          ok: { text: 'Caés sobre ellos antes de que agarren las armas.', fight: { surprise: true } },
          fail: { text: 'El centinela da la alarma a tiempo.', fight: {} } },
        { label: 'Rodear la loma',
          ok: { text: 'Das un rodeo largo. Desde arriba ves por dónde se mueven.', xp: 0.3, time: 1 } },
      ],
    },
    {
      id: 'nido_arpias', biomes: ['hills', 'mountain'], weight: 2, icon: 'star',
      title: 'Chillidos en las rocas',
      text: 'Un nido de arpías corona una peña. Entre las ramas brillan cosas robadas a los viajeros.',
      options: [
        { label: 'Trepar mientras cazan', check: { stat: 'agilidad', dc: 12 },
          ok: { text: 'Llegás, juntás lo que brilla y bajás antes de que vuelvan.', coins: 4, items: [['mat_pluma', 1, 2]] },
          fail: { text: 'Vuelven antes de lo pensado.', fight: { ambush: true } } },
        { label: 'Bajarlas a pedradas', check: { stat: 'punteria', dc: 12 },
          ok: { text: 'Le das a la que hacía guardia. Las demás huyen chillando.', xp: 0.5 },
          fail: { text: 'Las piedras no llegan y las arpías ya te vieron.', fight: {} } },
      ],
    },
    {
      id: 'cofre_pirata', biomes: ['coast'], weight: 3, icon: 'chest',
      title: 'Una X en la arena',
      text: 'Alguien marcó una X con conchas en la arena, justo donde no llega la marea. Huele a tesoro... o a trampa.',
      options: [
        { label: 'Cavar rápido', check: { stat: 'fuerza', dc: 11 },
          ok: { text: 'A medio metro aparece un cofre con doblones y una botella de ron.', coins: 3, items: [['doblon', 1, 1], ['ron_anejo', 0, 1]] },
          fail: { text: 'Cavás hasta que se te ampollan las manos. Nada.', hurt: 0.08, time: 1 } },
        { label: 'Esperar escondido a ver quién viene', check: { stat: 'ingenio', dc: 12 },
          ok: { text: 'Los piratas que vuelven por el cofre no te ven llegar.', fight: { surprise: true } },
          fail: { text: 'Te encuentran espiando detrás de un bote.', fight: { ambush: true } } },
      ],
    },
    {
      id: 'barril_deriva', biomes: ['coast', 'sea', 'pirate'], weight: 2, icon: 'scroll',
      title: 'Un barril a la deriva',
      text: 'Un barril sellado con brea flota cerca de la orilla. Tiene pintada una calavera.',
      options: [
        { label: 'Abrirlo', check: { stat: 'suerte', dc: 10 },
          ok: { text: 'Ron del bueno, todavía cerrado.', items: [['ron_anejo', 1, 2]] },
          fail: { text: 'Pólvora mojada y un olor horrible. Nada que sirva.' } },
        { label: 'Venderlo entero en el puerto',
          ok: { text: 'Lo arrastrás hasta el muelle y un marinero te lo compra sin abrirlo.', coins: 2, time: 1 } },
      ],
    },
    {
      id: 'claro_hadas', biomes: ['dream'], weight: 3, icon: 'spark',
      title: 'Un claro con luces',
      text: 'Lucecitas bailan en círculo sobre el pasto. Son hadas, y te invitan a entrar en la ronda.',
      options: [
        { label: 'Bailar con ellas', check: { stat: 'agilidad', dc: 13 },
          ok: { text: 'Seguís el paso y las hadas te llenan los bolsillos de polvo brillante.', items: [['polvo_hada', 1, 3]], mana: 0.5 },
          fail: { text: 'Te enredás en tus propios pies. Las hadas se ríen y te roban algo de comida.', food: -3, time: 1 } },
        { label: 'Contarles un acertijo', check: { stat: 'ingenio', dc: 12 },
          ok: { text: 'No lo adivinan y te dan una flor como premio.', items: [['flor_sueno', 1, 1]], xp: 0.5 },
          fail: { text: 'Lo adivinan enseguida y se aburren de vos.' } },
        { label: 'Seguir de largo',
          ok: { text: 'Las luces te siguen un rato y después se apagan.' } },
      ],
    },
    {
      id: 'fuente_suenos', biomes: ['dream', 'grove'], weight: 2, icon: 'potion',
      title: 'Agua que refleja otra cosa',
      text: 'En el agua de una fuente no se ve tu cara: se ve un lugar que no conocés.',
      options: [
        { label: 'Beber un sorbo', check: { stat: 'suerte', dc: 11 },
          ok: { text: 'Soñás despierto un instante y volvés más fuerte.', heal: 0.4, mana: 0.5, xp: 0.4 },
          fail: { text: 'Te dormís sin querer y despertás horas después, con frío.', time: 3, food: -2 } },
        { label: 'Mirar el reflejo con atención', check: { stat: 'ingenio', dc: 12 },
          ok: { text: 'El reflejo te muestra un atajo y algo escondido entre raíces.', loot: 1, xp: 0.3 },
          fail: { text: 'El reflejo se aleja y te mareás.', hurt: 0.08 } },
      ],
    },
    {
      id: 'susurros', biomes: ['darkwood'], weight: 3, icon: 'eye',
      title: 'Voces entre los árboles',
      text: 'Alguien susurra tu nombre detrás de cada tronco. Cuando te das vuelta, el susurro sigue del otro lado.',
      options: [
        { label: 'No hacerles caso', check: { stat: 'ingenio', dc: 13 },
          ok: { text: 'Seguís caminando sin mirar atrás. Los susurros se cansan antes que vos.', xp: 0.6 },
          fail: { text: 'Te metés cada vez más adentro y te perdés.', hurt: 0.12, time: 2 } },
        { label: 'Seguir la voz', check: { stat: 'suerte', dc: 12 },
          ok: { text: 'La voz te lleva hasta los restos de un viajero y su bolsa intacta.', coins: 4, loot: 1 },
          fail: { text: 'La voz era de algo con hambre.', fight: { ambush: true } } },
      ],
    },
    {
      id: 'aullido', biomes: ['darkwood', 'forest'], weight: 2, icon: 'tracks',
      title: 'Un aullido muy cerca',
      text: 'La luna asoma entre las ramas y un aullido largo te eriza la piel. Viene de muy cerca.',
      options: [
        { label: 'Ir a su encuentro', check: { stat: 'agilidad', dc: 12 },
          ok: { text: 'Lo encontrás de espaldas, olfateando.', fight: { surprise: true } },
          fail: { text: 'Te rodean antes de que lo veas.', fight: { ambush: true } } },
        { label: 'Prender fuego y esperar', check: { stat: 'ingenio', dc: 11 },
          ok: { text: 'Las fieras no se acercan al fuego. Pasás la noche entero.', heal: 0.2, time: 2 },
          fail: { text: 'La leña está húmeda. Algo se acerca igual.', fight: {} } },
      ],
    },
    {
      id: 'tumba_rosas', biomes: ['bloodwood', 'gothic'], weight: 3, icon: 'skull',
      title: 'Una tumba cubierta de rosas',
      text: 'Una tumba de mármol negro desaparece bajo rosas rojas. El nombre está borrado, pero la tierra está fresca.',
      options: [
        { label: 'Cortar algunas rosas', check: { stat: 'agilidad', dc: 12 },
          ok: { text: 'Las espinas no te tocan. Te llevás las mejores flores.', items: [['rosa_carmesi', 1, 2]] },
          fail: { text: 'Las espinas te cortan las manos y algo se mueve bajo la tierra.', hurt: 0.1, fight: { ambush: true } } },
        { label: 'Leer lo que queda del epitafio', check: { stat: 'ingenio', dc: 13 },
          ok: { text: 'Era la tumba de un noble de Velmora. Debajo de la lápida escondieron su bolsa.', coins: 6, xp: 0.4 },
          fail: { text: 'Las letras no dicen nada que entiendas.' } },
      ],
    },
    {
      id: 'carruaje_negro', biomes: ['bloodwood'], weight: 2, icon: 'gear',
      title: 'Un carruaje negro',
      text: 'Un carruaje negro tirado por caballos sin ojos se detiene a tu lado. La ventanilla baja apenas.',
      options: [
        { label: 'Saludar con cortesía', check: { stat: 'ingenio', dc: 12 },
          ok: { text: 'Una mano enguantada te tira una bolsa de monedas "por los buenos modales".', coins: 6 },
          fail: { text: 'Del carruaje baja alguien con hambre.', fight: {} } },
        { label: 'Esconderte en los rosales', check: { stat: 'agilidad', dc: 11 },
          ok: { text: 'El carruaje sigue de largo. Respirás otra vez.', xp: 0.3 },
          fail: { text: 'Los rosales te delatan con un crujido.', hurt: 0.1 } },
      ],
    },
    {
      id: 'huesos_gigantes', biomes: ['meadow'], weight: 3, icon: 'skulls',
      title: 'Un esqueleto gigante',
      text: 'Las costillas de un gigante forman un arco en medio de la pradera. Entre los huesos quedó algo de su ajuar.',
      options: [
        { label: 'Mover los huesos', check: { stat: 'fuerza', dc: 13 },
          ok: { text: 'Corrés una costilla enorme y encontrás un brazalete de oro.', coins: 6, items: [['fragmento_hueso_antiguo', 1, 1]] },
          fail: { text: 'Un hueso se desmorona y te cae encima.', hurt: 0.15 } },
        { label: 'Revisar sin tocar nada', check: { stat: 'ingenio', dc: 11 },
          ok: { text: 'Encontrás monedas viejas entre la tierra.', items: [['moneda_antigua', 1, 2]] },
          fail: { text: 'Solo huesos y más huesos.' } },
      ],
    },
    {
      id: 'rebano_ciclope', biomes: ['meadow'], weight: 2, icon: 'eye',
      title: 'El rebaño del cíclope',
      text: 'Un cíclope pastorea un rebaño de ovejas del tamaño de vacas. Por ahora, mira para otro lado.',
      options: [
        { label: 'Llevarte un poco de lana y leche', check: { stat: 'agilidad', dc: 14 },
          ok: { text: 'Te llevás comida para varios días sin que el gigante se dé cuenta.', food: 8, heal: 0.15 },
          fail: { text: 'Una oveja bala. El ojo gigante se clava en vos.', fight: { ambush: true } } },
        { label: 'Atacarlo por la espalda', check: { stat: 'fuerza', dc: 13 },
          ok: { text: 'Le das antes de que se dé vuelta.', fight: { surprise: true } },
          fail: { text: 'El cíclope se gira más rápido de lo que pensabas.', fight: {} } },
        { label: 'Alejarte despacio',
          ok: { text: 'Lo dejás pastorear en paz.', xp: 0.2 } },
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
    // v2.1
    coast: ['entre los restos de un barco', 'sobre las rocas de la orilla', 'detrás de un bote dado vuelta'],
    hills: ['en la cima de una loma', 'entre rocas partidas', 'junto a un campamento abandonado'],
    meadow: ['entre los pastos altos', 'a la sombra de un hueso gigante', 'junto a un arroyo'],
    darkwood: ['entre troncos negros', 'bajo un árbol que parece mirarte', 'en un claro sin luz'],
    dream: ['entre flores que brillan', 'junto a un árbol de hojas violetas', 'en un claro lleno de luces'],
    bloodwood: ['entre rosales rojos', 'junto a una tumba de mármol', 'bajo un sauce sin hojas'],
  };

  // ============================================================
  // v3.1: más escenas (algunas solo de noche o solo de día: time)
  // ============================================================
  const MORE = [
    // ---------- Cualquier zona ----------
    {
      id: 'fuego_fatuo', biomes: ['any'], time: 'night', weight: 2, icon: 'spark',
      title: 'Luces en la oscuridad',
      text: 'Tres lucecitas azules flotan a la altura de tus ojos y se alejan despacio, como invitándote a seguirlas.',
      options: [
        { label: 'Seguirlas', check: { stat: 'suerte', dc: 12 },
          ok: { text: 'Las luces se apagan sobre una piedra hueca. Adentro alguien guardó un pequeño tesoro.', coins: 4, loot: 1 },
          fail: { text: 'Te llevan en círculos hasta que se apagan. Tardás un buen rato en volver a encontrar el camino, y te raspás contra las ramas.', time: 2, hurt: 0.08 } },
        { label: 'Anotar cómo se mueven', check: { stat: 'ingenio', dc: 11 },
          ok: { text: 'No son espíritus: es gas del suelo que se enciende. Aprendiste algo que pocos saben.', xp: 0.6 },
          fail: { text: 'Por más que mirás, no le encontrás sentido. Mejor dormir.', time: 1 } },
        { label: 'Darles la espalda', ok: { text: 'Cerrás los ojos y esperás a que se vayan. Cuando los abrís, ya no están.' } },
      ],
    },
    {
      id: 'estrella_fugaz', biomes: ['any'], time: 'night', weight: 2, icon: 'stars',
      title: 'Una estrella fugaz',
      text: 'Una estrella cruza el cielo de punta a punta y deja una estela dorada que tarda en apagarse.',
      options: [
        { label: 'Pedir un deseo', check: { stat: 'suerte', dc: 10 },
          ok: { text: 'Sentís un calor raro en el pecho. Las heridas te molestan menos y la cabeza se te despeja.', heal: 0.25, mana: 0.25 },
          fail: { text: 'No pasa nada. Pero el cielo estaba lindo.' } },
        { label: 'Fijarte dónde cayó', check: { stat: 'punteria', dc: 13 },
          ok: { text: 'Calculás bien: entre unas piedras chamuscadas encontrás un trozo de metal tibio que brilla.', items: [['mat_gema_arcana', 1, 1]], xp: 0.3 },
          fail: { text: 'Buscás un rato largo y no encontrás nada. Se te hizo tarde.', time: 1 } },
      ],
    },
    {
      id: 'campamento_abandonado', biomes: ['any'], weight: 3, icon: 'campfire',
      title: 'Un campamento abandonado',
      text: 'Una fogata todavía tibia, una manta tirada y una olla con restos de guiso. Quien estaba acá se fue con mucho apuro.',
      options: [
        { label: 'Revisar las cosas', check: { stat: 'ingenio', dc: 11 },
          ok: { text: 'Debajo de la manta hay una bolsita con monedas y algo más que dejaron olvidado.', coins: 3, loot: 1 },
          fail: { text: 'Revolvés todo y solo encontrás trapos. Lo que sea que asustó a los dueños podría volver.', time: 1 } },
        { label: 'Comerte el guiso', check: { stat: 'suerte', dc: 9 },
          ok: { text: 'Está frío pero rico. Te llena la panza para un buen rato.', food: 3 },
          fail: { text: 'Tenía algo raro. Te pasás un rato con el estómago revuelto.', hurt: 0.08, food: 1 } },
        { label: 'Irte antes de que vuelvan', ok: { text: 'No te quedás a averiguar por qué huyeron. Seguís tu camino.' } },
      ],
    },
    {
      id: 'mercader_ambulante', biomes: ['plains', 'hills', 'meadow', 'forest', 'coast'], time: 'day', weight: 2, icon: 'shop',
      title: 'Un mercader ambulante',
      text: 'Un viejo con una mula cargada de bolsas te saluda con la mano. "¡Pociones, cuerdas, buena suerte! ¿Qué te llevás?"',
      options: [
        { label: 'Comprarle una poción', needs: { coins: 5 },
          ok: { text: 'Te da una poción y te guiña un ojo: "Es de las buenas, no como las del pueblo."', coins: -5, items: [['pocion_curacion', 1, 1]] } },
        { label: 'Regatear', check: { stat: 'ingenio', dc: 12 },
          ok: { text: 'Lo convencés de que te debe un favor. Se ríe, te da una poción menor y te dice que nunca lo vio nadie regatear así.', items: [['pocion_curacion_menor', 1, 1]], xp: 0.2 },
          fail: { text: 'Se ofende y sigue de largo con su mula, refunfuñando.' } },
        { label: 'Saludarlo y seguir', ok: { text: 'Le deseás buen viaje. Te devuelve el saludo y una frase sobre el clima que no entendés.' } },
      ],
    },
    {
      id: 'restos_de_batalla', biomes: ['plains', 'hills', 'meadow', 'ruins', 'desert'], weight: 2, icon: 'swords',
      title: 'Restos de una batalla',
      text: 'Escudos partidos, flechas clavadas en la tierra y huesos que ya nadie va a reclamar. Acá pelearon dos ejércitos hace mucho.',
      options: [
        { label: 'Buscar algo que sirva', check: { stat: 'ingenio', dc: 12 },
          ok: { text: 'Entre el óxido aparece algo que todavía se puede usar.', loot: 2, coins: 2 },
          fail: { text: 'Todo está podrido o roto. Te cortás la mano con una punta de flecha.', hurt: 0.06 } },
        { label: 'Enterrar a los caídos', ok: { text: 'Cavás un rato largo. Cuando terminás, el lugar se siente más tranquilo, y vos también.', time: 2, heal: 0.15, xp: 0.4 } },
        { label: 'Seguir de largo', ok: { text: 'Hay lugares que es mejor no molestar.' } },
      ],
    },
    // ---------- Bosques ----------
    {
      id: 'aullidos', biomes: ['forest', 'darkwood', 'plains'], time: 'night', weight: 2, icon: 'paw',
      title: 'Aullidos en la noche',
      text: 'Un aullido largo, después otro, más cerca. Una manada se está juntando y huele que andás cerca.',
      options: [
        { label: 'Esconderte entre las raíces', check: { stat: 'agilidad', dc: 12 },
          ok: { text: 'Pasan a pocos metros sin verte. Esperás hasta que el último aullido se pierde a lo lejos.', xp: 0.3 },
          fail: { text: 'Una rama se quiebra bajo tu peso. Los ojos brillan entre los árboles.', fight: { ambush: true } } },
        { label: 'Prepararles una emboscada', check: { stat: 'fuerza', dc: 12 },
          ok: { text: 'Los esperás con el arma lista en un paso angosto. Cuando aparecen, el primero ni te ve venir.', fight: { surprise: true } },
          fail: { text: 'Te ven antes de tiempo y se separan para rodearte.', fight: {} } },
        { label: 'Hacer una fogata grande', needs: { food: 1 },
          ok: { text: 'Quemás lo que tenés a mano y tirás un poco de comida lejos del fuego. Los aullidos se alejan.', food: -1 } },
      ],
    },
    {
      id: 'colmena', biomes: ['forest', 'meadow', 'grove'], time: 'day', weight: 2, icon: 'food',
      title: 'Una colmena en un tronco',
      text: 'Un zumbido grave sale de un tronco hueco. Por las grietas chorrea miel dorada.',
      options: [
        { label: 'Sacar la miel rápido', check: { stat: 'agilidad', dc: 12 },
          ok: { text: 'Metés la mano, sacás un panal entero y te alejás antes de que te sigan.', items: [['miel', 1, 2]] },
          fail: { text: 'Las abejas te persiguen un buen trecho. Terminás lleno de picaduras.', hurt: 0.12, items: [['miel', 1, 1]] } },
        { label: 'Echarles humo', check: { stat: 'ingenio', dc: 10 },
          ok: { text: 'Con unas hojas húmedas hacés humo y las abejas se calman. Sacás miel sin un solo pinchazo.', items: [['miel', 2, 2]], xp: 0.2 },
          fail: { text: 'El humo se te va a la cara y las abejas se enojan igual. Te vas tosiendo.', hurt: 0.05 } },
        { label: 'Dejarlas tranquilas', ok: { text: 'Las abejas no te hicieron nada. Seguís de largo.' } },
      ],
    },
    {
      id: 'trampa_cazador', biomes: ['forest', 'darkwood', 'plains', 'hills'], weight: 2, icon: 'trap',
      title: 'Una trampa de cazador',
      text: 'Un cervatillo tiene la pata atrapada en un cepo de hierro. Te mira con ojos enormes y no se mueve.',
      options: [
        { label: 'Abrir el cepo', check: { stat: 'fuerza', dc: 11 },
          ok: { text: 'Hacés palanca con el arma y el cepo se abre. El cervatillo se va saltando entre los árboles. Te sentís bien.', xp: 0.6, heal: 0.1 },
          fail: { text: 'El cepo se cierra de golpe y te agarra los dedos. Al final lo abrís, pero te duele.', hurt: 0.08, xp: 0.3 } },
        { label: 'Desarmar la trampa y quedarte el hierro', check: { stat: 'ingenio', dc: 12 },
          ok: { text: 'Liberás al animal y desarmás el cepo con cuidado. El hierro sirve.', items: [['mineral_hierro', 1, 1]], xp: 0.3 },
          fail: { text: 'No le encontrás la vuelta. Lo liberás a lo bruto y el cepo queda inservible.', xp: 0.2 } },
        { label: 'No meterte', ok: { text: 'No es tu trampa ni tu presa. Seguís camino tratando de no mirar atrás.' } },
      ],
    },
    {
      id: 'rio_crecido', biomes: ['forest', 'plains', 'swamp', 'meadow'], weight: 2, icon: 'search',
      title: 'Un río crecido',
      text: 'La lluvia de anoche convirtió el arroyo en un río marrón que arrastra ramas. Tu camino sigue del otro lado.',
      options: [
        { label: 'Cruzarlo nadando', check: { stat: 'fuerza', dc: 12 },
          ok: { text: 'La corriente tira fuerte, pero llegás a la otra orilla empapado y orgulloso.', xp: 0.3 },
          fail: { text: 'El agua te arrastra varios metros. Salís golpeado y se te mojó parte de la comida.', hurt: 0.1, food: -1 } },
        { label: 'Buscar un vado', check: { stat: 'ingenio', dc: 10 },
          ok: { text: 'Más arriba el río se abre y se cruza con el agua por la rodilla.', time: 1 },
          fail: { text: 'Caminás río arriba un buen rato antes de encontrar por dónde pasar.', time: 2 } },
      ],
    },
    // ---------- Cementerios, criptas y ruinas ----------
    {
      id: 'tumba_que_brilla', biomes: ['graveyard', 'crypt'], time: 'night', weight: 2, icon: 'skull',
      title: 'Una tumba que brilla',
      text: 'Entre las lápidas, una sola tumba despide una luz verdosa por las rendijas de la piedra.',
      options: [
        { label: 'Correr la lápida', check: { stat: 'fuerza', dc: 13 },
          ok: { text: 'Adentro hay un cofrecito con una reliquia que todavía brilla un poco.', items: [['reliquia_olvidada', 1, 1]], coins: 2 },
          fail: { text: 'La piedra se mueve y algo, desde adentro, empuja hacia afuera.', fight: { ambush: true } } },
        { label: 'Rezar por el muerto', check: { stat: 'suerte', dc: 10 },
          ok: { text: 'La luz se apaga despacio, como si alguien por fin pudiera descansar. Te sentís más liviano.', heal: 0.2, xp: 0.3 },
          fail: { text: 'La luz sigue ahí, indiferente. Te da un escalofrío y te vas.' } },
        { label: 'No tocar nada', ok: { text: 'Hay cosas que no se tocan. Te alejás sin darle la espalda.' } },
      ],
    },
    {
      id: 'fantasma_triste', biomes: ['graveyard', 'crypt', 'ruins'], time: 'night', weight: 2, icon: 'eye',
      title: 'Un fantasma que llora',
      text: 'Una figura transparente llora sentada en una escalera. "Perdí mi anillo... no puedo irme sin él."',
      options: [
        { label: 'Ayudarlo a buscar', check: { stat: 'ingenio', dc: 12 },
          ok: { text: 'Lo encontrás entre dos piedras. El fantasma sonríe, te deja unas monedas viejas y se desvanece en paz.', coins: 3, items: [['moneda_antigua', 1, 1]], xp: 0.5 },
          fail: { text: 'Buscás por todos lados sin suerte. El fantasma suspira y se esfuma. Te queda un frío en los huesos.', time: 1, hurt: 0.05 } },
        { label: 'Decirle que se vaya', check: { stat: 'fuerza', dc: 11 },
          ok: { text: 'Le hablás firme y el fantasma se va, ofendido pero tranquilo.', xp: 0.2 },
          fail: { text: 'El llanto se vuelve un grito. El fantasma se te viene encima.', fight: {} } },
      ],
    },
    {
      id: 'altar_antiguo', biomes: ['ruins', 'desert', 'crypt'], weight: 2, icon: 'arcane',
      title: 'Un altar antiguo',
      text: 'Sobre un altar cubierto de polvo hay un cuenco de piedra y unas runas que todavía brillan apenas.',
      options: [
        { label: 'Dejar una ofrenda', needs: { coins: 4 },
          ok: { text: 'Las monedas desaparecen apenas tocan el cuenco. Una calidez te recorre el cuerpo.', coins: -4, heal: 0.3, mana: 0.4 } },
        { label: 'Leer las runas', check: { stat: 'ingenio', dc: 13 },
          ok: { text: 'Es una oración a un dios que ya nadie recuerda. Aprenderla te deja algo de su sabiduría.', xp: 0.8 },
          fail: { text: 'Las runas se mueven cuando las mirás. Te duele la cabeza.', hurt: 0.06 } },
        { label: 'Romper el cuenco', check: { stat: 'fuerza', dc: 12 },
          ok: { text: 'El cuenco se parte y deja caer lo que alguien escondió adentro.', loot: 2, coins: 3 },
          fail: { text: 'El altar se sacude y algo se despierta para defenderlo.', fight: { ambush: true } } },
      ],
    },
    // ---------- Montañas, colinas y cuevas ----------
    {
      id: 'puente_colgante', biomes: ['mountain', 'hills', 'cave'], weight: 2, icon: 'compass',
      title: 'Un puente colgante',
      text: 'Un puente de sogas y tablas podridas cruza un precipicio. Del otro lado se ve el camino; abajo, nada.',
      options: [
        { label: 'Cruzarlo con cuidado', check: { stat: 'agilidad', dc: 12 },
          ok: { text: 'Tabla por tabla, sin mirar abajo. Llegás del otro lado con las rodillas temblando.', xp: 0.4 },
          fail: { text: 'Una tabla se rompe y quedás colgando de la soga. Subís con las manos peladas.', hurt: 0.12 } },
        { label: 'Dar la vuelta larga', ok: { text: 'Bordeás el precipicio por un sendero de cabras. Tarda mucho, pero llegás entero.', time: 2 } },
      ],
    },
    {
      id: 'nido_alto', biomes: ['mountain', 'hills', 'forest'], time: 'day', weight: 2, icon: 'feather',
      title: 'Un nido en lo alto',
      text: 'En una saliente de roca hay un nido enorme. Plumas brillantes asoman por los bordes y no se ve a la madre.',
      options: [
        { label: 'Trepar hasta el nido', check: { stat: 'agilidad', dc: 13 },
          ok: { text: 'Subís, juntás plumas de las buenas y bajás antes de que vuelva la madre.', items: [['mat_pluma', 2, 3]], xp: 0.3 },
          fail: { text: 'A mitad de camino aparece la madre, chillando. Bajás más rápido de lo que subiste.', hurt: 0.1 } },
        { label: 'Bajar plumas a piedrazos', check: { stat: 'punteria', dc: 12 },
          ok: { text: 'Con un par de tiros justos caen unas plumas sin romper los huevos.', items: [['mat_pluma', 1, 2]] },
          fail: { text: 'Fallás todos los tiros y una piedra rebota y te pega en el hombro.', hurt: 0.05 } },
        { label: 'Dejarlo en paz', ok: { text: 'Mejor no enojar a algo que hace nidos de ese tamaño.' } },
      ],
    },
    {
      id: 'cristales_cueva', biomes: ['cave', 'mountain'], weight: 2, icon: 'arcane',
      title: 'Cristales que brillan',
      text: 'Una pared de la cueva está cubierta de cristales que laten con una luz azulada, como si respiraran.',
      options: [
        { label: 'Picar unos cristales', check: { stat: 'fuerza', dc: 12 },
          ok: { text: 'Con cuidado sacás unos trozos limpios. Algunos todavía tibios de magia.', items: [['fragmento_cuarzo', 1, 2], ['cristal_mana', 1, 1]] },
          fail: { text: 'Un cristal estalla y te llena la cara de astillas brillantes.', hurt: 0.1, items: [['fragmento_cuarzo', 1, 1]] } },
        { label: 'Absorber su luz', check: { stat: 'ingenio', dc: 11 },
          ok: { text: 'Apoyás las manos y dejás que la luz te recorra. El maná te llena hasta los dedos.', mana: 0.6, xp: 0.2 },
          fail: { text: 'La luz te marea. Te sentás un rato hasta que se te pasa.', time: 1 } },
      ],
    },
    {
      id: 'eco_cueva', biomes: ['cave'], weight: 2, icon: 'talk',
      title: 'Voces en el eco',
      text: 'Desde el fondo del túnel llegan voces que repiten tu nombre. Es tu voz, pero vos no dijiste nada.',
      options: [
        { label: 'Seguir las voces', check: { stat: 'suerte', dc: 12 },
          ok: { text: 'Las voces te llevan a una grieta donde alguien escondió sus ahorros hace mucho.', coins: 5 },
          fail: { text: 'Las voces se callan de golpe. Algo grande respira en la oscuridad.', fight: { ambush: true } } },
        { label: 'Gritar más fuerte', check: { stat: 'fuerza', dc: 11 },
          ok: { text: 'Tu grito retumba por toda la cueva y las voces se callan. Lo que sea, se asustó.', xp: 0.3 },
          fail: { text: 'Tu grito despierta a algo que no tenía ganas de que lo despierten.', fight: {} } },
        { label: 'Volver por donde viniste', ok: { text: 'No hace falta saber todo. Volvés sobre tus pasos.', time: 1 } },
      ],
    },
    // ---------- Desiertos y pantanos ----------
    {
      id: 'espejismo', biomes: ['desert'], time: 'day', weight: 2, icon: 'sun',
      title: 'Un oasis en el horizonte',
      text: 'A lo lejos se ven palmeras y agua que brilla. Con este calor, parece demasiado bueno para ser cierto.',
      options: [
        { label: 'Ir hacia el oasis', check: { stat: 'suerte', dc: 13 },
          ok: { text: '¡Es de verdad! Tomás agua fresca, llenás la cantimplora y descansás a la sombra.', heal: 0.3, food: 2 },
          fail: { text: 'Era un espejismo. Caminaste horas bajo el sol para nada.', time: 2, hurt: 0.1 } },
        { label: 'Mirar con atención', check: { stat: 'ingenio', dc: 11 },
          ok: { text: 'Te das cuenta de que la luz miente y seguís tu camino. Aprendés a leer el desierto.', xp: 0.4 },
          fail: { text: 'No te decidís y perdés un rato mirando.', time: 1 } },
      ],
    },
    {
      id: 'arenas_movedizas', biomes: ['desert', 'swamp'], weight: 2, icon: 'trap',
      title: 'El suelo te traga',
      text: 'De golpe el suelo cede bajo tus botas y te hundís hasta las rodillas. Cuanto más te movés, más te traga.',
      options: [
        { label: 'Salir a la fuerza', check: { stat: 'fuerza', dc: 12 },
          ok: { text: 'Te agarrás de una raíz y tirás con todo. Salís embarrado pero libre.', xp: 0.3 },
          fail: { text: 'Te cansás tirando y te hundís más. Cuando por fin salís, estás agotado.', hurt: 0.12, food: -1 } },
        { label: 'Quedarte quieto y flotar', check: { stat: 'ingenio', dc: 11 },
          ok: { text: 'Te tirás para atrás, abrís los brazos y dejás de hundirte. Salís rodando, despacito.', xp: 0.4 },
          fail: { text: 'Te da miedo y te movés de más. Tardás muchísimo en salir.', time: 2, hurt: 0.06 } },
      ],
    },
    {
      id: 'luz_pantano', biomes: ['swamp'], time: 'night', weight: 2, icon: 'spark',
      title: 'Un farol en el pantano',
      text: 'Alguien camina con un farol sobre el agua, sin hundirse. Te hace señas para que lo sigas.',
      options: [
        { label: 'Seguirlo', check: { stat: 'suerte', dc: 13 },
          ok: { text: 'El farol se apaga sobre una isla seca. Hay un bote hundido con la carga intacta.', loot: 2, coins: 3 },
          fail: { text: 'El farol se apaga y quedás con el agua hasta la cintura. Algo se mueve abajo.', fight: { ambush: true } } },
        { label: 'Quedarte en la orilla', ok: { text: 'Lo mirás alejarse hasta que la niebla se lo traga. Mejor así.' } },
      ],
    },
    // ---------- Costas y mares ----------
    {
      id: 'barril_flotando', biomes: ['coast', 'sea', 'pirate'], weight: 2, icon: 'chest',
      title: 'Un barril que flota',
      text: 'Un barril sellado con brea se acerca con las olas. Tiene una calavera pintada a medio borrar.',
      options: [
        { label: 'Engancharlo con una soga', check: { stat: 'punteria', dc: 11 },
          ok: { text: 'Al primer intento lo traés a la orilla. Adentro hay ron del bueno.', items: [['ron_anejo', 1, 2]], xp: 0.2 },
          fail: { text: 'La soga se enreda y el barril se aleja con la corriente.' } },
        { label: 'Meterte al agua a buscarlo', check: { stat: 'fuerza', dc: 12 },
          ok: { text: 'Nadás hasta el barril y lo empujás a la orilla. Además del ron, hay unas monedas.', items: [['ron_anejo', 1, 1]], coins: 3 },
          fail: { text: 'Una ola te revuelca contra las piedras. Salís sin barril y golpeado.', hurt: 0.1 } },
      ],
    },
    {
      id: 'canto_en_el_agua', biomes: ['sea', 'coast', 'abyss'], time: 'night', weight: 2, icon: 'talk',
      title: 'Un canto sobre el agua',
      text: 'Una voz hermosa canta desde las rocas. Sin darte cuenta, ya diste dos pasos hacia el agua.',
      options: [
        { label: 'Taparte los oídos', check: { stat: 'ingenio', dc: 12 },
          ok: { text: 'Con cera de una vela te tapás los oídos. La voz se vuelve un susurro y se apaga.', xp: 0.4 },
          fail: { text: 'Llegás hasta el agua antes de reaccionar. Una mano fría te agarra del tobillo.', fight: { ambush: true } } },
        { label: 'Cantarle de vuelta', check: { stat: 'suerte', dc: 13 },
          ok: { text: 'La voz se ríe, encantada. Una perla aparece sobre la roca más cercana.', items: [['perla_pequeña', 1, 2]], xp: 0.3 },
          fail: { text: 'La voz se calla, ofendida. No vuelve a cantar.' } },
      ],
    },
    // ---------- Lugares mágicos ----------
    {
      id: 'claro_de_luna', biomes: ['dream', 'grove', 'darkwood'], time: 'night', weight: 2, icon: 'moon',
      title: 'Un claro bajo la luna',
      text: 'En un claro bañado de luz plateada, unas hadas bailan en ronda y se ríen. Una te hace lugar.',
      options: [
        { label: 'Bailar con ellas', check: { stat: 'suerte', dc: 11 },
          ok: { text: 'Bailás hasta que la luna se esconde. Te despertás descansado y con polvo brillante en los bolsillos.', heal: 0.3, mana: 0.3, items: [['polvo_hada', 1, 2]] },
          fail: { text: 'Bailás tanto que perdés la noción del tiempo. Te despertás con hambre y lejos de donde estabas.', time: 3, food: -2 } },
        { label: 'Mirar desde lejos', check: { stat: 'ingenio', dc: 10 },
          ok: { text: 'Aprendés los pasos de su ronda: es un hechizo antiguo para que las flores crezcan.', xp: 0.5 },
          fail: { text: 'Te ven espiando y te tiran flores en la cara. Se ríen y desaparecen.' } },
      ],
    },
    {
      id: 'manantial', biomes: ['forest', 'meadow', 'dream', 'grove', 'hills'], weight: 2, icon: 'heal',
      title: 'Un manantial',
      text: 'Agua clara brota entre unas piedras cubiertas de musgo. Huele a menta y está fría como la nieve.',
      options: [
        { label: 'Tomar un buen trago', ok: { text: 'El agua te recorre el cuerpo y te saca el cansancio.', heal: 0.15, mana: 0.15 } },
        { label: 'Buscar hierbas en la orilla', check: { stat: 'ingenio', dc: 11 },
          ok: { text: 'Alrededor del agua crecen plantas que sirven.', loot: 2 },
          fail: { text: 'Solo encontrás pasto común.', time: 1 } },
      ],
    },
    // ---------- Fuego y sangre ----------
    {
      id: 'campo_de_lava', biomes: ['volcano', 'hell', 'lair'], weight: 2, icon: 'fire',
      title: 'Un río de lava',
      text: 'Un río de lava corta el camino. Hay piedras negras que sobresalen, como escalones, hasta el otro lado.',
      options: [
        { label: 'Saltar de piedra en piedra', check: { stat: 'agilidad', dc: 13 },
          ok: { text: 'Saltás sin pensar y llegás del otro lado. En la última piedra brilla una gema.', items: [['gema_ignea', 1, 1]], xp: 0.4 },
          fail: { text: 'Una piedra se hunde y te quemás las botas y las piernas.', hurt: 0.15 } },
        { label: 'Rodear el río', ok: { text: 'Caminás por la orilla hasta que la lava se mete bajo tierra.', time: 2 } },
      ],
    },
    {
      id: 'rosales_de_sangre', biomes: ['bloodwood', 'gothic'], weight: 2, icon: 'heart',
      title: 'Rosales de espinas largas',
      text: 'Un rosal enorme cubre una tumba. Sus flores son de un rojo tan oscuro que parecen negras.',
      options: [
        { label: 'Cortar unas flores', check: { stat: 'agilidad', dc: 12 },
          ok: { text: 'Esquivás las espinas y cortás flores perfectas.', items: [['rosa_carmesi', 1, 2]] },
          fail: { text: 'Las espinas te abren la mano. Las flores se vuelven más rojas con tu sangre.', hurt: 0.1, items: [['rosa_carmesi', 1, 1]] } },
        { label: 'Leer la tumba', check: { stat: 'ingenio', dc: 11 },
          ok: { text: 'La tumba cuenta la historia de una condesa que nunca murió del todo. Te guardás el nombre.', xp: 0.5 },
          fail: { text: 'El mármol está gastado. No se lee nada.' } },
      ],
    },
  ];

  A.Seed = A.Seed || {};
  A.Seed.events = EVENTS.concat(MORE.filter((m) => !EVENTS.some((e) => e.id === m.id)));
  A.Seed.creaturePlaces = CREATURE_PLACES;
})(window.Aventurs);
