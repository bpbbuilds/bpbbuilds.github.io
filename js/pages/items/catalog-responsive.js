/**
 * Responsive column sizing for the standalone Items catalog.
 *
 * Desktop keeps the game Itemiary's 20-column layout. Narrower layouts use
 * fewer columns so the packed cells stay large enough to read and interact
 * with, while still adapting to phones, tablets, and split-width windows.
 */

import { setCatalogCols, setCatalogFillWidth } from './catalog.js';

const DESKTOP_MQ = '(min-width: 1101px)';
const CELL_TARGET_PX = 52;
const SCROLL_LANE_PX = 30;
const MIN_COLS = 6;
const MAX_COLS = 20;

/**
 * @param {Element | string} hostOrSelector
 * @returns {() => void}
 */
export function watchItemsCatalogColumns(hostOrSelector = '#items-catalog') {
  const host =
    typeof hostOrSelector === 'string'
      ? document.querySelector(hostOrSelector)
      : hostOrSelector;
  if (!(host instanceof HTMLElement)) return () => {};

  const desktopMq = window.matchMedia(DESKTOP_MQ);
  let raf = 0;

  const apply = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const bag = host.querySelector('.items-bag');
      if (!(bag instanceof HTMLElement)) return;

      if (desktopMq.matches) {
        setCatalogFillWidth(true);
        setCatalogCols(MAX_COLS);
        return;
      }

      const width = bag.clientWidth;
      if (width < 1) return;

      // Leave room for the catalog scrollbar and target roughly 52px cells.
      const available = Math.max(1, width - SCROLL_LANE_PX);
      const cols = Math.max(
        MIN_COLS,
        Math.min(MAX_COLS, Math.floor(available / CELL_TARGET_PX)),
      );
      setCatalogFillWidth(true);
      setCatalogCols(cols);
    });
  };

  apply();

  const ro = new ResizeObserver(apply);
  ro.observe(host);
  const bag = host.querySelector('.items-bag');
  if (bag instanceof HTMLElement) ro.observe(bag);
  desktopMq.addEventListener('change', apply);

  return () => {
    ro.disconnect();
    desktopMq.removeEventListener('change', apply);
    if (raf) cancelAnimationFrame(raf);
  };
}
