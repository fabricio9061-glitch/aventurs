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
    if (s.damage) return `${s.damage} de daño${s.area ? ' a todos' : ''}${s.stun ? ' y lo deja sin turno' : ''}${s.drain ? ' (la mitad vuelve como vida)' : ''}`;
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
    if (s.racial) out.push('<span class="book-tag is-race">De tu raza</span>');
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

  function renderHtml() {
    const p = A.State.player;
    if (!p) return '';
    if (!p.hasMagic) {
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
