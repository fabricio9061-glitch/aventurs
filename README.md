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
├── README.md               Esto: qué es, cómo se corre y cómo está armado
├── CHANGELOG.md            Lo que cambió en cada versión (v2.0 a hoy)
├── css/
│   ├── tokens.css          Variables visuales
│   ├── base.css            Reset + tipografía
│   ├── game.css            Estilos del juego (shell, sidebar, tabs, modales)
│   ├── theme.css           Tema "Mezcla"
│   ├── v2.css / v3.css     Escenas, tienda, diario, mapa, grupo, cuentas y creación
│   ├── editor2.css         Editor del mundo
│   ├── efectos.css         Efectos de la pelea: golpes, hechizos, respiración, estados y botín (v3.16)
│   ├── pantalla.css        La barra de la derecha compacta, para ver la mochila sin bajar (v3.17)
│   ├── pelea.css           La pantalla de pelea: cintas, habilidades, turnos con caritas y crónica (v3.18)
│   ├── viaje.css           La pantalla de viaje ordenada: escenario y bitácora del mismo alto (v3.18.2); cabecera con paisaje (v3.20.4)
│   ├── pelea2.css          Pelea más limpia: crónica por turnos y efectos nuevos (v3.19)
│   ├── oficios.css         Herrero y cosas para lucirse (v3.20)
│   ├── pueblo.css          La pantalla del lugar con el estilo de las tarjetas nuevas (v3.20.1)
│   ├── habitante.css       La ventana de cada habitante, más linda (v3.20.3)
│   ├── celular.css         El juego en el celular: todo entra en la pantalla (v3.21.4)
│   └── maestros.css        Dónde vive el maestro de tu raza (v3.21.6)
├── js/
│   ├── core/               utils, bus (pub/sub), balance (TODAS las fórmulas), sprites e item-sprites
│   │                       (pixel art), data (carga los seeds + cambios del editor), accounts,
│   │                       state (la partida), survival (comida), voice (narrador), validate
│   ├── data/               El contenido del juego, ya con todos los cambios de cada versión:
│   │   ├── seed-races.js       las 18 razas (y sus fórmulas)
│   │   ├── seed-regions.js     los 83 lugares
│   │   ├── seed-enemies.js     las criaturas, con su botín y sus habilidades
│   │   ├── seed-weapons.js / seed-armors.js / seed-items.js / seed-bags.js
│   │   ├── seed-spells.js      hechizos
│   │   ├── seed-recipes.js     recetas de los talleres
│   │   ├── seed-npcs.js        habitantes (tiendas, maestros, posadas)
│   │   ├── seed-events.js      escenas para explorar y qué criaturas aparecen en cada lugar
│   │   ├── seed-quests.js      misiones
│   │   ├── seed-escuelas.js    las 18 escuelas de raza y los objetos retirados
│   │   └── seed-jefes-medidos.js  lo que mide tools/jefes.js --datos (lo muestra el editor)
│   ├── systems/            Las reglas:
│   │   ├── combat.js           la pelea, parte 1: ayudas, grupo y cómo empieza
│   │   ├── combat-reglas.js    estadísticas, dados, daño y estados
│   │   ├── combat-turnos.js    orden de turnos, pasivas de cada turno, jefes y objetivos
│   │   ├── combat-jugador.js   atacar, técnicas, disciplinas y hechizos
│   │   ├── combat-escuelas.js  escuelas de magia, objetos y domar
│   │   ├── combat-aliados.js   huir, la mascota y los aliados invocados
│   │   ├── combat-enemigos.js  el turno de las criaturas
│   │   ├── combat-final.js     victoria, derrota, botín, registro y la API (A.Combat)
│   │   ├── tactics.js          cuán lista es cada criatura (a quién ataca, cuándo huye)
│   │   ├── skills.js           habilidades de las criaturas
│   │   ├── oficios.js          en qué gastar la plata: herrero +1 a +5 y lucirse (v3.20)
│   │   ├── gente.js            gente en el camino: mercader ambulante, herido y bandidos (v3.21)
│   │   └── ...                 encounter, travel, tame, inventory, crafting, npc, explore,
│   │                           quests, accessories, itemfx, spellbook, schools, bestiary...
│   ├── net/                link.js (conexión con código) y party.js (el grupo)
│   ├── vendor/             peerjs.min.js (PeerJS 1.5.5, licencia MIT)
│   ├── editor/             Editor del mundo
│   ├── views/              Las pantallas (combat-fx.js: el dado y los efectos de la pelea; escenas.js: la silueta de cada lugar)
│   └── app.js              Arranque
└── tools/
    ├── simulador.js        Simulador de balance (Node, no se carga en el juego)
    ├── equilibrio.js       Pruebas de equilibrio entre razas y clases, con semillas fijas
    ├── hordas.js           Cada raza contra grupos de criaturas
    ├── jefes.js            Cada jefe contra un guerrero, un híbrido y un mago
    └── grupo.js            Peleas de 2 a 4 héroes juntos, con el motor de verdad
