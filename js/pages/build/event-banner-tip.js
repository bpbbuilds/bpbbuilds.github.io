/**
 * Hover card for the build-page event banner.
 */

import { EVENT_STATUS_LABELS, getCatalogEvent } from '../events/catalog-data.js';
import { formatEventDate } from '../events/event-meta.js';

/**
 * @param {string} s
 */
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {string} s
 */
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

/**
 * Short event mark (HDS I), linked to the event. Empty when the build was not entered.
 * @param {string | null | undefined} eventSlug
 * @param {string} root
 */
export function eventMarkHtml(eventSlug, root) {
  const slug = String(eventSlug || '').trim();
  if (!slug) return '';
  const event = getCatalogEvent(slug);
  const mark = String(event?.mark || '').trim();
  if (!mark) return '';
  const base = root.endsWith('/') ? root : `${root}/`;
  const title = event?.title || slug;
  const href = `${base}events/?e=${encodeURIComponent(slug)}`;
  return `<a class="build-stage__event" href="${escapeAttr(href)}" data-event-slug="${escapeAttr(slug)}" aria-label="Entered in ${escapeAttr(title)}">${escapeHtml(mark)}</a>`;
}

/**
 * @param {import('../events/catalog-data.js').CatalogEvent} event
 */
function datesLine(event) {
  const start = event.schedule?.startsAt;
  const end = event.schedule?.endsAt;
  if (start && end) return `${formatEventDate(start)} – ${formatEventDate(end)}`;
  if (start) return formatEventDate(start);
  const label = String(event.datesLabel || '').trim();
  return label;
}

/**
 * @param {import('../events/catalog-data.js').CatalogEvent} event
 */
function tipHtml(event) {
  const status = EVENT_STATUS_LABELS[event.status] || '';
  const dates = datesLine(event);
  const prize = String(event.prize || '').trim();
  const blurb = String(event.blurb || '').trim();
  const tag = String(event.tag || '').trim();
  return `
    <div class="bpb-tooltip__inner build-event-tip__inner">
      <p class="build-event-tip__title">${escapeHtml(event.title || event.slug)}</p>
      ${tag && tag !== event.title ? `<p class="build-event-tip__tag">${escapeHtml(tag)}</p>` : ''}
      ${status ? `<p class="build-event-tip__status">${escapeHtml(status)}</p>` : ''}
      ${dates ? `<p class="build-event-tip__dates">${escapeHtml(dates)}</p>` : ''}
      ${blurb ? `<p class="build-event-tip__blurb">${escapeHtml(blurb)}</p>` : ''}
      ${prize ? `<p class="build-event-tip__prize">${escapeHtml(prize)}</p>` : ''}
    </div>`;
}

/** @type {() => void} */
let unbind = () => {};

/**
 * Hover cards for every event mark in `scope`.
 * @param {ParentNode} scope
 * @returns {() => void}
 */
export function bindEventBannerTip(scope) {
  unbind();
  unbind = () => {};
  const marks = [...scope.querySelectorAll('.build-stage__event')].filter(
    (el) => el instanceof HTMLElement,
  );
  if (!marks.length) return unbind;

  const tip = document.createElement('div');
  tip.className = 'build-event-tip bpb-tooltip';
  tip.dataset.frame = 'Adventurer';
  tip.hidden = true;
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);

  /** @param {HTMLElement} banner */
  function place(banner) {
    const slug = banner.getAttribute('data-event-slug') || '';
    const event = getCatalogEvent(slug);
    if (!event) {
      tip.hidden = true;
      return;
    }
    tip.innerHTML = tipHtml(event);
    tip.hidden = false;
    tip.style.left = '0px';
    tip.style.top = '0px';
    const scale = 1;
    tip.style.setProperty('--build-event-tip-scale', String(scale));
    const anchor = banner.getBoundingClientRect();
    const width = tip.offsetWidth * scale;
    const height = tip.offsetHeight * scale;
    let left = anchor.left - width - 12;
    if (left < 8) left = anchor.right + 12;
    let top = anchor.top + anchor.height / 2 - height / 2;
    if (top < 8) top = 8;
    if (top + height > window.innerHeight - 8) top = window.innerHeight - 8 - height;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
  }

  /** @type {(() => void)[]} */
  const cleanups = [];
  for (const banner of marks) {
    const show = () => place(banner);
    const hide = () => {
      tip.hidden = true;
    };
    banner.addEventListener('pointerenter', show);
    banner.addEventListener('pointerleave', hide);
    banner.addEventListener('focus', show);
    banner.addEventListener('blur', hide);
    cleanups.push(() => {
      banner.removeEventListener('pointerenter', show);
      banner.removeEventListener('pointerleave', hide);
      banner.removeEventListener('focus', show);
      banner.removeEventListener('blur', hide);
    });
  }

  unbind = () => {
    for (const cleanup of cleanups) cleanup();
    tip.remove();
  };
  return unbind;
}
