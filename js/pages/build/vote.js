/**
 * Reddit-style up/down vote for a build.
 * Net score from Supabase (vote-build); my_vote cached in localStorage.
 */

import { getLocalVoterKey, getSession } from '../../shared/auth.js';
import { config } from '../../shared/config.js';

const STORAGE_PREFIX = 'bpb-build-vote:';
const SYNCED_PREFIX = 'bpb-build-vote-synced:';

/**
 * Durable voter UUID (anon localStorage; bound to profile after Discord sign-in).
 * @returns {string}
 */
export function getVoterKey() {
  return getLocalVoterKey();
}

/**
 * @param {string} buildKey
 * @returns {-1 | 0 | 1}
 */
export function readMyVote(buildKey) {
  if (!buildKey) return 0;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + buildKey);
    const n = Number(raw);
    if (n === 1 || n === -1) return /** @type {1 | -1} */ (n);
  } catch {
    /* private mode */
  }
  return 0;
}

/**
 * Slugs this browser has upvoted (local cache; same keys as Liked feed filter).
 * @returns {string[]}
 */
export function listUpvotedBuildSlugs() {
  /** @type {string[]} */
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
      const slug = key.slice(STORAGE_PREFIX.length).trim();
      if (!slug) continue;
      if (Number(localStorage.getItem(key)) === 1) out.push(slug);
    }
  } catch {
    /* private mode */
  }
  return out;
}

/**
 * @param {string} buildKey
 * @param {-1 | 0 | 1} vote
 */
function writeMyVote(buildKey, vote) {
  if (!buildKey) return;
  try {
    if (vote === 0) localStorage.removeItem(STORAGE_PREFIX + buildKey);
    else localStorage.setItem(STORAGE_PREFIX + buildKey, String(vote));
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} buildKey
 */
function markSynced(buildKey) {
  try {
    localStorage.setItem(SYNCED_PREFIX + buildKey, '1');
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} buildKey
 */
function wasSynced(buildKey) {
  try {
    return localStorage.getItem(SYNCED_PREFIX + buildKey) === '1';
  } catch {
    return false;
  }
}

/**
 * @param {string} s
 */
function isUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(s || ''),
  );
}

/**
 * @param {string} slug
 * @param {-1 | 0 | 1} vote
 * @returns {Promise<{ vote_score: number, my_vote: -1 | 0 | 1 }>}
 */
