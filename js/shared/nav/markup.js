/**
 * Site nav markup (skeleton + shelves / banners / logos).
 */

import { skelBar, skelBlock, skelRegion } from '../skeleton.js';
import { DISCORD_INVITE_URL, SMOJO_YOUTUBE_URL } from '../social-links.js';

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
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
          <div class="site-nav__pennants">
            ${skelBlock({ className: 'site-nav__skel-events', radius: '0.2rem' })}
            ${skelBlock({ className: 'site-nav__skel-market', radius: '0.2rem' })}
            ${skelBlock({ className: 'site-nav__skel-challenges', radius: '0.2rem' })}
          </div>
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
 * @param {string} root
 */
export function navHtml(root) {
  const shelf = `${root}assets/theme/ui/ui-wood-shelf.png`;
  const banner = `${root}assets/theme/ui/ui-label-banner-gold.png`;
  const rankedBanner = `${root}assets/theme/ui/ui-ranked-banner.png`;
  const unrankedBanner = `${root}assets/theme/ui/ui-unranked-banner.png`;
  const continueBanner = `${root}assets/theme/ui/ui-continue-banner.png`;
  const iconYt = `${root}assets/theme/ui/ui-icon-youtube.png`;
  const iconDiscord = `${root}assets/theme/ui/ui-icon-discord.png`;

  return `
    <div class="site-nav-shell">
      <div class="site-nav__admin-wrap site-nav__admin-wrap--corner" data-nav-admin-host hidden></div>
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
          <div class="site-nav__pennants">
            <a
              class="site-nav__events"
              href="${root}events/"
              aria-label="Events"
              title="Events"
            >
              <img
                class="site-nav__events-banner"
                src="${rankedBanner}"
                alt=""
                width="273"
                height="399"
                aria-hidden="true"
              />
              <span class="site-nav__events-text">Events</span>
            </a>
            <a
              class="site-nav__market"
              href="${root}market/"
              aria-label="Market"
              title="Market"
            >
              <img
                class="site-nav__market-banner"
                src="${unrankedBanner}"
                alt=""
                width="280"
                height="412"
                aria-hidden="true"
              />
              <span class="site-nav__market-text">Market</span>
            </a>
            <a
              class="site-nav__challenges"
              href="${root}quest/"
              aria-label="Quest"
              title="Quest"
            >
              <img
                class="site-nav__challenges-banner"
                src="${continueBanner}"
                alt=""
                width="270"
                height="416"
                aria-hidden="true"
              />
              <span class="site-nav__challenges-text">Quest</span>
            </a>
          </div>
        </div>
        <button
          type="button"
          class="site-nav__menu"
          data-nav-menu
          aria-expanded="false"
          aria-controls="site-nav-drawer"
          aria-label="Open menu"
        >
          <span class="site-nav__menu-icon" aria-hidden="true"></span>
        </button>
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
              decoding="async"
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
        <span class="site-nav__menu-balance" aria-hidden="true"></span>
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
          <div class="site-nav__auth" data-nav-auth></div>
          <div class="site-nav__announce-slot" data-nav-founding-host></div>
        </div>
      </header>
      <div class="site-nav-backdrop" data-nav-backdrop hidden></div>
      ${drawerHtml(root)}
    </div>
  `;
}

/**
 * Mobile-only link list. Desktop shelves stay in the header.
 * @param {string} root
 */
function drawerHtml(root) {
  const iconYt = `${root}assets/theme/ui/ui-icon-youtube.png`;
  const iconDiscord = `${root}assets/theme/ui/ui-icon-discord.png`;
  const link = (path, label) => `
    <a class="site-nav-drawer__link" href="${root}${path}" data-nav-path="${path.replace(/\/$/, '')}">${label}</a>`;

  return `
    <nav class="site-nav-drawer" id="site-nav-drawer" data-nav-drawer hidden aria-label="Site">
      <div class="site-nav-drawer__head">
        <p class="site-nav-drawer__title">Menu</p>
        <button type="button" class="site-nav-drawer__close" data-nav-drawer-close aria-label="Close menu">
          <span class="site-nav-drawer__close-icon" aria-hidden="true"></span>
        </button>
      </div>
      <div class="site-nav-drawer__scroll">
        ${link('items/', 'Items')}
        ${link('builds/', 'Builds')}
        ${link('create/', 'Create')}
        ${link('events/', 'Events')}
        ${link('market/', 'Market')}
        ${link('quest/', 'Quest')}
      </div>
      <div class="site-nav-drawer__utility">
        <div data-nav-founding-host></div>
        <div data-nav-admin-host hidden></div>
        <div class="site-nav-drawer__socials">
          <a
            class="site-nav__social site-nav__social--youtube"
            href="${SMOJO_YOUTUBE_URL}"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="YouTube"
          >
            <img src="${iconYt}" alt="" width="921" height="762" aria-hidden="true" />
          </a>
          <a
            class="site-nav__social site-nav__social--discord"
            href="${DISCORD_INVITE_URL}"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Discord community"
          >
            <img src="${iconDiscord}" alt="" width="918" height="762" aria-hidden="true" />
          </a>
        </div>
      </div>
      <div class="site-nav-drawer__foot">
        <div class="site-nav-drawer__profile">
          <div data-nav-auth></div>
        </div>
      </div>
    </nav>
  `;
}
