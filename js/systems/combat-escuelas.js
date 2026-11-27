/* ============================================================
   Aventurs — Pelea (5/8): escuelas de magia, objetos y domar
   La pelea está repartida en js/systems/combat*.js. Cada parte deja sus
   funciones en A._pelea y usa las de las otras por su nombre.
   ============================================================ */

(function (A) {
  'use strict';
  const C = (A._pelea = A._pelea || {});
  const { FREE_ITEMS } = C;
  // De las otras partes
  function State(...a) { return C.State(...a); }
  function P(...a) { return C.P(...a); }
  function freeItem(...a) { return C.freeItem(...a); }
  function hidOf(...a) { return C.hidOf(...a); }
  function heroesOf(...a) { return C.heroesOf(...a); }
  function allyTarget(...a) { return C.allyTarget(...a); }
  function healAlly(...a) { return C.healAlly(...a); }
  function petBackInFight(...a) { return C.petBackInFight(...a); }
  function joinY(...a) { return C.joinY(...a); }
  function fxKey(...a) { return C.fxKey(...a); }
  function isPlayerTurn(...a) { return C.isPlayerTurn(...a); }
  function playerStats(...a) { return C.playerStats(...a); }
  function applyStatus(...a) { return C.applyStatus(...a); }
  function removeStatus(...a) { return C.removeStatus(...a); }
  function effectLabel(...a) { return C.effectLabel(...a); }
  function inflict(...a) { return C.inflict(...a); }
  function enemyDown(...a) { return C.enemyDown(...a); }
  function getTarget(...a) { return C.getTarget(...a); }
  function aliveEnemies(...a) { return C.aliveEnemies(...a); }
  function hittableEnemies(...a) { return C.hittableEnemies(...a); }
  function othersStanding(...a) { return C.othersStanding(...a); }
  function leaveFight(...a) { return C.leaveFight(...a); }
  function everyoneFlees(...a) { return C.everyoneFlees(...a); }
  function keepTurnAfterItem(...a) { return C.keepTurnAfterItem(...a); }
  function afterPlayerAction(...a) { return C.afterPlayerAction(...a); }
  function endCombatTamed(...a) { return C.endCombatTamed(...a); }
  function addLog(...a) { return C.addLog(...a); }

  // ============================================================
  // v3.13: escuelas de raza (dossier, secciones 7 a 9)
  // ============================================================
  function SC() { return A.Schools; }
  function ownerKey(c, p) { return c && c.party ? hidOf(p) : 'solo'; }
  /** Tu sello o tu marca sobre esa criatura (solo la tuya: ni tu mascota ni tus compañeros la usan). */
  function personalMark(c, p, t) {
    if (!c || !t || !t.pmarks || !p) return null;
    const k = ownerKey(c, p);
    const m = t.pmarks[k];
    if (!m) return null;
    if (c.round > m.until) { delete t.pmarks[k]; return null; }
    return m;
  }
  function placePersonalMark(c, p, t, m) {
    t.pmarks = Object.assign({}, t.pmarks || {}, { [ownerKey(c, p)]: { prec: m.prec || 0, dmg: m.dmg || 0, label: m.label || 'marca', until: c.round + (m.turns || 3) } });
  }
  /** Resonancia arcana (humano): cada golpe con arma que acierta suelta un eco mágico. */
  function arcaneEcho(c, p, t) {
    const b = (p.effects || []).find((e) => e.type === 'buff' && e.echo);
    if (!b || !t || t.hp <= 0) return;
    const power = Math.floor((playerStats().spellPower || 0) / 2);
    const raw = A.Utils.rollDice(b.echo) + power;
    const dmg = Math.max(1, raw - Math.floor((t.armor || 0) / 2));
    t.hp = Math.max(0, t.hp - dmg);
    const noun = A.Skills ? A.Skills.noun(t) : t.displayName;
    // (si lo tumba, lo cuenta el golpe que lo trajo)
    addLog(c, 'player', {
      text: `Eco arcano: ${t.displayName} recibe ${dmg} de daño.`, target: t.displayName, dmg, rawDmg: raw, targetArmor: Math.floor((t.armor || 0) / 2), hpAfter: t.hp, hpMax: t.maxHp, result: 'hit',
      damageDice: power ? `${b.echo}+${power}` : b.echo, spell: b.name,
      fx: { kind: 'spell', actor: 'player', target: fxKey(t), element: 'arcane', chain: true },
      say: { text: `Tu arma resuena y un eco arcano golpea a ${noun}: ${dmg} de daño.`, tone: 'good' },
    });
  }
  /** Fortaleza ancestral (enano): el daño que recibís baja (como mucho, a la mitad... y un poco más). */
  function sturdyCut(p, dmg, crit) {
    const cut = A.ItemFx ? (A.ItemFx.buffMods(p).dmgTaken || 0) : 0;
    if (cut <= 0 || dmg <= 0) return dmg;
    const out = Math.round(dmg * (1 - Math.min(0.6, cut)));
    return crit ? Math.max(1, out) : out;
  }
  /** Escamas ardientes / Campo electromagnético: el que te pega de cerca se quema o se electriza. */
  function touchReactions(c, p, enemy, capE) {
    for (const b of (p.effects || [])) {
      if (b.type !== 'buff' || !b.touch || enemy.hp <= 0 || c.result) continue;
      const T = b.touch;
      if (T.zap > 0) {
        enemy.hp = Math.max(0, enemy.hp - T.zap);
        addLog(c, 'system', { text: `${b.name}: ${enemy.displayName} recibe ${T.zap} de daño.`, fx: { kind: 'tick', target: fxKey(enemy), amount: T.zap, effect: 'shock' }, say: { text: `${capE} toca tu campo y se lleva una descarga: ${T.zap} de daño.`, tone: 'good' } });
        if (enemy.hp <= 0) { enemyDown(c, enemy, 'thorns'); continue; }
      }
      if (T.status && Math.random() < (T.chance || 0)) inflict(c, enemy, T.status, { turns: T.turns || 2, value: T.value || 1, source: b.source });
    }
  }
  /** Lo que deja un hechizo de escuela en cada criatura que alcanza (expuesto, maldición, mareo, sello). */
  function schoolOnHit(c, p, spell, t) {
    const b = SC() ? SC().band(p) : 0;
    const noun = A.Skills ? A.Skills.noun(t) : t.displayName;
    if (spell.expose && applyStatus(t, 'exposed', { turns: spell.expose.turns || 2, value: spell.expose.value || 2, source: spell.id })) {
      addLog(c, 'system', { text: `${t.displayName} queda expuesto (−${spell.expose.value} de defensa).`, fx: { kind: 'status', target: fxKey(t), effect: 'exposed' } });
    }
    if (spell.curse) {
      A.Balance.stackEffect(t, 'curse', spell.curse.turns || 2, spell.curse.amount || 1, spell.id); // v3.22.4: se acumula
      addLog(c, 'system', { text: `${t.displayName} queda maldito (−${spell.curse.amount} de precisión y defensa).`, fx: { kind: 'status', target: fxKey(t), effect: 'curse' }, say: { text: `Una sombra se le pega a ${noun}: pega peor y le pegás más fácil.`, tone: 'good' } });
    }
    if (spell.stagger) {
      const v = SC().val(spell.stagger.value, b);
      if (applyStatus(t, 'stagger', { turns: 2, value: v, source: spell.id })) addLog(c, 'system', { text: `${t.displayName} queda mareado (−${v} de precisión en su próximo ataque).`, fx: { kind: 'status', target: fxKey(t), effect: 'stagger' } });
    }
    if (spell.seal) {
      const dmg = SC().val(spell.seal.dmg, b);
      placePersonalMark(c, p, t, { prec: spell.seal.prec, dmg, turns: spell.seal.turns, label: 'sello' });
      addLog(c, 'system', { text: `${t.displayName} queda sellado: tus golpes con arma le pegan con +${spell.seal.prec} de precisión y +${dmg} de daño (${spell.seal.turns} turnos).`, fx: { kind: 'status', target: fxKey(t), effect: 'curse' }, say: { text: `El sello arcano se le clava a ${noun}: este duelo es tuyo.`, tone: 'good' } });
    }
  }
  function isSchoolCast(spell) { return !!(spell && (spell.echo || spell.buff || spell.partyBuff || spell.partyHeal || spell.pact || spell.sleep || spell.hex)); }
  /** Una mejora de escuela sobre un héroe. Si ya tenía la misma (de otro ángel), no se suma: vale la más fuerte. */
  function schoolBuff(h, spell, cfg, b) {
    const mods = {};
    for (const k of Object.keys(cfg.mods || {})) mods[k] = SC().val(cfg.mods[k], b);
    if (cfg.resist) mods.resist = cfg.resist.slice();
    h.effects = h.effects || [];
    const turns = cfg.turns || 3;
    const old = h.effects.find((e) => e.type === 'buff' && e.source === spell.id);
    if (old) return A.Balance.stackBuff(old, mods, turns); // v3.22.4: la mejora se acumula
    const buff = { type: 'buff', source: spell.id, name: spell.name, stat: cfg.stat || Object.keys(mods)[0] || 'damage', mods, turns, value: 1, fresh: true, school: true };
    if (cfg.touch) buff.touch = { status: cfg.touch.status, chance: cfg.touch.chance || 0, turns: cfg.touch.turns || 2, value: SC().val(cfg.touch.value || 1, b), zap: cfg.touch.zap ? SC().val(cfg.touch.zap, b) : 0 };
    if (cfg.echo) buff.echo = cfg.echo;
    h.effects.push(buff);
    return buff;
  }
  /** El texto de una mejora: "+3 de armadura, +2 de precisión..." */
  function buffParts(mods, touch, resist) {
    const parts = [];
    if (mods.armor) parts.push(`+${mods.armor} de armadura`);
    if (mods.defense) parts.push(`+${mods.defense} de defensa`);
    if (mods.precision) parts.push(`+${mods.precision} de precisión`);
    if (mods.damage) parts.push(`+${mods.damage} de daño`);
    if (mods.regen) parts.push(`+${mods.regen} de vida por turno`);
    if (mods.lifesteal) parts.push(`el ${Math.round(mods.lifesteal * 100)}% del daño de tus golpes vuelve como vida`);
    if (mods.reflect) parts.push(`el que te pega recibe el ${Math.round(mods.reflect * 100)}% del golpe`);
    if (mods.dodgeNext) parts.push('el próximo golpe que te apunten falla');
    if (mods.advantage) parts.push('tirás dos dados y te quedás con el mejor');
    if (touch) parts.push('el que te toca se puede prender fuego');
    if (resist) parts.push('el fuego no te toca');
    return parts;
  }
  /**
   * Los hechizos de escuela que no son de daño. Devuelve { ok, why }.
   * v3.14: un hechizo puede tener varias partes (Avatar arcano: eco y mejora; Intervención
   * divina: curación y armadura) y los de daño también pueden traer una (opts.afterDamage).
   */
  function schoolCast(c, p, spell, opts = {}) {
    const b = SC().band(p);
    const power = playerStats().spellPower || 0;
    let ok = false;
    let why = '';
    const after = !!opts.afterDamage;
    if (spell.echo) {
      const dice = SC().val(spell.echo.dice, b);
      schoolBuff(p, Object.assign({}, spell, { id: `${spell.id}:eco` }), { turns: spell.echo.turns || 4, stat: 'damage', echo: dice }, b);
      addLog(c, 'player', { text: `Lanzaste ${spell.name}: tus golpes con arma sueltan un eco arcano (${dice}) por ${spell.echo.turns || 4} turnos.`, fx: { kind: 'buff', actor: 'player', target: 'player', label: spell.name, icon: 'spark' }, say: { text: 'Le cargás magia a tu arma: cada golpe que acierte va a resonar.', tone: 'good' } });
      ok = true;
    }
    if (spell.buff) {
      const bf = schoolBuff(p, spell, spell.buff, b);
      if (spell.buff.resist) for (const t of spell.buff.resist) removeStatus(p, t);
      const parts = buffParts(bf.mods, bf.touch, spell.buff.resist);
      const txt = parts.length ? `${parts.join(', ')} (${bf.turns} turnos)` : `${bf.turns} turnos`;
      addLog(c, 'player', { text: `${ok || after ? spell.name : `Lanzaste ${spell.name}`}: ${txt}.`, fx: { kind: 'buff', actor: 'player', target: 'player', label: spell.name, icon: spell.iconName || 'star' }, say: { text: `${spell.name}: ${txt}.`, tone: 'good' } });
      ok = true;
    }
    if (spell.partyHeal) {
      const cfg = spell.partyHeal;
      const regen = SC().val(cfg.regen, b);
      const healed = [];
      const BAD = ['poison', 'bleed', 'fire', 'cold', 'curse'];
      let cleaned = 0;
      for (const h of heroesOf(c)) {
        if (h.hp <= 0) continue;
        const n = A.Utils.rollDice(cfg.dice) + Math.floor(power / 2);
        const r = healAlly({ kind: 'hero', ref: h }, n);
        if (r.hp > 0) healed.push(`${h === p ? 'vos' : h.name} +${r.hp}`);
        if (cfg.cleanse) { const n0 = (h.effects || []).length; h.effects = (h.effects || []).filter((e) => !BAD.includes(e.type)); cleaned += n0 - h.effects.length; }
        schoolBuff(h, Object.assign({}, spell, { id: `${spell.id}:vida` }), { turns: cfg.turns || 3, stat: 'regen', mods: { regen } }, b);
      }
      addLog(c, 'player', { text: `${ok || after ? spell.name : `Lanzaste ${spell.name}`}${healed.length ? `: ${healed.join(', ')}` : ''}; y +${regen} de vida por turno (${cfg.turns || 3} turnos)${cleaned ? '; se van los estados malos' : ''}.`, fx: { kind: 'heal', actor: 'player', target: 'player', amount: 0 }, say: { text: `Una luz cálida se abre bajo tus pies${heroesOf(c).length > 1 ? ' y los de tu grupo' : ''}: las heridas se cierran${cleaned ? ' y lo malo se va' : ''}.`, tone: 'good' } });
      ok = true;
    }
    if (spell.partyBuff) {
      const who = heroesOf(c).filter((h) => h.hp > 0);
      let last = null;
      for (const h of who) last = schoolBuff(h, spell, spell.partyBuff, b);
      const parts = last ? buffParts(last.mods) : [];
      const txt = `${parts.join(', ')}${who.length > 1 ? ' para todo el grupo' : ''} (${spell.partyBuff.turns || 3} turnos)`;
      addLog(c, 'player', { text: `${ok || after ? spell.name : `Lanzaste ${spell.name}`}: ${txt}.`, fx: { kind: 'buff', actor: 'player', target: 'player', label: spell.name, icon: spell.iconName || 'shield' }, say: { text: who.length > 1 ? `${spell.name} cubre a todo tu grupo: ${parts.join(', ')}.` : `${spell.name} te cubre: ${parts.join(', ')}.`, tone: 'good' } });
      ok = true;
    }
    if (spell.pact) {
      const info = P() && P().bloodInfo ? P().bloodInfo(c, p) : null;
      const cost = Math.max(1, Math.round(p.maxHp * (spell.pact.hpPct || 0.1)));
      if (!P() || !P().startFrenzy) why = 'Tu sangre no responde.';
      else if (info && (info.frenzy > 0 || info.pending)) why = 'Ya estás en Frenesí (o empieza en tu próximo turno).';
      else if (p.hp <= cost) why = `${spell.name}: te falta vida para pagar el pacto.`;
      else {
        A.State.damagePlayer(cost);
        P().startFrenzy(c, p, spell.pact.extra || 0);
        const turnsF = ((P().TUNE.colmillos || {}).turns || 2) + (spell.pact.extra || 0);
        addLog(c, 'player', { text: `Lanzaste ${spell.name}: perdés ${cost} de vida y el Frenesí empieza en tu próximo turno (${turnsF} turnos).`, dmg: cost, fx: { kind: 'buff', actor: 'player', target: 'player', label: spell.name, icon: 'bleed' }, say: { text: `Te abrís una herida y tu sangre responde: en tu próximo turno, el Frenesí (${turnsF} turnos).`, tone: 'crit' } });
        ok = true;
      }
    }
    if (spell.hex) { // Maldición de penumbra (elfo oscuro): maldice a tu blanco sin gastar el turno
      const t = getTarget();
      if (!t) why = 'No hay a quién maldecir.';
      else {
        const amt = SC().val(spell.hex.amount, b);
        A.Balance.stackEffect(t, 'curse', spell.hex.turns || 3, amt, spell.id); // v3.22.4: se acumula
        const noun = A.Skills ? A.Skills.noun(t) : t.displayName;
        addLog(c, 'player', { text: `Lanzaste ${spell.name}: ${t.displayName} queda maldito (−${amt} de precisión y defensa, ${spell.hex.turns || 3} turnos).`, fx: { kind: 'status', target: fxKey(t), effect: 'curse' }, say: { text: `Una sombra se le pega a ${noun}: pega peor y le pegás más fácil.`, tone: 'good' } });
        ok = true;
      }
    }
    if (spell.sleep) {
      const foes = hittableEnemies();
      if (!foes.length) why = 'No hay a quién dormir.';
      else {
        let slept = 0;
        if (!after) addLog(c, 'player', { text: `Lanzaste ${spell.name}.`, fx: { kind: 'cast', actor: 'player', icon: '' }, say: { text: 'Un sueño suave se desparrama sobre tus enemigos.', tone: 'good' } });
        for (const e of foes) {
          if (e.hp <= 0) continue;
          if (e.category === 'boss') {
            applyStatus(e, 'stagger', { turns: 2, value: spell.sleep.bossStagger || 3, source: spell.id });
            addLog(c, 'system', { text: `${e.displayName} no se duerme, pero queda mareado (−${spell.sleep.bossStagger || 3} de precisión).`, fx: { kind: 'status', target: fxKey(e), effect: 'stagger' } });
          } else if (Math.random() < (spell.sleep.chance || 0.5) && !(A.Skills && A.Skills.immune(e, 'stun'))) {
            slept += 1;
            stunTarget(c, e, 1, spell);
          }
        }
        if (!slept && !foes.some((e) => e.category === 'boss')) addLog(c, 'system', { text: 'Nadie se durmió.', fx: { kind: 'note' } });
        ok = true;
      }
    }
    return ok ? { ok: true } : { ok: false, why };
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
    const st = A.Balance.stackEffect(t, 'stun', n, 1, spell.id); // v3.22.4: se acumula (los jefes, igual, un turno)
    if (t.category === 'boss') st.turns = Math.min(st.turns, 1);
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


  Object.assign(C, { SC, ownerKey, personalMark, placePersonalMark, arcaneEcho, sturdyCut, touchReactions, schoolOnHit, isSchoolCast, schoolBuff, buffParts, schoolCast, orbitalStrike, stunTarget, itemCtx, giveItem, playerUseItem, playerTame });
})(window.Aventurs);
