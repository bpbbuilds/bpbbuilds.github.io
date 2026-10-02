/**
 * Nav Login plaque + founding-member chip.
 */

import {
  getProfile,
  getSession,
  personaFromUser,
  discordIdFromUser,
  signInWithDiscord,
} from '../auth.js';
import { getFoundingStatus, isPaidPremium } from '../entitlements.js';
import { openFoundingOffer } from '../premium-offer.js';
import { faceHtml, hydrateFaces } from '../blob-face.js';
import { startStripePortal } from '../stripe-portal.js';
import { profileHref } from '../profile-href.js';
import { escapeAttr, escapeHtml } from './markup.js';

/**
 * @param {HTMLElement} host
 * @param {string} [root]
 */
export async function paintNavFounding(host, root = './') {
  const base = root.endsWith('/') ? root : `${root}/`;
  const crown = `${base}assets/item-thumbs/2x/Crown.webp`;
  const status = await getFoundingStatus();
  const kicker = status.open || !status.started ? 'Free Premium' : 'Premium';
  host.innerHTML = `
    <button
      type="button"
      class="site-nav__announce"
      data-nav-founding
      title="First ${status.total} founding members get Premium forever"
      aria-label="${kicker}: ${status.used} of ${status.total} founding slots claimed"
    >
      <span class="site-nav__announce-crown" aria-hidden="true">
        <img src="${escapeAttr(crown)}" alt="" width="64" height="64" draggable="false" />
      </span>
      <span class="site-nav__announce-copy">
        <span class="site-nav__announce-kicker">${kicker}</span>
        <span class="site-nav__announce-count">${status.used}/${status.total}</span>
      </span>
    </button>
  `;
  host.querySelector('[data-nav-founding]')?.addEventListener('click', () => {
    openFoundingOffer().catch((err) => console.error(err));
  });
}

/**
 * @param {HTMLElement} host
 * @param {string} root
 */
export async function paintNavAuth(host, root) {
  const plate = `${root}assets/theme/ui/ui-shop-sign.png`;
  const session = await getSession();
  if (!session) {
    host.innerHTML = `
      <button type="button" class="site-nav__login" data-nav-signin title="Sign in with Discord">
        <img
          class="site-nav__login-plate"
          src="${escapeAttr(plate)}"
          alt=""
          width="608"
          height="332"
          draggable="false"
          aria-hidden="true"
        />
        <span class="site-nav__login-text">Login</span>
      </button>
    `;
    host.querySelector('[data-nav-signin]')?.addEventListener('click', () => {
      signInWithDiscord().catch((err) => {
        console.error(err);
        window.alert(err instanceof Error ? err.message : 'Sign-in failed.');
      });
    });
    return;
  }

  const profile = await getProfile();
  const persona = personaFromUser(session.user);
  const name =
    String(profile?.display_name || persona.display_name || 'Account').trim() ||
    'Account';
  const avatarHtml =
    faceHtml(profile, root, {
      className: 'site-nav__login-avatar',
      size: 40,
      alt: name,
      emptyHtml: `<span class="site-nav__login-avatar site-nav__login-avatar--empty" aria-hidden="true"></span>`,
    }) ||
    `<span class="site-nav__login-avatar site-nav__login-avatar--empty" aria-hidden="true"></span>`;
  const discordId = String(
    profile?.discord_id || discordIdFromUser(session.user) || '',
  ).trim();
  const accountHref = profileHref(discordId, root) || root;
  const billingHtml = isPaidPremium(profile)
    ? `<button type="button" class="site-nav__login-out site-nav__login-billing" data-nav-billing>Manage billing</button>`
    : '';
  const actionsHtml = billingHtml
    ? `<div class="site-nav__login-actions">${billingHtml}</div>`
    : '';

  host.innerHTML = `
    <div class="site-nav__login site-nav__login--session" data-nav-auth-menu>
      <img
        class="site-nav__login-plate"
        src="${escapeAttr(plate)}"
        alt=""
        width="608"
        height="332"
        draggable="false"
        aria-hidden="true"
      />
      <div class="site-nav__login-session">
        <a
          class="site-nav__login-persona"
          href="${escapeAttr(accountHref)}"
          title="${escapeAttr(name)} — profile"
        >
          ${avatarHtml}
          <span class="site-nav__login-name">${escapeHtml(name)}</span>
        </a>
        ${actionsHtml}
      </div>
    </div>
  `;
  void hydrateFaces(host, root);

  host.querySelector('[data-nav-billing]')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    if (!(btn instanceof HTMLButtonElement)) return;
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

/**
 * Verified checkmark → /admin/. Only painted when profiles.is_owner.
 * @param {HTMLElement} host
 * @param {string} root
 */
export async function paintNavAdmin(host, root) {
  const session = await getSession();
  const profile = session ? await getProfile() : null;
  if (!profile?.is_owner) {
    host.innerHTML = '';
    host.hidden = true;
    return;
  }
  const href = `${root.endsWith('/') ? root : `${root}/`}admin/`;
  const mark = `${root.endsWith('/') ? root : `${root}/`}assets/icons/admin-verified-badge.png`;
  host.hidden = false;
  host.innerHTML = `
    <a
      class="site-nav__admin"
      href="${escapeAttr(href)}"
      title="Admin"
      aria-label="Admin portal"
    >
      <img
        class="site-nav__admin-mark"
        src="${escapeAttr(mark)}"
        alt=""
        width="28"
        height="28"
        decoding="async"
      />
    </a>
  `;
}
