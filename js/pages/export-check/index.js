/**
 * Side-by-side check: export PNG on a game background vs the backpack grid from the same JSON.
 * Local dev: /dev/export-check/
 */

import { mountPlacedGrid } from '../../shared/backpack-grid/index.js';
import { loadCachedImage } from '../../shared/board-still/cache.js';
import { paintBoardCanvas } from '../../shared/board-still/paint.js';
import { skelBlock, skelRegion } from '../../shared/skeleton.js';
import { BOARD_COLS, BOARD_ROWS } from '../create/collision.js';
import { loadCreateCatalog } from '../create/load-catalog.js';

const listEl = document.getElementById('xc-list');
const statusEl = document.getElementById('xc-status');
const root = document.body.dataset.root || '../../';

const EXTRACT = '/tools/game-extract-full/Assets';
const SCENES = {
  paper: [`${EXTRACT}/Paper1.png`],
  shop: [`${EXTRACT}/Shop/Shop.png`],
  battle: [
    `${EXTRACT}/Background/Mountains.png`,
    `${EXTRACT}/Background/Hill3.png`,
    `${EXTRACT}/Background/Hill2.png`,
    `${EXTRACT}/Background/Hill1.png`,
  ],
};

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c
  ));

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} img
 * @param {number} w
 * @param {number} h
 * @param {number} pan
 */
function coverImage(ctx, img, w, h, pan) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = (w - dw) * pan;
  const dy = (h - dh) * (1 - pan);
  ctx.drawImage(img, dx, dy, dw, dh);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @param {string} scene
 */
async function drawScene(ctx, w, h, scene) {
  if (scene === 'battle') {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#7ec0e8');
    sky.addColorStop(0.55, '#d7ecf6');
    sky.addColorStop(1, '#6f8f45');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const layers = await Promise.all(
      SCENES.battle.map((url) => loadCachedImage(url).catch(() => null)),
    );
    const tints = [
      'rgba(120, 140, 160, 0.35)',
      'rgba(90, 110, 70, 0.55)',
      'rgba(70, 100, 50, 0.6)',
      'rgba(50, 85, 40, 0.7)',
    ];
    layers.forEach((img, i) => {
      if (!img) return;
      const plate = document.createElement('canvas');
      plate.width = w;
      plate.height = h;
      const g = plate.getContext('2d');
      if (!g) return;
      const dw = w * (1.15 + i * 0.08);
      const dh = dw * (img.height / img.width);
      const y = h * (0.22 + i * 0.14);
      g.drawImage(img, (w - dw) / 2, y, dw, Math.max(dh, h - y));
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = tints[i] || tints[tints.length - 1];
      g.fillRect(0, 0, w, h);
      ctx.drawImage(plate, 0, 0);
    });
    return;
  }
  const url = SCENES[scene]?.[0] || SCENES.paper[0];
  try {
    const img = await loadCachedImage(url);
    coverImage(ctx, img, w, h, scene === 'shop' ? 0.2 : 0.45);
  } catch {
    ctx.fillStyle = '#c4a574';
    ctx.fillRect(0, 0, w, h);
  }
}

/**
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 * @param {(item: object) => string} getSpriteUrl
 * @param {string} scene
 */
async function exportUrl(placements, itemsById, getSpriteUrl, scene) {
  const { canvas: board } = await paintBoardCanvas({
    placements,
    itemsById,
    getSpriteUrl,
    loadImage: loadCachedImage,
    root,
    cellPx: 72,
    cols: BOARD_COLS,
    rows: BOARD_ROWS,
    crop: true,
    padPx: 56,
    overhangCells: 1,
  });
  const out = document.createElement('canvas');
  out.width = board.width;
  out.height = board.height;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  await drawScene(ctx, out.width, out.height, scene);
  ctx.drawImage(board, 0, 0);
  return out.toDataURL('image/png');
}

/**
 * @param {object} board
 * @param {Map<string, object>} itemsById
 */
function counts(board, itemsById) {
  let bags = 0;
  let skills = 0;
  let jewels = 0;
  let missing = 0;
  for (const p of board.placements) {
    const item = itemsById.get(p.id);
    if (!item) {
      missing += 1;
      continue;
    }
    const type = String(item.type || '');
    if (type === 'Bag') bags += 1;
    else if (type === 'Skill') skills += 1;
    else if (type === 'Gem' || type.includes('Gemstone')) jewels += 1;
  }
  const items = board.placements.length - bags - skills - jewels - missing;
  return { bags, items, skills, jewels, missing };
}

/**
 * @param {object} board
 * @param {{ itemsById: Map<string, object>, getSpriteUrl: (item: object) => string }} catalog
 */
