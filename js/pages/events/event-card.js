/**
 * Featured strip + card markup for the events catalog.
 */

/** @typedef {import('./catalog-data.js').CatalogEvent} CatalogEvent */
/** @typedef {import('./catalog-data.js').EventStatus} EventStatus */

import { EVENT_STATUS_LABELS } from './catalog-data.js';
import { eventMetaStripHtml, eventTimerHtml } from './event-meta.js';

/**
 * @param {EventStatus} status
 */
export function eventStatusLabel(status) {
  return EVENT_STATUS_LABELS[status] || status;
}

/**
 * Status bar under the event title (featured / detail).
 * @param {CatalogEvent} event
 * @param {string} [className]
 */
export function eventStatusBarHtml(event, className = 'events-status-bar') {
  const status = event.status;
  const label = eventStatusLabel(status);
  return `
    <div
      class="${className} ${className}--${escapeAttr(status)}"
      role="status"
      aria-label="Event status: ${escapeAttr(label)}"
    >
      <span class="${className}__dot" aria-hidden="true"></span>
      <span class="${className}__label">${escapeHtml(label)}</span>
    </div>`;
}

/**
 * @param {CatalogEvent} event
 * @param {string} root
 */
function eventImageUrl(event, root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const path = String(event.image || '').replace(/^\//, '');
  if (/^(data:|https?:)/i.test(path)) return path;
  return `${base}${path}`;
}

/**
 * @param {CatalogEvent} event
 * @param {string} root
 * @param {string} className
 */
function mediaHtml(event, root, className) {
  const src = eventImageUrl(event, root);
  return `
    <span class="${className}">
      <img
        class="${className}-img"
        src="${escapeAttr(src)}"
        alt=""
        width="1280"
        height="720"
        loading="lazy"
        decoding="async"
        draggable="false"
      />
    </span>`;
}

/**
 * @param {string | { icon?: string, amount?: number, label?: string, kind?: string, cosmeticId?: string }} item
 */
function isPrizeItem(item) {
  if (!item || typeof item !== 'object') return false;
  const kind = String(item.kind || '').trim().toLowerCase();
  if (kind === 'item') return true;
  return Boolean(String(item.cosmeticId || '').trim());
}

/**
 * @param {string | { icon?: string, amount?: number, label?: string, kind?: string, cosmeticId?: string }} item
 * @param {string} base
 */
function prizeItemHtml(item, base) {
  if (item && typeof item === 'object') {
    const amount = Number(item.amount);
    const iconPath = String(item.icon || 'assets/tooltips/icons/Gold.png').trim();
    const iconSrc =
      iconPath.startsWith('http') || iconPath.startsWith('/')
        ? iconPath
        : `${base}${iconPath.replace(/^\//, '')}`;
    const label = String(item.label || '').trim();
    const title = String(item.title || label).trim();
    const amountText = Number.isFinite(amount) ? String(Math.round(amount)) : '';
    const asItem = isPrizeItem(item) || (!amountText && !label);
    const imgClass = asItem ? 'events-featured__prize-item' : 'events-featured__prize-currency';
    const size = asItem ? 48 : 22;
    const cosmeticId = String(item.cosmeticId || '').trim();
    const tipAttr = cosmeticId
      ? ` data-blob-item="${escapeAttr(cosmeticId)}"`
      : '';
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
    return `<li class="events-featured__prize-row"${tipAttr}${titleAttr}>
      <img class="${imgClass}" src="${escapeAttr(iconSrc)}" alt="" width="${size}" height="${size}" draggable="false" decoding="async" />
      ${amountText ? `<span class="events-featured__prize-amount events-featured__ui-text">${escapeHtml(amountText)}</span>` : ''}
      ${label ? `<span class="events-featured__prize-text">${escapeHtml(label)}</span>` : ''}
    </li>`;
  }
  return `<li>${escapeHtml(item)}</li>`;
}

/**
 * Single-column stack: cosmetic/item first, then currency / role rows.
 * @param {(string | { icon?: string, amount?: number, label?: string, kind?: string, cosmeticId?: string })[]} prizes
 * @param {string} base
 */
function placePrizesHtml(prizes, base) {
  const items = [];
  const others = [];
  for (const p of prizes) {
    if (isPrizeItem(p)) items.push(p);
    else others.push(p);
  }
  const ordered = items.length ? [...items, ...others] : prizes;
  const list = ordered.map((item) => prizeItemHtml(item, base)).join('');
  return list ? `<ul class="events-featured__place-list">${list}</ul>` : '';
}

/** Same diamond rule as the home featured-stage title divider. */
function sectionRuleHtml() {
  return `<div class="events-rule events-rule--diamond" aria-hidden="true"><span class="events-rule__line"></span><svg class="events-rule__motif events-rule__motif--diamond" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path fill="currentColor" d="M5 0.8 L9.2 5 L5 9.2 L0.8 5 Z"/></svg><span class="events-rule__line"></span></div>`;
}

/**
 * Rewards column used on featured cards and the detail Rewards tab.
 * @param {CatalogEvent} event
 * @param {string} [root]
 * @param {{ layout?: 'list' | 'grid', chrome?: 'rewards' | 'filter' | 'shade' }} [opts]
 */
export function featuredPrizeColHtml(event, root = '/', opts = {}) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const grid = opts.layout === 'grid';
  const colClass =
    opts.chrome === 'filter'
      ? 'events-featured__prize-col events-featured__prize-col--filter'
      : opts.chrome === 'shade'
        ? 'events-featured__prize-col events-featured__shade'
        : 'events-featured__prize-col bpb-panel--rewards';
  /** @type {{ place: string, label?: string, icon?: string, prizes: (string | { icon?: string, amount?: number, label?: string })[] }[]} */
  let places = Array.isArray(event.prizePlaces) ? event.prizePlaces : [];
  if (!places.length) {
    const label = String(event.prize || '').trim();
    if (label && label !== '—' && label !== '-') {
      places = [
        {
          place: '1st',
          label: '1st place',
          icon: 'assets/icons/history/Trophy.png',
          prizes: [label],
        },
      ];
    }
  }
  if (!places.length) {
    return `
      <aside class="${colClass}" aria-label="Rewards">
        <header class="events-featured__prize-head">
          <h3 class="events-featured__prize-title">Rewards</h3>
        </header>
        <div class="events-featured__prize-scroll">
          <p class="events-featured__prize-detail">No prizes listed yet.</p>
        </div>
      </aside>`;
  }

  const placeBlocks = places.map((p) => {
    const title = String(p.label || p.place || '').trim() || 'Place';
    const iconPath = String(p.icon || '').trim();
    const iconSrc = iconPath
      ? iconPath.startsWith('http') || iconPath.startsWith('/')
        ? iconPath
        : `${base}${iconPath.replace(/^\//, '')}`
      : '';
    const iconHtml = iconSrc
      ? `<img class="events-featured__place-icon" src="${escapeAttr(iconSrc)}" alt="" width="28" height="28" draggable="false" decoding="async" />`
      : '';
    const prizes = Array.isArray(p.prizes) ? p.prizes : [];
    return `
        <div class="events-featured__place">
          <div class="events-featured__place-head">
            ${iconHtml}
            <span class="events-featured__place-label events-featured__ui-text">${escapeHtml(title)}</span>
          </div>
          ${placePrizesHtml(prizes, base)}
        </div>`;
  });

  const placesHtml = grid
    ? `<div class="events-featured__prize-places events-featured__prize-places--grid">${placeBlocks.join('')}</div>`
    : placeBlocks.join(sectionRuleHtml());

  return `
    <aside class="${colClass}" aria-label="Rewards">
      <header class="events-featured__prize-head">
        <h3 class="events-featured__prize-title">Rewards</h3>
      </header>
      ${sectionRuleHtml()}
      <div class="events-featured__prize-scroll">${placesHtml}</div>
    </aside>`;
}

