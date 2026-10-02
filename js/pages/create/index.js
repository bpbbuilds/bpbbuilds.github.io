import { initNav } from '../../shared/nav.js';
import { initCreatePage } from './page.js?v=place-back';

async function boot() {
  if (!(await initNav())) return;
  initCreatePage();
}

void boot();
