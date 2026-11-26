/* ============================================================
   Aventurs — Mapa del reino (v2.0; v3.1: ficha a la derecha)
   Pergamino dibujado en SVG, con el mismo grafo de caminos de siempre:
     - cada zona con su ícono pixel del bioma
     - caminos curvos de tinta; los que salen de donde estás, en dorado
     - niebla: lo que todavía no conocés aparece como "?"
     - candado y nivel en las zonas que todavía no podés pisar
     - nombres que no se pisan con los caminos (posición fija por zona)
   Tocás una zona y a la derecha aparece su ficha: qué es, cuántos pasos,
   qué te falta, el botón para viajar, quién vive ahí y qué criaturas
   conocés. El mapa queda fijo y entra entero en la pantalla.
   v3.1: en grupo, tu compañero aparece en el mapa (también viajando).
   Rueda o botones para el zoom, arrastrar para moverse, Esc para volver.
   ============================================================ */

(function (A) {
  'use strict';

  // v2.1: lienzo más grande para 31 zonas · v3.11: más ancho, con las Tierras Altas al este
  // v3.12: más ancho todavía: al este de las Tierras Altas, el Cielo, el Espacio y el Infierno profundo
  const W = 2400;
  const H = 860;
  const OLD_W = 1280; // donde termina el reino de antes (ahí empieza la Bruma)
  const HIGH_W = 1820; // donde terminan las Tierras Altas (ahí empiezan los tres reinos)
  const U = () => A.UI;

  let mainEl = null;
  let selectedId = null;
  let view = { x: 0, y: 0, w: W, h: H };
  // v3.14: el mapa llena también el alto de la pantalla (antes quedaba una franja con bandas arriba y abajo)
  let ASP = H / W;
  function containerAsp() {
    const svg = mainEl && mainEl.querySelector('.map2-svg');
    const r = svg ? svg.getBoundingClientRect() : null;
    return r && r.width > 0 && r.height > 0 ? Math.max(H / W, r.height / r.width) : H / W;
  }
  /** La vista que llena el alto, centrada (a lo ancho) en x. */
  function tallView(cx) {
    ASP = containerAsp();
    const h = H;
    const w = Math.min(W, h / ASP);
    // v3.19.1: si todo lo que conocés entra, se centra en eso (no en el borde del mapa)
    const box = knownBox();
    if (box && box.w + 160 <= w) cx = box.cx;
    return { x: Math.max(0, Math.min(W - w, (cx == null ? W / 2 : cx) - w / 2)), y: 0, w, h };
  }
  /** v3.19.1: el rectángulo de las zonas que conocés. */
  function knownBox() {
    const pos = layout();
    const { known } = knowledge();
    let x0 = Infinity; let x1 = -Infinity;
    for (const id of known) { const p = pos[id]; if (p) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); } }
    return x1 >= x0 ? { cx: (x0 + x1) / 2, w: x1 - x0 } : null;
  }
  let userMoved = false; // v3.19.1: si acercaste o arrastraste, al cambiar el tamaño se respeta lo tuyo
  /** v3.19.1: la vista siempre con la misma forma que el recuadro (sin franjas oscuras arriba y abajo). */
  function syncAspect() {
    const svg = mainEl && mainEl.querySelector('.map2-svg');
    if (!svg) return;
    if (!userMoved) { const here = selectedId ? layout()[selectedId] : null; setView(tallView(here ? here.x : null)); return; }
    const cx = view.x + view.w / 2;
    const cy = view.y + view.h / 2;
    ASP = containerAsp();
    const w = view.w;
    setView({ x: cx - w / 2, y: cy - (w * ASP) / 2, w });
  }
  let lastLabels = {}; // v3.11.1: dónde quedó cada nombre (para poner al compañero del otro lado)
  let escHandler = null;
  let drag = null;
  let offParty = null;
  let resizeHandler = null;

  // Posiciones de respaldo (por si una región editada perdió las suyas)
  const FALLBACK_POS = {
    pueblo_inicial: [300, 430, 'l'], bosque_sombrio: [165, 305, 'r'], bosque_suenos: [230, 175, 'l'],
    santuario_roble: [95, 80, 't'], bosque_susurros: [110, 470, 'b'], cementerio: [235, 585, 'b'],
    llanos_alba: [445, 545, 'l'], camino_real: [470, 410, 't'], aldea_piedrahonda: [455, 260, 'l'],
    minas_olvidadas: [355, 205, 't'], montanas: [650, 215, 't'], colinas_rotas: [675, 350, 'b'],
    ruinas_antorcha: [790, 430, 'l'], pantano: [365, 665, 'b'], costa_naufragios: [500, 715, 'r'],
    puerto: [650, 590, 't'], puerto_calavera: [300, 775, 'b'], mar_calaveras: [110, 740, 'b'],
    torre_del_mago: [820, 575, 'b'], alta_mar: [800, 745, 'b'], abismo_marino: [1010, 790, 't'],
    desierto: [890, 300, 't'], catacumbas: [1070, 320, 't'], velmora: [1195, 420, 't'],
    jardin_carmesi: [1180, 580, 'b'], pradera_ciclopes: [1030, 650, 'b'], ruinas_perdidas: [990, 470, 'r'],
    cuevas_ancestrales: [810, 120, 't'], volcan: [1000, 130, 'b'], infierno: [1190, 70, 'b'],
    nido_de_dragones: [1190, 215, 'b'],
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
  function decor(region, p, boxes) {
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
      if (boxes && boxes.some((b) => x > b[0] - 12 && x < b[2] + 12 && y > b[1] - 10 && y < b[3] + 10)) continue; // v3.11.1
      spots.push([x, y]);
    }
    const b = region.biome;
    for (const [x, y] of spots.slice(0, 4)) {
      if (b === 'forest' || b === 'swamp' || b === 'darkwood' || b === 'grove') {
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
      } else if (b === 'dream') {
        out.push(`<path class="ink-spark" d="M ${x} ${y - 6} L ${x + 1.5} ${y - 1.5} L ${x + 6} ${y} L ${x + 1.5} ${y + 1.5} L ${x} ${y + 6} L ${x - 1.5} ${y + 1.5} L ${x - 6} ${y} L ${x - 1.5} ${y - 1.5} Z"/>`);
      } else if (b === 'bloodwood' || b === 'gothic') {
        out.push(`<path class="ink-rose" d="M ${x} ${y + 7} L ${x} ${y - 1} M ${x - 3} ${y - 2} a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0"/>`);
      } else if (b === 'hills') {
        out.push(`<path class="ink-mount" d="M ${x - 12} ${y + 5} q 6 -10 12 0 q 6 -8 12 0"/>`);
      } else if (b === 'meadow') {
        out.push(`<path class="ink-grass" d="M ${x - 8} ${y + 4} q 8 -12 16 0 M ${x - 4} ${y + 4} l 0 -5 M ${x + 4} ${y + 4} l 0 -5"/>`);
      } else if (b === 'pirate') {
        out.push(`<path class="ink-wave" d="M ${x - 10} ${y + 4} l 20 0 l -4 5 l -12 0 Z M ${x} ${y + 4} l 0 -12 l 7 4 l -7 3"/>`);
      } else if (b === 'sky') { // v3.12: nubes
        out.push(`<path class="ink-cloud" d="M ${x - 10} ${y + 4} a 4 4 0 0 1 4 -5 a 5 5 0 0 1 9 -1 a 4 4 0 0 1 7 6 Z"/>`);
      } else if (b === 'space') { // v3.12: estrellas
        out.push(`<path class="ink-star" d="M ${x} ${y - 6} L ${x + 1.5} ${y - 1.5} L ${x + 6} ${y} L ${x + 1.5} ${y + 1.5} L ${x} ${y + 6} L ${x - 1.5} ${y + 1.5} L ${x - 6} ${y} L ${x - 1.5} ${y - 1.5} Z"/>`);
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

  // ============================================================
  // v3.11.1: etiquetas que no se pisan
  //   Cada nombre (y su "Nivel N") prueba varios lados alrededor de su zona y se queda
  //   con el que menos tapa a otros nombres y a otras zonas. Primero las zonas grandes
  //   (el lado que dice la región, si se puede), después las guaridas.
  // ============================================================

  let measureCtx = null;
  const widthCache = new Map();
  const fontsReady = () => !document.fonts || document.fonts.status === 'loaded';
  /** Ancho del texto con la letra del mapa (Cinzel, negrita). */
  function textWidth(txt, size) {
    const key = `${size}|${txt}`;
    if (widthCache.has(key)) return widthCache.get(key);
    let w = String(txt).length * size * 0.72;
    try {
      if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
      const fam = (getComputedStyle(document.documentElement).getPropertyValue('--font-display') || '').trim() || 'Cinzel, Georgia, serif';
      measureCtx.font = `700 ${size}px ${fam}`;
      w = measureCtx.measureText(String(txt)).width;
    } catch (e) { /* sin canvas: queda el estimado */ }
    if (fontsReady()) widthCache.set(key, w); // con la letra todavía cargando, se vuelve a medir
    return w;
  }
  // cuando termina de cargar la letra, se vuelven a acomodar los nombres
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { widthCache.clear(); try { refreshSvg(); } catch (e) { /* el mapa no está abierto */ } });
  }

  const SIDE_ORDER = ['b', 't', 'r', 'l', 'br', 'tr', 'bl', 'tl'];
  /** Dónde va el nombre según el lado: { x, y, anchor, lvlY, box }. */
  function placeAt(p, side, lair, nameW, lvlW) {
    const fs = lair ? 12 : 14;
    const R = lair ? 18 : 26;
    const g = lair ? 6 : 8; // aire entre el anillo y el texto
    const d = R + g;
    const asc = fs * 0.78, desc = fs * 0.24;
    let x, y, anchor;
    switch (side) {
      case 't': x = p.x; y = p.y - d - desc - 2; anchor = 'middle'; break;
      case 'r': x = p.x + d; y = p.y + fs * 0.32; anchor = 'start'; break;
      case 'l': x = p.x - d; y = p.y + fs * 0.32; anchor = 'end'; break;
      case 'tr': x = p.x + R * 0.72; y = p.y - R * 0.72 - 3; anchor = 'start'; break;
      case 'tl': x = p.x - R * 0.72; y = p.y - R * 0.72 - 3; anchor = 'end'; break;
      case 'br': x = p.x + R * 0.72; y = p.y + R * 0.72 + asc + 1; anchor = 'start'; break;
      case 'bl': x = p.x - R * 0.72; y = p.y + R * 0.72 + asc + 1; anchor = 'end'; break;
      default: x = p.x; y = p.y + d + asc; anchor = 'middle'; break;
    }
    const up = side === 't' || side === 'tr' || side === 'tl';
    const lvlY = lvlW ? (up ? y - fs - 1 : y + 13) : null;
    const span = (w) => (anchor === 'middle' ? [x - w / 2, x + w / 2] : anchor === 'start' ? [x, x + w] : [x - w, x]);
    const [nx0, nx1] = span(nameW);
    let box = [nx0 - 3, y - asc - 2, nx1 + 3, y + desc + 2];
    if (lvlW) {
      const [lx0, lx1] = span(lvlW);
      box = [Math.min(box[0], lx0 - 3), Math.min(box[1], lvlY - 11 * 0.78 - 2), Math.max(box[2], lx1 + 3), Math.max(box[3], lvlY + 11 * 0.24 + 2)];
    }
    return { x, y, anchor, lvlY, box, side };
  }
  const area = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));

  /** { id: { x, y, anchor, lvlY, box, side } } para las zonas que se ven. */
  function placeLabels(regions, pos, known, visited, here) {
    const out = {};
    // lo que no hay que tapar: los círculos de todas las zonas (también las que no se conocen) y tu marca
    const discs = regions.map((r) => {
      const p = pos[r.id]; const R = (r.type === 'lair' ? 18 : 26) + 1;
      return { id: r.id, box: [p.x - R, p.y - R, p.x + R, p.y + R] };
    });
    if (pos[here]) discs.push({ id: '_you', box: [pos[here].x - 12, pos[here].y - 58, pos[here].x + 12, pos[here].y - 30] });
    const placed = [];
    const order = regions.filter((r) => known.has(r.id))
      .sort((a, b) => ((a.id === here ? 0 : a.type === 'lair' ? 2 : 1) - (b.id === here ? 0 : b.type === 'lair' ? 2 : 1)));
    for (const r of order) {
      const p = pos[r.id];
      const lair = r.type === 'lair';
      const nameW = textWidth(r.name, lair ? 12 : 14);
      const showLvl = (isLocked(r) || !visited.has(r.id)) && minLevel(r) > 1;
      const lvlW = showLvl ? textWidth(`Nivel ${minLevel(r)}`, 11) * 0.82 : 0; // (la del nivel no es Cinzel: es más angosta)
      const pref = p.label || 'b';
      const sides = [pref].concat(SIDE_ORDER.filter((x) => x !== pref));
      let best = null;
      sides.forEach((side, rank) => {
        const c = placeAt(p, side, lair, nameW, lvlW);
        let score = rank * (rank < 4 ? 30 : 45);
        for (const o of placed) score += area(c.box, o) * 4;
        for (const dsc of discs) if (dsc.id !== r.id) score += area(c.box, dsc.box) * 3;
        const outX = Math.max(0, 12 - c.box[0]) + Math.max(0, c.box[2] - (W - 12));
        const outY = Math.max(0, 12 - c.box[1]) + Math.max(0, c.box[3] - (H - 12));
        score += (outX + outY) * 60;
        if (!best || score < best.score) best = Object.assign(c, { score });
      });
      out[r.id] = best;
      placed.push(best.box);
    }
    return out;
  }

  // ============================================================
  // v3.12: los tres reinos (el Cielo arriba, el Espacio en el medio, el Infierno abajo)
  //   Manchas de color sobre el pergamino, con bordes que ondulan, y su nombre.
  // ============================================================
  function realmsHtml() {
    const x0 = HIGH_W + 8;
    const stars = [];
    const rnd = seeded(2401);
    for (let i = 0; i < 46; i++) {
      const x = x0 + 30 + rnd() * (W - x0 - 60);
      const y = 312 + rnd() * 236;
      const r = rnd() < 0.18 ? 1.6 : 0.9;
      stars.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"/>`);
    }
    const clouds = [[1880, 70], [2010, 40], [2170, 200], [2330, 60], [1990, 225]].map(([x, y]) =>
      `<path d="M ${x - 26} ${y + 8} a 10 10 0 0 1 10 -12 a 13 13 0 0 1 23 -3 a 10 10 0 0 1 18 9 a 7 7 0 0 1 1 6 Z"/>`).join('');
    const embers = [[1890, 805], [2010, 610], [2160, 820], [2300, 600], [2120, 640]].map(([x, y]) =>
      `<path d="M ${x - 5} ${y + 5} q -2 -8 3 -12 q 0 6 4 6 q 2 -4 1 -7 q 6 6 2 13 Z"/>`).join('');
    return `
        <defs>
          <linearGradient id="mp-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fff6d8" stop-opacity="0.85"/>
            <stop offset="100%" stop-color="#cfe6f6" stop-opacity="0.55"/>
          </linearGradient>
          <linearGradient id="mp-space" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#2a2450" stop-opacity="0.78"/>
            <stop offset="100%" stop-color="#140f2a" stop-opacity="0.85"/>
          </linearGradient>
          <linearGradient id="mp-realm-fade" gradientUnits="userSpaceOnUse" x1="${x0}" y1="0" x2="${x0 + 110}" y2="0">
            <stop offset="0%" stop-color="#fff" stop-opacity="0"/>
            <stop offset="100%" stop-color="#fff" stop-opacity="1"/>
          </linearGradient>
          <linearGradient id="mp-hell" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#8a2a14" stop-opacity="0.5"/>
            <stop offset="100%" stop-color="#4a0e08" stop-opacity="0.78"/>
          </linearGradient>
        </defs>
        <mask id="mp-realm-mask" maskUnits="userSpaceOnUse" x="${x0}" y="0" width="${W - x0}" height="${H}">
          <rect x="${x0}" y="0" width="${W - x0}" height="${H}" fill="url(#mp-realm-fade)"/>
        </mask>
        <g class="map-realms">
          <g mask="url(#mp-realm-mask)">
          <path class="realm-sky" d="M ${x0} 10 L ${W} 10 L ${W} 300 C ${W - 160} 290, ${x0 + 330} 318, ${x0} 296 Z" fill="url(#mp-sky)"/>
          <path class="realm-space" d="M ${x0} 296 C ${x0 + 330} 318, ${W - 160} 290, ${W} 300 L ${W} 560 C ${W - 200} 548, ${x0 + 260} 574, ${x0} 556 Z" fill="url(#mp-space)"/>
          <path class="realm-hell" d="M ${x0} 556 C ${x0 + 260} 574, ${W - 200} 548, ${W} 560 L ${W} ${H - 10} L ${x0} ${H - 10} Z" fill="url(#mp-hell)"/>
          <g class="realm-clouds">${clouds}</g>
          <g class="realm-stars">${stars.join('')}</g>
          <g class="realm-embers">${embers}</g>
          </g>
          <text class="map-realm-title is-sky" x="${x0 + 290}" y="282" text-anchor="middle">El Cielo</text>
          <text class="map-realm-title is-space" x="${x0 + 290}" y="540" text-anchor="middle">El Espacio</text>
          <text class="map-realm-title is-hell" x="${x0 + 290}" y="${H - 22}" text-anchor="middle">El Infierno</text>
        </g>
        <path class="map-mist" d="M ${HIGH_W + 4} 20 C ${HIGH_W + 30} 220, ${HIGH_W - 14} 430, ${HIGH_W + 22} 640 S ${HIGH_W + 8} 800, ${HIGH_W + 18} ${H - 20}"/>`;
  }

  function svgHtml() {
    const pos = layout();
    const { visited, known } = knowledge();
    const here = A.State.world.regionId;
    const current = A.Data.getById('regions', here);
    const near = new Set((current && current.connections) || []);
    const regions = A.Data.regions.filter((r) => pos[r.id]);
    const labels = placeLabels(regions, pos, known, visited, here); // v3.11.1
    lastLabels = labels;

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
        // v3.12: en el Espacio (fondo oscuro) los caminos van en tinta clara
        const ob = A.Data.getById('regions', c);
        const dark = r.biome === 'space' || (ob && ob.biome === 'space');
        roads.push(`<path class="road ${cls}${dark ? ' in-space' : ''}" d="${roadPath(a, b, key)}"/>`);
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
        (r.type === 'safe' || r.type === 'road') ? 'is-safe' : 'is-danger',
        r.type === 'lair' ? 'is-lair' : '', // v3.11: guarida de jefe (más chica, con corona)
      ].filter(Boolean).join(' ');
      const lair = r.type === 'lair';
      const iconUrl = isFog ? '' : (A.ItemSprites && A.ItemSprites.iconUrl ? A.ItemSprites.iconUrl(`biome-${r.biome}`) || A.ItemSprites.iconUrl('map') : '');
      const lab = labels[r.id] || labelAttrs(p);
      const lockUrl = locked && A.ItemSprites ? A.ItemSprites.iconUrl('lock') : '';
      return `
        <g class="${cls}" data-region="${U().esc(r.id)}" transform="translate(${p.x} ${p.y})" tabindex="0" role="button" aria-label="${U().esc(isFog ? 'Zona sin explorar' : r.name)}">
          <circle class="node-halo" r="${lair ? 24 : 34}"/>
          <circle class="node-ring" r="${lair ? 18 : 26}"/>
          <circle class="node-disc" r="${lair ? 15 : 22}"/>
          ${isFog ? `<text class="node-q" y="${lair ? 6 : 8}" text-anchor="middle">?</text>` : lair && A.Sprites ? `<image href="${A.Sprites.dataUrl(r.boss)}" x="-13" y="-13" width="26" height="26" class="node-img"/>` : `<image href="${iconUrl}" x="-16" y="-16" width="32" height="32" class="node-img"/>`}
          ${lair && !isFog && A.ItemSprites ? `<g class="node-crown" transform="translate(${lockUrl ? -13 : 13} -14)"><circle r="8"/><image href="${A.ItemSprites.iconUrl('crown')}" x="-6" y="-6" width="12" height="12"/></g>` : ''}
          ${lockUrl ? `<g class="node-lock" transform="translate(${lair ? 13 : 17} ${lair ? -13 : -17})"><circle r="${lair ? 8 : 10}"/><image href="${lockUrl}" x="${lair ? -6 : -8}" y="${lair ? -6 : -8}" width="${lair ? 12 : 16}" height="${lair ? 12 : 16}"/></g>` : ''}
          ${isFog ? '' : `<text class="node-label" x="${(lab.x - p.x).toFixed(1)}" y="${(lab.y - p.y).toFixed(1)}" text-anchor="${lab.anchor}">${U().esc(r.name)}</text>`}
          ${!isFog && (locked || !visited.has(r.id)) && minLevel(r) > 1 ? `<text class="node-lvl" x="${(lab.x - p.x).toFixed(1)}" y="${((lab.lvlY != null ? lab.lvlY : lab.y + (p.label === 't' ? -15 : 14)) - p.y).toFixed(1)}" text-anchor="${lab.anchor}">Nivel ${minLevel(r)}</text>` : ''}
        </g>`;
    }).join('');

    const boxes = Object.values(labels).map((l) => l.box);
    const decorHtml = regions.filter((r) => known.has(r.id)).map((r) => decor(r, Object.assign({}, pos[r.id], { label: (labels[r.id] && labels[r.id].side) || pos[r.id].label }), boxes)).join('');
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
        <path class="map-sea" d="M 0 690 C 120 660, 260 700, 380 730 S 600 660, 720 690 S 900 700, 1000 720 S 1180 700, 1280 735 S 1500 760, 1620 745 S ${W} 760, ${W} 770 L ${W} ${H} L 0 ${H} Z" fill="url(#mp-sea)"/>
        <path class="map-mist" d="M ${OLD_W + 10} 20 C ${OLD_W + 40} 200, ${OLD_W - 10} 420, ${OLD_W + 30} 640 S ${OLD_W + 20} 800, ${OLD_W + 30} ${H - 20}"/>
        <text class="map-region-title is-high" x="1450" y="${H - 16}" text-anchor="middle">Tierras Altas</text>
        <text class="map-region-title is-low" x="560" y="${H - 28}" text-anchor="middle">Tierras Bajas</text>
        ${realmsHtml()}
        <rect width="${W}" height="${H}" filter="url(#mp-grain)" opacity="0.9"/>
        <rect class="map-frame" x="8" y="8" width="${W - 16}" height="${H - 16}" rx="6"/>
        <g class="map-decor">${decorHtml}</g>
        <g class="map-roads">${roads.join('')}</g>
        <g class="map-nodes">${nodes}</g>
        ${hp ? `<g class="map-you" transform="translate(${hp.x} ${hp.y - 30})"><image href="${pinUrl}" x="-12" y="-26" width="24" height="24"/></g>` : ''}
        ${allyMarker(pos)}
      </svg>
    `;
  }

  // ============================================================
  // v3.1: el compañero en el mapa
  // ============================================================

  /** v3.2: los compañeros del grupo (hasta tres). */
  function mates() {
    if (!(A.Party && A.Party.isActive && A.Party.isActive())) return [];
    const list = A.Party.allies ? A.Party.allies() : [A.Party.ally ? A.Party.ally() : null];
    return list.filter((m) => m && m.online);
  }

  /** Dónde está un compañero: { x, y, m } (en un camino si está viajando). */
  function allySpot(pos, m) {
    if (!m) return null;
    const t = m.traveling;
    if (t && pos[t.fromId] && pos[t.toId]) {
      const k = Math.max(0, Math.min(1, (t.step || 0) / Math.max(1, t.total || 1)));
      return { x: pos[t.fromId].x + (pos[t.toId].x - pos[t.fromId].x) * k, y: pos[t.fromId].y + (pos[t.toId].y - pos[t.fromId].y) * k, m, moving: true };
    }
    const p = m.regionId && pos[m.regionId];
    return p ? { x: p.x, y: p.y, m, moving: false } : null;
  }

  function allyMarker(pos) {
    const seen = {};
    return mates().map((m) => allySpot(pos, m)).filter(Boolean).map((spot) => {
      const url = A.Sprites && A.Sprites.heroUrl ? A.Sprites.heroUrl(spot.m.raceId || 'humano') : '';
      // al lado de la zona, del lado contrario a su nombre (no encima de tu marca); viajando, sobre el camino
      const rawSide = (!spot.moving && spot.m.regionId && ((lastLabels[spot.m.regionId] && lastLabels[spot.m.regionId].side) || (pos[spot.m.regionId] && pos[spot.m.regionId].label))) || 'r';
      const side = rawSide.length > 1 ? rawSide.charAt(0) : rawSide; // 'tr' -> 't'
      const off = ({ r: [-34, -8], l: [34, -8], t: [30, 20], b: [32, -18] })[side] || [32, -14];
      // v3.2: si hay varios en el mismo lugar, uno al lado del otro
      const key = spot.moving ? `${Math.round(spot.x)},${Math.round(spot.y)}` : spot.m.regionId;
      const i = seen[key] = seen[key] == null ? 0 : seen[key] + 1;
      const x = spot.moving ? spot.x + i * 18 : spot.x + off[0] + Math.sign(off[0] || 1) * i * 30;
      const y = spot.moving ? spot.y - 6 - i * 4 : spot.y + off[1];
      return `
      <g class="map-ally ${spot.moving ? 'is-moving' : ''}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
        <circle class="map-ally-ring" r="17"/>
        ${url ? `<image href="${url}" x="-14" y="-16" width="28" height="28"/>` : ''}
        <text class="map-ally-name" y="${31 + (i % 2) * 11}" text-anchor="middle">${U().esc(spot.m.name || 'Compañero')}</text>
      </g>`;
    }).join('');
  }

  /** Líneas de los compañeros para la ficha de una zona. */
  function allyLine(id) {
    return mates().map((m) => {
      const t = m.traveling;
      let text = '';
      if (t && (t.toId === id || t.fromId === id)) {
        const to = A.Data.getById('regions', t.toId);
        text = `${m.name} va de viaje hacia ${to ? to.name : 'otra zona'} (paso ${t.step || 0} de ${t.total || 1}).`;
      } else if (!t && m.regionId === id) {
        text = (A.Party.withMe ? A.Party.withMe(m) : m.together) ? `${m.name} está con vos.` : `${m.name} está acá.`;
      }
      if (!text) return '';
      const url = A.Sprites && A.Sprites.heroHtml ? A.Sprites.heroHtml(m.raceId || 'humano', { size: 28 }) : '';
      return `<p class="map3-ally">${url}<span>${U().esc(text)}</span></p>`;
    }).join('');
  }

  // ============================================================
  // v3.1: quién vive y qué criaturas hay
  // ============================================================

  function npcsBlock(r, visited) {
    const npcs = A.Data.npcsInRegion ? A.Data.npcsInRegion(r.id) : [];
    if (!npcs.length) return '';
    if (!visited.has(r.id)) {
      return `
        <div class="map3-sec">
          <h3 class="map3-h">${U().icon('talk', 16)}<span>Habitantes</span></h3>
          <p class="map3-note">${npcs.length} ${npcs.length === 1 ? 'persona vive' : 'personas viven'} acá. Visitá el lugar para conocerlas.</p>
        </div>`;
    }
    return `
      <div class="map3-sec">
        <h3 class="map3-h">${U().icon('talk', 16)}<span>Habitantes</span></h3>
        <ul class="map3-npcs">
          ${npcs.map((n) => {
            const marker = A.Quests ? A.Quests.markerFor(n.id) : null;
            const role = n.roleName || n.role || '';
            return `
              <li class="map3-npc ${marker ? 'has-quest' : ''}">
                ${A.UI && A.UI.portrait ? A.UI.portrait(n, 34, marker) : ''}
                <span class="map3-npc-text"><b>${U().esc(n.name)}</b><small>${U().esc(roleText(n, role))}</small></span>
              </li>`;
          }).join('')}
        </ul>
      </div>`;
  }

  function roleText(n, role) {
    const what = [];
    if ((n.sells || []).length) what.push('vende');
    if (n.role === 'blacksmith') what.push('forja');
    if ((n.teaches || []).length) what.push('enseña magia');
    if (n.services && n.services.restCost != null) what.push('posada');
    if (A.Quests && A.Quests.list().some((q) => q.giver === n.id)) what.push('encargos');
    const label = ({ merchant: 'Mercader', blacksmith: 'Herrero', innkeeper: 'Posadero', guard: 'Guardia', sage: 'Sabio' })[role] || role;
    return [label, what.join(', ')].filter(Boolean).join(' · ');
  }

  // v3.9: qué se consigue en cada lugar (lo que sueltan las criaturas que ya viste y lo que se encuentra explorando)
  const RAR_ORDER = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
  function lootBlock(r) {
    const foes = r.type === 'safe' ? [] : A.Data.enemiesInRegion(r.id);
    const isKnown = (e) => !A.Bestiary || A.Bestiary.isKnown(e.id);
    const items = new Map();
    const add = (itemId, from, chance) => {
      if (!itemId || /^coin_/.test(itemId)) return;
      const d = A.Inventory.resolveData(itemId);
      if (!d) return;
      const it = items.get(itemId) || { d, from: new Set(), chance: 0 };
      it.from.add(from);
      it.chance = Math.max(it.chance, chance || 0);
      items.set(itemId, it);
    };
    for (const e of foes.filter(isKnown)) for (const dr of e.drops || []) add(dr.itemId, e.name.toLowerCase(), dr.chance);
    for (const ev of r.events || []) if (ev.type === 'find' && ev.reward) add(ev.reward, 'explorando', (ev.chance || 0) / 100);
    const hidden = foes.filter((e) => !isKnown(e)).length;
    if (!items.size && !hidden) return '';
    const wanted = A.Quests && A.Quests.wantedItems ? A.Quests.wantedItems() : new Set();
    const list = [...items.entries()].sort((a, b) => (wanted.has(b[0]) - wanted.has(a[0])) || ((RAR_ORDER[b[1].d.rarity] || 1) - (RAR_ORDER[a[1].d.rarity] || 1)) || (b[1].chance - a[1].chance));
    const MAX = 12;
    const shown = list.slice(0, MAX);
    const often = (c) => (c >= 0.35 ? 'seguido' : c >= 0.15 ? 'a veces' : 'raro');
    return `
      <div class="map3-sec">
        <h3 class="map3-h">${U().icon('bag', 16)}<span>Se consigue</span>${list.length ? `<span class="map3-count num">${list.length}</span>` : ''}</h3>
        ${shown.length ? `<div class="map3-loot">
          ${shown.map(([id, it]) => `
            <span class="map3-loot-item rarity-${U().esc(it.d.rarity || 'common')} ${wanted.has(id) ? 'is-wanted' : ''}" title="${U().esc(`${it.d.name}: ${[...it.from].slice(0, 3).join(', ')} (${often(it.chance)})${wanted.has(id) ? ' · lo pide una misión' : ''}`)}">
              ${U().itemSprite(it.d, 22)}<span>${U().esc(it.d.name)}</span>${wanted.has(id) ? U().icon('quest', 12) : ''}
            </span>`).join('')}
          ${list.length > MAX ? `<span class="map3-loot-more">+${list.length - MAX} más</span>` : ''}
        </div>` : ''}
        ${hidden ? `<p class="map3-note">${hidden === 1 ? 'Una criatura que todavía no viste puede' : `${hidden} criaturas que todavía no viste pueden`} tener más cosas.</p>` : ''}
      </div>`;
  }

  function foesBlock(r) {
    if (r.type === 'safe') return '';
    const foes = A.Data.enemiesInRegion(r.id);
    if (!foes.length) return '';
    const known = foes.filter((e) => !A.Bestiary || A.Bestiary.isKnown(e.id)).length;
    return `
      <div class="map3-sec">
        <h3 class="map3-h">${U().icon('skulls', 16)}<span>${r.type === 'road' ? 'Criaturas en el camino' : 'Criaturas'}</span><span class="map3-count num">${known}/${foes.length}</span></h3>
        <div class="map3-foes">
          ${foes.map((e) => {
            const ok = !A.Bestiary || A.Bestiary.isKnown(e.id);
            const tl = ok && A.Encounter && A.Encounter.timeLabel ? A.Encounter.timeLabel(e) : '';
            return `
              <span class="map3-foe ${ok ? '' : 'is-unknown'}" title="${U().esc(ok ? `${e.name}${tl ? ` · ${tl}` : ''}` : 'Todavía no la viste')}">
                ${A.Sprites ? A.Sprites.html(e, { size: 30 }) : ''}
                ${tl ? `<span class="map3-foe-time">${U().icon(e.time === 'night' ? 'moon' : 'sun', 12)}</span>` : ''}
              </span>`;
          }).join('')}
        </div>
      </div>`;
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
      <div class="map2-card map3-card ${locked ? 'is-locked' : ''} ${isHere ? 'is-here' : ''}">
        <div class="map3-top">
          <span class="map2-card-icon">${U().biomeIcon(r, 40)}</span>
          <div class="map3-top-text">
            <div class="map2-card-name">${U().esc(r.name)}${isHere ? '<span class="map2-here-tag">Estás acá</span>' : ''}</div>
            <div class="map2-card-pills">
              <span class="pill ${(r.type === 'safe' || r.type === 'road') ? 'pill-safe' : 'pill-combat'}">${r.type === 'road' ? 'Segura adentro · criaturas en el camino' : r.type === 'safe' ? 'Zona segura' : r.type === 'lair' ? `Guarida de jefe${r.altar ? ' · se invoca' : ''}` : 'Zona de peligro'}</span>
              <span class="pill pill-tier">Nivel ${minLevel(r)}+</span>
              ${visited.has(id) ? '' : '<span class="map2-meta">Sin visitar</span>'}
            </div>
          </div>
        </div>
        <p class="map2-card-desc">${U().esc(r.description || '')}</p>
        ${allyLine(id)}
        ${(() => { const w = reqs.find((q) => q.warn); return w ? `<p class="map3-warn">${U().icon('skull', 16)}<span>${U().esc(w.hint)}</span></p>` : ''; })()}
        ${locked ? `<ul class="map2-reqs">${reqs.map((q) => `<li class="${q.met ? 'is-met' : ''}">${U().icon(q.met ? 'check' : 'lock', 14)}<span>${U().esc(q.label)}${q.current != null && q.target != null && !q.met ? ` (${q.current}/${q.target})` : ''}</span></li>`).join('')}</ul>` : ''}
        ${action}
        ${npcsBlock(r, visited)}
        ${enemies ? foesBlock(r) : ''}
        ${lootBlock(r)}
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
      <section class="map2 map3">
        <header class="map2-head">
          <button class="btn-ghost map2-back" data-map-back title="Volver (Esc)">Volver</button>
          <h2 class="map2-title">${U().icon('map', 26)}<span>Mapa del reino</span></h2>
          <span class="map2-where">${U().icon('pin', 18)}<span>Estás en <b>${U().esc(cur ? cur.name : '')}</b></span></span>
        </header>
        <div class="map3-body">
          <div class="map2-stage">
            ${svgHtml()}
            <div class="map2-zoom">
              <button data-map-zoom="in" aria-label="Acercar">+</button>
              <button data-map-zoom="out" aria-label="Alejar">−</button>
              <button data-map-zoom="fit" aria-label="Ver todo" title="Ver todo">${U().icon('map', 18)}</button>
            </div>
          </div>
          <aside class="map2-info map3-side">${cardHtml()}</aside>
        </div>
      </section>
    `;
    bind();
    fitHeight();
  }

  /** v3.1: el mapa ocupa justo lo que queda de pantalla (sin bajar). */
  function fitHeight() {
    const el = mainEl && mainEl.querySelector('.map3');
    if (!el) return;
    if (window.innerWidth <= 900) { el.style.height = ''; return; }
    const top = el.getBoundingClientRect().top + (window.scrollY || 0);
    el.style.height = `${Math.max(420, Math.floor(window.innerHeight - top - 22))}px`;
  }

  /** v3.1: redibuja solo el dibujo (el compañero se movió) sin perder zoom ni ficha. */
  function refreshSvg() {
    const stage = mainEl && mainEl.querySelector('.map2-stage');
    const old = stage && stage.querySelector('.map2-svg');
    if (!old) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = svgHtml();
    const fresh = tmp.querySelector('.map2-svg');
    if (!fresh) return;
    old.replaceWith(fresh);
    bind(true);
  }

  function refreshCard() {
    const box = mainEl && mainEl.querySelector('.map2-info');
    if (box) { box.innerHTML = cardHtml(); box.scrollTop = 0; }
    mainEl.querySelectorAll('.node').forEach((n) => n.classList.toggle('is-selected', n.dataset.region === selectedId));
    bindCard();
  }

  function setView(v) {
    // v3.19.4: nunca se ve afuera del papel (sin franjas oscuras): alejar llega hasta llenar el alto
    const minW = W / 3;
    const maxW = Math.min(W, H / ASP);
    const nw = Math.max(Math.min(minW, maxW), Math.min(maxW, v.w));
    const nh = nw * ASP;
    const nx = Math.max(0, Math.min(W - nw, v.x));
    const ny = Math.max(0, Math.min(H - nh, v.y));
    view = { x: nx, y: ny, w: nw, h: nh };
    const svg = mainEl && mainEl.querySelector('.map2-svg');
    if (svg) svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  }

  function zoomAt(factor, cx, cy) {
    userMoved = true;
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
      // v3.9: un solo aviso (antes se repetía en cada toque) y, en grupo, el botón para separarse acá mismo
      if (box) box.querySelectorAll('.map2-error').forEach((n) => n.remove());
      if (box && res && res.error) {
        const sep = res.separable && A.Party && A.Party.separate
          ? `<button type="button" class="btn-ghost btn-sm map2-separate" data-map-separate="${U().esc(id)}">${U().icon('map', 14)}<span>Separarme y viajar solo</span></button>` : '';
        box.insertAdjacentHTML('afterbegin', `<div class="map2-error"><p>${U().esc(res.error)}</p>${sep}</div>`);
        const b = box.querySelector('[data-map-separate]');
        if (b) b.addEventListener('click', () => {
          const r = A.Party.separate();
          if (r && r.ok === false && r.error) { b.replaceWith(Object.assign(document.createElement('span'), { className: 'dim', textContent: r.error })); return; }
          b.disabled = true;
          // cuando llega la respuesta del anfitrión, sale el viaje
          let tries = 0;
          const go = () => {
            if (A.Party.guestTogether && A.Party.guestTogether()) { if (++tries < 20) setTimeout(go, 200); return; }
            travel(id);
          };
          setTimeout(go, 200);
        });
      }
    }
    // travel:started cierra el mapa desde el shell
  }

  function bindCard() {
    mainEl.querySelectorAll('[data-map-travel]').forEach((b) => b.addEventListener('click', () => travel(b.dataset.mapTravel)));
    mainEl.querySelectorAll('[data-map-select]').forEach((b) => b.addEventListener('click', () => select(b.dataset.mapSelect)));
  }

  function bind(svgOnly) {
    const svg = mainEl.querySelector('.map2-svg');
    if (!svgOnly) {
      mainEl.querySelector('[data-map-back]').addEventListener('click', closeMap);
      mainEl.querySelectorAll('[data-map-zoom]').forEach((b) => b.addEventListener('click', () => {
        const z = b.dataset.mapZoom;
        if (z === 'fit') { userMoved = false; const here = selectedId ? layout()[selectedId] : null; setView(tallView(here ? here.x : null)); return; }
        zoomAt(z === 'in' ? 0.8 : 1.25, view.x + view.w / 2, view.y + view.h / 2);
      }));
    }
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
        if (!drag.moved) { drag.moved = true; userMoved = true; try { svg.setPointerCapture(e.pointerId); } catch (err) {} }
        const pt = svgPoint(svg, e.clientX, e.clientY);
        setView({ x: drag.vx - dx * pt.scale, y: drag.vy - dy * pt.scale, w: view.w, h: view.h });
      });
      const end = () => { setTimeout(() => { drag = null; }, 0); };
      svg.addEventListener('pointerup', end);
      svg.addEventListener('pointercancel', end);
    }
    if (!svgOnly) bindCard();
    mainEl.querySelectorAll('.node').forEach((n) => n.classList.toggle('is-selected', n.dataset.region === selectedId));
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
      userMoved = false;
      const narrow = (container.clientWidth || window.innerWidth) < 640;
      const here = narrow && selectedId ? layout()[selectedId] : null;
      if (here) {
        const w = 1820 * 0.62; // v3.12: el mismo acercamiento de antes (el mapa ahora es más ancho)
        const h = w * (H / W);
        view = { x: Math.max(0, Math.min(W - w, here.x - w / 2)), y: Math.max(0, Math.min(H - h, here.y - h / 2)), w, h };
        userMoved = true;
      }
      render();
      if (!here) { // v3.14: arranca llenando el alto, centrado en donde estás
        const cur = selectedId ? layout()[selectedId] : null;
        setView(tallView(cur ? cur.x : null));
      }
      if (!escHandler) {
        escHandler = (e) => { if (e.key === 'Escape' && A.State.ui.showMap && !A.State.ui.openModal) closeMap(); };
        document.addEventListener('keydown', escHandler);
      }
      // v3.1: el compañero se mueve en el mapa; la pantalla cambia de tamaño
      if (!offParty && A.Bus) offParty = A.Bus.on('party:changed', () => { refreshSvg(); refreshCard(); });
      if (!resizeHandler) { resizeHandler = () => { fitHeight(); syncAspect(); }; window.addEventListener('resize', resizeHandler); }
      // v3.19.1: cuando termina de acomodarse la pantalla, la vista toma la forma justa
      requestAnimationFrame(() => syncAspect());
      setTimeout(() => syncAspect(), 350);
    },
    unmount() {
      if (escHandler) { document.removeEventListener('keydown', escHandler); escHandler = null; }
      if (offParty) { offParty(); offParty = null; }
      if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }
      if (mainEl) mainEl.innerHTML = '';
    },
    route,
    // v3.12: el editor usa el mismo tamaño de mapa
    W, H, OLD_W, HIGH_W,
  };

  A.Views = A.Views || {};
  A.Views.Map = MapView;
})(window.Aventurs);