/**
 * @param {CatalogEvent} event
 * @param {string} root
 */
function titleIconHtml(event, root) {
  const path = String(event.titleIcon || '').trim();
  if (!path) return '';
  const base = root.endsWith('/') ? root : `${root}/`;
  const src =
    path.startsWith('http') || path.startsWith('/')
      ? path
      : `${base}${path.replace(/^\//, '')}`;
  return `<img class="events-featured__title-icon" src="${escapeAttr(src)}" alt="" width="40" height="40" draggable="false" decoding="async" />`;
}

/**
 * Shared parchment details body (featured + stacked cards).
 * @param {CatalogEvent} event
 * @param {{ root?: string, titleTag?: 'h2' | 'h3', variant?: 'featured' | 'stack' }} [opts]
 */
function eventDetailsBodyHtml(event, opts = {}) {
  const root = opts.root || '';
  const href = `${root}events/?e=${encodeURIComponent(event.slug)}`;
  const icon = titleIconHtml(event, root);
  const rule = sectionRuleHtml();
  const Title = opts.titleTag === 'h3' ? 'h3' : 'h2';
  const stack = opts.variant === 'stack';
  const statusBlock = stack
    ? ''
    : `<div class="events-featured__status-wrap events-featured__shade">
                  ${eventStatusBarHtml(event)}
                </div>`;
  const scheduleBlock = stack
    ? ''
    : `${rule}
          <section class="events-featured__block events-featured__block--schedule">
            ${eventMetaStripHtml(event, { root, shade: true })}
          </section>
          ${rule}`;
  return `
    <div class="events-featured__body">
      <div class="events-featured__cols">
        <div class="events-featured__info">
          <section class="events-featured__block events-featured__block--head">
            <header class="events-featured__head${icon ? ' events-featured__head--icon' : ''}">
              ${icon}
              <div class="events-featured__head-copy">
                <${Title} class="events-featured__title events-featured__ui-text">${escapeHtml(event.title)}</${Title}>
                ${statusBlock}
              </div>
            </header>
          </section>
          ${scheduleBlock}
          ${stack ? rule : ''}
          <section class="events-featured__block events-featured__block--blurb">
            <div class="events-featured__details">
              <p class="events-featured__blurb">${escapeHtml(event.blurb)}</p>
            </div>
          </section>
          <div class="events-featured__actions">
            <a class="events-featured__cta" href="${escapeAttr(href)}" data-event-open="${escapeAttr(event.slug)}">
              <span>View event</span>
            </a>
          </div>
        </div>
        ${featuredPrizeColHtml(event, root, {
          layout: stack ? 'grid' : 'list',
          chrome: stack ? 'shade' : 'rewards',
        })}
      </div>
    </div>`;
}

