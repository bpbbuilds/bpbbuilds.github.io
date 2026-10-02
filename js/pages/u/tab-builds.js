/**
 * Profile hub — Builds tab (author feed + filters + owner liked section).
 */

import { getSupabase } from '../../shared/supabase.js';
import { hydrateFaces } from '../../shared/blob-face.js';
import { skelBar, skelBlock, skelRegion } from '../../shared/skeleton.js';
import {
  itemSpriteUrl,
  itemsFromBuilds,
} from '../../shared/build-search.js';
import { mountBuildSearchInput } from '../../shared/build-search-input.js';
import { listUpvotedBuildSlugs } from '../build/vote.js';
import { mountFeedBoardThumbs } from '../builds/board-thumbs.js';
import {
  bindFeedFilters,
  defaultFeedFilterState,
  feedFiltersHtml,
  syncFeedFiltersUi,
} from '../builds/feed-filters.js';
import { filterBuilds, sortBuilds } from '../builds/feed.js';
import { bindFeedPostActions } from '../builds/post-actions.js';
import { postRowHtml } from '../builds/post-row.js';
import { bindEventBannerTip } from '../build/event-banner-tip.js';
import { bindFilterDrawer, filterDrawerChromeHtml } from '../../shared/filter-drawer.js';
import { escapeAttr } from './html.js';

/** @typedef {import('../builds/feed-filters.js').FeedFilterState} FeedFilterState */

const ITEM_SELECT =
  'id, gid, name, rarity, type, class, extra_types, tags, cost, effect, image, shape, sockets, accuracy, cooldown, stamina_cost, damage_min, damage_max, block, chance, chance_tag, params';

const BUILD_SELECT = `
  slug, title, hero_class, blurb, is_op, is_featured, build_tag, vote_score,
  author_id, author_name, rank, gold_count, youtube_url, event_slug, board_still_path,
  created_at, updated_at,
  profile:profiles!builds_author_id_fkey (
    discord_id, display_name, avatar_url, equipped_avatar
  ),
  placements:build_placements (
    id, x, y, r, gems,
    item:items ( ${ITEM_SELECT} )
  )
`;

/**
 * @param {string} authorId
 */
async function fetchAuthorBuilds(authorId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('builds')
    .select(BUILD_SELECT)
    .eq('author_id', authorId)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data ?? []).map(normalizeFeedBuild);
}

/**
 * @param {string[]} slugs
 */
async function fetchBuildsBySlugs(slugs) {
  const unique = [...new Set(slugs.map((s) => String(s || '').trim()).filter(Boolean))];
  if (!unique.length) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('builds')
    .select(BUILD_SELECT)
    .eq('is_public', true)
    .in('slug', unique.slice(0, 80));
  if (error) throw error;
  const bySlug = new Map((data ?? []).map((b) => [String(b.slug || ''), normalizeFeedBuild(b)]));
  // Keep upvote order from local list when possible
  return unique.map((s) => bySlug.get(s)).filter(Boolean);
}

/**
 * @param {object} row
 */
function normalizeFeedBuild(row) {
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
    author_discord_id: String(profile?.discord_id || '').trim() || null,
    author_avatar_url: String(profile?.avatar_url || '').trim() || null,
    author_equipped_avatar:
      profile?.equipped_avatar != null ? String(profile.equipped_avatar) : null,
    author_name: liveName || row.author_name || 'Unknown',
  };
}

/**
 * @param {object} build
 * @param {object} profile
 * @param {string} name
 */
function withProfileAuthor(build, profile, name) {
  return {
    ...build,
    author_discord_id: profile.discord_id,
    author_avatar_url: profile.avatar_url,
    author_equipped_avatar: profile.equipped_avatar ?? null,
    author_name: name,
  };
}

/**
 * @param {HTMLElement} host
 * @param {object[]} rows
 * @param {{
 *   root: string,
 *   view: 'card' | 'compact' | 'grid',
 *   assets: { spriteDisplay: object | null, shapes: object | null, sockets: object | null },
 *   label: string,
 * }} opts
 */
