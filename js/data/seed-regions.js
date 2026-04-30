/* ============================================================
   Aventurs — Seed: Regiones
   17 regiones hardcoded según el grafo aprobado.
   Conexiones bidireccionales (Validate.run() lo verifica).

   Modelo:
     id, name, type ('safe'|'combat'), biome, tier [min, max],
     connections [ids], distance, icon, description.
   ============================================================ */

(function (A) {
  'use strict';

  const REGIONS = [
    // --- Tier 1-2 ---
    {
      id: 'pueblo_inicial',
      name: 'Pueblo Inicial',
      type: 'safe',
      biome: 'village',
      tier: [1, 2],
      connections: ['bosque_sombrio', 'cementerio', 'camino_real'],
      distance: 1,
      icon: '🏘️',
      description: 'Casas de piedra y techos de paja se acomodan junto al camino. La gente trabaja sin levantar la vista. Un buen sitio para empezar.',
    },
    {
      id: 'bosque_sombrio',
      name: 'Bosque Sombrío',
      type: 'combat',
      biome: 'forest',
      tier: [1, 2],
      connections: ['pueblo_inicial', 'cementerio'],
      distance: 1,
      icon: '🌲',
      description: 'El sotobosque crepita aunque no haya viento. Algo se mueve entre los helechos y prefiere no mostrarse.',
    },
    {
      id: 'cementerio',
      name: 'Cementerio',
      type: 'combat',
      biome: 'graveyard',
      tier: [1, 2],
      connections: ['pueblo_inicial', 'bosque_sombrio', 'pantano'],
      distance: 1,
      icon: '⚰️',
      description: 'Lápidas torcidas asoman entre la niebla. El pasto crece en parches donde no debería. Los lugareños rodean el lugar.',
    },

    // --- Tier 3-4 ---
    {
      id: 'camino_real',
      name: 'Camino Real',
      type: 'combat',
      biome: 'plains',
      tier: [3, 4],
      connections: ['pueblo_inicial', 'pantano', 'puerto', 'montanas'],
      distance: 1,
      icon: '🛣️',
      description: 'Una vieja calzada de piedra cruza llanuras desiertas. Antes la patrullaban guardias; ahora la patrullan otros.',
    },
    {
      id: 'pantano',
      name: 'Pantano',
      type: 'combat',
      biome: 'swamp',
      tier: [3, 4],
      connections: ['cementerio', 'camino_real'],
      distance: 1,
      icon: '🦎',
      description: 'Aguas estancadas, vapores dulces, fango que se mueve solo. Cada paso es una decisión.',
    },

    // --- Tier 5-6 ---
    {
      id: 'puerto',
      name: 'Puerto',
      type: 'safe',
      biome: 'coast',
      tier: [5, 6],
      connections: ['camino_real', 'torre_del_mago', 'alta_mar'],
      distance: 1,
      icon: '⚓',
      description: 'Mástiles, redes, gritos de gaviota. Aquí se compra acero, se contratan barcos y se olvidan deudas.',
    },
    {
      id: 'torre_del_mago',
      name: 'Torre del Mago',
      type: 'safe',
      biome: 'arcane',
      tier: [5, 6],
      connections: ['puerto', 'ruinas_perdidas'],
      distance: 1,
      icon: '🗼',
      description: 'Una torre de piedra azulada se alza solitaria sobre la costa. Adentro, el aire huele a tinta y a tormenta.',
    },
    {
      id: 'montanas',
      name: 'Montañas',
      type: 'combat',
      biome: 'mountain',
      tier: [5, 6],
      connections: ['camino_real', 'desierto', 'cuevas_ancestrales'],
      distance: 2,
      icon: '⛰️',
      description: 'Picos grises de filo cortante. Aquí el aire se enrarece y el grito de un águila puede escucharse a leguas.',
    },
    {
      id: 'desierto',
      name: 'Desierto',
      type: 'combat',
      biome: 'desert',
      tier: [5, 6],
      connections: ['montanas', 'ruinas_perdidas', 'catacumbas'],
      distance: 2,
      icon: '🏜️',
      description: 'Dunas hasta donde alcanza la vista. El sol no perdona, la arena guarda secretos, y de noche otra cosa los desentierra.',
    },

    // --- Tier 7-8 ---
    {
      id: 'ruinas_perdidas',
      name: 'Ruinas Perdidas',
      type: 'combat',
      biome: 'ruins',
      tier: [7, 8],
      connections: ['torre_del_mago', 'desierto'],
      distance: 2,
      icon: '🏛️',
      description: 'Columnas rotas y mosaicos cubiertos de musgo. Algo todavía vive aquí, y no le gusta tener visitas.',
    },
    {
      id: 'catacumbas',
      name: 'Catacumbas',
      type: 'combat',
      biome: 'crypt',
      tier: [7, 8],
      connections: ['desierto'],
      distance: 2,
      icon: '🦴',
      description: 'Pasillos estrechos forrados de huesos. Cada cráneo parece girar para verte cuando le das la espalda.',
    },
    {
      id: 'cuevas_ancestrales',
      name: 'Cuevas Ancestrales',
      type: 'combat',
      biome: 'cave',
      tier: [7, 8],
      connections: ['montanas', 'volcan'],
      distance: 2,
      icon: '🕳️',
      description: 'Una boca negra en la roca. Adentro, el silencio tiene peso. Aquí se talló piedra antes de los reinos.',
    },
    {
      id: 'alta_mar',
      name: 'Alta Mar',
      type: 'combat',
      biome: 'sea',
      tier: [7, 8],
      connections: ['puerto', 'abismo_marino'],
      distance: 2,
      icon: '🌊',
      description: 'Olas oscuras que rompen contra el casco. Aquí no hay tierra firme. Si caes, no vuelves.',
    },

    // --- Tier 9-10 ---
    {
      id: 'volcan',
      name: 'Volcán',
      type: 'combat',
      biome: 'volcano',
      tier: [9, 10],
      connections: ['cuevas_ancestrales', 'infierno', 'nido_de_dragones'],
      distance: 3,
      icon: '🌋',
      description: 'La montaña respira humo y la piedra está caliente al tacto. Pocos vuelven de aquí, y los que vuelven hablan poco.',
    },
    {
      id: 'infierno',
      name: 'Infierno',
      type: 'combat',
      biome: 'hell',
      tier: [9, 10],
      connections: ['volcan'],
      distance: 3,
      icon: '🔥',
      description: 'Cielos rojos, ríos de magma, criaturas que recuerdan tu nombre desde antes que lo tuvieras.',
    },
    {
      id: 'nido_de_dragones',
      name: 'Nido de Dragones',
      type: 'combat',
      biome: 'lair',
      tier: [9, 10],
      connections: ['volcan'],
      distance: 3,
      icon: '🐲',
      description: 'Cráteres de roca lisa y cáscaras de huevos del tamaño de un hombre. Algo bate las alas a lo lejos.',
    },
    {
      id: 'abismo_marino',
      name: 'Abismo Marino',
      type: 'combat',
      biome: 'abyss',
      tier: [9, 10],
      connections: ['alta_mar'],
      distance: 3,
      icon: '🌑',
      description: 'Bajo el último haz de luz, el océano se cierra como una boca. Aquí abajo los siglos no se cuentan.',
    },
  ];

  A.Seed = A.Seed || {};
  A.Seed.regions = REGIONS;
})(window.Aventurs);
