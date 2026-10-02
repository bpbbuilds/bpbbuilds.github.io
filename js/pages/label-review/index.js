/**
 * Side-by-side check of saved label fixtures (screenshot + truth board).
 * Local dev: /dev/label-review/
 */

import { mountPlacedGrid } from '../../shared/backpack-grid/index.js';
import { skelBlock, skelRegion } from '../../shared/skeleton.js';
import { BOARD_COLS, BOARD_ROWS } from '../create/collision.js';
import { placementFromTruthRow } from '../create/label-fix.js';
import { loadCreateCatalog } from '../create/load-catalog.js';

const listEl = document.getElementById('lr-list');
const statusEl = document.getElementById('lr-status');
const jumpEl = document.getElementById('lr-jump');
const root = document.body.dataset.root || '../../';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c
  ));

/**
 * @param {number} n
 */
function stemOf(n) {
  return `real-${String(n).padStart(3, '0')}`;
}

/**
 * @param {object[]} items
 */
function namesByLower(items) {
  /** @type {Map<string, object>} */
  const map = new Map();
  for (const item of items) {
    const key = String(item.name || '').trim().toLowerCase();
    if (key && !map.has(key)) map.set(key, item);
  }
  return map;
}

/**
 * @param {{ ok?: boolean, originX?: number, originY?: number, cellW?: number, cellH?: number, imgW?: number, imgH?: number } | null | undefined} grid
 */
function gridOverlayHtml(grid) {
  if (!grid || !(Number(grid.cellW) > 0) || !(Number(grid.imgW) > 0)) return '';
  const ox = Number(grid.originX) || 0;
  const oy = Number(grid.originY) || 0;
  const cw = Number(grid.cellW);
  const ch = Number(grid.cellH) || cw;
  const w = Number(grid.imgW);
  const h = Number(grid.imgH) || w;
  const x = ((ox / w) * 100).toFixed(2);
  const y = ((oy / h) * 100).toFixed(2);
  const bw = (((9 * cw) / w) * 100).toFixed(2);
  const bh = (((7 * ch) / h) * 100).toFixed(2);
  const tone = grid.ok ? 'is-ok' : 'is-guess';
  return `<span class="lr-grid ${tone}" style="left:${x}%;top:${y}%;width:${bw}%;height:${bh}%" aria-hidden="true"></span>`;
}

function rowsToPlacements(rows, byName, prefix) {
  /** @type {{ id: string, x: number, y: number, r: number, key: string, gems?: string[], gemR?: number[] }[]} */
  const placements = [];
  /** @type {string[]} */
  const missing = [];
  rows.forEach((row, i) => {
    const built = placementFromTruthRow(row, byName, `${prefix}-${i}`);
    missing.push(...built.missing);
    if (built.placement) placements.push(built.placement);
  });
  return { placements, missing };
}

/**
 * @param {number} n
 */
async function loadOne(n) {
  const stem = stemOf(n);
  const [truthRes, pngRes] = await Promise.all([
    fetch(`/fixtures/${stem}.truth.json`, { cache: 'no-store' }),
    fetch(`/fixtures/${stem}.png`, { method: 'HEAD', cache: 'no-store' }).catch(() => null),
  ]);
  if (!truthRes.ok && !(pngRes && pngRes.ok)) return null;
  const text = truthRes.ok ? (await truthRes.text()).trim() : '';
  /** @type {object | null} */
  let truth = null;
  /** @type {string | null} */
  let truthError = null;
  if (!truthRes.ok) truthError = 'No truth file.';
  else if (!text) truthError = 'Truth file is empty — this save did not record a board.';
  else {
    try {
      truth = JSON.parse(text);
    } catch {
      truthError = 'Truth file is not valid JSON.';
    }
  }
  return {
    n,
    stem,
    truth,
    truthError,
    hasPng: !!(pngRes && pngRes.ok) || truthRes.ok,
  };
}

async function loadAll() {
  /** @type {Awaited<ReturnType<typeof loadOne>>[]} */
  const found = [];
  let misses = 0;
  for (let n = 1; n <= 40 && misses < 3; n += 1) {
    const row = await loadOne(n);
    if (!row) {
      misses += 1;
      continue;
    }
    misses = 0;
    found.push(row);
  }
  return found;
}

/**
 * @param {NonNullable<Awaited<ReturnType<typeof loadOne>>>} row
 * @param {Map<string, object>} byName
 * @param {Map<string, object>} itemsById
 * @param {(item: object) => string} getSpriteUrl
 * @param {HTMLElement} parent
 */
