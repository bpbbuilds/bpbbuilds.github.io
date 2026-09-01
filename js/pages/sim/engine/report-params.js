/**
 * Compare combat grant amounts to catalog item params (catch wrong getPName).
 * Phase 259: do not delete flags here to make a dump look clean — fix the sim.
 */

import { normalizeParams } from './params.js';
import { buildBoardGraph } from './board-graph.js';
import { damageKindFromItem } from './item-kind.js';
import {
  BAG_OF_STONES_ID,
  STONE_THROW_IDS,
  bagStarsThisStone,
} from './scripts/stone-ammo.js';
import { findCdThenConsumeMismatches } from './report-cd-consume.js';
import { findManaOrbMismatches } from './report-mana-orb.js';

const STACK_PARAM_KEYS = {
  vampirism: ['vampirism', 'vamp'],
  lucky: ['lucky', 'luck'],
  regeneration: ['regeneration', 'regen'],
  blind: ['blind'],
  poison: ['poison', 'poisont', 'poisond'],
  heat: ['heat'],
  cold: ['cold'],
  spikes: ['spikes'],
  empower: ['empower'],
  block: ['block'],
  mana: ['mana'],
};

function namedEntries(params) {
  return Object.entries(params).filter(([k]) => !/^p\d+$/i.test(k));
}

function expectedParam(params, stack) {
  const keys = STACK_PARAM_KEYS[stack] || [stack];
  for (const key of keys) {
    if (params[key] != null) return { key, value: params[key] };
  }
  return null;
}

function sameNumber(a, b) {
  return Math.abs(Number(a) - Number(b)) < 1e-6;
}

/**
 * Amount matches a catalog value as stacks or as a percent field (/100).
 * @param {number} amount
 * @param {number} paramVal
 */
function amountFitsParam(amount, paramVal) {
  if (sameNumber(amount, paramVal)) return 'exact';
  if (sameNumber(amount, paramVal / 100)) return 'percent';
  return null;
}

function inferStack(e) {
  const fromMeta = e.stack || e.meta?.stack;
  if (fromMeta) {
    return String(fromMeta)
      .toLowerCase()
      .replace(/[^a-z]/g, '');
  }
  const m = String(e.label || '').match(
    /\+\s*(-?\d+(?:\.\d+)?)\s+(lucky|luck|vampirism|regeneration|regen|blind|poison|heat|cold|spikes|empower|block|mana)\b/i,
  );
  return m ? m[2].toLowerCase().replace(/luck$/, 'lucky').replace(/^regen$/, 'regeneration') : null;
}

/**
 * @param {import('../sim-events.js').SimRun} run
 * @param {Map<string, object> | undefined} itemsById
 */
