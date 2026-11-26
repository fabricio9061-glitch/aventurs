/* ============================================================
   Aventurs — View: World (Tab Mundo)

   Cambios v1.1.0:
     - Botón "+X" criaturas abre modal con todas las criaturas de la región.
     - Botón "Viajar" inicia viaje progresivo via Travel.start.
     - Si hay viaje en curso, muestra panel especial con barra de progreso
       y botones "Continuar" / "Volver".
   ============================================================ */

(function (A) {
  'use strict';

  let mainEl = null;

  // v1.7.0: timer del modo auto/rápido
  let autoStepTimer = null;
  let autoStepDelay = 2000; // ms entre pasos en modo auto

  function clearAutoStepTimer() {
    if (autoStepTimer) {
      clearTimeout(autoStepTimer);
      autoStepTimer = null;
    }
  }

  /**
   * v1.7.0: Inicia el timer de auto-step si el modo es 'auto' o 'fast'.
   * Pausa automáticamente al aparecer un evento que requiere decisión.
   */
  /** v3.0: el invitado que va junto al anfitrión no maneja el viaje. */
  function guestFollows() { return !!(A.Party && A.Party.guestTogether && A.Party.guestTogether()); }

  function scheduleAutoStep() {
    clearAutoStepTimer();
    const t = A.State.traveling;
    if (!t || t.completed) return;
    if (guestFollows()) return;
    // v1.8.0: nunca avanzar el viaje solo mientras hay un combate o un modal abierto
    if (A.State.combat || (A.State.ui && A.State.ui.openModal)) return;
    const mode = (A.State.prefs && A.State.prefs.travelMode) || 'manual';
    if (mode === 'manual') return;

    // No avanzar si hay evento sin resolver
    const lastEvent = t.events[t.events.length - 1];
    if (lastEvent && (lastEvent.kind === 'creature' || lastEvent.kind === 'people') && !lastEvent.resolved) return;

    const delay = mode === 'fast' ? 450 : 1500; // v3.1: rápido = 0,45 s, auto = 1,5 s (los viajes tienen más pasos)
    autoStepDelay = delay;
    autoStepTimer = setTimeout(() => {
      autoStepTimer = null;
      const stillTraveling = A.State.traveling && !A.State.traveling.completed;
      if (!stillTraveling || A.State.combat) return;
      const result = A.Travel.step();
      // Re-render
      render();
      // Encadenar siguiente paso si corresponde
      if (result && result.ok) scheduleAutoStep();
    }, delay);
  }

  function setTravelMode(mode) {
    if (!['manual', 'auto', 'fast'].includes(mode)) return;
    A.State.prefs = A.State.prefs || {};
    A.State.prefs.travelMode = mode;
    A.State.persist();
    if (mode === 'manual') {
      clearAutoStepTimer();
    } else {
      scheduleAutoStep();
    }
  }

  // ---------- v2.0: el resultado de la última acción (descansar) ----------
  let lastNote = null;
  let roadForceTimer = null; // v3.11.1
  let spokenRegion = null; // v3.3: el último lugar que contó el narrador

  /** v3.3: el narrador lee los avisos (lo que pasó al descansar, por ejemplo). */
  function sayNote(note) {
    if (note && note.text && A.Voice && A.Voice.isOn()) A.Voice.say(note.text);
  }

  // v3.3: al prender la voz, lee lo que está en pantalla (el lugar o el camino)
  if (A.Bus) {
    A.Bus.on('voice:changed', (e) => {
      if (!e || !e.on || !mainEl || !document.body.contains(mainEl) || A.State.combat) return;
      if (A.State.ui && A.State.ui.openModal) return; // la escena se lee sola
      const t = A.State.traveling;
      if (t && !t.completed) {
        spokenEv = null;
        render();
        return;
      }
      spokenRegion = null;
      render();
    });
  }

  function icon(name, size, cls) { return A.UI ? A.UI.icon(name, size, cls) : ''; }
  function esc(s) { return A.Utils.escapeHtml(String(s == null ? '' : s)); }

  function render() {
    if (!mainEl) return;
    const w = A.State.world;
    if (!w) { mainEl.innerHTML = ''; return; }

    // Si hay viaje en curso: render del panel de viaje
    if (A.State.traveling && !A.State.traveling.completed) {
      renderTraveling();
      return;
    }

    const region = A.Data.getById('regions', w.regionId);
    if (!region) {
      mainEl.innerHTML = `<div class="empty-tab">Región desconocida.</div>`;
      return;
    }

    const npcs = A.Data.npcsInRegion(region.id);
    const enemies = A.Data.enemiesInRegion(region.id);
    const neighbors = A.Travel.neighbors();
    const isCombatRegion = region.type === 'combat';
    const isSafeRegion = (region.type === 'safe' || region.type === 'road');
    // v3.11: la guarida de un jefe
    const lairSt = region.type === 'lair' && A.Lairs ? A.Lairs.status(region.id) : null;
    const night = A.Time ? A.Time.isNight() : false;
    const p = A.State.player;
    const minLvl = (region.unlockConditions && region.unlockConditions.minLevel) || 1;
    const todo = questsHere(region);

    // v2.3: descansar afuera cura hasta un tope y después hay que moverse
    const restI = A.Explore && A.Explore.restInfo ? A.Explore.restInfo() : null;
    const restLabel = restI ? restI.label : (night ? 'Dormir' : 'Descansar');
    const restDesc = restI ? restI.desc : (night ? 'Hasta mañana.' : 'Un rato a la sombra. Pasa la tarde.');
    const restLocked = !!(restI && restI.locked);

    // v3.3: al llegar a un lugar, el narrador lo cuenta (una vez por lugar)
    if (spokenRegion !== region.id && A.Voice && A.Voice.isOn()) {
      spokenRegion = region.id;
      A.Voice.say(`${region.name}. ${region.description || ''}`);
    }

    // v3.10: huiste de una pelea en grupo y volviste: tus compañeros siguen peleando
    const bgFight = A.State.combat && !A.State.combat.result && A.State.ui.combatHidden === A.State.combat.id;
    mainEl.innerHTML = `
      <section class="world2">
        ${bgFight ? `<div class="world-bgfight">${icon('swords', 18)}<span>Tus compañeros siguen peleando sin vos. Cuando terminen, cada uno sigue por su cuenta.</span><button class="btn-ghost btn-sm" data-watch-fight>Ver la pelea</button></div>` : ''}
        <header class="region2 ${isSafeRegion ? 'is-safe' : 'is-danger'} biome-${esc(region.biome)} ${night ? 'is-night' : 'is-day'}">
          ${A.Scenes ? A.Scenes.html(region) : ''}
          ${A.UI && A.UI.voiceToggle ? `<span class="region2-voice">${A.UI.voiceToggle(20)}</span>` : ''}
          <div class="region2-art">${A.UI ? A.UI.biomeIcon(region, 72) : ''}</div>
          <div class="region2-info">
            <div class="region2-kicker">
              <span class="region2-tag ${isSafeRegion ? 'is-safe' : 'is-danger'}">${icon(isSafeRegion ? 'shield' : 'swords', 14)}<span>${region.type === 'road' ? 'Sin peleas adentro' : isSafeRegion ? 'Zona segura' : 'Zona de peligro'}</span></span>
              ${region.type === 'road' ? `<span class="region2-tag is-road" title="En el camino hacia acá hay criaturas">${icon('swords', 14)}<span>Criaturas en el camino</span></span>` : ''}
              ${lairSt ? `<span class="region2-tag is-lair" title="Acá vive un jefe: lo desafiás cuando quieras">${icon('crown', 14)}<span>Guarida de jefe</span></span>` : ''}
              <span class="region2-tag">Nivel ${minLvl}+</span>
              <span class="region2-tag is-soft">${esc(biomeLabel(region.biome))}</span>
            </div>
            <h1 class="region2-name">${esc(region.name)}</h1>
            <p class="region2-desc">${esc(region.description)}</p>
          </div>
        </header>

        ${lastNote ? `
          <div class="note2" role="status">
            ${icon(lastNote.icon || 'tent', 28)}
            <div class="note2-main"><p>${esc(lastNote.text)}</p>${A.UI ? A.UI.chips(lastNote.chips) : ''}</div>
            <button class="note2-x" data-note-close aria-label="Cerrar">×</button>
          </div>` : ''}

        ${lairSt ? lairBlock(lairSt) : ''}

        <section class="acts2 ${isCombatRegion || lairSt ? 'has-3' : 'has-2'}">
          ${lairSt ? lairButton(lairSt) : ''}
          ${isCombatRegion ? `
            <button class="act2 is-main" data-action="explore">
              <span class="act2-icon">${icon('search', 40)}</span>
              <span class="act2-text"><span class="act2-label">Explorar</span><span class="act2-desc">Siempre pasa algo: criaturas, tesoros, peligros.</span></span>
            </button>` : ''}
          <button class="act2 ${restLocked ? 'is-tired' : ''}" data-action="rest" ${restLocked ? 'aria-disabled="true"' : ''}>
            <span class="act2-icon">${icon(night ? 'moon' : 'tent', 40)}</span>
            <span class="act2-text"><span class="act2-label">${restLabel}</span><span class="act2-desc">${restDesc}</span></span>
          </button>
          ${neighbors.length > 0 ? `
            <button class="act2" data-action="open-travel">
              <span class="act2-icon">${icon('map', 40)}</span>
              <span class="act2-text"><span class="act2-label">Viajar</span><span class="act2-desc">${guestFollows() ? `En grupo, el destino lo elige ${esc(A.Party.hostName())}.` : `${neighbors.length} ${neighbors.length === 1 ? 'camino' : 'caminos'} desde acá.`}</span></span>
            </button>` : ''}
        </section>

        ${npcs.length ? `
          <section class="block2">
            <h2 class="block2-title">${icon('talk', 18)}<span>Habitantes</span></h2>
            <div class="npc2-grid">
              ${npcs.map((n) => npcCard(n)).join('')}
            </div>
          </section>
        ` : ''}

        ${isCombatRegion && enemies.length ? `
          <section class="block2">
            <h2 class="block2-title">${icon('skulls', 18)}<span>Criaturas de la zona</span><span class="block2-hint">El número es la dificultad del dado para pegarles</span></h2>
            <div class="creature-strip">
              ${enemies.slice(0, 8).map((e) => creatureChip(e, region)).join('')}
              ${enemies.length > 8 ? `
                <button class="creature-chip is-overflow" data-show-all="${esc(region.id)}">
                  <span>+${enemies.length - 8}</span>
                </button>
              ` : ''}
            </div>
          </section>
        ` : ''}

        ${questsBlock(todo)}
      </section>
    `;

    bindEvents();
  }

  /** v3.11: la ficha del jefe de la guarida (y lo que pide su altar). */
  function lairBlock(st) {
    const b = st.boss;
    const known = !A.Bestiary || A.Bestiary.isKnown(b.id);
    const p = A.State.player;
    const lv = p ? p.level || 1 : 1;
    const gap = (b.tier || 1) - lv;
    const warn = gap >= 2 ? `<span class="lair-warn">${icon('warning', 14)}Es de nivel ${b.tier}: vos sos ${lv}. Podés intentarlo, pero es muy probable que pierdas.</span>` : gap === 1 ? `<span class="lair-warn is-soft">${icon('warning', 14)}Es un nivel más que vos.</span>` : '';
    const altar = st.altar ? `
      <div class="lair-altar ${st.altar.ok ? 'is-ok' : ''}">
        <div class="lair-altar-title">${icon('arcane', 16)}<b>${esc(st.altar.name)}</b></div>
        <p>${esc(st.altar.text || '')}</p>
        <ul>${st.altar.items.map((it) => `<li class="${it.ok ? 'is-ok' : 'is-miss'}">${A.ItemSprites && A.ItemSprites.html ? A.ItemSprites.html(it.id, { size: 22 }) : ''}<span>${it.qty} × ${esc(it.name)}</span><span class="lair-have num">${it.have}/${it.qty}</span></li>`).join('')}</ul>
      </div>` : '';
    const sk = A.Skills && A.Skills.idsOf ? A.Skills.idsOf(b).map((id) => A.Skills.get(id)).filter((x) => x && x.name).slice(0, 6) : [];
    return `
      <section class="block2 lair-card">
        <div class="lair-portrait">${enemySprite(b, 96)}</div>
        <div class="lair-info">
          <div class="lair-kicker"><span class="cb-badge is-cat-boss">Jefe</span><span>Nivel ${b.tier}</span>${st.wins ? `<span class="lair-wins">${icon('crown', 12)}Le ganaste ${st.wins} ${st.wins === 1 ? 'vez' : 'veces'}</span>` : ''}</div>
          <h2 class="lair-name">${esc(known ? b.name : '???')}</h2>
          <p class="lair-desc">${esc(b.description || '')}</p>
          ${sk.length && known ? `<div class="lair-skills">${sk.map((x) => `<span class="lair-skill" title="${esc(x.text || '')}">${icon(x.icon || 'star', 12)}${esc(x.name)}</span>`).join('')}</div>` : ''}
          ${warn}
          ${supremeHint()}
          ${altar}
        </div>
      </section>`;
  }
  /** v3.12: a veces el jefe sale en su forma suprema (dorado: más fuerte y con mejor botín). */
  function supremeHint() {
    const EL = A.Balance && A.Balance.ELITE;
    if (!EL || !(EL.chanceBoss > 0)) return '';
    return `<p class="lair-supreme">${icon('elite', 16)}<span>Una de cada ${Math.round(1 / EL.chanceBoss)} veces sale en su <b>forma suprema</b>: dorado, más fuerte y con mejor botín.</span></p>`;
  }
  function lairButton(st) {
    const chk = A.Lairs.canChallenge(st.region.id);
    const verb = st.altar ? 'Invocar' : 'Desafiar';
    const desc = chk.ok ? (st.altar ? 'Ofrecés lo del altar y aparece. Se gasta.' : 'Pelea contra el jefe. Si ganás, vuelve mañana.') : chk.reason;
    return `
      <button class="act2 is-main is-lair ${chk.ok ? '' : 'is-tired'}" data-action="challenge" ${chk.ok ? '' : 'aria-disabled="true"'}>
        <span class="act2-icon">${icon('crown', 40)}</span>
        <span class="act2-text"><span class="act2-label">${verb} a ${esc(st.boss.name)}</span><span class="act2-desc">${esc(desc)}</span></span>
      </button>`;
  }

  /** v3.1: ficha de una criatura de la zona: "???" hasta que la ves; sol o luna si sale a una hora. */
  function creatureChip(e, region) {
    const known = !A.Bestiary || A.Bestiary.isKnown(e.id);
    if (!known) {
      return `
        <button class="creature-chip is-unknown" data-creature="${esc(e.id)}" title="Todavía no la viste">
          <span class="creature-icon">${enemySprite(e, 32)}</span>
          <span>???</span>
        </button>`;
    }
    const tl = A.Encounter && A.Encounter.timeLabel ? A.Encounter.timeLabel(e) : '';
    const off = tl && A.Encounter.activeNow && !A.Encounter.activeNow(e, region);
    return `
      <button class="creature-chip ${off ? 'is-off' : ''}" data-creature="${esc(e.id)}" title="${esc(e.name)}: dificultad del dado ${e.difficulty != null ? e.difficulty : 10}${tl ? ` · ${tl}${off ? ' (ahora no)' : ''}` : ''}">
        <span class="creature-icon">${enemySprite(e, 32)}</span>
        <span>${esc(e.name)}</span>
        ${tl ? `<span class="creature-time">${icon(e.time === 'night' ? 'moon' : 'sun', 16)}</span>` : ''}
        ${A.ItemSprites && A.ItemSprites.dcBadge ? A.ItemSprites.dcBadge(e.difficulty != null ? e.difficulty : 10, { size: 24, cls: 'creature-dc' }) : ''}
      </button>`;
  }

  /**
   * v3.4: las misiones van en el centro, debajo de las criaturas de la zona (antes en la barra del costado).
   * Primero las que tienen algo para hacer acá (con su objetivo de acá), después la historia y el resto.
   */
  function questsBlock(todo) {
    if (!A.Quests) return '';
    const active = A.Quests.activeList();
    if (!active.length) {
      if (A.Quests.status('mq1_humo') !== 'available') return '';
      return `
        <section class="block2 quests3 is-empty">
          <button class="quests3-start" data-action="journal">${icon('crown', 18)}<span>La historia empieza con <b>Tomas el guardia</b>, en el Pueblo Inicial.</span></button>
        </section>`;
    }
    const hereOf = {};
    for (const t of todo || []) if (t.id && !hereOf[t.id]) hereOf[t.id] = t;
    const rank = (q) => (hereOf[q.id] ? 0 : q.main ? 1 : 2);
    const list = active.slice().sort((a, b) => rank(a) - rank(b));
    const shown = list.slice(0, 6);
    return `
      <section class="block2 quests3">
        <h2 class="block2-title">${icon('quest', 18)}<span>Misiones</span>
          <button class="block2-link" data-action="journal">${list.length > shown.length ? `+${list.length - shown.length} en el Diario` : 'Ver el Diario'}</button>
        </h2>
        <div class="quests3-grid">
          ${shown.map((q) => {
            const here = hereOf[q.id];
            const idx = q.objectives.findIndex((o, i) => !A.Quests.objectiveProgress(q, i).done);
            const ready = idx < 0;
            const pr = ready ? null : A.Quests.objectiveProgress(q, idx);
            const giver = A.Data.getById('npcs', q.giver);
            const obj = here ? here.text : ready ? `Volvé con ${giver ? giver.name : 'quien te la dio'}` : A.Quests.objectiveText(q.objectives[idx]);
            const count = here ? here.count : pr && pr.need > 1 ? `${pr.have}/${pr.need}` : '';
            return `
              <button class="quest3-row ${q.main ? 'is-main' : ''} ${ready ? 'is-ready' : ''} ${here ? 'is-here' : ''}" data-action="journal" title="Abrir el Diario">
                ${icon(q.main ? 'crown' : 'scroll', 18)}
                <span class="quest3-text">
                  <span class="quest3-title">${esc(q.title)}</span>
                  <span class="quest3-obj">${esc(obj)}</span>
                  ${(() => { const m = /^(\d+)\/(\d+)$/.exec(count || ''); return m ? `<span class="quest3-bar"><span style="width:${Math.min(100, Math.round((+m[1] / Math.max(1, +m[2])) * 100))}%"></span></span>` : ready ? '<span class="quest3-bar is-done"><span style="width:100%"></span></span>' : ''; })()}
                </span>
                <span class="quest3-side">
                  ${here ? '<span class="quest3-here">Acá</span>' : ''}
                  ${count ? `<span class="quest3-count num">${esc(count)}</span>` : ready ? icon('question', 16) : ''}
                </span>
              </button>`;
          }).join('')}
        </div>
      </section>`;
  }

  /** Objetivos de misiones activas que se cumplen en esta zona. */
  function questsHere(region) {
    if (!A.Quests) return [];
    const out = [];
    const here = new Set(A.Data.enemiesInRegion(region.id).map((e) => e.id));
    for (const q of A.Quests.activeList()) {
      q.objectives.forEach((o, i) => {
        const pr = A.Quests.objectiveProgress(q, i);
        if (pr.done) return;
        const ids = o.type === 'kill' ? (Array.isArray(o.enemy) ? o.enemy : [o.enemy]) : [];
        const fits = (o.type === 'explore' && o.region === region.id)
          || (o.type === 'kill' && ids.some((id) => here.has(id)))
          || (o.type === 'talk' && A.Data.npcsInRegion(region.id).some((n) => n.id === o.npc));
        // v3.1: si lo que hay que derrotar sale a otra hora, se avisa
        let when = '';
        if (o.type === 'kill' && A.Encounter && A.Encounter.activeNow) {
          const foes = ids.map((id) => A.Data.getById('enemies', id)).filter((e) => e && here.has(e.id));
          if (foes.length && !foes.some((e) => A.Encounter.activeNow(e, region))) when = foes[0].time === 'night' ? ' (sale de noche)' : ' (sale de día)';
        }
        if (fits) out.push({ id: q.id, title: q.title, main: q.main, text: A.Quests.objectiveText(o) + when, count: (o.count || 1) > 1 ? `${pr.have}/${pr.need}` : '' });
      });
    }
    return out;
  }

  /**
   * v1.7.0: Selector de modo de viaje (manual / auto / fast)
   */
  function renderTravelModeSelector() {
    const mode = (A.State.prefs && A.State.prefs.travelMode) || 'manual';
    const isAuto = mode === 'auto' || mode === 'fast';
    return `
      <div class="travel-mode-selector ${isAuto ? 'is-active' : ''}" role="group" aria-label="Modo de viaje">
        <button type="button" class="travel-mode-btn ${mode === 'manual' ? 'is-selected' : ''}" data-travel-mode="manual" title="Manual: avanzás vos">
          <span class="travel-mode-icon">${icon('boot', 16)}</span>
          <span class="travel-mode-label">Manual</span>
        </button>
        <button type="button" class="travel-mode-btn ${mode === 'auto' ? 'is-selected' : ''}" data-travel-mode="auto" title="Auto: avanza solo cada 2 segundos y frena en los encuentros">
          <span class="travel-mode-icon">${icon('hourglass', 16)}</span>
          <span class="travel-mode-label">Auto</span>
        </button>
        <button type="button" class="travel-mode-btn ${mode === 'fast' ? 'is-selected' : ''}" data-travel-mode="fast" title="Rápido: avanza solo cada medio segundo">
          <span class="travel-mode-icon">${icon('run', 16)}</span>
          <span class="travel-mode-label">Rápido</span>
        </button>
      </div>
    `;
  }

  function regionNameOf(id) { const r = A.Data.getById('regions', id); return r ? r.name : id; }

  function renderTraveling() {
    const t = A.State.traveling;
    const fromR = A.Data.getById('regions', t.fromId);
    const toR = A.Data.getById('regions', t.toId);
    const pctNum = Math.round((t.currentStep / t.totalSteps) * 100);
    const lastEvent = t.events[t.events.length - 1] || null;

    // Si último evento es una criatura sin resolver, ofrecer opciones
    const pending = lastEvent && lastEvent.kind === 'creature' && !lastEvent.resolved;
    // v3.21: alguien en el camino esperando que decidas
    const meeting = lastEvent && lastEvent.kind === 'people' && !lastEvent.resolved;

    // v1.6.9: bioma del destino para temática visual
    const targetBiome = (toR && toR.biome) || 'plains';

    mainEl.innerHTML = `
      <section class="travel-view travel-view-v2 travel-biome-${targetBiome}">
        <header class="travel-header-v2 tv-head ${A.Time && A.Time.isNight() ? 'is-night' : 'is-day'} from-${esc((fromR && fromR.biome) || 'plains')} to-${esc(targetBiome)}" style="--tv-p:${(pctNum / 100).toFixed(2)}">
          ${A.Scenes ? `<div class="tv-scene tv-scene-from">${A.Scenes.html(fromR)}</div><div class="tv-scene tv-scene-to">${A.Scenes.html(toR)}</div>` : ''}
          <div class="travel-route-v2">
            <div class="travel-endpoint travel-endpoint-from">
              <div class="travel-endpoint-icon">${A.UI ? A.UI.biomeIcon(fromR, 36) : ''}</div>
              <div class="travel-endpoint-name">${A.Utils.escapeHtml(fromR ? fromR.name : t.fromId)}</div>
              <div class="travel-endpoint-label dim">${t.back ? 'Volvés acá' : 'Origen'}</div>
            </div>
            ${renderRoutePath(t)}
            <div class="travel-endpoint travel-endpoint-to">
              <div class="travel-endpoint-icon">${A.UI ? A.UI.biomeIcon(toR, 36) : ''}</div>
              <div class="travel-endpoint-name">${A.Utils.escapeHtml(toR ? toR.name : t.toId)}</div>
              <div class="travel-endpoint-label dim">Destino</div>
            </div>
          </div>
          <div class="travel-progress-v2">
            <span class="travel-progress-step">Paso ${t.currentStep} de ${t.totalSteps}</span>
            ${guestFollows() ? `<span class="travel-follow-tag">${icon('party', 16)}<span>Viajan juntos</span></span>` : renderTravelModeSelector()}
            <span class="travel-progress-pct num">${pctNum}%</span>
            ${A.UI && A.UI.voiceToggle ? A.UI.voiceToggle(18) : ''}
          </div>
        </header>

        <div class="travel-body-v2">
          <main class="travel-stage-v2">
            ${meeting ? renderPeople(lastEvent) : guestFollows() ? renderFollowStage(t, lastEvent, pending) : pending ? renderEncounter(lastEvent) : renderTravelStage(t, lastEvent)}
          </main>
          <aside class="travel-log-v2">
            <div class="travel-log-header">
              <span class="travel-log-title">${icon('book', 16)} Bitácora</span>
              <span class="travel-log-count dim">${t.events.length} evento${t.events.length === 1 ? '' : 's'}</span>
            </div>
            <div class="travel-log-list">
              ${t.events.length === 0
                ? `<div class="travel-log-empty muted">Acabás de salir. Avanzá para empezar la bitácora.</div>`
                : t.events.slice().reverse().map(eventLogRow).join('')}
            </div>
          </aside>
        </div>
      </section>
    `;

    bindTravelEvents();

    // v1.7.0: si el modo es auto/fast, programar el próximo paso
    scheduleAutoStep();
  }

  /** v3.0: el invitado ve el viaje, pero lo maneja el anfitrión. v3.11.1: lo que aparece lo deciden todos. */
  function renderFollowStage(t, lastEvent, pending) {
    const host = esc(A.Party.hostName());
    if (pending && lastEvent && lastEvent.kind === 'creature') return renderEncounter(lastEvent);
    const card = lastEvent ? renderStageEvent(lastEvent) : `
        <div class="travel-stage-empty">
          <div class="travel-stage-icon">${icon('compass', 48)}</div>
          <div class="travel-stage-title">Van en camino</div>
          <div class="travel-stage-desc dim">Viajás con ${host}.</div>
        </div>`;
    return `
      <div class="travel-stage-content">${card}</div>
      <div class="travel-actions-v2 is-follow">
        <p class="travel-follow-note">${icon('party', 18)}<span>${pending ? 'Esperando a que se resuelva lo que apareció en el camino.' : `Viajan juntos: cualquiera puede avanzar o dar la vuelta. Si aparece una criatura, deciden entre todos qué hacer.`}</span></p>
        ${pending || t.completed ? '' : `<button class="btn-primary btn-travel-step" data-travel-action="step">${icon('boot', 18)}<span>${t.back ? `Volver a ${esc(regionNameOf(t.fromId))}` : 'Avanzar'}</span></button>
        <button class="btn-ghost" data-travel-action="turn" title="${t.back ? 'Seguir hacia el destino' : 'Volver por el mismo camino (paso a paso)'}">${icon(t.back ? 'arrow-up' : 'arrow-down', 16)}<span>${(t.currentStep || 0) <= 0 && !t.back ? 'Quedarse acá' : t.back ? `Seguir hacia ${esc(regionNameOf(t.toId))}` : 'Dar la vuelta'}</span></button>`}
      </div>`;
  }

  /**
   * v1.6.9: Ruta visual con hitos (SVG path con marker de avance)
   */
  function renderRoutePath(t) {
    const totalSteps = t.totalSteps || 1;
    const currentStep = t.currentStep || 0;
    const pctNum = (currentStep / totalSteps) * 100;
    // Generar nodos cada cierta cantidad de pasos (max 5 hitos visuales)
    const numCheckpoints = Math.min(5, Math.max(2, Math.floor(totalSteps / 3)));
    const checkpoints = [];
    for (let i = 1; i < numCheckpoints; i++) {
      const stepAt = Math.round((totalSteps / numCheckpoints) * i);
      checkpoints.push({
        x: (i / numCheckpoints) * 100,
        passed: currentStep >= stepAt,
      });
    }
    return `
      <div class="travel-route-path">
        <div class="travel-route-line">
          <div class="travel-route-line-fill" style="width: ${pctNum}%"></div>
          ${checkpoints.map((cp) => `
            <div class="travel-route-checkpoint ${cp.passed ? 'is-passed' : ''}" style="left: ${cp.x}%">
              <span class="travel-route-checkpoint-dot"></span>
            </div>
          `).join('')}
          <div class="travel-route-marker ${t.back ? 'is-back' : ''}" style="left: ${pctNum}%" title="${t.back ? 'Volviendo' : 'Tu posición'}">
            <span class="travel-route-marker-icon">${A.Sprites && A.Sprites.heroFor && A.State.player ? A.Sprites.heroFor(A.State.player, { size: 30 }) : icon('pin', 22)}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * v1.6.9: Stage central del viaje. Si hay último evento, lo muestra grande;
   * si no, muestra el botón "Avanzar" prominente.
   */
  function renderTravelStage(t, lastEvent) {
    const stageContent = lastEvent
      ? renderStageEvent(lastEvent)
      : `
        <div class="travel-stage-empty">
          <div class="travel-stage-icon">${icon('compass', 48)}</div>
          <div class="travel-stage-title">El camino te espera</div>
          <div class="travel-stage-desc dim">Cada paso te acerca al destino. ¿Qué encontrarás?</div>
        </div>
      `;
    // v1.7.0: si está en modo auto/fast, mostrar indicador de progresión automática
    const mode = (A.State.prefs && A.State.prefs.travelMode) || 'manual';
    const autoIndicator = (mode === 'auto' || mode === 'fast')
      ? `<div class="travel-auto-indicator is-${mode}">
           <span class="travel-auto-dot"></span>
           <span class="travel-auto-text">${mode === 'fast' ? 'Avanzando rápido...' : 'Avanzando solo...'}</span>
         </div>`
      : '';
    return `
      <div class="travel-stage-content">
        ${stageContent}
        ${autoIndicator}
      </div>
      <div class="travel-actions-v2">
        <button class="btn-primary btn-travel-step" data-travel-action="step" ${mode !== 'manual' ? 'title="Avanzar manualmente (cancela auto)"' : ''}>
          <span class="btn-icon">${icon('boot', 20)}</span>
          <span>${t.back ? `Volver a ${esc(regionNameOf(t.fromId))}` : `Avanzar${mode !== 'manual' ? ' ahora' : ''}`}</span>
        </button>
        ${(t.currentStep || 0) <= 0 && !t.back
          ? '<button class="btn-ghost" data-travel-action="cancel">Quedarme acá</button>'
          : `<button class="btn-ghost" data-travel-action="turn" title="${t.back ? 'Seguir hacia el destino' : 'Volver por el mismo camino (paso a paso)'}">${icon(t.back ? 'arrow-up' : 'arrow-down', 16)}<span>${t.back ? `Seguir hacia ${esc(regionNameOf(t.toId))}` : 'Dar la vuelta'}</span></button>`}
      </div>
    `;
  }

  /** v3.21: gente en el camino: quién es, qué dice y qué podés hacer. */
  function renderPeople(ev) {
    const G = A.Gente;
    if (!G) return '';
    const lk = G.look(ev);
    const evKey = `people|${ev.who}|${(A.State.traveling && A.State.traveling.currentStep) || 0}`;
    if (evKey !== spokenEv && A.Voice && A.Voice.isOn()) { spokenEv = evKey; A.Voice.say(`${lk.title}. ${lk.say}`); }
    const face = lk.enemy ? encounterSprites(ev) : (A.Sprites && A.Sprites.npcHtml ? A.Sprites.npcHtml(lk.npc, { size: 80 }) : '');
    const opts = G.options(ev);
    const offers = opts.filter((o) => o.item);
    const acts = opts.filter((o) => !o.item);
    const P = (n) => (A.UI && A.UI.price ? A.UI.price(n, 16) : `${n}c`);
    const group = roadGroup();
    return `
      <div class="travel-encounter travel-encounter-v2 people-card is-${esc(ev.who)}">
        <div class="encounter-header">
          <div class="encounter-icon-big people-face ${lk.enemy && (ev.enemies || []).length > 1 ? 'is-group' : ''}">${face}</div>
          <div class="encounter-header-text">
            <div class="people-kicker">Gente en el camino</div>
            <div class="encounter-title-v2">${esc(lk.title)}</div>
            ${lk.enemy ? `<div class="encounter-meta-v2"><span class="dim">${esc(ev.enemyName || '')}</span></div>` : ''}
          </div>
        </div>
        <p class="people-say">${esc(lk.say)}</p>
        ${offers.length ? `<div class="people-offers">${offers.map((o) => `
          <div class="people-offer ${o.sold ? 'is-sold' : ''}">
            <span class="people-offer-sprite">${A.UI && A.UI.itemSprite ? A.UI.itemSprite(o.item, 40) : ''}</span>
            <span class="people-offer-info">
              <span class="people-offer-name">${esc((A.UI.itemData && (A.UI.itemData(o.item) || {}).name) || o.item)}</span>
              <span class="people-offer-price">${P(o.price)} <span class="people-tag ${o.cheap ? 'is-cheap' : 'is-dear'}">${o.cheap ? 'Barato' : 'Caro'}</span></span>
            </span>
            <button class="btn-mini" data-meet="${o.id}" ${o.ok ? '' : `disabled title="${esc(o.why || '')}"`}>${o.sold ? 'Comprado' : 'Comprar'}</button>
          </div>`).join('')}</div>` : ''}
        ${group ? `<div class="scene-party road-vote">${icon('party', 16)}<span>Cualquiera puede elegir. Si hay que pagar o dar algo, lo pone el que toca.</span></div>` : ''}
        <div class="encounter-actions-v2 people-actions">
          ${acts.map((o) => `<button class="${o.tone === 'primary' ? 'btn-primary' : o.tone === 'secondary' ? 'btn-secondary' : 'btn-ghost'} people-btn" data-meet="${o.id}" ${o.ok ? (o.title ? `title="${esc(o.title)}"` : '') : `disabled title="${esc(o.why || '')}"`}>
            ${o.icon ? `<span class="btn-icon">${icon(o.icon, 20)}</span>` : ''}<span>${esc(o.label)}</span>${o.price ? `<span class="people-btn-price">${P(o.price)}</span>` : ''}
          </button>`).join('')}
        </div>
      </div>`;
  }

  /**
   * v1.6.9: Renderiza el último evento como una "tarjeta de stage" grande.
   */
  // v2.0: cada tipo de suceso del camino con su ícono pixel
  const EVENT_ICON = {
    narrative: 'feather', minor_loot: 'coins', biome_loot: 'herb', treasure: 'chest',
    damage: 'trap', heal: 'heart', nothing: 'boot',
  };

  function eventIcon(ev, size) {
    if (ev.kind === 'creature' && ev.enemyId) return enemySprite(ev.enemyId, size);
    if (ev.kind === 'people') return ev.who === 'bandits' || (ev.who === 'wounded' && ev.enemyId) ? enemySprite(ev.enemyId, size) : (A.Sprites && A.Sprites.npcHtml ? A.Sprites.npcHtml({ look: ev.who === 'merchant' ? 'merchant' : 'villager' }, { size }) : icon('party', size));
    return icon(EVENT_ICON[ev.kind] || 'feather', size);
  }

  // v3.1: la voz del narrador lee lo que pasa en el camino (una vez cada suceso)
  let spokenEv = null;
  function renderStageEvent(ev) {
    const k = ev.kind || 'narrative';
    const evKey = `${k}|${ev.text || ''}|${(A.State.traveling && A.State.traveling.currentStep) || 0}`;
    if (evKey !== spokenEv && A.Voice && A.Voice.isOn() && ev.text && k !== 'creature') { spokenEv = evKey; A.Voice.say(ev.text); }
    const themeMap = {
      narrative: { cls: 'is-narrative', title: 'Algo en el camino' },
      minor_loot: { cls: 'is-loot', title: '¡Encontraste algo!' },
      biome_loot: { cls: 'is-biome-loot', title: 'Hallazgo del camino' },
      creature: { cls: 'is-creature', title: 'Encuentro' },
      treasure: { cls: 'is-loot', title: 'Tesoro' },
      damage: { cls: 'is-danger', title: 'Peligro' },
      heal: { cls: 'is-heal', title: 'Buen presagio' },
      people: { cls: 'is-people', title: 'Gente en el camino' },
    };
    const theme = themeMap[k] || themeMap.narrative;
    return `
      <div class="travel-stage-card ${theme.cls}">
        <div class="travel-stage-card-icon">${eventIcon(ev, 48)}</div>
        <div class="travel-stage-card-content">
          <div class="travel-stage-card-title">${theme.title}</div>
          <div class="travel-stage-card-text">${esc(ev.text || '')}</div>
        </div>
      </div>
    `;
  }

  function eventLogRow(e) {
    return `
      <div class="travel-log-row">
        <span class="travel-log-icon">${eventIcon(e, 20)}</span>
        <span class="travel-log-text">${esc(e.text || '...')}</span>
      </div>
    `;
  }

  // v1.9.0: sprites en pixel art en lugar de emojis
  function enemySprite(enemyOrId, size) {
    return A.Sprites ? A.Sprites.html(enemyOrId, { size }) : '';
  }

  function encounterSprites(ev) {
    const list = (ev.enemies && ev.enemies.length) ? ev.enemies : [ev.enemyId];
    const shown = list.slice(0, 4);
    const size = shown.length === 1 ? 80 : shown.length === 2 ? 64 : 56;
    return shown.map((x) => enemySprite(x, size)).join('') + (list.length > 4 ? `<span class="encounter-more">+${list.length - 4}</span>` : '');
  }

  function renderEncounter(ev) {
    const enemy = A.Data.getById('enemies', ev.enemyId);
    const isGroup = (ev.enemies || []).length > 1;
    const groupSize = (ev.enemies || []).length;
    // v3.3: el narrador también cuenta las criaturas del camino
    const evKey = `creature|${ev.enemyName || ''}|${(A.State.traveling && A.State.traveling.currentStep) || 0}`;
    if (evKey !== spokenEv && A.Voice && A.Voice.isOn()) {
      spokenEv = evKey;
      const list = (ev.enemies && ev.enemies.length) ? ev.enemies : (enemy ? [enemy] : []);
      const who = list.length && A.Narrator && A.Narrator.groupPhrase ? A.Narrator.groupPhrase(list).text : 'una criatura';
      A.Voice.say(`En el camino ${list.length > 1 ? 'aparecen' : 'aparece'} ${who}.`);
    }
    return `
      <div class="travel-encounter travel-encounter-v2">
        <div class="encounter-header">
          <div class="encounter-icon-big ${isGroup ? 'is-group' : ''}">${encounterSprites(ev)}</div>
          <div class="encounter-header-text">
            <div class="encounter-title-v2">${isGroup ? `Aparecieron ${groupSize} enemigos` : `Apareció ${A.Utils.escapeHtml(ev.enemyName)}`}</div>
            <div class="encounter-meta-v2">
              ${isGroup ? `<span class="dim">${A.Utils.escapeHtml(ev.enemyName)}</span>` : `
                <span class="pill pill-tier">Nivel ${ev.tier}</span>
                <span class="pill pill-cat-${categoryLabel(ev.category, ev) === 'Mini jefe' ? 'mini' : (ev.category || 'normal')}">${categoryLabel(ev.category, ev)}</span>
                ${enemy && A.ItemSprites && A.ItemSprites.dcBadge ? A.ItemSprites.dcBadge(enemy.difficulty != null ? enemy.difficulty : 10, { size: 26 }) : ''}
                ${ev.tameable ? `<span class="pill pill-tameable">${icon('paw', 14)} Domable</span>` : ''}
              `}
            </div>
          </div>
        </div>
        <p class="encounter-desc-v2">${isGroup
          ? 'Vienen juntos por el camino. Mejor decidir rápido.'
          : (enemy && enemy.tameable
            ? 'Te observa con curiosidad. Quizás puedas acercarte sin pelear.'
            : 'No parece dispuesto a parlamentar.')}</p>
        ${roadVoteBar(ev)}
        <div class="encounter-actions-v2">
          <button class="btn-primary encounter-btn-fight ${myRoadVote(ev) === 'fight' ? 'is-voted' : ''}" data-travel-action="fight" data-enemy-id="${A.Utils.escapeHtml(ev.enemyId)}">
            <span class="btn-icon">${icon('swords', 20)}</span>
            <span>Pelear</span>${roadVoteTags(ev, 'fight')}
          </button>
          ${roadOpts(ev).includes('tame') ? `
            <button class="btn-secondary encounter-btn-tame ${myRoadVote(ev) === 'tame' ? 'is-voted' : ''}" data-travel-action="tame" data-enemy-id="${A.Utils.escapeHtml(ev.enemyId)}">
              <span class="btn-icon">${icon('paw', 20)}</span>
              <span>${roadGroup() ? 'Domar' : 'Intentar domar'}</span>${roadVoteTags(ev, 'tame')}
            </button>
          ` : ''}
          ${(() => {
            const odds = calculateAvoidOdds(ev);
            return `<button class="btn-ghost encounter-btn-avoid ${myRoadVote(ev) === 'avoid' ? 'is-voted' : ''}" data-travel-action="avoid" title="D20+${odds.speedBonus} contra dificultad ${odds.dc}">
              <span class="btn-icon">${icon('run', 20)}</span>
              <span>Evitar (${odds.chancePct}%)</span>${roadVoteTags(ev, 'avoid')}
            </button>`;
          })()}
        </div>
      </div>
    `;
  }

  // ---------- v3.11.1: en grupo, lo que aparece en el camino se vota ----------
  function roadGroup() {
    if (guestFollows()) return true;
    const g = A.Party && A.Party.combatHeroes ? A.Party.combatHeroes() : null;
    return !!(g && g.length > 1);
  }
  function roadOpts(ev) {
    if (A.Travel && A.Travel.roadOptions) return A.Travel.roadOptions(ev, roadGroup());
    return ['fight', 'avoid'];
  }
  function myHidRoad() { return A.State.me && A.State.hidOf ? A.State.hidOf(A.State.me()) : 'me'; }
  function myRoadVote(ev) { return roadGroup() && ev && ev.votes ? ev.votes[myHidRoad()] || null : null; }
  function hidName(hid) {
    const h = A.State.heroById ? A.State.heroById(hid) : null;
    if (h && h.name) return h.name;
    const m = A.Party && A.Party.member ? A.Party.member(hid) : null;
    return (m && m.name) || 'Tu compañero';
  }
  function namesYRoad(list) { return list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`; }
  function roadVoteTags(ev, choice) {
    if (!roadGroup() || !ev || !ev.votes) return '';
    const who = Object.keys(ev.votes).filter((h) => ev.votes[h] === choice);
    if (!who.length) return '';
    return `<span class="scene-votes road-votes">${who.map((h) => `<span class="scene-vote ${h === myHidRoad() ? 'is-mine' : ''}">${icon('check', 12)}${esc(h === myHidRoad() ? 'Tu voto' : hidName(h))}</span>`).join('')}</span>`;
  }
  function roadVoteBar(ev) {
    if (!roadGroup()) return '';
    const me = myHidRoad();
    const voters = Array.isArray(ev.voters) && ev.voters.length ? ev.voters
      : (A.Party && A.Party.combatHeroes ? (A.Party.combatHeroes() || []).map((h) => A.State.hidOf(h)) : []);
    const votes = ev.votes || {};
    const mine = !!votes[me];
    const waiting = voters.filter((h) => h !== me && !votes[h]);
    const others = Object.keys(votes).filter((h) => h !== me);
    let text = 'Decidan entre todos: cada uno vota. Si votan distinto, gana lo más votado, y si empatan decide un dado.';
    if (mine && waiting.length) text = `Votaste ${({ fight: 'pelear', avoid: 'evitar', tame: 'domar' })[votes[me]] || ''}. Esperando a ${namesYRoad(waiting.map(hidName))}… (podés cambiar tu voto)`;
    else if (!mine && others.length) text = `${namesYRoad(others.map(hidName))} ya ${others.length > 1 ? 'votaron' : 'votó'}. Te toca elegir.`;
    return `
      <div class="scene-party is-vote road-vote">
        ${icon('party', 16)}<span>${esc(text)}</span>
        ${mine && waiting.length ? `<button class="btn-mini scene-force is-hidden" data-travel-action="force" title="Si alguien no está, se decide con los votos que hay">Decidir sin esperar</button>` : ''}
      </div>`;
  }

  /**
   * v1.6.4: Calcula la dificultad de evitar un encuentro.
   * Devuelve { dc, bonus, chancePct } donde:
   *   - dc: dificultad a superar (8-18 según peligro)
   *   - bonus: D20 + (speed/4) + ajustes de hambre/noche/peso
   *   - chancePct: probabilidad estimada de éxito
   */
  function calculateAvoidOdds(event) {
    if (A.Travel && A.Travel.avoidOdds) return A.Travel.avoidOdds(event); // v3.11.1
    const p = A.State.player;
    if (!p) return { dc: 10, bonus: 0, chancePct: 50 };

    // DC base por peligro: tier máximo del enemigo
    let dc = 8;
    let enemies = (event && Array.isArray(event.enemies) && event.enemies.length > 0)
      ? event.enemies
      : (event && event.enemyId ? [{ tier: (A.Data.getById('enemies', event.enemyId) || {}).tier || 1 }] : []);
    const maxTier = enemies.reduce((acc, e) => Math.max(acc, e.tier || 1), 1);
    dc = 8 + Math.min(10, maxTier - 1);

    // Más enemigos = más difícil
    if (enemies.length > 1) dc += (enemies.length - 1) * 2;

    // Modificador por hambre (Survival.weak/starving)
    if (A.Survival) {
      const status = A.Survival.getStatus();
      if (status.id === 'weak') dc += 1;
      if (status.id === 'starving') dc += 2;
    }

    // Modificador nocturno
    if (A.Time && A.Time.isNight()) dc += 1;

    // Bonus del jugador: D20 promedio (10.5) + speed/4
    // v2.4: la velocidad real (el peso del equipo frena)
    const speed = (A.Balance && A.Balance.playerCombatStats ? A.Balance.playerCombatStats(p).speed : (p.stats && p.stats.speed)) || 10;
    const speedBonus = Math.floor(speed / 4);

    // Probabilidad: P(D20 + speedBonus >= dc) = (21 - (dc - speedBonus)) / 20
    const need = Math.max(1, dc - speedBonus);
    const successOutcomes = Math.max(0, Math.min(20, 21 - need));
    const chancePct = Math.round((successOutcomes / 20) * 100);

    return { dc, speedBonus, chancePct };
  }

  /**
   * v1.6.4: Tirada de D20 + speedBonus contra dc. Devuelve resultado.
   */
  function rollAvoid(event) {
    const odds = calculateAvoidOdds(event);
    const roll = 1 + Math.floor(Math.random() * 20);
    const total = roll + odds.speedBonus;
    const success = total >= odds.dc;
    return { roll, speedBonus: odds.speedBonus, total, dc: odds.dc, success };
  }

  function eventRow(e) {
    const cls = e.kind === 'creature' ? 'is-creature' : '';
    return `
      <div class="travel-event ${cls}">
        <span class="travel-event-icon">${eventIcon(e, 18)}</span>
        <span class="travel-event-text">${A.Utils.escapeHtml(e.text || '...')}</span>
      </div>
    `;
  }

  // ---------- Helpers de render ----------

  function npcCard(n) {
    const marker = A.Quests ? A.Quests.markerFor(n.id) : null;
    // v3.20.1: lo que ofrece cada uno, en chapitas con dibujo
    const offers = [];
    if ((n.sells || []).length) offers.push(['shop', 'Comercia']);
    // v3.3: los talleres de cada uno (forja, encantamiento, alquimia)
    const ws = Array.isArray(n.crafts) ? n.crafts : (n.role === 'blacksmith' ? ['forge', 'enchant'] : []);
    if (ws.includes('forge')) offers.push(['anvil', 'Forja']);
    else if (ws.includes('enchant')) offers.push(['arcane', 'Encanta']);
    if (n.role === 'blacksmith' && A.Oficios) offers.push(['up', 'Mejora']);
    if (ws.includes('alchemy')) offers.push(['potion', 'Alquimia']);
    if ((n.teaches || []).length) offers.push(['book', 'Enseña magia']);
    if (n.services && n.services.restCost != null) offers.push(['tent', 'Posada']);
    if (A.Oficios && (n.role === 'merchant' || n.role === 'noble')) offers.push(['star', 'Lucirse']);
    if (A.Quests && A.Quests.list().some((q) => q.giver === n.id)) offers.push(['quest', 'Encargos']);
    return `
      <button class="npc2-card ${marker ? 'has-quest' : ''}" data-npc="${esc(n.id)}" title="${esc(`${n.name}: ${offers.map((o) => o[1]).join(', ')}`)}">
        ${A.UI ? A.UI.portrait(n, 56, marker) : ''}
        <span class="npc2-card-info">
          <span class="npc2-card-name">${esc(n.name)}</span>
          <span class="npc2-card-role">${esc(n.roleName || roleLabel(n.role))}</span>
          ${offers.length ? `<span class="npc2-card-offers">${offers.slice(0, offers.length > 3 ? 2 : 3).map(([ic, t]) => `<span class="npc-off">${icon(ic, 13)}<span>${esc(t)}</span></span>`).join('')}${offers.length > 3 ? `<span class="npc-off is-more">+${offers.length - 2}</span>` : ''}</span>` : ''}
        </span>
      </button>
    `;
  }

  function travelCard(n) {
    const dangerLabel = (n.type === 'safe' || n.type === 'road') ? 'Seguro' : 'Combate';
    const dangerClass = (n.type === 'safe' || n.type === 'road') ? 'pill-safe' : 'pill-combat';
    const enemiesCount = A.Data.enemiesInRegion(n.id).length;
    const dist = n.distance || 1;
    const travelCheck = A.Travel.canTravelToDetailed(n.id);
    const locked = !travelCheck.ok && travelCheck.locked;
    const cls = `travel-card ${locked ? 'is-locked' : ''}`;
    return `
      <button class="${cls}" data-travel="${n.id}" ${locked ? 'data-locked="1"' : ''}>
        <div class="travel-icon">${A.UI ? A.UI.biomeIcon(n, 28) : ''}</div>
        <div class="travel-info">
          <div class="travel-name">${A.Utils.escapeHtml(n.name)}</div>
          <div class="travel-meta">
            <span class="pill ${dangerClass}">${dangerLabel}</span>
            <span class="pill pill-tier">Nivel ${n.tier[0]}${n.tier[1] !== n.tier[0] ? `–${n.tier[1]}` : ''}</span>
            <span class="dim">${dist === 1 ? 'Cerca' : dist === 2 ? 'Medio camino' : 'Lejos'}</span>
            ${enemiesCount ? `<span class="dim">· ${enemiesCount} criaturas</span>` : ''}
          </div>
          ${locked ? `<div class="travel-locked-msg">${icon('lock', 14)} ${esc(travelCheck.error || 'Bloqueada')}</div>` : ''}
        </div>
        <div class="travel-arrow dim">${locked ? icon('lock', 16) : '›'}</div>
      </button>
    `;
  }

  function biomeLabel(b) {
    const map = {
      village: 'Aldea', forest: 'Bosque', graveyard: 'Cementerio',
      plains: 'Llanura', swamp: 'Pantano', coast: 'Costa',
      arcane: 'Tierras arcanas', mountain: 'Montaña', desert: 'Desierto',
      ruins: 'Ruinas', crypt: 'Cripta', cave: 'Cueva',
      sea: 'Mar abierto', volcano: 'Volcán', hell: 'Infierno',
      lair: 'Guarida', abyss: 'Abismo',
      hills: 'Colinas', meadow: 'Pradera', darkwood: 'Bosque oscuro', dream: 'Bosque encantado',
      grove: 'Santuario', gothic: 'Ciudad de la noche', pirate: 'Puerto pirata', bloodwood: 'Jardín maldito',
      sky: 'Cielo', space: 'Espacio', // v3.12
    };
    return map[b] || b;
  }

  function roleLabel(role) {
    const map = {
      merchant: 'Mercader', shopkeeper: 'Comerciante', vendor: 'Vendedor',
      blacksmith: 'Herrero', innkeeper: 'Posadero', tavernkeeper: 'Tabernero',
      healer: 'Curandero', priest: 'Sacerdote', sage: 'Sabio',
      wizard: 'Mago', mage: 'Mago', quest: 'Tiene un encargo',
      guard: 'Guardia',
    };
    return map[role] || role;
  }

  function categoryLabel(c, e) {
    const sid = e && (e.enemyId || e.id);
    if (e && (e.miniBoss || (sid && (A.Data.getById('enemies', sid) || {}).miniBoss))) return 'Mini jefe'; // v3.11.1
    return ({ weak: 'Débil', normal: 'Normal', strong: 'Fuerte', boss: 'Jefe' })[c] || c;
  }

  // ---------- Bindings ----------

  function bindEvents() {
    mainEl.querySelectorAll('[data-watch-fight]').forEach((b) => b.addEventListener('click', () => { A.State.ui.combatHidden = null; A.Bus.emit('view:changed'); }));
    mainEl.querySelectorAll('[data-travel]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.locked === '1') {
          onTravelLocked(btn.dataset.travel);
        } else {
          onTravel(btn.dataset.travel);
        }
      });
    });
    mainEl.querySelectorAll('[data-npc]').forEach((btn) => {
      btn.addEventListener('click', () => A.State.openModal('npc', { npcId: btn.dataset.npc }));
    });
    mainEl.querySelectorAll('[data-creature]').forEach((btn) => {
      btn.addEventListener('click', () => A.State.openModal('creature', { enemyId: btn.dataset.creature }));
    });
    mainEl.querySelectorAll('[data-show-all]').forEach((btn) => {
      btn.addEventListener('click', () => A.State.openModal('all-creatures', { regionId: btn.dataset.showAll }));
    });
    mainEl.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => onAction(btn.dataset.action));
    });
    const nc = mainEl.querySelector('[data-note-close]');
    if (nc) nc.addEventListener('click', () => { lastNote = null; render(); });
  }

  function bindTravelEvents() {
    // v1.7.0: bind del selector de modo
    mainEl.querySelectorAll('[data-travel-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.travelMode;
        setTravelMode(mode);
        render(); // re-render para actualizar el selector visual
      });
    });

    // v3.11.1: si alguien no vota, a los 20 segundos de tu voto se puede decidir sin esperar
    clearTimeout(roadForceTimer);
    const forceBtn = mainEl.querySelector('[data-travel-action="force"].is-hidden');
    if (forceBtn) {
      const ev = A.Travel && A.Travel.pendingCreature ? A.Travel.pendingCreature() : null;
      const at = (ev && ev.votedAt && ev.votedAt[myHidRoad()]) || Date.now();
      roadForceTimer = setTimeout(() => forceBtn.classList.remove('is-hidden'), Math.max(0, 20000 - (Date.now() - at)));
    }
    // v3.21: gente en el camino
    mainEl.querySelectorAll('[data-meet]').forEach((btn) => btn.addEventListener('click', () => {
      clearAutoStepTimer();
      const res = A.Travel.meet(btn.dataset.meet);
      if (res && res.ok === false && res.error) {
        if (A.Views && A.Views.Party && A.Views.Party.toast) A.Views.Party.toast(res.error, 'bad');
        else { lastNote = { icon: 'warning', text: res.error }; render(); }
        return;
      }
      if (res && !res.fight) { render(); setTimeout(scheduleAutoStep, 100); }
    }));
    mainEl.querySelectorAll('[data-travel-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        // v1.7.0: cualquier acción manual cancela el timer de auto
        clearAutoStepTimer();
        const action = btn.dataset.travelAction;
        if (action === 'step') {
          A.Travel.step();
          // Re-render se hace via Bus, pero también iniciamos próximo auto-step
          setTimeout(scheduleAutoStep, 100);
        } else if (action === 'cancel') {
          A.Travel.cancel();
        } else if (action === 'turn') {
          A.Travel.turnBack(); // v3.10: dar la vuelta (o seguir) a mitad de camino (re-dibuja por travel:step)
          setTimeout(scheduleAutoStep, 100);
        } else if ((action === 'avoid' || action === 'fight' || action === 'tame' || action === 'force') && A.Travel && A.Travel.decide) {
          // v3.11.1: lo decide Travel (en grupo se vota; solo, se hace enseguida)
          const ev = A.Travel.pendingCreature ? A.Travel.pendingCreature() : null;
          const choice = action === 'force' ? (ev && ev.votes && ev.votes[myHidRoad()]) : action;
          if (!choice) return;
          const res = A.Travel.decide(choice, action === 'force' ? { force: true } : {});
          if (res && res.ok === false && res.error) {
            if (A.Views && A.Views.Party && A.Views.Party.toast) A.Views.Party.toast(res.error, 'bad');
            else { lastNote = { icon: 'warning', text: res.error }; render(); }
          }
        } else if (action === 'avoid') {
          // v1.6.4: Evitar requiere tirada D20+speedBonus vs DC del encuentro
          const t = A.State.traveling;
          const last = t.events[t.events.length - 1];
          if (last && last.kind === 'creature') {
            const result = rollAvoid(last);
            const enemyName = last.enemyName || 'al enemigo';
            if (result.success) {
              last.resolved = true;
              last.text = `Esquivaste a ${enemyName}.`;
              A.State.addChronicle({
                type: 'travel',
                text: `Esquivaste a ${enemyName} sin que te vieran (dado ${result.roll}+${result.speedBonus} contra ${result.dc}).`,
              });
              A.State.persist();
              A.Travel.step();
            } else {
              // Fallaste: combate empieza con desventaja (enemigos atacan primero)
              last.resolved = true;
              last.text = `Te detectaron al intentar evitar a ${enemyName}.`;
              A.State.addChronicle({
                type: 'travel',
                text: `Quisiste esquivar a ${enemyName}, pero te vieron (dado ${result.roll}+${result.speedBonus} contra ${result.dc}). Te atacan primero.`,
              });
              A.State.persist();
              if (last.enemies && last.enemies.length > 0) {
                A.Combat.start({ enemies: last.enemies, fromTravel: true, ambush: true });
              } else {
                A.Combat.start({ enemyId: btn.dataset.enemyId || last.enemyId, fromTravel: true, ambush: true });
              }
            }
          } else {
            // Fallback: si no hay enemigo, simplemente avanzar
            A.State.persist();
            A.Travel.step();
          }
        } else if (action === 'tame') {
          A.State.openModal('tame', { enemyId: btn.dataset.enemyId, fromTravel: true });
        } else if (action === 'fight') {
          const t = A.State.traveling;
          const last = t.events[t.events.length - 1];
          if (last && last.kind === 'creature') {
            last.resolved = true;
            last.text = `Peleaste contra ${last.enemyName}.`;
          }
          A.State.persist();
          // Si el evento trae enemies[] (grupo), usar esos; si no, fallback a enemyId individual
          if (last && Array.isArray(last.enemies) && last.enemies.length > 0) {
            A.Combat.start({ enemies: last.enemies, fromTravel: true });
          } else {
            A.Combat.start({ enemyId: btn.dataset.enemyId, fromTravel: true });
          }
        }
      });
    });
  }

  function onTravel(targetId) {
    const result = A.Travel.start(targetId);
    if (!result.ok && result.error) {
      // v1.8.0: antes el error solo iba a la consola y parecía que "no pasaba nada"
      if (result.locked) { onTravelLocked(targetId); return; }
      // v1.9.1: el aviso alcanza; no se guarda el error en las crónicas
      A.State.openModal('confirm', { title: 'No podés viajar', body: result.error });
    }
  }

  function onTravelLocked(targetId) {
    const check = A.Travel.canTravelToDetailed(targetId);
    if (check.locked) {
      // Mostrar mensaje
      A.State.openModal('confirm', {
        title: 'Región bloqueada',
        body: check.error,
      });
    }
  }

  function onAction(action) {
    // v3.4: las misiones del centro abren el Diario
    if (action === 'journal') { A.State.openModal('journal', { tab: 'quests' }); return; }
    if (action === 'open-travel') {
      lastNote = null;
      A.State.ui.showMap = true;
      A.Bus.emit('view:changed');
      return;
    }
    if (action === 'rest') {
      // v2.0: descansar siempre hace algo (siesta de día, dormir de noche)
      const res = A.Explore ? A.Explore.rest() : null;
      if (res && res.kind !== 'night-event') {
        lastNote = { icon: res.kind === 'sleep' ? 'moon' : 'tent', text: res.text, chips: res.chips };
        sayNote(lastNote);
      } else {
        lastNote = null;
      }
      render();
      return;
    }
    if (action === 'explore') {
      lastNote = null;
      if (A.Explore) A.Explore.explore();
      render();
      return;
    }
    // v3.11: desafiar (o invocar) al jefe de la guarida
    if (action === 'challenge') {
      const w = A.State.world;
      const res = A.Lairs && w ? A.Lairs.challenge(w.regionId) : null;
      if (res && !res.ok) { lastNote = { icon: 'warning', text: res.reason }; sayNote(lastNote); }
      else lastNote = null;
      render();
    }
  }

  function executeRegionEventInline(ev) {
    if (ev.type === 'treasure') {
      const amount = A.Utils.rollDice(ev.amount || '1d10');
      A.Currency.add(amount);
      A.State.addChronicle({ type: 'loot', text: `Encontraste ${A.Currency.formatPrice(amount)} escondidos.` });
    } else if (ev.type === 'find' && ev.reward) {
      const item = A.Data.getById('items', ev.reward) ||
                   A.Data.getById('weapons', ev.reward) ||
                   A.Data.getById('armors', ev.reward);
      if (item && A.State.addItem(ev.reward, 1)) {
        A.State.addChronicle({ type: 'loot', text: `Encontraste: ${item.name}.` });
      }
    } else if (ev.type === 'damage') {
      // v3.3: las trampas pueden matar (ver A.Death)
      const p = A.State.player;
      const dmg = Math.max(0, Math.min(A.Utils.rollDice(ev.amount || '1d4'), p.hp || 0));
      const flavor = ev.effect || 'Algo te lastimó';
      const hit = () => A.State.damagePlayer(dmg);
      if (dmg > 0) { if (A.Death) A.Death.during('trap', { text: `${flavor}. No volviste a levantarte.` }, hit); else hit(); }
      const low = p.hp > 0 && p.hp <= Math.max(3, Math.round(p.maxHp * 0.3)) ? ' Te queda poca vida: otra trampa te puede matar.' : '';
      A.State.addChronicle({ type: 'note', text: `${flavor}. -${dmg} de salud.${p.hp <= 0 ? ' No volviste a levantarte.' : low}` });
    } else if (ev.type === 'heal') {
      const amount = A.Utils.rollDice(ev.amount || '1d6');
      A.State.healHp(amount);
      A.State.addChronicle({ type: 'rest', text: `Algo te reconfortó. +${amount} de salud.` });
    }
  }

  const WorldView = {
    mount(container) {
      mainEl = container;
      render();
    },
    /** v3.0: un aviso arriba de las acciones (descanso del grupo, por ejemplo). */
    showNote(note) {
      if (!note || !note.text) return;
      lastNote = { icon: note.icon || 'tent', text: note.text, chips: note.chips || [] };
      sayNote(lastNote);
      if (mainEl && !A.State.traveling && !A.State.combat) render();
    },
    unmount() {
      // v1.7.0: limpiar timer de auto-step al cambiar de vista
      clearAutoStepTimer();
      if (mainEl) mainEl.innerHTML = '';
    },
  };

  A.Views = A.Views || {};
  A.Views.World = WorldView;
})(window.Aventurs);
