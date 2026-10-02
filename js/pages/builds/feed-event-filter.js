/**
 * Community event catalog for the builds feed Events dropdown.
 * Empty until the Phase 2 Events hub has a run to list.
 */

/** @typedef {{ slug: string, title: string }} FeedEvent */

/** @type {FeedEvent[]} */
export const FEED_EVENTS = [{ slug: 'highest-dps', title: 'Highest DPS' }];

/**
 * @param {string | null | undefined} slug
 */
export function isFeedEvent(slug) {
  const id = String(slug || '').trim();
  return FEED_EVENTS.some((e) => e.slug === id);
}

/**
 * @param {string | null | undefined} slug
 */
export function feedEventLabel(slug) {
  if (!slug) return 'All events';
  return FEED_EVENTS.find((e) => e.slug === slug)?.title || 'All events';
}

/**
 * @param {string | null} selected
 */
export function feedEventOptionsHtml(selected) {
  const allOn = !selected;
  const known = FEED_EVENTS.map((e) => {
    const on = selected === e.slug;
    return `<button type="button" class="il-filter__group-option${on ? ' is-active' : ''}" data-feed-event="${escapeAttr(e.slug)}" role="option" aria-selected="${on}">${escapeHtml(e.title)}</button>`;
  }).join('');
  const empty = FEED_EVENTS.length
    ? ''
    : `<button type="button" class="il-filter__group-option is-disabled" disabled>No events yet</button>`;
  return `
    <button type="button" class="il-filter__group-option${allOn ? ' is-active' : ''}" data-feed-event="" role="option" aria-selected="${allOn}">All events</button>
    ${known}
    ${empty}
  `;
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
