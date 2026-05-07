# Aventurs

RPG narrativo single-player en español latino, jugable en navegador.

**Stack:** HTML/CSS/JavaScript vanilla. Sin frameworks, sin bundlers, sin TypeScript.
**Persistencia:** localStorage (con export/import JSON desde el menú).
**Hosting:** GitHub Pages.

## Estructura

```
aventurs/
├── index.html
├── css/
│   ├── tokens.css          Variables visuales
│   ├── base.css            Reset + tipografía
│   ├── game.css            Estilos del juego (shell, sidebar, tabs, modales)
│   └── editor.css          Estilos del editor admin
└── js/
    ├── core/
    │   ├── utils.js        Dice, clamp, escapeHtml, etc.
    │   ├── bus.js          Pub/sub global con lista cerrada de eventos
    │   ├── data.js         Loader de seeds + merge con overrides del editor
    │   ├── state.js        Estado de partida + persistencia
    │   ├── validate.js     Chequeos de coherencia (refs, conexiones, etc.)
    │   └── auto/
    │       ├── autobalance.js    Sugerencia de stats por tier+category+family
    │       └── autoloot.js       LootIntelligence Modelo B (sugiere, admin acepta)
    ├── data/               Seeds: races, regions, enemies, items, weapons,
    │                       armors, spells, recipes, npcs, pets
    ├── systems/            Currency, Inventory, Travel (Fase 1)
    │                       Combat, Explore, Crafting, Spellbook, NPC (placeholders)
    ├── views/              Shell, Character, World, Inventory, Magic, Chronicles,
    │                       Combat, Modals, Editor
    └── app.js              Bootstrap
```

## Correr local

```powershell
python -m http.server 8000
```

Abrir http://localhost:8000

## Contenido del juego (seed)

- **9 razas**: Humano, Elfo, Enano, Orco, Mediano, Gnomo, Alienígena, Robot, Dracónido
- **17 regiones** con grafo de conexiones bidireccionales (T1-2 a T9-10)
- **78 enemigos** con 4 capas: tier, category, family[], tags[]
- **13 armas**, **8 armaduras**, **26 items** (consumibles, materiales, monedas)
- **7 hechizos**, **9 recetas de crafting**
- **4 NPCs**: Borgan (mercader), Maela (tabernera), Druss (herrero), Velrith (sabio)

## Estado actual

**Fase 1** — Creador de personaje, shell del juego, travel entre regiones, inventario funcional, editor admin completo.

Lo que funciona:
- Crear personaje (9 razas, stats balanceados)
- Viajar entre las 17 regiones
- Sidebar con stats, equipamiento y monedas
- Inventario: equipar, usar consumibles, tirar items
- Editor admin: editar/crear/duplicar/eliminar todo el contenido
- AutoBalance y AutoLoot integrados al editor
- Crónicas de actividad
- Export/Import JSON desde menú

Lo que viene en próximas fases:
- **Fase 2**: Combate por turnos, encuentros, loot real
- **Fase 3**: Tienda funcional (NPCs), aprender hechizos, crafting
- **Fase 4**: Encuentros aleatorios al viajar, exploración profunda
- **Fase 5**: Mascotas y domesticación

## Identidad visual

Light parchment cálido. Inter sans-serif weights 400 y 500. Sentence case en todos los textos. Stats numéricos con `font-variant-numeric: tabular-nums`. Bordes 0.5px. Estética "documento moderno" sobre paleta cálida, no "interfaz medieval".

## Idioma

Español latino (con "tú", no "vos"). Sin TODO MAYÚSCULAS.
