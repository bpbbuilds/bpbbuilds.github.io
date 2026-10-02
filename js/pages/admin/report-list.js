/**
 * Compact expandable sim-report rows for /admin/reports/.
 */

import { escapeAttr, escapeHtml } from './row.js';

/**
 * @param {object} r
 * @param {string} root
 * @param {{ expanded?: boolean }} [opts]
 */
export function reportRowHtml(r, root, opts = {}) {
  const id = String(r.id || '');
  const status = String(r.status || 'open');
  const name = String(r.reporter_label || 'Guest').trim() || 'Guest';
  const when = formatLineDate(r.created_at);
  const preview = snippet(r.description);
  const resolved = status === 'fixed' || status === 'wontfix';
  const openAttr = opts.expanded ? ' open' : '';
  const tone = resolved ? ' admin-report--resolved' : ' admin-report--open';
  const statusMod = status === 'fixed' ? ' admin-report--fixed' : status === 'wontfix' ? ' admin-report--wontfix' : '';

  return `
    <details class="admin-report${tone}${statusMod}" data-report-id="${escapeAttr(id)}"${openAttr}>
      <summary class="admin-report__summary">
        ${avatarHtml(r, name)}
        <span class="admin-report__who">${escapeHtml(name)}</span>
        <span class="admin-report__when">${escapeHtml(when || '—')}</span>
        <span class="admin-report__snippet">${escapeHtml(preview || '—')}</span>
        <span class="admin-flag ${statusFlagClass(status)}">${escapeHtml(statusLabel(status))}</span>
      </summary>
      <div class="admin-report__detail">
        <p class="admin-report__desc">${escapeHtml(r.description || '')}</p>
        <dl class="admin-report__facts">
          <div><dt>You</dt><dd>${escapeHtml(boardLine(r) || '—')}</dd></div>
          <div><dt>Opponent</dt><dd>${escapeHtml(r.foe_label || r.foe_mode || '—')}</dd></div>
          <div><dt>Seed</dt><dd>${escapeHtml(r.seed || '—')}</dd></div>
          <div><dt>Coverage</dt><dd>${coverageLabel(r)}</dd></div>
        </dl>
        <div class="admin-card__actions">
          ${fightLinkHtml(r, root)}
          ${statusActions(status, id)}
        </div>
      </div>
    </details>
  `;
}

/**
 * @param {object} r
 * @param {string} name
 */
function avatarHtml(r, name) {
  const src = String(r.reporter_avatar_url || '').trim();
  if (src) {
    return `<img class="admin-report__avatar" src="${escapeAttr(src)}" alt="" width="32" height="32" draggable="false" />`;
  }
  return `<span class="admin-report__avatar admin-report__avatar--initials" aria-hidden="true">${escapeHtml(initials(name))}</span>`;
}

/**
 * @param {string} name
 */
function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  const one = parts[0] || 'G';
  return one.slice(0, 2).toUpperCase();
}

/**
 * @param {unknown} text
 */
function snippet(text) {
  const t = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= 88) return t;
  const cut = t.slice(0, 88);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > 40 ? cut.slice(0, sp) : cut).trim()}…`;
}

/**
 * @param {object} r
 */
function coverageLabel(r) {
  if (r.coverage_pct != null && r.coverage_pct !== '') {
    return `${escapeHtml(String(r.coverage_pct))}%`;
  }
  return '—';
}

/**
 * @param {object} r
 */
function boardLine(r) {
  const title = String(r.you_title || '').trim();
  const round = r.you_round;
  if (title && round != null && round !== '') return `${title} · round ${round}`;
  return title;
}

/**
 * @param {object} r
 * @param {string} root
 */
function fightLinkHtml(r, root) {
  const href = permalinkHref(r.permalink, root);
  if (!href) return '';
  return `<a class="cr-btn-quiet" href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">Open fight</a>`;
}

/**
 * @param {unknown} permalink
 * @param {string} root
 */
function permalinkHref(permalink, root) {
  const p = String(permalink || '').trim();
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith('/')) return p;
  const base = root.endsWith('/') ? root : `${root}/`;
  if (p.startsWith('?')) return `${base}sim/${p}`;
  return `${base}${p.replace(/^\.\//, '')}`;
}

/**
 * @param {string} status
 * @param {string} id
 */
function statusActions(status, id) {
  /** @type {{ status: 'open' | 'fixed' | 'wontfix', label: string, kind: string }[]} */
  const bits = [];
  if (status !== 'fixed') {
    bits.push({ status: 'fixed', label: 'Mark resolved', kind: 'cr-submit is-ready' });
  }
  if (status !== 'wontfix') {
    bits.push({ status: 'wontfix', label: 'Won’t fix', kind: 'cr-btn-quiet' });
  }
  if (status !== 'open') {
    bits.push({ status: 'open', label: 'Reopen', kind: 'cr-btn-quiet' });
  }
  return bits
    .map(
      (b) =>
        `<button type="button" class="${b.kind}" data-report-id="${escapeAttr(id)}" data-report-status="${b.status}">${escapeHtml(b.label)}</button>`,
    )
    .join('');
}

/**
 * @param {unknown} iso
 */
function formatLineDate(iso) {
  if (!iso) return '';
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  const opts =
    d.getFullYear() === now.getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' };
  return d.toLocaleDateString(undefined, opts);
}

/**
 * @param {string} status
 */
function statusLabel(status) {
  if (status === 'fixed') return 'Resolved';
  if (status === 'wontfix') return 'Won’t fix';
  return 'Open';
}

/**
 * @param {string} status
 */
function statusFlagClass(status) {
  if (status === 'fixed') return 'admin-flag--ok';
  if (status === 'wontfix') return 'admin-flag--hidden';
  return 'admin-flag--pending';
}
