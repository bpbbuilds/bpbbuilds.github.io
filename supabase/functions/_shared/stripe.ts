/** Minimal Stripe REST helpers (Deno Edge). */

export async function stripePost(
  secretKey: string,
  path: string,
  params: Record<string, string>,
) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg =
      typeof data?.error?.message === 'string'
        ? data.error.message
        : res.statusText;
    throw new Error(msg);
  }
  return data;
}

export async function stripeGet(secretKey: string, path: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const data = await res.json();
  if (!res.ok) {
    const msg =
      typeof data?.error?.message === 'string'
        ? data.error.message
        : res.statusText;
    throw new Error(msg);
  }
  return data;
}

export function periodEndIso(sub: { current_period_end?: number }) {
  const end = Number(sub?.current_period_end);
  if (!Number.isFinite(end) || end <= 0) return null;
  return new Date(end * 1000).toISOString();
}

export function isActiveSubscriptionStatus(status: string) {
  return status === 'active' || status === 'trialing';
}

export function isEntitledPremium(profile: {
  plan?: string | null;
  premium_until?: string | null;
}) {
  const plan = String(profile.plan || 'free');
  if (plan === 'founding') return true;
  if (plan !== 'premium') return false;
  const until = profile.premium_until
    ? Date.parse(String(profile.premium_until))
    : NaN;
  if (!Number.isFinite(until)) return true;
  return until > Date.now();
}