```

Las partes de la pelea se cargan en ese orden desde `index.html`. Cada una deja sus funciones en
`A._pelea` y llama a las de las otras por su nombre (la lista "De las otras partes" de arriba de
cada archivo). Para agregar una función nueva: escribila en la parte que corresponde y, si otra
parte la usa, sumala a esa lista.

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

Pruebas de equilibrio (v3.1): nueve pruebas por raza (1 contra 1, rachas en los niveles 1, 3, 6, 10, 15, 20 y 25
—las de 15 y 20 desde la v3.11, la de 25 desde la v3.12— y peleas contra parejas), con semillas fijas para comparar
antes y después de un cambio:

```powershell
node tools/equilibrio.js                        # las 18 razas (unos minutos)
node tools/equilibrio.js --rapido               # la cuarta parte de las rachas
node tools/equilibrio.js --razas=robot,enano    # solo esas razas
node tools/equilibrio.js --guardar=antes.json   # guarda los resultados
node tools/equilibrio.js --comparar=antes.json  # muestra cuánto cambió cada número
```

Contra grupos (v3.9): cada raza contra 1, 3, 5 y 8 criaturas iguales en los niveles 1, 5 y 10 (y contra 3 y 5
en el 15, el 20 y el 25 desde la v3.11 y la v3.12), con victorias, rondas, vida que queda y cuántas veces se nota
la pasiva y el hechizo de nacimiento:

```powershell
node tools/hordas.js                          # las 18 razas (unos 2 minutos)
node tools/hordas.js --razas=vampiro,orco     # solo esas
node tools/hordas.js --guardar=antes.json     # guarda los resultados
node tools/hordas.js --comparar=antes.json    # muestra cuánto cambió
```

Contra jefes (v3.10): cada jefe contra un guerrero, un híbrido y un mago de su nivel y de dos niveles más
(sin pasar del tope, que desde la v3.12 es 25):

```powershell
node tools/jefes.js                      # los 26 jefes (unos minutos)
node tools/jefes.js --jefes=kyubi,kraken # solo esos
node tools/jefes.js --datos              # y guarda lo medido para el editor (js/data/seed-jefes-medidos.js)
```

En grupo (v3.11): 2 a 4 héroes juntos, con las reglas del juego en grupo (la Bendición del ángel, el lobo del
Aullido, los jefes que suben con cada héroe):

```powershell
node tools/grupo.js --heroes=enano,angel --jefes=kyubi,kraken          # pareja contra jefes (y +2 niveles)
node tools/grupo.js --heroes=orco,humano,gnomo,angel --criaturas=lobo_bruma*3 --nivel=11
```

## Contenido del juego (seed)

- **18 razas** parejas, cada una con su pasiva, su arma y **su escuela** (v3.13: 12 de magia y 6 disciplinas
  de guerrero, con poderes en los niveles 1, 5 y 9)
- **83 lugares** ordenados por nivel (1 a 25): 47 de combate, 9 pueblos (6 con criaturas en el camino)
  y **27 guaridas de jefe**, cada una saliendo de una zona de su nivel (v3.13)
- **219 criaturas** (27 jefes, 34 domables), cada una con su zona propia
- **140 armas**, **68 armaduras**, **486 objetos**; todo con rareza (común a legendario) y con tope de cantidad
- **129 hechizos**, **12 técnicas de disciplina**, **137 recetas**, **36 habitantes** (18 maestros)
- **101 misiones** (18 de la historia principal y 18 pruebas de escuela) y **86 escenas** para explorar (12 solo para grupos)

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
- **Nivel y estados en pelea (v3.21.7)**: todas las criaturas muestran su "Nv" en la tarjeta,
  también con mucha gente en la pelea. Los estados van a la izquierda del dado de dificultad y,
  si son muchos, bajan a una segunda fila (antes se metían abajo del dado).
- **Vigor (v3.21.7)**: estado nuevo de las criaturas: vida máxima de más (y esa vida) por unos
  turnos; al terminar, la vida de más se va. Habilidades `vigor` y `bendicion_vida` en `js/systems/skills.js`.
- **Marco para todos (v3.21.8)**: el marco que te comprás en "Lucirse" ahora lo ven tus compañeros:
  en la lista del grupo, en la ventana del grupo, en la tarjeta de pelea (brillo del color del marco
  abajo de los pies y borde de la tarjeta) y en la fila de turnos. `A.Oficios.frameCls(héroe o ficha)`.
- **Efectos de ataque (v3.22.0)**: cada arma pega distinto: corte con media luna (espada), hachazo
  con astillas, mazazo con grieta y polvo, estocada (lanza), doble puñalada (daga), flecha que vuela
  y se clava (arco), puñetazo, varitazo; las criaturas muerden, arañan o picotean según su especie
  y habilidades. Armas con fuego/hielo/rayo/veneno/sangrado lo muestran al pegar. Crítico con rayos
  de luz. Hechizos oscuros (morado) y de tierra (piedras). Estados con dibujo propio (burbujas de
  veneno, llamas, gotas de sangre, bloque de hielo, estrellas del aturdido, sello de maldición,
  enredo, mareo) y curas con columna de luz. Solo visual: `attackStyle` en `js/views/combat-fx.js`,
  estilos en `css/ataques.css`.
- **Peleas con mucha gente (v3.22.1)**: con 8 o más en la pelea, los caídos salen de la arena y
  se cuentan arriba, al lado de la ronda ("13 caídos"; al pasar el mouse dice cuáles). El jefe se ve
  más grande. Si las filas no entran, los dibujos se achican (`is-tight`) y, si igual no entra, la
  arena se desplaza (`is-scroll`); si sobra lugar, crecen (`is-roomy`). Arreglado: en pantallas bajas
  la caja del dibujo quedaba alta con el dibujo chico (dados flotando y la fila de arriba cortada).
  `fitArenaRows` y `fallenChip` en `js/views/combat.js`, estilos al final de `css/pelea2.css`.
- **Narrador** (`js/systems/narrator.js`): cada acción se cuenta con una frase
  ("El lobo se lanza y te muerde: 5 de daño."), distinta según el arma, la criatura y
  el resultado. Aparece cuando cae el dado; hasta entonces no se adelanta ni la vida
  ni el relato.
- **Crónica en prosa**: con *Ver tiradas* se ven los dados y las cuentas.
- **Sin emojis en el combate**: íconos pixelados (`A.ItemSprites.icon`) y sprites.
- La pantalla de victoria muestra la experiencia, las monedas y el botín con sus dibujos.

## Versiones

Lo que cambió en cada versión está en [CHANGELOG.md](CHANGELOG.md).

## Idioma

Español rioplatense (con "vos"). Sin TODO MAYÚSCULAS.
