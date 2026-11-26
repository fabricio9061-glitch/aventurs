/* ============================================================
   Aventurs — Modals
   Todos los modales en un solo archivo. Render desde Shell.

   Modales:
     npc          - { npcId } : muestra NPC con avatar, diálogo, acciones según rol
     item-detail  - { itemId } : detalle del item con Equipar/Usar/Tirar
     rules        - reglas del juego
     menu         - exportar/importar/borrar partida
     confirm      - { title, body, onConfirm, danger? }
   ============================================================ */

(function (A) {
  'use strict';

  let host = null;
  let confirmCallback = null;

  /** v2.0: ícono pixel (reemplaza los emojis). */
  function pxi(name, size) { return A.ItemSprites ? A.ItemSprites.icon(name, { size: size || 16 }) : ''; }

  function render(rootEl) {
    if (rootEl) host = rootEl;
    if (!host) return;

    // Quitar modal previo si lo hay
    const existing = host.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const id = A.State.ui.openModal;
    if (!id) return;

    const payload = A.State.ui.modalPayload || {};

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    let html = '';
    // v2.0: pantallas nuevas registradas desde otros archivos (A.ModalViews[id])
    const custom = A.ModalViews && A.ModalViews[id];
    if (custom) {
      html = custom.render(payload, { modalShell, renderNpcCraft, renderNpcLearn, renderNpcRest });
    } else switch (id) {
      case 'npc': html = renderNpc(payload); break;
      case 'item-detail': html = renderItemDetail(payload); break;
      case 'rules': html = renderRules(); break;
      case 'menu': html = renderMenu(); break;
      case 'confirm': html = renderConfirm(payload); break;
      case 'creature': html = renderCreature(payload); break;
      case 'all-creatures': html = renderAllCreatures(payload); break;
      case 'tame': html = renderTame(payload); break;
      case 'magic': html = renderMagic(); break;
      case 'explore-stats': html = renderExploreStats(); break;
      case 'chronicles-full': html = renderChroniclesFull(); break;
      case 'travel': html = renderTravelModal(); break;
      case 'combat-full-log': html = renderCombatFullLog(); break;
      case 'equipped-bag': html = renderEquippedBag(payload); break;
      case 'combat-spell': html = payload.pick ? renderCombatTarget('spell', payload.pick) : renderCombatSpell(); break;
      case 'combat-tech': html = renderCombatTech(); break; // v3.13: las técnicas del guerrero
      case 'combat-item': html = payload.pick ? renderCombatTarget('item', payload.pick) : renderCombatItem(); break;
      default: html = `<div class="modal"><div class="modal-body">Modal "${id}" desconocido.</div></div>`;
    }

    overlay.innerHTML = html;
    host.appendChild(overlay);

    bindOverlayEvents(overlay, id, payload);
    // v3.9: la crónica abre en la última ronda
    if (id === 'combat-full-log') {
      const fl = overlay.querySelector('[data-fulllog]');
      const sc = fl && (fl.closest('.modal-body') || fl);
      if (sc) requestAnimationFrame(() => { sc.scrollTop = sc.scrollHeight; fl.scrollTop = fl.scrollHeight; });
    }
  }

  // ---------- NPC ----------

  function renderNpc({ npcId, tab }) {
    const npc = A.Data.getById('npcs', npcId);
    if (!npc) return modalShell('NPC no encontrado', `<p class="muted">Algo salió mal.</p>`);

    // Tabs disponibles según rol
    const tabs = [];
    tabs.push({ id: 'dialog', label: 'Hablar' });
    if ((npc.sells || []).length > 0) tabs.push({ id: 'shop', label: 'Comerciar' });
    if (npc.role === 'blacksmith') tabs.push({ id: 'craft', label: 'Forjar' });
    if ((npc.teaches || []).length > 0) tabs.push({ id: 'learn', label: 'Aprender' });
    if (npc.services && npc.services.restCost != null) tabs.push({ id: 'rest', label: 'Descansar' });

    const activeTab = tab || tabs[0].id;
    const dialog = A.Utils.randomOf(npc.dialog || []) || '...';

    let bodyContent = '';
    switch (activeTab) {
      case 'dialog': bodyContent = renderNpcDialog(npc, dialog); break;
      case 'shop': bodyContent = renderNpcShop(npc); break;
      case 'craft': bodyContent = renderNpcCraft(npc); break;
      case 'learn': bodyContent = renderNpcLearn(npc); break;
      case 'rest': bodyContent = renderNpcRest(npc); break;
    }

    const body = `
      <div class="npc-modal">
        <div class="npc-modal-header">
          <div class="npc-modal-avatar">${A.Sprites && A.Sprites.npcHtml ? A.Sprites.npcHtml(npc, { size: 56 }) : ''}</div>
          <div>
            <div class="npc-modal-name">${A.Utils.escapeHtml(npc.name)}</div>
            <div class="npc-modal-role dim">${roleLabel(npc.role)}</div>
          </div>
        </div>
        ${tabs.length > 1 ? `
          <div class="npc-tabs">
            ${tabs.map((t) => `
              <button class="npc-tab ${t.id === activeTab ? 'is-active' : ''}" data-npc-tab="${t.id}" data-npc-id="${A.Utils.escapeHtml(npcId)}">
                ${A.Utils.escapeHtml(t.label)}
              </button>
            `).join('')}
          </div>
        ` : ''}
        <div class="npc-tab-content">
          ${bodyContent}
        </div>
      </div>
    `;
    return modalShell(npc.name, body);
  }

  function renderNpcDialog(npc, dialog) {
    return `
      <blockquote class="npc-dialog">${A.Utils.escapeHtml(dialog)}</blockquote>
    `;
  }

  function renderItemStatBadge(data, itemId) {
    if (!data) return '';
    const slotsBadge = (data.slots && data.slots > 1)
      ? `<span class="item-stat-pill item-stat-pill-large" title="Ocupa ${data.slots} slots">×${data.slots}</span>`
      : '';
    let mainBadge = '';
    // Arma: mostrar daño en pill
    if (A.Data.getById('weapons', itemId)) {
      mainBadge = `<span class="item-stat-pill item-stat-pill-dmg" title="Daño">${pxi('swords', 14)} ${A.Utils.escapeHtml(data.damage || '?')}</span>`;
    }
    // Armadura: mostrar defensa
    else if (A.Data.getById('armors', itemId)) {
      mainBadge = `<span class="item-stat-pill item-stat-pill-def" title="Armadura: se resta de cada golpe">${pxi('shield', 14)} ${data.defense || 0}</span>`;
    }
    // Bolsa: slots
    else if (data.subtype === 'bag') {
      const bagId = data.equipsBag;
      const bagData = A.Data.getById('bags', bagId);
      if (bagData) mainBadge = `<span class="item-stat-pill item-stat-pill-bag" title="Espacios">${pxi('bag', 14)} ${bagData.slots}</span>`;
    }
    // Pergamino: hechizo
    else if (data.subtype === 'scroll_spell') {
      mainBadge = `<span class="item-stat-pill item-stat-pill-spell" title="Enseña">${pxi('book', 14)}</span>`;
    }
    // v2.4: accesorio: lo que hace
    else if (data.subtype === 'accessory' && A.Accessories) {
      const first = A.Accessories.describe(data)[0];
      if (first) mainBadge = `<span class="item-stat-pill" title="${A.Utils.escapeHtml(A.Accessories.describe(data).join('. '))}">${pxi('star', 14)} ${A.Utils.escapeHtml(first)}</span>`;
    }
    // Comida, poción o pergamino: lo que hace (antes se veía "[object Object]")
    else if ((data.effect || data.healAmount || data.foodValue) && A.ItemFx) {
      const first = A.ItemFx.describe(data)[0];
      if (first) mainBadge = `<span class="item-stat-pill" title="${A.Utils.escapeHtml(A.ItemFx.summary(data))}">${A.Utils.escapeHtml(first)}</span>`;
    }
    // v2.4: rareza (si no es común)
    if (data.rarity && data.rarity !== 'common') mainBadge = `<span class="rarity-tag rarity-${A.Utils.escapeHtml(data.rarity)}">${rarityLabel(data.rarity)}</span>` + mainBadge;
    return mainBadge + slotsBadge;
  }

  function renderNpcShop(npc) {
    const items = (npc.sells || []).map((id) => {
      const data = A.Inventory.resolveData(id);
      if (!data) return null;
      const price = A.NPC.getNpcSellPrice(npc, id);
      const canPay = A.Currency.canPay(price);
      return { id, data, price, canPay };
    }).filter(Boolean);

    // Sección de venta: items del jugador (no equipados, no monedas)
    const p = A.State.player;
    const sellable = (p.inventory || []).filter((s) => {
      const d = A.Inventory.resolveData(s.itemId);
      if (!d) return false;
      if (d.subtype === 'coin') return false;
      return true;
    });

    return `
      <div class="shop-modal">
        <div class="shop-wallet dim">Tu cobre: <span class="num">${A.Currency.formatWallet()}</span></div>

        <div class="shop-section">
          <div class="shop-section-title">A la venta</div>
          ${items.length === 0 ? `<div class="muted small">No tiene nada hoy.</div>` : `
            <div class="shop-list">
              ${items.map((it) => {
                const statBadge = renderItemStatBadge(it.data, it.id);
                return `
                <div class="shop-row ${it.canPay ? '' : 'is-disabled'}">
                  <div class="shop-row-icon">${(A.ItemSprites ? A.ItemSprites.html(it.data, { size: 36 }) : '')}</div>
                  <div class="shop-row-info">
                    <div class="shop-row-name">
                      ${A.Utils.escapeHtml(it.data.name)}
                      ${statBadge}
                    </div>
                    <div class="shop-row-desc dim">${A.Utils.escapeHtml(it.data.description || '')}</div>
                  </div>
                  <div class="shop-row-price num">${it.price}c</div>
                  <button class="btn-mini" data-shop-buy="${A.Utils.escapeHtml(it.id)}" data-npc-id="${A.Utils.escapeHtml(npc.id)}" ${it.canPay ? '' : 'disabled'}>Comprar</button>
                </div>
              `;
              }).join('')}
            </div>
          `}
        </div>

        <div class="shop-section">
          <div class="shop-section-title">Tus cosas para vender</div>
          ${sellable.length === 0 ? `<div class="muted small">No tenés nada para vender.</div>` : `
            <div class="shop-list">
              ${sellable.map((s) => {
                const d = A.Inventory.resolveData(s.itemId);
                const priceEach = Math.max(1, Math.floor((d.value || 0) / 2));
                const qtyStr = s.qty > 1 ? ` ×${s.qty}` : '';
                let buttons;
                if (s.qty > 1) {
                  const q5 = s.qty >= 5 ? 5 : null;
                  const q10 = s.qty >= 10 ? 10 : null;
                  buttons = `
                    <div class="sell-multi-btns">
                      <button class="btn-mini" data-shop-sell="${A.Utils.escapeHtml(s.itemId)}" data-sell-qty="1">×1 (+${A.Currency.formatPrice(priceEach)})</button>
                      ${q5 ? `<button class="btn-mini" data-shop-sell="${A.Utils.escapeHtml(s.itemId)}" data-sell-qty="5">×5 (+${A.Currency.formatPrice(priceEach * 5)})</button>` : ''}
                      ${q10 ? `<button class="btn-mini" data-shop-sell="${A.Utils.escapeHtml(s.itemId)}" data-sell-qty="10">×10 (+${A.Currency.formatPrice(priceEach * 10)})</button>` : ''}
                      <button class="btn-mini" data-shop-sell="${A.Utils.escapeHtml(s.itemId)}" data-sell-qty="${s.qty}">Todo (+${A.Currency.formatPrice(priceEach * s.qty)})</button>
                    </div>
                  `;
                } else {
                  buttons = `<button class="btn-mini" data-shop-sell="${A.Utils.escapeHtml(s.itemId)}" data-sell-qty="1">Vender (+${A.Currency.formatPrice(priceEach)})</button>`;
                }
                return `
                  <div class="shop-row">
                    <div class="shop-row-icon">${(A.ItemSprites ? A.ItemSprites.html(d, { size: 36 }) : '')}</div>
                    <div class="shop-row-info">
                      <div class="shop-row-name">${A.Utils.escapeHtml(d.name)}<span class="dim num">${qtyStr}</span></div>
                      <div class="shop-row-desc dim">${A.Currency.formatPrice(priceEach)} c/u</div>
                    </div>
                    ${buttons}
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  }

  function renderNpcLearn(npc) {
    const p = A.State.player;
    if (!p.hasMagic) {
      return `<div class="muted small">No podés canalizar magia. ${A.Utils.escapeHtml(npc.name)} mira para otro lado.</div>`;
    }
    const spells = (npc.teaches || [])
      .map((id) => A.Data.getById('spells', id))
      .filter(Boolean);

    return `
      <div class="learn-modal">
        <div class="shop-wallet dim">Tu cobre: <span class="num">${A.Currency.formatWallet()}</span></div>
        ${spells.length === 0 ? `<div class="muted small">No tiene hechizos para enseñar.</div>` : `
          <div class="learn-list">
            ${spells.map((s) => {
              const known = (p.spells || []).includes(s.id);
              const price = A.NPC.spellPrice(s.id);
              const canPay = A.Currency.canPay(price);
              const mageOnly = !known && A.Spellbook && A.Spellbook.canLearn ? !!A.Spellbook.canLearn(p, s).mageOnly : false;
              const dmgStr = s.damage ? `${s.damage} daño` : s.heal ? `${s.heal} cura` : '';
              return `
                <div class="learn-row ${known ? 'is-known' : ''}">
                  <div class="learn-icon">${A.ItemSprites ? A.ItemSprites.spellIcon(s, { size: 28 }) : ''}</div>
                  <div class="learn-info">
                    <div class="learn-name">${A.Utils.escapeHtml(s.name)}</div>
                    <div class="learn-meta dim">${dmgStr}${dmgStr ? ' · ' : ''}Maná ${s.manaCost} · Nivel ${s.tier}</div>
                    <div class="learn-desc dim">${A.Utils.escapeHtml(s.description || '')}</div>
                  </div>
                  <div class="learn-price num">${price}c</div>
                  ${known
                    ? `<span class="pill">aprendido</span>`
                    : mageOnly ? `<span class="pill" title="Solo los magos pueden aprenderlo">solo magos</span>`
                    : `<button class="btn-mini" data-learn-spell="${A.Utils.escapeHtml(s.id)}" data-npc-id="${A.Utils.escapeHtml(npc.id)}" ${canPay ? '' : 'disabled'}>Aprender</button>`}
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  }

  function renderNpcRest(npc) {
    const cost = npc.services.restCost;
    const canPay = A.Currency.canPay(cost);
    const eatCost = Math.max(2, Math.floor(cost / 2));
    const canEat = A.Currency.canPay(eatCost);
    const p = A.State.player;
    const needsRest = p.hp < p.maxHp || (p.hasMagic && p.mana < p.maxMana);
    const needsFood = (p.food || 0) < (p.maxFood || 20);
    return `
      <div class="rest-services">
        <div class="rest-service-row ${(canPay && needsRest) ? '' : 'is-disabled'}">
          <div class="rest-service-icon">${pxi('tent', 28)}</div>
          <div class="rest-service-info">
            <div class="rest-service-name">Pasar la noche</div>
            <div class="rest-service-desc dim">Recupera salud y maná al máximo.</div>
          </div>
          <div class="rest-service-price num">${A.Currency.formatPrice(cost)}</div>
          <button class="btn-mini" data-rest-action="sleep" data-npc-id="${A.Utils.escapeHtml(npc.id)}" ${canPay && needsRest ? '' : 'disabled'}>${needsRest ? 'Dormir' : 'Sano'}</button>
        </div>
        <div class="rest-service-row ${(canEat && needsFood) ? '' : 'is-disabled'}">
          <div class="rest-service-icon">${pxi('food', 28)}</div>
          <div class="rest-service-info">
            <div class="rest-service-name">Comer en la posada</div>
            <div class="rest-service-desc dim">+5 de comida. Sin colas.</div>
          </div>
          <div class="rest-service-price num">${A.Currency.formatPrice(eatCost)}</div>
          <button class="btn-mini" data-rest-action="eat" data-npc-id="${A.Utils.escapeHtml(npc.id)}" data-cost="${eatCost}" ${canEat && needsFood ? '' : 'disabled'}>${needsFood ? 'Comer' : 'Saciado'}</button>
        </div>
      </div>
    `;
  }

  function renderNpcCraft(npc) {
    // v1.7.2: el herrero ofrece todas las recetas (forge + alchemy + enchant),
    // agrupadas visualmente por taller. Antes solo mostraba 'forge'.
    const forge = A.Crafting.recipesForWorkshop('forge');
    const alchemy = A.Crafting.recipesForWorkshop('alchemy');
    const enchant = A.Crafting.recipesForWorkshop('enchant');
    const all = [...forge, ...alchemy, ...enchant];
    if (all.length === 0) {
      return `<div class="muted small">No hay recetas disponibles.</div>`;
    }
    const sections = [];
    if (forge.length) sections.push(`<div class="craft-section-label">${pxi('anvil', 16)} Forja</div>${renderCraftList(forge, 'forge')}`);
    if (alchemy.length) sections.push(`<div class="craft-section-label">${pxi('potion', 16)} Alquimia</div>${renderCraftList(alchemy, 'alchemy')}`);
    if (enchant.length) sections.push(`<div class="craft-section-label">${pxi('arcane', 16)} Encantamiento</div>${renderCraftList(enchant, 'enchant')}`);
    return `<div class="craft-all-sections">${sections.join('')}</div>`;
  }

  function renderCraftList(recipes, workshopName) {
    if (recipes.length === 0) {
      return `<div class="muted small">No hay recetas disponibles.</div>`;
    }
    return `
      <div class="craft-modal">
        <div class="craft-list">
          ${recipes.map((r) => {
            const check = A.Crafting.canCraft(r.id);
            const result = A.Data.getById('items', r.result) ||
                           A.Data.getById('weapons', r.result) ||
                           A.Data.getById('armors', r.result);
            const resultName = result ? result.name : r.result;
            const resultIcon = result && A.ItemSprites ? A.ItemSprites.html(result, { size: 28 }) : '';
            return `
              <div class="craft-row ${check.ok ? '' : 'is-disabled'}">
                <div class="craft-row-result">
                  <span class="craft-icon">${resultIcon}</span>
                  <div>
                    <div class="craft-row-name">${A.Utils.escapeHtml(resultName)}</div>
                    <div class="dim small">${A.Utils.escapeHtml(r.name)}</div>
                  </div>
                </div>
                <div class="craft-ingredients">
                  ${(r.ingredients || []).map((ing) => {
                    const d = A.Inventory.resolveData(ing.itemId);
                    const slot = A.State.player.inventory.find((s) => s.itemId === ing.itemId);
                    const have = slot ? slot.qty : 0;
                    const ok = have >= ing.qty;
                    return `<span class="ingredient ${ok ? 'is-ok' : 'is-missing'}">${d ? (A.ItemSprites ? A.ItemSprites.html(d, { size: 18 }) : (d.icon)) : '·'} ${A.Utils.escapeHtml(d ? d.name : ing.itemId)} <span class="num">${have}/${ing.qty}</span></span>`;
                  }).join('')}
                </div>
                <button class="btn-mini" data-craft="${A.Utils.escapeHtml(r.id)}" ${check.ok ? '' : 'disabled'}>Crear</button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // ---------- Item Detail ----------

  function renderItemDetail({ itemId, equipped }) {
    const data = A.Inventory.resolveData(itemId);
    if (!data) return modalShell('Item', `<p class="muted">No encontrado.</p>`);

    const p = A.State.player;
    const kind = A.Inventory.classifyItem(itemId);
    const slot = p.inventory.find((s) => s.itemId === itemId);
    const qty = slot ? slot.qty : 0;
    // v2.1.1: abierto desde lo que tenés puesto (o no está en la mochila): se puede quitar
    const eq = p.equipment || {};
    const isWorn = (kind === 'weapon' && eq.weapon === itemId) || (kind === 'armor' && eq.armor === itemId) || (kind === 'accessory' && eq.accessory === itemId);
    const wornView = isWorn && (!!equipped || !slot);
    const inCombat = !!(A.State.combat && !A.State.combat.result);
    const esc = A.Utils.escapeHtml;
    const row = (label, value) => `<div class="detail-stat"><span class="dim">${label}</span><span>${value}</span></div>`;

    const rar = (A.Balance && A.Balance.RARITY && A.Balance.RARITY[data.rarity || 'common']) || null;
    const gearKind = ['weapon', 'armor', 'accessory'].includes(kind);
    // v3.9: ¿te conviene? (comparado con lo que tenés puesto) y para qué sirve
    const IC = A.ItemCompare;
    const verdict = IC && gearKind && !wornView ? IC.compare(itemId).verdict : null;
    const cmpHtml = IC && gearKind && !wornView ? IC.cmpBox(itemId) : '';
    const usesHtml = IC ? IC.usesHtml(itemId, { withSell: !gearKind }) : '';

    // v3.10: la ficha ordenada: qué te da (sin repetir números), comparado con lo tuyo, para qué sirve
    let learnNote = '';
    if (data.teachesSpell && data.subtype !== 'scroll_spell') {
      // v3.3: el pergamino que enseña un hechizo lo dice · v3.4: quién lo puede aprender
      const sp = A.Data.getById('spells', data.teachesSpell);
      const whoTxt = sp && A.Spellbook && A.Spellbook.who ? ({ mage: ', solo magos', both: ', magos e híbridos', hybrid: ', solo híbridos' })[A.Spellbook.who(sp)] || '' : '';
      if (sp) learnNote = `<li>${pxi('book', 14)}<span>Se puede aprender <b>${esc(sp.name)}</b> (hechizo de nivel ${sp.tier || 1}${whoTxt}${sp.cooldown ? `, cada ${sp.cooldown} turnos` : ''}). Al aprenderlo, el pergamino se gasta.</span></li>`;
    } else if (data.subtype === 'scroll_spell' && data.teachesSpell) {
      const sp = A.Data.getById('spells', data.teachesSpell);
      if (sp) learnNote = `<li>${pxi('book', 14)}<span>Enseña <b>${esc(sp.name)}</b>: ${esc(sp.description || '')}</span></li>`;
    }
    let gains = IC && IC.gainsHtml ? IC.gainsHtml(itemId) : '';
    if (learnNote) gains = gains ? gains.replace('</ul></div>', `${learnNote}</ul></div>`) : `<div class="gains"><div class="gains-title">Qué te da</div><ul class="effect-list gains-list">${learnNote}</ul></div>`;
    const statsLine = IC && IC.itemStatsLine ? IC.itemStatsLine(itemId) : '';
    const chips = [`<span class="rarity-tag rarity-${esc(data.rarity || 'common')}">${rarityLabel(data.rarity || 'common')}</span>`, esc(kindLabel(kind))];
    if (data.tier) chips.push(`Nivel ${data.tier}`);
    if (statsLine) chips.push(esc(statsLine));
    if (wornView) chips.push('<b>Lo tenés puesto</b>');
    else if (qty > 1 || (qty >= 1 && data.stack > 1 && data.subtype !== 'coin')) chips.push(data.stack > 1 && data.subtype !== 'coin' && !data.quest ? `Tenés ${qty} de ${data.stack}` : `Tenés ${qty}`); // v3.13: el tope
    const foot = [];
    if (data.subtype !== 'coin' && data.value > 0) foot.push(`Se vende a ${A.Currency.formatPrice(Math.max(1, Math.floor(data.value / 2)))}`);
    if (!gearKind && data.weight) foot.push(`Pesa ${data.weight}`);

    const actions = [];
    let hint = '';
    if (kind === 'weapon' || kind === 'armor' || kind === 'accessory') {
      // v3.3: los magos solo usan armas mágicas · v3.4: y las de mago son solo de ellos
      const cant = !wornView && A.Inventory.cantEquipWhy ? A.Inventory.cantEquipWhy(itemId) : '';
      if (wornView) actions.push(`<button class="btn-primary" data-detail-action="unequip">Quitar</button>`);
      else actions.push(`<button class="btn-primary" data-detail-action="equip" ${cant ? `disabled title="${esc(cant)}"` : ''}>Equipar</button>`);
      if (cant) hint = `<div class="item-modal-hint dim">${esc(cant)}</div>`;
    }
    if (kind === 'consumable' || (kind === 'scroll' && data.subtype !== 'scroll_spell')) {
      // v2.4: no dejes gastar algo que no hace nada ahora
      const can = inCombat ? { ok: true } : (A.ItemFx ? A.ItemFx.usableNow(data) : { ok: true });
      // v3.3: pociones, comida y hierbas no gastan el turno (hasta 3 por turno)
      const freeUse = inCombat && A.Combat.freeItem && A.Combat.freeItem(data);
      actions.push(`<button class="btn-primary" data-detail-action="use" ${can.ok ? '' : 'disabled'}>${inCombat ? (freeUse ? 'Usar (no gasta el turno)' : 'Usar (gasta tu turno)') : 'Usar'}</button>`);
      if (!can.ok && can.why && !(A.ItemFx && A.ItemFx.combatOnly(data))) hint = `<div class="item-modal-hint dim">${esc(can.why)}</div>`;
    }
    if (data.subtype === 'scroll_spell') {
      // v2.5: avisá antes si no lo podés aprender (solo magos, ya lo sabés...)
      const can = A.Spellbook && A.Spellbook.canLearn && p ? A.Spellbook.canLearn(p, data.teachesSpell) : { ok: true };
      actions.push(`<button class="btn-primary" data-detail-action="use" ${can.ok ? '' : 'disabled'}>Aprender hechizo</button>`);
      if (!can.ok && can.why) hint = `<div class="item-modal-hint dim">${esc(can.why)}</div>`;
    } else if (data.teachesSpell && p && p.hasMagic && !inCombat) {
      // v3.3: muchos pergaminos de combate también se pueden aprender (el pergamino se gasta)
      const sp = A.Data.getById('spells', data.teachesSpell);
      const can = A.Spellbook && A.Spellbook.canLearn ? A.Spellbook.canLearn(p, data.teachesSpell) : { ok: true };
      if (sp) {
        actions.push(`<button class="btn-primary" data-detail-action="learn" ${can.ok ? '' : 'disabled'} title="Se gasta el pergamino y aprendés ${esc(sp.name)}">${can.known ? `Ya sabés ${esc(sp.name)}` : `Aprender ${esc(sp.name)}`}</button>`);
        if (!can.ok && can.why && !can.known) hint = `<div class="item-modal-hint dim">${esc(can.why)}</div>`;
      }
    }
    if (kind === 'bag') {
      actions.push(`<button class="btn-primary" data-detail-action="use">Equipar mochila</button>`);
    }
    if (!wornView) actions.push(`<button class="btn-danger" data-detail-action="drop">Tirar</button>`);

    // v3.2: pasárselo a un compañero del grupo
    let giveRow = '';
    const mates = A.Party && A.Party.role && A.Party.status === 'connected' && A.Party.allies ? A.Party.allies() : [];
    if (mates.length && !wornView && slot && data.subtype !== 'coin') {
      const can = A.Party.canGive ? A.Party.canGive() : { ok: true };
      giveRow = `
        <div class="item-give ${can.ok ? '' : 'is-off'}">
          <span class="item-give-title">${pxi('party', 14)}<span>Dar a</span></span>
          ${qty > 1 ? `<span class="item-give-qty"><button type="button" class="btn-mini" data-give-step="-1" aria-label="Uno menos">−</button><b class="num" data-give-n>1</b><span class="dim">de ${qty}</span><button type="button" class="btn-mini" data-give-step="1" aria-label="Uno más">+</button></span>` : ''}
          <span class="item-give-who">${mates.map((m) => `<button type="button" class="btn-ghost btn-sm" data-give-to="${esc(m.hid)}" ${can.ok ? '' : 'disabled'}>${esc(m.name)}</button>`).join('')}</span>
          ${can.ok ? '' : `<span class="item-give-why dim">${esc(can.why)}</span>`}
        </div>`;
    }

    const body = `
      <div class="item-modal item-modal-v310">
        <div class="item-modal-header">
          <div class="item-modal-icon ${rar ? `rarity-frame rarity-${esc(data.rarity || 'common')}` : ''}">${(A.ItemSprites ? A.ItemSprites.html(data, { size: 72 }) : '')}</div>
          <div class="item-modal-head-text">
            <div class="item-modal-name">${esc(data.name)} ${verdict && IC ? IC.verdictBadge(verdict) : ''}</div>
            <div class="item-modal-chips">${chips.join('<span class="dot">·</span>')}</div>
          </div>
        </div>
        ${data.description ? `<p class="item-modal-desc">${esc(data.description)}</p>` : ''}
        ${gains}
        ${cmpHtml}
        ${usesHtml ? `<div class="item-uses-box"><div class="gains-title">Para qué sirve</div>${usesHtml}</div>` : ''}
        ${foot.length ? `<div class="item-meta-line">${foot.join('<span class="dot">·</span>')}</div>` : ''}
        ${hint}
        <div class="item-modal-actions">
          ${actions.join('')}
        </div>
        ${giveRow}
      </div>
    `;
    return modalShell(data.name, body);
  }

  // ---------- Rules ----------

  function renderRules() {
    const body = `
      <div class="rules-modal">
        <h3>Cómo se juega</h3>
        <p>Elegís una raza, explorás zonas, peleás, juntás botín y volvés a los pueblos a vender, comprar, descansar y aprender. La historia principal empieza con Tomas el guardia, en el Pueblo Inicial.</p>

        <h3>El dado</h3>
        <p>Casi todo se decide con un dado de 20 caras. Atacar son dos pasos: primero se ve <b>si acertás</b> y después <b>cuánta vida sacás</b>. Al explorar, las opciones también tiran el dado (Fuerza, Agilidad, Ingenio, Puntería o Suerte), y siempre ves el porcentaje antes de elegir.</p>

        <h3>Tus números</h3>
        <ul class="rules-list">
          <li><b>Precisión</b>: sirve para acertar. Se suma al dado de 20, y el total tiene que llegar a la <b>dificultad</b> de la criatura (el número que ves sobre el dado en cada una). Con precisión +3 contra dificultad 10, acertás sacando 7 o más.</li>
          <li><b>Daño</b>: la vida que sacás cuando acertás. "1d4" quiere decir un dado de 4 caras: de 1 a 4. "1d6+2" es un dado de 6 más 2: de 3 a 8. Lo da tu arma. A eso se le resta la armadura del enemigo.</li>
          <li><b>Defensa</b>: lo mismo, pero al revés. Es lo que el enemigo tiene que alcanzar con su dado para pegarte. Sube con la esquiva.</li>
          <li><b>Armadura</b>: se resta de cada golpe que recibís.</li>
          <li><b>Velocidad</b>: el más rápido pega primero, y te ayuda a huir. El arma y la armadura pesan: lo que pasen de 4 entre las dos te lo restan de velocidad.</li>
          <li><b>Magia</b>: lo que suman tus hechizos al daño (o a la curación). Los hechizos de daño tiran el dado como un arma, con +2 a tu precisión: pueden fallar y, con 20, hacen el doble. Algunos no fallan nunca, y los más fuertes tienen espera (se usan cada tantos turnos).</li>
        </ul>
        <p>Si en el dado sale un 20 es golpe crítico: acierta siempre y hace el doble de daño. Con un 1 falla siempre.</p>

        <h3>Equipo y objetos</h3>
        <p>Llevás un arma, una armadura, un <b>accesorio</b> (anillos, amuletos, botas, capas: cada uno con un efecto propio) y una mochila. Todo tiene <b>rareza</b>: común, poco común, raro, épico y legendario; mientras más rara, más cuesta y menos se encuentra. Lo que vendés te lo pagan a la mitad de su precio.</p>
        <p>Las pociones curan o te dan una mejora por unos turnos. Los <b>pergaminos</b> los puede usar cualquiera, una sola vez y en combate: dañan, paralizan, maldicen o te protegen, y no fallan; muchos se pueden aprender como hechizo. En tu turno podés usar <b>hasta 3 pociones, comidas o hierbas sin perderlo</b>; un pergamino, en cambio, gasta el turno. Si una misión te pide algo que sueltan las criaturas, mientras te falte lo vas a encontrar más seguido.</p>

        <h3>Explorar</h3>
        <p>Cada vez que explorás pasa algo: aparece una criatura (y elegís cómo encararla) o te toca una escena con dos o tres caminos. Explorar hace pasar el tiempo y da hambre.</p>

        <h3>Clases</h3>
        <p><b>Guerreros</b>: sin magia, pero pegan más fuerte con las armas comunes (maestría) y tienen el <b>Golpe fuerte</b>: un ataque con el doble de daño que se puede usar una vez cada 5 turnos. <b>Magos</b>: viven de la magia; el maná les vuelve solo, un poco en cada turno (más desde el nivel 5) y otro poco al ganar, pero son frágiles. <b>Solo usan armas de mago</b> (bastones, varitas, cetros, orbes y tomos), que les suman poder mágico, y <b>sin una puesta no pueden lanzar hechizos</b>. Aprenden todos los hechizos: Curación, los de área y los de todos los pergaminos. <b>Híbridos</b>: armas comunes y magia corta: su hechizo de raza, Chispa, Llama, Rayo helado, Segundo aliento y 6 pergaminos de combate; cada golpe con arma que aciertan les devuelve maná (más desde el nivel 9). Las armas de mago son solo de los magos. Cada raza nace con su propia arma, y cada raza con magia, con su propio hechizo.</p>

        <h3>Descansar</h3>
        <p>De día, una siesta te cura un poco (hasta la mitad de tu vida) y pasa la tarde. De noche dormís hasta la mañana y te curás más (hasta tres cuartos); al raso, algo puede acercarse. Descansar da hambre, y después de descansar tenés que moverte (explorar, pelear o viajar) antes de volver a descansar. Para recuperarte del todo: la posada del pueblo o una poción.</p>

        <h3>Huir</h3>
        <p>Tenés dos intentos por pelea. En grupo, <b>el que huye se va solo</b>: deja la pelea con su mascota y sigue por su cuenta; los demás siguen peleando. Si el que huye era el último en pie, se van todos y se llevan a los caídos.</p>

        <h3>Caer y morir</h3>
        <p>Si en una pelea te quedás sin vida, <b>caés</b>, pero no morís enseguida. En grupo, si tus compañeros ganan te levantan (y con una <b>hierba de la vida</b> te pueden levantar en plena pelea). Si perdés solo, o caen todos, se tira el <b>dado de rescate</b>: si sale, alguien te encuentra y te lleva al pueblo con 1 de vida; si no, tu aventura termina. Cerca del pueblo es fácil que te encuentren (6 o más); en las zonas más peligrosas, muy difícil (hasta 14). Si tu mascota sigue en pie, corre a buscar ayuda (+3), y la Suerte del mediano suma +2.</p>
        <p>Fuera de las peleas no hay rescate: si una <b>trampa</b> o un golpe te deja en 0, o te morís de <b>hambre</b>, tu aventura termina. Con poca vida, descansá o tomá una poción antes de seguir.</p>

        <h3>Misiones</h3>
        <p>Los habitantes con un signo de exclamación dorado tienen algo para vos. Con un signo de pregunta, te esperan para cobrar. Todo queda anotado en el Diario.</p>
      </div>
    `;
    return modalShell('Reglas', body);
  }

  // ---------- Menu ----------

  /** v3.1: la voz del narrador: prender/apagar y la velocidad. */
  function voiceRow() {
    if (!A.Voice) return '';
    if (!A.Voice.supported()) return `<div class="menu-voice is-off">${pxi('mute', 22)}<span>Este navegador no tiene voz para el narrador.</span></div>`;
    const on = A.Voice.isOn();
    const fast = A.Voice.rate() > 1.1;
    const name = A.Voice.voiceName();
    return `
      <div class="menu-voice ${on ? 'is-on' : ''}">
        <button class="menu-voice-toggle" data-menu-action="voice" aria-pressed="${on ? 'true' : 'false'}">
          ${pxi(on ? 'voice' : 'mute', 24)}
          <span><b>Voz del narrador</b><small>${on ? `Encendida${name ? ` · ${A.Utils.escapeHtml(name)}` : ''}` : 'Apagada: tocá para que lea en voz alta'}</small></span>
        </button>
        ${on ? `<button class="menu-voice-speed" data-menu-action="voice-speed" title="Velocidad de la voz">${fast ? 'Rápida' : 'Normal'}</button>` : ''}
      </div>
      ${on && !A.Voice.hasSpanish() ? '<p class="muted small">No encontramos una voz en español en este navegador: va a leer con la que tenga.</p>' : ''}`;
  }

  // ---------- v3.3: tus hechizos (estaba roto: faltaba esta función) ----------
  function renderMagic() {
    const pl = A.State.player; // v3.13: los guerreros ven sus técnicas
    return modalShell(pl && !pl.hasMagic ? 'Tus técnicas' : 'Tus hechizos', A.Views.Magic ? A.Views.Magic.renderHtml() : '');
  }

  // ---------- v3.3: tus números al explorar (salieron de la barra del costado) ----------
  function renderExploreStats() {
    const p = A.State.player;
    const list = A.Explore && A.Explore.sheet ? A.Explore.sheet(p) : [];
    const esc = A.Utils.escapeHtml;
    const sign = (v) => (v > 0 ? `+${v}` : `${v}`);
    const rows = list.map((x) => `
        <div class="xs-row ${x.down ? 'is-down' : ''}">
          <span class="xs-ic">${pxi(x.icon, 22)}</span>
          <span class="xs-main"><b>${esc(x.label)}</b><small class="dim">${esc(x.hint || '')}${x.down ? ' Con hambre fuerte, baja.' : ''}</small></span>
          <span class="xs-val num">${sign(x.value)}</span>
        </div>`).join('');
    const body = `
      <div class="xs">
        <p class="xs-lead">Cuando una escena te pide una tirada, se tira un dado de 20 y se le suma el número de lo que pide. Si llegás a lo que hace falta, sale bien.</p>
        <div class="xs-list">${rows}</div>
        <p class="xs-note dim">Sacar 20 siempre sale bien y sacar 1 siempre sale mal. Observar antes de decidir suma a la próxima tirada.</p>
      </div>`;
    return modalShell('Tus números al explorar', body);
  }

  function renderMenu() {
    // v3.0: la cuenta con la que entraste, y lo del editor solo para el dueño
    const acc = A.Accounts && A.Accounts.info ? A.Accounts.info() : null;
    const owner = !A.Accounts || A.Accounts.canEdit();
    const body = `
      <div class="menu-modal">
        ${acc ? `<div class="menu-account">${pxi('user', 22)}<span>Cuenta: <b>${A.Utils.escapeHtml(acc.name)}</b>${acc.owner ? ' <span class="menu-owner">dueño</span>' : ''}</span></div>` : ''}
        ${voiceRow()}
        <button class="menu-action" data-menu-action="rules">Reglas del juego</button>
        <button class="menu-action" data-menu-action="party">Jugar en grupo</button>
        <button class="menu-action" data-menu-action="export-save">Exportar partida</button>
        ${owner ? '<button class="menu-action" data-menu-action="export-content">Exportar contenido del editor</button>' : ''}
        <button class="menu-action" data-menu-action="import">Importar (JSON)</button>
        ${acc ? `<button class="menu-action" data-menu-action="logout">${pxi('logout', 18)} Cerrar sesión</button>` : ''}
        <button class="menu-action danger" data-menu-action="reset">${owner ? 'Borrar todo' : 'Borrar mi partida'}</button>
        <p class="muted small">${owner ? 'Borrar todo elimina tu partida y los cambios del editor.' : 'Borrar tu partida elimina tu personaje de esta cuenta.'} No se puede deshacer.</p>
      </div>
    `;
    return modalShell('Menú', body);
  }

  // ---------- Confirm ----------

  function renderConfirm({ title, body, danger }) {
    const inner = `
      <div class="confirm-modal">
        <p>${A.Utils.escapeHtml(body || '')}</p>
        <div class="confirm-actions">
          <button class="btn-ghost" data-confirm-action="cancel">Cancelar</button>
          <button class="${danger ? 'btn-danger' : 'btn-primary'}" data-confirm-action="ok">Confirmar</button>
        </div>
      </div>
    `;
    return modalShell(title || 'Confirmar', inner);
  }

  // ---------- Creature (info / domar) ----------

  /** v3.1: dónde vive y cuándo sale (las zonas que no conocés, como "???"). */
  function creatureWhere(e) {
    const w = A.State.world || {};
    const visited = new Set(w.visited || []);
    if (w.regionId) visited.add(w.regionId);
    const zones = (e.regions || []).map((rid) => {
      const r = A.Data.getById('regions', rid);
      return r && visited.has(rid) ? r.name : '???';
    });
    const uniq = zones.filter((z, i) => zones.indexOf(z) === i);
    const tl = A.Encounter && A.Encounter.timeLabel ? A.Encounter.timeLabel(e) : '';
    return `
      <div class="creature-where">
        ${A.ItemSprites ? A.ItemSprites.icon('pin', { size: 18 }) : ''}<span>Vive en: ${A.Utils.escapeHtml(uniq.join(', ') || '???')}</span>
        ${tl ? `<span class="creature-where-time">${A.ItemSprites ? A.ItemSprites.icon(e.time === 'night' ? 'moon' : 'sun', { size: 18 }) : ''}${A.Utils.escapeHtml(tl)}</span>` : ''}
      </div>`;
  }

  function renderCreature(payload) {
    const html = renderCreatureInner(payload);
    if (!payload || payload.back !== 'bestiary') return html;
    // v3.1: desde el bestiario, un botón para volver
    return html.replace(/(<\/div>\s*)$/, `<div class="creature-back"><button class="btn-ghost" data-back-bestiary>${A.ItemSprites ? A.ItemSprites.icon('skulls', { size: 18 }) : ''}<span>Volver al bestiario</span></button></div>$1`);
  }

  function renderCreatureInner({ enemyId }) {
    const e = A.Data.getById('enemies', enemyId);
    if (!e) return modalShell('Criatura', `<p class="muted">No encontrada.</p>`);
    // v3.1: bestiario: "???" hasta que la ves; habilidades y botín, cuando la conocés
    const known = !A.Bestiary || A.Bestiary.isKnown(e.id);
    const studied = !A.Bestiary || A.Bestiary.isStudied(e.id);
    if (!known) {
      return modalShell('???', `
        <div class="creature-modal is-unknown">
          <div class="creature-modal-header">
            <div class="creature-modal-icon">${A.Sprites ? A.Sprites.html(e, { size: 80 }) : ''}</div>
            <div>
              <div class="creature-modal-name">???</div>
              <div class="creature-modal-meta dim"><span class="pill pill-tier">Nivel ${e.tier}</span></div>
            </div>
          </div>
          <p class="muted">Todavía no la viste. Explorá y viajá por las zonas para descubrirla: cuando la encuentres, entra a tu bestiario.</p>
        </div>`);
    }
    const bk = A.Bestiary ? A.Bestiary.entry(e.id) : null;
    const families = (e.family || []).map(escapeChip).join(' ');
    const tags = (e.tags || []).map(escapeChip).join(' ');
    const canTame = !!e.tameable;
    const havePet = !!A.State.player.pet;
    // v1.8.0: requisitos reales de domesticación (nivel, jefe, inteligencia)
    const tameCheck = canTame && A.Tame ? A.Tame.canTame(e.id) : null;
    const tameBlocked = tameCheck && !tameCheck.ok && !['missing-item', 'already-have-pet'].includes(tameCheck.reason);
    const diet = canTame && A.Tame ? A.Tame.dietInfo(e) : null;
    const body = `
      <div class="creature-modal">
        <div class="creature-modal-header">
          <div class="creature-modal-icon">${A.Sprites ? A.Sprites.html(e, { size: 80 }) : ''}</div>
          <div>
            <div class="creature-modal-name">${A.Utils.escapeHtml(e.name)}</div>
            <div class="creature-modal-meta dim">
              <span class="pill pill-tier">Nivel ${e.tier}</span>
              <span class="pill">${categoryLabel(e.category, e)}</span>
              ${canTame ? `<span class="pill pill-tameable">Domable</span>` : ''}
            </div>
          </div>
        </div>
        ${creatureDiceBlock(e)}
        ${canTame && A.Tame.bondText && A.Tame.bondText(e.id) ? `<p class="creature-bond">${A.UI ? A.UI.icon('paw', 14) : ''}<span>${A.Utils.escapeHtml(A.Tame.bondText(e.id))}</span></p>` : ''}
        ${creatureWhere(e)}
        <div class="creature-stats">
          <div class="stat-row"><span class="dim">Salud</span><span class="num">${e.health}</span></div>
          <div class="stat-row"><span class="dim">Daño</span><span class="num">${e.damage}</span></div>
          <div class="stat-row"><span class="dim">Precisión</span><span class="num">+${e.attack != null ? e.attack : '?'}</span></div>
          <div class="stat-row"><span class="dim">Armadura</span><span class="num">${e.armor}</span></div>
          <div class="stat-row"><span class="dim">Velocidad</span><span class="num">${e.speed}</span></div>
        </div>
        ${studied ? (() => {
          // v2.5: pasivas y activas de la criatura
          const list = A.Skills ? A.Skills.listFor(e) : [];
          const drops = A.Bestiary ? A.Bestiary.dropsOf(e) : [];
          return `
            ${list.length ? `<div class="creature-skills">
              <div class="creature-skills-title">Habilidades</div>
              ${list.map((sk) => `<div class="creature-skill">${A.ItemSprites ? A.ItemSprites.icon(sk.icon || 'star', { size: 20 }) : ''}<span><b>${A.Utils.escapeHtml(sk.name)}</b> <span class="dim">· ${sk.kind === 'passive' ? 'pasiva' : 'activa'}</span><br><span class="dim small">${A.Utils.escapeHtml(sk.text || '')}</span></span></div>`).join('')}
            </div>` : ''}
            ${drops.length ? `<div class="creature-skills creature-drops">
              <div class="creature-skills-title">Puede soltar</div>
              <div class="creature-drop-list">${drops.slice(0, 10).map((d) => `<span class="creature-drop" title="${Math.round(d.chance * 100)}%">${A.ItemSprites ? A.ItemSprites.html(d.id, { size: 22 }) : ''}<span>${A.Utils.escapeHtml(d.name)}</span></span>`).join('')}</div>
            </div>` : ''}`;
        })() : `<p class="creature-secret">${A.ItemSprites ? A.ItemSprites.icon('question', { size: 18 }) : ''}<span>Sus habilidades y su botín, todavía no. Observala al explorar o vencela ${A.Bestiary ? A.Bestiary.KNOW_KILLS : 3} veces.</span></p>`}
        ${bk && bk.killed ? `<p class="muted small">La venciste ${bk.killed} ${bk.killed === 1 ? 'vez' : 'veces'}.</p>` : ''}
        <div class="creature-notes">
          <p class="muted small">Aparece al explorar o al viajar por la zona. A veces sale de élite (alfa, campeón o mayor): más fuerte y con mejor botín.</p>
          ${canTame && !tameBlocked ? `<p class="muted small">Se puede domar si es el último enemigo en pie y tenés la comida que le gusta${diet ? ` (come ${A.Utils.escapeHtml(diet.eats)})` : ''}.</p>` : ''}
          ${tameBlocked ? `<p class="muted small">No se puede domar: ${A.Utils.escapeHtml(A.Tame.reasonText(tameCheck.reason))}${tameCheck.requiredLevel ? ` (nivel ${tameCheck.requiredLevel})` : ''}.</p>` : ''}
          ${canTame && havePet ? `<p class="muted small">Ya tenés una mascota: para domar otra, primero liberá a ${A.Utils.escapeHtml(A.State.player.pet.name)} (botón "Liberar" en su ficha, en la barra del costado).</p>` : ''}
        </div>
      </div>
    `;
    return modalShell(e.name, body);
  }

  /** La dificultad del dado de una criatura y lo que tenés que sacar vos. */
  function creatureDiceBlock(e) {
    const dc = e.difficulty != null ? e.difficulty : 10;
    const p = A.State.player;
    const atk = p && A.Balance && A.Balance.playerCombatStats ? (A.Balance.playerCombatStats(p).attack || 0) : 0;
    const need = Math.max(2, Math.min(20, dc - atk));
    const pct = A.Balance && A.Balance.hitChance ? Math.round(A.Balance.hitChance(atk, dc) * 100) : null;
    return `
      <div class="creature-dice">
        ${A.ItemSprites && A.ItemSprites.dcBadge ? A.ItemSprites.dcBadge(dc, { size: 44 }) : `<b>${dc}</b>`}
        <div class="creature-dice-text">
          <div class="creature-dice-title">Dificultad del dado: ${dc}</div>
          <div class="muted small">Con tu precisión (+${atk}) necesitás sacar <b>${need} o más</b> en el dado de 20${pct != null ? ` (${pct}% de acertarle)` : ''}.</div>
        </div>
      </div>`;
  }

  function escapeChip(s) {
    return `<span class="creature-chip-mini">${A.Utils.escapeHtml(s)}</span>`;
  }

  function categoryLabel(c, e) {
    const sid = e && (e.enemyId || e.id);
    if (e && (e.miniBoss || (sid && (A.Data.getById('enemies', sid) || {}).miniBoss))) return 'Mini jefe'; // v3.11.1
    return ({ weak: 'Débil', normal: 'Normal', strong: 'Fuerte', boss: 'Jefe' })[c] || c;
  }

  // ---------- All creatures de una región ----------

  function renderAllCreatures({ regionId }) {
    const region = A.Data.getById('regions', regionId);
    const enemies = A.Data.enemiesInRegion(regionId);
    if (!region || enemies.length === 0) {
      return modalShell('Criaturas', `<p class="muted">Sin información para esta región.</p>`);
    }
    const body = `
      <div class="all-creatures-modal">
        <p class="muted">${enemies.length} criaturas pueden aparecer en ${A.Utils.escapeHtml(region.name)}.</p>
        <div class="creature-list">
          ${enemies.map((e) => {
            const known = !A.Bestiary || A.Bestiary.isKnown(e.id);
            const tl = known && A.Encounter && A.Encounter.timeLabel ? A.Encounter.timeLabel(e) : '';
            return `
            <button class="creature-list-row ${known ? '' : 'is-unknown'}" data-creature="${A.Utils.escapeHtml(e.id)}">
              <span class="creature-list-icon">${A.Sprites ? A.Sprites.html(e, { size: 36 }) : ''}</span>
              <span class="creature-list-info">
                <span class="creature-list-name">${known ? A.Utils.escapeHtml(e.name) : '???'}</span>
                <span class="creature-list-meta dim">
                  Nivel ${e.tier}${known ? ` · ${categoryLabel(e.category, e)}${e.tameable ? ' · domable' : ''}${tl ? ` · ${tl.toLowerCase()}` : ''}` : ' · todavía no la viste'}
                </span>
              </span>
              ${known && A.ItemSprites && A.ItemSprites.dcBadge ? A.ItemSprites.dcBadge(e.difficulty != null ? e.difficulty : 10, { size: 30 }) : ''}
              <span class="creature-list-arrow dim">›</span>
            </button>`;
          }).join('')}
        </div>
      </div>
    `;
    return modalShell(`Criaturas — ${region.name}`, body);
  }

  // ---------- Tame ----------

  function renderTame({ enemyId, fromTravel }) {
    const e = A.Data.getById('enemies', enemyId);
    if (!e) return modalShell('Domar', `<p class="muted">Criatura no encontrada.</p>`);
    const itemId = A.Tame.requiredItem(e);
    const item = A.Data.getById('items', itemId);
    const have = (A.State.player.inventory || []).find((s) => s.itemId === itemId);
    const haveQty = have ? have.qty : 0;
    const check = A.Tame.canTame(e.id);
    const blocked = !check.ok && check.reason !== 'missing-item';
    const canDo = haveQty > 0 && !blocked;
    const chancePct = Math.round(A.Tame.chanceFor(e) * 100);
    const diet = A.Tame.dietInfo(e);

    const body = `
      <div class="tame-modal">
        <div class="tame-icon">${A.Sprites ? A.Sprites.html(e, { size: 88 }) : ''}</div>
        <p class="tame-text">
          ${canDo
            ? `Te acercas a ${A.Utils.escapeHtml(e.name)} con ${A.Utils.escapeHtml(item ? item.name : itemId)} en la mano.`
            : `Para domar a ${A.Utils.escapeHtml(e.name)} necesitás ${A.Utils.escapeHtml(item ? item.name : itemId)}, y no llevás nada.`}
        </p>
        <div class="tame-info">
          ${A.Tame.bondText && A.Tame.bondText(e.id) ? `<div class="tame-info-row"><span class="dim">Te ayuda:</span><span>${A.Utils.escapeHtml(A.Tame.bondText(e.id))}</span></div>` : ''}
          <div class="tame-info-row">
            <span class="dim">Necesitas:</span>
            <span>${item ? (A.ItemSprites ? A.ItemSprites.html(item, { size: 20 }) : '') : ''} ${A.Utils.escapeHtml(item ? item.name : itemId)} ${haveQty > 0 ? `<span class="num dim">(tenés ${haveQty})</span>` : '<span class="num danger">(no tenés)</span>'}</span>
          </div>
          <div class="tame-info-row">
            <span class="dim">Probabilidad:</span>
            <span class="num">${chancePct}%</span>
          </div>
          <div class="tame-info-row">
            <span class="dim">Como mascota come:</span>
            <span>${A.Utils.escapeHtml(diet.eats)}</span>
          </div>
          ${blocked ? `<div class="danger small">No se puede: ${A.Utils.escapeHtml(A.Tame.reasonText(check.reason))}${check.requiredLevel ? ` (necesitás nivel ${check.requiredLevel})` : ''}.</div>` : ''}
          <div class="muted small">El item se consume al intentar, hayas tenido suerte o no. En combate es más fácil si la criatura está herida.</div>
        </div>
        <div class="tame-actions">
          <button class="btn-primary" data-tame-action="attempt" data-enemy-id="${A.Utils.escapeHtml(e.id)}" data-from-travel="${fromTravel ? '1' : '0'}" ${canDo ? '' : 'disabled'}>Intentar (consume 1 ${A.Utils.escapeHtml(item ? item.name : itemId)})</button>
          <button class="btn-ghost" data-tame-action="cancel">Cancelar</button>
        </div>
      </div>
    `;
    return modalShell(`Domar a ${e.name}`, body);
  }

  // ---------- Equipped bag (modal con info y botón Quitar) ----------

  function renderEquippedBag(payload) {
    const p = A.State.player;
    const bag = A.Data.getById('bags', (payload || {}).bagId || p.bagId);
    if (!bag) return modalShell('Mochila', `<p class="muted">Mochila no encontrada.</p>`);
    const used = A.State.inventoryUsedSlots();
    const isBasic = bag.id === 'bag_basic';
    const canRemove = !isBasic;
    // Si la quito, vuelvo a bag_basic. Verifico si los items entran
    const basic = A.Data.getById('bags', 'bag_basic');
    const fitsAfterRemove = basic ? used <= basic.slots : false;
    const body = `
      <div class="item-modal">
        <div class="item-modal-header">
          <div class="item-modal-icon">${(A.ItemSprites ? A.ItemSprites.html(bag, { size: 72 }) : '')}</div>
          <div>
            <div class="item-modal-name">${A.Utils.escapeHtml(bag.name)}</div>
            <div class="item-modal-meta dim">Mochila · ${bag.slots} espacios</div>
          </div>
        </div>
        <p class="item-modal-desc">${A.Utils.escapeHtml(bag.description || '')}</p>
        <div class="detail-stats">
          <div class="detail-stat"><span class="dim">Capacidad</span> <span class="num">${used}/${bag.slots}</span></div>
          <div class="detail-stat"><span class="dim">Rareza</span> <span>${rarityLabel(bag.rarity)}</span></div>
        </div>
        <div class="item-modal-actions">
          ${isBasic ? `
            <button class="btn-secondary" disabled>Mochila inicial (no se puede quitar)</button>
          ` : `
            <button class="btn-primary" data-bag-remove="1" ${fitsAfterRemove ? '' : 'disabled'}>
              ${fitsAfterRemove ? 'Quitar (volver a mochila básica)' : `No entra: tenés ${used} items, la básica solo aguanta ${basic.slots}`}
            </button>
          `}
        </div>
      </div>
    `;
    return modalShell(bag.name, body);
  }

  // ---------- Chronicles full (modal con historial completo) ----------

  function renderChroniclesFull() {
    const all = A.State.chronicles || [];
    const ICONS = {
      combat: 'swords', loot: 'coins', heal: 'heart', shop: 'shop',
      travel: 'boot', craft: 'anvil', spell: 'book', rest: 'tent',
      item: 'bag', note: 'feather', system: 'star', region: 'pin',
    };
    const body = `
      <div class="chronicles-full-modal">
        <p class="muted">Tu historia hasta ahora. ${all.length} ${all.length === 1 ? 'entrada' : 'entradas'}.</p>
        <div class="chronicles-full-list">
          ${all.length === 0 ? `
            <div class="empty-card">
              <div class="empty-icon">${pxi('scroll', 40)}</div>
              <div class="empty-title">Sin historia aún</div>
              <div class="empty-text muted">Tus aventuras se irán registrando acá.</div>
            </div>
          ` : all.map((e) => `
            <div class="chronicle-full-row">
              <span class="chronicle-full-icon">${pxi(ICONS[e.type] || 'feather', 16)}</span>
              <div class="chronicle-full-body">
                <div class="chronicle-full-text">${A.Utils.escapeHtml(e.text)}</div>
                <div class="chronicle-full-meta dim">${formatTimestamp(e.ts)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    return modalShell('Crónicas', body);
  }

  function formatTimestamp(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) {
      return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  // ---------- Travel modal (lista de destinos + mapa) ----------

  function renderTravelModal() {
    const neighbors = A.Travel.neighbors() || [];
    const currentRegion = A.Data.getById('regions', A.State.world.regionId);
    const body = `
      <div class="travel-modal">
        <div class="travel-modal-header">
          <span class="travel-modal-current">
            <span class="travel-modal-icon-mini">${A.UI ? A.UI.biomeIcon(currentRegion, 18) : ''}</span>
            <span class="dim">Estás en</span>
            <strong>${currentRegion ? A.Utils.escapeHtml(currentRegion.name) : '?'}</strong>
          </span>
        </div>

        ${renderTravelMapSvg(currentRegion)}

        ${neighbors.length === 0 ? `
          <div class="empty-card">
            <div class="empty-icon">${pxi('map', 40)}</div>
            <div class="empty-title">No hay caminos desde acá</div>
            <div class="empty-text muted">Esta región es un punto final.</div>
          </div>
        ` : `
          <div class="travel-modal-section-title">Destinos disponibles</div>
          <div class="travel-modal-list">
            ${neighbors.map((n) => travelModalCard(n)).join('')}
          </div>
        `}
      </div>
    `;
    return modalShell('Viajar', body);
  }

  /**
   * Genera un mapa SVG con auto-layout BFS por anillos:
   *   - región actual al centro
   *   - regiones a 1 salto en el anillo 1
   *   - regiones a 2 saltos en el anillo 2
   *   - etc.
   * Las líneas representan las conexiones reales entre regiones.
   */
  function renderTravelMapSvg(currentRegion) {
    if (!currentRegion) return '';
    const allRegions = A.Data.regions || [];
    if (allRegions.length === 0) return '';

    // BFS: distancia de cada región al actual
    const dist = {};
    dist[currentRegion.id] = 0;
    const queue = [currentRegion.id];
    while (queue.length > 0) {
      const id = queue.shift();
      const reg = allRegions.find((r) => r.id === id);
      if (!reg) continue;
      for (const cid of (reg.connections || [])) {
        if (dist[cid] === undefined) {
          dist[cid] = dist[id] + 1;
          queue.push(cid);
        }
      }
    }

    // Agrupar por distancia
    const rings = {};
    for (const r of allRegions) {
      const d = dist[r.id];
      if (d === undefined) continue; // región desconectada del actual
      if (!rings[d]) rings[d] = [];
      rings[d].push(r);
    }

    // Posicionar: centro (300,200), radios 80, 160, 240
    const cx = 300, cy = 200;
    const ringRadii = [0, 95, 175, 250];
    const positions = {};
    for (const dStr of Object.keys(rings)) {
      const d = parseInt(dStr, 10);
      const ring = rings[d];
      const radius = ringRadii[d] != null ? ringRadii[d] : 250 + (d - 3) * 75;
      if (d === 0) {
        positions[ring[0].id] = { x: cx, y: cy };
      } else {
        const n = ring.length;
        for (let i = 0; i < n; i++) {
          // Distribuir en el círculo, empezando desde arriba (-PI/2)
          const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
          positions[ring[i].id] = {
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
          };
        }
      }
    }

    // Calcular bounds para viewBox
    const xs = Object.values(positions).map((p) => p.x);
    const ys = Object.values(positions).map((p) => p.y);
    const minX = Math.min(...xs) - 60, maxX = Math.max(...xs) + 60;
    const minY = Math.min(...ys) - 50, maxY = Math.max(...ys) + 50;
    const w = maxX - minX, h = maxY - minY;

    // Dibujar líneas (conexiones únicas)
    const drawnEdges = new Set();
    const lines = [];
    for (const r of allRegions) {
      if (!positions[r.id]) continue;
      for (const cid of (r.connections || [])) {
        if (!positions[cid]) continue;
        const edgeKey = [r.id, cid].sort().join('-');
        if (drawnEdges.has(edgeKey)) continue;
        drawnEdges.add(edgeKey);
        const a = positions[r.id], b = positions[cid];
        // Línea destacada si conecta con la región actual
        const isFromCurrent = r.id === currentRegion.id || cid === currentRegion.id;
        const cls = isFromCurrent ? 'map-edge map-edge-active' : 'map-edge';
        lines.push(`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" class="${cls}" />`);
      }
    }

    // Dibujar nodos
    const nodes = [];
    for (const r of allRegions) {
      if (!positions[r.id]) continue;
      const p = positions[r.id];
      const isCurrent = r.id === currentRegion.id;
      const isNeighbor = (currentRegion.connections || []).includes(r.id);
      const reachable = isCurrent || isNeighbor;
      const cls = `map-node ${isCurrent ? 'is-current' : ''} ${isNeighbor ? 'is-neighbor' : ''} ${!reachable ? 'is-far' : ''} is-${r.type}`;
      const nodeRadius = isCurrent ? 26 : isNeighbor ? 22 : 16;
      const fontSize = isCurrent ? 22 : isNeighbor ? 18 : 14;
      const labelY = p.y + nodeRadius + 14;
      nodes.push(`
        <g class="${cls}" data-map-region="${A.Utils.escapeHtml(r.id)}" ${isNeighbor ? 'data-clickable="1"' : ''}>
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${nodeRadius}" />
          <image href="${A.ItemSprites && A.ItemSprites.iconUrl ? A.ItemSprites.iconUrl('biome-' + r.biome) : ''}" x="${(p.x - fontSize / 2).toFixed(1)}" y="${(p.y - fontSize / 2).toFixed(1)}" width="${fontSize}" height="${fontSize}" class="map-node-icon"/>
          <text x="${p.x.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" class="map-node-label" font-size="10">${A.Utils.escapeHtml(r.name)}</text>
        </g>
      `);
    }

    return `
      <div class="travel-map-wrap">
        <div class="travel-map-legend">
          <span class="map-legend-item"><span class="map-legend-dot is-current"></span>Estás aquí</span>
          <span class="map-legend-item"><span class="map-legend-dot is-neighbor"></span>Disponible</span>
          <span class="map-legend-item"><span class="map-legend-dot is-far"></span>Lejos</span>
        </div>
        <svg class="travel-map-svg" viewBox="${minX} ${minY} ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
          <g class="map-edges">${lines.join('')}</g>
          <g class="map-nodes">${nodes.join('')}</g>
        </svg>
      </div>
    `;
  }

  function travelModalCard(n) {
    const dangerLabel = (n.type === 'safe' || n.type === 'road') ? 'Seguro' : 'Combate';
    const dangerClass = (n.type === 'safe' || n.type === 'road') ? 'pill-safe' : 'pill-combat';
    const enemiesCount = A.Data.enemiesInRegion(n.id).length;
    const dist = n.distance || 1;
    const travelCheck = A.Travel.canTravelToDetailed(n.id);
    const locked = !travelCheck.ok && travelCheck.locked;
    const cls = `travel-modal-card ${locked ? 'is-locked' : ''}`;
    const distLabel = dist === 1 ? 'Cerca' : dist === 2 ? 'Medio camino' : 'Lejos';

    // v1.6.4: Si está bloqueada, mostrar lista de requisitos data-driven
    let lockedSection = '';
    if (locked) {
      const reqs = travelCheck.requirements || [];
      const customWarning = n.unlockConditions && n.unlockConditions.warningText;
      const metCount = reqs.filter((r) => r.met).length;
      lockedSection = `
        <div class="travel-locked-block">
          <div class="travel-locked-header">
            <span class="travel-locked-icon">${pxi('lock', 14)}</span>
            <span class="travel-locked-title">Región bloqueada</span>
            <span class="travel-locked-progress dim">${metCount}/${reqs.length} requisitos</span>
          </div>
          ${customWarning ? `<div class="travel-locked-warning dim">${A.Utils.escapeHtml(customWarning)}</div>` : ''}
          ${reqs.length > 0 ? `
            <ul class="travel-locked-reqs">
              ${reqs.map((r) => `
                <li class="${r.met ? 'is-met' : 'is-pending'}">
                  <span class="req-mark">${pxi(r.met ? 'check' : 'lock', 12)}</span>
                  <span class="req-label">${A.Utils.escapeHtml(r.label)}</span>
                  ${!r.met && r.target > 1 ? `<span class="req-progress dim">(${r.current}/${r.target})</span>` : ''}
                </li>
              `).join('')}
            </ul>
          ` : ''}
        </div>
      `;
    }

    return `
      <button class="${cls}" data-travel="${A.Utils.escapeHtml(n.id)}" ${locked ? 'disabled data-locked="1"' : ''} ${locked ? `title="Región bloqueada — falta ${(travelCheck.requirements || []).filter(r => !r.met).map(r => r.label).join(', ')}"` : ''}>
        <div class="travel-modal-icon">${A.UI ? A.UI.biomeIcon(n, 28) : ''}</div>
        <div class="travel-modal-info">
          <div class="travel-modal-name">${A.Utils.escapeHtml(n.name)}</div>
          <div class="travel-modal-meta">
            <span class="pill ${dangerClass}">${dangerLabel}</span>
            <span class="pill pill-tier">Nivel ${n.tier[0]}${n.tier[1] !== n.tier[0] ? `–${n.tier[1]}` : ''}</span>
            <span class="dim small">${distLabel}</span>
            ${enemiesCount ? `<span class="dim small">· ${enemiesCount} criaturas</span>` : ''}
          </div>
          ${n.description ? `<div class="travel-modal-desc dim">${A.Utils.escapeHtml(n.description)}</div>` : ''}
          ${lockedSection}
        </div>
        <div class="travel-modal-arrow">${locked ? pxi('lock', 14) : '›'}</div>
      </button>
    `;
  }

  // ---------- Combat full log (modal) ----------

  function renderCombatFullLog() {
    const c = A.State.combat;
    if (!c || !c.log) return modalShell('Crónica del combate', '<p class="muted">Sin combate activo.</p>');
    // v1.9.1: misma crónica en prosa que la pantalla de combate, con las tiradas
    const body = A.Views.Combat && A.Views.Combat.chronicleHtml
      ? A.Views.Combat.chronicleHtml(c.log, { rolls: true, combat: c })
      : c.log.map((e) => `<div class="cb-line"><span class="cb-line-body">${A.Utils.escapeHtml(e.text || '')}</span></div>`).join('');
    return modalShell('Crónica del combate', `<div class="combat-fulllog-modal cb-chronicle" data-fulllog>${body}</div>`).replace('class="modal"', 'class="modal modal-fulllog"');
  }

  /** v3.9: qué hace el hechizo, también en plena pelea (descripción y efecto extra) */
  function spellDescLine(s) {
    const esc = A.Utils.escapeHtml;
    const bits = [];
    if (s.description) bits.push(esc(s.description));
    const se = s.statusEffect;
    if (se && se.type) {
      const label = A.Combat && A.Combat.effectLabel ? A.Combat.effectLabel(se.type) : se.type;
      bits.push(`<b>${Math.round((se.chance != null ? se.chance : 1) * 100)}% de ${esc(label)}${se.turns ? ` (${se.turns} turnos)` : ''}</b>`);
    }
    return bits.length ? `<span class="combat-spell-desc">${bits.join(' ')}</span>` : '';
  }

  function renderCombatSpell() {
    const spells = A.Combat.availableSpells();
    const p = A.State.player;
    if (spells.length === 0) {
      return modalShell('Hechizos', `<p class="muted">No conoces hechizos todavía.</p>`);
    }
    const body = `
      <div class="combat-spell-modal">
        <div class="mana-readout">
          <span class="dim">Maná disponible</span>
          <span class="num">${p.mana} / ${p.maxMana}</span>
        </div>
        <div class="combat-spell-list">
          ${spells.map((s) => {
            const cost = A.Passives ? A.Passives.spellCost(p, s) : s.manaCost;
            // v3.3: con espera, y la chance de acertar (los de daño pueden fallar)
            const info = A.Combat.spellInfo ? A.Combat.spellInfo(s.id) : { wait: 0, ready: true, hit: 1, sure: true };
            const can = p.mana >= cost && info.ready;
            const pick = needsAllyPick('spell', s);
            const hitTxt = s.damage ? (info.sure ? 'no falla' : `acierta ${Math.round(info.hit * 100)}%`) : '';
            const waitTxt = !info.ready ? (info.quickUsed ? '<b class="combat-spell-wait">Ya usaste uno rápido en este turno</b> · ' : `<b class="combat-spell-wait">Listo en ${info.wait} ${info.wait === 1 ? 'turno' : 'turnos'}</b> · `) : (s.quick ? '<b class="combat-spell-quick">Rápido: no gasta el turno</b> · ' : '');
            return `
              <button class="combat-spell-row ${can ? '' : 'is-disabled'}" data-cast-spell="${A.Utils.escapeHtml(s.id)}" ${can ? '' : 'disabled'}>
                <span class="combat-spell-icon">${A.ItemSprites && A.ItemSprites.spellIcon ? A.ItemSprites.spellIcon(s, { size: 32 }) : ''}</span>
                <span class="combat-spell-info">
                  <span class="combat-spell-name">${A.Utils.escapeHtml(s.name)}</span>
                  ${spellDescLine(s)}
                  <span class="combat-spell-meta dim">${waitTxt}${s.damage ? `${A.Schools ? A.Schools.diceOf(s, p) : s.damage} daño${s.area ? ' a todos' : ''}${s.stun ? ', sin turno' : ''}` : s.heal ? `${s.heal} cura${s.selfOnly ? ' (a vos)' : ''}` : (s.effect && A.ItemFx ? A.Utils.escapeHtml(A.ItemFx.summary({ effect: s.effect, subtype: 'scroll' })) : schoolMetaTxt(s))}${hitTxt ? ` · ${hitTxt}` : ''} · Maná ${cost}${cost < s.manaCost ? ` <s>${s.manaCost}</s>` : ''}${s.cooldown ? ` · cada ${s.cooldown} turnos` : ''}${pick ? ' · elegís a quién' : ''}</span>
                </span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
    return modalShell('Lanzar hechizo', body);
  }

  /** v3.13: lo que hace en pocas palabras un hechizo de escuela que no es de daño. */
  function schoolMetaTxt(s) {
    if (!s || !s.schoolRank) return '';
    // v3.14: lo que agregan los de daño
    if (s.damage) {
      if (s.lucky) return 'la mitad de las veces, el doble';
      if (s.vsMarked) return 'el doble si tiene tu sello';
      if (s.vsStatus) return 'más daño si ya tiene ese estado';
      if (s.partyBuff || s.partyHeal) return 'y ayuda a tu grupo';
      if (s.sleep) return 'y duerme a los enemigos';
      return '';
    }
    if (s.partyHeal && s.partyBuff) return 'cura y protege a todo tu grupo';
    if (s.partyBuff) return 'a todo tu grupo';
    if (s.partyHeal) return 'cura a todo tu grupo';
    if (s.pact) return 'Frenesí en tu próximo turno (cuesta vida)';
    if (s.sleep) return 'duerme a los enemigos';
    if (s.hex) return 'maldice a tu blanco';
    if (s.echo) return `${s.echo.turns} turnos de eco en tu arma`;
    if (s.buff) return `a vos, ${s.buff.turns} turnos`;
    return '';
  }

  // ---------- v3.13: Combat: las técnicas del guerrero (nacimiento + disciplina) ----------
  function renderCombatTech() {
    const esc = A.Utils.escapeHtml;
    const ic = (n, size) => (A.ItemSprites ? A.ItemSprites.icon(n, { size: size || 32 }) : '');
    const birth = A.Combat.techniqueInfo ? A.Combat.techniqueInfo() : null;
    const disc = A.Combat.disciplineInfo ? A.Combat.disciplineInfo() : [];
    const row = (id, iconName, name, text, can, meta) => `
      <button class="combat-spell-row ${can ? '' : 'is-disabled'}" data-use-tech="${esc(id)}" ${can ? '' : 'disabled'}>
        <span class="combat-spell-icon">${ic(iconName, 32)}</span>
        <span class="combat-spell-info">
          <span class="combat-spell-name">${esc(name)}</span>
          <span class="combat-spell-desc">${esc(text)}</span>
          <span class="combat-spell-meta dim">${meta}</span>
        </span>
      </button>`;
    const body = `
      <div class="combat-spell-modal">
        <p class="combat-item-rule">No gastan maná. Cada una ocupa tu ataque del turno (salvo las que dicen que pegás igual) y después hay que esperar.</p>
        <div class="combat-spell-list">
          ${birth ? row(birth.id, birth.icon, birth.name, birth.text, !birth.used, birth.used ? '<b class="combat-spell-wait">Ya la usaste en esta pelea</b>' : `De nacimiento · una vez por pelea${birth.free ? ' · y pegás igual' : ''}`) : ''}
          ${disc.map((t) => row(t.id, t.icon, t.name, t.text, t.ready, t.ready ? `Nivel ${t.rank} · espera ${t.cd} turnos después de usarla` : `<b class="combat-spell-wait">Lista en ${t.wait} ${t.wait === 1 ? 'turno' : 'turnos'}</b>`)).join('')}
        </div>
      </div>`;
    return modalShell('Técnicas', body);
  }

  // ---------- Combat: elegir item ----------

  function renderCombatItem() {
    const items = A.Combat.availableItems();
    if (items.length === 0) {
      return modalShell('Usar objeto', `<p class="muted">No tenés pociones, comida ni pergaminos a mano.</p>`);
    }
    // v2.4: pergaminos de combate aparte, y cada uno dice lo que hace
    const groups = [
      { title: 'Pociones y comida', list: items.filter((s) => { const d = A.Data.getById('items', s.itemId); return d && d.subtype !== 'scroll'; }) },
      { title: 'Pergaminos', list: items.filter((s) => { const d = A.Data.getById('items', s.itemId); return d && d.subtype === 'scroll'; }) },
    ].filter((g) => g.list.length);
    // v3.3: pociones, comida y hierbas no gastan el turno (hasta 3); los pergaminos, sí
    const left = A.Combat.itemsLeft ? A.Combat.itemsLeft() : 3;
    const free = (d) => (A.Combat.freeItem ? A.Combat.freeItem(d) : false);
    const body = `
      <div class="combat-item-modal">
        <p class="combat-item-rule ${left ? '' : 'is-out'}">${left
          ? `Pociones, comida y hierbas no gastan tu turno: podés usar ${left === 3 ? 'hasta 3' : `${left} más`} en este turno. Los pergaminos sí lo gastan.`
          : 'Ya usaste 3 objetos en este turno: ahora atacá, lanzá un hechizo o huí. Los pergaminos todavía se pueden usar (gastan el turno).'}</p>
        ${groups.map((g) => `
          ${groups.length > 1 ? `<div class="combat-item-group dim">${g.title}</div>` : ''}
          <div class="combat-item-list">
            ${g.list.map((s) => {
              const data = A.Data.getById('items', s.itemId);
              if (!data) return '';
              const what = A.ItemFx ? A.ItemFx.summary(data) : (data.description || '');
              const pick = needsAllyPick('item', data);
              const off = free(data) && !left;
              return `
                <button class="combat-item-row rarity-${A.Utils.escapeHtml(data.rarity || 'common')} ${off ? 'is-disabled' : ''}" data-use-item="${A.Utils.escapeHtml(s.itemId)}" ${off ? 'disabled' : ''}>
                  <span class="combat-item-icon">${A.ItemSprites ? A.ItemSprites.html(data, { size: 32 }) : ''}</span>
                  <span class="combat-item-info">
                    <span class="combat-item-name">${A.Utils.escapeHtml(data.name)} <span class="dim">×${s.qty}</span></span>
                    <span class="combat-item-meta dim">${A.Utils.escapeHtml(what || data.description || '')}${pick ? ' · elegís a quién' : ''}</span>
                  </span>
                </button>
              `;
            }).join('')}
          </div>
        `).join('')}
      </div>
    `;
    return modalShell('Usar objeto', body);
  }

  // ---------- v3.2: a quién va la poción o la curación ----------

  /** A quién se le puede dar (una poción que solo da maná, solo a los que usan magia). */
  function pickTargets(kind, data) {
    if (!data || !A.Combat.allyTargets) return [];
    if (kind === 'spell') return data.heal && !data.selfOnly ? A.Combat.allyTargets() : [];
    if (!(A.ItemFx && A.ItemFx.forOthers && A.ItemFx.forOthers(data))) return [];
    // v3.3: la hierba de la vida es para otro (un compañero o una mascota caídos)
    if (A.ItemFx.isRevive && A.ItemFx.isRevive(data)) return A.Combat.allyTargets().filter((t) => !t.self);
    const ef = data.effect || {};
    const manaOnly = (ef.type === 'mana' || ef.manaRestore) && ef.type !== 'restore' && !ef.heal && !data.healAmount && ef.type !== 'heal';
    return A.Combat.allyTargets().filter((t) => !manaOnly || (t.kind === 'hero' && t.ref.hasMagic));
  }
  /** ¿Hay que elegir a quién? (pociones y Curación, si tenés mascota o compañeros) */
  function needsAllyPick(kind, data) {
    if (kind === 'item' && A.ItemFx && A.ItemFx.isRevive && A.ItemFx.isRevive(data)) return pickTargets(kind, data).length > 0;
    return pickTargets(kind, data).length > 1;
  }

  function renderCombatTarget(kind, id) {
    const esc = A.Utils.escapeHtml;
    const data = kind === 'spell' ? A.Data.getById('spells', id) : A.Data.getById('items', id);
    if (!data) return modalShell('¿A quién?', '<p class="muted">Algo salió mal.</p>');
    const bad = (A.ItemFx && A.ItemFx.BAD) || [];
    // v3.3: a los caídos solo los levanta la hierba de la vida (y la hierba solo sirve para ellos)
    const revive = kind === 'item' && A.ItemFx && A.ItemFx.isRevive && A.ItemFx.isRevive(data);
    const rows = pickTargets(kind, data).map((t) => {
      const isPet = t.kind === 'pet';
      const cur = Math.max(0, (isPet ? t.ref.health : t.ref.hp) || 0);
      const max = (isPet ? t.ref.maxHealth : t.ref.maxHp) || 1;
      const down = cur <= 0;
      const pct = Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
      const sts = [...new Set((t.ref.effects || []).filter((e) => bad.includes(e.type)).map((e) => e.type))];
      const stTxt = sts.map((x) => (A.Combat.effectLabel ? A.Combat.effectLabel(x) : x)).join(', ');
      const who = t.self ? 'Vos' : t.name;
      const sub = isPet ? (t.ownerName ? `Mascota de ${t.ownerName}` : 'Tu mascota') : (t.self ? t.ref.name : 'Compañero');
      const mana = !isPet && t.ref.hasMagic && kind === 'item' ? ` · maná ${t.ref.mana || 0}/${t.ref.maxMana || 0}` : '';
      const off = revive ? !down : down;
      const why = revive && !down ? 'Está en pie' : !revive && down ? 'Caído: hace falta una hierba de la vida' : '';
      return `
        <button class="cb-pick-row ${down ? 'is-down' : ''} ${pct <= 35 && !down ? 'is-low' : ''} ${off ? 'is-off' : ''}" data-ally-target="${esc(t.on)}" ${off ? 'disabled' : ''} ${why ? `title="${esc(why)}"` : ''}>
          <span class="cb-pick-who"><b>${esc(who)}</b><small class="dim">${esc(sub)}${esc(mana)}</small></span>
          <span class="cb-pick-hp">
            <span class="cb-pick-bar"><i style="width:${pct}%"></i></span>
            <span class="cb-pick-num">${down ? (isPet ? 'Inconsciente' : 'Caído') : `${cur}/${max}`}</span>
          </span>
          ${why ? `<span class="cb-pick-st">${esc(why)}</span>` : sts.length ? `<span class="cb-pick-st">${esc(stTxt)}</span>` : ''}
        </button>`;
    }).join('');
    const hint = revive
      ? `Tocá a quién levantás: se pone de pie con el ${Math.round(((data.effect && data.effect.pct) || 0.25) * 100)}% de su vida y vuelve a pelear.`
      : 'Tocá a quién se la das. A los caídos solo los levanta una hierba de la vida.';
    const body = `
      <div class="cb-pick">
        <p class="cb-pick-hint dim">${hint}</p>
        <div class="cb-pick-list">${rows}</div>
        <button class="btn btn-ghost btn-sm cb-pick-back" data-pick-back>Volver</button>
      </div>`;
    return modalShell(`${data.name}: ¿a quién?`, body);
  }

  function rarityLabel(r) {
    return ({ common: 'Común', uncommon: 'Poco común', rare: 'Raro', epic: 'Épico', legendary: 'Legendario' })[r] || r;
  }

  // ---------- Shell helpers ----------

  function modalShell(title, bodyHtml) {
    return `
      <div class="modal" role="dialog" aria-modal="true">
        <header class="modal-header">
          <h2 class="modal-title">${A.Utils.escapeHtml(title)}</h2>
          <button class="modal-close" data-modal-close aria-label="Cerrar">×</button>
        </header>
        <div class="modal-body">${bodyHtml}</div>
      </div>
    `;
  }

  /** Botones de los habitantes (comprar, vender, aprender, descansar, forjar). */
  function bindLegacyNpc(overlay) {
      // Cambiar de tab
      overlay.querySelectorAll('[data-npc-tab]').forEach((b) => {
        b.addEventListener('click', () => {
          A.State.openModal('npc', { npcId: b.dataset.npcId, tab: b.dataset.npcTab });
        });
      });
      // Comprar
      overlay.querySelectorAll('[data-shop-buy]').forEach((b) => {
        if (b.disabled) return;
        b.addEventListener('click', () => {
          const r = A.NPC.buy(b.dataset.npcId, b.dataset.shopBuy);
          if (r.ok) {
            // Re-render mismo modal/tab
            A.State.openModal('npc', { npcId: b.dataset.npcId, tab: 'shop' });
          } else {
            console.warn('[Buy]', r.error);
          }
        });
      });
      // Vender
      overlay.querySelectorAll('[data-shop-sell]').forEach((b) => {
        b.addEventListener('click', () => {
          const qty = parseInt(b.dataset.sellQty, 10) || 1;
          const r = A.NPC.sell(b.dataset.shopSell, qty);
          if (r.ok) {
            const npcId = overlay.querySelector('[data-npc-tab]')?.dataset.npcId;
            if (npcId) A.State.openModal('npc', { npcId, tab: 'shop' });
          }
        });
      });
      // Aprender hechizo
      overlay.querySelectorAll('[data-learn-spell]').forEach((b) => {
        if (b.disabled) return;
        b.addEventListener('click', () => {
          const r = A.NPC.learnSpell(b.dataset.npcId, b.dataset.learnSpell);
          if (r.ok) {
            A.State.openModal('npc', { npcId: b.dataset.npcId, tab: 'learn' });
          }
        });
      });
      // Descansar
      overlay.querySelectorAll('[data-rest-action]').forEach((b) => {
        if (b.disabled) return;
        b.addEventListener('click', () => {
          const action = b.dataset.restAction;
          const npcId = b.dataset.npcId;
          if (action === 'sleep') {
            const r = A.NPC.restAt(npcId);
            if (r.ok) A.State.closeModal();
          } else if (action === 'eat') {
            const cost = parseInt(b.dataset.cost, 10) || 5;
            if (!A.Currency.canPay(cost)) return;
            A.Currency.pay(cost);
            A.State.modifyFood(5);
            A.State.addChronicle({ type: 'rest', text: `Comiste en la posada. +5 comida.` });
            A.State.openModal('npc', { npcId, tab: 'rest' });
          }
        });
      });
      // Compat con [data-rest="1"] (legacy)
      overlay.querySelectorAll('[data-rest]').forEach((b) => {
        if (b.disabled || b.dataset.restAction) return;
        b.addEventListener('click', () => {
          const r = A.NPC.restAt(b.dataset.npcId);
          if (r.ok) A.State.closeModal();
        });
      });
      // Crafting
      overlay.querySelectorAll('[data-craft]').forEach((b) => {
        if (b.disabled) return;
        b.addEventListener('click', () => {
          const r = A.Crafting.craft(b.dataset.craft);
          if (r.ok) {
            const npcId = overlay.querySelector('[data-npc-tab]')?.dataset.npcId;
            if (npcId) A.State.openModal('npc', { npcId, tab: 'craft' });
          }
        });
      });
  }

  function bindOverlayEvents(overlay, id, payload) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && !(A.ModalViews && A.ModalViews[id] && A.ModalViews[id].blocking)) A.State.closeModal();
    });
    // Bindear TODOS los data-modal-close (X arriba + cualquier botón "Cerrar" en el body)
    overlay.querySelectorAll('[data-modal-close]').forEach((btn) => {
      btn.addEventListener('click', () => A.State.closeModal());
    });
    // v2.0: las pantallas registradas manejan sus propios botones
    if (A.ModalViews && A.ModalViews[id] && A.ModalViews[id].bind) {
      A.ModalViews[id].bind(overlay, payload, { bindLegacy: () => bindLegacyNpc(overlay) });
      return;
    }

    if (id === 'item-detail') {
      overlay.querySelectorAll('[data-detail-action]').forEach((b) => {
        b.addEventListener('click', () => onItemAction(b.dataset.detailAction, payload.itemId));
      });
      // v3.2: dar a un compañero (cuántos y a quién)
      const nEl = overlay.querySelector('[data-give-n]');
      const have = () => { const s = (A.State.player.inventory || []).find((x) => x.itemId === payload.itemId); return s ? s.qty : 0; };
      overlay.querySelectorAll('[data-give-step]').forEach((b) => {
        b.addEventListener('click', () => {
          if (!nEl) return;
          const n = Math.max(1, Math.min(have(), (Number(nEl.textContent) || 1) + Number(b.dataset.giveStep)));
          nEl.textContent = String(n);
        });
      });
      overlay.querySelectorAll('[data-give-to]').forEach((b) => {
        b.addEventListener('click', () => {
          if (b.disabled || !A.Party || !A.Party.give) return;
          const n = nEl ? Number(nEl.textContent) || 1 : 1;
          const r = A.Party.give(b.dataset.giveTo, payload.itemId, n);
          if (r && r.ok) A.State.closeModal();
          else if (r && r.why && A.Views.Party) A.Views.Party.toast(r.why, 'bad');
        });
      });
    }
    if (id === 'equipped-bag') {
      overlay.querySelectorAll('[data-bag-remove]').forEach((b) => {
        if (b.disabled) return;
        b.addEventListener('click', () => {
          // Crear el item-proxy de la bolsa actual y agregarlo al inventario, equipar bag_basic
          const p = A.State.player;
          const currentBagId = p.bagId;
          const proxy = A.Data.items.find((it) => it.subtype === 'bag' && it.equipsBag === currentBagId);
          if (!proxy) {
            A.State.closeModal();
            return;
          }
          // Equipar bag_basic primero
          p.bagId = 'bag_basic';
          // Agregar el proxy al inventario
          const ok = A.State.addItem(proxy.id, 1);
          if (!ok) {
            // Revertir
            p.bagId = currentBagId;
            return;
          }
          A.State.addChronicle({
            type: 'item',
            text: `Quitaste tu mochila. Volviste a la básica.`,
          });
          A.Bus.emit('bag:equipped', { bagId: 'bag_basic' });
          A.State.persist();
          A.State.closeModal();
        });
      });
    }
    if (id === 'menu') {
      overlay.querySelectorAll('[data-menu-action]').forEach((b) => {
        b.addEventListener('click', () => onMenuAction(b.dataset.menuAction));
      });
    }
    if (id === 'confirm') {
      overlay.querySelectorAll('[data-confirm-action]').forEach((b) => {
        b.addEventListener('click', () => {
          if (b.dataset.confirmAction === 'ok') {
            const cb = confirmCallback;
            confirmCallback = null;
            A.State.closeModal();
            if (cb) cb();
          } else {
            confirmCallback = null;
            A.State.closeModal();
          }
        });
      });
    }

    if (id === 'npc') bindLegacyNpc(overlay);

    if (id === 'creature') {
      overlay.querySelectorAll('[data-creature-action]').forEach((b) => {
        b.addEventListener('click', () => {
          const action = b.dataset.creatureAction;
          // v1.9.2: la ficha es solo informativa (no se elige contra quién pelear)
          if (action === 'tame') A.State.openModal('tame', { enemyId: b.dataset.enemyId });
        });
      });
    }

    if (id === 'travel') {
      overlay.querySelectorAll('[data-travel]').forEach((b) => {
        if (b.disabled) return;
        b.addEventListener('click', () => {
          const result = A.Travel.start(b.dataset.travel);
          if (result && result.ok) A.State.closeModal();
        });
      });
      // Click en nodos del mapa (solo neighbors clickables)
      overlay.querySelectorAll('[data-clickable="1"][data-map-region]').forEach((g) => {
        g.style.cursor = 'pointer';
        g.addEventListener('click', () => {
          const result = A.Travel.start(g.dataset.mapRegion);
          if (result && result.ok) A.State.closeModal();
        });
      });
    }

    // v3.1: de la ficha de una criatura, volver al bestiario
    if (id === 'creature') {
      const back = overlay.querySelector('[data-back-bestiary]');
      if (back) back.addEventListener('click', () => A.State.openModal('journal', { tab: 'bestiary' }));
    }

    if (id === 'all-creatures') {
      overlay.querySelectorAll('[data-creature]').forEach((b) => {
        b.addEventListener('click', () => {
          A.State.openModal('creature', { enemyId: b.dataset.creature });
        });
      });
    }

    if (id === 'tame') {
      overlay.querySelectorAll('[data-tame-action]').forEach((b) => {
        b.addEventListener('click', () => {
          const action = b.dataset.tameAction;
          if (action === 'cancel') { A.State.closeModal(); return; }
          if (action === 'attempt') {
            const enemyId = b.dataset.enemyId;
            const fromTravel = b.dataset.fromTravel === '1';
            const result = A.Tame.attempt(enemyId);
            // Si vino desde un encuentro de viaje, marcamos el evento como resuelto
            if (fromTravel && A.State.traveling) {
              const t = A.State.traveling;
              const last = t.events[t.events.length - 1];
              if (last && last.kind === 'creature') {
                last.resolved = true;
                if (result.success) {
                  last.text = `Domaste a ${last.enemyName} en el camino.`;
                } else if (result.reason === 'missing-item') {
                  last.text = `No tenías el item necesario para domar a ${last.enemyName}. Lo evitaste.`;
                } else {
                  last.text = `${last.enemyName} no se dejó acercar. Tuviste que evitarlo.`;
                }
                A.State.persist();
              }
            }
            A.State.closeModal();
            // Si el viaje seguía activo, avanzar un paso
            if (fromTravel && A.State.traveling) A.Travel.step();
          }
        });
      });
    }

    if (id === 'combat-spell') {
      overlay.querySelectorAll('[data-cast-spell]').forEach((b) => {
        if (b.disabled) return;
        b.addEventListener('click', () => {
          // v3.2: Curación: primero a quién
          if (needsAllyPick('spell', A.Data.getById('spells', b.dataset.castSpell))) { A.State.openModal('combat-spell', { pick: b.dataset.castSpell }); return; }
          A.State.closeModal();
          A.Combat.playerSpell(b.dataset.castSpell);
        });
      });
    }

    if (id === 'combat-tech') { // v3.13
      overlay.querySelectorAll('[data-use-tech]').forEach((b) => {
        if (b.disabled) return;
        b.addEventListener('click', () => {
          A.State.closeModal();
          A.Combat.playerTechnique(b.dataset.useTech);
        });
      });
    }

    if (id === 'combat-item') {
      overlay.querySelectorAll('[data-use-item]').forEach((b) => {
        b.addEventListener('click', () => {
          // v3.2: pociones: primero a quién (vos, tu mascota o un compañero)
          if (needsAllyPick('item', A.Data.getById('items', b.dataset.useItem))) { A.State.openModal('combat-item', { pick: b.dataset.useItem }); return; }
          A.State.closeModal();
          A.Combat.playerUseItem(b.dataset.useItem);
        });
      });
    }

    if ((id === 'combat-item' || id === 'combat-spell') && payload.pick) {
      overlay.querySelectorAll('[data-ally-target]').forEach((b) => {
        b.addEventListener('click', () => {
          const on = b.dataset.allyTarget;
          A.State.closeModal();
          if (id === 'combat-spell') A.Combat.playerSpell(payload.pick, on);
          else A.Combat.playerUseItem(payload.pick, on);
        });
      });
      const back = overlay.querySelector('[data-pick-back]');
      if (back) back.addEventListener('click', () => A.State.openModal(id));
    }
  }

  function onItemAction(action, itemId) {
    if (action === 'equip') {
      const okEq = A.Inventory.equip(itemId);
      // v3.3: si no se pudo (un mago con un arma que no es mágica), se dice por qué
      const why = !okEq && A.Inventory.lastError ? A.Inventory.lastError() : '';
      if (why && A.Views.Party && A.Views.Party.toast) A.Views.Party.toast(why, 'bad', 'lock');
      A.State.closeModal();
    } else if (action === 'unequip') {
      // v2.1.1: quitarse el arma o la armadura (vuelve a la mochila)
      const kind = A.Inventory.classifyItem(itemId);
      const ok = A.Inventory.unequip(kind === 'weapon' || kind === 'accessory' ? kind : 'armor');
      if (ok) {
        const d = A.Inventory.resolveData(itemId);
        A.State.addChronicle({ type: 'item', text: `Te sacaste ${d ? d.name.toLowerCase() : 'el equipo'} y lo guardaste en la mochila.` });
      }
      A.State.closeModal();
    } else if (action === 'learn') {
      // v3.3: aprender el hechizo del pergamino
      A.Inventory.learn(itemId);
      A.State.closeModal();
      if (A.Views && A.Views.Shell && A.Views.Shell.rerender) A.Views.Shell.rerender();
    } else if (action === 'use') {
      A.Inventory.use(itemId);
      A.State.closeModal();
    } else if (action === 'drop') {
      A.Inventory.drop(itemId);
      A.State.closeModal();
    }
  }

  function onMenuAction(action) {
    if (action === 'rules') {
      A.State.openModal('rules');
      return;
    }
    if (action === 'party') { A.State.openModal('party', {}); return; }
    // v3.1: voz del narrador
    if (action === 'voice' && A.Voice) { A.Voice.toggle(); A.State.openModal('menu'); return; }
    if (action === 'voice-speed' && A.Voice) {
      A.Voice.setRate(A.Voice.rate() > 1.1 ? 1 : 1.25);
      A.Voice.say(A.Voice.rate() > 1.1 ? 'Así leo más rápido.' : 'Así leo a velocidad normal.', { now: true });
      A.State.openModal('menu');
      return;
    }
    if (action === 'logout') {
      A.State.closeModal();
      if (A.State.player && !A.State.combat) A.State.persist();
      if (A.Accounts) A.Accounts.logout();
      return;
    }
    if (action === 'export-save') {
      const data = JSON.stringify({
        player: A.State.player, world: A.State.world,
        ui: A.State.ui, chronicles: A.State.chronicles,
      }, null, 2);
      downloadJson('aventurs-partida.json', data);
    } else if (action === 'export-content') {
      const data = JSON.stringify(A.Data.getOverrides(), null, 2);
      downloadJson('aventurs-contenido.json', data);
    } else if (action === 'import') {
      uploadJson();
    } else if (action === 'reset') {
      // Cerramos este modal antes de abrir el de confirm para no hacer overlay-on-overlay
      A.State.closeModal();
      Modals.confirm({
        title: 'Borrar todo',
        body: (!A.Accounts || A.Accounts.canEdit()) ? '¿Seguro? Se elimina tu partida y los cambios del editor. No hay vuelta atrás.' : '¿Seguro? Se elimina tu personaje de esta cuenta. No hay vuelta atrás.',
        danger: true,
        onConfirm: () => {
          try {
            if (A.Party && A.Party.role) A.Party.leave();
            localStorage.removeItem(A.State.storageKey ? A.State.storageKey() : 'aventurs:save');
            // v3.0: los cambios del editor son del dueño
            if (!A.Accounts || A.Accounts.canEdit()) localStorage.removeItem('aventurs:content');
          } catch (e) {}
          location.reload();
        },
      });
    }
  }

  function downloadJson(filename, content) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function uploadJson() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          // Heurística: si parece un save (tiene player/world) lo cargamos como save.
          // Si parece overrides (tiene regions/items/etc. en su raíz), lo guardamos como overrides.
          if (parsed.player || parsed.world) {
            const save = {
              player: parsed.player || null,
              world: parsed.world || null,
              ui: parsed.ui || { activeTab: 'world', openModal: null, modalPayload: null },
              chronicles: parsed.chronicles || [],
            };
            localStorage.setItem(A.State.storageKey ? A.State.storageKey() : 'aventurs:save', JSON.stringify(save));
            location.reload();
          } else if (!A.Accounts || A.Accounts.canEdit()) {
            A.Data.saveOverrides(parsed);
            location.reload();
          } else {
            alert('Ese archivo es contenido del editor: solo lo puede cargar el dueño del juego.');
          }
        } catch (err) {
          alert('Archivo inválido.');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  // ---------- API pública ----------

  function roleLabel(role) {
    return {
      merchant: 'Mercader', shopkeeper: 'Comerciante', vendor: 'Vendedor',
      blacksmith: 'Herrero', innkeeper: 'Posadero', tavernkeeper: 'Tabernero',
      healer: 'Curandero', priest: 'Sacerdote', sage: 'Sabio',
      wizard: 'Mago', mage: 'Mago', quest: 'Encargo',
      guard: 'Guardia',
    }[role] || role;
  }

  function kindLabel(k) {
    return {
      weapon: 'Arma', armor: 'Armadura', accessory: 'Accesorio', consumable: 'Consumible',
      scroll: 'Pergamino', bag: 'Mochila', material: 'Material', misc: 'Objeto', coin: 'Moneda',
      tame: 'Para domar', key: 'Llave',
    }[k] || 'Objeto';
  }

  function rarityLabel(r) {
    return {
      common: 'Común', uncommon: 'Poco común', rare: 'Raro',
      epic: 'Épico', legendary: 'Legendario',
    }[r] || r;
  }

  const Modals = {
    render,
    confirm({ title, body, onConfirm, danger }) {
      confirmCallback = onConfirm;
      A.State.openModal('confirm', { title, body, danger });
    },
  };

  A.Views = A.Views || {};
  A.Views.Modals = Modals;
})(window.Aventurs);
