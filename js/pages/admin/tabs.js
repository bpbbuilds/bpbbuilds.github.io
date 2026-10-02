/**
 * Admin hub tabs + URL helpers (?tab=).
 */

/** @typedef {'overview' | 'analytics' | 'members' | 'reports' | 'builds' | 'events' | 'cosmetics' | 'overlay' | 'marketplace'} AdminTabId */

/** @type {readonly AdminTabId[]} */
export const ADMIN_TABS = Object.freeze([
  'overview',
  'analytics',
  'members',
  'reports',
  'builds',
  'events',
  'cosmetics',
  'overlay',
  'marketplace',
]);

/** @type {Readonly<Record<AdminTabId, string>>} */
export const ADMIN_TAB_LABELS = Object.freeze({
  overview: 'Overview',
  analytics: 'Analytics',
  members: 'Members',
  reports: 'Sim reports',
  builds: 'Builds',
  events: 'Events',
  cosmetics: 'Cosmetics',
  overlay: 'Blob cast',
  marketplace: 'Marketplace',
});

/** @type {Readonly<Record<AdminTabId, { title: string, blurb: string }>>} */
export const ADMIN_TAB_META = Object.freeze({
  overview: {
    title: 'Overview',
    blurb: 'Quick counts for the portal. More metrics later.',
  },
  analytics: {
    title: 'Analytics',
    blurb: 'Visits on the public pages. One count per page per browser session.',
  },
  members: {
    title: 'Members',
    blurb: 'Accounts, paid Premium, founding, and monthly revenue.',
  },
  reports: {
    title: 'Sim reports',
    blurb: 'Issue notes from the combat sandbox.',
  },
  builds: {
    title: 'Builds',
    blurb: 'OP requests, homepage feature, hide mistakes.',
  },
  events: {
    title: 'Events',
    blurb: 'Create and edit community contests and launch events.',
  },
  cosmetics: {
    title: 'Cosmetics',
    blurb: 'Review player submissions and upload official blob art.',
  },
  overlay: {
    title: 'Blob cast',
    blurb: 'Browser source of everyone’s blobs for videos.',
  },
  marketplace: {
    title: 'Marketplace',
    blurb: 'Coming soon — cosmetics buy / sell moderation.',
  },
});

/**
 * @param {string | null | undefined} raw
 * @returns {AdminTabId}
 */
export function normalizeTab(raw) {
  const id = String(raw || '')
    .trim()
    .toLowerCase();
  if (ADMIN_TABS.includes(/** @type {AdminTabId} */ (id))) {
    return /** @type {AdminTabId} */ (id);
  }
  return 'overview';
}

/**
 * Read tab from the current location (query, or legacy path /admin/reports|builds/).
 */
export function tabFromLocation() {
  const q = new URLSearchParams(location.search);
  const fromQuery = q.get('tab');
  if (fromQuery) return normalizeTab(fromQuery);

  const path = location.pathname.replace(/\/+$/, '');
  if (/\/admin\/reports$/i.test(path)) return 'reports';
  if (/\/admin\/builds$/i.test(path)) return 'builds';
  return 'overview';
}

/**
 * Same-path URL with updated `tab` (keeps other query params).
 * Always resolves under `/admin/` so legacy subpaths normalize.
 * @param {AdminTabId} tab
 * @param {string} [root]
 */
export function urlForTab(tab, root = '../') {
  const base = root.endsWith('/') ? root : `${root}/`;
  const url = new URL(`${base}admin/`, location.href);
  if (tab === 'overview') url.searchParams.delete('tab');
  else url.searchParams.set('tab', tab);
  return `${url.pathname}${url.search}${url.hash}`;
}
