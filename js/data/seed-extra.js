/* ============================================================
   Aventurs — Seed: lo que venía en "RPG Plugins v18" (v2.4)

   Todo lo del plugin que todavía no estaba en el juego, adaptado:
   nombres en castellano, números con la misma regla que el resto
   (nivel, rareza y peso), y sin repetir lo que ya existía.
     - 31 armas (con peso: las pesadas te hacen más lento)
     - 31 armaduras (las pesadas también; las túnicas dan maná)
     - 22 accesorios con efectos únicos (casillero nuevo)
     - 43 pergaminos de un solo uso para el combate (los puede usar cualquiera)
     - 9 pociones y 33 comidas
   Los enemigos del plugin ya estaban todos en el juego.
   Lo que no entró: comida rápida (pizza, hamburguesa, sushi...), mascotas
   (acá se doma cualquier criatura) y materiales sin uso.
   ============================================================ */

(function (A) {
  'use strict';

  const E = () => (A.Balance && A.Balance.Economy) || null;
  const price = (tier, rarity, kind) => (E() ? E().gearPrice(tier, rarity, kind) : 25 * tier);

  // ---------- Armas ----------
  // [id, nombre, nivel, rareza, daño, peso, extra, descripción]
  const W = [
    ['hoz', 'Hoz', 1, 'common', '1d4+1', 1, { statusEffect: { type: 'bleed', chance: 0.15, turns: 3, value: 1 } }, 'Herramienta de cosecha con filo curvo. Liviana como la daga y pega un poco más; a veces hace sangrar.'],
    ['latigo', 'Látigo', 2, 'common', '1d4+1', 1, { statusEffect: { type: 'bleed', chance: 0.25, turns: 3, value: 1 } }, 'Cuero trenzado que chasquea. No mata rápido, pero lastima.'],
    ['estoque', 'Estoque', 3, 'uncommon', '1d6+1', 1, { precision: 1, statusEffect: { type: 'bleed', chance: 0.2, turns: 3, value: 1 } }, 'Hoja fina y larga para estocadas certeras. +1 de precisión.'],
    ['cimitarra', 'Cimitarra', 3, 'uncommon', '1d8', 2, { statusEffect: { type: 'bleed', chance: 0.15, turns: 3, value: 1 } }, 'Curva como la luna del desierto. Corta al pasar.'],
    ['nunchaku', 'Nunchaku', 3, 'uncommon', '1d6+1', 1, { statusEffect: { type: 'shock', chance: 0.12, turns: 2, value: 1 } }, 'Dos palos y una cadena. Los golpes rápidos aturden.'],
    ['alfanje', 'Alfanje', 4, 'uncommon', '2d4+1', 3, { statusEffect: { type: 'bleed', chance: 0.2, turns: 3, value: 2 } }, 'Sable ancho y pesado de punta. Muerde hondo: las heridas sangran.'],
    ['lucero_del_alba', 'Lucero del alba', 4, 'uncommon', '2d4+1', 4, { statusEffect: { type: 'shock', chance: 0.15, turns: 2, value: 1 } }, 'Una bola con púas en la punta de un mango. Aturde al que la recibe.'],
    ['tomo_antiguo', 'Tomo antiguo', 4, 'uncommon', '1d6+1', 2, { magic: true, mana: 4 }, 'Páginas que murmuran solas. Potencia tus hechizos y da +4 de maná máximo.'],
    // v3.2: un arma mágica de nivel 3 (entre la varita y el cetro), la hacen los enanos
    ['varita_runica', 'Varita rúnica', 3, 'uncommon', '1d4', 1, { magic: true, mana: 4 }, 'Hierro enano con runas grabadas. Pega como una varita, pero potencia tus hechizos y da +4 de maná máximo.'],
    ['baston_natura', 'Bastón de la naturaleza', 4, 'uncommon', '1d6+1', 1, { magic: true, statusEffect: { type: 'poison', chance: 0.3, turns: 3, value: 1 } }, 'Rama viva que todavía brota. Su golpe envenena.'],
    ['mangual', 'Mangual', 5, 'rare', '2d6+1', 4, { statusEffect: { type: 'shock', chance: 0.15, turns: 2, value: 1 } }, 'Bola de hierro con cadena. Pasa por encima de los escudos y a veces aturde.'],
    ['pica', 'Pica', 5, 'uncommon', '2d8', 6, {}, 'Lanza larguísima de infantería. Pega como un hacha, pero pesa una barbaridad.'],
    ['arco_largo', 'Arco largo', 5, 'uncommon', '1d10+1', 2, { precision: 1 }, 'Alto como un hombre. +1 de precisión.'],
    ['orbe', 'Orbe', 5, 'rare', '1d8+1', 1, { magic: true, mana: 4 }, 'Esfera de cristal que flota sobre la palma. Potencia tus hechizos y da +4 de maná máximo.'],
    ['claymore', 'Claymore', 6, 'rare', '2d8+2', 7, {}, 'Espada de dos manos de las tierras altas. Lenta y brutal.'],
    ['tridente', 'Tridente', 6, 'rare', '2d6+1', 3, { statusEffect: { type: 'bleed', chance: 0.2, turns: 3, value: 2 } }, 'Tres puntas de pescador de monstruos. Las heridas sangran.'],
    ['grimorio', 'Grimorio', 6, 'rare', '1d8+1', 1, { magic: true, mana: 6 }, 'Libro de tapas de cuero negro. Potencia tus hechizos y da +6 de maná máximo.'],
    ['baston_trueno', 'Bastón del trueno', 6, 'rare', '2d6', 2, { magic: true, statusEffect: { type: 'shock', chance: 0.3, turns: 2, value: 2 } }, 'La punta chisporrotea. Cada golpe puede aturdir.'],
    ['hacha_doble', 'Hacha doble', 7, 'rare', '3d6+1', 6, {}, 'Dos hojas, el doble de miedo. Muy pesada.'],
    ['lanza_caballero', 'Lanza de caballero', 7, 'rare', '2d8+2', 5, {}, 'Larga y con guarda de acero. Hecha para la carga.'],
    ['guadana', 'Guadaña', 7, 'rare', '3d6', 5, { statusEffect: { type: 'bleed', chance: 0.25, turns: 3, value: 2 } }, 'La herramienta de la muerte, o algo parecido. Abre heridas.'],
    ['cristal_arcano', 'Cristal arcano', 7, 'epic', '2d6', 1, { magic: true, mana: 5, statusEffect: { type: 'shock', chance: 0.25, turns: 2, value: 2 } }, 'Un cristal que zumba de maná puro. Potencia tus hechizos, da +5 de maná máximo y aturde.'],
    ['baston_oscuro', 'Bastón oscuro', 7, 'epic', '2d6+1', 3, { magic: true, statusEffect: { type: 'blind', chance: 0.25, turns: 2, value: 1 } }, 'La sombra se pega a la madera. Ciega a quien golpea.'],
    ['espadon', 'Espadón', 8, 'epic', '3d8', 8, {}, 'Más alto que su dueño. El arma más pesada que se puede blandir.'],
    ['baston_sagrado', 'Bastón sagrado', 8, 'epic', '2d6+2', 2, { magic: true, statusEffect: { type: 'fire', chance: 0.25, turns: 3, value: 2 } }, 'Bendecido en el templo de la montaña. Quema a los impuros.'],
    ['matadragones', 'Matadragones', 9, 'epic', '3d8+2', 7, {}, 'Forjada para un solo trabajo, y lo hace bien. Pesadísima.'],
    ['segadora_almas', 'Segadora de almas', 9, 'legendary', '3d6+3', 5, { magic: true, statusEffect: { type: 'bleed', chance: 0.35, turns: 3, value: 3 } }, 'Una guadaña negra que susurra nombres. Potencia tus hechizos.'],
    ['vengador_sagrado', 'Vengador sagrado', 9, 'legendary', '3d8', 4, { statusEffect: { type: 'fire', chance: 0.3, turns: 3, value: 3 } }, 'Espada de paladín que arde contra la oscuridad.'],
    ['baston_vacio', 'Bastón del vacío', 9, 'legendary', '3d6+1', 3, { magic: true, statusEffect: { type: 'cold', chance: 0.3, turns: 2, value: 2 } }, 'Donde debería tener punta, hay nada. Hiela lo que toca.'],
    ['gungnir', 'Gungnir', 10, 'legendary', '3d8+2', 4, { precision: 2 }, 'La lanza que nunca erra. +2 de precisión.'],
    ['masamune', 'Masamune', 10, 'legendary', '3d8+1', 2, { statusEffect: { type: 'bleed', chance: 0.35, turns: 3, value: 3 } }, 'La katana perfecta. Liviana como una pluma, corta como el viento.'],
    ['lamento_helado', 'Lamento helado', 10, 'legendary', '3d8+1', 5, { magic: true, statusEffect: { type: 'cold', chance: 0.4, turns: 3, value: 3 } }, 'Una espada rúnica que llora escarcha. Potencia tus hechizos.'],
  ];

  // ---------- Armaduras ----------
  // [id, nombre, nivel, rareza, armadura, esquiva, peso, extra, descripción]
  const R = [
    ['ropa_acolchada', 'Ropa acolchada', 1, 'common', 1, 0, 1, {}, 'Capas de tela rellena. Mejor que nada, y no pesa.'],
    ['tunica_mago', 'Túnica de mago', 2, 'uncommon', 1, 1, 0, { magic: true, mana: 3 }, 'Tela azul bordada con estrellas. +3 de maná máximo.'],
    ['pieles', 'Pieles', 2, 'common', 2, 0, 3, {}, 'Pieles curtidas a lo bruto. Abrigan y frenan un poco.'],
    ['cuero_tachonado', 'Cuero tachonado', 3, 'uncommon', 2, 1, 2, {}, 'Cuero con remaches de metal. Protege sin quitar soltura.'],
    ['cota_anillas', 'Cota de anillas', 3, 'uncommon', 3, 0, 6, {}, 'Anillos cosidos sobre cuero. Protege bien, pero pesa bastante para lo que cubre.'],
    ['armadura_huesos', 'Armadura de huesos', 3, 'uncommon', 2, 0, 3, {}, 'Huesos atados con tendones. Da miedo verla.'],
    ['vestiduras', 'Vestiduras sagradas', 4, 'uncommon', 2, 1, 1, { magic: true, mana: 4 }, 'Ropa de sacerdote, blanca y dorada. +4 de maná máximo.'],
    ['tunica_druida', 'Túnica de druida', 4, 'uncommon', 2, 1, 1, { magic: true, mana: 4 }, 'Tejida con fibras de hojas. +4 de maná máximo.'],
    ['corteza', 'Armadura de corteza', 4, 'uncommon', 3, 0, 3, {}, 'Corteza de roble viejo, dura como la piedra.'],
    ['quitina', 'Armadura de quitina', 4, 'uncommon', 3, 1, 3, {}, 'Placas de caparazón de insecto gigante. Livianas y duras.'],
    ['armadura_sombras', 'Armadura de sombras', 5, 'rare', 2, 2, 1, {}, 'Cuero negro que se confunde con la oscuridad. Cuesta pegarte.'],
    ['armadura_escamas', 'Armadura de escamas', 5, 'uncommon', 4, 0, 7, {}, 'Escamas de metal superpuestas. Protege como pocas, pero pesa mucho.'],
    ['media_placa', 'Media placa', 5, 'rare', 4, 0, 6, {}, 'Placas en el pecho y malla en el resto. Muy pesada.'],
    ['tablillas', 'Armadura de tablillas', 6, 'rare', 5, 0, 9, {}, 'Tiras de acero sobre cuero grueso. Aguanta mucho, pesa más.'],
    ['armadura_coral', 'Armadura de coral', 6, 'rare', 4, 1, 4, {}, 'Coral vivo tallado por sirenas. Dura y liviana para su tamaño.'],
    ['ropajes_oscuros', 'Ropajes oscuros', 6, 'rare', 2, 2, 0, { magic: true, mana: 6 }, 'Seda negra de nigromante. +6 de maná máximo.'],
    ['armadura_bandas', 'Armadura de bandas', 7, 'rare', 5, 0, 8, {}, 'Bandas de acero remachadas. Una muralla que camina.'],
    ['armadura_cristal', 'Armadura de cristal', 7, 'epic', 4, 2, 2, {}, 'Cristal encantado que no se quiebra. Brilla al moverte.'],
    ['vestido_elemental', 'Vestido elemental', 7, 'rare', 3, 2, 1, { magic: true, mana: 7 }, 'Tela que cambia de color con los elementos. +7 de maná máximo.'],
    ['armadura_completa', 'Armadura completa', 8, 'epic', 6, 0, 8, {}, 'Acero de pies a cabeza. Nada pasa, pero te cuesta moverte.'],
    ['armadura_volcanica', 'Armadura volcánica', 8, 'rare', 4, 0, 5, { resist: ['fire'] }, 'Roca de volcán enfriada en forma de placas. El fuego no te hace nada.'],
    ['armadura_escarcha', 'Armadura de escarcha', 8, 'rare', 4, 0, 5, { resist: ['cold'] }, 'Hielo que nunca se derrite. El frío no te afecta.'],
    ['armadura_tormenta', 'Armadura de tormenta', 8, 'rare', 4, 0, 5, { resist: ['shock'] }, 'Placas cargadas de electricidad. Los rayos no te aturden.'],
    ['tunica_archimago', 'Túnica de archimago', 8, 'epic', 3, 3, 0, { magic: true, mana: 9 }, 'Bordada con hilo de plata y runas vivas. +9 de maná máximo.'],
    ['armadura_gotica', 'Armadura gótica', 9, 'epic', 7, 0, 8, {}, 'Acero negro con filos y crestas. Pesadísima.'],
    ['armadura_torneo', 'Armadura de torneo', 9, 'rare', 8, 0, 10, {}, 'Hecha para justas: casi impenetrable y casi imposible de mover.'],
    ['armadura_mithril', 'Armadura de mithril', 9, 'legendary', 6, 2, 2, {}, 'El metal de los elfos: fuerte como el acero y liviano como la seda.'],
    ['plumas_fenix', 'Plumas de fénix', 9, 'legendary', 4, 3, 1, { magic: true, mana: 9, resist: ['fire'] }, 'Plumas que no se apagan. +9 de maná y el fuego no te hace nada.'],
    ['manto_celestial', 'Manto celestial', 9, 'epic', 4, 3, 0, { magic: true, mana: 10 }, 'Tela que parece cielo de noche. +10 de maná máximo.'],
    ['armadura_adamantina', 'Armadura de adamantina', 10, 'legendary', 8, 0, 6, {}, 'El metal indestructible. Ningún golpe la marca.'],
    ['armadura_vacio', 'Armadura del vacío', 10, 'legendary', 5, 3, 2, { magic: true, mana: 10 }, 'Hecha de algo que no debería existir. +10 de maná máximo.'],
  ];

  // ---------- Accesorios (casillero nuevo) ----------
  // [id, nombre, nivel, rareza, efecto, descripción]
  const C = [
    ['acc_anillo_cobre', 'Anillo de cobre', 1, 'common', { precision: 1 }, 'Un anillo simple que da confianza en la mano.'],
    ['acc_colgante_hueso', 'Colgante de hueso', 1, 'common', { defense: 1 }, 'Un amuleto de cazador. Dicen que aleja los golpes.'],
    ['acc_amuleto_sabiduria', 'Amuleto de sabiduría', 2, 'rare', { xp: 0.2 }, 'Una lechuza tallada en piedra. Aprendés más de cada pelea.'],
    ['acc_talisman_fortuna', 'Talismán de la fortuna', 2, 'rare', { gold: 0.3 }, 'Una moneda vieja agujereada. Las bolsas de los caídos pesan más.'],
    ['acc_trebol', 'Trébol de cuatro hojas', 2, 'rare', { drops: 0.25 }, 'Encontrarlo ya fue suerte. Las criaturas sueltan más cosas.'],
    ['acc_botas_velocidad', 'Botas de velocidad', 3, 'rare', { speed: 3 }, 'Livianas como plumas. Llegás antes que nadie.'],
    ['acc_gema_mana', 'Gema de maná', 3, 'rare', { mana: 6 }, 'Una gema azul que guarda energía.'],
    ['acc_amuleto_iniciativa', 'Amuleto de la iniciativa', 3, 'rare', { first: true }, 'Un rayo grabado en plata. Siempre actuás primero (salvo en una emboscada).'],
    ['acc_perla_purificadora', 'Perla purificadora', 3, 'rare', { immune: ['poison'] }, 'Una perla que limpia la sangre. El veneno no te afecta.'],
    ['acc_capa_evasion', 'Capa de evasión', 4, 'rare', { defense: 2 }, 'Se mueve sola y confunde al que te ataca.'],
    ['acc_escudo_magico', 'Escudo mágico', 4, 'rare', { armor: 1 }, 'Un broche que despliega una barrera invisible.'],
    ['acc_cruz_sagrada', 'Cruz sagrada', 4, 'rare', { heal: 0.5 }, 'Bendecida por los monjes. Lo que te cura, te cura más.'],
    ['acc_anillo_critico', 'Anillo del golpe certero', 5, 'epic', { crit: 2 }, 'Un ojo de halcón engarzado. Tus críticos llegan con 18 o más.'],
    ['acc_anillo_espinas', 'Anillo de espinas', 5, 'epic', { thorns: 0.3 }, 'Una rosa de hierro. El que te pega, se pincha.'],
    ['acc_guantelete_poder', 'Guantelete de poder', 5, 'epic', { damage: 2 }, 'Acero con runas en los nudillos. Pegás más fuerte.'],
    ['acc_orbe_regeneracion', 'Orbe de regeneración', 6, 'epic', { regen: 2 }, 'Late tibio en la mano. En cada turno de pelea te cierra un poco las heridas.'],
    ['acc_amuleto_vampirico', 'Amuleto vampírico', 6, 'epic', { lifesteal: 0.25 }, 'Un colmillo en una cadena. Parte del daño que hacés vuelve como vida.'],
    ['acc_rubi_fenix', 'Rubí del fénix', 6, 'epic', { immune: ['fire'] }, 'Una llama encerrada en piedra. El fuego no te afecta.'],
    ['acc_zafiro_glacial', 'Zafiro glacial', 6, 'epic', { immune: ['cold'] }, 'Frío al tacto incluso en el volcán. El frío no te afecta.'],
    ['acc_brazalete_contra', 'Brazalete de contraataque', 6, 'epic', { counter: 0.25 }, 'Cuando te fallan, a veces devolvés el golpe.'],
    ['acc_amuleto_superviviente', 'Amuleto del superviviente', 8, 'legendary', { survivor: true }, 'Una vez por pelea, el golpe que te iba a matar te deja con 1 de vida.'],
    ['acc_guantes_dobles', 'Guantes del doble golpe', 8, 'legendary', { double: 0.2 }, 'A veces, tu brazo pega dos veces antes de que el otro reaccione.'],
  ];

  // ---------- Pergaminos de un uso (combate) ----------
  // [id, nombre, nivel, rareza, efecto, descripción]
  // tipos: damage (dice, element, status, all, drain), stun, curse, heal (pct), cleanse,
  //        buff (stat, amount, duration), restore, survivor
  const S = [
    ['perg_misil_arcano', 'Pergamino de misil arcano', 1, 'common', { type: 'damage', dice: '1d8+2' }, 'Un dardo de luz que nunca falla.'],
    ['perg_escudo', 'Pergamino de escudo', 1, 'common', { type: 'buff', stat: 'armor', amount: 2, duration: 3 }, 'Una cáscara de luz te cubre: +2 de armadura por 3 turnos.'],
    ['perg_quemar', 'Pergamino de quemar', 2, 'common', { type: 'damage', dice: '1d6', element: 'fire', status: { type: 'fire', turns: 3, value: 2 } }, 'Prende fuego al enemigo: quema varios turnos.'],
    ['perg_estatica', 'Pergamino de estática', 2, 'common', { type: 'damage', dice: '1d6+1', element: 'shock', status: { type: 'shock', turns: 2, value: 1 } }, 'Una descarga que puede dejarlo aturdido.'],
    ['perg_veneno', 'Pergamino de veneno', 2, 'common', { type: 'damage', dice: '1d4', element: 'poison', status: { type: 'poison', turns: 4, value: 2 } }, 'Una nube verde que lo envenena por varios turnos.'],
    ['perg_purificar', 'Pergamino de purificar', 2, 'common', { type: 'cleanse', pct: 0.1 }, 'Te quita veneno, fuego, sangrado y frío, y te cura un poco.'],
    ['perg_prisa', 'Pergamino de prisa', 2, 'common', { type: 'buff', stat: 'defense', amount: 2, duration: 3, also: { precision: 2 } }, 'Te movés el doble de rápido: +2 de precisión y de defensa por 3 turnos.'],
    ['perg_congelar', 'Pergamino de congelar', 3, 'uncommon', { type: 'damage', dice: '1d6', element: 'cold', stun: 1 }, 'Lo encierra en hielo: pierde su próximo turno.'],
    ['perg_maldicion', 'Pergamino de maldición', 3, 'uncommon', { type: 'curse', amount: 2, duration: 4 }, 'Una marca oscura: -2 a su precisión y a su defensa por 4 turnos.'],
    ['perg_enredar', 'Pergamino de enredar', 3, 'uncommon', { type: 'stun', turns: 1 }, 'Raíces que lo atan al suelo: pierde su próximo turno.'],
    ['perg_espinas', 'Pergamino de espinas', 3, 'uncommon', { type: 'buff', stat: 'reflect', amount: 0.3, duration: 4 }, 'Te cubrís de espinas: el que te pega recibe parte del golpe por 4 turnos.'],
    ['perg_fuerza', 'Pergamino de fuerza', 3, 'uncommon', { type: 'buff', stat: 'damage', amount: 3, duration: 3 }, '+3 de daño por 3 turnos.'],
    ['perg_precision', 'Pergamino de precisión', 3, 'uncommon', { type: 'buff', stat: 'precision', amount: 4, duration: 3 }, '+4 de precisión por 3 turnos.'],
    ['perg_relampago', 'Pergamino de relámpago', 4, 'uncommon', { type: 'damage', dice: '2d8', element: 'shock', status: { type: 'shock', turns: 2, value: 1 } }, 'Un rayo directo del cielo.'],
    ['perg_drenar', 'Pergamino de drenar vida', 4, 'uncommon', { type: 'damage', dice: '2d6', drain: true }, 'Le roba la vida: lo que le sacás, lo recuperás.'],
    ['perg_terror', 'Pergamino de terror', 4, 'uncommon', { type: 'stun', turns: 1, status: { type: 'blind', turns: 2, value: 1 } }, 'Lo paraliza de miedo un turno y después pega a ciegas.'],
    ['perg_armadura', 'Pergamino de armadura', 4, 'uncommon', { type: 'buff', stat: 'armor', amount: 3, duration: 4 }, '+3 de armadura por 4 turnos.'],
    ['perg_barrera_hielo', 'Pergamino de barrera de hielo', 4, 'uncommon', { type: 'buff', stat: 'armor', amount: 4, duration: 2 }, 'Un muro de hielo: +4 de armadura por 2 turnos.'],
    ['perg_ola_fuego', 'Pergamino de ola de fuego', 5, 'rare', { type: 'damage', dice: '2d6', element: 'fire', all: true }, 'Una ola de fuego que alcanza a todos los enemigos.'],
    ['perg_ventisca', 'Pergamino de ventisca', 5, 'rare', { type: 'damage', dice: '2d4', element: 'cold', all: true, status: { type: 'cold', turns: 2, value: 1 } }, 'Hielo y viento contra todos los enemigos.'],
    ['perg_curacion_mayor', 'Pergamino de curación mayor', 5, 'rare', { type: 'heal', pct: 0.5 }, 'Te cura la mitad de tu vida máxima.'],
    ['perg_regenerar', 'Pergamino de regenerar', 5, 'rare', { type: 'buff', stat: 'regen', amount: 4, duration: 4 }, 'Recuperás 4 de vida al empezar cada turno, por 4 turnos.'],
    ['perg_furia', 'Pergamino de furia', 5, 'rare', { type: 'buff', stat: 'damage', amount: 5, duration: 3, also: { defense: -2 } }, '+5 de daño y -2 de defensa por 3 turnos.'],
    ['perg_infierno', 'Pergamino de infierno', 6, 'rare', { type: 'damage', dice: '3d8', element: 'fire', status: { type: 'fire', turns: 3, value: 3 } }, 'Fuego del abismo sobre un enemigo.'],
    ['perg_trueno', 'Pergamino de trueno', 6, 'rare', { type: 'damage', dice: '3d6', element: 'shock', stun: 1 }, 'Un trueno que lo deja sin turno.'],
    ['perg_rayo_oscuro', 'Pergamino de rayo oscuro', 6, 'rare', { type: 'damage', dice: '3d8' }, 'Sombra concentrada en un rayo.'],
    ['perg_reflejar', 'Pergamino de reflejar', 6, 'rare', { type: 'buff', stat: 'reflect', amount: 0.75, duration: 2 }, 'Devuelve casi todo el daño que recibís por 2 turnos.'],
    ['perg_inmunidad', 'Pergamino de inmunidad', 6, 'rare', { type: 'buff', stat: 'immune', amount: 1, duration: 4, cleanse: true }, 'Te limpia y ningún efecto te toca por 4 turnos.'],
    ['perg_invisibilidad', 'Pergamino de invisibilidad', 6, 'rare', { type: 'buff', stat: 'invisible', amount: 1, duration: 2 }, 'Desaparecés: los ataques te fallan por 2 turnos.'],
    ['perg_caos', 'Pergamino de caos', 6, 'rare', { type: 'damage', dice: '1d20+4', element: 'arcane' }, 'Nadie sabe qué va a pasar. Ni el pergamino.'],
    ['perg_nova_escarcha', 'Pergamino de nova de escarcha', 7, 'epic', { type: 'damage', dice: '3d6', element: 'cold', all: true, status: { type: 'cold', turns: 3, value: 2 } }, 'Una explosión de hielo contra todos.'],
    ['perg_cadena_rayos', 'Pergamino de cadena de rayos', 7, 'epic', { type: 'damage', dice: '2d8', element: 'shock', all: true }, 'El rayo salta de enemigo en enemigo.'],
    ['perg_polimorfia', 'Pergamino de polimorfía', 7, 'epic', { type: 'stun', turns: 2 }, 'Lo convierte en oveja dos turnos. No puede hacer nada.'],
    ['perg_curacion_masiva', 'Pergamino de curación masiva', 7, 'epic', { type: 'heal', pct: 0.6, pet: true }, 'Cura 60% de la vida a vos y a tu mascota.'],
    ['perg_meteoro', 'Pergamino de meteoro', 8, 'epic', { type: 'damage', dice: '4d8+4', element: 'fire' }, 'Una roca en llamas cae del cielo.'],
    ['perg_terremoto', 'Pergamino de terremoto', 8, 'epic', { type: 'damage', dice: '3d8', all: true }, 'El suelo se abre bajo todos los enemigos.'],
    ['perg_perdicion', 'Pergamino de perdición', 9, 'legendary', { type: 'damage', dice: '6d8' }, 'La palabra que no se dice. Un golpe devastador.'],
    ['perg_poder_divino', 'Pergamino de poder divino', 9, 'legendary', { type: 'buff', stat: 'damage', amount: 5, duration: 4, also: { armor: 3, precision: 3 } }, '+5 de daño, +3 de armadura y +3 de precisión por 4 turnos.'],
    ['perg_resurreccion', 'Pergamino de resurrección', 9, 'legendary', { type: 'survivor' }, 'Si en esta pelea un golpe te iba a matar, quedás con un cuarto de tu vida.'],
    ['perg_invencible', 'Pergamino de invencible', 9, 'legendary', { type: 'buff', stat: 'invincible', amount: 1, duration: 2 }, 'Nada te hace daño por 2 turnos.'],
    ['perg_desintegrar', 'Pergamino de desintegrar', 10, 'legendary', { type: 'damage', dice: '8d8' }, 'No queda ni el polvo.'],
    ['perg_detener_tiempo', 'Pergamino de detener el tiempo', 10, 'legendary', { type: 'stun', turns: 2, all: true }, 'Todo se congela menos vos: los enemigos pierden 2 turnos.'],
    ['perg_deseo', 'Pergamino de deseo', 10, 'legendary', { type: 'restore' }, 'Te devuelve toda la vida y el maná, y te limpia de todo mal.'],
  ];

  // ---------- Pociones ----------
  // [id, nombre, nivel, rareza, efecto, descripción]
  const P = [
    ['pocion_curacion_mayor', 'Poción de curación mayor', 5, 'rare', { type: 'heal', amount: '4d8+8' }, 'Roja oscura y espesa. Cierra heridas graves.'],
    ['pocion_mana_mayor', 'Poción de maná mayor', 5, 'rare', { type: 'mana', amount: '4d6+6' }, 'Azul profundo. Devuelve mucho maná.'],
    ['elixir_vida', 'Elixir de vida', 8, 'epic', { type: 'heal', pct: 1 }, 'Una gota de luz líquida. Te cura del todo.'],
    ['pocion_piel_piedra', 'Poción de piel de piedra', 3, 'uncommon', { type: 'buff', stat: 'armor', amount: 3, duration: 4 }, 'La piel se te pone gris y dura: +3 de armadura por 4 turnos.'],
    ['pocion_velocidad', 'Poción de velocidad', 3, 'uncommon', { type: 'buff', stat: 'defense', amount: 3, duration: 4 }, 'Te movés tan rápido que cuesta pegarte: +3 de defensa por 4 turnos.'],
    ['pocion_regeneracion', 'Poción de regeneración', 4, 'rare', { type: 'buff', stat: 'regen', amount: 3, duration: 5 }, 'Recuperás 3 de vida al empezar cada turno, por 5 turnos.'],
    ['pocion_invisibilidad', 'Poción de invisibilidad', 6, 'rare', { type: 'buff', stat: 'invisible', amount: 1, duration: 2 }, 'Te volvés transparente: los ataques te fallan por 2 turnos.'],
    ['pocion_contra_fuego', 'Poción contra el fuego', 4, 'uncommon', { type: 'buff', stat: 'resist', amount: 1, duration: 6, types: ['fire'] }, 'El fuego no te afecta por 6 turnos.'],
    ['pocion_contra_frio', 'Poción contra el frío', 4, 'uncommon', { type: 'buff', stat: 'resist', amount: 1, duration: 6, types: ['cold'] }, 'El frío no te afecta por 6 turnos.'],
  ];

  // ---------- Comidas ----------
  // [id, nombre, rareza, comida, vida, descripción]
  const F = [
    ['manzana', 'Manzana', 'common', 2, 0, 'Roja y crocante.'],
    ['uvas', 'Racimo de uvas', 'common', 2, 1, 'Dulces y jugosas.'],
    ['frutillas', 'Frutillas', 'common', 2, 1, 'Un puñado de frutillas silvestres.'],
    ['zanahoria', 'Zanahoria', 'common', 2, 0, 'Recién sacada de la tierra.'],
    ['papa_asada', 'Papa asada', 'common', 4, 0, 'Al rescoldo, con la cáscara negra.'],
    ['huevos', 'Huevos', 'common', 3, 0, 'Media docena, con cuidado en la mochila.'],
    ['champinones', 'Champiñones asados', 'common', 4, 1, 'Del bosque, a la brasa.'],
    ['miel', 'Frasco de miel', 'uncommon', 3, 3, 'Dorada y espesa. Endulza y repone.'],
    ['sopa', 'Sopa caliente', 'uncommon', 6, 3, 'Reconforta hasta el alma.'],
    ['pollo_asado', 'Pollo asado', 'uncommon', 8, 3, 'Dorado y crujiente.'],
    ['pastel_carne', 'Pastel de carne', 'uncommon', 9, 2, 'Masa gruesa y relleno sustancioso.'],
    ['estofado', 'Estofado', 'uncommon', 10, 5, 'Carne y verduras que se cocinaron toda la tarde.'],
    ['vino', 'Botella de vino', 'uncommon', 1, 3, 'Tinto de las colinas. Calienta el cuerpo.'],
    ['cerveza', 'Jarra de cerveza', 'common', 2, 2, 'Espumosa, de la taberna.'],
    ['hidromiel', 'Hidromiel', 'uncommon', 2, 4, 'La bebida de los enanos. Dulce y fuerte.'],
    ['pan_elfico', 'Pan élfico', 'rare', 15, 6, 'Un bocado alcanza para un día de marcha.'],
    ['jalea_real', 'Jalea real', 'rare', 6, 10, 'El tesoro de las abejas gigantes. Cura de verdad.'],
    ['festin_real', 'Festín real', 'epic', 20, 15, 'Una canasta digna de un rey. Te deja como nuevo.'],
    ['ambrosia', 'Ambrosía', 'legendary', 20, 40, 'El alimento de los dioses.'],
    ['naranja', 'Naranja', 'common', 2, 1, 'Jugosa y ácida. Despierta.'],
    ['platano', 'Plátano', 'common', 3, 0, 'Viene en los barcos del sur.'],
    ['sandia', 'Sandía', 'common', 5, 1, 'Pesa, pero alcanza para todos.'],
    ['choclo', 'Choclo asado', 'common', 3, 0, 'Con manteca, a la brasa.'],
    ['tomate', 'Tomate', 'common', 1, 1, 'Rojo y maduro.'],
    ['cebolla', 'Cebolla', 'common', 1, 0, 'Hace llorar, pero llena un poco.'],
    ['arroz', 'Plato de arroz', 'common', 4, 0, 'Simple y abundante.'],
    ['fideos', 'Fideos con tuco', 'uncommon', 6, 1, 'Como los de la abuela.'],
    ['tocino', 'Tocino', 'common', 4, 0, 'Crocante y salado.'],
    ['filete', 'Filete', 'uncommon', 7, 2, 'Jugoso, recién salido de la parrilla.'],
    ['ensalada', 'Ensalada', 'common', 3, 2, 'Fresca. Del huerto a la mesa.'],
    ['galletas', 'Galletas', 'common', 2, 0, 'Duran semanas en la mochila.'],
    ['dulces', 'Bolsita de dulces', 'common', 1, 1, 'Caramelos de miel. Un gusto.'],
    ['huevo_fenix', 'Huevo de fénix', 'legendary', 12, 30, 'Tibio para siempre. Quien lo come siente que renace.'],
    // v3.1: la comida de las razas que no comen como las demás
    ['lata_aceite', 'Lata de aceite', 'common', 5, 0, 'Aceite espeso de máquina. Para un robot, un banquete.'],
    ['bateria_runica', 'Batería rúnica', 'rare', 14, 6, 'Una piedra cargada de energía. Un robot la siente como un día entero de descanso.'],
    ['botella_sangre', 'Botella de sangre', 'common', 5, 1, 'Sangre de cordero, todavía tibia. Para un vampiro, la cena.'],
    ['copa_sangre', 'Sangre de noble', 'rare', 12, 6, 'Oscura y espesa. En Velmora pagan fortunas por ella.'],
    ['frasco_nectar', 'Frasco de néctar', 'common', 4, 1, 'Néctar de las flores del valle, juntado gota a gota.'],
    ['gel_algas', 'Gel de algas', 'common', 5, 1, 'Algas del puerto hechas pasta. Huele a mar.'],
    ['carbon_ardiente', 'Carbón ardiente', 'common', 5, 0, 'Brasas que no se apagan. Un infernal las mastica como caramelos.'],
  ];

  // ---------- Armado ----------
  const weapons = W.map(([id, name, tier, rarity, damage, weight, extra, description]) => ({
    id, name, type: 'weapon', icon: '', damage, value: price(tier, rarity), rarity, tier, weight, magic: false, ...extra, description,
  }));
  const armors = R.map(([id, name, tier, rarity, defense, dodge, weight, extra, description]) => ({
    id, name, type: 'armor', icon: '', defense, dodge: dodge || 0, value: price(tier, rarity, 'armor'), rarity, tier, weight, ...extra, description,
  }));
  const accessories = C.map(([id, name, tier, rarity, acc, description]) => ({
    id, name, type: 'item', subtype: 'accessory', icon: '', value: Math.round(price(tier, rarity) * 1.1), rarity, tier, weight: 0, stack: 1, acc, description,
  }));
  // pergaminos: el precio sigue a lo que hacen (v3.0: según su efecto, ver Economy.scrollPrice)
  const scrolls = S.map(([id, name, tier, rarity, effect, description]) => ({
    id, name, type: 'item', subtype: 'scroll', icon: '', value: Math.round(price(tier, rarity) * 0.35), rarity, tier, weight: 0, stack: 10, effect: { ...effect, combat: true }, description,
  }));
  for (const it of scrolls) if (E() && E().scrollPrice) it.value = E().scrollPrice(it);
  // v3.3: muchos pergaminos se pueden aprender como hechizo (ver js/data/seed-spells.js, fromScroll)
  const TEACHES = {
    perg_misil_arcano: 'misil_arcano', perg_escudo: 'escudo_arcano', perg_quemar: 'quemar', perg_estatica: 'estatica', perg_veneno: 'nube_venenosa',
    perg_purificar: 'purificar', perg_prisa: 'prisa', perg_congelar: 'congelar', perg_maldicion: 'maldicion', perg_enredar: 'enredar', perg_espinas: 'espinas',
    perg_fuerza: 'fuerza_arcana', perg_precision: 'ojo_de_halcon', perg_relampago: 'relampago', perg_drenar: 'drenar_vida', perg_terror: 'terror',
    perg_armadura: 'piel_de_piedra', perg_ola_fuego: 'ola_de_fuego', perg_ventisca: 'ventisca', perg_curacion_mayor: 'curacion_mayor', perg_regenerar: 'regenerar',
    perg_furia: 'furia_salvaje', perg_trueno: 'trueno', perg_invisibilidad: 'invisibilidad',
  };
  for (const it of scrolls) if (TEACHES[it.id]) it.teachesSpell = TEACHES[it.id];
  const potions = P.map(([id, name, tier, rarity, effect, description]) => ({
    id, name, type: 'item', subtype: 'potion', icon: '', value: 0, rarity, tier, weight: 1, stack: 99, effect, description,
  }));
  const foods = F.map(([id, name, rarity, food, heal, description]) => ({
    id, name, type: 'item', subtype: 'food', icon: '', value: 0, rarity, weight: 0, stack: 99,
    effect: { type: 'food', amount: food, ...(heal ? { heal: String(heal) } : {}) }, description,
  }));

  // comidas y pociones: el precio sale de lo que curan o llenan
  for (const it of potions.concat(foods)) it.value = E() && E().consumablePrice ? E().consumablePrice(it) : 10;

  // ---------- Dónde se venden ----------
  // Cada tienda suma lo que tiene sentido para su pueblo (y su nivel).
  const SHOPS = {
    // v3.2: algo para cada clase desde el primer pueblo (los magos tienen su bastón, su varita y su túnica)
    npc_mercader_pueblo: ['lata_aceite', 'botella_sangre', 'frasco_nectar', 'gel_algas', 'carbon_ardiente', 'manzana', 'zanahoria', 'huevos', 'cebolla', 'tomate', 'galletas', 'dulces', 'ropa_acolchada', 'hoz', 'garrote', 'baston', 'varita', 'tunica_mago', 'acc_anillo_cobre', 'acc_colgante_hueso', 'perg_misil_arcano', 'perg_escudo'],
    npc_tabernera_piedrahonda: ['papa_asada', 'champinones', 'sopa', 'cerveza', 'pastel_carne', 'choclo', 'arroz', 'tocino', 'ensalada'],
    npc_herrero_piedrahonda: ['lata_aceite', 'carbon_ardiente', 'pieles', 'cuero_tachonado', 'cota_anillas', 'latigo', 'lucero_del_alba', 'alfanje', 'varita_runica', 'tunica_mago'],
    npc_herrero_puerto: ['lata_aceite', 'bateria_runica', 'carbon_ardiente', 'estoque', 'cimitarra', 'nunchaku', 'pica', 'arco_largo', 'varita_runica', 'armadura_escamas', 'media_placa', 'quitina', 'acc_botas_velocidad'],
    npc_capitana_puerto: ['gel_algas', 'uvas', 'frutillas', 'naranja', 'platano', 'sandia', 'vino', 'perg_estatica'],
    npc_sabio_torre: ['bateria_runica', 'tomo_antiguo', 'orbe', 'tunica_mago', 'vestiduras', 'perg_quemar', 'perg_veneno', 'perg_congelar', 'perg_maldicion', 'perg_prisa', 'perg_precision', 'perg_fuerza', 'pocion_mana_mayor', 'acc_gema_mana', 'acc_amuleto_sabiduria'],
    npc_druida_santuario: ['frasco_nectar', 'baston_natura', 'tunica_druida', 'corteza', 'perg_enredar', 'perg_purificar', 'perg_regenerar', 'pocion_regeneracion', 'miel', 'jalea_real', 'pan_elfico', 'acc_trebol'],
    npc_tabernero_calavera: ['botella_sangre', 'copa_sangre', 'cerveza', 'vino', 'estofado', 'hidromiel', 'pollo_asado', 'fideos', 'filete', 'festin_real'],
    npc_contrabandista_calavera: ['bateria_runica', 'copa_sangre', 'cimitarra', 'tridente', 'mangual', 'armadura_sombras', 'pocion_velocidad', 'pocion_piel_piedra', 'perg_terror', 'perg_armadura', 'acc_talisman_fortuna', 'acc_capa_evasion'],
    npc_boticaria_velmora: ['copa_sangre', 'botella_sangre', 'pocion_curacion_mayor', 'pocion_regeneracion', 'pocion_contra_fuego', 'pocion_contra_frio', 'pocion_invisibilidad', 'perg_drenar', 'perg_curacion_mayor', 'perg_invisibilidad', 'perg_reflejar', 'ropajes_oscuros', 'acc_amuleto_vampirico'],
  };

  // ---------- Dónde se consiguen peleando ----------
  // criatura: [[objeto, probabilidad], ...]. El equipo y los accesorios caen poco
  // (según su rareza; los jefes, el doble), y cada cosa la lleva quien la usaría.
  const DROPS = {
    ahogado: [['perg_relampago', 0.06], ['perg_terror', 0.06], ['perg_barrera_hielo', 0.06]],
    alamuerte: [['gungnir', 0.03], ['ambrosia', 0.1]],
    aparicion: [['baston_sagrado', 0.025], ['perg_meteoro', 0.04], ['perg_terremoto', 0.04]],
    archimago: [['vengador_sagrado', 0.03], ['tunica_archimago', 0.05], ['manto_celestial', 0.05], ['perg_poder_divino', 0.06], ['elixir_vida', 0.1]],
    arpia: [['acc_botas_velocidad', 0.04], ['acc_amuleto_iniciativa', 0.04], ['perg_armadura', 0.06]],
    balrog: [['masamune', 0.03], ['armadura_vacio', 0.03], ['perg_desintegrar', 0.06], ['perg_detener_tiempo', 0.06], ['perg_deseo', 0.06]],
    bandido: [['hoz', 0.06], ['nunchaku', 0.05], ['ropa_acolchada', 0.06], ['cuero_tachonado', 0.05], ['acc_anillo_cobre', 0.06], ['perg_espinas', 0.06], ['perg_precision', 0.06]],
    banshee: [['acc_amuleto_sabiduria', 0.04], ['acc_capa_evasion', 0.04], ['perg_ola_fuego', 0.05], ['perg_curacion_mayor', 0.05]],
    brightwing: [['perg_infierno', 0.05], ['perg_rayo_oscuro', 0.05], ['perg_inmunidad', 0.05], ['perg_invisibilidad', 0.05]],
    bruja: [['grimorio', 0.04], ['cristal_arcano', 0.025], ['perg_curacion_masiva', 0.04], ['pocion_mana_mayor', 0.06]],
    cab_muerte: [['lanza_caballero', 0.04], ['espadon', 0.025], ['matadragones', 0.025], ['segadora_almas', 0.015], ['armadura_completa', 0.025], ['armadura_gotica', 0.025], ['acc_amuleto_superviviente', 0.02]],
    cangrejo: [['acc_perla_purificadora', 0.04]],
    capitan_pirata: [['tablillas', 0.04], ['acc_talisman_fortuna', 0.04], ['perg_reflejar', 0.05], ['perg_inmunidad', 0.05]],
    centauro: [['lanza_caballero', 0.04], ['armadura_bandas', 0.04], ['acc_guantes_dobles', 0.02]],
    ciclope: [['espadon', 0.025], ['armadura_completa', 0.025], ['armadura_torneo', 0.04]],
    ciervo_astral: [['acc_trebol', 0.04]],
    contemplador: [['baston_sagrado', 0.025], ['baston_vacio', 0.015], ['tunica_archimago', 0.025]],
    contrabandista: [['latigo', 0.06], ['estoque', 0.05], ['cimitarra', 0.05], ['cota_anillas', 0.05], ['acc_botas_velocidad', 0.04], ['perg_fuerza', 0.06]],
    contramaestre: [['mangual', 0.04], ['acc_talisman_fortuna', 0.04], ['acc_anillo_critico', 0.03]],
    demonio_mayor: [['baston_vacio', 0.03], ['armadura_vacio', 0.03], ['perg_perdicion', 0.06], ['perg_resurreccion', 0.06]],
    diablillo: [['acc_gema_mana', 0.04], ['perg_drenar', 0.06], ['perg_barrera_hielo', 0.06]],
    draconido_salvaje: [['matadragones', 0.025], ['perg_perdicion', 0.03], ['perg_poder_divino', 0.03], ['perg_resurreccion', 0.03]],
    dragon_anciano: [['masamune', 0.03], ['armadura_mithril', 0.03]],
    driade: [['baston_natura', 0.05], ['tunica_druida', 0.05], ['corteza', 0.05], ['perg_furia', 0.05]],
    drow: [['tomo_antiguo', 0.05], ['arco_largo', 0.05], ['orbe', 0.04], ['tunica_mago', 0.05], ['armadura_sombras', 0.04], ['acc_gema_mana', 0.04], ['acc_amuleto_iniciativa', 0.04]],
    elem_arcano: [['cristal_arcano', 0.025], ['armadura_cristal', 0.025]],
    elem_fuego: [['vestido_elemental', 0.04], ['armadura_volcanica', 0.04], ['acc_rubi_fenix', 0.03]],
    elem_hielo: [['vestido_elemental', 0.04], ['armadura_escarcha', 0.04], ['acc_zafiro_glacial', 0.03]],
    ent: [['baston_natura', 0.05], ['corteza', 0.05], ['acc_anillo_espinas', 0.03], ['acc_orbe_regeneracion', 0.03]],
    escarabajo_minero: [['quitina', 0.05]],
    escorpion: [['quitina', 0.05]],
    espectro: [['guadana', 0.04], ['perg_polimorfia', 0.04], ['pocion_invisibilidad', 0.06]],
    esqueleto: [['armadura_huesos', 0.05], ['perg_escudo', 0.07], ['perg_quemar', 0.07], ['perg_veneno', 0.07]],
    esqueleto_pirata: [['media_placa', 0.04], ['perg_ola_fuego', 0.05], ['perg_ventisca', 0.05], ['perg_regenerar', 0.05]],
    ettin: [['claymore', 0.04], ['perg_trueno', 0.05], ['perg_rayo_oscuro', 0.05], ['perg_invisibilidad', 0.05]],
    fantasma: [['vestiduras', 0.05], ['acc_amuleto_sabiduria', 0.04], ['perg_terror', 0.06]],
    fenix: [['huevo_fenix', 0.06], ['plumas_fenix', 0.015], ['acc_rubi_fenix', 0.03]],
    gargola: [['baston_trueno', 0.04], ['acc_escudo_magico', 0.04], ['acc_anillo_espinas', 0.03]],
    goblin: [['ropa_acolchada', 0.06], ['pieles', 0.06], ['acc_anillo_cobre', 0.06], ['acc_colgante_hueso', 0.06]],
    golem: [['armadura_cristal', 0.025]],
    golem_lava: [['armadura_volcanica', 0.04]],
    grumete_pirata: [['cimitarra', 0.05], ['cuero_tachonado', 0.05], ['cota_anillas', 0.05], ['perg_congelar', 0.06], ['perg_maldicion', 0.06], ['perg_enredar', 0.06]],
    hada_traviesa: [['orbe', 0.04], ['tunica_druida', 0.05], ['acc_trebol', 0.04]],
    hobgoblin: [['alfanje', 0.05], ['lucero_del_alba', 0.05], ['tomo_antiguo', 0.05], ['pica', 0.05]],
    hombre_lagarto: [['perg_relampago', 0.06], ['perg_drenar', 0.06]],
    kobold: [['latigo', 0.06], ['nunchaku', 0.05], ['tunica_mago', 0.05], ['acc_colgante_hueso', 0.06]],
    kraken: [['lamento_helado', 0.03]],
    licantropo: [['acc_anillo_critico', 0.03], ['acc_brazalete_contra', 0.03]],
    lich: [['segadora_almas', 0.03], ['lamento_helado', 0.03], ['manto_celestial', 0.05], ['perg_invencible', 0.06], ['elixir_vida', 0.1]],
    mago_oscuro: [['baston_trueno', 0.04], ['baston_oscuro', 0.025], ['ropajes_oscuros', 0.04], ['pocion_mana_mayor', 0.06]],
    manticora: [['armadura_tormenta', 0.04]],
    medusa: [['perg_nova_escarcha', 0.04], ['perg_cadena_rayos', 0.04], ['perg_curacion_masiva', 0.04]],
    minotauro: [['hacha_doble', 0.04], ['tablillas', 0.04], ['acc_guantelete_poder', 0.03], ['acc_brazalete_contra', 0.03]],
    momia: [['vestiduras', 0.05], ['acc_cruz_sagrada', 0.04], ['perg_ventisca', 0.05], ['perg_curacion_mayor', 0.05]],
    naga: [['tridente', 0.04], ['armadura_coral', 0.04]],
    necrofago: [['armadura_huesos', 0.05], ['acc_cruz_sagrada', 0.04], ['perg_armadura', 0.06]],
    nigromante: [['grimorio', 0.04], ['baston_oscuro', 0.025], ['ropajes_oscuros', 0.04], ['perg_caos', 0.05], ['pocion_mana_mayor', 0.06]],
    noble_vampira: [['armadura_torneo', 0.04], ['acc_amuleto_vampirico', 0.03], ['perg_meteoro', 0.04], ['perg_terremoto', 0.04]],
    ogro: [['armadura_escamas', 0.05], ['acc_escudo_magico', 0.04], ['acc_guantelete_poder', 0.03], ['perg_regenerar', 0.05], ['pocion_curacion_mayor', 0.06]],
    orco: [['lucero_del_alba', 0.05], ['pica', 0.05], ['pieles', 0.06]],
    osgo: [['mangual', 0.04], ['arco_largo', 0.05], ['armadura_sombras', 0.04], ['armadura_escamas', 0.05], ['media_placa', 0.04], ['acc_capa_evasion', 0.04]],
    pesadilla: [['perg_infierno', 0.05], ['perg_trueno', 0.05], ['perg_reflejar', 0.05], ['perg_caos', 0.05], ['pocion_invisibilidad', 0.06]],
    pirata: [['estoque', 0.05], ['alfanje', 0.05]],
    quimera: [['armadura_tormenta', 0.04]],
    senor_vampiro: [['vengador_sagrado', 0.03], ['armadura_gotica', 0.05], ['acc_guantes_dobles', 0.04], ['perg_invencible', 0.06], ['elixir_vida', 0.1]],
    serp_marina: [['armadura_escarcha', 0.04], ['acc_zafiro_glacial', 0.03]],
    siervo_sangre: [['guadana', 0.04], ['armadura_bandas', 0.04]],
    sirena: [['tridente', 0.04], ['armadura_coral', 0.04], ['acc_perla_purificadora', 0.04], ['perg_furia', 0.05]],
    sucubo: [['perg_nova_escarcha', 0.04], ['perg_cadena_rayos', 0.04]],
    tarrasca: [['armadura_adamantina', 0.03]],
    titan: [['gungnir', 0.03], ['armadura_mithril', 0.03], ['armadura_adamantina', 0.03], ['acc_amuleto_superviviente', 0.04], ['perg_desintegrar', 0.06], ['perg_detener_tiempo', 0.06], ['perg_deseo', 0.06], ['ambrosia', 0.1]],
    troll: [['claymore', 0.04], ['hacha_doble', 0.04], ['acc_orbe_regeneracion', 0.03], ['pocion_curacion_mayor', 0.06]],
    vampiro: [['acc_amuleto_vampirico', 0.03], ['perg_polimorfia', 0.04], ['pocion_curacion_mayor', 0.06]],
    zombi: [['hoz', 0.06], ['perg_misil_arcano', 0.07], ['perg_estatica', 0.07], ['perg_purificar', 0.07], ['perg_prisa', 0.07]],
  };

  A.Seed = A.Seed || {};
  for (const npc of A.Seed.npcs || []) {
    for (const id of SHOPS[npc.id] || []) {
      npc.sells = npc.sells || [];
      if (!npc.sells.includes(id)) npc.sells.push(id);
    }
  }
  for (const e of A.Seed.enemies || []) {
    for (const [itemId, chance] of DROPS[e.id] || []) {
      e.drops = e.drops || [];
      if (!e.drops.some((d) => d.itemId === itemId)) e.drops.push({ itemId, chance, source: 'balance' });
    }
  }
  A.Seed.weapons = (A.Seed.weapons || []).concat(weapons);
  A.Seed.armors = (A.Seed.armors || []).concat(armors);
  A.Seed.items = (A.Seed.items || []).concat(accessories, scrolls, potions, foods);
  A.SeedExtra = { weapons, armors, accessories, scrolls, potions, foods, SHOPS, DROPS };
})(window.Aventurs);
