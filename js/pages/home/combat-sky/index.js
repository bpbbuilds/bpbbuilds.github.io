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

function scrollTime(reduced) {
  if (reduced) return T_REDUCED;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const p = max <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / max));
  return T_START + p * (T_END - T_START);
}

function fitScale(host) {
  const scale = Math.max(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
  host.style.setProperty('--combat-sky-scale', String(scale));
}

export function initCombatSky() {
  if (!document.body.classList.contains('page-home')) return;
  if (document.querySelector('.combat-sky')) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const host = buildSkyDom(combatSkyRoot());
  document.body.insertBefore(host, document.body.firstChild);

  const layers = bindSkyLayers(host);
  fitScale(host);

  let displayT = scrollTime(reduced);
  applyTime(layers, displayT);

  let raf = 0;
  let lastTs = 0;

  const tick = (ts) => {
    raf = 0;
    const target = scrollTime(reduced);
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
      fitScale(host);
      queue();
    },
    { passive: true },
  );
}
