/* ============================================================
   Aventurs — La muerte (v3.3)

   - Caer en una pelea no es morir:
       · en grupo, si tu grupo gana, te levantan (y en plena pelea te
         pueden levantar con una hierba de la vida);
       · si perdés (solo, o porque cayeron todos), se tira el DADO DE
         RESCATE: si sale, alguien te encuentra y te lleva al pueblo con
         1 de vida; si no, tu aventura termina.
   - Fuera de las peleas, llegar a 0 de vida (una trampa, una caída, el
     hambre) es morir para siempre.
   - El que muere ve su pantalla de muerte en su compu. Si era el
     compañero que se jugaba en la compu del anfitrión, el anfitrión se
     lo manda y lo suelta del grupo (js/net/party.js).

   El héroe muerto queda marcado con hero.dead = { cause, text, ... }:
   así la pantalla vuelve a salir si se recarga la página.
   ============================================================ */

(function (A) {
  'use strict';

  // ---------- Dado de rescate ----------
  //   d20 (+ ayudas) contra lo difícil que es que alguien pase por ahí:
  //   pueblos y lugares seguros, 2; el resto, 4 + el peligro de la zona
  //   (de 6 cerca del pueblo a 14 en lo más hondo del mapa).
  //   Un 1 nunca alcanza. Un 20: te encuentra una curandera (mitad de vida).
  const RESCUE = {
    safeDc: 2,
    base: 4,
    min: 5,
    max: 14,
    pet: 3,   // tu mascota en pie corre a buscar ayuda
    luck: 2,  // Suerte (mediano)
  };

  const RESCUERS = {
    any: ['Un pastor', 'Una patrulla del pueblo', 'Una caravana de mercaderes', 'Una cazadora', 'Un monje que pasaba', 'Unos leñadores', 'Un viejo ermitaño', 'Unos peregrinos'],
    sea: ['Unos pescadores', 'Un barco mercante', 'Una balsa de contrabandistas'],
    safe: ['La guardia', 'Unos vecinos', 'El posadero'],
    crit: ['Una curandera', 'Un druida', 'Una sacerdotisa'],
  };
  const SEA = new Set(['sea', 'coast', 'pirate', 'abyss']);

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  function regionOf(id) {
    const rid = id || (A.State.world && A.State.world.regionId);
    return rid && A.Data ? A.Data.getById('regions', rid) : null;
  }

  /** Lo difícil que es que te encuentren en una región (el número a sacar). */
  function rescueDc(region) {
    if (!region) return RESCUE.min;
    if ((region.type === 'safe' || region.type === 'road')) return RESCUE.safeDc;
    const tier = Array.isArray(region.tier) ? (region.tier[1] || region.tier[0] || 1) : (region.tier || 1);
    return Math.max(RESCUE.min, Math.min(RESCUE.max, RESCUE.base + tier));
  }

  /**
   * Tira el dado de rescate de un héroe caído.
   * opts: { regionId, petUp }
   * Devuelve { roll, bonus, total, dc, ok, crit, by, why: [texto], regionName }.
   */
  function rescueRoll(hero, opts) {
    const o = opts || {};
    const region = regionOf(o.regionId);
    const dc = rescueDc(region);
    const roll = A.Utils.dice(20);
    const why = [];
    let bonus = 0;
    if (o.petUp && hero && hero.pet) { bonus += RESCUE.pet; why.push(`${hero.pet.name} corre a buscar ayuda (+${RESCUE.pet})`); }
    if (A.Passives && A.Passives.has && A.Passives.has(hero, 'suerte')) { bonus += RESCUE.luck; why.push(`Suerte (+${RESCUE.luck})`); }
    const total = roll + bonus;
    const ok = roll !== 1 && total >= dc;
    const crit = ok && roll === 20;
    let by = '';
    if (ok) {
      if (crit) by = pick(RESCUERS.crit);
      else if (region && (region.type === 'safe' || region.type === 'road')) by = pick(RESCUERS.safe);
      else if (region && SEA.has(region.biome)) by = pick(RESCUERS.sea.concat(RESCUERS.any.slice(0, 2)));
      else by = pick(RESCUERS.any);
    }
    return { roll, bonus, total, dc, ok, crit, by, why, regionName: region ? region.name : 'el camino' };
  }

  /** Texto corto de la tirada: "14 (+3) contra 8". */
  function rollText(r) {
    if (!r || r.roll == null) return '';
    return `${r.roll}${r.bonus ? ` + ${r.bonus} = ${r.total}` : ''} contra ${r.dc}`;
  }

  // ---------- Causas ----------
  const CAUSES = {
    combat: { title: 'Tu aventura terminó', label: 'En combate', text: 'Caíste en combate y nadie te encontró a tiempo.' },
    trap: { title: 'Una trampa te mató', label: 'Una trampa', text: 'Una trampa te dejó sin fuerzas y no volviste a levantarte.' },
    starvation: { title: 'Caíste por inanición', label: 'Inanición', text: 'El hambre te consumió. No volviste a levantarte.' },
    wounds: { title: 'Tus heridas te vencieron', label: 'Heridas', text: 'Las heridas fueron demasiado. No volviste a levantarte.' },
  };

  // Lo que estás haciendo ahora puede matarte (una trampa del camino, un barranco):
  // si la vida llega a 0 mientras tanto, la causa es esa.
  let pending = null;
  /** Corre fn con una causa de muerte en espera ('trap', con su texto). */
  function during(cause, info, fn) {
    const prev = pending;
    pending = { cause, info: info || {} };
    try { return fn(); } finally { pending = prev; }
  }

  /**
   * Un héroe murió para siempre. Si es el de esta compu, sale la pantalla
   * (si hay una pelea, cuando toque Continuar). Si es un compañero jugado
   * acá, el grupo se lo avisa en su compu.
   * info: { text, regionId }
   */
  function killHero(hero, cause, info) {
    if (!hero || hero.dead) return;
    const i = info || {};
    const w = A.State.world || {};
    const region = regionOf(i.regionId || w.regionId);
    const why = CAUSES[cause] ? cause : 'wounds';
    hero.hp = 0;
    hero.dead = {
      cause: why,
      text: i.text || CAUSES[why].text,
      regionId: region ? region.id : (w.regionId || null),
      regionName: region ? region.name : 'el camino',
      day: w.day || 1,
      level: hero.level || 1,
      at: Date.now(),
    };
    A.State.withHero(hero, () => {
      A.State.addChronicle({ type: 'system', text: `${hero.name} murió (${CAUSES[why].label.toLowerCase()}) en ${hero.dead.regionName}. Sobreviviste ${hero.dead.day} día${hero.dead.day > 1 ? 's' : ''}.` });
    });
    const local = hero === (A.State.me ? A.State.me() : A.State.player);
    if (!local) {
      // en la pelea, el grupo lo suelta al terminar (así ve el resultado)
      if (!A.State.combat && A.Party && A.Party.heroDied) A.Party.heroDied(A.State.hidOf(hero));
      return;
    }
    if (!A.State.combat) {
      // el viaje no sigue (y la pantalla sale después de ver qué pasó)
      if (A.State.traveling) A.State.traveling = null;
      // si llevabas un grupo, tus compañeros siguen por su cuenta
      if (A.Party && A.Party.hostDied) A.Party.hostDied();
      A.State.persist();
      setTimeout(show, 1500);
      return;
    }
    A.State.persist();
  }

  // ---------- Pantalla ----------
  function esc(s) { return A.Utils.escapeHtml(String(s == null ? '' : s)); }

  function show() {
    if (typeof document === 'undefined') return;
    const p = A.State.me ? A.State.me() : A.State.player;
    if (!p || !p.dead) return;
    if (A.State.combat) return; // primero el resultado de la pelea
    if (document.querySelector('.death-overlay')) return;
    document.querySelectorAll('.modal-overlay').forEach((el) => el.remove());
    const d = p.dead;
    const cause = CAUSES[d.cause] || CAUSES.wounds;
    if (A.Voice && A.Voice.isOn && A.Voice.isOn()) A.Voice.say(`${cause.title}. ${d.text}`);
    const overlay = document.createElement('div');
    overlay.className = 'death-overlay';
    overlay.innerHTML = `
      <div class="death-screen">
        <div class="death-icon">${A.ItemSprites ? A.ItemSprites.icon('skull', { size: 72 }) : ''}</div>
        <h1 class="death-title">${esc(cause.title)}</h1>
        <div class="death-narrative">
          <p>${esc(d.text)}</p>
          <p class="death-name">Acá termina la historia de ${esc(p.name)}.</p>
        </div>
        <div class="death-stats">
          <div class="death-stat">
            <div class="death-stat-label">Dónde</div>
            <div class="death-stat-val">${esc(d.regionName || 'el camino')}</div>
          </div>
          <div class="death-stat">
            <div class="death-stat-label">Días sobrevividos</div>
            <div class="death-stat-val">${d.day || 1}</div>
          </div>
          <div class="death-stat">
            <div class="death-stat-label">Nivel alcanzado</div>
            <div class="death-stat-val">${d.level || p.level || 1}</div>
          </div>
          <div class="death-stat">
            <div class="death-stat-label">Causa</div>
            <div class="death-stat-val">${esc(cause.label)}</div>
          </div>
        </div>
        <div class="death-actions">
          <button class="btn-primary death-btn" data-death-action="restart">Empezar nueva aventura</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-death-action="restart"]').addEventListener('click', () => {
      overlay.remove();
      // si estabas en un grupo, te vas (los demás siguen por su cuenta)
      if (A.Party && A.Party.role && A.Party.leave) A.Party.leave();
      A.State.reset();
    });
  }

  /** Si tu héroe está muerto (y no hay una pelea por cerrar), sale la pantalla. */
  function check() {
    const p = A.State.me ? A.State.me() : A.State.player;
    if (p && p.dead && !A.State.combat) show();
  }

  // Llegar a 0 de vida fuera de una pelea (de sistema: también cuando se juega
  // la parte del compañero en la compu del anfitrión)
  A.Bus.on('player:died', (payload) => {
    if (A.State.combat) return; // en la pelea, caer no es morir: lo decide el dado de rescate
    const hero = A.State.player;
    if (!hero || hero.dead || hero.hp > 0) return;
    const pc = pending;
    const cause = (payload && payload.cause) || (pc && pc.cause) || 'wounds';
    killHero(hero, cause, Object.assign({}, pc ? pc.info : {}, payload || {}));
  }, { sys: true });

  A.Death = {
    RESCUE,
    CAUSES,
    rescueDc,
    rescueRoll,
    rollText,
    during,
    killHero,
    kill: (cause, info) => killHero(A.State.player, cause, info),
    show,
    check,
  };
})(window.Aventurs);
