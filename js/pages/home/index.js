import { initNav } from '../../shared/nav.js';
import { initFooter } from '../../shared/footer.js';
import { initCombatSky } from './combat-sky.js';
import { initFeaturedStage } from './featured-stage.js';
import { initHomePromoBand } from './home-promo-band.js';
import { initHomeClassShowcase } from './home-class-showcase.js';
import { initHomeItemsExplore } from './home-items-explore.js';
import { initHomeBuildsVault } from './home-builds-vault.js';

async function boot() {
  if (!(await initNav())) return;
  initCombatSky();
  initFooter();
  initFeaturedStage();

  // Each section owns a page-shaped loading state (catalog stamp, board,
  // class rail, item orbit, and build cards). Mount that chrome now instead
  // of waiting for idle time, so a first visit never shows blank bands while
  // the deferred data work is pending.
  initHomePromoBand('#home-promo-band', { variant: 'create' });
  initHomeClassShowcase();
  initHomeItemsExplore();
  initHomeBuildsVault();
}

void boot();
