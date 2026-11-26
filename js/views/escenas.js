/* ============================================================
   Aventurs — Escenas de fondo de cada lugar (v3.20.2)
   Una silueta dibujada al pie de la cabecera del lugar, distinta
   para cada tipo de zona: casas en los pueblos, pinos en el bosque,
   tumbas en el cementerio, olas en la costa, picos en la montaña...
   Cada lugar sale un poco distinto (se arma con su id como semilla).
   Tres capas: lejos (clara), cerca (oscura) y luces (ventanas, lava,
   estrellas) que de noche brillan más.
   ============================================================ */

(function (A) {
  'use strict';

  const W = 640;
  const H = 120;

  function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {
      h |= 0; h = (h + 0x6D2B79F5) | 0;
      let t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const f = (n) => Math.round(n * 10) / 10;

  // ---------- Piezas ----------
  function hills(r, base, amp, n) {
    let d = `M0 ${H} L0 ${f(base)}`;
    const step = W / n;
    for (let i = 0; i < n; i++) {
      const x1 = i * step + step / 2;
      const y1 = base - amp * (0.4 + r() * 0.8);
      d += ` Q${f(x1)} ${f(y1)} ${f((i + 1) * step)} ${f(base - r() * amp * 0.3)}`;
    }
    return `<path d="${d} L${W} ${H} Z"/>`;
  }
  function peaks(r, base, hMin, hMax, n, snow) {
    let d = `M0 ${H} L0 ${base}`;
    let caps = '';
    const step = W / n;
    for (let i = 0; i < n; i++) {
      const px = i * step + step * (0.3 + r() * 0.4);
      const py = base - (hMin + r() * (hMax - hMin));
      d += ` L${f(px)} ${f(py)} L${f((i + 1) * step)} ${f(base - r() * 10)}`;
      if (snow) caps += `<path d="M${f(px)} ${f(py)} l${f(-step * 0.12)} ${f(step * 0.1)} l${f(step * 0.05)} -3 l${f(step * 0.05)} 4 l${f(step * 0.04)} -5 Z"/>`;
    }
    return { d: `<path d="${d} L${W} ${H} Z"/>`, caps };
  }
  function house(x, w, h, r) {
    const y = H - h;
    const roof = h * (0.45 + r() * 0.2);
    const win = `<rect x="${f(x + w * 0.3)}" y="${f(y + h * 0.3)}" width="${f(w * 0.18)}" height="${f(h * 0.22)}"/>` + (w > 34 ? `<rect x="${f(x + w * 0.58)}" y="${f(y + h * 0.3)}" width="${f(w * 0.18)}" height="${f(h * 0.22)}"/>` : '');
    const chim = r() < 0.6 ? `<rect x="${f(x + w * 0.68)}" y="${f(y - roof * 0.85)}" width="${f(w * 0.1)}" height="${f(roof * 0.6)}"/>` : '';
    return {
      body: `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"/><path d="M${f(x - 4)} ${f(y)} L${f(x + w / 2)} ${f(y - roof)} L${f(x + w + 4)} ${f(y)} Z"/>${chim}`,
      light: win,
    };
  }
  function pine(x, h, w) { const y = H - h; return `<path d="M${f(x)} ${f(y)} L${f(x + w / 2)} ${f(y + h * 0.4)} L${f(x + w * 0.2)} ${f(y + h * 0.4)} L${f(x + w * 0.62)} ${f(y + h * 0.75)} L${f(x + w * 0.1)} ${f(y + h * 0.75)} L${f(x + w * 0.1)} ${H} L${f(x - w * 0.1)} ${H} L${f(x - w * 0.1)} ${f(y + h * 0.75)} L${f(x - w * 0.62)} ${f(y + h * 0.75)} L${f(x - w * 0.2)} ${f(y + h * 0.4)} L${f(x - w / 2)} ${f(y + h * 0.4)} Z"/>`; }
  function roundTree(x, h, rad) { return `<rect x="${f(x - 2.5)}" y="${f(H - h)}" width="5" height="${f(h)}"/><circle cx="${f(x)}" cy="${f(H - h)}" r="${f(rad)}"/><circle cx="${f(x - rad * 0.6)}" cy="${f(H - h + rad * 0.4)}" r="${f(rad * 0.7)}"/><circle cx="${f(x + rad * 0.6)}" cy="${f(H - h + rad * 0.4)}" r="${f(rad * 0.7)}"/>`; }
  function deadTree(x, h, r) {
    const y = H - h;
    const b = (sx, sy, dx, dy) => `<path d="M${f(sx)} ${f(sy)} l${f(dx)} ${f(dy)}" stroke-width="3" stroke-linecap="round" fill="none"/>`;
    return `<path d="M${f(x - 3)} ${H} L${f(x - 1.5)} ${f(y)} L${f(x + 1.5)} ${f(y)} L${f(x + 3)} ${H} Z"/>` + b(x, y + h * 0.25, -14 - r() * 6, -12) + b(x, y + h * 0.4, 16 + r() * 6, -14) + b(x, y + 4, -6, -10) + b(x, y + h * 0.55, -12, -6);
  }
  function grave(x, h, cross) {
    if (cross) return `<rect x="${f(x - 2)}" y="${f(H - h)}" width="4" height="${f(h)}"/><rect x="${f(x - 7)}" y="${f(H - h + h * 0.25)}" width="14" height="4"/>`;
    return `<path d="M${f(x - 7)} ${H} L${f(x - 7)} ${f(H - h + 7)} Q${f(x)} ${f(H - h - 3)} ${f(x + 7)} ${f(H - h + 7)} L${f(x + 7)} ${H} Z"/>`;
  }
  function tower(x, w, h, cone, r) {
    const y = H - h;
    const top = cone ? `<path d="M${f(x - 3)} ${f(y)} L${f(x + w / 2)} ${f(y - w * 1.3)} L${f(x + w + 3)} ${f(y)} Z"/>` : Array.from({ length: Math.max(2, Math.round(w / 8)) }, (_, i) => `<rect x="${f(x + i * (w / Math.max(2, Math.round(w / 8))))}" y="${f(y - 6)}" width="${f(w / Math.max(2, Math.round(w / 8)) * 0.6)}" height="6"/>`).join('');
    const wins = Array.from({ length: Math.max(1, Math.floor(h / 26)) }, (_, i) => (r() < 0.7 ? `<rect x="${f(x + w / 2 - 2)}" y="${f(y + 10 + i * 24)}" width="4" height="7" rx="2"/>` : '')).join('');
    return { body: `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"/>${top}`, light: wins };
  }
  function waves(base, amp, n, shift) {
    let d = `M0 ${H} L0 ${base}`;
    const step = W / n;
    for (let i = 0; i < n; i++) d += ` q${f(step / 4)} ${-amp} ${f(step / 2)} 0 t${f(step / 2)} 0`;
    return `<path d="${d} L${W} ${H} Z" transform="translate(${shift || 0} 0)"/>`;
  }
  function ship(x, s) {
    return `<path d="M${f(x)} ${f(H - 22 * s)} L${f(x + 70 * s)} ${f(H - 22 * s)} L${f(x + 58 * s)} ${f(H - 8 * s)} L${f(x + 10 * s)} ${f(H - 8 * s)} Z"/><rect x="${f(x + 33 * s)}" y="${f(H - 78 * s)}" width="${f(3 * s)}" height="${f(56 * s)}"/><path d="M${f(x + 37 * s)} ${f(H - 74 * s)} Q${f(x + 60 * s)} ${f(H - 56 * s)} ${f(x + 37 * s)} ${f(H - 30 * s)} Z"/><path d="M${f(x + 32 * s)} ${f(H - 70 * s)} Q${f(x + 14 * s)} ${f(H - 52 * s)} ${f(x + 32 * s)} ${f(H - 32 * s)} Z"/>`;
  }
  function column(x, h, broken) {
    const top = broken ? `<path d="M${f(x - 6)} ${f(H - h)} l4 -6 l4 4 l5 -7 l3 9 Z"/>` : `<rect x="${f(x - 9)}" y="${f(H - h - 5)}" width="18" height="5"/>`;
    return `<rect x="${f(x - 6)}" y="${f(H - h)}" width="12" height="${f(h)}"/>${top}<rect x="${f(x - 9)}" y="${H - 5}" width="18" height="5"/>`;
  }
  function crystal(x, h, w) { return `<path d="M${f(x)} ${f(H - h)} L${f(x + w / 2)} ${f(H - h * 0.7)} L${f(x + w / 2)} ${H} L${f(x - w / 2)} ${H} L${f(x - w / 2)} ${f(H - h * 0.7)} Z"/>`; }
  function spike(x, h, w) { return `<path d="M${f(x - w / 2)} ${H} L${f(x)} ${f(H - h)} L${f(x + w / 2)} ${H} Z"/>`; }
  function stalactite(x, h, w) { return `<path d="M${f(x - w / 2)} 0 L${f(x)} ${f(h)} L${f(x + w / 2)} 0 Z"/>`; }
  function cloud(x, y, s) { return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(26 * s)}" ry="${f(9 * s)}"/><circle cx="${f(x - 8 * s)}" cy="${f(y - 5 * s)}" r="${f(9 * s)}"/><circle cx="${f(x + 7 * s)}" cy="${f(y - 7 * s)}" r="${f(11 * s)}"/>`; }
  function stars(r, n, maxY) { let s = ''; for (let i = 0; i < n; i++) s += `<circle cx="${f(r() * W)}" cy="${f(r() * maxY)}" r="${f(0.6 + r() * 1.3)}"/>`; return s; }
  function flame(x, h) { return `<path d="M${f(x)} ${f(H - h)} Q${f(x + h * 0.35)} ${f(H - h * 0.45)} ${f(x + h * 0.18)} ${H} L${f(x - h * 0.18)} ${H} Q${f(x - h * 0.35)} ${f(H - h * 0.45)} ${f(x)} ${f(H - h)} Z"/>`; }

  // ---------- Una escena por tipo de zona ----------
  // Cada una devuelve { back, front, light }. Las cosas van más a la derecha (a la izquierda está el texto).
  const SCENES = {
    village(r) {
      let front = ''; let light = '';
      let x = 250 + r() * 30;
      while (x < W - 30) {
        if (r() < 0.25) { front += roundTree(x + 10, 24 + r() * 10, 11 + r() * 4); x += 30; continue; }
        const w = 28 + r() * 22; const h = 22 + r() * 18;
        const hs = house(x, w, h, r); front += hs.body; light += hs.light; x += w + 10 + r() * 14;
      }
      return { back: hills(r, 98, 22, 4), front, light };
    },
    forest(r) { let back = ''; let front = ''; for (let x = 160; x < W + 20; x += 18 + r() * 14) back += pine(x, 40 + r() * 30, 22); for (let x = 220; x < W + 20; x += 26 + r() * 20) front += pine(x, 55 + r() * 35, 30); return { back, front, light: '' }; },
    darkwood(r) { const s = SCENES.forest(r); return { ...s, light: stars(r, 6, 40).replace(/r="[\d.]+"/g, 'r="1.4"') }; },
    grove(r) { let back = hills(r, 104, 14, 3); let front = ''; for (let x = 260; x < W; x += 50 + r() * 30) front += roundTree(x, 30 + r() * 22, 16 + r() * 8); return { back, front, light: '' }; },
    meadow(r) { let front = ''; for (let x = 200; x < W; x += 6 + r() * 6) front += `<path d="M${f(x)} ${H} l1 ${f(-6 - r() * 10)} l1 ${f(6 + r() * 6)} Z"/>`; let light = ''; for (let i = 0; i < 14; i++) light += `<circle cx="${f(240 + r() * 390)}" cy="${f(H - 6 - r() * 12)}" r="2"/>`; return { back: hills(r, 100, 26, 3) + roundTree(520, 34, 16), front, light }; },
    plains(r) { let front = ''; for (let x = 260; x < W; x += 22) front += `<rect x="${x}" y="${H - 16}" width="3" height="16"/>`; front += `<rect x="260" y="${H - 13}" width="${W - 260}" height="2"/><rect x="260" y="${H - 7}" width="${W - 260}" height="2"/>`; return { back: hills(r, 104, 16, 3) + roundTree(450 + r() * 100, 40, 15), front, light: '' }; },
    hills(r) { return { back: hills(r, 90, 30, 3), front: hills(r, 108, 18, 4) + roundTree(500, 30, 12), light: '' }; },
    graveyard(r) { let front = ''; for (let x = 250; x < W - 10; x += 26 + r() * 20) front += grave(x, 14 + r() * 14, r() < 0.45); front += deadTree(560 + r() * 40, 70, r); return { back: hills(r, 108, 10, 3), front, light: `<circle cx="${f(380 + r() * 160)}" cy="22" r="11"/>` }; },
    crypt(r) { let front = ''; for (let x = 250; x < W; x += 60) front += `<path d="M${x} ${H} L${x} ${H - 50} Q${x + 25} ${H - 78} ${x + 50} ${H - 50} L${x + 50} ${H} L${x + 40} ${H} L${x + 40} ${H - 48} Q${x + 25} ${H - 64} ${x + 10} ${H - 48} L${x + 10} ${H} Z"/>`; let light = ''; for (let x = 275; x < W; x += 60) light += `<circle cx="${x}" cy="${H - 20}" r="3"/>`; return { back: '', front, light }; },
    swamp(r) { let front = ''; for (let x = 230; x < W; x += 5 + r() * 9) front += `<path d="M${f(x)} ${H - 8} l1.5 ${f(-14 - r() * 22)} l1.5 ${f(14 + r() * 20)} Z"/>`; front += deadTree(330 + r() * 60, 60, r) + deadTree(540 + r() * 50, 50, r) + `<rect x="0" y="${H - 8}" width="${W}" height="8"/>`; let light = ''; for (let i = 0; i < 6; i++) light += `<circle cx="${f(260 + r() * 360)}" cy="${f(H - 30 - r() * 40)}" r="2"/>`; return { back: '', front, light }; },
    coast(r) { const lx = 520 + r() * 50; const back = waves(H - 22, 4, 10, 0); const front = waves(H - 10, 5, 8, -20) + `<rect x="${f(lx)}" y="${H - 78}" width="16" height="70"/><path d="M${f(lx - 4)} ${H - 78} L${f(lx + 8)} ${H - 92} L${f(lx + 20)} ${H - 78} Z"/>` + ship(300 + r() * 80, 0.8); return { back, front, light: `<rect x="${f(lx + 4)}" y="${H - 74}" width="8" height="8"/>` }; },
    sea(r) { return { back: waves(H - 26, 4, 12, 0), front: waves(H - 12, 6, 9, -30) + ship(330 + r() * 160, 1), light: '' }; },
    pirate(r) { const s = SCENES.coast(r); return { ...s, front: s.front + ship(240, 0.7) }; },
    arcane(r) {
      let front = ''; let light = '';
      const t1 = tower(430 + r() * 40, 30, 92, true, r); const t2 = tower(360, 22, 60, true, r); const t3 = tower(530 + r() * 40, 24, 70, true, r);
      for (const t of [t1, t2, t3]) { front += t.body; light += t.light; }
      for (let i = 0; i < 4; i++) front += crystal(260 + i * 22 + r() * 10, 14 + r() * 20, 10);
      return { back: hills(r, 106, 12, 3), front, light: light + stars(r, 10, 50) };
    },
    dream(r) { let front = ''; for (let x = 260; x < W; x += 30 + r() * 24) front += crystal(x, 24 + r() * 46, 14 + r() * 8); let light = ''; for (let i = 0; i < 9; i++) light += `<circle cx="${f(260 + r() * 370)}" cy="${f(14 + r() * 60)}" r="${f(2 + r() * 3)}"/>`; return { back: hills(r, 104, 14, 3), front, light }; },
    mountain(r) { const b = peaks(r, 104, 40, 80, 4, true); const fr = peaks(r, 116, 20, 44, 5, false); return { back: b.d, front: fr.d, light: b.caps }; },
    desert(r) { let front = ''; front += `<path d="M${f(470 + r() * 40)} ${H} l42 -48 l42 48 Z"/>`; for (let i = 0; i < 2; i++) { const x = 300 + i * 220 + r() * 40; front += `<rect x="${f(x - 3)}" y="${H - 38}" width="6" height="38" rx="3"/><path d="M${f(x - 3)} ${H - 20} h-8 v-12" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M${f(x + 3)} ${H - 26} h7 v-10" stroke-width="5" stroke-linecap="round" fill="none"/>`; } return { back: hills(r, 104, 18, 3), front: front + hills(r, 114, 6, 4), light: `<circle cx="${f(400 + r() * 100)}" cy="26" r="12"/>` }; },
    ruins(r) { let front = ''; for (let x = 270; x < W; x += 40 + r() * 20) front += column(x, 30 + r() * 50, r() < 0.6); front += `<rect x="300" y="${H - 6}" width="${W - 300}" height="6"/>`; return { back: hills(r, 108, 12, 3), front, light: '' }; },
    cave(r) { let front = ''; for (let x = 200; x < W; x += 16 + r() * 18) front += stalactite(x, 14 + r() * 30, 10 + r() * 8); for (let x = 240; x < W; x += 24 + r() * 26) front += spike(x, 12 + r() * 24, 12 + r() * 8); let light = ''; for (let i = 0; i < 5; i++) light += crystal(280 + r() * 330, 8 + r() * 8, 5); return { back: '', front, light }; },
    volcano(r) { const x = 440 + r() * 60; const back = `<path d="M${f(x - 130)} ${H} L${f(x - 22)} 34 L${f(x + 22)} 34 L${f(x + 130)} ${H} Z"/>`; const fr = peaks(r, 118, 10, 30, 5, false); const light = `<ellipse cx="${f(x)}" cy="35" rx="20" ry="4"/><path d="M${f(x - 8)} 36 q-6 20 -18 40 l3 1 q12 -18 19 -40 Z"/><path d="M${f(x + 9)} 36 q8 16 20 30 l-3 2 q-11 -13 -20 -31 Z"/><circle cx="${f(x - 6)}" cy="22" r="3"/><circle cx="${f(x + 10)}" cy="14" r="2"/><circle cx="${f(x + 2)}" cy="6" r="1.6"/>`; return { back, front: fr.d, light }; },
    hell(r) { let front = ''; for (let x = 230; x < W; x += 16 + r() * 18) front += spike(x, 22 + r() * 50, 12 + r() * 10); let light = ''; for (let x = 240; x < W; x += 34 + r() * 30) light += flame(x, 16 + r() * 18); return { back: peaks(r, 110, 20, 50, 5, false).d, front, light }; },
    lair(r) { let front = ''; for (let x = 240; x < W; x += 30 + r() * 30) front += `<ellipse cx="${f(x)}" cy="${H}" rx="${f(18 + r() * 16)}" ry="${f(14 + r() * 16)}"/>`; for (let i = 0; i < 4; i++) { const x = 280 + r() * 330; front += `<path d="M${f(x)} ${H - 3} q8 -14 16 0" stroke-width="3" fill="none"/>`; } return { back: peaks(r, 108, 20, 50, 4, false).d, front, light: `<circle cx="${f(380 + r() * 80)}" cy="${H - 34}" r="2.5"/><circle cx="${f(392 + r() * 80)}" cy="${H - 34}" r="2.5"/>` }; },
    abyss(r) { let front = ''; for (let x = 240; x < W; x += 40 + r() * 30) { const h = 40 + r() * 50; front += `<path d="M${f(x - 7)} ${H} Q${f(x - 20)} ${f(H - h * 0.5)} ${f(x + 4)} ${f(H - h)} Q${f(x - 4)} ${f(H - h * 0.5)} ${f(x + 7)} ${H} Z"/>`; } return { back: waves(H - 20, 4, 10, 0), front, light: stars(r, 8, 70) }; },
    bloodwood(r) { let front = ''; for (let x = 250; x < W; x += 60 + r() * 30) front += deadTree(x, 50 + r() * 30, r); return { back: hills(r, 106, 14, 3), front, light: `<circle cx="${f(400 + r() * 120)}" cy="24" r="12"/>` }; },
    gothic(r) {
      let front = ''; let light = '';
      const parts = [tower(300, 26, 66, true, r), tower(340, 46, 46, false, r), tower(400, 30, 92, true, r), tower(444, 52, 52, false, r), tower(510, 24, 74, true, r)];
      for (const t of parts) { front += t.body; light += t.light; }
      return { back: hills(r, 110, 10, 3), front, light: light + `<circle cx="580" cy="24" r="11"/>` };
    },
    sky(r) { let front = ''; for (let i = 0; i < 4; i++) front += cloud(260 + r() * 360, 30 + r() * 60, 0.8 + r() * 0.8); const x = 420 + r() * 80; front += `<path d="M${f(x)} 70 L${f(x + 90)} 70 L${f(x + 60)} 96 L${f(x + 30)} 96 Z"/><rect x="${f(x + 34)}" y="54" width="22" height="16"/><path d="M${f(x + 30)} 54 L${f(x + 45)} 42 L${f(x + 60)} 54 Z"/>`; return { back: '', front, light: `<rect x="${f(x + 42)}" y="59" width="5" height="6"/>` }; },
    space(r) { return { back: '', front: `<circle cx="${f(470 + r() * 80)}" cy="62" r="36"/><ellipse cx="${f(480 + r() * 60)}" cy="62" rx="62" ry="9" fill="none" stroke-width="3"/>`, light: stars(r, 28, H) }; },
  };
  SCENES.space_station = SCENES.space;

  /** El dibujo para la cabecera de un lugar ('' si no hay escena para su tipo). */
  function html(region) {
    if (!region) return '';
    const make = SCENES[region.biome];
    if (!make) return '';
    const r = seeded(String(region.id || region.biome));
    const s = make(r);
    return `<svg class="scene" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" focusable="false">
      <g class="scene-back">${s.back || ''}</g>
      <g class="scene-front">${s.front || ''}</g>
      <g class="scene-light">${s.light || ''}</g>
    </svg>`;
  }

  A.Scenes = { html, kinds: Object.keys(SCENES) };
})(window.Aventurs);
