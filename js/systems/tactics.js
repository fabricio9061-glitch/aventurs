/* ============================================================
   Aventurs — v3.15: criaturas más inteligentes

   Cada criatura tiene un nivel de inteligencia según su familia:
     0 simple  — animales, bichos, plantas, babosas, gólems, zombis y esqueletos
     1 normal  — humanoides, gigantes, espíritus, hadas y dragones jóvenes
     2 lista   — magos (arcanos), demonios, aberraciones, celestiales, dragones
                 grandes y todos los jefes (la élite sube un nivel)
   (`iq: 0|1|2` en la criatura manda sobre esto.)

   Lo que hacen según cuán listas son:
   - A quién atacar: las simples, a cualquiera. Las demás rematan al más
     herido y prefieren al de menos armadura; las listas van primero contra
     el que se cura (ángel, dríade, vampiro) y su mascota si cura.
   - Habilidades en el momento justo (js/systems/skills.js usa adjust()):
     curarse cuando están mal (no con la vida llena), invocar o enfurecerse
     con poca vida, aturdir o dormir al más peligroso, cortar la curación
     del que se cura.
   - En equipo: la manada se tira sobre el mismo blanco; el chamán cura a
     los suyos; los escoltas se ponen delante del jefe herido.
   - Huir: las débiles (y las cobardes) que quedan solas y heridas a veces
     escapan. La que huye no deja botín (y da la mitad de experiencia).
   ============================================================ */

