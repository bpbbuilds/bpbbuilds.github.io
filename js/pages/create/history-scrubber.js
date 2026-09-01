/**
 * Create-board W/L scrubber when draft.history is attached (Load or remix).
 * Reuses build-page round scrubber in previewMode — viewing only; board edits
 * clear draft.history via editor-state and tear this down.
 */

import {
  framesFromHistoryRun,
  mountRoundScrubber,
} from '../build/round-scrubber.js';

/**
 * @param {import('./draft-io.js').DraftPlacement[] | undefined} a
 * @param {{ id: string, x: number, y: number, r?: number }[] | undefined} b
 */
function placementSig(a) {
  return (a || [])
    .map((p) => `${p.id}:${Number(p.x)},${Number(p.y)},${Number(p.r) || 0}`)
    .sort()
    .join('|');
}

/**
 * Prefer the frame matching current draft placements (mid-Load); else last.
 * @param {{ placements?: { id: string, x: number, y: number, r?: number }[] }[]} frames
 * @param {import('./draft-io.js').DraftPlacement[]} placements
 */
export function matchHistoryRoundIndex(frames, placements) {
  if (!frames?.length) return 0;
  const want = placementSig(placements);
  if (!want) return frames.length - 1;
  for (let i = 0; i < frames.length; i += 1) {
    if (placementSig(frames[i].placements) === want) return i;
  }
  return frames.length - 1;
}

/** Match build-page: keep scrubber panel width = board width. */
function syncRoundPanelToBoard(bagHost, roundHost) {
  const board = bagHost.querySelector('.bpb-bg__board');
  const panel = roundHost.querySelector('.build-round-panel');
  if (!(board instanceof HTMLElement) || !(panel instanceof HTMLElement)) {
    return () => {};
  }
  const apply = () => {
    const w = board.getBoundingClientRect().width;
    if (w > 1) panel.style.width = `${Math.round(w)}px`;
  };
  apply();
  const ro = new ResizeObserver(apply);
  ro.observe(board);
  return () => ro.disconnect();
}

/**
 * @param {{
 *   host: HTMLElement,
 *   bagHost: HTMLElement,
 *   grid: { update: Function, el: HTMLElement },
 *   itemsById: Map<string, object>,
 *   root: string,
 *   getPlacements: () => import('./draft-io.js').DraftPlacement[],
 *   onFrame?: (placements: object[]) => void,
 * }} opts
 */
export function createHistoryScrubberController(opts) {
  const { host, bagHost, grid, itemsById, root, getPlacements, onFrame } = opts;

  /** @type {ReturnType<typeof mountRoundScrubber> | null} */
  let scrubber = null;
  /** @type {(() => void) | null} */
  let unsyncWidth = null;
  /** @type {string | null} */
  let mountedSig = null;

  function historySig(history) {
    if (!history?.rounds?.length) return null;
    return `${history.runId || 0}:${history.rounds.length}:${history.rounds[0]?.round}:${history.rounds[history.rounds.length - 1]?.round}`;
  }

  function destroy() {
    unsyncWidth?.();
    unsyncWidth = null;
    scrubber?.destroy();
    scrubber = null;
    mountedSig = null;
    host.hidden = true;
    host.replaceChildren();
  }

  /**
   * @param {import('./draft-io.js').DraftHistory | null | undefined} history
   */
  function sync(history) {
    const sig = historySig(history);
    if (!sig) {
      destroy();
      return;
    }
    if (sig === mountedSig && scrubber) return;

    destroy();
    const frames = framesFromHistoryRun(history);
    if (!frames.length) return;

    const initialIndex = matchHistoryRoundIndex(frames, getPlacements());
    host.hidden = false;
    scrubber = mountRoundScrubber(host, {
      frames,
      root,
      showHistory: true,
      previewMode: true,
      hasVideo: false,
      initialIndex,
      onItemsVisibleChange: (v) => {
        grid.el.classList.toggle('bpb-bg--hide-items', !v);
      },
      onBagsVisibleChange: (v) => {
        grid.el.classList.toggle('bpb-bg--hide-bags', !v);
      },
      onChange(frame) {
        if (!frame) return;
        grid.update(frame.placements, itemsById, { appear: true });
        onFrame?.(frame.placements);
      },
    });
    mountedSig = sig;
    unsyncWidth = syncRoundPanelToBoard(bagHost, host);

    const start = frames[initialIndex];
    if (start) {
      grid.update(start.placements, itemsById, { appear: true });
      onFrame?.(start.placements);
    }
  }

  return {
    sync,
    destroy,
    get active() {
      return Boolean(scrubber);
    },
  };
}
