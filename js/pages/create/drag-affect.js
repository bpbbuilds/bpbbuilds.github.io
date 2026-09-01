/**
 * Drag-time affect preview — Inventory.previewAffectedCells (Above tilemap).
 *
 * Game: item follows the mouse; getAffectedPoints() → world positions; inventory
 * world_to_map → cell; aboveTilemap.set_cellv paints stars cell-aligned.
 * Stars follow the item but lock to grid centers as the float position crosses cells.
 */

import { shapeForItem, bodyBounds } from '../../shared/backpack-grid/index.js';
import {
  loadCanAffectData,
  canAffectColor,
  isAffectingDistinct,
} from '../../shared/backpack-grid/can-affect.js';
import {
  BOARD_COLS,
  BOARD_ROWS,
  isBagItem,
  placementBodyCells,
  toSkipSet,
} from './collision.js';

/**
 * @typedef {'primary' | 'secondary' | 'tertiary' | 'lightning'} AffectColor
 */

function assetRoot() {
  const raw = document.body?.dataset?.root ?? './';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/** @param {string} name */
function gridIcon(name) {
  return `${assetRoot()}assets/icons/grid/${name}.png`;
}

/** @type {{ shapeKey: 'stars' | 'diamonds' | 'tertiaries' | 'lightnings', color: AffectColor, off: string, on: string }[]} */
const LAYERS = [
  {
    shapeKey: 'stars',
    color: 'primary',
    off: 'AffectedTile_noEffect',
    on: 'AffectedTile',
  },
  {
    shapeKey: 'diamonds',
    color: 'secondary',
    off: 'AffectedTile_secondary_noEffect',
    on: 'AffectedTile_secondary',
  },
  {
    shapeKey: 'tertiaries',
    color: 'tertiary',
    off: 'AffectedTile_tertiary_noEffect',
    on: 'AffectedTile_tertiary',
  },
  {
    shapeKey: 'lightnings',
    color: 'lightning',
    off: 'AffectedTile_lightning_noEffect',
    on: 'AffectedTile_lightning',
  },
];

/** @param {string | null | string[] | Set<string>} skip */
function skipKeySig(skip) {
  const s = toSkipSet(skip);
  if (!s) return '';
  return [...s].sort().join(',');
}

/**
 * Board cell for a UP-local mark after face rotation (stampAffectCells).
 * Origin may be fractional (float while dragging); result is floored to a cell.
 * @param {number} lx
 * @param {number} ly
 * @param {{ w: number, h: number }} upBounds
 * @param {{ w: number, h: number }} rotBounds
 * @param {{ x: number, y: number }} origin
 * @param {number} face
 */
function markToBoard(lx, ly, upBounds, rotBounds, origin, face) {
  const cx = Number(origin.x) + rotBounds.w / 2;
  const cy = Number(origin.y) + rotBounds.h / 2;
  let ox = lx + 0.5 - upBounds.w / 2;
  let oy = ly + 0.5 - upBounds.h / 2;
  for (let s = 0; s < face; s += 1) {
    const nx = -oy;
    const ny = ox;
    ox = nx;
    oy = ny;
  }
  return { x: Math.floor(cx + ox), y: Math.floor(cy + oy) };
}

/**
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 * @param {string | null | string[] | Set<string>} skipKey
 */
function boardMaps(placements, itemsById, skipKey) {
  const skip = toSkipSet(skipKey);
  /** @type {Set<string>} */
  const bagCells = new Set();
  /** @type {Map<string, object>} */
  const filled = new Map();
  for (const p of placements) {
    if (skip && p.key && skip.has(p.key)) continue;
    const item = itemsById.get(p.id);
    if (!item) continue;
    const cells = placementBodyCells(item, p);
    if (isBagItem(item)) {
      for (const c of cells) bagCells.add(`${c.x},${c.y}`);
    } else {
      for (const c of cells) {
        const k = `${c.x},${c.y}`;
        if (!filled.has(k)) filled.set(k, item);
      }
    }
  }
  return { bagCells, filled };
}

/**
 * @param {HTMLElement} stageEl
 * @param {() => HTMLElement | null} getBoardEl
 */
export function createDragAffectPreview(stageEl, getBoardEl) {
  const el = document.createElement('div');
  el.className = 'create-board__affect';
  el.hidden = true;
  el.setAttribute('aria-hidden', 'true');
  stageEl.appendChild(el);

  /** @type {import('../../shared/backpack-grid/can-affect.js').CanAffectData | null} */
  let data = null;
  void loadCanAffectData(assetRoot()).then((d) => {
    data = d;
  });

  /** @type {string} */
  let lastSyncKey = '';
  /** @type {string} */
  let lastMapsKey = '';
  /** @type {ReturnType<typeof boardMaps> | null} */
  let cachedMaps = null;
  /** @type {HTMLElement[]} */
  const tilePool = [];

  function clear() {
    lastSyncKey = '';
    el.hidden = true;
    el.replaceChildren();
  }

  /**
   * @param {{
   *   item: object,
   *   r: number,
   *   origin: { x: number, y: number } | null,
   *   placements: object[],
   *   itemsById: Map<string, object>,
   *   skipKey: string | null,
   *   boardRect?: DOMRect,
   *   stageRect?: DOMRect,
   * }} opts
   */
  function sync(opts) {
    const { item, r, origin, placements, itemsById, skipKey } = opts;
    const board = getBoardEl();
    if (!item || !origin || isBagItem(item) || !(board instanceof HTMLElement)) {
      clear();
      return;
    }

    const face = ((Number(r) || 0) % 4 + 4) % 4;
    const syncKey = `${Math.round(origin.x * 2)},${Math.round(origin.y * 2)},${face},${skipKeySig(skipKey)}`;
    if (syncKey === lastSyncKey && !el.hidden) return;
    lastSyncKey = syncKey;

    const up = shapeForItem(item, 0);
    const upBounds = item.__bpbBounds || (item.__bpbBounds = bodyBounds(up));
    const rotBounds = face ? bodyBounds(shapeForItem(item, face)) : upBounds;

    const mapsKey = `${skipKeySig(skipKey)}|${placements.length}|${placements.map((p) => p.key).join(',')}`;
    if (mapsKey !== lastMapsKey || !cachedMaps) {
      lastMapsKey = mapsKey;
      cachedMaps = boardMaps(placements, itemsById, skipKey);
    }
    const maps = cachedMaps;
    const rulesById = data?.rulesById || null;
    const ctx = {
      classMasks: data?.classMasks || null,
      classBits: data?.classBits,
      hasAttackEffectIds: data?.hasAttackEffectIds || null,
      reactsToChargesIds: data?.reactsToChargesIds || null,
      gainsBuffsIds: data?.gainsBuffsIds || null,
      usesBuffsIds: data?.usesBuffsIds || null,
      gainedStacksById: data?.gainedStacksById || null,
      usedStacksById: data?.usedStacksById || null,
      craftedIds: data?.craftedIds || null,
      scriptFamilies: data?.scriptFamilies || {},
      parentById: data?.parentById || {},
      rarityRank: data?.rarityRank,
      startOfBattleIds: data?.startOfBattleIds || null,
    };

    const bRect = opts.boardRect || board.getBoundingClientRect();
    const sRect = opts.stageRect || stageEl.getBoundingClientRect();
    const cellW = bRect.width / BOARD_COLS;
    const cellH = bRect.height / BOARD_ROWS;

    /** @type {{ cell: string, color: AffectColor, hit: boolean, off: string, on: string, x: number, y: number }[]} */
    const tiles = [];

    for (const layer of LAYERS) {
      const locals = up[layer.shapeKey] || [];
      if (!locals.length) continue;

      /** @type {{ cell: string, x: number, y: number }[]} */
      const marks = locals.map((c) => {
        const lx = c.x - upBounds.minX;
        const ly = c.y - upBounds.minY;
        const boardCell = markToBoard(lx, ly, upBounds, rotBounds, origin, face);
        return {
          cell: `${boardCell.x},${boardCell.y}`,
          x: boardCell.x,
          y: boardCell.y,
        };
      });

      marks.sort((a, b) => a.y - b.y || a.x - b.x);

      /** @type {Set<object>} */
      const itemsChecked = new Set();
      /** @type {Set<string>} */
      const distinctIds = new Set();
      const distinctMode = isAffectingDistinct(rulesById, item, layer.color);
      const skipRecheck = layer.color !== 'lightning';

      for (const mark of marks) {
        let hit = false;
        if (maps.bagCells.has(mark.cell)) {
          const target = maps.filled.get(mark.cell) || null;
          if (target) {
            if (skipRecheck && itemsChecked.has(target)) {
              hit = false;
            } else {
              hit = canAffectColor(rulesById, item, target, layer.color, ctx);
              if (hit && distinctMode) {
                if (distinctIds.has(target.id)) hit = false;
                else distinctIds.add(target.id);
              }
              itemsChecked.add(target);
            }
          } else {
            hit = canAffectColor(rulesById, item, null, layer.color, ctx);
          }
        }
        tiles.push({
          cell: mark.cell,
          color: layer.color,
          hit,
          off: layer.off,
          on: layer.on,
          x: mark.x,
          y: mark.y,
        });
      }
    }

    if (!tiles.length) {
      clear();
      return;
    }

    el.hidden = false;
    const pad = 1;
    let ti = 0;
    for (const t of tiles) {
      if (t.x < -pad || t.y < -pad || t.x >= BOARD_COLS + pad || t.y >= BOARD_ROWS + pad) {
        continue;
      }
      let span = tilePool[ti];
      if (!span) {
        span = document.createElement('span');
        tilePool[ti] = span;
      }
      span.className = `create-board__affect-tile create-board__affect-tile--${t.color}${
        t.hit ? ' is-active' : ''
      }`;
      span.style.left = `${bRect.left - sRect.left + t.x * cellW}px`;
      span.style.top = `${bRect.top - sRect.top + t.y * cellH}px`;
      span.style.width = `${cellW}px`;
      span.style.height = `${cellH}px`;
      span.style.backgroundImage = `url('${gridIcon(t.hit ? t.on : t.off)}')`;
      if (span.parentNode !== el) el.appendChild(span);
      ti += 1;
    }
    while (el.childNodes.length > ti) {
      el.removeChild(el.lastChild);
    }
  }

  return {
    sync,
    clear,
    destroy() {
      el.remove();
    },
  };
}
