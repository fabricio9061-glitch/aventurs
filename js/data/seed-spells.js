/* ============================================================
   Aventurs — Seed: Hechizos (v1.8.0)
   Los hechizos no se esquivan; la armadura del objetivo cuenta la mitad.
   Suman "poder mágico": +1 cada 2 niveles y extra con arma mágica.
   statusEffect: efecto que puede dejar en el objetivo (como las armas).
   ============================================================ */

(function (A) {
  'use strict';

  const SPELLS = [
    { id:'chispa', name:'Chispa', icon:'⚡', damage:'1d6', manaCost:3, tier:1, school:'arcane',
      description:'Una descarga eléctrica corta. Es lo primero que aprende todo aprendiz.' },
    { id:'llama', name:'Llama', icon:'🔥', damage:'1d8', manaCost:4, tier:2, school:'fire', statusEffect:{type:'fire',chance:0.3,turns:2,value:1},
      description:'Lengua de fuego que sale de la palma. Quema rápido y deja olor a azufre.' },
    { id:'rayo_helado', name:'Rayo helado', icon:'❄️', damage:'1d6+1', manaCost:4, tier:2, school:'ice', statusEffect:{type:'cold',chance:0.6,turns:2,value:1},
      description:'Aire denso que congela en el aire. Reduce la velocidad del enemigo.' },
    { id:'curacion', name:'Curación', icon:'💚', heal:'2d6+2', manaCost:5, tier:2, school:'holy',
      description:'Las heridas se cierran al pronunciar la palabra correcta.' },
    { id:'bola_de_fuego', name:'Bola de fuego', icon:'🔥', damage:'2d6', manaCost:9, tier:5, school:'fire', area:true, statusEffect:{type:'fire',chance:0.25,turns:2,value:2},
      description:'Una esfera incandescente que estalla al impacto. Daña a varios enemigos.' },
    { id:'tormenta_arcana', name:'Tormenta arcana', icon:'⚡', damage:'2d8+1', manaCost:12, tier:7, school:'arcane', area:true, statusEffect:{type:'shock',chance:0.25,turns:1,value:1},
      description:'El cielo se quiebra y descarga rayos sobre el campo de batalla.' },
    { id:'aliento_de_dragon', name:'Aliento de dragón', icon:'🐉', damage:'3d6+2', manaCost:15, tier:9, school:'fire', area:true, statusEffect:{type:'fire',chance:0.5,turns:3,value:3},
      description:'Hechizo prohibido. Desata el fuego que duerme en la sangre.' },
  ];

  A.Seed = A.Seed || {};
  A.Seed.spells = SPELLS;
})(window.Aventurs);
