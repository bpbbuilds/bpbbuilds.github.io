/**
 * In-browser YOLO screenshot detector (onnxruntime-web).
 * Soft prior for solveBoardPuzzle — not final placements.
 */

import { pxToCell } from './screenshot-grid.js?v=grid97';

const BOARD_COLS = 9;
const BOARD_ROWS = 7;

/** Pass A / placeFromDetections bag floor — keep near bags-v1 ORT default (0.12). */
export const MIN_CONF_BAG = 0.15;

/** @type {import('onnxruntime-web').InferenceSession | null} */
let session = null;
/** @type {{ version: string, inputSize: number, url: string, classesUrl: string } | null} */
let manifest = null;
/** @type {{ index: number, id: string, name: string, type?: string }[] | null} */
let classes = null;
/** @type {Promise<void> | null} */
let loadPromise = null;

/** @type {import('onnxruntime-web').InferenceSession | null} */
let bagSession = null;
/** @type {{ version: string, inputSize: number, url: string, classesUrl: string } | null} */
let bagManifest = null;
/** @type {{ index: number, id: string, name: string, type?: string }[] | null} */
let bagClasses = null;
/** @type {Promise<void> | null} */
let bagLoadPromise = null;

/**
 * @param {string} root
 */
function assetRoot(root) {
  const r = root || '/';
  return r.endsWith('/') ? r : `${r}/`;
}

/**
 * Resolve a site-relative path against the page URL.
 * ORT resolves relative wasmPaths against its own script URL — so `../assets/ml/ort/`
 * from `/create/` becomes `/assets/ml/assets/ml/ort/` if left relative. Always absolute.
 * @param {string} root
 * @param {string} rel  e.g. `assets/ml/ort/` (no leading slash preferred)
 */
