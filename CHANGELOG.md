# Aventurs: lo que cambió en cada versión

La más nueva arriba. Cómo correr el juego y cómo está armado: [README.md](README.md).

## Versión 3.18.2: el viaje, ordenado (`css/viaje.css`)

- **Lo que pasa en el camino y la bitácora miden lo mismo de alto.** La bitácora ya no estira la pantalla: si hay muchos sucesos, se baja adentro.
- El hallazgo va **centrado**, y "Avanzando rápido..." es una etiqueta chica debajo (antes quedaba pegada al costado).
- **El encuentro ocupa todo el lugar:** criaturas más grandes, el texto debajo del título (antes quedaba en una columnita) y los botones abajo, con Pelear bien grande.
- En pantallas bajas todo entra sin bajar.

## Versión 3.18.1: la pelea, ordenada

- **Todas las tarjetas miden lo mismo** y quedan alineadas: las habilidades de la criatura ahora van en una columnita al costado del dibujo, no debajo de los números.
- Hasta 6 en la pelea (por ejemplo vos, tu mascota y 3 criaturas) va **todo en una fila**, con la crónica al costado. El ancho de las tarjetas se calcula según la pantalla para que nunca se partan en dos filas.
- Los dibujos crecen según el lugar que hay en la arena (más grandes en pantallas grandes) y la pelea usa más ancho en monitores anchos.
- Con más de 6 (grupos) sigue el modo apretado: botones y crónica lado a lado abajo.

## Versión 3.18.0: la pantalla de pelea, más clara (también en grupos de 4)

### Criaturas (`css/pelea.css`)
- **Jefe**, **mini jefe** y **fuerte** van como una cinta arriba de la tarjeta (dorada, violeta o roja), y los jefes brillan. Así el nombre entra entero ("Gárgola B" ya no se corta).
- Debajo de sus números se ven **sus habilidades** como íconos: rojos los que usan, azules las pasivas. Lo que hace cada una aparece al pasar el mouse. Con mucha gente en la pelea no entran en la tarjeta y se ven al pasar el mouse por la criatura.

### Turnos
- La fila de turnos de arriba muestra **la carita de cada uno**: borde rojo las criaturas, azul los compañeros, verde las mascotas y dorado vos. Con más de 6, solo las caritas, y el que juega muestra su nombre.

### Crónica
- Cada línea tiene **el color de su bando** en el borde (dorado vos, azul tus compañeros, verde las mascotas, rojo las criaturas).
- Al final de cada frase hay una **etiqueta con lo que pasó**: −6, −12 crítico, +5, esquiva, pifia, sin daño (la armadura lo paró), cae o huye.
- Las líneas de reglas que aparecen con "Ver tiradas" ("Te emboscaron", el orden por velocidad) van chicas y apagadas, ya no en letra grande.

### Pantalla
- **Con pocos en la pelea**, la arena usa todo el alto y los dibujos son más grandes (en pantallas de 740 de alto o más). Ya no queda el espacio vacío abajo de los botones.
- **Con mucha gente** (grupos de 3 o 4 con mascotas), los botones van de a dos y la crónica queda al lado, abajo de la arena. Así se ve todo sin bajar (medido con 4 héroes, 3 mascotas y 7 criaturas en 1536×760).

Las reglas de la pelea no cambian, así que el equilibrio es el mismo.

## Versión 3.17.1: la mascota y el grupo, más claros

### Mascota (barra de la derecha)
- Tarjeta más baja: el dibujo con su nivel en la esquina, el nombre y al lado **lo que te da** en corto ("+1 magia", "+1 precisión"...). El texto entero aparece al pasar el mouse.
- Si no te ayuda, en vez de eso aparece en rojo **Inconsciente** o **Tiene hambre**, y el botón de comida titila.
- Vida y comida van en dos barras finitas, y la experiencia es una rayita dorada abajo de la tarjeta. Lo que come aparece al pasar el mouse por la comida.
- Liberarla queda como una cruz chiquita y apagada, para no tocarla sin querer.

### Grupo (barra de la derecha)
- Una fila finita por compañero: cara con su nivel, nombre, vida con el número adentro, maná abajo, el dibujo de su mascota con su vida y un ícono que dice si está con vos o por su cuenta.
- Si a un compañero le queda poca vida, su barra titila.
- Con 3 compañeros y mascota, la mochila sigue entrando sin bajar (medido en 1536×760).

## Versión 3.17.0: todo a la vista y comprar con la mochila llena

### La barra de la derecha entra sin bajar (`css/pantalla.css`)
- Vida, maná, comida y experiencia van de a dos por fila.
- Tus números (precisión, daño, defensa, armadura, velocidad y magia) van en una sola fila. Lo que es cada uno se ve al pasar el mouse.
- La mascota ocupa menos: lo que hace va en dos líneas como mucho (entero al pasar el mouse).
- Medido con la mochila más grande (32 lugares) y una mascota: la mochila entra entera sin bajar en pantallas de 1920×950, 1536×760 (una de 1920 con el navegador al 125%) y 1366×680. Antes había que bajar 70 a 150 píxeles.

### Arreglo
- **Comprar con la mochila llena**: si ya tenés ese objeto y su pila no está llena, ahora lo podés comprar (se apila y no ocupa lugar nuevo). Antes el botón decía "Mochila llena". Un objeto que no tenés sigue sin entrar si la mochila está llena (`State.canAddItem`).

Las peleas no cambian (no se tocó nada de las reglas), así que el equilibrio es el mismo de la v3.16.

## Versión 3.16.0: la pelea se ve mejor y el código está ordenado

### Efectos de la pelea (`css/efectos.css` y `js/views/combat-fx.js`)
- **Golpes con peso**: la arena se sacude según cuánto duele el golpe (los críticos, más fuerte), un anillo marca el impacto y, cuando te pegan, los bordes de la arena se ponen rojos.
- **Hechizos que viajan**: la bola sale del que la lanza y llega a su blanco dejando chispas. Cada elemento pega distinto: brasas que suben (fuego), astillas de hielo, un rayo que cae del cielo (electricidad), burbujas (veneno), una columna de luz (sagrado) y un círculo de runas (arcano).
- **Barras de vida**: además de bajar despacio con su estela, brillan en blanco cuando bajan y en verde cuando suben.
- **Respiración y embestida**: cada personaje respira a su ritmo (los jefes, más pesado) y el que ataca primero toma impulso y se tira con rayas de velocidad.
- **Botín**: la criatura que cae suelta una bolsita que rebota (la que huye, no). En la pantalla de victoria cada objeto tiene el color de su rareza; los épicos y legendarios brillan.
- **Estados**: las burbujas tienen color según lo que hacen (rojo daño por turno, violeta control, verde mejoras), el número de turnos se lee mejor, titilan cuando les queda el último turno y al pasar el mouse dicen qué hacen.
- Si la compu tiene "reducir movimiento" activado, los efectos nuevos no se mueven.

### Código ordenado (el juego es el mismo)
- **Los parches juntos**: los 11 archivos de cambios (`seed-extra`, `seed-skills` y `seed-v39` a `seed-v315`) ya están aplicados en los archivos de siempre (`seed-enemies.js`, `seed-items.js`...). Las escuelas y los objetos retirados quedaron en `seed-escuelas.js`.
- **La pelea partida en 8 archivos** (`js/systems/combat*.js`, antes 3.600 líneas en uno solo). El código de adentro es el mismo.
- **El README es corto** y la historia de las versiones pasó a este archivo.
- Comprobado: los datos del juego son idénticos a la v3.15.0 (todas las criaturas, objetos, razas, misiones...) y `equilibrio.js --rapido`, `hordas.js` y `jefes.js` dan los mismos números (alguna vez 1 punto distinto, por un azar que ya tenía la v3.15.0 al medir). El equilibrio no cambia.
- El grupo sigue en la versión 15: las reglas son las mismas.

## Versión 3.15.0: botín con sentido, criaturas que piensan y clases parejas

