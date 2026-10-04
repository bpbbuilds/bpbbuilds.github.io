/**
 * Admin Cosmetics tab — review player submissions + upload our own (shared modal).
 */

import { getSession } from '../../shared/auth.js';
import { openCosmeticUploadModal } from '../../shared/cosmetic-upload-modal.js';
import { loadBlobCatalog } from '../u/blob/catalog.js';
import { bindCosmeticTooltips } from '../u/blob/cosmetic-tooltip.js';
import { compositeTileHtml } from '../u/blob/wardrobe-markup.js';
import {
  adminCosmeticFiltersHtml,
  adminCosmeticMatches,
  bindAdminCosmeticFilters,
  defaultAdminCosmeticFilters,
  syncAdminCosmeticFilters,
} from './cosmetics-filters.js';
import { escapeHtml } from './row.js';
import {
  listCosmeticCatalog,
  listPublishedCosmetics,
  publishCosmetic,
  resolveAdminAuth,
  uploadCosmetic,
} from './api.js';

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
function catalogRowHtml(c, root, published) {
  const grant = grantLabel(c.grant || (c.starter ? 'starter' : null));
  return `
    <li class="admin-cosmetics__row">
      <div class="admin-cosmetics__thumb" data-blob-item="${escapeHtml(c.id)}" aria-label="${escapeHtml(c.name || c.id)}">${compositeTileHtml(c, root)}</div>
      <div class="admin-cosmetics__row-main">
        <p class="admin-cosmetics__name">${escapeHtml(c.name || c.id)}</p>
        <p class="admin-cosmetics__meta">
          <code class="admin-cosmetics__id">${escapeHtml(c.id)}</code>
          · ${escapeHtml(String(c.slot || '—'))}
          · ${escapeHtml(String(c.rarity || 'Common'))}
        </p>
        <p class="admin-cosmetics__grant ${grantClass(c)}">${escapeHtml(grant)}</p>
      </div>
      <div class="admin-cosmetics__row-actions">
        <button
          type="button"
          class="cr-btn-quiet"
          data-admin-cos-publish="${escapeHtml(c.id)}"
          ${published ? 'disabled' : ''}
        >${published ? 'Published' : 'Publish'}</button>
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
function catalogListHtml(rows, root, total, published) {
  if (rows.length) return rows.map((c) => catalogRowHtml(c, root, published.has(c.id))).join('');
  const empty = total ? 'No cosmetics match these filters.' : 'Catalog is empty.';
  return `<li class="admin-empty">${empty}</li>`;
}

/**
 * @param {HTMLElement} host
 * @param {string} root
 * @param {BlobCosmetic[]} catalog
 * @param {import('./cosmetics-filters.js').AdminCosmeticFilterState} state
 */
function paintCatalog(host, root, catalog, state, published) {
  const rows = matchingCosmetics(catalog, state);
  const list = host.querySelector('[data-admin-cos-catalog]');
  if (list instanceof HTMLElement) list.innerHTML = catalogListHtml(rows, root, catalog.length, published);
  const hint = host.querySelector('[data-admin-cos-catalog-hint]');
  if (hint) hint.textContent = `${rows.length} shown · ${catalog.length} in the catalog.`;
  const rail = host.querySelector('.admin-cosmetics-filters');
  if (rail instanceof HTMLElement) syncAdminCosmeticFilters(rail, state, rows.length);
}

/**
 * @param {HTMLElement} host
 * @param {string} root
 * @param {BlobCosmetic[]} catalog
 * @param {import('./cosmetics-filters.js').AdminCosmeticFilterState} state
 */
function paintBody(host, root, catalog, state, published) {
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
        Official Smojo cosmetics. Upload saves a draft to the live catalog; Publish makes it public and announces it through the cosmetic drops channel.
      </p>
      <button type="button" class="cr-submit is-ready" data-admin-cos-upload-open>
        Upload cosmetic
      </button>
    </section>

    <section class="admin-cosmetics__section admin-cosmetics__section--catalog" aria-labelledby="admin-cosmetics-live-h">
      <h3 class="admin-cosmetics__section-title" id="admin-cosmetics-live-h">Live catalog</h3>
      <p class="admin-cosmetics__hint" data-admin-cos-catalog-hint>${rows.length} shown · ${catalog.length} in the catalog.</p>
      <p class="admin-status" data-admin-cos-publish-status hidden></p>
      <ul class="admin-cosmetics__list" data-admin-cos-catalog role="list">
        ${catalogListHtml(rows, root, catalog.length, published)}
      </ul>
    </section>
        </section>
      </div>
      ${adminCosmeticFiltersHtml(root, state, rows.length)}
    </div>
  `;
}

