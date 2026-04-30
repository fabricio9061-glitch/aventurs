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
      default: html = `<div class="modal"><div class="modal-body">Modal "${id}" desconocido.</div></div>`;
    }

    overlay.innerHTML = html;
    host.appendChild(overlay);

    bindOverlayEvents(overlay, id, payload);
  }

  // ---------- NPC ----------

  function renderNpc({ npcId }) {
    const npc = A.Data.getById('npcs', npcId);
    if (!npc) return modalShell('NPC no encontrado', `<p class="muted">Algo salió mal.</p>`);

    const dialog = A.Utils.randomOf(npc.dialog || []) || '...';

    const actions = [];
    if (npc.role === 'merchant' || npc.role === 'shopkeeper' || npc.role === 'vendor' || npc.role === 'blacksmith') {
      if ((npc.sells || []).length) {
        actions.push({ id: 'shop', label: 'Comerciar' });
      }
    }
    if (npc.role === 'tavernkeeper' || npc.role === 'innkeeper') {
      if (npc.services && npc.services.restCost != null) {
        actions.push({ id: 'rest', label: `Descansar (${npc.services.restCost}c)` });
      }
    }
    if ((npc.role === 'sage' || npc.role === 'wizard' || npc.role === 'mage') && (npc.teaches || []).length) {
      actions.push({ id: 'teach', label: 'Aprender hechizos' });
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
        <blockquote class="npc-dialog">${A.Utils.escapeHtml(dialog)}</blockquote>
        ${actions.length ? `
          <div class="npc-actions">
            ${actions.map((a) => `
              <button class="btn-secondary" data-npc-action="${a.id}" disabled>
                ${A.Utils.escapeHtml(a.label)}
              </button>
            `).join('')}
            <div class="muted small">Las interacciones con NPCs (tienda, descanso pago, aprender) llegan en Fase 3.</div>
          </div>
        ` : ''}
      </div>
    `;
    return modalShell(npc.name, body);
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
