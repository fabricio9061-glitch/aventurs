/* ============================================================
   Aventurs — Editor v2.2: qué se puede editar de cada cosa

   Cada tipo dice: nombre, dibujito, línea corta para las listas,
   filtros, cómo se crea uno nuevo y sus secciones de campos.
   Los textos de ayuda están escritos para alguien que recién
   empieza: qué hace cada número en el juego.
   ============================================================ */

(function (A) {
  'use strict';

  const Ed = (A.Ed = A.Ed || {});
  const { esc, icon } = Ed.util;

  // ============================================================
  // Nombres en castellano
  // ============================================================

  const L = {
    CAT: { weak: 'Débil', normal: 'Normal', strong: 'Fuerte', boss: 'Jefe' },
    FAMILY: {
      beast: 'Bestia', flying: 'Voladora', insect: 'Insecto', humanoid: 'Humanoide', undead: 'No muerto',
      elemental: 'Elemental', spirit: 'Espíritu', demon: 'Demonio', marine: 'Marina', aquatic: 'Acuática',
      arcane: 'Arcana', plant: 'Planta', construct: 'Constructo', giant: 'Gigante', dragon: 'Dragón',
      legendary: 'Legendaria', fey: 'Feérica',
    },
    TAGS: {
      flying: 'Vuela', small: 'Pequeña', poison: 'Venenosa', agile: 'Ágil', pack: 'En manada', charge: 'Embiste',
      slow: 'Lenta', acid: 'Ácido', armor: 'Con armadura', ethereal: 'Etérea', fire: 'Fuego', disease: 'Enfermedad',
      aquatic: 'Acuática', charm: 'Encanta', nature: 'Naturaleza', scream: 'Grita', stone: 'Piedra', heavy: 'Pesada',
      magic: 'Mágica', undead: 'No muerta', curse: 'Maldice', regen: 'Se regenera', grab: 'Agarra', petrify: 'Petrifica',
      drain: 'Drena', arcane: 'Arcana', ice: 'Hielo', fear: 'Da miedo', revive: 'Revive', ancient: 'Antigua',
      armored: 'Acorazada', pirate: 'Pirata', blood: 'Sangre',
    },
    BIOME: {
      village: 'Pueblo', forest: 'Bosque', graveyard: 'Cementerio', plains: 'Llanura', swamp: 'Pantano', coast: 'Costa',
      arcane: 'Arcano', mountain: 'Montaña', desert: 'Desierto', ruins: 'Ruinas', crypt: 'Cripta', cave: 'Cueva',
      sea: 'Mar', volcano: 'Volcán', hell: 'Infierno', lair: 'Guarida', abyss: 'Abismo', dream: 'Sueño', grove: 'Arboleda',
      gothic: 'Gótico', pirate: 'Pirata', bloodwood: 'Bosque carmesí', hills: 'Colinas', meadow: 'Pradera', darkwood: 'Bosque oscuro',
    },
    STATUS: { bleed: 'Sangrado', poison: 'Veneno', fire: 'Quemadura', cold: 'Frío', shock: 'Descarga', blind: 'Ceguera', silence: 'Silencio' },
    SCHOOL: { arcane: 'Arcana', fire: 'Fuego', ice: 'Hielo', holy: 'Sagrada', light: 'Luz', nature: 'Naturaleza', shadow: 'Sombra' },
    RARITY: { common: 'Común', uncommon: 'Poco común', rare: 'Rara', epic: 'Épica', legendary: 'Legendaria' },
    SUBTYPE: {
      coin: 'Moneda', potion: 'Poción', material: 'Material', food: 'Comida', scroll: 'Pergamino', misc: 'Varios',
      tame: 'Para domar', scroll_spell: 'Pergamino de hechizo', bag: 'Mochila', key: 'Llave', accessory: 'Accesorio',
    },
    EFFECT: {
      heal: 'Cura vida', mana: 'Da maná', food: 'Quita el hambre', cure: 'Cura un estado', cleanse: 'Limpia todo lo malo', restore: 'Vida y maná al máximo',
      buff: 'Mejora por unos turnos', damage: 'Daño a enemigos', stun: 'Deja sin turno', curse: 'Maldice (baja precisión y defensa)',
      survivor: 'Salva de la muerte una vez', escape: 'Escapar de una pelea',
      revive: 'Levanta a un caído (en la pelea)',
    },
    BUFF: {
      damage: 'Daño', precision: 'Precisión', armor: 'Armadura', defense: 'Defensa (esquivar)', speed: 'Velocidad', regen: 'Vida por turno',
      reflect: 'Espinas (devuelve parte del golpe)', invisible: 'Invisible (le fallan)', immune: 'Inmune a los efectos', invincible: 'Invencible (no le hacen daño)', resist: 'Resiste un elemento',
    },
    ELEMENT: { arcane: 'Magia', fire: 'Fuego', cold: 'Hielo', shock: 'Rayo', poison: 'Veneno' },
    RESIST: { fire: 'Fuego', cold: 'Frío', shock: 'Rayos', poison: 'Veneno', bleed: 'Sangrado' },
    ROLE: {
      merchant: 'Mercader', tavernkeeper: 'Tabernero (posada)', blacksmith: 'Herrero (forja)', sage: 'Sabio (enseña magia)',
      guard: 'Guardia', captain: 'Capitán', noble: 'Noble', healer: 'Curandero',
    },
    WORKSHOP: { forge: 'Forja', alchemy: 'Alquimia', enchant: 'Encantamiento' },
    CLASS: { warrior: 'Guerrero', hybrid: 'Híbrido', mage: 'Mago' },
    SIDE: { t: 'Arriba', r: 'A la derecha', b: 'Abajo', l: 'A la izquierda' },
    OBJ: { kill: 'Derrotar criaturas', collect: 'Juntar y entregar objetos', have: 'Conseguir un objeto', explore: 'Explorar una zona', visit: 'Llegar a una zona', talk: 'Hablar con alguien' },
    LOOK: {
      '': 'Según su trabajo', merchant: 'Mercader', tavernkeeper: 'Tabernera', blacksmith: 'Herrero', sage: 'Sabio', healer: 'Curandera',
      guard: 'Guardia', villager: 'Aldeano', captain: 'Capitana', dwarf: 'Enano', dwarf_woman: 'Enana', pirate: 'Pirata',
      pirate_woman: 'Pirata (ella)', druid: 'Druida', noble: 'Noble vampira', noble_apothecary: 'Boticario vampiro',
    },
  };

  const opts = (map) => Object.keys(map).map((value) => ({ value, label: map[value] }));
  const biomeOpts = () => Object.keys(L.BIOME).map((value) => ({ value, label: L.BIOME[value], icon: `biome-${value}` }));
  const regionName = (id) => { const r = A.Data.getById('regions', id); return r ? r.name : id; };
  const lvlOf = (r) => (r.unlockConditions && r.unlockConditions.minLevel) || (Array.isArray(r.tier) ? r.tier[0] : 1) || 1;

  // ============================================================
  // Atajos para declarar campos
  // ============================================================

  const F = {
    text: (path, label, o = {}) => ({ kind: 'text', path, label, ...o }),
    area: (path, label, o = {}) => ({ kind: 'textarea', path, label, ...o }),
    num: (path, label, o = {}) => ({ kind: 'number', path, label, ...o }),
    pct: (path, label, o = {}) => ({ kind: 'percent', path, label, ...o }),
    dice: (path, label, o = {}) => ({ kind: 'dice', path, label, ...o }),
    sel: (path, label, options, o = {}) => ({ kind: 'select', path, label, options, ...o }),
    tog: (path, label, o = {}) => ({ kind: 'toggle', path, label, ...o }),
    ref: (path, label, ref, o = {}) => ({ kind: 'ref', path, label, ref, ...o }),
    refs: (path, label, ref, o = {}) => ({ kind: 'refs', path, label, ref, ...o }),
    tags: (path, label, options, o = {}) => ({ kind: 'tags', path, label, options, ...o }),
    chips: (path, label, options, o = {}) => ({ kind: 'chips', path, label, options, ...o }),
    choice: (path, label, options, o = {}) => ({ kind: 'choice', path, label, options, ...o }),
    lines: (path, label, o = {}) => ({ kind: 'lines', path, label, ...o }),
    list: (path, label, item, o = {}) => ({ kind: 'list', path, label, item, ...o }),
    group: (path, label, fields, o = {}) => ({ kind: 'group', path, label, fields, ...o }),
    present: (path, label, make, o = {}) => ({ kind: 'present', path, label, make, ...o }),
    custom: (key, render, o = {}) => ({ kind: 'custom', key, render, ...o }),
  };

  // Efecto de estado (armas y hechizos)
  const statusFields = (path) => [
    F.present(path, 'Efecto al pegar', () => ({ type: 'bleed', chance: 0.2, turns: 3, value: 1 }), { on: 'Puede dejar un efecto', off: 'Sin efecto', wide: true }),
    F.sel(`${path}.type`, 'Cuál', opts(L.STATUS), { when: (d) => !!(d && Ed.util.getPath(d, path)), help: 'Sangrado, veneno y quemadura sacan vida cada turno. Frío baja la defensa. Descarga puede aturdir. Ceguera hace errar.' }),
    F.pct(`${path}.chance`, 'Probabilidad', { when: (d) => !!Ed.util.getPath(d, path), help: 'Chance de que pase en cada golpe.' }),
    F.num(`${path}.turns`, 'Turnos', { min: 1, max: 9, when: (d) => !!Ed.util.getPath(d, path) }),
    F.num(`${path}.value`, 'Fuerza del efecto', { min: 0, max: 20, when: (d) => !!Ed.util.getPath(d, path), help: 'Vida que saca por turno (o cuánto baja la defensa).' }),
  ];

  // Resultado de una opción de escena
  const outcomeFields = [
    F.area('text', 'Qué pasa', { rows: 2, placeholder: 'Lo que lee el jugador.' }),
    F.num('coins', 'Monedas', { step: 0.5, min: -5, max: 20, help: '1 = un puñado según el nivel de la zona. En negativo, perdés.' }),
    F.num('xp', 'Experiencia', { step: 0.5, min: 0, max: 20, help: '1 = lo que da una pelea de la zona.' }),
    F.num('loot', 'Botín de la zona', { min: 0, max: 5, help: 'Cuántas cosas del botín del bioma te llevás.' }),
    F.pct('heal', 'Cura', { help: '% de tu vida máxima.' }),
    F.pct('hurt', 'Te lastima', { help: '% de tu vida máxima. Si te deja en 0, morís (v3.3).' }),
    F.pct('mana', 'Maná', { help: '% de tu maná máximo.' }),
    F.num('food', 'Comida', { min: -10, max: 20, help: 'Positivo llena, negativo da hambre.' }),
    F.num('time', 'Pasa el tiempo', { min: 0, max: 3, help: 'Momentos del día que pasan.' }),
    { kind: 'mapselect', path: 'fight', label: 'Pelea', options: [{ value: '', label: 'No' }, { value: 'normal', label: 'Sí' }, { value: 'surprise', label: 'Sí, y atacás primero' }, { value: 'ambush', label: 'Sí, y te emboscan' }],
      fromValue: (v) => (!v ? '' : v.surprise ? 'surprise' : v.ambush ? 'ambush' : 'normal'),
      toValue: (s) => (s === '' ? undefined : s === 'surprise' ? { surprise: true } : s === 'ambush' ? { ambush: true } : {}),
      help: 'Las criaturas de la zona (o las de la escena).' },
    F.tog('tame', 'Se puede domar', { help: 'Para escenas con una criatura: ofrece domarla.' }),
    F.list('items', 'Objetos que te llevás', [
      F.ref('0', 'Objeto', ['items', 'weapons', 'armors']),
      F.num('1', 'Mínimo', { min: 0, max: 99 }),
      F.num('2', 'Máximo', { min: 0, max: 99 }),
    ], { one: 'Objeto', add: 'Agregar objeto', newItem: () => ['pan', 1, 1], itemTitle: (it) => esc(Ed.fields.nameOf(['items', 'weapons', 'armors'], it[0])) }),
  ];

  // ============================================================
  // Tipos
  // ============================================================

  const TYPES = [
    // ---------------------------------------------------------- Zonas
    {
      key: 'regions', label: 'Zonas y pueblos', one: 'zona', icon: 'map', group: 'Mundo',
      hint: 'Lugares del mapa: zonas con criaturas y pueblos tranquilos.',
      meta: (r) => `${r.type === 'combat' ? 'Zona' : 'Pueblo'} · nivel ${lvlOf(r)} · ${L.BIOME[r.biome] || r.biome || ''}`,
      sort: (a, b) => lvlOf(a) - lvlOf(b) || String(a.name).localeCompare(String(b.name), 'es'),
      filters: [
        { key: 'kind', label: 'Tipo', options: [{ value: 'combat', label: 'Zonas' }, { value: 'safe', label: 'Pueblos' }], test: (r, v) => (v === 'combat' ? r.type === 'combat' : r.type !== 'combat') },
      ],
      template: () => ({
        name: 'Zona nueva', type: 'combat', biome: 'forest', tier: [1, 2], description: '', connections: [], distance: 2,
        pos: { x: 640, y: 430 }, labelAt: 'b', events: [], unlockConditions: { minLevel: 1 },
        encounter: { minEnemies: 1, maxEnemies: 2, allowMixed: true, spawnWeights: { weak: 50, normal: 40, strong: 10, boss: 0 } },
      }),
      sections: [
        { title: 'Lo básico', fields: [
          F.text('name', 'Nombre'),
          F.sel('type', 'Tipo', [{ value: 'combat', label: 'Zona con criaturas' }, { value: 'safe', label: 'Pueblo (sin peleas)' }]),
          F.choice('biome', 'Paisaje', biomeOpts, { help: 'Cambia el dibujo, el fondo y el botín que se encuentra al explorar.' }),
          { kind: 'range2', path: 'tier', label: 'Nivel de las criaturas', min: 1, max: 10, help: 'Solo aparecen las criaturas de la zona con nivel dentro de este rango.' },
          F.area('description', 'Descripción', { rows: 3 }),
        ] },
        { title: 'Para entrar', fields: [
          F.num('unlockConditions.minLevel', 'Nivel mínimo', { min: 1, max: 10, help: 'Si sos de menos nivel, no te deja viajar.' }),
          F.refs('unlockConditions.requiredItems', 'Objetos que tenés que llevar', ['items', 'weapons', 'armors'], { add: 'Agregar objeto' }),
          F.refs('unlockConditions.requiredRegions', 'Lugares que tenés que haber visitado', 'regions', { add: 'Agregar lugar', filter: (r, d) => r.id !== d.id }),
          F.text('unlockConditions.warningText', 'Cartel si no podés entrar', { placeholder: 'Ej: El calor te frena. Necesitás el amuleto.', wide: true }),
        ] },
        { title: 'Caminos y mapa', fields: [
          F.refs('connections', 'Caminos a', 'regions', { add: 'Agregar camino', filter: (r, d) => r.id !== d.id, help: 'Los caminos van y vienen: al guardar se agregan (o sacan) también en el otro lugar.' }),
          F.num('distance', 'Distancia', { min: 1, max: 10, unit: 'pasos', help: 'Cuántos pasos de viaje lleva llegar.' }),
          F.sel('labelAt', 'Nombre en el mapa', opts(L.SIDE)),
          F.custom('regionMap', (d) => Ed.panels.regionMap(d), { live: true }),
        ] },
        { title: 'Peleas', when: (d) => d.type === 'combat', fields: [
          F.num('encounter.minEnemies', 'Mínimo de criaturas', { min: 1, max: 6 }),
          F.num('encounter.maxEnemies', 'Máximo de criaturas', { min: 1, max: 8 }),
          F.tog('encounter.allowMixed', 'Mezclar especies', { on: 'Sí, pueden venir distintas juntas', off: 'No, de a una especie' }),
          F.group('encounter.spawnWeights', 'Qué tan seguido sale cada tipo', [
            F.num('weak', 'Débiles', { min: 0, max: 100 }),
            F.num('normal', 'Normales', { min: 0, max: 100 }),
            F.num('strong', 'Fuertes', { min: 0, max: 100 }),
            F.num('boss', 'Jefes', { min: 0, max: 100, help: 'En 0 la zona no tiene jefes. Si es más de 0, cada jefe sale según su "Qué tan seguido sale".' }),
          ], { help: 'Son pesos: 50 y 10 quiere decir que las débiles salen 5 veces más que las fuertes.' }),
          F.custom('regionCreatures', (d) => Ed.panels.regionCreatures(d)),
          F.custom('regionTest', (d) => Ed.panels.regionTest(d), { live: true, heavy: true }),
        ] },
        { title: 'Habitantes', when: (d) => d.type !== 'combat', fields: [
          F.custom('regionPeople', (d) => Ed.panels.regionPeople(d)),
        ] },
        { title: 'Sucesos del camino', help: 'Cosas chicas que pueden pasar al llegar o viajar por acá.', fields: [
          F.list('events', '', [
            F.sel('type', 'Qué pasa', [{ value: 'find', label: 'Encontrás un objeto' }, { value: 'treasure', label: 'Encontrás monedas' }, { value: 'damage', label: 'Te lastimás' }, { value: 'heal', label: 'Te reponés' }]),
            F.num('chance', 'Probabilidad', { min: 0, max: 100, unit: '%' }),
            F.ref('reward', 'Objeto', ['items', 'weapons', 'armors'], { when: (d, ev) => ev && ev.type === 'find' }),
            F.dice('amount', 'Cuánto', { when: (d, ev) => ev && ev.type !== 'find', placeholder: '1d6' }),
            F.text('effect', 'Texto', { placeholder: 'Ej: Una rama te raspa la cara.', wide: true }),
          ], { one: 'Suceso', add: 'Agregar suceso', newItem: () => ({ type: 'find', chance: 5, reward: 'pan' }), itemTitle: (ev) => esc({ find: 'Encontrar objeto', treasure: 'Monedas', damage: 'Daño', heal: 'Curación' }[ev.type] || 'Suceso') + ` · ${ev.chance || 0}%` }),
        ] },
      ],
      normalize: (d) => {
        if (d.type !== 'combat') delete d.encounter;
        if (d.unlockConditions) {
          for (const k of Object.keys(d.unlockConditions)) {
            const v = d.unlockConditions[k];
            if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) delete d.unlockConditions[k];
          }
        }
      },
    },

    // ---------------------------------------------------------- Escenas
    {
      key: 'events', label: 'Escenas', one: 'escena', icon: 'scroll', group: 'Mundo',
      hint: 'Lo que te puede pasar al explorar: un texto y opciones para elegir.',
      meta: (e) => {
        const where = Array.isArray(e.regions) && e.regions.length ? e.regions.map(regionName).join(', ') : (e.biomes || ['any']).map((b) => (b === 'any' ? 'cualquier lugar' : L.BIOME[b] || b)).join(', ');
        return `${(e.options || []).length} opciones · ${where}`;
      },
      sort: (a, b) => String(a.title).localeCompare(String(b.title), 'es'),
      filters: [
        { key: 'biome', label: 'Paisaje', options: () => [{ value: 'any', label: 'Cualquiera' }, ...biomeOpts()], test: (e, v) => (e.biomes || ['any']).includes(v) },
      ],
      nameKey: 'title',
      template: () => ({
        title: 'Escena nueva', icon: 'search', biomes: ['forest'], weight: 2, text: '',
        options: [{ label: 'Investigar', check: { stat: 'ingenio', dc: 12 }, ok: { text: 'Encontrás algo.', loot: 1 }, fail: { text: 'No encontrás nada.' } }, { label: 'Seguir de largo', ok: { text: 'Seguís tu camino.' } }],
      }),
      sections: [
        { title: 'Lo básico', fields: [
          F.text('title', 'Título'),
          { kind: 'icon', path: 'icon', label: 'Dibujo' },
          F.num('weight', 'Qué tan seguido', { min: 1, max: 5, help: '1 = rara, 5 = muy común.' }),
          F.chips('biomes', 'Dónde pasa', () => [{ value: 'any', label: 'Cualquier lugar' }, ...biomeOpts()], { exclusive: ['any'], help: 'En qué paisajes puede aparecer al explorar.' }),
          F.refs('regions', 'Solo en estos lugares', 'regions', { filter: (r) => r.type === 'combat', add: 'Elegir lugares', help: 'Opcional. Si elegís lugares, la escena sale solo ahí (y no por paisaje).' }),
          F.sel('time', 'Cuándo sale', [{ value: '', label: 'Siempre' }, { value: 'day', label: 'Solo de día' }, { value: 'night', label: 'Solo de noche' }]),
          // v3.3: escenas para grupos o para cuando vas solo
          F.tog('party', 'Solo en grupo', { on: 'Sí: los textos van en plural', off: 'No', help: 'Las de grupo pueden pedir que tire el más hábil o que se ayuden entre todos.' }),
          F.tog('solo', 'Solo cuando vas solo', { on: 'Sí', off: 'No', when: (d) => !d.party }),
          F.area('text', 'Lo que pasa', { rows: 4, placeholder: 'Ej: Entre los arbustos hay un cofre cubierto de musgo.' }),
        ] },
        { title: 'Opciones', help: 'Lo que puede elegir el jugador (de 1 a 4).', fields: [
          F.list('options', '', [
            F.text('label', 'Texto del botón', { wide: true }),
            F.present('check', 'Tirada', () => ({ stat: 'fuerza', dc: 12 }), { on: 'Tira el dado', off: 'Sale bien siempre' }),
            F.sel('check.stat', 'Habilidad', () => Object.keys(A.Explore.STATS).map((k) => ({ value: k, label: A.Explore.STATS[k].label })), { when: (d, o) => o && o.check }),
            F.num('check.dc', 'Dificultad', { min: 4, max: 22, when: (d, o) => o && o.check, help: (d, v) => Ed.panels.dcHelp(v) }),
            F.tog('check.best', 'En grupo, la tira el más hábil', { when: (d, o) => o && o.check && d.party }),
            F.tog('check.together', 'En grupo, se ayudan (+1 por compañero)', { when: (d, o) => o && o.check && d.party }),
            F.num('needs.food', 'Pide comida', { min: 0, max: 10 }),
            F.num('needs.coins', 'Pide monedas', { min: 0, max: 10, step: 0.5, help: '1 = un puñado según la zona.' }),
            F.group('ok', 'Si sale bien', outcomeFields, { wide: true }),
            F.group('fail', 'Si sale mal', outcomeFields, { wide: true, when: (d, o) => o && o.check }),
          ], { one: 'Opción', add: 'Agregar opción', max: 4, newItem: () => ({ label: 'Opción', ok: { text: '' } }), itemTitle: (o, i) => `${i + 1}. ${esc(o.label || 'Opción')}` }),
        ] },
        { title: 'Así la ve el jugador', fields: [F.custom('eventPreview', (d) => Ed.panels.eventPreview(d), { live: true })] },
      ],
      normalize: (d) => {
        if (!Array.isArray(d.biomes) || !d.biomes.length) d.biomes = ['any'];
        if (Array.isArray(d.regions) && !d.regions.length) delete d.regions;
        for (const k of ['time', 'party', 'solo']) if (!d[k]) delete d[k];
        if (d.party) delete d.solo;
        for (const o of d.options || []) {
          if (!o.check) delete o.fail;
          if (o.check) { if (!o.check.best || !d.party) delete o.check.best; if (!o.check.together || !d.party) delete o.check.together; }
          if (o.needs) { for (const k of Object.keys(o.needs)) if (!o.needs[k]) delete o.needs[k]; if (!Object.keys(o.needs).length) delete o.needs; }
          for (const r of [o.ok, o.fail]) {
            if (!r) continue;
            for (const k of Object.keys(r)) if (r[k] === undefined || r[k] === 0 || r[k] === false || (Array.isArray(r[k]) && !r[k].length)) delete r[k];
          }
        }
      },
    },

    // ---------------------------------------------------------- Criaturas
    {
      key: 'enemies', label: 'Criaturas', one: 'criatura', icon: 'skull', group: 'Criaturas y gente',
      hint: 'Todo lo que pelea contra vos.',
      meta: (e) => `Nivel ${e.tier} · ${L.CAT[e.category] || e.category}${(e.regions || []).length ? ` · ${e.regions.map(regionName).join(', ')}` : ' · sin zona'}`,
      sort: (a, b) => (a.tier - b.tier) || String(a.name).localeCompare(String(b.name), 'es'),
      filters: [
        { key: 'zone', label: 'Zona', options: () => A.Data.regions.filter((r) => r.type === 'combat').sort((a, b) => lvlOf(a) - lvlOf(b)).map((r) => ({ value: r.id, label: r.name })).concat([{ value: '__none', label: 'Sin zona' }]), test: (e, v) => (v === '__none' ? !(e.regions || []).length : (e.regions || []).includes(v)) },
        { key: 'tier', label: 'Nivel', options: () => Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: `Nivel ${i + 1}` })), test: (e, v) => String(e.tier) === v },
        { key: 'cat', label: 'Tipo', options: opts(L.CAT), test: (e, v) => e.category === v },
        { key: 'tame', label: 'Domar', options: [{ value: 'yes', label: 'Se pueden domar' }, { value: 'no', label: 'No se pueden domar' }], test: (e, v) => (v === 'yes' ? !!e.tameable : !e.tameable) },
      ],
      template: () => ({
        name: 'Criatura nueva', family: ['beast'], category: 'normal', tier: 1, tags: [], biome: [], health: 12, damage: '1d6',
        attack: 1, difficulty: 9, armor: 0, speed: 10, drops: [{ itemId: 'coin_copper', chance: 0.8, qtyMin: 2, qtyMax: 6, source: 'manual' }],
        regions: [], spawn: { min: 1, max: 3, weight: 1, groupable: true }, tameable: false, autoLoot: true,
      }),
      sections: [
        { title: 'Lo básico', fields: [
          F.text('name', 'Nombre'),
          F.num('tier', 'Nivel', { min: 1, max: 10, help: 'Para qué nivel de jugador está pensada.' }),
          F.sel('category', 'Tipo', opts(L.CAT), { help: 'Las débiles salen en grupo; los jefes van solos.' }),
          F.refs('regions', 'Dónde vive', 'regions', { filter: (r) => r.type === 'combat', add: 'Agregar zona', help: (d) => Ed.panels.homeHelp(d) }),
          F.tags('family', 'Es', opts(L.FAMILY), { add: 'Agregar', help: 'Humanoides, demonios, muertos, arcanos y dragones no se pueden domar.' }),
          F.tags('tags', 'Rasgos', opts(L.TAGS), { add: 'Agregar rasgo' }),
          // v3.1: criaturas de día y de noche
          F.sel('time', 'Cuándo sale', [{ value: '', label: 'Siempre' }, { value: 'day', label: 'Solo de día' }, { value: 'night', label: 'Solo de noche' }], { help: 'Bajo tierra (cuevas, criptas, infierno, abismo) sale siempre.' }),
        ] },
        { title: 'Combate', help: 'Así se compara con vos en la pelea.', fields: [
          F.num('health', 'Vida', { min: 1, max: 999 }),
          F.dice('damage', 'Daño', { help: 'Lo que te saca cuando te acierta (antes de tu armadura).' }),
          F.num('attack', 'Precisión', { min: -5, max: 20, help: 'Se suma a su dado de 20 para acertarte.' }),
          F.num('difficulty', 'Defensa', { min: 1, max: 30, help: 'Lo que vos tenés que sacar (dado + tu precisión) para acertarle.' }),
          F.num('armor', 'Armadura', { min: 0, max: 20, help: 'Se resta de cada golpe que le das.' }),
          F.num('speed', 'Velocidad', { min: 1, max: 30, help: 'El más rápido ataca primero.' }),
          F.custom('enemySim', (d) => Ed.panels.enemySim(d), { live: true, heavy: true }),
          F.custom('enemySuggest', (d) => Ed.panels.enemySuggest(d), { live: true }),
        ] },
        { title: 'Habilidades', help: 'Pasivas (actúan solas) y activas (las usa a veces en su turno).', fields: [
          F.tags('skills', 'Habilidades', () => (A.Skills ? A.Skills.all().filter((sk) => sk.id !== 'lider').map((sk) => ({ value: sk.id, label: `${sk.name} (${sk.kind === 'passive' ? 'pasiva' : 'activa'})` })) : []), { add: 'Agregar habilidad' }),
          F.custom('enemySkills', (d) => Ed.panels.enemySkills(d), { live: true }),
        ] },
        { title: 'Botín', help: 'Lo que puede soltar al caer.', fields: [
          F.list('drops', '', [
            F.ref('itemId', 'Objeto', ['items', 'weapons', 'armors']),
            F.pct('chance', 'Probabilidad'),
            F.num('qtyMin', 'Cantidad mínima', { min: 1, max: 999 }),
            F.num('qtyMax', 'Cantidad máxima', { min: 1, max: 999 }),
          ], { one: 'Objeto', add: 'Agregar al botín', newItem: () => ({ itemId: 'mat_cuero', chance: 0.2, source: 'manual' }),
            itemThumb: (d) => Ed.fields.thumbOf('items', Ed.fields.findAny(['items', 'weapons', 'armors'], d.itemId) ? Ed.fields.findAny(['items', 'weapons', 'armors'], d.itemId).e : null, 24),
            itemTitle: (d) => `${esc(Ed.fields.nameOf(['items', 'weapons', 'armors'], d.itemId))} · ${Math.round((d.chance || 0) * 100)}%` }),
        ] },
        { title: 'Grupo', fields: [
          F.tog('spawn.groupable', 'Anda en grupo', { on: 'Sí', off: 'No, siempre sola' }),
          F.num('spawn.max', 'Cuántas pueden venir juntas', { min: 1, max: 8, when: (d) => !d.spawn || d.spawn.groupable !== false }),
          F.num('spawn.weight', 'Qué tan seguido sale', { min: 0.05, max: 5, step: 0.05, help: '1 = normal; 0,1 = muy rara. Un jefe con 1 sale en el 3% de los encuentros cuando tenés su nivel (con 2, el 6%).' }),
        ] },
        { title: 'Domar', fields: [
          F.tog('tameable', 'Se puede domar', { on: 'Sí', off: 'No' }),
          F.ref('tameItem', 'Qué le das para domarla', 'items', { none: 'Carne cruda', when: (d) => !!d.tameable, filter: (i) => i.subtype === 'food' || i.subtype === 'tame' || i.rarity === 'rare' || i.rarity === 'epic' || i.rarity === 'legendary' }), // v3.8: también un objeto raro (la kitsune, una Perla)
        ] },
        { title: 'Apariencia', fields: [
          F.choice('sprite.t', 'Dibujo', () => A.Sprites.shapeOptions().map((o) => ({ ...o, thumbFor: o.value })), { none: 'Automático', thumbs: 'shape' }),
          { kind: 'color', path: 'sprite.b', label: 'Color principal' },
          { kind: 'color', path: 'sprite.c', label: 'Color secundario' },
          { kind: 'color', path: 'sprite.a', label: 'Detalles' },
          { kind: 'color', path: 'sprite.e', label: 'Ojos' },
        ] },
      ],
      normalize: (d) => {
        if (d.sprite && !Object.keys(d.sprite).some((k) => d.sprite[k])) delete d.sprite;
        d.drops = (d.drops || []).filter((x) => x && x.itemId);
        if (!d.tameable) delete d.tameItem;
      },
    },

    // ---------------------------------------------------------- Habitantes
    {
      key: 'npcs', label: 'Habitantes', one: 'habitante', icon: 'talk', group: 'Criaturas y gente',
      hint: 'La gente de los pueblos: venden, enseñan, dan misiones.',
      meta: (n) => `${n.roleName || L.ROLE[n.role] || n.role || ''} · ${regionName(n.region)}`,
      sort: (a, b) => String(regionName(a.region)).localeCompare(String(regionName(b.region)), 'es') || String(a.name).localeCompare(String(b.name), 'es'),
      filters: [
        { key: 'town', label: 'Lugar', options: () => A.Data.regions.filter((r) => A.Data.npcs.some((n) => n.region === r.id)).map((r) => ({ value: r.id, label: r.name })), test: (n, v) => n.region === v },
      ],
      template: () => ({ name: 'Habitante nuevo', role: 'merchant', region: 'pueblo_inicial', dialog: ['Buenas, viajero.'], sells: [], services: {} }),
      sections: [
        { title: 'Lo básico', fields: [
          F.text('name', 'Nombre'),
          F.sel('role', 'Trabajo', opts(L.ROLE), { help: 'Taberneros tienen posada; herreros, forja; sabios enseñan hechizos.' }),
          F.text('roleName', 'Título que se ve', { placeholder: 'Ej: Druida del roble' }),
          F.ref('region', 'Dónde vive', 'regions'),
          F.choice('look', 'Cómo se ve', () => Object.keys(L.LOOK).map((k) => ({ value: k, label: L.LOOK[k] })), { thumbs: 'look' }),
          F.lines('dialog', 'Lo que dice', { add: 'Agregar frase', placeholder: 'Una frase que dice al hablarle', help: 'Dice una al azar cuando le hablás.' }),
        ] },
        { title: 'Comercio y servicios', fields: [
          F.refs('sells', 'Vende', ['items', 'weapons', 'armors'], { add: 'Agregar a la venta' }),
          F.refs('teaches', 'Enseña', 'spells', { filter: (s) => !s.racial, add: 'Agregar hechizo', help: 'Solo a quien usa magia.' }),
          F.num('services.restCost', 'Posada: precio por noche', { min: 0, max: 999, unit: 'cobre', help: 'Dejalo vacío si no tiene posada.' }),
        ] },
        { title: 'Misiones', fields: [F.custom('npcQuests', (d) => Ed.panels.npcQuests(d))] },
      ],
      normalize: (d) => {
        d.dialog = (d.dialog || []).map((x) => String(x || '').trim()).filter(Boolean);
        if (!d.look) delete d.look;
        if (!d.roleName) delete d.roleName;
        if (Array.isArray(d.teaches) && !d.teaches.length) delete d.teaches;
      },
    },

    // ---------------------------------------------------------- Razas
    {
      key: 'races', label: 'Razas', one: 'raza', icon: 'crown', group: 'Criaturas y gente',
      hint: 'Con qué empieza cada personaje.',
      meta: (r) => `${L.CLASS[r.combatType] || r.combatType}${r.passive && A.Passives && A.Passives.LIST[r.passive] ? ` · ${A.Passives.LIST[r.passive].name}` : ''}`,
      template: () => ({ name: 'Raza nueva', combatType: 'hybrid', magic: true, passive: 'determinacion', bonuses: { hp: 0, mana: 0, speed: 0, precision: 0, armor: 0, damage: 0, dodge: 0 }, description: '', startSpell: 'chispa' }),
      sections: [
        { title: 'Lo básico', fields: [
          F.text('name', 'Nombre'),
          F.sel('combatType', 'Clase', opts(L.CLASS), { help: 'Guerrero: golpe fuerte y maestría con armas. Mago: el maná le vuelve solo. Híbrido: pegar con el arma le devuelve maná.' }),
          F.tog('magic', 'Usa magia', { on: 'Sí', off: 'No' }),
          F.sel('passive', 'Habilidad propia', () => Object.keys((A.Passives && A.Passives.LIST) || {}).map((k) => ({ value: k, label: A.Passives.LIST[k].name })), { help: (d) => Ed.panels.passiveHelp(d) }),
          F.ref('startSpell', 'Hechizo con el que nace', 'spells', { when: (d) => d.magic !== false && d.combatType !== 'warrior' }),
          F.area('description', 'Descripción', { rows: 3 }),
        ] },
        { title: 'Números', help: 'Se suman a la base de todos: vida 24, maná 12, velocidad 10, precisión 1, esquiva 5.', fields: [
          F.num('bonuses.hp', 'Vida', { min: -20, max: 30 }),
          F.num('bonuses.mana', 'Maná', { min: -12, max: 20 }),
          F.num('bonuses.speed', 'Velocidad', { min: -5, max: 8 }),
          F.num('bonuses.precision', 'Precisión', { min: -3, max: 6 }),
          F.num('bonuses.armor', 'Armadura', { min: -3, max: 5 }),
          F.num('bonuses.damage', 'Daño', { min: -3, max: 5 }),
          F.num('bonuses.dodge', 'Esquiva', { min: -3, max: 6 }),
        ] },
        { title: 'Recuperar maná', when: (d) => d.combatType === 'mage', fields: [
          F.num('manaRegen.turn', 'En cada turno', { min: 0, max: 5 }),
          F.pct('manaRegen.win', 'Al ganar', { help: '% de su maná máximo.' }),
        ] },
        { title: 'Así empieza', fields: [F.custom('racePreview', (d) => Ed.panels.racePreview(d), { live: true })] },
      ],
    },

    // ---------------------------------------------------------- Misiones
    {
      key: 'quests', label: 'Misiones', one: 'misión', icon: 'quest', group: 'Historia',
      hint: 'La historia principal y los encargos.',
      nameKey: 'title',
      meta: (q) => `${q.main ? `Historia · capítulo ${q.chapter || '?'}` : 'Encargo'} · ${Ed.fields.nameOf(['npcs'], q.giver) || 'sin quien la dé'}`,
      sort: (a, b) => ((b.main ? 1 : 0) - (a.main ? 1 : 0)) || ((a.chapter || 0) - (b.chapter || 0)) || ((a.minLevel || 1) - (b.minLevel || 1)) || String(a.title).localeCompare(String(b.title), 'es'),
      filters: [
        { key: 'kind', label: 'Tipo', options: [{ value: 'main', label: 'Historia' }, { value: 'side', label: 'Encargos' }], test: (q, v) => (v === 'main' ? !!q.main : !q.main) },
      ],
      template: () => ({ title: 'Misión nueva', giver: 'npc_guardia_pueblo', offer: '', text: '', done: '', turnIn: true, minLevel: 1, objectives: [{ type: 'kill', enemy: 'lobo', count: 3 }], reward: { xp: 40, coins: 30 } }),
      sections: [
        { title: 'Lo básico', fields: [
          F.text('title', 'Título'),
          F.ref('giver', 'Quién la da', 'npcs'),
          F.tog('main', 'Es de la historia principal', { on: 'Sí', off: 'No, es un encargo' }),
          F.num('chapter', 'Capítulo', { min: 1, max: 30, when: (d) => !!d.main }),
          F.num('minLevel', 'Nivel mínimo', { min: 1, max: 10 }),
          F.tog('turnIn', 'Hay que volver a entregarla', { on: 'Sí, a quien la dio', off: 'No, se cobra sola' }),
          F.ref('requires', 'Aparece después de', 'quests', { none: 'Siempre disponible', filter: (q, d) => q.id !== d.id }),
          F.ref('next', 'Sigue con', 'quests', { none: 'Ninguna', filter: (q, d) => q.id !== d.id }),
          F.tog('auto', 'Empieza sola', { on: 'Sí, al terminar la anterior', off: 'No, hay que aceptarla' }),
        ] },
        { title: 'Textos', fields: [
          F.area('offer', 'Lo que te dice al ofrecerla', { rows: 3 }),
          F.area('text', 'Resumen en el diario', { rows: 2 }),
          F.area('done', 'Al terminarla', { rows: 2 }),
        ] },
        { title: 'Objetivos', fields: [
          F.list('objectives', '', [
            F.sel('type', 'Qué hay que hacer', opts(L.OBJ)),
            F.refs('enemy', 'Criaturas', 'enemies', { single: true, when: (d, o) => o && o.type === 'kill', add: 'Elegir criaturas' }),
            F.ref('item', 'Objeto', ['items', 'weapons', 'armors'], { when: (d, o) => o && (o.type === 'collect' || o.type === 'have') }),
            // v3.0: objetos de misión que sueltan ciertas criaturas mientras la misión los pide
            F.refs('from', 'Lo sueltan', 'enemies', { when: (d, o) => o && o.type === 'collect', add: 'Elegir criaturas', help: 'Opcional. Mientras la misión lo pida, estas criaturas lo sueltan la mitad de las veces (aunque no esté en su botín).' }),
            F.ref('region', 'Lugar', 'regions', { when: (d, o) => o && (o.type === 'explore' || o.type === 'visit') }),
            F.ref('npc', 'Con quién', 'npcs', { when: (d, o) => o && o.type === 'talk' }),
            F.num('count', 'Cuántas veces', { min: 1, max: 99, when: (d, o) => o && ['kill', 'collect', 'explore'].includes(o.type) }),
            F.text('text', 'Texto propio (opcional)', { placeholder: 'Si lo dejás vacío se arma solo', wide: true }),
          ], { one: 'Objetivo', add: 'Agregar objetivo', newItem: () => ({ type: 'kill', enemy: 'lobo', count: 3 }), itemTitle: (o) => esc(A.Quests ? A.Quests.objectiveText(o) : o.type) }),
        ] },
        { title: 'Premio', fields: [
          F.num('reward.xp', 'Experiencia', { min: 0, max: 9999 }),
          F.num('reward.coins', 'Monedas', { min: 0, max: 99999, unit: 'cobre', help: (d) => Ed.panels.priceHelp(d && d.reward && d.reward.coins) }),
          F.list('reward.items', 'Objetos', [
            F.ref('0', 'Objeto', ['items', 'weapons', 'armors']),
            F.num('1', 'Cantidad', { min: 1, max: 99 }),
          ], { one: 'Objeto', add: 'Agregar objeto', newItem: () => ['pocion_curacion_menor', 1], itemTitle: (it) => esc(Ed.fields.nameOf(['items', 'weapons', 'armors'], it[0])) + ` ×${it[1] || 1}` }),
        ] },
        { title: 'Así la ve el jugador', fields: [F.custom('questPreview', (d) => Ed.panels.questPreview(d), { live: true })] },
      ],
      normalize: (d) => {
        if (!d.main) delete d.chapter;
        for (const o of d.objectives || []) {
          if (o.type !== 'kill') delete o.enemy;
          if (o.type !== 'collect' && o.type !== 'have') delete o.item;
          if (o.type !== 'explore' && o.type !== 'visit') delete o.region;
          if (o.type !== 'talk') delete o.npc;
          if (!['kill', 'collect', 'explore'].includes(o.type)) delete o.count;
          if (!o.text) delete o.text;
        }
      },
    },

    // ---------------------------------------------------------- Objetos
    {
      key: 'items', label: 'Objetos', one: 'objeto', icon: 'bag', group: 'Cosas',
      hint: 'Pociones, comida, materiales, pergaminos, llaves.',
      meta: (i) => `${L.SUBTYPE[i.subtype] || i.subtype || ''}${i.rarity && i.rarity !== 'common' ? ` · ${L.RARITY[i.rarity] || i.rarity}` : ''} · ${A.Currency ? A.Currency.formatPrice(i.value || 0) : i.value}`,
      sort: (a, b) => String(a.subtype).localeCompare(String(b.subtype)) || String(a.name).localeCompare(String(b.name), 'es'),
      filters: [
        { key: 'sub', label: 'Tipo', options: opts(L.SUBTYPE), test: (i, v) => i.subtype === v },
      ],
      template: () => ({ name: 'Objeto nuevo', type: 'item', subtype: 'material', rarity: 'common', value: 5, weight: 0.5, stack: 20, description: '' }),
      sections: [
        { title: 'Lo básico', fields: [
          F.text('name', 'Nombre'),
          F.sel('subtype', 'Tipo', opts(L.SUBTYPE)),
          F.sel('rarity', 'Rareza', opts(L.RARITY), { help: 'Común, poco común, raro, épico o legendario. Se ve con su color en la mochila y la tienda.' }),
          F.num('tier', 'Nivel', { min: 1, max: 10, when: (d) => ['accessory', 'scroll', 'potion'].includes(d.subtype), help: 'Para qué nivel de personaje está pensado.' }),
          F.num('value', 'Precio', { min: 0, max: 999999, unit: 'cobre', help: (d) => `${Ed.panels.priceHelp(d && d.value)}${d && d.value ? ` Lo compran a la mitad: ${A.Currency ? A.Currency.formatPrice(Math.max(1, Math.floor(d.value / 2))) : Math.floor(d.value / 2)}.` : ''}` }),
          F.num('stack', 'Cuántos por casilla', { min: 1, max: 999 }),
          F.area('description', 'Descripción', { rows: 2 }),
        ] },
        { title: 'Al usarlo', when: (d) => ['potion', 'food', 'scroll', 'misc', 'tame'].includes(d.subtype), fields: [
          F.present('effect', 'Efecto', () => ({ type: 'heal', amount: '1d6' }), { on: 'Hace algo al usarlo', off: 'No se usa' }),
          F.sel('effect.type', 'Qué hace', opts(L.EFFECT), { when: (d) => !!d.effect }),
          F.dice('effect.amount', 'Cuánto', { when: (d) => d.effect && (['mana', 'food', 'buff', 'curse'].includes(d.effect.type) || (d.effect.type === 'heal' && !d.effect.pct)) }),
          F.pct('effect.pct', 'O una parte de la vida', { when: (d) => d.effect && ['heal', 'cleanse'].includes(d.effect.type), help: 'Si lo llenás, cura ese % de la vida máxima en vez de los dados.' }),
          F.pct('effect.pct', 'Con cuánta vida se levanta', { when: (d) => d.effect && d.effect.type === 'revive', help: 'Parte de la vida máxima del caído (v3.3: hierba de la vida).' }),
          F.tog('effect.pet', 'También a la mascota', { on: 'Sí, y la despierta', off: 'Solo a vos', when: (d) => d.effect && d.effect.type === 'heal' }),
          F.sel('effect.status', 'Qué cura', opts(L.STATUS), { when: (d) => d.effect && d.effect.type === 'cure' }),
          F.sel('effect.stat', 'Qué mejora', opts(L.BUFF), { when: (d) => d.effect && d.effect.type === 'buff' }),
          F.chips('effect.types', 'Contra qué', opts(L.RESIST), { when: (d) => d.effect && d.effect.type === 'buff' && d.effect.stat === 'resist' }),
          F.dice('effect.dice', 'Daño', { when: (d) => d.effect && d.effect.type === 'damage', help: 'No falla nunca; la armadura del enemigo cuenta la mitad.' }),
          F.sel('effect.element', 'Elemento', opts(L.ELEMENT), { when: (d) => d.effect && d.effect.type === 'damage' }),
          F.tog('effect.all', 'A quién', { on: 'A todos los enemigos', off: 'A uno', when: (d) => d.effect && ['damage', 'stun'].includes(d.effect.type) }),
          F.num('effect.stun', 'Además pierde turnos', { min: 0, max: 3, when: (d) => d.effect && d.effect.type === 'damage' }),
          F.tog('effect.drain', 'Robo de vida', { on: 'Recuperás lo que le sacás', off: 'No', when: (d) => d.effect && d.effect.type === 'damage' }),
          F.present('effect.status', 'Además deja un efecto', () => ({ type: 'fire', turns: 3, value: 1 }), { on: 'Sí', off: 'No', when: (d) => d.effect && ['damage', 'stun'].includes(d.effect.type) }),
          F.sel('effect.status.type', 'Cuál', opts(L.STATUS), { when: (d) => d.effect && ['damage', 'stun'].includes(d.effect.type) && !!d.effect.status }),
          F.num('effect.status.turns', 'Turnos del efecto', { min: 1, max: 9, when: (d) => d.effect && ['damage', 'stun'].includes(d.effect.type) && !!d.effect.status }),
          F.num('effect.status.value', 'Fuerza del efecto', { min: 0, max: 20, when: (d) => d.effect && ['damage', 'stun'].includes(d.effect.type) && !!d.effect.status, help: 'Vida que saca por turno (fuego, veneno, sangrado).' }),
          F.num('effect.turns', 'Turnos sin actuar', { min: 1, max: 3, when: (d) => d.effect && d.effect.type === 'stun', help: 'A los jefes, como mucho uno.' }),
          F.num('effect.duration', 'Turnos', { min: 1, max: 20, when: (d) => d.effect && ['buff', 'curse'].includes(d.effect.type), help: 'Cuenta tus turnos: después de cada acción tuya baja uno.' }),
          F.num('foodValue', 'Alimenta', { min: 0, max: 40, when: (d) => d.subtype === 'food' || d.subtype === 'tame', help: 'Cuánto te saca el hambre (y le gusta a las mascotas).' }),
          F.custom('itemEffects', (d) => Ed.panels.itemEffects(d), { live: true }),
        ] },
        { title: 'Accesorio', when: (d) => d.subtype === 'accessory', fields: [
          F.num('acc.precision', 'Precisión', { min: 0, max: 5 }),
          F.num('acc.damage', 'Daño', { min: 0, max: 5 }),
          F.num('acc.armor', 'Armadura', { min: 0, max: 5 }),
          F.num('acc.defense', 'Defensa (esquivar)', { min: 0, max: 5 }),
          F.num('acc.speed', 'Velocidad', { min: 0, max: 6 }),
          F.num('acc.mana', 'Maná máximo', { min: 0, max: 20, help: 'Solo si usás magia.' }),
          F.num('acc.regen', 'Vida por turno', { min: 0, max: 6, help: 'Al empezar cada turno tuyo en combate.' }),
          F.num('acc.crit', 'Críticos desde más abajo', { min: 0, max: 4, help: '2 = críticos con 18 o más.' }),
          F.pct('acc.thorns', 'Espinas', { help: 'Parte del golpe que vuelve al que te pega.' }),
          F.pct('acc.lifesteal', 'Robo de vida', { help: 'Parte del daño que hacés que vuelve como vida.' }),
          F.pct('acc.double', 'Doble golpe', { help: 'Chance de pegar dos veces.' }),
          F.pct('acc.counter', 'Contraataque', { help: 'Chance de devolver el golpe cuando te fallan.' }),
          F.pct('acc.heal', 'Cura más', { help: 'Lo que te cura, te cura este % más.' }),
          F.pct('acc.xp', 'Más experiencia'),
          F.pct('acc.gold', 'Más monedas'),
          F.pct('acc.drops', 'Más botín'),
          F.tog('acc.first', 'Iniciativa', { on: 'Actúa primero', off: 'No' }),
          F.tog('acc.survivor', 'Superviviente', { on: 'Una vez por pelea queda con 1 de vida', off: 'No' }),
          F.chips('acc.immune', 'Inmune a', opts(L.RESIST)),
          F.custom('accEffects', (d) => Ed.panels.itemEffects(d), { live: true }),
        ] },
        { title: 'Pergamino', when: (d) => d.subtype === 'scroll_spell', fields: [F.ref('teachesSpell', 'Enseña', 'spells', { filter: (s) => !s.racial })] },
        { title: 'Mochila', when: (d) => d.subtype === 'bag', fields: [F.ref('equipsBag', 'Al usarla te ponés', 'bags')] },
      ],
      normalize: (d) => {
        if (d.subtype !== 'scroll_spell') delete d.teachesSpell;
        if (d.subtype !== 'bag') delete d.equipsBag;
        if (d.subtype !== 'accessory') delete d.acc;
        else if (!d.acc) d.acc = {};
        // pergaminos y pociones de combate: siempre en combate
        if (d.effect && ['damage', 'stun', 'curse', 'survivor'].includes(d.effect.type)) d.effect.combat = true;
      },
    },

    // ---------------------------------------------------------- Armas
    {
      key: 'weapons', label: 'Armas', one: 'arma', icon: 'swords', group: 'Cosas',
      hint: 'Con qué pegás.',
      meta: (w) => `Nivel ${w.tier} · ${w.damage}${w.magic ? ' · de mago' : ''}${(w.weight || 0) >= 4 ? ' · pesada' : ''}`,
      sort: (a, b) => (a.tier - b.tier) || String(a.name).localeCompare(String(b.name), 'es'),
      filters: [{ key: 'tier', label: 'Nivel', options: () => Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: `Nivel ${i + 1}` })), test: (w, v) => String(w.tier) === v }],
      template: () => ({ name: 'Arma nueva', type: 'weapon', damage: '1d6', value: 40, rarity: 'common', tier: 1, weight: 2, magic: false, description: '' }),
      sections: [
        { title: 'Lo básico', fields: [
          F.text('name', 'Nombre'),
          F.num('tier', 'Nivel', { min: 1, max: 10 }),
          F.sel('rarity', 'Rareza', opts(L.RARITY)),
          F.num('value', 'Precio', { min: 0, max: 999999, unit: 'cobre', help: (d) => Ed.panels.priceHelp(d && d.value) }),
          F.area('description', 'Descripción', { rows: 2 }),
        ] },
        { title: 'Combate', fields: [
          F.dice('damage', 'Daño', { help: 'La vida que sacás cuando acertás.' }),
          F.num('weight', 'Peso', { min: 0, max: 12, help: 'Desde 4 es pesada: los guerreros ganan precisión. Arma y armadura juntas: lo que pase de 4 te quita velocidad.' }),
          F.num('precision', 'Precisión extra', { min: 0, max: 5, help: 'Se suma al dado de 20 al atacar.' }),
          // v3.4: las armas de mago (bastones, varitas...) son solo para magos, y los magos usan solo esas
          F.tog('magic', 'Arma de mago', { on: 'Sí: solo la usan los magos y les suma poder mágico', off: 'No: es común (guerreros e híbridos)' }),
          F.num('mana', 'Maná máximo', { min: 0, max: 20, help: 'Lo suma mientras la tenés puesta (si usás magia).' }),
          F.num('slots', 'Casillas que ocupa', { min: 1, max: 4 }),
          ...statusFields('statusEffect'),
          F.custom('weaponFit', (d) => Ed.panels.weaponFit(d), { live: true }),
        ] },
      ],
    },

    // ---------------------------------------------------------- Armaduras
    {
      key: 'armors', label: 'Armaduras', one: 'armadura', icon: 'shield', group: 'Cosas',
      hint: 'Lo que te ponés para que te saquen menos vida.',
      meta: (a) => `Nivel ${a.tier} · armadura ${a.defense || 0}${a.dodge ? ` · esquiva ${a.dodge}` : ''}`,
      sort: (a, b) => (a.tier - b.tier) || String(a.name).localeCompare(String(b.name), 'es'),
      template: () => ({ name: 'Armadura nueva', type: 'armor', defense: 1, value: 40, rarity: 'common', tier: 1, weight: 2, magic: false, description: '' }),
      sections: [
        { title: 'Lo básico', fields: [
          F.text('name', 'Nombre'),
          F.num('tier', 'Nivel', { min: 1, max: 10 }),
          F.sel('rarity', 'Rareza', opts(L.RARITY)),
          F.num('value', 'Precio', { min: 0, max: 999999, unit: 'cobre', help: (d) => Ed.panels.priceHelp(d && d.value) }),
          F.area('description', 'Descripción', { rows: 2 }),
        ] },
        { title: 'Protección', fields: [
          F.num('defense', 'Armadura', { min: 0, max: 20, help: 'Se resta de cada golpe que recibís.' }),
          F.num('dodge', 'Esquiva', { min: -5, max: 8, help: 'Sube tu defensa: lo que el enemigo necesita para pegarte.' }),
          F.num('weight', 'Peso', { min: 0, max: 12, help: 'Arma y armadura juntas: lo que pase de 4 te quita velocidad.' }),
          F.tog('magic', 'Mágica', { on: 'Sí', off: 'No' }),
          F.num('mana', 'Maná máximo', { min: 0, max: 20, help: 'Lo suma mientras la tenés puesta (si usás magia).' }),
          F.chips('resist', 'Inmune a', opts(L.RESIST), { help: 'Esos efectos no te tocan mientras la tenés puesta.' }),
          F.num('slots', 'Casillas que ocupa', { min: 1, max: 4 }),
        ] },
      ],
    },

    // ---------------------------------------------------------- Mochilas
    {
      key: 'bags', label: 'Mochilas', one: 'mochila', icon: 'bag', group: 'Cosas',
      hint: 'Cuántas casillas tenés para cargar cosas.',
      meta: (b) => `${b.slots} casillas · nivel ${b.tier}`,
      sort: (a, b) => a.slots - b.slots,
      template: () => ({ name: 'Mochila nueva', slots: 12, value: 60, rarity: 'common', tier: 2, description: '' }),
      sections: [
        { title: 'Lo básico', fields: [
          F.text('name', 'Nombre'),
          F.num('slots', 'Casillas', { min: 4, max: 60 }),
          F.num('tier', 'Nivel', { min: 1, max: 10 }),
          F.sel('rarity', 'Rareza', opts(L.RARITY)),
          F.num('value', 'Precio', { min: 0, max: 999999, unit: 'cobre', help: (d) => Ed.panels.priceHelp(d && d.value) }),
          F.area('description', 'Descripción', { rows: 2 }),
        ] },
      ],
    },

    // ---------------------------------------------------------- Recetas
    {
      key: 'recipes', label: 'Recetas', one: 'receta', icon: 'anvil', group: 'Cosas',
      hint: 'Qué se puede fabricar y con qué.',
      meta: (r) => `${L.WORKSHOP[r.workshop] || r.workshop} · da ${Ed.fields.nameOf(['items', 'weapons', 'armors'], r.result)}`,
      sort: (a, b) => String(a.workshop).localeCompare(String(b.workshop)) || (a.tier - b.tier),
      filters: [{ key: 'ws', label: 'Taller', options: opts(L.WORKSHOP), test: (r, v) => r.workshop === v }],
      template: () => ({ name: 'Receta nueva', workshop: 'forge', tier: 1, result: 'daga', ingredients: [{ itemId: 'mat_hierro', qty: 1 }], description: '' }),
      sections: [
        { title: 'Lo básico', fields: [
          F.text('name', 'Nombre'),
          F.sel('workshop', 'Taller', opts(L.WORKSHOP)),
          F.num('tier', 'Nivel', { min: 1, max: 10 }),
          F.ref('result', 'Lo que sale', ['items', 'weapons', 'armors']),
          F.area('description', 'Descripción', { rows: 2 }),
        ] },
        { title: 'Ingredientes', fields: [
          F.list('ingredients', '', [
            F.ref('itemId', 'Objeto', 'items'),
            F.num('qty', 'Cantidad', { min: 1, max: 99 }),
          ], { one: 'Ingrediente', add: 'Agregar ingrediente', newItem: () => ({ itemId: 'mat_madera', qty: 1 }), itemTitle: (g) => `${esc(Ed.fields.nameOf(['items'], g.itemId))} ×${g.qty || 1}` }),
        ] },
      ],
      normalize: (d) => { d.ingredients = (d.ingredients || []).filter((g) => g && g.itemId); },
    },

    // ---------------------------------------------------------- Hechizos
    {
      key: 'spells', label: 'Hechizos', one: 'hechizo', icon: 'spell', group: 'Magia',
      hint: 'Magia: daño o curación a cambio de maná.',
      meta: (s) => `Nivel ${s.tier} · ${s.manaCost} de maná · ${s.damage ? `daño ${s.damage}` : s.heal ? `cura ${s.heal}` : ''}${s.racial ? ' · de nacimiento' : ''}`,
      sort: (a, b) => (a.racial ? 1 : 0) - (b.racial ? 1 : 0) || (a.tier - b.tier) || String(a.name).localeCompare(String(b.name), 'es'),
      filters: [{ key: 'kind', label: 'Tipo', options: [{ value: 'learn', label: 'Se aprenden' }, { value: 'racial', label: 'De nacimiento' }], test: (s, v) => (v === 'racial' ? !!s.racial : !s.racial) }],
      template: () => ({ name: 'Hechizo nuevo', damage: '1d6', manaCost: 3, tier: 1, school: 'arcane', description: '' }),
      sections: [
        { title: 'Lo básico', fields: [
          F.text('name', 'Nombre'),
          F.sel('school', 'Escuela', opts(L.SCHOOL)),
          F.num('tier', 'Nivel', { min: 1, max: 10 }),
          F.num('manaCost', 'Maná que cuesta', { min: 0, max: 40 }),
          F.ref('racial', 'De nacimiento de', 'races', { none: 'Nadie (se aprende)', help: 'Si es de una raza, no se vende ni se enseña.' }),
          // v3.4: los magos aprenden todo; los híbridos, solo lo marcado
          F.tog('hybrid', 'También para híbridos', { on: 'Sí, los híbridos también lo aprenden', off: 'No, solo magos', when: (d) => !d.racial && !d.hybridOnly, help: 'Para híbridos: hechizos cortos de combate. Nunca los de área ni los de curar a otros.' }),
          F.tog('hybridOnly', 'Solo para híbridos', { on: 'Sí, los magos no lo pueden aprender', off: 'No', when: (d) => !d.racial }),
          F.num('cooldown', 'Espera entre usos', { min: 0, max: 9, help: 'Turnos que hay que esperar para volver a usarlo (0 = sin espera).' }),
          F.area('description', 'Descripción', { rows: 2 }),
        ] },
        { title: 'Efecto', fields: [
          F.dice('damage', 'Daño', { help: 'Tira el dado como un arma (+2): puede fallar y con 20 es crítico. Se suma tu magia.' }),
          F.tog('sure', 'Nunca falla', { on: 'Sí, siempre pega (no tira el dado)', off: 'No, tira el dado', when: (d) => !!d.damage }),
          F.dice('heal', 'Curación', { help: 'Se suma la mitad de tu magia.' }),
          F.tog('selfOnly', 'Cura solo a quien lo lanza', { on: 'Sí, no se le puede tirar a otro', off: 'No, también a compañeros y mascotas', when: (d) => !!d.heal }),
          F.tog('area', 'Le pega a todos', { on: 'Sí, a todos los enemigos', off: 'No, a uno' }),
          F.num('selfHeal', 'Además te cura', { min: 0, max: 20 }),
          ...statusFields('statusEffect'),
        ] },
      ],
      normalize: (d) => { for (const k of ['racial', 'selfHeal', 'mageOnly', 'hybrid', 'hybridOnly', 'cooldown', 'sure', 'selfOnly']) if (!d[k]) delete d[k]; if (d.hybrid) delete d.mageOnly; if (d.hybridOnly) delete d.hybrid; },
    },
  ];

  const byKey = {};
  for (const t of TYPES) byKey[t.key] = t;

  function nameOf(col, e) {
    if (!e) return '';
    const t = byKey[col];
    return (t && t.nameKey ? e[t.nameKey] : e.name) || e.title || e.name || e.id;
  }

  function metaOf(col, e) {
    const t = byKey[col];
    try { return t && t.meta ? t.meta(e) : ''; } catch (err) { return ''; }
  }

  Ed.schema = { TYPES, byKey, L, F, nameOf, metaOf, lvlOf, regionName };
})(window.Aventurs);