/** @param {File} file @returns {Promise<string>} */
function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const value = String(reader.result || '');
      if (!value.startsWith('data:image/')) reject(new Error('Choose a PNG or WebP image.'));
      else resolve(value);
    });
    reader.addEventListener('error', () => reject(new Error('Could not read the cosmetic image.')));
    reader.readAsDataURL(file);
  });
}

/**
 * Merge owner catalog rows without discarding the static catalog fallback.
 * @param {BlobCosmetic[]} catalog
 * @param {any[]} rows
 */
function mergeCatalogRows(catalog, rows) {
  for (const raw of rows) {
    const id = String(raw?.id || '').trim();
    if (!id) continue;
    const existing = catalog.find((item) => item.id === id);
    const item = {
      ...(existing || {}),
      id,
      name: String(raw?.name || existing?.name || id),
      slot: String(raw?.slot || existing?.slot || 'hat'),
      kind: 'part',
      starter: raw?.starter === true || existing?.starter === true,
      grant: String(raw?.grant || existing?.grant || '').trim() || null,
      swatch: String(raw?.swatch || existing?.swatch || '#8a5a2b'),
      image: String(raw?.image || existing?.image || ''),
      icon: String(raw?.icon || raw?.image || existing?.icon || existing?.image || ''),
      rarity: String(raw?.rarity || existing?.rarity || 'Common'),
      cost: raw?.cost == null ? (existing?.cost ?? null) : Number(raw.cost),
      description: String(raw?.description || existing?.description || ''),
      owner: String(raw?.owner || existing?.owner || ''),
      artist: String(raw?.artist || existing?.artist || ''),
      added: String(raw?.added || existing?.added || ''),
    };
    if (existing) Object.assign(existing, item);
    else catalog.push(/** @type {BlobCosmetic} */ (item));
  }
}

/**
 * @param {HTMLElement} rootEl
 * @param {{ root: string, displayName?: string, auth?: { mode: 'jwt', token: string }, catalog: BlobCosmetic[], state: import('./cosmetics-filters.js').AdminCosmeticFilterState, published: Set<string> }} opts
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
      onSubmit: async (payload) => {
        if (!opts.auth?.token) throw new Error('Sign in as the site owner to save a cosmetic.');
        const imageData = await fileAsDataUrl(payload.file);
        const result = await uploadCosmetic(opts.auth, {
          id: payload.id,
          name: payload.name,
          slot: payload.slot,
          grant: payload.grant,
          rarity: payload.rarity,
          artist: payload.artist,
          description: payload.description,
          imageData,
        });
        const item = result?.cosmetic;
        if (!item?.id) throw new Error('The cosmetic was not returned by the server.');
        mergeCatalogRows(opts.catalog, [item]);
        paintCatalog(rootEl, opts.root, opts.catalog, opts.state, opts.published);
      },
    });
  });
}

/**
 * @param {HTMLElement} rootEl
 */
/**
 * @param {HTMLElement} host
 * @param {BlobCosmetic[]} catalog
 * @param {Set<string>} published
 */
