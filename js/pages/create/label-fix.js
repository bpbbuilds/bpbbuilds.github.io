/**
 * Re-open a saved label (create ?label=1&fix=real-001) without re-running the detector.
 * While this is active, the create draft is not written to localStorage.
 */

import { newPlacementKey } from './draft-io.js';
import { shapeForItem } from '../../shared/backpack-grid/shape.js';
import { isBagItem, isGemItem, placementBodyCells } from './collision.js';
import { isUnrecognizedId } from './screenshot-unrecognized.js?v=fa3633b';

export const FIX_HOLD_KEY = 'bpb-label-fix-hold';

export function fixStemFromUrl() {
  try {
    const raw = new URLSearchParams(window.location.search).get('fix') || '';
    return /^real-\d{3}$/.test(raw) ? raw : '';
  } catch {
    return '';
  }
}

export function holdCreateDraft() {
  try {
    sessionStorage.setItem(FIX_HOLD_KEY, '1');
  } catch {
    /* private mode */
  }
}

export function releaseCreateDraft() {
  try {
    sessionStorage.removeItem(FIX_HOLD_KEY);
  } catch {
    /* private mode */
  }
}

/**
 * @param {{ name?: string, x?: number, y?: number, r?: number | null, gems?: ({ name?: string, r?: number } | null)[] }} row
 * @param {Map<string, object>} byName
 * @param {string} key
 * @returns {{ placement: import('./draft-io.js').DraftPlacement | null, missing: string[] }}
 */
export function placementFromTruthRow(row, byName, key) {
  /** @type {string[]} */
  const missing = [];
  const name = String(row?.name || '').trim();
  const item = byName.get(name.toLowerCase());
  if (!item) {
    if (name) missing.push(name);
    return { placement: null, missing };
  }
  const face = row.r == null ? 0 : Number(row.r);
  /** @type {import('./draft-io.js').DraftPlacement} */
  const placement = {
    id: String(item.id),
    x: Number(row.x) || 0,
    y: Number(row.y) || 0,
    r: Number.isFinite(face) ? ((face % 4) + 4) % 4 : 0,
    key,
    priority: null,
  };
  if (Array.isArray(row.gems)) {
    /** @type {string[]} */
    const gems = [];
    /** @type {number[]} */
    const gemR = [];
    for (const slot of row.gems) {
      const gemName = String(slot?.name || '').trim();
      if (!gemName) {
        gems.push('');
        gemR.push(0);
        continue;
      }
      const gem = byName.get(gemName.toLowerCase());
      if (!gem) {
        missing.push(gemName);
        gems.push('');
        gemR.push(0);
        continue;
      }
      const gemFace = Number(slot?.r) || 0;
      gems.push(String(gem.id));
      gemR.push(Number.isFinite(gemFace) ? ((gemFace % 4) + 4) % 4 : 0);
    }
    if (gems.some(Boolean)) {
      placement.gems = gems;
      placement.gemR = gemR;
    }
  }
  return { placement, missing };
}

/**
 * @param {object[]} rows
 * @param {Map<string, object>} byName
 */
function rowsToPlacements(rows, byName) {
  /** @type {import('./draft-io.js').DraftPlacement[]} */
  const placements = [];
  /** @type {string[]} */
  const missing = [];
  for (const row of rows) {
    const built = placementFromTruthRow(row, byName, newPlacementKey());
    missing.push(...built.missing);
    if (built.placement) placements.push(built.placement);
  }
  return { placements, missing };
}

/**
 * Socket gems live on the host, not as their own board pieces.
 * @param {{ gems?: string[], gemR?: number[] }} placement
 * @param {Map<string, object>} itemsById
 * @returns {({ name: string, r: number } | null)[] | null}
 */
function socketsFromPlacement(placement, itemsById) {
  if (!Array.isArray(placement.gems)) return null;
  let any = false;
  const gems = placement.gems.map((id, i) => {
    const gemId = id == null ? '' : String(id);
    if (!gemId) return null;
    const gem = itemsById.get(gemId);
    if (!gem) return null;
    any = true;
    const face = Number(placement.gemR?.[i]) || 0;
    return {
      name: String(gem.name || gemId),
      r: Number.isFinite(face) ? ((face % 4) + 4) % 4 : 0,
    };
  });
  return any ? gems : null;
}

/**
 * Skills and socketed gems are stored so the label board can show them.
 * Skills stay off `items` because the screenshot scorer only reads that list.
 * @param {{ id: string, x: number, y: number, r?: number, gems?: string[], gemR?: number[] }[]} placements
 * @param {Map<string, object>} itemsById
 */
