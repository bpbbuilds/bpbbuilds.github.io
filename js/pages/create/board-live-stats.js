/**
 * Create-board tooltip live stats — inventory-style prepare speed → modified CD.
 *
 * Game: Item.insertParameters replaces $cd with getModifiedCooldown() tinted by
 * isCooldownModified(); weapon Cooldown row uses the same. Speed auras live in
 * board-tip-speed.js (+ assets/data/board-tip-speed-auras.json).
 * Laboratory multi-phase CSV cds show as a Cooldown row + effect tints.
 */

import {
  buildBoardGraph,
  affectedTargets,
} from '../sim/engine/board-graph.js';
import { loadCanAffectData } from '../../shared/backpack-grid/can-affect.js';
import {
  computeSpeedScales,
  getCachedTipSpeedAuras,
  loadTipSpeedAuras,
  warmTipSpeedAuras,
} from './board-tip-speed.js';

/**
 * Full phase lists (primary first). Used when DB `cooldown` is null/0 but the
 * effect text still has baked "After 2s" / "After 4s" lines (Laboratory).
 */
const PHASE_CDS = {
  laboratory: [2, 4, 6, 8, 12],
  hogus_bogus: [3, 6, 9],
  wisp: [3, 5],
  lightning_potion: [4, 7],
};

/** @type {Promise<object> | null} */
let canAffectPromise = null;
/** @type {object | null} */
let canAffectCache = null;

function assetRoot() {
  const raw = typeof document !== 'undefined' ? document.body?.dataset?.root ?? '../' : '../';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function canAffectData() {
  if (!canAffectPromise) {
    canAffectPromise = loadCanAffectData(assetRoot()).then((d) => {
      canAffectCache = d;
      return d;
    });
  }
  return canAffectPromise;
}

/**
 * Game Item.getSpeed() from speedScale only (no heat/cold on create board).
 * @param {number} speedScale
 */
export function speedFromScale(speedScale) {
  const s = Number(speedScale) || 0;
  let modified;
  if (s >= 0) modified = 1 + s;
  else modified = 1 / (1 - s);
  return Math.max(0.1, Math.min(10, modified));
}

/**
 * @param {number} baseCd
 * @param {number} speedScale
 */
export function modifiedCooldown(baseCd, speedScale) {
  const base = Number(baseCd);
  if (!(base > 0) || base >= 500) return base;
  return Math.max(0.35, Math.round((base / speedFromScale(speedScale)) * 100) / 100);
}

/**
 * Catalog primary CD — falls back to PHASE_CDS[0] when DB cooldown is missing.
 * @param {object | null | undefined} item
 */
export function resolveCatalogCooldown(item) {
  if (!item) return 0;
  const n = Number(item.cooldown);
  if (Number.isFinite(n) && n > 0 && n < 500) return n;
  const phases = phaseListForItem(item);
  return phases[0] || 0;
}

/**
 * @param {object | null | undefined} item
 * @returns {number[]}
 */
export function phaseListForItem(item) {
  if (!item) return [];
  const id = String(item.id || '');
  const known = PHASE_CDS[id];
  if (known?.length) return known.slice();

  const base = Number(item.cooldown);
  const extras = extrasForItem(item) || [];
  const phases = [];
  if (Number.isFinite(base) && base > 0 && base < 500) phases.push(base);
  for (const n of extras) {
    if (n > 0 && !phases.includes(n)) phases.push(n);
  }
  return phases;
}

/**
 * Extra phases after the primary (not including primary).
 * @param {object} item
 * @returns {number[] | null}
 */
export function extrasForItem(item) {
  if (!item) return null;
  if (Array.isArray(item.extraCooldowns) && item.extraCooldowns.length) {
    return item.extraCooldowns.map(Number).filter((n) => n > 0);
  }
  const known = PHASE_CDS[String(item.id || '')];
  if (known && known.length > 1) return known.slice(1);
  return null;
}

/**
 * Lab / potions / phases timed with "After Xs:" — times live in effect text only.
 * No top Cooldown prop row (game inventory tip).
 * @param {object | null | undefined} item
 */
export function isAfterBasedItem(item) {
  if (!item) return false;
  const id = String(item.id || '');
  if (PHASE_CDS[id]) return true;
  if (Array.isArray(item.extraCooldowns) && item.extraCooldowns.length) {
    return true;
  }
  const effect = String(item.effect || '');
  const hasAfter =
    /\bAfter\s+[\d.]+s\b/i.test(effect) ||
    /\bAfter\s*\{[^}]+\}\s*[\d.]+s\b/i.test(effect) ||
    /After\s*\$cd/i.test(effect);
  if (!hasAfter) return false;
  const hasEvery =
    /\bEvery\s+[\d.]+s\b/i.test(effect) ||
    /\bEvery\s*\{[^}]+\}\s*[\d.]+s\b/i.test(effect) ||
    /Every\s*\$cd/i.test(effect);
  return !hasEvery;
}

