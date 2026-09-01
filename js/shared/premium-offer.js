/**
 * Reusable Premium / founding offer panel (Patch3-style).
 */

import { signInWithDiscord, authRedirectTo, getSession, getProfile } from './auth.js';
import {
  FOUNDING_TOTAL,
  PREMIUM_PRICE_LABEL,
  getFoundingStatus,
  hasPremiumAccess,
} from './entitlements.js';

/** @typedef {'signin' | 'offer' | 'founding'} OfferMode */

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
    <div
      class="bpb-premium-offer__panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bpb-premium-offer-title"
    >
      <button type="button" class="bpb-premium-offer__close" data-offer-close aria-label="Close">×</button>
      <div class="bpb-premium-offer__body" data-offer-body></div>
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

/**
 * @param {{ used: number, total: number, open: boolean }} status
 */
function foundingCounterHtml(status) {
  return `<p class="bpb-premium-offer__counter bpb-label-text">${status.used}/${status.total} founding slots claimed</p>`;
}

/**
 * @param {OfferMode} mode
 * @param {{ reason?: string, status?: { used: number, total: number, open: boolean }, signedIn?: boolean }} ctx
 */
function panelHtml(mode, ctx) {
  const reason = ctx.reason
    ? `<p class="bpb-premium-offer__reason">${escapeHtml(ctx.reason)}</p>`
    : '';
  const status = ctx.status || { used: 0, total: FOUNDING_TOTAL, open: true };
  const counter = foundingCounterHtml(status);

  if (mode === 'signin') {
    return `
      <h2 class="bpb-premium-offer__title bpb-label-text" id="bpb-premium-offer-title">Premium feature</h2>
      ${reason}
      <p class="bpb-premium-offer__lede">Sign in with Discord to continue. First <strong>${FOUNDING_TOTAL}</strong> eligible members get <strong>Premium forever</strong> — no Stripe required.</p>
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
    const full = !status.open;
    return `
      <h2 class="bpb-premium-offer__title bpb-label-text" id="bpb-premium-offer-title">Founding members</h2>
      <p class="bpb-premium-offer__lede">
        ${
          full
            ? `All ${FOUNDING_TOTAL} founding slots are claimed. Premium is <strong>${PREMIUM_PRICE_LABEL}</strong>.`
            : `The first <strong>${FOUNDING_TOTAL}</strong> eligible Discord sign-ins get <strong>Premium forever</strong> — combat sandbox, screenshot→build, and more.`
        }
      </p>
      ${counter}
      <p class="bpb-premium-offer__meta">After founding fills, Premium is ${PREMIUM_PRICE_LABEL} via Stripe.</p>
      <div class="bpb-premium-offer__actions">
        ${
          ctx.signedIn
            ? `<button type="button" class="bpb-premium-offer__btn bpb-premium-offer__btn--primary" data-offer-close>Got it</button>`
            : `<button type="button" class="bpb-premium-offer__btn bpb-premium-offer__btn--primary" data-offer-discord>Sign in with Discord</button>
               <button type="button" class="bpb-premium-offer__btn bpb-premium-offer__btn--quiet" data-offer-close>Not now</button>`
        }
      </div>
    `;
  }

  return `
    <h2 class="bpb-premium-offer__title bpb-label-text" id="bpb-premium-offer-title">Premium</h2>
    ${reason}
    <p class="bpb-premium-offer__lede">
      Unlock the combat sandbox, screenshot→build, and future Premium tools for <strong>${PREMIUM_PRICE_LABEL}</strong>.
    </p>
    ${counter}
    <ul class="bpb-premium-offer__bullets">
      <li>Run builds in the predictive combat lab</li>
      <li>Full combat log and damage meters</li>
      <li>Founding members keep Premium forever (while slots last)</li>
    </ul>
    <p class="bpb-premium-offer__meta">Stripe checkout ships with public launch. Founding slots grant automatically on first sign-in.</p>
    <div class="bpb-premium-offer__actions">
      <button type="button" class="bpb-premium-offer__btn bpb-premium-offer__btn--primary" disabled title="Coming soon">
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
  const status = await getFoundingStatus();
  body.innerHTML = panelHtml(mode, {
    reason: opts.reason,
    status,
    signedIn: Boolean(session),
  });
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

  const primary = body.querySelector('.bpb-premium-offer__btn--primary');
  if (primary instanceof HTMLElement) primary.focus();
}

export function closePremiumOffer() {
  if (!(layer instanceof HTMLElement)) return;
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
 * After OAuth return — if still not entitled, show full offer.
 * @param {string} [reason]
 */
export async function maybeShowPostSignInOffer(reason) {
  const profile = await getProfile({ force: true });
  if (hasPremiumAccess(profile)) return false;
  await openUpgradeOffer({ reason });
  return true;
}
