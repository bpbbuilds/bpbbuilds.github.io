/**
 * Admin — /admin/ (owner curation; not in public nav)
 * Prefer Discord owner session; secret modal is break-glass.
 */

import { initAuth } from '../../shared/auth.js';
import { initNav } from '../../shared/nav.js';
import {
  clearAdminLock,
  clearSessionSecret,
  getSessionSecret,
  isAdminLocked,
  lockAdminSession,
  mountGate,
  saveSessionSecret,
} from './gate.js';
import { listBuilds, AdminAuthError, resolveAdminAuth } from './api.js';
import { mountPendingQueue } from './queue.js';
import { mountBuildsPanel } from './builds.js';

/** @typedef {'all' | 'featured' | 'hidden'} BuildsFilter */
/** @typedef {{ mode: 'jwt' | 'secret', token: string }} AdminAuth */

function rootPrefix() {
  const raw = document.body?.dataset?.root ?? '../';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/** @type {{ spriteDisplay: object | null, shapes: object | null, sockets: object | null } | null} */
let assetsCache = null;

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
 * @returns {Promise<AdminAuth | null>}
 */
async function resolveAuth() {
  if (!isAdminLocked()) {
    const jwtAuth = await resolveAdminAuth();
    if (jwtAuth) return jwtAuth;
  }
  const secret = getSessionSecret();
  if (secret) return { mode: 'secret', token: secret };
  return null;
}

async function boot() {
  initAuth();
  initNav();
  const main = document.getElementById('main');
  if (!(main instanceof HTMLElement)) return;
  const root = rootPrefix();
  await loadAssets(root);
  await paint(main, root);
}

/**
 * @param {HTMLElement} main
 * @param {string} root
 * @param {{ gateError?: string, buildsFilter?: BuildsFilter }} [state]
 */
async function paint(main, root, state = {}) {
  const buildsFilter = state.buildsFilter || 'all';
  const assets = assetsCache || {
    spriteDisplay: null,
    shapes: null,
    sockets: null,
  };

  let auth = await resolveAuth();

  if (!auth) {
    const ownerReady = Boolean(await resolveAdminAuth());
    mountGate(main, {
      error: state.gateError,
      ownerReady,
      onOwnerSession: () => {
        clearAdminLock();
        paint(main, root, { buildsFilter });
      },
      onUnlock: async (s) => {
        try {
          const next = { mode: /** @type {const} */ ('secret'), token: s };
          await listBuilds(next, 'all');
          clearAdminLock();
          saveSessionSecret(s);
          await paint(main, root, { buildsFilter });
        } catch (err) {
          if (err instanceof AdminAuthError) {
            clearSessionSecret();
            await paint(main, root, {
              gateError:
                'Wrong secret, or sign in with an owner Discord account.',
              buildsFilter,
            });
            return;
          }
          await paint(main, root, {
            gateError: err?.message || 'Could not unlock',
            buildsFilter,
          });
        }
      },
    });
    return;
  }

  // Validate JWT path once so we fall back to gate if profile is not owner
  if (auth.mode === 'jwt') {
    try {
      await listBuilds(auth, 'all');
      clearAdminLock();
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
    const ownerReady = Boolean(await resolveAdminAuth());
    mountGate(main, {
      error:
        state.gateError ||
        'Sign in with Discord (owner) or enter the break-glass secret.',
      ownerReady,
      onOwnerSession: () => {
        clearAdminLock();
        paint(main, root, { buildsFilter });
      },
      onUnlock: async (s) => {
        try {
          const next = { mode: /** @type {const} */ ('secret'), token: s };
          await listBuilds(next, 'all');
          clearAdminLock();
          saveSessionSecret(s);
          await paint(main, root, { buildsFilter });
        } catch (err) {
          clearSessionSecret();
          await paint(main, root, {
            gateError:
              err instanceof AdminAuthError
                ? 'Wrong secret (or function not deployed).'
                : err?.message || 'Could not unlock',
            buildsFilter,
          });
        }
      },
    });
    return;
  }

  const modeLabel = auth.mode === 'jwt' ? 'Discord owner' : 'Secret unlock';

  main.innerHTML = `
    <div class="admin">
      <header class="admin-head">
        <div class="admin-head__text">
          <h1 class="admin-head__title">Admin</h1>
          <p class="admin-head__blurb">Approve OP requests, feature homepage builds, hide mistakes. (${escapeHtml(modeLabel)})</p>
        </div>
        <button type="button" class="admin-btn" data-admin-lock>Lock</button>
      </header>
      <div data-admin-pending></div>
      <div data-admin-builds></div>
    </div>
  `;

  const onUnauthorized = () => {
    lockAdminSession();
    paint(main, root, {
      gateError: 'Session expired — unlock again.',
      buildsFilter,
    });
  };

  main.querySelector('[data-admin-lock]')?.addEventListener('click', () => {
    lockAdminSession();
    paint(main, root, { buildsFilter });
  });

  const pendingHost = main.querySelector('[data-admin-pending]');
  const buildsHost = main.querySelector('[data-admin-builds]');
  if (!(pendingHost instanceof HTMLElement) || !(buildsHost instanceof HTMLElement)) {
    return;
  }

  const reload = async (nextFilter = buildsFilter) => {
    await paint(main, root, { buildsFilter: nextFilter });
  };

  const thumbOpts = {
    spriteDisplay: assets.spriteDisplay,
    shapes: assets.shapes,
    sockets: assets.sockets,
  };

  await mountPendingQueue(pendingHost, {
    auth,
    root,
    onUnauthorized,
    onChanged: () => reload(buildsFilter),
    ...thumbOpts,
  });

  await mountBuildsPanel(buildsHost, {
    auth,
    root,
    filter: buildsFilter,
    onUnauthorized,
    onFilterChange: (f) => reload(f),
    onChanged: () => reload(buildsFilter),
    ...thumbOpts,
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

boot();
