/**
 * Mana Orb (ManaOrb.gd) audit for bpb-sim-debug dumps.
 * Peer activate → chance → +mana; once at ≥manaNeeded → spend need, giveRandomBuffs (no Mana).
 */

import { normalizeParams, getP1, getPName } from './params.js';

const MANA_ORB_ID = 'mana_orb';
const MANA_MASTERY_ID = 'mana_mastery';
const BURST_WINDOW_SEC = 0.05;

/**
 * @param {object} e
 */
function eventStack(e) {
  const fromMeta = e.stack || e.meta?.stack;
  if (fromMeta) return String(fromMeta).toLowerCase().replace(/[^a-z]/g, '');
  const m = String(e.label || '').match(
    /[+\-−]\s*(-?\d+(?:\.\d+)?)\s+(lucky|luck|vampirism|regeneration|regen|blind|poison|heat|cold|spikes|empower|block|mana)\b/i,
  );
  if (!m) return null;
  const s = m[2].toLowerCase();
  if (s === 'luck') return 'lucky';
  if (s === 'regen') return 'regeneration';
  return s;
}

/**
 * @param {object} e
 */
function isManaOrbOrigin(e) {
  return (
    e.itemId === MANA_ORB_ID ||
    e.meta?.handler === MANA_ORB_ID ||
    e.meta?.originId === MANA_ORB_ID
  );
}

/**
 * Combat-start activate stamps are not ManaOrb threshold fires.
 * @param {object} e
 */
function isThresholdActivate(e) {
  return e.type === 'activate' && isManaOrbOrigin(e) && !e.meta?.combatStart;
}

/**
 * @param {{ id: string }[] | undefined} placements
 */
function orbPlacements(placements) {
  return (placements || []).filter((p) => p?.id === MANA_ORB_ID);
}

/**
 * @param {Map<string, object> | undefined} itemsById
 * @param {{ id: string }[] | undefined} placements
 */
function masteryBonus(itemsById, placements) {
  let bonus = 0;
  for (const p of placements || []) {
    if (p?.id !== MANA_MASTERY_ID) continue;
    const item = itemsById?.get(MANA_MASTERY_ID);
    const params = normalizeParams(item?.params);
    bonus += Math.max(0, Math.round(getPName(params, 'buffs', getP1(params, 20))));
  }
  return bonus;
}

/**
 * Group orb buff/debuff lines into burst windows (threshold fires), not combat-start noise.
 * @param {object[]} events
 * @param {number} manaGrant peer proc size (+mana from onItemActivated)
 * @param {number} expectedBurstBuffs catalog buffs (+ Mastery) per orb fire
 */
function clusterOrbBursts(events, manaGrant, expectedBurstBuffs) {
  /** @type {object[]} */
  const bursts = [];
  /** @type {object | null} */
  let cur = null;

  const flush = () => {
    if (!cur) return;
    if (cur.buffTotal > 0 || cur.manaSpent > 0) {
      cur.expectedPerFire = expectedBurstBuffs;
      if (cur.buffTotal > 0) {
        if (expectedBurstBuffs > 0 && cur.buffTotal % expectedBurstBuffs === 0) {
          cur.inferredOrbFires = cur.buffTotal / expectedBurstBuffs;
        } else {
          cur.inferredOrbFires = 1;
        }
      } else {
        cur.inferredOrbFires = 0;
      }
      bursts.push(cur);
    }
    cur = null;
  };

  for (const e of events) {
    if (!isManaOrbOrigin(e)) continue;
    if (e.type !== 'buff' && e.type !== 'debuff') continue;
    const t = Number(e.t) || 0;
    const stack = eventStack(e);
    const amount = Number(e.amount);
    if (!stack || !Number.isFinite(amount)) continue;

    if (!cur || Math.abs(t - cur.t) > BURST_WINDOW_SEC) {
      flush();
      cur = {
        t,
        combatT: Math.max(0, t - 2.5),
        buffsByStack: {},
        buffTotal: 0,
        manaSpent: 0,
        peerManaInWindow: 0,
        poolManaInWindow: 0,
        expectedPerFire: expectedBurstBuffs,
        inferredOrbFires: 0,
      };
    }

    if (stack === 'mana' && amount < 0) {
      cur.manaSpent += -amount;
      continue;
    }
    if (stack === 'mana' && amount > 0) {
      if (amount === manaGrant) cur.peerManaInWindow += amount;
      else cur.poolManaInWindow += amount;
      continue;
    }
    if (amount > 0) {
      cur.buffsByStack[stack] = (cur.buffsByStack[stack] || 0) + amount;
      cur.buffTotal += amount;
    }
  }
  flush();
  return bursts;
}

/**
 * @param {object[]} events
 * @param {object[]} bursts
 */
