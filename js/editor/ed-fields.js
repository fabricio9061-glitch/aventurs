/* ============================================================
   Aventurs — Editor v2.2: campos

   Cada campo de una ficha tiene un "kind" que dice cómo se ve y
   cómo se lee lo que escribís:
     text, textarea, number, percent, dice, select, toggle, color,
     range2, ref, refs, tags, chips, lines, list, group, icon, custom

   Todo se escribe en el borrador (S.draft) por "ruta":
   "health", "encounter.spawnWeights.weak", "drops.2.chance"...
   ============================================================ */

(function (A) {
  'use strict';

  const Ed = (A.Ed = A.Ed || {});
  const { esc, clone, same, join, getPath, setPath, icon, short } = Ed.util;

  // Registro de la última ficha dibujada: ruta -> { f, ctx }
  let reg = new Map();
  // Partes que se redibujan solas al escribir: clave -> función(draft) => html
  let live = new Map();

  function resetRegistry() { reg = new Map(); live = new Map(); }
  function addLive(key, fn, heavy) { live.set(key, { fn, heavy: !!heavy }); return key; }

  // ============================================================
  // Opciones y referencias
  // ============================================================

  function optionsOf(f, draft) {
    const raw = typeof f.options === 'function' ? f.options(draft) : (f.options || []);
    return raw.map((o) => (typeof o === 'object' ? o : { value: o, label: String(o) }));
  }

  const COLS = (f) => (Array.isArray(f.ref) ? f.ref : [f.ref]);

  /** Dibujito de cualquier cosa del juego (para listas y elecciones). */
  function thumbOf(col, e, size) {
    if (!e) return icon('question', size);
    const s = size || 28;
    try {
      if (col === 'enemies') return A.Sprites.html(e, { size: s });
      if (col === 'npcs') return A.Sprites.npcHtml(e, { size: s });
      if (col === 'races') return A.Sprites.heroHtml(e.id, { size: s });
      if (col === 'spells') return A.ItemSprites.spellIcon(e, { size: s });
      if (col === 'regions') return A.UI ? A.UI.biomeIcon(e, s) : icon('map', s);
      if (col === 'quests') return icon(e.main ? 'crown' : 'quest', s);
      if (col === 'events') return icon(e.icon || 'scroll', s);
      if (col === 'recipes') {
        const res = e.result && A.ItemSprites ? A.ItemSprites.html(e.result, { size: s }) : '';
        return res || icon('anvil', s);
      }
      if (col === 'weapons') return A.ItemSprites.html({ ...e, type: 'weapon' }, { size: s });
      if (col === 'armors') return A.ItemSprites.html({ ...e, type: 'armor' }, { size: s });
      if (col === 'bags') return A.ItemSprites.html({ ...e, subtype: 'bag' }, { size: s });
      return A.ItemSprites.html(e, { size: s }) || icon('bag', s);
    } catch (err) {
      return icon('question', s);
    }
  }

  function findAny(cols, id) {
    for (const c of cols) {
      const e = A.Data.getById(c, id);
      if (e) return { col: c, e };
    }
    return null;
  }

  function nameOf(cols, id) {
    const hit = findAny(cols, id);
    return hit ? (hit.e.name || hit.e.title || id) : id;
  }

  const COL_LABEL = {
    items: 'Objetos', weapons: 'Armas', armors: 'Armaduras', bags: 'Mochilas', enemies: 'Criaturas',
    npcs: 'Habitantes', regions: 'Zonas', spells: 'Hechizos', races: 'Razas', quests: 'Misiones', events: 'Escenas', recipes: 'Recetas',
  };

  function refOptions(f, draft) {
    const out = [];
    for (const col of COLS(f)) {
      for (const e of A.Data[col] || []) {
        if (f.filter && !f.filter(e, draft)) continue;
        out.push({
          value: e.id,
          label: e.name || e.title || e.id,
          thumb: thumbOf(col, e, 30),
          meta: Ed.schema && Ed.schema.metaOf ? Ed.schema.metaOf(col, e) : '',
          group: COLS(f).length > 1 ? COL_LABEL[col] : '',
        });
      }
    }
    return out;
  }

  // ============================================================
  // Dados
  // ============================================================

  const DICE_RE = /^\s*(\d+\s*d\s*\d+|\d+)(\s*[+-]\s*(\d+\s*d\s*\d+|\d+))*\s*$/i;
  function diceText(v) {
    if (v === undefined || v === null || v === '') return '';
    if (!DICE_RE.test(String(v))) return '<span class="is-bad">Escribilo así: 1d6+2 (un dado de 6 caras, más 2)</span>';
    const r = A.Balance.rangeOf(v);
    const avg = (r.min + r.max) / 2;
    return r.min === r.max ? `siempre ${r.min}` : `de ${r.min} a ${r.max} · en promedio ${String(avg).replace('.', ',')}`;
  }

  // ============================================================
  // Dibujar campos
  // ============================================================

  function renderFields(fields, ctx) {
    return (fields || []).map((f) => renderField(f, ctx)).join('');
  }

  function renderField(f, ctx) {
    const draft = ctx.draft;
    const parentVal = ctx.path ? getPath(draft, ctx.path) : draft;
    if (f.when && !f.when(draft, parentVal)) return '';
    const path = f.path ? join(ctx.path, f.path) : ctx.path;
    const value = f.path ? getPath(draft, path) : undefined;
    if (f.path) reg.set(path, { f, ctx: { ...ctx, path } });

    const W = WIDGETS[f.kind] || WIDGETS.text;
    const inner = W(f, value, { ...ctx, fpath: path });
    if (f.kind === 'group' && !f.label) return inner;

    const canRevert = !!(ctx.base && !ctx.inList && f.path && f.kind !== 'custom');
    const baseVal = canRevert ? getPath(ctx.base, path) : undefined;
    const changed = canRevert && !same(value, baseVal);
    const help = typeof f.help === 'function'
      ? `<div class="ed-help" data-live="${esc(addLive(`help:${path || f.label}`, (d) => f.help(d, getPath(d, path))))}">${f.help(draft, value)}</div>`
      : (f.help ? `<div class="ed-help">${f.help}</div>` : '');
    return `
      <div class="ed-field is-${f.kind} ${f.wide || WIDE.has(f.kind) ? 'is-wide' : ''} ${changed ? 'is-changed' : ''}" ${f.path ? `data-field="${esc(path)}"` : ''} ${canRevert ? 'data-revertable="1"' : ''}>
        ${f.label ? `<div class="ed-label"><span>${esc(f.label)}</span>${canRevert ? `<button type="button" class="ed-revert" data-act="revert-field" data-path="${esc(path)}" title="Volver a como viene en el juego: ${esc(short(baseVal))}">${icon('undo', 13)}<span>Original</span></button>` : ''}</div>` : ''}
        ${inner}
        ${help}
      </div>`;
  }

  const WIDE = new Set(['textarea', 'refs', 'tags', 'lines', 'list', 'group', 'custom', 'chips']);

  const attrs = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => (v === true ? k : `${k}="${esc(v)}"`)).join(' ');

  const WIDGETS = {
    text(f, v, ctx) {
      return `<input class="ed-in" type="text" ${attrs({ 'data-f': ctx.fpath, 'data-k': 'text', 'data-empty': f.keepEmpty ? null : 'none', placeholder: f.placeholder, maxlength: f.max || 120, value: v == null ? '' : v })}>`;
    },
    textarea(f, v, ctx) {
      return `<textarea class="ed-in ed-ta" rows="${f.rows || 3}" ${attrs({ 'data-f': ctx.fpath, 'data-k': 'text', 'data-empty': f.keepEmpty ? null : 'none', placeholder: f.placeholder, maxlength: f.max || 2000 })}>${esc(v == null ? '' : v)}</textarea>`;
    },
    number(f, v, ctx) {
      return numberBox(f, v == null ? '' : v, ctx.fpath, 'number');
    },
    percent(f, v, ctx) {
      const shown = v == null || v === '' ? '' : Math.round(Number(v) * 1000) / 10;
      return numberBox({ min: 0, max: 100, unit: '%', ...f }, shown, ctx.fpath, 'percent');
    },
    dice(f, v, ctx) {
      const key = addLive(`dice:${ctx.fpath}`, (d) => diceText(getPath(d, ctx.fpath)));
      return `<div class="ed-dice">
        <input class="ed-in" type="text" ${attrs({ 'data-f': ctx.fpath, 'data-k': 'dice', 'data-empty': 'none', placeholder: f.placeholder || '1d6', value: v == null ? '' : v, maxlength: 24, autocomplete: 'off', spellcheck: 'false' })}>
        <span class="ed-dice-out" data-live="${esc(key)}">${diceText(v)}</span>
      </div>`;
    },
    select(f, v, ctx) {
      const opts = optionsOf(f, ctx.draft);
      const num = opts.some((o) => typeof o.value === 'number');
      return `<select class="ed-in ed-select" ${attrs({ 'data-f': ctx.fpath, 'data-k': 'select', 'data-num': num ? '1' : null })}>
        ${f.none !== undefined ? `<option value="">${esc(f.none)}</option>` : ''}
        ${opts.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(v == null ? '' : v) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
        ${v != null && v !== '' && !opts.some((o) => String(o.value) === String(v)) ? `<option value="${esc(v)}" selected>${esc(v)}</option>` : ''}
      </select>`;
    },
    toggle(f, v, ctx) {
      return `<label class="ed-switch">
        <input type="checkbox" ${attrs({ 'data-f': ctx.fpath, 'data-k': 'toggle', checked: !!v })}>
        <span class="ed-switch-ui"></span>
        <span class="ed-switch-text">${esc(v ? (f.on || 'Sí') : (f.off || 'No'))}</span>
      </label>`;
    },
    color(f, v, ctx) {
      return `<div class="ed-color">
        <input type="color" ${attrs({ 'data-f': ctx.fpath, 'data-k': 'color', value: v || f.auto || '#888888' })}>
        ${v ? `<button type="button" class="ed-mini" data-act="clear" data-path="${esc(ctx.fpath)}">Automático</button>` : `<span class="ed-dim">automático</span>`}
      </div>`;
    },
    range2(f, v, ctx) {
      const a = Array.isArray(v) ? v : [];
      reg.set(`${ctx.fpath}.0`, { f: { kind: 'number', min: f.min, max: f.max }, ctx });
      reg.set(`${ctx.fpath}.1`, { f: { kind: 'number', min: f.min, max: f.max }, ctx });
      return `<div class="ed-range2">
        <span>de</span>${numberBox({ min: f.min, max: f.max }, a[0] == null ? '' : a[0], `${ctx.fpath}.0`, 'number')}
        <span>a</span>${numberBox({ min: f.min, max: f.max }, a[1] == null ? '' : a[1], `${ctx.fpath}.1`, 'number')}
      </div>`;
    },
    ref(f, v, ctx) {
      const cols = COLS(f);
      const hit = v ? findAny(cols, v) : null;
      return `<div class="ed-ref-row">
        <button type="button" class="ed-ref" data-act="pick-ref" data-path="${esc(ctx.fpath)}">
          ${hit ? `<span class="ed-ref-thumb">${thumbOf(hit.col, hit.e, 26)}</span><span class="ed-ref-name">${esc(hit.e.name || hit.e.title || v)}</span>`
            : v ? `<span class="ed-ref-name is-bad">${esc(v)} (no existe)</span>`
            : `<span class="ed-ref-name ed-dim">${esc(f.none || 'Elegir…')}</span>`}
          <span class="ed-ref-caret">${icon('search', 14)}</span>
        </button>
        ${v && f.none !== undefined ? `<button type="button" class="ed-mini" data-act="clear" data-path="${esc(ctx.fpath)}" title="Sacar">${icon('close', 12)}</button>` : ''}
      </div>`;
    },
    refs(f, v, ctx) {
      const cols = COLS(f);
      const list = Array.isArray(v) ? v : (v ? [v] : []);
      return `<div class="ed-chiplist">
        ${list.map((id) => {
          const hit = findAny(cols, id);
          return `<span class="ed-chip is-on ${hit ? '' : 'is-bad'}">${hit ? thumbOf(hit.col, hit.e, 20) : ''}<span>${esc(hit ? (hit.e.name || hit.e.title) : `${id} (no existe)`)}</span><button type="button" class="ed-chip-x" data-act="remove-ref" data-path="${esc(ctx.fpath)}" data-id="${esc(id)}" title="Sacar">${icon('close', 11)}</button></span>`;
        }).join('')}
        <button type="button" class="ed-chip is-add" data-act="pick-refs" data-path="${esc(ctx.fpath)}">${icon('plus', 13)}<span>${esc(f.add || 'Agregar')}</span></button>
      </div>`;
    },
    tags(f, v, ctx) {
      const opts = optionsOf(f, ctx.draft);
      const list = Array.isArray(v) ? v : [];
      return `<div class="ed-chiplist">
        ${list.map((val) => {
          const o = opts.find((x) => String(x.value) === String(val));
          return `<span class="ed-chip is-on">${o && o.icon ? icon(o.icon, 16) : ''}<span>${esc(o ? o.label : val)}</span><button type="button" class="ed-chip-x" data-act="remove-ref" data-path="${esc(ctx.fpath)}" data-id="${esc(val)}" title="Sacar">${icon('close', 11)}</button></span>`;
        }).join('')}
        <button type="button" class="ed-chip is-add" data-act="pick-tags" data-path="${esc(ctx.fpath)}">${icon('plus', 13)}<span>${esc(f.add || 'Agregar')}</span></button>
      </div>`;
    },
    chips(f, v, ctx) {
      const opts = optionsOf(f, ctx.draft);
      const list = Array.isArray(v) ? v : [];
      return `<div class="ed-chiplist">
        ${opts.map((o) => {
          const on = list.map(String).includes(String(o.value));
          return `<button type="button" class="ed-chip ${on ? 'is-on' : ''}" data-act="toggle-chip" data-path="${esc(ctx.fpath)}" data-value="${esc(o.value)}">${o.icon ? icon(o.icon, 16) : ''}<span>${esc(o.label)}</span></button>`;
        }).join('')}
      </div>`;
    },
    lines(f, v, ctx) {
      const list = Array.isArray(v) ? v : [];
      return `<div class="ed-lines">
        ${list.map((line, i) => {
          reg.set(`${ctx.fpath}.${i}`, { f: { kind: 'text' }, ctx });
          return `<div class="ed-line"><input class="ed-in" type="text" ${attrs({ 'data-f': `${ctx.fpath}.${i}`, 'data-k': 'text', 'data-keep': '1', value: line == null ? '' : line, maxlength: 300, placeholder: f.placeholder })}><button type="button" class="ed-mini" data-act="list-del" data-path="${esc(ctx.fpath)}" data-i="${i}" title="Sacar">${icon('trash', 14)}</button></div>`;
        }).join('')}
        <button type="button" class="ed-btn is-small" data-act="lines-add" data-path="${esc(ctx.fpath)}">${icon('plus', 14)}<span>${esc(f.add || 'Agregar línea')}</span></button>
      </div>`;
    },
    list(f, v, ctx) {
      const list = Array.isArray(v) ? v : [];
      const items = list.map((it, i) => {
        const ipath = `${ctx.fpath}.${i}`;
        const title = f.itemTitle ? f.itemTitle(it || {}, i, ctx.draft) : `${f.one || 'Elemento'} ${i + 1}`;
        return `<div class="ed-item">
          <div class="ed-item-head">
            ${f.itemThumb ? `<span class="ed-item-thumb">${f.itemThumb(it || {}, i, ctx.draft)}</span>` : ''}
            <span class="ed-item-title">${title}</span>
            <span class="ed-item-tools">
              ${i > 0 ? `<button type="button" class="ed-mini" data-act="list-up" data-path="${esc(ctx.fpath)}" data-i="${i}" title="Subir">${icon('arrow-up', 13)}</button>` : ''}
              ${i < list.length - 1 ? `<button type="button" class="ed-mini" data-act="list-down" data-path="${esc(ctx.fpath)}" data-i="${i}" title="Bajar">${icon('arrow-down', 13)}</button>` : ''}
              <button type="button" class="ed-mini" data-act="list-del" data-path="${esc(ctx.fpath)}" data-i="${i}" title="Sacar">${icon('trash', 14)}</button>
            </span>
          </div>
          <div class="ed-grid is-tight">${renderFields(f.item, { ...ctx, path: ipath, inList: true })}</div>
        </div>`;
      }).join('');
      const full = f.max && list.length >= f.max;
      return `<div class="ed-list">
        ${items || `<div class="ed-empty is-small">${esc(f.empty || 'Todavía no hay ninguno.')}</div>`}
        ${full ? '' : `<button type="button" class="ed-btn is-small" data-act="list-add" data-path="${esc(ctx.fpath)}">${icon('plus', 14)}<span>${esc(f.add || 'Agregar')}</span></button>`}
      </div>`;
    },
    group(f, v, ctx) {
      return `<div class="ed-grid is-tight ${f.label ? 'is-group' : ''}">${renderFields(f.fields, { ...ctx, path: ctx.fpath })}</div>`;
    },
    choice(f, v, ctx) {
      const all = choiceOptions(f, ctx.draft);
      const cur = all.find((o) => String(o.value) === String(v == null ? '' : v));
      return `<button type="button" class="ed-ref is-choice" data-act="pick-choice" data-path="${esc(ctx.fpath)}">
        <span class="ed-ref-thumb">${cur ? cur.thumb : icon('question', 26)}</span>
        <span class="ed-ref-name">${esc(cur ? cur.label : (v || f.none || 'Elegir…'))}</span>
        <span class="ed-ref-caret">${icon('search', 14)}</span>
      </button>`;
    },
    present(f, v, ctx) {
      return `<label class="ed-switch">
        <input type="checkbox" ${attrs({ 'data-f': ctx.fpath, 'data-k': 'present', checked: !!v })}>
        <span class="ed-switch-ui"></span>
        <span class="ed-switch-text">${esc(v ? (f.on || 'Sí') : (f.off || 'No'))}</span>
      </label>`;
    },
    mapselect(f, v, ctx) {
      const cur = f.fromValue ? f.fromValue(v) : v;
      return `<select class="ed-in ed-select" ${attrs({ 'data-f': ctx.fpath, 'data-k': 'mapselect' })}>
        ${(f.options || []).map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(cur == null ? '' : cur) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
      </select>`;
    },
    icon(f, v, ctx) {
      return `<button type="button" class="ed-ref is-icon" data-act="pick-icon" data-path="${esc(ctx.fpath)}">
        <span class="ed-ref-thumb">${icon(v || f.auto || 'scroll', 26)}</span><span class="ed-ref-name">${esc(v || 'Elegir…')}</span><span class="ed-ref-caret">${icon('search', 14)}</span>
      </button>`;
    },
    custom(f, v, ctx) {
      const key = f.live ? addLive(`custom:${f.key || f.label}`, (d) => f.render(d, ctx), f.heavy) : null;
      return `<div class="ed-custom" ${key ? `data-live="${esc(key)}"` : ''}>${f.render(ctx.draft, ctx)}</div>`;
    },
  };

  /** Opciones de un campo "choice" con su dibujito. */
  function choiceOptions(f, draft) {
    const list = optionsOf(f, draft).map((o) => {
      let thumb = '';
      try {
        if (f.thumbs === 'shape') thumb = A.Sprites.html({ ...(draft || {}), sprite: { ...((draft && draft.sprite) || {}), t: o.value || undefined } }, { size: 36 });
        else if (f.thumbs === 'look') thumb = A.Sprites.npcHtml({ ...(draft || {}), look: o.value || undefined }, { size: 36 });
        else if (o.icon) thumb = icon(o.icon, 30);
      } catch (err) { thumb = ''; }
      return { ...o, thumb };
    });
    if (f.none !== undefined && !list.some((o) => o.value === '')) {
      let thumb = '';
      try {
        if (f.thumbs === 'shape') thumb = A.Sprites.html({ ...(draft || {}), sprite: { ...((draft && draft.sprite) || {}), t: undefined } }, { size: 36 });
      } catch (err) { thumb = ''; }
      list.unshift({ value: '', label: f.none, thumb });
    }
    return list;
  }

  function numberBox(f, shown, path, kind) {
    return `<div class="ed-num">
      <button type="button" class="ed-step" data-act="step" data-path="${esc(path)}" data-d="-1" tabindex="-1" aria-label="Menos">−</button>
      <input class="ed-in" type="number" inputmode="decimal" ${attrs({ 'data-f': path, 'data-k': kind, min: f.min, max: f.max, step: f.step || 1, value: shown, 'data-empty': f.required ? null : 'none' })}>
      <button type="button" class="ed-step" data-act="step" data-path="${esc(path)}" data-d="1" tabindex="-1" aria-label="Más">+</button>
      ${f.unit ? `<span class="ed-unit">${esc(f.unit)}</span>` : ''}
    </div>`;
  }

  // ============================================================
  // Leer lo que se escribe
  // ============================================================

  function readInput(el) {
    const k = el.dataset.k;
    if (k === 'toggle') return !!el.checked;
    const raw = el.value;
    if (k === 'number' || k === 'percent') {
      if (raw === '' || raw == null) return el.dataset.empty === 'none' ? undefined : 0;
      let n = Number(String(raw).replace(',', '.'));
      if (!Number.isFinite(n)) return undefined;
      if (k === 'percent') n = Math.round(n * 10) / 1000;
      return n;
    }
    if (k === 'select') {
      if (raw === '') return undefined;
      return el.dataset.num ? Number(raw) : raw;
    }
    if (k === 'dice') {
      const t = String(raw).trim().replace(/\s+/g, '').toLowerCase();
      if (!t) return undefined;
      return /^\d+$/.test(t) ? Number(t) : t;
    }
    if (raw === '' && el.dataset.empty === 'none' && !el.dataset.keep) return undefined;
    return raw;
  }

  /** Aplica una entrada al borrador. Devuelve true si cambió algo. */
  function applyInput(S, el) {
    const path = el.dataset.f;
    if (!path || !S.draft) return false;
    const entry0 = reg.get(path);
    if (el.dataset.k === 'present') {
      const has = !!getPath(S.draft, path);
      if (el.checked === has) return false;
      setPath(S.draft, path, el.checked ? (entry0 && entry0.f.make ? entry0.f.make(S.draft) : {}) : undefined);
      return true;
    }
    if (el.dataset.k === 'mapselect') {
      const f = entry0 ? entry0.f : {};
      setPath(S.draft, path, f.toValue ? f.toValue(el.value) : el.value);
      return true;
    }
    const v = readInput(el);
    const before = getPath(S.draft, path);
    if (same(before, v) && typeof before === typeof v) return false;
    setPath(S.draft, path, v);
    if (el.dataset.k === 'toggle') {
      const lab = el.closest('.ed-switch');
      const entry = reg.get(path);
      if (lab && entry) lab.querySelector('.ed-switch-text').textContent = v ? (entry.f.on || 'Sí') : (entry.f.off || 'No');
    }
    return true;
  }

  /** Marca/desmarca "cambiado" en los campos que contienen al elemento. */
  function refreshChanged(S, el) {
    if (!S.base) return;
    let node = el.closest('[data-field]');
    while (node) {
      if (node.dataset.revertable) {
        const p = node.dataset.field;
        node.classList.toggle('is-changed', !same(getPath(S.draft, p), getPath(S.base, p)));
      }
      node = node.parentElement ? node.parentElement.closest('[data-field]') : null;
    }
  }

  let heavyTimer = null;
  function refreshLive(root, S, onlyLight) {
    if (!root || !S.draft) return;
    root.querySelectorAll('[data-live]').forEach((el) => {
      const entry = live.get(el.dataset.live);
      if (!entry) return;
      if (entry.heavy) {
        if (onlyLight) return;
        clearTimeout(heavyTimer);
        heavyTimer = setTimeout(() => { try { el.innerHTML = entry.fn(S.draft); } catch (err) { console.warn('[Editor]', err); } }, 350);
        return;
      }
      try { el.innerHTML = entry.fn(S.draft); } catch (err) { console.warn('[Editor]', err); }
    });
  }

  // ============================================================
  // Botones de los campos (listas, elegir, volver al original...)
  // ============================================================

  /** Devuelve una promesa: true si hay que redibujar la ficha. */
  async function handleAct(S, btn) {
    const act = btn.dataset.act;
    const path = btn.dataset.path;
    const entry = path ? reg.get(path) : null;
    const f = entry ? entry.f : null;
    const draft = S.draft;
    if (!draft) return false;

    if (act === 'step') {
      const wrap = btn.closest('.ed-num');
      const input = wrap && wrap.querySelector('input');
      if (!input) return false;
      const step = Number(input.step) || 1;
      let n = Number(String(input.value || '0').replace(',', '.')) || 0;
      n = Math.round((n + step * Number(btn.dataset.d)) * 100) / 100;
      if (input.min !== '' && n < Number(input.min)) n = Number(input.min);
      if (input.max !== '' && n > Number(input.max)) n = Number(input.max);
      input.value = n;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return false;
    }
    if (act === 'clear') { setPath(draft, path, undefined); return true; }
    if (act === 'revert-field') { setPath(draft, path, clone(getPath(S.base, path))); return true; }

    if (act === 'pick-ref' && f) {
      const v = await Ed.ui.pick({ title: f.pickTitle || `Elegí: ${f.label || ''}`, options: refOptions(f, draft), allowNone: f.none !== undefined, noneLabel: f.none || 'Ninguno', selected: [getPath(draft, path)] });
      if (v === null) return false;
      setPath(draft, path, v === '' ? undefined : v);
      if (f.onPick) f.onPick(draft, v);
      return true;
    }
    if ((act === 'pick-refs' || act === 'pick-tags') && f) {
      const cur = getPath(draft, path);
      const list = Array.isArray(cur) ? cur : (cur ? [cur] : []);
      const options = act === 'pick-tags'
        ? optionsOf(f, draft).map((o) => ({ value: String(o.value), label: o.label, thumb: o.icon ? icon(o.icon, 24) : '', meta: o.meta || '' }))
        : refOptions(f, draft);
      const v = await Ed.ui.pick({ title: f.pickTitle || `Elegí: ${f.label || ''}`, options, multi: true, selected: list.map(String) });
      if (v === null) return false;
      setPath(draft, path, f.single && v.length === 1 ? v[0] : v);
      return true;
    }
    if (act === 'remove-ref') {
      const cur = getPath(draft, path);
      const list = (Array.isArray(cur) ? cur : (cur ? [cur] : [])).filter((x) => String(x) !== String(btn.dataset.id));
      setPath(draft, path, f && f.single && list.length === 1 ? list[0] : list);
      return true;
    }
    if (act === 'toggle-chip') {
      const cur = getPath(draft, path);
      const list = Array.isArray(cur) ? cur.slice() : [];
      const raw = btn.dataset.value;
      const opt = f ? optionsOf(f, draft).find((o) => String(o.value) === raw) : null;
      const val = opt ? opt.value : raw;
      const i = list.map(String).indexOf(raw);
      if (i >= 0) list.splice(i, 1); else list.push(val);
      if (f && f.exclusive && f.exclusive.includes(String(val)) && i < 0) list.splice(0, list.length, val);
      else if (f && f.exclusive) for (const x of f.exclusive) { const j = list.map(String).indexOf(x); if (j >= 0 && list.length > 1) list.splice(j, 1); }
      setPath(draft, path, list);
      return true;
    }
    if (act === 'lines-add') {
      const cur = getPath(draft, path);
      const list = Array.isArray(cur) ? cur.slice() : [];
      list.push('');
      setPath(draft, path, list);
      return true;
    }
    if (act === 'list-add' && f) {
      const cur = getPath(draft, path);
      const list = Array.isArray(cur) ? cur.slice() : [];
      let item = f.newItem ? f.newItem(draft) : {};
      if (item && typeof item.then === 'function') item = await item;
      if (!item) return false;
      list.push(item);
      setPath(draft, path, list);
      return true;
    }
    if (act === 'list-del' || act === 'list-up' || act === 'list-down') {
      const cur = getPath(draft, path);
      const list = Array.isArray(cur) ? cur.slice() : [];
      const i = Number(btn.dataset.i);
      if (act === 'list-del') list.splice(i, 1);
      if (act === 'list-up' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
      if (act === 'list-down' && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
      setPath(draft, path, list);
      return true;
    }
    if (act === 'pick-choice' && f) {
      const all = choiceOptions(f, draft);
      const v = await Ed.ui.pick({ title: `Elegí: ${f.label || ''}`, grid: true, options: all.map((o) => ({ value: String(o.value), label: o.label, thumb: o.thumb })) });
      if (v === null) return false;
      const o = all.find((x) => String(x.value) === v);
      setPath(draft, path, v === '' ? undefined : (o ? o.value : v));
      return true;
    }
    if (act === 'pick-icon' && f) {
      const names = typeof f.options === 'function' ? f.options(draft) : (f.options || (A.ItemSprites ? A.ItemSprites.ICONS : []));
      const v = await Ed.ui.pick({ title: 'Elegí un dibujo', grid: true, options: names.map((n) => ({ value: n, label: n, thumb: icon(n, 32) })) });
      if (v === null) return false;
      setPath(draft, path, v || undefined);
      return true;
    }
    return false;
  }

  Ed.fields = {
    renderFields, resetRegistry, addLive, applyInput, refreshChanged, refreshLive, handleAct,
    thumbOf, nameOf, findAny, diceText, optionsOf, refOptions, COL_LABEL,
  };
})(window.Aventurs);
