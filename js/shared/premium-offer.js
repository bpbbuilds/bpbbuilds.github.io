/**
 * Reusable Premium / founding offer panel (Patch3-style).
 */

import { signInWithDiscord, authRedirectTo, getSession, getProfile } from './auth.js';
import {
  FOUNDING_TOTAL,
  PREMIUM_PRICE_LABEL,
  claimFoundingSlot,
  getFoundingStatus,
  hasPremiumAccess,
  isFounding,
  isPaidPremium,
} from './entitlements.js';
import { startStripeCheckout } from './stripe-checkout.js';
import { startStripePortal } from './stripe-portal.js';
import { premiumCompareHtml, bindPremiumCompareTips, clearPremiumCompareTips } from './premium-features.js';

/** @typedef {'signin' | 'offer' | 'founding' | 'billing' | 'compare'} OfferMode */

/** @type {HTMLElement | null} */
let layer = null;

/**
 * @param {string} s
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rootPrefix() {
  const raw = document.body?.dataset?.root ?? './';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function ensureLayer() {
  if (layer instanceof HTMLElement && document.body.contains(layer)) return layer;
  layer = document.createElement('div');
  layer.className = 'bpb-premium-offer';
  layer.hidden = true;
  layer.innerHTML = `
    <div class="bpb-premium-offer__backdrop" data-offer-close tabindex="-1"></div>
    <div class="bpb-premium-offer__frame">
      <span class="bpb-premium-offer__halo" aria-hidden="true"></span>
      <div
        class="bpb-premium-offer__panel bpb-panel--rewards"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bpb-premium-offer-title"
      >
        <button type="button" class="bpb-premium-offer__close" data-offer-close aria-label="Close">×</button>
        <div class="bpb-premium-offer__body" data-offer-body></div>
      </div>
    </div>
  `;
  document.body.appendChild(layer);
  layer.addEventListener('click', (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (t?.closest?.('[data-offer-close]')) closePremiumOffer();
  });
  window.addEventListener('keydown', onEsc);
  return layer;
}

/** @param {KeyboardEvent} e */
function onEsc(e) {
  if (e.key !== 'Escape') return;
  if (layer && !layer.hidden) closePremiumOffer();
}

function offerRuleHtml() {
  return `<div class="bpb-premium-offer__rule" aria-hidden="true"><span class="bpb-premium-offer__rule-line"></span><svg class="bpb-premium-offer__rule-gem" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path fill="currentColor" d="M5 0.8 L9.2 5 L5 9.2 L0.8 5 Z"/></svg><span class="bpb-premium-offer__rule-line"></span></div>`;
}

/**
 * @param {{ used: number, total: number, open: boolean, started?: boolean }} status
 */
function foundingCounterHtml(status) {
  const used = Math.max(0, Math.round(Number(status.used) || 0));
  const total = Math.max(1, Math.round(Number(status.total) || FOUNDING_TOTAL));
  const pct = Math.max(0, Math.min(100, (used / total) * 100));
  const label = !status.started
    ? 'Opens at launch'
    : status.open
      ? 'Slots claimed'
      : 'Founding full';
  return `
    <div class="bpb-premium-offer__slots" role="status" aria-label="${used} of ${total} founding slots claimed">
      <div class="bpb-premium-offer__slots-top">
        <span>${label}</span>
        <span class="bpb-premium-offer__slots-count">${used} / ${total}</span>
      </div>
      <div class="bpb-premium-offer__meter" aria-hidden="true"><span style="width:${pct}%"></span></div>
    </div>`;
}

/**
 * @param {{ used: number, total: number, open: boolean, started?: boolean }} status
 * @param {{ signedIn?: boolean, member?: boolean }} who
 */
