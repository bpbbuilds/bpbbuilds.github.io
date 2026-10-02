/**
 * Events catalog filter rail — Item Library chrome (il-filter / Patch3).
 */

/** @typedef {import('./catalog-data.js').EventStatus} EventStatus */
/** @typedef {import('./catalog-data.js').EventType} EventType */
/** @typedef {'card' | 'compact'} EventView */
/** @typedef {{ statuses: EventStatus[], type: EventType | null, view: EventView, q: string }} EventFilterState */

import { EVENT_STATUS_LABELS } from './catalog-data.js';

export const EVENT_STATUSES = /** @type {const} */ ([
  'live',
  'accepting-entries',
  'judging',
  'voting',
  'upcoming',
  'ended',
]);

export { EVENT_STATUS_LABELS };

export const EVENT_TYPES = /** @type {const} */ (['dps-stone', 'craft', 'showcase']);

export const EVENT_VIEWS = /** @type {const} */ (['card', 'compact']);

export const EVENT_TYPE_LABELS = {
  'dps-stone': 'DPS Stone',
  craft: 'Craft',
  showcase: 'Showcase',
};

export const EVENT_VIEW_LABELS = {
  card: 'Card',
  compact: 'Compact',
};

/** @returns {EventFilterState} */
export function defaultEventFilterState() {
  return {
    statuses: EVENT_STATUSES.slice(),
    type: null,
    view: 'card',
    q: '',
  };
}

/**
 * @param {EventType | null | undefined} type
 */
export function eventTypeLabel(type) {
  if (!type) return 'All types';
  return EVENT_TYPE_LABELS[type] || 'All types';
}

/**
 * @param {EventStatus[]} current
 * @param {EventStatus} clicked
 * @returns {EventStatus[]}
 */
export function toggleEventStatus(current, clicked) {
  if (!EVENT_STATUSES.includes(clicked)) return current.slice();
  const allOn = current.length === EVENT_STATUSES.length;
  if (allOn) return [clicked];
  if (current.includes(clicked)) {
    const next = current.filter((s) => s !== clicked);
    return next.length ? next : EVENT_STATUSES.slice();
  }
  return [...current, clicked];
}

/**
 * @param {string} root
 * @param {EventFilterState} state
 * @param {number} shown
 */
