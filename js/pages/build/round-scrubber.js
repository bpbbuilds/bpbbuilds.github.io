/**
 * Round scrubber under the build board:
 *   W/L strip (click a round) + ‹ Round X/Y › chevrons
 * (game BuildHistory round buttons + Previous/Next).
 * Optional last step: Video (same stage slot as the bag).
 * Right of the round label: vote + Remix + Share.
 * Featured Play (premium die CTA) sits centered under the round row.
 */

import { bindShareBuild } from './share.js';
import { bindBuildVote, voteControlHtml } from './vote.js';
import { premiumCtaFxHtml } from '../../shared/premium-cta.js';
import { requirePremium, resumePremiumIntent } from '../../shared/premium-gate.js';
import { buildSimPlayHref } from '../sim/shell/sim-permalink.js';
import { isTypingTarget } from '../../shared/is-typing-target.js';

const BUILD_PLAY_INTENT = 'build-play-sim';
const BUILD_PLAY_REASON = 'Play this build in the combat sandbox.';

/**
 * @typedef {'win' | 'loss'} RoundResult
 * @typedef {{
 *   round: number,
 *   result: RoundResult,
 *   placements: { id: string, x: number, y: number, key?: string, r?: number }[],
 * }} RoundFrame
 */

/**
 * Real per-round boards from a decoded history.db export.
 *
 * @param {{
 *   rounds?: {
 *     round: number,
 *     result: string,
 *     placements: { id: string, x: number, y: number, key?: string, r?: number }[],
 *   }[],
 * } | null} historyRun
 * @returns {RoundFrame[]}
 */
export function framesFromHistoryRun(historyRun) {
  const rounds = historyRun?.rounds;
  if (!Array.isArray(rounds) || !rounds.length) return [];
  return rounds.map((r) => ({
    round: Number(r.round) || 1,
    result: r.result === 'win' ? /** @type {RoundResult} */ ('win') : /** @type {RoundResult} */ ('loss'),
    placements: (r.placements || [])
      .filter((p) => p?.id)
      .map((p) => ({
        id: p.id,
        x: Number(p.x) || 0,
        y: Number(p.y) || 0,
        r: Number(p.r) || 0,
        key: p.key != null ? String(p.key) : undefined,
        gems: Array.isArray(p.gems) ? p.gems : undefined,
      })),
  }));
}

/**
 * Single final-board frame when a build has no combat history upload.
 *
 * @param {{ id: string, x: number, y: number, r?: number, key?: string, gems?: string[] }[]} placements
 * @returns {RoundFrame[]}
 */
export function finalBoardFrames(placements) {
  return [
    {
      round: 1,
      result: /** @type {RoundResult} */ ('win'),
      placements: placements || [],
    },
  ];
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   frames: RoundFrame[],
 *   initialIndex?: number,
 *   root?: string,
 *   showHistory?: boolean,
 *   itemsVisible?: boolean,
 *   bagsVisible?: boolean,
 *   hasVideo?: boolean,
 *   onChange: (frame: RoundFrame | null, index: number, meta: { isVideo: boolean }) => void,
 *   onItemsVisibleChange?: (visible: boolean) => void,
 *   onBagsVisibleChange?: (visible: boolean) => void,
 *   buildKey?: string,
 *   voteScore?: number,
 *   previewMode?: boolean,
 *   simPicker?: {
 *     activeRound: number | null,
 *     onRoundNavigate: (round: number) => void,
 *   },
 * }} opts
 */