function paintCard(row, byName, itemsById, getSpriteUrl, parent) {
  const truth = row.truth || {};
  const bags = Array.isArray(truth.bags) ? truth.bags : [];
  const items = Array.isArray(truth.items) ? truth.items : [];
  const skills = Array.isArray(truth.skills) ? truth.skills : [];
  const jewels = Array.isArray(truth.jewels) ? truth.jewels : [];
  const bagPlaced = rowsToPlacements(bags, byName, `${row.stem}-b`);
  const itemPlaced = rowsToPlacements(items, byName, `${row.stem}-i`);
  const skillPlaced = rowsToPlacements(skills, byName, `${row.stem}-s`);
  const jewelPlaced = rowsToPlacements(jewels, byName, `${row.stem}-j`);
  const placements = [
    ...bagPlaced.placements,
    ...itemPlaced.placements,
    ...skillPlaced.placements,
    ...jewelPlaced.placements,
  ];
  const missing = [
    ...bagPlaced.missing,
    ...itemPlaced.missing,
    ...skillPlaced.missing,
    ...jewelPlaced.missing,
  ];
  const socketCount = [...items, ...skills].reduce(
    (n, it) => n + (Array.isArray(it.gems) ? it.gems.filter(Boolean).length : 0),
    0,
  );
  const split = truth.split ? String(truth.split) : '—';
  const source = truth.source ? String(truth.source) : '—';
  const warn = row.truthError
    ? `<p class="cr-hint lr-warn">${esc(row.truthError)}</p>`
    : '';
  const missingHtml = missing.length
    ? `<p class="cr-hint lr-missing">Not in the catalog: ${esc(missing.join(', '))}</p>`
    : '';

  const article = document.createElement('article');
  article.className = 'lr-card';
  article.id = row.stem;
  article.innerHTML = `
    <h2>${esc(row.stem)}</h2>
    <p class="cr-hint lr-meta">${esc(split)} · ${esc(source)} · ${items.length} items${skills.length ? ` · ${skills.length} skills` : ''}${jewels.length ? ` · ${jewels.length} jewels` : ''}${socketCount ? ` · ${socketCount} in slots` : ''} · ${bags.length} bags</p>
    <p class="lr-actions"><a class="lr-edit" href="../../create/?label=1&amp;fix=${esc(row.stem)}">Edit this board</a></p>
    ${warn}
    <div class="lr-pair">
      <figure class="lr-shot">
        <img src="/fixtures/${esc(row.stem)}.png" alt="Screenshot ${esc(row.stem)}" />
        ${gridOverlayHtml(truth.grid)}
      </figure>
      <div class="lr-board" data-board></div>
    </div>
    ${missingHtml}
  `;
  parent.appendChild(article);
  const board = article.querySelector('[data-board]');
  if (board instanceof HTMLElement && placements.length && !row.truthError) {
    mountPlacedGrid(board, {
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
  } else if (board instanceof HTMLElement && !row.truthError) {
    board.textContent = 'This file has no items or bags.';
  }
}

async function main() {
  if (!(listEl instanceof HTMLElement) || !(statusEl instanceof HTMLElement)) return;
  listEl.innerHTML = skelRegion(
    `<div>${skelBlock()}${skelBlock()}</div>`,
    { label: 'Loading saved labels' },
  );

  let catalog;
  try {
    catalog = await loadCreateCatalog(root);
  } catch (err) {
    statusEl.textContent = err instanceof Error ? err.message : 'Could not load the item catalog.';
    listEl.replaceChildren();
    return;
  }

  const rows = await loadAll();
  const byName = namesByLower(catalog.items);
  listEl.replaceChildren();
  if (jumpEl instanceof HTMLElement) jumpEl.replaceChildren();

  const empty = rows.filter((r) => r.truthError);
  statusEl.textContent = empty.length
    ? `${rows.length} fixtures. ${empty.map((r) => r.stem).join(', ')} ${empty.length === 1 ? 'has' : 'have'} no usable board file.`
    : `${rows.length} fixtures.`;

  for (const row of rows) {
    if (jumpEl instanceof HTMLElement) {
      const a = document.createElement('a');
      a.href = `#${row.stem}`;
      a.textContent = row.stem;
      jumpEl.appendChild(a);
    }
    paintCard(row, byName, catalog.itemsById, catalog.getSpriteUrl, listEl);
  }
}

void main();
