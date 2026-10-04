/**
 * Transparent WebM export for the blob cast overlay.
 *
 * The export is rendered directly to an alpha canvas instead of recording the
 * admin iframe. This keeps the download transparent and makes the duration
 * deterministic for each animated view.
 */

import { bakeBlobFaceUrl } from '../../shared/blob-face.js';
import { loadBlobCast, normalizeOverlayView } from './blobs.js';

const EXPORT_WIDTH = 2560;
const EXPORT_HEIGHT = 1440;
const FPS = 30;
const FACE_BAKE_SIZE = 512;

/** @type {Record<string, number>} */
const LOOP_SECONDS = Object.freeze({
  row: 1,
  low: 1,
  pop: 8,
  walk: 22,
  'walk-names': 22,
  grid: 1,
  float: 7,
});

/**
 * @param {string} view
 */
export function blobLoopSeconds(view) {
  return LOOP_SECONDS[normalizeOverlayView(view)] || 1;
}

/**
 * @returns {string}
 */
function transparentWebmMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp09.00.10.08'];
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) || '';
}

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    if (!src.startsWith('data:')) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('A blob image could not be prepared for video export.'));
    image.src = src;
  });
}

/**
 * @param {number} value
 */
function easeInOut(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

/**
 * Match the CSS pop keyframes for one player.
 * @param {number} seconds
 * @param {number} phase
 */
function popOffset(seconds, phase) {
  const t = (seconds + phase) % 8;
  if (t < 1.76) return 0;
  if (t < 3.84) return easeInOut((t - 1.76) / 2.08) * 1.08;
  if (t < 4.96) return 1.08;
  if (t < 7.04) return (1 - easeInOut((t - 4.96) / 2.08)) * 1.08;
  return 0;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} image
 * @param {number} x
 * @param {number} y
 * @param {number} size
 * @param {number} [facing]
 */
function drawFace(ctx, image, x, y, size, facing = 1) {
  ctx.save();
  if (facing < 0) {
    ctx.translate(Math.round(x + size), 0);
    ctx.scale(-1, 1);
    ctx.drawImage(image, 0, Math.round(y), Math.round(size), Math.round(size));
  } else {
    ctx.drawImage(image, Math.round(x), Math.round(y), Math.round(size), Math.round(size));
  }
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} name
 * @param {number} x
 * @param {number} y
 * @param {number} size
 * @param {number} fontSize
 */
function drawName(ctx, name, x, y, size, fontSize) {
  ctx.save();
  ctx.font = `${fontSize}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  let label = name || 'Blob';
  const maxWidth = Math.max(24, size - 4);
  while (label.length > 1 && ctx.measureText(label).width > maxWidth) {
    label = `${label.slice(0, -2)}…`;
  }
  ctx.lineWidth = Math.max(2, fontSize * 0.16);
  ctx.strokeStyle = '#3c261d';
  ctx.strokeText(label, x, y);
  ctx.fillStyle = '#ffecdc';
  ctx.fillText(label, x, y);
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} view
 * @param {{ name: string }[]} rows
 * @param {HTMLImageElement[]} faces
 * @param {number} seconds
 */
function renderFrame(ctx, view, rows, faces, seconds) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const vh = height / 100;
  const gapX = 1.6 * vh;
  const gapY = 1.4 * vh;
  const count = Math.max(1, rows.length);

  ctx.clearRect(0, 0, width, height);

  if (view === 'float') {
    const cols = Math.max(1, Math.min(count, Math.ceil(Math.sqrt(count * 1.7))));
    const gridRows = Math.ceil(count / cols);
    const size = 12 * vh;
    for (let i = 0; i < count; i += 1) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const left = ((col + 0.5) / cols) * 86 + 4 + ((i * 17) % 5) - 2;
      const top = ((row + 0.5) / gridRows) * 70 + 8 + ((i * 13) % 5) - 2;
      const phase = ((seconds + (i % 8) * 0.35) / 7) % 1;
      const drift = -(0.5 - Math.cos(phase * Math.PI * 2) * 0.5) * 1.6 * vh;
      drawFace(ctx, faces[i], (left / 100) * width, (top / 100) * height + drift, size);
    }
    return;
  }

  if (view === 'walk' || view === 'walk-names') {
    const size = Math.min(16 * vh, 14 * (width / 100));
    const start = -size - 2 * (width / 100);
    const travel = width + size + 4 * (width / 100);
    const bottom = view === 'walk-names' ? height - 2.8 * vh : height;
    const fontSize = Math.max(12, Math.min(24, 1.5 * vh));
    for (let i = 0; i < count; i += 1) {
      const phase = ((seconds / 22 + i / count) % 1 + 1) % 1;
      const goingRight = phase < 0.5;
      const path = phase < 0.44 ? phase / 0.44 : phase < 0.5 ? 1 : phase < 0.94 ? 1 - (phase - 0.5) / 0.44 : 0;
      const x = start + travel * path;
      const y = bottom - size;
      drawFace(ctx, faces[i], x, y, size, goingRight ? 1 : -1);
      if (view === 'walk-names') {
        drawName(ctx, rows[i].name, x + size / 2, height - 0.8 * vh, size, fontSize);
      }
    }
    return;
  }

  const isGrid = view === 'grid';
  const cols = isGrid ? Math.max(1, Math.min(count, Math.ceil(Math.sqrt(count * 1.7)))) : count;
  const size = Math.max(
    32,
    isGrid
      ? Math.min(14 * vh, (width - 6 * vh) / cols - 1.6 * vh)
      : Math.min(16 * vh, (width - 6 * vh) / count - 1.6 * vh),
  );
  const names = view === 'row' || isGrid;
  const fontSize = Math.max(12, Math.min(24, 1.7 * vh));
  const rowsPerGrid = isGrid ? Math.ceil(count / cols) : 1;
  const rowExtra = names ? fontSize : 0;
  const contentWidth = cols * size + Math.max(0, cols - 1) * gapX;
  const contentHeight = rowsPerGrid * size + Math.max(0, rowsPerGrid - 1) * (gapY + rowExtra) + rowExtra;
  const originX = (width - contentWidth) / 2;
  const originY = isGrid
    ? (height - contentHeight) / 2
    : height - (view === 'low' || view === 'pop' ? size : size + 1.6 * vh + rowExtra);

  for (let i = 0; i < count; i += 1) {
    const col = isGrid ? i % cols : i;
    const row = isGrid ? Math.floor(i / cols) : 0;
    const x = isGrid ? originX + col * (size + gapX) : originX + i * (size + gapX);
    let y = isGrid ? originY + row * (size + gapY + rowExtra) : originY;
    if (view === 'pop') y += size * popOffset(seconds, (i % 6) * 1.15);
    drawFace(ctx, faces[i], x, y, size);
    if (names) drawName(ctx, rows[i].name, x + size / 2, y + size + fontSize, size, fontSize);
  }
}

/**
 * Render and download one transparent WebM loop.
 * @param {{ root: string, view: string, onProgress?: (value: number) => void }} opts
 */
export async function downloadBlobCastVideo({ root, view, onProgress }) {
  const normalizedView = normalizeOverlayView(view);
  const mimeType = transparentWebmMime();
  if (!mimeType) {
    throw new Error('Transparent WebM export needs a browser with VP9 MediaRecorder support, such as current Chrome or Edge.');
  }
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    throw new Error('Video export is only available in a browser.');
  }

  const rows = await loadBlobCast();
  if (!rows.length) throw new Error('There are no blob looks to export yet.');
  const baked = await Promise.all(
    rows.map((row) => bakeBlobFaceUrl({ equipped_avatar: row.equipped }, root, FACE_BAKE_SIZE)),
  );
  const faces = await Promise.all(baked.map((src) => loadImage(src)));
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx || typeof canvas.captureStream !== 'function') {
    throw new Error('This browser cannot capture a transparent video canvas.');
  }
  ctx.imageSmoothingEnabled = false;

  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  });
  const chunks = [];
  const recording = new Promise((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };
    recorder.onerror = () => reject(recorder.error || new Error('Transparent video recording failed.'));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  const duration = blobLoopSeconds(normalizedView);
  recorder.start(250);
  const startedAt = performance.now();
  try {
    while (true) {
      const elapsed = (performance.now() - startedAt) / 1000;
      if (elapsed >= duration) break;
      renderFrame(ctx, normalizedView, rows, faces, elapsed);
      onProgress?.(Math.min(1, elapsed / duration));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    // Add the exact loop boundary. Animated views use matching boundary states.
    renderFrame(ctx, normalizedView, rows, faces, 0);
    onProgress?.(1);
    recorder.stop();
    const blob = await recording;
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `bpb-blob-cast-${normalizedView}-loop.webm`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 30_000);
    return { blob, duration, mimeType };
  } finally {
    stream.getTracks().forEach((track) => track.stop());
    if (recorder.state !== 'inactive') recorder.stop();
  }
}
