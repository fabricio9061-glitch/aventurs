/* ============================================================
   Aventurs — Mascotas y domesticación (v1.8.0)

   Qué se puede domar:
     - Enemigos con tameable:true (criaturas instintivas; v3.8: un jefe solo si está marcado, como la kitsune).
     - Su tier tiene que ser <= a tu nivel.
     - Solo una mascota a la vez (liberá la actual para domar otra).
     - Hace falta su comida (enemy.tameItem). Se gasta al intentar.

   Probabilidad (se muestra en pantalla antes de intentar):
     base por categoría: débil 60%, normal 45%, fuerte 25%
     +5% por cada nivel tuyo por encima del tier (máx +20%)
     +hasta 30% si está herida (en combate: cuanto menos vida, más fácil)
     Mínimo 5%, máximo 90%. Se tira un d100.

   La mascota:
     - Arranca con nivel = tier de la criatura (sin pasar tu nivel) y sus
       stats salen de js/core/balance.js (Pet), con el "perfil" de la
       especie (una tortuga tiene más vida, un lobo pega más).
     - Gana la mitad de la XP de cada combate (si terminó consciente).
       Nunca puede tener más nivel que vos.
     - Come según su dieta (la misma comida con la que se doma):
         carnívoros -> carnes · pescado -> pescado · herbívoros -> semillas, pan, bayas
     - Saciedad 0..10: baja 1 por combate y 1 cada 4 pasos de viaje.
       Con saciedad 0 pega la mitad. Alimentarla sube la saciedad y la cura un poco.
     - A 0 de vida queda inconsciente (no muere). Despierta con una poción
       de curación o descansando en la taberna (ahí además se llena).
   ============================================================ */

