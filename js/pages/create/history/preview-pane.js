/**
 * Right pane: read-only bag + round scrubber + Load CTA.
 */

import { mountPlacedGrid } from '../../../shared/backpack-grid/index.js';
import {
  framesFromHistoryRun,
  mountRoundScrubber,
} from '../../build/round-scrubber.js';
import { BOARD_COLS, BOARD_ROWS } from '../collision.js';
import { sumBoardGold } from '../draft-gold.js';
import { decodeHistoryRun } from '../history-db.js';
import { skelBar, skelBlock, skelRegion } from '../../../shared/skeleton.js';

/**
 * @param {{
 *   host: HTMLElement,
 *   db: any,
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   root: string,
 *   onLoad: (payload: {
 *     run: import('../history-db.js').HistoryDecodedRun,
 *     placements: import('../draft-io.js').DraftPlacement[],
 *     roundIndex: number,
 *   }) => void,
 *   onCancel: () => void,
 *   lockLastRound?: boolean,
 * }} opts
 */
export function mountHistoryPreview(opts) {
  const { host, db, itemsById, getSpriteUrl, root, onLoad, onCancel } = opts;
  const lockLastRound = Boolean(opts.lockLastRound);
  const base = root.endsWith('/') ? root : `${root}/`;

  host.innerHTML = `
    <div class="create-history__preview-inner">
      <div class="create-history__preview-status" data-preview-status role="status">Select a run</div>
      <div class="create-history__bag-host" data-preview-bag hidden></div>
      <div class="create-history__preview-stats" data-preview-stats hidden></div>
      ${lockLastRound ? '' : '<div class="create-history__round-host" data-preview-round hidden></div>'}
      <div class="create-history__preview-actions">
        <button type="button" class="create-history__load" data-history-load disabled>Load</button>
        <button type="button" class="create-history__cancel" data-history-close>Cancel</button>
      </div>
    </div>
  `;

  const statusEl = host.querySelector('[data-preview-status]');
  const bagHost = host.querySelector('[data-preview-bag]');
  const statsEl = host.querySelector('[data-preview-stats]');
  const roundHost = host.querySelector('[data-preview-round]');
  const loadBtn = host.querySelector('[data-history-load]');

  /** @type {Map<number, import('../history-db.js').HistoryDecodedRun>} */
  const decodeCache = new Map();
  /** @type {ReturnType<typeof mountPlacedGrid> | null} */
  let grid = null;
  /** @type {ReturnType<typeof mountRoundScrubber> | null} */
  let scrubber = null;
  /** @type {import('../history-db.js').HistoryDecodedRun | null} */
  let currentRun = null;
  let busy = false;
  /** @type {number} */
  let gen = 0;

  /**
   * @param {import('../draft-io.js').DraftPlacement[]} placements
   */
  function paintStats(placements) {
    if (!(statsEl instanceof HTMLElement)) return;
    const gold = sumBoardGold(placements, itemsById);
    const ids = placements.map((p) => p.id).filter(Boolean);
    const distinct = new Set(ids).size;
    const goldSrc = `${base}assets/tooltips/icons/Gold.png`;
    const itemsSrc = `${base}assets/icons/history/Sword.png`;
    const distinctSrc = `${base}assets/icons/misc/Backpack_icon.png`;
    statsEl.hidden = false;
    statsEl.innerHTML = `
      <span class="create-history__pstat" title="Inventory value">
        <img src="${goldSrc}" alt="" width="20" height="20" draggable="false" />
        <strong>${gold}</strong>
      </span>
      <span class="create-history__pstat" title="Items">
        <img src="${itemsSrc}" alt="" width="20" height="20" draggable="false" />
        <strong>${ids.length}</strong>
      </span>
      <span class="create-history__pstat" title="Distinct items">
        <img src="${distinctSrc}" alt="" width="20" height="20" draggable="false" />
        <strong>${distinct}</strong>
      </span>
    `;
  }

  function clearPreview() {
    scrubber?.destroy();
    scrubber = null;
    grid?.destroy();
    grid = null;
    currentRun = null;
    if (bagHost instanceof HTMLElement) {
      bagHost.hidden = true;
      bagHost.replaceChildren();
    }
    if (roundHost instanceof HTMLElement) {
      roundHost.hidden = true;
      roundHost.replaceChildren();
    }
    if (statsEl instanceof HTMLElement) {
      statsEl.hidden = true;
      statsEl.replaceChildren();
    }
    if (loadBtn instanceof HTMLButtonElement) loadBtn.disabled = true;
  }

  /**
   * @param {string} msg
   * @param {boolean} [busySkel]
   */
  function setStatus(msg, busySkel = false) {
    if (!(statusEl instanceof HTMLElement)) return;
    statusEl.hidden = false;
    if (busySkel) {
      statusEl.innerHTML = skelRegion(
        `${skelBlock({ height: '8rem' })}${skelBar({ width: '60%' })}`,
        { label: msg },
      );
    } else {
      statusEl.textContent = msg;
    }
  }

  /**
   * @param {import('../history-db.js').HistoryDecodedRun} run
   * @param {number} [initialIndex]
   */
  function mountRun(run, initialIndex) {
    if (!(bagHost instanceof HTMLElement)) return;
    if (!lockLastRound && !(roundHost instanceof HTMLElement)) return;
    clearPreview();
    currentRun = run;
    const frames = framesFromHistoryRun(run);
    if (!frames.length) {
      setStatus('No board frames in that run.');
      return;
    }
    if (statusEl instanceof HTMLElement) statusEl.hidden = true;

    const startIdx = lockLastRound
      ? frames.length - 1
      : Math.max(
          0,
          Math.min(frames.length - 1, initialIndex ?? frames.length - 1),
        );
    const start = frames[startIdx];

    bagHost.hidden = false;

    grid = mountPlacedGrid(bagHost, {
      placements: start.placements,
      itemsById,
      cols: BOARD_COLS,
      rows: BOARD_ROWS,
      getSpriteUrl,
      fillWidth: !lockLastRound,
      fitHost: lockLastRound,
      exactBoard: true,
      reserveScrollGap: false,
      cellPx: 40,
    });

    if (!lockLastRound) {
      roundHost.hidden = false;
      scrubber = mountRoundScrubber(roundHost, {
        frames,
        root: base,
        showHistory: true,
        previewMode: true,
        hasVideo: false,
        initialIndex: startIdx,
        onItemsVisibleChange: (v) => {
          grid?.el.classList.toggle('bpb-bg--hide-items', !v);
        },
        onBagsVisibleChange: (v) => {
          grid?.el.classList.toggle('bpb-bg--hide-bags', !v);
        },
        onChange(frame) {
          if (!frame || !grid) return;
          grid.update(frame.placements, itemsById, { appear: true });
          paintStats(frame.placements);
        },
      });
    }

    paintStats(start.placements);
    if (loadBtn instanceof HTMLButtonElement) loadBtn.disabled = false;
  }

  /**
   * @param {import('../history-db.js').HistoryRunSummary} summary
   * @param {number} [roundIndex]
   */
  async function showSummary(summary, roundIndex) {
    const my = ++gen;
    let run = decodeCache.get(summary.runId);
    if (!run) {
      clearPreview();
      setStatus('Decoding board…', true);
      busy = true;
      try {
        run = await decodeHistoryRun(db, summary, base);
        decodeCache.set(summary.runId, run);
      } catch (err) {
        if (my !== gen) return;
        setStatus(
          err instanceof Error ? err.message : 'Could not decode that run.',
        );
        busy = false;
        return;
      }
      busy = false;
    }
    if (my !== gen) return;
    mountRun(run, lockLastRound ? undefined : roundIndex);
  }

  function requestLoad() {
    if (!currentRun) return false;
    if (lockLastRound) {
      const frames = framesFromHistoryRun(currentRun);
      const idx = Math.max(0, frames.length - 1);
      const frame = frames[idx];
      if (!frame?.placements?.length) return false;
      onLoad({
        run: currentRun,
        placements: frame.placements,
        roundIndex: idx,
      });
      return true;
    }
    if (!scrubber) return false;
    const frame = scrubber.frame;
    const idx = scrubber.index;
    if (!frame?.placements?.length) return false;
    onLoad({
      run: currentRun,
      placements: frame.placements,
      roundIndex: idx,
    });
    return true;
  }

  loadBtn?.addEventListener('click', () => requestLoad());
  host.querySelector('[data-history-close]')?.addEventListener('click', () => {
    onCancel();
  });

  return {
    showSummary,
    requestLoad,
    goToRound(index) {
      scrubber?.goTo(index);
    },
    destroy() {
      gen += 1;
      clearPreview();
      decodeCache.clear();
      host.replaceChildren();
    },
  };
}
