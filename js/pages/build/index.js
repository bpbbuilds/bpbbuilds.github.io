import { initNav } from '../../shared/nav.js';
import { initFooter } from '../../shared/footer.js';
import { initBuildPage } from './page.js?v=build-view-info-footer-tooltip-20261016a';

const BUILD_DESKTOP_REFERENCE_WIDTH = 2560;
const BUILD_DESKTOP_REFERENCE_HEIGHT = 1440;

function syncBuildViewDesktopScale() {
  const body = document.body;
  if (!(body instanceof HTMLElement)) return;

  const isBuildView = body.classList.contains('page-build-view');
  const isDesktop = isBuildView && window.innerWidth > 1100;
  const scale = isDesktop
    ? Math.min(
        1,
        window.innerWidth / BUILD_DESKTOP_REFERENCE_WIDTH,
        window.innerHeight / BUILD_DESKTOP_REFERENCE_HEIGHT,
      )
    : 1;

  body.style.setProperty('--build-desktop-scale', String(scale));
}

async function boot() {
  // Set the composition scale before the fixed nav/content boot can paint so
  // short desktop windows do not briefly render the full 1440p layout.
  syncBuildViewDesktopScale();
  window.addEventListener('resize', syncBuildViewDesktopScale, { passive: true });
  if (!(await initNav())) return;
  initFooter({
    variant: document.body.dataset.footerVariant === 'slim' ? 'slim' : 'default',
  });
  initBuildPage();
}

void boot();
