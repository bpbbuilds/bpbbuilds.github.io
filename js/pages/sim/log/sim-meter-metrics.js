/**
 * DamageMeter metric ids + aggregation (Phase 109).
 * Order matches game DamageMeter.gd metricIndices + getSubMetrics().
 */

import { originName, stackKeyOf } from './sim-log-sentences.js';
import { conformSimEvents } from '../sim-events.js';

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   icon?: string | null,
 *   empty: string,
 * }} MeterMetric
 */

/** @type {MeterMetric[]} */
export const METER_METRICS = [
  { id: 'damage', label: 'Damage Dealt', icon: null, empty: 'No damage dealt' },
  { id: 'heal', label: 'Heal', icon: null, empty: 'No healing' },
  { id: 'stamina', label: 'Stamina', icon: null, empty: 'No stamina events' },
  { id: 'activations', label: 'Activations', icon: null, empty: 'No activations' },
  { id: 'block', label: 'Block', icon: 'Block.png', empty: 'No Block gained' },
  { id: 'lucky', label: 'Luck', icon: 'Lucky.png', empty: 'No Luck gained' },
  { id: 'regeneration', label: 'Regeneration', icon: 'Regeneration.png', empty: 'No Regeneration gained' },
  { id: 'vampirism', label: 'Vampirism', icon: 'Vampirism.png', empty: 'No Vampirism gained' },
  { id: 'spikes', label: 'Spikes', icon: 'Spikes.png', empty: 'No Spikes gained' },
  { id: 'mana', label: 'Mana', icon: 'Mana.png', empty: 'No Mana gained' },
  { id: 'empower', label: 'Empower', icon: 'Empower.png', empty: 'No Empower gained' },
  { id: 'heat', label: 'Heat', icon: 'Heat.png', empty: 'No Heat gained' },
  { id: 'poison', label: 'Poison', icon: 'Poison.png', empty: 'No Poison inflicted' },
  { id: 'blind', label: 'Blind', icon: 'Blind.png', empty: 'No Blind inflicted' },
  { id: 'cold', label: 'Cold', icon: 'Cold.png', empty: 'No Cold inflicted' },
];

/** @param {string} id */
export function metricById(id) {
  return METER_METRICS.find((m) => m.id === id) || METER_METRICS[0];
}

/**
 * @param {MeterSource} source
 * @param {number} t
 */
export function sourceValueAt(source, t) {
  const cutoff = Number(t) || 0;
  let v = 0;
  for (const p of source.points) {
    if (p.t <= cutoff) v = p.cum;
    else break;
  }
  return v;
}

/**
 * @typedef {{
 *   key: string,
 *   name: string,
 *   itemId: string | null,
 *   placementKey: string | null,
 *   total: number,
 *   points: { t: number, cum: number }[],
 * }} MeterSource
 */

/**
 * @typedef {{
 *   id: string,
 *   label: string | null,
 *   sources: MeterSource[],
 * }} MeterSection
 */

/**
 * @param {import('../../sim-events.js').SimEvent} ev
 * @param {'player' | 'dummy'} side
 */
function eventSide(ev, side) {
  if (ev.actor === side) return true;
  if (!ev.actor && side === 'player' && ev.target === 'dummy') return true;
  if (!ev.actor && side === 'dummy' && ev.target === 'player') return true;
  if (
    side === 'player' &&
    (ev.type === 'buff' || ev.type === 'heal' || ev.type === 'stamina') &&
    (ev.target === 'player' || !ev.target)
  ) {
    return ev.actor !== 'dummy';
  }
  if (side === 'player' && ev.type === 'debuff' && ev.target === 'dummy') {
    return true;
  }
  if (side === 'dummy' && ev.type === 'miss' && ev.actor === 'dummy') return true;
  if (
    side === 'dummy' &&
    (ev.type === 'buff' || ev.type === 'heal' || ev.type === 'stamina') &&
    (ev.target === 'dummy' || (!ev.target && ev.actor === 'dummy'))
  ) {
    return true;
  }
  if (side === 'dummy' && ev.type === 'debuff' && ev.target === 'player') {
    return true;
  }
  return false;
}

function isMaxHealthHeal(ev) {
  if (/max\s*hp/i.test(String(ev.label || ''))) return true;
  const h = ev.meta?.handler;
  return h === 'start_max_hp' || h === 'piggybank';
}

/**
 * Heal tab: EventType.Vampirism / Regeneration — never Torch/Broom.
 * @param {import('../../sim-events.js').SimEvent} ev
 * @returns {'Vampirism' | 'Regeneration' | null}
 */
function healSystemName(ev) {
  if (ev.type !== 'heal' && ev.meta?.category !== 'hot' && ev.meta?.category !== 'heal') {
    return null;
  }
  const sys = String(ev.meta?.systemOrigin || '');
  const label = String(ev.label || '');
  if (
    sys === 'Regeneration' ||
    ev.meta?.stack === 'regeneration' ||
    /regeneration/i.test(label)
  ) {
    return 'Regeneration';
  }
  if (sys === 'Vampirism' || /vampirism/i.test(label)) {
    return 'Vampirism';
  }
  return null;
}

