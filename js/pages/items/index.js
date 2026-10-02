import { initNav } from '../../shared/nav.js';
import { initFooter } from '../../shared/footer.js';
import { initItemsCatalog } from './catalog.js';
import { watchItemsCatalogColumns } from './catalog-responsive.js';
import { initWheelToGrid } from './wheel-to-grid.js';

async function boot() {
  if (!(await initNav())) return;
  initFooter({ variant: 'slim' });
  void initItemsCatalog().then(() => {
    watchItemsCatalogColumns();
  });
  initWheelToGrid();
}

void boot();
