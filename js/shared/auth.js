/**
 * Discord-only Supabase Auth helpers.
 * Sign-in at Submit / nav; bind anon votes on SIGNED_IN.
 */

import { getSupabase } from './supabase.js';
import { claimFoundingSlot } from './entitlements.js';

/** @typedef {import('./entitlements.js').Profile} Profile */

const VOTER_KEY = 'bpb-voter-id';

/** @type {Profile | null | undefined} */
let profileCache;
/** @type {Promise<Profile | null> | null} */
let profileInflight = null;
/** @type {boolean} */
let authWired = false;

/**
 * @param {string} s
 */
function isUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(s || ''),
  );
}

/**
 * Absolute URL for OAuth redirect (current page by default).
 * @param {string} [pathOrUrl]
 */
export function authRedirectTo(pathOrUrl) {
  if (pathOrUrl && /^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (pathOrUrl) {
    try {
      return new URL(pathOrUrl, location.href).href;
    } catch {
      /* fall through */
    }
  }
  return location.href.split('#')[0];
}

/**
 * @returns {Promise<import('https://esm.sh/@supabase/supabase-js@2').Session | null>}
 */
export async function getSession() {
  ensureAuthWiring();
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error(error);
    return null;
  }
  return data.session ?? null;
}

/**
 * @param {string} [redirectTo]
 */
export async function signInWithDiscord(redirectTo) {
  ensureAuthWiring();
  const supabase = getSupabase();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: authRedirectTo(redirectTo),
      scopes: 'identify',
    },
  });
  if (error) throw error;
}

export async function signOut() {
  ensureAuthWiring();
  profileCache = null;
  const supabase = getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * @param {import('https://esm.sh/@supabase/supabase-js@2').User | null | undefined} user
 */
function discordIdFromUser(user) {
  if (!user) return '';
  const meta = user.user_metadata || {};
  const fromMeta = String(meta.provider_id || meta.sub || '').trim();
  if (fromMeta) return fromMeta;
  const identities = Array.isArray(user.identities) ? user.identities : [];
  const discord = identities.find((i) => i?.provider === 'discord');
  const data = discord?.identity_data || {};
  return String(
    discord?.id || data.provider_id || data.sub || '',
  ).trim();
}

/**
 * @param {import('https://esm.sh/@supabase/supabase-js@2').User} user
 */
function personaFromUser(user) {
  const meta = user.user_metadata || {};
  const display_name =
    String(meta.full_name || meta.name || meta.preferred_username || '').trim() ||
    null;
  const avatar_url =
    String(meta.avatar_url || meta.picture || '').trim() || null;
  return { display_name, avatar_url };
}

/**
 * Load profile for the current session (cached).
 * @param {{ force?: boolean }} [opts]
 * @returns {Promise<Profile | null>}
 */
export async function getProfile(opts = {}) {
  ensureAuthWiring();
  if (!opts.force && profileCache !== undefined) return profileCache;
  if (!opts.force && profileInflight) return profileInflight;

  profileInflight = (async () => {
    const session = await getSession();
    if (!session?.user) {
      profileCache = null;
      return null;
    }
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, discord_id, display_name, avatar_url, is_owner, voter_key, plan, founding_slot, premium_until',
      )
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) {
      console.error(error);
      profileCache = null;
      return null;
    }
    if (!data) {
      profileCache = null;
      return null;
    }
    profileCache = /** @type {Profile} */ ({
      id: String(data.id),
      discord_id: String(data.discord_id || ''),
      display_name: data.display_name ?? null,
      avatar_url: data.avatar_url ?? null,
      is_owner: data.is_owner === true,
      voter_key: data.voter_key ? String(data.voter_key) : null,
      plan: /** @type {Profile['plan']} */ (
        ['founding', 'premium'].includes(String(data.plan || ''))
          ? String(data.plan)
          : 'free'
      ),
      founding_slot:
        data.founding_slot != null && Number.isFinite(Number(data.founding_slot))
          ? Number(data.founding_slot)
          : null,
      premium_until: data.premium_until ? String(data.premium_until) : null,
    });
    return profileCache;
  })();

  try {
    return await profileInflight;
  } finally {
    profileInflight = null;
  }
}

/**
 * Sync Discord persona onto profiles + bind voter key.
 * @param {import('https://esm.sh/@supabase/supabase-js@2').Session | null} session
 */
async function afterSignedIn(session) {
  if (!session?.user) return;
  const supabase = getSupabase();
  const persona = personaFromUser(session.user);
  const discord_id = discordIdFromUser(session.user);

  const patch = {
    display_name: persona.display_name,
    avatar_url: persona.avatar_url,
    updated_at: new Date().toISOString(),
  };

  const { error: upErr } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', session.user.id);

  if (upErr) {
    // Profile may not exist yet if trigger lagged — upsert best-effort
    if (discord_id) {
      const { error: insErr } = await supabase.from('profiles').upsert({
        id: session.user.id,
        discord_id,
        ...patch,
      });
      if (insErr) console.error(insErr);
    } else {
      console.error(upErr);
    }
  }

  await bindVoterKeyToProfile();
  await claimFoundingSlot();
  profileCache = undefined;
  await getProfile({ force: true });
}

/**
 * Force-refresh cached profile (e.g. after founding grant).
 * @returns {Promise<Profile | null>}
 */
export async function refreshProfile() {
  profileCache = undefined;
  return getProfile({ force: true });
}

/**
 * Read local anon voter UUID (create if missing).
 * @returns {string}
 */
export function getLocalVoterKey() {
  try {
    let id = localStorage.getItem(VOTER_KEY);
    if (id && isUuid(id)) return id.toLowerCase();
    id = crypto.randomUUID();
    localStorage.setItem(VOTER_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * @param {string} key
 */
function setLocalVoterKey(key) {
  if (!isUuid(key)) return;
  try {
    localStorage.setItem(VOTER_KEY, key.toLowerCase());
  } catch {
    /* private mode */
  }
}

/**
 * Bind localStorage bpb-voter-id → profiles.voter_key (RPC).
 * @returns {Promise<string | null>} canonical voter key
 */
export async function bindVoterKeyToProfile() {
  const session = await getSession();
  if (!session?.user) return null;

  const localKey = getLocalVoterKey();
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('bind_my_voter_key', {
    p_key: localKey,
  });

  if (error) {
    console.error(error);
    return null;
  }

  const bound =
    data && typeof data === 'object'
      ? String(/** @type {{ voter_key?: string }} */ (data).voter_key || '')
      : '';
  if (bound && isUuid(bound)) {
    setLocalVoterKey(bound);
    return bound.toLowerCase();
  }
  return localKey;
}

/**
 * @param {(event: string, session: import('https://esm.sh/@supabase/supabase-js@2').Session | null) => void} cb
 * @returns {() => void}
 */
export function onAuthChange(cb) {
  ensureAuthWiring();
  const supabase = getSupabase();
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    cb(event, session);
  });
  return () => data.subscription.unsubscribe();
}

function ensureAuthWiring() {
  if (authWired) return;
  authWired = true;
  try {
    const supabase = getSupabase();
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        afterSignedIn(session).catch((err) => console.error(err));
      }
      if (event === 'SIGNED_OUT') {
        profileCache = null;
      }
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        profileCache = undefined;
      }
    });
  } catch (err) {
    console.error(err);
    authWired = false;
  }
}

/** Call once from nav (or page entry) so SIGNED_IN bind runs site-wide. */
export function initAuth() {
  ensureAuthWiring();
  getSession().then((session) => {
    if (session) afterSignedIn(session).catch((err) => console.error(err));
  });
}
