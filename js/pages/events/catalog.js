/**
 * Events catalog — featured + filtered cards + detail (?e=slug).
 */

import {
  filterCatalogEvents,
  getCatalogEvent,
  getFeaturedEvent,
  listCatalogEvents,
} from './catalog-data.js';
import { eventCardsHtml, featuredEventHtml } from './event-card.js';
import { eventDetailHtml, bindEventDetailHub } from './event-detail.js';
import { fetchEventWinner } from './event-winner.js';
import {
  bindEventFilters,
  defaultEventFilterState,
  eventFiltersHtml,
  syncEventFiltersUi,
} from './event-filters.js';
import { bindEventTimers } from './event-meta.js';
import { loadBlobCatalog } from '../u/blob/catalog.js';
import { syncEventBuildVisibility } from './event-gallery-sync.js';
import { bindCosmeticTooltips } from '../u/blob/cosmetic-tooltip.js';
import { fitBlobItemIcons } from '../u/blob/fit-item-icon.js';
import { eventsCatalogSkeletonHtml, eventsDetailSkeletonHtml } from './events-skeleton.js';
import { bindEventsFilterDrawer } from './events-filter-drawer.js';

/** @typedef {import('./event-filters.js').EventFilterState} EventFilterState */

/**
 * @param {import('./catalog-data.js').CatalogEvent | null | undefined} event
 * @param {string} root
 */
function eventArtUrl(event, root) {
  const path = String(event?.image || '').replace(/^\//, '');
  if (!path) return '';
  const base = root.endsWith('/') ? root : `${root}/`;
  return `${base}${path}`;
}

/**
 * Keep the layout skeleton until the banner is ready to draw.
 * @param {string} url
 */
function whenEventArtReady(url) {
  if (!url) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timer = setTimeout(done, 1500);
    img.onload = img.onerror = () => {
      clearTimeout(timer);
      done();
    };
    img.src = url;
  });
}

