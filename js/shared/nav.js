/**
 * Site header — shelves flanking BPB logo + Builds banner.
 * Fixed (Vault Hunters–style) with an in-flow #site-nav-space stand-in.
 *
 *   import { initNav } from '../../shared/nav.js';
 *   initNav();
 */

import {
  getProfile,
  getSession,
  initAuth,
  onAuthChange,
  signInWithDiscord,
  signOut,
} from './auth.js';
import { getFoundingStatus } from './entitlements.js';
import { openFoundingOffer } from './premium-offer.js';
import { skelBar, skelBlock, skelRegion } from './skeleton.js';
import { DISCORD_INVITE_URL, SMOJO_YOUTUBE_URL } from './social-links.js';
import { profileHref } from './profile-href.js';

function rootPrefix() {
  const raw = document.body?.dataset?.root ?? './';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/** Parchment placeholder matching nav layout (safe before assets load). */
export function navSkeletonHtml() {
  const shelf = skelBar({ className: 'site-nav__skel-shelf-bar', height: '0.85rem', radius: '0.2rem' });
  const banner = skelBar({ className: 'site-nav__skel-banner', height: '2.1rem', radius: '0.25rem' });
  const social = skelBlock({ className: 'site-nav__skel-social', radius: '0.35rem' });

  return skelRegion(
    `<div class="site-nav-shell">
      <header class="site-nav site-nav--skel">
        <div class="site-nav__rail site-nav__rail--left">
          <div class="site-nav__skel-banners">
            ${banner}${banner}
          </div>
          <div class="site-nav__skel-shelf">${shelf}</div>
        </div>
        <div class="site-nav__brand site-nav__brand--skel">
          ${skelBlock({ className: 'site-nav__skel-logo', radius: '0.4rem' })}
          ${skelBar({ className: 'site-nav__skel-builds', height: '1.35rem', radius: '0.25rem' })}
        </div>
        <div class="site-nav__rail site-nav__rail--right">
          <div class="site-nav__skel-banners site-nav__skel-banners--right">
            ${banner}
            <div class="site-nav__skel-socials">${social}${social}</div>
          </div>
          <div class="site-nav__skel-shelf">${shelf}</div>
        </div>
      </header>
    </div>`,
    { className: 'site-nav-skel-wrap', label: 'Loading navigation' },
  );
}

/**
 * @param {ParentNode} root
 * @returns {Promise<void>}
 */
function waitForImages(root) {
  const imgs = [...root.querySelectorAll('img')];
  if (!imgs.length) return Promise.resolve();
  return Promise.all(
    imgs.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
            }),
    ),
  ).then(() => undefined);
}

/**
 * @param {string} root
 */
function navHtml(root) {
  const shelf = `${root}assets/theme/ui/ui-wood-shelf.png`;
  const banner = `${root}assets/theme/ui/ui-label-banner-gold.png`;
  const iconYt = `${root}assets/theme/ui/ui-icon-youtube.png`;
  const iconDiscord = `${root}assets/theme/ui/ui-icon-discord.png`;

  return `
    <div class="site-nav-shell">
      <header class="site-nav">
        <div class="site-nav__rail site-nav__rail--left">
          <div class="site-nav__banners">
            <a class="site-nav__link" href="${root}items/">
              <img
                class="site-nav__banner"
                src="${banner}"
                alt=""
                width="953"
                height="251"
                aria-hidden="true"
              />
              <span class="site-nav__link-text">ITEMS</span>
            </a>
            <a class="site-nav__link" href="${root}builds/">
              <img
                class="site-nav__banner"
                src="${banner}"
                alt=""
                width="953"
                height="251"
                aria-hidden="true"
              />
              <span class="site-nav__link-text">BUILDS</span>
            </a>
          </div>
          <img
            class="site-nav__shelf"
            src="${shelf}"
            alt=""
            width="957"
            height="80"
            aria-hidden="true"
          />
        </div>
        <a class="site-nav__brand" href="${root}">
          <span class="site-nav__logo-swap">
            <img
              class="site-nav__logo site-nav__logo--full"
              src="${root}assets/brand/logo-backpack-battles.png"
              alt="Backpack Battles"
              width="992"
              height="403"
            />
            <img
              class="site-nav__logo site-nav__logo--compact"
              src="${root}assets/brand/logo-bpb.png"
              alt=""
              width="1458"
              height="782"
              aria-hidden="true"
            />
          </span>
          <img
            class="site-nav__builds"
            src="${root}assets/brand/banner-builds.png"
            alt="Builds"
            width="911"
            height="212"
          />
        </a>
        <div class="site-nav__rail site-nav__rail--right">
          <div class="site-nav__banners site-nav__banners--right">
            <a class="site-nav__link" href="${root}create/">
              <img
                class="site-nav__banner site-nav__banner--mirror"
                src="${banner}"
                alt=""
                width="953"
                height="251"
                aria-hidden="true"
              />
              <span class="site-nav__link-text site-nav__link-text--right">CREATE</span>
            </a>
            <div class="site-nav__socials">
              <a
                class="site-nav__social site-nav__social--youtube"
                href="${SMOJO_YOUTUBE_URL}"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
              >
                <img
                  src="${iconYt}"
                  alt=""
                  width="921"
                  height="762"
                  aria-hidden="true"
                />
              </a>
              <a
                class="site-nav__social site-nav__social--discord"
                href="${DISCORD_INVITE_URL}"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Discord community"
                title="Discord community"
              >
                <img
                  src="${iconDiscord}"
                  alt=""
                  width="918"
                  height="762"
                  aria-hidden="true"
                />
              </a>
            </div>
          </div>
          <img
            class="site-nav__shelf site-nav__shelf--mirror"
            src="${shelf}"
            alt=""
            width="957"
            height="80"
            aria-hidden="true"
          />
          <div class="site-nav__founding-wrap" data-nav-founding-host></div>
          <div class="site-nav__auth" data-nav-auth></div>
        </div>
      </header>
    </div>
  `;
}

