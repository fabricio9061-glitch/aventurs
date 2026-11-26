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
            <span class="version-pill" title="Versión del juego">v3.13.0</span>
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
            <span class="pt-head-slot" id="pt-head-slot">${A.Views.Party ? A.Views.Party.headerButton() : ''}</span>
            <button class="btn-ghost head-btn" data-action="journal" title="Misiones y crónicas">${A.UI ? A.UI.icon('book', 18) : ''}<span>Diario</span></button>
            ${canEdit() ? '<button class="btn-ghost head-btn" data-action="editor">Editor</button>' : ''}
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

  /** v3.0: el editor es solo de la cuenta del dueño (ver js/core/accounts.js). */
  function canEdit() { return !A.Accounts || !A.Accounts.canEdit || A.Accounts.canEdit(); }

  /** v3.0: el botón del grupo (con su puntito) se redibuja solo. */
  function renderPartyHead() {
    const slot = rootEl && rootEl.querySelector('#pt-head-slot');
    if (!slot || !A.Views.Party) return;
    slot.innerHTML = A.Views.Party.headerButton();
    slot.querySelectorAll('[data-action]').forEach((btn) => btn.addEventListener('click', () => handleAction(btn.dataset.action)));
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

  // ============================================================
  // v2.1: ficha del personaje (barra lateral rediseñada)
  //   cabecera oscura con retrato, nivel y experiencia
  //   barras de vida, maná y comida
  //   mascota (si hay), atributos con ícono, equipo en 3 casillas,
  //   mochila con el dinero y, al final, las misiones
  // ============================================================

  const RARITY_CLS = { common: '', uncommon: 'is-uncommon', rare: 'is-rare', epic: 'is-epic', legendary: 'is-legendary' };
  const TYPE_NAME = { warrior: 'Guerrero', hybrid: 'Híbrido', mage: 'Mago' };

  function ic(name, size, cls) { return A.UI ? A.UI.icon(name, size, cls) : ''; }
  function escH(v) { return A.Utils.escapeHtml(String(v == null ? '' : v)); }

  function hudBar(cls, iconName, label, cur, max, extra) {
    return `
      <div class="sb-bar ${cls}" title="${escH(label)} ${cur}/${max}">
        <span class="sb-bar-icon">${ic(iconName, 18)}</span>
        <span class="sb-bar-track"><span class="sb-bar-fill" style="width:${pct(cur, max)}%"></span></span>
        <span class="sb-bar-val num">${cur}<span class="sb-bar-max">/${max}</span></span>
        ${extra || ''}
      </div>`;
  }

  /** v3.2: en grupo, vida, maná y comida van finitas arriba de todo (como la experiencia). */
  function thinBar(cls, iconName, label, cur, max, tag) {
    return `
          <div class="sb-vital ${cls}" title="${escH(label)} ${cur}/${max}">
            <span class="sb-vital-ic">${ic(iconName, 12)}</span>
            <span class="sb-vital-track"><span style="width:${pct(cur, max)}%"></span></span>
            <span class="sb-vital-text num">${cur}<i>/${max}</i>${tag || ''}</span>
          </div>`;
  }

  function statChip(iconName, label, value, title, down) {
    return `<div class="sb-stat ${down ? 'is-down' : ''}" title="${escH(title || label)}">${ic(iconName, 18)}<span class="sb-stat-val num">${escH(value)}</span><span class="sb-stat-label">${escH(label)}</span></div>`;
  }

  /** v3.1: lo que suma cada estadística al explorar (Fuerza, Agilidad...). */
  function exploreSheet(p) {
    if (!A.Explore || !A.Explore.sheet) return '';
    const list = A.Explore.sheet(p);
    const sign = (v) => (v > 0 ? `+${v}` : `${v}`);
    return `
          <section class="sb-sec sb-sec-explore">
            <h3 class="sb-title"><span>Al explorar</span><span class="sb-title-note">se suma al dado</span></h3>
            <div class="sb-xstats">
              ${list.map((x) => `<div class="sb-xstat ${x.down ? 'is-down' : ''}" title="${escH(`${x.label}: ${x.hint} Se suma al dado de 20 cuando una escena pide ${x.label}.${x.down ? ' Con hambre fuerte, baja.' : ''}`)}">${ic(x.icon, 14)}<span class="sb-xstat-val num">${sign(x.value)}</span><span class="sb-xstat-label">${escH(x.label)}</span></div>`).join('')}
            </div>
          </section>`;
  }

  /** v2.4: la velocidad cuenta el peso de arma y armadura. */
  function speedTitle(p, st) {
    const base = 'Velocidad: el más rápido actúa primero, y te ayuda a huir.';
    if (!st) return base;
    if (st.weightPenalty > 0) return `${base} Tu equipo pesa ${st.weight}: por pasar de ${A.Balance.FREE_WEIGHT || 4} perdés ${st.weightPenalty} de velocidad.`;
    return `${base} Tu equipo pesa ${st.weight} (hasta ${A.Balance.FREE_WEIGHT || 4} no frena).`;
  }

  /** v2.4: número corto de un accesorio para la etiqueta de la esquina. */
  function accBadge(item) {
    const a = (item && item.acc) || {};
    const pc = (x) => `${Math.round(x * 100)}%`;
    if (a.precision) return `+${a.precision}`;
    if (a.damage) return `+${a.damage}`;
    if (a.armor) return `+${a.armor}`;
    if (a.defense) return `+${a.defense}`;
    if (a.speed) return `+${a.speed}`;
    if (a.mana) return `+${a.mana}`;
    if (a.regen) return `+${a.regen}`;
    if (a.crit) return `${20 - a.crit}+`;
    for (const k of ['xp', 'gold', 'drops', 'thorns', 'lifesteal', 'double', 'counter', 'heal']) if (a[k]) return pc(a[k]);
    return '';
  }

  function renderSidebar() {
    if (!sidebarEl) return;
    const p = A.State.player;
    if (!p) { sidebarEl.innerHTML = ''; return; }
    renderMobStatus(p);

    const race = A.Data.getById('races', p.raceId);
    const weapon = p.equipment.weapon ? A.Data.getById('weapons', p.equipment.weapon) : null;
    const armor = p.equipment.armor ? A.Data.getById('armors', p.equipment.armor) : null;
    const accessory = p.equipment.accessory ? A.Data.getById('items', p.equipment.accessory) : null;
    const xpPrev = xpForLevel(p.level);
    const xpNext = xpForLevel(p.level + 1);
    const xpIn = Math.max(0, p.xp - xpPrev);
    const xpSpan = Math.max(1, xpNext - xpPrev);
    const maxLevel = A.Progression && p.level >= A.Progression.MAX_LEVEL;
    const bag = A.Data.getById('bags', p.bagId) || A.Data.getById('bags', 'bag_starter');
    const st = A.Balance && A.Balance.playerCombatStats ? A.Balance.playerCombatStats(p) : null;
    const type = A.Balance && A.Balance.classOf ? A.Balance.classOf(p) : 'hybrid';
    const hunger = A.Survival ? A.Survival.getStatus() : null;
    const regen = A.Balance && A.Balance.manaRegenOf ? A.Balance.manaRegenOf(p) : { turn: 0, win: 0 };
    const onHit = A.Balance && A.Balance.manaOnHit ? A.Balance.manaOnHit(p) : 0;
    const manaHint = !p.hasMagic ? '' : regen.turn > 0
      ? `Recuperás ${A.Balance.regenLabel(regen.turn)} de maná por turno${regen.turn % 1 ? ' (en promedio)' : ''} y ${Math.round(regen.win * 100)}% al ganar una pelea.`
      : onHit > 0
        ? `Cada golpe con arma que acierta te da ${onHit} de maná. Si no, pociones de maná o dormir.`
        : 'Tu maná no vuelve solo: pociones de maná o dormir.';

    // v3.2: en grupo las barras propias van finitas en la cabecera y los compañeros, en filas
    const compact = !!(A.Views.Party && A.Views.Party.hasMates && A.Views.Party.hasMates());
    const hpLabel = 'Vida';
    const manaLabel = `Maná. ${manaHint}`;
    const foodLabel = `Comida${hunger ? ` (${hunger.label})` : ''}.${A.Survival && A.Survival.describeDiet ? ` ${A.Survival.describeDiet(p)}` : ''}`;
    const hungryTag = hunger && ['hungry', 'weak', 'starving'].includes(hunger.id);

    sidebarEl.innerHTML = `
      <div class="sb ${compact ? 'is-party' : ''}">
        <header class="sb-head sb-type-${type}">
          <div class="sb-portrait">${A.Sprites ? A.Sprites.heroFor(p, { size: 52 }) : ''}<span class="sb-level" title="Nivel ${p.level}">${p.level}</span></div>
          <div class="sb-id">
            <div class="sb-name">${escH(p.name)}</div>
            <div class="sb-sub">${escH(race ? race.name : '')} · ${TYPE_NAME[type] || ''}</div>
            ${passiveLine(p)}
          </div>
          <div class="sb-head-btns">
            ${p.hasMagic ? `<button class="sb-magic" data-action="open-magic" title="Tus hechizos">${ic('spell', 20)}</button>` : (A.Techniques && A.Techniques.of(p) ? `<button class="sb-magic" data-action="open-magic" title="Tus técnicas">${ic('swords', 20)}</button>` : '')}
            <button class="sb-xbtn" data-action="open-explore" title="Tus números al explorar (Fuerza, Agilidad, Ingenio...)">${ic('d20', 18)}</button>
          </div>
          <!-- v3.3: solo o en grupo, las barras van finitas arriba y la experiencia, debajo de todas -->
          <div class="sb-vitals">
            ${thinBar('is-hp', 'heart', hpLabel, p.hp, p.maxHp)}
            ${p.hasMagic ? thinBar('is-mana', 'spell', manaLabel, p.mana, p.maxMana, regen.turn > 0 ? `<em class="sb-vital-regen" title="${escH(manaHint)}">+${A.Balance.regenLabel(regen.turn)}</em>` : '') : ''}
            ${thinBar(`is-food ${hunger ? 'hunger-' + hunger.id : ''}`, 'food', foodLabel, p.food || 0, p.maxFood || 20, hungryTag ? `<em class="sb-vital-warn">${escH(hunger.label)}</em>` : '')}
            <div class="sb-vital is-xp" title="Experiencia: ${p.xp} de ${xpNext}">
              <span class="sb-vital-ic">${ic('xp', 12)}</span>
              <span class="sb-vital-track"><span style="width:${maxLevel ? 100 : pct(xpIn, xpSpan)}%"></span></span>
              <span class="sb-vital-text num">${maxLevel ? 'Nivel máximo' : `${xpIn}<i>/${xpSpan} XP</i>`}</span>
            </div>
          </div>
        </header>

        <div class="sb-body">
          ${A.Views.Party && A.Views.Party.sidebar ? A.Views.Party.sidebar() : (A.Views.Party ? A.Views.Party.allyCard() : '')}

          ${p.pet ? renderPetSidebar(p.pet) : ''}

          <section class="sb-sec">
            <h3 class="sb-title"><span>Tus números</span><button class="sb-title-link" data-action="rules" title="Qué es cada número">${ic('question', 12)}<span>¿Qué es cada uno?</span></button></h3>
            <div class="sb-stats">
              ${st ? statChip('target', 'Precisión', `${st.attack >= 0 ? '+' : ''}${st.attack}`, 'Precisión: se suma al dado de 20 cuando atacás') : ''}
              ${statChip('swords', 'Daño', formatDamageDisplay(weapon, p.stats.damage), 'Daño: la vida que le sacás al enemigo cuando acertás (tu arma más tus bonus)')}
              ${st ? statChip('d20', 'Defensa', st.defense, 'Defensa: lo que un enemigo tiene que sacar (dado de 20 más su precisión) para pegarte') : ''}
              ${statChip('shield', 'Armadura', st ? st.armor : (p.stats.armor || 0), 'Armadura: se resta a cada golpe que recibís')}
              ${statChip('boot', 'Velocidad', st ? st.speed : p.stats.speed, speedTitle(p, st), st && st.weightPenalty > 0)}
              ${p.hasMagic && st ? statChip('arcane', 'Magia', `+${st.spellPower || 0}`, 'Magia: se suma al daño de tus hechizos') : ''}
            </div>
          </section>
          ${classNote(p, weapon)}

          <section class="sb-sec">
            <h3 class="sb-title"><span>Equipo</span></h3>
            <div class="sb-equip">
              ${equipTile('Arma', weapon, 'weapon')}
              ${equipTile('Armadura', armor, 'armor')}
              ${equipTile('Accesorio', accessory, 'accessory')}
              ${equipTile('Mochila', bag, 'bag')}
            </div>
          </section>

          ${renderBag(bag)}
        </div>
      </div>
    `;

    bindSidebarEvents();
  }

  /** Mascota: retrato, barras y sus dos botones. */
  function renderPetSidebar(pet) {
    const lvl = pet.level || 1;
    const xp = pet.xp || 0;
    const xpNeeded = pet.xpNeeded || (lvl * 30);
    const isKO = pet.health <= 0;
    const food = pet.food != null ? pet.food : 10;
    const maxFood = pet.maxFood || 10;
    const diet = A.Tame && A.Tame.dietInfo ? A.Tame.dietInfo(pet) : null;
    const hungry = food <= 0;
    return `
      <section class="sb-pet ${isKO ? 'is-ko' : ''}">
        <div class="sb-pet-head">
          <span class="sb-pet-sprite">${A.Sprites ? A.Sprites.petHtml(pet, { size: 36 }) : ''}</span>
          <div class="sb-pet-id">
            <div class="sb-pet-name">${escH(pet.name)} <span class="sb-pet-lvl">Nv ${lvl}</span></div>
            <div class="sb-pet-meta ${hungry && !isKO ? 'is-bad' : ''}">${isKO ? 'Inconsciente' : hungry ? `Con hambre: dale ${escH(diet ? diet.eats : 'comida')}` : (diet ? `Come: ${escH(diet.eats)}` : 'Tu compañera')}</div>
          </div>
          <div class="sb-pet-actions">
            <button class="sb-pet-btn" data-pet-action="heal" title="${isKO ? 'Despertarla con una poción o una hierba de la vida' : 'Curarla con una poción'}">${ic('potion', 18)}</button>
            <button class="sb-pet-btn" data-pet-action="feed" title="Darle comida de su dieta" ${isKO ? 'disabled' : ''}>${ic('food', 18)}</button>
            <button class="sb-pet-btn is-release" data-pet-action="release" title="Liberarla (para poder domar otra)">${ic('run', 18)}</button>
          </div>
        </div>
        <div class="sb-pet-bars">
          ${hudBar('is-hp is-small', 'heart', 'Vida de tu mascota', pet.health, pet.maxHealth)}
          ${hudBar('is-food is-small', 'food', 'Saciedad', food, maxFood)}
        </div>
        <div class="sb-pet-xp" title="Experiencia de tu mascota: ${xp}/${xpNeeded}"><span style="width:${pct(xp, xpNeeded)}%"></span></div>
        ${(() => {
          // v3.9: lo que te da tu mascota (o por qué no te lo da)
          const b = A.Tame && A.Tame.ownerBond ? A.Tame.ownerBond(A.State.player) : null;
          if (!b) return '';
          if (b.off) return `<div class="sb-pet-bond is-off">${ic('paw', 14)}<span>${escH(b.off)}</span></div>`;
          if (b.text) return `<div class="sb-pet-bond">${ic('paw', 14)}<span>${escH(b.text)}</span></div>`;
          return pet.species === 'lobo' ? `<div class="sb-pet-bond">${ic('paw', 14)}<span>En la pelea aúlla: pegás con +1 de precisión y daño.</span></div>` : '';
        })()}
      </section>
    `;
  }

  function equipTile(label, equipped, slotName) {
    if (!equipped) {
      return `<div class="sb-eq is-empty" title="${label}: nada puesto"><span class="sb-eq-label">${label}</span><span class="sb-eq-none">Nada</span></div>`;
    }
    let stat = '';
    if (slotName === 'weapon') stat = `${equipped.damage}`;
    else if (slotName === 'armor') stat = `+${equipped.defense}`;
    else if (slotName === 'accessory') stat = accBadge(equipped);
    else if (slotName === 'bag') stat = `${equipped.slots}`;
    const dataAttr = slotName === 'bag'
      ? `data-equipped-bag="${escH(equipped.id)}"`
      : `data-equipped-slot="${slotName}"`;
    let tip = slotName === 'accessory' && A.Accessories ? A.Accessories.describe(equipped).join('. ') : stat;
    // v2.5: el arma avisa si deja un estado al pegar
    if (slotName === 'weapon' && A.ItemFx && A.ItemFx.weaponEffectLine) {
      const proc = A.ItemFx.weaponEffectLine(equipped);
      if (proc) tip = `${stat}. ${proc}`;
      // v3.12: lo único de las legendarias (Crematoria, Agonía de Escarcha, Martillo Maldito)
      const extra = A.ItemFx.weaponSpecialLines ? A.ItemFx.weaponSpecialLines(equipped) : [];
      if (extra.length) tip = `${tip || stat}. ${extra.join('. ')}`;
    }
    return `
      <button class="sb-eq ${RARITY_CLS[equipped.rarity] || ''}" ${dataAttr} title="${escH(label)}: ${escH(equipped.name)}${tip ? ` (${escH(tip)})` : ''}">
        <span class="sb-eq-sprite">${A.ItemSprites ? A.ItemSprites.html(equipped, { size: 28 }) : ''}</span>
        <span class="sb-eq-name">${escH(equipped.name)}</span>
        ${stat ? `<span class="sb-eq-stat num">${escH(stat)}</span>` : ''}
      </button>
    `;
  }

  function renderBag(bag) {
    const p = A.State.player;
    const cap = bag ? bag.slots : 5;
    const used = A.State.inventoryUsedSlots();
    const items = (p.inventory || []);

    const cells = [];
    let occupied = 0;
    for (const slot of items) {
      const data = A.Inventory.resolveData(slot.itemId);
      const sprite = data && A.ItemSprites ? A.ItemSprites.html(data, { size: 28 }) : '';
      const qty = slot.qty > 1 ? `<span class="sb-slot-qty num">${slot.qty}</span>` : '';
      const itemSlots = A.State.itemSlots(slot.itemId);
      cells.push(`
        <button class="sb-slot is-filled ${itemSlots > 1 ? 'is-large' : ''} ${data ? (RARITY_CLS[data.rarity] || '') : ''}" data-mini-item="${escH(slot.itemId)}" title="${escH(data ? data.name : slot.itemId)}${itemSlots > 1 ? ' (ocupa 2 espacios)' : ''}">
          ${sprite}${qty}
        </button>
      `);
      occupied += itemSlots;
    }
    for (let i = occupied; i < cap; i++) cells.push('<div class="sb-slot is-empty"></div>');

    return `
      <section class="sb-sec">
        <h3 class="sb-title">
          <span>${bag ? escH(bag.name) : 'Mochila'}</span>
          <span class="sb-title-meta num ${used >= cap ? 'is-full' : ''}">${used}/${cap}</span>
          <span class="sb-wallet" title="Tu dinero">${A.Currency.walletHtml ? A.Currency.walletHtml(16) : A.Currency.formatWallet()}</span>
        </h3>
        <div class="sb-bag">${cells.join('')}</div>
      </section>
    `;
  }

  function renderActiveView() {
    if (!mainEl) return;
    const shellBody = rootEl.querySelector('.shell-body');
    const gameShell = rootEl.querySelector('.game-shell');
    // v3.10: si huiste de una pelea en grupo y elegiste volver, la pelea de tus compañeros sigue sin mostrarse
    const hidden = !!(A.State.combat && A.State.ui.combatHidden && A.State.ui.combatHidden === A.State.combat.id && !A.State.combat.result);
    if (gameShell) gameShell.classList.toggle('is-combat-mode', !!A.State.combat && !hidden);
    // Si hay combate activo, renderizar Combat y ocultar paneles laterales
    if (A.State.combat && !hidden) {
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
    const bad = fit.atk < 0 || fit.blocked;
    return `<div class="class-note ${bad ? 'is-bad' : 'is-good'}">${A.UI ? A.UI.icon(bad ? 'arrow-down' : 'arrow-up', 14) : ''}<span>${A.Utils.escapeHtml(fit.note)}</span></div>`;
  }

  /** Misiones en curso (hasta 3) con su próximo objetivo. v3.4: ya no va en la barra (está en el centro, ver world.js). */
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
        <button class="quests2-head" data-action="journal">${A.UI.icon('quest', 16)}<span>Misiones</span><span class="quests2-more">${active.length > 3 ? `+${active.length - 3} en el Diario` : 'Diario'}</span></button>
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
        const itemId = A.State.player.equipment[slot];
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
    // v3.2: liberarla (con confirmación) para poder domar otra
    if (action === 'release') {
      if (A.State.combat || (A.Party && A.Party.guestOwned && A.Party.guestOwned())) {
        A.State.addChronicle({ type: 'note', text: 'Ahora no: terminá lo que estás haciendo antes de liberar a tu mascota.' });
        return;
      }
      const name = p.pet.name;
      A.Views.Modals.confirm({
        title: `Liberar a ${name}`,
        body: `${name} vuelve a su tierra y no la vas a ver más. Después podés domar otra criatura. ¿Seguro?`,
        danger: true,
        onConfirm: () => { A.Tame.release(); A.Bus.emit('inventory:changed'); renderSidebar(); },
      });
      return;
    }
    const res = action === 'heal' ? A.Tame.healWithPotion() : A.Tame.feed();
    if (res && !res.ok) A.State.addChronicle({ type: 'note', text: res.text });
    A.Bus.emit('inventory:changed');
    renderSidebar();
  }


  function handleAction(action) {
    if (action === 'party') { A.State.openModal('party', {}); return; }
    if (action === 'editor') { if (canEdit()) A.Views.Editor.mount(rootEl); return; }
    else if (action === 'rules') A.State.openModal('rules');
    else if (action === 'menu') A.State.openModal('menu');
    else if (action === 'open-magic') A.State.openModal('magic');
    else if (action === 'open-explore') A.State.openModal('explore-stats');
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
      return A.Utils.compactDice ? A.Utils.compactDice(composed.expression) : composed.expression;
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
    // v3.0: grupo
    unsubscribers.push(A.Bus.on('party:changed', () => { renderPartyHead(); renderSidebar(); }));
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
