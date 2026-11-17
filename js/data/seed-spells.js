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
    { id:'bola_de_fuego', name:'Bola de fuego', icon:'🔥', damage:'2d6', manaCost:9, tier:5, school:'fire', area:true, mageOnly:true, statusEffect:{type:'fire',chance:0.25,turns:2,value:2},
      description:'Una esfera incandescente que estalla al impacto. Daña a varios enemigos. Solo para magos.' },
    { id:'tormenta_arcana', name:'Tormenta arcana', icon:'⚡', damage:'2d8+1', manaCost:12, tier:7, school:'arcane', area:true, mageOnly:true, statusEffect:{type:'shock',chance:0.25,turns:1,value:1},
      description:'El cielo se quiebra y descarga rayos sobre el campo de batalla. Solo para magos.' },
    { id:'aliento_de_dragon', name:'Aliento de dragón', icon:'🐉', damage:'3d6+2', manaCost:15, tier:9, school:'fire', area:true, mageOnly:true, statusEffect:{type:'fire',chance:0.5,turns:3,value:3},
      description:'Hechizo prohibido. Desata el fuego que duerme en la sangre. Solo para magos.' },
    // ---------- v2.1: el hechizo con el que nace cada raza (no se enseña ni se compra) ----------
    { id:'dardo_arcano', name:'Dardo arcano', icon:'', damage:'1d6', manaCost:3, tier:1, school:'arcane', racial:'humano',
      description:'Un proyectil de energía pura. Simple, directo y confiable, como los humanos.' },
    { id:'flecha_lunar', name:'Flecha lunar', icon:'', damage:'1d6', manaCost:3, tier:1, school:'light', racial:'elfo', statusEffect:{type:'blind',chance:0.35,turns:2,value:1},
      description:'Un destello plateado que encandila. Al que le da, le cuesta acertar sus golpes.' },
    { id:'dardo_venenoso', name:'Dardo venenoso', icon:'', damage:'1d4', manaCost:3, tier:1, school:'nature', racial:'mediano', statusEffect:{type:'poison',chance:0.7,turns:3,value:1},
      description:'Una espina encantada con veneno de pantano. Truco viejo de los medianos.' },
    { id:'aliento_de_brasas', name:'Aliento de brasas', icon:'', damage:'1d4', manaCost:4, tier:1, school:'fire', area:true, racial:'draconido', statusEffect:{type:'fire',chance:0.3,turns:2,value:1},
      description:'Una bocanada de chispas y humo que alcanza a todos los enemigos a la vez.' },
    { id:'descarga', name:'Descarga', icon:'', damage:'1d6', manaCost:3, tier:1, school:'arcane', racial:'gnomo', statusEffect:{type:'shock',chance:0.3,turns:2,value:1},
      description:'Un invento gnomo: electricidad embotellada. A veces deja tieso al que la recibe.' },
    { id:'rayo_de_plasma', name:'Rayo de plasma', icon:'', damage:'1d8', manaCost:4, tier:1, school:'arcane', racial:'alienigena',
      description:'Energía de otro mundo concentrada en un haz. Gasta más maná y pega más fuerte.' },
    { id:'ascua_infernal', name:'Ascua infernal', icon:'', damage:'1d6', manaCost:3, tier:1, school:'fire', racial:'infernal', statusEffect:{type:'fire',chance:0.35,turns:2,value:1},
      description:'Una brasa del abismo que se pega a la piel y sigue quemando.' },
    { id:'luz_sagrada', name:'Luz sagrada', icon:'', damage:'1d4', manaCost:3, tier:1, school:'holy', racial:'angel', selfHeal:1,
      description:'Un rayo de luz que hiere al enemigo y, de paso, te cierra las heridas.' },
  ];

  A.Seed = A.Seed || {};
  A.Seed.spells = SPELLS;
})(window.Aventurs);
