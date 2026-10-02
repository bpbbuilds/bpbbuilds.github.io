import { initNav } from '../../shared/nav.js';
import { initFooter } from '../../shared/footer.js';
import { initItemsCatalog } from './catalog.js';
import { watchItemsCatalogColumns } from './catalog-responsive.js';
import { initWheelToGrid } from './wheel-to-grid.js';

initNav();
initFooter({ variant: 'slim' });
void initItemsCatalog().then(() => {
  watchItemsCatalogColumns();
});
initWheelToGrid();
