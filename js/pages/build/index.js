import { initNav } from '../../shared/nav.js';
import { initFooter } from '../../shared/footer.js';
import { initBuildPage } from './page.js';

async function boot() {
  if (!(await initNav())) return;
  initFooter({
    variant: document.body.dataset.footerVariant === 'slim' ? 'slim' : 'default',
  });
  initBuildPage();
}

void boot();
