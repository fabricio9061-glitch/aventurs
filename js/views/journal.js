/* ============================================================
   Aventurs — Diario de viaje (v3.0)
   Un solo lugar para lo que pasó y lo que falta:
     Misiones  - la historia principal, los encargos y lo terminado
     Crónicas  - lo que hiciste, agrupado por día y por lugar,
                 sin repetir la misma línea diez veces
     Bestiario - las criaturas que descubriste (v3.1)
   Registrado como A.ModalViews.journal y 'chronicles-full'.
   ============================================================ */

(function (A) {
  'use strict';

  const U = () => A.UI;

  const TYPE_ICON = {
    combat: 'swords', loot: 'coins', heal: 'heart', shop: 'shop', travel: 'boot',
    craft: 'anvil', spell: 'book', rest: 'tent', item: 'bag', note: 'feather',
    system: 'star', region: 'pin', quest: 'quest',
  };

  function chronicleIcon(type, size) { return U().icon(TYPE_ICON[type] || 'feather', size || 18, 'px-soft'); }

  // ============================================================
  // Misiones
  // ============================================================

  function objList(q) {
    return `<ul class="qc-objs">${q.objectives.map((o, i) => {
      const pr = A.Quests.objectiveProgress(q, i);
      const hint = !pr.done && A.Quests.objectiveHint ? A.Quests.objectiveHint(o) : '';
      return `
        <li class="qc-obj ${pr.done ? 'is-done' : ''}">
          <span class="qc-box">${pr.done ? U().icon('check', 14) : ''}</span>
          <span>${U().esc(A.Quests.objectiveText(o))}${hint ? ` <small class="qc-hint">(${U().esc(hint)})</small>` : ''}</span>
          ${(o.count || 1) > 1 ? `<span class="qc-count num">${pr.have}/${pr.need}</span>` : ''}
        </li>`;
    }).join('')}</ul>`;
  }

  function chapterTag(q) {
    const total = A.Quests.mainCount ? A.Quests.mainCount() : 0;
    return `Historia · ${q.chapter}${total ? `/${total}` : ''}`;
  }

  function questBlock(q) {
    const st = A.Quests.status(q.id);
    const giver = A.Data.getById('npcs', q.giver);
    const region = giver ? A.Data.getById('regions', giver.region) : null;
    return `
      <article class="quest-card is-${st} ${q.main ? 'is-main' : ''}">
        <header class="qc-head">
          ${U().icon(q.main ? 'crown' : 'scroll', 22)}
          <span class="qc-title">${U().esc(q.title)}</span>
          <span class="qc-tag">${q.main ? chapterTag(q) : 'Encargo'}</span>
        </header>
        <p class="qc-text">${U().esc(q.text)}</p>
        ${objList(q)}
        ${st === 'ready' && giver ? `<p class="qc-where">${U().icon('question', 16)}<span>Volvé con ${U().esc(giver.name)}${region ? ` (${U().esc(region.name)})` : ''} para cobrar.</span></p>` : ''}
      </article>
    `;
  }

  function renderQuests() {
    if (!A.Quests) return '';
    const active = A.Quests.activeList();
    const main = active.filter((q) => q.main);
    const side = active.filter((q) => !q.main);
    const done = A.Quests.doneList().slice().reverse();
    // v3.0: si no hay capítulo en curso, a quién ir a ver para seguir la historia
    let start = '';
    const nx = A.Quests.nextMain ? A.Quests.nextMain() : null;
    if (nx) {
      const g = A.Data.getById('npcs', nx.quest.giver);
      const r = g ? A.Data.getById('regions', g.region) : null;
      const who = `<b>${U().esc(g ? g.name : 'alguien')}</b>${r ? ` en <b>${U().esc(r.name)}</b>` : ''}`;
      const lead = nx.quest.chapter === 1 ? 'La historia empieza acá' : `Sigue la historia: capítulo ${nx.quest.chapter}, ${U().esc(nx.quest.title)}`;
      start = `
        <div class="journal-hint">${U().icon('crown', 24)}
          <span>${lead}. ${nx.status === 'locked' ? `${who} te lo va a pedir cuando llegues al nivel ${nx.quest.minLevel}.` : `Hablá con ${who}.`}</span>
        </div>`;
    } else if (!main.length && A.Quests.status('mq1_humo') !== 'done') {
      const g = A.Data.getById('npcs', 'npc_guardia_pueblo');
      start = `
        <div class="journal-hint">${U().icon('crown', 24)}
          <span>La historia empieza en el <b>Pueblo Inicial</b>: hablá con <b>${U().esc(g ? g.name : 'el guardia')}</b>.</span>
        </div>`;
    }
    return `
      <section class="journal-sec">
        <h3 class="journal-h">Historia principal</h3>
        ${main.map(questBlock).join('') || start || '<p class="journal-empty">Por ahora, nada. Hablá con la gente de los pueblos.</p>'}
      </section>
      <section class="journal-sec">
        <h3 class="journal-h">Encargos</h3>
        ${side.map(questBlock).join('') || '<p class="journal-empty">No tenés encargos. Los que tienen algo para vos llevan un signo de exclamación dorado.</p>'}
      </section>
      ${done.length ? `
        <details class="journal-sec journal-done">
          <summary class="journal-h">Terminadas <span class="num">${done.length}</span></summary>
          <ul class="journal-done-list">
            ${done.map((q) => `<li>${U().icon('check', 14)}<span>${U().esc(q.title)}</span></li>`).join('')}
          </ul>
        </details>` : ''}
    `;
  }

  // ============================================================
  // Crónicas
  // ============================================================

  /** Agrupa por día y por lugar; las líneas repetidas seguidas se juntan. */
  function groupChronicles(list) {
    const days = [];
    for (const e of list) {
      const day = e.day || 0;
      let d = days[days.length - 1];
      if (!d || d.day !== day) { d = { day, places: [] }; days.push(d); }
      let pl = d.places[d.places.length - 1];
      if (!pl || pl.regionId !== e.regionId) { pl = { regionId: e.regionId, entries: [] }; d.places.push(pl); }
      const last = pl.entries[pl.entries.length - 1];
      if (last && last.text === e.text) last.count += (e.count || 1);
      else pl.entries.push({ ...e, count: e.count || 1 });
    }
    return days;
  }

  function renderChronicles() {
    const all = (A.State.chronicles || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
    if (!all.length) return '<p class="journal-empty">Todavía no pasó nada. Tu historia empieza ahora.</p>';
    const days = groupChronicles(all);
    return days.map((d) => `
      <section class="diary-day">
        <h3 class="diary-day-h">${U().icon('sun', 18)}<span>${d.day ? `Día ${d.day}` : 'Antes'}</span></h3>
        ${d.places.map((pl) => {
          const r = pl.regionId ? A.Data.getById('regions', pl.regionId) : null;
          return `
            <div class="diary-place">
              <div class="diary-place-h">${U().biomeIcon(r, 16)}<span>${U().esc(r ? r.name : 'En el camino')}</span></div>
              <ul class="diary-list">
                ${pl.entries.map((e) => `
                  <li class="diary-entry is-${e.type}">
                    ${chronicleIcon(e.type, 18)}
                    <span class="diary-text">${U().esc(e.text)}</span>
                    ${e.count > 1 ? `<span class="diary-count num">×${e.count}</span>` : ''}
                  </li>`).join('')}
              </ul>
            </div>`;
        }).join('')}
      </section>
    `).join('');
  }

  // ============================================================
  // v3.1: Bestiario
  // ============================================================

  const CAT_ORDER = { weak: 0, normal: 1, strong: 2, boss: 3 };

  function bestiaryCard(e) {
    const known = A.Bestiary.isKnown(e.id);
    const studied = A.Bestiary.isStudied(e.id);
    const bk = A.Bestiary.entry(e.id);
    const tl = known && A.Encounter && A.Encounter.timeLabel ? A.Encounter.timeLabel(e) : '';
    const meta = !known ? 'Sin descubrir' : bk && bk.killed ? `${bk.killed} ${bk.killed === 1 ? 'vencida' : 'vencidas'}` : 'Vista';
    return `
      <button class="bestiary-card ${known ? '' : 'is-unknown'} ${studied ? 'is-studied' : ''} ${e.category === 'boss' ? 'is-boss' : ''}" data-bestiary="${U().esc(e.id)}" title="${U().esc(known ? `${e.name}${tl ? ` · ${tl}` : ''}` : 'Todavía no la viste')}">
        <span class="bestiary-sprite">${A.Sprites ? A.Sprites.html(e, { size: 48 }) : ''}</span>
        <span class="bestiary-name">${known ? U().esc(e.name) : '???'}</span>
        <span class="bestiary-meta">${meta}</span>
        ${tl ? `<span class="bestiary-time">${U().icon(e.time === 'night' ? 'moon' : 'sun', 14)}</span>` : ''}
        ${studied ? `<span class="bestiary-star" title="La conocés a fondo">${U().icon('star', 14)}</span>` : ''}
      </button>`;
  }

  function renderBestiary() {
    if (!A.Bestiary) return '<p class="journal-empty">Sin bestiario.</p>';
    const all = (A.Data.enemies || []).slice().sort((a, b) => ((a.tier || 1) - (b.tier || 1))
      || ((CAT_ORDER[a.category] || 0) - (CAT_ORDER[b.category] || 0)) || String(a.name).localeCompare(String(b.name), 'es'));
    const c = A.Bestiary.counts();
    const pct = c.total ? Math.round((c.known / c.total) * 100) : 0;
    const groups = [];
    for (const e of all) {
      const t = e.tier || 1;
      let g = groups[groups.length - 1];
      if (!g || g.tier !== t) { g = { tier: t, list: [] }; groups.push(g); }
      g.list.push(e);
    }
    return `
      <div class="bestiary-head">
        ${U().icon('skulls', 26)}
        <div class="bestiary-head-text">
          <b>${c.known} de ${c.total} criaturas descubiertas</b>
          <span>${c.studied} conocidas a fondo (observadas o vencidas ${A.Bestiary.KNOW_KILLS} veces)</span>
        </div>
        <span class="bestiary-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
      </div>
      ${groups.map((g) => `
        <section class="journal-sec">
          <h3 class="journal-h">Nivel ${g.tier} <span class="num dim">${g.list.filter((e) => A.Bestiary.isKnown(e.id)).length}/${g.list.length}</span></h3>
          <div class="bestiary-grid">${g.list.map(bestiaryCard).join('')}</div>
        </section>`).join('')}
    `;
  }

  // ============================================================

  function render(payload) {
    const tab = payload && (payload.tab === 'chronicles' || payload.tab === 'bestiary') ? payload.tab : 'quests';
    const nActive = A.Quests ? A.Quests.activeList().length : 0;
    return `
      <div class="modal journal" role="dialog" aria-modal="true" aria-label="Diario de viaje">
        <header class="modal-header">
          <h2 class="modal-title">${U().icon('book', 24)}<span>Diario de viaje</span></h2>
          <button class="modal-close" data-modal-close aria-label="Cerrar">×</button>
        </header>
        <nav class="npc2-tabs journal-tabs">
          <button class="npc2-tab ${tab === 'quests' ? 'is-active' : ''}" data-journal-tab="quests">${U().icon('quest', 18)}<span class="tab-label">Misiones</span>${nActive ? `<span class="tab-count num">${nActive}</span>` : ''}</button>
          <button class="npc2-tab ${tab === 'chronicles' ? 'is-active' : ''}" data-journal-tab="chronicles">${U().icon('feather', 18)}<span class="tab-label">Crónicas</span></button>
          <button class="npc2-tab ${tab === 'bestiary' ? 'is-active' : ''}" data-journal-tab="bestiary">${U().icon('skulls', 18)}<span class="tab-label">Bestiario</span>${A.Bestiary ? `<span class="tab-count num">${A.Bestiary.counts().known}</span>` : ''}</button>
        </nav>
        <div class="modal-body journal-body">
          ${tab === 'quests' ? renderQuests() : tab === 'bestiary' ? renderBestiary() : renderChronicles()}
        </div>
      </div>
    `;
  }

  function bind(overlay) {
    overlay.querySelectorAll('[data-journal-tab]').forEach((b) => {
      b.addEventListener('click', () => A.State.openModal('journal', { tab: b.dataset.journalTab }));
    });
    // v3.1: la ficha de la criatura, con "Volver al bestiario"
    overlay.querySelectorAll('[data-bestiary]').forEach((b) => {
      b.addEventListener('click', () => A.State.openModal('creature', { enemyId: b.dataset.bestiary, back: 'bestiary' }));
    });
  }

  A.ModalViews = A.ModalViews || {};
  A.ModalViews.journal = { render, bind };
  A.ModalViews['chronicles-full'] = { render: () => render({ tab: 'chronicles' }), bind };
  A.Journal = { chronicleIcon, TYPE_ICON };
})(window.Aventurs);
