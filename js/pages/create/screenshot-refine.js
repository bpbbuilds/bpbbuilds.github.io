/**
 * Hill-climb board edits that improve paint-vs-screenshot color score.
 */

import { paintBoardForCompare } from '../../shared/board-still/paint-compare.js';
import { loadCachedImage } from '../../shared/board-still/cache.js';
import { lookalikesForName } from '../../shared/screenshot-confusion.js?v=fa3633b';
import { cropGridMetrics } from './screenshot-bags-mask.js?v=fa3633b';
import {
  bagMedianRgb,
  scorePaintVsShot,
} from '../../shared/screenshot-paint-score.js?v=fa3633b';
import { bodyBounds, shapeForItem } from '../../shared/backpack-grid/index.js';
import {
  BOARD_COLS,
  BOARD_ROWS,
  canPlace,
  isBagItem,
} from './collision.js';
import { EDIT_MODE } from './editor-state.js';

const MAX_EVALS = 40;
const MAX_STALE = 8;
/** Keep the hill-climb interactive; return the best board so far when exceeded. */
const REFINE_BUDGET_MS = 6000;

/**
 * @param {string} dataUrl
 * @returns {Promise<ImageData>}
 */
async function dataUrlToImageData(dataUrl) {
  const img = await loadCachedImage(dataUrl, { anonymous: false });
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, w, h);
}

/**
 * @param {object} item
 */
function footprintCells(item, r) {
  const face = ((Number(r) || 0) % 4 + 4) % 4;
  const b = bodyBounds(shapeForItem(item, face));
  return { w: b.w, h: b.h, area: b.w * b.h };
}

/**
 * @param {Map<string, object>} itemsById
 * @param {string} name
 */
function findByName(itemsById, name) {
  const want = String(name || '').toLowerCase();
  for (const item of itemsById.values()) {
    if (String(item.name || '').toLowerCase() === want) return item;
  }
  return null;
}

/**
 * @param {{ id: string, name?: string }[]} visionItems
 * @param {Map<string, object>} itemsById
 */
function buildBudget(visionItems, itemsById) {
  /** @type {Map<string, number>} */
  const budget = new Map();
  for (const v of visionItems) {
    const item = itemsById.get(v.id) || findByName(itemsById, v.name || '');
    if (!item || isBagItem(item)) continue;
    budget.set(String(item.id), (budget.get(String(item.id)) || 0) + 1);
  }
  return budget;
}

/**
 * Remaining prior slots after current board (exact ids).
 * @param {Map<string, number>} budget
 * @param {{ id: string }[]} board
 */
function remainingBudget(budget, board) {
  const rem = new Map(budget);
  for (const p of board) {
    const n = rem.get(p.id) || 0;
    if (n > 0) rem.set(p.id, n - 1);
  }
  return rem;
}

/**
 * @param {{
 *   cropDataUrl: string,
 *   grid: import('../../shared/screenshot-grid.js').BagGrid | null,
 *   items: { id: string, name?: string, x: number, y: number, r: number, score?: number }[],
 *   visionItems: { id: string, name?: string, x?: number, y?: number, r?: number }[],
 *   itemsById: Map<string, object>,
 *   getSpriteUrl?: (item: object) => string,
 *   root: string,
 *   draftPlacements?: object[],
 * }} opts
 */
