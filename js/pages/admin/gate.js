/** Owner-only admin gate. Emergency credentials are server-only operations. */

/**
 * @param {HTMLElement} host
 * @param {{ error?: string }} [opts]
 */
export function mountGate(host, opts = {}) {
  const message = opts.error
    ? `<p class="admin-gate__error" role="alert">${escapeHtml(opts.error)}</p>`
    : '';
  host.innerHTML = `
    <div class="admin-gate">
      <h1 class="admin-gate__title">Admin</h1>
      <p class="cr-hint">Sign in with the Discord account marked as the site owner.</p>
      ${message}
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
