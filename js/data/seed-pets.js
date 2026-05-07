/* ============================================================
   Aventurs — Seed: Mascotas
   Sistema de domesticación y combate de mascotas viene en Fase 5.
   Acá dejo el modelo definido y un par de ejemplos para que el
   editor ya pueda crear más, pero no se usan aún en partida.
   ============================================================ */

(function (A) {
  'use strict';

  const PETS = [
    {
      id:'pet_lobo',
      name:'Lobo',
      icon:'🐺',
      species:'lobo',
      tier:2,
      health:30, damage:5, speed:11, armor:0,
      tameDifficulty:24, // D24 según reglas viejas: animal común
      requiredFood:'mat_piel_lobo', // placeholder hasta sistema de comida real
      description:'Compañero leal. Caza por su cuenta, comparte la presa.',
    },
    {
      id:'pet_halcon',
      name:'Halcón',
      icon:'🦅',
      species:'halcon',
      tier:2,
      health:18, damage:6, speed:14, armor:0,
      tameDifficulty:30,
      requiredFood:'carne_seca',
      description:'Vuela alto, observa todo. No falla casi nunca.',
    },
  ];

  A.Seed = A.Seed || {};
  A.Seed.pets = PETS;
})(window.Aventurs);
