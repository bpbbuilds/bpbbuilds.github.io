/**
 * Profile hub — Inventory tab (owned blob cosmetics).
 * Equip lives on the Blob tab; this is browse + filter.
 */

import { escapeAttr, escapeHtml } from './html.js';
import { bindCosmeticTooltips } from './blob/cosmetic-tooltip.js';
import { loadBlobCatalog, ownedCosmetics } from './blob/catalog.js';
import { fitBlobItemIcons } from './blob/fit-item-icon.js';
import { BLOB_WARDROBE_SLOTS } from './blob/slots.js';
import { compositeTileHtml, itemIconHtml } from './blob/wardrobe-markup.js';
import { openSubmitCosmeticModal } from './blob/submit-cosmetic-modal.js';
import { bindFilterDrawer, filterDrawerChromeHtml } from '../../shared/filter-drawer.js';

/** @typedef {import('./blob/catalog.js').BlobCosmetic} BlobCosmetic */

const INV_GRID_COLS = 15;
const INV_GRID_MIN_ROWS = 5;

/**
 * @param {BlobCosmetic} c
 * @param {string} root
 * @param {{ showBlob?: boolean }} [opts]
 */
function tileHtml(c, root, opts = {}) {
  const showBlob = opts.showBlob !== false;
  const art = showBlob
    ? compositeTileHtml(c, root)
    : itemIconHtml(c, root, 'blob-item-icon--inv');
  return `
    <li class="profile-inv__cell">
      <button
        type="button"
        class="profile-inv__tile profile-inv__tile--part${showBlob ? '' : ' profile-inv__tile--item-only'}"
        data-inv-item="${escapeAttr(c.id)}"
        data-blob-item="${escapeAttr(c.id)}"
        title="${escapeAttr(c.name)}"
        aria-label="${escapeAttr(c.name)}"
        tabindex="-1"
      >
        ${art}
      </button>
    </li>`;
}

function emptyTileHtml() {
  return `
    <li class="profile-inv__cell profile-inv__cell--empty" aria-hidden="true">
      <span class="profile-inv__tile profile-inv__tile--empty"></span>
    </li>`;
}

/**
 * Pad with empty pouch slots only up to the starter grid (5×5).
 * Once owned items fill that, no more empties — the grid grows with items.
 * @param {number} filled
 */
function emptyPadCount(filled) {
  const minCells = INV_GRID_COLS * INV_GRID_MIN_ROWS;
  if (filled <= 0) return minCells;
  return Math.max(0, minCells - filled);
}

/**
 * @param {BlobCosmetic[]} rows
 * @param {{ emptyHint?: string, root?: string, showBlob?: boolean }} [opts]
 */
function gridHtml(rows, { emptyHint, root = '/', showBlob = true } = {}) {
  const cells = rows.map((item) => tileHtml(item, root, { showBlob }));
  const pad = emptyPadCount(rows.length);
  for (let i = 0; i < pad; i++) cells.push(emptyTileHtml());
  const hint =
    rows.length === 0 && emptyHint
      ? `<p class="profile-inv__empty">${escapeHtml(emptyHint)}</p>`
      : '';
  return `${hint}<ul class="profile-inv__grid" role="list">${cells.join('')}</ul>`;
}

/**
 * @param {BlobCosmetic[]} rows
 * @param {{ slot: string, query: string }} filters
 */
function filterRows(rows, filters) {
  const q = filters.query.trim().toLowerCase();
  return rows.filter((item) => {
    if (filters.slot && item.slot !== filters.slot) return false;
    if (
      q &&
      !item.name.toLowerCase().includes(q) &&
      !item.id.toLowerCase().includes(q)
    ) {
      return false;
    }
    return true;
  });
}

/**
 * @param {string} root
 * @param {{ slot: string, query: string, showBlob: boolean }} filters
 */
