/**
 * Create catalog column count follows the bag.
 * Desktop: columns from the bag width, cells stretch to fill.
 * Narrow windows: a short strip packed down each column, then to the right.
 */

import { setCatalogCols, setCatalogFillWidth, setCatalogStripRows } from '../items/catalog.js';

const COL_MIN = 5;
const COL_MAX = 10;
/** Stay near the library cell size instead of the 22px floor. */
const CELL_TARGET = 48;
/** Fixed cell when the strip does not stretch to the bag width. */
const STRIP_CELL = 34;
const NARROW_MQ = '(max-width: 1100px)';

/**
 * @param {Element} host Catalog root (`[data-create-catalog]`)
 * @returns {() => void}
 */
export function watchCatalogColumns(host) {
  const column = host.closest('.create-col--catalog');
  const bag = host.querySelector('.items-bag');
  const watched = column instanceof HTMLElement ? column : host;
  const mq = window.matchMedia(NARROW_MQ);

  const apply = () => {
    const narrow = mq.matches;
    if (!narrow) {
      setCatalogFillWidth(true);
      const width = bag instanceof HTMLElement ? bag.clientWidth : 0;
      if (width < 80) return;
      const cols = Math.max(COL_MIN, Math.min(COL_MAX, Math.floor(width / CELL_TARGET)));
      setCatalogCols(cols);
      return;
    }

    if (!(bag instanceof HTMLElement)) return;
    const height = bag.clientHeight;
    if (height < 48) return;
    setCatalogFillWidth(false);
    const targetRows = Math.max(2, Math.floor((height - 36) / STRIP_CELL));
    setCatalogStripRows(targetRows);
  };

  apply();
  const ro = new ResizeObserver(() => {
    apply();
  });
  ro.observe(watched);
  if (bag instanceof HTMLElement && bag !== watched) ro.observe(bag);
  mq.addEventListener('change', apply);
  return () => {
    ro.disconnect();
    mq.removeEventListener('change', apply);
  };
}
