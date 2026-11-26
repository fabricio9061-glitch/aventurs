/* ============================================================
   Aventurs — Mochilas
   v3.15.1: todos los cambios de las versiones (los "parches" seed-v39 a
   seed-v315) ya están aplicados acá. La historia está en CHANGELOG.md.
   ============================================================ */

(function (A) {
  'use strict';
  A.Seed = A.Seed || {};
  A.Seed.bags = [
    { id: 'bag_basic', name: 'Mochila básica', slots: 10, value: 20, rarity: 'common', tier: 1, icon: '🎒', description: 'Cuero remendado y correas firmes. La que todos arrancamos teniendo.' },
    { id: 'bag_reforzada', name: 'Mochila reforzada', slots: 14, value: 90, rarity: 'common', tier: 3, icon: '🎒', description: 'Cuero curtido sobre lona. Más espacio, más peso encima.' },
    { id: 'bag_large', name: 'Mochila grande', slots: 16, value: 250, rarity: 'uncommon', tier: 5, icon: '🎒', description: 'Una buena bolsa. Cabe una semana entera de provisiones y más.' },
    { id: 'bag_advanced', name: 'Mochila avanzada', slots: 24, value: 700, rarity: 'rare', tier: 8, icon: '🎒', description: 'Cosida con cuero de bestia y broches de hierro. Aguanta lo que le pongas.' },
    { id: 'bag_arcane', name: 'Mochila arcana', slots: 32, value: 2000, rarity: 'epic', tier: 10, icon: '🎒', description: 'Por dentro es más grande que por fuera. Los magos saben cómo se hacen, pero no lo dicen.' },
  ];
})(window.Aventurs);
