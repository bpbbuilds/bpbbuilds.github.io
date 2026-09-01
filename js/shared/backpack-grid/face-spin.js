/**
 * Item face spin — mirrors Item.rotateTo (duration = 0.15).
 * Source: tools/game-extract-full/Items/Item.gd → rotateTo / lerpAngle_local
 *
 * Footprint snaps instantly; sprite eases. Game uses linear lerp_angle over 0.15s.
 *
 * Drop while spinning: game keeps rotationTween running on the same Item
 * (Util.finishTween only for instant snaps / bag cargo). Web transfers the
 * mid-angle to the placed DOM and continues for the remaining ms.
 */

/** Item.rotateTo default duration (seconds). */
export const ROTATE_DURATION_S = 0.15;
export const ROTATE_MS = Math.round(ROTATE_DURATION_S * 1000);

/** @returns {boolean} */
export function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
}

/**
 * Shortest signed delta from → to in degrees (Godot lerp_angle sense).
 * @param {number} from
 * @param {number} to
 */
export function shortestAngleDeltaDeg(from, to) {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/** Linear (Item.rotateTo / lerp_angle). */
function easeLinear(t) {
  return t;
}

/**
 * Cancelable angle tween for item face spins (Item.rotationTween).
 * @param {number} [initial]
 */
export function createAngleTween(initial = 0) {
  let current = Number(initial) || 0;
  let from = current;
  let to = current;
  let start = 0;
  let duration = ROTATE_MS;
  let raf = 0;
  /** @type {((deg: number) => void) | null} */
  let onUpdate = null;
  /** @type {(() => void) | null} */
  let onDone = null;

  function settle() {
    raf = 0;
    current = to;
    onUpdate?.(current);
    const done = onDone;
    onDone = null;
    onUpdate = null;
    done?.();
  }

  function frame() {
    raf = 0;
    if (prefersReducedMotion()) {
      settle();
      return;
    }
    const now = performance.now();
    const dur = Math.max(1, duration);
    const u = Math.min(1, (now - start) / dur);
    const t = easeLinear(u);
    current = from + (to - from) * t;
    onUpdate?.(current);
    if (u < 1) raf = requestAnimationFrame(frame);
    else settle();
  }

  return {
    get() {
      return current;
    },
    isRunning() {
      return raf !== 0;
    },
    /** Remaining ms in the active tween (0 if idle). */
    remainingMs() {
      if (!raf) return 0;
      return Math.max(0, duration - (performance.now() - start));
    },
    cancel() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      onDone = null;
      // Keep onUpdate cleared so a late frame cannot paint after destroy
      onUpdate = null;
    },
    /** Util.finishTween — jump to end. */
    finish() {
      if (!raf && current === to) return;
      if (raf) cancelAnimationFrame(raf);
      settle();
    },
    /** @param {number} deg */
    setInstant(deg) {
      this.cancel();
      current = from = to = Number(deg) || 0;
    },
    /**
     * @param {number} deg absolute target (e.g. face * 90)
     * @param {(deg: number) => void} [update]
     * @param {() => void} [done]
     * @param {number} [durationMs]
     */
    tweenTo(deg, update, done, durationMs = ROTATE_MS) {
      this.cancel();
      onUpdate = update || null;
      onDone = done || null;
      from = current;
      const delta = shortestAngleDeltaDeg(from, Number(deg) || 0);
      to = from + delta;
      duration = Math.max(1, Number(durationMs) || ROTATE_MS);
      if (prefersReducedMotion() || Math.abs(delta) < 0.01) {
        settle();
        return;
      }
      start = performance.now();
      frame();
    },
  };
}

/** @type {WeakMap<HTMLElement, ReturnType<typeof createAngleTween>>} */
const spinTweens = new WeakMap();

/**
 * @param {HTMLElement} el
 * @returns {number}
 */
export function readRotateDeg(el) {
  const raw = el.style.rotate || '';
  const m = String(raw).match(/-?[\d.]+/);
  if (m) return Number(m[0]);
  return 0;
}

/**
 * Ease `.bpb-bg__spin` (or any node using CSS `rotate`) to face * 90°.
 * @param {HTMLElement} el
 * @param {number} targetDeg
 * @param {{ animate?: boolean, fromDeg?: number, durationMs?: number, onDone?: () => void }} [opts]
 */
export function animateSpinRotate(el, targetDeg, opts = {}) {
  const animate = opts.animate !== false && !prefersReducedMotion();
  let tween = spinTweens.get(el);
  if (!tween) {
    tween = createAngleTween(readRotateDeg(el));
    spinTweens.set(el, tween);
  } else {
    // Keep tween current in sync if something else snapped the style
    const live = readRotateDeg(el);
    if (Math.abs(live - tween.get()) > 0.5 && !animate) {
      tween.setInstant(live);
    }
  }
  if (Number.isFinite(opts.fromDeg)) {
    tween.setInstant(Number(opts.fromDeg));
    el.style.rotate = `${Number(opts.fromDeg)}deg`;
  }
  if (!animate) {
    tween.setInstant(targetDeg);
    el.style.rotate = `${targetDeg}deg`;
    opts.onDone?.();
    return;
  }
  // Seed from live style so rapid re-faces chain correctly
  if (!Number.isFinite(opts.fromDeg) && Math.abs(readRotateDeg(el) - tween.get()) > 0.5) {
    tween.setInstant(readRotateDeg(el));
  }
  const dur = Number.isFinite(opts.durationMs) ? Number(opts.durationMs) : ROTATE_MS;
  tween.tweenTo(
    targetDeg,
    (deg) => {
      el.style.rotate = `${deg}deg`;
    },
    typeof opts.onDone === 'function' ? opts.onDone : undefined,
    dur,
  );
}