### Botín con sentido (las 219 criaturas, `js/data/seed-v315-botin.js`)
- Cada criatura suelta **su objeto propio** (188 nuevos): Pluma de cuervo, Pluma de búho, Cola de zorro, Colmillo de jabalí, Caparazón de tortuga, Melena de león, Ojo de medusa, Ojo de cíclope, Ojo de contemplador, Pluma de grifo, Pluma de roc, Cola de kitsune, Linterna de pez abisal, Lámpara del djinn, Óbolo del barquero, Mapa del tesoro, Filacteria del lich... y un **trofeo para cada jefe** (Corona del Rey Goblin, Corazón de la Reina Araña, Caparazón de la Tarrasca, Ojo del Kraken, Corona del Sol...). El escorpión suelta su Aguja de escorpión y la Corona de escarcha y el Corazón del Fénix siguen siendo los trofeos de sus jefes.
- Se terminaron los drops sin sentido: nada de madera en los elementales ni en las serpientes, plumas en dragones, demonios o el contemplador, pergaminos en zombis, ettins o la medusa, el Bastón del trueno en la gárgola, la Túnica de mago en el kobold ni la Piel de oso en el mamut y el yeti.
- Cada objeto propio **vale según el nivel** de la criatura (`Balance.Economy.materialValue`): la Pluma de roc (nivel 18) vale 3.046 de cobre; la Pluma de antes, 11.
- Chances: objeto propio débil 40%, normal 45%, fuerte 55%, jefe 100% · otros materiales que tengan que ver 25% (los caros, 6%) · equipo 4%, **solo los humanoides** y solo lo que usan (el pirata, su espada curva; la noble vampira, su amuleto). Los jefes conservan sus armas, armaduras y elixires únicos; el Dragón anciano, su tesoro.
- **Monedas**: las bestias, insectos, plantas, elementales, babosas, gólems y bichos del mar ya no cargan monedas (`Economy.carriesCoins`); para compensar, su objeto propio es raro (y su trofeo, legendario). Humanoides, muertos vivientes, demonios, dragones, gigantes, arcanos y espíritus siguen dando monedas.
- Los pergaminos que soltaban los zombis y compañía ahora los sueltan los que hacen magia: aprendices, drows, magos oscuros, nigromantes, brujas, cultistas y sacerdotes profundos.
- **Íconos**: salen del nombre como siempre, con palabras nuevas (corona, mapa, yelmo, máscara, lámpara, óbolo, filacteria, halo, pinza, garfio, apuntes, crin) y tres dibujos nuevos (yelmo, máscara y lámpara). Cada objeto puede traer sus colores en `tint`.
- **Plata por nivel** (peleas, contando lo que se vende a la mitad): en los niveles 1 a 6 se gana entre 1% y 15% más que en la v3.14; del 7 en adelante, entre 20% y 40% más. Para que un arma común de tu nivel siga costando lo mismo comparado con lo que ganás, el equipo en las tiendas pasa de ×4 a **×4,5** (`Economy.SHOP_MARKUP`; las lecciones de la escuela también).

### Criaturas más inteligentes (`js/systems/tactics.js`)
- **Tres niveles**: simples (animales, bichos, plantas, gólems, zombis y esqueletos), normales (humanoides, gigantes, espíritus, hadas, dragones jóvenes) y listas (magos, demonios, aberraciones, celestiales, dragones grandes y todos los jefes). La élite sube un nivel.
- **A quién atacan**: las simples, a cualquiera. Las demás rematan al más herido y prefieren al de menos armadura; las listas van primero contra el que se cura (ángel, dríade, vampiro) y contra tu mascota si es la que cura. Si a vos te falta poco, te rematan a vos; si a tu mascota le falta poco, a ella.
- **Habilidades en su momento**: no se curan con la vida llena; con poca vida se curan, invocan o se enfurecen casi seguro; las listas aturden o duermen al que está entero y le cortan la curación al que se cura.
- **En equipo**: la manada se tira sobre el mismo blanco; el chamán cura a los suyos cuando están mal; los escoltas se ponen delante del jefe herido (+2 de defensa).
- **Huir**: las débiles y las cobardes (goblin, kobold, bandido, contrabandista, aprendiz, hobgoblin, rata gigante, diablillo) que quedan solas y heridas a veces salen corriendo: **no dejan botín** y dan la mitad de experiencia (y no cuentan para las misiones).
- **Cortar la curación** (nuevo): la **Herida maldita** (un golpe: necrófago, huargo, sabueso infernal, bestia de sangre, caballero de la muerte, demonios, Cancerbero, la Ira y el Balrog) y la **Maldición de sangre** (un hechizo: nigromante, bruja, banshee, Lich, sacerdote profundo, cultista, heraldo del vacío, noble vampira, la Envidia, la Reina de las Sombras y Satanás). Si no resistís, durante 3 turnos te curás la mitad (pociones, hechizos y sangre).

### Equilibrio que quedó abierto en la v3.14
- El **respiro al ganar** (solo magos e híbridos) sube: magos 25% e híbridos 30% (antes 15% los dos). Nadie más se cura con magia: el ángel, la dríade y el vampiro siguen siendo los únicos.
- El **gnomo** y el **alienígena** tienen un poco más de vida (−10 → −4 y −8 → −3).
- Grupo: la versión del grupo sube a 15 (las criaturas piensan y algunas huyen: los dos tienen que tener la misma).

### Equilibrio (`node tools/equilibrio.js --rapido`, con una poción por racha)
Guerrero / híbrido / mago:

| | nv3 | nv6 | par | nv10 | nv15 | nv20 | nv25 |
|---|---|---|---|---|---|---|---|
| v3.14 | 67 / 60 / 68 | 91 / 86 / 84 | 57 / 34 / 41 | 93 / 84 / 86 | 95 / 89 / 93 | 91 / 88 / 89 | 97 / 92 / 90 |
| v3.15 | 68 / 74 / 80 | 91 / 90 / 89 | 59 / 46 / 45 | 95 / 93 / 91 | 93 / 97 / 97 | 92 / 96 / 95 | 97 / 97 / 94 |

La prueba "de a dos" pasa (14 puntos entre clases; antes 23) y todas las distancias entre clases dan bien. El gnomo pasa de 63 a 88 en el nivel 3 y de 75 a 84 en el 10; el alienígena, de 60 a 82 y de 73 a 90. El ángel y la dríade siguen arriba en los niveles altos (100%), pero ahora hay criaturas que les cortan la curación. Quedan algunas razas más de 8 puntos abajo de su clase en "de a dos" (humano, gnomo, alienígena y hada) y el ángel en el nivel 3.
Contra grupos (`tools/hordas.js`) casi no cambia (±0 a 5 puntos). Contra jefes (`tools/jefes.js`) unos se hicieron más difíciles y otros más fáciles (los magos ganan más seguido); ninguno quedó imposible. `seed-jefes-medidos.js` está medido de nuevo.

### Pruebas viejas
Las pruebas `v33/engine/scroll_spells_test.js`, `v34/engine/classes_test.js`, `v39/engine/rules_test.js`, `v312_test` y `v313_test` no están en el repo: quedan para cuando estén.

## Versión 3.14.0: la magia es de tu raza, escuelas hasta el 25 y precios de verdad

### La magia es solo la de tu raza
- Los sabios (Velrith, Sylveth y Seren) **ya no enseñan** hechizos comunes (Chispa, Bola de fuego, Meteoro, Curación...).
- Los pergaminos se compran y se usan en la pelea, pero **ya no se aprenden**. Los Pergaminos de hechizo (Pergamino: Llama...) dejan de existir.
- Lo que ya habías aprendido se quita **una sola vez** al cargar la partida: si salió de un pergamino, te devuelven el pergamino; si te lo enseñó un sabio, lo que pagaste. Te avisa la crónica.
- Curarse con magia es de pocas razas: el **ángel** (nace con Manos de luz) y la **dríade** (Bálsamo de savia); el **vampiro** se cura chupando sangre. Los demás, con pociones.
- Al ganar una pelea, magos e híbridos recuperan el 15% de su vida (un respiro): reemplaza a la Curación y al Segundo aliento que tenían todos.
- Los hechizos de nacimiento crecen con vos (el dado sube en los niveles 5, 9, 13 y 17).

### Escuelas hasta el nivel 25
Cuatro poderes más por raza (48 hechizos y 24 técnicas): en el **13 y el 21** te los enseña tu maestro (se pagan); en el **17 y el 25**, con una prueba (36 misiones nuevas). Los magos tienen los hechizos grandes que antes daban los sabios; los híbridos, mejoras y hechizos medianos; los guerreros, técnicas.
Los maestros del humano y del ángel se mudaron del Pueblo Inicial a la **Torre del Mago**.

### Calamar, tentáculos, mapa y fondos
- El "Tentáculo" del mar abierto ahora se llama **Calamar** (y ya no suelta madera ni raíces, sino tinta). Los **Tentáculos del Kraken** tienen dibujo propio: un brazo que sale del agua y se enrosca.
- El mapa llena **todo el alto** de la pantalla (antes era una franja): arranca centrado donde estás y se arrastra para los costados.
- En las tiendas (alquimia, forja y las demás), la ficha del costado ya no se corta abajo: si es más alta que la pantalla, baja sola y el botón siempre se ve.
- **Fondos de pelea** según el lugar: bosque, bosque oscuro o de sangre, campo, cueva, cripta, noche, pantano, costa, abismo, montaña, desierto, ruinas, torre arcana, volcán, infierno, sueño, cielo y espacio.

