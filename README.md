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
│   ├── theme.css           Tema "Mezcla" (v1.9.0)
│   └── v2.css              Pantallas de la v2.0 (escenas, tienda, diario, mapa): va última
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
│   │                       armors, spells, recipes, npcs, bags,
│   │                       events (escenas al explorar), quests (misiones)
│   ├── systems/            Combat, Encounter, Travel, Tame (mascotas),
│   │                       Inventory, Currency, Crafting, NPC,
│   │                       Explore (escenas y descanso), Quests (misiones)
│   ├── views/              Shell, Character, World, Map, Inventory, Magic,
│   │                       Chronicles, Combat, Modals, Editor
│   │                       combat-fx.js: dado D20 y animaciones de combate
│   │                       ui-kit.js, event.js, npc.js, journal.js (v2.0)
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

- **12 razas** parejas, cada una con su pasiva (ver *Razas y pasivas*); las 8 que usan
  magia nacen con su propio hechizo
- **31 regiones** (24 de combate y 7 pueblos) ordenadas por nivel (1 a 10)
- **104 enemigos** (29 domables), cada uno con su zona propia: 4 a 7 criaturas por zona
- **35 armas**, **13 armaduras**, **159 items**, **5 mochilas**
- **15 hechizos** (8 de nacimiento), **19 recetas**, **13 habitantes**
- **22 misiones** (8 de la historia principal) y **43 escenas** para explorar

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

## Versión 2.0

### Explorar
Explorar siempre hace pasar algo (`js/systems/explore.js` + `js/data/seed-events.js`):
- **Criaturas**: aparecen y elegís cómo encararlas. El ataque por sorpresa depende de
  tu clase (guerrero: *Cargar* con Fuerza; mago: *Hechizo desde las sombras* con
  Ingenio; híbrido: *Atacar por sorpresa* con Agilidad). Si sale bien, actuás primero;
  si te escabullís mal, te atacan primero. Si es domable y estás solo, podés acercarte.
- **Escenas del bioma** (30): cofres, viajeros heridos, panales, ríos de lava... con
  2 o 3 opciones. Cada opción muestra su tirada y el % de éxito antes de elegir.
- **Tiradas**: D20 + bonus contra una dificultad que sube con la zona.
  Fuerza (guerreros +3), Agilidad (velocidad), Ingenio (magos +3), Puntería
  (precisión), Suerte (el Mediano +3). Todos suman la mitad de su nivel.
- **Descansar**: de día, un rato (+20%) y pasa la tarde; de noche, dormís hasta la
  mañana (50% al raso, 75% en zona segura). Al raso, 1 de cada 4 noches algo se acerca.

### Misiones (`js/systems/quests.js` + `js/data/seed-quests.js`)
- **Historia principal** "La sombra del dragón" (8 capítulos): empieza con Tomas el
  guardia del Pueblo Inicial y termina en el Nido de Dragones.
- **Encargos**: dientes de lobo (Borgan), ratas (Maela), esqueletos (Tomas),
  bandidos y perlas (Irena, capitana del Puerto), hierro (Druss), polvo arcano (Velrith).
- Signo de exclamación dorado = tiene una misión; signo de pregunta = te espera para cobrar.
- Objetivos: derrotar, juntar y entregar, tener, explorar, llegar, hablar.

### Clases
- **Guerreros**: maestría con armas (+1 daño, +2 desde nivel 5, +3 desde nivel 9) y +1
  al ataque con armas pesadas.
- **Magos**: poder mágico 1 + nivel/2 (+ bastón), +5 de maná por nivel. Armas pesadas
  -3 al ataque; medianas no mágicas -1.
- **Híbridos**: sin penalidad con armas; poder mágico (nivel-1)/2, +3 de maná por nivel.

### Monedas y tienda
- Cada enemigo suelta monedas siempre, según su tier y categoría
  (`Balance.Economy.coinsFor`).
- Tienda nueva: objetos dibujados, detalle con comparación contra lo que tenés puesto
  (mejor / peor / parecido) y venta a mitad de precio. Pestañas: Hablar, Comprar,
  Vender, Aprender, Forjar, Posada (solo las que tiene cada habitante).

