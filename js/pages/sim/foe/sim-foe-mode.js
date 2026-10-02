/**
 * /sim/ foe mode: Dummy | Public build | Mirror
 */

/**
 * @typedef {'dummy' | 'build' | 'mirror'} SimFoeMode
 */

/**
 * @param {{ foe?: string | null, oppSlug?: string | null }} query
 * @returns {SimFoeMode}
 */
export function foeModeFromQuery(query) {
  const raw = String(query?.foe || '')
    .trim()
    .toLowerCase();
  if (raw === 'mirror' || raw === 'dummy' || raw === 'build') return raw;
  if (query?.oppSlug) return 'build';
  return 'dummy';
}

/**
 * Synthetic opponent board = clone of you-board (mirror mode).
 * @param {object} youBoard
 */
export function buildMirrorOppBoard(youBoard) {
  const clonePl = (list) =>
    (list || []).map((p) => ({
      ...p,
      gems: p.gems ? [...p.gems] : undefined,
    }));
  return {
    source: 'mirror',
    title: 'Mirror',
    authorName: youBoard.authorName || null,
    heroClass: youBoard.heroClass || null,
    slug: null,
    round: youBoard.round ?? null,
    placements: clonePl(youBoard.placements),
    publishedPlacements: clonePl(
      youBoard.publishedPlacements || youBoard.placements,
    ),
    itemsById: youBoard.itemsById,
    getSpriteUrl: youBoard.getSpriteUrl,
    playerMaxHp: youBoard.playerMaxHp ?? null,
    playerMaxStamina: youBoard.playerMaxStamina ?? null,
    historyFrames: youBoard.historyFrames || null,
  };
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   mode: SimFoeMode,
 *   oppSlug?: string | null,
 *   oppRound?: number | null,
 *   onApply: (next: { mode: SimFoeMode, oppSlug: string | null, oppRound: number | null }) => void,
 * }} opts
 */
export function mountSimFoeMode(host, opts) {
  let mode = opts.mode;
  let oppSlug = opts.oppSlug || '';
  let oppRound =
    opts.oppRound != null && Number.isFinite(Number(opts.oppRound))
      ? String(opts.oppRound)
      : '';

  /**
   * @param {{ mode: SimFoeMode, oppSlug: string | null, oppRound: number | null }} next
   */
  async function emitApply(next) {
    const prevMode = mode;
    const prevSlug = oppSlug;
    const prevRound = oppRound;

    // Dummy/Mirror: paint active tab before heavy apply so the click feels instant.
    if (next.mode === 'dummy' || next.mode === 'mirror') {
      mode = next.mode;
      oppSlug = '';
      oppRound = '';
      paint();
    }

    try {
      const ok = await opts.onApply(next);
      if (ok === false) {
        mode = prevMode;
        oppSlug = prevSlug;
        oppRound = prevRound;
        paint();
        return;
      }
      mode = next.mode;
      oppSlug = next.oppSlug || '';
      oppRound =
        next.oppRound != null && Number.isFinite(Number(next.oppRound))
          ? String(next.oppRound)
          : '';
      paint();
    } catch (err) {
      console.error('[sim] foe mode apply failed', err);
      mode = prevMode;
      oppSlug = prevSlug;
      oppRound = prevRound;
      paint();
    }
  }

  const paint = () => {
    const buildOpen = mode === 'build';
    host.innerHTML = `
      <div class="sim-foe" data-sim-foe>
        <span class="sim-foe__label" id="sim-foe-label">Opponent</span>
        <div class="sim-foe__modes" role="radiogroup" aria-labelledby="sim-foe-label">
          ${modeBtn('dummy', 'Dummy')}
          ${modeBtn('build', 'Public build')}
          ${modeBtn('mirror', 'Mirror')}
        </div>
        <div class="sim-foe__build"${buildOpen ? '' : ' hidden'}>
          <label class="sim-foe__field">
            <span class="sim-foe__field-label">Slug</span>
            <input
              type="text"
              class="sim-foe__input"
              data-foe-slug
              value="${escapeAttr(oppSlug)}"
              placeholder="build-slug"
              autocomplete="off"
              spellcheck="false"
            />
          </label>
          <label class="sim-foe__field sim-foe__field--round">
            <span class="sim-foe__field-label">Round</span>
            <input
              type="number"
              class="sim-foe__input sim-foe__input--round"
              data-foe-round
              value="${escapeAttr(oppRound)}"
              min="1"
              step="1"
              placeholder="—"
            />
          </label>
          <button type="button" class="sim-foe__apply" data-foe-apply>Apply</button>
        </div>
      </div>
    `;

    for (const btn of host.querySelectorAll('[data-foe-mode]')) {
      btn.addEventListener('click', () => {
        const next = /** @type {SimFoeMode} */ (btn.getAttribute('data-foe-mode'));
        if (next === 'dummy' || next === 'mirror') {
          void emitApply({ mode: next, oppSlug: null, oppRound: null });
          return;
        }
        mode = 'build';
        paint();
        host.querySelector('[data-foe-slug]')?.focus?.();
      });
    }

    host.querySelector('[data-foe-apply]')?.addEventListener('click', () => {
      const slugEl = host.querySelector('[data-foe-slug]');
      const roundEl = host.querySelector('[data-foe-round]');
      const slug =
        slugEl instanceof HTMLInputElement ? slugEl.value.trim() : '';
      if (!slug) {
        window.alert('Enter a published build slug for Public build.');
        return;
      }
      const roundRaw =
        roundEl instanceof HTMLInputElement ? roundEl.value.trim() : '';
      const roundN = roundRaw === '' ? null : Number(roundRaw);
      void emitApply({
        mode: 'build',
        oppSlug: slug,
        oppRound:
          roundN != null && Number.isFinite(roundN) && roundN >= 1
            ? Math.round(roundN)
            : null,
      });
    });
  };

  /**
   * @param {SimFoeMode} id
   * @param {string} label
   */
  function modeBtn(id, label) {
    const on = mode === id;
    return `<button
      type="button"
      class="sim-foe__mode${on ? ' is-active' : ''}"
      role="radio"
      aria-checked="${on ? 'true' : 'false'}"
      data-foe-mode="${id}"
    >${label}</button>`;
  }

  paint();

  return {
    destroy() {
      host.innerHTML = '';
    },
  };
}

/**
 * @param {string} s
 */
function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}
