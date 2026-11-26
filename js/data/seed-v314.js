/* ============================================================
   Aventurs — v3.14: la magia es de tu raza (escuelas hasta el nivel 25)

   1) Nadie enseña hechizos comunes. Los sabios (Velrith, Sylveth y Seren) dejan
      de enseñar Chispa, Bola de fuego, Meteoro y los demás, y los pergaminos ya
      no se "aprenden": se compran y se usan en la pelea. Toda la magia fija sale
      de la escuela de tu raza. Los Pergaminos de hechizo (Pergamino: Llama...)
      ya no existen: dejan de caer y, si tenías alguno, se vende solo.
      Lo que ya habías aprendido se quita y se devuelve (js/systems/schools.js).
   2) Las escuelas siguen hasta el nivel 25: cuatro poderes más por raza.
        nivel 13: lo enseña tu maestro (se paga)
        nivel 17: tu maestro te pone una prueba
        nivel 21: lo enseña tu maestro (se paga)
        nivel 25: la última prueba
      Los magos tienen los hechizos más grandes (los que antes enseñaban los
      sabios); los híbridos, mejoras y hechizos medianos; los guerreros, técnicas
      (js/systems/techniques.js).
   3) Los hechizos de nacimiento crecen con vos (el dado sube por tramo de nivel).
      Curarse con magia es de pocas razas: el ángel y la dríade nacen con su curación;
      el vampiro se cura chupando sangre; los demás, con pociones.
   4) Los maestros del Pueblo Inicial (humano y ángel) se mudan a la Torre del Mago.
   Se carga después de seed-v313-mundo.js.
   ============================================================ */