function mountRows(host, rows, opts) {
  const { root, view, assets, label } = opts;
  const viewClass =
    view === 'compact'
      ? 'builds-feed__list--compact'
      : view === 'grid'
        ? 'builds-feed__list--grid'
        : 'builds-feed__list--card';
  host.innerHTML = `<ul class="builds-feed__list ${viewClass}" aria-label="${escapeAttr(label)}">${rows
    .map((b) => postRowHtml(b, root, { view, eventMark: true }))
    .join('')}</ul>`;
  const list = host.querySelector('.builds-feed__list');
  if (!(list instanceof HTMLElement)) {
    return { unmountBoards: () => {}, unbindActions: () => {} };
  }
  void hydrateFaces(list, root);
  const tipSelector =
    view === 'compact'
      ? '.builds-post__compact-thumb'
      : view === 'grid'
        ? '.builds-post__grid-board'
        : '.builds-post__board';
  const unmountBoards = mountFeedBoardThumbs(list, {
    builds: rows,
    root,
    view,
    spriteDisplay: assets.spriteDisplay,
    shapes: assets.shapes,
    sockets: assets.sockets,
    tipSelector,
  });
  const unbindActions = bindFeedPostActions(list, { builds: rows, root });
  return { unmountBoards, unbindActions };
}

/**
 * @param {HTMLElement} stage
 * @param {{
 *   profile: object,
 *   viewerProfile?: object | null,
 *   isSelf?: boolean,
 *   root: string,
 *   name: string,
 *   assets: { spriteDisplay: object | null, shapes: object | null, sockets: object | null },
 *   buildsCache?: object[] | null,
 *   likedCache?: object[] | null,
 * }} ctx
 */
