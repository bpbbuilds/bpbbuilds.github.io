/**
 * Blob wardrobe UI — center preview, slot squares, inventory rail + drag-equip.
 */

import { bindCosmeticTooltips } from './cosmetic-tooltip.js';
import { cosmeticById, loadBlobCatalog, ownedCosmetics } from './catalog.js';
import { parseLoadout, setSlot } from './loadout.js';
import { saveBlobLoadout } from './save.js';
import { BLOB_WARDROBE_SLOTS, isBlobSlotId } from './slots.js';
import { fitBlobItemIcons } from './fit-item-icon.js';
import { bindFilterDrawer } from '../../../shared/filter-drawer.js';
import { openSubmitCosmeticModal } from './submit-cosmetic-modal.js';
import {
  equippedInSlot,
  filterInventory,
  inventoryGridHtml,
  libraryHtml,
  previewHtml,
  slotHtml,
} from './wardrobe-markup.js';

/** @typedef {import('./slots.js').WardrobeSlotId} WardrobeSlotId */
/** @typedef {import('./catalog.js').BlobCosmetic} BlobCosmetic */

/**
 * @param {HTMLElement} stage
 * @param {{
 *   profile: object,
 *   isSelf: boolean,
 *   root: string,
 *   onLoadoutChange?: (payload: string) => void,
 * }} ctx
 */
