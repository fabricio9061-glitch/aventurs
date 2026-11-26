/* ============================================================
   Aventurs — State
   Estado de la partida actual + persistencia.

   Estructura:
     player     - { name, raceId, level, xp, hp, maxHp, mana, maxMana,
                    hasMagic, bagId, pet,
                    stats: {speed, precision, armor, damage, dodge},
                    equipment: {weapon, armor, accessory},
                    inventory: [{itemId, qty}],
                    coins: {copper, silver, gold},
                    spells: [spellId] }
     world      - { regionId, visited:[regionId], npcsTalked:[npcId] }
     combat     - null o { ... } (Fase 2)
     traveling  - null o { fromId, toId, totalSteps, currentStep, events, completed }
     ui         - { activeTab, openModal, modalPayload }
     chronicles - [{ ts, type, text, regionId }]
   ============================================================ */

(function (A) {
  'use strict';

  const STORAGE_KEY = 'aventurs:save';
  const DEFAULT_BAG_ID = 'bag_basic';

  /** v3.0: cada cuenta guarda su propia partida ("aventurs:save:usuario"). */
  function storageKey() {
    const user = A.Accounts && A.Accounts.current ? A.Accounts.current() : null;
    return user ? `${STORAGE_KEY}:${user}` : STORAGE_KEY;
  }

  const State = {
    player: null,
    world: null,
    combat: null,
    traveling: null,
    ui: { activeTab: 'world', openModal: null, modalPayload: null, showMap: false },
    chronicles: [],
    // v1.7.0: preferencias persistentes del jugador
    prefs: { travelMode: 'manual' },
    // v3.0: grupo (js/net/party.js) y héroe en contexto
    party: null,
    _ctx: null,

    // ---------- Lifecycle ----------

    load() {
      try {
        const raw = localStorage.getItem(storageKey());
        if (!raw) return false;
        const data = JSON.parse(raw);
        const player = data.player || null;
        // v1.5.0: cambio mayor en estructura (monedas, food, armadura). Si el save
        // es anterior, forzamos reset y avisamos.
        if (player && (!player.schemaVersion || player.schemaVersion < 15)) {
          console.log('[State] Save pre-v1.5.0 detectado. Reseteando para evitar incompatibilidades.');
          State._pendingMigrationNotice = true;
          try { localStorage.removeItem(storageKey()); } catch (e) {}
          return false;
        }
        State.player = player;
        State.world = data.world || null;
        State.combat = null;
        State.traveling = data.traveling || null;
        State.ui = data.ui || { activeTab: 'world', openModal: null, modalPayload: null };
        State.chronicles = data.chronicles || [];
        // v1.7.0: prefs (default si no existe en save viejo)
        State.prefs = data.prefs || { travelMode: 'manual' };
        if (!State.prefs.travelMode) State.prefs.travelMode = 'manual';
        State._migrate();
        A.Bus.emit('state:loaded');
        return true;
      } catch (err) {
        console.warn('[State] Save corrupto, ignorado:', err);
        return false;
      }
    },

    /**
     * Migración silenciosa de saves anteriores a la estructura nueva.
     */
    _migrate() {
      const p = State.player;
      if (!p) return;
      let dirty = false;
      const fromVersion = p.schemaVersion || 0;

      if (p.hasMagic === undefined) {
        p.hasMagic = A.Seed.rollMagicForRace(p.raceId);
        if (!p.hasMagic) { p.mana = 0; p.maxMana = 0; }
        dirty = true;
      }
      if (!p.bagId) { p.bagId = 'bag_basic'; dirty = true; }
      // v1.5.1: bag_starter eliminada, se reemplaza por bag_basic
      if (p.bagId === 'bag_starter') { p.bagId = 'bag_basic'; dirty = true; }
      if (p.pet === undefined) { p.pet = null; dirty = true; }
      if (!p.spells) { p.spells = []; dirty = true; }

      // v15: monedas pasan a items en inventario
      if (fromVersion < 15) {
        if (p.coins && (p.coins.copper || p.coins.silver || p.coins.gold)) {
          // Convertir player.coins a items
          const totalCopper = (p.coins.copper || 0)
                            + (p.coins.silver || 0) * 100
                            + (p.coins.gold || 0) * 10000;
          // Limpiar monedas previas en inventario por si las hay
          p.inventory = (p.inventory || []).filter((s) =>
            !['coin_copper', 'coin_silver', 'coin_gold'].includes(s.itemId)
          );
          // Distribuir el total como items
          if (totalCopper > 0) {
            const gold = Math.floor(totalCopper / 10000);
            let rest = totalCopper - gold * 10000;
            const silver = Math.floor(rest / 100);
            const copper = rest - silver * 100;
            if (gold > 0) p.inventory.push({ itemId: 'coin_gold', qty: gold });
            if (silver > 0) p.inventory.push({ itemId: 'coin_silver', qty: silver });
            if (copper > 0) p.inventory.push({ itemId: 'coin_copper', qty: copper });
          }
          delete p.coins;
        }
        // food / maxFood
        if (p.food === undefined) p.food = 20;
        if (p.maxFood === undefined) p.maxFood = 20;
        // contador de encuentros por región
        if (!p.regionEncounters) p.regionEncounters = {};
        dirty = true;
      }

      // v1.5.5b: effects y failedTames
      if (!p.effects) { p.effects = []; dirty = true; }
      if (!p.failedTames) { p.failedTames = []; dirty = true; }

      // v1.5.9: campos de mascota (level, xp, xpNeeded)
      if (p.pet) {
        if (typeof p.pet.level === 'undefined') { p.pet.level = 1; dirty = true; }
        if (typeof p.pet.xp === 'undefined') { p.pet.xp = 0; dirty = true; }
        if (typeof p.pet.xpNeeded === 'undefined') { p.pet.xpNeeded = p.pet.level * 30; dirty = true; }
      }

      // v1.5.9: campos de tiempo en world
      if (State.world) {
        if (typeof State.world.timeOfDay === 'undefined') { State.world.timeOfDay = 'day'; dirty = true; }
        if (typeof State.world.day === 'undefined') { State.world.day = 1; dirty = true; }
        if (typeof State.world.timeProgress === 'undefined') { State.world.timeProgress = 0; dirty = true; }
        // v1.6.1: phase v2
        if (typeof State.world.phase === 'undefined') {
          State.world.phase = (State.world.timeOfDay === 'night') ? 'night' : 'morning';
          dirty = true;
        }
      }

      // v1.8.0: mascota con dieta, saciedad y stats por nivel; contador de pasos
      if (p.pet && !p.pet.profile && A.Tame && A.Tame.upgradeLegacyPet) {
        A.Tame.upgradeLegacyPet(p.pet);
        dirty = true;
      }
      if (typeof p.travelSteps === 'undefined') { p.travelSteps = 0; dirty = true; }

      // v2.4: las mejoras y los efectos son de una pelea: al cargar no hay pelea en curso
      if (Array.isArray(p.effects) && p.effects.length) { p.effects = []; dirty = true; }

      // v2.4: casillero de accesorio y maná que da el equipo
      if (!p.equipment) { p.equipment = { weapon: null, armor: null, accessory: null }; dirty = true; }
      if (!('accessory' in p.equipment)) { p.equipment.accessory = null; dirty = true; }
      if (!p.gearMana) { p.gearMana = {}; dirty = true; }

      // v2.1: cada raza con magia nace con su propio hechizo; las partidas de antes lo aprenden al cargar
      if (p.hasMagic && A.Data && A.Data.getById) {
        const race = A.Data.getById('races', p.raceId);
        const birth = race && race.startSpell;
        if (birth && !p.spells.includes(birth) && A.Data.getById('spells', birth)) {
          p.spells.push(birth);
          dirty = true;
        }
      }

      // v3.0: la experiencia para subir cambió: se conserva el nivel y lo avanzado dentro de él
      if ((p.schemaVersion || 0) < 17 && A.Progression && A.Progression.XP_TABLE_V2) {
        const oldT = A.Progression.XP_TABLE_V2;
        const newT = A.Progression.XP_TABLE;
        const cum = (t, lvl) => { let n = 0; for (let l = 1; l < lvl; l++) n += t[Math.min(t.length, l) - 1]; return n; };
        const lvl = Math.max(1, p.level || 1);
        const oldBase = cum(oldT, lvl);
        const oldSpan = lvl < A.Progression.MAX_LEVEL ? oldT[lvl - 1] : 1;
        const newSpan = lvl < A.Progression.MAX_LEVEL ? newT[lvl - 1] : 1;
        const frac = Math.max(0, Math.min(0.99, ((p.xp || 0) - oldBase) / Math.max(1, oldSpan)));
        p.xp = cum(newT, lvl) + Math.floor(frac * newSpan);
        if (p.pet) p.pet.xpNeeded = A.Balance && A.Balance.Pet ? A.Balance.Pet.xpToNext(p.pet.level || 1) : p.pet.xpNeeded;
        dirty = true;
      }

      if (!p.schemaVersion || p.schemaVersion < 17) {
        p.schemaVersion = 17;
        dirty = true;
      }

      // v3.1: cada raza come lo suyo. Si la tuya solo come algo especial (aceite, sangre,
      // néctar) y no tenés nada de eso, el mercader te deja la comida para empezar.
      if ((p.schemaVersion || 0) < 18) {
        const diet = A.Survival && A.Survival.dietOf ? A.Survival.dietOf(p.raceId) : null;
        if (diet && diet.only && A.Survival.hasEdible && !A.Survival.hasEdible(p)) {
          for (const s of A.Survival.startFood(p.raceId)) {
            if (!A.Data.getById('items', s.itemId)) continue;
            const slot = (p.inventory || []).find((x) => x.itemId === s.itemId);
            if (slot) slot.qty += s.qty; else (p.inventory = p.inventory || []).push({ ...s });
          }
          State.addChronicle({ type: 'note', text: `Ahora cada raza come lo suyo. Te dejaron ${diet.startText} para el camino.` });
        }
        // v3.1: equilibrio. El guerrero gana 8 de vida por nivel (antes 7): el que ya subió
        // recibe la diferencia. El Infernal tiene un punto más de esquiva. El Robot nace con
        // 1 de vida menos, pero a los que ya existen no se les quita nada.
        const race18 = A.Data && A.Data.getById ? A.Data.getById('races', p.raceId) : null;
        const gained18 = [];
        if (race18 && race18.combatType === 'warrior' && (p.level || 1) > 1) {
          const add = (p.level || 1) - 1;
          p.maxHp = (p.maxHp || 0) + add;
          p.hp = Math.min(p.maxHp, (p.hp || 0) + add);
          gained18.push(`+${add} de vida máxima`);
        }
        if (p.raceId === 'infernal' && p.stats) {
          p.stats.dodge = (p.stats.dodge || 0) + 1;
          gained18.push('+1 de esquiva');
        }
        if (gained18.length) State.addChronicle({ type: 'note', text: `Ajuste de equilibrio de la versión 3.1: ${gained18.join(' y ')}.` });
        p.schemaVersion = 18;
        dirty = true;
      }
      if ((p.schemaVersion || 0) < 19) {
        // v3.2: armas nuevas (la varita da maná, la varita rúnica más): el maná del
        // equipo puesto se vuelve a calcular con los números de ahora
        if (A.Accessories && A.Accessories.applyGearMana && p.equipment) {
          const manaBefore = p.maxMana || 0;
          const eq = p.equipment;
          const get = (tbl, id) => (id && A.Data.getById ? A.Data.getById(tbl, id) : null);
          A.Accessories.applyGearMana(p, 'weapon', get('weapons', eq.weapon));
          A.Accessories.applyGearMana(p, 'armor', get('armors', eq.armor));
          A.Accessories.applyGearMana(p, 'accessory', get('items', eq.accessory));
          const diff = (p.maxMana || 0) - manaBefore;
          if (diff > 0) State.addChronicle({ type: 'note', text: `Ajuste de la versión 3.2: tu equipo ahora te da ${diff} de maná máximo más.` });
        }
        p.schemaVersion = 19;
        dirty = true;
      }
      if ((p.schemaVersion || 0) < 20) {
        // v3.3: los magos solo usan armas mágicas, y Curación es solo para magos
        const race20 = A.Data && A.Data.getById ? A.Data.getById('races', p.raceId) : null;
        const notes20 = [];
        const eq20 = p.equipment || (p.equipment = { weapon: null, armor: null, accessory: null });
        if (race20 && race20.combatType === 'mage') {
          const w = eq20.weapon ? A.Data.getById('weapons', eq20.weapon) : null;
          if (!w || !w.magic) {
            // el arma de antes vuelve a la mochila; si no entra, se queda igual en la mochila (sin tope)
            if (eq20.weapon) {
              const slot = (p.inventory || []).find((x) => x.itemId === eq20.weapon);
              if (slot) slot.qty += 1; else (p.inventory = p.inventory || []).push({ itemId: eq20.weapon, qty: 1 });
            }
            // ¿tiene alguna mágica en la mochila? La mejor; si no, una varita nueva
            const magicOwned = (p.inventory || []).map((x) => A.Data.getById('weapons', x.itemId)).filter((x) => x && x.magic)
              .sort((a, b) => (b.tier || 1) - (a.tier || 1))[0];
            const pickId = magicOwned ? magicOwned.id : 'varita';
            if (magicOwned) {
              const slot = p.inventory.find((x) => x.itemId === pickId);
              if (slot) { slot.qty -= 1; if (slot.qty <= 0) p.inventory = p.inventory.filter((x) => x !== slot); }
            }
            eq20.weapon = pickId;
            if (A.Accessories && A.Accessories.applyGearMana) A.Accessories.applyGearMana(p, 'weapon', A.Data.getById('weapons', pickId));
            const name = (A.Data.getById('weapons', pickId) || {}).name || 'una varita';
            notes20.push(`ahora los magos solo usan armas mágicas: te pusiste ${magicOwned ? name.toLowerCase() : 'una varita nueva'}${w ? ` (${w.name.toLowerCase()} quedó en la mochila)` : ''}`);
          }
        } else if (race20 && race20.combatType !== 'mage' && (p.spells || []).includes('curacion')) {
          // Curación quedó para los magos: el híbrido la cambia por Segundo aliento (se cura solo a sí mismo)
          p.spells = p.spells.filter((x) => x !== 'curacion');
          if (A.Data.getById('spells', 'segundo_aliento') && !p.spells.includes('segundo_aliento')) p.spells.push('segundo_aliento');
          notes20.push('Curación ahora es solo para magos: la cambiaste por Segundo aliento, que te cura solo a vos');
        }
        if (notes20.length) State.addChronicle({ type: 'note', text: `Cambios de la versión 3.3: ${notes20.join('; ')}.` });
        p.schemaVersion = 20;
        dirty = true;
      }
      if ((p.schemaVersion || 0) < 21) {
        // v3.4: cada clase, sus armas (las de mago, solo los magos; los magos, solo esas)
        // y los híbridos aprenden pocos hechizos: los que ya no pueden saber, devuelven su pergamino
        const notes21 = [];
        const eq21 = p.equipment || (p.equipment = { weapon: null, armor: null, accessory: null });
        const B21 = A.Balance;
        const wNow = eq21.weapon ? A.Data.getById('weapons', eq21.weapon) : null;
        if (wNow && B21 && B21.canWield && !B21.canWield(p, wNow).ok) {
          // el arma de antes vuelve a la mochila
          const back = (id) => { const slot = (p.inventory || []).find((x) => x.itemId === id); if (slot) slot.qty += 1; else (p.inventory = p.inventory || []).push({ itemId: id, qty: 1 }); };
          const take = (id) => { const slot = (p.inventory || []).find((x) => x.itemId === id); if (slot) { slot.qty -= 1; if (slot.qty <= 0) p.inventory = p.inventory.filter((x) => x !== slot); } };
          back(wNow.id);
          // la mejor que sí puede usar de la mochila; si no tiene, la de su raza (o una varita, si es mago)
          const race21 = A.Data.getById('races', p.raceId);
          const usable = (p.inventory || []).map((x) => A.Data.getById('weapons', x.itemId)).filter((x) => x && B21.canWield(p, x).ok)
            .sort((a, b) => ((b.tier || 1) - (a.tier || 1)) || ((B21.avgOf ? B21.avgOf(b.damage) : 0) - (B21.avgOf ? B21.avgOf(a.damage) : 0)))[0];
          const fallback = (race21 && race21.startWeapon && A.Data.getById('weapons', race21.startWeapon)) || A.Data.getById('weapons', B21.classOf(p) === 'mage' ? 'varita' : 'daga');
          const pick = usable || fallback;
          if (pick) {
            if (usable) take(pick.id);
            eq21.weapon = pick.id;
            if (A.Accessories && A.Accessories.applyGearMana) A.Accessories.applyGearMana(p, 'weapon', pick);
            notes21.push(`${wNow.name} ahora es ${B21.isMageWeapon(wNow) ? 'un arma de mago' : 'un arma común'} y quedó en la mochila: te pusiste ${pick.name.toLowerCase()}`);
          }
        }
        if (A.Spellbook && A.Spellbook.who && B21 && B21.classOf && B21.classOf(p) === 'hybrid') {
          const lost = (p.spells || []).map((id) => A.Data.getById('spells', id)).filter((sp) => sp && A.Spellbook.who(sp) === 'mage');
          for (const sp of lost) {
            p.spells = p.spells.filter((x) => x !== sp.id);
            if (sp.fromScroll && A.Data.getById('items', sp.fromScroll)) {
              const slot = (p.inventory || []).find((x) => x.itemId === sp.fromScroll);
              if (slot) slot.qty += 1; else (p.inventory = p.inventory || []).push({ itemId: sp.fromScroll, qty: 1 });
            }
          }
          if (lost.length) notes21.push(`los híbridos ya no aprenden ${lost.map((sp) => sp.name).join(', ')}: ${lost.length > 1 ? 'te devolvieron sus pergaminos' : 'te devolvieron el pergamino'} (lo podés leer una vez en una pelea o venderlo)`);
        }
        if (notes21.length) State.addChronicle({ type: 'note', text: `Cambios de la versión 3.4: ${notes21.join('; ')}.` });
        p.schemaVersion = 21;
        dirty = true;
      }
      if ((p.schemaVersion || 0) < 22) {
        // v3.5: cada raza de mago tiene su propia arma de mago: el que todavía usa la varita del principio la cambia
        const race22 = A.Data.getById('races', p.raceId);
        const own = race22 && race22.combatType === 'mage' && race22.startWeapon ? A.Data.getById('weapons', race22.startWeapon) : null;
        const eq22 = p.equipment || {};
        if (own && own.id !== 'varita' && eq22.weapon === 'varita') {
          const slot = (p.inventory || []).find((x) => x.itemId === 'varita');
          if (slot) slot.qty += 1; else (p.inventory = p.inventory || []).push({ itemId: 'varita', qty: 1 });
          eq22.weapon = own.id;
          if (A.Accessories && A.Accessories.applyGearMana) A.Accessories.applyGearMana(p, 'weapon', own);
          State.addChronicle({ type: 'note', text: `Cambios de la versión 3.5: cada raza de mago tiene su arma. Te pusiste ${own.name.toLowerCase()} (la varita quedó en la mochila).` });
        }
        p.schemaVersion = 22;
        dirty = true;
      }
      if ((p.schemaVersion || 0) < 23) {
        // v3.6: todas las razas con el mismo poder (clase + 3 puntos de raza): se ajusta la diferencia
        // [vida, maná, velocidad, precisión, armadura, daño, esquiva] de cada raza en la v3.5
        const OLD23 = { humano: [3, 0, 1, 1, 0, 0, 1], elfo: [3, 2, 3, 2, 0, 0, 1], mediano: [1, 0, 3, 1, 0, 0, 2], draconido: [2, 0, 0, 1, 1, 1, 0], vampiro: [1, 0, 2, 1, 0, 0, 1], enano: [3, 0, -2, 1, 0, 0, -1], orco: [1, 0, 0, 1, 0, 0, 0], robot: [1, 0, -1, 1, 1, 0, -1], goliat: [8, 0, -2, 0, 0, 0, 0], minotauro: [5, 0, -1, 0, 0, 0, -1], gnomo: [-8, 4, 1, 2, 0, 0, 2], alienigena: [-7, 1, 2, 1, 0, 0, 2], infernal: [-6, 4, 1, 2, 0, 0, 2], angel: [-5, 1, 1, 1, 0, 0, 2], hada: [-9, 2, 3, 1, 0, 0, 3], licantropo: [0, 0, 1, 1, 0, 0, 0], elfo_oscuro: [4, 1, 2, 1, 0, 0, 1], driade: [-6, 2, 1, 1, 0, 0, 2] };
        const race23 = A.Data.getById('races', p.raceId);
        const old = OLD23[p.raceId];
        if (race23 && old && race23.bonuses) {
          const nb = race23.bonuses;
          const d = (i, k) => (nb[k] || 0) - old[i];
          const dHp = d(0, 'hp');
          const dMana = p.hasMagic ? d(1, 'mana') : 0;
          p.maxHp = Math.max(1, (p.maxHp || 1) + dHp);
          p.hp = Math.max(1, Math.min(p.maxHp, (p.hp || 1) + Math.max(0, dHp)));
          if (p.hasMagic) { p.maxMana = Math.max(0, (p.maxMana || 0) + dMana); p.mana = Math.max(0, Math.min(p.maxMana, (p.mana || 0) + Math.max(0, dMana))); }
          p.stats = p.stats || {};
          [['speed', 2], ['precision', 3], ['armor', 4], ['damage', 5], ['dodge', 6]].forEach(([k, i]) => { p.stats[k] = (p.stats[k] || 0) + d(i, k); });
          const parts = [];
          const say = (n, txt) => { if (n) parts.push(`${n > 0 ? '+' : ''}${n} de ${txt}`); };
          say(dHp, 'vida'); say(dMana, 'maná'); say(d(2, 'speed'), 'velocidad'); say(d(3, 'precision'), 'precisión'); say(d(4, 'armor'), 'armadura'); say(d(5, 'damage'), 'daño'); say(d(6, 'dodge'), 'esquiva');
          if (parts.length) State.addChronicle({ type: 'note', text: `Cambios de la versión 3.6: todas las razas tienen ahora el mismo poder. A la tuya le tocó: ${parts.join(', ')}.` });
        }
        p.schemaVersion = 23;
        dirty = true;
      }
      if (dirty) {
        State.persist();
        console.log('[State] Save migrado a estructura v1.5.0');
      }
    },

    persist() {
      // v3.0: si se está jugando el turno del compañero, se guarda igual el héroe propio
      if (!State.me()) return;
      try {
        const data = {
          player: State.me(),
          world: State.world,
          traveling: State.traveling,
          ui: State.ui,
          chronicles: State.chronicles,
          prefs: State.prefs || { travelMode: 'manual' },
        };
        localStorage.setItem(storageKey(), JSON.stringify(data));
        A.Bus.emit('state:saved');
      } catch (err) {
        console.error('[State] No se pudo guardar:', err);
      }
    },

    reset() {
      State.player = null;
      State.world = null;
      State.combat = null;
      State.traveling = null;
      State.ui = { activeTab: 'world', openModal: null, modalPayload: null, showMap: false };
      State.chronicles = [];
      try { localStorage.removeItem(storageKey()); } catch (e) {}
      A.Bus.emit('state:reset');
    },

    /** v3.0: deja la memoria vacía sin borrar nada guardado (cambio de cuenta). */
    unload() {
      State.player = null;
      State.world = null;
      State.combat = null;
      State.traveling = null;
      State.party = null;
      State._ctx = null;
      State.ui = { activeTab: 'world', openModal: null, modalPayload: null, showMap: false };
      State.chronicles = [];
    },

    storageKey,

    // ============================================================
    // v3.0: jugar en grupo
    //   State.party (lo maneja js/net/party.js):
    //     { localHid, heroes: { hid: héroe }, order: [hid, ...] }
    //   State.player es el héroe "en contexto": el propio casi siempre, y el del
    //   compañero mientras el anfitrión juega su parte (withHero). Así todo el
    //   motor (combate, misiones, monedas) sigue escrito para "el jugador".
    // ============================================================

    /** El héroe de esta compu, aunque se esté jugando el turno del compañero. */
    me() {
      const pt = State.party;
      if (pt && pt.heroes && pt.heroes[pt.localHid]) return pt.heroes[pt.localHid];
      return State.player;
    },

    /** Id del héroe en el grupo (en solitario, 'me'). */
    hidOf(p) {
      if (!p) return null;
      if (p._hid) return p._hid;
      return 'me';
    },

    heroById(hid) {
      const pt = State.party;
      if (pt && pt.heroes && pt.heroes[hid]) return pt.heroes[hid];
      const me = State.me();
      return me && State.hidOf(me) === hid ? me : null;
    },

    /** ¿Se está jugando ahora la parte del compañero? */
    isForeign() { return !!(State._ctx && State._ctx.foreign); },

    /**
     * Ejecuta fn con `hero` como State.player (el turno, la tirada o el premio de ese héroe).
     * Si no es el propio, los eventos de pantalla esperan y las crónicas van a su dueño.
     */
    withHero(hero, fn) {
      if (!hero || hero === State.player) return fn();
      const prevPlayer = State.player;
      const prevCtx = State._ctx;
      const foreign = hero !== State.me();
      if (A.Combat && A.Combat._swapHero) A.Combat._swapHero(prevPlayer, hero);
      State.player = hero;
      State._ctx = { hid: State.hidOf(hero), foreign };
      if (foreign) A.Bus.beginDefer();
      try {
        return fn();
      } finally {
        if (A.Combat && A.Combat._swapHero) A.Combat._swapHero(hero, prevPlayer);
        State.player = prevPlayer;
        State._ctx = prevCtx;
        if (foreign) A.Bus.endDefer();
      }
    },


    hasGame() {
      return !!State.player;
    },

    // ---------- Crear personaje ----------

    /**
     * Crea el personaje y lo coloca en pueblo_inicial.
     */
    createCharacter({ name, raceId }) {
      function startWeaponFor(rid) {
        const race = A.Data && A.Data.getById ? A.Data.getById('races', rid) : null;
        const id = race && race.startWeapon;
        if (id && A.Data.getById('weapons', id)) return id;
        return race && race.combatType === 'mage' ? 'varita' : 'daga';
      }
      const stats = A.Seed.statsForRace(raceId);
      if (!stats) throw new Error('Raza inválida: ' + raceId);

      const hasMagic = A.Seed.rollMagicForRace(raceId);

      State.player = {
        name: (name || 'Aventurero').trim().slice(0, 24),
        raceId,
        level: 1,
        xp: 0,
        hp: stats.maxHp,
        maxHp: stats.maxHp,
        mana: hasMagic ? stats.maxMana : 0,
        maxMana: hasMagic ? stats.maxMana : 0,
        food: 20,
        maxFood: 20,
        hasMagic,
        bagId: DEFAULT_BAG_ID,
        pet: null,
        regionEncounters: {}, // { regionId: count }
        effects: [],            // efectos de estado activos en combate
        failedTames: [],        // ids de enemigos cuya domesticación ya falló
        stats: {
          speed: stats.speed,
          precision: stats.precision,
          armor: stats.armor,
          damage: stats.damage,
          dodge: stats.dodge,
        },
        // v3.3: cada raza nace con su arma (todas valen lo mismo que la vieja daga);
        // los magos, con una varita (solo pueden usar armas mágicas)
        equipment: { weapon: startWeaponFor(raceId), armor: 'tunica_cuero', accessory: null },
        gearMana: {},
        // v3.1: la comida depende de la raza (el robot arranca con aceite, el vampiro con sangre...)
        inventory: [
          { itemId: 'pocion_curacion_menor', qty: 2 },
          ...((A.Survival && A.Survival.startFood ? A.Survival.startFood(raceId) : [{ itemId: 'pan', qty: 3 }])
            .filter((s) => A.Data.getById('items', s.itemId))),
          { itemId: 'carne_cruda', qty: 2 },
          { itemId: 'coin_copper', qty: 30 },
        ],
        // v2.1: cada raza con magia nace con su propio hechizo
        spells: hasMagic ? [((A.Data.getById('races', raceId) || {}).startSpell) || 'chispa'] : [],
        travelSteps: 0,
        schemaVersion: 23,
      };
      // v3.3: el maná que da el arma de inicio (la varita: +2)
      if (A.Accessories && A.Accessories.applyGearMana) {
        A.Accessories.applyGearMana(State.player, 'weapon', A.Data.getById('weapons', State.player.equipment.weapon));
        if (State.player.hasMagic) State.player.mana = State.player.maxMana;
      }

      State.world = {
        regionId: 'pueblo_inicial',
        visited: ['pueblo_inicial'],
        npcsTalked: [],
        // v1.6.1: tiempo con 4 fases
        phase: 'morning',
        timeOfDay: 'day', // legacy compat
        day: 1,
        timeProgress: 0,
      };

      State.traveling = null;
      State.ui = { activeTab: 'world', openModal: null, modalPayload: null, showMap: false };
      State.chronicles = [];
      const magicNote = hasMagic ? ' Sentís el zumbido del maná en las venas.' : '';
      State.addChronicle({ type: 'system', text: `${State.player.name} comienza su aventura en el Pueblo Inicial.${magicNote}` });

      A.Bus.emit('player:created', { player: State.player });
      State.persist();
    },

    // ---------- Mutators de jugador ----------

    setHp(amount) {
      if (!State.player) return;
      const before = State.player.hp;
      State.player.hp = A.Utils.clamp(amount, 0, State.player.maxHp);
      A.Bus.emit('player:hp-changed', {
        current: State.player.hp,
        max: State.player.maxHp,
        delta: State.player.hp - before,
      });
      if (State.player.hp <= 0) A.Bus.emit('player:died');
    },

    healHp(amount) {
      if (!State.player) return;
      // v3.15: la herida maldita (y la maldición de sangre) corta la curación a la mitad mientras dura la pelea
      if (amount > 0 && State.combat && !State.combat.result && (State.player.effects || []).some((e) => e.type === 'noheal')) {
        const cut = (A.Balance && A.Balance.NOHEAL_CUT) || 0.5;
        amount = Math.max(1, Math.round(amount * (1 - cut)));
      }
      State.setHp(State.player.hp + amount);
    },

    damagePlayer(amount) {
      if (!State.player) return;
      State.setHp(State.player.hp - amount);
    },

    setMana(amount) {
      if (!State.player) return;
      const before = State.player.mana;
      State.player.mana = A.Utils.clamp(amount, 0, State.player.maxMana);
      A.Bus.emit('player:mana-changed', {
        current: State.player.mana,
        max: State.player.maxMana,
        delta: State.player.mana - before,
      });
    },

    fullRest() {
      if (!State.player) return;
      State.setHp(State.player.maxHp);
      State.setMana(State.player.maxMana);
      // v1.8.0: descansar también cura, despierta y alimenta a la mascota
      if (State.player.pet && A.Tame && A.Tame.restPet) A.Tame.restPet();
    },

    // ---------- Travel ----------

    setRegion(regionId) {
      if (!State.world) return;
      const fromId = State.world.regionId;
      State.world.regionId = regionId;
      if (!State.world.visited.includes(regionId)) {
        State.world.visited.push(regionId);
        A.Bus.emit('region:visited', { regionId });
      }
      A.Bus.emit('region:changed', { fromId, toId: regionId });
      const region = A.Data.getById('regions', regionId);
      State.addChronicle({
        type: 'travel',
        text: `Llegaste a ${region ? region.name : regionId}.`,
        regionId,
      });
      State.persist();
    },

    // ---------- Inventario ----------

    /**
     * Devuelve cuántos slots ocupa un item dado (1 por default, 2 para items voluminosos).
     * Las monedas no ocupan slots (se manejan aparte).
     */
    itemSlots(itemId) {
      const item = A.Data.getById('items', itemId)
                || A.Data.getById('weapons', itemId)
                || A.Data.getById('armors', itemId);
      if (!item) return 0;
      // v1.5.7k: monedas ahora ocupan slots como cualquier item (1 slot = 1 stack)
      return item.slots || 1;
    },

    inventoryUsedSlots() {
      if (!State.player) return 0;
      // Sumar slots de cada item (no cantidad). Monedas = 0 slots.
      return State.player.inventory.reduce((acc, s) => {
        return acc + State.itemSlots(s.itemId);
      }, 0);
    },

    inventoryCapacity() {
      if (!State.player) return 0;
      const bag = A.Data.getById('bags', State.player.bagId || DEFAULT_BAG_ID);
      return bag ? bag.slots : 10;
    },

    /**
     * ¿Hay espacio para un item de N slots?
     */
    inventoryHasSpaceFor(itemId) {
      const need = State.itemSlots(itemId);
      if (need === 0) return true; // monedas
      return State.inventoryUsedSlots() + need <= State.inventoryCapacity();
    },

    inventoryHasSpace() {
      return State.inventoryUsedSlots() < State.inventoryCapacity();
    },

    /**
     * Cambia la mochila equipada. Falla si la nueva tiene menos slots que items
     * actuales en el inventario.
     * Devuelve { ok: bool, error?: string }
     */
    setBag(bagId) {
      if (!State.player) return { ok: false, error: 'Sin personaje.' };
      const bag = A.Data.getById('bags', bagId);
      if (!bag) return { ok: false, error: 'Mochila inexistente.' };
      const used = State.inventoryUsedSlots();
      if (used > bag.slots) {
        return { ok: false, error: `La mochila tiene ${bag.slots} slots y tu inventario ocupa ${used}. Tirá o guardá algo primero.` };
      }
      State.player.bagId = bagId;
      A.Bus.emit('bag:equipped', { bagId });
      A.Bus.emit('inventory:changed');
      State.persist();
      return { ok: true };
    },

    addItem(itemId, qty = 1) {
      if (!State.player) return false;
      // Buscar en items, weapons, armors (orden de prioridad)
      const item = A.Data.getById('items', itemId)
                || A.Data.getById('weapons', itemId)
                || A.Data.getById('armors', itemId);
      if (!item) return false;

      // Las monedas se manejan aparte vía Currency
      if (item.subtype === 'coin') {
        // Convertir a cobre y delegar a Currency.add (auto-distribuye)
        const valueInCopper = (item.value || 1) * qty;
        A.Currency.add(valueInCopper);
        return true;
      }

      const existing = State.player.inventory.find((s) => s.itemId === itemId);
      const stackable = item.stack && item.stack > 1;

      // v3.13: cada objeto tiene un tope (su pila). Lo que sobra no se pierde: se vende solo.
      if (existing && stackable) {
        const room = item.quest ? qty : Math.max(0, item.stack - existing.qty);
        const put = Math.min(qty, room);
        existing.qty += put;
        if (qty > put) State.sellOverflow(item, qty - put);
        A.Bus.emit('inventory:changed');
        State.persist();
        return true;
      }
      if (stackable && !item.quest && qty > item.stack) {
        State.sellOverflow(item, qty - item.stack);
        qty = item.stack;
      }

      // v3.0: los objetos de misión entran siempre (no pesan y no se pueden perder por la mochila llena)
      if (!item.quest && !State.inventoryHasSpaceFor(itemId)) {
        A.Bus.emit('inventory:full');
        return false;
      }

      State.player.inventory.push({ itemId, qty });
      A.Bus.emit('inventory:changed');
      State.persist();
      return true;
    },

    /** v3.13: cuántos de un objeto podés llevar (el tope de su pila; 1 si no se apila). */
    itemCap(itemId) {
      const item = A.Data.getById('items', itemId) || A.Data.getById('weapons', itemId) || A.Data.getById('armors', itemId);
      if (!item) return 0;
      return item.stack && item.stack > 1 ? item.stack : 1;
    },
    /** v3.13: ¿ya llevás el máximo de ese objeto? (solo para los que se apilan) */
    itemAtCap(itemId) {
      const item = A.Data.getById('items', itemId);
      if (!item || !(item.stack > 1) || item.quest || item.subtype === 'coin' || !State.player) return false;
      const slot = State.player.inventory.find((s) => s.itemId === itemId);
      return !!(slot && slot.qty >= item.stack);
    },
    /** v3.13: a cuánto se vende un objeto (la mitad de su valor, mínimo 1). */
    sellValueOf(item) {
      return Math.max(1, Math.floor(((item && item.value) || 0) / 2));
    },
    /** v3.13: lo que no entra por el tope se vende solo (no se pierde). */
    sellOverflow(item, n) {
      if (!item || n <= 0) return 0;
      const coins = State.sellValueOf(item) * n;
      if (coins > 0) A.Currency.add(coins);
      const price = A.Currency.formatPrice ? A.Currency.formatPrice(coins) : `${coins}c`;
      State.addChronicle({ type: 'loot', text: `Ya llevás el máximo de ${item.name} (${item.stack}): ${n === 1 ? 'el que sobraba se vendió' : `los ${n} que sobraban se vendieron`} por ${price}.` });
      A.Bus.emit('inventory:capped', { itemId: item.id, extra: n, coins, cap: item.stack, name: item.name });
      return coins;
    },

    removeItem(itemId, qty = 1) {
      if (!State.player) return false;
      const slot = State.player.inventory.find((s) => s.itemId === itemId);
      if (!slot) return false;
      slot.qty -= qty;
      if (slot.qty <= 0) {
        State.player.inventory = State.player.inventory.filter((s) => s !== slot);
      }
      A.Bus.emit('inventory:changed');
      State.persist();
      return true;
    },

    dropItem(itemId) {
      if (!State.player) return;
      State.player.inventory = State.player.inventory.filter((s) => s.itemId !== itemId);
      A.Bus.emit('inventory:changed');
      State.persist();
    },

    // ---------- Comida (food) ----------

    /**
     * Modifica food por delta (positivo o negativo). Cap en 0..maxFood.
     */
    modifyFood(delta) {
      if (!State.player) return;
      State.player.food = Math.max(0, Math.min(State.player.maxFood, State.player.food + delta));
      A.Bus.emit('player:food-changed', { food: State.player.food });
      State.persist();
    },

    /**
     * Aplica el desgaste de food por viaje. Si llegó a 0, perder HP.
     * v1.6.2: ahora usa Survival.applyTurnTick si está disponible.
     */
    consumeFoodForStep() {
      if (!State.player) return;
      // v1.8.0: se come 1 cada pocos pasos (Balance.Travel.STEPS_PER_FOOD; v3.1: cada 4).
      // La mascota también gasta saciedad al viajar.
      const p = State.player;
      p.travelSteps = (p.travelSteps || 0) + 1;
      if (A.Tame && A.Tame.onTravelStep) A.Tame.onTravelStep(p.travelSteps);
      const every = (A.Balance && A.Balance.Travel.STEPS_PER_FOOD) || 1;
      if (p.travelSteps % every !== 0) return;
      if (A.Survival && typeof A.Survival.applyTurnTick === 'function') {
        A.Survival.applyTurnTick('travel-step');
        return;
      }
      // Fallback legacy si Survival no está cargado
      if (State.player.food > 0) {
        State.player.food -= 1;
        A.Bus.emit('player:food-changed', { food: State.player.food });
      } else {
        const hpLost = 1;
        State.player.hp = Math.max(0, State.player.hp - hpLost);
        A.Bus.emit('player:hp-changed', { current: State.player.hp });
        State.addChronicle({ type: 'note', text: 'Tenías hambre. Perdiste 1 de salud.' });
      }
      State.persist();
    },

    /**
     * Incrementa el contador de encuentros para una región.
     * Usado para el sistema de progresión por logros (reqEncounters).
     */
    incrementRegionEncounters(regionId) {
      if (!State.player) return;
      if (!State.player.regionEncounters) State.player.regionEncounters = {};
      State.player.regionEncounters[regionId] = (State.player.regionEncounters[regionId] || 0) + 1;
      State.persist();
    },

    encountersInRegion(regionId) {
      if (!State.player || !State.player.regionEncounters) return 0;
      return State.player.regionEncounters[regionId] || 0;
    },

    totalEncounters() {
      if (!State.player || !State.player.regionEncounters) return 0;
      return Object.values(State.player.regionEncounters).reduce((a, b) => a + b, 0);
    },

    // ---------- Crónicas ----------

    addChronicle({ type, text, regionId }) {
      // v3.0: lo que le pasó al compañero va a su diario (en su compu), no al tuyo
      if (State.isForeign() && A.Party && A.Party.pushChronicle) {
        A.Party.pushChronicle(State._ctx.hid, { type: type || 'note', text: text || '', regionId: regionId || (State.world && State.world.regionId) || null, day: (State.world && State.world.day) || null, ts: Date.now() });
        return;
      }
      const entry = {
        ts: Date.now(),
        type: type || 'note',
        text: text || '',
        regionId: regionId || (State.world && State.world.regionId) || null,
        // v2.0: el diario agrupa por día
        day: (State.world && State.world.day) || null,
      };
      // v2.0: la misma línea dos veces seguidas se cuenta en vez de repetirse
      const last = State.chronicles[0];
      if (last && last.text === entry.text && last.regionId === entry.regionId && last.day === entry.day) {
        last.count = (last.count || 1) + 1;
        last.ts = entry.ts;
        A.Bus.emit('chronicle:added', { entry: last });
        return;
      }
      State.chronicles.unshift(entry);
      // Cap razonable para que el localStorage no crezca infinito
      if (State.chronicles.length > 500) State.chronicles.length = 500;
      A.Bus.emit('chronicle:added', { entry });
    },

    // ---------- UI ----------

    setTab(tab) {
      if (State.ui.activeTab === tab) return;
      State.ui.activeTab = tab;
      A.Bus.emit('view:changed', { tab });
      State.persist();
    },

    openModal(id, payload = null) {
      State.ui.openModal = id;
      State.ui.modalPayload = payload;
      A.Bus.emit('modal:open', { id, payload });
    },

    closeModal() {
      const id = State.ui.openModal;
      State.ui.openModal = null;
      State.ui.modalPayload = null;
      A.Bus.emit('modal:close', { id });
      // v1.5.8: limpieza defensiva — si el overlay quedó en DOM, lo removemos
      // Esto previene overlays huérfanos cuando un listener falla
      try {
        document.querySelectorAll('.modal-overlay').forEach((el) => el.remove());
      } catch (e) {}
    },

    DEFAULT_BAG_ID,
  };

  A.State = State;
})(window.Aventurs);
