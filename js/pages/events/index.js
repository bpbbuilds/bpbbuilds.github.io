/**
 * Events page — catalog (featured + cards + filters) + detail (?e=slug).
 */

import { initNav } from '../../shared/nav.js';
import { initFooter } from '../../shared/footer.js';
import { initEventsCatalog } from './catalog.js';

async function boot() {
  if (!(await initNav())) return;
  initFooter({ variant: 'slim' });
  const main = document.getElementById('main');
  const root = document.body.getAttribute('data-root') || '../';
  if (main instanceof HTMLElement) {
    initEventsCatalog(main, { root });
  }
}

void boot();
