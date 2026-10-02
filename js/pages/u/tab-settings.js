/**
 * Profile hub — Settings tab (owner / self only).
 */

import { signOut } from '../../shared/auth.js';
import {
  hasPremiumAccess,
  isFounding,
  isPaidPremium,
  normalizePlan,
  planLabel,
  PREMIUM_PRICE_LABEL,
} from '../../shared/entitlements.js';
import { openPremiumOffer } from '../../shared/premium-offer.js';
import { faceHtml, hydrateFaces } from '../../shared/blob-face.js';
import { resolveIdentityMode } from '../../shared/profile-avatar.js';
import { startStripePortal } from '../../shared/stripe-portal.js';
import { parseLoadout, serializeLoadout, setIdentityMode } from './blob/loadout.js';
import { saveBlobLoadout } from './blob/save.js';
import { escapeAttr, escapeHtml } from './html.js';

/**
 * @param {'discord' | 'blob'} mode
 * @param {'discord' | 'blob'} current
 * @param {string} face
 */
function identityChoiceHtml(mode, current, face) {
  const on = mode === current;
  const label = mode === 'blob' ? 'Website blob' : 'Discord profile picture';
  return `<button
    type="button"
    class="profile-settings__identity-pick${on ? ' is-on' : ''}"
    data-profile-identity="${mode}"
    role="radio"
    aria-checked="${on ? 'true' : 'false'}"
    aria-label="${label}"
    title="${label}"
  >${face}</button>`;
}

/**
 * @param {object} profile
 */
function discordFaceHtml(profile) {
  const url = String(profile?.avatar_url || '').trim();
  if (!url) {
    return `<span class="profile-settings__face profile-settings__face--empty" aria-hidden="true"></span>`;
  }
  return `<img class="profile-settings__face" src="${escapeAttr(url)}" alt="" width="84" height="84" draggable="false" />`;
}

/**
 * @param {object} profile
 * @param {string} root
 */
function blobFaceHtml(profile, root) {
  const equipped = serializeLoadout(
    setIdentityMode(parseLoadout(profile?.equipped_avatar), 'blob'),
  );
  return faceHtml(
    { equipped_avatar: equipped },
    root,
    { className: 'profile-settings__face', size: 84, alt: 'Website blob' },
  );
}

/**
 * @param {HTMLElement} stage
 * @param {{
 *   profile: object,
 *   viewerProfile: object | null,
 *   isSelf: boolean,
 *   name: string,
 *   root?: string,
 *   onIdentityChange?: (payload: string) => void,
 * }} ctx
 */
