/**
 * Catalog backpack thumbs — one cached PNG per unique board (not live grids).
 */

import { mountBoardStill, boardStillPublicUrl } from '../../shared/board-still/index.js';
import {
  mapItem,
  makeSpriteUrl,
  applyShapes,
  applySocketOffsets,
} from '../build/map-item.js';
import { bindMoreBuildTips, registerMoreBuildTip } from '../build/more-build-tip.js';

/** Card feed preview — large enough to read the layout at a glance. */
const FEED_CELL_PX = 60;
/** Compact feed thumb — matches CSS `--builds-feed-cell: 18px`. */
const FEED_CELL_COMPACT_PX = 18;
/** Grid feed tile — mid-size still (~28–32px). */
const FEED_CELL_GRID_PX = 30;

/**
 * @param {HTMLElement} listEl
 * @param {{
 *   builds: object[],
 *   root: string,
 *   view?: 'card' | 'compact' | 'grid',
 *   spriteDisplay?: object | null,
 *   shapes?: object | null,
 *   sockets?: object | null,
 *   tipSelector?: string,
 *   boardAttr?: string,
 *   cellPx?: number,
 *   emptyHtml?: string,
 * }} opts
 * @returns {() => void}
 */
export function mountFeedBoardThumbs(listEl, opts) {
  if (!(listEl instanceof HTMLElement)) return () => {};

  const root = opts.root.endsWith('/') ? opts.root : `${opts.root}/`;
  const compact =
    opts.view === 'compact' || listEl.classList.contains('builds-feed__list--compact');
  const grid =
    opts.view === 'grid' || listEl.classList.contains('builds-feed__list--grid');
  const boardAttr = opts.boardAttr || 'data-feed-board';
  const getSpriteUrl = makeSpriteUrl(root, opts.spriteDisplay || null);
  const bySlug = new Map(
    (opts.builds || []).map((b) => [String(b.slug || ''), b]),
  );
  /** @type {{ destroy?: () => void }[]} */
  const stills = [];

  listEl.querySelectorAll(`[${boardAttr}]`).forEach((host) => {
    if (!(host instanceof HTMLElement)) return;
    const slug = host.getAttribute(boardAttr) || '';
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

    // A submitted build may have a baked board still without live placement
    // rows (older builds and privacy-filtered entries). Keep that image
    // usable instead of replacing it with a misleading "No board" state.
    const hasBakedStill = String(build.board_still_path || '').trim().length > 0;
    if (!placements.length && !hasBakedStill) {
      host.classList.add('is-empty');
      host.innerHTML =
        opts.emptyHtml || `<span class="builds-post__board-empty">No board</span>`;
      return;
    }

    const defaultCell = compact
      ? FEED_CELL_COMPACT_PX
      : grid
        ? FEED_CELL_GRID_PX
        : FEED_CELL_PX;
    const cellPx =
      Number(opts.cellPx) > 0
        ? Number(opts.cellPx)
        : cellPxFromHost(host, defaultCell);
    host.style.setProperty('--builds-feed-cell', `${cellPx}px`);
    const bakedUrl = boardStillPublicUrl(build.board_still_path);
    const mounted = mountBoardStill(host, {
      placements,
      itemsById,
      getSpriteUrl,
      root,
      cellPx,
      bakedUrl,
    });
    stills.push(mounted);

    const tipEl = opts.tipSelector
      ? host.closest(opts.tipSelector)
      : compact
        ? host.closest('.builds-post__compact-thumb')
        : grid
          ? host.closest('.builds-post__grid-board')
          : null;
    if (tipEl instanceof HTMLElement) {
      tipEl.setAttribute('data-feed-build-tip', '');
      registerMoreBuildTip(tipEl, build, mounted.stillUrl);
    }
  });

  const unbindTip =
    opts.tipSelector || compact || grid
      ? bindMoreBuildTips(listEl, {
          root,
          overEl: null,
          thumbSelector: opts.tipSelector || '[data-feed-build-tip]',
        })
      : () => {};

  return () => {
    try {
      unbindTip();
    } catch {
      /* ignore */
    }
    for (const s of stills) s.destroy?.();
    stills.length = 0;
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

  const col = host.closest('.builds-feed-col, .profile-main');
  if (!(col instanceof HTMLElement)) return preferred;

  const colW = col.clientWidth;
  if (colW <= 0) return preferred;

  const stage = host.closest('.builds-post__stage');
  const stacked =
    stage instanceof HTMLElement &&
    getComputedStyle(stage).gridTemplateColumns.split(' ').length <= 1;

  const reserve = stacked ? 48 : 11.5 * 16;
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
export function placementsForBuild(build, opts) {
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
