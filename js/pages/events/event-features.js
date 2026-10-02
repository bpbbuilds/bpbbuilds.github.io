/**
 * Per-event hub features (admin create will set these later).
 */

/** @typedef {import('./catalog-data.js').CatalogEvent} CatalogEvent */
/** @typedef {import('./detail-tabs.js').EventDetailTabId} EventDetailTabId */

/**
 * @param {CatalogEvent | null | undefined} event
 */
export function eventHasVoting(event) {
  return Boolean(event?.features?.hasVoting);
}

/**
 * Builds tab — on by default; set features.hasBuilds: false to hide.
 * @param {CatalogEvent | null | undefined} event
 */
export function eventHasBuilds(event) {
  if (!event) return true;
  if (event.features && Object.prototype.hasOwnProperty.call(event.features, 'hasBuilds')) {
    return Boolean(event.features.hasBuilds);
  }
  return true;
}

/**
 * Left-rail tabs for this event (order fixed).
 * @param {CatalogEvent} event
 * @returns {EventDetailTabId[]}
 */
export function tabsForEvent(event) {
  /** @type {EventDetailTabId[]} */
  const tabs = ['overview', 'rules'];
  if (eventHasBuilds(event)) tabs.push('builds');
  if (eventHasVoting(event)) tabs.push('voting');
  tabs.push('rewards');
  return tabs;
}