export function findParamMismatches(run, itemsById, placements) {
  /** @type {object[]} */
  const flags = [];
  flags.push(...findUnhealingMismatches(run));
  flags.push(...findStoneAmmoMismatches(run, itemsById, placements));
  flags.push(...findCdThenConsumeMismatches(run, itemsById));
  flags.push(...findManaOrbMismatches(run, itemsById, placements));
  flags.push(...findRangedVampirismMismatches(run, itemsById));
  flags.push(...findEffectVampirismMismatches(run));
  flags.push(...findVampirismCapMismatches(run, itemsById));
  flags.push(...findBlockStripMismatches(run, itemsById));
  if (!itemsById) return flags;

  /** @type {Map<string, { itemId: string, stack: string, amounts: number[] }>} */
  const groups = new Map();
  for (const e of run.events || []) {
    if (e.type !== 'buff' && e.type !== 'debuff') continue;
    if (e.meta?.kind === 'block_strip') continue;
    const itemId = e.itemId || e.meta?.handler || null;
    const stack = inferStack(e);
    const amount = Number(e.amount);
    if (!itemId || !stack || !Number.isFinite(amount)) continue;
    const k = `${itemId}\0${stack}`;
    let g = groups.get(k);
    if (!g) {
      g = { itemId, stack, amounts: [] };
      groups.set(k, g);
    }
    g.amounts.push(amount);
  }

  for (const g of groups.values()) {
    const item = itemsById.get(g.itemId);
    const params = normalizeParams(item?.params);
    if (!Object.keys(params).length) continue;

    const counts = new Map();
    for (const n of g.amounts) counts.set(n, (counts.get(n) || 0) + 1);
    const granted = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];

    const expected = expectedParam(params, g.stack);
    const otherHits = namedEntries(params)
      .filter(([key, val]) => {
        if (expected && key === expected.key) return false;
        return !!amountFitsParam(granted, val);
      })
      .map(([key, value]) => ({
        key,
        value,
        how: amountFitsParam(granted, value),
      }));

    const fitsExpected = expected ? amountFitsParam(granted, expected.value) : null;
    if (fitsExpected === 'exact') continue;

    // Item.getBlock() is descriptor.block (tooltip block), not params.block amp.
    if (
      g.stack === 'block' &&
      item?.block != null &&
      amountFitsParam(granted, item.block) === 'exact'
    ) {
      continue;
    }

    // Cards (Darkest Lotus, …): GD getP1() * chainPosition. A single grant that
    // is an integer multiple of the catalog param is chain scaling, not a wrong key.
    const isCard = /card/i.test(String(item?.type || ''));
    if (
      isCard &&
      expected &&
      g.amounts.length === 1 &&
      expected.value > 0 &&
      granted > expected.value &&
      granted % expected.value === 0
    ) {
      continue;
    }

    if (expected && !fitsExpected) {
      flags.push({
        itemId: g.itemId,
        name: String(item?.name || g.itemId),
        stack: g.stack,
        granted,
        grants: g.amounts.length,
        expected: expected.value,
        expectedKey: expected.key,
        alsoMatches: otherHits,
        note:
          otherHits.length > 0
            ? `grant ${granted} is catalog ${otherHits[0].key}=${otherHits[0].value}, not ${expected.key}=${expected.value}`
            : `grant ${granted} ≠ catalog ${expected.key}=${expected.value}`,
      });
      continue;
    }

    // Amulet of Fortune giveMostBuffs(buffs) often lands on lucky.
    if (
      !expected &&
      otherHits.some((h) => h.key === 'buffs' && h.how === 'exact') &&
      g.stack === 'lucky'
    ) {
      continue;
    }

    if (!expected && otherHits.length) {
      flags.push({
        itemId: g.itemId,
        name: String(item?.name || g.itemId),
        stack: g.stack,
        granted,
        grants: g.amounts.length,
        expected: null,
        expectedKey: STACK_PARAM_KEYS[g.stack]?.[0] || g.stack,
        alsoMatches: otherHits,
        note: `no catalog key for ${g.stack}; grant ${granted} equals ${otherHits.map((h) => `${h.key}=${h.value}`).join(', ')}`,
      });
    }
  }

  flags.push(...findMaxHealthMismatches(run, itemsById));
  flags.push(...findMissingConsumeActivations(run, itemsById));
  return flags;
}

/**
 * Game Item.consume() always calls activate() → ItemMetrics.Activations
 * (bags skipped). Combat-start consume (Piggybank, Pocket Sand, …) must
 * emit type:'activate' or the Activations meter omits them.
 * @param {import('../sim-events.js').SimRun} run
 * @param {Map<string, object> | undefined} itemsById
 */