function bindPublish(host, catalog, published, auth) {
  host.addEventListener('click', async (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const btn = t.closest('[data-admin-cos-publish]');
    if (!(btn instanceof HTMLButtonElement) || !host.contains(btn) || btn.disabled) return;
    const id = btn.getAttribute('data-admin-cos-publish') || '';
    const item = catalog.find((row) => row.id === id);
    const status = host.querySelector('[data-admin-cos-publish-status]');
    if (!item) return;
    btn.disabled = true;
    btn.textContent = 'Publishing…';
    if (status instanceof HTMLElement) {
      status.hidden = false;
      status.textContent = `Publishing ${item.name || item.id}…`;
    }
    try {
      const session = await getSession();
      // The shell's auth object can outlive a refreshed Supabase session while
      // an admin is reviewing a draft. Resolve the current owner JWT at the
      // point of publish so we do not reject an owner with a stale token.
      const liveAuth = await resolveAdminAuth();
      if (!session?.access_token || liveAuth?.mode !== 'jwt') {
        throw new Error('Sign in as the site owner to publish.');
      }
      await publishCosmetic(liveAuth, {
        id: item.id,
        name: item.name || item.id,
        slot: item.slot || '',
        rarity: item.rarity || '',
        grant: item.grant || (item.starter ? 'starter' : ''),
        description: item.description || '',
        image: item.image || '',
      });
      published.add(item.id);
      btn.textContent = 'Published';
      if (status instanceof HTMLElement) {
        status.textContent = `${item.name || item.id} will show in Cosmetic drops.`;
      }
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Publish';
      const message = err instanceof Error ? err.message : 'Publish failed';
      if (status instanceof HTMLElement) {
        status.hidden = false;
        status.textContent = message;
      }
    }
  });
}

/**
 * @returns {Promise<Set<string>>}
 */
async function loadPublishedIds(auth) {
  const ids = new Set();
  try {
    const session = await getSession();
    if (!session?.access_token) return ids;
    const result = await listPublishedCosmetics(auth);
    const data = Array.isArray(result?.ids) ? result.ids : [];
    for (const value of data) {
      const id = String(value || '');
      if (id) ids.add(id);
    }
  } catch {
    /* catalog still renders */
  }
  return ids;
}

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

/** @type {() => void} */
let unbindCosTips = () => {};

/**
 * @param {HTMLElement} host
 * @param {{ root: string, displayName?: string, auth?: { mode: 'jwt' | 'secret', token: string } }} opts
 */
export async function mountCosmeticsPanel(host, opts) {
  const root = opts.root.endsWith('/') ? opts.root : `${opts.root}/`;
  unbindCosmeticsFilters();
  unbindCosmeticsFilters = () => {};
  unbindCosTips();
  unbindCosTips = () => {};

  host.innerHTML = `
    <section class="admin-panel admin-cosmetics" aria-label="Cosmetics">
      <p class="admin-panel__blurb">
        Review player-submitted blob art, and upload official cosmetics for the wardrobe.
      </p>
      <p class="admin-status" data-admin-cosmetics-status>Loading…</p>
    </section>`;

  const status = host.querySelector('[data-admin-cosmetics-status]');

  try {
    const catalog = [...(await loadBlobCatalog(root))];
    try {
      const ownerCatalog = await listCosmeticCatalog(opts.auth);
      mergeCatalogRows(catalog, Array.isArray(ownerCatalog?.items) ? ownerCatalog.items : []);
    } catch {
      /* static catalog remains available if the owner catalog is unavailable */
    }
    const published = await loadPublishedIds(opts.auth);
    const filters = defaultAdminCosmeticFilters();
    paintBody(host, root, catalog, filters, published);
    const tips = bindCosmeticTooltips(host, { catalog });
    unbindCosTips = () => tips.destroy();
    bindUploadButton(host, {
      root,
      displayName: opts.displayName,
      auth: opts.auth,
      catalog,
      state: filters,
      published,
    });
    bindPublish(host, catalog, published, opts.auth);
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
          paintCatalog(host, root, catalog, filters, published);
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
