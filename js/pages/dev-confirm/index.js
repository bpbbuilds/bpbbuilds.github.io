/**
 * Dev sandbox — tweak shared confirmDialog().
 */

import { confirmDialog } from '../../shared/confirm-dialog.js';

const titleEl = document.getElementById('dev-confirm-title');
const bodyEl = document.getElementById('dev-confirm-body');
const okEl = document.getElementById('dev-confirm-ok');
const cancelEl = document.getElementById('dev-confirm-cancel');
const dangerEl = document.getElementById('dev-confirm-danger');
const openBtn = document.getElementById('dev-confirm-open');
const logEl = document.getElementById('dev-confirm-log');

openBtn?.addEventListener('click', () => {
  void (async () => {
    const ok = await confirmDialog({
      title: titleEl instanceof HTMLInputElement ? titleEl.value : 'Confirm?',
      body: bodyEl instanceof HTMLTextAreaElement ? bodyEl.value : '',
      confirmLabel: okEl instanceof HTMLInputElement ? okEl.value : 'Confirm',
      cancelLabel: cancelEl instanceof HTMLInputElement ? cancelEl.value : 'Cancel',
      danger: dangerEl instanceof HTMLInputElement ? dangerEl.checked : false,
    });
    if (logEl) {
      logEl.textContent = ok ? 'Result: confirmed' : 'Result: cancelled';
    }
  })();
});