export function eventFiltersHtml(root, state, shown) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const countLabel = shown === 1 ? '1 event found.' : `${shown} events found.`;
  const viewLabel = EVENT_VIEW_LABELS[state.view] || 'Card';
  const typeLabel = eventTypeLabel(state.type);

  const statusBtns = EVENT_STATUSES.map((s) => {
    const on = state.statuses.includes(s);
    return `<button type="button" class="il-filter__check${on ? ' is-on' : ''}" data-event-status="${s}" aria-pressed="${on}">
      <span class="il-filter__box" aria-hidden="true"></span>
      <span class="il-filter__check-label">${EVENT_STATUS_LABELS[s]}</span>
    </button>`;
  }).join('');

  const viewOptions = EVENT_VIEWS.map(
    (v) =>
      `<button type="button" class="il-filter__group-option${state.view === v ? ' is-active' : ''}" data-event-view="${v}" role="option" aria-selected="${state.view === v}">${EVENT_VIEW_LABELS[v]}</button>`,
  ).join('');

  const typeOptions = [
    `<button type="button" class="il-filter__group-option${!state.type ? ' is-active' : ''}" data-event-type="" role="option" aria-selected="${!state.type}">All types</button>`,
    ...EVENT_TYPES.map((t) => {
      const on = state.type === t;
      return `<button type="button" class="il-filter__group-option${on ? ' is-active' : ''}" data-event-type="${t}" role="option" aria-selected="${on}">${EVENT_TYPE_LABELS[t]}</button>`;
    }),
  ].join('');

  return `
    <aside class="items-filters il-filter events-filters" id="events-filters" aria-label="Filter events">
      <div class="il-filter__head">
        <button type="button" class="events-filters__close" data-events-filters-close aria-label="Close filters">
          <span class="events-filters__close-icon" aria-hidden="true"></span>
        </button>
        <p class="il-filter__count" data-filter-count>${escapeHtml(countLabel)}</p>
        <button type="button" class="il-filter__reset" data-event-reset title="Reset filters" aria-label="Reset filters">
          <img src="${escapeAttr(base)}assets/icons/filters/ResetButton.png" alt="" draggable="false" />
        </button>
      </div>

      <div class="il-filter__shade events-filters__search">
        <label class="cr-label events-filters__search-label" for="events-search">Search</label>
        <input
          id="events-search"
          class="cr-input events-filters__search-input"
          type="search"
          data-event-search
          placeholder="Title or prize…"
          value="${escapeAttr(state.q)}"
          autocomplete="off"
        />
      </div>

      <div class="il-filter__shade events-filters__menus">
        <div class="il-filter__grouping" data-event-type-root>
          <button type="button" class="il-filter__group-trigger" data-event-type-trigger aria-haspopup="listbox" aria-expanded="false">
            <img class="il-filter__group-arrow" src="${escapeAttr(base)}assets/icons/filters/DropdownArrow.png" alt="" draggable="false" />
            <span class="il-filter__sticker" data-event-type-label>${escapeHtml(typeLabel)}</span>
          </button>
          <div class="il-filter__group-menu" data-event-type-menu hidden role="listbox" aria-label="Event type">
            ${typeOptions}
          </div>
        </div>
        <div class="il-filter__grouping" data-event-view-root>
          <button type="button" class="il-filter__group-trigger" data-event-view-trigger aria-haspopup="listbox" aria-expanded="false">
            <img class="il-filter__group-arrow" src="${escapeAttr(base)}assets/icons/filters/DropdownArrow.png" alt="" draggable="false" />
            <span class="il-filter__sticker" data-event-view-label>${escapeHtml(viewLabel)}</span>
          </button>
          <div class="il-filter__group-menu" data-event-view-menu hidden role="listbox" aria-label="View events">
            ${viewOptions}
          </div>
        </div>
      </div>

      <div class="il-filter__shade">
        <p class="cr-label events-filters__section-label">Status</p>
        <div class="il-filter__checks" role="group" aria-label="Event status">
          ${statusBtns}
        </div>
      </div>
    </aside>`;
}

/**
 * @param {HTMLElement} rail
 * @param {EventFilterState} state
 * @param {number} shown
 */
export function syncEventFiltersUi(rail, state, shown) {
  const count = rail.querySelector('[data-filter-count]');
  if (count) {
    count.textContent = shown === 1 ? '1 event found.' : `${shown} events found.`;
  }
  const viewLabel = rail.querySelector('[data-event-view-label]');
  if (viewLabel) viewLabel.textContent = EVENT_VIEW_LABELS[state.view] || 'Card';
  const typeLabelEl = rail.querySelector('[data-event-type-label]');
  if (typeLabelEl) typeLabelEl.textContent = eventTypeLabel(state.type);

  rail.querySelectorAll('[data-event-status]').forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const id = /** @type {EventStatus} */ (btn.getAttribute('data-event-status'));
    const on = state.statuses.includes(id);
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  rail.querySelectorAll('[data-event-view]').forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const v = btn.getAttribute('data-event-view');
    const on = v === state.view;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });

  rail.querySelectorAll('[data-event-type]').forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const raw = btn.getAttribute('data-event-type') || '';
    const on = raw === '' ? !state.type : state.type === raw;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });

  const search = rail.querySelector('[data-event-search]');
  if (search instanceof HTMLInputElement && search.value !== state.q) {
    search.value = state.q;
  }
}

/**
 * @param {HTMLElement} rail
 * @param {{
 *   getState: () => EventFilterState,
 *   defaultState: () => EventFilterState,
 *   onChange: (next: EventFilterState) => void,
 * }} opts
 * @returns {() => void}
 */