export function findMissingConsumeActivations(run, itemsById) {
  const events = run.events || [];
  /** @type {Map<string, { itemId: string|null, name: string, handler: string|null }>} */
  const consumed = new Map();
  /** @type {Map<string, number>} */
  const activates = new Map();

  for (const e of events) {
    const key = e.placementKey || e.itemId;
    if (!key) continue;
    if (e.type === 'activate') {
      activates.set(key, (activates.get(key) || 0) + 1);
      continue;
    }
    const handler = e.meta?.handler ? String(e.meta.handler) : null;
    const consumedFlag =
      e.meta?.consumed === true ||
      /consumed/i.test(String(e.label || '')) ||
      handler === 'piggybank' ||
      handler === 'pocket_sand';
    if (!consumedFlag) continue;
    if (consumed.has(key)) continue;
    const itemId = e.itemId || handler;
    const item = itemId && itemsById ? itemsById.get(itemId) : null;
    const fromLabel = String(e.label || '').match(/^([^:]+):/)?.[1]?.trim();
    consumed.set(key, {
      itemId: itemId || null,
      name: String(item?.name || fromLabel || itemId || key),
      handler,
    });
  }

  /** @type {object[]} */
  const flags = [];
  for (const [key, info] of consumed) {
    const n = activates.get(key) || 0;
    if (n >= 1) continue;
    flags.push({
      itemId: info.itemId,
      name: info.name,
      stack: 'activations',
      granted: n,
      grants: n,
      expected: 1,
      expectedKey: 'activate',
      alsoMatches: [],
      note: `game: Item.consume() → activate() → Activations tab; ${info.name} consumed at combat start with 0 activate events (Activations meter would omit it)`,
    });
  }
  return flags;
}

/**
 * Character.heal: every logged heal (vamp, regen, potions, Lovers, …) deals
 * ceil(amount × unhealing) to the opponent. Max-HP grants are not heal().
 * @param {import('../sim-events.js').SimRun} run
 */
function isLoggedHealEvent(e) {
  if (e.type !== 'heal' && e.meta?.category !== 'hot') return false;
  if (/max\s*hp/i.test(String(e.label || ''))) return false;
  if (e.meta?.handler === 'start_max_hp' || e.meta?.handler === 'piggybank') return false;
  return true;
}

/**
 * Game Character.heal: round(heal) then ceil(logged × unhealing) per tick.
 * 15% of 3 is 0.45 → ceil 1. Attach samples so reports show the rounding.
 * @param {import('../sim-events.js').SimRun} run
 */
export function summarizeUnhealingMath(run) {
  const rate = Number(run.summary?.player?.unhealing) || 0;
  const events = run.events || [];
  /** @type {{ heal: number, exact: number, ceil: number }[]} */
  const samples = [];
  let healLogged = 0;
  let healGrants = 0;
  let expected = 0;
  let exactFloat = 0;
  for (const e of events) {
    if (!isLoggedHealEvent(e)) continue;
    if (e.actor && e.actor !== 'player') continue;
    const logged = Number(e.meta?.loggedAmount);
    const n =
      Number.isFinite(logged) && logged > 0 ? logged : Number(e.amount);
    if (!Number.isFinite(n) || n <= 0) continue;
    healLogged += n;
    healGrants += 1;
    const exact = n * rate;
    const ceil = rate > 0 ? Math.ceil(exact) : 0;
    exactFloat += exact;
    expected += ceil;
    if (samples.length < 8) samples.push({ heal: n, exact, ceil });
  }
  let actual = 0;
  let actualGrants = 0;
  for (const e of events) {
    if (e.type !== 'damage') continue;
    const unh =
      e.meta?.kind === 'unhealing' ||
      e.meta?.systemOrigin === 'Unhealing' ||
      /^Unhealing\b/i.test(String(e.label || ''));
    if (!unh) continue;
    if (e.actor && e.actor !== 'player') continue;
    const n = Number(e.amount);
    if (!Number.isFinite(n) || n <= 0) continue;
    actual += n;
    actualGrants += 1;
  }
  return {
    rate,
    healLogged,
    healGrants,
    exactFloat,
    expectedCeil: expected,
    actual,
    actualGrants,
    samples,
    note: `game: ceil(each logged heal × ${rate}) — e.g. 15% of 3 is 0.45 → 1; 15% of 1 is 0.15 → 1 (never 0)`,
  };
}

/**
 * @param {import('../sim-events.js').SimRun} run
 */
