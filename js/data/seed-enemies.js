/* ============================================================
   Aventurs — Seed: Enemigos
   79 enemigos hardcoded (lista de 84 menos 5 duplicados normalizados:
   Lobo, Esqueleto, Araña, Murciélago, Fénix se dejaron en una sola entrada).

   Modelo:
     id, name, icon, family[], category, tier, tags[], biome[],
     health, damage, difficulty (D20 dificultad de impacto),
     armor, speed, coinLoot [min, max] (en cobre),
     drops [{itemId, chance}], regions [], autoLoot.

   Stats fueron asignados manualmente con criterio coherente:
     - tier 1-2: enemigos básicos (10-30 HP, 2-5 daño)
     - tier 3-4: amenaza moderada (30-60 HP, 5-9 daño)
     - tier 5-6: peligrosos (60-100 HP, 9-14 daño)
     - tier 7-8: muy peligrosos (100-180 HP, 14-22 daño)
     - tier 9-10: catastróficos (180-400 HP, 22-50 daño)
   AutoBalance puede recalcular stats sobre estas bases si querés.
   ============================================================ */

(function (A) {
  'use strict';

  const ENEMIES = [
    // ============================================================
    // TIER 1-2: bestias básicas, no-muertos chicos, humanoides simples
    // ============================================================
    { id:'rata', name:'Rata', icon:'🐀', family:['beast'], category:'weak', tier:1, tags:['small'], biome:['village','forest','crypt'],
      health:6, damage:2, difficulty:7, armor:0, speed:11, coinLoot:[0,2], drops:[], regions:['bosque_sombrio','cementerio'], spawnWeight:2, tameable:true, tameItem:'carne_cruda', autoLoot:true },

    { id:'rata_gigante', name:'Rata gigante', icon:'🐀', family:['beast'], category:'normal', tier:2, tags:['poison'], biome:['forest','crypt','swamp'],
      health:14, damage:4, difficulty:8, armor:0, speed:10, coinLoot:[1,4], drops:[], regions:['bosque_sombrio','cementerio','pantano'], spawnWeight:1, tameable:true, tameItem:'carne_cruda', autoLoot:true },

    { id:'gato', name:'Gato salvaje', icon:'🐈‍⬛', family:['beast'], category:'weak', tier:1, tags:['small','agile'], biome:['village','forest'],
      health:8, damage:2, difficulty:8, armor:0, speed:13, coinLoot:[0,1], drops:[], regions:['bosque_sombrio'], spawnWeight:2, tameable:true, tameItem:'carne_cruda', autoLoot:true },

    { id:'perro_salvaje', name:'Perro salvaje', icon:'🐕', family:['beast'], category:'weak', tier:1, tags:[], biome:['village','plains','forest'],
      health:10, damage:3, difficulty:8, armor:0, speed:11, coinLoot:[0,2], drops:[], regions:['bosque_sombrio','camino_real'], spawnWeight:2, tameable:true, tameItem:'carne_cruda', autoLoot:true },

    { id:'cuervo', name:'Cuervo', icon:'🐦‍⬛', family:['beast','flying'], category:'weak', tier:1, tags:['flying'], biome:['graveyard','plains'],
      health:5, damage:2, difficulty:9, armor:0, speed:13, coinLoot:[0,1], drops:[], regions:['cementerio'], spawnWeight:2, tameable:true, tameItem:'carne_cruda', autoLoot:true },

    { id:'buho', name:'Búho', icon:'🦉', family:['beast','flying'], category:'weak', tier:1, tags:['flying'], biome:['forest'],
      health:7, damage:2, difficulty:9, armor:0, speed:12, coinLoot:[0,1], drops:[], regions:['bosque_sombrio'], spawnWeight:2, tameable:true, tameItem:'carne_cruda', autoLoot:true },

    { id:'halcon', name:'Halcón', icon:'🦅', family:['beast','flying'], category:'weak', tier:2, tags:['flying','agile'], biome:['mountain','plains'],
      health:9, damage:3, difficulty:10, armor:0, speed:14, coinLoot:[0,2], drops:[], regions:['camino_real','montanas'], spawnWeight:2, tameable:true, tameItem:'carne_cruda', autoLoot:true },

    { id:'aguila', name:'Águila', icon:'🦅', family:['beast','flying'], category:'normal', tier:3, tags:['flying'], biome:['mountain'],
      health:18, damage:5, difficulty:11, armor:0, speed:14, coinLoot:[1,3], drops:[], regions:['montanas'], spawnWeight:1, tameable:true, tameItem:'carne_cruda', autoLoot:true },

    { id:'serpiente', name:'Serpiente', icon:'🐍', family:['beast'], category:'weak', tier:2, tags:['poison'], biome:['forest','swamp','desert'],
      health:8, damage:3, difficulty:9, armor:0, speed:10, coinLoot:[0,2], drops:[], regions:['bosque_sombrio','pantano','desierto'], spawnWeight:2, tameable:true, tameItem:'carne_cruda', autoLoot:true },

    { id:'arana', name:'Araña', icon:'🕷️', family:['insect'], category:'weak', tier:1, tags:['poison','small'], biome:['cave','crypt','forest'],
      health:7, damage:2, difficulty:9, armor:0, speed:11, coinLoot:[0,1], drops:[], regions:['bosque_sombrio','cuevas_ancestrales','catacumbas'], spawnWeight:2, tameable:true, tameItem:'carne_cruda', autoLoot:true },

    { id:'murcielago', name:'Murciélago', icon:'🦇', family:['beast','flying'], category:'weak', tier:1, tags:['flying','small'], biome:['cave','crypt'],
      health:5, damage:2, difficulty:10, armor:0, speed:13, coinLoot:[0,1], drops:[], regions:['cuevas_ancestrales','catacumbas','cementerio'], spawnWeight:2, tameable:true, tameItem:'carne_cruda', autoLoot:true },

    { id:'zorro', name:'Zorro', icon:'🦊', family:['beast'], category:'weak', tier:1, tags:['agile'], biome:['forest','plains'],
      health:9, damage:2, difficulty:9, armor:0, speed:12, coinLoot:[0,2], drops:[], regions:['bosque_sombrio'], spawnWeight:2, tameable:true, tameItem:'carne_cruda', autoLoot:true },

    { id:'jabali', name:'Jabalí', icon:'🐗', family:['beast'], category:'normal', tier:2, tags:['charge'], biome:['forest','plains'],
      health:18, damage:5, difficulty:9, armor:1, speed:9, coinLoot:[1,3], drops:[], regions:['bosque_sombrio','camino_real'], spawnWeight:1, tameable:true, tameItem:'carne_cruda', autoLoot:true },

    { id:'tortuga', name:'Tortuga gigante', icon:'🐢', family:['beast'], category:'normal', tier:2, tags:['armor'], biome:['swamp','coast'],
      health:22, damage:3, difficulty:7, armor:3, speed:5, coinLoot:[1,3], drops:[], regions:['pantano'], spawnWeight:1, tameable:true, tameItem:'carne_cruda', autoLoot:true },

    { id:'lobo', name:'Lobo', icon:'🐺', family:['beast'], category:'normal', tier:2, tags:['pack'], biome:['forest','mountain'],
      health:15, damage:4, difficulty:9, armor:0, speed:11, coinLoot:[1,3], drops:[], regions:['bosque_sombrio','camino_real','montanas'], spawnWeight:1, tameable:true, tameItem:'carne_cruda', autoLoot:true },

    { id:'oso', name:'Oso', icon:'🐻', family:['beast'], category:'strong', tier:4, tags:[], biome:['forest','mountain'],
      health:50, damage:9, difficulty:11, armor:2, speed:8, coinLoot:[3,8], drops:[], regions:['bosque_sombrio','montanas'], spawnWeight:0.6, tameable:true, tameItem:'carne_cruda', autoLoot:true },

    { id:'esqueleto', name:'Esqueleto', icon:'💀', family:['undead'], category:'normal', tier:2, tags:[], biome:['crypt','graveyard'],
      health:14, damage:4, difficulty:9, armor:1, speed:8, coinLoot:[1,4], drops:[], regions:['cementerio','catacumbas'], spawnWeight:1, tameable:false, autoLoot:true },

    { id:'zombi', name:'Zombi', icon:'🧟', family:['undead'], category:'normal', tier:2, tags:['slow'], biome:['crypt','graveyard'],
      health:18, damage:4, difficulty:8, armor:0, speed:6, coinLoot:[0,3], drops:[], regions:['cementerio'], spawnWeight:1, tameable:false, autoLoot:true },

    { id:'escorpion', name:'Escorpión', icon:'🦂', family:['insect'], category:'normal', tier:3, tags:['poison'], biome:['desert','cave'],
      health:18, damage:5, difficulty:10, armor:1, speed:10, coinLoot:[1,4], drops:[], regions:['desierto','cuevas_ancestrales'], spawnWeight:1, tameable:true, tameItem:'carne_cruda', autoLoot:true },

    { id:'slime', name:'Slime', icon:'🟢', family:['elemental'], category:'normal', tier:2, tags:['acid'], biome:['cave','swamp'],
      health:20, damage:3, difficulty:7, armor:0, speed:6, coinLoot:[1,3], drops:[], regions:['pantano','cuevas_ancestrales'], spawnWeight:1, tameable:true, tameItem:'carne_cruda', autoLoot:true },

    { id:'goblin', name:'Goblin', icon:'👺', family:['humanoid'], category:'normal', tier:2, tags:[], biome:['forest','cave'],
      health:14, damage:4, difficulty:9, armor:1, speed:10, coinLoot:[2,6], drops:[], regions:['bosque_sombrio','cuevas_ancestrales'], spawnWeight:1, tameable:false, autoLoot:true },

    { id:'kobold', name:'Kobold', icon:'🦎', family:['humanoid'], category:'normal', tier:2, tags:['pack'], biome:['cave','mountain'],
      health:12, damage:3, difficulty:9, armor:1, speed:11, coinLoot:[2,5], drops:[], regions:['cuevas_ancestrales','montanas'], spawnWeight:1, tameable:false, autoLoot:true },

    { id:'bandido', name:'Bandido', icon:'🗡️', family:['humanoid'], category:'normal', tier:3, tags:[], biome:['plains','forest'],
      health:24, damage:6, difficulty:10, armor:2, speed:10, coinLoot:[5,12], drops:[], regions:['camino_real','bosque_sombrio'], spawnWeight:1, tameable:false, autoLoot:true },

    // ============================================================
    // TIER 3-4: amenaza moderada
    // ============================================================
    { id:'diablillo', name:'Diablillo', icon:'😈', family:['demon','flying'], category:'normal', tier:4, tags:['fire','flying'], biome:['hell','ruins'],
      health:28, damage:7, difficulty:11, armor:1, speed:12, coinLoot:[3,8], drops:[], regions:['ruinas_perdidas'], spawnWeight:1, tameable:false, autoLoot:true },

    { id:'orco', name:'Orco', icon:'👹', family:['humanoid'], category:'strong', tier:4, tags:[], biome:['mountain','plains'],
      health:42, damage:9, difficulty:11, armor:3, speed:9, coinLoot:[5,12], drops:[], regions:['camino_real','montanas'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'hobgoblin', name:'Hobgoblin', icon:'👺', family:['humanoid'], category:'normal', tier:4, tags:[], biome:['forest','cave'],
      health:32, damage:7, difficulty:11, armor:2, speed:10, coinLoot:[4,10], drops:[], regions:['bosque_sombrio','cuevas_ancestrales'], spawnWeight:1, tameable:false, autoLoot:true },

    { id:'fantasma', name:'Fantasma', icon:'👻', family:['undead','spirit'], category:'normal', tier:4, tags:['ethereal'], biome:['graveyard','crypt','ruins'],
      health:24, damage:7, difficulty:13, armor:0, speed:11, coinLoot:[2,6], drops:[], regions:['cementerio','catacumbas'], spawnWeight:1, tameable:false, autoLoot:true },

    { id:'necrofago', name:'Necrófago', icon:'🧟', family:['undead'], category:'normal', tier:4, tags:['disease'], biome:['crypt','graveyard'],
      health:36, damage:8, difficulty:11, armor:1, speed:7, coinLoot:[3,8], drops:[], regions:['cementerio','catacumbas'], spawnWeight:1, tameable:false, autoLoot:true },

    { id:'banshee', name:'Banshee', icon:'😱', family:['undead','spirit'], category:'strong', tier:5, tags:['scream','ethereal'], biome:['graveyard','crypt'],
      health:40, damage:11, difficulty:13, armor:0, speed:12, coinLoot:[4,10], drops:[], regions:['catacumbas'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'gargola', name:'Gárgola', icon:'🗿', family:['construct','flying'], category:'strong', tier:5, tags:['stone','flying'], biome:['ruins','arcane'],
      health:50, damage:10, difficulty:11, armor:5, speed:9, coinLoot:[5,12], drops:[], regions:['ruinas_perdidas'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'arpia', name:'Arpía', icon:'🦅', family:['humanoid','flying'], category:'normal', tier:4, tags:['flying'], biome:['mountain'],
      health:30, damage:7, difficulty:12, armor:1, speed:13, coinLoot:[3,8], drops:[], regions:['montanas'], spawnWeight:1, tameable:false, autoLoot:true },

    { id:'cangrejo', name:'Cangrejo gigante', icon:'🦀', family:['marine','aquatic'], category:'normal', tier:4, tags:['armor','aquatic'], biome:['coast','sea'],
      health:36, damage:7, difficulty:9, armor:5, speed:6, coinLoot:[3,8], drops:[], regions:['puerto','alta_mar'], spawnWeight:1, tameable:true, tameItem:'pescado_fresco', autoLoot:true },

    // ============================================================
    // TIER 5-6: peligrosos
    // ============================================================
    { id:'tiburon', name:'Tiburón', icon:'🦈', family:['marine','aquatic'], category:'strong', tier:6, tags:['aquatic'], biome:['sea'],
      health:65, damage:13, difficulty:11, armor:2, speed:13, coinLoot:[6,15], drops:[], regions:['alta_mar'], spawnWeight:0.6, tameable:true, tameItem:'pescado_fresco', autoLoot:true },

    { id:'licantropo', name:'Licántropo', icon:'🐺', family:['humanoid','beast'], category:'strong', tier:6, tags:['curse'], biome:['forest','mountain'],
      health:75, damage:14, difficulty:12, armor:2, speed:12, coinLoot:[8,18], drops:[], regions:['bosque_sombrio','montanas'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'ogro', name:'Ogro', icon:'👹', family:['humanoid','giant'], category:'strong', tier:5, tags:['heavy'], biome:['mountain','swamp'],
      health:80, damage:13, difficulty:10, armor:3, speed:7, coinLoot:[7,15], drops:[], regions:['montanas','pantano'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'troll', name:'Troll', icon:'🧌', family:['humanoid','giant'], category:'strong', tier:6, tags:['regen'], biome:['cave','swamp','mountain'],
      health:90, damage:13, difficulty:11, armor:3, speed:8, coinLoot:[8,18], drops:[], regions:['cuevas_ancestrales','pantano'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'minotauro', name:'Minotauro', icon:'🐂', family:['humanoid'], category:'strong', tier:6, tags:['charge'], biome:['ruins','cave'],
      health:85, damage:14, difficulty:12, armor:3, speed:10, coinLoot:[8,18], drops:[], regions:['ruinas_perdidas','cuevas_ancestrales'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'sirena', name:'Sirena', icon:'🧜‍♀️', family:['humanoid','aquatic'], category:'normal', tier:5, tags:['aquatic','charm'], biome:['sea','coast'],
      health:50, damage:10, difficulty:13, armor:1, speed:11, coinLoot:[6,14], drops:[], regions:['alta_mar'], spawnWeight:1, tameable:false, autoLoot:true },

    { id:'salamandra', name:'Salamandra', icon:'🦎', family:['elemental','beast'], category:'normal', tier:5, tags:['fire'], biome:['volcano','cave'],
      health:55, damage:11, difficulty:11, armor:2, speed:10, coinLoot:[6,14], drops:[], regions:['cuevas_ancestrales','volcan'], spawnWeight:1, tameable:true, tameItem:'carne_cruda', autoLoot:true },

    { id:'mago_oscuro', name:'Mago oscuro', icon:'🧙‍♂️', family:['humanoid','arcane'], category:'strong', tier:6, tags:['magic'], biome:['arcane','ruins'],
      health:55, damage:14, difficulty:13, armor:1, speed:10, coinLoot:[12,25], drops:[], regions:['ruinas_perdidas'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'nigromante', name:'Nigromante', icon:'💀', family:['humanoid','arcane'], category:'strong', tier:6, tags:['undead','magic'], biome:['crypt','graveyard'],
      health:55, damage:13, difficulty:13, armor:1, speed:9, coinLoot:[12,25], drops:[], regions:['catacumbas'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'osgo', name:'Osgo', icon:'🐗', family:['humanoid'], category:'normal', tier:5, tags:[], biome:['forest','cave'],
      health:60, damage:11, difficulty:11, armor:2, speed:9, coinLoot:[6,14], drops:[], regions:['bosque_sombrio','cuevas_ancestrales'], spawnWeight:1, tameable:false, autoLoot:true },

    { id:'ettin', name:'Ettin', icon:'👹', family:['humanoid','giant'], category:'strong', tier:6, tags:['heavy'], biome:['mountain'],
      health:95, damage:14, difficulty:11, armor:3, speed:7, coinLoot:[10,20], drops:[], regions:['montanas'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'drow', name:'Drow', icon:'🧝‍♂️', family:['humanoid','arcane'], category:'normal', tier:5, tags:['agile','poison'], biome:['cave'],
      health:48, damage:11, difficulty:13, armor:2, speed:12, coinLoot:[8,18], drops:[], regions:['cuevas_ancestrales'], spawnWeight:1, tameable:false, autoLoot:true },

    { id:'driade', name:'Dríade', icon:'🌳', family:['plant','spirit'], category:'normal', tier:5, tags:['nature','charm'], biome:['forest'],
      health:50, damage:10, difficulty:12, armor:1, speed:10, coinLoot:[6,14], drops:[], regions:['bosque_sombrio'], spawnWeight:1, tameable:false, autoLoot:true },

    { id:'ent', name:'Ent', icon:'🌲', family:['plant'], category:'strong', tier:6, tags:['nature','heavy'], biome:['forest'],
      health:100, damage:13, difficulty:10, armor:5, speed:5, coinLoot:[8,18], drops:[], regions:['bosque_sombrio'], spawnWeight:0.6, tameable:false, autoLoot:true },

    // ============================================================
    // TIER 7-8: muy peligrosos
    // ============================================================
    { id:'vampiro', name:'Vampiro', icon:'🧛', family:['undead','humanoid'], category:'strong', tier:7, tags:['drain'], biome:['crypt','graveyard'],
      health:110, damage:17, difficulty:14, armor:3, speed:12, coinLoot:[15,30], drops:[], regions:['catacumbas'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'elem_hielo', name:'Elemental de hielo', icon:'❄️', family:['elemental'], category:'strong', tier:7, tags:['ice','arcane'], biome:['mountain','arcane'],
      health:120, damage:16, difficulty:12, armor:4, speed:8, coinLoot:[12,24], drops:[], regions:['montanas','ruinas_perdidas'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'elem_fuego', name:'Elemental de fuego', icon:'🔥', family:['elemental'], category:'strong', tier:7, tags:['fire','arcane'], biome:['volcano','arcane'],
      health:115, damage:18, difficulty:12, armor:3, speed:10, coinLoot:[12,24], drops:[], regions:['volcan','ruinas_perdidas'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'elem_arcano', name:'Elemental arcano', icon:'✨', family:['elemental','arcane'], category:'strong', tier:7, tags:['arcane','magic'], biome:['arcane','ruins'],
      health:105, damage:18, difficulty:14, armor:2, speed:11, coinLoot:[14,28], drops:[], regions:['ruinas_perdidas'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'golem', name:'Gólem', icon:'🗿', family:['construct'], category:'strong', tier:7, tags:['stone','heavy'], biome:['ruins','cave'],
      health:140, damage:15, difficulty:11, armor:7, speed:6, coinLoot:[10,22], drops:[], regions:['ruinas_perdidas','cuevas_ancestrales'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'golem_lava', name:'Gólem de lava', icon:'🌋', family:['construct','elemental'], category:'strong', tier:8, tags:['fire','heavy'], biome:['volcano'],
      health:160, damage:19, difficulty:12, armor:6, speed:6, coinLoot:[14,28], drops:[], regions:['volcan'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'serp_marina', name:'Serpiente marina', icon:'🐍', family:['marine','aquatic'], category:'strong', tier:7, tags:['aquatic','poison'], biome:['sea','abyss'],
      health:130, damage:17, difficulty:13, armor:3, speed:11, coinLoot:[14,28], drops:[], regions:['alta_mar'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'tentaculo', name:'Tentáculo', icon:'🐙', family:['marine','aquatic'], category:'normal', tier:7, tags:['aquatic','grab'], biome:['sea','abyss'],
      health:90, damage:15, difficulty:13, armor:1, speed:9, coinLoot:[10,22], drops:[], regions:['alta_mar','abismo_marino'], spawnWeight:1, tameable:false, autoLoot:true },

    { id:'manticora', name:'Mantícora', icon:'🦁', family:['beast','flying'], category:'strong', tier:7, tags:['flying','poison'], biome:['mountain','desert'],
      health:120, damage:17, difficulty:13, armor:3, speed:12, coinLoot:[14,28], drops:[], regions:['montanas','desierto'], spawnWeight:0.6, tameable:true, tameItem:'carne_cruda', autoLoot:true },

    { id:'quimera', name:'Quimera', icon:'🐲', family:['beast','flying'], category:'strong', tier:8, tags:['fire','flying'], biome:['mountain','volcano'],
      health:155, damage:20, difficulty:14, armor:4, speed:11, coinLoot:[16,32], drops:[], regions:['montanas','volcan'], spawnWeight:0.6, tameable:true, tameItem:'carne_cruda', autoLoot:true },

    { id:'medusa', name:'Medusa', icon:'🐍', family:['humanoid'], category:'strong', tier:7, tags:['petrify'], biome:['ruins','crypt'],
      health:90, damage:16, difficulty:14, armor:2, speed:10, coinLoot:[14,28], drops:[], regions:['ruinas_perdidas','catacumbas'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'ciclope', name:'Cíclope', icon:'👁️', family:['humanoid','giant'], category:'strong', tier:8, tags:['heavy'], biome:['mountain','cave'],
      health:170, damage:20, difficulty:12, armor:4, speed:7, coinLoot:[16,32], drops:[], regions:['montanas','cuevas_ancestrales'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'dragon_joven', name:'Dragón joven', icon:'🐲', family:['dragon','flying'], category:'strong', tier:8, tags:['fire','flying'], biome:['mountain','lair'],
      health:175, damage:21, difficulty:14, armor:5, speed:12, coinLoot:[20,40], drops:[], regions:['nido_de_dragones','volcan'], spawnWeight:0.6, tameable:true, tameItem:'carne_cruda', autoLoot:true },

    { id:'fenix', name:'Fénix', icon:'🔥', family:['beast','flying'], category:'strong', tier:8, tags:['fire','flying','revive'], biome:['volcano'],
      health:140, damage:19, difficulty:14, armor:3, speed:14, coinLoot:[18,35], drops:[], regions:['volcan'], spawnWeight:0.6, tameable:true, tameItem:'carne_cruda', autoLoot:true },

    { id:'lich', name:'Lich', icon:'💀', family:['undead','arcane'], category:'boss', tier:9, tags:['magic','undead'], biome:['crypt','arcane'],
      health:220, damage:25, difficulty:15, armor:4, speed:10, coinLoot:[40,80], drops:[], regions:['catacumbas'], spawnWeight:0.3, tameable:false, autoLoot:true },

    { id:'espectro', name:'Espectro', icon:'👻', family:['undead','spirit'], category:'strong', tier:7, tags:['ethereal','drain'], biome:['crypt','graveyard'],
      health:95, damage:17, difficulty:14, armor:0, speed:12, coinLoot:[12,24], drops:[], regions:['catacumbas'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'aparicion', name:'Aparición', icon:'👻', family:['undead','spirit'], category:'strong', tier:8, tags:['ethereal','fear'], biome:['crypt','graveyard'],
      health:115, damage:19, difficulty:15, armor:0, speed:13, coinLoot:[15,30], drops:[], regions:['catacumbas'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'naga', name:'Naga', icon:'🐍', family:['humanoid','aquatic'], category:'strong', tier:7, tags:['aquatic','poison'], biome:['swamp','sea'],
      health:115, damage:17, difficulty:14, armor:3, speed:10, coinLoot:[14,28], drops:[], regions:['alta_mar','pantano'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'contemplador', name:'Contemplador', icon:'👁️', family:['arcane'], category:'strong', tier:8, tags:['magic','flying'], biome:['cave','arcane'],
      health:140, damage:20, difficulty:15, armor:3, speed:9, coinLoot:[18,35], drops:[], regions:['cuevas_ancestrales','ruinas_perdidas'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'cab_muerte', name:'Caballero de la muerte', icon:'☠️', family:['undead','humanoid'], category:'strong', tier:8, tags:['heavy','undead'], biome:['crypt','graveyard'],
      health:170, damage:20, difficulty:14, armor:6, speed:8, coinLoot:[18,36], drops:[], regions:['catacumbas'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'sucubo', name:'Súcubo', icon:'😈', family:['demon','flying'], category:'strong', tier:7, tags:['charm','flying'], biome:['hell','ruins'],
      health:100, damage:17, difficulty:14, armor:2, speed:13, coinLoot:[15,30], drops:[], regions:['ruinas_perdidas','infierno'], spawnWeight:0.6, tameable:false, autoLoot:true },

    // ============================================================
    // TIER 9-10: catastróficos / boss
    // ============================================================
    { id:'brightwing', name:'Brightwing', icon:'🐉', family:['dragon','arcane','flying'], category:'strong', tier:6, tags:['magic','flying'], biome:['arcane'],
      health:140, damage:18, difficulty:14, armor:4, speed:13, coinLoot:[25,50], drops:[], regions:['torre_del_mago','ruinas_perdidas'], spawnWeight:0.6, tameable:false, autoLoot:true },

    { id:'dragon_anciano', name:'Dragón anciano', icon:'🐉', family:['dragon','flying','legendary'], category:'boss', tier:10, tags:['fire','flying','ancient'], biome:['lair','volcano'],
      health:380, damage:42, difficulty:16, armor:7, speed:13, coinLoot:[100,200], drops:[], regions:['nido_de_dragones'], spawnWeight:0.1, tameable:false, autoLoot:true },

    { id:'alamuerte', name:'Alamuerte', icon:'🐲', family:['dragon','flying','legendary'], category:'boss', tier:10, tags:['fire','ancient','flying'], biome:['volcano','lair'],
      health:400, damage:48, difficulty:16, armor:8, speed:12, coinLoot:[120,250], drops:[], regions:['volcan','nido_de_dragones'], spawnWeight:0.1, tameable:false, autoLoot:true },

    { id:'demonio_mayor', name:'Demonio mayor', icon:'👹', family:['demon'], category:'boss', tier:9, tags:['fire'], biome:['hell'],
      health:280, damage:32, difficulty:15, armor:5, speed:10, coinLoot:[60,120], drops:[], regions:['infierno'], spawnWeight:0.3, tameable:false, autoLoot:true },

    { id:'balrog', name:'Balrog', icon:'😈', family:['demon','legendary'], category:'boss', tier:10, tags:['fire','ancient'], biome:['hell','volcano'],
      health:350, damage:40, difficulty:15, armor:6, speed:10, coinLoot:[90,180], drops:[], regions:['infierno','volcan'], spawnWeight:0.1, tameable:false, autoLoot:true },

    { id:'senor_vampiro', name:'Señor vampiro', icon:'🧛', family:['undead','humanoid'], category:'boss', tier:9, tags:['drain','ancient'], biome:['crypt'],
      health:260, damage:30, difficulty:15, armor:5, speed:13, coinLoot:[60,120], drops:[], regions:['catacumbas'], spawnWeight:0.3, tameable:false, autoLoot:true },

    { id:'archimago', name:'Archimago', icon:'🧙', family:['humanoid','arcane','legendary'], category:'boss', tier:9, tags:['magic','ancient'], biome:['arcane'],
      health:200, damage:35, difficulty:16, armor:3, speed:11, coinLoot:[80,150], drops:[], regions:['ruinas_perdidas'], spawnWeight:0.1, tameable:false, autoLoot:true },

    { id:'kraken', name:'Kraken', icon:'🐙', family:['marine','aquatic','legendary'], category:'boss', tier:10, tags:['aquatic','ancient'], biome:['abyss','sea'],
      health:380, damage:38, difficulty:15, armor:5, speed:10, coinLoot:[100,200], drops:[], regions:['abismo_marino','alta_mar'], spawnWeight:0.1, tameable:false, autoLoot:true },

    { id:'hidra', name:'Hidra', icon:'🐍', family:['beast','aquatic'], category:'boss', tier:9, tags:['regen','poison'], biome:['swamp'],
      health:300, damage:32, difficulty:15, armor:4, speed:9, coinLoot:[70,140], drops:[], regions:['pantano'], spawnWeight:0.3, tameable:true, tameItem:'pescado_fresco', autoLoot:true },

    { id:'titan', name:'Titán', icon:'⚔️', family:['humanoid','giant','legendary'], category:'boss', tier:10, tags:['ancient','heavy'], biome:['mountain'],
      health:400, damage:42, difficulty:14, armor:8, speed:8, coinLoot:[100,200], drops:[], regions:['montanas','ruinas_perdidas'], spawnWeight:0.1, tameable:false, autoLoot:true },

    { id:'tarrasca', name:'Tarrasca', icon:'🦖', family:['beast','legendary'], category:'boss', tier:10, tags:['ancient','heavy'], biome:['cave','volcano'],
      health:450, damage:45, difficulty:14, armor:9, speed:7, coinLoot:[120,250], drops:[], regions:['cuevas_ancestrales','volcan'], spawnWeight:0.1, tameable:false, autoLoot:true },
  ];

  A.Seed = A.Seed || {};
  A.Seed.enemies = ENEMIES;
})(window.Aventurs);
