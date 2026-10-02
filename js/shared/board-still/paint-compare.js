/**
 * Paint a proposed board for screenshot color-compare (sprites + static glows).
 */

import { loadLiveArt } from '../item-live-art/index.js';
import { BOARD_COLS, BOARD_ROWS, paintBoardCanvas } from './paint.js';

/**
 * Full sprite URL (not thumbs) for compare fidelity.
 * @param {string} root
 * @param {object} item
 */
export function fullSpriteUrl(root, item) {
  const base = root.endsWith('/') ? root : `${root}/`;
  // Prefer catalog image only — never invent a sprite from id (e.g. __unrecognized__).
  const raw = String(item?.image || '');
  const stem = raw.replace(/^.*\//, '').replace(/\.(png|webp)$/i, '');
  if (!stem) return '';
  return `${base}assets/item-sprites/${stem}.png`;
}

/**
 * @param {{
 *   placements: { id: string, x: number, y: number, r?: number }[],
 *   itemsById: Map<string, object>,
 *   cellPx: number,
 *   cols?: number,
 *   rows?: number,
 *   root?: string,
 *   loadImage: (url: string, opts?: object) => Promise<HTMLImageElement>,
 *   liveArtById?: Record<string, object> | Map<string, object>,
 * }} opts
 * @returns {Promise<{ canvas: HTMLCanvasElement, imageData: ImageData, cellPx: number }>}
 */
export async function paintBoardForCompare(opts) {
  const rootRaw = opts.root || document.body?.dataset?.root || '/';
  const root = rootRaw.endsWith('/') ? rootRaw : `${rootRaw}/`;
  const cellPx = Math.max(8, Number(opts.cellPx) || 48);
  const cols = Math.max(1, Number(opts.cols) || BOARD_COLS);
  const rows = Math.max(1, Number(opts.rows) || BOARD_ROWS);

  let liveArtById = opts.liveArtById;
  if (!liveArtById) {
    try {
      liveArtById = await loadLiveArt();
    } catch {
      liveArtById = {};
    }
  }

  const getSpriteUrl = (item) => fullSpriteUrl(root, item);

  const { canvas } = await paintBoardCanvas({
    placements: opts.placements,
    itemsById: opts.itemsById,
    getSpriteUrl,
    loadImage: opts.loadImage,
    root,
    cellPx,
    cols,
    rows,
    crop: false,
    padPx: 0,
    overhangCells: 0,
    mode: 'items',
    glows: true,
    liveArtById,
    bags: false,
    fabric: false,
    shadows: false,
  }).catch((err) => {
    // Gap-fill / compare can run with bags only — don't hard-fail the import.
    if (err instanceof Error && /No items to export/i.test(err.message)) {
      const blank = document.createElement('canvas');
      blank.width = cols * cellPx;
      blank.height = rows * cellPx;
      return { canvas: blank };
    }
    throw err;
  });

  // Match bag-crop pixel size: board may be larger than crop if cell math differs.
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { canvas, imageData, cellPx };
}
