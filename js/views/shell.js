/* ============================================================
   Aventurs — View: Shell (v1.2.0)

   Cambios v1.2.0:
     - Tab "Inventario" eliminada del nav. La mochila vive completamente
       en el sidebar derecho (todos los slots según capacidad).
     - Si State.combat está activo, el main muestra Combat view en vez de
       lo que diga la tab activa.
     - Sidebar ya no tiene mini-grid de 10; ahora muestra el grid completo
       de la mochila (5..32 slots).
   ============================================================ */

(function (A) {
  'use strict';

  let rootEl = null;
  let mainEl = null;
  let sidebarEl = null;
  let chroniclesEl = null;
  let mobStatusEl = null;
  let unsubscribers = [];

  function tabConfig() {
    return [
      { id: 'world', label: 'Mundo', view: 'World' },
    ];
  }

  function render() {
    if (!rootEl) return;
    const tabs = tabConfig();
    const activeTab = A.State.ui.activeTab || 'world';
    let validTab = activeTab;
    if (!tabs.find((t) => t.id === activeTab)) {
      validTab = 'world';
      A.State.ui.activeTab = 'world';
    }

    rootEl.innerHTML = `
      <div class="game-shell">
        <header class="shell-header">
          <div class="shell-brand">
            <span class="brand-icon">${A.UI ? A.UI.icon('swords', 26) : ''}</span>
            <span class="brand-name">Aventurs</span>
          </div>
          ${tabs.length > 1 ? `
            <nav class="shell-nav">
              ${tabs.map((t) => `
                <button class="nav-tab ${t.id === validTab ? 'is-active' : ''}" data-tab="${t.id}">
                  ${A.Utils.escapeHtml(t.label)}
                </button>
              `).join('')}
            </nav>
          ` : `<div class="shell-nav-spacer"></div>`}
          <div class="shell-actions">
            <button class="btn-ghost head-btn" data-action="journal" title="Misiones y crónicas">${A.UI ? A.UI.icon('book', 18) : ''}<span>Diario</span></button>
            <button class="btn-ghost head-btn" data-action="editor">Editor</button>
            <button class="btn-ghost head-btn" data-action="menu">Menú</button>
          </div>
        </header>

        <div class="shell-body">
          <main class="shell-main" id="shell-main">
            <button class="mob-status" id="mob-status" data-action="to-sidebar" aria-label="Ver tu personaje"></button>
            <aside class="shell-chronicles" id="shell-chronicles"></aside>
            <div class="shell-main-content" id="shell-main-content"></div>
          </main>
          <aside class="shell-sidebar" id="shell-sidebar"></aside>
        </div>

        <footer class="shell-footer">
          <span class="version-pill">v2.0.0</span>
        </footer>
      </div>
    `;

    mainEl = rootEl.querySelector('#shell-main-content');
    mobStatusEl = rootEl.querySelector('#mob-status');
    sidebarEl = rootEl.querySelector('#shell-sidebar');
    chroniclesEl = rootEl.querySelector('#shell-chronicles');

    bindEvents();
    renderSidebar();
    renderChroniclesPanel();
    renderActiveView();
  }

  /** v1.9.2: la pasiva de la raza, con su ícono y la explicación al pasar el mouse. */
  function passiveLine(p) {
    const info = A.Passives ? A.Passives.info(p) : null;
    if (!info) return '';
    const ico = A.ItemSprites ? A.ItemSprites.icon(info.icon, { size: 16, cls: 'px-soft' }) : '';
    return `<div class="char-passive" title="${A.Utils.escapeHtml(info.text)}">${ico}<span>${A.Utils.escapeHtml(info.name)}</span></div>`;
  }

  /** v2.0: en el celular, una franja con lo esencial arriba de todo (la ficha completa queda abajo). */
  function renderMobStatus(p) {
    if (!mobStatusEl || !p) return;
    const bar = (cls, cur, max) => `<span class="mob-bar ${cls}"><span style="width:${pct(cur, max)}%"></span></span>`;
    mobStatusEl.innerHTML = `
      <span class="mob-hero">${A.Sprites ? A.Sprites.heroFor(p, { size: 36 }) : ''}</span>
      <span class="mob-main">
        <span class="mob-name">${A.Utils.escapeHtml(p.name)} <span class="dim">· Nv ${p.level}</span></span>
        <span class="mob-bars">
          <span class="mob-stat">${A.UI ? A.UI.icon('heart', 14) : ''}<b class="num">${p.hp}/${p.maxHp}</b>${bar('is-hp', p.hp, p.maxHp)}</span>
          ${p.hasMagic ? `<span class="mob-stat">${A.UI ? A.UI.icon('spell', 14) : ''}<b class="num">${p.mana}/${p.maxMana}</b>${bar('is-mana', p.mana, p.maxMana)}</span>` : ''}
          <span class="mob-stat">${A.UI ? A.UI.icon('food', 14) : ''}<b class="num">${p.food || 0}</b></span>
        </span>
      </span>
      <span class="mob-coins">${A.Currency.walletHtml ? A.Currency.walletHtml(14) : ''}</span>
    `;
  }

  function renderSidebar() {
    if (!sidebarEl) return;
    const p = A.State.player;
    if (!p) { sidebarEl.innerHTML = ''; return; }
    renderMobStatus(p);

    const race = A.Data.getById('races', p.raceId);
    const weapon = p.equipment.weapon ? A.Data.getById('weapons', p.equipment.weapon) : null;
    const armor = p.equipment.armor ? A.Data.getById('armors', p.equipment.armor) : null;
    const xpToNext = xpForLevel(p.level + 1);
    const region = A.State.world ? A.Data.getById('regions', A.State.world.regionId) : null;
    const bag = A.Data.getById('bags', p.bagId) || A.Data.getById('bags', 'bag_starter');

    sidebarEl.innerHTML = `
      <div class="sidebar-card">
        <div class="char-header">
          <div class="char-avatar">${A.Sprites ? A.Sprites.heroFor(p, { size: 52 }) : ''}</div>
          <div class="char-id">
            <div class="char-name-row">
              <span class="char-name">${A.Utils.escapeHtml(p.name)}</span>
              ${p.hasMagic ? `<button class="magic-btn" data-action="open-magic" title="Magia">${A.ItemSprites ? A.ItemSprites.icon('spell', { size: 20, cls: 'px-soft' }) : 'Magia'}</button>` : ''}
            </div>
            <div class="char-meta dim">${race ? race.name : '—'} · Nv ${p.level}</div>
            ${passiveLine(p)}
          </div>
        </div>

        <div class="bar-group">
          <div class="bar-row">
            <span class="bar-label">Salud</span>
            <span class="bar-val num">${p.hp}/${p.maxHp}</span>
          </div>
          <div class="bar bar-hp"><span style="width:${pct(p.hp, p.maxHp)}%"></span></div>

          ${p.hasMagic ? `
            <div class="bar-row">
              <span class="bar-label">Maná</span>
              <span class="bar-val num">${p.mana}/${p.maxMana}</span>
            </div>
            <div class="bar bar-mana"><span style="width:${pct(p.mana, p.maxMana)}%"></span></div>
          ` : ''}

          <div class="bar-row">
            <span class="bar-label">XP</span>
            <span class="bar-val num">${p.xp}/${xpToNext}</span>
          </div>
          <div class="bar bar-xp"><span style="width:${pct(p.xp, xpToNext)}%"></span></div>

          <div class="bar-row">
            <span class="bar-label">Comida${A.Survival ? ` <span class="hunger-badge hunger-${A.Survival.getStatus().id}">${A.Survival.getStatus().label}</span>` : ''}</span>
            <span class="bar-val num">${p.food || 0}/${p.maxFood || 20}</span>
          </div>
          <div class="bar bar-food ${A.Survival ? 'hunger-' + A.Survival.getStatus().id : ''}"><span style="width:${pct(p.food || 0, p.maxFood || 20)}%"></span></div>
        </div>

        <div class="stat-grid">
          <div class="stat" title="Daño del arma + bonus de fuerza"><div class="stat-label dim">Daño</div><div class="stat-val num">${formatDamageDisplay(weapon, p.stats.damage)}</div></div>
          <div class="stat"><div class="stat-label dim">Armadura</div><div class="stat-val num">${(p.stats.armor || 0) + (armor ? armor.defense : 0)}</div></div>
          <div class="stat"><div class="stat-label dim">Esquiva</div><div class="stat-val num">${p.stats.dodge}</div></div>
          <div class="stat"><div class="stat-label dim">Velocidad</div><div class="stat-val num">${p.stats.speed}</div></div>
          ${spellPowerStat(p)}
        </div>
        ${classNote(p, weapon)}

        <div class="wallet2" title="Tu dinero">
          <span class="wallet2-label">${A.UI ? A.UI.icon('coins', 18) : ''}<span>Dinero</span></span>
          <span class="wallet2-val">${A.Currency.walletHtml ? A.Currency.walletHtml(16) : A.Currency.formatWallet()}</span>
        </div>

        ${questTracker()}

        <div class="equip-block">
          <div class="block-subtitle dim">Equipado</div>
          <div class="equip-grid-side">
            ${equipMini('Arma', weapon, 'weapon')}
            ${equipMini('Armadura', armor, 'armor')}
            ${equipMini('Mochila', bag, 'bag')}
          </div>
        </div>

        ${p.pet ? renderPetSidebar(p.pet) : ''}

        ${renderBag(bag)}

        ${region ? `<div class="loc-pill">${A.UI ? A.UI.biomeIcon(region, 18) : ''}<span>${A.Utils.escapeHtml(region.name)}</span></div>` : ''}
      </div>
    `;

    bindSidebarEvents();
  }

  /**
   * v1.5.9: card de mascota en sidebar con HP visible + botones curar/alimentar.
   */
  function renderPetSidebar(pet) {
    const lvl = pet.level || 1;
    const xp = pet.xp || 0;
    const xpNeeded = pet.xpNeeded || (lvl * 30);
    const isKO = pet.health <= 0;
    // v1.8.0: saciedad y dieta
    const food = pet.food != null ? pet.food : 10;
    const maxFood = pet.maxFood || 10;
    const diet = A.Tame && A.Tame.dietInfo ? A.Tame.dietInfo(pet) : null;
    const hungry = food <= 0;
    return `
      <div class="pet-card-sidebar ${isKO ? 'is-ko' : ''}">
        <div class="pet-card-header">
          <span class="pet-icon">${A.Sprites ? A.Sprites.petHtml(pet, { size: 40 }) : ''}</span>
          <div class="pet-card-id">
            <div class="pet-card-name">${A.Utils.escapeHtml(pet.name)}</div>
            <div class="pet-card-meta dim">Nv ${lvl}${isKO ? ' · inconsciente' : ''}${hungry && !isKO ? ' · con hambre' : ''}</div>
          </div>
        </div>
        <div class="pet-card-bars">
          <div class="bar-row">
            <span class="bar-label">Salud</span>
            <span class="bar-val num">${pet.health}/${pet.maxHealth}</span>
          </div>
          <div class="bar bar-hp"><span style="width:${pct(pet.health, pet.maxHealth)}%"></span></div>
          <div class="bar-row">
            <span class="bar-label">XP</span>
            <span class="bar-val num">${xp}/${xpNeeded}</span>
          </div>
          <div class="bar bar-xp"><span style="width:${pct(xp, xpNeeded)}%"></span></div>
          <div class="bar-row">
            <span class="bar-label">Saciedad</span>
            <span class="bar-val num">${food}/${maxFood}</span>
          </div>
          <div class="bar bar-food"><span style="width:${pct(food, maxFood)}%"></span></div>
          ${diet ? `<div class="pet-card-meta dim small">Come: ${A.Utils.escapeHtml(diet.eats)}</div>` : ''}
        </div>
        <div class="pet-card-actions">
          <button class="btn-mini" data-pet-action="heal" title="Usar una poción de curación (también la despierta)">${A.UI ? A.UI.icon('potion', 14) : ''} Curar</button>
          <button class="btn-mini" data-pet-action="feed" title="Darle comida de su dieta" ${isKO ? 'disabled' : ''}>${A.UI ? A.UI.icon('food', 14) : ''} Alimentar</button>
        </div>
      </div>
    `;
  }

  function equipMini(label, equipped, slotName) {
    if (!equipped) {
      return `<div class="equip-mini is-empty"><div class="equip-mini-label dim">${label}</div><div class="equip-mini-empty-mark faint">—</div></div>`;
    }
    let stat = '';
    if (slotName === 'weapon') stat = `${equipped.damage}`;
    else if (slotName === 'armor') stat = `+${equipped.defense}`;
    else if (slotName === 'bag') stat = `${equipped.slots} sl`;
    const dataAttr = slotName === 'bag'
      ? `data-equipped-bag="${A.Utils.escapeHtml(equipped.id)}"`
      : `data-equipped-slot="${slotName}"`;
    return `
      <button class="equip-mini equip-mini-clickable" ${dataAttr} title="${A.Utils.escapeHtml(equipped.name)}">
        <div class="equip-mini-label dim">${label}</div>
        <div class="equip-mini-body">
          <span class="equip-mini-icon">${A.ItemSprites ? A.ItemSprites.html(equipped, { size: 30 }) : ''}</span>
          <span class="equip-mini-name">${A.Utils.escapeHtml(equipped.name)}</span>
        </div>
        <div class="equip-mini-stat num">${stat}</div>
      </button>
    `;
  }

  function renderBag(bag) {
    const p = A.State.player;
    const cap = bag ? bag.slots : 5;
    const used = A.State.inventoryUsedSlots();

    // v1.5.7n: monedas se muestran en mochila como cualquier item
    const items = (p.inventory || []);

    // Construir las celdas: items con slots:2 ocupan 2 celdas (grid-column: span 2)
    const cells = [];
    let occupied = 0;
    for (const slot of items) {
      const data = A.Inventory.resolveData(slot.itemId);
      const icon = data && A.ItemSprites ? A.ItemSprites.html(data, { size: 34 }) : '';
      const qty = slot.qty > 1 ? `<span class="bag-side-qty num">${slot.qty}</span>` : '';
      const itemSlots = A.State.itemSlots(slot.itemId);
      const spanClass = itemSlots > 1 ? 'is-large' : '';
      const sizeBadge = itemSlots > 1 ? '<span class="bag-side-size-badge" title="Ocupa 2 slots">×2</span>' : '';
      cells.push(`
        <button class="bag-side-slot is-filled ${spanClass}" data-mini-item="${A.Utils.escapeHtml(slot.itemId)}" title="${A.Utils.escapeHtml(data ? data.name : slot.itemId)}${itemSlots > 1 ? ' (ocupa 2 slots)' : ''}">
          <span class="bag-side-icon">${icon}</span>
          ${qty}
          ${sizeBadge}
        </button>
      `);
      occupied += itemSlots;
    }
    // Slots vacíos restantes
    for (let i = occupied; i < cap; i++) {
      cells.push(`<div class="bag-side-slot is-empty"></div>`);
    }

    // Calcular columnas: para mochila básica de 10 va bien con 5 cols
    const cols = cap <= 5 ? 5 : cap <= 16 ? 4 : 5;

    return `
      <div class="bag-side-block">
        <div class="bag-side-header">
          <div class="bag-side-header-main">
            <div class="bag-side-name">${bag ? A.Utils.escapeHtml(bag.name) : 'Mochila'}</div>
            <div class="bag-side-cap">
              <span class="num">${used} / ${cap}</span>
              <span class="dim small">slots</span>
            </div>
          </div>
        </div>
        <div class="bag-side-grid" style="grid-template-columns: repeat(${cols}, 1fr)">
          ${cells.join('')}
        </div>
      </div>
    `;
  }

  function renderActiveView() {
    if (!mainEl) return;
    const shellBody = rootEl.querySelector('.shell-body');
    // Si hay combate activo, renderizar Combat y ocultar paneles laterales
    if (A.State.combat) {
      if (shellBody) {
        shellBody.classList.add('is-combat');
        shellBody.classList.remove('is-map');
      }
      A.Views.Combat.mount(mainEl);
      return;
    }
    // v1.9.0: al salir del combate se desmonta (corta sus timers y animaciones)
    if (A.Views.Combat && A.Views.Combat.isMounted && A.Views.Combat.isMounted()) A.Views.Combat.unmount();
    // Mapa pantalla completa
    if (A.State.ui.showMap) {
      if (shellBody) {
        shellBody.classList.add('is-map');
        shellBody.classList.remove('is-combat');
      }
      if (A.Views.Map && A.Views.Map.mount) {
        A.Views.Map.mount(mainEl);
        return;
      }
    }
    if (shellBody) {
      shellBody.classList.remove('is-combat');
      shellBody.classList.remove('is-map');
    }
    const tab = A.State.ui.activeTab || 'world';
    const map = { world: 'World' };
    const viewName = map[tab];
    const view = A.Views[viewName];
    if (view && view.mount) {
      view.mount(mainEl);
    } else {
      mainEl.innerHTML = `<div class="empty-tab">Vista "${tab}" pendiente.</div>`;
    }
  }

  function bindEvents() {
    rootEl.querySelectorAll('.nav-tab').forEach((btn) => {
      btn.addEventListener('click', () => A.State.setTab(btn.dataset.tab));
    });
    rootEl.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action));
    });
  }

  function renderChroniclesPanel() {
    if (!chroniclesEl) return;
    const all = A.State.chronicles || [];
    const sorted = all.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const recent = sorted.slice(0, 4);

    // v1.6.1: bloque de tiempo integrado al inicio de la barra de crónicas
    let clockBlock = '';
    if (A.Time && A.State.world) {
      const theme = A.Time.colorTheme();
      const phaseId = theme.phase;
      clockBlock = `
        <div class="chronicles-clock is-${phaseId}" title="Tiempo del mundo: ${A.Utils.escapeHtml(A.Time.format())}">
          <span class="clock-icon">${A.Time.icon(24)}</span>
          <span class="clock-text">
            <span class="clock-day">Día ${A.State.world.day}</span>
            <span class="clock-phase">${A.Time.phaseLabel()}</span>
          </span>
        </div>
      `;
    }

    chroniclesEl.innerHTML = `
      <div class="chronicles-bar">
        ${clockBlock}
        <span class="chronicles-bar-label">${A.UI ? A.UI.icon('feather', 16) : ''}<span>Crónicas</span></span>
        <div class="chronicles-bar-list">
          ${recent.length === 0
            ? `<span class="chronicles-bar-empty muted">Sin entradas aún.</span>`
            : recent.map(chronicleBarRow).join('')}
        </div>
        <button class="chronicles-bar-more" data-action="open-chronicles" title="Abrir el diario de viaje">
          <span>Diario</span>
        </button>
      </div>
    `;
    chroniclesEl.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action));
    });
  }

  function chronicleBarRow(e) {
    const ic = A.Journal ? A.Journal.chronicleIcon(e.type, 16) : '';
    return `
      <span class="chronicle-bar-entry is-${e.type}" title="${A.Utils.escapeHtml(e.text)}">
        <span class="chronicle-bar-icon">${ic}</span>
        <span class="chronicle-bar-text">${A.Utils.escapeHtml(e.text)}${e.count > 1 ? ` <b class="num">×${e.count}</b>` : ''}</span>
      </span>
    `;
  }

  // ---------- v2.0: piezas nuevas de la barra lateral ----------

  /** Poder mágico: suma al daño y la cura de cada hechizo. */
  function spellPowerStat(p) {
    if (!p.hasMagic || !A.Balance || !A.Balance.playerCombatStats) return '';
    const sp = A.Balance.playerCombatStats(p).spellPower || 0;
    return `<div class="stat" title="Se suma al daño y a la curación de tus hechizos"><div class="stat-label dim">Magia</div><div class="stat-val num">+${sp}</div></div>`;
  }

  /** Cómo le queda el arma a tu clase (maestría del guerrero, penalidad del mago). */
  function classNote(p, weapon) {
    if (!A.Balance || !A.Balance.weaponFit) return '';
    const fit = A.Balance.weaponFit(p, weapon);
    if (!fit.note) return '';
    const bad = fit.atk < 0;
    return `<div class="class-note ${bad ? 'is-bad' : 'is-good'}">${A.UI ? A.UI.icon(bad ? 'arrow-down' : 'arrow-up', 14) : ''}<span>${A.Utils.escapeHtml(fit.note)}</span></div>`;
  }

  /** Misiones en curso (hasta 3) con su próximo objetivo. */
  function questTracker() {
    if (!A.Quests) return '';
    const active = A.Quests.activeList();
    if (!active.length) {
      const first = A.Quests.status('mq1_humo');
      if (first === 'available') {
        return `<button class="quests2 is-empty" data-action="journal">${A.UI.icon('crown', 18)}<span>La historia empieza con <b>Tomas el guardia</b>, en el Pueblo Inicial.</span></button>`;
      }
      return '';
    }
    return `
      <div class="quests2">
        <button class="quests2-head" data-action="journal">${A.UI.icon('quest', 16)}<span>Misiones</span><span class="quests2-more">Diario</span></button>
        ${active.slice(0, 3).map((q) => {
          const idx = q.objectives.findIndex((o, i) => !A.Quests.objectiveProgress(q, i).done);
          const ready = idx < 0;
          const o = ready ? null : q.objectives[idx];
          const pr = ready ? null : A.Quests.objectiveProgress(q, idx);
          const giver = A.Data.getById('npcs', q.giver);
          return `
            <button class="quest2-row ${q.main ? 'is-main' : ''} ${ready ? 'is-ready' : ''}" data-action="journal">
              ${A.UI.icon(q.main ? 'crown' : 'scroll', 16)}
              <span class="quest2-text">
                <span class="quest2-title">${A.Utils.escapeHtml(q.title)}</span>
                <span class="quest2-obj">${ready ? `Volvé con ${A.Utils.escapeHtml(giver ? giver.name : 'quien te la dio')}` : A.Utils.escapeHtml(A.Quests.objectiveText(o))}</span>
              </span>
              ${pr && pr.need > 1 ? `<span class="quest2-count num">${pr.have}/${pr.need}</span>` : ready ? A.UI.icon('question', 16) : ''}
            </button>`;
        }).join('')}
      </div>
    `;
  }

  function bindSidebarEvents() {
    sidebarEl.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action));
    });
    sidebarEl.querySelectorAll('[data-mini-item]').forEach((btn) => {
      btn.addEventListener('click', () => {
        A.State.openModal('item-detail', { itemId: btn.dataset.miniItem });
      });
    });
    // Click en una pieza equipada (arma/armadura) → modal con opción Quitar
    sidebarEl.querySelectorAll('[data-equipped-slot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slot = btn.dataset.equippedSlot;
        const itemId = slot === 'weapon' ? A.State.player.equipment.weapon : A.State.player.equipment.armor;
        if (itemId) A.State.openModal('item-detail', { itemId, equipped: true });
      });
    });
    // Click en mochila equipada → modal especial de mochila
    sidebarEl.querySelectorAll('[data-equipped-bag]').forEach((btn) => {
      btn.addEventListener('click', () => {
        A.State.openModal('equipped-bag', { bagId: btn.dataset.equippedBag });
      });
    });
    // v1.5.9: Acciones sobre la mascota (curar / alimentar)
    sidebarEl.querySelectorAll('[data-pet-action]').forEach((btn) => {
      btn.addEventListener('click', () => handlePetAction(btn.dataset.petAction));
    });
  }

  /**
   * v1.5.9: Cura o alimenta a la mascota usando un item del inventario.
   * - heal: busca primero pociones de curación; si no, items con healAmount.
   * - feed: busca items con foodValue (subtype:'food').
   */
  function handlePetAction(action) {
    // v1.8.0: la lógica vive en A.Tame (curar despierta; alimentar usa su dieta)
    const p = A.State.player;
    if (!p || !p.pet || !A.Tame) return;
    const res = action === 'heal' ? A.Tame.healWithPotion() : A.Tame.feed();
    if (res && !res.ok) A.State.addChronicle({ type: 'note', text: res.text });
    A.Bus.emit('inventory:changed');
    renderSidebar();
  }


  function handleAction(action) {
    if (action === 'editor') A.Views.Editor.mount(rootEl);
    else if (action === 'rules') A.State.openModal('rules');
    else if (action === 'menu') A.State.openModal('menu');
    else if (action === 'open-magic') A.State.openModal('magic');
    else if (action === 'open-chronicles') A.State.openModal('journal', { tab: 'chronicles' });
    else if (action === 'journal') A.State.openModal('journal', { tab: 'quests' });
    else if (action === 'to-sidebar' && sidebarEl) sidebarEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function pct(cur, max) {
    if (!max) return 0;
    return Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
  }

  /**
   * Devuelve el daño compuesto a mostrar en la UI.
   * v1.6.7: ahora usa Combat.composePlayerDamage para el desglose racial+arma+bonus.
   */
  function formatDamageDisplay(weapon, statsDamage) {
    const p = A.State.player;
    if (p && A.Combat && A.Combat.composePlayerDamage) {
      const composed = A.Combat.composePlayerDamage(p);
      return composed.expression;
    }
    // Fallback legacy
    const dice = weapon ? weapon.damage : '1d3';
    const bonus = statsDamage || 0;
    if (bonus > 0) return `${dice}+${bonus}`;
    return dice;
  }

  function xpForLevel(lvl) {
    // v1.8.0: misma curva que el juego (js/core/balance.js)
    if (A.Progression) return A.Progression.xpForLevel(lvl);
    return 50 * lvl * lvl;
  }

  function subscribe() {
    unsubscribers.push(A.Bus.on('view:changed', renderActiveView));
    unsubscribers.push(A.Bus.on('player:hp-changed', renderSidebar));
    unsubscribers.push(A.Bus.on('player:mana-changed', renderSidebar));
    unsubscribers.push(A.Bus.on('player:food-changed', renderSidebar));
    unsubscribers.push(A.Bus.on('player:xp-changed', renderSidebar));
    unsubscribers.push(A.Bus.on('player:leveled', renderSidebar));
    unsubscribers.push(A.Bus.on('inventory:changed', renderSidebar));
    unsubscribers.push(A.Bus.on('inventory:equipped', renderSidebar));
    unsubscribers.push(A.Bus.on('inventory:unequipped', renderSidebar));
    unsubscribers.push(A.Bus.on('bag:equipped', renderSidebar));
    unsubscribers.push(A.Bus.on('currency:changed', renderSidebar));
    unsubscribers.push(A.Bus.on('region:changed', () => { renderSidebar(); renderActiveView(); }));
    unsubscribers.push(A.Bus.on('travel:started', () => {
      A.State.ui.showMap = false;
      renderActiveView();
    }));
    unsubscribers.push(A.Bus.on('travel:step', renderActiveView));
    unsubscribers.push(A.Bus.on('travel:completed', () => { renderSidebar(); renderActiveView(); }));
    // v1.5.9: re-render al cambiar el tiempo
    unsubscribers.push(A.Bus.on('time:advanced', renderChroniclesPanel));
    unsubscribers.push(A.Bus.on('time:phase-changed', () => { renderChroniclesPanel(); renderActiveView(); }));
    unsubscribers.push(A.Bus.on('travel:cancelled', renderActiveView));
    unsubscribers.push(A.Bus.on('combat:started', renderActiveView));
    unsubscribers.push(A.Bus.on('combat:ended', () => { renderSidebar(); renderActiveView(); }));
    unsubscribers.push(A.Bus.on('tame:success', renderSidebar));
    // Crónicas: refresh panel izquierdo cada vez que se agrega entrada
    unsubscribers.push(A.Bus.on('chronicle:added', renderChroniclesPanel));
    unsubscribers.push(A.Bus.on('tame:lost', renderSidebar));
    // v2.0: misiones
    unsubscribers.push(A.Bus.on('quest:started', renderSidebar));
    unsubscribers.push(A.Bus.on('quest:progress', renderSidebar));
    unsubscribers.push(A.Bus.on('quest:completed', () => { renderSidebar(); if (!A.State.combat && !A.State.ui.showMap && !A.State.traveling) renderActiveView(); }));
    unsubscribers.push(A.Bus.on('chronicle:added', () => {
      if (A.State.ui.activeTab === 'chronicles') renderActiveView();
    }));
    unsubscribers.push(A.Bus.on('modal:open', renderModals));
    unsubscribers.push(A.Bus.on('modal:close', renderModals));
  }

  function renderModals() {
    if (A.Views && A.Views.Modals && A.Views.Modals.render) {
      A.Views.Modals.render(rootEl);
    }
  }

  const ShellView = {
    mount(container) {
      rootEl = container;
      render();
      subscribe();
      renderModals();
    },
    unmount() {
      unsubscribers.forEach((u) => u && u());
      unsubscribers = [];
      if (rootEl) rootEl.innerHTML = '';
    },
    rerender: render,
  };

  A.Views = A.Views || {};
  A.Views.Shell = ShellView;
})(window.Aventurs);
