/**
 * Admin Events tab — list plus the shared new/edit form.
 */

import { CATALOG_EVENTS, EVENT_STATUS_LABELS, getCatalogEvent } from '../events/catalog-data.js';
import { EVENT_TYPE_LABELS } from '../events/event-filters.js';
import { catalogEventToForm, statusFromSchedule } from './event-form-model.js';
import { openEventForm } from './event-form.js';
import { uploadEventAsset } from './api.js';
import { openEventDesk } from './event-desk.js';
import { escapeAttr, escapeHtml } from './row.js';
import { loadEventDrafts, saveEventDrafts } from '../events/event-drafts.js';
import {
  adminEventFiltersHtml,
  adminEventMatches,
  bindAdminEventFilters,
  defaultAdminEventFilters,
  syncAdminEventFilters,
} from './events-filters.js';

/** @typedef {import('./event-form-model.js').EventFormValues} EventFormValues */

/** @type {EventFormValues[] | null} */
let session = null;

/**
 * Catalog events with voting off stay off, even if an older admin draft turned it on.
 * @param {EventFormValues} event
 * @returns {EventFormValues}
 */
function withoutCatalogVoting(event) {
  const catalog = CATALOG_EVENTS.find((row) => row.slug === event.slug);
  if (!catalog || catalog.features?.hasVoting === true) return event;
  if (!event.votingEnabled && !event.votingStartsAt && !event.votingEndsAt) return event;
  const next = { ...event, votingEnabled: false, votingStartsAt: '', votingEndsAt: '' };
  next.status = statusFromSchedule(next);
  return next;
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   root: string,
 *   auth: { mode: 'jwt' | 'secret', token: string },
 *   onUnauthorized?: () => void,
 * }} opts
 */
export function mountEventsPanel(host, opts) {
  const base = opts.root.endsWith('/') ? opts.root : `${opts.root}/`;
  if (!session) {
    const saved = loadEventDrafts();
    const fromCatalog = CATALOG_EVENTS.map((event) => catalogEventToForm(event));
    if (!saved.length) {
      session = fromCatalog;
    } else {
      const slugs = new Set(saved.map((event) => event.slug));
      session = [
        ...saved.map((event) => withoutCatalogVoting(event)),
        ...fromCatalog.filter((event) => !slugs.has(event.slug)),
      ];
    }
  }

  /** @type {import('./events-filters.js').AdminEventFilterState} */
  let filters = defaultAdminEventFilters();
  /** @type {() => void} */
  let unbindFilters = () => {};

  const shown = () =>
    (session || [])
      .map((event) => ({ ...event, status: statusFromSchedule(event) }))
      .filter((event) => adminEventMatches(event, filters));

  const paintList = () => {
    const rows = shown();
    const list = host.querySelector('.admin-events__list');
    const empty =
      (session || []).length === 0
        ? 'No events yet.'
        : 'No events match these filters.';
    if (list instanceof HTMLElement) {
      list.innerHTML = rows.length
        ? rows.map((event) => rowHtml(event, base, filters.view)).join('')
        : `<li class="admin-empty">${empty}</li>`;
    }
    const rail = host.querySelector('.admin-events-filters');
    if (rail instanceof HTMLElement) syncAdminEventFilters(rail, filters, rows.length);
  };

  const paint = () => {
    unbindFilters();
    const rows = shown();
    host.innerHTML = `
      <div class="admin-events-layout">
        <div class="admin-events-col">
          <section class="admin-panel admin-events" aria-label="Events">
            <p class="admin-panel__blurb">
              Manage public contests here (dates, rules, prizes, publish). The live page is
              <a class="admin-events__link" href="${escapeAttr(`${base}events/`)}">/events/</a>.
            </p>
            <div class="admin-events__toolbar">
              <button type="button" class="cr-submit is-ready" data-admin-event-new>New event</button>
            </div>
            <ul class="admin-events__list" role="list">
              ${
                rows.length
                  ? rows.map((event) => rowHtml(event, base, filters.view)).join('')
                  : `<li class="admin-empty">${(session || []).length ? 'No events match these filters.' : 'No events yet.'}</li>`
              }
            </ul>
            <p class="admin-events__hint">
              A save applies on /events/ in this browser tab. The catalog file is still the default after the tab closes.
            </p>
          </section>
        </div>
        ${adminEventFiltersHtml(base, filters, rows.length)}
      </div>`;
    const rail = host.querySelector('.admin-events-filters');
    if (rail instanceof HTMLElement) {
      unbindFilters = bindAdminEventFilters(rail, {
        getState: () => filters,
        onChange(next) {
          filters = next;
          paintList();
        },
      });
    }
  };

  /**
   * @param {string | null} previousSlug
   * @param {EventFormValues} values
   */
  const commit = (previousSlug, values) => {
    const list = session || [];
    const clash = list.find((event) => event.slug === values.slug && event.slug !== previousSlug);
    if (clash) throw new Error('That slug is already used.');
    if (values.featured) {
      for (const event of list) {
        if (event.slug !== values.slug) event.featured = false;
      }
    }
    const idx = previousSlug ? list.findIndex((event) => event.slug === previousSlug) : -1;
    if (idx >= 0) list[idx] = values;
    else list.push(values);
    session = list;
    saveEventDrafts(list);
    paint();
  };

  const uploadImages = async (values) => {
    const next = { ...values };
    for (const [field, kind] of [['image', 'banner'], ['titleIcon', 'icon']]) {
      if (!String(next[field] || '').startsWith('data:image/')) continue;
      const result = await uploadEventAsset(opts.auth, { slug: next.slug, kind, imageData: next[field] });
      next[field] = String(result?.url || '');
      if (!next[field]) throw new Error('Could not save event image.');
    }
    return next;
  };

  host.onclick = (e) => {
    const t = e.target;
    if (!(t instanceof Element) || !host.contains(t)) return;
    if (t.closest('[data-admin-event-new]')) {
      openEventForm({
        mode: 'new',
        root: base,
        onSubmit: async (values) => commit(null, await uploadImages(values)),
      });
      return;
    }
    const edit = t.closest('[data-admin-event-edit]');
    if (edit instanceof HTMLElement) {
      const slug = edit.getAttribute('data-admin-event-edit') || '';
      const row = (session || []).find((event) => event.slug === slug);
      if (!row) return;
      openEventForm({
        mode: 'edit',
        root: base,
        values: { ...row, status: statusFromSchedule(row) },
        onSubmit: async (values) => commit(slug, await uploadImages(values)),
      });
      return;
    }
    const open = t.closest('[data-admin-event-open]');
    if (!(open instanceof HTMLElement)) return;
    const slug = open.getAttribute('data-admin-event-open') || '';
    const row = (session || []).find((event) => event.slug === slug);
    if (!row) return;
    const values = { ...row, status: statusFromSchedule(row) };
    openEventDesk({
      event: values,
      auth: opts.auth,
      root: base,
      onUnauthorized: opts.onUnauthorized,
      onEdit: (event) => {
        openEventForm({
          mode: 'edit',
          root: base,
          values: event,
          onSubmit: async (next) => commit(event.slug, await uploadImages(next)),
        });
      },
    });
  };

  paint();
}

