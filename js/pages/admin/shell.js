/**
 * Shared admin hub — gate once, then swap stage tabs like /u/ profile.
 */

import { initAuth } from '../../shared/auth.js';
import { initNav } from '../../shared/nav.js';
import { mountGate } from './gate.js';
import { listBuilds, AdminAuthError, resolveAdminAuth } from './api.js';
import { adminSideNavHtml } from './side-nav.js';
import { escapeHtml } from './row.js';
import { mountMetrics } from './metrics.js';
import { defaultReportListFilters } from './report-filters.js';
import { mountReportsPanel } from './reports.js';
import { mountPendingQueue } from './queue.js';
import { mountBuildsPanel } from './builds.js';
import { mountEventsPanel } from './tab-events.js';
import { mountCosmeticsPanel } from './tab-cosmetics.js';
import { mountMarketplacePanel } from './tab-marketplace.js';
import { mountOverlayPanel } from './tab-overlay.js';
import { mountAnalyticsPanel } from './tab-analytics.js';
import { mountMembersPanel } from './tab-members.js';
import {
  ADMIN_TAB_META,
  normalizeTab,
  tabFromLocation,
  urlForTab,
} from './tabs.js';

/** @typedef {{ mode: 'jwt', token: string }} AdminAuth */
/** @typedef {import('./tabs.js').AdminTabId} AdminTabId */

