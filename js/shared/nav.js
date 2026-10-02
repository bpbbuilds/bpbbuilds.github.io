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
import './game-cursor.js';

export { navSkeletonHtml };

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
 */
export async function initNav(selector = '#site-nav') {
  const host = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!host) return;

  const root = rootPrefix();
  initAuth();
  const allowed = await initSiteAccess();
  if (!allowed) return false;

  // Reserve layout space immediately (nav is fixed / out of flow)
  ensureNavSpace(host);
  syncNavSpace(host);

  if (!host.querySelector('.site-nav--skel')) {
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
      syncNavSpace(host);
    },
    { passive: true },
  );
  return true;
}
