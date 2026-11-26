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

  function State() { return A.State; }
  function B() { return A.Balance; }
  function P() { return A.Passives; }

  // ============================================================
  // v3.0: héroes de la pelea (uno en solitario, dos en grupo)
  // ============================================================

  /** Lo que es de cada héroe dentro de la pelea (se intercambia al cambiar de contexto). */
  // v3.3: cada uno tiene sus dos intentos de huir
  // v3.3: también las esperas de los hechizos y los objetos usados en el turno
  const HERO_FIELDS = ['passives', 'itemUsed', 'itemSurvivor', 'powerCd', 'targetInstanceId', 'fleeAttempts', 'spellCd', 'itemsTurn'];

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
  function pickTargetHero(c) {
    const up = heroesOf(c).filter((h) => h.hp > 0);
    if (!up.length) return State().player;
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

  // ============================================================
  // Stats derivados
  // ============================================================

  function playerStats() { return B().playerCombatStats(State().player); }

  /** Velocidad efectiva del jugador (resta el peso del equipo que pase de 4). */
  function effectivePlayerSpeed(player) {
    if (!player) return 10;
    return B().playerCombatStats(player).speed;
  }

  function petStats(pet) {
    const fx = B().statusMods(pet);
    const sk = A.Skills ? A.Skills.statMods(pet, null) : { attack: 0, defense: 0, armor: 0 };
    return {
      attack: (pet.attack != null ? pet.attack : B().Pet.attack(pet.level || 1)) - fx.attackPenalty + sk.attack,
      defense: 8 + (pet.dodge || 0) - fx.defensePenalty + sk.defense,
      armor: Math.max(0, (pet.armor || 0) - (fx.armorPenalty || 0) + sk.armor),
    };
  }

  /** v2.5: suma las pasivas (Manada, Líder, Vuela) y los estados (guardia, ácido, derribado...). */
  function enemyStats(inst) {
    const fx = B().statusMods(inst);
    const sk = A.Skills ? A.Skills.statMods(inst, State().combat) : { attack: 0, defense: 0, armor: 0 };
    return {
      attack: (inst.attack || 0) - fx.attackPenalty + sk.attack,
      defense: (inst.difficulty || 10) - fx.defensePenalty + sk.defense,
      armor: Math.max(0, (inst.armor || 0) - (fx.armorPenalty || 0) + sk.armor),
    };
  }

  /** v2.5: daño de un golpe de criatura (miedo, envalentonado, Furia, élite y lo que pida la habilidad). */
  function rollEnemyDamage(enemy, opts = {}) {
    const fx = B().statusMods(enemy);
    let raw = rollDamage(enemy.damage) + (opts.flat || 0) - (fx.damagePenalty || 0);
    if (enemy.dmgMult) raw *= enemy.dmgMult;
    const fury = A.Skills ? A.Skills.damageMult(enemy) : 1;
    if (fury > 1) {
      raw *= fury;
      const c = State().combat;
      if (c && !enemy._furySaid) {
        enemy._furySaid = true;
        const n = A.Skills.noun(enemy);
        addLog(c, 'system', { text: `${enemy.displayName} se enfurece: pega más fuerte.`, fx: { kind: 'status', target: fxKey(enemy), effect: 'fury' }, say: { text: `Con las heridas, ${n} se enfurece: pega más fuerte.`, tone: 'bad' } });
      }
    }
    // v3.8: las colas del kitsune y la Emboscada
    const bonus = A.Skills && A.Skills.bonusDamage ? A.Skills.bonusDamage(enemy) : { mult: 1 };
    raw *= bonus.mult;
    if (bonus.ambush) {
      const c = State().combat;
      const n = A.Skills.noun(enemy);
      if (c) addLog(c, 'system', { text: `${enemy.displayName} ataca por sorpresa.`, fx: { kind: 'note', actor: fxKey(enemy), skill: 'emboscada' }, say: { text: `${n.charAt(0).toUpperCase()}${n.slice(1)} ataca por sorpresa: el golpe viene con todo.`, tone: 'bad' } });
    }
    if (opts.mult) raw *= opts.mult;
    return Math.max(1, Math.round(raw));
  }

  /**
   * Daño del jugador: arma (o puños 1d3) + bonus de daño.
   * Devuelve { expression, components, range }.
   */
  function composePlayerDamage(player) {
    if (!player) return { expression: '1d3', components: [], range: { min: 1, max: 3 } };
    const st = B().playerCombatStats(player);
    const components = [];
    if (st.weapon && st.weapon.damage) {
      components.push({ source: 'weapon', label: st.weapon.name, expr: st.weapon.damage, icon: '' });
    } else {
      components.push({ source: 'race', label: 'Puños', expr: '1d3', icon: '' });
    }
    if (st.damageBonus > 0) components.push({ source: 'modifier', label: 'Bonus de daño', expr: `+${st.damageBonus}`, icon: '' });
    let expression = components.map((c) => c.expr).join(' + ');
    if (st.damageBonus < 0) expression += ` - ${Math.abs(st.damageBonus)}`;
    expression = expression.replace(/\+\s*\+/g, '+').replace(/\s+/g, ' ').trim();
    const range = A.Utils.diceRange(expression.replace(/ - \d+$/, ''));
    if (st.damageBonus < 0) { range.min = Math.max(1, range.min + st.damageBonus); range.max = Math.max(1, range.max + st.damageBonus); }
    return { expression, components, range, bonus: st.damageBonus };
  }

  function rollPlayerDamage(player) {
    const composed = composePlayerDamage(player);
    const positive = composed.expression.replace(/ - \d+$/, '');
    const res = A.Utils.rollDiceCompound(positive);
    let total = res.total;
    if (composed.bonus < 0) total = Math.max(1, total + composed.bonus);
    return { total, composed, res };
  }

  /**
   * Tirada única de ataque.
   * opts.critMin: desde qué número es crítico (Ojo certero: 19).
   * opts.reroll1: un 1 natural se vuelve a tirar (Suerte).
   */
  function attackRoll(attack, defense, opts = {}) {
    let roll = A.Utils.dice(20);
    let lucky = false;
    if (roll === 1 && opts.reroll1) { lucky = true; roll = A.Utils.dice(20); }
    const total = roll + attack;
    const fumble = roll === 1;
    // v3.11 (dossier): el 20 pega siempre; un 18 o 19 (Goliat, Elfo, Anillo del golpe certero) es crítico
    // solo si el golpe llega a la defensa (antes acertaba siempre)
    const hit = roll === 20 || (!fumble && total >= defense);
    const crit = hit && roll >= (opts.critMin || 20);
    return { roll, total, fumble, crit, hit, lucky };
  }

  /** Opciones de tirada del jugador según su pasiva. */
  function playerRollOpts(p) {
    const base = P() ? { critMin: P().critMin(p), reroll1: P().rerollOnes(p) } : { critMin: 20 };
    // v2.4: Anillo del golpe certero: críticos desde más abajo
    const extra = A.Accessories ? A.Accessories.bonus(p, 'crit') : 0;
    if (extra > 0) base.critMin = Math.max(2, (base.critMin || 20) - extra);
    return base;
  }

  /**
   * v2.4: todo lo que protege al jugador antes de perder vida:
   * pasivas de raza (Piel de roca, Determinación) y luego objetos
   * (Invencible, Amuleto del superviviente, Pergamino de resurrección).
   */
  function shieldPlayer(c, p, dmg, opts = {}) {
    const ab = P() ? P().absorbHit(c, p, dmg, opts) : { dmg, passive: null };
    const gd = A.ItemFx ? A.ItemFx.guard(c, p, ab.dmg) : { dmg: ab.dmg, tag: null };
    // v3.11: cuánto sacó la Piel de roca y cuánto frenó la Bendición divina (para contarlo)
    return { dmg: gd.dmg, passive: ab.passive, guard: gd.tag, absorbed: ab.absorbed || 0, roca: ab.roca || 0, blessed: ab.blessed || 0, blessBy: ab.blessBy || null };
  }

  /** Cuenta lo que hizo un objeto que te salvó (después del golpe). */
  function announceGuard(c, tag) {
    if (!tag || tag === 'invincible') return;
    const p = State().player;
    if (tag === 'survivor') {
      const it = A.Data.getById('items', p.equipment && p.equipment.accessory);
      addLog(c, 'system', { text: `${it ? it.name : 'Tu amuleto'}: quedás con 1 de vida.`, fx: { kind: 'buff', target: 'player', label: '¡En pie!', icon: 'heart' }, say: { text: `¡Tu ${(it ? it.name : 'amuleto').toLowerCase()} brilla! El golpe que te iba a matar te deja con 1 de vida.`, tone: 'crit' } });
    } else if (tag === 'resurrect') {
      addLog(c, 'system', { text: `Pergamino de resurrección: quedás con ${p.hp} de vida.`, fx: { kind: 'buff', target: 'player', label: '¡En pie!', icon: 'heart' }, say: { text: `¡La luz del pergamino te sostiene! Quedás en pie con ${p.hp} de vida.`, tone: 'crit' } });
    }
  }

  /** v2.4: ¿te protege algo de este efecto? { passive } (raza) o { name } (equipo o mejora). */
  function immunityOf(p, type) {
    if (P() && P().immune(p, type)) return { passive: P().idOf(p) };
    return A.ItemFx ? A.ItemFx.immunityOf(p, type) : null;
  }

  /**
   * Después de que te pegan: Furia (se avisa la primera vez) y
   * Bendición (te cura una vez por combate al quedar con media vida).
   */
  function maybeAnnounceFury(c, p) {
    if (!P() || !p || p.hp <= 0) return;
    if (P().furyJustStarted(c, p)) {
      addLog(c, 'system', {
        text: `Furia: tus golpes hacen +${P().damageBonus(p)} de daño.`,
        fx: { kind: 'passive', passive: 'furia', amount: P().damageBonus(p) },
      });
    }
    const bless = P().blessingHeal(c, p);
    if (bless > 0) {
      const before = p.hp;
      A.State.healHp(bless);
      addLog(c, 'system', { text: `Bendición: +${p.hp - before} de vida.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: p.hp - before, passive: 'bendicion' } });
    }
  }

  function rollDamage(notationOrNumber) {
    if (typeof notationOrNumber === 'number') return notationOrNumber;
    if (typeof notationOrNumber !== 'string') return 1;
    return A.Utils.rollDice(notationOrNumber);
  }

  /** Si pega, el daño final es como mínimo 1. */
  /**
   * v3.9: la armadura se resta del daño. Si la armadura es igual o mayor que
   * el golpe, lo para del todo (0). Un crítico siempre hace al menos 1.
   */
  function pickOne(list) { return list[Math.floor(Math.random() * list.length)]; }
  function mitigate(raw, armor, crit) {
    const d = raw - (armor || 0);
    return crit ? Math.max(1, d) : Math.max(0, d);
  }

  // ============================================================
  // Efectos de estado
  // ============================================================

  function applyStatus(target, type, opts = {}) {
    if (!target) return false;
    if (target === State().player && immunityOf(target, type)) return false;
    // v2.5: inmunidades de las criaturas (no muertos, constructos, cuerpo de fuego...)
    if (target.instanceId && A.Skills && A.Skills.immune(target, type)) return false;
    if (!target.effects) target.effects = [];
    const turns = opts.turns || 3;
    const value = opts.value || 1;
    const source = opts.source || 'unknown';
    if (type !== 'bleed' && type !== 'poison') {
      // fuego, frío, choque, ceguera, silencio: se refrescan, no se acumulan
      const existing = target.effects.find((e) => e.type === type);
      if (existing) {
        existing.turns = Math.max(existing.turns, turns);
        existing.value = Math.max(existing.value, value);
        return true;
      }
    } else {
      // v2.5: sangrado y veneno se acumulan, pero hasta 3 a la vez (el más viejo se renueva)
      const same = target.effects.filter((e) => e.type === type);
      if (same.length >= MAX_STACKS) {
        const oldest = same.reduce((a, b) => (a.turns <= b.turns ? a : b));
        oldest.turns = Math.max(oldest.turns, turns);
        oldest.value = Math.max(oldest.value, value);
        oldest.source = source;
        return true;
      }
    }
    target.effects.push({ type, turns, value, source });
    return true;
  }

  function removeStatus(target, type) {
    if (!target || !target.effects) return;
    target.effects = target.effects.filter((e) => e.type !== type);
  }

  function effectLabel(type) {
    return ({
      bleed: 'sangrado', poison: 'veneno', fire: 'fuego', cold: 'frío',
      shock: 'choque', blind: 'ceguera', silence: 'silencio',
      stun: 'aturdido', curse: 'maldición', buff: 'mejora',
      // v2.5
      prone: 'derribado', fear: 'miedo', grab: 'atrapado', corrode: 'ácido',
      rally: 'envalentonado', guard: 'en guardia',
      // v3.11
      stagger: 'desequilibrado', exposed: 'expuesto',
    })[type] || type;
  }

  // v2.5: cómo se nombra cada estado en "X no te hace nada"
  const STATUS_NOUN = {
    poison: 'el veneno', fire: 'el fuego', cold: 'el frío', shock: 'la descarga', bleed: 'el sangrado',
    blind: 'la ceguera', silence: 'el silencio', stun: 'el aturdimiento', curse: 'la maldición',
    prone: 'el golpe', fear: 'el miedo', grab: 'el agarre', corrode: 'el ácido',
  };
  // y cómo lo dice una criatura inmune
  const IMMUNE_LINE = {
    bleed: '{E} no sangra.', poison: 'El veneno no le hace nada a {e}.', fire: 'El fuego no le hace nada a {e}.',
    cold: 'El frío no le hace nada a {e}.', fear: '{E} no conoce el miedo.', prone: 'No hay forma de tirar al suelo a {e}.',
    grab: 'No hay forma de agarrar a {e}.', blind: '{E} no se encandila.',
  };

  /**
   * v2.5: aplica un estado y lo cuenta. Si es inmune, cuenta por qué.
   * opts.quiet: sin frase (ya la dijo la tirada) · opts.say: frase propia.
   */
  function inflict(c, victim, type, opts = {}) {
    if (!victim || !c) return false;
    if (applyStatus(victim, type, opts)) {
      const entry = { text: `${targetName(victim)} sufre ${effectLabel(type)}.`, fx: { kind: 'status', target: fxKey(victim), effect: type } };
      if (opts.quiet) entry.say = { text: '', tone: 'bad' };
      else if (opts.say && opts.say.text) entry.say = opts.say;
      addLog(c, 'system', entry);
      return true;
    }
    immuneNote(c, victim, type);
    return false;
  }

  function immuneNote(c, victim, type) {
    const p = State().player;
    const label = effectLabel(type);
    if (victim === p) {
      const im = immunityOf(p, type) || {};
      if (im.passive) {
        addLog(c, 'system', { text: `${p.name} no sufre ${label} (pasiva).`, fx: { kind: 'passive', passive: im.passive, effect: type } });
      } else {
        addLog(c, 'system', {
          text: `${p.name} no sufre ${label} (${im.name || 'protección'}).`,
          fx: { kind: 'buff', target: 'player', label: 'Inmune', icon: 'star' },
          say: { text: `${im.name ? `Gracias a ${im.name.toLowerCase()}, ` : ''}${STATUS_NOUN[type] || 'eso'} no te hace nada.`.replace(/^./, (ch) => ch.toUpperCase()), tone: 'good' },
        });
      }
      return;
    }
    if (victim.instanceId && A.Skills) {
      const im = A.Skills.immune(victim, type);
      if (!im) return;
      addLog(c, 'system', {
        text: `${victim.displayName} no sufre ${label} (${im.name}).`,
        fx: { kind: 'status', target: fxKey(victim), effect: 'immune' },
        say: { text: A.Skills.fill(IMMUNE_LINE[type] || `{E} no sufre ${label}.`, victim), tone: 'neutral' },
      });
    }
  }

  /** Arma o hechizo con statusEffect: chance de aplicarlo al pegar. */
  function maybeInflictStatusOnHit(source, target, c) {
    if (!source || !target || !source.statusEffect) return;
    const eff = source.statusEffect;
    if (Math.random() > (eff.chance || 0)) return;
    if (!c) { applyStatus(target, eff.type, { turns: eff.turns || 3, value: eff.value || 1, source: source.id }); return; }
    // v2.5: el arma cuenta lo que hizo ("Tu daga abre una herida que sangra")
    const line = A.ItemFx && A.ItemFx.weaponProcLine ? A.ItemFx.weaponProcLine(source, target) : null;
    inflict(c, target, eff.type, { turns: eff.turns || 3, value: eff.value || 1, source: source.id, say: line ? { text: line, tone: 'good' } : null });
  }

  function targetName(t) {
    if (!t) return '';
    if (t === State().player) return t.name;
    return t.displayName || t.name;
  }

  /**
   * Procesa los efectos al empezar el turno de un combatiente.
   * Devuelve { skip: true } si queda aturdido o muere.
   */
  function startOfTurn(c, kind, entity) {
    if (!entity || !entity.effects || entity.effects.length === 0) return { skip: false };
    let dmg = 0;
    let tickType = null;
    const parts = [];
    let stunned = false;
    for (const ef of entity.effects) {
      // v2.4: las mejoras (pociones, pergaminos) se descuentan después de cada acción tuya
      if (ef.type === 'buff') continue;
      if (ef.type === 'bleed' || ef.type === 'poison' || ef.type === 'fire') {
        dmg += ef.value;
        if (!tickType) tickType = ef.type;
        parts.push(`${effectLabel(ef.type)} ${ef.value}`);
      }
      if (ef.type === 'shock' && Math.random() < STUN_CHANCE) stunned = true;
      if (ef.type === 'stun') stunned = true; // v2.4: pergaminos que paralizan
      ef.turns -= 1;
    }
    entity.effects = entity.effects.filter((e) => e.type === 'buff' || e.turns > 0);

    const name = targetName(entity);
    if (dmg > 0) {
      if (kind === 'player') {
        const ab = shieldPlayer(c, entity, dmg, { tick: true });
        A.State.damagePlayer(ab.dmg);
        addLog(c, 'system', { text: `Efectos: ${parts.join(', ')}. -${ab.dmg} salud (HP ${entity.hp}/${entity.maxHp})`, passive: ab.passive, fx: { kind: 'tick', target: 'player', amount: ab.dmg, effect: tickType } });
        announceGuard(c, ab.guard);
        if (entity.hp <= 0) return { skip: true, died: true };
        maybeAnnounceFury(c, entity);
      } else if (kind === 'pet') {
        entity.health = Math.max(0, entity.health - dmg);
        addLog(c, 'system', { text: `${name} sufre ${parts.join(', ')} (-${dmg}, HP ${entity.health}/${entity.maxHealth})`, fx: { kind: 'tick', target: 'pet', amount: dmg, effect: tickType } });
        if (entity.health <= 0) { petKnockedOut(c, entity); return { skip: true }; }
      } else {
        entity.hp = Math.max(0, entity.hp - dmg);
        addLog(c, 'system', { text: `${name} sufre ${parts.join(', ')} (-${dmg}, HP ${entity.hp}/${entity.maxHp})`, fx: { kind: 'tick', target: fxKey(entity), amount: dmg, effect: tickType } });
        // v2.5: el fénix puede renacer acá también
        if (entity.hp <= 0 && enemyDown(c, entity, 'tick')) return { skip: true };
      }
    }
    if (stunned) {
      addLog(c, 'system', { text: kind === 'player' ? 'Estás aturdido y perdés el turno.' : `${name} está aturdido y pierde el turno.`, fx: { kind: 'stun', target: kind === 'player' ? 'player' : kind === 'pet' ? 'pet' : fxKey(entity) } });
      return { skip: true };
    }
    return { skip: false };
  }

  // ============================================================
  // Flujo de turnos
  // ============================================================

  function addTurnHeader(c, n) {
    addLog(c, 'turn-header', { text: `── Turno ${n} ──`, turnNumber: n });
    blessingRound(c);
    // v3.9: el vínculo con la mascota (unicornio, fénix, slime...): un poco de vida por ronda si estás herido
    if (n > 1 && A.Tame && A.Tame.ownerBond) {
      for (const h of (c.party && c.heroIds ? c.heroIds.map((id) => A.State.heroById ? A.State.heroById(id) : null).filter(Boolean) : [State().player])) {
        if (!h || h.hp <= 0 || h.hp >= h.maxHp || !h.pet) continue;
        const bond = A.Tame.ownerBond(h);
        if (!bond.regen) continue;
        const heal = Math.min(bond.regen, h.maxHp - h.hp);
        h.hp += heal;
        const PN = A.Narrator && A.Narrator.petNoun ? A.Narrator.petNoun(h.pet) : h.pet.name;
        addLog(c, 'system', { text: `${h.pet.name} te cura ${heal}.`, fx: { kind: 'heal', target: 'player', amount: heal, passive: 'vinculo' }, say: { text: `${PN.charAt(0).toUpperCase()}${PN.slice(1)} te cierra un poco las heridas: +${heal} de vida.`, tone: 'good' } });
      }
    }
  }

  /** v3.11 (dossier): Bendición divina: al empezar cada ronda, cada ángel protege al más herido del grupo. */
  function blessingRound(c) {
    if (!P() || !P().blessRound) return;
    const heroes = c.party ? heroesOf(c) : [State().player];
    const given = P().blessRound(c, heroes);
    for (const g of given) {
      if (!g.fresh) continue; // si sigue con el mismo, no se repite la frase
      const self = g.target === g.angel;
      A.State.withHero(g.angel, () => addLog(c, 'system', {
        text: `Bendición divina: ${self ? 'te protege' : `protege a ${g.target.name}`} (frena ${g.amount} del próximo golpe).`,
        passive: 'bendicion',
        fx: { kind: 'buff', target: c.party ? `hero:${hidOf(g.target)}` : 'player', label: `Bendición ${g.amount}`, icon: 'sun' },
        say: { text: self ? `Una luz suave te rodea: el próximo golpe que recibas pega ${g.amount} menos.` : `Una luz suave rodea a ${g.target.name}: el próximo golpe que reciba pega ${g.amount} menos.`, tone: 'good' },
      }));
    }
  }

  function checkEnd() {
    const c = State().combat;
    if (!c || c.result) return true;
    if (aliveEnemies().length === 0) { onVictory(); A.Bus.emit('combat:ended', { result: 'victory' }); return true; }
    // v3.3: si ya no queda nadie (huyeron o se desconectaron), la pelea se termina sin más
    if (c.party && !heroesOf(c).length) {
      c.result = 'flee';
      A.Bus.emit('combat:ended', { result: 'flee' });
      State().persist();
      return true;
    }
    // v3.0: en grupo se pierde cuando caen todos
    if (heroesOf(c).every((h) => h.hp <= 0)) { onDefeat(); A.Bus.emit('combat:ended', { result: 'defeat' }); return true; }
    return false;
  }

  function advanceIfNotPlayer() {
    const c = State().combat;
    if (!c || c.result) return;
    if (checkEnd()) return;

    const cur = c.initiative[c.currentActorIdx];
    if (!cur) {
      c.round += 1;
      c.currentActorIdx = 0;
      addTurnHeader(c, c.round);
      State().persist();
      A.Bus.emit('combat:turn', { round: c.round });
      later(c, () => advanceIfNotPlayer(), 350);
      return;
    }

    // Saltear caídos
    let entity = null;
    let owner = null; // v3.0: el héroe del turno (o el dueño de la mascota)
    if (cur.kind === 'enemy') {
      entity = c.enemies.find((e) => e.instanceId === cur.id);
      if (!entity || entity.hp <= 0) { c.currentActorIdx += 1; return advanceIfNotPlayer(); }
      // v3.10: los jefes (y los que tienen Furia de jefe) se enfurecen con la mitad de la vida
      if (!entity.enraged && entity.hp <= entity.maxHp / 2 && (entity.category === 'boss' || (entity.skills || []).includes('enfurecer'))) {
        entity.enraged = true;
        entity.dmgMult = (entity.dmgMult || 1) * ((B().BOSS && B().BOSS.rage) || 1.2);
        const n = A.Skills ? A.Skills.noun(entity) : entity.displayName;
        addLog(c, 'enemy', { text: `¡${entity.displayName} se enfurece!`, fx: { kind: 'status', target: fxKey(entity), effect: 'rally' }, say: { text: `¡${n.charAt(0).toUpperCase()}${n.slice(1)} se enfurece! Desde ahora pega más fuerte.`, tone: 'bad' } });
      }
    } else if (cur.kind === 'pet') {
      owner = heroOfEntry(c, cur);
      entity = owner ? owner.pet : null;
      if (!entity || entity.health <= 0) { c.currentActorIdx += 1; return advanceIfNotPlayer(); }
    } else if (cur.kind === 'ally') {
      // v3.11: un aliado invocado (el lobo del Aullido): no actúa la ronda en que llega
      owner = heroOfEntry(c, cur);
      entity = (c.allies || []).find((a) => a.aid === cur.aid) || null;
      if (!owner || !entity || entity.hp <= 0 || entity.attacksLeft <= 0 || entity.born === c.round) { c.currentActorIdx += 1; return advanceIfNotPlayer(); }
    } else {
      owner = heroOfEntry(c, cur);
      entity = owner;
      if (!entity || entity.hp <= 0) { c.currentActorIdx += 1; return advanceIfNotPlayer(); }
    }

    // Efectos al inicio del turno (una sola vez por turno)
    const turnKey = `${c.round}:${c.currentActorIdx}`;
    if (c.turnStartedFor !== turnKey) {
      c.turnStartedFor = turnKey;
      const st = A.State.withHero(owner || State().player, () => {
        if (cur.kind === 'player') {
          // v2.1.1: el golpe fuerte se recarga un turno por vez
          if (c.powerCd > 0) c.powerCd -= 1;
          // v3.3: los hechizos con espera también, y los objetos del turno vuelven a cero
          if (c.spellCd) {
            for (const k of Object.keys(c.spellCd)) {
              c.spellCd[k] -= 1;
              if (c.spellCd[k] <= 0) delete c.spellCd[k];
            }
          }
          c.itemsTurn = 0;
          playerTurnPassives(c, entity);
        } else if (cur.kind !== 'ally') {
          creatureTurnPassives(c, cur.kind, entity); // v2.5: Regeneración
        }
        return startOfTurn(c, cur.kind, entity);
      });
      if (checkEnd()) return;
      if (st.skip) {
        A.Bus.emit('combat:action', { actor: cur.kind });
        nextActor();
        return;
      }
    }

    c.turn = cur.kind;
    State().persist();
    A.Bus.emit('combat:turn', { actor: cur.kind, round: c.round, hid: cur.hid });

    // Pausas pensadas para que se vea el dado y el golpe de cada uno
    if (cur.kind === 'enemy') later(c, () => A.State.withHero(pickTargetHero(c), () => executeEnemyAction(entity)), ENEMY_DELAY);
    else if (cur.kind === 'pet') later(c, () => A.State.withHero(owner || State().player, () => executePetAction()), PET_DELAY);
    else if (cur.kind === 'ally') later(c, () => A.State.withHero(owner || State().player, () => executeAllyAction(entity)), PET_DELAY);
    // Jugador: espera input (en grupo, el del compañero llega por la red)
  }

  /** Pasivas que actúan al empezar tu turno (en silencio: solo el número flotante). */
  function playerTurnPassives(c, p) {
    if (!p) return;
    // v2.4: Orbe de regeneración y Poción/Pergamino de regenerar
    const regen = (A.Accessories ? A.Accessories.bonus(p, 'regen') : 0) + (A.ItemFx ? A.ItemFx.buffMods(p).regen : 0);
    if (regen > 0 && p.hp > 0 && p.hp < p.maxHp) {
      const before = p.hp;
      A.State.healHp(regen);
      if (p.hp > before) addLog(c, 'system', { text: `Regeneración: +${p.hp - before} de vida.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: p.hp - before }, say: { text: `Tus heridas se cierran solas: +${p.hp - before} de vida.`, tone: 'good' } });
    }
    // v3.9: Sangre lunar (licántropo): 2 turnos en forma bestial y 1 normal; en forma bestial, algo de vida (con tope por pelea)
    const moon = P() && P().lunarTurn ? P().lunarTurn(c, p) : null;
    if (moon) {
      if (moon.event === 'beast') addLog(c, 'system', { text: 'Sangre lunar: forma bestial.', fx: { kind: 'passive', passive: 'sangre_lobo', actor: 'player', target: 'player' }, passive: 'sangre_lobo', say: { text: 'La luna te sube por la sangre: te crecen las garras y el pelo. Forma bestial.', tone: 'good' } });
      else if (moon.event === 'human') addLog(c, 'system', { text: 'Sangre lunar: volvés a tu forma.', fx: { kind: 'note' }, say: { text: 'La bestia se calma por un momento y volvés a tu forma.', tone: 'neutral' } });
      if (moon.heal > 0) {
        const before = p.hp;
        A.State.healHp(moon.heal);
        if (p.hp > before) {
          P().lunarHealed(c, p, p.hp - before);
          const li = P().lunarInfo(c, p);
          addLog(c, 'system', {
            text: `Sangre lunar: +${p.hp - before} de vida (${li.healed}/${li.cap} en esta pelea).`,
            fx: { kind: 'heal', actor: 'player', target: 'player', amount: p.hp - before, passive: 'sangre_lobo' },
            passive: 'sangre_lobo',
            say: { text: `La bestia te cierra las heridas: +${p.hp - before} de vida (${li.healed} de ${li.cap} que puede curarte en esta pelea).`, tone: 'good' },
          });
        }
      }
    }
    // v3.11: Instinto salvaje (orco) y la nave nodriza (alienígena) al empezar tu turno
    if (P() && P().instinctTurn) P().instinctTurn(c, p);
    if (P() && P().orbitalTurn) P().orbitalTurn(c, p);
    // v3.9: Frenesí vampírico (empieza el turno siguiente a la tercera gota y dura dos turnos tuyos)
    const blood = P() && P().bloodTurn ? P().bloodTurn(c, p) : null;
    if (blood === 'start') addLog(c, 'system', { text: '¡Frenesí vampírico!', fx: { kind: 'passive', passive: 'colmillos', actor: 'player', target: 'player' }, passive: 'colmillos', say: { text: '¡Frenesí vampírico! La sangre te nubla los ojos: estos dos turnos pegás más fuerte y robás más vida.', tone: 'crit' } });
    else if (blood === 'end') addLog(c, 'system', { text: 'Se termina el Frenesí.', fx: { kind: 'note' }, say: { text: 'El Frenesí se apaga. Volvés a juntar sangre desde cero.', tone: 'neutral' } });
    // v2.1: los magos recuperan maná al empezar cada turno (cada raza, una cantidad distinta)
    // v3.3: puede tener coma: 1,5 es 1 un turno y 2 el siguiente (lo que sobra se guarda)
    const perTurn = B().manaRegenOf ? B().manaRegenOf(p).turn : 0;
    let mana = Math.floor(perTurn + 1e-9);
    if (perTurn - mana > 1e-9 && p.hasMagic && c.round > 1) {
      const used = c.passives || (c.passives = {});
      const k = `manaFrac:${c.party ? hidOf(p) : 'p'}`;
      used[k] = (used[k] || 0) + (perTurn - mana);
      if (used[k] >= 1 - 1e-9) { mana += 1; used[k] -= 1; }
    }
    if (mana > 0 && p.hasMagic && p.mana < p.maxMana && c.round > 1) {
      const before = p.mana;
      A.State.setMana(Math.min(p.maxMana, p.mana + mana));
      addLog(c, 'system', { text: `Recuperás ${p.mana - before} de maná.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: 0, mana: p.mana - before, quiet: true } });
    }
  }

  /** v2.5: Regeneración de criaturas y mascotas al empezar su turno (el fuego la frena). */
  function creatureTurnPassives(c, kind, x) {
    if (!A.Skills || !x) return;
    tailPassive(c, kind, x);
    const n = A.Skills.regenOf(x);
    if (!n) return;
    const isPetX = kind === 'pet';
    const noun = A.Skills.noun(x);
    if (n < 0) {
      if (!x._regenBlockSaid) {
        x._regenBlockSaid = true;
        addLog(c, 'system', { text: `${targetName(x)} no se regenera: está en llamas.`, fx: { kind: 'note' }, say: { text: `El fuego no deja que ${noun} se regenere.`, tone: isPetX ? 'bad' : 'good' } });
      }
      return;
    }
    const hp = isPetX ? x.health : x.hp;
    const max = isPetX ? x.maxHealth : x.maxHp;
    if (hp <= 0 || hp >= max) return;
    const got = Math.min(n, max - hp);
    if (isPetX) x.health += got; else x.hp += got;
    x._regenUsed = (x._regenUsed || 0) + got; // tope por pelea
    addLog(c, 'system', {
      text: `${targetName(x)} se regenera: +${got}.`,
      fx: { kind: 'heal', actor: fxKey(x), target: fxKey(x), amount: got, skill: 'regeneracion' },
      say: { text: `Las heridas de ${noun} se cierran solas: recupera ${got} de vida.`, tone: isPetX ? 'good' : 'bad' },
    });
  }

  /** v3.8: Colas de zorro: le crece una cola por turno; con nueve despierta. */
  function tailPassive(c, kind, x) {
    if (!A.Skills.growTails) return;
    const g = A.Skills.growTails(x);
    if (!g) return;
    const isPetX = kind === 'pet';
    const noun = A.Skills.noun(x);
    const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);
    if (g.awake) {
      addLog(c, 'system', {
        text: `${targetName(x)} despliega nueve colas${g.heal ? ` y recupera ${g.heal} de vida` : ''}.`,
        fx: g.heal ? { kind: 'heal', actor: fxKey(x), target: fxKey(x), amount: g.heal, skill: 'colas_zorro' } : { kind: 'note', actor: fxKey(x), skill: 'colas_zorro' },
        say: { text: `¡A ${noun} le brota la novena cola! Un fuego azul la envuelve: despierta todo su poder${g.heal ? ` y recupera ${g.heal} de vida` : ''}.`, tone: isPetX ? 'good' : 'bad' },
      });
      return;
    }
    addLog(c, 'system', {
      text: `${targetName(x)}: ${g.tails} colas.`,
      fx: { kind: 'note', actor: fxKey(x), skill: 'colas_zorro' },
      say: { text: `${Noun} sacude el cuerpo y le crece otra cola: ya tiene ${g.tails}.`, tone: isPetX ? 'good' : 'bad' },
    });
  }

  /**
   * v2.5: una criatura llegó a 0. Si tiene Renacer, vuelve (y devuelve false).
   * how: 'player' | 'spell' | 'pet' | 'tick' | 'item' | 'thorns'
   */
  function enemyDown(c, t, how) {
    if (!t || t.hp > 0) return false;
    const saved = A.Skills ? A.Skills.tryRevive(t) : false;
    if (saved === 'aguante') {
      const n = A.Skills.noun(t);
      addLog(c, 'system', {
        text: `${t.displayName} aguanta en pie con 1 de vida.`,
        fx: { kind: 'note', actor: fxKey(t), skill: 'aguante' },
        say: { text: `${n.charAt(0).toUpperCase()}${n.slice(1)} se tambalea… pero aprieta los dientes y sigue en pie con 1 de vida.`, tone: 'bad' },
      });
      return false;
    }
    if (saved) {
      const n = A.Skills.noun(t);
      addLog(c, 'system', {
        text: `${t.displayName} renace con ${t.hp} de vida.`,
        fx: { kind: 'heal', actor: fxKey(t), target: fxKey(t), amount: t.hp, skill: 'renacer' },
        say: { text: `¡${n.charAt(0).toUpperCase()}${n.slice(1)} estalla en llamas y renace de sus cenizas con ${t.hp} de vida!`, tone: 'bad' },
      });
      return false;
    }
    const text = how === 'pet' ? `${t.displayName} cayó por la mascota.` : how === 'tick' ? `${t.displayName} cayó por los efectos.` : `${t.displayName} cayó.`;
    addLog(c, 'system', { text, killed: t.displayName, fx: { kind: 'death', target: fxKey(t) } });
    if (how === 'player' || how === 'item') maybeDropEquippedWeapon(c, t);
    if (t.guardOf) surfaceIfFree(c, t.guardOf);
    return true;
  }

  // ============================================================
  // v3.11: jefes con mecánica propia
  //   Kraken: arranca bajo el agua con 8 tentáculos (2 más por cada héroe extra);
  //   no se le puede pegar hasta cortarlos todos. Mientras tanto, no ataca: lo hacen ellos.
  // ============================================================

  const TENTACLES = { base: 8, perHero: 2, id: 'tentaculo_kraken' };
  function bossOpening(c) {
    for (const boss of c.enemies.slice()) {
      if (boss.hp <= 0 || !(A.Skills && A.Skills.has(boss, 'ocho_tentaculos'))) continue;
      const heroes = c.party ? heroesOf(c).length : 1;
      const n = TENTACLES.base + TENTACLES.perHero * Math.max(0, heroes - 1);
      let made = 0;
      for (let i = 0; i < n; i++) {
        const t = summonEnemy(c, boss, TENTACLES.id, {});
        if (!t) break;
        t.guardOf = boss.instanceId;
        made += 1;
      }
      if (!made) continue;
      boss.submerged = true;
      addLog(c, 'system', {
        text: `${boss.displayName} se hunde: salen ${made} tentáculos del agua.`,
        fx: { kind: 'summon', actor: fxKey(boss) },
        say: { text: `El agua hierve y ${made} tentáculos gigantes se levantan alrededor tuyo. ${boss.displayName} se queda abajo, en lo hondo: no vas a poder pegarle hasta cortarlos a todos.`, tone: 'bad' },
      });
    }
  }
  function surfaceIfFree(c, bossId) {
    const boss = c.enemies.find((e) => e.instanceId === bossId);
    if (!boss || !boss.submerged || boss.hp <= 0) return;
    if (c.enemies.some((e) => e.guardOf === bossId && e.hp > 0)) return;
    boss.submerged = false;
    addLog(c, 'system', {
      text: `¡${boss.displayName} sale a la superficie!`,
      fx: { kind: 'note', actor: fxKey(boss) },
      say: { text: `Sin sus tentáculos, ${A.Skills ? A.Skills.noun(boss) : boss.displayName} sale a la superficie, furioso. ¡Ahora sí le podés pegar!`, tone: 'crit' },
    });
    if (!getTarget() || c.targetInstanceId !== boss.instanceId) {
      const tt = c.enemies.find((e) => e.instanceId === c.targetInstanceId && e.hp > 0);
      if (!tt) c.targetInstanceId = boss.instanceId;
    }
  }

  function nextActor() {
    const c = State().combat;
    if (!c) return;
    c.currentActorIdx += 1;
    if (c.currentActorIdx >= c.initiative.length) c.currentActorIdx = c.initiative.length;
    later(c, () => advanceIfNotPlayer(), NEXT_DELAY);
  }

  /** Letras para los repetidos ("Lobo A", "Lobo B"). v2.5: por nombre, así el "Lobo alfa" queda aparte. */
  function assignLabels(instances) {
    const counts = {};
    for (const e of instances) counts[e.name] = (counts[e.name] || 0) + 1;
    const idx = {};
    for (const e of instances) {
      if (counts[e.name] > 1) {
        idx[e.name] = (idx[e.name] || 0) + 1;
        e.label = String.fromCharCode(64 + idx[e.name]);
        e.displayName = `${e.name} ${e.label}`;
      } else {
        e.label = '';
        e.displayName = e.name;
      }
    }
  }

  // ============================================================
  // Objetivo
  // ============================================================

  function setTarget(instanceId) {
    const c = State().combat;
    if (!c) return;
    const t = c.enemies.find((e) => e.instanceId === instanceId && e.hp > 0);
    // v3.11: el Kraken bajo el agua no se puede elegir
    if (t && t.submerged) {
      addLog(c, 'system', { text: `${t.displayName} está bajo el agua: primero hay que cortar sus tentáculos.`, fx: { kind: 'note' }, say: { text: `No llegás a ${A.Skills ? A.Skills.noun(t) : t.displayName}: está bajo el agua. Primero tenés que cortar sus tentáculos.`, tone: 'neutral' } });
      State().persist();
      A.Bus.emit('combat:target-changed', { instanceId: c.targetInstanceId });
      return;
    }
    if (t) {
      c.targetInstanceId = instanceId;
      State().persist();
      A.Bus.emit('combat:target-changed', { instanceId });
    }
  }

  function getTarget() {
    const c = State().combat;
    if (!c) return null;
    let t = c.enemies.find((e) => e.instanceId === c.targetInstanceId && e.hp > 0 && !e.submerged);
    if (!t) {
      t = c.enemies.find((e) => e.hp > 0 && !e.submerged);
      if (t) c.targetInstanceId = t.instanceId;
    }
    return t || null;
  }

  function aliveEnemies() {
    const c = State().combat;
    if (!c) return [];
    return c.enemies.filter((e) => e.hp > 0);
  }
  /** v3.11: las que se pueden atacar (el Kraken bajo el agua, no). */
  function hittableEnemies() { return aliveEnemies().filter((e) => !e.submerged); }

  // ============================================================
  // Acciones del jugador
  // ============================================================

  function playerAttack() { doPlayerAttack(false); }

  /** v2.1.1: Golpe fuerte (guerreros): doble daño y después unos turnos de espera. */
  function powerInfo() {
    const c = State().combat;
    const p = State().player;
    const info = B().warriorPower ? B().warriorPower(p) : null;
    if (!info) return null;
    const wait = c && c.powerCd > 0 ? c.powerCd : 0;
    return { ...info, wait, ready: wait === 0 };
  }
  // ---------- v3.10: técnicas de nacimiento de los guerreros (una vez por pelea) ----------
  function techniqueInfo() {
    const c = State().combat;
    const p = State().player;
    const t = A.Techniques ? A.Techniques.info(p) : null;
    if (!t) return null;
    return { ...t, used: A.Techniques.used(c, p) };
  }
  function playerTechnique() {
    const c = State().combat;
    if (!c || c.result || !isPlayerTurn(c)) return;
    const p = State().player;
    const T = A.Techniques ? A.Techniques.of(p) : null;
    if (!T || A.Techniques.used(c, p)) return;
    A.Techniques.markUsed(c, p);
    const b = A.Techniques.band(p);
    addLog(c, 'player', { text: `${T.name}.`, fx: { kind: 'buff', target: 'player', label: T.name, icon: T.icon }, say: { text: T.say, tone: 'crit' } });
    if (T.buff) {
      const mods = T.buff(b);
      p.effects = (p.effects || []).filter((e) => !(e.type === 'buff' && e.source === T.id));
      p.effects.push({ type: 'buff', source: T.id, name: T.name, mods, turns: T.turns || 2, value: 1, fresh: true });
      // en grupo, a tus compañeros también
      if (T.allies && c.party) {
        for (const h of heroesOf(c)) {
          if (h === p || h.hp <= 0) continue;
          h.effects = (h.effects || []).filter((e) => !(e.type === 'buff' && e.source === `${T.id}:aliado`));
          h.effects.push({ type: 'buff', source: `${T.id}:aliado`, name: T.name, mods: { ...T.allies }, turns: T.turns || 2, value: 1, fresh: true });
        }
      }
      // v3.11 (dossier): el Aullido de manada además llama a un lobo que pelea a tu lado unas rondas
      if (T.wolf) {
        const W = T.wolf;
        const lv = Math.max(1, p.level || 1);
        const wolf = summonAlly(c, p, { kind: 'wolf', species: 'lobo', name: 'Lobo de la manada', hp: W.hp[b], damage: W.dmg[b], attack: W.prec + Math.floor(lv / 3), defense: W.def + Math.floor(lv / 2), attacks: W.attacks[b], speed: 12 });
        addLog(c, 'system', { text: `La manada responde: llega un lobo (${wolf.hp} de vida, ${wolf.damage}, ${wolf.attacksLeft} ataques).`, fx: { kind: 'summon', actor: allyKey(wolf) }, say: { text: `La manada responde al aullido: un lobo sale de entre las sombras y se pone a tu lado. Va a atacar ${wolf.attacksLeft} veces, desde la próxima ronda.`, tone: 'good' } });
      }
      // no gasta el ataque: el guerrero pega igual en este turno
      if (T.free) {
        const target = getTarget();
        if (target) playerStrike(c, p, target, {});
      }
    } else if (T.area) {
      const dice = T.area.dice(b);
      for (const e of hittableEnemies()) {
        const dmg = Math.max(1, A.Utils.rollDice(dice));
        e.hp = Math.max(0, e.hp - dmg);
        addLog(c, 'player', { text: `${T.name}: ${e.displayName} recibe ${dmg} de daño.`, target: e.displayName, dmg, hpAfter: e.hp, hpMax: e.maxHp, result: 'hit', fx: { kind: 'spell', actor: 'player', target: fxKey(e), element: 'shock' }, say: { text: `La descarga sacude a ${A.Skills ? A.Skills.noun(e) : e.displayName}: ${dmg} de daño.`, tone: 'good' } });
        if (e.hp <= 0) enemyDown(c, e, 'player');
        else if (T.area.status) inflict(c, e, T.area.status, { turns: T.area.turns || 2, source: T.id });
      }
    } else if (T.sweep) {
      const foes = hittableEnemies();
      const m = foes.length >= 2 ? T.sweep : (T.sweepSolo || 1);
      for (const e of foes) if (e.hp > 0) playerStrike(c, p, e, { mult: m });
    } else if (T.gore) {
      const target = getTarget();
      if (target) {
        const before = target.hp;
        playerStrike(c, p, target, { mult: T.gore.mult, prec: T.gore.prec, noCharge: true });
        if (target.hp > 0 && target.hp < before && T.gore.status) inflict(c, target, T.gore.status, { turns: T.gore.turns || 2, source: T.id });
      }
    }
    checkEnd();
    if (!c.result) afterPlayerAction();
  }

  function playerPowerAttack() {
    const info = powerInfo();
    if (!info || !info.ready) return;
    doPlayerAttack(true);
  }

  function doPlayerAttack(power) {
    const c = State().combat;
    if (!c || c.result || !isPlayerTurn(c)) return;
    const target = getTarget();
    if (!target) { checkEnd(); return; }
    const p = State().player;
    const pw = power ? (B().warriorPower ? B().warriorPower(p) : null) : null;
    if (pw) c.powerCd = pw.cooldown;
    playerStrike(c, p, target, { pw });
    // v2.4: Guantes del doble golpe: a veces pegás otra vez
    const dbl = A.Accessories ? A.Accessories.bonus(p, 'double') : 0;
    if (dbl > 0 && p.hp > 0 && Math.random() < dbl) {
      const t2 = getTarget();
      if (t2) {
        addLog(c, 'system', { text: '¡Doble golpe!', fx: { kind: 'buff', target: 'player', label: 'Doble golpe', icon: 'swords' }, say: { text: 'Tu brazo es más rápido que su guardia: ¡pegás otra vez!', tone: 'crit' } });
        playerStrike(c, p, t2, {});
      }
    }
    afterPlayerAction();
  }

  /**
   * Un golpe del jugador con el arma (también el doble golpe y el contraataque).
   * opts.pw: golpe fuerte del guerrero · opts.counter: contraataque.
   */
  function playerStrike(c, p, target, opts = {}) {
    const pw = opts.pw || null;
    const st = playerStats();
    const es = enemyStats(target);
    // v3.9: la marca de tu Dardo arcano (solo la tuya) afina la puntería desde el nivel 9
    const mark = P() && P().markOf ? P().markOf(c, p, target) : null;
    // v3.11: Embestida arrolladora: el primer ataque a cada criatura apunta mejor
    const rushP = P() && P().rushPrec ? P().rushPrec(c, p, target) : 0;
    const r = attackRoll(st.attack + (mark ? mark.prec : 0) + (opts.prec || 0) + rushP, es.defense, playerRollOpts(p));
    const weaponName = st.weapon ? st.weapon.name : 'puños';
    if (r.lucky) addLog(c, 'system', { text: 'Suerte: sacaste un 1 y el dado se vuelve a tirar.', fx: { kind: 'passive', passive: 'suerte' } });
    // v2.5: Escurridizo (el primero) y Etéreo (1 de cada 4) hacen fallar un golpe que pegaba.
    // El golpe fuerte del guerrero no se esquiva con esos trucos (ni lo frena un caparazón).
    // (v3.11: la Embestida del minotauro ya no hace que el primer ataque no falle: ver rushBonus)
    const dodge = A.Skills && !pw ? A.Skills.dodgeHit(target, r) : null;
    if (dodge) { r.hit = false; r.crit = false; }

    if (!r.hit) {
      const miss = {
        power: !!pw,
        counter: !!opts.counter,
        text: r.fumble ? `Atacaste a ${target.displayName} pero fallaste por completo` : `${target.displayName} esquivó tu ${pw ? 'golpe fuerte' : 'ataque'}`,
        actor: p.name, target: target.displayName, actorIcon: '', weapon: weaponName,
        roll: r.roll, bonus: st.attack, total: r.total, vs: es.defense, vsLabel: 'defensa',
        result: r.fumble ? 'fumble' : 'evaded',
        fx: { kind: 'attack', actor: 'player', target: fxKey(target) },
      };
      if (dodge) { miss.text = `${target.displayName} evita el golpe (${A.Skills.get(dodge.skill).name}).`; miss.say = { text: dodge.say, tone: 'neutral' }; miss.dodgeSkill = dodge.skill; }
      addLog(c, 'player', miss);
      return r;
    }
    const dmgRoll = rollPlayerDamage(p);
    let rawDmg = dmgRoll.total;
    // v3.3: Cazador de sombras (elfo oscuro): más daño a lo que ya tiene algo malo encima
    const shadow = P() && P().shadowBonusVs ? P().shadowBonusVs(p, target) : 0;
    rawDmg += shadow;
    if (pw) rawDmg *= pw.mult;
    if (opts.mult) rawDmg = Math.max(1, Math.round(rawDmg * opts.mult)); // v3.10: técnicas (barrido, cornada)
    if (r.crit) rawDmg = Math.round(rawDmg * (P() ? P().critMult(p) : 2));
    // v3.9: después del crítico (no se duplican): Frenesí vampírico, forma bestial y la marca del Dardo arcano
    const frenzy = P() && P().frenzyDamage ? P().frenzyDamage(c, p) : 0;
    const beast = P() && P().beastDamage ? P().beastDamage(c, p) : 0;
    const markDmg = mark ? mark.bonus : 0;
    // v3.11 (dossier): también después del crítico: Golpe de gigante (nv 9), Instinto salvaje (uno por turno),
    // Embestida arrolladora (el primero a cada criatura) y la descarga del Núcleo de sobrecarga (cada 2 aciertos)
    const giant = r.crit && P() && P().afterCrit ? P().afterCrit(p) : 0;
    const instinct = !opts.counter && P() && P().instinctBonus ? P().instinctBonus(c, p) : null;
    const rush = P() && P().rushBonus ? P().rushBonus(c, p, target) : 0;
    const core = P() && P().coreHit ? P().coreHit(c, p) : null;
    const extras = [];
    if (frenzy) extras.push({ label: 'Frenesí', n: frenzy });
    if (beast) extras.push({ label: 'bestia', n: beast });
    if (markDmg) extras.push({ label: 'marca', n: markDmg });
    if (giant) extras.push({ label: 'gigante', n: giant });
    if (instinct) extras.push({ label: 'instinto', n: instinct.n });
    if (rush) extras.push({ label: 'embestida', n: rush });
    if (core) extras.push({ label: 'descarga', n: core.main });
    rawDmg += frenzy + beast + markDmg + giant + (instinct ? instinct.n : 0) + rush + (core ? core.main : 0);
    let finalDmg = mitigate(rawDmg, es.armor, r.crit);
    // v2.5: Caparazón / Gelatinoso: el primer golpe hace la mitad (el golpe fuerte lo rompe)
    const soft = A.Skills && !pw ? A.Skills.softenHit(target, finalDmg) : { dmg: finalDmg, skill: null };
    finalDmg = soft.dmg;
    target.hp = Math.max(0, target.hp - finalDmg);
    if (mark) P().consumeMark(target);
    let passive = null;
    if (r.crit && P() && P().has(p, 'golpe_gigante')) passive = 'golpe_gigante';
    else if (r.crit && r.roll < 20 && P() && P().has(p, 'ojo_certero')) passive = 'ojo_certero';
    else if (core) passive = 'cuerpo_metal';
    else if (rush) passive = 'embestida';
    else if (instinct && instinct.angry) passive = 'furia';
    else if (shadow) passive = 'cazador_sombras';
    else if (frenzy) passive = 'colmillos';
    else if (beast) passive = 'sangre_lobo';
    addLog(c, 'player', {
      passive,
      extras: extras.length ? extras : undefined,
      power: !!pw,
      counter: !!opts.counter,
      text: r.crit ? `¡Golpe crítico${pw ? ' y fuerte' : ''} a ${target.displayName}!` : (pw ? `¡Golpe fuerte a ${target.displayName}!` : `Atacaste a ${target.displayName}`),
      actor: p.name, target: target.displayName, actorIcon: '', weapon: weaponName,
      damageDice: dmgRoll.composed.expression,
      damageBreakdown: dmgRoll.composed.components.map((cmp, i) => ({
        label: cmp.label, expr: cmp.expr,
        rolled: dmgRoll.res.components && dmgRoll.res.components[i] ? dmgRoll.res.components[i].rolled : 0,
        icon: cmp.icon,
      })),
      roll: r.roll, bonus: st.attack, total: r.total, vs: es.defense, vsLabel: 'defensa',
      rawDmg, targetArmor: es.armor, dmg: finalDmg, hpAfter: target.hp, hpMax: target.maxHp,
      result: r.crit ? 'crit' : 'hit',
      softened: soft.skill,
      fx: { kind: 'attack', actor: 'player', target: fxKey(target) },
    });
    // v2.2.1: los híbridos recuperan maná al acertar con el arma
    const moh = B().manaOnHit ? B().manaOnHit(p) : 0;
    if (moh > 0 && p.mana < p.maxMana) {
      const before = p.mana;
      A.State.setMana(Math.min(p.maxMana, p.mana + moh));
      if (p.mana > before) addLog(c, 'system', { text: `Recuperás ${p.mana - before} de maná.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: 0, mana: p.mana - before, quiet: true } });
    }
    // v2.4: Amuleto vampírico: parte del daño vuelve como vida
    const ls = A.Accessories ? A.Accessories.bonus(p, 'lifesteal') : 0;
    if (ls > 0 && p.hp > 0 && p.hp < p.maxHp) {
      const before = p.hp;
      A.State.healHp(Math.max(1, Math.round(finalDmg * ls)));
      if (p.hp > before) addLog(c, 'system', { text: `Robo de vida: +${p.hp - before}.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: p.hp - before }, say: { text: `Tu amuleto bebe de la herida: recuperás ${p.hp - before} de vida.`, tone: 'good' } });
    }
    // v3.11: la descarga del Núcleo de sobrecarga salta a otra criatura (desde el nivel 5)
    if (core) {
      const others = hittableEnemies().filter((e) => e !== target);
      const arcTo = core.arc > 0 && others.length ? others[Math.floor(Math.random() * others.length)] : null;
      addLog(c, 'system', {
        text: `¡Sobrecarga! +${core.main} de daño${arcTo ? ` y ${core.arc} a ${arcTo.displayName}` : ''}.`,
        passive: 'cuerpo_metal',
        fx: { kind: 'buff', target: 'player', label: `¡Sobrecarga! +${core.main}`, icon: 'spark' },
        say: { text: `Tu núcleo se sobrecarga y el golpe suelta una descarga: +${core.main} de daño${arcTo ? `, y un arco eléctrico le salta a ${A.Skills ? A.Skills.noun(arcTo) : arcTo.displayName} (${core.arc})` : ''}.`, tone: 'good' },
      });
      if (arcTo) {
        arcTo.hp = Math.max(0, arcTo.hp - core.arc);
        addLog(c, 'player', { text: `La descarga alcanza a ${arcTo.displayName}: ${core.arc} de daño.`, target: arcTo.displayName, dmg: core.arc, hpAfter: arcTo.hp, hpMax: arcTo.maxHp, result: 'hit', fx: { kind: 'spell', actor: 'player', target: fxKey(arcTo), element: 'shock', chain: true }, say: { text: '', tone: 'good' } });
        if (arcTo.hp <= 0) enemyDown(c, arcTo, 'player');
      }
    }
    // v3.11: Embestida arrolladora: el golpe desequilibra (menos precisión en su próximo ataque; no se suma)
    const stagger = target.hp > 0 && finalDmg >= 0 && P() && P().rushStagger ? P().rushStagger(p) : 0;
    if (stagger > 0) applyStatus(target, 'stagger', { turns: 2, value: stagger, source: 'embestida' });
    if (rush) addLog(c, 'system', { text: `¡Embestida! +${rush} de daño.`, passive: 'embestida', fx: { kind: 'buff', target: 'player', label: `¡Embestida! +${rush}`, icon: 'fist' }, say: { text: `Entrás con los cuernos por delante: la primera embestida contra ${A.Skills ? A.Skills.noun(target) : target.displayName} pega +${rush}${target.hp > 0 ? ' y la deja desequilibrada' : ''}.`, tone: 'good' } });
    if (instinct && instinct.angry) addLog(c, 'system', { text: `Instinto salvaje: +${instinct.n} de daño.`, passive: 'furia', fx: { kind: 'buff', target: 'player', label: `Instinto +${instinct.n}`, icon: 'fist' }, say: { text: `Te hirieron y el instinto salvaje te enciende: ese golpe pega +${instinct.n}.`, tone: 'good' } });
    // v3.9: la marca del Dardo arcano se gasta con este golpe
    if (markDmg > 0) addLog(c, 'system', { text: `Marca arcana: +${markDmg} de daño.`, fx: { kind: 'buff', target: 'player', label: `Marca +${markDmg}`, icon: 'arcane' }, say: { text: `La marca arcana que dejó tu dardo estalla con el golpe: +${markDmg} de daño.`, tone: 'good' } });
    // v3.0 / v3.9: Sed de sangre (vampiro): parte del daño vuelve como vida (más en Frenesí)
    const bite = P() && P().lifestealFrom ? P().lifestealFrom(p, finalDmg, c) : 0;
    if (bite > 0 && p.hp < p.maxHp) {
      const before = p.hp;
      A.State.healHp(bite);
      if (p.hp > before) addLog(c, 'system', { text: `Sed de sangre: +${p.hp - before} de vida.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: p.hp - before, passive: 'colmillos' }, say: { text: `Probás su sangre: recuperás ${p.hp - before} de vida.`, tone: 'good' } });
    }
    // v3.9: cada golpe con arma que hace daño junta una gota de sangre (con tres, Frenesí)
    if (finalDmg > 0 && P() && P().bloodCharge) {
      const bc = P().bloodCharge(c, p);
      if (bc && bc.ready) addLog(c, 'system', { text: 'Tres gotas de sangre: Frenesí en tu próximo turno.', fx: { kind: 'note' }, say: { text: 'Tres gotas de sangre. En tu próximo turno, el Frenesí.', tone: 'good' } });
    }
    if (target.hp > 0 && finalDmg > 0) maybeInflictStatusOnHit(st.weapon, target, c); // v3.9: si la armadura lo paró, no
    // Sangre de dragón: a veces el golpe prende fuego
    if (target.hp > 0 && P() && Math.random() < P().burnChance(p)) {
      if (applyStatus(target, 'fire', { turns: 2, value: P().burnValue(p), source: 'sangre_dragon' })) {
        addLog(c, 'system', { text: `${target.displayName} se prende fuego.`, fx: { kind: 'status', target: fxKey(target), effect: 'fire', passive: 'sangre_dragon' } });
      }
    }
    // v3.3: Cazador de sombras (elfo oscuro): a veces el golpe envenena (y después pega más fuerte)
    if (target.hp > 0 && P() && P().shadowPoison && Math.random() < P().shadowPoison(p)) {
      if (applyStatus(target, 'poison', { turns: 3, value: P().shadowPoisonDmg ? P().shadowPoisonDmg(p) : 1, source: 'cazador_sombras' })) {
        addLog(c, 'system', { text: `El veneno de tu hoja entra en ${target.displayName}.`, fx: { kind: 'status', target: fxKey(target), effect: 'poison', passive: 'cazador_sombras' } });
      }
    }
    // v2.5: tocar a ciertas criaturas duele (Cuerpo de fuego, de hielo, Espinas)
    hitReactions(c, target, 'player');
    if (target.hp <= 0) enemyDown(c, target, 'player');
    return r;
  }

  /** v2.5: lo que le pasa al que golpea con un arma a una criatura con Cuerpo de fuego/hielo o Espinas. */
  function hitReactions(c, target, who) {
    if (!A.Skills || !target) return;
    const re = A.Skills.reactions(target);
    if (!re.burn && !re.chill && !re.thorns && !re.dread) return;
    const p = State().player;
    const victim = who === 'pet' ? p.pet : p;
    if (!victim || (who === 'pet' ? victim.health <= 0 : victim.hp <= 0)) return;
    const n = A.Skills.noun(target);
    const tier = target.tier || 1;
    if (re.burn && Math.random() < re.burn) {
      inflict(c, victim, 'fire', { turns: 1, value: A.Skills.valueFor('fire', tier), source: target.id, say: { text: who === 'pet' ? `${A.Skills.noun(victim).replace(/^./, (ch) => ch.toUpperCase())} se quema al tocar a ${n}.` : `Te quemás al tocar a ${n}.`, tone: 'bad' } });
    }
    if (re.chill && Math.random() < re.chill) {
      inflict(c, victim, 'cold', { turns: 1, value: 1, source: target.id, say: { text: who === 'pet' ? `${A.Skills.noun(victim).replace(/^./, (ch) => ch.toUpperCase())} se congela al tocar a ${n}.` : `El frío de ${n} te sube por los brazos.`, tone: 'bad' } });
    }
    // v3.8: Horror del abismo: tocarlo de cerca da miedo
    if (re.dread && Math.random() < re.dread) {
      inflict(c, victim, 'fear', { turns: 2, value: 1, source: target.id, say: { text: who === 'pet' ? `${A.Skills.noun(victim).replace(/^./, (ch) => ch.toUpperCase())} mira a ${n} de cerca y se encoge de miedo.` : `Al golpearlo ves de cerca a ${n} y un miedo antiguo te paraliza las manos.`, tone: 'bad' } });
    }
    if (re.thorns > 0) {
      if (who === 'pet') {
        victim.health = Math.max(0, victim.health - re.thorns);
        addLog(c, 'system', { text: `${victim.name} se lastima con las espinas (-${re.thorns}).`, fx: { kind: 'tick', target: 'pet', amount: re.thorns, effect: 'bleed', skill: 'espinas', skillOn: fxKey(target) }, say: { text: `${A.Skills.noun(victim).replace(/^./, (ch) => ch.toUpperCase())} se lastima con las espinas de ${n}: ${re.thorns} de daño.`, tone: 'bad' } });
        if (victim.health <= 0) petKnockedOut(c, victim);
      } else {
        const ab = shieldPlayer(c, p, re.thorns, { tick: true });
        A.State.damagePlayer(ab.dmg);
        addLog(c, 'system', { text: `Espinas: -${ab.dmg} de vida.`, fx: { kind: 'tick', target: 'player', amount: ab.dmg, effect: 'bleed', skill: 'espinas', skillOn: fxKey(target) }, say: { text: `Te lastimás con las espinas de ${n}: ${ab.dmg} de daño.`, tone: 'bad' } });
        announceGuard(c, ab.guard);
      }
    }
  }

  function maybeDropEquippedWeapon(c, enemy) {
    if (!enemy.equippedWeapon) return;
    if (Math.random() > 0.20) return;
    const ok = A.State.addItem(enemy.equippedWeapon, 1);
    if (ok) {
      const w = A.Data.getById('weapons', enemy.equippedWeapon);
      if (w) addLog(c, 'loot', { text: `Recogiste ${w.name} de ${enemy.displayName}.`, fx: { kind: 'reward', items: [{ itemId: w.id, qty: 1 }] } });
    }
  }

  /** v3.3: cuántos turnos te faltan para volver a usar un hechizo (0 = listo). */
  function spellWait(c, spell) {
    return c && c.spellCd && spell ? (c.spellCd[spell.id] || 0) : 0;
  }
  /** v3.3: para la pantalla: { wait, ready, hit (0..1 contra tu objetivo), sure } */
  function spellInfo(spellId) {
    const c = State().combat;
    const spell = A.Data.getById('spells', spellId);
    if (!spell) return null;
    const wait = spellWait(c, spell);
    let hit = 1;
    if (spell.damage && !spell.sure) {
      const t = getTarget();
      const def = t ? enemyStats(t).defense : 10;
      hit = B().hitChance(playerStats().attack + (B().SPELL_HIT || 2), def);
    }
    return { wait, ready: wait === 0, hit, sure: !!spell.sure || !spell.damage };
  }

  function playerSpell(spellId, on) {
    const c = State().combat;
    if (!c || c.result || !isPlayerTurn(c)) return;
    const p = State().player;
    if (!p.hasMagic) return;
    const spell = A.Data.getById('spells', spellId);
    if (!spell || !(p.spells || []).includes(spellId)) return;
    // v3.4: el mago necesita su arma de mago (bastón, varita...) puesta para lanzar
    const cast = B().canCast ? B().canCast(p) : { ok: true };
    if (!cast.ok) { addLog(c, 'system', { text: cast.why, fx: { kind: 'note' } }); return; }
    // v3.2: la curación se le puede tirar a tu mascota o a un compañero
    // v3.3: Segundo aliento (selfOnly) solo te cura a vos
    const ally = spell.heal ? allyTarget(spell.selfOnly ? 'self' : on) : null;
    if (spell.heal) {
      if (!ally) return;
      const isPet = ally.kind === 'pet';
      const full = isPet ? ally.ref.health >= ally.ref.maxHealth : ally.ref.hp >= ally.ref.maxHp;
      if (full) {
        addLog(c, 'system', { text: ally.self ? 'Ya tenés la vida completa.' : `${ally.name} ya tiene la vida completa.`, fx: { kind: 'note' } });
        return;
      }
      // v3.3: al caído ya no lo levanta la curación: hace falta una hierba de la vida
      const down = isPet ? (ally.ref.health || 0) <= 0 : (ally.ref.hp || 0) <= 0;
      if (down) {
        addLog(c, 'system', { text: `${ally.name} está ${isPet ? 'inconsciente' : 'caído'}: para levantarlo hace falta una hierba de la vida.`, fx: { kind: 'note' } });
        return;
      }
    }
    if ((p.effects || []).some((e) => e.type === 'silence')) {
      addLog(c, 'system', { text: 'Estás silenciado: no podés lanzar hechizos.', fx: { kind: 'note' } });
      return;
    }
    // v3.3: los hechizos con espera
    const wait = spellWait(c, spell);
    if (wait > 0) {
      addLog(c, 'system', { text: `${spell.name} todavía no: ${wait === 1 ? 'listo en tu próximo turno' : `listo en ${wait} turnos`}.`, fx: { kind: 'note' } });
      return;
    }
    const cost = P() ? P().spellCost(p, spell, c) : spell.manaCost;
    if (p.mana < cost) {
      addLog(c, 'system', { text: `No te alcanza el maná para ${spell.name}.`, fx: { kind: 'note' } });
      return;
    }
    A.State.setMana(p.mana - cost);
    // v3.11: Ingenio (gnomo): el descuento extra de los primeros hechizos caros de la pelea
    if (P() && P().ingenioUse && P().ingenioUse(c, p, spell)) addLog(c, 'system', { text: `Ingenio: ${spell.name} te costó ${cost} de maná.`, passive: 'ingenio', fx: { kind: 'note' }, say: { text: `Tu ingenio encuentra un atajo: ${spell.name.toLowerCase()} te cuesta ${cost} de maná.`, tone: 'good' } });
    if (spell.cooldown > 0) { if (!c.spellCd) c.spellCd = {}; c.spellCd[spell.id] = spell.cooldown; }
    // v3.11: la Llama interior ya no va en el poder (se suma después del crítico, por blanco)
    const power = playerStats().spellPower;
    const flame = spell.damage && P() && P().spellBonus ? P().spellBonus(p, spell) : 0;

    if (spell.heal) {
      // v2.1: la curación suma solo la mitad del poder mágico (si no, con maná que vuelve solo sería vida infinita)
      let heal = A.Utils.rollDice(spell.heal) + Math.floor(power / 2);
      // v3.9: Segundo aliento cura más cuanto más herido estás (se suma una parte de lo que te falta)
      if (spell.healMissing && (!ally || ally.self)) heal += Math.round(Math.max(0, p.maxHp - p.hp) * spell.healMissing);
      const boost = A.Accessories ? A.Accessories.bonus(p, 'heal') : 0; // v2.4: Cruz sagrada
      if (boost > 0) heal = Math.round(heal * (1 + boost));
      // v3.9: Curación también limpia (veneno, sangrado, fuego, frío, maldición)
      let cleansed = [];
      if (spell.cleanse) {
        const who = ally && !ally.self ? ally.ref : p;
        const BAD = ['poison', 'bleed', 'fire', 'cold', 'curse'];
        cleansed = (who.effects || []).filter((e) => BAD.includes(e.type)).map((e) => e.type);
        if (cleansed.length) who.effects = (who.effects || []).filter((e) => !BAD.includes(e.type));
      }
      const cleanTxt = cleansed.length ? ` y le saca ${[...new Set(cleansed)].map((t) => (A.Combat && A.Combat.effectLabel ? A.Combat.effectLabel(t) : t).toLowerCase()).join(' y ')}` : '';
      if (ally && !ally.self) {
        const r = healAlly(ally, heal);
        if (ally.kind === 'pet' && r.revived) petBackInFight(c, ally.owner);
        const who = ally.ownerName ? `${ally.name} (de ${ally.ownerName})` : ally.name;
        addLog(c, 'player', {
          text: `Lanzaste ${spell.name} sobre ${who}: +${r.hp} de vida${r.revived ? ' (se levanta)' : ''}.`,
          fx: { kind: 'heal', actor: 'player', target: ally.key, amount: r.hp },
          say: { text: r.revived ? `Lanzás ${spell.name.toLowerCase()} sobre ${who} y se levanta con ${r.hp} de vida.` : `Lanzás ${spell.name.toLowerCase()} sobre ${who}: recupera ${r.hp} de vida${cleanTxt}.`, tone: 'good' },
        });
      } else {
        const before = p.hp;
        A.State.healHp(heal);
        addLog(c, 'player', { text: `Lanzaste ${spell.name} y recuperaste ${p.hp - before} de salud.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: p.hp - before, icon: '' }, ...(cleanTxt ? { say: { text: `Lanzás ${spell.name.toLowerCase()}: recuperás ${p.hp - before} de vida${cleanTxt.replace(' y le saca', ' y te saca')}.`, tone: 'good' } } : {}) });
      }
    } else if (spell.damage) {
      const targets = spell.area ? hittableEnemies() : [getTarget()].filter(Boolean);
      // v3.3: los hechizos de daño tiran el dado como un arma (con +2): pueden fallar y,
      // con 20, son críticos. Los de área tiran una vez: se compara con la defensa de cada una.
      // v3.9: todos los hechizos de daño tiran el dado (también el Dardo arcano, que antes no fallaba)
      const bonus = playerStats().attack + (B().SPELL_HIT || 2);
      const r = spell.sure ? null : attackRoll(bonus, 0, playerRollOpts(p));
      if (r && r.lucky) addLog(c, 'system', { text: 'Suerte: sacaste un 1 y el dado se vuelve a tirar.', fx: { kind: 'passive', passive: 'suerte' } });
      let landed = 0;
      let drained = 0;
      targets.forEach((t, i) => {
        const def = enemyStats(t).defense;
        // v3.11: el 20 llega siempre; el crítico de 19 (elfo, anillo) solo si llega a la defensa de esta criatura
        const hit = !r || r.roll === 20 || (!r.fumble && r.total >= def);
        const tcrit = !!(r && r.crit && hit);
        const roll = r && i === 0 ? { roll: r.roll, bonus, total: r.total, vs: def, vsLabel: 'defensa' } : {};
        const noun = A.Skills ? A.Skills.noun(t) : t.displayName;
        if (!hit) {
          addLog(c, 'player', {
            text: r.fumble ? `${spell.name} se te escapa de las manos y no le da a nadie` : `${spell.name} no alcanza a ${t.displayName}`,
            actor: p.name, target: t.displayName, actorIcon: '', spell: spell.name,
            ...roll, result: r.fumble ? 'fumble' : 'evaded',
            fx: { kind: 'spell', actor: 'player', target: fxKey(t), element: spellElement(spell), icon: '', miss: true, chain: i > 0 },
            spellId: spell.id,
            say: {
              text: r.fumble ? `Se te traba la palabra: ${spell.name.toLowerCase()} se deshace en el aire.` : `Lanzás ${spell.name.toLowerCase()}, pero ${noun} se corre a tiempo.`,
              tone: 'bad',
            },
          });
          return;
        }
        landed += 1;
        let rawDmg = A.Utils.rollDice(spell.damage) + power;
        // v3.3: Cazador de sombras también con hechizos
        const shadowS = P() && P().shadowBonusVs ? P().shadowBonusVs(p, t) : 0;
        rawDmg += shadowS;
        if (tcrit) rawDmg *= 2;
        rawDmg += flame; // v3.11: Llama interior, después del crítico
        const armor = Math.floor((t.armor || 0) / 2);
        // v3.9: la magia siempre hace al menos 1 (la armadura para golpes, no hechizos)
        const finalDmg = mitigate(rawDmg, armor, true);
        t.hp = Math.max(0, t.hp - finalDmg);
        addLog(c, 'player', {
          text: tcrit ? `¡${spell.name} crítico a ${t.displayName}!` : `${spell.name} hiere a ${t.displayName}`,
          actor: p.name, target: t.displayName, actorIcon: '',
          rawDmg, targetArmor: armor, dmg: finalDmg, hpAfter: t.hp, hpMax: t.maxHp,
          damageDice: power ? `${spell.damage}+${power}` : spell.damage,
          extras: flame ? [{ label: 'llama', n: flame }] : undefined,
          spell: spell.name, ...roll, result: tcrit ? 'crit' : 'hit',
          fx: { kind: 'spell', actor: 'player', target: fxKey(t), element: spellElement(spell), icon: '', crit: tcrit, chain: i > 0 },
          spellId: spell.id,
          ...(shadowS ? { passive: 'cazador_sombras' } : {}),
          ...(tcrit ? { say: { text: `¡${spell.name} le da de lleno a ${noun}: el doble de daño, ${finalDmg}!`, tone: 'crit' } } : {}),
        });
        if (t.hp > 0 && finalDmg > 0) maybeInflictStatusOnHit(spell, t, c);
        // v3.9: el Dardo arcano del humano marca al blanco (su próximo golpe con arma le hace más daño)
        if (t.hp > 0 && spell.id === 'dardo_arcano' && P() && P().has(p, 'determinacion') && P().placeMark) {
          const mk = P().placeMark(c, p, t);
          addLog(c, 'system', { text: `${t.displayName} queda marcado (+${mk.bonus} a tu próximo golpe con arma).`, fx: { kind: 'note' }, say: { text: `El dardo deja una marca arcana en ${noun}: tu próximo golpe con arma le hace +${mk.bonus}${mk.prec ? ' y apuntás mejor' : ''}.`, tone: 'good' } });
        }
        if (t.hp > 0 && spell.stun) stunTarget(c, t, spell.stun, spell); // v3.3: Congelar, Trueno
        else if (t.hp > 0 && spell.stunChance && Math.random() < spell.stunChance) stunTarget(c, t, 1, spell); // v3.3: Enredadera
        drained += finalDmg;
        if (t.hp <= 0) enemyDown(c, t, 'spell');
      });
      const targetsHit = landed;
      // v3.11 (dossier): Polvo de hada: una vez por ronda, el hechizo que le dio a su blanco lo marea
      const mainT = targets[0];
      if (mainT && mainT.hp > 0 && landed > 0 && P() && P().fairyHex) {
        const fh = P().fairyHex(c, p);
        if (fh) {
          applyStatus(mainT, 'stagger', { turns: 2, value: fh.stagger, source: 'polvo_hada' });
          if (fh.expose) applyStatus(mainT, 'exposed', { turns: 1, value: fh.expose, source: 'polvo_hada' });
          const nn = A.Skills ? A.Skills.noun(mainT) : mainT.displayName;
          addLog(c, 'system', { text: `Polvo de hada: ${mainT.displayName} queda mareado (−${fh.stagger} de precisión${fh.expose ? `, −${fh.expose} de defensa` : ''}).`, passive: 'polvo_hada', fx: { kind: 'status', target: fxKey(mainT), effect: 'stagger', passive: 'polvo_hada' }, say: { text: `El polvo de hada que va con tu hechizo marea a ${nn}: su próximo ataque tiene −${fh.stagger} de precisión${fh.expose ? ` y se defiende peor (−${fh.expose})` : ''}.`, tone: 'good' } });
        }
      }
      // v3.11 (dossier): Apoyo orbital: la nave nodriza bombardea con tu hechizo de daño (si está lista)
      if (P() && P().orbitalFire && hittableEnemies().length) orbitalStrike(c, p, mainT);
      // v3.3: Drenar vida: la mitad del daño vuelve como vida
      if (spell.drain && drained > 0 && p.hp < p.maxHp) {
        const before = p.hp;
        A.State.healHp(Math.max(1, Math.floor(drained / 2)));
        if (p.hp > before) addLog(c, 'system', { text: `${spell.name}: +${p.hp - before} de vida.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: p.hp - before }, say: { text: `La vida que le sacás pasa a vos: recuperás ${p.hp - before}.`, tone: 'good' } });
      }
      // v2.1: hechizos que además te curan (Luz sagrada) — v3.3: si pegó
      if (spell.selfHeal && targetsHit && p.hp < p.maxHp) {
        const before = p.hp;
        // v3.9: en Frenesí vampírico, el Toque vampírico cura 1 más
        const frenzyHeal = spell.id === 'toque_vampirico' && P() && P().frenzyOn && P().frenzyOn(c, p) ? (P().TUNE.colmillos.touchHeal || 0) : 0;
        A.State.healHp((Number(spell.selfHeal) || 0) + Math.floor(power / 2) + frenzyHeal);
        if (p.hp > before) addLog(c, 'system', { text: `${spell.name} te devuelve ${p.hp - before} de vida.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: p.hp - before } });
      }
    } else if (spell.effect && A.ItemFx) {
      // v3.3: los hechizos de los pergaminos que no son de daño hacen lo mismo que el pergamino
      const asItem = { id: spell.id, name: spell.name, subtype: 'spell', effect: { ...spell.effect, combat: true } };
      const res = A.ItemFx.useInCombat(c, asItem, itemCtx(c));
      if (!res.ok) {
        // no se pudo (no había a quién apuntarle): no gasta maná ni espera
        A.State.setMana(Math.min(p.maxMana, p.mana + cost));
        if (c.spellCd) delete c.spellCd[spell.id];
        if (res.why) addLog(c, 'system', { text: res.why, fx: { kind: 'note' } });
        State().persist();
        return;
      }
    } else {
      addLog(c, 'player', { text: `Lanzaste ${spell.name}.`, fx: { kind: 'cast', actor: 'player', icon: '' } });
    }
    afterPlayerAction();
  }

  /**
   * v3.11 (dossier): la nave nodriza del alienígena: tu blanco recibe el dado y las demás, un daño fijo.
   * No suma poder mágico, no aplica estados y no la para la armadura (pero hace al menos 1).
   */
  function orbitalStrike(c, p, main) {
    const shot = P().orbitalFire(c, p);
    if (!shot) return;
    const alive = hittableEnemies();
    const first = main && main.hp > 0 ? main : alive[0];
    if (!first) return;
    addLog(c, 'system', { text: '¡Apoyo orbital!', passive: 'mente_expansiva', fx: { kind: 'buff', target: 'player', label: '¡Apoyo orbital!', icon: 'signal' }, say: { text: alive.length > 1 ? 'Tu nave nodriza aparece entre las nubes y bombardea a todas las criaturas.' : 'Tu nave nodriza aparece entre las nubes y bombardea a tu enemigo.', tone: 'crit' } });
    for (const e of alive) {
      if (e.hp <= 0) continue;
      const dmg = Math.max(1, e === first ? A.Utils.rollDice(shot.main) : shot.others);
      e.hp = Math.max(0, e.hp - dmg);
      addLog(c, 'player', { text: `La nave le hace ${dmg} de daño a ${e.displayName}.`, target: e.displayName, dmg, hpAfter: e.hp, hpMax: e.maxHp, result: 'hit', damageDice: e === first ? shot.main : String(shot.others), fx: { kind: 'spell', actor: 'player', target: fxKey(e), element: 'arcane', chain: e !== first }, say: { text: '', tone: 'good' } });
      if (e.hp <= 0) enemyDown(c, e, 'spell');
    }
  }

  /** v3.3: deja a una criatura sin turnos (a los jefes, como mucho uno). */
  function stunTarget(c, t, turns, spell) {
    if (!t || t.hp <= 0) return;
    const n = t.category === 'boss' ? 1 : Math.max(1, turns || 1);
    t.effects = t.effects || [];
    const old = t.effects.find((e) => e.type === 'stun');
    if (old) old.turns = Math.max(old.turns, n);
    else t.effects.push({ type: 'stun', turns: n, value: 1, source: spell.id });
    const noun = A.Skills ? A.Skills.noun(t) : t.displayName;
    addLog(c, 'system', {
      text: `${t.displayName} queda sin moverse (${n === 1 ? 'pierde su próximo turno' : `pierde ${n} turnos`}).`,
      fx: { kind: 'status', target: fxKey(t), effect: 'stun' },
      say: { text: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} queda tieso: ${n === 1 ? 'pierde su próximo turno' : `pierde ${n} turnos`}.`, tone: 'good' },
    });
  }

  /** v2.4: lo que necesita ItemFx para que un objeto actúe en la pelea. */
  function itemCtx(c) {
    return {
      log: (type, payload) => addLog(c, type, payload),
      alive: aliveEnemies,
      target: getTarget,
      fxKey,
      applyStatus,
      effectLabel,
      died: (t) => { enemyDown(c, t, 'item'); },
    };
  }

  /**
   * v3.2: una poción para tu mascota o para un compañero (gasta la poción y tu turno).
   * Devuelve true si se usó.
   */
  function giveItem(c, item, t) {
    const p = State().player;
    if (!A.ItemFx.forOthers || !A.ItemFx.forOthers(item)) {
      addLog(c, 'system', { text: `${item.name} no se le puede dar a otro.`, fx: { kind: 'note' } });
      return false;
    }
    const r = A.ItemFx.restoreOther(p, t, item);
    if (r.why) {
      addLog(c, 'system', { text: r.why, fx: { kind: 'note' } });
      State().persist();
      return false;
    }
    A.State.removeItem(item.id, 1);
    if (t.kind === 'pet' && r.revived) petBackInFight(c, t.owner);
    // v3.3: el compañero que se levanta vuelve a tener turno (su lugar en la ronda sigue ahí)
    if (r.revived && t.kind === 'hero') {
      addLog(c, 'player', {
        text: `Le diste ${item.name} a ${t.name}: se levanta con ${r.hp} de vida.`,
        fx: { kind: 'heal', actor: 'player', target: t.key, amount: r.hp, revive: true },
        say: { text: `Le ponés ${item.name.toLowerCase()} en la boca a ${t.name}: abre los ojos y se levanta con ${r.hp} de vida.`, tone: 'good' },
      });
      return true;
    }
    const word = (x) => String((A.ItemFx.WORD || {})[x] || x).replace(/^(el|la|los|las) /, '');
    const parts = [];
    if (r.hp) parts.push(`+${r.hp} de vida`);
    if (r.mana) parts.push(`+${r.mana} de maná`);
    if (r.cleaned.length) parts.push(`sin ${joinY(r.cleaned.map(word))}`);
    const who = t.ownerName ? `${t.name} (de ${t.ownerName})` : t.name;
    addLog(c, 'player', {
      text: `Le diste ${item.name} a ${who}: ${parts.join(', ')}.`,
      fx: { kind: 'heal', actor: 'player', target: t.key, amount: r.hp, mana: r.mana },
      say: { text: r.revived ? `Usás ${item.name.toLowerCase()} con ${who} y se levanta con ${r.hp} de vida.` : `Usás ${item.name.toLowerCase()} con ${who}: ${parts.join(', ')}.`, tone: 'good' },
    });
    return true;
  }

  /** Usa una poción, comida o pergamino (gasta el turno). Devuelve true si se usó. v3.2: on = a quién. */
  function playerUseItem(itemId, on) {
    const c = State().combat;
    if (!c || c.result) return false;
    if (!isPlayerTurn(c)) {
      addLog(c, 'system', { text: 'Esperá tu turno para usar algo.', fx: { kind: 'note' } });
      return false;
    }
    const item = A.Data.getById('items', itemId);
    if (!item) return false;
    const p = State().player;
    if (!p.inventory.find((s) => s.itemId === itemId)) return false;
    if (!A.ItemFx) return false;
    const ally = on && on !== 'self' && on !== 'player' ? allyTarget(on) : null;
    if (on && on !== 'self' && on !== 'player' && !ally) return false;
    // v3.3: pociones, comida y hierbas no gastan el turno (hasta 3 por turno)
    const free = freeItem(item);
    if (free && (c.itemsTurn || 0) >= FREE_ITEMS) {
      addLog(c, 'system', { text: `Ya usaste ${FREE_ITEMS} objetos en este turno: ahora atacá, lanzá un hechizo o huí.`, fx: { kind: 'note' } });
      State().persist();
      return false;
    }
    if (ally && !ally.self) {
      if (!giveItem(c, item, ally)) return false;
      if (free) { keepTurnAfterItem(c); return true; }
      afterPlayerAction();
      return true;
    }
    const res = A.ItemFx.useInCombat(c, item, itemCtx(c));
    if (!res.ok) {
      if (res.why) addLog(c, 'system', { text: res.why, fx: { kind: 'note' } });
      State().persist();
      return false;
    }
    A.State.removeItem(itemId, 1);
    if (free && !res.escape) { keepTurnAfterItem(c); return true; }
    if (res.escape) {
      // v3.3: en grupo te vas vos solo (los demás siguen); si eras el último en pie, se van todos
      const alone = othersStanding(c, State().player).length > 0;
      addLog(c, 'system', {
        text: alone ? `Rompiste ${item.name} y escapaste. Seguís por tu cuenta.` : `Rompiste ${item.name} y escapaste.`, result: 'hit',
        fx: { kind: 'flee', actor: 'player' },
        say: {
          text: alone
            ? 'Rompés el pergamino: el aire se cierra a tu alrededor y aparecés lejos. Tus compañeros siguen peleando sin vos.'
            : 'Rompés el pergamino: el aire se cierra a tu alrededor y aparecés lejos de la pelea.',
          tone: 'good',
        },
      });
      if (alone) leaveFight(c, State().player);
      else everyoneFlees(c);
      return true;
    }
    afterPlayerAction();
    return true;
  }

  /**
   * Intentar domar desde el combate. Usa el turno: si falla, siguen los enemigos.
   * Solo se puede con el último enemigo en pie.
   */
  function playerTame(instanceId) {
    const c = State().combat;
    if (!c || c.result || !isPlayerTurn(c) || !A.Tame) return null;
    const inst = c.enemies.find((e) => e.instanceId === instanceId && e.hp > 0);
    if (!inst) return null;
    const result = A.Tame.attempt(inst.id, instanceId);
    // v3.9: la doma se ve con su dado (como un ataque): el D20 contra lo que pide la criatura
    if (result && result.roll != null) {
      const n = A.Skills ? A.Skills.noun(inst) : inst.displayName;
      const N = n.charAt(0).toUpperCase() + n.slice(1);
      const it = A.Data.getById('items', A.Tame.requiredItem(inst)) || {};
      addLog(c, 'player', {
        text: `Intentás domar a ${inst.displayName}: D20 ${result.roll} contra ${result.dc}.`,
        roll: result.roll, bonus: 0, total: result.roll, vs: result.dc, vsLabel: 'para domar',
        result: result.success ? 'hit' : 'miss',
        fx: { kind: 'tame', actor: 'player', target: fxKey(inst) },
        say: result.success
          ? { text: `Le ofrecés ${String(it.name || 'comida').toLowerCase()} a ${n}. Duda, huele… y come de tu mano.`, tone: 'good' }
          : { text: `Le ofrecés ${String(it.name || 'comida').toLowerCase()} a ${n}. ${N} la huele, desconfía y te muestra los dientes.`, tone: 'bad' },
      });
    }
    if (result && result.success) {
      endCombatTamed(instanceId);
      return result;
    }
    if (result && result.reason) addLog(c, 'player', { text: `No se pudo domar (${A.Tame.reasonText(result.reason)}).`, fx: { kind: 'note' } });
    if (!result || result.itemConsumed) afterPlayerAction();
    return result;
  }

  // ============================================================
  // v3.3: huir en grupo
  //   El que huye se va solo, con su mascota: deja la pelea y sigue por su
  //   cuenta (se separa del grupo). Los demás siguen peleando contra las
  //   mismas criaturas. Si el que huye era el último en pie, huyen todos
  //   y se llevan a los caídos.
  // ============================================================

  /** Los compañeros que siguen en pie (sin contarte). En solitario, ninguno. */
  function othersStanding(c, p) {
    return c && c.party ? heroesOf(c).filter((h) => h !== p && h.hp > 0) : [];
  }

  /** Te vas de la pelea vos solo: tu turno pasa y los demás siguen. */
  function leaveFight(c, p) {
    const hid = hidOf(p);
    c.fledHids = (c.fledHids || []).concat([hid]);
    p.effects = [];
    if (p.pet) p.pet.effects = [];
    A.Bus.emit('combat:hero-fled', { hid });
    // el grupo se entera (el que huyó sigue por su cuenta; si era el anfitrión, al terminar)
    if (A.Party && A.Party.heroFled) A.Party.heroFled(hid);
    State().persist();
    if (checkEnd()) return;
    nextActor();
  }

  /** Huyen todos (el que huyó era el último en pie): los caídos se levantan con 1 de vida. */
  function everyoneFlees(c) {
    if (c.party) {
      const carried = [];
      for (const h of heroesOf(c)) {
        if (h.hp > 0) continue;
        A.State.withHero(h, () => { h.hp = 1; });
        carried.push(h.name);
      }
      if (carried.length) {
        addLog(c, 'system', {
          text: `Te llevás a ${joinY(carried)} a la rastra (con 1 de vida).`, fx: { kind: 'note' },
          say: { text: `Antes de irte, te cargás a ${joinY(carried)} y ${carried.length > 1 ? 'los' : 'lo'} sacás de ahí.`, tone: 'good' },
        });
      }
    }
    c.result = 'flee';
    A.Bus.emit('combat:ended', { result: 'flee' });
    State().persist();
  }

  /** v2.5: ¿podés intentar huir? { ok, why } (atrapado no se puede). */
  function canFlee() {
    const c = State().combat;
    const p = State().player;
    if (!c || !p) return { ok: false, why: '' };
    if ((p.effects || []).some((e) => e.type === 'grab')) return { ok: false, why: 'Estás atrapado: no podés huir.' };
    if ((c.fleeAttempts || 0) >= 2) return { ok: false, why: 'Ya intentaste huir dos veces.' };
    return { ok: true, why: '' };
  }

  function playerFlee() {
    const c = State().combat;
    if (!c || c.result || !isPlayerTurn(c)) return;
    if ((State().player.effects || []).some((e) => e.type === 'grab')) {
      addLog(c, 'system', { text: 'Estás atrapado: no podés huir.', fx: { kind: 'note' } });
      return;
    }
    if (c.fleeAttempts === undefined) c.fleeAttempts = 0;
    if (c.fleeAttempts >= 2) {
      addLog(c, 'system', { text: 'Ya intentaste huir dos veces: no hay escapatoria.', fx: { kind: 'note' } });
      return;
    }
    c.fleeAttempts += 1;
    const p = State().player;
    const fastest = Math.max(...aliveEnemies().map((e) => e.speed || 10));
    const playerSpeed = effectivePlayerSpeed(p);
    const fleeDC = Math.max(8, Math.min(18, 10 + (fastest - playerSpeed)));
    let fleeRoll = A.Utils.dice(20);
    if (fleeRoll === 1 && P() && P().rerollOnes(p)) {
      addLog(c, 'system', { text: 'Suerte: sacaste un 1 y el dado se vuelve a tirar.', fx: { kind: 'passive', passive: 'suerte' } });
      fleeRoll = A.Utils.dice(20);
    }
    const fleeBonus = Math.floor(playerSpeed / 4);
    const fleeTotal = fleeRoll + fleeBonus;

    if (fleeTotal >= fleeDC) {
      // v3.3: en grupo el que huye se va solo y los demás siguen peleando.
      // Si era el último en pie, huyen todos (y se llevan a los caídos).
      const alone = othersStanding(c, p).length > 0;
      addLog(c, 'system', {
        text: alone ? `Lograste escapar (intento ${c.fleeAttempts}/2). Seguís por tu cuenta.` : `Lograste escapar (intento ${c.fleeAttempts}/2).`,
        roll: fleeRoll, bonus: fleeBonus, total: fleeTotal, vs: fleeDC, vsLabel: 'DC huida', result: 'hit',
        fx: { kind: 'flee', actor: 'player' },
        ...(alone ? { say: { text: 'Salís corriendo y los perdés de vista. Tus compañeros se quedan peleando sin vos.', tone: 'neutral' } } : {}),
      });
      if (alone) leaveFight(c, p);
      else everyoneFlees(c);
      return;
    }
    const remaining = 2 - c.fleeAttempts;
    addLog(c, 'system', {
      text: `Intento de huida fallido (${c.fleeAttempts}/2). ${remaining > 0 ? 'Te queda 1 intento.' : 'No podés volver a intentar.'}`,
      roll: fleeRoll, bonus: fleeBonus, total: fleeTotal, vs: fleeDC, vsLabel: 'DC huida', result: 'miss',
      fx: { kind: 'flee', actor: 'player' },
    });
    const fastestEnemy = aliveEnemies().reduce((a, b) => ((b.speed || 0) > (a.speed || 0) ? b : a));
    if (fastestEnemy) {
      addLog(c, 'system', { text: `${fastestEnemy.displayName} aprovecha tu fallo y te ataca.` });
      enemyStrike(c, fastestEnemy, { forcePlayer: true, free: true });
    }
    if (p.hp <= 0) {
      // v3.0: en grupo, si queda alguien en pie la pelea sigue
      if (checkEnd()) return;
      afterPlayerAction();
      return;
    }
    afterPlayerAction();
  }

  /** v3.3: usaste una poción, comida o hierba: el turno sigue siendo tuyo. */
  function keepTurnAfterItem(c) {
    c.itemsTurn = (c.itemsTurn || 0) + 1;
    State().persist();
    if (checkEnd()) return;
    A.Bus.emit('combat:turn', { actor: 'player', round: c.round, keep: true });
  }

  function afterPlayerAction() {
    const c = State().combat;
    if (!c) return;
    if (A.ItemFx) A.ItemFx.tickBuffs(State().player); // v2.4: las mejoras duran tantos turnos tuyos
    State().persist();
    A.Bus.emit('combat:action', { actor: 'player' });
    if (checkEnd()) return;
    nextActor();
  }

  // ============================================================
  // Mascota
  // ============================================================

  function petKnockedOut(c, pet) {
    pet.health = 0;
    pet.effects = [];
    addLog(c, 'system', { text: `${pet.name} cayó inconsciente. Despierta con una poción o descansando.`, fx: { kind: 'death', target: 'pet' } });
    A.Bus.emit('pet:knocked-out', { name: pet.name });
  }

  /** Elige objetivo: el mismo que el jugador; si no está vivo, el de menos vida. */
  function petTarget() {
    const alive = hittableEnemies();
    if (!alive.length) return null;
    const c = State().combat;
    const focus = alive.find((e) => e.instanceId === c.targetInstanceId);
    if (focus) return focus;
    return alive.slice().sort((a, b) => a.hp - b.hp)[0];
  }

  function executePetAction() {
    const c = State().combat;
    if (!c || c.result) return;
    const pet = State().player.pet;
    if (!pet || pet.health <= 0) { nextActor(); return; }
    const target = petTarget();
    if (!target) { nextActor(); return; }
    // v2.5: a veces usa una habilidad de su especie (mordida, aliento, telaraña...)
    const usedSkill = A.Skills ? A.Skills.petTurn(c, pet, target) : false;
    if (!usedSkill) petStrike(c, pet, target, {});
    State().persist();
    A.Bus.emit('combat:action', { actor: 'pet' });
    if (checkEnd()) return;
    nextActor();
  }

  /** Daño de un golpe de la mascota (con hambre pega la mitad; Furia de su especie). */
  function rollPetDamage(pet, mult = 1) {
    const fx = B().statusMods(pet);
    let raw = rollDamage(pet.damage) - (fx.damagePenalty || 0);
    if (A.Skills) raw *= A.Skills.damageMult(pet);
    if (A.Skills && A.Skills.bonusDamage) raw *= A.Skills.bonusDamage(pet).mult; // v3.8: colas
    raw *= mult || 1;
    if (pet.food != null && pet.food <= 0) raw = raw / 2;
    return Math.max(1, Math.round(raw));
  }

  /**
   * v2.5: un golpe de la mascota. opts: atkMod, mult, pierce, say(kind, info), onHit(info).
   * Devuelve { hit, crit, dmg }.
   */
  function petStrike(c, pet, target, opts = {}) {
    const ps = petStats(pet);
    const es = enemyStats(target);
    const atk = ps.attack + (opts.atkMod || 0);
    const r = attackRoll(atk, es.defense);
    const hungry = (pet.food != null && pet.food <= 0);
    const dodge = A.Skills ? A.Skills.dodgeHit(target, r, pet) : null;
    if (dodge) { r.hit = false; r.crit = false; }

    if (!r.hit) {
      const miss = {
        text: r.fumble ? `${pet.name} ataca a ${target.displayName} pero falla` : `${target.displayName} esquivó el ataque de ${pet.name}`,
        actor: pet.name, target: target.displayName, actorIcon: '',
        roll: r.roll, bonus: atk, total: r.total, vs: es.defense, vsLabel: 'defensa',
        result: r.fumble ? 'fumble' : 'evaded',
        fx: { kind: 'attack', actor: 'pet', target: fxKey(target) },
      };
      if (dodge) miss.say = { text: dodge.say.replace(/^Tu golpe/, 'El golpe'), tone: 'neutral' };
      else if (typeof opts.say === 'function' && !r.fumble) { const ms = opts.say('miss', {}); if (ms) miss.say = ms; } // v3.9: la activa que falla también se nombra
      addLog(c, 'pet', miss);
      return { hit: false };
    }
    let rawDmg = rollPetDamage(pet, opts.mult || 1);
    if (r.crit) rawDmg *= 2;
    let finalDmg = mitigate(rawDmg, opts.pierce ? 0 : es.armor, r.crit);
    const soft = A.Skills ? A.Skills.softenHit(target, finalDmg) : { dmg: finalDmg, skill: null };
    finalDmg = soft.dmg;
    target.hp = Math.max(0, target.hp - finalDmg);
    const entry = {
      text: (r.crit ? `${pet.name} golpea CRÍTICO a ${target.displayName}` : `${pet.name} ataca a ${target.displayName}`) + (hungry ? ' (con hambre, pega la mitad)' : ''),
      actor: pet.name, target: target.displayName, actorIcon: '', damageDice: pet.damage,
      roll: r.roll, bonus: atk, total: r.total, vs: es.defense, vsLabel: 'defensa',
      rawDmg, targetArmor: opts.pierce ? 0 : es.armor, dmg: finalDmg, hpAfter: target.hp, hpMax: target.maxHp,
      result: r.crit ? 'crit' : 'hit',
      softened: soft.skill,
      fx: { kind: 'attack', actor: 'pet', target: fxKey(target) },
    };
    const s = typeof opts.say === 'function' ? opts.say('hit', { crit: r.crit, dmg: finalDmg }) : null;
    if (s && finalDmg > 0) entry.say = s; // v3.9: si la armadura lo paró, lo cuenta el narrador
    addLog(c, 'pet', entry);
    if (opts.onHit && target.hp > 0) opts.onHit({ dmg: finalDmg, crit: r.crit });
    hitReactions(c, target, 'pet');
    if (target.hp <= 0) enemyDown(c, target, 'pet');
    return { hit: true, crit: r.crit, dmg: finalDmg };
  }

  // ============================================================
  // v3.11 (dossier): aliados invocados — el lobo del Aullido de manada
  // No es una mascota: no ocupa su lugar, no come ni sube de nivel, y se va
  // cuando termina la pelea, cuando cae o cuando hizo sus ataques.
  // Ataca al blanco de su dueño; las criaturas lo pueden atacar.
  // ============================================================

  const ALLY_TARGET_CHANCE = 0.30;
  function allyKey(a) { return `ally:${a.aid}`; }
  function allyOwnerKey(c, h) { return c && c.party ? hidOf(h) : 'solo'; }
  /** Los aliados invocados de un héroe que siguen en la pelea. */
  function alliesOf(c, h) {
    if (!c || !c.allies || !h) return [];
    const k = allyOwnerKey(c, h);
    return c.allies.filter((a) => a.owner === k && a.hp > 0 && a.attacksLeft > 0);
  }
  /** spec: { kind, species, name, hp, damage, attack, defense, attacks, speed } */
  function summonAlly(c, owner, spec) {
    const k = allyOwnerKey(c, owner);
    // no se juntan dos del mismo dueño: el nuevo reemplaza al anterior
    c.allies = (c.allies || []).filter((a) => !(a.owner === k && a.kind === spec.kind));
    c.allySeq = (c.allySeq || 0) + 1;
    const a = {
      aid: `a${c.allySeq}`, kind: spec.kind, species: spec.species, owner: k, ownerName: owner.name,
      name: spec.name, hp: spec.hp, maxHp: spec.hp, damage: spec.damage, attack: spec.attack, defense: spec.defense,
      armor: 0, attacksLeft: spec.attacks, maxAttacks: spec.attacks, born: c.round, effects: [],
    };
    c.allies.push(a);
    c.initiative.push({ kind: 'ally', id: allyKey(a), aid: a.aid, hid: c.party ? hidOf(owner) : undefined, name: a.name, speed: spec.speed || 12, tieRoll: 0 });
    return a;
  }

  function executeAllyAction(a) {
    const c = State().combat;
    if (!c || c.result) return;
    if (!a || a.hp <= 0 || a.attacksLeft <= 0) { nextActor(); return; }
    const target = petTarget();
    if (!target) { nextActor(); return; }
    allyStrike(c, a, target);
    a.attacksLeft -= 1;
    if (a.attacksLeft <= 0 && a.hp > 0 && !c.result) {
      addLog(c, 'system', { text: `${a.name} se va.`, fx: { kind: 'death', target: allyKey(a) }, say: { text: `Cumplida su parte, ${lowerFirst(a.name)} aúlla una vez más y se pierde entre las sombras.`, tone: 'neutral' } });
    }
    State().persist();
    A.Bus.emit('combat:action', { actor: 'ally' });
    if (checkEnd()) return;
    nextActor();
  }
  function lowerFirst(t) { return String(t).charAt(0).toLowerCase() + String(t).slice(1); }

  /** El golpe de un aliado invocado (como el de una mascota, sin habilidades). */
  function allyStrike(c, a, target) {
    const es = enemyStats(target);
    const r = attackRoll(a.attack, es.defense);
    const dodge = A.Skills ? A.Skills.dodgeHit(target, r, { name: a.name, species: a.species, id: a.species }) : null;
    if (dodge) { r.hit = false; r.crit = false; }
    const n = A.Skills ? A.Skills.noun(target) : target.displayName;
    const base = { actor: a.name, target: target.displayName, roll: r.roll, bonus: a.attack, total: r.total, vs: es.defense, vsLabel: 'defensa', fx: { kind: 'attack', actor: allyKey(a), target: fxKey(target) } };
    if (!r.hit) {
      addLog(c, 'pet', { ...base, text: r.fumble ? `${a.name} ataca a ${target.displayName} pero falla` : `${target.displayName} esquivó a ${a.name}`, result: r.fumble ? 'fumble' : 'evaded', say: { text: dodge ? dodge.say : `${a.name} salta sobre ${n}, pero no lo alcanza.`, tone: 'neutral' } });
      return { hit: false };
    }
    let raw = rollDamage(a.damage);
    if (r.crit) raw *= 2;
    let dmg = mitigate(raw, es.armor, r.crit);
    const soft = A.Skills ? A.Skills.softenHit(target, dmg) : { dmg, skill: null };
    dmg = soft.dmg;
    target.hp = Math.max(0, target.hp - dmg);
    addLog(c, 'pet', {
      ...base, text: `${a.name} ${r.crit ? 'muerde CRÍTICO a' : 'muerde a'} ${target.displayName}`,
      damageDice: a.damage, rawDmg: raw, targetArmor: es.armor, dmg, hpAfter: target.hp, hpMax: target.maxHp, result: r.crit ? 'crit' : 'hit', softened: soft.skill,
      say: { text: dmg > 0 ? `${a.name} ${r.crit ? 'se prende del cuello de' : 'muerde a'} ${n}: ${dmg} de daño.` : `${a.name} muerde a ${n}, pero no le hace nada.`, tone: r.crit ? 'crit' : 'good' },
    });
    if (target.hp <= 0) enemyDown(c, target, 'pet');
    return { hit: true, crit: r.crit, dmg };
  }

  /** Una criatura ataca a un aliado invocado (sin estados ni robo: cae o no cae). */
  function strikeAlly(c, enemy, a, opts = {}) {
    const es = enemyStats(enemy);
    const atk = es.attack + (opts.atkMod || 0);
    const r = attackRoll(atk, a.defense);
    if ((enemy.effects || []).some((e) => e.type === 'stagger')) removeStatus(enemy, 'stagger');
    const E = A.Narrator && A.Narrator.enemyNoun ? A.Narrator.enemyNoun(enemy) : enemy.displayName;
    const capE = E.charAt(0).toUpperCase() + E.slice(1);
    const base = { actor: enemy.displayName, target: a.name, roll: r.roll, bonus: atk, total: r.total, vs: a.defense, vsLabel: 'defensa', skill: opts.skill || null, fx: { kind: 'attack', actor: fxKey(enemy), target: allyKey(a) } };
    if (!r.hit) {
      addLog(c, 'enemy', { ...base, text: `${enemy.displayName} ataca a ${a.name} pero falla`, result: r.fumble ? 'fumble' : 'evaded', say: { text: `${capE} se tira sobre ${lowerFirst(a.name)}, que lo esquiva de un salto.`, tone: 'good' } });
      return { hit: false, toPet: false, toAlly: true };
    }
    let raw = rollEnemyDamage(enemy, { mult: opts.mult || 1 });
    if (r.crit) raw *= 2;
    const dmg = mitigate(raw, opts.pierce ? 0 : a.armor, r.crit);
    a.hp = Math.max(0, a.hp - dmg);
    addLog(c, 'enemy', { ...base, text: `${enemy.displayName} hiere a ${a.name}`, damageDice: enemy.damage, rawDmg: raw, targetArmor: a.armor, dmg, hpAfter: a.hp, hpMax: a.maxHp, result: r.crit ? 'crit' : 'hit', say: { text: `${capE} ${r.crit ? 'destroza' : 'hiere'} a ${lowerFirst(a.name)}: ${dmg} de daño.`, tone: 'bad' } });
    if (a.hp <= 0) addLog(c, 'system', { text: `${a.name} cayó.`, fx: { kind: 'death', target: allyKey(a) }, say: { text: `${a.name} cae y se deshace en sombras.`, tone: 'bad' } });
    return { hit: true, crit: r.crit, dmg, toPet: false, toAlly: true };
  }

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
    const targetPet = opts.forcePet ? true : (!opts.forcePlayer && petUp && Math.random() < PET_TARGET_CHANCE);
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
    const enemyIcon = '';
    const damageNotation = enemy.damage;
    const E = A.Narrator && A.Narrator.enemyNoun ? A.Narrator.enemyNoun(enemy) : enemy.displayName;
    const capE = E.charAt(0).toUpperCase() + E.slice(1);
    const sayFn = typeof opts.say === 'function' ? opts.say : null;

    if (!r.hit) {
      const missEntry = {
        passive: lucky ? 'suerte' : null,
        skill: opts.skill || null,
        text: r.fumble ? `${enemy.displayName} ataca a ${targetName} pero falla por completo` : lucky ? `¡Suerte! El golpe de ${enemy.displayName} pasa de largo` : unseen ? `${enemy.displayName} no te encuentra` : `${enemy.displayName} ataca pero ${targetName} esquiva`,
        actor: enemy.displayName, target: targetName, actorIcon: enemyIcon,
        roll: r.roll, bonus: atk, total: r.total, vs: defense, vsLabel: 'defensa',
        result: r.fumble ? 'fumble' : 'evaded',
        fx: { kind: 'attack', actor: fxKey(enemy), target: targetPet ? 'pet' : 'player' },
      };
      if (opts.label) missEntry.text += ` (${opts.label})`;
      if (petDodge) { missEntry.say = { text: petDodge.say, tone: 'good' }; missEntry.dodgeSkill = petDodge.skill; missEntry.result = 'evaded'; }
      else if (unseen && !r.fumble) missEntry.say = { text: `${capE} te busca, pero no te ve: el golpe pasa de largo.`, tone: 'good' };
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
    // v2.5: a veces usa una habilidad (si no, el ataque de siempre)
    const usedSkill = A.Skills ? A.Skills.enemyTurn(c, enemy) : false;
    if (!usedSkill) enemyStrike(c, enemy);
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
    const ab = shieldPlayer(c, p, Math.max(0, dmg));
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
    if (opts.weak) { inst.maxHp = Math.max(1, Math.round(inst.maxHp * 0.6)); inst.hp = inst.maxHp; inst.name = `${inst.name} joven`; }
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

  // ============================================================
  // Resultado
  // ============================================================

  /** XP, subida de nivel, XP de mascota y loot de los enemigos indicados. */
  function grantRewards(c, defeated) {
    const p = A.State.player;
    const acc = (k) => (A.Accessories ? A.Accessories.bonus(p, k) : 0);
    const EL = B().ELITE || { xp: 1, coin: 1, drop: 1 };
    // v3.3: en grupo cada uno gana lo mismo que si hubiera peleado solo: lo que dan las
    // criaturas "de la pelea de uno" (las que se sumaron por ser más no dan premio extra).
    // Antes se repartía (v3.2) y en grupos grandes se tardaba mucho en subir de nivel.
    const share = 1;
    const pool = c && c.party
      ? defeated.slice().sort((a, b) => (a._copy ? 1 : 0) - (b._copy ? 1 : 0)).slice(0, c.baseCount || defeated.length)
      : defeated;
    // v2.5: la élite da más; lo invocado, la mitad de XP y nada de botín
    const xpMult = (e) => (e.elite ? EL.xp : 1) * (e.summoned ? 0.5 : 1) * (e.shiny ? 2 : 1) * (e.miniBoss ? 2.5 : 1); // v3.9: la brillante, el doble · v3.11.1: mini jefe ×2,5
    let totalXp = 0;
    // v3.0: la experiencia depende también de la diferencia de nivel (ver Progression.levelGapMult)
    for (const e of pool) totalXp += Math.round(A.Progression.xpForEnemy(e) * xpMult(e) * (A.Progression.levelGapMult ? A.Progression.levelGapMult(p.level, e.tier) : 1));
    totalXp = Math.round(totalXp * share);
    // v2.4: Amuleto de sabiduría
    if (acc('xp') > 0) totalXp = Math.round(totalXp * (1 + acc('xp')));
    if (totalXp > 0) {
      p.xp = (p.xp || 0) + totalXp;
      addLog(c, 'system', { text: `Ganaste ${totalXp} XP.`, fx: { kind: 'reward', xp: totalXp } });
      A.Bus.emit('player:xp-changed', { current: p.xp, toNext: A.Progression.xpForLevel(p.level + 1) });
      for (const lv of A.Progression.checkLevelUp(p)) {
        addLog(c, 'system', { text: `¡Subiste al nivel ${lv.level}! ${lv.text}. Te recuperás por completo.`, fx: { kind: 'reward', levelUp: lv.level } });
        A.State.addChronicle({ type: 'system', text: `¡Subiste al nivel ${lv.level}! ${lv.text}.` });
        A.Bus.emit('player:leveled', { newLevel: lv.level });
      }
    }

    // Mascota: gana la mitad de la XP si terminó consciente
    const pet = p.pet;
    // v3.9: con hambre no aprende nada
    if (pet && pet.health > 0 && totalXp > 0 && pet.food != null && pet.food <= 0) addLog(c, 'system', { text: `${pet.name} no ganó experiencia: tenía hambre.`, fx: { kind: 'note' }, say: { text: `${pet.name} peleó con la panza vacía: no aprende nada esta vez.`, tone: 'bad' } });
    else if (pet && pet.health > 0 && totalXp > 0 && A.Tame && A.Tame.addPetXp) {
      const petXp = Math.floor(totalXp / 2);
      addLog(c, 'system', { text: `${pet.name} ganó ${petXp} XP.`, fx: { kind: 'reward', petXp } });
      for (const msg of A.Tame.addPetXp(pet, petXp)) addLog(c, 'system', { text: msg, fx: { kind: 'note' } });
    }

    // Loot
    let totalCoins = 0;
    const aggregated = {};
    // v2.4: Talismán de la fortuna y Trébol; y lo que pide una misión en curso cae más seguido
    const goldMult = 1 + acc('gold');
    // v3.9: las brillantes dejan una gema (según su nivel) y el triple de monedas
    const SHINY_GEMS = [['perla_pequeña', 'fragmento_cuarzo'], ['mat_amatista', 'mat_topacio'], ['mat_rubi', 'mat_zafiro', 'mat_esmeralda']];
    for (const inst of defeated) {
      if (!inst.shiny || inst.summoned) continue;
      const band = (inst.tier || 1) <= 3 ? 0 : (inst.tier || 1) <= 6 ? 1 : 2;
      const pool = SHINY_GEMS[band].filter((id) => A.Inventory.resolveData(id));
      const gem = pool[Math.floor(Math.random() * pool.length)];
      if (gem && A.State.addItem(gem, 1)) {
        const gd = A.Inventory.resolveData(gem);
        addLog(c, 'loot', { text: `${inst.displayName} deja ${gd.name}.`, fx: { kind: 'reward', items: [{ itemId: gem, qty: 1 }] }, say: { text: `Donde cayó ${A.Skills ? A.Skills.noun(inst) : inst.displayName} queda brillando: ${gd.name.toLowerCase()}.`, tone: 'good' } });
      }
    }
    const dropMult = 1 + acc('drops');
    const wanted = A.Quests && A.Quests.wantedItems ? A.Quests.wantedItems() : new Set();
    for (const inst of defeated) {
      const enemyData = A.Data.getById('enemies', inst.id);
      if (!enemyData) continue;
      // v2.5: lo que te robó, vuelve (v3.0: al que se lo robó)
      if (inst.stolen > 0 && (!inst.stolenFrom || !c || !c.party || inst.stolenFrom === hidOf(p))) {
        if (A.Currency && A.Currency.add) A.Currency.add(inst.stolen);
        addLog(c, 'loot', { text: `Recuperás lo que te robó ${inst.displayName}.`, fx: { kind: 'note' }, say: { text: `Recuperás lo que te robó ${A.Skills ? A.Skills.noun(inst) : inst.displayName}: ${A.Narrator ? A.Narrator.coinsInWords(inst.stolen) : inst.stolen}.`, tone: 'good' } });
        inst.stolen = 0;
      }
      if (inst.summoned || !pool.includes(inst)) continue; // lo invocado (y lo que se sumó por ser más) no deja monedas ni botín
      const eliteMult = (inst.elite ? EL.coin : 1) * (inst.shiny ? 3 : 1); // v3.9: brillante, el triple
      const eliteDrop = (inst.elite ? EL.drop : 1) * share;
      // v2.0: cada enemigo suelta monedas SIEMPRE, según su peligro
      const sure = B().Economy && B().Economy.coinsFor ? Math.round(B().Economy.coinsFor(enemyData) * goldMult * eliteMult * share) : 0;
      if (sure > 0) {
        totalCoins += sure;
        if (A.Currency && A.Currency.add) A.Currency.add(sure); else A.State.addItem('coin_copper', sure);
      }
      for (const d of enemyData.drops || []) {
        // las monedas automáticas ya se pagaron arriba; solo cuentan las puestas a mano en el editor
        if (d.itemId === 'coin_copper' && (d.source === 'balance' || d.source === 'auto' || !d.source)) continue;
        let chance = Math.min(0.95, (d.chance || 0) * dropMult * eliteDrop);
        if (wanted.has(d.itemId)) chance = Math.max(chance, QUEST_DROP_CHANCE);
        if (Math.random() >= chance) continue;
        const qMin = Math.max(1, d.qtyMin || 1);
        const qMax = Math.max(qMin, d.qtyMax || qMin);
        const qty = qMin + Math.floor(Math.random() * (qMax - qMin + 1));
        if (d.itemId === 'coin_copper') {
          totalCoins += qty;
          if (A.Currency && A.Currency.add) A.Currency.add(qty); else A.State.addItem(d.itemId, qty);
          continue;
        }
        const ok = A.State.addItem(d.itemId, qty);
        const item = A.Inventory.resolveData ? A.Inventory.resolveData(d.itemId) : A.Data.getById('items', d.itemId);
        if (ok && item) {
          if (!aggregated[d.itemId]) aggregated[d.itemId] = { item, qty: 0 };
          aggregated[d.itemId].qty += qty;
        } else if (!ok) {
          addLog(c, 'loot', { text: 'Hubo botín pero no entró en la mochila.' });
        }
      }
      // v3.0: objetos de misión que suelta esta criatura solo mientras la misión los pide
      for (const itemId of (A.Quests && A.Quests.questDropsFor ? A.Quests.questDropsFor(inst.id) : [])) {
        if (Math.random() >= QUEST_DROP_CHANCE) continue;
        const item = A.Inventory.resolveData ? A.Inventory.resolveData(itemId) : A.Data.getById('items', itemId);
        if (!item) continue;
        if (A.State.addItem(itemId, 1)) {
          if (!aggregated[itemId]) aggregated[itemId] = { item, qty: 0 };
          aggregated[itemId].qty += 1;
        } else {
          addLog(c, 'loot', { text: 'Hubo botín pero no entró en la mochila.' });
        }
      }
    }
    // v3.9: la rata y el loro encuentran monedas de más
    const bondCoins = A.Tame && A.Tame.ownerBond ? A.Tame.ownerBond(State().player).coins : 0;
    if (totalCoins > 0 && bondCoins > 0) {
      const extra = Math.max(1, Math.round(totalCoins * bondCoins));
      A.Currency.add(extra);
      totalCoins += extra;
    }
    if (totalCoins > 0) addLog(c, 'loot', { text: `Recogiste ${A.Narrator ? A.Narrator.coinsInWords(totalCoins) : A.Currency.formatPrice(totalCoins)}.`, fx: { kind: 'reward', coins: totalCoins } });
    const dropList = Object.values(aggregated);
    if (dropList.length > 0) {
      addLog(c, 'loot', {
        text: `Botín: ${dropList.map((d) => (d.qty > 1 ? `${d.item.name} ×${d.qty}` : d.item.name)).join(', ')}`,
        fx: { kind: 'reward', items: dropList.map((d) => ({ itemId: d.item.id, qty: d.qty })) },
      });
    }
    return totalXp;
  }

  function onVictory() {
    const c = State().combat;
    if (!c || c.result) return;
    c.result = 'victory';
    if (A.Time) A.Time.advance(1, 'combat');

    let firstXp = 0;
    // v3.0: cada héroe recibe lo suyo en su contexto (sus misiones, su diario)
    for (const pw of heroesOf(c)) {
      A.State.withHero(pw, () => {
        if (c.party && pw.hp <= 0) {
          pw.hp = 1;
          addLog(c, 'system', { text: `${pw.name} se levanta con 1 de vida.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: 1 }, say: { text: 'Te levantás del suelo con 1 de vida.', tone: 'neutral' } });
        }
        if (A.Survival) A.Survival.applyTurnTick('combat');
        if (A.Tame && A.Tame.consumePetFood) A.Tame.consumePetFood(1);

        const totalXp = grantRewards(c, c.enemies);
        if (pw === State().me()) firstXp = totalXp;
        // v3.11: le ganaste al jefe en su guarida: vuelve al día siguiente
        if (c.lair && A.Lairs && A.Lairs.recordWin) A.Lairs.recordWin(pw, c.lair);

        // v2.1: al ganar, los magos recuperan parte del maná
        const winShare = B().manaRegenOf ? B().manaRegenOf(pw).win : 0;
        if (winShare > 0 && pw.hasMagic && pw.mana < pw.maxMana) {
          const before = pw.mana;
          A.State.setMana(Math.min(pw.maxMana, pw.mana + Math.max(1, Math.round(pw.maxMana * winShare))));
          if (pw.mana > before) addLog(c, 'system', { text: `Recuperás ${pw.mana - before} de maná.`, fx: { kind: 'reward', mana: pw.mana - before } });
        }
        // v2.1.1: los guerreros tienen aguante: al ganar recuperan parte de la vida
        const hpShare = B().hpRegenOf ? B().hpRegenOf(pw).win : 0;
        if (hpShare > 0 && pw.hp > 0 && pw.hp < pw.maxHp) {
          const before = pw.hp;
          A.State.healHp(Math.max(1, Math.round(pw.maxHp * hpShare)));
          if (pw.hp > before) addLog(c, 'system', { text: `Recuperás ${pw.hp - before} de vida.`, fx: { kind: 'reward', hp: pw.hp - before } });
        }

        if (A.State.world && A.State.world.regionId) {
          A.State.incrementRegionEncounters(A.State.world.regionId);
          if (!c.party) addLog(c, 'system', { text: `Encuentros completados aquí: ${A.State.encountersInRegion(A.State.world.regionId)}.` });
        }
        A.State.addChronicle({ type: 'combat', text: `Venciste a ${A.Narrator && A.Narrator.groupPhrase ? A.Narrator.groupPhrase(c.enemies).text : A.Encounter.describeGroup(c.enemies)} (+${totalXp} XP).` });
        // v2.0: para las misiones ("mata 3 esqueletos")
        A.Bus.emit('combat:victory', { enemyIds: c.enemies.map((e) => e.id), regionId: A.State.world ? A.State.world.regionId : null });
      });
    }
    A.Bus.emit('combat:ended', { result: 'victory', xp: firstXp });
    State().persist();
  }

  /** Terminó porque domaste al último enemigo: recompensa por los que cayeron. */
  function endCombatTamed(instanceId) {
    const c = State().combat;
    if (!c || c.result) return;
    c.result = 'tamed';
    if (A.Time) A.Time.advance(1, 'combat');
    const defeated = c.enemies.filter((e) => e.hp <= 0 && e.instanceId !== instanceId);
    const tamer = State().player;
    const tamed = c.enemies.find((e) => e.instanceId === instanceId);
    addLog(c, 'system', { text: `${tamed ? tamed.name : 'La criatura'} ahora te acompaña.`, fx: tamed ? { kind: 'tamed', target: fxKey(tamed) } : undefined });
    // v3.0: lo de los caídos se reparte entre todos
    let xp = 0;
    for (const h of heroesOf(c)) {
      A.State.withHero(h, () => {
        const got = grantRewards(c, defeated);
        if (h === tamer) xp = got;
        if (got > 0) A.State.addChronicle({ type: 'combat', text: `Combate terminado al domar (+${got} XP).` });
      });
    }
    A.Bus.emit('combat:ended', { result: 'tamed', xp });
    State().persist();
  }

  function onDefeat() {
    const c = State().combat;
    if (!c || c.result) return;
    c.result = 'defeat';
    addLog(c, 'system', { text: c.party ? 'Cayeron en combate.' : 'Caíste en combate.', fx: { kind: 'defeat' } });
    // v3.3: nadie te levantó: cada uno tira su dado de rescate. Si sale, alguien te
    // encuentra y te lleva al pueblo; si no, tu aventura termina (A.Death).
    const group = A.Narrator && A.Narrator.groupPhrase ? A.Narrator.groupPhrase(c.enemies).text : A.Encounter.describeGroup(c.enemies);
    const regionId = A.State.world ? A.State.world.regionId : null;
    c.rescue = {};
    for (const p of heroesOf(c)) {
      A.State.withHero(p, () => {
        p.effects = [];
        if (p.pet) p.pet.effects = [];
        const r = A.Death ? A.Death.rescueRoll(p, { regionId, petUp: !!(p.pet && p.pet.health > 0) }) : null;
        if (!r) { // sin el módulo de la muerte: como antes
          p.hp = 1;
          p.mana = Math.floor(p.maxMana / 2);
          A.State.addChronicle({ type: 'combat', text: `Caíste contra ${group}. Despertás de vuelta en el pueblo.` });
          return;
        }
        r.name = p.name; // para contarlo en las otras compus
        c.rescue[hidOf(p)] = r;
        const dice = A.Death.rollText(r);
        addLog(c, 'system', {
          text: r.ok ? `Dado de rescate: ${dice}. ${r.by} te encontró y te llevó al pueblo.` : `Dado de rescate: ${dice}. Nadie te encontró a tiempo.`,
          roll: r.roll, bonus: r.bonus, total: r.total, vs: r.dc, vsLabel: 'rescate', result: r.ok ? 'hit' : 'miss',
          fx: { kind: 'save', actor: 'player', target: 'player', stat: 'ayuda', rescue: true },
          say: {
            text: r.ok
              ? (r.crit ? `${r.by} te encuentra, te cura las heridas y te lleva al pueblo.` : `${r.by} te encuentra tirado y te lleva al pueblo.`)
              : 'Nadie pasa por ahí. Tu aventura termina acá.',
            tone: r.ok ? 'good' : 'bad',
          },
        });
        if (r.ok) {
          p.hp = r.crit ? Math.max(1, Math.round(p.maxHp / 2)) : 1;
          p.mana = Math.floor(p.maxMana / 2);
          A.State.addChronicle({ type: 'combat', text: `Caíste contra ${group}. ${r.by} te encontró y te llevó al pueblo (dado de rescate: ${dice}).` });
        } else {
          A.Death.killHero(p, 'combat', { text: `Caíste contra ${group} y nadie te encontró a tiempo (dado de rescate: ${dice}).`, regionId });
        }
      });
    }
    // el que había huido antes (el anfitrión) no despierta en el pueblo: siguió su camino
    const me = State().me ? State().me() : State().player;
    const hostOut = c.party && (c.fledHids || []).includes(hidOf(me));
    if (!hostOut) {
      A.State.world.regionId = 'pueblo_inicial';
      A.State.traveling = null;
    }
    A.Bus.emit('combat:ended', { result: 'defeat' });
    State().persist();
  }

  function finish() {
    const c = State().combat;
    const heroes = c && c.party ? heroesOf(c) : [State().player];
    for (const p of heroes) {
      if (!p) continue;
      p.effects = [];
      if (p.pet) p.pet.effects = [];
    }
    State().combat = null;
    State().persist();
  }

  // ============================================================
  // Helpers
  // ============================================================

  function addLog(c, type, payload) {
    const entry = { ts: Date.now(), type };
    if (typeof payload === 'string') entry.text = payload;
    else Object.assign(entry, payload);
    // v1.9.1: el narrador cuenta la acción con palabras (se elige una sola vez)
    // v2.4: si la acción trae su propia frase (objetos, accesorios), se usa esa
    if (A.Narrator && !entry.say) {
      try { entry.say = A.Narrator.say(entry, c); } catch (err) { entry.say = null; }
    } else if (entry.say && entry.say.text && A.Narrator && A.Narrator.contract) {
      entry.say.text = A.Narrator.contract(entry.say.text); // "a el orco" -> "al orco"
    }
    // v3.0: en grupo, de quién es la frase ("vos" = ese héroe) y a qué tarjeta va cada efecto
    // (las líneas del grupo entero, como el comienzo de la pelea, no son de nadie)
    if (c.party && !(entry.fx && entry.fx.kind === 'start')) {
      const hid = ctxHid();
      entry.hid = hid;
      if (entry.fx) {
        for (const k of ['actor', 'target', 'from']) {
          if (entry.fx[k] === 'player') entry.fx[k] = `hero:${hid}`;
          else if (entry.fx[k] === 'pet') entry.fx[k] = `pet:${hid}`;
        }
        if (Array.isArray(entry.fx.also)) entry.fx.also = entry.fx.also.map((k) => (k === 'player' ? `hero:${hid}` : k === 'pet' ? `pet:${hid}` : k));
      }
    }
    // v1.9.1: foto de la vida de todos después de esta acción. La vista la usa
    // para no adelantar el resultado mientras el dado todavía rueda.
    entry._hp = hpSnapshot(c);
    c.log.push(entry);
    A.Bus.emit('combat:action', entry);
  }

  function hpSnapshot(c) {
    const snap = {};
    if (c.party) {
      // v3.0: la vida de cada héroe y cada mascota del grupo
      for (const h of heroesOf(c)) {
        const hid = hidOf(h);
        snap[`hero:${hid}`] = h.hp;
        snap[`mana:${hid}`] = h.mana;
        if (h.pet) snap[`pet:${hid}`] = h.pet.health;
      }
    } else {
      const p = State().player;
      snap.player = p.hp;
      snap.mana = p.mana;
      if (p.pet) snap.pet = p.pet.health;
    }
    for (const e of c.enemies || []) snap[fxKey(e)] = e.hp;
    for (const a of c.allies || []) snap[allyKey(a)] = a.hp; // v3.11
    return snap;
  }

  function availableSpells() {
    const p = State().player;
    if (!p.hasMagic) return [];
    return (p.spells || []).map((id) => A.Data.getById('spells', id)).filter(Boolean);
  }

  function availableItems() {
    const p = State().player;
    return (p.inventory || []).filter((s) => {
      const it = A.Data.getById('items', s.itemId);
      return it && (it.subtype === 'potion' || it.subtype === 'food' || it.subtype === 'scroll');
    });
  }

  /** Para la UI: chance de pegarle a un enemigo (0..1). */
  function hitChanceVs(instance) {
    if (!instance) return 0;
    return B().hitChance(playerStats().attack, enemyStats(instance).defense);
  }

  A.Combat = {
    start,
    finish,
    setTarget,
    getTarget,
    aliveEnemies,
    playerAttack,
    playerPowerAttack,
    playerTechnique, techniqueInfo, // v3.10
    powerInfo,
    playerSpell,
    playerUseItem,
    playerTame,
    playerFlee,
    endCombatTamed,
    availableSpells,
    availableItems,
    effectivePlayerSpeed,
    composePlayerDamage,
    applyStatus,
    removeStatus,
    effectLabel,
    hitChanceVs,
    // v2.5
    canFlee,
    enemyStats,
    petStats,
    kit,
    // v3.0: grupo
    heroesOf,
    dropHero,
    isPlayerTurn,
    // v3.2: pociones y curación para la mascota y los compañeros
    allyTargets,
    // v3.3: las criaturas preparadas para el grupo (para mostrarlas antes de pelear)
    prepareGroup,
    // v3.3
    spellInfo,
    FREE_ITEMS,
    freeItem,
    itemsLeft: () => { const c = State().combat; return Math.max(0, FREE_ITEMS - ((c && c.itemsTurn) || 0)); },
    _swapHero: swapHero,
    // v3.11: aliados invocados (lobo del Aullido)
    summonAlly, alliesOf,
    hittableEnemies,
    _checkEnd: checkEnd, // para las pruebas
  };
})(window.Aventurs);
