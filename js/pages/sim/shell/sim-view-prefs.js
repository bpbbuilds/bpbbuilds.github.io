/**
 * Simple vs Advanced view preference for /sim/.
 * Advanced only affects tooltip “Changed by” attribution (not run-details chrome).
 * Icon enlargement: Buff / Debuff / Block HUD sprites grow with stack count
 * (game BlockHud.calcScale). Off = fixed icon size.
 * Combat labels: floating damage / heal / buff text over fighters and bag items.
 */

export const ADVANCED_VIEW_KEY = 'bpb-sim-advanced-view';
export const ICON_ENLARGE_KEY = 'bpb-sim-icon-enlarge';
export const COMBAT_LABELS_KEY = 'bpb-sim-combat-labels';
export const MUTE_SOUNDS_KEY = 'bpb-sim-mute-sounds';

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

/** Default on — matches in-game stack / block icon growth. @returns {boolean} */
export function readSimIconEnlarge() {
  try {
    const q = new URLSearchParams(location.search);
    const raw = q.get('iconEnlarge');
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    /* ignore */
  }
  try {
    const v = localStorage.getItem(ICON_ENLARGE_KEY);
    if (v === '0') return false;
    if (v === '1') return true;
  } catch {
    /* ignore */
  }
  return true;
}

/** @param {boolean} on */
export function writeSimIconEnlarge(on) {
  try {
    localStorage.setItem(ICON_ENLARGE_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Default on — floating damage / buff values over fighters and items. @returns {boolean} */
export function readSimCombatLabels() {
  try {
    const q = new URLSearchParams(location.search);
    const raw = q.get('combatLabels');
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    /* ignore */
  }
  try {
    const v = localStorage.getItem(COMBAT_LABELS_KEY);
    if (v === '0') return false;
    if (v === '1') return true;
  } catch {
    /* ignore */
  }
  return true;
}

/** @param {boolean} on */
export function writeSimCombatLabels(on) {
  try {
    localStorage.setItem(COMBAT_LABELS_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Default off — fight sounds play. @returns {boolean} */
export function readSimSoundsMuted() {
  try {
    return localStorage.getItem(MUTE_SOUNDS_KEY) === '1';
  } catch {
    return false;
  }
}

/** @param {boolean} on */
export function writeSimSoundsMuted(on) {
  try {
    localStorage.setItem(MUTE_SOUNDS_KEY, on ? '1' : '0');
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
