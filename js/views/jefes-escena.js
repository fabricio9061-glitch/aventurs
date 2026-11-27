/* ============================================================
   Aventurs — v3.24.0: cada jefe con su propia pelea (puesta en escena)

   Cuando en la pelea hay un jefe, la arena cambia entera: su lugar (fondo y cosas
   que se mueven), dónde y cómo se para el jefe (en su trono, volando, metido en el agua…),
   cómo se acomodan sus criaturas (a los costados, colgando del techo, a sus pies…),
   qué cambia cuando se enfurece, y una presentación con su nombre al empezar.

   Es solo para mirar: no cambia ninguna regla de la pelea.
   (El Kraken ya tenía la suya desde v3.23.3, en css/kraken.css.)
   ============================================================ */
(function () {
  'use strict';
  const A = (window.Aventurs = window.Aventurs || {});

  // número "al azar" pero siempre el mismo para el mismo índice (para que no salten al redibujar)
  function rnd(k, salt) {
    let x = Math.sin((k + 1) * 12.9898 + (salt || 0) * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }
  /** n piezas <i class="cls"> con su lugar (--x, --y en %), tamaño (--s), demora (--k) y giro (--r). */
  function many(cls, n, o = {}) {
    let h = '';
    for (let k = 0; k < n; k++) {
      const x = o.x ? o.x(k, n) : Math.round(rnd(k, 1) * 100);
      const y = o.y ? o.y(k, n) : Math.round(rnd(k, 2) * 100);
      const s = (o.s || 1) * (0.6 + rnd(k, 3) * 0.8);
      h += `<i class="${cls}" style="--x:${x}%;--y:${y}%;--s:${s.toFixed(2)};--k:${k};--r:${rnd(k, 4).toFixed(2)}"></i>`;
    }
    return h;
  }
  const el = (cls, inner = '') => `<i class="${cls}">${inner}</i>`;

  /**
   * Cada jefe:
   *  t: nombre en la presentación · l: la frase de abajo
   *  mode: cómo se acomodan sus criaturas (flank = a los costados, hang = colgando del techo,
   *        feet = a sus pies, float = flotando, ghost = sombras medio transparentes)
   *  pose: cómo se para el jefe (clase pose-xxx)
   *  scene(ctx): lo que va en el fondo · back/front(ctx): lo que va detrás / delante del dibujo del jefe
   */
  const STAGES = {
    rey_goblin: {
      l: 'Desde su trono de chatarra', mode: 'flank', pose: 'throne',
      scene: () => el('sc-junk') + el('sc-torch is-l') + el('sc-torch is-r') + many('sc-rise sc-spark', 10, { y: () => 90 }),
      back: () => el('bs-throne'),
    },
    reina_arana: {
      l: 'Sus crías bajan del techo', mode: 'hang', pose: 'hang',
      scene: () => el('sc-web') + el('sc-web is-2') + many('sc-egg', 7, { y: (k) => 74 + Math.round(rnd(k, 9) * 14), x: (k) => (k < 4 ? 4 + k * 7 : 70 + k * 4) }),
      back: () => el('bs-thread'),
    },
    ent_anciano: {
      l: 'El bosque se despierta', mode: 'feet', pose: 'rooted',
      scene: () => el('sc-trees') + many('sc-fall sc-leaf', 16) + many('sc-twinkle sc-firefly', 12, { y: (k) => 40 + Math.round(rnd(k, 7) * 50) }),
      back: () => el('bs-roots'),
    },
    leviatan: {
      l: 'Sube desde el fondo del mar', mode: 'flank', pose: 'sea',
      scene: () => el('sc-sea') + many('sc-fall sc-rain', 34, { s: 1 }) + el('sc-flash'),
      front: () => el('bs-waves'),
    },
    kyubi: {
      l: 'Nueve colas, nueve fuegos', mode: 'flank', pose: 'fox',
      scene: () => el('sc-torii') + many('sc-fall sc-petal', 14) + el('sc-moon is-fox'),
      back: (x) => {
        const on = Math.max(1, x.tails || 1);
        let h = '';
        for (let k = 0; k < 9; k++) h += `<i class="bs-wisp ${k < on ? 'is-on' : ''}" style="--k:${k}"></i>`;
        return `<i class="bs-wisps">${h}</i>`;
      },
    },
    archimago: {
      l: 'En lo alto de su torre', mode: 'float', pose: 'float',
      scene: () => many('sc-book', 6, { y: (k) => 12 + Math.round(rnd(k, 5) * 34) }) + many('sc-rise sc-rune', 14),
      back: () => el('bs-circle'),
    },
    lich: {
      l: 'Las almas no lo dejan morir', mode: 'flank', pose: 'float',
      scene: () => el('sc-tombs') + el('sc-mist') + many('sc-rise sc-soul', 10, { y: () => 96 }),
      back: () => el('bs-phylactery'),
    },
    senor_vampiro: {
      l: 'La luna se tiñe de rojo', mode: 'float', pose: 'cape',
      scene: () => el('sc-window') + el('sc-candles is-l') + el('sc-candles is-r') + many('sc-bat', 7, { y: (k) => 8 + Math.round(rnd(k, 6) * 36) }) + el('sc-mist is-red'),
    },
    balrog: {
      l: 'Sobre el puente del abismo', mode: 'flank', pose: 'giant',
      scene: () => el('sc-chasm') + el('sc-bridge') + many('sc-rise sc-ember', 22, { y: () => 100 }),
      back: () => el('bs-wings'),
    },
    tarrasca: {
      l: 'La caverna tiembla', mode: 'flank', pose: 'giant',
      scene: () => el('sc-cave-teeth') + many('sc-crack', 4, { x: (k) => 30 + k * 17, y: (k) => 20 + k * 25 }) + many('sc-fall sc-dust', 16),
      back: () => el('bs-quake'),
    },
    cthulhu: {
      l: 'Mirarlo te vuelve loco', mode: 'flank', pose: 'sea',
      scene: () => el('sc-ruins-sunk') + many('sc-twinkle sc-eye', 12, { y: (k) => 8 + Math.round(rnd(k, 8) * 48) }) + many('sc-rise sc-bubble', 14, { y: () => 100 }) + el('sc-madness'),
      front: () => el('bs-waves is-deep'),
    },
    demonio_mayor: {
      l: 'Las cadenas del infierno', mode: 'flank', pose: 'giant',
      scene: () => many('sc-chain', 5, { x: (k) => 8 + k * 21, y: () => 0 }) + el('sc-pillar is-l') + el('sc-pillar is-r') + many('sc-rise sc-ember', 14, { y: () => 100 }),
      back: () => el('bs-seal'),
    },
    fenix_ancestral: {
      l: 'Cuando cae, renace', mode: 'flank', pose: 'float',
      scene: () => el('sc-stone-trees') + many('sc-fall sc-ash', 18) + many('sc-rise sc-ember', 12, { y: () => 100 }),
      back: () => el('bs-sun'),
    },
    hidra: {
      l: 'Cortás una y salen dos', mode: 'flank', pose: 'sea',
      scene: () => el('sc-swamp') + el('sc-reeds') + many('sc-rise sc-bubble is-green', 12, { y: () => 100 }) + el('sc-mist is-green'),
      front: () => el('bs-waves is-swamp'),
    },
    rey_escarcha: {
      l: 'Congelado en su trono', mode: 'feet', pose: 'throne',
      scene: () => el('sc-ice is-l') + el('sc-ice is-r') + many('sc-fall sc-snow', 30) + el('sc-frost'),
      back: () => el('bs-throne is-ice'),
    },
    golem_primordial: {
      l: 'Despertó con hambre de piedra', mode: 'flank', pose: 'giant',
      scene: () => el('sc-sandwind') + many('sc-sand', 16, { s: 1 }),
      back: () => many('bs-rock', 6, { x: (k) => [-34, 112, -22, 124, -40, 104][k], y: (k) => 6 + k * 12 }) + el('bs-glyphs'),
    },
    reina_sombras: {
      l: 'Donde no llega la luz', mode: 'ghost', pose: 'shadow',
      scene: () => el('sc-dark') + el('sc-candle'),
    },
    volibear: {
      l: 'La tormenta del Norte', mode: 'flank', pose: 'giant',
      scene: () => el('sc-clouds') + many('sc-fall sc-snow is-storm', 26) + el('sc-bolt is-1') + el('sc-bolt is-2') + el('sc-flash is-blue'),
      back: () => el('bs-storm'),
    },
    titan: {
      l: 'Más alto que la montaña', mode: 'feet', pose: 'titan',
      scene: () => el('sc-peaks') + many('sc-fall sc-pebble', 10),
      front: () => el('bs-clouds'),
    },
    ysera: {
      l: 'Todo es un sueño', mode: 'float', pose: 'float',
      scene: () => el('sc-dream') + many('sc-rise sc-sparkle', 18, { y: () => 100 }) + many('sc-fall sc-petal is-dream', 10),
      back: () => el('bs-aura is-dream'),
    },
    aurelion_sol: {
      l: 'El que forja las estrellas', mode: 'flank', pose: 'float',
      scene: () => many('sc-twinkle sc-star', 30) + el('sc-constellation') + many('sc-comet', 3, { y: (k) => 6 + k * 14, x: (k) => 20 + k * 30 }),
      back: () => el('bs-forge'),
    },
    alamuerte: {
      l: 'La tierra se parte', mode: 'float', pose: 'giant',
      scene: () => many('sc-crack is-lava', 6, { x: (k) => 2 + k * 16, y: (k) => 10 + (k % 3) * 40 }) + el('sc-smoke') + many('sc-rise sc-ember', 20, { y: () => 100 }),
      back: () => el('bs-molten'),
    },
    devorador: {
      l: 'Ya se comió otros mundos', mode: 'float', pose: 'giant',
      scene: () => el('sc-planet') + el('sc-vortex') + many('sc-drain', 14),
    },
    dios: {
      l: 'Brilla como el sol del mediodía', mode: 'float', pose: 'float',
      scene: () => el('sc-heaven') + many('sc-fall sc-feather', 10) + el('sc-cloudfloor'),
      back: () => el('bs-rays') + el('bs-halo'),
    },
    satanas: {
      l: 'Desde su trono de huesos', mode: 'feet', pose: 'throne',
      scene: () => el('sc-hellgate') + el('sc-pillar is-l') + el('sc-pillar is-r') + many('sc-rise sc-ember', 20, { y: () => 100 }),
      back: () => el('bs-throne is-bone') + el('bs-seal is-under'),
    },
    mente_colmena: {
      l: 'Ahora piensa por vos', mode: 'flank', pose: 'tank',
      scene: () => el('sc-lab') + many('sc-wave-psi', 3) + el('sc-alarm'),
      back: () => el('bs-tank'),
      front: () => el('bs-glass') + many('bs-bubble', 8, { y: () => 100 }),
    },
  };

  /** El jefe de la pelea que tiene escena (uno solo; el Kraken tiene la suya). */
  function bossOf(c) {
    if (!c || !c.enemies) return null;
    const bosses = c.enemies.filter((e) => e.category === 'boss');
    if (bosses.length !== 1) return null;
    const b = bosses[0];
    const id = b.enemyId || b.id;
    return STAGES[id] ? { boss: b, id, st: STAGES[id] } : null;
  }

  /** Clases de la arena: stage-<id>, si está furioso, si le queda poca vida. */
  function arenaCls(c, hp) {
    const s = bossOf(c);
    if (!s) return '';
    const b = s.boss;
    const h = hp != null ? hp : b.hp;
    const low = h > 0 && h <= b.maxHp * 0.25;
    return `has-scene stage-${s.id} mode-${s.st.mode} ${b.enraged ? 'is-raged' : ''} ${low ? 'is-low' : ''} ${h <= 0 ? 'is-down' : ''}`;
  }
  function sceneHtml(c) {
    const s = bossOf(c);
    if (!s) return '';
    return `<div class="cb-scene" aria-hidden="true">${s.st.scene ? s.st.scene(s.boss) : ''}</div>`;
  }
  /** Lo que va pegado al dibujo del jefe (atrás y adelante). */
  function propsOf(c, e) {
    const s = bossOf(c);
    if (!s || s.boss !== e) return '';
    const back = s.st.back ? `<span class="bs-back" aria-hidden="true">${s.st.back(e)}</span>` : '';
    const front = s.st.front ? `<span class="bs-front" aria-hidden="true">${s.st.front(e)}</span>` : '';
    return back + front;
  }
  /** Clases de las tarjetas: el jefe y sus criaturas (izquierda/derecha, según el lugar). */
  function unitCls(c, e) {
    const s = bossOf(c);
    if (!s) return '';
    if (e === s.boss) return ` is-stage-boss pose-${s.st.pose}`;
    const others = c.enemies.filter((x) => x !== s.boss);
    const j = others.indexOf(e);
    return ` is-minion ${j % 2 === 0 ? 'm-left' : 'm-right'} m-${j}`;
  }

  // ---------- la presentación al empezar ----------
  const introDone = new Set();
  function intro(c, host) {
    const s = bossOf(c);
    if (!s || !host || introDone.has(c.id)) return;
    introDone.add(c.id);
    if (c.round > 1) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const box = document.createElement('div');
    box.className = `cb-boss-intro stage-${s.id}`;
    box.setAttribute('role', 'presentation');
    box.innerHTML = `
      <div class="bi-band">
        <span class="bi-kicker">Jefe · Nivel ${s.boss.tier || ''}</span>
        <strong class="bi-name">${esc(s.boss.name || s.boss.displayName)}</strong>
        <span class="bi-line">${esc(s.st.l || '')}</span>
      </div>`;
    host.appendChild(box);
    const close = () => { box.classList.add('is-out'); setTimeout(() => box.remove(), 420); };
    box.addEventListener('click', close);
    setTimeout(close, reduce ? 1400 : 2600);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  /** Para que lo que se mueve en el fondo no vuelva a empezar cada vez que se redibuja la arena. */
  const t0 = {};
  function keepTime(c, arenaEl) {
    if (!c || !arenaEl) return;
    if (!t0[c.id]) t0[c.id] = performance.now();
    arenaEl.style.setProperty('--t', `${-Math.round(performance.now() - t0[c.id])}ms`);
  }

  A.BossStage = { STAGES, bossOf, arenaCls, sceneHtml, propsOf, unitCls, intro, keepTime };
})();