export function truthFromPlacements(placements, itemsById) {
  /** @type {{ name: string, x: number, y: number, r: number | null, gems?: ({ name: string, r: number } | null)[] }[]} */
  const items = [];
  /** @type {{ name: string, x: number, y: number, r: number | null, gems?: ({ name: string, r: number } | null)[] }[]} */
  const skills = [];
  /** @type {{ name: string, x: number, y: number, r: number }[]} */
  const jewels = [];
  /** @type {{ name: string, x: number, y: number, r: number }[]} */
  const bags = [];
  /** @type {Set<string>} */
  const bagCells = new Set();
  let unrecognized = 0;
  for (const p of placements) {
    if (isUnrecognizedId(p.id)) {
      unrecognized += 1;
      continue;
    }
    const item = itemsById.get(String(p.id));
    if (!item) continue;
    const name = String(item.name || p.id);
    if (isBagItem(item)) {
      bags.push({ name, x: p.x, y: p.y, r: p.r || 0 });
      for (const c of placementBodyCells(item, p)) bagCells.add(`${c.x},${c.y}`);
      continue;
    }
    const face = Number(p.r) || 0;
    const r = ((face % 4) + 4) % 4;
    // Jewels sitting in the backpack are their own pieces. Socketed ones stay on the host.
    if (isGemItem(item)) {
      jewels.push({ name, x: p.x, y: p.y, r });
      continue;
    }
    // A lone cell looks the same turned. A star shell (Shiny Shell, skills) does not.
    const shape = shapeForItem(item, 0);
    const plainDot = shape.body.length === 1
      && !shape.stars.length
      && !shape.diamonds.length
      && !shape.extensions.length
      && !shape.tertiaries.length
      && !shape.lightnings.length;
    const skill = String(item.type || '') === 'Skill';
    /** @type {{ name: string, x: number, y: number, r: number | null, gems?: ({ name: string, r: number } | null)[] }} */
    const row = { name, x: p.x, y: p.y, r: skill || !plainDot ? r : null };
    const sockets = socketsFromPlacement(p, itemsById);
    if (sockets) row.gems = sockets;
    if (skill) skills.push(row);
    else items.push(row);
  }
  return { items, skills, jewels, bags, bagCells: [...bagCells], unrecognized };
}

/**
 * @param {string} stem
 * @param {Map<string, object>} itemsById
 */
export async function loadFixFixture(stem, itemsById) {
  /** @type {Map<string, object>} */
  const byName = new Map();
  for (const item of itemsById.values()) {
    const key = String(item.name || '').trim().toLowerCase();
    if (key && !byName.has(key)) byName.set(key, item);
  }
  const [pngRes, truthRes] = await Promise.all([
    fetch(`/fixtures/${stem}.png`, { cache: 'no-store' }),
    fetch(`/fixtures/${stem}.truth.json`, { cache: 'no-store' }),
  ]);
  if (!pngRes.ok) throw new Error(`Couldn't load ${stem}.png`);
  const file = await pngRes.blob();
  /** @type {any} */
  let truth = null;
  if (truthRes.ok) {
    const text = (await truthRes.text()).trim();
    if (text) truth = JSON.parse(text);
  }
  const bags = Array.isArray(truth?.bags) ? truth.bags : [];
  const items = Array.isArray(truth?.items) ? truth.items : [];
  const skills = Array.isArray(truth?.skills) ? truth.skills : [];
  const jewels = Array.isArray(truth?.jewels) ? truth.jewels : [];
  const bagPlaced = rowsToPlacements(bags, byName);
  const itemPlaced = rowsToPlacements(items, byName);
  const skillPlaced = rowsToPlacements(skills, byName);
  const jewelPlaced = rowsToPlacements(jewels, byName);
  const split = truth?.split === 'test' || truth?.split === 'train' ? truth.split : '';
  return {
    file,
    placements: [
      ...bagPlaced.placements,
      ...itemPlaced.placements,
      ...skillPlaced.placements,
      ...jewelPlaced.placements,
    ],
    missing: [
      ...bagPlaced.missing,
      ...itemPlaced.missing,
      ...skillPlaced.missing,
      ...jewelPlaced.missing,
    ],
    split,
    source: typeof truth?.source === 'string' ? truth.source : '',
    empty: !bags.length && !items.length && !skills.length && !jewels.length,
    shotUrl: URL.createObjectURL(file),
  };
}
