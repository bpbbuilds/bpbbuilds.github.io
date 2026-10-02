/**
 * Player cosmetic submit — thin wrapper around shared upload modal.
 */

import { openCosmeticUploadModal } from '../../../shared/cosmetic-upload-modal.js';

/**
 * @param {{ displayName?: string, root?: string }} [opts]
 */
export function openSubmitCosmeticModal(opts = {}) {
  const root =
    opts.root ||
    (typeof document !== 'undefined'
      ? document.body?.getAttribute?.('data-root') || '../'
      : '../');
  openCosmeticUploadModal({
    role: 'player',
    displayName: opts.displayName,
    root,
    onSubmit: (payload) => {
      console.info('[cosmetic-submit]', {
        ...payload,
        file: payload.file.name,
        bytes: payload.file.size,
      });
    },
  });
}
