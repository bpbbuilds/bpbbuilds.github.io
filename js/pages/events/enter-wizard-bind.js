/**
 * Enter-wizard click / input bindings.
 */

/**
 * @param {{
 *   overlay: HTMLElement,
 *   fileInput: HTMLInputElement,
 *   historyDbDir: string,
 *   stepOrder: string[],
 *   getStep: () => string,
 *   setStep: (s: string) => void,
 *   setStatus: (s: string) => void,
 *   paint: () => void,
 *   destroy: (clear?: boolean) => void,
 *   goNext: () => Promise<void>,
 *   doSubmit: () => Promise<void>,
 *   selectRun: (id: number) => Promise<void>,
 *   setRoundIndex: (n: number) => void,
 *   applyRound: () => void,
 *   refreshSimDps: () => Promise<void>,
 *   setTitle: (s: string) => void,
 *   setNotes: (s: string) => void,
 *   setClaimedDps: (s: string) => void,
 *   setYoutubeUrl: (s: string) => void,
 *   persist: () => void,
 *   pickerOpen?: boolean,
 *   leaveHistory?: () => void,
 *   requestLoad?: () => boolean,
 * }} ctx
 */
export function bindEnterWizardUi(ctx) {
  const { overlay } = ctx;
  overlay.querySelector('[data-enter-close]')?.addEventListener('click', () => ctx.destroy(true));
  const entriesInfo = overlay.querySelector('[data-enter-entries-info]');
  const entriesInfoWrap = entriesInfo?.closest('.event-enter__info');
  if (entriesInfo instanceof HTMLButtonElement && entriesInfoWrap instanceof HTMLElement) {
    entriesInfo.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const open = entriesInfoWrap.classList.toggle('is-open');
      entriesInfo.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  overlay.querySelector('[data-enter-back]')?.addEventListener('click', () => {
    if (ctx.pickerOpen && ctx.leaveHistory) {
      ctx.leaveHistory();
      return;
    }
    const i = ctx.stepOrder.indexOf(ctx.getStep());
    if (i > 0) {
      ctx.setStep(ctx.stepOrder[i - 1]);
      ctx.setStatus('');
      ctx.paint();
    }
  });
  overlay.querySelector('[data-enter-discord]')?.addEventListener('click', () => void ctx.goNext());
  overlay.querySelector('[data-enter-next]')?.addEventListener('click', () => {
    if (ctx.pickerOpen && ctx.requestLoad) {
      if (!ctx.requestLoad()) {
        const status = overlay.querySelector('[data-preview-status]');
        if (status instanceof HTMLElement) {
          status.hidden = false;
          status.textContent = 'Select a run first.';
        }
      }
      return;
    }
    void ctx.goNext();
  });
  overlay.querySelector('[data-enter-submit]')?.addEventListener('click', () => void ctx.doSubmit());
  overlay.querySelector('[data-enter-pick-file]')?.addEventListener('click', () => ctx.fileInput.click());
  overlay.querySelector('[data-enter-copy-path]')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(ctx.historyDbDir);
      ctx.setStatus('Path copied.');
    } catch {
      ctx.setStatus('Could not copy path.');
    }
    ctx.paint();
  });
  overlay.querySelectorAll('[data-run-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      void ctx.selectRun(Number(btn.getAttribute('data-run-id')));
    });
  });
  overlay.querySelector('[data-enter-round]')?.addEventListener('change', (ev) => {
    ctx.setRoundIndex(Number(/** @type {HTMLSelectElement} */ (ev.target).value) || 0);
    ctx.applyRound();
    void ctx.refreshSimDps().then(ctx.paint);
  });
  overlay.querySelector('[data-enter-title]')?.addEventListener('input', (ev) => {
    ctx.setTitle(/** @type {HTMLInputElement} */ (ev.target).value);
    ctx.persist();
  });
  overlay.querySelector('[data-enter-claimed]')?.addEventListener('input', (ev) => {
    ctx.setClaimedDps(/** @type {HTMLInputElement} */ (ev.target).value);
    ctx.persist();
  });
  overlay.querySelector('[data-enter-yt]')?.addEventListener('input', (ev) => {
    ctx.setYoutubeUrl(/** @type {HTMLInputElement} */ (ev.target).value);
    ctx.persist();
  });
}
