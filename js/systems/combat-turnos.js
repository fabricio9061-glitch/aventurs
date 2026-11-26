/* ============================================================
   Aventurs — Pelea (3/8): turnos: orden, pasivas de cada turno, jefes y objetivos
   La pelea está repartida en js/systems/combat*.js. Cada parte deja sus
   funciones en A._pelea y usa las de las otras por su nombre.
   ============================================================ */

(function (A) {
  'use strict';
  const C = (A._pelea = A._pelea || {});
  const { ENEMY_DELAY, PET_DELAY, NEXT_DELAY } = C;
  // De las otras partes
  function State(...a) { return C.State(...a); }
  function B(...a) { return C.B(...a); }
  function P(...a) { return C.P(...a); }
  function hidOf(...a) { return C.hidOf(...a); }
  function heroesOf(...a) { return C.heroesOf(...a); }
  function heroOfEntry(...a) { return C.heroOfEntry(...a); }
  function pickTargetHero(...a) { return C.pickTargetHero(...a); }
  function later(...a) { return C.later(...a); }
  function fxKey(...a) { return C.fxKey(...a); }
  function start(...a) { return C.start(...a); }
  function targetName(...a) { return C.targetName(...a); }
  function startOfTurn(...a) { return C.startOfTurn(...a); }
  function maybeDropEquippedWeapon(...a) { return C.maybeDropEquippedWeapon(...a); }
  function executePetAction(...a) { return C.executePetAction(...a); }
  function executeAllyAction(...a) { return C.executeAllyAction(...a); }
  function executeEnemyAction(...a) { return C.executeEnemyAction(...a); }
  function summonEnemy(...a) { return C.summonEnemy(...a); }
  function onVictory(...a) { return C.onVictory(...a); }
  function onDefeat(...a) { return C.onDefeat(...a); }
  function addLog(...a) { return C.addLog(...a); }

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
        // v3.11.3: Alamuerte: con la mitad de la vida se le caen las placas
        if (A.Skills && A.Skills.has && A.Skills.has(entity, 'placas_adamantita')) {
          addLog(c, 'system', { text: `A ${entity.displayName} se le caen las placas de metal.`, say: { text: `A ${n} se le caen las placas de metal: ahora los golpes le entran enteros.`, tone: 'good' } });
        }
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
          // v3.13: las técnicas de disciplina también se recargan un turno por vez
          if (c.techCd) {
            for (const k of Object.keys(c.techCd)) {
              c.techCd[k] -= 1;
              if (c.techCd[k] <= 0) delete c.techCd[k];
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
    if (cur.kind === 'enemy') later(c, () => A.State.withHero(pickTargetHero(c, entity), () => executeEnemyAction(entity)), ENEMY_DELAY);
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
    // v3.12: Sumergirse: al empezar su turno sale a la superficie (y ataca)
    if (kind === 'enemy' && x.submerged && x._dived) {
      x.submerged = false; x._dived = false;
      addLog(c, 'enemy', { text: `${x.displayName} sale a la superficie.`, fx: { kind: 'note', actor: fxKey(x) }, say: { text: `${cap1(A.Skills.noun(x))} sale del agua de golpe.`, tone: 'bad' } });
    }
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

  function cap1(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }

  /** v3.12: Sumergirse: después de atacar se hunde, si queda otra a la que pegarle. */
  function maybeDive(c, e) {
    if (!e || e.hp <= 0 || e.submerged || !(A.Skills && A.Skills.has(e, 'sumergirse'))) return;
    if (!hittableEnemies().some((x) => x !== e)) return; // sola no se puede esconder
    e.submerged = true; e._dived = true;
    addLog(c, 'enemy', { text: `${e.displayName} se hunde.`, fx: { kind: 'note', actor: fxKey(e) }, say: { text: `${cap1(A.Skills.noun(e))} se hunde: hasta su próximo turno no se le puede pegar.`, tone: 'bad' } });
  }
  /** v3.12: si ya no queda a quién pegarle, las que se hundieron salen. */
  function surfaceIfNoTargets(c) {
    if (hittableEnemies().length) return;
    for (const e of aliveEnemies()) if (e.submerged && e._dived) {
      e.submerged = false; e._dived = false;
      addLog(c, 'enemy', { text: `${e.displayName} sale a la superficie.`, fx: { kind: 'note', actor: fxKey(e) }, say: { text: `Sin nadie que la cubra, ${A.Skills.noun(e)} tiene que salir del agua.`, tone: 'good' } });
    }
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
    // v3.12: algunos tienen su propia forma de terminar la pelea (Dios no "cae": te da por aprobado)
    const own = (A.Data.getById('enemies', t.id) || {}).defeatText;
    const ownText = own ? own.replace(/\{E\}/g, t.displayName) : '';
    addLog(c, 'system', Object.assign({ text: ownText || text, killed: t.displayName, fx: { kind: 'death', target: fxKey(t) } }, ownText ? { say: { text: ownText, tone: 'good' } } : {}));
    if (how === 'player' || how === 'item') maybeDropEquippedWeapon(c, t);
    if (t.guardOf) surfaceIfFree(c, t.guardOf);
    // v3.12: Dividirse: la primera vez que cae se parte en dos más chicas
    if (A.Skills && A.Skills.has(t, 'dividirse') && !t._split && !t.summoned) {
      const kids = [];
      for (let i = 0; i < 2; i++) { const k = summonEnemy(c, t, t.id, { hp: 0.35 }); if (k) { k._split = true; k.name = `${k.name} (mitad)`; k.displayName = k.name; kids.push(k); } }
      if (kids.length) {
        assignLabels(c.enemies);
        addLog(c, 'enemy', { text: `${t.displayName} se parte en dos.`, fx: { kind: 'summon', actor: fxKey(t), target: fxKey(kids[0]) }, say: { text: `${cap1(A.Skills.noun(t))} se parte en dos y cada mitad sigue peleando.`, tone: 'bad' } });
      }
    }
    // v3.12: Estallido: al caer explota
    if (A.Skills && A.Skills.deathBurst) A.Skills.deathBurst(t);
    surfaceIfNoTargets(c);
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


  Object.assign(C, { addTurnHeader, blessingRound, checkEnd, advanceIfNotPlayer, playerTurnPassives, creatureTurnPassives, cap1, maybeDive, surfaceIfNoTargets, tailPassive, enemyDown, bossOpening, surfaceIfFree, nextActor, assignLabels, setTarget, getTarget, aliveEnemies, hittableEnemies, TENTACLES });
})(window.Aventurs);
