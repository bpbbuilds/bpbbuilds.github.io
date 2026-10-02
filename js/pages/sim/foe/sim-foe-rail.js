/**
 * Foe opponent rail popover — Dummy / Public build / Mirror.
 * Public opens the scoped build browser (page wires onRequestPublicBuild).
 */

/**
 * @typedef {'dummy' | 'build' | 'mirror'} SimFoeMode
 */

/**
 * @param {string} s
 */
function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/**
 * @param {SimFoeMode} mode
 * @param {string} root
 */
function foePopInnerHtml(mode, root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const mk = (id, label, file) => `
    <button
      type="button"
      class="sim-side-rail__choice sim-side-rail__choice--foe${mode === id ? ' is-active' : ''}"
      data-foe-mode="${id}"
      role="radio"
      aria-checked="${mode === id ? 'true' : 'false'}"
      title="${label}"
      aria-label="${label}"
    >
      <img
        class="sim-side-rail__choice-img sim-side-rail__choice-img--art"
        src="${escapeAttr(base)}assets/icons/history/${file}"
        alt=""
        width="40"
        height="40"
        draggable="false"
      />
    </button>
  `;

  return `
    <div class="sim-side-rail__choices sim-side-rail__choices--foe" role="radiogroup" aria-label="Opponent mode">
      ${mk('dummy', 'Dummy', 'DummyMode.png')}
      ${mk('build', 'Public build', 'PublicBuildMode.png')}
      ${mk('mirror', 'Mirror', 'MirrorMode.png')}
    </div>
  `;
}

/**
 * @param {HTMLElement} bagColumn `.sim-field__bag--opp`
 * @param {{
 *   mode: SimFoeMode,
 *   oppSlug?: string | null,
 *   oppRound?: number | null,
 *   onApply: (next: { mode: SimFoeMode, oppSlug: string | null, oppRound: number | null }) => Promise<boolean | void> | boolean | void,
 *   onRequestPublicBuild: () => void,
 * }} opts
 */
export function mountFoeOpponentRail(bagColumn, opts) {
  const rail = bagColumn.matches?.('[data-sim-side-rail="foe"]')
    ? bagColumn
    : bagColumn.querySelector('[data-sim-side-rail="foe"]');
  if (!(rail instanceof HTMLElement)) {
    return { update() {}, destroy() {} };
  }

  const oppBtn = rail.querySelector('[data-sim-foe-rail="opponent"]');
  const pop = rail.querySelector('[data-sim-foe-mode-pop]');
  if (!(oppBtn instanceof HTMLButtonElement) || !(pop instanceof HTMLElement)) {
    return { update() {}, destroy() {} };
  }

  const assetRoot = rail.getAttribute('data-sim-asset-root') || '../';

  /** @type {SimFoeMode} */
  let mode =
    opts.mode === 'build' || opts.mode === 'mirror' ? opts.mode : 'dummy';
  let oppSlug = String(opts.oppSlug || '').trim();
  let oppRound =
    opts.oppRound != null && Number.isFinite(Number(opts.oppRound))
      ? String(Math.round(Number(opts.oppRound)))
      : '';
  let open = false;
  let applying = false;

  const paintPop = () => {
    pop.innerHTML = foePopInnerHtml(mode, assetRoot);
  };

  const setOpen = (next) => {
    open = next;
    pop.hidden = !open;
    oppBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    rail.classList.toggle('is-pop-open', open);
    if (open) paintPop();
  };

  /**
   * @param {{ mode: SimFoeMode, oppSlug: string | null, oppRound: number | null }} next
   */
  async function emitApply(next) {
    if (applying) return;
    applying = true;
    const prevMode = mode;
    const prevSlug = oppSlug;
    const prevRound = oppRound;
    try {
      const ok = await opts.onApply(next);
      if (ok === false) {
        mode = prevMode;
        oppSlug = prevSlug;
        oppRound = prevRound;
        if (open) paintPop();
        return;
      }
      mode = next.mode;
      oppSlug = next.oppSlug || '';
      oppRound =
        next.oppRound != null && Number.isFinite(Number(next.oppRound))
          ? String(Math.round(Number(next.oppRound)))
          : '';
      setOpen(false);
    } catch (err) {
      console.error('[sim] foe rail apply failed', err);
      mode = prevMode;
      oppSlug = prevSlug;
      oppRound = prevRound;
      if (open) paintPop();
    } finally {
      applying = false;
    }
  }

  const onOppClick = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    setOpen(!open);
  };

  const onPopClick = (ev) => {
    const btn =
      ev.target instanceof Element
        ? ev.target.closest('[data-foe-mode]')
        : null;
    if (!(btn instanceof HTMLButtonElement)) return;
    const next = btn.getAttribute('data-foe-mode');
    if (next === 'dummy' || next === 'mirror') {
      void emitApply({ mode: next, oppSlug: null, oppRound: null });
      return;
    }
    if (next === 'build') {
      setOpen(false);
      opts.onRequestPublicBuild();
    }
  };

  const onDocPointer = (ev) => {
    if (!open) return;
    const t = ev.target;
    if (!(t instanceof Node)) return;
    if (rail.contains(t)) return;
    setOpen(false);
  };

  const onKey = (ev) => {
    if (!open) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      setOpen(false);
      oppBtn.focus();
    }
  };

  oppBtn.addEventListener('click', onOppClick);
  pop.addEventListener('click', onPopClick);
  document.addEventListener('pointerdown', onDocPointer, true);
  document.addEventListener('keydown', onKey);

  return {
    /**
     * @param {{
     *   mode?: SimFoeMode,
     *   oppSlug?: string | null,
     *   oppRound?: number | null,
     * }} next
     */
    update(next) {
      if (
        next.mode === 'dummy' ||
        next.mode === 'build' ||
        next.mode === 'mirror'
      ) {
        mode = next.mode;
      }
      if ('oppSlug' in next) oppSlug = String(next.oppSlug || '').trim();
      if ('oppRound' in next) {
        const n = next.oppRound;
        oppRound =
          n != null && Number.isFinite(Number(n))
            ? String(Math.round(Number(n)))
            : '';
      }
      if (open) paintPop();
    },
    destroy() {
      setOpen(false);
      oppBtn.removeEventListener('click', onOppClick);
      pop.removeEventListener('click', onPopClick);
      document.removeEventListener('pointerdown', onDocPointer, true);
      document.removeEventListener('keydown', onKey);
    },
  };
}
