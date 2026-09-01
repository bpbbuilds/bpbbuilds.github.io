/**
 * All / Featured / Hidden builds list.
 */

import { listBuilds, mutateBuild, AdminAuthError } from './api.js';
import { actionsForBuild, buildCardHtml, escapeHtml } from './row.js';
import { mountAdminBoardThumbs } from './thumbs.js';

/** @typedef {'all' | 'featured' | 'hidden'} BuildsFilter */

/**
 * @param {HTMLElement} host
 * @param {{
 *   auth: { mode: 'jwt' | 'secret', token: string },
 *   root: string,
 *   onUnauthorized: () => void,
 *   onChanged?: () => void,
 *   filter?: BuildsFilter,
 *   onFilterChange?: (f: BuildsFilter) => void,
 *   spriteDisplay?: object | null,
 *   shapes?: object | null,
 *   sockets?: object | null,
 * }} opts
 * @returns {Promise<() => void>}
 */
export async function mountBuildsPanel(host, opts) {
  const filter = opts.filter || 'all';

  host.innerHTML = `
    <section class="admin-panel" aria-labelledby="admin-builds-h">
      <div class="admin-panel__head">
        <h2 id="admin-builds-h" class="admin-panel__title">Builds</h2>
        <div class="admin-tabs" role="tablist" aria-label="Build lists">
          ${tabBtn('all', 'All', filter)}
          ${tabBtn('featured', 'Featured', filter)}
          ${tabBtn('hidden', 'Hidden', filter)}
        </div>
      </div>
      <p class="admin-panel__blurb">Feature for the homepage carousel. Hide soft-deletes a build; Restore brings it back.</p>
      <div class="admin-panel__body" data-admin-builds-body>
        <p class="admin-status" role="status">Loading…</p>
      </div>
    </section>
  `;

  host.querySelectorAll('[data-admin-filter]').forEach((el) => {
    el.addEventListener('click', () => {
      const f = el.getAttribute('data-admin-filter');
      if (f === 'all' || f === 'featured' || f === 'hidden') {
        opts.onFilterChange?.(f);
      }
    });
  });

  const body = host.querySelector('[data-admin-builds-body]');
  if (!(body instanceof HTMLElement)) return () => {};

  try {
    const data = await listBuilds(opts.auth, filter);
    const builds = Array.isArray(data?.builds) ? data.builds : [];
    if (!builds.length) {
      body.innerHTML = `<p class="admin-empty">No builds in this list.</p>`;
      return () => {};
    }
    body.innerHTML = `
      <div class="admin-cards" data-admin-list>
        ${builds
          .map((b) => buildCardHtml(b, opts.root, actionsForBuild(b, filter)))
          .join('')}
      </div>
    `;
    bindActions(body, opts);
    const list = body.querySelector('[data-admin-list]');
    if (!(list instanceof HTMLElement)) return () => {};
    return mountAdminBoardThumbs(list, {
      builds,
      root: opts.root,
      spriteDisplay: opts.spriteDisplay,
      shapes: opts.shapes,
      sockets: opts.sockets,
    });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      opts.onUnauthorized();
      return () => {};
    }
    body.innerHTML = `<p class="admin-status admin-status--err" role="alert">${escapeHtml(err?.message || 'Failed to load')}</p>`;
    return () => {};
  }
}

/** @param {BuildsFilter} id @param {string} label @param {BuildsFilter} active */
function tabBtn(id, label, active) {
  const on = id === active ? ' is-active' : '';
  return `<button type="button" class="admin-tab${on}" role="tab" aria-selected="${id === active}" data-admin-filter="${id}">${label}</button>`;
}

/**
 * @param {HTMLElement} rootEl
 * @param {{
 *   auth: { mode: 'jwt' | 'secret', token: string },
 *   onUnauthorized: () => void,
 *   onChanged?: () => void,
 * }} opts
 */
function bindActions(rootEl, opts) {
  rootEl.addEventListener('click', async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const btn = t.closest('[data-admin-action]');
    if (!(btn instanceof HTMLButtonElement)) return;
    const action = btn.getAttribute('data-admin-action') || '';
    const slug = btn.getAttribute('data-slug') || '';
    if (!action || !slug) return;
    btn.disabled = true;
    try {
      await mutateBuild(opts.auth, action, slug);
      opts.onChanged?.();
    } catch (err) {
      if (err instanceof AdminAuthError) {
        opts.onUnauthorized();
        return;
      }
      btn.disabled = false;
      window.alert(err?.message || 'Action failed');
    }
  });
}