export function findUnhealingMismatches(run) {
  const math = summarizeUnhealingMath(run);
  const { rate, actual, actualGrants, expectedCeil, healLogged, healGrants, samples } = math;
  const sampleTxt = samples
    .map((s) => `${s.heal}×${rate}=${s.exact}→ceil ${s.ceil}`)
    .join('; ');
  const breakdown = `samples: ${sampleTxt || 'none'}; exactFloat ${math.exactFloat} vs ceil ${expectedCeil}`;

  if (rate <= 0) {
    if (actual <= 0) return [];
    return [
      {
        itemId: null,
        name: 'Unhealing',
        stack: 'unhealing',
        granted: actual,
        grants: actualGrants,
        expected: 0,
        expectedKey: 'unhealing',
        alsoMatches: [],
        note: `sim dealt ${actual} Unhealing with player unhealing=0`,
        breakdown,
      },
    ];
  }
  if (healLogged <= 0) return [];
  if (Math.abs(actual - expectedCeil) < 0.5) return [];
  return [
    {
      itemId: null,
      name: 'Unhealing',
      stack: 'unhealing',
      granted: actual,
      grants: actualGrants,
      expected: expectedCeil,
      expectedKey: 'unhealing',
      alsoMatches: [],
      note: `game: ceil(each heal × unhealing) — ${healLogged} logged over ${healGrants} ticks at ${rate} → ${expectedCeil} Unhealing; sim dealt ${actual}. ${breakdown}`,
    },
  ];
}

/**
 * Stone.gd ammo=1 unless Bag of Stones UP-1 star. Flag extra throws.
 * @param {import('../sim-events.js').SimRun} run
 * @param {Map<string, object> | undefined} itemsById
 * @param {{ id: string, x: number, y: number, r?: number, key?: string }[] | undefined} placements
 */
function findStoneAmmoMismatches(run, itemsById, placements) {
  const places = (placements || []).map((p) => ({
    id: p.id,
    x: p.x,
    y: p.y,
    r: Number(p.r) || 0,
    key: p.key || '',
  }));
  const graph =
    places.length && itemsById ? buildBoardGraph(places, itemsById) : null;

  /** @type {Map<string, { itemId: string, name: string, n: number }>} */
  const throws = new Map();
  for (const e of run.events || []) {
    if (e.type !== 'activate') continue;
    const itemId = e.itemId;
    if (!itemId || !STONE_THROW_IDS.has(itemId)) continue;
    const key = e.placementKey || itemId;
    let row = throws.get(key);
    if (!row) {
      const item = itemsById?.get(itemId);
      row = { itemId, name: String(item?.name || itemId), n: 0 };
      throws.set(key, row);
    }
    row.n += 1;
  }

  /** @type {object[]} */
  const flags = [];
  for (const [key, info] of throws) {
    if (info.n <= 1) continue;
    const starred = graph ? bagStarsThisStone(graph, key, itemsById) : false;
    if (starred) continue;
    flags.push({
      itemId: info.itemId,
      name: info.name,
      stack: 'activations',
      granted: info.n,
      grants: info.n,
      expected: 1,
      expectedKey: 'ammunition',
      alsoMatches: [],
      note: `game: Stone.gd ammunition=1 unless ${BAG_OF_STONES_ID} stars the cell immediately above the bag (setBagOfStones 9000); ${info.name} activated ${info.n} times with no bag star`,
    });
  }
  return flags;
}

/**
 * Character.applyVampirism: rangedVampirismLimit default 0, so Ranged
 * weapons (Magic Staff) must not lifesteal. Flag vampirism heals from them.
 * @param {import('../sim-events.js').SimRun} run
 * @param {Map<string, object> | undefined} itemsById
 */
