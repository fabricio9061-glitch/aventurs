/* ============================================================
   Aventurs — View: Map (v1.5.7b)
   Pantalla completa con mapa visual de regiones (nodos+líneas).
   Reemplaza el modal de viaje. Click en nodo viaja directo.
   ============================================================ */

(function (A) {
  'use strict';

  let mainEl = null;
  let unsubs = [];

  function render() {
    if (!mainEl) return;
    const w = A.State.world;
    if (!w) { mainEl.innerHTML = ''; return; }
    const currentRegion = A.Data.getById('regions', w.regionId);
    if (!currentRegion) {
      mainEl.innerHTML = `<div class="empty-tab muted">Región desconocida.</div>`;
      return;
    }

    mainEl.innerHTML = `
      <section class="map-view">
        <header class="map-view-header">
          <button class="btn btn-back-map" data-action="back-from-map" title="Volver (Esc)">
            <span>←</span>
            <span>Volver</span>
          </button>
          <div class="map-view-title">
            <span class="map-view-icon">🗺️</span>
            <span>Mapa del mundo</span>
          </div>
          <div class="map-view-current">
            <span class="dim">Estás en</span>
            <span class="map-view-region">${currentRegion.icon || '📍'} ${A.Utils.escapeHtml(currentRegion.name)}</span>
          </div>
        </header>

        <div class="map-view-legend">
          <span class="map-legend-item"><span class="map-legend-dot is-current"></span>Tu posición</span>
          <span class="map-legend-item"><span class="map-legend-dot is-neighbor"></span>Disponible (click para viajar)</span>
          <span class="map-legend-item"><span class="map-legend-dot is-far"></span>Lejano (necesita escalas)</span>
        </div>

        <div class="map-view-canvas">
          ${renderMapSvg(currentRegion)}
          <div class="map-zoom-controls">
            <button class="map-zoom-btn" data-map-zoom="in" title="Acercar (rueda del mouse)">+</button>
            <button class="map-zoom-btn" data-map-zoom="out" title="Alejar (rueda del mouse)">−</button>
            <button class="map-zoom-btn map-zoom-reset" data-map-zoom="reset" title="Restablecer zoom y posición">⊙</button>
          </div>
        </div>

        <footer class="map-view-hint muted">
          🖱️ Rueda para zoom · Arrastrar para mover · Click en nodo dorado para viajar · <kbd>Esc</kbd> para volver
        </footer>
      </section>
    `;

    bindEvents();
  }

  function renderMapSvg(currentRegion) {
    const allRegions = A.Data.regions || [];
    if (allRegions.length === 0) return '';

    // BFS: distancia de cada región al actual
    const dist = {};
    dist[currentRegion.id] = 0;
    const queue = [currentRegion.id];
    while (queue.length > 0) {
      const id = queue.shift();
      const reg = allRegions.find((r) => r.id === id);
      if (!reg) continue;
      for (const cid of (reg.connections || [])) {
        if (dist[cid] === undefined) {
          dist[cid] = dist[id] + 1;
          queue.push(cid);
        }
      }
    }

    // Agrupar por distancia (anillos)
    const rings = {};
    for (const r of allRegions) {
      const d = dist[r.id];
      if (d === undefined) continue;
      if (!rings[d]) rings[d] = [];
      rings[d].push(r);
    }

    // Posicionar: centro grande para que llene la pantalla
    const cx = 500, cy = 350;
    const ringRadii = [0, 130, 240, 340, 430];
    const positions = {};
    for (const dStr of Object.keys(rings)) {
      const d = parseInt(dStr, 10);
      const ring = rings[d];
      const radius = ringRadii[d] != null ? ringRadii[d] : 430 + (d - 4) * 90;
      if (d === 0) {
        positions[ring[0].id] = { x: cx, y: cy };
      } else {
        const n = ring.length;
        // Offset de ángulo según anillo para que no queden alineados
        const angleOffset = -Math.PI / 2 + (d * 0.3);
        for (let i = 0; i < n; i++) {
          const angle = angleOffset + (2 * Math.PI * i) / n;
          positions[ring[i].id] = {
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
          };
        }
      }
    }

    // Bounds del viewBox
    const xs = Object.values(positions).map((p) => p.x);
    const ys = Object.values(positions).map((p) => p.y);
    const padding = 80;
    const minX = Math.min(...xs) - padding;
    const maxX = Math.max(...xs) + padding;
    const minY = Math.min(...ys) - padding;
    const maxY = Math.max(...ys) + padding;
    const w = maxX - minX, h = maxY - minY;

    // Líneas (edges únicas)
    const drawnEdges = new Set();
    const lines = [];
    for (const r of allRegions) {
      if (!positions[r.id]) continue;
      for (const cid of (r.connections || [])) {
        if (!positions[cid]) continue;
        const edgeKey = [r.id, cid].sort().join('-');
        if (drawnEdges.has(edgeKey)) continue;
        drawnEdges.add(edgeKey);
        const a = positions[r.id], b = positions[cid];
        const isFromCurrent = r.id === currentRegion.id || cid === currentRegion.id;
        const cls = isFromCurrent ? 'map-edge map-edge-active' : 'map-edge';
        lines.push(`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" class="${cls}" />`);
      }
    }

    // Nodos
    const nodes = [];
    for (const r of allRegions) {
      if (!positions[r.id]) continue;
      const p = positions[r.id];
      const isCurrent = r.id === currentRegion.id;
      const isNeighbor = (currentRegion.connections || []).includes(r.id);
      const reachable = isCurrent || isNeighbor;
      const isCombat = r.type === 'combat';
      const biomeCls = r.biome ? `biome-${r.biome}` : '';
      const cls = `map-node ${isCurrent ? 'is-current' : ''} ${isNeighbor ? 'is-neighbor' : ''} ${!reachable ? 'is-far' : ''} is-${r.type} ${biomeCls}`;
      const nodeRadius = isCurrent ? 38 : isNeighbor ? 32 : 24;
      const iconSize = isCurrent ? 32 : isNeighbor ? 26 : 20;
      const labelY = p.y + nodeRadius + 18;
      const labelSize = isCurrent ? 14 : isNeighbor ? 12 : 10;
      const dangerBadge = isCombat && reachable ? `
        <text x="${(p.x + nodeRadius * 0.7).toFixed(1)}" y="${(p.y - nodeRadius * 0.6).toFixed(1)}" font-size="14">⚔️</text>
      ` : '';
      nodes.push(`
        <g class="${cls}" data-map-region="${A.Utils.escapeHtml(r.id)}" ${isNeighbor ? 'data-clickable="1"' : ''}>
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${nodeRadius}" />
          <text x="${p.x.toFixed(1)}" y="${(p.y + 1).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="${iconSize}" class="map-node-icon">${r.icon || '📍'}</text>
          <text x="${p.x.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" class="map-node-label" font-size="${labelSize}">${A.Utils.escapeHtml(r.name)}</text>
          ${dangerBadge}
        </g>
      `);
    }

    return `
      <svg class="map-fullscreen-svg" viewBox="${minX} ${minY} ${w} ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
        <g class="map-transform-g">
          <g class="map-edges">${lines.join('')}</g>
          <g class="map-nodes">${nodes.join('')}</g>
        </g>
      </svg>
    `;
  }

  function bindEvents() {
    mainEl.querySelectorAll('[data-action="back-from-map"]').forEach((b) => {
      b.addEventListener('click', () => closeMap());
    });
    // Click en nodos clickables (vecinos)
    mainEl.querySelectorAll('[data-clickable="1"][data-map-region]').forEach((g) => {
      g.style.cursor = 'pointer';
      // Usamos mousedown/mouseup en el propio nodo para detectar click "puro"
      // (sin movimiento significativo) y dispara el viaje.
      let nodeMouseDownX = 0, nodeMouseDownY = 0, nodeMouseDownTime = 0;
      g.addEventListener('mousedown', (e) => {
        e.stopPropagation(); // Importante: no propagar al canvas para que no inicie un drag
        nodeMouseDownX = e.clientX;
        nodeMouseDownY = e.clientY;
        nodeMouseDownTime = Date.now();
      });
      g.addEventListener('mouseup', (e) => {
        e.stopPropagation();
        const dx = Math.abs(e.clientX - nodeMouseDownX);
        const dy = Math.abs(e.clientY - nodeMouseDownY);
        const dt = Date.now() - nodeMouseDownTime;
        // Si no movió mucho y fue rápido, es click → viajar
        if (dx < 6 && dy < 6 && dt < 600) {
          const regionId = g.dataset.mapRegion;
          if (!regionId) return;
          const result = A.Travel.start(regionId);
          // Travel.start devuelve {ok: bool, error?, traveling?}
          if (result && result.ok) {
            closeMap();
          } else if (result && result.error) {
            // Mostrar error como crónica
            A.State.addChronicle({ type: 'note', text: result.error });
          }
        }
      });
      // Touch: tap directo
      g.addEventListener('touchend', (e) => {
        e.stopPropagation();
        const regionId = g.dataset.mapRegion;
        if (!regionId) return;
        const result = A.Travel.start(regionId);
        if (result && result.ok) closeMap();
      });
    });
    // Zoom & Pan
    setupZoomPan();
  }

  // Zoom + pan state
  let zoom = 1.0;
  let panX = 0, panY = 0;
  let isDragging = false;
  let dragStartX = 0, dragStartY = 0;
  let didDragRecently = false;

  function setupZoomPan() {
    const canvas = mainEl.querySelector('.map-view-canvas');
    const svg = mainEl.querySelector('.map-fullscreen-svg');
    const transformG = mainEl.querySelector('.map-transform-g');
    if (!canvas || !svg || !transformG) return;

    // Reset state on remount
    zoom = 1.0; panX = 0; panY = 0;
    applyTransform(transformG);

    // Botones zoom in/out/reset
    const zoomInBtn = mainEl.querySelector('[data-map-zoom="in"]');
    const zoomOutBtn = mainEl.querySelector('[data-map-zoom="out"]');
    const resetBtn = mainEl.querySelector('[data-map-zoom="reset"]');
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => { zoom = Math.min(3, zoom * 1.25); applyTransform(transformG); });
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => { zoom = Math.max(0.5, zoom / 1.25); applyTransform(transformG); });
    if (resetBtn) resetBtn.addEventListener('click', () => { zoom = 1.0; panX = 0; panY = 0; applyTransform(transformG); });

    // Wheel = zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.111;
      const newZoom = Math.max(0.5, Math.min(3, zoom * delta));
      zoom = newZoom;
      applyTransform(transformG);
    }, { passive: false });

    // Drag (mouse) = pan
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      didDragRecently = false;
      dragStartX = e.clientX - panX;
      dragStartY = e.clientY - panY;
      canvas.classList.add('is-dragging');
    });
    document.addEventListener('mousemove', onPanMove);
    document.addEventListener('mouseup', onPanEnd);

    // Touch (móvil) = pan
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      isDragging = true;
      didDragRecently = false;
      dragStartX = e.touches[0].clientX - panX;
      dragStartY = e.touches[0].clientY - panY;
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      if (!isDragging || e.touches.length !== 1) return;
      panX = e.touches[0].clientX - dragStartX;
      panY = e.touches[0].clientY - dragStartY;
      didDragRecently = true;
      applyTransform(transformG);
    }, { passive: true });
    canvas.addEventListener('touchend', () => {
      isDragging = false;
      setTimeout(() => { didDragRecently = false; }, 100);
    });

    function onPanMove(e) {
      if (!isDragging) return;
      const newPanX = e.clientX - dragStartX;
      const newPanY = e.clientY - dragStartY;
      // Detectar drag real (movimiento mayor a 4px)
      if (Math.abs(newPanX - panX) > 2 || Math.abs(newPanY - panY) > 2) {
        didDragRecently = true;
      }
      panX = newPanX;
      panY = newPanY;
      applyTransform(transformG);
    }
    function onPanEnd() {
      if (isDragging) {
        isDragging = false;
        canvas.classList.remove('is-dragging');
        // Mantener didDragRecently un poco para que el click en nodo no se dispare después de drag
        setTimeout(() => { didDragRecently = false; }, 100);
      }
    }
  }

  function applyTransform(g) {
    if (!g) return;
    g.setAttribute('transform', `translate(${panX} ${panY}) scale(${zoom})`);
  }

  function closeMap() {
    A.State.ui.showMap = false;
    A.Bus.emit('view:changed');
  }

  // Esc para cerrar
  let escHandler = null;
  function attachEscListener() {
    detachEscListener();
    escHandler = (e) => {
      if (e.key === 'Escape') closeMap();
    };
    document.addEventListener('keydown', escHandler);
  }
  function detachEscListener() {
    if (escHandler) {
      document.removeEventListener('keydown', escHandler);
      escHandler = null;
    }
  }

  function subscribe() {
    unsubs.push(A.Bus.on('region:changed', render));
  }
  function unsubscribe() {
    unsubs.forEach((u) => u && u());
    unsubs = [];
  }

  const MapView = {
    mount(container) {
      mainEl = container;
      render();
      unsubscribe();
      subscribe();
      attachEscListener();
    },
    unmount() {
      unsubscribe();
      detachEscListener();
      if (mainEl) mainEl.innerHTML = '';
    },
    rerender: render,
  };

  A.Views = A.Views || {};
  A.Views.Map = MapView;
})(window.Aventurs);
