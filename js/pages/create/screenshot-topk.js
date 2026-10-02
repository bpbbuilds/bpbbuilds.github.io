/**
 * Re-rank detector boxes: lookalike catalog peers + local sprite NCC at the box.
 */

import { shapeForItem, bodyBounds } from '../../shared/backpack-grid/index.js';
import {
  SABER_BLADES,
  WINGED_SWORDS,
  lookalikesForName,
} from '../../shared/screenshot-confusion.js?v=fa3633b';
import {
  NCC_RANK_FLOOR,
  downsampleGray,
  knownScales,
  matchTemplateAtScales,
  prepareTemplateBrowser,
} from '../../shared/screenshot-ncc.js?v=fa3633b';
import { isBagItem, isGemItem } from './collision.js';

const MAX_CANDIDATES = 6;
/** Extra slots so forced sword candidates don't crowd out lookalikes. */
const SWORD_EXTRA = 14;
const LONG_THIN_ASPECT = 2.5;
/** Pose search radius for oblong items, in cells. */
export const OBLONG_RADIUS = 1.2;
const POSE_MARGIN = 0.08;

/**
 * Re-center a box on the NCC hit; w/h follow the matched face in later planning.
 * @param {{ cx: number, cy: number, w: number, h: number }} box
 * @param {number} cx
 * @param {number} cy
 */
function poseBox(box, cx, cy) {
  return { ...box, cx, cy };
}
const NCC_CELL_PX = 18;

/**
 * @typedef {{
 *   id: string,
 *   name?: string,
 *   confidence?: number,
 *   box?: { cx: number, cy: number, w: number, h: number },
 * }} Detection
 */

/**
 * @param {object} item
 */
