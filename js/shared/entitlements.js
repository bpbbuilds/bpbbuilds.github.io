/**
 * Premium / founding entitlement helpers (profiles.plan).
 */

import { getSupabase } from './supabase.js';

/** @typedef {'free' | 'founding' | 'premium'} PlanId */

/** @typedef {{
 *   id: string,
 *   discord_id: string,
 *   display_name: string | null,
 *   avatar_url: string | null,
 *   equipped_avatar: string | null,
 *   is_owner: boolean,
 *   voter_key: string | null,
 *   plan: PlanId,
 *   founding_slot: number | null,
 *   premium_until: string | null,
 *   cosmetic_grants?: unknown,
 *   coins?: number,
 * }} Profile */

export const PREMIUM_PRICE_LABEL = '$3/mo';
export const FOUNDING_TOTAL = 10;

/**
 * @param {string | null | undefined} raw
 * @returns {PlanId}
 */
export function normalizePlan(raw) {
  const p = String(raw || 'free').toLowerCase();
  if (p === 'founding' || p === 'premium') return p;
  return 'free';
}

/**
 * @param {Profile | null | undefined} profile
 */
export function isFounding(profile) {
  return normalizePlan(profile?.plan) === 'founding';
}

/**
 * @param {Profile | null | undefined} profile
 */
export function isPaidPremium(profile) {
  return normalizePlan(profile?.plan) === 'premium';
}

/**
 * @param {Profile | null | undefined} profile
 */
export function hasPremiumAccess(profile) {
  if (!profile) return false;
  if (profile.is_owner) return true;
  const plan = normalizePlan(profile.plan);
  if (plan === 'founding') return true;
  if (plan === 'premium') {
    const until = profile.premium_until ? Date.parse(profile.premium_until) : NaN;
    if (!Number.isFinite(until)) return true;
    return until > Date.now();
  }
  return false;
}

/**
 * @param {Profile | null | undefined} profile
 */
export function planLabel(profile) {
  if (!profile) return 'Free';
  if (profile.is_owner) return 'Owner';
  const plan = normalizePlan(profile.plan);
  if (plan === 'founding') return 'Founding';
  if (plan === 'premium') return 'Premium';
  return 'Free';
}

/**
 * @returns {Promise<{ used: number, total: number, open: boolean, started: boolean }>}
 */
export async function getFoundingStatus() {
  const fallback = { used: 0, total: FOUNDING_TOTAL, open: false, started: false };
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_founding_status');
    if (error) {
      console.error(error);
      return fallback;
    }
    const used = Math.max(0, Math.round(Number(data?.used) || 0));
    const total = Math.max(1, Math.round(Number(data?.total) || FOUNDING_TOTAL));
    const started = data?.started === true;
    const open = data?.open === true && started && used < total;
    return { used, total, open, started };
  } catch (err) {
    console.error(err);
    return fallback;
  }
}

/**
 * Best-effort auto-grant on sign-in.
 * @returns {Promise<object | null>}
 */
export async function claimFoundingSlot() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('claim_founding_slot');
    if (error) {
      console.error(error);
      return null;
    }
    return data && typeof data === 'object' ? data : null;
  } catch (err) {
    console.error(err);
    return null;
  }
}
