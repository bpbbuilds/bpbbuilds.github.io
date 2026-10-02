/**
 * Admin Cosmetics filter rail — same Item Library panel as Events and Builds.
 */

/** @typedef {import('../u/blob/slots.js').BlobSlotId} BlobSlotId */
/** @typedef {import('../u/blob/catalog.js').BlobCosmetic} BlobCosmetic */
/** @typedef {'starter' | 'premium' | 'founding' | 'event' | 'ungated'} CosmeticGrantFilter */
/** @typedef {{ grants: CosmeticGrantFilter[], slot: BlobSlotId | null, rarity: string | null, q: string }} AdminCosmeticFilterState */

import { BLOB_SLOTS } from '../u/blob/slots.js';

/** @type {readonly CosmeticGrantFilter[]} */
export const COSMETIC_GRANTS = Object.freeze(['starter', 'premium', 'founding', 'event', 'ungated']);

/** @type {Readonly<Record<CosmeticGrantFilter, string>>} */
const GRANT_LABELS = Object.freeze({
  starter: 'Starter (everyone)',
  premium: 'Premium / Founding',
  founding: 'Founding only',
  event: 'Event grant',
  ungated: 'Ungated',
});

/** @type {readonly string[]} */
export const COSMETIC_RARITIES = Object.freeze(['Common', 'Rare', 'Legendary', 'Godly', 'Unique']);

/** @returns {AdminCosmeticFilterState} */
export function defaultAdminCosmeticFilters() {
  return {
    grants: COSMETIC_GRANTS.slice(),
    slot: null,
    rarity: null,
    q: '',
  };
}

/**
 * @param {CosmeticGrantFilter[]} current
 * @param {CosmeticGrantFilter} clicked
 */
function toggleGrant(current, clicked) {
  if (!COSMETIC_GRANTS.includes(clicked)) return current.slice();
  const allOn = current.length === COSMETIC_GRANTS.length;
  if (allOn) return [clicked];
  if (current.includes(clicked)) {
    const next = current.filter((id) => id !== clicked);
    return next.length ? next : COSMETIC_GRANTS.slice();
  }
  return [...current, clicked];
}

/**
 * @param {BlobCosmetic} item
 * @returns {CosmeticGrantFilter}
 */
function grantId(item) {
  const raw = String(item.grant || (item.starter ? 'starter' : '')).toLowerCase();
  if (COSMETIC_GRANTS.includes(/** @type {CosmeticGrantFilter} */ (raw))) {
    return /** @type {CosmeticGrantFilter} */ (raw);
  }
  return 'ungated';
}

/**
 * @param {BlobSlotId | null} slot
 */
function slotLabel(slot) {
  if (!slot) return 'All slots';
  return BLOB_SLOTS.find((s) => s.id === slot)?.label || 'All slots';
}

/**
 * @param {string | null} rarity
 */
function rarityLabel(rarity) {
  return rarity || 'All rarities';
}

/**
 * @param {BlobCosmetic} item
 * @param {AdminCosmeticFilterState} state
 */