function attachManaAroundFire(events, bursts) {
  /** @type {{ t: number, delta: number, manaAfter: number }[]} */
  const manaTrail = [];
  let mana = 0;
  for (const e of events) {
    if (e.type !== 'buff' && e.type !== 'debuff') continue;
    if (eventStack(e) !== 'mana') continue;
    const target = e.target === 'dummy' ? 'dummy' : 'player';
    if (target !== 'player' && e.actor !== 'player') continue;
    const amount = Number(e.amount);
    if (!Number.isFinite(amount)) continue;
    mana = Math.max(0, mana + amount);
    manaTrail.push({ t: Number(e.t) || 0, delta: amount, manaAfter: mana });
  }
  for (const fire of bursts) {
    const trailAt = manaTrail.filter((row) => Math.abs(row.t - fire.t) <= BURST_WINDOW_SEC);
    fire.manaAroundFire = trailAt.find((row) => row.delta > 0)?.manaAfter ?? null;
  }
}

/**
 * Reconstruct player mana trail and Mana Orb bursts from the event log.
 * @param {import('../sim-events.js').SimRun} run
 * @param {Map<string, object> | undefined} itemsById
 * @param {{ id: string, key?: string }[] | undefined} placements
 */
export function summarizeManaOrbAudit(run, itemsById, placements) {
  const orbs = orbPlacements(placements);
  const hasOrbEvents = (run.events || []).some(isManaOrbOrigin);
  if (!orbs.length && !hasOrbEvents) return null;

  const orbItem = itemsById?.get(MANA_ORB_ID);
  const params = normalizeParams(orbItem?.params);
  const manaGrant = Math.max(1, Math.round(getP1(params, 1)));
  const manaNeeded = Math.max(1, Math.round(getPName(params, 'manat', 35)));
  const baseBuffs = Math.max(1, Math.round(getPName(params, 'buffs', 20)));
  const chance = Number(orbItem?.chance);
  const mastery = masteryBonus(itemsById, placements);
  const expectedBurstBuffs = baseBuffs + mastery;
  const orbCount = Math.max(orbs.length, 1);

  /** @type {{ t: number, delta: number, manaAfter: number, originId: string | null }[]} */
  const manaTrail = [];
  /** @type {{ t: number, amount: number }[]} */
  const peerGrants = [];
  /** @type {number[]} */
  const thresholdActivateTs = [];

  const events = [...(run.events || [])].sort(
    (a, b) => (Number(a.t) || 0) - (Number(b.t) || 0),
  );

  let mana = 0;
  for (const e of events) {
    const t = Number(e.t) || 0;
    if (isThresholdActivate(e)) thresholdActivateTs.push(t);

    if (e.type !== 'buff' && e.type !== 'debuff') continue;
    const stack = eventStack(e);
    const amount = Number(e.amount);
    if (!Number.isFinite(amount) || !stack) continue;
    const target = e.target === 'dummy' ? 'dummy' : 'player';
    if (target !== 'player' && e.actor !== 'player') continue;

    if (stack === 'mana') {
      mana = Math.max(0, mana + amount);
      manaTrail.push({
        t,
        delta: amount,
        manaAfter: mana,
        originId: e.itemId || e.meta?.handler || null,
      });
      if (isManaOrbOrigin(e) && amount > 0) {
        peerGrants.push({ t, amount });
      }
    }
  }

  const fires = clusterOrbBursts(events, manaGrant, expectedBurstBuffs);
  attachManaAroundFire(events, fires);

  /** @type {number[]} */
  const thresholdCrossTs = [];
  let running = 0;
  for (const row of manaTrail) {
    const before = running;
    running = row.manaAfter;
    if (row.delta > 0 && before < manaNeeded && running >= manaNeeded) {
      thresholdCrossTs.push(row.t);
    }
  }
  const firstManaCrossT = thresholdCrossTs[0] ?? null;

  const inferredThresholdFires = fires.reduce(
    (sum, fire) => sum + (fire.inferredOrbFires || 0),
    0,
  );
  const burstBuffTotal = fires.reduce((sum, fire) => sum + fire.buffTotal, 0);

  const peerTotal = peerGrants.reduce((s, g) => s + g.amount, 0);
  /** @type {string[]} */
  const notes = [];
  if (!fires.length && firstManaCrossT != null) {
    notes.push(
      `mana crossed ${manaNeeded} at t=${firstManaCrossT.toFixed(2)} but no orb burst buffs logged`,
    );
  }
  if (!fires.length && firstManaCrossT == null && peerGrants.length) {
    notes.push(
      `Mana Orb granted ${peerTotal} mana via peers but threshold ${manaNeeded} was never reached`,
    );
  }
  if (!fires.length && !peerGrants.length) {
    notes.push('Mana Orb on board but no peer mana grants and no threshold burst');
  }
  if (inferredThresholdFires > orbCount) {
    notes.push(
      `inferred ${inferredThresholdFires} threshold fire(s) for ${orbCount} orb(s) on board (game: once per orb)`,
    );
  }

  return {
    itemId: MANA_ORB_ID,
    name: String(orbItem?.name || 'Mana Orb'),
    count: orbCount,
    catalog: {
      manaGrant,
      manaNeeded,
      buffs: baseBuffs,
      chance: Number.isFinite(chance) ? chance : 50,
    },
    manaMasteryBonus: mastery,
    expectedBurstBuffs,
    peerManaGrants: {
      count: peerGrants.length,
      total: peerTotal,
      expectedPerProc: manaGrant,
      samples: peerGrants.slice(0, 12),
    },
    thresholdCrossCount: thresholdCrossTs.length,
    thresholdFireCount: inferredThresholdFires,
    thresholdActivateCount: thresholdActivateTs.length,
    firstManaCrossT,
    burstBuffTotal,
    fires,
    manaTrailTail: manaTrail.slice(-24),
    notes,
  };
}

