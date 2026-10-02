/**
 * Cover fabric mask with catalog bags (detector IDs + leather residual).
 */

import { shapeForItem, bodyBounds } from '../../shared/backpack-grid/index.js';
import {
  BOARD_COLS,
  BOARD_ROWS,
  canPlace,
  isBagItem,
  placementBodyCells,
} from './collision.js';
import { EDIT_MODE } from './editor-state.js';
import { mergeSmallBags } from './screenshot-bags-merge.js?v=bags2u';
import { MIN_CONF_BAG } from '../../shared/screenshot-detector.js?v=fa3633b';
import {
  BAG_PAINT_MAX,
  paintBetter,
  scoreBagAtPose,
} from './screenshot-bags-paint.js?v=fa3633b';
import {
  canFitAnywhere,
  catalogBags,
  cropGridMetrics,
  dataUrlToRgba,
  estimateBagCellMask,
  fillMaskHoles,
  footprintFitsRemaining,
  footprintOverlap,
  markCovered,
  preferIdx,
} from './screenshot-bags-mask.js?v=grid97';
import { estimateBagCellMaskAsync } from './screenshot-bags-slot.js?v=fa3633b';
import {
  completeLeatherBagLattice,
  filterRealBagHints,
  placeBagsOnDetectorLattice,
  refineMetricsFromBagHints,
} from './screenshot-bags-lattice.js?v=bags2u';

export { cropGridMetrics, estimateBagCellMask, estimateBagCellMaskAsync };

const HINT_OVERLAP = 0.7;
const MIN_MASK_CELLS = 6;

/**
 * Same-footprint bags that paint must disambiguate (detector confuses these).
 * Matched by catalog name.
 * @type {string[][]}
 */
const LOOKALIKE_NAME_GROUPS = [
  ['Box of Cogs', 'Box of Prosperity'],
  ['Fanny Pack', 'Protective Purse'],
];

/**
 * @typedef {{
 *   id: string,
 *   name?: string,
 *   confidence?: number,
 *   box?: { cx: number, cy: number, w: number, h: number },
 * }} BagHint
 */

/**
 * Cover fabric mask with catalog bags.
 * @param {{
 *   cropDataUrl: string,
 *   grid: import('../../shared/screenshot-grid.js').BagGrid | null,
 *   detections?: BagHint[],
 *   itemsById: Map<string, object>,
 *   exclude?: Set<string>,
 *   root?: string,
 * }} opts
 * @returns {Promise<{
 *   bags: { id: string, name: string, x: number, y: number, r: number, score: number }[],
 *   mask: Set<string>,
 *   covered: number,
 *   ok: boolean,
 * }>}
 */
