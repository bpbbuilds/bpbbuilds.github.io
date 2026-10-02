/**
 * Create Filter|Build rail — right-hand panel on narrow windows only.
 */

import { bindFilterDrawer, filterDrawerChromeHtml } from '../../shared/filter-drawer.js';

const NARROW_MQ = '(max-width: 1100px)';

/**
 * @param {HTMLElement | null} filtersEl
 * @returns {() => void}
 */
export function mountCreateFilterDrawer(filtersEl) {
  const layout = filtersEl?.closest('.items-layout');
  if (!(filtersEl instanceof HTMLElement) || !(layout instanceof HTMLElement)) {
    return () => {};
  }

  layout.classList.add('bpb-filter-drawer');
  filtersEl.classList.add('bpb-filter-drawer__panel');
  if (!filtersEl.id) filtersEl.id = 'create-filters';

  if (!filtersEl.querySelector('[data-bpb-filter-close]')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bpb-filter-drawer__close';
    btn.setAttribute('data-bpb-filter-close', '');
    btn.setAttribute('aria-label', 'Close filters');
    btn.innerHTML = '<span class="bpb-filter-drawer__close-icon" aria-hidden="true"></span>';
    const bar = filtersEl.querySelector('.cr-tabs-bar');
    if (bar instanceof HTMLElement) bar.appendChild(btn);
    else filtersEl.prepend(btn);
  }

  if (!layout.querySelector('[data-bpb-filter-open]')) {
    layout.insertAdjacentHTML(
      'afterbegin',
      filterDrawerChromeHtml(filtersEl.id, 'Filters / Build'),
    );
  }

  return bindFilterDrawer(layout, NARROW_MQ);
}
