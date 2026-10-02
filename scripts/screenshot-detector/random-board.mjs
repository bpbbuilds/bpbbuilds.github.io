/**
 * Random legal-ish boards for rare-item coverage + bag-only dense mosaics.
 */
import { BOARD_COLS, BOARD_ROWS, placementAabb } from './paint-node.mjs';
import { loadShapeIndex } from '../screenshot-to-build/shapes.mjs';

/**
 * @param {number} [seed]
 */
function makeRnd(seed = Math.random()) {
  let a = (seed * 1e9) | 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @template T
 * @param {T[]} arr
 * @param {() => number} rnd
 */
function shuffle(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

/** Prefer these bags appear early in the unique shuffle (lookalike / common fails). */
const BAG_PRIORITY_NAMES = new Set([
  'Box of Cogs',
  'Box of Prosperity',
  'Storage Coffin',
  'Leather Bag',
  'Ranger Bag',
  'Fire Pit',
  'Offering Bowl',
]);

/**
 * @param {Map<string, { id: string, type: string, name?: string }>} catalogById
 * @param {{ id: string }[]} classItems  detector classes
 * @param {number} [seed]
 */
export function randomBoard(catalogById, classItems, seed = Math.random()) {
  const rnd = makeRnd(seed);
  const shapeIndex = loadShapeIndex([...catalogById.values()]);
  /** @type {Set<string>} */
  const occupied = new Set();
  /** @type {{ id: string, x: number, y: number, r: number }[]} */
  const placements = [];

  const bags = classItems.filter((c) => catalogById.get(c.id)?.type === 'Bag');
  const others = classItems.filter((c) => {
    const t = catalogById.get(c.id)?.type || '';
    return t !== 'Bag';
  });
  const skills = others.filter((c) => catalogById.get(c.id)?.type === 'Skill');
  const jewels = others.filter((c) => {
    const t = catalogById.get(c.id)?.type || '';
    return t === 'Gem' || t.includes('Gemstone');
  });
  const regular = others.filter((c) => {
    const t = catalogById.get(c.id)?.type || '';
    return t !== 'Skill' && t !== 'Gem' && !t.includes('Gemstone');
  });

  // Unique bag IDs — 1–2 distinct bags
  const bagOrder = shuffle(bags, rnd);
  const bagCount = bags.length ? 1 + (rnd() < 0.35 ? 1 : 0) : 0;
  /** @type {Set<string>} */
  const usedBagIds = new Set();
  for (let i = 0; i < bagOrder.length && usedBagIds.size < bagCount; i++) {
    const bag = bagOrder[i];
    if (usedBagIds.has(bag.id)) continue;
    const r = (rnd() * 4) | 0;
    const placed = tryPlace(bag.id, r, occupied, shapeIndex, rnd, true);
    if (placed) {
      placements.push(placed);
      usedBagIds.add(bag.id);
    }
  }

  const bagCells = new Set(occupied);
  const itemOrder = shuffle(regular, rnd);
  const nItems = 4 + ((rnd() * 12) | 0);
  /** @type {Set<string>} */
  const usedItemIds = new Set();
  for (let i = 0; i < itemOrder.length && usedItemIds.size < nItems; i++) {
    const item = itemOrder[i];
    if (usedItemIds.has(item.id)) continue;
    const r = (rnd() * 4) | 0;
    const placed = tryPlace(item.id, r, occupied, shapeIndex, rnd, false, bagCells);
    if (placed) {
      placements.push(placed);
      usedItemIds.add(item.id);
    }
  }
  placeQuota(skills, 2, occupied, bagCells, shapeIndex, rnd, placements, usedItemIds);
  placeQuota(jewels, 3, occupied, bagCells, shapeIndex, rnd, placements, usedItemIds);

  return placements;
}

/**
 * Near-empty / hard negative boards.
 */
export function sparseBoard(catalogById, classItems, seed = Math.random()) {
  const full = randomBoard(catalogById, classItems, seed);
  return full.slice(0, Math.max(0, 1 + ((seed * 3) | 0) % 3));
}

/**
 * Dense multi-bag mosaic with unique bag IDs (bag-only training).
 * @param {Map<string, { id: string, type: string, name?: string }>} catalogById
 * @param {{ id: string, name?: string }[]} bagClasses
 * @param {number} [seed]
 * @param {{ targetMin?: number, targetMax?: number }} [opts]
 */
export function denseBagBoard(catalogById, bagClasses, seed = Math.random(), opts = {}) {
  const rnd = makeRnd(seed);
  const shapeIndex = loadShapeIndex([...catalogById.values()]);
  /** @type {Set<string>} */
  const occupied = new Set();
  /** @type {{ id: string, x: number, y: number, r: number }[]} */
  const placements = [];

  const targetMin = Math.max(3, Number(opts.targetMin) || 8);
  const targetMax = Math.max(targetMin, Number(opts.targetMax) || 15);

  const prioritized = bagClasses.filter((c) =>
    BAG_PRIORITY_NAMES.has(String(catalogById.get(c.id)?.name || c.name || '')),
  );
  const rest = bagClasses.filter(
    (c) => !BAG_PRIORITY_NAMES.has(String(catalogById.get(c.id)?.name || c.name || '')),
  );
  const bagOrder = [...shuffle(prioritized, rnd), ...shuffle(rest, rnd)];

  const want = targetMin + ((rnd() * (targetMax - targetMin + 1)) | 0);
  /** @type {Set<string>} */
  const used = new Set();
  for (const bag of bagOrder) {
    if (used.size >= want) break;
    if (used.has(bag.id)) continue;
    const r = (rnd() * 4) | 0;
    const placed = tryPlace(bag.id, r, occupied, shapeIndex, rnd, true);
    if (placed) {
      placements.push(placed);
      used.add(bag.id);
    }
  }
  // Second pass: fill remaining holes with unused bags (still unique)
  for (const bag of shuffle(bagOrder, rnd)) {
    if (used.size >= targetMax) break;
    if (used.has(bag.id)) continue;
    const r = (rnd() * 4) | 0;
    const placed = tryPlace(bag.id, r, occupied, shapeIndex, rnd, true);
    if (placed) {
      placements.push(placed);
      used.add(bag.id);
    }
  }
  return placements;
}

/**
 * Dense unique bags + unique item distractors on fabric (labels should keep bags only).
 * @param {Map<string, { id: string, type: string, name?: string }>} catalogById
 * @param {{ id: string, name?: string }[]} bagClasses
 * @param {{ id: string }[]} itemClasses
 * @param {number} [seed]
 */
export function occludedBagBoard(
  catalogById,
  bagClasses,
  itemClasses,
  seed = Math.random(),
) {
  const rnd = makeRnd(seed);
  const bags = denseBagBoard(catalogById, bagClasses, seed, {
    targetMin: 7,
    targetMax: 14,
  });
  const shapeIndex = loadShapeIndex([...catalogById.values()]);
  /** @type {Set<string>} */
  const occupied = new Set();
  for (const p of bags) {
    const box = placementAabb(shapeIndex, p.id, { x: p.x, y: p.y, r: p.r || 0 });
    for (let dy = 0; dy < box.h; dy++) {
      for (let dx = 0; dx < box.w; dx++) {
        occupied.add(`${box.x + dx},${box.y + dy}`);
      }
    }
  }
  const bagCells = new Set(occupied);
  const items = itemClasses.filter((c) => {
    const t = catalogById.get(c.id)?.type || '';
    return t !== 'Bag' && t !== 'Gem' && !t.includes('Gemstone') && t !== 'Skill';
  });
  const itemOrder = shuffle(items, rnd);
  const nItems = 6 + ((rnd() * 14) | 0);
  /** @type {Set<string>} */
  const usedItems = new Set();
  /** @type {{ id: string, x: number, y: number, r: number }[]} */
  const itemPlacements = [];
  for (const item of itemOrder) {
    if (usedItems.size >= nItems) break;
    if (usedItems.has(item.id)) continue;
    const r = (rnd() * 4) | 0;
    const placed = tryPlace(item.id, r, occupied, shapeIndex, rnd, false, bagCells);
    if (placed) {
      itemPlacements.push(placed);
      usedItems.add(item.id);
    }
  }
  return [...bags, ...itemPlacements];
}

/**
 * Few unique bags (+ optional clutter) for hard negatives / floor false-positives.
 * @param {Map<string, { id: string, type: string, name?: string }>} catalogById
 * @param {{ id: string, name?: string }[]} bagClasses
 * @param {{ id: string }[]} itemClasses
 * @param {number} [seed]
 */
export function sparseBagBoard(
  catalogById,
  bagClasses,
  itemClasses,
  seed = Math.random(),
) {
  const rnd = makeRnd(seed);
  const bags = denseBagBoard(catalogById, bagClasses, seed, {
    targetMin: 1,
    targetMax: 3,
  });
  if (rnd() < 0.55) return bags;
  const shapeIndex = loadShapeIndex([...catalogById.values()]);
  /** @type {Set<string>} */
  const occupied = new Set();
  for (const p of bags) {
    const box = placementAabb(shapeIndex, p.id, { x: p.x, y: p.y, r: p.r || 0 });
    for (let dy = 0; dy < box.h; dy++) {
      for (let dx = 0; dx < box.w; dx++) {
        occupied.add(`${box.x + dx},${box.y + dy}`);
      }
    }
  }
  const bagCells = new Set(occupied);
  const items = shuffle(
    itemClasses.filter((c) => {
      const t = catalogById.get(c.id)?.type || '';
      return t !== 'Bag' && t !== 'Gem' && !t.includes('Gemstone');
    }),
    rnd,
  );
  /** @type {Set<string>} */
  const used = new Set();
  const out = bags.slice();
  const n = 2 + ((rnd() * 5) | 0);
  for (const item of items) {
    if (used.size >= n) break;
    if (used.has(item.id)) continue;
    const placed = tryPlace(
      item.id,
      (rnd() * 4) | 0,
      occupied,
      shapeIndex,
      rnd,
      false,
      bagCells,
    );
    if (placed) {
      out.push(placed);
      used.add(item.id);
    }
  }
  return out;
}

/**
 * @param {{ id: string }[]} pool
 * @param {number} maxN
 * @param {Set<string>} occupied
 * @param {Set<string>} bagCells
 * @param {any} shapeIndex
 * @param {() => number} rnd
 * @param {{ id: string, x: number, y: number, r: number }[]} placements
 * @param {Set<string>} usedItemIds
 */
function placeQuota(pool, maxN, occupied, bagCells, shapeIndex, rnd, placements, usedItemIds) {
  const want = (rnd() * (maxN + 1)) | 0;
  if (!want || !pool.length) return;
  let got = 0;
  for (const item of shuffle(pool, rnd)) {
    if (got >= want) break;
    if (usedItemIds.has(item.id)) continue;
    const placed = tryPlace(item.id, (rnd() * 4) | 0, occupied, shapeIndex, rnd, false, bagCells);
    if (placed) {
      placements.push(placed);
      usedItemIds.add(item.id);
      got += 1;
    }
  }
}

/**
 * @param {string} id
 * @param {number} r
 * @param {Set<string>} occupied
 * @param {any} shapeIndex
 * @param {() => number} rnd
 * @param {boolean} isBag
 * @param {Set<string>} [bagCells]
 */
function tryPlace(id, r, occupied, shapeIndex, rnd, isBag, bagCells) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const x = (rnd() * BOARD_COLS) | 0;
    const y = (rnd() * BOARD_ROWS) | 0;
    const box = placementAabb(shapeIndex, id, { x, y, r });
    if (box.x + box.w > BOARD_COLS || box.y + box.h > BOARD_ROWS) continue;
    /** @type {string[]} */
    const cells = [];
    let ok = true;
    for (let dy = 0; dy < box.h; dy++) {
      for (let dx = 0; dx < box.w; dx++) {
        const k = `${box.x + dx},${box.y + dy}`;
        if (occupied.has(k)) {
          ok = false;
          break;
        }
        if (!isBag && bagCells && bagCells.size && !bagCells.has(k)) {
          ok = false;
          break;
        }
        cells.push(k);
      }
      if (!ok) break;
    }
    if (!ok) continue;
    for (const k of cells) occupied.add(k);
    return { id, x: box.x, y: box.y, r };
  }
  return null;
}
