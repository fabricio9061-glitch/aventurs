/* ============================================================
   Aventurs — TagInput v1 (autocompletado con sugerencias)
   v1.5.7k

   Componente que reemplaza inputs CSV crudos por un editor
   interactivo: tags coloreados arriba, input con autocomplete debajo.

   Uso:
     A.TagInput.create({
       container: HTMLElement,        // donde montar
       value: ['id1','id2'],          // ids actuales
       collection: 'items',           // qué buscar (items|enemies|regions|spells)
       placeholder: 'Buscar...',      // placeholder del input
       allowDuplicates: false,
       maxTags: null,
       filter: (entity) => true,      // filtrar opciones (ej: solo items con subtype X)
       onChange: (newValue) => {},    // se llama cuando se modifica el array
     });

   Los tags se renderizan con: icono + nombre + botón de quitar.
   El autocompletado matchea por id O nombre (case-insensitive).
   ============================================================ */

(function (A) {
  'use strict';

  let counter = 0;

  function normalize(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function create(opts) {
    const {
      container,
      value = [],
      collection,
      placeholder = 'Buscar...',
      allowDuplicates = false,
      maxTags = null,
      filter = null,
      onChange = () => {},
    } = opts;

    if (!container) return null;

    const id = `tag-input-${++counter}`;
    let currentValue = [...value];
    let highlightedIdx = 0;
    let suggestions = [];

    container.classList.add('tag-input-host');
    container.innerHTML = `
      <div class="tag-input-tags" id="${id}-tags"></div>
      <div class="tag-input-search">
        <input
          type="text"
          class="form-input tag-input-search-input"
          id="${id}-input"
          placeholder="${A.Utils.escapeHtml(placeholder)}"
          autocomplete="off"
        >
        <div class="tag-input-suggestions" id="${id}-sug" style="display:none"></div>
      </div>
    `;

    const tagsEl = container.querySelector(`#${id}-tags`);
    const inputEl = container.querySelector(`#${id}-input`);
    const sugEl = container.querySelector(`#${id}-sug`);

    function renderTags() {
      const items = currentValue.map((entityId, i) => {
        const entity = A.Data.getById(collection, entityId);
        if (!entity) {
          // Tag para id que ya no existe (entidad borrada)
          return `
            <span class="tag-input-tag is-orphan" data-tag-index="${i}">
              <span class="tag-input-tag-icon">⚠️</span>
              <span class="tag-input-tag-name">${A.Utils.escapeHtml(entityId)}</span>
              <button class="tag-input-tag-remove" data-tag-remove="${i}" type="button" title="Quitar">×</button>
            </span>
          `;
        }
        const icon = entity.icon || '•';
        const name = entity.name || entity.id;
        return `
          <span class="tag-input-tag" data-tag-index="${i}" title="${A.Utils.escapeHtml(entityId)}">
            <span class="tag-input-tag-icon">${icon}</span>
            <span class="tag-input-tag-name">${A.Utils.escapeHtml(name)}</span>
            <button class="tag-input-tag-remove" data-tag-remove="${i}" type="button" title="Quitar">×</button>
          </span>
        `;
      }).join('');
      tagsEl.innerHTML = items || '<span class="tag-input-empty dim small">Sin elementos. Empezá a escribir abajo para agregar.</span>';

      tagsEl.querySelectorAll('[data-tag-remove]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.tagRemove);
          currentValue.splice(idx, 1);
          renderTags();
          onChange([...currentValue]);
        });
      });
    }

    function getSuggestions(query) {
      const all = (A.Data[collection] || []);
      const q = normalize(query);
      const filtered = all.filter((entity) => {
        if (filter && !filter(entity)) return false;
        if (!allowDuplicates && currentValue.includes(entity.id)) return false;
        if (!q) return true;
        return normalize(entity.id).includes(q) || normalize(entity.name).includes(q);
      });
      // Priorizar matches que empiecen con la query
      filtered.sort((a, b) => {
        const aStart = normalize(a.name).startsWith(q) || normalize(a.id).startsWith(q);
        const bStart = normalize(b.name).startsWith(q) || normalize(b.id).startsWith(q);
        if (aStart && !bStart) return -1;
        if (!aStart && bStart) return 1;
        return (a.name || a.id).localeCompare(b.name || b.id);
      });
      return filtered.slice(0, 12);
    }

    function renderSuggestions() {
      if (suggestions.length === 0) {
        sugEl.style.display = 'none';
        sugEl.innerHTML = '';
        return;
      }
      sugEl.style.display = 'block';
      sugEl.innerHTML = suggestions.map((entity, i) => {
        const icon = entity.icon || '•';
        const name = entity.name || entity.id;
        const cls = i === highlightedIdx ? 'is-highlighted' : '';
        return `
          <button class="tag-input-suggestion ${cls}" type="button" data-sug-id="${A.Utils.escapeHtml(entity.id)}" data-sug-idx="${i}">
            <span class="tag-input-sug-icon">${icon}</span>
            <span class="tag-input-sug-name">${A.Utils.escapeHtml(name)}</span>
            <span class="tag-input-sug-id dim">${A.Utils.escapeHtml(entity.id)}</span>
          </button>
        `;
      }).join('');

      sugEl.querySelectorAll('[data-sug-id]').forEach((btn) => {
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault(); // Evita perder el foco del input
        });
        btn.addEventListener('click', () => {
          addTag(btn.dataset.sugId);
        });
        btn.addEventListener('mouseenter', () => {
          highlightedIdx = Number(btn.dataset.sugIdx);
          updateHighlight();
        });
      });
    }

    function updateHighlight() {
      sugEl.querySelectorAll('.tag-input-suggestion').forEach((el, i) => {
        el.classList.toggle('is-highlighted', i === highlightedIdx);
      });
    }

    function addTag(entityId) {
      if (!entityId) return;
      if (!allowDuplicates && currentValue.includes(entityId)) return;
      if (maxTags && currentValue.length >= maxTags) return;
      currentValue.push(entityId);
      inputEl.value = '';
      suggestions = [];
      renderSuggestions();
      renderTags();
      onChange([...currentValue]);
      inputEl.focus();
    }

    function refreshSuggestions() {
      suggestions = getSuggestions(inputEl.value);
      highlightedIdx = 0;
      renderSuggestions();
    }

    inputEl.addEventListener('input', refreshSuggestions);
    inputEl.addEventListener('focus', () => {
      refreshSuggestions();
    });
    inputEl.addEventListener('blur', () => {
      // Delay para permitir click en sugerencia
      setTimeout(() => {
        sugEl.style.display = 'none';
      }, 150);
    });
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (suggestions.length === 0) refreshSuggestions();
        highlightedIdx = Math.min(suggestions.length - 1, highlightedIdx + 1);
        updateHighlight();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightedIdx = Math.max(0, highlightedIdx - 1);
        updateHighlight();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (suggestions[highlightedIdx]) {
          addTag(suggestions[highlightedIdx].id);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        suggestions = [];
        renderSuggestions();
        inputEl.blur();
      } else if (e.key === 'Backspace' && !inputEl.value && currentValue.length > 0) {
        // Backspace en input vacío quita el último tag
        currentValue.pop();
        renderTags();
        onChange([...currentValue]);
      }
    });

    renderTags();

    return {
      getValue: () => [...currentValue],
      setValue: (newValue) => {
        currentValue = [...newValue];
        renderTags();
      },
      destroy: () => { container.innerHTML = ''; },
    };
  }

  A.TagInput = { create };
})(window.Aventurs);
