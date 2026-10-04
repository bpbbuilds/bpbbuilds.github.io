/**
 * Blob wardrobe HTML helpers (slots, preview, inventory grid, library chrome).
 */

import { escapeAttr, escapeHtml } from '../html.js';
import { filterDrawerChromeHtml } from '../../../shared/filter-drawer.js';
import { cosmeticById } from './catalog.js';
import { BLOB_SLOTS, BLOB_WARDROBE_SLOTS } from './slots.js';

/** @typedef {import('./slots.js').WardrobeSlotId} WardrobeSlotId */
/** @typedef {import('./loadout.js').BlobLoadout} BlobLoadout */
/** @typedef {import('./catalog.js').BlobCosmetic} BlobCosmetic */

/** Empty-slot silhouette art (RPG sheet style). */
const SLOT_GHOST = /** @type {Readonly<Record<string, string>>} */ (
  Object.freeze({
    hat: 'helm.svg',
    face: 'face.svg',
    head: 'head.svg',
    neck: 'neck.svg',
    body: 'clothes.svg',
    hand: 'hand.svg',
  })
);

/**
 * @param {string} root
 * @param {WardrobeSlotId} slotId
 */
function slotGhostHtml(root, slotId) {
  const file = SLOT_GHOST[slotId];
  if (!file) return '';
  const base = root.endsWith('/') ? root : `${root}/`;
  return `<img class="blob-slot__ghost" src="${escapeAttr(`${base}assets/icons/blob/slots/${file}`)}" alt="" draggable="false" width="48" height="48" />`;
}

/**
 * @param {BlobLoadout} loadout
 * @param {WardrobeSlotId} slotId
 * @param {BlobCosmetic[]} catalog
 */
export function equippedInSlot(loadout, slotId, catalog) {
  return cosmeticById(catalog, loadout.slots[slotId]);
}

/**
 * Site-root path for a cosmetic image. Remote URLs stay as they are.
 * @param {string} root
 * @param {string | null | undefined} path
 */
function cosmeticAssetSrc(root, path) {
  const value = String(path || '').trim();
  if (!value) return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const base = root.endsWith('/') ? root : `${root}/`;
  return `${base}${value.replace(/^\//, '')}`;
}

export function itemIconHtml(item, root, extraClass = '') {
  if (!item) {
    return `<span class="blob-item-icon blob-item-icon--empty ${extraClass}" aria-hidden="true"></span>`;
  }
  // Always the aligned overlay (`image`) — same size/placement as Photoshop vs blob-base.
  const src = cosmeticAssetSrc(root, item.image || item.icon);
  if (src) {
    return `<img class="blob-item-icon ${extraClass}" src="${escapeAttr(src)}" alt="" draggable="false" width="64" height="64" />`;
  }
  const letter = escapeHtml((item.name || '?').slice(0, 1).toUpperCase());
  return `<span class="blob-item-icon blob-item-icon--letter ${extraClass}" style="--blob-swatch:${escapeAttr(item.swatch || '#8a5a2b')}" aria-hidden="true">${letter}</span>`;
}

/**
 * Equip preview layer — full-canvas overlay aligned to blob base.
 * @param {BlobCosmetic | null} item
 * @param {string} root
 * @param {string} [extraClass]
 */
export function compositeTileHtml(item, root, extraClass = '') {
  const base = root.endsWith('/') ? root : `${root}/`;
  const blobSrc = `${base}assets/blob/blob-base.png`;
  if (!item) {
    return `<span class="blob-tile-preview blob-tile-preview--empty ${extraClass}" aria-hidden="true"></span>`;
  }
  const overlaySrc = cosmeticAssetSrc(root, item.image);
  const overlay = overlaySrc
    ? `<img class="blob-tile-preview__layer" src="${escapeAttr(overlaySrc)}" alt="" draggable="false" />`
    : `<span class="blob-tile-preview__swatch" style="--blob-swatch:${escapeAttr(item.swatch || '#8a5a2b')}" aria-hidden="true">${escapeHtml((item.name || '?').slice(0, 1).toUpperCase())}</span>`;
  return `
    <span class="blob-tile-preview ${extraClass}" aria-hidden="true">
      <img class="blob-tile-preview__base" src="${escapeAttr(blobSrc)}" alt="" draggable="false" width="128" height="128" />
      ${overlay}
    </span>`;
}

