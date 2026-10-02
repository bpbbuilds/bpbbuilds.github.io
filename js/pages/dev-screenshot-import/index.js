/**
 * Dev sandbox — run importScreenshotFile() on an uploaded image and paint the result.
 * Exposes window.__stbResult for scripts/screenshot-eval/run.mjs.
 */

import { SCREENSHOT_IMPORT_ENABLED } from '../../shared/feature-flags.js';
import { loadCachedImage } from '../../shared/board-still/cache.js';
import { paintBoardForCompare } from '../../shared/board-still/paint-compare.js';
import {
  BOARD_COLS,
  BOARD_ROWS,
  isBagItem,
  placementBodyCells,
} from '../create/collision.js';
import { createEditorState } from '../create/editor-state.js';
import { loadCreateCatalog } from '../create/load-catalog.js';
import { fileToDataUrl, importScreenshotFile } from '../create/screenshot-apply.js?v=grid97';
import { cropGridMetrics } from '../create/screenshot-bags.js?v=grid97';
import { preprocessScreenshotForVision } from '../create/screenshot-preprocess.js?v=grid97';
import { detectScreenshotBags, detectScreenshotItems } from '../../shared/screenshot-detector.js?v=grid97';

if (!SCREENSHOT_IMPORT_ENABLED) {
  window.location.replace('../../create/');
}

const CELL_PX = 64;
const root = document.body.dataset.root || '/';
const fileEl = /** @type {HTMLInputElement} */ (document.getElementById('stb-file'));
const statusEl = document.getElementById('stb-status');
const shotEl = /** @type {HTMLImageElement} */ (document.getElementById('stb-shot'));
const boardEl = /** @type {HTMLCanvasElement} */ (document.getElementById('stb-board'));
const logEl = document.getElementById('stb-log');

/** @type {string[]} */
const logs = [];
const origInfo = console.info.bind(console);
const origWarn = console.warn.bind(console);
const capture = (orig) => (...args) => {
  const line = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  if (line.startsWith('[screenshot]')) {
    logs.push(line);
    if (logEl) logEl.textContent = logs.join('\n');
  }
  orig(...args);
};
console.info = capture(origInfo);
console.warn = capture(origWarn);

const setStatus = (t) => {
  if (statusEl) statusEl.textContent = t;
};

/**
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 */
async function paintResult(placements, itemsById) {
  const { canvas } = await paintBoardForCompare({
    placements,
    itemsById,
    cellPx: CELL_PX,
    cols: BOARD_COLS,
    rows: BOARD_ROWS,
    root,
    loadImage: loadCachedImage,
  });
  boardEl.width = canvas.width;
  boardEl.height = canvas.height;
  const ctx = boardEl.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#2a1a12';
  ctx.fillRect(0, 0, boardEl.width, boardEl.height);
  ctx.drawImage(canvas, 0, 0);
  ctx.strokeStyle = 'rgba(255,236,220,0.25)';
  for (let c = 0; c <= BOARD_COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL_PX, 0);
    ctx.lineTo(c * CELL_PX, BOARD_ROWS * CELL_PX);
    ctx.stroke();
  }
  for (let r = 0; r <= BOARD_ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL_PX);
    ctx.lineTo(BOARD_COLS * CELL_PX, r * CELL_PX);
    ctx.stroke();
  }
  ctx.font = '11px sans-serif';
  ctx.textBaseline = 'top';
  for (const p of placements) {
    const item = itemsById.get(p.id);
    if (!item || isBagItem(item)) continue;
    const label = `${String(item.name || p.id).slice(0, 14)} r${p.r || 0}`;
    const x = p.x * CELL_PX + 2;
    const y = p.y * CELL_PX + 2;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x, y, ctx.measureText(label).width + 4, 13);
    ctx.fillStyle = '#ffecdc';
    ctx.fillText(label, x + 2, y);
  }
  boardEl.hidden = false;
}

