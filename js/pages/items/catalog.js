/**
 * Items catalog — packed Itemiary grid + tooltips + filters.
 *
 * Default layout uses assets/data/library-layout.json (game Item Library 1:1).
 *
 *   import { initItemsCatalog } from './catalog.js';
 *   initItemsCatalog();
 */

import { getSupabase } from '../../shared/supabase.js';
import { skelBar, skelBlock, skelRegion } from '../../shared/skeleton.js';
import { createTooltipHover } from '../../shared/tooltip-hover.js';
import {
  mountItemiaryGrid,
  shapeForItem,
  packGeom,
} from '../../shared/backpack-grid/index.js';
import {
  defaultFilterState,
  filterItems,
  filtersHtml,
  bindFilters,
  updateFilterMeta,
  sortForGrouping,
  groupSortKey,
  normalizeItemCategory,
} from './catalog-filters.js';
import { createSpotlight } from './spotlight.js';
import {
  buildRecipeIndex,
  createSpotlightRecipes,
} from './spotlight-recipes.js';
import { createSpotlightBuilds } from './spotlight-builds.js';

const LIBRARY_COLS = 20;
const CELL_PX = 34;
/** Active Itemiary column count (create page may pass a narrower grid). */
let catalogCols = LIBRARY_COLS;
/** When false, cells stay CELL_PX and the bag width shrinks with column count. */
let catalogFillWidth = true;

/** @type {Map<string, object>} */
let itemById = new Map();
/** @type {object[]} */
let allItems = [];
/** @type {object[]} */
let filteredOrder = [];
/** @type {{ destroy: () => void, hide?: () => void, lock?: Function, unlock?: Function, host?: HTMLElement } | null} */
let tipLayer = null;
/** @type {(() => void) | null} */
let unbindTips = null;
/** @type {(() => void) | null} */
let unbindFilters = null;
/** @type {(() => void) | null} */
let unbindSpotlightClick = null;
/** @type {(() => void) | null} */
let unbindItemPointer = null;
/** @type {ReturnType<typeof createSpotlight> | null} */
let spotlight = null;
/** @type {ReturnType<typeof createSpotlightRecipes> | null} */
let spotlightRecipes = null;
/** @type {ReturnType<typeof createSpotlightBuilds> | null} */
let spotlightBuilds = null;
/** @type {import('./spotlight-recipes.js').RecipeIndex | null} */
let recipeIndex = null;
/** @type {ReturnType<typeof mountItemiaryGrid> | null} */
let itemiaryGrid = null;
/** @type {number} */
let paintRaf = 0;
/** @type {boolean} */
let paintPending = false;
/** @type {number} */
let prewarmHandle = 0;
/** @type {string} */
let assetRoot = './';
/** @type {{ order: { id: string, index: number, x: number, y: number }[], placements: { id: string, x: number, y: number }[], cols: number, rows: number, count: number } | null} */
let libraryLayout = null;
/** @type {Map<string, number>} */
let libraryOrderIndex = new Map();
/** @type {Record<string, { w: number, h: number }> | null} */
let spriteDisplayByImage = null;
/** @type {{ byImage?: Record<string, { x: number, y: number }[]>, byId?: Record<string, { x: number, y: number }[]> } | null} */
let socketOffsetsData = null;
/** @type {{ byImage?: Record<string, number[][]>, byId?: Record<string, number[][]> } | null} */
let itemShapesData = null;
/** @type {Set<string>} */
let craftedIds = new Set();
/** @type {Set<string>} */
let gatedIds = new Set();
/** @type {Set<string>} */
let shopItemIds = new Set();
/** @type {Set<string>} */
let treasureIds = new Set();
/** @type {Record<string, number> | null} */
let classMasksById = null;
/** @type {Record<string, string[]> | null} */
let mentionedStacksById = null;

let filterState = defaultFilterState();
/** Bumps when init/teardown races a layout preview paint. */
let catalogGen = 0;
/** True after the first real (sprite) paint — preview must not overwrite. */
let realGridReady = false;

