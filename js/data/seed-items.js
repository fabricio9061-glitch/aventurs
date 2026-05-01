/* ============================================================
   Aventurs — Seed: Items
   Monedas, consumibles, materiales.

   subtype:
     coin       -> stack ilimitado, slot dedicado
     potion     -> consumible curativo
     food       -> consumible nutricional
     scroll     -> efecto especial
     material   -> ingrediente de crafting
     misc       -> otros (linterna, etc.)
   ============================================================ */

(function (A) {
  'use strict';

  const ITEMS = [
    // --- Monedas ---
    { id:'coin_copper', name:'Moneda de cobre', type:'item', subtype:'coin', icon:'🟤', value:1, weight:0,
      description:'La moneda más común. Cien valen una de plata.' },
    { id:'coin_silver', name:'Moneda de plata', type:'item', subtype:'coin', icon:'⚪', value:100, weight:0,
      description:'Cien de cobre, una de plata. Cien de plata, una de oro.' },
    { id:'coin_gold', name:'Moneda de oro', type:'item', subtype:'coin', icon:'🟡', value:10000, weight:0,
      description:'Pesada y brillante. La paga de un mes para un guardia, el precio de un buen caballo.' },

    // --- Pociones y curativos ---
    { id:'pocion_curacion_menor', name:'Poción de curación menor', type:'item', subtype:'potion', icon:'🧪', value:30, weight:1,
      effect:{ type:'heal', amount:'1d8+2' }, stack:99,
      description:'Líquido rojo y dulzón. Cierra heridas pequeñas.' },
    { id:'pocion_curacion', name:'Poción de curación', type:'item', subtype:'potion', icon:'🧪', value:120, weight:1,
      effect:{ type:'heal', amount:'2d8+4' }, stack:99,
      description:'Brilla suavemente al moverla. Funciona en heridas serias.' },
    { id:'pocion_mana_menor', name:'Poción de maná menor', type:'item', subtype:'potion', icon:'🧪', value:35, weight:1,
      effect:{ type:'mana', amount:'1d6+2' }, stack:99,
      description:'Azul como agua de glaciar. Restaura un poco de maná.' },
    { id:'pocion_mana', name:'Poción de maná', type:'item', subtype:'potion', icon:'🧪', value:140, weight:1,
      effect:{ type:'mana', amount:'2d6+4' }, stack:99,
      description:'Frío al tacto incluso en verano. Restaura maná considerable.' },
    { id:'antidoto', name:'Antídoto', type:'item', subtype:'potion', icon:'🧪', value:50, weight:1,
      effect:{ type:'cure', status:'poison' }, stack:99,
      description:'Verde y amargo. Limpia el veneno de la sangre.' },
    { id:'elixir_fuerza', name:'Elixir de fuerza', type:'item', subtype:'potion', icon:'🧪', value:200, weight:1,
      effect:{ type:'buff', stat:'damage', amount:2, duration:5 }, stack:99,
      description:'Sabe a hierro. Las manos tiemblan de poder durante un rato.' },

    // --- Comida ---
    { id:'pan', name:'Pan', type:'item', subtype:'food', icon:'🍞', value:3, weight:0,
      effect:{ type:'food', amount:3 }, stack:99,
      description:'Duro pero llena.' },
    { id:'queso', name:'Queso', type:'item', subtype:'food', icon:'🧀', value:8, weight:0,
      effect:{ type:'food', amount:5 }, stack:99,
      description:'Curado por meses. Resiste cualquier camino.' },
    { id:'carne_seca', name:'Carne seca', type:'item', subtype:'food', icon:'🥩', value:15, weight:0,
      effect:{ type:'food', amount:8 }, stack:99,
      description:'Salada y dura. Sostiene a un hombre días enteros.' },

    // --- Pergaminos / Misc ---
    { id:'pergamino_escape', name:'Pergamino de escape', type:'item', subtype:'scroll', icon:'📜', value:100, weight:0,
      effect:{ type:'escape' }, stack:10,
      description:'Al romperlo, el aire se cierra a tu alrededor y te lleva lejos del peligro.' },
    { id:'linterna', name:'Linterna', type:'item', subtype:'misc', icon:'🔦', value:25, weight:1,
      description:'Aceite y mecha. Espanta más que la oscuridad.' },
    { id:'cuerda', name:'Cuerda', type:'item', subtype:'misc', icon:'🪢', value:10, weight:1,
      description:'Diez metros de cáñamo trenzado. Más útil de lo que parece.' },

    // --- Items de doma (Fase 2) ---
    { id:'carne_cruda', name:'Carne cruda', type:'item', subtype:'tame', icon:'🥩', value:5, weight:0, stack:99,
      description:'Trozo sangrante. Las bestias la huelen a una legua.' },
    { id:'pescado_fresco', name:'Pescado fresco', type:'item', subtype:'tame', icon:'🐟', value:8, weight:0, stack:99,
      description:'Recién sacado del agua. Útil con bestias marinas.' },
    { id:'semillas', name:'Semillas', type:'item', subtype:'tame', icon:'🌾', value:3, weight:0, stack:99,
      description:'Granos secos. Atraen aves y criaturas pequeñas.' },

    // --- Pergaminos de hechizo (Fase 3) ---
    // Cada pergamino enseña un hechizo al usarlo. Drops de enemigos arcanos.
    { id:'pergamino_chispa', name:'Pergamino: Chispa', type:'item', subtype:'scroll_spell', icon:'📜', value:80, weight:0, stack:10,
      teachesSpell:'chispa',
      description:'Tinta de plata sobre vitela. Al leerlo en voz alta, el hechizo se graba en tu mente.' },
    { id:'pergamino_llama', name:'Pergamino: Llama', type:'item', subtype:'scroll_spell', icon:'📜', value:160, weight:0, stack:10,
      teachesSpell:'llama',
      description:'Bordes chamuscados. Las palabras parecen arder cuando las miras fijo.' },
    { id:'pergamino_rayo_helado', name:'Pergamino: Rayo helado', type:'item', subtype:'scroll_spell', icon:'📜', value:160, weight:0, stack:10,
      teachesSpell:'rayo_helado',
      description:'El rollo está frío al tacto, aunque haga calor.' },
    { id:'pergamino_curacion', name:'Pergamino: Curación', type:'item', subtype:'scroll_spell', icon:'📜', value:200, weight:0, stack:10,
      teachesSpell:'curacion',
      description:'Tinta dorada sobre pergamino blanco. Huele a hierbas frescas.' },
    { id:'pergamino_bola_fuego', name:'Pergamino: Bola de fuego', type:'item', subtype:'scroll_spell', icon:'📜', value:600, weight:0, stack:10,
      teachesSpell:'bola_de_fuego',
      description:'Sello quebrado de un mago muerto. Manos torpes no deberían tocarlo.' },
    { id:'pergamino_tormenta', name:'Pergamino: Tormenta arcana', type:'item', subtype:'scroll_spell', icon:'📜', value:1500, weight:0, stack:5,
      teachesSpell:'tormenta_arcana',
      description:'El cielo se nubla cuando lo destapas. Mejor no leer adentro.' },
    { id:'pergamino_aliento_dragon', name:'Pergamino: Aliento de dragón', type:'item', subtype:'scroll_spell', icon:'📜', value:5000, weight:0, stack:3,
      teachesSpell:'aliento_de_dragon',
      description:'Escrito en sangre dracónica. Solo magos con sangre antigua pueden leerlo sin morir.' },

    // --- Materiales de crafting ---
    { id:'mat_hierro', name:'Lingote de hierro', type:'item', subtype:'material', icon:'⛓️', value:20, weight:1, stack:99,
      description:'Metal común, base de toda forja honesta.' },
    { id:'mat_cuero', name:'Cuero curtido', type:'item', subtype:'material', icon:'🟫', value:15, weight:1, stack:99,
      description:'Tira de cuero curtido. Para armaduras y correas.' },
    { id:'mat_madera', name:'Madera dura', type:'item', subtype:'material', icon:'🪵', value:10, weight:1, stack:99,
      description:'Roble, fresno, ébano. Madera para mangos y bastones.' },
    { id:'mat_hueso', name:'Hueso', type:'item', subtype:'material', icon:'🦴', value:12, weight:1, stack:99,
      description:'Hueso limpio, útil en talismanes y empuñaduras.' },
    { id:'mat_colmillo', name:'Colmillo', type:'item', subtype:'material', icon:'🦷', value:30, weight:0, stack:99,
      description:'Diente de bestia. Algunos sirven como arma improvisada.' },
    { id:'mat_piel_lobo', name:'Piel de lobo', type:'item', subtype:'material', icon:'🐺', value:25, weight:1, stack:99,
      description:'Pelaje gris. Caliente, resistente, codiciado.' },
    { id:'mat_veneno', name:'Glándula de veneno', type:'item', subtype:'material', icon:'🟢', value:40, weight:0, stack:99,
      description:'Pulpa verde y viscosa. Untar una hoja con esto cambia las reglas.' },
    { id:'mat_escama_dragon', name:'Escama de dragón', type:'item', subtype:'material', icon:'🐉', value:300, weight:0, stack:99,
      description:'Pesada como el plomo, dura como el acero. Pieza rarísima.' },
    { id:'mat_sangre_dragon', name:'Sangre de dragón', type:'item', subtype:'material', icon:'🩸', value:500, weight:0, stack:99,
      description:'Hierve a temperatura ambiente. Ingrediente de todo lo prohibido.' },
    { id:'mat_esencia', name:'Esencia espectral', type:'item', subtype:'material', icon:'💨', value:120, weight:0, stack:99,
      description:'Bruma luminosa atrapada en frasco. Lo que queda cuando los muertos se rinden.' },
    { id:'mat_gema_arcana', name:'Gema arcana', type:'item', subtype:'material', icon:'💎', value:200, weight:0, stack:99,
      description:'Cristal con luz interior. Las usan los magos como pilas.' },
  ];

  A.Seed = A.Seed || {};
  A.Seed.items = ITEMS;
})(window.Aventurs);
