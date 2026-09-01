/**
 * Combat Log + Damage Meter views for debug JSON.
 * Catches grantStacks that never emit buff/debuff events (empty log/meter, stacks still on actor).
 */

import { findVampirismCapMismatches } from './report-params.js';

const METER_STACKS = [
  'block',
  'lucky',
  'regeneration',
  'vampirism',
  'spikes',
  'mana',
  'empower',
  'heat',
  'poison',
  'blind',
  'cold',
];

const STACK_FROM_LABEL = {
  lucky: 'lucky',
  luck: 'lucky',
  regeneration: 'regeneration',
  regen: 'regeneration',
  vampirism: 'vampirism',
  spikes: 'spikes',
  mana: 'mana',
  empower: 'empower',
  heat: 'heat',
  poison: 'poison',
  blind: 'blind',
  cold: 'cold',
  block: 'block',
};

const GD_HEAT = {
  holo_fire_lizard: 'Items/HoloFireLizard.gd giveHeat(heat)',
  oil_lamp: 'Items/OilLamp.gd giveHeat',
};

/** Scripts that must produce a Character HUD stat icon (not a stack). */
const SCRIPT_HUD_STATS = {
  holo_fire_lizard: {
    // Side comes from who activated the card (often the opponent).
    side: 'auto',
    stat: 'effect_dmg_factor',
    param: 'damfactor',
    defaultPct: 8,
    gd: 'Items/HoloFireLizard.gd changeEffectDamageFactor(damFactor)',
  },
};

const HUD_PCT_MIN = 0.05;

/**
 * @param {object} e
 */
function eventStack(e) {
  const raw = e.stack || e.meta?.stack;
  if (raw) return String(raw).toLowerCase().replace(/[^a-z]/g, '');
  const label = String(e.label || '').toLowerCase();
  for (const [needle, stack] of Object.entries(STACK_FROM_LABEL)) {
    if (label.includes(needle)) return stack;
  }
  return null;
}

/**
 * Events the Combat Log panel drops (sim-log-sentences isLogNoise).
 * @param {object} e
 */
