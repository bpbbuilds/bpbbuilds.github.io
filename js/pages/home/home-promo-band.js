/**
 * Homepage promo band — parchment create section / OP card.
 *
 *   import { initHomePromoBand } from './home-promo-band.js';
 *   initHomePromoBand('#home-promo-band', { variant: 'create' });
 */

import { escapeAttr, rootPrefix } from './home-build-media.js';
import { playAssemble } from './home-promo-assemble.js?v=home-no-skeleton-20261015b';
import { createPromoActivity } from './home-promo-activity.js?v=promo-player-20261013b';
import { mountPromoCatalog } from './home-promo-catalog.js';

// Keep enough lead for data/sprite warm-up without activating a hidden Home
// section a full 400px early. The P2 browser smoke measures this boundary.
export const PROMO_VIEWPORT_ROOT_MARGIN = '240px 0px';

/** 10-col packed stamp (no holes) — same geometry as the live Itemiary catalog. */
/**
 * @param {string | Element} [selector='#home-promo-band']
 * @param {{
 *   variant?: 'create' | 'op',
 *   builds?: object[],
 *   launcher?: 'catalog' | 'chest' | 'creator' | 'player',
 * }} [opts]
 */
export function initHomePromoBand(selector = '#home-promo-band', opts = {}) {
  const host =
    typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!host) return;

  const root = rootPrefix();
  const variant = opts.variant === 'create' ? 'create' : 'op';
  const artLeft = `${root}assets/theme/ui/ui-scholar-bag.png`;
  const artRight = `${root}assets/heroes/hero-party-loot.png`;
  const createHref = `${root}create/`;
  const opHref = `${root}builds/?tags=op`;
  const bagIcon = `${root}assets/icons/misc/Backpack_icon.png`;
  const remixIcon = `${root}assets/icons/history/RemixBuild.png`;
  const chestLauncher = variant === 'create' && opts.launcher === 'chest';
  const creatorLauncher = variant === 'create' && opts.launcher === 'creator';
  const playerLauncher = variant === 'create' && opts.launcher === 'player';

  if (variant === 'create') {
    host.innerHTML = `
      <div class="home-promo home-promo--create home-promo--parchment${chestLauncher ? ' home-promo--chest' : ''}${creatorLauncher ? ' home-promo--creator' : ''}${playerLauncher ? ' home-promo--player-info' : ''}">
        <div class="home-promo__band">
          <div class="home-promo__card" data-promo-create-card>
            <div class="home-promo__side ${chestLauncher ? 'home-promo__side--launcher' : creatorLauncher ? 'home-promo__side--creator' : playerLauncher ? 'home-promo__side--player' : 'home-promo__side--catalog'}">
              ${chestLauncher ? `
                <div class="home-promo__chest-launcher" data-promo-chest-launcher aria-label="Chestnut item launcher">
                  <img class="home-promo__chest-bottom" src="${escapeAttr(`${root}assets/theme/ui/sellbox/bottom-front.png`)}" alt="" draggable="false" />
                  <span class="home-promo__chest-eye" aria-hidden="true"><i></i></span>
                  <span class="home-promo__chest-mouth" aria-hidden="true"></span>
                  <img class="home-promo__chest-top" src="${escapeAttr(`${root}assets/theme/ui/sellbox/top-front.png`)}" alt="" draggable="false" />
                </div>
              ` : creatorLauncher ? `<aside class="home-promo__creator" data-promo-creator aria-label="Build creator"></aside>` : playerLauncher ? `<aside class="home-promo__creator home-promo__player" data-promo-player aria-label="Player information"></aside>` : `
                <div
                  class="home-promo__catalog"
                  data-promo-catalog-root
                  aria-hidden="true"
                >
                  <div class="home-promo__catalog-stage" data-promo-catalog>
                  </div>
                </div>
              `}
            </div>
            <div class="home-promo__stage">
              <div class="home-promo__caption" data-promo-caption>
              </div>
              <div class="home-promo__board-wrap">
                <a class="home-promo__board-link" data-promo-board-link>
                  <div class="home-promo__board" data-promo-empty-board>
                  </div>
                </a>
              </div>
              <div class="home-promo__board-tags" data-promo-board-tags hidden></div>
            </div>
            <div class="home-promo__side home-promo__side--right home-promo__side--cta">
              <div class="home-promo__info" data-promo-info>
              </div>
              <div class="home-promo__cta-block home-promo__cta-block--create">
                <p class="home-promo__cta-lead">Create your build now.</p>
                <div class="home-promo__cta-actions">
                  <a class="home-preset-button home-preset-button--crimson home-promo__cta" href="${escapeAttr(createHref)}">
                    <img
                      class="home-promo__cta-icon"
                      src="${escapeAttr(bagIcon)}"
                      alt=""
                      width="32"
                      height="32"
                      draggable="false"
                    />
                    <span>Create</span>
                  </a>
                  <a
                    class="home-preset-button home-preset-button--blue home-promo__cta home-promo__cta--remix"
                    data-promo-remix
                    href="#"
                    hidden
                    aria-label="Remix this build"
                  >
                    <img
                      class="home-promo__cta-icon"
                      src="${escapeAttr(remixIcon)}"
                      alt=""
                      width="32"
                      height="32"
                      draggable="false"
                    />
                    <span>Remix</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    const boardHost = host.querySelector('[data-promo-empty-board]');
    const catalogRoot = host.querySelector('[data-promo-catalog-root]');
    const chestEl = host.querySelector('[data-promo-chest-launcher]');
    const creatorEl = host.querySelector('[data-promo-creator]');
    const playerEl = host.querySelector('[data-promo-player]');
    const captionEl = host.querySelector('[data-promo-caption]');
    const boardLink = host.querySelector('[data-promo-board-link]');
    const boardTagsEl = host.querySelector('[data-promo-board-tags]');
    const infoEl = host.querySelector('[data-promo-info]');
    const remixLink = host.querySelector('[data-promo-remix]');
    if (!(boardHost instanceof HTMLElement)) return;
    const activity = createPromoActivity(true);
    if (playerLauncher) {
      activity.subscribe((active) => {
        host.classList.toggle('home-promo--activity-paused', !active);
      });
      const boardHoverTarget = boardLink instanceof HTMLElement ? boardLink : boardHost;
      boardHoverTarget.addEventListener('pointerenter', () => activity.setHovered(true));
      boardHoverTarget.addEventListener('pointerleave', () => activity.setHovered(false));
    }
    if (typeof IntersectionObserver !== 'undefined') {
      const activityObserver = new IntersectionObserver(
        (entries) => {
          const next = entries.some((entry) => entry.isIntersecting);
          activity.setViewportActive(next);
        },
        { rootMargin: PROMO_VIEWPORT_ROOT_MARGIN, threshold: 0.01 },
      );
      activityObserver.observe(host);
    }
    const promoMq = window.matchMedia('(max-width: 1100px)');
    const catalogReady = chestLauncher || creatorLauncher || playerLauncher || promoMq.matches
      ? Promise.resolve()
      : mountPromoCatalog(host, { root });
    if (!chestLauncher && !creatorLauncher && !playerLauncher && promoMq.matches) {
      const onWide = () => {
        if (promoMq.matches) return;
        promoMq.removeEventListener('change', onWide);
        void mountPromoCatalog(host, { root });
      };
      promoMq.addEventListener('change', onWide);
    }
    void playAssemble({
      grid: null,
      boardHost,
      catalogRoot: catalogRoot instanceof HTMLElement ? catalogRoot : null,
      captionEl: captionEl instanceof HTMLElement ? captionEl : null,
      boardLink: boardLink instanceof HTMLAnchorElement ? boardLink : null,
      boardTagsEl: boardTagsEl instanceof HTMLElement ? boardTagsEl : null,
      infoEl: infoEl instanceof HTMLElement ? infoEl : null,
      remixLink: remixLink instanceof HTMLAnchorElement ? remixLink : null,
      catalogReady,
      builds: Array.isArray(opts.builds) ? opts.builds : undefined,
      chestEl: chestEl instanceof HTMLElement ? chestEl : null,
      creatorEl: creatorEl instanceof HTMLElement ? creatorEl : null,
      creatorMode: creatorLauncher,
      playerEl: playerEl instanceof HTMLElement ? playerEl : null,
      playerInfoMode: playerLauncher,
      activity,
      root,
    }).catch((err) => {
      // Keep the rest of the landing page usable if an unexpected renderer
      // failure occurs. The assembler handles expected data errors; this
      // catches module or browser failures at the boundary.
      console.warn('[home-promo] assemble render failed', err);
      const card = host.querySelector('[data-promo-create-card]');
      if (card instanceof HTMLElement) card.dataset.promoError = 'true';
    });
    return;
  }

  host.innerHTML = `
    <div class="home-promo">
      <div class="home-promo__band">
        <div class="home-promo__card">
          <div class="home-promo__side home-promo__side--left">
            <img
              class="home-promo__art"
              src="${escapeAttr(artLeft)}"
              alt=""
              width="360"
              height="360"
              draggable="false"
            />
          </div>
          <div class="home-promo__copy">
            <p class="home-promo__badge">Now live</p>
            <h2 class="home-promo__title">OP builds worth stealing</h2>
            <p class="home-promo__lede">
              Watch the route, open the board, and remix the broken bags that break the ladder.
            </p>
            <a class="home-promo__footer" href="${escapeAttr(opHref)}">Browse OP builds</a>
          </div>
          <div class="home-promo__side home-promo__side--right">
            <img
              class="home-promo__art"
              src="${escapeAttr(artRight)}"
              alt=""
              width="360"
              height="360"
              draggable="false"
            />
          </div>
        </div>
      </div>
    </div>`;
}
