# Aventurs

RPG narrativo en español latino, jugable en navegador. Se juega solo o en grupo de hasta 4 (v3.2).

**Stack:** HTML/CSS/JavaScript vanilla. Sin frameworks, sin bundlers, sin TypeScript.
**Persistencia:** localStorage, una partida por cuenta (con export/import JSON desde el menú).
**Jugar en grupo (hasta 4):** conexión directa entre navegadores con PeerJS (`js/vendor/peerjs.min.js`), sin servidor propio.
**Hosting:** GitHub Pages.

## Estructura

```
aventurs/
├── index.html
├── css/
│   ├── tokens.css          Variables visuales
│   ├── base.css            Reset + tipografía
│   ├── game.css            Estilos del juego (shell, sidebar, tabs, modales)
│   ├── theme.css           Tema "Mezcla" (v1.9.0)
│   ├── v2.css              Pantallas de la v2.0 (escenas, tienda, diario, mapa)
│   ├── v3.css              Grupo, cuentas y pantalla de creación de la v3.0
│   └── editor2.css         Editor del mundo (v2.2)
├── js/
│   ├── core/
│   │   ├── utils.js        Dados, clamp, escapeHtml, etc.
│   │   ├── bus.js          Pub/sub global
│   │   ├── balance.js      TODAS las fórmulas de balance (v1.8.0)
│   │   ├── sprites.js      Dibujos pixel art 32×32 de criaturas y personajes (v1.9.0)
│   │   ├── item-sprites.js Dibujos pixel art 32×32 de ítems e íconos de interfaz (v1.9.1)
│   │   ├── data.js         Loader de seeds + cambios del editor (parches por id)
│   │   ├── accounts.js     Cuentas de esta compu: usuario, contraseña, dueño (v3.0)
│   │   ├── state.js        Estado de partida + persistencia (una por cuenta; withHero para el grupo)
│   │   ├── survival.js     Comida y hambre; lo que come cada raza (v3.1)
│   │   ├── voice.js        Voz del narrador (v3.1)
│   │   └── validate.js     Chequeos de coherencia (refs, regiones vacías, misiones, escenas)
│   ├── data/               Seeds: races, regions, enemies, items, weapons,
│   │                       armors, spells, recipes, npcs, bags,
│   │                       events (escenas al explorar), quests (misiones),
│   │                       extra (lo de "RPG Plugins": equipo, accesorios,
│   │                       pergaminos, pociones y comidas; v2.4),
│   │                       skills (qué habilidades tiene cada criatura; v2.5)
│   ├── systems/            Combat, Encounter, Travel, Tame (mascotas),
│   │                       Inventory, Currency, Crafting, NPC,
│   │                       Explore (escenas y descanso), Quests (misiones),
│   │                       Accessories (accesorio puesto), ItemFx (pociones,
│   │                       comidas y pergaminos, mejoras por turnos) (v2.4),
│   │                       Skills (pasivas y activas de las criaturas),
│   │                       Spellbook (quién aprende cada hechizo) (v2.5),
│   │                       Persp (lo del compañero, en tercera persona) (v3.0),
│   │                       Bestiary (las criaturas que descubriste) (v3.1)
│   ├── net/                link.js (conexión con código) y party.js (el grupo) (v3.0)
│   ├── vendor/             peerjs.min.js (PeerJS 1.5.5, licencia MIT)
│   ├── editor/             Editor del mundo (v2.2): ed-core (guardado por parches),
│   │                       ed-fields (campos), ed-schema (qué se edita de cada cosa),
│   │                       ed-panels, ed-sim (prueba de combate), ed-map, ed-view
│   ├── views/              Shell, Character, World, Map, Inventory, Magic,
│   │                       Chronicles, Combat, Modals
│   │                       combat-fx.js: dado D20 y animaciones de combate
│   │                       ui-kit.js, event.js, npc.js, journal.js (v2.0)
│   │                       party.js (panel del grupo), login.js (cuentas) (v3.0)
│   └── app.js              Bootstrap
└── tools/
    ├── simulador.js        Simulador de balance (Node, no se carga en el juego)
    └── equilibrio.js       Pruebas de equilibrio entre razas y clases, con semillas fijas (v3.1)
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

Pruebas de equilibrio (v3.1): seis pruebas por raza (1 contra 1, rachas en los niveles 1, 3, 6 y 10 y
peleas contra parejas), con semillas fijas para comparar antes y después de un cambio:

```powershell
node tools/equilibrio.js                        # las 18 razas (unos minutos)
node tools/equilibrio.js --rapido               # la cuarta parte de las rachas
node tools/equilibrio.js --razas=robot,enano    # solo esas razas
node tools/equilibrio.js --guardar=antes.json   # guarda los resultados
node tools/equilibrio.js --comparar=antes.json  # muestra cuánto cambió cada número
```

## Contenido del juego (seed)

- **18 razas** parejas, cada una con su pasiva y su arma (ver *Razas y pasivas*); las 12 que usan
  magia nacen con su propio hechizo
- **31 regiones** (24 de combate y 7 pueblos) ordenadas por nivel (1 a 10)
- **104 enemigos** (29 domables), cada uno con su zona propia: 4 a 7 criaturas por zona
- **80 armas**, **44 armaduras**, **278 objetos** (22 accesorios, 51 pergaminos,
  20 pociones, 53 comidas), **5 mochilas**; todo con rareza (común a legendario)
- **44 hechizos** (12 de nacimiento, 24 que se aprenden de pergaminos), **25 recetas**, **13 habitantes**
- **47 misiones** (18 de la historia principal) y **86 escenas** para explorar (12 solo para grupos)

## Reglas (v1.8.0)

**Combate** (igual para jugador, mascota y enemigos): D20 + ataque contra la defensa
del objetivo. 1 natural falla, 20 natural es crítico (daño x2). Daño = dados − armadura,
mínimo 1 si pega. Contra los hechizos la armadura cuenta la mitad (v3.3: los de daño tiran
el dado con +2 y pueden fallar; los fuertes tienen espera).
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
palabras del nombre). En el editor de criaturas, la sección *Apariencia* permite copiar
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
- Sin emojis en el juego (desde la v2.2, tampoco en el editor).

## Versión 3.6.0: todas las razas con el mismo poder

### Los números de cada raza (`js/data/seed-races.js`)
- Cada raza tiene lo de su clase (`CLASS_BASE`) más **exactamente 3 puntos de raza**. Cuesta 1 punto: +2 de vida, +2 de maná, +1 de velocidad, +1 de precisión o +1 de esquiva; 2 puntos: +1 de armadura o +1 de daño. Bajar algo devuelve puntos.
- Al explorar, **todas suman 5 puntos** entre Fuerza, Agilidad, Ingenio, Puntería y Suerte (`explore` en cada raza), repartidos según la raza. La armadura pesada baja la Agilidad. La pantalla de crear personaje lo dice ("5 puntos, como todas las razas").
- Las clases siguen siendo distintas a propósito (el guerrero tiene más vida, el mago más maná y menos vida), pero dentro de cada clase todas suman lo mismo.

| Raza | Clase | Vida | Maná | Velocidad | Fuerza / Agilidad / Ingenio / Puntería / Suerte |
|---|---|---|---|---|---|
| Humano | Híbrido | 26 | 12 | 12 | 1 / 1 / 1 / 1 / 1 |
| Elfo | Híbrido | 24 | 14 | 12 | 0 / 2 / 1 / 2 / 0 |
| Mediano | Híbrido | 24 | 12 | 13 | 0 / 1 / 0 / 1 / 3 |
| Dracónido | Híbrido | 26 | 12 | 11 | 2 / 0 / 1 / 1 / 1 |
| Vampiro | Híbrido | 26 | 12 | 12 | 1 / 2 / 1 / 0 / 1 |
| Enano | Guerrero | 30 | - | 9 | 3 / 0 / 1 / 1 / 0 |
| Orco | Guerrero | 30 | - | 9 | 3 / 1 / 0 / 1 / 0 |
| Robot | Guerrero | 26 | - | 9 | 2 / 0 / 2 / 1 / 0 |
| Goliat | Guerrero | 34 | - | 8 | 3 / 0 / 0 / 2 / 0 |
| Minotauro | Guerrero | 32 | - | 9 | 3 / 1 / 0 / 0 / 1 |
| Gnomo | Mago | 14 | 20 | 11 | 0 / 1 / 3 / 1 / 0 |
| Alienígena | Mago | 16 | 18 | 12 | 0 / 2 / 3 / 0 / 0 |
| Infernal | Mago | 16 | 18 | 11 | 1 / 0 / 3 / 1 / 0 |
| Ángel | Mago | 18 | 18 | 11 | 0 / 1 / 2 / 1 / 1 |
| Hada | Mago | 16 | 16 | 12 | 0 / 2 / 2 / 0 / 1 |
| Licántropo | Guerrero | 28 | - | 11 | 2 / 2 / 0 / 1 / 0 |
| Elfo oscuro | Híbrido | 28 | 12 | 12 | 1 / 2 / 1 / 1 / 0 |
| Dríade | Mago | 16 | 18 | 11 | 1 / 1 / 2 / 1 / 0 |

(Al nivel 1, con su arma y túnica: la vida y el maná ya cuentan el equipo.)

### Las pasivas, medidas de nuevo
Con los números parejos, lo que separa a una raza de otra es la pasiva. Ajustes medidos con `node tools/equilibrio.js`: Determinación deja con el 10% de la vida (antes 15%), Colmillos devuelve el 12% (antes 15%), Ojo certero da +3 de precisión (antes +2), el Elfo oscuro envenena una de cada 2 veces, Sangre de lobo cura desde los tres cuartos de la vida y Llama interior suma 1 más desde el nivel 3. Todas las metas de equilibrio se cumplen: las clases quedan a 4-8 puntos entre sí y ninguna raza queda más de 8 puntos abajo de su clase.

### Partidas de antes
A cada personaje se le ajusta la diferencia entre los números de antes y los de ahora (vida, maná, velocidad, precisión, armadura, daño y esquiva), y el Diario dice cuánto le tocó.

## Versión 3.5.0: cada raza de mago con su arma

Cada raza de mago nace con su propia arma de mago (solo la pueden usar los magos): 1d4, +2 de maná y +1 de poder mágico, igual que la varita, pero con su forma.

| Raza | Arma |
|---|---|
| Gnomo | Varita de engranajes |
| Alienígena | Cetro de plasma |
| Infernal | Bastón de ascuas |
| Ángel | Báculo de luz |
| Hada | Varita de hada |
| Dríade | Vara de sauce |

Partidas de antes: el mago que todavía usaba la varita del principio se pone la de su raza (la varita queda en la mochila).

## Versión 3.4.0: cada clase con lo suyo, misiones en el centro y Alamuerte

### Armas por clase (`js/core/balance.js`: `canWield`, `weaponFit`, `canCast`)
- **Magos**: solo armas de mago (bastones, varitas, cetros, orbes y tomos). Les suman poder mágico (+1, y más con las de nivel alto). **Sin una puesta no pueden lanzar hechizos.**
- **Guerreros e híbridos**: solo armas comunes. El guerrero ya no tiene maestría con un bastón (no lo puede usar).
- Las legendarias Excalibur, Mjölnir, Matamuertos, Colmillo de dragón, Segadora de almas y Lamento helado pasan a ser comunes (para guerreros e híbridos).
- La tienda marca "Solo magos" o "No para magos", y el editor dice "No la puede usar" en la clase que corresponde.

### Magia (`js/systems/spellbook.js`)
- **Magos**: aprenden todos los hechizos (Curación, los de área y los de todos los pergaminos).
- **Híbridos**: su hechizo de raza, Chispa, Llama, Rayo helado, Segundo aliento y 6 pergaminos de combate: Misil arcano, Quemar, Ojo de halcón, Fuerza arcana, Piel de piedra y Furia salvaje (marcados `hybrid: true`). Nunca los de área ni los de curar a otros. Cualquiera puede leer un pergamino una vez en una pelea.
- En el Editor, el hechizo tiene "También para híbridos".

### Pantalla
- Las **misiones** pasan de la barra del costado al centro, debajo de "Criaturas de la zona": primero las que tienen algo para hacer en ese lugar (con la marca "Acá"). Tocar una abre el Diario.

### Alamuerte
- Ahora es el más fuerte de todos: 140 de vida, 3d10+3 de daño, +8 de precisión, defensa 19, y también ruge. Un héroe de nivel 10 solo y sin pociones le gana la mitad de las veces (al dragón anciano, 9 de cada 10). Suelta más y mejor botín.

### Partidas de antes
- Si tenías puesta un arma que tu clase ya no usa, va a la mochila y te ponés la mejor que sí podés usar (o la de tu raza).
- Un híbrido que sabía hechizos que ya no le tocan los pierde y le devuelven los pergaminos.
- En grupo, los dos tienen que tener la v3.4 (si no, el grupo avisa que hay que actualizar).

## Versión 3.3.0: magia con dado y espera, la muerte en serio, 3 razas nuevas y escenas de grupo

### Magia (`js/systems/combat.js`, `js/data/seed-spells.js`)
- Los hechizos de daño **tiran el dado** como un arma, con +2 (`Balance.SPELL_HIT`): pueden fallar y, con 20, son críticos. Los de área tiran una vez y se compara con la defensa de cada criatura. Algunos no fallan nunca (Dardo arcano). El menú dice la chance de acertar.
- **Esperas** (`cooldown`), solo en los hechizos fuertes: Curación se usa un turno sí y otro no; Bola de fuego (3), Tormenta arcana (4), Aliento de dragón (5) y otros esperan de 2 a 6 turnos. Los básicos no esperan.
- **Curación es solo para magos.** Los híbridos tienen **Segundo aliento** (nuevo): se curan solo a sí mismos. A los demás los curan los magos. Partidas de antes: el híbrido que sabía Curación la cambia por Segundo aliento.
- Los **magos solo usan armas mágicas** (varitas, bastones, cetros, orbes, tomos). Partidas de antes: el mago con un arma común se pone una mágica y la otra va a la mochila.
- **24 pergaminos se aprenden** como hechizos (botón *Aprender* en el detalle del pergamino; piden su nivel).
- **Hasta 3 pociones o comidas por turno** sin perder el turno. Los pergaminos sí gastan el turno.

### La muerte (`js/systems/death.js`)
- Las trampas, los golpes de las escenas y el hambre **matan**. Con poca vida, las escenas avisan antes de elegir.
- Si caés en una pelea, se tira un **dado de rescate**: si sale bien, alguien te encuentra y te lleva al pueblo; si sale mal, tu aventura termina, a menos que un compañero te levante con una **Hierba de la vida**.
- La pantalla de muerte cuenta qué pasó, dónde y en qué día.

### Grupo
- Cada uno se lleva **lo suyo completo** (experiencia, monedas y botín), como si estuviera solo.
- Lo malo de una escena le toca a **uno al azar**, y a cada uno de los demás con la mitad de chance.
- Las escenas que pueden terminar en pelea muestran **contra qué criaturas** sería.
- **El que huye se va solo**: se separa del grupo y los demás siguen peleando.
- **12 escenas solo para grupos** (`party: true`, en plural): en algunas tira **el más hábil** del grupo (`check.best`) y en otras se **ayudan entre todos** (`check.together`: +1 por compañero). Lo que se paga lo paga el que eligió, y lo que compra es suyo.

### Escenas nuevas (`js/data/seed-events.js`)
- 24 escenas nuevas: 12 para todos (un árbol hueco, el ermitaño, un pozo de los deseos, un perro perdido, una mina abandonada, una hierba que brilla...) y 12 solo para grupos (un carro en el barro, un río que no da pie, una puerta con cuatro palancas, ruidos en la oscuridad...).
- En el Editor: *Solo en grupo*, *Solo cuando vas solo*, *Cuándo sale*, y en las tiradas de grupo *la tira el más hábil* y *se ayudan*.

### Razas (`js/data/seed-races.js`, `js/systems/passives.js`)
- Cada raza **empieza con su arma** (1d4); los magos, con una varita (la dríade, con su vara de sauce).
- **Tres razas nuevas**: **Licántropo** (guerrero: con la mitad de la vida o menos se cura un poco cada turno), **Elfo oscuro** (híbrido: sus golpes envenenan y pega más fuerte a lo que ya tiene algo malo encima) y **Dríade** (maga: el que le pega de cerca se clava sus espinas).
- **Mediano**: la Suerte esquiva el 15% de los golpes (antes 10%). **Enano**: Piel de roca frena los dos primeros golpes de cada pelea (antes uno). **Orco**: la Furia se enciende con tres cuartos de la vida (antes, con la mitad).
- **Alienígena y Robot**: más parejos con los de su clase (ver la tabla).

### Equilibrio (medido con `node tools/equilibrio.js`, las 18 razas)
Porcentaje de rachas que gana cada clase, v3.1 → v3.3 (promedio de la clase):

| Prueba | Híbridos | Guerreros | Magos |
|---|---|---|---|
| Nivel 3 (5 peleas seguidas) | 39 → 39 | 35 → 36 | 49 → 40 |
| Nivel 6 | 86 → 85 | 81 → 83 | 88 → 87 |
| Contra parejas | 23 → 24 | 24 → 26 | 36 → 33 |
| Nivel 10 | 82 → 79 | 83 → 85 | 89 → 78 |

Las clases quedan a 4-9 puntos entre sí (la meta es 10 en los niveles 6 y 10, 15 en los otros) y ninguna raza queda más de 8 puntos abajo de su clase. Lo que se ajustó para llegar:
- Sin Curación, los híbridos bajaban de 86 a 35 en el nivel 6: por eso Segundo aliento (2d6+2, cada 2 turnos, solo a vos).
- Con espera y fallando, los magos bajaban a 65 en el nivel 10: Curación se usa un turno sí y otro no (con espera de 3 quedaban 20 puntos abajo).
- **Alienígena**: 1,5 de maná por turno (antes 2) y crece de a 1,5; vida −7. Al nivel 3 pasó de 72 a 51 (los otros magos, 31 a 48).
- **Robot**: vida +1 (antes +2): era el guerrero más fuerte al nivel 1.
- **Licántropo**: se cura solo con la mitad de la vida o menos (antes, siempre ganaba 15 puntos más que los otros guerreros). **Elfo oscuro**: sus golpes envenenan el 40% de las veces, +3 de daño a lo que tiene algo malo encima y vida +4 (sin eso quedaba 20 puntos abajo). **Ángel**: vida −5 (antes −6).

### Alquimia y hierbas
- Algunos habitantes preparan pociones (pestaña *Alquimia*): Maela, la druida, la boticaria y el sabio de la torre.
- **Hierba de la vida**: levanta a un compañero o a una mascota caídos en plena pelea. Se compra, se prepara o se encuentra.

### Narrador y pantalla
- La voz del narrador lee las escenas, el viaje y los lugares; cada pantalla tiene su parlante.
- Barra del costado: también en solitario, vida, maná y comida van finitas arriba y la experiencia debajo de todas. *Al explorar* es un botón al lado del de los hechizos (que ya funciona).

## Versión 3.2.0: grupos de hasta 4, lo que se gana se reparte y mascotas que ayudan

### Grupos de hasta 4 (`js/net/party.js`, `js/views/party.js`)
- Pueden jugar juntos hasta 4 (el anfitrión y 3 más) con el mismo código. Si el grupo está lleno, el quinto no entra y se le avisa.
- En las escenas votan todos: si eligen lo mismo, lo hace el que tiene más chance; si no, gana lo más votado (lo hace el que tiene más chance de los que lo votaron) y si empatan, deciden los dados. Arriba de la escena se ve a quiénes se espera.
- Las criaturas se ponen según cuántos son (`Balance.partyScale`): con 2 queda como antes; el 3.º y el 4.º suman más criaturas (hasta 7), más vida y algo más de daño. Medido con el simulador: tres o cuatro pierden más o menos la vida que pierde uno solo.
- Con mucha gente en la pelea (10 o más entre héroes, mascotas y criaturas) las tarjetas se achican para que los botones sigan a la vista; los compañeros tienen el borde azul.
- En el mapa aparecen todos los compañeros, uno al lado del otro si están en el mismo lugar.

### Barra del costado en grupo (`js/views/shell.js`)
- Tu vida, tu maná y tu comida van finitas arriba de todo, como la experiencia.
- Cada compañero es una fila corta: su cara, su nivel, su mascota, la vida y el maná, y si anda con vos o por su cuenta. Tocándola se abre el grupo.

### Lo que se gana se reparte, lo malo les toca a todos
- **Peleas**: cada uno se lleva una parte de la experiencia, las monedas y el botín (2: 42% · 3: 37% · 4: 30%), más o menos 3/4 de lo que ganaría peleando solo (antes, de a dos, cada uno se llevaba casi lo mismo que solo).
- **Escenas y viaje**: las monedas y la experiencia se reparten (2: 60% cada uno · 3: 47% · 4: 40%) y los objetos van de a uno, por turnos. Al terminar una escena se ve lo que le tocó a cada uno.
- Lo malo (una trampa, un ladrón, una herida, perder comida) les toca a todos. En el camino, en grupo, nadie muere por una trampa: queda con 1 de vida.

### Pasarse cosas (`A.Party.give`)
- En el detalle de cualquier objeto de la mochila: **Dar a** (cuántos y a quién). Las monedas se pasan desde el panel del grupo.
- Lo que no llega (mochila llena, el otro está en medio de algo o se cortó) vuelve a tu mochila. En plena pelea no se puede.

### Mascotas
- **Curar a tu mascota en la pelea**: las pociones (y los antídotos) y la Curación preguntan a quién: a vos, a tu mascota o, en grupo, a un compañero o su mascota. A la que está caída la levantan y vuelve a tener turno.
- El **Aullido** de tu mascota anima a todo el grupo (+1 de precisión y daño), no solo a vos.
- **Liberar** a tu mascota (botón en su ficha) para poder domar otra.

### Tiendas y armas
- La ventana del habitante (tienda, forja) ya no se corta: la cabecera y las pestañas quedan fijas y la lista se desplaza.
- Más armas mágicas para empezar: el mercader del Pueblo Inicial vende bastón, varita y túnica de mago; los herreros de Piedrahonda y del puerto, la **Varita rúnica** (nueva, enana: 1d4 y +4 de maná). Las varitas pegan poco: lo que suman es maná.
- Armas más distintas entre sí: la espada corta pega 1d6 con +1 de precisión (ya no es peor que la daga), el garrote pega 1d6, el hacha de mano hace sangrar, el martillo de guerra puede aturdir, la varita da +2 de maná, y la lanza, el arco corto, la espada larga, la alabarda y la espada rúnica tienen +1 de precisión.
- La forja **funde el mineral de hierro** en hierro.

### Combate
- El daño se lee entero en las tarjetas angostas: los nombres de los números pasan a íconos y el número se achica antes de cortarse.

### Partidas de antes
- El maná que da el equipo puesto se vuelve a calcular (por la varita nueva).

## Versión 3.1.0: bestiario, voz del narrador, comida por raza y clases parejas

### Bestiario (`js/systems/bestiary.js`, en el Diario)
- Las criaturas aparecen como "???" hasta que las ves. Vistas: nombre, nivel, dónde y cuándo salen, vida y daño. Conocidas (observadas o vencidas 3 veces): además sus habilidades y su botín.
- Partidas de antes: se dan por vistas las criaturas de las zonas donde ya peleaste.

### De día y de noche
- Algunas criaturas salen solo de noche (de noche y de madrugada) o solo de día; bajo tierra salen siempre. En el Editor: "Cuándo sale".
- Algunas escenas también son solo de noche o solo de día. Si lo que buscás para una misión sale a otra hora, el juego avisa.

### Explorar
- Cada opción de una escena dice qué pasa si sale bien y si sale mal, y la escena dice si te vieron o no.
- **Huir** es una carrera: tu velocidad contra la de la criatura más rápida.
- **Observar de lejos**: la anotás en el bestiario y sumás +2 a lo que hagas después.
- **Pelear de frente**: sin tirada, arrancás con la guardia alta (+2 de defensa por 2 turnos).
- Fuerza, Agilidad, Ingenio, Puntería y Suerte se ven en la ficha ("Al explorar") y al crear el personaje.

### Mapa y viaje
- El mapa ocupa la pantalla, con la ficha del lugar a la derecha: quién vive ahí y qué criaturas hay.
- En grupo, tu compañero aparece en el mapa, también mientras viaja.
- Viajes más largos (de 5 a 18 pasos) con la misma comida y las mismas peleas por viaje: se come 1 cada 4 pasos. En automático, un paso cada 1,5 segundos; en rápido, cada 0,45.

### Voz del narrador (`js/core/voice.js`)
- Lee en voz alta las peleas, las escenas y lo que pasa en el camino, con la voz del navegador (primero una de español de Latinoamérica). Se prende en el Menú ("Voz del narrador", normal o rápida) o con el parlante del combate. Queda guardado en cada compu, no en la partida.

### Grupo
- En las escenas se vota. Si eligen lo mismo, lo hace el que tiene más chance; si no, cada uno tira un D20 y gana el más alto. Si el compañero no vota, a los 20 segundos se puede decidir sin esperar.
- Lo que se usa una vez por pelea (Piel de roca, Determinación, Bendición, el blindaje del Robot) es de cada héroe: no se comparte.

### Cada raza come lo suyo (`js/core/survival.js`)
- Lo que más le gusta a tu raza rinde una vez y media; lo que no le va, la mitad. El Robot solo come aceite; el Vampiro, sangre y carne; el Hada, néctar, dulces y fruta.
- Comidas nuevas: lata de aceite, batería rúnica, botella de sangre, sangre de noble, frasco de néctar, gel de algas y carbón ardiente. Las venden los mercaderes, y la tienda marca lo que tu raza no come, lo que le encanta y lo que le rinde poco.
- Cada raza arranca con su comida. Partidas de antes: si tu raza solo come algo especial y no tenés, te dejan para empezar.

### Combate
- La crónica se lee: en pantallas anchas va al costado, de arriba abajo (con muchos en la pelea vuelve abajo). **Ver entera** la abre en grande, con todas las tiradas.
- Cuando una criatura usa una habilidad aparece un cartel con su nombre (dorado si es activa, azul si es pasiva). Lo mismo con las pasivas de raza.

### Equilibrio (`js/core/balance.js`, `js/systems/passives.js`)
El simulador ahora juega mejor (se cura a tiempo y guarda maná para una Curación), y así magos e híbridos le sacaban casi 20 puntos al guerrero. Cambios, medidos con `tools/equilibrio.js`:
- Guerrero: 8 de vida por nivel (antes 7).
- Híbrido: 2 de maná por golpe recién desde el nivel 9 (antes desde el 6).
- Mago: Curación le cuesta 6 de maná (al híbrido, 5); +1 de maná por turno en los niveles 5 y 9 (antes 4, 7 y 10); Bola de fuego, 10 de maná (antes 9).
- Robot: *Cuerpo de metal* suma un blindaje que frena 1 de daño por pelea (2 desde el nivel 6); se ve como un escudo en su tarjeta. Nace con 26 de vida (antes 27).
- Goliat: +1 de precisión desde el nivel 5. Infernal: +1 de esquiva. Gnomo: hechizos un 20% más baratos (antes 25%).
- Partidas de antes: los guerreros reciben la vida que les falta y los infernales el punto de esquiva al cargar; a los robots no se les quita vida.
- Resultado: la distancia entre la mejor y la peor clase baja de 19 a 7 puntos en las rachas de nivel 6 y 10, de 27 a 14 al nivel 3 y de 29 a 13 contra parejas.

### Pantalla de creación
- La ficha de la raza dice qué come y con qué arranca, y cuánto suma al explorar. En pantallas bajas (desde 1280×640) los cuatro números de combate van en una fila para que todo siga entrando sin scroll.

## Versión 3.0.0: jugar de a dos, cuentas, 3 razas nuevas y una historia más larga

### Jugar en grupo (`js/net/link.js`, `js/net/party.js`, `js/views/party.js`)
- Dos jugadores, cada uno en su compu y con su personaje. Uno toca **Grupo → Crear grupo** y le pasa el código de 6 letras al otro, que toca **Grupo → Unirme**.
- Los navegadores se conectan directo (WebRTC con PeerJS 1.5.5). Para encontrarse usan el servidor gratis de PeerJS: no hace falta servidor propio. Para probar con uno propio: `localStorage['aventurs:peer'] = '{"host":"127.0.0.1","port":9000,"path":"/myapp","secure":false}'`.
- El que crea el grupo es el anfitrión: su juego resuelve las peleas y las escenas de los dos y le manda al otro lo que pasa. Lo que hace el invitado viaja al anfitrión y se juega con el personaje del invitado (`A.State.withHero`).
- **Juntos**: viaja el anfitrión y el invitado lo sigue; cualquiera de los dos explora, elige en las escenas y descansa (el descanso es para los dos). **Separarme**: cada uno viaja y juega por su cuenta. **Ir con...**: se vuelven a juntar.
- Peleas en grupo: hasta 4 aliados (los dos héroes y sus mascotas), cada uno en su turno. Aparecen más criaturas (copias de las comunes) y un poco más fuertes; los jefes tienen más vida. Cada uno gana su experiencia y su botín y avanza sus misiones.
- El narrador cuenta lo del compañero en tercera persona ("Juan esquiva el golpe") (`js/systems/persp.js`).
- Si se corta la conexión, cada uno sigue con su partida.

### Cuentas (`js/core/accounts.js`, `js/views/login.js`)
- Al abrir el juego se entra con usuario y contraseña. Cada cuenta tiene su partida (`aventurs:save:<usuario>`).
- Las cuentas se guardan en el navegador de esa compu, no en internet. La contraseña se guarda cifrada (PBKDF2).
- La primera cuenta que se crea en una compu se puede quedar con la partida que ya había.
- El **Editor** solo lo ve la cuenta del dueño (`anibal9061`), que se crea con la llave del dueño (en el código solo está su huella, no la llave). Con la llave también se le pone contraseña nueva a cualquier cuenta de esa compu.

### Razas nuevas y "Al azar"
- **Vampiro** (híbrido): *Colmillos*, cada golpe con arma devuelve el 15% del daño como vida. Hechizo: *Toque vampírico*.
- **Minotauro** (guerrero): *Embestida*, el primer ataque de cada pelea no falla y pega x1,5 (x1,1 si es un Golpe fuerte).
- **Hada** (maga): *Polvo de hada*, al empezar cada pelea una criatura (nunca un jefe) se duerme y pierde su primer turno. Hechizo: *Chispas de hada* (puede encandilar).
- 15 razas en 3 filas de 5, parejas entre sí (medidas con el simulador: `node tools/simulador.js razas`).
- Botón **Al azar**: los dados eligen la raza (se puede volver a tirar).
- La pantalla de creación entra entera sin scroll (desde 1280×640).

### Historia y encargos (`js/data/seed-quests.js`)
- *La sombra del dragón* pasa de 8 a 18 capítulos y recorre todo el mapa: el Cementerio, Piedrahonda y sus minas, la Costa de los Naufragios, las Ruinas de Antorcha, el Santuario del Roble, Velmora y las Catacumbas, hasta el Nido. Villano nuevo: Morvaith, el Heraldo de la Ceniza.
- 15 encargos nuevos (28 en total) en todos los pueblos y ciudades, del nivel 1 al 9 (al final, el kraken y la hidra).
- Objetos de misión (ídolo, bitácora, tomo, sellos): los sueltan ciertas criaturas la mitad de las veces, solo mientras la misión los pide, y entran aunque la mochila esté llena. En el Editor: "Lo sueltan", en el objetivo.
- El diario dice con quién hablar para seguir la historia y avisa si un lugar todavía está cerrado ("se abre en el nivel 5").
- Partidas de antes: si ya ibas más adelante en la historia, los capítulos nuevos que quedaron atrás no aparecen.

### Experiencia y niveles (`js/core/balance.js`)
- Subir de nivel cuesta más del doble: `XP_TABLE = [100, 210, 470, 850, 1300, 1850, 2900, 3700, 4500]`. Las partidas viejas conservan su avance: la experiencia se pasa a la tabla nueva en proporción.
- Las criaturas mucho más débiles que vos dan menos experiencia; las más fuertes, un poco más (`Progression.levelGapMult`).
- Las misiones, hechas en su nivel, dan cerca de un tercio de lo que pide subir; el resto sale de pelear.

### Pergaminos
- El precio sale de lo que hace cada uno (`Economy.scrollPrice`): el de misil arcano pasa de 9 a 27 cobre.

### Arreglos
- "el hada" (no "la hada").

## Versión 2.5.0: criaturas con habilidades, élite y más formas de encarar

### Habilidades de las criaturas (`js/systems/skills.js` + `js/data/seed-skills.js`)
- Las 104 criaturas tienen **pasivas** (actúan solas) y **activas** (a veces las usan en su
  turno en vez del ataque de siempre). Cada una tiene su frase del narrador, su ícono y su
  número flotante.
- **Pasivas (19):** Manada (+1 de precisión por cada compañero de su especie), Caparazón y
  Gelatinoso (el primer golpe hace la mitad), Escurridizo (esquiva el primer golpe), Vuela
  (+1 de defensa), Furia (pega más fuerte con media vida), Regeneración (el fuego la frena),
  No muerto / Constructo / Ser elemental / Etéreo / Escamas ignífugas (inmunidades), Sed de
  sangre (se cura con lo que te saca), Cuerpo de fuego y de hielo (te quemás o te congelás
  al pegarle), Espinas, Venenoso, Renacer (el fénix vuelve una vez) y Líder (la élite).
- **Activas (41):** Mordida feroz, Zarpazo, Mordida infecciosa, Colmillos venenosos, Aguijón,
  Hoja envenenada, Picotazo a los ojos, Ataque en picada, Embestida, Derribo, Golpe
  aturdidor, Agarre, Lengua pegajosa, Escupitajo ácido, Drenar vida, Beber sangre, Disparo
  certero, Robar (las monedas vuelven si lo vencés), Doble ataque, Coletazo, Aliento de fuego
  y helado, Pisotón, Hechizo (de fuego, hielo, sombra o energía según la criatura), Chillido,
  Telaraña, Encantar, Polvo de sueño, Mirada de piedra, Aterrar, Rugido, Maldición,
  Oscuridad, Nube de tinta, Tierra a los ojos, Ojo antimagia, Curarse, Guardia, Aullido,
  Grito de guerra e Invocar (el nigromante levanta un esqueleto, el capitán pirata llama a
  un grumete...).
- **Tirada para resistir:** muchas se resisten con D20 + fuerza, agilidad o ingenio (el
  mismo modificador que al explorar) contra 10 + la mitad del tier (+2 los jefes, +1 la
  élite). El dado aparece en el combate con "¡Resistís!" o "No resistís".
- **Estados nuevos:** derribado (−3 de defensa), miedo (−2 de precisión y −1 de daño),
  atrapado (no podés huir y pegás peor), ácido (−2 de armadura). También envalentonado y en
  guardia para las criaturas. Sangrado y veneno se acumulan hasta 3 a la vez.
- **Mascotas:** usan las activas de su especie a tu favor (un lobo domado muerde, aúlla y te
  da ánimo; un fénix escupe fuego).
- **Balance:** con las habilidades puestas, cada criatura cuesta casi lo mismo que en la 2.4
  (un 3% a 5% más), ajustando solo su vida con el simulador: las que tienen habilidades
  fuertes (aliento, regeneración, renacer) tienen menos vida; las que pierden turnos en
  maldecir o asustar, un poco más. Regeneración cura como mucho un cuarto de su vida por
  pelea.

### Élite
- A veces una criatura sale de élite: **5%** si viene sola y **9%** si viene en grupo (una
  sola por grupo, nunca un jefe). Se llama "alfa" (bestias), "campeón/campeona" (gente y no
  muertos) o "mayor" (espíritus, elementales, demonios...). Una manada de lobos puede traer
  a su lobo alfa.
- Tiene 50% más de vida, 20% más de daño, +1 de precisión y de defensa (+1 de armadura
  desde el nivel 4), +1 de velocidad, la pasiva Líder (+1 de precisión a sus compañeros) y
  usa sus habilidades más seguido.
- Da **2,5 veces** la experiencia y las monedas, y suelta botín un 50% más seguido.
- Se ve: un dragón dorado sobre su tarjeta (como los jefes de los MMO), marco dorado y su
  título en lugar del nivel; en la escena de exploración también.

### Clases parejas otra vez
- Las habilidades castigan más al que pelea con el arma, así que los **guerreros** suman
  **+2 para resistir con agilidad o ingenio**, ganan **7 de vida por nivel** (antes 6), y su
  **Golpe fuerte** no lo esquivan Escurridizo ni Etéreo ni lo frena un Caparazón.
- Los **híbridos** recuperan 1 de maná más al acertar cada 5 niveles (antes cada 4) y los
  **magos** suman maná por turno cada 3 niveles (antes cada 4).
- Rachas de peleas ganadas (simulador, 500 por raza): nivel 1 híbrido 5,0 · guerrero 5,3 ·
  mago 4,9; nivel 5: 3,5 · 3,5 · 3,7; nivel 8: 3,2 · 3,0 · 3,1. Las zonas se ganan entre el
  89% y el 100% de las veces al nivel de entrada (sin pociones); contra una élite, 3 de 4.

### Explorar: más formas de encarar a las criaturas
- **Atacar por sorpresa** (la tirada depende de tu clase): si sale bien, actuás primero y
  **arrancan con un 25% menos de vida**. Si sale mal, la criatura te hace algo antes de
  empezar según lo que es: la araña te atrapa en su tela, la serpiente te envenena, el
  dragón te quema, el slime te carcome la armadura, el lobo te muerde... (o perdés un poco
  de vida).
- **Pelear de frente:** sin tirada.
- **Huir** (antes "Escabullirte"): agilidad, más difícil cuanto más rápidos son ellos.
- Una opción más según quiénes son: **tirarles comida** a las bestias (gasta una), **pagarles**
  a bandidos y piratas, o **intimidarlos** con fuerza (si sale mal, se envalentonan).
- Con muchas opciones, la escena las muestra en dos columnas.

### Armas que dejan estados
- La daga (y toda arma que haga sangrar, quemar, envenenar...) ahora lo dice en la ficha,
  en la tienda y en la barra lateral: "20% de chance de hacer sangrar al pegar: 1 de daño
  por turno durante 3 turnos". Y el narrador lo cuenta: "Tu daga le abre una herida al
  goblin: empieza a sangrar".

### Hechizos solo para magos
- Bola de fuego, Tormenta arcana y Aliento de dragón (los grandes de área) solo los
  aprenden los magos (gnomo, alienígena, infernal, ángel). Los híbridos (humano, elfo,
  mediano, dracónido) siguen con Chispa, Llama, Rayo helado, Curación y su hechizo de raza.
  Si un híbrido ya sabía uno de esos de antes, lo conserva. En el sabio aparecen como
  "Solo magos"; el pergamino avisa antes de gastarse. En el editor: "Solo para magos".

### Editor
- Criaturas: sección **Habilidades** para elegir pasivas y activas, con lo que hace cada una.
- Hechizos: interruptor **Solo para magos**.

### Arreglos
- "El bruja del bosque", "el hada traviesa", "el momia": ahora con su artículo correcto.
- "La araña intenta morderte, pero lo esquivás" → "pero la esquivás".
- Los dragones, la quimera y el dracónido salvaje ya no se prenden fuego con tus hechizos de fuego.

## Versión 2.4.0: rarezas, accesorios, pergaminos y botín justo

### Botín y precios
- **Rarezas** para todo (común, poco común, raro, épico y legendario), con su color en la
  mochila, la tienda, el combate y la ficha (`Balance.RARITY`).
- **Lo que vale cada material** sale de la criatura más fácil que lo suelta y de su rareza
  (`Economy.materialValue`). Lo que vendés te lo pagan a la mitad.
- **Lo que suelta cada criatura** depende de la rareza de la cosa: común 40%, poco común
  22%, raro 10%, épico 5%, legendario 2%; las fuertes un poco más y los jefes bastante más
  (`Economy.dropChance`). El equipo y los accesorios caen poco.
- **Misiones**: lo que pide una misión cae al menos el 40% de las veces en su criatura, y
  mientras te falte, el 50% (`QUEST_DROP_CHANCE` en combat.js, `Quests.wantedItems`). Los 3
  dientes de lobo ahora salen en unas 6 peleas contra lobos (antes, más de 20).
- **Comidas y pociones** cuestan según lo que dan: 2,4 de cobre por punto de vida, 2,8 por
  punto de maná, 1,2 por punto de comida; las mejoras, según cuánto ayudan y cuántos turnos
  duran (`Economy.consumablePrice`). El editor muestra el "precio justo".

### Peso
- El arma y la armadura pesan: lo que pasen de 4 entre las dos se resta de la velocidad
  (actuás más tarde y te cuesta más huir). Ahora se ve: la velocidad de la barra es la real
  (en rojo si el peso te frena), la ficha de cada arma o armadura dice cuánto te frenaría
  con lo que tenés puesto, y la tienda compara la velocidad.
- Las armaduras pesadas nuevas protegen más que las que ya había, pero pesan bastante más:
  son un cambio (más armadura, menos velocidad), no una mejora gratis.

### Todo lo de "RPG Plugins", de base (`js/data/seed-extra.js`)
- **31 armas** (hoz, látigo, estoque, cimitarra, mangual, claymore, guadaña, tomos y orbes
  que dan maná, Gungnir, Masamune...), **31 armaduras** (de las livianas con esquiva a las
  muy pesadas; túnicas con maná; volcánica, de escarcha y de tormenta te hacen inmune a un
  elemento).
- **22 accesorios** en un casillero nuevo, cada uno con su efecto: precisión, daño,
  armadura, defensa, velocidad, maná, vida por turno, críticos con 18, espinas, robo de vida,
  doble golpe, contraataque, más experiencia, monedas o botín, actuar primero, inmunidad al
  veneno, al fuego o al frío, curación aumentada y el Amuleto del superviviente.
- **43 pergaminos de combate** que puede usar cualquiera, una vez: daño que no falla (a
  uno o a todos, con fuego, hielo, rayo o veneno), aturdir, maldecir, robar vida, curar,
  limpiar, mejoras por turnos, espinas, invisibilidad, invencible, resurrección y deseo.
- **9 pociones** (curación y maná mayores, Elixir de vida, piel de piedra, velocidad,
  regeneración, invisibilidad, contra el fuego y contra el frío) y **33 comidas** (frutas,
  verduras, platos de taberna, bebidas, y las raras: pan élfico, jalea real, festín real,
  huevo de fénix y ambrosía, que además curan).
- Dónde se consiguen: cada tienda suma lo que va con su pueblo y su nivel, y cada criatura
  lleva lo que usaría (los magos oscuros, grimorios; las sirenas, tridentes y coral).
- Lo que no entró: los enemigos del plugin ya estaban todos en el juego; tampoco la comida
  rápida (pizza, hamburguesa, sushi...), las mascotas (acá se doma cualquier criatura) ni
  materiales que no sirven para nada. Los hechizos del plugin quedaron como pergaminos.

### Sistemas nuevos
- `js/systems/accessories.js` (`A.Accessories`): los efectos del accesorio puesto y el maná
  que dan el arma, la armadura y el accesorio (se suma al ponerlo y se resta al sacarlo).
- `js/systems/itemfx.js` (`A.ItemFx`): lo que hace cada poción, comida y pergamino, dentro y
  fuera del combate. Las mejoras duran tantos turnos tuyos como dice el objeto (se
  descuentan después de cada acción tuya).
- Combate: espinas, robo de vida, doble golpe, contraataque, superviviente, iniciativa,
  regeneración, inmunidades, invisible, invencible, aturdido y maldición, cada uno con su
  frase del narrador y su ícono sobre la tarjeta.

### Pantallas
- Barra lateral: cuatro casilleros de equipo (arma, armadura, accesorio y mochila).
- Ficha de cada objeto: rareza, precio de venta, peso, y lo que hace en líneas cortas.
  El botón "Usar" se apaga si no sirve en ese momento (panza llena, vida completa) y dice
  por qué; los pergaminos de combate avisan que se usan peleando.
- Combate: "Usar objeto" separa pociones y pergaminos, y cada uno dice lo que hace.
- Tienda: el borde de cada cosa dice su rareza; el detalle muestra qué hace y compara
  esquiva y velocidad.
- Dibujos nuevos: anillos, brazalete, botas, capa, guanteletes, trébol, orbes, libros,
  guadañas, látigo, frutas, sopas, pastel, miel, cerveza y la canasta del festín.

### Editor
- Objetos: rareza, nivel, el tipo Accesorio con todos sus efectos, y los efectos nuevos
  (daño, aturdir, maldecir, limpiar, todo al máximo, salvarte una vez) con elemento, a
  quién y qué efecto deja. "Así lo ve el jugador" muestra cómo queda la ficha.
- Armas: precisión extra y maná. Armaduras: maná e inmunidades. El peso llega hasta 12.

### Arreglos
- En combate, usar una poción desde la mochila curaba sin gastar el turno. Ahora gasta el
  turno como desde el botón "Objeto".
- El Elixir de fuerza y el Pergamino de escape se gastaban sin hacer nada.
- La tienda vieja mostraba "[object Object]" en las pociones.
- Se puede vender una copia de lo que tenés puesto.
- Curar a la mascota usa la poción de curación más barata.

## Versión 2.3.0: criaturas parejas, descanso con límite y todo en una pantalla

### Criaturas
- **Balance de las 104 criaturas** (`js/data/seed-enemies.js`), medido con el motor real:
  cada una pelea cientos de veces contra un humano de su mismo nivel (con el mejor equipo
  común, sin pociones). Ahora todas las del mismo tipo cuestan lo mismo: una débil le saca
  cerca del 7% de la vida, una normal el 24%, una fuerte el 42% y un jefe el 80%.

  | Tipo | Antes | Ahora |
  |---|---|---|
  | Débil | 5% a 14% | 6% a 9% |
  | Normal | 14% a 37% | 21% a 28% |
  | Fuerte | 27% a 72% | 39% a 46% |
  | Jefe | 67% a 97% | 78% a 83% |

  Cada una conserva su forma de ser (precisión, defensa, armadura, velocidad y rasgos):
  solo cambian la vida y, si hacía falta, el dado de daño. Ejemplo: el Jabalí pasó de
  20 de vida y 2d6 a 17 y 2d4+1 (antes costaba 37%, ahora 24%).
- Las zonas quedaron más parejas: se gana entre el 91% y el 98% de las peleas en todas
  (antes 88% a 98%). La diferencia entre clases sigue en menos del 10%.
- **Sugerir números** (editor, ficha de criatura): elegís cómo es (Pareja, Aguanta
  mucho, Pega fuerte, Rápida, Acorazada) y propone vida, daño y defensas parejos con las
  criaturas del juego de su nivel y tipo, afinados con peleas de prueba
  (`EditorSim.suggest`). Con "Usar estos números" pasan a la ficha; después se guarda.

### Descansar
- Fuera de la posada nunca te cura del todo: la siesta (de día) da +15% y llega hasta la
  mitad de la vida; dormir (de noche) da +40% al raso o +50% en el pueblo, hasta 3/4.
- Descansar da hambre: la siesta gasta 1 de comida y dormir 2.
- Después de descansar hay que moverse (explorar, pelear o viajar) antes de volver a
  descansar. El botón lo avisa. La posada, pagando, sigue curando todo.
- Los números están en `Explore.REST`.

### Pantallas
- **Barra lateral** más compacta: personaje, barras, números, equipo, mochila y misiones
  se ven sin bajar (en 1536 x 750). Si la pantalla es muy baja, se desplaza solo la ficha.
  La versión ahora está arriba, al lado del nombre del juego.
- **Combate entero en la pantalla**: escenario, narrador y botones siempre a la vista; la
  crónica usa el espacio que sobra y se desplaza por dentro.
- **Los que pelean, en el centro**: los dos bandos se miran en el medio con el VS entre
  ellos (antes tu lado quedaba pegado a la izquierda).
- **La precisión se suma al dado**: el dado cae, el número de precisión vuela desde la
  tarjeta (PREC) hasta el dado y el total sube antes de decir si pegó.
- El narrador cuenta una cosa por vez (cada frase queda al menos un momento a la vista).
- El cartel "en cola" ya no queda cortado, y el botón dice "Sale apenas te toque".
- El daño se ve completo en las tarjetas (`Utils.compactDice`: "1d8+1+2" pasa a "1d8+3").

### Arreglos
- Editor: tocar un interruptor más abajo en la ficha (por ejemplo "Anda en grupo" en el
  Orco) dejaba toda la pantalla negra. Era el casillero escondido del interruptor: el
  navegador corría la pantalla entera para mostrarlo.
- "Cuántas pueden venir juntas" se esconde si la criatura no anda en grupo.

## Versión 2.2.1: clases y razas parejas

Medido con peleas simuladas: cuántas peleas seguidas gana cada raza en zonas de su
nivel, con 2 pociones de vida y sin descansar (máximo 8), 1500 partidas por raza y nivel.
Promedio de cada clase, antes (v2.2.0) y ahora:

| Nivel | Híbridos | Guerreros | Magos |
|---|---|---|---|
| 1 | 4,77 → 5,58 | 5,82 → 5,77 | 5,05 → 5,11 |
| 3 | 2,20 → 2,57 | 2,91 → 2,75 | 2,92 → 3,08 |
| 5 | 1,98 → 2,83 | 2,88 → 2,63 | 2,19 → 2,86 |
| 8 | 1,43 → 1,81 | 2,11 → 1,90 | 1,31 → 1,77 |

La diferencia entre clases en nivel 8 bajó de −19%..+30% a −3%..+4%; entre razas, de
−25%..+40% a −11%..+10%. Ojo: la prueba les da a los que usan magia todos los hechizos
de su nivel; en el juego hay que aprenderlos.

Los números están juntos para poder afinarlos: `Balance.TUNE` (clases) y
`Passives.TUNE` (pasivas). Los textos de las pasivas se arman solos con esos números.

### Clases
- **Guerreros**: +6 de vida por nivel (antes 7). Golpe fuerte: doble daño, una vez cada
  5 turnos (antes cada 4).
- **Magos**: +5 de vida por nivel (antes 4). Recuperan 1 de maná más por turno desde el
  nivel 5 (y otro más desde el 9).
- **Híbridos**: cada golpe con arma que acierta les devuelve 1 de maná (2 desde el nivel
  5, 3 desde el 9). Se ve en la barra de maná de la barra lateral.

### Pasivas
- **Golpe de gigante** (Goliat): críticos con 18, 19 o 20, al doble (antes solo con 20,
  al triple). Probado también "18-20 al triple": el Goliat quedaba la raza más fuerte por
  lejos. Con la versión final, los críticos salen unas 3 veces más seguido pero pegan
  menos: el golpe más grande en nivel 5 bajó de 112 a unos 70.
- **Ojo certero** (Elfo): además de los críticos con 19-20, +2 de precisión.
- **Suerte** (Mediano): 1 de cada 10 golpes que le iban a pegar termina fallando (antes
  volvía a tirar los 1, y casi no se notaba).
- **Determinación** (Humano): el golpe que lo iba a voltear lo deja con el 15% de su vida
  (antes con 1).
- **Cuerpo de metal** (Robot): sin cambios (con +1 de armadura el Robot quedaba muy fuerte).
- **Dracónido**: esquiva 0 (antes −1).

## Versión 2.2: editor del mundo nuevo

El editor se rehizo de cero (`js/editor/`, `css/editor2.css`). Se abre con el botón
**Editor** de arriba (o desde la creación de personaje).

- **Pantalla**: tipos a la izquierda, lista con buscador y filtros en el medio, ficha a la
  derecha. En el celular se ve una por vez, con flecha para volver.
- **Qué se edita**: zonas y pueblos, escenas, criaturas, habitantes, razas, misiones,
  objetos, armas, armaduras, mochilas, recetas y hechizos. Las misiones y las escenas
  ahora también se pueden cambiar (`Data.quests`, `Data.events`).
- **Campos claros**: cada número dice para qué sirve; los dados muestran su rango
  ("1d8+1: de 2 a 9"); para elegir criaturas, objetos o lugares se usa una lista con
  buscador y dibujitos, sin escribir códigos.
- **Guardar**: la ficha es un borrador; nada cambia en el juego hasta tocar **Guardar**
  (o Ctrl+S). Se guarda **solo lo que cambiaste** (un parche por cosa): lo que no tocaste
  se sigue actualizando con cada versión nueva del juego.
- **Cambios**: lista de todo lo que cambiaste, dato por dato, con "Volver al original".
  Los cambios del editor viejo (copias completas) se marcan para revisarlos.
- **Revisar**: problemas del mundo (zonas sin criaturas, caminos o misiones que apuntan a
  cosas que no existen...). Tocás uno y se abre la ficha.
- **Mapa**: arrastrá lugares para moverlos, uní o separá caminos, creá una zona nueva
  tocando el mapa. Los caminos siempre van en las dos direcciones.
- **Prueba de combate**: en cada criatura, cientos de peleas rápidas contra un aventurero
  humano de prueba del nivel que elijas; dice cuánto gana y si es pareja con las criaturas
  del juego del mismo tipo. En las zonas, lo mismo con las peleas típicas de la zona.
- **Zonas**: en la ficha se ven y se cambian las criaturas que viven ahí y los habitantes.
- **Escenas por lugar**: una escena puede ser de lugares puntuales (`regions`), no solo de
  un paisaje.
- **Exportar / Importar**: un archivo `.json` con tus cambios, para pasarlos a otra compu.

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
  nivel 9), +1 de precisión con armas pesadas y Golpe fuerte (v2.1.1). +7 de vida por nivel.
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

### v2.1.1: guerreros y equipo
- **Golpe fuerte** (solo guerreros): un botón en combate que ataca con el doble de
  daño. Después hay que esperar 4 turnos para volver a usarlo (`Balance.warriorPower`).
- Los guerreros ganan **+7 de vida por nivel** (híbridos 6, magos 4).
- Con esto los guerreros terminan las peleas con tanta vida como los magos y las
  ganan más rápido (medido con `tools/simulador.js`).
- Ya se puede **quitar el arma y la armadura**: tocá la pieza en la barra lateral y
  elegí "Quitar" (vuelve a la mochila).
- Las armaduras muestran "Armadura" (lo que se resta de cada golpe) y "Nivel" en vez de "Tier".

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
