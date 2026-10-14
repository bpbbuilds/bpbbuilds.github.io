/**
 * Site header — shelves flanking BPB logo + Builds banner.
 * Fixed (Vault Hunters–style) with an in-flow #site-nav-space stand-in.
 *
 *   import { initNav } from '../../shared/nav.js';
 *   initNav();
 */

import { initAuth, onAuthChange } from './auth.js';
import { navHtml, navSkeletonHtml } from './nav/markup.js';
import { paintNavAuth, paintNavFounding, paintNavAdmin } from './nav/session.js';
import { bindNavDrawer } from './nav/drawer.js';
import { bindNavScrollLogo, ensureNavSpace, syncNavSpace } from './nav/scroll-logo.js';
import { notePageView } from './page-traffic.js';
import { initSiteAccess } from './access-gate.js';

export { navSkeletonHtml };

const NAV_DESKTOP_REFERENCE_WIDTH = 2560;
const NAV_DESKTOP_REFERENCE_HEIGHT = 1440;

/**
 * Keep the desktop shelf composition at the 2560x1440 reference density.
 * The shell is scaled in CSS; this value is shared with the spacer sync so
 * fixed navigation and in-flow content keep the same visual boundary.
 * @param {Element} host
 */
function syncNavDesktopScale(host) {
  if (!(host instanceof HTMLElement)) return;

  const isDesktop = window.innerWidth > 1100;
  const scale = isDesktop
    ? Math.min(
        1,
        window.innerWidth / NAV_DESKTOP_REFERENCE_WIDTH,
        window.innerHeight / NAV_DESKTOP_REFERENCE_HEIGHT,
      )
    : 1;

  host.style.setProperty('--bpb-nav-desktop-scale', String(scale));
}

function rootPrefix() {
  const raw = document.body?.dataset?.root ?? './';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/**
 * @param {ParentNode} root
 * @returns {Promise<void>}
 */
function waitForImages(root) {
  const imgs = [...root.querySelectorAll('img')];
  if (!imgs.length) return Promise.resolve();
  return Promise.all(
    imgs.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
            }),
    ),
  ).then(() => undefined);
}

/**
 * @param {string | Element} [selector='#site-nav']
 * @param {{ onAccessGranted?: () => void }} [opts]
 */
export async function initNav(selector = '#site-nav', opts = {}) {
  const host = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!host) return;

  const root = rootPrefix();
  initAuth();
  const allowed = await initSiteAccess();
  if (!allowed) return false;

  // Let page-specific critical work start as soon as access is confirmed.
  // The callback is intentionally fire-and-forget: nav image/auth/founding
  // decoration remains on its own path and cannot delay the page's content.
  if (typeof opts.onAccessGranted === 'function') {
    try {
      opts.onAccessGranted();
    } catch (error) {
      console.error('[nav] access-granted bootstrap failed', error);
    }
  }

  // Reserve layout space immediately (nav is fixed / out of flow)
  syncNavDesktopScale(host);
  ensureNavSpace(host);
  syncNavSpace(host);

  // The landing page owns its own progressive sections and intentionally
  // starts with a clean scene; interior pages keep the shared nav placeholder.
  const showSkeleton = !document.body?.classList.contains('page-home');
  if (showSkeleton && !host.querySelector('.site-nav--skel')) {
    host.innerHTML = navSkeletonHtml();
  }

  const hold = document.createElement('div');
  hold.hidden = true;
  hold.innerHTML = navHtml(root);
  const shell = hold.firstElementChild;
  if (!shell) return;

  host.appendChild(hold);
  await waitForImages(hold);

  host.replaceChildren(shell);

  syncNavDesktopScale(host);
  syncNavSpace(host);
  bindNavScrollLogo(host);
  bindNavDrawer(host);

  const authHosts = [...host.querySelectorAll('[data-nav-auth]')].filter(
    (el) => el instanceof HTMLElement,
  );
  const foundingHosts = [...host.querySelectorAll('[data-nav-founding-host]')].filter(
    (el) => el instanceof HTMLElement,
  );
  const adminHosts = [...host.querySelectorAll('[data-nav-admin-host]')].filter(
    (el) => el instanceof HTMLElement,
  );
  if (authHosts.length) {
    const refreshAuth = () =>
      Promise.all([
        ...authHosts.map((el) => paintNavAuth(el, root)),
        ...adminHosts.map((el) => paintNavAdmin(el, root)),
      ]);
    await refreshAuth();
    onAuthChange(() => {
      refreshAuth();
      foundingHosts.forEach((el) => {
        paintNavFounding(el, root).catch((err) => console.error(err));
      });
    });
    syncNavSpace(host);
  }
  await Promise.all(foundingHosts.map((el) => paintNavFounding(el, root)));

  notePageView();
  window.addEventListener(
    'resize',
    () => {
      syncNavDesktopScale(host);
      syncNavSpace(host);
    },
    { passive: true },
  );
  return true;
}
