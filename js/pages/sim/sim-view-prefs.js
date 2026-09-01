/**
 * Simple vs Advanced view preference for /sim/.
 * Advanced only affects tooltip “Changed by” attribution (not run-details chrome).
 */

export const ADVANCED_VIEW_KEY = 'bpb-sim-advanced-view';

/** @returns {boolean} */
export function readSimAdvancedView() {
  try {
    const q = new URLSearchParams(location.search);
    const raw = q.get('advanced');
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    /* ignore */
  }
  try {
    return localStorage.getItem(ADVANCED_VIEW_KEY) === '1';
  } catch {
    return false;
  }
}

/** @param {boolean} on */
export function writeSimAdvancedView(on) {
  try {
    if (on) localStorage.setItem(ADVANCED_VIEW_KEY, '1');
    else localStorage.removeItem(ADVANCED_VIEW_KEY);
  } catch {
    /* ignore */
  }
  try {
    const q = new URLSearchParams(location.search);
    if (on) q.set('advanced', '1');
    else q.delete('advanced');
    const qs = q.toString();
    const next = qs
      ? `${location.pathname}?${qs}${location.hash || ''}`
      : `${location.pathname}${location.hash || ''}`;
    history.replaceState(null, '', next);
  } catch {
    /* ignore */
  }
}

/**
 * @param {boolean} advanced
 * @param {{ shell?: HTMLElement | null }} [targets]
 */
export function applySimAdvancedView(advanced, targets = {}) {
  targets.shell?.classList.toggle('sim-shell--advanced', advanced);
}

/** @param {boolean} advanced */
export function simTooltipRenderOptions(advanced) {
  return {
    showChangedBy: advanced,
    statModsSidecar: advanced,
  };
}
