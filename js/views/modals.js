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
    switch (id) {
      case 'npc': html = renderNpc(payload); break;
      case 'item-detail': html = renderItemDetail(payload); break;
      case 'rules': html = renderRules(); break;
      case 'menu': html = renderMenu(); break;
      case 'confirm': html = renderConfirm(payload); break;
      case 'creature': html = renderCreature(payload); break;
      case 'all-creatures': html = renderAllCreatures(payload); break;
      case 'tame': html = renderTame(payload); break;
      case 'magic': html = renderMagic(); break;
      case 'chronicles-full': html = renderChroniclesFull(); break;
      case 'equipped-bag': html = renderEquippedBag(payload); break;
      case 'combat-spell': html = renderCombatSpell(); break;
      case 'combat-item': html = renderCombatItem(); break;
      default: html = `<div class="modal"><div class="modal-body">Modal "${id}" desconocido.</div></div>`;
    }

    overlay.innerHTML = html;
    host.appendChild(overlay);

    bindOverlayEvents(overlay, id, payload);
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
          <div class="npc-modal-avatar">${npc.icon || '🧑'}</div>
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
    // Arma: mostrar daño en pill
    if (A.Data.getById('weapons', itemId)) {
      return `<span class="item-stat-pill item-stat-pill-dmg" title="Daño">⚔️ ${A.Utils.escapeHtml(data.damage || '?')}</span>`;
    }
    // Armadura: mostrar defensa
    if (A.Data.getById('armors', itemId)) {
      return `<span class="item-stat-pill item-stat-pill-def" title="Defensa">🛡️ ${data.defense || 0}</span>`;
    }
    // Bolsa: slots
    if (data.subtype === 'bag') {
      const bagId = data.equipsBag;
      const bagData = A.Data.getById('bags', bagId);
      if (bagData) return `<span class="item-stat-pill item-stat-pill-bag" title="Slots">🎒 ${bagData.slots}</span>`;
    }
    // Pergamino: hechizo
    if (data.subtype === 'scroll_spell') {
      return `<span class="item-stat-pill item-stat-pill-spell" title="Enseña">📖</span>`;
    }
    // Comida/poción con efecto
    if (data.effect) {
      return `<span class="item-stat-pill" title="Efecto">${A.Utils.escapeHtml(data.effect)}</span>`;
    }
    return '';
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
      if (p.equipment.weapon === s.itemId || p.equipment.armor === s.itemId) return false;
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
                  <div class="shop-row-icon">${it.data.icon || '📦'}</div>
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
                    <div class="shop-row-icon">${d.icon || '📦'}</div>
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
              const dmgStr = s.damage ? `${s.damage} daño` : s.heal ? `${s.heal} cura` : '';
              return `
                <div class="learn-row ${known ? 'is-known' : ''}">
                  <div class="learn-icon">${s.icon || '✨'}</div>
                  <div class="learn-info">
                    <div class="learn-name">${A.Utils.escapeHtml(s.name)}</div>
                    <div class="learn-meta dim">${dmgStr}${dmgStr ? ' · ' : ''}Maná ${s.manaCost} · T${s.tier}</div>
                    <div class="learn-desc dim">${A.Utils.escapeHtml(s.description || '')}</div>
                  </div>
                  <div class="learn-price num">${price}c</div>
                  ${known
                    ? `<span class="pill">aprendido</span>`
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
          <div class="rest-service-icon">🛏️</div>
          <div class="rest-service-info">
            <div class="rest-service-name">Pasar la noche</div>
            <div class="rest-service-desc dim">Recupera salud y maná al máximo.</div>
          </div>
          <div class="rest-service-price num">${A.Currency.formatPrice(cost)}</div>
          <button class="btn-mini" data-rest-action="sleep" data-npc-id="${A.Utils.escapeHtml(npc.id)}" ${canPay && needsRest ? '' : 'disabled'}>${needsRest ? 'Dormir' : 'Sano'}</button>
        </div>
        <div class="rest-service-row ${(canEat && needsFood) ? '' : 'is-disabled'}">
          <div class="rest-service-icon">🍖</div>
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
    const recipes = A.Crafting.recipesForWorkshop('forge');
    return renderCraftList(recipes, 'forge');
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
            const resultIcon = result ? (result.icon || '📦') : '📦';
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
                    return `<span class="ingredient ${ok ? 'is-ok' : 'is-missing'}">${d ? d.icon : '·'} ${A.Utils.escapeHtml(d ? d.name : ing.itemId)} <span class="num">${have}/${ing.qty}</span></span>`;
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

  function renderItemDetail({ itemId }) {
    const data = A.Inventory.resolveData(itemId);
    if (!data) return modalShell('Item', `<p class="muted">No encontrado.</p>`);

    const kind = A.Inventory.classifyItem(itemId);
    const slot = A.State.player.inventory.find((s) => s.itemId === itemId);
    const qty = slot ? slot.qty : 0;

    let stats = '';
    if (kind === 'weapon') {
      stats = `
        <div class="detail-stat"><span class="dim">Daño</span><span class="num">${data.damage}</span></div>
        <div class="detail-stat"><span class="dim">Tier</span><span class="num">${data.tier}</span></div>
        <div class="detail-stat"><span class="dim">Rareza</span><span>${rarityLabel(data.rarity)}</span></div>
        ${data.magic ? `<div class="detail-stat"><span class="dim">Mágica</span><span>Sí</span></div>` : ''}
      `;
    } else if (kind === 'armor') {
      stats = `
        <div class="detail-stat"><span class="dim">Defensa</span><span class="num">+${data.defense}</span></div>
        <div class="detail-stat"><span class="dim">Tier</span><span class="num">${data.tier}</span></div>
        <div class="detail-stat"><span class="dim">Rareza</span><span>${rarityLabel(data.rarity)}</span></div>
      `;
    } else if (kind === 'consumable' && data.effect) {
      const ef = data.effect;
      const lbl = ef.type === 'heal' ? `Cura ${ef.amount}` :
                  ef.type === 'mana' ? `Restaura maná ${ef.amount}` :
                  ef.type === 'food' ? `Cura ${ef.amount}` :
                  ef.type === 'cure' ? `Cura estado: ${ef.status}` :
                  ef.type === 'buff' ? `Aumenta ${ef.stat} +${ef.amount}` :
                  ef.type;
      stats = `<div class="detail-stat"><span class="dim">Efecto</span><span>${A.Utils.escapeHtml(lbl)}</span></div>`;
    }

    const actions = [];
    if (kind === 'weapon' || kind === 'armor') {
      actions.push(`<button class="btn-primary" data-detail-action="equip">Equipar</button>`);
    }
    if (kind === 'consumable') {
      actions.push(`<button class="btn-primary" data-detail-action="use">Usar</button>`);
    }
    if (kind === 'scroll') {
      const isSpellScroll = data.subtype === 'scroll_spell';
      actions.push(`<button class="btn-primary" data-detail-action="use">${isSpellScroll ? 'Aprender hechizo' : 'Usar'}</button>`);
    }
    if (kind === 'bag') {
      actions.push(`<button class="btn-primary" data-detail-action="use">Equipar mochila</button>`);
    }
    actions.push(`<button class="btn-danger" data-detail-action="drop">Tirar</button>`);

    const body = `
      <div class="item-modal">
        <div class="item-modal-header">
          <div class="item-modal-icon">${data.icon || '📦'}</div>
          <div>
            <div class="item-modal-name">${A.Utils.escapeHtml(data.name)}</div>
            <div class="item-modal-meta dim">${kindLabel(kind)}${qty > 1 ? ` · ×${qty}` : ''}</div>
          </div>
        </div>
        <p class="item-modal-desc">${A.Utils.escapeHtml(data.description || '')}</p>
        <div class="detail-stats">
          ${stats}
        </div>
        <div class="item-modal-actions">
          ${actions.join('')}
        </div>
      </div>
    `;
    return modalShell(data.name, body);
  }

  // ---------- Rules ----------

  function renderRules() {
    const body = `
      <div class="rules-modal">
        <h3>Cómo se juega</h3>
        <p>Aventurs es un RPG narrativo single-player. Eliges una raza, viajas entre regiones, peleas con criaturas, recoges botín y vuelves al pueblo a vender, comprar, descansar y aprender.</p>

        <h3>Combate (Fase 2)</h3>
        <p>El combate es por turnos según velocidad. Los ataques se resuelven con dados estilo D&D: tirada de impacto contra dificultad, y daño con dado del arma + bonificadores.</p>

        <h3>Stats</h3>
        <p>Cada raza tiene stats base distintos. <strong>Salud</strong> y <strong>maná</strong> determinan tu margen. <strong>Daño</strong>, <strong>armadura</strong>, <strong>esquiva</strong>, <strong>velocidad</strong> y <strong>precisión</strong> deciden los combates.</p>

        <h3>Razas</h3>
        <p>Hay 9 razas en tres tipos: <em>guerreros</em> (más HP y armadura), <em>magos</em> (más maná) e <em>híbridos</em> (medios en todo).</p>

        <h3>Magia</h3>
        <p>Los hechizos se aprenden con NPCs sabios y se lanzan en combate. Cada uno cuesta maná, que se recupera descansando o con pociones.</p>

        <h3>Items y crafting</h3>
        <p>Las armas, armaduras y pociones se compran en pueblo o se crean con materiales recogidos en combate. Cada herrero o alquimista tiene sus recetas.</p>
      </div>
    `;
    return modalShell('Reglas', body);
  }

  // ---------- Menu ----------

  function renderMenu() {
    const body = `
      <div class="menu-modal">
        <button class="menu-action" data-menu-action="export-save">Exportar partida</button>
        <button class="menu-action" data-menu-action="export-content">Exportar contenido del editor</button>
        <button class="menu-action" data-menu-action="import">Importar (JSON)</button>
        <button class="menu-action danger" data-menu-action="reset">Borrar todo</button>
        <p class="muted small">Borrar todo elimina tu partida y los cambios del editor. No se puede deshacer.</p>
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

  function renderCreature({ enemyId }) {
    const e = A.Data.getById('enemies', enemyId);
    if (!e) return modalShell('Criatura', `<p class="muted">No encontrada.</p>`);
    const families = (e.family || []).map(escapeChip).join(' ');
    const tags = (e.tags || []).map(escapeChip).join(' ');
    const canTame = !!e.tameable;
    const havePet = !!A.State.player.pet;
    const body = `
      <div class="creature-modal">
        <div class="creature-modal-header">
          <div class="creature-modal-icon">${e.icon || '👹'}</div>
          <div>
            <div class="creature-modal-name">${A.Utils.escapeHtml(e.name)}</div>
            <div class="creature-modal-meta dim">
              <span class="pill pill-tier">Tier ${e.tier}</span>
              <span class="pill">${categoryLabel(e.category)}</span>
              ${canTame ? `<span class="pill pill-tameable">Domable</span>` : ''}
            </div>
          </div>
        </div>
        <div class="creature-stats">
          <div class="stat-row"><span class="dim">Salud</span><span class="num">${e.health}</span></div>
          <div class="stat-row"><span class="dim">Daño</span><span class="num">${e.damage}</span></div>
          <div class="stat-row"><span class="dim">Armadura</span><span class="num">${e.armor}</span></div>
          <div class="stat-row"><span class="dim">Velocidad</span><span class="num">${e.speed}</span></div>
        </div>
        ${families ? `<div class="creature-chips">${families}</div>` : ''}
        ${tags ? `<div class="creature-chips">${tags}</div>` : ''}
        <div class="creature-actions">
          <button class="btn-primary" data-creature-action="fight" data-enemy-id="${A.Utils.escapeHtml(e.id)}">Pelear</button>
          ${canTame && !havePet ? `
            <button class="btn-secondary" data-creature-action="tame" data-enemy-id="${A.Utils.escapeHtml(e.id)}">
              Intentar domar
            </button>
          ` : ''}
          ${canTame && havePet ? `
            <span class="muted small">Ya tienes una mascota. Liberá a ${A.Utils.escapeHtml(A.State.player.pet.name)} antes de domar otra.</span>
          ` : ''}
        </div>
      </div>
    `;
    return modalShell(e.name, body);
  }

  function escapeChip(s) {
    return `<span class="creature-chip-mini">${A.Utils.escapeHtml(s)}</span>`;
  }

  function categoryLabel(c) {
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
          ${enemies.map((e) => `
            <button class="creature-list-row" data-creature="${A.Utils.escapeHtml(e.id)}">
              <span class="creature-list-icon">${e.icon || '👹'}</span>
              <span class="creature-list-info">
                <span class="creature-list-name">${A.Utils.escapeHtml(e.name)}</span>
                <span class="creature-list-meta dim">
                  Tier ${e.tier} · ${categoryLabel(e.category)}${e.tameable ? ' · domable' : ''}
                </span>
              </span>
              <span class="creature-list-arrow dim">›</span>
            </button>
          `).join('')}
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
    const canDo = haveQty > 0;
    const chancePct = Math.round(A.Tame.chanceFor(e) * 100);

    const body = `
      <div class="tame-modal">
        <div class="tame-icon">${e.icon || '🐾'}</div>
        <p class="tame-text">
          ${canDo
            ? `Te acercas a ${A.Utils.escapeHtml(e.name)} con ${A.Utils.escapeHtml(item ? item.name : itemId)} en la mano.`
            : `Para domar a ${A.Utils.escapeHtml(e.name)} necesitás ${A.Utils.escapeHtml(item ? item.name : itemId)}, y no llevás nada.`}
        </p>
        <div class="tame-info">
          <div class="tame-info-row">
            <span class="dim">Necesitas:</span>
            <span>${item ? item.icon : '📦'} ${A.Utils.escapeHtml(item ? item.name : itemId)} ${haveQty > 0 ? `<span class="num dim">(tenés ${haveQty})</span>` : '<span class="num danger">(no tenés)</span>'}</span>
          </div>
          <div class="tame-info-row">
            <span class="dim">Probabilidad:</span>
            <span class="num">${chancePct}%</span>
          </div>
          <div class="muted small">El item se consume al intentar, hayas tenido suerte o no.</div>
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
          <div class="item-modal-icon">${bag.icon || '🎒'}</div>
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
          <button class="btn" data-modal-close="1">Cerrar</button>
        </div>
      </div>
    `;
    return modalShell(bag.name, body);
  }

  // ---------- Chronicles full (modal con historial completo) ----------

  function renderChroniclesFull() {
    const all = A.State.chronicles || [];
    const ICONS = {
      combat: '⚔️', loot: '💰', heal: '💚', shop: '🏪',
      travel: '🗺️', craft: '⚒️', spell: '📖', rest: '🌙',
      item: '🎒', note: '📝', system: '✨', region: '📍',
    };
    const body = `
      <div class="chronicles-full-modal">
        <p class="muted">Tu historia hasta ahora. ${all.length} ${all.length === 1 ? 'entrada' : 'entradas'}.</p>
        <div class="chronicles-full-list">
          ${all.length === 0 ? `
            <div class="empty-card">
              <div class="empty-icon">📜</div>
              <div class="empty-title">Sin historia aún</div>
              <div class="empty-text muted">Tus aventuras se irán registrando acá.</div>
            </div>
          ` : all.map((e) => `
            <div class="chronicle-full-row">
              <span class="chronicle-full-icon">${ICONS[e.type] || '·'}</span>
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

  // ---------- Magic ----------

  function renderMagic() {
    return modalShell('Grimorio', A.Views.Magic.renderHtml());
  }

  // ---------- Combat: elegir hechizo ----------

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
            const can = p.mana >= s.manaCost;
            return `
              <button class="combat-spell-row ${can ? '' : 'is-disabled'}" data-cast-spell="${A.Utils.escapeHtml(s.id)}" ${can ? '' : 'disabled'}>
                <span class="combat-spell-icon">${s.icon || '✨'}</span>
                <span class="combat-spell-info">
                  <span class="combat-spell-name">${A.Utils.escapeHtml(s.name)}</span>
                  <span class="combat-spell-meta dim">${s.damage ? `${s.damage} daño` : s.heal ? `${s.heal} cura` : ''} · Maná ${s.manaCost}</span>
                </span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
    return modalShell('Lanzar hechizo', body);
  }

  // ---------- Combat: elegir item ----------

  function renderCombatItem() {
    const items = A.Combat.availableItems();
    if (items.length === 0) {
      return modalShell('Usar item', `<p class="muted">No tienes consumibles a mano.</p>`);
    }
    const body = `
      <div class="combat-item-modal">
        <div class="combat-item-list">
          ${items.map((s) => {
            const data = A.Data.getById('items', s.itemId);
            if (!data) return '';
            return `
              <button class="combat-item-row" data-use-item="${A.Utils.escapeHtml(s.itemId)}">
                <span class="combat-item-icon">${data.icon || '🧪'}</span>
                <span class="combat-item-info">
                  <span class="combat-item-name">${A.Utils.escapeHtml(data.name)} <span class="dim">×${s.qty}</span></span>
                  <span class="combat-item-meta dim">${A.Utils.escapeHtml(data.description || '')}</span>
                </span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
    return modalShell('Usar item', body);
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
          <button class="modal-close" data-modal-close aria-label="Cerrar">✕</button>
        </header>
        <div class="modal-body">${bodyHtml}</div>
      </div>
    `;
  }

  function bindOverlayEvents(overlay, id, payload) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) A.State.closeModal();
    });
    const closeBtn = overlay.querySelector('[data-modal-close]');
    if (closeBtn) closeBtn.addEventListener('click', () => A.State.closeModal());

    if (id === 'item-detail') {
      overlay.querySelectorAll('[data-detail-action]').forEach((b) => {
        b.addEventListener('click', () => onItemAction(b.dataset.detailAction, payload.itemId));
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

    if (id === 'npc') {
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

    if (id === 'creature') {
      overlay.querySelectorAll('[data-creature-action]').forEach((b) => {
        b.addEventListener('click', () => {
          const action = b.dataset.creatureAction;
          if (action === 'tame') {
            A.State.openModal('tame', { enemyId: b.dataset.enemyId });
          } else if (action === 'fight') {
            A.State.closeModal();
            A.Combat.start({ enemyId: b.dataset.enemyId, fromTravel: false });
          }
        });
      });
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
          A.State.closeModal();
          A.Combat.playerSpell(b.dataset.castSpell);
        });
      });
    }

    if (id === 'combat-item') {
      overlay.querySelectorAll('[data-use-item]').forEach((b) => {
        b.addEventListener('click', () => {
          A.State.closeModal();
          A.Combat.playerUseItem(b.dataset.useItem);
        });
      });
    }
  }

  function onItemAction(action, itemId) {
    if (action === 'equip') {
      A.Inventory.equip(itemId);
      A.State.closeModal();
    } else if (action === 'use') {
      A.Inventory.use(itemId);
      A.State.closeModal();
    } else if (action === 'drop') {
      A.Inventory.drop(itemId);
      A.State.closeModal();
    }
  }

  function onMenuAction(action) {
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
        body: '¿Seguro? Se elimina tu partida y los cambios del editor. No hay vuelta atrás.',
        danger: true,
        onConfirm: () => {
          try {
            localStorage.removeItem('aventurs:save');
            localStorage.removeItem('aventurs:content');
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
            localStorage.setItem('aventurs:save', JSON.stringify(save));
            location.reload();
          } else {
            A.Data.saveOverrides(parsed);
            location.reload();
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
      weapon: 'Arma', armor: 'Armadura', consumable: 'Consumible',
      material: 'Material', misc: 'Objeto', coin: 'Moneda',
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