export function adminCosmeticMatches(item, state) {
  if (state.slot && item.slot !== state.slot) return false;
  const rarity = String(item.rarity || 'Common');
  if (state.rarity && rarity !== state.rarity) return false;
  if (state.grants.length && !state.grants.includes(grantId(item))) return false;
  const q = String(state.q || '').trim().toLowerCase();
  if (!q) return true;
  const hay = [item.name, item.id, item.slot, slotLabel(item.slot), rarity, GRANT_LABELS[grantId(item)]]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

/**
 * @param {string} root
 * @param {AdminCosmeticFilterState} state
 * @param {number} shown
 */
export function adminCosmeticFiltersHtml(root, state, shown) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const countLabel = shown === 1 ? '1 cosmetic shown.' : `${shown} cosmetics shown.`;

  const grantBtns = COSMETIC_GRANTS.map((id) => {
    const on = state.grants.includes(id);
    return `<button type="button" class="il-filter__check${on ? ' is-on' : ''}" data-admin-cos-filter-grant="${id}" aria-pressed="${on}">
      <span class="il-filter__box" aria-hidden="true"></span>
      <span class="il-filter__check-label">${escapeHtml(GRANT_LABELS[id])}</span>
    </button>`;
  }).join('');

  const slotOptions = [
    `<button type="button" class="il-filter__group-option${!state.slot ? ' is-active' : ''}" data-admin-cos-filter-slot="" role="option" aria-selected="${!state.slot}">All slots</button>`,
    ...BLOB_SLOTS.map((slot) => {
      const on = state.slot === slot.id;
      return `<button type="button" class="il-filter__group-option${on ? ' is-active' : ''}" data-admin-cos-filter-slot="${slot.id}" role="option" aria-selected="${on}">${escapeHtml(slot.label)}</button>`;
    }),
  ].join('');

  const rarityOptions = [
    `<button type="button" class="il-filter__group-option${!state.rarity ? ' is-active' : ''}" data-admin-cos-filter-rarity="" role="option" aria-selected="${!state.rarity}">All rarities</button>`,
    ...COSMETIC_RARITIES.map((rarity) => {
      const on = state.rarity === rarity;
      return `<button type="button" class="il-filter__group-option${on ? ' is-active' : ''}" data-admin-cos-filter-rarity="${escapeAttr(rarity)}" role="option" aria-selected="${on}">${escapeHtml(rarity)}</button>`;
    }),
  ].join('');

  return `
    <aside class="items-filters il-filter admin-cosmetics-filters" aria-label="Filter cosmetics">
      <div class="il-filter__head">
        <p class="il-filter__count" data-admin-cos-filter-count>${escapeHtml(countLabel)}</p>
        <button type="button" class="il-filter__reset" data-admin-cos-filter-reset title="Reset filters" aria-label="Reset filters">
          <img src="${escapeAttr(base)}assets/icons/filters/ResetButton.png" alt="" draggable="false" />
        </button>
      </div>
      <div class="il-filter__shade">
        <label class="cr-label" for="admin-cosmetics-search">Search</label>
        <input
          id="admin-cosmetics-search"
          class="cr-input"
          type="search"
          data-admin-cos-filter-search
          placeholder="Name or id…"
          value="${escapeAttr(state.q)}"
          autocomplete="off"
        />
      </div>
      <div class="il-filter__shade admin-cosmetics-filters__menus">
        <div class="il-filter__grouping" data-admin-cos-filter-slot-root>
          <button type="button" class="il-filter__group-trigger" data-admin-cos-filter-slot-trigger aria-haspopup="listbox" aria-expanded="false">
            <img class="il-filter__group-arrow" src="${escapeAttr(base)}assets/icons/filters/DropdownArrow.png" alt="" draggable="false" />
            <span class="il-filter__sticker" data-admin-cos-filter-slot-label>${escapeHtml(slotLabel(state.slot))}</span>
          </button>
          <div class="il-filter__group-menu" data-admin-cos-filter-slot-menu hidden role="listbox" aria-label="Slot">
            ${slotOptions}
          </div>
        </div>
        <div class="il-filter__grouping" data-admin-cos-filter-rarity-root>
          <button type="button" class="il-filter__group-trigger" data-admin-cos-filter-rarity-trigger aria-haspopup="listbox" aria-expanded="false">
            <img class="il-filter__group-arrow" src="${escapeAttr(base)}assets/icons/filters/DropdownArrow.png" alt="" draggable="false" />
            <span class="il-filter__sticker" data-admin-cos-filter-rarity-label>${escapeHtml(rarityLabel(state.rarity))}</span>
          </button>
          <div class="il-filter__group-menu" data-admin-cos-filter-rarity-menu hidden role="listbox" aria-label="Rarity">
            ${rarityOptions}
          </div>
        </div>
      </div>
      <div class="il-filter__shade">
        <p class="cr-label">Grant</p>
        <div class="il-filter__checks" role="group" aria-label="Grant">
          ${grantBtns}
        </div>
      </div>
    </aside>`;
}

/**
 * @param {HTMLElement} rail
 * @param {AdminCosmeticFilterState} state
 * @param {number} shown
 */
