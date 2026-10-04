/**
 * Scoped public-build browser for /sim/ — overlay over mid + opp columns.
 * Cards follow the builds feed: board in the middle, author + score above,
 * title + class below.
 */

import { getProfile } from '../../../shared/auth.js';
import { getSupabase } from '../../../shared/supabase.js';
import { syncEventBuildVisibility } from '../../events/event-gallery-sync.js';
import { classIconPath } from '../../../shared/class-icons.js';
import { faceHtml, hydrateFaces } from '../../../shared/blob-face.js';
import { skelBar, skelBlock, skelRegion } from '../../../shared/skeleton.js';
import { itemSpriteUrl, itemsFromBuilds, usersFromBuilds } from '../../../shared/build-search.js';
import { mountBuildSearchInput } from '../../../shared/build-search-input.js';
import { mountFeedBoardThumbs } from '../../builds/board-thumbs.js';
import { filterBuilds, sortBuilds } from '../../builds/feed.js';
import {
  bindFeedFilters,
  defaultFeedFilterState,
  feedFiltersHtml,
  syncFeedFiltersUi,
} from '../../builds/feed-filters.js';

const ITEM_SELECT =
  'id, gid, name, rarity, type, class, extra_types, tags, cost, effect, image, shape, sockets, accuracy, cooldown, stamina_cost, damage_min, damage_max, block, chance, chance_tag, params';

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
 * @param {string} s
 */
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

/**
 * @param {object[]} rows
 * @param {import('../../builds/feed-filters.js').FeedFilterState} feed
 * @param {string | null} myAuthorId
 */
function filterBrowserBuilds(rows, feed, myAuthorId) {
  return filterBuilds(rows, feed, myAuthorId);
}

/**
 * @param {string} path
 */
