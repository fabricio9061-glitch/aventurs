/* ============================================================
   Aventurs — Seed: Bags (mochilas)
   Cada mochila define la capacidad de inventario del jugador.

   Modelo:
     id, name, slots, value, rarity, tier, icon, description
   ============================================================ */

(function (A) {
  'use strict';

  const BAGS = [
    {
      id: 'bag_starter',
      name: 'Bolsa de tela',
      slots: 5,
      value: 0,
      rarity: 'common',
      tier: 1,
      icon: '🎒',
      description: 'Una bolsa de paño con costuras flojas. Cabe poco pero te saca del apuro.',
    },
    {
      id: 'bag_basic',
      name: 'Mochila básica',
      slots: 10,
      value: 50,
      rarity: 'common',
      tier: 1,
      icon: '🎒',
      description: 'Cuero remendado y correas firmes. El paso siguiente al saco de tela.',
    },
    {
      id: 'bag_reforzada',
      name: 'Mochila reforzada',
      slots: 14,
      value: 200,
      rarity: 'common',
      tier: 3,
      icon: '🎒',
      description: 'Cuero curtido sobre lona. Más espacio, más peso encima.',
    },
    {
      id: 'bag_large',
      name: 'Mochila grande',
      slots: 16,
      value: 500,
      rarity: 'uncommon',
      tier: 5,
      icon: '🎒',
      description: 'Una buena bolsa. Cabe una semana entera de provisiones y más.',
    },
    {
      id: 'bag_advanced',
      name: 'Mochila avanzada',
      slots: 24,
      value: 1500,
      rarity: 'rare',
      tier: 8,
      icon: '🎒',
      description: 'Cosida con cuero de bestia y broches de hierro. Aguanta lo que le pongas.',
    },
    {
      id: 'bag_arcane',
      name: 'Mochila arcana',
      slots: 32,
      value: 5000,
      rarity: 'epic',
      tier: 10,
      icon: '🎒',
      description: 'Por dentro es más grande que por fuera. Los magos saben cómo se hacen, pero no lo dicen.',
    },
  ];

  A.Seed = A.Seed || {};
  A.Seed.bags = BAGS;
})(window.Aventurs);
