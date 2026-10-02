/**
 * Mount compact board thumbs into admin cards (reuses feed thumb renderer).
 */

import { mountFeedBoardThumbs } from '../builds/board-thumbs.js';

/**
 * @param {HTMLElement} listEl
 * @param {{
 *   builds: object[],
 *   root: string,
 *   spriteDisplay?: object | null,
 *   shapes?: object | null,
 *   sockets?: object | null,
 * }} opts
 * @returns {() => void}
 */
export function mountAdminBoardThumbs(listEl, opts) {
  return mountFeedBoardThumbs(listEl, {
    builds: opts.builds,
    root: opts.root,
    view: 'compact',
    spriteDisplay: opts.spriteDisplay,
    shapes: opts.shapes,
    sockets: opts.sockets,
    tipSelector: '.admin-card__board',
  });
}
