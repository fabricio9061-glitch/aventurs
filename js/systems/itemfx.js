/* ============================================================
   Aventurs — Efectos de pociones, comidas y pergaminos (v2.4)

   Todo lo que hace un objeto al usarlo, dentro y fuera del combate:
     heal     -> cura (amount en dados, o pct de la vida máxima; pet: también a la mascota)
     mana     -> devuelve maná
     food     -> llena la panza (heal: además cura)
     cure     -> quita un efecto (status: 'poison')
     cleanse  -> quita todo lo malo (pct: además cura esa parte de la vida)
     restore  -> vida y maná al máximo, y te limpia
     buff     -> mejora por unos turnos (stat + amount; also: otras mejoras; types: resistencias)
     damage   -> daño a un enemigo o a todos (dice, element, status, stun, drain, all). No falla.
     stun     -> el enemigo pierde turnos (a un jefe, solo uno)
     curse    -> -precisión y -defensa al enemigo por unos turnos
     survivor -> si en esta pelea un golpe te iba a matar, quedás con un cuarto de la vida
     escape   -> salís de la pelea seguro

   Las mejoras viven en player.effects como { type: 'buff', mods, turns }.
   Duran tantos turnos TUYOS como dice el objeto: se descuentan después
   de cada acción tuya (el turno en que la usás no cuenta).
   ============================================================ */

