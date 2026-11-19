/* ============================================================
   Aventurs — Seed: Hechizos (v1.8.0)
   La armadura del objetivo cuenta la mitad.
   Suman "poder mágico": +1 cada 2 niveles y extra con arma mágica.
   statusEffect: efecto que puede dejar en el objetivo (como las armas).

   v3.3:
     - Los de daño tiran el dado como un arma, con +2 (Balance.SPELL_HIT):
       pueden fallar y, con 20, son críticos (doble daño). Los de área
       tiran una vez y se compara con la defensa de cada criatura.
     sure      true: no tira el dado, siempre pega.
     cooldown  N: después de usarlo, se puede volver a usar N turnos después.
     mageOnly  solo los magos lo aprenden (Curación también, desde la v3.3).
     hybridOnly solo los híbridos lo aprenden (Segundo aliento).
     hybrid    v3.4: también lo aprenden los híbridos (Chispa, Llama, Rayo helado
               y 6 pergaminos de combate). Lo que no lo tiene, es solo de magos.
     selfOnly  una curación que solo te cura a vos (no se le tira a otro).
   ============================================================ */

(function (A) {
  'use strict';

  const SPELLS = [
    { id:'chispa', name:'Chispa', icon:'⚡', damage:'1d6', manaCost:3, tier:1, hybrid:true, school:'arcane',
      description:'Una descarga eléctrica corta. Es lo primero que aprende todo aprendiz.' },
    { id:'llama', name:'Llama', icon:'🔥', damage:'1d8', manaCost:4, tier:2, hybrid:true, school:'fire', statusEffect:{type:'fire',chance:0.3,turns:2,value:1},
      description:'Lengua de fuego que sale de la palma. Quema rápido y deja olor a azufre.' },
    { id:'rayo_helado', name:'Rayo helado', icon:'❄️', damage:'1d6+1', manaCost:4, tier:2, hybrid:true, school:'ice', statusEffect:{type:'cold',chance:0.6,turns:2,value:1},
      description:'Aire denso que congela en el aire. Reduce la velocidad del enemigo.' },
    // v3.3: solo para magos y con espera (con maná que vuelve solo era vida casi infinita): un turno sí y otro no
    { id:'curacion', name:'Curación', icon:'💚', heal:'2d6+2', manaCost:6, tier:2, school:'holy', mageOnly:true, cooldown:2,
      description:'Las heridas se cierran al pronunciar la palabra correcta. Solo para magos; se puede usar un turno sí y otro no.' },
    // v3.3: el de los híbridos: como Curación quedó para los magos, ellos se curan solo a sí mismos
    { id:'segundo_aliento', name:'Segundo aliento', iconName:'heart', heal:'2d6+2', manaCost:5, tier:2, school:'nature', hybridOnly:true, selfOnly:true, cooldown:2,
      description:'Juntás aire, apretás los dientes y la magia te cierra las heridas. Solo te cura a vos: curar a los demás es cosa de magos.' },
    { id:'bola_de_fuego', name:'Bola de fuego', icon:'🔥', damage:'2d6', manaCost:10, tier:5, school:'fire', area:true, mageOnly:true, cooldown:3, statusEffect:{type:'fire',chance:0.25,turns:2,value:2},
      // v3.1: 10 de maná (antes 9): contra varias criaturas el mago les sacaba 15 puntos a las otras clases
      description:'Una esfera incandescente que estalla al impacto. Daña a varios enemigos. Solo para magos.' },
    { id:'tormenta_arcana', name:'Tormenta arcana', icon:'⚡', damage:'2d8+1', manaCost:12, tier:7, school:'arcane', area:true, mageOnly:true, cooldown:4, statusEffect:{type:'shock',chance:0.25,turns:1,value:1},
      description:'El cielo se quiebra y descarga rayos sobre el campo de batalla. Solo para magos.' },
    { id:'aliento_de_dragon', name:'Aliento de dragón', icon:'🐉', damage:'3d6+2', manaCost:15, tier:9, school:'fire', area:true, mageOnly:true, cooldown:5, statusEffect:{type:'fire',chance:0.5,turns:3,value:3},
      description:'Hechizo prohibido. Desata el fuego que duerme en la sangre. Solo para magos.' },
    // ---------- v2.1: el hechizo con el que nace cada raza (no se enseña ni se compra) ----------
    { id:'dardo_arcano', name:'Dardo arcano', icon:'', damage:'1d6', manaCost:3, tier:1, school:'arcane', racial:'humano', sure:true,
      description:'Un proyectil de energía pura que busca solo a su blanco: nunca falla. Simple, directo y confiable, como los humanos.' },
    { id:'flecha_lunar', name:'Flecha lunar', icon:'', damage:'1d6', manaCost:3, tier:1, school:'light', racial:'elfo', statusEffect:{type:'blind',chance:0.35,turns:2,value:1},
      description:'Un destello plateado que encandila. Al que le da, le cuesta acertar sus golpes.' },
    { id:'dardo_venenoso', name:'Dardo venenoso', icon:'', damage:'1d4', manaCost:3, tier:1, school:'nature', racial:'mediano', statusEffect:{type:'poison',chance:0.7,turns:3,value:1},
      description:'Una espina encantada con veneno de pantano. Truco viejo de los medianos.' },
    { id:'aliento_de_brasas', name:'Aliento de brasas', icon:'', damage:'1d4', manaCost:4, tier:1, school:'fire', area:true, racial:'draconido', cooldown:2, statusEffect:{type:'fire',chance:0.3,turns:2,value:1},
      description:'Una bocanada de chispas y humo que alcanza a todos los enemigos a la vez.' },
    { id:'descarga', name:'Descarga', icon:'', damage:'1d6', manaCost:3, tier:1, school:'arcane', racial:'gnomo', statusEffect:{type:'shock',chance:0.3,turns:2,value:1},
      description:'Un invento gnomo: electricidad embotellada. A veces deja tieso al que la recibe.' },
    { id:'rayo_de_plasma', name:'Rayo de plasma', icon:'', damage:'1d8', manaCost:4, tier:1, school:'arcane', racial:'alienigena',
      description:'Energía de otro mundo concentrada en un haz. Gasta más maná y pega más fuerte.' },
    { id:'ascua_infernal', name:'Ascua infernal', icon:'', damage:'1d6', manaCost:3, tier:1, school:'fire', racial:'infernal', statusEffect:{type:'fire',chance:0.35,turns:2,value:1},
      description:'Una brasa del abismo que se pega a la piel y sigue quemando.' },
    { id:'luz_sagrada', name:'Luz sagrada', icon:'', damage:'1d4', manaCost:3, tier:1, school:'holy', racial:'angel', selfHeal:1,
      description:'Un rayo de luz que hiere al enemigo y, de paso, te cierra las heridas.' },
    // v3.0: razas nuevas
    { id:'toque_vampirico', name:'Toque vampírico', icon:'', damage:'1d4', manaCost:3, tier:1, school:'shadow', racial:'vampiro', selfHeal:2,
      description:'Una sombra fría que le roba la vida al enemigo y te la pasa a vos.' },
    { id:'chispas_de_hada', name:'Chispas de hada', icon:'', damage:'1d6', manaCost:3, tier:1, school:'light', racial:'hada', statusEffect:{type:'blind',chance:0.3,turns:2,value:1},
      description:'Un puñado de chispas de colores que queman un poco y encandilan mucho.' },
    // v3.3: razas nuevas
    { id:'manto_oscuridad', name:'Manto de oscuridad', iconName:'blind', damage:'1d4', manaCost:4, tier:1, school:'shadow', area:true, racial:'elfo_oscuro', cooldown:2, statusEffect:{type:'blind',chance:0.3,turns:2,value:1},
      description:'Una sombra cae sobre todos los enemigos: los lastima un poco y a algunos los deja ciegos.' },
    { id:'enredadera', name:'Enredadera', iconName:'herb', damage:'1d6', manaCost:3, tier:1, school:'nature', racial:'driade', stunChance:0.3,
      description:'Raíces que salen del suelo y aprietan: a veces dejan al enemigo sin moverse un turno.' },

    // ---------- v3.3: hechizos que se aprenden de los pergaminos ----------
    // fromScroll: el pergamino que lo enseña (al aprenderlo, el pergamino se gasta).
    // Hace falta tener el nivel del hechizo. Los de daño tiran el dado como los demás.
    // effect: lo que hace si no es de daño (como el pergamino, pero con maná y espera).
    // stun: turnos que deja sin moverse al que le pega · drain: la mitad del daño vuelve como vida.
    { id:'misil_arcano', name:'Misil arcano', iconName:'arcane', damage:'1d6+1', manaCost:4, tier:1, hybrid:true, school:'arcane', sure:true, fromScroll:'perg_misil_arcano',
      description:'Tres chispas que buscan solas a su blanco. No fallan nunca.' },
    { id:'escudo_arcano', name:'Escudo arcano', iconName:'shield', manaCost:4, tier:1, school:'arcane', cooldown:4, fromScroll:'perg_escudo',
      effect:{ type:'buff', stat:'armor', amount:2, duration:3 },
      description:'Una capa de luz te cubre: los golpes pegan menos por unos turnos.' },
    { id:'quemar', name:'Quemar', iconName:'fire', damage:'1d4', manaCost:4, tier:2, hybrid:true, school:'fire', fromScroll:'perg_quemar', statusEffect:{type:'fire',chance:0.6,turns:3,value:1},
      description:'Prendés fuego a la ropa (o al pelo) del enemigo. Sigue quemando unos turnos.' },
    { id:'estatica', name:'Estática', iconName:'spark', damage:'1d6', manaCost:4, tier:2, school:'arcane', fromScroll:'perg_estatica', statusEffect:{type:'shock',chance:0.4,turns:2,value:1},
      description:'Un chasquido eléctrico que deja los pelos de punta y los músculos tiesos.' },
    { id:'nube_venenosa', name:'Nube venenosa', iconName:'poison', damage:'1d4', manaCost:4, tier:2, school:'nature', fromScroll:'perg_veneno', statusEffect:{type:'poison',chance:0.8,turns:4,value:1},
      description:'Una nube verde que se mete por la nariz y envenena despacio.' },
    { id:'purificar', name:'Purificar', iconName:'heal', manaCost:4, tier:2, school:'holy', cooldown:3, fromScroll:'perg_purificar',
      effect:{ type:'cleanse', pct:0.1 },
      description:'Te saca el veneno, el fuego, el frío y todo lo malo, y te cura un poco.' },
    { id:'prisa', name:'Prisa', iconName:'boot', manaCost:5, tier:2, school:'arcane', cooldown:4, fromScroll:'perg_prisa',
      effect:{ type:'buff', stat:'defense', amount:2, duration:3, also:{ precision:2 } },
      description:'El tiempo se estira a tu alrededor: esquivás mejor y pegás más certero.' },
    { id:'congelar', name:'Congelar', iconName:'ice', damage:'1d6', manaCost:6, tier:3, school:'ice', cooldown:3, stun:1, fromScroll:'perg_congelar',
      description:'Encierra al enemigo en hielo: si le pega, pierde su próximo turno.' },
    { id:'maldicion', name:'Maldición', iconName:'skull', manaCost:5, tier:3, school:'shadow', cooldown:3, fromScroll:'perg_maldicion',
      effect:{ type:'curse', amount:2, duration:4 },
      description:'Una marca oscura: el enemigo pega peor y es más fácil pegarle.' },
    { id:'enredar', name:'Enredar', iconName:'herb', manaCost:6, tier:3, school:'nature', cooldown:4, fromScroll:'perg_enredar',
      effect:{ type:'stun', turns:1 },
      description:'Raíces que salen del suelo y atan al enemigo: pierde su próximo turno.' },
    { id:'espinas', name:'Espinas', iconName:'shield', manaCost:5, tier:3, school:'nature', cooldown:4, fromScroll:'perg_espinas',
      effect:{ type:'buff', stat:'reflect', amount:0.3, duration:4 },
      description:'Te crecen espinas: el que te pega recibe parte del golpe.' },
    { id:'fuerza_arcana', name:'Fuerza arcana', iconName:'fist', manaCost:5, tier:3, hybrid:true, school:'arcane', cooldown:4, fromScroll:'perg_fuerza',
      effect:{ type:'buff', stat:'damage', amount:3, duration:3 },
      description:'La magia te sube por los brazos: tus golpes pegan más por unos turnos.' },
    { id:'ojo_de_halcon', name:'Ojo de halcón', iconName:'eye', manaCost:4, tier:3, hybrid:true, school:'light', cooldown:4, fromScroll:'perg_precision',
      effect:{ type:'buff', stat:'precision', amount:4, duration:3 },
      description:'Ves cada movimiento antes de que pase: +4 de precisión por unos turnos.' },
    { id:'relampago', name:'Relámpago', iconName:'spark', damage:'2d6', manaCost:7, tier:4, school:'arcane', cooldown:2, fromScroll:'perg_relampago', statusEffect:{type:'shock',chance:0.4,turns:2,value:1},
      description:'Un rayo que baja del cielo sobre un enemigo.' },
    { id:'drenar_vida', name:'Drenar vida', iconName:'bleed', damage:'1d8', manaCost:6, tier:4, school:'shadow', cooldown:3, drain:true, fromScroll:'perg_drenar',
      description:'Le sacás la vida al enemigo y la mitad pasa a vos.' },
    { id:'terror', name:'Terror', iconName:'skulls', manaCost:6, tier:4, school:'shadow', cooldown:4, fromScroll:'perg_terror',
      effect:{ type:'stun', turns:1, status:{ type:'blind', turns:2, value:1 } },
      description:'Una visión espantosa: el enemigo se paraliza un turno y después le cuesta acertar.' },
    { id:'piel_de_piedra', name:'Piel de piedra', iconName:'shield', manaCost:6, tier:4, hybrid:true, school:'nature', cooldown:5, fromScroll:'perg_armadura',
      effect:{ type:'buff', stat:'armor', amount:3, duration:4 },
      description:'La piel se te pone dura como roca: +3 de armadura por unos turnos.' },
    { id:'ola_de_fuego', name:'Ola de fuego', iconName:'fire', damage:'2d4', manaCost:9, tier:5, school:'fire', area:true, mageOnly:true, cooldown:3, fromScroll:'perg_ola_fuego', statusEffect:{type:'fire',chance:0.25,turns:2,value:1},
      description:'Una ola de llamas que barre a todos los enemigos. Solo para magos.' },
    { id:'ventisca', name:'Ventisca', iconName:'ice', damage:'1d8', manaCost:9, tier:5, school:'ice', area:true, mageOnly:true, cooldown:3, fromScroll:'perg_ventisca', statusEffect:{type:'cold',chance:0.5,turns:2,value:1},
      description:'Viento y nieve sobre todos los enemigos: los deja lentos y ateridos. Solo para magos.' },
    { id:'curacion_mayor', name:'Curación mayor', iconName:'heal', heal:'4d6+4', manaCost:10, tier:5, school:'holy', mageOnly:true, cooldown:4, fromScroll:'perg_curacion_mayor',
      description:'Cierra heridas graves de un saque. Solo para magos.' },
    { id:'regenerar', name:'Regenerar', iconName:'heart', manaCost:8, tier:5, school:'nature', mageOnly:true, cooldown:5, fromScroll:'perg_regenerar',
      effect:{ type:'buff', stat:'regen', amount:3, duration:4 },
      description:'Tus heridas se cierran solas: recuperás vida al empezar cada turno. Solo para magos.' },
    { id:'furia_salvaje', name:'Furia salvaje', iconName:'fist', manaCost:7, tier:5, hybrid:true, school:'fire', cooldown:5, fromScroll:'perg_furia',
      effect:{ type:'buff', stat:'damage', amount:5, duration:3, also:{ defense:-2 } },
      description:'Pegás mucho más fuerte, pero te descuidás: un poco menos de defensa.' },
    { id:'trueno', name:'Trueno', iconName:'storm', damage:'2d6', manaCost:12, tier:6, school:'arcane', mageOnly:true, cooldown:4, stun:1, fromScroll:'perg_trueno',
      description:'Un estallido que aturde: si le pega, el enemigo pierde su próximo turno. Solo para magos.' },
    { id:'invisibilidad', name:'Invisibilidad', iconName:'eye', manaCost:10, tier:6, school:'shadow', mageOnly:true, cooldown:6, fromScroll:'perg_invisibilidad',
      effect:{ type:'buff', stat:'invisible', amount:1, duration:1 },
      description:'Desaparecés un momento: los ataques te fallan hasta tu próximo turno. Solo para magos.' },
  ];

  A.Seed = A.Seed || {};
  A.Seed.spells = SPELLS;
})(window.Aventurs);
