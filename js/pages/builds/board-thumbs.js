/**
 * Mount mini backpack boards into feed post media slots.
 */

import { mountPlacedGrid } from '../../shared/backpack-grid/index.js';
import {
  mapItem,
  makeSpriteUrl,
  applyShapes,
  applySocketOffsets,
} from '../build/map-item.js';
import { bindMoreBuildTips, registerMoreBuildTip } from '../build/more-build-tip.js';

const BOARD_COLS = 9;
const BOARD_ROWS = 7;
/** Card feed preview — large enough to read the layout at a glance. */
const FEED_CELL_PX = 60;
/** Compact feed thumb — matches CSS `--builds-feed-cell: 18px`. */
const FEED_CELL_COMPACT_PX = 18;

/**
 * @param {HTMLElement} listEl
 * @param {{
 *   builds: object[],
 *   root: string,
 *   view?: 'card' | 'compact',
 *   spriteDisplay?: object | null,
 *   shapes?: object | null,
 *   sockets?: object | null,
 * }} opts
 * @returns {() => void}
 */
export function mountFeedBoardThumbs(listEl, opts) {
  if (!(listEl instanceof HTMLElement)) return () => {};

  const root = opts.root.endsWith('/') ? opts.root : `${opts.root}/`;
  const compact =
    opts.view === 'compact' || listEl.classList.contains('builds-feed__list--compact');
  const getSpriteUrl = makeSpriteUrl(root, opts.spriteDisplay || null);
  const bySlug = new Map(
    (opts.builds || []).map((b) => [String(b.slug || ''), b]),
  );
  /** @type {{ destroy?: () => void }[]} */
  const grids = [];
  /** Merged catalog for hover build tips */
  /** @type {Map<string, object>} */
  const tipItemsById = new Map();

  listEl.querySelectorAll('[data-feed-board]').forEach((host) => {
    if (!(host instanceof HTMLElement)) return;
    const slug = host.getAttribute('data-feed-board') || '';
    const build = bySlug.get(slug);
    if (!build) {
      host.classList.add('is-empty');
      return;
    }

    const { placements, itemsById } = placementsForBuild(build, {
      shapes: opts.shapes,
      sockets: opts.sockets,
      getSpriteUrl,
    });

    if (!placements.length) {
      host.classList.add('is-empty');
      host.innerHTML = `<span class="builds-post__board-empty">No board</span>`;
      return;
    }

    for (const [id, item] of itemsById) tipItemsById.set(id, item);

    host.replaceChildren();
    const cellPx = compact
      ? cellPxFromHost(host, FEED_CELL_COMPACT_PX)
      : cellPxFromHost(host, FEED_CELL_PX);
    // Keep CSS board box in sync when we cap cells to the feed column.
    host.style.setProperty('--builds-feed-cell', `${cellPx}px`);
    const grid = mountPlacedGrid(host, {
      placements,
      itemsById,
      cols: BOARD_COLS,
      rows: BOARD_ROWS,
      getSpriteUrl,
      // Fixed cell from CSS `--builds-feed-cell` (incl. breakpoints).
      // fillWidth + padded border-box host oversizes the board and clips sprites.
      fillWidth: false,
      exactBoard: true,
      reserveScrollGap: false,
      cellPx,
      // Same AppearInLibrary wave as build view / items catalog
      appear: true,
    });
    // Overflow / sizing for feed thumbs lives in CSS (.builds-post__board > .bpb-bg).
    // Do not mutate styles here — that restarts the appear wave mid-flight.
    grids.push(grid);

    // Build tips only in compact view (small thumb → larger preview on hover).
    if (compact) {
      const tipEl = host.closest('.builds-post__compact-thumb');
      if (tipEl instanceof HTMLElement) {
        tipEl.setAttribute('data-feed-build-tip', '');
        registerMoreBuildTip(tipEl, build, placements);
      }
    }
  });

  const unbindTip = compact
    ? bindMoreBuildTips(listEl, {
        itemsById: tipItemsById,
        getSpriteUrl,
        root,
        overEl: null,
        thumbSelector: '[data-feed-build-tip]',
      })
    : () => {};

  return () => {
    try {
      unbindTip();
    } catch {
      /* ignore */
    }
    for (const g of grids) g.destroy?.();
    grids.length = 0;
  };
}

/**
 * Read `--builds-feed-cell` from the host so JS matches CSS (incl. breakpoints).
 * Cap to the feed column so a rigid board cannot spill into the filter rail
 * after screen-frame padding shrank #main.
 * @param {HTMLElement} host
 * @param {number} fallback
 */
function cellPxFromHost(host, fallback) {
  const raw = getComputedStyle(host).getPropertyValue('--builds-feed-cell').trim();
  const cssPx = parseFloat(raw);
  const preferred = Number.isFinite(cssPx) && cssPx > 0 ? cssPx : fallback;

  const col = host.closest('.builds-feed-col');
  if (!(col instanceof HTMLElement)) return preferred;

  const colW = col.clientWidth;
  if (colW <= 0) return preferred;

  // Card stage: board + Build Info. Reserve info + gaps inside the post body.
  const stage = host.closest('.builds-post__stage');
  const stacked =
    stage instanceof HTMLElement &&
    getComputedStyle(stage).gridTemplateColumns.split(' ').length <= 1;

  const reserve = stacked ? 48 : 11.5 * 16; /* ~info min + gaps + body pad */
  const avail = colW - reserve;
  if (avail < 9 * 28) return Math.min(preferred, 28);

  const fit = Math.floor(avail / 9);
  if (fit > 0 && fit < preferred) return Math.max(28, fit);
  return preferred;
}

/**
 * @param {object} build
 * @param {{
 *   shapes?: object | null,
 *   sockets?: object | null,
 *   getSpriteUrl: (item: object) => string,
 * }} opts
 */
function placementsForBuild(build, opts) {
  /** @type {Map<string, object>} */
  const itemsById = new Map();
  const placements = [];

  for (const [i, p] of (build.placements || []).entries()) {
    const item = mapItem(p.item);
    if (!item?.id) continue;
    itemsById.set(item.id, item);
    placements.push({
      id: item.id,
      x: Number(p.x) || 0,
      y: Number(p.y) || 0,
      r: Number(p.r) || 0,
      key: String(p.id ?? `${item.id}:${i}:${p.x},${p.y}:${p.r || 0}`),
      gems: Array.isArray(p.gems) ? p.gems : undefined,
    });
  }

  const items = [...itemsById.values()];
  applyShapes(items, opts.shapes || null);
  applySocketOffsets(items, opts.sockets || null);
  for (const item of items) opts.getSpriteUrl(item);

  return { placements, itemsById };
}
