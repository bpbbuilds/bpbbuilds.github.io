/**
 * Items catalog filters — game Item Library UI (markup + events).
 *
 *   import { defaultFilterState, filterItems, filtersHtml, bindFilters } from './catalog-filters.js';
 */

import {
  CLASS_ORDER,
  TYPE_ORDER,
  BUFF_ORDER,
  DEBUFF_ORDER,
  GROUPING_OPTS,
  defaultFilterState,
  filterItems,
  sortForGrouping,
  groupSortKey,
  classList,
  isTreasureItem,
  normalizeItemCategory,
  itemMatchesCategory,
} from './filter-logic.js';

export {
  defaultFilterState,
  filterItems,
  sortForGrouping,
  groupSortKey,
  classList,
  isTreasureItem,
  normalizeItemCategory,
  itemMatchesCategory,
};

/**
 * @param {string} root asset root ending in /
 */
function iconUrl(root, rel) {
  return `${root}${rel.replace(/^\//, '')}`;
}

/**
 * @param {string} root
 * @param {ReturnType<typeof defaultFilterState>} state
 * @param {number} shown
 */
export function filtersHtml(root, state, shown) {
  const classBtns = CLASS_ORDER.map((c) => {
    const on = Boolean(state.classes[c]);
    const src = iconUrl(root, `assets/icons/classes/${c}Icon.png`);
    return `<button type="button" class="il-filter__icon-btn${on ? ' is-on' : ''}" data-toggle="class" data-value="${escapeAttr(c)}" title="${escapeAttr(c)}" aria-pressed="${on}">
      <img src="${escapeAttr(src)}" alt="" draggable="false" />
    </button>`;
  }).join('');

  const classItemsCheck = checkRow('Class Items', state.classItems, 'flag', 'classItems');
  const treasureCheck = `
    <button type="button" class="il-filter__check il-filter__check--swiped il-filter__paint--treasure${state.treasure ? ' is-on' : ''}" data-toggle="flag" data-value="treasure" aria-pressed="${state.treasure}">
      <span class="il-filter__box" aria-hidden="true"></span>
      <img class="il-filter__treasure-icon" src="${escapeAttr(iconUrl(root, 'assets/tooltips/icons/Treasure.png'))}" alt="" draggable="false" />
      <span class="il-filter__check-label">-items</span>
    </button>`;

  const typeBtns = TYPE_ORDER.map((t) => {
    const on = Boolean(state.types[t]);
    const src = iconUrl(root, `assets/tooltips/icons/${t}.png`);
    const gap = t === 'Effect' ? ' il-filter__icon-btn--break' : '';
    return `<button type="button" class="il-filter__icon-btn il-filter__icon-btn--type${gap}${on ? ' is-on' : ''}" data-toggle="type" data-value="${escapeAttr(t)}" title="${escapeAttr(t)}" aria-pressed="${on}">
      <img src="${escapeAttr(src)}" alt="" draggable="false" />
    </button>`;
  }).join('');

  const condChecks = [
    checkRow('Shop Items', state.shop, 'flag', 'shop'),
    checkRow('Crafted Items', state.crafted, 'flag', 'crafted'),
    checkRow('Gated Items', state.gated, 'flag', 'gated'),
  ].join('');

  const buffBtns = BUFF_ORDER.map((s) => stackBtn(root, s, state.stacks[s])).join('');
  const debuffBtns = DEBUFF_ORDER.map((s) => stackBtn(root, s, state.stacks[s])).join('');

  const groupLabel =
    GROUPING_OPTS.find((o) => o.id === state.grouping)?.label || 'No Grouping';

  const groupItems = GROUPING_OPTS.map(
    (o) =>
      `<button type="button" class="il-filter__group-option${state.grouping === o.id ? ' is-active' : ''}" data-grouping="${escapeAttr(o.id)}" role="option" aria-selected="${state.grouping === o.id}">${escapeAttr(o.label)}</button>`,
  ).join('');

  return `
    <aside class="items-filters il-filter" aria-label="Filter items">
      <div class="il-filter__head">
        <p class="il-filter__count" data-filter-count>${shown} items found.</p>
        <button type="button" class="il-filter__reset" data-filter-reset title="Reset filters" aria-label="Reset filters">
          <img src="${escapeAttr(iconUrl(root, 'assets/icons/filters/ResetButton.png'))}" alt="" draggable="false" />
        </button>
      </div>

      <div class="il-filter__shade il-filter__grouping" data-grouping-root>
        <button type="button" class="il-filter__group-trigger" data-grouping-trigger aria-haspopup="listbox" aria-expanded="false">
          <img class="il-filter__group-arrow" src="${escapeAttr(iconUrl(root, 'assets/icons/filters/DropdownArrow.png'))}" alt="" draggable="false" />
          <span class="il-filter__sticker" data-grouping-label>${escapeAttr(groupLabel)}</span>
        </button>
        <div class="il-filter__group-menu" data-grouping-menu hidden role="listbox">
          ${groupItems}
        </div>
      </div>

      <div class="il-filter__shade il-filter__classes" role="group" aria-label="Class">${classBtns}</div>

      <div class="il-filter__shade il-filter__rarities">
        <div class="il-filter__rarity-col">
          ${checkRow('Common', state.rarities.Common, 'rarity', 'Common')}
          ${checkRow('Rare', state.rarities.Rare, 'rarity', 'Rare')}
          ${checkRow('Epic', state.rarities.Epic, 'rarity', 'Epic')}
        </div>
        <div class="il-filter__rarity-col">
          ${checkRow('Legendary', state.rarities.Legendary, 'rarity', 'Legendary')}
          ${checkRow('Godly', state.rarities.Godly, 'rarity', 'Godly')}
          ${classItemsCheck}
          ${treasureCheck}
        </div>
      </div>

      <div class="il-filter__shade il-filter__types" role="group" aria-label="Types">${typeBtns}</div>

      <div class="il-filter__lower">
        <div class="il-filter__shade il-filter__conditions" role="group" aria-label="Origin">${condChecks}</div>
        <div class="il-filter__shade il-filter__buffs" role="group" aria-label="Buffs">${buffBtns}</div>
      </div>

      <div class="il-filter__search-row">
        <label class="il-filter__shade il-filter__search">
          <span class="visually-hidden">Search items</span>
          <input type="search" class="il-filter__input" name="q" placeholder="Search..." value="${escapeAttr(state.q)}" autocomplete="off" />
        </label>
        <div class="il-filter__shade il-filter__debuffs" role="group" aria-label="Debuffs">${debuffBtns}</div>
      </div>
    </aside>`;
}

