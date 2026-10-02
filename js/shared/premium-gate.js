/**
 * Premium gate — Discord-first, sessionStorage resume after OAuth.
 */

import { getSession, getProfile } from './auth.js';
import { hasPremiumAccess, claimFoundingSlot } from './entitlements.js';
import { openSignInOffer, openUpgradeOffer } from './premium-offer.js';

export const PREMIUM_INTENT_KEY = 'bpb-premium-intent';

/** sessionStorage intent when locking direct `/sim/` visits */
export const SIM_HARD_GATE_INTENT = 'sim-hard-gate';

/**
 * @typedef {{
 *   key: string,
 *   reason?: string,
 *   savedAt?: number,
 * }} PremiumIntent
 */

/**
 * Session + forced profile refresh for gate checks.
 * Best-effort founding claim so OAuth return sees entitlement before lock paint.
 * @returns {Promise<{
 *   signedIn: boolean,
 *   entitled: boolean,
 *   profile: import('./entitlements.js').Profile | null,
 * }>}
 */
export async function getPremiumEntitlement() {
  const session = await getSession();
  if (!session) {
    return { signedIn: false, entitled: false, profile: null };
  }
  await claimFoundingSlot();
  const profile = await getProfile({ force: true });
  return {
    signedIn: true,
    entitled: hasPremiumAccess(profile),
    profile,
  };
}

/**
 * @param {PremiumIntent} intent
 */
export function savePremiumIntent(intent) {
  try {
    sessionStorage.setItem(
      PREMIUM_INTENT_KEY,
      JSON.stringify({
        key: String(intent.key || ''),
        reason: intent.reason ? String(intent.reason) : '',
        savedAt: Date.now(),
      }),
    );
  } catch {
    /* private mode */
  }
}

/** @returns {PremiumIntent | null} */
export function readPremiumIntent() {
  try {
    const raw = sessionStorage.getItem(PREMIUM_INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const key = String(parsed.key || '');
    if (!key) return null;
    return {
      key,
      reason: parsed.reason ? String(parsed.reason) : '',
      savedAt: Number(parsed.savedAt) || 0,
    };
  } catch {
    return null;
  }
}

export function clearPremiumIntent() {
  try {
    sessionStorage.removeItem(PREMIUM_INTENT_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @param {{
 *   reason?: string,
 *   intentKey: string,
 *   onGranted: () => void | Promise<void>,
 * }} opts
 * @returns {Promise<boolean>} true if granted and callback ran
 */
export async function requirePremium(opts) {
  const reason = opts.reason || 'This feature requires Premium.';
  const session = await getSession();

  if (!session) {
    savePremiumIntent({ key: opts.intentKey, reason });
    await openSignInOffer({
      reason,
      onDiscord: () => savePremiumIntent({ key: opts.intentKey, reason }),
    });
    return false;
  }

  const profile = await getProfile({ force: true });
  if (hasPremiumAccess(profile)) {
    clearPremiumIntent();
    await opts.onGranted();
    return true;
  }

  savePremiumIntent({ key: opts.intentKey, reason });
  await openUpgradeOffer({ reason });
  return false;
}

/**
 * Resume after OAuth redirect (call once on page entry).
 * @param {Record<string, () => void | Promise<void>>} handlers intentKey → action
 */
export async function resumePremiumIntent(handlers) {
  const intent = readPremiumIntent();
  if (!intent?.key) return false;

  const session = await getSession();
  if (!session) return false;

  const handler = handlers[intent.key];
  if (typeof handler !== 'function') return false;

  await claimFoundingSlot();
  const profile = await getProfile({ force: true });
  if (hasPremiumAccess(profile)) {
    clearPremiumIntent();
    await handler();
    return true;
  }

  // Still not entitled. Drop the saved click so a later visit does not
  // reopen the upgrade dialog on its own.
  clearPremiumIntent();
  return false;
}
