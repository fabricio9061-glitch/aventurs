/* ============================================================
   Aventurs — Editor v2.2: la pantalla

   Tres columnas en la compu (tipos · lista · ficha) y una por vez
   en el celular. Arriba: buscar en todo, Mapa, Cambios, Revisar,
   Exportar e Importar.

   La ficha trabaja sobre un BORRADOR: nada toca el juego hasta que
   tocás Guardar (o Ctrl+S). Descartar vuelve a lo guardado.
   ============================================================ */

(function (A) {
  'use strict';

  const Ed = (A.Ed = A.Ed || {});
  const { esc, clone, same, getPath, icon } = Ed.util;
  const store = Ed.store;
  const ui = Ed.ui;
  const fields = Ed.fields;
  const schema = Ed.schema;

  const S = {
    host: null,
    view: 'browse',       // browse | changes | check | map
    type: 'regions',
    id: null,
    draft: null,          // la ficha abierta (copia de trabajo)
    base: null,           // la versión del juego (para "Original")
    saved: null,          // lo guardado (para saber si hay cambios)
    isNew: false,
    related: {},          // cambios en otras cosas que se guardan juntos: { enemies: { id: entidad } }
    search: '',
    globalQ: '',
    filters: {},
    screen: 'types',      // celular: types | list | detail
    simLevel: {},
    suggest: {},
    mapSel: null,
    mapRoads: false,
    mapPlacing: false,
    mapUndo: null,
  };

  const T = () => schema.byKey[S.type];
  const isDirty = () => !!S.draft && (S.isNew || !same(S.draft, S.saved) || Object.keys(S.related).some((k) => Object.keys(S.related[k] || {}).length));

  // ============================================================
  // Montar / desmontar
  // ============================================================

  function mount(container) {
    // v3.0: el editor es solo de la cuenta del dueño
    if (A.Accounts && A.Accounts.canEdit && !A.Accounts.canEdit()) return;
    try {
      if (A.Views.Combat && A.Views.Combat.isMounted && A.Views.Combat.isMounted()) A.Views.Combat.unmount();
      if (A.Views.Shell && A.Views.Shell.unmount) A.Views.Shell.unmount();
    } catch (err) { console.warn('[Editor]', err); }
    S.host = container;
    S.view = 'browse';
    S.draft = null;
    S.id = null;
    S.related = {};
    S.screen = 'types';
    S.globalQ = '';
    store.tidy();
    container.innerHTML = '';
    container.addEventListener('click', onClick);
    container.addEventListener('input', onInput);
    container.addEventListener('change', onChange);
    container.addEventListener('scroll', onAppScroll, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onBeforeUnload);
    A.Bus.emit('editor:opened');
    render();
  }

  function unmount() {
    if (!S.host) return;
    const host = S.host;
    host.removeEventListener('click', onClick);
    host.removeEventListener('input', onInput);
    host.removeEventListener('change', onChange);
    host.removeEventListener('scroll', onAppScroll, true);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('beforeunload', onBeforeUnload);
    ui.clearLayer();
    A.Data.init();
    A.Bus.emit('editor:content-changed', {});
    host.innerHTML = '';
    S.host = null;
    S.draft = null;
    A.Bus.emit('editor:closed');
    return host;
  }

  /** v2.3: la pantalla del editor nunca se corre entera (si pasa, queda todo negro). */
  function onAppScroll(ev) {
    const el = ev.target;
    if (el && el.classList && el.classList.contains('ed-app') && (el.scrollTop || el.scrollLeft)) {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    }
  }

  function onBeforeUnload(ev) {
    if (isDirty()) { ev.preventDefault(); ev.returnValue = ''; }
  }

  async function exit() {
    if (isDirty()) {
      const ok = await ui.confirmBox({ title: 'Tenés cambios sin guardar', text: 'Si salís ahora se pierden.', ok: 'Salir igual', danger: true });
      if (!ok) return;
    }
    const host = unmount();
    if (!host) return;
    if (A.State.hasGame()) A.Views.Shell.mount(host);
    else A.Views.Character.mount(host);
  }

  // ============================================================
  // Dibujar
  // ============================================================

  function render() {
    if (!S.host) return;
    const keepList = S.host.querySelector('.ed-list-body');
    const keepDetail = S.host.querySelector('.ed-detail-body');
    const scroll = { list: keepList ? keepList.scrollTop : 0, detail: keepDetail ? keepDetail.scrollTop : 0 };
    fields.resetRegistry();
    const changes = store.changes();
    const issues = safeIssues();
    S.host.innerHTML = `
      <div class="ed-app" data-view="${S.view}" data-screen="${S.screen}">
        ${topBar(changes, issues)}
        <div class="ed-body">
          ${S.view === 'browse' ? navPane() + listPane() + detailPane(issues) : `<main class="ed-wide">${S.view === 'changes' ? changesView(changes) : S.view === 'check' ? checkView(issues) : Ed.map.render(S)}</main>`}
        </div>
      </div>`;
    if (S.view === 'map') Ed.map.bind(S.host, S, render);
    const lb = S.host.querySelector('.ed-list-body');
    const db = S.host.querySelector('.ed-detail-body');
    if (lb) lb.scrollTop = scroll.list;
    if (db) db.scrollTop = scroll.detail;
    autoGrow(S.host);
  }

  function renderDetailOnly() {
    if (!S.host || S.view !== 'browse') return render();
    const pane = S.host.querySelector('.ed-detail');
    if (!pane) return render();
    const body = pane.querySelector('.ed-detail-body');
    const top = body ? body.scrollTop : 0;
    fields.resetRegistry();
    pane.outerHTML = detailPane(safeIssues());
    const nb = S.host.querySelector('.ed-detail-body');
    if (nb) nb.scrollTop = top;
    refreshDirty();
    autoGrow(S.host);
  }

  /** Redibuja solo la lista (al buscar o filtrar): la ficha queda como está. */
  function renderListOnly() {
    if (!S.host || S.view !== 'browse') return render();
    const pane = S.host.querySelector('.ed-listpane');
    const nav = S.host.querySelector('.ed-nav');
    if (!pane) return render();
    pane.outerHTML = listPane();
    if (nav) nav.outerHTML = navPane();
    const app = S.host.querySelector('.ed-app');
    if (app) app.dataset.screen = S.screen;
  }

  function safeIssues() {
    try { return A.Validate ? A.Validate.run({ quiet: true }) : []; } catch (err) { return []; }
  }

  function topBar(changes, issues) {
    const errs = issues.filter((x) => x.level === 'error').length;
    const tool = (v, ic, label, badge, cls = '') => `<button type="button" class="ed-tool ${S.view === v ? 'is-on' : ''} ${cls}" data-ed="view" data-v="${v}" title="${label}">${icon(ic, 18)}<span class="ed-tl">${label}</span>${badge ? `<em>${badge}</em>` : ''}</button>`;
    return `<header class="ed-top">
      <button type="button" class="ed-exit" data-ed="exit" title="Volver al juego">${icon('arrow-left', 16)}<span class="ed-tl">Volver al juego</span></button>
      <div class="ed-brand">${icon('pencil', 22)}<span class="ed-brand-long">Editor del mundo</span><span class="ed-brand-short">Editor</span></div>
      <label class="ed-gsearch">${icon('search', 16)}<input type="search" data-ed-gsearch placeholder="Buscar en todo…" value="${esc(S.globalQ)}" autocomplete="off"></label>
      <nav class="ed-tools">
        ${tool('browse', 'book', 'Fichas')}
        ${tool('map', 'map', 'Mapa')}
        ${tool('changes', 'scroll', 'Cambios', changes.length || '')}
        ${tool('check', 'warning', 'Revisar', errs || '', errs ? 'has-bad' : '')}
        <button type="button" class="ed-tool" data-ed="export" title="Exportar">${icon('download', 18)}<span class="ed-tl">Exportar</span></button>
        <button type="button" class="ed-tool" data-ed="import" title="Importar">${icon('upload', 18)}<span class="ed-tl">Importar</span></button>
      </nav>
    </header>`;
  }

  // ---------- columna 1: tipos ----------

  function navPane() {
    let lastGroup = null;
    const rows = schema.TYPES.map((t) => {
      const head = t.group !== lastGroup ? `<div class="ed-nav-group">${esc(t.group)}</div>` : '';
      lastGroup = t.group;
      const n = (A.Data[t.key] || []).length;
      const mods = store.changes().filter((c) => c.col === t.key).length;
      return `${head}<button type="button" class="ed-nav-item ${S.type === t.key && !S.globalQ ? 'is-on' : ''}" data-ed="type" data-t="${t.key}">
        ${icon(t.icon, 22)}<span class="ed-nav-text"><b>${esc(t.label)}</b><small>${esc(t.hint || '')}</small></span>
        <span class="ed-nav-count">${n}${mods ? `<i title="Con cambios">${mods}</i>` : ''}</span>
      </button>`;
    }).join('');
    return `<aside class="ed-nav">${rows}</aside>`;
  }

  // ---------- columna 2: lista ----------

  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  function listRows(t, list) {
    return list.map((e) => {
      const name = schema.nameOf(t.key, e);
      const isMod = !!store.overrideOf(t.key, e.id);
      const isNew = store.isNew(t.key, e.id);
      const active = S.type === t.key && S.id === e.id;
      return `<button type="button" class="ed-row-item ${active ? 'is-on' : ''}" data-ed="open" data-col="${t.key}" data-id="${esc(e.id)}">
        <span class="ed-row-thumb">${fields.thumbOf(t.key, e, 34)}</span>
        <span class="ed-row-text"><b>${esc(name)}</b><small>${esc(schema.metaOf(t.key, e))}</small></span>
        ${isNew ? '<span class="ed-badge is-new">Nuevo</span>' : isMod ? '<span class="ed-badge is-mod">Cambiado</span>' : ''}
      </button>`;
    }).join('');
  }

  function listPane() {
    if (S.globalQ) return globalList();
    const t = T();
    const q = norm(S.search);
    const f = S.filters[t.key] || {};
    let list = (A.Data[t.key] || []).slice();
    for (const flt of t.filters || []) {
      const v = f[flt.key];
      if (v) list = list.filter((e) => flt.test(e, v));
    }
    if (q) list = list.filter((e) => norm(`${schema.nameOf(t.key, e)} ${e.id} ${schema.metaOf(t.key, e)}`).includes(q));
    if (t.sort) list.sort(t.sort); else list.sort((a, b) => String(schema.nameOf(t.key, a)).localeCompare(String(schema.nameOf(t.key, b)), 'es'));
    const filters = (t.filters || []).map((flt) => {
      const options = typeof flt.options === 'function' ? flt.options() : flt.options;
      return `<select class="ed-in ed-filter" data-ed-filter="${flt.key}">
        <option value="">${esc(flt.label)}: todas</option>
        ${options.map((o) => `<option value="${esc(o.value)}" ${String(f[flt.key] || '') === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
      </select>`;
    }).join('');
    return `<section class="ed-listpane">
      <div class="ed-pane-head">
        <button type="button" class="ed-mob-back" data-ed="screen" data-s="types" aria-label="Volver">${icon('arrow-left', 16)}</button>
        <div class="ed-pane-title">${icon(t.icon, 24)}<span>${esc(t.label)}</span><em>${list.length}</em></div>
        <button type="button" class="ed-btn is-primary is-small" data-ed="new">${icon('plus', 14)}<span>Nueva</span></button>
      </div>
      <div class="ed-list-tools">
        <label class="ed-search">${icon('search', 16)}<input type="search" class="ed-in" data-ed-search placeholder="Buscar ${esc(t.label.toLowerCase())}…" value="${esc(S.search)}" autocomplete="off"></label>
        ${filters ? `<div class="ed-filters">${filters}</div>` : ''}
      </div>
      <div class="ed-list-body">${list.length ? listRows(t, list) : '<div class="ed-empty">No hay nada que coincida.</div>'}</div>
    </section>`;
  }

  function globalList() {
    const q = norm(S.globalQ);
    let total = 0;
    const groups = schema.TYPES.map((t) => {
      const hits = (A.Data[t.key] || []).filter((e) => norm(`${schema.nameOf(t.key, e)} ${e.id}`).includes(q)).slice(0, 30);
      total += hits.length;
      return hits.length ? `<div class="ed-nav-group">${icon(t.icon, 16)} ${esc(t.label)}</div>${listRows(t, hits)}` : '';
    }).join('');
    return `<section class="ed-listpane">
      <div class="ed-pane-head">
        <button type="button" class="ed-mob-back" data-ed="clear-global" aria-label="Volver">${icon('arrow-left', 16)}</button>
        <div class="ed-pane-title">${icon('search', 22)}<span>“${esc(S.globalQ)}”</span><em>${total}</em></div>
        <button type="button" class="ed-btn is-small" data-ed="clear-global">${icon('close', 12)}<span>Limpiar</span></button>
      </div>
      <div class="ed-list-body">${groups || '<div class="ed-empty">No encontré nada con ese nombre.</div>'}</div>
    </section>`;
  }

  // ---------- columna 3: ficha ----------

  function headHtml() {
    const t = T();
    const d = S.draft;
    const name = schema.nameOf(t.key, d) || `${t.one} sin nombre`;
    return `<span class="ed-dh-thumb">${fields.thumbOf(t.key, d, 64)}</span>
      <span class="ed-dh-text"><b>${esc(name)}</b><small>${esc(schema.metaOf(t.key, d))}</small></span>`;
  }

  function detailPane(issues) {
    const t = T();
    if (!S.draft) {
      return `<section class="ed-detail is-empty">
        <div class="ed-pane-head is-mobile-only"><button type="button" class="ed-mob-back" data-ed="screen" data-s="list">${icon('arrow-left', 16)}</button></div>
        <div class="ed-hello">
          ${icon(t.icon, 64)}
          <h2>${esc(t.label)}</h2>
          <p>${esc(t.hint || '')}</p>
          <p class="ed-dim">Elegí una de la lista para verla y cambiarla, o creá una nueva.</p>
          <button type="button" class="ed-btn is-primary" data-ed="new">${icon('plus', 16)}<span>Crear ${esc(t.one)}</span></button>
        </div>
      </section>`;
    }
    const d = S.draft;
    const isMod = !S.isNew && !!store.overrideOf(t.key, d.id);
    const mine = issues.filter((x) => x.collection === t.key && x.entityId === d.id);
    const ctx = { draft: d, base: S.isNew ? null : S.base, path: '', col: t.key };
    const sections = t.sections.filter((sec) => !sec.when || sec.when(d)).map((sec) => `
      <section class="ed-card">
        ${sec.title ? `<h3 class="ed-card-title">${esc(sec.title)}</h3>` : ''}
        ${sec.help ? `<p class="ed-card-help">${esc(sec.help)}</p>` : ''}
        <div class="ed-grid">${fields.renderFields(sec.fields, ctx)}</div>
      </section>`).join('');
    const dirty = isDirty();
    const headKey = fields.addLive('head', () => headHtml());
    return `<section class="ed-detail">
      <div class="ed-detail-head">
        <button type="button" class="ed-mob-back" data-ed="screen" data-s="list" aria-label="Volver">${icon('arrow-left', 16)}</button>
        <div class="ed-dh" data-live="${headKey}">${headHtml()}</div>
        <div class="ed-dh-badges">
          ${S.isNew ? '<span class="ed-badge is-new">Nueva, sin guardar</span>' : isMod ? '<span class="ed-badge is-mod">Cambiado</span>' : '<span class="ed-badge">Como en el juego</span>'}
        </div>
        <div class="ed-dh-actions">
          <button type="button" class="ed-btn is-primary" data-ed="save" ${dirty ? '' : 'disabled'}>${icon('check', 16)}<span>Guardar</span></button>
          <button type="button" class="ed-btn" data-ed="discard" ${dirty ? '' : 'disabled'}>Descartar</button>
          <button type="button" class="ed-btn is-icon" data-ed="more" title="Más">${icon('menu', 16)}</button>
        </div>
      </div>
      <div class="ed-detail-body">
        ${mine.length ? `<div class="ed-issues">${mine.map((x) => `<div class="ed-issue is-${x.level}">${icon('warning', 16)}<span>${esc(x.msg)}</span></div>`).join('')}</div>` : ''}
        ${sections}
        <div class="ed-idline">Código interno: <code>${esc(d.id)}</code></div>
      </div>
      <div class="ed-savebar ${dirty ? 'is-on' : ''}">
        <span>Tenés cambios sin guardar</span>
        <button type="button" class="ed-btn" data-ed="discard">Descartar</button>
        <button type="button" class="ed-btn is-primary" data-ed="save">${icon('check', 16)}<span>Guardar</span></button>
      </div>
    </section>`;
  }

  function refreshDirty() {
    if (!S.host) return;
    const dirty = isDirty();
    S.host.querySelectorAll('[data-ed="save"], .ed-dh-actions [data-ed="discard"]').forEach((b) => { b.disabled = !dirty; });
    const bar = S.host.querySelector('.ed-savebar');
    if (bar) bar.classList.toggle('is-on', dirty);
  }

  function autoGrow(root) {
    root.querySelectorAll('textarea.ed-ta').forEach((ta) => {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(420, ta.scrollHeight + 2)}px`;
    });
  }

  // ---------- Cambios ----------

  function fieldLabel(col, key) {
    const t = schema.byKey[col];
    if (!t) return key;
    for (const sec of t.sections) {
      for (const f of sec.fields) {
        if (f.path === key || (f.path && f.path.split('.')[0] === key)) return f.label || sec.title || key;
      }
    }
    const extra = { sprite: 'Apariencia', biome: 'Biomas viejos', icon: 'Ícono viejo', autoLoot: 'Botín automático', type: 'Tipo', pos: 'Posición en el mapa', events: 'Sucesos del camino', encounter: 'Peleas', unlockConditions: 'Para entrar', bonuses: 'Números', spawn: 'Grupo', reward: 'Premio', services: 'Servicios' };
    return extra[key] || key;
  }

  function changesView(changes) {
    const legacy = store.hasLegacy();
    const byCol = {};
    for (const c of changes) (byCol[c.col] = byCol[c.col] || []).push(c);
    const blocks = schema.TYPES.filter((t) => byCol[t.key]).map((t) => {
      const rows = byCol[t.key].map((c) => {
        const cur = A.Data.getById(c.col, c.id);
        const seed = store.seedOf(c.col, c.id);
        const name = schema.nameOf(c.col, cur || seed) || c.id;
        if (c.kind === 'deleted') {
          return `<div class="ed-change">
            <span class="ed-row-thumb">${fields.thumbOf(c.col, seed, 34)}</span>
            <div class="ed-change-text"><b>${esc(name)}</b><small>Borrado (está oculto)</small></div>
            <button type="button" class="ed-btn is-small" data-ed="restore" data-col="${c.col}" data-id="${esc(c.id)}">${icon('undo', 14)}<span>Recuperar</span></button>
          </div>`;
        }
        if (c.kind === 'new') {
          return `<div class="ed-change">
            <span class="ed-row-thumb">${fields.thumbOf(c.col, cur, 34)}</span>
            <div class="ed-change-text"><b>${esc(name)}</b><small>Nuevo: lo creaste vos</small></div>
            <button type="button" class="ed-btn is-small" data-ed="open" data-col="${c.col}" data-id="${esc(c.id)}">${icon('pencil', 14)}<span>Abrir</span></button>
          </div>`;
        }
        const keys = c.keys.map((k) => `<li><span>${esc(fieldLabel(c.col, k))}</span>
          <span class="ed-change-vals"><s>${esc(Ed.util.short(seed ? seed[k] : undefined))}</s> → <b>${esc(Ed.util.short(cur ? cur[k] : undefined))}</b></span>
          <button type="button" class="ed-mini" data-ed="revert-key" data-col="${c.col}" data-id="${esc(c.id)}" data-key="${esc(k)}" title="Volver este dato al original">${icon('undo', 12)}</button></li>`).join('');
        return `<div class="ed-change">
          <span class="ed-row-thumb">${fields.thumbOf(c.col, cur, 34)}</span>
          <div class="ed-change-text"><b>${esc(name)}</b><ul class="ed-change-keys">${keys}</ul></div>
          <div class="ed-change-btns">
            <button type="button" class="ed-btn is-small" data-ed="open" data-col="${c.col}" data-id="${esc(c.id)}">${icon('pencil', 14)}<span>Abrir</span></button>
            <button type="button" class="ed-btn is-small" data-ed="revert" data-col="${c.col}" data-id="${esc(c.id)}">${icon('undo', 14)}<span>Volver al original</span></button>
          </div>
        </div>`;
      }).join('');
      return `<section class="ed-card"><h3 class="ed-card-title">${icon(t.icon, 20)} ${esc(t.label)} <em>${byCol[t.key].length}</em></h3>${rows}</section>`;
    }).join('');
    return `<div class="ed-page">
      <div class="ed-page-head">
        <h2>${icon('scroll', 28)} Tus cambios</h2>
        <p>Todo lo que cambiaste se guarda en este navegador. Lo que no tocaste se actualiza solo con cada versión nueva del juego. Para llevarte los cambios a otra compu, usá <b>Exportar</b>.</p>
        ${legacy ? `<div class="ed-issue is-warn">${icon('warning', 16)}<span>Algunos cambios vienen del editor viejo, que guardaba una copia entera de cada cosa. Pueden estar tapando mejoras de esta versión (por ejemplo, el rebalanceo de criaturas). Fijate abajo qué datos quedaron distintos y volvé al original lo que no hayas cambiado vos.</span></div>` : ''}
        <div class="ed-row">
          <button type="button" class="ed-btn" data-ed="export">${icon('download', 16)}<span>Exportar mis cambios</span></button>
          <button type="button" class="ed-btn" data-ed="import">${icon('upload', 16)}<span>Importar</span></button>
          ${changes.length ? `<button type="button" class="ed-btn is-danger" data-ed="reset-all">${icon('trash', 16)}<span>Volver todo al juego original</span></button>` : ''}
        </div>
      </div>
      ${blocks || `<div class="ed-empty is-big">${icon('check', 40)}<p>No cambiaste nada: el juego está como viene.</p></div>`}
    </div>`;
  }

  // ---------- Revisar ----------

  function checkView(issues) {
    const name = (c, id) => { const e = A.Data.getById(c, id); return e ? schema.nameOf(c, e) : id; };
    const rows = (lvl) => issues.filter((x) => x.level === lvl).map((x) => `<button type="button" class="ed-issue-row is-${lvl}" data-ed="open" data-col="${esc(x.collection)}" data-id="${esc(x.entityId)}">
      <span class="ed-row-thumb">${fields.thumbOf(x.collection, A.Data.getById(x.collection, x.entityId), 30)}</span>
      <span class="ed-row-text"><b>${esc(name(x.collection, x.entityId))}</b><small>${esc(x.msg)}</small></span>
    </button>`).join('');
    const errs = rows('error');
    const warns = rows('warn');
    return `<div class="ed-page">
      <div class="ed-page-head">
        <h2>${icon('warning', 28)} Revisar el mundo</h2>
        <p>Cosas que pueden romper el juego (en rojo) o que quizás no hiciste a propósito (en amarillo). Tocá una para abrirla.</p>
      </div>
      ${errs ? `<section class="ed-card"><h3 class="ed-card-title">Problemas</h3>${errs}</section>` : ''}
      ${warns ? `<section class="ed-card"><h3 class="ed-card-title">Para mirar</h3>${warns}</section>` : ''}
      ${!errs && !warns ? `<div class="ed-empty is-big">${icon('check', 40)}<p>Todo en orden.</p></div>` : ''}
    </div>`;
  }

  // ============================================================
  // Abrir, crear, guardar
  // ============================================================

  async function confirmLeaveDraft() {
    if (!isDirty()) return true;
    const ans = await ui.confirmBox({
      title: 'Tenés cambios sin guardar',
      text: `En <b>${esc(schema.nameOf(S.type, S.draft) || 'la ficha abierta')}</b>.`,
      options: [{ value: 'discard', label: 'Descartarlos', danger: true }, { value: 'save', label: 'Guardar', primary: true }],
    });
    if (!ans) return false;
    if (ans === 'save') return save();
    return true;
  }

  function loadEntity(col, id) {
    const e = A.Data.getById(col, id);
    if (!e) return false;
    S.type = col;
    S.id = id;
    S.draft = store.cleanEntity(e);
    S.saved = clone(S.draft);
    const seed = store.seedOf(col, id);
    S.base = seed ? store.cleanEntity(seed) : null;
    S.isNew = false;
    S.related = {};
    return true;
  }

  async function open(col, id) {
    if (!(S.type === col && S.id === id) && !(await confirmLeaveDraft())) return;
    if (!schema.byKey[col]) return;
    if (!loadEntity(col, id)) { ui.toast('No existe (¿se borró?)', 'bad'); return; }
    S.view = 'browse';
    S.screen = 'detail';
    render();
  }

  async function createNew(col, preset) {
    if (!(await confirmLeaveDraft())) return;
    const t = schema.byKey[col];
    const draft = { ...t.template(), ...(preset || {}) };
    const nameKey = t.nameKey || 'name';
    draft.id = store.uniqueId(col, draft[nameKey] || t.one);
    S.type = col;
    S.id = draft.id;
    S.draft = draft;
    S.saved = clone(draft);
    S.base = null;
    S.isNew = true;
    S.related = {};
    S.view = 'browse';
    S.screen = 'detail';
    S.globalQ = '';
    render();
    const first = S.host.querySelector('.ed-detail-body input[type="text"]');
    if (first) { first.focus(); first.select(); }
  }

  function newRegionAt(pos) {
    createNew('regions', { pos, name: 'Zona nueva' });
  }

  async function duplicate() {
    if (!S.draft) return;
    const t = T();
    const nameKey = t.nameKey || 'name';
    const copy = clone(S.draft);
    copy[nameKey] = `${copy[nameKey] || t.one} (copia)`;
    copy.id = store.uniqueId(t.key, copy[nameKey]);
    if (t.key === 'races') delete copy.sprite;
    S.id = copy.id;
    S.draft = copy;
    S.saved = clone(copy);
    S.base = null;
    S.isNew = true;
    S.related = {};
    render();
    ui.toast('Copia lista: cambiale lo que quieras y guardala');
  }

  /** Guarda la ficha abierta (y lo que cambió junto con ella). */
  async function save() {
    if (!S.draft) return false;
    const t = T();
    const d = clone(S.draft);
    const nameKey = t.nameKey || 'name';
    if (!String(d[nameKey] || '').trim()) {
      ui.toast('Le falta el nombre', 'bad');
      const input = S.host.querySelector(`[data-f="${nameKey}"]`);
      if (input) input.focus();
      return false;
    }
    d[nameKey] = String(d[nameKey]).trim();
    // Lo nuevo toma su código interno del nombre (al guardar por primera vez)
    if (S.isNew) {
      const tempId = d.id;
      const finalId = store.uniqueId(t.key, d[nameKey]);
      if (finalId !== tempId) {
        d.id = finalId;
        for (const col of Object.keys(S.related)) {
          for (const id of Object.keys(S.related[col] || {})) {
            S.related[col][id] = JSON.parse(JSON.stringify(S.related[col][id]).split(`"${tempId}"`).join(`"${finalId}"`));
          }
        }
      }
    }
    if (t.normalize) t.normalize(d);
    const changes = [{ col: t.key, entity: d }];

    // Caminos: van y vienen (si agregaste uno acá, también aparece en el otro lugar)
    if (t.key === 'regions') {
      const before = new Set((S.isNew ? [] : (A.Data.getById('regions', d.id) || {}).connections) || []);
      const after = new Set(d.connections || []);
      for (const id of after) {
        if (before.has(id)) continue;
        const o = A.Data.getById('regions', id);
        if (o && !(o.connections || []).includes(d.id)) changes.push({ col: 'regions', entity: { ...store.cleanEntity(o), connections: [...(o.connections || []), d.id] } });
      }
      for (const id of before) {
        if (after.has(id)) continue;
        const o = A.Data.getById('regions', id);
        if (o && (o.connections || []).includes(d.id)) changes.push({ col: 'regions', entity: { ...store.cleanEntity(o), connections: (o.connections || []).filter((x) => x !== d.id) } });
      }
    }
    for (const col of Object.keys(S.related)) {
      for (const id of Object.keys(S.related[col] || {})) changes.push({ col, entity: store.cleanEntity(S.related[col][id]) });
    }
    try {
      store.commit(changes);
    } catch (err) {
      console.error(err);
      ui.toast(`No se pudo guardar: ${err.message}`, 'bad');
      return false;
    }
    if (A.EditorSim) A.EditorSim.clearCache();
    loadEntity(t.key, d.id);
    render();
    ui.toast(`${d[nameKey]}: guardado`);
    return true;
  }

  function discard() {
    if (!S.draft) return;
    if (S.isNew) {
      S.draft = null;
      S.id = null;
      S.isNew = false;
      S.related = {};
      S.screen = 'list';
    } else {
      loadEntity(S.type, S.id);
    }
    render();
  }

  async function moreMenu() {
    if (!S.draft) return;
    const t = T();
    const isMod = !S.isNew && !!store.overrideOf(t.key, S.draft.id);
    const fromGame = !S.isNew && !!store.seedOf(t.key, S.draft.id);
    const options = [{ value: 'dup', label: 'Duplicar (hacer una copia)' }];
    if (isMod && fromGame) options.push({ value: 'revert', label: 'Volver a como viene en el juego' });
    if (!S.isNew) options.push({ value: 'del', label: fromGame ? 'Borrar (queda oculto, se puede recuperar)' : 'Borrar', danger: true });
    const ans = await ui.confirmBox({ title: schema.nameOf(t.key, S.draft) || t.one, options, cancel: 'Cerrar' });
    if (ans === 'dup') duplicate();
    if (ans === 'revert') {
      const ok = await ui.confirmBox({ title: '¿Volver al original?', text: 'Se pierden todos los cambios que le hiciste.', ok: 'Volver al original', danger: true });
      if (!ok) return;
      store.revert(t.key, S.draft.id);
      loadEntity(t.key, S.draft.id);
      render();
      ui.toast('Volvió a como viene en el juego');
    }
    if (ans === 'del') {
      const used = usedBy(t.key, S.draft.id);
      const ok = await ui.confirmBox({
        title: `¿Borrar ${esc(schema.nameOf(t.key, S.draft))}?`,
        text: `${fromGame ? 'Como viene en el juego, queda oculta y la podés recuperar desde Cambios.' : 'Es tuya: se borra del todo.'}${used.length ? `<br><br><b>Ojo:</b> la usan ${used.slice(0, 5).map(esc).join(', ')}${used.length > 5 ? '…' : ''}.` : ''}`,
        ok: 'Borrar', danger: true,
      });
      if (!ok) return;
      store.remove(t.key, S.draft.id);
      S.draft = null;
      S.id = null;
      S.related = {};
      S.screen = 'list';
      render();
      ui.toast('Borrado');
    }
  }

  /** Quién usa esta cosa (para avisar antes de borrar). */
  function usedBy(col, id) {
    const out = [];
    const D = A.Data;
    if (col === 'items' || col === 'weapons' || col === 'armors') {
      for (const e of D.enemies) if ((e.drops || []).some((x) => x.itemId === id)) out.push(e.name);
      for (const n of D.npcs) if ((n.sells || []).includes(id)) out.push(n.name);
      for (const r of D.recipes) if (r.result === id || (r.ingredients || []).some((g) => g.itemId === id)) out.push(r.name);
    }
    if (col === 'regions') {
      for (const r of D.regions) if ((r.connections || []).includes(id)) out.push(r.name);
      for (const n of D.npcs) if (n.region === id) out.push(n.name);
    }
    if (col === 'npcs') for (const q of D.quests || []) if (q.giver === id) out.push(q.title);
    if (col === 'spells') for (const n of D.npcs) if ((n.teaches || []).includes(id)) out.push(n.name);
    if (col === 'enemies') for (const q of D.quests || []) if ((q.objectives || []).some((o) => (Array.isArray(o.enemy) ? o.enemy : [o.enemy]).includes(id))) out.push(q.title);
    return out;
  }

  // ============================================================
  // Zonas: criaturas que viven acá
  // ============================================================

  async function zoneAddEnemy() {
    const d = S.draft;
    if (!d) return;
    const here = new Set(Ed.panels.creaturesIn(d.id).map((e) => e.id));
    const t0 = Array.isArray(d.tier) ? d.tier[0] : 1;
    const t1 = Array.isArray(d.tier) ? d.tier[1] : 10;
    const options = A.Data.enemies
      .filter((e) => !here.has(e.id))
      .sort((a, b) => Math.abs(a.tier - (t0 + t1) / 2) - Math.abs(b.tier - (t0 + t1) / 2) || a.tier - b.tier)
      .map((e) => ({ value: e.id, label: e.name, thumb: fields.thumbOf('enemies', e, 30), meta: `${schema.metaOf('enemies', e)}${e.tier >= t0 && e.tier <= t1 ? '' : ' · fuera del nivel de la zona'}` }));
    const picked = await ui.pick({ title: `Criaturas para ${d.name || 'la zona'}`, options, multi: true });
    if (!picked || !picked.length) return;
    S.related.enemies = S.related.enemies || {};
    for (const id of picked) {
      const e = S.related.enemies[id] || store.cleanEntity(A.Data.getById('enemies', id));
      e.regions = Array.from(new Set([...(e.regions || []), d.id]));
      S.related.enemies[id] = e;
    }
    renderDetailOnly();
  }

  function zoneRemoveEnemy(id) {
    const d = S.draft;
    if (!d) return;
    S.related.enemies = S.related.enemies || {};
    const e = S.related.enemies[id] || store.cleanEntity(A.Data.getById('enemies', id));
    e.regions = (e.regions || []).filter((x) => x !== d.id);
    S.related.enemies[id] = e;
    renderDetailOnly();
  }

  // ============================================================
  // Exportar / importar
  // ============================================================

  function exportFile() {
    const data = store.overrides();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aventurs-cambios-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    ui.toast('Archivo descargado');
  }

  function importFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        let data;
        try {
          data = JSON.parse(String(reader.result || ''));
        } catch (err) {
          ui.toast('Ese archivo no es de cambios del editor', 'bad');
          return;
        }
        const cols = A.Data.COLLECTIONS.filter((k) => Array.isArray(data[k]));
        if (!data || typeof data !== 'object' || (!cols.length && !data._deleted)) {
          ui.toast('Ese archivo no es de cambios del editor', 'bad');
          return;
        }
        const n = cols.reduce((s, k) => s + data[k].length, 0);
        const ans = await ui.confirmBox({
          title: 'Importar cambios',
          text: `El archivo trae <b>${n}</b> cosas cambiadas o nuevas. ¿Cómo las cargo?`,
          options: [{ value: 'merge', label: 'Sumar a lo que tengo', primary: true }, { value: 'replace', label: 'Reemplazar todo', danger: true }],
        });
        if (!ans) return;
        const cur = ans === 'replace' ? {} : store.overrides();
        for (const k of cols) {
          const map = new Map((cur[k] || []).map((e) => [e.id, e]));
          for (const e of data[k]) if (e && e.id) map.set(e.id, e);
          cur[k] = Array.from(map.values());
        }
        if (data._deleted) {
          cur._deleted = cur._deleted || {};
          for (const k of Object.keys(data._deleted)) cur._deleted[k] = Array.from(new Set([...(cur._deleted[k] || []), ...(data._deleted[k] || [])]));
        }
        if (data._format === 2 && ans === 'replace') cur._format = 2;
        A.Data.saveOverrides(cur);
        A.Data.init();
        if (cur._format === 2 || ans === 'merge') store.tidy();
        S.draft = null;
        S.id = null;
        render();
        ui.toast('Cambios cargados');
      };
      reader.readAsText(file);
    });
    input.click();
  }

  // ============================================================
  // Eventos
  // ============================================================

  async function onClick(ev) {
    const actEl = ev.target.closest('[data-act]');
    if (actEl && S.host.contains(actEl) && !actEl.disabled) {
      ev.preventDefault();
      const redraw = await fields.handleAct(S, actEl);
      if (redraw) renderDetailOnly();
      else refreshDirty();
      return;
    }
    const el = ev.target.closest('[data-ed]');
    if (!el || !S.host.contains(el) || el.disabled) return;
    const a = el.dataset.ed;
    switch (a) {
      case 'exit': exit(); break;
      case 'view':
        if (el.dataset.v !== 'browse' && S.view === 'browse' && isDirty() && !(await confirmLeaveDraft())) return;
        S.view = el.dataset.v;
        S.mapPlacing = false;
        if (S.view === 'browse' && !S.draft) S.screen = 'list';
        render();
        break;
      case 'type':
        if (S.type !== el.dataset.t && !(await confirmLeaveDraft())) return;
        if (S.type !== el.dataset.t) { S.draft = null; S.id = null; S.search = ''; }
        S.type = el.dataset.t;
        S.globalQ = '';
        S.screen = 'list';
        render();
        break;
      case 'open': open(el.dataset.col, el.dataset.id); break;
      case 'screen': S.screen = el.dataset.s; render(); break;
      case 'clear-global': S.globalQ = ''; S.screen = 'list'; render(); break;
      case 'new': createNew(S.type); break;
      case 'save': save(); break;
      case 'discard': discard(); break;
      case 'more': moreMenu(); break;
      case 'export': exportFile(); break;
      case 'import': importFile(); break;
      case 'zone-add-enemy': zoneAddEnemy(); break;
      case 'zone-remove-enemy': zoneRemoveEnemy(el.dataset.enemy); break;
      case 'new-npc-here': if (S.draft) createNew('npcs', { region: S.draft.id, name: 'Habitante nuevo' }); break;
      case 'new-quest-for': if (S.draft) createNew('quests', { giver: S.draft.id }); break;
      case 'open-map':
        if (isDirty() && !(await confirmLeaveDraft())) return;
        S.view = 'map';
        S.mapSel = el.dataset.id || null;
        render();
        break;
      case 'suggest-style': {
        if (!S.draft || !A.EditorSim || !A.EditorSim.suggest) break;
        const style = el.dataset.style;
        let res = null;
        try { res = A.EditorSim.suggest(S.draft, style); } catch (err) { console.warn('[Editor]', err); }
        S.suggest[el.dataset.key] = { style, res, sig: Ed.panels.suggestSig(S.draft) };
        renderDetailOnly();
        break;
      }
      case 'suggest-apply': {
        const st = S.suggest[el.dataset.key];
        if (!S.draft || !st || !st.res) break;
        for (const k of ['health', 'damage', 'attack', 'difficulty', 'armor', 'speed']) {
          if (st.res[k] != null) S.draft[k] = st.res[k];
        }
        delete S.suggest[el.dataset.key];
        renderDetailOnly();
        ui.toast('Números puestos. Revisalos y tocá Guardar.');
        break;
      }
      case 'sim-level': {
        const k = el.dataset.key;
        const cur = S.simLevel[k] || (S.draft && (S.draft.tier && !Array.isArray(S.draft.tier) ? S.draft.tier : schema.lvlOf(S.draft))) || 1;
        S.simLevel[k] = Math.max(1, Math.min(10, cur + Number(el.dataset.d)));
        renderDetailOnly();
        break;
      }
      case 'revert': {
        const ok = await ui.confirmBox({ title: '¿Volver al original?', text: 'Se pierden los cambios de esta ficha.', ok: 'Volver al original', danger: true });
        if (!ok) return;
        store.revert(el.dataset.col, el.dataset.id);
        if (S.id === el.dataset.id && S.type === el.dataset.col) loadEntity(S.type, S.id);
        render();
        ui.toast('Listo');
        break;
      }
      case 'revert-key':
        store.revertField(el.dataset.col, el.dataset.id, el.dataset.key);
        if (S.id === el.dataset.id && S.type === el.dataset.col) loadEntity(S.type, S.id);
        render();
        break;
      case 'restore':
        store.restore(el.dataset.col, el.dataset.id);
        render();
        ui.toast('Recuperado');
        break;
      case 'reset-all': {
        const ok = await ui.confirmBox({ title: '¿Volver todo al juego original?', text: 'Se borran <b>todos</b> tus cambios y lo que creaste. Si querés guardarlos, exportalos antes.', ok: 'Borrar todos mis cambios', danger: true });
        if (!ok) return;
        store.resetAll();
        S.draft = null;
        S.id = null;
        render();
        ui.toast('El juego volvió a como viene');
        break;
      }
      case 'map-roads': S.mapRoads = !S.mapRoads; S.mapPlacing = false; render(); break;
      case 'map-place': S.mapPlacing = !S.mapPlacing; S.mapRoads = false; render(); break;
      case 'map-undo': Ed.map.undo(S); render(); break;
      case 'map-label': Ed.map.setLabel(S, el.dataset.side); render(); break;
      case 'map-unlink':
        if (S.mapSel) { Ed.map.toggleRoad(S, S.mapSel, el.dataset.other); ui.toast('Camino sacado'); render(); }
        break;
      default: break;
    }
  }

  function onInput(ev) {
    const t = ev.target;
    if (t.matches('[data-ed-search]')) {
      S.search = t.value;
      const pos = t.selectionStart;
      renderListOnly();
      const again = S.host.querySelector('[data-ed-search]');
      if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (err) { /* nada */ } }
      return;
    }
    if (t.matches('[data-ed-gsearch]')) {
      S.globalQ = t.value.trim();
      S.screen = 'list';
      if (S.view !== 'browse') {
        S.view = 'browse';
        render();
        const again = S.host.querySelector('[data-ed-gsearch]');
        if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
        return;
      }
      renderListOnly();
      return;
    }
    if (t.matches('[data-f]')) {
      if (t.dataset.k === 'toggle' || t.dataset.k === 'present' || t.dataset.k === 'select' || t.dataset.k === 'mapselect') return; // los maneja onChange
      const changed = fields.applyInput(S, t);
      if (!changed) return;
      fields.refreshChanged(S, t);
      fields.refreshLive(S.host, S, false);
      if (t.tagName === 'TEXTAREA') autoGrow(t.parentElement || S.host);
      refreshDirty();
    }
  }

  function onChange(ev) {
    const t = ev.target;
    if (t.matches('[data-ed-filter]')) {
      const tk = S.type;
      S.filters[tk] = S.filters[tk] || {};
      S.filters[tk][t.dataset.edFilter] = t.value;
      renderListOnly();
      return;
    }
    if (t.matches('[data-f]')) {
      const k = t.dataset.k;
      const changed = fields.applyInput(S, t);
      if (k === 'toggle' || k === 'present' || k === 'select' || k === 'mapselect') {
        if (changed) renderDetailOnly();
        return;
      }
      // números: al salir del campo se acomodan al mínimo/máximo
      if ((k === 'number' || k === 'percent') && t.value !== '') {
        let n = Number(String(t.value).replace(',', '.'));
        if (t.min !== '' && n < Number(t.min)) n = Number(t.min);
        if (t.max !== '' && n > Number(t.max)) n = Number(t.max);
        if (String(n) !== t.value) { t.value = n; fields.applyInput(S, t); }
      }
      fields.refreshChanged(S, t);
      fields.refreshLive(S.host, S, false);
      refreshDirty();
    }
  }

  function onKey(ev) {
    if (!S.host) return;
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === 's' || ev.key === 'S')) {
      ev.preventDefault();
      if (isDirty()) save();
    }
  }

  A.Views = A.Views || {};
  A.Views.Editor = { mount, unmount };
  Ed.view = { S, render, renderDetailOnly, open, createNew, newRegionAt, save, isDirty };
})(window.Aventurs);
