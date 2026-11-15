/* ============================================================
   Aventurs — Seed: Armas (v1.8.0)
   Daño y precio salen de js/core/balance.js según tier y rareza:
     - dagas: un poco menos de daño, pero sangrado
     - armas mágicas: menos daño físico, suman poder a los hechizos
     - armas pesadas (peso 5+): más daño, te hacen más lento
   ============================================================ */

(function (A) {
  'use strict';

  const WEAPONS = [
    { id:'garrote', name:'Garrote', type:'weapon', icon:'🏏', damage:'1d4', value:10, rarity:'common', tier:1, weight:2, magic:false,
      description:'Madera nudosa con manija. Lo más simple que se llama arma.' },

    { id:'daga', name:'Daga', type:'weapon', icon:'🗡️', damage:'1d4', value:25, rarity:'common', tier:1, weight:1, statusEffect:{type:'bleed',chance:0.2,turns:3,value:1}, magic:false,
      description:'Hoja corta y ligera. Buena para empezar.' },

    { id:'espada_corta', name:'Espada corta', type:'weapon', icon:'⚔️', damage:'1d4', value:25, rarity:'common', tier:1, weight:2, magic:false,
      description:'Una hoja confiable. La elección clásica del aventurero novato.' },

    { id:'baston', name:'Bastón', type:'weapon', icon:'🪄', damage:'1d4', value:25, rarity:'common', tier:1, weight:1, magic:true,
      description:'Madera tallada con runas. Quien lo empuña siente el zumbido del maná.' },

    { id:'hacha_de_mano', name:'Hacha de mano', type:'weapon', icon:'🪓', damage:'1d6', value:36, rarity:'common', tier:2, weight:2, magic:false,
      description:'Pesada pero efectiva. Astilla escudos con un golpe firme.' },

    { id:'arco_corto', name:'Arco corto', type:'weapon', icon:'🏹', damage:'1d6', value:36, rarity:'common', tier:2, weight:2, magic:false,
      description:'Ligero, certero, silencioso. La distancia es su mejor escudo.' },

    { id:'varita', name:'Varita', type:'weapon', icon:'🪄', damage:'1d4', value:36, rarity:'common', tier:2, weight:0, magic:true,
      description:'Madera tallada con runas. Canaliza maná pero pega flojo si te quedás sin.' },

    { id:'lanza', name:'Lanza', type:'weapon', icon:'🔱', damage:'1d6+1', value:53, rarity:'common', tier:3, weight:3, magic:false,
      description:'Asta larga con punta de hierro. Mantiene al enemigo a raya.' },

    { id:'maza', name:'Maza', type:'weapon', icon:'🔨', damage:'1d8+1', value:68, rarity:'uncommon', tier:3, weight:3, magic:false,
      description:'Cabeza de hierro macizo. No corta, aplasta.' },

    { id:'daga_obsidiana', name:'Daga de obsidiana', type:'weapon', icon:'🗡️', damage:'1d6+1', value:68, rarity:'uncommon', tier:3, weight:1, statusEffect:{type:'bleed',chance:0.3,turns:3,value:1}, magic:false,
      description:'Filo de vidrio volcánico, más cortante que el acero pero frágil. Hace sangrar feo.' },

    { id:'espada_larga', name:'Espada larga', type:'weapon', icon:'⚔️', damage:'2d4+1', value:99, rarity:'uncommon', tier:4, weight:3, magic:false,
      description:'Más peso, más alcance, más daño. Para quien sabe blandir bien.' },

    { id:'cetro_arcano', name:'Cetro arcano', type:'weapon', icon:'🪄', damage:'1d8+1', value:99, rarity:'uncommon', tier:4, weight:1, magic:true,
      description:'Una piedra azul late en el extremo. Alimenta hechizos con cada golpe.' },

    { id:'ballesta', name:'Ballesta', type:'weapon', icon:'🏹', damage:'2d4+1', value:99, rarity:'uncommon', tier:4, weight:4, magic:false,
      description:'Arco mecánico que pega más fuerte que un arco común. Lenta de recargar.' },

    { id:'lanza_hueso', name:'Lanza de hueso antiguo', type:'weapon', icon:'🔱', damage:'2d4+1', value:99, rarity:'uncommon', tier:4, weight:2, magic:false,
      description:'Asta tallada de un hueso que no se rompe. Liviana y temida.' },

    { id:'mandoble', name:'Mandoble', type:'weapon', icon:'🗡️', damage:'2d8', value:188, rarity:'rare', tier:5, weight:5, slots:2, magic:false,
      description:'Espada a dos manos. Tremenda. Lenta. Devastadora.' },

    { id:'katana', name:'Katana', type:'weapon', icon:'⚔️', damage:'2d6', value:188, rarity:'rare', tier:5, weight:2, magic:false, statusEffect:{type:'bleed',chance:0.3,turns:3,value:2},
      description:'Hoja curva forjada en cien capas. Corta lo que mira, sangra lo que toca.' },

    { id:'alabarda', name:'Alabarda', type:'weapon', icon:'🪓', damage:'2d8', value:188, rarity:'rare', tier:5, weight:5, slots:2, magic:false,
      description:'Hacha y lanza juntas en un asta larga. Para mantener distancia y abrir cráneos.' },

    { id:'baston_de_fuego', name:'Bastón de fuego', type:'weapon', icon:'🔥', damage:'2d4+1', value:188, rarity:'rare', tier:5, weight:2, magic:true, statusEffect:{type:'fire',chance:0.4,turns:4,value:2},
      description:'La punta arde sin consumirse. Cada golpe deja brasas en la herida.' },

    { id:'baston_de_hielo', name:'Bastón de hielo', type:'weapon', icon:'❄️', damage:'2d4+1', value:188, rarity:'rare', tier:5, weight:2, magic:true, statusEffect:{type:'cold',chance:0.4,turns:4,value:3},
      description:'Cristal helado en el extremo. Quien lo toca queda lento por minutos.' },

    { id:'arco_pluma', name:'Arco de pluma extraña', type:'weapon', icon:'🏹', damage:'2d6+1', value:188, rarity:'rare', tier:5, weight:1, magic:false,
      description:'Empuñadura adornada con plumas que no son de este mundo. Dispara más lejos.' },

    { id:'hacha_de_guerra', name:'Hacha de guerra', type:'weapon', icon:'🪓', damage:'2d8+1', value:272, rarity:'rare', tier:6, weight:5, slots:2, magic:false,
      description:'Forjada para reyes y para enemigos de reyes.' },

    { id:'baston_arcano', name:'Bastón arcano', type:'weapon', icon:'🪄', damage:'2d6', value:272, rarity:'rare', tier:6, weight:2, statusEffect:{type:'fire',chance:0.2,turns:3,value:2}, magic:true,
      description:'Madera de fresno teñida en sangre de dragón. Dobla el poder de los hechizos.' },

    { id:'martillo_de_guerra', name:'Martillo de guerra', type:'weapon', icon:'🔨', damage:'2d8+1', value:272, rarity:'rare', tier:6, weight:6, slots:2, magic:false,
      description:'Cabeza de hierro forjada para romper armaduras. Lo que toca, abolla.' },

    { id:'cetro_igneo', name:'Cetro ígneo', type:'weapon', icon:'📜', damage:'2d6', value:272, rarity:'rare', tier:6, weight:2, magic:true, statusEffect:{type:'fire',chance:0.35,turns:3,value:2},
      description:'Una gema ígnea engarzada en cuarzo. Quema al que toca su luz.' },

    { id:'espada_runica', name:'Espada rúnica', type:'weapon', icon:'🗡️', tier:7, rarity:'rare', weight:3, magic:false, damage:'2d8+1', value:395,
      description:'Runas de filo grabadas a fuego. Corta cotas como si fueran tela.' },

    { id:'baston_runico', name:'Bastón rúnico', type:'weapon', icon:'🪄', tier:7, rarity:'rare', weight:2, magic:true, damage:'2d8', value:395,
      description:'Madera petrificada que guarda el eco de cada hechizo lanzado con ella.' },

    { id:'hacha_runica', name:'Hacha rúnica', type:'weapon', icon:'🪓', tier:8, rarity:'rare', weight:5, magic:false, damage:'3d6+2', value:573,
      description:'Dos hojas que zumban al girar. Pesa, pero lo que toca no se levanta.' },

    { id:'matamuertos', name:'Matamuertos', type:'weapon', icon:'⚔️', damage:'3d6', value:842, rarity:'epic', tier:8, weight:4, slots:2, magic:true,
      description:'Una espada que hiere a los muertos como a los vivos. Brilla cerca de las tumbas.' },

    { id:'arco_elfico', name:'Arco élfico', type:'weapon', icon:'🏹', tier:9, rarity:'epic', weight:2, magic:false, statusEffect:{type:'bleed',chance:0.25,turns:3,value:3}, damage:'3d6+2', value:1221,
      description:'Cuerda de crin de unicornio. Las flechas encuentran solas los huecos de la armadura.' },

    { id:'cetro_abisal', name:'Cetro abisal', type:'weapon', icon:'🔱', tier:9, rarity:'epic', weight:2, magic:true, statusEffect:{type:'cold',chance:0.3,turns:2,value:1}, damage:'3d6+1', value:1221,
      description:'Coral negro del fondo del mar. Hiela la sangre de quien lo enfrenta.' },

    { id:'colmillo_de_dragon', name:'Colmillo de dragón', type:'weapon', icon:'🦷', damage:'3d8+1', value:2833, rarity:'legendary', tier:10, weight:3, magic:true,
      description:'Tallado del diente de un dragón ancestral. La carne que toca arde.' },

    { id:'excalibur', name:'Excalibur', type:'weapon', icon:'🗡️', damage:'3d8', value:2833, rarity:'legendary', tier:10, weight:3, magic:true, statusEffect:{type:'shock',chance:0.3,turns:3,value:4},
      description:'Hoja de luz pura, forjada en el lago. Solo el digno puede empuñarla. Brilla más cuando hay justicia que defender.' },

    { id:'mjolnir', name:'Mjölnir', type:'weapon', icon:'🔨', damage:'3d8+2', value:2833, rarity:'legendary', tier:10, weight:8, slots:2, magic:true, statusEffect:{type:'shock',chance:0.5,turns:4,value:5},
      description:'Martillo del dios del trueno. Pesa lo que pesa la fe del que lo levanta. Suelta rayos al impactar.' },
  ];

  A.Seed = A.Seed || {};
  A.Seed.weapons = WEAPONS;
})(window.Aventurs);
