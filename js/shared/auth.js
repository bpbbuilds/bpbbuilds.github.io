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
/** @type {Promise<void> | null} */
let oauthCallbackInflight = null;

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
 * Exchange a Discord OAuth code exactly once after the browser returns to the
 * static site. Supabase's automatic URL detection can race page boot on a
 * GitHub Pages reload, so callback ownership stays here instead.
 * @returns {Promise<void>}
 */
function finishOAuthCallback() {
  if (oauthCallbackInflight) return oauthCallbackInflight;
  oauthCallbackInflight = (async () => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const oauthError = url.searchParams.get('error');

    if (!code && !oauthError) return;

    // Do not leave a consumed code or an expired-state error in history; using
    // Back must not send the visitor through a stale OAuth callback again.
    for (const key of ['code', 'error', 'error_code', 'error_description']) {
      url.searchParams.delete(key);
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);

    if (!code) {
      console.warn('[auth] Discord sign-in did not complete. Start a fresh sign-in attempt.');
      return;
    }

    const { error } = await getSupabase().auth.exchangeCodeForSession(code);
    if (error) {
      console.error('[auth] Discord session exchange failed', error);
      throw error;
    }
  })();
  return oauthCallbackInflight;
}

/**
 * @returns {Promise<import('https://esm.sh/@supabase/supabase-js@2').Session | null>}
 */
export async function getSession() {
  ensureAuthWiring();
  try {
    await finishOAuthCallback();
  } catch {
    return null;
  }
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

const PROFILE_CORE_COLS =
  'id, discord_id, display_name, avatar_url, equipped_avatar, is_owner, voter_key, plan, founding_slot, premium_until';
const PROFILE_FULL_COLS = `${PROFILE_CORE_COLS}, cosmetic_grants, coins`;

/**
 * @param {import('https://esm.sh/@supabase/supabase-js@2').User | null | undefined} user
 */
export function discordIdFromUser(user) {
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
 * @param {import('https://esm.sh/@supabase/supabase-js@2').User | null | undefined} user
 */
export function personaFromUser(user) {
  if (!user) return { display_name: null, avatar_url: null };
  const meta = user.user_metadata || {};
  const identity = Array.isArray(user.identities)
    ? user.identities.find((i) => i?.provider === 'discord')
    : null;
  const idata = identity?.identity_data || {};
  const display_name =
    String(
      meta.full_name ||
        meta.name ||
        meta.custom_claims?.global_name ||
        meta.preferred_username ||
        idata.full_name ||
        idata.name ||
        idata.preferred_username ||
        '',
    ).trim() || null;
  const avatar_url =
    String(meta.avatar_url || meta.picture || idata.avatar_url || idata.picture || '').trim() ||
    null;
  return { display_name, avatar_url };
}

/**
 * @param {unknown} err
 */
function isMissingProfileColumn(err) {
  const msg = String(
    /** @type {{ message?: string, details?: string, hint?: string }} */ (err)
      ?.message ||
      err ||
      '',
  );
  return (
    /cosmetic_grants|coins/i.test(msg) || /column .* does not exist/i.test(msg)
  );
}

/**
 * @param {Record<string, unknown>} data
 * @param {import('https://esm.sh/@supabase/supabase-js@2').User} user
 * @returns {Profile}
 */
function mapProfileRow(data, user) {
  const persona = personaFromUser(user);
  const discordFromRow = String(data.discord_id || '').trim();
  const discordFromSession = discordIdFromUser(user);
  const coinsRaw = data.coins;
  const coins =
    coinsRaw != null && Number.isFinite(Number(coinsRaw))
      ? Math.max(0, Math.floor(Number(coinsRaw)))
      : 0;
  return {
    id: String(data.id),
    discord_id: discordFromRow || discordFromSession,
    display_name:
      data.display_name != null && String(data.display_name).trim()
        ? String(data.display_name).trim()
        : persona.display_name,
    avatar_url:
      data.avatar_url != null && String(data.avatar_url).trim()
        ? String(data.avatar_url).trim()
        : persona.avatar_url,
    equipped_avatar:
      data.equipped_avatar != null ? String(data.equipped_avatar) : null,
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
    cosmetic_grants: Array.isArray(data.cosmetic_grants)
      ? data.cosmetic_grants
      : data.cosmetic_grants != null
        ? data.cosmetic_grants
        : [],
    coins,
  };
}

/**
 * Load profile for the current session (cached).
 * Retries without newer columns if not migrated yet.
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
    let { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_FULL_COLS)
      .eq('id', session.user.id)
      .maybeSingle();

    if (error && isMissingProfileColumn(error)) {
      console.warn(
        '[auth] profiles missing cosmetic_grants/coins — apply docs/db/sql/021 + 022',
        error,
      );
      ({ data, error } = await supabase
        .from('profiles')
        .select(PROFILE_CORE_COLS)
        .eq('id', session.user.id)
        .maybeSingle());
    }

    if (error) {
      console.error(error);
      profileCache = null;
      return null;
    }
    if (!data) {
      profileCache = null;
      return null;
    }
    profileCache = mapProfileRow(/** @type {Record<string, unknown>} */ (data), session.user);
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
  const { maybePromptDiscordJoin } = await import('./discord-join.js');
  await maybePromptDiscordJoin();
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