export function syncAdminCosmeticFilters(rail, state, shown) {
  const count = rail.querySelector('[data-admin-cos-filter-count]');
  if (count) count.textContent = shown === 1 ? '1 cosmetic shown.' : `${shown} cosmetics shown.`;
  const slotLabelEl = rail.querySelector('[data-admin-cos-filter-slot-label]');
  if (slotLabelEl) slotLabelEl.textContent = slotLabel(state.slot);
  const rarityLabelEl = rail.querySelector('[data-admin-cos-filter-rarity-label]');
  if (rarityLabelEl) rarityLabelEl.textContent = rarityLabel(state.rarity);
  rail.querySelectorAll('[data-admin-cos-filter-slot]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const raw = el.getAttribute('data-admin-cos-filter-slot') || '';
    const on = raw === '' ? !state.slot : state.slot === raw;
    el.classList.toggle('is-active', on);
    el.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  rail.querySelectorAll('[data-admin-cos-filter-rarity]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const raw = el.getAttribute('data-admin-cos-filter-rarity') || '';
    const on = raw === '' ? !state.rarity : state.rarity === raw;
    el.classList.toggle('is-active', on);
    el.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  rail.querySelectorAll('[data-admin-cos-filter-grant]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const id = /** @type {CosmeticGrantFilter} */ (el.getAttribute('data-admin-cos-filter-grant'));
    const on = state.grants.includes(id);
    el.classList.toggle('is-on', on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  const search = rail.querySelector('[data-admin-cos-filter-search]');
  if (search instanceof HTMLInputElement && search.value !== state.q) search.value = state.q;
}

/**
 * @param {HTMLElement} rail
 * @param {{
 *   getState: () => AdminCosmeticFilterState,
 *   onChange: (next: AdminCosmeticFilterState) => void,
 * }} opts
 * @returns {() => void}
 */
export function bindAdminCosmeticFilters(rail, opts) {
  /** @type {{ root: Element | null, trigger: Element | null, menu: Element | null, kind: 'slot' | 'rarity' }[]} */
  const menus = [
    {
      kind: 'slot',
      root: rail.querySelector('[data-admin-cos-filter-slot-root]'),
      trigger: rail.querySelector('[data-admin-cos-filter-slot-trigger]'),
      menu: rail.querySelector('[data-admin-cos-filter-slot-menu]'),
    },
    {
      kind: 'rarity',
      root: rail.querySelector('[data-admin-cos-filter-rarity-root]'),
      trigger: rail.querySelector('[data-admin-cos-filter-rarity-trigger]'),
      menu: rail.querySelector('[data-admin-cos-filter-rarity-menu]'),
    },
  ];

  /** @param {{ menu: Element | null, trigger: Element | null }} menu */
  function closeMenu(menu) {
    if (menu.menu instanceof HTMLElement) menu.menu.hidden = true;
    if (menu.trigger instanceof HTMLElement) menu.trigger.setAttribute('aria-expanded', 'false');
  }

  /** @param {{ menu: Element | null, trigger: Element | null }} menu */
  function openMenu(menu) {
    for (const other of menus) {
      if (other !== menu) closeMenu(other);
    }
    if (menu.menu instanceof HTMLElement) menu.menu.hidden = false;
    if (menu.trigger instanceof HTMLElement) menu.trigger.setAttribute('aria-expanded', 'true');
  }

  function closeAll() {
    for (const menu of menus) closeMenu(menu);
  }

  /** @param {MouseEvent} e */
  function onClick(e) {
    const t = e.target;
    if (!(t instanceof Element) || !rail.contains(t)) return;

    if (t.closest('[data-admin-cos-filter-reset]')) {
      closeAll();
      opts.onChange(defaultAdminCosmeticFilters());
      return;
    }

    const opened = menus.find(
      (menu) => menu.trigger instanceof Element && t.closest(triggerSel(menu.kind)) && rail.contains(menu.trigger),
    );
    if (opened) {
      if (opened.menu instanceof HTMLElement && !opened.menu.hidden) closeMenu(opened);
      else openMenu(opened);
      return;
    }

    const slotOpt = t.closest('[data-admin-cos-filter-slot]');
    if (slotOpt instanceof HTMLElement) {
      const raw = slotOpt.getAttribute('data-admin-cos-filter-slot') || '';
      const slot = BLOB_SLOTS.some((s) => s.id === raw) ? /** @type {BlobSlotId} */ (raw) : null;
      closeAll();
      const cur = opts.getState();
      if (slot === cur.slot) return;
      opts.onChange({ ...cur, slot });
      return;
    }

    const rarityOpt = t.closest('[data-admin-cos-filter-rarity]');
    if (rarityOpt instanceof HTMLElement) {
      const raw = rarityOpt.getAttribute('data-admin-cos-filter-rarity') || '';
      const rarity = COSMETIC_RARITIES.includes(raw) ? raw : null;
      closeAll();
      const cur = opts.getState();
      if (rarity === cur.rarity) return;
      opts.onChange({ ...cur, rarity });
      return;
    }

    const grantBtn = t.closest('[data-admin-cos-filter-grant]');
    if (grantBtn instanceof HTMLElement) {
      const raw = /** @type {CosmeticGrantFilter} */ (grantBtn.getAttribute('data-admin-cos-filter-grant'));
      if (!COSMETIC_GRANTS.includes(raw)) return;
      const cur = opts.getState();
      opts.onChange({ ...cur, grants: toggleGrant(cur.grants, raw) });
    }
  }

  /** @param {Event} e */
  function onSearch(e) {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !t.hasAttribute('data-admin-cos-filter-search')) return;
    const cur = opts.getState();
    opts.onChange({ ...cur, q: t.value });
  }

  /** @param {MouseEvent} e */
  function onDoc(e) {
    const t = e.target;
    if (!(t instanceof Node)) return;
    if (menus.some((menu) => menu.root instanceof HTMLElement && menu.root.contains(t))) return;
    closeAll();
  }

  rail.addEventListener('click', onClick);
  rail.addEventListener('input', onSearch);
  document.addEventListener('pointerdown', onDoc);

  return () => {
    rail.removeEventListener('click', onClick);
    rail.removeEventListener('input', onSearch);
    document.removeEventListener('pointerdown', onDoc);
  };
}

/**
 * @param {'slot' | 'rarity'} kind
 */
function triggerSel(kind) {
  return kind === 'rarity'
    ? '[data-admin-cos-filter-rarity-trigger]'
    : '[data-admin-cos-filter-slot-trigger]';
}

/**
 * @param {string} s
 */
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {string} s
 */
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
