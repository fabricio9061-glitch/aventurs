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

   Descansar (v2.3): de día es una siesta corta (y pasa la tarde); de
   noche dormís hasta la mañana, y en zonas peligrosas algo puede
   acercarse. Fuera de la posada nunca te cura del todo (la siesta,
   hasta la mitad de la vida; dormir, hasta 3/4), da hambre, y después
   de descansar hay que moverse (explorar, pelear o viajar) antes de
   volver a descansar. En la posada, pagando, te recuperás del todo.

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
    // v3.1: huir es una carrera: tu velocidad contra la de la criatura más rápida
    carrera: { label: 'Velocidad', icon: 'run', hint: 'Tu velocidad contra la de la criatura más rápida.' },
  };

  const RECENT_MAX = 6;

  function S() { return A.State; }
  function player() { return A.State.player; }
  /** v3.0: los héroes que exploran juntos (en solitario, vos). */
  function groupHeroes() {
    const g = A.Party && A.Party.combatHeroes ? A.Party.combatHeroes() : null;
    return g && g.length > 1 ? g : [player()];
  }
  function inGroup() { return groupHeroes().length > 1; }
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

  function realSpeed(p) {
    const st = p.stats || {};
    return A.Balance && A.Balance.playerCombatStats ? A.Balance.playerCombatStats(p).speed : st.speed || 10;
  }

  /** Bonus del jugador para una tirada (check: la tirada entera, para las que comparan con algo). */
  function statMod(stat, p, check, opts = {}) {
    p = p || player();
    if (!p) return 0;
    const half = Math.floor((p.level || 1) / 2);
    const type = classOf(p);
    const st = p.stats || {};
    let mod = 0;
    switch (stat) {
      // v3.1: carrera: la diferencia de velocidad pesa mucho (sin la mitad del nivel)
      case 'carrera': {
        const vs = check && check.vs != null ? check.vs : 10;
        mod = Math.max(-6, Math.min(6, realSpeed(p) - vs));
        if (!opts.noHunger && A.Survival && A.Survival.getStatus) {
          const s = A.Survival.getStatus();
          if (s && s.id === 'weak') mod -= 1;
          if (s && s.id === 'starving') mod -= 2;
        }
        return mod;
      }
      case 'fuerza': mod = ({ warrior: 3, hybrid: 1, mage: 0 })[type] || 0; break;
      // v2.4: la velocidad real (el peso del equipo frena)
      case 'agilidad': mod = Math.max(0, Math.floor(((A.Balance && A.Balance.playerCombatStats ? A.Balance.playerCombatStats(p).speed : st.speed || 10) - 8) / 2)); break;
      case 'ingenio': mod = ({ warrior: 0, hybrid: 1, mage: 3 })[type] || 0; break;
      case 'punteria': mod = Math.max(0, Math.floor((st.precision || 1) / 2)); break;
      case 'suerte': mod = (A.Passives && A.Passives.idOf && A.Passives.idOf(p) === 'suerte') ? 3 : 0; return mod;
      default: mod = 0;
    }
    // El hambre fuerte te quita reflejos
    if (!opts.noHunger && A.Survival && A.Survival.getStatus) {
      const s = A.Survival.getStatus();
      if (s && s.id === 'weak') mod -= 1;
      if (s && s.id === 'starving') mod -= 2;
    }
    return mod + half;
  }

  /**
   * v3.1: las estadísticas de explorar de un héroe, para mostrarlas
   * (la ficha y la pantalla de inicio). opts.noHunger: sin contar el hambre.
   */
  const SHEET = ['fuerza', 'agilidad', 'ingenio', 'punteria', 'suerte'];
  function sheet(p, opts = {}) {
    return SHEET.map((id) => {
      const value = statMod(id, p, null, opts);
      const base = opts.noHunger ? value : statMod(id, p, null, { noHunger: true });
      return { id, label: STATS[id].label, icon: STATS[id].icon, hint: STATS[id].hint, value, down: value < base };
    });
  }

  /** Dificultad real de una tirada en una zona de cierto tier (las de carrera no suben con la zona). */
  function dcFor(check, tier) {
    if (!check) return 0;
    if (check.noTier) return check.dc || 10;
    return (check.dc || 10) + Math.floor(((tier || 1) - 1) / 2);
  }

  /** Probabilidad (0..1) de pasar la tirada. El 20 siempre sale bien y el 1 siempre mal.
   *  bonus: lo que suma haber observado antes (v3.1). */
  function chanceOf(check, tier, p, bonus) {
    if (!check) return 1;
    const need = dcFor(check, tier) - statMod(check.stat, p, check) - (bonus || 0);
    return Math.max(1, Math.min(19, 21 - need)) / 20;
  }

  /** v3.3: en grupo, quién tira y cuánto suma la ayuda.
   *  check.best: la tira el más hábil del grupo · check.together: +1 por cada compañero. */
  function partyRoll(check, sc, p) {
    p = p || player();
    const out = { roller: p, extra: (sc && sc.bonus) || 0, best: false, help: 0 };
    if (!check || !sc || !sc.party) return out;
    const hs = groupHeroes();
    if (hs.length < 2) return out;
    if (check.best) {
      const score = (h) => statMod(check.stat, h, check);
      out.roller = hs.slice().sort((a, b) => (score(b) - score(a)) || (a === p ? -1 : b === p ? 1 : 0))[0];
      out.best = true;
    }
    if (check.together) { out.help = hs.length - 1; out.extra += out.help; }
    return out;
  }

  /** v3.3: lo que ven todos en las opciones de grupo (quién tira, la ayuda y la chance):
   *  lo calcula el anfitrión y viaja con la escena. */
  function tagPartyOptions(sc) {
    if (!sc || !sc.party) return;
    for (const o of sc.options || []) {
      if (!o.check || !(o.check.best || o.check.together)) { delete o.party; continue; }
      const pr = partyRoll(o.check, sc);
      o.party = {
        hid: pr.best ? A.State.hidOf(pr.roller) : null,
        name: pr.best ? pr.roller.name : null,
        help: pr.help,
        mod: statMod(o.check.stat, pr.roller, o.check) + pr.extra,
        pct: Math.round(chanceOf(o.check, sc.tier, pr.roller, pr.extra) * 100),
      };
    }
  }

  function roll(check, tier, p, bonus) {
    const dc = dcFor(check, tier);
    const mod = statMod(check.stat, p, check) + (bonus || 0);
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
    // v2.5: lo que gastás (la comida que les tirás a las bestias)
    for (const it of out.consume || []) {
      const [id, qty] = it;
      if (A.State.removeItem && (p.inventory || []).some((s) => s.itemId === id)) {
        A.State.removeItem(id, qty || 1);
        chips.push({ kind: 'used', itemId: id, value: qty || 1 });
      }
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
      // v3.3: las trampas y los golpes de las escenas sí pueden matar (antes te dejaban con 1)
      const real = Math.min(amount, Math.max(0, p.hp));
      if (real > 0) {
        const hit = () => A.State.setHp(p.hp - real);
        const text = ctx.title ? `En «${ctx.title}» te quedaste sin fuerzas y no volviste a levantarte.` : '';
        if (A.Death) A.Death.during('trap', { text }, hit); else hit();
        chips.push({ kind: 'hurt', value: real });
      }
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

  /**
   * v3.3: en grupo cada uno gana lo suyo y lo malo le toca a algunos.
   *   - Monedas, experiencia, objetos y hallazgos: cada uno se lleva lo mismo
   *     que si estuviera solo (antes se repartía y en grupos grandes no se avanzaba).
   *   - Lo malo (herida, perder monedas o comida): a uno al azar seguro, y a cada
   *     uno de los demás con la mitad de chance (A.Explore.unlucky).
   *   - Lo bueno que no se lleva (curarse, maná, comer): a todos.
   *   - Lo que se gasta (la comida que se le tira a una bestia): el que eligió.
   *   - Lo que se paga (needs: monedas o comida): el que eligió, y lo que compró es suyo.
   *   - out.self: todo es del que eligió (un sacrificio, un trato personal).
   * Devuelve { chips (las del que eligió), group: [{ hid, name, chips }] }.
   */
  function applyGroupOutcome(out, ctx = {}) {
    const heroes = groupHeroes();
    const chooser = player();
    if (heroes.length <= 1 || !out) return { chips: applyOutcome(out, ctx), group: null };
    if (out.self) {
      const chips = applyOutcome(out, ctx);
      return { chips, group: [{ hid: A.State.hidOf(chooser), name: chooser.name, chips }] };
    }
    const tier = ctx.tier || 1;
    const paid = ctx.paid || {};
    const per = heroes.map(() => ({}));
    const bad = new Set(unlucky(heroes));
    per.forEach((o, i) => {
      const h = heroes[i];
      const me = h === chooser;
      for (const k of ['heal', 'healFlat', 'mana']) if (out[k] != null) o[k] = out[k];
      if (out.food != null && (out.food > 0 ? !paid.food || me : (paid.food ? me : bad.has(h)))) o.food = out.food;
      if (out.hurt != null && bad.has(h)) { o.hurt = out.hurt; o.hurtFlat = out.hurtFlat; }
      if (typeof out.coins === 'number' && (out.coins > 0 ? !paid.coins || me : (paid.coins ? me : bad.has(h)))) { o.coins = out.coins; o.coinsFlat = out.coinsFlat; }
      if (out.xp) { o.xp = out.xp; o.xpFlat = out.xpFlat; }
      if (out.items && (!(paid.coins || paid.food) || me)) o.items = out.items.map((it) => it.slice());
      if (out.loot) o.loot = out.loot;
    });
    void tier;
    const ci = Math.max(0, heroes.indexOf(chooser));
    if (out.consume) per[ci].consume = out.consume;
    const group = heroes.map((h, i) => {
      const chips = A.State.withHero(h, () => applyOutcome(per[i], ctx));
      return { hid: A.State.hidOf(h), name: h.name, chips };
    });
    // el tiempo pasa una vez para todos
    if (out.time && A.Time) {
      A.Time.advance(out.time, 'event');
      group[ci].chips.push({ kind: 'time', value: out.time });
    }
    return { chips: group[ci].chips, group };
  }

  /**
   * v3.3: a quiénes les toca lo malo en grupo: uno al azar seguro y cada uno de los
   * demás con la mitad de chance. Así no siempre le toca a todos ni siempre al mismo.
   */
  function unlucky(heroes) {
    const list = (heroes || []).slice();
    if (list.length <= 1) return list;
    const first = list.splice(rnd(list.length), 1)[0];
    return [first].concat(list.filter(() => Math.random() < 0.5));
  }

  /** Texto corto de una ficha, para las crónicas. */
  function chipText(c) {
    const it = c.itemId ? itemData(c.itemId) : null;
    switch (c.kind) {
      case 'coins': return c.value > 0 ? `+${A.Currency.formatPrice(c.value)}` : `-${A.Currency.formatPrice(-c.value)}`;
      case 'item': return `${it ? it.name : c.itemId}${c.value > 1 ? ` ×${c.value}` : ''}`;
      case 'used': return `-${it ? it.name : c.itemId}${c.value > 1 ? ` ×${c.value}` : ''}`;
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
    // v2.2: una escena puede ser de zonas puntuales (regions) además de biomas
    // v3.1: algunas escenas son solo de noche o solo de día
    const night = A.Time && A.Time.isNight ? A.Time.isNight() : false;
    // v3.3: algunas escenas son solo para grupos (party: true) y otras solo para cuando vas solo (solo: true)
    const group = inGroup();
    const fits = all.filter((e) => (Array.isArray(e.regions) && e.regions.length
      ? e.regions.includes(region.id)
      : (e.biomes || ['any']).some((b) => b === 'any' || b === region.biome))
      && (!e.time || e.time === 'any' || (e.time === 'night') === night)
      && (!e.party || group) && (!e.solo || !group));
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

  /** v2.5: la criatura que "manda" en el grupo (la élite, o la de más tier). */
  function leaderOf(group) {
    return group.find((e) => e.elite) || group.slice().sort((a, b) => (b.tier || 1) - (a.tier || 1))[0];
  }

  function nounOf(inst) {
    return A.Narrator && A.Narrator.enemyNoun ? A.Narrator.enemyNoun(inst) : (inst.displayName || inst.name || 'la criatura');
  }
  const capFirst = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

  /**
   * v2.5: si el ataque por sorpresa sale mal, la criatura te hace algo antes de empezar
   * (la araña te atrapa en su tela, la serpiente te envenena...). Si no, perdés un poco de vida.
   */
  function surpriseFail(group, tier) {
    const lead = leaderOf(group);
    const N = capFirst(nounOf(lead));
    const ids = A.Skills ? A.Skills.idsOf(lead) : [];
    const tags = lead.tags || [];
    const value = (type) => (A.Skills ? A.Skills.valueFor(type, lead.tier || tier) : 1);
    const st = (status, turns, text) => ({ text, opening: [{ type: 'status', status, turns, value: value(status), say: text }] });
    if (ids.includes('telarana')) return st('grab', 3, 'Pisás una telaraña escondida: arrancás la pelea atrapado.');
    if (tags.includes('poison') || ids.includes('venenoso') || ids.includes('picadura') || ids.includes('colmillos_veneno')) return st('poison', 3, `${N} te pica antes de que llegues: arrancás envenenado.`);
    if (tags.includes('fire')) return st('fire', 2, `${N} te recibe con una llamarada: arrancás quemándote.`);
    if (tags.includes('ice')) return st('cold', 2, 'Una ráfaga helada te frena en seco: arrancás entumecido.');
    if (tags.includes('acid') || ids.includes('acido')) return st('corrode', 3, `${N} te salpica ácido: te carcome la armadura.`);
    if (ids.includes('miedo') || ids.includes('etereo') || ids.includes('rugido')) return st('fear', 3, 'Un grito helado te paraliza: arrancás con miedo.');
    if (ids.includes('derribo') || ids.includes('embestida') || tags.includes('charge')) return st('prone', 2, `${N} te sale al cruce y te tira al suelo.`);
    if (ids.includes('picotazo') || ids.includes('tierra_ojos') || ids.includes('oscuridad')) return st('blind', 2, `${N} se te tira a la cara: arrancás medio ciego.`);
    if (ids.includes('mordida') || ids.includes('zarpazo') || ids.includes('infectar') || ids.includes('beber_sangre')) return st('bleed', 2, `${N} te muerde al pasar: arrancás sangrando.`);
    if (ids.includes('agarre') || ids.includes('lengua')) return st('grab', 3, `${N} te atrapa antes de que puedas reaccionar.`);
    const p = player();
    const amount = Math.max(1, Math.round(((p && p.maxHp) || 10) * 0.1));
    const text = 'Te ven venir y te reciben con un golpe: arrancás la pelea con menos vida.';
    return { text, opening: [{ type: 'damage', amount, effect: 'bleed', say: text }] };
  }

  /** v2.5: comida que les podés tirar a unas bestias para que te dejen en paz. */
  function foodFor(group) {
    const p = player();
    if (!p || !A.Tame || !A.Tame.dietInfo) return null;
    const beasts = group.every((e) => {
      const fam = e.family || [];
      return !fam.includes('humanoid') && !fam.includes('undead') && !fam.includes('construct') && !fam.includes('elemental')
        && !fam.includes('spirit') && !fam.includes('plant') && !fam.includes('demon') && e.category !== 'boss'
        && (fam.includes('beast') || fam.includes('insect') || fam.includes('marine'));
    });
    if (!beasts) return null;
    const diet = A.Tame.dietInfo(A.Data.getById('enemies', leaderOf(group).id) || leaderOf(group));
    const have = (diet.foods || []).filter((id) => (p.inventory || []).some((s) => s.itemId === id && s.qty > 0));
    if (!have.length) return null;
    have.sort((a, b) => ((A.Data.getById('items', a) || {}).value || 0) - ((A.Data.getById('items', b) || {}).value || 0));
    return A.Data.getById('items', have[0]);
  }

  /** v2.5: ¿son gente con la que se puede negociar? (bandidos, piratas, goblins...) */
  function canBribe(group) {
    return group.every((e) => {
      const fam = e.family || [];
      return fam.includes('humanoid') && !fam.includes('undead') && !fam.includes('demon') && e.category !== 'boss'
        && !(e.tags || []).includes('magic');
    });
  }

  /** ¿Se los puede asustar? (seres vivos que no son jefes) */
  function canScare(group) {
    return group.every((e) => {
      const fam = e.family || [];
      return e.category !== 'boss' && !fam.includes('undead') && !fam.includes('construct') && !fam.includes('elemental') && !fam.includes('spirit');
    });
  }

  /**
   * v3.1: qué tan alerta está el grupo (lo que cuesta sorprenderlo): manda la más atenta.
   * Las bestias huelen, las que andan en manada o son ágiles se avisan, las que vuelan ven desde
   * arriba. Los muertos, los constructos, las plantas y las lentas casi no se dan cuenta.
   */
  function alertOf(group) {
    let best = -9;
    for (const e of group) {
      const fam = e.family || [];
      const tags = e.tags || [];
      let x = 0;
      if (fam.includes('beast')) x += 1;
      if (tags.includes('pack') || tags.includes('agile')) x += 1;
      if (tags.includes('flying')) x += 1;
      if (fam.includes('undead') || fam.includes('construct') || fam.includes('plant') || tags.includes('slow')) x -= 2;
      if (fam.includes('elemental') && !fam.includes('arcane')) x -= 1;
      if (e.elite) x += 1;
      best = Math.max(best, x);
    }
    return Math.max(-2, Math.min(4, best));
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
    const lead = leaderOf(group);
    const elite = group.find((e) => e.elite);

    // v3.1: la escena dice si te vieron o no, y eso cambia lo fácil que es sorprenderlos
    const variant = night ? -1 : rnd(3);
    let text = night
      ? `En plena noche te despierta un ruido. ${Text} ${phrase.plural ? 'rondan' : 'ronda'} el campamento.`
      : [
        `${Text} ${phrase.plural ? 'merodean' : 'merodea'} ${where}. Todavía no te ${phrase.plural ? 'vieron' : 'vio'}.`,
        `Ves ${phrase.text} ${where}. ${phrase.plural ? 'Están distraídos' : 'Está distraído'}, buscando comida.`,
        `${where.charAt(0).toUpperCase() + where.slice(1)} aparece${phrase.plural ? 'n' : ''} ${phrase.text}. ${phrase.plural ? 'Olfatean el aire: algo notaron' : 'Olfatea el aire: algo notó'}.`,
      ][variant];
    // v2.5: la élite se nota de lejos
    if (elite) text += n > 1 ? ` ${capFirst(nounOf(elite))} los encabeza: es más fuerte que el resto.` : ' Es de élite: más fuerte que los de su especie.';

    // v3.1: qué tan alerta está (sorprenderlos) y qué tan rápida es la más rápida (huir)
    const alert = alertOf(group) + (variant === 1 ? -2 : variant === 2 ? 2 : 0);
    const fastest = Math.max(...group.map((e) => e.speed || 10));

    // v2.5: el ataque por sorpresa depende de tu clase. Si sale bien, arrancan heridos;
    // si sale mal, la criatura te hace algo antes de empezar.
    const wound = 0.25;
    const failSurprise = surpriseFail(group, tier);
    // singular o plural, masculino o femenino ("los agarrás desprevenidos" / "la agarrás desprevenida")
    const fem = n === 1 && A.Narrator && A.Narrator.isFem ? A.Narrator.isFem(group[0].id) : false;
    const them = n > 1 ? 'los' : fem ? 'la' : 'lo';
    const adj = (m) => (n > 1 ? `${m}s` : fem ? `${m.slice(0, -1)}a` : m);
    const one = nounOf(group[0]);
    const onThem = n > 1 ? 'ellos' : one;
    const starts = n > 1 ? `arrancan ${adj('herido')}` : `arranca ${adj('herido')}`;
    const sneakDc = 10 + alert + (n - 1);
    const sneakHint = `Bien: ${n > 1 ? 'arrancan heridos' : `arranca ${adj('herido')}`} y pegás primero. Mal: te golpean antes de empezar.`;
    const attack = night
      ? { label: 'Levantarte de un salto', check: { stat: 'agilidad', dc: 11 + (n - 1) },
        hint: 'Bien: peleás despierto y primero. Mal: te agarran dormido.',
        ok: { text: 'Te levantás con el arma en la mano antes de que lleguen.', fight: { surprise: true } },
        fail: { text: 'Todavía estás medio dormido cuando se te tiran encima.', fight: { ambush: true } } }
      : type === 'warrior'
        ? { label: n > 1 ? 'Cargar contra ellos' : capFirst(`cargar contra ${one}`), check: { stat: 'fuerza', dc: sneakDc }, hint: sneakHint,
          ok: { text: `Te lanzás con todo y ${them} agarrás ${adj('desprevenido')}: tu primer golpe ya ${them} dejó ${adj('tocado')}.`, fight: { surprise: true, wound } },
          fail: { text: `Te ven venir de lejos. ${failSurprise.text}`, fight: { opening: failSurprise.opening } } }
        : type === 'mage'
          ? { label: 'Lanzar un hechizo desde las sombras', check: { stat: 'ingenio', dc: sneakDc }, hint: sneakHint,
            ok: { text: `Tu hechizo cae sobre ${onThem} antes de que ${n > 1 ? 'reaccionen' : 'reaccione'}: ${starts}.`, fight: { surprise: true, wound } },
            fail: { text: `El zumbido del maná te delata. ${failSurprise.text}`, fight: { opening: failSurprise.opening } } }
          : { label: 'Atacar por sorpresa', check: { stat: 'agilidad', dc: sneakDc }, hint: sneakHint,
            ok: { text: `Te acercás sin hacer ruido y caés sobre ${onThem}: ${starts}.`, fight: { surprise: true, wound } },
            fail: { text: `Una rama cruje bajo tu pie. ${failSurprise.text}`, fight: { opening: failSurprise.opening } } };

    const options = [attack];
    if (night) {
      options.push({ label: 'Quedarte quieto y esperar', check: { stat: 'suerte', dc: 11 },
        hint: 'Bien: se van y seguís durmiendo. Mal: te encuentran entre las mantas.',
        ok: { text: 'Olfatean un rato y se van. Volvés a dormirte con el arma en la mano.', heal: 0.2 },
        fail: { text: 'Te encuentran entre las mantas.', fight: { ambush: true } } });
    } else {
      // v3.1: pelear de frente: sin tirada y con la guardia alta (cuesta más pegarte al principio)
      options.push({ label: 'Pelear de frente', hint: 'Sin sorpresas: arrancás con la guardia alta (+2 de defensa por 2 turnos).',
        ok: { text: 'Te plantás delante, con el arma firme y la guardia alta. Que empiece la pelea.', fight: { guard: true } } });
      // v3.1: Huir es una carrera: tu velocidad contra la de la más rápida
      options.push({ label: 'Huir', check: { stat: 'carrera', dc: 10 + (n - 1) * 2, vs: fastest, noTier: true },
        hint: `Bien: te alejás sin pelear. Mal: ${n > 1 ? 'te alcanzan' : 'te alcanza'} y ${n > 1 ? 'pegan' : 'pega'} primero.`,
        ok: { text: 'Das media vuelta y corrés sin mirar atrás. Te alejás antes de que te alcancen.', xp: 0.1 },
        fail: { text: `${capFirst(nounOf(lead))} es más ${A.Narrator && A.Narrator.isFem && A.Narrator.isFem(lead.id) ? 'rápida' : 'rápido'}: te ${n > 1 ? 'alcanzan' : 'alcanza'} antes de que puedas escapar.`, fight: { ambush: true } } });
      // v3.1: Observar: aprendés cómo es (bestiario) y sumás a la próxima tirada
      options.push({ label: n > 1 ? 'Observarlos de lejos' : 'Observar de lejos', observe: true,
        check: { stat: 'ingenio', dc: 8 + Math.ceil(Math.max(0, alert) / 2) + (n - 1) },
        hint: 'Bien: la anotás en el bestiario y sumás +2 a lo que hagas después. Mal: te descubren y pelean.',
        ok: { text: n > 1 ? 'Te quedás quieto mirando cómo se mueven. Ya sabés de qué son capaces.' : `Te quedás quieto mirando cómo se mueve ${one}. Ya sabés de qué es capaz.`, study: true },
        fail: { text: n > 1 ? 'Una piedra rueda bajo tu bota: te descubren mirando y se te vienen encima.' : 'Una piedra rueda bajo tu bota: te descubre mirando y se te viene encima.', fight: {} } });
      // v2.5: una opción más según quiénes son
      const food = foodFor(group);
      if (food) {
        options.push({ label: `Tirarles ${food.name.toLowerCase()}`, needs: { item: food.id }, hint: 'Se quedan comiendo y te vas sin pelear.',
          ok: { text: `Les tirás ${food.name.toLowerCase()} y, mientras se pelean por la comida, te alejás.`, consume: [[food.id, 1]], xp: 0.05 } });
      } else if (canBribe(group)) {
        const units = 4 * n;
        const cost = Math.max(1, Math.round(coinUnit(tier) * units));
        options.push({ label: n > 1 ? 'Pagarles para pasar' : 'Pagarle para pasar', needs: { coins: units }, hint: 'Pagás y te dejan pasar sin pelear.',
          ok: { text: n > 1 ? 'Les tirás unas monedas. Las cuentan, se ríen y te dejan pasar.' : 'Le tirás unas monedas. Las cuenta, se ríe y te deja pasar.', coins: -cost, coinsFlat: true } });
      } else if (canScare(group)) {
        options.push({ label: n > 1 ? 'Intimidarlos' : 'Intimidarlo', check: { stat: 'fuerza', dc: 12 + (n - 1) + (elite ? 2 : 0) },
          hint: 'Bien: se van sin pelear. Mal: atacan envalentonados (pegan más fuerte).',
          ok: { text: n > 1 ? 'Les plantás cara con un grito y retroceden. Se van sin pelear.' : 'Le plantás cara con un grito y retrocede. Se va sin pelear.', xp: 0.15 },
          fail: { text: n > 1 ? 'No se asustan. Al contrario: se envalentonan y atacan.' : 'No se asusta. Al contrario: se envalentona y ataca.', fight: { rally: true } } });
      }
      // Domar: solo con una criatura sola y domable, si no tenés mascota
      const e = n === 1 ? A.Data.getById('enemies', group[0].id) : null;
      if (e && e.tameable && !p.pet && A.Tame && A.Tame.canTame) {
        const can = A.Tame.canTame(e.id);
        if (can && (can.ok || can.reason === 'missing-item')) {
          options.push({ label: 'Acercarte con calma', tame: true, hint: `Intentás que confíe en vos para domar${them}.`, ok: { text: 'Te agachás despacio y le mostrás las manos.', tame: true } });
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
  /** v3.3: ¿alguna opción de la escena termina en pelea? */
  function sceneCanFight(sc) {
    return (sc.options || []).some((o) => ['ok', 'fail'].some((k) => o[k] && o[k].fight));
  }

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
      plural: !!ev.party, // v3.3: las escenas de grupo ya están contadas en plural
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
    // 1) Sucesos cargados a mano en el editor (los del juego base ya son escenas)
    if (region._source === 'editor' && (!region._patched || region._patched.includes('events')) && Array.isArray(region.events)) {
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
      // v3.3: en grupo, la escena ya cuenta las que se suman por ser más (y dice cuántas son)
      if (group && group.length) return creatureScene(region, A.Combat && A.Combat.prepareGroup ? A.Combat.prepareGroup(group) : group);
    }
    if (pool.length) {
      const ev = weightedPick(pool);
      remember(ev.id);
      const sc = eventScene(region, ev);
      // v3.3: en grupo, si la escena puede terminar en pelea, se sabe de antemano contra qué
      if (inGroup() && hasEnemies && sceneCanFight(sc)) {
        const foes = A.Encounter.generate(region.id);
        if (foes && foes.length) sc.foes = A.Combat && A.Combat.prepareGroup ? A.Combat.prepareGroup(foes) : foes;
      }
      return sc;
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
    if (player() && player().dead) return { ok: false }; // v3.3: tu aventura terminó
    const region = regionNow();
    clearRestLock();
    if (A.Time) A.Time.advance(1, 'explore');
    // v3.0: en grupo, el hambre y las misiones de explorar cuentan para los dos
    for (const h of groupHeroes()) {
      A.State.withHero(h, () => {
        if (A.Survival && h) {
          h._exploreCounter = (h._exploreCounter || 0) + 1;
          if (h._exploreCounter % 2 === 0) A.Survival.applyTurnTick('explore');
        }
        A.Bus.emit('explore:done', { regionId: region.id });
      });
    }
    const scene = buildScene(region);
    if (!scene) return { ok: false };
    noteSeen(scene);
    if (inGroup()) {
      scene.party = true;
      scene.by = A.State.hidOf(player()); // quién exploró
      scene.voters = groupHeroes().map((h) => A.State.hidOf(h)); // v3.2: para mostrar a quién se espera
      tagPartyOptions(scene);
    }
    A.State.openModal('event', scene);
    A.State.persist();
    return { ok: true, scene };
  }

  function current() {
    return A.State.ui && A.State.ui.openModal === 'event' ? A.State.ui.modalPayload : null;
  }

  /** v3.1: las criaturas de una escena entran al bestiario de los que están ahí. */
  function noteSeen(scene) {
    if (!A.Bestiary || !scene || !scene.enemies || !scene.enemies.length) return;
    for (const h of groupHeroes()) A.State.withHero(h, () => A.Bestiary.see(scene.enemies));
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
    if (needs.item && !(p.inventory || []).some((s) => s.itemId === needs.item && s.qty > 0)) {
      const it = itemData(needs.item);
      return `Necesitás ${it ? it.name.toLowerCase() : 'algo'}`;
    }
    return null;
  }

  // ============================================================
  // v3.1: en grupo se vota. Si eligen lo mismo, lo hace el que tiene
  // más chance; si no, cada uno tira un D20 y gana el más alto.
  // v3.2 (hasta 4): gana la opción con más votos (la hace el que tiene
  // más chance de los que la votaron); si empatan, deciden los dados.
  // ============================================================

  function votersOf(sc) {
    if (!sc || !sc.party) return [];
    const heroes = groupHeroes();
    return heroes.length > 1 ? heroes : [];
  }
  function heroName(hid) {
    const h = A.State.heroById ? A.State.heroById(hid) : null;
    return (h && h.name) || 'Tu compañero';
  }

  function resolveVotes(sc, voters) {
    const ids = voters.map((h) => A.State.hidOf(h)).filter((h) => sc.votes && sc.votes[h] != null);
    if (!ids.length) return null;
    const picks = ids.map((h) => sc.votes[h]);
    const agreed = picks.every((i) => i === picks[0]);
    // v3.2: cuántos votos tiene cada opción
    const count = {};
    for (const i of picks) count[i] = (count[i] || 0) + 1;
    const top = Math.max(...Object.values(count));
    const best = Object.keys(count).filter((k) => count[k] === top).map(Number);
    const majority = !agreed && best.length === 1;
    let winner = ids[0];
    let rolls = null;
    let rollers = null;
    if (best.length === 1) {
      // lo hace el que tiene más chance de que salga bien (de los que la votaron)
      const opt = sc.options[best[0]];
      let bestCh = -1;
      for (const h of ids.filter((x) => sc.votes[x] === best[0])) {
        const hero = A.State.heroById(h);
        const ch = opt && opt.check ? A.State.withHero(hero, () => chanceOf(opt.check, sc.tier, hero, sc.bonus || 0)) : 1;
        if (ch > bestCh + 1e-9) { bestCh = ch; winner = h; }
      }
    } else {
      // empate: un dado cada uno de los que votaron las empatadas; si empatan arriba, se vuelve a tirar
      rollers = ids.filter((h) => best.includes(sc.votes[h]));
      rolls = {};
      for (let t = 0; t < 6; t++) {
        for (const h of rollers) rolls[h] = 1 + rnd(20);
        const hi = Math.max(...rollers.map((h) => rolls[h]));
        if (rollers.filter((h) => rolls[h] === hi).length === 1) break;
      }
      winner = rollers.slice().sort((a, b) => (rolls[b] - rolls[a]) || (a === sc.by ? -1 : b === sc.by ? 1 : 0))[0];
    }
    const idx = sc.votes[winner];
    let res = null;
    A.State.withHero(A.State.heroById(winner), () => { res = doChoose(idx, sc); });
    if (sc.result) {
      sc.result.vote = {
        agreed,
        majority,
        winner,
        winnerName: heroName(winner),
        votes: ids.map((h) => ({ hid: h, name: heroName(h), label: (sc.options[sc.votes[h]] || {}).label || '' })),
        rolls: rolls ? rollers.map((h) => ({ hid: h, name: heroName(h), d: rolls[h] })) : null,
      };
      A.State.openModal('event', sc);
    }
    return res;
  }

  /** Elegir una opción de la escena abierta (en grupo: votar). opts.force: no esperar al otro. */
  function choose(idx, opts = {}) {
    const sc = current();
    if (!sc || sc.stage !== 'choose') return null;
    const opt = sc.options[idx];
    if (!opt || optionBlocked(opt)) return null;
    const voters = votersOf(sc);
    if (voters.length > 1) {
      const me = A.State.hidOf(player());
      sc.votes = Object.assign({}, sc.votes || {}, { [me]: idx });
      sc.votedAt = Object.assign({}, sc.votedAt || {}, { [me]: Date.now() });
      const all = voters.every((h) => sc.votes[A.State.hidOf(h)] != null);
      if (!all && !(opts && opts.force)) {
        A.State.addChronicle({ type: 'note', text: `${player().name} votó: ${opt.label.toLowerCase()}.` });
        A.State.openModal('event', sc);
        return { voted: true };
      }
      return resolveVotes(sc, voters);
    }
    return doChoose(idx, sc);
  }

  function doChoose(idx, sc) {
    const opt = sc.options[idx];
    if (!opt) return null;
    const region = A.Data.getById('regions', sc.regionId) || regionNow();
    const p = player();

    let rollRes = null;
    let outcome = opt.ok;
    if (opt.check) {
      // v3.3: en grupo, algunas tiradas las hace el más hábil (best) o se ayudan entre todos (together: +1 por compañero)
      const pr = partyRoll(opt.check, sc, p);
      rollRes = pr.roller === p ? roll(opt.check, sc.tier, p, pr.extra) : A.State.withHero(pr.roller, () => roll(opt.check, sc.tier, pr.roller, pr.extra));
      if (pr.best) { rollRes.by = pr.roller.name; rollRes.byHid = A.State.hidOf(pr.roller); }
      if (pr.help) rollRes.help = pr.help;
      outcome = rollRes.success ? opt.ok : (opt.fail || { text: 'No sale como esperabas.' });
    }
    outcome = outcome || { text: '' };
    // v3.3: lo que cuesta una opción se paga justo lo que decía el botón (antes variaba un poco)
    const needs = opt.needs || {};
    if (needs.coins && typeof outcome.coins === 'number' && outcome.coins < 0 && !outcome.coinsFlat) {
      outcome = { ...outcome, coins: -Math.max(1, Math.round(coinUnit(sc.tier) * needs.coins)), coinsFlat: true };
    }
    // v2.1: salir bien de una tirada también enseña algo (un poco de experiencia)
    if (rollRes && rollRes.success && !outcome.fight && !outcome.study) outcome = { ...outcome, xp: (outcome.xp || 0) + 0.3 };
    // v3.1: observar: al bestiario de los que están ahí, y se vuelve a elegir con +2
    let studied = [];
    if (outcome.study && sc.enemies && sc.enemies.length) {
      for (const h of groupHeroes()) A.State.withHero(h, () => { const fresh = A.Bestiary ? A.Bestiary.study(sc.enemies) : []; if (h === p) studied = fresh; });
    }

    // v3.2: en grupo lo bueno se reparte y lo malo les toca a todos
    // v3.3: lo que pide la opción (monedas o comida) lo pone el que eligió
    const paid = { coins: !!needs.coins, food: !!needs.food };
    const applied = sc.party ? applyGroupOutcome(outcome, { tier: sc.tier, region, title: sc.title, paid }) : { chips: applyOutcome(outcome, { tier: sc.tier, region, title: sc.title }), group: null };
    const chips = applied.chips;

    // Pelea: los enemigos de la escena, o unos nuevos de la zona
    let fight = null;
    if (outcome.fight) {
      const enemies = (sc.enemies && sc.enemies.length) ? sc.enemies : (sc.foes && sc.foes.length ? sc.foes : A.Encounter.generate(region.id));
      if (enemies && enemies.length) {
        fight = { enemies, surprise: !!outcome.fight.surprise, ambush: !!outcome.fight.ambush };
        // v2.5: heridos por la sorpresa, lo que te hicieron antes de empezar, envalentonados
        if (outcome.fight.wound) fight.wound = outcome.fight.wound;
        if (outcome.fight.opening) fight.opening = outcome.fight.opening;
        if (outcome.fight.rally) fight.rally = true;
        if (outcome.fight.guard) fight.guard = true;
      }
    }

    // v3.0: en grupo la pelea arranca con lo que le pasó al que eligió
    if (fight && sc.party) fight.openingHid = A.State.hidOf(p);
    sc.stage = 'result';
    sc.result = {
      hid: sc.party ? A.State.hidOf(p) : undefined, // v3.0: quién eligió (para contarlo en tercera persona al otro)
      by: sc.party ? p.name : undefined,
      optionIdx: idx,
      label: opt.label,
      check: opt.check || null,
      roll: rollRes,
      success: rollRes ? rollRes.success : true,
      text: outcome.text || '',
      chips,
      group: applied.group, // v3.2: lo que le tocó a cada uno
      fight,
      tame: !!outcome.tame,
      // v3.1: observar sale bien: se vuelve a elegir (sin "observar" y con +2)
      again: !!(outcome.study && !fight),
      plural: !!sc.plural, // v3.3: texto en plural: no se pasa a tercera persona
      studied: studied.map((id) => { const d = A.Data.getById('enemies', id); return d ? d.name : id; }),
    };

    // Crónica: una sola línea por escena
    const chipLine = chips.map(chipText).filter(Boolean).join(', ');
    const rollLine = rollRes ? ` (${STATS[opt.check.stat] ? STATS[opt.check.stat].label : 'Tirada'}: ${rollRes.d}${rollRes.mod ? `+${rollRes.mod}` : ''} contra ${rollRes.dc}, ${rollRes.success ? 'éxito' : 'fallo'})` : '';
    A.State.addChronicle({
      type: fight ? 'combat' : (chips.some((c) => c.kind === 'coins' || c.kind === 'item') ? 'loot' : 'note'),
      text: `${sc.title}: ${opt.label.toLowerCase()}${rollLine}. ${outcome.text}${chipLine ? ` ${chipLine}.` : ''}`.trim(),
    });
    // v3.2: a cada compañero, lo que le tocó a él
    for (const g of applied.group || []) {
      if (g.hid === A.State.hidOf(p) || !g.chips.length) continue;
      const h = A.State.heroById(g.hid);
      const line = g.chips.map(chipText).filter(Boolean).join(', ');
      if (h && line) A.State.withHero(h, () => A.State.addChronicle({ type: g.chips.some((c) => c.kind === 'coins' || c.kind === 'item') ? 'loot' : 'note', text: `${sc.title} (eligió ${p.name}): ${line}.` }));
    }

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
    // v3.1: después de observar se vuelve a elegir, con +2 a la tirada
    if (res && res.again) {
      sc.stage = 'choose';
      sc.result = null;
      sc.options = sc.options.filter((o) => !o.observe);
      sc.bonus = (sc.bonus || 0) + 2;
      sc.text = `${sc.text.replace(/\s*Ya sabés por dónde ir\.$/, '')} Ya sabés por dónde ir.`;
      tagPartyOptions(sc);
      A.State.openModal('event', sc);
      return;
    }
    A.State.closeModal();
    if (!res) return;
    if (res.fight) {
      const f = res.fight;
      const opening = (f.opening || []).slice();
      // v3.1: de frente, con la guardia alta
      if (f.guard) opening.push({ type: 'buff', source: 'guardia', name: 'Guardia alta', mods: { defense: 2 }, turns: 2, say: 'Arrancás con la guardia alta: por dos turnos cuesta más pegarte.' });
      // v2.5: el ataque por sorpresa les saca un pedazo de vida antes de empezar
      if (f.wound) {
        for (const e of f.enemies) if (e.hp > 0) e.hp = Math.max(1, Math.round(e.hp - (e.maxHp || e.hp) * f.wound));
        const femOne = f.enemies.length === 1 && A.Narrator && A.Narrator.isFem ? A.Narrator.isFem(f.enemies[0].id) : false;
        opening.push({ type: 'note', say: f.enemies.length > 1 ? 'Tu ataque por sorpresa los dejó heridos: arrancan con menos vida.' : femOne ? 'Tu ataque por sorpresa la dejó herida: arranca con menos vida.' : 'Tu ataque por sorpresa lo dejó herido: arranca con menos vida.', tone: 'good' });
      }
      if (f.rally) {
        for (const e of f.enemies) { e.effects = e.effects || []; e.effects.push({ type: 'rally', turns: 2, value: 1, source: 'explore' }); }
      }
      A.Combat.start({ enemies: f.enemies, surprise: f.surprise, ambush: f.ambush, opening, openingHid: f.openingHid, fromTravel: false });
    } else if (res.tame && sc.enemies && sc.enemies[0]) {
      const payload = { enemyId: sc.enemies[0].id, fromTravel: false };
      // v3.0: si quiso domarla el compañero, la pantalla de domar se abre en su compu
      if (res.hid && A.Party && A.Party.openRemoteModal && res.hid !== A.State.hidOf(A.State.me())) A.Party.openRemoteModal(res.hid, 'tame', payload);
      else A.State.openModal('tame', payload);
    }
  }

  // ============================================================
  // Descansar
  // ============================================================

  /**
   * v2.3: descansar ya no cura todo ni se puede repetir sin parar.
   *   gain: parte de la vida (y el maná) que recuperás
   *   cap:  hasta dónde podés llegar descansando afuera (parte de la vida máxima)
   *   food: comida que gasta (descansar da hambre)
   * En la posada (pagando) te recuperás del todo: eso no pasa por acá.
   */
  const REST = {
    nap: { gain: 0.15, cap: 0.5, food: 1 },     // siesta de día
    wild: { gain: 0.4, cap: 0.75, food: 2 },    // dormir al raso
    town: { gain: 0.5, cap: 0.75, food: 2 },    // dormir en el pueblo sin pagar
    ambush: 0.25,                               // 1 de cada 4 noches al raso algo se acerca
  };

  function restKind(region) {
    if (!A.Time || !A.Time.isNight()) return 'nap';
    return region && region.type === 'safe' ? 'town' : 'wild';
  }

  /** ¿Ya descansaste y todavía no te moviste? */
  function restLocked() {
    const w = A.State.world;
    return !!(w && w.restLock);
  }
  function clearRestLock() {
    const w = A.State.world;
    if (w && w.restLock) { w.restLock = false; }
  }

  /** Lo que la pantalla muestra en el botón de descansar. */
  function restInfo() {
    const region = regionNow();
    const kind = restKind(region);
    const cfg = REST[kind];
    const pctTxt = (x) => (x >= 0.75 ? 'tres cuartos' : x >= 0.5 ? 'la mitad' : `${Math.round(x * 100)}%`);
    if (restLocked()) {
      return { kind, locked: true, label: kind === 'nap' ? 'Descansar' : 'Dormir', desc: 'Ya descansaste. Explorá o viajá antes de volver a descansar.' };
    }
    if (kind === 'nap') return { kind, label: 'Descansar', desc: `Un rato a la sombra. Te cura hasta ${pctTxt(cfg.cap)} de la vida.` };
    if (kind === 'town') return { kind, label: 'Dormir', desc: `Hasta mañana. Te cura hasta ${pctTxt(cfg.cap)} de la vida (en la posada, todo).` };
    return { kind, label: 'Dormir', desc: `Hasta mañana, al raso: hasta ${pctTxt(cfg.cap)} de la vida. Algo podría acercarse.` };
  }

  /** Cuánto recuperás (en puntos) sin pasar del tope. */
  function restGain(cur, max, gain, cap) {
    if (!max) return 0;
    const room = Math.floor(max * cap) - cur;
    if (room <= 0) return 0;
    return Math.min(Math.max(1, Math.round(max * gain)), room);
  }

  /**
   * Descansar en la zona actual. Devuelve { kind, text, chips } para mostrar.
   *   de día   -> siesta: +15% de vida y maná (hasta la mitad), pasa a la fase siguiente
   *   de noche -> dormís hasta la mañana: +40% al raso, +50% en el pueblo (hasta 3/4)
   *               al raso, 1 de cada 4 noches algo se acerca
   *   después hay que moverse (explorar, pelear o viajar) para volver a descansar
   */
  function rest() {
    // v3.0: en grupo descansan todos juntos (el tiempo pasa una sola vez)
    if (inGroup()) return restGroup();
    return restOne();
  }

  /** v3.0: descanso del grupo: cada uno se cura lo suyo; de noche, una sola emboscada para todos. */
  function restGroup() {
    const caller = player();
    const heroes = groupHeroes();
    // El que tocó Descansar decide la noche (y si algo se acerca); los demás se curan y comen igual
    const lead = heroes.find((h) => h === caller) || heroes[0];
    const others = heroes.filter((h) => h !== lead);
    const w = A.State.world;
    const night = !!(A.Time && A.Time.isNight());
    const out = A.State.withHero(lead, () => restOne());
    if (!out || out.kind === 'locked' || out.kind === 'night-event') return out;
    for (const h of others) {
      A.State.withHero(h, () => {
        if (w) w.restLock = false;
        const r = restOne({ noAmbush: true, noTime: true, night });
        if (r && r.text && A.Party && A.Party.notify) A.Party.notify(A.State.hidOf(h), { icon: night ? 'moon' : 'tent', text: r.text, chips: r.chips || [] });
      });
    }
    if (w) w.restLock = true;
    A.State.persist();
    return out;
  }

  function restOne(o = {}) {
    const p = player();
    const region = regionNow();
    if (!p || !region || !A.Time) return null;
    if (restLocked()) {
      return { kind: 'locked', text: 'Ya descansaste. Para volver a descansar tenés que moverte: explorá, peleá o viajá. Para recuperarte del todo, la posada del pueblo.', chips: [] };
    }
    const kind = o.night != null ? (!o.night ? 'nap' : region.type === 'safe' ? 'town' : 'wild') : restKind(region);
    const cfg = REST[kind];
    const hungry = A.Survival ? A.Survival.getStatus() : null;
    const penalty = hungry && hungry.penalties && hungry.penalties.restPenalty ? (hungry.id === 'starving' ? 0.2 : 0.5) : 1;
    const gain = cfg.gain * penalty;

    const heal = (share) => {
      const chips = [];
      const hp = restGain(p.hp, p.maxHp, share, cfg.cap);
      if (hp > 0) {
        const before = p.hp;
        A.State.healHp(hp);
        if (p.hp > before) chips.push({ kind: 'heal', value: p.hp - before });
      }
      if (p.hasMagic) {
        const mp = restGain(p.mana, p.maxMana, share, cfg.cap);
        if (mp > 0) {
          const before = p.mana;
          A.State.setMana(Math.min(p.maxMana, p.mana + mp));
          if (p.mana > before) chips.push({ kind: 'mana', value: p.mana - before });
        }
      }
      return chips;
    };
    const eat = () => {
      if (!cfg.food || !A.State.modifyFood) return [];
      const before = p.food || 0;
      A.State.modifyFood(-cfg.food);
      const diff = (p.food || 0) - before;
      return diff ? [{ kind: 'food', value: diff }] : [];
    };
    const capNote = (chips) => (chips.some((c) => c.kind === 'heal') || p.hp >= p.maxHp ? '' : ` Descansando sin posada no pasás de ${cfg.cap >= 0.75 ? 'tres cuartos' : 'la mitad'} de tu vida: para curarte del todo, la posada o una poción.`);
    const w = A.State.world;

    if (kind === 'nap') {
      const chips = heal(gain).concat(eat());
      if (!o.noTime) {
        const toNext = A.Time.PHASE_DURATION - ((w.timeProgress || 0) % A.Time.PHASE_DURATION);
        A.Time.advance(toNext, 'nap');
      }
      w.restLock = true;
      const got = chips.filter((c) => c.kind !== 'food');
      const text = `Descansaste un rato${region.type === 'safe' ? '' : ' a la sombra'}. ${got.length ? got.map(chipText).join(', ') + '.' : 'No te sirvió de mucho.'}${capNote(chips)}`;
      A.State.addChronicle({ type: 'rest', text });
      A.State.persist();
      return { kind: 'nap', text, chips };
    }

    // Noche
    const enemiesHere = A.Data.enemiesInRegion(region.id).length > 0;
    if (kind === 'wild' && enemiesHere && !o.noAmbush && Math.random() < REST.ambush) {
      // Dormís un poco y algo se acerca
      heal(gain / 2);
      eat();
      A.Time.passTo('morning');
      w.restLock = true;
      let group = A.Encounter.generate(region.id, { at: 'night' }); // las de la noche (ya pasó a la mañana)
      if (group && group.length) {
        if (A.Combat && A.Combat.prepareGroup) group = A.Combat.prepareGroup(group); // v3.3: en grupo, todas las que vienen
        const nightScene = creatureScene(region, group, { night: true });
        noteSeen(nightScene);
        if (inGroup()) { nightScene.party = true; nightScene.by = A.State.hidOf(player()); }
        A.State.openModal('event', nightScene);
        A.State.persist();
        return { kind: 'night-event' };
      }
    }
    const chips = heal(gain);
    // La mascota también duerme
    if (p.pet && p.pet.maxHealth) {
      const before = p.pet.health;
      p.pet.health = Math.min(p.pet.maxHealth, p.pet.health + Math.ceil(p.pet.maxHealth * gain));
      if (p.pet.health > before) chips.push({ kind: 'pet', value: p.pet.health - before });
    }
    const food = eat();
    if (!o.noTime) A.Time.passTo('morning');
    w.restLock = true;
    const where = kind === 'town' ? 'en un rincón tranquilo del pueblo' : 'al raso, con un ojo abierto,';
    const got = chips.filter((c) => c.kind !== 'pet');
    const text = `Dormiste ${where} hasta la mañana. ${got.length ? got.map(chipText).join(', ') + '.' : 'Ya estabas descansado.'}${capNote(chips)}`;
    A.State.addChronicle({ type: 'rest', text });
    A.State.persist();
    return { kind: 'sleep', text, chips: chips.concat(food) };
  }

  // Moverse destraba el descanso: pelear, viajar o pagar la posada
  if (A.Bus) {
    A.Bus.on('combat:ended', clearRestLock, { sys: true });
    A.Bus.on('region:changed', clearRestLock, { sys: true });
    A.Bus.on('rest:done', clearRestLock, { sys: true });
  }

  A.Rewards = { apply: applyOutcome, chipText, gainXp, coinUnit, xpUnit };

  A.Explore = {
    STATS,
    statMod,
    sheet,
    _creatureScene: creatureScene, // v2.5: para las pruebas
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
    restInfo,
    restLocked,
    REST,
    creatureScene,
    unlucky, // v3.3: a quiénes les toca lo malo en grupo
    partyRoll, // v3.3: quién tira en grupo (best / together)
  };
})(window.Aventurs);