(function (A) {
  'use strict';

  const S = A.Seed || (A.Seed = {});
  for (const k of ['spells', 'npcs', 'quests', 'items', 'enemies']) S[k] = S[k] || [];
  const SRC = 'v314';
  const byId = (list, id) => (list || []).find((x) => x && x.id === id);

  // ---------------------------------------------------------------
  // 1) Sin magia común: los sabios no enseñan y los pergaminos no se aprenden
  // ---------------------------------------------------------------
  for (const n of S.npcs) if (n && Array.isArray(n.teaches) && n.teaches.length) n.teaches = [];
  for (const it of S.items) if (it && it.teachesSpell && it.subtype !== 'scroll_spell') delete it.teachesSpell;
  // Los Pergaminos de hechizo: se retiran (si alguien tenía uno, se vende solo al cargar la partida)
  S.retiredItems = ['pergamino_chispa', 'pergamino_llama', 'pergamino_rayo_helado', 'pergamino_curacion', 'pergamino_bola_fuego', 'pergamino_tormenta', 'pergamino_aliento_dragon'];
  for (const id of S.retiredItems) { const it = byId(S.items, id); if (it) it.retired = true; }
  const isRetired = (id) => S.retiredItems.includes(id);
  for (const e of S.enemies) if (e && e.drops) e.drops = e.drops.filter((d) => !isRetired(d.itemId));
  for (const n of S.npcs) if (n && n.sells) n.sells = n.sells.filter((id) => !isRetired(id));

  // ---------------------------------------------------------------
  // 2) Los maestros del Pueblo Inicial se mudan a la Torre del Mago
  // ---------------------------------------------------------------
  for (const id of ['npc_maestro_humano', 'npc_maestra_angel']) { const n = byId(S.npcs, id); if (n) n.region = 'torre_del_mago'; }
  const qh = byId(S.quests, 'escuela_humano');
  if (qh) qh.text = 'Aldric quiere que derrotes a un caballero de la muerte (Fortaleza Caída o Catacumbas) y vuelvas a la Torre del Mago.';
  const mh = byId(S.npcs, 'npc_maestro_humano');
  if (mh) mh.dialog = ['Me vine a la torre porque acá la magia se toma en serio. Igual, la espada no la suelto.', 'Marcá a tu rival. Después, pegale donde marcaste. Así de simple.', 'La magia de los humanos es terca, como nosotros.'];
  const ma = byId(S.npcs, 'npc_maestra_angel');
  if (ma) ma.dialog = ['Desde lo alto de la torre se ve todo el valle. Desde ahí cuido a los que pelean.', 'Un voto protege a todos. Un ángel que solo se cuida a sí mismo, todavía no entendió nada.', 'Que la luz te encuentre, aunque sea tarde.'];

  // ---------------------------------------------------------------
  // 3) Los hechizos de nacimiento crecen por tramo de nivel (1-4 · 5-8 · 9-12 · 13-16 · 17+)
  // ---------------------------------------------------------------
  const BIRTH = {
    dardo_arcano: ['1d6', '1d8', '2d6', '2d8', '3d6'],
    flecha_lunar: ['1d6', '1d8', '2d6', '2d8', '3d6'],
    dardo_venenoso: ['1d4', '1d6', '1d8', '2d6', '2d8'],
    aliento_de_brasas: ['1d4', '1d6', '1d8', '2d6', '2d8'],
    toque_vampirico: ['1d4', '1d6', '1d8', '2d6', '2d8'],
    manto_oscuridad: ['1d4', '1d6', '1d8', '2d6', '2d8'],
    descarga: ['1d6', '1d8', '2d6', '2d8', '3d8'],
    rayo_de_plasma: ['1d8', '1d10', '2d8', '3d6', '3d10'],
    ascua_infernal: ['1d6', '1d8', '2d6', '2d8', '3d8'],
    luz_sagrada: ['1d4', '1d6', '2d4', '2d6', '3d6'],
    chispas_de_hada: ['1d6', '1d8', '2d6', '2d8', '3d8'],
    enredadera: ['1d6', '1d8', '2d6', '2d8', '3d8'],
  };
  for (const id of Object.keys(BIRTH)) {
    const sp = byId(S.spells, id);
    if (!sp) continue;
    sp.bandDice = BIRTH[id];
    if (sp.description && !/crece con vos/.test(sp.description)) sp.description += ' Crece con vos: el dado sube en los niveles 5, 9, 13 y 17.';
  }

  // ---------------------------------------------------------------
  // 3b) Curarse con magia es de pocas razas: el ángel y la dríade nacen con su curación
  //     (antes cualquiera aprendía Curación o Segundo aliento con los sabios). El vampiro
  //     se cura chupando sangre. Los demás se curan con pociones.
  //     bandHeal: lo que cura por tramo de nivel · hot: además cura un poco por turno
  // ---------------------------------------------------------------
  const HEAL = (race, o) => { if (!byId(S.spells, o.id)) S.spells.push(Object.assign({ icon: '', _source: SRC, racial: race, birthHeal: true, tier: 1, iconName: 'heal' }, o)); };
  HEAL('angel', { id: 'manos_luz', name: 'Manos de luz', heal: '2d6+2', bandHeal: ['2d6+2', '2d6+3', '3d6+3', '4d6+4', '5d6+6'], manaCost: 7, cooldown: 3, school: 'holy', cleanse: true,
    description: 'Tus manos se llenan de luz: curan y sacan el veneno, el fuego, el frío, el sangrado y las maldiciones. A vos, a tu mascota o a un compañero. Crece con vos.' });
  HEAL('driade', { id: 'balsamo_savia', name: 'Bálsamo de savia', heal: '2d6', bandHeal: ['2d6', '2d6+2', '3d6+2', '4d6+3', '5d6+5'], manaCost: 7, cooldown: 3, school: 'nature', hot: { regen: [1, 1, 2, 2, 3], turns: 3 },
    description: 'Savia tibia sobre las heridas: cura ahora y sigue curando 3 turnos. A vos, a tu mascota o a un compañero. Crece con vos.' });
  const HEAL_OF = { angel: 'manos_luz', driade: 'balsamo_savia' };
  for (const sc of S.schools || []) if (HEAL_OF[sc.race]) sc.heal = HEAL_OF[sc.race];

  // ---------------------------------------------------------------
  // 4) Los 48 hechizos nuevos de escuela (13, 17, 21 y 25)
  //    Lo nuevo que entiende el combate:
  //      vsStatus { types, mult }  más daño si el blanco ya tiene uno de esos estados
  //      vsMarked                  más daño si el blanco tiene tu sello o tu marca
  //      lucky { chance, mult }    a veces pega el doble (el mediano)
  //      un hechizo de daño puede, además, curar o mejorar (partyHeal, partyBuff, buff, sleep)
  //      mods.lifesteal            parte del daño de tus golpes vuelve como vida
  // ---------------------------------------------------------------
  const spell = (o) => { if (!byId(S.spells, o.id)) S.spells.push(Object.assign({ icon: '', _source: SRC }, o)); };
  const R = (race, rank, o) => spell(Object.assign({ racial: race, schoolRank: rank, tier: rank }, o, o.quick ? { description: `${o.description} Es rápido: no gasta tu turno (uno por turno).` } : {}));
  const fire = (chance, value, turns = 2) => ({ type: 'fire', chance, turns, value });

  // ----- Híbridos -----
  // Humano · Arcanismo adaptable
  R('humano', 13, { id: 'estocada_sellada', name: 'Estocada sellada', iconName: 'target', damage: '3d6', bandDice: ['3d6', '3d6', '3d6', '3d6', '4d6'], manaCost: 8, school: 'arcane', sure: true, cooldown: 3,
    vsMarked: 2,
    description: 'Un tajo de energía que no falla. Si el blanco tiene tu sello (o tu marca), le hace el doble de daño.' });
  R('humano', 17, { id: 'maestria_duelo', quick: true, name: 'Maestría de duelo', iconName: 'target', manaCost: 9, school: 'arcane', cooldown: 6,
    buff: { turns: 3, stat: 'damage', mods: { precision: 3, damage: 4 } },
    description: 'Todo lo que aprendiste en un solo movimiento: por 3 turnos, tus golpes con arma tienen +3 de precisión y +4 de daño.' });
  R('humano', 21, { id: 'sello_multiple', name: 'Sello múltiple', iconName: 'target', damage: '2d8', manaCost: 14, school: 'arcane', area: true, sure: true, cooldown: 5,
    seal: { turns: 3, prec: 2, dmg: 5 },
    description: 'Un sello para cada enemigo, y ninguno falla: por 3 turnos les pegás con +2 de precisión y +5 de daño. Es tuyo: ni tu mascota ni tus compañeros lo usan.' });
  R('humano', 25, { id: 'avatar_arcano', quick: true, name: 'Avatar arcano', iconName: 'spark', manaCost: 16, school: 'arcane', cooldown: 8,
    echo: { turns: 4, dice: '3d6' }, buff: { turns: 4, stat: 'precision', mods: { precision: 2, armor: 3 } },
    description: 'Te volvés magia con espada: por 4 turnos, cada golpe con arma que acierta suelta un eco arcano (3d6), y tenés +2 de precisión y +3 de armadura.' });

  // Elfo · Magia lunar
  R('elfo', 13, { id: 'flecha_plata', name: 'Flecha de plata', iconName: 'stars', damage: '3d6', bandDice: ['3d6', '3d6', '3d6', '3d6', '4d6'], manaCost: 8, school: 'light', sure: true, cooldown: 2,
    expose: { value: 3, turns: 2 },
    description: 'Una flecha de luz que no falla: deja al blanco expuesto (−3 de defensa, 2 turnos) para vos y tu grupo.' });
  R('elfo', 17, { id: 'bendicion_lunar', quick: true, name: 'Bendición lunar', iconName: 'moon', manaCost: 10, school: 'light', cooldown: 6,
    partyBuff: { turns: 3, stat: 'defense', mods: { defense: 3, precision: 2 } },
    description: 'La luna cubre a todo tu grupo por 3 turnos: +3 de defensa y +2 de precisión para todos. Si dos elfos la lanzan, no se suma.' });
  R('elfo', 21, { id: 'rayo_luna', name: 'Rayo de luna', iconName: 'moon', damage: '5d8', manaCost: 14, school: 'light', cooldown: 3,
    statusEffect: { type: 'blind', chance: 0.5, turns: 2, value: 1 },
    description: 'Un rayo de luna llena sobre un enemigo: mucho daño, y la mitad de las veces lo deja ciego (le cuesta acertar).' });
  R('elfo', 25, { id: 'luna_eterna', name: 'Luna eterna', iconName: 'stars', damage: '4d8', manaCost: 22, school: 'light', area: true, cooldown: 5,
    expose: { value: 3, turns: 3 }, statusEffect: { type: 'blind', chance: 0.4, turns: 2, value: 1 },
    description: 'La luna baja sobre todos los enemigos: les hace daño, quedan expuestos (−3 de defensa, 3 turnos) y algunos, ciegos.' });

  // Mediano · Magia de fortuna
  R('mediano', 13, { id: 'moneda_aire', name: 'Moneda al aire', iconName: 'dice', damage: '3d6', bandDice: ['3d6', '3d6', '3d6', '3d6', '4d6'], manaCost: 7, school: 'nature', cooldown: 2,
    lucky: { chance: 0.5, mult: 2 },
    description: 'Tirás una moneda encantada: si sale cara (la mitad de las veces), pega el doble.' });
  R('mediano', 17, { id: 'racha_suerte', quick: true, name: 'Racha de suerte', iconName: 'clover', manaCost: 9, school: 'nature', cooldown: 8,
    buff: { turns: 2, stat: 'precision', mods: { advantage: 1, defense: 2 } },
    description: 'Por 2 turnos tirás dos dados en cada ataque (con arma o hechizo) y te quedás con el mejor, y esquivás mejor (+2 de defensa).' });
  R('mediano', 21, { id: 'veneno_cienaga', name: 'Veneno de la ciénaga', iconName: 'herb', damage: '2d6', manaCost: 14, school: 'nature', area: true, cooldown: 4,
    statusEffect: { type: 'poison', chance: 0.8, turns: 3, value: 4 },
    description: 'Una nube del pantano sobre todos los enemigos: casi todos quedan envenenados (4 de daño por turno, 3 turnos).' });
  R('mediano', 25, { id: 'gran_fortuna', quick: true, name: 'La gran fortuna', iconName: 'clover', manaCost: 14, school: 'nature', cooldown: 9,
    partyBuff: { turns: 3, stat: 'defense', mods: { dodgeNext: 1, defense: 3 } },
    description: 'La suerte de toda tu familia, junta: a todo tu grupo, el próximo golpe que le apunten falla, y +3 de defensa por 3 turnos.' });

  // Dracónido · Magia dracónica
  R('draconido', 13, { id: 'garra_ignea', name: 'Garra ígnea', iconName: 'fire', damage: '3d8', bandDice: ['3d8', '3d8', '3d8', '3d8', '4d8'], manaCost: 9, school: 'fire', cooldown: 2,
    statusEffect: fire(0.5, 3),
    description: 'Tus garras se prenden fuego: un zarpazo ardiente que la mitad de las veces deja al blanco quemándose (3 por turno).' });
  R('draconido', 17, { id: 'corazon_dragon', quick: true, name: 'Corazón de dragón', iconName: 'shield', manaCost: 10, school: 'fire', cooldown: 7,
    buff: { turns: 3, stat: 'armor', mods: { armor: 4, damage: 3, regen: 2 }, resist: ['fire'] },
    description: 'Tu corazón late como el de un dragón por 3 turnos: +4 de armadura, +3 de daño en tus golpes, recuperás 2 de vida por turno y el fuego no te toca.' });
  R('draconido', 21, { id: 'aliento_abrasador', name: 'Aliento abrasador', iconName: 'breath', damage: '4d6', manaCost: 16, school: 'fire', area: true, cooldown: 4,
    statusEffect: fire(0.5, 3),
    description: 'Un aliento de fuego blanco sobre todos los enemigos. La mitad se queda quemándose (3 por turno).' });
  R('draconido', 25, { id: 'forma_dragon', quick: true, name: 'Forma de dragón', iconName: 'breath', manaCost: 16, school: 'fire', cooldown: 9,
    buff: { turns: 4, stat: 'armor', mods: { armor: 5, damage: 5 }, resist: ['fire'], touch: { status: 'fire', chance: 0.5, turns: 2, value: 4 } },
    description: 'Por 4 turnos sos medio dragón: +5 de armadura, +5 de daño en tus golpes, el fuego no te toca y el que te pega de cerca se puede prender fuego.' });

  // Vampiro · Hemomancia
  R('vampiro', 13, { id: 'lanza_sangre', name: 'Lanza de sangre', iconName: 'bleed', damage: '3d8', bandDice: ['3d8', '3d8', '3d8', '3d8', '4d8'], manaCost: 9, school: 'shadow', cooldown: 2,
    drainPct: 0.5,
    description: 'Una lanza de sangre endurecida: la mitad del daño que hace vuelve a vos como vida.' });
  R('vampiro', 17, { id: 'sed_insaciable', quick: true, name: 'Sed insaciable', iconName: 'bleed', manaCost: 8, school: 'shadow', cooldown: 7,
    buff: { turns: 3, stat: 'damage', mods: { lifesteal: 0.25, damage: 2 } },
    description: 'Por 3 turnos tus golpes con arma pegan +2 y beben: el 25% del daño que hacen vuelve como vida.' });
  R('vampiro', 21, { id: 'marea_carmesi', name: 'Marea carmesí', iconName: 'bleed', damage: '3d8', manaCost: 16, school: 'shadow', area: true, cooldown: 4,
    drainPct: 0.4,
    description: 'Una marea de sangre sobre todos los enemigos: el 40% de todo el daño que hace vuelve a vos como vida.' });
  R('vampiro', 25, { id: 'senor_noche', quick: true, name: 'Señor de la noche', iconName: 'bleed', manaCost: 14, school: 'shadow', cooldown: 9,
    buff: { turns: 3, stat: 'damage', mods: { lifesteal: 0.35, damage: 5, armor: 3 } },
    description: 'La noche es tuya por 3 turnos: +5 de daño en tus golpes, +3 de armadura, y el 35% del daño que hacés con el arma vuelve como vida.' });

  // Elfo oscuro · Magia sombría
  R('elfo_oscuro', 13, { id: 'daga_sombra', name: 'Daga de sombra', iconName: 'skull', damage: '3d6', bandDice: ['3d6', '3d6', '3d6', '3d6', '4d6'], manaCost: 8, school: 'shadow', sure: true, cooldown: 2,
    vsStatus: { types: ['curse', 'blind'], mult: 1.6 },
    description: 'Una daga de sombra que no falla. Contra un blanco maldito o ciego, pega mucho más (+60%).' });
  R('elfo_oscuro', 17, { id: 'noche_cerrada', name: 'Noche cerrada', iconName: 'blind', damage: '2d6', manaCost: 14, school: 'shadow', area: true, cooldown: 5,
    curse: { amount: 2, turns: 2 }, statusEffect: { type: 'blind', chance: 0.6, turns: 2, value: 1 },
    description: 'Se hace de noche sobre todos los enemigos: los maldice 2 turnos (−2 de precisión y de defensa) y a la mayoría los deja ciegos.' });
  R('elfo_oscuro', 21, { id: 'toque_penumbra', name: 'Toque de la penumbra', iconName: 'skull', damage: '5d8', manaCost: 14, school: 'shadow', cooldown: 3,
    curse: { amount: 2, turns: 3 }, vsStatus: { types: ['curse', 'blind'], mult: 1.3 },
    description: 'La penumbra le toca el alma a un enemigo: mucho daño (más si ya estaba maldito o ciego) y lo maldice 3 turnos (−2 de precisión y defensa).' });
  R('elfo_oscuro', 25, { id: 'eclipse_total', name: 'Eclipse total', iconName: 'blind', damage: '4d8', manaCost: 22, school: 'shadow', area: true, cooldown: 5,
    curse: { amount: 2, turns: 3 }, statusEffect: { type: 'blind', chance: 0.5, turns: 2, value: 1 },
    description: 'Se apaga el sol: todos los enemigos reciben daño, quedan malditos 3 turnos (−2 de precisión y defensa) y la mitad, ciegos.' });

  // ----- Magos -----
  // Gnomo · Tecnomancia eléctrica
  R('gnomo', 13, { id: 'bobina_tesla', name: 'Bobina de Tesla', iconName: 'spark', damage: '5d6', bandDice: ['5d6', '5d6', '5d6', '5d6', '6d6'], manaCost: 12, school: 'arcane', cooldown: 2,
    statusEffect: { type: 'shock', chance: 0.5, turns: 2, value: 1 }, vsStatus: { types: ['shock'], mult: 1.4 },
    description: 'Una bobina que zumba y dispara: si el blanco ya estaba electrizado, pega un 40% más; si no, la mitad de las veces lo electriza.' });
  R('gnomo', 17, { id: 'red_electrica', name: 'Red eléctrica', iconName: 'storm', damage: '4d6', manaCost: 18, school: 'arcane', area: true, cooldown: 4,
    statusEffect: { type: 'shock', chance: 0.6, turns: 2, value: 1 }, refund: { status: 'shock', mana: 6 },
    description: 'Una red de rayos sobre todos los enemigos: electriza a la mayoría, y si alguno ya lo estaba, te vuelven 6 de maná.' });
  R('gnomo', 21, { id: 'rayo_concentrado', name: 'Rayo concentrado', iconName: 'spark', damage: '7d8', manaCost: 22, school: 'arcane', cooldown: 2,
    statusEffect: { type: 'shock', chance: 0.4, turns: 2, value: 1 }, refund: { status: 'shock', mana: 8 },
    description: 'Toda la corriente en un solo rayo: muchísimo daño a un enemigo. Si ya estaba electrizado, te vuelven 8 de maná.' });
  R('gnomo', 25, { id: 'gran_tormenta', name: 'Gran tormenta gnoma', iconName: 'storm', damage: '6d6', manaCost: 32, school: 'arcane', area: true, cooldown: 5,
    statusEffect: { type: 'shock', chance: 0.6, turns: 2, value: 1 }, stunChance: 0.25, noBoss: true,
    description: 'El invento final: una tormenta entera sobre todos los enemigos. Electriza a la mayoría y a algunos los deja tiesos un turno (a los jefes, no).' });

  // Alienígena · Psiónica y plasma
  R('alienigena', 13, { id: 'lanza_plasma', name: 'Lanza de plasma', iconName: 'arcane', damage: '5d8', bandDice: ['5d8', '5d8', '5d8', '5d8', '6d8'], manaCost: 14, school: 'arcane', cooldown: 2,
    expose: { value: 2, turns: 2 },
    description: 'Un haz de plasma concentrado: pega muy fuerte y deja al blanco ionizado (−2 de defensa, 2 turnos).' });
  R('alienigena', 17, { id: 'colapso_gravitatorio', name: 'Colapso gravitatorio', iconName: 'arcane', damage: '4d8', manaCost: 20, school: 'arcane', area: true, cooldown: 4,
    statusEffect: { type: 'prone', chance: 0.6, turns: 1, value: 1 },
    description: 'El aire se vuelve de plomo sobre todos los enemigos: daño, y la mayoría queda en el suelo (les cuesta defenderse).' });
  R('alienigena', 21, { id: 'dominio_mental', name: 'Dominio mental', iconName: 'signal', damage: '7d8', manaCost: 22, school: 'arcane', cooldown: 3,
    stagger: { value: 4 }, stunChance: 0.35, noBoss: true,
    description: 'Entrás en la mente de un enemigo: muchísimo daño, queda mareado (−4 de precisión) y a veces pierde su turno (los jefes, no).' });
  R('alienigena', 25, { id: 'bombardeo_orbital', name: 'Bombardeo orbital', iconName: 'signal', damage: '6d8', manaCost: 34, school: 'arcane', area: true, cooldown: 5,
    expose: { value: 3, turns: 3 },
    description: 'Tu nave abre fuego con todo sobre todos los enemigos: muchísimo daño y quedan ionizados (−3 de defensa, 3 turnos).' });

  // Infernal · Magia infernal
  R('infernal', 13, { id: 'llamarada_abismo', name: 'Llamarada del abismo', iconName: 'fire', damage: '5d6', bandDice: ['5d6', '5d6', '5d6', '5d6', '6d6'], manaCost: 13, school: 'fire', cooldown: 2,
    detonate: { status: 'fire', dice: '3d8' }, statusEffect: fire(0.6, 4),
    description: 'Fuego del fondo del abismo: si el blanco ya se quemaba, la quemadura explota (+3d8); si no, casi siempre lo prende fuego (4 por turno).' });
  R('infernal', 17, { id: 'infierno_desatado', name: 'Infierno desatado', iconName: 'fireball', damage: '4d8', manaCost: 20, school: 'fire', area: true, cooldown: 4,
    statusEffect: fire(0.6, 4),
    description: 'Abrís una grieta del infierno bajo todos los enemigos: mucho daño y la mayoría se queda quemándose (4 por turno).' });
  R('infernal', 21, { id: 'lanza_azufre', name: 'Lanza de azufre', iconName: 'fire', damage: '7d8', manaCost: 22, school: 'fire', cooldown: 2,
    detonate: { status: 'fire', dice: '4d8' }, statusEffect: fire(0.5, 4),
    description: 'Una lanza de azufre al rojo: muchísimo daño. Si el blanco ya se quemaba, explota (+4d8).' });
  R('infernal', 25, { id: 'apocalipsis', name: 'Apocalipsis', iconName: 'fireball', damage: '6d8', manaCost: 34, school: 'fire', area: true, cooldown: 5,
    statusEffect: fire(0.7, 5),
    description: 'El cielo se prende fuego y cae sobre todos los enemigos: muchísimo daño y casi todos quedan ardiendo (5 por turno).' });

  // Ángel · Magia celestial
  R('angel', 13, { id: 'rayo_justicia', name: 'Rayo de justicia', iconName: 'sun', damage: '5d6', bandDice: ['5d6', '5d6', '5d6', '5d6', '6d6'], manaCost: 12, school: 'holy', cooldown: 2,
    selfHeal: 4,
    description: 'Un rayo de luz que juzga a un enemigo: mucho daño y, si le da, te cierra algunas heridas.' });
  R('angel', 17, { id: 'gracia_divina', name: 'Gracia divina', iconName: 'heal', manaCost: 18, school: 'holy', cooldown: 5,
    partyHeal: { dice: '4d8', regen: 3, turns: 2, cleanse: true },
    description: 'La gracia baja sobre todo tu grupo: todos se curan bastante ahora, un poco más por 2 turnos, y se sacan de encima el veneno, el fuego, el sangrado y las maldiciones. No se suma con el de otro ángel.' });
  R('angel', 21, { id: 'coro_celestial', name: 'Coro celestial', iconName: 'sun', damage: '4d8', manaCost: 22, school: 'holy', area: true, cooldown: 4,
    stunChance: 0.2, noBoss: true,
    description: 'Un coro de luz canta sobre todos los enemigos: mucho daño y a algunos los deja paralizados un turno (a los jefes, no).' });
  R('angel', 25, { id: 'intervencion_divina', name: 'Intervención divina', iconName: 'heal', manaCost: 30, school: 'holy', cooldown: 7,
    partyHeal: { dice: '6d8', regen: 5, turns: 3, cleanse: true }, partyBuff: { turns: 3, stat: 'armor', mods: { armor: 5 } },
    description: 'El cielo interviene: todo tu grupo se cura muchísimo, recupera 5 de vida por turno y tiene +5 de armadura por 3 turnos (y se le van los estados malos). No se suma con el de otro ángel.' });

  // Hada · Magia feérica
  R('hada', 13, { id: 'polvo_estrellas', name: 'Polvo de estrellas', iconName: 'stars', damage: '5d6', bandDice: ['5d6', '5d6', '5d6', '5d6', '6d6'], manaCost: 12, school: 'light', cooldown: 2,
    statusEffect: { type: 'blind', chance: 0.5, turns: 2, value: 1 },
    description: 'Un puñado de estrellas que queman: mucho daño, y la mitad de las veces el blanco queda ciego.' });
  R('hada', 17, { id: 'danza_hadas', name: 'Danza de las hadas', iconName: 'blind', damage: '4d6', manaCost: 18, school: 'light', area: true, cooldown: 4,
    stagger: { value: 3 }, statusEffect: { type: 'blind', chance: 0.4, turns: 2, value: 1 },
    description: 'Una ronda de hadas alrededor de todos los enemigos: daño, quedan mareados (−3 de precisión en su próximo ataque) y algunos, ciegos.' });
  R('hada', 21, { id: 'rayo_feerico', name: 'Rayo feérico', iconName: 'star', damage: '7d8', manaCost: 22, school: 'light', cooldown: 2,
    stunChance: 0.3, noBoss: true,
    description: 'Un rayo de todos los colores: muchísimo daño a un enemigo y a veces lo deja embobado sin moverse un turno (a los jefes, no).' });
  R('hada', 25, { id: 'reino_suenos', name: 'El reino de los sueños', iconName: 'moon', damage: '4d8', manaCost: 32, school: 'light', area: true, cooldown: 6,
    sleep: { chance: 0.8, bossStagger: 4 },
    description: 'Abrís la puerta del reino de los sueños: todos los enemigos reciben daño y casi todos se duermen (pierden su próximo turno). Los jefes no se duermen: se marean (−4 de precisión).' });

  // Dríade · Magia natural
  R('driade', 13, { id: 'espinas_bosque', name: 'Espinas del bosque', iconName: 'herb', damage: '5d6', bandDice: ['5d6', '5d6', '5d6', '5d6', '6d6'], manaCost: 12, school: 'nature', cooldown: 2,
    statusEffect: { type: 'poison', chance: 0.6, turns: 3, value: 3 },
    description: 'Espinas que salen del suelo y atraviesan a un enemigo: mucho daño y casi siempre lo envenenan (3 por turno, 3 turnos).' });
  R('driade', 17, { id: 'savia_vital', name: 'Savia vital', iconName: 'heal', manaCost: 16, school: 'nature', cooldown: 5,
    partyHeal: { dice: '3d8', regen: 3, turns: 3 },
    description: 'La savia del bosque corre por todo tu grupo: todos se curan ahora y 3 de vida por turno, por 3 turnos. No se suma con la de otra dríade.' });
  R('driade', 21, { id: 'furia_bosque', name: 'Furia del bosque', iconName: 'herb', damage: '5d6', manaCost: 22, school: 'nature', area: true, cooldown: 4,
    stunChance: 0.3, noBoss: true, statusEffect: { type: 'poison', chance: 0.5, turns: 3, value: 3 },
    description: 'El bosque entero se enoja: ramas y raíces golpean a todos los enemigos, a algunos los atrapan (pierden el turno; a los jefes, no) y a la mitad los envenenan.' });
  R('driade', 25, { id: 'corazon_bosque', name: 'Corazón del bosque', iconName: 'herb', damage: '5d8', manaCost: 32, school: 'nature', area: true, cooldown: 6,
    partyBuff: { turns: 3, stat: 'armor', mods: { armor: 4, regen: 4 } },
    description: 'El corazón del bosque late con vos: muchísimo daño a todos los enemigos, y tu grupo tiene +4 de armadura y recupera 4 de vida por turno (3 turnos).' });

  // ---------------------------------------------------------------
  // 5) Las escuelas apuntan a sus poderes nuevos (y a sus dos pruebas nuevas)
  //    Las técnicas de los guerreros están en js/systems/techniques.js.
  // ---------------------------------------------------------------
  const NEW = {
    humano: ['estocada_sellada', 'maestria_duelo', 'sello_multiple', 'avatar_arcano'],
    elfo: ['flecha_plata', 'bendicion_lunar', 'rayo_luna', 'luna_eterna'],
    mediano: ['moneda_aire', 'racha_suerte', 'veneno_cienaga', 'gran_fortuna'],
    draconido: ['garra_ignea', 'corazon_dragon', 'aliento_abrasador', 'forma_dragon'],
    vampiro: ['lanza_sangre', 'sed_insaciable', 'marea_carmesi', 'senor_noche'],
    elfo_oscuro: ['daga_sombra', 'noche_cerrada', 'toque_penumbra', 'eclipse_total'],
    gnomo: ['bobina_tesla', 'red_electrica', 'rayo_concentrado', 'gran_tormenta'],
    alienigena: ['lanza_plasma', 'colapso_gravitatorio', 'dominio_mental', 'bombardeo_orbital'],
    infernal: ['llamarada_abismo', 'infierno_desatado', 'lanza_azufre', 'apocalipsis'],
    angel: ['rayo_justicia', 'gracia_divina', 'coro_celestial', 'intervencion_divina'],
    hada: ['polvo_estrellas', 'danza_hadas', 'rayo_feerico', 'reino_suenos'],
    driade: ['espinas_bosque', 'savia_vital', 'furia_bosque', 'corazon_bosque'],
    enano: ['martillo_montana', 'juramento_piedra', 'golpe_sismico', 'rey_montana'],
    orco: ['golpe_brutal', 'sed_batalla', 'masacre', 'caudillo_guerra'],
    robot: ['descarga_nucleo', 'blindaje_reactivo', 'protocolo_exterminio', 'modo_guerra'],
    goliat: ['pisoton_titanico', 'fuerza_montana', 'lanzamiento_roca', 'terremoto'],
    minotauro: ['embestida_furiosa', 'furia_laberinto', 'estampida', 'rey_laberinto'],
    licantropo: ['desgarro', 'llamado_manada', 'frenesi_lunar', 'alfa_manada'],
  };
  for (const sc of S.schools || []) {
    const ids = NEW[sc.race];
    if (!ids) continue;
    [sc.r13, sc.r17, sc.r21, sc.r25] = ids;
    sc.trial17 = `escuela_${sc.race}_17`;
    sc.trial25 = `escuela_${sc.race}_25`;
  }

  // ---------------------------------------------------------------
  // 6) Las 36 pruebas nuevas (nivel 17 y nivel 25). Las da tu maestro; al volver, te enseña.
  // ---------------------------------------------------------------
  const quest = (o) => { if (!byId(S.quests, o.id)) S.quests.push(Object.assign({ school: true, turnIn: true, _source: SRC }, o)); };
  const MASTER = {}; for (const sc of S.schools || []) MASTER[sc.race] = sc.master;
  const SHORT = { humano: 'Aldric', elfo: 'Ilyana', mediano: 'La tía Pippa', draconido: 'Vharax', vampiro: 'Lady Morwen', elfo_oscuro: 'Szarith', gnomo: 'Fizzi', alienigena: 'Xo\'ren', infernal: 'Ceniza', angel: 'Sor Celestine', hada: 'Brizna', driade: 'Madre Sauce', enano: 'Borin', orco: 'Grumak', robot: 'La Unidad K-7', goliat: 'Kaya', minotauro: 'Varg', licantropo: 'Fenrik' };
  const who = (race) => SHORT[race] || 'Tu maestro';
  /** rank 17 o 25 · enemy, count, where (texto), title, offer, done */
  function T(race, rank, o) {
    const ids = NEW[race];
    const learn = rank === 17 ? ids[1] : ids[3];
    const enemy = (S.enemies || []).find((e) => e.id === o.enemy);
    const name = enemy ? enemy.name.toLowerCase() : o.enemy;
    quest({
      id: `escuela_${race}_${rank}`, race, minLevel: rank, giver: MASTER[race], title: o.title, offer: o.offer,
      text: `${who(race)} quiere que derrotes a ${o.count === 1 ? `un${o.fem ? 'a' : ''} ${name}` : `${o.count} ${o.plural || `${name}s`}`} (${o.where}).`,
      objectives: [{ type: 'kill', enemy: o.enemy, count: o.count, text: o.goal }],
      done: o.done, reward: { xp: rank === 17 ? 2000 : 5000, learn },
    });
  }
  // --- nivel 17 ---
  T('humano', 17, { title: 'Un duelo en el abismo', enemy: 'caballero_abismo', count: 2, plural: 'caballeros del abismo', where: 'Abismo de las Sombras', goal: 'Derrotá caballeros del abismo',
    offer: 'Ya ganaste duelos. Ahora ganalos contra los mejores: en el Abismo de las Sombras hay caballeros que no conocen el miedo. Derrotá a dos.', done: 'Dos caballeros del abismo. Ya no peleás: dirigís el duelo.' });
  T('elfo', 17, { title: 'Luz contra la pesadilla', enemy: 'pesadilla_esmeralda', count: 3, plural: 'pesadillas esmeralda', fem: true, where: 'Linde del Sueño', goal: 'Derrotá pesadillas esmeralda',
    offer: 'En el Linde del Sueño las pesadillas le tapan la luna a los que duermen. Derrotá a tres y la luna te va a bendecir a vos y a los tuyos.', done: 'La luna volvió a brillar en el Linde. Su bendición es tuya.' });
  T('mediano', 17, { title: 'El acertijo de la esfinge', enemy: 'esfinge', count: 1, fem: true, where: 'Ruinas Celestes', goal: 'Derrotá a una esfinge',
    offer: 'Las esfinges de las Ruinas Celestes no pierden nunca un acertijo. Andá y ganale a una... aunque sea a los golpes. La suerte también es saber cuándo dejar de pensar.', done: '¡Le ganaste a una esfinge! Eso es una racha de suerte de verdad.' });
  T('draconido', 17, { title: 'El llamado de los picos', enemy: 'draconido_elite', count: 2, plural: 'dracónidos de élite', where: 'Picos del Dragón', goal: 'Derrotá dracónidos de élite',
    offer: 'En los Picos del Dragón viven los dracónidos de élite: la guardia de los dragones viejos. Derrotá a dos y tu corazón va a latir como el de ellos.', done: 'Ahora tu sangre arde como la de un dragón.' });
  T('vampiro', 17, { title: 'Almas para la sed', enemy: 'devorador_almas', count: 2, plural: 'devoradores de almas', where: 'Abismo de las Sombras', goal: 'Derrotá devoradores de almas',
    offer: 'Los devoradores de almas del Abismo de las Sombras se creen los únicos que se alimentan de los demás. Demostrales lo contrario: dos.', done: 'Esa sed que sentís ya no se va. Bien: usala.' });
  T('elfo_oscuro', 17, { title: 'Sombras más oscuras', enemy: 'sombra_viviente', count: 3, plural: 'sombras vivientes', fem: true, where: 'Abismo de las Sombras', goal: 'Derrotá sombras vivientes',
    offer: 'Hay sombras que caminan solas en el Abismo de las Sombras. Si podés apagar tres, la noche te va a obedecer.', done: 'La noche cerrada ya es tuya.' });
  T('gnomo', 17, { title: 'Cristal conductor', enemy: 'golem_cristal', count: 2, plural: 'gólems de cristal', where: 'Desierto de Cristal', goal: 'Derrotá gólems de cristal',
    offer: '¡Los gólems del Desierto de Cristal conducen la electricidad de una forma fascinante! Derrotá a dos y traeme los datos (o los pedazos).', done: '¡Lo sabía! Con eso termino la red. ¡Es tuya!' });
  T('alienigena', 17, { title: 'El gusano del desierto', enemy: 'gusano_cristal', count: 1, where: 'Desierto de Cristal', goal: 'Derrotá a un gran gusano de cristal',
    offer: 'Un gran gusano de cristal hace vibrar todo el desierto: su ruido no me deja oír a la nave. Derrotalo y vas a poder plegar el aire como quieras.', done: 'Silencio. Ahora la gravedad te escucha.' });
  T('infernal', 17, { title: 'Fuego contra sombra', enemy: 'demonio_sombras', count: 2, plural: 'engendros de las sombras', where: 'Abismo de las Sombras', goal: 'Derrotá engendros de las sombras',
    offer: 'En el Abismo de las Sombras hay engendros que se creen demonios. Mostrales qué es el fuego de verdad: dos.', done: 'Ardieron. Ahora sabés desatar el infierno.' });
  T('angel', 17, { title: 'Los que cayeron', enemy: 'angel_caido', count: 2, plural: 'ángeles caídos', where: 'Ruinas Celestes', goal: 'Derrotá ángeles caídos',
    offer: 'En las Ruinas Celestes hay ángeles que se olvidaron de cuidar a nadie. Duele, pero hay que detenerlos: dos.', done: 'Descansan. Y vos aprendiste qué es la gracia.' });
  T('hada', 17, { title: 'Hadas con pesadillas', enemy: 'hada_pesadilla', count: 3, plural: 'hadas de la pesadilla', fem: true, where: 'Linde del Sueño', goal: 'Derrotá hadas de la pesadilla',
    offer: 'Unas primas mías se quedaron atrapadas en una pesadilla, en el Linde del Sueño. Despertalas a los golpes, ¡son tres!', done: '¡Despertaron! Te enseñaron su danza para agradecerte.' });
  T('driade', 17, { title: 'El árbol que sueña', enemy: 'arbol_sonador', count: 2, plural: 'árboles soñadores', where: 'Linde del Sueño', goal: 'Derrotá árboles soñadores',
    offer: 'En el Linde del Sueño hay árboles que sueñan pesadillas y lastiman a todos. Liberá a dos y su savia va a correr por vos.', done: 'Ahora duermen tranquilos. Su savia es tuya.' });
  T('enano', 17, { title: 'Más duro que la piedra', enemy: 'golem_cristal', count: 2, plural: 'gólems de cristal', where: 'Desierto de Cristal', goal: 'Derrotá gólems de cristal',
    offer: 'Dicen que en el Desierto de Cristal hay gólems más duros que la piedra. Ningún enano se lo cree. Andá y probá que tienen razón... o no. Dos.', done: 'Más duros que la piedra, decían. Ja. Hacé tu juramento.' });
  T('orco', 17, { title: 'La gran cacería', enemy: 'roc', count: 2, plural: 'rocs', where: 'Cumbre del Mundo', goal: 'Derrotá rocs',
    offer: 'En la Cumbre del Mundo hay pájaros tan grandes que se llevan a un ogro. ¡Bajá a dos y vas a tener sed de batalla para siempre!', done: '¡Dos rocs! La horda va a cantar esto por años.' });
  T('robot', 17, { title: 'Prueba de resistencia', enemy: 'golem_cristal', count: 2, plural: 'gólems de cristal', where: 'Desierto de Cristal', goal: 'Derrotá gólems de cristal',
    offer: 'PRUEBA DE RESISTENCIA: blindaje reactivo pendiente. Objetivo: dos gólems de cristal, Desierto de Cristal. Proceder.', done: 'PRUEBA SUPERADA. Blindaje reactivo instalado.' });
  T('goliat', 17, { title: 'El titán del cielo', enemy: 'titan_celeste', count: 1, where: 'Cumbre del Mundo', goal: 'Derrotá a un titán celeste',
    offer: 'En la Cumbre del Mundo camina un titán celeste. Es más grande que vos. Por eso tenés que ganarle.', done: 'Le ganaste a un titán. La fuerza de la montaña ya es tuya.' });
  T('minotauro', 17, { title: 'Cuernos contra escamas', enemy: 'guiverno_ancestral', count: 2, plural: 'guivernos ancestrales', where: 'Picos del Dragón', goal: 'Derrotá guivernos ancestrales',
    offer: 'En los Picos del Dragón vuelan guivernos que nunca tocaron el suelo. Bajalos de una embestida: dos.', done: 'Bien. Ahora la furia del laberinto te sigue a todos lados.' });
  T('licantropo', 17, { title: 'Cazar una tormenta', enemy: 'dragon_tormenta', count: 1, where: 'Picos del Dragón o Cumbre del Mundo', goal: 'Derrotá a un dragón de la tormenta',
    offer: 'La manada caza lo que se mueve. Un dragón de la tormenta se mueve mucho. Cazalo y la manada te va a seguir.', done: 'La manada ya te reconoce. Cuando aulles, va a venir.' });
  // --- nivel 25 ---
  T('humano', 25, { title: 'El último duelo', enemy: 'pecado_soberbia', count: 1, where: 'Ciudad de Dite', goal: 'Derrotá al Pecado de la soberbia',
    offer: 'Te queda un rival: el más orgulloso de todos. Vive en la Ciudad de Dite y se cree invencible. Derrotalo y no te voy a poder enseñar nada más.', done: 'Ya no sos mi alumno. Sos un avatar de la magia de los humanos.' });
  T('elfo', 25, { title: 'La luz más alta', enemy: 'serafin', count: 1, where: 'El Empíreo', goal: 'Derrotá a un serafín',
    offer: 'En el Empíreo arden los serafines: la única luz más alta que la luna. Enfrentá a uno... a flechazos. Si ganás, la luna va a quedarse con vos para siempre.', done: 'La luna eterna te acompaña. No hay nada más que pueda enseñarte.' });
  T('mediano', 25, { title: 'Todo o nada', enemy: 'pecado_avaricia', count: 2, plural: 'pecados de la avaricia', where: 'Círculo de los Pecados', goal: 'Derrotá pecados de la avaricia',
    offer: 'La avaricia es la peor enemiga de la suerte. En el Círculo de los Pecados hay dos que se creen dueñas de toda la fortuna del mundo. Demostrales que no.', done: '¡Todo! Ahora la gran fortuna es de tu familia entera.' });
  T('draconido', 25, { title: 'La ira del dragón', enemy: 'pecado_ira', count: 2, plural: 'pecados de la ira', where: 'Ciudad de Dite', goal: 'Derrotá pecados de la ira',
    offer: 'Hay una ira más vieja que los dragones en la Ciudad de Dite. Derrotá a dos pecados de la ira y vas a poder ser dragón de verdad.', done: 'Ya no hace falta que te lo diga: sos un dragón.' });
  T('vampiro', 25, { title: 'Dueña de la noche', enemy: 'pecado_lujuria', count: 1, where: 'Círculo de los Pecados o Ciudad de Dite', goal: 'Derrotá al Pecado de la lujuria',
    offer: 'Solo una criatura en el mundo encanta mejor que nosotras: el Pecado de la lujuria. Derrotala y la noche va a ser tuya.', done: 'La noche te pertenece. Yo ya no tengo nada que enseñarte.' });
  T('elfo_oscuro', 25, { title: 'Envidia de la sombra', enemy: 'pecado_envidia', count: 2, plural: 'pecados de la envidia', where: 'Círculo de los Pecados', goal: 'Derrotá pecados de la envidia',
    offer: 'Dos pecados de la envidia, en el Círculo de los Pecados, quieren lo que vos tenés: tu sombra. Apagalos.', done: 'Ahora podés apagar el sol cuando quieras.' });
  T('gnomo', 25, { title: 'Ingeniería de otro mundo', enemy: 'robot_centinela', count: 2, plural: 'robots centinela', where: 'La Nave Nodriza', goal: 'Derrotá robots centinela',
    offer: '¡En la Nave Nodriza hay robots centinela! ¡Con circuitos que nunca vi! Derrotá a dos y desarmamos todo para hacer la gran tormenta.', done: '¡FUNCIONA! La gran tormenta gnoma es tuya. Y la patente, mía.' });
  T('alienigena', 25, { title: 'Volver a la nave', enemy: 'comandante_gris', count: 2, plural: 'comandantes grises', where: 'La Nave Nodriza', goal: 'Derrotá comandantes grises',
    offer: 'Hay una nave allá arriba que no es la tuya, y dos comandantes grises que dan las órdenes. Derrotalos y tu nave va a poder disparar con todo.', done: 'Tu nave tiene vía libre. Que llueva el bombardeo.' });
  T('infernal', 25, { title: 'Las puertas de Dite', enemy: 'pecado_ira', count: 2, plural: 'pecados de la ira', where: 'Ciudad de Dite', goal: 'Derrotá pecados de la ira',
    offer: 'En la Ciudad de Dite la ira arde más que mi fuego. Eso no lo puedo permitir. Apagá a dos pecados de la ira con un fuego mayor.', done: 'Ahora tu fuego es el más grande. Apocalipsis, se llama.' });
  T('angel', 25, { title: 'La caída del orgullo', enemy: 'pecado_soberbia', count: 1, where: 'Ciudad de Dite', goal: 'Derrotá al Pecado de la soberbia',
    offer: 'El orgullo fue lo que hizo caer a los primeros ángeles. Vive en la Ciudad de Dite. Derrotalo y el cielo va a intervenir cada vez que lo llames.', done: 'El cielo te escucha. Cuidá a los tuyos.' });
  T('hada', 25, { title: 'Dominar el sueño', enemy: 'dominacion', count: 2, plural: 'dominaciones', fem: true, where: 'Salones de la Luz o El Empíreo', goal: 'Derrotá dominaciones',
    offer: 'Las dominaciones de los Salones de la Luz no duermen nunca. ¡Nunca! Eso es imposible. Derrotá a dos y te abro la puerta del reino de los sueños.', done: '¡Te doy la bienvenida al reino de los sueños! Ahora también es tuyo.' });
  T('driade', 25, { title: 'Raíces en la luna', enemy: 'gusano_lunar', count: 2, plural: 'gusanos lunares', where: 'La Luna Rota', goal: 'Derrotá gusanos lunares',
    offer: 'En la Luna Rota hay gusanos que se comen las raíces de todo lo que crece. Derrotá a dos y el corazón del bosque va a latir con vos.', done: 'El corazón del bosque late con el tuyo.' });
  T('enano', 25, { title: 'La forja de las estrellas', enemy: 'robot_centinela', count: 2, plural: 'robots centinela', where: 'La Nave Nodriza', goal: 'Derrotá robots centinela',
    offer: 'Dicen que en la Nave Nodriza hay guardianes de metal que ningún martillo rompe. Ningún martillo enano, dicen. Andá y mostrales. Dos.', done: 'Ningún martillo, decían. Sos el rey bajo la montaña.' });
  T('orco', 25, { title: 'La guerra de las estrellas', enemy: 'cazador_estelar', count: 3, plural: 'cazadores estelares', where: 'La Luna Rota', goal: 'Derrotá cazadores estelares',
    offer: 'En la Luna Rota hay cazadores que cruzaron las estrellas para pelear. ¡Por fin una pelea de verdad! Derrotá a tres y la horda te va a seguir a donde vayas.', done: '¡CAUDILLO! La horda es tuya.' });
  T('robot', 25, { title: 'Protocolo final', enemy: 'comandante_gris', count: 2, plural: 'comandantes grises', where: 'La Nave Nodriza', goal: 'Derrotá comandantes grises',
    offer: 'PROTOCOLO FINAL. Objetivo: dos comandantes grises, Nave Nodriza. Probabilidad de éxito: suficiente. Proceder.', done: 'PROTOCOLO FINAL COMPLETO. Modo de guerra total: habilitado.' });
  T('goliat', 25, { title: 'Más alto que el cielo', enemy: 'querubin', count: 2, plural: 'querubines', where: 'El Empíreo', goal: 'Derrotá querubines',
    offer: 'En el Empíreo vuelan querubines por encima de todo. Para hacer temblar el mundo tenés que bajar a dos.', done: 'Cuando golpees el suelo, va a temblar el mundo entero.' });
  T('minotauro', 25, { title: 'La arena de Dite', enemy: 'pecado_ira', count: 2, plural: 'pecados de la ira', where: 'Ciudad de Dite', goal: 'Derrotá pecados de la ira',
    offer: 'En la Ciudad de Dite hay una arena donde pelea la ira en persona. Ganá dos peleas ahí y no va a quedar laberinto que no sea tuyo.', done: 'Rey del laberinto. Ya no tengo nada que enseñarte.' });
  T('licantropo', 25, { title: 'La última cacería', enemy: 'cancerbero', count: 3, plural: 'cancerberos', where: 'Río Estigia', goal: 'Derrotá cancerberos',
    offer: 'En el Río Estigia hay perros de tres cabezas que cuidan la puerta del infierno. Cazá a tres y vas a ser el alfa de cualquier manada.', done: 'Sos el alfa. La manada entera aúlla con vos.' });
})(window.Aventurs);
