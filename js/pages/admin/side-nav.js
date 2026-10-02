/**
 * Admin portal side rail — profile-style tiles (no full page reload).
 */

import { escapeAttr, escapeHtml } from './row.js';
import { ADMIN_TABS, ADMIN_TAB_LABELS } from './tabs.js';

/** @typedef {import('./tabs.js').AdminTabId} AdminTabId */

/**
 * @param {AdminTabId} active
 */
export function adminSideNavHtml(active) {
  const tiles = ADMIN_TABS.map((id) => {
    const on = id === active;
    return `
      <li class="admin-rail__item">
        <button
          type="button"
          class="admin-rail__tile${on ? ' is-active' : ''}"
          data-admin-tab="${escapeAttr(id)}"
          ${on ? 'aria-current="page"' : ''}
        >${escapeHtml(ADMIN_TAB_LABELS[id])}</button>
      </li>`;
  }).join('');

  return `
    <nav class="admin-rail" aria-label="Admin sections">
      <ul class="admin-rail__list">${tiles}</ul>
    </nav>`;
}
