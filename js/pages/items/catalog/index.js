/**
 * Items catalog — packed Itemiary grid + tooltips + filters.
 *
 * Default layout uses assets/data/library-layout.json (game Item Library 1:1).
 *
 *   import { initItemsCatalog } from './catalog.js';
 *   initItemsCatalog();
 */

import { getSupabase } from '../../../shared/supabase.js';
import { createTooltipHover } from '../../../shared/tooltip-hover.js';
import {
  mountItemiaryGrid,
  shapeForItem,
  packGeom,
} from '../../../shared/backpack-grid/index.js';
import {
  defaultFilterState,
  filterItems,
  bindFilters,
  updateFilterMeta,
  sortForGrouping,
  groupSortKey,
} from '../catalog-filters.js';
import { createSpotlight } from '../spotlight.js';
import {
  buildRecipeIndex,
  createSpotlightRecipes,
} from '../spotlight-recipes.js';
import { createSpotlightBuilds } from '../spotlight-builds.js';
import { bindFilterDrawer } from '../../../shared/filter-drawer.js';
import { loadLiveArt, liveArtSpec } from '../../../shared/item-live-art/index.js';
import {
  LIBRARY_COLS,
  CELL_PX,
  rootPrefix,
  mapItem,
  applySpriteDisplay,
  applySocketOffsets,
  applyShapes,
  filtersActive,
  applyCategoryFromUrl,
  clearCategoryFromUrl,
  sortByLibraryOrder,
} from './data.js';
import { loadingShellHtml, paintLayoutPreview, promoteLoadingShell } from './shell.js';

/** Active Itemiary column count (create page may pass a narrower grid). */
let catalogCols = LIBRARY_COLS;
/** When false, cells stay CELL_PX and the bag width shrinks with column count. */
let catalogFillWidth = true;
/** Create's narrow horizontal strip uses rarity order; standalone Items does not. */
let createMobileRarityOrder = false;
/** `column` on the narrow Create strip: rarity runs left to right. */
let catalogPackFlow = /** @type {'row' | 'column'} */ ('row');
/** Column-flow strip height in cells. */
let catalogPackRows = 4;

const RARITY_ORDER = new Map([
  ['common', 0],
  ['rare', 1],
  ['epic', 2],
  ['legendary', 3],
  ['godly', 4],
  ['unique', 5],
]);

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
let unbindFilterDrawer = null;
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
/** @type {import('../spotlight-recipes.js').RecipeIndex | null} */
let recipeIndex = null;
/** @type {ReturnType<typeof mountItemiaryGrid> | null} */
let itemiaryGrid = null;
/** @type {Element | null} */
let catalogHost = null;
/** @type {number} */
let paintRaf = 0;
/** @type {number} */
let colsRaf = 0;
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
/** Sprite filenames that have a generated WebP thumb (assets/data/sprite-thumbs.json). */
let thumbImages = new Set();
/** Thumb set for this device — 2x only above ~1.5 DPR (both sets are committed). */
const thumbSet = (window.devicePixelRatio || 1) > 1.5 ? '2x' : '1x';

let filterState = defaultFilterState();
/** Bumps when init/teardown races a layout preview paint. */
let catalogGen = 0;
/** True after the first real (sprite) paint — preview must not overwrite. */
let realGridReady = false;

function spriteUrl(item) {
  if (!item.image) return '';
  return `${assetRoot}assets/item-sprites/${item.image}`;
}

/**
 * Itemiary-only sprite URL — footprint-sized WebP so scroll decode stays cheap.
 * Falls back to the source PNG for live-art items (glow/liquid plates measure
 * naturalWidth against Godot-space offsets) and any image without a thumb.
 * @param {object} item
 */
