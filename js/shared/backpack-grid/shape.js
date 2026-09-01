/**
 * Parse backpack item shape matrices.
 * 0 empty / 1 body / 2 star / 3 diamond / 4 extension / 5 tertiary / 6 lightning
 */

const FALLBACK = [[1]];

/**
 * @typedef {{ x: number, y: number }} Cell
 * @typedef {{
 *   matrix: number[][],
 *   w: number,
 *   h: number,
 *   body: Cell[],
 *   stars: Cell[],
 *   diamonds: Cell[],
 *   extensions: Cell[],
 *   tertiaries: Cell[],
 *   lightnings: Cell[],
 *   bodyCount: number,
 * }} ParsedShape
 */

/**
 * @param {unknown} raw
 * @returns {number[][]}
 */
export function normalizeMatrix(raw) {
  if (!Array.isArray(raw) || !raw.length) return FALLBACK.map((r) => [...r]);
  const rows = raw.map((row) => {
    if (!Array.isArray(row)) return [1];
    return row.map((v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    });
  });
  const width = Math.max(1, ...rows.map((r) => r.length));
  return rows.map((r) => {
    const out = r.slice(0, width);
    while (out.length < width) out.push(0);
    return out;
  });
}

/**
 * @param {unknown} raw
 * @returns {ParsedShape}
 */
export function parseShape(raw) {
  const matrix = normalizeMatrix(raw);
  const h = matrix.length;
  const w = matrix[0]?.length || 1;
  /** @type {Cell[]} */
  const body = [];
  /** @type {Cell[]} */
  const stars = [];
  /** @type {Cell[]} */
  const diamonds = [];
  /** @type {Cell[]} */
  const extensions = [];
  /** @type {Cell[]} */
  const tertiaries = [];
  /** @type {Cell[]} */
  const lightnings = [];

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const v = matrix[y][x];
      if (v === 1) body.push({ x, y });
      else if (v === 2) stars.push({ x, y });
      else if (v === 3) diamonds.push({ x, y });
      else if (v === 4) extensions.push({ x, y });
      else if (v === 5) tertiaries.push({ x, y });
      else if (v === 6) lightnings.push({ x, y });
    }
  }

  if (!body.length) {
    body.push({ x: 0, y: 0 });
    return {
      matrix: [[1]],
      w: 1,
      h: 1,
      body,
      stars: [],
      diamonds: [],
      extensions: [],
      tertiaries: [],
      lightnings: [],
      bodyCount: 1,
    };
  }

  return {
    matrix,
    w,
    h,
    body,
    stars,
    diamonds,
    extensions,
    tertiaries,
    lightnings,
    bodyCount: body.length,
  };
}

/**
 * Game FaceDirection: UP=0, RIGHT=1, DOWN=2, LEFT=3.
 * Godot / CSS use y-down; positive 90° is clockwise → (x,y) → (−y, x).
 * (y-up “CW” (y,−x) is the opposite on this grid and desyncs stars from CSS spin.)
 * All layers share one renormalization so stars stay glued to the body.
 *
 * @param {ParsedShape} shape
 * @param {number} face 0–3
 * @returns {ParsedShape}
 */
