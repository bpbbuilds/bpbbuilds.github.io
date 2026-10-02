/**
 * Load item catalog assets for the create page (Supabase + local JSON).
 */

import { getSupabase } from '../../shared/supabase.js';
import {
  mapItem,
  makeSpriteUrl,
  applyShapes,
  applySocketOffsets,
} from '../build/map-item.js';

const ITEM_SELECT =
  'id, gid, name, rarity, type, class, extra_types, tags, cost, effect, image, shape, sockets, accuracy, cooldown, stamina_cost, damage_min, damage_max, block, chance, chance_tag, params';

/**
 * @param {string} path
 * @param {number} [ms]
 */
async function fetchJson(path, ms = 15000) {
  try {
    const res = await fetch(path, { signal: AbortSignal.timeout(ms) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * @param {string} root
 * @returns {Promise<{
 *   items: object[],
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   filterMeta: {
 *     craftedIds: Set<string>,
 *     gatedIds: Set<string>,
 *     shopItemIds: Set<string>,
 *     treasureIds: Set<string>,
 *   },
 * }>}
 */
export async function loadCreateCatalog(root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const load = (path) => fetchJson(`${base}${path}`);

  const [
    shapesData,
    spriteDisplay,
    socketOffsets,
    origins,
    classMasks,
    mentionedStacks,
    extraCds,
    combinationsRes,
    itemsRes,
  ] = await Promise.all([
    load('assets/data/item-shapes.json'),
    load('assets/data/sprite-display.json'),
    load('assets/data/socket-offsets.json'),
    load('assets/data/item-origins.json'),
    load('assets/data/item-class-masks.json'),
    load('assets/data/item-mentioned-stacks.json'),
    load('assets/data/item-extra-cooldowns.json'),
    getSupabase().from('combinations').select('result_item_id'),
    getSupabase().from('items').select(ITEM_SELECT),
  ]);

  if (itemsRes.error) throw itemsRes.error;

  const classMasksById = classMasks?.byId || null;
  const mentionedStacksById = mentionedStacks?.byId || null;
  const extraCdsById =
    extraCds?.byId && typeof extraCds.byId === 'object' ? extraCds.byId : null;

  const craftedIds = new Set(
    (combinationsRes.data || [])
      .map((r) => r.result_item_id)
      .filter(Boolean)
      .map(String),
  );

  const gatedIds = new Set(
    Array.isArray(origins?.gated) ? origins.gated.filter(Boolean).map(String) : [],
  );
  const shopItemIds = new Set(
    Array.isArray(origins?.shopItem) ? origins.shopItem.filter(Boolean).map(String) : [],
  );
  const treasureIds = new Set(
    Array.isArray(origins?.treasure) ? origins.treasure.filter(Boolean).map(String) : [],
  );

  /** @type {object[]} */
  const items = (itemsRes.data || []).map((row) => {
    const item = mapItem(row);
    if (classMasksById && classMasksById[item.id] != null) {
      item.classMask = classMasksById[item.id];
    }
    if (mentionedStacksById) {
      item.mentionedStacks = mentionedStacksById[item.id] || [];
    }
    if (
      (!item.extraCooldowns || !item.extraCooldowns.length) &&
      extraCdsById &&
      Array.isArray(extraCdsById[item.id])
    ) {
      item.extraCooldowns = extraCdsById[item.id]
        .map(Number)
        .filter((n) => n > 0);
    }
    // Laboratory etc.: DB sometimes stores null primary CD while effect has phases.
    if (!(Number(item.cooldown) > 0) && item.id === 'laboratory') {
      item.cooldown = 2;
      if (!item.extraCooldowns?.length) item.extraCooldowns = [4, 6, 8, 12];
    }
    item.isTreasure = treasureIds.has(item.id);
    return item;
  });

  applyShapes(items, shapesData);
  applySocketOffsets(items, socketOffsets);

  const getSpriteUrl = makeSpriteUrl(base, spriteDisplay);
  for (const item of items) getSpriteUrl(item);

  const itemsById = new Map(items.map((i) => [i.id, i]));

  return {
    items,
    itemsById,
    getSpriteUrl,
    filterMeta: { craftedIds, gatedIds, shopItemIds, treasureIds },
  };
}

/**
 * Round skill candidates.
 * @param {object[]} items
 */
export function skillItems(items) {
  return items
    .filter((i) => String(i.type || '') === 'Skill')
    .slice()
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}
