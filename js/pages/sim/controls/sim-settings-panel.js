/**
 * Bottom-right settings cog + panel (game OptionsButton art).
 * Panel opens to the left of the cog so the cog stays put.
 */

import {
  applySimAdvancedView,
  readSimAdvancedView,
  readSimCombatLabels,
  readSimIconEnlarge,
  readSimSoundsMuted,
  writeSimAdvancedView,
  writeSimCombatLabels,
  writeSimIconEnlarge,
  writeSimSoundsMuted,
} from '../shell/sim-view-prefs.js';

/**
 * @param {HTMLElement} btn
 * @param {string} idle
 */
function flashCopied(btn, idle) {
  btn.textContent = 'Copied';
  window.setTimeout(() => {
    btn.textContent = idle;
  }, 1400);
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   assetRoot?: string,
 *   shell?: HTMLElement | null,
 *   onAdvancedChange?: (advanced: boolean) => void,
 *   onIconEnlargeChange?: (on: boolean) => void,
 *   onCombatLabelsChange?: (on: boolean) => void,
 *   onSoundsMutedChange?: (on: boolean) => void,
 *   getPermalinkHref?: () => string,
 *   onCopyLink?: () => void | Promise<void>,
 *   onCopyReport?: () => void | Promise<void>,
 *   onDownloadReport?: () => void,
 * }} opts
 */
