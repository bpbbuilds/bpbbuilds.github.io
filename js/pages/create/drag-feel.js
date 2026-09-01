/**
 * Game-matched drag feel (shop → bag).
 * Source: Items/Item.gd pickup / _process / drop moveback / cancelDrag.
 */

/** Mobile Settings.pick_offset = 1.0 × PICK_OFFSET(100) — scaled for CSS. */
export const PICK_OFFSET_TOUCH_PX = 56;

/**
 * Settings.pick_offset: 0 on desktop (fine pointer), 1.0 on mobile/coarse.
 * @returns {number}
 */
export function pickOffsetPx() {
  if (typeof window === 'undefined' || !window.matchMedia) return 0;
  try {
    if (window.matchMedia('(pointer: coarse)').matches) return PICK_OFFSET_TOUCH_PX;
  } catch {
    /* ignore */
  }
  return 0;
}

/** @deprecated use pickOffsetPx() — desktop is 0 */
export const PICK_OFFSET_PX = 0;

/** Pickup scale punch (sprite × 1.1 over 0.1s in-game). */
export const PICKUP_SCALE = 1.1;
export const PICKUP_MS = 100;

/** Item.pickup / drop shadow tween duration. */
export const SHADOW_TWEEN_MS = 100;

/** Esc / cancelDrag moveTo duration (EASE_OUT QUAD). */
export const CANCEL_FLYBACK_MS = 200;

export {
  ROTATE_MS,
  prefersReducedMotion,
  shortestAngleDeltaDeg,
  createAngleTween,
} from '../../shared/backpack-grid/face-spin.js';

/** Momentum tilt constants from Item.gd */
const MOVE_ROTATION_MOUSE_FACTOR = 0.015;
const BACKFORCE = 5;
const FRIC = 15;
const MAX_ANGLE = 10;
const MOVE_ROTATION_SPEED = 60;

/**
 * @returns {{
 *   reset: () => void,
 *   step: (dx: number, dy: number, dt: number) => number,
 *   angle: () => number,
 *   setEnabled: (on: boolean) => void,
 * }}
 */
export function createTiltState() {
  let rotationMomentum = 0;
  let bonusRotation = 0;
  let enabled = true;

  return {
    reset() {
      rotationMomentum = 0;
      bonusRotation = 0;
    },
    /** Bags with cargo: game skips tilt when draggedInsideItems nonempty. */
    setEnabled(on) {
      enabled = on !== false;
      if (!enabled) {
        rotationMomentum = 0;
        bonusRotation = 0;
      }
    },
    /**
     * @param {number} dx
     * @param {number} dy
     * @param {number} dt seconds
     */
    step(dx, dy, dt) {
      if (!enabled) return 0;
      if (!(dt > 0) || !Number.isFinite(dt)) return bonusRotation;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const len = Math.hypot(dx, dy);
      const mainDif = absX > absY ? len * Math.sign(dx || 0) : -len * Math.sign(dy || 0);

      rotationMomentum += mainDif * MOVE_ROTATION_MOUSE_FACTOR;
      rotationMomentum -= bonusRotation * BACKFORCE * dt;
      rotationMomentum *= Math.max(0, 1 - FRIC * dt);
      bonusRotation += rotationMomentum * MOVE_ROTATION_SPEED * dt;
      bonusRotation = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, bonusRotation));
      return bonusRotation;
    },
    angle() {
      return enabled ? bonusRotation : 0;
    },
  };
}

/**
 * Failed-drop flyback: clamp(dist/1000, 0.1, 0.5) seconds.
 * @param {number} distPx
 */
export function flybackDurationMs(distPx) {
  return Math.min(500, Math.max(100, Math.round(distPx)));
}

/**
 * @typedef {{ left: number, top: number, width: number, height: number }} FlybackRect
 */

/**
 * Animate cursor back to a target rect.
 * Cancel = fixed 0.2s EASE_OUT; failed drop = distance EASE_IN.
 *
 * @param {HTMLElement} el
 * @param {FlybackRect} to
 * @param {{
 *   ms?: number,
 *   ease?: 'in' | 'out',
 *   imgEl?: HTMLImageElement | null,
 * }} [opts]
 * @returns {Promise<void>}
 */
export function animateFlyback(el, to, opts = {}) {
  const ms =
    opts.ms != null
      ? opts.ms
      : opts.ease === 'out'
        ? CANCEL_FLYBACK_MS
        : flybackDurationMs(200);
  const ease =
    opts.ease === 'out'
      ? 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' /* ~QUAD EASE_OUT */
      : 'cubic-bezier(0.55, 0.06, 0.68, 0.19)'; /* ~EASE_IN */
  const imgEl = opts.imgEl || null;

  return new Promise((resolve) => {
    const tx = Math.round(to.left + to.width / 2);
    const ty = Math.round(to.top + to.height / 2);
    el.style.transition = [
      `width ${ms}ms ${ease}`,
      `height ${ms}ms ${ease}`,
      `transform ${ms}ms ${ease}`,
    ].join(', ');
    el.style.width = `${Math.max(1, to.width)}px`;
    el.style.height = `${Math.max(1, to.height)}px`;
    el.style.transform =
      `translate3d(${tx}px, ${ty}px, 0) translate(-50%, -50%) scale(1)`;

    if (imgEl) {
      imgEl.style.transition = `transform ${ms}ms ${ease}`;
      imgEl.style.transform = 'translate(-50%, -50%) rotate(0deg)';
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.style.transition = 'none';
      if (imgEl) imgEl.style.transition = 'none';
      resolve();
    };
    el.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, ms + 40);
  });
}
