/**
 * Admin Events filter rail — same Item Library panel as the public events page.
 */

/** @typedef {import('../events/catalog-data.js').EventStatus} EventStatus */
/** @typedef {import('../events/catalog-data.js').EventType} EventType */
/** @typedef {'card' | 'compact'} AdminEventView */
/** @typedef {{ statuses: EventStatus[], type: EventType | null, view: AdminEventView, q: string }} AdminEventFilterState */
/** @typedef {import('./event-form-model.js').EventFormValues} EventFormValues */

import { EVENT_STATUS_LABELS } from '../events/catalog-data.js';
import {
  EVENT_STATUSES,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  EVENT_VIEWS,
  EVENT_VIEW_LABELS,
  eventTypeLabel,
  toggleEventStatus,
} from '../events/event-filters.js';

/** @returns {AdminEventFilterState} */
export function defaultAdminEventFilters() {
  return {
    statuses: EVENT_STATUSES.slice(),
    type: null,
    view: 'compact',
    q: '',
  };
}

/**
 * @param {EventFormValues} event
 * @param {AdminEventFilterState} state
 */
export function adminEventMatches(event, state) {
  if (state.type && event.type !== state.type) return false;
  if (state.statuses.length && !state.statuses.includes(event.status)) return false;
  const q = String(state.q || '').trim().toLowerCase();
  if (!q) return true;
  const hay = [event.title, event.slug, event.tag, event.blurb, event.prize, EVENT_TYPE_LABELS[event.type], EVENT_STATUS_LABELS[event.status]]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

/**
 * @param {string} root
 * @param {AdminEventFilterState} state
 * @param {number} shown
 */
export function adminEventFiltersHtml(root, state, shown) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const countLabel = shown === 1 ? '1 event shown.' : `${shown} events shown.`;
  const typeLabel = eventTypeLabel(state.type);
  const viewLabel = EVENT_VIEW_LABELS[state.view] || 'Compact';

  const statusBtns = EVENT_STATUSES.map((s) => {
    const on = state.statuses.includes(s);
    return `<button type="button" class="il-filter__check${on ? ' is-on' : ''}" data-admin-event-status="${s}" aria-pressed="${on}">
      <span class="il-filter__box" aria-hidden="true"></span>
      <span class="il-filter__check-label">${escapeHtml(EVENT_STATUS_LABELS[s])}</span>
    </button>`;
  }).join('');

  const typeOptions = [
    `<button type="button" class="il-filter__group-option${!state.type ? ' is-active' : ''}" data-admin-event-type="" role="option" aria-selected="${!state.type}">All types</button>`,
    ...EVENT_TYPES.map((t) => {
      const on = state.type === t;
      return `<button type="button" class="il-filter__group-option${on ? ' is-active' : ''}" data-admin-event-type="${t}" role="option" aria-selected="${on}">${escapeHtml(EVENT_TYPE_LABELS[t])}</button>`;
    }),
  ].join('');

  const viewOptions = EVENT_VIEWS.map((v) => {
    const on = state.view === v;
    return `<button type="button" class="il-filter__group-option${on ? ' is-active' : ''}" data-admin-event-view="${v}" role="option" aria-selected="${on}">${escapeHtml(EVENT_VIEW_LABELS[v])}</button>`;
  }).join('');

  return `
    <aside class="items-filters il-filter admin-events-filters" aria-label="Filter events">
      <div class="il-filter__head">
        <p class="il-filter__count" data-admin-event-count>${escapeHtml(countLabel)}</p>
        <button type="button" class="il-filter__reset" data-admin-event-reset title="Reset filters" aria-label="Reset filters">
          <img src="${escapeAttr(base)}assets/icons/filters/ResetButton.png" alt="" draggable="false" />
        </button>
      </div>
      <div class="il-filter__shade">
        <label class="cr-label" for="admin-events-search">Search</label>
        <input
          id="admin-events-search"
          class="cr-input"
          type="search"
          data-admin-event-search
          placeholder="Title or prize…"
          value="${escapeAttr(state.q)}"
          autocomplete="off"
        />
      </div>
      <div class="il-filter__shade admin-events-filters__menus">
        <div class="il-filter__grouping" data-admin-event-type-root>
          <button type="button" class="il-filter__group-trigger" data-admin-event-type-trigger aria-haspopup="listbox" aria-expanded="false">
            <img class="il-filter__group-arrow" src="${escapeAttr(base)}assets/icons/filters/DropdownArrow.png" alt="" draggable="false" />
            <span class="il-filter__sticker" data-admin-event-type-label>${escapeHtml(typeLabel)}</span>
          </button>
          <div class="il-filter__group-menu" data-admin-event-type-menu hidden role="listbox" aria-label="Event type">
            ${typeOptions}
          </div>
        </div>
        <div class="il-filter__grouping" data-admin-event-view-root>
          <button type="button" class="il-filter__group-trigger" data-admin-event-view-trigger aria-haspopup="listbox" aria-expanded="false">
            <img class="il-filter__group-arrow" src="${escapeAttr(base)}assets/icons/filters/DropdownArrow.png" alt="" draggable="false" />
            <span class="il-filter__sticker" data-admin-event-view-label>${escapeHtml(viewLabel)}</span>
          </button>
          <div class="il-filter__group-menu" data-admin-event-view-menu hidden role="listbox" aria-label="View events">
            ${viewOptions}
          </div>
        </div>
      </div>
      <div class="il-filter__shade">
        <p class="cr-label">Status</p>
        <div class="il-filter__checks" role="group" aria-label="Event status">
          ${statusBtns}
        </div>
      </div>
    </aside>`;
}

/**
 * @param {HTMLElement} rail
 * @param {AdminEventFilterState} state
 * @param {number} shown
 */