export async function mountBuildsTab(stage, ctx) {
  const { profile, root, name, assets } = ctx;
  const isSelf = Boolean(ctx.isSelf);
  const myAuthorId = ctx.viewerProfile?.id || null;
  const canMine = Boolean(myAuthorId);

  stage.innerHTML = skelRegion(
    `<div class="profile-builds">
      <div class="builds-layout profile-builds__layout">
        <div class="builds-feed-col">
          <div class="profile-skel__list">${skelBlock()}${skelBlock()}${skelBar({ width: '70%' })}</div>
        </div>
        <aside class="items-filters il-filter builds-feed-filters builds-feed-filters--skel" aria-hidden="true"></aside>
      </div>
    </div>`,
    { label: 'Loading builds' },
  );

  try {
    if (!ctx.buildsCache) {
      ctx.buildsCache = await fetchAuthorBuilds(profile.id);
    }
    const authored = (ctx.buildsCache || []).map((b) =>
      withProfileAuthor(b, profile, name),
    );

    if (isSelf && !ctx.likedCache) {
      try {
        ctx.likedCache = await fetchBuildsBySlugs(listUpvotedBuildSlugs());
      } catch (err) {
        console.warn('[profile] liked builds failed', err);
        ctx.likedCache = [];
      }
    }
    const liked = isSelf ? ctx.likedCache || [] : [];

    /** @type {FeedFilterState} */
    let state = defaultFeedFilterState();
    /** @type {(() => void) | null} */
    let unmountAuthor = null;
    /** @type {(() => void) | null} */
    let unbindAuthor = null;
    /** @type {(() => void) | null} */
    let unmountLiked = null;
    /** @type {(() => void) | null} */
    let unbindLiked = null;
    /** @type {(() => void) | null} */
    let unbindEventTips = null;
    /** @type {(() => void) | null} */
    let unbindFilters = null;
    /** @type {ReturnType<typeof mountBuildSearchInput> | null} */
    let searchInput = null;

    const rows0 = sortBuilds(filterBuilds(authored, state, myAuthorId), state.sort);
    const likedBlock = isSelf
      ? `<div class="profile-builds__liked">
            <h2 class="profile-builds__title bpb-label-text">Liked builds</h2>
            <p class="profile-builds__liked-hint">Builds you’ve upvoted on this device.</p>
            <div class="profile-builds__list-host" data-profile-liked></div>
          </div>`
      : '';

    stage.innerHTML = `
      <section class="profile-builds" aria-label="Public builds">
        <div class="builds-layout profile-builds__layout bpb-filter-drawer">
          <div class="builds-feed-col">
            <div class="profile-builds__list-host" data-profile-list></div>
            ${likedBlock}
          </div>
          ${filterDrawerChromeHtml('builds-feed-filters')}
          ${feedFiltersHtml(root, state, rows0.length, { canMine })}
        </div>
      </section>`;

    const listHost = stage.querySelector('[data-profile-list]');
    const likedHost = stage.querySelector('[data-profile-liked]');
    const rail = stage.querySelector('.builds-feed-filters');
    if (!(listHost instanceof HTMLElement) || !(rail instanceof HTMLElement)) return;

    function clearMounts() {
      unmountAuthor?.();
      unmountAuthor = null;
      unbindAuthor?.();
      unbindAuthor = null;
      unmountLiked?.();
      unmountLiked = null;
      unbindLiked?.();
      unbindLiked = null;
      unbindEventTips?.();
      unbindEventTips = null;
    }

    function paintList() {
      clearMounts();

      const rows = sortBuilds(filterBuilds(authored, state, myAuthorId), state.sort);
      syncFeedFiltersUi(rail, state, rows.length);

      if (!rows.length) {
        listHost.innerHTML = authored.length
          ? `<p class="build-status builds-feed__empty">No builds match these filters.</p>`
          : `<p class="build-status builds-feed__empty">No public builds yet.</p>`;
      } else {
        const m = mountRows(listHost, rows, {
          root,
          view: state.view,
          assets,
          label: `Builds by ${name}`,
        });
        unmountAuthor = m.unmountBoards;
        unbindAuthor = m.unbindActions;
      }

      if (likedHost instanceof HTMLElement) {
        const shown = new Set(rows.map((b) => String(b.slug || '')));
        const likedRows = liked.filter((b) => !shown.has(String(b.slug || '')));
        const wrap = likedHost.closest('.profile-builds__liked');
        if (!liked.length) {
          if (wrap instanceof HTMLElement) wrap.hidden = false;
          likedHost.innerHTML = `<p class="build-status builds-feed__empty">No upvoted builds yet.</p>`;
        } else if (!likedRows.length) {
          if (wrap instanceof HTMLElement) wrap.hidden = true;
          likedHost.innerHTML = '';
        } else {
          if (wrap instanceof HTMLElement) wrap.hidden = false;
          const m = mountRows(likedHost, likedRows, {
            root,
            view: state.view,
            assets,
            label: 'Liked builds',
          });
          unmountLiked = m.unmountBoards;
          unbindLiked = m.unbindActions;
        }
      }

      unbindEventTips = bindEventBannerTip(stage);
    }

    bindFilterDrawer(stage.querySelector('.profile-builds__layout'));

    unbindFilters = bindFeedFilters(rail, {
      getState: () => state,
      defaultState: defaultFeedFilterState,
      onResetSearch() {
        searchInput?.clear();
      },
      onChange(next) {
        state = next;
        paintList();
      },
    });

    searchInput = mountBuildSearchInput(rail, {
      items: itemsFromBuilds(authored),
      getSpriteUrl: (item) => itemSpriteUrl(root, item),
      initialQuery: state.q,
      onChange(q) {
        if (q === state.q) return;
        state = { ...state, q };
        paintList();
      },
    });

    paintList();

    const obs = new MutationObserver(() => {
      if (stage.contains(rail)) return;
      searchInput?.destroy();
      searchInput = null;
      unbindFilters?.();
      clearMounts();
      obs.disconnect();
    });
    obs.observe(stage, { childList: true });
  } catch (err) {
    console.error(err);
    stage.innerHTML = `<p class="build-status">Could not load builds.</p>`;
  }
}