export function bindEventFilters(rail, opts) {
  /** @type {{ root: Element | null, trigger: Element | null, menu: Element | null }[]} */
  const menus = [
    {
      root: rail.querySelector('[data-event-type-root]'),
      trigger: rail.querySelector('[data-event-type-trigger]'),
      menu: rail.querySelector('[data-event-type-menu]'),
    },
    {
      root: rail.querySelector('[data-event-view-root]'),
      trigger: rail.querySelector('[data-event-view-trigger]'),
      menu: rail.querySelector('[data-event-view-menu]'),
    },
  ];

  /** @param {{ root: Element | null, trigger: Element | null, menu: Element | null }} m */
  function closeMenu(m) {
    if (m.menu instanceof HTMLElement) m.menu.hidden = true;
    if (m.trigger instanceof HTMLElement) {
      m.trigger.setAttribute('aria-expanded', 'false');
    }
  }

  /** @param {{ root: Element | null, trigger: Element | null, menu: Element | null }} m */
  function openMenu(m) {
    for (const other of menus) {
      if (other !== m) closeMenu(other);
    }
    if (m.menu instanceof HTMLElement) m.menu.hidden = false;
    if (m.trigger instanceof HTMLElement) {
      m.trigger.setAttribute('aria-expanded', 'true');
    }
  }

  function closeAllMenus() {
    for (const m of menus) closeMenu(m);
  }

  /** @param {MouseEvent} e */
  function onClick(e) {
    const t = e.target;
    if (!(t instanceof Element)) return;

    const reset = t.closest('[data-event-reset]');
    if (reset && rail.contains(reset)) {
      closeAllMenus();
      opts.onChange(opts.defaultState());
      return;
    }

    const typeTrig = t.closest('[data-event-type-trigger]');
    if (typeTrig && rail.contains(typeTrig)) {
      const m = menus[0];
      if (m.menu instanceof HTMLElement && !m.menu.hidden) closeMenu(m);
      else openMenu(m);
      return;
    }

    const viewTrig = t.closest('[data-event-view-trigger]');
    if (viewTrig && rail.contains(viewTrig)) {
      const m = menus[1];
      if (m.menu instanceof HTMLElement && !m.menu.hidden) closeMenu(m);
      else openMenu(m);
      return;
    }

    const typeOpt = t.closest('[data-event-type]');
    if (typeOpt instanceof HTMLElement && rail.contains(typeOpt)) {
      const raw = typeOpt.getAttribute('data-event-type') || '';
      const type =
        raw && EVENT_TYPES.includes(/** @type {EventType} */ (raw))
          ? /** @type {EventType} */ (raw)
          : null;
      closeAllMenus();
      const cur = opts.getState();
      if (type === cur.type) return;
      opts.onChange({ ...cur, type });
      return;
    }

    const viewOpt = t.closest('[data-event-view]');
    if (viewOpt instanceof HTMLElement && rail.contains(viewOpt)) {
      const view = /** @type {EventView} */ (viewOpt.getAttribute('data-event-view'));
      if (!EVENT_VIEWS.includes(view)) return;
      closeAllMenus();
      const cur = opts.getState();
      if (view === cur.view) return;
      opts.onChange({ ...cur, view });
      return;
    }

    const statusBtn = t.closest('[data-event-status]');
    if (statusBtn instanceof HTMLElement && rail.contains(statusBtn)) {
      const raw = /** @type {EventStatus} */ (statusBtn.getAttribute('data-event-status'));
      if (!EVENT_STATUSES.includes(raw)) return;
      const cur = opts.getState();
      opts.onChange({ ...cur, statuses: toggleEventStatus(cur.statuses, raw) });
    }
  }

  /** @param {Event} e */
  function onSearchInput(e) {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !t.hasAttribute('data-event-search')) return;
    if (!rail.contains(t)) return;
    const cur = opts.getState();
    opts.onChange({ ...cur, q: t.value });
  }

  /** @param {MouseEvent} e */
  function onDocPointer(e) {
    const t = e.target;
    if (!(t instanceof Node)) return;
    const inside = menus.some(
      (m) => m.root instanceof HTMLElement && m.root.contains(t),
    );
    if (inside) return;
    closeAllMenus();
  }

  rail.addEventListener('click', onClick);
  rail.addEventListener('input', onSearchInput);
  document.addEventListener('pointerdown', onDocPointer);

  return () => {
    rail.removeEventListener('click', onClick);
    rail.removeEventListener('input', onSearchInput);
    document.removeEventListener('pointerdown', onDocPointer);
  };
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
