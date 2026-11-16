/* ============================================================
   Aventurs — Explore (v2.0)

   Explorar ya no es "tocar un botón y a veces no pasa nada".
   Cada vez que explorás pasa algo:
     - una CRIATURA: elegís cómo encararla (atacar por sorpresa,
       escabullirte, intentar domarla). Cada opción tiene su tirada.
     - una ESCENA del bioma (js/data/seed-events.js): 2 o 3 opciones,
       con tirada de dado y consecuencias.

   Las tiradas: D20 + tu bonus contra una dificultad.
     Fuerza   - guerreros +3, híbridos +1
     Agilidad - según tu velocidad
     Ingenio  - magos +3, híbridos +1
     Puntería - según tu precisión
     Suerte   - el dado y nada más (el Mediano suma +3)
   Todos suman la mitad de su nivel. La dificultad sube con la zona.

   Descansar también hace siempre algo: de día es una siesta corta
   (y pasa la tarde); de noche dormís hasta la mañana, y en zonas
   peligrosas algo puede acercarse al campamento.

   A.Rewards aplica premios y castigos (lo usan también las misiones).
   ============================================================ */

(function (A) {
  'use strict';

  const STATS = {
    fuerza: { label: 'Fuerza', icon: 'fist', hint: 'Los guerreros son los más fuertes.' },
    agilidad: { label: 'Agilidad', icon: 'boot', hint: 'Depende de tu velocidad.' },
    ingenio: { label: 'Ingenio', icon: 'book', hint: 'Los magos son los más astutos.' },
    punteria: { label: 'Puntería', icon: 'target', hint: 'Sale de tu precisión.' },
    suerte: { label: 'Suerte', icon: 'clover', hint: 'Solo el dado decide.' },
  };

  const RECENT_MAX = 6;

  function S() { return A.State; }
  function player() { return A.State.player; }
  function regionNow() { return A.State.world ? A.Data.getById('regions', A.State.world.regionId) : null; }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function pick(list) { return list[rnd(list.length)]; }

  function regionTier(region) {
    const t = region && Array.isArray(region.tier) ? region.tier : [1, 1];
    return Math.max(1, Math.round((t[0] + t[1]) / 2));
  }

  // ============================================================
  // Tiradas
  // ============================================================

  function classOf(p) { return A.Balance && A.Balance.classOf ? A.Balance.classOf(p) : 'hybrid'; }

  /** Bonus del jugador para una tirada. */
  function statMod(stat, p) {
    p = p || player();
    if (!p) return 0;
    const half = Math.floor((p.level || 1) / 2);
    const type = classOf(p);
    const st = p.stats || {};
    let mod = 0;
    switch (stat) {
      case 'fuerza': mod = ({ warrior: 3, hybrid: 1, mage: 0 })[type] || 0; break;
      case 'agilidad': mod = Math.max(0, Math.floor(((st.speed || 10) - 8) / 2)); break;
      case 'ingenio': mod = ({ warrior: 0, hybrid: 1, mage: 3 })[type] || 0; break;
      case 'punteria': mod = Math.max(0, Math.floor((st.precision || 1) / 2)); break;
      case 'suerte': mod = (A.Passives && A.Passives.idOf && A.Passives.idOf(p) === 'suerte') ? 3 : 0; return mod;
      default: mod = 0;
    }
    // El hambre fuerte te quita reflejos
    if (A.Survival && A.Survival.getStatus) {
      const s = A.Survival.getStatus();
      if (s && s.id === 'weak') mod -= 1;
      if (s && s.id === 'starving') mod -= 2;
    }
    return mod + half;
  }

  /** Dificultad real de una tirada en una zona de cierto tier. */
  function dcFor(check, tier) {
    if (!check) return 0;
    return (check.dc || 10) + Math.floor(((tier || 1) - 1) / 2);
  }

  /** Probabilidad (0..1) de pasar la tirada. El 20 siempre sale bien y el 1 siempre mal. */
  function chanceOf(check, tier, p) {
    if (!check) return 1;
    const need = dcFor(check, tier) - statMod(check.stat, p);
    return Math.max(1, Math.min(19, 21 - need)) / 20;
  }

  function roll(check, tier, p) {
    const dc = dcFor(check, tier);
    const mod = statMod(check.stat, p);
    let d = 1 + rnd(20);
    let lucky = false;
    // Suerte del mediano: un 1 se vuelve a tirar
    if (d === 1 && A.Passives && A.Passives.rerollOnes && A.Passives.rerollOnes(p || player())) { lucky = true; d = 1 + rnd(20); }
    const total = d + mod;
    const success = d === 20 || (d !== 1 && total >= dc);
    return { d, mod, total, dc, success, lucky };
  }

  // ============================================================
  // Premios y castigos (compartido con las misiones)
  // ============================================================

  function coinUnit(tier) { return A.Balance && A.Balance.Economy ? A.Balance.Economy.coinBase(tier) : 3; }
  function xpUnit(tier) {
    return A.Progression ? A.Progression.xpForEnemy({ tier, category: 'normal' }) : 10;
  }

  function gainXp(n) {
    const p = player();
    if (!p || n <= 0) return [];
    p.xp = (p.xp || 0) + n;
    A.Bus.emit('player:xp-changed', { current: p.xp });
    const ups = A.Progression ? A.Progression.checkLevelUp(p) : [];
    for (const lv of ups) {
      A.State.addChronicle({ type: 'system', text: `¡Subiste al nivel ${lv.level}! ${lv.text}. Te recuperás por completo.` });
      A.Bus.emit('player:leveled', { newLevel: lv.level });
      A.Bus.emit('player:hp-changed', { current: p.hp });
    }
    return ups;
  }

  /** Busca un objeto en cualquier tabla (ítems, armas, armaduras). */
  function itemData(id) { return A.Inventory && A.Inventory.resolveData ? A.Inventory.resolveData(id) : A.Data.getById('items', id); }

  function biomeLootPick(region) {
    // Usa los mismos botines por bioma que el viaje, sin meterlos en la mochila todavía
    const before = (player().inventory || []).map((s) => ({ ...s }));
    const res = A.Travel && A.Travel.resolveBiomeLootStandalone ? A.Travel.resolveBiomeLootStandalone(region) : null;
    if (!res || res.kind !== 'biome_loot') return null;
    // Detectar qué entró comparando la mochila
    const after = player().inventory || [];
    for (const s of after) {
      const b = before.find((x) => x.itemId === s.itemId);
      const gained = s.qty - (b ? b.qty : 0);
      if (gained > 0) return { itemId: s.itemId, qty: gained };
    }
    return null;
  }

  /**
   * Aplica un resultado. Devuelve la lista de "fichas" para mostrar:
   *   { kind: 'coins'|'item'|'heal'|'hurt'|'mana'|'food'|'xp'|'time'|'level'|'full', value, itemId }
   */
  function applyOutcome(out, ctx = {}) {
    const p = player();
    const chips = [];
    if (!out || !p) return chips;
    const tier = ctx.tier || 1;
    const region = ctx.region || regionNow();

    // Monedas
    if (typeof out.coins === 'number' && out.coins !== 0) {
      let amount = out.coinsFlat ? out.coins : Math.round(coinUnit(tier) * out.coins * (0.8 + Math.random() * 0.4));
      if (out.coins > 0) {
        amount = Math.max(1, amount);
        A.Currency.add(amount);
        chips.push({ kind: 'coins', value: amount });
      } else {
        // Perder monedas: nunca más de las que tenés
        amount = Math.min(A.Currency.toCopper(), Math.max(1, Math.abs(amount)));
        if (amount > 0 && A.Currency.canPay(amount)) { A.Currency.pay(amount); chips.push({ kind: 'coins', value: -amount }); }
      }
    }
    // Objetos
    for (const it of out.items || []) {
      const [id, min, max] = it;
      const qty = (min || 0) + rnd(Math.max(0, (max || min || 1) - (min || 0)) + 1);
      if (qty <= 0 || !itemData(id)) continue;
      if (A.State.addItem(id, qty)) chips.push({ kind: 'item', itemId: id, value: qty });
      else chips.push({ kind: 'full', itemId: id });
    }
    for (let i = 0; i < (out.loot || 0); i++) {
      const got = biomeLootPick(region);
      if (got) chips.push({ kind: 'item', itemId: got.itemId, value: got.qty });
    }
    // Vida
    if (out.heal) {
      const before = p.hp;
      const amount = out.healFlat ? out.heal : Math.max(1, Math.round(p.maxHp * out.heal));
      A.State.healHp(amount);
      if (p.hp > before) chips.push({ kind: 'heal', value: p.hp - before });
    }
    if (out.hurt) {
      const amount = out.hurtFlat ? out.hurt : Math.max(1, Math.round(p.maxHp * out.hurt));
      const real = Math.min(amount, Math.max(0, p.hp - 1)); // nunca te mata
      if (real > 0) { A.State.setHp(p.hp - real); chips.push({ kind: 'hurt', value: real }); }
    }
    if (out.mana && p.hasMagic) {
      const before = p.mana;
      const amount = Math.max(1, Math.round(p.maxMana * out.mana));
      A.State.setMana(Math.min(p.maxMana, p.mana + amount));
      if (p.mana > before) chips.push({ kind: 'mana', value: p.mana - before });
    }
    if (out.food) {
      const before = p.food || 0;
      A.State.modifyFood(out.food);
      const diff = (p.food || 0) - before;
      if (diff) chips.push({ kind: 'food', value: diff });
    }
    if (out.xp) {
      const amount = out.xpFlat ? out.xp : Math.max(1, Math.round(xpUnit(tier) * out.xp));
      chips.push({ kind: 'xp', value: amount });
      for (const lv of gainXp(amount)) chips.push({ kind: 'level', value: lv.level });
    }
    if (out.time && A.Time) {
      A.Time.advance(out.time, 'event');
      chips.push({ kind: 'time', value: out.time });
    }
    return chips;
  }

  /** Texto corto de una ficha, para las crónicas. */
  function chipText(c) {
    const it = c.itemId ? itemData(c.itemId) : null;
    switch (c.kind) {
      case 'coins': return c.value > 0 ? `+${A.Currency.formatPrice(c.value)}` : `-${A.Currency.formatPrice(-c.value)}`;
      case 'item': return `${it ? it.name : c.itemId}${c.value > 1 ? ` ×${c.value}` : ''}`;
      case 'full': return `${it ? it.name : 'algo'} (no entró en la mochila)`;
      case 'heal': return `+${c.value} vida`;
      case 'hurt': return `-${c.value} vida`;
      case 'mana': return `+${c.value} maná`;
      case 'food': return `${c.value > 0 ? '+' : ''}${c.value} comida`;
      case 'xp': return `+${c.value} XP`;
      case 'level': return `¡nivel ${c.value}!`;
      case 'time': return 'pasó el tiempo';
      default: return '';
    }
  }

  // ============================================================
  // Escenas
  // ============================================================

  function recentList() {
    const w = A.State.world;
    if (!w) return [];
    if (!Array.isArray(w.recentEvents)) w.recentEvents = [];
    return w.recentEvents;
  }

  function remember(id) {
    const list = recentList();
    list.push(id);
    while (list.length > RECENT_MAX) list.shift();
  }

  function eventsFor(region) {
    const all = (A.Data.events && A.Data.events.length ? A.Data.events : (A.Seed.events || []));
    const recent = new Set(recentList());
    const fits = all.filter((e) => (e.biomes || ['any']).some((b) => b === 'any' || b === region.biome));
    const fresh = fits.filter((e) => !recent.has(e.id));
    return fresh.length ? fresh : fits;
  }

  function weightedPick(list) {
    const total = list.reduce((s, e) => s + (e.weight || 1), 0);
    let r = Math.random() * total;
    for (const e of list) { r -= (e.weight || 1); if (r <= 0) return e; }
    return list[list.length - 1];
  }

  function placeFor(region) {
    const places = (A.Seed.creaturePlaces || {})[region.biome];
    return places && places.length ? pick(places) : 'cerca del camino';
  }

  /** Escena con criaturas: se elige cómo encararlas. */
  function creatureScene(region, group, opts = {}) {
    const tier = regionTier(region);
    const n = group.length;
    const phrase = A.Narrator && A.Narrator.groupPhrase ? A.Narrator.groupPhrase(group) : { text: A.Encounter.describeGroup(group), plural: n > 1 };
    const Text = phrase.text.charAt(0).toUpperCase() + phrase.text.slice(1);
    const where = placeFor(region);
    const p = player();
    const type = classOf(p);
    const night = opts.night;

    const text = night
      ? `En plena noche te despierta un ruido. ${Text} ${phrase.plural ? 'rondan' : 'ronda'} el campamento.`
      : pick([
        `${Text} ${phrase.plural ? 'merodean' : 'merodea'} ${where}. Todavía no te ${phrase.plural ? 'vieron' : 'vio'}.`,
        `Ves ${phrase.text} ${where}. ${phrase.plural ? 'Están distraídos' : 'Está distraído'}, buscando comida.`,
        `${where.charAt(0).toUpperCase() + where.slice(1)} aparece${phrase.plural ? 'n' : ''} ${phrase.text}. Por ahora no notaron tu presencia.`,
      ]);

    // El ataque por sorpresa depende de tu clase
    const attack = night
      ? { label: 'Levantarte de un salto', check: { stat: 'agilidad', dc: 11 + (n - 1) },
        ok: { text: 'Te levantás con el arma en la mano antes de que lleguen.', fight: { surprise: true } },
        fail: { text: 'Todavía estás medio dormido cuando se te tiran encima.', fight: { ambush: true } } }
      : type === 'warrior'
        ? { label: 'Cargar contra ellos', check: { stat: 'fuerza', dc: 11 + (n - 1) },
          ok: { text: 'Te lanzás con todo y los agarrás desprevenidos.', fight: { surprise: true } },
          fail: { text: 'Te ven venir de lejos. No hay sorpresa, pero tampoco vuelta atrás.', fight: {} } }
        : type === 'mage'
          ? { label: 'Lanzar un hechizo desde las sombras', check: { stat: 'ingenio', dc: 11 + (n - 1) },
            ok: { text: 'Preparás el hechizo en silencio y actuás antes de que reaccionen.', fight: { surprise: true } },
            fail: { text: 'El zumbido del maná te delata. Se dan vuelta para mirarte.', fight: {} } }
          : { label: 'Atacar por sorpresa', check: { stat: 'agilidad', dc: 11 + (n - 1) },
            ok: { text: 'Te acercás sin hacer ruido y caés sobre ellos.', fight: { surprise: true } },
            fail: { text: 'Una rama cruje bajo tu pie. Te escucharon.', fight: {} } };

    const options = [attack];
    if (night) {
      options.push({ label: 'Quedarte quieto y esperar', check: { stat: 'suerte', dc: 11 },
        ok: { text: 'Olfatean un rato y se van. Volvés a dormirte con el arma en la mano.', heal: 0.2 },
        fail: { text: 'Te encuentran entre las mantas.', fight: { ambush: true } } });
    } else {
      options.push({ label: 'Escabullirte', check: { stat: 'agilidad', dc: 10 + (n - 1) * 2 },
        ok: { text: 'Te alejás sin hacer ruido. Nadie te siguió.', xp: 0.1 },
        fail: { text: 'Te vieron. Te atacan antes de que puedas reaccionar.', fight: { ambush: true } } });
      // Domar: solo con una criatura sola y domable, si no tenés mascota
      const e = n === 1 ? A.Data.getById('enemies', group[0].id) : null;
      if (e && e.tameable && !p.pet && A.Tame && A.Tame.canTame) {
        const can = A.Tame.canTame(e.id);
        if (can && (can.ok || can.reason === 'missing-item')) {
          options.push({ label: 'Acercarte con calma', tame: true, ok: { text: 'Te agachás despacio y le mostrás las manos.', tame: true } });
        }
      }
    }

    return {
      kind: night ? 'night' : 'creature',
      regionId: region.id,
      tier,
      icon: night ? 'moon' : 'swords',
      title: night ? 'Algo se acerca al campamento' : (n > 1 ? 'Un grupo de criaturas' : 'Una criatura'),
      text,
      enemies: group,
      options,
      stage: 'choose',
    };
  }

  /** Escena de un evento del bioma. */
  function eventScene(region, ev) {
    return {
      kind: 'event',
      eventId: ev.id,
      regionId: region.id,
      tier: regionTier(region),
      icon: ev.icon || 'scroll',
      title: ev.title,
      text: ev.text,
      options: JSON.parse(JSON.stringify(ev.options || [])),
      stage: 'choose',
    };
  }

  /** Eventos que se cargaron a mano en el editor (region.events). */
  function customScene(region, ev) {
    const tier = regionTier(region);
    const out = { text: '' };
    let title = 'Un hallazgo';
    let icon = 'chest';
    if (ev.type === 'treasure') {
      out.coins = A.Utils.rollDice(ev.amount || '1d10'); out.coinsFlat = true;
      out.text = 'Encontrás monedas escondidas.';
    } else if (ev.type === 'find' && ev.reward) {
      out.items = [[ev.reward, 1, 1]];
      out.text = 'Encontrás algo útil.';
    } else if (ev.type === 'damage') {
      out.hurt = A.Utils.rollDice(ev.amount || '1d4'); out.hurtFlat = true;
      out.text = ev.effect || 'Algo te lastimó.';
      title = 'Peligro'; icon = 'trap';
    } else if (ev.type === 'heal') {
      out.heal = A.Utils.rollDice(ev.amount || '1d6'); out.healFlat = true;
      out.text = 'Algo te reconforta.';
      title = 'Un respiro'; icon = 'heart';
    } else {
      return null;
    }
    return {
      kind: 'custom', regionId: region.id, tier, icon, title,
      text: ev.text || ev.effect || 'Algo llama tu atención.',
      options: [{ label: 'Seguir', ok: out }],
      stage: 'choose',
    };
  }

  function buildScene(region) {
    // 1) Eventos cargados a mano en el editor (los del juego base ya son escenas)
    if (region._source === 'editor' && Array.isArray(region.events)) {
      for (const ev of region.events) {
        if (Math.random() * 100 < (ev.chance || 0)) {
          const sc = customScene(region, ev);
          if (sc) return sc;
        }
      }
    }
    // 2) Criatura (45%) o escena del bioma (55%)
    const hasEnemies = A.Data.enemiesInRegion(region.id).length > 0;
    const pool = eventsFor(region);
    if (hasEnemies && (Math.random() < 0.45 || !pool.length)) {
      const group = A.Encounter.generate(region.id);
      if (group && group.length) return creatureScene(region, group);
    }
    if (pool.length) {
      const ev = weightedPick(pool);
      remember(ev.id);
      return eventScene(region, ev);
    }
    return null;
  }

  // ============================================================
  // API
  // ============================================================

  function canExplore() {
    const r = regionNow();
    return !!(r && r.type === 'combat' && !A.State.combat && !A.State.traveling);
  }

  /** Explorar la zona actual: siempre abre una escena. */
  function explore() {
    if (!canExplore()) return { ok: false };
    const region = regionNow();
    if (A.Time) A.Time.advance(1, 'explore');
    if (A.Survival && player()) {
      player()._exploreCounter = (player()._exploreCounter || 0) + 1;
      if (player()._exploreCounter % 2 === 0) A.Survival.applyTurnTick('explore');
    }
    A.Bus.emit('explore:done', { regionId: region.id });
    const scene = buildScene(region);
    if (!scene) return { ok: false };
    A.State.openModal('event', scene);
    A.State.persist();
    return { ok: true, scene };
  }

  function current() {
    return A.State.ui && A.State.ui.openModal === 'event' ? A.State.ui.modalPayload : null;
  }

  /** ¿Se puede elegir esta opción? (monedas o comida que pide) */
  function optionBlocked(opt) {
    const p = player();
    if (!opt || !p) return 'No disponible';
    const needs = opt.needs || {};
    if (needs.coins) {
      const sc = current();
      const cost = Math.max(1, Math.round(coinUnit(sc ? sc.tier : 1) * needs.coins));
      if (!A.Currency.canPay(cost)) return `Necesitás ${A.Currency.formatPrice(cost)}`;
    }
    if (needs.food && (p.food || 0) < needs.food) return `Necesitás ${needs.food} de comida`;
    return null;
  }

  /** Elegir una opción de la escena abierta. */
  function choose(idx) {
    const sc = current();
    if (!sc || sc.stage !== 'choose') return null;
    const opt = sc.options[idx];
    if (!opt || optionBlocked(opt)) return null;
    const region = A.Data.getById('regions', sc.regionId) || regionNow();
    const p = player();

    let rollRes = null;
    let outcome = opt.ok;
    if (opt.check) {
      rollRes = roll(opt.check, sc.tier, p);
      outcome = rollRes.success ? opt.ok : (opt.fail || { text: 'No sale como esperabas.' });
    }
    outcome = outcome || { text: '' };
    // v2.1: salir bien de una tirada también enseña algo (un poco de experiencia)
    if (rollRes && rollRes.success && !outcome.fight) outcome = { ...outcome, xp: (outcome.xp || 0) + 0.3 };

    const chips = applyOutcome(outcome, { tier: sc.tier, region });

    // Pelea: los enemigos de la escena, o unos nuevos de la zona
    let fight = null;
    if (outcome.fight) {
      const enemies = (sc.enemies && sc.enemies.length) ? sc.enemies : A.Encounter.generate(region.id);
      if (enemies && enemies.length) fight = { enemies, surprise: !!outcome.fight.surprise, ambush: !!outcome.fight.ambush };
    }

    sc.stage = 'result';
    sc.result = {
      optionIdx: idx,
      label: opt.label,
      check: opt.check || null,
      roll: rollRes,
      success: rollRes ? rollRes.success : true,
      text: outcome.text || '',
      chips,
      fight,
      tame: !!outcome.tame,
    };

    // Crónica: una sola línea por escena
    const chipLine = chips.map(chipText).filter(Boolean).join(', ');
    const rollLine = rollRes ? ` (${STATS[opt.check.stat] ? STATS[opt.check.stat].label : 'Tirada'}: ${rollRes.d}${rollRes.mod ? `+${rollRes.mod}` : ''} contra ${rollRes.dc}, ${rollRes.success ? 'éxito' : 'fallo'})` : '';
    A.State.addChronicle({
      type: fight ? 'combat' : (chips.some((c) => c.kind === 'coins' || c.kind === 'item') ? 'loot' : 'note'),
      text: `${sc.title}: ${opt.label.toLowerCase()}${rollLine}. ${outcome.text}${chipLine ? ` ${chipLine}.` : ''}`.trim(),
    });

    if (sc.eventId) A.Bus.emit('explore:resolved', { eventId: sc.eventId, success: sc.result.success });
    A.Bus.emit('inventory:changed');
    A.State.persist();
    // Volver a dibujar el modal con el resultado
    A.State.openModal('event', sc);
    return sc.result;
  }

  /** Cerrar el resultado: si hay pelea, empieza; si había que domar, abre la doma. */
  function proceed() {
    const sc = current();
    if (!sc) { A.State.closeModal(); return; }
    const res = sc.result;
    A.State.closeModal();
    if (!res) return;
    if (res.fight) {
      A.Combat.start({ enemies: res.fight.enemies, surprise: res.fight.surprise, ambush: res.fight.ambush, fromTravel: false });
    } else if (res.tame && sc.enemies && sc.enemies[0]) {
      A.State.openModal('tame', { enemyId: sc.enemies[0].id, fromTravel: false });
    }
  }

  // ============================================================
  // Descansar
  // ============================================================

  /**
   * Descansar en la zona actual. Devuelve { kind, text, chips } para mostrar.
   *   de día   -> siesta: +20% vida y maná, pasa hasta la fase siguiente
   *   de noche -> dormís hasta la mañana: 50% (75% en zona segura)
   *               en zonas de combate, 1 de cada 4 noches algo se acerca
   */
  function rest() {
    const p = player();
    const region = regionNow();
    if (!p || !region || !A.Time) return null;
    const safe = region.type === 'safe';
    const hungry = A.Survival ? A.Survival.getStatus() : null;
    const penalty = hungry && hungry.penalties && hungry.penalties.restPenalty ? (hungry.id === 'starving' ? 0.2 : 0.5) : 1;

    if (!A.Time.isNight()) {
      const chips = applyOutcome({ heal: 0.2 * penalty, mana: 0.2 * penalty }, { tier: regionTier(region), region });
      const w = A.State.world;
      const toNext = A.Time.PHASE_DURATION - ((w.timeProgress || 0) % A.Time.PHASE_DURATION);
      A.Time.advance(toNext, 'nap');
      const text = `Descansaste un rato${safe ? '' : ' a la sombra'}. ${chips.length ? chips.map(chipText).join(', ') + '.' : 'Ya estabas descansado.'}`;
      A.State.addChronicle({ type: 'rest', text });
      return { kind: 'nap', text, chips };
    }

    // Noche
    const share = (safe ? 0.75 : 0.5) * penalty;
    const enemiesHere = A.Data.enemiesInRegion(region.id).length > 0;
    if (!safe && enemiesHere && Math.random() < 0.25) {
      // Dormís un poco y algo se acerca
      applyOutcome({ heal: share / 2, mana: share / 2 }, { tier: regionTier(region), region });
      A.Time.passTo('morning');
      const group = A.Encounter.generate(region.id);
      if (group && group.length) {
        A.State.openModal('event', creatureScene(region, group, { night: true }));
        A.State.persist();
        return { kind: 'night-event' };
      }
    }
    const chips = applyOutcome({ heal: share, mana: share }, { tier: regionTier(region), region });
    // La mascota también duerme
    if (p.pet && p.pet.maxHealth) {
      const before = p.pet.health;
      p.pet.health = Math.min(p.pet.maxHealth, p.pet.health + Math.ceil(p.pet.maxHealth * share));
      if (p.pet.health > before) chips.push({ kind: 'pet', value: p.pet.health - before });
    }
    A.Time.passTo('morning');
    const where = safe ? 'en un rincón tranquilo del pueblo' : 'al raso, con un ojo abierto';
    const text = `Dormiste ${where} hasta la mañana. ${chips.filter((c) => c.kind !== 'pet').map(chipText).join(', ') || 'Ya estabas descansado'}.`;
    A.State.addChronicle({ type: 'rest', text });
    A.State.persist();
    return { kind: 'sleep', text, chips };
  }

  A.Rewards = { apply: applyOutcome, chipText, gainXp, coinUnit, xpUnit };

  A.Explore = {
    STATS,
    statMod,
    dcFor,
    chanceOf,
    regionTier,
    canExplore,
    explore,
    choose,
    proceed,
    current,
    optionBlocked,
    rest,
    creatureScene,
  };
})(window.Aventurs);
