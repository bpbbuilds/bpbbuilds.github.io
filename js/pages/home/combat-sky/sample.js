/**
 * Track sampling — Godot-ish ease + lerp (shared by combat-sky apply).
 */

export function rgb(r, g, b, a = 1) {
  return { r, g, b, a };
}

export function toCss({ r, g, b, a }) {
  const R = Math.round(r * 255);
  const G = Math.round(g * 255);
  const B = Math.round(b * 255);
  return a >= 0.999 ? `rgb(${R},${G},${B})` : `rgba(${R},${G},${B},${a})`;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function lerpColor(a, b, t) {
  return {
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
    a: lerp(a.a, b.a, t),
  };
}

/** Godot-ish ease: negative transition ≈ ease-in-out */
export function easeT(t, transition = 1) {
  if (transition === 1 || Math.abs(transition - 1) < 1e-6) return t;
  return t * t * (3 - 2 * t);
}

/**
 * @param {number[]} times
 * @param {unknown[]} values
 * @param {number[] | null} [transitions]
 * @param {number} t
 * @param {(a: unknown, b: unknown, u: number) => unknown} mix
 */
export function sampleTrack(times, values, transitions, t, mix) {
  if (t <= times[0]) return values[0];
  const last = times.length - 1;
  if (t >= times[last]) return values[last];
  let i = 0;
  while (i < last && times[i + 1] < t) i += 1;
  const t0 = times[i];
  const t1 = times[i + 1];
  const u = easeT((t - t0) / (t1 - t0), transitions?.[i] ?? 1);
  return mix(values[i], values[i + 1], u);
}

export function sampleColor(times, values, transitions, t) {
  return /** @type {{r:number,g:number,b:number,a:number}} */ (
    sampleTrack(times, values, transitions, t, lerpColor)
  );
}

export function sampleNum(times, values, transitions, t) {
  return /** @type {number} */ (sampleTrack(times, values, transitions, t, lerp));
}

const PATH_EASE = [-1.5, -1.5, -1.5, -1.5];

/** Piecewise ease through numeric keys (sun/moon arcs). */
export function samplePath(times, values, t) {
  return sampleNum(times, values, PATH_EASE, t);
}
