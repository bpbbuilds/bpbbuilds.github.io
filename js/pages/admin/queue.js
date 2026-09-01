/**
 * Pending OP request queue.
 */

import { listBuilds, mutateBuild, AdminAuthError } from './api.js';
import { actionsForBuild, buildCardHtml, escapeHtml } from './row.js';
import { mountAdminBoardThumbs } from './thumbs.js';

/**
 * @param {HTMLElement} host
 * @param {{
 *   auth: { mode: 'jwt' | 'secret', token: string },
 *   root: string,
 *   onUnauthorized: () => void,
 *   onChanged?: () => void,
 *   spriteDisplay?: object | null,
 *   shapes?: object | null,
 *   sockets?: object | null,
 * }} opts
 * @returns {Promise<() => void>}
 */
export async function mountPendingQueue(host, opts) {
  host.innerHTML = `
    <section class="admin-panel admin-panel--pending" aria-labelledby="admin-pending-h">
      <h2 id="admin-pending-h" class="admin-panel__title">Pending OP</h2>
      <p class="admin-panel__blurb">Review the board, open the full guide if needed, then approve or deny.</p>
      <div class="admin-panel__body" data-admin-pending-body>
        <p class="admin-status" role="status">Loading…</p>
      </div>
    </section>
  `;

  const body = host.querySelector('[data-admin-pending-body]');
  if (!(body instanceof HTMLElement)) return () => {};

  try {
    const data = await listBuilds(opts.auth, 'pending_op');
    const builds = Array.isArray(data?.builds) ? data.builds : [];
    if (!builds.length) {
      body.innerHTML = `<p class="admin-empty">No pending OP requests.</p>`;
      return () => {};
    }
    body.innerHTML = `
      <div class="admin-cards" data-admin-list>
        ${builds
          .map((b) => buildCardHtml(b, opts.root, actionsForBuild(b, 'pending')))
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
