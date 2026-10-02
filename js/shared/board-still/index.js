/**
 * Flat board stills for catalogs / hover tips (one PNG per unique layout).
 */

import { BOARD_COLS, BOARD_ROWS, STILL_OVERHANG } from './paint.js';
import { boardStillUrl } from './cache.js';

export { paintBoardCanvas, BOARD_COLS, BOARD_ROWS, STILL_CELL_PX, STILL_OVERHANG } from './paint.js';
export { paintBoardForCompare, fullSpriteUrl } from './paint-compare.js';
export { boardStillUrl, stillCacheKey, loadCachedImage } from './cache.js';
export {
  boardStillPublicUrl,
  bakeAndUploadBoardStill,
  paintBoardStillBlob,
  uploadBoardStill,
  BOARD_STILLS_BUCKET,
} from './upload.js';

/**
 * @param {HTMLElement} host
 * @param {{
 *   placements: object[],
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   root?: string,
 *   cellPx: number,
 *   appear?: boolean,
 *   bakedUrl?: string | null | Promise<string | null>,
 * }} opts
 * @returns {{ destroy: () => void, stillUrl: Promise<string | null> }}
 */
export function mountBoardStill(host, opts) {
  const cellPx = Math.max(8, Number(opts.cellPx) || 28);
  const appear = opts.appear !== false;
  host.style.setProperty('--bpb-still-cell', `${cellPx}px`);
  const still = document.createElement('span');
  still.className = `bpb-board-still${appear ? ' bpb-board-still--appear' : ''}`;
  still.setAttribute('aria-hidden', 'true');
  const img = document.createElement('img');
  img.className = 'bpb-board-still__img';
  img.alt = '';
  img.draggable = false;
  still.appendChild(img);
  host.replaceChildren(still);

  const baked = opts.bakedUrl;
  /** @type {Promise<string | null>} */
  const renderGenerated = () => boardStillUrl({
        placements: opts.placements,
        itemsById: opts.itemsById,
        getSpriteUrl: opts.getSpriteUrl,
        root: opts.root,
      })
        .then((url) => {
          if (!img.isConnected) return url;
          img.src = url;
          img.decode?.().catch(() => {});
          img.classList.add('is-ready');
          still.classList.add('is-ready');
          return url;
        })
        .catch(() => {
          still.classList.add('is-empty');
          return null;
        });
  const stillUrl = baked
    ? Promise.resolve(baked).then((url) => {
        const resolved = String(url || '').trim();
        if (!resolved) return renderGenerated();
        if (!img.isConnected) return resolved;
        img.src = resolved;
        img.decode?.().catch(() => {});
        img.classList.add('is-ready');
        still.classList.add('is-ready');
        return resolved;
      }).catch(() => renderGenerated())
    : renderGenerated();

  return {
    destroy() {
      host.replaceChildren();
    },
    stillUrl,
  };
}

/** CSS cell count of the painted bitmap (board + overhang). */
export const STILL_PAINT_COLS = BOARD_COLS + STILL_OVERHANG * 2;
export const STILL_PAINT_ROWS = BOARD_ROWS + STILL_OVERHANG * 2;
