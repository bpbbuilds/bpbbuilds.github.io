/**
 * Admin Blob cast tab — preview the browser source and copy its link.
 */

import { blobOverlayHref, OVERLAY_VIEWS, normalizeOverlayView } from '../overlay/blobs.js';
import { blobLoopSeconds, downloadBlobCastVideo } from '../overlay/blob-video.js';

/** @type {import('../overlay/blobs.js').OverlayViewId} */
let activeView = 'row';

/**
 * @param {string} s
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {HTMLElement} host
 * @param {{ root: string }} opts
 */
export function mountOverlayPanel(host, opts) {
  const root = opts.root;
  const view = normalizeOverlayView(activeView);
  activeView = view;

  const tabs = OVERLAY_VIEWS.map((item) => {
    const on = item.id === view;
    return `
      <div class="admin-overlay__view-row">
        <button
          type="button"
          class="admin-overlay__view${on ? ' is-active' : ''}"
          role="tab"
          data-overlay-view="${item.id}"
          aria-selected="${on ? 'true' : 'false'}"
          ${on ? 'aria-current="true"' : ''}
        >${escapeHtml(item.label)}</button>
        <button
          type="button"
          class="admin-overlay__download"
          data-overlay-download="${item.id}"
          aria-label="Download ${escapeHtml(item.label)} transparent WebM loop"
          title="Download ${escapeHtml(item.label)} transparent WebM loop (${blobLoopSeconds(item.id)}s)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 19h14" /></svg>
        </button>
      </div>`;
  }).join('');

  const hint = OVERLAY_VIEWS.find((item) => item.id === view)?.hint || '';

  host.innerHTML = `
    <div class="admin-overlay">
      <div class="admin-overlay__main">
        <div class="admin-overlay__stage">
          <iframe
            class="admin-overlay__frame"
            data-overlay-frame
            title="Blob cast preview"
          ></iframe>
        </div>
        <div class="admin-overlay__linkrow">
          <input class="cr-input" data-overlay-url readonly aria-label="Browser source link" />
          <button type="button" class="cr-btn-quiet" data-overlay-copy>Copy link</button>
        </div>
        <p class="cr-hint">Paste this into an OBS browser source set to 2560×1440. The page background stays transparent.</p>
      </div>
      <aside class="admin-overlay__views" aria-label="Overlay views">
        <p class="cr-label" id="admin-overlay-views-label">Views</p>
        <div class="admin-overlay__tabs" role="tablist" aria-labelledby="admin-overlay-views-label">
          ${tabs}
        </div>
        <p class="cr-hint" data-overlay-hint>${escapeHtml(hint)}</p>
        <p class="cr-hint admin-overlay__download-status" data-overlay-download-status aria-live="polite"></p>
      </aside>
    </div>
  `;

  const frame = host.querySelector('[data-overlay-frame]');
  const urlInput = host.querySelector('[data-overlay-url]');
  const hintEl = host.querySelector('[data-overlay-hint]');
  const downloadStatus = host.querySelector('[data-overlay-download-status]');
  const copyBtn = host.querySelector('[data-overlay-copy]');

  /**
   * @param {string} next
   */
  const applyView = (next) => {
    activeView = normalizeOverlayView(next);
    const source = blobOverlayHref(root, activeView);
    if (urlInput instanceof HTMLInputElement) urlInput.value = source;
    if (frame instanceof HTMLIFrameElement) {
      frame.src = blobOverlayHref(root, activeView, { preview: true });
    }
    const meta = OVERLAY_VIEWS.find((item) => item.id === activeView);
    if (hintEl) hintEl.textContent = meta?.hint || '';
    host.querySelectorAll('[data-overlay-view]').forEach((btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      const on = btn.getAttribute('data-overlay-view') === activeView;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    });
  };

  applyView(view);

  host.querySelector('[data-overlay-views], .admin-overlay__tabs')?.addEventListener('click', (e) => {
    const btn = e.target instanceof Element ? e.target.closest('[data-overlay-view]') : null;
    if (!(btn instanceof HTMLButtonElement)) return;
    const next = btn.getAttribute('data-overlay-view') || 'row';
    if (next === activeView) return;
    applyView(next);
  });

  host.querySelector('[data-overlay-views], .admin-overlay__tabs')?.addEventListener('click', (e) => {
    const btn = e.target instanceof Element ? e.target.closest('[data-overlay-download]') : null;
    if (!(btn instanceof HTMLButtonElement)) return;
    const next = normalizeOverlayView(btn.getAttribute('data-overlay-download'));
    btn.disabled = true;
    btn.classList.add('is-busy');
    if (downloadStatus) downloadStatus.textContent = `Rendering ${next} loop…`;
    void downloadBlobCastVideo({
      root,
      view: next,
      onProgress: (progress) => {
        if (downloadStatus) downloadStatus.textContent = `Rendering ${next} loop (${Math.round(progress * 100)}%)…`;
      },
    })
      .then(() => {
        if (downloadStatus) downloadStatus.textContent = `${next} transparent WebM downloaded.`;
      })
      .catch((error) => {
        if (downloadStatus) downloadStatus.textContent = error instanceof Error ? error.message : 'Video export failed.';
      })
      .finally(() => {
        btn.disabled = false;
        btn.classList.remove('is-busy');
      });
  });

  copyBtn?.addEventListener('click', async () => {
    const value = urlInput instanceof HTMLInputElement ? urlInput.value : '';
    if (!value || !(copyBtn instanceof HTMLButtonElement)) return;
    try {
      await navigator.clipboard.writeText(value);
      copyBtn.textContent = 'Copied';
    } catch {
      urlInput instanceof HTMLInputElement && urlInput.select();
      copyBtn.textContent = 'Select the link';
    }
    window.setTimeout(() => {
      if (copyBtn.isConnected) copyBtn.textContent = 'Copy link';
    }, 1400);
  });
}
