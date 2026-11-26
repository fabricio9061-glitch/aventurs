/* ============================================================
   Aventurs — Pelea (7/8): el turno de las criaturas y el kit de habilidades
   La pelea está repartida en js/systems/combat*.js. Cada parte deja sus
   funciones en A._pelea y usa las de las otras por su nombre.
   ============================================================ */

(function (A) {
  'use strict';
  const C = (A._pelea = A._pelea || {});
  const { PET_TARGET_CHANCE, TAG_EFFECTS, TAG_EFFECT_CHANCE, WARRIOR_SAVE, ALLY_TARGET_CHANCE } = C;
  // De las otras partes
  function State(...a) { return C.State(...a); }
  function B(...a) { return C.B(...a); }
  function P(...a) { return C.P(...a); }
  function heroesOf(...a) { return C.heroesOf(...a); }
  function forEachHero(...a) { return C.forEachHero(...a); }
  function fxKey(...a) { return C.fxKey(...a); }
  function normalizeInstance(...a) { return C.normalizeInstance(...a); }
  function playerStats(...a) { return C.playerStats(...a); }
  function petStats(...a) { return C.petStats(...a); }
  function enemyStats(...a) { return C.enemyStats(...a); }
  function rollEnemyDamage(...a) { return C.rollEnemyDamage(...a); }
  function attackRoll(...a) { return C.attackRoll(...a); }
  function shieldPlayer(...a) { return C.shieldPlayer(...a); }
  function announceGuard(...a) { return C.announceGuard(...a); }
  function immunityOf(...a) { return C.immunityOf(...a); }
  function maybeAnnounceFury(...a) { return C.maybeAnnounceFury(...a); }
  function rollDamage(...a) { return C.rollDamage(...a); }
  function pickOne(...a) { return C.pickOne(...a); }
  function mitigate(...a) { return C.mitigate(...a); }
  function removeStatus(...a) { return C.removeStatus(...a); }
  function inflict(...a) { return C.inflict(...a); }
  function targetName(...a) { return C.targetName(...a); }
  function checkEnd(...a) { return C.checkEnd(...a); }
  function maybeDive(...a) { return C.maybeDive(...a); }
  function enemyDown(...a) { return C.enemyDown(...a); }
  function nextActor(...a) { return C.nextActor(...a); }
  function assignLabels(...a) { return C.assignLabels(...a); }
  function aliveEnemies(...a) { return C.aliveEnemies(...a); }
  function playerStrike(...a) { return C.playerStrike(...a); }
  function sturdyCut(...a) { return C.sturdyCut(...a); }
  function touchReactions(...a) { return C.touchReactions(...a); }
  function petKnockedOut(...a) { return C.petKnockedOut(...a); }
  function rollPetDamage(...a) { return C.rollPetDamage(...a); }
  function petStrike(...a) { return C.petStrike(...a); }
  function alliesOf(...a) { return C.alliesOf(...a); }
  function strikeAlly(...a) { return C.strikeAlly(...a); }
  function addLog(...a) { return C.addLog(...a); }

  // ============================================================
  // Enemigos
  // ============================================================

  /**
   * Un golpe de un enemigo. forcePlayer: no puede elegir a la mascota.
   * v2.5 (habilidades): forcePet, atkMod, mult, pierce (sin armadura), noTags,
   *   say(kind, info) frases propias, onHit(victim, info) lo que deja si pega.
   * Devuelve { hit, crit, dmg, toPet }.
   */
  function enemyStrike(c, enemy, opts = {}) {
    const p = State().player;
    // v3.11: si el héroe tiene un aliado invocado (el lobo), a veces la criatura lo ataca a él
    const ally = !opts.forcePlayer && !opts.forcePet ? alliesOf(c, p)[0] : null;
    if (ally && Math.random() < ALLY_TARGET_CHANCE) return strikeAlly(c, enemy, ally, opts);
    const pet = p.pet;
    const petUp = !!(pet && pet.health > 0);
    if (opts.forcePet && !petUp) return { hit: false, toPet: false };
    // v3.15: según cuán lista es (rematar, ir contra la que cura, seguir a la manada)
    const petChance = petUp && A.Tactics ? A.Tactics.petChance(c, enemy, p, pet) : PET_TARGET_CHANCE;
    const targetPet = opts.forcePet ? true : (!opts.forcePlayer && petUp && Math.random() < petChance);
    if (petUp && !opts.forcePet && !opts.forcePlayer && A.Tactics) A.Tactics.notePetTarget(c, enemy, targetPet);
    const es = enemyStats(enemy);
    const atk = es.attack + (opts.atkMod || 0);
    let defense, armor, targetName;
    if (targetPet) {
      const ps = petStats(pet);
      defense = ps.defense; armor = ps.armor; targetName = pet.name;
    } else {
      const st = playerStats();
      defense = st.defense; armor = st.armor; targetName = p.name;
    }
    if (opts.pierce) armor = 0;
    const r = attackRoll(atk, defense);
    // v3.11: lo que la desequilibró (Embestida arrolladora, Polvo de hada) le dura hasta este ataque
    if ((enemy.effects || []).some((e) => e.type === 'stagger')) removeStatus(enemy, 'stagger');
    // v2.2.1: Suerte: parte de los golpes que te iban a pegar, fallan
    let lucky = false;
    if (r.hit && !targetPet && P() && P().luckyDodge && Math.random() < P().luckyDodge(p)) {
      r.hit = false;
      r.crit = false;
      lucky = true;
    }
    // v3.9: las pasivas de la mascota también la defienden (Escurridizo, Ilusiones)
    let petDodge = null;
    if (r.hit && targetPet && A.Skills && A.Skills.petDodge) petDodge = A.Skills.petDodge(pet, r, enemy);
    if (petDodge) { r.hit = false; r.crit = false; }
    // v2.4: invisible (poción o pergamino): no te encuentra
    let unseen = false;
    const mods = A.ItemFx ? A.ItemFx.buffMods(p) : {};
    if (r.hit && !targetPet && mods.invisible) {
      r.hit = false;
      r.crit = false;
      unseen = true;
    }
    // v3.13: Paso afortunado (mediano): el primer golpe que te iba a dar pasa de largo
    let fortune = false;
    if (r.hit && !targetPet && !unseen && mods.dodgeNext > 0) {
      const fb = (p.effects || []).find((e) => e.type === 'buff' && e.mods && e.mods.dodgeNext > 0);
      if (fb) { fb.mods = { ...fb.mods, dodgeNext: 0 }; r.hit = false; r.crit = false; fortune = true; }
    }
    const enemyIcon = '';
    const damageNotation = enemy.damage;
    const E = A.Narrator && A.Narrator.enemyNoun ? A.Narrator.enemyNoun(enemy) : enemy.displayName;
    const capE = E.charAt(0).toUpperCase() + E.slice(1);
    const sayFn = typeof opts.say === 'function' ? opts.say : null;

    if (!r.hit) {
      const missEntry = {
        passive: lucky ? 'suerte' : null,
        skill: opts.skill || null,
        text: r.fumble ? `${enemy.displayName} ataca a ${targetName} pero falla por completo` : fortune ? `Paso afortunado: el golpe de ${enemy.displayName} pasa de largo` : lucky ? `¡Suerte! El golpe de ${enemy.displayName} pasa de largo` : unseen ? `${enemy.displayName} no te encuentra` : `${enemy.displayName} ataca pero ${targetName} esquiva`,
        actor: enemy.displayName, target: targetName, actorIcon: enemyIcon,
        roll: r.roll, bonus: atk, total: r.total, vs: defense, vsLabel: 'defensa',
        result: r.fumble ? 'fumble' : 'evaded',
        fx: { kind: 'attack', actor: fxKey(enemy), target: targetPet ? 'pet' : 'player' },
      };
      if (opts.label) missEntry.text += ` (${opts.label})`;
      if (petDodge) { missEntry.say = { text: petDodge.say, tone: 'good' }; missEntry.dodgeSkill = petDodge.skill; missEntry.result = 'evaded'; }
      else if (unseen && !r.fumble) missEntry.say = { text: `${capE} te busca, pero no te ve: el golpe pasa de largo.`, tone: 'good' };
      else if (fortune && !r.fumble) missEntry.say = { text: `Das un paso al costado justo a tiempo: el golpe de ${E} pasa de largo.`, tone: 'good' };
      else if (sayFn && !r.fumble && !lucky) { const s = sayFn('miss', { toPet: targetPet }); if (s) missEntry.say = s; }
      addLog(c, 'enemy', missEntry);
      // v2.4: Brazalete de contraataque: cuando te fallan, a veces devolvés el golpe
      const counter = !targetPet && A.Accessories ? A.Accessories.bonus(p, 'counter') : 0;
      if (counter > 0 && p.hp > 0 && enemy.hp > 0 && !c.result && Math.random() < counter) {
        addLog(c, 'system', { text: 'Contraataque.', fx: { kind: 'buff', target: 'player', label: 'Contraataque', icon: 'swords' }, say: { text: 'Lo esquivás y aprovechás el hueco para devolver el golpe.', tone: 'good' } });
        playerStrike(c, p, enemy, { counter: true });
      }
      return { hit: false, toPet: targetPet };
    }
    let rawDmg = rollEnemyDamage(enemy, { mult: opts.mult || 1 });
    if (r.crit) rawDmg *= 2;
    let finalDmg = mitigate(rawDmg, armor, r.crit);
    let passive = null;
    let guard = null;
    let absorbed = 0;
    let guardNotes = {};
    const victim = targetPet ? pet : p;
    let petSoft = null;
    if (targetPet) {
      if (A.Skills && finalDmg > 0) { const sf = A.Skills.softenHit(pet, finalDmg); if (sf.skill) petSoft = sf.skill; finalDmg = sf.dmg; }
      pet.health = Math.max(0, pet.health - finalDmg);
    } else {
      finalDmg = sturdyCut(p, finalDmg, r.crit); // v3.13: Fortaleza ancestral
      const ab = shieldPlayer(c, p, finalDmg);
      finalDmg = ab.dmg;
      passive = ab.passive;
      guard = ab.guard;
      absorbed = ab.absorbed;
      guardNotes = { roca: ab.roca || undefined, blessed: ab.blessed || undefined, blessBy: ab.blessBy || undefined };
      A.State.damagePlayer(finalDmg);
    }
    const hitEntry = {
      text: opts.free ? `${enemy.displayName} te golpea por la huida fallida`
        : r.crit ? `${enemy.displayName} golpea CRÍTICO a ${targetName}`
        : targetPet ? `${enemy.displayName} hiere a ${pet.name}` : `${enemy.displayName} te hiere`,
      skill: opts.skill || null,
      actor: enemy.displayName, target: targetName, actorIcon: enemyIcon, damageDice: damageNotation,
      roll: r.roll, bonus: atk, total: r.total, vs: defense, vsLabel: 'defensa',
      rawDmg, targetArmor: armor, dmg: finalDmg, passive, absorbed, ...guardNotes,
      hpAfter: targetPet ? pet.health : p.hp, hpMax: targetPet ? pet.maxHealth : p.maxHp,
      result: r.crit ? 'crit' : 'hit',
      fx: { kind: 'attack', actor: fxKey(enemy), target: targetPet ? 'pet' : 'player' },
    };
    if (opts.label) hitEntry.text += ` (${opts.label})`;
    if (guard === 'invincible') hitEntry.say = { text: `${capE} te pega con todo, pero el golpe rebota: no te hace nada.`, tone: 'good' };
    else if (finalDmg === 0 && !absorbed) hitEntry.say = { text: targetPet ? `${capE} alcanza a ${A.Skills ? A.Skills.noun(pet) : pet.name}, pero no le hace nada.` : pickOne([`${capE} te alcanza, pero tu armadura para el golpe.`, `El golpe de ${A.Skills ? A.Skills.noun(enemy) : enemy.displayName} rebota en tu armadura: no te hace nada.`]), tone: 'good' }; // v3.9
    else if (sayFn) {
      const s = sayFn('hit', { toPet: targetPet, crit: r.crit, dmg: finalDmg });
      if (s) {
        if (!targetPet && A.Narrator && A.Narrator.guardSuffix) s.text += A.Narrator.guardSuffix(hitEntry);
        else if (passive && A.Narrator && A.Narrator.passiveSuffix) s.text += A.Narrator.passiveSuffix(passive, hitEntry);
        hitEntry.say = s;
      }
    }
    if (petSoft) {
      hitEntry.softened = petSoft; // v3.9: el cartel de la pasiva sale sobre la mascota
      if (hitEntry.say && hitEntry.say.text && A.Narrator && A.Narrator.SOFT && A.Narrator.SOFT[petSoft]) hitEntry.say.text += A.Narrator.SOFT[petSoft];
    }
    addLog(c, 'enemy', hitEntry);
    announceGuard(c, guard);
    if (!targetPet) maybeAnnounceFury(c, p);
    // v3.9: si la mascota tiene espinas o el cuerpo en llamas, el que le pega lo sufre
    if (targetPet && finalDmg >= 0 && !opts.ranged && enemy.hp > 0 && !c.result && A.Skills && A.Skills.petReactions) A.Skills.petReactions(c, pet, enemy, kit);
    // v3.3: Corteza espinosa (dríade): el que te pega de cerca se clava tus espinas
    const bark = !targetPet && !opts.ranged && P() && P().thornsOf ? P().thornsOf(p) : 0;
    if (bark > 0 && enemy.hp > 0 && !c.result) {
      enemy.hp = Math.max(0, enemy.hp - bark);
      addLog(c, 'system', {
        text: `Corteza espinosa: ${enemy.displayName} recibe ${bark} de daño.`,
        passive: 'corteza_espinosa',
        fx: { kind: 'tick', target: fxKey(enemy), amount: bark, effect: 'bleed', passive: 'corteza_espinosa' },
        say: { text: `${capE} se clava tus espinas: ${bark} de daño.`, tone: 'good' },
      });
      if (enemy.hp <= 0) enemyDown(c, enemy, 'thorns');
    }
    // v3.13: Escamas ardientes y Campo electromagnético: el que te pega de cerca se quema o se electriza
    if (!targetPet && !opts.ranged && enemy.hp > 0 && !c.result) touchReactions(c, p, enemy, capE);
    // v2.4: Anillo de espinas y Pergamino de espinas/reflejar: el que te pega se lastima
    if (!targetPet && finalDmg > 0 && enemy.hp > 0) {
      const frac = (A.Accessories ? A.Accessories.bonus(p, 'thorns') : 0) + (mods.reflect || 0);
      if (frac > 0) {
        const back = Math.max(1, Math.round(finalDmg * frac));
        enemy.hp = Math.max(0, enemy.hp - back);
        addLog(c, 'system', {
          text: `Espinas: ${enemy.displayName} recibe ${back} de daño.`,
          fx: { kind: 'tick', target: fxKey(enemy), amount: back, effect: 'bleed' },
          say: { text: `${capE} se lastima con tus espinas: ${back} de daño.`, tone: 'good' },
        });
        if (enemy.hp <= 0) enemyDown(c, enemy, 'thorns');
      }
    }
    // v2.5: Sed de sangre: se cura con lo que te saca
    if (enemy.hp > 0 && finalDmg > 0 && A.Skills) {
      const ls = A.Skills.lifesteal(enemy);
      if (ls > 0) healEnemy(c, enemy, Math.max(1, Math.round(finalDmg * ls)), { say: '{E} se relame con tu sangre: recupera {n} de vida.', skill: 'sed_sangre' });
    }
    const victimUp = targetPet ? pet.health > 0 : p.hp > 0;
    // v2.5: lo que deja la habilidad (estado, robo, drenar)
    if (opts.onHit && victimUp && finalDmg > 0) opts.onHit(victim, { dmg: finalDmg, toPet: targetPet, crit: r.crit });
    // Efectos por tags del enemigo (veneno, fuego, hielo, ácido). v2.5: Venenoso, el doble de seguido
    if (!opts.noTags && finalDmg > 0 && (targetPet ? pet.health > 0 : p.hp > 0)) {
      const venom = A.Skills ? A.Skills.poisonBoost(enemy) : false;
      const tags = (enemy.tags || []).slice();
      if (venom && !tags.includes('poison')) tags.push('poison');
      for (const tag of tags) {
        const te = TAG_EFFECTS[tag];
        const chance = TAG_EFFECT_CHANCE * (venom && te && te.type === 'poison' ? 1.4 : 1);
        if (te && Math.random() < chance) {
          inflict(c, victim, te.type, { turns: te.turns, value: 1 + Math.floor(((enemy.tier || 1) - 1) / 3), source: enemy.id });
          break;
        }
      }
    }
    if (targetPet && pet.health <= 0) petKnockedOut(c, pet);
    return { hit: true, crit: r.crit, dmg: finalDmg, toPet: targetPet };
  }

  /** v2.5: una criatura recupera vida (Curarse, Drenar, Sed de sangre). */
  function healEnemy(c, enemy, n, opts = {}) {
    if (!enemy || enemy.hp <= 0 || n <= 0) return 0;
    const before = enemy.hp;
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + n);
    const got = enemy.hp - before;
    if (got <= 0) return 0;
    if (opts.cast) addLog(c, 'enemy', { text: `${enemy.displayName} se cura.`, fx: { kind: 'cast', actor: fxKey(enemy), element: 'holy', skill: opts.skill || undefined }, say: { text: '', tone: 'bad' } });
    addLog(c, 'enemy', {
      text: `${enemy.displayName} recupera ${got} de vida.`,
      fx: { kind: 'heal', actor: fxKey(enemy), target: fxKey(enemy), amount: got, skill: !opts.cast && opts.skill ? opts.skill : undefined },
      say: { text: A.Skills.fill(opts.say || '{E} recupera {n} de vida.', enemy, { n: got }), tone: 'bad' },
    });
    return got;
  }

  function executeEnemyAction(enemy) {
    const c = State().combat;
    if (!c || c.result) return;
    if (!enemy || enemy.hp <= 0) { nextActor(); return; }
    // v3.11: bajo el agua no ataca (lo hacen sus tentáculos)
    if (enemy.submerged) {
      if ((c.round % 3) === 1) addLog(c, 'enemy', { text: `${enemy.displayName} se mueve bajo el agua.`, fx: { kind: 'note', actor: fxKey(enemy) }, say: { text: `Una sombra enorme se mueve bajo el agua: ${A.Skills ? A.Skills.noun(enemy) : enemy.displayName} mueve sus tentáculos.`, tone: 'neutral' } });
      State().persist();
      nextActor();
      return;
    }
    // v3.15: antes de actuar, una débil sola puede huir; un escolta cubre a su jefe
    if (A.Tactics && A.Tactics.beforeTurn(c, enemy, kit) === 'fled') {
      State().persist();
      A.Bus.emit('combat:action', { actor: 'enemy' });
      if (checkEnd()) return;
      nextActor();
      return;
    }
    // v2.5: a veces usa una habilidad (si no, el ataque de siempre)
    const usedSkill = A.Skills ? A.Skills.enemyTurn(c, enemy) : false;
    if (!usedSkill) enemyStrike(c, enemy);
    maybeDive(c, enemy); // v3.12
    State().persist();
    A.Bus.emit('combat:action', { actor: 'enemy' });
    if (checkEnd()) return;
    nextActor();
  }

  // ============================================================
  // v2.5: herramientas para las habilidades (js/systems/skills.js)
  // ============================================================

  /** Tirada para resistir una habilidad: D20 + tu modificador contra la dificultad. Devuelve true si resistís. */
  function playerSave(c, enemy, stat, opts = {}) {
    const p = State().player;
    const dc = A.Skills ? A.Skills.saveDC(enemy, opts.dcMod) : 10;
    let roll = A.Utils.dice(20);
    if (roll === 1 && P() && P().rerollOnes(p)) {
      addLog(c, 'system', { text: 'Suerte: sacaste un 1 y el dado se vuelve a tirar.', fx: { kind: 'passive', passive: 'suerte' } });
      roll = A.Utils.dice(20);
    }
    // v2.5: los guerreros aguantan: +2 para resistir con agilidad o ingenio (en fuerza ya son buenos)
    const tough = stat !== 'fuerza' && B().classOf && B().classOf(p) === 'warrior' ? WARRIOR_SAVE : 0;
    const mod = (A.Explore && A.Explore.statMod ? A.Explore.statMod(stat, p) : 0) + tough;
    const total = roll + mod;
    const ok = roll === 20 || (roll !== 1 && total >= dc);
    const statName = (A.Skills && A.Skills.STAT_NAME[stat]) || stat;
    const text = ok ? opts.resist : opts.fail;
    addLog(c, 'system', {
      text: `Tirada de ${statName} para resistir ${opts.label || 'la habilidad'}: ${ok ? 'resistís' : 'no resistís'}.`,
      roll, bonus: mod, total, vs: dc, vsLabel: 'DC resistir', result: ok ? 'hit' : 'miss',
      fx: { kind: 'save', actor: 'player', target: 'player', stat: statName, from: fxKey(enemy) },
      say: { text: text ? A.Skills.fill(text, enemy) : '', tone: ok ? 'good' : 'bad' },
    });
    return ok;
  }

  /** Daño sin tirada de ataque (alientos, hechizos, temblores). Devuelve lo que te sacó. */
  function hurtPlayer(c, enemy, dmg, opts = {}) {
    const p = State().player;
    const ab = shieldPlayer(c, p, sturdyCut(p, Math.max(0, dmg), false)); // v3.13: Fortaleza ancestral
    A.State.damagePlayer(ab.dmg);
    let say = opts.say ? A.Skills.fill(opts.say, enemy, { d: ab.dmg }) : '';
    if (say && A.Narrator && A.Narrator.guardSuffix) say += A.Narrator.guardSuffix(ab);
    else if (say && ab.passive && A.Narrator && A.Narrator.passiveSuffix) say += A.Narrator.passiveSuffix(ab.passive, ab);
    addLog(c, 'enemy', {
      text: `${enemy.displayName} te hace ${ab.dmg} de daño.`,
      actor: enemy.displayName, target: p.name, dmg: ab.dmg, hpAfter: p.hp, hpMax: p.maxHp, passive: ab.passive, absorbed: ab.absorbed, roca: ab.roca || undefined, blessed: ab.blessed || undefined, blessBy: ab.blessBy || undefined, result: 'hit',
      fx: { kind: 'spell', actor: fxKey(enemy), target: 'player', element: opts.element || 'earth' },
      say: ab.guard === 'invincible' ? { text: 'Te alcanza de lleno, pero rebota: no te hace nada.', tone: 'good' } : { text: say, tone: 'bad' },
    });
    announceGuard(c, ab.guard);
    if (p.hp > 0) maybeAnnounceFury(c, p);
    return ab.dmg;
  }

  function hurtPet(c, enemy, dmg, opts = {}) {
    const pet = State().player.pet;
    if (!pet || pet.health <= 0) return 0;
    const got = Math.max(0, Math.min(pet.health, dmg));
    pet.health -= got;
    addLog(c, 'enemy', {
      text: `${enemy.displayName} le hace ${got} de daño a ${pet.name}.`,
      actor: enemy.displayName, target: pet.name, dmg: got, hpAfter: pet.health, hpMax: pet.maxHealth, result: 'hit',
      fx: { kind: 'spell', actor: fxKey(enemy), target: 'pet', element: opts.element || 'earth' },
      say: { text: A.Skills.fill(opts.say || '{P} recibe {d} de daño.', enemy, { d: got }), tone: 'bad' },
    });
    if (pet.health <= 0) petKnockedOut(c, pet);
    return got;
  }

  /** Daño directo de tu mascota (alientos o hechizos de su especie). */
  function hurtEnemy(c, t, dmg, opts = {}) {
    if (!t || t.hp <= 0) return 0;
    const got = Math.max(1, dmg);
    t.hp = Math.max(0, t.hp - got);
    addLog(c, opts.actor === 'pet' ? 'pet' : 'player', {
      text: `${t.displayName} recibe ${got} de daño.`,
      target: t.displayName, dmg: got, hpAfter: t.hp, hpMax: t.maxHp, result: 'hit',
      fx: { kind: 'spell', actor: opts.actor || 'pet', target: fxKey(t), element: opts.element || 'earth' },
      say: { text: opts.say || `${A.Skills.noun(t)} recibe ${got} de daño.`, tone: 'good' },
    });
    if (t.hp <= 0) enemyDown(c, t, 'pet');
    return got;
  }

  function healPet(c, n, opts = {}) {
    const pet = State().player.pet;
    if (!pet || pet.health <= 0 || n <= 0) return 0;
    const before = pet.health;
    pet.health = Math.min(pet.maxHealth, pet.health + n);
    const got = pet.health - before;
    if (got > 0) addLog(c, 'pet', { text: `${pet.name} recupera ${got} de vida.`, fx: { kind: 'heal', actor: 'pet', target: 'pet', amount: got }, say: { text: A.Skills.fill(opts.say || '{P} recupera {n} de vida.', null, { n: got }), tone: 'good' } });
    return got;
  }

  /** Invoca una criatura que se suma a la pelea (actúa al final de la ronda). */
  function summonEnemy(c, by, id, opts = {}) {
    const data = A.Data.getById('enemies', id);
    if (!data || !A.Encounter || !A.Encounter.spawnInstance) return null;
    const inst = A.Encounter.spawnInstance(data);
    if (inst.shiny) { inst.shiny = false; inst.name = data.name; } // las invocadas nunca son brillantes
    // v3.10: invocaciones especiales (kitsunes de cinco colas, crías de la manada)
    const WORD = ['', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
    if (opts.tails) { inst.tails = opts.tails; inst.name = `${inst.name} de ${WORD[opts.tails] || opts.tails} colas`; }
    if (opts.weak) { inst.maxHp = Math.max(1, Math.round(inst.maxHp * 0.6)); inst.hp = inst.maxHp; inst.name = `${inst.name} joven`; inst.dmgMult = Math.min(inst.dmgMult || 1, 0.8); } // v3.12: también pega menos
    if (opts.hp && opts.hp !== 1) { inst.maxHp = Math.max(1, Math.round(inst.maxHp * opts.hp)); inst.hp = inst.maxHp; }
    inst.displayName = inst.name;
    normalizeInstance(inst);
    inst.summoned = true;
    c.enemies.push(inst);
    assignLabels(c.enemies);
    c.initiative.push({ kind: 'enemy', id: inst.instanceId, name: inst.displayName, speed: inst.speed || 10, tieRoll: 0 });
    return inst;
  }

  const kit = {
    strike: (enemy, opts) => enemyStrike(State().combat, enemy, opts),
    petStrike: (pet, target, opts) => petStrike(State().combat, pet, target, opts),
    save: (enemy, stat, opts) => playerSave(State().combat, enemy, stat, opts),
    status: (victim, type, opts) => inflict(State().combat, victim, type, opts),
    immune: (victim, type) => (victim === State().player ? immunityOf(victim, type) : (A.Skills ? A.Skills.immune(victim, type) : null)),
    log: (type, payload) => addLog(State().combat, type, payload),
    hurtPlayer: (enemy, dmg, opts) => hurtPlayer(State().combat, enemy, dmg, opts),
    hurtPet: (enemy, dmg, opts) => hurtPet(State().combat, enemy, dmg, opts),
    hurtEnemy: (t, dmg, opts) => hurtEnemy(State().combat, t, dmg, opts),
    healEnemy: (enemy, n, opts) => healEnemy(State().combat, enemy, n, opts),
    healPet: (n, opts) => healPet(State().combat, n, opts),
    summon: (by, id, opts) => summonEnemy(State().combat, by, id, opts),
    rollDamage: (enemy, opts) => rollEnemyDamage(enemy, opts),
    rollPetDamage: (pet, mult) => rollPetDamage(pet, mult),
    playerStats: () => playerStats(),
    alive: () => aliveEnemies(),
    fxKey,
    // v3.0: alientos y temblores le llegan a todos los héroes del grupo
    forEachHero: (fn) => forEachHero(fn),
    // v3.2: el aullido de tu mascota anima a todo el grupo
    heroes: () => heroesOf(State().combat),
  };


  Object.assign(C, { enemyStrike, healEnemy, executeEnemyAction, playerSave, hurtPlayer, hurtPet, hurtEnemy, healPet, summonEnemy, kit });
})(window.Aventurs);