(function (A) {
  'use strict';

  const B = () => A.Balance || {};
  const State = () => A.State;

  const SMART = ['arcane', 'demon', 'aberration', 'celestial'];
  const NORMAL = ['humanoid', 'giant', 'spirit', 'fey', 'alien', 'dragon'];
  const HEALER_RACES = ['angel', 'driade', 'vampiro'];
  const CONTROL = ['stun', 'sleep', 'fear', 'grab', 'silence', 'blind'];

  // Huir: chance por turno, cuando queda sola y con menos de esta vida
  const FLEE = { chance: 0.35, below: 0.5 };
  // Pegarle a la mascota (en solitario): la base de siempre y lo que cambia
  const PET = { base: 0.30, finishPet: 0.55, finishHero: 0.12, healerPet: 0.5 };

  function dataOf(x) { return x ? A.Data.getById('enemies', x.id) || x : null; }

  /** 0 simple · 1 normal · 2 lista. */
  function iq(x) {
    if (!x) return 0;
    const d = dataOf(x) || {};
    let n;
    if (d.iq === 0 || d.iq === 1 || d.iq === 2) n = d.iq;
    else if (x.category === 'boss' || d.category === 'boss') n = 2;
    else {
      const fam = d.family || x.family || [];
      if (fam.some((f) => SMART.includes(f))) n = 2;
      else if (fam.includes('dragon')) n = (d.tier || 1) >= 9 ? 2 : 1;
      else if (fam.includes('undead')) n = fam.includes('humanoid') || fam.includes('spirit') ? 1 : 0;
      else if (fam.some((f) => NORMAL.includes(f))) n = 1;
      else n = 0;
    }
    if (x.elite) n = Math.min(2, n + 1);
    return n;
  }

  const ratio = (cur, max) => (max > 0 ? cur / max : 1);
  function isHealer(h) {
    if (!h) return false;
    if (HEALER_RACES.includes(h.raceId)) return true;
    return false;
  }
  function petHeals(pet) {
    if (!pet || !A.Skills) return false;
    return A.Skills.listFor(pet).some((s) => s.act === 'heal' || s.act === 'healAlly');
  }
  function armorOf(h) {
    try { return (B().playerCombatStats ? B().playerCombatStats(h).armor : 0) || 0; } catch (e) { return 0; }
  }
  function packOf(c, x) {
    if (!c) return [];
    return c.enemies.filter((e) => e !== x && e.hp > 0 && e.id === x.id);
  }
  /** La manada: los que tienen Manada o son animales del mismo tipo. */
  function hunts(c, x) {
    if (!packOf(c, x).length) return false;
    if (A.Skills && A.Skills.has(x, 'manada')) return true;
    const fam = (dataOf(x) || {}).family || [];
    return fam.includes('beast') || fam.includes('insect');
  }

  /**
   * En grupo: a qué héroe le pega esta criatura.
   * heroes: los que están en pie.
   */
  function pickHero(c, x, heroes) {
    const up = (heroes || []).filter((h) => h && h.hp > 0);
    if (!up.length) return null;
    if (up.length === 1) return up[0];
    const hid = (h) => (A.State.hidOf ? A.State.hidOf(h) : h.name);
    // La manada se tira sobre el mismo blanco
    const focus = c && c._focus && c._focus[x.id];
    if (focus && hunts(c, x)) {
      const same = up.find((h) => hid(h) === focus);
      if (same && Math.random() < 0.75) return same;
    }
    const n = iq(x);
    let pick;
    if (n === 0) pick = up[Math.floor(Math.random() * up.length)];
    else {
      const armors = up.map(armorOf);
      const avgArmor = armors.reduce((s, a) => s + a, 0) / armors.length;
      const w = up.map((h, i) => {
        const r = ratio(h.hp, h.maxHp);
        let v = 1 + 1.5 * (1 - r);          // el más herido
        if (r < 0.25) v *= 2;               // rematar
        v *= (avgArmor + 3) / (armors[i] + 3); // el de menos armadura
        if (n >= 2 && isHealer(h)) v *= 1.8;    // primero el que cura
        return v;
      });
      const total = w.reduce((s, v) => s + v, 0);
      let r = Math.random() * total;
      pick = up[up.length - 1];
      for (let i = 0; i < up.length; i++) { r -= w[i]; if (r <= 0) { pick = up[i]; break; } }
    }
    if (c && hunts(c, x)) (c._focus = c._focus || {})[x.id] = hid(pick);
    return pick;
  }

  /** Chance de que el golpe vaya a tu mascota y no a vos. */
  function petChance(c, x, hero, pet) {
    const n = iq(x);
    // La manada sigue al primero que mordió
    const focus = c && c._petFocus && c._petFocus[x.id];
    if (focus && hunts(c, x)) return focus === 'pet' ? 0.7 : 0.1;
    if (n === 0) return PET.base;
    const rp = ratio(pet.health, pet.maxHealth || pet.maxHp || pet.health);
    const rh = ratio(hero.hp, hero.maxHp);
    if (rh < 0.3) return PET.finishHero;             // a vos te falta poco
    if (rp < 0.25 && rh > 0.5) return PET.finishPet; // a tu mascota le falta poco
    if (n >= 2 && petHeals(pet) && !isHealer(hero)) return PET.healerPet; // la que cura, primero
    return PET.base;
  }
  /** Para la manada: a quién le pegó (así los demás van al mismo). */
  function notePetTarget(c, x, toPet) {
    if (!c || !hunts(c, x)) return;
    (c._petFocus = c._petFocus || {})[x.id] = toPet ? 'pet' : 'hero';
  }

  /**
   * Habilidades en el momento justo: cambia el peso de cada una y marca las urgentes
   * (las que una criatura lista no deja pasar). opts: [{ sk, w }].
   */
  function adjust(x, opts, k) {
    const n = iq(x);
    if (!n) return opts;
    const p = A.State.player;
    const mine = ratio(x.hp, x.maxHp);
    const theirs = p ? ratio(p.hp, p.maxHp) : 1;
    const out = [];
    for (const o of opts) {
      const sk = o.sk;
      let w = o.w;
      let urgent = false;
      switch (sk.act) {
        case 'heal':
          if (mine > 0.6) w = 0;                 // con la vida llena no se cura
          else if (mine < 0.35) { w *= 3; urgent = true; }
          break;
        case 'healAlly': {
          const low = k.alive().some((e) => e.hp > 0 && ratio(e.hp, e.maxHp) < 0.4);
          if (low) { w *= 2; urgent = true; }
          break;
        }
        case 'summon': case 'rally':
          if (mine < 0.5) { w *= 2; if (n >= 2) urgent = true; }
          break;
        case 'debuff':
          if (sk.status === 'noheal' && p && isHealer(p)) { w *= 3; if (n >= 2) urgent = true; }
          else if (n >= 2 && CONTROL.includes(sk.status) && theirs > 0.5) w *= 2; // al más peligroso, cuando está entero
          else if (n >= 2 && sk.status === 'silence' && p && p.hasMagic) w *= 2;
          break;
        default:
          if (sk.onHit && sk.onHit.type === 'noheal' && p && isHealer(p)) w *= 2.5;
          if (n >= 2 && sk.onHit && CONTROL.includes(sk.onHit.type) && theirs > 0.5) w *= 1.5;
          // la furia y los golpes de "cuando está mal", con poca vida
          if (sk.when === 'hurt') w *= 1.5;
          break;
      }
      if (w > 0) out.push({ sk, w, urgent });
    }
    return out;
  }

  /**
   * Antes del turno de una criatura: huir o cubrir al jefe.
   * Devuelve 'fled' si se fue (el turno termina) o null.
   */
  function beforeTurn(c, x, k) {
    if (!c || !x || x.hp <= 0) return null;
    const n = iq(x);
    const d = dataOf(x) || {};
    const alive = c.enemies.filter((e) => e.hp > 0);
    // Huir: débil o cobarde, sola, herida, y la pelea empezó con más de una
    const started = c.enemies.filter((e) => !e.summoned).length;
    const coward = d.coward === true || x.category === 'weak';
    const stuck = (x.effects || []).some((e) => ['stun', 'grab', 'sleep', 'prone'].includes(e.type));
    if (coward && !x.summoned && x.category !== 'boss' && !x.miniBoss && alive.length === 1 && started >= 2 && !stuck
      && ratio(x.hp, x.maxHp) < FLEE.below && Math.random() < FLEE.chance) {
      x.fled = true;
      x.hp = 0;
      k.log('system', {
        text: `${x.displayName} huye.`,
        fled: x.displayName,
        fx: { kind: 'death', target: k.fxKey(x) },
        say: { text: A.Skills.fill('{E} se ve sola, da media vuelta y sale corriendo. Se lleva lo que tenía encima.', x), tone: 'neutral' },
      });
      return 'fled';
    }
    // Los escoltas se ponen delante del jefe herido (una vez por ronda)
    if (n >= 1 && x.category !== 'boss') {
      const boss = alive.find((e) => e !== x && (e.category === 'boss' || e.miniBoss) && ratio(e.hp, e.maxHp) < 0.6);
      if (boss && (c._covered || 0) !== c.round && !(boss.effects || []).some((e) => e.type === 'guard')) {
        c._covered = c.round;
        boss.effects = boss.effects || [];
        boss.effects.push({ type: 'guard', turns: 2, value: 2, source: 'escolta' });
        k.log('enemy', {
          text: `${x.displayName} cubre a ${boss.displayName} (+2 de defensa).`,
          fx: { kind: 'status', target: k.fxKey(boss), effect: 'guard' },
          say: { text: A.Skills.fill(`{E} se pone delante de ${A.Skills ? A.Skills.noun(boss) : boss.displayName} para cubrirlo.`, x), tone: 'bad' },
        });
      }
    }
    return null;
  }

  A.Tactics = { iq, pickHero, petChance, notePetTarget, adjust, beforeTurn, isHealer, FLEE, PET, HEALER_RACES };
})(window.Aventurs);
