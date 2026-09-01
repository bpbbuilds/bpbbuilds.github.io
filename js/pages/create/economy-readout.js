/**
 * Create toolbar economy chips — markup + paint.
 */

import {
  formatEconomyNum,
  formatStaminaRate,
  staminaUsageIconUrl,
  summarizeBoardEconomy,
} from './board-economy.js';

/**
 * @param {string} rootBase
 * @returns {string}
 */
export function economyReadoutHtml(rootBase) {
  return `
        <div
          class="create-board__economy"
          data-board-economy
          aria-label="Run economy"
        >
          <span
            class="create-board__econ create-board__econ--gold"
            title="Gold on board"
          >
            <span class="create-board__econ-num build-info__ui-text" data-econ-gold>0</span>
            <img
              class="create-board__econ-icon"
              src="${rootBase}assets/tooltips/icons/Gold.png"
              alt=""
              width="26"
              height="26"
              aria-hidden="true"
              draggable="false"
            />
          </span>
          <span
            class="create-board__econ create-board__econ--stam-pool"
            title="Stamina cost / max"
            data-econ-stam-pool
          >
            <span class="create-board__econ-num build-info__ui-text">
              <span data-econ-stam-cost>0</span><span class="create-board__econ-sep">/</span><span data-econ-stam-max>5</span>
            </span>
            <img
              class="create-board__econ-icon"
              src="${rootBase}assets/tooltips/icons/Stamina.png"
              alt=""
              width="26"
              height="26"
              aria-hidden="true"
              draggable="false"
            />
          </span>
          <span
            class="create-board__econ create-board__econ--stam-rate"
            title="Stamina Usage"
            data-econ-stam-rate
            data-tier="veryLow"
          >
            <img
              class="create-board__econ-icon create-board__econ-icon--usage"
              data-econ-stam-icon
              src="${staminaUsageIconUrl(1, rootBase)}"
              alt=""
              width="36"
              height="36"
              aria-hidden="true"
              draggable="false"
            />
            <span
              class="create-board__econ-label build-info__ui-text"
              data-econ-stam-label
            >Very low</span>
          </span>
        </div>`;
}

/**
 * @param {ParentNode} host
 * @param {{
 *   placements: import('./draft-io.js').DraftPlacement[],
 *   itemsById: Map<string, object>,
 *   rootBase: string,
 * }} opts
 */
export function paintEconomyReadout(host, opts) {
  const {
    gold,
    staminaCost,
    staminaMax,
    staminaRate,
    staminaTier,
  } = summarizeBoardEconomy(opts.placements, opts.itemsById);
  const goldEl = host.querySelector('[data-econ-gold]');
  const costEl = host.querySelector('[data-econ-stam-cost]');
  const maxEl = host.querySelector('[data-econ-stam-max]');
  const poolWrap = host.querySelector('[data-econ-stam-pool]');
  const rateWrap = host.querySelector('[data-econ-stam-rate]');
  const rateIcon = host.querySelector('[data-econ-stam-icon]');
  const rateLabel = host.querySelector('[data-econ-stam-label]');
  const rateStr = formatStaminaRate(staminaRate);
  if (goldEl instanceof HTMLElement) {
    goldEl.textContent = formatEconomyNum(Math.round(gold));
  }
  if (costEl instanceof HTMLElement) {
    costEl.textContent = formatEconomyNum(staminaCost);
  }
  if (maxEl instanceof HTMLElement) {
    maxEl.textContent = formatEconomyNum(staminaMax);
  }
  if (poolWrap instanceof HTMLElement) {
    poolWrap.classList.toggle('is-over', staminaCost > staminaMax + 1e-9);
    poolWrap.title = `Stamina cost ${formatEconomyNum(staminaCost)} / max ${formatEconomyNum(staminaMax)}`;
    poolWrap.setAttribute(
      'aria-label',
      `Stamina cost ${formatEconomyNum(staminaCost)} of ${formatEconomyNum(staminaMax)}`,
    );
  }
  if (rateWrap instanceof HTMLElement) {
    rateWrap.dataset.tier = staminaTier.id;
    rateWrap.style.setProperty('--stam-tier-color', staminaTier.color);
    rateWrap.title = `Stamina Usage: ${staminaTier.label} (${rateStr}/s)`;
    rateWrap.setAttribute(
      'aria-label',
      `Stamina Usage ${staminaTier.label}, ${rateStr} per second`,
    );
  }
  if (rateIcon instanceof HTMLImageElement) {
    const nextSrc = staminaUsageIconUrl(staminaTier.frame, opts.rootBase);
    if (rateIcon.getAttribute('src') !== nextSrc) rateIcon.src = nextSrc;
  }
  if (rateLabel instanceof HTMLElement) {
    rateLabel.textContent = staminaTier.label;
  }
}
