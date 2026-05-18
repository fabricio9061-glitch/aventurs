/* ============================================================
   Aventurs — Seed: Armas
   Set inicial. El editor permite agregar más.

   Modelo:
     id, name, type ('weapon'), icon, damage (notación dado),
     value (en cobre), rarity, tier, weight, magic, description.

   Rarity: common | uncommon | rare | epic | legendary
   Tier: 1-10 (sugerido por nivel del jugador)
   ============================================================ */

(function (A) {
  'use strict';

  const WEAPONS = [
    { id:'daga', name:'Daga', type:'weapon', icon:'🗡️', damage:'1d4', value:25, rarity:'common', tier:1, weight:1, statusEffect:{type:'bleed',chance:0.20,turns:3,value:1}, magic:false,
      description:'Hoja corta y ligera. Buena para empezar.' },

    { id:'espada_corta', name:'Espada corta', type:'weapon', icon:'⚔️', damage:'1d6', value:50, rarity:'common', tier:1, weight:2, magic:false,
      description:'Una hoja confiable. La elección clásica del aventurero novato.' },

    { id:'hacha_de_mano', name:'Hacha de mano', type:'weapon', icon:'🪓', damage:'1d6+1', value:60, rarity:'common', tier:2, weight:2, magic:false,
      description:'Pesada pero efectiva. Astilla escudos con un golpe firme.' },

    { id:'baston', name:'Bastón', type:'weapon', icon:'🪄', damage:'1d4+1', value:40, rarity:'common', tier:1, weight:1, magic:true,
      description:'Madera tallada con runas. Quien lo empuña siente el zumbido del maná.' },

    { id:'arco_corto', name:'Arco corto', type:'weapon', icon:'🏹', damage:'1d6', value:55, rarity:'common', tier:2, weight:2, magic:false,
      description:'Ligero, certero, silencioso. La distancia es su mejor escudo.' },

    { id:'maza', name:'Maza', type:'weapon', icon:'🔨', damage:'1d8', value:80, rarity:'uncommon', tier:3, weight:3, magic:false,
      description:'Cabeza de hierro macizo. No corta, aplasta.' },

    { id:'espada_larga', name:'Espada larga', type:'weapon', icon:'⚔️', damage:'1d8+1', value:120, rarity:'uncommon', tier:4, weight:3, magic:false,
      description:'Más peso, más alcance, más daño. Para quien sabe blandir bien.' },

    { id:'cetro_arcano', name:'Cetro arcano', type:'weapon', icon:'🪄', damage:'1d6+2', value:150, rarity:'uncommon', tier:4, weight:1, magic:true,
      description:'Una piedra azul late en el extremo. Alimenta hechizos con cada golpe.' },

    { id:'mandoble', name:'Mandoble', type:'weapon', icon:'🗡️', damage:'2d6', value:200, rarity:'rare', tier:5, weight:5, slots:2,magic:false,
      description:'Espada a dos manos. Tremenda. Lenta. Devastadora.' },

    { id:'hacha_de_guerra', name:'Hacha de guerra', type:'weapon', icon:'🪓', damage:'2d6+1', value:240, rarity:'rare', tier:6, weight:5, slots:2,magic:false,
      description:'Forjada para reyes y para enemigos de reyes.' },

    { id:'baston_arcano', name:'Bastón arcano', type:'weapon', icon:'🪄', damage:'2d6', value:280, rarity:'rare', tier:6, weight:2, statusEffect:{type:'fire',chance:0.20,turns:3,value:2}, magic:true,
      description:'Madera de fresno teñida en sangre de dragón. Dobla el poder de los hechizos.' },

    { id:'matamuertos', name:'Matamuertos', type:'weapon', icon:'⚔️', damage:'2d8', value:500, rarity:'epic', tier:8, weight:4, slots:2,magic:true,
      description:'Una espada que hiere a los muertos como a los vivos. Brilla cerca de las tumbas.' },

    { id:'colmillo_de_dragon', name:'Colmillo de dragón', type:'weapon', icon:'🦷', damage:'3d6+2', value:1200, rarity:'legendary', tier:10, weight:3, magic:true,
      description:'Tallado del diente de un dragón ancestral. La carne que toca arde.' },

    /* ====== v1.5.7k — Armas adicionales ====== */
    { id:'garrote', name:'Garrote', type:'weapon', icon:'🏏', damage:'1d4', value:8, rarity:'common', tier:1, weight:2, magic:false,
      description:'Madera nudosa con manija. Lo más simple que se llama arma.' },

    { id:'lanza', name:'Lanza', type:'weapon', icon:'🔱', damage:'1d8', value:90, rarity:'common', tier:3, weight:3, magic:false,
      description:'Asta larga con punta de hierro. Mantiene al enemigo a raya.' },

    { id:'ballesta', name:'Ballesta', type:'weapon', icon:'🏹', damage:'1d10', value:180, rarity:'uncommon', tier:4, weight:4, magic:false,
      description:'Arco mecánico que pega más fuerte que un arco común. Lenta de recargar.' },

    { id:'katana', name:'Katana', type:'weapon', icon:'⚔️', damage:'2d6', value:280, rarity:'rare', tier:5, weight:2, magic:false, statusEffect:{type:'bleed',chance:0.30,turns:3,value:2},
      description:'Hoja curva forjada en cien capas. Corta lo que mira, sangra lo que toca.' },

    { id:'martillo_de_guerra', name:'Martillo de guerra', type:'weapon', icon:'🔨', damage:'2d8', value:340, rarity:'rare', tier:6, weight:6, slots:2, magic:false,
      description:'Cabeza de hierro forjada para romper armaduras. Lo que toca, abolla.' },

    { id:'alabarda', name:'Alabarda', type:'weapon', icon:'🪓', damage:'2d6+2', value:300, rarity:'rare', tier:5, weight:5, slots:2, magic:false,
      description:'Hacha y lanza juntas en un asta larga. Para mantener distancia y abrir cráneos.' },

    { id:'varita', name:'Varita', type:'weapon', icon:'🪄', damage:'1d4', value:60, rarity:'common', tier:2, weight:0, magic:true,
      description:'Madera tallada con runas. Canaliza maná pero pega flojo si te quedás sin.' },

    { id:'baston_de_fuego', name:'Bastón de fuego', type:'weapon', icon:'🔥', damage:'1d8+1', value:320, rarity:'rare', tier:5, weight:2, magic:true, statusEffect:{type:'fire',chance:0.40,turns:4,value:3},
      description:'La punta arde sin consumirse. Cada golpe deja brasas en la herida.' },

    { id:'baston_de_hielo', name:'Bastón de hielo', type:'weapon', icon:'❄️', damage:'1d8+1', value:320, rarity:'rare', tier:5, weight:2, magic:true, statusEffect:{type:'cold',chance:0.40,turns:4,value:3},
      description:'Cristal helado en el extremo. Quien lo toca queda lento por minutos.' },

    { id:'excalibur', name:'Excalibur', type:'weapon', icon:'🗡️', damage:'4d6', value:5000, rarity:'legendary', tier:10, weight:3, magic:true, statusEffect:{type:'shock',chance:0.30,turns:3,value:4},
      description:'Hoja de luz pura, forjada en el lago. Solo el digno puede empuñarla. Brilla más cuando hay justicia que defender.' },

    { id:'mjolnir', name:'Mjölnir', type:'weapon', icon:'🔨', damage:'4d8', value:6000, rarity:'legendary', tier:10, weight:8, slots:2, magic:true, statusEffect:{type:'shock',chance:0.50,turns:4,value:5},
      description:'Martillo del dios del trueno. Pesa lo que pesa la fe del que lo levanta. Suelta rayos al impactar.' },

    // === v1.7.2: Armas crafteables con materiales de bioma ===
    { id:'daga_obsidiana', name:'Daga de obsidiana', type:'weapon', icon:'🗡️', damage:'1d6', value:90, rarity:'uncommon', tier:3, weight:1, statusEffect:{type:'bleed',chance:0.30,turns:3,value:2}, magic:false,
      description:'Filo de vidrio volcánico, más cortante que el acero pero frágil. Hace sangrar feo.' },
    { id:'lanza_hueso', name:'Lanza de hueso antiguo', type:'weapon', icon:'🔱', damage:'1d8', value:120, rarity:'uncommon', tier:4, weight:2, magic:false,
      description:'Asta tallada de un hueso que no se rompe. Liviana y temida.' },
    { id:'cetro_igneo', name:'Cetro ígneo', type:'weapon', icon:'📜', damage:'2d6', value:380, rarity:'rare', tier:6, weight:2, magic:true, statusEffect:{type:'fire',chance:0.35,turns:3,value:3},
      description:'Una gema ígnea engarzada en cuarzo. Quema al que toca su luz.' },
    { id:'arco_pluma', name:'Arco de pluma extraña', type:'weapon', icon:'🏹', damage:'1d8', value:160, rarity:'rare', tier:5, weight:1, magic:false,
      description:'Empuñadura adornada con plumas que no son de este mundo. Dispara más lejos.' },
  ];

  A.Seed = A.Seed || {};
  A.Seed.weapons = WEAPONS;
})(window.Aventurs);