function rootPrefix() {
  const raw = document.body?.dataset?.root ?? '../';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/** @type {{ spriteDisplay: object | null, shapes: object | null, sockets: object | null } | null} */
let assetsCache = null;

let reportFilters = defaultReportListFilters();
let expandedId = '';
/** @type {'all' | 'featured' | 'hidden'} */
let buildsFilter = 'all';

/**
 * @param {string} path
 */
async function fetchJson(path) {
  try {
    const res = await fetch(path, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * @param {string} root
 */
async function loadAssets(root) {
  if (assetsCache) return assetsCache;
  const [spriteDisplay, shapes, sockets] = await Promise.all([
    fetchJson(`${root}assets/data/sprite-display.json`),
    fetchJson(`${root}assets/data/item-shapes.json`),
    fetchJson(`${root}assets/data/socket-offsets.json`),
  ]);
  assetsCache = { spriteDisplay, shapes, sockets };
  return assetsCache;
}

/**
 * @returns {Promise<AdminAuth | null>}
 */
export async function resolveAuth() {
  return resolveAdminAuth();
}

/**
 * Normalize legacy /admin/reports/ and /admin/builds/ onto /admin/?tab=
 */
function normalizeLegacyPath(root) {
  const path = location.pathname.replace(/\/+$/, '');
  if (!/\/admin\/(reports|builds)$/i.test(path)) return false;
  const tab = /reports$/i.test(path) ? 'reports' : 'builds';
  history.replaceState({ adminTab: tab }, '', urlForTab(tab, root));
  return true;
}

/**
 * Boot the admin hub (single page).
 */
export async function bootAdminHub() {
  initAuth();
  if (!(await initNav())) return;
  const main = document.getElementById('main');
  if (!(main instanceof HTMLElement)) return;
  const root = rootPrefix();
  normalizeLegacyPath(root);
  void paintHub(main, root);
}

/**
 * @param {HTMLElement} main
 * @param {string} root
 * @param {{ gateError?: string }} [state]
 */
async function paintHub(main, root, state = {}) {
  let auth = await resolveAuth();

  if (!auth) {
    mountGate(main, { error: state.gateError });
    return;
  }

  if (auth.mode === 'jwt') {
    try {
      await listBuilds(auth, 'all');
    } catch (err) {
      if (err instanceof AdminAuthError) {
        auth = null;
      } else {
        main.innerHTML = `<p class="admin-gate__error" role="alert">${escapeHtml(err?.message || 'Could not load admin')}</p>`;
        return;
      }
    }
  }

  if (!auth) {
    mountGate(main, { error: state.gateError || 'Sign in with the owner Discord account.' });
    return;
  }

  const modeLabel = 'Discord owner';
  let active = tabFromLocation();

  /** @type {{
   *   auth: AdminAuth,
   *   root: string,
   *   assets: { spriteDisplay: object | null, shapes: object | null, sockets: object | null },
   *   onUnauthorized: () => void,
   *   reload: () => void,
   *   goTab: (tab: AdminTabId) => void,
   * }} */
  const ctx = {
    auth,
    root,
    assets: assetsCache || {
      spriteDisplay: null,
      shapes: null,
      sockets: null,
    },
    onUnauthorized: () => {
      void paintHub(main, root, {
        gateError: 'Session expired — unlock again.',
      });
    },
    reload: () => {
      void remountStage();
    },
    goTab: (tab) => {
      void setTab(tab, true);
    },
  };

  main.innerHTML = `
    <div class="admin-hub">
      <div class="admin-side">
        <header class="admin-persona">
          <div class="admin-persona__inner">
            <div class="admin-persona__text">
              <h1 class="admin-persona__name bpb-label-text">Admin</h1>
              <p class="admin-persona__meta">${escapeHtml(modeLabel)}</p>
            </div>
            <button type="button" class="cr-btn-quiet admin-persona__lock" data-admin-lock>Lock</button>
          </div>
        </header>
        ${adminSideNavHtml(active)}
      </div>
      <div class="admin-body">
        <header class="admin-head">
          <div class="admin-head__text">
            <h2 class="admin-head__title" data-admin-title></h2>
            <p class="admin-head__blurb" data-admin-blurb></p>
          </div>
        </header>
        <div class="admin-stage" data-admin-stage aria-live="polite"></div>
      </div>
    </div>
  `;

  main.querySelector('[data-admin-lock]')?.addEventListener('click', () => {
    void paintHub(main, root);
  });

  /**
   * @param {HTMLElement} railEl
   */
  const bindRail = (railEl) => {
    railEl.addEventListener('click', (e) => {
      const btn =
        e.target instanceof Element ? e.target.closest('[data-admin-tab]') : null;
      if (!(btn instanceof HTMLButtonElement)) return;
      const next = normalizeTab(btn.getAttribute('data-admin-tab'));
      if (next === active) return;
      void setTab(next, true);
    });
  };

  const paintRail = () => {
    const current = main.querySelector('.admin-rail');
    if (!(current instanceof HTMLElement)) return;
    current.outerHTML = adminSideNavHtml(active);
    const next = main.querySelector('.admin-rail');
    if (next instanceof HTMLElement) bindRail(next);
  };

  const paintHead = () => {
    const meta = ADMIN_TAB_META[active];
    const titleEl = main.querySelector('[data-admin-title]');
    const blurbEl = main.querySelector('[data-admin-blurb]');
    if (titleEl) titleEl.textContent = meta.title;
    if (blurbEl) blurbEl.textContent = meta.blurb;
    document.title = `${meta.title} — Admin — Smojo Builds`;
  };

  // Every tab request gets its own stage node. Async panel loaders keep a
  // reference to the node they were given, so replacing it before starting
  // the next request prevents a slower, stale loader from painting over the
  // tab the user selected most recently.
  let stageRequest = 0;

  const remountStage = async () => {
    const requestId = ++stageRequest;
    const requestedTab = active;
    paintHead();
    const currentStage = main.querySelector('[data-admin-stage]');
    if (!(currentStage instanceof HTMLElement)) return;

    const requestStage = currentStage.cloneNode(false);
    currentStage.replaceWith(requestStage);

    // Panel callbacks can fire after their fetch completes. Scope the
    // callbacks to this request too, so a stale panel cannot trigger a reload,
    // tab change, or auth repaint after the user has moved on.
    const requestCtx = {
      ...ctx,
      onUnauthorized: () => {
        if (requestId !== stageRequest) return;
        ctx.onUnauthorized();
      },
      reload: () => {
        if (requestId !== stageRequest) return;
        void remountStage();
      },
      goTab: (tab) => {
        if (requestId !== stageRequest) return;
        void setTab(tab, true);
      },
    };

    await mountStage(requestStage, requestedTab, requestCtx);
  };

  /**
   * @param {AdminTabId} tab
   * @param {boolean} push
   */
  const setTab = async (tab, push) => {
    active = normalizeTab(tab);
    if (push) {
      history.pushState({ adminTab: active }, '', urlForTab(active, root));
    }
    paintRail();
    await remountStage();
  };

  const rail = main.querySelector('.admin-rail');
  if (rail instanceof HTMLElement) bindRail(rail);

  void remountStage();

  window.addEventListener('popstate', () => {
    const next = tabFromLocation();
    if (next === active) return;
    active = next;
    paintRail();
    void remountStage();
  });
}

/**
 * @param {HTMLElement} stage
 * @param {AdminTabId} tab
 * @param {{
 *   auth: AdminAuth,
 *   root: string,
 *   assets: { spriteDisplay: object | null, shapes: object | null, sockets: object | null },
 *   onUnauthorized: () => void,
 *   reload: () => void,
 *   goTab: (tab: AdminTabId) => void,
 * }} ctx
 */
async function mountStage(stage, tab, ctx) {
  if (tab === 'overview') {
    await mountMetrics(stage, {
      auth: ctx.auth,
      root: ctx.root,
      onUnauthorized: ctx.onUnauthorized,
      onTab: ctx.goTab,
    });
    return;
  }

  if (tab === 'analytics') {
    await mountAnalyticsPanel(stage, { auth: ctx.auth });
    return;
  }

  if (tab === 'members') {
    await mountMembersPanel(stage, { auth: ctx.auth });
    return;
  }

  if (tab === 'reports') {
    await mountReportsPanel(stage, {
      auth: ctx.auth,
      root: ctx.root,
      getFilters: () => reportFilters,
      setFilters: (next) => {
        reportFilters = next;
      },
      expandedId,
      onUnauthorized: ctx.onUnauthorized,
      onExpand: (id) => {
        expandedId = id;
      },
      onChanged: ctx.reload,
    });
    return;
  }

  if (tab === 'builds') {
    if (!assetsCache) await loadAssets(ctx.root);
    ctx.assets = assetsCache || ctx.assets;
    stage.innerHTML = `
      <div data-admin-pending></div>
      <div data-admin-builds></div>
    `;
    const pendingHost = stage.querySelector('[data-admin-pending]');
    const buildsHost = stage.querySelector('[data-admin-builds]');
    if (!(pendingHost instanceof HTMLElement) || !(buildsHost instanceof HTMLElement)) {
      return;
    }
    const thumbOpts = {
      spriteDisplay: ctx.assets.spriteDisplay,
      shapes: ctx.assets.shapes,
      sockets: ctx.assets.sockets,
    };
    await mountPendingQueue(pendingHost, {
      auth: ctx.auth,
      root: ctx.root,
      onUnauthorized: ctx.onUnauthorized,
      onChanged: ctx.reload,
      ...thumbOpts,
    });
    await mountBuildsPanel(buildsHost, {
      auth: ctx.auth,
      root: ctx.root,
      filter: buildsFilter,
      onUnauthorized: ctx.onUnauthorized,
      onFilterChange: (f) => {
        buildsFilter = f;
      },
      onChanged: ctx.reload,
      ...thumbOpts,
    });
    return;
  }

  if (tab === 'events') {
    mountEventsPanel(stage, {
      root: ctx.root,
      auth: ctx.auth,
      onUnauthorized: ctx.onUnauthorized,
    });
    return;
  }

  if (tab === 'cosmetics') {
    await mountCosmeticsPanel(stage, { root: ctx.root });
    return;
  }

  if (tab === 'overlay') {
    mountOverlayPanel(stage, { root: ctx.root });
    return;
  }

  if (tab === 'marketplace') {
    mountMarketplacePanel(stage);
  }
}

/**
 * @param {HTMLElement} main
 * @param {string} root
 * @param {string} secret
 */
