/* ============================================================
   Aventurs — Seed: Hechizos
   ============================================================ */

(function (A) {
  'use strict';

  const SPELLS = [
    { id:'chispa', name:'Chispa', icon:'⚡', damage:'1d6', manaCost:3, tier:1, school:'arcane',
      description:'Una descarga eléctrica corta. Es lo primero que aprende todo aprendiz.' },

    { id:'llama', name:'Llama', icon:'🔥', damage:'1d8+1', manaCost:5, tier:2, school:'fire',
      description:'Lengua de fuego que sale de la palma. Quema rápido y deja olor a azufre.' },

    { id:'rayo_helado', name:'Rayo helado', icon:'❄️', damage:'1d8', manaCost:5, tier:2, school:'ice', effect:'slow',
      description:'Aire denso que congela en el aire. Reduce la velocidad del enemigo.' },

    { id:'curacion', name:'Curación', icon:'💚', heal:'2d6+2', manaCost:6, tier:2, school:'holy',
      description:'Las heridas se cierran al pronunciar la palabra correcta.' },

    { id:'bola_de_fuego', name:'Bola de fuego', icon:'🔥', damage:'3d6', manaCost:12, tier:5, school:'fire', area:true,
      description:'Una esfera incandescente que estalla al impacto. Daña a varios enemigos.' },

    { id:'tormenta_arcana', name:'Tormenta arcana', icon:'⚡', damage:'4d8', manaCost:20, tier:7, school:'arcane', area:true,
      description:'El cielo se quiebra y descarga rayos sobre el campo de batalla.' },

    { id:'aliento_de_dragon', name:'Aliento de dragón', icon:'🐉', damage:'5d8+5', manaCost:30, tier:9, school:'fire', area:true,
      description:'Hechizo prohibido. Desata el fuego que duerme en la sangre.' },
  ];

  A.Seed = A.Seed || {};
  A.Seed.spells = SPELLS;
})(window.Aventurs);
