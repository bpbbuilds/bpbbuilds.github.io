/**
 * Homepage promo band — parchment create section / OP card.
 *
 *   import { initHomePromoBand } from './home-promo-band.js';
 *   initHomePromoBand('#home-promo-band', { variant: 'create' });
 */

import { skelBar, skelBlock, skelRegion } from '../../shared/skeleton.js';
import { escapeAttr, rootPrefix } from './home-build-media.js';
import { playAssemble } from './home-promo-assemble.js';
import { mountPromoCatalog } from './home-promo-catalog.js';

/** Packed-item sizes for the catalog shimmer (s/m/l). */
const CATALOG_SKEL_SIZES = 's s m s l s s m s s l s m s s s m l s s s m s s l s m s s s m s l s s m';

/**
 * @param {'s' | 'm' | 'l'} kind
 */
function catalogSkelPx(kind) {
  if (kind === 'l') return { width: '2.15rem', height: '2.7rem' };
  if (kind === 'm') return { width: '1.65rem', height: '1.65rem' };
  return { width: '1.15rem', height: '1.15rem' };
}

function createPromoCatalogSkel() {
  const cells = CATALOG_SKEL_SIZES.split(' ')
    .map((kind, i) =>
      skelBlock({
        className: 'home-promo__skel-item',
        ...catalogSkelPx(/** @type {'s'|'m'|'l'} */ (kind)),
        radius: i % 9 === 0 ? '0.35rem' : '0.22rem',
      }),
    )
    .join('');
  return skelRegion(`<div class="home-promo__skel-catalog">${cells}</div>`, {
    className: 'home-promo__skel-catalog-wrap',
    label: 'Loading items',
  });
}

function createPromoCaptionSkel() {
  return `${skelBar({ className: 'home-promo__skel-title', width: '68%', height: '1.15em' })}
    <div class="home-promo__skel-meta">
      ${skelBar({ width: '36%', height: '0.8em' })}
      ${skelBar({ width: '30%', height: '0.8em' })}
    </div>`;
}

function createPromoInfoSkel() {
  return `<div class="home-promo__info-grid">
      <div class="home-promo__info-cell home-promo__info-shade">
        ${skelBar({ width: '2.4rem', height: '0.7em' })}
        ${skelBar({ width: '3.2rem', height: '1.1em' })}
      </div>
      <div class="home-promo__info-cell home-promo__info-shade">
        ${skelBar({ width: '2.4rem', height: '0.7em' })}
        ${skelBlock({ width: '2.6rem', height: '2.6rem', radius: '0.35rem' })}
      </div>
    </div>
    <div class="home-promo__info-how home-promo__info-shade">
      ${skelBar({ width: '100%', height: '0.75em' })}
      ${skelBar({ width: '88%', height: '0.75em' })}
      ${skelBar({ width: '72%', height: '0.75em' })}
    </div>`;
}

/**
 * @param {string | Element} [selector='#home-promo-band']
 * @param {{ variant?: 'create' | 'op' }} [opts]
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

  if (variant === 'create') {
    host.innerHTML = `
      <div class="home-promo home-promo--create home-promo--parchment">
        <div class="home-promo__band">
          <div class="home-promo__card" data-promo-create-card aria-busy="true">
            <div class="home-promo__side home-promo__side--catalog">
              <div
                class="home-promo__catalog"
                data-promo-catalog-root
                aria-hidden="true"
              >
                <div class="home-promo__catalog-stage" data-promo-catalog>
                  ${createPromoCatalogSkel()}
                </div>
              </div>
            </div>
            <div class="home-promo__stage">
              <div class="home-promo__caption" data-promo-caption>
                ${createPromoCaptionSkel()}
              </div>
              <div class="home-promo__board-wrap">
                <a class="home-promo__board-link" data-promo-board-link>
                  <div class="home-promo__board" data-promo-empty-board>
                    ${skelBlock({ className: 'home-promo__skel-board', radius: '0.4rem' })}
                  </div>
                </a>
              </div>
            </div>
            <div class="home-promo__side home-promo__side--right home-promo__side--cta">
              <div class="home-promo__info" data-promo-info>
                ${createPromoInfoSkel()}
              </div>
              <div class="home-promo__cta-block home-promo__cta-block--create">
                <p class="home-promo__cta-lead">Create your build now.</p>
                <a class="home-promo__cta" href="${escapeAttr(createHref)}">
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
              </div>
            </div>
          </div>
        </div>
      </div>`;
    const boardHost = host.querySelector('[data-promo-empty-board]');
    const catalogRoot = host.querySelector('[data-promo-catalog-root]');
    const captionEl = host.querySelector('[data-promo-caption]');
    const boardLink = host.querySelector('[data-promo-board-link]');
    const infoEl = host.querySelector('[data-promo-info]');
    if (!(boardHost instanceof HTMLElement)) return;
    const catalogReady = mountPromoCatalog(host, { root });
    void playAssemble({
      grid: null,
      boardHost,
      catalogRoot: catalogRoot instanceof HTMLElement ? catalogRoot : null,
      captionEl: captionEl instanceof HTMLElement ? captionEl : null,
      boardLink: boardLink instanceof HTMLAnchorElement ? boardLink : null,
      infoEl: infoEl instanceof HTMLElement ? infoEl : null,
      catalogReady,
      root,
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
