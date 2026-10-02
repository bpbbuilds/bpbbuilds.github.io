/**
 * Forum board picture. Same render as the create-page Export PNG.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { applyShapes, applySocketOffsets, makeSpriteUrl, mapItem } from '../js/pages/build/map-item.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CELL_PX = 256;
const PAD_PX = 24;
const OVERHANG_CELLS = 1;
const ITEM_FIELDS = [
  'id',
  'gid',
  'name',
  'rarity',
  'type',
  'class',
  'extra_types',
  'tags',
  'cost',
  'effect',
  'image',
  'shape',
  'sockets',
  'accuracy',
  'cooldown',
  'stamina_cost',
  'damage_min',
  'damage_max',
  'block',
  'chance',
  'chance_tag',
  'params',
].join(',');

/** @type {{ shapes: object, sprites: object, sockets: object } | null} */
let extras = null;
/** @type {((opts: object) => Promise<{ canvas: { toBuffer: (type: string) => Buffer } }>) | null} */
let paintBoardCanvas = null;

function catalogExtras() {
  if (extras) return extras;
  const read = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data', name), 'utf8'));
  extras = {
    shapes: read('item-shapes.json'),
    sprites: read('sprite-display.json'),
    sockets: read('socket-offsets.json'),
  };
  return extras;
}

function installCanvas() {
  if (globalThis.document) return;
  if (!globalThis.Element) globalThis.Element = class Element {};
  if (!globalThis.HTMLElement) globalThis.HTMLElement = class HTMLElement extends Element {};
  globalThis.document = {
    body: { dataset: { root: '' } },
    createElement(tag) {
      if (tag !== 'canvas') return {};
      return createCanvas(1, 1);
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
  };
}

async function painter() {
  if (!paintBoardCanvas) {
    installCanvas();
    ({ paintBoardCanvas } = await import('../js/shared/board-still/paint.js'));
  }
  return paintBoardCanvas;
}

/**
 * @param {string} url
 */
async function loadSprite(url) {
  const rel = String(url || '').replace(/^\/+/, '').split('?')[0];
  const img = await loadImage(fs.readFileSync(path.join(ROOT, rel)));
  if (!img.naturalWidth) img.naturalWidth = img.width;
  if (!img.naturalHeight) img.naturalHeight = img.height;
  return img;
}

/**
 * @param {{ base: string, key: string }} config
 * @param {string} pathAndQuery
 */
async function rest(config, pathAndQuery) {
  const res = await fetch(`${config.base}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
  });
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

/**
 * @param {{ base: string }} config
 * @param {Record<string, unknown>} build
 */
export function stillUrl(config, build) {
  const rel = String(build.board_still_path || '').replace(/^\/+/, '').trim();
  if (!rel) return '';
  if (/^https?:\/\//i.test(rel)) return rel;
  const encoded = rel.split('/').map((part) => encodeURIComponent(part)).join('/');
  return `${config.base}/storage/v1/object/public/board-stills/${encoded}`;
}

let bucketReady = false;

async function ensureBoardBucket(config) {
  if (bucketReady) return;
  const res = await fetch(`${config.base}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: 'discord-builds',
      name: 'discord-builds',
      public: true,
      file_size_limit: 10485760,
      allowed_mime_types: ['image/png'],
    }),
  });
  bucketReady = res.ok || res.status === 400 || res.status === 409;
  if (!bucketReady) {
    const detail = await res.text();
    console.error(`Build image bucket failed (${res.status}): ${detail.slice(0, 160)}`);
  }
}

/**
 * Public copy of the export PNG. The forum embed uses this link
 * so the picture is not also attached above the embed.
 * @param {{ base: string, key: string }} config
 * @param {string} slug
 * @param {Buffer} png
 * @returns {Promise<string>}
 */
export async function hostBoardImage(config, slug, png) {
  await ensureBoardBucket(config);
  const name = String(slug || 'build').replace(/[^\w.-]/g, '') || 'build';
  const objectPath = `${name}.png`;
  const res = await fetch(`${config.base}/storage/v1/object/discord-builds/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: png,
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error(`Build image upload failed (${res.status}): ${detail.slice(0, 160)}`);
    return '';
  }
  return `${config.base}/storage/v1/object/public/discord-builds/${objectPath}?v=board`;
}

/**
 * @param {{ base: string, key: string }} config
 * @param {Record<string, unknown>} build
 * @returns {Promise<Buffer | null>}
 */
export async function buildThumbPng(config, build) {
  if (!build?.id) return null;
  const rows = await rest(
    config,
    `build_placements?select=item_id,x,y,r,gems,items(${ITEM_FIELDS})&build_id=eq.${encodeURIComponent(String(build.id))}`,
  );
  if (!rows.length) return null;
  const data = catalogExtras();
  /** @type {Map<string, object>} */
  const itemsById = new Map();
  /** @type {object[]} */
  const placements = [];
  const gemIds = new Set();
  for (const row of rows) {
    const item = mapItem(row.items);
    if (!item?.id) continue;
    itemsById.set(item.id, item);
    for (const gemId of Array.isArray(row.gems) ? row.gems : []) {
      if (gemId) gemIds.add(String(gemId));
    }
    placements.push({
      id: item.id,
      x: Number(row.x) || 0,
      y: Number(row.y) || 0,
      r: ((Number(row.r) || 0) % 4 + 4) % 4,
      gems: Array.isArray(row.gems) ? row.gems : [],
    });
  }
  const missing = [...gemIds].filter((id) => !itemsById.has(id));
  if (missing.length) {
    const list = missing.map((id) => encodeURIComponent(id)).join(',');
    const gems = await rest(config, `items?select=${ITEM_FIELDS}&id=in.(${list})`);
    for (const row of gems) {
      const item = mapItem(row);
      if (item?.id) itemsById.set(item.id, item);
    }
  }
  const items = [...itemsById.values()];
  applyShapes(items, data.shapes);
  applySocketOffsets(items, data.sockets);
  const getSpriteUrl = makeSpriteUrl('./', data.sprites);
  const paint = await painter();
  const { canvas } = await paint({
    placements,
    itemsById,
    getSpriteUrl,
    loadImage: loadSprite,
    root: './',
    cellPx: CELL_PX,
    cols: 9,
    rows: 7,
    crop: true,
    padPx: PAD_PX,
    overhangCells: OVERHANG_CELLS,
  });
  return canvas.toBuffer('image/png');
}