### Jefes contra mascotas
Un jefe que pelea contra una mascota tiene **50% más de vida y pega 15% más** (por cada mascota) y lo avisa al empezar. Medido: con una kitsune, un ángel de nivel 9 le ganaba al Archimago el 85% de las veces (solo, 34%); ahora 63%.

### Precios
Las tiendas cobran más que lo que vale cada cosa (vender sigue dando la mitad del valor): equipo ×4, materiales ×3, pergaminos y comida ×2,5, pociones ×2. Las lecciones de la escuela también, como el equipo. Medido con lo que gana un jugador por nivel (peleas, escenas y misiones): un arma común de tu nivel costaba el 8% de lo que ganás en un nivel; ahora, un tercio.

### Equilibrio (`node tools/equilibrio.js --rapido`, con una poción por racha)
Desde esta versión las rachas arrancan con **una poción de curación de su nivel** (todos se curan con pociones; `--sin-pociones` mide como antes). Guerrero / híbrido / mago:

| | nv6 | nv10 | nv15 | nv20 | nv25 |
|---|---|---|---|---|---|
| v3.13 | 91 / 86 / 88 | 93 / 92 / 91 | 96 / 93 / 92 | 90 / 92 / 91 | 94 / 95 / 92 |
| v3.14 | 91 / 86 / 84 | 93 / 84 / 86 | 95 / 89 / 93 | 91 / 88 / 89 | 97 / 92 / 90 |

El ángel y la dríade quedan arriba (se curan); el gnomo y el alienígena, abajo (dependen de las pociones).

## Versión 3.13.0: las escuelas de raza, un mundo con sentido y topes en la mochila

### Escuelas de raza (lo que faltaba del dossier, secciones 7 a 9)

Cada raza tiene su escuela con tres poderes: el de **nacimiento** (el que ya tenía), uno de **nivel 5** y
uno de **nivel 9**. Los magos y los híbridos aprenden hechizos (12 escuelas de magia); los guerreros,
técnicas que no gastan maná (6 disciplinas).

- **Nivel 5:** lo enseña el **maestro de tu raza** (se paga como un hechizo de nivel 5).
- **Nivel 9:** el maestro te pone **una prueba** (una misión); cuando la entregás, te lo enseña.
- Cada jugador ve **solo a su maestro** (en grupo, cada uno ve al suyo). Los maestros viven en pueblos a los
  que se llega antes del nivel 5 y se dibujan como un héroe de su raza.
- En *Tus hechizos* (o *Tus técnicas*, para los guerreros) aparece **Tu escuela**: los tres poderes, cuáles
  tenés y dónde está tu maestro. Al llegar al nivel 5 y al 9 sale un aviso.
- Los personajes que ya existían no pierden nada: les sale un aviso (una sola vez) de que su maestro los espera.
- Los hechizos de escuela **crecen con vos** (el dado sube a los niveles 13 y 17), solo los aprende su raza y
  ningún pergamino ni otro maestro los enseña. Ninguno cuesta 0 de maná.
- **Hechizos rápidos:** las mejoras de escuela no gastan tu turno (después atacás o lanzás otro); uno por turno.
- **Técnicas de guerrero:** ocupan tu ataque del turno, no gastan maná y quedan en espera unos turnos. Nunca se
  suman al Golpe fuerte. En la pelea, el botón **Técnicas** las muestra todas con su espera.

| Raza | Escuela | Nivel 5 | Nivel 9 | Maestro (pueblo) |
|---|---|---|---|---|
| Humano | Arcanismo adaptable | Sello de duelo | Resonancia arcana | Aldric el Duelista (Pueblo Inicial) |
| Elfo | Magia lunar | Velo de luna | Lluvia lunar | Ilyana Velo de Plata (Torre del Mago) |
| Mediano | Magia de fortuna | Paso afortunado | Destino favorable | Tía Pippa Buenaventura (Aldea de los Faroles) |
| Dracónido | Magia dracónica | Escamas ardientes | Furia de dragón | Vharax Escamabrasa (Piedrahonda) |
| Vampiro | Hemomancia | Pacto carmesí | Niebla de sangre | Lady Morwen (Aldea de los Faroles) |
| Elfo oscuro | Magia sombría | Maldición de penumbra | Eclipse arcano | Szarith Sombra Quieta (Puerto Calavera) |
| Gnomo | Tecnomancia eléctrica | Circuito arcano | Tormenta conductora | Fizzi Tuercaloca (Puerto) |
| Alienígena | Psiónica y plasma | Campo gravitatorio | Señal orbital mayor | Xo'ren el Observador (Torre del Mago) |
| Infernal | Magia infernal | Sello de cenizas | Lluvia de azufre | Ceniza (Puerto Calavera) |
| Ángel | Magia celestial | Voto protector | Santuario luminoso | Sor Celestine (Pueblo Inicial) |
| Hada | Magia feérica | Bruma encantada | Sueño compartido | Brizna (Santuario del Roble) |
| Dríade | Magia natural | Raíces protectoras | Bosque despierto | Madre Sauce (Santuario del Roble) |
| Enano | Bastión pétreo | Muralla de piedra | Fortaleza ancestral | Borin Escudohondo (Piedrahonda) |
| Orco | Furia de guerra | Clamor salvaje | Horda imparable | Grumak Colmillo Roto (Puerto) |
| Robot | Tecnología de combate | Campo electromagnético | Protocolo de asalto | Unidad K-7 (Puerto) |
| Goliat | Fuerza titánica | Onda de impacto | Ruptura de terreno | Kaya Rompemontes (Piedrahonda) |
| Minotauro | Embestidas | Rompelíneas | Tormenta de cuernos | Varg el Toro (Puerto Calavera) |
| Licántropo | Artes de manada | Rastro de presa | Cacería lunar | Fenrik Pelo Gris (Santuario del Roble) |

Reglas que pedía el dossier: las marcas del humano y del licántropo son **personales** (ni la mascota ni los
compañeros las usan); la señal del alienígena es cooperativa (todo el grupo pega más fácil); dos ángeles **no
suman** su Voto ni su Santuario (vale el más fuerte); los jefes **no se duermen** ni pierden el turno con las
brumas y raíces; la Niebla de sangre solo cura al vampiro; las quemaduras se renuevan, no se suman.

### Un mundo con sentido: cada guarida sale de una zona de su nivel

Había jefes de nivel 14 a 20 colgando de zonas de nivel 3 a 10. Ahora ninguna guarida sale de una zona
más de 3 niveles abajo de su jefe:

- **Ysera (19):** zona nueva, el **Linde del Sueño** (17-19), en las Tierras Altas (sale de las Ruinas
  Celestes y del Desierto de Cristal). Ya no está pegada al Bosque de los Sueños (5-6). Criaturas nuevas:
  Pesadilla esmeralda, Durmiente, Hada de la pesadilla, Árbol soñador y Dragón esmeralda.
- **Aurelion Sol (19) y Alamuerte (20):** zona nueva, los **Picos del Dragón** (17-20), arriba del Nido de
  Dragones (sale del Bosque Petrificado). Criaturas: Guiverno ancestral, Dracónido de élite, Gran sacerdote
  del dragón y los dragones viejos.
- **La Hidra (14)** vive ahora en la **Ciénaga Primordial** (13-15), no en el Pantano (3-4).
- **El Titán (19)** se sentó junto a la **Cumbre del Mundo** (18-20), no en los Picos Helados (5-8).
- **Volibear (18)** se alcanza desde el **Abismo de las Sombras** (16-18).
- **La Tarrasca (10)** también desde el **Volcán** (8-9).
- **El Demonio mayor baja a nivel 11**: su círculo está en el Fondo del Volcán (7-10) y lo que suelta es de
  nivel 9 y 10. El demonio común de nivel 17 se llama ahora *Engendro de las sombras*.

### Topes en la mochila

Cada objeto tiene un máximo (antes casi todo llegaba a 99). Lo que sobra **no se pierde: se vende solo**
(a la mitad de su valor) y sale un aviso. La tienda no te vende más si ya llevás el máximo, la forja no
fabrica de más y la ficha de cada objeto dice "Tenés X de N". Lo que ya tenías por encima del tope se queda.

| Qué | Tope |
|---|---|
| Pociones de curar y maná | menores 10 · normales 8 · mayores 5 · supremas y divinas 3 |
| Elixires | de vida 2 · eterno 1 · hierba de la vida 3 |
| Pociones de mejora | según su rareza: 8 (poco comunes) o 5 (raras) |
| Pergaminos de combate | comunes 5 · poco comunes 4 · raros 3 · épicos 2 · legendarios 1 (de escape: 3) |
| Pergaminos que enseñan un hechizo | 2 (los raros, 1) |
| Comida | comunes 20 · poco comunes 12 · raras 8 |
| Materiales | comunes 40 · poco comunes 25 · raros 15 · épicos 8 · legendarios 4 (siempre alcanzan para dos veces la receta que más pide) |
| Llaves y cebos | llaves 5 (las raras 3, la dorada 2) · cebos 10 |

