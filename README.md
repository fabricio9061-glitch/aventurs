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
│   ├── editor.css          Estilos del editor admin
│   └── theme.css           Tema "Mezcla" (v1.9.0): se carga último y pisa lo anterior
├── js/
│   ├── core/
│   │   ├── utils.js        Dados, clamp, escapeHtml, etc.
│   │   ├── bus.js          Pub/sub global
│   │   ├── balance.js      TODAS las fórmulas de balance (v1.8.0)
│   │   ├── sprites.js      Dibujos pixel art 32×32 de criaturas y personajes (v1.9.0)
│   │   ├── item-sprites.js Dibujos pixel art 32×32 de ítems e íconos de interfaz (v1.9.1)
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
│   │                       combat-fx.js: dado D20 y animaciones de combate
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

- **12 razas** parejas, cada una con su pasiva (ver *Razas y pasivas*)
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

**Razas**: mismo poder total repartido distinto (stats + pasiva). Guerreros sin magia
y con más vida; híbridos y magos usan magia y arrancan sabiendo Chispa. Todos empiezan
con Daga y Túnica de cuero.

**Dificultad del dado**: cada criatura muestra un D20 con su número: es lo que tiene
que llegar tu tirada (D20 + tu ataque) para pegarle. El botón *Atacar* dice cuánto
tenés que sacar ("Necesitás 7 o más").

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

## Identidad visual (v1.9.0)

Estilo **"Mezcla"**: fondo oscuro de taberna, tarjetas de pergamino con tinta oscura,
dorado envejecido para lo importante. Títulos en Cinzel, texto en Inter. Los tokens
viven en `css/tokens.css`; las zonas oscuras (cabecera, arena de combate) los redefinen
en `css/theme.css`.

**Sprites**: todo se dibuja con código en 32×32 (sin imágenes externas):
- 78 enemigos, cada uno con su forma (bestia, ave, humanoide, dragón, hidra, gólem…)
- 12 razas jugables (el personaje muestra el arma que tiene equipada)
- las mascotas usan el dibujo de su especie mirando hacia el otro lado
- 204 ítems (armas, armaduras, pociones, comida, materiales, gemas, llaves, mochilas)

Un enemigo o ítem nuevo del editor recibe dibujo automático (por familia/tags o por
palabras del nombre). En el editor de enemigos, la sección *Apariencia* permite copiar
la forma de otra criatura y cambiar colores.

**Combate**: el D20 rueda en el centro de la arena y cae en el número real (dorado en
crítico, gris en pifia), el atacante se lanza hacia adelante, el golpeado tiembla,
aparecen números de daño y la vida baja con estela. Si tocás *Atacar* durante el turno
de otro, el ataque queda en cola y sale apenas sea tu turno.

## Razas y pasivas (v1.9.2)

| Tipo | Raza | Pasiva |
|---|---|---|
| Híbrido | Humano | **Determinación**: una vez por combate, un golpe que te iba a voltear te deja con 1 de vida |
| Híbrido | Elfo | **Ojo certero**: crítico con 19 o 20 |
| Híbrido | Mediano | **Suerte**: un 1 en el dado se vuelve a tirar (atacar y huir) |
| Híbrido | Dracónido | **Sangre de dragón**: 1 de cada 4 golpes prende fuego; el fuego no lo afecta |
| Guerrero | Enano | **Piel de roca**: el primer golpe de cada combate hace la mitad |
| Guerrero | Orco | **Furia**: con media vida o menos, +2 de daño (+3 desde nivel 5) |
| Guerrero | Robot | **Cuerpo de metal**: inmune al veneno y al sangrado |
| Guerrero | Goliat | **Golpe de gigante**: los críticos hacen el triple |
| Mago | Gnomo | **Ingenio**: los hechizos cuestan menos maná |
| Mago | Alienígena | **Mente expansiva**: +1 de maná cada dos turnos |
| Mago | Infernal | **Llama interior**: los hechizos de daño hacen más (crece con el nivel) |
| Mago | Ángel | **Bendición**: al quedar con media vida, una luz lo cura (una vez por combate) |

Las reglas viven en `js/systems/passives.js`. El balance se mide con
`node tools/simulador.js razas` (la IA del simulador elige lo que más daño hace:
arma o hechizo).

## Combate (v1.9.1)

- **Tarjetas fijas**: todas las tarjetas miden lo mismo y tienen las mismas filas
  (nombre, vida, barra fina de maná o saciedad, ataque/defensa/daño/armadura). Los
  efectos (veneno, fuego…) van como íconos sobre el dibujo, así nunca agrandan la tarjeta.
- **Narrador** (`js/systems/narrator.js`): cada acción se cuenta con una frase
  ("El lobo se lanza y te muerde: 5 de daño."), distinta según el arma, la criatura y
  el resultado. Aparece cuando cae el dado; hasta entonces no se adelanta ni la vida
  ni el relato.
- **Crónica en prosa**: con *Ver tiradas* se ven los dados y las cuentas.
- **Sin emojis en el combate**: íconos pixelados (`A.ItemSprites.icon`) y sprites.
- La pantalla de victoria muestra la experiencia, las monedas y el botín con sus dibujos.

## Idioma

Español latino (con "tú", no "vos"). Sin TODO MAYÚSCULAS.
