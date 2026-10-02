/**
 * Start Stripe Checkout for Premium (signed-in users).
 */
import { getSession } from './auth.js';
import { config } from './config.js';

/**
 * @returns {Promise<string>} Checkout URL
 */
export async function startStripeCheckout() {
  const session = await getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error('Sign in with Discord to upgrade.');
  }
  const url = config?.createCheckoutUrl;
  if (!url || String(url).includes('YOUR_')) {
    throw new Error('Checkout is not configured on this site.');
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
        : `Checkout failed (${res.status})`;
    throw new Error(msg);
  }

  const checkoutUrl = String(data?.url || '');
  if (!checkoutUrl) {
    throw new Error('Checkout did not return a URL.');
  }
  return checkoutUrl;
}
