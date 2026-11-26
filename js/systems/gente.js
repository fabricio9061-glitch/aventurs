/* ============================================================
   Aventurs — Gente en el camino (v3.21.0)

   A veces, viajando, te cruzás con alguien y elegís qué hacer:
   Mercader ambulante - te ofrece dos cosas: a veces barato, a veces caro.
   Herido             - le podés dar una poción o algo de comer, y te lo
                        agradece con monedas y experiencia. En zonas con
                        bandidos, a veces es una trampa.
   Bandidos           - te cobran peaje: pagás, peleás o intentás escaparte
                        (si te ven, te atacan primero).
   El viaje no sigue hasta que decidas. En grupo elige cualquiera:
   el que paga o da algo es el que tocó el botón.
   ============================================================ */

(function (A) {
  'use strict';

  const St = () => A.State;
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const esc = (s) => (A.Utils && A.Utils.escapeHtml ? A.Utils.escapeHtml(s) : String(s));

  function tierOf(region) { return Math.max(1, (region && Array.isArray(region.tier) ? region.tier[0] : 1) || 1); }
  function coinUnit(tier) { return A.Balance && A.Balance.Economy ? A.Balance.Economy.coinBase(tier) : 3; }
  function xpUnit(tier) { return A.Progression && A.Progression.xpForEnemy ? A.Progression.xpForEnemy({ tier, category: 'normal' }) : 10; }
  function price(n) { return A.Currency && A.Currency.formatPrice ? A.Currency.formatPrice(n) : `${n} de cobre`; }
  function itemName(id) { const d = A.Inventory && A.Inventory.resolveData ? A.Inventory.resolveData(id) : A.Data.getById('items', id); return (d && d.name) || id; }
  function shopPrice(id) {
    const p = A.NPC && A.NPC.getNpcSellPrice ? A.NPC.getNpcSellPrice({}, id) : null;
    if (p) return p;
    const d = A.Data.getById('items', id);
    return Math.max(1, (d && d.value) || 1);
  }

  /** Lo que lleva el mercader, según lo peligroso de la zona. */
  const WARES = [
    { upTo: 3, items: ['pocion_curacion_menor', 'pocion_mana_menor', 'antidoto', 'te_de_hierbas', 'pan', 'queso', 'carne_seca', 'hierba_vida'] },
    { upTo: 6, items: ['pocion_curacion', 'pocion_mana', 'pocion_velocidad', 'pocion_piel_piedra', 'elixir_fuerza', 'pocion_regeneracion', 'carne_seca', 'hierba_vida'] },
    { upTo: 99, items: ['pocion_curacion_mayor', 'pocion_mana_mayor', 'pocion_invisibilidad', 'pocion_regeneracion', 'elixir_fuerza', 'hierba_vida', 'elixir_vida'] },
  ];
  /** Lo que sirve para curar al herido (de lo más barato a lo más caro). */
  const CURES = ['te_de_hierbas', 'pocion_curacion_menor', 'pocion_curacion', 'pocion_curacion_mayor'];
  const FOOD_GIVE = 6;

  /** Bandidos solo donde la zona no es tan brava (más arriba, nadie se anima a cobrar peaje). */
  function banditsHere(region, dangerous) { return dangerous && tierOf(region) <= 6 && !!A.Data.getById('enemies', 'bandido'); }

  function banditGroup(tier) {
    const ids = tier <= 2 ? ['bandido'] : tier <= 4 ? ['bandido', 'bandido'] : ['bandido', 'bandido', 'contrabandista'];
    let g = ids.map((id) => A.Data.getById('enemies', id)).filter(Boolean).map((e) => A.Encounter.spawnInstance(e));
    if (A.Combat && A.Combat.prepareGroup) g = A.Combat.prepareGroup(g);
    return g;
  }
  function banditEvent(region, extra) {
    const tier = tierOf(region);
    const enemies = banditGroup(tier);
    if (!enemies.length) return null;
    return Object.assign({
      kind: 'people', who: 'bandits', resolved: false, tier,
      enemies, enemyId: enemies[0].id, enemyName: A.Encounter.describeGroup(enemies),
      toll: Math.max(10, Math.round(coinUnit(tier) * 8)),
      text: 'Unos bandidos te cierran el paso.',
    }, extra || {});
  }

  /** Arma a alguien en el camino (o null si no hay nadie para esta zona). */
  function make(region, opts = {}) {
    const dangerous = !!opts.dangerous;
    const tier = tierOf(region);
    const kinds = { merchant: 4, wounded: 3 };
    if (banditsHere(region, dangerous)) kinds.bandits = 3;
    const who = A.Utils.weightedPick(kinds);
    if (who === 'merchant') {
      const pool = (WARES.find((w) => tier <= w.upTo) || WARES[WARES.length - 1]).items.filter((id) => A.Data.getById('items', id));
      const offers = [];
      while (offers.length < 2 && pool.length) {
        const id = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        const cheap = Math.random() < 0.4;
        offers.push({ itemId: id, price: Math.max(1, Math.round(shopPrice(id) * (cheap ? 0.7 : 1.3))), cheap, sold: false });
      }
      if (!offers.length) return null;
      return { kind: 'people', who: 'merchant', resolved: false, tier, offers, text: 'Un mercader ambulante tira de su carro por el camino.' };
    }
    if (who === 'wounded') {
      const trap = banditsHere(region, dangerous) && Math.random() < 0.15;
      return {
        kind: 'people', who: 'wounded', resolved: false, tier, trap,
        coins: Math.max(5, Math.round(coinUnit(tier) * (5 + Math.random() * 3))),
        xp: Math.max(5, Math.round(xpUnit(tier) * 1.5)),
        text: 'Alguien está tirado al costado del camino y te pide ayuda.',
      };
    }
    return banditEvent(region);
  }

  // ---------------- Lo que se puede elegir ----------------

  function cureIn(p) {
    for (const id of CURES) if ((p.inventory || []).some((s) => s.itemId === id && s.qty > 0)) return id;
    return null;
  }

  /** Los botones: [{ id, label, sub, ok, why, tone }]. */
  function options(ev) {
    const p = St().player;
    const group = (A.Party && A.Party.combatHeroes ? (A.Party.combatHeroes() || []) : []).length > 1;
    if (!ev || !p) return [];
    if (ev.who === 'merchant') {
      const out = ev.offers.map((o, i) => ({
        id: `buy:${i}`, item: o.itemId, label: `Comprar ${itemName(o.itemId)}`, price: o.price, cheap: o.cheap,
        ok: !o.sold && A.Currency.canPay(o.price) && (!A.State.canAddItem || A.State.canAddItem(o.itemId)) && !(A.State.itemAtCap && A.State.itemAtCap(o.itemId)),
        why: o.sold ? 'Ya lo compraste' : !A.Currency.canPay(o.price) ? 'No te alcanza' : 'No te entra en la mochila',
        sold: o.sold,
      }));
      out.push({ id: 'leave', label: ev.offers.some((o) => o.sold) ? 'Gracias, seguir' : 'No, gracias', ok: true, tone: 'ghost' });
      return out;
    }
    if (ev.who === 'wounded') {
      const cure = cureIn(p);
      return [
        { id: 'potion', label: 'Darle una poción', title: cure ? `Le das ${itemName(cure)}` : '', ok: !!cure, why: 'No tenés pociones de vida', tone: 'primary', icon: 'potion' },
        { id: 'food', label: `Compartir tu comida (−${FOOD_GIVE})`, ok: (p.food || 0) >= FOOD_GIVE, why: 'Tenés muy poca comida', tone: 'secondary', icon: 'food' },
        { id: 'leave', label: 'Seguir de largo', ok: true, tone: 'ghost' },
      ];
    }
    if (ev.who === 'bandits') {
      const n = group ? (A.Party.combatHeroes() || []).length : 1;
      const toll = ev.toll * n;
      const odds = A.Travel && A.Travel.avoidOdds ? A.Travel.avoidOdds(ev) : { chancePct: 50 };
      return [
        { id: 'pay', label: group ? `Pagar por todos` : 'Pagar el peaje', price: toll, ok: A.Currency.canPay(toll), why: 'No te alcanza', tone: 'secondary', icon: 'coins' },
        { id: 'fight', label: 'Pelear', ok: true, tone: 'primary', icon: 'swords' },
        { id: 'flee', label: `Escaparse (${odds.chancePct}%)`, ok: true, tone: 'ghost', icon: 'run' },
      ];
    }
    return [];
  }

  // ---------------- Hacerlo ----------------

  function gainXp(n) {
    const p = St().player;
    if (!p || n <= 0) return;
    p.xp = (p.xp || 0) + n;
    A.Bus.emit('player:xp-changed', { current: p.xp });
    const ups = A.Progression ? A.Progression.checkLevelUp(p) : [];
    for (const lv of ups) {
      St().addChronicle({ type: 'system', text: `¡Subiste al nivel ${lv.level}! ${lv.text}. Te recuperás por completo.` });
      A.Bus.emit('player:leveled', { newLevel: lv.level });
      A.Bus.emit('player:hp-changed', { current: p.hp });
    }
  }

  const THANKS = [
    'Te agarra la mano y no te suelta hasta darte unas monedas.',
    'Se levanta despacio y te da lo poco que tiene. Insiste.',
    'Te cuenta por dónde no conviene ir, y te paga como puede.',
  ];

  /**
   * Hace lo elegido. Devuelve { ok, error?, done?, fight?, ambush? }.
   * done: el encuentro terminó. fight: hay que arrancar la pelea (lo hace Travel).
   */
  function act(ev, choice) {
    const S = St();
    const p = S.player;
    const opt = options(ev).find((o) => o.id === choice);
    if (!opt) return { ok: false, error: 'Eso no se puede ahora.' };
    if (!opt.ok) return { ok: false, error: opt.why || 'Eso no se puede ahora.' };
    const me = p.name || 'Alguien';
    const group = (A.Party && A.Party.combatHeroes ? (A.Party.combatHeroes() || []) : []).length > 1;

    if (ev.who === 'merchant') {
      if (choice === 'leave') {
        const bought = ev.offers.filter((o) => o.sold).map((o) => itemName(o.itemId));
        ev.resolved = true;
        ev.text = bought.length ? `Le compraste ${bought.join(' y ')} al mercader ambulante.` : 'Saludaste al mercader ambulante y seguiste.';
        return { ok: true, done: true };
      }
      const o = ev.offers[+choice.split(':')[1]];
      if (!A.Currency.pay(o.price)) return { ok: false, error: 'No te alcanza.' };
      S.addItem(o.itemId, 1);
      o.sold = true;
      o.by = group ? me : null;
      S.addChronicle({ type: 'shop', text: `${group ? `${me} le compró` : 'Le compraste'} ${itemName(o.itemId)} a un mercader ambulante por ${price(o.price)}.` });
      A.Bus.emit('inventory:changed');
      if (ev.offers.every((x) => x.sold)) {
        ev.resolved = true;
        ev.text = `Le ${group ? `compraron` : 'compraste'} todo al mercader ambulante. Se va silbando.`;
        return { ok: true, done: true };
      }
      return { ok: true };
    }

    if (ev.who === 'wounded') {
      if (choice === 'leave') {
        ev.resolved = true;
        ev.text = 'Seguiste de largo. Atrás, alguien se queja.';
        return { ok: true, done: true };
      }
      if (ev.trap) {
        // era una trampa: los bandidos salen de atrás de los árboles (no le diste nada)
        const region = A.Data.getById('regions', (S.traveling && S.traveling.toId) || '');
        const b = banditEvent(region, { text: '' });
        if (!b) { ev.trap = false; return act(ev, choice); }
        ev.resolved = true;
        ev.text = 'Era una trampa: el herido se levantó riendo y salieron bandidos de atrás de los árboles.';
        Object.assign(ev, { enemies: b.enemies, enemyId: b.enemyId, enemyName: b.enemyName });
        S.addChronicle({ type: 'travel', text: `Te acercaste a ayudar a un herido, pero era una trampa: ${b.enemyName} te atacan primero.` });
        return { ok: true, done: true, fight: true, ambush: true };
      }
      if (choice === 'potion') {
        const id = cureIn(p);
        S.removeItem(id, 1);
        A.Currency.add(ev.coins);
        gainXp(ev.xp);
        ev.resolved = true;
        ev.text = `${group ? `${me} le dio` : 'Le diste'} ${itemName(id)} al herido. ${pick(THANKS)} (+${price(ev.coins)}, +${ev.xp} de experiencia)`;
      } else {
        S.modifyFood(-FOOD_GIVE);
        const coins = Math.max(2, Math.round(ev.coins / 3));
        A.Currency.add(coins);
        gainXp(ev.xp);
        ev.resolved = true;
        ev.text = `${group ? `${me} compartió` : 'Compartiste'} la comida con el herido. Recupera el color y te da lo que tiene. (+${price(coins)}, +${ev.xp} de experiencia)`;
      }
      S.addChronicle({ type: 'travel', text: ev.text });
      A.Bus.emit('inventory:changed');
      return { ok: true, done: true };
    }

    if (ev.who === 'bandits') {
      if (choice === 'pay') {
        if (!A.Currency.pay(opt.price)) return { ok: false, error: 'No te alcanza.' };
        ev.resolved = true;
        ev.text = `${group ? `${me} pagó` : 'Pagaste'} ${price(opt.price)} de peaje y los bandidos ${group ? 'los' : 'te'} dejaron pasar.`;
        S.addChronicle({ type: 'travel', text: ev.text });
        return { ok: true, done: true };
      }
      if (choice === 'fight') {
        ev.resolved = true;
        ev.text = `${group ? 'Pelearon' : 'Peleaste'} contra los bandidos del camino.`;
        return { ok: true, done: true, fight: true };
      }
      if (choice === 'flee') {
        const r = A.Travel.rollAvoid(ev);
        const dice = `dado ${r.roll}+${r.speedBonus} contra ${r.dc}`;
        ev.resolved = true;
        if (r.success) {
          ev.text = `${group ? `${me} los llevó por un atajo y se escaparon` : 'Te escapaste por un atajo'} de los bandidos.`;
          S.addChronicle({ type: 'travel', text: `${ev.text} (${dice})` });
          return { ok: true, done: true };
        }
        ev.text = `Los bandidos ${group ? 'los' : 'te'} alcanzaron.`;
        S.addChronicle({ type: 'travel', text: `${group ? 'Quisieron' : 'Quisiste'} escaparte de los bandidos, pero ${group ? 'los' : 'te'} alcanzaron (${dice}). Atacan primero.` });
        return { ok: true, done: true, fight: true, ambush: true };
      }
    }
    return { ok: false, error: 'Eso no se puede ahora.' };
  }

  /** Cómo se dibuja: título, quién es y qué dice. */
  function look(ev) {
    if (ev.who === 'merchant') return { title: 'Un mercader ambulante', say: '¡Buenas! Llevo poco, pero bueno. ¿Te interesa algo?', npc: { look: 'merchant' } };
    if (ev.who === 'wounded') return { title: 'Un herido en el camino', say: 'Por favor… me asaltaron. No llego al pueblo así.', npc: { look: 'villager' } };
    return { title: 'Bandidos', say: `Este camino es nuestro. Para pasar, ${price(ev.toll)} por cabeza. O lo sacamos de tus bolsillos.`, enemy: ev.enemyId };
  }

  A.Gente = { make, options, act, look, esc };
})(window.Aventurs);
