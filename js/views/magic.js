/* ============================================================
   Aventurs — View: Tus hechizos (ventana "magic")

   La abre el botón de la estrella en la cabecera de la barra del
   costado. v3.3: estaba roto (la ventana no tenía contenido);
   ahora muestra cada hechizo con lo que hace, lo que cuesta, si
   tiene espera, si puede fallar y de dónde se aprenden más.
   ============================================================ */

(function (A) {
  'use strict';

  const esc = (s) => A.Utils.escapeHtml(String(s == null ? '' : s));
  const icon = (name, size) => (A.ItemSprites ? A.ItemSprites.icon(name, { size: size || 16 }) : '');

  function classOf(p) { return A.Balance && A.Balance.classOf ? A.Balance.classOf(p) : 'hybrid'; }

  /** Qué hace, en pocas palabras. */
  function whatItDoes(s) {
    const p = A.State.player;
    if (s.damage) return `${A.Schools ? A.Schools.diceOf(s, p) : s.damage} de daño${s.area ? ' a todos' : ''}${s.stun ? ' y lo deja sin turno' : ''}${s.drain ? ' (la mitad vuelve como vida)' : ''}`;
    if (s.partyBuff) return 'A todo tu grupo';
    if (s.partyHeal) return 'Cura a todo tu grupo';
    if (s.pact) return 'Frenesí ya';
    if (s.sleep) return 'Duerme a los enemigos';
    if (s.hex) return 'Maldice a tu blanco';
    if (s.echo || s.buff) return 'Una mejora para vos';
    if (s.heal) return `Cura ${s.heal}`;
    if (s.effect && A.ItemFx && A.ItemFx.summary) return A.ItemFx.summary({ effect: s.effect, subtype: 'scroll' }) || 'Efecto';
    return 'Efecto';
  }

  function tags(p, s) {
    const out = [];
    const cost = A.Passives ? A.Passives.spellCost(p, s) : s.manaCost;
    out.push(`<span class="book-tag is-mana">${icon('spell', 12)}${cost} de maná${cost < s.manaCost ? ` <s>${s.manaCost}</s>` : ''}</span>`);
    if (s.cooldown) out.push(`<span class="book-tag is-cd" title="Después de usarlo, lo podés volver a usar ${s.cooldown} turnos después">${icon('hourglass', 12)}Cada ${s.cooldown} turnos</span>`);
    if (s.damage) out.push(s.sure ? '<span class="book-tag is-sure" title="No tira el dado: siempre pega">No falla</span>' : `<span class="book-tag" title="Tira el dado como un arma, con +${(A.Balance && A.Balance.SPELL_HIT) || 2} a tu precisión: puede fallar y, con 20, es crítico (doble daño)">Puede fallar</span>`);
    if (s.area) out.push('<span class="book-tag">A todos</span>');
    if (s.schoolRank) out.push(`<span class="book-tag is-race">Escuela · nivel ${s.schoolRank}</span>`); // v3.13
    if (s.quick) out.push('<span class="book-tag is-sure" title="No gasta tu turno: después atacás o lanzás otro hechizo (uno rápido por turno)">Rápido</span>');
    else if (s.racial) out.push('<span class="book-tag is-race">De tu raza</span>');
    if (s.hybridOnly) out.push('<span class="book-tag">Solo híbridos</span>');
    if (s.selfOnly) out.push('<span class="book-tag" title="No se le puede tirar a otro">Solo a vos</span>');
    return out.join('');
  }

  function spellRow(p, s) {
    const cost = A.Passives ? A.Passives.spellCost(p, s) : s.manaCost;
    const fx = s.statusEffect && A.ItemFx && A.ItemFx.weaponEffectLine ? A.ItemFx.weaponEffectLine(s) : null;
    const self = s.selfHeal ? `Además te cura ${s.selfHeal} de vida.` : '';
    return `
      <div class="book-row ${(p.mana || 0) >= cost ? '' : 'is-low'}">
        <span class="book-ic">${A.ItemSprites && A.ItemSprites.spellIcon ? A.ItemSprites.spellIcon(s, { size: 36 }) : ''}</span>
        <div class="book-main">
          <div class="book-top"><b>${esc(s.name)}</b><span class="book-what num">${esc(whatItDoes(s))}</span></div>
          <div class="book-tags">${tags(p, s)}</div>
          <p class="book-desc">${esc(s.description || '')}${self ? ` ${esc(self)}` : ''}</p>
          ${fx ? `<p class="book-fx">${esc(fx.replace(' al pegar', ' al acertar'))}.</p>` : ''}
        </div>
      </div>`;
  }

  // ---------- v3.13: tu escuela o tu disciplina ----------
  const stateTxt = (st, fem) => {
    const who = fem ? 'tu maestra' : 'tu maestro';
    return ({ known: 'Lo tenés', learn: `Aprendelo con ${who}`, trial: `Pedile la prueba a ${who}`, doing: 'Prueba en curso', ready: `Volvé con ${who}: cumpliste la prueba` })[st] || '';
  };
  function regionName(id) { const r = id ? A.Data.getById('regions', id) : null; return r ? r.name : ''; }
  function schoolHtml(p) {
    const sc = A.Schools ? A.Schools.forPlayer(p) : null;
    if (!sc) return '';
    const rows = A.Schools.powers(p);
    const master = A.Schools.masterOf(p.raceId);
    const fem = !!(master && /^Maestra/.test(master.roleName || ''));
    return `
      <div class="book-school">
        <div class="book-school-head">${icon(sc.kind === 'discipline' ? 'swords' : 'book', 18)}<b>${sc.kind === 'discipline' ? 'Tu disciplina' : 'Tu escuela'}: ${esc(sc.name)}</b></div>
        <p class="book-school-about dim">${esc(sc.about)}</p>
        <div class="book-school-steps">
          ${rows.map((r) => `
            <div class="book-step is-${r.state}">
              <span class="book-step-rank">${r.rank === 1 ? 'Nacimiento' : `Nivel ${r.rank}`}</span>
              <b class="book-step-name">${esc(r.name)}</b>
              <span class="book-step-st">${r.state === 'known' ? icon('check', 12) : r.state === 'level' ? icon('lock', 12) : ''}${esc(r.state === 'level' ? `Se abre en el nivel ${r.rank}` : stateTxt(r.state, fem))}</span>
            </div>`).join('')}
        </div>
        ${master ? `<p class="book-school-where dim">${fem ? 'Tu maestra' : 'Tu maestro'}: ${esc(master.name)}, en ${esc(regionName(master.region))}.</p>` : ''}
      </div>`;
  }
  /** Las técnicas del guerrero (la de nacimiento y las de su disciplina que ya sabe). */
  function techRows(p) {
    const T = A.Techniques;
    if (!T) return '';
    const b = T.band(p);
    const list = [];
    const birth = T.of(p);
    if (birth) list.push({ t: birth, text: birth.text(b), tags: ['De nacimiento', 'Una vez por pelea'].concat(birth.free ? ['Pegás igual'] : []) });
    for (const t of T.known(p)) list.push({ t, text: t.text(b), tags: [`Escuela · nivel ${t.rank}`, `Espera ${t.cd} turnos`] });
    return list.map(({ t, text, tags }) => `
      <div class="book-row">
        <span class="book-ic">${icon(t.icon || 'swords', 36)}</span>
        <div class="book-main">
          <div class="book-top"><b>${esc(t.name)}</b><span class="book-what num">Sin maná</span></div>
          <div class="book-tags">${tags.map((x) => `<span class="book-tag ${/Escuela|nacimiento/.test(x) ? 'is-race' : ''}">${esc(x)}</span>`).join('')}</div>
          <p class="book-desc">${esc(text)}</p>
        </div>
      </div>`).join('');
  }

  function renderHtml() {
    const p = A.State.player;
    if (!p) return '';
    if (!p.hasMagic) {
      // v3.13: los guerreros ven sus técnicas y su disciplina
      if (A.Techniques && A.Techniques.of(p)) {
        return `
          <div class="book">
            ${schoolHtml(p)}
            <div class="book-list">${techRows(p)}</div>
            <p class="book-more dim">Las técnicas no gastan maná. En la pelea, el botón Técnicas (o el de tu técnica de nacimiento) las muestra con su espera.</p>
          </div>`;
      }
      return `
        <div class="empty-card">
          <div class="empty-icon">${icon('lock', 40)}</div>
          <div class="empty-title">Sin magia</div>
          <div class="empty-text muted">Tu raza no canaliza maná. Lo tuyo son las armas.</div>
        </div>`;
    }
    const known = (p.spells || []).map((id) => A.Data.getById('spells', id)).filter(Boolean);
    const regen = A.Balance && A.Balance.manaRegenOf ? A.Balance.manaRegenOf(p) : { turn: 0, win: 0 };
    const regenTxt = regen.turn > 0
      ? `En las peleas recuperás ${A.Balance.regenLabel(regen.turn)} de maná por turno${regen.turn % 1 ? ' (en promedio)' : ''} y ${Math.round(regen.win * 100)}% al ganar.`
      : 'Tu maná no vuelve solo en las peleas: pociones de maná o dormir.';
    const type = classOf(p);
    // v3.4: los magos aprenden todo; los híbridos, pocos
    const more = type === 'mage'
      ? 'Más hechizos: algunos habitantes los enseñan y todos los pergaminos de hechizo se pueden aprender (en la mochila, tocá el pergamino y "Aprender").'
      : 'Los híbridos aprenden pocos hechizos: Chispa, Llama, Rayo helado y Segundo aliento (con los maestros) y 6 pergaminos de combate: Misil arcano, Quemar, Ojo de halcón, Fuerza arcana, Piel de piedra y Furia salvaje. Todo lo demás es de magos.';
    const cast = A.Balance && A.Balance.canCast ? A.Balance.canCast(p) : { ok: true };
    return `
      <div class="book">
        <div class="book-mana">
          <span class="book-mana-num num">${icon('spell', 16)}${p.mana} / ${p.maxMana} de maná</span>
          <span class="book-mana-hint dim">${esc(regenTxt)}</span>
        </div>
        ${cast.ok ? '' : `<div class="class-note is-bad">${icon('lock', 14)}<span>${esc(cast.why)} Ponete uno desde la mochila.</span></div>`}
        ${schoolHtml(p)}
        ${known.length ? `<div class="book-list">${known.map((s) => spellRow(p, s)).join('')}</div>` : `
          <div class="empty-card">
            <div class="empty-icon">${icon('book', 40)}</div>
            <div class="empty-title">Todavía no conocés hechizos</div>
          </div>`}
        <p class="book-more dim">${esc(more)}</p>
      </div>`;
  }

  A.Views = A.Views || {};
  A.Views.Magic = {
    renderHtml,
    // mount() ya no se usa porque Magia no es una pestaña. Se deja por compatibilidad.
    mount(container) { container.innerHTML = renderHtml(); },
    unmount() {},
  };
})(window.Aventurs);
