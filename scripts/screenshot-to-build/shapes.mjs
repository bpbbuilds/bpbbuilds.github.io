import fs from 'fs';
import path from 'path';
import { ROOT } from './catalog.mjs';

/**
 * Minimal port of backpack-grid shape body bbox helpers (script-side, no browser).
 */

const FALLBACK = [[1]];

/**
 * @param {unknown} raw
 * @returns {number[][]}
 */
function normalizeMatrix(raw) {
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
 */
function parseShape(raw) {
  const matrix = normalizeMatrix(raw);
  const h = matrix.length;
  const w = matrix[0]?.length || 1;
  /** @type {{ x: number, y: number }[]} */
  const body = [];
  /** @type {{ x: number, y: number, v: number }[]} */
  const tagged = [];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const v = matrix[y][x];
      if (v === 1) body.push({ x, y });
      if (v > 0) tagged.push({ x, y, v });
    }
  }
  if (!body.length) {
    return { body: [{ x: 0, y: 0 }], tagged: [{ x: 0, y: 0, v: 1 }] };
  }
  return { body, tagged };
}

/**
 * Face 0–3 = 0/90/180/270 CW y-down.
 * @param {{ body: { x: number, y: number }[], tagged: { x: number, y: number, v: number }[] }} shape
 * @param {number} face
 */
function rotateShape(shape, face) {
  const steps = ((Number(face) || 0) % 4 + 4) % 4;
  if (!steps) return shape;
  let pts = shape.tagged;
  for (let s = 0; s < steps; s += 1) {
    pts = pts.map((c) => ({ x: -c.y, y: c.x, v: c.v }));
  }
  let minX = Infinity;
  let minY = Infinity;
  for (const c of pts) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
  }
  pts = pts.map((c) => ({ x: c.x - minX, y: c.y - minY, v: c.v }));
  const body = pts.filter((c) => c.v === 1).map((c) => ({ x: c.x, y: c.y }));
  return { body, tagged: pts };
}

/**
 * @param {{ x: number, y: number }[]} body
 */
function bodyBounds(body) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of body) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxY) maxY = c.y;
  }
  if (!body.length) return { w: 1, h: 1 };
  return { w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * @typedef {{ w: number, h: number, rot: number }} Footprint
 * @typedef {{
 *   byId: Map<string, Footprint[]>,
 *   byName: Map<string, Footprint[]>,
 *   bySizeKey: Map<string, string[]>,
 * }} ShapeIndex
 */

/**
 * @param {number} w
 * @param {number} h
 */
export function sizeKey(w, h) {
  return `${Number(w) || 1}x${Number(h) || 1}`;
}

/**
 * @param {{ id: string, name: string, image: string }[]} catalog
 * @returns {ShapeIndex}
 */
export function loadShapeIndex(catalog) {
  const raw = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'assets/data/item-shapes.json'), 'utf8'),
  );
  const byImage = raw.byImage || {};
  const byIdRaw = raw.byId || {};

  /** @type {Map<string, Footprint[]>} */
  const byId = new Map();
  /** @type {Map<string, Footprint[]>} */
  const byName = new Map();
  /** @type {Map<string, Set<string>>} */
  const sizeSets = new Map();

  for (const item of catalog) {
    const matrix =
      byIdRaw[item.id] ||
      byImage[`${item.image}.png`] ||
      byImage[item.image] ||
      null;
    const base = parseShape(matrix);
    /** @type {Footprint[]} */
    const fps = [];
    /** @type {Set<string>} */
    const seen = new Set();
    for (let face = 0; face < 4; face += 1) {
      const rotDeg = face * 90;
      const sh = rotateShape(base, face);
      const b = bodyBounds(sh.body);
      const k = sizeKey(b.w, b.h);
      if (seen.has(`${k}@${rotDeg}`)) continue;
      seen.add(`${k}@${rotDeg}`);
      fps.push({ w: b.w, h: b.h, rot: rotDeg });
      if (!sizeSets.has(k)) sizeSets.set(k, new Set());
      sizeSets.get(k).add(item.name);
    }
    byId.set(item.id, fps);
    byName.set(item.name, fps);
  }

  /** @type {Map<string, string[]>} */
  const bySizeKey = new Map();
  for (const [k, set] of sizeSets) {
    bySizeKey.set(k, [...set].sort((a, b) => a.localeCompare(b)));
  }

  return { byId, byName, bySizeKey };
}

