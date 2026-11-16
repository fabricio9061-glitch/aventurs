/* ============================================================
   Aventurs — Mapa del reino (v2.0)
   Pergamino dibujado en SVG, con el mismo grafo de caminos de siempre:
     - cada zona con su ícono pixel del bioma
     - caminos curvos de tinta; los que salen de donde estás, en dorado
     - niebla: lo que todavía no conocés aparece como "?"
     - candado y nivel en las zonas que todavía no podés pisar
     - nombres que no se pisan con los caminos (posición fija por zona)
   Tocás una zona y abajo aparece su ficha: qué es, cuántos pasos,
   qué te falta y el botón para viajar.
   Rueda o botones para el zoom, arrastrar para moverse, Esc para volver.
   ============================================================ */

(function (A) {
  'use strict';

  const W = 960;
  const H = 680;
  const U = () => A.UI;

  let mainEl = null;
  let selectedId = null;
  let view = { x: 0, y: 0, w: W, h: H };
  let escHandler = null;
  let drag = null;

  // Posiciones de respaldo (por si una región editada perdió las suyas)
  const FALLBACK_POS = {
    pueblo_inicial: [200, 330, 'b'], bosque_sombrio: [95, 200, 't'], cementerio: [175, 490, 'b'],
    pantano: [305, 525, 'b'], camino_real: [340, 330, 'r'], montanas: [470, 200, 't'],
    puerto: [480, 440, 'l'], torre_del_mago: [600, 520, 'b'], ruinas_perdidas: [720, 420, 'b'],
    desierto: [640, 280, 't'], catacumbas: [790, 300, 'b'], cuevas_ancestrales: [585, 105, 't'],
    volcan: [735, 125, 'b'], infierno: [885, 65, 'b'], nido_de_dragones: [885, 200, 'b'],
    alta_mar: [500, 595, 'b'], abismo_marino: [690, 625, 'r'],
  };

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }
  function seeded(seed) {
    let s = seed || 1;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }

  /** Posición y lado de la etiqueta de cada región. */
  function layout() {
    const regions = A.Data.regions;
    const pos = {};
    const seedById = {};
    for (const r of (A.Seed && A.Seed.regions) || []) seedById[r.id] = r;
    for (const r of regions) {
      const src = (r.pos && typeof r.pos.x === 'number') ? r : (seedById[r.id] && seedById[r.id].pos ? seedById[r.id] : null);
      if (src) pos[r.id] = { x: src.pos.x, y: src.pos.y, label: src.labelAt || r.labelAt || 'b' };
      else if (FALLBACK_POS[r.id]) pos[r.id] = { x: FALLBACK_POS[r.id][0], y: FALLBACK_POS[r.id][1], label: FALLBACK_POS[r.id][2] };
    }
    // Regiones nuevas del editor: cerca de algún vecino ya ubicado, sin pisar a nadie
    let guard = 0;
    let pending = regions.filter((r) => !pos[r.id]);
    while (pending.length && guard++ < 50) {
      for (const r of pending) {
        const anchor = (r.connections || []).map((id) => pos[id]).find(Boolean) || { x: W / 2, y: H / 2 };
        const rnd = seeded(hash(r.id));
        let best = null;
        for (let k = 0; k < 24; k++) {
          const ang = rnd() * Math.PI * 2;
          const dist = 95 + rnd() * 50;
          const x = Math.max(60, Math.min(W - 60, anchor.x + Math.cos(ang) * dist));
          const y = Math.max(60, Math.min(H - 60, anchor.y + Math.sin(ang) * dist));
          const near = Object.values(pos).reduce((m, p) => Math.min(m, Math.hypot(p.x - x, p.y - y)), 999);
          if (!best || near > best.near) best = { x, y, near };
        }
        pos[r.id] = { x: best.x, y: best.y, label: 'b' };
      }
      pending = regions.filter((r) => !pos[r.id]);
    }
    return pos;
  }

  // ============================================================
  // Conocimiento del jugador
  // ============================================================

  function knowledge() {
    const w = A.State.world || {};
    const visited = new Set(w.visited || []);
    if (w.regionId) visited.add(w.regionId);
    const known = new Set(visited);
    for (const id of visited) {
      const r = A.Data.getById('regions', id);
      for (const c of (r && r.connections) || []) known.add(c);
    }
    return { visited, known };
  }

  function requirements(region) {
    return A.Travel && A.Travel.evaluateRegionRequirements ? A.Travel.evaluateRegionRequirements(region) : [];
  }
  function isLocked(region) { return requirements(region).some((r) => !r.met); }
  function minLevel(region) { return (region.unlockConditions && region.unlockConditions.minLevel) || 1; }

  /** Camino más corto (en tramos) entre dos regiones. */
  function route(fromId, toId) {
    if (fromId === toId) return [fromId];
    const prev = { [fromId]: null };
    const queue = [fromId];
    while (queue.length) {
      const id = queue.shift();
      const r = A.Data.getById('regions', id);
      for (const n of (r && r.connections) || []) {
        if (n in prev) continue;
        prev[n] = id;
        if (n === toId) {
          const path = [toId];
          let cur = id;
          while (cur) { path.unshift(cur); cur = prev[cur]; }
          return path;
        }
        queue.push(n);
      }
    }
    return null;
  }

  // ============================================================
  // Dibujo
  // ============================================================

  function roadPath(a, b, id) {
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const bend = ((hash(id) % 2) ? 1 : -1) * Math.min(26, len * 0.09);
    const cx = mx + (-dy / len) * bend;
    const cy = my + (dx / len) * bend;
    return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }

  /** Dibujitos de tinta alrededor de cada zona (árboles, montañas, olas, dunas...). */
  function decor(region, p) {
    const rnd = seeded(hash(region.id + ':decor'));
    const out = [];
    const spots = [];
    for (let i = 0; i < 5; i++) {
      const ang = rnd() * Math.PI * 2;
      const dist = 44 + rnd() * 26;
      const x = p.x + Math.cos(ang) * dist;
      const y = p.y + Math.sin(ang) * dist * 0.8;
      // no tapar la etiqueta
      if (p.label === 'b' && y > p.y + 20 && Math.abs(x - p.x) < 60) continue;
      if (p.label === 't' && y < p.y - 20 && Math.abs(x - p.x) < 60) continue;
      if (p.label === 'r' && x > p.x + 20 && Math.abs(y - p.y) < 18) continue;
      if (p.label === 'l' && x < p.x - 20 && Math.abs(y - p.y) < 18) continue;
      if (x < 12 || x > W - 12 || y < 12 || y > H - 12) continue;
      spots.push([x, y]);
    }
    const b = region.biome;
    for (const [x, y] of spots.slice(0, 4)) {
      if (b === 'forest' || b === 'swamp') {
        out.push(`<path class="ink-tree" d="M ${x} ${y - 9} L ${x + 6} ${y + 3} L ${x - 6} ${y + 3} Z M ${x} ${y + 3} L ${x} ${y + 7}"/>`);
      } else if (b === 'mountain' || b === 'cave' || b === 'volcano') {
        out.push(`<path class="ink-mount" d="M ${x - 11} ${y + 6} L ${x - 2} ${y - 8} L ${x + 3} ${y - 1} L ${x + 6} ${y - 5} L ${x + 12} ${y + 6}"/>`);
      } else if (b === 'sea' || b === 'abyss' || b === 'coast') {
        out.push(`<path class="ink-wave" d="M ${x - 10} ${y} q 5 -5 10 0 t 10 0"/>`);
      } else if (b === 'desert') {
        out.push(`<path class="ink-dune" d="M ${x - 12} ${y + 3} q 12 -12 24 0"/>`);
      } else if (b === 'graveyard' || b === 'crypt') {
        out.push(`<path class="ink-cross" d="M ${x} ${y - 7} L ${x} ${y + 6} M ${x - 4} ${y - 3} L ${x + 4} ${y - 3}"/>`);
      } else if (b === 'ruins') {
        out.push(`<path class="ink-mount" d="M ${x - 7} ${y + 6} L ${x - 7} ${y - 4} M ${x} ${y + 6} L ${x} ${y - 8} M ${x + 7} ${y + 6} L ${x + 7} ${y - 2}"/>`);
      } else if (b === 'hell' || b === 'lair') {
        out.push(`<path class="ink-fire" d="M ${x - 5} ${y + 5} q -2 -8 3 -12 q 0 6 4 6 q 2 -4 1 -7 q 6 6 2 13 Z"/>`);
      } else {
        out.push(`<path class="ink-grass" d="M ${x - 6} ${y + 4} l 2 -6 M ${x} ${y + 4} l 0 -8 M ${x + 6} ${y + 4} l -2 -6"/>`);
      }
    }
    return out.join('');
  }

  function labelAttrs(p) {
    switch (p.label) {
      case 't': return { x: p.x, y: p.y - 36, anchor: 'middle' };
      case 'l': return { x: p.x - 34, y: p.y + 5, anchor: 'end' };
      case 'r': return { x: p.x + 34, y: p.y + 5, anchor: 'start' };
      default: return { x: p.x, y: p.y + 44, anchor: 'middle' };
    }
  }

  function svgHtml() {
    const pos = layout();
    const { visited, known } = knowledge();
    const here = A.State.world.regionId;
    const current = A.Data.getById('regions', here);
    const near = new Set((current && current.connections) || []);
    const regions = A.Data.regions.filter((r) => pos[r.id]);

    // Caminos (una sola vez cada par)
    const seen = new Set();
    const roads = [];
    for (const r of regions) {
      for (const c of r.connections || []) {
        if (!pos[c]) continue;
        const key = [r.id, c].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const a = pos[r.id];
        const b = pos[c];
        const isRoute = (r.id === here && near.has(c)) || (c === here && near.has(r.id));
        const bothKnown = known.has(r.id) && known.has(c);
        const anyKnown = known.has(r.id) || known.has(c);
        if (!anyKnown) continue;
        const cls = isRoute ? 'is-route' : bothKnown ? (visited.has(r.id) && visited.has(c) ? 'is-walked' : 'is-known') : 'is-fog';
        roads.push(`<path class="road ${cls}" d="${roadPath(a, b, key)}"/>`);
      }
    }

    const nodes = regions.map((r) => {
      const p = pos[r.id];
      const isFog = !known.has(r.id);
      const locked = !isFog && isLocked(r);
      const cls = [
        'node',
        r.id === here ? 'is-current' : '',
        near.has(r.id) ? 'is-near' : '',
        visited.has(r.id) ? 'is-visited' : '',
        isFog ? 'is-fog' : '',
        locked ? 'is-locked' : '',
        r.id === selectedId ? 'is-selected' : '',
        r.type === 'safe' ? 'is-safe' : 'is-danger',
      ].filter(Boolean).join(' ');
      const iconUrl = isFog ? '' : (A.ItemSprites && A.ItemSprites.iconUrl ? A.ItemSprites.iconUrl(`biome-${r.biome}`) || A.ItemSprites.iconUrl('map') : '');
      const lab = labelAttrs(p);
      const lockUrl = locked && A.ItemSprites ? A.ItemSprites.iconUrl('lock') : '';
      return `
        <g class="${cls}" data-region="${U().esc(r.id)}" transform="translate(${p.x} ${p.y})" tabindex="0" role="button" aria-label="${U().esc(isFog ? 'Zona sin explorar' : r.name)}">
          <circle class="node-halo" r="34"/>
          <circle class="node-ring" r="26"/>
          <circle class="node-disc" r="22"/>
          ${isFog ? '<text class="node-q" y="8" text-anchor="middle">?</text>' : `<image href="${iconUrl}" x="-16" y="-16" width="32" height="32" class="node-img"/>`}
          ${lockUrl ? `<g class="node-lock" transform="translate(17 -17)"><circle r="10"/><image href="${lockUrl}" x="-8" y="-8" width="16" height="16"/></g>` : ''}
          ${isFog ? '' : `<text class="node-label" x="${lab.x - p.x}" y="${lab.y - p.y}" text-anchor="${lab.anchor}">${U().esc(r.name)}</text>`}
          ${!isFog && (locked || !visited.has(r.id)) && minLevel(r) > 1 ? `<text class="node-lvl" x="${lab.x - p.x}" y="${lab.y - p.y + 14}" text-anchor="${lab.anchor}">Nivel ${minLevel(r)}</text>` : ''}
        </g>`;
    }).join('');

    const decorHtml = regions.filter((r) => known.has(r.id)).map((r) => decor(r, pos[r.id])).join('');
    const hp = pos[here];
    const pinUrl = A.ItemSprites ? A.ItemSprites.iconUrl('pin') : '';

    return `
      <svg class="map2-svg" viewBox="${view.x} ${view.y} ${view.w} ${view.h}" preserveAspectRatio="xMidYMid meet" aria-label="Mapa del reino">
        <defs>
          <radialGradient id="mp-paper" cx="50%" cy="45%" r="75%">
            <stop offset="0%" stop-color="#f3e3bd"/>
            <stop offset="70%" stop-color="#e6cf9c"/>
            <stop offset="100%" stop-color="#c9a76a"/>
          </radialGradient>
          <linearGradient id="mp-sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#9fb8b4" stop-opacity="0"/>
            <stop offset="100%" stop-color="#7f9fa0" stop-opacity="0.45"/>
          </linearGradient>
          <filter id="mp-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>
            <feColorMatrix type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.12  0 0 0 0.10 0"/>
            <feComposite in2="SourceGraphic" operator="in"/>
          </filter>
        </defs>
        <rect x="-400" y="-400" width="${W + 800}" height="${H + 800}" fill="#2a1f14"/>
        <rect width="${W}" height="${H}" fill="url(#mp-paper)"/>
        <path class="map-sea" d="M 360 ${H} C 380 600, 440 548, 560 560 S 760 560, 820 600 S ${W} 610, ${W} 640 L ${W} ${H} Z" fill="url(#mp-sea)"/>
        <rect width="${W}" height="${H}" filter="url(#mp-grain)" opacity="0.9"/>
        <rect class="map-frame" x="8" y="8" width="${W - 16}" height="${H - 16}" rx="6"/>
        <g class="map-compass" transform="translate(70 610)">
          <circle r="30"/>
          <path d="M 0 -26 L 6 0 L 0 26 L -6 0 Z" class="cp-a"/>
          <path d="M -26 0 L 0 6 L 26 0 L 0 -6 Z" class="cp-b"/>
          <text y="-34" text-anchor="middle">N</text>
        </g>
        <g class="map-decor">${decorHtml}</g>
        <g class="map-roads">${roads.join('')}</g>
        <g class="map-nodes">${nodes}</g>
        ${hp ? `<g class="map-you" transform="translate(${hp.x} ${hp.y - 30})"><image href="${pinUrl}" x="-12" y="-26" width="24" height="24"/></g>` : ''}
      </svg>
    `;
  }

  // ============================================================
  // Ficha de la zona elegida
  // ============================================================

  function cardHtml() {
    const here = A.State.world.regionId;
    const id = selectedId || here;
    const r = A.Data.getById('regions', id);
    const cur = A.Data.getById('regions', here);
    if (!r || !cur) return '';
    const { known, visited } = knowledge();
    if (!known.has(id)) {
      return `
        <div class="map2-card is-fog">
          <span class="map2-card-icon">${U().icon('question', 36)}</span>
          <div class="map2-card-main">
            <div class="map2-card-name">Tierras sin explorar</div>
            <p class="map2-card-desc">Nadie te contó qué hay ahí. Seguí avanzando por los caminos para descubrirlo.</p>
          </div>
        </div>`;
    }
    const reqs = requirements(r);
    const locked = reqs.some((q) => !q.met);
    const isHere = id === here;
    const isNear = (cur.connections || []).includes(id);
    const steps = isNear && A.Travel.calculateTravelSteps ? A.Travel.calculateTravelSteps(r, cur) : null;
    const path = !isHere && !isNear ? route(here, id) : null;
    const enemies = A.Data.enemiesInRegion(id).length;

    let action = '';
    if (isHere) {
      const ns = (cur.connections || []).map((c) => A.Data.getById('regions', c)).filter(Boolean);
      action = `
        <div class="map2-near">
          <span class="map2-near-label">Desde acá podés ir a:</span>
          ${ns.map((n) => `<button class="map2-chip ${isLocked(n) ? 'is-locked' : ''}" data-map-select="${U().esc(n.id)}">${U().biomeIcon(n, 18)}<span>${U().esc(n.name)}</span>${isLocked(n) ? U().icon('lock', 14) : ''}</button>`).join('')}
        </div>`;
    } else if (isNear && !locked) {
      action = `<button class="btn-primary map2-go" data-map-travel="${U().esc(id)}">${U().icon('boot', 22)}<span>Viajar · ${steps} paso${steps === 1 ? '' : 's'}</span></button>`;
    } else if (isNear && locked) {
      action = `<button class="btn-primary map2-go" disabled>${U().icon('lock', 20)}<span>Todavía no podés ir</span></button>`;
    } else if (path) {
      const names = path.map((pid) => { const x = A.Data.getById('regions', pid); return x ? x.name : pid; });
      action = `<p class="map2-route">${U().icon('compass', 18)}<span>No hay camino directo. Ruta: ${names.map((n) => U().esc(n)).join(' › ')} (${path.length - 1} tramos).</span></p>`;
    }

    return `
      <div class="map2-card ${locked ? 'is-locked' : ''} ${isHere ? 'is-here' : ''}">
        <span class="map2-card-icon">${U().biomeIcon(r, 40)}</span>
        <div class="map2-card-main">
          <div class="map2-card-name">${U().esc(r.name)}${isHere ? '<span class="map2-here-tag">Estás acá</span>' : ''}</div>
          <div class="map2-card-pills">
            <span class="pill ${r.type === 'safe' ? 'pill-safe' : 'pill-combat'}">${r.type === 'safe' ? 'Zona segura' : 'Zona de peligro'}</span>
            <span class="pill pill-tier">Nivel ${minLevel(r)}+</span>
            ${enemies && r.type !== 'safe' ? `<span class="map2-meta">${enemies} criaturas</span>` : ''}
            ${visited.has(id) ? '' : '<span class="map2-meta">Sin visitar</span>'}
          </div>
          <p class="map2-card-desc">${U().esc(r.description || '')}</p>
          ${locked ? `<ul class="map2-reqs">${reqs.map((q) => `<li class="${q.met ? 'is-met' : ''}">${U().icon(q.met ? 'check' : 'lock', 14)}<span>${U().esc(q.label)}${q.current != null && q.target != null && !q.met ? ` (${q.current}/${q.target})` : ''}</span></li>`).join('')}</ul>` : ''}
          ${action}
        </div>
      </div>`;
  }

  // ============================================================
  // Render y eventos
  // ============================================================

  function render() {
    if (!mainEl) return;
    const w = A.State.world;
    if (!w) { mainEl.innerHTML = ''; return; }
    const cur = A.Data.getById('regions', w.regionId);
    if (!selectedId) selectedId = w.regionId;
    mainEl.innerHTML = `
      <section class="map2">
        <header class="map2-head">
          <button class="btn-ghost map2-back" data-map-back title="Volver (Esc)">Volver</button>
          <h2 class="map2-title">${U().icon('map', 26)}<span>Mapa del reino</span></h2>
          <span class="map2-where">${U().icon('pin', 18)}<span>Estás en <b>${U().esc(cur ? cur.name : '')}</b></span></span>
        </header>
        <div class="map2-stage">
          ${svgHtml()}
          <div class="map2-zoom">
            <button data-map-zoom="in" aria-label="Acercar">+</button>
            <button data-map-zoom="out" aria-label="Alejar">−</button>
            <button data-map-zoom="fit" aria-label="Ver todo">${U().icon('compass', 18)}</button>
          </div>
        </div>
        <div class="map2-info">${cardHtml()}</div>
      </section>
    `;
    bind();
  }

  function refreshCard() {
    const box = mainEl && mainEl.querySelector('.map2-info');
    if (box) box.innerHTML = cardHtml();
    mainEl.querySelectorAll('.node').forEach((n) => n.classList.toggle('is-selected', n.dataset.region === selectedId));
    bindCard();
  }

  function setView(v) {
    const minW = W / 3;
    const maxW = W * 1.15;
    const nw = Math.max(minW, Math.min(maxW, v.w));
    const nh = nw * (H / W);
    const nx = Math.max(-W * 0.2, Math.min(W * 1.2 - nw, v.x));
    const ny = Math.max(-H * 0.2, Math.min(H * 1.2 - nh, v.y));
    view = { x: nx, y: ny, w: nw, h: nh };
    const svg = mainEl && mainEl.querySelector('.map2-svg');
    if (svg) svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  }

  function zoomAt(factor, cx, cy) {
    const nw = view.w * factor;
    const nh = view.h * factor;
    setView({ x: cx - (cx - view.x) * factor, y: cy - (cy - view.y) * factor, w: nw, h: nh });
  }

  function svgPoint(svg, clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    const scale = Math.max(view.w / rect.width, view.h / rect.height);
    const offX = (rect.width * scale - view.w) / 2;
    const offY = (rect.height * scale - view.h) / 2;
    return { x: view.x + (clientX - rect.left) * scale - offX, y: view.y + (clientY - rect.top) * scale - offY, scale };
  }

  function select(id) {
    selectedId = id;
    refreshCard();
  }

  function travel(id) {
    const res = A.Travel.start(id);
    if (!res || !res.ok) {
      const box = mainEl.querySelector('.map2-info');
      if (box && res && res.error) box.insertAdjacentHTML('afterbegin', `<p class="map2-error">${U().esc(res.error)}</p>`);
    }
    // travel:started cierra el mapa desde el shell
  }

  function bindCard() {
    mainEl.querySelectorAll('[data-map-travel]').forEach((b) => b.addEventListener('click', () => travel(b.dataset.mapTravel)));
    mainEl.querySelectorAll('[data-map-select]').forEach((b) => b.addEventListener('click', () => select(b.dataset.mapSelect)));
  }

  function bind() {
    const svg = mainEl.querySelector('.map2-svg');
    mainEl.querySelector('[data-map-back]').addEventListener('click', closeMap);
    mainEl.querySelectorAll('[data-map-zoom]').forEach((b) => b.addEventListener('click', () => {
      const z = b.dataset.mapZoom;
      if (z === 'fit') { setView({ x: 0, y: 0, w: W, h: H }); return; }
      zoomAt(z === 'in' ? 0.8 : 1.25, view.x + view.w / 2, view.y + view.h / 2);
    }));
    mainEl.querySelectorAll('.node').forEach((n) => {
      n.addEventListener('click', (e) => {
        if (drag && drag.moved) return;
        e.stopPropagation();
        select(n.dataset.region);
      });
      n.addEventListener('dblclick', () => {
        const cur = A.Data.getById('regions', A.State.world.regionId);
        if (cur && (cur.connections || []).includes(n.dataset.region)) travel(n.dataset.region);
      });
      n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(n.dataset.region); } });
    });
    if (svg) {
      svg.addEventListener('wheel', (e) => {
        e.preventDefault();
        const pt = svgPoint(svg, e.clientX, e.clientY);
        zoomAt(e.deltaY > 0 ? 1.12 : 0.89, pt.x, pt.y);
      }, { passive: false });
      svg.addEventListener('pointerdown', (e) => {
        drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false, id: e.pointerId };
      });
      svg.addEventListener('pointermove', (e) => {
        if (!drag || drag.id !== e.pointerId) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        // 12px de tolerancia: un clic con la mano temblorosa sigue siendo un clic
        if (!drag.moved && Math.hypot(dx, dy) < 12) return;
        if (!drag.moved) { drag.moved = true; try { svg.setPointerCapture(e.pointerId); } catch (err) {} }
        const pt = svgPoint(svg, e.clientX, e.clientY);
        setView({ x: drag.vx - dx * pt.scale, y: drag.vy - dy * pt.scale, w: view.w, h: view.h });
      });
      const end = () => { setTimeout(() => { drag = null; }, 0); };
      svg.addEventListener('pointerup', end);
      svg.addEventListener('pointercancel', end);
    }
    bindCard();
  }

  function closeMap() {
    A.State.ui.showMap = false;
    A.Bus.emit('view:changed');
  }

  const MapView = {
    mount(container) {
      mainEl = container;
      selectedId = A.State.world ? A.State.world.regionId : null;
      // En pantallas chicas arranca acercado a donde estás
      view = { x: 0, y: 0, w: W, h: H };
      const narrow = (container.clientWidth || window.innerWidth) < 640;
      const here = narrow && selectedId ? layout()[selectedId] : null;
      if (here) {
        const w = W * 0.62;
        const h = H * 0.62;
        view = { x: Math.max(0, Math.min(W - w, here.x - w / 2)), y: Math.max(0, Math.min(H - h, here.y - h / 2)), w, h };
      }
      render();
      if (!escHandler) {
        escHandler = (e) => { if (e.key === 'Escape' && A.State.ui.showMap && !A.State.ui.openModal) closeMap(); };
        document.addEventListener('keydown', escHandler);
      }
    },
    unmount() {
      if (escHandler) { document.removeEventListener('keydown', escHandler); escHandler = null; }
      if (mainEl) mainEl.innerHTML = '';
    },
    route,
  };

  A.Views = A.Views || {};
  A.Views.Map = MapView;
})(window.Aventurs);