/**
 * @param {EventFormValues} event
 * @param {string} base
 * @param {'card' | 'compact'} [layout]
 */
function rowHtml(event, base, layout = 'compact') {
  const status = EVENT_STATUS_LABELS[event.status] || event.status;
  const type = EVENT_TYPE_LABELS[event.type] || event.type;
  const when = event.startsAt ? formatWhen(event.startsAt) : 'dates TBA';
  const bits = [status, type, when];
  if (event.featured) bits.push('Featured');
  if (!getCatalogEvent(event.slug)) bits.push('Session draft');
  const view = getCatalogEvent(event.slug)
    ? `<a class="cr-btn-quiet" href="${escapeAttr(`${base}events/?e=${encodeURIComponent(event.slug)}`)}">View public</a>`
    : '';
  const image = bannerSrc(event.image, base);
  const banner = image
    ? `<span class="admin-events__banner"><img src="${escapeAttr(image)}" alt="" width="1280" height="720" draggable="false" /></span>`
    : `<span class="admin-events__banner admin-events__banner--empty" aria-hidden="true"></span>`;
  return `
    <li class="admin-events__row${layout === 'card' ? ' admin-events__row--card' : ''}">
      <button type="button" class="admin-events__open" data-admin-event-open="${escapeAttr(event.slug)}">
        ${banner}
        <span class="admin-events__row-main">
          <span class="admin-events__name">${escapeHtml(event.title)}</span>
          <span class="admin-events__meta">${escapeHtml(bits.join(' · '))}</span>
        </span>
      </button>
      <div class="admin-events__row-actions">
        ${view}
        <button type="button" class="cr-btn-quiet" data-admin-event-edit="${escapeAttr(event.slug)}">Edit</button>
      </div>
    </li>`;
}

/**
 * @param {string} local
 */
function formatWhen(local) {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return 'dates TBA';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * @param {string | null | undefined} image
 * @param {string} base
 */
function bannerSrc(image, base) {
  const path = String(image || '').trim();
  if (!path) return '';
  if (/^https?:\/\//i.test(path) || path.startsWith('/')) return path;
  return `${base}${path.replace(/^\//, '')}`;
}
