/**
 * History round strip on /sim/ — same W/L + video chrome as build view.
 * Round picks swap the bag in place and re-run combat (no full page reload).
 */

import { mountRoundScrubber } from '../../build/round-scrubber.js';
import {
  renderBuildVideo,
  setStageShowingVideo,
  hasBuildVideo,
} from '../../build/video.js';

/**
 * @param {ParentNode} bagHost
 * @param {ParentNode} roundHost
 */
function syncRoundPanelToBoard(bagHost, roundHost) {
  const board = bagHost.querySelector('.bpb-bg__board');
  const panel = roundHost.querySelector('.build-round-panel');
  if (!(board instanceof HTMLElement) || !(panel instanceof HTMLElement)) return;

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
 * Round strip + video shell under each sim bag (bag grid mounts inside media host).
 * @param {import('../../shell/board-load.js').SimBoardLoad} board
 */
export function simBagStageHtml(board) {
  const frames = board.historyFrames || [];
  const show = frames.length > 0 || hasBuildVideo({ youtube_url: board.youtubeUrl });
  if (!show) {
    return `<div class="build-bag sim-bag" data-sim-bag-slot aria-label="Sim backpack"></div>`;
  }

  return `
    <div class="sim-bag-stage">
      <div class="build-stage__media sim-bag-media" data-sim-media>
        <div class="build-bag sim-bag" data-sim-bag-slot aria-label="Sim backpack"></div>
        ${renderBuildVideo({
          youtube_url: board.youtubeUrl,
          title: board.title,
        })}
      </div>
      <div class="sim-round-host build-round-host" data-sim-round-host></div>
    </div>
  `;
}

/**
 * @param {HTMLElement} stageRoot `.sim-bag-stage` (or bag-only fallback)
 * @param {{
 *   board: import('../../shell/board-load.js').SimBoardLoad,
 *   root: string,
 *   bagHost: HTMLElement,
 *   onBoardChange?: (
 *     frame: { round: number, placements: object[] } | null,
 *     meta: { isVideo: boolean, published?: boolean },
 *   ) => void,
 * }} opts
 */
export function mountSimRoundPicker(stageRoot, opts) {
  const { board, root, bagHost, onBoardChange } = opts;
  const frames = board.historyFrames || [];
  const hasHistory = frames.length > 0;
  const hasVideo = hasBuildVideo({ youtube_url: board.youtubeUrl });
  if (!hasHistory && !hasVideo) return null;

  const roundHost = stageRoot.querySelector('[data-sim-round-host]');
  const mediaHost = stageRoot.querySelector('[data-sim-media]');
  if (!(roundHost instanceof HTMLElement)) return null;

  /** @param {boolean} visible */
  function applyItemsVisible(visible) {
    const boardEl = bagHost.querySelector('.bpb-bg');
    if (boardEl instanceof HTMLElement) {
      boardEl.classList.toggle('bpb-bg--hide-items', !visible);
    }
  }

  /** @param {boolean} visible */
  function applyBagsVisible(visible) {
    const boardEl = bagHost.querySelector('.bpb-bg');
    if (boardEl instanceof HTMLElement) {
      boardEl.classList.toggle('bpb-bg--hide-bags', !visible);
    }
  }

  const activeRound = board.round ?? null;
  const initialIndex =
    activeRound != null ? frames.findIndex((f) => f.round === activeRound) : -1;

  let roundPickerReady = false;

  const scrubber = mountRoundScrubber(roundHost, {
    frames: hasHistory ? frames : [{ round: 1, result: 'win', placements: [] }],
    root,
    showHistory: hasHistory,
    previewMode: true,
    hasVideo,
    initialIndex: hasHistory ? initialIndex : 0,
    itemsVisible: true,
    bagsVisible: true,
    simPicker: hasHistory
      ? {
          activeRound,
        }
      : undefined,
    onItemsVisibleChange: applyItemsVisible,
    onBagsVisibleChange: applyBagsVisible,
    onChange(frame, _index, meta) {
      setStageShowingVideo(
        mediaHost instanceof HTMLElement ? mediaHost : null,
        Boolean(meta?.isVideo),
      );
      if (!roundPickerReady) {
        roundPickerReady = true;
        return;
      }
      if (!meta?.isVideo) onBoardChange?.(frame, meta);
    },
  });

  const unbindResize = syncRoundPanelToBoard(bagHost, roundHost);

  return {
    scrubber,
    destroy() {
      unbindResize?.();
      scrubber?.destroy?.();
    },
  };
}