function thumbUrl(item) {
  if (!item.image) return '';
  if (liveArtSpec(item.id)) return spriteUrl(item);
  if (!thumbImages.has(item.image)) return spriteUrl(item);
  return `${assetRoot}assets/item-thumbs/${thumbSet}/${item.image.replace(/\.png$/i, '.webp')}`;
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
  if (unbindFilterDrawer) {
    unbindFilterDrawer();
    unbindFilterDrawer = null;
  }
  if (tipLayer) {
    tipLayer.destroy();
    tipLayer = null;
  }
  if (paintRaf) {
    cancelAnimationFrame(paintRaf);
    paintRaf = 0;
  }
  if (colsRaf) {
    cancelAnimationFrame(colsRaf);
    colsRaf = 0;
  }
  catalogHost = null;
  createMobileRarityOrder = false;
  catalogPackFlow = 'row';
  catalogPackRows = 4;
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
  thumbImages = new Set();
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
    async onPickItem(id) {
      if (!itemById.has(id)) return;
      let el = host.querySelector(
        `.bpb-bg__item[data-item-id="${CSS.escape(id)}"]:not(.bpb-bg__item--parked)`,
      );
      if (!(el instanceof Element) && itemiaryGrid?.scrollToId) {
        el = await itemiaryGrid.scrollToId(id);
      }
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
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen' && e.button !== 0) return;
    if (!(e.target instanceof Element)) return;
    const hit = e.target.closest(
      '.bpb-bg__item[data-item-id]:not(.bpb-bg__item--parked)',
    );
    if (!hit || !host.contains(hit)) return;
    const id = hit.getAttribute('data-item-id');
    if (!id || !itemById.has(id)) return;
    // Touch stays a catalog pan until the create page decides it is a drag.
    if (e.pointerType !== 'touch') e.preventDefault();
    tipLayer?.hide?.();
    handler(id, e);
  };

  host.addEventListener('pointerdown', onDown);
  unbindItemPointer = () => {
    host.removeEventListener('pointerdown', onDown);
  };
}

/**
 * @param {Element} host
 */
/**
 * Repack the live catalog into `n` columns. Used by the create page so item
 * cells stay readable as the bag narrows. No-ops when the count is unchanged.
 * @param {number} n
 * @returns {boolean}
 */
function scheduleColsPaint() {
  if (!catalogHost || !itemiaryGrid) return;
  if (colsRaf) return;
  colsRaf = requestAnimationFrame(() => {
    colsRaf = 0;
    if (catalogHost) void paintGrid(catalogHost, { appear: false });
  });
}

/**
 * Keep the narrow Create strip readable while scrolling horizontally.
 * Items are ordered common → unique, then packed down each column and on to the right.
 * @param {object[]} items
 * @returns {object[]}
 */
function sortCreateMobileRarity(items) {
  return items.slice().sort((a, b) => {
    const ar =
      RARITY_ORDER.get(String(a?.rarity || '').trim().toLowerCase()) ?? 99;
    const br =
      RARITY_ORDER.get(String(b?.rarity || '').trim().toLowerCase()) ?? 99;
    if (ar !== br) return ar - br;

    const ai = libraryOrderIndex.has(a.id)
      ? libraryOrderIndex.get(a.id)
      : Number.POSITIVE_INFINITY;
    const bi = libraryOrderIndex.has(b.id)
      ? libraryOrderIndex.get(b.id)
      : Number.POSITIVE_INFINITY;
    if (ai !== bi) return ai - bi;
    return String(a.id).localeCompare(String(b.id));
  });
}

export function setCatalogCols(n) {
  const next = Math.max(1, Math.floor(Number(n) || 1));
  const flowChanged = catalogPackFlow !== 'row';
  catalogPackFlow = 'row';
  if (flowChanged) itemiaryGrid?.setPackFlow?.('row', 0);
  if (next === catalogCols) {
    if (flowChanged) scheduleColsPaint();
    return flowChanged;
  }
  catalogCols = next;
  itemiaryGrid?.setCols?.(next);
  scheduleColsPaint();
  return true;
}

/**
 * Narrow Create catalog: pack down this many rows, then continue to the right.
 * @param {number} n
 * @returns {boolean}
 */
export function setCatalogStripRows(n) {
  const next = Math.max(2, Math.floor(Number(n) || 2));
  if (catalogPackFlow === 'column' && catalogPackRows === next) return false;
  catalogPackFlow = 'column';
  catalogPackRows = next;
  itemiaryGrid?.setPackFlow?.('column', next);
  scheduleColsPaint();
  return true;
}

/**
 * Wide create catalog: cells stay a fixed size and the bag scrolls sideways.
 * @param {boolean} on
 * @returns {boolean}
 */
export function setCatalogFillWidth(on) {
  const next = on !== false;
  if (next === catalogFillWidth && itemiaryGrid) {
    const changed = itemiaryGrid.setFillWidth?.(next) === true;
    if (changed) scheduleColsPaint();
    return changed;
  }
  catalogFillWidth = next;
  const changed = itemiaryGrid?.setFillWidth?.(next) === true;
  if (changed) scheduleColsPaint();
  return changed || !itemiaryGrid;
}