export async function mountBlobWardrobe(stage, ctx) {
  const { profile, isSelf, root, onLoadoutChange } = ctx;
  const canEdit = isSelf;
  const catalog = await loadBlobCatalog(root);
  const owned = ownedCosmetics(catalog, profile);
  let loadout = parseLoadout(profile.equipped_avatar);
  let filterSlot = '';
  let query = '';
  /** @type {string | null} */
  let selectedItemId = null;
  let saveTimer = 0;
  let saveBusy = false;

  stage.innerHTML = `
    <section class="blob-wardrobe${canEdit ? '' : ' is-visitor'}" aria-label="Blob wardrobe">
      <div class="blob-wardrobe__equip">
        <div class="blob-wardrobe__stage">
          <div class="blob-wardrobe__center" data-blob-center></div>
          <div class="blob-wardrobe__orbit" data-blob-orbit></div>
        </div>
        ${
          canEdit
            ? `<div class="blob-wardrobe__submit-row">
          <button type="button" class="blob-wardrobe__submit-btn" data-blob-submit-cosmetic title="Submit a cosmetic you made">
            <span>Submit cosmetic</span>
          </button>
        </div>`
            : ''
        }
      </div>
      ${libraryHtml(root, filterSlot, query, owned.length, owned.length, canEdit)}
    </section>`;

  bindFilterDrawer(stage.querySelector('.blob-wardrobe__library'));

  const orbitEl = stage.querySelector('[data-blob-orbit]');
  const centerEl = stage.querySelector('[data-blob-center]');
  const invList = stage.querySelector('[data-blob-inv-list]');
  const countEl = stage.querySelector('[data-blob-inv-count]');
  const statusEl = stage.querySelector('[data-blob-status]');
  const searchEl = stage.querySelector('[data-blob-search]');

  function setStatus(msg, kind = '') {
    if (!(statusEl instanceof HTMLElement)) return;
    if (!msg) {
      statusEl.hidden = true;
      statusEl.textContent = '';
      statusEl.className = 'blob-inv__status';
      return;
    }
    statusEl.hidden = false;
    statusEl.textContent = msg;
    statusEl.className = `blob-inv__status${kind ? ` blob-inv__status--${kind}` : ''}`;
  }

  function paintSlots() {
    if (orbitEl instanceof HTMLElement) {
      orbitEl.innerHTML = BLOB_WARDROBE_SLOTS.map((s) =>
        slotHtml(s.id, loadout, catalog, canEdit, root),
      ).join('');
      fitBlobItemIcons(orbitEl);
    }
    if (centerEl instanceof HTMLElement) {
      centerEl.innerHTML = previewHtml(profile, loadout, catalog, root);
    }
  }

  function syncFilterChrome() {
    stage.querySelectorAll('[data-blob-slot-filter]').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const v = el.getAttribute('data-blob-slot-filter') || '';
      const on = v === filterSlot;
      el.classList.toggle('is-on', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (searchEl instanceof HTMLInputElement && searchEl.value !== query) {
      searchEl.value = query;
    }
  }

  function paintInventory() {
    if (!(invList instanceof HTMLElement)) return;
    if (!canEdit) {
      const equipped = BLOB_WARDROBE_SLOTS.map((s) =>
        equippedInSlot(loadout, s.id, catalog),
      ).filter(Boolean);
      /** @type {BlobCosmetic[]} */
      const rows = /** @type {BlobCosmetic[]} */ (equipped);
      invList.innerHTML = rows.length
        ? inventoryGridHtml(rows, false, null, root)
        : `<p class="blob-inv__empty">Nothing equipped yet.</p>`;
      if (countEl instanceof HTMLElement) {
        countEl.textContent = `${rows.length} equipped`;
      }
      fitBlobItemIcons(invList);
      return;
    }
    const rows = filterInventory(owned, filterSlot, query);
    if (!rows.length) {
      invList.innerHTML = `<p class="blob-inv__empty">${
        owned.length === 0
          ? 'No cosmetics yet — starters unlock for every signed-in profile.'
          : 'No cosmetics match.'
      }</p>`;
    } else {
      invList.innerHTML = inventoryGridHtml(rows, true, selectedItemId, root);
    }
    if (countEl instanceof HTMLElement) {
      countEl.textContent =
        rows.length === owned.length
          ? `${rows.length} cosmetics`
          : `${rows.length} of ${owned.length} cosmetics`;
    }
    syncFilterChrome();
    fitBlobItemIcons(invList);
  }

  function paint() {
    paintSlots();
    paintInventory();
  }

  async function persist() {
    if (!canEdit) return;
    saveBusy = true;
    setStatus('Saving…');
    try {
      const payload = await saveBlobLoadout(loadout);
      profile.equipped_avatar = payload;
      onLoadoutChange?.(payload);
      setStatus('Saved', 'ok');
      window.setTimeout(() => setStatus(''), 1600);
    } catch (err) {
      console.error(err);
      setStatus(err instanceof Error ? err.message : 'Save failed', 'err');
    } finally {
      saveBusy = false;
    }
  }

  function queueSave() {
    if (!canEdit) return;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      if (!saveBusy) void persist();
    }, 280);
  }

  /**
   * @param {WardrobeSlotId} slot
   * @param {string | null} itemId
   */
  function equip(slot, itemId) {
    if (!canEdit) return;
    if (itemId) {
      const item = cosmeticById(catalog, itemId);
      if (!item || item.slot !== slot) {
        setStatus(`That item fits ${item?.slot || 'another'} slot`, 'err');
        return;
      }
    }
    if (!isBlobSlotId(slot)) return;
    loadout = setSlot(loadout, slot, itemId);
    selectedItemId = null;
    paint();
    queueSave();
  }

  paint();

  bindCosmeticTooltips(stage, {
    catalog,
    getEquippedId: (slotId) => {
      if (isBlobSlotId(slotId)) return loadout.slots[slotId] || null;
      return null;
    },
  });

  if (!canEdit) return;

  stage.addEventListener('input', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (t.matches('[data-blob-search]')) {
      query = t.value;
      paintInventory();
    }
  });

  stage.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;

    const submitBtn = t.closest('[data-blob-submit-cosmetic]');
    if (submitBtn instanceof HTMLElement && stage.contains(submitBtn) && canEdit) {
      openSubmitCosmeticModal({
        displayName: String(profile?.display_name || '').trim(),
        root,
      });
      return;
    }

    const resetBtn = t.closest('[data-blob-inv-reset]');
    if (resetBtn instanceof HTMLElement && stage.contains(resetBtn)) {
      filterSlot = '';
      query = '';
      selectedItemId = null;
      paintInventory();
      return;
    }

    const slotFilter = t.closest('[data-blob-slot-filter]');
    if (slotFilter instanceof HTMLElement && stage.contains(slotFilter)) {
      filterSlot = slotFilter.getAttribute('data-blob-slot-filter') || '';
      paintInventory();
      return;
    }

    const invCard = t.closest('[data-blob-item]');
    if (invCard instanceof HTMLElement && stage.contains(invCard)) {
      const id = invCard.getAttribute('data-blob-item') || '';
      selectedItemId = selectedItemId === id ? null : id;
      paintInventory();
      return;
    }

    const slotBtn = t.closest('[data-blob-slot]');
    if (slotBtn instanceof HTMLElement && stage.contains(slotBtn)) {
      const slot = /** @type {WardrobeSlotId} */ (slotBtn.getAttribute('data-blob-slot') || '');
      if (selectedItemId) {
        equip(slot, selectedItemId);
        return;
      }
      const equipped = equippedInSlot(loadout, slot, catalog);
      if (equipped) equip(slot, null);
    }
  });

  stage.addEventListener('dragstart', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const card = t.closest('[data-blob-item]');
    if (!(card instanceof HTMLElement) || !stage.contains(card)) return;
    const id = card.getAttribute('data-blob-item') || '';
    const slot = card.getAttribute('data-blob-item-slot') || '';
    e.dataTransfer?.setData('text/blob-cosmetic', id);
    e.dataTransfer?.setData('text/blob-slot', slot);
    e.dataTransfer?.setData('text/plain', id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
    card.classList.add('is-dragging');
  });

  stage.addEventListener('dragend', (e) => {
    const t = e.target;
    if (t instanceof Element) {
      t.closest('[data-blob-item]')?.classList.remove('is-dragging');
    }
  });

  stage.addEventListener('dragover', (e) => {
    const slotBtn = e.target instanceof Element ? e.target.closest('[data-blob-drop]') : null;
    if (!(slotBtn instanceof HTMLElement) || !stage.contains(slotBtn)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    slotBtn.classList.add('is-drop-target');
  });

  stage.addEventListener('dragleave', (e) => {
    const slotBtn = e.target instanceof Element ? e.target.closest('[data-blob-drop]') : null;
    if (slotBtn instanceof HTMLElement) slotBtn.classList.remove('is-drop-target');
  });

  stage.addEventListener('drop', (e) => {
    const slotBtn = e.target instanceof Element ? e.target.closest('[data-blob-drop]') : null;
    if (!(slotBtn instanceof HTMLElement) || !stage.contains(slotBtn)) return;
    e.preventDefault();
    slotBtn.classList.remove('is-drop-target');
    const slot = /** @type {WardrobeSlotId} */ (slotBtn.getAttribute('data-blob-slot') || '');
    const id =
      e.dataTransfer?.getData('text/blob-cosmetic') ||
      e.dataTransfer?.getData('text/plain') ||
      '';
    if (id) equip(slot, id);
  });
}