function foundingOfferCopy(status, who) {
  if (who.member) {
    return {
      kicker: 'Premium member',
      lede: 'You already are a <strong>Premium member</strong>.',
      meta: who.founding
        ? 'Premium forever on this account. No Stripe charge.'
        : 'Premium is active on this account.',
    };
  }
  if (!who.signedIn && status.open) {
    return {
      kicker: 'Premium forever',
      lede: 'Sign in to claim <strong>Premium for free forever</strong>.',
      meta: `The first <strong>${FOUNDING_TOTAL}</strong> eligible Discord sign-ins. After that, Premium is <strong>${PREMIUM_PRICE_LABEL}</strong>.`,
    };
  }
  if (!who.signedIn) {
    return {
      kicker: 'Premium forever',
      lede: status.started
        ? `All <strong>${FOUNDING_TOTAL}</strong> founding slots are claimed.`
        : 'Sign in to claim <strong>Premium for free forever</strong> when the public site launches.',
      meta: status.started
        ? `Premium is <strong>${PREMIUM_PRICE_LABEL}</strong> via Stripe.`
        : `Until then, Premium is <strong>${PREMIUM_PRICE_LABEL}</strong> via Stripe.`,
    };
  }
  if (status.open) {
    return {
      kicker: 'Premium forever',
      lede: 'A founding slot is still open for this account.',
      meta: 'Claim it to keep Premium forever. No Stripe charge.',
    };
  }
  if (!status.started) {
    return {
      kicker: 'Premium forever',
      lede: `The first <strong>${FOUNDING_TOTAL}</strong> eligible members. Claiming opens when the public site launches.`,
      meta: `Until then, Premium is <strong>${PREMIUM_PRICE_LABEL}</strong> via Stripe.`,
    };
  }
  return {
    kicker: 'Founding is full',
    lede: `All <strong>${FOUNDING_TOTAL}</strong> slots are claimed.`,
    meta: `Premium is <strong>${PREMIUM_PRICE_LABEL}</strong> via Stripe.`,
  };
}

function foundingActionsHtml(status, who) {
  const features = `<button type="button" class="bpb-premium-offer__btn bpb-premium-offer__btn--quiet" data-offer-features>View Premium features</button>`;
  if (who.member) {
    return `<button type="button" class="bpb-premium-offer__btn bpb-premium-offer__btn--primary" data-offer-features>View Premium features</button>`;
  }
  if (!who.signedIn && (status.open || !status.started)) {
    const label = status.open ? 'Claim now' : 'Sign in to claim';
    return `<button type="button" class="bpb-premium-offer__btn bpb-premium-offer__btn--primary" data-offer-discord>${label}</button>
      ${features}`;
  }
  if (who.signedIn && status.open) {
    return `<button type="button" class="bpb-premium-offer__btn bpb-premium-offer__btn--primary" data-offer-claim>Claim now</button>
      ${features}`;
  }
  const join = who.signedIn
    ? `<button type="button" class="bpb-premium-offer__btn bpb-premium-offer__btn--primary" data-offer-checkout>Join Premium</button>`
    : `<button type="button" class="bpb-premium-offer__btn bpb-premium-offer__btn--primary" data-offer-discord>Join Premium</button>`;
  return `${join}
    ${features}`;
}

function premiumFeaturesHtml(ctx) {
  const who = {
    signedIn: Boolean(ctx.signedIn),
    member: Boolean(ctx.member),
  };
  let actions = `<button type="button" class="bpb-premium-offer__btn bpb-premium-offer__btn--primary" data-offer-close>Got it</button>`;
  if (!who.member && !who.signedIn) {
    actions = `<button type="button" class="bpb-premium-offer__btn bpb-premium-offer__btn--primary" data-offer-discord>Sign in with Discord</button>
      <button type="button" class="bpb-premium-offer__btn bpb-premium-offer__btn--quiet" data-offer-close>Not now</button>`;
  } else if (!who.member) {
    actions = `<button type="button" class="bpb-premium-offer__btn bpb-premium-offer__btn--primary" data-offer-checkout>Upgrade — ${PREMIUM_PRICE_LABEL}</button>
      <button type="button" class="bpb-premium-offer__btn bpb-premium-offer__btn--quiet" data-offer-close>Not now</button>`;
  }
  return `
    <h2 class="bpb-premium-offer__title" id="bpb-premium-offer-title">Premium features</h2>
    ${offerRuleHtml()}
    ${premiumCompareHtml()}
    <div class="bpb-premium-offer__actions">
      ${actions}
    </div>
  `;
}

/**
 * @param {OfferMode} mode
 * @param {{ reason?: string, status?: { used: number, total: number, open: boolean, started?: boolean }, signedIn?: boolean, member?: boolean, founding?: boolean }} ctx
 */
