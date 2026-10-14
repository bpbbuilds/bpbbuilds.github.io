/**
 * Return the stable creator key used by the Home promo selector.
 * @param {object} build
 * @returns {string}
 */
export function promoAuthorKey(build) {
  return String(
    build?.author_id ||
      build?.author_name ||
      build?.profile?.discord_id ||
      build?.profile?.display_name ||
      '',
  )
    .trim()
    .toLowerCase();
}

/**
 * Randomize a build cycle while avoiding adjacent builds by the same creator.
 * If every remaining build belongs to the previous creator, the selector uses
 * the remaining pool so a single-creator feed still renders normally.
 *
 * @param {object[]} builds
 * @param {{ previousAuthorId?: string, random?: () => number }} [options]
 * @returns {object[]}
 */
export function randomizeBuildSequence(builds, options = {}) {
  const remaining = Array.isArray(builds) ? builds.filter(Boolean).slice() : [];
  const ordered = [];
  const random = typeof options.random === 'function' ? options.random : Math.random;
  let previousAuthorId = String(options.previousAuthorId || '').trim().toLowerCase();

  while (remaining.length) {
    const eligible = previousAuthorId
      ? remaining.filter((build) => promoAuthorKey(build) !== previousAuthorId)
      : remaining;
    const pool = eligible.length ? eligible : remaining;
    const sample = Number(random());
    const normalized = Number.isFinite(sample) ? Math.max(0, Math.min(0.999999, sample)) : 0;
    const selected = pool[Math.floor(normalized * pool.length)];
    ordered.push(selected);
    remaining.splice(remaining.indexOf(selected), 1);
    previousAuthorId = promoAuthorKey(selected);
  }

  return ordered;
}