(function (A) {
  'use strict';

  const BASE_CHANCE = { weak: 0.60, normal: 0.45, strong: 0.25, boss: 0.10 }; // v3.8: solo los jefes marcados como domables (la kitsune)
  const DEFAULT_TAME_ITEM = 'carne_cruda';
  const INTELLIGENT = ['humanoid', 'demon', 'undead', 'arcane', 'dragon'];

  const DIETS = {
    carnivoro: {
      label: 'carnívoro', eats: 'carnes',
      foods: ['carne_cruda', 'carne_bestia', 'carne_ave', 'carne_reptil', 'carne_insecto', 'carne_gigante', 'carne_dragon', 'carne_seca'],
    },
    pescado: {
      label: 'come pescado', eats: 'pescado',
      foods: ['pescado_fresco', 'carne_pez', 'sal_conservante'],
    },
    herbivoro: {
      label: 'herbívoro', eats: 'semillas, pan y frutas',
      foods: ['semillas', 'baya_negra', 'pan', 'queso', 'cactus_carnoso', 'manzana', 'zanahoria', 'pan_elfico'], // v3.9: frutas y verduras
    },
  };
  const DIET_BY_TAME_ITEM = { carne_cruda: 'carnivoro', pescado_fresco: 'pescado', semillas: 'herbivoro', manzana: 'herbivoro' }; // v3.9

  function B() { return A.Balance; }
  function player() { return A.State.player; }

  // ---------- v3.9: el vínculo con tu mascota ----------
  // Cada mascota le da a su dueño un bonito chico mientras esté despierta y comida.
  // (El lobo ya tenía el suyo: el Aullido, que es una activa.)
  const BOND = {
    cuervo: { precision: 1, text: 'te avisa dónde pegar' },
    buho: { precision: 1, text: 've en la oscuridad por vos' },
    halcon: { precision: 1, text: 'marca a la presa desde el aire' },
    aguila: { precision: 1, text: 'marca a la presa desde el aire' },
    gato: { precision: 1, text: 'distrae a las criaturas' },
    serpiente: { precision: 1, text: 'les sisea y se distraen' },
    murcielago: { defense: 1, text: 'te avisa de los golpes' },
    zorro: { defense: 1, text: 'te avisa de los golpes' },
    sapo_gigante: { defense: 1, text: 'se mete en el medio' },
    polilla_onirica: { defense: 1, text: 'les tira polvo de sueño a los ojos' },
    tortuga: { armor: 1, text: 'te cubre con su caparazón' },
    cangrejo: { armor: 1, text: 'te cubre con sus pinzas' },
    oso: { armor: 1, text: 'pelea pegado a vos' },
    panda: { armor: 1, text: 'pelea pegado a vos' },
    perro_salvaje: { damage: 1, text: 'muerde a lo que vos golpeás' },
    jabali: { damage: 1, text: 'embiste a lo que vos golpeás' },
    escorpion: { damage: 1, text: 'pica a lo que vos golpeás' },
    leon: { damage: 1, text: 'ruge y pegás con más ganas' },
    tiburon: { damage: 1, text: 'huele la sangre por vos' },
    huargo: { damage: 1, text: 'muerde a lo que vos golpeás' },
    rata_gigante: { speed: 1, text: 'te abre camino' },
    rata: { coins: 0.15, text: 'encuentra monedas tiradas' },
    loro_pirata: { coins: 0.15, text: 'te avisa dónde hay monedas' },
    kitsune: { spell: 1, text: 'su fuego de zorro se suma a tus hechizos' },
    salamandra: { spell: 1, text: 'su calor se suma a tus hechizos' },
    slime: { regen: 1, text: 'te pega un poco de gelatina en las heridas' },
    ciervo_astral: { regen: 1, text: 'su luz te cierra las heridas' },
    unicornio: { regen: 2, text: 'su cuerno te cierra las heridas' },
    fenix: { regen: 2, text: 'su calor te cierra las heridas' },
    grifo: { precision: 1, damage: 1, text: 'ataca desde arriba lo que vos atacás' },
    manticora: { precision: 1, damage: 1, text: 'clava sus púas en lo que vos atacás' },
    quimera: { damage: 1, armor: 1, text: 'pelea a tu lado con sus tres cabezas' },
  };
  const BOND_WORDS = { precision: 'de precisión', defense: 'de defensa', armor: 'de armadura', damage: 'de daño', speed: 'de velocidad', spell: 'de poder mágico', regen: 'de vida por ronda si estás herido' };

  /**
   * Lo que tu mascota te da ahora: { precision, defense, armor, damage, speed, spell, regen, coins, text, off }.
   * off: por qué no te da nada (dormida, con hambre).
   */
  function ownerBond(p) {
    const out = { precision: 0, defense: 0, armor: 0, damage: 0, speed: 0, spell: 0, regen: 0, coins: 0, text: '', off: '' };
    const pet = p && p.pet;
    if (!pet) return out;
    const b = BOND[pet.species];
    if (!b) return out;
    if (pet.health <= 0) { out.off = `${pet.name} está inconsciente: no te da su ayuda.`; return out; }
    if (pet.food != null && pet.food <= 0) { out.off = `${pet.name} tiene hambre: no te ayuda hasta que coma.`; return out; }
    for (const k of Object.keys(BOND_WORDS)) out[k] = b[k] || 0;
    out.coins = b.coins || 0;
    if (out.spell && !(p.hasMagic)) out.spell = 0;
    const bits = Object.keys(BOND_WORDS).filter((k) => out[k]).map((k) => `+${out[k]} ${BOND_WORDS[k]}`);
    if (out.coins) bits.push(`+${Math.round(out.coins * 100)}% de monedas`);
    out.text = bits.length ? `${pet.name} ${b.text}: ${bits.join(', ')}.` : '';
    return out;
  }
  /** El texto del vínculo de una especie (para la ficha de la criatura). */
  function bondText(speciesId) {
    const b = BOND[speciesId];
    if (!b) return speciesId === 'lobo' ? 'Aúlla en la pelea: vos y tu grupo pegan con +1 de precisión y daño.' : '';
    const bits = Object.keys(BOND_WORDS).filter((k) => b[k]).map((k) => `+${b[k]} ${BOND_WORDS[k]}`);
    if (b.coins) bits.push(`+${Math.round(b.coins * 100)}% de monedas`);
    return `De mascota ${b.text}: ${bits.join(', ')}.`;
  }

  function requiredItem(enemy) {
    return (enemy && enemy.tameItem) || DEFAULT_TAME_ITEM;
  }

  function isInstinctive(enemy) {
    if (!enemy || !enemy.family) return false;
    return !enemy.family.some((f) => INTELLIGENT.includes(f));
  }

  function dietOf(entity) {
    const key = (entity && (entity.diet || DIET_BY_TAME_ITEM[requiredItem(entity)])) || 'carnivoro';
    return DIETS[key] ? key : 'carnivoro';
  }

  function dietInfo(entity) {
    const key = dietOf(entity);
    const d = DIETS[key];
    return { key, label: d.label, eats: d.eats, foods: d.foods.filter((id) => A.Data.getById('items', id)) };
  }

  function findInstance(instanceId) {
    if (!instanceId || !A.State.combat) return null;
    return (A.State.combat.enemies || []).find((e) => e.instanceId === instanceId) || null;
  }

  /** Probabilidad de domar (0..1). Si hay instancia en combate, cuenta lo herida que está. */
  function chanceFor(enemy, instance) {
    if (!enemy) return 0;
    let chance = BASE_CHANCE[enemy.category] != null ? BASE_CHANCE[enemy.category] : 0.45;
    const lvl = (player() && player().level) || 1;
    chance += Math.min(0.20, Math.max(0, (lvl - (enemy.tier || 1)) * 0.05));
    if (instance && instance.maxHp) chance += 0.30 * (1 - Math.max(0, instance.hp) / instance.maxHp);
    return Math.max(0.05, Math.min(0.90, chance));
  }

  function canTame(enemyId, instanceId) {
    const enemy = A.Data.getById('enemies', enemyId);
    if (!enemy) return { ok: false, reason: 'enemy-not-found' };
    if (!enemy.tameable) return { ok: false, reason: 'not-tameable' }; // v3.8: un jefe se puede domar solo si está marcado (la kitsune)
    if (!isInstinctive(enemy)) return { ok: false, reason: 'not-instinctive' };
    if ((enemy.tier || 1) > (player().level || 1)) return { ok: false, reason: 'level-too-low', requiredLevel: enemy.tier };
    if (player().pet) return { ok: false, reason: 'already-have-pet' };
    const inst = findInstance(instanceId);
    if (inst && inst.tameFailed) return { ok: false, reason: 'instance-failed' };
    const itemId = requiredItem(enemy);
    const haveIt = (player().inventory || []).some((s) => s.itemId === itemId && s.qty > 0);
    if (!haveIt) return { ok: false, reason: 'missing-item', requiredItemId: itemId };
    return { ok: true, requiredItemId: itemId, chance: chanceFor(enemy, inst) };
  }

  function reasonText(reason) {
    return ({
      'enemy-not-found': 'criatura desconocida',
      'not-tameable': 'no se puede domar',
      'not-instinctive': 'es demasiado inteligente para domarla',
      'level-too-low': 'es demasiado poderosa para tu nivel',
      'already-have-pet': 'ya tenés una mascota',
      'instance-failed': 'ya desconfía de vos',
      'missing-item': 'te falta su comida',
    })[reason] || reason;
  }

  // ---------- Crear mascota ----------

  function speciesProfile(enemy) {
    const exp = B().enemyStats(enemy.tier, enemy.category);
    const clamp = (v) => Math.max(0.8, Math.min(1.25, v || 1));
    return {
      hp: clamp(enemy.health / exp.health),
      dmg: clamp(B().avgOf(enemy.damage) / exp.damageAvg),
      armor: (enemy.armor || 0) > exp.armor ? 1 : 0,
    };
  }

  /** Recalcula los stats de la mascota para su nivel actual (conserva el % de vida). */
  function applyPetLevelStats(pet) {
    const L = Math.max(1, pet.level || 1);
    const prof = pet.profile || { hp: 1, dmg: 1, armor: 0 };
    const ratio = pet.maxHealth ? Math.max(0, pet.health) / pet.maxHealth : 1;
    pet.maxHealth = Math.round(B().Pet.hp(L) * prof.hp);
    pet.health = Math.round(pet.maxHealth * ratio);
    pet.damage = B().damageToNotation(B().Pet.dmg(L) * prof.dmg);
    pet.attack = B().Pet.attack(L);
    pet.armor = B().Pet.armor(L) + (prof.armor || 0);
    pet.dodge = Math.floor((pet.speed || 10) / 3) + Math.floor((L - 1) / 2);
    pet.xpNeeded = B().Pet.xpToNext(L);
    return pet;
  }

  function createPet(enemy, level) {
    if (!enemy) return null;
    const lvl = Math.max(1, Math.min(level || enemy.tier || 1, B().MAX_LEVEL));
    const pet = {
      id: 'pet_' + Date.now().toString(36),
      species: enemy.id,
      name: enemy.name,
      icon: enemy.icon,
      tier: enemy.tier,
      family: (enemy.family || []).slice(),
      tags: (enemy.tags || []).slice(),
      level: lvl,
      xp: 0,
      speed: enemy.speed || 10,
      profile: speciesProfile(enemy),
      tameItem: requiredItem(enemy),
      diet: dietOf(enemy),
      food: B().Pet.MAX_FOOD,
      maxFood: B().Pet.MAX_FOOD,
      effects: [],
      since: Date.now(),
      health: 1,
      maxHealth: 1,
    };
    applyPetLevelStats(pet);
    pet.health = pet.maxHealth;
    return pet;
  }

  /** Mascotas de partidas viejas: les completa los campos nuevos. */
  function upgradeLegacyPet(pet) {
    if (!pet || pet.profile) return pet;
    const enemy = A.Data.getById('enemies', pet.species);
    pet.level = Math.max(1, Math.min(pet.level || 1, (player() && player().level) || 1));
    pet.profile = enemy ? speciesProfile(enemy) : { hp: 1, dmg: 1, armor: 0 };
    pet.tameItem = pet.tameItem || requiredItem(enemy);
    pet.diet = pet.diet || dietOf(enemy || pet);
    if (pet.food == null) pet.food = B().Pet.MAX_FOOD;
    pet.maxFood = B().Pet.MAX_FOOD;
    pet.effects = [];
    pet.xp = Math.min(pet.xp || 0, B().Pet.xpToNext(pet.level) - 1);
    applyPetLevelStats(pet);
    return pet;
  }

  // ---------- Domar ----------

  function attempt(enemyId, instanceId) {
    const check = canTame(enemyId, instanceId);
    if (!check.ok) {
      A.Bus.emit('tame:failed', { enemyId, reason: check.reason });
      return { success: false, reason: check.reason, requiredItemId: check.requiredItemId };
    }
    const enemy = A.Data.getById('enemies', enemyId);
    const itemId = check.requiredItemId;
    const itemData = A.Data.getById('items', itemId);
    const itemName = itemData ? itemData.name : itemId;
    A.State.removeItem(itemId, 1);

    const chance = check.chance;
    // v3.9: se tira un D20 (como todo en el juego): hay que sacar el número que da la probabilidad
    const dc = Math.max(2, Math.min(20, 21 - Math.round(chance * 20)));
    const roll = 1 + Math.floor(Math.random() * 20);
    const success = roll >= dc;
    const need = dc;
    A.Bus.emit('tame:attempt', { enemyId, success, roll, chance, dc });

    if (!success) {
      const inst = findInstance(instanceId);
      if (inst) inst.tameFailed = true;
      A.State.addChronicle({
        type: 'note',
        text: `Le ofreciste ${itemName} a ${enemy.name}. Sacaste ${roll} en el D20 (necesitabas ${need} o más). Desconfía de vos.`,
      });
      A.State.persist();
      A.Bus.emit('tame:failed', { enemyId, roll });
      return { success: false, roll, dc, chance, itemConsumed: itemId };
    }

    const pet = createPet(enemy, Math.min(enemy.tier || 1, player().level || 1));
    const tamedInst = findInstance(instanceId);
    if (tamedInst && tamedInst.shiny) { pet.shiny = true; pet.name = `${pet.name} brillante`; } // v3.9
    player().pet = pet;
    A.State.persist();
    A.State.addChronicle({
      type: 'system',
      text: `Sacaste ${roll} en el D20 (necesitabas ${need} o más). ¡Domaste a ${enemy.name}! Nivel ${pet.level}, ${pet.maxHealth} de vida. Come: ${dietInfo(pet).eats}.`,
    });
    A.Bus.emit('tame:success', { petId: pet.id, name: pet.name });
    return { success: true, roll, dc, chance, itemConsumed: itemId, pet };
  }

  function release() {
    const p = player();
    if (!p || !p.pet) return false;
    const name = p.pet.name;
    p.pet = null;
    A.State.persist();
    A.State.addChronicle({ type: 'note', text: `Liberaste a ${name}.` });
    A.Bus.emit('tame:released', { name });
    return true;
  }

  // ---------- Progresión ----------

  /** Suma XP a la mascota. Devuelve mensajes de subida de nivel. */
  function addPetXp(pet, xp) {
    const msgs = [];
    if (!pet || xp <= 0) return msgs;
    upgradeLegacyPet(pet);
    pet.xp = (pet.xp || 0) + xp;
    const cap = (player() && player().level) || 1;
    while (pet.level < cap && pet.xp >= B().Pet.xpToNext(pet.level)) {
      pet.xp -= B().Pet.xpToNext(pet.level);
      pet.level += 1;
      const before = pet.maxHealth;
      applyPetLevelStats(pet);
      pet.health = pet.maxHealth;
      msgs.push(`¡${pet.name} subió al nivel ${pet.level}! +${pet.maxHealth - before} vida, daño ${pet.damage}.`);
      A.Bus.emit('pet:leveled', { name: pet.name, level: pet.level });
    }
    if (pet.level >= cap) pet.xp = Math.min(pet.xp, B().Pet.xpToNext(pet.level) - 1);
    return msgs;
  }

  // ---------- Comida y cuidados ----------

  /** Baja la saciedad (combate: 1). Avisa cuando llega a 0. */
  function consumePetFood(amount) {
    const pet = player() && player().pet;
    if (!pet || pet.health <= 0) return;
    upgradeLegacyPet(pet);
    const before = pet.food;
    pet.food = Math.max(0, pet.food - amount);
    if (before > 0 && pet.food === 0) {
      A.State.addChronicle({ type: 'note', text: `${pet.name} tiene hambre: pega la mitad, no usa sus habilidades, no te ayuda y se va debilitando hasta que coma (${dietInfo(pet).eats}).` });
      if (A.UI && A.Bus) A.Bus.emit('toast', { text: `${pet.name} tiene hambre: dale de comer (${dietInfo(pet).eats}).`, tone: 'bad' });
    } else if (before === 0 && pet.food === 0 && amount > 0 && pet.health > 1) {
      // v3.9: si sigue sin comer, pierde vida (nunca menos de 1)
      pet.health = Math.max(1, pet.health - Math.max(1, Math.round((pet.maxHealth || 10) * 0.1)));
    }
  }

  /** Para el viaje: 1 de saciedad cada 4 pasos (v3.1: igual que la comida tuya). */
  function onTravelStep(stepNumber) {
    const every = (A.Balance && A.Balance.Travel && A.Balance.Travel.STEPS_PER_FOOD) || 2;
    if (stepNumber % every === 0) consumePetFood(1);
  }

  function foodPoints(item) {
    if (!item) return 0;
    if (item.effect && item.effect.type === 'food') return item.effect.amount || 3;
    if (item.foodValue) return item.foodValue;
    if (item.subtype === 'tame') return 4;
    return 3;
  }

  /** Alimenta a la mascota con la primera comida de su dieta que tengas. */
  function feed() {
    const p = player();
    const pet = p && p.pet;
    if (!pet) return { ok: false, text: 'No tenés mascota.' };
    upgradeLegacyPet(pet);
    if (pet.health <= 0) return { ok: false, text: `${pet.name} está inconsciente. Despertala con una poción o descansando.` };
    const diet = dietInfo(pet);
    const slot = (p.inventory || []).find((s) => s.qty > 0 && diet.foods.includes(s.itemId));
    if (!slot) return { ok: false, text: `No tenés comida que le guste a ${pet.name} (come: ${diet.eats}).` };
    const item = A.Data.getById('items', slot.itemId);
    A.State.removeItem(slot.itemId, 1);
    const before = pet.food;
    pet.food = Math.min(pet.maxFood || B().Pet.MAX_FOOD, pet.food + foodPoints(item));
    const healed = Math.min(pet.maxHealth - pet.health, Math.ceil(pet.maxHealth * 0.25));
    pet.health += Math.max(0, healed);
    A.State.persist();
    const text = `${pet.name} comió ${item.name}. Saciedad ${before}→${pet.food}${healed > 0 ? `, +${healed} vida` : ''}.`;
    A.State.addChronicle({ type: 'note', text });
    return { ok: true, text };
  }

  /** Cura (y despierta) a la mascota con una poción de curación. */
  function healWithPotion() {
    const p = player();
    const pet = p && p.pet;
    if (!pet) return { ok: false, text: 'No tenés mascota.' };
    upgradeLegacyPet(pet);
    // v2.4: usa la poción de curación más barata (no gastes el Elixir de vida en un rasguño)
    const slot = (p.inventory || []).filter((s) => {
      const it = A.Data.getById('items', s.itemId);
      return it && s.qty > 0 && it.subtype === 'potion' && ((it.effect && it.effect.type === 'heal') || it.healAmount > 0);
    }).sort((a, b) => ((A.Data.getById('items', a.itemId).value || 0) - (A.Data.getById('items', b.itemId).value || 0)))[0];
    if (!slot) return { ok: false, text: `No tenés pociones de curación para ${pet.name}.` };
    if (pet.health >= pet.maxHealth) return { ok: false, text: `${pet.name} ya tiene la vida completa.` };
    const it = A.Data.getById('items', slot.itemId);
    const ef = it.effect || {};
    const amount = ef.pct ? Math.max(1, Math.round(pet.maxHealth * ef.pct)) : ef.amount ? A.Utils.rollDice(ef.amount) : (it.healAmount || 10);
    const wasKO = pet.health <= 0;
    const before = pet.health;
    pet.health = Math.min(pet.maxHealth, pet.health + amount);
    A.State.removeItem(slot.itemId, 1);
    A.State.persist();
    const text = wasKO
      ? `${pet.name} despertó con ${it.name} (+${pet.health - before} vida).`
      : `Curaste a ${pet.name} con ${it.name}. +${pet.health - before} vida.`;
    A.State.addChronicle({ type: 'note', text });
    return { ok: true, text };
  }

  /** Descanso completo (taberna): vida y saciedad al máximo, despierta si estaba inconsciente. */
  function restPet() {
    const pet = player() && player().pet;
    if (!pet) return;
    upgradeLegacyPet(pet);
    pet.health = pet.maxHealth;
    pet.food = pet.maxFood || B().Pet.MAX_FOOD;
    pet.effects = [];
  }

  A.Tame = {
    canTame,
    attempt,
    release,
    requiredItem,
    chanceFor,
    isInstinctive,
    reasonText,
    createPet,
    upgradeLegacyPet,
    addPetXp,
    consumePetFood,
    onTravelStep,
    feed,
    healWithPotion,
    restPet,
    dietInfo,
    DIETS,
    ownerBond, bondText, BOND, // v3.9
    DEFAULT_TAME_ITEM,
  };
})(window.Aventurs);
