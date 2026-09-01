/**
 * History run list + class / mode filter dropdowns.
 */

import { HERO_CLASSES } from '../../items/filter-logic.js';
import { buildRowModel } from './run-model.js';
import { createRunRow, setRunRowSelected } from './run-row.js';
import { loadHistoryCatalog } from '../history-decode.js';
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

  /** @type {ReturnType<typeof mountFilterDropdown>[]} */
  const dropdowns = [];

  filtersEl.replaceChildren();
  const classDd = mountFilterDropdown({
    root: base,
    label: 'Class',
    ariaLabel: 'Filter by class',
    value: '',
    options: [
      { value: '', label: 'All Classes' },
      ...HERO_CLASSES.map((c) => ({ value: c, label: c })),
    ],
    onChange: (v) => {
      classFilter = v || '';
      void paintList().then(() => {
        const first = filteredSummaries()[0];
        if (first) selectRun(first.runId);
      });
    },
  });
  const modeDd = mountFilterDropdown({
    root: base,
    label: 'Mode',
    ariaLabel: 'Filter by mode',
    value: '',
    disabled: true,
    options: [{ value: '', label: 'All Modes' }],
    onChange: () => {},
  });
  dropdowns.push(classDd, modeDd);
  filtersEl.append(classDd.el, modeDd.el);

  /**
   * @returns {import('../history-db.js').HistoryRunSummary[]}
   */
  function filteredSummaries() {
    if (!classFilter) return summaries;
    return summaries.filter((s) => s.heroClass === classFilter);
  }

  async function paintList() {
    listEl.replaceChildren();
    rowEls = [];
    const cat = await loadHistoryCatalog(base);
    const list = filteredSummaries();
    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'create-history__list-empty';
      empty.textContent = summaries.length
        ? 'No runs match this filter.'
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
    },
    getSelectedId() {
      return selectedId;
    },
    selectRun,
    destroy() {
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
