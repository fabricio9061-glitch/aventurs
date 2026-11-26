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

  // v3.12: el mismo tamaño que el mapa del juego (con las Tierras Altas y los tres reinos)
  const GM = (A.Views && A.Views.Map) || {};
  const W = GM.W || 2400;
  const H = GM.H || 860;
  const OLD_W = GM.OLD_W || 1280;
  const HIGH_W = GM.HIGH_W || 1820;
  const SIDE_OFF = { t: [0, -34], b: [0, 44], l: [-30, 6], r: [30, 6] };
  const ANCHOR = { t: 'middle', b: 'middle', l: 'end', r: 'start' };

  // ---------- v3.12: nombres que no se pisan (como en el mapa del juego) ----------
  // Cada nombre prueba varios lados alrededor de su lugar y se queda con el que menos tapa
  // a otros nombres y a otros lugares. Primero pueblos y zonas, después las guaridas.
  const SIDES = ['b', 't', 'r', 'l', 'br', 'tr', 'bl', 'tl'];
  const FS = 17;
  let mctx = null;
  const wCache = new Map();
  function textW(txt) {
    if (wCache.has(txt)) return wCache.get(txt);
    let w = String(txt).length * FS * 0.66;
    try {
      mctx = mctx || document.createElement('canvas').getContext('2d');
      const fam = (getComputedStyle(document.documentElement).getPropertyValue('--font-display') || '').trim() || 'Cinzel, Georgia, serif';
      mctx.font = `700 ${FS}px ${fam}`;
      w = mctx.measureText(String(txt)).width;
    } catch (e) { /* sin canvas: queda el estimado */ }
    if (!document.fonts || document.fonts.status === 'loaded') wCache.set(txt, w);
    return w;
  }
  function radiusOf(r) { return r.type === 'lair' ? 17 : r.type !== 'combat' ? 25 : 21; }
  function labelBox(p, side, R, w) {
    const asc = FS * 0.78, desc = FS * 0.24, d = R + 6;
    let x, y, anchor;
    switch (side) {
      case 't': x = p.x; y = p.y - d - desc - 1; anchor = 'middle'; break;
      case 'r': x = p.x + d; y = p.y + FS * 0.32; anchor = 'start'; break;
      case 'l': x = p.x - d; y = p.y + FS * 0.32; anchor = 'end'; break;
      case 'tr': x = p.x + R * 0.75; y = p.y - R * 0.75 - 3; anchor = 'start'; break;
      case 'tl': x = p.x - R * 0.75; y = p.y - R * 0.75 - 3; anchor = 'end'; break;
      case 'br': x = p.x + R * 0.75; y = p.y + R * 0.75 + asc + 1; anchor = 'start'; break;
      case 'bl': x = p.x - R * 0.75; y = p.y + R * 0.75 + asc + 1; anchor = 'end'; break;
      default: x = p.x; y = p.y + d + asc; anchor = 'middle'; break;
    }
    const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'start' ? x : x - w;
    return { x, y, anchor, side, box: [x0 - 3, y - asc - 2, x0 + w + 3, y + desc + 3] };
  }
  const overlap = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  function placeLabels(regions) {
    const discs = [];
    for (const r of regions) {
      const p = posOf(r); const R = radiusOf(r) + 2;
      discs.push({ id: r.id, box: [p.x - R, p.y - R, p.x + R, p.y + R] });
      if (r.type === 'combat' || r.type === 'lair') discs.push({ id: r.id, badge: true, box: [p.x + 3, p.y - 29, p.x + 29, p.y - 3] }); // el nivel (tampoco se tapa el propio)
    }
    const out = {};
    const placed = [];
    const order = regions.slice().sort((a, b) => (a.type === 'lair' ? 1 : 0) - (b.type === 'lair' ? 1 : 0));
    for (const r of order) {
      const p = posOf(r);
      const R = radiusOf(r);
      const w = textW(r.name);
      const pref = SIDE_OFF[r.labelAt] ? r.labelAt : 'b';
      const sides = [pref].concat(SIDES.filter((x) => x !== pref));
      let best = null;
      sides.forEach((side, rank) => {
        const c = labelBox(p, side, R, w);
        let score = rank * (rank < 4 ? 30 : 45);
        for (const b of placed) score += overlap(c.box, b) * 4;
        for (const d of discs) if (d.id !== r.id || d.badge) score += overlap(c.box, d.box) * 3;
        score += (Math.max(0, 8 - c.box[0]) + Math.max(0, c.box[2] - (W - 8)) + Math.max(0, 8 - c.box[1]) + Math.max(0, c.box[3] - (H - 8))) * 60;
        if (!best || score < best.score) best = Object.assign(c, { score });
      });
      out[r.id] = best;
      placed.push(best.box);
    }
    return out;
  }

  function posOf(r) { return r.pos || { x: W / 2, y: H / 2 }; }

  // ---------- v3.9: acercar y alejar ----------
  const ZMIN = 0.45; // lo más cerca: casi la mitad del mapa
  const ZMAX = 1.6;  // lo más lejos: se ve todo con margen
  function viewOf(S) { return S.mapView || { x: 0, y: 0, w: W, h: H }; }
  function clampView(v) {
    const w = Math.max(W * ZMIN, Math.min(W * ZMAX, v.w));
    const h = w * (H / W);
    const mx = W * 0.3, my = H * 0.3;
    const x = Math.max(-mx - (w > W ? (w - W) : 0), Math.min(W + mx - w, v.x));
    const y = Math.max(-my - (h > H ? (h - H) : 0), Math.min(H + my - h, v.y));
    return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  }
  function zoomView(S, f, cx, cy) {
    const v = viewOf(S);
    const nw = v.w * f;
    const k = nw / v.w;
    const px = cx != null ? cx : v.x + v.w / 2;
    const py = cy != null ? cy : v.y + v.h / 2;
    S.mapView = clampView({ x: px - (px - v.x) * k, y: py - (py - v.y) * k, w: nw, h: v.h * k });
    return S.mapView;
  }

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
    const labels = placeLabels(regions); // v3.12
    const nodes = regions.map((r) => {
      const p = posOf(r);
      const lab = labels[r.id] || labelBox(p, 'b', radiusOf(r), 0);
      const lair = r.type === 'lair';
      const town = r.type !== 'combat' && !lair;
      const R = radiusOf(r);
      const cls = [town ? 'is-town' : '', lair ? 'is-lair' : '', sel && sel.id === r.id ? 'is-sel' : '', linked.has(r.id) ? 'is-linked' : ''].join(' ');
      const url = lair && r.boss && A.Sprites ? A.Sprites.dataUrl(r.boss) : A.ItemSprites ? A.ItemSprites.iconUrl(`biome-${r.biome}`) || A.ItemSprites.iconUrl('map') : '';
      const img = lair ? 13 : 16;
      return `<g class="ed-node ${cls}" data-node="${esc(r.id)}" transform="translate(${p.x} ${p.y})">
        <circle r="${R}" class="ed-node-ring"/>
        ${url ? `<image href="${url}" x="-${img}" y="-${img}" width="${img * 2}" height="${img * 2}" style="image-rendering:pixelated"/>` : ''}
        <text x="${(lab.x - p.x).toFixed(1)}" y="${(lab.y - p.y).toFixed(1)}" text-anchor="${lab.anchor}" class="ed-node-label">${esc(r.name)}</text>
        ${town ? '' : `<g class="ed-node-badge" transform="translate(${lair ? 14 : 17} ${lair ? -14 : -17})"><circle r="10.5"/><text x="0" y="4.5" text-anchor="middle">${Ed.schema.lvlOf(r)}</text></g>`}
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
          <div class="ed-map-zoom">
            <button type="button" class="ed-btn is-small" data-map-zoom="in" title="Acercar">${icon('plus', 16)}</button>
            <button type="button" class="ed-btn is-small" data-map-zoom="out" title="Alejar"><b style="font-size:20px;line-height:1">−</b></button>
            <button type="button" class="ed-btn is-small" data-map-zoom="fit" title="Ver todo el mapa">${icon('map', 16)}</button>
          </div>
          <svg class="ed-map-svg" viewBox="${(() => { const v = viewOf(S); return `${v.x} ${v.y} ${v.w} ${v.h}`; })()}" preserveAspectRatio="xMidYMid meet">
            <defs>
              <radialGradient id="edParch" cx="50%" cy="45%" r="75%"><stop offset="0%" stop-color="#f4e6c4"/><stop offset="100%" stop-color="#d9c08c"/></radialGradient>
            </defs>
            <rect x="${-W}" y="${-H}" width="${W * 3}" height="${H * 3}" fill="#cdb07a" class="ed-map-bg ed-map-outside"/>
            <rect x="0" y="0" width="${W}" height="${H}" rx="26" fill="url(#edParch)" class="ed-map-bg"/>
            ${regionsBg()}
            <g class="ed-map-roads">${roads.join('')}</g>
            <g class="ed-map-nodes">${nodes}</g>
          </svg>
        </div>
        ${sideCard(S, sel)}
      </div>
    </div>`;
  }

  /** v3.12: dónde empieza cada parte del mundo (líneas suaves y sus nombres, como en el mapa del juego). */
  function regionsBg() {
    const line = (x) => `<path class="ed-map-mist" d="M ${x} 20 C ${x + 30} 220, ${x - 14} 430, ${x + 22} 640 S ${x + 8} 800, ${x + 18} ${H - 20}"/>`;
    const t = (x, y, txt, cls) => `<text class="ed-map-title ${cls || ''}" x="${x}" y="${y}" text-anchor="middle">${esc(txt)}</text>`;
    const xr = HIGH_W + 8;
    return `<g class="ed-map-areas">
      <path class="ed-realm is-sky" d="M ${xr} 10 L ${W} 10 L ${W} 300 C ${W - 160} 290, ${xr + 330} 318, ${xr} 296 Z"/>
      <path class="ed-realm is-space" d="M ${xr} 296 C ${xr + 330} 318, ${W - 160} 290, ${W} 300 L ${W} 560 C ${W - 200} 548, ${xr + 260} 574, ${xr} 556 Z"/>
      <path class="ed-realm is-hell" d="M ${xr} 556 C ${xr + 260} 574, ${W - 200} 548, ${W} 560 L ${W} ${H - 10} L ${xr} ${H - 10} Z"/>
      ${line(OLD_W + 10)}${line(HIGH_W + 4)}
      ${t(OLD_W + 270, H - 40, 'Tierras Altas')}
      ${t(xr + 290, 282, 'El Cielo', 'is-sky')}${t(xr + 290, 540, 'El Espacio', 'is-space')}${t(xr + 290, H - 22, 'El Infierno', 'is-hell')}
    </g>`;
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
    let pan = null;
    const setVB = () => { const v = viewOf(S); svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`); };

    // v3.9: acercar/alejar con los botones y con la rueda; arrastrar el fondo mueve el mapa
    root.querySelectorAll('[data-map-zoom]').forEach((b) => b.addEventListener('click', () => {
      const z = b.dataset.mapZoom;
      if (z === 'fit') S.mapView = clampView({ x: -40, y: -30, w: W + 80, h: H + 60 });
      else zoomView(S, z === 'in' ? 0.8 : 1.25);
      setVB();
    }));
    svg.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const p = svgPoint(svg, ev);
      zoomView(S, ev.deltaY < 0 ? 0.88 : 1.14, p.x, p.y);
      setVB();
    }, { passive: false });

    svg.addEventListener('pointerdown', (ev) => {
      const node = ev.target.closest('[data-node]');
      const p = svgPoint(svg, ev);
      if (!node) {
        if (S.mapPlacing) {
          S.mapPlacing = false;
          Ed.view.newRegionAt({ x: Math.round(Math.max(30, Math.min(W - 30, p.x))), y: Math.round(Math.max(30, Math.min(H - 30, p.y))) });
          return;
        }
        const rect = svg.getBoundingClientRect();
        const v = viewOf(S);
        pan = { cx: ev.clientX, cy: ev.clientY, v: { ...v }, k: v.w / Math.max(1, rect.width), pointerId: ev.pointerId };
        try { svg.setPointerCapture(ev.pointerId); } catch (err) { /* nada */ }
        svg.classList.add('is-panning');
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
      if (pan) {
        S.mapView = clampView({ ...pan.v, x: pan.v.x - (ev.clientX - pan.cx) * pan.k, y: pan.v.y - (ev.clientY - pan.cy) * pan.k });
        setVB();
        return;
      }
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
      if (pan) { try { svg.releasePointerCapture(pan.pointerId); } catch (err) { /* nada */ } pan = null; svg.classList.remove('is-panning'); return; }
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
    svg.addEventListener('pointercancel', () => { drag = null; pan = null; rerender(); });
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