export async function coverBagsFromFabric(opts) {
  const { cropDataUrl, grid, detections = [], itemsById, exclude, root = '/' } = opts;
  const img = await dataUrlToRgba(cropDataUrl);
  let metrics = cropGridMetrics(grid, img.width);

  // NMS bag hints before mask — refine cell size from boxes (tight crops break fabric grid).
  const rawHints = detections
    .filter((d) => d?.id && d.box && itemsById.has(String(d.id)))
    .filter((d) => isBagItem(itemsById.get(String(d.id))))
    .filter((d) => (Number(d.confidence) || 0) >= 0.12)
    .sort((a, b) => (Number(b.confidence) || 0) - (Number(a.confidence) || 0));

  /** @type {typeof rawHints} */
  let bagHints = [];
  for (const h of rawHints) {
    const hb = h.box;
    if (!hb) continue;
    const clash = bagHints.some((k) => {
      const kb = k.box;
      if (!kb) return false;
      const x1 = Math.max(hb.cx - hb.w / 2, kb.cx - kb.w / 2);
      const y1 = Math.max(hb.cy - hb.h / 2, kb.cy - kb.h / 2);
      const x2 = Math.min(hb.cx + hb.w / 2, kb.cx + kb.w / 2);
      const y2 = Math.min(hb.cy + hb.h / 2, kb.cy + kb.h / 2);
      const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
      const uni = hb.w * hb.h + kb.w * kb.h - inter;
      return uni > 0 && inter / uni > 0.35;
    });
    if (!clash) bagHints.push(h);
  }
  const realHints = filterRealBagHints(bagHints, itemsById);
  const refined = refineMetricsFromBagHints(metrics, realHints, itemsById);
  // Only distrust the fabric grid when bag boxes clearly disagree with its cell size.
  const gridCell = Number(metrics.cellW) || 0;
  const gridOff = !metrics.gridOk || !gridCell || Math.abs(refined.cellW / gridCell - 1) > 0.25;
  const mostlyBig = realHints.length >= 0.6 * bagHints.length;
  if (refined.refined && gridOff && mostlyBig) {
    bagHints = realHints;
    metrics = refined;
    console.info(
      '[screenshot] bags cell-from-boxes',
      `cell=${metrics.cellW.toFixed(1)}`,
      `hints=${bagHints.length}`,
    );
    // Tight leather clusters: place on detector lattice, skip fabric invent.
    const lattice = placeBagsOnDetectorLattice(bagHints, itemsById, metrics);
    if (lattice && lattice.bags.length >= 2) {
      return {
        bags: lattice.bags,
        mask: new Set(),
        covered: lattice.bags.length * 4,
        ok: true,
        metrics: lattice.metrics,
      };
    }
  }

  const { mask: rawMask, floorRejected } = await estimateBagCellMaskAsync({
    img,
    metrics,
    root,
    detections,
    itemsById,
  });
  const mask = fillMaskHoles(rawMask);
  for (const k of floorRejected || []) mask.delete(k);
  if (exclude) for (const k of exclude) mask.delete(k);

  if (mask.size < MIN_MASK_CELLS) {
    console.info('[screenshot] bags mask=', mask.size, '(too small — fallback)');
    return { bags: [], mask, covered: 0, ok: false, metrics };
  }

  let { cellW, cellH, originX, originY } = metrics;

  /** @type {Set<string>} */
  const hintFoot = new Set();
  for (const hint of bagHints) {
    if (!hint.box) continue;
    const boxLeft = (hint.box.cx - hint.box.w / 2 - originX) / cellW;
    const boxTop = (hint.box.cy - hint.box.h / 2 - originY) / cellH;
    const boxRight = (hint.box.cx + hint.box.w / 2 - originX) / cellW;
    const boxBottom = (hint.box.cy + hint.box.h / 2 - originY) / cellH;
    const x0 = Math.floor(boxLeft) - 1;
    const y0 = Math.floor(boxTop) - 1;
    const x1 = Math.ceil(boxRight) + 1;
    const y1 = Math.ceil(boxBottom) + 1;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (x >= 0 && y >= 0 && x < BOARD_COLS && y < BOARD_ROWS) {
          hintFoot.add(`${x},${y}`);
        }
      }
    }
  }
  let maskClipped = false;
  if (hintFoot.size >= 8 && mask.size > hintFoot.size * 1.35) {
    for (const k of [...mask]) {
      if (!hintFoot.has(k)) mask.delete(k);
    }
    maskClipped = true;
    console.info(
      '[screenshot] bags mask clip',
      `hints=${bagHints.length}`,
      `foot=${hintFoot.size}`,
      `→${mask.size}`,
    );
  }

  const remaining = new Set(mask);
  /** @type {object[]} */
  const placed = [];
  /** @type {{ id: string, name: string, x: number, y: number, r: number, score: number }[]} */
  const bagsOut = [];
  const allBags = catalogBags(itemsById);
  const bagsByName = new Map(allBags.map((b) => [String(b.name || ''), b]));

  /**
   * Detector ID is law, except lookalike groups (paint among that set only).
   * @param {object} primary
   * @returns {object[]}
   */
  function candsForHint(primary) {
    const name = String(primary.name || '');
    for (const group of LOOKALIKE_NAME_GROUPS) {
      if (!group.includes(name)) continue;
      /** @type {object[]} */
      const cands = [];
      for (const n of group) {
        const item = bagsByName.get(n);
        if (item) cands.push(item);
      }
      return cands.length ? cands : [primary];
    }
    return [primary];
  }

  /**
   * @param {object} item
   * @param {number} x
   * @param {number} y
   * @param {number} r
   * @param {number} score
   * @param {number} minOverlap
   * @param {boolean} requireAllRemaining
   */
  function tryAccept(item, x, y, r, score, minOverlap, requireAllRemaining) {
    const body = bodyBounds(shapeForItem(item, r));
    const cand = {
      x: Math.max(0, Math.min(BOARD_COLS - body.w, x)),
      y: Math.max(0, Math.min(BOARD_ROWS - body.h, y)),
      r,
    };
    if (!canPlace(item, cand, placed, itemsById, null, EDIT_MODE.BAG_LAYER)) return false;
    if (requireAllRemaining) {
      if (!footprintFitsRemaining(item, cand, remaining)) return false;
    } else if (footprintOverlap(item, cand, remaining) < minOverlap) {
      return false;
    }
    placed.push({
      id: String(item.id),
      ...cand,
      key: `bag-${bagsOut.length}`,
    });
    bagsOut.push({
      id: String(item.id),
      name: String(item.name || item.id),
      ...cand,
      score,
    });
    markCovered(item, cand, remaining);
    return true;
  }

  const paintCache = new Map();
  /**
   * @param {object} item
   * @param {{ x: number, y: number, r: number }} pose
   */
  async function paintScore(item, pose) {
    const key = `${item.id}@${pose.x},${pose.y},${pose.r}`;
    if (paintCache.has(key)) return paintCache.get(key);
    const paint = await scoreBagAtPose({
      shot: img,
      item,
      pose,
      metrics,
      itemsById,
      root,
    });
    paintCache.set(key, paint);
    return paint;
  }

  /**
   * Best pose (and type when cands > 1 lookalike) by paint score.
   * @param {object[]} cands
   * @param {number} bx
   * @param {number} by
   * @param {number} minOverlap
   * @param {boolean} requireAll
   */
  async function bestPainted(cands, bx, by, minOverlap, requireAll) {
    /** @type {{ item: object, x: number, y: number, r: number, paint: number } | null} */
    let best = null;
    const nudges = [
      [0, 0],
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const item of cands) {
      for (const r of [0, 1, 2, 3]) {
        const body = bodyBounds(shapeForItem(item, r));
        for (const [dx, dy] of nudges) {
          const cand = {
            x: Math.max(0, Math.min(BOARD_COLS - body.w, bx + dx)),
            y: Math.max(0, Math.min(BOARD_ROWS - body.h, by + dy)),
            r,
          };
          if (!canPlace(item, cand, placed, itemsById, null, EDIT_MODE.BAG_LAYER)) continue;
          if (requireAll) {
            if (!footprintFitsRemaining(item, cand, remaining)) continue;
          } else if (footprintOverlap(item, cand, remaining) < minOverlap) {
            continue;
          }
          const paint = await paintScore(item, cand);
          if (paint > BAG_PAINT_MAX) continue;
          if (
            !best ||
            paintBetter(paint, best.paint, preferIdx(item), preferIdx(best.item)) < 0
          ) {
            best = { item, ...cand, paint };
          }
          // Exact pose good enough — skip further nudges for this face.
          if (dx === 0 && dy === 0 && paint <= BAG_PAINT_MAX * 0.7) break;
        }
      }
    }
    return best;
  }

  // Pass A: detector bag hints → NMS → paint-gated geometric snap
  // (bagHints already built above for mask clipping)

  const GEO_CONF = 0.35;
  const SPAM_BAG_NAMES = new Set([
    'Stamina Sack',
    'Storage Coffin',
    'Bag of Giving',
    'Box of Cogs',
    'Puzzlebag of Improvement',
    'Puzzlebag of Energy',
  ]);
  let paintAAccepted = 0;
  let paintALookalikeSwaps = 0;
  let paintAGeo = 0;
  let paintARejectPaint = 0;
  for (const hint of bagHints) {
    const primary = itemsById.get(String(hint.id));
    if (!primary) continue;
    const conf = Number(hint.confidence) || 0;
    const pName = String(primary.name || '');
    // After core bags land, ignore mid-conf spam classes (Stamina FP on pine).
    if (SPAM_BAG_NAMES.has(pName) && conf < 0.93 && paintAAccepted >= 4) continue;
    const cx = (hint.box.cx - originX) / cellW;
    const cy = (hint.box.cy - originY) / cellH;
    const boxLeft = (hint.box.cx - hint.box.w / 2 - originX) / cellW;
    const boxTop = (hint.box.cy - hint.box.h / 2 - originY) / cellH;
    const boxW = hint.box.w / cellW;
    const boxH = hint.box.h / cellH;

    if (conf >= GEO_CONF) {
      /** @type {{ x: number, y: number, r: number, err: number, item: object, paint: number }[]} */
      const geos = [];
      const cands = candsForHint(primary);
      for (const item of cands) {
        for (const r of [0, 1, 2, 3]) {
          const body = bodyBounds(shapeForItem(item, r));
          // Prefer top-left snap from detector box (better for tall belts than center).
          const seeds = [
            [Math.round(boxLeft), Math.round(boxTop)],
            [Math.round(cx - body.w / 2), Math.round(cy - body.h / 2)],
          ];
          for (const [sx, sy] of seeds) {
            for (const [dx, dy] of [
              [0, 0],
              [-1, 0],
              [1, 0],
              [0, -1],
              [0, 1],
            ]) {
              const cand = {
                x: Math.max(0, Math.min(BOARD_COLS - body.w, sx + dx)),
                y: Math.max(0, Math.min(BOARD_ROWS - body.h, sy + dy)),
                r,
              };
              if (!canPlace(item, cand, placed, itemsById, null, EDIT_MODE.BAG_LAYER)) continue;
              // Strong detector hints may sit under items (non-fabric cells) — don't require full mask.
              if (conf < 0.45 && !footprintFitsRemaining(item, cand, remaining)) continue;
              const aspectErr = Math.abs(body.w - boxW) + Math.abs(body.h - boxH);
              const centerErr =
                Math.abs(cx - (cand.x + body.w / 2)) + Math.abs(cy - (cand.y + body.h / 2));
              const cornerErr = Math.abs(boxLeft - cand.x) + Math.abs(boxTop - cand.y);
              const primaryBoost = item === primary ? 0 : 0.25;
              geos.push({
                ...cand,
                err: cornerErr * 0.55 + centerErr * 0.35 + aspectErr * 0.35 + primaryBoost,
                item,
                paint: Infinity,
              });
            }
          }
        }
      }
      geos.sort((a, b) => a.err - b.err);
      const top = geos.slice(0, 6);
      // Paint only ranks lookalikes / ties — items on fabric make absolute paint scores unreliable.
      for (const g of top) {
        g.paint = await paintScore(g.item, { x: g.x, y: g.y, r: g.r });
      }
      top.sort((a, b) => {
        const sameId = String(a.item.id) === String(b.item.id);
        if (!sameId && Math.abs(a.paint - b.paint) > 8) return a.paint - b.paint;
        return a.err - b.err || a.paint - b.paint;
      });
      // Prefer detector primary when err is close.
      const primaryTop = top.filter((g) => String(g.item.id) === String(primary.id));
      const geo =
        (primaryTop.length && primaryTop[0].err <= (top[0]?.err ?? 99) + 0.35
          ? primaryTop[0]
          : top[0]) || null;
      const minOv = conf >= 0.45 ? 0 : HINT_OVERLAP;
      if (geo && tryAccept(geo.item, geo.x, geo.y, geo.r, conf, minOv, false)) {
        paintAAccepted += 1;
        paintAGeo += 1;
        if (String(geo.item.id) !== String(primary.id)) paintALookalikeSwaps += 1;
        continue;
      }
      if (!geo && top.length) paintARejectPaint += 1;
    }

    const body0 = bodyBounds(shapeForItem(primary, 0));
    const bx = Math.round(cx - body0.w / 2);
    const by = Math.round(cy - body0.h / 2);
    const pick = await bestPainted(candsForHint(primary), bx, by, HINT_OVERLAP, false);
    if (!pick) continue;
    if (
      tryAccept(pick.item, pick.x, pick.y, pick.r, conf || 0.5, HINT_OVERLAP, false)
    ) {
      paintAAccepted += 1;
      if (String(pick.item.id) !== String(primary.id)) paintALookalikeSwaps += 1;
    }
  }
  console.info(
    '[screenshot] bags paintA',
    `accepted=${paintAAccepted}`,
    `geo=${paintAGeo}`,
    `nms=${bagHints.length}/${rawHints.length}`,
    `paintReject=${paintARejectPaint}`,
    `lookalike swaps=${paintALookalikeSwaps}`,
  );

  // When the bag model has a clean set, do not invent bags from parchment fabric.
  const detectorLed =
    bagHints.length >= 3 &&
    paintAAccepted >= Math.max(2, Math.ceil(bagHints.length * 0.75));

  // Pass B: residual cover with Leather Bag only (no type paint / no Purse invent)
  if (!detectorLed) {
  const bagsByArea = allBags
    .filter((item) => preferIdx(item) < 99)
    .map((item) => ({ item, area: shapeForItem(item, 0).body.length }))
    .sort(
      (a, b) =>
        preferIdx(a.item) - preferIdx(b.item) || b.area - a.area,
    );

  let guard = 0;
  while (remaining.size > 0 && guard++ < 60) {
    /** @type {{ item: object, x: number, y: number, r: number, cover: number } | null} */
    let geo = null;
    const seeds = [...remaining];
    for (const { item, area } of bagsByArea) {
      if (area > remaining.size) continue;
      if (area <= 1 && bagsByArea.some((b) => b.area > 1 && b.area <= remaining.size)) {
        const anyLargerFits = bagsByArea.some(
          (b) => b.area > 1 && canFitAnywhere(b.item, remaining, placed, itemsById),
        );
        if (anyLargerFits) continue;
      }
      for (const r of [0, 1, 2, 3]) {
        const body = bodyBounds(shapeForItem(item, r));
        for (const key of seeds) {
          if (!remaining.has(key)) continue;
          const [cs, rs] = key.split(',');
          const col = Number(cs);
          const row = Number(rs);
          for (let dx = 0; dx < body.w; dx++) {
            for (let dy = 0; dy < body.h; dy++) {
              const ox = col - dx;
              const oy = row - dy;
              if (ox < 0 || oy < 0 || ox + body.w > BOARD_COLS || oy + body.h > BOARD_ROWS) {
                continue;
              }
              const cand = { x: ox, y: oy, r };
              if (!canPlace(item, cand, placed, itemsById, null, EDIT_MODE.BAG_LAYER)) continue;
              if (!footprintFitsRemaining(item, cand, remaining)) continue;
              const cover = placementBodyCells(item, cand).length;
              if (!geo || cover > geo.cover) geo = { item, ...cand, cover };
            }
          }
        }
      }
    }
    if (!geo) break;
    if (!tryAccept(geo.item, geo.x, geo.y, geo.r, 0.35, 1, true)) break;
  }
  } else {
    console.info(
      '[screenshot] bags passB skip',
      `detectorLed paintA=${paintAAccepted}/${bagHints.length}`,
      maskClipped ? 'maskClipped' : 'maskOk',
    );
  }

  const merged0 =
    detectorLed || paintAAccepted >= 6
      ? bagsOut.slice()
      : mergeSmallBags(bagsOut, allBags, itemsById);
  const merged = completeLeatherBagLattice(merged0, itemsById);
  const covered = mask.size - remaining.size;
  console.info(
    '[screenshot] bags',
    `mask=${mask.size}`,
    `covered=${covered}`,
    `n=${merged.length}`,
    `merged=${bagsOut.length - merged0.length}`,
    detectorLed || paintAAccepted >= 6 ? 'merge=off' : 'merge=on',
    metrics === refined ? 'cell-from-boxes' : 'cell-from-grid',
  );
  return { bags: merged, mask, covered, ok: merged.length > 0, metrics };
}
