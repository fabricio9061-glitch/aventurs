/* ============================================================
   Aventurs — Pantalla de escena (v2.0)
   Lo que pasa al explorar o al dormir al raso. Registrada como
   A.ModalViews.event (ver js/views/modals.js).

     elegir:    escena + 2 o 3 opciones con su tirada (y el % de éxito)
     resultado: el dado, lo que pasó y lo que ganaste o perdiste
   ============================================================ */

(function (A) {
  'use strict';

  const U = () => A.UI;

  // v3.0: en grupo, si eligió el compañero, se cuenta sobre él
  function chooserName(res) {
    if (!res || !res.hid || !A.State.me || A.State.hidOf(A.State.me()) === res.hid) return null;
    const h = A.State.heroById ? A.State.heroById(res.hid) : null;
    return (h && h.name) || res.by || 'Tu compañero';
  }

  function enemiesRow(sc) {
    // v3.3: en grupo, una escena que puede terminar en pelea ya sabe contra qué (sc.foes)
    const sure = sc.enemies && sc.enemies.length;
    const list = sure ? sc.enemies : (sc.foes && sc.foes.length && sc.stage !== 'result' ? sc.foes : null);
    if (!list) return '';
    const max = sc.party ? 7 : 4;
    const shown = list.slice(0, max);
    const size = shown.length === 1 ? 72 : shown.length === 2 ? 60 : shown.length <= 4 ? 48 : 40;
    const words = A.Encounter && A.Encounter.describeGroup ? A.Encounter.describeGroup(list) : '';
    const note = !sure
      ? `<p class="scene-foes-note">Si terminan peleando, es contra ${U().esc(words)}.</p>`
      : sc.party ? `<p class="scene-foes-note">En total ${list.length === 1 ? 'es' : 'son'} ${U().esc(words)}: ya están contadas las que se suman por ir en grupo.</p>` : '';
    return `
      ${note}
      <div class="scene-foes ${sure ? '' : 'is-maybe'} ${shown.length > 4 ? 'is-many' : ''}">
        ${shown.map((e) => {
          const data = A.Data.getById('enemies', e.id) || e;
          const dc = e.difficulty != null ? e.difficulty : (data.difficulty != null ? data.difficulty : 10);
          // v2.5: habilidades en el globito y marca dorada para la élite
          const skills = A.Skills ? A.Skills.listFor(e).map((sk) => sk.name).join(', ') : '';
          const tip = `${e.name || data.name}${e.elite ? ' (élite: más vida, más daño y mejor botín)' : ''}${skills ? `\nHabilidades: ${skills}` : ''}`;
          return `
            <div class="scene-foe ${e.elite ? 'is-elite' : ''}" title="${U().esc(tip)}">
              <span class="scene-foe-sprite">${A.Sprites ? A.Sprites.html(e, { size }) : ''}</span>
              ${e.elite ? `<span class="scene-foe-elite">${U().icon('elite', 26)}</span>` : ''}
              <span class="scene-foe-name">${U().esc(e.displayName || e.name || data.name)}</span>
              ${A.ItemSprites ? A.ItemSprites.dcBadge(dc, { size: 24, cls: 'scene-foe-dc' }) : ''}
            </div>`;
        }).join('')}
        ${list.length > max ? `<div class="scene-foe is-more">+${list.length - max}</div>` : ''}
      </div>
    `;
  }

  // ============================================================
  // v3.1: en grupo se vota
  // ============================================================

  function myHid() { return A.State.me && A.State.hidOf ? A.State.hidOf(A.State.me()) : 'me'; }
  function nameOfHid(hid) {
    const h = A.State.heroById ? A.State.heroById(hid) : null;
    if (h && h.name) return h.name;
    const m = A.Party && A.Party.member ? A.Party.member(hid) : null;
    return (m && m.name) || 'Tu compañero';
  }
  function votersFor(sc, i) {
    const out = [];
    for (const hid of Object.keys(sc.votes || {})) if (sc.votes[hid] === i) out.push(hid);
    return out;
  }
  function voteTags(sc, i) {
    const list = votersFor(sc, i);
    if (!list.length) return '';
    return `<span class="scene-votes">${list.map((hid) => `<span class="scene-vote ${hid === myHid() ? 'is-mine' : ''}">${U().icon('check', 12)}${U().esc(hid === myHid() ? 'Tu voto' : nameOfHid(hid))}</span>`).join('')}</span>`;
  }
  function namesY(list) {
    if (list.length <= 1) return list.join('');
    return `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`;
  }
  function voteBar(sc) {
    if (!sc.party || sc.stage !== 'choose') return '';
    const mine = sc.votes && sc.votes[myHid()] != null;
    const others = Object.keys(sc.votes || {}).filter((h) => h !== myHid());
    // v3.2: hasta 4: a quiénes se espera
    const voters = Array.isArray(sc.voters) && sc.voters.length ? sc.voters : null;
    const waiting = voters ? voters.filter((h) => h !== myHid() && !(sc.votes && sc.votes[h] != null)) : null;
    const ally = A.Party && A.Party.ally ? A.Party.ally() : null;
    const allyName = waiting && waiting.length ? namesY(waiting.map(nameOfHid)) : ally ? ally.name : 'tu compañero';
    const votedNames = namesY(others.map(nameOfHid));
    let text = `Voten qué hacer. Si eligen lo mismo, lo hace el que tiene más chance; si no, gana lo más votado, y si empatan decide un dado.`;
    if (mine && (waiting ? waiting.length : !others.length)) text = `Votaste. Esperando a ${allyName}… (podés cambiar tu voto)`;
    else if (!mine && others.length) text = `${votedNames} ya ${others.length > 1 ? 'votaron' : 'votó'}. Te toca elegir.`;
    return `
      <div class="scene-party is-vote">
        ${U().icon('party', 16)}<span>${U().esc(text)}</span>
        ${mine && (waiting ? waiting.length : !others.length) ? `<button class="btn-mini scene-force is-hidden" data-scene-force title="Si alguien no está, se decide con los votos que hay">Decidir sin esperar</button>` : ''}
      </div>`;
  }
  function voteResultHtml(res) {
    const v = res && res.vote;
    if (!v) return '';
    if (v.agreed) {
      return `<div class="scene-vote-res">${U().icon('party', 16)}<span>Votaron lo mismo: lo hace ${U().esc(v.winner === myHid() ? 'vos' : v.winnerName)}, que tenía más chance.</span></div>`;
    }
    if (v.majority) {
      const won = (v.votes || []).find((x) => x.hid === v.winner);
      return `<div class="scene-vote-res">${U().icon('party', 16)}<span>Ganó lo más votado${won ? `: ${U().esc(won.label.toLowerCase())}` : ''}. Lo hace ${U().esc(v.winner === myHid() ? 'vos' : v.winnerName)}, que tenía más chance.</span></div>`;
    }
    const rolls = (v.rolls || []).map((r) => `${U().esc(r.hid === myHid() ? 'Vos' : r.name)} sacó <b>${r.d}</b>`).join(' · ');
    const choice = (v.votes || []).find((x) => x.hid === v.winner);
    return `
      <div class="scene-vote-res is-dice">
        ${U().icon('dice', 20)}
        <span>Votaron distinto. ${rolls}. Gana ${U().esc(v.winner === myHid() ? 'tu voto' : `el voto de ${v.winnerName}`)}${choice ? `: ${U().esc(choice.label.toLowerCase())}` : ''}.</span>
      </div>`;
  }

  /** v3.3: en grupo, quién tira esta (el más hábil) o cuánto suma ayudarse. */
  function partyTag(pt) {
    const bits = [];
    if (pt.hid) bits.push(pt.hid === myHid() ? 'La tirás vos, el más hábil' : `La tira ${pt.name}, el más hábil`);
    if (pt.help) bits.push(`Entre todos: +${pt.help}`);
    return bits.length ? `<span class="ui-check is-party">${U().icon('party', 14)}<span>${U().esc(bits.join(' · '))}</span></span>` : '';
  }

  // ============================================================
  // v3.23: lo que puede pasar con cada opción (íconos chicos) y la cadena
  // ============================================================

  /** Íconos de lo que trae un resultado: [{ icon, text, tone }] */
  function previewOf(out, opt) {
    if (!out) return [];
    const needs = (opt && opt.needs) || {};
    const bits = [];
    const add = (icon, text, tone, cls) => bits.push({ icon, text, tone, cls });
    if (out.fight) add('swords', out.fight.surprise ? 'Pelea con ventaja' : out.fight.ambush ? 'Te atacan primero' : 'Pelea', out.fight.ambush ? 'bad' : 'warn');
    if (out.train) add('up', out.train === 'any' || !A.Explore.STATS[out.train] ? '+1 para siempre' : `+1 ${A.Explore.STATS[out.train].label}`, 'gold');
    if (typeof out.coins === 'number' && out.coins > 0) add('coin', 'Monedas', 'good');
    if ((out.items && out.items.length) || out.loot) add('bag', out.loot > 1 || (out.items && out.items.length > 1) ? 'Botín' : 'Un hallazgo', 'good');
    if (out.heal) add('heart', 'Vida', 'good');
    if (out.mana) add('spell', 'Maná', 'mana');
    if (out.food > 0) add('food', 'Comida', 'good');
    if (out.xp >= 0.5) add('xp', 'XP', 'gold');
    if (out.hurt) add('heart', 'Herida', 'bad', 'is-hurt');
    // lo que cuesta la opción ya se ve en "Cuesta"
    if (typeof out.coins === 'number' && out.coins < 0 && !needs.coins) add('coin', 'Perdés plata', 'bad');
    if (out.food < 0 && !needs.food) add('food', 'Hambre', 'bad');
    if (out.time >= 2) add('hourglass', 'Tiempo', 'bad');
    if (out.tame) add('paw', 'Domarla', 'good');
    if (out.study) add('eye', '+2 después', 'good');
    if (out.bonus) add('eye', `+${out.bonus} al paso siguiente`, 'good');
    return bits.slice(0, 4);
  }
  function previewRow(o) {
    // las de criaturas ya cuentan "Bien: ... Mal: ..." en su texto
    if (o.hint) return '';
    const ok = previewOf(o.ok, o);
    const bad = o.check ? previewOf(o.fail || { text: '' }, o) : [];
    if (!ok.length && !bad.length) return '';
    const pill = (b) => `<span class="sp-bit is-${b.tone}">${U().icon(b.icon, 14, b.cls)}<span>${U().esc(b.text)}</span></span>`;
    return `
      <span class="scene-preview">
        ${ok.length ? `<span class="sp-side is-ok">${o.check ? '<span class="sp-tag">Bien</span>' : ''}${ok.map(pill).join('')}</span>` : ''}
        ${bad.length ? `<span class="sp-side is-bad"><span class="sp-tag">Mal</span>${bad.map(pill).join('')}</span>` : ''}
      </span>`;
  }
  function chainLeads(o) {
    return !!((o.ok && o.ok.next) || (o.fail && o.fail.next));
  }

  /** Los puntitos de "Paso 2 de 3" y lo que ya pasó. */
  function chainHtml(sc) {
    const max = sc.stepsMax || 1;
    if (max <= 1 && !(sc.trail && sc.trail.length)) return '';
    const now = sc.stepNo || 1;
    const trail = sc.trail || [];
    const dots = [];
    for (let i = 1; i <= Math.max(max, now); i++) {
      const t = trail[i - 1 - Math.max(0, (now - 1) - trail.length)];
      const cls = i < now ? (t && !t.ok ? 'is-fail' : 'is-done') : i === now ? 'is-now' : '';
      dots.push(`<span class="sc-dot ${cls}" title="Paso ${i}">${i < now ? U().icon(t && !t.ok ? 'skull' : 'check', 12) : i}</span>`);
    }
    return `
      <div class="scene-chain">
        <span class="sc-label">${U().icon('compass', 16)}<span>Historia en ${max} pasos · <b>Paso ${now}</b></span></span>
        <span class="sc-dots">${dots.join('<span class="sc-line"></span>')}</span>
      </div>
      ${trail.length ? `<div class="scene-trail">${trail.map((t) => `<span class="st-item ${t.ok ? 'is-ok' : 'is-fail'}">${U().icon(t.ok ? 'check' : 'skull', 12)}<span>${U().esc(t.label)}</span></span>`).join('')}</div>` : ''}`;
  }

  function optionsHtml(sc) {
    if (A.Explore.ensureKeys) A.Explore.ensureKeys(sc);
    // v2.5: con muchas opciones van en dos columnas (entra todo sin bajar)
    const many = sc.options.length > 3;
    return `
      <div class="scene-options ${many ? 'is-grid' : ''}">
        ${sc.options.map((o, i) => {
          const blocked = A.Explore.optionBlocked(o);
          const needItem = o.needs && o.needs.item ? (A.Inventory && A.Inventory.resolveData ? A.Inventory.resolveData(o.needs.item) : A.Data.getById('items', o.needs.item)) : null;
          const cost = o.needs && o.needs.coins
            ? `<span class="ui-check is-cost">${U().icon('coins', 16)}<span>Cuesta</span>${U().price(Math.max(1, Math.round(A.Explore && A.Rewards ? A.Rewards.coinUnit(sc.tier) * o.needs.coins : 1)), 14)}</span>`
            : o.needs && o.needs.food ? `<span class="ui-check is-cost">${U().icon('food', 16)}<span>${o.needs.food} de comida</span></span>`
            : needItem ? `<span class="ui-check is-cost">${A.ItemSprites ? A.ItemSprites.html(needItem.id, { size: 18 }) : ''}<span>Gastás 1</span></span>` : '';
          return `
            <button class="scene-opt ${blocked ? 'is-blocked' : ''} ${sc.votes && sc.votes[myHid()] === i ? 'is-voted' : ''} ${chainLeads(o) ? 'is-chain' : ''} ${o.check ? `is-stat-${U().esc(o.check.stat)}` : 'is-free'}" data-scene-opt="${U().esc(o.key || String(i))}" ${blocked ? 'disabled' : ''}>
              <span class="scene-opt-label">${U().esc(o.label)}${chainLeads(o) ? `<span class="scene-opt-more" title="Esta opción sigue la historia">${U().icon('compass', 12)}Sigue</span>` : ''}${sc.party ? voteTags(sc, i) : ''}</span>
              ${o.hint ? `<span class="scene-opt-hint">${U().esc(o.hint)}</span>` : ''}
              ${sc.kind === 'event' || sc.kind === 'custom' ? previewRow(o) : ''}
              <span class="scene-opt-meta">
                ${o.check ? U().checkLine(o.check, sc.tier, sc.bonus || 0, sc.party ? o.party : null) : ''}
                ${sc.party && o.party ? partyTag(o.party) : ''}
                ${cost}
                ${!o.check && !cost ? `<span class="ui-check is-safe">${U().icon('check', 14)}<span>Sin tirada</span></span>` : ''}
                ${blocked ? `<span class="scene-opt-why">${U().esc(blocked)}</span>` : ''}
              </span>
            </button>`;
        }).join('')}
      </div>
    `;
  }

  function rollHtml(res) {
    const r = res.roll;
    if (!r) return '';
    const st = A.Explore.STATS[res.check.stat] || { label: 'Tirada' };
    // v3.3: en grupo, a veces tira el más hábil (r.byHid) y a veces se ayudan entre todos (r.help)
    const other = r.byHid ? (r.byHid === myHid() ? null : r.by) : chooserName(res);
    const who = r.byHid ? (other ? `Lo intenta ${other}, el más hábil · ` : 'Lo intentás vos, el más hábil · ') : other ? `${other} · ` : '';
    // la ayuda ya está sumada en r.mod: se muestra aparte (dado + bonus + ayuda)
    const base = r.help ? r.mod - r.help : r.mod;
    const sum = `${base > 0 ? ` + ${base}` : base < 0 ? ` - ${-base}` : ''}${r.help ? ` + ${r.help} de ayuda` : ''}`;
    const verdict = r.d === 20 ? '¡Veinte natural!' : r.d === 1 ? 'Uno natural...'
      : r.success ? (r.help ? '¡Lo lograron entre todos!' : other ? '¡Lo logró!' : '¡Lo lograste!')
        : (r.help ? 'Ni entre todos alcanzó.' : 'No alcanzó.');
    return `
      <div class="scene-roll ${r.success ? 'is-ok' : 'is-fail'}">
        <span class="scene-die">${A.ItemSprites ? A.ItemSprites.dcBadge(r.d, { size: 56, title: 'Lo que salió en el dado' }) : r.d}</span>
        <span class="scene-roll-text">
          <span class="scene-roll-math">${U().esc(who)}${U().esc(st.label)}: ${r.d}${U().esc(sum)} = <b>${r.total}</b> contra ${r.dc}${r.lucky ? (other ? ' (suerte: volvió a tirar el 1)' : ' (suerte: volviste a tirar el 1)') : ''}</span>
          <span class="scene-roll-verdict">${verdict}</span>
        </span>
      </div>
    `;
  }

  /** v3.2: en grupo, lo que le tocó a cada uno (vos primero). */
  function groupChipsHtml(group) {
    const me = myHid();
    const rows = (group || []).filter((g) => g.chips && g.chips.length).sort((a, b) => (a.hid === me ? -1 : b.hid === me ? 1 : 0));
    if (!rows.length) return '';
    return `
        <div class="scene-group">
          ${rows.map((g) => `<div class="scene-group-row ${g.hid === me ? 'is-me' : ''}"><span class="scene-group-who">${g.hid === me ? 'Vos' : U().esc(g.name)}</span>${U().chips(g.chips)}</div>`).join('')}
        </div>`;
  }

  function resultHtml(sc) {
    const res = sc.result;
    const other = chooserName(res);
    const btn = res.fight
      ? `${U().icon('swords', 22)}<span>${res.fight.surprise ? '¡Atacar primero!' : res.fight.ambush ? (sc.party ? '¡A defenderse!' : '¡Defenderte!') : '¡A pelear!'}</span>`
      : res.tame ? `${U().icon('paw', 22)}<span>${other ? 'Seguir' : 'Acercarte'}</span>`
        : res.again ? `${U().icon('eye', 22)}<span>Decidir qué hacer (+2)</span>`
          : res.next ? `${U().icon('compass', 22)}<span>Seguir la historia${res.nextBonus ? ` (+${res.nextBonus})` : ''}</span>` : `<span>${sc.stepsMax > 1 ? 'Terminar' : 'Seguir'}</span>`;
    // v3.3: las escenas de grupo ya vienen en plural: no se pasan a tercera persona
    const text = other && A.Persp && !res.plural ? A.Persp.third(res.text, other) : res.text;
    return `
      <div class="scene-result ${res.success ? 'is-ok' : 'is-fail'}">
        ${voteResultHtml(res)}
        <div class="scene-choice">${U().icon('check', 14)}<span>${other ? `${U().esc(other)} ${res.vote ? 'hace' : 'eligió'}: ` : ''}${U().esc(res.label)}</span></div>
        ${rollHtml(res)}
        ${res.roll && res.roll.feat ? `<div class="scene-feat">${U().icon('up', 18)}<span>¡Hazaña! Lo ${res.roll.byHid && res.roll.byHid !== myHid() ? `logró ${U().esc(res.roll.by)}` : 'lograste'} contra todo pronóstico: +1 para siempre en ${U().esc((A.Explore.STATS[res.check.stat] || {}).label || '')}.</span></div>` : ''}
        ${text ? `<p class="scene-outcome">${U().esc(text)}</p>` : ''}
        ${res.studied && res.studied.length ? `<p class="scene-studied">${U().icon('skulls', 16)}<span>Al bestiario: ${U().esc(res.studied.join(', '))} (ya conocés sus habilidades y su botín).</span></p>` : ''}
        ${res.group ? groupChipsHtml(res.group) : `
        ${res.chips && res.chips.length && other ? `<div class="scene-for">Para ${U().esc(other)}:</div>` : ''}
        ${U().chips(res.chips)}`}
        <div class="scene-actions">
          ${res.next ? `<span class="scene-next-note">Paso ${(sc.stepNo || 1) + 1} de ${Math.max(sc.stepsMax || 1, (sc.stepNo || 1) + 1)}</span>` : ''}
          <button class="btn-primary scene-next ${res.fight ? 'is-fight' : ''} ${res.next ? 'is-chain' : ''}" data-scene-next>${btn}</button>
        </div>
      </div>
    `;
  }

  /** v3.3: con poca vida, un golpe de la escena te puede matar: se avisa antes de elegir. */
  function lowHpHtml() {
    const p = A.State.player;
    if (!p || !(p.maxHp > 0) || p.hp > Math.max(3, Math.round(p.maxHp * 0.3))) return '';
    return `<div class="scene-warn">${U().icon('skull', 16)}<span>Te queda poca vida (${p.hp}): si algo sale mal, podés morir.</span></div>`;
  }

  function render(sc) {
    if (!sc || !sc.options) return '<div class="modal"><div class="modal-body">Nada por acá.</div></div>';
    const region = A.Data.getById('regions', sc.regionId);
    const biome = (region && region.biome) || 'plains';
    return `
      <div class="modal scene-modal is-${sc.kind} biome-${biome} ${sc.stepsMax > 1 ? 'is-chain' : ''} ${sc.party ? 'is-party' : ''}" role="dialog" aria-modal="true" aria-label="${U().esc(sc.title)}">
        <div class="scene-art">
          ${A.Scenes && region ? `<span class="scene-art-land">${A.Scenes.html(region)}</span>` : ''}
          <span class="scene-art-icon">${U().icon(sc.icon || 'scroll', 64)}</span>
          <span class="scene-art-place">${U().biomeIcon(region, 18)}<span>${U().esc(region ? region.name : '')}</span></span>
          <span class="scene-art-kind">${sc.party ? `${U().icon('party', 14)}<span>En grupo</span>` : sc.kind === 'creature' || sc.kind === 'night' ? `${U().icon('paw', 14)}<span>Criatura</span>` : sc.stepsMax > 1 ? `${U().icon('compass', 14)}<span>Historia</span>` : `${U().icon('scroll', 14)}<span>Suceso</span>`}</span>
          ${U().voiceToggle ? `<span class="scene-voice">${U().voiceToggle(20)}</span>` : ''}
        </div>
        <div class="scene-body">
          <h2 class="scene-title">${U().esc(sc.title)}${sc.stepTitle ? `<small class="scene-subtitle">${U().esc(sc.stepTitle)}</small>` : ''}</h2>
          ${chainHtml(sc)}
          ${voteBar(sc)}
          <p class="scene-text">${U().esc(sc.text)}</p>
          ${enemiesRow(sc)}
          ${sc.stage === 'result' && sc.result ? resultHtml(sc) : `${lowHpHtml()}${optionsHtml(sc)}`}
        </div>
      </div>
    `;
  }

  // v3.1: la voz del narrador lee la escena (una vez cada parte)
  let spokenKey = null;
  function speak(sc) {
    if (!A.Voice || !A.Voice.isOn() || !sc) return;
    const key = `${sc.regionId}|${sc.title}|${sc.stepNo || 1}|${sc.text}|${sc.stage}|${sc.result ? sc.result.label : ''}`;
    if (key === spokenKey) return;
    spokenKey = key;
    if (sc.stage === 'result' && sc.result) {
      const other = chooserName(sc.result);
      const text = other && A.Persp && !sc.result.plural ? A.Persp.third(sc.result.text, other) : sc.result.text;
      A.Voice.say(text, { now: true });
    } else {
      A.Voice.say(`${sc.title}. ${sc.text}`, { now: true });
    }
  }

  // v3.3: al prender la voz con el parlante de la escena, lee la escena enseguida
  if (A.Bus) {
    A.Bus.on('voice:changed', (e) => {
      if (!e || !e.on || !A.State.ui || A.State.ui.openModal !== 'event') return;
      spokenKey = null;
      speak(A.State.ui.modalPayload);
    });
  }

  let forceTimer = null;
  // v3.22.2: si la lista de opciones cambió (o se pasó del resultado a elegir), los clicks
  // esperan un momento: el segundo click de un doble click caía en la opción que quedó ahí
  let lastOptsSig = '';
  let armAt = 0;
  function bind(overlay, sc) {
    speak(sc);
    const sig = sc && sc.stage === 'choose' ? `${sc.title}|${(sc.options || []).map((o) => o.key || o.label).join(',')}` : '';
    if (sig && sig !== lastOptsSig) armAt = Date.now() + 450;
    lastOptsSig = sig;
    overlay.querySelectorAll('[data-scene-opt]').forEach((b) => {
      b.addEventListener('click', (ev) => {
        if (b.disabled || Date.now() < armAt) return;
        if (ev && ev.detail > 1) return; // el segundo click de un doble click
        overlay.querySelectorAll('[data-scene-opt]').forEach((x) => { x.disabled = true; });
        const ref = b.dataset.sceneOpt;
        A.Explore.choose(/^\d+$/.test(ref) ? Number(ref) : ref);
      });
    });
    // v3.1: si el compañero no vota, a los 20 segundos se puede decidir sin esperar
    clearTimeout(forceTimer);
    const force = overlay.querySelector('[data-scene-force]');
    if (force && sc) {
      const at = (sc.votedAt && sc.votedAt[myHid()]) || Date.now();
      const wait = Math.max(0, 20000 - (Date.now() - at));
      forceTimer = setTimeout(() => force.classList.remove('is-hidden'), wait);
      force.addEventListener('click', () => {
        const idx = sc.votes ? sc.votes[myHid()] : null;
        const o = idx != null ? sc.options[idx] : null;
        if (o) A.Explore.choose(o.key || idx, { force: true });
      });
    }
    const next = overlay.querySelector('[data-scene-next]');
    if (next) {
      next.addEventListener('click', () => { if (next.disabled) return; next.disabled = true; A.Explore.proceed(); });
      setTimeout(() => { try { next.focus({ preventScroll: true }); } catch (e) {} }, 50);
    }
  }

  A.ModalViews = A.ModalViews || {};
  A.ModalViews.event = { render, bind, blocking: true };
})(window.Aventurs);
