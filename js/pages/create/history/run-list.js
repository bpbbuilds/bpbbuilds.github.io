/**
 * History run list. Create uses a multi-select class icon grid.
 * Event entry keeps the single-select icon row (`classUi: 'icons'`).
 */

import { HERO_CLASSES } from '../../items/filter-logic.js';
import { buildSearchFieldHtml, mountBuildSearchInput } from '../../../shared/build-search-input.js';
import { historyRunMatchesSearch, historyRunSearchRank, indexHistoryItemIds } from './history-search.js';
import { buildRowModel } from './run-model.js';
import { createRunRow, setRunRowSelected } from './run-row.js';
import {
  ensureHistoryCatalogItems,
  loadHistoryCatalog,
} from '../history-decode.js';
import { mountFilterDropdown } from './filter-dropdown.js';

/**
 * @param {{
 *   listEl: HTMLElement,
 *   filtersEl: HTMLElement,
 *   db: any,
 *   summaries: import('../history-db.js').HistoryRunSummary[],
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   root: string,
 *   onSelect: (runId: number, roundIndex?: number) => void,
 *   onActivate?: (runId: number) => void,
 *   classUi?: 'dropdown' | 'icons',
 * }} opts
 */
export function mountHistoryRunList(opts) {
  const {
    listEl,
    filtersEl,
    db,
    summaries,
    itemsById,
    getSpriteUrl,
    root,
    onSelect,
    onActivate,
    classUi = 'dropdown',
  } = opts;
  const base = root.endsWith('/') ? root : `${root}/`;

  /** @type {Map<number, import('./run-model.js').HistoryRowModel>} */
  const models = new Map();
  /** @type {HTMLButtonElement[]} */
  let rowEls = [];
  /** @type {number | null} */
  let selectedId = null;
  /** @type {string} */
  let classFilter = '';
  /** Empty set shows every class. Create page only. */
  const classFilters = new Set();
  /** @type {import('../../../shared/build-search.js').ParsedBuildSearch} */
  let searchParsed = { free: [], users: [], itemIds: [], itemQueries: [] };
  /** @type {Map<number, Set<string>>} */
  const itemIndex = new Map();
  let destroyed = false;
  let indexTick = 0;

  /** @type {ReturnType<typeof mountFilterDropdown>[]} */
  const dropdowns = [];

  const searchHost = document.createElement('div');
  searchHost.className = 'create-history__search';
  searchHost.innerHTML = buildSearchFieldHtml(
    'Class, rank, [Item]…',
    '[Item] with icon · class, rank, or item name',
  );
  const searchInput = mountBuildSearchInput(searchHost, {
    items: [...itemsById.values()],
    getSpriteUrl,
    placeholder: 'Class, rank, [Item]…',
    onChange(_q, parsed) {
      searchParsed = parsed;
      void refreshList();
    },
  });

  filtersEl.replaceChildren();
  if (classUi === 'icons') {
    const tools = document.createElement('div');
    tools.className = 'create-history__tools';
    const classRow = document.createElement('div');
    classRow.className = 'il-filter__classes create-history__classes';
    classRow.setAttribute('role', 'group');
    classRow.setAttribute('aria-label', 'Hero class');
    const anyBtn = `<button type="button" class="il-filter__icon-btn is-on" data-history-class="" title="Any class" aria-pressed="true">
      <img src="${base}assets/icons/classes/NeutralIcon.png" alt="" draggable="false" />
    </button>`;
    const classBtns = HERO_CLASSES.map(
      (c) => `<button type="button" class="il-filter__icon-btn" data-history-class="${c}" title="${c}" aria-pressed="false">
        <img src="${base}assets/icons/classes/${c}Icon.png" alt="" draggable="false" />
      </button>`,
    ).join('');
    classRow.innerHTML = anyBtn + classBtns;
    classRow.addEventListener('click', (ev) => {
      const btn = ev.target instanceof Element ? ev.target.closest('[data-history-class]') : null;
      if (!(btn instanceof HTMLButtonElement)) return;
      const raw = btn.getAttribute('data-history-class') || '';
      classFilter = HERO_CLASSES.includes(raw) ? raw : '';
      classRow.querySelectorAll('[data-history-class]').forEach((el) => {
        const id = el.getAttribute('data-history-class') || '';
        const on = id ? id === classFilter : !classFilter;
        el.classList.toggle('is-on', on);
        el.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      void refreshList();
    });
    tools.append(searchHost, classRow);
    listEl.parentElement?.insertBefore(tools, listEl);
  } else {
    const classRow = document.createElement('div');
    classRow.className = 'il-filter__classes create-history__class-grid';
    classRow.setAttribute('role', 'group');
    classRow.setAttribute('aria-label', 'Filter by class');
    classRow.innerHTML = HERO_CLASSES.map(
      (c) => `<button type="button" class="il-filter__icon-btn" data-history-class="${c}" aria-label="${c}" title="${c}" aria-pressed="false">
        <img src="${base}assets/icons/classes/${c}Icon.png" alt="" draggable="false" />
      </button>`,
    ).join('');
    classRow.addEventListener('click', (ev) => {
      const btn = ev.target instanceof Element ? ev.target.closest('[data-history-class]') : null;
      if (!(btn instanceof HTMLButtonElement)) return;
      const raw = btn.getAttribute('data-history-class') || '';
      if (!HERO_CLASSES.includes(raw)) return;
      if (classFilters.has(raw)) classFilters.delete(raw);
      else classFilters.add(raw);
      classRow.querySelectorAll('[data-history-class]').forEach((el) => {
        const id = el.getAttribute('data-history-class') || '';
        const on = classFilters.has(id);
        el.classList.toggle('is-on', on);
        el.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      void refreshList();
    });
    listEl.parentElement?.insertBefore(searchHost, listEl);
    listEl.parentElement?.insertBefore(classRow, searchHost);
    const modeDd = mountFilterDropdown({
      root: base,
      label: 'Mode',
      ariaLabel: 'Filter by mode',
      value: '',
      disabled: true,
      options: [{ value: '', label: 'All Modes' }],
      onChange: () => {},
    });
    dropdowns.push(modeDd);
    filtersEl.append(modeDd.el);
  }

  function searchActive() {
    return Boolean(
      searchParsed.free.length ||
        searchParsed.itemIds.length ||
        searchParsed.itemQueries.length,
    );
  }

  /**
   * @returns {import('../history-db.js').HistoryRunSummary[]}
   */
  function filteredSummaries() {
    const list = summaries.filter((s) => {
      if (classUi === 'icons') {
        if (classFilter && s.heroClass !== classFilter) return false;
      } else if (classFilters.size && !classFilters.has(s.heroClass || '')) {
        return false;
      }
      if (!searchActive()) return true;
      const ids = itemIndex.get(s.runId) || new Set();
      return historyRunMatchesSearch(s, ids, searchParsed, itemsById);
    });
    if (!searchActive() || !searchParsed.free.length) return list;
    return list
      .map((s, i) => ({
        s,
        i,
        rank: historyRunSearchRank(s, itemIndex.get(s.runId) || new Set(), searchParsed, itemsById),
      }))
      .sort((a, b) => b.rank - a.rank || a.i - b.i)
      .map((row) => row.s);
  }

  async function refreshList() {
    const keepId = selectedId;
    await paintList();
    if (destroyed) return;
    const list = filteredSummaries();
    if (!list.length) return;
    if (!list.some((s) => s.runId === keepId)) selectRun(list[0].runId);
  }

  async function paintList() {
    listEl.replaceChildren();
    rowEls = [];
    const cat = await loadHistoryCatalog(base);
    ensureHistoryCatalogItems(itemsById, cat);
    searchInput.setItems([...itemsById.values()]);
    const list = filteredSummaries();
    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'create-history__list-empty';
      empty.textContent = summaries.length
        ? 'No runs match this search.'
        : 'No runs found in this file.';
      listEl.append(empty);
      return;
    }

    for (const summary of list) {
      let model = models.get(summary.runId);
      if (!model) {
        model = await buildRowModel({
          db,
          summary,
          itemsById,
          root: base,
          catalog: cat,
        });
        models.set(summary.runId, model);
      }
      const row = createRunRow(model, {
        root: base,
        getSpriteUrl,
        itemsById,
        selected: selectedId === summary.runId,
      });
      rowEls.push(row);
      listEl.append(row);
    }
  }

  /**
   * @param {number} runId
   * @param {number} [roundIndex]
   */
  function selectRun(runId, roundIndex) {
    selectedId = runId;
    for (const el of rowEls) {
      setRunRowSelected(el, Number(el.dataset.runId) === runId);
    }
    onSelect(runId, roundIndex);
  }

  /** @param {MouseEvent} e */
  function onListClick(e) {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const wl = t.closest('[data-round-index]');
    const row = t.closest('[data-run-id]');
    if (!(row instanceof HTMLButtonElement)) return;
    const runId = Number(row.dataset.runId);
    if (!Number.isFinite(runId)) return;
    if (wl instanceof HTMLElement) {
      e.preventDefault();
      const ri = Number(wl.getAttribute('data-round-index'));
      selectRun(runId, Number.isFinite(ri) ? ri : undefined);
      return;
    }
    selectRun(runId);
  }

  /** @param {KeyboardEvent} e */
  function onListKey(e) {
    if (!rowEls.length) return;
    const idx = rowEls.findIndex(
      (el) => Number(el.dataset.runId) === selectedId,
    );
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = rowEls[Math.min(rowEls.length - 1, Math.max(0, idx) + 1)];
      if (next) {
        selectRun(Number(next.dataset.runId));
        next.focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = rowEls[Math.max(0, (idx < 0 ? 0 : idx) - 1)];
      if (prev) {
        selectRun(Number(prev.dataset.runId));
        prev.focus();
      }
    } else if (e.key === 'Enter' && selectedId != null) {
      e.preventDefault();
      onActivate?.(selectedId);
    }
  }

  listEl.addEventListener('click', onListClick);
  listEl.addEventListener('keydown', onListKey);

  return {
    async ready() {
      await paintList();
      const first = filteredSummaries()[0];
      if (first) selectRun(first.runId);
      void indexHistoryItemIds(db, summaries, base, {
        idsByRun: itemIndex,
        isCancelled: () => destroyed,
        onProgress() {
          if (!searchActive() || destroyed) return;
          indexTick += 1;
          if (indexTick % 4 !== 0) return;
          void refreshList();
        },
      }).then(() => {
        if (searchActive() && !destroyed) void refreshList();
      });
    },
    getSelectedId() {
      return selectedId;
    },
    selectRun,
    destroy() {
      destroyed = true;
      searchInput.destroy();
      searchHost.remove();
      listEl.removeEventListener('click', onListClick);
      listEl.removeEventListener('keydown', onListKey);
      for (const d of dropdowns) d.destroy();
      dropdowns.length = 0;
      listEl.replaceChildren();
      filtersEl.replaceChildren();
      models.clear();
      rowEls = [];
    },
  };
}
