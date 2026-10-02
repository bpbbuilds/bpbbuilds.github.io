/**
 * Sim-report filter rail — Item Library / builds chrome (Patch3, OptionsFont, cr-input).
 */

import { HERO_CLASSES } from '../items/filter-logic.js';
import { escapeAttr, escapeHtml } from './row.js';

/** @typedef {'all' | 'open' | 'fixed' | 'wontfix'} ReportStatusFilter */
/** @typedef {'any' | 'today' | '7d' | '30d'} ReportDateFilter */
/** @typedef {'any' | 'signed' | 'guest'} ReportReporterFilter */

/**
 * @typedef {{
 *   status: ReportStatusFilter,
 *   q: string,
 *   date: ReportDateFilter,
 *   heroClass: string | null,
 *   foes: string[],
 *   reporter: ReportReporterFilter,
 * }} ReportListFilters
 */

export const REPORT_STATUS_FILTERS = /** @type {const} */ ([
  { id: 'open', label: 'Open' },
  { id: 'fixed', label: 'Resolved' },
  { id: 'wontfix', label: 'Won’t fix' },
  { id: 'all', label: 'All' },
]);

export const REPORT_DATE_FILTERS = /** @type {const} */ ([
  { id: 'any', label: 'Any time' },
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
]);

export const REPORT_FOES = /** @type {const} */ ([
  { id: 'dummy', label: 'Dummy' },
  { id: 'build', label: 'Public build' },
  { id: 'mirror', label: 'Mirror' },
]);

export const REPORT_REPORTERS = /** @type {const} */ ([
  { id: 'any', label: 'Anyone' },
  { id: 'signed', label: 'Signed in' },
  { id: 'guest', label: 'Guest' },
]);

/** @returns {ReportListFilters} */
export function defaultReportListFilters() {
  return {
    status: 'open',
    q: '',
    date: 'any',
    heroClass: null,
    foes: [],
    reporter: 'any',
  };
}

/**
 * @param {ReportDateFilter} date
 * @returns {string | undefined}
 */
