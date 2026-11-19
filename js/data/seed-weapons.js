/* ============================================================
   Aventurs — Seed: Armas (v1.8.0)
   Daño y precio salen de js/core/balance.js según tier y rareza:
     - dagas: un poco menos de daño, pero sangrado
     - armas de mago (magic: true): bastones, varitas, cetros, orbes y tomos.
       v3.4: solo las usan los magos (y los magos, solo esas); les suman poder
       a los hechizos. Las legendarias como Excalibur o Mjölnir son comunes.
     - armas pesadas (peso 5+): más daño, te hacen más lento
   ============================================================ */

(function (A) {
  'use strict';

  const WEAPONS = [
    // ---------- v3.3: las armas con las que nace cada raza ----------
    // Todas valen lo mismo que la vieja daga del principio (1d4, livianas): cambian
    // la forma y un detalle (sangran o son más certeras). v3.5: cada raza de mago, con
    // su arma de mago (solo para magos): 1d4, +2 de maná y +1 de poder mágico, como la varita.
    { id:'espada_recluta', name:'Espada de recluta', type:'weapon', icon:'', damage:'1d4', value:20, rarity:'common', tier:1, weight:1, magic:false, starter:'humano', statusEffect:{type:'bleed',chance:0.2,turns:3,value:1},
      description:'La espada que reparten en el cuartel del pueblo. Corta poco, pero corta. Arma de los humanos.' },
    { id:'arco_rama', name:'Arco de rama', type:'weapon', icon:'', damage:'1d4', value:20, rarity:'common', tier:1, weight:1, precision:1, magic:false, starter:'elfo',
      description:'Una rama de fresno curvada a mano: liviano y certero (+1 de precisión). Arma de los elfos.' },
    { id:'cuchillo_caza', name:'Cuchillo de caza', type:'weapon', icon:'', damage:'1d4', value:20, rarity:'common', tier:1, weight:1, magic:false, starter:'mediano', statusEffect:{type:'bleed',chance:0.2,turns:3,value:1},
      description:'Sirve para pelar papas y para pelear, en ese orden. Arma de los medianos.' },
    { id:'hacha_escamas', name:'Hacha de escamas', type:'weapon', icon:'', damage:'1d4', value:20, rarity:'common', tier:1, weight:1, magic:false, starter:'draconido', statusEffect:{type:'bleed',chance:0.2,turns:3,value:1},
      description:'Una hojita de escamas viejas atada a un mango. Arma de los dracónidos.' },
    { id:'punal_sangre', name:'Puñal de sangre', type:'weapon', icon:'', damage:'1d4', value:20, rarity:'common', tier:1, weight:1, magic:false, starter:'vampiro', statusEffect:{type:'bleed',chance:0.2,turns:3,value:1},
      description:'Hoja fina con un canal para que corra la sangre. Arma de los vampiros.' },
    { id:'martillo_minero', name:'Martillo de minero', type:'weapon', icon:'', damage:'1d4', value:20, rarity:'common', tier:1, weight:1, precision:1, magic:false, starter:'enano',
      description:'El de picar piedra en las minas: firme y certero (+1 de precisión). Arma de los enanos.' },
    { id:'garrote_hueso', name:'Garrote de hueso', type:'weapon', icon:'', damage:'1d4', value:20, rarity:'common', tier:1, weight:1, magic:false, starter:'orco', statusEffect:{type:'bleed',chance:0.2,turns:3,value:1},
      description:'Un fémur grande con astillas. Feo y efectivo. Arma de los orcos.' },
    { id:'maza_engranajes', name:'Maza de engranajes', type:'weapon', icon:'', damage:'1d4', value:20, rarity:'common', tier:1, weight:1, precision:1, magic:false, starter:'robot',
      description:'Un engranaje en la punta de una barra: calculada para no fallar (+1 de precisión). Arma de los robots.' },
    { id:'porra_piedra', name:'Porra de piedra', type:'weapon', icon:'', damage:'1d4', value:20, rarity:'common', tier:1, weight:1, precision:1, magic:false, starter:'goliat',
      description:'Una piedra de río con forma de puño. En la mano de un goliat, es certera (+1 de precisión). Arma de los goliats.' },
    { id:'colmillo_lobo', name:'Colmillo de lobo', type:'weapon', icon:'', damage:'1d4', value:20, rarity:'common', tier:1, weight:1, magic:false, starter:'licantropo', statusEffect:{type:'bleed',chance:0.2,turns:3,value:1},
      description:'Un colmillo enorme con un mango de cuero. Arma de los licántropos.' },
    { id:'punal_obsidiana', name:'Puñal de obsidiana', type:'weapon', icon:'', damage:'1d4', value:20, rarity:'common', tier:1, weight:1, magic:false, starter:'elfo_oscuro', statusEffect:{type:'poison',chance:0.2,turns:3,value:1},
      description:'Vidrio negro de las cuevas, afilado como una navaja y untado en veneno. Arma de los elfos oscuros.' },
    { id:'varita_engranajes', name:'Varita de engranajes', type:'weapon', icon:'', damage:'1d4', value:36, rarity:'common', tier:1, weight:0, magic:true, mana:2, starter:'gnomo',
      description:'Una varita de bronce con engranajes que giran solos cuando junta maná: potencia tus hechizos y da maná (+2). Arma de mago de los gnomos.' },
    { id:'cetro_plasma', name:'Cetro de plasma', type:'weapon', icon:'', damage:'1d4', value:36, rarity:'common', tier:1, weight:0, magic:true, mana:2, starter:'alienigena',
      description:'Un tubo de metal que no es de este mundo, con una bola de luz verde en la punta: potencia tus hechizos y da maná (+2). Arma de mago de los alienígenas.' },
    { id:'baston_ascuas', name:'Bastón de ascuas', type:'weapon', icon:'', damage:'1d4', value:36, rarity:'common', tier:1, weight:0, magic:true, mana:2, starter:'infernal',
      description:'Madera negra que nunca termina de apagarse: potencia tus hechizos y da maná (+2). Arma de mago de los infernales.' },
    { id:'baculo_luz', name:'Báculo de luz', type:'weapon', icon:'', damage:'1d4', value:36, rarity:'common', tier:1, weight:0, magic:true, mana:2, starter:'angel',
      description:'Un báculo blanco con una estrella pequeña en la punta: potencia tus hechizos y da maná (+2). Arma de mago de los ángeles.' },
    { id:'varita_hada', name:'Varita de hada', type:'weapon', icon:'', damage:'1d4', value:36, rarity:'common', tier:1, weight:0, magic:true, mana:2, starter:'hada',
      description:'Un tallo de flor que suelta polvo brillante al moverlo: potencia tus hechizos y da maná (+2). Arma de mago de las hadas.' },
    { id:'vara_sauce', name:'Vara de sauce', type:'weapon', icon:'', damage:'1d4', value:36, rarity:'common', tier:1, weight:0, magic:true, mana:2, starter:'driade',
      description:'Una rama viva que todavía echa hojas: potencia tus hechizos y da maná (+2). Arma de mago de las dríades.' },
    { id:'hacha_cuerno', name:'Hacha de cuerno', type:'weapon', icon:'', damage:'1d4', value:20, rarity:'common', tier:1, weight:1, magic:false, starter:'minotauro', statusEffect:{type:'bleed',chance:0.2,turns:3,value:1},
      description:'Un cuerno viejo afilado y montado en un palo. Arma de los minotauros.' },

    { id:'garrote', name:'Garrote', type:'weapon', icon:'🏏', damage:'1d6', value:10, rarity:'common', tier:1, weight:2, magic:false,
      description:'Madera nudosa con manija. Lo más simple que se llama arma: barato, pesado y pega más que una daga.' },

    { id:'daga', name:'Daga', type:'weapon', icon:'🗡️', damage:'1d4', value:25, rarity:'common', tier:1, weight:1, statusEffect:{type:'bleed',chance:0.2,turns:3,value:1}, magic:false,
      description:'Hoja corta y ligera. Buena para empezar.' },

    { id:'espada_corta', name:'Espada corta', type:'weapon', icon:'⚔️', damage:'1d6', value:25, rarity:'common', tier:1, weight:2, precision:1, magic:false,
      description:'Una hoja confiable y bien equilibrada: pega más que la daga y es más certera (+1 de precisión), pero pesa el doble.' },

    { id:'baston', name:'Bastón', type:'weapon', icon:'🪄', damage:'1d4', value:25, rarity:'common', tier:1, weight:1, magic:true,
      description:'Madera tallada con runas. Quien lo empuña siente el zumbido del maná.' },

    { id:'hacha_de_mano', name:'Hacha de mano', type:'weapon', icon:'🪓', damage:'1d6+1', value:36, rarity:'common', tier:2, weight:2, statusEffect:{type:'bleed',chance:0.15,turns:3,value:1}, magic:false,
      description:'Pesada pero efectiva. Astilla escudos con un golpe firme y deja heridas que sangran.' },

    { id:'arco_corto', name:'Arco corto', type:'weapon', icon:'🏹', damage:'1d6+1', value:36, rarity:'common', tier:2, weight:2, precision:1, magic:false,
      description:'Ligero, certero, silencioso: +1 de precisión. La distancia es su mejor escudo.' },

    { id:'varita', name:'Varita', type:'weapon', icon:'🪄', damage:'1d4', value:36, rarity:'common', tier:2, weight:0, magic:true, mana:2,
      description:'Madera tallada con runas. Potencia tus hechizos y da +2 de maná máximo, pero pega flojo si te quedás sin.' },

    { id:'lanza', name:'Lanza', type:'weapon', icon:'🔱', damage:'1d6+1', value:53, rarity:'common', tier:3, weight:3, precision:1, magic:false,
      description:'Asta larga con punta de hierro. Mantiene al enemigo a raya: +1 de precisión. Pega menos que la maza, pero erra menos.' },

    { id:'maza', name:'Maza', type:'weapon', icon:'🔨', damage:'1d8+1', value:68, rarity:'uncommon', tier:3, weight:3, magic:false,
      description:'Cabeza de hierro macizo. No corta, aplasta.' },

    { id:'daga_obsidiana', name:'Daga de obsidiana', type:'weapon', icon:'🗡️', damage:'1d6+1', value:68, rarity:'uncommon', tier:3, weight:1, statusEffect:{type:'bleed',chance:0.3,turns:3,value:1}, magic:false,
      description:'Filo de vidrio volcánico, más cortante que el acero pero frágil. Hace sangrar feo.' },

    { id:'espada_larga', name:'Espada larga', type:'weapon', icon:'⚔️', damage:'2d4+1', value:99, rarity:'uncommon', tier:4, weight:3, precision:1, magic:false,
      description:'Más peso, más alcance, más daño, y una hoja que va donde la mandás (+1 de precisión).' },

    { id:'cetro_arcano', name:'Cetro arcano', type:'weapon', icon:'🪄', damage:'1d8+1', value:99, rarity:'uncommon', tier:4, weight:1, magic:true,
      description:'Una piedra azul late en el extremo. Alimenta hechizos con cada golpe.' },

    { id:'ballesta', name:'Ballesta', type:'weapon', icon:'🏹', damage:'2d4+2', value:99, rarity:'uncommon', tier:4, weight:4, magic:false,
      description:'Arco mecánico que pega más fuerte que un arco común. Pesada y lenta de recargar.' },

    { id:'lanza_hueso', name:'Lanza de hueso antiguo', type:'weapon', icon:'🔱', damage:'2d4+1', value:99, rarity:'uncommon', tier:4, weight:2, magic:false,
      description:'Asta tallada de un hueso que no se rompe. Liviana y temida.' },

    { id:'mandoble', name:'Mandoble', type:'weapon', icon:'🗡️', damage:'2d8', value:188, rarity:'rare', tier:5, weight:5, slots:2, magic:false,
      description:'Espada a dos manos. Tremenda. Lenta. Devastadora.' },

    { id:'katana', name:'Katana', type:'weapon', icon:'⚔️', damage:'2d6', value:188, rarity:'rare', tier:5, weight:2, magic:false, statusEffect:{type:'bleed',chance:0.3,turns:3,value:2},
      description:'Hoja curva forjada en cien capas. Corta lo que mira, sangra lo que toca.' },

    { id:'alabarda', name:'Alabarda', type:'weapon', icon:'🪓', damage:'2d8', value:188, rarity:'rare', tier:5, weight:5, slots:2, precision:1, magic:false,
      description:'Hacha y lanza juntas en un asta larga. Para mantener distancia (+1 de precisión) y abrir cráneos.' },

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

    { id:'martillo_de_guerra', name:'Martillo de guerra', type:'weapon', icon:'🔨', damage:'2d8+1', value:272, rarity:'rare', tier:6, weight:6, slots:2, magic:false, statusEffect:{type:'shock',chance:0.2,turns:2,value:1},
      description:'Cabeza de hierro forjada para romper armaduras. Lo que toca, abolla, y a veces lo deja aturdido.' },

    { id:'cetro_igneo', name:'Cetro ígneo', type:'weapon', icon:'📜', damage:'2d6', value:272, rarity:'rare', tier:6, weight:2, magic:true, statusEffect:{type:'fire',chance:0.35,turns:3,value:2},
      description:'Una gema ígnea engarzada en cuarzo. Quema al que toca su luz.' },

    { id:'espada_runica', name:'Espada rúnica', type:'weapon', icon:'🗡️', tier:7, rarity:'rare', weight:3, magic:false, damage:'2d8+1', value:395, precision:1,
      description:'Runas de filo grabadas a fuego: +1 de precisión. Corta cotas como si fueran tela.' },

    { id:'baston_runico', name:'Bastón rúnico', type:'weapon', icon:'🪄', tier:7, rarity:'rare', weight:2, magic:true, damage:'2d8', value:395,
      description:'Madera petrificada que guarda el eco de cada hechizo lanzado con ella.' },

    { id:'hacha_runica', name:'Hacha rúnica', type:'weapon', icon:'🪓', tier:8, rarity:'rare', weight:5, magic:false, damage:'3d6+2', value:573,
      description:'Dos hojas que zumban al girar. Pesa, pero lo que toca no se levanta.' },

    { id:'matamuertos', name:'Matamuertos', type:'weapon', icon:'⚔️', damage:'3d6', value:842, rarity:'epic', tier:8, weight:4, slots:2, magic:false,
      description:'Una espada que hiere a los muertos como a los vivos. Brilla cerca de las tumbas.' },

    { id:'arco_elfico', name:'Arco élfico', type:'weapon', icon:'🏹', tier:9, rarity:'epic', weight:2, magic:false, statusEffect:{type:'bleed',chance:0.25,turns:3,value:3}, damage:'3d6+2', value:1221,
      description:'Cuerda de crin de unicornio. Las flechas encuentran solas los huecos de la armadura.' },

    { id:'cetro_abisal', name:'Cetro abisal', type:'weapon', icon:'🔱', tier:9, rarity:'epic', weight:2, magic:true, statusEffect:{type:'cold',chance:0.3,turns:2,value:1}, damage:'3d6+1', value:1221,
      description:'Coral negro del fondo del mar. Hiela la sangre de quien lo enfrenta.' },

    { id:'colmillo_de_dragon', name:'Colmillo de dragón', type:'weapon', icon:'🦷', damage:'3d8+1', value:2833, rarity:'legendary', tier:10, weight:3, magic:false,
      description:'Tallado del diente de un dragón ancestral. La carne que toca arde.' },

    { id:'excalibur', name:'Excalibur', type:'weapon', icon:'🗡️', damage:'3d8', value:2833, rarity:'legendary', tier:10, weight:3, magic:false, statusEffect:{type:'shock',chance:0.3,turns:3,value:4},
      description:'Hoja de luz pura, forjada en el lago. Solo el digno puede empuñarla. Brilla más cuando hay justicia que defender.' },

    { id:'mjolnir', name:'Mjölnir', type:'weapon', icon:'🔨', damage:'3d8+2', value:2833, rarity:'legendary', tier:10, weight:8, slots:2, magic:false, statusEffect:{type:'shock',chance:0.5,turns:4,value:5},
      description:'Martillo del dios del trueno. Pesa lo que pesa la fe del que lo levanta. Suelta rayos al impactar.' },
    // ---------- v2.1 ----------
    {"id": "sable_pirata", "name": "Espada curva pirata", "type": "weapon", "icon": "", "damage": "2d4+1", "value": 99, "rarity": "uncommon", "tier": 4, "weight": 2, "magic": false, "statusEffect": {"type": "bleed", "chance": 0.15, "turns": 3, "value": 1}, "description": "Hoja curva y corta, hecha para pelear en la cubierta de un barco."},
    {"id": "martillo_enano", "name": "Martillo enano", "type": "weapon", "icon": "", "damage": "1d8+1", "value": 68, "rarity": "uncommon", "tier": 3, "weight": 4, "magic": false, "description": "Forjado en Piedrahonda. Pesado y honesto: lo que golpea, no se levanta rápido."},
  ];

  A.Seed = A.Seed || {};
  A.Seed.weapons = WEAPONS;
})(window.Aventurs);