/**
 * @param {BlobCosmetic | null} item
 * @param {string} [extraClass]
 */
export function swatchHtml(item, extraClass = '') {
  if (!item) {
    return `<span class="blob-swatch blob-swatch--empty ${extraClass}" aria-hidden="true"></span>`;
  }
  if (item.image) {
    return `<img class="blob-swatch ${extraClass}" src="${escapeAttr(item.image)}" alt="" draggable="false" />`;
  }
  const letter = escapeHtml((item.name || '?').slice(0, 1).toUpperCase());
  return `<span class="blob-swatch ${extraClass}" style="--blob-swatch:${escapeAttr(item.swatch || '#8a5a2b')}" aria-hidden="true">${letter}</span>`;
}

/**
 * @param {WardrobeSlotId} slotId
 * @param {BlobLoadout} loadout
 * @param {BlobCosmetic[]} catalog
 * @param {boolean} canEdit
 * @param {string} [root]
 */
export function slotHtml(slotId, loadout, catalog, canEdit, root = '/') {
  const def = BLOB_WARDROBE_SLOTS.find((s) => s.id === slotId);
  const item = equippedInSlot(loadout, slotId, catalog);
  const filled = Boolean(item);
  const ox = def?.orbit?.x ?? 50;
  const oy = def?.orbit?.y ?? 50;
  return `
    <button
      type="button"
      class="blob-slot blob-slot--${escapeAttr(slotId)}${filled ? ' is-filled' : ''}${canEdit ? '' : ' is-readonly'}"
      data-blob-slot="${escapeAttr(slotId)}"
      ${canEdit ? 'data-blob-drop' : ''}
      style="--blob-orbit-x:${ox}%; --blob-orbit-y:${oy}%"
      aria-label="${escapeAttr(def?.label || slotId)}${item ? `: ${item.name}` : ' (empty)'}"
      title="${escapeAttr(item ? item.name : def?.label || slotId)}"
    >
      <span class="blob-slot__cell" aria-hidden="true">
        ${slotGhostHtml(root, slotId)}
        ${filled ? itemIconHtml(item, root, 'blob-item-icon--slot') : ''}
      </span>
    </button>`;
}

/**
 * @param {object} _profile
 * @param {BlobLoadout} loadout
 * @param {BlobCosmetic[]} catalog
 * @param {string} root
 */
export function previewHtml(_profile, loadout, catalog, root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const blobSrc = `${base}assets/blob/blob-base.png`;

  const layers = BLOB_SLOTS.map((s, i) => {
    const item = cosmeticById(catalog, loadout.slots[s.id]);
    if (!item?.image) return '';
    const src = item.image.startsWith('http')
      ? item.image
      : `${base}${String(item.image).replace(/^\//, '')}`;
    return `<img
      class="blob-preview__overlay blob-preview__overlay--${escapeAttr(s.id)}"
      src="${escapeAttr(src)}"
      alt=""
      title="${escapeAttr(item.name)}"
      draggable="false"
      style="z-index:${2 + i}"
      width="256"
      height="256"
    />`;
  }).join('');

  return `
    <div class="blob-preview" data-blob-preview>
      <div class="blob-preview__stack">
        <img
          class="blob-preview__body"
          src="${escapeAttr(blobSrc)}"
          alt=""
          width="256"
          height="256"
          draggable="false"
        />
        ${layers}
      </div>
      <p class="blob-preview__caption">Blob preview · WIP base</p>
    </div>`;
}

/**
 * @param {BlobCosmetic[]} items
 * @param {string} filterSlot
 * @param {string} query
 */
