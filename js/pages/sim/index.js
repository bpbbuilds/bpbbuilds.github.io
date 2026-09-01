/**
 * /sim/ — solo combat sandbox entry.
 */

import { initNav } from '../../shared/nav.js';
import { initFooter } from '../../shared/footer.js';
import {
  resumePremiumIntent,
  SIM_HARD_GATE_INTENT,
} from '../../shared/premium-gate.js';
import { initSimPage } from './page.js';

initNav();
initFooter({ variant: 'slim' });

void (async () => {
  const resumed = await resumePremiumIntent({
    [SIM_HARD_GATE_INTENT]: () => {
      location.reload();
    },
  });
  // Entitled OAuth return reloads; skip init so we don't race the reload.
  if (resumed) return;
  initSimPage();
})();
