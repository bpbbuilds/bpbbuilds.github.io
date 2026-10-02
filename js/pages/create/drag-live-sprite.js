/**
 * Living idle art on the create drag cursor (one held item, not cargo).
 */

import {
  liveInnerHtml,
  mountLiveArt,
  unmountLiveArt,
  feedLiveDrag,
} from '../../shared/item-live-art/index.js';

function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {HTMLElement} host
 * @param {object | null | undefined} item
 * @param {string} stillSrc
 */
export function fillCursorSprite(host, item, stillSrc) {
  if (!(host instanceof HTMLElement)) return;
  const id = String(item?.id || '');
  if (id && host.getAttribute('data-live-cursor') === id && host.querySelector('.bpb-live, .create-board__cursor-still')) {
    return;
  }
  unmountLiveArt(host);
  host.setAttribute('data-live-cursor', id);
  const live = item
    ? liveInnerHtml(item, {
        src: stillSrc,
        defer: false,
        sizeStyle: 'width:100%;height:100%;left:0;top:0;translate:none;',
      })
    : null;
  if (live) {
    host.innerHTML = live;
    mountLiveArt(host);
    return;
  }
  const src = stillSrc || '';
  host.innerHTML = src
    ? `<img class="create-board__cursor-still" alt="" draggable="false" src="${escapeAttr(src)}" />`
    : '';
}

/** @param {HTMLElement | null | undefined} host */
export function clearCursorSprite(host) {
  if (!(host instanceof HTMLElement)) return;
  unmountLiveArt(host);
  host.removeAttribute('data-live-cursor');
  host.innerHTML = '';
}

/**
 * @param {HTMLElement | null | undefined} host
 * @param {number} dx
 * @param {number} dy
 * @param {{ tiltDeg?: number }} [opts]
 */
export function sloshCursorPotion(host, dx, dy, opts = {}) {
  if (!(host instanceof HTMLElement)) return;
  feedLiveDrag(host, dx, dy, opts);
}