/**
 * Raw detector boxes in board-cell units (second pass; dev only).
 * @param {File} file
 */
async function rawDetections(file) {
  const pre = await preprocessScreenshotForVision(await fileToDataUrl(file));
  const dets = await detectScreenshotItems(pre.dataUrl, { root, grid: pre.grid, conf: 0.1 });
  const tiledEval = new URLSearchParams(window.location.search).get('evalTiles') === '1';
  const orig = tiledEval
    ? []
    : await detectScreenshotItems(pre.dataUrl, {
        root,
        grid: pre.grid,
        conf: 0.1,
        rotationTta: false,
      });
  const bagDets = await detectScreenshotBags(pre.dataUrl, {
    root,
    grid: pre.grid,
    conf: 0.12,
  });
  const img = await loadCachedImage(pre.dataUrl, { anonymous: false });
  const m = cropGridMetrics(
    pre.grid,
    img.naturalWidth || img.width,
    img.naturalHeight || img.height,
  );
  const inOrig = (d) =>
    orig.some(
      (o) =>
        o.id === d.id &&
        Math.abs(o.box.cx - d.box.cx) < 2 &&
        Math.abs(o.box.cy - d.box.cy) < 2,
    );
  const mapDet = (d, pass) => ({
    pass,
    name: d.name || d.id,
    x: Number.isFinite(Number(d.x)) ? Number(d.x) : null,
    y: Number.isFinite(Number(d.y)) ? Number(d.y) : null,
    conf: Number((Number(d.confidence) || 0).toFixed(3)),
    col: d.box ? Number(((d.box.cx - m.originX) / m.cellW).toFixed(2)) : null,
    row: d.box ? Number(((d.box.cy - m.originY) / m.cellH).toFixed(2)) : null,
    w: d.box ? Number((d.box.w / m.cellW).toFixed(2)) : null,
    h: d.box ? Number((d.box.h / m.cellH).toFixed(2)) : null,
  });
  return {
    items: dets.map((d) => mapDet(d, d.box && inOrig(d) ? 'orig' : 'rot')),
    bags: bagDets.map((d) => mapDet(d, 'bag')),
  };
}

async function main() {
  const { itemsById, getSpriteUrl } = await loadCreateCatalog(root);
  setStatus('Ready — choose a screenshot.');
  window.__stbReady = true;

  fileEl.addEventListener('change', () => {
    const file = fileEl.files?.[0];
    if (!file) return;
    void (async () => {
      logs.length = 0;
      window.__stbResult = undefined;
      shotEl.src = URL.createObjectURL(file);
      shotEl.hidden = false;
      setStatus('Importing…');
      const state = createEditorState();
      const t0 = performance.now();
      try {
        await importScreenshotFile({
          state,
          itemsById,
          getSpriteUrl,
          root,
          file,
          allowOffsizeGrid: true,
        });
        const ms = Math.round(performance.now() - t0);
        const placements = (state.getDraft().placements || []).map((p) => {
          const item = itemsById.get(p.id);
          return {
            id: p.id,
            name: String(item?.name || p.id),
            x: p.x,
            y: p.y,
            r: p.r || 0,
            bag: isBagItem(item),
            cells: placementBodyCells(item, p).map((c) => `${c.x},${c.y}`),
          };
        });
        await paintResult(state.getDraft().placements || [], itemsById);
        const raw = await rawDetections(file);
        setStatus(`Done in ${ms} ms — ${placements.length} placements.`);
        window.__stbResult = { placements, logs: logs.slice(), ms, raw };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus(`Error: ${msg}`);
        window.__stbResult = { placements: [], logs: logs.slice(), ms: 0, error: msg };
      }
    })();
  });
}

if (SCREENSHOT_IMPORT_ENABLED) {
  void main().catch((err) => {
    setStatus(`Catalog failed: ${err instanceof Error ? err.message : String(err)}`);
  });
}
