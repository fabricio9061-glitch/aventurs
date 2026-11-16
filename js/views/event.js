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

  function enemiesRow(sc) {
    if (!sc.enemies || !sc.enemies.length) return '';
    const shown = sc.enemies.slice(0, 4);
    const size = shown.length === 1 ? 72 : shown.length === 2 ? 60 : 48;
    return `
      <div class="scene-foes">
        ${shown.map((e) => {
          const data = A.Data.getById('enemies', e.id) || e;
          const dc = e.difficulty != null ? e.difficulty : (data.difficulty != null ? data.difficulty : 10);
          return `
            <div class="scene-foe" title="${U().esc(data.name)}">
              <span class="scene-foe-sprite">${A.Sprites ? A.Sprites.html(e, { size }) : ''}</span>
              <span class="scene-foe-name">${U().esc(e.displayName || data.name)}</span>
              ${A.ItemSprites ? A.ItemSprites.dcBadge(dc, { size: 24, cls: 'scene-foe-dc' }) : ''}
            </div>`;
        }).join('')}
        ${sc.enemies.length > 4 ? `<div class="scene-foe is-more">+${sc.enemies.length - 4}</div>` : ''}
      </div>
    `;
  }

  function optionsHtml(sc) {
    return `
      <div class="scene-options">
        ${sc.options.map((o, i) => {
          const blocked = A.Explore.optionBlocked(o);
          const cost = o.needs && o.needs.coins
            ? `<span class="ui-check is-cost">${U().icon('coins', 16)}<span>Cuesta</span>${U().price(Math.max(1, Math.round(A.Explore && A.Rewards ? A.Rewards.coinUnit(sc.tier) * o.needs.coins : 1)), 14)}</span>`
            : o.needs && o.needs.food ? `<span class="ui-check is-cost">${U().icon('food', 16)}<span>${o.needs.food} de comida</span></span>` : '';
          return `
            <button class="scene-opt ${blocked ? 'is-blocked' : ''}" data-scene-opt="${i}" ${blocked ? 'disabled' : ''}>
              <span class="scene-opt-label">${U().esc(o.label)}</span>
              <span class="scene-opt-meta">
                ${o.check ? U().checkLine(o.check, sc.tier) : ''}
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
    return `
      <div class="scene-roll ${r.success ? 'is-ok' : 'is-fail'}">
        <span class="scene-die">${A.ItemSprites ? A.ItemSprites.dcBadge(r.d, { size: 56, title: 'Lo que salió en el dado' }) : r.d}</span>
        <span class="scene-roll-text">
          <span class="scene-roll-math">${U().esc(st.label)}: ${r.d}${r.mod ? ` + ${r.mod}` : ''} = <b>${r.total}</b> contra ${r.dc}${r.lucky ? ' (suerte: volviste a tirar el 1)' : ''}</span>
          <span class="scene-roll-verdict">${r.d === 20 ? '¡Veinte natural!' : r.d === 1 ? 'Uno natural...' : r.success ? '¡Lo lograste!' : 'No alcanzó.'}</span>
        </span>
      </div>
    `;
  }

  function resultHtml(sc) {
    const res = sc.result;
    const btn = res.fight
      ? `${U().icon('swords', 22)}<span>${res.fight.surprise ? '¡Atacar primero!' : res.fight.ambush ? '¡Defenderte!' : '¡A pelear!'}</span>`
      : res.tame ? `${U().icon('paw', 22)}<span>Acercarte</span>` : `<span>Seguir</span>`;
    return `
      <div class="scene-result ${res.success ? 'is-ok' : 'is-fail'}">
        <div class="scene-choice">${U().icon('check', 14)}<span>${U().esc(res.label)}</span></div>
        ${rollHtml(res)}
        ${res.text ? `<p class="scene-outcome">${U().esc(res.text)}</p>` : ''}
        ${U().chips(res.chips)}
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
          <p class="scene-text">${U().esc(sc.text)}</p>
          ${enemiesRow(sc)}
          ${sc.stage === 'result' && sc.result ? resultHtml(sc) : optionsHtml(sc)}
        </div>
      </div>
    `;
  }

  function bind(overlay, sc) {
    overlay.querySelectorAll('[data-scene-opt]').forEach((b) => {
      b.addEventListener('click', () => {
        if (b.disabled) return;
        overlay.querySelectorAll('[data-scene-opt]').forEach((x) => { x.disabled = true; });
        A.Explore.choose(Number(b.dataset.sceneOpt));
      });
    });
    const next = overlay.querySelector('[data-scene-next]');
    if (next) {
      next.addEventListener('click', () => A.Explore.proceed());
      setTimeout(() => { try { next.focus({ preventScroll: true }); } catch (e) {} }, 50);
    }
  }

  A.ModalViews = A.ModalViews || {};
  A.ModalViews.event = { render, bind, blocking: true };
})(window.Aventurs);
