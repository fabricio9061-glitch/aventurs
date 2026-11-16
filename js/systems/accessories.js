/* ============================================================
   Aventurs — Accesorios (v2.4)

   Un casillero nuevo de equipo: anillos, amuletos, botas, capas...
   Cada accesorio tiene "acc" con sus efectos:
     speed, armor, damage, precision, defense, mana   -> números que suman
     regen      -> vida al empezar cada turno tuyo en combate
     crit       -> críticos desde (20 - crit) en el dado
     thorns     -> parte del daño que te hacen vuelve al atacante
     lifesteal  -> parte del daño que hacés vuelve como vida
     xp, gold, drops -> más experiencia, monedas o botín (0,2 = +20%)
     first      -> actuás primero (salvo emboscada)
     immune     -> ['poison'] / ['fire'] / ['cold'] ...
     survivor   -> una vez por pelea, el golpe mortal te deja con 1
     double     -> chance de pegar dos veces
     counter    -> chance de devolver el golpe cuando te fallan
     heal       -> lo que te cura, te cura más (0,5 = +50%)
   Las armaduras pueden traer "resist" (inmunidades) y "mana"; los libros y orbes, "mana".
   ============================================================ */

(function (A) {
  'use strict';

  const EMPTY = Object.freeze({});

  function itemOf(p, slot) {
    const id = p && p.equipment ? p.equipment[slot] : null;
    if (!id) return null;
    if (slot === 'armor') return A.Data.getById('armors', id);
    return A.Data.getById('items', id);
  }

  /** Efectos del accesorio puesto (o {}). */
  function of(p) {
    const it = itemOf(p, 'accessory');
    return (it && it.acc) || EMPTY;
  }

  function bonus(p, key) {
    const v = of(p)[key];
    return typeof v === 'number' ? v : 0;
  }

  function has(p, key) { return !!of(p)[key]; }

  /** Inmunidad por accesorio o por armadura ('fire', 'cold', 'poison', 'shock'...). */
  function immune(p, type) {
    const acc = of(p);
    if (Array.isArray(acc.immune) && acc.immune.includes(type)) return true;
    const armor = itemOf(p, 'armor');
    return !!(armor && Array.isArray(armor.resist) && armor.resist.includes(type));
  }

  // ---------- Maná del equipo ----------
  // El maná máximo se guarda en el personaje: al poner o sacar una pieza se suma o se
  // resta lo que dio (guardado en p.gearMana, así no se desfasa si cambian los números).
  function gearManaOf(item) {
    if (!item) return 0;
    if (item.acc && typeof item.acc.mana === 'number') return item.acc.mana;
    if (typeof item.mana === 'number') return item.mana;
    return 0;
  }

  function applyGearMana(p, slot, item) {
    if (!p || !p.hasMagic) return;
    p.gearMana = p.gearMana || {};
    const before = p.gearMana[slot] || 0;
    const now = gearManaOf(item);
    if (before === now) return;
    p.maxMana = Math.max(0, (p.maxMana || 0) - before + now);
    p.mana = Math.min(p.maxMana, Math.max(0, (p.mana || 0) + Math.max(0, now - before)));
    p.gearMana[slot] = now;
  }

  // ---------- Textos ----------
  const pct = (x) => `${Math.round(x * 100)}%`;
  const STATUS = { poison: 'el veneno', fire: 'el fuego', cold: 'el frío', shock: 'los rayos', bleed: 'el sangrado' };

  /** Líneas cortas con lo que hace (para la ficha del objeto y el editor). */
  function describe(item) {
    const a = (item && item.acc) || {};
    const out = [];
    if (a.precision) out.push(`+${a.precision} de precisión`);
    if (a.damage) out.push(`+${a.damage} de daño`);
    if (a.armor) out.push(`+${a.armor} de armadura`);
    if (a.defense) out.push(`+${a.defense} de defensa (te cuesta más que te peguen)`);
    if (a.speed) out.push(`+${a.speed} de velocidad`);
    if (a.mana) out.push(`+${a.mana} de maná máximo (si usás magia)`);
    if (a.regen) out.push(`Recuperás ${a.regen} de vida al empezar cada turno en combate`);
    if (a.crit) out.push(`Tus golpes son críticos con ${20 - a.crit} o más en el dado`);
    if (a.thorns) out.push(`El que te pega recibe el ${pct(a.thorns)} del golpe (mínimo 1)`);
    if (a.lifesteal) out.push(`Recuperás el ${pct(a.lifesteal)} del daño que hacés (mínimo 1)`);
    if (a.xp) out.push(`+${pct(a.xp)} de experiencia`);
    if (a.gold) out.push(`+${pct(a.gold)} de monedas`);
    if (a.drops) out.push(`+${pct(a.drops)} de probabilidad de botín`);
    if (a.first) out.push('Actuás primero en cada pelea (salvo emboscada)');
    if (Array.isArray(a.immune) && a.immune.length) out.push(`${a.immune.map((t) => STATUS[t] || t).join(' y ').replace(/^./, (c) => c.toUpperCase())} no te afecta`);
    if (a.survivor) out.push('Una vez por pelea, el golpe que te iba a matar te deja con 1 de vida');
    if (a.double) out.push(`${pct(a.double)} de chance de pegar dos veces`);
    if (a.counter) out.push(`${pct(a.counter)} de chance de devolver el golpe cuando te fallan`);
    if (a.heal) out.push(`Lo que te cura, te cura un ${pct(a.heal)} más`);
    return out;
  }

  A.Accessories = { of, bonus, has, immune, applyGearMana, gearManaOf, describe };
})(window.Aventurs);
