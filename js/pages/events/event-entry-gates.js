/**
 * Client railguards for event history.db entries.
 */

/**
 * @param {string} a
 * @param {string} b
 * @returns {number} negative if a < b
 */
export function compareGameVersions(a, b) {
  const pa = String(a || '0')
    .split(/[^\d]+/)
    .map((x) => Number(x) || 0);
  const pb = String(b || '0')
    .split(/[^\d]+/)
    .map((x) => Number(x) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i += 1) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

/**
 * Ranked = rating ≥ 0. Rating < 0 is treated as unranked (game lobby / unranked).
 * True custom lobbies are not perfectly distinguishable yet — residual risk.
 * @param {number} rating
 * @returns {'ranked' | 'unranked'}
 */
export function modeFromRating(rating) {
  return Number.isFinite(rating) && rating >= 0 ? 'ranked' : 'unranked';
}

/**
 * @param {{
 *   rating: number,
 *   version: string,
 *   placements: { id?: string }[],
 *   rules: import('./event-entry-config.js').EventEntryRules,
 * }} opts
 * @returns {{ ok: boolean, errors: string[], mode: 'ranked' | 'unranked', missingItems: string[] }}
 */
export function validateEventBoard(opts) {
  const errors = [];
  const mode = modeFromRating(opts.rating);
  const { rules } = opts;

  if (!rules.allowedModes.includes(mode)) {
    errors.push(`Only ${rules.allowedModes.join(' / ')} runs count — this looks like ${mode}.`);
  }

  if (compareGameVersions(opts.version, rules.minGameVersion) < 0) {
    errors.push(
      `Game version ${opts.version || '?'} is below the event floor (${rules.minGameVersion}).`,
    );
  }

  const ids = new Set(
    (opts.placements || []).map((p) => String(p.id || '').trim()).filter(Boolean),
  );
  if (!ids.size) {
    errors.push('That round has an empty board.');
  }

  /** @type {string[]} */
  const missingItems = [];
  for (const need of rules.requiredItemIds) {
    const key = String(need || '').trim();
    if (!key) continue;
    const hit = [...ids].some((id) => id.toLowerCase() === key.toLowerCase());
    if (!hit) missingItems.push(key);
  }
  if (missingItems.length) {
    errors.push(
      `Board must include: ${missingItems.map((id) => id).join(', ')}.`,
    );
  }

  return { ok: !errors.length, errors, mode, missingItems };
}
