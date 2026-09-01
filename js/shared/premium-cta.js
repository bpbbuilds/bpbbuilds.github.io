/**
 * Shared markup for premium Play CTA glow + sparkles
 * (game dice: RainbowShiftOutline + GlowingDot behind the face).
 */

/**
 * @param {string} root site root prefix ending with /
 * @param {{ count?: number }} [opts]
 * @returns {string}
 */
export function premiumCtaFxHtml(root, opts = {}) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const count = Math.max(1, Number(opts.count) || 12);
  const dot = `${base}assets/icons/sim/GlowingDot.png`;
  const sparks = Array.from({ length: count }, (_, i) => {
    const angle = i * (360 / count);
    const delay = (i * 0.07).toFixed(2);
    const dist = (0.85 + (i % 3) * 0.2).toFixed(2);
    return `<img class="bpb-premium-cta__spark" src="${dot}" alt="" width="24" height="24" draggable="false" style="--spark-angle:${angle}deg;--spark-delay:${delay}s;--spark-dist:${dist}rem" />`;
  }).join('');
  return `<span class="bpb-premium-cta__glow"></span><span class="bpb-premium-cta__sparks">${sparks}</span>`;
}
