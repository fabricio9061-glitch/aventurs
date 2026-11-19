/* ============================================================
   Aventurs — UI Kit (v2.0)
   Piezas chicas que comparten las pantallas nuevas:
   íconos pixel, fichas de premio, precios con monedas, retratos,
   marcas de misión y tiradas. Todo sin emojis.
   ============================================================ */

(function (A) {
  'use strict';

  function esc(s) { return A.Utils.escapeHtml(String(s == null ? '' : s)); }

  function icon(name, size, cls) {
    return A.ItemSprites ? A.ItemSprites.icon(name, { size: size || 20, cls }) : '';
  }

  function itemData(id) {
    return A.Inventory && A.Inventory.resolveData ? A.Inventory.resolveData(id) : A.Data.getById('items', id);
  }

  function itemSprite(itemOrId, size) {
    const it = typeof itemOrId === 'string' ? itemData(itemOrId) : itemOrId;
    if (!it) return icon('bag', size);
    return A.ItemSprites ? A.ItemSprites.html(it, { size: size || 32 }) : '';
  }

  function price(copper, size) {
    return A.Currency && A.Currency.priceHtml ? A.Currency.priceHtml(copper, size || 16) : `${copper} cobre`;
  }

  /** Ficha de premio o castigo (+12 cobre, +1 Hierba, -5 vida...). */
  function chip(c) {
    const it = c.itemId ? itemData(c.itemId) : null;
    switch (c.kind) {
      case 'coins':
        return c.value > 0
          ? `<span class="ui-chip is-good">${price(c.value, 14)}</span>`
          : `<span class="ui-chip is-bad">-${price(-c.value, 14)}</span>`;
      case 'item':
        return `<span class="ui-chip is-good">${itemSprite(it, 22)}<span>${esc(it ? it.name : c.itemId)}${c.value > 1 ? ` ×${c.value}` : ''}</span></span>`;
      case 'used':
        return `<span class="ui-chip is-bad">${itemSprite(it, 22)}<span>-${esc(it ? it.name : c.itemId)}${c.value > 1 ? ` ×${c.value}` : ''}</span></span>`;
      case 'full':
        return `<span class="ui-chip is-bad">${icon('bag', 18)}<span>${esc(it ? it.name : 'Algo')} no entró en la mochila</span></span>`;
      case 'heal': return `<span class="ui-chip is-good">${icon('heart', 18)}<span>+${c.value} vida</span></span>`;
      case 'hurt': return `<span class="ui-chip is-bad">${icon('heart', 18, 'is-hurt')}<span>-${c.value} vida</span></span>`;
      case 'mana': return `<span class="ui-chip is-mana">${icon('spell', 18)}<span>+${c.value} maná</span></span>`;
      case 'food': return `<span class="ui-chip ${c.value > 0 ? 'is-good' : 'is-bad'}">${icon('food', 18)}<span>${c.value > 0 ? '+' : ''}${c.value} comida</span></span>`;
      case 'xp': return `<span class="ui-chip is-gold">${icon('xp', 18)}<span>+${c.value} XP</span></span>`;
      case 'level': return `<span class="ui-chip is-gold">${icon('up', 18)}<span>¡Nivel ${c.value}!</span></span>`;
      case 'time': return `<span class="ui-chip">${icon('hourglass', 18)}<span>Pasó el tiempo</span></span>`;
      case 'pet': return `<span class="ui-chip is-good">${icon('paw', 18)}<span>+${c.value} vida (mascota)</span></span>`;
      default: return '';
    }
  }

  function chips(list) {
    const html = (list || []).map(chip).join('');
    return html ? `<div class="ui-chips">${html}</div>` : '';
  }

  /** Retrato de un habitante en pixel art, con su marca de misión. */
  function portrait(npc, size, marker) {
    const img = A.Sprites && A.Sprites.npcHtml ? A.Sprites.npcHtml(npc, { size: size || 48 }) : '';
    return `<span class="ui-portrait" style="--pt:${size || 48}px">${img}${marker ? questMark(marker) : ''}</span>`;
  }

  /** "!" dorado = tiene una misión para vos; "?" = esperando que vuelvas. */
  function questMark(kind) {
    if (!kind) return '';
    const name = kind === 'offer' ? 'quest' : 'question';
    const title = kind === 'offer' ? 'Tiene una misión para vos' : kind === 'ready' ? 'Misión lista para entregar' : 'Quiere hablar con vos';
    return `<span class="ui-qmark is-${kind}" title="${title}">${icon(name, 18)}</span>`;
  }

  /** Línea de una tirada: [ícono] Fuerza +3 · [D20 12] · 60% */
  function checkLine(check, tier, bonus) {
    if (!check || !A.Explore) return '';
    const st = A.Explore.STATS[check.stat] || { label: check.stat, icon: 'd20' };
    // v3.1: las de carrera comparan con la criatura; observar antes suma
    const mod = A.Explore.statMod(check.stat, undefined, check) + (bonus || 0);
    const dc = A.Explore.dcFor(check, tier);
    const pct = Math.round(A.Explore.chanceOf(check, tier, undefined, bonus) * 100);
    const cls = pct >= 65 ? 'is-easy' : pct >= 40 ? 'is-mid' : 'is-hard';
    const dcB = A.ItemSprites && A.ItemSprites.dcBadge ? A.ItemSprites.dcBadge(dc, { size: 24, title: `Dificultad: el D20 más tu bonus tiene que llegar a ${dc}` }) : `DC ${dc}`;
    return `<span class="ui-check ${cls}" title="${esc(st.hint || '')}">${icon(st.icon, 16, 'px-soft')}<span>${esc(st.label)} ${mod >= 0 ? '+' : ''}${mod}</span>${dcB}<b>${pct}%</b></span>`;
  }

  function biomeIcon(region, size) {
    const b = region && region.biome ? region.biome : 'plains';
    return icon(`biome-${b}`, size || 32) || icon('map', size || 32);
  }

  A.UI = { esc, icon, itemData, itemSprite, price, chip, chips, portrait, questMark, checkLine, biomeIcon };
})(window.Aventurs);