/**
 * Image stage with status (TL) + timer (TR) for catalog stack cards.
 * @param {CatalogEvent} event
 * @param {{ root?: string }} [opts]
 */
function stackMediaStageHtml(event, opts = {}) {
  const root = opts.root || '';
  const href = `${root}events/?e=${encodeURIComponent(event.slug)}`;
  return `
    <div class="events-featured__media-stage">
      <a class="events-featured__media-link" href="${escapeAttr(href)}" data-event-open="${escapeAttr(event.slug)}" tabindex="-1" aria-hidden="true">
        ${mediaHtml(event, root, 'events-featured__media')}
      </a>
      <div class="events-featured__corner events-featured__corner--status">
        ${eventStatusBarHtml(event)}
      </div>
      <div class="events-featured__corner events-featured__corner--timer">
        ${eventTimerHtml(event, { root, shade: true })}
      </div>
    </div>`;
}

/**
 * @param {CatalogEvent} event
 * @param {{ root?: string }} [opts]
 */
export function featuredEventHtml(event, opts = {}) {
  const root = opts.root || '';
  const href = `${root}events/?e=${encodeURIComponent(event.slug)}`;
  return `
    <article class="events-featured" data-event-slug="${escapeAttr(event.slug)}">
      <a class="events-featured__media-link" href="${escapeAttr(href)}" data-event-open="${escapeAttr(event.slug)}" tabindex="-1" aria-hidden="true">
        ${mediaHtml(event, root, 'events-featured__media')}
      </a>
      ${eventDetailsBodyHtml(event, { root, titleTag: 'h2' })}
    </article>`;
}

/**
 * Compact catalog row — banner on the left, title / status / blurb / action on the right.
 * Same job as the builds-page compact post.
 * @param {CatalogEvent} event
 * @param {{ root?: string }} [opts]
 */
function eventCompactHtml(event, opts = {}) {
  const root = opts.root || '';
  const href = `${root}events/?e=${encodeURIComponent(event.slug)}`;
  const icon = titleIconHtml(event, root);
  return `
    <li class="events-card events-card--compact" data-event-slug="${escapeAttr(event.slug)}">
      <article class="events-compact">
        <a class="events-compact__thumb" href="${escapeAttr(href)}" data-event-open="${escapeAttr(event.slug)}" tabindex="-1" aria-hidden="true">
          ${mediaHtml(event, root, 'events-compact__media')}
        </a>
        <div class="events-compact__side">
          <a class="events-compact__text" href="${escapeAttr(href)}" data-event-open="${escapeAttr(event.slug)}">
            <span class="events-compact__head${icon ? ' events-compact__head--icon' : ''}">
              ${icon}
              <span class="events-compact__title events-featured__ui-text">${escapeHtml(event.title)}</span>
            </span>
            ${eventStatusBarHtml(event)}
            <p class="events-compact__blurb">${escapeHtml(event.blurb)}</p>
          </a>
          <div class="events-compact__foot">
            ${eventTimerHtml(event, { root })}
            <a class="events-featured__cta events-compact__cta" href="${escapeAttr(href)}" data-event-open="${escapeAttr(event.slug)}">
              <span>View event</span>
            </a>
          </div>
        </div>
      </article>
    </li>`;
}

/**
 * Non-featured catalog card — one framed module; status + timer on the image.
 * @param {CatalogEvent} event
 * @param {{ root?: string }} [opts]
 */
export function eventCardHtml(event, opts = {}) {
  const root = opts.root || '';
  return `
    <li class="events-card" data-event-slug="${escapeAttr(event.slug)}">
      <article class="events-featured events-featured--stack" data-event-slug="${escapeAttr(event.slug)}">
        ${stackMediaStageHtml(event, { root })}
        ${eventDetailsBodyHtml(event, { root, titleTag: 'h3', variant: 'stack' })}
      </article>
    </li>`;
}

/**
 * @param {CatalogEvent[]} events
 * @param {{ root?: string, view?: 'card' | 'compact' }} [opts]
 */
export function eventCardsHtml(events, opts = {}) {
  if (!events.length) {
    return `<p class="events-empty">No events match these filters.</p>`;
  }
  const compact = opts.view === 'compact';
  const row = compact ? eventCompactHtml : eventCardHtml;
  const listClass = compact ? 'events-card-grid events-card-grid--compact' : 'events-card-grid';
  return `<ul class="${listClass}" aria-label="Events">${events
    .map((e) => row(e, opts))
    .join('')}</ul>`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
