/**
 * Owner admin API — Edge Functions admin-builds + admin-reports.
 * Discord owner JWT only. The break-glass secret is server-only.
 */

import { getProfile, getSession } from '../../shared/auth.js';
import { config } from '../../shared/config.js';

export class AdminAuthError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'AdminAuthError';
  }
}

/**
 * @returns {Promise<{ mode: 'jwt', token: string } | null>}
 */
export async function resolveAdminAuth() {
  try {
    const session = await getSession();
    if (session?.access_token) {
      const profile = await getProfile({ force: true });
      if (profile?.is_owner) {
        return { mode: 'jwt', token: session.access_token };
      }
    }
  } catch {
    /* fall through to secret */
  }
  return null;
}

/**
 * @param {string} url
 * @param {{ mode: 'jwt', token: string }} auth
 * @param {Record<string, unknown>} body
 */
async function adminPost(url, auth, body) {
  const endpoint = String(url || '').trim();
  if (!endpoint || endpoint.includes('YOUR_')) {
    throw new Error(
      'Admin URL not configured. Run node scripts/write-config.mjs after setting SUPABASE_PROJECT_URL.',
    );
  }
  if (!auth?.token) throw new AdminAuthError('Missing credentials');

  /** @type {Record<string, string>} */
  const headers = {
    'Content-Type': 'application/json',
    apikey: String(config.supabasePublishableKey || ''),
  };
  headers.Authorization = `Bearer ${auth.token}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }

  if (res.status === 401) {
    throw new AdminAuthError(
      (data && (data.error || data.message)) || 'Unauthorized',
    );
  }
  if (!res.ok) {
    const msg =
      (data && (data.error || data.message || data.detail)) ||
      `Request failed (${res.status})`;
    throw new Error(String(msg));
  }
  return data;
}

/**
 * @param {{ mode: 'jwt' | 'secret', token: string }} auth
 * @param {{ action: string, slug?: string, filter?: string, eventSlug?: string }} body
 */
export function adminRequest(auth, body) {
  return adminPost(String(config.adminBuildsUrl || ''), auth, body);
}

/**
 * @param {{ mode: 'jwt' | 'secret', token: string }} auth
 * @param {string} [filter]
 */
export function listBuilds(auth, filter = 'all') {
  return adminRequest(auth, { action: 'list', filter });
}

/** Owner-only merged website and Discord member roster. */
export function listMembers(auth) {
  return adminRequest(auth, { action: 'members' });
}

/** Owner-only published cosmetic ids. */
export function listPublishedCosmetics(auth) {
  return adminRequest(auth, { action: 'cosmetics' });
}

/** Owner-only cosmetic catalog publish. */
export function publishCosmetic(auth, cosmetic) {
  return adminRequest(auth, { action: 'publish_cosmetic', cosmetic });
}

/**
 * @param {{ mode: 'jwt' | 'secret', token: string }} auth
 * @param {string} eventSlug
 */
export function listEventEntries(auth, eventSlug) {
  return adminRequest(auth, { action: 'event_entries', eventSlug });
}

/**
 * @param {{ mode: 'jwt' | 'secret', token: string }} auth
 * @param {string} action
 * @param {string} slug
 */
export function mutateBuild(auth, action, slug) {
  return adminRequest(auth, { action, slug });
}

/**
 * @param {{ mode: 'jwt' | 'secret', token: string }} auth
 * @param {{ action: string, id?: string, status?: string, filter?: string }} body
 */
export function adminReportsRequest(auth, body) {
  return adminPost(String(config.adminReportsUrl || ''), auth, body);
}

/**
 * @param {{ mode: 'jwt' | 'secret', token: string }} auth
 * @param {string | Record<string, unknown>} [filterOrQuery]
 */
export function listReports(auth, filterOrQuery = 'open') {
  const query =
    typeof filterOrQuery === 'string' ? { filter: filterOrQuery } : filterOrQuery || {};
  return adminReportsRequest(auth, { action: 'list', ...query });
}

/**
 * @param {{ mode: 'jwt' | 'secret', token: string }} auth
 */
export function reportStats(auth) {
  return adminReportsRequest(auth, { action: 'stats' });
}

/** Get the current public/private mode. */
export async function getSiteAccessMode() {
  const endpoint = String(config.siteAccessUrl || '').trim();
  if (!endpoint || endpoint.includes('YOUR_')) {
    throw new Error('Site access URL not configured. Run node scripts/write-config.mjs.');
  }
  const response = await fetch(endpoint, {
    headers: { apikey: String(config.supabasePublishableKey || '') },
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(String(data?.error || `Request failed (${response.status})`));
  return data;
}

/** @param {{ mode: 'jwt' | 'secret', token: string }} auth @param {'live' | 'private'} mode */
export function setSiteAccessMode(auth, mode) {
  return adminPost(String(config.siteAccessUrl || ''), auth, { mode });
}

/**
 * @param {{ mode: 'jwt' | 'secret', token: string }} auth
 * @param {string} id
 * @param {'open' | 'fixed' | 'wontfix'} status
 */
export function setReportStatus(auth, id, status) {
  return adminReportsRequest(auth, { action: 'set_status', id, status });
}
