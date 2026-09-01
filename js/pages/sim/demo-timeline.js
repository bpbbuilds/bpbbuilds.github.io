/**
 * Demo fight timeline — catalog cooldown / damage only. Not game combat.
 */

import {
  SIM_DURATION_SEC,
  DEMO_DUMMY_MAX_HP,
  compareSimEvents,
} from './sim-events.js';
import { makeRng, randInt } from './engine/rng.js';

/**
 * @param {{
 *   placements: { id: string, key: string }[],
 *   itemsById: Map<string, object>,
 *   durationSec?: number,
 *   dummyMaxHp?: number,
 *   seed?: number,
 * }} opts
 * @returns {import('./sim-events.js').SimRun}
 */
export function buildDemoTimeline(opts) {
  const durationSec = opts.durationSec ?? SIM_DURATION_SEC;
  const dummyMaxHp = opts.dummyMaxHp ?? DEMO_DUMMY_MAX_HP;
  const rng = makeRng(opts.seed ?? 0xb0bd2026);
  /** @type {import('./sim-events.js').SimEvent[]} */
  const events = [];

  events.push({
    t: 0,
    type: 'fight_start',
    label: 'Demo fight start',
  });

  let dummyHp = dummyMaxHp;
  const weapons = [];

  for (const p of opts.placements || []) {
    const item = opts.itemsById.get(p.id);
    if (!item) continue;
    const cd = Number(item.cooldown);
    if (!Number.isFinite(cd) || cd <= 0) continue;
    const dMin = Number(item.damageMin);
    const dMax = Number(item.damageMax);
    const hasDamage = Number.isFinite(dMin) || Number.isFinite(dMax);
    weapons.push({
      placementKey: p.key,
      itemId: item.id,
      name: String(item.name || item.id),
      cooldown: Math.max(0.35, cd),
      damageMin: Number.isFinite(dMin) ? dMin : hasDamage ? dMax : 8,
      damageMax: Number.isFinite(dMax) ? dMax : hasDamage ? dMin : 14,
      accuracy: Number.isFinite(Number(item.accuracy))
        ? Number(item.accuracy)
        : 90,
    });
  }

  if (!weapons.length) {
    events.push({
      t: 0.1,
      type: 'info',
      label: 'No cooldown weapons on board — empty demo log',
    });
    events.push({
      t: durationSec,
      type: 'fight_end',
      label: 'Demo fight end',
      meta: { dummyHp, dummyMaxHp },
    });
    events.sort(compareSimEvents);
    return {
      mode: 'demo',
      durationSec,
      dummyMaxHp,
      dummyEndHp: dummyHp,
      events,
    };
  }

  for (const w of weapons) {
    let t = w.cooldown;
    while (t <= durationSec + 0.001 && dummyHp > 0) {
      events.push({
        t,
        type: 'activate',
        actor: 'player',
        itemId: w.itemId,
        placementKey: w.placementKey,
        label: w.name,
      });

      const hit = rng() * 100 < w.accuracy;
      if (!hit) {
        events.push({
          t: t + 0.02,
          type: 'miss',
          actor: 'player',
          target: 'dummy',
          itemId: w.itemId,
          placementKey: w.placementKey,
          label: `${w.name} missed`,
        });
      } else {
        const dmg = randInt(w.damageMin, w.damageMax, rng);
        dummyHp = Math.max(0, dummyHp - dmg);
        events.push({
          t: t + 0.02,
          type: 'damage',
          actor: 'player',
          target: 'dummy',
          itemId: w.itemId,
          placementKey: w.placementKey,
          amount: dmg,
          label: `${w.name} hit for ${dmg}`,
          meta: { dummyHp },
        });
      }

      if (dummyHp <= 0) break;
      t += w.cooldown;
    }
  }

  const endT =
    dummyHp <= 0
      ? Math.min(
          durationSec,
          Math.max(...events.map((e) => e.t), 0.5) + 0.15,
        )
      : durationSec;

  events.push({
    t: endT,
    type: 'fight_end',
    label: dummyHp <= 0 ? 'Dummy defeated (demo)' : 'Demo time cap',
    meta: { dummyHp, dummyMaxHp },
  });

  events.sort(compareSimEvents);
  return {
    mode: 'demo',
    durationSec: endT,
    dummyMaxHp,
    dummyEndHp: dummyHp,
    events,
  };
}
