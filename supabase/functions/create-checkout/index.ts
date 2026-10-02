/**
 * Create Stripe Checkout Session for Premium subscription.
 * POST + Authorization: Bearer <Supabase JWT>
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
 *      STRIPE_SECRET_KEY, STRIPE_PRICE_ID_PREMIUM, SITE_URL
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { cors, json } from '../_shared/http.ts';
import { isEntitledPremium, stripePost } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
  const priceId = Deno.env.get('STRIPE_PRICE_ID_PREMIUM') || '';
  const siteUrl = (Deno.env.get('SITE_URL') || 'https://bpbbuilds.github.io').replace(
    /\/$/,
    '',
  );

  if (!supabaseUrl || !serviceKey || !anonKey || !stripeKey || !priceId) {
    return json({ error: 'Server misconfigured' }, 500);
  }

  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) {
    return json({ error: 'Sign in required' }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: 'Invalid session' }, 401);
  }

  const userId = userData.user.id;
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('id, discord_id, display_name, plan, premium_until, stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();

  if (profErr || !profile) {
    return json({ error: 'Profile not found' }, 404);
  }

  if (profile.plan === 'founding') {
    return json({ error: 'Founding members already have Premium', code: 'founding' }, 409);
  }
  if (isEntitledPremium(profile)) {
    return json(
      { error: 'Already subscribed — use billing portal', code: 'already_premium' },
      409,
    );
  }

  let customerId = String(profile.stripe_customer_id || '').trim();
  if (customerId) {
    try {
      await stripeGetCustomer(stripeKey, customerId);
    } catch {
      customerId = '';
    }
  }

  if (!customerId) {
    const email = userData.user.email || undefined;
    const customer = await stripePost(stripeKey, '/customers', {
      'metadata[supabase_user_id]': userId,
      ...(email ? { email } : {}),
      ...(profile.display_name
        ? { name: String(profile.display_name) }
        : {}),
    });
    customerId = String(customer.id);
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
      .eq('id', userId);
  }

  const session = await stripePost(stripeKey, '/checkout/sessions', {
    mode: 'subscription',
    customer: customerId,
    client_reference_id: userId,
    'metadata[supabase_user_id]': userId,
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: `${siteUrl}/?billing=success`,
    cancel_url: `${siteUrl}/?billing=cancel`,
    allow_promotion_codes: 'true',
  });

  const url = String(session.url || '');
  if (!url) {
    return json({ error: 'Checkout session missing URL' }, 500);
  }

  return json({ url });
});

async function stripeGetCustomer(secretKey: string, customerId: string) {
  const res = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || res.statusText);
  }
  return data;
}
