/**
 * /sim/ hard gate — locked lab chrome + shared Premium offer.
 * Real lock: callers must skip mountRun() / runSim when not entitled.
 */

import {
  SIM_HARD_GATE_INTENT,
  savePremiumIntent,
} from '../../../shared/premium-gate.js';
import {
  openSignInOffer,
  openUpgradeOffer,
} from '../../../shared/premium-offer.js';

export const SIM_PREMIUM_REASON = 'Run builds in the combat sandbox.';

function simLockCardHtml() {
  return `
    <div class="sim-lock" role="status">
      <p class="sim-lock__title">Premium</p>
      <p class="sim-lock__line">Playback, the combat log, and damage meters unlock with Premium.</p>
      <button type="button" class="sim-lock__btn" data-sim-premium-open>View Premium</button>
    </div>
  `;
}

/**
 * Paint locked placeholders on an already-mounted sim shell (boards stay visible).
 * @param {HTMLElement} main
 * @param {{ signedIn?: boolean }} [_opts]
 */
export function applySimPremiumLock(main, _opts = {}) {
  const shell = main.querySelector('.sim-shell');
  if (shell instanceof HTMLElement) {
    shell.classList.add('sim-shell--locked');
  }

  const field = main.querySelector('.sim-field');
  if (field instanceof HTMLElement && !field.querySelector('.sim-field__lock-dim')) {
    const dim = document.createElement('div');
    dim.className = 'sim-field__lock-dim';
    dim.setAttribute('aria-hidden', 'true');
    field.appendChild(dim);
  }

  const scrubHost = main.querySelector('[data-sim-scrub]');
  if (scrubHost instanceof HTMLElement) scrubHost.replaceChildren();

  const bannerEl = main.querySelector('[data-sim-banner]');
  if (bannerEl instanceof HTMLElement) {
    bannerEl.replaceChildren();
    bannerEl.hidden = true;
  }

  const resultsHost = main.querySelector('[data-sim-combat-results]');
  if (resultsHost instanceof HTMLElement) resultsHost.replaceChildren();

  if (field instanceof HTMLElement && !field.querySelector('.sim-lock')) {
    field.insertAdjacentHTML('beforeend', simLockCardHtml());
    field.querySelector('[data-sim-premium-open]')?.addEventListener('click', () => {
      void openSimPremiumGate({ signedIn: Boolean(_opts.signedIn) });
    });
  }

  for (const sel of [
    '[data-sim-copy-report]',
    '[data-sim-download-report]',
  ]) {
    const btn = main.querySelector(sel);
    if (!(btn instanceof HTMLButtonElement)) continue;
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
    btn.title = 'Premium required';
  }
}

/**
 * Open sign-in or upgrade offer for a locked `/sim/` visit.
 * @param {{ signedIn: boolean }} opts
 */
export async function openSimPremiumGate(opts) {
  const reason = SIM_PREMIUM_REASON;
  savePremiumIntent({ key: SIM_HARD_GATE_INTENT, reason });

  if (!opts.signedIn) {
    await openSignInOffer({
      reason,
      onDiscord: () =>
        savePremiumIntent({ key: SIM_HARD_GATE_INTENT, reason }),
    });
    return;
  }

  await openUpgradeOffer({ reason });
}