function panelHtml(mode, ctx) {
  const reason = ctx.reason
    ? `<p class="bpb-premium-offer__reason">${escapeHtml(ctx.reason)}</p>`
    : '';
  const status = ctx.status || {
    used: 0,
    total: FOUNDING_TOTAL,
    open: false,
    started: false,
  };
  const counter = foundingCounterHtml(status);

  if (mode === 'signin') {
    const lede = status.started
      ? `Sign in with Discord to continue. First <strong>${FOUNDING_TOTAL}</strong> eligible members get <strong>Premium forever</strong> — no Stripe required.`
      : `Sign in with Discord to continue. Founding opens at public launch; until then use Premium (<strong>${PREMIUM_PRICE_LABEL}</strong>).`;
    return `
      <h2 class="bpb-premium-offer__title" id="bpb-premium-offer-title">Premium feature</h2>
      ${offerRuleHtml()}
      ${reason}
      <p class="bpb-premium-offer__lede">${lede}</p>
      ${counter}
      <div class="bpb-premium-offer__actions">
        <button type="button" class="bpb-premium-offer__btn bpb-premium-offer__btn--primary" data-offer-discord>
          Sign in with Discord
        </button>
        <button type="button" class="bpb-premium-offer__btn bpb-premium-offer__btn--quiet" data-offer-close>
          Not now
        </button>
      </div>
    `;
  }

  if (mode === 'founding') {
    const who = {
      signedIn: Boolean(ctx.signedIn),
      member: Boolean(ctx.member),
      founding: Boolean(ctx.founding),
    };
    const copy = foundingOfferCopy(status, who);
    return `
      <h2 class="bpb-premium-offer__title" id="bpb-premium-offer-title">Founding members</h2>
      ${offerRuleHtml()}
      <p class="bpb-premium-offer__kicker">${copy.kicker}</p>
      <p class="bpb-premium-offer__lede">${copy.lede}</p>
      ${counter}
      <p class="bpb-premium-offer__meta">${copy.meta}</p>
      <div class="bpb-premium-offer__actions">
        ${foundingActionsHtml(status, who)}
      </div>
    `;
  }

  if (mode === 'billing') {
    return `
      <h2 class="bpb-premium-offer__title" id="bpb-premium-offer-title">Premium billing</h2>
      ${offerRuleHtml()}
      ${reason}
      <p class="bpb-premium-offer__lede">
        Manage your <strong>${PREMIUM_PRICE_LABEL}</strong> subscription — update payment method, view invoices, or cancel.
      </p>
      <div class="bpb-premium-offer__actions">
        <button type="button" class="bpb-premium-offer__btn bpb-premium-offer__btn--primary" data-offer-portal>
          Manage billing
        </button>
        <button type="button" class="bpb-premium-offer__btn bpb-premium-offer__btn--quiet" data-offer-close>
          Close
        </button>
      </div>
    `;
  }

  if (mode === 'compare') {
    return premiumFeaturesHtml(ctx);
  }

  const foundingMeta = status.started
    ? 'Founding slots grant automatically on first Discord sign-in. Cancel anytime via Stripe billing.'
    : 'Founding opens when the public site launches. Until then, upgrade with Stripe anytime.';

  return `
    <h2 class="bpb-premium-offer__title" id="bpb-premium-offer-title">Premium</h2>
    ${offerRuleHtml()}
    ${reason}
    <p class="bpb-premium-offer__lede">
      Unlock the combat sandbox and board export for <strong>${PREMIUM_PRICE_LABEL}</strong>.
    </p>
    ${premiumCompareHtml()}
    <p class="bpb-premium-offer__meta">${foundingMeta}</p>
    <div class="bpb-premium-offer__actions">
      <button type="button" class="bpb-premium-offer__btn bpb-premium-offer__btn--primary" data-offer-checkout>
        Upgrade — ${PREMIUM_PRICE_LABEL}
      </button>
      <button type="button" class="bpb-premium-offer__btn bpb-premium-offer__btn--quiet" data-offer-close>
        Not now
      </button>
    </div>
  `;
}

/**
 * @param {OfferMode} mode
 * @param {{ reason?: string, onDiscord?: () => void }} [opts]
 */
