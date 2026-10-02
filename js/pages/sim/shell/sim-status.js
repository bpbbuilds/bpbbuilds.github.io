/**
 * Plain empty / error shells for /sim/ — no skeletons after failure.
 */

/**
 * @param {import('./board-load.js').SimBoardLoad | null | undefined} board
 * @returns {{ kind: 'empty' | 'error', message: string } | null}
 */
export function resolveSimBoardStatus(board) {
  if (!board) {
    return {
      kind: 'error',
      message: 'Could not load a board.',
    };
  }
  if (board.error && !board.placements?.length) {
    return { kind: 'error', message: String(board.error) };
  }
  if (!board.placements?.length) {
    const slug = board.slug ? String(board.slug) : '';
    if (slug) {
      if (board.round != null) {
        return {
          kind: 'empty',
          message: `Round ${board.round} of “${slug}” has no items on the board.`,
        };
      }
      return {
        kind: 'empty',
        message: `Build “${slug}” has no items on the board.`,
      };
    }
    return {
      kind: 'empty',
      message:
        'No board loaded. Place items in Create, or open a published build with Play.',
    };
  }
  return null;
}

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
 * @param {string} root
 * @param {{ kind: 'empty' | 'error', message: string }} status
 */
export function simStatusShellHtml(root, status) {
  const role = status.kind === 'error' ? 'alert' : 'status';
  const title =
    status.kind === 'error' ? 'Couldn’t run this sim' : 'No board to simulate';
  const base = root.endsWith('/') ? root : `${root}/`;
  return `
    <div class="sim-shell sim-shell--status">
      <p class="sim-fidelity" role="note">
        <span class="sim-fidelity__label">Predictive sandbox</span>
        <span class="sim-fidelity__hint">seeded RNG — not a ranked Combat Log replay</span>
      </p>
      <h1 class="sim-status__title">${escapeHtml(title)}</h1>
      <p class="sim-status sim-status--${status.kind}" role="${role}">${escapeHtml(status.message)}</p>
      <p class="sim-status sim-status__next">
        Open <a href="${escapeHtml(base)}create/">Create</a> and place items, then use
        <strong>Play in sim</strong>, or browse <a href="${escapeHtml(base)}builds/">Builds</a>
        and press Play on a guide.
      </p>
    </div>
  `;
}

/**
 * @param {HTMLElement} main
 * @param {string} root
 * @param {{ kind: 'empty' | 'error', message: string }} status
 */
export function paintSimStatus(main, root, status) {
  main.innerHTML = simStatusShellHtml(root, status);
  main.removeAttribute('aria-busy');
}
