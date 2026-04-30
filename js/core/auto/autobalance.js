/* ============================================================
   Aventurs — AutoBalance
   Helper de sugerencia y validación de stats.

   NO sobrescribe stats existentes en partida. Solo sugiere.
   El editor lo usa para:
     - Sugerir stats al crear un enemigo nuevo
     - Validar si los stats actuales están "lejos" del esperado
     - Recalibrar masivamente (botón "Re-balancear todos")

   Fórmulas (simples, fáciles de tunear):
     base por tier: HP = 8 * tier, dmg = 2 * tier, diff = 6 + tier/2
     mod por category: weak x0.6, normal x1.0, strong x1.5, boss x2.5
     mod por family:
       giant/dragon/legendary -> +20% HP, +10% dmg
       construct/elemental    -> +30% armor
       arcane                 -> +20% dmg, +20% diff (precisión)
       beast/insect           -> +10% speed
       undead/spirit          -> -10% HP, +10% diff
   ============================================================ */

(function (A) {
  'use strict';

  const CATEGORY_MULT = {
    weak: 0.6,
    normal: 1.0,
    strong: 1.5,
    boss: 2.5,
  };

  function familyMods(families = []) {
    const m = { hp: 1, dmg: 1, armor: 0, speed: 0, diff: 0 };
    if (!Array.isArray(families)) return m;
    for (const f of families) {
      switch (f) {
        case 'giant': case 'dragon': case 'legendary':
          m.hp += 0.2; m.dmg += 0.1; break;
        case 'construct': case 'elemental':
          m.armor += 3; break;
        case 'arcane':
          m.dmg += 0.2; m.diff += 1; break;
        case 'beast': case 'insect':
          m.speed += 1; break;
        case 'undead': case 'spirit':
          m.hp -= 0.1; m.diff += 1; break;
        default: break;
      }
    }
    return m;
  }

  /**
   * Sugiere stats para un enemigo dado tier, category y family.
   * Devuelve { health, damage, difficulty, armor, speed }.
   */
  function suggestEnemyStats({ tier = 1, category = 'normal', family = [] } = {}) {
    const t = Math.max(1, Math.min(10, tier));
    const baseHp = 8 * t;
    const baseDmg = 2 * t;
    const baseDiff = 6 + Math.floor(t / 2);
    const baseArmor = Math.floor(t / 3);
    const baseSpeed = 8 + Math.floor(t / 3);

    const mult = CATEGORY_MULT[category] || 1;
    const fm = familyMods(family);

    return {
      health: Math.round(baseHp * mult * fm.hp),
      damage: Math.round(baseDmg * mult * fm.dmg),
      difficulty: Math.max(6, Math.min(20, baseDiff + fm.diff)),
      armor: baseArmor + fm.armor,
      speed: baseSpeed + fm.speed,
    };
  }

  /**
   * Compara stats actuales contra los sugeridos.
   * Devuelve un array de "warnings" si el delta excede 50%.
   */
  function auditEnemy(enemy) {
    const sug = suggestEnemyStats(enemy);
    const out = [];
    const fields = ['health', 'damage', 'difficulty', 'armor', 'speed'];
    for (const f of fields) {
      const cur = enemy[f] ?? 0;
      const ideal = sug[f] ?? 0;
      if (ideal === 0) continue;
      const delta = Math.abs(cur - ideal) / ideal;
      if (delta > 0.5) {
        out.push({
          field: f,
          current: cur,
          suggested: ideal,
          delta: Math.round(delta * 100) + '%',
        });
      }
    }
    return out;
  }

  /**
   * Sugiere stats de items según tier y rarity.
   */
  function suggestItemValue({ tier = 1, rarity = 'common' } = {}) {
    const t = Math.max(1, Math.min(10, tier));
    const rarMult = { common: 1, uncommon: 3, rare: 8, epic: 25, legendary: 80 }[rarity] || 1;
    return Math.round(20 * t * rarMult);
  }

  A.AutoBalance = {
    suggestEnemyStats,
    auditEnemy,
    suggestItemValue,
    CATEGORY_MULT,
  };
})(window.Aventurs);
