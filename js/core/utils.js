/* ============================================================
   Aventurs — Utils
   Namespace global y helpers puros (dice, clamp, uid, format)
   ============================================================ */

window.Aventurs = window.Aventurs || {};

(function (A) {
  'use strict';

  const Utils = {
    /**
     * Tira un dado de N caras. dice(20) -> 1..20
     */
    dice(sides) {
      return 1 + Math.floor(Math.random() * sides);
    },

    /**
     * Tira un dado con notación tipo "1d6+2", "2d8", "1d4-1".
     * Devuelve el total ya sumado/restado.
     */
    rollDice(notation) {
      const m = String(notation).match(/^(\d+)d(\d+)([+-]\d+)?$/i);
      if (!m) return 0;
      const count = parseInt(m[1], 10);
      const sides = parseInt(m[2], 10);
      const mod = m[3] ? parseInt(m[3], 10) : 0;
      let total = 0;
      for (let i = 0; i < count; i++) total += Utils.dice(sides);
      return total + mod;
    },

    /**
     * v1.6.7: Tira una expresión de daño compuesta tipo "1d3 + 1d4", "2d4 + 1d6 + 2", "1d8 + 3".
     * Permite sumar múltiples dados y modificadores planos.
     * Devuelve { total, components: [{ expr, rolled }, ...] }
     */
    rollDiceCompound(expression) {
      if (expression == null || expression === '') return { total: 0, components: [] };
      const expr = String(expression).replace(/\s+/g, '');
      // Split por + o - de alto nivel. Inserto separador antes de cada signo (excepto al inicio).
      // Ej: "1d3+1d4-2" -> ["1d3", "+1d4", "-2"]
      const parts = expr.split(/(?=[+-])/g).filter(Boolean);
      const components = [];
      let total = 0;
      for (const raw of parts) {
        if (!raw) continue;
        if (/d/i.test(raw)) {
          // Es un dado: NdM o NdM+K o NdM-K
          const m = raw.match(/^([+-]?)(\d*)d(\d+)([+-]\d+)?$/i);
          if (!m) continue;
          const sign = m[1] === '-' ? -1 : 1;
          const count = parseInt(m[2] || '1', 10);
          const sides = parseInt(m[3], 10);
          const innerMod = m[4] ? parseInt(m[4], 10) : 0;
          let rolled = 0;
          for (let i = 0; i < count; i++) rolled += Utils.dice(sides);
          rolled = (rolled + innerMod) * sign;
          components.push({ expr: raw, rolled });
          total += rolled;
        } else {
          // Modificador plano: +N o -N
          const v = parseInt(raw, 10);
          if (!isNaN(v)) {
            components.push({ expr: raw, rolled: v });
            total += v;
          }
        }
      }
      return { total, components };
    },

    /**
     * v1.6.7: Devuelve el rango (min, max) de una expresión compuesta sin tirar.
     */
    diceRange(expression) {
      if (!expression) return { min: 0, max: 0 };
      const expr = String(expression).replace(/\s+/g, '');
      const parts = expr.split(/(?=[+-])/g).filter(Boolean);
      let min = 0, max = 0;
      for (const raw of parts) {
        if (!raw) continue;
        if (/d/i.test(raw)) {
          const m = raw.match(/^([+-]?)(\d*)d(\d+)([+-]\d+)?$/i);
          if (!m) continue;
          const sign = m[1] === '-' ? -1 : 1;
          const count = parseInt(m[2] || '1', 10);
          const sides = parseInt(m[3], 10);
          const innerMod = m[4] ? parseInt(m[4], 10) : 0;
          const lo = (count * 1 + innerMod) * sign;
          const hi = (count * sides + innerMod) * sign;
          min += Math.min(lo, hi);
          max += Math.max(lo, hi);
        } else {
          const v = parseInt(raw, 10);
          if (!isNaN(v)) { min += v; max += v; }
        }
      }
      return { min, max };
    },

    clamp(n, min, max) {
      return Math.max(min, Math.min(max, n));
    },

    /**
     * ID único corto basado en timestamp + random.
     */
    uid(prefix = '') {
      const t = Date.now().toString(36);
      const r = Math.random().toString(36).slice(2, 7);
      return `${prefix}${prefix ? '_' : ''}${t}${r}`;
    },

    /**
     * Capitaliza solo la primera letra (sentence case).
     */
    capitalize(s) {
      if (!s) return '';
      return s.charAt(0).toUpperCase() + s.slice(1);
    },

    /**
     * Escapa HTML para inyectar texto seguro en innerHTML.
     */
    escapeHtml(s) {
      if (s == null) return '';
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    /**
     * Selecciona un elemento al azar de un array.
     */
    randomOf(arr) {
      if (!arr || !arr.length) return null;
      return arr[Math.floor(Math.random() * arr.length)];
    },

    /**
     * Elige una key con peso. weights = { a: 0.5, b: 0.3, c: 0.2 }
     */
    weightedPick(weights) {
      const entries = Object.entries(weights);
      const total = entries.reduce((s, [, w]) => s + w, 0);
      let r = Math.random() * total;
      for (const [k, w] of entries) {
        r -= w;
        if (r <= 0) return k;
      }
      return entries[entries.length - 1][0];
    },

    /**
     * Deep clone simple vía JSON (para objetos serializables).
     */
    clone(obj) {
      return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Formatea hora corta tipo "14:32".
     */
    formatTime(date = new Date()) {
      const h = String(date.getHours()).padStart(2, '0');
      const m = String(date.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    },
  };

  A.Utils = Utils;
})(window.Aventurs);
