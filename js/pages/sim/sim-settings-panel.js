/**
 * Bottom-right settings cog + panel (game OptionsButton art).
 */

import {
  applySimAdvancedView,
  readSimAdvancedView,
  writeSimAdvancedView,
} from './sim-view-prefs.js';

/**
 * @param {HTMLElement} host
 * @param {{
 *   assetRoot?: string,
 *   shell?: HTMLElement | null,
 *   onAdvancedChange?: (advanced: boolean) => void,
 * }} opts
 */
export function mountSimSettingsPanel(host, opts = {}) {
  const root = opts.assetRoot || '../';
  const base = root.endsWith('/') ? root : `${root}/`;
  const icon = `${base}assets/icons/sim/OptionsButton.png`;
  const iconHover = `${base}assets/icons/sim/OptionsButton_hovered.png`;

  let advanced = readSimAdvancedView();
  let open = false;

  host.innerHTML = `
    <div class="sim-settings-dock__panel sim-settings-panel" data-settings-panel hidden role="dialog" aria-label="Sim settings" aria-modal="false">
      <h3 class="sim-settings-panel__title">Settings</h3>
      <label class="sim-settings-panel__row">
        <input type="checkbox" class="sim-settings-panel__check" data-advanced-toggle />
        <span class="sim-settings-panel__label">Advanced view</span>
      </label>
      <p class="sim-settings-panel__hint">Show tooltip “Changed by” combat attribution.</p>
      <p class="sim-settings-panel__hint">“Changed by” opens in a panel beside the tooltip.</p>
      <p class="sim-settings-panel__hint">Alt pins · expand rows · Esc releases.</p>
    </div>
    <button
      type="button"
      class="sim-settings-btn"
      data-settings-toggle
      aria-label="Settings"
      aria-expanded="false"
      aria-controls="sim-settings-panel"
      title="Settings"
    >
      <img
        class="sim-settings-btn__art"
        src="${icon}"
        alt=""
        width="109"
        height="113"
        draggable="false"
        data-art-normal="${icon}"
        data-art-hover="${iconHover}"
      />
    </button>
  `;

  const panel = host.querySelector('[data-settings-panel]');
  const toggleBtn = host.querySelector('[data-settings-toggle]');
  const advancedInput = host.querySelector('[data-advanced-toggle]');
  const artEl = host.querySelector('.sim-settings-btn__art');

  if (panel instanceof HTMLElement) {
    panel.id = 'sim-settings-panel';
    toggleBtn?.setAttribute('aria-controls', panel.id);
  }

  function paintAdvanced() {
    if (advancedInput instanceof HTMLInputElement) {
      advancedInput.checked = advanced;
    }
    applySimAdvancedView(advanced, { shell: opts.shell });
    opts.onAdvancedChange?.(advanced);
  }

  function setAdvanced(next) {
    advanced = Boolean(next);
    writeSimAdvancedView(advanced);
    paintAdvanced();
  }

  function setOpen(next) {
    open = next;
    if (panel instanceof HTMLElement) {
      panel.hidden = !open;
    }
    if (toggleBtn instanceof HTMLElement) {
      toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggleBtn.classList.toggle('is-open', open);
    }
  }

  function onDocPointerDown(e) {
    if (!open) return;
    const t = e.target;
    if (t instanceof Node && host.contains(t)) return;
    setOpen(false);
  }

  function onKey(e) {
    if (e.key === 'Escape' && open) {
      setOpen(false);
    }
  }

  if (artEl instanceof HTMLImageElement && toggleBtn) {
    toggleBtn.addEventListener('pointerenter', () => {
      artEl.src = artEl.dataset.artHover || iconHover;
    });
    toggleBtn.addEventListener('pointerleave', () => {
      artEl.src = artEl.dataset.artNormal || icon;
    });
  }

  toggleBtn?.addEventListener('click', () => setOpen(!open));

  advancedInput?.addEventListener('change', () => {
    if (advancedInput instanceof HTMLInputElement) {
      setAdvanced(advancedInput.checked);
    }
  });

  document.addEventListener('pointerdown', onDocPointerDown);
  document.addEventListener('keydown', onKey);

  paintAdvanced();

  return {
    getAdvanced: () => advanced,
    setAdvanced,
    destroy() {
      document.removeEventListener('pointerdown', onDocPointerDown);
      document.removeEventListener('keydown', onKey);
      host.replaceChildren();
    },
  };
}