async function renderBoard(board, catalog) {
  const { itemsById, getSpriteUrl } = catalog;
  const placements = (board.placements || []).map((p, i) => ({
    id: p.id,
    x: p.x,
    y: p.y,
    r: p.r || 0,
    key: `${board.id}-${i}`,
    ...(Array.isArray(p.gems) && p.gems.length ? { gems: p.gems } : {}),
  }));
  const c = counts(board, itemsById);
  const sockets = (board.placements || []).reduce(
    (n, p) => n + (Array.isArray(p.gems) ? p.gems.filter(Boolean).length : 0),
    0,
  );
  const article = document.createElement('article');
  article.className = 'xc-card';
  article.id = board.id;
  const meta = [
    `${c.bags} bags`,
    `${c.items} items`,
    c.skills ? `${c.skills} skills` : '',
    c.jewels ? `${c.jewels} jewels` : '',
    sockets ? `${sockets} in slots` : '',
    c.missing ? `${c.missing} missing from catalog` : '',
  ].filter(Boolean).join(' · ');
  article.innerHTML = `
    <h2>${esc(board.title || board.id)}</h2>
    ${board.note ? `<p class="cr-hint">${esc(board.note)}</p>` : ''}
    <p class="cr-hint">${esc(meta)}</p>
    <div class="xc-pair">
      <figure class="xc-shot">
        <p class="cr-label xc-label">Export</p>
        <img class="xc-export" alt="" />
      </figure>
      <div>
        <p class="cr-label xc-label">From JSON</p>
        <div class="xc-board" data-board></div>
      </div>
    </div>
    <details class="xc-json">
      <summary class="cr-hint">Placements</summary>
      <pre>${esc(JSON.stringify(board.placements, null, 2))}</pre>
    </details>
  `;
  listEl.appendChild(article);
  const img = article.querySelector('.xc-export');
  const host = article.querySelector('[data-board]');
  if (host instanceof HTMLElement) {
    mountPlacedGrid(host, {
      placements,
      itemsById,
      getSpriteUrl,
      cols: BOARD_COLS,
      rows: BOARD_ROWS,
      cellPx: 42,
      fillWidth: false,
      exactBoard: true,
      appear: false,
    });
  }
  if (img instanceof HTMLImageElement) {
    img.alt = `${board.title || board.id} export`;
    img.src = await exportUrl(placements, itemsById, getSpriteUrl, board.scene || 'paper');
  }
}

async function main() {
  if (!(listEl instanceof HTMLElement) || !(statusEl instanceof HTMLElement)) return;
  const prevBtn = document.getElementById('xc-prev');
  const nextBtn = document.getElementById('xc-next');
  const jumpEl = document.getElementById('xc-jump');
  listEl.innerHTML = skelRegion(
    `<div>${skelBlock()}${skelBlock()}</div>`,
    { label: 'Loading export check' },
  );
  let catalog;
  /** @type {object[]} */
  let boards = [];
  let startAt = 0;
  try {
    const [cat, reviewedRes, generatedRes] = await Promise.all([
      loadCreateCatalog(root),
      fetch('/dev/export-check/boards.json', { cache: 'no-store' }),
      fetch('/dev/export-check/generated-boards.json', { cache: 'no-store' }),
    ]);
    catalog = cat;
    if (!reviewedRes.ok) throw new Error('boards.json missing');
    if (!generatedRes.ok) throw new Error('generated-boards.json missing');
    const reviewed = await reviewedRes.json();
    const generated = await generatedRes.json();
    const reviewedBoards = Array.isArray(reviewed.boards) ? reviewed.boards : [];
    const generatedBoards = Array.isArray(generated.boards) ? generated.boards : [];
    boards = [...reviewedBoards, ...generatedBoards];
    startAt = reviewedBoards.length;
  } catch (err) {
    statusEl.textContent = err instanceof Error ? err.message : 'Could not load boards.';
    listEl.replaceChildren();
    return;
  }
  if (!boards.length) {
    statusEl.textContent = 'No boards';
    listEl.replaceChildren();
    return;
  }
  if (jumpEl instanceof HTMLInputElement) jumpEl.max = String(boards.length);
  let index = 0;
  let token = 0;

  const show = async (next) => {
    index = Math.max(0, Math.min(boards.length - 1, next));
    const mine = ++token;
    const board = boards[index];
    if (jumpEl instanceof HTMLInputElement) jumpEl.value = String(index + 1);
    if (prevBtn instanceof HTMLButtonElement) prevBtn.disabled = index === 0;
    if (nextBtn instanceof HTMLButtonElement) nextBtn.disabled = index === boards.length - 1;
    statusEl.textContent = `${index + 1} of ${boards.length} · ${board.title || board.id}`;
    listEl.replaceChildren();
    try {
      await renderBoard(board, catalog);
    } catch (err) {
      if (mine !== token) return;
      const p = document.createElement('p');
      p.className = 'cr-hint';
      p.textContent = `${board.title || board.id}: ${err instanceof Error ? err.message : 'Could not draw this board.'}`;
      listEl.appendChild(p);
    }
  };

  prevBtn?.addEventListener('click', () => { show(index - 1); });
  nextBtn?.addEventListener('click', () => { show(index + 1); });
  jumpEl?.addEventListener('change', () => {
    const n = jumpEl instanceof HTMLInputElement ? Number(jumpEl.value) : 1;
    show((Number.isFinite(n) ? n : 1) - 1);
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.target instanceof HTMLInputElement) return;
    if (ev.key === 'ArrowLeft') show(index - 1);
    if (ev.key === 'ArrowRight') show(index + 1);
  });
  await show(startAt);
}

main();