/**
 * @param {object} fire
 * @param {number} expectedBuffs
 */
function burstBuffMismatch(fire, expectedBuffs) {
  if (!(fire.buffTotal > 0)) return false;
  if (fire.buffTotal === expectedBuffs) return false;
  if (expectedBuffs > 0 && fire.buffTotal % expectedBuffs === 0) return false;
  return true;
}

/**
 * @param {import('../sim-events.js').SimRun} run
 * @param {Map<string, object> | undefined} itemsById
 * @param {{ id: string }[] | undefined} placements
 */
export function findManaOrbMismatches(run, itemsById, placements) {
  const audit = summarizeManaOrbAudit(run, itemsById, placements);
  if (!audit) return [];

  /** @type {object[]} */
  const flags = [];
  const name = audit.name;
  const need = audit.catalog.manaNeeded;
  const expectedBuffs = audit.expectedBurstBuffs;
  const orbCount = audit.count;

  if (audit.thresholdFireCount > orbCount) {
    flags.push({
      itemId: MANA_ORB_ID,
      name,
      stack: 'activations',
      granted: audit.thresholdFireCount,
      grants: audit.thresholdFireCount,
      expected: orbCount,
      expectedKey: 'mana_orb_once',
      alsoMatches: [],
      note:
        `ManaOrb.gd fires once per orb per fight (activated flag). ` +
        `Sim inferred ${audit.thresholdFireCount} threshold burst(s) for ${orbCount} orb(s).`,
    });
  }

  if (!audit.fires.length && audit.firstManaCrossT != null) {
    flags.push({
      itemId: MANA_ORB_ID,
      name,
      stack: 'mana',
      granted: 0,
      grants: 0,
      expected: 1,
      expectedKey: 'mana_orb_threshold',
      alsoMatches: [],
      note:
        `Mana crossed ${need} at t=${audit.firstManaCrossT.toFixed(2)} but no threshold burst logged ` +
        `(game: useMana(${need}) + giveRandomBuffs).`,
    });
  }

  for (const fire of audit.fires) {
    if (fire.manaSpent > 0 && fire.manaSpent !== need) {
      flags.push({
        itemId: MANA_ORB_ID,
        name,
        stack: 'mana',
        granted: fire.manaSpent,
        grants: fire.inferredOrbFires || 1,
        expected: need,
        expectedKey: 'manat',
        alsoMatches: [],
        note:
          `Mana Orb burst at t=${fire.t.toFixed(2)} spent ${fire.manaSpent} mana; ` +
          `game uses manaNeeded/manat=${need} (not all mana).`,
      });
    }
    if (burstBuffMismatch(fire, expectedBuffs)) {
      flags.push({
        itemId: MANA_ORB_ID,
        name,
        stack: 'buffs',
        granted: fire.buffTotal,
        grants: fire.inferredOrbFires || 1,
        expected: expectedBuffs,
        expectedKey: 'buffs',
        alsoMatches: [],
        note:
          `Mana Orb burst at t=${fire.t.toFixed(2)} granted ${fire.buffTotal} non-mana buffs; ` +
          `expected ${expectedBuffs} per orb` +
          (audit.manaMasteryBonus
            ? ` (catalog buffs=${audit.catalog.buffs} + Mana Mastery ${audit.manaMasteryBonus})`
            : ` (catalog buffs=${audit.catalog.buffs})`) +
          (fire.inferredOrbFires > 1 ? ` — ${fire.inferredOrbFires} orb(s) in window` : '') +
          '.',
      });
    }
    if (fire.poolManaInWindow > 0) {
      flags.push({
        itemId: MANA_ORB_ID,
        name,
        stack: 'mana',
        granted: fire.poolManaInWindow,
        grants: 1,
        expected: 0,
        expectedKey: 'mana_orb_pool',
        alsoMatches: [],
        note:
          `Mana Orb burst at t=${fire.t.toFixed(2)} granted +${fire.poolManaInWindow} mana outside peer size ` +
          `(peer +${audit.catalog.manaGrant}); game erases Mana from stackTypes.`,
      });
    }
  }

  for (const g of audit.peerManaGrants.samples) {
    if (g.amount !== audit.catalog.manaGrant) {
      flags.push({
        itemId: MANA_ORB_ID,
        name,
        stack: 'mana',
        granted: g.amount,
        grants: 1,
        expected: audit.catalog.manaGrant,
        expectedKey: 'mana',
        alsoMatches: [],
        note:
          `Mana Orb peer proc at t=${g.t.toFixed(2)} granted ${g.amount}; ` +
          `catalog p1/mana grant is ${audit.catalog.manaGrant}.`,
      });
      break;
    }
  }

  return flags;
}