function filtersAsideHtml(root, filters) {
  const base = root.endsWith('/') ? root : `${root}/`;

  const slotChecks = [
    `<button type="button" class="il-filter__check${!filters.slot ? ' is-on' : ''}" data-inv-slot-filter="" aria-pressed="${!filters.slot}">
      <span class="il-filter__box" aria-hidden="true"></span>
      <span class="il-filter__check-label">All slots</span>
    </button>`,
    ...BLOB_WARDROBE_SLOTS.map((s) => {
      const on = filters.slot === s.id;
      return `<button type="button" class="il-filter__check${on ? ' is-on' : ''}" data-inv-slot-filter="${escapeAttr(s.id)}" aria-pressed="${on}">
      <span class="il-filter__box" aria-hidden="true"></span>
      <span class="il-filter__check-label">${escapeHtml(s.label)}</span>
    </button>`;
    }),
  ].join('');

  return `
    <aside
      id="profile-inv-filters"
      class="profile-inv-filters items-filters il-filter bpb-filter-drawer__panel"
      aria-label="Filter inventory"
      data-inv-filters
    >
      <div class="il-filter__head">
        <button type="button" class="bpb-filter-drawer__close" data-bpb-filter-close aria-label="Close filters">
          <span class="bpb-filter-drawer__close-icon" aria-hidden="true"></span>
        </button>
        <p class="profile-inv-filters__title il-filter__sticker">Filter</p>
        <button type="button" class="il-filter__reset" data-inv-reset title="Reset filters" aria-label="Reset filters">
          <img src="${escapeAttr(base)}assets/icons/filters/ResetButton.png" alt="" draggable="false" />
        </button>
      </div>

      <div class="il-filter__search-row">
        <label class="il-filter__shade il-filter__search">
          <input
            type="search"
            class="il-filter__input"
            data-inv-search
            placeholder="Search…"
            autocomplete="off"
            aria-label="Search inventory"
            value="${escapeAttr(filters.query)}"
          />
        </label>
      </div>

      <div class="il-filter__shade">
        <p class="il-filter__sticker">View</p>
        <div class="il-filter__checks profile-inv__view-checks" role="group" aria-label="Thumbnail view">
          <button
            type="button"
            class="il-filter__check${filters.showBlob ? ' is-on' : ''}"
            data-inv-blob-view
            aria-pressed="${filters.showBlob ? 'true' : 'false'}"
          >
            <span class="il-filter__box" aria-hidden="true"></span>
            <span class="il-filter__check-label">Blob</span>
          </button>
        </div>
      </div>

      <div class="il-filter__shade">
        <p class="il-filter__sticker">Slot</p>
        <div class="il-filter__checks profile-inv__slot-checks" role="group" aria-label="Filter by slot">
          ${slotChecks}
        </div>
      </div>
    </aside>`;
}

/**
 * @param {HTMLElement} stage
 * @param {{
 *   profile: object,
 *   isSelf: boolean,
 *   root: string,
 * }} ctx
 */
