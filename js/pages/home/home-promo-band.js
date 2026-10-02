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

/** 10-col packed stamp (no holes) — same geometry as the live Itemiary catalog. */
const CATALOG_SKEL_STAMP = [
  [0, 0, 2, 2],
  [2, 0, 1, 1],
  [3, 0, 1, 1],
  [4, 0, 2, 1],
  [6, 0, 1, 2],
  [7, 0, 3, 2],
  [2, 1, 2, 1],
  [4, 1, 2, 1],
  [0, 2, 1, 2],
  [1, 2, 2, 1],
  [3, 2, 1, 1],
  [4, 2, 2, 2],
  [6, 2, 2, 1],
  [8, 2, 2, 1],
  [1, 3, 1, 1],
  [2, 3, 2, 1],
  [6, 3, 4, 1],
];
const CATALOG_SKEL_STAMP_ROWS = 4;
const CATALOG_SKEL_REPEATS = 6;

function createPromoCatalogSkel() {
  const tiles = [];
  for (let r = 0; r < CATALOG_SKEL_REPEATS; r += 1) {
    const dy = r * CATALOG_SKEL_STAMP_ROWS;
    for (const [x, y, w, h] of CATALOG_SKEL_STAMP) {
      const radius = w * h >= 4 ? '0.28em' : '0.18em';
      tiles.push(
        `<span class="bpb-skel bpb-skel--block home-promo__skel-item" style="--x:${x};--y:${y + dy};--w:${w};--h:${h};border-radius:${radius}" aria-hidden="true"></span>`,
      );
    }
  }
  return skelRegion(`<div class="home-promo__skel-catalog">${tiles.join('')}</div>`, {
    className: 'home-promo__skel-catalog-wrap',
    label: 'Loading items',
  });
}

function createPromoCaptionSkel() {
  return `<header class="home-promo__caption-head home-promo__caption-head--icon">
      ${skelBlock({ className: 'home-promo__skel-class', width: '2.1rem', height: '2.1rem', radius: '0.25rem' })}
      ${skelBar({ className: 'home-promo__skel-title', width: '11.5rem', height: '1.25rem' })}
    </header>
    <div class="home-promo__caption-meta">
      <div class="home-promo__caption-side home-promo__caption-side--left">
        ${skelBlock({ className: 'home-promo__skel-avatar', width: '4.65rem', height: '4.65rem', radius: '0.35rem' })}
      </div>
      ${skelBar({ width: '8.5rem', height: '1.15rem' })}
      <div class="home-promo__caption-side home-promo__caption-side--right" aria-hidden="true"></div>
    </div>`;
}

function createPromoBoardSkel() {
  return skelRegion(`<div class="home-promo__skel-board" aria-hidden="true"></div>`, {
    className: 'home-promo__skel-board-wrap',
    label: 'Loading board',
  });
}

function createPromoInfoSkel() {
  return `<div class="home-promo__info-grid">
      <div class="home-promo__info-cell home-promo__info-shade">
        <span class="home-promo__info-label">Gold</span>
        <span class="home-promo__info-gold">
          ${skelBar({ width: '2.35rem', height: '1.2rem' })}
          ${skelBlock({ className: 'home-promo__skel-gold-icon', width: '1.45rem', height: '1.45rem', radius: '0.28rem' })}
        </span>
      </div>
      <div class="home-promo__info-cell home-promo__info-shade">
        <span class="home-promo__info-label">Rank</span>
        ${skelBlock({ className: 'home-promo__skel-rank', width: '2.85rem', height: '2.85rem', radius: '0.35rem' })}
      </div>
    </div>
    <div class="home-promo__info-how home-promo__info-shade">
      ${skelBar({ width: '100%', height: '0.78em' })}
      ${skelBar({ width: '94%', height: '0.78em' })}
      ${skelBar({ width: '78%', height: '0.78em' })}
      ${skelBar({ width: '62%', height: '0.78em' })}
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
                    ${createPromoBoardSkel()}
                  </div>
                </a>
              </div>
              <div class="home-promo__board-tags" data-promo-board-tags hidden></div>
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
    const boardTagsEl = host.querySelector('[data-promo-board-tags]');
    const infoEl = host.querySelector('[data-promo-info]');
    if (!(boardHost instanceof HTMLElement)) return;
    const promoMq = window.matchMedia('(max-width: 1100px)');
    const catalogReady = promoMq.matches
      ? Promise.resolve()
      : mountPromoCatalog(host, { root });
    if (promoMq.matches) {
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
