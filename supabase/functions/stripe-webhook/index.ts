/**
 * Stripe webhooks → profiles.plan / premium_until / stripe_customer_id
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { json } from '../_shared/http.ts';
import {
  isActiveSubscriptionStatus,
  periodEndIso,
  stripeGet,
} from '../_shared/stripe.ts';
import { syncPlanRoles } from '../_shared/discord.ts';

type ProfileRow = {
  id: string;
  plan: string;
  founding_slot: number | null;
  stripe_customer_id: string | null;
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') || '';

  if (!supabaseUrl || !serviceKey || !webhookSecret || !stripeKey) {
    return json({ error: 'Server misconfigured' }, 500);
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return json({ error: 'Missing stripe-signature' }, 400);
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('webhook signature', err);
    return json({ error: 'Invalid signature' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await onCheckoutCompleted(supabase, stripeKey, event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await onSubscriptionChange(
          supabase,
          event.data.object as Stripe.Subscription,
          event.type === 'customer.subscription.deleted',
        );
        break;
      case 'invoice.paid':
        await onInvoicePaid(supabase, stripeKey, event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await onInvoiceFailed(supabase, stripeKey, event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(event.type, err);
    return json({ error: 'Handler failed' }, 500);
  }

  return json({ received: true });
});

async function onCheckoutCompleted(
  supabase: ReturnType<typeof createClient>,
  stripeKey: string,
  session: Stripe.Checkout.Session,
) {
  const userId =
    String(session.client_reference_id || '').trim() ||
    String(session.metadata?.supabase_user_id || '').trim();
  if (!userId) return;

  const profile = await loadProfile(supabase, { id: userId });
  if (!profile || profile.plan === 'founding') return;

  const customerId = String(session.customer || '').trim();
  const subId = String(session.subscription || '').trim();
  if (!subId || !customerId) return;

  // Checkout completion does not itself prove a successful recurring payment.
  // Reuse the active/trialing subscription state transition below.
  const sub = await stripeGet(stripeKey, `/subscriptions/${subId}`);
  if (!isActiveSubscriptionStatus(String(sub.status || '')) || !periodEndIso(sub)) {
    await onSubscriptionChange(supabase, sub, sub.status === 'canceled');
    return;
  }
  await onSubscriptionChange(supabase, sub, false);
}

async function onSubscriptionChange(
  supabase: ReturnType<typeof createClient>,
  sub: Stripe.Subscription,
  deleted: boolean,
) {
  const customerId = String(sub.customer || '').trim();
  if (!customerId) return;

  const profile =
    (await loadProfile(supabase, { stripe_customer_id: customerId })) ||
    (await loadProfile(supabase, {
      id: String(sub.metadata?.supabase_user_id || ''),
    }));
  if (!profile || profile.plan === 'founding') return;

  const active = !deleted && isActiveSubscriptionStatus(String(sub.status || ''));
  const premiumUntil = periodEndIso(sub);

  if (active && premiumUntil) {
    await supabase
      .from('profiles')
      .update({
        plan: 'premium',
        premium_until: premiumUntil,
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);
    await mirrorDiscordPlan(supabase, profile.id);
    return;
  }

  await supabase
    .from('profiles')
    .update({
      plan: 'free',
      premium_until: premiumUntil,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id);
  await mirrorDiscordPlan(supabase, profile.id);
}

async function mirrorDiscordPlan(
  supabase: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data, error } = await supabase
    .from('profiles')
    .select('discord_id, plan')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data?.discord_id) return;
  const { count } = await supabase
    .from('builds')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', userId);
  try {
    await syncPlanRoles(String(data.discord_id), String(data.plan || 'free'), count || 0);
  } catch (err) {
    console.error('discord role sync', err);
  }
}

async function onInvoicePaid(
  supabase: ReturnType<typeof createClient>,
  stripeKey: string,
  invoice: Stripe.Invoice,
) {
  const subId = String(invoice.subscription || '').trim();
  if (!subId) return;
  const sub = await stripeGet(stripeKey, `/subscriptions/${subId}`);
  await onSubscriptionChange(supabase, sub, false);
}

async function onInvoiceFailed(
  supabase: ReturnType<typeof createClient>,
  stripeKey: string,
  invoice: Stripe.Invoice,
) {
  const subId = String(invoice.subscription || '').trim();
  if (!subId) return;
  const sub = await stripeGet(stripeKey, `/subscriptions/${subId}`);
  if (isActiveSubscriptionStatus(String(sub.status || ''))) return;
  await onSubscriptionChange(supabase, sub, sub.status === 'canceled');
}

async function loadProfile(
  supabase: ReturnType<typeof createClient>,
  filter: { id?: string; stripe_customer_id?: string },
): Promise<ProfileRow | null> {
  const id = String(filter.id || '').trim();
  const customerId = String(filter.stripe_customer_id || '').trim();
  if (!id && !customerId) return null;

  let q = supabase
    .from('profiles')
    .select('id, plan, founding_slot, stripe_customer_id');
  if (id) q = q.eq('id', id);
  else q = q.eq('stripe_customer_id', customerId);

  const { data, error } = await q.maybeSingle();
  if (error) {
    console.error(error);
    return null;
  }
  return data as ProfileRow | null;
}