export async function initEventsCatalog(main, opts) {
  void syncEventBuildVisibility();
  const root = opts.root.endsWith('/') ? opts.root : `${opts.root}/`;
  let state = defaultEventFilterState();
  let detailSlug = readDetailSlugFromUrl();
  /** @type {(() => void) | null} */
  let unbindFilters = null;
  /** @type {(() => void) | null} */
  let unbindDrawer = null;
  /** @type {(() => void) | null} */
  let unbindTimers = null;
  /** @type {(() => void) | null} */
  let unbindDetailHub = null;
  /** @type {{ destroy?: () => void } | null} */
  let cosmeticTips = null;
  /** @type {import('../u/blob/catalog.js').BlobCosmetic[] | null} */
  let blobCatalog = null;
  /** @type {{ slug: string | null, status: 'idle' | 'loading' | 'ready', hasWinner: boolean }} */
  let detailWinner = { slug: null, status: 'idle', hasWinner: false };

  main.addEventListener('click', onMainClick);
  void loadBlobCatalog(root).then((items) => {
    blobCatalog = items;
    bindPrizeTips();
  });

  function bindPrizeTips() {
    cosmeticTips?.destroy?.();
    cosmeticTips = null;
    fitBlobItemIcons(main);
    if (!blobCatalog?.length || !window.ItemTooltip?.render) return;
    cosmeticTips = bindCosmeticTooltips(main, { catalog: blobCatalog });
  }

  function paint() {
    unbindFilters?.();
    unbindFilters = null;
    unbindDrawer?.();
    unbindDrawer = null;
    unbindTimers?.();
    unbindTimers = null;
    unbindDetailHub?.();
    unbindDetailHub = null;
    cosmeticTips?.destroy?.();
    cosmeticTips = null;

    const featured = getFeaturedEvent();
    const listSource = listCatalogEvents().filter((e) => !e.featured);
    const filtered = filterCatalogEvents(listSource, state);
    const shownCount = filtered.length + (featured ? 1 : 0);
    const detailBase = detailSlug ? getCatalogEvent(detailSlug) : null;
    ensureDetailWinner(detailBase);
    const detail = detailBase && detailWinner.slug === detailBase.slug && detailWinner.status === 'ready'
      ? {
          ...detailBase,
          features: { ...(detailBase.features || {}), hasWinner: detailWinner.hasWinner },
        }
      : detailBase;

    if (detail) {
      main.innerHTML = `
        <div class="events-layout events-layout--detail">
          ${eventDetailHtml(detail, { root })}
        </div>`;
      unbindTimers = bindEventTimers(main);
      unbindDetailHub = bindEventDetailHub(main, detail, {
        root,
        onStage() {
          fitBlobItemIcons(main);
        },
      });
      bindPrizeTips();
      return;
    }

    main.innerHTML = `
      <div class="events-layout">
        <div class="events-filters__open-row">
          <button type="button" class="events-filters__toggle" data-events-filters-open aria-expanded="false" aria-controls="events-filters">Filters</button>
        </div>
        <div class="events-feed-col">
          ${
            featured
              ? `<div class="events-featured-host" data-events-featured>${featuredEventHtml(featured, { root })}</div>`
              : ''
          }
          ${
            listSource.length
              ? `<div class="events-list" data-events-list>${eventCardsHtml(filtered, { root, view: state.view })}</div>`
              : ''
          }
        </div>
        <button type="button" class="events-filters__backdrop" data-events-filters-backdrop hidden aria-label="Close filters"></button>
        ${eventFiltersHtml(root, state, shownCount)}
      </div>`;

    const rail = main.querySelector('.events-filters');
    if (rail instanceof HTMLElement) {
      unbindDrawer = bindEventsFilterDrawer(main.querySelector('.events-layout'));
      unbindFilters = bindEventFilters(rail, {
        getState: () => state,
        defaultState: defaultEventFilterState,
        onChange(next) {
          state = next;
          paintList();
        },
      });
    }
    unbindTimers = bindEventTimers(main);
    bindPrizeTips();
  }

  /**
   * Resolve the winner before adding the Winner tab. A selected winner may be
   * acknowledged during judging, while its build details remain private until
   * the endpoint releases the public entry.
   * @param {import('./catalog-data.js').CatalogEvent | null} event
   */
  function ensureDetailWinner(event) {
    if (!event || event.features?.hasVoting) return;
    if (detailWinner.slug === event.slug && detailWinner.status !== 'idle') return;
    detailWinner = { slug: event.slug, status: 'loading', hasWinner: false };
    void fetchEventWinner(event.slug)
      .then((result) => {
        if (detailSlug !== event.slug) return;
        detailWinner = {
          slug: event.slug,
          status: 'ready',
          hasWinner: Boolean(result.ok && result.winner),
        };
        paint();
      })
      .catch(() => {
        if (detailSlug !== event.slug) return;
        detailWinner = { slug: event.slug, status: 'ready', hasWinner: false };
        paint();
      });
  }

  function paintList() {
    const listHost = main.querySelector('[data-events-list]');
    const rail = main.querySelector('.events-filters');
    const listSource = listCatalogEvents().filter((e) => !e.featured);
    const filtered = filterCatalogEvents(listSource, state);
    const shownCount = filtered.length + (getFeaturedEvent() ? 1 : 0);
    if (listHost instanceof HTMLElement) {
      listHost.innerHTML = eventCardsHtml(filtered, { root, view: state.view });
    }
    if (rail instanceof HTMLElement) {
      syncEventFiltersUi(rail, state, shownCount);
    }
    unbindTimers?.();
    unbindTimers = bindEventTimers(main);
    bindPrizeTips();
  }

  /** @param {MouseEvent} e */
  function onMainClick(e) {
    const t = e.target;
    if (!(t instanceof Element)) return;

    const close = t.closest('[data-event-close]');
    if (close && main.contains(close)) {
      e.preventDefault();
      closeDetail();
      return;
    }

    const open = t.closest('[data-event-open]');
    if (open instanceof HTMLElement && main.contains(open)) {
      const slug = open.getAttribute('data-event-open') || '';
      if (!slug || !getCatalogEvent(slug)) return;
      e.preventDefault();
      openDetail(slug);
    }
  }

  /** @param {string} slug */
  function openDetail(slug) {
    detailSlug = slug;
    writeDetailSlugToUrl(slug);
    paint();
  }

  function closeDetail() {
    detailSlug = null;
    writeDetailSlugToUrl(null);
    paint();
  }

  window.addEventListener('popstate', () => {
    const next = readDetailSlugFromUrl();
    if (next === detailSlug) return;
    detailSlug = next;
    paint();
  });

  const opening = detailSlug ? getCatalogEvent(detailSlug) : getFeaturedEvent();
  main.innerHTML = detailSlug ? eventsDetailSkeletonHtml() : eventsCatalogSkeletonHtml();
  await whenEventArtReady(eventArtUrl(opening, root));
  paint();
}

/** @returns {string | null} */
function readDetailSlugFromUrl() {
  try {
    const raw = new URLSearchParams(window.location.search).get('e');
    return raw && getCatalogEvent(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** @param {string | null} slug */
function writeDetailSlugToUrl(slug) {
  try {
    const url = new URL(window.location.href);
    if (slug) {
      url.searchParams.set('e', slug);
      url.searchParams.delete('tab');
    } else {
      url.searchParams.delete('e');
      url.searchParams.delete('tab');
    }
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.pushState({}, '', next);
  } catch {
    /* ignore */
  }
}