function damageSystemName(ev) {
  const sys = String(ev.meta?.systemOrigin || '');
  if (sys === 'Unhealing' || ev.meta?.kind === 'unhealing') return 'Unhealing';
  if (sys === 'Fatigue' || ev.meta?.kind === 'fatigue' || /fatigue/i.test(String(ev.label || ''))) {
    return 'Fatigue';
  }
  if (sys === 'Poison' || ev.meta?.stack === 'poison' || ev.meta?.kind === 'poison') return 'Poison';
  if (sys === 'Spikes' || ev.meta?.spikes) return 'Spikes';
  return null;
}

/**
 * Item rows keyed by placement (game Item instance). Catalog itemId would merge
 * two Piggybanks; Hungry Blade start + conversion share one placementKey.
 * @param {import('../../sim-events.js').SimEvent} ev
 * @param {string} metricId
 * @param {string} side
 * @param {string} sectionId
 */
function meterSourceKey(ev, metricId, side, sectionId) {
  if (metricId === 'heal' && (sectionId === 'heal' || sectionId === 'overheal')) {
    const sys = healSystemName(ev);
    if (sys) return `sys:${sys}`;
  }
  if (metricId === 'damage' && sectionId === 'damage') {
    const sys = damageSystemName(ev);
    if (sys) return `sys:${sys}`;
  }
  if (ev.placementKey) return `place:${ev.placementKey}`;
  if (ev.itemId) return `item:${ev.itemId}`;
  return `misc:${side}:${metricId}:${sectionId}`;
}

function sourceName(ev, metricId, itemsById, sectionId) {
  if (metricId === 'heal' && (sectionId === 'heal' || sectionId === 'overheal')) {
    const sys = healSystemName(ev);
    if (sys) return sys;
  }
  if (metricId === 'damage' && sectionId === 'damage') {
    const sys = damageSystemName(ev);
    if (sys) return sys;
  }
  return originName(ev, itemsById);
}

/**
 * @param {import('../../sim-events.js').SimEvent} ev
 * @param {string} metricId
 * @param {string} sectionId
 * @returns {number}
 */
function contribution(ev, metricId, sectionId) {
  switch (sectionId) {
    case 'damage':
      if (ev.type !== 'damage') return 0;
      if (ev.meta?.kind === 'self_health_cost') return 0;
      return Math.max(0, Number(ev.amount) || 0);
    case 'misses':
      if (ev.type !== 'miss') return 0;
      return 1;
    case 'blocked':
      if (ev.type !== 'damage') return 0;
      return Math.max(0, Number(ev.meta?.blocked) || 0);
    case 'heal':
      if (ev.type !== 'heal' && ev.meta?.category !== 'hot') return 0;
      if (isMaxHealthHeal(ev)) return 0;
      return Math.max(0, Number(ev.meta?.loggedAmount ?? ev.amount) || 0);
    case 'overheal':
      if (ev.type !== 'heal' && ev.meta?.category !== 'hot') return 0;
      if (isMaxHealthHeal(ev)) return 0;
      return Math.max(0, Number(ev.meta?.overheal) || 0);
    case 'maxhealth':
      if (ev.type !== 'heal') return 0;
      if (!isMaxHealthHeal(ev)) return 0;
      return Math.max(0, Number(ev.amount) || 0);
    case 'stamina-used':
      if (ev.type !== 'stamina' || ev.meta?.starved) return 0;
      if (ev.meta?.kind === 'used') return Math.abs(Number(ev.amount) || 0);
      return 0;
    case 'stamina-gained':
      if (ev.type !== 'stamina' || ev.meta?.starved) return 0;
      if (ev.meta?.kind === 'used') return 0;
      return Math.max(0, Number(ev.amount) || 0);
    case 'stamina-removed':
      if (ev.type !== 'stamina' || ev.meta?.starved) return 0;
      if (ev.meta?.kind === 'used') return 0;
      return Number(ev.amount) < 0 ? Math.abs(Number(ev.amount)) : 0;
    case 'activations':
      // Side filter is eventSide() in collectSection — do not drop dummy here
      // or the Opponent Activations tab is always empty.
      if (ev.type !== 'activate') return 0;
      return 1;
    case 'oos':
      if (ev.type !== 'stamina' || !ev.meta?.starved) return 0;
      return 1;
    case 'stack-gained': {
      if (ev.type !== 'buff' && ev.type !== 'debuff') return 0;
      if (stackKeyOf(ev) !== metricId) return 0;
      if (ev.meta?.used) return 0;
      const amt = Number(ev.amount);
      return Number.isFinite(amt) && amt > 0 ? amt : 0;
    }
    case 'stack-removed': {
      if (ev.type !== 'buff' && ev.type !== 'debuff') return 0;
      if (stackKeyOf(ev) !== metricId) return 0;
      if (ev.meta?.used) return 0;
      const amt = Number(ev.amount);
      return Number.isFinite(amt) && amt < 0 ? -amt : 0;
    }
    case 'stack-used': {
      if (ev.type !== 'buff' && ev.type !== 'debuff') return 0;
      if (stackKeyOf(ev) !== metricId) return 0;
      if (!ev.meta?.used) return 0;
      return Math.abs(Number(ev.amount) || 0);
    }
    default:
      return 0;
  }
}

