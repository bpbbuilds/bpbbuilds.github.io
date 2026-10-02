/**
 * Sim issue-report queue for /admin/.
 */

import { listReports, reportStats, setReportStatus, AdminAuthError } from './api.js';
import {
  bindReportFilters,
  defaultReportListFilters,
  listQueryFromFilters,
  reportFiltersHtml,
  syncReportFiltersUi,
} from './report-filters.js';
import { reportRowHtml } from './report-list.js';
import { escapeAttr, escapeHtml } from './row.js';

/**
 * @param {HTMLElement} host
 * @param {{
 *   auth: { mode: 'jwt' | 'secret', token: string },
 *   root: string,
 *   getFilters: () => import('./report-filters.js').ReportListFilters,
 *   setFilters: (next: import('./report-filters.js').ReportListFilters) => void,
 *   onUnauthorized: () => void,
 *   onChanged?: () => void,
 *   expandedId?: string,
 *   onExpand?: (id: string) => void,
 * }} opts
 */
export async function mountReportsPanel(host, opts) {
  const filters = opts.getFilters();

  host.innerHTML = `
    <div class="admin-reports-layout">
      <div class="admin-reports-col">
        <div class="admin-kpis" data-report-kpis>
          <p class="admin-status" role="status">Loading counts…</p>
        </div>
        <div class="admin-reports-panel" data-admin-reports-body>
          <p class="admin-status" role="status">Loading…</p>
        </div>
      </div>
      ${reportFiltersHtml(opts.root, filters, 0)}
    </div>
  `;

  host.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const el = t.closest('[data-admin-reports-filter], [data-admin-reports-date]');
    if (!(el instanceof HTMLElement) || !host.contains(el) || el.closest('.admin-report-filters')) {
      return;
    }
    const status = el.getAttribute('data-admin-reports-filter');
    const date = el.getAttribute('data-admin-reports-date');
    const cur = opts.getFilters();
    if (status === 'all' || status === 'open' || status === 'fixed' || status === 'wontfix') {
      if (status !== cur.status) opts.setFilters({ ...cur, status });
      void refresh(host, opts, { stats: false });
      return;
    }
    if (date === 'any' || date === 'today' || date === '7d' || date === '30d') {
      if (date !== cur.date) opts.setFilters({ ...cur, date });
      void refresh(host, opts, { stats: false });
    }
  });

  host.addEventListener('click', async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const btn = t.closest('[data-report-status]');
    if (!(btn instanceof HTMLButtonElement) || !host.contains(btn)) return;
    const id = btn.getAttribute('data-report-id') || '';
    const status = btn.getAttribute('data-report-status') || '';
    if (!id || (status !== 'open' && status !== 'fixed' && status !== 'wontfix')) {
      return;
    }
    opts.onExpand?.(id);
    btn.disabled = true;
    try {
      await setReportStatus(opts.auth, id, status);
      opts.onChanged?.();
    } catch (err) {
      if (err instanceof AdminAuthError) {
        opts.onUnauthorized();
        return;
      }
      btn.disabled = false;
      window.alert(err?.message || 'Could not update report');
    }
  });

  const rail = host.querySelector('.admin-report-filters');
  let searchTimer = 0;
  if (rail instanceof HTMLElement) {
    bindReportFilters(rail, {
      getState: () => opts.getFilters(),
      defaultState: defaultReportListFilters,
      onChange: (next, meta) => {
        opts.setFilters(next);
        if (meta?.debounce) {
          window.clearTimeout(searchTimer);
          searchTimer = window.setTimeout(() => {
            void refresh(host, opts, { stats: false });
          }, 280);
          return;
        }
        void refresh(host, opts, { stats: false });
      },
    });
  }

  await refresh(host, opts, { stats: true });
}

/**
 * @param {HTMLElement} host
 * @param {Parameters<typeof mountReportsPanel>[1]} opts
 * @param {{ stats?: boolean }} [flags]
 */
