/**
 * Export create-board backpack as PNG (canvas redraw from placements).
 */

import { paintBoardCanvas } from '../../shared/board-still/paint.js';
import { loadCachedImage } from '../../shared/board-still/cache.js';
import { BOARD_COLS, BOARD_ROWS } from './collision.js';

const CELL_PX = 256;
/** Outer transparent margin around the cropped build. */
const PAD_PX = 24;
/** Extra cells around the placement AABB so overflowing sprites aren't clipped. */
const OVERHANG_CELLS = 1;

/**
 * @param {string} title
 */
function slugify(title) {
  const s = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return s || 'untitled';
}

/**
 * @param {{
 *   placements: { id: string, x: number, y: number, r?: number, key?: string, gems?: (string | null)[] }[],
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   title?: string,
 *   root?: string,
 *   mode?: 'all' | 'items' | 'bags',
 * }} opts
 */
export async function exportBoardPng(opts) {
  const { canvas } = await paintBoardCanvas({
    placements: opts.placements,
    itemsById: opts.itemsById,
    getSpriteUrl: opts.getSpriteUrl,
    loadImage: loadCachedImage,
    root: opts.root,
    cellPx: CELL_PX,
    cols: BOARD_COLS,
    rows: BOARD_ROWS,
    crop: true,
    padPx: PAD_PX,
    overhangCells: OVERHANG_CELLS,
    mode: opts.mode,
  });

  let blob;
  try {
    blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Could not encode PNG (sprites may be blocked by CORS).'));
      }, 'image/png');
    });
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? err.message
        : 'Could not encode PNG (sprites may be blocked by CORS).',
    );
  }

  const slug = slugify(opts.title);
  const mode = opts.mode === 'items' || opts.mode === 'bags' ? opts.mode : 'all';
  const modeSuffix = mode === 'all' ? '' : `-${mode}`;
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = `bpb-build-${slug}${modeSuffix}.png`;
  a.click();
  URL.revokeObjectURL(href);
}