export function filterInventory(items, filterSlot, query) {
  const q = query.trim().toLowerCase();
  return items.filter((c) => {
    if (filterSlot && c.slot !== filterSlot) return false;
    if (q && !c.name.toLowerCase().includes(q) && !c.id.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });
}

/**
 * @param {BlobCosmetic[]} rows
 * @param {boolean} canEdit
 * @param {string | null} selectedItemId
 * @param {string} [root]
 */
export function inventoryGridHtml(rows, canEdit, selectedItemId, root = '/') {
  if (!rows.length) {
    return `<p class="blob-inv__empty">No cosmetics match.</p>`;
  }

  return `<ul class="blob-inv__grid" role="list">${rows
    .map((c) => {
      const on = selectedItemId === c.id;
      return `
    <li class="blob-inv__cell">
      <button
        type="button"
        class="blob-inv__tile${on ? ' is-selected' : ''}"
        data-blob-item="${escapeAttr(c.id)}"
        data-blob-item-slot="${escapeAttr(c.slot)}"
        draggable="true"
        title="${escapeAttr(c.name)}"
        aria-label="${escapeAttr(c.name)}"
        aria-pressed="${on}"
        ${canEdit ? '' : 'disabled'}
      >
        ${compositeTileHtml(c, root)}
      </button>
    </li>`;
    })
    .join('')}</ul>`;
}

/**
 * @param {string} root
 * @param {string} filterSlot
 * @param {string} query
 * @param {number} shown
 * @param {number} total
 * @param {boolean} canEdit
 */
export function libraryHtml(root, filterSlot, query, shown, total, canEdit) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const countLabel =
    shown === total ? `${shown} cosmetics` : `${shown} of ${total} cosmetics`;

  const viewer = `
    <section class="blob-inv-viewer items-filters il-filter" aria-label="${canEdit ? 'Cosmetics inventory' : 'Equipped cosmetics'}">
      <div class="il-filter__head">
        <p class="il-filter__count" data-blob-inv-count>${escapeHtml(countLabel)}</p>
      </div>
      ${
        canEdit
          ? `<p class="blob-inv__hint">Drag onto a slot, or click an item then a slot. Click a filled slot to unequip.</p>`
          : `<p class="blob-inv__hint">Viewing equipped loadout only.</p>`
      }
      <div class="blob-inv__catalog" data-blob-inv-list></div>
      <p class="blob-inv__status" data-blob-status hidden></p>
    </section>`;

  if (!canEdit) {
    return `<div class="blob-wardrobe__library">${viewer}</div>`;
  }

  const slotChecks = [
    `<button type="button" class="il-filter__check${!filterSlot ? ' is-on' : ''}" data-blob-slot-filter="" aria-pressed="${!filterSlot}">
      <span class="il-filter__box" aria-hidden="true"></span>
      <span class="il-filter__check-label">All slots</span>
    </button>`,
    ...BLOB_WARDROBE_SLOTS.map((s) => {
      const on = filterSlot === s.id;
      return `<button type="button" class="il-filter__check${on ? ' is-on' : ''}" data-blob-slot-filter="${escapeAttr(s.id)}" aria-pressed="${on}">
      <span class="il-filter__box" aria-hidden="true"></span>
      <span class="il-filter__check-label">${escapeHtml(s.label)}</span>
    </button>`;
    }),
  ].join('');

  const filters = `
    <aside
      id="blob-inv-filters"
      class="blob-inv-filters items-filters il-filter bpb-filter-drawer__panel"
      aria-label="Filter cosmetics"
      data-blob-filters
    >
      <div class="il-filter__head">
        <button type="button" class="bpb-filter-drawer__close" data-bpb-filter-close aria-label="Close filters">
          <span class="bpb-filter-drawer__close-icon" aria-hidden="true"></span>
        </button>
        <p class="blob-inv-filters__title il-filter__sticker">Filter</p>
        <button type="button" class="il-filter__reset" data-blob-inv-reset title="Reset filters" aria-label="Reset filters">
          <img src="${escapeAttr(base)}assets/icons/filters/ResetButton.png" alt="" draggable="false" />
        </button>
      </div>

      <div class="il-filter__search-row">
        <label class="il-filter__shade il-filter__search">
          <input
            type="search"
            class="il-filter__input"
            data-blob-search
            placeholder="Search…"
            autocomplete="off"
            aria-label="Search cosmetics"
            value="${escapeAttr(query)}"
          />
        </label>
      </div>

      <div class="il-filter__shade">
        <p class="il-filter__sticker">Slot</p>
        <div class="il-filter__checks blob-inv__slot-checks" role="group" aria-label="Filter by slot">
          ${slotChecks}
        </div>
      </div>
    </aside>`;

  return `<div class="blob-wardrobe__library bpb-filter-drawer">${viewer}
    ${filterDrawerChromeHtml('blob-inv-filters')}
    ${filters}</div>`;
}
