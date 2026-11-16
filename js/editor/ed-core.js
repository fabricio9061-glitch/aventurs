/* ============================================================
   Aventurs — Editor v2.2: núcleo

   - Utilidades (rutas "a.b.0.c", copias, comparación estable)
   - Guardado por PARCHES: de cada cosa se guarda solo lo que
     cambiaste respecto del juego. Lo que no tocaste se sigue
     actualizando con cada versión nueva.
   - Lista de cambios (para la pantalla "Cambios")
   - Ventanitas propias: aviso, confirmar y elegir de una lista
     (sin alert/confirm del navegador)
   ============================================================ */

(function (A) {
  'use strict';

  const Ed = (A.Ed = A.Ed || {});

  // ============================================================
  // Utilidades
  // ============================================================

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));

  /** JSON con las claves ordenadas: dos objetos iguales dan el mismo texto. */
  function stable(v) {
    if (v === undefined || v === null) return 'null';
    if (typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
    return `{${Object.keys(v).filter((k) => v[k] !== undefined && v[k] !== null).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  }
  const same = (a, b) => stable(a) === stable(b);

  function parts(path) { return String(path == null ? '' : path).split('.').filter((x) => x !== ''); }
  function join(a, b) { return [a, b].filter((x) => x !== undefined && x !== null && x !== '').join('.'); }

  function getPath(obj, path) {
    let o = obj;
    for (const k of parts(path)) {
      if (o == null) return undefined;
      o = o[k];
    }
    return o;
  }

  function setPath(obj, path, value) {
    const ks = parts(path);
    if (!ks.length) return;
    let o = obj;
    for (let i = 0; i < ks.length - 1; i++) {
      const k = ks[i];
      if (o[k] == null || typeof o[k] !== 'object') o[k] = /^\d+$/.test(ks[i + 1]) ? [] : {};
      o = o[k];
    }
    const last = ks[ks.length - 1];
    if (value === undefined) {
      if (Array.isArray(o)) o[last] = undefined;
      else delete o[last];
    } else {
      o[last] = value;
    }
  }

  function slug(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'nuevo';
  }

  function icon(name, size, cls) {
    return A.ItemSprites ? A.ItemSprites.icon(name, { size: size || 18, cls }) : '';
  }

  /** Texto corto de un valor (para "Volver a: ..."). */
  function short(v) {
    if (v === undefined || v === null || v === '') return 'vacío';
    if (typeof v === 'boolean') return v ? 'sí' : 'no';
    if (Array.isArray(v)) return v.length ? `${v.length} cosa${v.length === 1 ? '' : 's'}` : 'ninguna';
    if (typeof v === 'object') return 'lo del juego';
    const s = String(v);
    return s.length > 40 ? `${s.slice(0, 38)}…` : s;
  }

  // ============================================================
  // Guardado por parches
  // ============================================================

  const META = ['_source', '_patched'];

  function cleanEntity(e) {
    const c = clone(e) || {};
    for (const k of META) delete c[k];
    return c;
  }

  function overrides() {
    const o = A.Data.getOverrides() || {};
    return typeof o === 'object' ? o : {};
  }

  /** La versión del juego (sin cambios del editor). */
  function seedOf(col, id) { return A.Data.seedOf ? A.Data.seedOf(col, id) : null; }
  function overrideOf(col, id) { return (overrides()[col] || []).find((e) => e.id === id) || null; }
  function isNew(col, id) { return !seedOf(col, id); }
  function isDeleted(col, id) { return (((overrides()._deleted || {})[col]) || []).includes(id); }

  /** Lo distinto entre la versión del juego y la tuya ({ campo: valor }; null = sacar el campo). */
  function diff(base, draft) {
    const out = {};
    const keys = new Set([...Object.keys(base || {}), ...Object.keys(draft || {})]);
    for (const k of keys) {
      if (k === 'id' || META.includes(k)) continue;
      const a = base ? base[k] : undefined;
      const b = draft ? draft[k] : undefined;
      if (!same(a, b)) out[k] = b === undefined ? null : clone(b);
    }
    return out;
  }

  /** Campos cambiados de una cosa (contra la versión del juego). */
  function changedKeys(col, id) {
    const base = seedOf(col, id);
    const cur = A.Data.getById(col, id);
    if (!cur) return [];
    if (!base) return Object.keys(cleanEntity(cur)).filter((k) => k !== 'id');
    return Object.keys(diff(cleanEntity(base), cleanEntity(cur)));
  }

  function writeOverrides(o) {
    o._format = 2;
    for (const k of Object.keys(o)) {
      if (Array.isArray(o[k]) && !o[k].length) delete o[k];
    }
    if (o._deleted) {
      for (const k of Object.keys(o._deleted)) if (!o._deleted[k] || !o._deleted[k].length) delete o._deleted[k];
      if (!Object.keys(o._deleted).length) delete o._deleted;
    }
    A.Data.saveOverrides(o);
    A.Data.init();
    if (A.Sprites && A.Sprites.clearCache) A.Sprites.clearCache();
    A.Bus.emit('editor:content-changed', {});
  }

  /**
   * Guarda una o varias cosas. changes: [{ col, entity }].
   * De lo que existe en el juego se guarda solo la diferencia.
   */
  function commit(changes) {
    const o = overrides();
    for (const { col, entity } of changes) {
      if (!entity || !entity.id) continue;
      const id = entity.id;
      o[col] = (o[col] || []).filter((e) => e.id !== id);
      const base = seedOf(col, id);
      if (base) {
        const patch = diff(cleanEntity(base), cleanEntity(entity));
        if (Object.keys(patch).length) o[col].push({ id, ...patch });
      } else {
        o[col].push(cleanEntity(entity));
      }
      if (o._deleted && o._deleted[col]) o._deleted[col] = o._deleted[col].filter((x) => x !== id);
    }
    writeOverrides(o);
  }

  /** Volver una cosa a como viene en el juego. */
  function revert(col, id) {
    const o = overrides();
    o[col] = (o[col] || []).filter((e) => e.id !== id);
    writeOverrides(o);
  }

  /** Volver UN campo a como viene en el juego. */
  function revertField(col, id, key) {
    const cur = A.Data.getById(col, id);
    const base = seedOf(col, id);
    if (!cur || !base) return;
    const next = cleanEntity(cur);
    if (base[key] === undefined) delete next[key];
    else next[key] = clone(base[key]);
    commit([{ col, entity: next }]);
  }

  /** Borrar: lo nuevo se borra; lo del juego queda oculto (se puede recuperar). */
  function remove(col, id) {
    const o = overrides();
    o[col] = (o[col] || []).filter((e) => e.id !== id);
    if (seedOf(col, id)) {
      o._deleted = o._deleted || {};
      o._deleted[col] = Array.from(new Set([...(o._deleted[col] || []), id]));
    }
    writeOverrides(o);
  }

  function restore(col, id) {
    const o = overrides();
    if (o._deleted && o._deleted[col]) o._deleted[col] = o._deleted[col].filter((x) => x !== id);
    writeOverrides(o);
  }

  function resetAll() { writeOverrides({}); }

  /** Saca los cambios que en realidad son iguales al juego (copias viejas sin diferencias). */
  function tidy() {
    const o = overrides();
    let dirty = false;
    for (const col of A.Data.COLLECTIONS) {
      const list = o[col];
      if (!Array.isArray(list)) continue;
      const keep = list.filter((e) => {
        const base = seedOf(col, e.id);
        if (!base) return true;
        const merged = { ...cleanEntity(base), ...e };
        for (const k of Object.keys(e)) if (e[k] === null) delete merged[k];
        return Object.keys(diff(cleanEntity(base), merged)).length > 0;
      });
      if (keep.length !== list.length) { o[col] = keep; dirty = true; }
    }
    if (dirty) writeOverrides(o);
    return dirty;
  }

  /** ¿Hay cambios del editor viejo (copias completas)? */
  function hasLegacy() {
    const o = overrides();
    if (o._format === 2) return false;
    return A.Data.COLLECTIONS.some((col) => Array.isArray(o[col]) && o[col].length > 0);
  }

  /** Todos los cambios: [{ col, id, kind: 'new'|'mod'|'deleted', keys }] */
  function changes() {
    const o = overrides();
    const out = [];
    for (const col of A.Data.COLLECTIONS) {
      for (const e of o[col] || []) {
        if (!e || !e.id) continue;
        if (isNew(col, e.id)) out.push({ col, id: e.id, kind: 'new', keys: [] });
        else {
          const keys = changedKeys(col, e.id);
          if (keys.length) out.push({ col, id: e.id, kind: 'mod', keys });
        }
      }
      for (const id of ((o._deleted || {})[col]) || []) out.push({ col, id, kind: 'deleted', keys: [] });
    }
    return out;
  }

  function uniqueId(col, base) {
    const root = slug(base);
    const taken = (x) => !!A.Data.getById(col, x) || !!seedOf(col, x) || isDeleted(col, x);
    if (!taken(root)) return root;
    let n = 2;
    while (taken(`${root}_${n}`)) n++;
    return `${root}_${n}`;
  }

  // ============================================================
  // Ventanitas propias (dentro del editor)
  // ============================================================

  let layerEl = null;
  function layer() {
    if (layerEl && document.body.contains(layerEl)) return layerEl;
    layerEl = document.createElement('div');
    layerEl.className = 'ed-layer';
    document.body.appendChild(layerEl);
    return layerEl;
  }
  function clearLayer() { if (layerEl) layerEl.innerHTML = ''; }

  let toastTimer = null;
  function toast(text, kind) {
    const L = layer();
    let el = L.querySelector('.ed-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'ed-toast';
      L.appendChild(el);
    }
    el.className = `ed-toast is-${kind || 'ok'} is-on`;
    el.innerHTML = `${icon(kind === 'bad' ? 'warning' : 'check', 18)}<span>${esc(text)}</span>`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
  }

  /** Abre una ventanita. Devuelve el elemento y una función para cerrarla. */
  function dialog(html, opts = {}) {
    const L = layer();
    const wrap = document.createElement('div');
    wrap.className = `ed-dialog-wrap ${opts.cls || ''}`;
    wrap.innerHTML = `<div class="ed-dialog" role="dialog" aria-modal="true">${html}</div>`;
    L.appendChild(wrap);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      wrap.remove();
      document.removeEventListener('keydown', onKey, true);
      if (opts.onClose) opts.onClose();
    };
    const onKey = (ev) => {
      if (ev.key === 'Escape') { ev.stopPropagation(); ev.preventDefault(); close(); }
    };
    document.addEventListener('keydown', onKey, true);
    wrap.addEventListener('mousedown', (ev) => { if (ev.target === wrap) close(); });
    return { el: wrap, close };
  }

  /** Confirmar: devuelve una promesa con true/false (o la opción elegida). */
  function confirmBox({ title, text, ok = 'Aceptar', cancel = 'Cancelar', danger = false, options = null }) {
    return new Promise((resolve) => {
      let answered = false;
      const btns = options
        ? options.map((o) => `<button type="button" class="ed-btn ${o.primary ? 'is-primary' : ''} ${o.danger ? 'is-danger' : ''}" data-answer="${esc(o.value)}">${esc(o.label)}</button>`).join('')
        : `<button type="button" class="ed-btn" data-answer="">${esc(cancel)}</button><button type="button" class="ed-btn ${danger ? 'is-danger' : 'is-primary'}" data-answer="ok">${esc(ok)}</button>`;
      const d = dialog(`
        <div class="ed-dialog-head">${esc(title || '¿Seguro?')}</div>
        ${text ? `<div class="ed-dialog-text">${text}</div>` : ''}
        <div class="ed-dialog-actions">${options ? `<button type="button" class="ed-btn is-ghost" data-answer="">${esc(cancel)}</button>` : ''}${btns}</div>`,
      { onClose: () => { if (!answered) resolve(options ? null : false); } });
      d.el.querySelectorAll('[data-answer]').forEach((b) => b.addEventListener('click', () => {
        answered = true;
        const v = b.dataset.answer;
        d.close();
        resolve(options ? (v || null) : v === 'ok');
      }));
      const first = d.el.querySelector('.is-primary, .is-danger');
      if (first) first.focus();
    });
  }

  /**
   * Elegir de una lista con buscador.
   * options: [{ value, label, thumb, meta, group }]
   * Devuelve una promesa con el valor (o la lista si multi), o null si se cancela.
   */
  function pick({ title, options, multi = false, selected = [], allowNone = false, noneLabel = 'Ninguno', grid = false }) {
    return new Promise((resolve) => {
      const chosen = new Set(selected || []);
      let answered = false;
      const d = dialog(`
        <div class="ed-dialog-head">${esc(title || 'Elegí')}</div>
        <div class="ed-pick-search">${icon('search', 18)}<input type="search" class="ed-in" placeholder="Buscar…" autocomplete="off"></div>
        <div class="ed-pick-list ${grid ? 'is-grid' : ''}" tabindex="-1"></div>
        <div class="ed-dialog-actions">
          ${allowNone && !multi ? `<button type="button" class="ed-btn is-ghost" data-none>${esc(noneLabel)}</button>` : ''}
          <button type="button" class="ed-btn" data-cancel>Cancelar</button>
          ${multi ? '<button type="button" class="ed-btn is-primary" data-done>Listo</button>' : ''}
        </div>`, { cls: 'is-pick', onClose: () => { if (!answered) resolve(null); } });
      const listEl = d.el.querySelector('.ed-pick-list');
      const input = d.el.querySelector('input');
      const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const draw = () => {
        const q = norm(input.value.trim());
        const rows = options.filter((o) => !q || norm(`${o.label} ${o.meta || ''} ${o.value}`).includes(q));
        let lastGroup = null;
        listEl.innerHTML = rows.length ? rows.slice(0, 400).map((o) => {
          const head = o.group && o.group !== lastGroup ? `<div class="ed-pick-group">${esc(o.group)}</div>` : '';
          lastGroup = o.group || lastGroup;
          const on = chosen.has(o.value);
          return `${head}<button type="button" class="ed-pick-row ${on ? 'is-on' : ''}" data-value="${esc(o.value)}">
            ${o.thumb ? `<span class="ed-pick-thumb">${o.thumb}</span>` : ''}
            <span class="ed-pick-text"><b>${esc(o.label)}</b>${o.meta ? `<small>${esc(o.meta)}</small>` : ''}</span>
            ${multi ? `<span class="ed-pick-check">${on ? icon('check', 16) : ''}</span>` : ''}
          </button>`;
        }).join('') : '<div class="ed-empty">No hay nada con ese nombre.</div>';
      };
      draw();
      input.addEventListener('input', draw);
      listEl.addEventListener('click', (ev) => {
        const row = ev.target.closest('[data-value]');
        if (!row) return;
        const v = row.dataset.value;
        if (multi) {
          if (chosen.has(v)) chosen.delete(v); else chosen.add(v);
          draw();
        } else {
          answered = true;
          d.close();
          resolve(v);
        }
      });
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' && !multi) {
          const first = listEl.querySelector('[data-value]');
          if (first) first.click();
        }
      });
      const done = d.el.querySelector('[data-done]');
      if (done) done.addEventListener('click', () => { answered = true; d.close(); resolve(Array.from(chosen)); });
      d.el.querySelector('[data-cancel]').addEventListener('click', () => d.close());
      const none = d.el.querySelector('[data-none]');
      if (none) none.addEventListener('click', () => { answered = true; d.close(); resolve(''); });
      setTimeout(() => input.focus(), 30);
    });
  }

  Ed.util = { esc, clone, stable, same, parts, join, getPath, setPath, slug, icon, short };
  Ed.store = {
    seedOf, overrideOf, isNew, isDeleted, diff, changedKeys, cleanEntity,
    commit, revert, revertField, remove, restore, resetAll, tidy, hasLegacy, changes, uniqueId, overrides,
  };
  Ed.ui = { toast, dialog, confirmBox, pick, clearLayer, layer };
})(window.Aventurs);
