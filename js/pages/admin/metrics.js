/**
 * Admin overview — metric tiles (report stats + build list caps; rest are placeholders).
 */

import { listBuilds, reportStats, getSiteAccessMode, setSiteAccessMode, AdminAuthError } from './api.js';
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
    const [repStats, pending, featured, hidden, founding, premiumCount, siteAccess] = await Promise.all([
      reportStats(opts.auth),
      listBuilds(opts.auth, 'pending_op'),
      listBuilds(opts.auth, 'featured'),
      listBuilds(opts.auth, 'hidden'),
      getFoundingStatus(),
      opts.auth.mode === 'jwt' ? paidPremiumCount() : Promise.resolve(null),
      getSiteAccessMode(),
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
    const accessMode = siteAccess?.mode === 'private' ? 'private' : 'live';
    host.innerHTML = `<div class="admin-metrics">${tiles.map(tileHtml).join('')}</div>${siteAccessHtml(accessMode)}`;
    host.querySelectorAll('[data-site-access-mode]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!(button instanceof HTMLButtonElement)) return;
        const next = button.dataset.siteAccessMode;
        if (next !== 'live' && next !== 'private') return;
        if (next === accessMode) return;
        if (next === 'private' && !window.confirm('Switch the site to Private? Visitors must sign in with Discord and be in the BPB Builds server after their next page load.')) return;
        const status = host.querySelector('[data-site-access-status]');
        host.querySelectorAll('[data-site-access-mode]').forEach((control) => {
          if (control instanceof HTMLButtonElement) control.disabled = true;
        });
        if (status) status.textContent = 'Saving access mode…';
        try {
          await setSiteAccessMode(opts.auth, next);
          await mountMetrics(host, opts);
        } catch (error) {
          if (error instanceof AdminAuthError) {
            opts.onUnauthorized();
            return;
          }
          if (status) status.textContent = error?.message || 'Could not update access mode.';
          host.querySelectorAll('[data-site-access-mode]').forEach((control) => {
            if (control instanceof HTMLButtonElement) control.disabled = false;
          });
        }
      });
    });
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

/** @param {'live' | 'private'} mode */
function siteAccessHtml(mode) {
  const privateMode = mode === 'private';
  return `
    <section class="admin-site-access" aria-labelledby="admin-site-access-title">
      <div>
        <p class="admin-site-access__eyebrow">Site access</p>
        <h2 id="admin-site-access-title">${privateMode ? 'Private' : 'Live'} mode</h2>
        <p>Private mode requires Discord sign-in and BPB Builds server membership. The change applies when visitors next load a page.</p>
      </div>
      <div class="admin-site-access__controls" role="group" aria-label="Site access mode">
        <button type="button" class="admin-site-access__choice${!privateMode ? ' is-active' : ''}" data-site-access-mode="live" aria-pressed="${!privateMode}">Live</button>
        <button type="button" class="admin-site-access__choice${privateMode ? ' is-active' : ''}" data-site-access-mode="private" aria-pressed="${privateMode}">Private</button>
      </div>
      <p class="admin-site-access__status" data-site-access-status role="status">Current mode: ${privateMode ? 'Private' : 'Live'}.</p>
    </section>`;
}
