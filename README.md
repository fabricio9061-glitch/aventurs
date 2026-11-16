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
│   ├── theme.css           Tema "Mezcla" (v1.9.0)
│   ├── v2.css              Pantallas de la v2.0 (escenas, tienda, diario, mapa)
│   └── editor2.css         Editor del mundo (v2.2)
├── js/
│   ├── core/
│   │   ├── utils.js        Dados, clamp, escapeHtml, etc.
│   │   ├── bus.js          Pub/sub global
│   │   ├── balance.js      TODAS las fórmulas de balance (v1.8.0)
│   │   ├── sprites.js      Dibujos pixel art 32×32 de criaturas y personajes (v1.9.0)
│   │   ├── item-sprites.js Dibujos pixel art 32×32 de ítems e íconos de interfaz (v1.9.1)
│   │   ├── data.js         Loader de seeds + cambios del editor (parches por id)
│   │   ├── state.js        Estado de partida + persistencia
│   │   └── validate.js     Chequeos de coherencia (refs, regiones vacías, misiones, escenas)
│   ├── data/               Seeds: races, regions, enemies, items, weapons,
│   │                       armors, spells, recipes, npcs, bags,
│   │                       events (escenas al explorar), quests (misiones),
│   │                       extra (lo de "RPG Plugins": equipo, accesorios,
│   │                       pergaminos, pociones y comidas; v2.4)
│   ├── systems/            Combat, Encounter, Travel, Tame (mascotas),
│   │                       Inventory, Currency, Crafting, NPC,
│   │                       Explore (escenas y descanso), Quests (misiones),
│   │                       Accessories (accesorio puesto), ItemFx (pociones,
│   │                       comidas y pergaminos, mejoras por turnos) (v2.4)
│   ├── editor/             Editor del mundo (v2.2): ed-core (guardado por parches),
│   │                       ed-fields (campos), ed-schema (qué se edita de cada cosa),
│   │                       ed-panels, ed-sim (prueba de combate), ed-map, ed-view
│   ├── views/              Shell, Character, World, Map, Inventory, Magic,
│   │                       Chronicles, Combat, Modals
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
- **66 armas**, **44 armaduras**, **266 objetos** (22 accesorios, 44 pergaminos de combate,
  19 pociones, 46 comidas), **5 mochilas**; todo con rareza (común a legendario)
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