/** @param {string} metricId */
function sectionSpecs(metricId) {
  switch (metricId) {
    case 'damage':
      return [
        { id: 'damage', label: null },
        { id: 'misses', label: 'Missed attacks' },
        { id: 'blocked', label: 'Damage blocked' },
      ];
    case 'heal':
      return [
        { id: 'heal', label: null },
        { id: 'overheal', label: 'Overheal' },
        { id: 'maxhealth', label: 'Maximum health gained' },
      ];
    case 'stamina':
      return [
        { id: 'stamina-used', label: 'Used' },
        { id: 'stamina-gained', label: 'Gained' },
        { id: 'stamina-removed', label: 'Removed' },
      ];
    case 'activations':
      return [
        { id: 'activations', label: null },
        { id: 'oos', label: 'Out of stamina' },
      ];
    default:
      return [
        { id: 'stack-gained', label: 'Gained' },
        { id: 'stack-removed', label: 'Removed' },
        { id: 'stack-used', label: 'Used' },
      ];
  }
}

/**
 * @param {import('../../sim-events.js').SimEvent[]} events
 * @param {Map<string, object> | null | undefined} itemsById
 * @param {string} metricId
 * @param {string} sectionId
 * @param {'player' | 'dummy'} side
 * @returns {MeterSource[]}
 */
function collectSection(events, itemsById, metricId, sectionId, side) {
  /** @type {Map<string, MeterSource>} */
  const map = new Map();
  for (const ev of events) {
    if (!eventSide(ev, side)) continue;
    const amt = contribution(ev, metricId, sectionId);
    if (amt <= 0) continue;
    const key = meterSourceKey(ev, metricId, side, sectionId);
    let src = map.get(key);
    if (!src) {
      const sysHeal =
        metricId === 'heal' && (sectionId === 'heal' || sectionId === 'overheal')
          ? healSystemName(ev)
          : null;
      const sysDmg = metricId === 'damage' && sectionId === 'damage' ? damageSystemName(ev) : null;
      src = {
        key,
        name: sysHeal || sysDmg || sourceName(ev, metricId, itemsById, sectionId),
        itemId: sysHeal || sysDmg ? null : ev.itemId || null,
        placementKey: sysHeal || sysDmg ? null : ev.placementKey || null,
        total: 0,
        points: [{ t: 0, cum: 0 }],
      };
      map.set(key, src);
    }
    src.total += amt;
    src.points.push({ t: ev.t, cum: src.total });
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

/**
 * @param {import('../../sim-events.js').SimEvent[]} events
 * @param {Map<string, object> | null | undefined} itemsById
 * @param {string} metricId
 * @param {'player' | 'dummy'} [side]
 * @returns {MeterSection[]}
 */
export function buildMetricSections(events, itemsById, metricId, side = 'player') {
  const canonical = conformSimEvents(events);
  return sectionSpecs(metricId).map((spec) => ({
    id: spec.id,
    label: spec.label,
    sources: collectSection(canonical, itemsById, metricId, spec.id, side),
  }));
}

/**
 * Primary-section sources (plot + backward compatible list).
 * @param {import('../../sim-events.js').SimEvent[]} events
 * @param {Map<string, object> | null | undefined} itemsById
 * @param {string} metricId
 * @param {'player' | 'dummy'} [side]
 * @returns {MeterSource[]}
 */
export function buildMetricSources(events, itemsById, metricId, side = 'player') {
  const sections = buildMetricSections(events, itemsById, metricId, side);
  return sections[0]?.sources || [];
}

/**
 * @param {MeterSource[]} sources
 * @param {number} durationSec
 */
export function buildCumulativeSeries(sources, durationSec) {
  /** @type {{ t: number, d: number }[]} */
  const deltas = [];
  for (const src of sources) {
    let prev = 0;
    for (const p of src.points) {
      const d = p.cum - prev;
      if (d > 0) deltas.push({ t: p.t, d });
      prev = p.cum;
    }
  }
  deltas.sort((a, b) => a.t - b.t);
  /** @type {{ t: number, cum: number }[]} */
  const series = [{ t: 0, cum: 0 }];
  let cum = 0;
  for (const d of deltas) {
    cum += d.d;
    series.push({ t: d.t, cum });
  }
  const dur = Math.max(0.1, durationSec);
  if (series[series.length - 1].t < dur) {
    series.push({ t: dur, cum });
  }
  return series;
}

/** @deprecated use buildMetricSources('damage') */
export function buildDamageSources(events, itemsById, side = 'player') {
  return buildMetricSources(events, itemsById, 'damage', side);
}
