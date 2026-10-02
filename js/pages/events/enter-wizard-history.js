/**
 * Pick-a-run step — same History shell as the create page.
 */

import { createHistoryShell } from '../create/history/shell.js';
import { mountHistoryRunList } from '../create/history/run-list.js';
import { mountHistoryPreview } from '../create/history/preview-pane.js';

/**
 * @param {HTMLElement} overlay
 * @param {{
 *   root: string,
 *   dbHandle: { db: any, runs: import('../create/history-db.js').HistoryRunSummary[] } | null,
 *   catalog: { itemsById: Map<string, object>, getSpriteUrl: (item: object) => string } | null,
 *   initialRunId?: number | null,
 *   initialRoundIndex?: number,
 *   onBack: () => void,
 *   onLoad: (payload: {
 *     run: import('../create/history-db.js').HistoryDecodedRun,
 *     placements: import('../create/draft-io.js').DraftPlacement[],
 *     roundIndex: number,
 *   }) => Promise<string>,
 * }} ctx
 * @returns {{ destroy: () => void, requestLoad: () => boolean } | null}
 */
export function attachEnterHistory(overlay, ctx) {
  const host = overlay.querySelector('[data-enter-history]');
  if (!(host instanceof HTMLElement) || !ctx.dbHandle || !ctx.catalog) return null;

  const { rootEl } = createHistoryShell(ctx.root);
  rootEl.removeAttribute('role');
  rootEl.removeAttribute('aria-modal');
  host.replaceChildren(rootEl);

  const listEl = rootEl.querySelector('[data-history-list]');
  const filtersEl = rootEl.querySelector('[data-history-filters]');
  const previewHost = rootEl.querySelector('[data-history-preview]');
  if (
    !(listEl instanceof HTMLElement) ||
    !(filtersEl instanceof HTMLElement) ||
    !(previewHost instanceof HTMLElement)
  ) {
    return null;
  }

  let dead = false;

  const preview = mountHistoryPreview({
    host: previewHost,
    db: ctx.dbHandle.db,
    itemsById: ctx.catalog.itemsById,
    getSpriteUrl: ctx.catalog.getSpriteUrl,
    root: ctx.root,
    lockLastRound: true,
    onCancel: () => {
      if (!dead) ctx.onBack();
    },
    onLoad: async (payload) => {
      if (dead) return;
      const err = await ctx.onLoad(payload);
      if (!err || dead) return;
      const status = previewHost.querySelector('[data-preview-status]');
      if (status instanceof HTMLElement) {
        status.hidden = false;
        status.textContent = err;
      }
    },
  });

  const list = mountHistoryRunList({
    listEl,
    filtersEl,
    db: ctx.dbHandle.db,
    summaries: ctx.dbHandle.runs,
    itemsById: ctx.catalog.itemsById,
    getSpriteUrl: ctx.catalog.getSpriteUrl,
    root: ctx.root,
    classUi: 'icons',
    onSelect: (runId) => {
      if (dead) return;
      const summary = ctx.dbHandle?.runs.find((r) => r.runId === runId);
      if (!summary) return;
      void preview.showSummary(summary);
    },
    onActivate: () => {
      if (!dead) preview.requestLoad();
    },
  });

  rootEl.querySelector('.create-history__close')?.addEventListener('click', () => {
    if (!dead) ctx.onBack();
  });

  const initialRunId = ctx.initialRunId;
  void (async () => {
    await list.ready();
    if (dead || initialRunId == null) return;
    list.selectRun(initialRunId);
  })();

  return {
    destroy() {
      if (dead) return;
      dead = true;
      list.destroy();
      preview.destroy();
      rootEl.remove();
    },
    requestLoad() {
      if (dead) return false;
      return preview.requestLoad();
    },
  };
}