### Economía: que el valor de cada cosa tenga sentido

- **La rareza vale más.** Una poco común vale 1,4 veces una común de su nivel; una rara, 2; una épica, 3,2; y una
  legendaria, 5,5 (antes 1,3 · 1,7 · 2,5 · 4). Se nota al comprar y al vender equipo de cualquier nivel:
  una legendaria de nivel 10 pasó de unos 3.000 a unos 4.000 de cobre.
- **Las pociones valen según el nivel para el que sirven** (unas 5 peleas de ese nivel): la de curación normal
  pasó de 31 a 38, la mayor de 62 a 168, el elixir de vida de 190 a 567. Las menores siguen igual.

### Equilibrio (`node tools/equilibrio.js --rapido`, % de rachas ganadas: guerrero / híbrido / mago)

| | nv10 | nv15 | nv20 | nv25 |
|---|---|---|---|---|
| Antes (v3.12) | 75 / 85 / 80 | 75 / 80 / 80 | 64 / 73 / 76 | 73 / 77 / 81 |
| Con las escuelas | 85 / 84 / 82 | 82 / 83 / 82 | 79 / 83 / 82 | 80 / 84 / 81 |

La distancia entre clases bajó (en el nivel 20 era de 13 puntos; ahora es de 4). El simulador usa las escuelas
como lo haría una persona (las mejoras al empezar una pelea larga, las técnicas cuando conviene más que un
golpe); con `SIN_ESCUELAS=1` se mide sin ellas. Para medir: `node tools/equilibrio.js --rapido`.

### Pruebas

`v313_test.js` (146 pruebas): las 18 escuelas y sus maestros, aprender en el 5 y con la prueba en el 9, cada
hechizo y cada técnica en la pelea, los rápidos, peleas enteras de cada raza en los niveles 9 y 20, el aviso
para personajes viejos, las guaridas, los topes y la economía.

## Versión 3.12.0: el Cielo, el Espacio y el Infierno profundo (hasta el nivel 25)

**El tope sube a 25.** Al este de las Tierras Altas hay tres reinos nuevos, sin pueblos: todo lo que vive ahí es enemigo.
Ninguno es "el jefe final": el juego va a seguir creciendo.

| Reino | Se llega desde | Lugares (nivel) | Quién vive ahí | Jefe (nivel 25) |
|---|---|---|---|---|
| **El Cielo** | Cumbre del Mundo | Puertas del Cielo (21-22) · Salones de la Luz (23-24) · El Empíreo (24-25) | Los nueve coros, en sus tres jerarquías: Ángeles, Arcángeles y Principados; Potestades, Virtudes y Dominaciones; Tronos, Querubines y Serafines | **Dios**, en la Cuna del Sol: un bebé con todo el poder del sol. No "cae": si lo aguantás, te aprueba |
| **El Espacio** | Cumbre del Mundo | Camino de las Estrellas (21-22) · La Luna Rota (22-24) · La Nave Nodriza (24-25) | Alienígenas grises, drones, medusas estelares, larvas y soldados de la colmena, el cazador estelar, gusanos lunares, robots centinela y el comandante gris | **La Mente Colmena**, en el Núcleo de la Colmena |
| **El Infierno profundo** | El Fin del Mundo | Río Estigia (21-22) · Círculo de los Pecados (22-24) · Ciudad de Dite (24-25) | El Cancerbero (tres cabezas), el barquero del Estigia y los siete pecados (pereza, gula, avaricia, envidia, lujuria, ira y soberbia) | **Satanás**, en su trono |

- **En el mapa**: el mundo es más ancho; los tres reinos se ven pintados (cielo claro con nubes, espacio negro con
  estrellas, infierno rojo con brasas) y cada uno con su nombre. En el Espacio los caminos van en tinta clara.
- **Jefes en su forma suprema**: en su guarida, un jefe sale **dorado** una de cada diez veces ("Satanás supremo",
  "La Mente Colmena suprema"): más vida, más daño y mejor botín. La ficha de la guarida lo avisa. Las élites comunes
  también se ven doradas, con los ojos rojos.

### Ysera, la dragona del Sueño Esmeralda (nivel 19)

- **Ysera**: la dragona verde más antigua, Aspecto de los sueños, a quien la titán Eonar le dio poder para velar por la
  naturaleza y cuidar el Sueño Esmeralda. Vive en **El Sueño Esmeralda**, una guarida nueva al lado del Bosque de los Sueños.
- Su **Aliento del sueño** (niebla verde: daño a todos y a veces te duerme un turno), su polvo de sueño, su coletazo y su
  regeneración; cuando la apurás, **llama a Alafeliz** (en grupo también viene una sola: Alafeliz hay una).
- Suelta flores del sueño, escamas ancestrales, sangre de dragón, a veces un Elixir de vida y el **Báculo del Sueño Esmeralda**
  (bastón legendario de mago). Alamuerte sigue siendo el más fuerte de los dragones.

### Volibear, Aurelion Sol y el dragón anciano

- **Volibear** (nivel 18): Valhir, la Tormenta Implacable, un semidiós antiguo del Norte, de la guerra y la tormenta, con
  forma de oso blanco gigante. Vive en la **Cumbre de la Tormenta**, una guarida nueva arriba de la Tundra Eterna. Lo cubre un
  **escudo de rayos** (frena los primeros golpes y hechizos hasta romperse), tira **Rompecielos** (un rayo que a veces te
  electriza), aturde, muerde y, cuanto más lo lastimás, más fuerte pega. Suelta la **Piel de Valhir** (armadura legendaria).
- **Aurelion Sol** (nivel 19): el dragón celestial que forja estrellas, azul de noche con corona de oro. Vive en la
  **Cima Estelar** (la vieja cima del dragón anciano, sobre el Nido de Dragones). Su **Caída del cielo** hace llover
  estrellas (daño a todos y a veces te tira al suelo); también escupe fuego y da coletazos. Suelta la **Hoja de las
  Estrellas** (espada legendaria que a veces prende fuego). Alamuerte sigue siendo el más fuerte de los dragones.
- **El dragón anciano ya no es jefe**: ahora es una criatura fuerte de nivel 19 que caza en la Cumbre del Mundo.
  La misión principal *La sombra del dragón* ahora es contra **Alamuerte** (nivel 20; 4.000 de XP y 25.000 monedas).
  Si la tenías empezada, ahora te pide a Alamuerte.
- **Fondo del Volcán**: la zona pegada al Volcán que se llamaba "Infierno" ahora se llama así, para no confundirla con el
  Infierno profundo.
- **El mamut** ya no parece un oso: tiene trompa, colmillos y pelo largo.

### Arreglos en grupo

- **La manada de huargos**: con "Llamar a la manada" llegaban dos lobos por cada huargo, más uno por cada héroe de más
  (en pareja, la pelea se llenaba de huargos jóvenes). Ahora llega **uno solo**, una sola vez por pelea para toda la manada,
  más chico y **más flojo** (pega un 20% menos), y ese no puede llamar a otros.
- **Dar la vuelta en el camino**: en grupo, el invitado solo veía "Avanzar". Ahora cualquiera del grupo puede **dar la vuelta**
  (o seguir hacia el destino) a mitad de camino, como el anfitrión.

### Zonas que estaban vacías

| Zona | Antes | Ahora |
|---|---|---|
| Abismo Marino | solo el contemplador | Pez abisal, Medusa abisal, Calamar gigante, Cangrejo abisal, Sacerdote profundo (y la serpiente marina baja) |
| Fondo del Volcán (antes "Infierno") | solo el caballero de la muerte | Sabueso infernal, Alma condenada, Demonio menor, Torturador (y el súcubo se muda acá) |
| Nido de Dragones | 2 criaturas | Cultista del dragón, Dragón rojo (y el dragón joven vuelve) |
| Pantano | — | Fuego fatuo (de noche), Sanguijuela gigante |
| Puerto | águilas | Gaviota ladrona |
| Catacumbas | — | Momia real (llama a sus momias) |
| Cumbre del Mundo / Fin del Mundo | 3 criaturas cada una | Elemental del rayo / Eco del vacío |

Se mudaron las que no tenían nada que ver: el contemplador queda en las Ruinas Perdidas, el caballero de la muerte en las
Catacumbas y la Fortaleza Caída, el gólem en las Cuevas Ancestrales, el gólem de lava en el Volcán, el súcubo al Fondo del Volcán
y el necrófago a las Ruinas de Antorcha, con los nigromantes (sube al nivel 5). El Puerto ya no tiene águilas.