export function mountSimSettingsPanel(host, opts = {}) {
  const root = opts.assetRoot || '../';
  const base = root.endsWith('/') ? root : `${root}/`;
  const icon = `${base}assets/icons/sim/OptionsButton.png`;
  const iconHover = `${base}assets/icons/sim/OptionsButton_hovered.png`;

  let advanced = readSimAdvancedView();
  let iconEnlarge = readSimIconEnlarge();
  let combatLabels = readSimCombatLabels();
  let soundsMuted = readSimSoundsMuted();
  let open = false;

  host.innerHTML = `
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
    <div class="sim-settings-dock__panel sim-settings-panel" data-settings-panel hidden role="dialog" aria-label="Sim settings" aria-modal="false">
      <h3 class="sim-settings-panel__title">Settings</h3>
      <div class="sim-settings-panel__opts">
        <div class="sim-settings-panel__row">
          <label class="sim-settings-panel__opt">
            <input type="checkbox" class="sim-settings-panel__check" data-advanced-toggle />
            <span class="sim-settings-panel__label">Advanced view</span>
          </label>
          <span class="sim-settings-panel__info-wrap">
            <button
              type="button"
              class="sim-settings-info"
              data-settings-info
              aria-label="About Advanced view"
              aria-expanded="false"
            >i</button>
            <span class="sim-settings-panel__tip" role="tooltip">
              Show tooltip “Changed by” combat attribution. Opens in a panel beside the tooltip. Alt pins · expand rows · Esc releases.
            </span>
          </span>
        </div>
        <div class="sim-settings-panel__row">
          <label class="sim-settings-panel__opt">
            <input type="checkbox" class="sim-settings-panel__check" data-icon-enlarge-toggle />
            <span class="sim-settings-panel__label">Icon enlargement</span>
          </label>
          <span class="sim-settings-panel__info-wrap">
            <button
              type="button"
              class="sim-settings-info"
              data-settings-info
              aria-label="About Icon enlargement"
              aria-expanded="false"
            >i</button>
            <span class="sim-settings-panel__tip" role="tooltip">
              Buff, debuff, and block icons grow with their stack count.
            </span>
          </span>
        </div>
        <div class="sim-settings-panel__row">
          <label class="sim-settings-panel__opt">
            <input type="checkbox" class="sim-settings-panel__check" data-combat-labels-toggle />
            <span class="sim-settings-panel__label">Combat labels</span>
          </label>
          <span class="sim-settings-panel__info-wrap">
            <button
              type="button"
              class="sim-settings-info"
              data-settings-info
              aria-label="About Combat labels"
              aria-expanded="false"
            >i</button>
            <span class="sim-settings-panel__tip" role="tooltip">
              Damage, heal, and buff values over fighters and items.
            </span>
          </span>
        </div>
        <div class="sim-settings-panel__row">
          <label class="sim-settings-panel__opt">
            <input type="checkbox" class="sim-settings-panel__check" data-mute-sounds-toggle />
            <span class="sim-settings-panel__label">Mute sounds</span>
          </label>
          <span class="sim-settings-panel__info-wrap">
            <button
              type="button"
              class="sim-settings-info"
              data-settings-info
              aria-label="About Mute sounds"
              aria-expanded="false"
            >i</button>
            <span class="sim-settings-panel__tip" role="tooltip">
              Silence fight sounds, including the out-of-stamina toot.
            </span>
          </span>
        </div>
      </div>
      <h4 class="sim-settings-panel__sub">Share</h4>
      <div class="sim-settings-panel__links">
        <a class="sim-settings-panel__link" data-settings-permalink href="?">Permalink</a>
        <button type="button" class="sim-settings-panel__link sim-link-btn" data-settings-copy>Copy link</button>
        <button type="button" class="sim-settings-panel__link sim-link-btn" data-settings-copy-report>Copy report</button>
        <button type="button" class="sim-settings-panel__link sim-link-btn" data-settings-download>Download report</button>
      </div>
    </div>
  `;

  const panel = host.querySelector('[data-settings-panel]');
  const toggleBtn = host.querySelector('[data-settings-toggle]');
  const advancedInput = host.querySelector('[data-advanced-toggle]');
  const iconEnlargeInput = host.querySelector('[data-icon-enlarge-toggle]');
  const combatLabelsInput = host.querySelector('[data-combat-labels-toggle]');
  const soundsMutedInput = host.querySelector('[data-mute-sounds-toggle]');
  const artEl = host.querySelector('.sim-settings-btn__art');
  const permalinkEl = host.querySelector('[data-settings-permalink]');
  const copyBtn = host.querySelector('[data-settings-copy]');
  const copyReportBtn = host.querySelector('[data-settings-copy-report]');
  const downloadBtn = host.querySelector('[data-settings-download]');

  if (panel instanceof HTMLElement) {
    panel.id = 'sim-settings-panel';
    toggleBtn?.setAttribute('aria-controls', panel.id);
  }

  function syncPermalink() {
    if (!(permalinkEl instanceof HTMLAnchorElement)) return;
    const href = opts.getPermalinkHref?.() || permalinkEl.getAttribute('href') || '?';
    permalinkEl.href = href;
  }

  function paintAdvanced() {
    if (advancedInput instanceof HTMLInputElement) {
      advancedInput.checked = advanced;
    }
    applySimAdvancedView(advanced, { shell: opts.shell });
    opts.onAdvancedChange?.(advanced);
  }

  function paintIconEnlarge() {
    if (iconEnlargeInput instanceof HTMLInputElement) {
      iconEnlargeInput.checked = iconEnlarge;
    }
    opts.onIconEnlargeChange?.(iconEnlarge);
  }

  function paintCombatLabels() {
    if (combatLabelsInput instanceof HTMLInputElement) {
      combatLabelsInput.checked = combatLabels;
    }
    opts.onCombatLabelsChange?.(combatLabels);
  }

  function paintSoundsMuted() {
    if (soundsMutedInput instanceof HTMLInputElement) {
      soundsMutedInput.checked = soundsMuted;
    }
    opts.onSoundsMutedChange?.(soundsMuted);
  }

  function setAdvanced(next) {
    advanced = Boolean(next);
    writeSimAdvancedView(advanced);
    paintAdvanced();
  }

  function setIconEnlarge(next) {
    iconEnlarge = Boolean(next);
    writeSimIconEnlarge(iconEnlarge);
    paintIconEnlarge();
  }

  function setCombatLabels(next) {
    combatLabels = Boolean(next);
    writeSimCombatLabels(combatLabels);
    paintCombatLabels();
  }

  function setSoundsMuted(next) {
    soundsMuted = Boolean(next);
    writeSimSoundsMuted(soundsMuted);
    paintSoundsMuted();
  }

  function setOpen(next) {
    open = next;
    if (open) syncPermalink();
    else closeInfoTips();
    if (panel instanceof HTMLElement) {
      panel.hidden = !open;
    }
    if (toggleBtn instanceof HTMLElement) {
      toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggleBtn.classList.toggle('is-open', open);
    }
  }

  function closeInfoTips(except = null) {
    host.querySelectorAll('[data-settings-info]').forEach((btn) => {
      if (!(btn instanceof HTMLElement) || btn === except) return;
      btn.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      btn.closest('.sim-settings-panel__info-wrap')?.classList.remove('is-open');
    });
  }

  function onDocPointerDown(e) {
    const t = e.target;
    if (t instanceof Element && t.closest('[data-settings-info]')) return;
    closeInfoTips();
    if (!open) return;
    if (t instanceof Node && host.contains(t)) return;
    setOpen(false);
  }

  function onKey(e) {
    if (e.key !== 'Escape') return;
    const pinned = host.querySelector('[data-settings-info].is-open');
    if (pinned) {
      closeInfoTips();
      e.stopPropagation();
      return;
    }
    if (open) setOpen(false);
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

  host.querySelectorAll('[data-settings-info]').forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const next = !btn.classList.contains('is-open');
      closeInfoTips(next ? btn : null);
      btn.classList.toggle('is-open', next);
      btn.setAttribute('aria-expanded', next ? 'true' : 'false');
      btn.closest('.sim-settings-panel__info-wrap')?.classList.toggle('is-open', next);
    });
  });

  advancedInput?.addEventListener('change', () => {
    if (advancedInput instanceof HTMLInputElement) {
      setAdvanced(advancedInput.checked);
    }
  });

  iconEnlargeInput?.addEventListener('change', () => {
    if (iconEnlargeInput instanceof HTMLInputElement) {
      setIconEnlarge(iconEnlargeInput.checked);
    }
  });

  combatLabelsInput?.addEventListener('change', () => {
    if (combatLabelsInput instanceof HTMLInputElement) {
      setCombatLabels(combatLabelsInput.checked);
    }
  });

  soundsMutedInput?.addEventListener('change', () => {
    if (soundsMutedInput instanceof HTMLInputElement) {
      setSoundsMuted(soundsMutedInput.checked);
    }
  });

  copyBtn?.addEventListener('click', () => {
    void Promise.resolve(opts.onCopyLink?.()).then(
      () => {
        if (copyBtn instanceof HTMLElement) flashCopied(copyBtn, 'Copy link');
      },
      () => {},
    );
  });

  copyReportBtn?.addEventListener('click', () => {
    void Promise.resolve(opts.onCopyReport?.()).then(
      () => {
        if (copyReportBtn instanceof HTMLElement) {
          flashCopied(copyReportBtn, 'Copy report');
        }
      },
      () => {},
    );
  });

  downloadBtn?.addEventListener('click', () => {
    opts.onDownloadReport?.();
  });

  document.addEventListener('pointerdown', onDocPointerDown);
  document.addEventListener('keydown', onKey);

  paintAdvanced();
  paintIconEnlarge();
  paintCombatLabels();
  paintSoundsMuted();
  syncPermalink();

  return {
    getAdvanced: () => advanced,
    setAdvanced,
    getIconEnlarge: () => iconEnlarge,
    setIconEnlarge,
    getCombatLabels: () => combatLabels,
    setCombatLabels,
    getSoundsMuted: () => soundsMuted,
    setSoundsMuted,
    setPermalinkHref(href) {
      if (permalinkEl instanceof HTMLAnchorElement) {
        permalinkEl.href = href;
      }
    },
    destroy() {
      document.removeEventListener('pointerdown', onDocPointerDown);
      document.removeEventListener('keydown', onKey);
      host.replaceChildren();
    },
  };
}
