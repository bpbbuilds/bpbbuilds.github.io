/**
 * Admin Cosmetics tab — review player submissions + upload our own (shared modal).
 */

import { openCosmeticUploadModal } from '../../shared/cosmetic-upload-modal.js';
import { loadBlobCatalog } from '../u/blob/catalog.js';
import { compositeTileHtml } from '../u/blob/wardrobe-markup.js';
import {
  adminCosmeticFiltersHtml,
  adminCosmeticMatches,
  bindAdminCosmeticFilters,
  defaultAdminCosmeticFilters,
  syncAdminCosmeticFilters,
} from './cosmetics-filters.js';
import { escapeHtml } from './row.js';

/** @typedef {import('../u/blob/catalog.js').BlobCosmetic} BlobCosmetic */

const GRANTS = Object.freeze([
  { id: 'starter', label: 'Starter (everyone)' },
  { id: 'premium', label: 'Premium / Founding' },
  { id: 'founding', label: 'Founding only' },
  { id: 'event', label: 'Event grant' },
]);

/**
 * @param {string | null | undefined} grant
 */
function grantLabel(grant) {
  const g = String(grant || '').toLowerCase();
  const hit = GRANTS.find((x) => x.id === g);
  return hit ? hit.label : 'Ungated';
}

/**
 * @param {BlobCosmetic} c
 */
function grantClass(c) {
  const g = String(c.grant || (c.starter ? 'starter' : '')).toLowerCase();
  if (g === 'starter') return 'admin-cosmetics__grant--starter';
  if (g === 'premium') return 'admin-cosmetics__grant--premium';
  if (g === 'founding') return 'admin-cosmetics__grant--founding';
  if (g === 'event') return 'admin-cosmetics__grant--event';
  return '';
}

/**
 * @param {BlobCosmetic} a
 * @param {BlobCosmetic} b
 */
function sortCosmetics(a, b) {
  return String(a.name || a.id).localeCompare(String(b.name || b.id));
}

/**
 * @param {BlobCosmetic} c
 * @param {string} root
 */
function catalogRowHtml(c, root) {
  const grant = grantLabel(c.grant || (c.starter ? 'starter' : null));
  return `
    <li class="admin-cosmetics__row">
      <div class="admin-cosmetics__thumb" aria-hidden="true">${compositeTileHtml(c, root)}</div>
      <div class="admin-cosmetics__row-main">
        <p class="admin-cosmetics__name">${escapeHtml(c.name || c.id)}</p>
        <p class="admin-cosmetics__meta">
          <code class="admin-cosmetics__id">${escapeHtml(c.id)}</code>
          · ${escapeHtml(String(c.slot || '—'))}
          · ${escapeHtml(String(c.rarity || 'Common'))}
        </p>
        <p class="admin-cosmetics__grant ${grantClass(c)}">${escapeHtml(grant)}</p>
      </div>
    </li>`;
}

/**
 * @param {BlobCosmetic[]} catalog
 * @param {import('./cosmetics-filters.js').AdminCosmeticFilterState} state
 */
function matchingCosmetics(catalog, state) {
  return catalog.filter((item) => adminCosmeticMatches(item, state)).sort(sortCosmetics);
}

/**
 * @param {BlobCosmetic[]} rows
 * @param {string} root
 * @param {number} total
 */
function catalogListHtml(rows, root, total) {
  if (rows.length) return rows.map((c) => catalogRowHtml(c, root)).join('');
  const empty = total ? 'No cosmetics match these filters.' : 'Catalog is empty.';
  return `<li class="admin-empty">${empty}</li>`;
}

/**
 * @param {HTMLElement} host
 * @param {string} root
 * @param {BlobCosmetic[]} catalog
 * @param {import('./cosmetics-filters.js').AdminCosmeticFilterState} state
 */
function paintCatalog(host, root, catalog, state) {
  const rows = matchingCosmetics(catalog, state);
  const list = host.querySelector('[data-admin-cos-catalog]');
  if (list instanceof HTMLElement) list.innerHTML = catalogListHtml(rows, root, catalog.length);
  const hint = host.querySelector('[data-admin-cos-catalog-hint]');
  if (hint) hint.textContent = `${rows.length} shown · ${catalog.length} published.`;
  const rail = host.querySelector('.admin-cosmetics-filters');
  if (rail instanceof HTMLElement) syncAdminCosmeticFilters(rail, state, rows.length);
}

/**
 * @param {HTMLElement} host
 * @param {string} root
 * @param {BlobCosmetic[]} catalog
 * @param {import('./cosmetics-filters.js').AdminCosmeticFilterState} state
 */