### Habilidades nuevas de las criaturas

- **Sumergirse** (Calamar gigante): después de atacar se hunde y no se le puede pegar hasta su próximo turno (si queda sola, no puede).
- **Estallido** (Demonio menor, Fuego fatuo, Medusa estelar, Elemental del rayo): al caer explota y les pega a todos. Nunca mata: te deja con 1.
- **Dividirse** (Larva de la colmena, Eco del vacío): la primera vez que cae se parte en dos, cada una con un tercio de su vida.
- **Escudo de fe / Campo de fuerza / Escudo de monedas / Escudo de rayos**: frenan el daño de los primeros golpes y hechizos hasta romperse.
- **Regeneración divina** (Virtud, Dios): se cura cada turno y el fuego no la frena (con tope por pelea).
- **Sanar** (Principado, Virtud, Sacerdote profundo, Cultista del dragón): cura al más herido de los suyos.
- **Gracia del sol** (Serafín, Dios), **Juicio**, **Fuego del infierno**, **Pacto de sangre** (se queda con un tercio del daño),
  **Telepatía** (miedo), **Abducción**, **Rayo desintegrador** y **Bostezo** (la pereza te duerme un turno).

### Equipo, hechizos y pociones del 21 al 25

- **Estelar** (21, épico): se vende en el Bastión del Alba. **Del crepúsculo** (23) y **eterno** (25): se forjan con
  luz sagrada (Cielo), hierro infernal (Infierno) y metal estelar (Espacio); lo eterno, además, con esencia del vacío.
- Seren enseña **Lanza de luz** (21), **Lluvia de estrellas** (22), **Curación divina** (23), **Llamas del infierno** (24)
  y **Singularidad** (25). En el Bastión hay **pociones divinas** de vida y de maná; el **Elixir eterno** se prepara o lo sueltan los jefes.
- Lo de los jefes: Crematoria y el Manto del sol (Dios), el Tridente infernal y la Coraza infernal (Satanás),
  el Bastón de la colmena y el Traje de la colmena (la Mente Colmena).

### Tres armas legendarias

| Arma | Nivel | Quién la suelta | Lo suyo |
|---|---|---|---|
| **Agonía de Escarcha** | 15 | Rey de la Escarcha | Congela, y te devuelve como vida el 15% del daño que hacés |
| **Martillo Maldito** | 20 | Titán | Electriza, y al pegar un rayo salta a otra criatura (10 de daño) |
| **Crematoria** | 25 | Dios | Prende fuego, y hace +8 de daño contra no muertos y demonios |

La tienda, el taller y la ficha del arma lo dicen en "Qué te da".

### Economía

- **Monedas**: hasta el nivel 10, igual que antes; arriba del 10 suben más despacio (×1,2 por nivel en vez de ×1,45).
  El equipo y los hechizos siguen la misma curva, así que cada arma cuesta lo mismo en peleas en cualquier nivel.
- **Botín**: las partes de criaturas valen según el nivel de la criatura más fácil que las suelta (nunca bajan). Los
  materiales comunes que se venden o se usan desde el principio (metales, gemas, telas, cueros) no cambian.
- Los materiales de los reinos valen mucho (metal estelar 1.200, esencia de pecado 1.500, luz sagrada y hierro infernal 2.500).

### Editor

- El mapa del editor tiene el mismo tamaño que el del juego (el pergamino ya no se corta donde terminaba el reino viejo),
  con las Tierras Altas y los tres reinos marcados, y los nombres no se pisan (ni entre ellos ni con el nivel de cada lugar).
  Las guaridas se ven con su jefe.
- Los filtros y campos de nivel llegan hasta el 25 (antes, hasta el 10). Familias y rasgos nuevos con su nombre.
- El dibujo de una criatura puede copiar a una raza de los héroes ("Como la raza: Ángel").

### Equilibrio

- **La IA del simulador** intentaba lanzar hechizos aunque estuviera silenciada, y la pelea no terminaba: los magos
  aparecían perdiendo contra el Heraldo del vacío. Corregido: medido de verdad, los magos del 15 al 25 ganaban mucho
  más que las otras clases (encadenaban peleas sin cansarse). Por eso, **el maná por turno de los magos deja de crecer
  en el nivel 16** (llega a 4; el maná máximo sigue creciendo) y **desde el nivel 13 recuperan la mitad de maná al ganar**
  (10% del máximo en vez de 20%).
- Medido con `node tools/equilibrio.js --rapido` (guerrero / híbrido / mago, rachas de 5 peleas): nivel 10: 75 / 85 / 80 ·
  nivel 15: 75 / 80 / 80 · nivel 20: 73 / 81 / 82 · **nivel 25: 73 / 77 / 81** (todas las distancias entre clases, dentro de lo pedido).
  Las criaturas nuevas del 9-10 y del 19 se midieron una por una y se bajaron las que se pasaban (Torturador, Dragón rojo,
  Sacerdote profundo, Elemental del rayo, Eco del vacío), igual que las más duras del 24-25 (Serafín, Querubín, Dominación…).
- Jefes con `node tools/jefes.js` (guerrero / híbrido / mago, solos, a su nivel): Dios 55 / 10 / 18 · Satanás 52 / 17 / 25 ·
  La Mente Colmena 35 / 17 / 33 · Ysera 57 / 28 / 28 · Volibear 67 / 28 / 50 · Aurelion Sol 53 / 23 / 33
  (Alamuerte, para comparar: 47 / 10 / 20). Lo medido está en
  `js/data/seed-jefes-medidos.js` y lo muestra el editor.
- En pareja (orco + humano, sin pociones): Dios 28%, Satanás 35%, la Mente Colmena 45%, Ysera 28%, Volibear 68%,
  Aurelion Sol 32% (el Devorador de Mundos: 35%; Alamuerte: 8%).
- **Las dos computadoras tienen que actualizar** (el grupo pide la misma versión).

## Versión 3.11.5: ningún jefe con una versión común más fuerte

Un jefe ya no tiene una versión común con más nivel. Sus guaridas siguen donde estaban (el mapa avisa el nivel nuevo):

| Jefe | Antes | Ahora | Su versión común |
|---|---|---|---|
| Hidra | 9 | **14** | Hidra primordial: 13 |
| Demonio mayor | 9 | **18** | Demonio de las sombras: 17 (era 18) |
| Dragón anciano | 10 | **19** | Dragón de la tormenta: 18 (era 19); Alamuerte sigue arriba, en el 20 |
| Titán | 10 | **19** | Titán celeste: 18 (era 19) |

- Sus números salen de la curva de jefes de su nivel, con mejor botín (escamas ancestrales, esencias, cristal astral, oricalco). El Dragón anciano suma Cuerpo de fuego y Aguante, pero sigue por debajo de Alamuerte.
- Medido con `node tools/jefes.js` (guerrero / híbrido / mago, solos; su nivel · dos niveles más): Hidra 65/13/40 · 100/70/100; Demonio mayor 63/28/63 · 88/68/65; Dragón anciano 43/23/45 · 53/33/53 (en el 20); Titán 68/45/73 · 83/57/78 (en el 20).
- **La historia**: la última misión (el Dragón anciano) ahora es para nivel 19: la misión lo dice y da 3.500 de experiencia y 20.000 de cobre (antes 1.000 y 1.000). **El colmillo de la hidra** se ofrece desde el nivel 13 y paga 3.500 de cobre, 450 de experiencia y pociones de maná supremas.

## Versión 3.11.4: la Hidra primordial

- La **"Hidra joven"** de la Ciénaga Primordial (nivel 13) tenía más nivel que la Hidra del Pantano (nivel 9, jefa). Ahora se llama **Hidra primordial**: una hidra más vieja y más grande que la del Pantano, con otros colores. Mismos números, mismo lugar; las partidas guardadas no cambian.

## Versión 3.11.3: Alamuerte, el más fuerte de todos los dragones

- **Alamuerte pasa al nivel 20** (era 10, como el dragón anciano): más vida, daño y nivel que cualquier otro dragón del juego. Su guarida sigue al lado del Nido de Dragones; el mapa avisa que es para nivel 20.
- **Placas de adamantita** (pasiva nueva): mientras le quede más de la mitad de la vida, sus placas le sacan 4 a cada golpe de arma (la magia entra entera). Con la mitad de la vida se le caen y se enfurece.
- **Cataclismo** (activa nueva): parte la tierra en dos y todo arde: daño a todos (con agilidad se recibe la mitad) y fuego por tres turnos. Además sigue con su aliento de fuego, el coletazo y el rugido, y **llama a un dragón de la tormenta** (uno más por cada héroe de más).
- Mejor botín: escamas ancestrales, sangre de dragón, oricalco, ambrosía y una chance de Gungnir.
- Medido en el nivel 20 con `node tools/jefes.js` (guerrero / híbrido / mago, solos): 33 / 8 / 50% (el Devorador de Mundos: 48 / 20 / 50%). En pareja y sin pociones (`tools/grupo.js`): 10 a 17% (el Devorador: 37%). Antes, a dos niveles más, se le ganaba 53 a 77%.

