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
├── js/
│   ├── core/
│   │   ├── utils.js        Dados, clamp, escapeHtml, etc.
│   │   ├── bus.js          Pub/sub global
│   │   ├── balance.js      TODAS las fórmulas de balance (v1.8.0)
│   │   ├── data.js         Loader de seeds + merge con overrides del editor
│   │   ├── state.js        Estado de partida + persistencia
│   │   ├── validate.js     Chequeos de coherencia (refs, regiones vacías, domables)
│   │   └── auto/
│   │       ├── autobalance.js    Sugerencias del editor (usa balance.js)
│   │       └── autoloot.js       Sugerencias de drops por familia/tags
│   ├── data/               Seeds: races, regions, enemies, items, weapons,
│   │                       armors, spells, recipes, npcs, bags
│   ├── systems/            Combat, Encounter, Travel, Tame (mascotas),
│   │                       Inventory, Currency, Crafting, NPC, Explore
│   ├── views/              Shell, Character, World, Map, Inventory, Magic,
│   │                       Chronicles, Combat, Modals, Editor
│   └── app.js              Bootstrap
└── tools/
    └── simulador.js        Simulador de balance (Node, no se carga en el juego)
```

## Correr local

```powershell
python -m http.server 8000
```

Abrir http://localhost:8000

## Simulador de balance

Carga el código real del juego y simula miles de combates:

```powershell
node tools/simulador.js            # informe completo
node tools/simulador.js razas      # razas parejas
node tools/simulador.js enemigos   # curva por tier
node tools/simulador.js mascota    # aporte de la mascota
node tools/simulador.js economia   # monedas, XP y precios
node tools/simulador.js viaje      # pasos y niveles del mapa
```

## Contenido del juego (seed)

- **9 razas** parejas: Humano, Elfo, Enano, Orco, Mediano, Gnomo, Alienígena, Robot, Dracónido
- **17 regiones** ordenadas por nivel (1 a 10)
- **78 enemigos** (24 domables) con tier, categoría, familia y tags
- **33 armas**, **13 armaduras**, **153 items**, **5 mochilas**
- **7 hechizos**, **19 recetas**, **4 NPCs**

## Reglas (v1.8.0)

**Combate** (igual para jugador, mascota y enemigos): D20 + ataque contra la defensa
del objetivo. 1 natural falla, 20 natural es crítico (daño x2). Daño = dados − armadura,
mínimo 1 si pega. Los hechizos no se esquivan y la armadura cuenta la mitad.
Efectos: sangrado, veneno y fuego dañan al empezar el turno; el frío baja defensa
y ataque; el choque puede hacer perder el turno.

**Razas**: mismo poder total repartido distinto. Guerreros (Enano, Orco, Robot) sin magia
y con más vida; híbridos y magos usan magia y arrancan sabiendo Chispa. Todos empiezan
con Daga y Túnica de cuero.

**Niveles**: nivel máximo 10, ~8-9 combates de tu tier por nivel. Cada región pide
un nivel mínimo.

**Mascota**: se doma con su comida si su tier es menor o igual a tu nivel (nunca jefes
ni criaturas inteligentes). Ataca a tu mismo objetivo, recibe 30% de los golpes,
gana la mitad de tu XP y come según su dieta. A 0 de vida queda inconsciente:
despierta con una poción o descansando.

**Viaje**: ida y vuelta tardan lo mismo (3 a 12 pasos según distancia, terreno, carga
y velocidad). Se come 1 cada 2 pasos.

**Economía**: monedas y precios crecen 45% por tier. Una arma de tu tier cuesta
~8-10 combates.

## Identidad visual

Light parchment cálido. Inter sans-serif weights 400 y 500. Sentence case en todos los textos. Stats numéricos con `font-variant-numeric: tabular-nums`. Bordes 0.5px. Estética "documento moderno" sobre paleta cálida, no "interfaz medieval".

## Idioma

Español latino (con "tú", no "vos"). Sin TODO MAYÚSCULAS.
