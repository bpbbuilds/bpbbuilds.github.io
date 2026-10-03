/**
 * Time scrubber for sim runs — game CombatTimer chrome.
 * Combat Log / Damage Dealt live in sim-combat-results.js (Band Q).
 * Engine mode uses the in-game combat clock (0 = items live after COMBAT_DELAY).
 */

import {
  COMBAT_DELAY,
  combatDurationSec,
  toCombatLogTime,
  toEngineTime,
} from '../sim-combat-time.js';
import { conformSimEvents } from '../sim-events.js';

const SPEEDS = [1, 2, 4];
const SPEED_KEY = 'bpb-sim-speed';

/** Stepping through a fight pops the labels for the moment you land on. */
const SCRUB_LABEL_WINDOW = 0.25;
const SCRUB_LABEL_MAX = 8;

/** @returns {number} */
function readStoredSpeed() {
  try {
    const n = Number(localStorage.getItem(SPEED_KEY));
    if (SPEEDS.includes(n)) return n;
  } catch {
    /* ignore */
  }
  return 1;
}

/**
 * @param {string} root
 * @param {string} file
 */
function timerAsset(root, file) {
  const base = root.endsWith('/') ? root : `${root}/`;
  return `${base}assets/icons/sim/combat-timer/${file}`;
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   run: import('../../sim-events.js').SimRun,
 *   assetRoot?: string,
 *   onSeek: (t: number, evsAt: import('../../sim-events.js').SimEvent[]) => void,
 *   onEvent?: (ev: import('../../sim-events.js').SimEvent) => void,
 *   onScrubEvents?: (evs: import('../../sim-events.js').SimEvent[]) => void,
 *   onExport?: () => void,
 *   onTime?: (t: number) => void,
 *   onSpeed?: (speed: number) => void,
 *   onPlayingChange?: (playing: boolean) => void,
 *   initialSpeed?: number,
 *   initialT?: number,
 *   autoplay?: boolean,
 * }} opts
 */
