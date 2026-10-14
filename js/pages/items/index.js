import { initNav } from '../../shared/nav.js';
import { initFooter } from '../../shared/footer.js';
import { initItemsCatalog } from './catalog.js';
import { watchItemsCatalogColumns } from './catalog-responsive.js';
import { initWheelToGrid } from './wheel-to-grid.js';

async function boot() {
  // Start the catalog as soon as the shared access gate passes. Nav image
  // decoration/auth UI can continue warming in parallel without delaying the
  // page's critical content path.
  let catalogPromise = null;
  const navPromise = initNav('#site-nav', {
    onAccessGranted: () => {
      catalogPromise = initItemsCatalog();
    },
  });
  if (!(await navPromise)) return;
  initFooter({ variant: 'slim' });
  const ready = catalogPromise || initItemsCatalog();
  void ready.then(() => {
    watchItemsCatalogColumns();
  });
  initWheelToGrid();
}

void boot();
