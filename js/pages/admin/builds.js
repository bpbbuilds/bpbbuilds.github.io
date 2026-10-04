/**
 * All / Featured / Hidden builds list + filter rail.
 */

import {
  buildMatchesSearch,
  itemSpriteUrl,
  itemsFromBuilds,
  parseBuildSearchQuery,
  usersFromBuilds,
} from '../../shared/build-search.js';
import { mountBuildSearchInput } from '../../shared/build-search-input.js';
import { listBuilds, mutateBuild, AdminAuthError } from './api.js';
import {
  adminBuildsFiltersHtml,
  bindAdminBuildsFilters,
  defaultAdminBuildsFilters,
  syncAdminBuildsFiltersUi,
} from './builds-filters.js';
import { actionsForBuild, buildCardHtml, escapeHtml } from './row.js';
import { mountAdminBoardThumbs } from './thumbs.js';

/** @typedef {import('./builds-filters.js').AdminBuildsFilterState} AdminBuildsFilterState */
/** @typedef {import('./builds-filters.js').AdminBuildsListFilter} BuildsFilter */

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
  /** @type {AdminBuildsFilterState} */
  let filters = {
    ...defaultAdminBuildsFilters(),
    list: opts.filter || 'all',
  };

  /** @type {object[]} */
  let all = [];
  /** @type {ReturnType<typeof mountBuildSearchInput> | null} */
  let searchInput = null;
  /** @type {(() => void) | null} */
  let unbindRail = null;
  /** @type {(() => void) | null} */
  let unmountThumbs = null;

  host.innerHTML = `
    <div class="admin-builds-layout">
      <div class="admin-builds-col">
        <section class="admin-panel admin-panel--builds" aria-labelledby="admin-builds-h">
          <div class="admin-panel__head">
            <h2 id="admin-builds-h" class="admin-panel__title">Builds</h2>
          </div>
          <p class="admin-panel__blurb">Feature for the homepage carousel. Hide soft-deletes a build; Restore brings it back. Search: @user · [Item] · free text.</p>
          <div class="admin-panel__body" data-admin-builds-body>
            <p class="admin-status" role="status">Loading…</p>
          </div>
        </section>
      </div>
      ${adminBuildsFiltersHtml(opts.root, filters, 0)}
    </div>
  `;

  const body = host.querySelector('[data-admin-builds-body]');
  const rail = host.querySelector('.admin-builds-filters');
  if (!(body instanceof HTMLElement) || !(rail instanceof HTMLElement)) {
    return () => {};
  }

  const destroy = () => {
    searchInput?.destroy();
    searchInput = null;
    unbindRail?.();
    unbindRail = null;
    try {
      unmountThumbs?.();
    } catch {
      /* ignore */
    }
    unmountThumbs = null;
  };

  unbindRail = bindAdminBuildsFilters(rail, {
    getState: () => filters,
    defaultState: defaultAdminBuildsFilters,
    onResetSearch() {
      searchInput?.clear();
    },
    onChange(next, meta) {
      const listChanged = Boolean(meta?.listChanged) || next.list !== filters.list;
      filters = next;
      opts.onFilterChange?.(filters.list);
      if (listChanged) void reloadList();
      else paintCards();
    },
  });

  searchInput = mountBuildSearchInput(rail, {
    items: [],
    users: [],
    root: opts.root,
    getSpriteUrl: (item) => itemSpriteUrl(opts.root, item),
    onChange(q) {
      if (q === filters.q) return;
      filters = { ...filters, q };
      paintCards();
    },
  });

  /**
   * @param {object[]} builds
   */
  function visibleBuilds(builds) {
    const parsed = parseBuildSearchQuery(filters.q || '');
    return builds.filter((b) => {
      if (filters.heroClass && String(b.hero_class || '') !== filters.heroClass) {
        return false;
      }
      return buildMatchesSearch(b, parsed);
    });
  }

  function paintCards() {
    try {
      unmountThumbs?.();
    } catch {
      /* ignore */
    }
    unmountThumbs = null;

    const builds = visibleBuilds(all);
    syncAdminBuildsFiltersUi(rail, filters, builds.length);
    searchInput?.setItems(itemsFromBuilds(all));
    searchInput?.setUsers(usersFromBuilds(all));

    if (!builds.length) {
      body.innerHTML = `<p class="admin-empty">No builds match these filters.</p>`;
      return;
    }
    body.innerHTML = `
      <div class="admin-cards" data-admin-list>
        ${builds
          .map((b) => buildCardHtml(b, opts.root, actionsForBuild(b, filters.list)))
          .join('')}
      </div>
    `;
    bindActions(body, opts);
    const list = body.querySelector('[data-admin-list]');
    if (list instanceof HTMLElement) {
      unmountThumbs = mountAdminBoardThumbs(list, {
        builds,
        root: opts.root,
        spriteDisplay: opts.spriteDisplay,
        shapes: opts.shapes,
        sockets: opts.sockets,
      });
    }
  }

  async function reloadList() {
    body.innerHTML = `<p class="admin-status" role="status">Loading…</p>`;
    try {
      const data = await listBuilds(opts.auth, filters.list);
      all = Array.isArray(data?.builds) ? data.builds : [];
      paintCards();
    } catch (err) {
      if (err instanceof AdminAuthError) {
        opts.onUnauthorized();
        return;
      }
      body.innerHTML = `<p class="admin-status admin-status--err" role="alert">${escapeHtml(err?.message || 'Failed to load')}</p>`;
    }
  }

  await reloadList();
  return destroy;
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