export function mountSettingsTab(stage, ctx) {
  if (!ctx.isSelf) {
    stage.innerHTML = `
      <section class="profile-tab-stub" aria-label="Settings">
        <h2 class="profile-tab-stub__title bpb-label-text">Settings</h2>
        <p class="profile-tab-stub__lede">Settings are only available on your own profile.</p>
      </section>`;
    return;
  }

  const profile = ctx.viewerProfile || ctx.profile;
  const root = ctx.root || '../';
  const plan = normalizePlan(profile?.plan);
  const entitled = hasPremiumAccess(profile);
  const paid = isPaidPremium(profile);
  const founding = isFounding(profile);
  const discordId = String(profile?.discord_id || '').trim();
  const displayName = String(profile?.display_name || ctx.name || '').trim();
  let identity = resolveIdentityMode(profile);
  const until = profile?.premium_until
    ? (() => {
        const d = new Date(profile.premium_until);
        return Number.isNaN(d.getTime())
          ? ''
          : d.toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
      })()
    : '';

  let billingBody;
  if (paid) {
    billingBody = `
      <p class="profile-settings__fact">Stripe Premium${until ? ` · renews / ends ${escapeHtml(until)}` : ''}.</p>
      <button type="button" class="profile-settings__action" data-profile-billing>Manage billing</button>`;
  } else if (founding) {
    billingBody = `
      <p class="profile-settings__fact">Founding member — Premium forever. No Stripe invoice.</p>
      <button type="button" class="profile-settings__action profile-settings__action--quiet" data-profile-premium>View membership</button>`;
  } else if (entitled) {
    billingBody = `<p class="profile-settings__fact">You already have Premium access on this account.</p>`;
  } else {
    billingBody = `
      <p class="profile-settings__fact">Free plan. Premium is ${escapeHtml(PREMIUM_PRICE_LABEL)} (founding slots if still open).</p>
      <button type="button" class="profile-settings__action" data-profile-premium>Get Premium</button>`;
  }

  stage.innerHTML = `
    <section class="profile-settings" aria-label="Settings">
      <h2 class="profile-settings__title bpb-label-text">Settings</h2>
      <p class="profile-settings__lede">Account knobs for your profile.</p>

      <div class="profile-settings__panel items-filters il-filter">
        <div class="profile-settings__block il-filter__shade">
          <h3 class="profile-settings__heading">Account</h3>
          <dl class="profile-settings__dl">
            <div class="profile-settings__row">
              <dt>Display name</dt>
              <dd>${escapeHtml(displayName || '—')}</dd>
            </div>
            <div class="profile-settings__row">
              <dt>Discord</dt>
              <dd>${escapeHtml(discordId || '—')}</dd>
            </div>
            <div class="profile-settings__row">
              <dt>Plan</dt>
              <dd>${escapeHtml(planLabel(profile))}${plan === 'free' ? '' : ` (${escapeHtml(plan)})`}</dd>
            </div>
          </dl>
          <p class="profile-settings__hint">Name and Discord avatar sync from Discord when you sign in.</p>
        </div>

        <div class="profile-settings__block il-filter__shade">
          <h3 class="profile-settings__heading">Identity</h3>
          <p class="profile-settings__hint">Click the picture you want shown on your profile, in the nav, and in the combat sandbox.</p>
          <div class="profile-settings__identity" role="radiogroup" aria-label="Public identity">
            ${identityChoiceHtml('discord', identity, discordFaceHtml(profile))}
            ${identityChoiceHtml('blob', identity, blobFaceHtml(profile, root))}
          </div>
          <p class="profile-settings__fact" data-profile-identity-status hidden></p>
        </div>

        <div class="profile-settings__block il-filter__shade">
          <h3 class="profile-settings__heading">Billing</h3>
          ${billingBody}
        </div>

        <div class="profile-settings__block il-filter__shade">
          <h3 class="profile-settings__heading">Session</h3>
          <button type="button" class="profile-settings__action profile-settings__action--quiet" data-profile-signout>Sign out</button>
        </div>
      </div>
    </section>`;

  void hydrateFaces(stage, root);

  const statusEl = stage.querySelector('[data-profile-identity-status]');

  /**
   * @param {'discord' | 'blob'} mode
   */
  function paintIdentityUi(mode) {
    identity = mode;
    stage.querySelectorAll('[data-profile-identity]').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const on = el.getAttribute('data-profile-identity') === mode;
      el.classList.toggle('is-on', on);
      el.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  /**
   * @param {string} msg
   * @param {boolean} [ok]
   */
  function setIdentityStatus(msg, ok = true) {
    if (!(statusEl instanceof HTMLElement)) return;
    if (!msg) {
      statusEl.hidden = true;
      statusEl.textContent = '';
      return;
    }
    statusEl.hidden = false;
    statusEl.textContent = msg;
    statusEl.classList.toggle('profile-settings__fact--ok', ok);
    statusEl.classList.toggle('profile-settings__fact--err', !ok);
  }

  stage.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const btn = t.closest('[data-profile-identity]');
    if (!(btn instanceof HTMLElement) || !stage.contains(btn)) return;
    const mode = btn.getAttribute('data-profile-identity') === 'blob' ? 'blob' : 'discord';
    if (mode === identity) return;

    paintIdentityUi(mode);
    setIdentityStatus('Saving…');
    const next = setIdentityMode(parseLoadout(profile.equipped_avatar), mode);
    void saveBlobLoadout(next)
      .then((payload) => {
        profile.equipped_avatar = payload;
        if (ctx.profile && ctx.profile !== profile) ctx.profile.equipped_avatar = payload;
        ctx.onIdentityChange?.(payload);
        setIdentityStatus(
          mode === 'blob' ? 'Showing your website blob.' : 'Showing your Discord profile picture.',
        );
      })
      .catch((err) => {
        console.error(err);
        paintIdentityUi(resolveIdentityMode(profile));
        setIdentityStatus(err instanceof Error ? err.message : 'Could not save identity.', false);
      });
  });

  stage.querySelector('[data-profile-billing]')?.addEventListener('click', (e) => {
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

  stage.querySelector('[data-profile-premium]')?.addEventListener('click', () => {
    void openPremiumOffer(founding ? 'founding' : 'offer').catch((err) => {
      console.error(err);
      window.alert(err instanceof Error ? err.message : 'Could not open Premium.');
    });
  });

  stage.querySelector('[data-profile-signout]')?.addEventListener('click', () => {
    void signOut()
      .then(() => {
        location.href = '../';
      })
      .catch((err) => {
        console.error(err);
        window.alert(err instanceof Error ? err.message : 'Sign out failed.');
      });
  });
}
