/**
 * Event build gallery privacy — only the author sees an entry until the gallery opens.
 * Vote events open when voting starts. Scored events stay private through judging
 * and open when the event ends.
 */

import { getCatalogEvent } from './catalog-data.js';

/** @typedef {import('./catalog-data.js').CatalogEvent} CatalogEvent */

/**
 * @param {CatalogEvent | null | undefined} event
 * @returns {number | null} epoch ms, or null when the event has no contest lock
 */
export function eventGalleryOpensAt(event) {
  if (!event) return null;
  const schedule = event.schedule || {};
  const votingOn = event.features?.hasVoting === true;
  const entriesOn = Boolean(event.entry) || Boolean(schedule.entriesCloseAt);
  const raw = votingOn
    ? schedule.votingStartsAt || schedule.entriesCloseAt || schedule.endsAt
    : entriesOn
      ? schedule.endsAt
      : null;
  if (!raw) return null;
  const t = Date.parse(String(raw));
  return Number.isFinite(t) ? t : null;
}

/**
 * Public gallery (everyone can browse submitted boards).
 * @param {CatalogEvent | null | undefined} event
 * @param {number} [now]
 */
export function eventBuildGalleryIsPublic(event, now = Date.now()) {
  if (!event) return true;
  const opens = eventGalleryOpensAt(event);
  if (opens == null) return true;
  return now >= opens;
}

/**
 * Other players cannot see this entry yet.
 * @param {string | null | undefined} eventSlug
 * @param {string | null | undefined} authorId
 * @param {string | null | undefined} myAuthorId
 * @param {number} [now]
 */
export function eventEntryVisibleTo(eventSlug, authorId, myAuthorId, now = Date.now()) {
  const slug = String(eventSlug || '').trim();
  if (!slug) return true;
  const event = getCatalogEvent(slug);
  if (!event || eventBuildGalleryIsPublic(event, now)) return true;
  return Boolean(myAuthorId && String(authorId || '') === String(myAuthorId));
}

/**
 * Entrants can still submit / see their own board.
 * @param {CatalogEvent | null | undefined} event
 * @param {number} [now]
 */
export function eventBuildEntriesOpen(event, now = Date.now()) {
  if (!event) return false;
  if (event.status === 'judging' || event.status === 'ended' || event.status === 'voting') return false;
  const start = event.schedule?.startsAt;
  if (start) {
    const t = Date.parse(start);
    if (Number.isFinite(t) && t > now) return false;
  }
  const close = event.schedule?.entriesCloseAt;
  if (close) {
    const t = Date.parse(close);
    if (Number.isFinite(t) && t <= now) return false;
  }
  return event.status === 'accepting-entries' || event.status === 'live';
}

/**
 * Announced but not accepting yet.
 * @param {CatalogEvent | null | undefined} event
 * @param {number} [now]
 */
export function eventBuildEntriesUpcoming(event, now = Date.now()) {
  if (!event) return false;
  if (eventBuildGalleryIsPublic(event, now)) return false;
  if (eventBuildEntriesOpen(event, now)) return false;
  return true;
}