async function fetchJson(path) {
  try {
    const res = await fetch(path, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * @param {string} root
 */
async function fetchPublicBuilds(root) {
  await syncEventBuildVisibility();
  const supabase = getSupabase();
  const placementSelect = `
      placements:build_placements (
        id, x, y, r, gems,
        item:items ( ${ITEM_SELECT} )
      )`;
  const withProfile = `
      slug, title, hero_class, vote_score, author_id, author_name, created_at,
      is_op, is_featured, build_tag, rank, gold_count, event_slug,
      profile:profiles!builds_author_id_fkey (
        discord_id, display_name, avatar_url, equipped_avatar
      ),
      ${placementSelect}`;
  const bare = `
      slug, title, hero_class, vote_score, author_id, author_name, created_at,
      is_op, is_featured, build_tag, rank, gold_count, event_slug,
      ${placementSelect}`;

  let { data, error } = await supabase
    .from('builds')
    .select(withProfile)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) {
    const retry = await supabase
      .from('builds')
      .select(bare)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(80);
    if (retry.error) throw retry.error;
    data = retry.data;
  }

  return (data ?? []).map((row) => {
    const raw = row?.profile;
    const profile =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? raw
        : Array.isArray(raw)
          ? raw[0]
          : null;
    const liveName = String(profile?.display_name || '').trim();
    return {
      ...row,
      author_name: liveName || row.author_name || 'Unknown',
      author_avatar_url: String(profile?.avatar_url || '').trim() || null,
      author_equipped_avatar:
        profile?.equipped_avatar != null ? String(profile.equipped_avatar) : null,
    };
  });
}

/**
 * The signed-in author's event entries that are still held from the public
 * gallery. RLS limits this query to the current author; the event_held filter
 * keeps private non-event builds out of the simulator picker.
 *
 * @param {string} authorId
 */
async function fetchMyHeldBuilds(authorId) {
  const supabase = getSupabase();
  const placementSelect = `
      placements:build_placements (
        id, x, y, r, gems,
        item:items ( ${ITEM_SELECT} )
      )`;
  const { data, error } = await supabase
    .from('builds')
    .select(`
      slug, title, hero_class, vote_score, author_id, author_name, created_at,
      is_op, is_featured, build_tag, rank, gold_count, event_slug, event_held,
      profile:profiles!builds_author_id_fkey (
        discord_id, display_name, avatar_url, equipped_avatar
      ),
      ${placementSelect}`)
    .eq('author_id', authorId)
    .eq('event_held', true)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data || []).map((row) => {
    const raw = row?.profile;
    const profile =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? raw
        : Array.isArray(raw)
          ? raw[0]
          : null;
    return {
      ...row,
      author_name: String(profile?.display_name || '').trim() || row.author_name || 'You',
      author_avatar_url: String(profile?.avatar_url || '').trim() || null,
      author_equipped_avatar:
        profile?.equipped_avatar != null ? String(profile.equipped_avatar) : null,
    };
  });
}

/**
 * @param {string} name
 */
function authorInitials(name) {
  const parts = String(name || '')
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (name || '?').slice(0, 2).toUpperCase();
}

/**
 * @param {string} root
 * @param {object} b
 */
function cardHtml(root, b) {
  const slug = String(b.slug || '').trim();
  const title = String(b.title || slug || 'Untitled').trim();
  const hero = String(b.hero_class || '').trim();
  const author = String(b.author_name || 'Unknown').trim();
  const score = Number(b.vote_score) || 0;
  const classSrc = classIconPath(root, hero) || '';
  const voteUp = `${root}assets/icons/history/VoteUp.png`;
  const avatarInner =
    faceHtml(
      {
        avatar_url: b.author_avatar_url,
        equipped_avatar: b.author_equipped_avatar,
      },
      root,
      {
        className: 'sim-bb__card-avatar',
        size: 28,
        alt: author,
        emptyHtml: `<span class="sim-bb__card-avatar sim-bb__card-avatar--initials" aria-hidden="true">${escapeHtml(authorInitials(author))}</span>`,
      },
    ) ||
    `<span class="sim-bb__card-avatar sim-bb__card-avatar--initials" aria-hidden="true">${escapeHtml(authorInitials(author))}</span>`;
  const classInner = classSrc
    ? `<img class="sim-bb__card-class" src="${escapeAttr(classSrc)}" alt="${escapeAttr(hero)}" title="${escapeAttr(hero)}" width="36" height="36" draggable="false" />`
    : `<span class="sim-bb__card-class sim-bb__card-class--empty" aria-hidden="true"></span>`;
  const privateLabel = b.event_held === true
    ? '<span class="sim-bb__private">Only visible to you</span>'
    : '';

  return `
    <button
      type="button"
      class="sim-bb__card"
      data-sim-bb-slug="${escapeAttr(slug)}"
    >
      <span class="sim-bb__card-head">
        <span class="sim-bb__byline">
          ${avatarInner}
          <span class="sim-bb__card-author">${escapeHtml(author)}</span>
        </span>
        <span class="sim-bb__score" aria-label="Score ${score}">
          <img class="sim-bb__score-icon" src="${escapeAttr(voteUp)}" alt="" width="22" height="22" draggable="false" />
          <span class="sim-bb__score-n">${escapeHtml(String(score))}</span>
        </span>
      </span>
      <span
        class="sim-bb__board"
        data-feed-board="${escapeAttr(slug)}"
        aria-hidden="true"
      ></span>
      <span class="sim-bb__card-foot">
        <span class="sim-bb__card-title-wrap">
          <span class="sim-bb__card-title">${escapeHtml(title)}</span>
          ${privateLabel}
        </span>
        ${classInner}
      </span>
    </button>
  `;
}

/**
 * @param {HTMLElement} fieldEl `.sim-field`
 * @param {{
 *   root: string,
 *   onSelect: (slug: string) => void | Promise<void>,
 *   onClose?: () => void,
 * }} opts
 */
export function openSimBuildBrowser(fieldEl, opts) {
  const root = opts.root.endsWith('/') ? opts.root : `${opts.root}/`;
  const existing = fieldEl.querySelector('[data-sim-build-browser]');
  existing?.remove();

  /** @type {import('../../builds/feed-filters.js').FeedFilterState} */
  let feed = defaultFeedFilterState();
  /** @type {object[]} */
  let all = [];
  /** @type {object | null} */
  let spriteDisplay = null;
  /** @type {object | null} */
  let shapes = null;
  /** @type {object | null} */
  let sockets = null;
  /** @type {string | null} */
  let myAuthorId = null;
  /** @type {(() => void) | null} */
  let unmountBoards = null;
  /** @type {(() => void) | null} */
  let unbindFilters = null;
  /** @type {ReturnType<typeof mountBuildSearchInput> | null} */
  let searchInput = null;
  let closed = false;

  const overlay = document.createElement('div');
  overlay.className = 'sim-build-browser';
  overlay.setAttribute('data-sim-build-browser', '');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Choose a build');
  overlay.innerHTML = `
    <button type="button" class="sim-bb__backdrop" data-sim-bb-close aria-label="Dismiss"></button>
    <div class="sim-bb__panel">
      <header class="sim-bb__head">
        <h2 class="sim-bb__title">Choose a build</h2>
        <button type="button" class="sim-bb__close" data-sim-bb-close aria-label="Close">Close</button>
      </header>
      <div class="sim-bb__body">
        <div class="sim-bb__grid" data-sim-bb-grid>
          ${skelRegion(
            Array.from({ length: 6 }, () =>
              `<div class="sim-bb__skel-card">${skelBar({ width: '55%' })}${skelBlock()}${skelBar({ width: '70%' })}</div>`,
            ).join(''),
            { label: 'Loading builds' },
          )}
        </div>
        ${feedFiltersHtml(root, feed, 0, { canMine: false })}
      </div>
    </div>
  `;

  fieldEl.appendChild(overlay);

  const grid = overlay.querySelector('[data-sim-bb-grid]');
  const rail = overlay.querySelector('.builds-feed-filters');

  const clearBoards = () => {
    try {
      unmountBoards?.();
    } catch {
      /* ignore */
    }
    unmountBoards = null;
  };

  const paint = () => {
    if (!(grid instanceof HTMLElement)) return;
    clearBoards();
    const rows = sortBuilds(filterBrowserBuilds(all, feed, myAuthorId), feed.sort);
    if (rail instanceof HTMLElement) syncFeedFiltersUi(rail, feed, rows.length);
    grid.classList.toggle('sim-bb__grid--compact', feed.view === 'compact');
    if (!rows.length) {
      grid.innerHTML = `<p class="sim-bb__empty" role="status">No builds match these filters.</p>`;
      return;
    }
    grid.innerHTML = rows.map((b) => cardHtml(root, b)).join('');
    void hydrateFaces(grid, root);
    const maxCell = feed.view === 'compact' ? 20 : 28;
    grid.querySelectorAll('[data-feed-board]').forEach((host) => {
      if (!(host instanceof HTMLElement)) return;
      const card = host.closest('.sim-bb__card');
      const avail = card instanceof HTMLElement ? card.clientWidth : 0;
      if (avail > 0) {
        const cell = Math.max(14, Math.min(maxCell, Math.floor(avail / 9)));
        host.style.setProperty('--builds-feed-cell', `${cell}px`);
        if (card instanceof HTMLElement) {
          card.style.setProperty('--builds-feed-cell', `${cell}px`);
        }
      }
    });
    unmountBoards = mountFeedBoardThumbs(grid, {
      builds: rows,
      root,
      view: feed.view,
      spriteDisplay,
      shapes,
      sockets,
      tipSelector: '.sim-bb__card',
    });
  };

  const close = () => {
    if (closed) return;
    closed = true;
    clearBoards();
    searchInput?.destroy();
    searchInput = null;
    unbindFilters?.();
    unbindFilters = null;
    document.removeEventListener('keydown', onKey, true);
    overlay.removeEventListener('click', onOverlayClick);
    overlay.remove();
    opts.onClose?.();
  };

  const onKey = (ev) => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      close();
    }
  };

  const onOverlayClick = (ev) => {
    const t = ev.target;
    if (!(t instanceof Element)) return;
    if (t.closest('[data-sim-bb-close]')) {
      close();
      return;
    }
    const card = t.closest('[data-sim-bb-slug]');
    if (card instanceof HTMLElement) {
      const slug = card.getAttribute('data-sim-bb-slug');
      if (!slug) return;
      void Promise.resolve(opts.onSelect(slug)).finally(() => close());
      return;
    }
    if (t === overlay) close();
  };

  if (rail instanceof HTMLElement) {
    unbindFilters = bindFeedFilters(rail, {
      getState: () => feed,
      defaultState: defaultFeedFilterState,
      onResetSearch() {
        searchInput?.clear();
      },
      onChange(next) {
        feed = next;
        paint();
      },
    });
    searchInput = mountBuildSearchInput(rail, {
      items: [],
      users: [],
      root,
      getSpriteUrl: (item) => itemSpriteUrl(root, item),
      onChange(q) {
        if (q === feed.q) return;
        feed = { ...feed, q };
        paint();
      },
    });
  }

  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('click', onOverlayClick);
  rail?.querySelector('[data-build-search]')?.focus?.();

  void (async () => {
    try {
      const [builds, sprite, shapeData, socketData, profile] = await Promise.all([
        fetchPublicBuilds(root),
        fetchJson(`${root}assets/data/sprite-display.json`),
        fetchJson(`${root}assets/data/item-shapes.json`),
        fetchJson(`${root}assets/data/socket-offsets.json`),
        getProfile().catch(() => null),
      ]);
      if (closed) return;
      all = builds;
      if (profile?.id) {
        const held = await fetchMyHeldBuilds(profile.id).catch(() => []);
        if (closed) return;
        const seen = new Set(all.map((b) => String(b.slug || '')));
        for (const row of held) {
          if (!seen.has(String(row.slug || ''))) all.push(row);
        }
      }
      spriteDisplay = sprite;
      shapes = shapeData;
      sockets = socketData;
      myAuthorId = profile?.id || null;
      searchInput?.setItems(itemsFromBuilds(all));
      searchInput?.setUsers(usersFromBuilds(all));
      const mineBtn = rail?.querySelector('[data-feed-mine]');
      if (mineBtn instanceof HTMLElement && myAuthorId) {
        mineBtn.removeAttribute('disabled');
        mineBtn.setAttribute('aria-disabled', 'false');
        mineBtn.classList.remove('is-disabled');
        mineBtn.title = 'Show only your builds';
      }
      paint();
    } catch (err) {
      console.error('[sim] build browser fetch failed', err);
      if (closed || !(grid instanceof HTMLElement)) return;
      clearBoards();
      grid.innerHTML = `<p class="sim-bb__empty" role="alert">Could not load public builds.</p>`;
    }
  })();

  return { close };
}
