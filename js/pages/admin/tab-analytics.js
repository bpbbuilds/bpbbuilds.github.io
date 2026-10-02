/**
 * Admin Analytics — daily visit totals by public page.
 */

import { getSupabase } from '../../shared/supabase.js';
import { skelBar, skelRegion } from '../../shared/skeleton.js';
import { escapeHtml } from './row.js';

/** @type {Readonly<Record<string, string>>} */
const LABELS = Object.freeze({
  '/': 'Home',
  '/items/': 'Item library',
  '/builds/': 'Builds',
  '/builds/history/': 'Build history',
  '/builds/view/': 'Build view',
  '/builds/*': 'Build pages',
  '/create/': 'Create',
  '/events/': 'Events',
  '/challenges/': 'Challenges',
  '/quest/': 'Quest',
  '/market/': 'Market',
  '/sim/': 'Combat sandbox',
  '/u/': 'Profile',
  '/legal/about/': 'About',
  '/legal/privacy/': 'Privacy',
  '/legal/terms/': 'Terms',
  '/overlay/': 'Blob overlay',
});

/**
 * @param {number} offset days before today, UTC
 */
function utcDay(offset) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

/**
 * @param {HTMLElement} host
 * @param {{ auth: { mode: 'jwt' | 'secret' } }} opts
 */
export async function mountAnalyticsPanel(host, opts) {
  host.innerHTML = skelRegion(
    `<div class="admin-traffic">${skelBar({ width: '100%' })}${skelBar({ width: '80%' })}</div>`,
    { label: 'Loading analytics' },
  );

  if (opts.auth.mode !== 'jwt') {
    host.innerHTML = `<p class="admin-status">Sign in with the owner Discord account to see traffic. The break-glass secret cannot read it.</p>`;
    return;
  }

  try {
    const { data, error } = await getSupabase().rpc('page_view_stats');
    if (error) throw error;
    const rows = parseStats(data);
    host.innerHTML = tableHtml(rows);
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err && err.message
        ? String(err.message)
        : 'Could not load analytics';
    host.innerHTML = `<p class="admin-status admin-status--err" role="alert">${escapeHtml(message)}</p>`;
  }
}

/**
 * @param {unknown} data
 * @returns {{ path?: string, day?: string, hits?: number }[]}
 */
function parseStats(data) {
  if (Array.isArray(data)) return data;
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * @param {{ path?: string, day?: string, hits?: number }[]} rows
 */
function tableHtml(rows) {
  const today = utcDay(0);
  const week = new Set(Array.from({ length: 7 }, (_, i) => utcDay(i)));
  /** @type {Map<string, { today: number, week: number, month: number }>} */
  const byPath = new Map();
  for (const row of rows) {
    const path = String(row.path || '');
    if (!path) continue;
    const hits = Number(row.hits) || 0;
    const day = String(row.day || '').slice(0, 10);
    const cur = byPath.get(path) || { today: 0, week: 0, month: 0 };
    cur.month += hits;
    if (week.has(day)) cur.week += hits;
    if (day === today) cur.today += hits;
    byPath.set(path, cur);
  }

  const ordered = [...byPath.entries()].sort((a, b) => b[1].month - a[1].month || a[0].localeCompare(b[0]));
  if (!ordered.length) {
    return `<p class="admin-status">No visits yet. A count is saved the first time someone opens a public page in a browser session.</p>`;
  }

  const body = ordered
    .map(([path, n]) => {
      const label = LABELS[path] || path;
      return `
        <tr>
          <th scope="row">${escapeHtml(label)}</th>
          <td>${n.today}</td>
          <td>${n.week}</td>
          <td>${n.month}</td>
        </tr>`;
    })
    .join('');

  return `
    <div class="admin-traffic">
      <table class="admin-traffic__table">
        <thead>
          <tr>
            <th scope="col">Page</th>
            <th scope="col">Today</th>
            <th scope="col">7 days</th>
            <th scope="col">30 days</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
      <p class="admin-traffic__note">One visit per page per browser session. Build guides are grouped. Admin and dev pages are not counted.</p>
    </div>`;
}
