/**
 * Admin overview — metric tiles (report stats + build list caps; rest are placeholders).
 */

import { listBuilds, reportStats, AdminAuthError } from './api.js';
import { getSupabase } from '../../shared/supabase.js';
import { FOUNDING_TOTAL, getFoundingStatus } from '../../shared/entitlements.js';
import { escapeAttr, escapeHtml } from './row.js';
import { skelBar, skelRegion } from '../../shared/skeleton.js';

const LIST_CAP = 100;

/**
 * @param {HTMLElement} host
 * @param {{
 *   auth: { mode: 'jwt' | 'secret', token: string },
 *   root: string,
 *   onUnauthorized: () => void,
 *   onTab?: (tab: 'overview' | 'members' | 'reports' | 'builds' | 'events' | 'cosmetics' | 'marketplace') => void,
 * }} opts
 */
export async function mountMetrics(host, opts) {
  host.innerHTML = skelRegion(
    `<div class="admin-metrics">
      ${skelTile()}${skelTile()}${skelTile()}${skelTile()}${skelTile()}${skelTile()}
    </div>`,
    { label: 'Loading admin metrics' },
  );

  try {
    const [repStats, pending, featured, hidden, founding, premiumCount] = await Promise.all([
      reportStats(opts.auth),
      listBuilds(opts.auth, 'pending_op'),
      listBuilds(opts.auth, 'featured'),
      listBuilds(opts.auth, 'hidden'),
      getFoundingStatus(),
      opts.auth.mode === 'jwt' ? paidPremiumCount() : Promise.resolve(null),
    ]);
    const tiles = [
      {
        label: 'Open reports',
        value: String(Number(repStats?.stats?.open) || 0),
        tab: /** @type {const} */ ('reports'),
        hint: 'Sim issue queue',
      },
      {
        label: 'Pending OP',
        value: capCount(pending?.builds),
        tab: /** @type {const} */ ('builds'),
        hint: 'Awaiting approve / deny',
      },
      {
        label: 'Featured',
        value: capCount(featured?.builds),
        tab: /** @type {const} */ ('builds'),
        hint: 'Homepage carousel',
      },
      {
        label: 'Hidden builds',
        value: capCount(hidden?.builds),
        tab: /** @type {const} */ ('builds'),
        hint: 'Soft-hidden from the catalog',
      },
      {
        label: 'Founding',
        value: `${Number(founding?.used) || 0}/${Number(founding?.total) || FOUNDING_TOTAL}`,
        hint: !founding?.started
          ? 'Promo not started yet'
          : founding?.open
            ? 'Slots still open'
            : 'Promo closed or full',
      },
      {
        label: 'Premium members',
        value: premiumCount == null ? '—' : String(premiumCount),
        tab: /** @type {const} */ ('members'),
        hint: premiumCount == null ? 'Owner sign-in opens Members' : 'Paid Premium',
        placeholder: premiumCount == null,
      },
    ];
    host.innerHTML = `<div class="admin-metrics">${tiles.map(tileHtml).join('')}</div>`;
    if (opts.onTab) {
      host.addEventListener('click', (e) => {
        const btn =
          e.target instanceof Element
            ? e.target.closest('[data-admin-go-tab]')
            : null;
        if (!(btn instanceof HTMLButtonElement)) return;
        const tab = btn.getAttribute('data-admin-go-tab');
        if (
          tab === 'reports' ||
          tab === 'builds' ||
          tab === 'overview' ||
          tab === 'members' ||
          tab === 'events' ||
          tab === 'cosmetics' ||
          tab === 'marketplace'
        ) {
          opts.onTab?.(tab);
        }
      });
    }
  } catch (err) {
    if (err instanceof AdminAuthError) {
      opts.onUnauthorized();
      return;
    }
    host.innerHTML = `<p class="admin-status admin-status--err" role="alert">${escapeHtml(err?.message || 'Could not load metrics')}</p>`;
  }
}

async function paidPremiumCount() {
  try {
    const { data, error } = await getSupabase().rpc('member_stats');
    if (error || !data || typeof data !== 'object') return null;
    const premium = /** @type {{ premium?: number }} */ (data).premium;
    return Number.isFinite(Number(premium)) ? Number(premium) : null;
  } catch {
    return null;
  }
}

function skelTile() {
  return `<div class="admin-metric">${skelBar({ width: '55%' })}${skelBar({ width: '30%', height: '1.8rem' })}</div>`;
}

/**
 * @param {unknown} rows
 */
function capCount(rows) {
  const n = Array.isArray(rows) ? rows.length : 0;
  return n >= LIST_CAP ? `${LIST_CAP}+` : String(n);
}

/**
 * @param {{
 *   label: string,
 *   value: string,
 *   tab?: 'overview' | 'members' | 'reports' | 'builds' | 'events' | 'cosmetics' | 'marketplace',
 *   hint: string,
 *   placeholder?: boolean,
 * }} tile
 */
function tileHtml(tile) {
  const inner = `
    <p class="admin-metric__label">${escapeHtml(tile.label)}</p>
    <p class="admin-metric__value">${escapeHtml(tile.value)}</p>
    <p class="admin-metric__hint">${escapeHtml(tile.hint)}</p>
  `;
  if (tile.tab) {
    return `<button type="button" class="admin-metric" data-admin-go-tab="${escapeAttr(tile.tab)}">${inner}</button>`;
  }
  return `<div class="admin-metric${tile.placeholder ? ' admin-metric--soon' : ''}">${inner}</div>`;
}
