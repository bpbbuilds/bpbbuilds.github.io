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
/** Quantize scroll progress so sky paint work happens at coarse checkpoints. */
const SKY_STEP_COUNT = 40;

function steppedProgress(progress) {
  return Math.round(progress * SKY_STEP_COUNT) / SKY_STEP_COUNT;
}

function scrollTime(reduced, maxScrollY) {
  if (reduced) return T_REDUCED;
  const p = maxScrollY <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / maxScrollY));
  return T_START + steppedProgress(p) * (T_END - T_START);
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

  host.classList.add('combat-sky--stepped');

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

  const tick = () => {
    raf = 0;
    const target = scrollTime(reduced, maxScrollY);
    if (target !== displayT) {
      // Apply colors/tints once per bucket. CSS handles the short positional
      // and opacity transition; no per-frame interpolation work is needed.
      displayT = target;
      applyTime(layers, displayT);
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