function findRangedVampirismMismatches(run, itemsById) {
  if (!itemsById) return [];
  const limit = Number(run.summary?.player?.rangedVampirismLimit);
  if (Number.isFinite(limit) && limit > 0) return [];

  /** @type {Map<string, { name: string, n: number, heals: number }>} */
  const byItem = new Map();
  for (const e of run.events || []) {
    if (e.type !== 'heal') continue;
    const vamp =
      e.meta?.systemOrigin === 'Vampirism' ||
      e.meta?.kind === 'vampirism' ||
      ( /vampirism/i.test(String(e.label || '')) && !/spent/i.test(String(e.label || '')) );
    if (!vamp) continue;
    const itemId = e.itemId;
    if (!itemId) continue;
    const item = itemsById.get(itemId);
    if (!item || damageKindFromItem(item) !== 'ranged') continue;
    const n = Number(e.amount);
    if (!Number.isFinite(n) || n <= 0) continue;
    let row = byItem.get(itemId);
    if (!row) {
      row = { name: String(item?.name || itemId), n: 0, heals: 0 };
      byItem.set(itemId, row);
    }
    row.n += n;
    row.heals += 1;
  }

  /** @type {object[]} */
  const flags = [];
  for (const [itemId, info] of byItem) {
    flags.push({
      itemId,
      name: info.name,
      stack: 'vampirism',
      granted: info.n,
      grants: info.heals,
      expected: 0,
      expectedKey: 'rangedVampirismLimit',
      alsoMatches: [],
      note: `game: applyVampirism uses rangedVampirismLimit (default 0) for Ranged sources; ${info.name} is Ranged so it should not lifesteal. Sim logged ${info.n} vampirism heal over ${info.heals} hits (that then feeds Unhealing).`,
    });
  }
  return flags;
}

/**
 * Item.dealEffectDamage / effectFlags: no CanTriggerVampirism (and no
 * Character.dealDamage → applyVampirism). Flag vamp heals nested under effect hits.
 * @param {import('../sim-events.js').SimRun} run
 */
function findEffectVampirismMismatches(run) {
  const events = run.events || [];
  /** @type {Map<number, object>} */
  const byId = new Map();
  for (const e of events) {
    const id = e.meta?.eventId;
    if (id != null) byId.set(id, e);
  }
  /** @type {Map<string, { name: string, n: number, heals: number }>} */
  const byItem = new Map();
  for (const e of events) {
    if (!isVampirismHealEvent(e)) continue;
    const parent = byId.get(e.meta?.parentId);
    if (!parent?.meta?.effect) continue;
    const n = healLoggedAmount(e);
    if (n <= 0) continue;
    const itemId = e.itemId || parent.itemId || '*';
    let row = byItem.get(itemId);
    if (!row) {
      row = {
        name: String(e.label || parent.label || itemId).replace(/:.*/, '') || itemId,
        n: 0,
        heals: 0,
      };
      byItem.set(itemId, row);
    }
    row.n += n;
    row.heals += 1;
  }
  /** @type {object[]} */
  const flags = [];
  for (const [itemId, info] of byItem) {
    flags.push({
      itemId: itemId === '*' ? null : itemId,
      name: info.name,
      stack: 'vampirism',
      granted: info.n,
      grants: info.heals,
      expected: 0,
      expectedKey: 'effectFlags',
      alsoMatches: [],
      note: `game: dealEffectDamage uses effectFlags (no CanTriggerVampirism) and skips Character.applyVampirism; ${info.name} logged ${info.n} vamp heal over ${info.heals} effect hit(s).`,
    });
  }
  return flags;
}

function isVampirismHealEvent(e) {
  if (!e || e.type !== 'heal') return false;
  if (e.meta?.systemOrigin === 'Vampirism' || e.meta?.kind === 'vampirism') return true;
  if (e.stack === 'vampirism' || e.meta?.stack === 'vampirism') return true;
  const label = String(e.label || '');
  // Ghost.gd / useRandomBuffs: item heal after spending a buff — not applyVampirism.
  if (/spent/i.test(label)) return false;
  return /vampirism/i.test(label);
}

