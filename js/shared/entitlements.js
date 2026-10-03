/**
 * Premium / founding entitlement helpers (profiles.plan).
 */

import { getSupabase } from './supabase.js';

/** @typedef {'free' | 'founding' | 'premium'} PlanId */

/** @typedef {{
   10| *   id: string,
 *   discord_id: string,
 *   display_name: string | null,
 *   avatar_url: string | null,
 *   equipped_avatar: string | null,
 *   is_owner: boolean,
 *   voter_key: string | null,
 *   plan: PlanId,
 *   founding_slot: number | null,
 *   premium_until: string | null,
    20| *   cosmetic_grants?: unknown,
 *   coins?: number,
 * }} Profile */

export const PREMIUM_PRICE_LABEL = '$3/mo';
export const FOUNDING_TOTAL = 10;

/**
 * @param {string | null | undefined} raw
 * @returns {PlanId}
    30| */
export function normalizePlan(raw) {
  const p = String(raw || 'free').toLowerCase();
  if (p === 'founding' || p === 'premium') return p;
  return 'free';
}

/**
 * @param {Profile | null | undefined} profile
 */
    40|export function isFounding(profile) {
  return normalizePlan(profile?.plan) === 'founding';
}

/**
 * @param {Profile | null | undefined} profile
 */
export function isPaidPremium(profile) {
  return normalizePlan(profile?.plan) === 'premium';
}
    50|
/**
 * @param {Profile | null | undefined} profile
 */
export function hasPremiumAccess(profile) {
  if (!profile) return false;
  if (profile.is_owner) return true;
  const plan = normalizePlan(profile.plan);
  if (plan === 'founding') return true;
  if (plan === 'premium') {
    60|    const until = profile.premium_until ? Date.parse(profile.premium_until) : NaN;
    // A paid subscription with no Stripe end date is not an entitlement.
    return Number.isFinite(until) && until > Date.now();
  }
  return false;
}

/**
 * @param {Profile | null | undefined} profile
 */
    70|export function planLabel(profile) {
  if (!profile) return 'Free';
  if (profile.is_owner) return 'Owner';
  const plan = normalizePlan(profile.plan);
  if (plan === 'founding') return 'Founding';
  if (plan === 'premium') return 'Premium';
  return 'Free';
}

/**
    80| * @returns {Promise<{ used: number, total: number, open: boolean, started: boolean }>}
 */
export async function getFoundingStatus() {
  const fallback = { used: 0, total: FOUNDING_TOTAL, open: false, started: false };
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_founding_status');
    if (error) {
      console.error(error);
      return fallback;
    90|    }
    const used = Math.max(0, Math.round(Number(data?.used) || 0));
    const total = Math.max(1, Math.round(Number(data?.total) || FOUNDING_TOTAL));
    const started = data?.started === true;
    const open = data?.open === true && started && used < total;
    return { used, total, open, started };
  } catch (err) {
    console.error(err);
    return fallback;
  }
   100|}

/**
 * Best-effort auto-grant on sign-in.
 * @returns {Promise<{ status: 'granted' | 'error' | 'not_started' | 'full' | 'ineligible',
 *                       data?: object, reason?: string }>}
 */
export async function claimFoundingSlot() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('claim_founding_slot');
    if (error) {
      console.error('[claimFoundingSlot] RPC error', error);
      return { status: 'error', reason: error.message || 'RPC failed' };
    }
    if (data && typeof data === 'object') {
      const { granted, already_entitled, ineligible, not_started, full, slot, used, total, plan } = data;
      if (granted) return { status: 'granted', data };
      if (already_entitled) return { status: 'already_entitled', data };
      if (ineligible) return { status: 'ineligible', data };
      if (not_started) return { status: 'not_started', data };
      if (full) return { status: 'full', data };
      return { status: 'unknown', data };
    }
    return { status: 'no_data', reason: 'Unexpected RPC response' };
  } catch (err) {
    console.error('[claimFoundingSlot] Unexpected error', err);
    return { status: 'exception', reason: err.message || 'Unknown error' };
  }
}
   120|