/**
 * @param {HTMLElement} host
 */
async function paintNavFounding(host) {
  const status = await getFoundingStatus();
  host.innerHTML = `
    <button
      type="button"
      class="site-nav__founding"
      data-nav-founding
      title="First ${status.total} founding members get Premium forever"
      aria-label="Founding members: ${status.used} of ${status.total} slots claimed"
    >
      <span class="site-nav__founding-icon" aria-hidden="true">♛</span>
      <span class="site-nav__founding-count">${status.used}/${status.total}</span>
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
async function paintNavAuth(host, root) {
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
  const name = String(profile?.display_name || 'Account').trim() || 'Account';
  const avatar = String(profile?.avatar_url || '').trim();
  const discordId = String(profile?.discord_id || '').trim();
  const accountHref = profileHref(discordId, root) || root;
  const avatarHtml = avatar
    ? `<img class="site-nav__login-avatar" src="${escapeAttr(avatar)}" alt="" width="40" height="40" />`
    : `<span class="site-nav__login-avatar site-nav__login-avatar--empty" aria-hidden="true"></span>`;

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
        <button type="button" class="site-nav__login-out" data-nav-signout>Sign out</button>
      </div>
    </div>
  `;

  host.querySelector('[data-nav-signout]')?.addEventListener('click', () => {
    signOut().catch((err) => {
      console.error(err);
      window.alert(err instanceof Error ? err.message : 'Sign-out failed.');
    });
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

/**
 * @param {string | Element} [selector='#site-nav']
 */
export async function initNav(selector = '#site-nav') {
  const host = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!host) return;

  const root = rootPrefix();
  initAuth();

  // Reserve layout space immediately (nav is fixed / out of flow)
  ensureNavSpace(host);
  syncNavSpace(host);

  if (!host.querySelector('.site-nav--skel')) {
    host.innerHTML = navSkeletonHtml();
  }

  const hold = document.createElement('div');
  hold.hidden = true;
  hold.innerHTML = navHtml(root);
  const shell = hold.firstElementChild;
  if (!shell) return;

  host.appendChild(hold);
  await waitForImages(hold);

  host.replaceChildren(shell);

  syncNavSpace(host);

  const authHost = host.querySelector('[data-nav-auth]');
  const foundingHost = host.querySelector('[data-nav-founding-host]');
  if (authHost instanceof HTMLElement) {
    const refreshAuth = () => paintNavAuth(authHost, root);
    await refreshAuth();
    onAuthChange(() => {
      refreshAuth();
      if (foundingHost instanceof HTMLElement) {
        paintNavFounding(foundingHost).catch((err) => console.error(err));
      }
    });
    syncNavSpace(host);
  }
  if (foundingHost instanceof HTMLElement) {
    await paintNavFounding(foundingHost);
  }

  bindNavScrollLogo(host);
  window.addEventListener(
    'resize',
    () => {
      syncNavSpace(host);
    },
    { passive: true },
  );
}

/**
 * In-flow spacer after the fixed nav so content isn’t covered (VH pattern).
 * @param {Element} host
 */
function ensureNavSpace(host) {
  if (!(host instanceof HTMLElement)) return;
  let space = document.getElementById('site-nav-space');
  if (!(space instanceof HTMLElement)) {
    space = document.createElement('div');
    space.id = 'site-nav-space';
    space.setAttribute('aria-hidden', 'true');
    host.insertAdjacentElement('afterend', space);
  }
}

/**
 * Lock spacer to the *expanded* nav height so compact logo doesn’t change page height.
 * Skips while scrolled so we don’t flash the full logo to measure.
 * @param {Element} host
 */
function syncNavSpace(host) {
  if (!(host instanceof HTMLElement)) return;
  if (host.classList.contains('is-scrolled')) return;

  const space = document.getElementById('site-nav-space');
  if (!(space instanceof HTMLElement)) return;

  const h = Math.ceil(host.getBoundingClientRect().height);
  if (h > 0) {
    document.documentElement.style.setProperty('--bpb-nav-space', `${h}px`);
    space.style.height = `${h}px`;
  }
}

/**
 * Swap to compact BPB mark when scrolled (VH: scrollY > 0).
 * Safe with fixed nav — shrinking no longer changes document height.
 * @param {Element} host
 */
function bindNavScrollLogo(host) {
  const full = host.querySelector('.site-nav__logo--full');
  const compact = host.querySelector('.site-nav__logo--compact');
  if (!(full instanceof HTMLImageElement) || !(compact instanceof HTMLImageElement)) return;

  const pageScrollY = () => {
    const winY = window.scrollY || document.documentElement.scrollTop || 0;
    const main = document.getElementById('main');
    const mainY = main instanceof HTMLElement ? main.scrollTop : 0;
    return Math.max(winY, mainY);
  };

  const apply = (scrolled) => {
    host.classList.toggle('is-scrolled', scrolled);
    full.alt = scrolled ? '' : 'Backpack Battles';
    full.setAttribute('aria-hidden', scrolled ? 'true' : 'false');
    compact.alt = scrolled ? 'Backpack Battles' : '';
    compact.setAttribute('aria-hidden', scrolled ? 'false' : 'true');
  };

  const sync = () => {
    apply(pageScrollY() > 0);
  };

  sync();
  window.addEventListener('scroll', sync, { passive: true });
  const main = document.getElementById('main');
  if (main instanceof HTMLElement) {
    main.addEventListener('scroll', sync, { passive: true });
  }
}
