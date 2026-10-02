/**
 * Profile hub tab ids + URL helpers (?tab=).
 */

/** @typedef {'builds' | 'blob' | 'inventory' | 'settings'} ProfileTabId */

/** @type {readonly ProfileTabId[]} */
export const PROFILE_TABS = Object.freeze([
  'builds',
  'blob',
  'inventory',
  'settings',
]);

/** @type {Readonly<Record<ProfileTabId, string>>} */
export const PROFILE_TAB_LABELS = Object.freeze({
  builds: 'Builds',
  blob: 'Blob',
  inventory: 'Inventory',
  settings: 'Settings',
});

/**
 * @param {boolean} isSelf
 * @returns {ProfileTabId[]}
 */
export function visibleTabs(isSelf) {
  return PROFILE_TABS.filter((id) => id !== 'settings' || isSelf);
}

/**
 * @param {string | null | undefined} raw
 * @param {boolean} isSelf
 * @returns {ProfileTabId}
 */
export function normalizeTab(raw, isSelf) {
  const id = String(raw || '')
    .trim()
    .toLowerCase();
  const allowed = visibleTabs(isSelf);
  if (allowed.includes(/** @type {ProfileTabId} */ (id))) {
    return /** @type {ProfileTabId} */ (id);
  }
  return 'builds';
}

/**
 * Read tab from the current location (query only).
 * @param {boolean} isSelf
 */
export function tabFromLocation(isSelf) {
  const q = new URLSearchParams(location.search);
  return normalizeTab(q.get('tab'), isSelf);
}

/**
 * Build a same-path URL with an updated `tab` (preserves `d` / other params).
 * @param {ProfileTabId} tab
 */
export function urlForTab(tab) {
  const url = new URL(location.href);
  if (tab === 'builds') url.searchParams.delete('tab');
  else url.searchParams.set('tab', tab);
  return `${url.pathname}${url.search}${url.hash}`;
}
