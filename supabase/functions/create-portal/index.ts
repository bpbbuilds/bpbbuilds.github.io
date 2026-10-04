/**
 * Create Stripe Customer Portal session (manage / cancel subscription).
 * POST + Authorization: Bearer <Supabase JWT>
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
 *      STRIPE_SECRET_KEY, SITE_URL
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
  const siteUrl = (Deno.env.get('SITE_URL') || 'https://bpbbuilds.com').replace(
    /\/$/,
    '',
  );

  if (!supabaseUrl || !serviceKey || !anonKey || !stripeKey) {
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
    .select('id, plan, premium_until, stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();

  if (profErr || !profile) {
    return json({ error: 'Profile not found' }, 404);
  }

  if (profile.plan === 'founding') {
    return json(
      {
        error: 'Founding members have lifetime Premium — no billing to manage',
        code: 'founding',
      },
      409,
    );
  }

  if (profile.plan !== 'premium' || !isEntitledPremium(profile)) {
    return json({ error: 'Subscribe first to manage billing', code: 'not_subscribed' }, 409);
  }

  const customerId = String(profile.stripe_customer_id || '').trim();
  if (!customerId) {
    return json({ error: 'No billing account yet', code: 'no_customer' }, 400);
  }

  const session = await stripePost(stripeKey, '/billing_portal/sessions', {
    customer: customerId,
    return_url: `${siteUrl}/?billing=portal`,
  });

  const url = String(session.url || '');
  if (!url) {
    return json({ error: 'Portal session missing URL' }, 500);
  }

  return json({ url });
});
