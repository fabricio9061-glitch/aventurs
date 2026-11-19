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
    bandido: ['robar', 'curarse'],
    escarabajo_minero: ['caparazon', 'embestida'],
    sapo_gigante: ['venenoso', 'lengua'],
    grumete_pirata: ['escurridizo', 'robar'],
    contrabandista: ['hoja_envenenada', 'tierra_ojos'],
    loro_pirata: ['vuelo', 'robar'],

    // ---- Tier 4 ----
    fantasma: ['etereo', 'miedo'],
    diablillo: ['ignifugo', 'vuelo', 'hechizo'],
    arpia: ['vuelo', 'chillido'],
    hobgoblin: ['guardia', 'grito'],
    necrofago: ['no_muerto', 'infectar'],
    cangrejo: ['caparazon', 'agarre'],
    orco: ['furia', 'grito'],
    oso: ['furia', 'zarpazo', 'agarre'],
    hombre_lagarto: ['manada', 'mordida'],
    pirata: ['disparo', 'robar'],
    ahogado: ['no_muerto', 'agarre'],

    // ---- Tier 5 ----
    drow: ['escurridizo', 'hoja_envenenada', 'oscuridad'],
    sirena: ['encantar', 'agarre'],
    driade: ['espinas', 'encantar', 'curarse'],
    banshee: ['etereo', 'chillido', 'miedo'],
    salamandra: ['cuerpo_fuego', 'aliento_fuego'],
    osgo: ['furia', 'aturdir'],
    gargola: ['constructo', 'vuelo', 'picada'],
    ogro: ['furia', 'aturdir', 'pisoton'],
    momia: ['no_muerto', 'maldicion'],
    hada_traviesa: ['vuelo', 'polvo_sueno', 'robar'],
    polilla_onirica: ['vuelo', 'polvo_sueno'],
    ciervo_astral: ['embestida', 'curarse'],
    esqueleto_pirata: ['no_muerto', 'disparo'],
    contramaestre: ['grito', 'aturdir'],

    // ---- Tier 6 ----
    mago_oscuro: ['hechizo', 'maldicion', 'guardia'],
    nigromante: ['hechizo', 'drenar', 'invocar'],
    tiburon: ['sed_sangre', 'mordida'],
    licantropo: ['regeneracion', 'zarpazo', 'aullido'],
    minotauro: ['furia', 'embestida'],
    troll: ['regeneracion', 'aturdir'],
    ettin: ['doble', 'pisoton'],
    ent: ['espinas', 'agarre'],
    brightwing: ['vuelo', 'hechizo', 'polvo_sueno'],
    gusano_arena: ['agarre', 'pisoton'],
    pesadilla: ['etereo', 'miedo', 'embestida'],
    capitan_pirata: ['grito', 'disparo', 'invocar'],
    huargo: ['manada', 'mordida', 'derribo'],

    // ---- Tier 7 ----
    tentaculo: ['agarre', 'doble'],
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
    bruja: ['maldicion', 'hechizo', 'curarse'],
    centauro: ['disparo', 'embestida'],
    murcielago_vampiro: ['vuelo', 'beber_sangre'],
    siervo_sangre: ['no_muerto', 'sed_sangre', 'zarpazo'],

    // ---- Tier 8 ----
    aparicion: ['etereo', 'miedo', 'drenar'],
    fenix: ['cuerpo_fuego', 'renacer', 'aliento_fuego'],
    contemplador: ['hechizo', 'mirada', 'antimagia'],
    quimera: ['ignifugo', 'doble', 'aliento_fuego'],
    golem_lava: ['constructo', 'cuerpo_fuego', 'pisoton'],
    ciclope: ['furia', 'aturdir', 'pisoton'],
    cab_muerte: ['no_muerto', 'guardia', 'miedo'],
    dragon_joven: ['ignifugo', 'vuelo', 'zarpazo', 'aliento_fuego'],
    noble_vampira: ['sed_sangre', 'encantar', 'beber_sangre'],
    bestia_sangre: ['sed_sangre', 'zarpazo'],

    // ---- Tier 9 ----
    archimago: ['hechizo', 'antimagia', 'guardia'],
    lich: ['no_muerto', 'hechizo', 'maldicion', 'invocar'],
    senor_vampiro: ['no_muerto', 'beber_sangre', 'invocar'],
    demonio_mayor: ['cuerpo_fuego', 'aliento_fuego', 'miedo'],
    hidra: ['regeneracion', 'venenoso', 'doble'],
    draconido_salvaje: ['ignifugo', 'furia', 'aliento_fuego'],
    guiverno: ['vuelo', 'picadura', 'picada'],

    // ---- Tier 10 ----
    balrog: ['cuerpo_fuego', 'barrido', 'aliento_fuego', 'miedo'],
    dragon_anciano: ['ignifugo', 'aliento_fuego', 'rugido', 'barrido'],
    kraken: ['agarre', 'nube_tinta', 'invocar'],
    alamuerte: ['vuelo', 'cuerpo_fuego', 'aliento_fuego', 'barrido', 'rugido'], // v3.4: más que el dragón anciano
    titan: ['aturdir', 'pisoton'],
    tarrasca: ['caparazon', 'regeneracion', 'mordida', 'barrido'],
  };

  const list = (A.Seed && A.Seed.enemies) || [];
  for (const e of list) {
    if (SKILLS[e.id] && !Array.isArray(e.skills)) e.skills = SKILLS[e.id].slice();
  }
  A.Seed.creatureSkills = SKILLS;
})(window.Aventurs);