function paintBody(host, root, catalog, state) {
  const rows = matchingCosmetics(catalog, state);
  host.innerHTML = `
    <div class="admin-cosmetics-layout">
      <div class="admin-cosmetics-col">
        <section class="admin-panel admin-cosmetics" aria-label="Cosmetics">
          <p class="admin-panel__blurb">
            Review player-submitted blob art, and upload official cosmetics for the wardrobe.
          </p>
          <section class="admin-cosmetics__section" aria-labelledby="admin-cosmetics-review-h">
      <div class="admin-cosmetics__section-head">
        <h3 class="admin-cosmetics__section-title" id="admin-cosmetics-review-h">Review submissions</h3>
        <div class="admin-cosmetics__filters" role="group" aria-label="Submission status">
          <button type="button" class="il-filter__check is-on" data-admin-cos-queue="pending" aria-pressed="true">
            <span class="il-filter__check-label">Pending</span>
          </button>
          <button type="button" class="il-filter__check" data-admin-cos-queue="approved" aria-pressed="false">
            <span class="il-filter__check-label">Approved</span>
          </button>
          <button type="button" class="il-filter__check" data-admin-cos-queue="rejected" aria-pressed="false">
            <span class="il-filter__check-label">Rejected</span>
          </button>
        </div>
      </div>
      <p class="admin-cosmetics__hint">
        Player submits from profile Blob / Inventory land here. Approve publishes into the wardrobe catalog.
      </p>
      <ul class="admin-cosmetics__list" data-admin-cos-queue-list role="list">
        <li class="admin-cosmetics__row admin-cosmetics__row--empty">
          <div class="admin-cosmetics__row-main">
            <p class="admin-cosmetics__name">No pending submissions</p>
            <p class="admin-cosmetics__meta">Queue is empty until players submit art (or you wire storage).</p>
          </div>
          <div class="admin-cosmetics__row-actions">
            <button type="button" class="cr-btn-quiet" disabled title="Coming soon">Approve</button>
            <button type="button" class="cr-btn-quiet" disabled title="Coming soon">Reject</button>
          </div>
        </li>
      </ul>
    </section>

    <section class="admin-cosmetics__section" aria-labelledby="admin-cosmetics-upload-h">
      <h3 class="admin-cosmetics__section-title" id="admin-cosmetics-upload-h">Upload ours</h3>
      <p class="admin-cosmetics__hint">
        Official Smojo cosmetics. Same form as player submit — admins can set ownership and override id.
        Pipeline writes the catalog later.
      </p>
      <button type="button" class="cr-submit is-ready" data-admin-cos-upload-open>
        Upload cosmetic
      </button>
    </section>

    <section class="admin-cosmetics__section admin-cosmetics__section--catalog" aria-labelledby="admin-cosmetics-live-h">
      <h3 class="admin-cosmetics__section-title" id="admin-cosmetics-live-h">Live catalog</h3>
      <p class="admin-cosmetics__hint" data-admin-cos-catalog-hint>${rows.length} shown · ${catalog.length} published.</p>
      <ul class="admin-cosmetics__list" data-admin-cos-catalog role="list">
        ${catalogListHtml(rows, root, catalog.length)}
      </ul>
    </section>
        </section>
      </div>
      ${adminCosmeticFiltersHtml(root, state, rows.length)}
    </div>
  `;
}

/**
 * @param {HTMLElement} rootEl
 * @param {{ root: string, displayName?: string }} opts
 */
function bindUploadButton(rootEl, opts) {
  rootEl.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const btn = t.closest('[data-admin-cos-upload-open]');
    if (!(btn instanceof HTMLElement) || !rootEl.contains(btn)) return;
    openCosmeticUploadModal({
      role: 'admin',
      displayName: opts.displayName || 'Smojo Builds',
      root: opts.root,
      onSubmit: (payload) => {
        console.info('[admin-cosmetic-upload]', {
          ...payload,
          file: payload.file.name,
          bytes: payload.file.size,
        });
      },
    });
  });
}

/**
 * @param {HTMLElement} rootEl
 */
function bindQueueFilters(rootEl) {
  const list = rootEl.querySelector('[data-admin-cos-queue-list]');
  rootEl.querySelectorAll('[data-admin-cos-queue]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!(btn instanceof HTMLElement)) return;
      const key = btn.getAttribute('data-admin-cos-queue') || 'pending';
      rootEl.querySelectorAll('[data-admin-cos-queue]').forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        const on = el === btn;
        el.classList.toggle('is-on', on);
        el.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (!(list instanceof HTMLElement)) return;
      const label =
        key === 'approved' ? 'approved' : key === 'rejected' ? 'rejected' : 'pending';
      list.innerHTML = `
        <li class="admin-cosmetics__row admin-cosmetics__row--empty">
          <div class="admin-cosmetics__row-main">
            <p class="admin-cosmetics__name">No ${escapeHtml(label)} submissions</p>
            <p class="admin-cosmetics__meta">Queue is empty until players submit art (or you wire storage).</p>
          </div>
        </li>`;
    });
  });
}

/** @type {() => void} */
let unbindCosmeticsFilters = () => {};

/**
 * @param {HTMLElement} host
 * @param {{ root: string, displayName?: string }} opts
 */
export async function mountCosmeticsPanel(host, opts) {
  const root = opts.root.endsWith('/') ? opts.root : `${opts.root}/`;
  unbindCosmeticsFilters();
  unbindCosmeticsFilters = () => {};

  host.innerHTML = `
    <section class="admin-panel admin-cosmetics" aria-label="Cosmetics">
      <p class="admin-panel__blurb">
        Review player-submitted blob art, and upload official cosmetics for the wardrobe.
      </p>
      <p class="admin-status" data-admin-cosmetics-status>Loading…</p>
    </section>`;

  const status = host.querySelector('[data-admin-cosmetics-status]');

  try {
    const catalog = await loadBlobCatalog(root);
    const filters = defaultAdminCosmeticFilters();
    paintBody(host, root, catalog, filters);
    bindUploadButton(host, {
      root,
      displayName: opts.displayName,
    });
    bindQueueFilters(host);
    const rail = host.querySelector('.admin-cosmetics-filters');
    if (rail instanceof HTMLElement) {
      unbindCosmeticsFilters = bindAdminCosmeticFilters(rail, {
        getState: () => filters,
        onChange: (next) => {
          filters.grants = next.grants;
          filters.slot = next.slot;
          filters.rarity = next.rarity;
          filters.q = next.q;
          paintCatalog(host, root, catalog, filters);
        },
      });
    }
  } catch (err) {
    console.error(err);
    if (status instanceof HTMLElement) {
      status.textContent = 'Could not load cosmetics panel.';
    }
  }
}