/**
 * @param {ShapeIndex} index
 * @param {string} itemId
 * @param {number} sizeW
 * @param {number} sizeH
 * @param {number | null | undefined} visionRot
 */
export function validateFootprint(index, itemId, sizeW, sizeH, visionRot) {
  const fps = index.byId.get(itemId) || [];
  if (!fps.length) {
    return { ok: true, reason: 'no_shape', matchedRot: visionRot ?? 0 };
  }
  const w = Math.max(1, Math.round(Number(sizeW) || 1));
  const h = Math.max(1, Math.round(Number(sizeH) || 1));
  const matches = fps.filter((f) => f.w === w && f.h === h);
  if (!matches.length) {
    return { ok: false, reason: 'shape_mismatch', matchedRot: null, allowed: fps };
  }
  const want = Number(visionRot);
  const prefer = matches.find((f) => f.rot === want) || matches[0];
  return { ok: true, reason: 'ok', matchedRot: prefer.rot, allowed: fps };
}

/**
 * Catalog body footprint for an item, preferring a rotation.
 * @param {ShapeIndex} index
 * @param {string} itemId
 * @param {number | null | undefined} preferredRotDeg
 * @returns {{ w: number, h: number, rot: number } | null}
 */
export function catalogFootprint(index, itemId, preferredRotDeg) {
  const fps = index.byId.get(itemId) || [];
  if (!fps.length) return null;
  const want = Number(preferredRotDeg);
  const prefer =
    (Number.isFinite(want) ? fps.find((f) => f.rot === want) : null) ||
    fps.find((f) => f.rot === 0) ||
    fps[0];
  return prefer ? { w: prefer.w, h: prefer.h, rot: prefer.rot } : null;
}

/**
 * Static lookalike groups for shortlist enrichment.
 */
export const SABER_BLADES = [
  'Darksaber',
  'Lightsaber',
  'Hungry Blade',
  'Manathirst',
  'Bloodthorne',
  'Spectral Dagger',
  'Null Blade',
];

/** Gold / winged swords — Falcon art spans ~5×5 with stars; body is only 1×3. */
export const WINGED_SWORDS = [
  'Falcon Blade',
  'Hero Longsword',
  'Hero Sword',
  'Burning Blade',
  'Prismatic Sword',
  'Villain Sword',
];

export const CONFUSION_GROUPS = [
  SABER_BLADES,
  WINGED_SWORDS,
  ['Dark Lantern', 'Oil Lamp', 'Amulet of Energy', 'Amulet of Life', 'Amulet of Darkness', 'Torch'],
  ['Bunch of Coins', 'Gloves of Haste', 'Magic Ring', 'Stone Gloves'],
  ['Corrupted Armor', 'Vampiric Armor', 'Leather Armor', 'Holy Armor'],
  ['Stone', 'Whetstone', 'Bag of Stones'],
  ['Piggybank', 'Lucky Piggy', 'Piggy of Riches', 'Piggy Pinata'],
  ['Mana Orb', 'Prismatic Orb', 'Draconic Orb', 'Devouring Sphere'],
  ['Magic Mirror', 'Cold Mirror', 'Amulet of Steel'],
  ['Phoenix', 'Flame', 'Frozen Flame'],
  ['Star of Courage', 'Flame Badge', 'Stone Badge'],
  ['Treasure Chest', 'Piggybank', 'Lucky Piggy'],
];

/**
 * True when catalog name is a winged/gold sword lookalike (Falcon cluster).
 * @param {string} name
 */
export function isWingedSword(name) {
  return WINGED_SWORDS.includes(String(name || ''));
}

/**
 * Catalog long-side (max body bbox) for ranking saber shortlists.
 * @param {ShapeIndex} index
 * @param {string} name
 */
function catalogLongSide(index, name) {
  const fps = index.byName.get(name) || [];
  if (!fps.length) return 0;
  let best = 0;
  for (const f of fps) best = Math.max(best, f.w, f.h);
  return best;
}

/**
 * @param {ShapeIndex} index
 * @param {{ name?: string, sizeW?: number, sizeH?: number }} proposed
 * @param {string[]} catalogNames
 * @param {number} [cap]
 */