export function mountRoundScrubber(host, opts) {
  const frames = opts.frames?.length
    ? opts.frames
    : [{ round: 1, result: /** @type {RoundResult} */ ('loss'), placements: [] }];
  const showHistory = Boolean(opts.showHistory);
  const previewMode = Boolean(opts.previewMode);
  const simPicker = opts.simPicker || null;
  const hasVideo = Boolean(opts.hasVideo);
  const stepCount = frames.length + (hasVideo ? 1 : 0);
  const videoIndex = hasVideo ? frames.length : -1;
  const root = opts.root?.endsWith('/') ? opts.root : `${opts.root || '../../'}/`;
  const winSrc = `${root}assets/icons/history/RoundResultTriangle.png`;
  const lossSrc = `${root}assets/icons/history/RoundResultTriangle_Loss.png`;
  const videoSrc = `${root}assets/icons/history/RoundResultVideo.png`;
  let itemsVisible = opts.itemsVisible !== false;
  let bagsVisible = opts.bagsVisible !== false;

  /** @type {number} -1 = published / no history round selected (sim only) */
  let index;
  if (simPicker && simPicker.activeRound == null) {
    index = -1;
  } else if (opts.initialIndex != null && Number.isFinite(Number(opts.initialIndex))) {
    index = Math.max(-1, Math.min(frames.length - 1, Number(opts.initialIndex)));
  } else {
    index = Math.max(0, Math.min(frames.length - 1, frames.length - 1));
  }

  const displayMax = hasVideo
    ? (frames[frames.length - 1]?.round ?? frames.length) + 1
    : frames[frames.length - 1]?.round ?? frames.length;

  const stripHtml = showHistory
    ? frames
        .map((f, i) => {
          const src = f.result === 'win' ? winSrc : lossSrc;
          const label = `Round ${f.round} — ${f.result === 'win' ? 'Win' : 'Loss'}`;
          return `<button
        type="button"
        class="build-round-strip__btn"
        data-index="${i}"
        aria-label="${label}"
        title="${label}"
      ><img src="${src}" alt="" width="28" height="48" draggable="false" /></button>`;
        })
        .join('') +
      (hasVideo
        ? `<button
        type="button"
        class="build-round-strip__btn build-round-strip__btn--video"
        data-index="${videoIndex}"
        aria-label="Showcase video"
        title="Video"
      ><img src="${videoSrc}" alt="" width="40" height="80" draggable="false" /></button>`
        : '')
    : '';

  host.innerHTML = `
    <div class="build-round-panel${showHistory ? '' : ' build-round-panel--final'}">
      ${
        showHistory
          ? `<div class="build-round-strip" role="list" aria-label="Round results">${stripHtml}</div>`
          : ''
      }
      <div class="build-round" role="group" aria-label="${showHistory ? 'Round' : 'Board controls'}">
        <div class="build-round__toggles" role="group" aria-label="Board visibility">
          <button
            type="button"
            class="build-round__toggle build-round__toggle--items${itemsVisible ? ' is-on' : ''}"
            aria-pressed="${itemsVisible}"
            aria-label="Show items"
            title="Show items"
          >
            <img
              src="${root}assets/icons/history/Sword.png"
              alt=""
              width="40"
              height="40"
              draggable="false"
            />
          </button>
          <button
            type="button"
            class="build-round__toggle build-round__toggle--bags${bagsVisible ? ' is-on' : ''}"
            aria-pressed="${bagsVisible}"
            aria-label="Show bags"
            title="Show bags"
          >
            <img
              src="${root}assets/icons/history/BagToggle-v3.png"
              alt=""
              width="40"
              height="40"
              draggable="false"
            />
          </button>
          ${
            hasVideo
              ? `<button
            type="button"
            class="build-round__toggle build-round__toggle--video"
            aria-pressed="false"
            aria-label="Show video"
            title="Show video"
          >
            <img
              src="${root}assets/icons/history/VideoToggle.png"
              alt=""
              width="40"
              height="40"
              draggable="false"
            />
          </button>`
              : ''
          }
        </div>
        ${
          showHistory
            ? `<div class="build-round__nav">
          <button type="button" class="build-round__btn build-round__btn--prev" aria-label="Previous round">
            <span aria-hidden="true">‹</span>
          </button>
          <p class="build-round__label" aria-live="polite">
            <span class="build-round__text build-round__text--round">Round <span data-cur>1</span>/<span data-max>1</span></span>
            <span class="build-round__text build-round__text--video" hidden>Video</span>
          </p>
          <button type="button" class="build-round__btn build-round__btn--next" aria-label="Next round">
            <span aria-hidden="true">›</span>
          </button>
        </div>`
            : hasVideo
              ? `<div class="build-round__nav build-round__nav--video-only">
          <p class="build-round__label" aria-live="polite">
            <span class="build-round__text build-round__text--round" hidden>Board</span>
            <span class="build-round__text build-round__text--video" hidden>Video</span>
          </p>
        </div>`
              : `<div class="build-round__nav build-round__nav--spacer" aria-hidden="true"></div>`
        }
        ${
          previewMode
            ? ''
            : `<div class="build-round__actions">
          ${voteControlHtml(root)}
          ${
            opts.buildKey
              ? `<a
            class="build-round__remix"
            href="${root}create/?remix=${encodeURIComponent(opts.buildKey)}"
            aria-label="Remix this build"
            title="Remix in creator"
          >
            <img
              class="build-round__remix-icon"
              src="${root}assets/icons/history/RemixBuild.png"
              alt=""
              width="36"
              height="36"
              draggable="false"
            />
          </a>`
              : ''
          }
          <button
            type="button"
            class="build-round__share"
            aria-label="Share build link"
            title="Copy build link"
          >
            <img
              class="build-round__share-icon"
              src="${root}assets/icons/history/ShareBuild.png"
              alt=""
              width="36"
              height="36"
              draggable="false"
            />
            <span class="build-round__share-label" data-share-label>Share</span>
          </button>
        </div>`
        }
      </div>
      ${
        !previewMode && opts.buildKey
          ? `<div class="build-round__play-row">
        <a
          class="bpb-premium-cta bpb-premium-cta--plaque build-round__play"
          href="${buildSimPlayHref(root, opts.buildKey, frames[index]?.round)}"
          aria-label="Play this round in combat sandbox (Premium)"
          title="Play this round in combat sandbox (Premium)"
        >
          <span class="bpb-premium-cta__face" aria-hidden="true">
          ${premiumCtaFxHtml(root)}
          <img
              class="bpb-premium-cta__icon"
              src="${root}assets/icons/sim/PlayButton.png"
              alt=""
              width="276"
              height="100"
              draggable="false"
            />
          </span>
        </a>
      </div>`
          : ''
      }
    </div>
  `;

  const curEl = host.querySelector('[data-cur]');
  const maxEl = host.querySelector('[data-max]');
  const roundText = host.querySelector('.build-round__text--round');
  const videoText = host.querySelector('.build-round__text--video');
  const prevBtn = host.querySelector('.build-round__btn--prev');
  const nextBtn = host.querySelector('.build-round__btn--next');
  const itemsBtn = host.querySelector('.build-round__toggle--items');
  const bagsBtn = host.querySelector('.build-round__toggle--bags');
  const videoBtn = host.querySelector('.build-round__toggle--video');
  const toggles = host.querySelector('.build-round__toggles');
  const shareBtn = host.querySelector('.build-round__share');
  const playLink = host.querySelector('.build-round__play');
  const stripBtns = [...host.querySelectorAll('.build-round-strip__btn')];
  /** Last board round index before opening video (for toggle off). */
  let lastBoardIndex = index;
  const unbindShare = previewMode
    ? () => {}
    : bindShareBuild(
        shareBtn instanceof HTMLButtonElement ? shareBtn : null,
      );
  const unbindVote = previewMode
    ? () => {}
    : bindBuildVote(host, {
        buildKey: opts.buildKey || '',
        baseScore: opts.voteScore,
      });

  function goPlaySim() {
    if (!(playLink instanceof HTMLAnchorElement)) return;
    const href = playLink.getAttribute('href');
    if (href) location.href = href;
  }

  if (!previewMode && playLink instanceof HTMLAnchorElement) {
    void resumePremiumIntent({
      [BUILD_PLAY_INTENT]: goPlaySim,
    });
    playLink.addEventListener('click', (e) => {
      // Allow modified clicks (new tab / middle) to use href + sim hard gate
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
        return;
      }
      e.preventDefault();
      void requirePremium({
        reason: BUILD_PLAY_REASON,
        intentKey: BUILD_PLAY_INTENT,
        onGranted: goPlaySim,
      });
    });
  }

  /**
   * @param {HTMLElement | null} btn
   * @param {boolean} on
   */
  function paintToggle(btn, on) {
    if (!(btn instanceof HTMLButtonElement)) return;
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function setItemsVisible(visible, emit = true) {
    itemsVisible = visible;
    paintToggle(itemsBtn, visible);
    if (emit) opts.onItemsVisibleChange?.(visible);
  }

  function setBagsVisible(visible, emit = true) {
    bagsVisible = visible;
    paintToggle(bagsBtn, visible);
    if (emit) opts.onBagsVisibleChange?.(visible);
  }

  itemsBtn?.addEventListener('click', () => {
    setItemsVisible(!itemsVisible);
  });
  bagsBtn?.addEventListener('click', () => {
    setBagsVisible(!bagsVisible);
  });

  videoBtn?.addEventListener('click', () => {
    if (!hasVideo) return;
    if (isVideoStep()) {
      goTo(lastBoardIndex);
    } else {
      lastBoardIndex = index;
      goTo(videoIndex);
    }
  });

  function isVideoStep() {
    return hasVideo && index === videoIndex;
  }

  function paint(emit = true) {
    const showingVideo = isVideoStep();
    const onPublishedBoard = !showingVideo && index < 0;
    const frame = showingVideo || onPublishedBoard ? null : frames[index];

    if (!showingVideo && index >= 0) lastBoardIndex = index;

    if (roundText instanceof HTMLElement) roundText.hidden = showingVideo;
    if (videoText instanceof HTMLElement) videoText.hidden = !showingVideo;

    if (!showingVideo && frame) {
      if (curEl) curEl.textContent = String(frame.round);
      if (maxEl) maxEl.textContent = String(displayMax);
    } else if (!showingVideo && onPublishedBoard) {
      // `Number(null)` is 0 — never treat a missing round as round 0.
      const explicit = Number(simPicker?.activeRound);
      const fallback = frames[frames.length - 1]?.round;
      const shown =
        Number.isFinite(explicit) && explicit >= 1 ? explicit : fallback;
      if (curEl) curEl.textContent = shown != null ? String(shown) : '—';
      if (maxEl) maxEl.textContent = String(displayMax);
    }

    if (playLink instanceof HTMLAnchorElement && opts.buildKey) {
      const boardFrame = showingVideo ? frames[lastBoardIndex] : frame;
      const round = boardFrame?.round;
      playLink.href = buildSimPlayHref(root, opts.buildKey, round);
      const label =
        round != null
          ? `Play round ${round} in combat sandbox (Premium)`
          : 'Play in combat sandbox (Premium)';
      playLink.setAttribute('aria-label', label);
      playLink.title = label;
    }

    // Items/bags only apply on the board; video toggle stays usable
    if (itemsBtn instanceof HTMLButtonElement) itemsBtn.disabled = showingVideo;
    if (bagsBtn instanceof HTMLButtonElement) bagsBtn.disabled = showingVideo;
    if (toggles instanceof HTMLElement) {
      toggles.classList.toggle('is-board-dimmed', showingVideo);
    }
    paintToggle(videoBtn, showingVideo);
    if (videoBtn instanceof HTMLButtonElement) {
      videoBtn.title = showingVideo ? 'Hide video' : 'Show video';
      videoBtn.setAttribute('aria-label', showingVideo ? 'Hide video' : 'Show video');
    }

    const multi = stepCount > 1;
    if (prevBtn instanceof HTMLButtonElement) prevBtn.disabled = !multi;
    if (nextBtn instanceof HTMLButtonElement) nextBtn.disabled = !multi;

    for (const btn of stripBtns) {
      const i = Number(btn.getAttribute('data-index'));
      const on = i === index;
      btn.classList.toggle('is-selected', on);
      btn.setAttribute('aria-current', on ? 'true' : 'false');
    }

    if (emit) opts.onChange(frame, index, { isVideo: showingVideo, published: onPublishedBoard });
  }

  function goTo(nextIndex) {
    if (stepCount <= 1 && nextIndex !== videoIndex) return;
    let wrapped = nextIndex;
    if (nextIndex >= 0 && nextIndex < frames.length) {
      wrapped = nextIndex;
    } else if (nextIndex === videoIndex) {
      wrapped = videoIndex;
    } else if (stepCount > 1) {
      wrapped = ((nextIndex % stepCount) + stepCount) % stepCount;
    } else {
      return;
    }
    if (wrapped === index) return;

    const targetFrame =
      wrapped >= 0 && wrapped < frames.length ? frames[wrapped] : null;
    if (
      simPicker?.onRoundNavigate &&
      targetFrame &&
      simPicker.activeRound != null &&
      targetFrame.round !== simPicker.activeRound
    ) {
      simPicker.onRoundNavigate(targetFrame.round);
      return;
    }
    if (simPicker?.onRoundNavigate && targetFrame && simPicker.activeRound == null) {
      simPicker.onRoundNavigate(targetFrame.round);
      return;
    }

    index = wrapped;
    paint(true);
  }

  function step(delta) {
    if (index < 0) {
      if (delta > 0) goTo(0);
      else goTo(hasVideo ? videoIndex : frames.length - 1);
      return;
    }
    goTo(index + delta);
  }

  prevBtn?.addEventListener('click', () => step(-1));
  nextBtn?.addEventListener('click', () => step(1));

  for (const btn of stripBtns) {
    btn.addEventListener('click', () => {
      goTo(Number(btn.getAttribute('data-index')));
    });
  }

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (isTypingTarget(e.target)) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      step(1);
    }
  }
  window.addEventListener('keydown', onKey);

  paint(true);
  setItemsVisible(itemsVisible, true);
  setBagsVisible(bagsVisible, true);

  return {
    get index() {
      return index;
    },
    get frame() {
      return isVideoStep() ? null : frames[index];
    },
    get isVideo() {
      return isVideoStep();
    },
    get itemsVisible() {
      return itemsVisible;
    },
    get bagsVisible() {
      return bagsVisible;
    },
    setItemsVisible,
    setBagsVisible,
    goTo,
    destroy() {
      window.removeEventListener('keydown', onKey);
      unbindShare();
      unbindVote();
      host.replaceChildren();
    },
  };
}
