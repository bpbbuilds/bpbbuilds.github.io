/**
 * Paint + upload catalog board stills (Create Submit → Storage).
 */

import { getSupabase } from '../supabase.js';
import { config } from '../config.js';
import {
  paintBoardCanvas,
  STILL_CELL_PX,
  STILL_OVERHANG,
  BOARD_COLS,
  BOARD_ROWS,
} from './paint.js';
import { loadCachedImage } from './cache.js';

export const BOARD_STILLS_BUCKET = 'board-stills';

/**
 * Public CDN URL for a stored still path.
 * @param {string | null | undefined} path
 * @param {{ projectUrl?: string }} [opts]
 * @returns {string | null}
 */
export function boardStillPublicUrl(path, opts = {}) {
  const rel = String(path || '').replace(/^\/+/, '').trim();
  if (!rel) return null;
  if (/^https?:\/\//i.test(rel)) return rel;
  const base = String(opts.projectUrl || config.supabaseUrl || '')
    .trim()
    .replace(/\/+$/, '');
  if (!base || base.includes('YOUR_')) return null;
  return `${base}/storage/v1/object/public/${BOARD_STILLS_BUCKET}/${rel}`;
}

/**
 * @param {Blob} blob
 * @returns {Promise<'image/webp' | 'image/png'>}
 */
async function sniffMime(blob) {
  const t = String(blob.type || '').toLowerCase();
  if (t === 'image/webp' || t === 'image/png') return t;
  return 'image/png';
}

/**
 * Encode catalog-sized still (same paint as feed thumbs).
 * @param {{
 *   placements: object[],
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   root?: string,
 * }} opts
 * @returns {Promise<{ blob: Blob, ext: 'webp' | 'png' }>}
 */
export async function paintBoardStillBlob(opts) {
  const { canvas } = await paintBoardCanvas({
    placements: opts.placements,
    itemsById: opts.itemsById,
    getSpriteUrl: opts.getSpriteUrl,
    loadImage: loadCachedImage,
    root: opts.root,
    cellPx: STILL_CELL_PX,
    cols: BOARD_COLS,
    rows: BOARD_ROWS,
    crop: false,
    padPx: 0,
    overhangCells: STILL_OVERHANG,
  });

  /** @type {Blob | null} */
  let blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/webp', 0.9);
  });
  if (blob && blob.size > 0) {
    return { blob, ext: 'webp' };
  }

  blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b && b.size > 0) resolve(b);
      else reject(new Error('Could not encode board still.'));
    }, 'image/png');
  });
  return { blob, ext: 'png' };
}

/**
 * Upload under `{authorId}/{uuid}.{ext}`. Caller must be signed in as authorId.
 * @param {Blob} blob
 * @param {{ authorId: string, ext?: 'webp' | 'png' }} opts
 * @returns {Promise<string>} storage object path
 */
export async function uploadBoardStill(blob, opts) {
  const authorId = String(opts.authorId || '').trim();
  if (!authorId) throw new Error('Missing author id for board still upload.');
  const ext = opts.ext === 'png' ? 'png' : 'webp';
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `still-${Date.now().toString(36)}`;
  const path = `${authorId}/${id}.${ext}`;
  const mime = await sniffMime(blob);
  const supabase = getSupabase();
  const { error } = await supabase.storage
    .from(BOARD_STILLS_BUCKET)
    .upload(path, blob, {
      contentType: mime === 'image/webp' ? 'image/webp' : 'image/png',
      upsert: true,
      cacheControl: '31536000',
    });
  if (error) throw error;
  return path;
}

/**
 * Paint + upload; returns path or null on soft failure.
 * @param {{
 *   placements: object[],
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   root?: string,
 *   authorId: string,
 * }} opts
 * @returns {Promise<string | null>}
 */
export async function bakeAndUploadBoardStill(opts) {
  if (!opts.placements?.length || !opts.authorId) return null;
  try {
    const { blob, ext } = await paintBoardStillBlob(opts);
    return await uploadBoardStill(blob, { authorId: opts.authorId, ext });
  } catch (err) {
    console.warn('[board-still] bake/upload skipped', err);
    return null;
  }
}