/**
 * @param {string} label
 * @param {boolean} on
 * @param {string} kind
 * @param {string} value
 */
function checkRow(label, on, kind, value) {
  const paint =
    kind === 'rarity'
      ? ` il-filter__check--swiped il-filter__paint--${String(value).toLowerCase()}`
      : kind === 'flag' && value === 'classItems'
        ? ' il-filter__check--swiped il-filter__paint--class-items'
        : '';
  return `<button type="button" class="il-filter__check${paint}${on ? ' is-on' : ''}" data-toggle="${escapeAttr(kind)}" data-value="${escapeAttr(value)}" aria-pressed="${on}">
    <span class="il-filter__box" aria-hidden="true"></span>
    <span class="il-filter__check-label">${escapeAttr(label)}</span>
  </button>`;
}

/**
 * @param {string} root
 * @param {string} stack
 * @param {boolean} on
 */
function stackBtn(root, stack, on) {
  // Game: Buffs/*.png off, Tooltips/Icon_*.png on (yellow silhouette outline baked in)
  const offSrc = iconUrl(root, `assets/icons/status/buff/${stack}.png`);
  const onSrc = iconUrl(root, `assets/icons/status/Icon_${stack}.png`);
  return `<button type="button" class="il-filter__icon-btn il-filter__icon-btn--stack${on ? ' is-on' : ''}" data-toggle="stack" data-value="${escapeAttr(stack)}" title="${escapeAttr(stack)}" aria-pressed="${on}" data-src-off="${escapeAttr(offSrc)}" data-src-on="${escapeAttr(onSrc)}">
    <img src="${escapeAttr(on ? onSrc : offSrc)}" alt="" draggable="false" />
  </button>`;
}

/**
 * @param {Element} root
 * @param {{
 *   state: ReturnType<typeof defaultFilterState>,
 *   onChange: () => void,
 *   onReset?: () => void,
 *   assetRoot?: string,
 *   searchDebounceMs?: number,
 * }} opts
 */
