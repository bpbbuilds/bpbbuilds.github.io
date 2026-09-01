/**
 * Builds catalog feed — fetch, sort/filter, URL sync, render.
 */

import { getProfile, onAuthChange } from '../../shared/auth.js';
import { getSupabase } from '../../shared/supabase.js';
import { skelBar, skelBlock, skelRegion } from '../../shared/skeleton.js';
import { readMyVote } from '../build/vote.js';
import { HERO_CLASSES } from '../items/filter-logic.js';
import { mountFeedBoardThumbs } from './board-thumbs.js';
import {
  FEED_RANK_IDS,
  FEED_SORTS,
  FEED_TAGS,
  FEED_VIEWS,
  allFeedRanks,
  bindFeedFilters,
  defaultFeedFilterState,
  feedFiltersHtml,
  isAllFeedRanks,
  syncFeedFiltersUi,
} from './feed-filters.js';
import { bindFeedPostActions } from './post-actions.js';
import { postRowHtml } from './post-row.js';

/** @typedef {import('./feed-filters.js').FeedFilterState} FeedFilterState */
/** @typedef {import('./feed-filters.js').FeedSort} FeedSort */
/** @typedef {import('./feed-filters.js').FeedTag} FeedTag */
/** @typedef {import('./feed-filters.js').FeedView} FeedView */

const ITEM_SELECT =
  'id, gid, name, rarity, type, class, extra_types, tags, cost, effect, image, shape, sockets, accuracy, cooldown, stamina_cost, damage_min, damage_max, block, chance, chance_tag, params';

/**
 * @param {HTMLElement} main
 * @param {{ root: string }} opts
 */
export async function initBuildsFeed(main, opts) {
  const root = opts.root.endsWith('/') ? opts.root : `${opts.root}/`;
  let state = readFeedStateFromUrl();
  /** @type {object[]} */
  let all = [];
  /** @type {object | null} */
  let spriteDisplay = null;
  /** @type {object | null} */
  let shapes = null;
  /** @type {object | null} */
  let sockets = null;
  /** @type {(() => void) | null} */
  let unmountBoards = null;
  /** @type {(() => void) | null} */
  let unbindActions = null;
  /** @type {(() => void) | null} */
  let unbindFilters = null;
  /** @type {string | null} */
  let myAuthorId = null;

  paintSkeleton(main);

  try {
    const [builds, sprite, shapeData, socketData, profile] = await Promise.all([
      fetchPublicBuilds(),
      fetchJson(`${root}assets/data/sprite-display.json`),
      fetchJson(`${root}assets/data/item-shapes.json`),
      fetchJson(`${root}assets/data/socket-offsets.json`),
      getProfile().catch(() => null),
    ]);
    all = builds;
    spriteDisplay = sprite;
    shapes = shapeData;
    sockets = socketData;
    myAuthorId = profile?.id || null;
    if (!myAuthorId) state = { ...state, mine: false };
  } catch (err) {
    console.error(err);
    main.innerHTML = `<p class="build-status">Could not load builds.</p>`;
    return;
  }

  const rows0 = sortBuilds(filterBuilds(all, state, myAuthorId), state.sort);
  main.innerHTML = `
    <div class="builds-layout">
      <div class="builds-feed-col">
        <div class="builds-feed__list-host" data-feed-list></div>
      </div>
      ${feedFiltersHtml(root, state, rows0.length, { canMine: Boolean(myAuthorId) })}
    </div>`;

  const listHost = main.querySelector('[data-feed-list]');
  const rail = main.querySelector('.builds-feed-filters');
  if (!(listHost instanceof HTMLElement) || !(rail instanceof HTMLElement)) return;

  unbindFilters = bindFeedFilters(rail, {
    getState: () => state,
    defaultState: defaultFeedFilterState,
    onChange(next) {
      state = next;
      paintList();
    },
  });

  onAuthChange(async () => {
    const profile = await getProfile({ force: true }).catch(() => null);
    const nextId = profile?.id || null;
    const prevId = myAuthorId;
    myAuthorId = nextId;

    const mineBtn = rail.querySelector('[data-feed-mine]');
    if (mineBtn instanceof HTMLElement) {
      if (myAuthorId) {
        mineBtn.removeAttribute('disabled');
        mineBtn.setAttribute('aria-disabled', 'false');
        mineBtn.classList.remove('is-disabled');
        mineBtn.title = 'Show only your builds';
      } else {
        mineBtn.setAttribute('disabled', '');
        mineBtn.setAttribute('aria-disabled', 'true');
        mineBtn.classList.add('is-disabled');
        mineBtn.classList.remove('is-on');
        mineBtn.title = 'Sign in to filter your builds';
      }
    }

    let nextState = state;
    if (!myAuthorId && state.mine) nextState = { ...state, mine: false };

    // Avoid remounting boards (restarts AppearInLibrary) when auth only
    // echoes INITIAL_SESSION / token refresh with the same identity.
    const identityChanged = prevId !== nextId;
    const needRepaint =
      nextState !== state ||
      (identityChanged && (state.mine || nextState.mine));

    state = nextState;
    if (needRepaint) paintList();
  });

  function paintList() {
    unmountBoards?.();
    unmountBoards = null;
    unbindActions?.();
    unbindActions = null;

    writeFeedStateToUrl(state);
    const rows = sortBuilds(filterBuilds(all, state, myAuthorId), state.sort);
    syncFeedFiltersUi(rail, state, rows.length);

    if (!rows.length) {
      listHost.innerHTML = `<p class="build-status builds-feed__empty">No builds match these filters.</p>`;
      return;
    }

    const viewClass =
      state.view === 'compact' ? 'builds-feed__list--compact' : 'builds-feed__list--card';
    listHost.innerHTML = `<ul class="builds-feed__list ${viewClass}" data-feed-view="${state.view}" aria-label="Build posts">${rows
      .map((b) => postRowHtml(b, root, { view: state.view }))
      .join('')}</ul>`;

    const list = listHost.querySelector('.builds-feed__list');
    if (list instanceof HTMLElement) {
      unmountBoards = mountFeedBoardThumbs(list, {
        builds: rows,
        root,
        view: state.view,
        spriteDisplay,
        shapes,
        sockets,
      });
      unbindActions = bindFeedPostActions(list, {
        builds: rows,
        root,
        onVoteChange() {
          if (state.liked) paintList();
        },
      });
    }
  }

  paintList();
}