export async function openPremiumOffer(mode, opts = {}) {
  const shell = ensureLayer();
  const body = shell.querySelector('[data-offer-body]');
  if (!(body instanceof HTMLElement)) return;

  const session = await getSession();
  const profile = session ? await getProfile() : null;
  let resolvedMode = mode;
  if (mode === 'offer' && profile) {
    if (isPaidPremium(profile)) resolvedMode = 'billing';
    else if (isFounding(profile)) resolvedMode = 'founding';
  }

  const status = await getFoundingStatus();
  const member = hasPremiumAccess(profile);
  body.innerHTML = panelHtml(resolvedMode, {
    reason: opts.reason,
    status,
    signedIn: Boolean(session),
    member,
    founding: isFounding(profile) || Boolean(profile?.is_owner),
  });
  bindPremiumCompareTips(body);
  shell.hidden = false;
  document.body.classList.add('bpb-premium-offer-open');

  body.querySelector('[data-offer-discord]')?.addEventListener(
    'click',
    () => {
      opts.onDiscord?.();
      signInWithDiscord(authRedirectTo()).catch((err) => {
        console.error(err);
        window.alert(err instanceof Error ? err.message : 'Sign-in failed.');
      });
    },
    { once: true },
  );

  const checkoutBtn = body.querySelector('[data-offer-checkout]');
  if (checkoutBtn instanceof HTMLButtonElement) {
    checkoutBtn.addEventListener('click', () => {
      const btn = checkoutBtn;
      const label = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Opening checkout…';
      startStripeCheckout()
        .then((url) => {
          location.href = url;
        })
        .catch((err) => {
          console.error(err);
          window.alert(err instanceof Error ? err.message : 'Checkout failed.');
          btn.disabled = false;
          btn.textContent = label || `Upgrade — ${PREMIUM_PRICE_LABEL}`;
        });
    });
  }

  const portalBtn = body.querySelector('[data-offer-portal]');
  if (portalBtn instanceof HTMLButtonElement) {
    portalBtn.addEventListener('click', () => {
      const btn = portalBtn;
      const label = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Opening…';
      startStripePortal()
        .then((url) => {
          location.href = url;
        })
        .catch((err) => {
          console.error(err);
          window.alert(err instanceof Error ? err.message : 'Billing portal failed.');
          btn.disabled = false;
          btn.textContent = label || 'Manage billing';
        });
    });
  }

  body.querySelector('[data-offer-features]')?.addEventListener('click', () => {
    void openPremiumOffer('compare', opts);
  });

  const claimBtn = body.querySelector('[data-offer-claim]');
  if (claimBtn instanceof HTMLButtonElement) {
    claimBtn.addEventListener('click', () => {
      const btn = claimBtn;
      btn.disabled = true;
      btn.textContent = 'Claiming…';
      claimFoundingSlot()
        .then(async (result) => {
          // The RPC reports normal outcomes in its JSON payload. Only a
          // successful/already-entitled request should be treated as a claim;
          // otherwise the old code silently re-rendered the same button.
          if (result.status === 'error' || result.status === 'exception') {
            throw new Error(result.reason || 'Could not claim a founding slot.');
          }
          if (result.status === 'unknown' || result.status === 'no_data') {
            throw new Error('Could not verify the founding claim. Please try again.');
          }
          await getProfile({ force: true });
        })
        .then(() => openPremiumOffer('founding', opts))
        .catch((err) => {
          console.error(err);
          window.alert(err instanceof Error ? err.message : 'Could not claim a founding slot.');
          btn.disabled = false;
          btn.textContent = 'Claim now';
        });
    });
  }

  const primary = body.querySelector('.bpb-premium-offer__btn--primary');
  if (primary instanceof HTMLElement) primary.focus();
}

export function closePremiumOffer() {
  if (!(layer instanceof HTMLElement)) return;
  clearPremiumCompareTips();
  layer.hidden = true;
  document.body.classList.remove('bpb-premium-offer-open');
}

/** @returns {boolean} */
export function isPremiumOfferOpen() {
  return layer instanceof HTMLElement && !layer.hidden;
}

/**
 * @param {{ reason?: string }} [opts]
 */
export async function openFoundingOffer(opts = {}) {
  await openPremiumOffer('founding', opts);
}

/**
 * @param {{ reason?: string, onDiscord?: () => void }} [opts]
 */
export async function openSignInOffer(opts = {}) {
  await openPremiumOffer('signin', opts);
}

/**
 * @param {{ reason?: string }} [opts]
 */
export async function openUpgradeOffer(opts = {}) {
  await openPremiumOffer('offer', opts);
}

/**
 * Free vs Premium list in the shared dialog. Members get the list.
 * Everyone else gets the list plus sign-in or upgrade.
 * @param {{ reason?: string, onDiscord?: () => void }} [opts]
 */
export async function openPremiumCompare(opts = {}) {
  await openPremiumOffer('compare', opts);
}