export function syncAdminEventFilters(rail, state, shown) {
  const count = rail.querySelector('[data-admin-event-count]');
  if (count) count.textContent = shown === 1 ? '1 event shown.' : `${shown} events shown.`;
  const typeLabelEl = rail.querySelector('[data-admin-event-type-label]');
  if (typeLabelEl) typeLabelEl.textContent = eventTypeLabel(state.type);
  const viewLabelEl = rail.querySelector('[data-admin-event-view-label]');
  if (viewLabelEl) viewLabelEl.textContent = EVENT_VIEW_LABELS[state.view] || 'Compact';
  rail.querySelectorAll('[data-admin-event-view]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const on = el.getAttribute('data-admin-event-view') === state.view;
    el.classList.toggle('is-active', on);
    el.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  rail.querySelectorAll('[data-admin-event-status]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const id = /** @type {EventStatus} */ (el.getAttribute('data-admin-event-status'));
    const on = state.statuses.includes(id);
    el.classList.toggle('is-on', on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  rail.querySelectorAll('[data-admin-event-type]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const raw = el.getAttribute('data-admin-event-type') || '';
    const on = raw === '' ? !state.type : state.type === raw;
    el.classList.toggle('is-active', on);
    el.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const search = rail.querySelector('[data-admin-event-search]');
  if (search instanceof HTMLInputElement && search.value !== state.q) search.value = state.q;
}

/**
 * @param {HTMLElement} rail
 * @param {{
 *   getState: () => AdminEventFilterState,
 *   onChange: (next: AdminEventFilterState) => void,
 * }} opts
 * @returns {() => void}
 */
export function bindAdminEventFilters(rail, opts) {
  /** @type {{ root: Element | null, trigger: Element | null, menu: Element | null, kind: 'type' | 'view' }[]} */
  const menus = [
    {
      kind: 'type',
      root: rail.querySelector('[data-admin-event-type-root]'),
      trigger: rail.querySelector('[data-admin-event-type-trigger]'),
      menu: rail.querySelector('[data-admin-event-type-menu]'),
    },
    {
      kind: 'view',
      root: rail.querySelector('[data-admin-event-view-root]'),
      trigger: rail.querySelector('[data-admin-event-view-trigger]'),
      menu: rail.querySelector('[data-admin-event-view-menu]'),
    },
  ];

  /** @param {{ menu: Element | null, trigger: Element | null }} m */
  function closeMenu(m) {
    if (m.menu instanceof HTMLElement) m.menu.hidden = true;
    if (m.trigger instanceof HTMLElement) m.trigger.setAttribute('aria-expanded', 'false');
  }

  /** @param {{ menu: Element | null, trigger: Element | null }} m */
  function openMenu(m) {
    for (const other of menus) {
      if (other !== m) closeMenu(other);
    }
    if (m.menu instanceof HTMLElement) m.menu.hidden = false;
    if (m.trigger instanceof HTMLElement) m.trigger.setAttribute('aria-expanded', 'true');
  }

  function closeAll() {
    for (const m of menus) closeMenu(m);
  }

  /** @param {MouseEvent} e */
  function onClick(e) {
    const t = e.target;
    if (!(t instanceof Element) || !rail.contains(t)) return;

    if (t.closest('[data-admin-event-reset]')) {
      closeAll();
      opts.onChange(defaultAdminEventFilters());
      return;
    }

    const opened = menus.find((m) => m.trigger instanceof Element && t.closest(triggerSel(m.kind)) && rail.contains(m.trigger));
    if (opened) {
      if (opened.menu instanceof HTMLElement && !opened.menu.hidden) closeMenu(opened);
      else openMenu(opened);
      return;
    }

    const typeOpt = t.closest('[data-admin-event-type]');
    if (typeOpt instanceof HTMLElement) {
      const raw = typeOpt.getAttribute('data-admin-event-type') || '';
      const type = EVENT_TYPES.includes(/** @type {EventType} */ (raw))
        ? /** @type {EventType} */ (raw)
        : null;
      closeAll();
      const cur = opts.getState();
      if (type === cur.type) return;
      opts.onChange({ ...cur, type });
      return;
    }

    const viewOpt = t.closest('[data-admin-event-view]');
    if (viewOpt instanceof HTMLElement) {
      const raw = viewOpt.getAttribute('data-admin-event-view') || '';
      if (!EVENT_VIEWS.includes(/** @type {AdminEventView} */ (raw))) return;
      closeAll();
      const cur = opts.getState();
      if (raw === cur.view) return;
      opts.onChange({ ...cur, view: /** @type {AdminEventView} */ (raw) });
      return;
    }

    const statusBtn = t.closest('[data-admin-event-status]');
    if (statusBtn instanceof HTMLElement) {
      const raw = /** @type {EventStatus} */ (statusBtn.getAttribute('data-admin-event-status'));
      if (!EVENT_STATUSES.includes(raw)) return;
      const cur = opts.getState();
      opts.onChange({ ...cur, statuses: toggleEventStatus(cur.statuses, raw) });
    }
  }

  /** @param {Event} e */
  function onSearch(e) {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !t.hasAttribute('data-admin-event-search')) return;
    const cur = opts.getState();
    opts.onChange({ ...cur, q: t.value });
  }

  /** @param {MouseEvent} e */
  function onDoc(e) {
    const t = e.target;
    if (!(t instanceof Node)) return;
    if (menus.some((m) => m.root instanceof HTMLElement && m.root.contains(t))) return;
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
 * @param {'type' | 'view'} kind
 */
function triggerSel(kind) {
  return kind === 'view' ? '[data-admin-event-view-trigger]' : '[data-admin-event-type-trigger]';
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