## Versión 3.11.2: en grupo, lo que aparece en el camino lo deciden todos

- Cuando aparece una criatura en el camino, **todos ven los botones** (Pelear, Evitar y Domar si pueden) y **votan**, como en las escenas: si votan lo mismo, se hace; si no, gana lo más votado, y si empatan cada uno tira un D20 y gana el más alto. Antes decidía solo el que armó el grupo.
- Se ve quién votó qué ("Juan ya votó. Te toca elegir", "Esperando a Fabri…") y se puede cambiar el voto. Si alguien no está, a los 20 segundos aparece **"Decidir sin esperar"**.
- **Evitar** lo intenta el que tiene más chance de los que lo votaron; si sale bien, pasan todos sin pelear. **Domar** lo intenta el que tiene más chance (en grupo solo aparece si tenés lo que pide).
- La bitácora del viaje cuenta cómo se decidió ("Votaron distinto: Fabri sacó 9 y Juan 2. Ganó pelear").
- Solo, todo sigue igual. La lógica vive en `js/systems/travel.js` (`Travel.decide`).
- Versión de grupo **11**: los dos tienen que actualizar.

## Versión 3.11.1: Alafeliz y un mapa sin nombres encimados

- **Alafeliz** (antes "Brightwing"): ahora es una **mini jefa** del Sueño Esmeralda. Ya no está en el Desierto: se asoma de vez en cuando al **Bosque de los Sueños**, sola y nunca como élite. Es una dragona feérica (más chica y con colores de hada) que se vuelve humo (Ilusiones), duerme con su polvo de hada, lanza magia y se cura. Más vida (110) y daño (2d8+4), el doble de monedas, más botín (polvo de hada, esencia, escamas) y 2,5 veces la experiencia. En combate y en las fichas dice **"Mini jefe"**. Medido 1 contra 1 (orco / humano / gnomo): a su nivel se le gana 75 / 66 / 69%; con dos niveles más, 99-100%.
- En el Desierto, en su lugar, el **Escorpión gigante** (nivel 6).
- **Mapa**: los nombres ya no se pisan. Cada nombre (con su "Nivel N") prueba varios lados alrededor de su lugar y se queda con el que no tapa a otros nombres ni a otros lugares; las guaridas, con el nombre más cerca. Probado con todo el mapa descubierto y con una letra más ancha: ningún nombre encima de otro. El Altar de Cthulhu se movió un poco más arriba (abajo no entraba).
- La prueba de combate del editor no cuenta a la mini jefa entre las criaturas fuertes.

## Versión 3.11.0: guaridas de jefes, altares y las Tierras Altas (hasta el nivel 20)