function absUrl(root, rel) {
  const base = new URL(assetRoot(root), window.location.href);
  const path = String(rel || '').replace(/^\//, '');
  return new URL(path, base).href;
}

/**
 * Load ORT from vendored assets (GH Pages, no bundler).
 * @param {string} root
 */
async function loadOrt(root) {
  if (globalThis.ort?.InferenceSession) return globalThis.ort;
  const ortDir = absUrl(root, 'assets/ml/ort/');
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${ortDir}ort.min.js`;
    s.async = true;
    s.onload = () => resolve(undefined);
    s.onerror = () => reject(new Error('Failed to load onnxruntime-web'));
    document.head.appendChild(s);
  });
  const ort = globalThis.ort;
  if (!ort) throw new Error('onnxruntime-web missing after script load');
  // Must be absolute — relative paths are resolved from the ORT script location.
  ort.env.wasm.wasmPaths = ortDir;
  return ort;
}

/**
 * @param {string} root
 */
export async function ensureDetector(root = '/') {
  if (session && classes) return { session, classes, manifest };
  if (loadPromise) {
    await loadPromise;
    return { session, classes, manifest };
  }
  loadPromise = (async () => {
    const manRes = await fetch(absUrl(root, 'assets/data/detector-manifest.json'), {
      cache: 'no-cache',
    });
    if (!manRes.ok) throw new Error('Detector manifest missing');
    manifest = await manRes.json();
    const classesUrl = String(manifest.classesUrl || '').startsWith('http')
      ? manifest.classesUrl
      : absUrl(
          root,
          String(manifest.classesUrl || 'assets/data/detector-classes.json').replace(/^\//, ''),
        );
    const clsRes = await fetch(classesUrl);
    if (!clsRes.ok) throw new Error('Detector classes missing');
    const clsJson = await clsRes.json();
    classes = Array.isArray(clsJson.classes) ? clsJson.classes : [];

    const ort = await loadOrt(root);
    let modelUrl = String(manifest.url || '');
    if (modelUrl.startsWith('file:')) {
      modelUrl = absUrl(
        root,
        `assets/ml/screenshot-detector/${manifest.version || 'v1'}/screenshot-detector.onnx`,
      );
    } else if (modelUrl.startsWith('/')) {
      modelUrl = absUrl(root, modelUrl.replace(/^\//, ''));
    } else if (!/^https?:/i.test(modelUrl)) {
      modelUrl = absUrl(root, modelUrl);
    }
    session = await ort.InferenceSession.create(modelUrl, {
      executionProviders: ['wasm'],
    });
  })();
  try {
    await loadPromise;
  } catch (err) {
    loadPromise = null;
    session = null;
    throw err;
  }
  return { session, classes, manifest };
}

/**
 * Optional bag-only detector (bags-v1). Returns null fields if manifest missing.
 * @param {string} root
 */
export async function ensureBagDetector(root = '/') {
  if (bagSession && bagClasses) return { session: bagSession, classes: bagClasses, manifest: bagManifest };
  if (bagLoadPromise) {
    await bagLoadPromise;
    return { session: bagSession, classes: bagClasses, manifest: bagManifest };
  }
  bagLoadPromise = (async () => {
    const manRes = await fetch(absUrl(root, 'assets/data/detector-bag-manifest.json'), {
      cache: 'no-cache',
    });
    if (!manRes.ok) {
      bagSession = null;
      bagClasses = null;
      bagManifest = null;
      return;
    }
    bagManifest = await manRes.json();
    const classesUrl = String(bagManifest.classesUrl || '').startsWith('http')
      ? bagManifest.classesUrl
      : absUrl(
          root,
          String(bagManifest.classesUrl || 'assets/data/detector-bag-classes.json').replace(
            /^\//,
            '',
          ),
        );
    const clsRes = await fetch(classesUrl);
    if (!clsRes.ok) throw new Error('Bag detector classes missing');
    const clsJson = await clsRes.json();
    bagClasses = Array.isArray(clsJson.classes) ? clsJson.classes : [];

    const ort = await loadOrt(root);
    let modelUrl = String(bagManifest.url || '');
    if (modelUrl.startsWith('file:')) {
      modelUrl = absUrl(
        root,
        `assets/ml/screenshot-detector/${bagManifest.version || 'bags-v1'}/screenshot-detector-bags.onnx`,
      );
    } else if (modelUrl.startsWith('/')) {
      modelUrl = absUrl(root, modelUrl.replace(/^\//, ''));
    } else if (!/^https?:/i.test(modelUrl)) {
      modelUrl = absUrl(root, modelUrl);
    }
    bagSession = await ort.InferenceSession.create(modelUrl, {
      executionProviders: ['wasm'],
    });
  })();
  try {
    await bagLoadPromise;
  } catch (err) {
    bagLoadPromise = null;
    bagSession = null;
    bagClasses = null;
    bagManifest = null;
    console.warn('[screenshot] bag detector unavailable', err);
  }
  return { session: bagSession, classes: bagClasses, manifest: bagManifest };
}

/**
 * @returns {boolean}
 */
export function hasBagDetector() {
  return Boolean(bagSession && bagClasses?.length);
}

/**
 * Letterbox RGB image into NCHW float32 [1,3,S,S] (0–1).
 * @param {ImageData} imageData
 * @param {number} size
 */
function letterbox(imageData, size) {
  const { width: w, height: h, data } = imageData;
  const scale = Math.min(size / w, size / h);
  const nw = Math.round(w * scale);
  const nh = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d');
  if (!tctx) throw new Error('Canvas unavailable');
  tctx.putImageData(imageData, 0, 0);
  const padX = ((size - nw) / 2) | 0;
  const padY = ((size - nh) / 2) | 0;
  ctx.drawImage(tmp, 0, 0, w, h, padX, padY, nw, nh);
  const out = ctx.getImageData(0, 0, size, size);
  const float = new Float32Array(3 * size * size);
  const plane = size * size;
  for (let i = 0, p = 0; i < out.data.length; i += 4, p++) {
    float[p] = out.data[i] / 255;
    float[p + plane] = out.data[i + 1] / 255;
    float[p + 2 * plane] = out.data[i + 2] / 255;
  }
  return { tensor: float, scale, padX, padY, size };
}

/**
 * @param {Float32Array|number[]} data
 * @param {number[]} dims
 * @param {number} confThresh
 * @param {number} nc
 */
function decodeYolo(data, dims, confThresh, nc) {
  // YOLOv8 export: [1, 4+nc, N] or [1, N, 4+nc]
  let num;
  let transposed;
  if (dims.length === 3 && dims[1] === 4 + nc) {
    num = dims[2];
    transposed = true;
  } else if (dims.length === 3 && dims[2] === 4 + nc) {
    num = dims[1];
    transposed = false;
  } else if (dims.length === 2) {
    // [4+nc, N] or [N, 4+nc]
    if (dims[0] === 4 + nc) {
      num = dims[1];
      transposed = true;
    } else {
      num = dims[0];
      transposed = false;
    }
  } else {
    return [];
  }

  /** @type {{ cx: number, cy: number, w: number, h: number, score: number, cls: number }[]} */
  const boxes = [];
  const stride = 4 + nc;
  for (let i = 0; i < num; i++) {
    let bx;
    let by;
    let bw;
    let bh;
    let best = 0;
    let bestCls = 0;
    if (transposed) {
      bx = data[0 * num + i];
      by = data[1 * num + i];
      bw = data[2 * num + i];
      bh = data[3 * num + i];
      for (let c = 0; c < nc; c++) {
        const s = data[(4 + c) * num + i];
        if (s > best) {
          best = s;
          bestCls = c;
        }
      }
    } else {
      const o = i * stride;
      bx = data[o];
      by = data[o + 1];
      bw = data[o + 2];
      bh = data[o + 3];
      for (let c = 0; c < nc; c++) {
        const s = data[o + 4 + c];
        if (s > best) {
          best = s;
          bestCls = c;
        }
      }
    }
    if (best < confThresh) continue;
    boxes.push({ cx: bx, cy: by, w: bw, h: bh, score: best, cls: bestCls });
  }
  return boxes;
}

/**
 * @param {{ cx: number, cy: number, w: number, h: number, score: number, cls: number }[]} boxes
 * @param {number} iouThresh
 */
function nms(boxes, iouThresh = 0.45) {
  const sorted = boxes.slice().sort((a, b) => b.score - a.score);
  /** @type {typeof boxes} */
  const keep = [];
  const used = new Set();
  for (let i = 0; i < sorted.length; i++) {
    if (used.has(i)) continue;
    keep.push(sorted[i]);
    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(j)) continue;
      if (sorted[i].cls !== sorted[j].cls) continue;
      if (iou(sorted[i], sorted[j]) > iouThresh) used.add(j);
    }
  }
  return keep;
}

function iou(a, b) {
  const ax1 = a.cx - a.w / 2;
  const ay1 = a.cy - a.h / 2;
  const ax2 = a.cx + a.w / 2;
  const ay2 = a.cy + a.h / 2;
  const bx1 = b.cx - b.w / 2;
  const by1 = b.cy - b.h / 2;
  const bx2 = b.cx + b.w / 2;
  const by2 = b.cy + b.h / 2;
  const ix1 = Math.max(ax1, bx1);
  const iy1 = Math.max(ay1, by1);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  const uni = a.w * a.h + b.w * b.h - inter;
  return uni > 0 ? inter / uni : 0;
}

/** Eval-only switch; default imports remain whole-crop and manifest-driven. */
function evalTilesEnabled() {
  try {
    return new URLSearchParams(window.location.search).get('evalTiles') === '1';
  } catch {
    return false;
  }
}

/** Run overlapping native-crop tiles while preserving crop pixel coordinates. */
async function inferTiled(canvas, sess, size, nc, conf, grid) {
  const w = canvas.width;
  const h = canvas.height;
  const cw = Number(grid?.cellW) > 0 ? Number(grid.cellW) : w / 9;
  const ch = Number(grid?.cellH) > 0 ? Number(grid.cellH) : h / 7;
  // Six-by-five cells with one-cell overlap keeps the native item scale while
  // keeping large captures (for example 12x7) within a practical pass count.
  const tileW = Math.max(32, Math.min(w, Math.round(cw * 6)));
  const tileH = Math.max(32, Math.min(h, Math.round(ch * 5)));
  const strideW = Math.max(16, Math.round(cw * 5));
  const strideH = Math.max(16, Math.round(ch * 4));
  const xs = [];
  const ys = [];
  for (let x = 0; ; x += strideW) {
    xs.push(Math.min(x, Math.max(0, w - tileW)));
    if (x + tileW >= w) break;
  }
  for (let y = 0; ; y += strideH) {
    ys.push(Math.min(y, Math.max(0, h - tileH)));
    if (y + tileH >= h) break;
  }
  const all = [];
  for (const x of [...new Set(xs)]) {
    for (const y of [...new Set(ys)]) {
      const tile = document.createElement('canvas');
      tile.width = Math.min(tileW, w - x);
      tile.height = Math.min(tileH, h - y);
      const tctx = tile.getContext('2d', { willReadFrequently: true });
      if (!tctx) continue;
      tctx.drawImage(canvas, x, y, tile.width, tile.height, 0, 0, tile.width, tile.height);
      const boxes = await inferCanvas(sess, tile, size, nc, conf);
      for (const b of boxes) all.push({ ...b, cx: b.cx + x, cy: b.cy + y });
    }
  }
  return nms(all, 0.45);
}

/**
 * @param {string} dataUrl  bag crop
 * @param {{
 *   root?: string,
 *   grid?: import('./screenshot-grid.js').BagGrid | null,
 *   conf?: number,
 *   rotationTta?: boolean,
 * }} [opts]
 * @returns {Promise<{ id: string, name: string, x: number, y: number, r: number, confidence: number, sizeW: number, sizeH: number }[]>}
 */
/**
 * One inference pass; boxes in the given canvas's pixel space.
 * @param {import('onnxruntime-web').InferenceSession} sess
 * @param {HTMLCanvasElement} canvas
 * @param {number} size
 * @param {number} nc
 * @param {number} conf
 */
async function inferCanvas(sess, canvas, size, nc, conf) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { tensor, scale, padX, padY } = letterbox(imageData, size);
  const ort = globalThis.ort;
  const out = await sess.run({
    [sess.inputNames[0]]: new ort.Tensor('float32', tensor, [1, 3, size, size]),
  });
  const outTensor = out[sess.outputNames[0]];
  const raw = decodeYolo(outTensor.data, outTensor.dims.map(Number), conf, nc);
  return nms(raw, 0.45).map((b) => ({
    cls: b.cls,
    score: b.score,
    cx: (b.cx - padX) / scale,
    cy: (b.cy - padY) / scale,
    w: b.w / scale,
    h: b.h / scale,
  }));
}

/**
 * @param {HTMLImageElement} img
 * @param {boolean} rotateCw  draw rotated 90° clockwise
 */
function imageToCanvas(img, rotateCw) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement('canvas');
  canvas.width = rotateCw ? h : w;
  canvas.height = rotateCw ? w : h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');
  if (rotateCw) {
    ctx.translate(h, 0);
    ctx.rotate(Math.PI / 2);
  }
  ctx.drawImage(img, 0, 0);
  return canvas;
}

export async function detectScreenshotItems(dataUrl, opts = {}) {
  const root = opts.root || '/';
  const t0 = performance.now();
  const { session: sess, classes: cls, manifest: man } = await ensureDetector(root);
  if (!sess || !cls?.length || !man) throw new Error('Detector unavailable');

  const items = await detectWithSession(dataUrl, {
    root,
    grid: opts.grid,
    conf: opts.conf,
    rotationTta: opts.rotationTta,
    session: sess,
    classes: cls,
    manifest: man,
    logTag: 'detector',
    tiled: evalTilesEnabled(),
  });
  console.info(
    '[screenshot] detector',
    `n=${items.length}`,
    `ms=${(performance.now() - t0).toFixed(0)}`,
  );
  return items;
}

/**
 * Bag-only detections (empty array if bags-v1 not published yet).
 * @param {string} dataUrl
 * @param {{
 *   root?: string,
 *   grid?: import('./screenshot-grid.js').BagGrid | null,
 *   conf?: number,
 *   rotationTta?: boolean,
 * }} [opts]
 */
export async function detectScreenshotBags(dataUrl, opts = {}) {
  const root = opts.root || '/';
  const t0 = performance.now();
  const { session: sess, classes: cls, manifest: man } = await ensureBagDetector(root);
  if (!sess || !cls?.length || !man) return [];
  const items = await detectWithSession(dataUrl, {
    root,
    grid: opts.grid,
    conf: opts.conf ?? 0.12,
    rotationTta: opts.rotationTta !== false,
    session: sess,
    classes: cls,
    manifest: man,
    logTag: 'bag-detector',
  });
  console.info(
    '[screenshot] bag-detector',
    `n=${items.length}`,
    `ms=${(performance.now() - t0).toFixed(0)}`,
  );
  return items;
}

/**
 * @param {string} dataUrl
 * @param {{
 *   root?: string,
 *   grid?: import('./screenshot-grid.js').BagGrid | null,
 *   conf?: number,
 *   rotationTta?: boolean,
 *   session: import('onnxruntime-web').InferenceSession,
 *   classes: { index: number, id: string, name: string }[],
 *   manifest: { inputSize?: number },
 *   logTag?: string,
 *   tiled?: boolean,
 * }} opts
 */
async function detectWithSession(dataUrl, opts) {
  const img = await loadHtmlImage(dataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const size = Number(opts.manifest.inputSize) || 640;
  const nc = opts.classes.length;
  const conf = opts.conf ?? 0.25;
  const sess = opts.session;
  const cls = opts.classes;

  const baseCanvas = imageToCanvas(img, false);
  const kept = opts.tiled
    ? await inferTiled(baseCanvas, sess, size, nc, conf, opts.grid)
    : await inferCanvas(sess, baseCanvas, size, nc, conf);
  let rotAdded = 0;
  if (opts.rotationTta !== false) {
    const rotCanvas = imageToCanvas(img, true);
    const rot = opts.tiled
      ? await inferTiled(rotCanvas, sess, size, nc, conf, {
          cellW: opts.grid?.cellH,
          cellH: opts.grid?.cellW,
        })
      : await inferCanvas(sess, rotCanvas, size, nc, conf);
    for (const b of rot) {
      const mapped = { cls: b.cls, score: b.score, cx: b.cy, cy: h - b.cx, w: b.h, h: b.w };
      const same = kept.find((k) => k.cls === mapped.cls && iou(k, mapped) > 0.5);
      if (same) {
        same.score = Math.max(same.score, mapped.score);
        continue;
      }
      kept.push(mapped);
      rotAdded += 1;
    }
  }

  const grid = opts.grid;
  /** @type {{ id: string, name: string, x: number, y: number, r: number, confidence: number, sizeW: number, sizeH: number, box: { cx: number, cy: number, w: number, h: number } }[]} */
  const items = [];
  for (const b of kept) {
    const meta = cls.find((c) => c.index === b.cls) || cls[b.cls];
    if (!meta) continue;
    const { cx, cy } = b;
    const bw = b.w;
    const bh = b.h;
    let col;
    let row;
    if (grid?.ok && grid.cellW > 0 && grid.cellH > 0) {
      const cell = pxToCell({ ...grid, originX: 0, originY: 0 }, cx, cy);
      col = cell.col;
      row = cell.row;
    } else {
      col = Math.floor((cx / w) * BOARD_COLS);
      row = Math.floor((cy / h) * BOARD_ROWS);
    }
    col = Math.max(0, Math.min(BOARD_COLS - 1, col));
    row = Math.max(0, Math.min(BOARD_ROWS - 1, row));
    const cellW = grid?.ok && grid.cellW > 0 ? grid.cellW : w / BOARD_COLS;
    const cellH = grid?.ok && grid.cellH > 0 ? grid.cellH : h / BOARD_ROWS;
    const sizeW = Math.max(1, Math.round(bw / cellW));
    const sizeH = Math.max(1, Math.round(bh / cellH));
    items.push({
      id: String(meta.id),
      name: String(meta.name),
      x: col,
      y: row,
      r: 0,
      confidence: b.score,
      sizeW,
      sizeH,
      box: { cx, cy, w: bw, h: bh },
    });
  }
  if (rotAdded) {
    console.info(`[screenshot] ${opts.logTag || 'detect'} rot+${rotAdded}`);
  }
  return items;
}

/**
 * @param {string} dataUrl
 * @returns {Promise<HTMLImageElement>}
 */
function loadHtmlImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode crop'));
    img.src = dataUrl;
  });
}

/**
 * @returns {boolean}
 */
export function wantEdgeVisionFallback() {
  try {
    const q = new URLSearchParams(window.location.search);
    return q.get('vision') === 'edge';
  } catch {
    return false;
  }
}
