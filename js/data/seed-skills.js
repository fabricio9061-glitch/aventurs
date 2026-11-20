/* ============================================================
   Aventurs — Habilidades de cada criatura (v2.5)

   Qué pasivas y activas tiene cada especie (la biblioteca está en
   js/systems/skills.js). Se cargan sobre A.Seed.enemies[].skills;
   si en el editor le cambiás las habilidades a una criatura, manda
   lo del editor.
   ============================================================ */

(function (A) {
  'use strict';

  const SKILLS = {
    // ---- Tier 1 ----
    cuervo: ['vuelo', 'picotazo'],
    murcielago: ['vuelo', 'mordida'],
    rata: ['escurridizo', 'infectar'],
    buho: ['vuelo', 'picotazo'],
    arana: ['venenoso', 'telarana'],
    gato: ['escurridizo', 'zarpazo'],
    zorro: ['escurridizo', 'mordida'],
    perro_salvaje: ['manada', 'mordida'],

    // ---- Tier 2 ----
    serpiente: ['venenoso', 'colmillos_veneno'],
    halcon: ['vuelo', 'picada'],
    kobold: ['manada', 'tierra_ojos'],
    rata_gigante: ['furia', 'infectar'],
    esqueleto: ['no_muerto', 'guardia'],
    goblin: ['escurridizo', 'robar'],
    lobo: ['manada', 'mordida', 'derribo', 'aullido'],
    jabali: ['furia', 'embestida'],
    zombi: ['no_muerto', 'infectar', 'agarre'],
    slime: ['gelatinoso', 'acido'],
    tortuga: ['caparazon', 'guardia'],

    // ---- Tier 3 ----
    aguila: ['vuelo', 'picada', 'picotazo'],
    escorpion: ['venenoso', 'picadura', 'agarre'],
    bandido: ['emboscada', 'robar', 'curarse'],
    escarabajo_minero: ['caparazon', 'embestida'],
    sapo_gigante: ['venenoso', 'lengua'],
    grumete_pirata: ['escurridizo', 'robar'],
    contrabandista: ['emboscada', 'hoja_envenenada', 'tierra_ojos'],
    loro_pirata: ['vuelo', 'robar'],

    // ---- Tier 4 ----
    fantasma: ['etereo', 'miedo'],
    diablillo: ['ignifugo', 'vuelo', 'hechizo'],
    arpia: ['vuelo', 'chillido'],
    hobgoblin: ['valiente', 'guardia', 'grito'],
    necrofago: ['no_muerto', 'infectar'],
    cangrejo: ['caparazon', 'agarre'],
    orco: ['furia', 'grito'],
    oso: ['furia', 'zarpazo', 'agarre'],
    hombre_lagarto: ['manada', 'mordida'],
    pirata: ['lobo_mar', 'disparo', 'robar'],
    ahogado: ['no_muerto', 'agarre'],

    // ---- Tier 5 ----
    drow: ['escurridizo', 'hoja_envenenada', 'oscuridad'],
    sirena: ['escurridizo', 'encantar', 'agarre'],
    driade: ['espinas', 'encantar', 'curarse'],
    banshee: ['etereo', 'chillido', 'miedo'],
    salamandra: ['cuerpo_fuego', 'aliento_fuego'],
    osgo: ['furia', 'aturdir'],
    gargola: ['constructo', 'vuelo', 'picada'],
    ogro: ['gigante', 'furia', 'aturdir', 'pisoton'],
    momia: ['no_muerto', 'maldicion'],
    hada_traviesa: ['vuelo', 'polvo_sueno', 'robar'],
    polilla_onirica: ['vuelo', 'polvo_sueno'],
    ciervo_astral: ['pureza', 'embestida', 'destello', 'curarse'],
    esqueleto_pirata: ['no_muerto', 'disparo'],
    contramaestre: ['lobo_mar', 'grito', 'aturdir'],

    // ---- Tier 6 ----
    mago_oscuro: ['mente_arcana', 'hechizo', 'maldicion', 'guardia'],
    nigromante: ['mente_arcana', 'hechizo', 'drenar', 'invocar'],
    tiburon: ['sed_sangre', 'emboscada', 'mordida'],
    licantropo: ['regeneracion', 'zarpazo', 'aullido'],
    minotauro: ['furia', 'embestida'],
    troll: ['regeneracion', 'aturdir'],
    ettin: ['gigante', 'doble', 'pisoton'],
    ent: ['gigante', 'espinas', 'agarre'],
    brightwing: ['vuelo', 'hechizo', 'polvo_sueno'],
    gusano_arena: ['emboscada', 'tragar', 'pisoton'],
    pesadilla: ['etereo', 'miedo', 'embestida'],
    unicornio: ['pureza', 'embestida', 'destello', 'curarse'], // v3.7: carga con el cuerno, se cura y es difícil de tocar
    yeti: ['cuerpo_hielo', 'ventisca', 'rugido', 'zarpazo'],
    leviatan: ['gigante', 'ola', 'tragar', 'barrido'],
    leon: ['manada', 'valiente', 'rugido', 'zarpazo'],
    panda: ['piel_gruesa', 'derribo', 'zarpazo', 'merienda'],
    profundo: ['manada', 'agarre', 'mordida'],
    grifo: ['vuelo', 'rafaga', 'picotazo', 'zarpazo'],
    kitsune: ['colas_zorro', 'escurridizo', 'fuego_zorro', 'encantar'], // v3.8: le crecen colas (de 1 a 9)
    kyubi: ['colas_zorro', 'ilusion', 'fuego_zorro', 'encantar', 'invocar'], // v3.8: la jefa, ya con nueve colas
    cthulhu: ['abismal', 'gigante', 'vision_abismo', 'agarre', 'invocar'],
    capitan_pirata: ['lobo_mar', 'grito', 'disparo', 'invocar'],
    huargo: ['manada', 'mordida', 'derribo'],

    // ---- Tier 7 ----
    tentaculo: ['escurridizo', 'agarre', 'doble'],
    medusa: ['venenoso', 'mirada', 'disparo'],
    espectro: ['etereo', 'drenar', 'miedo'],
    sucubo: ['vuelo', 'encantar', 'drenar'],
    elem_arcano: ['esencia', 'hechizo', 'guardia'],
    vampiro: ['no_muerto', 'sed_sangre', 'beber_sangre', 'encantar'],
    elem_fuego: ['cuerpo_fuego', 'esencia', 'aliento_fuego'],
    naga: ['venenoso', 'agarre'],
    elem_hielo: ['cuerpo_hielo', 'esencia', 'aliento_hielo'],
    manticora: ['vuelo', 'picadura', 'rugido'],
    serp_marina: ['venenoso', 'agarre', 'barrido'],
    golem: ['constructo', 'aturdir', 'pisoton'],
    bruja: ['mente_arcana', 'maldicion', 'hechizo', 'curarse'],
    centauro: ['valiente', 'disparo', 'embestida'],
    murcielago_vampiro: ['vuelo', 'beber_sangre'],
    siervo_sangre: ['no_muerto', 'sed_sangre', 'zarpazo'],

    // ---- Tier 8 ----
    aparicion: ['etereo', 'miedo', 'drenar'],
    fenix: ['cuerpo_fuego', 'renacer', 'aliento_fuego'],
    contemplador: ['mente_arcana', 'hechizo', 'mirada', 'antimagia'],
    quimera: ['ignifugo', 'doble', 'aliento_fuego'],
    golem_lava: ['constructo', 'cuerpo_fuego', 'pisoton'],
    ciclope: ['gigante', 'furia', 'aturdir', 'pisoton'],
    cab_muerte: ['no_muerto', 'guardia', 'miedo'],
    dragon_joven: ['ignifugo', 'vuelo', 'zarpazo', 'aliento_fuego'],
    noble_vampira: ['sed_sangre', 'encantar', 'beber_sangre'],
    bestia_sangre: ['sed_sangre', 'zarpazo'],

    // ---- Tier 9 ----
    archimago: ['ilusion', 'hechizo', 'antimagia'],
    lich: ['no_muerto', 'hechizo', 'maldicion', 'invocar'],
    senor_vampiro: ['no_muerto', 'beber_sangre', 'invocar'],
    demonio_mayor: ['cuerpo_fuego', 'aliento_fuego', 'miedo'],
    hidra: ['regeneracion', 'venenoso', 'doble'],
    draconido_salvaje: ['ignifugo', 'furia', 'aliento_fuego'],
    guiverno: ['vuelo', 'picadura', 'picada'],

    // ---- Tier 10 ----
    balrog: ['cuerpo_fuego', 'barrido', 'aliento_fuego', 'miedo'],
    dragon_anciano: ['ignifugo', 'aliento_fuego', 'rugido', 'barrido'],
    kraken: ['gigante', 'agarre', 'nube_tinta', 'ola', 'invocar'],
    alamuerte: ['vuelo', 'cuerpo_fuego', 'aliento_fuego', 'barrido', 'rugido'], // v3.4: más que el dragón anciano
    titan: ['gigante', 'aguante', 'aturdir', 'pisoton'],
    tarrasca: ['caparazon', 'regeneracion', 'mordida', 'barrido'],
  };

  const list = (A.Seed && A.Seed.enemies) || [];
  for (const e of list) {
    if (SKILLS[e.id] && !Array.isArray(e.skills)) e.skills = SKILLS[e.id].slice();
  }
  A.Seed.creatureSkills = SKILLS;
})(window.Aventurs);