export async function refinePaintCompare(opts) {
  const {
    cropDataUrl,
    grid,
    items: seedItems,
    visionItems,
    itemsById,
    root,
    draftPlacements = [],
  } = opts;

  if (!seedItems?.length) {
    return { items: [], score: null, improved: false };
  }

  const shot = await dataUrlToImageData(cropDataUrl);
  const leather = bagMedianRgb(shot);
  const metrics = cropGridMetrics(grid, shot.width, shot.height);
  const cellPx = Math.max(8, metrics.cellW);

  const bags = draftPlacements.filter((p) => {
    const it = itemsById.get(p.id);
    return it && isBagItem(it);
  });
  const editMode = bags.length ? EDIT_MODE.DEFAULT : EDIT_MODE.ITEM_LAYER;
  const budget = buildBudget(visionItems, itemsById);

  /** @type {{ id: string, name: string, x: number, y: number, r: number, score?: number }[]} */
  let board = seedItems.map((it) => ({
    id: it.id,
    name: it.name || itemsById.get(it.id)?.name || it.id,
    x: it.x,
    y: it.y,
    r: ((Number(it.r) || 0) % 4 + 4) % 4,
    score: it.score,
  }));

  const alignCanvas = document.createElement('canvas');
  alignCanvas.width = shot.width;
  alignCanvas.height = shot.height;
  const alignCtx = alignCanvas.getContext('2d', { willReadFrequently: true });
  if (!alignCtx) throw new Error('Canvas unavailable');

  /**
   * @param {typeof board} placements
   */
  async function evalBoard(placements) {
    if (!placements.length) {
      return {
        total: 1e9,
        covered: 1e9,
        unexplained: 1e9,
        coveredN: 0,
        unexplainedN: 0,
      };
    }
    const { canvas } = await paintBoardForCompare({
      placements,
      itemsById,
      cellPx,
      cols: BOARD_COLS,
      rows: BOARD_ROWS,
      root,
      loadImage: loadCachedImage,
    });
    alignCtx.clearRect(0, 0, shot.width, shot.height);
    alignCtx.drawImage(canvas, 0, 0, shot.width, shot.height);
    const paint = alignCtx.getImageData(0, 0, shot.width, shot.height);
    return scorePaintVsShot(shot, paint, { leather });
  }

  const t0 = performance.now();
  let bestScore = await evalBoard(board);
  const scoreBefore = { ...bestScore };
  let evals = 1;
  let stale = 0;
  let improved = false;

  /**
   * @param {typeof board} next
   */
  async function tryAccept(next) {
    if (evals >= MAX_EVALS) return false;
    if (performance.now() - t0 > REFINE_BUDGET_MS) {
      evals = MAX_EVALS;
      return false;
    }
    evals += 1;
    await new Promise((resolve) => setTimeout(resolve, 0));
    const sc = await evalBoard(next);
    if (sc.total < bestScore.total - 1e-6) {
      board = next;
      bestScore = sc;
      improved = true;
      stale = 0;
      return true;
    }
    stale += 1;
    return false;
  }

  /**
   * @param {number} idx
   * @param {Partial<{ id: string, name: string, x: number, y: number, r: number }>} patch
   */
  function cloneWith(idx, patch) {
    return board.map((p, i) => (i === idx ? { ...p, ...patch } : { ...p }));
  }

  function othersPlus(idx, candidate) {
    return [
      ...bags,
      ...board.filter((_, i) => i !== idx).map((p) => ({ ...p, key: p.id + p.x + p.y })),
      { ...candidate, key: 'cand' },
    ];
  }

  while (evals < MAX_EVALS && stale < MAX_STALE) {
    let moved = false;

    // 1–2: rotate / shift each item
    for (let i = 0; i < board.length && evals < MAX_EVALS && stale < MAX_STALE; i++) {
      const cur = board[i];
      const item = itemsById.get(cur.id);
      if (!item) continue;

      for (const dr of [-1, 1]) {
        const r = ((cur.r + dr) % 4 + 4) % 4;
        const cand = { ...cur, r };
        if (!canPlace(item, cand, othersPlus(i, cand), itemsById, null, editMode)) continue;
        if (await tryAccept(cloneWith(i, { r }))) {
          moved = true;
          break;
        }
      }
      if (moved) break;

      for (const dx of [-1, 0, 1]) {
        for (const dy of [-1, 0, 1]) {
          if (dx === 0 && dy === 0) continue;
          const x = Math.max(0, Math.min(BOARD_COLS - 1, cur.x + dx));
          const y = Math.max(0, Math.min(BOARD_ROWS - 1, cur.y + dy));
          if (x === cur.x && y === cur.y) continue;
          const cand = { ...cur, x, y };
          if (!canPlace(item, cand, othersPlus(i, cand), itemsById, null, editMode)) continue;
          if (await tryAccept(cloneWith(i, { x, y }))) {
            moved = true;
            break;
          }
        }
        if (moved) break;
      }
      if (moved) break;
    }
    if (moved) continue;

    // 3: lookalike swap (same or smaller footprint)
    for (let i = 0; i < board.length && evals < MAX_EVALS && stale < MAX_STALE; i++) {
      const cur = board[i];
      const item = itemsById.get(cur.id);
      if (!item) continue;
      const fp = footprintCells(item, cur.r);
      for (const name of lookalikesForName(cur.name)) {
        if (name === cur.name) continue;
        const alt = findByName(itemsById, name);
        if (!alt || isBagItem(alt)) continue;
        const afp = footprintCells(alt, cur.r);
        if (afp.area > fp.area) continue;
        const cand = { ...cur, id: String(alt.id), name: String(alt.name) };
        if (!canPlace(alt, cand, othersPlus(i, cand), itemsById, null, editMode)) continue;
        if (await tryAccept(cloneWith(i, { id: cand.id, name: cand.name }))) {
          moved = true;
          break;
        }
      }
      if (moved) break;
    }
    if (moved) continue;

    // 4: remove worst (prefer lowest vision score / last)
    if (board.length > 1 && evals < MAX_EVALS) {
      let worst = 0;
      let worstScore = Infinity;
      for (let i = 0; i < board.length; i++) {
        const s = Number(board[i].score);
        const rank = Number.isFinite(s) ? s : 0;
        if (rank < worstScore) {
          worstScore = rank;
          worst = i;
        }
      }
      const next = board.filter((_, i) => i !== worst).map((p) => ({ ...p }));
      if (await tryAccept(next)) {
        moved = true;
        continue;
      }
    }

    // 5: add unused prior budget at unexplained hotspot
    const rem = remainingBudget(budget, board);
    /** @type {string[]} */
    const unusedIds = [];
    for (const [id, n] of rem) {
      if (n > 0) unusedIds.push(id);
    }
    if (unusedIds.length && evals < MAX_EVALS) {
      // Unexplained centroid from last paint
      const { canvas } = await paintBoardForCompare({
        placements: board,
        itemsById,
        cellPx,
        cols: BOARD_COLS,
        rows: BOARD_ROWS,
        root,
        loadImage: loadCachedImage,
      });
      evals += 1;
      alignCtx.clearRect(0, 0, shot.width, shot.height);
      alignCtx.drawImage(canvas, 0, 0, shot.width, shot.height);
      const paint = alignCtx.getImageData(0, 0, shot.width, shot.height);
      let sx = 0;
      let sy = 0;
      let sn = 0;
      const pd = paint.data;
      const sd = shot.data;
      for (let y = 0; y < shot.height; y += 2) {
        for (let x = 0; x < shot.width; x += 2) {
          const i = (y * shot.width + x) * 4;
          if (pd[i + 3] >= 16) continue;
          const d =
            Math.abs(sd[i] - leather.r) +
            Math.abs(sd[i + 1] - leather.g) +
            Math.abs(sd[i + 2] - leather.b);
          if (d < 48) continue;
          sx += x;
          sy += y;
          sn += 1;
        }
      }
      if (sn > 8) {
        const px = sx / sn;
        const py = sy / sn;
        let col;
        let row;
        col = Math.floor((px - metrics.originX) / metrics.cellW);
        row = Math.floor((py - metrics.originY) / metrics.cellH);
        col = Math.max(0, Math.min(BOARD_COLS - 1, col));
        row = Math.max(0, Math.min(BOARD_ROWS - 1, row));

        for (const id of unusedIds) {
          const item = itemsById.get(id);
          if (!item) continue;
          const cand = {
            id,
            name: String(item.name || id),
            x: col,
            y: row,
            r: 0,
          };
          if (
            !canPlace(
              item,
              cand,
              [...bags, ...board.map((p) => ({ ...p, key: p.id }))],
              itemsById,
              null,
              editMode,
            )
          ) {
            continue;
          }
          if (await tryAccept([...board.map((p) => ({ ...p })), cand])) {
            moved = true;
            break;
          }
        }
      }
    }

    if (!moved) break;
  }

  console.info(
    '[screenshot] paint refine',
    `evals=${evals}`,
    `before=${scoreBefore.total.toFixed(1)}`,
    `after=${bestScore.total.toFixed(1)}`,
    improved ? 'improved' : 'no-change',
    `ms=${(performance.now() - t0).toFixed(0)}`,
  );

  return {
    items: board,
    score: bestScore,
    scoreBefore,
    improved,
  };
}