export function rotateShape(shape, face) {
  const steps = ((Number(face) || 0) % 4 + 4) % 4;
  if (!steps) return shape;

  /** @type {{ x: number, y: number, v: number }[]} */
  const tagged = [];
  const push = (cells, v) => {
    for (const c of cells) tagged.push({ x: c.x, y: c.y, v });
  };
  push(shape.body, 1);
  push(shape.stars, 2);
  push(shape.diamonds, 3);
  push(shape.extensions, 4);
  push(shape.tertiaries, 5);
  push(shape.lightnings, 6);

  let pts = tagged;
  for (let s = 0; s < steps; s += 1) {
    // 90° CW y-down (Godot +π/2 / CSS rotate(90deg)): (x, y) → (−y, x)
    pts = pts.map((c) => ({ x: -c.y, y: c.x, v: c.v }));
  }

  let minX = Infinity;
  let minY = Infinity;
  for (const c of pts) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
  }
  pts = pts.map((c) => ({ x: c.x - minX, y: c.y - minY, v: c.v }));

  /** @type {Cell[]} */
  const body = [];
  /** @type {Cell[]} */
  const stars = [];
  /** @type {Cell[]} */
  const diamonds = [];
  /** @type {Cell[]} */
  const extensions = [];
  /** @type {Cell[]} */
  const tertiaries = [];
  /** @type {Cell[]} */
  const lightnings = [];
  let maxX = 0;
  let maxY = 0;
  for (const c of pts) {
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxY) maxY = c.y;
    const cell = { x: c.x, y: c.y };
    if (c.v === 1) body.push(cell);
    else if (c.v === 2) stars.push(cell);
    else if (c.v === 3) diamonds.push(cell);
    else if (c.v === 4) extensions.push(cell);
    else if (c.v === 5) tertiaries.push(cell);
    else if (c.v === 6) lightnings.push(cell);
  }

  const w = maxX + 1;
  const h = maxY + 1;
  /** @type {number[][]} */
  const matrix = Array.from({ length: h }, () => Array(w).fill(0));
  for (const c of pts) {
    if (matrix[c.y]) matrix[c.y][c.x] = c.v;
  }

  return {
    matrix,
    w,
    h,
    body,
    stars,
    diamonds,
    extensions,
    tertiaries,
    lightnings,
    bodyCount: body.length,
  };
}

/**
 * Parse + cache on the item so pack/paint don't redo matrix work every filter.
 * @param {object} item
 * @param {number} [face] FaceDirection 0–3
 * @returns {ParsedShape}
 */
export function shapeForItem(item, face = 0) {
  if (!item || typeof item !== 'object') return parseShape(null);
  const r = ((Number(face) || 0) % 4 + 4) % 4;
  if (!item.__bpbShape) item.__bpbShape = parseShape(item.shape);
  if (!r) return item.__bpbShape;
  if (!item.__bpbShapeRot) item.__bpbShapeRot = Object.create(null);
  if (!item.__bpbShapeRot[r]) {
    item.__bpbShapeRot[r] = rotateShape(item.__bpbShape, r);
  }
  return item.__bpbShapeRot[r];
}

/**
 * Axis-aligned bounds of body cells only.
 * @param {ParsedShape} shape
 */
export function bodyBounds(shape) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of shape.body) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxY) maxY = c.y;
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
  };
}

/**
 * Map face-0 local mark (lx, ly) to board cells — same math as stampAffectCells().
 * @param {object} item
 * @param {{ x?: number, y?: number, r?: number }} placement
 * @param {number} lx
 * @param {number} ly
 * @param {number} [cellPx]
 */
export function shapeMarkToBoard(item, placement, lx, ly, cellPx = 80) {
  const px = Number(placement.x) || 0;
  const py = Number(placement.y) || 0;
  const face = ((Number(placement.r) || 0) % 4 + 4) % 4;
  const up = shapeForItem(item, 0);
  const upBounds = bodyBounds(up);
  const rotBounds = face ? bodyBounds(shapeForItem(item, face)) : upBounds;
  const cx = px + rotBounds.w / 2;
  const cy = py + rotBounds.h / 2;
  const bw = upBounds.w;
  const bh = upBounds.h;
  let ox = lx + 0.5 - bw / 2;
  let oy = ly + 0.5 - bh / 2;
  for (let s = 0; s < face; s += 1) {
    const nx = -oy;
    const ny = ox;
    ox = nx;
    oy = ny;
  }
  const boardX = Math.floor(cx + ox);
  const boardY = Math.floor(cy + oy);
  return {
    boardX,
    boardY,
    cell: `${boardX},${boardY}`,
    cx: (boardX + 0.5) * cellPx,
    cy: (boardY + 0.5) * cellPx,
  };
}
