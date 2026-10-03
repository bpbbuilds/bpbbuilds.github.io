/**
 * Export sim run JSON for bug reports / parity notes.
 */

import { combatDurationSec, toCombatLogTime } from '../sim-combat-time.js';
import { summarizeStatusReport } from './report-status.js';
import { findParamMismatches, summarizeUnhealingMath } from './report-params.js';
import { summarizeManaOrbAudit } from './report-mana-orb.js';
import { summarizeUiParity } from './report-ui.js';
import { summarizeChanceWeaponAudits } from './report-weapon-audit.js';
import { normalizeParams } from './params.js';
import { conformSimEvents } from '../sim-events.js';

/**
 * @param {import('../sim-events.js').SimRun} run
 */
function lastPieceByKey(run) {
  const snaps = run.pieceSnapshots;
  if (!Array.isArray(snaps) || !snaps.length) return null;
  const last = snaps[snaps.length - 1];
  const byKey = last?.byKey;
  if (!byKey || typeof byKey !== 'object') return null;
  /** @type {Record<string, object>} */
  const out = {};
  for (const [key, raw] of Object.entries(byKey)) {
    if (!raw || typeof raw !== 'object') continue;
    const p = /** @type {Record<string, unknown>} */ (raw);
    out[key] = {
      itemId: p.itemId,
      damageMin: p.damageMin,
      damageMax: p.damageMax,
      cooldown: p.cooldown,
      staminaCost: p.staminaCost,
      accuracy: p.accuracy,
      bonusDamage: p.bonusDamage,
      bonusDamageFactor: p.bonusDamageFactor,
      speedScale: p.speedScale,
      critChance: p.critChance,
      chance: p.chance,
      chanceRolls: p.chanceRolls,
      chanceProcs: p.chanceProcs,
      statMods: p.statMods || [],
    };
  }
  return { t: last.t, byKey: out };
}

/**
 * @param {string} id
 * @param {object | undefined} it
 */
function catalogRow(id, it) {
  const params = normalizeParams(it?.params);
  return {
    id,
    name: String(it?.name || id),
    type: it?.type ? String(it.type) : undefined,
    extraTypes: Array.isArray(it?.extraTypes) ? it.extraTypes : undefined,
    cooldown: it?.cooldown ?? null,
    chance: it?.chance ?? null,
    params: Object.keys(params).length ? params : undefined,
  };
}

/**
 * Compact catalog + params for placements (no full item rows).
 * @param {Map<string, object> | undefined} itemsById
 * @param {{ id: string }[]} placements
 */
function catalogIndex(itemsById, placements) {
  if (!itemsById) return [];
  const seen = new Set();
  /** @type {{ id: string, name: string, type?: string }[]} */
  const out = [];
  for (const p of placements || []) {
    if (!p?.id || seen.has(p.id)) continue;
    seen.add(p.id);
    const it = itemsById.get(p.id);
    out.push(catalogRow(p.id, it));
  }
  for (const p of placements || []) {
    for (const gid of p.gems || []) {
      if (!gid || seen.has(gid)) continue;
      seen.add(gid);
      const it = itemsById.get(gid);
      out.push(catalogRow(gid, it));
    }
  }
  return out;
}

function compactEvents(run) {
  return conformSimEvents(run.events).map((e) => ({
    t: e.t,
    combatT: toCombatLogTime(Number(e.t) || 0),
    type: e.type,
    actor: e.actor,
    target: e.target,
    itemId: e.itemId,
    placementKey: e.placementKey,
    amount: e.amount,
    label: e.label,
    category: e.meta?.category || null,
    handler: e.meta?.handler || null,
    stack: e.meta?.stack || null,
    contract: e.meta?.contract || null,
    meta: e.meta || null,
  }));
}

/**
 * One JSON blob to paste in chat for vs-game debugging.
 * @param {import('../sim-events.js').SimRun} run
 * @param {{
 *   title?: string,
 *   slug?: string | null,
 *   round?: number | null,
 *   seed?: number,
 *   permalink?: string,
 *   placements?: { id: string, x: number, y: number, r?: number, key?: string, gems?: string[] }[],
 *   opponentTitle?: string | null,
 *   opponentSlug?: string | null,
 *   opponentRound?: number | null,
 *   opponentPlacements?: { id: string, x: number, y: number, r?: number, key?: string, gems?: string[] }[],
 *   itemsById?: Map<string, object>,
 * }} [meta]
 */
function compactPlacements(list) {
  return (list || []).map((p) => ({
    id: p.id,
    x: p.x,
    y: p.y,
    r: Number(p.r) || 0,
    key: p.key || '',
    gems: Array.isArray(p.gems) ? p.gems.filter(Boolean) : [],
  }));
}

export function buildSimDebugReport(run, meta = {}) {
  const placements = compactPlacements(meta.placements);
  const opponentPlacements = compactPlacements(meta.opponentPlacements);
  const hasOpp = opponentPlacements.length > 0;
  return {
    kind: 'bpb-sim-debug',
    v: 6,
    exportedAt: new Date().toISOString(),
    permalink: meta.permalink || null,
    seed: Number.isFinite(Number(meta.seed))
      ? Number(meta.seed)
      : Number(run.summary?.seed) || null,
    mode: run.mode,
    title: meta.title || null,
    slug: meta.slug || null,
    round: meta.round ?? null,
    opponentTitle: hasOpp ? meta.opponentTitle || null : null,
    opponentSlug: hasOpp ? meta.opponentSlug || null : null,
    opponentRound: hasOpp ? (meta.opponentRound ?? null) : null,
    durationSec: run.durationSec,
    /** In-game combat log clock (0 = items live); equals durationSec − COMBAT_DELAY. */
    combatDurationSec: combatDurationSec(run.durationSec),
    dummyMaxHp: run.dummyMaxHp,
    dummyEndHp: run.dummyEndHp,
    playerMaxHp: run.playerMaxHp,
    playerEndHp: run.playerEndHp,
    coverage: run.coverage || null,
    summary: run.summary || null,
    placements,
    catalog: catalogIndex(meta.itemsById, placements),
    opponentPlacements: hasOpp ? opponentPlacements : [],
    opponentCatalog: hasOpp
      ? catalogIndex(meta.itemsById, opponentPlacements)
      : [],
    paramChecks: findParamMismatches(run, meta.itemsById, placements),
    manaOrb: summarizeManaOrbAudit(run, meta.itemsById, placements),
    unhealingMath: summarizeUnhealingMath(run),
    piecesEnd: lastPieceByKey(run),
    status: summarizeStatusReport(run, meta.itemsById),
    ui: summarizeUiParity(run, meta.itemsById),
    weaponAudits: summarizeChanceWeaponAudits(run, placements),
    eventCount: run.events?.length || 0,
    events: compactEvents(run),
  };
}

/** @deprecated use buildSimDebugReport */
export function simRunToExport(run, meta = {}) {
  return buildSimDebugReport(run, meta);
}

/**
 * @param {object} payload
 * @param {string} [mode]
 */
export function downloadSimReportJson(payload, mode = 'engine') {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `bpb-sim-${mode}-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Download run as JSON file.
 * @param {import('../sim-events.js').SimRun} run
 * @param {Parameters<typeof buildSimDebugReport>[1]} [meta]
 */
export function downloadSimRun(run, meta = {}) {
  downloadSimReportJson(buildSimDebugReport(run, meta), run.mode);
}

/**
 * @param {object} payload
 */
export async function copySimReportJson(payload) {
  const text = JSON.stringify(payload, null, 2);
  await navigator.clipboard.writeText(text);
}