/**
 * Sync compute when canAffect (+ tip auras) are already loaded (tip hover path).
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 * @param {object | null | undefined} canAffect
 * @param {Record<string, object> | null | undefined} [auras]
 * @returns {Map<string, {
 *   speedScale: number,
 *   cooldown: number,
 *   catalogCooldown: number,
 *   extraCooldowns?: number[],
 * }>}
 */
export function computeBoardLiveStatsSync(placements, itemsById, canAffect, auras) {
  /** @type {Map<string, { speedScale: number, cooldown: number, catalogCooldown: number, extraCooldowns?: number[] }>} */
  const out = new Map();
  if (!placements?.length || !itemsById?.size || !canAffect) return out;

  const table = auras || getCachedTipSpeedAuras() || {};
  const scales = computeSpeedScales(placements, itemsById, canAffect, table);

  for (const p of placements) {
    const item = itemsById.get(p.id);
    if (!item || !p.key) continue;
    const phases = phaseListForItem(item);
    const base = resolveCatalogCooldown(item);
    if (!(base > 0) || base >= 500) continue;
    const speedScale = scales.get(p.key) || 0;
    const id = String(item.id || p.id);
    const isLab = id === 'laboratory';
    const extras = phases.length > 1 ? phases.slice(1) : extrasForItem(item);
    // Any modified speed → live tip (green/red $cd parity). Lab / multi-CD always.
    if (!speedScale && !isLab && !extras?.length && phases.length < 2) continue;
    out.set(p.key, {
      speedScale,
      cooldown: modifiedCooldown(base, speedScale),
      catalogCooldown: base,
      extraCooldowns:
        phases.length > 1
          ? phases.map((cd) => modifiedCooldown(cd, speedScale))
          : isLab || extras?.length
            ? normalizeExtra(extras, base, speedScale)
            : undefined,
    });
  }

  return out;
}

/**
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 * @returns {Promise<Map<string, {
 *   speedScale: number,
 *   cooldown: number,
 *   catalogCooldown: number,
 *   extraCooldowns?: number[],
 * }>>}
 */
export async function computeBoardLiveStats(placements, itemsById) {
  if (!placements?.length || !itemsById?.size) return new Map();
  const [canAffect, auras] = await Promise.all([canAffectData(), loadTipSpeedAuras()]);
  return computeBoardLiveStatsSync(placements, itemsById, canAffect, auras);
}

/** Cached canAffect for sync tip merges (null until first await). */
export function getCachedCanAffect() {
  return canAffectCache;
}

/** Warm canAffect + tip-speed aura table (call once on create init). */
export function warmBoardLiveCanAffect() {
  return Promise.all([canAffectData(), warmTipSpeedAuras()]);
}

/**
 * @param {unknown} extra
 * @param {number} base
 * @param {number} speedScale
 */
function normalizeExtra(extra, base, speedScale) {
  const list = Array.isArray(extra) ? extra.map(Number).filter((n) => n > 0) : [];
  const all = [base, ...list];
  return all.map((cd) => modifiedCooldown(cd, speedScale));
}

/**
 * Game Item.countTypes on canAffect links — Rainbow Orb / Prismatic Sword $n_* counters.
 * @param {object} catalogItem
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 * @param {object | null | undefined} canAffect
 * @param {string} placementKey
 * @returns {Record<string, number> | null}
 */
export function computePlacementCounters(
  catalogItem,
  placements,
  itemsById,
  canAffect,
  placementKey,
) {
  if (!catalogItem || !placementKey || !canAffect || !placements?.length) return null;
  const effect = String(catalogItem.effect || "");
  /** @type {Set<string>} */
  const keys = new Set();
  for (const m of effect.matchAll(/<N_([a-z][a-z0-9_]*)>/gi)) {
    keys.add(String(m[1]).toLowerCase());
  }
  for (const m of effect.matchAll(/\$n_([a-z][a-z0-9_]*)\b/gi)) {
    keys.add(String(m[1]).toLowerCase());
  }
  // Known counter items even if effect was already scrubbed
  const id = String(catalogItem.id || "");
  if (id === 'rainbow_orb' || id === 'prismatic_sword') {
    for (const k of ['magic', 'vampiric', 'holy', 'dark']) keys.add(k);
  }
  if (!keys.size) return null;

  const graph = buildBoardGraph(placements, itemsById);
  const links = affectedTargets(graph, placementKey, itemsById, canAffect);
  /** @type {Record<string, number>} */
  const counts = {};
  for (const k of keys) counts[k] = 0;

  for (const link of links) {
    const item = itemsById.get(link.id);
    if (!item) continue;
    /** @type {string[]} */
    const types = [];
    if (item.type) types.push(String(item.type));
    if (Array.isArray(item.extraTypes)) {
      for (const t of item.extraTypes) types.push(String(t));
    }
    if (Array.isArray(item.tags)) {
      for (const t of item.tags) types.push(String(t));
    }
    for (const k of keys) {
      if (types.some((t) => t.toLowerCase().includes(k))) counts[k] += 1;
    }
  }
  return counts;
}

