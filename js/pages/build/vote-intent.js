/**
 * One-shot vote continuation across the Discord OAuth redirect.
 * Only a build slug and vote direction are stored; the server still decides
 * whether the signed-in account may cast the vote.
 */

export const VOTE_INTENT_KEY = 'bpb-vote-intent';
const MAX_AGE_MS = 15 * 60 * 1000;

/** @returns {Storage | null} */
function defaultStorage() {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/**
 * @param {{ buildKey?: string, direction?: number }} intent
 * @param {Storage | null} [storage]
 * @param {number} [now]
 * @returns {boolean}
 */
export function saveVoteIntent(intent, storage = defaultStorage(), now = Date.now()) {
  const buildKey = String(intent?.buildKey || '').trim();
  const direction = Number(intent?.direction);
  if (!buildKey || (direction !== 1 && direction !== -1) || !storage) return false;
  try {
    storage.setItem(
      VOTE_INTENT_KEY,
      JSON.stringify({ buildKey, direction, savedAt: Number(now) || Date.now() }),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {Storage | null} [storage]
 * @param {number} [now]
 * @returns {{ buildKey: string, direction: 1 | -1 } | null}
 */
export function readVoteIntent(storage = defaultStorage(), now = Date.now()) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(VOTE_INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const buildKey = String(parsed?.buildKey || '').trim();
    const direction = Number(parsed?.direction);
    const savedAt = Number(parsed?.savedAt);
    const age = Number(now) - savedAt;
    if (
      !buildKey ||
      (direction !== 1 && direction !== -1) ||
      !Number.isFinite(savedAt) ||
      age < 0 ||
      age > MAX_AGE_MS
    ) {
      storage.removeItem(VOTE_INTENT_KEY);
      return null;
    }
    return { buildKey, direction: /** @type {1 | -1} */ (direction) };
  } catch {
    try {
      storage.removeItem(VOTE_INTENT_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

/** @param {Storage | null} [storage] */
export function clearVoteIntent(storage = defaultStorage()) {
  try {
    storage?.removeItem(VOTE_INTENT_KEY);
  } catch {
    /* ignore */
  }
}
