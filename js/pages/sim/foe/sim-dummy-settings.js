/**
 * Training dummy combat settings — UI + localStorage + URL merge.
 */

import {
  DUMMY_ATTACK_CD,
  DUMMY_ATTACK_DAMAGE,
  DUMMY_MAX_HP,
} from '../engine/actor.js';
import { parseDummyBlock } from '../shell/sim-permalink.js';

export const DUMMY_PRESET_KEY = 'bpb-sim-dummy-preset';

/**
 * @typedef {{
 *   maxHp: number,
 *   block: number,
 *   attacks: boolean,
 *   damage: number,
 *   interval: number,
 * }} DummySettings
 */

/** @returns {DummySettings} */
export function defaultDummySettings() {
  return {
    maxHp: DUMMY_MAX_HP,
    block: 0,
    attacks: true,
    damage: DUMMY_ATTACK_DAMAGE,
    interval: DUMMY_ATTACK_CD,
  };
}

/**
 * @param {unknown} raw
 * @returns {DummySettings | null}
 */
function normalizePreset(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const base = defaultDummySettings();
  const maxHp = Number(o.maxHp);
  const block = Number(o.block);
  const damage = Number(o.damage);
  const interval = Number(o.interval);
  return {
    maxHp: Number.isFinite(maxHp) && maxHp > 0 ? Math.round(maxHp) : base.maxHp,
    block: Number.isFinite(block) && block > 0 ? Math.round(block) : 0,
    attacks: o.attacks !== false && o.attacks !== 0 && o.attacks !== '0',
    damage: Number.isFinite(damage) && damage >= 0 ? Math.round(damage) : base.damage,
    interval:
      Number.isFinite(interval) && interval > 0 ? Number(interval) : base.interval,
  };
}

/** @returns {DummySettings | null} */
export function loadDummyPreset() {
  try {
    const raw = localStorage.getItem(DUMMY_PRESET_KEY);
    if (!raw) return null;
    return normalizePreset(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * @param {DummySettings} settings
 */
export function saveDummyPreset(settings) {
  const n = normalizePreset(settings) || defaultDummySettings();
  try {
    localStorage.setItem(DUMMY_PRESET_KEY, JSON.stringify(n));
  } catch {
    /* ignore quota */
  }
}

/**
 * URL wins for present keys; else storage; else defaults.
 * @param {ReturnType<import('../shell/sim-permalink.js').readSimQuery>} [query]
 * @returns {DummySettings}
 */
export function readDummySettings(query) {
  const stored = loadDummyPreset() || defaultDummySettings();
  const out = { ...stored };
  const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  const src = query || {};

  if (q.has('dummyHp') && src.dummyHp != null && Number(src.dummyHp) > 0) {
    out.maxHp = Math.round(Number(src.dummyHp));
  }
  if (q.has('dummyBlock')) {
    out.block = parseDummyBlock(src.dummyBlock);
  }
  if (q.has('dummyAtk') && (src.dummyAtk === true || src.dummyAtk === false)) {
    out.attacks = src.dummyAtk;
  }
  if (q.has('dummyDmg') && src.dummyDmg != null && Number(src.dummyDmg) >= 0) {
    out.damage = Math.round(Number(src.dummyDmg));
  }
  if (q.has('dummyCd') && src.dummyCd != null && Number(src.dummyCd) > 0) {
    out.interval = Number(src.dummyCd);
  }
  return out;
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   settings: DummySettings,
 *   onApply: (next: DummySettings) => void,
 * }} opts
 */
export function mountSimDummySettings(host, opts) {
  let settings = { ...opts.settings };

  const paint = () => {
    host.innerHTML = `
      <div class="sim-dummy-set" data-sim-dummy-set>
        <p class="sim-dummy-set__label">Dummy settings</p>
        <div class="sim-dummy-set__grid">
          <label class="sim-dummy-set__field">
            <span class="sim-dummy-set__field-label">Max HP</span>
            <input type="number" class="sim-dummy-set__input" data-dummy-hp min="1" step="1" value="${settings.maxHp}" />
          </label>
          <label class="sim-dummy-set__field">
            <span class="sim-dummy-set__field-label">Start block</span>
            <input type="number" class="sim-dummy-set__input" data-dummy-block min="0" step="1" value="${settings.block}" />
          </label>
          <label class="sim-dummy-set__field">
            <span class="sim-dummy-set__field-label">Attack dmg</span>
            <input type="number" class="sim-dummy-set__input" data-dummy-dmg min="0" step="1" value="${settings.damage}" />
          </label>
          <label class="sim-dummy-set__field">
            <span class="sim-dummy-set__field-label">Interval (s)</span>
            <input type="number" class="sim-dummy-set__input" data-dummy-cd min="0.05" step="0.05" value="${settings.interval}" />
          </label>
          <button
            type="button"
            class="sim-dummy-set__check${settings.attacks ? ' is-on' : ''}"
            data-dummy-atk
            role="switch"
            aria-checked="${settings.attacks ? 'true' : 'false'}"
          >
            <span class="sim-dummy-set__box" aria-hidden="true"></span>
            <span class="sim-dummy-set__check-label">Dummy attacks</span>
          </button>
          <button type="button" class="sim-dummy-set__apply" data-dummy-apply>Apply</button>
        </div>
      </div>
    `;

    const atkBtn = host.querySelector('[data-dummy-atk]');
    atkBtn?.addEventListener('click', () => {
      if (!(atkBtn instanceof HTMLButtonElement)) return;
      const on = atkBtn.getAttribute('aria-checked') !== 'true';
      atkBtn.setAttribute('aria-checked', on ? 'true' : 'false');
      atkBtn.classList.toggle('is-on', on);
    });

    host.querySelector('[data-dummy-apply]')?.addEventListener('click', () => {
      const hpEl = host.querySelector('[data-dummy-hp]');
      const blockEl = host.querySelector('[data-dummy-block]');
      const dmgEl = host.querySelector('[data-dummy-dmg]');
      const cdEl = host.querySelector('[data-dummy-cd]');
      const next = normalizePreset({
        maxHp: hpEl instanceof HTMLInputElement ? hpEl.value : settings.maxHp,
        block: blockEl instanceof HTMLInputElement ? blockEl.value : settings.block,
        damage: dmgEl instanceof HTMLInputElement ? dmgEl.value : settings.damage,
        interval: cdEl instanceof HTMLInputElement ? cdEl.value : settings.interval,
        attacks:
          atkBtn instanceof HTMLButtonElement
            ? atkBtn.getAttribute('aria-checked') === 'true'
            : settings.attacks,
      });
      if (!next) return;
      settings = next;
      opts.onApply(next);
    });
  };

  paint();

  return {
    /** @returns {DummySettings} */
    getSettings() {
      return { ...settings };
    },
    /**
     * @param {DummySettings} next
     */
    setSettings(next) {
      settings = normalizePreset(next) || defaultDummySettings();
      paint();
    },
    destroy() {
      host.innerHTML = '';
    },
  };
}