/**
 * Merge catalog item with board live CD for ItemTooltip.render.
 * @param {object | null | undefined} catalogItem
 * @param {{ speedScale: number, cooldown: number, catalogCooldown: number, extraCooldowns?: number[] } | null | undefined} live
 * @param {{ placementCounters?: Record<string, number> | null }} [extra]
 */
export function mergeBoardLiveItem(catalogItem, live, extra = {}) {
  if (!catalogItem) return null;
  const counters = extra.placementCounters || null;
  const withCounters = (out) => {
    if (counters) out.placementCounters = counters;
    return out;
  };
  const afterBased = isAfterBasedItem(catalogItem);
  const base = resolveCatalogCooldown(catalogItem);
  const catalogPhases = phaseListForItem(catalogItem);

  if (!live) {
    // After-based (Lab, multi-phase potions): no Cooldown prop row — times stay in effect.
    return withCounters({
      ...catalogItem,
      name: catalogItem.displayName || catalogItem.name,
      // Keep resolved primary for non-After tips that still need a Cooldown row.
      ...(!afterBased && base > 0 && !(Number(catalogItem.cooldown) > 0)
        ? { cooldown: base }
        : {}),
    });
  }

  const baseCd = live.catalogCooldown || base;
  const speedMod = Math.abs(live.speedScale) > 1e-6;
  const out = {
    ...catalogItem,
    name: catalogItem.displayName || catalogItem.name,
    catalogStats: {
      damageMin: Number(catalogItem.damageMin ?? catalogItem.damage_min),
      damageMax: Number(catalogItem.damageMax ?? catalogItem.damage_max),
      cooldown: baseCd,
      staminaCost: Number(catalogItem.staminaCost ?? catalogItem.stamina_cost),
      accuracy: Number(catalogItem.accuracy),
    },
    cooldown: live.cooldown,
    // Weapons / Every-based accessories: show live Cooldown row. After-based: effect only.
    ...(afterBased ? {} : { showCooldownRow: true }),
  };
  const livePhases =
    live.extraCooldowns?.length
      ? live.extraCooldowns
      : catalogPhases.length
        ? catalogPhases.map((cd) => modifiedCooldown(cd, live.speedScale))
        : [live.cooldown];

  if (!afterBased) {
    if (catalogPhases.length) {
      out.extraCooldownsCatalog = catalogPhases;
    }
    if (livePhases.length > 1) {
      out.extraCooldownsLive = livePhases;
    }
  }

  if (catalogPhases.length && speedMod) {
    // Longest token first so "12s" is not partially matched as "2s".
    const pairs = catalogPhases
      .map((b, i) => ({
        base: b,
        live: livePhases[i] ?? modifiedCooldown(b, live.speedScale),
      }))
      .filter((p) => p.live != null && Math.abs(p.live - p.base) > 1e-4)
      .sort((a, b) => String(b.base).length - String(a.base).length);
    let effect = String(out.effect || '');
    for (const pair of pairs) {
      effect = rewriteEffectCooldown(effect, pair.base, pair.live);
    }
    out.effect = effect;
  } else if (Math.abs(live.cooldown - baseCd) > 1e-4) {
    out.effect = rewriteEffectCooldown(String(out.effect || ''), baseCd, live.cooldown);
  }
  return withCounters(out);
}

/**
 * Tint baked "14s" / "Every 14s" / "After 25s" when live CD differs.
 * @param {string} effect
 * @param {number} baseCd
 * @param {number} liveCd
 */
export function rewriteEffectCooldown(effect, baseCd, liveCd) {
  const text = String(effect || '');
  if (!text || !(baseCd > 0)) return text;
  const baseStr = Number.isInteger(baseCd) ? String(baseCd) : String(baseCd);
  const liveStr =
    Number.isInteger(liveCd) || Math.abs(liveCd - Math.round(liveCd)) < 1e-6
      ? String(Math.round(liveCd * 100) / 100)
      : String(Math.round(liveCd * 100) / 100);
  if (baseStr === liveStr) return text;
  const delta = liveCd - baseCd;
  // Shorter CD is better (green); longer is worse (red) — matches isCooldownModified.
  const tint = delta < 0 ? 'green' : 'red';
  const re = new RegExp(
    `(?<![\\d.])${baseStr.replace(/\./g, '\\.')}(\\.\\d+)?s\\b`,
    'g',
  );
  return text.replace(re, `{${tint}}${liveStr}s{/${tint}}`);
}