export function bindFilters(root, opts) {
  const { state, onChange } = opts;
  const searchDebounceMs = opts.searchDebounceMs ?? 120;
  const panel = root.querySelector('.items-filters');
  if (!panel) return () => {};

  const emit = () => onChange();
  /** @type {ReturnType<typeof setTimeout> | null} */
  let searchTimer = null;

  function resetAll() {
    const fresh = defaultFilterState();
    state.q = fresh.q;
    state.grouping = fresh.grouping;
    state.classes = { ...fresh.classes };
    state.rarities = { ...fresh.rarities };
    state.classItems = fresh.classItems;
    state.treasure = fresh.treasure;
    state.types = { ...fresh.types };
    state.shop = fresh.shop;
    state.crafted = fresh.crafted;
    state.gated = fresh.gated;
    state.stacks = { ...fresh.stacks };
    state.category = fresh.category;
    const input = panel.querySelector('.il-filter__input');
    if (input instanceof HTMLInputElement) input.value = '';
    syncFilterUi(panel, state);
    opts.onReset?.();
    emit();
  }

  const onClick = (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;

    if (t.closest('[data-filter-reset]')) {
      resetAll();
      return;
    }

    const groupOpt = t.closest('[data-grouping]');
    if (groupOpt && panel.contains(groupOpt)) {
      state.grouping = groupOpt.getAttribute('data-grouping') || 'none';
      closeGrouping(panel);
      syncFilterUi(panel, state);
      emit();
      return;
    }

    const trigger = t.closest('[data-grouping-trigger]');
    if (trigger && panel.contains(trigger)) {
      const menu = panel.querySelector('[data-grouping-menu]');
      const open = menu && !menu.hasAttribute('hidden');
      if (menu) {
        if (open) menu.setAttribute('hidden', '');
        else menu.removeAttribute('hidden');
        trigger.setAttribute('aria-expanded', open ? 'false' : 'true');
      }
      return;
    }

    const btn = t.closest('[data-toggle][data-value]');
    if (!btn || !panel.contains(btn)) return;
    const kind = btn.getAttribute('data-toggle');
    const value = btn.getAttribute('data-value');
    if (!kind || value == null) return;

    if (kind === 'class') state.classes[value] = !state.classes[value];
    else if (kind === 'rarity') state.rarities[value] = !state.rarities[value];
    else if (kind === 'type') state.types[value] = !state.types[value];
    else if (kind === 'stack') state.stacks[value] = !state.stacks[value];
    else if (kind === 'flag') {
      if (value === 'classItems') state.classItems = !state.classItems;
      else if (value === 'treasure') state.treasure = !state.treasure;
      else if (value === 'shop') state.shop = !state.shop;
      else if (value === 'crafted') state.crafted = !state.crafted;
      else if (value === 'gated') state.gated = !state.gated;
    }

    syncFilterUi(panel, state);
    emit();
  };

  const onInput = (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || el.name !== 'q') return;
    state.q = el.value;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchTimer = null;
      emit();
    }, searchDebounceMs);
  };

  const onDocClick = (e) => {
    const t = e.target;
    if (!(t instanceof Node)) return;
    const wrap = panel.querySelector('[data-grouping-root]');
    if (wrap && !wrap.contains(t)) closeGrouping(panel);
  };

  /** Game TypeButton right-click: solo this type, or invert when already solo. */
  const onContextMenu = (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const btn = t.closest('[data-toggle="type"][data-value]');
    if (!btn || !panel.contains(btn)) return;
    e.preventDefault();
    const value = btn.getAttribute('data-value');
    if (!value || !Object.prototype.hasOwnProperty.call(state.types, value)) return;

    const othersOn = TYPE_ORDER.some((ty) => ty !== value && state.types[ty]);
    if (state.types[value] && !othersOn) {
      state.types[value] = false;
      for (const ty of TYPE_ORDER) {
        if (ty !== value) state.types[ty] = true;
      }
    } else {
      for (const ty of TYPE_ORDER) state.types[ty] = ty === value;
    }
    syncFilterUi(panel, state);
    emit();
  };

  panel.addEventListener('click', onClick);
  panel.addEventListener('contextmenu', onContextMenu);
  panel.addEventListener('input', onInput);
  document.addEventListener('click', onDocClick);

  return () => {
    if (searchTimer) clearTimeout(searchTimer);
    panel.removeEventListener('click', onClick);
    panel.removeEventListener('contextmenu', onContextMenu);
    panel.removeEventListener('input', onInput);
    document.removeEventListener('click', onDocClick);
  };
}

/** @param {Element} panel */
function closeGrouping(panel) {
  const menu = panel.querySelector('[data-grouping-menu]');
  const trigger = panel.querySelector('[data-grouping-trigger]');
  if (menu) menu.setAttribute('hidden', '');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

/**
 * @param {Element} panel
 * @param {ReturnType<typeof defaultFilterState>} state
 */
function syncFilterUi(panel, state) {
  panel.querySelectorAll('[data-toggle][data-value]').forEach((btn) => {
    const kind = btn.getAttribute('data-toggle');
    const value = btn.getAttribute('data-value');
    let on = false;
    if (kind === 'class') on = Boolean(state.classes[value]);
    else if (kind === 'rarity') on = Boolean(state.rarities[value]);
    else if (kind === 'type') on = Boolean(state.types[value]);
    else if (kind === 'stack') on = Boolean(state.stacks[value]);
    else if (kind === 'flag') {
      if (value === 'classItems') on = state.classItems;
      else if (value === 'treasure') on = state.treasure;
      else if (value === 'shop') on = state.shop;
      else if (value === 'crafted') on = state.crafted;
      else if (value === 'gated') on = state.gated;
    }
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (kind === 'stack') {
      const img = btn.querySelector('img');
      const offSrc = btn.getAttribute('data-src-off');
      const onSrc = btn.getAttribute('data-src-on');
      if (img && offSrc && onSrc) img.src = on ? onSrc : offSrc;
    }
  });

  const label = panel.querySelector('[data-grouping-label]');
  if (label) {
    label.textContent =
      GROUPING_OPTS.find((o) => o.id === state.grouping)?.label || 'No Grouping';
  }
  panel.querySelectorAll('[data-grouping]').forEach((btn) => {
    const id = btn.getAttribute('data-grouping');
    btn.classList.toggle('is-active', id === state.grouping);
    btn.setAttribute('aria-selected', id === state.grouping ? 'true' : 'false');
  });
}

/**
 * @param {Element} root
 * @param {number} shown
 */
export function updateFilterMeta(root, shown) {
  const count = root.querySelector('[data-filter-count]');
  if (count) count.textContent = `${shown} items found.`;
}

function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
