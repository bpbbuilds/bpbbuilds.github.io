/**
 * Bounded decoded-sprite cache for the Home promo boards.
 *
 * The Player Info loop only needs the active and next build. Keeping the
 * build/source association here lets the assembler warm the next build before
 * its first paint while evicting sprites from older random cycles.
 */

export const DEFAULT_PROMO_SPRITE_CACHE_BUILDS = 2;
export const DEFAULT_PROMO_SPRITE_CACHE_ENTRIES = 192;

/** @param {unknown} value @param {number} fallback @param {number} min */
function positiveInt(value, fallback, min = 1) {
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(min, Math.floor(next)) : fallback;
}
/**
 * @param {{
 *   maxBuilds?: number,
 *   maxEntries?: number,
 *   createImage?: () => object,
 * }} [options]
 */
export function createPromoSpriteCache(options = {}) {
  const maxBuilds = positiveInt(
    options.maxBuilds,
    DEFAULT_PROMO_SPRITE_CACHE_BUILDS,
  );
  const maxEntries = positiveInt(
    options.maxEntries,
    DEFAULT_PROMO_SPRITE_CACHE_ENTRIES,
  );
  const createImage = typeof options.createImage === 'function'
    ? options.createImage
    : () => new Image();

  /** @type {Map<string, { image: object, touched: number }>} */
  const entries = new Map();
  /** @type {Map<string, Set<string>>} */
  const buildSources = new Map();
  /** @type {Map<string, Promise<void>>} */
  const pending = new Map();
  let retainedBuilds = [];
  let clock = 0;

  /** @param {unknown} value */
  const keyOf = (value) => String(value == null ? '' : value).trim();

  /** @param {string} src */
  const touch = (src) => {
    const entry = entries.get(src);
    if (!entry) return;
    entry.touched = ++clock;
    // Map insertion order is the LRU order after every touch.
    entries.delete(src);
    entries.set(src, entry);
  };

  /** @param {string} src */
  const ensureSource = async (src) => {
    const normalized = keyOf(src);
    if (!normalized) return;
    if (entries.has(normalized)) {
      touch(normalized);
      const inFlight = pending.get(normalized);
      if (inFlight) await inFlight;
      return;
    }

    const image = createImage();
    if (!image || typeof image !== 'object') return;
    image.decoding = 'async';
    image.src = normalized;
    entries.set(normalized, { image, touched: ++clock });

    let decoded;
    try {
      decoded = typeof image.decode === 'function' ? image.decode() : undefined;
    } catch {
      decoded = undefined;
    }
    const wait = Promise.resolve(decoded)
      .catch(() => {})
      .then(() => {
        pending.delete(normalized);
        touch(normalized);
      });
    pending.set(normalized, wait);
    await wait;
  };

  const trim = () => {
    /** @type {Set<string>} */
    const allowed = new Set();
    // Keep the current build's sources first, then the next build's sources.
    // The entry cap is a hard bound even if an unusually large build exceeds it.
    for (const buildKey of retainedBuilds) {
      const sources = buildSources.get(buildKey);
      if (!sources) continue;
      for (const src of sources) {
        if (allowed.size >= maxEntries) break;
        allowed.add(src);
      }
      if (allowed.size >= maxEntries) break;
    }

    for (const src of [...entries.keys()]) {
      if (!allowed.has(src)) entries.delete(src);
    }

    // If there are no retained build sources yet, still enforce the LRU cap.
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest == null) break;
      entries.delete(oldest);
    }
  };

  /** @param {string[]} keys */
  const retainBuilds = (keys) => {
    const unique = [];
    for (const value of Array.isArray(keys) ? keys : []) {
      const key = keyOf(value);
      if (!key || unique.includes(key)) continue;
      unique.push(key);
      if (unique.length >= maxBuilds) break;
    }
    retainedBuilds = unique;
    // Drop source metadata for builds outside the active/next window as well.
    for (const key of buildSources.keys()) {
      if (!retainedBuilds.includes(key)) buildSources.delete(key);
    }
    trim();
    return snapshot();
  };

  /**
   * @param {string} buildKey
   * @param {Iterable<string>} sources
   */
  const warmBuild = async (buildKey, sources) => {
    const key = keyOf(buildKey);
    if (!key) return snapshot();
    const normalized = new Set(
      [...(sources || [])].map(keyOf).filter(Boolean),
    );
    buildSources.set(key, normalized);
    if (!retainedBuilds.includes(key)) {
      retainedBuilds = [key, ...retainedBuilds]
        .filter((value, index, list) => list.indexOf(value) === index)
        .slice(0, maxBuilds);
    }
    await Promise.all([...normalized].map(ensureSource));
    trim();
    return snapshot();
  };

  /** @param {string} buildKey */
  const isBuildWarm = (buildKey) => {
    const sources = buildSources.get(keyOf(buildKey));
    if (!sources) return false;
    for (const src of sources) {
      if (!entries.has(src)) return false;
    }
    return true;
  };

  const snapshot = () => ({
    size: entries.size,
    maxEntries,
    maxBuilds,
    retainedBuilds: [...retainedBuilds],
    buildCount: buildSources.size,
    pending: pending.size,
  });

  return {
    warmBuild,
    retainBuilds,
    isBuildWarm,
    snapshot,
  };
}
