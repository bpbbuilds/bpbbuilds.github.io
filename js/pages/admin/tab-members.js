/**
 * Admin Members — account totals, paid Premium, and monthly revenue.
 */

import { getSupabase } from '../../shared/supabase.js';
import { skelBar, skelRegion } from '../../shared/skeleton.js';
import { escapeHtml } from './row.js';

const PRICE_CENTS = 300;

/**
 * @param {HTMLElement} host
 * @param {{ auth: { mode: 'jwt' | 'secret' } }} opts
 */
export async function mountMembersPanel(host, opts) {
  host.innerHTML = skelRegion(
    `<div class="admin-members">${skelBar({ width: '100%' })}${skelBar({ width: '80%' })}</div>`,
    { label: 'Loading members' },
  );

  if (opts.auth.mode !== 'jwt') {
    host.innerHTML = `<p class="admin-status">Sign in with the owner Discord account to see members. The break-glass secret cannot read it.</p>`;
    return;
  }

  try {
    const { data, error } = await getSupabase().rpc('member_stats');
    if (error) throw error;
    host.innerHTML = memberPanelHtml(parseStats(data));
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err && err.message
        ? String(err.message)
        : 'Could not load members';
    host.innerHTML = `<p class="admin-status admin-status--err" role="alert">${escapeHtml(message)}</p>`;
  }
}

/**
 * @param {unknown} data
 */
function parseStats(data) {
  const raw = typeof data === 'string' ? JSON.parse(data) : data;
  const src = raw && typeof raw === 'object' ? raw : {};
  const series = Array.isArray(src.series) ? src.series : [];
  return {
    users: Number(src.users) || 0,
    premium: Number(src.premium) || 0,
    founding: Number(src.founding) || 0,
    revenueCents: Number(src.revenueCents) || 0,
    series: series.map((row) => ({
      day: String(row.day || '').slice(0, 10),
      users: Number(row.users) || 0,
      premium: row.premium == null ? null : Number(row.premium) || 0,
      founding: row.founding == null ? null : Number(row.founding) || 0,
      revenueCents: row.revenueCents == null ? null : Number(row.revenueCents) || 0,
    })),
  };
}

/**
 * Last saved premium count fills days that were not measured again.
 * Days before the first snapshot stay empty.
 * @param {ReturnType<typeof parseStats>['series']} series
 */
function carryForward(series) {
  let premium = null;
  let founding = null;
  let revenueCents = null;
  let seen = false;
  return series.map((row) => {
    if (row.premium != null) {
      seen = true;
      premium = row.premium;
      founding = row.founding ?? 0;
      revenueCents = row.revenueCents ?? premium * PRICE_CENTS;
    }
    return {
      day: row.day,
      users: row.users,
      premium: seen ? premium : null,
      founding: seen ? founding : null,
      revenueCents: seen ? revenueCents : null,
    };
  });
}

/**
 * @param {ReturnType<typeof parseStats>} stats
 */
export function memberPanelHtml(stats) {
  const series = carryForward(stats.series);
  const tiles = [
    ['Users', String(stats.users)],
    ['Premium', String(stats.premium)],
    ['Founding', String(stats.founding)],
    ['Monthly revenue', money(stats.revenueCents)],
  ];
  return `
    <div class="admin-members">
      <div class="admin-metrics">
        ${tiles
          .map(
            ([label, value]) => `
          <div class="admin-metric">
            <p class="admin-metric__label">${escapeHtml(label)}</p>
            <p class="admin-metric__value">${escapeHtml(value)}</p>
          </div>`,
          )
          .join('')}
      </div>
      <section class="admin-members__block" aria-label="Users over 30 days">
        <h2 class="admin-members__title">Users</h2>
        ${chartSvg(series, [{ key: 'users', color: '#3c261d' }], 'Users over 30 days')}
      </section>
      <section class="admin-members__block" aria-label="Premium and founding over 30 days">
        <h2 class="admin-members__title">Premium and founding</h2>
        ${chartSvg(series, [
          { key: 'premium', color: '#9a7b12' },
          { key: 'founding', color: '#2f6b45' },
        ], 'Paid Premium and founding over 30 days')}
        <ul class="admin-members__legend">
          <li><span class="admin-members__swatch" style="background:#9a7b12"></span>Premium</li>
          <li><span class="admin-members__swatch" style="background:#2f6b45"></span>Founding</li>
        </ul>
      </section>
      <section class="admin-members__block" aria-label="Revenue over 30 days">
        <h2 class="admin-members__title">Monthly revenue</h2>
        ${chartSvg(series, [{ key: 'revenueDollars', color: '#9a7b12' }], 'Monthly revenue over 30 days')}
      </section>
      <p class="admin-members__note">Paid Premium is $3 a month. Founding is free, so it is not in the revenue line. The user line uses each profile’s sign-up day. Premium and revenue are saved once per UTC day, then refreshed when you open this tab.</p>
    </div>`;
}

