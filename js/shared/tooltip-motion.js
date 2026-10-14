/** Shared fade lifecycle for every floating tooltip surface. */

// Vault Hunters' gear cards use Tippy's fade animation with a 300ms CSS
// transition. Keep our shared lifecycle on the same cadence so entering,
// leaving, and switching anchors feel deliberate instead of flickering.
export const TOOLTIP_FADE_MS = 300;

/** @type {WeakMap<HTMLElement, number>} */
const hideTimers = new WeakMap();

/** @param {HTMLElement} element */
export function clearTooltipHide(element) {
  const timer = hideTimers.get(element);
  if (!timer) return;
  window.clearTimeout(timer);
  hideTimers.delete(element);
}

/**
 * Show a tooltip and cancel any in-flight fade-out before its content changes.
 * @param {HTMLElement} element
 */
export function showTooltip(element) {
  clearTooltipHide(element);
  const wasVisible = !element.hidden && element.classList.contains('is-visible');
  element.hidden = false;
  element.classList.remove('is-hiding', 'is-swapping');
  if (wasVisible) {
    // A reused host stays mounted while its content changes. Restart the
    // shared fade keyframes so moving between adjacent anchors still fades.
    void element.offsetWidth;
    element.classList.add('is-swapping');
  } else {
    // Hosts created with [hidden] have no painted opacity-0 frame for the
    // browser to transition from. Commit the base state before adding the
    // visible class so the enter fade is observable instead of appearing
    // instantly (the exit transition already has a painted starting state).
    element.classList.remove('is-visible');
    void element.offsetWidth;
  }
  element.classList.add('is-visible');
  element.setAttribute('aria-hidden', 'false');
}

/**
 * Fade a tooltip out, keeping its content mounted until the visual transition
 * finishes so the user sees a real fade instead of an instant blank frame.
 * @param {HTMLElement} element
 * @param {() => void} [after]
 */
export function hideTooltip(element, after) {
  clearTooltipHide(element);
  element.classList.remove('is-swapping');
  element.classList.remove('is-visible');
  element.classList.add('is-hiding');
  element.setAttribute('aria-hidden', 'true');
  const duration = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    ? 0
    : TOOLTIP_FADE_MS;
  const timer = window.setTimeout(() => {
    hideTimers.delete(element);
    element.classList.remove('is-hiding');
    element.hidden = true;
    after?.();
  }, duration);
  hideTimers.set(element, timer);
}