function healLoggedAmount(e) {
  const logged = Number(e.meta?.loggedAmount);
  if (Number.isFinite(logged) && logged > 0) return logged;
  const n = Number(e.amount);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Character.applyVampirism: min(stacks, round(damage × melee/ranged limit)),
 * then heal() applies healing efficiency. Hungry Blade being Vampiric does
 * not add extra heal — only the stacks it granted. Flag heal > stacks or
 * heal ≠ that min (the report used to ignore this and only check ranged).
 * @param {import('../sim-events.js').SimRun} run
 * @param {Map<string, object> | undefined} itemsById
 */
export function findVampirismCapMismatches(run, itemsById) {
  // Keep emission order. Hits are keyed by attacker (not defender) so player→dummy
  // weapons match player vamp heals. onPreDealDamageEarly grants (Bloodthorne /
  // Hungry Blade) are logged after damage+heal but already applied before
  // applyVampirism — peek same-t fromGrantStacks from the healing weapon.
  const events = run.events || [];
  let playerStacks = 0;
  let dummyStacks = 0;
  // Do NOT seed from summary end healAmp — that double-counts with event stats.
  let playerHealAmp = 0;
  let dummyHealAmp = 0;
  /** @type {Map<string, { damage: number, t: number }>} */
  const lastHitBySide = new Map();
  /** @type {Map<string, { name: string, n: number, heals: number, sample: string }>} */
  const byItem = new Map();

  /**
   * @param {object} e
   * @param {number} i
   * @param {string} healSide
   * @param {string | null} itemId
   */
  function stacksForVampHeal(e, i, healSide, itemId) {
    let stacks = healSide === 'dummy' ? dummyStacks : playerStacks;
    const t = Number(e.t) || 0;
    if (!itemId || itemId === '*') return stacks;
    for (let j = i + 1; j < events.length; j += 1) {
      const f = events[j];
      if (Math.abs((Number(f.t) || 0) - t) > 1e-9) break;
      if (f.type !== 'buff' && f.type !== 'debuff') continue;
      if (inferStack(f) !== 'vampirism') continue;
      if (f.itemId !== itemId || !f.meta?.fromGrantStacks) continue;
      const n = Number(f.amount);
      if (Number.isFinite(n)) stacks = Math.max(0, stacks + n);
    }
    return stacks;
  }

  for (let i = 0; i < events.length; i += 1) {
    const e = events[i];
    // Prefer target — hostile strips (Darkest Lotus) have actor=opp, target=player.
    const buffSide =
      e.target === 'dummy' || e.target === 'player'
        ? e.target
        : e.actor === 'dummy'
          ? 'dummy'
          : 'player';
    if (e.type === 'buff' || e.type === 'debuff') {
      const stack = inferStack(e);
      if (stack === 'vampirism') {
        const n = Number(e.amount);
        if (Number.isFinite(n)) {
          if (buffSide === 'dummy') dummyStacks = Math.max(0, dummyStacks + n);
          else playerStacks = Math.max(0, playerStacks + n);
        }
      }
    }
    if (e.type === 'stat') {
      const statSide = e.actor === 'dummy' ? 'dummy' : 'player';
      const stat = String(e.meta?.stat || e.stat || '');
      if (stat === 'heal_efficiency' || stat === 'healAmp') {
        const n = Number(e.amount);
        if (Number.isFinite(n)) {
          if (statSide === 'dummy') dummyHealAmp += n / 100;
          else playerHealAmp += n / 100;
        }
      }
    }
    if (e.type === 'damage' && e.target !== e.actor && e.meta?.kind !== 'unhealing') {
      const dmg = Number(e.amount);
      const itemId = e.itemId;
      // Attacker side — defender-keyed hits never match the healer's vamp row.
      const atkSide = e.actor === 'dummy' ? 'dummy' : 'player';
      if (itemId && Number.isFinite(dmg) && dmg > 0) {
        lastHitBySide.set(`${atkSide}:${itemId}`, { damage: dmg, t: Number(e.t) || 0 });
        lastHitBySide.set(`${atkSide}:*`, { damage: dmg, t: Number(e.t) || 0 });
      }
    }
    if (!isVampirismHealEvent(e)) continue;
    // Effect hits must not vamp — reported by findEffectVampirismMismatches.
    if (e.meta?.parentId != null) {
      const parent = events.find((x) => x.meta?.eventId === e.meta.parentId);
      if (parent?.meta?.effect) continue;
    }
    const actual = healLoggedAmount(e);
    if (actual <= 0) continue;
    const healSide =
      e.target === 'dummy' || e.actor === 'dummy' ? 'dummy' : 'player';
    const itemId = e.itemId || '*';
    const stacks = stacksForVampHeal(e, i, healSide, itemId);
    const healAmp = healSide === 'dummy' ? dummyHealAmp : playerHealAmp;
    const item = itemId !== '*' ? itemsById?.get(itemId) : null;
    const ranged = item ? damageKindFromItem(item) === 'ranged' : false;
    const actorSummary =
      healSide === 'dummy' ? run.summary?.dummy : run.summary?.player;
    const meleeLimit = Number(actorSummary?.meleeVampirismLimit);
    const rangedLimit = Number(actorSummary?.rangedVampirismLimit);
    const limit = ranged
      ? Number.isFinite(rangedLimit)
        ? rangedLimit
        : 0
      : Number.isFinite(meleeLimit)
        ? meleeLimit
        : 1;
    const hit =
      lastHitBySide.get(`${healSide}:${itemId}`) ||
      lastHitBySide.get(`${healSide}:*`);
    const dmg = hit && (Number(e.t) || 0) - hit.t < 0.05 ? hit.damage : actual;
    const base = Math.min(stacks, Math.round(dmg * limit));
    const expected = Math.round(base * (1 + healAmp));
    if (Math.abs(actual - expected) < 0.5) continue;
    const name = String(item?.name || e.label || itemId);
    let row = byItem.get(itemId);
    if (!row) {
      row = { name, n: 0, heals: 0, sample: '' };
      byItem.set(itemId, row);
    }
    row.n += actual;
    row.heals += 1;
    if (!row.sample) {
      row.sample = `t=${Number(e.t).toFixed(2)}s ${name} heal ${actual} with ${stacks} vamp stack(s), hit ${dmg} → game min(stacks, round(dmg×${limit})) then heal amp → ${expected}`;
    }
  }

  /** @type {object[]} */
  const flags = [];
  for (const [itemId, info] of byItem) {
    flags.push({
      itemId: itemId === '*' ? null : itemId,
      name: info.name,
      stack: 'vampirism',
      granted: info.n,
      grants: info.heals,
      expected: null,
      expectedKey: 'meleeVampirismLimit',
      alsoMatches: [],
      note: `game: applyVampirism is min(vampirism stacks, round(damage × meleeVampirismLimit=1)); Vampiric items do not extra-heal. ${info.sample}. Sim logged ${info.n} over ${info.heals} vamp heal(s).`,
    });
  }
  return flags;
}

/**
 * Stone.gd (and Item.removeBlock): strip counts as Damage Dealt.
 * Dummy starts at 0 block so the extra meter is untestable unless dummyBlock=.
 * @param {import('../sim-events.js').SimRun} run
 * @param {Map<string, object> | undefined} itemsById
 */
function findBlockStripMismatches(run, itemsById) {
  const startBlock = Math.max(
    0,
    Number(run.dummyStartBlock) ||
      Number(run.snapshots?.[0]?.dummy?.block) ||
      0,
  );
  const events = run.events || [];
  /** @type {object[]} */
  const flags = [];

  const stoneActs = events.filter(
    (e) => e.type === 'activate' && e.itemId && STONE_THROW_IDS.has(e.itemId),
  );
  if (!stoneActs.length) return flags;

  const firstId = stoneActs[0].itemId;
  const name = String(itemsById?.get(firstId)?.name || firstId);

  if (startBlock <= 0) {
    const strips = events.filter(
      (e) => e.type === 'damage' && e.meta?.kind === 'block_strip',
    );
    if (strips.length === 0) {
      flags.push({
        itemId: firstId,
        name,
        stack: 'block',
        granted: 0,
        grants: 0,
        expected: 4,
        expectedKey: 'blockremoval',
        alsoMatches: [],
        note: 'block strip untested (dummy block 0). Game Stone.removeBlock(getP1) in pre-hit; Damage Dealt includes stripped block. Add &dummyBlock=8 to the sim URL to test.',
      });
    }
    return flags;
  }

  for (const act of stoneActs) {
    const itemId = act.itemId;
    const itemName = String(itemsById?.get(itemId)?.name || itemId);
    const strips = events.filter(
      (e) =>
        e.type === 'damage' &&
        e.meta?.kind === 'block_strip' &&
        (e.itemId === itemId || e.placementKey === act.placementKey),
    );
    const stripAmt = strips.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const hits = events.filter(
      (e) =>
        e.type === 'damage' &&
        e.itemId === itemId &&
        e.meta?.kind !== 'block_strip' &&
        e.target === 'dummy',
    );
    const hitAmt = hits.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    if (stripAmt <= 0) {
      flags.push({
        itemId,
        name: itemName,
        stack: 'block',
        granted: 0,
        grants: 0,
        expected: startBlock,
        expectedKey: 'blockremoval',
        alsoMatches: [],
        note: `dummy started with ${startBlock} block but ${itemName} logged no removeBlock Damage Dealt (game credits stripped block on the Damage tab).`,
      });
      continue;
    }
    const hpOnly = hits.every((e) => {
      const hp = Number(e.meta?.healthDamage);
      const amt = Number(e.amount);
      return Number.isFinite(hp) && hp === amt && (Number(e.meta?.blocked) || 0) > 0;
    });
    if (hpOnly && hits.length) {
      flags.push({
        itemId,
        name: itemName,
        stack: 'block',
        granted: hitAmt,
        grants: hits.length,
        expected: hitAmt + stripAmt,
        expectedKey: 'damage',
        alsoMatches: [],
        note: `game Damage Dealt uses full hit damage (not HP) plus removeBlock; ${itemName} hits look HP-only while dummy blocked. Hits ${hitAmt} + strip ${stripAmt}.`,
      });
    }
  }
  return flags;
}

/**
 * Piggybank etc.: giveMaxHealth(maxhealth × affected). Catch hardcoded 15 vs maxhealth 2.
 * @param {import('../sim-events.js').SimRun} run
 * @param {Map<string, object>} itemsById
 */
function findMaxHealthMismatches(run, itemsById) {
  /** @type {Map<string, number[]>} */
  const byItem = new Map();
  for (const e of run.events || []) {
    const isMaxHp =
      e.meta?.handler === 'start_max_hp' ||
      /max\s*hp/i.test(String(e.label || '')) ||
      (e.type === 'heal' && /piggy/i.test(String(e.label || '')));
    if (!isMaxHp) continue;
    const itemId = e.itemId || e.meta?.handler || null;
    const amount = Number(e.amount);
    if (!itemId || !Number.isFinite(amount)) continue;
    const list = byItem.get(itemId) || [];
    list.push(amount);
    byItem.set(itemId, list);
  }

  /** @type {object[]} */
  const flags = [];
  for (const [itemId, amounts] of byItem) {
    const item = itemsById.get(itemId);
    const params = normalizeParams(item?.params);
    const maxhealth = params.maxhealth ?? params.maxhp ?? null;
    if (maxhealth == null) continue;
    const granted = amounts[0];
    const per = Number(maxhealth);
    if (!(per > 0)) continue;
    const remainder = Math.abs(granted / per - Math.round(granted / per));
    const isMultiple = remainder < 1e-6;
    if (sameNumber(granted, per)) continue;
    if (isMultiple) continue;
    flags.push({
      itemId,
      name: String(item?.name || itemId),
      stack: 'maxhealth',
      granted,
      grants: amounts.length,
      expected: per,
      expectedKey: 'maxhealth',
      alsoMatches: namedEntries(params)
        .filter(([key, val]) => key !== 'maxhealth' && amountFitsParam(granted, val))
        .map(([key, value]) => ({ key, value, how: amountFitsParam(granted, value) })),
      note: `max HP / start heal ${granted} is not a multiple of catalog maxhealth=${per} (game: maxhealth × start-of-battle items in range)`,
    });
  }
  return flags;
}
