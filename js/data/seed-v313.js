/* ============================================================
   Aventurs — v3.13: las escuelas de raza (del dossier, secciones 7 a 9)

   Cada raza tiene su escuela con tres poderes:
     · nacimiento (nivel 1): el hechizo o la técnica con la que ya nace
     · nivel 5: lo enseña su maestro (se paga, como cualquier hechizo)
     · nivel 9: el maestro te pone una prueba (una misión); al volver, te lo enseña
   - 12 escuelas de magia (6 híbridos y 6 magos): hechizos que solo aprende esa raza.
     Los de los híbridos son más chicos (de a uno, o de área pero flojos); los de
     los magos, más grandes. Ninguno cuesta 0 de maná.
   - 6 disciplinas de guerrero: técnicas sin maná que ocupan tu ataque del turno y
     tienen espera (nunca se suman al Golpe fuerte). Sus números están en
     js/systems/techniques.js (DISC).
   - Los maestros viven en pueblos a los que se llega antes del nivel 5, y cada
     jugador ve solo al de su raza.
   - Los hechizos de daño crecen con vos (bandDice: el dado por tramo de nivel
     1-4 · 5-8 · 9-12 · 13-16 · 17+), además del poder mágico de siempre.
   Nada de lo que ya tenías cambia: los pergaminos, los hechizos comunes y lo
   aprendido siguen igual (las escuelas son aparte).
   Se carga después de seed-v312.js.
   ============================================================ */

