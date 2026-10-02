/**
 * Builds catalog — /builds/
 */

import { initNav } from '../../shared/nav.js';
import { initFooter } from '../../shared/footer.js';
import { initBuildsFeed } from './feed.js';

function rootPrefix() {
  const raw = document.body?.dataset?.root ?? '../';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

async function boot() {
  initNav();
  initFooter({ variant: 'slim' });
  const main = document.getElementById('main');
  if (!(main instanceof HTMLElement)) return;
  await initBuildsFeed(main, { root: rootPrefix() });
}

boot();