export function sinceIsoForDate(date) {
  const now = new Date();
  if (date === 'today') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  }
  if (date === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (date === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return undefined;
}

/**
 * @param {ReportListFilters} filters
 */
export function listQueryFromFilters(filters) {
  const q = String(filters.q || '').trim();
  const since = sinceIsoForDate(filters.date);
  return {
    filter: filters.status,
    q: q || undefined,
    since,
    hero_class: filters.heroClass || undefined,
    foe_mode: filters.foes.length ? filters.foes.join(',') : undefined,
    reporter: filters.reporter !== 'any' ? filters.reporter : undefined,
  };
}

/**
 * @param {string} root
 * @param {ReportListFilters} state
 * @param {number} shown
 */
export function reportFiltersHtml(root, state, shown) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const countLabel = shown === 1 ? '1 report shown.' : `${shown} reports shown.`;
  const dateLabel =
    REPORT_DATE_FILTERS.find((d) => d.id === state.date)?.label || 'Any time';

  const statusBtns = REPORT_STATUS_FILTERS.map((s) => {
    const on = state.status === s.id;
    return `<button type="button" class="il-filter__check${on ? ' is-on' : ''}" data-report-status-filter="${s.id}" aria-pressed="${on}">
      <span class="il-filter__box" aria-hidden="true"></span>
      <span class="il-filter__check-label">${escapeHtml(s.label)}</span>
    </button>`;
  }).join('');

  const dateOptions = REPORT_DATE_FILTERS.map(
    (d) =>
      `<button type="button" class="il-filter__group-option${state.date === d.id ? ' is-active' : ''}" data-report-date="${d.id}" role="option" aria-selected="${state.date === d.id}">${escapeHtml(d.label)}</button>`,
  ).join('');

  const classBtns = HERO_CLASSES.map((c) => {
    const on = state.heroClass === c;
    return `<button type="button" class="il-filter__icon-btn${on ? ' is-on' : ''}" data-report-class="${escapeAttr(c)}" title="${escapeAttr(c)}" aria-pressed="${on}">
      <img src="${escapeAttr(base)}assets/icons/classes/${escapeAttr(c)}Icon.png" alt="" draggable="false" />
    </button>`;
  }).join('');

  const foeBtns = REPORT_FOES.map((f) => {
    const on = state.foes.includes(f.id);
    return `<button type="button" class="il-filter__check${on ? ' is-on' : ''}" data-report-foe="${f.id}" aria-pressed="${on}">
      <span class="il-filter__box" aria-hidden="true"></span>
      <span class="il-filter__check-label">${escapeHtml(f.label)}</span>
    </button>`;
  }).join('');

  const reporterBtns = REPORT_REPORTERS.map((r) => {
    const on = state.reporter === r.id;
    return `<button type="button" class="il-filter__check${on ? ' is-on' : ''}" data-report-reporter="${r.id}" aria-pressed="${on}">
      <span class="il-filter__box" aria-hidden="true"></span>
      <span class="il-filter__check-label">${escapeHtml(r.label)}</span>
    </button>`;
  }).join('');

  const anyClassOn = !state.heroClass;

  return `
    <aside class="items-filters il-filter admin-report-filters" aria-label="Filter reports">
      <div class="il-filter__head">
        <p class="il-filter__count" data-filter-count>${escapeHtml(countLabel)}</p>
        <button type="button" class="il-filter__reset" data-report-filter-reset title="Reset filters" aria-label="Reset filters">
          <img src="${escapeAttr(base)}assets/icons/filters/ResetButton.png" alt="" draggable="false" />
        </button>
      </div>

      <div class="il-filter__shade cr-field-shade">
        <label class="cr-field">
          <span class="cr-label cr-label--sm">Search</span>
          <input
            type="search"
            class="cr-input"
            data-report-q
            maxlength="80"
            placeholder="Note, name, seed, board…"
            value="${escapeAttr(state.q)}"
            autocomplete="off"
            spellcheck="false"
          />
        </label>
      </div>

      <div class="admin-report-filters__split">
        <div class="il-filter__shade">
          <p class="il-filter__sticker">Status</p>
          <div class="il-filter__checks" role="group" aria-label="Report status">${statusBtns}</div>
        </div>
        <div class="il-filter__shade admin-report-filters__menus">
          <p class="il-filter__sticker">Date</p>
          <div class="il-filter__grouping" data-report-date-root>
            <button type="button" class="il-filter__group-trigger" data-report-date-trigger aria-haspopup="listbox" aria-expanded="false">
              <img class="il-filter__group-arrow" src="${escapeAttr(base)}assets/icons/filters/DropdownArrow.png" alt="" draggable="false" />
              <span class="il-filter__sticker" data-report-date-label>${escapeHtml(dateLabel)}</span>
            </button>
            <div class="il-filter__group-menu" data-report-date-menu hidden role="listbox" aria-label="Filed date">
              ${dateOptions}
            </div>
          </div>
        </div>
      </div>

      <div class="il-filter__shade">
        <p class="il-filter__sticker">Character</p>
        <div class="il-filter__classes" role="group" aria-label="Hero class">
          <button type="button" class="il-filter__icon-btn${anyClassOn ? ' is-on' : ''}" data-report-class="" title="Any class" aria-pressed="${anyClassOn}">
            <img src="${escapeAttr(base)}assets/icons/classes/NeutralIcon.png" alt="" draggable="false" />
          </button>
          ${classBtns}
        </div>
      </div>

      <div class="admin-report-filters__split">
        <div class="il-filter__shade">
          <p class="il-filter__sticker">Opponent</p>
          <div class="il-filter__checks" role="group" aria-label="Opponent">${foeBtns}</div>
        </div>
        <div class="il-filter__shade">
          <p class="il-filter__sticker">Reporter</p>
          <div class="il-filter__checks" role="group" aria-label="Reporter">${reporterBtns}</div>
        </div>
      </div>
    </aside>`;
}

/**
 * @param {HTMLElement} rail
 * @param {ReportListFilters} state
 * @param {number} shown
 */
