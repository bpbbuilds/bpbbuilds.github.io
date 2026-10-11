import { initNav } from '../../shared/nav.js';
import { initFooter } from '../../shared/footer.js';
import { initBuildPage } from './page.js';

const DESKTOP_REFERENCE_WIDTH = 2560;
const DESKTOP_REFERENCE_HEIGHT = 1440;

function syncBuildViewDesktopScale() {
  const body = document.body;
  if (!(body instanceof HTMLElement)) return;

  const isBuildView = body.classList.contains('page-build-view');
  const isDesktop = isBuildView && window.innerWidth > 1100;
  const scale = isDesktop
    ? Math.min(
        1,
        window.innerWidth / DESKTOP_REFERENCE_WIDTH,
        window.innerHeight / DESKTOP_REFERENCE_HEIGHT,
      )
    : 1;

  body.style.setProperty('--build-desktop-scale', String(scale));
}

async function boot() {
  if (!(await initNav())) return;
  syncBuildViewDesktopScale();
  window.addEventListener('resize', syncBuildViewDesktopScale, { passive: true });
  initFooter({
    variant: document.body.dataset.footerVariant === 'slim' ? 'slim' : 'default',
  });
  initBuildPage();
}

void boot();