export async function mountInventoryTab(stage, ctx) {
  const { profile, isSelf, root } = ctx;
  const canEdit = isSelf;
  stage.innerHTML = `<p class="build-status">Loading inventory…</p>`;

  let catalog;
  try {
    catalog = await loadBlobCatalog(root);
  } catch (err) {
    console.error(err);
    stage.innerHTML = `<p class="build-status">Could not load inventory.</p>`;
    return;
  }

  const allRows = ownedCosmetics(catalog, profile);
  let filterSlot = '';
  let query = '';
  let showBlob = true;

  function filteredRows() {
    return filterRows(allRows, { slot: filterSlot, query });
  }

  function syncViewChrome() {
    const btn = stage.querySelector('[data-inv-blob-view]');
    if (!(btn instanceof HTMLElement)) return;
    btn.classList.toggle('is-on', showBlob);
    btn.setAttribute('aria-pressed', showBlob ? 'true' : 'false');
  }

  function paintCatalog() {
    const list = stage.querySelector('[data-inv-list]');
    const countEl = stage.querySelector('[data-inv-count]');
    if (!(list instanceof HTMLElement)) {
      paint();
      return;
    }
    const shown = filteredRows();
    const emptyHint =
      allRows.length === 0
        ? canEdit
          ? 'No cosmetics yet — starters unlock for every signed-in profile.'
          : 'No cosmetics owned.'
        : 'No items match.';
    list.innerHTML = gridHtml(shown, { emptyHint, root, showBlob });
    if (countEl instanceof HTMLElement) {
      countEl.textContent =
        shown.length === allRows.length
          ? `${shown.length} items`
          : `${shown.length} of ${allRows.length} items`;
    }
    stage.querySelectorAll('[data-inv-slot-filter]').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const v = el.getAttribute('data-inv-slot-filter') || '';
      const on = v === filterSlot;
      el.classList.toggle('is-on', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    syncViewChrome();
    if (!showBlob) fitBlobItemIcons(list);
    bindCosmeticTooltips(stage, { catalog, showOriginalOwner: true });
  }

  function paint() {
    const shown = filteredRows();
    const countLabel =
      shown.length === allRows.length
        ? `${shown.length} items`
        : `${shown.length} of ${allRows.length} items`;
    const emptyHint =
      allRows.length === 0
        ? canEdit
          ? 'No cosmetics yet — starters unlock for every signed-in profile.'
          : 'No cosmetics owned.'
        : 'No items match.';

    stage.innerHTML = `
      <section class="profile-inv" aria-label="Inventory">
        <div class="profile-inv__body bpb-filter-drawer">
          <section class="profile-inv__viewer items-filters il-filter" aria-label="Inventory items">
            <div class="il-filter__head">
              <p class="il-filter__count" data-inv-count>${escapeHtml(countLabel)}</p>
            </div>
            ${
              canEdit
                ? `<div class="profile-inv__submit-row">
              <button type="button" class="profile-inv__submit-btn" data-inv-submit-cosmetic title="Submit a cosmetic you made">
                <span>Submit cosmetic</span>
              </button>
            </div>
            <p class="profile-inv__hint">Equip cosmetics on the <a class="profile-inv__link" href="?tab=blob">Blob</a> tab.</p>`
                : `<p class="profile-inv__hint">Viewing this player’s owned cosmetics.</p>`
            }
            <div class="profile-inv__catalog" data-inv-list>
              ${gridHtml(shown, { emptyHint, root, showBlob })}
            </div>
          </section>
          ${filterDrawerChromeHtml('profile-inv-filters')}
          ${filtersAsideHtml(root, { slot: filterSlot, query, showBlob })}
        </div>
      </section>`;

    if (!showBlob) {
      const list = stage.querySelector('[data-inv-list]');
      if (list) fitBlobItemIcons(list);
    }
    bindCosmeticTooltips(stage, { catalog, showOriginalOwner: true });
    bindFilterDrawer(stage.querySelector('.profile-inv__body'));
  }

  paint();

  stage.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;

    const submitBtn = t.closest('[data-inv-submit-cosmetic]');
    if (submitBtn instanceof HTMLElement && stage.contains(submitBtn) && canEdit) {
      openSubmitCosmeticModal({
        displayName: String(profile?.display_name || '').trim(),
        root,
      });
      return;
    }

    const resetBtn = t.closest('[data-inv-reset]');
    if (resetBtn instanceof HTMLElement && stage.contains(resetBtn)) {
      filterSlot = '';
      query = '';
      showBlob = true;
      const search = stage.querySelector('[data-inv-search]');
      if (search instanceof HTMLInputElement) search.value = '';
      paintCatalog();
      return;
    }

    const blobViewBtn = t.closest('[data-inv-blob-view]');
    if (blobViewBtn instanceof HTMLElement && stage.contains(blobViewBtn)) {
      showBlob = !showBlob;
      paintCatalog();
      return;
    }

    const slotFilter = t.closest('[data-inv-slot-filter]');
    if (slotFilter instanceof HTMLElement && stage.contains(slotFilter)) {
      filterSlot = slotFilter.getAttribute('data-inv-slot-filter') || '';
      paintCatalog();
    }
  });

  stage.addEventListener('input', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !t.matches('[data-inv-search]')) return;
    query = t.value;
    paintCatalog();
  });
}
