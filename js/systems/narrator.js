/* ============================================================
   Aventurs — Narrador de combate (v1.9.1)
   Convierte cada acción del combate en una frase de relato:
     "El lobo se lanza y te muerde: 5 de daño."
     "Tu daga se hunde en el goblin: 4 de daño."
   La frase se elige una sola vez (al pasar la acción) y queda
   guardada en el registro como entry.say = { text, tone }.
   Si una línea es puramente técnica (orden de turnos, contadores)
   devuelve null y la vista solo la muestra en "Ver tiradas".
   ============================================================ */

(function (A) {
  'use strict';

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const fill = (tpl, v) => tpl.replace(/\{(\w+)\}/g, (_, k) => (v[k] != null ? v[k] : ''));

  // ---------- Artículos (la araña, el lobo, Brightwing) ----------
  const FEM = new Set([
    'kitsune', // v3.7
    'rata', 'arana', 'serpiente', 'tortuga', 'arpia', 'rata_gigante', 'banshee', 'gargola', 'sirena',
    'driade', 'salamandra', 'medusa', 'naga', 'manticora', 'serp_marina', 'aparicion', 'quimera', 'hidra', 'tarrasca',
    // v2.5: las que se sumaron después ("la bruja", no "el bruja")
    'bruja', 'hada_traviesa', 'polilla_onirica', 'noble_vampira', 'momia', 'bestia_sangre', 'pesadilla',
  ]);
  const PROPER = new Set(['brightwing', 'alamuerte']);
  // v3.0: femeninas que empiezan con "a" tónica llevan "el"/"un" (el hada, un hada), pero siguen siendo "la" de pronombre
  const ART_EL = new Set(['hada_traviesa']);
  function artOf(id) { return FEM.has(id) && !ART_EL.has(id) ? 'la' : 'el'; }

  function enemyNoun(inst) {
    if (!inst) return 'el enemigo';
    const name = inst.displayName || inst.name || 'enemigo';
    if (PROPER.has(inst.id)) return name;
    const lower = name.charAt(0).toLowerCase() + name.slice(1);
    let art = artOf(inst.id);
    if (!FEM.has(inst.id) && !A.Data.getById('enemies', inst.id) && /a$/i.test(inst.name || '')) art = 'la';
    return `${art} ${lower}`;
  }

  function petNoun(pet) {
    if (!pet) return 'tu mascota';
    const species = A.Data.getById('enemies', pet.species);
    if (species && species.name === pet.name) return `tu ${pet.name.charAt(0).toLowerCase()}${pet.name.slice(1)}`;
    return pet.name;
  }

  function findEnemy(c, key) {
    if (!c || !key || !String(key).startsWith('enemy:')) return null;
    const id = String(key).slice(6);
    return (c.enemies || []).find((e) => e.instanceId === id) || null;
  }

  // ---------- Cómo ataca cada criatura ----------
  // v: verbo en 3ª persona · inf: infinitivo con "te" (para las esquivas)
  const STYLES = {
    bite: { v: 'muerde', inf: 'morderte', alt: ['te clava los dientes', 'se te tira encima y te muerde'] },
    claw: { v: 'araña', inf: 'arañarte', alt: ['te da un zarpazo', 'te desgarra con las garras'] },
    gore: { v: 'embiste', inf: 'embestirte', alt: ['te embiste con los colmillos', 'carga contra vos'] },
    peck: { v: 'picotea', inf: 'alcanzarte', alt: ['se lanza en picada sobre vos', 'te ataca con las garras'] },
    sting: { v: 'pica', inf: 'picarte', alt: ['te clava el aguijón', 'te pica con fuerza'] },
    pinch: { v: 'aprieta', inf: 'atraparte', alt: ['te aprieta con sus pinzas', 'te atrapa con una pinza'] },
    slam: { v: 'golpea', inf: 'golpearte', alt: ['te aplasta con un golpe brutal', 'te da un golpe que te sacude entero'] },
    lash: { v: 'azota', inf: 'azotarte', alt: ['te azota con un tentáculo', 'te enrosca y te aprieta'] },
    chill: { v: 'atraviesa', inf: 'tocarte', alt: ['te atraviesa con un frío de tumba', 'te roza y te hiela la sangre'] },
    burn: { v: 'quema', inf: 'quemarte', alt: ['te envuelve en llamas', 'te lanza una lengua de fuego'] },
    freeze: { v: 'congela', inf: 'congelarte', alt: ['te lanza esquirlas de hielo', 'te cubre de escarcha'] },
    zap: { v: 'golpea', inf: 'alcanzarte', alt: ['te lanza un rayo de energía', 'te alcanza con un destello arcano'] },
    acid: { v: 'quema', inf: 'envolverte', alt: ['te salpica con su cuerpo ácido', 'te envuelve y te quema'] },
    magic: { v: 'golpea', inf: 'alcanzarte', alt: ['te lanza un rayo de magia oscura', 'conjura una descarga que te alcanza'] },
    shoot: { v: 'hiere', inf: 'acertarte', alt: ['te dispara una flecha', 'te alcanza con una flecha'] },
    weapon: { v: 'hiere', inf: 'golpearte', alt: ['te alcanza con su {w}', 'te ataca con su {w}'] },
  };

  const STYLE_BY_ID = {
    rata: 'bite', rata_gigante: 'bite', lobo: 'bite', perro_salvaje: 'bite', zorro: 'bite', murcielago: 'bite',
    serpiente: 'bite', serp_marina: 'bite', tiburon: 'bite', arana: 'bite', necrofago: 'bite', zombi: 'bite',
    gato: 'claw', oso: 'claw', licantropo: 'claw', manticora: 'claw', quimera: 'claw', gargola: 'claw', arpia: 'claw',
    jabali: 'gore', tortuga: 'gore', tarrasca: 'gore', minotauro: 'gore',
    cuervo: 'peck', halcon: 'peck', aguila: 'peck', buho: 'peck', fenix: 'burn',
    escorpion: 'sting', cangrejo: 'pinch', tentaculo: 'lash', kraken: 'lash',
    golem: 'slam', golem_lava: 'burn', ent: 'slam', ogro: 'weapon', troll: 'weapon', ettin: 'weapon', ciclope: 'weapon', titan: 'weapon',
    fantasma: 'chill', banshee: 'chill', espectro: 'chill', aparicion: 'chill',
    elem_fuego: 'burn', elem_hielo: 'freeze', elem_arcano: 'zap', slime: 'acid', contemplador: 'zap',
    mago_oscuro: 'magic', nigromante: 'magic', archimago: 'magic', lich: 'magic', driade: 'magic', sucubo: 'magic',
    medusa: 'shoot',
    dragon_joven: 'claw', dragon_anciano: 'burn', alamuerte: 'burn', brightwing: 'claw', hidra: 'bite', balrog: 'burn',
  };

  const WEAPON_NOUN = {
    sword: 'espada', bigsword: 'mandoble', dagger: 'daga', axe: 'hacha', greataxe: 'hacha', club: 'garrote',
    hammer: 'martillo', staff: 'bastón', 'staff-skull': 'bastón', spear: 'lanza', trident: 'tridente', bow: 'arco',
    whip: 'látigo', scythe: 'guadaña', wand: 'varita', gun: 'arma', none: 'puño',
  };

  function styleOf(inst) {
    if (!inst) return { ...STYLES.slam, w: 'arma' };
    const spec = A.Sprites && A.Sprites.SPECIES ? A.Sprites.SPECIES[inst.id] : null;
    const weaponKind = spec && spec.o && spec.o.weapon;
    let key = STYLE_BY_ID[inst.id];
    if (!key && weaponKind && weaponKind !== 'none') key = 'weapon';
    if (!key) {
      const fam = inst.family || [];
      const tags = inst.tags || [];
      if (tags.includes('fire')) key = 'burn';
      else if (tags.includes('ice')) key = 'freeze';
      else if (fam.includes('spirit')) key = 'chill';
      else if (fam.includes('construct') || fam.includes('giant')) key = 'slam';
      else if (fam.includes('insect')) key = 'sting';
      else if (fam.includes('flying')) key = 'peck';
      else if (fam.includes('humanoid') || fam.includes('demon')) key = 'weapon';
      else key = 'bite';
    }
    let w = weaponKind ? WEAPON_NOUN[weaponKind] : null;
    if (inst.equippedWeapon) {
      const wd = A.Data.getById('weapons', inst.equippedWeapon);
      if (wd) w = wd.name.toLowerCase();
    }
    if (key === 'weapon' && !w) key = 'slam';
    return { ...STYLES[key], w: w || 'arma' };
  }

  // ---------- Jugador ----------
  const PLAYER_HIT = {
    dagger: ['Tu daga se hunde en {e}: {d} de daño.', 'Encontrás un hueco y le clavás la daga a {e}: {d} de daño.', 'Un corte rápido de tu daga hiere a {e}: {d} de daño.'],
    sword: ['Tu espada alcanza a {e}: {d} de daño.', 'Un tajo limpio cruza a {e}: {d} de daño.', 'Descargás la espada sobre {e}: {d} de daño.'],
    axe: ['Tu hacha cae con todo su peso sobre {e}: {d} de daño.', 'El filo del hacha muerde a {e}: {d} de daño.'],
    blunt: ['Un golpe seco de tu {w} sacude a {e}: {d} de daño.', 'Aplastás a {e} con tu {w}: {d} de daño.'],
    staff: ['Golpeás a {e} con tu {w}: {d} de daño.', 'Tu {w} le da de lleno a {e}: {d} de daño.'],
    spear: ['Tu lanza atraviesa la guardia de {e}: {d} de daño.', 'Embestís con la lanza y alcanzás a {e}: {d} de daño.'],
    bow: ['Tu flecha silba y se clava en {e}: {d} de daño.', 'Tensás el arco y acertás a {e}: {d} de daño.'],
    scythe: ['La guadaña siega a {e}: {d} de daño.'],
    gun: ['Tu arma dispara un rayo que alcanza a {e}: {d} de daño.'],
    none: ['Le das un puñetazo a {e}: {d} de daño.', 'Golpeás a {e} con los puños: {d} de daño.'],
  };
  const PLAYER_CRIT = [
    '¡Golpe perfecto! Tu {w} da de lleno en {e}: {d} de daño.',
    '¡Crítico! Encontrás el punto débil de {e}: {d} de daño.',
    '¡Un golpe brutal! {E} se tambalea: {d} de daño.',
  ];
  const PLAYER_EVADED = ['{E} esquiva tu ataque en el último instante.', 'Tu {w} corta el aire: {e} ya no estaba ahí.', '{E} se aparta y tu golpe no llega.'];
  const PLAYER_FUMBLE = ['Tropezás y el ataque se pierde por completo.', 'Un mal paso: tu golpe ni se acerca a {e}.'];

  function playerWeapon() {
    const p = A.State.player;
    const w = p && p.equipment && p.equipment.weapon ? A.Data.getById('weapons', p.equipment.weapon) : null;
    const kind = A.Sprites && A.Sprites.weaponKindOf ? A.Sprites.weaponKindOf(w) : (w ? 'sword' : 'none');
    const group = { bigsword: 'sword', greataxe: 'axe', hammer: 'blunt', club: 'blunt', wand: 'staff' }[kind] || kind;
    return { kind, group, noun: w ? w.name.toLowerCase() : 'puño' };
  }

  // ---------- Hechizos ----------
  const SPELL_HIT = {
    fire: ['Las llamas de {s} envuelven a {e}: {d} de daño.', '{S} estalla sobre {e}: {d} de daño.'],
    ice: ['El frío cortante de {s} alcanza a {e}: {d} de daño.', 'Una ráfaga helada golpea a {e}: {d} de daño.'],
    shock: ['Una descarga de {s} sacude a {e}: {d} de daño.', 'Un chispazo salta de tus dedos y alcanza a {e}: {d} de daño.'],
    poison: ['{S} envenena a {e}: {d} de daño.'],
    arcane: ['La energía de {s} golpea a {e}: {d} de daño.', 'Conjurás {s} y {e} recibe el impacto: {d} de daño.'],
    holy: ['Una luz intensa castiga a {e}: {d} de daño.'],
  };

  // ---------- Efectos ----------
  const STATUS_PLAYER = {
    bleed: 'Empezás a sangrar.', poison: 'El veneno te entra en la sangre.', fire: 'Te prendés fuego.',
    cold: 'El frío te entumece los músculos.', shock: 'Una corriente te recorre el cuerpo.', blind: 'No ves nada.', silence: 'Te quedás sin voz.',
    // v2.5
    stun: 'Quedás aturdido: perdés el próximo turno.', curse: 'Una maldición cae sobre vos.', prone: 'Caés al suelo: te cuesta defenderte.',
    fear: 'El miedo te paraliza las manos.', grab: 'Quedás atrapado: no podés huir.', corrode: 'El ácido te carcome la armadura.',
  };
  const STATUS_OTHER = {
    bleed: '{E} empieza a sangrar.', poison: 'El veneno entra en la sangre de {e}.', fire: '{E} se prende fuego.',
    cold: 'El frío entumece a {e}.', shock: 'Una corriente recorre a {e}.', blind: '{E} no ve nada.', silence: '{E} se queda sin voz.',
    // v2.5
    stun: '{E} queda aturdido: pierde su próximo turno.', curse: 'Una maldición cae sobre {e}.', prone: '{E} cae al suelo.',
    fear: '{E} tiembla de miedo.', grab: '{E} queda atrapado.', corrode: 'El ácido carcome la coraza de {e}.',
  };
  const TICK_PLAYER = {
    bleed: 'Seguís sangrando: perdés {n} de vida.', poison: 'El veneno te quema por dentro: perdés {n} de vida.', fire: 'Las llamas te queman: perdés {n} de vida.',
  };
  const TICK_OTHER = {
    bleed: '{E} sangra: pierde {n} de vida.', poison: 'El veneno debilita a {e}: pierde {n} de vida.', fire: 'Las llamas queman a {e}: pierde {n} de vida.',
  };
  // Criaturas sin sangre (esqueletos, fantasmas, gólems, elementales)
  const STATUS_BLOODLESS = { bleed: 'La herida abierta debilita a {e}.', poison: 'El veneno corroe a {e}.' };
  const TICK_BLOODLESS = { bleed: 'La herida sigue abierta: {e} pierde {n} de vida.', poison: 'El veneno corroe a {e}: pierde {n} de vida.' };
  function bloodless(inst) {
    const fam = (inst && inst.family) || [];
    return fam.includes('undead') || fam.includes('spirit') || fam.includes('construct') || fam.includes('elemental');
  }

  function deathLine(inst) {
    const fam = (inst && inst.family) || [];
    if (inst && inst.id === 'slime') return pick(['{E} se derrite en un charco.', '{E} se deshace y queda quieto en el suelo.']);
    if (fam.includes('spirit') || (inst && (inst.tags || []).includes('ethereal'))) return pick(['{E} se desvanece con un último lamento.', '{E} se disuelve en el aire.']);
    if (fam.includes('undead')) return pick(['{E} se deshace en polvo.', '{E} se desarma y no vuelve a moverse.']);
    if (fam.includes('construct')) return pick(['{E} se desmorona en pedazos.']);
    if (fam.includes('elemental')) return pick(['{E} se apaga y desaparece.']);
    return pick(['{E} cae y no se levanta.', '{E} se desploma.', '{E} deja de moverse.']);
  }

  function coinsInWords(copper) {
    if (!copper) return '';
    const g = Math.floor(copper / 10000), s = Math.floor((copper % 10000) / 100), c = copper % 100;
    const parts = [];
    if (g) parts.push(`${g} ${g === 1 ? 'moneda' : 'monedas'} de oro`);
    if (s) parts.push(`${s} de plata`);
    if (c) parts.push(`${c} de cobre`);
    if (parts.length === 1 && !g && s && !c) parts[0] = `${s} ${s === 1 ? 'moneda' : 'monedas'} de plata`;
    if (parts.length === 1 && !g && !s) parts[0] = `${c} ${c === 1 ? 'moneda' : 'monedas'} de cobre`;
    return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}` : parts[0];
  }

  // ---------- Grupos: "un goblin, una rata y dos esqueletos" ----------
  const NUM = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho'];

  function pluralWord(w) {
    if (/^joven$/i.test(w)) return 'jóvenes';
    if (/[aeiouáéó]$/i.test(w)) return `${w}s`;
    if (/[íú]$/i.test(w)) return `${w}es`;
    if (/ón$/i.test(w)) return `${w.slice(0, -2)}ones`;
    if (/(or|al)$/i.test(w)) return `${w}es`;
    if (/z$/i.test(w)) return `${w.slice(0, -1)}ces`;
    if (/x$/i.test(w)) return w;
    return `${w}s`;
  }

  function pluralName(name) {
    const parts = name.split(' de ');
    parts[0] = parts[0].split(' ').map(pluralWord).join(' ');
    return parts.join(' de ');
  }

  function groupPhrase(enemies) {
    if (!enemies || !enemies.length) return null;
    const order = [];
    const byId = new Map();
    for (const e of enemies) {
      // v2.5: la élite ("lobo alfa") se nombra aparte
      const key = e.elite ? `${e.id}#elite` : e.id;
      if (!byId.has(key)) { byId.set(key, { inst: e, n: 0 }); order.push(key); }
      byId.get(key).n += 1;
    }
    const parts = order.map((key) => {
      const { inst, n } = byId.get(key);
      const id = inst.id;
      const data = A.Data.getById('enemies', id);
      const base = inst.elite ? inst.name : (data && data.name) || inst.name || inst.displayName || 'enemigo';
      if (PROPER.has(id)) return n > 1 ? `${NUM[n] || n} ${base}` : base;
      const lower = base.charAt(0).toLowerCase() + base.slice(1);
      if (n > 1) return `${NUM[n] || n} ${pluralName(lower)}`;
      return `${FEM.has(id) && !ART_EL.has(id) ? 'una' : 'un'} ${lower}`;
    });
    const text = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}` : parts[0];
    return { text, plural: enemies.length > 1 };
  }

  // ============================================================
  // Frase para una entrada del registro
  // ============================================================

  /** "a el goblin" → "al goblin", "de el" → "del". */
  function contract(text) {
    return String(text)
      .replace(/\b([Aa]) el /g, (m, a) => (a === 'A' ? 'Al ' : 'al '))
      .replace(/\b([Dd])e el /g, (m, d) => (d === 'D' ? 'Del ' : 'del '));
  }

  // Lo que agrega una pasiva al final de un golpe recibido
  const PASSIVE_SUFFIX = {
    piel_roca: ' Tu piel de roca frena la mitad del golpe.',
    determinacion: ' ¡Pero tu determinación te mantiene en pie!',
    // v3.1: el blindaje del robot
    cuerpo_metal: (e) => ((e && e.dmg === 0) ? ' Tu blindaje frena todo el golpe.' : e && e.absorbed ? ` Tu blindaje frena ${e.absorbed}.` : ' Tu blindaje frena parte del golpe.'),
  };
  function passiveSuffix(id, entry) {
    const x = PASSIVE_SUFFIX[id];
    return typeof x === 'function' ? x(entry) : (x || '');
  }

  // v2.5: el primer golpe contra una criatura con caparazón (o gelatinosa) hace la mitad
  const SOFT_SUFFIX = {
    caparazon: ' Su caparazón frena la mitad del golpe.',
    gelatinoso: ' El golpe se hunde en su cuerpo blando y pierde fuerza.',
  };

  function say(entry, c) {
    const out = sayRaw(entry, c);
    if (out && out.text) {
      const fx = entry.fx || {};
      const toPlayer = fx.target === 'player' && (fx.kind === 'attack' || fx.kind === 'tick');
      if (toPlayer && entry.passive && PASSIVE_SUFFIX[entry.passive]) out.text += passiveSuffix(entry.passive, entry);
      if (entry.softened && SOFT_SUFFIX[entry.softened]) out.text += SOFT_SUFFIX[entry.softened];
      out.text = contract(out.text);
    }
    return out;
  }

  /** Frases de las pasivas que se anuncian solas. */
  function passiveLine(entry, fx) {
    const effect = { poison: 'el veneno', bleed: 'el sangrado', fire: 'el fuego' }[fx.effect] || 'eso';
    switch (fx.passive) {
      case 'suerte': return { text: pick(['¡Suerte! Sacás un 1, pero el dado vuelve a rodar.', 'Un 1… pero la suerte de los medianos te da otra tirada.']), tone: 'good' };
      case 'furia': return { text: `La furia se apodera de vos: tus golpes hacen +${fx.amount || 2} de daño.`, tone: 'crit' };
      case 'cuerpo_metal': return { text: `Tu cuerpo de metal ni siente ${effect}.`, tone: 'good' };
      case 'sangre_dragon': return { text: 'Las llamas te rozan sin hacerte nada: tenés sangre de dragón.', tone: 'good' };
      default: return entry.text ? { text: entry.text, tone: 'good' } : null;
    }
  }

  function sayRaw(entry, c) {
    if (!entry || entry.type === 'turn-header') return null;
    const fx = entry.fx || {};
    if (fx.quiet) return null; // solo el número flotante (ej: maná de Mente expansiva)
    if (fx.kind === 'passive') return passiveLine(entry, fx);
    const p = A.State.player;
    const pet = p && p.pet;

    // Valores para las plantillas
    const targetInst = findEnemy(c, fx.target);
    const actorInst = findEnemy(c, fx.actor);
    const v = { d: entry.dmg, n: fx.amount };

    // --- Ataques con dado ---
    if (fx.kind === 'attack') {
      if (fx.actor === 'player') {
        const w = playerWeapon();
        Object.assign(v, { e: enemyNoun(targetInst), E: cap(enemyNoun(targetInst)), w: w.noun });
        // v2.1.1: golpe fuerte del guerrero
        if (entry.power && entry.result === 'crit') return { text: fill(pick(['¡Golpe fuerte y crítico! Tu {w} cae con todo sobre {e}: {d} de daño.', '¡Golpe fuerte y crítico! Partís la guardia de {e}: {d} de daño.']), v), tone: 'crit' };
        if (entry.power && entry.result === 'hit') return { text: fill(pick(['¡Golpe fuerte! Tu {w} cae con todo sobre {e}: {d} de daño.', '¡Golpe fuerte! Cargás todo tu peso contra {e}: {d} de daño.', '¡Golpe fuerte! {E} recibe el golpe de lleno: {d} de daño.']), v), tone: 'crit' };
        if (entry.power && entry.result !== 'fumble') return { text: fill(pick(['Cargás un golpe fuerte, pero {e} lo esquiva.', 'Tu golpe fuerte pasa de largo: {e} se agachó a tiempo.']), v), tone: 'neutral' };
        if (entry.result === 'crit' && entry.passive === 'golpe_gigante') return { text: fill(pick(['¡Golpe de gigante! Tu {w} aplasta a {e}: {d} de daño.', '¡Golpe de gigante! Descargás todo tu peso sobre {e}: {d} de daño.']), v), tone: 'crit' };
        if (entry.result === 'crit' && entry.passive === 'ojo_certero') return { text: fill(pick(['¡Ojo certero! Le das a {e} justo donde duele: {d} de daño.', '¡Ojo certero! Encontrás el hueco en la guardia de {e}: {d} de daño.']), v), tone: 'crit' };
        if (entry.result === 'crit') return { text: fill(pick(PLAYER_CRIT), v), tone: 'crit' };
        if (entry.result === 'hit') return { text: fill(pick(PLAYER_HIT[w.group] || PLAYER_HIT.sword), v), tone: 'good' };
        if (entry.result === 'fumble') return { text: fill(pick(PLAYER_FUMBLE), v), tone: 'bad' };
        return { text: fill(pick(PLAYER_EVADED), v), tone: 'neutral' };
      }
      if (fx.actor === 'pet') {
        Object.assign(v, { e: enemyNoun(targetInst), E: cap(enemyNoun(targetInst)), p: petNoun(pet), P: cap(petNoun(pet)) });
        const hungry = /hambre/.test(entry.text || '') ? ' Tiene hambre y pega con menos fuerza.' : '';
        if (entry.result === 'crit') return { text: fill('¡{P} encuentra un punto débil en {e}! {d} de daño.', v) + hungry, tone: 'crit' };
        if (entry.result === 'hit') return { text: fill(pick(['{P} se lanza sobre {e}: {d} de daño.', '{P} ataca a {e} con ferocidad: {d} de daño.', '{P} muerde a {e}: {d} de daño.']), v) + hungry, tone: 'good' };
        if (entry.result === 'fumble') return { text: fill('{P} se distrae y el ataque no sale.', v), tone: 'bad' };
        return { text: fill(pick(['{E} esquiva a {p}.', '{P} ataca, pero {e} se aparta.']), v), tone: 'neutral' };
      }
      // enemigo
      const st = styleOf(actorInst);
      Object.assign(v, { e: enemyNoun(actorInst), E: cap(enemyNoun(actorInst)), w: st.w, p: petNoun(pet), P: cap(petNoun(pet)), lo: actorInst && FEM.has(actorInst.id) ? 'la' : 'lo' });
      const alt = (s) => s.replace('{w}', st.w);
      if (fx.target === 'pet') {
        if (entry.result === 'crit') return { text: fill(`¡{E} ${st.v} a {p} con furia! {d} de daño.`, v), tone: 'bad' };
        if (entry.result === 'hit') return { text: fill(`{E} ${st.v} a {p}: {d} de daño.`, v), tone: 'bad' };
        if (entry.result === 'fumble') return { text: fill('{E} se tropieza y pierde el ataque.', v), tone: 'good' };
        return { text: fill('{P} esquiva a {e}.', v), tone: 'good' };
      }
      if (entry.result === 'crit') return { text: fill(pick([`¡{E} te ${st.v} con una fuerza brutal! {d} de daño.`, `¡Golpe crítico! {E} ${alt(pick(st.alt))}: {d} de daño.`]), v), tone: 'bad' };
      if (entry.result === 'hit') {
        if (/huida/.test(entry.text || '')) return { text: fill(`Al darte vuelta, {e} te ${st.v}: {d} de daño.`, v), tone: 'bad' };
        return { text: fill(pick([`{E} te ${st.v}: {d} de daño.`, `{E} ${alt(pick(st.alt))}: {d} de daño.`, `{E} ${alt(pick(st.alt))}. Perdés {d} de vida.`]), v), tone: 'bad' };
      }
      if (entry.result === 'fumble') return { text: fill(pick(['{E} se tropieza y pierde el ataque.', '{E} ataca sin ninguna puntería.']), v), tone: 'good' };
      if (entry.passive === 'suerte') return { text: fill(pick(['¡Suerte! {E} te tenía, pero el golpe pasa de largo.', '¡Suerte! Te tropezás justo a tiempo y {e} no te toca.']), v), tone: 'good' };
      return { text: fill(pick([`{E} intenta ${st.inf}, pero {lo} esquivás.`, 'Te corrés a tiempo y {e} no te alcanza.', '{E} falla por poco.']), v), tone: 'good' };
    }

    // --- Hechizos y objetos ---
    if (fx.kind === 'spell') {
      const spell = entry.spell || 'el hechizo';
      Object.assign(v, { e: enemyNoun(targetInst), E: cap(enemyNoun(targetInst)), s: spell, S: cap(spell) });
      return { text: fill(pick(SPELL_HIT[fx.element] || SPELL_HIT.arcane), v), tone: 'good' };
    }
    if (fx.kind === 'heal') {
      if (fx.passive === 'bendicion') return { text: pick([`Una luz te envuelve y te cierra las heridas: recuperás ${fx.amount} de vida.`, `Tu bendición responde cuando más la necesitás: +${fx.amount} de vida.`]), tone: 'good' };
      const name = (entry.text || '').match(/Usaste (.+?)\./);
      const spell = (entry.text || '').match(/Lanzaste (.+?) y/);
      if (spell) return { text: fill(pick(['Una luz cálida cierra tus heridas: recuperás {n} de vida.', 'Murmurás {s} y tus heridas se cierran: +{n} de vida.']), { ...v, s: spell[1] }), tone: 'good' };
      const item = name ? name[1].toLowerCase() : 'el objeto';
      if (fx.amount > 0 && fx.mana > 0) return { text: `Tomás ${item}: recuperás ${fx.amount} de vida y ${fx.mana} de maná.`, tone: 'good' };
      if (fx.amount > 0) return { text: `Tomás ${item}: recuperás ${fx.amount} de vida.`, tone: 'good' };
      if (fx.mana > 0) return { text: `Tomás ${item}: recuperás ${fx.mana} de maná.`, tone: 'good' };
      return { text: `Usás ${item}.`, tone: 'neutral' };
    }
    if (fx.kind === 'cast') {
      const m = (entry.text || '').match(/Lanzaste (.+?)\./);
      return { text: `Lanzás ${m ? m[1] : 'un hechizo'}.`, tone: 'neutral' };
    }

    // --- Efectos ---
    if (fx.kind === 'status') {
      if (fx.target === 'player') return { text: STATUS_PLAYER[fx.effect] || 'Algo te afecta.', tone: 'bad' };
      if (fx.passive === 'sangre_dragon') {
        const noun = enemyNoun(targetInst);
        return { text: pick([`Tu sangre de dragón prende fuego a ${noun}.`, `Tu golpe deja brasas: ${noun} se prende fuego.`]), tone: 'good' };
      }
      const noun = fx.target === 'pet' ? petNoun(pet) : enemyNoun(targetInst);
      const tpl = (fx.target !== 'pet' && bloodless(targetInst) && STATUS_BLOODLESS[fx.effect]) || STATUS_OTHER[fx.effect] || '{E} queda afectado.';
      return { text: fill(tpl, { e: noun, E: cap(noun) }), tone: fx.target === 'pet' ? 'bad' : 'good' };
    }
    if (fx.kind === 'tick') {
      if (fx.target === 'player') return { text: fill(TICK_PLAYER[fx.effect] || 'Perdés {n} de vida.', v), tone: 'bad' };
      const noun = fx.target === 'pet' ? petNoun(pet) : enemyNoun(targetInst);
      const tpl = (fx.target !== 'pet' && bloodless(targetInst) && TICK_BLOODLESS[fx.effect]) || TICK_OTHER[fx.effect] || '{E} pierde {n} de vida.';
      return { text: fill(tpl, { ...v, e: noun, E: cap(noun) }), tone: fx.target === 'pet' ? 'bad' : 'good' };
    }
    if (fx.kind === 'stun') {
      if (fx.target === 'player') return { text: 'Quedás sin reacción y perdés el turno.', tone: 'bad' };
      const noun = fx.target === 'pet' ? petNoun(pet) : enemyNoun(targetInst);
      return { text: `${cap(noun)} queda sin reacción y pierde el turno.`, tone: fx.target === 'pet' ? 'bad' : 'good' };
    }
    if (fx.kind === 'death') {
      if (fx.target === 'pet') return { text: `${cap(petNoun(pet))} cae inconsciente.`, tone: 'bad' };
      if (fx.target === 'player') return { text: 'Todo se vuelve negro…', tone: 'death' };
      const noun = enemyNoun(targetInst);
      return { text: fill(deathLine(targetInst), { E: cap(noun), e: noun }), tone: 'death' };
    }
    if (fx.kind === 'tamed') {
      const noun = enemyNoun(targetInst);
      return { text: `${cap(noun)} acepta la comida y baja la guardia. Ahora te acompaña.`, tone: 'good' };
    }
    if (fx.kind === 'tame-fail') {
      const noun = enemyNoun(targetInst);
      return { text: pick([`${cap(noun)} rechaza la comida y te gruñe.`, `${cap(noun)} no confía en vos y sigue peleando.`]), tone: 'bad' };
    }
    if (fx.kind === 'flee') {
      if (entry.result === 'hit') return { text: pick(['Aprovechás un hueco y escapás.', 'Das media vuelta y corrés hasta perderlos de vista.']), tone: 'good' };
      return { text: pick(['Intentás huir, pero te cortan el paso.', 'Buscás una salida, pero no hay por dónde escapar.']), tone: 'bad' };
    }
    if (fx.kind === 'start') {
      const grp = groupPhrase(c && c.enemies);
      const g = grp ? grp.text : (fx.group || 'enemigos');
      const many = grp ? grp.plural : true;
      // v2.5: si hay una criatura de élite, se avisa
      const elite = c && (c.enemies || []).find((e) => e.elite);
      const eliteNote = !elite ? '' : many ? ` ${cap(enemyNoun(elite))} los lidera: es más fuerte que el resto.` : ' Es de élite: más fuerte que los de su especie.';
      // v3.0: en grupo, a los dos ("les cierran el paso")
      const you = c && c.party ? 'les' : 'te';
      const can = c && c.party ? 'puedan' : 'puedas';
      if (fx.ambush) {
        return { text: (many ? `¡Emboscada! ${cap(g)} se ${you} tiran encima antes de que ${can} reaccionar.` : `¡Emboscada! ${cap(g)} se ${you} tira encima antes de que ${can} reaccionar.`) + eliteNote, tone: 'bad' };
      }
      return {
        text: pick(many
          ? [`${cap(g)} ${you} cierran el paso.`, `Aparecen ${g}. No hay vuelta atrás.`, `${cap(g)} se ${you} plantan enfrente.`]
          : [`${cap(g)} ${you} cierra el paso.`, `Aparece ${g}. No hay vuelta atrás.`, `${cap(g)} se ${you} planta enfrente.`]) + eliteNote,
        tone: elite ? 'bad' : 'neutral',
      };
    }
    if (fx.kind === 'reward') {
      if (fx.xp) return { text: `Ganás ${fx.xp} de experiencia.`, tone: 'good' };
      if (fx.mana) return { text: `Respirás hondo y recuperás ${fx.mana} de maná.`, tone: 'good' };
      if (fx.hp) return { text: `Te vendás las heridas y recuperás ${fx.hp} de vida.`, tone: 'good' };
      if (fx.coins) return { text: `Juntás ${coinsInWords(fx.coins)}.`, tone: 'good' };
      if (fx.items && fx.items.length) {
        const list = fx.items.map((it) => {
          const d = A.Inventory && A.Inventory.resolveData ? A.Inventory.resolveData(it.itemId) : A.Data.getById('items', it.itemId);
          const name = d ? d.name.toLowerCase() : it.itemId;
          return it.qty > 1 ? `${name} ×${it.qty}` : name;
        });
        return { text: `Entre los restos encontrás: ${list.join(', ')}.`, tone: 'good' };
      }
      if (fx.levelUp) return { text: `¡Subiste al nivel ${fx.levelUp}! Te sentís más fuerte.`, tone: 'crit' };
      if (fx.petXp) return { text: `${cap(petNoun(pet))} gana ${fx.petXp} de experiencia.`, tone: 'good' };
    }
    if (fx.kind === 'defeat') return { text: 'Caés al suelo y todo se vuelve negro…', tone: 'death' };
    if (fx.kind === 'note') return { text: entry.text, tone: 'neutral' };
    return null;
  }

  function isFem(id) { return FEM.has(id); }

  A.Narrator = { say, enemyNoun, petNoun, coinsInWords, groupPhrase, contract, passiveSuffix, isFem };
})(window.Aventurs);