function imageStem(item) {
  return String(item.image || item.id || '')
    .replace(/^.*\//, '')
    .replace(/\.(png|webp)$/i, '');
}

/**
 * @param {string} url
 * @returns {Promise<HTMLImageElement | null>}
 */
function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Faces whose body AABB aspect matches the detector box.
 * @param {object} item
 * @param {{ w: number, h: number }} box
 * @returns {number[]}
 */
export function candidateFaces(item, box) {
  const b0 = bodyBounds(shapeForItem(item, 0));
  if (b0.w === b0.h) return [0, 1, 2, 3];
  const boxWide = box.w >= box.h;
  const r0Wide = b0.w > b0.h;
  return boxWide === r0Wide ? [0, 2] : [1, 3];
}

/**
 * Local NCC over faces around a detector box; returns the best face and refined center.
 * v1 synth labels rotated sprites with their unrotated box, so r1/r3 items come back
 * transposed and offset by ~1 cell — hence all faces + a wider window for non-square items.
 * @param {{
 *   small: import('../../shared/screenshot-ncc.js').GrayBuf,
 *   ds: number,
 *   sprite: HTMLImageElement,
 *   scale: number,
 *   box: { cx: number, cy: number },
 *   faces: number[],
 *   radiusPx: number,
 * }} o
 * @returns {{ r: number, score: number, cx: number, cy: number }}
 */
export function poseSearch(o) {
  const { small, ds, sprite, scale, box, faces, radiusPx } = o;
  const pad = Math.max(3, Math.round(radiusPx / ds));
  let best = { r: faces[0] || 0, score: -Infinity, cx: box.cx, cy: box.cy, ranked: [] };
  /** @type {{ r: number, score: number }[]} */
  const perFace = [];
  for (const r of faces) {
    const probe = prepareTemplateBrowser(sprite, r * 90, scale / ds);
    const x0 = Math.floor(box.cx / ds - probe.w / 2) - pad;
    const y0 = Math.floor(box.cy / ds - probe.h / 2) - pad;
    const hit = matchTemplateAtScales(small, sprite, {
      scales: [scale],
      rotations: [r * 90],
      stride: 1,
      bounds: { x0, y0, x1: x0 + pad * 2, y1: y0 + pad * 2 },
      prepare: (img, rot, s) => prepareTemplateBrowser(img, rot, s / ds),
    });
    perFace.push({ r, score: hit.score });
    if (hit.score > best.score) {
      best = {
        r,
        score: hit.score,
        cx: (hit.x + hit.tw / 2) * ds,
        cy: (hit.y + hit.th / 2) * ds,
        ranked: [],
      };
    }
  }
  best.ranked = perFace.sort((a, b) => b.score - a.score);
  return best;
}

/**
 * Local pose at the box vs all faces over a wider window; the wide pose must win clearly.
 * @param {Omit<Parameters<typeof poseSearch>[0], 'faces' | 'radiusPx'> & {
 *   localFaces: number[],
 *   cellW: number,
 * }} o
 */
export function poseWithMargin(o) {
  const local = poseSearch({ ...o, faces: o.localFaces, radiusPx: 3 * o.ds });
  const wide = poseSearch({ ...o, faces: [0, 1, 2, 3], radiusPx: o.cellW * OBLONG_RADIUS });
  if (wide.score > local.score + POSE_MARGIN) return { ...wide, moved: true };
  return { ...local, cx: o.box.cx, cy: o.box.cy, moved: false };
}

/** Non-square body at r0 (rotation changes the footprint). */
export function isOblong(item) {
  const b = bodyBounds(shapeForItem(item, 0));
  return b.w !== b.h;
}

/**
 * @param {object} item
 * @param {{ w: number, h: number }} box
 */
function aspectCompatible(item, box) {
  return candidateFaces(item, box).length > 0;
}

/**
 * @param {{
 *   detections: Detection[],
 *   itemsById: Map<string, object>,
 *   hay: import('../../shared/screenshot-ncc.js').GrayBuf,
 *   cellW: number,
 *   root: string,
 *   getSpriteUrl: (item: object) => string,
 *   byImage?: Record<string, { w?: number, texW?: number }>,
 * }} opts
 * @returns {Promise<{ detections: Detection[], swaps: number }>}
 */
export async function rerankDetectionsTopk(opts) {
  const {
    detections,
    itemsById,
    hay,
    cellW,
    root,
    getSpriteUrl,
    byImage = {},
  } = opts;
  const base = root.endsWith('/') ? root : `${root}/`;
  const ds = Math.max(1, cellW / NCC_CELL_PX);
  const small = downsampleGray(hay, ds);
  let swaps = 0;

  /** @type {Map<string, object>} */
  const byName = new Map();
  for (const item of itemsById.values()) {
    byName.set(String(item.name || '').toLowerCase(), item);
  }

  /** @type {Detection[]} */
  const out = [];

  for (let i = 0; i < detections.length; i++) {
    if (i % 3 === 0) await new Promise((r) => setTimeout(r, 0));
    const det = detections[i];
    const primary = itemsById.get(String(det.id));
    if (!primary || !det.box || isBagItem(primary) || isGemItem(primary)) {
      out.push(det);
      continue;
    }

    /** @type {object[]} */
    const cands = [];
    const add = (item) => {
      if (!item || isBagItem(item) || isGemItem(item)) return;
      if (!aspectCompatible(item, det.box)) return;
      if (cands.some((c) => c.id === item.id)) return;
      if (cands.length >= MAX_CANDIDATES) return;
      cands.push(item);
    };
    const addForced = (item) => {
      if (!item || cands.some((c) => c.id === item.id)) return;
      if (cands.length >= MAX_CANDIDATES + SWORD_EXTRA) return;
      cands.push(item);
    };
    add(primary);
    const long = Math.max(det.box.w, det.box.h);
    const short = Math.max(1, Math.min(det.box.w, det.box.h));
    const thin = long / short >= LONG_THIN_ASPECT;
    if (thin) {
      // Long thin boxes are usually blades; the detector mislabels their orientation/family.
      for (const name of [...WINGED_SWORDS, ...SABER_BLADES]) {
        addForced(byName.get(name.toLowerCase()));
      }
    }
    for (const name of lookalikesForName(String(primary.name || ''))) {
      add(byName.get(name.toLowerCase()));
    }
    if (cands.length <= 1) {
      out.push(det);
      continue;
    }

    let bestId = String(primary.id);
    let bestName = String(primary.name || primary.id);
    let bestScore = -Infinity;
    let bestR = candidateFaces(primary, det.box)[0] || 0;
    let bestCx = det.box.cx;
    let bestCy = det.box.cy;

    for (const item of cands) {
      const sprite =
        (await loadImage(`${base}assets/item-sprites/${imageStem(item)}.png`)) ||
        (await loadImage(getSpriteUrl(item)));
      if (!sprite) continue;
      const disp = byImage[`${imageStem(item)}.png`];
      const nativeW = Number(disp?.texW) || sprite.naturalWidth || sprite.width || 64;
      const scale = knownScales(cellW, Number(disp?.w) || 1, nativeW)[2] ?? 1;
      const faces = candidateFaces(item, det.box);
      const hit =
        thin && isOblong(item)
          ? poseWithMargin({ small, ds, sprite, scale, box: det.box, localFaces: faces, cellW })
          : poseSearch({ small, ds, sprite, scale, box: det.box, faces, radiusPx: 3 * ds });
      if (hit.score > bestScore) {
        bestScore = hit.score;
        bestId = String(item.id);
        bestName = String(item.name || item.id);
        bestR = hit.r;
        bestCx = hit.cx;
        bestCy = hit.cy;
      }
    }

    if (bestScore >= NCC_RANK_FLOOR) {
      if (bestId !== String(primary.id)) swaps += 1;
      const moved = thin ? { box: poseBox(det.box, bestCx, bestCy) } : {};
      out.push({
        ...det,
        ...moved,
        id: bestId,
        name: bestName,
        _topkR: bestR,
        _topkScore: bestScore,
      });
    } else {
      out.push(det);
    }
  }

  console.info('[screenshot] topk', `swaps=${swaps}`, `n=${out.length}`);
  return { detections: out, swaps };
}