export function mountSimScrubber(host, opts) {
  const root = opts.assetRoot || '../';
  const run = opts.run;
  const engineDuration = Math.max(0.1, Number(run.durationSec) || 30);
  const useCombatClock = run.mode !== 'demo';
  const duration = useCombatClock
    ? combatDurationSec(engineDuration)
    : engineDuration;
  const events = conformSimEvents(run.events);
  let speed =
    opts.initialSpeed && SPEEDS.includes(opts.initialSpeed)
      ? opts.initialSpeed
      : readStoredSpeed();

  /** @param {number} displayT */
  function toEngine(displayT) {
    return useCombatClock ? toEngineTime(displayT) : displayT;
  }

  /** @param {number} engineT */
  function toDisplay(engineT) {
    return useCombatClock ? toCombatLogTime(engineT) : engineT;
  }

  host.innerHTML = `
    <div class="sim-scrub sim-combat-timer" role="group" aria-label="Fight timeline">
      <div class="sim-combat-timer__track-row">
        <div class="sim-combat-timer__track">
          <div class="sim-combat-timer__track-fill" data-fill hidden>
            <img
              class="sim-combat-timer__track-fill-img"
              src="${timerAsset(root, 'CombatSpeed_slider_filled.png')}"
              alt=""
              width="585"
              height="50"
              draggable="false"
            />
          </div>
          <img
            class="sim-combat-timer__grabber"
            data-grabber
            src="${timerAsset(root, 'CombatSpeed_grabber.png')}"
            alt=""
            width="57"
            height="87"
            draggable="false"
          />
          <input
            type="range"
            class="sim-combat-timer__range"
            data-range
            min="0"
            max="${duration}"
            step="0.05"
            value="0"
            aria-label="Fight timeline"
          />
        </div>
        <span class="sim-combat-timer__speed" data-speed-label aria-hidden="true">x${speed}</span>
      </div>
      <div class="sim-combat-timer__controls">
        <button
          type="button"
          class="sim-combat-timer__btn sim-combat-timer__btn--pause"
          data-act="toggle"
          aria-label="Pause"
        >
          <img
            data-pause-art
            src="${timerAsset(root, 'CombatSpeed_paused.png')}"
            alt=""
            width="66"
            height="70"
            draggable="false"
          />
        </button>
        <span class="sim-combat-timer__time" data-time aria-live="polite">0.0</span>
        <button
          type="button"
          class="sim-combat-timer__btn sim-combat-timer__btn--fast"
          data-act="fast"
          aria-label="Increase speed"
        >
          <img
            data-fast-art
            src="${timerAsset(root, 'CombatSpeed_fast.png')}"
            alt=""
            width="78"
            height="68"
            draggable="false"
          />
        </button>
      </div>
    </div>
  `;

  const toggleBtn = host.querySelector('[data-act="toggle"]');
  const fastBtn = host.querySelector('[data-act="fast"]');
  const pauseArt = host.querySelector('[data-pause-art]');
  const fastArt = host.querySelector('[data-fast-art]');
  const range = host.querySelector('[data-range]');
  const timeEl = host.querySelector('[data-time]');
  const speedLabel = host.querySelector('[data-speed-label]');
  const fillEl = host.querySelector('[data-fill]');
  const grabberEl = host.querySelector('[data-grabber]');

  if (!(range instanceof HTMLInputElement)) {
    return {
      destroy() {},
      play() {},
      pause() {},
      seek() {},
      getSpeed: () => 1,
      getTime: () => (useCombatClock ? COMBAT_DELAY : 0),
      isPlaying: () => false,
    };
  }

  /** Display / combat clock time */
  let t = 0;
  let playing = false;
  let raf = 0;
  let lastTs = 0;

  /** Inset so the hourglass grabber stays inside the track capsule. */
  const TRACK_INSET_PCT = 4.5;

  /**
   * Godot HSlider grabber_area: filled StyleBoxTexture with horizontal tile
   * (axis_stretch_horizontal = 1) — shows the left portion of the 585×50 art
   * at uniform scale, not a width-stretched bitmap.
   *
   * @param {number} pct 0–100
   */
  function paintTrack(pct) {
    const clamped = Math.max(0, Math.min(100, pct));
    const span = 100 - TRACK_INSET_PCT * 2;
    const pos = TRACK_INSET_PCT + (clamped / 100) * span;
    if (fillEl instanceof HTMLElement) {
      fillEl.hidden = clamped <= 0.5;
      fillEl.style.width = `${pos}%`;
    }
    if (grabberEl instanceof HTMLElement) {
      grabberEl.style.left = `${pos}%`;
    }
  }

  function paintSpeedLabel() {
    if (!(speedLabel instanceof HTMLElement)) return;
    speedLabel.textContent = playing ? `x${speed}` : 'x0';
  }

  function paintToggleLabel() {
    if (!(toggleBtn instanceof HTMLButtonElement)) return;
    toggleBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }

  /**
   * First index past `time` in the (time-sorted) event list.
   * @param {number} time
   */
  function upperBound(time) {
    let lo = 0;
    let hi = events.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (events[mid].t <= time + 1e-9) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /**
   * Newest events under the playhead, oldest first. Capped so a fast drag
   * cannot dump a whole fight of labels at once.
   * @param {number} engineT
   */
  function eventsNear(engineT) {
    const from = engineT - SCRUB_LABEL_WINDOW;
    const out = [];
    for (let i = upperBound(engineT) - 1; i >= 0 && out.length < SCRUB_LABEL_MAX; i -= 1) {
      const ev = events[i];
      if (ev.t <= from) break;
      out.push(ev);
    }
    out.reverse();
    return out;
  }

  /**
   * @param {number} nextDisplayT
   * @param {{ fireEvents?: boolean, scrub?: boolean }} [seekOpts]
   */
  function seekTo(nextDisplayT, seekOpts = {}) {
    const fireEvents = seekOpts.fireEvents !== false;
    const prevDisplay = t;
    t = Math.max(0, Math.min(duration, nextDisplayT));
    const engineT = toEngine(t);
    const prevEngine = toEngine(prevDisplay);
    range.value = String(t);
    if (timeEl) timeEl.textContent = t.toFixed(1);
    paintTrack(duration > 0 ? (t / duration) * 100 : 0);

    const at = [];
    if (fireEvents && engineT > prevEngine + 1e-9) {
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (ev.t <= prevEngine + 1e-9) continue;
        if (ev.t > engineT + 1e-9) break;
        at.push(ev);
        opts.onEvent?.(ev);
      }
    }

    opts.onSeek(engineT, at);
    // After onSeek: a jump clears labels in flight, so spawn on top of that.
    if (seekOpts.scrub) opts.onScrubEvents?.(eventsNear(engineT));
    opts.onTime?.(engineT);

    if (t >= duration - 1e-6) pause();
  }

  function frame(ts) {
    if (!playing) return;
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.04, ((ts - lastTs) / 1000) * speed);
    lastTs = ts;
    seekTo(t + dt);
    if (playing) raf = requestAnimationFrame(frame);
  }

  function setSpeed(next) {
    if (!SPEEDS.includes(next)) return;
    speed = next;
    try {
      localStorage.setItem(SPEED_KEY, String(speed));
    } catch {
      /* ignore */
    }
    paintSpeedLabel();
    opts.onSpeed?.(speed);
  }

  function cycleSpeed() {
    const idx = SPEEDS.indexOf(speed);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    setSpeed(next);
  }

  function play() {
    if (t >= duration - 1e-6) seekTo(0, { fireEvents: false });
    playing = true;
    lastTs = 0;
    paintSpeedLabel();
    paintToggleLabel();
    opts.onPlayingChange?.(true);
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    playing = false;
    paintSpeedLabel();
    paintToggleLabel();
    opts.onPlayingChange?.(false);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function wireHover(btn, art, normal, hovered) {
    if (!(btn instanceof HTMLButtonElement) || !(art instanceof HTMLImageElement)) return;
    btn.addEventListener('mouseenter', () => {
      art.src = timerAsset(root, hovered);
    });
    btn.addEventListener('mouseleave', () => {
      art.src = timerAsset(root, normal);
    });
    btn.addEventListener('focus', () => {
      art.src = timerAsset(root, hovered);
    });
    btn.addEventListener('blur', () => {
      art.src = timerAsset(root, normal);
    });
  }

  wireHover(toggleBtn, pauseArt, 'CombatSpeed_paused.png', 'CombatSpeed_paused_hovered.png');
  wireHover(fastBtn, fastArt, 'CombatSpeed_fast.png', 'CombatSpeed_fast_hovered.png');

  toggleBtn?.addEventListener('click', () => {
    if (playing) pause();
    else play();
  });
  fastBtn?.addEventListener('click', () => cycleSpeed());
  range.addEventListener('input', () => {
    pause();
    seekTo(Number(range.value), { fireEvents: false, scrub: true });
  });

  const startEngine =
    opts.initialT != null && Number.isFinite(opts.initialT)
      ? Number(opts.initialT)
      : useCombatClock
        ? COMBAT_DELAY
        : 0;
  seekTo(toDisplay(startEngine), { fireEvents: false });
  paintSpeedLabel();
  paintToggleLabel();
  const startedAtEnd = t >= duration - 1e-6;
  if (opts.autoplay && !startedAtEnd) play();

  return {
    destroy() {
      pause();
      host.innerHTML = '';
    },
    play,
    pause,
    /** @param {number} engineT */
    seek(engineT, seekOpts) {
      seekTo(toDisplay(engineT), seekOpts);
    },
    getSpeed: () => speed,
    /** Engine/wall time (includes combat delay when clock is remapped). */
    getTime: () => toEngine(t),
    isPlaying: () => playing,
  };
}