export async function submitBuildVote(slug, vote) {
  const url = String(config.voteBuildUrl || '').trim();
  if (!url || url.includes('YOUR_')) {
    throw new Error('Vote URL not configured. Run node scripts/write-config.mjs.');
  }
  /** @type {Record<string, string>} */
  const headers = {
    'Content-Type': 'application/json',
    apikey: String(config.supabasePublishableKey || ''),
  };
  try {
    const session = await getSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch {
    /* anon vote */
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      slug,
      vote,
      voter_key: getVoterKey(),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Vote failed (${res.status})`);
  }
  if (data?.voter_key && isUuid(data.voter_key)) {
    try {
      localStorage.setItem('bpb-voter-id', String(data.voter_key).toLowerCase());
    } catch {
      /* ignore */
    }
  }
  const my =
    data.my_vote === 1 || data.my_vote === -1 || data.my_vote === 0
      ? /** @type {-1 | 0 | 1} */ (data.my_vote)
      : vote;
  return {
    vote_score: Number(data.vote_score) || 0,
    my_vote: my,
  };
}

/**
 * Markup for the vote control (mount into round actions).
 * @param {string} [root]
 * @returns {string}
 */
export function voteControlHtml(root = '../../') {
  const base = root.endsWith('/') ? root : `${root}/`;
  const up = `${base}assets/icons/history/VoteUp.png`;
  const down = `${base}assets/icons/history/VoteDown.png`;
  return `
    <div class="build-round__vote" role="group" aria-label="Build rating">
      <button
        type="button"
        class="build-round__vote-btn build-round__vote-btn--up"
        aria-label="Upvote"
        aria-pressed="false"
        title="Upvote"
      >
        <img class="build-round__vote-icon" src="${escapeAttr(up)}" alt="" width="28" height="28" draggable="false" />
      </button>
      <span class="build-round__vote-score" data-vote-score aria-live="polite">0</span>
      <button
        type="button"
        class="build-round__vote-btn build-round__vote-btn--down"
        aria-label="Downvote"
        aria-pressed="false"
        title="Downvote"
      >
        <img class="build-round__vote-icon" src="${escapeAttr(down)}" alt="" width="28" height="28" draggable="false" />
      </button>
    </div>
  `;
}

function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * @param {ParentNode | null} root
 * @param {{
 *   buildKey?: string,
 *   baseScore?: number,
 *   onChange?: (vote: -1 | 0 | 1, voteScore?: number) => void,
 * }} [opts]
 * @returns {() => void}
 */
export function bindBuildVote(root, opts = {}) {
  const host = root?.querySelector?.('.build-round__vote');
  if (!(host instanceof HTMLElement)) return () => {};

  const upBtn = host.querySelector('.build-round__vote-btn--up');
  const downBtn = host.querySelector('.build-round__vote-btn--down');
  const scoreEl = host.querySelector('[data-vote-score]');
  if (
    !(upBtn instanceof HTMLButtonElement) ||
    !(downBtn instanceof HTMLButtonElement) ||
    !(scoreEl instanceof HTMLElement)
  ) {
    return () => {};
  }

  const buildKey = String(opts.buildKey || '').trim();
  /** Server net score (includes everyone's votes). */
  let serverScore = Number.isFinite(Number(opts.baseScore))
    ? Number(opts.baseScore)
    : 0;
  let myVote = /** @type {-1 | 0 | 1} */ (readMyVote(buildKey));
  let busy = false;
  let destroyed = false;

  function paint() {
    // Display net score from server (already includes myVote once synced).
    scoreEl.textContent = String(serverScore);
    host.dataset.vote = String(myVote);
    host.classList.toggle('is-up', myVote === 1);
    host.classList.toggle('is-down', myVote === -1);
    upBtn.setAttribute('aria-pressed', myVote === 1 ? 'true' : 'false');
    downBtn.setAttribute('aria-pressed', myVote === -1 ? 'true' : 'false');
    upBtn.classList.toggle('is-on', myVote === 1);
    downBtn.classList.toggle('is-on', myVote === -1);
    upBtn.disabled = busy;
    downBtn.disabled = busy;
  }

  /**
   * @param {-1 | 0 | 1} next
   * @param {-1 | 0 | 1} prev
   */
  function optimisticScore(next, prev) {
    return serverScore - prev + next;
  }

  /**
   * @param {1 | -1} dir
   */
  async function cast(dir) {
    if (!buildKey || busy) return;
    const prev = myVote;
    const next = /** @type {-1 | 0 | 1} */ (prev === dir ? 0 : dir);
    myVote = next;
    writeMyVote(buildKey, next);
    serverScore = optimisticScore(next, prev);
    busy = true;
    paint();
    opts.onChange?.(next, serverScore);

    try {
      const res = await submitBuildVote(buildKey, next);
      if (destroyed) return;
      myVote = res.my_vote;
      serverScore = res.vote_score;
      writeMyVote(buildKey, myVote);
      markSynced(buildKey);
    } catch (err) {
      console.error(err);
      if (destroyed) return;
      myVote = prev;
      writeMyVote(buildKey, prev);
      serverScore = optimisticScore(prev, next);
    } finally {
      busy = false;
      if (!destroyed) {
        paint();
        opts.onChange?.(myVote, serverScore);
      }
    }
  }

  /**
   * Push local vote to DB and refresh net score.
   * Also re-sync when UI has myVote but baseScore is 0 (e.g. showcase
   * local JSON missing vote_score, or stale page data).
   */
  async function syncLegacyIfNeeded() {
    if (!buildKey || myVote === 0) return;
    if (wasSynced(buildKey) && serverScore !== 0) return;
    try {
      const res = await submitBuildVote(buildKey, myVote);
      if (destroyed) return;
      myVote = res.my_vote;
      serverScore = res.vote_score;
      writeMyVote(buildKey, myVote);
      markSynced(buildKey);
      paint();
      opts.onChange?.(myVote, serverScore);
    } catch (err) {
      console.error(err);
    }
  }

  /** @param {MouseEvent} e */
  function onUp(e) {
    e.preventDefault();
    void cast(1);
  }
  /** @param {MouseEvent} e */
  function onDown(e) {
    e.preventDefault();
    void cast(-1);
  }

  upBtn.addEventListener('click', onUp);
  downBtn.addEventListener('click', onDown);
  paint();
  void syncLegacyIfNeeded();

  return () => {
    destroyed = true;
    upBtn.removeEventListener('click', onUp);
    downBtn.removeEventListener('click', onDown);
  };
}