/**
 * @returns {Promise<object[]>}
 */
async function fetchPublicBuilds() {
  const supabase = getSupabase();
  const placementSelect = `
      placements:build_placements (
        id, x, y, r, gems,
        item:items ( ${ITEM_SELECT} )
      )`;
  const withProfile = `
      slug, title, hero_class, blurb, is_op, is_featured, build_tag, vote_score,
      author_id, author_name, rank, gold_count, youtube_url, created_at, updated_at,
      profile:profiles!builds_author_id_fkey (
        discord_id, display_name, avatar_url
      ),
      ${placementSelect}`;
  const bare = `
      slug, title, hero_class, blurb, is_op, is_featured, build_tag, vote_score,
      author_id, author_name, rank, gold_count, youtube_url, created_at, updated_at,
      ${placementSelect}`;

  let { data, error } = await supabase
    .from('builds')
    .select(withProfile)
    .eq('is_public', true)
    .limit(60);

  if (error) {
    const retry = await supabase
      .from('builds')
      .select(bare)
      .eq('is_public', true)
      .limit(60);
    if (retry.error) throw retry.error;
    data = retry.data;
  }

  return (data ?? []).map(normalizeBuildAuthor);
}

/** @param {object} row */
function normalizeBuildAuthor(row) {
  const raw = row?.profile;
  const profile =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? raw
      : Array.isArray(raw)
        ? raw[0]
        : null;
  const discord_id = String(profile?.discord_id || '').trim();
  const avatar = String(profile?.avatar_url || '').trim();
  const liveName = String(profile?.display_name || '').trim();
  return {
    ...row,
    author_discord_id: discord_id || null,
    author_avatar_url: avatar || row.author_avatar_url || null,
    author_name: liveName || row.author_name || 'Unknown',
  };
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

/** @returns {FeedFilterState} */
function readFeedStateFromUrl() {
  const q = new URLSearchParams(location.search);
  const sortRaw = String(q.get('sort') || 'hot').toLowerCase();
  const viewRaw = String(q.get('view') || 'card').toLowerCase();
  const classRaw = String(q.get('class') || '').trim();
  /** @type {FeedSort} */
  const sort = FEED_SORTS.includes(/** @type {FeedSort} */ (sortRaw))
    ? /** @type {FeedSort} */ (sortRaw)
    : 'hot';
  /** @type {FeedView} */
  const view = FEED_VIEWS.includes(/** @type {FeedView} */ (viewRaw))
    ? /** @type {FeedView} */ (viewRaw)
    : 'card';

  /** @type {FeedTag[]} */
  let tags = [];
  const tagsRaw = q.get('tags');
  /** @param {string} t */
  const mapTag = (t) => (t === 'theorycraft' ? 'theory' : t);
  if (tagsRaw) {
    tags = tagsRaw
      .split(',')
      .map((t) => mapTag(t.trim().toLowerCase()))
      .filter((t) => FEED_TAGS.includes(/** @type {FeedTag} */ (t)));
  } else {
    // Legacy single ?tag=
    const tagRaw = mapTag(String(q.get('tag') || '').toLowerCase());
    if (FEED_TAGS.includes(/** @type {FeedTag} */ (tagRaw))) {
      tags = [/** @type {FeedTag} */ (tagRaw)];
    }
  }

  /** @type {string[]} */
  let ranks = allFeedRanks();
  const ranksParam = q.get('ranks') || q.get('rank');
  if (ranksParam) {
    const parsed = ranksParam
      .split(',')
      .map((r) => r.trim().toLowerCase())
      .filter((r) => FEED_RANK_IDS.includes(r));
    if (parsed.length) ranks = parsed;
  }

  const liked = q.get('liked') === '1' || q.get('liked') === 'true';
  const mine = q.get('mine') === '1' || q.get('mine') === 'true';
  const heroClass = HERO_CLASSES.includes(classRaw) ? classRaw : null;
  return { sort, view, tags, liked, mine, heroClass, ranks };
}

/**
 * @param {FeedFilterState} state
 */
function writeFeedStateToUrl(state) {
  const q = new URLSearchParams();
  if (state.sort !== 'hot') q.set('sort', state.sort);
  if (state.view !== 'card') q.set('view', state.view);
  if (state.liked) q.set('liked', '1');
  if (state.mine) q.set('mine', '1');
  if (state.tags.length) q.set('tags', state.tags.join(','));
  if (state.heroClass) q.set('class', state.heroClass);
  if (!isAllFeedRanks(state.ranks)) q.set('ranks', state.ranks.join(','));
  const qs = q.toString();
  const next = `${location.pathname}${qs ? `?${qs}` : ''}${location.hash || ''}`;
  const cur = `${location.pathname}${location.search}${location.hash || ''}`;
  if (next !== cur) history.replaceState(null, '', next);
}

/**
 * @param {object} b
 * @param {FeedTag} tag
 */
function buildHasTag(b, tag) {
  if (tag === 'op') return Boolean(b.is_op);
  if (tag === 'featured') return Boolean(b.is_featured);
  const bt = b.build_tag === 'theorycraft' ? 'theory' : b.build_tag;
  if (tag === 'feasible') return bt === 'feasible';
  if (tag === 'theory') return bt === 'theory';
  if (tag === 'real') return bt === 'real';
  return false;
}

/**
 * @param {object[]} rows
 * @param {FeedFilterState} state
 * @param {string | null} [myAuthorId]
 */
function filterBuilds(rows, state, myAuthorId = null) {
  return rows.filter((b) => {
    if (state.mine) {
      if (!myAuthorId || String(b.author_id || '') !== myAuthorId) return false;
    }
    if (state.liked && readMyVote(String(b.slug || '')) !== 1) return false;
    if (state.tags.length && !state.tags.some((t) => buildHasTag(b, t))) return false;
    if (state.heroClass && String(b.hero_class || '') !== state.heroClass) return false;
    if (!isAllFeedRanks(state.ranks)) {
      const key = String(b.rank || '').toLowerCase();
      if (!state.ranks.includes(key)) return false;
    }
    return true;
  });
}

/** @param {unknown} iso */
function parseTs(iso) {
  const n = Date.parse(String(iso || ''));
  return Number.isFinite(n) ? n : 0;
}

/** Quality for Hot / Top / Best / Rising — vote_score + small curated boosts. */
function qualityScore(b) {
  let s = Number(b.vote_score) || 0;
  if (b.is_op) s += 2;
  if (b.is_featured) s += 1;
  const tag = b.build_tag === 'theorycraft' ? 'theory' : b.build_tag;
  if (tag === 'feasible' || tag === 'real') s += 0.25;
  return s;
}

/** @param {object} b */
function ageHours(b) {
  return Math.max(0, (Date.now() - parseTs(b.created_at)) / 3600000);
}

/**
 * @param {object[]} rows
 * @param {FeedSort} sort
 */
function sortBuilds(rows, sort) {
  const copy = rows.slice();

  if (sort === 'new') {
    copy.sort((a, b) => parseTs(b.created_at) - parseTs(a.created_at));
    return copy;
  }

  if (sort === 'top') {
    copy.sort((a, b) => {
      const d = qualityScore(b) - qualityScore(a);
      if (d) return d;
      return parseTs(b.created_at) - parseTs(a.created_at);
    });
    return copy;
  }

  if (sort === 'best') {
    // Mild time decay — quality holds up longer than Hot.
    copy.sort((a, b) => {
      const sa = qualityScore(a) / Math.pow(ageHours(a) / 24 + 2, 0.6);
      const sb = qualityScore(b) / Math.pow(ageHours(b) / 24 + 2, 0.6);
      return sb - sa;
    });
    return copy;
  }

  if (sort === 'rising') {
    // Stronger decay — newer posts with signal climb faster.
    copy.sort((a, b) => {
      const sa = qualityScore(a) / Math.pow(ageHours(a) + 2, 2.2);
      const sb = qualityScore(b) / Math.pow(ageHours(b) + 2, 2.2);
      return sb - sa;
    });
    return copy;
  }

  // hot (default)
  copy.sort((a, b) => {
    const sa = qualityScore(a) / Math.pow(ageHours(a) + 2, 1.5);
    const sb = qualityScore(b) / Math.pow(ageHours(b) + 2, 1.5);
    return sb - sa;
  });
  return copy;
}

/** @param {HTMLElement} main */
function paintSkeleton(main) {
  const row = () => `
    <div class="builds-post builds-post--skel" aria-hidden="true">
      <div class="builds-post__skel-byline">
        ${skelBlock({ width: '1.65rem', height: '1.65rem', radius: '50%' })}
        ${skelBar({ width: '7rem', height: '0.8rem', radius: '0.2rem' })}
      </div>
      ${skelBar({ width: '72%', height: '1.3rem', radius: '0.2rem' })}
      <div class="builds-post__skel-body">
        ${skelBlock({ className: 'builds-post__skel-board', width: '33.75rem', height: '26.25rem', radius: '0.4rem' })}
        ${skelBar({ width: '14rem', height: '1.4rem', radius: '0.2rem' })}
      </div>
    </div>`;

  main.innerHTML = skelRegion(
    `<div class="builds-layout builds-layout--skel">
      <div class="builds-feed-col">
        <div class="builds-feed__list builds-feed__list--skel">${row()}${row()}</div>
      </div>
      <aside class="items-filters il-filter builds-feed-filters builds-feed-filters--skel" aria-hidden="true">
        ${skelBar({ width: '70%', height: '1.1rem', radius: '0.2rem' })}
        ${skelBlock({ width: '100%', height: '8rem', radius: '0.35rem' })}
        ${skelBlock({ width: '100%', height: '8rem', radius: '0.35rem' })}
      </aside>
    </div>`,
    { className: 'builds-feed-skel', label: 'Loading builds' },
  );
}