### Pantallas
- Mapa del reino en pergamino: posiciones fijas (`pos` y `labelAt` en las regiones),
  caminos curvos, niebla en lo que no conocés, candado y nivel en lo bloqueado, ficha
  de la zona con "Viajar". Rueda o botones para el zoom; arrastrar para mover.
- Diario de viaje: misiones y crónicas agrupadas por día y lugar (las líneas repetidas
  se cuentan con ×N).
- En el celular, una franja arriba con vida, maná, comida y dinero.
- Sin emojis en el juego (el editor todavía los usa para cargar íconos).

## Versión 2.1

### Subir de nivel
- Experiencia por nivel (`Progression.XP_TABLE`): 45 · 100 · 250 · 390 · 580 · 820 ·
  1240 · 1800 · 1950. Del nivel 1 al 2 son unas 4 o 5 peleas; más adelante, unas 8.
- Los encuentros miran tu nivel (`js/systems/encounter.js`): las criaturas de tier más
  alto que vos aparecen menos y vienen solas, hay como mucho un enemigo fuerte por
  grupo y los grupos son más chicos mientras estés por debajo del nivel de la zona.
- Las criaturas que pide una misión de "derrotar" aparecen mucho más seguido.

### Mundo
- **31 regiones**. Nuevas zonas de combate: Llanos del Alba, Minas Olvidadas, Colinas
  Rotas, Costa de los Naufragios, Mar de las Calaveras, Bosque de los Sueños, Ruinas de
  la Antorcha, Bosque de los Susurros, Pradera de los Cíclopes y Jardín Carmesí.
- **Pueblos nuevos**: Aldea Piedrahonda (enanos), Puerto Calavera (piratas), Santuario
  del Roble (druida, enseña magia) y Velmora (la ciudad de los vampiros).
- **Cada criatura tiene su lugar**: los 104 enemigos están repartidos por zona (4 a 7
  por zona), con 26 nuevos: piratas, criaturas del sueño, vampiros, huargos, centauros...
- 7 encargos nuevos y 13 escenas nuevas para explorar.

### Clases y maná
- **Guerreros**: sin magia; maestría con armas (+1 de daño, +2 desde nivel 5, +3 desde
  nivel 9) y +1 de precisión con armas pesadas. +6 de vida por nivel.
- **Magos** (Gnomo, Alienígena, Infernal, Ángel): el maná les vuelve solo, en cada turno
  (desde la segunda ronda) y al ganar. Cada raza recupera distinto (`manaRegen` en la
  raza): Gnomo 1 por turno, Alienígena 2 (Mente expansiva), Infernal 1, Ángel 1. Poder
  mágico nivel/2 (+ bastón). Son frágiles: +4 de vida y +4 de maná por nivel. Las armas
  pesadas les quitan 3 de precisión; las medianas no mágicas, 1.
- **Híbridos**: usan cualquier arma y algo de magia, pero el maná no les vuelve solo
  (pociones o dormir). Poder mágico (nivel-1)/2. +6 de vida y +3 de maná por nivel.
- **Hechizo de nacimiento** (`startSpell` en la raza, `racial` en el hechizo): Dardo
  arcano (Humano), Flecha lunar (Elfo), Dardo venenoso (Mediano), Aliento de brasas
  (Dracónido), Descarga (Gnomo), Rayo de plasma (Alienígena), Ascua infernal
  (Infernal) y Luz sagrada (Ángel). No se venden ni se enseñan.
- Los hechizos de curación suman solo la mitad del poder mágico.

### Números claros
- "Ataque" ahora se llama **Precisión**: lo que se suma al dado de 20 para acertar.
  El **Daño** es la vida que sacás cuando acertás. La **Defensa** es lo que el enemigo
  tiene que sacar para pegarte. La **Armadura** se resta de cada golpe.
- En la creación, cada número tiene una línea que dice para qué sirve.
- En combate, el botón de atacar muestra el % de acierto, qué número necesitás y
  cuánto daño hacés; la línea de turno lo explica con el enemigo marcado.
- En las reglas hay una sección "Tus números" (también desde la barra lateral).

### Pantallas
- Barra lateral nueva: retrato con nivel, experiencia, vida, maná y comida, atributos
  con íconos, equipo, mochila con monedas, misiones en curso y lugar.
- Creación: el botón de empezar queda siempre a la vista.

## Idioma

Español rioplatense (con "vos"). Sin TODO MAYÚSCULAS.
