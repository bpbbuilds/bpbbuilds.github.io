/**
 * Open Stripe Customer Portal (signed-in paid Premium users).
 */
import { getSession } from './auth.js';
import { config } from './config.js';

/**
 * @returns {Promise<string>} Portal URL
 */
export async function startStripePortal() {
  const session = await getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error('Sign in with Discord to manage billing.');
  }
  const url = config?.createPortalUrl;
  if (!url || String(url).includes('YOUR_')) {
    throw new Error('Billing portal is not configured on this site.');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    const msg =
      typeof data?.error === 'string'
        ? data.error
        : `Billing portal failed (${res.status})`;
    throw new Error(msg);
  }

  const portalUrl = String(data?.url || '');
  if (!portalUrl) {
    throw new Error('Portal did not return a URL.');
  }
  return portalUrl;
}
