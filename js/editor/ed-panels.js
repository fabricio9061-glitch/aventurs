/* ============================================================
   Aventurs — Editor v2.2: paneles especiales

   Cosas que no son un campo suelto: la prueba de combate, las
   criaturas de una zona, el mapa chiquito, cómo ve el jugador una
   escena o una misión, con qué arranca una raza...
   ============================================================ */

(function (A) {
  'use strict';

  const Ed = (A.Ed = A.Ed || {});
  const { esc, icon } = Ed.util;
  const S = () => (Ed.view ? Ed.view.S : {});
  const pct = (x) => `${Math.round(x * 100)}%`;
  const lvlOf = (r) => (Ed.schema ? Ed.schema.lvlOf(r) : 1);

  function card(title, body, opts = {}) {
    return `<div class="ed-panel ${opts.cls || ''}">${title ? `<div class="ed-panel-title">${opts.icon ? icon(opts.icon, 18) : ''}<span>${title}</span></div>` : ''}${body}</div>`;
  }

  // ============================================================
  // Zonas
  // ============================================================

  const MAP_W = 1280;
  const MAP_H = 860;

  function regionMap(d) {
    const regions = A.Data.regions.filter((r) => r.id !== d.id && r.pos);
    const me = d.pos || { x: 640, y: 430 };
    const all = regions.concat([{ ...d, pos: me }]);
    const byId = new Map(all.map((r) => [r.id, r]));
    const roads = [];
    const seen = new Set();
    for (const r of all) {
      for (const c of r.connections || []) {
        const o = byId.get(c);
        if (!o) continue;
        const k = [r.id, c].sort().join('|');
        if (seen.has(k)) continue;
        seen.add(k);
        const mine = r.id === d.id || c === d.id;
        roads.push(`<line x1="${r.pos.x}" y1="${r.pos.y}" x2="${o.pos.x}" y2="${o.pos.y}" class="${mine ? 'is-mine' : ''}"/>`);
      }
    }
    const dots = regions.map((r) => `<circle cx="${r.pos.x}" cy="${r.pos.y}" r="${r.type === 'combat' ? 13 : 17}" class="${r.type === 'combat' ? '' : 'is-town'}"><title>${esc(r.name)}</title></circle>`).join('');
    return card('', `
      <div class="ed-minimap">
        <svg viewBox="0 0 ${MAP_W} ${MAP_H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <rect x="0" y="0" width="${MAP_W}" height="${MAP_H}" rx="24" class="ed-mm-bg"/>
          <g class="ed-mm-roads">${roads.join('')}</g>
          <g class="ed-mm-dots">${dots}</g>
          <circle cx="${me.x}" cy="${me.y}" r="26" class="ed-mm-me"/>
        </svg>
      </div>
      <div class="ed-row">
        <button type="button" class="ed-btn is-small" data-ed="open-map" data-id="${esc(d.id || '')}">${icon('map', 16)}<span>Mover en el mapa</span></button>
        <span class="ed-dim">Posición ${Math.round(me.x)}, ${Math.round(me.y)}</span>
      </div>`, { cls: 'is-flat' });
  }

  /** Criaturas que viven en la zona (con los cambios pendientes). */
  function creaturesIn(regionId) {
    const rel = (S().related && S().related.enemies) || {};
    return A.Data.enemies.map((e) => rel[e.id] || e).filter((e) => (e.regions || []).includes(regionId));
  }

  function regionCreatures(d) {
    const list = creaturesIn(d.id).sort((a, b) => a.tier - b.tier);
    const t0 = Array.isArray(d.tier) ? d.tier[0] : 1;
    const t1 = Array.isArray(d.tier) ? d.tier[1] : 10;
    const rows = list.map((e) => {
      const fits = e.tier >= t0 && e.tier <= t1;
      return `<div class="ed-mini-row ${fits ? '' : 'is-bad'}">
        <span class="ed-mini-thumb">${A.Sprites.html(e, { size: 34 })}</span>
        <button type="button" class="ed-link" data-ed="open" data-col="enemies" data-id="${esc(e.id)}"><b>${esc(e.name)}</b><small>Nivel ${e.tier} · ${esc(Ed.schema.L.CAT[e.category] || e.category)}${fits ? '' : ' · no aparece: su nivel está fuera del rango de la zona'}</small></button>
        <button type="button" class="ed-mini" data-ed="zone-remove-enemy" data-enemy="${esc(e.id)}" title="Sacar de esta zona">${icon('close', 12)}</button>
      </div>`;
    }).join('');
    const count = list.filter((e) => e.tier >= t0 && e.tier <= t1).length;
    return card(`Criaturas que viven acá (${count})`, `
      ${rows || '<div class="ed-empty is-small">Ninguna. Sin criaturas no hay peleas en esta zona.</div>'}
      <div class="ed-row"><button type="button" class="ed-btn is-small" data-ed="zone-add-enemy">${icon('plus', 14)}<span>Agregar criaturas</span></button>
      ${S().related && S().related.enemies && Object.keys(S().related.enemies).length ? '<span class="ed-dim">Se guarda junto con la zona.</span>' : ''}</div>`, { icon: 'skull' });
  }

  function regionTest(d) {
    if (!d.id || !A.Data.getById('regions', d.id)) return card('Prueba de la zona', '<div class="ed-dim">Guardá la zona para probar sus peleas.</div>', { icon: 'd20' });
    const lvl = Math.max(1, Math.min(10, (S().simLevel && S().simLevel[`z:${d.id}`]) || lvlOf(d)));
    const r = A.EditorSim.zone(d.id, lvl, 160);
    if (!r.n) return card('Prueba de la zona', '<div class="ed-dim">No salió ninguna pelea: revisá que haya criaturas del nivel de la zona.</div>', { icon: 'd20' });
    const verdict = r.win >= 0.9 ? ['is-good', 'Tranquila'] : r.win >= 0.75 ? ['is-ok', 'Pareja'] : r.win >= 0.55 ? ['is-warn', 'Difícil'] : ['is-bad', 'Muy difícil'];
    return card('Prueba de la zona', `
      <div class="ed-sim-top">
        ${levelPicker(`z:${d.id}`, lvl)}
        <div class="ed-sim-big ${verdict[0]}"><b>${pct(r.win)}</b><span>de las peleas ganadas · ${verdict[1]}</span></div>
      </div>
      <div class="ed-sim-lines">
        <div>Grupos de ${String(r.size.toFixed(1)).replace('.', ',')} criaturas en promedio (${r.kinds} combinaciones distintas).</div>
        ${r.worst.length ? `<div>Las más peligrosas: ${r.worst.map((w) => `<b>${esc(w.names)}</b> (pierde ${pct(w.lost / w.n)})`).join(', ')}.</div>` : '<div>No perdió ninguna pelea.</div>'}
        <div class="ed-dim">Un aventurero humano con equipo normal, sin pociones ni hechizos, contra lo que ya está guardado.</div>
      </div>`, { icon: 'd20', cls: 'is-sim' });
  }

  function regionPeople(d) {
    const people = A.Data.npcs.filter((n) => n.region === d.id);
    return card('', `
      ${people.map((n) => `<div class="ed-mini-row">
        <span class="ed-mini-thumb">${A.Sprites.npcHtml(n, { size: 34 })}</span>
        <button type="button" class="ed-link" data-ed="open" data-col="npcs" data-id="${esc(n.id)}"><b>${esc(n.name)}</b><small>${esc(n.roleName || Ed.schema.L.ROLE[n.role] || n.role || '')}</small></button>
      </div>`).join('') || '<div class="ed-empty is-small">Todavía no vive nadie acá.</div>'}
      <div class="ed-row"><button type="button" class="ed-btn is-small" data-ed="new-npc-here" ${d.id && A.Data.getById('regions', d.id) ? '' : 'disabled'}>${icon('plus', 14)}<span>Nuevo habitante acá</span></button></div>`, { cls: 'is-flat' });
  }

  // ============================================================
  // Criaturas
  // ============================================================

  function homeHelp(d) {
    const regs = (d && d.regions) || [];
    if (!regs.length) return '<span class="is-bad">No vive en ninguna zona: nunca va a aparecer.</span>';
    const bad = regs.map((id) => A.Data.getById('regions', id)).filter((r) => r && Array.isArray(r.tier) && (d.tier < r.tier[0] || d.tier > r.tier[1]));
    if (bad.length) return `<span class="is-bad">En ${bad.map((r) => `${esc(r.name)} (nivel ${r.tier[0]}${r.tier[1] !== r.tier[0] ? `–${r.tier[1]}` : ''})`).join(', ')} no va a aparecer: su nivel está fuera del rango.</span>`;
    return 'Las zonas donde puede aparecer.';
  }

  function levelPicker(key, lvl) {
    return `<div class="ed-lvl">
      <button type="button" class="ed-step" data-ed="sim-level" data-key="${esc(key)}" data-d="-1" ${lvl <= 1 ? 'disabled' : ''}>−</button>
      <span>Aventurero de nivel <b>${lvl}</b></span>
      <button type="button" class="ed-step" data-ed="sim-level" data-key="${esc(key)}" data-d="1" ${lvl >= 10 ? 'disabled' : ''}>+</button>
    </div>`;
  }

  const VERDICTS = [
    [0.97, 'is-good', 'Muy fácil'],
    [0.85, 'is-good', 'Fácil'],
    [0.6, 'is-ok', 'Pareja'],
    [0.35, 'is-warn', 'Difícil'],
    [0, 'is-bad', 'Muy difícil'],
  ];

  function enemySim(d) {
    if (!d || !d.health) return '';
    const key = `e:${d.id || 'nuevo'}`;
    const lvl = Math.max(1, Math.min(10, (S().simLevel && S().simLevel[key]) || d.tier || 1));
    let r;
    try { r = A.EditorSim.fight([d], lvl, 300); } catch (err) { return card('Prueba de combate', `<div class="ed-dim">No se pudo probar: ${esc(err.message)}</div>`, { icon: 'd20' }); }
    const v = VERDICTS.find((x) => r.win >= x[0]);
    let compare = '';
    if (lvl === (d.tier || 1)) {
      const cal = A.EditorSim.calibration()[d.category || 'normal'];
      if (cal) {
        const catName = ({ weak: 'las criaturas débiles', normal: 'las criaturas normales', strong: 'las criaturas fuertes', boss: 'los jefes' })[d.category || 'normal'] || 'las criaturas';
        if (r.win < cal.lo - 0.03) compare = `<div class="ed-sim-note is-bad">${icon('arrow-up', 14)}<span>Más difícil que ${catName} del juego (contra ellas se gana entre ${pct(cal.lo)} y ${pct(cal.hi)}). Bajale vida, daño o precisión.</span></div>`;
        else if (r.win > cal.hi + 0.03) compare = `<div class="ed-sim-note is-warn">${icon('arrow-down', 14)}<span>Más fácil que ${catName} del juego (contra ellas se gana entre ${pct(cal.lo)} y ${pct(cal.hi)}). Subile vida, daño o defensa.</span></div>`;
        else compare = `<div class="ed-sim-note is-good">${icon('check', 14)}<span>Pareja con ${catName} del juego (contra ellas se gana entre ${pct(cal.lo)} y ${pct(cal.hi)}).</span></div>`;
      }
    }
    return card('Prueba de combate', `
      <div class="ed-sim-top">
        ${levelPicker(key, lvl)}
        <div class="ed-sim-big ${v[1]}"><b>${pct(r.win)}</b><span>gana el aventurero · ${v[2]}</span></div>
      </div>
      ${compare}
      <div class="ed-sim-lines">
        <div>El aventurero le acierta con <b>${r.needHero}+</b> (${r.hitHero}%) y necesita unos <b>${r.hitsToKill}</b> golpes para ganarle.</div>
        <div>La criatura le acierta con <b>${r.needFoe}+</b> (${r.hitFoe}%) y lo tumba en unos <b>${r.hitsToDie}</b> golpes.</div>
        <div>Las peleas duran ${String(r.rounds.toFixed(1)).replace('.', ',')} rondas${r.win ? ` y el aventurero termina con ${pct(r.hpLeft)} de su vida` : ''}.</div>
        <div class="ed-dim">Aventurero humano de nivel ${lvl}: ${r.hero.hp} de vida, ${esc(r.hero.weapon)} (${esc(r.hero.damage)}${r.hero.bonus ? `+${r.hero.bonus}` : ''}), precisión +${r.hero.attack}, defensa ${r.hero.defense}, armadura ${r.hero.armor}. Sin pociones ni hechizos.</div>
      </div>`, { icon: 'd20', cls: 'is-sim' });
  }

  // ============================================================
  // v2.3: Sugerir números (como la herramienta de autobalance de antes)
  // ============================================================

  const SUG_FIELDS = [
    ['health', 'Vida'], ['damage', 'Daño'], ['attack', 'Precisión'],
    ['difficulty', 'Defensa'], ['armor', 'Armadura'], ['speed', 'Velocidad'],
  ];

  function suggestSig(d) { return `${d.tier || 1}:${d.category || 'normal'}`; }

  function enemySuggest(d) {
    if (!d || !A.EditorSim || !A.EditorSim.STYLES) return '';
    const key = `e:${d.id || 'nuevo'}`;
    const st = (S().suggest || {})[key];
    const fresh = st && st.sig === suggestSig(d) ? st : null;
    const style = (fresh && fresh.style) || (st && st.style) || A.EditorSim.guessStyle(d);
    const styles = Object.entries(A.EditorSim.STYLES).map(([id, x]) => `
      <button type="button" class="ed-chip ${id === style ? 'is-on' : ''}" data-ed="suggest-style" data-key="${esc(key)}" data-style="${esc(id)}" title="${esc(x.hint)}">${esc(x.label)}</button>`).join('');
    const catName = ({ weak: 'débiles', normal: 'normales', strong: 'fuertes', boss: 'jefes' })[d.category || 'normal'] || 'normales';
    let body;
    if (fresh && fresh.res) {
      const r = fresh.res;
      const shown = (k, v) => (k === 'attack' ? `+${v}` : String(v));
      const rows = SUG_FIELDS.map(([k, label]) => {
        const now = d[k] == null ? '—' : shown(k, d[k]);
        const next = shown(k, r[k]);
        const same = String(d[k]) === String(r[k]);
        return `<tr class="${same ? '' : 'is-diff'}"><td>${label}</td><td class="num">${esc(now)}</td><td class="ed-sug-arrow">${same ? '' : '→'}</td><td class="num"><b>${esc(next)}</b></td></tr>`;
      }).join('');
      body = `
        <table class="ed-sug-table"><thead><tr><th></th><th>Ahora</th><th></th><th>Sugerido</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="ed-dim">Con estos números un aventurero de nivel ${d.tier || 1} le gana el <b>${pct(r.win)}</b> de las veces y pierde cerca del <b>${pct(r.cost)}</b> de su vida, como contra las demás criaturas ${catName} del juego.</div>
        <div class="ed-sug-actions">
          <button type="button" class="ed-btn is-primary" data-ed="suggest-apply" data-key="${esc(key)}">${icon('check', 15)}<span>Usar estos números</span></button>
          <button type="button" class="ed-btn" data-ed="suggest-style" data-key="${esc(key)}" data-style="${esc(style)}">${icon('d20', 15)}<span>Probar de nuevo</span></button>
        </div>`;
    } else {
      body = `<div class="ed-sug-actions"><button type="button" class="ed-btn is-primary" data-ed="suggest-style" data-key="${esc(key)}" data-style="${esc(style)}">${icon('d20', 15)}<span>Sugerir números</span></button></div>`;
    }
    return card('Sugerir números', `
      <div class="ed-dim">Elegí cómo es la criatura y te propongo vida, daño y defensas parejos con las criaturas ${catName} de nivel ${d.tier || 1}. No cambia nada hasta que toques "Usar estos números" y guardes.</div>
      <div class="ed-sug-styles">${styles}</div>
      ${body}`, { icon: 'd20', cls: 'is-suggest' });
  }

  // ============================================================
  // Escenas
  // ============================================================

  function dcHelp(dc) {
    if (!dc) return '';
    const p = (mod) => Math.max(5, Math.min(95, (21 - (dc - mod)) * 5));
    return `Sin habilidad: ${p(0)}% · con +2: ${p(2)}% · con +4: ${p(4)}%. En zonas de más nivel sube un poco.`;
  }

  function outcomeLine(o) {
    if (!o) return '';
    const bits = [];
    if (o.coins) bits.push(o.coins > 0 ? 'monedas' : 'perdés monedas');
    if (o.xp) bits.push('experiencia');
    if (o.loot) bits.push(`${o.loot} del botín`);
    if (o.items && o.items.length) bits.push(o.items.map((it) => Ed.fields.nameOf(['items', 'weapons', 'armors'], it[0])).join(', '));
    if (o.heal) bits.push(`+${Math.round(o.heal * 100)}% vida`);
    if (o.hurt) bits.push(`-${Math.round(o.hurt * 100)}% vida`);
    if (o.mana) bits.push(`+${Math.round(o.mana * 100)}% maná`);
    if (o.food) bits.push(`${o.food > 0 ? '+' : ''}${o.food} comida`);
    if (o.time) bits.push('pasa el tiempo');
    if (o.fight) bits.push(o.fight.surprise ? 'pelea (atacás primero)' : o.fight.ambush ? 'pelea (te emboscan)' : 'pelea');
    if (o.tame) bits.push('se puede domar');
    return bits.join(' · ');
  }

  function eventPreview(d) {
    const stats = (A.Explore && A.Explore.STATS) || {};
    const opts = (d.options || []).map((o) => {
      const st = o.check ? stats[o.check.stat] : null;
      return `<div class="ed-ev-opt">
        <div class="ed-ev-btn">${esc(o.label || 'Opción')}</div>
        ${o.check ? `<div class="ed-ev-check">${icon(st ? st.icon : 'd20', 14)}<span>${esc(st ? st.label : o.check.stat)} · dificultad ${o.check.dc}</span></div>` : ''}
        <div class="ed-ev-res"><b>Bien:</b> ${esc((o.ok && o.ok.text) || '—')} <span class="ed-dim">${esc(outcomeLine(o.ok))}</span></div>
        ${o.check ? `<div class="ed-ev-res"><b>Mal:</b> ${esc((o.fail && o.fail.text) || 'No sale como esperabas.')} <span class="ed-dim">${esc(outcomeLine(o.fail))}</span></div>` : ''}
      </div>`;
    }).join('');
    return `<div class="ed-ev">
      <div class="ed-ev-head">${icon(d.icon || 'scroll', 36)}<b>${esc(d.title || 'Escena')}</b></div>
      <p class="ed-ev-text">${esc(d.text || '…')}</p>
      ${opts}
    </div>`;
  }

  // ============================================================
  // Habitantes y misiones
  // ============================================================

  function npcQuests(d) {
    const qs = (A.Data.quests || []).filter((q) => q.giver === d.id);
    return card('', `
      ${qs.map((q) => `<div class="ed-mini-row">
        <span class="ed-mini-thumb">${icon(q.main ? 'crown' : 'quest', 26)}</span>
        <button type="button" class="ed-link" data-ed="open" data-col="quests" data-id="${esc(q.id)}"><b>${esc(q.title)}</b><small>${q.main ? `Historia · capítulo ${q.chapter || '?'}` : 'Encargo'}${q.minLevel ? ` · desde nivel ${q.minLevel}` : ''}</small></button>
      </div>`).join('') || '<div class="ed-empty is-small">No da misiones.</div>'}
      <div class="ed-row"><button type="button" class="ed-btn is-small" data-ed="new-quest-for" ${d.id && A.Data.getById('npcs', d.id) ? '' : 'disabled'}>${icon('plus', 14)}<span>Nueva misión de este habitante</span></button></div>`, { cls: 'is-flat' });
  }

  function priceHelp(copper) {
    if (!copper || !A.Currency) return '100 de cobre = 1 de plata · 100 de plata = 1 de oro.';
    return `Se ve como: ${esc(A.Currency.formatPrice(copper))}.`;
  }

  function questPreview(d) {
    const objs = (d.objectives || []).map((o) => `<li>${icon('check', 14)}<span>${esc(A.Quests ? A.Quests.objectiveText(o) : o.type)}</span></li>`).join('');
    const r = d.reward || {};
    const chips = [];
    if (r.xp) chips.push(`${icon('xp', 16)}<span>+${r.xp} XP</span>`);
    if (r.coins) chips.push(`${icon('coins', 16)}<span>${esc(A.Currency ? A.Currency.formatPrice(r.coins) : r.coins)}</span>`);
    for (const it of r.items || []) chips.push(`${Ed.fields.thumbOf('items', Ed.fields.findAny(['items', 'weapons', 'armors'], it[0]) ? Ed.fields.findAny(['items', 'weapons', 'armors'], it[0]).e : null, 18)}<span>${esc(Ed.fields.nameOf(['items', 'weapons', 'armors'], it[0]))}${it[1] > 1 ? ` ×${it[1]}` : ''}</span>`);
    const giver = A.Data.getById('npcs', d.giver);
    return `<div class="ed-quest">
      <div class="ed-quest-head">${icon(d.main ? 'crown' : 'quest', 28)}<div><b>${esc(d.title || 'Misión')}</b><small>${esc(giver ? giver.name : 'Sin quien la dé')}${d.minLevel ? ` · desde nivel ${d.minLevel}` : ''}</small></div></div>
      ${d.offer ? `<p class="ed-quest-offer">“${esc(d.offer)}”</p>` : ''}
      ${d.text ? `<p class="ed-dim">${esc(d.text)}</p>` : ''}
      <ul class="ed-quest-objs">${objs || '<li class="ed-dim">Sin objetivos.</li>'}</ul>
      ${chips.length ? `<div class="ed-quest-rew">${chips.map((c) => `<span class="ed-chip is-on">${c}</span>`).join('')}</div>` : ''}
    </div>`;
  }

  // ============================================================
  // Razas y armas
  // ============================================================

  /** v2.5: qué hace cada habilidad elegida para la criatura. */
  function enemySkills(d) {
    const list = A.Skills && d ? A.Skills.listFor({ skills: d.skills || [] }) : [];
    if (!list.length) return card('Habilidades', '<div class="ed-dim">Sin habilidades: solo ataca. Agregale una pasiva o una activa para que la pelea sea más interesante.</div>', { icon: 'spark' });
    const rows = list.map((sk) => `
      <div class="ed-skill">
        ${icon(sk.icon || 'star', 18)}
        <div><b>${esc(sk.name)}</b> <span class="ed-dim">· ${sk.kind === 'passive' ? 'pasiva' : 'activa'}</span><div class="ed-dim">${esc(sk.text || '')}</div></div>
      </div>`).join('');
    return card('Habilidades', `${rows}<div class="ed-dim" style="margin-top:6px">Las activas las usa a veces en su turno en vez de atacar. La prueba de combate de arriba no las cuenta.</div>`, { icon: 'spark' });
  }

  function passiveHelp(d) {
    const P = A.Passives && A.Passives.LIST && d ? A.Passives.LIST[d.passive] : null;
    if (!P) return '';
    try { return esc(typeof P.text === 'function' ? P.text({ level: 1, raceId: d.id }) : P.text || ''); } catch (err) { return ''; }
  }

  function racePreview(d) {
    const BASE = (A.Seed && A.Seed.baseStats) || { hp: 24, mana: 12, speed: 10, precision: 1, armor: 0, damage: 0, dodge: 5 };
    const b = d.bonuses || {};
    const magic = d.magic !== false && d.combatType !== 'warrior';
    const tunic = A.Data.getById('armors', 'tunica_cuero');
    const stat = (label, val, small) => `<div class="ed-stat"><span>${label}</span><b>${val}</b>${small ? `<small>${small}</small>` : ''}</div>`;
    const sp = d.startSpell ? A.Data.getById('spells', d.startSpell) : null;
    return `<div class="ed-race">
      <div class="ed-race-hero">${A.Sprites.heroHtml(d.id, { size: 96 })}<div><b>${esc(d.name || 'Raza')}</b><small>${esc(Ed.schema.L.CLASS[d.combatType] || '')}${magic && sp ? ` · nace con ${esc(sp.name)}` : ''}</small></div></div>
      <div class="ed-stats">
        ${stat('Vida', BASE.hp + (b.hp || 0))}
        ${magic ? stat('Maná', BASE.mana + (b.mana || 0)) : ''}
        ${stat('Precisión', `+${BASE.precision + (b.precision || 0)}`, 'para acertar')}
        ${stat('Daño', `1d4${(b.damage || 0) + (d.combatType === 'warrior' ? 1 : 0) ? `+${(b.damage || 0) + (d.combatType === 'warrior' ? 1 : 0)}` : ''}`, 'con la daga')}
        ${stat('Defensa', 8 + BASE.dodge + (b.dodge || 0), 'lo que necesitan para pegarle')}
        ${stat('Armadura', BASE.armor + (b.armor || 0) + (tunic ? tunic.defense || 0 : 0), 'con la túnica')}
        ${stat('Velocidad', BASE.speed + (b.speed || 0))}
      </div>
    </div>`;
  }

  function weaponFit(d) {
    if (!A.Balance || !A.Balance.weaponFit) return '';
    const sample = { warrior: 'orco', hybrid: 'humano', mage: 'gnomo' };
    const lines = Object.keys(sample).map((cls) => {
      const fit = A.Balance.weaponFit({ raceId: sample[cls], level: 1 }, d);
      // v3.4: cada clase, sus armas (las de mago, solo los magos)
      if (fit.blocked) return `<div class="ed-fit is-bad"><b>${Ed.schema.L.CLASS[cls]}</b><span>No la puede usar</span></div>`;
      const parts = [];
      if (fit.dmg) parts.push(`+${fit.dmg} de daño`);
      if (fit.atk) parts.push(`${fit.atk > 0 ? '+' : ''}${fit.atk} de precisión`);
      if (fit.spell) parts.push(`+${fit.spell} de poder mágico`);
      return `<div class="ed-fit ${fit.atk < 0 ? 'is-bad' : parts.length ? 'is-good' : ''}"><b>${Ed.schema.L.CLASS[cls]}</b><span>${parts.length ? parts.join(', ') : 'normal'}</span></div>`;
    }).join('');
    return card('Cómo le queda a cada clase (nivel 1)', lines, { cls: 'is-flat' });
  }

  /** v2.4: lo que hace un objeto, como lo lee el jugador en su ficha. */
  function itemEffects(d) {
    const lines = d && d.subtype === 'accessory'
      ? (A.Accessories ? A.Accessories.describe(d) : [])
      : (A.ItemFx ? A.ItemFx.describe(d) : []);
    const fair = d && d.subtype !== 'accessory' && d.effect && A.Balance && A.Balance.Economy && A.Balance.Economy.consumablePrice && ['heal', 'mana', 'food', 'buff'].includes(d.effect.type)
      ? A.Balance.Economy.consumablePrice(d) : 0;
    const body = `${lines.length ? `<ul class="ed-quest-objs">${lines.map((l) => `<li>${icon('star', 14)}<span>${esc(l)}</span></li>`).join('')}</ul>` : '<div class="ed-empty is-small">Todavía no hace nada.</div>'}
      ${fair ? `<div class="ed-help">Precio justo por lo que da: ${esc(A.Currency ? A.Currency.formatPrice(fair) : fair)}.</div>` : ''}`;
    return card('Así lo ve el jugador', body, { cls: 'is-flat' });
  }

  Ed.panels = {
    regionMap, regionCreatures, regionTest, regionPeople, creaturesIn,
    homeHelp, enemySim, enemySuggest, suggestSig, dcHelp, eventPreview, npcQuests, priceHelp, questPreview, passiveHelp, racePreview, weaponFit, enemySkills,
    itemEffects,
  };
})(window.Aventurs);
