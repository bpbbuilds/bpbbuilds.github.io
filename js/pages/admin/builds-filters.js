/**
 * Admin Builds filter rail — search + list status + character.
 */

import { HERO_CLASSES } from '../items/filter-logic.js';
import { buildSearchFieldHtml } from '../../shared/build-search-input.js';

/** @typedef {'all' | 'featured' | 'hidden'} AdminBuildsListFilter */

/**
 * @typedef {{
 *   list: AdminBuildsListFilter,
 *   heroClass: string | null,
 *   q: string,
 * }} AdminBuildsFilterState
 */

/** @returns {AdminBuildsFilterState} */
export function defaultAdminBuildsFilters() {
  return { list: 'all', heroClass: null, q: '' };
}

/**
 * @param {string} root
 * @param {AdminBuildsFilterState} state
 * @param {number} shown
 */
export function adminBuildsFiltersHtml(root, state, shown) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const countLabel = shown === 1 ? '1 build shown.' : `${shown} builds shown.`;

  const listBtns = [
    { id: 'all', label: 'All' },
    { id: 'featured', label: 'Featured' },
    { id: 'hidden', label: 'Hidden' },
  ]
    .map((s) => {
      const on = state.list === s.id;
      return `<button type="button" class="il-filter__check${on ? ' is-on' : ''}" data-admin-builds-list="${s.id}" aria-pressed="${on}">
      <span class="il-filter__box" aria-hidden="true"></span>
      <span class="il-filter__check-label">${escapeHtml(s.label)}</span>
    </button>`;
    })
    .join('');

  const classBtns = HERO_CLASSES.map((c) => {
    const on = state.heroClass === c;
    return `<button type="button" class="il-filter__icon-btn${on ? ' is-on' : ''}" data-admin-builds-class="${escapeAttr(c)}" title="${escapeAttr(c)}" aria-pressed="${on}">
      <img src="${escapeAttr(base)}assets/icons/classes/${escapeAttr(c)}Icon.png" alt="" draggable="false" />
    </button>`;
  }).join('');

  const anyClassOn = !state.heroClass;

  return `
    <aside class="items-filters il-filter builds-feed-filters admin-builds-filters" aria-label="Filter builds">
      <div class="il-filter__head">
        <p class="il-filter__count" data-filter-count>${escapeHtml(countLabel)}</p>
        <button type="button" class="il-filter__reset" data-admin-builds-reset title="Reset filters" aria-label="Reset filters">
          <img src="${escapeAttr(base)}assets/icons/filters/ResetButton.png" alt="" draggable="false" />
        </button>
      </div>

      ${buildSearchFieldHtml('Title, @user, [Item]…')}

      <div class="il-filter__shade">
        <p class="il-filter__sticker">List</p>
        <div class="il-filter__checks" role="group" aria-label="Build list">${listBtns}</div>
      </div>

      <div class="il-filter__shade">
        <p class="il-filter__sticker">Character</p>
        <div class="il-filter__classes" role="group" aria-label="Hero class">
          <button type="button" class="il-filter__icon-btn${anyClassOn ? ' is-on' : ''}" data-admin-builds-class="" title="Any class" aria-pressed="${anyClassOn}">
            <img src="${escapeAttr(base)}assets/icons/classes/NeutralIcon.png" alt="" draggable="false" />
          </button>
          ${classBtns}
        </div>
      </div>
    </aside>`;
}

/**
 * @param {HTMLElement} rail
 * @param {AdminBuildsFilterState} state
 * @param {number} shown
 */
export function syncAdminBuildsFiltersUi(rail, state, shown) {
  const countEl = rail.querySelector('[data-filter-count]');
  if (countEl) {
    countEl.textContent = shown === 1 ? '1 build shown.' : `${shown} builds shown.`;
  }
  rail.querySelectorAll('[data-admin-builds-list]').forEach((el) => {
    const on = el.getAttribute('data-admin-builds-list') === state.list;
    el.classList.toggle('is-on', on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  rail.querySelectorAll('[data-admin-builds-class]').forEach((el) => {
    const raw = el.getAttribute('data-admin-builds-class') || '';
    const on = raw ? state.heroClass === raw : !state.heroClass;
    el.classList.toggle('is-on', on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

/**
 * @param {HTMLElement} rail
 * @param {{
 *   getState: () => AdminBuildsFilterState,
 *   onChange: (next: AdminBuildsFilterState, meta?: { listChanged?: boolean }) => void,
 *   defaultState: () => AdminBuildsFilterState,
 *   onResetSearch?: () => void,
 * }} opts
 */
export function bindAdminBuildsFilters(rail, opts) {
  /** @param {Event} e */
  function onClick(e) {
    const t = e.target;
    if (!(t instanceof Element)) return;

    if (t.closest('[data-admin-builds-reset]') && rail.contains(t.closest('[data-admin-builds-reset]'))) {
      opts.onResetSearch?.();
      opts.onChange(opts.defaultState(), { listChanged: true });
      return;
    }

    const listBtn = t.closest('[data-admin-builds-list]');
    if (listBtn instanceof HTMLElement && rail.contains(listBtn)) {
      const list = /** @type {AdminBuildsListFilter} */ (
        listBtn.getAttribute('data-admin-builds-list')
      );
      if (list !== 'all' && list !== 'featured' && list !== 'hidden') return;
      const cur = opts.getState();
      if (list === cur.list) return;
      opts.onChange({ ...cur, list }, { listChanged: true });
      return;
    }

    const classBtn = t.closest('[data-admin-builds-class]');
    if (classBtn instanceof HTMLElement && rail.contains(classBtn)) {
      const raw = classBtn.getAttribute('data-admin-builds-class') || '';
      const heroClass = raw && HERO_CLASSES.includes(raw) ? raw : null;
      const cur = opts.getState();
      if (heroClass === cur.heroClass) return;
      opts.onChange({ ...cur, heroClass });
    }
  }

  rail.addEventListener('click', onClick);
  return () => rail.removeEventListener('click', onClick);
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
