/* ============================================================
   Aventurs — Combat system (v1.8.0 — reglas unificadas)

   Orden de turnos:
     - Al empezar se arma la iniciativa por VELOCIDAD (jugador, mascota
       y cada enemigo). Empates: D20 entre los empatados.
     - Cada ronda actúan todos en ese orden. Los caídos se saltean.
     - Si te emboscan (falló evitar el encuentro), los enemigos van primero.

   Al empezar el turno de cada combatiente:
     - Sangrado / veneno / fuego le hacen daño.
     - Choque eléctrico: 35% de quedar aturdido y perder el turno.
     - Se descuenta 1 turno a cada efecto.

   Ataque (jugador, mascota y enemigos usan la MISMA regla):
     D20 + ataque >= defensa del objetivo -> pega.
     1 natural = falla. 20 natural = crítico (daño x2, no se puede evitar).
     Daño = dados - armadura (mínimo 1 si pega).
     Frío: -2 defensa y -1 ataque. Ceguera: -4 ataque.

   Hechizos: no se esquivan, la armadura cuenta la mitad, suman poder mágico.

   Mascota:
     - Ataca al mismo enemigo que vos (si cae, al que tenga menos vida).
     - Los enemigos le pegan a ella 30% de las veces.
     - A 0 de vida queda inconsciente: no actúa ni gana XP ese combate.
       Despierta con una poción o descansando (ver js/systems/tame.js).
     - Con hambre (saciedad 0) pega la mitad.

   v2.4: accesorios (A.Accessories) y pociones/pergaminos (A.ItemFx):
     mejoras por turnos, espinas, robo de vida, doble golpe, contraataque,
     superviviente, iniciativa, y pergaminos de daño, aturdir y maldecir.

   v2.5: habilidades de las criaturas (A.Skills): pasivas (Manada, Caparazón,
     Etéreo, Regeneración, Renacer...) y activas que a veces usan en su turno
     (Mordida feroz, Telaraña, Aliento de fuego...). Algunas se resisten con
     una tirada (D20 + fuerza, agilidad o ingenio). Estados nuevos: derribado,
     miedo, atrapado (no podés huir) y ácido. Criaturas de élite (alfa,
     campeón, mayor) con mejor botín.

   v3.0: en grupo (js/net/party.js) pelean los dos héroes con sus mascotas. Cada
     acción de un héroe corre "en su contexto" (A.State.withHero): State.player
     es ese héroe y las frases salen en segunda persona para él (el otro las ve
     en tercera persona). Los enemigos eligen a quién atacar. Lo que es de cada
     uno en la pelea (objetivo, Golpe fuerte, pasivas usadas) se guarda aparte.
     Las criaturas traen más vida (Balance.PARTY) y la experiencia se reparte.

   API:
     start({ enemies | enemyId | regionId, fromTravel, ambush, surprise, opening, openingHid })
     setTarget(instanceId), getTarget(), aliveEnemies()
     playerAttack(), playerSpell(spellId), playerUseItem(itemId)
     playerTame(instanceId), playerFlee(), finish()
   ============================================================ */

