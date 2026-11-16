/* ============================================================
   Aventurs — Editor v2.2: el mapa

   - Arrastrá un lugar para moverlo (se guarda al soltar).
   - Tocá un lugar para elegirlo: ves sus datos y caminos.
   - Modo caminos: con un lugar elegido, tocá otro para poner o
     sacar el camino entre los dos (va en las dos direcciones).
   - "Nueva zona": tocá el mapa donde la querés.
   ============================================================ */

(function (A) {
  'use strict';

  const Ed = (A.Ed = A.Ed || {});
  const { esc, clone, icon } = Ed.util;

  const W = 1280;
  const H = 860;
  const SIDE_OFF = { t: [0, -34], b: [0, 44], l: [-30, 6], r: [30, 6] };
  const ANCHOR = { t: 'middle', b: 'middle', l: 'end', r: 'start' };

  function posOf(r) { return r.pos || { x: W / 2, y: H / 2 }; }

  function render(S) {
    const regions = A.Data.regions;
    const byId = new Map(regions.map((r) => [r.id, r]));
    const sel = S.mapSel ? byId.get(S.mapSel) : null;
    const roads = [];
    const seen = new Set();
    for (const r of regions) {
      for (const c of r.connections || []) {
        const o = byId.get(c);
        if (!o) continue;
        const k = [r.id, c].sort().join('|');
        if (seen.has(k)) continue;
        seen.add(k);
        const a = posOf(r), b = posOf(o);
        const mine = sel && (r.id === sel.id || c === sel.id);
        roads.push(`<line data-road="${esc(k)}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${mine ? 'is-mine' : ''}"/>`);
      }
    }
    const linked = new Set(sel ? sel.connections || [] : []);
    const nodes = regions.map((r) => {
      const p = posOf(r);
      const side = SIDE_OFF[r.labelAt] ? r.labelAt : 'b';
      const [dx, dy] = SIDE_OFF[side];
      const town = r.type !== 'combat';
      const cls = [town ? 'is-town' : '', sel && sel.id === r.id ? 'is-sel' : '', linked.has(r.id) ? 'is-linked' : ''].join(' ');
      const url = A.ItemSprites ? A.ItemSprites.iconUrl(`biome-${r.biome}`) || A.ItemSprites.iconUrl('map') : '';
      return `<g class="ed-node ${cls}" data-node="${esc(r.id)}" transform="translate(${p.x} ${p.y})">
        <circle r="${town ? 25 : 21}" class="ed-node-ring"/>
        ${url ? `<image href="${url}" x="-16" y="-16" width="32" height="32" style="image-rendering:pixelated"/>` : ''}
        <text x="${dx}" y="${dy}" text-anchor="${ANCHOR[side]}" class="ed-node-label">${esc(r.name)}</text>
        ${town ? '' : `<g class="ed-node-badge" transform="translate(17 -17)"><circle r="10.5"/><text x="0" y="4.5" text-anchor="middle">${Ed.schema.lvlOf(r)}</text></g>`}
      </g>`;
    }).join('');

    return `<div class="ed-mapview ${S.mapRoads ? 'is-roads' : ''} ${S.mapPlacing ? 'is-placing' : ''}">
      <div class="ed-map-tools">
        <div class="ed-map-help">${S.mapPlacing ? `${icon('pin', 18)}<span>Tocá el mapa donde va la zona nueva.</span>`
          : S.mapRoads ? `${icon('map', 18)}<span>${sel ? `Tocá otro lugar para poner o sacar el camino con <b>${esc(sel.name)}</b>.` : 'Elegí un lugar y después tocá otro para unirlos.'}</span>`
          : `${icon('pencil', 18)}<span>Arrastrá un lugar para moverlo. Tocá uno para ver sus caminos.</span>`}</div>
        <div class="ed-map-btns">
          <button type="button" class="ed-btn is-small ${S.mapRoads ? 'is-on' : ''}" data-ed="map-roads">${icon('compass', 16)}<span>${S.mapRoads ? 'Terminar caminos' : 'Editar caminos'}</span></button>
          <button type="button" class="ed-btn is-small ${S.mapPlacing ? 'is-on' : ''}" data-ed="map-place">${icon('plus', 16)}<span>${S.mapPlacing ? 'Cancelar' : 'Nueva zona'}</span></button>
          ${S.mapUndo ? `<button type="button" class="ed-btn is-small" data-ed="map-undo">${icon('undo', 16)}<span>Deshacer</span></button>` : ''}
        </div>
      </div>
      <div class="ed-map-stage">
        <div class="ed-map-wrap">
          <svg class="ed-map-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
            <defs>
              <radialGradient id="edParch" cx="50%" cy="45%" r="75%"><stop offset="0%" stop-color="#f4e6c4"/><stop offset="100%" stop-color="#d9c08c"/></radialGradient>
            </defs>
            <rect x="0" y="0" width="${W}" height="${H}" rx="26" fill="url(#edParch)" class="ed-map-bg"/>
            <g class="ed-map-roads">${roads.join('')}</g>
            <g class="ed-map-nodes">${nodes}</g>
          </svg>
        </div>
        ${sideCard(S, sel)}
      </div>
    </div>`;
  }

  function sideCard(S, r) {
    if (!r) return `<aside class="ed-map-side is-empty"><div class="ed-dim">Tocá un lugar del mapa.</div></aside>`;
    const others = (r.connections || []).map((id) => A.Data.getById('regions', id)).filter(Boolean);
    const side = SIDE_OFF[r.labelAt] ? r.labelAt : 'b';
    return `<aside class="ed-map-side">
      <div class="ed-map-side-head">${A.UI ? A.UI.biomeIcon(r, 40) : ''}<div><b>${esc(r.name)}</b><small>${r.type === 'combat' ? `Zona · nivel ${Ed.schema.lvlOf(r)}` : 'Pueblo'}</small></div></div>
      <div class="ed-map-side-sec">
        <div class="ed-label"><span>Nombre en el mapa</span></div>
        <div class="ed-seg">${['t', 'r', 'b', 'l'].map((k) => `<button type="button" class="${side === k ? 'is-on' : ''}" data-ed="map-label" data-side="${k}">${esc(Ed.schema.L.SIDE[k])}</button>`).join('')}</div>
      </div>
      <div class="ed-map-side-sec">
        <div class="ed-label"><span>Caminos (${others.length})</span></div>
        <div class="ed-chiplist">${others.map((o) => `<span class="ed-chip is-on"><span>${esc(o.name)}</span><button type="button" class="ed-chip-x" data-ed="map-unlink" data-other="${esc(o.id)}" title="Sacar el camino">${icon('close', 11)}</button></span>`).join('') || '<span class="ed-dim">Ninguno: no se puede llegar.</span>'}</div>
      </div>
      <button type="button" class="ed-btn is-primary" data-ed="open" data-col="regions" data-id="${esc(r.id)}">${icon('pencil', 16)}<span>Editar ${esc(r.name)}</span></button>
    </aside>`;
  }

  // ---------- guardar desde el mapa ----------

  function saveRegions(S, list) {
    // Si la zona está abierta en la ficha, el borrador también se entera
    for (const r of list) {
      if (S.draft && S.type === 'regions' && S.draft.id === r.id) {
        S.draft.pos = clone(r.pos);
        S.draft.labelAt = r.labelAt;
        S.draft.connections = clone(r.connections);
        if (S.base) { S.base.pos = clone(r.pos); S.base.labelAt = r.labelAt; S.base.connections = clone(r.connections); }
      }
    }
    Ed.store.commit(list.map((r) => ({ col: 'regions', entity: r })));
  }

  function setLabel(S, side) {
    const r = A.Data.getById('regions', S.mapSel);
    if (!r) return;
    const next = Ed.store.cleanEntity(r);
    next.labelAt = side;
    saveRegions(S, [next]);
  }

  function toggleRoad(S, aId, bId) {
    const a = A.Data.getById('regions', aId);
    const b = A.Data.getById('regions', bId);
    if (!a || !b || aId === bId) return null;
    const na = Ed.store.cleanEntity(a);
    const nb = Ed.store.cleanEntity(b);
    na.connections = (na.connections || []).slice();
    nb.connections = (nb.connections || []).slice();
    const has = na.connections.includes(bId) || nb.connections.includes(aId);
    if (has) {
      na.connections = na.connections.filter((x) => x !== bId);
      nb.connections = nb.connections.filter((x) => x !== aId);
    } else {
      na.connections.push(bId);
      nb.connections.push(aId);
    }
    S.mapUndo = { kind: 'roads', before: [Ed.store.cleanEntity(a), Ed.store.cleanEntity(b)] };
    saveRegions(S, [na, nb]);
    return !has;
  }

  // ---------- arrastrar ----------

  function svgPoint(svg, ev) {
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const m = svg.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  }

  function bind(root, S, rerender) {
    const svg = root.querySelector('.ed-map-svg');
    if (!svg) return;
    let drag = null;

    svg.addEventListener('pointerdown', (ev) => {
      const node = ev.target.closest('[data-node]');
      const p = svgPoint(svg, ev);
      if (!node) {
        if (S.mapPlacing) {
          S.mapPlacing = false;
          Ed.view.newRegionAt({ x: Math.round(Math.max(30, Math.min(W - 30, p.x))), y: Math.round(Math.max(30, Math.min(H - 30, p.y))) });
        }
        return;
      }
      const id = node.dataset.node;
      const r = A.Data.getById('regions', id);
      if (!r) return;
      drag = { id, node, start: p, orig: { ...posOf(r) }, moved: false, pointerId: ev.pointerId };
      try { node.setPointerCapture(ev.pointerId); } catch (err) { /* nada */ }
      ev.preventDefault();
    });

    svg.addEventListener('pointermove', (ev) => {
      if (!drag || S.mapRoads) return;
      const p = svgPoint(svg, ev);
      const dx = p.x - drag.start.x;
      const dy = p.y - drag.start.y;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      drag.moved = true;
      const nx = Math.round(Math.max(30, Math.min(W - 30, drag.orig.x + dx)));
      const ny = Math.round(Math.max(30, Math.min(H - 30, drag.orig.y + dy)));
      drag.now = { x: nx, y: ny };
      drag.node.setAttribute('transform', `translate(${nx} ${ny})`);
      drag.node.classList.add('is-drag');
      // mover los caminos que salen de este lugar
      svg.querySelectorAll('[data-road]').forEach((ln) => {
        const [a, b] = ln.dataset.road.split('|');
        if (a === drag.id) { ln.setAttribute(posKey(ln, a, b, true)[0], nx); ln.setAttribute(posKey(ln, a, b, true)[1], ny); }
        if (b === drag.id) { ln.setAttribute(posKey(ln, a, b, false)[0], nx); ln.setAttribute(posKey(ln, a, b, false)[1], ny); }
      });
    });

    // Cada línea guarda el orden en que se dibujó (x1/y1 es el primero de la pareja)
    function posKey(ln, a, b, isA) {
      const first = ln.dataset.first || null;
      if (!first) {
        // la primera vez: averiguar cuál punta es cuál comparando con la posición original
        const ra = A.Data.getById('regions', a);
        const x1 = Number(ln.getAttribute('x1'));
        const y1 = Number(ln.getAttribute('y1'));
        const pa = ra ? posOf(ra) : { x: -1, y: -1 };
        ln.dataset.first = (Math.abs(pa.x - x1) < 0.5 && Math.abs(pa.y - y1) < 0.5) ? 'a' : 'b';
      }
      const aIsFirst = ln.dataset.first === 'a';
      return (isA === aIsFirst) ? ['x1', 'y1'] : ['x2', 'y2'];
    }

    const end = (ev) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      try { d.node.releasePointerCapture(d.pointerId); } catch (err) { /* nada */ }
      if (d.moved && d.now) {
        const r = A.Data.getById('regions', d.id);
        if (!r) return;
        const next = Ed.store.cleanEntity(r);
        S.mapUndo = { kind: 'move', before: [Ed.store.cleanEntity(r)] };
        next.pos = { x: d.now.x, y: d.now.y };
        saveRegions(S, [next]);
        S.mapSel = d.id;
        Ed.ui.toast(`${r.name}: posición guardada`);
        rerender();
        return;
      }
      // fue un toque
      if (S.mapRoads && S.mapSel && S.mapSel !== d.id) {
        const a = A.Data.getById('regions', S.mapSel);
        const b = A.Data.getById('regions', d.id);
        const added = toggleRoad(S, S.mapSel, d.id);
        if (added !== null) Ed.ui.toast(added ? `Camino nuevo: ${a.name} ↔ ${b.name}` : `Camino sacado: ${a.name} ↔ ${b.name}`);
        rerender();
        return;
      }
      S.mapSel = d.id;
      rerender();
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', () => { drag = null; rerender(); });
  }

  function undo(S) {
    const u = S.mapUndo;
    if (!u) return;
    S.mapUndo = null;
    saveRegions(S, u.before);
    Ed.ui.toast('Listo, volvió a como estaba');
  }

  Ed.map = { render, bind, setLabel, toggleRoad, undo };
})(window.Aventurs);