(function (A) {
  'use strict';

  // v2.5: también lo que te dejan las criaturas (derribado, miedo, atrapado, ácido, maldición, aturdido)
  const BAD = ['bleed', 'poison', 'fire', 'cold', 'shock', 'blind', 'silence', 'prone', 'fear', 'grab', 'corrode', 'curse', 'stun'];
  const COMBAT_ONLY = ['buff', 'escape', 'damage', 'stun', 'curse', 'survivor'];
  const WORD = { poison: 'el veneno', fire: 'el fuego', cold: 'el frío', shock: 'los rayos', bleed: 'el sangrado', blind: 'la ceguera', silence: 'el silencio', prone: 'caer al suelo', fear: 'el miedo', grab: 'quedar atrapado', corrode: 'el ácido', curse: 'las maldiciones', stun: 'quedar aturdido' };
  const ELEMENT_WORD = { fire: 'de fuego', cold: 'de hielo', shock: 'eléctrico', poison: 'venenoso' };
  const FX_ELEMENT = { fire: 'fire', cold: 'ice', ice: 'ice', shock: 'shock', poison: 'poison', holy: 'holy' };
  const BUFF_ICON = { dodge: 'boot', damage: 'swords', armor: 'shield', precision: 'target', defense: 'boot', speed: 'boot', regen: 'heal', reflect: 'spark', invisible: 'eye', immune: 'star', invincible: 'crown', resist: 'star' };
  const BUFF_NAME = { dodge: 'Agilidad', damage: 'Fuerza', armor: 'Escudo', precision: 'Puntería', defense: 'Agilidad', speed: 'Prisa', regen: 'Regeneración', reflect: 'Espinas', invisible: 'Invisible', immune: 'Inmune', invincible: 'Invencible', resist: 'Protección' };
  const FLAGS = ['invisible', 'immune', 'invincible'];

  const turnsTxt = (n) => `${n} ${n === 1 ? 'turno' : 'turnos'}`;
  const pctTxt = (x) => `${Math.round(x * 100)}%`;
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const player = () => A.State && A.State.player;
  const rangeTxt = (dice) => {
    const r = A.Balance && A.Balance.rangeOf ? A.Balance.rangeOf(dice) : { min: 0, max: 0 };
    return r.min === r.max ? `${r.min}` : `${r.min} a ${r.max}`;
  };
  const joinY = (arr) => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} y ${arr[arr.length - 1]}`);
  // "la poción de curación", "el pan", "los huevos" (para el narrador)
  const ART = { 'poción': 'la', 'jalea': 'la', 'sopa': 'la', 'botella': 'la', 'jarra': 'la', 'manzana': 'la', 'papa': 'la', 'zanahoria': 'la', 'carne': 'la', 'pulpa': 'la', 'ambrosía': 'la', 'frutillas': 'las', 'huevos': 'los', 'champiñones': 'los' };
  const theName = (item) => { const n = String((item && item.name) || '').toLowerCase(); return `${ART[n.split(' ')[0]] || 'el'} ${n}`; };
  const verbFor = (item) => (item.subtype === 'scroll' ? 'Rompés' : item.subtype === 'food' ? 'Comés' : 'Tomás');
  const accBonus = (p, k) => (A.Accessories ? A.Accessories.bonus(p, k) : 0);
  const noun = (inst) => (A.Narrator && A.Narrator.enemyNoun ? A.Narrator.enemyNoun(inst) : (inst && (inst.displayName || inst.name)) || 'el enemigo');

  // ============================================================
  // Mejoras (buffs)
  // ============================================================

  /** Las mejoras de un efecto: { damage: 3, defense: -2, resist: ['fire'], invisible: true ... } */
  function modsOf(ef) {
    const mods = {};
    if (!ef || ef.type !== 'buff') return mods;
    const add = (k, v) => {
      if (!k) return;
      if (k === 'dodge') k = 'defense'; // el editor viejo decía "esquiva
      if (k === 'resist') { mods.resist = (mods.resist || []).concat(ef.types || []); return; }
      if (FLAGS.includes(k)) { mods[k] = true; return; }
      mods[k] = (mods[k] || 0) + (Number(v) || 0);
    };
    add(ef.stat, ef.amount);
    for (const k of Object.keys(ef.also || {})) add(k, ef.also[k]);
    return mods;
  }

  function buffsOf(entity) {
    return ((entity && entity.effects) || []).filter((e) => e.type === 'buff');
  }

  /** Suma de las mejoras activas de alguien. */
  function buffMods(entity) {
    const out = { damage: 0, armor: 0, precision: 0, defense: 0, speed: 0, regen: 0, reflect: 0, invisible: false, immune: false, invincible: false, resist: [] };
    for (const b of buffsOf(entity)) {
      for (const k of Object.keys(b.mods || {})) {
        const v = b.mods[k];
        if (k === 'resist') out.resist = out.resist.concat(v || []);
        else if (FLAGS.includes(k)) out[k] = out[k] || !!v;
        else out[k] = (out[k] || 0) + (Number(v) || 0);
      }
    }
    return out;
  }

  /** Pone una mejora (si ya tenía la misma, la renueva). */
  function addBuff(p, item) {
    const ef = item.effect || {};
    p.effects = p.effects || [];
    const turns = Math.max(1, ef.duration || 3);
    const mods = modsOf(ef);
    const old = p.effects.find((e) => e.type === 'buff' && e.source === item.id);
    if (old) {
      old.turns = Math.max(old.turns, turns);
      old.mods = mods;
      old.fresh = true;
      return old;
    }
    const buff = { type: 'buff', source: item.id, name: BUFF_NAME[ef.stat] || item.name, stat: ef.stat, mods, turns, value: 1, fresh: true };
    p.effects.push(buff);
    return buff;
  }

  /** Después de cada acción tuya: las mejoras pierden un turno (la recién tomada no). */
  function tickBuffs(p) {
    if (!p || !p.effects) return;
    for (const b of p.effects) {
      if (b.type !== 'buff') continue;
      if (b.fresh) { b.fresh = false; continue; }
      b.turns -= 1;
    }
    p.effects = p.effects.filter((e) => e.type !== 'buff' || e.turns > 0);
  }

  /**
   * ¿Algo de tu equipo o una mejora te protege de este efecto?
   * Devuelve { name } (lo que te protege) o null. Las pasivas de raza las mira Passives.
   */
  function immunityOf(p, type) {
    if (!p) return null;
    const acc = A.Accessories ? A.Accessories.of(p) : {};
    if (Array.isArray(acc.immune) && acc.immune.includes(type)) {
      const it = A.Data.getById('items', p.equipment && p.equipment.accessory);
      return { name: it ? it.name : 'tu accesorio' };
    }
    const armor = p.equipment && p.equipment.armor ? A.Data.getById('armors', p.equipment.armor) : null;
    if (armor && Array.isArray(armor.resist) && armor.resist.includes(type)) return { name: armor.name };
    const m = buffMods(p);
    if ((m.immune && BAD.includes(type)) || m.resist.includes(type)) return { name: 'tu protección' };
    return null;
  }

  /** Ícono y nombre para dibujar un efecto (estados, mejoras, aturdido, maldición). */
  function chip(ef) {
    if (!ef) return { icon: 'question', label: '', cls: '' };
    if (ef.type === 'buff') {
      const k = ef.stat || Object.keys(ef.mods || {})[0] || 'damage';
      return { icon: BUFF_ICON[k] || 'star', label: ef.name || BUFF_NAME[k] || 'Mejora', cls: 'buff' };
    }
    if (ef.type === 'stun') return { icon: 'hourglass', label: 'Aturdido', cls: 'stun' };
    if (ef.type === 'curse') return { icon: 'skull', label: 'Maldición', cls: 'curse' };
    // v2.5: estados de las criaturas
    const NEW = {
      prone: { icon: 'arrow-down', label: 'Derribado (−3 de defensa)' },
      fear: { icon: 'warning', label: 'Miedo (−2 de precisión, −1 de daño)' },
      grab: { icon: 'lock', label: 'Atrapado (no puede huir, −2 de precisión)' },
      corrode: { icon: 'poison', label: 'Ácido (−2 de armadura)' },
      rally: { icon: 'arrow-up', label: `Envalentonado (+${ef.value || 1} de precisión y daño)` },
      guard: { icon: 'shield', label: `En guardia (+${ef.value || 3} de defensa)` },
    };
    if (NEW[ef.type]) return { ...NEW[ef.type], cls: ef.type };
    const label = A.Combat && A.Combat.effectLabel ? A.Combat.effectLabel(ef.type) : ef.type;
    return { icon: ef.type, label: cap(label), cls: ef.type };
  }

  // ============================================================
  // Textos
  // ============================================================

  function statusLine(st) {
    if (!st) return '';
    const v = st.value || 1;
    const t = turnsTxt(st.turns || 3);
    switch (st.type) {
      case 'fire': return `Lo prende fuego: pierde ${v} de vida por turno durante ${t}`;
      case 'poison': return `Lo envenena: pierde ${v} de vida por turno durante ${t}`;
      case 'bleed': return `Lo hace sangrar: pierde ${v} de vida por turno durante ${t}`;
      case 'shock': return `Lo electriza: puede perder el turno durante ${t}`;
      case 'cold': return `Lo congela: pega peor y le pegás más fácil durante ${t}`;
      case 'blind': return `Lo ciega: casi no acierta durante ${t}`;
      default: return '';
    }
  }

  function buffPart(ef, k, v) {
    const sg = (n) => `${n > 0 ? '+' : ''}${n}`;
    switch (k) {
      case 'damage': return `${sg(Number(v))} de daño`;
      case 'armor': return `${sg(Number(v))} de armadura`;
      case 'precision': return `${sg(Number(v))} de precisión`;
      case 'defense': case 'dodge': return `${sg(Number(v))} de defensa`;
      case 'speed': return `${sg(Number(v))} de velocidad`;
      case 'regen': return `recuperás ${v} de vida al empezar cada turno`;
      case 'reflect': return `el que te pega recibe el ${pctTxt(v)} del golpe`;
      case 'invisible': return 'los ataques te fallan';
      case 'immune': return 'ningún efecto malo te toca';
      case 'invincible': return 'nada te hace daño';
      case 'resist': return `${joinY((ef.types || []).map((x) => WORD[x] || x))} no te afecta`;
      default: return '';
    }
  }

  function buffLine(ef) {
    const parts = [buffPart(ef, ef.stat, ef.amount)];
    for (const k of Object.keys(ef.also || {})) parts.push(buffPart(ef, k, ef.also[k]));
    const line = `${joinY(parts.filter(Boolean))} por ${turnsTxt(ef.duration || 3)}`;
    return ef.cleanse ? `Te limpia de todo mal, y ${line}` : cap(line);
  }

  /** Lo que hace un objeto, en líneas cortas (para la ficha, la tienda y el combate). */
  function describe(item) {
    if (!item) return [];
    const ef = item.effect || {};
    const out = [];
    switch (ef.type) {
      case 'heal':
        if (ef.pct) out.push(ef.pct >= 1 ? 'Te cura toda la vida' : `Te cura el ${pctTxt(ef.pct)} de tu vida`);
        else if (ef.amount) out.push(`Te cura ${ef.amount} de vida (de ${rangeTxt(ef.amount)})`);
        if (ef.pet) out.push('También cura a tu mascota (y la despierta)');
        break;
      case 'mana':
        out.push(`Te devuelve ${ef.amount} de maná (de ${rangeTxt(ef.amount)})`);
        break;
      case 'food':
        if (ef.amount) out.push(`+${ef.amount} de comida`);
        if (ef.heal) out.push(`+${ef.heal} de vida`);
        break;
      case 'cure':
        out.push(`Te quita ${WORD[ef.status] || 'el efecto'}`);
        break;
      case 'cleanse':
        out.push(`Te quita el veneno, el fuego, el sangrado, el frío y todo lo malo${ef.pct ? `, y te cura el ${pctTxt(ef.pct)} de tu vida` : ''}`);
        break;
      case 'restore':
        out.push('Te devuelve toda la vida y el maná, y te limpia de todo mal');
        break;
      case 'buff':
        out.push(buffLine(ef));
        break;
      case 'damage': {
        const el = ELEMENT_WORD[ef.element] ? ` ${ELEMENT_WORD[ef.element]}` : '';
        out.push(`${ef.dice} de daño${el} ${ef.all ? 'a todos los enemigos' : 'a un enemigo'} (de ${rangeTxt(ef.dice)}). No falla`);
        if (ef.status) out.push(statusLine(ef.status));
        if (ef.stun) out.push(ef.stun === 1 ? 'Pierde su próximo turno' : `Pierde ${ef.stun} turnos`);
        if (ef.drain) out.push('Recuperás la vida que le sacás');
        break;
      }
      case 'stun': {
        const who = ef.all ? 'Todos los enemigos pierden' : 'El enemigo pierde';
        out.push(`${who} ${ef.turns === 1 ? 'su próximo turno' : `${ef.turns} turnos`}${(ef.turns || 1) > 1 ? ' (un jefe, solo uno)' : ''}`);
        if (ef.status) out.push(statusLine(ef.status));
        break;
      }
      case 'curse':
        out.push(`-${ef.amount} a la precisión y a la defensa del enemigo por ${turnsTxt(ef.duration || 3)}`);
        break;
      case 'survivor':
        out.push('Si en esta pelea un golpe te iba a matar, quedás con un cuarto de tu vida');
        break;
      case 'escape':
        out.push('Te saca de la pelea al instante, sin tirar el dado');
        break;
      default: break;
    }
    if (ef.heal && ef.type !== 'food' && ef.type !== 'heal') out.push(`+${ef.heal} de vida`);
    if (item.healAmount) out.push(`Te cura ${item.healAmount} de vida`);
    if (item.foodValue) out.push(`+${item.foodValue} de comida`);
    return out.filter(Boolean);
  }

  /** Una sola línea corta (para los botones de combate y las etiquetas). */
  function summary(item) {
    return describe(item).join('. ');
  }

  function combatOnly(item) {
    const ef = (item && item.effect) || {};
    return COMBAT_ONLY.includes(ef.type);
  }

  // ============================================================
  // Curar, comer, limpiar (dentro y fuera del combate)
  // ============================================================

  function removeBad(p, types) {
    const before = (p.effects || []).filter((e) => types.includes(e.type)).map((e) => e.type);
    p.effects = (p.effects || []).filter((e) => !types.includes(e.type));
    return [...new Set(before)];
  }

  /** Cura con el extra de los accesorios (Cruz sagrada). */
  function boosted(p, hp) {
    const extra = accBonus(p, 'heal');
    return extra > 0 ? Math.round(hp * (1 + extra)) : hp;
  }

  /**
   * Aplica vida, maná, comida y limpieza. Devuelve { parts, hp, mana, food, why }.
   * parts vacío = no hizo nada (why dice por qué).
   */
  function restore(p, item) {
    const ef = item.effect || {};
    const parts = [];
    let hp = 0;
    let mana = 0;
    let food = 0;
    if (ef.type === 'heal') hp += ef.pct ? Math.round(p.maxHp * ef.pct) : A.Utils.rollDice(ef.amount);
    if (ef.heal && ef.type !== 'heal') hp += A.Utils.rollDice(String(ef.heal));
    if (item.healAmount) hp += item.healAmount;
    if (ef.type === 'cleanse' && ef.pct) hp += Math.round(p.maxHp * ef.pct);
    if (hp > 0) hp = boosted(p, hp);
    if (ef.type === 'restore') hp = p.maxHp;

    if (ef.type === 'food') food += ef.amount || 0;
    if (ef.hungerRestore) food += ef.hungerRestore;
    if (item.hungerRestore) food += item.hungerRestore;
    if (item.foodValue) food += item.foodValue;

    if (ef.type === 'mana') mana += A.Utils.rollDice(ef.amount);
    if (ef.manaRestore) mana += A.Utils.rollDice(ef.manaRestore);
    if (ef.type === 'restore') mana = p.maxMana || 0;

    const out = { parts, hp: 0, mana: 0, food: 0, cleaned: [], why: '' };
    if (hp > 0 && p.hp < p.maxHp) {
      const b = p.hp;
      A.State.healHp(hp);
      out.hp = p.hp - b;
      if (out.hp > 0) parts.push(`+${out.hp} salud`);
    }
    if (food > 0) {
      const b = p.food || 0;
      const max = p.maxFood || 20;
      if (b < max) {
        p.food = Math.min(max, b + food);
        out.food = p.food - b;
        if (out.food > 0) parts.push(`+${out.food} comida`);
        A.Bus.emit('player:food-changed', { current: p.food, max });
      }
    }
    if (mana > 0 && p.hasMagic && p.mana < p.maxMana) {
      const b = p.mana || 0;
      A.State.setMana(b + mana);
      out.mana = p.mana - b;
      if (out.mana > 0) parts.push(`+${out.mana} maná`);
    }
    let cleaned = [];
    if (ef.type === 'cure' && ef.status) cleaned = removeBad(p, [ef.status]);
    if (ef.type === 'cleanse' || ef.type === 'restore') cleaned = removeBad(p, BAD);
    out.cleaned = cleaned;
    if (cleaned.length) parts.push(`sin ${joinY(cleaned.map((t) => (WORD[t] || t).replace(/^(el|la|los) /, '')))}`);

    // mascota (Pergamino de curación masiva)
    if (ef.pet && p.pet) {
      const pet = p.pet;
      const max = pet.maxHealth || 1;
      if (pet.health < max) {
        const wasKO = pet.health <= 0;
        const b = pet.health;
        pet.health = Math.min(max, pet.health + Math.max(1, Math.round(max * (ef.pct || 0.5))));
        if (pet.health > b) parts.push(`${pet.name} +${pet.health - b}${wasKO ? ' (despertó)' : ''}`);
      }
    }

    if (!parts.length) {
      if (ef.type === 'food' || item.subtype === 'food') out.why = `${item.name}: ya estás saciado, no podés comer más.`;
      else if (ef.type === 'mana') out.why = p.hasMagic ? `${item.name}: ya tenés el maná completo.` : `${item.name}: tu sangre no canaliza maná.`;
      else if (ef.type === 'cure' || ef.type === 'cleanse') out.why = `${item.name}: no tenés nada que curar.`;
      else out.why = `${item.name}: ya estás con salud completa.`;
    }
    return out;
  }

  /**
   * ¿Se puede usar ahora, fuera de combate? (para no gastar el objeto de gusto)
   * Devuelve { ok, why }.
   */
  function usableNow(item) {
    const p = player();
    if (!p || !item) return { ok: false, why: '' };
    const ef = item.effect || {};
    if (combatOnly(item)) return { ok: false, why: 'Se usa en combate.' };
    const hurt = p.hp < p.maxHp;
    const hungry = (p.food || 0) < (p.maxFood || 20);
    const lowMana = p.hasMagic && p.mana < p.maxMana;
    const petHurt = !!(ef.pet && p.pet && p.pet.health < (p.pet.maxHealth || 1));
    const heals = ef.type === 'heal' || !!item.healAmount || !!ef.heal || (ef.type === 'cleanse' && ef.pct);
    const feeds = ef.type === 'food' || !!item.foodValue || !!item.hungerRestore || !!ef.hungerRestore;
    const mana = ef.type === 'mana' || !!ef.manaRestore;
    if (ef.type === 'restore') return hurt || lowMana ? { ok: true } : { ok: false, why: 'Ya estás con la vida y el maná completos.' };
    if ((heals && hurt) || (feeds && hungry) || (mana && lowMana) || petHurt) return { ok: true };
    if (ef.type === 'cure' || ef.type === 'cleanse') return { ok: false, why: 'No tenés nada que curar.' };
    if (mana && !p.hasMagic) return { ok: false, why: 'Tu sangre no canaliza maná.' };
    if (mana) return { ok: false, why: 'Ya tenés el maná completo.' };
    if (feeds && !heals) return { ok: false, why: 'Ya estás lleno: no te entra más.' };
    if (heals && !feeds) return { ok: false, why: 'Ya estás con la vida completa.' };
    if (heals || feeds) return { ok: false, why: 'Ya estás lleno y con la vida completa.' };
    return { ok: false, why: '' };
  }

  /**
   * Usa un objeto FUERA de combate. No lo saca de la mochila (eso lo hace Inventory).
   * Devuelve { ok, text }.
   */
  function useOutside(item) {
    const p = player();
    if (!p || !item) return { ok: false, text: '' };
    if (combatOnly(item)) return { ok: false, text: `${item.name}: se usa en combate.` };
    const r = restore(p, item);
    if (!r.parts.length) return { ok: false, text: r.why };
    return { ok: true, text: `Usaste ${item.name}: ${r.parts.join(', ')}.` };
  }

  // ============================================================
  // En combate
  // ============================================================

  const HIT_LINES = {
    fire: ['Rompés el pergamino y una llamarada envuelve a {e}: {d} de daño.', 'Las llamas alcanzan también a {e}: {d} de daño.'],
    cold: ['Rompés el pergamino y el hielo atrapa a {e}: {d} de daño.', 'La escarcha alcanza también a {e}: {d} de daño.'],
    shock: ['Rompés el pergamino y un rayo cae sobre {e}: {d} de daño.', 'El rayo salta y alcanza a {e}: {d} de daño.'],
    poison: ['Rompés el pergamino y una nube verde envuelve a {e}: {d} de daño.', 'La nube alcanza también a {e}: {d} de daño.'],
    arcane: ['Rompés el pergamino y la magia golpea a {e}: {d} de daño.', 'La magia alcanza también a {e}: {d} de daño.'],
  };
  const fill = (tpl, v) => tpl.replace(/\{(\w)\}/g, (_, k) => (v[k] != null ? v[k] : ''));

  /** Deja a un enemigo sin turnos (a los jefes, como mucho uno). Devuelve los turnos que quedó. */
  function stunEnemy(t, turns, source) {
    const n = t.category === 'boss' ? 1 : Math.max(1, turns || 1);
    t.effects = t.effects || [];
    const old = t.effects.find((e) => e.type === 'stun');
    if (old) old.turns = Math.max(old.turns, n);
    else t.effects.push({ type: 'stun', turns: n, value: 1, source });
    return n;
  }

  function logStatus(ctx, t, st, source) {
    if (!st || t.hp <= 0) return;
    if (!ctx.applyStatus(t, st.type, { turns: st.turns || 3, value: st.value || 1, source })) return;
    ctx.log('system', { text: `${t.displayName} sufre ${ctx.effectLabel(st.type)}.`, fx: { kind: 'status', target: ctx.fxKey(t), effect: st.type } });
  }

  function logStun(ctx, t, n) {
    const E = cap(noun(t));
    ctx.log('system', {
      text: `${t.displayName} pierde ${n === 1 ? 'su próximo turno' : `${n} turnos`}.`,
      fx: { kind: 'status', target: ctx.fxKey(t), effect: 'stun' },
      say: { text: n === 1 ? `${E} queda paralizado: pierde su próximo turno.` : `${E} queda paralizado: pierde ${n} turnos.`, tone: 'good' },
    });
  }

  function scrollDamage(c, p, item, ctx) {
    const ef = item.effect;
    const targets = ef.all ? ctx.alive() : [ctx.target()].filter(Boolean);
    if (!targets.length) return { ok: false, why: 'No hay a quién apuntarle.' };
    const lines = HIT_LINES[ef.element] || HIT_LINES.arcane;
    let drained = 0;
    targets.forEach((t, i) => {
      const raw = A.Utils.rollDice(ef.dice);
      const armor = Math.floor((t.armor || 0) / 2);
      const dmg = Math.max(1, raw - armor);
      t.hp = Math.max(0, t.hp - dmg);
      drained += dmg;
      ctx.log('player', {
        text: `${item.name}: ${t.displayName} recibe ${dmg} de daño`,
        actor: p.name, target: t.displayName,
        rawDmg: raw, targetArmor: armor, dmg, hpAfter: t.hp, hpMax: t.maxHp,
        damageDice: ef.dice, spell: item.name, result: 'hit', item: item.id,
        fx: { kind: 'spell', actor: 'player', target: ctx.fxKey(t), element: FX_ELEMENT[ef.element] || 'arcane' },
        say: { text: fill(lines[i === 0 ? 0 : 1], { e: noun(t), d: dmg }), tone: 'good' },
      });
      if (t.hp > 0) logStatus(ctx, t, ef.status, item.id);
      if (t.hp > 0 && ef.stun) logStun(ctx, t, stunEnemy(t, ef.stun, item.id));
      if (t.hp <= 0) ctx.died(t);
    });
    if (ef.drain && drained > 0 && p.hp < p.maxHp) {
      const b = p.hp;
      A.State.healHp(drained);
      const got = p.hp - b;
      if (got > 0) {
        ctx.log('system', {
          text: `Recuperás ${got} de vida.`,
          fx: { kind: 'heal', actor: 'player', target: 'player', amount: got },
          say: { text: `La vida que le sacás pasa a vos: recuperás ${got}.`, tone: 'good' },
        });
      }
    }
    return { ok: true };
  }

  function scrollStun(c, p, item, ctx) {
    const ef = item.effect;
    const targets = ef.all ? ctx.alive() : [ctx.target()].filter(Boolean);
    if (!targets.length) return { ok: false, why: 'No hay a quién apuntarle.' };
    ctx.log('player', {
      text: `Usaste ${item.name}.`,
      fx: { kind: 'cast', actor: 'player' },
      say: { text: `${verbFor(item)} ${theName(item)}.`, tone: 'neutral' },
    });
    for (const t of targets) {
      logStun(ctx, t, stunEnemy(t, ef.turns || 1, item.id));
      logStatus(ctx, t, ef.status, item.id);
    }
    return { ok: true };
  }

  function scrollCurse(c, p, item, ctx) {
    const ef = item.effect;
    const t = ctx.target();
    if (!t) return { ok: false, why: 'No hay a quién apuntarle.' };
    t.effects = t.effects || [];
    const old = t.effects.find((e) => e.type === 'curse');
    const turns = ef.duration || 3;
    const value = Number(ef.amount) || 1;
    if (old) { old.turns = Math.max(old.turns, turns); old.value = Math.max(old.value, value); }
    else t.effects.push({ type: 'curse', turns, value, source: item.id });
    ctx.log('player', {
      text: `${item.name}: ${t.displayName} queda maldito (-${value} precisión y defensa).`,
      fx: { kind: 'status', target: ctx.fxKey(t), effect: 'curse' },
      say: { text: `Una marca oscura cae sobre ${noun(t)}: pega peor y le pegás más fácil.`, tone: 'good' },
    });
    return { ok: true };
  }

  function useBuff(c, p, item, ctx) {
    const ef = item.effect;
    if (ef.cleanse) removeBad(p, BAD);
    if (ef.stat === 'resist') removeBad(p, ef.types || []);
    const b = addBuff(p, item);
    const ch = chip(b);
    const what = buffLine(ef).replace(/^Te limpia de todo mal, y /, '');
    ctx.log('player', {
      text: `Usaste ${item.name}: ${what}.`,
      fx: { kind: 'buff', actor: 'player', target: 'player', label: ch.label, icon: ch.icon },
      say: { text: `${verbFor(item)} ${theName(item)}: ${what.charAt(0).toLowerCase()}${what.slice(1)}.`, tone: 'good' },
    });
    return { ok: true };
  }

  /**
   * Usa un objeto EN combate (gasta el turno). No lo saca de la mochila.
   * ctx lo arma combat.js: { log, alive, target, fxKey, applyStatus, effectLabel, died }.
   * Devuelve { ok, why, escape }.
   */
  function useInCombat(c, item, ctx) {
    const p = player();
    if (!p || !item) return { ok: false };
    const ef = item.effect || {};
    switch (ef.type) {
      case 'escape': return { ok: true, escape: true };
      case 'buff': return useBuff(c, p, item, ctx);
      case 'damage': return scrollDamage(c, p, item, ctx);
      case 'stun': return scrollStun(c, p, item, ctx);
      case 'curse': return scrollCurse(c, p, item, ctx);
      case 'survivor': {
        if (c.itemSurvivor) return { ok: false, why: 'Ya tenés esa protección en esta pelea.' };
        c.itemSurvivor = 0.25;
        ctx.log('player', {
          text: `Usaste ${item.name}.`,
          fx: { kind: 'buff', actor: 'player', target: 'player', label: 'Protegido', icon: 'heart' },
          say: { text: 'El pergamino se quema y una luz se te mete en el pecho: esta pelea no te mata.', tone: 'good' },
        });
        return { ok: true };
      }
      default: {
        const r = restore(p, item);
        if (!r.parts.length) return { ok: false, why: r.why };
        let text = `Usaste ${item.name}.`;
        if (r.hp > 0) text += ` (+${r.hp} salud)`;
        if (r.mana > 0) text += ` (+${r.mana} maná)`;
        const got = [];
        if (r.hp > 0) got.push(`${r.hp} de vida`);
        if (r.mana > 0) got.push(`${r.mana} de maná`);
        let say;
        if (got.length) say = `${verbFor(item)} ${theName(item)}: recuperás ${joinY(got)}.`;
        else if (r.cleaned.length) say = `${verbFor(item)} ${theName(item)}: te sacás de encima ${joinY(r.cleaned.map((t) => WORD[t] || t))}.`;
        else if (r.food > 0) say = `${verbFor(item)} ${theName(item)} al paso: +${r.food} de comida.`;
        else say = `${verbFor(item)} ${theName(item)}.`;
        ctx.log('player', { text, fx: { kind: 'heal', actor: 'player', target: 'player', amount: r.hp, mana: r.mana }, say: { text: say, tone: 'good' } });
        return { ok: true };
      }
    }
  }

  /**
   * Antes de que te saquen vida: Invencible (pergamino), Superviviente (accesorio, una vez
   * por pelea) y Resurrección (pergamino, una vez). Devuelve { dmg, tag }.
   */
  function guard(c, p, dmg) {
    if (!p || dmg <= 0) return { dmg, tag: null };
    if (buffMods(p).invincible) return { dmg: 0, tag: 'invincible' };
    if (p.hp - dmg > 0 || !c) return { dmg, tag: null };
    const used = c.itemUsed || (c.itemUsed = {});
    if (A.Accessories && A.Accessories.has(p, 'survivor') && !used.survivor) {
      used.survivor = true;
      return { dmg: Math.max(0, p.hp - 1), tag: 'survivor' };
    }
    if (c.itemSurvivor && !used.resurrect) {
      used.resurrect = true;
      const keep = Math.max(1, Math.round(p.maxHp * c.itemSurvivor));
      if (p.hp > keep) return { dmg: p.hp - keep, tag: 'resurrect' };
      if (keep > p.hp) A.State.healHp(keep - p.hp);
      return { dmg: 0, tag: 'resurrect' };
    }
    return { dmg, tag: null };
  }

  // ============================================================
  // v2.5: armas que dejan un estado al pegar (la daga hace sangrar)
  // ============================================================

  const PROC_WORD = { bleed: 'hacer sangrar', poison: 'envenenar', fire: 'prender fuego', cold: 'congelar', shock: 'electrizar', blind: 'cegar', silence: 'dejar sin voz', stun: 'aturdir', prone: 'tirar al suelo', fear: 'asustar' };

  /** "20% de hacer sangrar: 1 de daño por turno durante 3 turnos" (o null si el arma no tiene). */
  function weaponEffectLine(w) {
    const st = w && w.statusEffect;
    if (!st || !st.type || !st.chance) return null;
    const pct = `${Math.round(st.chance * 100)}%`;
    const v = st.value || 1;
    const t = turnsTxt(st.turns || 3);
    switch (st.type) {
      case 'bleed': case 'poison': case 'fire':
        return `${pct} de chance de ${PROC_WORD[st.type]} al pegar: ${v} de daño por turno durante ${t}`;
      case 'cold': return `${pct} de chance de congelar al pegar: pega peor y le pegás más fácil durante ${t}`;
      case 'shock': return `${pct} de chance de electrizar al pegar: puede perder el turno durante ${t}`;
      case 'blind': return `${pct} de chance de cegar al pegar: casi no acierta durante ${t}`;
      default: return `${pct} de chance de ${PROC_WORD[st.type] || st.type} al pegar (${t})`;
    }
  }

  /** Lo que cuenta el narrador cuando tu arma deja el estado. Para hechizos devuelve null. */
  function weaponProcLine(source, target) {
    if (!source || !source.statusEffect || source.manaCost != null || !A.Data.getById('weapons', source.id)) return null;
    const w = source.name.toLowerCase();
    const e = A.Narrator && A.Narrator.enemyNoun ? A.Narrator.enemyNoun(target) : (target.displayName || 'el enemigo');
    const E = cap(e);
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let out;
    switch (source.statusEffect.type) {
      case 'bleed': out = pick([`Tu ${w} le abre una herida a ${e}: empieza a sangrar.`, `El filo de tu ${w} deja un tajo profundo: ${e} sangra.`]); break;
      case 'poison': out = `El veneno de tu ${w} entra en la sangre de ${e}.`; break;
      case 'fire': out = pick([`Tu ${w} le prende fuego a ${e}.`, `Las llamas de tu ${w} alcanzan a ${e}: se prende fuego.`]); break;
      case 'cold': out = `El frío de tu ${w} entumece a ${e}.`; break;
      case 'shock': out = `Tu ${w} suelta una descarga que sacude a ${e}.`; break;
      case 'blind': out = `Tu ${w} encandila a ${e}: no ve nada.`; break;
      default: out = `${E} sufre el efecto de tu ${w}.`;
    }
    return A.Narrator && A.Narrator.contract ? A.Narrator.contract(out) : out;
  }

  A.ItemFx = {
    BAD,
    weaponEffectLine,
    weaponProcLine,
    modsOf,
    buffMods,
    addBuff,
    tickBuffs,
    immunityOf,
    chip,
    describe,
    summary,
    combatOnly,
    usableNow,
    restore,
    useOutside,
    useInCombat,
    guard,
    stunEnemy,
  };
})(window.Aventurs);
