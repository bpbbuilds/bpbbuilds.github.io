/**
 * Admin event desk — submitted builds and the judging file for one event.
 */

import { buildEventHistoryDb } from '../create/history-encode.js';
import { AdminAuthError, listEventEntries } from './api.js';
import { diamondRule } from './event-form-markup.js';
import { statusLabel } from './event-form-model.js';
import { escapeAttr, escapeHtml } from './row.js';
import { skelBar, skelRegion } from '../../shared/skeleton.js';

const TITLE_ID = 'admin-event-desk-title';

/** @typedef {import('./event-form-model.js').EventFormValues} EventFormValues */

/** @type {ReturnType<typeof createEventDesk> | null} */
let singleton = null;

/**
 * @param {{
 *   event: EventFormValues,
 *   auth: { mode: 'jwt' | 'secret', token: string },
 *   root: string,
 *   onUnauthorized?: () => void,
 *   onEdit?: (event: EventFormValues) => void,
 * }} opts
 */
export function openEventDesk(opts) {
  if (!singleton) singleton = createEventDesk();
  singleton.open(opts);
}

function createEventDesk() {
  const root = document.createElement('div');
  root.className = 'cr-modal admin-event-desk';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', TITLE_ID);
  root.hidden = true;
  document.body.appendChild(root);

  /** @type {HTMLElement | null} */
  let lastFocus = null;
  /** @type {EventFormValues | null} */
  let event = null;
  /** @type {object[]} */
  let entries = [];
  /** @type {(() => void) | null} */
  let onKey = null;
  let siteRoot = '../';

  /**
   * @param {EventFormValues} values
   * @param {string} base
   */
  function paintShell(values, base) {
    const publicHref = `${base}events/?e=${encodeURIComponent(values.slug)}`;
    const when = [formatWhen(values.startsAt), formatWhen(values.endsAt)].filter(Boolean).join(' – ');
    const modes = [
      values.modeRanked ? 'Ranked' : '',
      values.modeUnranked ? 'Unranked' : '',
    ].filter(Boolean).join(', ');
    const items = String(values.requiredItemIds || '').trim() || 'None';
    root.innerHTML = `
      <div class="cr-modal__backdrop" data-event-desk-close tabindex="-1"></div>
      <div class="cr-modal__panel cr-modal__panel--form bpb-panel--rewards admin-event-desk__panel" role="document">
        <header class="admin-event-desk__head">
          <h2 class="admin-event-form__title" id="${TITLE_ID}">${escapeHtml(values.title || 'Event')}</h2>
          <button type="button" class="admin-event-desk__close" data-event-desk-close aria-label="Close">×</button>
        </header>
        ${diamondRule()}
        <div class="admin-event-desk__scroll">
          <p class="admin-event-desk__status-line">${escapeHtml(statusLabel(values.status))}${when ? ` · ${escapeHtml(when)}` : ''}</p>
          <dl class="admin-event-desk__facts">
            <div><dt>Judge window</dt><dd>${escapeHtml(String(values.judgeWindowSec || 15))}s</dd></div>
            <div><dt>Required items</dt><dd>${escapeHtml(items)}</dd></div>
            <div><dt>Modes</dt><dd>${escapeHtml(modes || 'Any')}</dd></div>
            <div><dt>Max per player</dt><dd>${escapeHtml(String(values.maxEntriesPerUser || 1))}</dd></div>
          </dl>
          <p class="admin-event-desk__hint">
            The top run is a high-health bomb dummy. Right-click its round to mark it, then fight a submitted build. Back up the game file before you replace it.
            <a href="${escapeAttr(publicHref)}">Public event</a>
          </p>
          <div class="admin-event-desk__actions">
            <button type="button" class="admin-event-desk__btn" data-event-desk-download disabled>Download history.db</button>
            <button type="button" class="admin-event-desk__btn" data-event-desk-edit>Edit event</button>
          </div>
          <h3 class="admin-event-desk__section">Submitted builds</h3>
          <div data-event-desk-list>
            ${skelRegion(
              `<div class="admin-event-desk__skel">${skelBar({ width: '72%' })}${skelBar({ width: '48%' })}</div>`,
              { label: 'Loading entries' },
            )}
          </div>
        </div>
      </div>`;
  }

  /**
   * @param {object[]} builds
   * @param {string} base
   * @param {string} [message]
   */
  function paintList(builds, base, message) {
    const list = root.querySelector('[data-event-desk-list]');
    const download = root.querySelector('[data-event-desk-download]');
    if (download instanceof HTMLButtonElement) download.disabled = !builds.length;
    if (!(list instanceof HTMLElement)) return;
    if (message) {
      list.innerHTML = `<p class="admin-event-desk__empty" role="status">${escapeHtml(message)}</p>`;
      return;
    }
    if (!builds.length) {
      list.innerHTML = `<p class="admin-event-desk__empty" role="status">No builds submitted yet.</p>`;
      return;
    }
    list.innerHTML = `<ul class="admin-event-desk__entries">${builds.map((b) => entryHtml(b, base)).join('')}</ul>`;
  }

  function close() {
    root.hidden = true;
    document.body.classList.remove('cr-modal-open');
    if (onKey) {
      document.removeEventListener('keydown', onKey);
      onKey = null;
    }
    lastFocus?.focus();
  }

  /**
   * @param {{
   *   event: EventFormValues,
   *   auth: { mode: 'jwt' | 'secret', token: string },
   *   root: string,
   *   onUnauthorized?: () => void,
   *   onEdit?: (event: EventFormValues) => void,
   * }} opts
   */
  function open(opts) {
    event = opts.event;
    entries = [];
    const base = opts.root.endsWith('/') ? opts.root : `${opts.root}/`;
    siteRoot = base;
    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    paintShell(opts.event, base);
    root.hidden = false;
    document.body.classList.add('cr-modal-open');
    root.querySelector('.admin-event-desk__close')?.focus();

    onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);

    root.onclick = (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest('[data-event-desk-close]')) {
        close();
        return;
      }
      if (t.closest('[data-event-desk-edit]')) {
        const current = event;
        close();
        if (current) opts.onEdit?.(current);
        return;
      }
      if (t.closest('[data-event-desk-download]')) {
        if (event) void downloadEntries(event, entries, siteRoot);
      }
    };

    listEventEntries(opts.auth, opts.event.slug)
      .then((data) => {
        if (event?.slug !== opts.event.slug) return;
        entries = Array.isArray(data?.builds) ? data.builds : [];
        paintList(entries, base);
      })
      .catch((err) => {
        if (event?.slug !== opts.event.slug) return;
        if (err instanceof AdminAuthError) {
          close();
          opts.onUnauthorized?.();
          return;
        }
        paintList([], base, err instanceof Error ? err.message : 'Could not load entries.');
      });
  }

  return { open };
}

