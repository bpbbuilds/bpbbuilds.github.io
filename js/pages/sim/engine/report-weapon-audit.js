/**
 * Chance-weapon activation audit (Torch etc.) for debug reports.
 */

import { COMBAT_DELAY, toCombatLogTime } from '../sim-combat-time.js';
import { pieceSnapAt } from '../shell/sim-live-item.js';
import { pieceSpeed } from './piece-stats.js';

/**
 * @param {object} piece
 * @param {object} ctx
 */
export function pushActivationAudit(piece, ctx) {
  if (!piece || !ctx) return;
  if (!piece._activationAudit) piece._activationAudit = [];
  const stacks = ctx.player?.stacks || {};
  const heat = Number(stacks.heat) || 0;
  const cold = Number(stacks.cold) || 0;
  piece._activationAudit.push({
    t: Number(ctx.t) || 0,
    combatT: toCombatLogTime(Number(ctx.t) || 0),
    stamina: Number(ctx.player?.stamina),
    maxStamina: Number(ctx.player?.maxStamina),
    heat,
    cold,
    speedScale: Number(piece.speedScale) || 0,
    pieceSpeed: pieceSpeed(piece, stacks),
    critChance: Number(piece.critChance) || 0,
    bonusDamage: Number(piece.bonusDamage) || 0,
    chanceRolls: Number(piece.chanceRolls) || 0,
    chanceProcs: Number(piece.chanceProcs) || 0,
    loopCd: Number(piece.cooldown) || 0,
  });
}

/**
 * @param {import('../pieces.js').CombatPiece[] | undefined} pieces
 */
export function collectPieceActivationAudits(pieces) {
  /** @type {Record<string, object>} */
  const byKey = {};
  for (const p of pieces || []) {
    if (!p?._activationAudit?.length) continue;
    byKey[p.placementKey] = {
      itemId: p.itemId,
      name: p.name,
      activations: p._activationAudit.slice(),
      chanceRolls: Number(p.chanceRolls) || 0,
      chanceProcs: Number(p.chanceProcs) || 0,
      bonusDamage: Number(p.bonusDamage) || 0,
      critChance: Number(p.critChance) || 0,
    };
  }
  return byKey;
}

/**
 * Merge live activation probes with damage/miss/grow events for one placement.
 * @param {import('../../sim-events.js').SimRun} run
 * @param {string} placementKey
 * @param {object} [probe]
 */
function auditOneKey(run, placementKey, probe) {
  const events = run.events || [];
  const activates = events.filter(
    (e) =>
      e.type === 'activate' &&
      e.placementKey === placementKey &&
      !(e.meta?.combatStart && e.meta?.handler === 'torch'),
  );
  /** @type {object[]} */
  const swings = [];
  for (const act of activates) {
    const t = Number(act.t) || 0;
    const near = events.filter(
      (e) =>
        e.placementKey === placementKey &&
        Math.abs((Number(e.t) || 0) - t) < 0.05,
    );
    const dmg = near.find((e) => e.type === 'damage');
    const miss = near.find((e) => e.type === 'miss');
    const grow = near.find(
      (e) =>
        e.type === 'buff' &&
        (e.meta?.handler === 'torch' || /\bdamage\b/i.test(String(e.label || ''))),
    );
    const starved = near.find((e) => e.type === 'stamina' && e.meta?.starved);
    const snap = pieceSnapAt(run.pieceSnapshots, t, placementKey);
    const probeHit =
      (probe?.activations || []).find(
        (a) => Math.abs((Number(a.t) || 0) - t) < 0.02,
      ) || null;
    swings.push({
      t,
      combatT: toCombatLogTime(t),
      outcome: starved
        ? 'starved'
        : miss
          ? 'miss'
          : dmg
            ? dmg.meta?.critical
              ? 'crit'
              : 'hit'
            : 'unknown',
      amount: dmg ? Number(dmg.amount) : null,
      critical: !!(dmg && dmg.meta?.critical),
      grew: !!grow,
      growAmount: grow ? Number(grow.amount) || 0 : 0,
      critChance: probeHit?.critChance ?? snap?.critChance ?? null,
      bonusDamage: probeHit?.bonusDamage ?? snap?.bonusDamage ?? null,
      stamina: probeHit?.stamina ?? null,
      heat: probeHit?.heat ?? null,
      cold: probeHit?.cold ?? null,
      speedScale: probeHit?.speedScale ?? snap?.speedScale ?? null,
      pieceSpeed: probeHit?.pieceSpeed ?? null,
      chanceRolls: probeHit?.chanceRolls ?? snap?.chanceRolls ?? null,
      chanceProcs: probeHit?.chanceProcs ?? snap?.chanceProcs ?? null,
    });
  }

  const last = swings.length ? swings[swings.length - 1] : null;
  const combatEnd = toCombatLogTime(Number(run.durationSec) || 0);
  const lastCombatT = last ? Number(last.combatT) : null;
  const rate =
    lastCombatT != null && lastCombatT > 0
      ? swings.length / lastCombatT
      : null;

  return {
    placementKey,
    itemId: probe?.itemId || activates[0]?.itemId || null,
    name: probe?.name || null,
    activationCount: swings.length,
    hits: swings.filter((s) => s.outcome === 'hit' || s.outcome === 'crit').length,
    misses: swings.filter((s) => s.outcome === 'miss').length,
    crits: swings.filter((s) => s.outcome === 'crit').length,
    grows: swings.filter((s) => s.grew).length,
    starved: swings.filter((s) => s.outcome === 'starved').length,
    lastCombatT,
    combatDurationSec: combatEnd,
    activationsPerCombatSec: rate != null ? Math.round(rate * 1000) / 1000 : null,
    endBonusDamage: probe?.bonusDamage ?? null,
    endCritChance: probe?.critChance ?? null,
    chanceRolls: probe?.chanceRolls ?? null,
    chanceProcs: probe?.chanceProcs ?? null,
    swings,
  };
}

/**
 * Torch (and other probed weapons) activation timelines for Debug.
 * @param {import('../../sim-events.js').SimRun} run
 * @param {{ id: string, key?: string }[]} [placements]
 */
export function summarizeChanceWeaponAudits(run, placements = []) {
  const probes = run.activationAudits || {};
  /** @type {Set<string>} */
  const keys = new Set(Object.keys(probes));
  for (const p of placements || []) {
    if (p?.id === 'torch' && p.key) keys.add(p.key);
  }
  for (const e of run.events || []) {
    if (e.itemId === 'torch' && e.placementKey) keys.add(String(e.placementKey));
  }

  /** @type {object[]} */
  const audits = [];
  for (const key of keys) {
    audits.push(auditOneKey(run, key, probes[key]));
  }
  return {
    combatDelay: COMBAT_DELAY,
    note:
      'Same ?seed= replays the sim only — not Godot Util.rng. Compare activation rate (acts/s) vs live; longer fights add acts without a CD bug.',
    weapons: audits,
  };
}
