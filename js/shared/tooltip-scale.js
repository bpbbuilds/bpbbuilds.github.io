/** Desktop tooltip sizing uses the 1440px composition as its reference. */
export const DESKTOP_TOOLTIP_REFERENCE_WIDTH = 1440;

/**
 * Return the shared desktop scale before a tooltip applies its placement fit.
 * Small/mobile viewports keep the existing scale and media-query behavior.
 * @param {number} viewportWidth
 */
export function desktopTooltipScale(viewportWidth) {
  const width = Number(viewportWidth);
  if (!Number.isFinite(width) || width <= 640) return 1;
  return Math.max(0.72, Math.min(1, width / DESKTOP_TOOLTIP_REFERENCE_WIDTH));
}
