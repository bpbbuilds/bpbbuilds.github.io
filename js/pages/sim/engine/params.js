/**
 * ItemData params — mirrors game Item.getP / getP1…getP10.
 * DB stores named keys (`poisont`) plus column indexes (`p1`…`p10`).
 */

/**
 * @param {unknown} params
 * @returns {Record<string, number>}
 */
export function normalizeParams(params) {
  if (!params || typeof params !== 'object') return {};
  /** @type {Record<string, number>} */
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

/**
 * getP(index) — 0-based like GDScript getP(index) / getP1 = getP(0).
 * Prefers `p{n}` keys, else nth named non-pN key (insertion order).
 * @param {Record<string, number> | null | undefined} params
 * @param {number} index0
 * @param {number} [fallback=0]
 */
export function getP(params, index0, fallback = 0) {
  const p = params || {};
  const n = index0 + 1;
  if (p[`p${n}`] != null && Number.isFinite(Number(p[`p${n}`]))) {
    return Number(p[`p${n}`]);
  }
  const named = Object.keys(p).filter((k) => !/^p\d+$/i.test(k));
  if (named[index0] != null && Number.isFinite(Number(p[named[index0]]))) {
    return Number(p[named[index0]]);
  }
  return fallback;
}

/** @param {Record<string, number> | null | undefined} params @param {number} [fb] */
export function getP1(params, fb = 0) {
  return getP(params, 0, fb);
}
/** @param {Record<string, number> | null | undefined} params @param {number} [fb] */
export function getP2(params, fb = 0) {
  return getP(params, 1, fb);
}
/** @param {Record<string, number> | null | undefined} params @param {number} [fb] */
export function getP3(params, fb = 0) {
  return getP(params, 2, fb);
}
/** @param {Record<string, number> | null | undefined} params @param {number} [fb] */
export function getP4(params, fb = 0) {
  return getP(params, 3, fb);
}
/** @param {Record<string, number> | null | undefined} params @param {number} [fb] */
export function getP5(params, fb = 0) {
  return getP(params, 4, fb);
}
/** @param {Record<string, number> | null | undefined} params @param {number} [fb] */
export function getP6(params, fb = 0) {
  return getP(params, 5, fb);
}

/**
 * Named param lookup (e.g. `poisont`, `cd`).
 * @param {Record<string, number> | null | undefined} params
 * @param {string} name
 * @param {number} [fallback=0]
 */
export function getPName(params, name, fallback = 0) {
  const p = params || {};
  if (p[name] != null && Number.isFinite(Number(p[name]))) return Number(p[name]);
  return fallback;
}

/**
 * @param {object | null | undefined} item catalog item
 */
export function paramsFromItem(item) {
  return normalizeParams(item?.params);
}