(function (A) {
  'use strict';

  const S = A.Seed || (A.Seed = {});
  for (const k of ['spells', 'npcs', 'quests']) S[k] = S[k] || [];
  const SRC = 'v313';
  const byId = (list, id) => (list || []).find((x) => x && x.id === id);
  const spell = (o) => { if (!byId(S.spells, o.id)) S.spells.push(Object.assign({ icon: '', _source: SRC }, o)); };
  const npc = (o) => { if (!byId(S.npcs, o.id)) S.npcs.push(Object.assign({ icon: '', sprite: '', role: 'master', sells: [], services: {}, _source: SRC }, o)); };
  const quest = (o) => { if (!byId(S.quests, o.id)) S.quests.push(Object.assign({ school: true, turnIn: true, _source: SRC }, o)); };

  // ---------------------------------------------------------------
  // 1) Las 18 escuelas
  //    kind: 'magic' (hechizos) o 'discipline' (técnicas de guerrero)
  // ---------------------------------------------------------------
  S.schools = [
    // Híbridos
    { race: 'humano', kind: 'magic', name: 'Arcanismo adaptable', master: 'npc_maestro_humano', birth: 'dardo_arcano', r5: 'sello_duelo', r9: 'resonancia_arcana', trial: 'escuela_humano',
      about: 'Marcás a tu rival y le cargás magia a tus propios golpes. Tus marcas son tuyas: ni tu mascota ni tus compañeros las usan.' },
    { race: 'elfo', kind: 'magic', name: 'Magia lunar', master: 'npc_maestra_elfo', birth: 'flecha_lunar', r5: 'velo_luna', r9: 'lluvia_lunar', trial: 'escuela_elfo',
      about: 'Luz de luna, puntería y leer al enemigo: encandilás, esquivás y encontrás dónde pegar.' },
    { race: 'mediano', kind: 'magic', name: 'Magia de fortuna', master: 'npc_maestra_mediano', birth: 'dardo_venenoso', r5: 'paso_afortunado', r9: 'destino_favorable', trial: 'escuela_mediano',
      about: 'Trucos y buena suerte: el golpe que te iba a dar pasa de largo y los dados te sonríen.' },
    { race: 'draconido', kind: 'magic', name: 'Magia dracónica', master: 'npc_maestro_draconido', birth: 'aliento_de_brasas', r5: 'escamas_ardientes', r9: 'furia_dragon', trial: 'escuela_draconido',
      about: 'Fuego a todos y escamas que queman al que te toca. Las quemaduras no se suman: se renuevan.' },
    { race: 'vampiro', kind: 'magic', name: 'Hemomancia', master: 'npc_maestra_vampiro', birth: 'toque_vampirico', r5: 'pacto_carmesi', r9: 'niebla_sangre', trial: 'escuela_vampiro',
      about: 'Tu sangre es tu magia: llamás al Frenesí cuando querés y te curás con la vida de los demás (solo a vos).' },
    { race: 'elfo_oscuro', kind: 'magic', name: 'Magia sombría', master: 'npc_maestro_elfo_oscuro', birth: 'manto_oscuridad', r5: 'maldicion_penumbra', r9: 'eclipse_arcano', trial: 'escuela_elfo_oscuro',
      about: 'Sombras que debilitan: tus maldiciones hacen que pegues más fácil, y tu Cazador de sombras las aprovecha.' },
    // Magos
    { race: 'gnomo', kind: 'magic', name: 'Tecnomancia eléctrica', master: 'npc_maestra_gnomo', birth: 'descarga', r5: 'circuito_arcano', r9: 'tormenta_conductora', trial: 'escuela_gnomo',
      about: 'Electricidad bien aprovechada: lo que ya está electrizado te devuelve maná, y los rayos saltan de uno a otro.' },
    { race: 'alienigena', kind: 'magic', name: 'Psiónica y plasma', master: 'npc_maestro_alienigena', birth: 'rayo_de_plasma', r5: 'campo_gravitatorio', r9: 'senal_orbital', trial: 'escuela_alienigena',
      about: 'La mente aplasta y la nave marca a todos para el grupo. La nave sigue siendo pasiva: no te da un turno de más.' },
    { race: 'infernal', kind: 'magic', name: 'Magia infernal', master: 'npc_maestra_infernal', birth: 'ascua_infernal', r5: 'sello_cenizas', r9: 'lluvia_azufre', trial: 'escuela_infernal',
      about: 'El fuego más fuerte: marcás con ceniza y hacés explotar lo que ya se está quemando.' },
    { race: 'angel', kind: 'magic', name: 'Magia celestial', master: 'npc_maestra_angel', birth: 'luz_sagrada', r5: 'voto_protector', r9: 'santuario_luminoso', trial: 'escuela_angel',
      about: 'Proteger a los tuyos: armadura y una curación suave para todo el grupo. Dos ángeles no la suman: vale la más fuerte.' },
    { race: 'hada', kind: 'magic', name: 'Magia feérica', master: 'npc_maestra_hada', birth: 'chispas_de_hada', r5: 'bruma_encantada', r9: 'sueno_compartido', trial: 'escuela_hada',
      about: 'Engaños y sueños: marear y dormir a los enemigos. Los jefes no se duermen con tus trucos.' },
    { race: 'driade', kind: 'magic', name: 'Magia natural', master: 'npc_maestra_driade', birth: 'enredadera', r5: 'raices_protectoras', r9: 'bosque_despierto', trial: 'escuela_driade',
      about: 'Raíces y espinas: te defendés devolviendo el daño y el bosque atrapa a tus enemigos.' },
    // Guerreros (las técnicas, en js/systems/techniques.js)
    { race: 'enano', kind: 'discipline', name: 'Bastión pétreo', master: 'npc_maestro_enano', birth: 'guardia_piedra', r5: 'muralla_piedra', r9: 'fortaleza_ancestral', trial: 'escuela_enano',
      about: 'Ser la pared del grupo: más armadura para vos y tus compañeros, y aguantar lo que otros no aguantan.' },
    { race: 'orco', kind: 'discipline', name: 'Furia de guerra', master: 'npc_maestro_orco', birth: 'rugido_guerra', r5: 'clamor_salvaje', r9: 'horda_imparable', trial: 'escuela_orco',
      about: 'Gritar, asustar y pegar dos veces: la guerra como la entiende un orco.' },
    { race: 'robot', kind: 'discipline', name: 'Tecnología de combate', master: 'npc_maestro_robot', birth: 'pulso_interferencia', r5: 'campo_electromagnetico', r9: 'protocolo_asalto', trial: 'escuela_robot',
      about: 'Un campo que electriza al que te toca y golpes calculados que casi no fallan.' },
    { race: 'goliat', kind: 'discipline', name: 'Fuerza titánica', master: 'npc_maestra_goliat', birth: 'barrido_colosal', r5: 'onda_impacto', r9: 'ruptura_terreno', trial: 'escuela_goliat',
      about: 'Golpes que hacen temblar el suelo y voltean a todos los que tenés enfrente.' },
    { race: 'minotauro', kind: 'discipline', name: 'Embestidas', master: 'npc_maestro_minotauro', birth: 'cornada_brutal', r5: 'rompelineas', r9: 'tormenta_cuernos', trial: 'escuela_minotauro',
      about: 'Cargar a través de la fila enemiga y repartir cornadas a quien se cruce.' },
    { race: 'licantropo', kind: 'discipline', name: 'Artes de manada', master: 'npc_maestro_licantropo', birth: 'aullido_manada', r5: 'rastro_presa', r9: 'caceria_lunar', trial: 'escuela_licantropo',
      about: 'Elegir una presa, hacerla sangrar y no soltarla. Tu marca de caza es tuya.' },
  ];

  // ---------------------------------------------------------------
  // 2) Los 24 hechizos de escuela
  //    racial: la raza · schoolRank: el nivel en que se aprende (5 o 9)
  //    bandDice: el dado por tramo de nivel (1-4 · 5-8 · 9-12 · 13-16 · 17+)
  //    Lo que no es daño común lo hace js/systems/schools.js:
  //      seal (sello personal), echo (eco en tus golpes), buff (mejora tuya),
  //      partyBuff / partyHeal (a todo el grupo, sin sumarse entre ángeles),
  //      expose / curse / stagger (a cada uno que alcanza), chain (dado de los demás),
  //      detonate (hace explotar un estado), refund (maná de vuelta), drainPct (vida de vuelta),
  //      pact (Frenesí ya, pagando vida), sleep (dormir a los que no son jefes)
  //    quick: rápido: no gasta tu turno (después atacás o lanzás otro), uno por turno
  // ---------------------------------------------------------------
  const R = (race, rank, o) => spell(Object.assign({ racial: race, schoolRank: rank, tier: rank }, o, o.quick ? { description: `${o.description} Es rápido: no gasta tu turno (uno por turno).` } : {}));

  // Humano · Arcanismo adaptable
  R('humano', 5, { id: 'sello_duelo', name: 'Sello de duelo', iconName: 'target', damage: '1d6', manaCost: 5, school: 'arcane', sure: true, cooldown: 4,
    seal: { turns: 3, prec: 2, dmg: [2, 2, 3, 4, 5] },
    description: 'Un sello arcano que no falla: pega poco, pero por 3 turnos tus golpes con arma le pegan con +2 de precisión y más daño. Es tuyo: ni tu mascota ni tus compañeros lo usan.' });
  R('humano', 9, { id: 'resonancia_arcana', quick: true, name: 'Resonancia arcana', iconName: 'spark', manaCost: 7, school: 'arcane', cooldown: 5,
    echo: { turns: 4, dice: ['1d6', '1d6', '1d8', '1d10', '2d6'] },
    description: 'Le cargás magia a tu arma: por 4 turnos, cada golpe con arma que acierta suelta un eco arcano que le hace daño de más al mismo blanco.' });

  // Elfo · Magia lunar
  R('elfo', 5, { id: 'velo_luna', quick: true, name: 'Velo de luna', iconName: 'moon', manaCost: 5, school: 'light', cooldown: 5,
    buff: { turns: 3, stat: 'defense', mods: { defense: [2, 2, 2, 3, 3], precision: [1, 1, 1, 2, 2] } },
    description: 'Un velo de luz plateada te cubre por 3 turnos: esquivás mejor y apuntás mejor.' });
  R('elfo', 9, { id: 'lluvia_lunar', name: 'Lluvia lunar', iconName: 'stars', damage: '1d6', bandDice: ['1d6', '1d6', '1d6', '2d6', '2d8'], manaCost: 9, school: 'light', area: true, cooldown: 4,
    expose: { value: 2, turns: 2 },
    description: 'Flechas de luz caen sobre todos los enemigos. A los que alcanza les ves los puntos débiles: quedan expuestos (−2 de defensa) 2 turnos, para vos y para tu grupo.' });

  // Mediano · Magia de fortuna
  R('mediano', 5, { id: 'paso_afortunado', quick: true, name: 'Paso afortunado', iconName: 'clover', manaCost: 4, school: 'nature', cooldown: 6,
    buff: { turns: 2, stat: 'defense', mods: { dodgeNext: 1, defense: [1, 1, 1, 2, 2] } },
    description: 'El próximo ataque que te apunten falla seguro (si llega antes de tu próximo turno), y por 2 turnos esquivás mejor.' });
  R('mediano', 9, { id: 'destino_favorable', quick: true, name: 'Destino favorable', iconName: 'dice', manaCost: 6, school: 'nature', cooldown: 7,
    buff: { turns: 1, stat: 'precision', mods: { advantage: 1 } },
    description: 'En este turno y en el próximo, cada vez que atacás (con arma o con hechizo) tirás dos dados y te quedás con el mejor.' });

  // Dracónido · Magia dracónica
  R('draconido', 5, { id: 'escamas_ardientes', quick: true, name: 'Escamas ardientes', iconName: 'shield', manaCost: 5, school: 'fire', cooldown: 4,
    buff: { turns: 3, stat: 'armor', mods: { armor: [2, 2, 3, 3, 4] }, resist: ['fire'], touch: { status: 'fire', chance: 0.4, turns: 2, value: [1, 2, 2, 3, 4] } },
    description: 'Tus escamas se encienden por 3 turnos: más armadura, el fuego no te toca y el que te pega de cerca puede prenderse fuego.' });
  R('draconido', 9, { id: 'furia_dragon', name: 'Furia de dragón', iconName: 'breath', damage: '2d6', bandDice: ['2d6', '2d6', '2d6', '3d6', '3d8'], manaCost: 11, school: 'fire', area: true, cooldown: 4,
    statusEffect: { type: 'fire', chance: 0.4, turns: 2, value: 2 },
    description: 'Rugís y escupís fuego como un dragón sobre todos los enemigos. La quemadura no se suma a la que ya tenían: la renueva.' });

  // Vampiro · Hemomancia
  R('vampiro', 5, { id: 'pacto_carmesi', quick: true, name: 'Pacto carmesí', iconName: 'bleed', manaCost: 3, school: 'shadow', cooldown: 6,
    pact: { hpPct: 0.06, extra: 1 },
    description: 'Te abrís una herida (perdés el 6% de tu vida) y la sangre te llama: el Frenesí vampírico empieza en tu próximo turno, sin juntar las tres gotas, y dura un turno más (3).' });
  R('vampiro', 9, { id: 'niebla_sangre', name: 'Niebla de sangre', iconName: 'bleed', damage: '1d6', bandDice: ['1d6', '1d6', '1d6', '2d6', '2d8'], manaCost: 10, school: 'shadow', area: true, cooldown: 4,
    drainPct: 0.3,
    description: 'Una niebla roja envuelve a todos los enemigos y les saca sangre: recuperás el 30% de todo el daño que hace. Solo te cura a vos.' });

  // Elfo oscuro · Magia sombría
  R('elfo_oscuro', 5, { id: 'maldicion_penumbra', quick: true, name: 'Maldición de penumbra', iconName: 'skull', manaCost: 4, school: 'shadow', cooldown: 4,
    hex: { amount: [1, 1, 1, 2, 2], turns: 2 },
    description: 'Una sombra se le pega a tu blanco y lo maldice 2 turnos: pega peor y le pegás más fácil (−1 de precisión y de defensa; −2 desde el nivel 13). Tu Cazador de sombras lo aprovecha.' });
  R('elfo_oscuro', 9, { id: 'eclipse_arcano', name: 'Eclipse arcano', iconName: 'blind', damage: '2d6', bandDice: ['2d6', '2d6', '2d6', '3d6', '3d8'], manaCost: 10, school: 'shadow', area: true, cooldown: 4,
    curse: { amount: 1, turns: 2 },
    description: 'Una explosión de oscuridad sobre todos los enemigos: les hace daño y los maldice 2 turnos (−1 de precisión y de defensa).' });

  // Gnomo · Tecnomancia eléctrica
  R('gnomo', 5, { id: 'circuito_arcano', name: 'Circuito arcano', iconName: 'spark', damage: '2d6', bandDice: ['2d6', '2d6', '2d6', '3d6', '3d8'], manaCost: 5, school: 'arcane', cooldown: 2,
    statusEffect: { type: 'shock', chance: 0.35, turns: 2, value: 1 }, refund: { status: 'shock', mana: 3 },
    description: 'Una descarga que cierra el circuito: si el blanco ya estaba electrizado, te devuelve 3 de maná. A veces lo electriza.' });
  R('gnomo', 9, { id: 'tormenta_conductora', name: 'Tormenta conductora', iconName: 'storm', damage: '2d8', bandDice: ['2d8', '2d8', '2d8', '3d8', '4d8'], manaCost: 12, school: 'arcane', area: true, cooldown: 4,
    chain: ['1d8', '1d8', '1d8', '2d6', '2d8'], statusEffect: { type: 'shock', chance: 0.3, turns: 2, value: 1 },
    description: 'Un rayo que salta de criatura en criatura: tu blanco recibe el golpe grande y las demás, uno más chico. A veces los electriza.' });

  // Alienígena · Psiónica y plasma
  R('alienigena', 5, { id: 'campo_gravitatorio', name: 'Campo gravitatorio', iconName: 'arcane', damage: '1d6', bandDice: ['1d6', '1d6', '1d6', '2d6', '2d8'], manaCost: 8, school: 'arcane', area: true, cooldown: 4,
    statusEffect: { type: 'prone', chance: 0.4, turns: 1, value: 1 },
    description: 'Tu mente aplasta el aire sobre todos los enemigos: les hace daño y a algunos los tira al suelo (les cuesta defenderse).' });
  R('alienigena', 9, { id: 'senal_orbital', name: 'Señal orbital mayor', iconName: 'signal', damage: '2d6', bandDice: ['2d6', '2d6', '2d6', '3d6', '3d8'], manaCost: 11, school: 'arcane', area: true, cooldown: 5,
    expose: { value: 2, turns: 2 },
    description: 'La nave marca a todos los enemigos con una señal y dispara: les hace daño y quedan ionizados (−2 de defensa, 2 turnos) para todo tu grupo.' });

  // Infernal · Magia infernal
  R('infernal', 5, { id: 'sello_cenizas', name: 'Sello de cenizas', iconName: 'fire', damage: '2d6', bandDice: ['2d6', '2d6', '2d6', '3d6', '3d8'], manaCost: 6, school: 'fire', cooldown: 3,
    detonate: { status: 'fire', dice: ['1d8', '1d8', '1d10', '2d8', '3d8'] }, statusEffect: { type: 'fire', chance: 0.5, turns: 2, value: 2 },
    description: 'Una marca de ceniza: si el blanco ya se estaba quemando, la quemadura explota (daño de más y se apaga). Si no, a veces lo prende fuego.' });
  R('infernal', 9, { id: 'lluvia_azufre', name: 'Lluvia de azufre', iconName: 'fireball', damage: '2d8', bandDice: ['2d8', '2d8', '2d8', '3d8', '4d8'], manaCost: 14, school: 'fire', area: true, cooldown: 4,
    statusEffect: { type: 'fire', chance: 0.35, turns: 2, value: 2 },
    description: 'Cae azufre ardiendo sobre todos los enemigos. A algunos los prende fuego.' });

  // Ángel · Magia celestial
  R('angel', 5, { id: 'voto_protector', quick: true, name: 'Voto protector', iconName: 'shield', manaCost: 6, school: 'holy', cooldown: 4,
    partyBuff: { turns: 3, stat: 'armor', mods: { armor: [2, 2, 3, 3, 4] } },
    description: 'Un voto de luz cubre a todo tu grupo por 3 turnos: más armadura para vos y tus compañeros. Si dos ángeles lo lanzan, no se suma: vale el más alto.' });
  R('angel', 9, { id: 'santuario_luminoso', name: 'Santuario luminoso', iconName: 'heal', manaCost: 12, school: 'holy', cooldown: 5,
    partyHeal: { dice: '2d4', regen: [1, 2, 2, 3, 4], turns: 3 },
    description: 'Un círculo de luz: todo tu grupo recupera algo de vida ahora y un poco más al empezar cada turno, por 3 turnos. No se suma con el de otro ángel.' });

  // Hada · Magia feérica
  R('hada', 5, { id: 'bruma_encantada', name: 'Bruma encantada', iconName: 'blind', damage: '1d4', bandDice: ['1d4', '1d4', '1d4', '2d4', '2d6'], manaCost: 7, school: 'light', area: true, cooldown: 4,
    stagger: { value: [2, 2, 2, 3, 3] }, stunChance: 0.2, noBoss: true,
    description: 'Una bruma de colores sobre todos los enemigos: los marea (pegan peor en su próximo ataque) y a algunos los confunde tanto que pierden el turno (a los jefes, no).' });
  R('hada', 9, { id: 'sueno_compartido', name: 'Sueño compartido', iconName: 'moon', manaCost: 10, school: 'light', cooldown: 6,
    sleep: { chance: 0.6, bossStagger: 3 },
    description: 'Un sueño que se contagia: cada enemigo puede quedarse dormido y perder su próximo turno. Los jefes no se duermen: solo se marean.' });

  // Dríade · Magia natural
  R('driade', 5, { id: 'raices_protectoras', quick: true, name: 'Raíces protectoras', iconName: 'herb', manaCost: 6, school: 'nature', cooldown: 4,
    buff: { turns: 3, stat: 'armor', mods: { armor: [2, 2, 3, 3, 4], reflect: 0.25 } },
    description: 'Raíces duras te rodean por 3 turnos: más armadura, y el que te pega recibe parte del golpe.' });
  R('driade', 9, { id: 'bosque_despierto', name: 'Bosque despierto', iconName: 'herb', damage: '1d8', bandDice: ['1d8', '1d8', '1d8', '2d6', '2d8'], manaCost: 12, school: 'nature', area: true, cooldown: 5,
    stunChance: 0.3, noBoss: true,
    description: 'El bosque se levanta: raíces golpean a todos los enemigos y a algunos los atrapan (pierden su próximo turno; a los jefes, no).' });

  // ---------------------------------------------------------------
  // 3) Los 18 maestros (cada jugador ve solo al de su raza)
  //    heroRace: se dibujan como un héroe de su raza
  // ---------------------------------------------------------------
  const M = (o) => npc(Object.assign({ heroRace: o.school }, o));
  M({ id: 'npc_maestro_humano', name: 'Aldric el Duelista', roleName: 'Maestro de arcanismo', region: 'pueblo_inicial', school: 'humano', heroWeapon: 'sword',
    dialog: ['Un humano no nace con mucha magia, pero la que tiene la usa bien. Te voy a enseñar a ponerla en tu espada.', 'Marcá a tu rival. Después, pegale donde marcaste. Así de simple.', 'La magia de los humanos es terca, como nosotros.'] });
  M({ id: 'npc_maestra_angel', name: 'Sor Celestine', roleName: 'Maestra celestial', region: 'pueblo_inicial', school: 'angel',
    dialog: ['La luz no es para lucirse: es para cuidar a los que pelean con vos.', 'Un voto protege a todos. Un ángel que solo se cuida a sí mismo, todavía no entendió nada.', 'Que la luz te encuentre, aunque sea tarde.'] });
  M({ id: 'npc_maestro_enano', name: 'Borin Escudohondo', roleName: 'Maestro del bastión', region: 'aldea_piedrahonda', school: 'enano', heroWeapon: 'hammer',
    dialog: ['Un enano no retrocede. Un enano se planta y deja que el enemigo se canse.', 'La piedra aguanta mil años. Vos con aguantar la pelea ya estás bien.', 'Escudo arriba, barba al frente.'] });
  M({ id: 'npc_maestra_goliat', name: 'Kaya Rompemontes', roleName: 'Maestra de fuerza', region: 'aldea_piedrahonda', school: 'goliat',
    dialog: ['Cuando un goliat golpea el suelo, el que está enfrente se cae. Así de fácil.', 'No hace falta apuntar si le pegás a todos.', 'La montaña es mi maestra. Yo soy la tuya.'] });
  M({ id: 'npc_maestro_draconido', name: 'Vharax Escamabrasa', roleName: 'Maestro dracónico', region: 'aldea_piedrahonda', school: 'draconido',
    dialog: ['La sangre de dragón no se esconde: se escupe.', 'Tus escamas pueden arder. El que te toque, que aprenda.', 'El fuego de la forja de esta aldea me recuerda a casa.'] });
  M({ id: 'npc_maestra_gnomo', name: 'Fizzi Tuercaloca', roleName: 'Maestra tecnomante', region: 'puerto', school: 'gnomo',
    dialog: ['¡Cuidado con ese cable! Bueno, no hay cable. Todavía.', 'Un buen circuito no desperdicia nada. Ni la chispa, ni el maná.', 'Si algo ya está electrizado, el resto de la corriente vuelve a vos. ¡Es física!'] });
  M({ id: 'npc_maestro_robot', name: 'Unidad K-7', roleName: 'Instructor de combate', region: 'puerto', school: 'robot',
    dialog: ['SALUDO. PROTOCOLO DE INSTRUCCIÓN ACTIVO.', 'Probabilidad de éxito: alta, si seguís mis cálculos.', 'Un campo electromagnético bien calibrado desalienta a los que se acercan.'] });
  M({ id: 'npc_maestro_orco', name: 'Grumak Colmillo Roto', roleName: 'Maestro de guerra', region: 'puerto', school: 'orco', heroWeapon: 'axe',
    dialog: ['¡Gritá más fuerte! El enemigo tiene que temblar antes de que lo toques.', 'Un golpe es poco. Dos, empieza a ser una conversación.', 'Me rompí este colmillo contra un ogro. El ogro se rompió más.'] });
  M({ id: 'npc_maestra_elfo', name: 'Ilyana Velo de Plata', roleName: 'Maestra lunar', region: 'torre_del_mago', school: 'elfo', heroWeapon: 'bow',
    dialog: ['Desde lo alto de la torre la luna se ve más cerca. Vení de noche, si podés.', 'La luna no grita: muestra. Y lo que muestra, lo podés atravesar.', 'Un elfo que lee a su enemigo ya ganó la mitad de la pelea.'] });
  M({ id: 'npc_maestro_alienigena', name: 'Xo\'ren el Observador', roleName: 'Maestro psiónico', region: 'torre_del_mago', school: 'alienigena',
    dialog: ['Tu nave te escucha, aunque no la veas. Solo hay que aprender a llamarla.', 'Pensá en el aire como algo pesado. Ahora hacé que les caiga encima.', 'Este planeta es ruidoso. Me gusta.'] });
  M({ id: 'npc_maestra_mediano', name: 'Tía Pippa Buenaventura', roleName: 'Maestra de la fortuna', region: 'aldea_faroles', school: 'mediano',
    dialog: ['La suerte no se tiene, querido: se practica.', 'Un paso al costado a tiempo vale más que diez escudos.', '¿Un té? La suerte también se cocina a fuego lento.'] });
  M({ id: 'npc_maestra_vampiro', name: 'Lady Morwen', roleName: 'Maestra de sangre', region: 'aldea_faroles', school: 'vampiro',
    dialog: ['Los faroles de esta aldea son lo único que me deja vivir entre los vivos.', 'La sangre te obedece si le das algo a cambio.', 'No cures a los demás: no es tu oficio. El tuyo es seguir de pie.'] });
  M({ id: 'npc_maestro_elfo_oscuro', name: 'Szarith Sombra Quieta', roleName: 'Maestro de sombras', region: 'puerto_calavera', school: 'elfo_oscuro',
    dialog: ['En Puerto Calavera nadie pregunta de dónde venís. Por eso estoy acá.', 'Una sombra bien puesta debilita más que un golpe.', 'Maldecilo primero. Después, tu hoja hace el resto.'] });
  M({ id: 'npc_maestra_infernal', name: 'Ceniza', roleName: 'Maestra infernal', region: 'puerto_calavera', school: 'infernal',
    dialog: ['El fuego que ya prendiste es fuego que podés hacer explotar.', 'Los piratas me tienen miedo. Hacen bien.', 'No hace falta prender todo de nuevo: alcanza con avivarlo.'] });
  M({ id: 'npc_maestro_minotauro', name: 'Varg el Toro', roleName: 'Campeón de embestidas', region: 'puerto_calavera', school: 'minotauro', heroWeapon: 'axe',
    dialog: ['Gané cien peleas en la arena de este puerto. Cargando, siempre cargando.', 'Si hay una fila de enemigos, la fila es tuya.', 'Cabeza baja, cuernos al frente, y no pares.'] });
  M({ id: 'npc_maestra_hada', name: 'Brizna', roleName: 'Maestra feérica', region: 'santuario_roble', school: 'hada',
    dialog: ['¡Hola, hola! ¿Querés aprender a hacer dormir a un ogro? Es divertidísimo.', 'Un enemigo mareado pega mal. Uno dormido no pega.', 'Los jefes son aburridos: nunca se duermen.'] });
  M({ id: 'npc_maestra_driade', name: 'Madre Sauce', roleName: 'Maestra natural', region: 'santuario_roble', school: 'driade',
    dialog: ['El roble no ataca. Espera, y el que lo golpea se lastima.', 'Las raíces de este santuario llegan más lejos de lo que creés.', 'Escuchá al bosque: él también quiere pelear.'] });
  M({ id: 'npc_maestro_licantropo', name: 'Fenrik Pelo Gris', roleName: 'Maestro de la manada', region: 'santuario_roble', school: 'licantropo',
    dialog: ['La manada elige una presa y no la suelta. Vos tampoco.', 'El druida me deja dormir acá a cambio de que no me coma a nadie.', 'Cuando la luna está alta, saltá. Ya vas a entender.'] });

  // ---------------------------------------------------------------
  // 4) Las 18 pruebas de nivel 9 (las da tu maestro; al volver, te enseña el poder)
  // ---------------------------------------------------------------
  const T = (race, o) => quest(Object.assign({ id: `escuela_${race}`, race, minLevel: 9 }, o));
  T('humano', { giver: 'npc_maestro_humano', title: 'La prueba del duelista',
    offer: 'Para la Resonancia arcana tenés que ganar un duelo de verdad. Hay caballeros de la muerte en la Fortaleza Caída y en las Catacumbas: derrotá a uno y volvé.',
    text: 'Aldric quiere que derrotes a un caballero de la muerte (Fortaleza Caída o Catacumbas) y vuelvas al Pueblo Inicial.',
    objectives: [{ type: 'kill', enemy: 'cab_muerte', count: 1, text: 'Derrotá a un caballero de la muerte' }],
    done: 'Ganaste el duelo. Ahora tu arma va a resonar con tu magia.', reward: { xp: 300, learn: 'resonancia_arcana' } });
  T('angel', { giver: 'npc_maestra_angel', title: 'Almas en pena',
    offer: 'En el Fondo del Volcán hay almas condenadas que sufren sin descanso. Liberá a cuatro y volvé: así vas a aprender a levantar un santuario.',
    text: 'Sor Celestine quiere que liberes a cuatro almas condenadas en el Fondo del Volcán.',
    objectives: [{ type: 'kill', enemy: 'alma_condenada', count: 4, text: 'Liberá almas condenadas' }],
    done: 'Las almas descansan. Ahora sabés dónde nace un santuario.', reward: { xp: 300, learn: 'santuario_luminoso' } });
  T('enano', { giver: 'npc_maestro_enano', title: 'La prueba de piedra',
    offer: 'Una fortaleza ancestral se gana aguantando. En las Cuevas Ancestrales hay gólems: derrotá a dos sin dar un paso atrás.',
    text: 'Borin quiere que derrotes a dos gólems en las Cuevas Ancestrales.',
    objectives: [{ type: 'kill', enemy: 'golem', count: 2, text: 'Derrotá gólems' }],
    done: 'Aguantaste como la piedra. Sos una fortaleza.', reward: { xp: 300, learn: 'fortaleza_ancestral' } });
  T('goliat', { giver: 'npc_maestra_goliat', title: 'Más grande que vos',
    offer: 'Para partir el suelo tenés que vencer a alguien más grande que vos. En la Pradera de los Cíclopes hay de sobra: derrotá a dos.',
    text: 'Kaya quiere que derrotes a dos cíclopes en la Pradera de los Cíclopes.',
    objectives: [{ type: 'kill', enemy: 'ciclope', count: 2, text: 'Derrotá cíclopes' }],
    done: 'Los gigantes cayeron. Ahora el suelo te va a obedecer.', reward: { xp: 300, learn: 'ruptura_terreno' } });
  T('draconido', { giver: 'npc_maestro_draconido', title: 'La sangre llama',
    offer: 'Tus primos salvajes andan por el Volcán y el Nido de Dragones. Derrotá a tres dracónidos salvajes y tu furia va a despertar.',
    text: 'Vharax quiere que derrotes a tres dracónidos salvajes (Volcán o Nido de Dragones).',
    objectives: [{ type: 'kill', enemy: 'draconido_salvaje', count: 3, text: 'Derrotá dracónidos salvajes' }],
    done: 'La sangre reconoce a la sangre. Tu furia de dragón ya es tuya.', reward: { xp: 300, learn: 'furia_dragon' } });
  T('gnomo', { giver: 'npc_maestra_gnomo', title: 'Chispa en la botella',
    offer: 'Necesito estudiar elementales arcanos para mi tormenta. En las Ruinas Perdidas hay: derrotá a dos y contame cómo chisporrotean.',
    text: 'Fizzi quiere que derrotes a dos elementales arcanos en las Ruinas Perdidas.',
    objectives: [{ type: 'kill', enemy: 'elem_arcano', count: 2, text: 'Derrotá elementales arcanos' }],
    done: '¡Eso! Con eso cierro el circuito. Tu tormenta conductora está lista.', reward: { xp: 300, learn: 'tormenta_conductora' } });
  T('robot', { giver: 'npc_maestro_robot', title: 'Calibración',
    offer: 'PROTOCOLO DE ASALTO: NECESITA CALIBRACIÓN. Objetivo: dos gólems de lava en el Volcán. Calor alto. Proceder.',
    text: 'La Unidad K-7 quiere que derrotes a dos gólems de lava en el Volcán.',
    objectives: [{ type: 'kill', enemy: 'golem_lava', count: 2, text: 'Derrotá gólems de lava' }],
    done: 'CALIBRACIÓN COMPLETA. Protocolo de asalto instalado.', reward: { xp: 300, learn: 'protocolo_asalto' } });
  T('orco', { giver: 'npc_maestro_orco', title: 'Sangre de guerrero',
    offer: 'La horda no para por nada. Andá a cazar mantícoras (Cuevas Ancestrales o la Pradera de los Cíclopes): dos, y volvé con las colas si querés.',
    text: 'Grumak quiere que derrotes a dos mantícoras (Cuevas Ancestrales o Pradera de los Cíclopes).',
    objectives: [{ type: 'kill', enemy: 'manticora', count: 2, text: 'Derrotá mantícoras' }],
    done: '¡Eso es pelear! Ya sos una horda vos solo.', reward: { xp: 300, learn: 'horda_imparable' } });
  T('elfo', { giver: 'npc_maestra_elfo', title: 'Luz en la cripta',
    offer: 'Los espectros le temen a la luna. Derrotá a tres (Bosque de los Susurros, Fortaleza Caída o Catacumbas) y vas a poder hacer llover su luz.',
    text: 'Ilyana quiere que derrotes a tres espectros (Bosque de los Susurros, Fortaleza Caída o Catacumbas).',
    objectives: [{ type: 'kill', enemy: 'espectro', count: 3, text: 'Derrotá espectros' }],
    done: 'La luna te vio pelear. Su lluvia es tuya.', reward: { xp: 300, learn: 'lluvia_lunar' } });
  T('alienigena', { giver: 'npc_maestro_alienigena', title: 'Señales del fondo',
    offer: 'Hay una mente enorme en el Abismo Marino: un calamar gigante. Su señal tapa la de tu nave. Derrotalo y vas a poder llamarla con fuerza.',
    text: 'Xo\'ren quiere que derrotes a un calamar gigante en el Abismo Marino.',
    objectives: [{ type: 'kill', enemy: 'calamar_gigante', count: 1, text: 'Derrotá a un calamar gigante' }],
    done: 'Silencio en el fondo del mar. Tu nave ahora te escucha clarito.', reward: { xp: 300, learn: 'senal_orbital' } });
  T('mediano', { giver: 'npc_maestra_mediano', title: 'Probar la suerte',
    offer: 'Para que el destino te favorezca hay que tentarlo. Hay una quimera en la Pradera de los Cíclopes: tres cabezas, tres veces más suerte que necesitás. Derrotala.',
    text: 'La tía Pippa quiere que derrotes a una quimera en la Pradera de los Cíclopes.',
    objectives: [{ type: 'kill', enemy: 'quimera', count: 1, text: 'Derrotá a una quimera' }],
    done: '¿Viste? La suerte estaba de tu lado. Ahora el destino también.', reward: { xp: 300, learn: 'destino_favorable' } });
  T('vampiro', { giver: 'npc_maestra_vampiro', title: 'Sangre noble',
    offer: 'En el Jardín Carmesí vive una noble vampira que se cree mejor que nosotras. Derrotala y traeme el olor de su sangre en tu ropa.',
    text: 'Lady Morwen quiere que derrotes a una noble vampira en el Jardín Carmesí.',
    objectives: [{ type: 'kill', enemy: 'noble_vampira', count: 1, text: 'Derrotá a una noble vampira' }],
    done: 'Huele a sangre vieja. Bien. Ya podés llamar a la niebla.', reward: { xp: 300, learn: 'niebla_sangre' } });
  T('elfo_oscuro', { giver: 'npc_maestro_elfo_oscuro', title: 'Lo que vive en la oscuridad',
    offer: 'Allá abajo, en las Ruinas Perdidas, flota un contemplador. Mis ancestros le escapaban. Vos no: derrotalo.',
    text: 'Szarith quiere que derrotes a un contemplador en las Ruinas Perdidas.',
    objectives: [{ type: 'kill', enemy: 'contemplador', count: 1, text: 'Derrotá a un contemplador' }],
    done: 'El ojo se cerró. Ahora la oscuridad trabaja para vos.', reward: { xp: 300, learn: 'eclipse_arcano' } });
  T('infernal', { giver: 'npc_maestra_infernal', title: 'Volver al fuego',
    offer: 'Volvé al Fondo del Volcán y derrotá a tres demonios menores. Que sepan quién manda en el fuego.',
    text: 'Ceniza quiere que derrotes a tres demonios menores en el Fondo del Volcán.',
    objectives: [{ type: 'kill', enemy: 'demonio_menor', count: 3, text: 'Derrotá demonios menores' }],
    done: 'Huelen a azufre tus botas. Perfecto: que llueva.', reward: { xp: 300, learn: 'lluvia_azufre' } });
  T('minotauro', { giver: 'npc_maestro_minotauro', title: 'Romper la línea',
    offer: 'Los centauros de la Pradera de los Cíclopes corren en fila. Cargá contra ellos: derrotá a tres.',
    text: 'Varg quiere que derrotes a tres centauros en la Pradera de los Cíclopes.',
    objectives: [{ type: 'kill', enemy: 'centauro', count: 3, text: 'Derrotá centauros' }],
    done: '¡Ni una fila en pie! Tus cuernos ya son una tormenta.', reward: { xp: 300, learn: 'tormenta_cuernos' } });
  T('hada', { giver: 'npc_maestra_hada', title: 'Malos sueños',
    offer: 'En el Bosque de los Sueños hay pesadillas que no dejan dormir a nadie. Derrotá a tres y te enseño a compartir un sueño lindo.',
    text: 'Brizna quiere que derrotes a tres pesadillas en el Bosque de los Sueños.',
    objectives: [{ type: 'kill', enemy: 'pesadilla', count: 3, text: 'Derrotá pesadillas' }],
    done: '¡Ahora sí se duerme bien! El sueño compartido es tuyo.', reward: { xp: 300, learn: 'sueno_compartido' } });
  T('driade', { giver: 'npc_maestra_driade', title: 'El jardín enfermo',
    offer: 'El Jardín Carmesí está enfermo de sangre. Derrotá a dos bestias de sangre y el bosque te va a prestar su fuerza.',
    text: 'Madre Sauce quiere que derrotes a dos bestias de sangre en el Jardín Carmesí.',
    objectives: [{ type: 'kill', enemy: 'bestia_sangre', count: 2, text: 'Derrotá bestias de sangre' }],
    done: 'El jardín respira de nuevo. El bosque despierta cuando lo llames.', reward: { xp: 300, learn: 'bosque_despierto' } });
  T('licantropo', { giver: 'npc_maestro_licantropo', title: 'Cazar al cazador',
    offer: 'Hay licántropos en el Bosque de los Susurros que no aceptan a ninguna manada. Cazá a dos y la luna te va a enseñar a saltar.',
    text: 'Fenrik quiere que derrotes a dos licántropos en el Bosque de los Susurros.',
    objectives: [{ type: 'kill', enemy: 'licantropo', count: 2, text: 'Derrotá licántropos' }],
    done: 'La luna te vio cazar. La cacería lunar es tuya.', reward: { xp: 300, learn: 'caceria_lunar' } });
})(window.Aventurs);
