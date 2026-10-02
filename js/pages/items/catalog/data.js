/**
 * Items catalog — row mapping, local JSON overlays, filter/url helpers.
 */

import {
  defaultFilterState,
  normalizeItemCategory,
} from '../catalog-filters.js';

export const LIBRARY_COLS = 20;
export const CELL_PX = 34;

export function rootPrefix() {
  const raw = document.body?.dataset?.root ?? './';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/**
 * Shop unidentified amulet uses Energy Amulet art in the DB.
 * Game texture is UnidentifiedAmulet.png.
 * @param {object} row
 */
function catalogImage(row) {
  if (row?.id === 'amulet_unidentified') return 'UnidentifiedAmulet.png';
  return row?.image || null;
}

/**
 * Map DB row → frontend item (snake_case → camelCase).
 * @param {object} row
 * @param {{
 *   classMasksById?: Record<string, number> | null,
 *   mentionedStacksById?: Record<string, string[]> | null,
 *   treasureIds: Set<string>,
 * }} ctx
 */
export function mapItem(row, ctx) {
  const classMasksById = ctx.classMasksById;
  const mentionedStacksById = ctx.mentionedStacksById;
  return {
    id: row.id,
    gid: row.gid ?? null,
    name: row.name,
    rarity: row.rarity || 'Common',
    type: row.type || '',
    class: row.class || 'Neutral',
    extraTypes: Array.isArray(row.extra_types) ? row.extra_types : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    cost: row.cost,
    effect: row.effect || '',
    image: catalogImage(row),
    shape: row.shape ?? [[1]],
    sockets: row.sockets ?? null,
    accuracy: row.accuracy ?? null,
    cooldown: row.cooldown ?? null,
    staminaCost: row.stamina_cost ?? null,
    damageMin: row.damage_min ?? null,
    damageMax: row.damage_max ?? null,
    block: row.block ?? null,
    chance: row.chance ?? null,
    chanceTag: row.chance_tag ?? null,
    params: row.params ?? {},
    gameVersion: row.game_version ?? null,
    classMask:
      classMasksById && row.id != null && classMasksById[row.id] != null
        ? classMasksById[row.id]
        : undefined,
    mentionedStacks: mentionedStacksById
      ? mentionedStacksById[row.id] || []
      : undefined,
    isTreasure: ctx.treasureIds.has(row.id),
  };
}

/**
 * @param {object[]} items
 * @param {Map<string, number>} libraryOrderIndex
 * @param {Record<string, object> | null} spriteDisplayByImage
 */
export function applySpriteDisplay(items, libraryOrderIndex, spriteDisplayByImage) {
  for (const item of items) {
    if (libraryOrderIndex.has(item.id)) {
      item.libraryIndex = libraryOrderIndex.get(item.id);
    }
  }
  if (!spriteDisplayByImage) return;
  for (const item of items) {
    const meta = item.image ? spriteDisplayByImage[item.image] : null;
    if (!meta) continue;
    item.spriteW = meta.w;
    item.spriteH = meta.h;
    if (meta.texW != null) item.texW = meta.texW;
    if (meta.texH != null) item.texH = meta.texH;
    if (Array.isArray(meta.iconScale)) item.iconScale = meta.iconScale;
    const ax = Number(meta.anchorX) || 0;
    const ay = Number(meta.anchorY) || 0;
    if (Math.abs(ax) <= 0.25 && Math.abs(ay) <= 0.25) {
      if (ax) item.spriteAnchorX = ax;
      if (ay) item.spriteAnchorY = ay;
    }
  }
}

/**
 * @param {object[]} items
 * @param {{ byImage?: Record<string, { x: number, y: number }[]>, byId?: Record<string, { x: number, y: number }[]> } | null} socketOffsetsData
 */
export function applySocketOffsets(items, socketOffsetsData) {
  if (!socketOffsetsData) return;
  const byImage = socketOffsetsData.byImage || {};
  const byId = socketOffsetsData.byId || {};
  for (const item of items) {
    const offs = (item.image && byImage[item.image]) || byId[item.id] || null;
    if (Array.isArray(offs) && offs.length) {
      item.socketOffsets = offs;
      item.sockets = offs.length;
    }
  }
}

/**
 * @param {object[]} items
 * @param {{ byImage?: Record<string, number[][]>, byId?: Record<string, number[][]> } | null} itemShapesData
 */
export function applyShapes(items, itemShapesData) {
  if (!itemShapesData) return;
  const byImage = itemShapesData.byImage || {};
  const byId = itemShapesData.byId || {};
  for (const item of items) {
    const shape = byId[item.id] || (item.image && byImage[item.image]) || null;
    if (Array.isArray(shape) && shape.length) {
      item.shape = shape;
    }
  }
}

/**
 * @param {ReturnType<typeof defaultFilterState>} filterState
 */
export function filtersActive(filterState) {
  const d = defaultFilterState();
  if (filterState.q.trim()) return true;
  if (filterState.grouping !== 'none') return true;
  if (filterState.category) return true;
  for (const c of Object.keys(d.classes)) {
    if (filterState.classes[c] !== d.classes[c]) return true;
  }
  for (const r of Object.keys(d.rarities)) {
    if (filterState.rarities[r] !== d.rarities[r]) return true;
  }
  if (filterState.classItems !== d.classItems || filterState.treasure !== d.treasure) {
    return true;
  }
  if (
    filterState.shop !== d.shop ||
    filterState.crafted !== d.crafted ||
    filterState.gated !== d.gated
  ) {
    return true;
  }
  for (const t of Object.keys(d.types)) {
    if (filterState.types[t]) return true;
  }
  for (const s of Object.keys(d.stacks)) {
    if (filterState.stacks[s]) return true;
  }
  return false;
}

/** @param {ReturnType<typeof defaultFilterState>} filterState */
export function applyCategoryFromUrl(filterState) {
  try {
    const raw = new URLSearchParams(window.location.search).get('category');
    filterState.category = normalizeItemCategory(raw);
  } catch {
    filterState.category = null;
  }
}

export function clearCategoryFromUrl() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('category')) return;
    url.searchParams.delete('category');
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, '', next);
  } catch {
    /* ignore */
  }
}

/**
 * @param {object[]} items
 * @param {Map<string, number>} libraryOrderIndex
 */
export function sortByLibraryOrder(items, libraryOrderIndex) {
  return items.slice().sort((a, b) => {
    const ia = libraryOrderIndex.has(a.id)
      ? libraryOrderIndex.get(a.id)
      : Number.POSITIVE_INFINITY;
    const ib = libraryOrderIndex.has(b.id)
      ? libraryOrderIndex.get(b.id)
      : Number.POSITIVE_INFINITY;
    if (ia !== ib) return ia - ib;
    return String(a.id).localeCompare(String(b.id));
  });
}
