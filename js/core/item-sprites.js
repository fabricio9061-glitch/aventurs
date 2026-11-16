/* ============================================================
   Aventurs — Sprites de ítems 32×32 (v1.9.0)
   Mismo motor que las criaturas (A.Sprites): cada ítem se dibuja
   con una forma (espada, poción, lingote, gema, hongo…) y colores
   que salen de su material o elemento. Los ítems nuevos del editor
   también tienen dibujo: se elige la forma por tipo y palabras del
   nombre ("hacha", "poción", "hongo", "rubí", "hierro"…).

   API:
     A.ItemSprites.html(itemOId, { size })  -> <span class="px-sprite"><img></span>
     A.ItemSprites.dataUrl(itemOId)
     A.ItemSprites.shapeOf(item)            -> { shape, p, o } (para depurar)
   ============================================================ */

(function (A) {
  'use strict';

  if (!A.Sprites || !A.Sprites._kit) return;
  const { bez, renderCustom, imgTag } = A.Sprites._kit;

  // ============================================================
  // Colores de materiales y elementos
  // ============================================================

  const MAT = {
    hierro: { m: '#8a929c', c: '#c4ccd4' },
    acero: { m: '#aab6c0', c: '#e2eaf0' },
    plata: { m: '#c8d0da', c: '#f4f8fc' },
    oro: { m: '#e0b030', c: '#fff0a0' },
    cobre: { m: '#c87a3a', c: '#f0b080' },
    laton: { m: '#c8a040', c: '#f0d890' },
    oxido: { m: '#9a5a2a', c: '#c88a50' },
    obsidiana: { m: '#2e2638', c: '#8a6ac0' },
    hueso: { m: '#e2d8be', c: '#fff8e6' },
    dragon: { m: '#b03020', c: '#f08a60' },
    runa: { m: '#7a8aa0', c: '#c0d0e8' },
  };

  const ELEM = {
    fuego: { g: '#ff7a20', e: '#ff5a20', c: '#ffd060' },
    hielo: { g: '#9ae0ff', e: '#5ab0f0', c: '#e0f6ff' },
    arcano: { g: '#c090ff', e: '#8a50e0', c: '#e8d8ff' },
    rayo: { g: '#fff070', e: '#e0c020', c: '#fffbd0' },
    sombra: { g: '#9a6ad0', e: '#4a2a6a', c: '#c8a8f0' },
    naturaleza: { g: '#8af070', e: '#3a9a3a', c: '#c8f8b0' },
    sagrado: { g: '#fff2a0', e: '#e0c040', c: '#ffffff' },
    abisal: { g: '#40e0d0', e: '#1a6a7a', c: '#a0f0e8' },
  };

  function matOf(t) {
    if (/obsidiana/.test(t)) return MAT.obsidiana;
    if (/oro|dorad|excalibur/.test(t)) return MAT.oro;
    if (/plata/.test(t)) return MAT.plata;
    if (/cobre/.test(t)) return MAT.cobre;
    if (/lat[oó]n/.test(t)) return MAT.laton;
    if (/oxidad/.test(t)) return MAT.oxido;
    if (/hueso|colmillo/.test(t)) return MAT.hueso;
    if (/drag[oó]n/.test(t)) return MAT.dragon;
    if (/acero|r[uú]nic|mandoble|katana|matamuertos/.test(t)) return MAT.acero;
    return MAT.hierro;
  }

  function elemOf(t) {
    if (/fuego|[ií]gne|llama|brasa|lava|fénix|fenix/.test(t)) return ELEM.fuego;
    if (/hielo|helad|escarcha/.test(t)) return ELEM.hielo;
    if (/tormenta|rayo|chispa/.test(t)) return ELEM.rayo;
    if (/abisal|kraken/.test(t)) return ELEM.abisal;
    if (/sombra|oscur/.test(t)) return ELEM.sombra;
    if (/curaci|vida|hierba/.test(t)) return ELEM.naturaleza;
    if (/sagrad|matamuertos|[aá]ngel|estelar/.test(t)) return ELEM.sagrado;
    if (/arcan|man[aá]|r[uú]nic|m[aá]gic|estrell/.test(t)) return ELEM.arcano;
    return null;
  }

  // ============================================================
  // Formas: armas
  // ============================================================

  function sword(P, o) {
    const L = o.len || 1;
    const w = o.w || 1.45;
    const x0 = o.x0 || 11.5, y0 = o.y0 || 20.5;
    const x1 = x0 + 15.5 * L, y1 = y0 - 15.5 * L;
    if (o.curve) P.line(bez([x0, y0], [x0 + 7 * L, y0 - 6 * L], [x1 - 3 * L, y1 + 4 * L], [x1, y1], 12), w, 0.4, 'm');
    else P.line([[x0, y0], [x1 - 1.6, y1 + 1.6], [x1, y1]], w, 0.35, 'm');
    if (!o.curve) P.line([[x0 + 1, y0 - 1.5], [x1 - 2.4, y1 + 1.2]], 0.35, 0.3, 'c');
    if (o.runes) for (let t = 0.22; t < 0.85; t += 0.16) P.put(x0 + (x1 - x0) * t - 0.4, y0 + (y1 - y0) * t + 0.4, 'g');
    if (o.round) P.dot(x0 - 0.3, y0 + 0.3, 1.9, 'a');
    else {
      const gw = o.guard || 4;
      P.line([[x0 - gw * 0.72, y0 - gw * 0.72], [x0 + gw * 0.72, y0 + gw * 0.72]], 1.25, 1.25, 'a');
    }
    const gl = o.grip || 4.5;
    P.line([[x0 - 0.8, y0 + 0.8], [x0 - gl, y0 + gl]], 1.15, 1.15, o.gripKey || 'wd');
    for (let i = 1.4; i < gl; i += 1.5) P.put(x0 - i, y0 + i - 0.8, o.gripKey === 'k' ? 'hl' : 'wd~');
    P.dot(x0 - gl - 0.9, y0 + gl + 0.9, 1.6, 'a');
    if (o.gem) P.put(x0 - 0.5, y0 + 0.5, 'g');
  }

  function axe(P, o) {
    P.line([[5.5, 27.5], [23, 10]], 1.25, 1.1, 'wd');
    for (let i = 0; i < 3; i++) P.put(8 + i * 1.6, 24.4 - i * 1.6, 'wd~');
    if (o.double) P.poly([[20, 8], [15.5, 4], [11, 7.5], [10.5, 12], [14, 14.5], [18, 12]], 'm');
    P.poly([[19.5, 8.5], [24, 3.5], [29, 8], [29.5, 13], [26.5, 17.5], [22.5, 13]], 'm');
    P.line([[24.4, 4], [28.7, 8.4], [29.1, 12.8], [26.4, 16.8]], 0.45, 0.45, 'c');
    if (o.runes) { P.put(25, 10, 'g'); P.put(26.5, 12, 'g'); P.put(24, 12.5, 'g'); }
    P.line([[21, 7.5], [24, 10.5]], 0.6, 0.6, 'a');
  }

  function halberd(P) {
    P.line([[3.5, 29], [24.5, 8]], 1.0, 0.95, 'wd');
    P.poly([[23.5, 8.5], [27, 2.5], [29.5, 3], [25.5, 9.5]], 'm');
    P.poly([[20, 9], [17, 4.5], [21.5, 3], [24, 7.5]], 'm');
    P.poly([[24, 11.5], [27.5, 15.5], [25, 16]], 'm');
    P.dot(23.6, 9.4, 1.1, 'a');
  }

  function club(P, o) {
    P.line([[6, 27], [24, 9]], 1.1, 3.3, 'wd', 2.0);
    for (const [x, y] of [[19, 11], [22, 12.5], [21, 8], [16, 15]]) P.put(x, y, o.spikes ? 'm' : 'wd~');
  }

  function mace(P) {
    P.line([[6.5, 26.5], [19, 14]], 1.2, 1.2, 'wd');
    P.dot(6, 27, 1.5, 'a');
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      P.poly([[22 + Math.cos(a - 0.35) * 3.6, 11 + Math.sin(a - 0.35) * 3.6], [22 + Math.cos(a) * 6.4, 11 + Math.sin(a) * 6.4], [22 + Math.cos(a + 0.35) * 3.6, 11 + Math.sin(a + 0.35) * 3.6]], 'm');
    }
    P.dot(22, 11, 4.1, 'm');
    P.dot(21, 10, 1.2, 'c');
  }

  function hammer(P, o) {
    const big = o.big;
    if (big) P.line([[9, 24], [18, 15]], 1.1, 1.1, 'wd');
    else P.line([[5.5, 27.5], [19, 14]], 1.2, 1.2, 'wd');
    if (big) P.line([[9, 24], [6.5, 27.5], [4.5, 27], [6, 25]], 0.5, 0.5, 'a');
    const cx = big ? 21 : 21.5, cy = big ? 12 : 11.5;
    const u = [0.707, 0.707], v = [0.707, -0.707];
    const L = big ? 7 : 5.5, W = big ? 4.4 : 3.2;
    const c = (a, b) => [cx + u[0] * a + v[0] * b, cy + u[1] * a + v[1] * b];
    P.poly([c(L, W), c(L, -W), c(-L, -W), c(-L, W)], 'm');
    P.line([c(L - 1, W - 0.8), c(-L + 1, W - 0.8)], 0.4, 0.4, 'c');
    if (o.runes) for (const [a, b] of [[-3, 0], [0, 0], [3, 0]]) { const p = c(a, b); P.put(p[0], p[1], 'g'); }
  }

  function staff(P, o) {
    P.line([[4.5, 29], [23.5, 10]], 1.15, 1.0, 'wd');
    if (o.runes) for (let t = 0.2; t < 0.8; t += 0.2) P.put(4.5 + 19 * t, 29 - 19 * t, 'g');
    if (o.head === 'crystal') {
      P.poly([[21.5, 11], [24, 2.5], [29, 6], [26, 12.5]], 'c');
      P.line([[23.5, 4.5], [25.5, 10]], 0.4, 0.4, 'hl');
    } else if (o.head === 'flame') {
      P.poly([[21, 11], [22, 6], [24, 7.5], [25, 2], [27, 6], [29, 5], [27.5, 10], [24.5, 13]], 'f');
      P.poly([[23, 10.5], [24.5, 7], [26, 9], [25, 11.5]], 'g');
    } else {
      P.line(bez([22, 11.5], [20, 7], [23, 3], [26, 3], 8), 0.6, 0.5, 'wd');
      P.line(bez([22, 11.5], [27, 13], [30, 9], [29.5, 6], 8), 0.6, 0.5, 'wd');
      P.dot(25.6, 7.2, 3.1, 'g');
      P.put(24.5, 5.8, 'hl'); P.put(25.5, 5.8, 'hl');
    }
  }

  function wand(P) {
    P.line([[7.5, 25.5], [21.5, 11.5]], 1.1, 0.7, 'wd');
    P.dot(7.2, 25.8, 1.1, 'a');
    for (const [dx, dy] of [[0, 0], [-2, 0], [2, 0], [0, -2], [0, 2]]) P.put(23.5 + dx, 9.5 + dy, 'g');
    P.put(25, 7, 'hl'); P.put(21, 7.5, 'g'); P.put(26.5, 11.5, 'g');
  }

  function scepter(P) {
    P.line([[6.5, 26.5], [19, 14]], 1.2, 1.05, 'a');
    for (const t of [0.3, 0.6]) P.dot(6.5 + 12.5 * t, 26.5 - 12.5 * t, 1.4, 'a~');
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 4 + (i - 1.5) * 0.7;
      P.line([[21, 12], [21 + Math.cos(a) * 6, 12 + Math.sin(a) * 6]], 0.7, 0.4, 'a');
    }
    P.dot(22, 11, 3.2, 'g');
    P.put(21, 10, 'hl');
  }

  function bow(P, o) {
    P.line([[24, 4], [5.5, 27]], 0.35, 0.35, 'hl');
    P.line(bez([24, 4], [31, 14], [18, 32], [5.5, 27], 18), 1.0, 1.0, 'wd', 1.7);
    P.dot(23, 22.5, 1.4, 'a');
    if (o.feathers) { P.line([[24, 4], [27, 2], [28, 4.5]], 0.6, 0.4, 'c'); P.line([[5.5, 27], [3, 29.5], [5.5, 30]], 0.6, 0.4, 'c'); }
    if (o.leaf) { P.poly([[24, 4], [27.5, 1], [26.5, 5]], 'c'); P.poly([[5.5, 27], [2, 30.5], [6.5, 29.5]], 'c'); }
  }

  function crossbow(P) {
    P.line([[5, 27], [21, 11]], 1.3, 1.1, 'wd');
    P.line(bez([14, 6], [21, 9], [24, 13], [27, 19], 10), 1.0, 1.0, 'm');
    P.line([[14, 6], [19.5, 14.5], [27, 19]], 0.3, 0.3, 'hl');
    P.line([[11, 21], [26.5, 5.5]], 0.45, 0.45, 'm');
    P.poly([[26, 4], [29, 3], [28, 6]], 'm');
    P.rect(8.5, 22.5, 3, 2, 'a');
  }

  function spear(P, o) {
    P.line([[3.5, 28.5], [23, 9]], 0.95, 0.9, o.shaftKey || 'wd');
    P.poly([[21.5, 10.5], [23.5, 5.5], [29.5, 2.5], [26.5, 8.5]], o.tipKey || 'm');
    P.line([[23.5, 8.5], [28.5, 3.5]], 0.35, 0.35, 'c');
    P.dot(22, 10, 1.2, 'a');
  }

  // ============================================================
  // Formas: armaduras (de frente)
  // ============================================================

  function armor(P, o) {
    const kind = o.kind || 'tunic';
    if (kind === 'robe') {
      P.ell(16, 7, 6, 5, 'b~');
      P.poly([[10.5, 6], [21.5, 6], [25, 10], [28, 29.5], [4, 29.5], [7, 10]], 'b');
      P.poly([[13, 6], [19, 6], [16, 12]], 'b~');
      P.rect(4.5, 27.6, 23, 1.9, 'a');
      P.line([[16, 12], [16, 27.5]], 0.5, 0.5, 'a');
      if (o.stars) for (const [x, y] of [[9, 16], [21, 13], [12, 23], [22, 21], [18, 26], [8, 25]]) P.put(x, y, 'g');
      return;
    }
    const sleeves = kind !== 'breastplate' && kind !== 'plate';
    if (sleeves) P.poly([[9, 5.5], [23, 5.5], [27.5, 10], [26, 16], [23, 15], [23, 28], [9, 28], [9, 15], [6, 16], [4.5, 10]], 'b');
    else P.poly([[8.5, 6.5], [23.5, 6.5], [25, 12], [23.5, 25], [16, 28.5], [8.5, 25], [7, 12]], 'b');
    P.poly([[13, 5], [19, 5], [16, 9.5]], null);
    if (kind === 'plate') {
      P.ell(6.6, 9.5, 4, 3.4, 'b~'); P.ell(25.4, 9.5, 4, 3.4, 'b~');
      for (const y of [22, 24.5]) P.line([[10, y], [22, y]], 0.4, 0.4, 'b~');
    }
    if (kind === 'breastplate' || kind === 'plate') {
      P.line([[16, 9.5], [16, 24]], 0.45, 0.45, 'c');
      P.line([[10, 9], [10.5, 18]], 0.35, 0.35, 'c');
      if (kind === 'breastplate') { P.line([[9.5, 6.5], [7.5, 4]], 0.7, 0.7, 'wd'); P.line([[22.5, 6.5], [24.5, 4]], 0.7, 0.7, 'wd'); }
    }
    if (kind === 'tunic' || kind === 'leather' || kind === 'studded' || kind === 'brigandine' || kind === 'chain' || kind === 'tabard') {
      P.rect(9, 20.5, 14, 2, 'a');
      P.put(15.5, 21, 'c');
    }
    if (kind === 'leather' || kind === 'studded') for (let y = 11; y < 20; y += 2) { P.put(11, y, 'b~'); P.put(20, y, 'b~'); }
    if (kind === 'studded') for (let y = 11; y < 20; y += 3) for (let x = 12; x < 21; x += 3) P.put(x, y, 'm');
    if (kind === 'brigandine') for (let y = 10; y < 20; y += 2.5) for (let x = 11; x < 22; x += 2.5) P.put(x, y, 'm');
    if (kind === 'chain') P.recolor(['b'], 'b~', (x, y) => (Math.floor(x) + Math.floor(y)) % 2 === 0 && y > 6);
    if (kind === 'tabard') {
      P.poly([[12.5, 9], [19.5, 9], [19.5, 27.5], [16, 29.5], [12.5, 27.5]], 'c');
      P.poly([[16, 13], [18, 16], [16, 19], [14, 16]], 'g');
    }
    if (o.runes) for (const [x, y] of [[12, 12], [20, 12], [13, 19], [19, 19], [16, 15]]) P.put(x, y, 'g');
    if (o.scales) P.recolor(['b'], 'c', (x, y) => ((Math.floor(y) % 3 === 0) && (Math.floor(x) + Math.floor(y / 3)) % 3 === 0));
    if (o.sheen) P.line([[11, 10], [13, 20]], 0.4, 0.4, 'g');
  }

  // ============================================================
  // Formas: consumibles
  // ============================================================

  function potion(P, o) {
    const shape = o.shape || 'round';
    if (shape === 'cup') {
      P.line([[22.5, 15], [27, 16], [26.5, 21], [22.5, 22]], 0.9, 0.9, 'b');
      P.poly([[7, 13], [24, 13], [22.5, 25], [8.5, 25]], 'b');
      P.ell(15.5, 13.5, 8.5, 2, 'e');
      P.rect(6, 25.5, 19, 1.8, 'b~');
      for (const x of [12, 16, 20]) P.line([[x, 10], [x - 1, 7], [x + 0.5, 4]], 0.4, 0.4, 'hl');
      return;
    }
    const big = shape === 'round', tall = shape === 'tall';
    const cy = big ? 20 : 21.5, r = big ? 8.6 : 6.6;
    // cuello y corcho
    P.rect(13.5, tall ? 6 : (big ? 7 : 10), 5, 6, 'gl');
    P.rect(12.8, tall ? 3 : (big ? 4 : 7), 6.4, 3.4, 'wd');
    if (tall) {
      P.poly([[11, 11], [21, 11], [22.5, 28], [9.5, 28]], 'gl');
      P.recolor(['gl'], 'b', (x, y) => y > 16);
    } else {
      P.ell(16, cy, r, r, 'gl');
      P.recolor(['gl'], 'b', (x, y) => y > cy - r * 0.25);
    }
    P.recolor(['b'], 'c', (x, y) => y < (tall ? 17.6 : cy - r * 0.25 + 1.4));
    P.line(tall ? [[12.5, 13], [12, 24]] : [[16 - r * 0.6, cy - r * 0.35], [16 - r * 0.72, cy + r * 0.25]], 0.5, 0.5, 'hl');
    for (const [x, y] of tall ? [[17, 21], [15, 24]] : [[18, cy + 2], [14.5, cy + r * 0.55]]) P.put(x, y, 'c');
  }

  function meat(P, o) {
    const kind = o.kind || 'steak';
    if (kind === 'drumstick') {
      P.line([[17, 17], [26, 26]], 1.2, 1.2, 't');
      P.dot(27, 25, 1.4, 't'); P.dot(25, 27.5, 1.4, 't');
      P.ell(12, 12, 8, 6.5, 'b');
      P.recolor(['b'], 'c', (x, y) => y < 9 && x < 13);
      return;
    }
    if (kind === 'ham') {
      P.ell(14, 15, 11, 9, 'b');
      P.ell(12, 13, 6, 4.5, 'c');
      P.line([[22, 21], [28.5, 27.5]], 1.6, 1.6, 't');
      P.dot(29, 27, 1.6, 't'); P.dot(27, 29.5, 1.6, 't');
      return;
    }
    if (kind === 'jerky') {
      for (const [x, y] of [[7, 9], [11, 13], [15, 17]]) P.poly([[x, y + 3], [x + 12, y - 4], [x + 14, y - 1], [x + 2, y + 6]], 'b');
      for (const [x, y] of [[10, 9], [14, 13], [18, 17]]) P.put(x, y, 'c');
      return;
    }
    if (kind === 'fish') {
      P.poly([[22, 16], [29.5, 9.5], [28, 16], [29.5, 23]], 'b~');
      P.ell(14, 16, 11, 6, 'b');
      P.recolor(['b'], 'c', (x, y) => y > 17.5);
      P.poly([[13, 10.5], [17, 6.5], [19, 10.5]], 'b~');
      P.put(7, 14, 'k'); P.put(7, 13.4, 'hl');
      P.line([[10, 13], [10, 18]], 0.35, 0.35, 'o');
      if (o.fillet) P.recolor(['b', 'c'], 'r', (x, y) => x > 11 && x < 22 && ((Math.floor(x) + Math.floor(y)) % 4 === 0));
      return;
    }
    // filete
    P.poly([[5, 15], [9, 7], [18, 5], [26, 8], [28, 16], [24, 24], [14, 27], [7, 23]], 'b');
    P.line(bez([9, 10], [14, 13], [19, 9], [24, 14], 10), 0.5, 0.5, 'c');
    P.line(bez([8, 18], [13, 20], [18, 16], [23, 20], 10), 0.5, 0.5, 'c');
    if (o.bone) { P.dot(19, 17, 2.2, 't'); P.dot(19, 17, 0.9, 'c~'); }
    if (o.salt) for (const [x, y] of [[10, 12], [15, 9], [21, 12], [12, 20], [19, 22], [24, 17]]) P.put(x, y, 'hl');
    if (o.scales) P.recolor(['b'], 'b~', (x, y) => (Math.floor(x) + Math.floor(y) * 2) % 5 === 0);
  }

  function bread(P) {
    P.ell(16, 18, 12.5, 7.5, 'b');
    P.recolor(['b'], 'c', (x, y) => y < 14);
    for (const x of [10, 15, 20]) P.line([[x, 13], [x + 3, 16]], 0.45, 0.45, 'b~');
  }

  function cheese(P) {
    P.poly([[4, 22], [27, 9], [28.5, 22]], 'c');
    P.poly([[4, 22], [28.5, 22], [28.5, 27], [4, 27]], 'b');
    for (const [x, y, r] of [[12, 24.5, 1.4], [20, 24, 1.6], [24, 18, 1.2], [18, 17, 1]]) P.ell(x, y, r, r * 0.8, 'b~');
  }

  function berries(P, o) {
    P.line([[16, 6], [17, 11]], 0.45, 0.45, 'wd');
    P.poly([[16, 7], [10, 4], [13, 9]], 'a'); P.poly([[17, 7], [23, 5], [20, 10]], 'a');
    for (const [x, y] of [[13, 14], [19, 14], [16, 18], [11, 20], [21, 20], [16, 24], [13, 26], [19, 26]]) {
      P.dot(x, y, 3, 'b');
      P.put(x - 1, y - 1, 'hl');
    }
  }

  function cactus(P) {
    P.ell(16, 18, 7, 11, 'b');
    P.ell(16, 18, 4, 9, 'c');
    for (const [x, y] of [[9, 12], [23, 12], [9, 20], [23, 20], [12, 8], [20, 8], [16, 6]]) P.put(x, y, 't');
    P.ell(16, 28, 6, 1.6, 'wd');
  }

  function goo(P, o) {
    if (o.cube) {
      P.poly([[8, 12], [18, 7], [26, 11], [26, 23], [16, 28], [8, 24]], 'b');
      P.poly([[8, 12], [18, 7], [26, 11], [16, 15.5]], 'c');
      P.line([[16, 15.5], [16, 27.5]], 0.4, 0.4, 'b~');
      P.put(11, 13, 'hl'); P.put(13, 12, 'hl');
      return;
    }
    P.ell(16, 20, 11, 8, 'b');
    P.ell(16, 15, 7, 6, 'b');
    for (const [x, r] of [[8, 1.6], [24, 1.4], [13, 1.2]]) P.ell(x, 28, r, 1.6, 'b');
    P.line([[10.5, 15], [12.5, 11]], 0.5, 0.5, 'hl');
    if (o.core) P.dot(16, 19, 3.2, 'g');
    P.put(19, 20, 'c'); P.put(14, 23, 'c');
  }

  // ============================================================
  // Formas: objetos varios
  // ============================================================

  function scroll(P) {
    P.rect(8, 7, 16, 18, 'b');
    P.ell(16, 7, 9.5, 2.6, 'c'); P.ell(16, 25, 9.5, 2.6, 'c');
    P.ell(6.5, 7, 1.4, 2.6, 'wd'); P.ell(25.5, 7, 1.4, 2.6, 'wd');
    P.ell(6.5, 25, 1.4, 2.6, 'wd'); P.ell(25.5, 25, 1.4, 2.6, 'wd');
    for (const y of [11, 14, 17]) P.line([[11, y], [21, y]], 0.4, 0.4, 'o');
    P.dot(19, 21.5, 2.6, 'e');
    P.put(18.5, 21, 'g');
    P.line([[17.5, 23], [16.5, 27.5]], 0.5, 0.5, 'e');
  }

  function coins(P) {
    for (const [x, y] of [[11, 24], [11, 21], [11, 18]]) P.ell(x, y, 7.5, 3, 'b');
    P.ell(20, 17, 8, 8, 'b');
    P.ell(20, 17, 5.6, 5.6, 'c');
    P.rect(19, 13.5, 2, 7, 'b~');
    P.put(17, 13, 'hl');
  }

  function oldCoin(P) {
    P.ell(16, 16, 11, 11, 'b');
    P.ell(16, 16, 8, 8, 'c');
    P.ell(16, 15, 3, 3.6, 'b~');
    P.rect(13, 19, 6, 2, 'b~');
    for (let a = 0; a < 12; a++) { const t = a / 12 * Math.PI * 2; P.put(16 + Math.cos(t) * 9.6, 16 + Math.sin(t) * 9.6, 'b~'); }
  }

  function key(P) {
    P.ell(9, 11, 6, 6, 'b');
    P.ell(9, 11, 2.6, 2.6, null);
    P.line([[13, 15], [26, 28]], 1.2, 1.2, 'b');
    P.rect(21, 25, 2.6, 4, 'b'); P.rect(24.5, 21.5, 4, 2.6, 'b');
    P.put(7, 8, 'c');
  }

  function bag(P, o) {
    P.line(bez([10, 9], [8, 3], [24, 3], [22, 9], 10), 0.9, 0.9, 'b~');
    P.poly([[7, 11], [25, 11], [27, 27], [5, 27]], 'b');
    P.ell(16, 27, 11, 2.5, 'b');
    P.poly([[7, 10], [25, 10], [24, 18], [8, 18]], 'b~');
    P.rect(14.5, 16, 3, 3, 'a');
    if (o.pockets) { P.rect(8, 20, 5.5, 5, 'b~'); P.rect(18.5, 20, 5.5, 5, 'b~'); }
    if (o.studs) for (const x of [9, 23]) for (const y of [13, 21]) P.put(x, y, 'm');
    if (o.rune) { P.poly([[16, 20], [18.5, 23], [16, 26], [13.5, 23]], 'g'); }
  }

  function lantern(P) {
    P.line(bez([12, 7], [12, 1.5], [20, 1.5], [20, 7], 8), 0.6, 0.6, 'm');
    P.rect(10, 7, 12, 3, 'm');
    P.rect(11, 10, 10, 13, 'g');
    P.rect(11, 10, 1.6, 13, 'm'); P.rect(19.4, 10, 1.6, 13, 'm'); P.rect(15.2, 10, 1.6, 13, 'm');
    P.rect(9, 23, 14, 3, 'm');
    P.dot(16, 17, 1.8, 'f');
  }

  function rope(P) {
    for (const r of [10, 7.5, 5]) P.line(Array.from({ length: 25 }, (_, i) => [16 + Math.cos(i / 24 * Math.PI * 2) * r, 17 + Math.sin(i / 24 * Math.PI * 2) * r * 0.8]), 1.3, 1.3, 'b');
    P.line([[24, 20], [28, 27], [26.5, 29]], 1.1, 0.8, 'b');
    for (let i = 0; i < 10; i++) { const t = i / 10 * Math.PI * 2; P.put(16 + Math.cos(t) * 10, 17 + Math.sin(t) * 8, 'b~'); }
  }

  function amulet(P, o) {
    const n = o.pearls ? 11 : 16;
    for (let i = 0; i <= n; i++) {
      const t = Math.PI * (0.06 + 0.88 * i / n);
      P.dot(16 + Math.cos(t) * 11.5, 15 + Math.sin(t) * 10, o.pearls ? 1.9 : 0.9, o.pearls ? 'hl' : 'a');
    }
    if (o.pearls) { P.dot(16, 27, 2.6, 'hl'); P.put(15, 26, 'c'); return; }
    P.poly([[16, 14], [22.5, 20.5], [16, 29.5], [9.5, 20.5]], 'a');
    P.poly([[16, 16.5], [20, 20.5], [16, 26.5], [12, 20.5]], 'g');
    P.put(14.5, 19, 'hl'); P.put(15.5, 18, 'hl');
  }

  function ingot(P) {
    P.poly([[5, 23], [10, 14], [27, 14], [27, 23]], 'b');
    P.poly([[10, 14], [12, 10], [29, 10], [27, 14]], 'c');
    P.poly([[27, 14], [29, 10], [29.5, 19], [27, 23]], 'b~');
    P.line([[12, 17], [22, 17]], 0.4, 0.4, 'c');
  }

  function rock(P, o) {
    P.poly([[5, 22], [8, 12], [16, 7], [25, 10], [28, 19], [23, 27], [11, 27]], 'b');
    P.recolor(['b'], 'c', (x, y) => y < 12 && x < 20);
    if (o.specks) for (const [x, y] of [[11, 15], [18, 12], [22, 18], [14, 21], [19, 24], [9, 19]]) { P.put(x, y, 'e'); P.put(x + 1, y, 'e'); }
    if (o.rune) P.line([[13, 13], [16, 21], [19, 13]], 0.5, 0.5, 'g');
    if (o.glow) P.line([[10, 18], [15, 15], [20, 20], [25, 16]], 0.5, 0.5, 'g');
  }

  function gem(P) {
    P.poly([[7, 12], [12, 6], [20, 6], [25, 12], [16, 27]], 'b');
    P.poly([[7, 12], [12, 6], [20, 6], [25, 12]], 'c');
    P.poly([[12, 12], [14, 7], [18, 7], [20, 12]], 'hl');
    P.line([[7, 12], [25, 12]], 0.4, 0.4, 'b~');
    P.line([[12, 12], [16, 26]], 0.35, 0.35, 'b~');
    P.line([[20, 12], [16, 26]], 0.35, 0.35, 'c');
  }

  function crystal(P) {
    P.poly([[13, 28], [10, 13], [14, 4], [18, 13], [17, 28]], 'b');
    P.poly([[17, 28], [19, 17], [23, 10], [26, 17], [23, 28]], 'b');
    P.poly([[9, 28], [6, 20], [8, 15], [11, 20], [12, 28]], 'b~');
    P.line([[12.5, 13], [14, 6]], 0.4, 0.4, 'hl');
    P.line([[21, 17], [23, 12]], 0.4, 0.4, 'c');
  }

  function feather(P) {
    P.line(bez([6, 28], [12, 20], [18, 10], [26, 4], 14), 0.5, 0.45, 'a');
    const vane = bez([8, 25], [10, 14], [18, 5], [26, 4], 10);
    const vane2 = bez([10, 27], [20, 23], [26, 12], [26, 4], 10);
    P.poly(vane.concat(vane2.slice().reverse()), 'b');
    for (let i = 2; i < 9; i += 2) P.line([vane[i], vane2[i]], 0.35, 0.35, 'b~');
    P.line(bez([7, 27], [12, 20], [18, 10], [26, 4], 14), 0.4, 0.4, 'a');
  }

  function bone(P, o) {
    if (o.skull) {
      P.ell(16, 13, 10, 9.5, 't');
      P.rect(11, 20, 10, 6, 't');
      P.ell(12, 14, 2.6, 2.8, 'k'); P.ell(20, 14, 2.6, 2.8, 'k');
      P.poly([[16, 17.5], [17.5, 20], [14.5, 20]], 'k');
      for (let x = 12; x <= 19; x += 2) P.rect(x, 23, 1, 2.4, 'k');
      return;
    }
    if (o.finger) {
      P.line([[7, 25], [13, 19], [19, 13], [25, 7]], 2.2, 1.8, 't');
      for (const [x, y] of [[13, 19], [19, 13]]) P.dot(x, y, 2.7, 't');
      return;
    }
    P.line([[9, 23], [23, 9]], 1.8, 1.8, 't');
    for (const [x, y] of [[7, 22], [10, 26], [22, 6], [26, 10]]) P.dot(x, y, 2.6, 't');
  }

  function fang(P, o) {
    const k = o.key || 't';
    P.poly(o.curved
      ? [[10, 5], [20, 4], [21, 10], [19, 18], [14, 27], [13, 18], [11, 11]]
      : [[11, 5], [21, 5], [19, 14], [16, 28], [13, 14]], k);
    P.recolor([k], 'c', (x, y) => y < 9);
    P.line([[13, 9], [15, 20]], 0.4, 0.4, 'hl');
    if (o.blood) P.recolor([k], 'r', (x, y) => y > 22);
  }

  function claw(P) {
    for (const dx of [-6, 0, 6]) {
      P.line(bez([12 + dx, 26], [12 + dx, 16], [16 + dx, 9], [21 + dx * 0.8, 6], 10), 2.2, 0.4, 'b');
    }
    P.ell(13, 27, 10, 3, 'c');
  }

  function horn(P, o) {
    const pts = bez([8, 27], [8, 15], [16, 6], [27, 4], 14);
    P.line(pts, 3.6, 0.5, 'b');
    for (let i = 2; i < 12; i += 2) { const [x, y] = pts[i]; P.line([[x - 2.5, y - 1], [x + 1.5, y + 2.5]], 0.35, 0.35, o.spiral ? 'c' : 'b~'); }
    P.ell(8, 27, 3.8, 1.8, 'c');
  }

  function stinger(P) {
    P.ell(10, 22, 6, 6, 'b');
    P.line(bez([13, 18], [17, 12], [22, 8], [28, 4], 10), 2.2, 0.3, 'a');
    P.put(8, 20, 'c');
    P.put(12, 24, 'r');
  }

  function scale(P, o) {
    P.poly([[16, 4], [25, 9], [24, 20], [16, 28], [8, 20], [7, 9]], 'b');
    P.line([[16, 6], [16, 25]], 0.5, 0.5, 'c');
    P.line([[11, 10], [13, 20]], 0.35, 0.35, 'c');
    if (o.shell) for (const [x, y] of [[11, 12], [21, 12], [16, 18]]) P.line([[x - 2, y], [x - 1, y - 2], [x + 1, y - 2], [x + 2, y], [x + 1, y + 2], [x - 1, y + 2], [x - 2, y]], 0.35, 0.35, 'b~');
  }

  function pearl(P, o) {
    if (o.shell) {
      P.poly([[16, 27], [4, 14], [8, 8], [16, 5], [24, 8], [28, 14]], 'b');
      for (const dx of [-8, -4, 0, 4, 8]) P.line([[16, 26], [16 + dx * 1.2, 7]], 0.35, 0.35, 'b~');
      P.rect(13, 26, 6, 2.5, 'b');
      P.recolor(['b'], 'c', (x, y) => y < 11);
      return;
    }
    const r = o.small ? 6 : 8.5;
    P.ell(16, 17, r, r, 'b');
    P.ell(14, 15, r * 0.45, r * 0.4, 'c');
    P.put(13, 13.5, 'hl');
  }

  function pelt(P, o) {
    if (o.leather) {
      P.poly([[6, 8], [26, 8], [27, 24], [5, 24]], 'b');
      P.poly([[5, 24], [27, 24], [25, 27], [7, 27]], 'b~');
      for (let x = 8; x < 25; x += 2.5) P.put(x, 10, 'c');
      for (let x = 8; x < 25; x += 2.5) P.put(x, 22, 'c');
      P.line([[10, 15], [22, 15]], 0.4, 0.4, 'b~');
      return;
    }
    P.poly([[9, 6], [13, 9], [19, 9], [23, 6], [24, 12], [28, 14], [25, 18], [26, 26], [20, 23], [16, 28], [12, 23], [6, 26], [7, 18], [4, 14], [8, 12]], 'b');
    P.ell(16, 16, 5, 7, 'c');
    for (const [x, y] of [[10, 14], [21, 13], [14, 22], [19, 21]]) P.put(x, y, 'b~');
  }

  function log(P, o) {
    if (o.root) {
      P.line(bez([7, 8], [12, 14], [16, 18], [24, 26], 12), 2.8, 1, 'b');
      P.line(bez([12, 14], [8, 18], [6, 22], [5, 27], 8), 1, 0.4, 'b');
      P.line(bez([16, 18], [20, 18], [24, 16], [28, 17], 8), 0.9, 0.4, 'b');
      if (o.face) { P.put(9, 10, 'k'); P.put(12, 11, 'k'); P.line([[9, 13], [11.5, 14]], 0.4, 0.4, 'k'); P.poly([[7, 8], [3, 3], [8, 5]], 'a'); P.poly([[8, 7], [9, 1.5], [11, 6]], 'a'); }
      else for (const [x, y] of [[10, 11], [15, 16], [20, 21]]) P.put(x, y, 'g');
      return;
    }
    P.poly([[5, 14], [22, 7], [27, 17], [10, 24]], 'b');
    P.ell(24.5, 12, 3.4, 5.4, 'c');
    P.ell(24.5, 12, 1.6, 2.8, 'b~');
    for (const [x0, y0] of [[8, 15], [12, 13], [15, 18]]) P.line([[x0, y0], [x0 + 6, y0 - 2.5]], 0.35, 0.35, 'b~');
  }

  function plant(P, o) {
    const kind = o.kind || 'herb';
    if (kind === 'mushroom') {
      P.rect(13, 16, 6, 12, 'c');
      P.ell(16, 15, 11, 7, 'b');
      P.recolor(['b'], null, (x, y) => y > 17);
      P.rect(5, 16.5, 22, 1.5, 'b~');
      for (const [x, y] of [[11, 11], [18, 10], [22, 14], [14, 14]]) P.dot(x, y, 1.2, 'hl');
      if (o.glow) { P.put(5, 9, 'g'); P.put(27, 8, 'g'); P.put(24, 4, 'g'); }
      return;
    }
    if (kind === 'flower' || kind === 'lotus') {
      P.line([[16, 18], [15, 29]], 0.6, 0.6, 'a');
      P.poly([[15, 25], [9, 22], [14, 23]], 'a');
      const n = kind === 'lotus' ? 7 : 6;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2 - Math.PI / 2;
        P.ell(16 + Math.cos(a) * 5.5, 12 + Math.sin(a) * 5, kind === 'lotus' ? 2.4 : 3, kind === 'lotus' ? 4 : 3, 'b');
      }
      P.dot(16, 12, 2.6, 'c');
      return;
    }
    if (kind === 'wheat') {
      P.line([[16, 29], [16, 10]], 0.5, 0.5, 'a~');
      for (let y = 4; y < 18; y += 2.4) { P.ell(13.6, y + 1, 1.6, 2, 'b'); P.ell(18.4, y, 1.6, 2, 'b'); }
      P.line([[16, 4], [16, 0.8]], 0.3, 0.3, 'b');
      return;
    }
    if (kind === 'seeds') {
      P.poly([[9, 11], [23, 11], [26, 26], [6, 26]], 'wd');
      P.line([[10, 12], [22, 12]], 0.8, 0.8, 'wd~');
      for (const [x, y] of [[12, 9], [16, 8], [20, 9], [14, 10], [18, 10], [7, 28], [10, 29], [24, 28]]) P.ell(x, y, 1.2, 0.9, 'b');
      return;
    }
    // hierba: manojo de hojas atadas
    for (const [a, l] of [[-0.9, 12], [-0.45, 14], [0, 15], [0.45, 14], [0.9, 12]]) {
      const tip = [16 + Math.sin(a) * l, 22 - Math.cos(a) * l];
      P.line([[16, 22], [(16 + tip[0]) / 2, (22 + tip[1]) / 2], tip], 0.5, 0.4, 'a~');
      P.ell((16 * 0.3 + tip[0] * 0.7), (22 * 0.3 + tip[1] * 0.7), 2.4, 3.6, 'b');
    }
    P.line([[16, 21], [16, 29]], 0.7, 0.7, 'a~');
    P.rect(14, 22, 4, 2, 'wd');
  }

  function essence(P, o) {
    const kind = o.kind || 'orb';
    if (kind === 'wisp') {
      P.poly([[16, 3], [22, 10], [24, 18], [20, 26], [12, 26], [8, 18], [10, 10]], 'b');
      P.ell(16, 18, 5, 6, 'c');
      P.line(bez([12, 26], [10, 29], [16, 30], [18, 27], 8), 0.8, 0.4, 'b');
      P.put(13.5, 16, 'k'); P.put(18, 16, 'k');
      return;
    }
    if (kind === 'ember') {
      P.poly([[6, 26], [9, 16], [16, 12], [24, 15], [27, 25], [16, 28]], 'b');
      P.line([[9, 22], [15, 18], [21, 21], [25, 19]], 0.5, 0.5, 'g');
      for (const [x, y, h] of [[12, 12, 7], [17, 10, 9], [22, 13, 6]]) P.line([[x, y + 2], [x + 0.5, y - h + 2]], 1.4, 0.3, 'f');
      return;
    }
    if (kind === 'bolt') {
      P.dot(16, 16, 10, 'b');
      P.dot(16, 16, 7, 'c');
      P.poly([[18, 5], [11, 17], [16, 17], [13, 27], [22, 14], [17, 14], [20, 5]], 'g');
      return;
    }
    if (kind === 'vial') {
      P.rect(13, 4, 6, 4, 'wd');
      P.rect(13.5, 8, 5, 3, 'gl');
      P.poly([[11, 11], [21, 11], [22, 27], [10, 27]], 'gl');
      P.recolor(['gl'], 'b', (x, y) => y > 15);
      P.recolor(['b'], 'c', (x, y) => y < 17);
      P.line([[12, 13], [12, 24]], 0.4, 0.4, 'hl');
      return;
    }
    if (kind === 'dust') {
      P.ell(16, 24, 12, 5, 'b');
      P.ell(16, 21, 8, 5, 'b');
      P.ell(16, 19, 4, 3, 'c');
      for (const [x, y] of [[6, 12], [11, 8], [20, 6], [25, 11], [15, 13], [27, 17]]) P.put(x, y, 'g');
      return;
    }
    if (kind === 'heart') {
      P.ell(11, 13, 6, 6, 'b'); P.ell(21, 13, 6, 6, 'b');
      P.poly([[5.5, 15], [26.5, 15], [16, 28]], 'b');
      P.ell(10, 11, 2, 1.6, 'c');
      P.line([[16, 7], [18, 3]], 0.9, 0.7, 'b~');
      return;
    }
    if (kind === 'eye') {
      P.ell(16, 16, 11, 11, 'hl');
      P.line([[6, 12], [10, 14]], 0.35, 0.35, 'r'); P.line([[25, 20], [21, 18]], 0.35, 0.35, 'r'); P.line([[8, 22], [11, 19]], 0.35, 0.35, 'r');
      P.dot(17, 15, 5, 'b');
      P.ell(17, 15, 1.4, 3.4, 'k');
      P.put(14.5, 12.5, 'hl');
      return;
    }
    if (kind === 'web') {
      P.dot(16, 17, 8.5, 'b');
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; P.line([[16, 17], [16 + Math.cos(a) * 12, 17 + Math.sin(a) * 12]], 0.35, 0.35, 'b'); }
      for (const r of [4, 6.5]) for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; P.put(16 + Math.cos(a) * r, 17 + Math.sin(a) * r, 'c'); }
      return;
    }
    // orbe
    P.dot(16, 16, 10.5, 'b');
    P.dot(16, 16, 6, 'c');
    P.dot(16, 16, 2.6, 'g');
    P.line(bez([8, 12], [12, 6], [20, 6], [24, 11], 8), 0.4, 0.4, 'c');
    P.put(11, 10, 'hl');
    if (o.rune) P.line([[13, 13], [16, 20], [19, 13]], 0.45, 0.45, 'g');
  }

  function bodyPart(P, o) {
    const kind = o.kind;
    if (kind === 'ear') {
      P.poly([[10, 26], [6, 8], [18, 3], [26, 10], [20, 24]], 'b');
      P.poly([[12, 22], [10, 10], [18, 7], [22, 12], [18, 21]], 'c');
      return;
    }
    if (kind === 'nose') {
      P.ell(16, 14, 6, 8, 'b');
      P.ell(16, 21, 9, 6, 'b');
      P.ell(12.5, 22, 1.6, 1.6, 'k'); P.ell(19.5, 22, 1.6, 1.6, 'k');
      P.put(14, 10, 'c');
      return;
    }
    if (kind === 'tail') {
      P.line(bez([5, 26], [16, 30], [12, 10], [27, 6], 16), 1.8, 0.5, 'b');
      if (o.spade) P.poly([[25, 3], [30, 4], [28, 9]], 'a');
      return;
    }
    if (kind === 'tuft') {
      for (let i = 0; i < 7; i++) P.line(bez([16, 28], [10 + i * 2, 20], [6 + i * 3.3, 12], [5 + i * 3.6, 5 + Math.abs(3 - i) * 1.4], 8), 1.1, 0.4, i % 2 ? 'b' : 'c');
      P.rect(13, 25, 6, 4, 'wd');
      return;
    }
    if (kind === 'leg') {
      P.line([[5, 27], [12, 16], [21, 13], [27, 4]], 1.4, 0.7, 'b');
      for (const [x, y] of [[12, 16], [21, 13]]) P.dot(x, y, 1.8, 'b');
      for (const [x, y] of [[8, 22], [16, 14.5]]) P.put(x, y, 'c');
      return;
    }
    if (kind === 'wing') {
      P.poly([[5, 26], [8, 6], [16, 3], [27, 8], [26, 16], [21, 13], [19, 20], [14, 16], [11, 24]], 'b');
      P.line([[5, 26], [8, 6], [16, 3]], 0.6, 0.5, 'a');
      P.line([[8, 6], [26, 15]], 0.45, 0.4, 'a'); P.line([[8, 6], [19, 19]], 0.45, 0.4, 'a');
      return;
    }
    if (kind === 'meat_rot') {
      P.poly([[5, 15], [10, 7], [20, 6], [27, 12], [25, 23], [14, 27], [6, 23]], 'b');
      for (const [x, y] of [[11, 12], [19, 11], [16, 19], [22, 18]]) P.dot(x, y, 1.4, 'c');
      for (const [x, y] of [[9, 4], [13, 2], [21, 3]]) P.put(x, y, 'g');
    }
  }

  function fabric(P, o) {
    if (o.spool) {
      P.rect(9, 6, 14, 3, 'wd'); P.rect(9, 23, 14, 3, 'wd');
      P.rect(11, 9, 10, 14, 'b');
      for (let y = 10; y < 22; y += 2) P.line([[11, y], [21, y + 1]], 0.35, 0.35, 'b~');
      P.line(bez([21, 14], [26, 16], [24, 22], [28, 26], 8), 0.4, 0.4, 'b');
      return;
    }
    if (o.bandage) {
      P.ell(13, 17, 8.5, 8.5, 'b');
      P.ell(13, 17, 3, 3, 'c');
      P.poly([[18, 22], [29, 25], [28, 29], [16, 26]], 'b');
      P.line([[20, 24.5], [27, 26.8]], 0.35, 0.35, 'r');
      return;
    }
    P.poly([[5, 10], [21, 6], [27, 22], [11, 27]], 'b');
    P.ell(8, 18.5, 3.4, 8.5, 'c');
    P.ell(8, 18.5, 1.4, 3.6, 'b~');
    for (const [a, b] of [[[12, 11], [24, 17]], [[14, 17], [25, 21]]]) P.line([a, b], 0.35, 0.35, 'b~');
    if (o.shiny) P.line([[13, 9], [19, 7.5]], 0.45, 0.45, 'hl');
  }

  function urn(P) {
    P.ell(16, 19, 9, 9, 'b');
    P.rect(12, 5, 8, 6, 'b');
    P.ell(16, 5, 6, 1.8, 'c');
    P.rect(11, 27, 10, 2.6, 'b');
    P.line([[8, 18], [24, 18]], 0.5, 0.5, 'c');
    for (const x of [11, 16, 21]) P.put(x, 21, 'g');
    P.line(bez([7, 12], [3, 12], [4, 20], [8, 20], 6), 0.6, 0.6, 'b');
    P.line(bez([25, 12], [29, 12], [28, 20], [24, 20], 6), 0.6, 0.6, 'b');
  }

  function core(P, o) {
    P.poly([[16, 3], [27, 10], [27, 22], [16, 29], [5, 22], [5, 10]], 'b');
    P.poly([[16, 3], [27, 10], [16, 16], [5, 10]], 'c');
    P.dot(16, 18, 4, 'g');
    P.line([[16, 16], [16, 28]], 0.4, 0.4, 'b~');
    if (o.gear) for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; P.put(16 + Math.cos(a) * 6, 18 + Math.sin(a) * 6, 'c'); }
  }

  function saltPile(P) {
    P.ell(16, 24, 12, 5, 'b');
    P.ell(16, 20, 8, 6, 'b');
    P.ell(14, 17, 3, 2, 'c');
    for (const [x, y] of [[9, 23], [21, 21], [16, 25], [12, 26]]) P.put(x, y, 'hl');
  }

  const SHAPES = {
    sword, axe, halberd, club, mace, hammer, staff, wand, scepter, bow, crossbow, spear, armor,
    potion, meat, bread, cheese, berries, cactus, goo, scroll, coins, oldCoin, key, bag, lantern, rope,
    amulet, ingot, rock, gem, crystal, feather, bone, fang, claw, horn, stinger, scale, pearl, pelt,
    log, plant, essence, bodyPart, fabric, urn, core, saltPile,
  };

  // ============================================================
  // Qué dibujo le toca a cada ítem
  // ============================================================

  const GLASS = '#dfe9ee';

  function weaponShape(it, t) {
    const mat = matOf(t);
    const el = elemOf(t);
    const p = { m: mat.m, c: mat.c, a: '#c9a24a', wd: '#7a5430', g: (el && el.g) || '#9ae0ff', hl: '#ffffff', k: '#1a1410' };
    if (/obsidiana/.test(t)) { p.m = '#2e2638'; p.c = '#7a5ab0'; }
    if (/colmillo/.test(t)) return { shape: 'fang', p: { t: '#f0e8d0', c: '#ffffff', r: '#a02a1a' }, o: { curved: true, blood: true } };
    if (/katana/.test(t)) return { shape: 'sword', p: { ...p, a: '#2a2a2a', k: '#202024' }, o: { curve: true, round: true, grip: 6.5, gripKey: 'k', w: 0.95, len: 1.02 } };
    if (/mandoble/.test(t)) return { shape: 'sword', p, o: { len: 1.12, w: 1.6, guard: 5.5, grip: 5.5, x0: 10, y0: 22 } };
    if (/excalibur/.test(t)) return { shape: 'sword', p: { ...p, m: '#dfe8f0', c: '#ffffff', a: '#ffd040', g: '#60c0ff' }, o: { len: 1.05, w: 1.35, guard: 5, gem: true } };
    if (/matamuertos/.test(t)) return { shape: 'sword', p: { ...p, a: '#e8d8a0', g: '#fff2a0' }, o: { len: 1.05, w: 1.3, runes: true, guard: 4.5 } };
    if (/daga|cuchill|puñal/.test(t)) return { shape: 'sword', p, o: { len: 0.66, w: 1.1, guard: 3, grip: 3.6, x0: 14, y0: 18 } };
    if (/espada/.test(t)) return { shape: 'sword', p, o: { len: /corta/.test(t) ? 0.82 : 1, w: 1.2, runes: /r[uú]nic/.test(t), x0: /corta/.test(t) ? 12.5 : 11.5, y0: /corta/.test(t) ? 19.5 : 20.5 } };
    if (/alabarda/.test(t)) return { shape: 'halberd', p };
    if (/hacha/.test(t)) return { shape: 'axe', p, o: { double: /guerra/.test(t), runes: /r[uú]nic/.test(t) } };
    if (/mjol|mjöl/.test(t)) return { shape: 'hammer', p: { ...p, m: '#9aa4b0', g: '#9ae0ff' }, o: { big: true, runes: true } };
    if (/martillo/.test(t)) return { shape: 'hammer', p };
    if (/maza/.test(t)) return { shape: 'mace', p };
    if (/garrote|porra/.test(t)) return { shape: 'club', p };
    if (/varita/.test(t)) return { shape: 'wand', p: { ...p, g: (el && el.g) || '#ffe080' } };
    if (/cetro/.test(t)) return { shape: 'scepter', p: { ...p, a: /abisal/.test(t) ? '#4a8a8a' : '#d0a030', g: (el && el.g) || '#c090ff' } };
    if (/bast[oó]n|b[aá]culo|vara/.test(t)) {
      if (/fuego/.test(t)) return { shape: 'staff', p: { ...p, f: '#ff6a20', g: '#ffe080' }, o: { head: 'flame' } };
      if (/hielo/.test(t)) return { shape: 'staff', p: { ...p, c: '#a8e4ff', hl: '#ffffff', wd: '#8a9aaa' }, o: { head: 'crystal' } };
      return { shape: 'staff', p: { ...p, g: (el && el.g) || '#a8f0ff' }, o: { runes: /r[uú]nic/.test(t) } };
    }
    if (/ballesta/.test(t)) return { shape: 'crossbow', p };
    if (/arco/.test(t)) return { shape: 'bow', p: { ...p, wd: /[eé]lfic/.test(t) ? '#7a9a40' : '#8a5a2a', c: /[eé]lfic/.test(t) ? '#e0c040' : '#d8d0e8' }, o: { feathers: /pluma/.test(t), leaf: /[eé]lfic/.test(t) } };
    if (/lanza|tridente|pica/.test(t)) return { shape: 'spear', p: /hueso/.test(t) ? { ...p, m: '#e8e0c8', c: '#ffffff', wd: '#bfb294' } : p };
    return { shape: 'sword', p, o: {} };
  }

  function armorShape(it, t) {
    const el = elemOf(t);
    const base = { a: '#8a6a3a', c: '#e8d8b0', m: '#b8bcc4', wd: '#6a4a2a', g: (el && el.g) || '#9ae0ff' };
    if (/manto/.test(t) || /t[uú]nica de tela/.test(t) && false) {
      if (/estelar/.test(t)) return { shape: 'armor', p: { ...base, b: '#1e2a5a', a: '#e0c060', g: '#fff6c0' }, o: { kind: 'robe', stars: true } };
      return { shape: 'armor', p: { ...base, b: '#3a2a5a', a: '#c0a040' }, o: { kind: 'robe' } };
    }
    if (/tela/.test(t)) return { shape: 'armor', p: { ...base, b: '#d8c8a0', a: '#8a6a3a' }, o: { kind: 'tunic' } };
    if (/t[uú]nica/.test(t)) return { shape: 'armor', p: { ...base, b: '#8a5a32', a: '#5a3a1a' }, o: { kind: 'leather' } };
    if (/reforzad/.test(t)) return { shape: 'armor', p: { ...base, b: '#6e4a2c', a: '#3a2a1a', m: '#c8c8d0' }, o: { kind: 'studded' } };
    if (/brigantina/.test(t)) return { shape: 'armor', p: { ...base, b: '#7a3a2a', a: '#3a2a1a', m: '#c8c8d0' }, o: { kind: 'brigandine' } };
    if (/malla/.test(t)) return { shape: 'armor', p: { ...base, b: '#9aa2ac', a: '#6a4a2a' }, o: { kind: 'chain' } };
    if (/tabardo/.test(t)) return { shape: 'armor', p: { ...base, b: '#4a3a7a', c: '#d8c8f0', a: '#c0a040', g: '#c090ff' }, o: { kind: 'tabard' } };
    if (/coraza/.test(t)) return { shape: 'armor', p: { ...base, b: '#aab4be', c: '#e8eef4' }, o: { kind: 'breastplate' } };
    if (/obsidiana/.test(t)) return { shape: 'armor', p: { ...base, b: '#2e2638', c: '#8a6ac0', g: '#a07ae0' }, o: { kind: 'plate', sheen: true } };
    if (/drag[oó]n/.test(t)) return { shape: 'armor', p: { ...base, b: '#a83020', c: '#e88a50' }, o: { kind: 'plate', scales: true } };
    if (/r[uú]nic/.test(t)) return { shape: 'armor', p: { ...base, b: '#7a8aa0', c: '#d0dcf0', g: '#7ae0ff' }, o: { kind: 'plate', runes: true } };
    if (/placa/.test(t)) return { shape: 'armor', p: { ...base, b: '#a0aab4', c: '#e8eef4' }, o: { kind: 'plate' } };
    if (/cuero/.test(t)) return { shape: 'armor', p: { ...base, b: '#8a5a32', a: '#5a3a1a' }, o: { kind: 'leather' } };
    if (/t[uú]nica|ropa|camisa/.test(t)) return { shape: 'armor', p: { ...base, b: '#d8c8a0' }, o: { kind: 'tunic' } };
    return { shape: 'armor', p: { ...base, b: '#a0aab4' }, o: { kind: 'breastplate' } };
  }

  const GEMS = {
    rubi: '#d82a3a', 'rubí': '#d82a3a', zafiro: '#2a5ad8', esmeralda: '#2aa84a', diamante: '#c8f0ff', amatista: '#9a4ad8', topacio: '#f0b020',
  };

  function itemShape(it, t) {
    const sub = it.subtype || it.type || '';
    const el = elemOf(t);
    const g = (el && el.g) || '#a8f0ff';

    // monedas y llaves
    if (sub === 'coin' || /^moneda de/.test(t)) {
      const col = /oro/.test(t) ? ['#e0b030', '#fff0a0'] : /plata/.test(t) ? ['#c0c8d0', '#f4f8fc'] : ['#c87a3a', '#f0b080'];
      return { shape: 'coins', p: { b: col[0], c: col[1] } };
    }
    if (/moneda antigua/.test(t)) return { shape: 'oldCoin', p: { b: '#8a8a4a', c: '#b0a860' } };
    if (/dobl[oó]n/.test(t)) return { shape: 'oldCoin', p: { b: '#d4a42c', c: '#ffe080' } };
    if (sub === 'key' || /llave/.test(t)) {
      const m = matOf(t);
      return { shape: 'key', p: { b: /oxidad/.test(t) ? '#9a5a2a' : m.m, c: m.c } };
    }
    // mochilas
    if (sub === 'bag' || /mochila|bolsa/.test(t)) {
      if (/arcan/.test(t)) return { shape: 'bag', p: { b: '#5a3a8a', a: '#e0c060', g: '#c090ff' }, o: { rune: true } };
      if (/avanzad/.test(t)) return { shape: 'bag', p: { b: '#4a5a6a', a: '#c0c0c0' }, o: { pockets: true } };
      if (/grande/.test(t)) return { shape: 'bag', p: { b: '#5a6a3a', a: '#c0a040' }, o: { pockets: true } };
      if (/reforzad/.test(t)) return { shape: 'bag', p: { b: '#6a4a2a', a: '#c0a040', m: '#c8c8d0' }, o: { studs: true } };
      return { shape: 'bag', p: { b: '#8a5a32', a: '#c0a040' } };
    }
    // pergaminos
    if (sub === 'scroll' || sub === 'scroll_spell' || /pergamino/.test(t)) {
      const seal = /escape/.test(t) ? '#3a9a3a' : (el ? el.e : '#a02a2a');
      return { shape: 'scroll', p: { b: '#efe0b8', c: '#f8eed4', wd: '#8a5a30', e: seal, g: '#ffffff' } };
    }
    // pociones y bebidas
    // v2.1: ron (botella ámbar) y vial de sangre
    if (/(^|\s)ron(\s|$)/.test(t)) return { shape: 'potion', p: { b: '#b8701a', c: '#e8a040', gl: GLASS, wd: '#6a3a1a', hl: '#ffffff' }, o: { shape: 'tall' } };
    if (/vial de sangre/.test(t)) return { shape: 'potion', p: { b: '#8a0a1a', c: '#d03040', gl: GLASS, wd: '#3a1a1a', hl: '#ffffff' }, o: { shape: 'small' } };
    if (sub === 'potion' || /poci[oó]n|elixir|ant[ií]doto|(^|\s)t[eé] de/.test(t)) {
      if (/(^|\s)t[eé] de/.test(t)) return { shape: 'potion', p: { b: '#e8e0d0', e: '#7a9a3a', hl: '#ffffff' }, o: { shape: 'cup' } };
      let col = ['#d02a2a', '#ff7a6a'];
      if (/man[aá]/.test(t)) col = ['#2a5ad0', '#7aaaff'];
      else if (/ant[ií]doto/.test(t)) col = ['#3aa03a', '#9ae07a'];
      else if (/fuerza/.test(t)) col = ['#e08a20', '#ffd070'];
      else if (/lodo/.test(t)) col = ['#6a4a2a', '#9a7a50'];
      const shape = /menor/.test(t) ? 'small' : /elixir/.test(t) ? 'tall' : 'round';
      return { shape: 'potion', p: { b: col[0], c: col[1], gl: GLASS, wd: '#8a5a30', hl: '#ffffff' }, o: { shape } };
    }
    // amuletos
    if (/collar de perlas/.test(t)) return { shape: 'amulet', p: { a: '#c0a040', hl: '#f8f4ec' }, o: { pearls: true } };
    if (/amuleto|talism[aá]n|colgante/.test(t)) return { shape: 'amulet', p: { a: '#c9a24a', g: (el && el.g) || '#ff5a3a' } };
    // varios
    if (/linterna|farol|antorcha/.test(t)) return { shape: 'lantern', p: { m: '#4a4a52', g: '#ffd070', f: '#fff6c0' } };
    if (/cuerda/.test(t)) return { shape: 'rope', p: { b: '#b0905a' } };
    if (/reliquia|urna|[aá]nfora/.test(t)) return { shape: 'urn', p: { b: '#b08a3a', c: '#e0c070', g: '#60e0c0' } };
    // comida
    if (/pan\b|^pan/.test(t)) return { shape: 'bread', p: { b: '#c88a3a', c: '#e8b060' } };
    if (/queso/.test(t)) return { shape: 'cheese', p: { b: '#e8b830', c: '#f8d860' } };
    if (/baya|belladona|uva/.test(t)) return { shape: 'berries', p: { b: /belladona/.test(t) ? '#3a1a4a' : '#2a2a5a', a: '#3a8a3a', wd: '#5a3a1a' } };
    if (/cactus/.test(t)) return { shape: 'cactus', p: { b: '#4a8a3a', c: '#7ab85a', wd: '#a07a4a' } };
    if (/semilla/.test(t)) return { shape: 'plant', p: { b: '#d8b860', wd: '#a0784a' }, o: { kind: 'seeds' } };
    if (/pulpa de insecto/.test(t)) return { shape: 'goo', p: { b: '#7aa03a', c: '#b8d070', g: '#d0f080' } };
    if (/carne de ave/.test(t)) return { shape: 'meat', p: { b: '#b8703a', c: '#e0a060', t: '#f0e8d0' }, o: { kind: 'drumstick' } };
    if (/carne de gigante/.test(t)) return { shape: 'meat', p: { b: '#b0503a', c: '#e08a6a', t: '#f0e8d0' }, o: { kind: 'ham' } };
    if (/carne seca/.test(t)) return { shape: 'meat', p: { b: '#7a3a20', c: '#a05a3a' }, o: { kind: 'jerky' } };
    if (/carne de pez|pescado/.test(t)) return { shape: 'meat', p: { b: '#7a9ab8', c: '#d0e0ec', hl: '#ffffff', r: '#f0907a' }, o: { kind: 'fish', fillet: /carne de pez/.test(t) } };
    if (/carne de zombi/.test(t)) return { shape: 'bodyPart', p: { b: '#6a7a4a', c: '#8a3a3a', g: '#90c040' }, o: { kind: 'meat_rot' } };
    if (/carne|filete/.test(t)) {
      if (/reptil/.test(t)) return { shape: 'meat', p: { b: '#8a7a4a', c: '#c0b080' }, o: { scales: true } };
      if (/drag[oó]n/.test(t)) return { shape: 'meat', p: { b: '#b02a2a', c: '#ff8a5a' }, o: { scales: true, bone: true } };
      if (/salad/.test(t)) return { shape: 'meat', p: { b: '#a0503a', c: '#e0a080', hl: '#ffffff', t: '#f0e8d0' }, o: { salt: true } };
      if (/cruda/.test(t)) return { shape: 'meat', p: { b: '#c8343a', c: '#f8b0b0', t: '#f0e8d0' }, o: { bone: true } };
      return { shape: 'meat', p: { b: '#a8483a', c: '#e09a80', t: '#f0e8d0' }, o: { bone: true } };
    }
    // metales
    if (/lingote/.test(t)) {
      const m = matOf(t);
      return { shape: 'ingot', p: { b: m.m, c: m.c } };
    }
    if (/mineral/.test(t)) return { shape: 'rock', p: { b: '#6a625a', c: '#8a827a', e: '#c08a6a' }, o: { specks: true } };
    if (/carb[oó]n/.test(t)) return { shape: 'rock', p: { b: '#2a2a2e', c: '#5a5a66' } };
    if (/obsidiana/.test(t)) return { shape: 'rock', p: { b: '#241e2e', c: '#6a5aa0' } };
    if (/lava/.test(t)) return { shape: 'rock', p: { b: '#5a2a1a', c: '#8a3a2a', g: '#ff7020' }, o: { glow: true } };
    if (/runa/.test(t)) return { shape: 'rock', p: { b: '#7a7a80', c: '#a0a0a8', g: '#7ae0ff' }, o: { rune: true } };
    if (/sal\b|sal de/.test(t)) return { shape: 'saltPile', p: { b: '#e8e4dc', c: '#ffffff', hl: '#ffffff' } };
    // gemas y cristales
    for (const name of Object.keys(GEMS)) if (t.includes(name)) return { shape: 'gem', p: { b: GEMS[name], c: '#ffffff' } };
    if (/gema/.test(t)) return { shape: 'gem', p: { b: /[ií]gne/.test(t) ? '#ff6a20' : '#9a5ae0', c: '#ffffff' } };
    if (/cristal|cuarzo/.test(t)) return { shape: 'crystal', p: { b: /man[aá]/.test(t) ? '#4a7ae0' : '#d8c8f0', c: '#ffffff', hl: '#ffffff' } };
    if (/hongo|seta/.test(t)) {
      const col = /rojo/.test(t) ? ['#c83030', '#e8dcc8'] : /azul/.test(t) ? ['#3a5ad0', '#e0e0f0'] : /luminoso/.test(t) ? ['#6ae070', '#e0ffd0'] : ['#8a6a3a', '#d8c8a0'];
      return { shape: 'plant', p: { b: col[0], c: col[1], g: '#c0ff80' }, o: { kind: 'mushroom', glow: /luminoso/.test(t) } };
    }
    // partes de criaturas
    if (/cr[aá]neo/.test(t)) return { shape: 'bone', p: { t: '#e8e0c8' }, o: { skull: true } };
    if (/dedo/.test(t)) return { shape: 'bone', p: { t: '#e0d8c0' }, o: { finger: true } };
    if (/hueso/.test(t)) return { shape: 'bone', p: { t: /antiguo/.test(t) ? '#c8b890' : '#ece4cc' } };
    if (/colmillo|diente/.test(t)) return { shape: 'fang', p: { t: '#f2ead6', c: '#ffffff', r: '#a02a1a' }, o: { curved: /vampiro|hidra/.test(t), blood: /vampiro/.test(t) } };
    if (/garra/.test(t)) return { shape: 'claw', p: { b: /licantropo|licántropo/.test(t) ? '#3a3030' : '#4a4038', c: '#8a6a4a' } };
    if (/cuerno/.test(t)) {
      if (/unicornio/.test(t)) return { shape: 'horn', p: { b: '#f4f0fa', c: '#d0c0f0' }, o: { spiral: true } };
      if (/demonio/.test(t)) return { shape: 'horn', p: { b: '#6a1a1a', c: '#2a0a0a' } };
      return { shape: 'horn', p: { b: '#b8a070', c: '#7a5a3a' } };
    }
    if (/p[uú]a|aguja|aguij/.test(t)) return { shape: 'stinger', p: { b: /escorpi/.test(t) ? '#a07030' : '#8a5a3a', a: '#2a1a10', c: '#c89048' } };
    if (/escama/.test(t)) {
      const col = /drag[oó]n/.test(t) ? ['#b02a20', '#f08a5a'] : /sirena/.test(t) ? ['#2a9a9a', '#a0f0e0'] : /kobold/.test(t) ? ['#c06a2a', '#f0a060'] : ['#5a8aa0', '#b0e0f0'];
      return { shape: 'scale', p: { b: col[0], c: col[1] } };
    }
    if (/caparaz[oó]n/.test(t)) return { shape: 'scale', p: { b: '#6a7a3a', c: '#a0b060' }, o: { shell: true } };
    if (/concha/.test(t)) return { shape: 'pearl', p: { b: '#e0a8c8', c: '#a8e0e0' }, o: { shell: true } };
    if (/perla/.test(t)) return { shape: 'pearl', p: { b: '#e8e4f0', c: '#ffffff', hl: '#ffffff' }, o: { small: /peque/.test(t) } };
    if (/pluma/.test(t)) {
      const col = /[aá]ngel/.test(t) ? ['#f4f4ff', '#c8c8f0'] : /extra/.test(t) ? ['#8a5ac0', '#e0c040'] : ['#c8c0b0', '#7a6a50'];
      return { shape: 'feather', p: { b: col[0], a: col[1] } };
    }
    if (/ceniza/.test(t)) return { shape: 'feather', p: { b: '#ff7a30', a: '#ffd060' } };
    if (/ala de/.test(t)) return { shape: 'bodyPart', p: { b: '#5a3d5c', a: '#3a2638' }, o: { kind: 'wing' } };
    if (/oreja/.test(t)) return { shape: 'bodyPart', p: /goblin/.test(t) ? { b: '#6a9a3a', c: '#8aba5a' } : { b: '#6a4a6a', c: '#a07a9a' }, o: { kind: 'ear' } };
    if (/nariz/.test(t)) return { shape: 'bodyPart', p: { b: '#6a9a3a', c: '#8aba5a' }, o: { kind: 'nose' } };
    if (/cola/.test(t)) return { shape: 'bodyPart', p: /diablillo/.test(t) ? { b: '#c03a2a', a: '#f0d080' } : { b: '#e0a0a0' }, o: { kind: 'tail', spade: /diablillo/.test(t) } };
    if (/pelo|melena/.test(t)) return { shape: 'bodyPart', p: /quimera/.test(t) ? { b: '#c08a3a', c: '#e0b060', wd: '#6a4a2a' } : { b: '#7d6d5c', c: '#a89580', wd: '#5a4a3a' }, o: { kind: 'tuft' } };
    if (/pata de/.test(t)) return { shape: 'bodyPart', p: { b: '#30242f', c: '#b03050' }, o: { kind: 'leg' } };
    if (/(^|\s)ojo/.test(t)) {
      const col = /zombi/.test(t) ? '#a0a040' : /basilisco/.test(t) ? '#40c040' : '#8a50e0';
      return { shape: 'essence', p: { b: col, hl: '#f4f0e8', r: '#d04040' }, o: { kind: 'eye' } };
    }
    if (/coraz[oó]n/.test(t)) return { shape: 'essence', p: { b: '#c02a3a', c: '#ff8a8a' }, o: { kind: 'heart' } };
    if (/sangre|tinta|veneno|gl[aá]ndula/.test(t)) {
      const col = /troll/.test(t) ? ['#3a8a3a', '#7ad07a'] : /tinta/.test(t) ? ['#1a1a2a', '#4a4a6a'] : /veneno|gl[aá]ndula/.test(t) ? ['#5ab02a', '#b0f060'] : ['#a01a2a', '#e04a5a'];
      return { shape: 'essence', p: { b: col[0], c: col[1], gl: GLASS, wd: '#8a5a30', hl: '#ffffff' }, o: { kind: 'vial' } };
    }
    if (/seda de ara/.test(t)) return { shape: 'essence', p: { b: '#e8e8f0', c: '#ffffff' }, o: { kind: 'web' } };
    if (/n[uú]cleo de golem|n[uú]cleo de gólem|engranaje/.test(t)) return { shape: 'core', p: { b: '#7a7a80', c: '#a0a0a8', g: '#60c0ff' }, o: { gear: true } };
    if (/n[uú]cleo/.test(t)) return { shape: 'goo', p: { b: '#50c050', c: '#9ae890', g: '#e0ffb0' }, o: { core: true } };
    if (/gelatina/.test(t)) return { shape: 'goo', p: { b: '#60c060', c: '#a0f090', hl: '#ffffff' }, o: { cube: true } };
    if (/ectoplasma/.test(t)) return { shape: 'goo', p: { b: '#7ad08a', c: '#c0f8c8' } };
    if (/esencia espectral/.test(t)) return { shape: 'essence', p: { b: '#a8c0d8', c: '#e8f0ff', k: '#203040' }, o: { kind: 'wisp' } };
    if (/esencia de sombra/.test(t)) return { shape: 'essence', p: { b: '#2a1a3a', c: '#5a3a7a', g: '#c090ff' } };
    if (/esencia de hielo/.test(t)) return { shape: 'crystal', p: { b: '#8ad0f8', c: '#e0f6ff', hl: '#ffffff' } };
    if (/brasa/.test(t)) return { shape: 'essence', p: { b: '#4a2a1a', g: '#ff7020', f: '#ffb030' }, o: { kind: 'ember' } };
    if (/chispa de tormenta/.test(t)) return { shape: 'essence', p: { b: '#3a3a8a', c: '#6a6ad0', g: '#fff070' }, o: { kind: 'bolt' } };
    if (/polvo/.test(t)) return { shape: 'essence', p: { b: '#8a5ad0', c: '#c8a8ff', g: '#ffffff' }, o: { kind: 'dust' } };
    if (/esencia/.test(t)) return { shape: 'essence', p: { b: (el && el.e) || '#6a6ad0', c: (el && el.c) || '#c0c0ff', g } };
    // pieles y telas
    if (/cuero curtido|cuero grueso|cuero/.test(t)) return { shape: 'pelt', p: { b: /grueso/.test(t) ? '#6a4224' : '#9a6a3a', c: '#d8b080' }, o: { leather: true } };
    if (/piel/.test(t)) {
      const col = /lobo/.test(t) ? ['#7a8290', '#c0c8d0'] : /oso/.test(t) ? ['#6a4a2a', '#9a7a5a'] : /anfibio/.test(t) ? ['#5a8a3a', '#a0c070'] : ['#9a7a5a', '#c8a880'];
      return { shape: 'pelt', p: { b: col[0], c: col[1] } };
    }
    if (/hilo/.test(t)) return { shape: 'fabric', p: { b: '#d0c0a0', wd: '#8a5a30' }, o: { spool: true } };
    if (/vendaje|venda/.test(t)) return { shape: 'fabric', p: { b: '#f0ece0', c: '#d8d0c0', r: '#c03030' }, o: { bandage: true } };
    if (/seda/.test(t)) return { shape: 'fabric', p: { b: '#e0d0f0', c: '#ffffff', hl: '#ffffff' }, o: { shiny: true } };
    if (/tela/.test(t)) return { shape: 'fabric', p: { b: '#c8b890', c: '#e8dcc0' } };
    // madera y raíces
    if (/mandr[aá]gora/.test(t)) return { shape: 'log', p: { b: '#b08a5a', a: '#4a9a3a' }, o: { root: true, face: true } };
    if (/ra[ií]z/.test(t)) return { shape: 'log', p: { b: '#7a5a8a', g: '#c090ff' }, o: { root: true } };
    if (/madera|tronco|rama/.test(t)) return { shape: 'log', p: { b: '#7a5430', c: '#c8a070' } };
    // plantas
    if (/loto/.test(t)) return { shape: 'plant', p: { b: /negro/.test(t) ? '#3a2a4a' : '#f0a0c0', c: '#e0c040', a: '#3a7a3a' }, o: { kind: 'lotus' } };
    if (/carmes/.test(t)) return { shape: 'plant', p: { b: '#b01a2a', c: '#e05060', a: '#2a4a2a' }, o: { kind: 'flower' } };
    if (/flor del sue/.test(t)) return { shape: 'plant', p: { b: '#c8b8f0', c: '#fff6c0', a: '#3a6a5a' }, o: { kind: 'flower' } };
    if (/flor/.test(t)) return { shape: 'plant', p: { b: /man[aá]/.test(t) ? '#5a8af0' : '#f0d040', c: /man[aá]/.test(t) ? '#e0f0ff' : '#e07a20', a: '#3a8a3a' }, o: { kind: 'flower' } };
    if (/espiga|trigo/.test(t)) return { shape: 'plant', p: { b: '#e0b840', a: '#a08a3a' }, o: { kind: 'wheat' } };
    if (/hierba|hoja|planta/.test(t)) return { shape: 'plant', p: { b: /curativa/.test(t) ? '#4ab04a' : '#6a9a3a', a: '#3a6a2a', wd: '#a0784a' } };
    // por tipo
    if (sub === 'food') return { shape: 'meat', p: { b: '#a8483a', c: '#e09a80', t: '#f0e8d0' }, o: { bone: true } };
    if (sub === 'tame') return { shape: 'plant', p: { b: '#d8b860', wd: '#a0784a' }, o: { kind: 'seeds' } };
    if (el) return { shape: 'essence', p: { b: el.e, c: el.c, g: el.g } };
    return { shape: 'rock', p: { b: '#8a7a68', c: '#b0a088' } };
  }

  /** Forma y colores de cualquier ítem (arma, armadura, objeto o mochila). */
  function shapeOf(item) {
    if (!item) return null;
    const t = `${item.name || ''} ${item.id || ''}`.toLowerCase().replace(/_/g, ' ');
    let sh;
    if (item.type === 'weapon' || item.damage != null && item.defense == null && item.type !== 'item') sh = weaponShape(item, t);
    else if (item.type === 'armor' || item.defense != null) sh = armorShape(item, t);
    else if (item.slots != null && !item.subtype) sh = itemShape({ ...item, subtype: 'bag' }, t);
    else sh = itemShape(item, t);
    return { shape: sh.shape, p: sh.p || {}, o: sh.o || {} };
  }

  // ============================================================
  // API
  // ============================================================

  function resolveItem(itemOrId) {
    if (!itemOrId) return null;
    if (typeof itemOrId !== 'string') return itemOrId;
    if (A.Inventory && A.Inventory.resolveData) {
      const r = A.Inventory.resolveData(itemOrId);
      if (r) return r;
    }
    if (A.Data && A.Data.getById) {
      return A.Data.getById('items', itemOrId) || A.Data.getById('weapons', itemOrId)
        || A.Data.getById('armors', itemOrId) || A.Data.getById('bags', itemOrId) || null;
    }
    return null;
  }

  function dataUrl(itemOrId) {
    const it = resolveItem(itemOrId);
    if (!it) return '';
    const sh = shapeOf(it);
    const draw = SHAPES[sh.shape] || SHAPES.rock;
    const key = JSON.stringify(sh);
    return renderCustom(key, (P) => draw(P, sh.o), { b: '#8a7a68', ...sh.p });
  }

  function html(itemOrId, opts = {}) {
    const url = dataUrl(itemOrId);
    if (!url) {
      const it = resolveItem(itemOrId);
      return it && it.icon ? `<span class="item-emoji">${it.icon}</span>` : '';
    }
    return imgTag(url, opts.size || 32, ['px-item', opts.cls || ''].filter(Boolean).join(' '));
  }

  // ============================================================
  // Íconos de interfaz (reemplazan a los emojis)
  // ============================================================

  const ICONS = {
    // efectos de estado
    bleed: { p: { b: '#c8202a', c: '#ff7a7a', hl: '#ffffff' }, d: (P) => { P.poly([[16, 3], [24, 17], [16, 29], [8, 17]], 'b'); P.ell(16, 20, 8, 8.5, 'b'); P.line([[12, 15], [11, 21]], 0.7, 0.7, 'c'); P.put(12, 22, 'hl'); } },
    poison: { p: { b: '#4aa82a', c: '#a8f070', k: '#1a3a10', hl: '#ffffff' }, d: (P) => { P.ell(16, 18, 10, 10, 'b'); P.ell(16, 18, 6, 6, 'c'); P.ell(13, 16, 1.6, 1.8, 'k'); P.ell(19, 16, 1.6, 1.8, 'k'); P.rect(14, 21, 4, 1.4, 'k'); P.dot(24, 7, 2.2, 'b'); P.dot(27, 3, 1.4, 'c'); } },
    fire: { p: { b: '#e8501a', c: '#ffb030', f: '#fff2a0' }, d: (P) => { P.poly([[16, 2], [23, 12], [26, 20], [22, 28], [10, 28], [6, 20], [9, 12], [12, 15]], 'b'); P.poly([[16, 10], [21, 18], [19, 26], [13, 26], [11, 19]], 'c'); P.poly([[16, 17], [18.5, 22], [16, 25.5], [13.5, 22]], 'f'); } },
    cold: { p: { b: '#7ac8f0', c: '#e0f6ff' }, d: (P) => { for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; P.line([[16 - Math.cos(a) * 13, 16 - Math.sin(a) * 13], [16 + Math.cos(a) * 13, 16 + Math.sin(a) * 13]], 1.4, 1.4, 'b'); } for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const x = 16 + Math.cos(a) * 9, y = 16 + Math.sin(a) * 9; P.line([[x, y], [x + Math.cos(a + 0.9) * 3.5, y + Math.sin(a + 0.9) * 3.5]], 0.8, 0.8, 'b'); P.line([[x, y], [x + Math.cos(a - 0.9) * 3.5, y + Math.sin(a - 0.9) * 3.5]], 0.8, 0.8, 'b'); } P.dot(16, 16, 2.4, 'c'); } },
    shock: { p: { b: '#f0c820', c: '#fff6b0' }, d: (P) => { P.poly([[19, 2], [8, 18], [15, 18], [12, 30], [25, 12], [18, 12], [22, 2]], 'b'); P.line([[18, 5], [11, 16]], 0.6, 0.6, 'c'); } },
    blind: { p: { b: '#6a6a78', c: '#a8a8b8', k: '#1a1a22' }, d: (P) => { P.ell(16, 16, 13, 8, 'c'); P.ell(16, 16, 5, 5, 'b'); P.dot(16, 16, 2, 'k'); P.line([[4, 27], [28, 5]], 1.4, 1.4, 'k'); } },
    silence: { p: { b: '#e8e0d0', c: '#c8b8a0', k: '#3a2a2a', r: '#c03030' }, d: (P) => { P.ell(16, 14, 13, 10, 'b'); P.poly([[9, 22], [7, 30], [15, 23]], 'b'); P.rect(9, 13, 14, 2.4, 'k'); P.line([[5, 5], [27, 26]], 1.3, 1.3, 'r'); } },
    // acciones
    swords: { p: { m: '#c8d0d8', c: '#ffffff', a: '#c9a24a', wd: '#7a4a2a' }, d: (P) => {
      for (const d of [-1, 1]) {
        const x0 = 16 - d * 9, x1 = 16 + d * 9;
        P.line([[x0, 25], [x1, 5]], 1.3, 0.5, 'm');
        P.line([[x0 - d * 3, 21.5], [x0 + d * 3, 26.5]], 1.1, 1.1, 'a');
        P.line([[x0, 25.5], [x0 - d * 3, 29]], 1.1, 1.1, 'wd');
      }
    } },
    fist: { p: { b: '#e0b08a', c: '#f4d0b0', o: '#5a3a20' }, d: (P) => { P.rect(7, 10, 18, 14, 'b'); P.ell(16, 10, 9, 4, 'b'); for (const x of [11, 15, 19]) P.line([[x, 7], [x, 15]], 0.4, 0.4, 'o'); P.rect(9, 24, 14, 6, 'b'); P.ell(8, 18, 3, 5, 'c'); } },
    spell: { p: { b: '#7a4ae0', c: '#d8c8ff', g: '#ffffff', a: '#e0c060' }, d: (P) => { P.poly([[16, 2], [19, 12], [30, 12], [21, 18.5], [24.5, 29], [16, 22.5], [7.5, 29], [11, 18.5], [2, 12], [13, 12]], 'b'); P.poly([[16, 8], [18, 14], [24, 14], [19, 17.5], [21, 23.5], [16, 20], [11, 23.5], [13, 17.5], [8, 14], [14, 14]], 'c'); P.dot(16, 16, 1.6, 'g'); } },
    paw: { p: { b: '#8a5a32', c: '#c08a5a' }, d: (P) => { P.ell(16, 21, 7.5, 6.5, 'b'); for (const [x, y] of [[7, 12], [12.5, 7], [19.5, 7], [25, 12]]) P.ell(x, y, 3, 3.6, 'b'); P.ell(15, 19, 3, 2, 'c'); } },
    boot: { p: { b: '#7a4a2a', c: '#a8784a', a: '#c9a24a' }, d: (P) => { P.poly([[9, 3], [19, 3], [19, 19], [28, 22], [28, 28], [6, 28], [8, 18]], 'b'); P.rect(9, 6, 10, 2, 'c'); P.rect(6, 26, 22, 2.5, 'a'); for (const [x, y] of [[4, 10], [2, 15], [4, 20]]) P.line([[x, y], [x - 3, y]], 0.6, 0.6, 'c'); } },
    potion: { p: { b: '#d02a2a', c: '#ff7a6a', gl: '#dfe9ee', wd: '#8a5a30', hl: '#ffffff' }, d: (P) => potion(P, { shape: 'round' }) },
    shield: { p: { m: '#a8b0ba', c: '#e0e6ec', a: '#c9a24a' }, d: (P) => { P.poly([[5, 4], [27, 4], [26, 17], [16, 29], [6, 17]], 'm'); P.poly([[9, 7], [23, 7], [22, 16], [16, 24], [10, 16]], 'c'); P.line([[16, 7], [16, 23]], 0.7, 0.7, 'a'); } },
    // resultados
    trophy: { p: { b: '#e0b030', c: '#fff0a0', wd: '#6a4a2a' }, d: (P) => { P.poly([[7, 3], [25, 3], [24, 13], [16, 20], [8, 13]], 'b'); P.line(bez([7, 6], [1, 6], [2, 14], [9, 13], 6), 0.9, 0.9, 'b'); P.line(bez([25, 6], [31, 6], [30, 14], [23, 13], 6), 0.9, 0.9, 'b'); P.rect(14, 19, 4, 4, 'b'); P.rect(9, 23, 14, 3, 'b'); P.rect(8, 26, 16, 3.5, 'wd'); P.line([[11, 6], [12, 12]], 0.6, 0.6, 'c'); } },
    skull: { p: { t: '#e8e0c8', k: '#1a120a' }, d: (P) => bone(P, { skull: true }) },
    heart: { p: { b: '#d0303a', c: '#ff9a9a' }, d: (P) => essence(P, { kind: 'heart' }) },
    star: { p: { b: '#f0c030', c: '#fff4b0' }, d: (P) => { P.poly([[16, 2], [19.5, 12], [30, 12.5], [21.5, 19], [24.5, 29.5], [16, 23.5], [7.5, 29.5], [10.5, 19], [2, 12.5], [12.5, 12]], 'b'); P.poly([[16, 8], [18, 14], [16, 19], [14, 14]], 'c'); } },
    coin: { p: { b: '#c87a3a', c: '#f0b080' }, d: (P) => { P.ell(16, 16, 12, 12, 'b'); P.ell(16, 16, 8.5, 8.5, 'c'); P.rect(15, 10, 2, 12, 'b~'); P.put(11, 9, 'hl'); } },
    xp: { p: { b: '#8a5ae0', c: '#e0d0ff', g: '#ffffff' }, d: (P) => { P.poly([[16, 2], [22, 16], [16, 30], [10, 16]], 'b'); P.poly([[2, 16], [16, 11], [30, 16], [16, 21]], 'b'); P.dot(16, 16, 4, 'c'); P.dot(16, 16, 1.6, 'g'); } },
    up: { p: { b: '#4ab04a', c: '#a8f0a0' }, d: (P) => { P.poly([[16, 2], [29, 15], [21, 15], [21, 29], [11, 29], [11, 15], [3, 15]], 'b'); P.poly([[16, 6], [23, 13], [16, 13]], 'c'); } },
    // hechizos
    spark: { p: { b: '#f0c820', c: '#fff6b0', g: '#ffffff' }, d: (P) => { P.poly([[16, 1], [19, 13], [31, 16], [19, 19], [16, 31], [13, 19], [1, 16], [13, 13]], 'b'); P.dot(16, 16, 3, 'c'); P.dot(16, 16, 1.4, 'g'); } },
    ice: { p: { b: '#6ab8f0', c: '#e0f6ff', hl: '#ffffff' }, d: (P) => { crystal(P); } },
    heal: { p: { b: '#3aa83a', c: '#a8f0a0', hl: '#ffffff' }, d: (P) => { P.rect(11, 3, 10, 26, 'b'); P.rect(3, 11, 26, 10, 'b'); P.rect(13.5, 5, 5, 21, 'c'); P.rect(5, 13.5, 21, 5, 'c'); } },
    arcane: { p: { b: '#6a40c0', c: '#c8a8ff', g: '#ffffff' }, d: (P) => essence(P, {}) },
    storm: { p: { b: '#4a4a6a', c: '#8a8aa8', g: '#fff070' }, d: (P) => { P.ell(12, 11, 8, 6, 'c'); P.ell(21, 10, 8, 7, 'c'); P.ell(16, 14, 11, 5, 'b'); P.poly([[17, 16], [11, 25], [16, 25], [13, 31], [22, 21], [17, 21], [20, 16]], 'g'); } },
    breath: { p: { b: '#e8501a', c: '#ffb030', f: '#fff2a0' }, d: (P) => { P.poly([[2, 16], [12, 8], [30, 3], [24, 12], [31, 16], [24, 20], [30, 29], [12, 24]], 'b'); P.poly([[6, 16], [14, 11], [24, 9], [20, 16], [24, 23], [14, 21]], 'c'); P.dot(10, 16, 2.4, 'f'); } },
    fireball: { p: { b: '#e8501a', c: '#ffb030', f: '#fff2a0' }, d: (P) => { P.poly([[30, 2], [22, 14], [27, 13], [18, 22], [12, 30]], 'b'); P.ell(12, 20, 9, 9, 'b'); P.ell(11, 21, 6, 6, 'c'); P.ell(10, 22, 3, 3, 'f'); } },
    book: { p: { b: '#7a2a2a', c: '#f0e2c0', a: '#e0c060' }, d: (P) => { P.rect(5, 4, 22, 25, 'b'); P.rect(7, 26, 20, 3, 'c'); P.rect(9, 9, 14, 8, 'a'); P.rect(11, 11, 10, 4, 'b'); } },
    // dado de 20 caras (el número se pone encima con HTML)
    d20: { p: { b: '#e8d6a8', c: '#fff4d6', k: '#6a4a1a' }, d: (P) => {
      P.poly([[16, 1.5], [29, 9], [29, 23], [16, 30.5], [3, 23], [3, 9]], 'b');
      P.poly([[16, 8], [25, 22], [7, 22]], 'c');
      P.line([[3, 9], [16, 8], [29, 9]], 0.45, 0.45, 'k');
      P.line([[16, 1.5], [16, 8]], 0.45, 0.45, 'k');
      P.line([[29, 9], [25, 22], [29, 23]], 0.45, 0.45, 'k');
      P.line([[3, 9], [7, 22], [3, 23]], 0.45, 0.45, 'k');
      P.line([[7, 22], [16, 30.5], [25, 22]], 0.45, 0.45, 'k');
    } },
    // ---------- v2.0: zonas del mapa ----------
    'biome-village': { p: { rf: '#b0452e', w: '#ead9b6', d: '#6a4a2a', y: '#ffd860', gr: '#6a9a3a' }, d: (P) => {
      P.rect(1, 25, 30, 4, 'gr');
      P.rect(5, 16, 11, 10, 'w'); P.poly([[3, 17], [10.5, 9], [18, 17]], 'rf'); P.rect(8.5, 20, 3, 6, 'd');
      P.rect(17, 13, 11, 13, 'w'); P.poly([[15, 14], [22.5, 5.5], [30, 14]], 'rf'); P.rect(20, 17, 3, 3, 'y'); P.rect(24.5, 17, 2, 3, 'y');
      P.rect(25, 3, 2, 4, 'd');
    } },
    'biome-forest': { p: { b: '#3a7a3a', b2: '#2e6a32', wd: '#6a4a2a', gr: '#4a7a2a' }, d: (P) => {
      P.rect(1, 27, 30, 3, 'gr');
      for (const [x, top, k] of [[8, 9, 'b2'], [24, 7, 'b2'], [16, 3, 'b']]) {
        P.poly([[x, top], [x - 5.5, top + 8], [x + 5.5, top + 8]], k);
        P.poly([[x, top + 5], [x - 7, top + 15], [x + 7, top + 15]], k);
        P.rect(x - 1, top + 15, 2, 4, 'wd');
      }
    } },
    'biome-graveyard': { p: { s: '#a0a6ae', s2: '#8a9098', k: '#4a4e56', gr: '#5a6a3a' }, d: (P) => {
      P.rect(1, 26, 30, 4, 'gr');
      P.ell(11, 13, 6.5, 6.5, 's'); P.rect(4.5, 13, 13, 14, 's'); P.rect(7.5, 15, 7, 1.4, 'k'); P.rect(8.5, 18, 5, 1.4, 'k');
      P.rect(23, 8, 3, 19, 's2'); P.rect(19, 12, 11, 3, 's2');
    } },
    'biome-plains': { p: { gr: '#7aa04a', rd: '#d2b88e', wd: '#6a4a2a', wb: '#b07e4a', sky: '#bcd8e8' }, d: (P) => {
      P.rect(1, 13, 30, 16, 'gr');
      P.poly([[9, 29], [21, 29], [17.2, 13], [14.8, 13]], 'rd');
      P.rect(24, 6, 2, 17, 'wd');
      P.poly([[18, 6], [29, 6], [31.5, 8.5], [29, 11], [18, 11]], 'wb');
    } },
    'biome-swamp': { p: { w: '#4a6a5a', g: '#6a8a3a', br: '#6a4a2a', lp: '#7aa84a' }, d: (P) => {
      P.ell(16, 24, 14.5, 6, 'w');
      for (const [x, top] of [[7, 9], [11, 6], [25, 10]]) { P.line([[x, 24], [x - 0.5, top]], 0.6, 0.45, 'g'); P.ell(x - 0.5, top + 2, 1.4, 3, 'br'); }
      P.ell(19, 24, 3.5, 1.6, 'lp'); P.ell(14, 26.5, 2.4, 1.1, 'lp');
    } },
    'biome-coast': { p: { m: '#5e6e7e', w: '#4a8ac0', k: '#2a3440' }, d: (P) => {
      P.ell(16, 6, 3.4, 3.4, 'm'); P.dot(16, 6, 1.3, 'k');
      P.rect(14.8, 8, 2.4, 18, 'm'); P.rect(9, 11, 14, 2.4, 'm');
      P.line([[6, 19], [8.5, 24.5], [16, 27], [23.5, 24.5], [26, 19]], 1.2, 1.2, 'm');
      P.poly([[3.5, 17.5], [8.5, 17.5], [6, 21.5]], 'm'); P.poly([[23.5, 17.5], [28.5, 17.5], [26, 21.5]], 'm');
      P.line([[2, 30], [6, 28.5], [10, 30], [14, 28.5], [18, 30], [22, 28.5], [26, 30], [30, 28.5]], 0.7, 0.7, 'w');
    } },
    'biome-arcane': { p: { s: '#8e8eae', rf: '#5a3a9a', y: '#ffe070', d: '#2e2440' }, d: (P) => {
      P.rect(10.5, 11, 11, 19, 's');
      P.poly([[8.5, 12], [16, 1.5], [23.5, 12]], 'rf');
      P.rect(14.5, 15, 3, 4, 'y'); P.rect(14, 24, 4, 6, 'd');
      P.put(15.5, 0.5, 'y'); P.put(26, 4, 'y'); P.put(5, 7, 'y');
    } },
    'biome-mountain': { p: { m: '#7c7c8e', m2: '#6a6a7c', sn: '#f4f4f8' }, d: (P) => {
      P.poly([[0.5, 29], [11, 8], [21.5, 29]], 'm');
      P.poly([[11, 8], [7.2, 15.5], [10, 14], [12.5, 16], [14.6, 13]], 'sn');
      P.poly([[11, 29], [22, 3.5], [31.5, 29]], 'm2');
      P.poly([[22, 3.5], [17.6, 12], [20.6, 10.4], [23.4, 12.4], [26.2, 9.6]], 'sn');
    } },
    'biome-desert': { p: { y: '#ffd040', s: '#e2bc66', s2: '#d0a650', c: '#4a8a3a' }, d: (P) => {
      P.dot(24, 8, 4.5, 'y');
      P.ell(10, 30, 15, 8, 's'); P.ell(27, 31, 12, 6.5, 's2');
      P.rect(10, 11, 3.2, 13, 'c'); P.rect(6, 14, 2.4, 6, 'c'); P.rect(6, 18.5, 5, 2.2, 'c'); P.rect(15, 12.5, 2.4, 6, 'c'); P.rect(12, 16.5, 5, 2.2, 'c');
    } },
    'biome-ruins': { p: { s: '#cbbb9b', s2: '#a89878', g: '#5a8a3a' }, d: (P) => {
      P.rect(4.5, 10, 5, 18, 's'); P.rect(3.5, 8, 7, 2.6, 's');
      P.rect(14, 17, 5, 11, 's'); P.poly([[13.5, 17], [19.5, 13.5], [19.5, 17]], 's');
      P.rect(23, 12, 5, 16, 's'); P.rect(22, 10, 7, 2.6, 's');
      P.rect(7, 27, 10, 3, 's2'); P.line([[6, 12], [8, 18], [6, 24]], 0.5, 0.5, 'g'); P.line([[25, 13], [27, 20]], 0.5, 0.5, 'g');
    } },
    'biome-crypt': { p: { s: '#7e786c', k: '#18120e', t: '#ece4cc' }, d: (P) => {
      P.ell(16, 13, 12, 9, 's'); P.rect(4, 13, 24, 17, 's');
      P.ell(16, 18, 6, 5, 'k'); P.rect(10, 18, 12, 12, 'k');
      P.ell(16, 7.5, 3.2, 3, 't'); P.rect(14.6, 9.4, 2.8, 1.6, 't'); P.put(14.8, 7, 'k'); P.put(16.6, 7, 'k');
    } },
    'biome-cave': { p: { r: '#7c6c5a', r2: '#6a5a4a', k: '#160f0a' }, d: (P) => {
      P.ell(16, 21, 15.5, 11, 'r'); P.ell(9, 13, 6, 5, 'r2'); P.ell(23, 12, 7, 5.5, 'r2');
      P.ell(16, 25, 8, 7.5, 'k'); P.rect(8, 25, 16, 6, 'k');
      P.poly([[12, 18], [13.5, 18], [12.8, 21]], 'r'); P.poly([[18, 18], [19.6, 18], [18.8, 22]], 'r');
    } },
    'biome-sea': { p: { wd: '#7a4a2a', sl: '#f2ecda', w: '#3a7ab8', w2: '#2e6aa6' }, d: (P) => {
      P.rect(1, 24, 30, 7, 'w');
      P.poly([[5, 19], [27, 19], [23, 24.5], [9, 24.5]], 'wd');
      P.line([[16, 4], [16, 19]], 0.6, 0.6, 'wd');
      P.poly([[16.6, 5], [25, 16.5], [16.6, 16.5]], 'sl'); P.poly([[15.4, 7], [9, 16.5], [15.4, 16.5]], 'sl');
      P.line([[2, 28], [6, 26.6], [10, 28], [14, 26.6], [18, 28], [22, 26.6], [26, 28], [30, 26.6]], 0.6, 0.6, 'w2');
    } },
    'biome-volcano': { p: { r: '#5c4238', l: '#ff7a20', y: '#ffd040', sm: '#9a9aa2' }, d: (P) => {
      P.poly([[1, 30], [12, 11], [20, 11], [31, 30]], 'r');
      P.ell(16, 11, 4.6, 1.8, 'l'); P.line([[14.4, 12], [12.6, 19], [13.6, 25]], 1, 0.6, 'l'); P.line([[18, 12], [19.4, 17]], 0.8, 0.5, 'l');
      P.dot(16, 9.5, 1.2, 'y');
      P.ell(18.5, 6, 3.2, 2.3, 'sm'); P.ell(22.5, 3.2, 2.6, 1.9, 'sm');
    } },
    'biome-hell': { p: { f: '#d8381a', y: '#ffb030', w: '#fff0a0' }, d: (P) => {
      P.poly([[5, 30], [3, 18], [8.5, 22], [9.5, 9], [14.5, 19], [16, 2.5], [19, 17.5], [22.5, 8], [24, 21], [29, 15], [27.5, 30]], 'f');
      P.poly([[9, 30], [8.5, 22], [12, 25], [13, 15], [16, 23], [18.5, 13], [20, 24], [24, 20], [23, 30]], 'y');
      P.ell(16, 28, 4, 2, 'w');
    } },
    'biome-lair': { p: { n: '#7a5a3a', n2: '#5a4028', e1: '#c84a2a', e2: '#e8a030', sp: '#ffe070' }, d: (P) => {
      P.ell(16, 25.5, 14, 5, 'n'); P.line([[3, 24], [9, 22], [15, 24], [21, 22], [29, 24]], 0.6, 0.6, 'n2');
      P.ell(11, 18.5, 4.5, 6, 'e1'); P.ell(21.5, 17.5, 4.5, 6.4, 'e2');
      P.put(10, 16, 'sp'); P.put(12, 20, 'sp'); P.put(21, 15, 'n2'); P.put(23, 19, 'n2');
    } },
    'biome-abyss': { p: { w: '#1e4466', k: '#0a1a2a', t: '#8a4a9a', t2: '#b07ac0' }, d: (P) => {
      P.ell(16, 18, 14.5, 11, 'w');
      const sp = [];
      for (let i = 0; i <= 30; i++) { const a = i * 0.42; const r = 10 - i * 0.3; sp.push([16 + Math.cos(a) * r, 18 + Math.sin(a) * r * 0.7]); }
      P.line(sp, 0.7, 0.7, 'k');
      P.line(bez([24, 29], [29, 22], [22, 15], [27, 6], 10), 1.6, 0.5, 't');
      P.put(25, 18, 't2'); P.put(26, 13, 't2');
    } },
    // ---------- v2.0: interfaz ----------
    search: { p: { m: '#8a8a96', gl: '#c4e4f2', wd: '#7a4a2a' }, d: (P) => {
      P.line([[19, 19], [28, 28]], 1.9, 1.7, 'wd');
      P.ell(13, 13, 9, 9, 'm'); P.ell(13, 13, 6.2, 6.2, 'gl'); P.put(10, 9, 'hl');
    } },
    moon: { p: { y: '#f2dc8c', y2: '#e2c46a' }, d: (P) => {
      const pts = [];
      for (let a = 50; a <= 310; a += 10) { const r = a * Math.PI / 180; pts.push([16 + Math.cos(r) * 12.5, 16 + Math.sin(r) * 12.5]); }
      for (let a = 290; a >= 70; a -= 10) { const r = a * Math.PI / 180; pts.push([21 + Math.cos(r) * 9.5, 14 + Math.sin(r) * 9.5]); }
      P.poly(pts, 'y'); P.put(10, 12, 'y2'); P.put(12, 20, 'y2');
    } },
    sun: { p: { y: '#ffd040', y2: '#ffb020' }, d: (P) => {
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; P.line([[16 + Math.cos(a) * 9, 16 + Math.sin(a) * 9], [16 + Math.cos(a) * 14, 16 + Math.sin(a) * 14]], 1, 0.5, 'y2'); }
      P.dot(16, 16, 7.5, 'y');
    } },
    map: { p: { pp: '#efe0b8', pp2: '#d8c49a', r: '#c03a2a', k: '#6a4a2a' }, d: (P) => {
      P.poly([[3, 7], [11, 4], [21, 7], [29, 4], [29, 25], [21, 28], [11, 25], [3, 28]], 'pp');
      P.poly([[11, 4], [21, 7], [21, 28], [11, 25]], 'pp2');
      P.line([[6, 22], [10, 17], [15, 18], [19, 13]], 0.45, 0.45, 'k');
      P.line([[21, 9], [25, 13]], 0.8, 0.8, 'r'); P.line([[25, 9], [21, 13]], 0.8, 0.8, 'r');
    } },
    scroll: { p: { pp: '#f0e2bc', pp2: '#d8c49a', k: '#6a4a2a', r: '#b8302a' }, d: (P) => {
      P.rect(7, 6, 18, 20, 'pp');
      P.ell(16, 6, 10.5, 2.6, 'pp2'); P.ell(16, 26, 10.5, 2.6, 'pp2');
      for (const y of [10, 13.5, 17]) P.rect(10, y, 12, 1, 'k');
      P.dot(21, 21.5, 2.6, 'r');
    } },
    anvil: { p: { m: '#6e7680', m2: '#565e68', wd: '#7a4a2a' }, d: (P) => {
      P.poly([[3, 10], [9, 10], [10, 12], [27, 12], [27, 16], [21, 16], [18.5, 20], [21, 25], [11, 25], [13.5, 20], [11, 16], [8, 16], [3, 13]], 'm');
      P.rect(9, 25, 14, 4, 'm2');
    } },
    campfire: { p: { wd: '#7a4a2a', f: '#ff7a20', y: '#ffd040', s: '#8a8a90' }, d: (P) => {
      P.line([[5, 27], [27, 22]], 1.5, 1.5, 'wd'); P.line([[5, 22], [27, 27]], 1.5, 1.5, 'wd');
      P.poly([[9, 23], [11, 13], [14, 17], [16, 6], [19, 16], [22, 12], [23, 23]], 'f');
      P.poly([[12.5, 23], [14, 17.5], [16, 20], [18, 15], [19.5, 23]], 'y');
      for (const x of [4, 28]) P.dot(x, 28.5, 1.6, 's');
    } },
    chest: { p: { wd: '#8a5a2a', wd2: '#6a4220', a: '#d4a42c', k: '#2a1a0a' }, d: (P) => {
      P.rect(4, 14, 24, 13, 'wd'); P.ell(16, 14, 12, 6, 'wd2'); P.rect(4, 13, 24, 2, 'a');
      P.rect(4, 14, 2, 13, 'a'); P.rect(26, 14, 2, 13, 'a');
      P.rect(14, 15, 4, 5, 'a'); P.put(15.5, 17, 'k');
    } },
    key: { p: { a: '#d4a42c', k: '#2a1a0a' }, d: (P) => {
      P.ell(9, 12, 6, 6, 'a'); P.dot(9, 12, 2.2, 'k');
      P.line([[13, 16], [26, 27]], 1.3, 1.3, 'a');
      P.line([[21, 23], [18, 26.5]], 0.9, 0.9, 'a'); P.line([[24, 25.5], [21.5, 28.5]], 0.9, 0.9, 'a');
    } },
    trap: { p: { m: '#8a929c', k: '#3a3e44' }, d: (P) => {
      P.ell(16, 24, 13, 4.5, 'k');
      for (let i = 0; i < 6; i++) { const x = 6 + i * 4; P.poly([[x - 2, 22], [x, 13], [x + 2, 22]], 'm'); }
      P.rect(4, 21.5, 24, 2.5, 'm');
    } },
    herb: { p: { g: '#4a9a3a', g2: '#78c058', wd: '#5a7a2a' }, d: (P) => {
      P.line(bez([16, 30], [16, 22], [15, 14], [16, 4], 8), 0.6, 0.5, 'wd');
      for (const [x, y, d] of [[16, 9, -1], [16, 13, 1], [16, 18, -1], [16, 22, 1]]) P.ell(x + d * 5, y, 5, 2.4, d < 0 ? 'g' : 'g2');
    } },
    tracks: { p: { k: '#5a3a1a' }, d: (P) => {
      for (const [x, y] of [[9, 24], [20, 14]]) {
        P.ell(x, y, 3.4, 3, 'k');
        for (const [dx, dy] of [[-3.5, -4], [-1.2, -5.6], [1.2, -5.6], [3.5, -4]]) P.dot(x + dx, y + dy, 1.2, 'k');
      }
    } },
    eye: { p: { w: '#f4efe0', b: '#3a6ab8', k: '#121212' }, d: (P) => {
      P.ell(16, 16, 13, 8, 'w'); P.dot(16, 16, 5, 'b'); P.dot(16, 16, 2.2, 'k'); P.put(14, 13.5, 'hl');
    } },
    lock: { p: { m: '#9aa2ac', a: '#c9a24a', k: '#2a1a0a' }, d: (P) => {
      P.line([[10, 15], [10, 10], [13, 6], [19, 6], [22, 10], [22, 15]], 1.3, 1.3, 'm');
      P.rect(6, 14, 20, 15, 'a'); P.dot(16, 20, 2, 'k'); P.rect(15.3, 21, 1.4, 4, 'k');
    } },
    quest: { p: { y: '#ffd040', y2: '#e8a820' }, d: (P) => {
      P.poly([[13, 3], [19, 3], [18, 21], [14, 21]], 'y'); P.rect(13.5, 24, 5, 5, 'y2');
    } },
    check: { p: { g: '#3aa83a' }, d: (P) => { P.line([[5, 16], [13, 24], [27, 8]], 2.2, 2.2, 'g'); } },
    talk: { p: { w: '#f4efe0', k: '#6a4a2a' }, d: (P) => {
      P.ell(16, 13, 13, 9.5, 'w'); P.poly([[9, 19], [7, 28], [16, 21]], 'w');
      for (const x of [10, 16, 22]) P.dot(x, 13, 1.6, 'k');
    } },
    bag: { p: { b: '#8a5a32', c: '#b07a48', a: '#d4a42c' }, d: (P) => {
      P.ell(16, 20, 11, 9.5, 'b'); P.rect(11, 6, 10, 6, 'b'); P.rect(10, 10, 12, 2.4, 'a'); P.ell(13, 18, 3, 2.4, 'c');
    } },
    run: { p: { b: '#c8b088', k: '#6a4a2a' }, d: (P) => {
      for (const [y, w] of [[10, 14], [16, 20], [22, 12]]) P.line([[30 - w, y], [30, y]], 0.8, 0.8, 'k');
      P.dot(9, 16, 5, 'b');
    } },
    skulls: { p: { t: '#e8e0c8', k: '#1a120a' }, d: (P) => {
      for (const [x, y, r] of [[10, 13, 6], [22, 13, 6], [16, 21, 6.5]]) {
        P.ell(x, y, r, r * 0.95, 't'); P.dot(x - r * 0.4, y, 1.4, 'k'); P.dot(x + r * 0.4, y, 1.4, 'k');
      }
    } },
    // pasivas de raza (v1.9.2)
    target: { p: { b: '#c83a30', c: '#f4ece0', k: '#4a3020', f: '#e8e0d0' }, d: (P) => {
      P.ell(15, 17, 12.5, 12.5, 'b'); P.ell(15, 17, 9, 9, 'c'); P.ell(15, 17, 5.6, 5.6, 'b'); P.ell(15, 17, 2.4, 2.4, 'c');
      P.line([[15, 17], [28, 4]], 0.7, 0.7, 'k'); P.poly([[25.5, 2.5], [30, 2], [29.5, 6.5]], 'f');
    } },
    clover: { p: { b: '#3a9a3a', c: '#8ad87a', wd: '#2a6a2a' }, d: (P) => {
      for (const [x, y] of [[10.5, 10.5], [21.5, 10.5], [10.5, 21.5], [21.5, 21.5]]) P.ell(x, y, 6.2, 6.2, 'b');
      for (const [x, y] of [[9, 9], [20, 9], [9, 20], [20, 20]]) P.dot(x, y, 1.6, 'c');
      P.ell(16, 16, 2.6, 2.6, 'c');
      P.line([[20, 20], [27, 30]], 1, 0.7, 'wd');
    } },
    gear: { p: { m: '#9aa4b0', c: '#dfe5ec', k: '#2a2f36' }, d: (P) => {
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; P.dot(16 + Math.cos(a) * 11.6, 16 + Math.sin(a) * 11.6, 3.3, 'm'); }
      P.ell(16, 16, 10.4, 10.4, 'm'); P.ell(16, 16, 6.4, 6.4, 'c'); P.ell(16, 16, 3.2, 3.2, 'k');
    } },
    hammer: { p: { m: '#a8b0ba', c: '#e6ebf0', wd: '#7a4a2a', a: '#c9a24a' }, d: (P) => {
      P.line([[7, 29], [18, 12]], 1.3, 1.1, 'wd');
      P.poly([[12, 3.5], [28, 12], [24.5, 18.5], [8.5, 10]], 'm');
      P.line([[13, 5.5], [26.5, 12.8]], 0.6, 0.6, 'c');
      P.line([[16.5, 13], [20, 15]], 0.9, 0.9, 'a');
    } },
    // ---------- v2.1: biomas nuevos ----------
    'biome-dream': { p: { b: '#5a4aa8', b2: '#7a62c8', g: '#9af0d0', wd: '#4a3a6a', gr: '#3a7a6a', y: '#fff6b0' }, d: (P) => {
      P.rect(1, 27, 30, 3, 'gr');
      P.rect(14.6, 14, 2.8, 14, 'wd');
      P.ell(16, 11, 11, 7.5, 'b'); P.ell(10, 13, 6, 4.5, 'b2'); P.ell(22.5, 12.5, 6, 4.5, 'b2'); P.ell(16, 6.5, 6.5, 4.2, 'b2');
      for (const [x, y] of [[6, 21], [25, 19], [11, 6], [21, 4], [28, 9]]) P.dot(x, y, 1.1, 'g');
      P.dot(4, 9, 0.9, 'y'); P.dot(27, 24, 0.9, 'y');
    } },
    'biome-grove': { p: { st: '#9a948a', st2: '#7a746a', gr: '#4a8a3a', g: '#9af0d0', wd: '#6a4a2a', b: '#3a7a3a' }, d: (P) => {
      P.ell(16, 26, 15, 4, 'gr');
      for (const [x, h] of [[5, 12], [27, 12], [10, 9], [22, 9]]) { P.rect(x - 1.8, 26 - h, 3.6, h, x < 16 ? 'st' : 'st2'); P.rect(x - 2.2, 26 - h - 1, 4.4, 1.4, 'st2'); }
      P.rect(15, 10, 2.4, 16, 'wd'); P.ell(16.2, 8, 6, 5, 'b'); P.dot(16.2, 17, 1.6, 'g');
    } },
    'biome-gothic': { p: { s: '#3a3446', s2: '#2a2434', w: '#ff5a5a', m: '#efe6d0', k: '#140f18' }, d: (P) => {
      P.ell(24, 7, 4.2, 4.2, 'm'); P.ell(25.6, 6, 3.6, 3.6, 'k');
      P.rect(3, 15, 26, 15, 's2');
      for (const [x, w, top] of [[4, 6, 10], [12, 8, 4], [22, 6, 11]]) {
        P.rect(x, top + 4, w, 26 - top, 's'); P.poly([[x - 0.5, top + 4], [x + w / 2, top - 2], [x + w + 0.5, top + 4]], 's');
      }
      for (const [x, y] of [[6, 19], [15, 12], [18, 12], [24, 20], [15.5, 20]]) P.rect(x, y, 1.6, 2.4, 'w');
    } },
    'biome-pirate': { p: { wd: '#7a4a2a', wd2: '#5a321a', sl: '#efe6d0', k: '#1a1418', t: '#e8e0c8', w: '#3a6aa8' }, d: (P) => {
      P.line([[2, 29], [8, 27.5], [14, 29], [20, 27.5], [26, 29], [31, 27.5]], 0.8, 0.8, 'w');
      P.poly([[4, 21], [28, 21], [24.5, 27], [7.5, 27]], 'wd'); P.rect(6, 21, 20, 1.6, 'wd2');
      P.rect(15.2, 3, 1.6, 18, 'wd2');
      P.poly([[16.8, 5], [26, 8], [26, 17], [16.8, 18]], 'sl'); P.poly([[15.2, 7], [8, 9.5], [8, 17], [15.2, 18]], 'sl');
      P.rect(16.8, 2, 6, 3.6, 'k'); P.dot(19.6, 3.6, 1, 't');
    } },
    'biome-bloodwood': { p: { b: '#8a1a2a', b2: '#b02a3a', wd: '#2a1a1e', gr: '#3a1a22', m: '#efe6d0' }, d: (P) => {
      P.rect(1, 27, 30, 3, 'gr');
      P.dot(26, 5, 2.6, 'm');
      for (const [x, top, k] of [[8, 9, 'b'], [24, 11, 'b'], [16, 4, 'b2']]) {
        P.rect(x - 1, top + 6, 2, 27 - top - 6, 'wd');
        P.line([[x, top + 9], [x - 4, top + 5]], 0.6, 0.4, 'wd'); P.line([[x, top + 8], [x + 4, top + 4]], 0.6, 0.4, 'wd');
        P.ell(x, top + 3, 5, 4, k);
      }
    } },
    'biome-hills': { p: { g: '#7aa04a', g2: '#5a8a3a', r: '#8a8070', r2: '#6a6458', k: '#3a2a1a' }, d: (P) => {
      P.ell(9, 26, 11, 9, 'g2'); P.ell(23, 25, 12, 10, 'g'); P.rect(0, 26, 32, 6, 'g2');
      P.poly([[13, 14], [17, 9], [21, 14]], 'r'); P.poly([[17, 9], [21, 14], [19, 14]], 'r2');
      P.line([[7, 22], [10, 25], [8, 28]], 0.4, 0.4, 'k'); P.line([[24, 18], [22, 22], [25, 26]], 0.4, 0.4, 'k');
    } },
    'biome-meadow': { p: { g: '#8ab84a', g2: '#6a9a3a', t: '#ece4cc', y: '#ffd860', s: '#9ac8f0' }, d: (P) => {
      P.rect(0, 20, 32, 12, 'g'); P.ell(16, 20, 18, 4, 'g2');
      P.line([[4, 26], [9, 15], [15, 13], [20, 16], [24, 25]], 1.1, 0.8, 't');
      P.line([[9, 15], [8, 25]], 0.7, 0.7, 't'); P.line([[15, 13], [15, 24]], 0.7, 0.7, 't'); P.line([[20, 16], [21, 25]], 0.7, 0.7, 't');
      P.dot(27, 6, 3, 'y'); for (const [x, y] of [[5, 29], [12, 30], [28, 28]]) P.dot(x, y, 0.9, 'y');
    } },
    'biome-darkwood': { p: { b: '#2a3a4a', b2: '#1e2c3a', wd: '#2a1e18', e: '#ffd23f', m: '#c8d0e0' }, d: (P) => {
      P.rect(1, 27, 30, 3, 'b2'); P.dot(6, 6, 2.2, 'm');
      for (const [x, top, k] of [[9, 7, 'b'], [23, 9, 'b2'], [16, 4, 'b']]) {
        P.poly([[x, top], [x - 5, top + 9], [x + 5, top + 9]], k);
        P.poly([[x, top + 5], [x - 7, top + 16], [x + 7, top + 16]], k);
        P.rect(x - 1, top + 16, 2, 27 - top - 16, 'wd');
      }
      P.put(14, 21, 'e'); P.put(16.5, 21, 'e');
    } },
    // ---------- v2.0: interfaz sin emojis ----------
    sunrise: { p: { y: '#ffd040', y2: '#ffa020', h: '#c87a3a' }, d: (P) => {
      for (let i = 0; i <= 4; i++) { const a = Math.PI + i * Math.PI / 4; P.line([[16 + Math.cos(a) * 10, 21 + Math.sin(a) * 10], [16 + Math.cos(a) * 14.5, 21 + Math.sin(a) * 14.5]], 1, 0.5, 'y2'); }
      for (let y = 13; y <= 21; y++) { const w = Math.sqrt(Math.max(0, 64 - (21 - y) * (21 - y))); P.rect(16 - w, y, w * 2, 1, 'y'); }
      P.rect(2, 22, 28, 2, 'h'); P.rect(6, 26, 20, 1.5, 'h');
    } },
    stars: { p: { y: '#f2dc8c', w: '#ffffff' }, d: (P) => {
      const star = (x, y, r, k) => { P.line([[x - r, y], [x + r, y]], 0.6, 0.6, k); P.line([[x, y - r], [x, y + r]], 0.6, 0.6, k); P.dot(x, y, r * 0.35, k); };
      star(10, 10, 6, 'y'); star(23, 17, 4.5, 'w'); star(12, 25, 3.5, 'y');
    } },
    food: { p: { m: '#b85a3a', m2: '#d8784a', t: '#efe6d0' }, d: (P) => {
      P.ell(13, 13, 9.5, 8.5, 'm'); P.ell(11, 11, 4.5, 3.4, 'm2');
      P.line([[18, 18], [25, 25]], 1.6, 1.4, 't'); P.dot(25.5, 23.5, 2.4, 't'); P.dot(23.5, 26.5, 2.4, 't');
    } },
    tent: { p: { c: '#c8783a', c2: '#a05a2a', k: '#3a2410', wd: '#6a4a2a' }, d: (P) => {
      P.poly([[16, 4], [30, 27], [2, 27]], 'c'); P.poly([[16, 4], [30, 27], [16, 27]], 'c2');
      P.poly([[16, 13], [21, 27], [11, 27]], 'k'); P.rect(1, 27, 30, 1.6, 'wd');
    } },
    shop: { p: { r: '#c03a2a', w: '#f4ead2', wd: '#8a5a2a', wd2: '#6a4220', a: '#d4a42c' }, d: (P) => {
      for (let i = 0; i < 6; i++) P.rect(3 + i * 4.4, 5, 4.4, 7, i % 2 ? 'w' : 'r');
      for (let i = 0; i < 6; i++) P.ell(5.2 + i * 4.4, 12, 2.2, 1.6, i % 2 ? 'w' : 'r');
      P.rect(4, 14, 2, 14, 'wd2'); P.rect(26, 14, 2, 14, 'wd2');
      P.rect(3, 20, 26, 8, 'wd'); P.rect(3, 20, 26, 1.5, 'a');
      P.dot(11, 17.5, 2, 'a'); P.dot(17, 17.5, 2, 'r');
    } },
    question: { p: { y: '#ffd040', y2: '#e8a820' }, d: (P) => {
      P.line([[9, 10], [11, 5.5], [16, 4], [21, 5.5], [23, 10], [21, 14], [16, 17], [16, 21]], 1.9, 1.9, 'y');
      P.rect(13.6, 24, 5, 5, 'y2');
    } },
    crown: { p: { a: '#e8b830', a2: '#b88a20', r: '#c83a3a', b: '#3a7ac8' }, d: (P) => {
      P.poly([[4, 25], [4, 9], [10, 16], [16, 6], [22, 16], [28, 9], [28, 25]], 'a');
      P.rect(4, 22, 24, 4, 'a2'); P.dot(16, 17, 2.2, 'r'); P.dot(9, 20, 1.5, 'b'); P.dot(23, 20, 1.5, 'b');
    } },
    'arrow-up': { p: { g: '#3aa83a', g2: '#2a7a2a' }, d: (P) => { P.poly([[16, 4], [28, 17], [21, 17], [21, 28], [11, 28], [11, 17], [4, 17]], 'g'); P.rect(11, 25, 10, 3, 'g2'); } },
    'arrow-down': { p: { r: '#c8402a', r2: '#8a2a1a' }, d: (P) => { P.poly([[16, 28], [28, 15], [21, 15], [21, 4], [11, 4], [11, 15], [4, 15]], 'r'); P.rect(11, 4, 10, 3, 'r2'); } },
    coins: { p: { a: '#e8b830', a2: '#b88a20', c: '#ffe080' }, d: (P) => {
      for (const [y, x] of [[24, 13], [20, 15], [16, 13], [12, 16]]) { P.ell(x, y + 1.6, 9, 3.6, 'a2'); P.ell(x, y, 9, 3.6, 'a'); P.ell(x - 2, y - 0.8, 3, 1, 'c'); }
      P.ell(24, 25.6, 6, 2.6, 'a2'); P.ell(24, 24.2, 6, 2.6, 'a');
    } },
    compass: { p: { a: '#c9a24a', w: '#f4ead2', r: '#c03a2a', k: '#3a2a1a' }, d: (P) => {
      P.ell(16, 16, 14, 14, 'a'); P.ell(16, 16, 11.5, 11.5, 'w');
      P.poly([[16, 5.5], [19, 16], [13, 16]], 'r'); P.poly([[16, 26.5], [19, 16], [13, 16]], 'k');
      P.dot(16, 16, 1.6, 'a');
    } },
    pin: { p: { r: '#c83a2a', r2: '#8a2216', w: '#f4ead2' }, d: (P) => {
      P.ell(16, 12, 9, 9, 'r'); P.poly([[9, 16], [23, 16], [16, 30]], 'r'); P.poly([[16, 16], [23, 16], [16, 30]], 'r2'); P.dot(16, 12, 3.4, 'w');
    } },
    feather: { p: { w: '#f4ead2', w2: '#c8b890', k: '#5a4a3a' }, d: (P) => {
      P.poly([[27, 3], [21, 4], [12, 11], [7, 20], [6, 26], [12, 22], [20, 17], [26, 9]], 'w');
      P.poly([[27, 3], [26, 9], [20, 17], [12, 22], [17, 13]], 'w2');
      P.line([[27, 3], [4, 29]], 0.5, 0.5, 'k');
    } },
    // v2.2: íconos del editor
    plus: { p: { g: '#3aa83a', g2: '#2a7a2a' }, d: (P) => { P.rect(13, 5, 6, 22, 'g'); P.rect(5, 13, 22, 6, 'g'); P.rect(13, 24, 6, 3, 'g2'); P.rect(24, 13, 3, 6, 'g2'); } },
    trash: { p: { m: '#8a8f98', d: '#4e535c', l: '#c4c8cf' }, d: (P) => {
      P.rect(6, 7, 20, 3, 'm'); P.rect(12, 4, 8, 3, 'd');
      P.poly([[8, 11], [24, 11], [22, 28], [10, 28]], 'm'); P.rect(8, 11, 16, 1.6, 'l');
      for (const x of [12.5, 16, 19.5]) P.line([[x, 14], [x, 25]], 1.1, 1.1, 'd');
    } },
    undo: { p: { b: '#3a67a6' }, d: (P) => { P.line([[10, 13], [16, 10], [22, 11], [26, 16], [25, 23], [19, 27]], 2.6, 2.6, 'b'); P.poly([[3, 13], [12, 6], [12, 20]], 'b'); } },
    copy: { p: { w: '#f4ead2', w2: '#e0d2b0', k: '#6a4a2a' }, d: (P) => {
      P.rect(4, 4, 16, 20, 'k'); P.rect(5.5, 5.5, 13, 17, 'w2');
      P.rect(11, 9, 17, 20, 'k'); P.rect(12.5, 10.5, 14, 17, 'w');
      for (const y of [15, 19, 23]) P.rect(15, y, 9, 1.4, 'k');
    } },
    download: { p: { g: '#3aa83a', k: '#6a4a2a' }, d: (P) => { P.rect(13, 3, 6, 12, 'g'); P.poly([[7, 13], [25, 13], [16, 22]], 'g'); P.rect(4, 24, 24, 4, 'k'); P.rect(4, 19, 3, 7, 'k'); P.rect(25, 19, 3, 7, 'k'); } },
    upload: { p: { b: '#3a67a6', k: '#6a4a2a' }, d: (P) => { P.poly([[16, 3], [25, 12], [7, 12]], 'b'); P.rect(13, 11, 6, 10, 'b'); P.rect(4, 24, 24, 4, 'k'); P.rect(4, 19, 3, 7, 'k'); P.rect(25, 19, 3, 7, 'k'); } },
    close: { p: { r: '#a83a2a' }, d: (P) => { P.line([[8, 8], [24, 24]], 3, 3, 'r'); P.line([[24, 8], [8, 24]], 3, 3, 'r'); } },
    warning: { p: { y: '#f0c040', y2: '#b88418', k: '#3a2a12' }, d: (P) => {
      P.poly([[16, 3], [30, 28], [2, 28]], 'y2'); P.poly([[16, 7], [27, 26], [5, 26]], 'y');
      P.rect(14.6, 11.5, 2.8, 8.5, 'k'); P.rect(14.6, 21.6, 2.8, 2.8, 'k');
    } },
    'arrow-left': { p: { k: '#c09032' }, d: (P) => { P.poly([[4, 16], [16, 5], [16, 11], [28, 11], [28, 21], [16, 21], [16, 27]], 'k'); } },
    menu: { p: { k: '#6a5a46' }, d: (P) => { for (const y of [7, 14.5, 22]) P.rect(5, y, 22, 3.4, 'k'); } },
    pencil: { p: { y: '#e8b830', y2: '#b88a20', w: '#f0d8b0', k: '#3a2a1a', r: '#d07a8a' }, d: (P) => {
      P.poly([[6, 22], [21, 7], [25, 11], [10, 26]], 'y'); P.line([[8, 24], [23, 9]], 0.6, 0.6, 'y2');
      P.poly([[21, 7], [24, 4], [28, 8], [25, 11]], 'r');
      P.poly([[6, 22], [10, 26], [4, 28]], 'w'); P.dot(4.8, 27.2, 1.3, 'k');
    } },
    hourglass: { p: { wd: '#7a4a2a', g: '#cfe3ee', s: '#e0b860' }, d: (P) => {
      P.rect(6, 3, 20, 3, 'wd'); P.rect(6, 26, 20, 3, 'wd');
      P.poly([[8, 6], [24, 6], [17.5, 16], [24, 26], [8, 26], [14.5, 16]], 'g');
      P.poly([[11, 9], [21, 9], [16, 14.5]], 's'); P.poly([[10.5, 25], [21.5, 25], [16, 20]], 's');
    } },
  };

  /** Ícono de interfaz pixelado: A.ItemSprites.icon('fire', { size: 16 }) */
  function icon(name, opts = {}) {
    const def = ICONS[name];
    if (!def) return '';
    const url = renderCustom(`icon:${name}`, def.d, def.p);
    return imgTag(url, opts.size || 20, ['px-icon', opts.cls || ''].filter(Boolean).join(' '));
  }

  /** Ícono de un hechizo según su elemento. */
  function spellIcon(spell, opts = {}) {
    const t = `${(spell && spell.id) || ''} ${(spell && spell.name) || ''}`.toLowerCase();
    let name = 'arcane';
    if (spell && spell.heal) name = 'heal';
    else if (/bola de fuego|bola_fuego/.test(t)) name = 'fireball';
    else if (/aliento/.test(t)) name = 'breath';
    else if (/tormenta/.test(t)) name = 'storm';
    else if (/llama|fuego|ígne|igne|ascua|brasa/.test(t)) name = 'fire';
    else if (/luz|sagrad/.test(t)) name = 'star';
    else if (/lunar|luna/.test(t)) name = 'moon';
    else if (/hielo|helad/.test(t)) name = 'ice';
    else if (/chispa|rayo|trueno|descarga/.test(t)) name = 'spark';
    else if (/veneno/.test(t)) name = 'poison';
    return icon(name, opts);
  }

  /**
   * Dificultad del dado: un D20 con el número encima.
   * Es lo que hay que sacar (D20 + ataque) para pegarle a esa criatura.
   */
  function dcBadge(n, opts = {}) {
    const size = opts.size || 26;
    const title = opts.title || `Dificultad del dado: para acertarle, el dado de 20 más tu precisión tiene que llegar a ${n}.`;
    return `<span class="dc-badge ${opts.cls || ''}" style="--dc-size:${size}px" title="${String(title).replace(/"/g, '&quot;')}">${icon('d20', { size })}<b>${n}</b></span>`;
  }

  /** URL (data:) de un ícono, para usarlo dentro de un SVG (el mapa). */
  function iconUrl(name) {
    const def = ICONS[name];
    return def ? renderCustom(`icon:${name}`, def.d, def.p) : '';
  }

  A.ItemSprites = { html, dataUrl, shapeOf, icon, iconUrl, spellIcon, dcBadge, SHAPES: Object.keys(SHAPES), ICONS: Object.keys(ICONS) };
})(window.Aventurs);
