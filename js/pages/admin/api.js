/**
 * Owner admin API — Edge Function admin-builds.
 * Prefers Discord owner JWT; secret header is break-glass.
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
 * @returns {Promise<{ mode: 'jwt' | 'secret', token: string } | null>}
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
 * @param {{ mode: 'jwt' | 'secret', token: string }} auth
 * @param {{ action: string, slug?: string, filter?: string }} body
 */
export async function adminRequest(auth, body) {
  const url = String(config.adminBuildsUrl || '').trim();
  if (!url || url.includes('YOUR_')) {
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
  if (auth.mode === 'jwt') {
    headers.Authorization = `Bearer ${auth.token}`;
  } else {
    headers['x-bpb-submit-secret'] = auth.token;
  }

  const res = await fetch(url, {
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
 * @param {string} [filter]
 */
export function listBuilds(auth, filter = 'all') {
  return adminRequest(auth, { action: 'list', filter });
}

/**
 * @param {{ mode: 'jwt' | 'secret', token: string }} auth
 * @param {string} action
 * @param {string} slug
 */
export function mutateBuild(auth, action, slug) {
  return adminRequest(auth, { action, slug });
}
