/**
 * Publish a create draft via submit-build (Discord JWT; secret = break-glass).
 */

import { getSession, getProfile, signInWithDiscord } from '../../shared/auth.js';
import { config } from '../../shared/config.js';
import { bakeAndUploadBoardStill } from '../../shared/board-still/upload.js';
import {
  lastRoundPlacementsFromHistory,
  normalizeDraftHistory,
} from './draft-io.js';
import { gemFace } from './socket-place.js';

const PENDING_SUBMIT_KEY = 'bpb-pending-submit';

/** Remember that Submit was interrupted for Discord OAuth. */
export function markPendingSubmit() {
  try {
    localStorage.setItem(PENDING_SUBMIT_KEY, '1');
  } catch {
    /* private mode */
  }
}

export function clearPendingSubmit() {
  try {
    localStorage.removeItem(PENDING_SUBMIT_KEY);
  } catch {
    /* ignore */
  }
}

export function hasPendingSubmit() {
  try {
    return localStorage.getItem(PENDING_SUBMIT_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * @param {import('./draft-io.js').DraftPlacement[]} placements
 */
function mapPlacementsPayload(placements) {
  return (placements || []).map((p) => ({
    id: p.id,
    x: p.x,
    y: p.y,
    r: p.r ?? 0,
    gems: p.gems || [],
    ...(Array.isArray(p.gemR) && p.gemR.some((n) => gemFace(n) !== 0)
      ? { gemR: p.gemR.map((n) => gemFace(n)) }
      : {}),
    priority: p.priority ?? null,
  }));
}

/**
 * @param {import('./draft-io.js').Draft} draft
 * @param {{
 *   itemsById?: Map<string, object> | null,
 *   getSpriteUrl?: ((item: object) => string) | null,
 *   root?: string,
 *   eventSlug?: string | null,
 * }} [paint]
 * @returns {Promise<{ id: number, slug: string }>}
 */
export async function publishDraft(draft, paint = {}) {
  const url = String(config.submitBuildUrl || '').trim();
  if (!url || url.includes('YOUR_')) {
    throw new Error(
      'Submit URL not configured. Run node scripts/write-config.mjs after setting SUPABASE_PROJECT_URL.',
    );
  }

  let session = await getSession();
  if (!session?.access_token) {
    markPendingSubmit();
    await signInWithDiscord();
    throw new Error('Sign in with Discord to submit — returning after login.');
  }

  const history = normalizeDraftHistory(draft.history);
  const rawPlacements = history
    ? lastRoundPlacementsFromHistory(history, draft.placements || [])
    : draft.placements || [];
  const placements = rawPlacements.filter((p) => String(p.id || '') !== '__unrecognized__');
  const build_tag = history ? 'real' : draft.build_tag;

  /** @type {string | null} */
  let board_still_path = null;
  const itemsById = paint.itemsById;
  const getSpriteUrl = paint.getSpriteUrl;
  if (
    placements.length &&
    itemsById instanceof Map &&
    typeof getSpriteUrl === 'function'
  ) {
    const profile = await getProfile().catch(() => null);
    const authorId = profile?.id ? String(profile.id) : '';
    if (authorId) {
      board_still_path = await bakeAndUploadBoardStill({
        placements: mapPlacementsPayload(placements),
        itemsById,
        getSpriteUrl,
        root: paint.root,
        authorId,
      });
    }
  }

  /** @type {Record<string, unknown>} */
  const payload = {
    title: draft.title,
    notes: draft.notes,
    hero_class: draft.hero_class,
    build_tag,
    is_op: draft.is_op,
    youtube_url: draft.youtube_url,
    gold_count: draft.gold_count,
    rank: draft.rank,
    route_r3_item_id: draft.route_r3_item_id,
    route_r10_item_id: draft.route_r10_item_id,
    starting_bag_id: draft.starting_bag_id,
    placements: mapPlacementsPayload(placements),
  };
  if (history) payload.history = history;
  if (board_still_path) payload.board_still_path = board_still_path;
  const eventSlug = String(paint.eventSlug || '').trim();
  if (eventSlug) payload.event_slug = eventSlug;

  /** @type {Record<string, string>} */
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
    apikey: String(config.supabasePublishableKey || ''),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }

  if (res.status === 401) {
    markPendingSubmit();
    await signInWithDiscord();
    throw new Error('Sign in with Discord to submit — returning after login.');
  }

  clearPendingSubmit();

  if (!res.ok) {
    const msg =
      (data && (data.error || data.message)) ||
      `Submit failed (${res.status})`;
    throw new Error(String(msg));
  }
  if (!data?.slug) throw new Error('Submit succeeded but no slug returned.');
  return { id: data.id, slug: String(data.slug) };
}

/**
 * @param {string} slug
 * @param {string} root site root prefix ending in /
 */
export function buildViewHref(slug, root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  return `${base}builds/view/?slug=${encodeURIComponent(slug)}`;
}