export function syncReportFiltersUi(rail, state, shown) {
  const countEl = rail.querySelector('[data-filter-count]');
  if (countEl) {
    countEl.textContent = shown === 1 ? '1 report shown.' : `${shown} reports shown.`;
  }

  const q = rail.querySelector('[data-report-q]');
  if (q instanceof HTMLInputElement && q.value !== state.q) {
    q.value = state.q;
  }

  const dateLabel = rail.querySelector('[data-report-date-label]');
  if (dateLabel) {
    dateLabel.textContent =
      REPORT_DATE_FILTERS.find((d) => d.id === state.date)?.label || 'Any time';
  }

  rail.querySelectorAll('[data-report-date]').forEach((el) => {
    const on = el.getAttribute('data-report-date') === state.date;
    el.classList.toggle('is-active', on);
    el.setAttribute('aria-selected', on ? 'true' : 'false');
  });

  rail.querySelectorAll('[data-report-status-filter]').forEach((el) => {
    const on = el.getAttribute('data-report-status-filter') === state.status;
    el.classList.toggle('is-on', on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  rail.querySelectorAll('[data-report-class]').forEach((el) => {
    const raw = el.getAttribute('data-report-class') || '';
    const on = raw ? state.heroClass === raw : !state.heroClass;
    el.classList.toggle('is-on', on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  rail.querySelectorAll('[data-report-foe]').forEach((el) => {
    const id = el.getAttribute('data-report-foe') || '';
    const on = state.foes.includes(id);
    el.classList.toggle('is-on', on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  rail.querySelectorAll('[data-report-reporter]').forEach((el) => {
    const on = el.getAttribute('data-report-reporter') === state.reporter;
    el.classList.toggle('is-on', on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

/**
 * @param {HTMLElement} rail
 * @param {{
 *   getState: () => ReportListFilters,
 *   onChange: (next: ReportListFilters, meta?: { debounce?: boolean }) => void,
 *   defaultState: () => ReportListFilters,
 * }} opts
 * @returns {() => void}
 */
export function bindReportFilters(rail, opts) {
  const menu = {
    root: rail.querySelector('[data-report-date-root]'),
    trigger: rail.querySelector('[data-report-date-trigger]'),
    menu: rail.querySelector('[data-report-date-menu]'),
  };

  function closeMenu() {
    if (!(menu.menu instanceof HTMLElement) || !(menu.trigger instanceof HTMLElement)) return;
    menu.menu.hidden = true;
    menu.trigger.setAttribute('aria-expanded', 'false');
  }

  function openMenu() {
    if (!(menu.menu instanceof HTMLElement) || !(menu.trigger instanceof HTMLElement)) return;
    menu.menu.hidden = false;
    menu.trigger.setAttribute('aria-expanded', 'true');
  }

  /** @param {Event} e */
  function onClick(e) {
    const t = e.target;
    if (!(t instanceof Element)) return;

    if (t.closest('[data-report-filter-reset]') && rail.contains(t.closest('[data-report-filter-reset]'))) {
      closeMenu();
      opts.onChange(opts.defaultState());
      return;
    }

    const dateTrig = t.closest('[data-report-date-trigger]');
    if (dateTrig && rail.contains(dateTrig)) {
      if (menu.menu instanceof HTMLElement && !menu.menu.hidden) closeMenu();
      else openMenu();
      return;
    }

    const dateOpt = t.closest('[data-report-date]');
    if (dateOpt instanceof HTMLElement && rail.contains(dateOpt)) {
      const date = /** @type {ReportDateFilter} */ (dateOpt.getAttribute('data-report-date'));
      if (!REPORT_DATE_FILTERS.some((d) => d.id === date)) return;
      closeMenu();
      const cur = opts.getState();
      if (date === cur.date) return;
      opts.onChange({ ...cur, date });
      return;
    }

    const statusBtn = t.closest('[data-report-status-filter]');
    if (statusBtn instanceof HTMLElement && rail.contains(statusBtn)) {
      const status = /** @type {ReportStatusFilter} */ (statusBtn.getAttribute('data-report-status-filter'));
      if (!REPORT_STATUS_FILTERS.some((s) => s.id === status)) return;
      const cur = opts.getState();
      if (status === cur.status) return;
      opts.onChange({ ...cur, status });
      return;
    }

    const classBtn = t.closest('[data-report-class]');
    if (classBtn instanceof HTMLElement && rail.contains(classBtn)) {
      const raw = classBtn.getAttribute('data-report-class') || '';
      const heroClass = HERO_CLASSES.includes(raw) ? raw : null;
      const cur = opts.getState();
      if (heroClass === cur.heroClass) return;
      opts.onChange({ ...cur, heroClass });
      return;
    }

    const foeBtn = t.closest('[data-report-foe]');
    if (foeBtn instanceof HTMLElement && rail.contains(foeBtn)) {
      const id = foeBtn.getAttribute('data-report-foe') || '';
      if (!REPORT_FOES.some((f) => f.id === id)) return;
      const cur = opts.getState();
      const foes = cur.foes.includes(id) ? cur.foes.filter((x) => x !== id) : [...cur.foes, id];
      opts.onChange({ ...cur, foes });
      return;
    }

    const reporterBtn = t.closest('[data-report-reporter]');
    if (reporterBtn instanceof HTMLElement && rail.contains(reporterBtn)) {
      const reporter = /** @type {ReportReporterFilter} */ (
        reporterBtn.getAttribute('data-report-reporter')
      );
      if (!REPORT_REPORTERS.some((r) => r.id === reporter)) return;
      const cur = opts.getState();
      if (reporter === cur.reporter) return;
      opts.onChange({ ...cur, reporter });
    }
  }

  /** @param {Event} e */
  function onInput(e) {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || t.getAttribute('data-report-q') == null) return;
    const cur = opts.getState();
    opts.onChange({ ...cur, q: t.value }, { debounce: true });
  }

  /** @param {MouseEvent} e */
  function onDocPointer(e) {
    const t = e.target;
    if (!(t instanceof Node)) return;
    if (menu.root instanceof HTMLElement && menu.root.contains(t)) return;
    closeMenu();
  }

  rail.addEventListener('click', onClick);
  rail.addEventListener('input', onInput);
  document.addEventListener('pointerdown', onDocPointer);
  return () => {
    rail.removeEventListener('click', onClick);
    rail.removeEventListener('input', onInput);
    document.removeEventListener('pointerdown', onDocPointer);
  };
}
