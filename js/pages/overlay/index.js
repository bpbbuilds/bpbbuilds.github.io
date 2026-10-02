/**
 * /overlay/blobs/ — transparent browser source. No nav or footer.
 */

import { mountBlobOverlay, normalizeOverlayView } from './blobs.js';

const host = document.getElementById('blob-overlay');
if (host instanceof HTMLElement) {
  const params = new URLSearchParams(location.search);
  void mountBlobOverlay(host, {
    root: '../../',
    view: normalizeOverlayView(params.get('view')),
    preview: params.get('preview') === '1',
  });
}
