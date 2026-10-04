/**
 * Transparent blob cast for a video browser source.
 * Players appear once their equipped look is the website blob.
 */

import { faceHtml, hydrateFaces, parseFaceLoadout } from '../../shared/blob-face.js';
import { getSupabase } from '../../shared/supabase.js';

/** @typedef {'row' | 'low' | 'pop' | 'walk' | 'walk-names' | 'grid' | 'float'} OverlayViewId */

/** @type {readonly { id: OverlayViewId, label: string, hint: string }[]} */
export const OVERLAY_VIEWS = Object.freeze([
  {
    id: 'row',
    label: 'Row',
    hint: 'One line of blobs with names. Fits a lower third.',
  },
  {
    id: 'low',
    label: 'Low',
    hint: 'Same line, no names. Each blob sits on the bottom edge of the screen.',
  },
  {
    id: 'pop',
    label: 'Pop',
    hint: 'Same bottom line, no names. Blobs glide down out of frame, then glide back up.',
  },
  {
    id: 'walk',
    label: 'Walk',
    hint: 'No names. Blobs pace along the bottom, turning as they go left and right.',
  },
  {
    id: 'walk-names',
    label: 'Walk Names',
    hint: 'Blobs pace along the bottom with names displayed below each one.',
  },
  {
    id: 'grid',
    label: 'Grid',
    hint: 'Wrapped tiles when the cast is large.',
  },
  {
    id: 'float',
    label: 'Float',
    hint: 'Scattered blobs that drift. Names stay off so gameplay stays readable.',
  },
]);

/**
 * @param {string | null | undefined} raw
 * @returns {OverlayViewId}
 */
export function normalizeOverlayView(raw) {
  const id = String(raw || '')
    .trim()
    .toLowerCase();
  if (OVERLAY_VIEWS.some((view) => view.id === id)) return /** @type {OverlayViewId} */ (id);
  return 'row';
}

/**
 * Absolute URL for OBS. `preview` adds the empty-state note used in admin.
 * @param {string} root
 * @param {string} view
 * @param {{ preview?: boolean }} [opts]
 */
export function blobOverlayHref(root, view, opts = {}) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const url = new URL(`${base}overlay/blobs/`, location.href);
  url.searchParams.set('view', normalizeOverlayView(view));
  if (opts.preview) url.searchParams.set('preview', '1');
  else url.searchParams.delete('preview');
  return url.href;
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
 * Stagger so neighbors are not on the same beat.
 * @param {number} i
 */
function popStyle(i) {
  const delay = (-((i % 6) * 1.15)).toFixed(2);
  return `animation-delay:${delay}s`;
}

/**
 * Spread walkers along one pace so they are not stacked at the start.
 * @param {number} i
 * @param {number} n
 */
function walkStyle(i, n) {
  const duration = 22;
  const delay = n <= 1 ? 0 : -((i / n) * duration);
  const x = n <= 1 ? 2 : 2 + (i / Math.max(1, n - 1)) * 70;
  return `animation-duration:${duration}s;animation-delay:${delay.toFixed(2)}s;--blob-cast-walk-x:${x.toFixed(1)}vw`;
}

/**
 * @param {number} i
 * @param {number} n
 */
function floatStyle(i, n) {
  const cols = Math.max(1, Math.min(n, Math.ceil(Math.sqrt(n * 1.7))));
  const rows = Math.ceil(n / cols);
  const col = i % cols;
  const row = Math.floor(i / cols);
  const left = ((col + 0.5) / cols) * 86 + 4 + ((i * 17) % 5) - 2;
  const top = ((row + 0.5) / rows) * 70 + 8 + ((i * 13) % 5) - 2;
  // Start each floater at a stable phase so a recording can begin on any frame
  // without every blob waiting through the same first beat.
  const delay = (-((i % 8) * 0.35)).toFixed(2);
  return `left:${left.toFixed(2)}%;top:${top.toFixed(2)}%;animation-delay:${delay}s`;
}

/**
 * @returns {Promise<{ name: string, equipped: string }[]>}
 */
export async function loadBlobCast() {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('display_name, equipped_avatar')
    .not('equipped_avatar', 'is', null)
    .limit(120);
  if (error || !Array.isArray(data)) return [];
  /** @type {{ name: string, equipped: string }[]} */
  const rows = [];
  for (const row of data) {
    const equipped = String(row.equipped_avatar || '').trim();
    const loadout = parseFaceLoadout(equipped);
    if (!loadout || loadout.base !== 'blob') continue;
    const name = String(row.display_name || '').trim() || 'Blob';
    rows.push({ name, equipped });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

/**
 * @param {HTMLElement} host
 * @param {{ root: string, view: string, preview?: boolean }} opts
 */
export async function mountBlobOverlay(host, opts) {
  const view = normalizeOverlayView(opts.view);
  const preview = Boolean(opts.preview);
  const root = opts.root.endsWith('/') ? opts.root : `${opts.root}/`;
  host.className = `blob-cast blob-cast--${view}`;
  host.replaceChildren();

  let rows = [];
  try {
    rows = await loadBlobCast();
  } catch {
    rows = [];
  }

  if (!rows.length) {
    host.innerHTML = preview
      ? `<p class="blob-cast__empty">No blob looks yet. Players show up here once they equip a blob.</p>`
      : '';
    return;
  }

  host.style.setProperty('--blob-cast-n', String(rows.length));
  if (view === 'grid') {
    const cols = Math.max(1, Math.min(rows.length, Math.ceil(Math.sqrt(rows.length * 1.7))));
    host.style.setProperty('--blob-cast-cols', String(cols));
  }
  host.innerHTML = rows
    .map((row, i) => {
      const face = faceHtml(
        { equipped_avatar: row.equipped },
        root,
        { className: 'blob-cast__face', alt: row.name },
      );
      const style =
        view === 'float'
          ? ` style="${floatStyle(i, rows.length)}"`
          : view === 'pop'
            ? ` style="${popStyle(i)}"`
            : view === 'walk' || view === 'walk-names'
              ? ` style="${walkStyle(i, rows.length)}"`
              : '';
      const name =
        view === 'float' || view === 'low' || view === 'pop' || view === 'walk'
          ? ''
          : `<figcaption class="blob-cast__name">${escapeHtml(row.name)}</figcaption>`;
      return `<figure class="blob-cast__person"${style}>${face}${name}</figure>`;
    })
    .join('');
  await hydrateFaces(host, root);
}
