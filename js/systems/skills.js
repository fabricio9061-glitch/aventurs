/* ============================================================
   Aventurs — Habilidades de las criaturas (v2.5)

   Cada criatura tiene "skills": ids de esta biblioteca (ver js/data/seed-skills.js).
     - Pasivas: actúan solas (Manada, Caparazón, Regeneración, Etéreo...).
     - Activas: en su turno la criatura a veces las usa en vez de atacar normal
       (Mordida feroz, Telaraña, Aliento de fuego...). Cada una tiene un tiempo
       de espera (cd, en turnos de la criatura) o se usa una sola vez por pelea.

   Tirada para resistir (las que lo piden):
       D20 + tu modificador (fuerza, agilidad o ingenio, como al explorar)
       contra 10 + la mitad del tier (+2 si es jefe, +1 si es élite).
       El 20 siempre resiste y el 1 nunca.

   Las mascotas usan las activas de su especie a tu favor (sin tirada: 50%).

   Lo que pasa adentro del combate (tiradas, daño, registro) lo hace
   A.Combat.kit; acá se decide qué hacer y cómo se cuenta.
   ============================================================ */

(function (A) {
  'use strict';

  const kit = () => (A.Combat && A.Combat.kit) || null;
  const pick = (arr) => (Array.isArray(arr) ? arr[Math.floor(Math.random() * arr.length)] : arr);
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  // Probabilidad de usar una activa en su turno (si tiene alguna lista)
  const USE_CHANCE = { normal: 0.38, boss: 0.45, elite: 0.5, opener: 0.5, pet: 0.3 };

  const STAT_NAME = { fuerza: 'fuerza', agilidad: 'agilidad', ingenio: 'ingenio', suerte: 'suerte' };

  // ============================================================
  // Biblioteca
  // ============================================================
  // Campos de las activas:
  //   act: strike (un golpe con extras) · multi (varios golpes) · sweep (vos y tu mascota)
  //        breath (aliento: a todos, se resiste con agilidad) · quake (temblor: te tira al suelo)
  //        bolt (hechizo) · debuff (sin daño: te deja un estado) · heal · guard · rally · summon
  //   cd: turnos de espera · once: una vez por pelea · max: usos por pelea · first: la usa de entrada
  //   atk: + a su precisión · mult: × daño · pierce: ignora tu armadura
  //   onHit: { type, chance, turns, save } estado que deja si pega (save = se resiste)
  //   hit/miss/use/fail/resist: frases ({E}/{e} la criatura, {d} daño, {n} cantidad)
  const LIB = {
    // ---------------- Pasivas ----------------
    manada: { kind: 'passive', name: 'Manada', icon: 'paw', text: '+1 de precisión por cada compañero de su especie que siga en pie (hasta +2).' },
    caparazon: { kind: 'passive', name: 'Caparazón', icon: 'shield', text: 'El primer golpe de arma que recibe le hace la mitad de daño.', soft: true },
    gelatinoso: { kind: 'passive', name: 'Gelatinoso', icon: 'poison', text: 'El primer golpe de arma se hunde en su cuerpo y le hace la mitad de daño.', soft: true },
    escurridizo: { kind: 'passive', name: 'Escurridizo', icon: 'feather', text: 'Esquiva sí o sí el primer golpe de arma que le iba a acertar (un crítico no).' },
    vuelo: { kind: 'passive', name: 'Vuela', icon: 'feather', text: '+1 de defensa: cuesta más pegarle.' },
    furia: { kind: 'passive', name: 'Furia', icon: 'fist', text: 'Con la mitad de la vida o menos, pega un 25% más fuerte.' },
    regeneracion: { kind: 'passive', name: 'Regeneración', icon: 'heart', text: 'Recupera vida al empezar cada turno (hasta un cuarto de su vida por pelea), salvo que esté en llamas.' },
    no_muerto: { kind: 'passive', name: 'No muerto', icon: 'skull', text: 'No sangra, no se envenena y no siente miedo.', immune: ['bleed', 'poison', 'fear'] },
    constructo: { kind: 'passive', name: 'Constructo', icon: 'gear', text: 'No sangra, no se envenena, no se asusta y no se encandila.', immune: ['bleed', 'poison', 'fear', 'blind'] },
    esencia: { kind: 'passive', name: 'Ser elemental', icon: 'spark', text: 'No sangra ni se envenena.', immune: ['bleed', 'poison'] },
    etereo: { kind: 'passive', name: 'Etéreo', icon: 'eye', text: '1 de cada 4 golpes de arma lo atraviesa sin hacerle nada. No sangra, no cae al suelo y no se lo puede agarrar. La magia lo daña normal.', immune: ['bleed', 'prone', 'grab'] },
    sed_sangre: { kind: 'passive', name: 'Sed de sangre', icon: 'bleed', text: 'Recupera un cuarto del daño que hace con sus golpes.' },
    cuerpo_fuego: { kind: 'passive', name: 'Cuerpo de fuego', icon: 'fire', text: 'El fuego no le hace nada, y si lo golpeás con un arma te podés quemar.', immune: ['fire'] },
    ignifugo: { kind: 'passive', name: 'Escamas ignífugas', icon: 'fire', text: 'El fuego no le hace nada.', immune: ['fire'] },
    cuerpo_hielo: { kind: 'passive', name: 'Cuerpo de hielo', icon: 'cold', text: 'El frío no le hace nada, y si lo golpeás con un arma te podés congelar.', immune: ['cold'] },
    espinas: { kind: 'passive', name: 'Espinas', icon: 'swords', text: 'Si lo golpeás con un arma, te lastimás con sus espinas.' },
    venenoso: { kind: 'passive', name: 'Venenoso', icon: 'poison', text: 'Sus golpes envenenan más seguido.' },
    renacer: { kind: 'passive', name: 'Renacer', icon: 'fire', text: 'Una vez por pelea, al caer renace de sus cenizas con un cuarto de la vida.' },
    lider: { kind: 'passive', name: 'Líder', icon: 'crown', text: 'Mientras siga en pie, sus compañeros tienen +1 de precisión.' },
    // v3.8: más pasivas, para que cada criatura tenga su personalidad
    colas_zorro: { kind: 'passive', name: 'Colas de zorro', icon: 'stars', text: 'Le crece una cola en cada turno, hasta nueve. Cada cola la hace pegar más fuerte; con nueve colas despierta todo su poder: el fuego de las colas se vuelve azul, se cura y cuesta más pegarle.' },
    ilusion: { kind: 'passive', name: 'Ilusiones', icon: 'eye', text: 'Los dos primeros golpes de arma que le iban a acertar pegan contra una ilusión (un crítico no).' },
    piel_gruesa: { kind: 'passive', name: 'Piel gruesa', icon: 'shield', text: 'Cada golpe de arma le hace 1 menos de daño (2 menos si es de nivel 8 o más).' },
    emboscada: { kind: 'passive', name: 'Emboscada', icon: 'target', text: 'Ataca por sorpresa: hasta que acierta su primer golpe tiene +2 de precisión, y ese golpe hace un cuarto más de daño.' },
    gigante: { kind: 'passive', name: 'Gigante', icon: 'arrow-up', text: 'Es demasiado grande: no se lo puede tirar al suelo ni agarrar.', immune: ['prone', 'grab'] },
    valiente: { kind: 'passive', name: 'Valiente', icon: 'crown', text: 'No conoce el miedo.', immune: ['fear'] },
    pureza: { kind: 'passive', name: 'Alma pura', icon: 'heal', text: 'Las maldiciones, el veneno y el miedo no le hacen nada.', immune: ['curse', 'poison', 'fear'] },
    mente_arcana: { kind: 'passive', name: 'Mente arcana', icon: 'spell', text: 'Su mente está protegida por la magia: no se aturde y las maldiciones no le hacen nada.', immune: ['stun', 'curse'] },
    lobo_mar: { kind: 'passive', name: 'Pies de marinero', icon: 'compass', text: 'Acostumbrado a pelear en cubierta: no se lo puede tirar al suelo.', immune: ['prone'] },
    aguante: { kind: 'passive', name: 'Aguante', icon: 'heart', text: 'Testarudo: una vez por pelea, un golpe que lo iba a voltear lo deja en pie con 1 de vida.' },
    abismal: { kind: 'passive', name: 'Horror del abismo', icon: 'warning', text: 'Mirarlo de cerca enloquece: si lo golpeás con un arma, a veces te llenás de miedo.' },

    // ---------------- Golpes con algo extra ----------------
    mordida: {
      kind: 'active', name: 'Mordida feroz', icon: 'bleed', act: 'strike', cd: 2, atk: 1,
      onHit: { type: 'bleed', chance: 0.35, turns: 2 },
      text: 'Muerde con +1 de precisión y puede hacerte sangrar.',
      hit: ['{E} te clava los colmillos con furia: {d} de daño.', '{E} se te tira al cuello y muerde: {d} de daño.'],
      miss: ['{E} tira un tarascón al aire: te corriste a tiempo.'],
      own: ['{P} muerde con furia a {e}: {d} de daño.'],
    },
    zarpazo: {
      kind: 'active', name: 'Zarpazo', icon: 'bleed', act: 'strike', cd: 2, mult: 1.2,
      onHit: { type: 'bleed', chance: 0.4, turns: 2 },
      text: 'Un golpe con las garras que pega más fuerte y puede hacerte sangrar.',
      hit: ['{E} te desgarra con las garras: {d} de daño.', '{E} te lanza un zarpazo brutal: {d} de daño.'],
      miss: ['El zarpazo de {e} te pasa rozando.'],
      own: ['{P} le da un zarpazo a {e}: {d} de daño.'],
    },
    infectar: {
      kind: 'active', name: 'Mordida infecciosa', icon: 'poison', act: 'strike', cd: 3,
      onHit: { type: 'poison', save: 'fuerza', turns: 3 },
      text: 'Si te muerde, resistí con fuerza o te infecta (veneno).',
      hit: ['{E} te muerde y la herida se pone negra: {d} de daño.'],
      miss: ['{E} intenta morderte, pero {lo} esquivás.'],
      fail: 'La infección te entra en la sangre.', resist: 'Tu cuerpo aguanta la infección.',
      own: ['{P} muerde a {e} y la herida se infecta: {d} de daño.'],
    },
    colmillos_veneno: {
      kind: 'active', name: 'Colmillos venenosos', icon: 'poison', act: 'strike', cd: 3,
      onHit: { type: 'poison', save: 'fuerza', turns: 3, plus: 1 },
      text: 'Si te muerde, resistí con fuerza o te envenena fuerte.',
      hit: ['{E} te clava los colmillos venenosos: {d} de daño.'],
      miss: ['{E} lanza la cabeza hacia vos, pero muerde el aire.'],
      fail: 'El veneno te quema por dentro.', resist: 'Apretás la herida y el veneno no prende.',
      own: ['{P} le clava los colmillos venenosos a {e}: {d} de daño.'],
    },
    picadura: {
      kind: 'active', name: 'Aguijón', icon: 'poison', act: 'strike', cd: 3,
      onHit: { type: 'poison', save: 'fuerza', turns: 3, plus: 1 },
      text: 'Si te pica, resistí con fuerza o te envenena fuerte.',
      hit: ['{E} te clava el aguijón: {d} de daño.', 'El aguijón de {e} se te hunde en la carne: {d} de daño.'],
      miss: ['El aguijón de {e} se clava en el suelo, al lado tuyo.'],
      fail: 'El veneno te quema por dentro.', resist: 'Apretás la herida y el veneno no prende.',
      own: ['{P} le clava el aguijón a {e}: {d} de daño.'],
    },
    hoja_envenenada: {
      kind: 'active', name: 'Hoja envenenada', icon: 'poison', act: 'strike', cd: 3,
      onHit: { type: 'poison', chance: 0.6, turns: 3 },
      text: 'Un corte con una hoja untada en veneno.',
      hit: ['{E} te hace un corte con su hoja envenenada: {d} de daño.'],
      miss: ['La hoja envenenada de {e} corta el aire.'],
    },
    picotazo: {
      kind: 'active', name: 'Picotazo a los ojos', icon: 'blind', act: 'strike', cd: 3,
      onHit: { type: 'blind', save: 'agilidad', turns: 2 },
      text: 'Va directo a tus ojos: resistí con agilidad o quedás medio ciego.',
      hit: ['{E} se lanza a tu cara a picotazos: {d} de daño.'],
      miss: ['{E} va directo a tus ojos, pero te cubrís a tiempo.'],
      fail: 'Te lastima los ojos: no ves bien.', resist: 'Cerrás los ojos justo a tiempo.',
      own: ['{P} se lanza a la cara de {e} a picotazos: {d} de daño.'],
    },
    picada: {
      kind: 'active', name: 'Ataque en picada', icon: 'arrow-down', act: 'strike', cd: 3, atk: 1, mult: 1.5,
      text: 'Se lanza desde lo alto: +1 de precisión y 50% más de daño.',
      hit: ['{E} se lanza en picada y te golpea de lleno: {d} de daño.'],
      miss: ['{E} baja en picada, pero te tirás al costado.'],
      own: ['{P} se lanza en picada sobre {e}: {d} de daño.'],
    },
    embestida: {
      kind: 'active', name: 'Embestida', icon: 'arrow-down', act: 'strike', cd: 3, atk: -1, mult: 1.5,
      onHit: { type: 'prone', save: 'fuerza', turns: 2 },
      text: 'Carga con todo: 50% más de daño y, si no resistís con fuerza, te tira al suelo.',
      hit: ['{E} toma carrera y te embiste con todo: {d} de daño.'],
      miss: ['{E} carga contra vos, pero te hacés a un lado y pasa de largo.'],
      fail: 'El golpe te tira al suelo: te cuesta defenderte.', resist: 'Aguantás el impacto sin caer.',
      own: ['{P} embiste a {e} con todo: {d} de daño.'],
    },
    derribo: {
      kind: 'active', name: 'Derribo', icon: 'arrow-down', act: 'strike', cd: 3,
      onHit: { type: 'prone', save: 'fuerza', turns: 2 },
      text: 'Se te tira encima: si no resistís con fuerza, caés al suelo (−3 de defensa).',
      hit: ['{E} se te tira encima para voltearte: {d} de daño.'],
      miss: ['{E} intenta voltearte, pero {lo} esquivás.'],
      fail: 'Caés al suelo: te cuesta defenderte.', resist: 'Afirmás los pies y no caés.',
      own: ['{P} se le tira encima a {e} y lo voltea: {d} de daño.'],
    },
    aturdir: {
      kind: 'active', name: 'Golpe aturdidor', icon: 'hourglass', act: 'strike', cd: 5, mult: 1.1,
      onHit: { type: 'stun', save: 'fuerza', turns: 1 },
      text: 'Un golpe tremendo: si no resistís con fuerza, perdés tu próximo turno.',
      hit: ['{E} te da un golpe tremendo en la cabeza: {d} de daño.'],
      miss: ['{E} descarga un golpe enorme, pero te agachás a tiempo.'],
      fail: 'Ves todo negro un momento: perdés el próximo turno.', resist: 'Sacudís la cabeza y seguís en pie.',
      own: ['{P} le da un golpe tremendo a {e}: {d} de daño.'],
    },
    agarre: {
      kind: 'active', name: 'Agarre', icon: 'lock', act: 'strike', cd: 3,
      onHit: { type: 'grab', save: 'fuerza', turns: 3 },
      text: 'Te atrapa: si no resistís con fuerza, no podés huir y te cuesta pegar.',
      hit: ['{E} te atrapa y te aprieta: {d} de daño.'],
      miss: ['{E} intenta agarrarte, pero te escurrís.'],
      fail: 'Quedás atrapado: no podés escapar y te cuesta pegar.', resist: 'Te zafás de un tirón.',
      own: ['{P} atrapa a {e} y no lo suelta: {d} de daño.'],
    },
    lengua: {
      kind: 'active', name: 'Lengua pegajosa', icon: 'lock', act: 'strike', cd: 3,
      onHit: { type: 'grab', save: 'agilidad', turns: 3 },
      text: 'Te pega un lengüetazo: si no resistís con agilidad, quedás pegado.',
      hit: ['La lengua de {e} te pega un latigazo y se te queda pegada: {d} de daño.'],
      miss: ['{E} lanza la lengua, pero te agachás.'],
      fail: 'Quedás pegado a su lengua: no podés escapar.', resist: 'Te despegás de un tirón.',
      own: ['{P} atrapa a {e} con la lengua: {d} de daño.'],
    },
    acido: {
      kind: 'active', name: 'Escupitajo ácido', icon: 'poison', act: 'strike', cd: 3,
      onHit: { type: 'corrode', save: 'agilidad', turns: 3 },
      text: 'Te escupe ácido: si no resistís con agilidad, te carcome la armadura (−2).',
      hit: ['{E} te escupe ácido: {d} de daño.'],
      miss: ['El ácido de {e} chisporrotea en el suelo, al lado tuyo.'],
      fail: 'El ácido te carcome la armadura.', resist: 'Te sacudís el ácido antes de que haga efecto.',
      own: ['{P} le escupe ácido a {e}: {d} de daño.'],
    },
    drenar: {
      kind: 'active', name: 'Drenar vida', icon: 'heart', act: 'strike', cd: 3, drain: 1,
      text: 'Si te toca, se cura todo el daño que te hace.',
      hit: ['{E} te toca y sentís que la vida se te escapa: {d} de daño.'],
      miss: ['La mano helada de {e} no llega a tocarte.'],
      own: ['{P} le roba la vida a {e}: {d} de daño.'],
    },
    beber_sangre: {
      kind: 'active', name: 'Beber sangre', icon: 'bleed', act: 'strike', cd: 3, drain: 1,
      text: 'Si te muerde, se cura todo el daño que te hace.',
      hit: ['{E} te clava los colmillos y bebe tu sangre: {d} de daño.'],
      miss: ['{E} busca tu cuello, pero lo apartás.'],
      own: ['{P} muerde a {e} y bebe su sangre: {d} de daño.'],
    },
    disparo: {
      kind: 'active', name: 'Disparo certero', icon: 'target', act: 'strike', cd: 3, atk: 2, pierce: true,
      text: 'Apunta con calma: +2 de precisión y tu armadura no cuenta.',
      hit: ['{E} apunta con calma y te acierta donde no cubre la armadura: {d} de daño.'],
      miss: ['El disparo de {e} pasa silbando al lado tuyo.'],
    },
    robar: {
      kind: 'active', name: 'Robar', icon: 'coins', act: 'strike', once: true, steal: true,
      text: 'Si te pega, te roba monedas. Las recuperás si lo vencés.',
      hit: ['{E} te golpea y te manotea la bolsa: {d} de daño.'],
      miss: ['{E} intenta manotearte la bolsa, pero te das cuenta a tiempo.'],
    },
    doble: {
      kind: 'active', name: 'Doble ataque', icon: 'swords', act: 'multi', cd: 3, hits: 2, atk: -2,
      text: 'Ataca dos veces seguidas (con −2 de precisión cada vez).',
      use: ['{E} ataca dos veces seguidas.', '{E} lanza un ataque tras otro.'],
      ownUse: ['{P} ataca dos veces seguidas.'],
    },
    barrido: {
      kind: 'active', name: 'Coletazo', icon: 'swords', act: 'sweep', cd: 3,
      text: 'Barre todo a su alrededor: les pega a vos y a tu mascota.',
      use: ['{E} barre todo a su alrededor con la cola.'],
    },

    // ---------------- Alientos, temblores y hechizos ----------------
    aliento_fuego: {
      kind: 'active', name: 'Aliento de fuego', icon: 'breath', act: 'breath', cd: 5, first: true, mult: 1,
      element: 'fire', status: 'fire', turns: 2, save: 'agilidad',
      text: 'Escupe fuego a todos: resistí con agilidad para recibir la mitad; si no, te prendés fuego.',
      use: ['{E} toma aire y escupe un torrente de fuego.'],
      fail: 'Las llamas te envuelven: {d} de daño.', resist: 'Te cubrís a tiempo y el fuego solo te roza: {d} de daño.',
      pet: 'Las llamas alcanzan a {p}: {d} de daño.',
      ownUse: ['{P} escupe un torrente de fuego.'],
    },
    aliento_hielo: {
      kind: 'active', name: 'Aliento helado', icon: 'ice', act: 'breath', cd: 5, first: true, mult: 1,
      element: 'ice', status: 'cold', turns: 2, save: 'agilidad',
      text: 'Sopla hielo a todos: resistí con agilidad para recibir la mitad; si no, quedás congelado.',
      use: ['{E} sopla una ráfaga helada.'],
      fail: 'El hielo te cubre entero: {d} de daño.', resist: 'Te cubrís a tiempo y la escarcha solo te roza: {d} de daño.',
      pet: 'La escarcha alcanza a {p}: {d} de daño.',
      ownUse: ['{P} sopla una ráfaga helada.'],
    },
    pisoton: {
      kind: 'active', name: 'Pisotón', icon: 'arrow-down', act: 'quake', cd: 5, mult: 1, save: 'agilidad', status: 'prone', turns: 2,
      text: 'Hace temblar el suelo: resistí con agilidad o te caés y te lastimás.',
      use: ['{E} da un pisotón que hace temblar el suelo.'],
      fail: 'El temblor te tira al suelo: {d} de daño.', resist: 'Saltás a tiempo y el temblor no te alcanza.',
      pet: 'El temblor voltea a {p}: {d} de daño.',
      ownUse: ['{P} da un pisotón que hace temblar el suelo.'],
    },
    hechizo: {
      kind: 'active', name: 'Hechizo', icon: 'spell', act: 'bolt', cd: 3, mult: 1, save: 'ingenio',
      text: 'Te lanza magia: resistí con ingenio para recibir la mitad.',
    },

    // ---------------- Sin daño: te dejan un estado ----------------
    chillido: {
      kind: 'active', name: 'Chillido', icon: 'warning', act: 'debuff', cd: 5, save: 'ingenio', status: 'stun', turns: 1,
      text: 'Un chillido que aturde: resistí con ingenio o perdés tu próximo turno.',
      use: ['{E} lanza un chillido que te perfora los oídos.'],
      fail: 'Te tapás los oídos y perdés el próximo turno.', resist: 'Apretás los dientes y aguantás el chillido.',
    },
    telarana: {
      kind: 'active', name: 'Telaraña', icon: 'lock', act: 'debuff', cd: 4, save: 'agilidad', status: 'grab', turns: 3,
      text: 'Te tira una red: resistí con agilidad o quedás atrapado (no podés huir y pegás peor).',
      use: ['{E} te lanza una red pegajosa.'],
      fail: 'La telaraña te envuelve: quedás atrapado.', resist: 'Esquivás la red de un salto.',
    },
    encantar: {
      kind: 'active', name: 'Encantar', icon: 'heart', act: 'debuff', cd: 5, save: 'ingenio', status: 'stun', turns: 1,
      text: 'Te encanta con la voz: resistí con ingenio o perdés tu próximo turno.',
      use: ['{E} te mira a los ojos y te habla con una voz dulce.'],
      fail: 'Te quedás embobado y perdés el próximo turno.', resist: 'Sacudís la cabeza y rompés el encanto.',
    },
    polvo_sueno: {
      kind: 'active', name: 'Polvo de sueño', icon: 'stars', act: 'debuff', cd: 5, save: 'ingenio', status: 'stun', turns: 1,
      text: 'Un polvo que da sueño: resistí con ingenio o perdés tu próximo turno.',
      use: ['{E} sacude las alas y te tira un polvo brillante.'],
      fail: 'Te pesan los párpados: perdés el próximo turno.', resist: 'Contenés la respiración y el polvo no te hace nada.',
    },
    mirada: {
      kind: 'active', name: 'Mirada de piedra', icon: 'eye', act: 'debuff', cd: 5, save: 'ingenio', dcMod: 1, status: 'stun', turns: 1,
      text: 'Su mirada te paraliza: resistí con ingenio (más difícil) o perdés tu próximo turno.',
      use: ['{E} te clava la mirada.'],
      fail: 'Tu cuerpo se pone duro como piedra: perdés el próximo turno.', resist: 'Desviás la vista a tiempo.',
    },
    miedo: {
      kind: 'active', name: 'Aterrar', icon: 'warning', act: 'debuff', cd: 4, save: 'ingenio', status: 'fear', turns: 3,
      text: 'Te llena de miedo: resistí con ingenio o pegás peor (−2 de precisión y −1 de daño).',
      use: ['{E} se alza sobre vos con un grito helado.'],
      fail: 'El miedo te paraliza las manos: pegás peor.', resist: 'Te sobreponés al miedo.',
    },
    rugido: {
      kind: 'active', name: 'Rugido', icon: 'warning', act: 'debuff', cd: 4, save: 'ingenio', status: 'fear', turns: 3,
      text: 'Un rugido aterrador: resistí con ingenio o pegás peor (−2 de precisión y −1 de daño).',
      use: ['{E} suelta un rugido que hace temblar el aire.'],
      fail: 'Te tiemblan las piernas: pegás peor.', resist: 'Te plantás firme y no te achicás.',
    },
    maldicion: {
      kind: 'active', name: 'Maldición', icon: 'skull', act: 'debuff', cd: 4, save: 'ingenio', status: 'curse', turns: 3,
      text: 'Te maldice: resistí con ingenio o pegás y te defendés peor.',
      use: ['{E} murmura una maldición y te señala.'],
      fail: 'La maldición cae sobre vos: pegás peor y te defendés peor.', resist: 'Sentís un escalofrío, pero la maldición no prende.',
    },
    oscuridad: {
      kind: 'active', name: 'Oscuridad', icon: 'blind', act: 'debuff', cd: 4, save: 'agilidad', status: 'blind', turns: 2,
      text: 'Una nube de oscuridad: resistí con agilidad o casi no acertás.',
      use: ['{E} conjura una nube de oscuridad a tu alrededor.'],
      fail: 'No ves nada: te cuesta acertar.', resist: 'Salís de la nube a tiempo.',
    },
    nube_tinta: {
      kind: 'active', name: 'Nube de tinta', icon: 'blind', act: 'debuff', cd: 4, save: 'agilidad', status: 'blind', turns: 2,
      text: 'Una nube de tinta: resistí con agilidad o casi no acertás.',
      use: ['{E} suelta una nube de tinta negra.'],
      fail: 'La tinta te ciega.', resist: 'Te cubrís la cara a tiempo.',
    },
    tierra_ojos: {
      kind: 'active', name: 'Tierra a los ojos', icon: 'blind', act: 'debuff', cd: 4, save: 'agilidad', status: 'blind', turns: 2,
      text: 'Juega sucio: resistí con agilidad o casi no acertás.',
      use: ['{E} junta un puñado de tierra y te lo tira a la cara.'],
      fail: 'Te entra tierra en los ojos.', resist: 'Te cubrís justo a tiempo.',
    },
    antimagia: {
      kind: 'active', name: 'Ojo antimagia', icon: 'eye', act: 'debuff', cd: 4, save: 'ingenio', status: 'silence', turns: 2, magicOnly: true,
      text: 'Anula la magia: si usás magia, resistí con ingenio o no podés lanzar hechizos.',
      use: ['{E} abre su ojo central y te mira fijo.'],
      fail: 'Sentís que la magia se te escapa: no podés lanzar hechizos.', resist: 'Resistís su mirada: tu magia sigue ahí.',
    },

    // ---------------- Para sí misma o su grupo ----------------
    curarse: {
      kind: 'active', name: 'Curarse', icon: 'heal', act: 'heal', cd: 4, max: 2, amount: 0.25, when: 'hurt',
      text: 'Con poca vida, se cura un cuarto de la vida (dos veces por pelea).',
    },
    guardia: {
      kind: 'active', name: 'Guardia', icon: 'shield', act: 'guard', cd: 4, value: 3, turns: 2,
      text: 'Se cubre (+3 de defensa por dos turnos) y ataca igual.',
    },
    aullido: {
      kind: 'active', name: 'Aullido', icon: 'arrow-up', act: 'rally', once: true, first: true, value: 1, turns: 3,
      text: 'Una vez por pelea: él y sus compañeros pegan con +1 de precisión y +1 de daño por 3 turnos.',
      use: ['{E} aúlla y la manada responde: pegan con más ganas.'], alone: ['{E} aúlla y se envalentona.'],
    },
    grito: {
      kind: 'active', name: 'Grito de guerra', icon: 'arrow-up', act: 'rally', once: true, first: true, value: 1, turns: 3,
      text: 'Una vez por pelea: él y sus compañeros pegan con +1 de precisión y +1 de daño por 3 turnos.',
      use: ['{E} lanza un grito de guerra: sus compañeros se envalentonan.'], alone: ['{E} lanza un grito de guerra y se envalentona.'],
    },
    invocar: {
      kind: 'active', name: 'Invocar', icon: 'skulls', act: 'summon', once: true,
      text: 'Una vez por pelea, llama a una criatura para que lo ayude.',
    },

    // ---------------- v3.8: activas nuevas ----------------
    fuego_zorro: {
      kind: 'active', name: 'Fuego de zorro', icon: 'fire', act: 'bolt', cd: 3, mult: 1, save: 'ingenio',
      bolt: { element: 'fire', status: 'fire', turns: 2, use: '{E} sacude las colas y te lanza una llamarada azul.', fail: 'El fuego azul te envuelve: {d} de daño.', own: '{P} le lanza fuego azul a {e}: {d} de daño.' },
      text: 'Llamas azules que salen de sus colas: resistí con ingenio para recibir la mitad; si no, te podés prender fuego.',
    },
    tragar: {
      kind: 'active', name: 'Tragar', icon: 'lock', act: 'strike', cd: 5, mult: 1.3,
      onHit: { type: 'grab', save: 'fuerza', turns: 2 },
      text: 'Abre la boca enorme y te traga: pega más fuerte, y si no resistís con fuerza quedás atrapado.',
      hit: ['{E} abre una boca enorme y te traga a medias: {d} de daño.'],
      miss: ['{E} cierra la boca de golpe, pero saltás a un costado.'],
      fail: 'Quedás atrapado adentro: no podés escapar y te cuesta pegar.', resist: 'Te abrís paso a patadas y salís.',
      own: ['{P} se traga a medias a {e}: {d} de daño.'],
    },
    ventisca: {
      kind: 'active', name: 'Ventisca', icon: 'ice', act: 'breath', cd: 5, first: true, mult: 0.9,
      element: 'ice', status: 'cold', turns: 2, save: 'agilidad',
      text: 'Levanta una tormenta de nieve: resistí con agilidad para recibir la mitad; si no, quedás congelado.',
      use: ['{E} golpea el suelo y levanta una ventisca helada.'],
      fail: 'La nieve te azota y te congela: {d} de daño.', resist: 'Te cubrís de la ventisca: {d} de daño.',
      pet: 'La ventisca alcanza a {p}: {d} de daño.',
      ownUse: ['{P} levanta una ventisca helada.'],
    },
    ola: {
      kind: 'active', name: 'Ola gigante', icon: 'storm', act: 'quake', cd: 5, first: true, mult: 1.1, save: 'fuerza', status: 'prone', turns: 2,
      text: 'Levanta una ola enorme: resistí con fuerza o te arrastra y te tira al suelo.',
      use: ['{E} se hunde y levanta una ola enorme que se te viene encima.'],
      fail: 'La ola te revuelca: {d} de daño.', resist: 'Te agarrás fuerte y la ola pasa de largo.',
      pet: 'La ola arrastra a {p}: {d} de daño.',
      ownUse: ['{P} levanta una ola enorme.'],
    },
    rafaga: {
      kind: 'active', name: 'Ráfaga de alas', icon: 'feather', act: 'quake', cd: 4, mult: 0.8, save: 'fuerza', status: 'prone', turns: 2,
      text: 'Bate las alas con fuerza: resistí con fuerza o el viento te tira al suelo.',
      use: ['{E} bate las alas y levanta un vendaval.'],
      fail: 'El viento te voltea: {d} de daño.', resist: 'Te plantás contra el viento y no caés.',
      pet: 'El vendaval voltea a {p}: {d} de daño.',
      ownUse: ['{P} bate las alas y levanta un vendaval.'],
    },
    destello: {
      kind: 'active', name: 'Destello', icon: 'sun', act: 'debuff', cd: 4, save: 'agilidad', status: 'blind', turns: 2,
      text: 'Un destello de luz: resistí con agilidad o te encandila y casi no acertás.',
      use: ['{E} brilla de golpe con una luz blanca.'],
      fail: 'La luz te encandila: te cuesta acertar.', resist: 'Cerrás los ojos a tiempo.',
    },
    vision_abismo: {
      kind: 'active', name: 'Visión del abismo', icon: 'eye', act: 'debuff', cd: 5, save: 'ingenio', dcMod: 1, status: 'curse', turns: 3,
      text: 'Te muestra lo que hay en el fondo del mar: resistí con ingenio (más difícil) o pegás y te defendés peor por 3 turnos.',
      use: ['{E} abre la mente y te muestra el fondo del abismo.'],
      fail: 'Lo que viste no se te va de la cabeza: pegás y te defendés peor.', resist: 'Te aferrás a la cordura y apartás la vista.',
    },
    merienda: {
      kind: 'active', name: 'Merienda de bambú', icon: 'food', act: 'heal', cd: 4, max: 1, amount: 0.25, when: 'hurt',
      say: '{E} se sienta, mordisquea un brote de bambú y recupera {n} de vida.',
      text: 'Con poca vida se sienta a comer bambú y se cura un cuarto de la vida (una vez por pelea).',
    },
  };

  // Lo que invoca cada criatura (si no está, no invoca)
  const SUMMONS = {
    nigromante: 'esqueleto', lich: 'momia', capitan_pirata: 'grumete_pirata', kraken: 'tentaculo', senor_vampiro: 'murcielago_vampiro',
    cthulhu: 'profundo', kyubi: 'kitsune', // v3.8
  };
  const SUMMON_LINES = {
    cthulhu: '{E} murmura desde el fondo del mar y {s} sube a la superficie.',
    kyubi: '{E} sopla sobre una hoja y la hoja se vuelve {s}.',
    nigromante: '{E} alza los brazos y {s} sale de la tierra.',
    lich: '{E} pronuncia una palabra prohibida y {s} se levanta para servirlo.',
    capitan_pirata: '{E} silba fuerte: ¡{s} salta a la pelea!',
    kraken: '{E} agita el agua y {s} emerge a tu lado.',
    senor_vampiro: '{E} abre la capa y {s} sale volando de entre sus pliegues.',
  };

  // Hechizos: cómo se ven según la criatura
  const BOLT = {
    fire: { element: 'fire', status: 'fire', turns: 2, use: '{E} conjura una bola de fuego y te la lanza.', fail: 'La bola de fuego te da de lleno: {d} de daño.', own: '{P} le lanza una bola de fuego a {e}: {d} de daño.' },
    ice: { element: 'ice', status: 'cold', turns: 2, use: '{E} conjura una lanza de hielo.', fail: 'La lanza de hielo se te clava: {d} de daño.', own: '{P} le clava una lanza de hielo a {e}: {d} de daño.' },
    dark: { element: 'arcane', status: null, use: '{E} lanza un rayo de sombra.', fail: 'La sombra te atraviesa: {d} de daño.', own: '{P} lanza un rayo de sombra a {e}: {d} de daño.' },
    arcane: { element: 'shock', status: 'shock', turns: 1, use: '{E} lanza una descarga de energía.', fail: 'La descarga te sacude entero: {d} de daño.', own: '{P} sacude a {e} con una descarga: {d} de daño.' },
  };
  function boltKind(inst) {
    const tags = (inst && inst.tags) || [];
    const fam = (inst && inst.family) || [];
    if (tags.includes('fire')) return BOLT.fire;
    if (tags.includes('ice')) return BOLT.ice;
    if (fam.includes('undead') || tags.includes('undead') || tags.includes('curse')) return BOLT.dark;
    return BOLT.arcane;
  }

  // ============================================================
  // Datos
  // ============================================================

  function get(id) { return LIB[id] ? { id, ...LIB[id] } : null; }

  function speciesOf(x) {
    if (!x) return null;
    return A.Data.getById('enemies', x.species || x.id);
  }

  /** Ids de habilidades de una instancia, de un dato de criatura o de una mascota. */
  function idsOf(x) {
    if (!x) return [];
    if (Array.isArray(x.skills)) return x.skills.filter((id) => LIB[id]);
    const d = speciesOf(x);
    return d && Array.isArray(d.skills) ? d.skills.filter((id) => LIB[id]) : [];
  }

  function has(x, id) { return idsOf(x).includes(id); }

  /** Para mostrar: [{ id, name, icon, text, kind }] (pasivas primero). */
  function listFor(x) {
    const out = idsOf(x).map(get).filter(Boolean);
    out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'passive' ? -1 : 1));
    return out;
  }

  function info(id) { return get(id); }

  function all() { return Object.keys(LIB).map(get); }

  // ============================================================
  // Pasivas (las consulta combat.js)
  // ============================================================

  function isPet(x) { return !!(x && x.species && !x.instanceId); }

  function hurt(x) {
    const hp = isPet(x) ? x.health : x.hp;
    const max = isPet(x) ? x.maxHealth : x.maxHp;
    return max > 0 && hp <= max / 2;
  }

  // ---------- v3.8: Colas de zorro (kitsune) ----------
  const TAILS_MAX = 9;
  function tailsStart(x) {
    const d = speciesOf(x);
    return Math.max(1, Math.min(TAILS_MAX, (d && d.tailsStart) || 1));
  }
  /** Cuántas colas tiene ahora (0 si no es un zorro de colas). */
  function tailsOf(x) {
    if (!x || !has(x, 'colas_zorro')) return 0;
    return Math.min(TAILS_MAX, x.tails || tailsStart(x));
  }
  /**
   * Al empezar su turno le crece una cola. Devuelve null o
   * { tails, awake, heal } (awake: acaba de llegar a nueve; heal: lo que se cura).
   */
  function growTails(x) {
    if (!x || !has(x, 'colas_zorro')) return null;
    const cur = tailsOf(x);
    if (cur >= TAILS_MAX) { x.tails = cur; return null; }
    x.tails = cur + 1;
    const out = { tails: x.tails, awake: false, heal: 0 };
    if (x.tails >= TAILS_MAX) {
      out.awake = true;
      const pet = isPet(x);
      const max = (pet ? x.maxHealth : x.maxHp) || 0;
      const hp = pet ? x.health : x.hp;
      const n = Math.min(Math.max(0, max - hp), Math.max(1, Math.round(max * 0.2)));
      if (n > 0 && hp > 0) { if (pet) x.health += n; else x.hp += n; out.heal = n; }
    }
    return out;
  }

  /** Bonos de las pasivas a precisión/defensa/armadura (Manada, Líder, Vuela). */
  function statMods(inst, c) {
    const out = { attack: 0, defense: 0, armor: 0 };
    if (!inst) return out;
    const ids = idsOf(inst);
    if (ids.includes('vuelo')) out.defense += 1;
    // v3.8: cada tres colas, +1 de precisión (+2 con siete); con nueve, +2 de defensa
    const tails = tailsOf(inst);
    if (tails) {
      out.attack += Math.floor((tails - 1) / 3);
      if (tails >= TAILS_MAX) out.defense += 2;
    }
    // v3.8: Emboscada: +2 de precisión hasta que acierta su primer golpe
    if (ids.includes('emboscada') && inst.instanceId && !inst._ambushDone) out.attack += 2;
    if (c && Array.isArray(c.enemies) && inst.instanceId) {
      const others = c.enemies.filter((e) => e !== inst && e.hp > 0);
      if (ids.includes('manada')) out.attack += Math.min(2, others.filter((e) => e.id === inst.id).length);
      if (others.some((e) => idsOf(e).includes('lider'))) out.attack += 1;
    }
    return out;
  }

  /** Multiplicador de daño (Furia con media vida). */
  function damageMult(x) {
    return has(x, 'furia') && hurt(x) ? 1.25 : 1;
  }

  /**
   * v3.8: otros multiplicadores de daño (las colas del kitsune y la Emboscada).
   * La Emboscada se gasta acá: devuelve { mult, ambush }.
   */
  function bonusDamage(x) {
    let mult = 1;
    const t = tailsOf(x);
    if (t > 1) mult *= 1 + 0.03 * (t - 1);
    let ambush = false;
    if (x && x.instanceId && has(x, 'emboscada') && !x._ambushDone) {
      x._ambushDone = true;
      ambush = true;
      mult *= 1.25;
    }
    return { mult, ambush };
  }

  /** ¿Es inmune a este estado por una pasiva? */
  function immune(x, type) {
    for (const id of idsOf(x)) {
      const s = LIB[id];
      if (s && s.immune && s.immune.includes(type)) return { skill: id, name: s.name };
    }
    return null;
  }

  /**
   * Vida que recupera al empezar su turno (Regeneración; el fuego la frena).
   * 3% de la vida por turno (los jefes, 1,5%), y como mucho un cuarto de su vida por pelea.
   * Devuelve -1 si el fuego la frena, 0 si no se regenera.
   */
  function regenOf(x) {
    if (!has(x, 'regeneracion')) return 0;
    if ((x.effects || []).some((e) => e.type === 'fire')) return -1; // frenada
    const max = (isPet(x) ? x.maxHealth : x.maxHp) || 0;
    const left = Math.round(max * 0.25) - (x._regenUsed || 0);
    if (left <= 0) return 0;
    return Math.min(left, Math.max(1, Math.round(max * (x.category === 'boss' ? 0.015 : 0.03))));
  }

  function lifesteal(x) { return has(x, 'sed_sangre') ? 0.25 : 0; }

  function poisonBoost(x) { return has(x, 'venenoso'); }

  /**
   * Antes de recibir un golpe de arma que acierta: Escurridizo (el primero) o Etéreo (25%).
   * Devuelve { skill, say } si lo esquiva, o null.
   */
  function dodgeHit(target, r, byPet) {
    if (!target || !r || !r.hit) return null;
    const n = noun(target);
    // v3.2: si el golpe es de tu mascota, no es "tu golpe"
    const blow = byPet ? `el golpe de ${noun(byPet)}` : 'tu golpe';
    // v3.8: Ilusiones: los dos primeros golpes que pegaban le dan a una ilusión
    if (has(target, 'ilusion') && (target._illusions || 0) < 2 && !r.crit) {
      target._illusions = (target._illusions || 0) + 1;
      return { skill: 'ilusion', say: pick([`${cap(blow)} atraviesa a ${n}… y ${n} se deshace en humo: era una ilusión.`, `${cap(blow)} le da a una copia de ${n} que se desvanece en el aire.`]) };
    }
    if (has(target, 'escurridizo') && !target._slipped && !r.crit) {
      target._slipped = true;
      return { skill: 'escurridizo', say: pick([`${cap(n)} se escurre en el último instante: el golpe no llega.`, `${cap(n)} se retuerce y ${blow} pasa de largo.`]) };
    }
    if (has(target, 'etereo') && Math.random() < 0.25) {
      return { skill: 'etereo', say: pick([`${cap(blow)} atraviesa a ${n} como si fuera humo.`, byPet ? `${cap(noun(byPet))} pasa a través de ${n} sin tocarlo.` : `El arma pasa a través de ${n} sin tocarlo.`]) };
    }
    return null;
  }

  /** v3.9: la mascota también esquiva con sus pasivas cuando la atacan (Ilusiones, Escurridizo, Etéreo). */
  function petDodge(pet, r, enemy) {
    if (!pet || !r || !r.hit) return null;
    const P = cap(noun(pet));
    const e = noun(enemy);
    if (has(pet, 'ilusion') && (pet._illusions || 0) < 2 && !r.crit) {
      pet._illusions = (pet._illusions || 0) + 1;
      return { skill: 'ilusion', say: `${cap(e)} le pega a ${noun(pet)}… y se deshace en humo: era una ilusión.` };
    }
    if (has(pet, 'escurridizo') && !pet._slipped && !r.crit) {
      pet._slipped = true;
      return { skill: 'escurridizo', say: `${P} se escurre en el último instante: el golpe de ${e} no llega.` };
    }
    if (has(pet, 'etereo') && Math.random() < 0.25) return { skill: 'etereo', say: `El golpe de ${e} atraviesa a ${noun(pet)} como si fuera humo.` };
    return null;
  }

  /** v3.9: si la mascota tiene espinas o el cuerpo en llamas/helado, el que le pega de cerca lo sufre. */
  function petReactions(c, pet, enemy, k) {
    if (!pet || !enemy || !k) return;
    const re = reactions(pet);
    const n = noun(enemy);
    const tier = (speciesOf(pet) || {}).tier || 1;
    if (re.thorns > 0 && enemy.hp > 0) {
      k.hurtEnemy(enemy, re.thorns, { actor: 'pet', say: `${cap(n)} se clava las espinas de ${noun(pet)}: ${re.thorns} de daño.` });
    }
    if (re.burn && enemy.hp > 0 && Math.random() < re.burn * 1.5) petStatusOn(enemy, 'fire', 1, tier, k, 'cuerpo_fuego');
    if (re.chill && enemy.hp > 0 && Math.random() < re.chill * 1.5) petStatusOn(enemy, 'cold', 1, tier, k, 'cuerpo_hielo');
  }

  /** El primer golpe de arma le hace la mitad (Caparazón / Gelatinoso). Devuelve { dmg, skill }. */
  function softenHit(target, dmg) {
    if (!target) return { dmg, skill: null };
    let skill = null;
    if (!target._softened) {
      const id = ['caparazon', 'gelatinoso'].find((s) => has(target, s));
      if (id) {
        target._softened = true;
        dmg = Math.max(1, Math.floor(dmg / 2));
        skill = id;
      }
    }
    // v3.8: Piel gruesa: cada golpe de arma hace 1 menos (2 desde el nivel 8)
    if (has(target, 'piel_gruesa')) {
      const cut = (target.tier || 1) >= 8 ? 2 : 1;
      const nd = Math.max(1, dmg - cut);
      if (nd < dmg && !skill && !target._hideSaid) { target._hideSaid = true; skill = 'piel_gruesa'; }
      dmg = nd;
    }
    return { dmg, skill };
  }

  /** Lo que le pasa al que lo golpea con un arma: { burn, chill, thorns }. */
  function reactions(target) {
    const out = { burn: 0, chill: 0, thorns: 0, dread: 0 };
    if (!target) return out;
    if (has(target, 'abismal')) out.dread = 0.15; // v3.8
    const t = target.tier || 1;
    if (has(target, 'cuerpo_fuego')) out.burn = 0.2;
    if (has(target, 'cuerpo_hielo')) out.chill = 0.2;
    if (has(target, 'espinas')) out.thorns = Math.max(1, Math.floor(t / 4));
    return out;
  }

  /**
   * Renacer: una vez por pelea vuelve con un cuarto de la vida.
   * v3.8: Aguante: una vez por pelea queda en pie con 1 de vida.
   * Devuelve el id de la pasiva que lo salvó, o false.
   */
  function tryRevive(inst) {
    if (!inst || inst.hp > 0) return false;
    if (!inst._held && has(inst, 'aguante')) {
      inst._held = true;
      inst.hp = 1;
      return 'aguante';
    }
    if (inst._reborn || !has(inst, 'renacer')) return false;
    inst._reborn = true;
    inst.hp = Math.max(1, Math.round(inst.maxHp / 4));
    inst.effects = [];
    return 'renacer';
  }

  // ============================================================
  // Tiradas para resistir
  // ============================================================

  function saveDC(enemy, dcMod) {
    const t = (enemy && enemy.tier) || 1;
    let dc = 10 + Math.floor(t / 2);
    if (enemy && enemy.category === 'boss') dc += 2;
    if (enemy && enemy.elite) dc += 1;
    return dc + (dcMod || 0);
  }

  /** Valor de un estado según el tier (veneno 1..4 por turno, maldición 1..3). */
  function valueFor(type, tier, plus) {
    const t = tier || 1;
    if (type === 'bleed' || type === 'poison' || type === 'fire') return 1 + Math.floor((t - 1) / 4) + (plus || 0);
    if (type === 'curse') return 1 + Math.floor(t / 5);
    return 1;
  }

  // ============================================================
  // Frases
  // ============================================================

  function noun(x) {
    if (!x) return 'la criatura';
    if (isPet(x)) return A.Narrator && A.Narrator.petNoun ? A.Narrator.petNoun(x) : x.name;
    return A.Narrator && A.Narrator.enemyNoun ? A.Narrator.enemyNoun(x) : (x.displayName || x.name);
  }

  /** Completa {E}/{e} (criatura), {P}/{p} (tu mascota), {d}, {n}, {s}. */
  function fill(tpl, who, v = {}) {
    if (!tpl) return '';
    const p = A.State && A.State.player;
    const e = v.e || noun(who);
    const pn = p && p.pet ? noun(p.pet) : 'tu mascota';
    const fem = who && !isPet(who) && A.Narrator && A.Narrator.isFem ? A.Narrator.isFem(who.id) : false;
    const vals = { e, E: cap(e), p: v.p || pn, P: cap(v.p || pn), d: v.d, n: v.n, s: v.s, c: v.c, lo: fem ? 'la' : 'lo' };
    const out = String(pick(tpl)).replace(/\{(\w+)\}/g, (_, k) => (vals[k] != null ? vals[k] : ''));
    return A.Narrator && A.Narrator.contract ? A.Narrator.contract(out) : out;
  }

  function healLine(inst) {
    const fam = inst.family || [];
    const tags = inst.tags || [];
    if (fam.includes('plant')) return 'La savia cierra las heridas de {e}: recupera {n} de vida.';
    if (fam.includes('fey') || tags.includes('arcane') && fam.includes('beast')) return 'Una luz suave envuelve a {e}: recupera {n} de vida.';
    if (tags.includes('magic') || fam.includes('arcane')) return '{E} murmura un conjuro y sus heridas se cierran: recupera {n} de vida.';
    if (fam.includes('humanoid')) return '{E} toma un trago de una poción: recupera {n} de vida.';
    return '{E} se lame las heridas y recupera {n} de vida.';
  }

  function guardLine(inst) {
    const fam = inst.family || [];
    const tags = inst.tags || [];
    if (tags.includes('magic') || fam.includes('arcane') || fam.includes('elemental')) return '{E} se rodea de un escudo de energía.';
    if (tags.includes('armor')) return '{E} se esconde en su caparazón.';
    return '{E} levanta el escudo y se cubre.';
  }

  // ============================================================
  // IA de las criaturas
  // ============================================================

  function activesOf(x) { return idsOf(x).map(get).filter((s) => s && s.kind === 'active'); }

  function ready(x, sk) {
    if (sk.once && x._used && x._used[sk.id]) return false;
    if (sk.max && x._uses && (x._uses[sk.id] || 0) >= sk.max) return false;
    return !(x._cds && x._cds[sk.id] > 0);
  }

  function markUsed(x, sk) {
    x._used = x._used || {};
    x._uses = x._uses || {};
    x._cds = x._cds || {};
    x._used[sk.id] = true;
    x._uses[sk.id] = (x._uses[sk.id] || 0) + 1;
    if (sk.cd) x._cds[sk.id] = sk.cd;
  }

  function tickCds(x) {
    if (!x._cds) return;
    for (const id of Object.keys(x._cds)) if (x._cds[id] > 0) x._cds[id] -= 1;
  }

  const LASTING = ['stun', 'grab', 'fear', 'blind', 'prone', 'curse', 'corrode', 'silence'];
  function playerHas(type) {
    const p = A.State.player;
    return !!(p && (p.effects || []).some((e) => e.type === type));
  }

  /** ¿Tiene sentido usarla ahora? Devuelve un peso (0 = no). */
  function weightOf(sk, x, k) {
    const p = A.State.player;
    const statusOf = sk.act === 'debuff' ? sk.status : sk.onHit && sk.onHit.save ? sk.onHit.type : null;
    if (sk.act === 'debuff') {
      if (sk.magicOnly && !(p && p.hasMagic)) return 0;
      if (playerHas(sk.status) || k.immune(p, sk.status)) return 0;
    }
    if (sk.when === 'hurt' && !hurt(x)) return 0;
    switch (sk.act) {
      case 'heal': return 2;
      case 'guard': return (x.effects || []).some((e) => e.type === 'guard') ? 0 : 1;
      case 'rally': {
        // con un aullido por grupo alcanza
        const group = k.alive();
        if (group.length < 2) return 0; // solo, no tiene a quién darle ánimo
        if ((x.effects || []).some((e) => e.type === 'rally')) return 0;
        if (group.some((e) => e !== x && (e._used || {})[sk.id])) return 0;
        return 1.5;
      }
      case 'summon': {
        const id = SUMMONS[x.id];
        if (!id || !A.Data.getById('enemies', id)) return 0;
        return k.alive().length < 3 ? 1.5 : 0;
      }
      case 'sweep': return p && p.pet && p.pet.health > 0 ? 1.5 : 1;
      default: break;
    }
    if (sk.steal) {
      if (x.stolen) return 0;
      return A.Currency && A.Currency.toCopper && A.Currency.toCopper() > 0 ? 1.2 : 0;
    }
    // Un estado que ya tenés vale menos
    if (statusOf && LASTING.includes(statusOf) && playerHas(statusOf)) return 0.3;
    return 1;
  }

  function weighted(list) {
    const total = list.reduce((s, it) => s + it.w, 0);
    let r = Math.random() * total;
    for (const it of list) { r -= it.w; if (r <= 0) return it.sk; }
    return list[list.length - 1].sk;
  }

  /**
   * Turno de una criatura: a veces usa una activa. Devuelve true si actuó
   * (si no, combat.js hace el ataque normal).
   */
  function enemyTurn(c, x) {
    const k = kit();
    if (!k || !x || x.hp <= 0) return false;
    x._turns = (x._turns || 0) + 1;
    tickCds(x);
    const opts = activesOf(x).filter((sk) => ready(x, sk)).map((sk) => ({ sk, w: weightOf(sk, x, k) })).filter((o) => o.w > 0);
    if (!opts.length) return false;
    let chance = x.elite ? USE_CHANCE.elite : x.category === 'boss' ? USE_CHANCE.boss : USE_CHANCE.normal;
    // las fuertes, los jefes y la élite abren la pelea con su mejor golpe (aliento, aullido...)
    const big = x.elite || x.category === 'strong' || x.category === 'boss';
    const openers = x._turns === 1 ? opts.filter((o) => o.sk.first && (big || o.sk.act === 'rally')) : [];
    if (openers.length) chance = Math.max(chance, USE_CHANCE.opener);
    if (Math.random() >= chance) return false;
    const sk = weighted(openers.length ? openers : opts);
    markUsed(x, sk);
    const fn = ACTS[sk.act];
    if (!fn) return false;
    fn(sk, x, k);
    return true;
  }

  // ============================================================
  // Acciones de las criaturas
  // ============================================================

  /** Arma las frases de un golpe para enemyStrike. */
  function strikeSay(sk, x) {
    return (kind, info) => {
      if (info.toPet) {
        if (kind === 'hit') return { text: fill(`{E} usa ${sk.name.toLowerCase()} contra {p}: {d} de daño.`, x, { d: info.dmg }), tone: 'bad' };
        return null; // la frase normal ("{P} esquiva...")
      }
      if (kind === 'hit') {
        const t = fill(sk.hit, x, { d: info.dmg });
        return { text: info.crit ? `¡Crítico! ${t}` : t, tone: info.crit ? 'crit' : 'bad' };
      }
      if (kind === 'miss' && sk.miss) return { text: fill(sk.miss, x), tone: 'good' };
      return null;
    };
  }

  /** Lo que deja un golpe que pegó (estado con o sin tirada, robo, drenar). */
  function afterHit(sk, x, k, victim, info) {
    const p = A.State.player;
    if (sk.drain && x.hp > 0 && info.dmg > 0) k.healEnemy(x, Math.round(info.dmg * sk.drain), { say: '{E} recupera {n} de vida.', skill: sk.id });
    if (sk.steal && !info.toPet) stealCoins(x, k);
    const oh = sk.onHit;
    if (!oh) return;
    const alive = victim === p ? p.hp > 0 : victim.health > 0;
    if (!alive) return;
    const value = valueFor(oh.type, x.tier, oh.plus);
    if (victim !== p) {
      // Tu mascota no tira: 50% si se resistía, o la chance del golpe
      if (Math.random() < (oh.save ? 0.5 : oh.chance || 1)) k.status(victim, oh.type, { turns: oh.turns, value, source: x.id });
      return;
    }
    if (!oh.save) {
      if (Math.random() < (oh.chance || 1)) k.status(p, oh.type, { turns: oh.turns, value, source: x.id });
      return;
    }
    if (k.immune(p, oh.type)) { k.status(p, oh.type, { turns: oh.turns, value, source: x.id }); return; } // avisa que no le afecta
    const ok = k.save(x, oh.save, { label: sk.name, dcMod: sk.dcMod, resist: sk.resist, fail: sk.fail });
    if (!ok) k.status(p, oh.type, { turns: oh.turns, value, source: x.id, quiet: !!sk.fail });
  }

  function stealCoins(x, k) {
    if (!A.Currency || x.stolen) return;
    const have = A.Currency.toCopper();
    if (have <= 0) return;
    const base = A.Balance && A.Balance.Economy && A.Balance.Economy.coinBase ? A.Balance.Economy.coinBase(x.tier || 1) : 3;
    const amount = Math.min(have, Math.max(1, Math.round(base * 3)));
    A.Currency.pay(amount);
    x.stolen = amount;
    x.stolenFrom = A.State.hidOf ? A.State.hidOf(A.State.player) : null; // v3.0: en grupo, se lo devuelve al que robó
    const words = A.Narrator ? A.Narrator.coinsInWords(amount) : `${amount} de cobre`;
    k.log('enemy', {
      text: `${x.displayName} te robó ${words}.`,
      fx: { kind: 'status', target: 'player', effect: 'steal' },
      say: { text: fill(`{E} se guarda ${words} tuyas. Si lo vencés, las recuperás.`, x), tone: 'bad' },
    });
  }

  const ACTS = {
    strike(sk, x, k) {
      k.strike(x, {
        atkMod: sk.atk || 0, mult: sk.mult || 1, pierce: !!sk.pierce, noTags: !!sk.onHit, skill: sk.id, label: sk.name,
        say: strikeSay(sk, x),
        onHit: (victim, info) => afterHit(sk, x, k, victim, info),
      });
    },

    multi(sk, x, k) {
      k.log('enemy', { text: `${x.displayName} usa ${sk.name}.`, fx: { kind: 'note', actor: k.fxKey(x), skill: sk.id }, say: { text: fill(sk.use, x), tone: 'bad' } });
      for (let i = 0; i < (sk.hits || 2); i++) {
        if (x.hp <= 0 || A.State.player.hp <= 0) break;
        k.strike(x, { atkMod: sk.atk || 0, skill: sk.id });
      }
    },

    sweep(sk, x, k) {
      const p = A.State.player;
      const petUp = p.pet && p.pet.health > 0;
      k.log('enemy', { text: `${x.displayName} usa ${sk.name}.`, fx: { kind: 'note', actor: k.fxKey(x), skill: sk.id }, say: { text: fill(sk.use, x), tone: 'bad' } });
      k.strike(x, { forcePlayer: true, mult: petUp ? 1 : 1.25, skill: sk.id });
      if (petUp && x.hp > 0 && p.hp > 0 && p.pet.health > 0) k.strike(x, { forcePet: true, skill: sk.id });
    },

    breath(sk, x, k) { areaHit(sk, x, k, { element: sk.element, status: sk.status, turns: sk.turns, half: true }); },

    quake(sk, x, k) { areaHit(sk, x, k, { element: null, status: sk.status, turns: sk.turns, half: false }); },

    bolt(sk, x, k) {
      const b = sk.bolt || boltKind(x);
      const p = A.State.player;
      k.log('enemy', { text: `${x.displayName} lanza un hechizo.`, fx: { kind: 'cast', actor: k.fxKey(x), element: b.element, skill: sk.id }, say: { text: fill(b.use, x), tone: 'bad' } });
      const ok = k.save(x, sk.save, { label: sk.name, resist: '', fail: '' });
      const base = k.rollDamage(x, { mult: sk.mult || 1 });
      const armor = Math.floor((k.playerStats().armor || 0) / 2);
      const dmg = Math.max(1, (ok ? Math.floor(base / 2) : base) - armor);
      const got = k.hurtPlayer(x, dmg, { element: b.element, say: ok ? 'Desviás parte del hechizo: {d} de daño.' : b.fail });
      if (!ok && got > 0 && p.hp > 0 && b.status && Math.random() < 0.35) k.status(p, b.status, { turns: b.turns, value: valueFor(b.status, x.tier), source: x.id });
    },

    debuff(sk, x, k) {
      const p = A.State.player;
      k.log('enemy', { text: `${x.displayName} usa ${sk.name}.`, fx: { kind: 'cast', actor: k.fxKey(x), skill: sk.id }, say: { text: fill(sk.use, x), tone: 'bad' } });
      const value = valueFor(sk.status, x.tier);
      if (k.immune(p, sk.status)) { k.status(p, sk.status, { turns: sk.turns, value, source: x.id }); return; }
      const ok = k.save(x, sk.save, { label: sk.name, dcMod: sk.dcMod, resist: sk.resist, fail: sk.fail });
      if (!ok) k.status(p, sk.status, { turns: sk.turns, value, source: x.id, quiet: !!sk.fail });
    },

    heal(sk, x, k) {
      const n = Math.max(1, Math.round(x.maxHp * (sk.amount || 0.25)));
      k.healEnemy(x, n, { say: sk.say || healLine(x), cast: true, skill: sk.id });
    },

    guard(sk, x, k) {
      x.effects = x.effects || [];
      const old = x.effects.find((e) => e.type === 'guard');
      if (old) old.turns = Math.max(old.turns, sk.turns || 2);
      else x.effects.push({ type: 'guard', turns: sk.turns || 2, value: sk.value || 3, source: sk.id });
      k.log('enemy', { text: `${x.displayName} se pone en guardia (+${sk.value || 3} de defensa).`, fx: { kind: 'status', target: k.fxKey(x), effect: 'guard', skill: sk.id }, say: { text: fill(guardLine(x), x), tone: 'bad' } });
      // y ataca igual
      if (A.State.player.hp > 0) k.strike(x, { skill: sk.id });
    },

    rally(sk, x, k) {
      const group = k.alive();
      const alone = group.length <= 1;
      group.forEach((e, i) => {
        e.effects = e.effects || [];
        const old = e.effects.find((f) => f.type === 'rally');
        if (old) old.turns = Math.max(old.turns, sk.turns || 3);
        else e.effects.push({ type: 'rally', turns: sk.turns || 3, value: sk.value || 1, source: sk.id });
        k.log('enemy', {
          text: `${e.displayName} se envalentona (+1 de precisión y daño).`,
          fx: { kind: 'status', target: k.fxKey(e), effect: 'rally', skill: i === 0 ? sk.id : undefined, skillOn: i === 0 ? k.fxKey(x) : undefined },
          say: i === 0 ? { text: fill(alone ? sk.alone : sk.use, x), tone: 'bad' } : { text: '', tone: 'bad' },
        });
      });
    },

    summon(sk, x, k) {
      const id = SUMMONS[x.id];
      const inst = id ? k.summon(x, id) : null;
      if (!inst) return;
      const data = A.Data.getById('enemies', id);
      const fem = A.Narrator && A.Narrator.isFem ? A.Narrator.isFem(id) : false;
      const s = `${fem ? 'una' : 'un'} ${(data ? data.name : inst.name).replace(/^./, (ch) => ch.toLowerCase())}`;
      k.log('enemy', {
        text: `${x.displayName} invoca a ${inst.displayName}.`,
        fx: { kind: 'summon', actor: k.fxKey(x), target: k.fxKey(inst) },
        say: { text: fill(SUMMON_LINES[x.id] || '{E} llama a {s} para que lo ayude.', x, { s }), tone: 'bad' },
      });
    },
  };

  /** Aliento o temblor: a vos (con tirada) y a tu mascota. v3.0: en grupo, a cada héroe con su mascota. */
  function areaHit(sk, x, k, o) {
    k.log('enemy', { text: `${x.displayName} usa ${sk.name}.`, fx: { kind: 'cast', actor: k.fxKey(x), element: o.element || undefined, skill: sk.id }, say: { text: fill(sk.use, x), tone: 'bad' } });
    const base = k.rollDamage(x, { mult: sk.mult || 1 });
    const value = valueFor(o.status, x.tier);
    const hitOne = () => {
      const p = A.State.player;
      const pet = p.pet && p.pet.health > 0 ? p.pet : null;
      if (x.hp <= 0 || p.hp <= 0) return;
      // Vos
      const ok = k.save(x, sk.save, { label: sk.name, resist: o.half ? '' : sk.resist, fail: '' });
      if (ok && !o.half) {
        // el temblor no te alcanza
      } else {
        const armor = k.playerStats().armor || 0;
        const raw = ok ? Math.floor(base / 2) : base;
        const dmg = Math.max(1, raw - (o.half ? Math.floor(armor / 2) : armor));
        const got = k.hurtPlayer(x, dmg, { element: o.element, say: ok ? sk.resist : sk.fail });
        if (!ok && got > 0 && p.hp > 0 && o.status && (!o.half || Math.random() < 0.5)) k.status(p, o.status, { turns: o.turns, value, source: x.id });
      }
      // Tu mascota (sin tirada: la mitad de las veces recibe la mitad)
      if (pet && pet.health > 0 && p.hp > 0) {
        const lucky = Math.random() < 0.5;
        const raw = lucky && o.half ? Math.floor(base / 2) : base;
        if (lucky && !o.half) return;
        const dmg = Math.max(1, raw - (o.half ? Math.floor((pet.armor || 0) / 2) : pet.armor || 0));
        k.hurtPet(x, dmg, { element: o.element, say: sk.pet });
        if (!lucky && pet.health > 0 && o.status) k.status(pet, o.status, { turns: o.turns, value, source: x.id });
      }
    };
    if (k.forEachHero) k.forEachHero(hitOne);
    else hitOne();
  }

  // ============================================================
  // Mascotas: usan las activas de su especie a tu favor
  // ============================================================

  const PET_ACTS = ['strike', 'multi', 'breath', 'quake', 'bolt', 'debuff', 'heal', 'guard', 'rally'];

  function petTurn(c, pet, target) {
    const k = kit();
    if (!k || !pet || pet.health <= 0 || !target) return false;
    if (pet.food != null && pet.food <= 0) return false; // v3.9: con hambre no usa sus habilidades
    pet._turns = (pet._turns || 0) + 1;
    tickCds(pet);
    const opts = activesOf(pet).filter((sk) => PET_ACTS.includes(sk.act) && !sk.steal && ready(pet, sk)).filter((sk) => {
      if (sk.when === 'hurt' || sk.act === 'heal') return hurt(pet);
      if (sk.act === 'guard') return !(pet.effects || []).some((e) => e.type === 'guard');
      if (sk.act === 'debuff') return !(target.effects || []).some((e) => e.type === sk.status) && !immune(target, sk.status);
      return true;
    });
    if (!opts.length || Math.random() >= USE_CHANCE.pet) return false;
    const sk = opts[Math.floor(Math.random() * opts.length)];
    markUsed(pet, sk);
    PET[sk.act](sk, pet, target, k);
    return true;
  }

  function petStatusOn(t, type, turns, tier, k, source) {
    if (!type || !t || t.hp <= 0) return;
    k.status(t, type, { turns: type === 'stun' && t.category === 'boss' ? 1 : turns, value: valueFor(type, tier), source });
  }

  const PET = {
    strike(sk, pet, t, k) {
      const tier = (speciesOf(pet) || {}).tier || 1;
      k.petStrike(pet, t, {
        atkMod: sk.atk || 0, mult: sk.mult || 1, pierce: !!sk.pierce, skill: sk.id,
        say: (kind, info) => {
          if (kind === 'hit') {
            if (sk.own) return { text: fill(sk.own, t, { d: info.dmg, e: noun(t) }), tone: info.crit ? 'crit' : 'good' };
            return { text: `${cap(noun(pet))} usa ${sk.name.toLowerCase()} contra ${noun(t)}: ${info.dmg} de daño${info.crit ? ', ¡de lleno!' : '.'}`, tone: info.crit ? 'crit' : 'good' };
          }
          if (kind === 'miss') return { text: `${cap(noun(pet))} intenta ${sk.name.toLowerCase()}, pero ${noun(t)} lo esquiva.`, tone: 'neutral' };
          return null;
        },
        onHit: (info) => {
          if (sk.drain && info.dmg > 0) k.healPet(Math.round(info.dmg * sk.drain));
          const oh = sk.onHit;
          if (oh && t.hp > 0 && Math.random() < (oh.save ? 0.5 : oh.chance || 1)) petStatusOn(t, oh.type, oh.turns, tier, k, sk.id);
        },
      });
    },
    multi(sk, pet, t, k) {
      k.log('pet', { text: `${pet.name} usa ${sk.name}.`, fx: { kind: 'note', actor: 'pet', skill: sk.id }, say: { text: fill(sk.ownUse || '{P} ataca dos veces seguidas.', null), tone: 'good' } });
      for (let i = 0; i < (sk.hits || 2); i++) {
        const tt = t.hp > 0 ? t : k.alive()[0];
        if (!tt) break;
        k.petStrike(pet, tt, { atkMod: sk.atk || 0, skill: sk.id });
      }
    },
    breath(sk, pet, t, k) { petArea(sk, pet, k, true); },
    quake(sk, pet, t, k) { petArea(sk, pet, k, false); },
    bolt(sk, pet, t, k) {
      const b = sk.bolt || boltKind(speciesOf(pet) || {});
      const tier = (speciesOf(pet) || {}).tier || 1;
      const dmg = Math.max(1, k.rollPetDamage(pet, 1.1) - Math.floor((t.armor || 0) / 2));
      k.hurtEnemy(t, dmg, { actor: 'pet', element: b.element, say: fill(b.own, t, { d: dmg, e: noun(t) }) });
      if (t.hp > 0 && b.status && Math.random() < 0.5) petStatusOn(t, b.status, b.turns, tier, k, sk.id);
    },
    debuff(sk, pet, t, k) {
      const tier = (speciesOf(pet) || {}).tier || 1;
      k.log('pet', { text: `${pet.name} usa ${sk.name} contra ${t.displayName}.`, fx: { kind: 'cast', actor: 'pet', skill: sk.id }, say: { text: `${cap(noun(pet))} usa ${sk.name.toLowerCase()} contra ${noun(t)}.`, tone: 'good' } });
      if (Math.random() < 0.5) petStatusOn(t, sk.status, sk.turns, tier, k, sk.id);
      else k.log('pet', { text: `${t.displayName} resiste.`, fx: { kind: 'note' }, say: { text: `${cap(noun(t))} lo resiste.`, tone: 'neutral' } });
    },
    heal(sk, pet, t, k) {
      const line = sk.id === 'merienda' ? 'se sienta a comer un brote de bambú y recupera {n} de vida.' : 'se lame las heridas y recupera {n} de vida.';
      k.healPet(Math.max(1, Math.round(pet.maxHealth * (sk.amount || 0.25))), { say: `${cap(noun(pet))} ${line}` });
    },
    guard(sk, pet, t, k) {
      pet.effects = pet.effects || [];
      pet.effects.push({ type: 'guard', turns: sk.turns || 2, value: sk.value || 3, source: sk.id });
      k.log('pet', { text: `${pet.name} se pone en guardia.`, fx: { kind: 'status', target: 'pet', effect: 'guard' }, say: { text: `${cap(noun(pet))} se cubre y espera el próximo golpe.`, tone: 'good' } });
    },
    rally(sk, pet, t, k) {
      // v3.2: en grupo anima a todos los héroes en pie (no solo a su dueño)
      const p = A.State.player;
      const all = (k.heroes ? k.heroes() : [p]).filter((h) => h && h.hp > 0);
      if (!all.includes(p)) all.unshift(p);
      for (const h of all) {
        h.effects = h.effects || [];
        const old = h.effects.find((e) => e.type === 'buff' && e.source === `pet_${sk.id}`);
        if (old) old.turns = Math.max(old.turns, sk.turns || 3);
        else h.effects.push({ type: 'buff', source: `pet_${sk.id}`, name: sk.name, stat: 'damage', mods: { precision: 1, damage: 1 }, turns: sk.turns || 3, value: 1 });
      }
      const group = all.length > 1;
      const also = group ? all.filter((h) => h !== p).map((h) => `hero:${A.State.hidOf(h)}`) : undefined;
      k.log('pet', {
        text: `${sk.name} de ${pet.name}: +1 de precisión y daño${group ? ' para todo el grupo' : ''}.`,
        fx: { kind: 'buff', target: 'player', also, label: sk.name, icon: 'arrow-up' },
        say: group
          ? { text: sk.id === 'aullido' ? `${cap(noun(pet))} aúlla y todo el grupo pega con más ganas.` : `${cap(noun(pet))} anima a todo el grupo: pegan con más ganas.`, tone: 'good' }
          : { text: sk.id === 'aullido' ? `${cap(noun(pet))} aúlla a tu lado: pegás con más ganas.` : `${cap(noun(pet))} te da ánimo: pegás con más ganas.`, tone: 'good' },
      });
    },
  };

  function petArea(sk, pet, k, half) {
    const tier = (speciesOf(pet) || {}).tier || 1;
    k.log('pet', { text: `${pet.name} usa ${sk.name}.`, fx: { kind: 'cast', actor: 'pet', element: sk.element, skill: sk.id }, say: { text: fill(sk.ownUse || `{P} usa ${sk.name.toLowerCase()}.`, null), tone: 'good' } });
    const base = k.rollPetDamage(pet, sk.mult || 1);
    for (const t of k.alive()) {
      const lucky = Math.random() < 0.5;
      if (lucky && !half) continue;
      const raw = lucky ? Math.floor(base / 2) : base;
      const dmg = Math.max(1, raw - (half ? Math.floor((t.armor || 0) / 2) : t.armor || 0));
      k.hurtEnemy(t, dmg, { actor: 'pet', element: sk.element || null, say: `${cap(noun(t))} recibe ${dmg} de daño.` });
      if (!lucky && t.hp > 0 && sk.status) petStatusOn(t, sk.status, sk.turns, tier, k, sk.id);
    }
  }

  A.Skills = {
    LIB, SUMMONS, STAT_NAME,
    get, info, all, idsOf, has, listFor,
    petDodge, petReactions, // v3.9
    statMods, damageMult, bonusDamage, immune, regenOf, lifesteal, poisonBoost,
    tailsOf, growTails, TAILS_MAX,
    dodgeHit, softenHit, reactions, tryRevive,
    saveDC, valueFor, fill, noun,
    enemyTurn, petTurn,
  };
})(window.Aventurs);
