/**
 * Inventory.previewItem hover tiles — game CanAdd / CantAdd / Collision art.
 * Mounted inside the board items layer so tiles sit above fabric, under sprites.
 */

import { BOARD_COLS, BOARD_ROWS, bagCellsSet } from './collision.js';

function assetRoot() {
  const raw = document.body?.dataset?.root ?? './';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/** @param {string} name */
function tileUrl(name) {
  // Bag empty-grid uses the same FilledSlot stamp as catalog / build fabric.
  if (name === 'FilledSlot') {
    return `${assetRoot()}assets/icons/FilledSlot.png`;
  }
  return `${assetRoot()}assets/icons/grid/${name}.png`;
}

/** @type {Record<string, string>} */
const KIND_TILE = {
  ok: 'CanAdd',
  // Bags use the same bright board CanAdd as items (not dim cursor CanAddBag).
  ok_bag: 'CanAdd',
  fail: 'CantAdd',
  fail_bag: 'CantAdd',
  collision: 'Collision',
  outside: 'CantAdd_outside',
  potential: 'FilledSlot',
  potential_hovered: 'FilledSlot',
};

/**
 * @param {HTMLElement} _stageEl unused — kept for call-site compat
 * @param {() => HTMLElement | null} getBoard
 */
export function createInventoryPreview(_stageEl, getBoard) {
  const layer = document.createElement('div');
  layer.className = 'create-board__inv-preview';
  layer.setAttribute('aria-hidden', 'true');
  layer.hidden = true;

  /** @type {HTMLElement[]} */
  const pool = [];
  let lastSig = '';

  /** Ensure layer lives in .bpb-bg__items (above fabric z-5000, below gear ≥10000). */
  function ensureHost() {
    const board = getBoard?.();
    if (!(board instanceof HTMLElement)) return null;
    const items =
      board.querySelector('.bpb-bg__items') ||
      board.closest('.bpb-bg')?.querySelector('.bpb-bg__items') ||
      board;
    if (!(items instanceof HTMLElement)) return null;
    if (layer.parentNode !== items) {
      // After fabric so DOM order matches z-index intent if fabric is recreated
      const fabric = items.querySelector(':scope > .bpb-bg__fabric');
      if (fabric?.nextSibling) items.insertBefore(layer, fabric.nextSibling);
      else items.appendChild(layer);
    }
    return board;
  }

  /**
   * @param {{
   *   cells: { x: number, y: number, kind: string }[],
   *   showPotential?: boolean,
   *   placements?: object[],
   *   itemsById?: Map<string, object>,
   *   skipKey?: string | null,
   *   boardRect: DOMRect,
   *   stageRect?: DOMRect,
   * }} opts
   */
  function paint(opts) {
    const board = ensureHost();
    if (!board) {
      clear();
      return;
    }

    const {
      cells,
      showPotential = false,
      placements = [],
      itemsById = new Map(),
      skipKey = null,
      boardRect,
    } = opts;
    // Tile coordinates live inside the board's layout box. On mobile the whole
    // board is scaled with transform; getBoundingClientRect() is then screen
    // sized, and using it here makes the preview shrink a second time.
    const localW = board.clientWidth || board.offsetWidth || boardRect.width;
    const localH = board.clientHeight || board.offsetHeight || boardRect.height;
    const cellW = localW / BOARD_COLS;
    const cellH = localH / BOARD_ROWS;

    /** @type {{ x: number, y: number, kind: string }[]} */
    const all = [];
    // Hover cells (incl. ok_bag) punch PotentialSpace holes; CanAdd paints there.
    const footprint = new Set(cells.map((c) => `${c.x},${c.y}`));
    if (showPotential && itemsById) {
      // Bag drag: FilledSlot empty grid (not other bags / footprint).
      const bags = bagCellsSet(placements, itemsById, skipKey);
      for (let y = 0; y < BOARD_ROWS; y += 1) {
        for (let x = 0; x < BOARD_COLS; x += 1) {
          const k = `${x},${y}`;
          if (bags.has(k) || footprint.has(k)) continue;
          all.push({ x, y, kind: 'potential' });
        }
      }
    }
    const hoverKeys = new Set();
    for (const c of cells) {
      hoverKeys.add(`${c.x},${c.y}`);
      all.push(c);
    }
    const filtered = all.filter((c) => {
      if (c.kind === 'potential' || c.kind === 'potential_hovered') {
        return !hoverKeys.has(`${c.x},${c.y}`);
      }
      return true;
    });
    /** @type {Map<string, { x: number, y: number, kind: string }>} */
    const byCell = new Map();
    for (const c of filtered) {
      const k = `${c.x},${c.y}`;
      const prev = byCell.get(k);
      if (!prev || (c.kind !== 'potential' && c.kind !== 'potential_hovered')) {
        byCell.set(k, c);
      } else if (!prev || prev.kind === 'potential') {
        byCell.set(k, c);
      }
    }
    const list = [...byCell.values()];

    const sig = list
      .map((c) => `${c.x},${c.y}:${c.kind}`)
      .join('|') + `|${Math.round(cellW)}:${Math.round(cellH)}`;
    if (sig === lastSig) return;
    lastSig = sig;

    let i = 0;
    for (const c of list) {
      if (c.x < 0 || c.y < 0 || c.x >= BOARD_COLS || c.y >= BOARD_ROWS) continue;
      let el = pool[i];
      if (!el) {
        el = document.createElement('span');
        el.className = 'create-board__inv-tile';
        pool[i] = el;
      }
      const tile = KIND_TILE[c.kind] || 'CantAdd';
      // Board-local coords — parent is .bpb-bg__items covering the board
      el.style.left = `${c.x * cellW}px`;
      el.style.top = `${c.y * cellH}px`;
      el.style.width = `${cellW}px`;
      el.style.height = `${cellH}px`;
      el.style.backgroundImage = `url('${tileUrl(tile)}')`;
      el.dataset.kind = c.kind;
      el.classList.toggle('is-potential', c.kind.startsWith('potential'));
      if (el.parentNode !== layer) layer.appendChild(el);
      i += 1;
    }
    while (layer.childNodes.length > i) {
      layer.removeChild(layer.lastChild);
    }
    layer.hidden = i === 0;
  }

  function clear() {
    lastSig = '';
    layer.hidden = true;
    layer.replaceChildren();
  }

  function destroy() {
    clear();
    layer.remove();
  }

  return { paint, clear, destroy };
}

/**
 * Bag cursor slots — CanAddBag / CantAddBag instead of hue-rotate.
 * @param {HTMLElement} slotsEl
 * @param {boolean} ok
 */
export function tintBagSlots(slotsEl, ok) {
  const url = tileUrl(ok ? 'CanAddBag' : 'CantAddBag');
  slotsEl.classList.toggle('is-valid', ok);
  slotsEl.classList.toggle('is-invalid', !ok);
  slotsEl.querySelectorAll('.create-board__cursor-slot').forEach((el) => {
    if (el instanceof HTMLElement) {
      el.style.backgroundImage = `url('${url}')`;
    }
  });
}
