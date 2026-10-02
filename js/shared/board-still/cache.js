/**
 * Coalesced image decode + LRU blob URLs for catalog board stills.
 */

import { loadBoardImage, paintBoardCanvas, STILL_CELL_PX, STILL_OVERHANG } from './paint.js';

const PAINT_MAX = 5;
let paintActive = 0;
/** @type {(() => void)[]} */
const paintWait = [];

function withPaintSlot(fn) {
  return new Promise((resolve, reject) => {
    const run = () => {
      paintActive += 1;
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => {
          paintActive -= 1;
          const next = paintWait.shift();
          if (next) next();
        });
    };
    if (paintActive < PAINT_MAX) run();
    else paintWait.push(run);
  });
}

const IMAGE_CACHE = new Map();
/** @type {Map<string, Promise<string>>} */
const STILL_CACHE = new Map();
const STILL_ORDER = [];
const STILL_CAP = 80;

/**
 * @param {string} url
 * @param {{ anonymous?: boolean }} [opts]
 */
export function loadCachedImage(url, opts = {}) {
  const key = `${opts.anonymous === false ? 'local' : 'cors'}:${url}`;
  const hit = IMAGE_CACHE.get(key);
  if (hit) return hit;
  const pending = loadBoardImage(url, opts).catch((err) => {
    IMAGE_CACHE.delete(key);
    throw err;
  });
  IMAGE_CACHE.set(key, pending);
  return pending;
}

/**
 * @param {object[]} placements
 * @param {string} [mode]
 */
export function stillCacheKey(placements, mode = 'all') {
  const sig = (placements || [])
    .map((p) => {
      const gems = Array.isArray(p.gems) ? p.gems.filter(Boolean).join(',') : '';
      return `${p.id}:${Number(p.x) || 0}:${Number(p.y) || 0}:${Number(p.r) || 0}:${gems}`;
    })
    .join('|');
  // v2 = fabric above bags + SE silhouette shadows
  return `v2|${STILL_CELL_PX}|${mode}|${sig}`;
}

/**
 * @param {string} key
 * @param {string} url
 */
function rememberStill(key, url) {
  STILL_ORDER.push(key);
  while (STILL_ORDER.length > STILL_CAP) {
    const drop = STILL_ORDER.shift();
    if (!drop || drop === key) continue;
    const stale = STILL_CACHE.get(drop);
    STILL_CACHE.delete(drop);
    if (stale) {
      stale.then((href) => {
        if (href && href.startsWith('blob:')) URL.revokeObjectURL(href);
      }).catch(() => {});
    }
  }
}

/**
 * One 9×7 (+ overhang) PNG per unique board. CSS scales it to the thumb / tip.
 * @param {{
 *   placements: object[],
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   root?: string,
 * }} opts
 * @returns {Promise<string>}
 */
export function boardStillUrl(opts) {
  const key = stillCacheKey(opts.placements);
  const hit = STILL_CACHE.get(key);
  if (hit) return hit;

  const pending = withPaintSlot(() =>
    paintBoardCanvas({
      placements: opts.placements,
      itemsById: opts.itemsById,
      getSpriteUrl: opts.getSpriteUrl,
      loadImage: loadCachedImage,
      root: opts.root,
      cellPx: STILL_CELL_PX,
      crop: false,
      padPx: 0,
      overhangCells: STILL_OVERHANG,
    }),
  )
    .then(
      ({ canvas }) =>
        new Promise((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(URL.createObjectURL(blob));
            else reject(new Error('Could not encode board still.'));
          }, 'image/png');
        }),
    )
    .catch((err) => {
      STILL_CACHE.delete(key);
      throw err;
    });

  STILL_CACHE.set(key, pending);
  pending.then((url) => rememberStill(key, url)).catch(() => {});
  return pending;
}