(function (A) {
  'use strict';
  const C = (A._pelea = A._pelea || {});
  // De las otras partes
  function effectivePlayerSpeed(...a) { return C.effectivePlayerSpeed(...a); }
  function applyStatus(...a) { return C.applyStatus(...a); }
  function inflict(...a) { return C.inflict(...a); }
  function addTurnHeader(...a) { return C.addTurnHeader(...a); }
  function checkEnd(...a) { return C.checkEnd(...a); }
  function advanceIfNotPlayer(...a) { return C.advanceIfNotPlayer(...a); }
  function bossOpening(...a) { return C.bossOpening(...a); }
  function nextActor(...a) { return C.nextActor(...a); }
  function assignLabels(...a) { return C.assignLabels(...a); }
  function addLog(...a) { return C.addLog(...a); }


  function State() { return A.State; }
  function B() { return A.Balance; }
  function P() { return A.Passives; }

  // ============================================================
  // v3.0: héroes de la pelea (uno en solitario, dos en grupo)
  // ============================================================

  /** Lo que es de cada héroe dentro de la pelea (se intercambia al cambiar de contexto). */
  // v3.3: cada uno tiene sus dos intentos de huir
  // v3.3: también las esperas de los hechizos y los objetos usados en el turno
  const HERO_FIELDS = ['passives', 'itemUsed', 'itemSurvivor', 'powerCd', 'targetInstanceId', 'fleeAttempts', 'spellCd', 'itemsTurn', 'techCd', 'quickTurn']; // v3.13: techCd (técnicas de disciplina) y quickTurn (hechizo rápido del turno)

  // v3.3: en tu turno podés usar hasta 3 pociones, comidas o hierbas sin perderlo
  const FREE_ITEMS = 3;
  function freeItem(item) { return !!item && (item.subtype === 'potion' || item.subtype === 'food'); }

  function hidOf(h) { return A.State.hidOf(h); }
  function ctxHid() { return hidOf(State().player); }

  /** v3.3: los que ya no están en la pelea: se desconectaron o huyeron. */
  function outHids(c) { return (c.goneHids || []).concat(c.fledHids || []); }

  /** Los héroes que siguen en la pelea (los que se desconectaron o huyeron, no). */
  function heroesOf(c) {
    if (!c || !c.party) return State().player ? [State().player] : [];
    const out = outHids(c);
    return (c.heroIds || []).filter((hid) => !out.includes(hid)).map((hid) => A.State.heroById(hid)).filter(Boolean);
  }
  function heroOfEntry(c, cur) {
    if (!c || !c.party) return State().player;
    if (outHids(c).includes(cur.hid)) return null;
    return A.State.heroById(cur.hid);
  }
  /** A quién ataca una criatura: a uno de los héroes en pie (en solitario, a vos). */
  function pickTargetHero(c, enemy) {
    const up = heroesOf(c).filter((h) => h.hp > 0);
    if (!up.length) return State().player;
    // v3.15: las criaturas que piensan eligen (el más herido, el que cura, el de menos armadura)
    if (enemy && A.Tactics) return A.Tactics.pickHero(c, enemy, up) || up[0];
    return up[Math.floor(Math.random() * up.length)];
  }
  /** fn en el contexto de cada héroe en pie (alientos y temblores le llegan a todos). */
  function forEachHero(fn) {
    const c = State().combat;
    if (!c || !c.party) return fn(State().player);
    for (const h of heroesOf(c)) {
      if (h.hp <= 0 || c.result) continue;
      A.State.withHero(h, () => fn(h));
    }
    return undefined;
  }

  /**
   * v3.2: a quién le podés dar una poción o una curación ahora: vos, tu mascota
   * y, en grupo, cada compañero y su mascota (aunque estén caídos: así se levantan).
   * on: 'self' | 'pet' | 'hero:<id>' | 'pet:<id>'. key: la tarjeta de la pantalla.
   */
  function allyTargets() {
    const c = State().combat;
    const p = State().player;
    if (!p) return [];
    const out = [{ on: 'self', kind: 'hero', ref: p, owner: p, key: 'player', name: p.name, self: true }];
    if (p.pet) out.push({ on: 'pet', kind: 'pet', ref: p.pet, owner: p, key: 'pet', name: p.pet.name });
    if (c && c.party) {
      for (const h of heroesOf(c)) {
        if (h === p) continue;
        const hid = hidOf(h);
        out.push({ on: `hero:${hid}`, kind: 'hero', ref: h, owner: h, key: `hero:${hid}`, name: h.name });
        if (h.pet) out.push({ on: `pet:${hid}`, kind: 'pet', ref: h.pet, owner: h, key: `pet:${hid}`, name: h.pet.name, ownerName: h.name });
      }
    }
    return out;
  }
  function allyTarget(on) {
    const p = State().player;
    let k = !on || on === 'player' ? 'self' : String(on);
    if (p && k === `hero:${hidOf(p)}`) k = 'self';
    if (p && k === `pet:${hidOf(p)}`) k = 'pet';
    return allyTargets().find((t) => t.on === k) || null;
  }
  /** v3.2: sube la vida de un aliado (héroe o mascota). Devuelve { hp, revived }. */
  function healAlly(t, n) {
    const isPet = t.kind === 'pet';
    const max = (isPet ? t.ref.maxHealth : t.ref.maxHp) || 1;
    const cur = Math.max(0, isPet ? t.ref.health || 0 : t.ref.hp || 0);
    const now = Math.min(max, cur + Math.max(0, n));
    if (now === cur) return { hp: 0, revived: false };
    if (isPet) t.ref.health = now;
    else A.State.withHero(t.ref, () => A.State.setHp(now));
    return { hp: now - cur, revived: cur <= 0 };
  }
  /** v3.2: una mascota que se levanta en plena pelea vuelve a tener turno (si arrancó caída, se suma al final). */
  function petBackInFight(c, owner) {
    if (!c || !owner || !owner.pet) return;
    const hid = c.party ? hidOf(owner) : undefined;
    const has = c.initiative.some((a) => a.kind === 'pet' && (!c.party || a.hid === hid));
    if (!has) c.initiative.push({ kind: 'pet', id: c.party ? `pet:${hid}` : 'pet', hid, name: owner.pet.name, speed: owner.pet.speed || 10, tieRoll: 0 });
  }
  function joinY(list) {
    if (list.length <= 1) return list.join('');
    return `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`;
  }

  /** Lo llama A.State.withHero: guarda lo de un héroe y pone lo del otro. */
  function swapHero(from, to) {
    const c = State().combat;
    if (!c || !c.party || !from || !to || from === to) return;
    const fh = hidOf(from);
    const th = hidOf(to);
    if (fh === th) return;
    if (!c.heroCtx) c.heroCtx = {};
    const save = c.heroCtx[fh] || (c.heroCtx[fh] = {});
    for (const k of HERO_FIELDS) save[k] = c[k];
    const load = c.heroCtx[th] || {};
    for (const k of HERO_FIELDS) {
      if (load[k] === undefined) delete c[k];
      else c[k] = load[k];
    }
  }

  /** v3.0: un héroe se desconectó en plena pelea: deja de actuar y de recibir golpes. */
  function dropHero(hid) {
    const c = State().combat;
    if (!c || !c.party || c.result || outHids(c).includes(hid)) return;
    const h = A.State.heroById(hid);
    c.goneHids = (c.goneHids || []).concat([hid]);
    const name = h ? h.name : 'Tu compañero';
    addLog(c, 'system', { text: `${name} se desconectó.`, fx: { kind: 'note' }, say: { text: `${name} se fue de la pelea.`, tone: 'neutral' } });
    const cur = c.initiative[c.currentActorIdx];
    if (cur && cur.hid === hid) { nextActor(); return; }
    checkEnd();
  }

  /**
   * v3.0: contra un grupo, las criaturas son más: se suma una parte del grupo
   * (copias de las comunes, nunca de jefes ni élites), y todas traen un poco
   * más de vida y de daño (Balance.PARTY). Un jefe solo, en cambio, aguanta
   * y pega bastante más. Medido con el simulador: dos héroes juntos pierden
   * más o menos la misma vida que uno solo.
   */
  function scaleForParty(instances, n) {
    // v3.2: según cuántos héroes son (2 a 4)
    const cfg = B().partyScale ? B().partyScale(n) : (B().PARTY || {});
    if (n <= 1) return;
    // v3.3: si ya vienen preparadas para el grupo (la escena las mostró antes), no se tocan
    if (instances.some((e) => e._partyScaled)) return;
    const commons = instances.filter((e) => !e.elite && e.category !== 'boss' && !e.summoned);
    const max = cfg.maxEnemies || 5;
    if (commons.length && cfg.extra > 0) {
      const add = Math.max(1, Math.round(instances.length * cfg.extra));
      for (let i = 0; i < add && instances.length < max; i++) {
        const base = commons[Math.floor(Math.random() * commons.length)];
        const data = A.Data.getById('enemies', base.id);
        if (!data || !A.Encounter || !A.Encounter.spawnInstance) break;
        const inst = A.Encounter.spawnInstance(data);
        inst._copy = true; // v3.3: las que se suman por ser más no dan premio extra
        // si el original ya venía herido (ataque por sorpresa), la copia también
        if (base.maxHp && base.hp < base.maxHp) inst.hp = Math.max(1, Math.round(inst.maxHp * (base.hp / base.maxHp)));
        if (Array.isArray(base.effects)) inst.effects = base.effects.map((ef) => ({ ...ef }));
        normalizeInstance(inst);
        instances.push(inst);
      }
    }
    const lone = !commons.length; // jefe o élite solos (o con su escolta especial)
    const hpMult = lone ? (cfg.bossHp || 1.8) : (cfg.hp || 1.15);
    const dmgMult = lone ? (cfg.bossDmg || 1.3) : (cfg.dmg || 1);
    for (const inst of instances) {
      if (inst._partyScaled) continue;
      inst._partyScaled = true;
      const ratio = inst.maxHp ? inst.hp / inst.maxHp : 1;
      inst.maxHp = Math.max(1, Math.round((inst.maxHp || inst.hp) * hpMult));
      inst.hp = Math.max(1, Math.round(inst.maxHp * ratio));
      if (dmgMult !== 1) inst.dmgMult = (inst.dmgMult || 1) * dmgMult;
    }
  }

  /**
   * v3.14: un jefe que pelea contra mascotas se prepara: por cada mascota en pie, más vida y más daño
   * (Balance.PET_BOSS). Medido con tools/jefes.js --mascota: con una mascota, el Archimago
   * pasaba de 34% a 85% para un ángel de nivel 9. Devuelve { boss, n } o null.
   */
  function scaleBossForPets(instances, heroes) {
    const n = (heroes || []).filter((h) => h && h.pet && h.pet.health > 0).length;
    if (!n) return null;
    const cfg = B().PET_BOSS || { hp: 0.5, dmg: 0.15 };
    let boss = null;
    for (const inst of instances) {
      if (inst.category !== 'boss' || inst.summoned || inst._petScaled) continue;
      inst._petScaled = n;
      const ratio = inst.maxHp ? inst.hp / inst.maxHp : 1;
      inst.maxHp = Math.max(1, Math.round((inst.maxHp || inst.hp) * (1 + cfg.hp * n)));
      inst.hp = Math.max(1, Math.round(inst.maxHp * ratio));
      inst.dmgMult = (inst.dmgMult || 1) * (1 + cfg.dmg * n);
      boss = boss || inst;
    }
    return boss ? { boss, n } : null;
  }

  /**
   * v3.3: las criaturas de una pelea, ya preparadas para el grupo que va junto
   * (las que se suman y con más vida). Las escenas lo usan para decir exactamente
   * contra qué van a pelear; después Combat.start no las vuelve a tocar.
   */
  function prepareGroup(instances) {
    const list = (instances || []).filter(Boolean);
    for (const inst of list) normalizeInstance(inst);
    const group = A.Party && A.Party.combatHeroes ? A.Party.combatHeroes() : null;
    if (group && group.length > 1) scaleForParty(list, group.length);
    assignLabels(list);
    return list;
  }

  /**
   * v1.9.2: programa una acción del combate solo si cuando llegue el momento
   * sigue siendo el MISMO combate (si terminó y empezó otro, se descarta).
   */
  function later(c, fn, ms) {
    setTimeout(() => { if (State().combat === c) fn(); }, ms);
  }

  const STUN_CHANCE = 0.35;
  const PET_TARGET_CHANCE = 0.30;

  // Efectos que meten los enemigos según sus tags
  const TAG_EFFECTS = {
    poison: { type: 'poison', turns: 3 },
    disease: { type: 'poison', turns: 3 },
    fire: { type: 'fire', turns: 2 },
    ice: { type: 'cold', turns: 2 },
    acid: { type: 'bleed', turns: 2 },
  };
  const TAG_EFFECT_CHANCE = 0.25;
  // v2.5: sangrado y veneno se acumulan hasta 3 a la vez
  const MAX_STACKS = 3;
  // v2.5: lo que suman los guerreros para resistir con agilidad o ingenio
  const WARRIOR_SAVE = 2;
  // v2.4: si una misión en curso pide un objeto y todavía te falta, cae al menos la mitad de las veces
  const QUEST_DROP_CHANCE = 0.5;

  // Ritmo del combate (ms). Dan tiempo a que se vea el dado y el golpe.
  const ENEMY_DELAY = 900;
  const PET_DELAY = 800;
  const NEXT_DELAY = 300;

  /** Clave que usa la vista para ubicar a cada combatiente (animaciones). */
  function fxKey(entity) {
    if (!entity) return null;
    if (entity === State().player) return 'player';
    if (State().player && entity === State().player.pet) return 'pet';
    return entity.instanceId ? `enemy:${entity.instanceId}` : null;
  }

  /** Elemento visual del hechizo (para el color del destello). */
  function spellElement(spell) {
    if (!spell) return 'arcane';
    if (spell.statusEffect && spell.statusEffect.type) {
      const t = spell.statusEffect.type;
      if (t === 'fire') return 'fire';
      if (t === 'cold') return 'ice';
      if (t === 'shock') return 'shock';
      if (t === 'poison') return 'poison';
    }
    const txt = `${spell.id || ''} ${spell.name || ''}`.toLowerCase();
    if (/fuego|llama|ígne|igne|bola|fire/.test(txt)) return 'fire';
    if (/hielo|escarcha|frío|frio|ice/.test(txt)) return 'ice';
    if (/rayo|chispa|trueno|eléctr|electr/.test(txt)) return 'shock';
    if (/veneno|ácido|acido|toxi/.test(txt)) return 'poison';
    if (/luz|sagrad|divin/.test(txt)) return 'holy';
    // v3.22: hechizos oscuros con su propio color (solo cambia el dibujo)
    if (/oscur|sombra|maldi|penumbra|vac[ií]o|terror|drenar|vamp[ií]r|sangre|carmes|singular|eclipse|necro|muerte/.test(txt)) return 'dark';
    return 'arcane';
  }

  // ============================================================
  // Inicio
  // ============================================================

  function start(opts = {}) {
    let instances = null;

    if (Array.isArray(opts.enemies) && opts.enemies.length > 0) {
      instances = opts.enemies;
    } else if (opts.enemyId) {
      const enemyData = A.Data.getById('enemies', opts.enemyId);
      if (!enemyData) return false;
      instances = [A.Encounter.spawnInstance(enemyData)];
    } else if (opts.regionId) {
      instances = A.Encounter.generate(opts.regionId);
    }
    if (!instances || instances.length === 0) return false;
    // v3.3: con el héroe muerto (la pantalla de muerte está por salir) no hay más peleas
    if (State().player && State().player.dead) return false;

    // Instancias viejas (partidas guardadas) pueden no tener attack/difficulty
    for (const inst of instances) normalizeInstance(inst);
    assignLabels(instances);

    const p = State().player;
    // v3.0: en grupo pelean todos los héroes que están juntos (el propio primero)
    const group = A.Party && A.Party.combatHeroes ? A.Party.combatHeroes() : null;
    const party = !!(group && group.length > 1);
    const heroes = party ? group : [p];
    for (const h of heroes) {
      h.effects = [];
      if (h.pet) {
        h.pet.effects = [];
        // v2.5: las habilidades de la mascota arrancan listas en cada pelea
        h.pet._cds = {}; h.pet._used = {}; h.pet._uses = {}; h.pet._turns = 0; h.pet._regenUsed = 0;
        h.pet.tails = 0; h.pet._ambushDone = false; // v3.8: las colas del kitsune vuelven a las de siempre
        h.pet._softened = false; h.pet._slipped = false; h.pet._illusions = 0; h.pet._hideSaid = false; // v3.9: pasivas de defensa
      }
    }
    if (party) { scaleForParty(instances, heroes.length); assignLabels(instances); }
    // v3.14: los jefes cuentan a las mascotas (con una mascota al lado se ganaba casi siempre)
    const petScaled = scaleBossForPets(instances, heroes);

    const initiative = [];
    for (const h of heroes) {
      const hid = party ? hidOf(h) : undefined;
      initiative.push({ kind: 'player', id: party ? `player:${hid}` : 'player', hid, name: h.name, speed: effectivePlayerSpeed(h), tieRoll: 0 });
      if (h.pet && h.pet.health > 0) {
        initiative.push({ kind: 'pet', id: party ? `pet:${hid}` : 'pet', hid, name: h.pet.name, speed: h.pet.speed || 10, tieRoll: 0 });
      }
    }
    for (const inst of instances) {
      initiative.push({ kind: 'enemy', id: inst.instanceId, name: inst.displayName, speed: inst.speed || 10, tieRoll: 0 });
    }

    // Empates de velocidad: D20 entre los empatados
    const bySpeed = {};
    for (const a of initiative) (bySpeed[a.speed] = bySpeed[a.speed] || []).push(a);
    const tieGroups = [];
    for (const key of Object.keys(bySpeed)) {
      const group = bySpeed[key];
      if (group.length > 1) {
        for (const a of group) a.tieRoll = A.Utils.dice(20);
        tieGroups.push({ speed: Number(key), members: group });
      }
    }
    initiative.sort((a, b) => (b.speed - a.speed) || (b.tieRoll - a.tieRoll));

    const combat = {
      id: `cb${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
      enemies: instances,
      targetInstanceId: instances[0].instanceId,
      round: 1,
      initiative,
      currentActorIdx: 0,
      turnStartedFor: null,
      log: [],
      result: null,
      fromTravel: !!opts.fromTravel,
      lair: opts.lair || null, // v3.11: pelea en la guarida de un jefe
      ambush: !!opts.ambush && !opts.surprise,
      surprise: !!opts.surprise,
    };
    if (party) {
      combat.party = true;
      combat.heroIds = heroes.map(hidOf);
      combat.heroCtx = {};
      // v3.3: cuántas criaturas eran "de la pelea de uno" (las otras se sumaron por ser más)
      combat.baseCount = Math.max(1, instances.filter((e) => !e._copy).length);
    }

    // v2.4: Amuleto de la iniciativa: actuás primero (menos si te emboscan)
    const firsts = A.Accessories ? initiative.filter((e) => e.kind === 'player' && A.Accessories.has(party ? A.State.heroById(e.hid) : p, 'first')) : [];
    const goFirst = !combat.ambush && firsts.length > 0 && combat.initiative[0] && !firsts.includes(combat.initiative[0]);
    if (combat.ambush) {
      const firstEnemyIdx = initiative.findIndex((e) => e.kind === 'enemy');
      if (firstEnemyIdx > 0) combat.initiative = initiative.slice(firstEnemyIdx).concat(initiative.slice(0, firstEnemyIdx));
    } else if (combat.surprise) {
      // v2.0: los agarraste desprevenidos: vos (y tu mascota) actúan primero
      const mine = initiative.filter((e) => e.kind !== 'enemy');
      const theirs = initiative.filter((e) => e.kind === 'enemy');
      combat.initiative = mine.concat(theirs);
    } else if (goFirst) {
      combat.initiative = firsts.concat(initiative.filter((e) => !firsts.includes(e)));
    }
    combat.turn = currentTurnKind(combat);
    State().combat = combat;

    addLog(combat, 'system', { text: `Comienza el combate contra ${A.Encounter.describeGroup(instances)}.`, fx: { kind: 'start', group: A.Encounter.describeGroup(instances), ambush: combat.ambush } });
    if (combat.ambush) addLog(combat, 'system', { text: party ? 'Los emboscaron. Los enemigos atacan primero.' : 'Te emboscaron. Los enemigos atacan primero.' });
    if (combat.surprise) addLog(combat, 'system', { text: party ? 'Los agarraron desprevenidos. Actúan primero.' : 'Los agarraste desprevenidos. Actuás primero.' });
    if (goFirst && !combat.surprise) {
      for (const e of firsts) {
        A.State.withHero(party ? A.State.heroById(e.hid) : p, () => addLog(combat, 'system', { text: 'Amuleto de la iniciativa: actuás primero.', fx: { kind: 'buff', target: 'player', label: 'Primero', icon: 'boot' }, say: { text: 'Tu amuleto zumba: te movés antes que nadie.', tone: 'good' } }));
      }
    }
    addLog(combat, 'system', { text: `Orden por velocidad: ${combat.initiative.map((i) => `${i.name} (vel ${i.speed})`).join(' → ')}` });
    if (petScaled) {
      const pcts = B().PET_BOSS || { hp: 0.5, dmg: 0.15 };
      addLog(combat, 'system', { text: `${petScaled.boss.displayName} también pelea contra ${petScaled.n === 1 ? 'tu mascota' : `${petScaled.n} mascotas`}: tiene ${Math.round(pcts.hp * petScaled.n * 100)}% más vida y pega ${Math.round(pcts.dmg * petScaled.n * 100)}% más.`, fx: { kind: 'note' }, say: { text: `${petScaled.boss.displayName} ve ${petScaled.n === 1 ? 'a tu mascota' : 'a las mascotas'} y se prepara para pelear contra todos.`, tone: 'bad' } });
    }
    for (const tg of tieGroups) {
      addLog(combat, 'system', { text: `Empate de velocidad ${tg.speed}, desempate con D20: ${tg.members.map((m) => `${m.name}: ${m.tieRoll}`).join(', ')}` });
    }
    // v2.5: lo que pasó al explorar antes de la pelea (te picó la araña, los heriste por sorpresa...)
    // v3.0: en grupo le pasa al que eligió la opción
    const opener = party && opts.openingHid ? A.State.heroById(opts.openingHid) : null;
    A.State.withHero(opener || p, () => applyOpening(combat, opts.opening));
    // v3.0: Polvo de hada: una criatura (no jefe) se duerme y pierde su primer turno
    for (const h of heroes) {
      const turns = P() && P().fairyDust ? P().fairyDust(h) : 0;
      if (!turns) continue;
      const pool = instances.filter((e) => e.hp > 0 && e.category !== 'boss' && !(e.effects || []).some((ef) => ef.type === 'stun'));
      if (!pool.length) {
        // v3.11 (dossier): si son todos jefes, el polvo no los duerme pero los marea en su primer ataque
        const boss = instances.find((e) => e.hp > 0);
        if (boss) {
          A.State.withHero(h, () => {
            applyStatus(boss, 'stagger', { turns: 2, value: 1, source: 'polvo_hada' });
            addLog(combat, 'system', { text: `Polvo de hada: ${boss.displayName} queda mareado (−1 de precisión).`, fx: { kind: 'status', target: fxKey(boss), effect: 'stagger', passive: 'polvo_hada' }, say: { text: `Soplás tu polvo de hada: ${A.Skills ? A.Skills.noun(boss) : boss.displayName} es demasiado fuerte para dormirse, pero queda mareado en su primer ataque.`, tone: 'good' } });
          });
        }
        continue;
      }
      const e = pool[Math.floor(Math.random() * pool.length)];
      A.State.withHero(h, () => {
        e.effects = e.effects || [];
        e.effects.push({ type: 'stun', turns, value: 1, source: 'polvo_hada' });
        const n = A.Skills ? A.Skills.noun(e) : e.displayName;
        const fem = A.Narrator && A.Narrator.isFem ? A.Narrator.isFem(e.id) : false;
        addLog(combat, 'system', { text: `Polvo de hada: ${e.displayName} se duerme.`, fx: { kind: 'status', target: fxKey(e), effect: 'stun', passive: 'polvo_hada' }, say: { text: `Soplás tu polvo de hada: ${n} se queda ${fem ? 'dormida' : 'dormido'} y pierde su primer turno.`, tone: 'good' } });
      });
    }
    bossOpening(combat); // v3.11: el Kraken y sus tentáculos
    addTurnHeader(combat, 1);
    // v3.9: ¡una brillante!
    for (const e of instances.filter((x) => x.shiny)) {
      const n = A.Skills ? A.Skills.noun(e) : e.displayName;
      addLog(combat, 'system', { text: `¡${e.displayName}!`, fx: { kind: 'status', target: fxKey(e), effect: 'rally' }, say: { text: `¡Mirá! ${n.charAt(0).toUpperCase()}${n.slice(1)} tiene colores que nunca viste: es una criatura brillante. Si la vencés, deja algo valioso.`, tone: 'good' } });
    }

    // v3.1: al bestiario de cada uno (la que no conocía deja de ser "???")
    if (A.Bestiary) for (const h of heroes) A.State.withHero(h, () => A.Bestiary.see(instances.filter((e) => !e.summoned)));

    A.Bus.emit('combat:started', { count: instances.length });
    State().persist();
    later(combat, () => advanceIfNotPlayer(), 500);
    return true;
  }

  function normalizeInstance(inst) {
    const cat = B().CATEGORY[inst.category] || B().CATEGORY.normal;
    if (inst.attack == null) inst.attack = Math.max(0, B().Enemy.attack(inst.tier) + cat.atk);
    if (inst.difficulty == null) inst.difficulty = B().Enemy.defense(inst.tier) + cat.def;
    if (!inst.effects) inst.effects = [];
    if (!inst.displayName) inst.displayName = inst.name;
    // v2.5: instancias de partidas viejas no traen las habilidades
    if (!Array.isArray(inst.skills)) {
      const d = A.Data.getById('enemies', inst.id);
      inst.skills = d && Array.isArray(d.skills) ? d.skills.slice() : [];
    }
  }

  /**
   * v2.5: lo que trae la pelea desde la exploración.
   * opening = [{ type: 'status', status, turns, value, say } | { type: 'damage', amount, say }]
   */
  function applyOpening(c, opening) {
    if (!Array.isArray(opening) || !opening.length) return;
    const p = State().player;
    for (const o of opening) {
      if (!o) continue;
      if (o.type === 'damage' && o.amount > 0) {
        const before = p.hp;
        A.State.damagePlayer(Math.min(o.amount, Math.max(0, p.hp - 1))); // nunca te mata antes de empezar
        const lost = before - p.hp;
        if (lost > 0) addLog(c, 'system', { text: `Empezás la pelea con ${lost} de vida menos.`, fx: { kind: 'tick', target: 'player', amount: lost, effect: o.effect || 'bleed' }, say: { text: o.say || `Empezás la pelea herido: perdés ${lost} de vida.`, tone: 'bad' } });
      } else if (o.type === 'status' && o.status) {
        inflict(c, p, o.status, { turns: o.turns || 2, value: o.value || 1, source: 'explore', say: o.say ? { text: o.say, tone: 'bad' } : null });
      } else if (o.type === 'note' && o.say) {
        addLog(c, 'system', { text: o.say, fx: { kind: 'note' }, say: { text: o.say, tone: o.tone || 'good' } });
      } else if (o.type === 'buff' && o.mods) {
        // v3.1: una mejora al empezar (pelear de frente: guardia alta)
        p.effects = (p.effects || []).filter((e) => !(e.type === 'buff' && e.source === (o.source || 'explore')));
        p.effects.push({ type: 'buff', source: o.source || 'explore', name: o.name || 'Mejora', mods: o.mods, turns: o.turns || 2, value: 1, fresh: true });
        if (o.say) addLog(c, 'system', { text: o.say, fx: { kind: 'note' }, say: { text: o.say, tone: 'good' } });
      }
    }
  }

  function currentTurnKind(combat) {
    const cur = combat.initiative[combat.currentActorIdx];
    return cur ? cur.kind : 'player';
  }

  function isPlayerTurn(combat) {
    if (!combat || !combat.initiative) return false;
    const cur = combat.initiative[combat.currentActorIdx];
    if (!cur || cur.kind !== 'player') return false;
    // v3.0: en grupo, solo si es el turno del héroe en contexto
    return !combat.party || cur.hid === ctxHid();
  }


  Object.assign(C, { State, B, P, freeItem, hidOf, ctxHid, outHids, heroesOf, heroOfEntry, pickTargetHero, forEachHero, allyTargets, allyTarget, healAlly, petBackInFight, joinY, swapHero, dropHero, scaleForParty, scaleBossForPets, prepareGroup, later, fxKey, spellElement, start, normalizeInstance, applyOpening, currentTurnKind, isPlayerTurn, HERO_FIELDS, FREE_ITEMS, STUN_CHANCE, PET_TARGET_CHANCE, TAG_EFFECTS, TAG_EFFECT_CHANCE, MAX_STACKS, WARRIOR_SAVE, QUEST_DROP_CHANCE, ENEMY_DELAY, PET_DELAY, NEXT_DELAY });
})(window.Aventurs);