function rootPrefix() {
  const raw = document.body?.dataset?.root ?? './';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/**
 * Map DB row → frontend item (snake_case → camelCase).
 * @param {object} row
 */
function mapItem(row) {
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
    image: row.image || null,
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
    // When the game map loaded: always set an array ([] = no DESCR stack tokens).
    // Undefined only if the JSON failed to load (legacy tag fallback in filter-logic).
    mentionedStacks: mentionedStacksById
      ? mentionedStacksById[row.id] || []
      : undefined,
    isTreasure: treasureIds.has(row.id),
  };
}

function spriteUrl(item) {
  if (!item.image) return '';
  return `${assetRoot}assets/item-sprites/${item.image}`;
}

/**
 * Attach game Icon.scale display size (cells) from sprite-display.json.
 * Applied to every item — this is what the game catalog uses (not type privileges).
 * @param {object[]} items
 */
function applySpriteDisplay(items) {
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
    // Small Icon.position / CollisionMap nudges (e.g. Pan +0.09 down).
    // Skip large map offsets — those shoved spears by multiple cells.
    const ax = Number(meta.anchorX) || 0;
    const ay = Number(meta.anchorY) || 0;
    if (Math.abs(ax) <= 0.25 && Math.abs(ay) <= 0.25) {
      if (ax) item.spriteAnchorX = ax;
      if (ay) item.spriteAnchorY = ay;
    }
  }
}

/**
 * Attach GemSocket positions (cells from body AABB center) from socket-offsets.json.
 * @param {object[]} items
 */
function applySocketOffsets(items) {
  if (!socketOffsetsData) return;
  const byImage = socketOffsetsData.byImage || {};
  const byId = socketOffsetsData.byId || {};
  for (const item of items) {
    const offs =
      (item.image && byImage[item.image]) ||
      byId[item.id] ||
      null;
    if (Array.isArray(offs) && offs.length) {
      item.socketOffsets = offs;
      item.sockets = offs.length;
    }
  }
}

/**
 * Prefer extracted CollisionMap matrices (diamonds + special affect tiles).
 * @param {object[]} items
 */
function applyShapes(items) {
  if (!itemShapesData) return;
  const byImage = itemShapesData.byImage || {};
  const byId = itemShapesData.byId || {};
  for (const item of items) {
    const shape =
      byId[item.id] ||
      (item.image && byImage[item.image]) ||
      null;
    if (Array.isArray(shape) && shape.length) {
      item.shape = shape;
    }
  }
}