### Jefes
- **Cada jefe en su guarida** (22 lugares nuevos, al lado de su zona): en el mapa se ven con el dibujo del jefe y una corona. Adentro no hay otras criaturas: ves al jefe (qué hace y su nivel) y lo desafiás. Si le ganás, vuelve al día siguiente del juego. En grupo desafía el anfitrión. Los jefes ya no aparecen sueltos por las zonas (`js/systems/lairs.js`).
- **Altares**: a cuatro jefes se los **invoca** poniendo objetos en su altar (se gastan): **Cthulhu** (Ídolo de R'lyeh + 3 perlas), **el Lich** (Filacteria rota + 3 cráneos; la condesa de Velmora te da la filacteria en la historia), **el Demonio mayor** (Sello infernal + 2 cuernos de demonio) y **el Devorador de Mundos** (los cuatro sellos de los jefes de las Tierras Altas).
- **Torre del Archimago** (entre la Torre del Mago y las Ruinas Perdidas): el Archimago ya no está en el Abismo Marino, y llama a dos aprendices renegados.
- **Kraken**: sale con **8 tentáculos** (2 más por cada héroe de más) y se queda **bajo el agua** —no se le puede pegar ni apuntar— hasta que caen todos.
- **Hidra**: **tres cabezas**, tres mordidas por turno (cada una a un héroe al azar).
- **Más fuertes**: solos, +30% de vida y +12% de daño (antes +15% y +5%) y +25% enfurecidos; en pareja ×2,1 de vida y ×1,4 de daño. La Kitsune tiene más vida y daño (en el editor daba 99% porque la prueba no veía sus invocaciones ni sus colas). También el Lich, el Demonio mayor, el Leviatán y el Ent.
- **Editor, prueba de combate**: ahora cuenta lo que hacen las criaturas con las mismas cuentas del juego (invocaciones, tentáculos, tres cabezas, colas, ilusiones, piel gruesa, caparazón, regeneración, curarse, renacer, espinas, la furia y el daño extra de los jefes). En cada jefe muestra además **lo medido con el motor del juego** (con pociones, hechizos y técnicas): `node tools/jefes.js --datos` lo actualiza (`js/data/seed-jefes-medidos.js`); si le cambiás los números a un jefe, avisa que hay que medirlo de nuevo.
- **8 jefes nuevos** (22 en total): Rey Goblin (nivel 3, Minas Olvidadas), Reina Araña (5, Montañas), Ent Anciano (6, Bosque de los Sueños), Fénix Ancestral (12), Rey de la Escarcha (14), Gólem Primordial (16), Reina de las Sombras (18) y el Devorador de Mundos (20).
- Las misiones de jefes dicen dónde está cada guarida.

Medido con `node tools/jefes.js` (% que gana un guerrero / híbrido / mago solo):

| Jefe | Su nivel | +2 niveles |
|---|---|---|
| Rey Goblin (3) | 50 / 22 / 23 | 100 / 98 / 97 |
| Reina Araña (5) | 33 / 18 / 47 | 92 / 92 / 80 |
| Kitsune (7) | 7 / 2 / 7 | 80 / 82 / 80 |
| Hidra (9) | 73 / 3 / 17 | 93 / 48 / 70 |
| Lich (9) | 55 / 48 / 48 | 88 / 87 / 73 |
| Kraken (10) | 8 / 20 / 25 | 82 / 87 / 90 |
| Alamuerte (10) | 27 / 2 / 2 | 77 / 53 / 57 |
| Fénix Ancestral (12) | 28 / 10 / 12 | 75 / 33 / 72 |
| Devorador de Mundos (20) | 42 / 20 / 47 | — (no hay nivel 22) |

En pareja (`node tools/grupo.js`, orco + gnomo, su nivel / +2): Kraken 37 / 87%, Hidra 20 / 77%, Archimago 27 / 67%, Lich 47 / 90%.

### Tierras Altas: niveles 11 a 20
- **Tope de nivel 20** para jugadores y criaturas (antes 10). La experiencia sube más despacio: del 10 al 11 pide 8.500 y del 19 al 20, 38.500.
- **10 lugares nuevos** al este del mapa: Paso de la Bruma, **Bastión del Alba** (pueblo: Brunhild la herrera, Seren la sabia y Odo el posadero), Bosque Petrificado, Tundra Eterna, Ciénaga Primordial, Ruinas Celestes, Desierto de Cristal, Abismo de las Sombras, Cumbre del Mundo y El Fin del Mundo.
- **34 criaturas nuevas** (nivel 10 a 20), **27 armas y 11 armaduras** (de oricalco, astrales, del alba y 6 legendarias de los jefes), **6 hechizos** que enseña la sabia (Rayo estelar, Meteoro, Curación suprema, Juicio divino, Ventisca eterna, Tormenta del vacío), pociones supremas, el Elixir de vida, materiales y recetas.
- Las pasivas suben en **5 tramos de nivel**: 1-4, 5-8, 9-12, 13-16 y 17-20.

### Razas: dossier, parte 2 (todo medido)
- **Regla nueva: el crítico tiene que llegar.** Con 18 o 19 en el dado (Goliat, Elfo) solo es crítico si el golpe pasa la defensa; el 20 llega siempre.
- **Estados nuevos**: *Desequilibrado* (menos precisión en su próximo ataque) y *Expuesto* (menos defensa).

| Raza | Cambio |
|---|---|
| Enano | **Piel de roca por ronda**: los primeros golpes de cada ronda (1 a 3) te hacen 2 a 4 menos |
| Orco | **Instinto salvaje**: tu primer golpe que acierta en cada turno pega +1 a +3; si te hirieron desde tu turno anterior, +3 a +7 |
| Robot | **Núcleo de sobrecarga**: cada 2 golpes que aciertan, una descarga de +3 a +9 y 1 a 4 a otra criatura; +1 a +3 de armadura desde el 9 |
| Minotauro | **Embestida arrolladora**: tu primer golpe a cada criatura pega +4 a +8 y apunta mejor; cada golpe la desequilibra |
| Goliat | **Golpe de gigante**: +2 de precisión y el crítico suma +2 a +6 |
| Licántropo | El **Aullido** llama a un **lobo** que pelea a tu lado (las criaturas a veces lo atacan a él) |
| Elfo | **Ojo certero**: el crítico suma +1 a +3 desde el nivel 5 |
| Elfo oscuro | **Cazador de sombras**: envenena el 60% de las veces (1 a 3 por turno) y desde el nivel 5 pega +1/+2 aunque la criatura no tenga nada encima |
| Vampiro | El robo de vida deja de subir en el 13 (16% y 30% en Frenesí) |
| Alienígena | **Apoyo orbital**: con tu hechizo de daño, la nave nodriza bombardea a tu blanco (1d3 a 2d6) y a las demás (1 a 3); después espera 3 turnos. Un poco más de maná |
| Ángel | **Bendición divina**: al empezar cada ronda, una luz protege al más herido del grupo (frena 1 a 5, de 2 a 4 golpes por pelea) |
| Hada | **Polvo de hada**: además, una vez por ronda tu hechizo marea a su blanco (−1 a −3 de precisión; desde el 9, también menos defensa) |
| Infernal | **Llama interior**: +3 a +7 a un blanco (no más que tu nivel + 1) y +1 a +3 a cada una en área |
| Gnomo | **Ingenio**: además, los primeros hechizos de 5 o más de maná de cada pelea cuestan 1 o 2 menos |

Medido con `node tools/equilibrio.js` (rachas ganadas, promedio de cada clase):

| Clase | nv 1 | nv 3 | nv 6 | parejas | nv 10 | nv 15 | nv 20 |
|---|---|---|---|---|---|---|---|
| Guerreros | 52 (+6) | 51 (+2) | 83 | 24 | 88 | 74 | 81 |
| Híbridos | 29 | 42 | 82 | 26 | 88 (+3) | 76 | 82 |
| Magos | 38 (+3) | 51 | 83 | 29 | 85 (+4) | 73 | 73 |

(entre paréntesis, lo que cambió desde la v3.10). Las tres clases quedan a 1-10 puntos entre sí en todas las pruebas. Ninguna raza queda más de 8 puntos abajo de su clase, salvo el **Gnomo en el nivel 1** (−10; en el 3 está +16). Contra 5 criaturas los guerreros suben de 41 a 49% (nivel 5) y de 54 a 60% (nivel 10); los magos siguen en 74-87%.

### Herramientas
- `node tools/grupo.js` (nuevo): 2 a 4 héroes juntos con el motor de verdad.
- `equilibrio.js` mide también las rachas en los niveles 15 y 20, `hordas.js` contra 3 y 5 criaturas en el 15 y el 20, y `jefes.js` no pasa del 20.

### Grupo
- Versión de grupo **10**: los dos tienen que actualizar.

## Versión 3.10.0: talleres con ventana, jefes de verdad y caminos que se pueden desandar

### Objetos
- **Forja, encantamiento y alquimia como la tienda**: la lista a la izquierda y, a la derecha, la ventana del objeto: qué es, **qué te da** (en palabras simples y para tu clase), comparado con lo que tenés puesto, los materiales (con cuántos tenés) y el botón.
- **"Qué te da"** también en la tienda: daño con su rango y tu maestría, precisión, poder mágico del arma, maná, lo que deja al pegar, si te frena el peso, armadura, esquiva, inmunidades, lo que cura o alimenta y si tu raza lo come.
- **Ficha del objeto ordenada**: sin datos repetidos. Arriba nombre, rareza, nivel y números; después la descripción, "Qué te da", la comparación y "Para qué sirve".
- Las armas vuelven a mostrar el **maná máximo** que dan (sí se suma al ponértelas).
- El Amuleto de fuego dice que abre el Volcán.

### Mundo y viajes
- **Destinos nuevos**: Lago Espejo (nivel 4), Picos Helados (nivel 7) y Fortaleza Caída (nivel 8).
- **Criaturas en el camino** a Santuario del Roble, Aldea de Piedrahonda, Puerto, Puerto Calavera y Velmora (adentro siguen sin peleas).
- **El nivel de un lugar ya no te prohíbe ir**: el mapa avisa "Es para nivel 8 (vos sos 5): podés ir, pero las criaturas te pueden matar".
- **Dar la vuelta en el camino**: a mitad de viaje, "Dar la vuelta" te hace volver paso a paso (con lo que aparezca), y "Seguir hacia..." retoma el destino. Ya no se vuelve al origen de golpe.
- Si huís de una pelea en grupo, elegís **Seguir mirando** o **Volver**; desde el lugar, "Ver la pelea" te lleva de nuevo.
- Arreglado: en grupo, después de **Observar de lejos** se votaba solo la otra opción.

### Combate
- **Técnicas de nacimiento de los guerreros** (un botón, una vez por pelea): Guardia de piedra (Enano), Rugido de guerra (Orco), Aullido de manada (Licántropo), Pulso de interferencia (Robot), Barrido colosal (Goliat) y Cornada brutal (Minotauro). Las de mejora no gastan tu ataque.
- **Más golpes que aturden** desde el nivel 2: Cabezazo, Picadura paralizante y Calambre (siempre con tirada para resistir).
- **Jefes más duros**, solos y en grupo: +15% de vida y +5% de daño solos; en pareja ×2,3 de vida y ×1,45 de daño (antes ×1,9 y ×1,35), y más por cada héroe de más. Con la mitad de la vida **se enfurecen** (+20% de daño). Medido con `node tools/jefes.js`: antes se les ganaba el 85 a 100% de las veces en su mismo nivel; ahora, entre 40 y 90% según el jefe y la clase.
- **Invocaciones nuevas**: la Kitsune de nueve colas llama a **kitsunes de cinco colas** (dos si estás solo, tres con un compañero, una más por cada héroe de más). También Invocar a dos, Invocar a tres y Llamar a la manada (para el editor), y Terremoto para el Titán.
- La **hierba de la vida** despierta a tu mascota fuera de la pelea (desde la ficha o con el botón de curar de la mascota).

### Grupo
- Versión de grupo **9**: los dos tienen que actualizar.

## Versión 3.9.0: la gran actualización

Todo lo pedido del 21 al 25 de noviembre, más la auditoría del dossier de las 18 razas.

### Objetos, tiendas y misiones

- **Ficha de objeto ordenada**: arriba lo que hace; junto al nombre, si es MEJOR o PEOR que lo que tenés puesto; un recuadro "Comparado con lo tuyo"; abajo, en chiquito, rareza, nivel, peso y precio.
- **"Para qué sirve"** en cada objeto: en qué receta se usa, con qué se hace y quién lo hace, qué misión lo pide, si sirve para domar o lo come tu mascota, qué escena lo pide, o si solo sirve para vender (`js/systems/itemuses.js`).
- Las **recompensas de misión** muestran sus números y si te convienen; la **forja** también compara, y las recetas listas para hacer van primero.
- **79 recetas nuevas**: casi todo material sirve para algo. Las **llaves abren cofres** (se gastan) y la linterna y la cuerda sirven en algunas escenas.
- **Tiendas por secciones** (Armas, Armaduras, Accesorios, Mochilas, Pociones, Pergaminos, Comida, Herramientas, Materiales) con tarjetas más chicas. La comida se vende en las tabernas.
- **Varita rúnica** (herreros de Piedrahonda y del Puerto): +1 de poder mágico extra, para que un mago mejore antes de la Torre.
- **Plato caliente**: +10 de comida y 15% de vida por el 30% de lo que cuesta la cama.
- **La miel y las comidas que curan un número fijo ahora curan** (`rollDice` no leía "3").
- **Misiones de juntar**: mientras una misión pide algo, las criaturas que lo tienen salen más seguido, y se sumaron fuentes (rosas, perlas, colmillo de hidra). Medido con todas las misiones: las que pedían 34 a 40 peleas ahora piden 4 a 5.

### Combate

- **Armadura**: si tu armadura es igual o mayor que el daño de un golpe, lo para (antes siempre hacía 1). Un crítico hace al menos 1 y los hechizos siempre al menos 1. El detalle de la tirada lo explica.
- La **crónica** abre en la última ronda; la elección de hechizos muestra su **descripción**.
- **Dardo arcano** ya no es seguro: tira el dado como los demás hechizos. Al pegar deja una **marca** (ver Razas).
- **Curación** además limpia veneno, sangrado, fuego, frío y maldición. **Segundo aliento** cura más cuanto más herido estás (1d6+1 y el 15% de lo que te falta), cada 3 turnos.
- **Criaturas brillantes**: 1 de cada 200, con otros colores; dan el doble de XP, el triple de monedas y una gema. Si la domás, tu mascota es brillante.

### Mascotas

- **Vínculo con el dueño**: casi todas las especies dan algo mientras están despiertas y comidas (+1 de precisión, defensa, armadura, daño o velocidad, monedas, poder mágico o vida por ronda; se ve en la ficha).
- **Hambre**: sin comida no usan activas, no dan vínculo ni ganan XP, y pierden vida al viajar.
- **Domar** muestra la tirada de D20 contra la dificultad, con animación.
- Las pasivas de defensa de las mascotas (caparazón, escurridizo, espinas...) funcionan y se cuentan; sus activas siempre se nombran.

### Mundo, mapa y pantalla

- **Torre del Mago**: adentro no se pelea, pero el camino tiene criaturas (tipo de lugar nuevo, "Camino con criaturas", también en el editor). Criaturas nuevas: aprendiz renegado, chispa arcana y gólem de tinta.
- **Aldea de los Faroles**, al lado de la Torre: posada, comida y un buhonero.
- **Mapa**: cada lugar dice qué **se consigue** ahí (lo que sueltan las criaturas que ya viste y lo que se encuentra explorando); lo que pide una misión, marcado.
- La **pantalla del lugar** entra sin bajar desde 1366×657; en el celular, Explorar, Descansar y Viajar van en una fila y los habitantes de a dos.
- **Editor de mundo**: el mapa se aleja y acerca (botones y rueda) y se arrastra.

### Grupo (versión 8: los dos tienen que actualizar)

- Botón **"Separarme y viajar solo"** en el mapa.
- Todos pueden tocar **"Avanzar"** en el camino.
- Al entrar a un grupo **seguís donde estabas**; se juntan cuando están en el mismo lugar.
- Ventana de grupo reorganizada.

### Razas (dossier del 24/11, todo medido)

| Raza | Cambio | Medido |
|---|---|---|
| Vampiro | **Sed de sangre**: 12/14/16% de robo de vida; con 3 golpes que hacen daño, **Frenesí vampírico** 2 turnos: 20/25/30% y +1/+2/+3 | +4 a +11 puntos, dentro de las metas |
| Licántropo | **Sangre lunar**: 2 turnos en forma bestial (+1/+1/+2 de daño, 1/2/3 de vida con tope 4/6/8 por pelea) y 1 normal, desde el primer turno | En el promedio de los guerreros |
| Humano | El **Dardo arcano marca** al blanco: tu próximo golpe con arma le hace +1/+2/+3 (+1 de precisión desde el 9). Solo tuya | +1 a +2 |
| Elfo oscuro | Se queda **Cazador de sombras actual** (la versión gradual del dossier lo bajaba 11 a 14 puntos) | — |
| Goliat | +1 de precisión **desde el nivel 1** (antes desde el 5) | Del −9 al −5 en el nivel 1 |

Tramos de nivel del dossier: 1-4, 5-8 y 9-10. Los números viven en `js/systems/passives.js` (TUNE). El informe con todas las mediciones y las respuestas a las 12 preguntas está en el documento "Aventurs v3.9 — Auditoría de las 18 razas".

## Versión 3.8.0: cada criatura con su personalidad

**Dos kitsunes** en el Bosque de los Susurros:

- **Kitsune** (nivel 6, normal): nace con una cola y le crece otra en cada turno. Si la pelea se alarga y llega a nueve, despierta: el fuego de las colas y los ojos se vuelve azul, se cura un 20% y tiene +2 de defensa (pasa en 1 de cada 5 peleas a su nivel). Se doma solo con **Pan élfico** (comida rara: la vende Sylveth, la druida del Santuario del Roble).
- **Kitsune de nueve colas** (nivel 7, jefa): ya aparece con las nueve colas azules, despierta desde el principio. Tiene Ilusiones (tus dos primeros golpes le dan a una copia), Fuego de zorro, Encantar e Invocar (sopla una hoja y aparece una kitsune). No se doma.

**Colas de zorro**: cada tres colas, +1 de precisión; cada cola, +3% de daño. La tarjeta de combate muestra la barra de colas y el dibujo va sumando colas.

**Jefes**: antes competían como una categoría más y, al ser el único jefe de su zona, cambiarle "Qué tan seguido sale" no hacía nada (y salían en el 1 o 2% de los encuentros). Ahora cada jefe tira su propia chance: **3% × "Qué tan seguido sale"** cuando tenés su nivel (un nivel menos, la mitad; dos, un quinto). Con 2 sale en el 6%, con 5 en el 15%. Los jefes de nivel 7 a 9 tienen 1; los legendarios de nivel 10, 0,5. "Jefes" de la zona en 0 = sin jefes.

Pasivas nuevas (`js/systems/skills.js`):

| Pasiva | Qué hace | Quiénes |
|---|---|---|
| Ilusiones | Los dos primeros golpes de arma que pegaban le dan a una ilusión | Kitsune de nueve colas, Archimago |
| Piel gruesa | Cada golpe de arma hace 1 menos (2 desde el nivel 8) | Panda |
| Emboscada | +2 de precisión hasta acertar, y ese golpe hace un tercio más | Bandido, Contrabandista, Gusano de arena, Tiburón |
| Gigante | No se lo tira al suelo ni se lo agarra | Ogro, Ettin, Cíclope, Ent, Titán, Leviatán, Kraken, Cthulhu |
| Valiente | No siente miedo | Hobgoblin, León, Centauro |
| Alma pura | Sin maldición, veneno ni miedo | Unicornio, Ciervo astral |
| Mente arcana | No se aturde, sin maldiciones | Mago oscuro, Nigromante, Bruja, Contemplador |
| Pies de marinero | No se lo tira al suelo | Pirata, Contramaestre, Capitán pirata |
| Aguante | Una vez por pelea queda en pie con 1 de vida | Titán |
| Horror del abismo | Golpearlo con un arma a veces te da miedo | Cthulhu |

Activas nuevas: **Fuego de zorro** (kitsune), **Tragar** (Leviatán, Gusano de arena), **Ventisca** (Yeti), **Ola gigante** (Leviatán, Kraken), **Ráfaga de alas** (Grifo), **Destello** (Unicornio, Ciervo astral), **Visión del abismo** (Cthulhu) y **Merienda de bambú** (Panda).

- Ahora todas las criaturas tienen al menos una pasiva y una activa. Cthulhu invoca un profundo.
- Las mascotas usan las activas nuevas de su especie; una kitsune domada también suma colas en la pelea.
- Se revisó la dificultad de cada criatura con el simulador. Cthulhu sigue a la altura del Dragón anciano; el Archimago bajó de vida por las ilusiones.
- Juego en grupo: versión 7 (los dos tienen que actualizar).

## Versión 3.7.0: nueve criaturas nuevas

Con su dibujo, sus habilidades y su botín (`js/data/seed-enemies.js`, `js/data/seed-skills.js`, `js/core/sprites.js`):

| Criatura | Dónde | Nivel | Tipo | Habilidades | Se doma con |
|---|---|---|---|---|---|
| Panda | Bosque Sombrío | 2 | normal | Derribo, Zarpazo | Hierba silvestre |
| León | Colinas Rotas | 4 | normal (en manada) | Manada, Rugido, Zarpazo | Carne cruda |
| Yeti | Montañas | 5 | fuerte | Cuerpo de hielo, Rugido, Zarpazo | — |
| Unicornio | Bosque de los Sueños | 6 | fuerte, rara | Escurridizo, Embestida, Curarse | Manzana |
| Kitsune | Bosque de los Susurros | 6 | normal | Escurridizo, Encantar, Hechizo | Pan |
| Profundo | Alta Mar | 6 | normal (en grupo) | Manada, Agarre, Mordida | — |
| Grifo | Pradera de los Cíclopes | 7 | fuerte | Vuelo, Picotazo, Zarpazo | Carne cruda |
| Leviatán | Alta Mar | 7 | jefe | Agarre, Barrido, Mordida | — |
| Cthulhu | Abismo Marino | 10 | jefe | Miedo, Maldición, Agarre, Invocar | — |

- El unicornio puede soltar un **Cuerno de unicornio** (legendario). El Leviatán es el jefe de Alta Mar. Cthulhu está a la altura del Dragón anciano; Alamuerte sigue siendo el más fuerte.
- Dibujos nuevos: cuerno de unicornio, cabeza de pulpo (Cthulhu), cabeza de pez (profundo), pico de águila (grifo), tres colas (kitsune) y patas y orejas negras (panda).

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
