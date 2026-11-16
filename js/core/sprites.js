/* ============================================================
   Aventurs — Sprites pixel art 32×32 (v1.9.0)
   Cada criatura se DIBUJA con código (sin imágenes externas):
     1. un "plan" de cuerpo (bestia, ave, humanoide, dragón…) con
        proporciones y partes propias de cada especie
     2. sombreado automático (luz arriba-izquierda) y contorno
     3. se pinta en un canvas 32×32 y se usa como <img> pixelada
   Un enemigo nuevo del editor también tiene dibujo: se elige el plan
   por su familia/tags, y en el editor se puede copiar la forma de
   otra criatura y cambiar los colores.

   API:
     A.Sprites.html(enemigoOId, { size, flip })  -> <span class="px-sprite"><img></span>
     A.Sprites.petHtml(mascota, { size })         -> mira a la derecha
     A.Sprites.heroHtml(razaId, { size, weapon })  -> personaje del jugador
     A.Sprites.heroFor(jugador, { size })          -> con el arma que tiene equipada
     A.Sprites.dataUrl(enemigoOId)                 -> PNG en data URL
   (Los ítems usan el mismo motor: ver js/core/item-sprites.js)
   ============================================================ */

(function (A) {
  'use strict';

  const N = 32;

  // ============================================================
  // Colores
  // ============================================================

  function rgb(hx) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hx || '');
    if (!m) return [255, 0, 255];
    const n = parseInt(m[1], 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  function hex(r, g, b) {
    const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return `#${c(r)}${c(g)}${c(b)}`;
  }
  /** amt > 0 aclara, amt < 0 oscurece (−1..1). */
  function shade(h, amt) {
    const [r, g, b] = rgb(h);
    const t = amt < 0 ? 0 : 255;
    const p = Math.abs(amt);
    return hex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
  }
  function mix(a, b, t) {
    const x = rgb(a), y = rgb(b);
    return hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
  }
  function hsl(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return hex(f(0) * 255, f(8) * 255, f(4) * 255);
  }
  function hashStr(str) {
    let h = 7;
    for (const ch of String(str || '')) h = (h * 31 + ch.charCodeAt(0)) % 100003;
    return h;
  }

  // ============================================================
  // Grilla y primitivas (coordenadas en píxeles; el centro del píxel x es x+0.5)
  // ============================================================

  function put(g, x, y, k) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    g[y * N + x] = k;
  }
  function get(g, x, y) {
    if (x < 0 || y < 0 || x >= N || y >= N) return null;
    return g[y * N + x];
  }
  function ellR(g, cx, cy, rx, ry, k) {
    if (rx <= 0 || ry <= 0) return;
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1.0001) put(g, x, y, k);
      }
    }
  }
  function inPoly(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function polyR(g, pts, k) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        if (inPoly(x + 0.5, y + 0.5, pts)) put(g, x, y, k);
      }
    }
  }
  function dotR(g, cx, cy, r, k) {
    if (r < 0.72) { put(g, cx, cy, k); return; }
    ellR(g, cx, cy, r, r, k);
  }
  /** Trazo con grosor variable: radio r0 al inicio, rm a la mitad (opcional), r1 al final. */
  function lineR(g, pts, r0, r1, k, rm) {
    if (pts.length === 1) { dotR(g, pts[0][0], pts[0][1], r0, k); return; }
    const lens = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      lens.push(l); total += l;
    }
    const radius = (t) => {
      if (rm == null) return r0 + (r1 - r0) * t;
      return t < 0.5 ? r0 + (rm - r0) * (t / 0.5) : rm + (r1 - rm) * ((t - 0.5) / 0.5);
    };
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const l = lens[i - 1];
      const steps = Math.max(1, Math.ceil(l / 0.3));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const d = acc + l * t;
        dotR(g, ax + (bx - ax) * t, ay + (by - ay) * t, radius(total ? d / total : 0), k);
      }
      acc += l;
    }
  }
  function bez(p0, p1, p2, p3, n = 14) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      ]);
    }
    return out;
  }
  function inE(x, y, cx, cy, rx, ry) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    return dx * dx + dy * dy <= 1;
  }

  /**
   * "Lápiz" con escala: los planes dibujan en un espacio de 32×32 y el lápiz
   * los achica o agranda desde el piso (para criaturas chicas o grandes).
   */
  function makePen(g, s = 1, dx = 0) {
    const OX = 16, OY = 30;
    const X = (x) => OX + (x - OX) * s + dx;
    const Y = (y) => OY + (y - OY) * s;
    const P = (pts) => pts.map(([x, y]) => [X(x), Y(y)]);
    return {
      g, s,
      put: (x, y, k) => put(g, X(x), Y(y), k),
      ell: (cx, cy, rx, ry, k) => ellR(g, X(cx), Y(cy), rx * s, ry * s, k),
      dot: (cx, cy, r, k) => dotR(g, X(cx), Y(cy), r * s, k),
      poly: (pts, k) => polyR(g, P(pts), k),
      rect: (x, y, w, h, k) => polyR(g, P([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]), k),
      line: (pts, r0, r1, k, rm) => lineR(g, P(pts), r0 * s, r1 * s, k, rm != null ? rm * s : null),
      /** cambia de color los píxeles de "from" que cumplan test(x, y) (centro del píxel, en coords del plan) */
      recolor: (from, to, test) => {
        for (let py = 0; py < N; py++) {
          for (let px = 0; px < N; px++) {
            const k = g[py * N + px];
            if (!k || !from.includes(k)) continue;
            const lx = OX + (px + 0.5 - dx - OX) / s;
            const ly = OY + (py + 0.5 - OY) / s;
            if (test(lx, ly)) g[py * N + px] = to;
          }
        }
      },
    };
  }

  // ============================================================
  // Paleta, sombreado y contorno
  // ============================================================

  // Claves que no se sombrean (ojos, brillos, dientes, fuego…)
  const FLAT = new Set(['e', 'k', 'o', 'hl', 't', 'g', 'f', 'r', 'p']);
  // Claves que no reciben contorno alrededor
  const NO_OUTLINE = new Set(['g', 'f']);

  function resolvePalette(p) {
    const b = p.b || '#8a7a68';
    const pal = {
      b,
      c: p.c || shade(b, 0.3),
      a: p.a || '#d8c070',
      h: p.h || shade(b, -0.22),
      e: p.e || '#ffdd33',
      k: p.k || '#120c08',
      hl: p.hl || '#fffaf0',
      t: p.t || '#efe6d0',
      g: p.g || '#a8f0ff',
      f: p.f || '#ffd060',
      r: p.r || '#d0302a',
      sk: p.sk || '#d8a882',
      cl: p.cl || '#5a6a8a',
      cl2: p.cl2 || shade(p.cl || '#5a6a8a', -0.35),
      m: p.m || '#a8b0ba',
      wd: p.wd || '#7a5430',
      wg: p.wg || shade(p.b || '#8a7a68', -0.1),
    };
    for (const key of Object.keys(p)) if (!(key in pal)) pal[key] = p[key];
    pal.o = p.o || mix(shade(pal.b, -0.62), '#100804', 0.45);
    pal.p = p.p || '#120c08';
    for (const key of Object.keys(pal)) pal[`${key}~`] = shade(pal[key], -0.26);
    return pal;
  }

  function outlineOf(c) { return mix(shade(c, -0.6), '#0e0805', 0.45); }

  /** Pasa de claves a colores: sombreado por bordes + contorno exterior. */
  function finalize(g, pal) {
    const col = new Array(N * N).fill(null);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const k = g[y * N + x];
        if (!k) continue;
        const base = pal[k] || '#ff00ff';
        if (FLAT.has(k.replace('~', ''))) { col[y * N + x] = base; continue; }
        const same = (xx, yy) => get(g, xx, yy) === k;
        const up = same(x, y - 1), dn = same(x, y + 1), lf = same(x - 1, y), rt = same(x + 1, y);
        let c = base;
        if (!dn) c = shade(base, -0.3);
        else if (!up) c = shade(base, 0.22);
        else if (!rt) c = shade(base, -0.16);
        else if (!lf) c = shade(base, 0.1);
        else if (!same(x, y + 2)) c = shade(base, -0.1);
        col[y * N + x] = c;
      }
    }
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (g[y * N + x]) continue;
        for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
          const k = get(g, x + dx, y + dy);
          if (k && !NO_OUTLINE.has(k.replace('~', ''))) { col[y * N + x] = outlineOf(pal[k] || '#444444'); break; }
        }
      }
    }
    return col;
  }

  // ============================================================
  // Partes compartidas
  // ============================================================

  /** Ala de murciélago de perfil (levantada sobre el lomo). */
  function batWingSide(P, x, y, sz, far) {
    const k = far ? 'wg~' : 'wg';
    const bone = far ? 'a~' : 'a';
    const d = far ? 2.4 : 0;
    const s = sz || 1;
    const pts = [
      [x - 2 + d, y + 1.5], [x - 1.5 + d, y - 8 * s], [x + 2.5 + d, y - 12 * s], [x + 6 + d, y - 10.5 * s],
      [x + 9 * s + d, y - 6 * s], [x + 7 * s + d, y - 5 * s], [x + 5.5 * s + d, y - 2 * s], [x + 3.5 * s + d, y - 3 * s], [x + 2 + d, y + 1],
    ];
    P.poly(pts, k);
    P.line([[x - 1.5 + d, y + 0.5], [x - 1.5 + d, y - 8 * s], [x + 2.5 + d, y - 12 * s]], 0.6, 0.45, bone);
    P.line([[x - 1.5 + d, y - 8 * s], [x + 9 * s + d, y - 6 * s]], 0.45, 0.4, bone);
    P.line([[x - 1.5 + d, y - 8 * s], [x + 5.5 * s + d, y - 2 * s]], 0.45, 0.4, bone);
  }

  /** Ala de plumas de perfil. */
  function featherWingSide(P, x, y, sz, far) {
    const k = far ? 'wg~' : 'wg';
    const d = far ? 2.4 : 0;
    const s = sz || 1;
    P.poly([[x - 2 + d, y + 2], [x - 1 + d, y - 6 * s], [x + 3 + d, y - 11 * s], [x + 8 * s + d, y - 12 * s], [x + 11 * s + d, y - 9 * s], [x + 9 * s + d, y - 4 * s], [x + 4 + d, y + 1]], k);
    for (let i = 0; i < 4; i++) {
      const fx = x + (2 + i * 2.2) * s + d, fy = y - (9.5 - i * 1.6) * s;
      P.line([[fx, fy], [fx + 1.5 * s, fy + 3.5 * s]], 0.45, 0.3, far ? 'o' : 'wg~');
    }
  }

  /** Púas, cerdas o llamas sobre la línea del lomo. */
  function ridge(P, x0, x1, topY, kind, key) {
    for (let x = x0; x <= x1; x += kind === 'bristles' ? 1.6 : 2.6) {
      const y = topY(x);
      if (kind === 'bristles') P.line([[x, y + 0.6], [x + 0.8, y - 1.6]], 0.45, 0.35, key || 'h');
      else if (kind === 'flames') { P.line([[x, y + 0.8], [x + 0.4, y - 2.2]], 0.9, 0.3, 'f'); P.put(x, y - 0.4, 'c'); }
      else P.poly([[x - 1.1, y + 0.6], [x + 0.3, y - 2.4], [x + 1.2, y + 0.6]], key || 'a');
    }
  }

  // ============================================================
  // PLAN: bestia (cuadrúpedo de perfil, mira a la izquierda)
  // ============================================================

  function planBeast(P, o) {
    const GY = 29.5;
    const len = o.len || 17, h = o.h || 9;
    const leg = o.leg != null ? o.leg : 5;
    const lw = o.legW || 1.5;
    const rx = len / 2, ry = h / 2;
    const cx = o.cx || 18;
    const cy = GY - leg - ry + (o.low ? 1.6 : 0.6);
    const xl = cx - rx, xr = cx + rx;
    const fxp = xl + 3.2 + lw * 0.4, bxp = xr - 3.2 - lw * 0.4;
    const legTop = cy + ry * 0.15;

    const drawLeg = (x, key, front) => {
      let pts;
      if (o.low) {
        const dir = front ? -1 : 1;
        pts = [[x, legTop], [x + dir * 2, GY - 2.4], [x + dir * 2.4, GY - 0.8]];
      } else {
        pts = [[x, legTop], [x + (front ? 0.3 : 0.9), cy + ry * 0.6 + leg * 0.45], [x + (front ? -0.2 : 0.3), GY - 1.2]];
      }
      P.line(pts, lw, lw * 0.82, key);
      const f = pts[pts.length - 1];
      if (o.feet === 'hoof') P.rect(f[0] - lw, GY - 2.1, lw * 2, 2.1, key.endsWith('~') ? 'a~' : 'a');
      else P.ell(f[0] - 0.6, GY - 0.95, lw + 0.55, 0.95, key);
      if (o.claws) { P.put(f[0] - lw - 1.4, GY - 1, 'a'); P.put(f[0] - lw - 0.4, GY - 1, 'a'); }
    };

    if (leg > 0) { drawLeg(fxp + 2.2, 'b~', true); drawLeg(bxp + 2.2, 'b~', false); }
    beastTail(P, xr - 1.2, cy - ry * 0.25, o);
    if (o.wings === 'bat') batWingSide(P, cx + 1, cy - ry + 1.5, o.wingSize, true);
    if (o.wings === 'feather') featherWingSide(P, cx + 1, cy - ry + 1.5, o.wingSize, true);
    P.ell(cx, cy, rx, ry, 'b');
    if (o.hump) P.ell(xl + rx * 0.72, cy - ry * 0.42, rx * 0.55, ry * 0.78, 'b');
    if (o.belly !== false) P.recolor(['b'], 'c', (x, y) => inE(x, y, cx - 0.5, cy + ry * 0.62, rx * 0.8, ry * 0.52));
    if (o.stripes) for (let s = xl + 4; s < xr - 2; s += 2.8) P.recolor(['b'], 'b~', (x, y) => Math.abs(x - s - (y - cy) * 0.35) < 0.55 && y < cy + ry * 0.25);
    if (o.spots) [[0.25, -0.25], [-0.15, -0.05], [0.5, 0.1], [0.0, -0.5], [-0.35, -0.4]].forEach(([dx, dy]) =>
      P.recolor(['b'], 'b~', (x, y) => inE(x, y, cx + dx * rx * 2, cy + dy * ry * 2, 1.2, 0.9)));
    if (o.back) ridge(P, xl + 3, xr - 2.5, (x) => cy - ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2)) + 0.3, o.back, o.back === 'bristles' ? 'h' : 'a');
    if (leg > 0) { drawLeg(fxp, 'b', true); drawLeg(bxp, 'b', false); }

    // cabeza
    const hr = o.head || 4;
    const hx = xl + (o.headX != null ? o.headX : 1.3);
    const hy = cy - ry * (o.headLow ? 0.05 : 0.5) - (o.neck || 0);
    if (o.mane) P.ell(hx + 2.4, hy + 1.4, hr * (o.mane === 'lion' ? 1.45 : 1.2), hr * (o.mane === 'lion' ? 1.5 : 1.3), 'h');
    if (o.neck) P.line([[xl + 3.6, cy - ry * 0.3], [hx + 1, hy + 0.6]], Math.min(ry * 0.8, hr * 0.85), hr * 0.72, 'b');
    beastEars(P, hx, hy, hr, o, true);
    P.ell(hx, hy, hr, hr * (o.headRy || 0.92), 'b');
    beastEars(P, hx, hy, hr, o, false);

    // hocico
    const sl = o.snout != null ? o.snout : 3.5;
    if (sl > 0) {
      const sh = o.snoutH || Math.max(2.2, hr * 0.72);
      const scx = hx - hr * 0.55 - sl / 2 + 0.6, scy = hy + hr * 0.28;
      P.ell(scx, scy, sl / 2 + 0.8, sh / 2, 'b');
      if (o.muzzle !== false) P.recolor(['b'], 'c', (x, y) => y > scy + 0.1 && inE(x, y, scx, scy, sl / 2 + 0.8, sh / 2));
      const tipX = scx - sl / 2 - 0.8;
      P.put(tipX + 0.35, scy - sh / 2 + 0.55, 'k');
      const my = scy + 0.45;
      for (let x = tipX + 1; x < scx + sl / 2; x += 1) P.put(x, my, 'o');
      if (o.jaw === 'open' || o.fangs) { P.put(tipX + 1.2, my + 1, 't'); P.put(tipX + 3, my + 1, 't'); }
      if (o.horns === 'tusks') { P.put(tipX + 1.4, my - 1, 't'); P.put(tipX + 1.4, my - 2, 't'); P.put(tipX + 0.4, my - 2.8, 't'); }
    } else {
      P.put(hx - hr + 0.6, hy + hr * 0.3, 'k');
      P.put(hx - hr + 1.6, hy + hr * 0.55, 'o');
    }
    // ojo
    const ex = hx - hr * 0.42, ey = hy - hr * 0.28;
    if (o.eyes === 'glow') { P.put(ex, ey, 'e'); P.put(ex + 1, ey, 'e'); }
    else { P.put(ex, ey, 'k'); P.put(ex + 1, ey, 'e'); if (hr >= 4.6) { P.put(ex, ey + 1, 'k'); P.put(ex + 1, ey + 1, 'e'); } }
    // cuernos
    if (o.horns === 'goat') P.line(bez([hx + 0.4, hy - hr * 0.75], [hx + 1, hy - hr - 3], [hx + 4.5, hy - hr - 3], [hx + 5.5, hy - hr * 0.2], 10), 1.0, 0.45, 'a');
    if (o.horns === 'bull') P.line([[hx + 0.4, hy - hr * 0.7], [hx - 1.6, hy - hr - 1.2], [hx - 1, hy - hr - 3.2]], 0.9, 0.4, 'a');
    if (o.wings === 'bat') batWingSide(P, cx - 1, cy - ry + 1.5, o.wingSize, false);
    if (o.wings === 'feather') featherWingSide(P, cx - 1, cy - ry + 1.5, o.wingSize, false);
  }

  function beastEars(P, hx, hy, hr, o, far) {
    const e = o.ears || 'pointy';
    if (e === 'none') return;
    const d = far ? 1.8 : 0;
    const k = far ? 'b~' : 'b';
    if (e === 'pointy' || e === 'cat') {
      const tall = e === 'cat' ? 2.6 : 3;
      P.poly([[hx - 0.4 + d, hy - hr * 0.5], [hx + hr * 0.25 + d, hy - hr - tall], [hx + hr * 0.95 + d, hy - hr * 0.3]], k);
      if (!far) P.poly([[hx + 0.5, hy - hr * 0.6], [hx + hr * 0.3, hy - hr - tall + 1.6], [hx + hr * 0.7, hy - hr * 0.55]], 'c');
    } else if (e === 'round') {
      P.ell(hx + hr * 0.45 + d, hy - hr * 0.82, hr * 0.42, hr * 0.42, k);
      if (!far) P.ell(hx + hr * 0.45, hy - hr * 0.8, hr * 0.22, hr * 0.22, 'a');
    } else if (e === 'small') {
      P.poly([[hx + 0.4 + d, hy - hr * 0.7], [hx + 1.6 + d, hy - hr - 1.3], [hx + 2.4 + d, hy - hr * 0.55]], k);
    } else if (e === 'long') {
      P.ell(hx + 1.6 + d, hy - hr - 2.4, 1.1, 3.4, k);
    }
  }

  function beastTail(P, x0, y0, o) {
    const t = o.tail || 'thin';
    const k = o.tailKey || 'b';
    if (t === 'none') return;
    if (t === 'thin') P.line(bez([x0, y0 + 2], [x0 + 4, y0 + 6], [x0 + 6, y0 + 1], [x0 + 8.5, y0 - 1.5]), 0.65, 0.45, o.tailKey || 'a');
    else if (t === 'bushy') {
      P.line(bez([x0 - 0.5, y0], [x0 + 3.5, y0 - 1], [x0 + 5.5, y0 + 2.5], [x0 + 5, y0 + 7.5]), 1.3, 1.0, k, 2.2);
      if (o.tailTip) P.dot(x0 + 5, y0 + 7.2, 1.3, o.tailTip);
    } else if (t === 'up') P.line(bez([x0, y0], [x0 + 2.5, y0 - 1], [x0 + 3.5, y0 - 6], [x0 + 2, y0 - 10]), 0.9, 0.8, k);
    else if (t === 'curl') P.line([[x0, y0], [x0 + 1.8, y0 - 1], [x0 + 2.4, y0 - 2.6], [x0 + 1.2, y0 - 3.2], [x0 + 0.8, y0 - 2]], 0.55, 0.45, k);
    else if (t === 'short') P.dot(x0 + 0.6, y0, 1.4, k);
    else if (t === 'stinger') {
      const pts = bez([x0, y0], [x0 + 6, y0 - 3], [x0 + 4, y0 - 14], [x0 - 4.5, y0 - 13.5], 12);
      pts.forEach((p, i) => { if (i % 2 === 0) P.dot(p[0], p[1], 1.5 - i * 0.04, 'b~'); });
      const e = pts[pts.length - 1];
      P.poly([[e[0] + 0.5, e[1] - 1.4], [e[0] - 2.8, e[1] + 1.4], [e[0] + 0.8, e[1] + 1.2]], 'a');
    } else if (t === 'lizard') P.line(bez([x0 - 0.5, y0 + 0.5], [x0 + 3, y0 + 1], [x0 + 6, y0 + 3], [Math.min(30, x0 + 9), y0 + 5.5]), 2.0, 0.5, k);
    else if (t === 'snake') {
      const pts = bez([x0, y0], [x0 + 5, y0 - 1], [x0 + 6, y0 - 7], [x0 + 3, y0 - 9], 12);
      P.line(pts, 0.9, 1.0, 'c~');
      const e = pts[pts.length - 1];
      P.ell(e[0] - 0.5, e[1] - 0.6, 1.8, 1.3, 'c~');
      P.put(e[0] - 1, e[1] - 1, 'e');
    }
  }

  // ============================================================
  // PLAN: dragón (de perfil, alas levantadas) — también hidra
  // ============================================================

  function planDragon(P, o) {
    const GY = 29.5;
    const heads = o.heads || 1;
    const cx = 19, cy = 21.5, rx = 7.6, ry = 4.8;
    if (o.wings !== false) dragonWing(P, cx - 1, cy - 3.5, true, o);
    P.line([[cx - 4.5, cy + 1], [cx - 4.2, GY - 1.4]], 1.5, 1.3, 'b~');
    P.line([[cx + 5, cy + 1], [cx + 5.4, GY - 1.4]], 1.7, 1.3, 'b~');
    const tail = bez([cx + rx - 1, cy - 0.5], [cx + rx + 5, cy - 1], [cx + rx + 4, GY - 0.5], [cx + 3, GY - 1.6], 16);
    P.line(tail, 2.3, 0.6, 'b');
    const tt = tail[tail.length - 1];
    P.poly([[tt[0] + 0.8, tt[1] - 1.8], [tt[0] - 2.8, tt[1] + 0.1], [tt[0] + 0.8, tt[1] + 1.4]], 'a');
    P.ell(cx, cy, rx, ry, 'b');
    P.recolor(['b'], 'c', (x, y) => inE(x, y, cx - 1, cy + ry * 0.7, rx * 0.85, ry * 0.55));
    for (let s = cx - rx + 2; s < cx + rx - 1; s += 2) P.recolor(['c'], 'c~', (x) => Math.abs(x - s) < 0.5);
    ridge(P, cx - rx + 2, cx + rx - 1, (x) => cy - ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2)) + 0.4, 'spikes', 'a');
    const leg = (x, front) => {
      P.line([[x, cy + 1], [x + (front ? -0.8 : 0.6), cy + 4], [x + (front ? -0.3 : 0.2), GY - 1.3]], 1.9, 1.5, 'b');
      P.ell(x - 0.8, GY - 0.9, 2.2, 0.9, 'b');
      P.put(x - 2.6, GY - 1, 'a'); P.put(x - 1.6, GY - 1, 'a');
    };
    leg(cx - 5.5, true); leg(cx + 4, false);
    const headsAt = heads === 1
      ? [{ base: [cx - rx + 2.5, cy - 2], hx: 6.5, hy: 8.5 }]
      : [{ base: [cx - rx + 3, cy - 2.5], hx: 14, hy: 5 }, { base: [cx - rx + 2, cy - 1.5], hx: 6, hy: 9.5 }, { base: [cx - rx + 4.5, cy - 3], hx: 24, hy: 8, flip: true }];
    for (const hd of headsAt) {
      const neck = bez(hd.base, [hd.base[0] - 2, hd.base[1] - 4], [hd.hx + (hd.flip ? -3 : 3), hd.hy + 5], [hd.hx + (hd.flip ? -1.5 : 1.5), hd.hy + 1.5], 12);
      P.line(neck, heads > 1 ? 1.7 : 2.4, heads > 1 ? 1.3 : 1.7, 'b');
      dragonHead(P, hd.hx, hd.hy, hd.flip, heads > 1 ? 0.82 : 1);
    }
    if (o.wings !== false) dragonWing(P, cx - 3, cy - 3.5, false, o);
    if (o.lava) P.recolor(['b'], 'f', (x, y) => ((Math.floor(x) * 7 + Math.floor(y) * 13) % 17 === 0));
  }

  function dragonHead(P, hx, hy, flip, s) {
    const d = flip ? -1 : 1;
    P.ell(hx, hy, 3.4 * s, 2.5 * s, 'b');
    P.ell(hx - d * 3.2 * s, hy + 0.7 * s, 2.5 * s, 1.5 * s, 'b');
    P.recolor(['b'], 'c', (x, y) => y > hy + 0.9 * s && inE(x, y, hx - d * 2 * s, hy + 0.9 * s, 4.5 * s, 1.3 * s));
    P.line([[hx + d * 1 * s, hy - 1.6 * s], [hx + d * 3.4 * s, hy - 3.6 * s], [hx + d * 5 * s, hy - 4 * s]], 0.8 * s, 0.35, 'a');
    if (s >= 1) P.line([[hx + d * 2 * s, hy - 0.8 * s], [hx + d * 4.6 * s, hy - 1.6 * s]], 0.6, 0.3, 'a');
    P.put(hx - d * 0.8 * s - (flip ? 0 : 0.6), hy - 0.8 * s, 'e');
    P.put(hx - d * 5.3 * s, hy + 0.1, 'k');
    P.put(hx - d * 4.4 * s, hy + 1.7 * s, 't');
    P.put(hx - d * 2.4 * s, hy + 1.7 * s, 't');
  }

  function dragonWing(P, x, y, far, o) {
    const k = far ? 'wg~' : 'wg';
    const bone = far ? 'o' : 'wg~';
    const d = far ? 3.5 : 0;
    const big = o.big ? 1.1 : 1;
    const top = Math.max(1, y - 17 * big);
    const pts = [[x + 1 + d, y + 0.5], [x - 0.5 + d, y - 8], [x + 1.5 + d, top + 2], [x + 6 + d, top], [x + 11 * big + d, top + 3], [x + 12.5 * big + d, y - 8],
      [x + 10.5 * big + d, y - 8.5], [x + 8.5 * big + d, y - 5], [x + 6.2 + d, y - 6.5], [x + 4 + d, y - 2.5]];
    P.poly(pts, k);
    P.line([[x + 1 + d, y], [x - 0.5 + d, y - 8], [x + 1.5 + d, top + 2]], 0.8, 0.5, far ? 'wg~' : 'b');
    P.line([[x - 0.5 + d, y - 8], [x + 6 + d, top + 0.5]], 0.4, 0.35, bone);
    P.line([[x - 0.5 + d, y - 8], [x + 11 * big + d, top + 3.5]], 0.4, 0.35, bone);
    P.line([[x - 0.5 + d, y - 8], [x + 12.5 * big + d, y - 8.5]], 0.4, 0.35, bone);
  }

  // ============================================================
  // PLAN: aves y murciélago
  // ============================================================

  function planBird(P, o) {
    const GY = 29.5;
    const cx = 17, cy = 18.5;
    const tail = o.tail === 'flame'
      ? [[cx + 5, cy + 1], [cx + 13, cy + 7], [cx + 10, cy + 5.5], [cx + 13, cy + 10.5], [cx + 7, cy + 5]]
      : [[cx + 5, cy], [cx + 12, cy + 4.5], [cx + 11.5, cy + 6.5], [cx + 5, cy + 4]];
    P.poly(tail, o.tail === 'flame' ? 'f' : 'b~');
    if (o.tail === 'flame') P.line([[cx + 6, cy + 2.5], [cx + 11, cy + 6]], 0.8, 0.4, 'c');
    if (o.wing === 'spread') P.poly([[cx - 1, cy - 3], [cx + 3, cy - 13], [cx + 7, cy - 15], [cx + 6.5, cy - 9], [cx + 3, cy - 3]], 'wg~');
    for (const lx of [cx - 1.5, cx + 1.2]) {
      P.line([[lx, cy + 5], [lx - 0.3, GY - 1.2]], 0.5, 0.45, 'a');
      P.line([[lx - 2, GY - 0.8], [lx + 1, GY - 0.8]], 0.5, 0.5, 'a');
    }
    P.ell(cx, cy, 7, 6.2, 'b');
    P.recolor(['b'], 'c', (x, y) => inE(x, y, cx - 2.5, cy + 2.2, 4.2, 4));
    if (o.chest === 'bars') for (let y = cy - 1; y < cy + 6; y += 2) P.recolor(['c'], 'b~', (x, yy) => Math.abs(yy - y) < 0.5 && (Math.floor(x) % 2 === 0));
    const hx = cx - 6, hy = cy - 6;
    P.ell(hx, hy, 4.1, 3.9, o.headKey || 'b');
    if (o.crest) {
      P.line([[hx + 1, hy - 3], [hx + 3, hy - 7], [hx + 5.5, hy - 7.5]], 0.7, 0.4, 'f');
      P.line([[hx + 2, hy - 2.5], [hx + 5, hy - 5]], 0.6, 0.35, 'c');
    }
    if (o.beak === 'hook') P.poly([[hx - 2.8, hy - 1], [hx - 6.8, hy], [hx - 6.2, hy + 2.4], [hx - 5.2, hy + 1], [hx - 2.8, hy + 1.5]], 'a');
    else P.poly([[hx - 3, hy - 0.8], [hx - 6.6, hy + 0.6], [hx - 3, hy + 1.8]], 'a');
    P.put(hx - 4.4, hy + 0.6, 'o');
    P.put(hx - 1.4, hy - 1, 'k'); P.put(hx - 0.4, hy - 1, 'e');
    if (o.wing === 'spread') {
      P.poly([[cx - 4, cy - 2], [cx - 1, cy - 12], [cx + 4, cy - 17], [cx + 9, cy - 16], [cx + 8, cy - 10], [cx + 5, cy - 5], [cx + 2, cy + 1]], 'wg');
      for (let i = 0; i < 4; i++) P.line([[cx + i * 2.2, cy - 14 + i * 2], [cx + 1.5 + i * 2.2, cy - 9 + i * 2]], 0.45, 0.35, 'wg~');
      if (o.tail === 'flame') P.recolor(['wg'], 'f', (x, y) => y < cy - 13);
    } else {
      P.ell(cx + 1.5, cy + 0.2, 5, 3.6, 'wg');
      for (let i = 0; i < 3; i++) P.line([[cx + 1 + i * 1.8, cy + 1.5], [cx + 3.5 + i * 1.8, cy + 3.2]], 0.45, 0.35, 'wg~');
    }
  }

  function planOwl(P) {
    P.ell(16, 19.5, 8.6, 9.6, 'b');
    P.poly([[9.5, 6], [11, 10.5], [13.5, 8]], 'b');
    P.poly([[22.5, 6], [21, 10.5], [18.5, 8]], 'b');
    P.ell(16, 13.6, 7.4, 5.6, 'c');
    P.ell(12.6, 13.2, 2.8, 2.8, 'hl'); P.ell(19.4, 13.2, 2.8, 2.8, 'hl');
    P.ell(12.6, 13.2, 1.9, 1.9, 'e'); P.ell(19.4, 13.2, 1.9, 1.9, 'e');
    P.ell(12.8, 13.2, 0.9, 0.9, 'k'); P.ell(19.2, 13.2, 0.9, 0.9, 'k');
    P.poly([[15, 15], [17, 15], [16, 18]], 'a');
    P.recolor(['b'], 'c', (x, y) => y > 19 && inE(x, y, 16, 22.5, 5.2, 6));
    for (let y = 20; y < 28; y += 2) for (let x = 13; x < 20; x += 2) P.put(x + (y % 4 === 0 ? 0 : 1), y, 'h');
    P.ell(8.6, 20.5, 2.4, 6.5, 'b~'); P.ell(23.4, 20.5, 2.4, 6.5, 'b~');
    for (const x of [13, 14.5, 17.5, 19]) P.put(x, 29, 'a');
  }

  function planBat(P) {
    const wing = (d) => {
      const X = (v) => 16 + d * v;
      P.poly([[X(2), 13], [X(6), 7], [X(10), 6], [X(15), 9], [X(14.5), 18], [X(12), 15.5], [X(10), 19], [X(7.5), 16], [X(5), 20], [X(3), 17]], 'wg');
      P.line([[X(2.5), 13.5], [X(6), 7], [X(10), 6]], 0.6, 0.45, 'a');
      P.line([[X(6), 7], [X(14.5), 17.5]], 0.45, 0.4, 'a');
      P.line([[X(6), 7], [X(10), 18.5]], 0.45, 0.4, 'a');
      P.line([[X(6), 7], [X(5), 19.5]], 0.45, 0.4, 'a');
    };
    wing(-1); wing(1);
    P.ell(16, 17, 3.6, 5.2, 'b');
    P.recolor(['b'], 'c', (x, y) => inE(x, y, 16, 18.5, 2.2, 3));
    P.poly([[12.8, 10.5], [12.6, 4.5], [15, 8.5]], 'b'); P.poly([[19.2, 10.5], [19.4, 4.5], [17, 8.5]], 'b');
    P.ell(16, 11.2, 3.7, 3.3, 'b');
    P.put(14, 10.5, 'e'); P.put(17, 10.5, 'e');
    P.put(15, 13, 't'); P.put(16, 13, 't');
    P.put(14.5, 22.5, 'a'); P.put(16.5, 22.5, 'a');
  }

  // ============================================================
  // PLAN: bichos (araña, escorpión, cangrejo)
  // ============================================================

  function planSpider(P) {
    const legs = (far) => {
      const k = far ? 'b~' : 'b';
      for (let i = 0; i < 4; i++) {
        const sx = 12 + i * 2.3 + (far ? 1.5 : 0), sy = 19.5;
        const kx = 6 - i * 0.6 + (far ? 1.5 : 0) + i * 4.6, ky = 11 + i * 0.6 - (far ? 1 : 0);
        const fx = 2 + i * 7.8 + (far ? 1.6 : 0), fy = 29.2;
        P.line([[sx, sy], [kx, ky], [fx, fy]], 0.75, 0.5, k);
      }
    };
    legs(true);
    P.ell(21, 17, 8.2, 7.4, 'b');
    P.recolor(['b'], 'c', (x, y) => (Math.abs(x - 21) < 1.1 && y > 13 && y < 21) || inE(x, y, 21, 14, 2.4, 1.4) || inE(x, y, 21, 20.4, 2.6, 1.6));
    legs(false);
    P.ell(11.5, 21, 5, 4.2, 'b');
    for (const [x, y] of [[8.5, 19.5], [10, 19], [8, 21], [9.6, 20.6]]) P.put(x, y, 'e');
    P.put(7.5, 24, 'a'); P.put(9.5, 24.5, 'a'); P.put(7.6, 25, 'a');
  }

  function planScorpion(P) {
    const GY = 29.5;
    for (let i = 0; i < 4; i++) P.line([[12 + i * 2.6, 24], [10 + i * 3.2, 27], [9 + i * 3.4, GY - 0.8]], 0.55, 0.45, i % 2 ? 'b~' : 'b');
    for (let i = 0; i < 5; i++) P.ell(12 + i * 2.6, 23.5, 2.6, 2.7 - i * 0.12, 'b');
    const tail = bez([24, 22], [30, 19], [29.5, 8], [21, 6.5], 10);
    tail.forEach((p, i) => P.dot(p[0], p[1], 1.9 - i * 0.07, i % 2 ? 'b' : 'b~'));
    const tp = tail[tail.length - 1];
    P.poly([[tp[0] + 0.4, tp[1] - 1.5], [tp[0] - 3.2, tp[1] + 2.2], [tp[0] + 0.6, tp[1] + 1.4]], 'a');
    P.line([[10, 22.5], [7, 20], [5, 17.5]], 0.9, 0.8, 'b');
    P.ell(4, 15.5, 2.8, 2.2, 'c');
    P.ell(2.6, 13.6, 1.6, 1.2, 'c');
    P.put(3.5, 14.5, 'o');
    P.line([[11, 25], [7, 25.5], [5, 23]], 0.8, 0.7, 'b~');
    P.ell(3.8, 22.5, 2.2, 1.7, 'c~');
    P.put(9.5, 21.5, 'e'); P.put(10.5, 21.5, 'e');
  }

  function planCrab(P) {
    for (const d of [-1, 1]) {
      for (let i = 0; i < 3; i++) P.line([[16 + d * (5 + i * 1.6), 22], [16 + d * (9 + i * 2), 25 + i * 0.6], [16 + d * (10 + i * 2.2), 29]], 0.6, 0.45, 'b~');
      P.line([[16 + d * 7, 19], [16 + d * 10.5, 14], [16 + d * 11, 11]], 1.1, 0.9, 'b');
      P.ell(16 + d * 11.2, 8.6, 3.2, 3.6, 'b');
      P.poly([[16 + d * 10.6, 5.4], [16 + d * 11.6, 8.6], [16 + d * 13.2, 4.6]], null);
      P.recolor(['b'], 'c', (x, y) => inE(x, y, 16 + d * 10.6, 7.6, 1.5, 1.5));
      P.line([[16 + d * 3, 15.5], [16 + d * 3.4, 11.5]], 0.5, 0.5, 'b');
      P.put(16 + d * 3.4 - (d < 0 ? 1 : 0), 10.6, 'e');
    }
    P.ell(16, 20, 10.2, 6.3, 'b');
    P.recolor(['b'], 'c', (x, y) => y < 18 && inE(x, y, 16, 19, 7, 3.8) && ((Math.floor(x) + Math.floor(y)) % 3 === 0));
    P.line([[13, 23.5], [19, 23.5]], 0.45, 0.45, 'o');
  }

  // ============================================================
  // PLAN: serpiente
  // ============================================================

  function planSerpent(P, o) {
    const path = bez([29, 26.5], [22, 30], [10, 27], [14, 21], 16)
      .concat(bez([14, 21], [18, 16], [19, 11], [11, 9], 14).slice(1));
    P.line(path, 0.9, o.big ? 2.7 : 2.3, 'b', o.big ? 2.9 : 2.5);
    P.line(path.slice(6, path.length - 3).map(([x, y]) => [x + 0.7, y + 0.9]), 0.8, 1.0, 'c', 1.0);
    if (o.fin) {
      for (let i = 14; i < path.length - 3; i += 2) {
        const [x, y] = path[i];
        P.poly([[x - 0.8, y - 1.6], [x + 1.6, y - 4], [x + 1.6, y - 1.2]], 'a');
      }
    }
    path.forEach(([x, y], i) => { if (i % 4 === 2 && i < path.length - 5) P.put(x - 0.5, y - 1.2, 'b~'); });
    const hx = 9, hy = 8.6;
    P.ell(hx, hy, 4.2, 2.9, 'b');
    P.ell(hx - 2.8, hy + 0.6, 2.4, 1.9, 'b');
    P.put(hx - 0.6, hy - 1.3, 'e'); P.put(hx - 1.6, hy - 1.3, 'k');
    P.put(hx - 4.6, hy, 'k');
    P.line([[hx - 4.8, hy + 1.5], [hx - 7, hy + 2]], 0.4, 0.4, 'r');
    P.put(hx - 7.6, hy + 1.2, 'r'); P.put(hx - 7.6, hy + 2.8, 'r');
  }

  // ============================================================
  // PLAN: limo, fantasma, elemental, gólem, árbol, ojo, pulpo, pez, tortuga
  // ============================================================

  function planSlime(P) {
    P.ell(16, 22.5, 12.4, 8.2, 'b');
    P.ell(16, 17, 8.4, 8.2, 'b');
    P.recolor(['b'], null, (x, y) => y > 29.6);
    P.ell(7.5, 28.6, 1.6, 1.2, 'b'); P.ell(24.6, 28.8, 1.5, 1.1, 'b');
    P.recolor(['b'], 'c', (x, y) => inE(x, y, 16, 23, 9, 5.2) && ((Math.floor(x * 1.7 + y) % 7) === 0));
    P.line([[9.5, 15], [11.5, 11.5], [14, 10]], 0.7, 0.55, 'hl');
    P.rect(12, 18, 2, 3, 'k'); P.rect(18, 18, 2, 3, 'k');
    P.put(12, 18, 'hl'); P.put(18, 18, 'hl');
    P.line([[14.5, 23.5], [16, 24.3], [17.5, 23.5]], 0.45, 0.45, 'k');
  }

  function planGhost(P, o) {
    if (o.hair) P.poly([[7.5, 9], [5.5, 25], [9, 21], [11, 26], [13, 13], [19, 13], [21, 26], [23, 21], [26.5, 25], [24.5, 9]], 'h');
    P.poly([[8, 13], [8.5, 24], [10, 28.5], [12, 25], [14, 29.5], [16, 26], [18, 29.5], [20, 25], [22, 28.5], [23.5, 24], [24, 13]], 'b');
    if (o.hood) P.ell(16, 11.5, 9.6, 9.8, 'cl');
    P.ell(16, 12, 8, 8.4, 'b');
    P.recolor(['b'], 'c', (x, y) => inE(x, y, 14.5, 11, 4.5, 5));
    if (o.hood) {
      P.recolor(['b', 'c'], 'cl', (x, y) => y < 8.5 || !inE(x, y, 16, 13, 6, 6.8));
      P.recolor(['b', 'c'], 'k', (x, y) => inE(x, y, 16, 13, 5.5, 6.2));
      P.put(13.5, 12.5, 'e'); P.put(14.5, 12.5, 'e'); P.put(17.5, 12.5, 'e'); P.put(18.5, 12.5, 'e');
    } else {
      P.ell(13, 12, 1.5, 2.2, 'k'); P.ell(19, 12, 1.5, 2.2, 'k');
      P.put(13, 12, 'e'); P.put(19, 12, 'e');
      P.ell(16, o.scream ? 17.5 : 17, o.scream ? 1.6 : 1.4, o.scream ? 2.4 : 1, 'k');
    }
    P.line([[9, 16], [5.5, 18], [4, 21.5]], 1.6, 0.5, 'b');
    P.line([[23, 16], [26.5, 18], [28, 21.5]], 1.6, 0.5, 'b');
    if (o.chains) for (const [x, y] of [[5, 22], [6, 23.5], [27, 22], [26, 23.5], [7, 25]]) P.put(x, y, 'a');
  }

  function planElemental(P, o) {
    const kind = o.kind || 'fire';
    if (kind === 'fire') {
      P.poly([[8, 29], [5.5, 21], [7.5, 15], [6, 8], [10, 11.5], [10.5, 3.5], [14, 9], [16, 1], [18, 9], [21.5, 3.5], [22, 11.5], [26, 8], [24.5, 15], [26.5, 21], [24, 29]], 'b');
      P.poly([[11, 28], [9.5, 21], [11, 16], [12.5, 11], [14.5, 14], [16, 7], [17.5, 14], [19.5, 11], [21, 16], [22.5, 21], [21, 28]], 'c');
      P.poly([[13.5, 27], [13, 22], [14.5, 19], [16, 15], [17.5, 19], [19, 22], [18.5, 27]], 'f');
      P.ell(13.4, 17.6, 1.3, 1.7, 'k'); P.ell(18.6, 17.6, 1.3, 1.7, 'k');
      P.put(13.4, 17.4, 'hl'); P.put(18.6, 17.4, 'hl');
      P.ell(16, 22.4, 1.8, 1.1, 'k');
      for (const [x, y] of [[4, 6], [27.5, 12], [3.5, 15], [28, 4]]) P.put(x, y, 'c');
    } else if (kind === 'ice') {
      P.poly([[16, 3], [21, 10], [16, 13], [11, 10]], 'c');
      P.poly([[11, 13], [21, 13], [23, 22], [16, 28.5], [9, 22]], 'b');
      P.poly([[9, 13.5], [3, 9], [5, 18]], 'b'); P.poly([[23, 13.5], [29, 9], [27, 18]], 'b');
      P.poly([[12, 24], [10, 29.5], [14.5, 27]], 'c'); P.poly([[20, 24], [22, 29.5], [17.5, 27]], 'c');
      P.line([[13, 15], [16, 26]], 0.45, 0.45, 'f'); P.line([[19, 15], [17, 24]], 0.45, 0.45, 'hl');
      P.put(14, 8.5, 'e'); P.put(18, 8.5, 'e');
      for (const [x, y] of [[5, 5], [27, 4], [3, 24], [28.5, 25]]) P.put(x, y, 'f');
    } else {
      for (let a = 0; a < 12; a++) {
        const ang = a / 12 * Math.PI * 2;
        P.put(16 + Math.cos(ang) * 13.5, 15.5 + Math.sin(ang) * 13, a % 3 === 0 ? 'f' : 'c');
      }
      P.ell(16, 15.5, 9.4, 9.4, 'b');
      P.line(bez([9, 12], [12, 7], [20, 7], [22, 12], 10), 0.6, 0.6, 'c');
      P.line(bez([10, 20], [13, 24], [19, 24.5], [23, 19], 10), 0.6, 0.6, 'c');
      P.ell(16, 15.5, 4, 4, 'c');
      P.ell(16, 15.5, 2.2, 2.2, 'f');
      P.put(14, 14, 'e'); P.put(18, 14, 'e');
      P.line([[13, 26], [16, 29.5], [19, 26]], 0.6, 0.6, 'b~');
    }
  }

  function planGolem(P, o) {
    const lava = !!o.lava;
    P.rect(9, 23, 5, 6, 'b~'); P.rect(18, 23, 5, 6, 'b~');
    P.rect(8, 27.5, 6.5, 2, 'b'); P.rect(17.5, 27.5, 6.5, 2, 'b');
    P.poly([[7, 10], [25, 10], [26.5, 13], [25, 24], [7, 24], [5.5, 13]], 'b');
    P.rect(11.5, 4, 9, 7, 'b');
    P.rect(13, 7, 2, 1, 'g'); P.rect(17, 7, 2, 1, 'g');
    for (const d of [-1, 1]) {
      const x = d < 0 ? 1.5 : 25.5;
      P.rect(x, 11, 5, 11, 'b~');
      P.rect(x - 0.5, 21, 6, 5, 'b');
    }
    P.poly([[16, 13.5], [18.5, 16.5], [16, 19.5], [13.5, 16.5]], lava ? 'f' : 'g');
    const crack = lava ? 'f' : 'o';
    P.line([[9, 11], [11, 14], [10, 17]], 0.45, 0.45, crack);
    P.line([[22, 19], [20, 21.5], [21.5, 23]], 0.45, 0.45, crack);
    P.line([[3, 14], [4.5, 17]], 0.45, 0.45, crack);
    P.line([[12.5, 4.5], [14, 6]], 0.45, 0.45, crack);
    if (!lava) P.recolor(['b'], 'c', (x, y) => ((Math.floor(x) * 5 + Math.floor(y) * 3) % 11 === 0));
  }

  function planTree(P, o) {
    for (const d of [-1, 1]) P.line([[16 + d * 3, 26], [16 + d * 7, 28.5], [16 + d * 9, 29.5]], 1.2, 0.5, 'b');
    P.poly([[10, 29.5], [11.5, 14], [20.5, 14], [22, 29.5]], 'b');
    for (const x of [13, 16, 19]) P.line([[x, 16], [x + 0.3, 28]], 0.4, 0.4, 'b~');
    for (const d of [-1, 1]) {
      P.line([[16 + d * 4, 17], [16 + d * 9, 13], [16 + d * 11.5, 8.5]], 1.3, 0.6, 'b');
      P.line([[16 + d * 9, 13], [16 + d * 13, 14]], 0.7, 0.45, 'b');
      P.ell(16 + d * 12, 7.5, 3.4, 2.6, 'a');
      P.ell(16 + d * 13.4, 13.4, 1.8, 1.5, 'a');
    }
    P.ell(16, 8, 9.5, 6.4, 'a'); P.ell(11, 10.5, 4.5, 3.6, 'a'); P.ell(21, 10.5, 4.5, 3.6, 'a');
    P.recolor(['a'], 'c', (x, y) => ((Math.floor(x * 1.3) + Math.floor(y * 2.1)) % 5 === 0));
    if (o.flowers) for (const [x, y] of [[10, 6], [19, 4], [23, 9], [14, 10]]) P.put(x, y, 'r');
    P.ell(13.5, 18.5, 1.5, 1.3, 'k'); P.ell(18.5, 18.5, 1.5, 1.3, 'k');
    P.put(13.5, 18.5, 'e'); P.put(18.5, 18.5, 'e');
    P.ell(16, 23, 2.4, 1.3, 'k');
  }

  function planEye(P) {
    for (const [x, y] of [[6, 4], [10, 1.5], [16, 0.8], [22, 1.5], [26, 4]]) {
      P.line(bez([16 + (x - 16) * 0.35, 9], [16 + (x - 16) * 0.6, 6], [x, y + 3], [x, y + 1.4], 8), 0.6, 0.5, 'b~');
      P.dot(x, y + 1, 1.3, 'hl');
      P.put(x, y + 1, 'e');
    }
    P.ell(16, 18.5, 11.2, 10.4, 'b');
    P.recolor(['b'], 'c', (x, y) => ((Math.floor(x) * 3 + Math.floor(y) * 7) % 13 === 0));
    P.ell(16, 15.5, 5.8, 5, 'hl');
    P.ell(16, 15.5, 3.2, 3.2, 'e');
    P.rect(15.5, 13.5, 1, 4, 'k');
    P.line([[10.5, 11.2], [16, 9.6], [21.5, 11.2]], 0.6, 0.6, 'b~');
    P.ell(16, 24.6, 6.4, 2.4, 'k');
    for (let x = 11; x <= 21; x += 2) { P.put(x, 23.2, 't'); P.put(x + 1, 26, 't'); }
  }

  function planTentacle(P, o) {
    const big = !!o.big;
    const base = 15.5;
    for (const [dx, curl] of [[-9, 1], [-6, 0.6], [-2.5, 0.2], [2.5, -0.2], [6, -0.6], [9, -1]]) {
      const p0 = [16 + dx * 0.35, base];
      const p3 = [16 + dx * (big ? 1.62 : 1.45), 27.5];
      const pts = bez(p0, [16 + dx * 0.6, base + 6], [p3[0] - dx * 0.4, 30], p3, 12);
      P.line(pts, big ? 2.1 : 1.8, 0.6, 'b');
      P.line([[p3[0], p3[1]], [p3[0] + curl * 2, p3[1] - 2.2], [p3[0] + curl * 3.2, p3[1] - 1]], 0.6, 0.45, 'b');
      pts.forEach(([x, y], i) => { if (i % 3 === 1 && i > 2) P.put(x + 0.4, y + 0.9, 'c'); });
    }
    P.ell(16, 10.5, big ? 8.8 : 8, big ? 9.4 : 8.6, 'b');
    P.recolor(['b'], 'c', (x, y) => y < 12 && ((Math.floor(x) * 5 + Math.floor(y) * 3) % 9 === 0));
    P.ell(12, 13.5, 2, 1.7, 'e'); P.ell(20, 13.5, 2, 1.7, 'e');
    P.rect(11, 13, 2, 1, 'k'); P.rect(19, 13, 2, 1, 'k');
  }

  function planFish(P) {
    P.poly([[24.5, 17], [30.5, 8.5], [29, 17], [30.5, 25]], 'b~');
    P.poly([[12.5, 12.6], [17.5, 5], [20, 12.6]], 'b');
    P.ell(15, 17.4, 12.6, 5.3, 'b');
    P.poly([[2.3, 17.5], [6, 13.2], [6, 21.6]], 'b');
    P.recolor(['b'], 'c', (x, y) => y > 18.4);
    P.poly([[11, 20.5], [14.5, 26.5], [16, 20.5]], 'b~');
    for (const x of [9, 10.5, 12]) P.line([[x, 15], [x - 0.5, 18]], 0.4, 0.4, 'o');
    P.put(5.5, 15.5, 'k'); P.put(6.5, 15.5, 'k'); P.put(5.5, 15, 'hl');
    P.line([[3, 19], [8, 19.6]], 0.45, 0.45, 'o');
    for (let x = 3.5; x < 8; x += 1.4) P.put(x, 20, 't');
  }

  function planTurtle(P, o) {
    const GY = 29.5;
    const big = !!o.big;
    for (const x of [12, 22]) P.line([[x + 1.5, 23], [x + 1.8, GY - 1]], 1.7, 1.5, 'b~');
    P.poly([[26.5, 23], [30, 25.5], [26, 25.5]], 'b');
    P.ell(5.5, big ? 17 : 19.5, big ? 4.2 : 3.6, big ? 3.4 : 3, 'b');
    P.line([[9.5, 22.5], [6, big ? 18.5 : 20.5]], 2.2, 2, 'b');
    P.ell(17, 23.5, 11.5, 9.5, 'c');
    P.recolor(['c'], null, (x, y) => y > 24.2);
    P.rect(6, 23.5, 22.5, 1.6, 'a~');
    for (const [x, y] of [[12, 18], [17, 16], [22, 18], [14.5, 21.5], [19.5, 21.5]]) {
      P.line([[x - 2, y], [x - 1, y - 2], [x + 1, y - 2], [x + 2, y], [x + 1, y + 2], [x - 1, y + 2], [x - 2, y]], 0.4, 0.4, 'a');
    }
    if (o.spikes) for (let x = 9; x <= 25; x += 3.2) {
      const y = 23.5 - 9.5 * Math.sqrt(Math.max(0, 1 - ((x - 17) / 11.5) ** 2));
      P.poly([[x - 1.2, y + 1.4], [x + 0.3, y - 2.6], [x + 1.4, y + 1.4]], 'a');
    }
    for (const x of [8.5, 18.5]) P.line([[x + 1, 23], [x + 1.2, GY - 1]], 1.8, 1.6, 'b');
    if (o.horns) P.line([[6.5, big ? 14 : 17], [8.5, big ? 11 : 14.5], [8, big ? 9.5 : 13]], 0.8, 0.35, 'a');
    P.put(3.6, big ? 16 : 18.6, 'k'); P.put(4.6, big ? 16 : 18.6, 'e');
    P.line([[2, big ? 18.4 : 20.4], [5.5, big ? 18.6 : 20.6]], 0.45, 0.45, 'o');
    if (o.fangs) { P.put(2.5, big ? 19.4 : 21.4, 't'); P.put(4.2, big ? 19.4 : 21.4, 't'); }
  }

  // ============================================================
  // PLAN: humanoide (de frente)
  // ============================================================

  const HSIZE = {
    tiny: { hr: 3.7, hy: 16.5, sh: 3.6, wa: 3.0, tt: 20.0, tb: 25.0, leg: 2, gap: 1, ar: 0.95 },
    small: { hr: 4.0, hy: 13.2, sh: 4.4, wa: 3.6, tt: 17.2, tb: 23.5, leg: 3, gap: 1, ar: 1.1 },
    medium: { hr: 4.3, hy: 8.4, sh: 5.4, wa: 4.2, tt: 12.6, tb: 21.0, leg: 3, gap: 1, ar: 1.25 },
    large: { hr: 4.3, hy: 7.2, sh: 7.0, wa: 5.6, tt: 11.2, tb: 21.0, leg: 4, gap: 1, ar: 1.7 },
    huge: { hr: 4.1, hy: 7.0, sh: 9.0, wa: 7.0, tt: 10.8, tb: 21.5, leg: 5, gap: 1, ar: 2.15 },
  };

  function planHumanoid(P, o) {
    const S = HSIZE[o.size || 'medium'] || HSIZE.medium;
    const { hr, hy, sh, wa, tt, tb, ar } = S;
    const GY = 29.5;
    const outfit = o.outfit || 'tunic';
    const lower = o.lower || 'legs';
    const skel = o.body === 'skeleton';
    const skinKey = skel ? 't' : 'sk';
    const wSide = o.weaponSide === 'right' ? 1 : -1;
    const pose = o.pose || 'down';
    const handOf = (d) => {
      if (pose === 'forward') return [16 + d * (sh + 3.6), tt + 2.2];
      if (pose === 'up') return [16 + d * (sh + 2.4), tt - 2.6];
      if (pose === 'cast' && d === -wSide) return [16 + d * (sh + 2.6), tt + 1];
      return [16 + d * (sh + 1.1), tb + 0.4];
    };
    const elbowOf = (d) => {
      if (pose === 'forward') return [16 + d * (sh + 1.4), tt + 2];
      if (pose === 'up') return [16 + d * (sh + 1.6), tt + 0.5];
      return [16 + d * (sh + 0.9), (tt + tb) / 2];
    };

    // atrás: capa, alas, cola, pelo largo
    if (o.cloak) P.poly([[16 - sh - 0.4, tt - 0.4], [16 + sh + 0.4, tt - 0.4], [16 + sh + 3.2, GY - 0.6], [16 - sh - 3.2, GY - 0.6]], 'cl2');
    if (o.wings) humanWings(P, tt, o.wings);
    if (o.tail === 'demon') { P.line(bez([17, tb], [23, tb + 4], [26, 27], [27, 22], 12), 0.6, 0.5, skinKey); P.poly([[27, 20], [25.6, 22.6], [28.6, 22.4]], 'a'); }
    if (o.tail === 'lizard') P.line(bez([18, tb], [22, tb + 3], [25, 28], [30, 28.5], 12), 2, 0.6, o.tailKey || skinKey);
    if (o.hair === 'long' || o.hair === 'snakes') P.ell(16, hy + 2.2, hr + 1.1, hr + 2.6, 'h');

    // parte de abajo
    if (lower === 'legs') {
      if (skel) {
        for (const d of [-1, 1]) {
          P.line([[16 + d * 2, tb], [16 + d * 2.2, GY - 1]], 0.65, 0.6, 't');
          P.rect(16 + d * 2.2 - (d < 0 ? 2 : 0), GY - 1, 2, 1, 't');
        }
      } else if (o.legs === 'bird') {
        for (const d of [-1, 1]) {
          P.line([[16 + d * 2, tb], [16 + d * 2.6, tb + 4], [16 + d * 1.6, GY - 1]], 0.7, 0.5, 'a');
          P.line([[16 + d * 0.2, GY - 0.6], [16 + d * 3.4, GY - 0.6]], 0.5, 0.5, 'a');
        }
      } else {
        const legKey = { armor: 'm~', loincloth: skinKey, none: skinKey, fur: 'cl', rags: 'cl2', shell: skinKey, leaves: skinKey, dress: skinKey, suit: 'cl', feathers: 'cl2' }[outfit] || 'cl2';
        const lw = S.leg, gap = S.gap;
        P.rect(16 - gap - lw, tb - 0.5, lw, GY - tb + 0.5, legKey);
        P.rect(16 + gap, tb - 0.5, lw, GY - tb + 0.5, legKey);
        const bootKey = { armor: 'm', loincloth: 'sk~', none: 'sk~', rags: 'sk~', shell: 'sk~', leaves: 'sk~', dress: 'k' }[outfit] || o.boots || 'wd~';
        P.rect(16 - gap - lw - 0.5, GY - 2.2, lw + 0.5, 2.2, bootKey);
        P.rect(16 + gap, GY - 2.2, lw + 0.5, 2.2, bootKey);
        if (outfit === 'rags') { P.rect(16 - gap - lw, tb + 2.5, lw, 2, skinKey); P.rect(16 + gap, tb + 2.5, lw, 2, skinKey); }
      }
    } else if (lower === 'robe') {
      P.poly([[16 - wa - 0.5, tb - 1.5], [16 + wa + 0.5, tb - 1.5], [16 + wa + 3, GY], [16 - wa - 3, GY]], 'cl');
      P.rect(16 - wa - 3, GY - 1.2, (wa + 3) * 2, 1.2, 'a');
      P.line([[16, tb], [16, GY - 1.5]], 0.45, 0.45, 'cl~');
    } else if (lower === 'serpent' || lower === 'fishtail') {
      const key = lower === 'fishtail' ? (o.tailKey || 'cl') : 'b';
      const path = bez([16, tb - 1], [11, tb + 4], [9, GY + 0.5], [16, GY - 1.6], 12)
        .concat(bez([16, GY - 1.6], [21, GY - 2.6], [24, GY - 1.2], [26.5, GY - 5], 10).slice(1));
      P.line(path, wa + 0.6, lower === 'fishtail' ? 0.8 : 0.6, key, 2.4);
      P.line(path.slice(3, 16).map(([x, y]) => [x + 0.9, y + 0.6]), 0.8, 0.8, lower === 'fishtail' ? `${key}~` : 'c');
      if (lower === 'fishtail') {
        const e = path[path.length - 1];
        P.poly([[e[0] - 0.5, e[1] + 0.5], [e[0] + 4, e[1] - 4.5], [e[0] + 2, e[1] + 0.5], [e[0] + 4.5, e[1] + 3]], 'a');
      }
    }

    // torso
    if (skel) {
      P.line([[16, tt + 0.5], [16, tb]], 0.6, 0.6, 't');
      for (let y = tt + 1.6, i = 0; i < 4; y += 1.8, i++) P.line([[16 - sh + 1.4 + i * 0.4, y], [16 + sh - 1.4 - i * 0.4, y]], 0.45, 0.45, 't');
      P.rect(14, tb - 1.2, 4, 1.5, 't');
    } else {
      const torsoKey = { loincloth: skinKey, none: skinKey, shell: skinKey, leaves: skinKey, fur: skinKey, armor: 'm' }[outfit] || 'cl';
      P.poly([[16 - sh, tt], [16 + sh, tt], [16 + wa, tb], [16 - wa, tb]], torsoKey);
      P.ell(16 - sh + 0.6, tt + 0.6, 1.1, 1, torsoKey); P.ell(16 + sh - 0.6, tt + 0.6, 1.1, 1, torsoKey);
      if (outfit === 'tunic' || outfit === 'rags' || outfit === 'feathers') {
        P.poly([[14.6, tt - 0.2], [17.4, tt - 0.2], [16, tt + 2.2]], skinKey);
        P.rect(16 - wa, tb - 2, wa * 2, 1.2, 'a');
        if (outfit === 'rags') for (let x = 16 - wa; x < 16 + wa; x += 2) P.put(x, tb, 'cl');
        if (outfit === 'feathers') P.recolor(['cl'], 'cl~', (x, y) => (Math.floor(x) + Math.floor(y)) % 3 === 0);
      }
      if (outfit === 'armor') {
        P.ell(16 - sh, tt + 0.8, 2.2, 1.7, 'm'); P.ell(16 + sh, tt + 0.8, 2.2, 1.7, 'm');
        P.line([[16, tt + 2], [16, tb - 2]], 0.45, 0.45, 'm~');
        P.rect(16 - wa, tb - 2, wa * 2, 1.4, 'a');
        if (o.tabard) P.poly([[14, tt + 1.5], [18, tt + 1.5], [18, tb + 3], [16, tb + 4], [14, tb + 3]], 'cl');
      }
      if (outfit === 'loincloth' || outfit === 'none' || outfit === 'fur') {
        P.line([[16 - sh * 0.55, tt + 2.6], [15.2, tt + 3.2]], 0.4, 0.4, 'sk~');
        P.line([[16 + sh * 0.55, tt + 2.6], [16.8, tt + 3.2]], 0.4, 0.4, 'sk~');
        P.line([[16, tt + 4.2], [16, tb - 2.5]], 0.4, 0.4, 'sk~');
        if (o.belly) P.ell(16, tb - 3, wa * 0.85, 2.6, skinKey);
        if (outfit === 'fur') P.recolor([skinKey], 'c', (x, y) => inE(x, y, 16, (tt + tb) / 2 + 1, wa * 0.7, (tb - tt) * 0.38));
        if (outfit !== 'none' || o.loin) P.poly([[16 - wa - 0.4, tb - 1.6], [16 + wa + 0.4, tb - 1.6], [16 + wa - 1, tb + 3.2], [16 - wa + 1, tb + 3.2]], 'cl');
        if (outfit === 'loincloth') P.rect(16 - wa - 0.4, tb - 1.8, wa * 2 + 0.8, 1.2, 'a');
      }
      if (outfit === 'robe') { P.line([[16, tt + 0.5], [16, tb]], 0.45, 0.45, 'a'); P.rect(16 - wa, tb - 2, wa * 2, 1.2, 'a'); }
      if (outfit === 'suit') {
        P.poly([[14.2, tt - 0.2], [17.8, tt - 0.2], [16, tt + 5]], 'hl');
        P.poly([[15.2, tt + 0.6], [16.8, tt + 0.6], [16, tt + 2.6]], 'cl2');
      }
      if (outfit === 'dress') {
        P.poly([[16 - wa, tb - 1.5], [16 + wa, tb - 1.5], [16 + wa + 2.4, tb + 4.5], [16 - wa - 2.4, tb + 4.5]], 'cl');
        P.poly([[16 - sh + 0.6, tt - 0.6], [16 + sh - 0.6, tt - 0.6], [16 + 2, tt + 2], [16 - 2, tt + 2]], skinKey);
      }
      if (outfit === 'shell') { P.ell(14.2, tt + 2.6, 1.6, 1.3, 'a'); P.ell(17.8, tt + 2.6, 1.6, 1.3, 'a'); P.rect(16 - wa, tb - 1.6, wa * 2, 1.2, 'a'); }
      if (outfit === 'leaves') {
        P.line([[16 - sh + 1, tt + 1], [16 + wa, tb - 1]], 1.4, 1.4, 'cl');
        P.poly([[16 - wa - 0.5, tb - 1.8], [16 + wa + 0.5, tb - 1.8], [16 + wa + 2, tb + 3.5], [16 + 1, tb + 2], [16 - 1, tb + 3.6], [16 - wa - 2, tb + 3]], 'cl');
      }
    }

    // brazos
    for (const d of [-1, 1]) {
      const s0 = [16 + d * (sh - 0.4), tt + 1.3];
      const el = elbowOf(d), hd = handOf(d);
      if (skel) { P.line([s0, el, hd], 0.6, 0.55, 't'); P.dot(hd[0], hd[1] + 0.3, 0.9, 't'); continue; }
      const sleeve = { tunic: 'cl', armor: 'm', robe: 'cl', suit: 'cl', rags: 'cl', feathers: 'cl' }[outfit] || skinKey;
      P.line([s0, el], ar, ar * 0.95, sleeve);
      P.line([el, hd], ar * 0.95, ar * 0.9, outfit === 'robe' || outfit === 'suit' ? sleeve : (outfit === 'armor' ? 'm~' : skinKey));
      if (outfit === 'robe') P.ell(hd[0], hd[1] - 1, ar * 1.5, ar * 1.2, 'cl');
      P.dot(hd[0], hd[1] + 0.4, ar * 1.05, skinKey);
      if (o.claws) { P.put(hd[0] - 1, hd[1] + 1.8, 'a'); P.put(hd[0], hd[1] + 2.2, 'a'); P.put(hd[0] + 1, hd[1] + 1.8, 'a'); }
      if (o.furry) P.line([[s0[0], s0[1] - 0.5], [s0[0] + d * 1.6, s0[1] + 1]], 0.7, 0.4, 'h');
    }

    // cabeza(s)
    const heads = o.heads === 2 ? [16 - hr * 0.95, 16 + hr * 0.95] : [16];
    for (const hx of heads) humanHead(P, hx, hy, hr, o, skinKey, heads.length > 1);

    // arma y escudo
    if (o.weapon && o.weapon !== 'none') weapon(P, handOf(wSide), wSide, o.weapon);
    if (o.weapon2) weapon(P, handOf(-wSide), -wSide, o.weapon2);
    if (o.shield) shield(P, handOf(-wSide), o.shield);

    if (o.fire) for (const [x, y] of [[16 - sh - 1, tt - 1], [16 + sh + 1, tt - 1.5], [16 - sh, tt - 3], [16 + sh - 0.5, tt - 3.5]]) {
      P.line([[x, y + 1.5], [x + 0.3, y - 1.5]], 0.9, 0.3, 'f');
    }
  }

  function humanWings(P, tt, kind) {
    for (const d of [-1, 1]) {
      const X = (v) => 16 + d * v;
      if (kind === 'feather') {
        P.poly([[X(2), tt + 1], [X(6), tt - 7], [X(12), tt - 9], [X(15), tt - 5], [X(13.5), tt + 1], [X(10), tt + 6], [X(5), tt + 4]], 'wg');
        for (let i = 0; i < 4; i++) P.line([[X(6 + i * 2), tt - 6 + i], [X(6.5 + i * 2), tt + 1 + i]], 0.45, 0.35, 'wg~');
      } else {
        P.poly([[X(2), tt + 2], [X(5), tt - 6], [X(10), tt - 9], [X(15), tt - 6], [X(14.5), tt + 3], [X(12), tt + 1], [X(10), tt + 5], [X(7.5), tt + 2.5], [X(5), tt + 6]], 'wg');
        P.line([[X(3), tt + 1], [X(5), tt - 6], [X(10), tt - 9]], 0.55, 0.45, 'a');
        P.line([[X(5), tt - 6], [X(14.5), tt + 2.5]], 0.45, 0.4, 'a');
        P.line([[X(5), tt - 6], [X(10), tt + 4.5]], 0.45, 0.4, 'a');
      }
    }
  }

  function humanHead(P, hx, hy, hr, o, skinKey, small) {
    const head = o.head || 'human';
    const hair = o.hair || 'none';
    const hat = o.hat || 'none';
    const r = small ? hr * 0.9 : hr;
    const L = hx - r, R = hx + r;

    // detrás de la cabeza: capucha, orejas, cuernos
    if (hat === 'hood') P.ell(hx, hy - 0.4, r + 1.6, r + 1.5, 'cl2');
    if (o.ears === 'goblin') { P.poly([[L + 0.6, hy - 0.4], [L - 3.6, hy - 2.8], [L + 0.6, hy + 1.6]], skinKey); P.poly([[R - 0.6, hy - 0.4], [R + 3.6, hy - 2.8], [R - 0.6, hy + 1.6]], skinKey); }
    if (o.ears === 'elf') { P.poly([[L + 0.6, hy], [L - 2.4, hy - 3.6], [L + 0.6, hy + 1.4]], skinKey); P.poly([[R - 0.6, hy], [R + 2.4, hy - 3.6], [R - 0.6, hy + 1.4]], skinKey); }
    if (o.ears === 'round') { P.dot(L + 0.2, hy - r * 0.7, 1.4, 'h'); P.dot(R - 0.2, hy - r * 0.7, 1.4, 'h'); }
    if (o.horns === 'curved') {
      for (const d of [-1, 1]) P.line(bez([hx + d * r * 0.55, hy - r * 0.6], [hx + d * (r + 1.5), hy - r * 0.5], [hx + d * (r + 2.2), hy - r - 1.5], [hx + d * (r + 1.2), hy - r - 3], 8), 1.0, 0.35, 'a');
    }
    if (o.horns === 'big') {
      for (const d of [-1, 1]) P.line(bez([hx + d * r * 0.6, hy - r * 0.55], [hx + d * (r + 2.5), hy - r * 0.3], [hx + d * (r + 4.5), hy - r + 0.5], [hx + d * (r + 4.5), hy - r - 1.5], 8), 1.4, 0.4, 'a');
    }
    if (o.horns === 'small') for (const d of [-1, 1]) P.poly([[hx + d * r * 0.3, hy - r * 0.75], [hx + d * r * 0.65, hy - r - 2], [hx + d * r * 0.85, hy - r * 0.5]], 'a');

    // cabeza según tipo
    if (head === 'skull') {
      P.ell(hx, hy - 0.3, r * 0.95, r, 't');
      P.rect(hx - r * 0.55, hy + r * 0.45, r * 1.1, 2, 't');
      P.ell(hx - r * 0.42, hy, 1.3, 1.4, 'k'); P.ell(hx + r * 0.42, hy, 1.3, 1.4, 'k');
      P.put(hx - r * 0.42, hy, 'e'); P.put(hx + r * 0.42 - 1, hy, 'e');
      P.put(hx - 0.5, hy + 1.6, 'k');
      for (let x = hx - r * 0.45; x < hx + r * 0.5; x += 2) P.put(x, hy + r * 0.62, 'k');
    } else if (head === 'robot') {
      P.rect(hx - r, hy - r * 0.95, r * 2, r * 1.9, 'm');
      P.rect(hx - r + 0.6, hy - 0.8, r * 2 - 1.2, 2, 'e');
      P.line([[hx, hy - r - 0.5], [hx, hy - r - 2.5]], 0.4, 0.4, 'a');
      P.put(hx - 0.5, hy - r - 3.2, 'g');
      for (let x = hx - 2; x <= hx + 1; x += 1.5) P.put(x, hy + r * 0.55, 'o');
    } else if (head === 'alien') {
      P.ell(hx, hy - 0.8, r * 1.18, r * 1.15, skinKey);
      P.ell(hx, hy + r * 0.45, r * 0.7, r * 0.6, skinKey);
      P.poly([[hx - r * 0.9, hy - 1.2], [hx - 0.6, hy - 0.4], [hx - 1.2, hy + 1.6], [hx - r * 0.8, hy + 0.8]], 'k');
      P.poly([[hx + r * 0.9, hy - 1.2], [hx + 0.6, hy - 0.4], [hx + 1.2, hy + 1.6], [hx + r * 0.8, hy + 0.8]], 'k');
      P.put(hx - r * 0.65, hy - 0.6, 'hl'); P.put(hx + r * 0.65 - 1, hy - 0.6, 'hl');
      P.put(hx - 0.5, hy + r * 0.75, 'o');
    } else if (head === 'wolf') {
      for (const d of [-1, 1]) P.poly([[hx + d * r * 0.25, hy - r * 0.6], [hx + d * r * 0.85, hy - r - 2.8], [hx + d * r * 1.05, hy - r * 0.2]], skinKey);
      P.ell(hx, hy, r, r * 0.92, skinKey);
      P.ell(hx, hy + r * 0.48, r * 0.58, r * 0.5, 'c');
      P.rect(hx - 1, hy + r * 0.12, 2, 1, 'k');
      P.put(hx - r * 0.45, hy - r * 0.2, 'e'); P.put(hx + r * 0.45 - 1, hy - r * 0.2, 'e');
      P.put(hx - 1.4, hy + r * 0.85, 't'); P.put(hx + 0.4, hy + r * 0.85, 't');
    } else if (head === 'bull') {
      for (const d of [-1, 1]) {
        P.line([[hx + d * r * 0.7, hy - r * 0.45], [hx + d * (r + 2.6), hy - r * 0.6], [hx + d * (r + 3.4), hy - r - 2.6]], 1.1, 0.4, 'a');
        P.ell(hx + d * (r + 0.4), hy - 0.2, 1.4, 0.9, skinKey);
      }
      P.ell(hx, hy, r * 1.08, r, skinKey);
      P.ell(hx, hy + r * 0.55, r * 0.66, r * 0.42, 'c');
      P.put(hx - 1.4, hy + r * 0.55, 'k'); P.put(hx + 0.4, hy + r * 0.55, 'k');
      P.put(hx - r * 0.5, hy - r * 0.25, 'e'); P.put(hx + r * 0.5 - 1, hy - r * 0.25, 'e');
      if (o.ring) P.put(hx - 0.5, hy + r * 0.95, 'a');
    } else if (head === 'lizard') {
      P.ell(hx, hy - 0.2, r * 0.92, r, skinKey);
      P.ell(hx, hy + r * 0.5, r * 0.6, r * 0.5, skinKey);
      P.put(hx - 1.2, hy + r * 0.35, 'k'); P.put(hx + 0.2, hy + r * 0.35, 'k');
      P.put(hx - r * 0.55, hy - r * 0.25, 'e'); P.put(hx + r * 0.55 - 1, hy - r * 0.25, 'e');
      P.line([[hx - 1.5, hy + r * 0.85], [hx + 1.5, hy + r * 0.85]], 0.4, 0.4, 'o');
      P.recolor([skinKey], `${skinKey}~`, (x, y) => y < hy - r * 0.4 && (Math.floor(x) + Math.floor(y)) % 2 === 0);
    } else {
      // humano (y variantes: cíclope, bestia)
      P.ell(hx, hy, r, r * 1.02, skinKey);
      if (head === 'beast') { P.ell(hx, hy + r * 0.45, r * 0.55, r * 0.42, 'c'); P.rect(hx - 1, hy + r * 0.2, 2, 1, 'k'); }
      const eyeY = hy - r * 0.05;
      if (head === 'cyclops') {
        P.ell(hx, eyeY - 0.4, 2.1, 1.7, 'hl');
        P.ell(hx, eyeY - 0.4, 1.1, 1.1, 'e');
        P.put(hx - 0.5, eyeY - 0.5, 'k');
      } else if (hat !== 'helmet-full' && hat !== 'hood') {
        if (o.eyes === 'glow') {
          P.rect(hx - r * 0.55 - 0.5, eyeY, 2, 1, 'e'); P.rect(hx + r * 0.55 - 1.5, eyeY, 2, 1, 'e');
        } else {
          const ex1 = hx - Math.max(1.5, r * 0.42), ex2 = hx + Math.max(1.5, r * 0.42) - 1;
          P.rect(ex1, eyeY, 1, 2, o.eyeKey || 'k'); P.rect(ex2, eyeY, 1, 2, o.eyeKey || 'k');
          if (o.eyes === 'color') { P.put(ex1, eyeY + 1, 'e'); P.put(ex2, eyeY + 1, 'e'); }
          if (o.brows) { P.put(ex1 - 1, eyeY - 1, 'o'); P.put(ex1, eyeY - 0.6, 'o'); P.put(ex2 + 1, eyeY - 1, 'o'); P.put(ex2, eyeY - 0.6, 'o'); }
        }
      }
      if (o.nose === 'big') P.rect(hx - 1, eyeY + 1.6, 2, 1.4, `${skinKey}~`);
      if (o.nose === 'long') P.rect(hx - 0.5, eyeY + 1.2, 1.2, 2.6, `${skinKey}~`);
      const my = hy + r * 0.62;
      const mouth = o.mouth || 'line';
      if (mouth === 'line') P.rect(hx - 1, my, 2, 0.8, 'o');
      if (mouth === 'grin' || mouth === 'teeth') { P.rect(hx - 2, my - 0.2, 4, 1, 'k'); P.put(hx - 1.5, my - 0.2, 't'); P.put(hx + 0.5, my - 0.2, 't'); }
      if (mouth === 'fangs') { P.rect(hx - 1.5, my - 0.2, 3, 0.8, 'o'); P.put(hx - 1.5, my + 0.8, 't'); P.put(hx + 0.5, my + 0.8, 't'); }
      if (mouth === 'tusks') { P.rect(hx - 1.5, my, 3, 0.8, 'o'); P.put(hx - 2.6, my - 0.6, 't'); P.put(hx - 2.6, my - 1.6, 't'); P.put(hx + 1.6, my - 0.6, 't'); P.put(hx + 1.6, my - 1.6, 't'); }
    }

    // pelo
    const top = (y, cut) => P.recolor([skinKey], 'h', (x, yy) => yy < y && inE(x, yy, hx, hy, r + 0.2, r * 1.05 + 0.2) && (!cut || cut(x, yy)));
    if (hair === 'short' || hair === 'long' || hair === 'slick' || hair === 'messy' || hair === 'curly') {
      top(hy - r * 0.35, hair === 'slick' ? (x, y) => !(Math.abs(x - hx) < 1 && y > hy - r * 0.6) : null);
      P.recolor([skinKey], 'h', (x, y) => y < hy + 0.6 && (x < L + 1.1 || x > R - 1.1) && inE(x, y, hx, hy, r + 0.2, r * 1.05));
      if (hair === 'curly') for (let x = L + 0.5; x < R; x += 1.6) P.dot(x, hy - r + 0.4, 0.9, 'h');
      if (hair === 'messy') { P.put(hx - 2, hy - r - 0.6, 'h'); P.put(hx + 1, hy - r - 0.8, 'h'); }
    }
    if (hair === 'long') { P.rect(L - 0.6, hy - 0.5, 1.6, r + 3, 'h'); P.rect(R - 1, hy - 0.5, 1.6, r + 3, 'h'); }
    if (hair === 'mohawk') P.rect(hx - 1, hy - r - 2, 2, r + 0.5, 'h');
    if (hair === 'wild') {
      top(hy - r * 0.3);
      for (let i = -2; i <= 2; i++) P.poly([[hx + i * 1.9 - 1.2, hy - r + 1], [hx + i * 2.3, hy - r - 2.4 + Math.abs(i) * 0.6], [hx + i * 1.9 + 1.2, hy - r + 1]], 'h');
    }
    if (hair === 'snakes') {
      top(hy - r * 0.3);
      for (const ang of [-2.8, -2.2, -1.57, -0.95, -0.35]) {
        const bx = hx + Math.cos(ang) * r, by = hy + Math.sin(ang) * r;
        const ex = hx + Math.cos(ang) * (r + 3.2), ey = hy + Math.sin(ang) * (r + 3.2);
        P.line([[bx, by], [(bx + ex) / 2 + 0.8, (by + ey) / 2], [ex, ey]], 0.6, 0.55, 'h');
        P.put(ex, ey, 'e');
      }
    }
    if (hair === 'leaves') {
      for (const [dx, dy, rr] of [[-r, -1, 2], [r, -1, 2], [-r * 0.6, -r, 2.4], [r * 0.6, -r, 2.4], [0, -r - 0.6, 2.2], [-r - 0.6, 2, 1.8], [r + 0.6, 2, 1.8]]) P.ell(hx + dx, hy + dy, rr, rr * 0.8, 'h');
      for (const [dx, dy] of [[-r * 0.6, -r - 0.4], [r * 0.5, -r - 1]]) P.put(hx + dx, hy + dy, 'a');
    }
    if (hair === 'flame') for (let i = -2; i <= 2; i++) P.line([[hx + i * 1.8, hy - r * 0.6], [hx + i * 2.2, hy - r - 3 + Math.abs(i)]], 0.9, 0.3, 'f');

    // barba / máscara
    if (o.beard) {
      P.recolor([skinKey], 'h', (x, y) => y > hy + r * 0.2 && inE(x, y, hx, hy, r + 0.2, r * 1.05));
      P.ell(hx, hy + r + (o.beard === 'long' ? 2 : 0.8), r * 0.75, o.beard === 'long' ? 3.2 : 1.8, 'h');
      P.rect(hx - 1, hy + r * 0.55, 2, 0.8, 'o');
    }
    if (o.mask) P.recolor([skinKey], 'cl2', (x, y) => y > hy + r * 0.15 && inE(x, y, hx, hy, r + 0.2, r * 1.05));

    // sombreros y cascos
    if (hat === 'hood') {
      P.recolor([skinKey, 'h'], 'cl2', (x, y) => y < hy - r * 0.3 || x < L + 0.8 || x > R - 0.8);
      if (o.eyes === 'glow' || o.shadowFace) {
        P.recolor([skinKey], 'k', (x, y) => y < hy + r * 0.3);
        P.put(hx - r * 0.45, hy - 0.2, 'e'); P.put(hx + r * 0.45 - 1, hy - 0.2, 'e');
      } else {
        P.rect(hx - Math.max(1.5, r * 0.42), hy - r * 0.05, 1, 2, 'k'); P.rect(hx + Math.max(1.5, r * 0.42) - 1, hy - r * 0.05, 1, 2, 'k');
      }
    }
    if (hat === 'wizard') {
      P.ell(hx, hy - r * 0.55, r + 3.2, 1.3, 'cl');
      P.poly([[hx - r + 0.4, hy - r * 0.6], [hx + r - 0.4, hy - r * 0.6], [hx + 3, hy - r - 3], [hx + 6, hy - r - 3.6], [hx + 1.5, hy - r - 2]], 'cl');
      P.rect(hx - r + 0.6, hy - r * 0.95, r * 2 - 1.2, 1, 'a');
      P.put(hx - 0.5, hy - r - 1, 'a');
    }
    if (hat === 'helmet' || hat === 'horned') {
      P.recolor([skinKey, 'h'], 'm', (x, y) => y < hy - r * 0.25 && inE(x, y, hx, hy, r + 0.3, r * 1.05 + 0.3));
      P.ell(hx, hy - r * 0.35, r + 0.6, 0.9, 'm~');
      P.rect(hx - 0.5, hy - r * 0.3, 1, 2.4, 'm');
      if (hat === 'horned') for (const d of [-1, 1]) P.line([[hx + d * r * 0.8, hy - r * 0.6], [hx + d * (r + 2), hy - r - 1], [hx + d * (r + 1.6), hy - r - 3]], 0.8, 0.35, 't');
    }
    if (hat === 'helmet-full') {
      P.ell(hx, hy, r + 0.4, r * 1.05 + 0.4, 'm');
      P.rect(hx - r + 0.8, hy - 0.4, r * 2 - 1.6, 1.2, 'k');
      P.put(hx - r * 0.45, hy - 0.4, 'e'); P.put(hx + r * 0.45 - 1, hy - 0.4, 'e');
      P.line([[hx, hy + 1.2], [hx, hy + r * 0.9]], 0.4, 0.4, 'm~');
      P.line([[hx, hy - r - 0.4], [hx + 2, hy - r - 2], [hx + 5, hy - r - 1.2]], 0.9, 0.5, 'cl');
    }
    if (hat === 'crown') {
      P.rect(hx - r + 0.6, hy - r * 0.9, r * 2 - 1.2, 1.4, 'a');
      for (let x = hx - r + 0.8; x < hx + r - 0.5; x += 2) P.put(x, hy - r * 0.9 - 1, 'a');
      P.put(hx - 0.5, hy - r * 0.9, 'g');
    }
    if (hat === 'gnome') P.poly([[hx - r - 0.6, hy - r * 0.3], [hx + r + 0.6, hy - r * 0.3], [hx + 1.5, hy - r - 5.5], [hx + 4.5, hy - r - 6], [hx + 0.5, hy - r - 4]], 'a');
    if (hat === 'bandana') { P.rect(hx - r, hy - r * 0.55, r * 2, 1.4, 'cl2'); P.line([[R - 0.5, hy - r * 0.4], [R + 2, hy + 0.8]], 0.5, 0.5, 'cl2'); }
    if (hat === 'halo') {
      const ring = [];
      for (let i = 0; i <= 18; i++) { const t = (i / 18) * Math.PI * 2; ring.push([hx + Math.cos(t) * r * 0.95, hy - r - 2.6 + Math.sin(t) * 1.2]); }
      P.line(ring, 0.55, 0.55, 'g');
    }
  }

  function weapon(P, hand, d, kind) {
    const [x, y] = hand;
    if (kind === 'sword' || kind === 'bigsword' || kind === 'dagger') {
      const len = kind === 'dagger' ? 4.5 : kind === 'bigsword' ? 13 : 10;
      const w = kind === 'bigsword' ? 0.95 : 0.65;
      P.line([[x, y - 1.2], [x, y - 1.2 - len]], w, w * 0.6, 'm');
      P.put(x - 0.5, y - 1.2 - len + 0.5, 'hl');
      P.line([[x - 2.2, y - 1.2], [x + 2.2, y - 1.2]], 0.5, 0.5, 'a');
      P.put(x, y + 1.2, 'a');
    } else if (kind === 'axe' || kind === 'greataxe') {
      P.line([[x, y + 2.5], [x, y - 10]], 0.55, 0.5, 'wd');
      P.poly([[x, y - 10], [x + d * 4.2, y - 12], [x + d * 4.8, y - 6.6], [x, y - 7.4]], 'm');
      if (kind === 'greataxe') P.poly([[x, y - 10], [x - d * 4.2, y - 12], [x - d * 4.8, y - 6.6], [x, y - 7.4]], 'm');
    } else if (kind === 'club') {
      P.line([[x, y + 1], [x + d * 1.2, y - 8.5]], 0.75, 1.9, 'wd');
      P.put(x + d * 2.4, y - 6.5, 'wd~'); P.put(x + d * 0.4, y - 8.6, 'wd~');
    } else if (kind === 'hammer') {
      P.line([[x, y + 2.5], [x, y - 10]], 0.55, 0.55, 'wd');
      P.rect(x - 3, y - 13, 6, 3.4, 'm');
    } else if (kind === 'staff' || kind === 'staff-skull') {
      P.line([[x, 29.2], [x, y - 12]], 0.55, 0.55, 'wd');
      if (kind === 'staff-skull') { P.ell(x, y - 13.4, 1.8, 1.7, 't'); P.put(x - 1, y - 13.4, 'e'); P.put(x + 0.4, y - 13.4, 'e'); }
      else { P.dot(x, y - 13.2, 1.7, 'g'); P.put(x - 0.5, y - 13.8, 'hl'); P.line([[x - 1.6, y - 11.2], [x + 1.6, y - 11.2]], 0.45, 0.45, 'wd'); }
    } else if (kind === 'spear' || kind === 'trident') {
      P.line([[x, y + 4], [x, y - 12]], 0.5, 0.5, 'wd');
      if (kind === 'spear') P.poly([[x - 1.1, y - 12], [x, y - 15.5], [x + 1.1, y - 12]], 'm');
      else { P.line([[x - 2, y - 12], [x + 2, y - 12]], 0.45, 0.45, 'm'); for (const dx of [-2, 0, 2]) P.line([[x + dx, y - 12], [x + dx, y - 15]], 0.45, 0.4, 'm'); }
    } else if (kind === 'bow') {
      P.line(bez([x + d * 0.5, y - 9], [x + d * 4, y - 6], [x + d * 4, y + 2], [x + d * 0.5, y + 5], 10), 0.6, 0.6, 'wd');
      P.line([[x + d * 0.6, y - 9], [x + d * 0.6, y + 5]], 0.3, 0.3, 'hl');
    } else if (kind === 'whip') {
      P.line(bez([x, y], [x + d * 4, y + 2], [x + d * 1, y + 6], [x + d * 5, 29], 12), 0.6, 0.45, 'f');
    } else if (kind === 'wand') {
      P.line([[x, y], [x + d * 1.2, y - 4.5]], 0.45, 0.45, 'wd');
      P.put(x + d * 1.4, y - 5.4, 'g');
    } else if (kind === 'gun') {
      P.rect(x - 1.6, y - 1.6, 3.2, 1.6, 'm');
      P.put(x + d * 2, y - 1.6, 'g');
    } else if (kind === 'scythe') {
      P.line([[x, 29], [x, y - 12]], 0.5, 0.5, 'wd');
      P.line(bez([x, y - 12], [x - d * 3, y - 14], [x - d * 7, y - 12], [x - d * 8, y - 8], 8), 0.9, 0.35, 'm');
    }
  }

  function shield(P, hand, kind) {
    const [x, y] = hand;
    if (kind === 'kite') {
      P.poly([[x - 2.6, y - 4.5], [x + 2.6, y - 4.5], [x + 2.4, y], [x, y + 3.8], [x - 2.4, y]], 'm');
      P.line([[x, y - 4], [x, y + 2.5]], 0.45, 0.45, 'a'); P.line([[x - 1.8, y - 2.2], [x + 1.8, y - 2.2]], 0.45, 0.45, 'a');
    } else {
      P.ell(x, y - 1, 3.3, 3.3, 'm');
      P.ell(x, y - 1, 2.5, 2.5, 'wd');
      P.ell(x, y - 1, 1.1, 1.1, 'a');
    }
  }

  const PLANS = {
    beast: planBeast, dragon: planDragon, bird: planBird, owl: planOwl, bat: planBat,
    spider: planSpider, scorpion: planScorpion, crab: planCrab, serpent: planSerpent,
    slime: planSlime, ghost: planGhost, elemental: planElemental, golem: planGolem,
    tree: planTree, eye: planEye, tentacle: planTentacle, fish: planFish, turtle: planTurtle,
    humanoid: planHumanoid,
  };

  // ============================================================
  // Especies (los 78 enemigos del juego)
  // ============================================================

  const SPECIES = {
    // ---------- Tier 1 ----------
    cuervo: { plan: 'bird', s: 0.86, p: { b: '#2a2a38', c: '#3e3e56', wg: '#26263a', a: '#d9a030', e: '#ffd23f' }, o: { beak: 'short' } },
    murcielago: { plan: 'bat', s: 0.9, p: { b: '#5a3d5c', c: '#7a5a7a', wg: '#6e4466', a: '#3a2638', e: '#ff5050' } },
    rata: { plan: 'beast', s: 0.8, p: { b: '#7d6d5c', c: '#b7a48e', a: '#e6a6a6', e: '#ff4040' }, o: { len: 17, h: 8, leg: 3, legW: 1.4, head: 3.8, snout: 4.4, snoutH: 2.8, ears: 'round', tail: 'thin', neck: 0 } },
    buho: { plan: 'owl', s: 0.88, p: { b: '#8a6a40', c: '#e6d2a8', h: '#6a4a2a', a: '#e0a030', e: '#ffcc33' } },
    arana: { plan: 'spider', s: 0.92, p: { b: '#30242f', c: '#b03050', e: '#ff3030', a: '#d0d0d0' } },
    gato: { plan: 'beast', s: 0.84, p: { b: '#4a4a54', c: '#8a8a96', a: '#d07080', e: '#a0ff60' }, o: { len: 15, h: 7.5, leg: 5, legW: 1.3, head: 4, snout: 0, ears: 'cat', tail: 'up', stripes: true, neck: 1 } },
    zorro: { plan: 'beast', s: 0.88, p: { b: '#d0702a', c: '#f3e6d0', a: '#2a1a10', e: '#ffcc33' }, o: { len: 16, h: 7.5, leg: 4.5, legW: 1.3, head: 3.9, snout: 4.2, snoutH: 2.4, ears: 'pointy', tail: 'bushy', tailTip: 'c', neck: 1.5 } },
    perro_salvaje: { plan: 'beast', s: 0.92, p: { b: '#8a6a48', c: '#c8a878', e: '#ffcc33' }, o: { len: 16, h: 8, leg: 5.5, legW: 1.4, head: 4, snout: 4, ears: 'pointy', tail: 'up', spots: true, neck: 1.5, jaw: 'open' } },
    serpiente: { plan: 'serpent', s: 0.9, p: { b: '#4a8a3a', c: '#d8d070', a: '#2a5a20', e: '#ffdd00', r: '#e03030' } },
    halcon: { plan: 'bird', s: 0.92, p: { b: '#7a5a3a', c: '#efe6d0', wg: '#6a4a2a', a: '#f0b030', e: '#ffcc33' }, o: { beak: 'hook', wing: 'spread', chest: 'bars' } },
    kobold: { plan: 'humanoid', p: { sk: '#b8642e', cl: '#6a5a40', cl2: '#4a3a28', h: '#7a3a1a', a: '#8a6a3a', m: '#c0c0c8', wd: '#6a4a2a', e: '#ffee55' }, o: { size: 'tiny', head: 'lizard', horns: 'small', outfit: 'rags', weapon: 'spear', tail: 'lizard' } },
    rata_gigante: { plan: 'beast', s: 0.9, p: { b: '#5a4a40', c: '#8a7060', a: '#c08080', e: '#ff3030' }, o: { len: 19, h: 9.5, leg: 4, legW: 1.8, head: 4.6, snout: 4.6, snoutH: 3.2, ears: 'round', tail: 'thin', jaw: 'open', back: 'bristles', neck: 0 } },
    esqueleto: { plan: 'humanoid', p: { t: '#e8e0c8', m: '#9aa0a8', a: '#8a6a3a', wd: '#7a5a3a', e: '#60c0ff' }, o: { size: 'medium', body: 'skeleton', head: 'skull', weapon: 'sword', shield: 'round' } },

    // ---------- Tier 2 ----------
    goblin: { plan: 'humanoid', p: { sk: '#6a9a3a', cl: '#6a4a2a', cl2: '#4a3a28', h: '#2a2a1a', a: '#8a6a3a', m: '#b0b0b8', e: '#ffdd33' }, o: { size: 'small', ears: 'goblin', nose: 'big', mouth: 'grin', outfit: 'rags', weapon: 'dagger', eyes: 'color', brows: true } },
    lobo: { plan: 'beast', p: { b: '#7a8290', c: '#d0d4d8', h: '#5c646e', e: '#ffcc33' }, o: { len: 17, h: 8.5, leg: 6, legW: 1.5, head: 4.3, snout: 4.6, snoutH: 2.8, ears: 'pointy', tail: 'bushy', neck: 1.5, jaw: 'open' } },
    jabali: { plan: 'beast', p: { b: '#5a4030', c: '#7a5a40', h: '#2a1a10', a: '#f0e8d0', e: '#ff6020' }, o: { len: 18, h: 10, leg: 4, legW: 1.7, head: 4.8, snout: 3.2, snoutH: 3.6, ears: 'small', tail: 'curl', back: 'bristles', horns: 'tusks', feet: 'hoof', headLow: true, muzzle: false } },
    zombi: { plan: 'humanoid', p: { sk: '#7a9a6a', cl: '#5a4a6a', cl2: '#3a3448', h: '#2a2a20', a: '#4a3a2a', e: '#ff4040' }, o: { size: 'medium', pose: 'forward', outfit: 'rags', mouth: 'teeth', hair: 'messy', eyes: 'glow' } },
    slime: { plan: 'slime', s: 0.9, p: { b: '#50c050', c: '#9ae890', k: '#103010' } },
    tortuga: { plan: 'turtle', s: 0.95, p: { b: '#6a8a4a', c: '#8a6a30', a: '#5a4020', e: '#101010' } },
    aguila: { plan: 'bird', p: { b: '#5a3a20', c: '#7a5a3a', h: '#f2ece0', wg: '#4a2c16', a: '#f0c030', e: '#ffcc33' }, o: { beak: 'hook', wing: 'spread', headKey: 'h' } },
    escorpion: { plan: 'scorpion', s: 0.95, p: { b: '#a07030', c: '#c89048', a: '#3a2408', e: '#ff3030' } },
    bandido: { plan: 'humanoid', p: { sk: '#d8a880', cl: '#6a4a3a', cl2: '#2e2626', h: '#3a2414', a: '#2a1a10', m: '#b8b8c0', wd: '#5a3a1a', e: '#201510' }, o: { size: 'medium', hat: 'hood', mask: true, outfit: 'tunic', weapon: 'dagger', cloak: true } },
    fantasma: { plan: 'ghost', s: 0.95, p: { b: '#a8c0d8', c: '#e2ecf8', k: '#203040', e: '#80e0ff' } },
    diablillo: { plan: 'humanoid', p: { sk: '#c03a2a', cl: '#5a1a1a', a: '#f0d080', wg: '#7a2a2a', h: '#2a0a0a', m: '#b0b0b8', wd: '#3a1a10', e: '#ffee00' }, o: { size: 'tiny', horns: 'small', wings: 'bat', tail: 'demon', outfit: 'none', mouth: 'grin', weapon: 'trident', eyes: 'glow' } },
    arpia: { plan: 'humanoid', p: { sk: '#d8b0a0', h: '#5a2a4a', wg: '#9a6a8a', cl: '#7a4a6a', cl2: '#5a3a4a', a: '#e0c040', e: '#ffee00' }, o: { size: 'medium', wings: 'feather', hair: 'wild', outfit: 'feathers', legs: 'bird', claws: true, eyes: 'glow' } },
    hobgoblin: { plan: 'humanoid', p: { sk: '#c07030', cl: '#5a3a2a', cl2: '#3a2a1a', m: '#8a929c', h: '#2a1a10', a: '#8a6a3a', wd: '#5a3a1a', e: '#ffee00' }, o: { size: 'large', outfit: 'armor', hat: 'helmet', ears: 'goblin', weapon: 'sword', shield: 'kite', eyes: 'glow' } },

    // ---------- Tier 3 ----------
    necrofago: { plan: 'humanoid', p: { sk: '#8a8a9a', cl: '#4a3a3a', cl2: '#2a2222', h: '#3a3a44', a: '#d0c8b0', e: '#ffcc00' }, o: { size: 'medium', pose: 'forward', outfit: 'rags', mouth: 'fangs', claws: true, ears: 'goblin', eyes: 'glow' } },
    cangrejo: { plan: 'crab', s: 0.9, p: { b: '#d04a2a', c: '#f08a5a', a: '#f0c0a0', e: '#201010' } },
    orco: { plan: 'humanoid', p: { sk: '#5a8a3a', cl: '#6a5a4a', cl2: '#3a3a3a', m: '#a0a0a8', h: '#1a1a1a', a: '#8a6a3a', wd: '#5a3a1a', e: '#ff3030' }, o: { size: 'large', mouth: 'tusks', hair: 'mohawk', outfit: 'loincloth', weapon: 'axe', brows: true } },
    oso: { plan: 'beast', p: { b: '#6a4a2a', c: '#9a7a5a', a: '#e8e0d0', e: '#1a0a0a' }, o: { len: 21, h: 12, leg: 5, legW: 2.4, head: 5, snout: 3.2, snoutH: 3.2, ears: 'round', tail: 'short', hump: true, claws: true, neck: 0, headLow: true } },
    banshee: { plan: 'ghost', p: { b: '#c8d0e0', c: '#eef2fa', h: '#e2e8f4', k: '#302040', e: '#ff5080' }, o: { hair: true, scream: true } },
    drow: { plan: 'humanoid', p: { sk: '#4a4a6a', h: '#f0f0ff', cl: '#2a1a3a', cl2: '#1a1028', m: '#c0b0ff', a: '#a080ff', e: '#ff4040' }, o: { size: 'medium', ears: 'elf', hair: 'long', outfit: 'tunic', cloak: true, weapon: 'dagger', weapon2: 'dagger', eyes: 'glow' } },
    gargola: { plan: 'humanoid', p: { sk: '#7a7a80', a: '#5a5a62', wg: '#66666e', cl: '#5a5a60', h: '#4a4a52', e: '#ff6020' }, o: { size: 'medium', horns: 'curved', wings: 'bat', outfit: 'none', claws: true, tail: 'demon', mouth: 'fangs', eyes: 'glow' } },
    sirena: { plan: 'humanoid', p: { sk: '#a8dccc', h: '#2a8aa0', cl: '#2a7a9a', a: '#f0e0a0', m: '#e0d080', wd: '#c0a050', e: '#203040' }, o: { size: 'medium', hair: 'long', lower: 'fishtail', outfit: 'shell', weapon: 'trident' } },
    driade: { plan: 'humanoid', p: { sk: '#a6c078', h: '#3a903a', cl: '#4a8a3a', a: '#f0a0c0', e: '#a0ff60' }, o: { size: 'medium', hair: 'leaves', outfit: 'leaves', eyes: 'glow', pose: 'cast' } },
    salamandra: { plan: 'beast', s: 1, p: { b: '#d05020', c: '#f0a030', f: '#ffd040', r: '#ff2020', e: '#ffee00' }, o: { len: 20, h: 6.5, leg: 3, legW: 1.4, low: true, head: 3.6, snout: 3, ears: 'none', tail: 'lizard', back: 'flames', neck: 0.5 } },
    osgo: { plan: 'humanoid', p: { sk: '#8a6a3a', h: '#5a3a1a', c: '#b08a5a', cl: '#5a4a3a', a: '#6a5a4a', wd: '#4a2a12', e: '#ffcc00' }, o: { size: 'large', head: 'beast', ears: 'round', hair: 'wild', outfit: 'fur', weapon: 'club', furry: true, eyes: 'glow' } },
    ogro: { plan: 'humanoid', p: { sk: '#b0a070', cl: '#6a5030', cl2: '#4a3020', h: '#3a2a1a', a: '#8a6a3a', wd: '#6a4a2a', e: '#ff3030' }, o: { size: 'huge', outfit: 'loincloth', weapon: 'club', mouth: 'teeth', belly: true, hair: 'messy', brows: true } },
    mago_oscuro: { plan: 'humanoid', p: { sk: '#c8b0a0', cl: '#3a2a5a', cl2: '#241838', a: '#d0b060', wd: '#5a3a2a', g: '#ff40ff', e: '#ff40ff' }, o: { size: 'medium', hat: 'hood', lower: 'robe', outfit: 'robe', weapon: 'staff', eyes: 'glow' } },
    nigromante: { plan: 'humanoid', p: { sk: '#a0b0a0', cl: '#232328', cl2: '#141418', a: '#e8e0c8', wd: '#3a3a3a', t: '#e0dac8', g: '#60ff60', e: '#60ff60' }, o: { size: 'medium', hat: 'hood', lower: 'robe', outfit: 'robe', weapon: 'staff-skull', eyes: 'glow' } },
    tiburon: { plan: 'fish', p: { b: '#6a7a8a', c: '#e0e8f0', e: '#101820' } },
    licantropo: { plan: 'humanoid', p: { sk: '#5a4a3a', c: '#9a8a7a', h: '#3a2a1a', cl: '#4a3a5a', a: '#e8e0d0', e: '#ff3030' }, o: { size: 'large', head: 'wolf', outfit: 'fur', claws: true, furry: true } },
    minotauro: { plan: 'humanoid', p: { sk: '#7a4a2a', c: '#a07050', cl: '#5a3a2a', a: '#e0d0b0', m: '#a0a0a8', wd: '#5a3a1a', e: '#ff3030' }, o: { size: 'large', head: 'bull', outfit: 'loincloth', weapon: 'greataxe', ring: true } },
    troll: { plan: 'humanoid', p: { sk: '#5a7a6a', h: '#3a4a2a', cl: '#4a3a2a', a: '#5a4a3a', wd: '#5a4a3a', e: '#ffcc00' }, o: { size: 'huge', hair: 'wild', mouth: 'tusks', outfit: 'loincloth', weapon: 'club', nose: 'long', ears: 'goblin', eyes: 'glow' } },

    // ---------- Tier 4-10 ----------
    ettin: { plan: 'humanoid', p: { sk: '#a08060', h: '#4a3a2a', cl: '#5a4a3a', cl2: '#3a2a1a', a: '#6a5a4a', wd: '#5a3a1a', e: '#ff3030' }, o: { size: 'huge', heads: 2, outfit: 'loincloth', weapon: 'club', hair: 'messy', mouth: 'teeth' } },
    ent: { plan: 'tree', p: { b: '#5a4030', a: '#3a7a3a', c: '#6aaa4a', e: '#ffcc00' } },
    brightwing: { plan: 'dragon', s: 0.9, p: { b: '#e0c060', c: '#fff0b0', a: '#ffffff', wg: '#f0dc90', e: '#40a0ff' } },
    tentaculo: { plan: 'tentacle', s: 0.92, p: { b: '#8a3a6a', c: '#c06a9a', e: '#ffee00' } },
    medusa: { plan: 'humanoid', p: { sk: '#8ab07a', h: '#3a7a3a', b: '#4a8a4a', c: '#c8d088', cl: '#6a4a2a', a: '#d0c060', wd: '#6a4a2a', e: '#ffee00' }, o: { size: 'medium', hair: 'snakes', lower: 'serpent', weapon: 'bow', outfit: 'tunic', eyes: 'glow' } },
    espectro: { plan: 'ghost', p: { b: '#6a6a8a', c: '#9a9ab8', cl: '#24243a', e: '#ff2040' }, o: { hood: true } },
    sucubo: { plan: 'humanoid', p: { sk: '#c06080', h: '#2a1020', cl: '#5a2a4a', wg: '#4a2a4a', a: '#f0d0f0', e: '#ff80ff' }, o: { size: 'medium', horns: 'curved', wings: 'bat', tail: 'demon', hair: 'long', outfit: 'dress', eyes: 'glow' } },
    elem_arcano: { plan: 'elemental', p: { b: '#6a40c0', c: '#b090ff', f: '#f0e8ff', e: '#ffffff' }, o: { kind: 'arcane' } },
    vampiro: { plan: 'humanoid', p: { sk: '#e0e0e8', h: '#1a1a1a', cl: '#24121a', cl2: '#7a1020', a: '#c0c0c0', e: '#ff2020' }, o: { size: 'medium', hair: 'slick', mouth: 'fangs', outfit: 'suit', cloak: true, eyes: 'glow' } },
    elem_fuego: { plan: 'elemental', p: { b: '#e04a10', c: '#ffa030', f: '#fff0a0', e: '#fff8c0' }, o: { kind: 'fire' } },
    naga: { plan: 'humanoid', p: { sk: '#3a8a8a', b: '#3a8a8a', c: '#c0e0a0', h: '#1a4a4a', m: '#c0c0a0', a: '#d0b050', wd: '#7a6a3a', cl: '#2a5a5a', e: '#ffdd00' }, o: { size: 'medium', head: 'lizard', lower: 'serpent', weapon: 'trident', outfit: 'none', loin: true } },
    elem_hielo: { plan: 'elemental', p: { b: '#7ab8ea', c: '#cfeeff', f: '#ffffff', e: '#1a3a6a' }, o: { kind: 'ice' } },
    manticora: { plan: 'beast', p: { b: '#c08040', c: '#e0b070', h: '#8a4a20', wg: '#7a3a2a', a: '#2a1a10', e: '#ff3030' }, o: { len: 18, h: 9, leg: 5.5, legW: 1.6, head: 4.4, snout: 1.6, ears: 'round', mane: 'lion', wings: 'bat', tail: 'stinger', jaw: 'open', neck: 1 } },
    serp_marina: { plan: 'serpent', p: { b: '#2a6a9a', c: '#80c0d0', a: '#a0e0f0', e: '#ffee00', r: '#ff6060' }, o: { fin: true, big: true } },
    golem: { plan: 'golem', p: { b: '#8a8a80', c: '#a0a094', g: '#60c0ff', e: '#60c0ff' } },
    aparicion: { plan: 'ghost', p: { b: '#4a5a4a', c: '#8aa08a', a: '#a0a090', e: '#a0ff60' }, o: { chains: true } },
    fenix: { plan: 'bird', p: { b: '#e05020', c: '#ffc040', wg: '#ff7030', a: '#ffee80', f: '#ffd040', e: '#ffffff' }, o: { wing: 'spread', crest: true, tail: 'flame' } },
    contemplador: { plan: 'eye', p: { b: '#8a3a5a', c: '#b05a7a', t: '#f0e8e0', e: '#40ff80' } },
    quimera: { plan: 'beast', p: { b: '#a06a3a', c: '#d0a060', h: '#7a4a20', wg: '#5a6a3a', a: '#e0d0b0', e: '#ffcc00' }, o: { len: 18, h: 9, leg: 5.5, legW: 1.6, head: 4.4, snout: 2.2, ears: 'round', mane: 'lion', wings: 'feather', tail: 'snake', horns: 'goat', jaw: 'open', neck: 1 } },
    golem_lava: { plan: 'golem', p: { b: '#4a3030', c: '#2a1a1a', g: '#ff7020', f: '#ffb030', e: '#ffcc00' }, o: { lava: true } },
    ciclope: { plan: 'humanoid', p: { sk: '#c0a080', cl: '#6a5040', cl2: '#4a3020', h: '#5a3a1a', a: '#8a6a3a', wd: '#6a4a2a', e: '#3070ff' }, o: { size: 'huge', head: 'cyclops', outfit: 'loincloth', weapon: 'club', mouth: 'teeth' } },
    cab_muerte: { plan: 'humanoid', p: { m: '#3a3a46', cl: '#5a0a14', cl2: '#2a0a10', a: '#b0a070', t: '#d8d0c0', e: '#ff2020' }, o: { size: 'large', outfit: 'armor', hat: 'helmet-full', weapon: 'bigsword', cloak: true, shield: 'kite', tabard: true } },
    dragon_joven: { plan: 'dragon', s: 0.95, p: { b: '#3a8a4a', c: '#c0d890', a: '#e0e0d0', wg: '#5aa05a', e: '#ffdd00' } },
    archimago: { plan: 'humanoid', p: { sk: '#e0c8b0', h: '#e8e8e8', cl: '#2a3a8a', cl2: '#1a2a6a', a: '#d0b060', wd: '#6a4a2a', g: '#80c0ff', e: '#1a1a3a' }, o: { size: 'medium', hat: 'wizard', beard: 'long', lower: 'robe', outfit: 'robe', weapon: 'staff' } },
    lich: { plan: 'humanoid', p: { t: '#d8d0b8', sk: '#d8d0b8', cl: '#2a1a3a', cl2: '#1a1028', a: '#d0b050', wd: '#3a2a3a', g: '#60ff90', e: '#60ff90' }, o: { size: 'medium', head: 'skull', hat: 'crown', lower: 'robe', outfit: 'robe', weapon: 'staff', cloak: true } },
    senor_vampiro: { plan: 'humanoid', p: { sk: '#e8e0f0', h: '#e6e2ee', cl: '#1a0a12', cl2: '#8a1020', a: '#d4af37', g: '#ff3050', e: '#ff1010' }, o: { size: 'medium', hair: 'slick', mouth: 'fangs', outfit: 'suit', cloak: true, hat: 'crown', eyes: 'glow' } },
    demonio_mayor: { plan: 'humanoid', p: { sk: '#8a1a1a', cl: '#2a0a0a', wg: '#4a0a0a', a: '#2a2222', h: '#1a0505', m: '#5a5a5a', wd: '#2a1a1a', e: '#ffcc00' }, o: { size: 'huge', horns: 'big', wings: 'bat', tail: 'demon', outfit: 'loincloth', mouth: 'fangs', weapon: 'trident', eyes: 'glow' } },
    hidra: { plan: 'dragon', p: { b: '#3a7a5a', c: '#a0c0a0', a: '#d0d0c0', e: '#ffee00' }, o: { heads: 3, wings: false } },
    balrog: { plan: 'humanoid', p: { sk: '#3a1a10', cl: '#2a0a05', wg: '#4a1a0a', a: '#1a0a05', f: '#ff8020', h: '#2a0a05', e: '#ffdd00' }, o: { size: 'huge', horns: 'big', wings: 'bat', hair: 'flame', weapon: 'whip', fire: true, outfit: 'none', eyes: 'glow', mouth: 'fangs' } },
    dragon_anciano: { plan: 'dragon', p: { b: '#8a1a1a', c: '#e0a060', a: '#e8e0d0', wg: '#a02a20', e: '#ffdd00' }, o: { big: true } },
    kraken: { plan: 'tentacle', p: { b: '#6a2a4a', c: '#a04a7a', e: '#ffcc00' }, o: { big: true } },
    alamuerte: { plan: 'dragon', p: { b: '#2a2a2e', c: '#4a4a52', a: '#c0c0c0', wg: '#3a1a10', f: '#ff6010', e: '#ff4010' }, o: { big: true, lava: true } },
    titan: { plan: 'humanoid', p: { sk: '#d8c8a0', h: '#e8e0d0', cl: '#6a6a8a', m: '#d4af37', a: '#d4af37', wd: '#6a4a2a', g: '#80c0ff', e: '#80c0ff' }, o: { size: 'huge', outfit: 'armor', beard: 'long', hair: 'long', hat: 'crown', weapon: 'hammer', eyes: 'glow' } },
    tarrasca: { plan: 'turtle', p: { b: '#6a5a3a', c: '#4a3a2a', a: '#c0b090', e: '#ff3030' }, o: { spikes: true, horns: true, big: true, fangs: true } },
  };

  // ---------- Personajes del jugador (9 razas) ----------
  const HEROES = {
    humano: { p: { sk: '#e2b08a', h: '#5a3a20', cl: '#3a5a8a', cl2: '#3a3040', a: '#8a6a3a', m: '#c0c8d0', wd: '#6a4a2a', e: '#2a1a10' }, o: { size: 'medium', hair: 'short', outfit: 'tunic' } },
    elfo: { p: { sk: '#f0d4b4', h: '#ead070', cl: '#3a7a3a', cl2: '#4a3a2a', a: '#c0a040', m: '#d0d8e0', wd: '#7a5a3a', e: '#2a6a3a' }, o: { size: 'medium', hair: 'long', ears: 'elf', outfit: 'tunic', cloak: true } },
    enano: { p: { sk: '#d8a080', h: '#b05a2a', cl: '#7a5a3a', cl2: '#4a3a2a', a: '#c0a040', m: '#a8b0b8', wd: '#6a4a2a', t: '#efe6d0', e: '#2a1a10' }, o: { size: 'small', hair: 'short', beard: 'long', hat: 'horned', outfit: 'tunic', defaultWeapon: 'axe' } },
    orco: { p: { sk: '#6a9a40', h: '#1a1a1a', cl: '#6a4a2a', cl2: '#3a3a3a', a: '#a0a0a8', m: '#b0b0b8', wd: '#5a3a1a', e: '#3a0a0a' }, o: { size: 'large', hair: 'mohawk', mouth: 'tusks', outfit: 'loincloth', brows: true, defaultWeapon: 'axe' } },
    mediano: { p: { sk: '#eab890', h: '#8a5a2a', cl: '#b0702a', cl2: '#5a6a3a', a: '#6a4a2a', m: '#c0c8d0', wd: '#6a4a2a', e: '#2a1a10' }, o: { size: 'small', hair: 'curly', outfit: 'tunic', defaultWeapon: 'dagger' } },
    gnomo: { p: { sk: '#f0c4a4', h: '#ececec', cl: '#4a5aa0', cl2: '#3a3050', a: '#c83a30', m: '#c0c8d0', wd: '#7a5a3a', g: '#80d0ff', e: '#2a2a6a' }, o: { size: 'tiny', hat: 'gnome', beard: 'short', outfit: 'tunic', defaultWeapon: 'wand' } },
    alienigena: { p: { sk: '#9ac0a0', cl: '#5a4a8a', cl2: '#3a3a5a', a: '#c0c0c0', m: '#b0b8c8', g: '#70ff90', e: '#101010' }, o: { size: 'medium', head: 'alien', outfit: 'tunic', defaultWeapon: 'gun' } },
    robot: { p: { sk: '#a0a8b0', m: '#8a929c', cl: '#6a7280', cl2: '#4a5058', a: '#ffcc33', g: '#40e0ff', e: '#40e0ff', wd: '#5a5a5a' }, o: { size: 'medium', head: 'robot', outfit: 'armor' } },
    draconido: { p: { sk: '#4a8a6a', cl: '#8a3a2a', cl2: '#4a3a2a', a: '#e8e0c0', m: '#b8b8c0', wd: '#5a3a1a', e: '#ffcc00' }, o: { size: 'medium', head: 'lizard', horns: 'small', outfit: 'tunic', tail: 'lizard', tailKey: 'sk' } },
    // v1.9.2: tres razas nuevas
    goliat: { p: { sk: '#8fa0b4', h: '#2a2a34', cl: '#6a4a32', cl2: '#3e3226', c: '#d8c8a0', a: '#c9a24a', m: '#c0c8d0', wd: '#5a3a1a', e: '#101820' }, o: { size: 'large', outfit: 'loincloth', hair: 'short', brows: true, defaultWeapon: 'hammer' } },
    infernal: { p: { sk: '#c0483a', h: '#1e141a', cl: '#4a1e3e', cl2: '#2a1024', a: '#e8b040', m: '#c0c8d0', wd: '#4a2a1a', e: '#ffd040', g: '#ff8030' }, o: { size: 'medium', hair: 'long', horns: 'curved', tail: 'demon', outfit: 'robe', lower: 'robe', defaultWeapon: 'staff' } },
    angel: { p: { sk: '#f4dcc4', h: '#f0cc78', cl: '#f4efe2', cl2: '#cbc2ae', a: '#d4a42c', wg: '#ffffff', m: '#d8dce4', wd: '#8a6a3a', e: '#3a6ab8', g: '#ffe680' }, o: { size: 'medium', hair: 'long', wings: 'feather', hat: 'halo', outfit: 'robe', lower: 'robe', defaultWeapon: 'sword' } },
  };

  // ============================================================
  // Elección automática para enemigos nuevos del editor
  // ============================================================

  function planFor(e) {
    const fam = e.family || [];
    const tags = e.tags || [];
    const has = (f) => fam.includes(f);
    if (has('dragon')) return { plan: 'dragon', o: {} };
    if (has('demon')) return { plan: 'humanoid', o: { size: tags.includes('small') ? 'tiny' : 'large', horns: 'curved', wings: 'bat', tail: 'demon', outfit: 'none', eyes: 'glow', mouth: 'fangs' } };
    if (has('construct')) return { plan: 'golem', o: {} };
    if (has('elemental')) return { plan: 'elemental', o: { kind: tags.includes('ice') ? 'ice' : tags.includes('fire') ? 'fire' : 'arcane' } };
    if (has('plant')) return { plan: 'tree', o: {} };
    if (has('spirit') || tags.includes('ethereal')) return { plan: 'ghost', o: {} };
    if (has('undead')) return has('humanoid') || !has('beast')
      ? { plan: 'humanoid', o: { size: 'medium', body: 'skeleton', head: 'skull', weapon: 'sword' } }
      : { plan: 'beast', o: { eyes: 'glow' } };
    if (has('marine') || has('aquatic')) return has('humanoid') ? { plan: 'humanoid', o: { lower: 'fishtail', hair: 'long', outfit: 'shell', weapon: 'trident' } } : { plan: 'fish', o: {} };
    if (has('insect')) return { plan: tags.includes('poison') ? 'spider' : 'scorpion', o: {} };
    if (has('humanoid')) {
      if (has('arcane')) return { plan: 'humanoid', o: { hat: 'hood', lower: 'robe', outfit: 'robe', weapon: 'staff', eyes: 'glow' } };
      if (has('giant')) return { plan: 'humanoid', o: { size: 'huge', outfit: 'loincloth', weapon: 'club' } };
      if (tags.includes('small')) return { plan: 'humanoid', o: { size: 'small', ears: 'goblin', outfit: 'rags', weapon: 'dagger' } };
      return { plan: 'humanoid', o: { size: 'medium', outfit: 'tunic', hair: 'short', weapon: 'sword' } };
    }
    if (has('giant')) return { plan: 'humanoid', o: { size: 'huge', outfit: 'loincloth', weapon: 'club' } };
    if (has('arcane')) return { plan: 'eye', o: {} };
    if (has('flying')) return { plan: 'bird', o: { wing: 'spread' } };
    return { plan: 'beast', o: {} };
  }

  function autoPalette(e) {
    const tags = e.tags || [];
    if (tags.includes('fire')) return { b: '#d04a1a', c: '#f0a030', a: '#ffd060', sk: '#c84a20', cl: '#5a1a0a', e: '#ffee00', f: '#ffc040' };
    if (tags.includes('ice')) return { b: '#6aa8d8', c: '#d0ecff', a: '#ffffff', sk: '#a8d0ec', cl: '#3a6a9a', e: '#1a3a6a', f: '#ffffff' };
    if (tags.includes('poison')) return { b: '#5a8a2a', c: '#b0d040', a: '#d0e070', sk: '#7aa04a', cl: '#3a4a2a', e: '#ff3030' };
    if ((e.family || []).includes('undead')) return { b: '#8a8a7a', c: '#b0b0a0', t: '#e0d8c0', sk: '#8a9a80', cl: '#3a3442', e: '#60c0ff' };
    const h = hashStr(e.id || e.name) % 360;
    return {
      b: hsl(h, 32, 42), c: hsl((h + 20) % 360, 30, 64), a: '#d8c070', e: '#ffdd33',
      sk: hsl((h + 25) % 360, 30, 58), cl: hsl((h + 180) % 360, 30, 36), h: hsl(h, 25, 25),
    };
  }

  /** Forma + colores finales de un enemigo (especie, o automática, más lo cambiado en el editor). */
  function specFor(enemy) {
    const e = enemy || {};
    const ov = (e.sprite && typeof e.sprite === 'object') ? e.sprite : {};
    let base = SPECIES[ov.t] || SPECIES[e.id] || (e.species && SPECIES[e.species]);
    if (!base) {
      const pf = planFor(e);
      base = { plan: pf.plan, o: pf.o, p: autoPalette(e) };
    }
    if (ov.t && !SPECIES[ov.t] && PLANS[ov.t]) {
      const pf = planFor(e);
      base = { plan: ov.t, o: ov.t === pf.plan ? pf.o : {}, p: { ...autoPalette(e), ...(base.p || {}) } };
    }
    const p = { ...(base.p || {}) };
    const humanoid = base.plan === 'humanoid';
    if (ov.b) p[humanoid ? 'sk' : 'b'] = ov.b;
    if (ov.c) p[humanoid ? 'cl' : 'c'] = ov.c;
    if (ov.a) p.a = ov.a;
    if (ov.e) p.e = ov.e;
    return { plan: base.plan, s: base.s || 1, o: base.o || {}, p };
  }

  // ============================================================
  // Render y caché
  // ============================================================

  const cache = new Map();

  function renderCols(spec) {
    const g = new Array(N * N).fill(null);
    const P = makePen(g, spec.s || 1, spec.dx || 0);
    (PLANS[spec.plan] || planBeast)(P, spec.o || {});
    return finalize(g, resolvePalette(spec.p || {}));
  }

  function colsToSvg(cols) {
    let rects = '';
    for (let y = 0; y < N; y++) {
      let x = 0;
      while (x < N) {
        const c = cols[y * N + x];
        if (!c) { x++; continue; }
        let x2 = x + 1;
        while (x2 < N && cols[y * N + x2] === c) x2++;
        rects += `<rect x="${x}" y="${y}" width="${x2 - x}" height="1" fill="${c}"/>`;
        x = x2;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges">${rects}</svg>`;
  }

  function colsToUrl(cols) {
    try {
      if (typeof document !== 'undefined' && document.createElement) {
        const cv = document.createElement('canvas');
        cv.width = N; cv.height = N;
        const ctx = cv.getContext && cv.getContext('2d');
        if (ctx) {
          const img = ctx.createImageData(N, N);
          for (let i = 0; i < N * N; i++) {
            const c = cols[i];
            if (!c) continue;
            const [r, g, b] = rgb(c);
            img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
          }
          ctx.putImageData(img, 0, 0);
          return cv.toDataURL('image/png');
        }
      }
    } catch (err) { /* sin canvas: SVG */ }
    return `data:image/svg+xml;utf8,${encodeURIComponent(colsToSvg(cols))}`;
  }

  function urlForSpec(spec) {
    const key = JSON.stringify(spec);
    if (cache.has(key)) return cache.get(key);
    const url = colsToUrl(renderCols(spec));
    cache.set(key, url);
    return url;
  }

  function resolve(enemyOrId) {
    if (!enemyOrId) return null;
    if (typeof enemyOrId === 'string') return (A.Data && A.Data.getById && A.Data.getById('enemies', enemyOrId)) || { id: enemyOrId };
    return enemyOrId;
  }

  function imgTag(url, size, cls) {
    const c = ['px-sprite'];
    if (cls) c.push(cls);
    return `<span class="${c.join(' ')}" style="--px-size:${size}px"><img src="${url}" alt="" draggable="false"></span>`;
  }

  // ---------- API ----------

  function dataUrl(enemyOrId) {
    const e = resolve(enemyOrId);
    return e ? urlForSpec(specFor(e)) : '';
  }

  function html(enemyOrId, opts = {}) {
    const e = resolve(enemyOrId);
    if (!e) return '';
    const cls = [opts.flip ? 'is-flipped' : '', opts.cls || ''].filter(Boolean).join(' ');
    return imgTag(urlForSpec(specFor(e)), opts.size || 48, cls);
  }

  function svg(enemyOrId) {
    const e = resolve(enemyOrId);
    return e ? colsToSvg(renderCols(specFor(e))) : '';
  }

  function petHtml(pet, opts = {}) {
    if (!pet) return '';
    const enemy = (A.Data && A.Data.getById && A.Data.getById('enemies', pet.species)) || { id: pet.species, family: pet.family, tags: pet.tags, name: pet.name };
    return html(enemy, { flip: true, ...opts });
  }

  function heroSpec(raceId, weaponKind) {
    const h = HEROES[raceId] || HEROES.humano;
    const o = { ...h.o, weaponSide: 'right' };
    o.weapon = weaponKind || h.o.defaultWeapon || 'sword';
    return { plan: 'humanoid', s: 1, o, p: h.p };
  }

  function heroHtml(raceId, opts = {}) {
    return imgTag(urlForSpec(heroSpec(raceId, opts.weapon)), opts.size || 48, ['px-hero', opts.cls || ''].filter(Boolean).join(' '));
  }

  /** Tipo de arma a dibujar según el arma equipada (por nombre/id). */
  function weaponKindOf(w) {
    if (!w) return 'none';
    const t = `${w.id || ''} ${w.name || ''}`.toLowerCase();
    if (/daga|cuchill|puñal|colmillo/.test(t)) return 'dagger';
    if (/alabarda/.test(t)) return 'greataxe';
    if (/hacha/.test(t)) return 'axe';
    if (/martillo|maza|mjol|mjöl/.test(t)) return 'hammer';
    if (/garrote|porra/.test(t)) return 'club';
    if (/varita/.test(t)) return 'wand';
    if (/bast[oó]n|b[aá]culo|cetro|vara/.test(t)) return 'staff';
    if (/arco|ballesta/.test(t)) return 'bow';
    if (/lanza|tridente|pica/.test(t)) return 'spear';
    if (/guada[nñ]a/.test(t)) return 'scythe';
    if (/l[aá]ser|blaster|pistola/.test(t)) return 'gun';
    if (/mandoble|matamuertos|excalibur/.test(t)) return 'bigsword';
    return 'sword';
  }

  function heroFor(player, opts = {}) {
    if (!player) return '';
    const w = player.equipment && player.equipment.weapon && A.Data ? A.Data.getById('weapons', player.equipment.weapon) : null;
    return heroHtml(player.raceId, { ...opts, weapon: weaponKindOf(w) });
  }

  function clearCache() { cache.clear(); }

  // ---------- Para el editor ----------
  const PLAN_LABELS = {
    beast: 'Bestia', dragon: 'Dragón', bird: 'Ave', owl: 'Búho', bat: 'Murciélago', spider: 'Araña', scorpion: 'Escorpión',
    crab: 'Cangrejo', serpent: 'Serpiente', slime: 'Limo', ghost: 'Fantasma', elemental: 'Elemental', golem: 'Gólem',
    tree: 'Árbol', eye: 'Ojo flotante', tentacle: 'Pulpo', fish: 'Pez', turtle: 'Tortuga', humanoid: 'Humanoide',
  };

  /** Opciones del selector "Forma": cuerpos genéricos + copiar la forma de otra criatura. */
  function shapeOptions() {
    const names = {};
    for (const e of (A.Data && A.Data.enemies) || []) names[e.id] = e.name;
    const generic = Object.keys(PLAN_LABELS).map((k) => ({ value: k, label: `Cuerpo: ${PLAN_LABELS[k]}` }));
    const copies = Object.keys(SPECIES).map((id) => ({ value: id, label: `Igual que: ${names[id] || id}` }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
    return generic.concat(copies);
  }

  function shapeLabel(enemy) {
    const e = enemy || {};
    const ov = e.sprite || {};
    if (ov.t && SPECIES[ov.t]) return `igual que ${((A.Data && A.Data.getById && A.Data.getById('enemies', ov.t)) || {}).name || ov.t}`;
    if (ov.t && PLANS[ov.t]) return PLAN_LABELS[ov.t];
    if (SPECIES[e.id]) return 'dibujo propio';
    return PLAN_LABELS[planFor(e).plan];
  }

  /** Colores efectivos (para mostrarlos en el editor). */
  function colorsFor(enemy) {
    const spec = specFor(enemy || {});
    const pal = resolvePalette(spec.p);
    const humanoid = spec.plan === 'humanoid';
    return { t: spec.plan, b: humanoid ? pal.sk : pal.b, c: humanoid ? pal.cl : pal.c, e: pal.e, a: pal.a };
  }

  /** Herramientas del motor para otros dibujos (ítems). */
  function renderCustom(key, draw, palette, s) {
    const k = `custom:${key}`;
    if (cache.has(k)) return cache.get(k);
    const g = new Array(N * N).fill(null);
    draw(makePen(g, s || 1));
    const url = colsToUrl(finalize(g, resolvePalette(palette || {})));
    cache.set(k, url);
    return url;
  }

  A.Sprites = {
    html, svg, dataUrl, petHtml, heroHtml, heroFor, weaponKindOf, clearCache,
    colorsFor, shapeOptions, shapeLabel, specFor,
    SPECIES, HEROES: Object.keys(HEROES), PLANS: Object.keys(PLANS), PLAN_LABELS,
    _kit: { N, bez, inE, shade, mix, hashStr, hsl, renderCustom, imgTag },
  };
})(window.Aventurs);
