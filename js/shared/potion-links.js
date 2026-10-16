import { shapeForItem } from './backpack-grid/shape.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function itemFor(itemsById, id) {
  if (itemsById instanceof Map) return itemsById.get(id) || itemsById.get(String(id)) || null;
  return itemsById?.[id] || itemsById?.[String(id)] || null;
}

function isPotion(item) {
  return String(item?.type || '').toLowerCase() === 'potion';
}

function normalizedFace(placement) {
  return ((Number(placement?.r) || 0) % 4 + 4) % 4;
}

/**
 * Match the board renderer's placement identity for keyed history entries.
 * @param {{ id: string, x?: number, y?: number, r?: number, key?: string }} placement
 * @param {number} index
 */
export function potionPlacementKey(placement, index = 0) {
  if (placement?.key != null && String(placement.key) !== '') return String(placement.key);
  const face = normalizedFace(placement);
  return `${placement?.id}:${face}:${Number(placement?.x) || 0},${Number(placement?.y) || 0}`;
}

/**
 * Reproduce Potion.gd's primary affected cell. The extracted game selects the
 * first rotated collision cell except when facing DOWN, where it selects the
 * second, then moves one cell upward.
 *
 * @param {object} item
 * @param {{ x?: number, y?: number, r?: number }} placement
 */
export function potionPrimaryCell(item, placement) {
  const face = normalizedFace(placement);
  const body = shapeForItem(item, face).body;
  if (!body.length) return null;
  const anchor = body[Math.min(face === 2 ? 1 : 0, body.length - 1)] || body[0];
  return {
    x: (Number(placement?.x) || 0) + anchor.x,
    y: (Number(placement?.y) || 0) + anchor.y - 1,
  };
}

/**
 * @param {object} item
 * @param {{ x?: number, y?: number, r?: number }} placement
 */
function occupiedCells(item, placement) {
  const face = normalizedFace(placement);
  const x = Number(placement?.x) || 0;
  const y = Number(placement?.y) || 0;
  return shapeForItem(item, face).body.map((cell) => ({
    x: x + cell.x,
    y: y + cell.y,
  }));
}

/**
 * Find the potion directly occupying each potion's game-defined primary
 * affected cell. One source potion can affect at most one primary target.
 *
 * @param {{ id: string, x?: number, y?: number, r?: number, key?: string }[]} placements
 * @param {Map<string, object> | Record<string, object>} itemsById
 */
export function potionInteractionPairs(placements, itemsById) {
  const entries = (Array.isArray(placements) ? placements : [])
    .map((placement, index) => {
      const item = itemFor(itemsById, placement?.id);
      if (!item || !isPotion(item)) return null;
      const sourceCell = potionPrimaryCell(item, placement);
      if (!sourceCell) return null;
      return {
        item,
        placement,
        index,
        key: potionPlacementKey(placement, index),
        sourceCell,
        anchorCell: {
          x: sourceCell.x,
          y: sourceCell.y + 1,
        },
        occupied: occupiedCells(item, placement),
      };
    })
    .filter(Boolean);

  /** @type {object[]} */
  const pairs = [];
  for (const source of entries) {
    const target = entries.find(
      (candidate) =>
        candidate !== source &&
        candidate.occupied.some(
          (cell) => cell.x === source.sourceCell.x && cell.y === source.sourceCell.y,
        ),
    );
    if (!target) continue;
    pairs.push({
      source: source.item.id,
      target: target.item.id,
      sourceId: source.item.id,
      targetId: target.item.id,
      sourceKey: source.key,
      targetKey: target.key,
      sourceIndex: source.index,
      targetIndex: target.index,
      sourcePlacement: source.placement,
      targetPlacement: target.placement,
      sourceCell: source.sourceCell,
      anchorCell: source.anchorCell,
    });
  }
  return pairs;
}

/**
 * Grid-space endpoints match the game's connector placement: the affected
 * cell's center to the source potion's selected collision cell center.
 * @param {{ sourceCell: {x:number,y:number}, anchorCell: {x:number,y:number} }} pair
 */
export function potionLinkPoints(pair) {
  return {
    from: { x: pair.sourceCell.x + 0.5, y: pair.sourceCell.y + 0.5 },
    to: { x: pair.anchorCell.x + 0.5, y: pair.anchorCell.y + 0.5 },
  };
}

/**
 * Match the game's filled Triangle.png connector: a broad base at the
 * affected cell and a point aimed into the source potion's anchor cell.
 * @param {{ sourceCell: {x:number,y:number}, anchorCell: {x:number,y:number} }} pair
 * @returns {{ x:number, y:number }[]}
 */
export function potionLinkTriangle(pair) {
  const { from, to } = potionLinkPoints(pair);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy;
  const ny = ux;
  const halfWidth = Math.min(0.2, Math.max(0.12, length * 0.18));
  const base = { x: from.x, y: from.y };
  return [
    { x: base.x + nx * halfWidth, y: base.y + ny * halfWidth },
    to,
    { x: base.x - nx * halfWidth, y: base.y - ny * halfWidth },
  ];
}

/**
 * @param {{ sourceCell: {x:number,y:number}, anchorCell: {x:number,y:number} }} pair
 */
export function potionLinkPath(pair) {
  const [baseA, tip, baseB] = potionLinkTriangle(pair);
  return `M ${baseA.x} ${baseA.y} L ${tip.x} ${tip.y} L ${baseB.x} ${baseB.y} Z`;
}

/**
 * Paint the live SVG connector layer. The DOM is rebuilt only for the small
 * number of active potion links, keeping board repaints simple and stale-link
 * free.
 *
 * @param {HTMLElement} layer
 * @param {{ cols: number, rows: number, placements: object[], itemsById: Map<string, object> | Record<string, object> }} opts
 */
export function renderPotionLinks(layer, opts) {
  if (!(layer instanceof HTMLElement)) return [];
  const pairs = potionInteractionPairs(opts.placements, opts.itemsById);
  layer.replaceChildren();
  if (!pairs.length) {
    layer.classList.remove('bpb-bg__lines--has-potions');
    return pairs;
  }

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('bpb-bg__potion-lines');
  svg.setAttribute('viewBox', `0 0 ${Math.max(1, Number(opts.cols) || 1)} ${Math.max(1, Number(opts.rows) || 1)}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');

  for (const pair of pairs) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.classList.add('bpb-bg__potion-link');
    path.setAttribute('d', potionLinkPath(pair));
    path.setAttribute('pathLength', '1');
    path.dataset.sourceKey = pair.sourceKey;
    path.dataset.targetKey = pair.targetKey;
    svg.appendChild(path);
  }
  layer.classList.add('bpb-bg__lines--has-potions');
  layer.appendChild(svg);
  return pairs;
}
