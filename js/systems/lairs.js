/* ============================================================
   Aventurs — Guaridas de los jefes (v3.11)

   Cada jefe vive en su guarida (una región con type 'lair' y boss).
   Adentro no hay peleas de sorpresa: el jefe se desafía con un botón.
     - Si le ganás, se va a curar las heridas y vuelve al día siguiente
       (día del juego: A.State.world.day).
     - Si la guarida tiene altar, hay que ofrecer objetos para que aparezca
       (se gastan al invocarlo; no hay que esperar al día siguiente).
   En grupo desafía el anfitrión y pelean todos.
   ============================================================ */

(function (A) {
  'use strict';

  const regionOf = (id) => (A.Data && A.Data.getById ? A.Data.getById('regions', id) : null);
  const isLair = (r) => !!(r && r.type === 'lair');
  const bossOf = (r) => (r && r.boss ? A.Data.getById('enemies', r.boss) : null);
  const today = () => (A.State.world && A.State.world.day) || 1;

  function itemName(id) {
    const it = A.Data.getById('items', id) || A.Data.getById('weapons', id) || A.Data.getById('armors', id);
    return it ? it.name : id;
  }
  function have(p, id) {
    const slot = ((p && p.inventory) || []).find((s) => s.itemId === id);
    return slot ? slot.qty || 0 : 0;
  }

  /**
   * Cómo está la guarida para un héroe:
   * { region, boss, wins, resting, backDay, altar: { name, text, items: [{ id, name, qty, have, ok }], ok } | null, ready }
   */
  function status(regionId, p = A.State.player) {
    const region = typeof regionId === 'string' ? regionOf(regionId) : regionId;
    const boss = bossOf(region);
    if (!isLair(region) || !boss) return null;
    const rec = (p && p.lairs && p.lairs[region.id]) || null;
    const resting = !region.altar && !!(rec && rec.day >= today());
    let altar = null;
    if (region.altar) {
      const items = (region.altar.items || []).map((it) => {
        const h = have(p, it.id);
        return { id: it.id, name: itemName(it.id), qty: it.qty || 1, have: h, ok: h >= (it.qty || 1) };
      });
      altar = { name: region.altar.name, text: region.altar.text, items, ok: items.every((x) => x.ok) };
    }
    return { region, boss, wins: rec ? rec.wins || 0 : 0, resting, backDay: rec ? (rec.day || 0) + 1 : null, altar, ready: !resting && (!altar || altar.ok) };
  }

  /** Le ganaste al jefe: vuelve al día siguiente. */
  function recordWin(p, regionId) {
    if (!p) return;
    p.lairs = p.lairs || {};
    const rec = p.lairs[regionId] || { wins: 0 };
    rec.wins = (rec.wins || 0) + 1;
    rec.day = today();
    p.lairs[regionId] = rec;
  }

  /** ¿Puede desafiarlo ahora este jugador? { ok, reason } */
  function canChallenge(regionId) {
    const st = status(regionId);
    if (!st) return { ok: false, reason: 'Acá no vive ningún jefe.' };
    if (A.State.combat && !A.State.combat.result) return { ok: false, reason: 'Ya estás peleando.' };
    if (A.Party && A.Party.isGuest && A.Party.isGuest() && A.Party.guestTogether && A.Party.guestTogether()) return { ok: false, reason: `En grupo, el desafío lo hace ${A.Party.hostName ? A.Party.hostName() : 'el anfitrión'}.` };
    if (A.State.player && A.State.player.hp <= 0) return { ok: false, reason: 'Primero curate: así no podés pelear.' };
    if (st.resting) return { ok: false, reason: `${st.boss.name} se fue a curar las heridas: vuelve mañana.` };
    if (st.altar && !st.altar.ok) return { ok: false, reason: 'Te faltan cosas para el altar.' };
    return { ok: true };
  }

  /** Desafía (o invoca) al jefe: gasta lo del altar y arranca la pelea. */
  function challenge(regionId) {
    const chk = canChallenge(regionId);
    if (!chk.ok) return chk;
    const st = status(regionId);
    if (st.altar) for (const it of st.altar.items) A.State.removeItem(it.id, it.qty);
    const boss = A.Encounter.spawnInstance(st.boss);
    // v3.12: a veces el jefe sale en su forma suprema (élite): más fuerte, dorado y con mejor botín
    const EL = A.Balance && A.Balance.ELITE;
    const supreme = !!(EL && A.Encounter.makeElite && Math.random() < (EL.chanceBoss || 0));
    if (supreme) A.Encounter.makeElite(boss);
    let group = [boss];
    if (A.Combat && A.Combat.prepareGroup) group = A.Combat.prepareGroup(group);
    const say = st.altar
      ? `Ponés las ofrendas en ${st.altar.name.toLowerCase()}. El suelo tiembla… ¡${st.boss.name} aparece!`
      : `Entrás a ${st.region.name}. ${st.boss.name} te ve y se levanta.`;
    const opening = [{ type: 'note', say, tone: 'bad' }];
    if (supreme) opening.push({ type: 'note', say: `¡Brilla como el oro! Es ${boss.displayName}: su forma suprema, más fuerte que nunca (y con mejor botín).`, tone: 'bad' });
    A.Combat.start({ enemies: group, lair: st.region.id, fromTravel: false, opening });
    return { ok: true, supreme };
  }

  /** Para el mapa y el bestiario: la guarida de un jefe (o null). */
  function lairOf(bossId) {
    return ((A.Data && A.Data.regions) || []).find((r) => isLair(r) && r.boss === bossId) || null;
  }

  A.Lairs = { isLair, bossOf, status, recordWin, canChallenge, challenge, lairOf };
})(window.Aventurs);