async function refresh(host, opts, flags = {}) {
  const filters = opts.getFilters();
  const kpis = host.querySelector('[data-report-kpis]');
  const body = host.querySelector('[data-admin-reports-body]');
  const rail = host.querySelector('.admin-report-filters');
  if (!(body instanceof HTMLElement)) return;

  const jobs = [listReports(opts.auth, listQueryFromFilters(filters))];
  if (flags.stats) jobs.push(reportStats(opts.auth));

  const settled = await Promise.allSettled(jobs);
  const listRes = settled[0];
  const statsRes = flags.stats ? settled[1] : null;

  const listErr = listRes.status === 'rejected' ? listRes.reason : null;
  const statsErr = statsRes && statsRes.status === 'rejected' ? statsRes.reason : null;
  if (listErr instanceof AdminAuthError || statsErr instanceof AdminAuthError) {
    opts.onUnauthorized();
    return;
  }

  if (flags.stats && kpis instanceof HTMLElement) {
    if (statsRes && statsRes.status === 'fulfilled') {
      kpis.innerHTML = kpiRowHtml(statsRes.value?.stats, filters);
    } else {
      kpis.innerHTML = `<p class="admin-status admin-status--err" role="alert">Could not load counts.</p>`;
    }
  } else if (kpis instanceof HTMLElement && kpis.querySelector('.admin-metric')) {
    kpis.querySelectorAll('[data-admin-reports-filter]').forEach((el) => {
      const on = el.getAttribute('data-admin-reports-filter') === filters.status;
      el.classList.toggle('is-active', on);
    });
    kpis.querySelectorAll('[data-admin-reports-date]').forEach((el) => {
      const on = el.getAttribute('data-admin-reports-date') === filters.date;
      el.classList.toggle('is-active', on);
    });
  }

  if (listRes.status === 'rejected') {
    body.innerHTML = `<p class="admin-status admin-status--err" role="alert">${escapeHtml(listErr?.message || 'Failed to load')}</p>`;
    if (rail instanceof HTMLElement) syncReportFiltersUi(rail, filters, 0);
    return;
  }

  const reports = Array.isArray(listRes.value?.reports) ? listRes.value.reports : [];
  if (rail instanceof HTMLElement) syncReportFiltersUi(rail, filters, reports.length);

  if (!reports.length) {
    body.innerHTML = `<p class="admin-empty">No reports match these filters.</p>`;
    return;
  }

  const expandedId = String(opts.expandedId || '');
  body.innerHTML = `
    <div class="admin-reports" data-admin-report-list>
      ${reports
        .map((r) => reportRowHtml(r, opts.root, { expanded: String(r.id) === expandedId }))
        .join('')}
    </div>
  `;
  bindToggles(body, opts);
}

/**
 * @param {HTMLElement} rootEl
 * @param {Parameters<typeof mountReportsPanel>[1]} opts
 */
function bindToggles(rootEl, opts) {
  rootEl.querySelectorAll('details.admin-report').forEach((el) => {
    if (!(el instanceof HTMLDetailsElement)) return;
    el.addEventListener('toggle', () => {
      const id = el.getAttribute('data-report-id') || '';
      if (el.open) opts.onExpand?.(id);
      else if (opts.expandedId === id) opts.onExpand?.('');
    });
  });
}

/**
 * @param {object | undefined} stats
 * @param {import('./report-filters.js').ReportListFilters} filters
 */
function kpiRowHtml(stats, filters) {
  const s = stats || {};
  const n = (v) => String(Number(v) || 0);
  const tiles = [
    { label: 'Open', value: n(s.open), hint: 'Needs a look', status: 'open' },
    { label: 'Total', value: n(s.total), hint: 'All time', status: 'all' },
    { label: 'Resolved', value: n(s.fixed), hint: 'Marked resolved', status: 'fixed' },
    { label: 'Today', value: n(s.today), hint: 'Filed since 00:00 UTC', date: 'today' },
    { label: 'Last 30 days', value: n(s.last_30d), hint: 'New reports', date: '30d' },
    {
      label: 'Oldest open',
      value: ageLabel(s.oldest_open_at),
      hint: s.oldest_open_at ? formatWhen(s.oldest_open_at) : 'Queue is clear',
    },
  ];
  return tiles.map((t) => kpiTileHtml(t, filters)).join('');
}

/**
 * @param {{ label: string, value: string, hint: string, status?: string, date?: string }} tile
 * @param {import('./report-filters.js').ReportListFilters} filters
 */
function kpiTileHtml(tile, filters) {
  const inner = `
    <p class="admin-metric__label">${escapeHtml(tile.label)}</p>
    <p class="admin-metric__value">${escapeHtml(tile.value)}</p>
    <p class="admin-metric__hint">${escapeHtml(tile.hint)}</p>
  `;
  if (tile.status) {
    const on = tile.status === filters.status;
    return `<button type="button" class="admin-metric admin-metric--btn${on ? ' is-active' : ''}" data-admin-reports-filter="${escapeAttr(tile.status)}">${inner}</button>`;
  }
  if (tile.date) {
    const on = tile.date === filters.date;
    return `<button type="button" class="admin-metric admin-metric--btn${on ? ' is-active' : ''}" data-admin-reports-date="${escapeAttr(tile.date)}">${inner}</button>`;
  }
  return `<div class="admin-metric">${inner}</div>`;
}

/**
 * @param {unknown} iso
 */
function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * @param {unknown} iso
 */
function ageLabel(iso) {
  if (!iso) return '—';
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return '—';
  const ms = Date.now() - d.getTime();
  if (ms < 60_000) return '<1m';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}