function isLogNoise(e) {
  const type = e.type;
  if (type === 'tick' || type === 'fight_start' || type === 'charge') return true;
  if (type === 'cooldown') return true;
  if (e.meta?.noop) return true;
  if (type === 'info' && e.meta?.category === 'adjacency') return true;
  if (type === 'info' && e.meta?.category === 'system' && !e.label) return true;
  if (type === 'info' && e.meta?.category === 'card') return true;
  if (type === 'info' && /Items live \(combat delay/i.test(String(e.label || ''))) return true;
  if (e.meta?.kind === 'block_strip' && type === 'damage') return true;
  if (type === 'stamina' && !e.meta?.starved) {
    const lab = String(e.label || '');
    if (!/\+|regenerat|gain/i.test(lab)) return true;
  }
  return false;
}

function addAmt(map, key, n) {
  if (!key || !n) return;
  map[key] = (map[key] || 0) + n;
}

/**
 * Live runs put heat on summary.player.heat; dumps may use .stacks.
 * @param {object} run
 */
function playerEndStacks(run) {
  const nested = run.summary?.player?.stacks;
  if (nested && typeof nested === 'object' && Object.keys(nested).length) {
    return nested;
  }
  const p = run.summary?.player;
  /** @type {Record<string, number>} */
  const out = {};
  if (p && typeof p === 'object') {
    for (const stack of METER_STACKS) {
      const n = Number(p[stack]);
      if (n) out[stack] = n;
    }
  }
  if (Object.keys(out).length) return out;
  return run.status?.end?.player?.stacks || {};
}

/**
 * @param {import('../sim-events.js').SimRun} run
 * @param {Map<string, object> | undefined} [itemsById]
 */
export function summarizeUiParity(run, itemsById) {
  /** @type {Record<string, number>} */
  const logGained = {};
  /** @type {Record<string, number>} */
  const meterGained = {};
  /** @type {Record<string, { itemId: string | null, name: string, amount: number }[]>} */
  const meterSources = {};
  const activated = new Set();
  /** @type {{ t: number, type: string, stack: string | null, itemId: string | null, amount: number | null, label: string }[]} */
  const logLines = [];

  for (const raw of run.events || []) {
    if (raw.type === 'activate' && raw.itemId) activated.add(String(raw.itemId));
    if (isLogNoise(raw)) continue;
    const stack = eventStack(raw);
    const amt = Number(raw.amount);
    const n = Number.isFinite(amt) ? amt : null;
    logLines.push({
      t: Math.round(Number(raw.t) * 1000) / 1000,
      type: String(raw.type || ''),
      stack,
      itemId: raw.itemId || null,
      amount: n,
      label: String(raw.label || ''),
    });
    if ((raw.type === 'buff' || raw.type === 'debuff') && stack && n && n > 0) {
      addAmt(logGained, stack, n);
      addAmt(meterGained, stack, n);
      if (!meterSources[stack]) meterSources[stack] = [];
      meterSources[stack].push({
        itemId: raw.itemId || null,
        name: String(raw.label || raw.itemId || stack).split(':')[0],
        amount: n,
      });
    }
  }

  const endStacks = playerEndStacks(run);
  /** @type {object[]} */
  const mismatches = [];

  for (const stack of METER_STACKS) {
    const end = Number(endStacks[stack]) || 0;
    const logged = logGained[stack] || 0;
    const metered = meterGained[stack] || 0;
    if (end > 0 && metered <= 0) {
      const hints = [];
      for (const [id, gd] of Object.entries(GD_HEAT)) {
        if (stack === 'heat' && activated.has(id)) hints.push(`${id} (${gd})`);
      }
      mismatches.push({
        surfaces: ['combatLog', 'damageMeter'],
        stack,
        end,
        combatLogGained: logged,
        meterGained: metered,
        meterTabEmpty: true,
        hint:
          hints[0] ||
          `Actor ended with ${end} ${stack} but Combat Log / Damage Meter "${stack}" Gained is empty — grantStacks without a buff/debuff event.`,
      });
    }
  }

  const byType = {};
  for (const line of logLines) {
    byType[line.type] = (byType[line.type] || 0) + 1;
  }

  const hud = summarizeHudParity(run, activated, itemsById);
  mismatches.push(...hud.mismatches);
  for (const flag of findVampirismCapMismatches(run, itemsById)) {
    mismatches.push({
      surfaces: ['combatLog', 'healMeter'],
      stack: 'vampirism',
      itemId: flag.itemId,
      hint: flag.note,
    });
  }

  return {
    combatLog: {
      lineCount: logLines.length,
      byType,
      stackGained: logGained,
      sample: logLines.slice(0, 40),
    },
    damageMeter: {
      stackTabs: Object.fromEntries(
        METER_STACKS.map((stack) => [
          stack,
          {
            gained: meterGained[stack] || 0,
            empty: !(meterGained[stack] > 0),
            sources: meterSources[stack] || [],
          },
        ]),
      ),
    },
    hud: hud.hud,
    mismatches,
  };
}

function lastCombatStats(run, side) {
  const snaps = run.snapshots;
  if (Array.isArray(snaps) && snaps.length) {
    const last = snaps[snaps.length - 1];
    const stats = last?.[side]?.combatStats;
    if (stats && typeof stats === 'object') return stats;
  }
  const fromSummary = run.summary?.[side]?.combatStats;
  return fromSummary && typeof fromSummary === 'object' ? fromSummary : {};
}

function visibleHudIcons(stats) {
  /** @type {{ key: string, value: number }[]} */
  const icons = [];
  for (const [key, raw] of Object.entries(stats || {})) {
    const n = Number(raw) || 0;
    if (Math.abs(n) < HUD_PCT_MIN) continue;
    icons.push({ key, value: n });
  }
  return icons;
}

/**
 * Which combatant activated `itemId` (player / dummy / both).
 * @param {import('../sim-events.js').SimRun} run
 * @param {string} itemId
 */
function activationSides(run, itemId) {
  let player = false;
  let dummy = false;
  for (const e of run.events || []) {
    if (e.type !== 'activate' || e.itemId !== itemId) continue;
    if (e.actor === 'dummy') dummy = true;
    else player = true;
  }
  return { player, dummy };
}

function summarizeHudParity(run, activated, itemsById) {
  const playerStats = lastCombatStats(run, 'player');
  const dummyStats = lastCombatStats(run, 'dummy');
  /** @type {object[]} */
  const mismatches = [];
  /** @type {{ itemId: string, stat: string, expectedPct: number, gd: string }[]} */
  const expected = [];

  for (const [itemId, spec] of Object.entries(SCRIPT_HUD_STATS)) {
    if (!activated.has(itemId)) continue;
    const it = itemsById?.get(itemId);
    const params = it?.params || {};
    const expectedPct = Number(params[spec.param]);
    const pct = Number.isFinite(expectedPct) ? expectedPct : spec.defaultPct;
    expected.push({ itemId, stat: spec.stat, expectedPct: pct, gd: spec.gd });
    const sides =
      spec.side === 'auto' ? activationSides(run, itemId) : { player: spec.side !== 'dummy', dummy: spec.side === 'dummy' };
    const checks = [];
    if (sides.player) checks.push(Number(playerStats[spec.stat]) || 0);
    if (sides.dummy) checks.push(Number(dummyStats[spec.stat]) || 0);
    if (!checks.length) checks.push(Number(playerStats[spec.stat]) || 0);
    // Pass if any activating side shows the HUD icon (2× Holo → 16% on dummy).
    const shown = Math.max(...checks);
    if (Math.abs(shown) < HUD_PCT_MIN) {
      mismatches.push({
        surfaces: ['hud'],
        stat: spec.stat,
        itemId,
        expectedPct: pct,
        shownPct: shown,
        hint: `${itemId} should show HUD "${spec.stat}" ~${pct}% (${spec.gd}). Icon missing on the activating side — combat-stat field not applied (HUD reads effectDmgFactor / combatStats.${spec.stat}).`,
      });
    }
  }

  return {
    hud: {
      player: { icons: visibleHudIcons(playerStats), combatStats: playerStats },
      dummy: { icons: visibleHudIcons(dummyStats), combatStats: dummyStats },
      expected,
    },
    mismatches,
  };
}
