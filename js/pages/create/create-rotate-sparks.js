/**
 * Lightweight rotation sparks (Item.spawnRotationSparks).
 * No particle atlas required — CSS bursts; skipped under reduced motion.
 */

import { prefersReducedMotion } from '../../shared/backpack-grid/face-spin.js';

/**
 * @param {number} clientX
 * @param {number} clientY
 * @param {{ clockwise?: boolean, color?: string }} [opts]
 */
export function spawnRotateSparks(clientX, clientY, opts = {}) {
  if (prefersReducedMotion()) return;
  const host = document.createElement('div');
  host.className = 'create-board__rotate-sparks';
  host.setAttribute('aria-hidden', 'true');
  host.style.left = `${Math.round(clientX)}px`;
  host.style.top = `${Math.round(clientY)}px`;
  if (opts.color) host.style.setProperty('--spark-color', opts.color);
  if (opts.clockwise === false) host.classList.add('is-ccw');

  const n = 8;
  for (let i = 0; i < n; i += 1) {
    const p = document.createElement('span');
    p.className = 'create-board__rotate-spark';
    const ang = (i / n) * Math.PI * 2 + (opts.clockwise === false ? Math.PI : 0);
    p.style.setProperty('--sx', `${Math.cos(ang) * 28}px`);
    p.style.setProperty('--sy', `${Math.sin(ang) * 28}px`);
    host.appendChild(p);
  }
  document.body.appendChild(host);
  window.setTimeout(() => host.remove(), 420);
}