/**
 * @param {object} build
 * @param {string} base
 */
function entryHtml(build, base) {
  const slug = String(build.slug || '');
  const href = `${base}builds/view/?slug=${encodeURIComponent(slug)}`;
  const when = formatWhen(build.created_at);
  const bits = [build.author_name || 'Unknown', build.hero_class || '—', build.rank || '', when]
    .filter(Boolean);
  const notes = String(build.notes || '').trim();
  const hidden = build.is_public === false ? '<span class="admin-event-desk__flag">Hidden</span>' : '';
  return `
    <li class="admin-event-desk__entry">
      <div class="admin-event-desk__entry-main">
        <p class="admin-event-desk__entry-title">${escapeHtml(build.title || slug)} ${hidden}</p>
        <p class="admin-event-desk__entry-meta">${escapeHtml(bits.join(' · '))}</p>
        ${notes ? `<p class="admin-event-desk__entry-notes">${escapeHtml(notes)}</p>` : ''}
      </div>
      <a class="admin-event-desk__btn" href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">View build</a>
    </li>`;
}

/**
 * @param {EventFormValues} event
 * @param {object[]} builds
 */
/**
 * @param {EventFormValues} event
 * @param {object[]} builds
 * @param {string} root
 */
async function downloadEntries(event, builds, root) {
  const hint = document.querySelector('.admin-event-desk__hint');
  try {
    const file = await buildEventHistoryDb(builds, root);
    if (!file.included) {
      if (hint) {
        hint.textContent = 'None of these entries have a stored run to put in history.db.';
      }
      return;
    }
    const bytes = file.bytes instanceof Uint8Array ? file.bytes.slice() : new Uint8Array(file.bytes);
    const blob = new Blob([bytes], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.slug || 'event'}-history.db`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    if (hint && file.skipped) {
        hint.textContent = `Saved ${file.included} runs. ${file.skipped} entries had no stored run. The top run is the bomb dummy.`;
    }
  } catch (err) {
    if (hint) {
      hint.textContent = err instanceof Error ? err.message : 'Could not build history.db.';
    }
  }
}

/**
 * @param {string | null | undefined} value
 */
function formatWhen(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