function schedulePaintGrid(host) {
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
  if (!itemiaryGrid) {
    itemiaryGrid = mountItemiaryGrid(stage, {
      // Grid only — spotlight / create board / export keep full-res spriteUrl.
      getSpriteUrl: thumbUrl,
      cellPx: CELL_PX,
      cols: catalogCols,
      fillWidth: catalogFillWidth,
      // Keep a wider prefetch band for fast trackpad/wheel scrolling; the
      // shared board default remains unchanged for create/build surfaces.
      virtualPadEm: 24,
    });
  }
  itemiaryGrid.setPackFlow?.(
    catalogPackFlow === 'column' ? 'column' : 'row',
    catalogPackRows,
  );
  return itemiaryGrid;
}

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
  if (spotlight?.isOpen()) spotlight.close({ immediate: true });

  const appear = opts.appear === true;
  const meta = { craftedIds, gatedIds, shopItemIds, treasureIds };
  let filtered = filterItems(allItems, filterState, meta);
  const grouping = filterState.grouping || 'none';
  if (grouping === 'none') {
    filtered = sortByLibraryOrder(filtered, libraryOrderIndex);
    if (
      createMobileRarityOrder &&
      window.matchMedia?.('(max-width: 1100px)').matches
    ) {
      filtered = sortCreateMobileRarity(filtered);
    }
  }
  else filtered = sortForGrouping(filtered, grouping, meta);
  filteredOrder = filtered;

  const stage = host.querySelector('[data-items-grid]');
  const empty = host.querySelector('[data-items-empty]');
  if (!stage) return;

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

  const itemsByIdMap = new Map(filtered.map((i) => [i.id, i]));
  const useExact =
    grouping === 'none' &&
    libraryLayout &&
    !filtersActive(filterState) &&
    libraryLayout.placements?.length &&
    catalogCols === (libraryLayout.cols || LIBRARY_COLS);

  if (useExact) {
    const idSet = new Set(filtered.map((i) => i.id));
    const placements = libraryLayout.placements.filter((p) => idSet.has(p.id));
    await grid.showPlaced(placements, itemsByIdMap, libraryLayout.rows, { appear });
  } else {
    await grid.showPacked(filtered, {
      compact: true,
      appear,
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
 *   mobileRarityOrder?: boolean,
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
  catalogHost = host;
  catalogCols = nextCols;
  createMobileRarityOrder = opts.mobileRarityOrder === true;
  if (
    createMobileRarityOrder &&
    window.matchMedia?.('(max-width: 1100px)').matches
  ) {
    catalogPackFlow = 'column';
  }
  catalogFillWidth =
    opts.fillWidth === true
      ? true
      : opts.fillWidth === false
        ? false
        : nextCols === LIBRARY_COLS;
  filterState = defaultFilterState();
  applyCategoryFromUrl(filterState);
  realGridReady = false;
  const gen = ++catalogGen;
  host.innerHTML = loadingShellHtml();

  const fetchJson = (path) =>
    fetch(`${assetRoot}${path}`).then((r) => (r.ok ? r.json() : null));

  const layoutP = fetchJson('assets/data/library-layout.json');
  const shapesP = fetchJson('assets/data/item-shapes.json');

  void Promise.all([layoutP, shapesP]).then(([layoutRes, shapesRes]) => {
    if (gen !== catalogGen || realGridReady || !layoutRes) return;
    if (catalogCols !== LIBRARY_COLS) return;
    libraryLayout = layoutRes;
    libraryOrderIndex = new Map(
      (libraryLayout?.order || []).map((o) => [o.id, o.index]),
    );
    itemShapesData = shapesRes;
    paintLayoutPreview(host, layoutRes, shapesRes, {
      isReady: () => realGridReady,
      ensureGrid: ensureItemiary,
    });
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
      thumbsRes,
    ] = await Promise.all([
      supabase
        .from('items')
        .select(
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
      fetchJson('assets/data/sprite-thumbs.json'),
      loadLiveArt(),
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
    thumbImages = new Set(
      Array.isArray(thumbsRes?.images) ? thumbsRes.images : [],
    );

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

    allItems = sortByLibraryOrder(
      (itemsRes.data ?? []).map((row) =>
        mapItem(row, { classMasksById, mentionedStacksById, treasureIds }),
      ),
      libraryOrderIndex,
    );
    applyShapes(allItems, itemShapesData);
    applySpriteDisplay(allItems, libraryOrderIndex, spriteDisplayByImage);
    applySocketOffsets(allItems, socketOffsetsData);
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

    if (itemiaryGrid) {
      itemiaryGrid.destroy();
      itemiaryGrid = null;
    }

    promoteLoadingShell(host, filtered.length, assetRoot, filterState);

    unbindFilterDrawer = bindFilterDrawer(host.querySelector('.items-layout'));

    unbindFilters = bindFilters(host, {
      state: filterState,
      assetRoot,
      searchDebounceMs: 40,
      onChange: () => schedulePaintGrid(host),
      onReset: () => clearCategoryFromUrl(),
    });

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