export function buildShortlist(index, proposed, catalogNames, cap = 8) {
  const nameSet = new Set(catalogNames);
  /** @type {string[]} */
  const out = [];
  const add = (n) => {
    if (!n || !nameSet.has(n) || out.includes(n)) return;
    out.push(n);
  };

  if (proposed.name) add(proposed.name);

  // Confusion lookalikes first (highest value)
  for (const group of CONFUSION_GROUPS) {
    if (!proposed.name || !group.includes(proposed.name)) continue;
    for (const n of group) add(n);
  }

  // Long thin footprint → ensure saber cluster is present even if proposed name was wrong
  const w = Math.max(1, Math.round(Number(proposed.sizeW) || 1));
  const h = Math.max(1, Math.round(Number(proposed.sizeH) || 1));
  const visionLong = Math.max(w, h);
  const isLongThin = visionLong >= 3 && Math.min(w, h) === 1;
  const proposedSaber = Boolean(proposed.name && SABER_BLADES.includes(proposed.name));
  const proposedWinged = Boolean(proposed.name && WINGED_SWORDS.includes(proposed.name));
  // Purple energy sabers (esp. 1×4). Skip auto-inject when the claim is already a winged gold sword.
  if ((isLongThin && !proposedWinged) || proposedSaber) {
    for (const n of SABER_BLADES) add(n);
  }
  // 1×3 / winged gold sword claims → keep Falcon cluster in the shortlist
  if (proposedWinged || (isLongThin && visionLong === 3) || /\b(falcon|wing|feather|gem)\b/i.test(String(proposed.name || ''))) {
    for (const n of WINGED_SWORDS) add(n);
  }

  const claimedKey = sizeKey(w, h);
  const sameSize = index.bySizeKey.get(claimedKey) || [];

  const listed = new Set(out);
  const inAnyConfusionWithListed = (n) =>
    CONFUSION_GROUPS.some((g) => g.includes(n) && g.some((x) => listed.has(x) || x === proposed.name));

  const tokens = String(proposed.name || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);

  const ranked = sameSize
    .filter((n) => n !== proposed.name)
    .map((n) => {
      let score = 0;
      if (inAnyConfusionWithListed(n)) score += 10;
      const ln = n.toLowerCase();
      for (const t of tokens) if (ln.includes(t)) score += 3;
      if (sameSize.length <= 12) score += 2;
      else if (sameSize.length <= 40) score += 1;
      return { n, score };
    })
    .sort((a, b) => b.score - a.score || a.n.localeCompare(b.n));

  for (const { n, score } of ranked) {
    if (score <= 0 && sameSize.length > 40) continue;
    add(n);
  }

  const fps = proposed.name ? index.byName.get(proposed.name) || [] : [];
  for (const f of fps) {
    for (const n of index.bySizeKey.get(sizeKey(f.w, f.h)) || []) {
      if (CONFUSION_GROUPS.some((g) => g.includes(n) && g.includes(proposed.name || ''))) add(n);
    }
  }

  // Prefer catalog long-side match for sabers / long-thin claims (Darksaber 4 vs Hungry 3)
  const saberContext = proposedSaber || (isLongThin && !proposedWinged && visionLong >= 4);
  const wingedContext = proposedWinged || (isLongThin && visionLong === 3);
  if (saberContext && visionLong >= 2) {
    out.sort((a, b) => {
      const aSaber = SABER_BLADES.includes(a) ? 1 : 0;
      const bSaber = SABER_BLADES.includes(b) ? 1 : 0;
      if (aSaber !== bSaber) return bSaber - aSaber;
      const aMatch = catalogLongSide(index, a) === visionLong ? 1 : 0;
      const bMatch = catalogLongSide(index, b) === visionLong ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      // Prefer Darksaber/Lightsaber when long side is 4
      if (visionLong >= 4) {
        const aDark = a === 'Darksaber' || a === 'Lightsaber' ? 1 : 0;
        const bDark = b === 'Darksaber' || b === 'Lightsaber' ? 1 : 0;
        if (aDark !== bDark) return bDark - aDark;
      }
      return 0;
    });
  } else if (wingedContext) {
    out.sort((a, b) => {
      const aWing = WINGED_SWORDS.includes(a) ? 1 : 0;
      const bWing = WINGED_SWORDS.includes(b) ? 1 : 0;
      if (aWing !== bWing) return bWing - aWing;
      const aFalcon = a === 'Falcon Blade' ? 1 : 0;
      const bFalcon = b === 'Falcon Blade' ? 1 : 0;
      if (aFalcon !== bFalcon) return bFalcon - aFalcon;
      return 0;
    });
  }

  return out.slice(0, cap);
}
