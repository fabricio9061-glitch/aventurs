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
  /**
   * Convierte un promedio numérico de daño en notación de dados realista.
   * Ej: 2 → '1d3' (avg=2), 4 → '1d6+1' (avg=4.5), 7 → '2d6' (avg=7), etc.
   * Estrategia: tabla con dados conocidos y elige el más cercano.
   */
  function damageToNotation(avgTarget) {
    if (avgTarget <= 0) return '1';
    // Dados conocidos con su promedio (n*sides+1)/2 + bonus
    // Usamos progresión natural de daño en RPG
    const presets = [
      { dice: '1d2',     avg: 1.5 },
      { dice: '1d3',     avg: 2.0 },
      { dice: '1d4',     avg: 2.5 },
      { dice: '1d4+1',   avg: 3.5 },
      { dice: '1d6',     avg: 3.5 },
      { dice: '1d6+1',   avg: 4.5 },
      { dice: '1d8',     avg: 4.5 },
      { dice: '1d8+1',   avg: 5.5 },
      { dice: '2d4',     avg: 5.0 },
      { dice: '1d10',    avg: 5.5 },
      { dice: '1d12',    avg: 6.5 },
      { dice: '2d6',     avg: 7.0 },
      { dice: '2d6+1',   avg: 8.0 },
      { dice: '2d8',     avg: 9.0 },
      { dice: '2d8+1',   avg: 10.0 },
      { dice: '3d6',     avg: 10.5 },
      { dice: '3d6+2',   avg: 12.5 },
      { dice: '3d8',     avg: 13.5 },
      { dice: '4d6',     avg: 14.0 },
      { dice: '4d8',     avg: 18.0 },
      { dice: '5d8',     avg: 22.5 },
      { dice: '6d8',     avg: 27.0 },
    ];
    let best = presets[0], bestDiff = Math.abs(avgTarget - best.avg);
    for (const p of presets) {
      const d = Math.abs(avgTarget - p.avg);
      if (d < bestDiff) { best = p; bestDiff = d; }
    }
    return best.dice;
  }

  /**
   * Calcula el promedio numérico de una notación de dados.
   * Ej: '1d6+1' → 4.5
   */
  function notationToAvg(notation) {
    if (notation == null) return 0;
    if (typeof notation === 'number') return notation;
    const m = String(notation).match(/^(\d+)d(\d+)([+-]\d+)?$/);
    if (m) {
      const n = +m[1], sides = +m[2], bonus = m[3] ? +m[3] : 0;
      return n * (sides + 1) / 2 + bonus;
    }
    return Number(notation) || 0;
  }

  function suggestEnemyStats({ tier = 1, category = 'normal', family = [] } = {}) {
    const t = Math.max(1, Math.min(10, tier));
    const baseHp = 8 * t;
    const baseDmg = 2 * t;
    const baseDiff = 6 + Math.floor(t / 2);
    const baseArmor = Math.floor(t / 3);
    const baseSpeed = 8 + Math.floor(t / 3);

    const mult = CATEGORY_MULT[category] || 1;
    const fm = familyMods(family);

    const dmgAvg = baseDmg * mult * fm.dmg;
    return {
      health: Math.round(baseHp * mult * fm.hp),
      damage: damageToNotation(dmgAvg), // notación de dados, no número plano
      damageAvg: dmgAvg,                // por si lo necesitan internamente
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
      // Para damage comparamos promedios de la notación
      let curN, idealN;
      if (f === 'damage') {
        curN = notationToAvg(cur);
        idealN = sug.damageAvg;
      } else {
        curN = Number(cur) || 0;
        idealN = Number(sug[f]) || 0;
      }
      if (idealN === 0) continue;
      const delta = Math.abs(curN - idealN) / idealN;
      if (delta > 0.5) {
        out.push({
          field: f,
          current: cur,
          suggested: sug[f],
          delta: Math.round(delta * 100) + '%',
        });
      }
    }
    return out;
  }

  /**
   * Reporte completo: todos los campos comparados vs sugerencia, marcando cuál
   * está dentro de tolerancia y cuál se desvía. Útil para "Generar autobalance".
   */
  function auditEnemyFull(enemy) {
    const sug = suggestEnemyStats(enemy);
    const out = [];
    const fields = [
      { key: 'health', label: 'Salud (HP)' },
      { key: 'damage', label: 'Daño' },
      { key: 'difficulty', label: 'Dificultad' },
      { key: 'armor', label: 'Armadura' },
      { key: 'speed', label: 'Velocidad' },
    ];
    for (const f of fields) {
      const cur = enemy[f.key];
      const isDamage = f.key === 'damage';
      let curNum, idealNum, suggestedDisplay;
      if (isDamage) {
        curNum = notationToAvg(cur);
        idealNum = sug.damageAvg || 0;
        suggestedDisplay = sug.damage; // notación dados
      } else {
        curNum = Number(cur) || 0;
        idealNum = Number(sug[f.key]) || 0;
        suggestedDisplay = sug[f.key];
      }
      const delta = idealNum === 0 ? 0 : Math.abs(curNum - idealNum) / idealNum;
      let status = 'ok';
      if (delta > 0.5) status = 'critical';
      else if (delta > 0.25) status = 'warning';
      out.push({
        field: f.key,
        label: f.label,
        current: cur,
        currentNum: curNum,
        suggested: suggestedDisplay,
        suggestedNum: idealNum,
        delta: Math.round(delta * 100),
        status,
        isDamageDice: isDamage && typeof cur === 'string',
      });
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
    auditEnemyFull,
    suggestItemValue,
    damageToNotation,
    notationToAvg,
    CATEGORY_MULT,
  };
})(window.Aventurs);
