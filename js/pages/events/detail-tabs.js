/**
 * Event detail hub tabs (?e=slug&tab=).
 */

/** @typedef {'overview' | 'rules' | 'builds' | 'voting' | 'rewards'} EventDetailTabId */

/** @type {readonly EventDetailTabId[]} */
export const EVENT_DETAIL_TABS = Object.freeze([
  'overview',
  'rules',
  'builds',
  'voting',
  'rewards',
]);

/** @type {Readonly<Record<EventDetailTabId, string>>} */
export const EVENT_DETAIL_TAB_LABELS = Object.freeze({
  overview: 'Overview',
  rules: 'Rules',
  builds: 'Builds',
  voting: 'Voting',
  rewards: 'Rewards',
});

/**
 * @param {string | null | undefined} raw
 * @param {readonly EventDetailTabId[]} [allowed]
 * @returns {EventDetailTabId}
 */
export function normalizeEventDetailTab(raw, allowed = EVENT_DETAIL_TABS) {
  const id = String(raw || '')
    .trim()
    .toLowerCase();
  const list = allowed.length ? allowed : EVENT_DETAIL_TABS;
  if (list.includes(/** @type {EventDetailTabId} */ (id))) {
    return /** @type {EventDetailTabId} */ (id);
  }
  return list[0] || 'overview';
}

/**
 * @param {readonly EventDetailTabId[]} [allowed]
 * @returns {EventDetailTabId}
 */
export function eventDetailTabFromLocation(allowed) {
  try {
    return normalizeEventDetailTab(
      new URLSearchParams(location.search).get('tab'),
      allowed,
    );
  } catch {
    return normalizeEventDetailTab('overview', allowed);
  }
}

/**
 * Keep `e` (and other params); set/replace `tab`.
 * @param {EventDetailTabId} tab
 */
export function urlForEventDetailTab(tab) {
  const url = new URL(location.href);
  if (tab === 'overview') url.searchParams.delete('tab');
  else url.searchParams.set('tab', tab);
  return `${url.pathname}${url.search}${url.hash}`;
}