/**
 * @param {number} cents
 */
function money(cents) {
  const dollars = (Number(cents) || 0) / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

/**
 * @param {string} iso
 */
function shortDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * @param {ReturnType<typeof carryForward>} series
 * @param {{ key: 'users' | 'premium' | 'founding' | 'revenueDollars', color: string }[]} lines
 * @param {string} label
 */
function chartSvg(series, lines, label) {
  const rows = series
    .filter((row) => row.day)
    .map((row) => ({
      ...row,
      revenueDollars: row.revenueCents == null ? null : row.revenueCents / 100,
    }));
  if (!rows.length) {
    return `<p class="admin-status">No days to chart yet.</p>`;
  }

  const w = 640;
  const h = 200;
  const padL = 44;
  const padR = 12;
  const padT = 14;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const values = rows.flatMap((row) =>
    lines.map((line) => {
      const n = row[line.key];
      return n == null ? 0 : Number(n) || 0;
    }),
  );
  const max = Math.max(1, ...values);
  const xAt = (i) => padL + (rows.length <= 1 ? innerW / 2 : (i / (rows.length - 1)) * innerW);
  const yAt = (v) => padT + innerH - (v / max) * innerH;

  const paths = lines
    .map((line) => {
      /** @type {string[]} */
      const cmds = [];
      let open = false;
      rows.forEach((row, i) => {
        const n = row[line.key];
        if (n == null) {
          open = false;
          return;
        }
        cmds.push(`${open ? 'L' : 'M'} ${xAt(i).toFixed(1)} ${yAt(Number(n) || 0).toFixed(1)}`);
        open = true;
      });
      if (!cmds.length) return '';
      return `<path d="${cmds.join(' ')}" fill="none" stroke="${line.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />`;
    })
    .join('');

  const dots = lines
    .map((line) =>
      rows
        .map((row, i) => {
          const n = row[line.key];
          if (n == null) return '';
          const amount = line.key === 'revenueDollars' ? money(Number(n) * 100) : String(n);
          return `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(Number(n) || 0).toFixed(1)}" r="3.5" fill="${line.color}"><title>${escapeHtml(shortDay(row.day))}: ${escapeHtml(amount)}</title></circle>`;
        })
        .join(''),
    )
    .join('');

  const first = shortDay(rows[0].day);
  const last = shortDay(rows[rows.length - 1].day);
  const mid = shortDay(rows[Math.floor((rows.length - 1) / 2)].day);
  const yMax = lines.some((line) => line.key === 'revenueDollars') ? money(max * 100) : String(Math.round(max));

  return `
    <svg class="admin-members__chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeHtml(label)}">
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + innerH}" stroke="#3c261d" stroke-opacity="0.35" />
      <line x1="${padL}" y1="${padT + innerH}" x2="${w - padR}" y2="${padT + innerH}" stroke="#3c261d" stroke-opacity="0.35" />
      <text x="${padL - 8}" y="${yAt(max) + 4}" text-anchor="end" fill="#3c261d" font-size="12">${escapeHtml(yMax)}</text>
      <text x="${padL - 8}" y="${yAt(0) + 4}" text-anchor="end" fill="#3c261d" font-size="12">0</text>
      <text x="${xAt(0)}" y="${h - 6}" text-anchor="start" fill="#3c261d" font-size="12">${escapeHtml(first)}</text>
      <text x="${xAt(Math.floor((rows.length - 1) / 2))}" y="${h - 6}" text-anchor="middle" fill="#3c261d" font-size="12">${escapeHtml(mid)}</text>
      <text x="${xAt(rows.length - 1)}" y="${h - 6}" text-anchor="end" fill="#3c261d" font-size="12">${escapeHtml(last)}</text>
      ${paths}
      ${dots}
    </svg>`;
}
