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
    if (!sc.enemies || !sc.enemies.length) return '';
    const shown = sc.enemies.slice(0, 4);
    const size = shown.length === 1 ? 72 : shown.length === 2 ? 60 : 48;
    return `
      <div class="scene-foes">
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
        ${sc.enemies.length > 4 ? `<div class="scene-foe is-more">+${sc.enemies.length - 4}</div>` : ''}
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

  function optionsHtml(sc) {
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
            <button class="scene-opt ${blocked ? 'is-blocked' : ''} ${sc.votes && sc.votes[myHid()] === i ? 'is-voted' : ''}" data-scene-opt="${i}" ${blocked ? 'disabled' : ''}>
              <span class="scene-opt-label">${U().esc(o.label)}${sc.party ? voteTags(sc, i) : ''}</span>
              ${o.hint ? `<span class="scene-opt-hint">${U().esc(o.hint)}</span>` : ''}
              <span class="scene-opt-meta">
                ${o.check ? U().checkLine(o.check, sc.tier, sc.bonus || 0) : ''}
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
    const other = chooserName(res);
    return `
      <div class="scene-roll ${r.success ? 'is-ok' : 'is-fail'}">
        <span class="scene-die">${A.ItemSprites ? A.ItemSprites.dcBadge(r.d, { size: 56, title: 'Lo que salió en el dado' }) : r.d}</span>
        <span class="scene-roll-text">
          <span class="scene-roll-math">${other ? `${U().esc(other)} · ` : ''}${U().esc(st.label)}: ${r.d}${r.mod ? ` + ${r.mod}` : ''} = <b>${r.total}</b> contra ${r.dc}${r.lucky ? (other ? ' (suerte: volvió a tirar el 1)' : ' (suerte: volviste a tirar el 1)') : ''}</span>
          <span class="scene-roll-verdict">${r.d === 20 ? '¡Veinte natural!' : r.d === 1 ? 'Uno natural...' : r.success ? (other ? '¡Lo logró!' : '¡Lo lograste!') : 'No alcanzó.'}</span>
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
        : res.again ? `${U().icon('eye', 22)}<span>Decidir qué hacer (+2)</span>` : `<span>Seguir</span>`;
    const text = other && A.Persp ? A.Persp.third(res.text, other) : res.text;
    return `
      <div class="scene-result ${res.success ? 'is-ok' : 'is-fail'}">
        ${voteResultHtml(res)}
        <div class="scene-choice">${U().icon('check', 14)}<span>${other ? `${U().esc(other)} ${res.vote ? 'hace' : 'eligió'}: ` : ''}${U().esc(res.label)}</span></div>
        ${rollHtml(res)}
        ${text ? `<p class="scene-outcome">${U().esc(text)}</p>` : ''}
        ${res.studied && res.studied.length ? `<p class="scene-studied">${U().icon('skulls', 16)}<span>Al bestiario: ${U().esc(res.studied.join(', '))} (ya conocés sus habilidades y su botín).</span></p>` : ''}
        ${res.group ? groupChipsHtml(res.group) : `
        ${res.chips && res.chips.length && other ? `<div class="scene-for">Para ${U().esc(other)}:</div>` : ''}
        ${U().chips(res.chips)}`}
        <div class="scene-actions">
          <button class="btn-primary scene-next ${res.fight ? 'is-fight' : ''}" data-scene-next>${btn}</button>
        </div>
      </div>
    `;
  }

  function render(sc) {
    if (!sc || !sc.options) return '<div class="modal"><div class="modal-body">Nada por acá.</div></div>';
    const region = A.Data.getById('regions', sc.regionId);
    const biome = (region && region.biome) || 'plains';
    return `
      <div class="modal scene-modal is-${sc.kind} biome-${biome}" role="dialog" aria-modal="true" aria-label="${U().esc(sc.title)}">
        <div class="scene-art">
          <span class="scene-art-icon">${U().icon(sc.icon || 'scroll', 64)}</span>
          <span class="scene-art-place">${U().biomeIcon(region, 18)}<span>${U().esc(region ? region.name : '')}</span></span>
        </div>
        <div class="scene-body">
          <h2 class="scene-title">${U().esc(sc.title)}</h2>
          ${voteBar(sc)}
          <p class="scene-text">${U().esc(sc.text)}</p>
          ${enemiesRow(sc)}
          ${sc.stage === 'result' && sc.result ? resultHtml(sc) : optionsHtml(sc)}
        </div>
      </div>
    `;
  }

  // v3.1: la voz del narrador lee la escena (una vez cada parte)
  let spokenKey = null;
  function speak(sc) {
    if (!A.Voice || !A.Voice.isOn() || !sc) return;
    const key = `${sc.regionId}|${sc.title}|${sc.text}|${sc.stage}|${sc.result ? sc.result.label : ''}`;
    if (key === spokenKey) return;
    spokenKey = key;
    if (sc.stage === 'result' && sc.result) {
      const other = chooserName(sc.result);
      const text = other && A.Persp ? A.Persp.third(sc.result.text, other) : sc.result.text;
      A.Voice.say(text, { now: true });
    } else {
      A.Voice.say(`${sc.title}. ${sc.text}`, { now: true });
    }
  }

  let forceTimer = null;
  function bind(overlay, sc) {
    speak(sc);
    overlay.querySelectorAll('[data-scene-opt]').forEach((b) => {
      b.addEventListener('click', () => {
        if (b.disabled) return;
        overlay.querySelectorAll('[data-scene-opt]').forEach((x) => { x.disabled = true; });
        A.Explore.choose(Number(b.dataset.sceneOpt));
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
        if (idx != null) A.Explore.choose(idx, { force: true });
      });
    }
    const next = overlay.querySelector('[data-scene-next]');
    if (next) {
      next.addEventListener('click', () => A.Explore.proceed());
      setTimeout(() => { try { next.focus({ preventScroll: true }); } catch (e) {} }, 50);
    }
  }

  A.ModalViews = A.ModalViews || {};
  A.ModalViews.event = { render, bind, blocking: true };
})(window.Aventurs);
