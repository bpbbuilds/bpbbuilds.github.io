/**
 * Site footer — fan disclaimer + legal / catalog links.
 *
 *   import { initFooter } from '../../shared/footer.js';
 *   initFooter();                    // full footer
 *   initFooter({ variant: 'slim' }); // one-line dense layout
 */

import { DISCORD_INVITE_URL, SMOJO_YOUTUBE_URL } from './social-links.js';

function rootPrefix() {
  const raw = document.body?.dataset?.root ?? './';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/**
 * @param {string} root
 */
function footerLinks(root) {
  return {
    about: `${root}legal/about/`,
    terms: `${root}legal/terms/`,
    privacy: `${root}legal/privacy/`,
    builds: `${root}builds/`,
    items: `${root}items/`,
    iconYt: `${root}assets/theme/ui/ui-icon-youtube.png`,
    iconDiscord: `${root}assets/theme/ui/ui-icon-discord.png`,
  };
}

/**
 * @param {string} root
 */
function socialsHtml(root) {
  const { iconYt, iconDiscord } = footerLinks(root);
  return `
    <div class="site-footer__socials">
      <a
        class="site-footer__social"
        href="${SMOJO_YOUTUBE_URL}"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="YouTube"
      >
        <img src="${iconYt}" alt="" width="40" height="33" draggable="false" />
      </a>
      <a
        class="site-footer__social"
        href="${DISCORD_INVITE_URL}"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Discord"
      >
        <img src="${iconDiscord}" alt="" width="40" height="33" draggable="false" />
      </a>
    </div>
  `;
}

/**
 * @param {string} root
 */
function navHtml(root) {
  const { about, terms, privacy, builds, items } = footerLinks(root);
  return `
    <nav class="site-footer__nav" aria-label="Footer">
      <a href="${about}">About</a>
      <a href="${terms}">Terms</a>
      <a href="${privacy}">Privacy</a>
      <a href="${builds}">Builds</a>
      <a href="${items}">Items</a>
    </nav>
  `;
}

/**
 * Full footer with disclaimer (default pages).
 * @param {string} root
 */
function footerHtml(root) {
  const { about } = footerLinks(root);
  return `
    <footer class="site-footer">
      <div class="site-footer__inner">
        <p class="site-footer__brand">Backpack Battles Builds</p>
        <p class="site-footer__disclaimer">
          Fan-made, unofficial site. Not affiliated with, endorsed by, or sponsored by
          Backpack Battles or its developers and publishers. Game assets appear for
          reference and community guides only. The combat sandbox is unofficial and is not
          advertised as matching the live game.
          <a class="site-footer__disclaimer-link" href="${about}">About</a>
        </p>
        ${navHtml(root)}
        ${socialsHtml(root)}
      </div>
    </footer>
  `;
}

/**
 * One-line footer for dense pages (sim, etc.): brand | links | socials.
 * @param {string} root
 */
function footerSlimHtml(root) {
  return `
    <footer class="site-footer site-footer--slim">
      <div class="site-footer__inner site-footer__inner--slim">
        <p class="site-footer__brand">Backpack Battles Builds</p>
        ${navHtml(root)}
        ${socialsHtml(root)}
      </div>
    </footer>
  `;
}

/**
 * @param {string | Element | {
 *   selector?: string | Element,
 *   variant?: 'default' | 'slim',
 * }} [opts]
 */
export function initFooter(opts = '#site-footer') {
  /** @type {string | Element} */
  let selector = '#site-footer';
  /** @type {'default' | 'slim'} */
  let variant = 'default';

  if (typeof opts === 'string' || (typeof Element !== 'undefined' && opts instanceof Element)) {
    selector = /** @type {string | Element} */ (opts);
  } else if (opts && typeof opts === 'object') {
    if (opts.selector != null) selector = opts.selector;
    if (opts.variant === 'slim') variant = 'slim';
  }

  const host =
    typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!host) return;

  const root = rootPrefix();
  host.innerHTML = variant === 'slim' ? footerSlimHtml(root) : footerHtml(root);
}
