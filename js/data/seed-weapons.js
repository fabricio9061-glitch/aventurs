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

    { id:'mandoble', name:'Mandoble', type:'weapon', icon:'🗡️', damage:'2d6', value:200, rarity:'rare', tier:5, weight:5, magic:false,
      description:'Espada a dos manos. Tremenda. Lenta. Devastadora.' },

    { id:'hacha_de_guerra', name:'Hacha de guerra', type:'weapon', icon:'🪓', damage:'2d6+1', value:240, rarity:'rare', tier:6, weight:5, magic:false,
      description:'Forjada para reyes y para enemigos de reyes.' },

    { id:'baston_arcano', name:'Bastón arcano', type:'weapon', icon:'🪄', damage:'2d6', value:280, rarity:'rare', tier:6, weight:2, statusEffect:{type:'fire',chance:0.20,turns:3,value:2}, magic:true,
      description:'Madera de fresno teñida en sangre de dragón. Dobla el poder de los hechizos.' },

    { id:'matamuertos', name:'Matamuertos', type:'weapon', icon:'⚔️', damage:'2d8', value:500, rarity:'epic', tier:8, weight:4, magic:true,
      description:'Una espada que hiere a los muertos como a los vivos. Brilla cerca de las tumbas.' },

    { id:'colmillo_de_dragon', name:'Colmillo de dragón', type:'weapon', icon:'🦷', damage:'3d6+2', value:1200, rarity:'legendary', tier:10, weight:3, magic:true,
      description:'Tallado del diente de un dragón ancestral. La carne que toca arde.' },
  ];

  A.Seed = A.Seed || {};
  A.Seed.weapons = WEAPONS;
})(window.Aventurs);
