/**
 * Create-board tip speed scales — mirrors Item.onPrepare addSpeed/reduceSpeed
 * (inventory tip parity) plus common onCombatStart neighbor auras so placed
 * builds show green/red modified CDs before Play.
 *
 * Game: Item.getModifiedCooldown = cd / getSpeed(); insertParameters colors
 * $cd via isCooldownModified (faster → positive/green).
 */

import {
  buildBoardGraph,
  affectedTargets,
  getItemsInside,
} from '../sim/engine/board-graph.js';
import { itemKind, isBagLike } from '../sim/engine/item-kind.js';

/** @type {Promise<Record<string, object>> | null} */
let aurasPromise = null;
/** @type {Record<string, object> | null} */
let aurasCache = null;

function assetRoot() {
  const raw =
    typeof document !== 'undefined' ? document.body?.dataset?.root ?? '../' : '../';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/**
 * @returns {Promise<Record<string, object>>}
 */
export function loadTipSpeedAuras() {
  if (!aurasPromise) {
    aurasPromise = fetch(`${assetRoot()}assets/data/board-tip-speed-auras.json`)
      .then((r) => (r.ok ? r.json() : { auras: {} }))
      .then((d) => {
        aurasCache = d?.auras && typeof d.auras === 'object' ? d.auras : {};
        return aurasCache;
      })
      .catch(() => {
        aurasCache = {};
        return aurasCache;
      });
  }
  return aurasPromise;
}

export function getCachedTipSpeedAuras() {
  return aurasCache;
}

export function warmTipSpeedAuras() {
  return loadTipSpeedAuras();
}

/**
 * @param {object} item
 * @param {string | null | undefined} name
 * @param {number} fallback
 */
function paramPct(item, name, fallback) {
  const p = item?.params && typeof item.params === 'object' ? item.params : {};
  const key = name || 'speed';
  const n = Number(p[key] ?? p.p1 ?? fallback);
  return (Number.isFinite(n) ? n : fallback) / 100;
}

/**
 * @param {object | null | undefined} item
 */
function hasCombatCd(item) {
  const cd = Number(item?.cooldown);
  return Number.isFinite(cd) && cd > 0 && cd < 500;
}

/**
 * @param {object | null | undefined} item
 * @param {string} needle
 */
function hasType(item, needle) {
  if (!item || !needle) return false;
  const n = needle.toLowerCase();
  if (String(item.type || '').toLowerCase().includes(n)) return true;
  for (const list of [item.extraTypes, item.tags]) {
    if (Array.isArray(list) && list.some((t) => String(t).toLowerCase().includes(n))) {
      return true;
    }
  }
  return false;
}

/**
 * @param {object | null | undefined} item
 */
function isWeaponItem(item) {
  if (!item) return false;
  if (hasType(item, 'weapon')) return true;
  return itemKind(item) === 'weapon';
}

/**
 * @param {object | null | undefined} item
 */
function isEmpowerable(item) {
  if (!item || isBagLike(item)) return false;
  const dMin = Number(item.damageMin ?? item.damage_min);
  const dMax = Number(item.damageMax ?? item.damage_max);
  return (
    (Number.isFinite(dMin) && dMin > 0) ||
    (Number.isFinite(dMax) && dMax > 0) ||
    isWeaponItem(item)
  );
}

/**
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 * @param {object} canAffect
 * @param {Record<string, object> | null | undefined} auras
 * @returns {Map<string, number>}
 */
export function computeSpeedScales(placements, itemsById, canAffect, auras) {
  /** @type {Map<string, number>} */
  const scales = new Map();
  const bump = (key, delta) => {
    if (!key || !delta) return;
    scales.set(key, (scales.get(key) || 0) + delta);
  };

  if (!placements?.length || !itemsById?.size || !canAffect) return scales;

  const graph = buildBoardGraph(placements, itemsById);
  const table = auras && typeof auras === 'object' ? auras : {};

  for (const p of placements || []) {
    const item = itemsById.get(p.id);
    if (!item || !p.key) continue;
    const id = String(item.id || p.id);
    const entry = table[id];
    if (!entry?.modes?.length) continue;

    const links = () => affectedTargets(graph, p.key, itemsById, canAffect);
    const cargoKeys = () => getItemsInside(graph, p.key);

    for (const mode of entry.modes) {
      const sign = Number(mode.sign) >= 0 ? 1 : -1;
      const per = paramPct(item, mode.param, Number(mode.fallback) || 10) * sign;
      if (!per) continue;

      switch (mode.mode) {
        case 'self_per_links': {
          const n = links().length;
          if (n) bump(p.key, per * n);
          break;
        }
        case 'self_per_type': {
          const type = String(mode.type || '').toLowerCase();
          let n = 0;
          for (const link of links()) {
            const other = itemsById.get(link.id);
            if (other && hasType(other, type)) n += 1;
          }
          if (n) bump(p.key, per * n);
          break;
        }
        case 'links': {
          for (const link of links()) bump(link.key, per);
          break;
        }
        case 'first_link': {
          const first = links()[0];
          if (first) bump(first.key, per);
          break;
        }
        case 'cargo': {
          for (const key of cargoKeys()) {
            const piece = graph.pieces.get(key);
            const cat = piece ? itemsById.get(piece.id) : null;
            if (!cat || isBagLike(cat)) continue;
            if (mode.requireCooldown && !hasCombatCd(cat)) continue;
            if (mode.requireEmpowerable && !isEmpowerable(cat)) continue;
            bump(key, per);
          }
          break;
        }
        case 'all_weapons': {
          for (const q of placements) {
            if (!q.key) continue;
            const cat = itemsById.get(q.id);
            if (cat && isWeaponItem(cat) && hasCombatCd(cat)) bump(q.key, per);
          }
          break;
        }
        case 'all_weapons_stamina': {
          /** @type {string[]} */
          const keys = [];
          for (const q of placements) {
            if (!q.key) continue;
            const cat = itemsById.get(q.id);
            if (!cat || !isWeaponItem(cat)) continue;
            const stam = Number(cat.staminaCost ?? cat.stamina_cost);
            if (stam > 0) keys.push(q.key);
          }
          const need = Number(mode.needExactly) || 2;
          if (keys.length === need) {
            for (const key of keys) bump(key, per);
          }
          break;
        }
        case 'inventory_type': {
          const type = String(mode.type || '').toLowerCase();
          for (const q of placements) {
            if (!q.key) continue;
            const cat = itemsById.get(q.id);
            if (cat && hasType(cat, type) && hasCombatCd(cat)) bump(q.key, per);
          }
          break;
        }
        case 'links_armor_cd': {
          for (const link of links()) {
            const cat = itemsById.get(link.id);
            if (!cat) continue;
            // Shielded.gd: shields get chance; armor+CD gets speed
            if (hasType(cat, 'armor') && hasCombatCd(cat) && !hasType(cat, 'shield')) {
              bump(link.key, per);
            }
          }
          break;
        }
        case 'food_self_per_links':
          // Handled in Food pass below
          break;
        case 'links_empty_secondary':
        case 'inventory_loop':
        case 'unknown':
        default:
          break;
      }
    }
  }

  // Food.gd prepare: +10% speed per canAffect link on the food itself
  for (const p of placements || []) {
    const item = itemsById.get(p.id);
    if (!item || !p.key || !hasCombatCd(item)) continue;
    if (!hasType(item, 'food')) continue;
    // Skip if a dedicated aura already covers this id
    if (table[String(item.id || p.id)]) continue;
    const n = affectedTargets(graph, p.key, itemsById, canAffect).length;
    if (n) bump(p.key, 0.1 * n);
  }

  return scales;
}
