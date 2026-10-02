/**
 * Market stub — coming soon.
 */

import { initNav } from '../../shared/nav.js';
import { initFooter } from '../../shared/footer.js';

async function boot() {
  if (!(await initNav())) return;
  initFooter();
}

void boot();
