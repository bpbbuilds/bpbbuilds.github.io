/**
 * Share build — copy page URL (clipboard), with Web Share when available.
 */

/**
 * @param {HTMLButtonElement | null} btn
 * @param {{
 *   url?: () => string,
 *   title?: () => string,
 *   idleLabel?: string,
 *   doneLabel?: string,
 * }} [opts]
 * @returns {() => void}
 */
export function bindShareBuild(btn, opts = {}) {
  if (!(btn instanceof HTMLButtonElement)) return () => {};

  const idleLabel = opts.idleLabel || 'Share';
  const doneLabel = opts.doneLabel || 'Copied!';
  /** @type {ReturnType<typeof setTimeout> | 0} */
  let resetTimer = 0;

  function shareUrl() {
    return opts.url?.() || location.href;
  }

  function shareTitle() {
    return opts.title?.() || document.title;
  }

  function setLabel(text) {
    const label = btn.querySelector('[data-share-label]');
    if (label) label.textContent = text;
    else btn.textContent = text;
  }

  function flashDone() {
    setLabel(doneLabel);
    btn.classList.add('is-copied');
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      setLabel(idleLabel);
      btn.classList.remove('is-copied');
      resetTimer = 0;
    }, 1600);
  }

  /**
   * @param {string} text
   */
  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    if (!ok) throw new Error('copy failed');
  }

  async function onClick() {
    const url = shareUrl();
    const title = shareTitle();

    // Touch / mobile: prefer OS share sheet when present
    const canNativeShare =
      typeof navigator.share === 'function' &&
      (navigator.canShare ? navigator.canShare({ title, url }) : true) &&
      (matchMedia('(pointer: coarse)').matches || matchMedia('(hover: none)').matches);

    if (canNativeShare) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
          return;
        }
        // Fall through to clipboard
      }
    }

    try {
      await copyText(url);
      flashDone();
    } catch {
      setLabel('Copy failed');
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        setLabel(idleLabel);
        resetTimer = 0;
      }, 1600);
    }
  }

  btn.addEventListener('click', onClick);

  return () => {
    btn.removeEventListener('click', onClick);
    if (resetTimer) clearTimeout(resetTimer);
  };
}