function filtersActive() {
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
  if (filterState.shop !== d.shop || filterState.crafted !== d.crafted || filterState.gated !== d.gated) {
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

/** Read `?category=` from the URL into filter state. */
function applyCategoryFromUrl() {
  try {
    const raw = new URLSearchParams(window.location.search).get('category');
    filterState.category = normalizeItemCategory(raw);
  } catch {
    filterState.category = null;
  }
}

/** Drop `category` from the address bar after reset. */
function clearCategoryFromUrl() {
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
 */
function sortByLibraryOrder(items) {
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

/** Parchment shimmer rail matching real filter sections (shared bpb-skel). */
function filtersSkeletonHtml() {
  const orb = () =>
    skelBlock({ className: 'il-filter-skel__orb', width: '2.4rem', height: '2.4rem', radius: '50%' });
  const type = () =>
    skelBlock({ className: 'il-filter-skel__type', width: '2.1rem', height: '2.1rem', radius: '0.3rem' });
  const check = (w = '7.5rem') =>
    `<span class="il-filter-skel__check">${skelBlock({
      className: 'il-filter-skel__box',
      width: '1.35rem',
      height: '1.35rem',
      radius: '0.2rem',
    })}${skelBar({ width: w, height: '0.95rem', radius: '0.2rem' })}</span>`;
  const stack = () =>
    skelBlock({ className: 'il-filter-skel__stack', width: '1.85rem', height: '1.85rem', radius: '0.25rem' });

  return `
    <aside class="items-filters il-filter items-filters--skel" aria-hidden="true">
      <div class="il-filter__head il-filter-skel__head">
        ${skelBar({ className: 'il-filter-skel__count', width: '9.5rem', height: '1.15rem', radius: '0.2rem' })}
        ${skelBlock({ className: 'il-filter-skel__reset', width: '2rem', height: '2rem', radius: '50%' })}
      </div>
      <div class="il-filter__shade il-filter-skel__group">
        ${skelBar({ width: '100%', height: '1.6rem', radius: '0.25rem' })}
      </div>
      <div class="il-filter__shade il-filter-skel__classes">${Array.from({ length: 8 }, orb).join('')}</div>
      <div class="il-filter__shade il-filter-skel__rarities">
        <div class="il-filter__rarity-col">${check('6.2rem')}${check('5.2rem')}${check('5.5rem')}</div>
        <div class="il-filter__rarity-col">${check('7rem')}${check('5.5rem')}${check('6.8rem')}${check('5rem')}</div>
      </div>
      <div class="il-filter__shade il-filter-skel__types">${Array.from({ length: 11 }, type).join('')}</div>
      <div class="il-filter__lower">
        <div class="il-filter__shade il-filter-skel__conditions">${check('7.2rem')}${check('7.8rem')}${check('6.8rem')}</div>
        <div class="il-filter__shade il-filter-skel__buffs">${Array.from({ length: 8 }, stack).join('')}</div>
      </div>
      <div class="il-filter__search-row">
        <div class="il-filter__shade il-filter-skel__search">
          ${skelBar({ width: '100%', height: '1.5rem', radius: '0.25rem' })}
        </div>
        <div class="il-filter__shade il-filter-skel__debuffs">${Array.from({ length: 3 }, stack).join('')}</div>
      </div>
    </aside>`;
}

/** Real bag stage + filter placeholder — layout preview paints into the stage. */
function loadingShellHtml() {
  return skelRegion(
    `<div class="items-shell">
      <div class="items-layout">
        <div class="items-bag">
          <div class="items-bag__stage" data-items-grid></div>
        </div>
        ${filtersSkeletonHtml()}
      </div>
    </div>`,
    { className: 'items-skel-wrap', label: 'Loading item catalog' },
  );
}

/**
 * Footprint-only stubs from local library-layout + shapes (no sprites / no Supabase).
 * @param {object} layout
 * @param {object | null} shapesData
 */
function buildLayoutPreview(layout, shapesData) {
  const byId = shapesData?.byId || {};
  const order = Array.isArray(layout?.order) ? layout.order : [];
  const placements = Array.isArray(layout?.placements) ? layout.placements : [];
  /** @type {Map<string, object>} */
  const itemsById = new Map();

  for (const o of order) {
    if (!o?.id || itemsById.has(o.id)) continue;
    itemsById.set(o.id, {
      id: o.id,
      name: o.name || o.id,
      rarity: 'Common',
      // Not "Bag" so every stub gets a rarity footprint for the preview wave
      type: 'Accessory',
      shape: byId[o.id] || [[1]],
      libraryIndex: o.index ?? 0,
      image: null,
    });
  }
  for (const p of placements) {
    if (!p?.id || itemsById.has(p.id)) continue;
    itemsById.set(p.id, {
      id: p.id,
      name: p.id,
      rarity: 'Common',
      type: 'Accessory',
      shape: byId[p.id] || [[1]],
      libraryIndex: 0,
      image: null,
    });
  }

  const placed = placements.length
    ? placements.filter((p) => itemsById.has(p.id))
    : order
        .filter((o) => o?.id && itemsById.has(o.id))
        .map((o) => ({ id: o.id, x: o.x ?? 0, y: o.y ?? 0 }));

  return {
    itemsById,
    placements: placed,
    rows: layout?.rows || 1,
  };
}

/**
 * @param {Element} host
 * @param {object} layout
 * @param {object | null} shapesData
 */
function paintLayoutPreview(host, layout, shapesData) {
  if (realGridReady) return;
  const stage = host.querySelector('[data-items-grid]');
  if (!(stage instanceof HTMLElement)) return;
  const preview = buildLayoutPreview(layout, shapesData);
  if (!preview.placements.length) return;
  const grid = ensureItemiary(stage);
  void grid.showPlaced(preview.placements, preview.itemsById, preview.rows, {
    preview: true,
    appear: true,
    appearLayer: 'under',
  });
}

/**
 * Promote loading shell → live shell without wiping the bag stage (CLS).
 * @param {Element} host
 * @param {number} shown
 */
function promoteLoadingShell(host, shown) {
  const bag = host.querySelector('.items-bag');
  if (bag instanceof HTMLElement && !bag.querySelector('[data-items-empty]')) {
    const empty = document.createElement('p');
    empty.className = 'items-bag__empty';
    empty.dataset.itemsEmpty = '';
    empty.hidden = true;
    empty.textContent = 'No items match these filters.';
    bag.appendChild(empty);
  }

  const filters = host.querySelector('.items-filters');
  if (filters) {
    const hold = document.createElement('div');
    hold.innerHTML = filtersHtml(assetRoot, filterState, shown).trim();
    const next = hold.firstElementChild;
    if (next) filters.replaceWith(next);
  }

  const skelWrap = host.querySelector(':scope > .bpb-skel-region, :scope > .items-skel-wrap');
  if (skelWrap instanceof HTMLElement) {
    const shell = skelWrap.querySelector(':scope > .items-shell');
    if (shell) skelWrap.replaceWith(shell);
    else {
      skelWrap.removeAttribute('aria-busy');
      skelWrap.removeAttribute('role');
      skelWrap.removeAttribute('aria-label');
      skelWrap.classList.remove('items-skel-wrap', 'bpb-skel-region');
    }
  }
}

function teardown() {
  if (unbindFilters) {
    unbindFilters();
    unbindFilters = null;
  }
  if (unbindSpotlightClick) {
    unbindSpotlightClick();
    unbindSpotlightClick = null;
  }
  if (unbindItemPointer) {
    unbindItemPointer();
    unbindItemPointer = null;
  }
  if (spotlight) {
    spotlight.destroy();
    spotlight = null;
  }
  if (unbindTips) {
    unbindTips();
    unbindTips = null;
  }
  if (tipLayer) {
    tipLayer.destroy();
    tipLayer = null;
  }
  if (paintRaf) {
    cancelAnimationFrame(paintRaf);
    paintRaf = 0;
  }
  paintPending = false;
  if (prewarmHandle) {
    if (typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(prewarmHandle);
    } else {
      clearTimeout(prewarmHandle);
    }
    prewarmHandle = 0;
  }
  if (itemiaryGrid) {
    itemiaryGrid.destroy();
    itemiaryGrid = null;
  }
  catalogGen += 1;
  realGridReady = false;
  itemById = new Map();
  allItems = [];
  filteredOrder = [];
  craftedIds = new Set();
  gatedIds = new Set();
  shopItemIds = new Set();
  treasureIds = new Set();
  classMasksById = null;
  mentionedStacksById = null;
  filterState = defaultFilterState();
}

/**
 * @param {Element} host
 * @param {object[]} items
 */
function wireTooltips(host, items) {
  if (unbindTips) {
    unbindTips();
    unbindTips = null;
  }
  if (tipLayer) {
    tipLayer.destroy();
    tipLayer = null;
  }
  itemById = new Map(items.map((item) => [item.id, item]));
  tipLayer = createTooltipHover();
  unbindTips = tipLayer.bind(host, {
    selector: '.bpb-bg__item[data-item-id]:not(.bpb-bg__item--parked)',
    getItem: (el) => itemById.get(el.dataset.itemId),
    // Game Item Library pins tooltip X over the right panel
    place: 'overFilters',
    filtersSelector: '.items-filters',
  });
}

/**
 * Click → spotlight (game Item Library).
 * @param {Element} host
 */
function wireSpotlight(host) {
  if (unbindSpotlightClick) {
    unbindSpotlightClick();
    unbindSpotlightClick = null;
  }
  if (spotlight) {
    spotlight.destroy();
    spotlight = null;
  }
  if (spotlightRecipes) {
    spotlightRecipes.destroy();
    spotlightRecipes = null;
  }
  if (spotlightBuilds) {
    spotlightBuilds.destroy();
    spotlightBuilds = null;
  }

  spotlightRecipes = createSpotlightRecipes({
    assetRoot,
    getItemById: (id) => itemById.get(id),
    getSpriteUrl: spriteUrl,
    onPickItem(id) {
      if (!itemById.has(id)) return;
      const el = host.querySelector(
        `.bpb-bg__item[data-item-id="${CSS.escape(id)}"]:not(.bpb-bg__item--parked)`,
      );
      spotlight?.open(id, el instanceof Element ? el : null);
    },
  });
  if (recipeIndex) spotlightRecipes.setIndex(recipeIndex);

  spotlightBuilds = createSpotlightBuilds({
    assetRoot,
    getShapes: () => itemShapesData,
    getSockets: () => socketOffsetsData,
    getSpriteDisplay: () => spriteDisplayByImage,
  });

  spotlight = createSpotlight({
    host,
    getTip: () => tipLayer,
    getSpriteUrl: spriteUrl,
    getItemById: (id) => itemById.get(id),
    getFilteredOrder: () => filteredOrder,
    recipes: spotlightRecipes,
    builds: spotlightBuilds,
  });

  const onClick = (e) => {
    if (!(e.target instanceof Element)) return;
    if (spotlight?.isOpen()) return;
    const hit = e.target.closest('.bpb-bg__item[data-item-id]:not(.bpb-bg__item--parked)');
    if (!hit || !host.contains(hit)) return;
    const id = hit.getAttribute('data-item-id');
    if (!id || !itemById.has(id)) return;
    e.preventDefault();
    tipLayer?.hide?.();
    spotlight?.open(id, hit);
  };

  host.addEventListener('click', onClick);
  unbindSpotlightClick = () => {
    host.removeEventListener('click', onClick);
  };
}

/**
 * Optional pointer-down on catalog items (e.g. create-page drag onto board).
 * @param {Element} host
 * @param {((itemId: string, e: PointerEvent) => void) | null} handler
 */
function wireItemPointerDown(host, handler) {
  if (unbindItemPointer) {
    unbindItemPointer();
    unbindItemPointer = null;
  }
  if (!handler) return;

  /** @param {PointerEvent} e */
  const onDown = (e) => {
    if (e.button !== 0) return;
    if (!(e.target instanceof Element)) return;
    const hit = e.target.closest(
      '.bpb-bg__item[data-item-id]:not(.bpb-bg__item--parked)',
    );
    if (!hit || !host.contains(hit)) return;
    const id = hit.getAttribute('data-item-id');
    if (!id || !itemById.has(id)) return;
    e.preventDefault();
    tipLayer?.hide?.();
    handler(id, e);
  };

  host.addEventListener('pointerdown', onDown);
  unbindItemPointer = () => {
    host.removeEventListener('pointerdown', onDown);
  };
}

/**
 * Filter clicks: update count sync (with toggle chrome), pack/move next frame
 * so the browser can paint the pressed filter before heavy grid work.
 * Bursts coalesce to one grid paint.
 * @param {Element} host
 */
function schedulePaintGrid(host) {
  // Cheap sync — count tracks the click; toggle UI already updated in bindFilters.
  const meta = { craftedIds, gatedIds, shopItemIds, treasureIds };
  updateFilterMeta(host, filterItems(allItems, filterState, meta).length);

  paintPending = true;
  if (paintRaf) return;
  paintRaf = requestAnimationFrame(() => {
    paintRaf = 0;
    paintPending = false;
    void paintGrid(host, { appear: true });
  });
}

/**
 * @param {Element} stage
 */
function ensureItemiary(stage) {
  if (itemiaryGrid) return itemiaryGrid;
  itemiaryGrid = mountItemiaryGrid(stage, {
    getSpriteUrl: spriteUrl,
    cellPx: CELL_PX,
    cols: catalogCols,
    fillWidth: catalogFillWidth,
  });
  return itemiaryGrid;
}

/**
 * Idle prewarm: pool DOM + shape/pack geom only (sprites stay data-src until warm/IO).
 */
function schedulePrewarm() {
  if (prewarmHandle) return;
  const run = () => {
    prewarmHandle = 0;
    if (!itemiaryGrid) return;
    itemiaryGrid.ensurePool(allItems);
    for (const item of allItems) {
      shapeForItem(item);
      packGeom(item);
    }
  };
  if (typeof requestIdleCallback === 'function') {
    prewarmHandle = requestIdleCallback(run, { timeout: 2000 });
  } else {
    prewarmHandle = window.setTimeout(run, 1);
  }
}

/**
 * @param {Element} host
 * @param {{ appear?: boolean }} [opts]
 * @returns {Promise<void>}
 */
async function paintGrid(host, opts = {}) {
  // Filter change invalidates spotlight order
  if (spotlight?.isOpen()) spotlight.close({ immediate: true });

  const appear = opts.appear === true;
  const meta = { craftedIds, gatedIds, shopItemIds, treasureIds };
  let filtered = filterItems(allItems, filterState, meta);
  const grouping = filterState.grouping || 'none';
  if (grouping === 'none') filtered = sortByLibraryOrder(filtered);
  else filtered = sortForGrouping(filtered, grouping, meta);
  filteredOrder = filtered;

  const stage = host.querySelector('[data-items-grid]');
  const empty = host.querySelector('[data-items-empty]');
  if (!stage) return;

  // Count first — cheap, makes the toggle feel live before the grid finishes.
  updateFilterMeta(host, filtered.length);
  tipLayer?.hide?.();

  const grid = ensureItemiary(stage);
  realGridReady = true;

  if (!filtered.length) {
    await grid.parkAll();
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;

  const itemsById = new Map(filtered.map((i) => [i.id, i]));
  const useExact =
    grouping === 'none' &&
    libraryLayout &&
    !filtersActive() &&
    libraryLayout.placements?.length &&
    catalogCols === (libraryLayout.cols || LIBRARY_COLS);

  if (useExact) {
    const idSet = new Set(filtered.map((i) => i.id));
    const placements = libraryLayout.placements.filter((p) => idSet.has(p.id));
    await grid.showPlaced(placements, itemsById, libraryLayout.rows, { appear });
  } else {
    await grid.showPacked(filtered, {
      compact: true,
      appear,
      // Game addLineBreak: new group starts below prior band (no hole-filling across groups)
      groupKey:
        grouping !== 'none' ? (item) => groupSortKey(item, grouping) : undefined,
    });
  }
}

/**
 * @param {string | Element} [selector='#items-catalog']
 * @param {{
 *   enableSpotlight?: boolean,
 *   onItemPointerDown?: (itemId: string, e: PointerEvent) => void,
 *   cols?: number,
 *   fillWidth?: boolean,
 * }} [opts]
 * @returns {Promise<{
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   allItems: object[],
 * } | null>}
 */
export async function initItemsCatalog(selector = '#items-catalog', opts = {}) {
  const host = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!host) return null;

  const enableSpotlight = opts.enableSpotlight !== false;
  /** @type {((itemId: string, e: PointerEvent) => void) | null} */
  const itemPointerHandler = opts.onItemPointerDown || null;
  const colsOpt = Number(opts.cols);
  const nextCols =
    Number.isFinite(colsOpt) && colsOpt > 0 ? Math.floor(colsOpt) : LIBRARY_COLS;

  assetRoot = rootPrefix();
  teardown();
  catalogCols = nextCols;
  // Narrower pickers keep the same cell size (don't stretch to fill).
  catalogFillWidth =
    opts.fillWidth === true
      ? true
      : opts.fillWidth === false
        ? false
        : nextCols === LIBRARY_COLS;
  filterState = defaultFilterState();
  applyCategoryFromUrl();
  realGridReady = false;
  const gen = ++catalogGen;
  host.innerHTML = loadingShellHtml();

  const fetchJson = (path) =>
    fetch(`${assetRoot}${path}`).then((r) => (r.ok ? r.json() : null));

  const layoutP = fetchJson('assets/data/library-layout.json');
  const shapesP = fetchJson('assets/data/item-shapes.json');

  // Footprint preview as soon as local layout+shapes are ready (wave on cells)
  void Promise.all([layoutP, shapesP]).then(([layoutRes, shapesRes]) => {
    if (gen !== catalogGen || realGridReady || !layoutRes) return;
    if (catalogCols !== LIBRARY_COLS) return;
    libraryLayout = layoutRes;
    libraryOrderIndex = new Map(
      (libraryLayout?.order || []).map((o) => [o.id, o.index]),
    );
    itemShapesData = shapesRes;
    paintLayoutPreview(host, layoutRes, shapesRes);
  });

  try {
    const supabase = getSupabase();
    const [
      itemsRes,
      combosRes,
      layoutRes,
      spriteDisplayRes,
      socketOffsetsRes,
      shapesRes,
      originsRes,
      classMasksRes,
      mentionedStacksRes,
    ] = await Promise.all([
      supabase
        .from('items')
        .select(
          // shape comes from item-shapes.json (applyShapes) — skip heavy DB column
          'id, gid, name, rarity, type, class, extra_types, tags, cost, effect, image, sockets, accuracy, cooldown, stamina_cost, damage_min, damage_max, block, chance, chance_tag, params, game_version',
        )
        .order('gid', { ascending: true, nullsFirst: false }),
      supabase.from('combinations').select(`
        id,
        result_item_id,
        ingredients:combination_ingredients (
          item_id,
          quantity,
          sort_order
        )
      `),
      layoutP,
      fetchJson('assets/data/sprite-display.json'),
      fetchJson('assets/data/socket-offsets.json'),
      shapesP,
      fetchJson('assets/data/item-origins.json'),
      fetchJson('assets/data/item-class-masks.json'),
      fetchJson('assets/data/item-mentioned-stacks.json'),
    ]);

    if (gen !== catalogGen) return null;
    if (itemsRes.error) throw itemsRes.error;

    libraryLayout = layoutRes;
    libraryOrderIndex = new Map(
      (libraryLayout?.order || []).map((o) => [o.id, o.index]),
    );
    spriteDisplayByImage = spriteDisplayRes?.byImage || null;
    socketOffsetsData = socketOffsetsRes;
    itemShapesData = shapesRes;

    const comboRows =
      !(combosRes && combosRes.error) && Array.isArray(combosRes?.data)
        ? combosRes.data
        : [];
    craftedIds = new Set(
      comboRows.map((r) => r.result_item_id).filter(Boolean),
    );
    recipeIndex = buildRecipeIndex(comboRows);
    if (spotlightRecipes) spotlightRecipes.setIndex(recipeIndex);
    gatedIds = new Set(
      Array.isArray(originsRes?.gated) ? originsRes.gated.filter(Boolean) : [],
    );
    shopItemIds = new Set(
      Array.isArray(originsRes?.shopItem) ? originsRes.shopItem.filter(Boolean) : [],
    );
    treasureIds = new Set(
      Array.isArray(originsRes?.treasure) ? originsRes.treasure.filter(Boolean) : [],
    );
    classMasksById =
      classMasksRes?.byId && typeof classMasksRes.byId === 'object'
        ? classMasksRes.byId
        : null;
    mentionedStacksById =
      mentionedStacksRes?.byId && typeof mentionedStacksRes.byId === 'object'
        ? mentionedStacksRes.byId
        : null;

    allItems = sortByLibraryOrder((itemsRes.data ?? []).map(mapItem));
    applyShapes(allItems);
    applySpriteDisplay(allItems);
    applySocketOffsets(allItems);
    if (!allItems.length) {
      host.innerHTML = `<div class="items-shell"><p class="items-status">No items in the database yet. Run <code>node scripts/import-items.mjs</code>.</p></div>`;
      return null;
    }

    const filtered = filterItems(allItems, filterState, {
      craftedIds,
      gatedIds,
      shopItemIds,
      treasureIds,
    });

    // Drop preview grid so real sprites aren't stuck on empty pool nodes
    if (itemiaryGrid) {
      itemiaryGrid.destroy();
      itemiaryGrid = null;
    }

    // Keep bag stage geometry; swap filter skel → real OptionsFont rail.
    promoteLoadingShell(host, filtered.length);

    // Bind filters before sprite warm — warm must never leave the rail dead.
    unbindFilters = bindFilters(host, {
      state: filterState,
      assetRoot,
      searchDebounceMs: 40,
      onChange: () => schedulePaintGrid(host),
      onReset: () => clearCategoryFromUrl(),
    });

    // First real paint: no appear wave; warm near-viewport sprites before reveal.
    await paintGrid(host, { appear: false });
    if (gen !== catalogGen) return null;
    wireTooltips(host, allItems);
    if (enableSpotlight) wireSpotlight(host);
    wireItemPointerDown(host, itemPointerHandler);
    schedulePrewarm();

    return {
      itemsById: itemById,
      getSpriteUrl: spriteUrl,
      allItems,
    };
  } catch (err) {
    if (gen !== catalogGen) return null;
    console.error(err);
    host.innerHTML = `<div class="items-shell"><p class="items-status">Could not load items.</p></div>`;
    return null;
  }
}
