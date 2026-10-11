/**
 * Homepage combat day→night backdrop — scroll-scrubbed like game Round anim.
 *
 *   import { initCombatSky } from './combat-sky.js';
 *   initCombatSky();
 */

import { applyTime, bindSkyLayers } from './apply.js';
import { buildSkyDom, combatSkyRoot } from './dom.js';

export const DESIGN_W = 1920;
export const DESIGN_H = 1080;
/** Match combat delay / morning start */
export const T_START = 2.5;
/** Deep night hold (skip late star encore / loop) */
export const T_END = 30;
/** Bright day freeze for reduced motion */
export const T_REDUCED = 6;
/** Seconds — follow scroll so discrete rAF/scroll ticks don’t hitch. */
const SMOOTH_SEC = 0.07;

function scrollTime(reduced, maxScrollY) {
  if (reduced) return T_REDUCED;
  const p = maxScrollY <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / maxScrollY));
  return T_START + p * (T_END - T_START);
}

function fitScale(host) {
  const scale = Math.max(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
  host.style.setProperty('--combat-sky-scale', String(scale));
}

function shouldUseStaticSky() {
  const compactViewport = window.matchMedia('(max-width: 767px)').matches;
  const reducedData = window.matchMedia('(prefers-reduced-data: reduce)').matches;
  const saveData = navigator.connection?.saveData === true;
  const lowCoreDevice =
    Number.isFinite(navigator.hardwareConcurrency) && navigator.hardwareConcurrency <= 2;
  return compactViewport || reducedData || saveData || lowCoreDevice;
}

export function initCombatSky() {
  if (!document.body.classList.contains('page-home')) return;
  if (document.querySelector('.combat-sky')) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const staticMode = reduced || shouldUseStaticSky();
  const host = buildSkyDom(combatSkyRoot());
  if (staticMode) host.classList.add('combat-sky--static');
  document.body.insertBefore(host, document.body.firstChild);

  const layers = bindSkyLayers(host);
  fitScale(host);

  if (staticMode) {
    // A single painted frame keeps the scene readable without competing with
    // touch scrolling on compact or constrained devices. Resize still updates
    // the stage scale for orientation changes; no scroll callback is attached.
    applyTime(layers, T_REDUCED);
    window.addEventListener('resize', () => fitScale(host), { passive: true });
    return;
  }

  // The first frame is always at the day start, so it does not need a document
  // height read. Measure after that frame (and after later document resizes)
  // instead of forcing layout during the first-view boot path.
  let maxScrollY = 0;
  let rangeRaf = 0;
  const measureScrollRange = () => {
    maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  };
  const scheduleScrollRangeMeasure = () => {
    if (rangeRaf) return;
    rangeRaf = requestAnimationFrame(() => {
      rangeRaf = 0;
      measureScrollRange();
    });
  };
  scheduleScrollRangeMeasure();

  if (typeof ResizeObserver !== 'undefined') {
    const rangeObserver = new ResizeObserver(scheduleScrollRangeMeasure);
    rangeObserver.observe(document.body);
  }

  let displayT = scrollTime(reduced, maxScrollY);
  applyTime(layers, displayT);

  let raf = 0;
  let lastTs = 0;

  const tick = (ts) => {
    raf = 0;
    const target = scrollTime(reduced, maxScrollY);
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
    lastTs = ts;
    if (reduced) {
      displayT = target;
    } else {
      const k = 1 - Math.exp(-dt / SMOOTH_SEC);
      displayT += (target - displayT) * k;
      if (Math.abs(target - displayT) < 0.002) displayT = target;
    }
    applyTime(layers, displayT);
    if (displayT !== target) {
      raf = requestAnimationFrame(tick);
    } else {
      lastTs = 0;
    }
  };

  const queue = () => {
    if (raf) return;
    raf = requestAnimationFrame(tick);
  };

  if (!reduced) {
    window.addEventListener('scroll', queue, { passive: true });
  }
  window.addEventListener(
    'resize',
    () => {
      scheduleScrollRangeMeasure();
      fitScale(host);
      queue();
    },
    { passive: true },
  );
}
