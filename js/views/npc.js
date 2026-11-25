/* ============================================================
   Aventurs — Pantalla del habitante (v2.0)
   Registrada como A.ModalViews.npc (reemplaza la vieja).

   Arriba: retrato, nombre, oficio y tu bolsa.
   Pestañas (solo las que tiene ese habitante):
     Hablar    - lo que dice + sus misiones (aceptar / entregar)
     Comprar   - objetos dibujados; al tocar uno, el detalle y si es
                 mejor o peor que lo que tenés puesto
     Vender    - lo que tenés en la mochila, a la mitad de su valor
     Aprender  - hechizos (sabios)
     Forjar    - recetas (herrero)
     Posada    - dormir y comer (tabernera)
   ============================================================ */

(function (A) {
  'use strict';

  const U = () => A.UI;
  const ROLE = {
    merchant: 'Mercader', shopkeeper: 'Comerciante', vendor: 'Vendedor', blacksmith: 'Herrero',
    innkeeper: 'Posadero', tavernkeeper: 'Tabernera', healer: 'Curandero', priest: 'Sacerdote',
    sage: 'Sabio', wizard: 'Mago', mage: 'Mago', quest: 'Tiene un encargo', guard: 'Guardia', captain: 'Capitana del puerto',
  };
  const RARITY = { common: 'Común', uncommon: 'Poco común', rare: 'Raro', epic: 'Épico', legendary: 'Legendario' };

  // v3.9: lo que da el plato caliente de la posada
  const INN_FOOD = 10;
  const INN_HEAL = 0.15;
  function npcOf(id) { return A.Data.getById('npcs', id); }
  function player() { return A.State.player; }
  function kindOf(id) {
    if (A.Data.getById('weapons', id)) return 'weapon';
    if (A.Data.getById('armors', id)) return 'armor';
    const it = A.Data.getById('items', id);
    if (it && it.subtype === 'bag') return 'bag';
    if (it && it.subtype === 'accessory') return 'accessory';
    if (A.Data.getById('bags', id)) return 'bag';
    return 'item';
  }
  function priceOf(npc, id) { return A.NPC.getNpcSellPrice(npc, id) || 0; }
  function sellPrice(data) { return Math.max(1, Math.floor((data.value || 0) / 2)); }

  /** v3.3: los talleres de un habitante (los herreros, si no dicen nada: forja y encantamiento). */
  function workshopsOf(npc) {
    if (Array.isArray(npc.crafts)) return npc.crafts;
    return npc.role === 'blacksmith' ? ['forge', 'enchant'] : [];
  }

  function tabsFor(npc) {
    const p = player();
    const tabs = [{ id: 'talk', label: 'Hablar', icon: 'talk' }];
    if ((npc.sells || []).length) {
      tabs.push({ id: 'buy', label: 'Comprar', icon: 'shop' });
      tabs.push({ id: 'sell', label: 'Vender', icon: 'coins' });
    }
    if ((npc.teaches || []).length && p && p.hasMagic) tabs.push({ id: 'learn', label: 'Aprender', icon: 'book' });
    // v3.3: cada uno con su taller (los herreros, forja y encantamiento; algunos, alquimia)
    const ws = workshopsOf(npc);
    if (ws.includes('forge') || ws.includes('enchant')) tabs.push({ id: 'craft', label: ws.includes('forge') ? 'Forjar' : 'Encantar', icon: ws.includes('forge') ? 'anvil' : 'arcane' });
    if (ws.includes('alchemy')) tabs.push({ id: 'alchemy', label: 'Alquimia', icon: 'potion' });
    if (npc.services && npc.services.restCost != null) tabs.push({ id: 'inn', label: 'Posada', icon: 'tent' });
    return tabs;
  }

  // ============================================================
  // Comparar con lo equipado
  // ============================================================

  function bagData(id) {
    const it = A.Data.getById('items', id);
    const bagId = it && (it.equipsBag || it.bagId) ? (it.equipsBag || it.bagId) : id;
    return A.Data.getById('bags', bagId) || A.Data.getById('bags', String(id).replace(/^item_/, '')) || null;
  }

  /** v2.4: velocidad que te queda con esa arma y esa armadura (el peso que pase de 4 frena). */
  function speedWith(p, weapon, armor) {
    const free = (A.Balance && A.Balance.FREE_WEIGHT) || 4;
    const w = (weapon ? weapon.weight || 0 : 0) + (armor ? armor.weight || 0 : 0);
    return Math.max(1, ((p.stats && p.stats.speed) || 10) - Math.max(0, w - free));
  }

  /**
   * Devuelve { verdict: 'better'|'worse'|'same'|null, lines: [texto], note }
   */
  function compare(id) {
    const p = player();
    const kind = kindOf(id);
    const B = A.Balance;
    if (kind === 'weapon') {
      const cand = A.Data.getById('weapons', id);
      const curId = p.equipment.weapon;
      const cur = curId ? A.Data.getById('weapons', curId) : null;
      const fitC = B.weaponFit(p, cand);
      const fitE = cur ? B.weaponFit(p, cur) : { atk: 0, dmg: 0 };
      // v3.3: un mago no la puede usar (no es mágica) · v3.4: y un guerrero o un híbrido, una de mago
      if (fitC.blocked) return { verdict: 'blocked', lines: [], note: fitC.note, current: cur };
      const avgC = B.avgOf(cand.damage) + fitC.dmg;
      const avgE = cur ? B.avgOf(cur.damage) + fitE.dmg : 1;
      const spC = B.spellPowerOf ? B.spellPowerOf(p, cand) : 0;
      const spE = B.spellPowerOf ? B.spellPowerOf(p, cur) : 0;
      const dDmg = avgC - avgE;
      const dAtk = fitC.atk - fitE.atk;
      const dSp = p.hasMagic ? spC - spE : 0;
      const lines = [];
      lines.push({ label: 'Daño medio', value: avgC.toFixed(1), diff: dDmg });
      const precC = fitC.atk + (cand.precision || 0);
      const precE = fitE.atk + (cur && cur.precision ? cur.precision : 0);
      if (precC || precE) lines.push({ label: 'Precisión', value: `${precC >= 0 ? '+' : ''}${precC}`, diff: precC - precE });
      // v2.4: el peso frena
      const armorNow = p.equipment.armor ? A.Data.getById('armors', p.equipment.armor) : null;
      const spdC = speedWith(p, cand, armorNow);
      const spdE = speedWith(p, cur, armorNow);
      if (spdC !== spdE || (cand.weight || 0) > 4) lines.push({ label: 'Velocidad', value: `${spdC}`, diff: spdC - spdE });
      if (p.hasMagic) lines.push({ label: 'Poder mágico', value: `+${spC}`, diff: dSp });
      // v3.9: lo que deja al pegar (sangrado, veneno...)
      const procOf = (w) => (w && w.statusEffect && w.statusEffect.type ? `${Math.round((w.statusEffect.chance || 0) * 100)}% de ${(A.Combat && A.Combat.effectLabel ? A.Combat.effectLabel(w.statusEffect.type) : w.statusEffect.type).toLowerCase()}` : '');
      if (procOf(cand) || procOf(cur)) lines.push({ label: 'Al pegar', value: procOf(cand) || 'nada', diff: null, text: true });
      const type = B.classOf(p);
      const score = dDmg + (precC - precE) * 0.7 + dSp * (type === 'mage' ? 2 : 1) + (spdC - spdE) * 0.1;
      return { verdict: id === curId ? 'equipped' : score > 0.25 ? 'better' : score < -0.25 ? 'worse' : 'same', lines, note: fitC.note, current: cur };
    }
    if (kind === 'armor') {
      const cand = A.Data.getById('armors', id);
      const curId = p.equipment.armor;
      const cur = curId ? A.Data.getById('armors', curId) : null;
      const d = (cand.defense || 0) - (cur ? cur.defense || 0 : 0);
      const dd = (cand.dodge || 0) - (cur ? cur.dodge || 0 : 0);
      const weaponNow = p.equipment.weapon ? A.Data.getById('weapons', p.equipment.weapon) : null;
      const spdC = speedWith(p, weaponNow, cand);
      const spdE = speedWith(p, weaponNow, cur);
      const lines = [{ label: 'Armadura', value: `+${cand.defense || 0}`, diff: d }];
      if (cand.dodge || dd) lines.push({ label: 'Esquiva', value: `${(cand.dodge || 0) >= 0 ? '+' : ''}${cand.dodge || 0}`, diff: dd });
      if (spdC !== spdE || (cand.weight || 0) > 4) lines.push({ label: 'Velocidad', value: `${spdC}`, diff: spdC - spdE });
      const score = d + dd * 0.8 + (spdC - spdE) * 0.1;
      return { verdict: id === curId ? 'equipped' : score > 0.2 ? 'better' : score < -0.2 ? 'worse' : 'same', lines, current: cur };
    }
    if (kind === 'accessory') {
      const cur = p.equipment.accessory ? A.Data.getById('items', p.equipment.accessory) : null;
      const cand = A.Data.getById('items', id);
      // v3.9: lo que hace cada uno, uno al lado del otro (se lleva uno por vez)
      const what = (it) => (it && A.Accessories ? A.Accessories.describe(it) : []).join(' · ');
      const rank = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
      const lines = cand ? [{ label: 'Hace', value: what(cand) || '—', diff: null, text: true }] : [];
      if (cur && cur.id !== id) lines.push({ label: 'El tuyo', value: what(cur) || '—', diff: null, text: true });
      const dv = cur ? (rank[cand && cand.rarity] || 1) - (rank[cur.rarity] || 1) : 1;
      return { verdict: id === p.equipment.accessory ? 'equipped' : !cur ? 'better' : dv > 0 ? 'better' : dv < 0 ? 'worse' : 'same', lines, current: cur, note: cur ? 'Se lleva uno por vez: elegí el que más te sirva.' : '' };
    }
    if (kind === 'bag') {
      const cand = bagData(id);
      const cur = A.Data.getById('bags', p.bagId);
      if (!cand) return { verdict: null, lines: [] };
      const d = (cand.slots || 0) - (cur ? cur.slots || 0 : 0);
      return { verdict: d > 0 ? 'better' : d < 0 ? 'worse' : 'same', lines: [{ label: 'Espacios', value: `${cand.slots}`, diff: d }], current: cur };
    }
    return { verdict: null, lines: [] };
  }

  /** v3.9: en la forja, qué hace lo que sale y si es mejor que lo que tenés puesto. */
  function craftWhat(id) {
    const kind = kindOf(id);
    const d = U().itemData(id);
    if (!d) return '';
    if (['weapon', 'armor', 'accessory'].includes(kind)) {
      const cmp = compare(id);
      const line = kind === 'accessory' ? (A.Accessories ? A.Accessories.describe(d).join(' · ') : '') : itemStatsLine(id);
      return ` <span class="craft2-what">${U().esc(line)}</span> ${verdictBadge(cmp.verdict)}`;
    }
    const fx = A.ItemFx && (d.effect || d.healAmount || d.foodValue) ? A.ItemFx.describe(d) : [];
    return fx.length ? ` <span class="craft2-what">${U().esc(fx[0])}</span>` : '';
  }

  /** v3.9: si la misión da un arma, armadura o accesorio, se ve qué es y si te conviene. */
  function rewardGear(r) {
    const gear = (r.items || []).map(([id]) => id).filter((id) => ['weapon', 'armor', 'accessory', 'bag'].includes(kindOf(id)));
    if (!gear.length) return '';
    return gear.map((id) => {
      const d = U().itemData(id);
      if (!d) return '';
      const line = itemStatsLine(id);
      return `
        <div class="qc-gear">
          <div class="qc-gear-head">${U().itemSprite(d, 32)}<b>${U().esc(d.name)}</b>${line ? `<span class="dim">${U().esc(line)}</span>` : ''}</div>
          ${cmpBox(id, { compact: true })}
        </div>`;
    }).join('');
  }

  /** v3.9: la caja "Comparado con lo que tenés puesto" (tienda, ficha, misiones, forja). */
  function cmpBox(id, opts = {}) {
    const cmp = compare(id);
    const esc = U().esc;
    if (cmp.verdict === 'blocked') return `<p class="shop-hint is-bad">${esc(cmp.note || 'Tu clase no lo puede usar.')}</p>`;
    if (!cmp.lines.length) return cmp.note ? `<p class="shop-hint">${esc(cmp.note)}</p>` : '';
    return `
      <div class="shop-cmp ${opts.compact ? 'is-compact' : ''}">
        <div class="shop-cmp-head">${opts.title ? esc(opts.title) + ' · ' : ''}Comparado con ${cmp.current ? `<b>${esc(cmp.current.name)}</b>` : 'nada puesto'} ${verdictBadge(cmp.verdict)}</div>
        ${cmp.lines.map((l) => `<div class="shop-cmp-row ${l.text ? 'is-text' : ''}"><span>${esc(l.label)}</span><span class="num">${esc(l.value)}</span>${l.diff == null ? '' : diffText(l.diff)}</div>`).join('')}
        ${cmp.note && cmp.lines.length && cmp.verdict !== 'blocked' ? `<div class="shop-cmp-note">${esc(cmp.note)}</div>` : ''}
      </div>`;
  }

  /** v3.9: "Para qué sirve" (recetas, misiones, domar, llaves...). */
  function usesHtml(id, opts = {}) {
    const list = A.ItemUses ? A.ItemUses.of(id, opts) : [];
    if (!list.length) return '';
    return `<ul class="effect-list item-uses">${list.map((u) => `<li>${U().icon(u.icon, 14)}<span>${U().esc(u.text)}</span></li>`).join('')}</ul>`;
  }

  function verdictBadge(v) {
    if (v === 'better') return `<span class="cmp-badge is-better" title="Mejor que lo que tenés">${U().icon('arrow-up', 14)}<span class="cmp-label">Mejor</span></span>`;
    if (v === 'worse') return `<span class="cmp-badge is-worse" title="Peor que lo que tenés">${U().icon('arrow-down', 14)}<span class="cmp-label">Peor</span></span>`;
    if (v === 'same') return '<span class="cmp-badge is-same">Parecido</span>';
    if (v === 'equipped') return `<span class="cmp-badge is-eq" title="Lo tenés puesto">${U().icon('check', 12)}<span class="cmp-label">Puesto</span></span>`;
    if (v === 'blocked') {
      // v3.4: las armas de mago son solo de magos, y los magos usan solo esas
      const mage = A.Balance && A.Balance.classOf ? A.Balance.classOf(player()) === 'mage' : false;
      return mage
        ? `<span class="cmp-badge is-worse" title="Los magos solo usan armas de mago (bastones, varitas, cetros, orbes y tomos)">${U().icon('lock', 12)}<span class="cmp-label">No para magos</span></span>`
        : `<span class="cmp-badge is-worse" title="Es un arma de mago: solo la pueden usar los magos">${U().icon('lock', 12)}<span class="cmp-label">Solo magos</span></span>`;
    }
    return '';
  }

  function diffText(d) {
    if (!d) return '';
    const n = Math.abs(d) % 1 ? Math.abs(d).toFixed(1) : Math.abs(d);
    return `<span class="cmp-diff ${d > 0 ? 'is-up' : 'is-down'}">${d > 0 ? '+' : '-'}${n}</span>`;
  }

  // ============================================================
  // Pestañas
  // ============================================================

  function questCard(q, mode, npc) {
    const objectives = q.objectives.map((o, i) => {
      const pr = mode === 'offer' ? { have: 0, need: o.count || 1, done: false } : A.Quests.objectiveProgress(q, i);
      return `
        <li class="qc-obj ${pr.done ? 'is-done' : ''}">
          <span class="qc-box">${pr.done ? U().icon('check', 14) : ''}</span>
          <span>${U().esc(A.Quests.objectiveText(o))}</span>
          ${(o.count || 1) > 1 && mode !== 'offer' ? `<span class="qc-count num">${pr.have}/${pr.need}</span>` : ''}
        </li>`;
    }).join('');
    const r = q.reward || {};
    const rewardChips = [];
    if (r.coins) rewardChips.push({ kind: 'coins', value: r.coins });
    if (r.xp) rewardChips.push({ kind: 'xp', value: r.xp });
    for (const [id, n] of r.items || []) rewardChips.push({ kind: 'item', itemId: id, value: n });
    const btn = mode === 'offer'
      ? `<button class="btn-primary qc-btn" data-quest-accept="${U().esc(q.id)}">${U().icon('quest', 18)}<span>Aceptar</span></button>`
      : mode === 'ready'
        ? `<button class="btn-primary qc-btn is-gold" data-quest-turnin="${U().esc(q.id)}">${U().icon('check', 18)}<span>Entregar</span></button>`
        : '';
    return `
      <article class="quest-card is-${mode} ${q.main ? 'is-main' : ''}">
        <header class="qc-head">
          ${U().icon(q.main ? 'crown' : 'scroll', 22)}
          <span class="qc-title">${U().esc(q.title)}</span>
          ${q.main ? `<span class="qc-tag">Historia · ${q.chapter}${A.Quests.mainCount ? `/${A.Quests.mainCount()}` : ''}</span>` : '<span class="qc-tag">Encargo</span>'}
        </header>
        ${mode === 'offer' ? `<p class="qc-offer">"${U().esc(q.offer || q.text)}"</p>` : mode === 'ready' ? `<p class="qc-offer">"¿Lo conseguiste? Dejame ver..."</p>` : `<p class="qc-text">${U().esc(q.text)}</p>`}
        <ul class="qc-objs">${objectives}</ul>
        ${rewardChips.length ? `<div class="qc-reward"><span class="qc-reward-label">Recompensa</span>${U().chips(rewardChips)}</div>` : ''}
        ${rewardGear(r)}
        ${btn ? `<div class="qc-actions">${btn}</div>` : ''}
      </article>
    `;
  }

  function renderTalk(npc, payload) {
    const f = A.Quests ? A.Quests.forNpc(npc.id) : { offer: [], ready: [], active: [], locked: [] };
    const parts = [];
    for (const q of f.ready) parts.push(questCard(q, 'ready', npc));
    for (const q of f.offer) parts.push(questCard(q, 'offer', npc));
    for (const q of f.active) parts.push(questCard(q, 'active', npc));
    const locked = f.locked.length
      ? `<p class="npc2-note">${U().icon('lock', 16)}<span>Tiene más trabajo, pero para alguien con más experiencia. Volvé cuando seas nivel ${Math.min(...f.locked.map((q) => q.minLevel || 1))}.</span></p>`
      : '';
    return `
      ${parts.length ? `<div class="npc2-quests">${parts.join('')}</div>` : `<p class="npc2-note">${U().icon('talk', 16)}<span>No tiene encargos para vos ahora.</span></p>`}
      ${locked}
    `;
  }

  function itemStatsLine(id) {
    const kind = kindOf(id);
    const d = U().itemData(id);
    if (!d) return '';
    if (kind === 'weapon') return `${d.damage}${d.magic ? ' · mágica' : ''} · peso ${d.weight || 0}`;
    if (kind === 'armor') return `Armadura +${d.defense || 0}${d.dodge ? ` · esquiva +${d.dodge}` : ''} · peso ${d.weight || 0}`;
    if (kind === 'bag') { const b = bagData(id); return b ? `${b.slots} espacios` : ''; }
    return '';
  }

  function buyDetail(npc, id) {
    const p = player();
    const d = U().itemData(id);
    if (!d) return `<div class="shop-detail is-empty">${U().icon('shop', 40)}<p>Tocá un objeto para ver qué hace y si te conviene.</p></div>`;
    const price = priceOf(npc, id);
    const canPay = A.Currency.canPay(price);
    const hasRoom = A.State.inventoryHasSpaceFor ? A.State.inventoryHasSpaceFor(id) : A.State.inventoryHasSpace();
    const cmp = compare(id);
    const why = !canPay ? 'No te alcanza' : !hasRoom ? 'Mochila llena' : '';
    return `
      <div class="shop-detail">
        <div class="shop-detail-head">
          <span class="shop-detail-sprite">${U().itemSprite(d, 64)}</span>
          <div>
            <div class="shop-detail-name">${U().esc(d.name)}</div>
            <div class="shop-detail-meta"><span class="rarity-tag rarity-${U().esc(d.rarity || 'common')}">${U().esc(RARITY[d.rarity] || 'Común')}</span>${itemStatsLine(id) ? ` ${U().esc(itemStatsLine(id))}` : ''}</div>
            ${verdictBadge(cmp.verdict)}
          </div>
        </div>
        ${d.description ? `<p class="shop-detail-desc">${U().esc(d.description)}</p>` : ''}
        ${(() => {
          // v2.4: lo que hace (pociones, comida, pergaminos y accesorios)
          const lines = d.subtype === 'accessory' ? (A.Accessories ? A.Accessories.describe(d) : []) : (A.ItemFx && (d.effect || d.healAmount || d.foodValue) ? A.ItemFx.describe(d) : []);
          // v2.5: armas que dejan un estado al pegar (la daga hace sangrar)
          const proc = A.ItemFx && A.ItemFx.weaponEffectLine ? A.ItemFx.weaponEffectLine(d) : null;
          if (proc) return `<ul class="effect-list shop-effects"><li>${U().icon(d.statusEffect.type, 14)}<span>${U().esc(proc)}.</span></li></ul>`;
          if (!lines.length) return '';
          const fight = A.ItemFx && A.ItemFx.combatOnly(d);
          return `<ul class="effect-list shop-effects">${lines.map((l) => `<li>${U().icon(d.subtype === 'accessory' ? 'star' : fight ? 'swords' : 'heal', 14)}<span>${U().esc(l)}</span></li>`).join('')}${fight ? `<li class="dim">${U().icon('swords', 14)}<span>Se usa en combate${d.subtype === 'scroll' ? ' (gasta tu turno)' : ''}.</span></li>` : ''}</ul>`;
        })()}
        ${cmpBox(id)}
        ${['weapon', 'armor', 'accessory', 'bag'].includes(kindOf(id)) ? '' : usesHtml(id, { withSell: false })}
        <div class="shop-buy-row">
          <span class="shop-buy-price">${U().price(price, 18)}</span>
          <button class="btn-primary" data-buy="${U().esc(id)}" ${why ? 'disabled' : ''}>${why || 'Comprar'}</button>
        </div>
        ${p && (p.food || 0) <= 3 && d.subtype === 'food' ? '<p class="shop-hint">Tenés hambre: la comida te viene bien.</p>' : ''}
      </div>
    `;
  }

  /** v3.1: si es comida, cómo le cae a tu raza (no la come / le encanta / le rinde poco). */
  function dietBadge(d) {
    const p = player();
    if (!p || !A.Survival || !A.Survival.isFood || !A.Survival.isFood(d)) return '';
    const f = A.Survival.foodFor(p, d);
    if (f.kind === 'no') return '<span class="shop-card-diet is-no">No lo comés</span>';
    if (f.kind === 'fav') return '<span class="shop-card-diet is-fav">Te encanta</span>';
    if (f.kind === 'half') return '<span class="shop-card-diet is-half">Rinde poco</span>';
    return '';
  }

  // v3.9: la tienda ordenada por secciones (antes todo mezclado)
  const SHOP_GROUPS = [
    ['weapon', 'Armas'], ['armor', 'Armaduras'], ['accessory', 'Accesorios'], ['bag', 'Mochilas'],
    ['potion', 'Pociones y remedios'], ['scroll', 'Pergaminos'], ['food', 'Comida'], ['tool', 'Herramientas y llaves'], ['other', 'Materiales'],
  ];
  function shopGroupOf(id) {
    const k = kindOf(id);
    if (['weapon', 'armor', 'accessory', 'bag'].includes(k)) return k;
    const d = U().itemData(id) || {};
    if (d.subtype === 'potion' || (d.effect && (d.effect.type === 'heal' || d.effect.type === 'mana' || d.effect.type === 'cure'))) return 'potion';
    if (d.subtype === 'scroll' || d.teachesSpell) return 'scroll';
    if (d.subtype === 'food' || d.subtype === 'tame' || (d.effect && d.effect.type === 'food')) return 'food';
    if (/llave|linterna|cuerda/.test(id) || d.subtype === 'tool' || d.subtype === 'key') return 'tool';
    return 'other';
  }

  function renderBuy(npc, payload) {
    const all = (npc.sells || []).filter((id) => U().itemData(id));
    const sel = payload.sel && all.includes(payload.sel) ? payload.sel : null;
    const groups = SHOP_GROUPS.map(([g, label]) => [label, all.filter((id) => shopGroupOf(id) === g).sort((a, b) => priceOf(npc, a) - priceOf(npc, b))]).filter(([, l]) => l.length);
    const card = (id) => {
            const d = U().itemData(id);
            const price = priceOf(npc, id);
            const cmp = compare(id);
            return `
              <button class="shop-card ${sel === id ? 'is-selected' : ''} ${A.Currency.canPay(price) ? '' : 'is-pricey'} rarity-${U().esc(d.rarity || 'common')}" data-shop-sel="${U().esc(id)}" title="${U().esc(d.name)}${d.rarity && d.rarity !== 'common' ? ` (${RARITY[d.rarity] || d.rarity})` : ''}">
                <span class="shop-card-sprite">${U().itemSprite(d, 44)}</span>
                <span class="shop-card-name">${U().esc(d.name)}</span>
                <span class="shop-card-price">${U().price(price, 14)}</span>
                ${cmp.verdict && cmp.verdict !== 'same' ? `<span class="shop-card-cmp">${verdictBadge(cmp.verdict)}</span>` : dietBadge(d)}
              </button>`;
    };
    return `
      <div class="shop2">
        <div class="shop-groups">
          ${groups.map(([label, list]) => `
            <div class="shop-group">
              <div class="shop-group-label">${U().esc(label)} <span class="dim">${list.length}</span></div>
              <div class="shop-grid">${list.map(card).join('')}</div>
            </div>`).join('')}
        </div>
        <aside class="shop-side">${buyDetail(npc, sel)}</aside>
      </div>
    `;
  }

  function questNeeds() {
    const need = new Set();
    if (!A.Quests) return need;
    for (const q of A.Quests.activeList()) for (const o of q.objectives) if (o.type === 'collect' || o.type === 'have') need.add(o.item);
    return need;
  }

  function renderSell() {
    const p = player();
    const need = questNeeds();
    const rows = (p.inventory || []).filter((s) => !(A.Currency.isCoinId && A.Currency.isCoinId(s.itemId)) && !String(s.itemId).startsWith('coin_'));
    if (!rows.length) return `<p class="npc2-note">${U().icon('bag', 16)}<span>No tenés nada para vender.</span></p>`;
    return `
      <p class="npc2-hint">Te paga la mitad de lo que vale cada cosa.</p>
      <div class="sell-list">
        ${rows.map((s) => {
          const d = U().itemData(s.itemId);
          if (!d) return '';
          const each = sellPrice(d);
          const quest = need.has(s.itemId);
          return `
            <div class="sell-row ${quest ? 'is-quest' : ''} rarity-${U().esc(d.rarity || 'common')}">
              <span class="sell-sprite">${U().itemSprite(d, 32)}</span>
              <span class="sell-name">${U().esc(d.name)}${s.qty > 1 ? ` <span class="num dim">×${s.qty}</span>` : ''}${quest ? `<span class="sell-tag">${U().icon('quest', 12)}Misión</span>` : ''}</span>
              <span class="sell-price">${U().price(each, 14)}</span>
              <span class="sell-btns">
                <button class="btn-mini" data-sell="${U().esc(s.itemId)}" data-qty="1">Vender</button>
                ${s.qty > 1 ? `<button class="btn-mini" data-sell="${U().esc(s.itemId)}" data-qty="${s.qty}" title="Vender los ${s.qty} por ${A.Currency.formatPrice(each * s.qty)}">Todo</button>` : ''}
              </span>
            </div>`;
        }).join('')}
      </div>
    `;
  }

  function renderLearn(npc) {
    const p = player();
    const spells = (npc.teaches || []).map((id) => A.Data.getById('spells', id)).filter(Boolean);
    return `
      <div class="learn2">
        ${spells.map((s) => {
          const known = (p.spells || []).includes(s.id);
          const price = A.NPC.spellPrice(s.id);
          const canPay = A.Currency.canPay(price);
          const why = !known && A.Spellbook && A.Spellbook.canLearn ? A.Spellbook.canLearn(p, s) : {};
          const mageOnly = !!why.mageOnly;
          const hybridOnly = !!why.hybridOnly; // v3.3: Segundo aliento
          const cost = A.Passives && A.Passives.spellCost ? A.Passives.spellCost(p, s) : s.manaCost;
          const what = s.damage ? `${s.damage} de daño${s.area ? ' a todos' : ''}` : s.heal ? `cura ${s.heal}${s.selfOnly ? ' (solo a vos)' : ''}` : '';
          return `
            <div class="learn2-row ${known ? 'is-known' : ''}">
              <span class="learn2-icon">${A.ItemSprites ? A.ItemSprites.spellIcon(s, { size: 36 }) : ''}</span>
              <span class="learn2-info">
                <span class="learn2-name">${U().esc(s.name)}</span>
                <span class="learn2-meta">${U().esc(what)} · ${cost} de maná${s.cooldown ? ` · cada ${s.cooldown} turnos` : ''}${s.damage ? (s.sure ? ' · no falla' : ' · puede fallar') : ''}</span>
                <span class="learn2-desc">${U().esc(s.description || '')}</span>
              </span>
              ${known ? `<span class="cmp-badge is-eq">${U().icon('check', 12)}<span>Aprendido</span></span>` : mageOnly ? `
                <span class="cmp-badge is-worse" title="Solo los magos pueden aprenderlo (Curación y los grandes hechizos de área)">${U().icon('lock', 12)}<span>Solo magos</span></span>` : hybridOnly ? `
                <span class="cmp-badge is-worse" title="Solo los híbridos pueden aprenderlo">${U().icon('lock', 12)}<span>Solo híbridos</span></span>` : `
                <span class="learn2-buy">${U().price(price, 14)}<button class="btn-mini" data-learn="${U().esc(s.id)}" ${canPay ? '' : 'disabled'}>${canPay ? 'Aprender' : 'Sin dinero'}</button></span>`}
            </div>`;
        }).join('')}
      </div>
    `;
  }

  function renderCraft(npc, only) {
    // v3.3: en la pestaña de alquimia, solo pociones; en la de forja, lo demás que haga este habitante
    const ws = workshopsOf(npc);
    const groups = [
      ['forge', 'Forja', 'anvil', 'Forjar'], ['alchemy', 'Alquimia', 'potion', 'Preparar'], ['enchant', 'Encantamiento', 'arcane', 'Encantar'],
    ].filter(([w]) => ws.includes(w) && (only === 'alchemy' ? w === 'alchemy' : w !== 'alchemy'));
    const inv = player().inventory || [];
    const html = groups.map(([w, label, ic, verb]) => {
      // v3.9: primero lo que ya podés hacer; después, por nivel
      const recipes = A.Crafting.recipesForWorkshop(w).slice().sort((a, b) => (A.Crafting.canCraft(b.id).ok - A.Crafting.canCraft(a.id).ok) || ((a.tier || 1) - (b.tier || 1)));
      if (!recipes.length) return '';
      return `
        <div class="craft2-group">
          <div class="craft2-label">${U().icon(ic, 18)}<span>${label}</span></div>
          ${recipes.map((r) => {
            const ok = A.Crafting.canCraft(r.id).ok;
            const res = U().itemData(r.result);
            return `
              <div class="craft2-row ${ok ? 'is-ready' : ''}">
                <span class="craft2-sprite">${U().itemSprite(res, 36)}</span>
                <span class="craft2-info">
                  <span class="craft2-name">${U().esc(res ? res.name : r.result)}${craftWhat(r.result)}</span>
                  <span class="craft2-ings">
                    ${(r.ingredients || []).map((ing) => {
                      const d = U().itemData(ing.itemId);
                      const slot = inv.find((s) => s.itemId === ing.itemId);
                      const have = slot ? slot.qty : 0;
                      return `<span class="craft2-ing ${have >= ing.qty ? 'is-ok' : ''}">${U().itemSprite(d, 18)}<span>${U().esc(d ? d.name : ing.itemId)}</span><b class="num">${have}/${ing.qty}</b></span>`;
                    }).join('')}
                  </span>
                </span>
                <button class="btn-mini" data-craft2="${U().esc(r.id)}" data-craft-tab="${only === 'alchemy' ? 'alchemy' : 'craft'}" ${ok ? '' : 'disabled'}>${verb}</button>
              </div>`;
          }).join('')}
        </div>`;
    }).join('');
    const lead = only === 'alchemy'
      ? `<p class="npc2-note">${U().esc(npc.name.split(' ')[0])} te prepara pociones con lo que juntes al explorar y viajar (hierbas, flores, hongos).</p>`
      : '';
    return `<div class="craft2">${lead}${html || '<p class="npc2-note">No hay recetas.</p>'}</div>`;
  }

  function renderInn(npc) {
    const p = player();
    const cost = npc.services.restCost;
    // v3.9: el plato rinde: llena 10 y cura un poco, por un tercio de la cama (antes 5 de comida por la mitad)
    const eatCost = Math.max(2, Math.ceil(cost * 0.3));
    const tired = p.hp < p.maxHp || (p.hasMagic && p.mana < p.maxMana);
    const hungry = (p.food || 0) < (p.maxFood || 20);
    const row = (ic, name, desc, price, attr, ok, label) => `
      <div class="inn-row ${ok ? '' : 'is-off'}">
        <span class="inn-icon">${U().icon(ic, 36)}</span>
        <span class="inn-info"><span class="inn-name">${name}</span><span class="inn-desc">${desc}</span></span>
        <span class="inn-buy">${U().price(price, 14)}<button class="btn-mini" ${attr} ${ok ? '' : 'disabled'}>${label}</button></span>
      </div>`;
    return `
      <div class="inn2">
        ${row('tent', 'Una cama hasta mañana', 'Recuperás toda la vida y el maná, y comés algo antes de dormir.', cost, 'data-inn="sleep"', A.Currency.canPay(cost), tired ? 'Dormir' : 'Dormir igual')}
        ${row('food', 'Un plato caliente', `+${INN_FOOD} de comida y +${Math.max(1, Math.round((p.maxHp || 1) * INN_HEAL))} de vida. No pasa el tiempo.`, eatCost, `data-inn="eat" data-cost="${eatCost}"`, A.Currency.canPay(eatCost) && (hungry || p.hp < p.maxHp), hungry || p.hp < p.maxHp ? 'Comer' : 'Lleno')}
      </div>
    `;
  }

  // ============================================================
  // Render principal
  // ============================================================

  function render(payload) {
    const npc = npcOf(payload.npcId);
    if (!npc) return '<div class="modal"><div class="modal-body">No hay nadie acá.</div></div>';
    // Hablar con alguien cumple los objetivos "hablá con..."
    const news = (payload.news || []).slice();
    if (A.Quests && !payload._talked) {
      const off = A.Bus.on('quest:auto-completed', (e) => news.push(e));
      A.Quests.talkTo(npc.id);
      off();
      payload._talked = true;
    }
    const tabs = tabsFor(npc);
    const legacy = { shop: 'buy', dialog: 'talk', rest: 'inn' };
    let tab = legacy[payload.tab] || payload.tab || 'talk';
    if (!tabs.find((t) => t.id === tab)) tab = tabs[0].id;
    // Si tiene una misión lista o para ofrecer, se abre en Hablar
    const marker = A.Quests ? A.Quests.markerFor(npc.id) : null;
    if (!payload.tab && (marker === 'offer' || marker === 'ready')) tab = 'talk';

    if (payload.lineIdx == null) payload.lineIdx = Math.floor(Math.random() * Math.max(1, (npc.dialog || []).length));
    const line = (npc.dialog && npc.dialog.length) ? npc.dialog[payload.lineIdx % npc.dialog.length] : '...';

    let body = '';
    if (tab === 'talk') body = renderTalk(npc, payload);
    else if (tab === 'buy') body = renderBuy(npc, payload);
    else if (tab === 'sell') body = renderSell(npc);
    else if (tab === 'learn') body = renderLearn(npc);
    else if (tab === 'craft') body = renderCraft(npc, 'craft');
    else if (tab === 'alchemy') body = renderCraft(npc, 'alchemy');
    else if (tab === 'inn') body = renderInn(npc);

    const newsHtml = news.map((n) => {
      const q = A.Quests.get(n.id);
      return q ? `
        <div class="npc2-news">
          ${U().icon('check', 20)}
          <div><b>Misión cumplida: ${U().esc(q.title)}</b><p>${U().esc(q.done || '')}</p>${U().chips(n.chips)}</div>
        </div>` : '';
    }).join('');

    return `
      <div class="modal npc2" role="dialog" aria-modal="true" aria-label="${U().esc(npc.name)}">
        <header class="npc2-head">
          <span class="npc2-portrait">${A.Sprites && A.Sprites.npcHtml ? A.Sprites.npcHtml(npc, { size: 80 }) : ''}</span>
          <div class="npc2-id">
            <h2 class="npc2-name">${U().esc(npc.name)}</h2>
            <div class="npc2-role">${U().esc(npc.roleName || ROLE[npc.role] || npc.role || '')}</div>
            <div class="npc2-wallet" title="Tu dinero">${U().icon('bag', 16)}${A.Currency.walletHtml(16)}</div>
          </div>
          <button class="modal-close" data-modal-close aria-label="Cerrar">×</button>
        </header>
        <div class="npc2-say"><span>${U().esc(line)}</span></div>
        ${tabs.length > 1 ? `
          <nav class="npc2-tabs" role="tablist">
            ${tabs.map((t) => `
              <button class="npc2-tab ${t.id === tab ? 'is-active' : ''}" data-npc2-tab="${t.id}" role="tab" aria-selected="${t.id === tab}" aria-label="${t.label}" title="${t.label}">
                ${U().icon(t.icon, 18)}<span class="tab-label">${t.label}</span>
                ${t.id === 'talk' && marker ? U().questMark(marker) : ''}
              </button>`).join('')}
          </nav>` : ''}
        <div class="npc2-body">
          ${newsHtml}
          ${body}
        </div>
      </div>
    `;
  }

  function reopen(payload, extra) {
    A.State.openModal('npc', { npcId: payload.npcId, tab: payload.tab, sel: payload.sel, lineIdx: payload.lineIdx, _talked: true, ...extra });
  }

  function bind(overlay, payload) {
    const npc = npcOf(payload.npcId);
    if (!npc) return;
    const cur = { ...payload }; // misma frase mientras el modal sigue abierto

    overlay.querySelectorAll('[data-npc2-tab]').forEach((b) => b.addEventListener('click', () => reopen(cur, { tab: b.dataset.npc2Tab, sel: null })));
    overlay.querySelectorAll('[data-shop-sel]').forEach((b) => b.addEventListener('click', () => {
      reopen(cur, { tab: 'buy', sel: b.dataset.shopSel });
      // En el celular el detalle queda arriba: subir para verlo
      const body = document.querySelector('.npc2-body');
      if (body && window.innerWidth < 760) body.scrollTo({ top: 0, behavior: 'smooth' });
    }));
    overlay.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => {
      const r = A.NPC.buy(npc.id, b.dataset.buy);
      if (r.ok) reopen(cur, { tab: 'buy', sel: b.dataset.buy });
    }));
    overlay.querySelectorAll('[data-sell]').forEach((b) => b.addEventListener('click', () => {
      const r = A.NPC.sell(b.dataset.sell, parseInt(b.dataset.qty, 10) || 1);
      if (r.ok) reopen(cur, { tab: 'sell' });
    }));
    overlay.querySelectorAll('[data-learn]').forEach((b) => b.addEventListener('click', () => {
      const r = A.NPC.learnSpell(npc.id, b.dataset.learn);
      if (r.ok) reopen(cur, { tab: 'learn' });
    }));
    overlay.querySelectorAll('[data-craft2]').forEach((b) => b.addEventListener('click', () => {
      const r = A.Crafting.craft(b.dataset.craft2);
      if (r.ok) { A.Bus.emit('inventory:changed'); reopen(cur, { tab: b.dataset.craftTab || 'craft' }); }
    }));
    overlay.querySelectorAll('[data-inn]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.inn === 'sleep') {
        const r = A.NPC.restAt(npc.id);
        if (r.ok) {
          if (A.Time) A.Time.passTo('morning');
          A.State.closeModal();
        }
      } else {
        const cost = parseInt(b.dataset.cost, 10) || 5;
        if (!A.Currency.canPay(cost)) return;
        A.Currency.pay(cost);
        A.State.modifyFood(INN_FOOD);
        const pl = A.State.player;
        if (pl && pl.hp < pl.maxHp) A.State.healHp(Math.max(1, Math.round(pl.maxHp * INN_HEAL)));
        A.State.addChronicle({ type: 'rest', text: `Comiste un plato caliente en lo de ${npc.name}.` });
        reopen(cur, { tab: 'inn' });
      }
    }));
    overlay.querySelectorAll('[data-quest-accept]').forEach((b) => b.addEventListener('click', () => {
      if (A.Quests.accept(b.dataset.questAccept)) reopen(cur, { tab: 'talk' });
    }));
    overlay.querySelectorAll('[data-quest-turnin]').forEach((b) => b.addEventListener('click', () => {
      const res = A.Quests.turnIn(b.dataset.questTurnin);
      if (res) reopen(cur, { tab: 'talk', news: [{ id: res.quest.id, chips: res.chips }] });
    }));
  }

  A.ModalViews = A.ModalViews || {};
  A.ModalViews.npc = { render, bind };
  // v3.9: la misma comparación sirve para la ficha del objeto, las misiones y la forja
  A.ItemCompare = { compare, cmpBox, usesHtml, verdictBadge, itemStatsLine, kindOf };
})(window.Aventurs);
