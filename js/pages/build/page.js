/**
 * Build guide page — /builds/{slug}/
 * Board + round scrubber | right info rail (class, bag, route, essentials).
 */

import { getSupabase } from '../../shared/supabase.js';
import { mountPlacedGrid } from '../../shared/backpack-grid/index.js';
import { createTooltipHover } from '../../shared/tooltip-hover.js';
import {
  mapItem,
  makeSpriteUrl,
  applyShapes,
  applySocketOffsets,
} from './map-item.js';
import {
  finalBoardFrames,
  framesFromHistoryRun,
  mountRoundScrubber,
} from './round-scrubber.js';
import { renderInfoRail, renderBuildLoadingShell } from './info-rail.js';
import { renderAuthorRail } from './author-rail.js';
import {
  MORE_BUILDS_CAP,
  fetchAuthorMoreBuilds,
  mountAuthorMoreBuilds,
} from './more-builds.js';
import { renderBuildVideo, hasBuildVideo, setStageShowingVideo } from './video.js';

/** Slug that uses the decoded Steam history.db demo run for round frames. */
/** Game Inventory.gd `inventorySize` default. */
const BOARD_COLS = 9;
const BOARD_ROWS = 7;

const ITEM_SELECT =
  'id, gid, name, rarity, type, class, extra_types, tags, cost, effect, image, shape, sockets, accuracy, cooldown, stamina_cost, damage_min, damage_max, block, chance, chance_tag, params';

function rootPrefix() {
  const raw = document.body?.dataset?.root ?? '../../';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/** @returns {string | null} */
export function slugFromPath() {
  // Community / create publishes: /builds/view/?slug=…
  const q = new URLSearchParams(location.search).get('slug');
  if (q && String(q).trim()) return String(q).trim();

  const parts = location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const i = parts.lastIndexOf('builds');
  if (i < 0 || !parts[i + 1] || parts[i + 1] === 'index.html') return null;
  const seg = parts[i + 1];
  if (seg === 'view' || seg === 'history') return seg === 'history' ? 'history' : null;
  return seg;
}

/**
 * @param {string} path
 * @param {number} [ms]
 */
async function fetchJson(path, ms = 15000) {
  try {
    const res = await fetch(path, { signal: AbortSignal.timeout(ms) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * @param {string} slug
 */
async function fetchBuild(slug) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('builds')
    .select(
      `
      id, slug, title, hero_class, blurb, notes, youtube_url, thumbnail_path,
      is_op, op_requested, build_tag, vote_score, author_id, author_name, gold_count, rank, starting_bag_id, history,
      route_r3, route_r10, route_r3_item_id, route_r10_item_id,
      profile:profiles!builds_author_id_fkey (
        discord_id, display_name, avatar_url
      ),
      placements:build_placements (
        id, x, y, r, gems, priority,
        item:items ( ${ITEM_SELECT} )
      )
    `,
    )
    .eq('slug', slug)
    .eq('is_public', true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return data;
  const profile =
    data.profile && typeof data.profile === 'object' && !Array.isArray(data.profile)
      ? data.profile
      : Array.isArray(data.profile)
        ? data.profile[0]
        : null;
  const discord_id = String(profile?.discord_id || '').trim();
  const avatar = String(profile?.avatar_url || '').trim();
  const liveName = String(profile?.display_name || '').trim();
  return {
    ...data,
    author_discord_id: discord_id || null,
    author_avatar_url: avatar || null,
    author_name: liveName || data.author_name || 'Unknown',
  };
}

/**
 * Load Round 3 / Round 10 skills + starting bag by id (may be off the final board).
 * @param {object} build
 * @returns {Promise<{ r3: object | null, r10: object | null, startingBag: object | null }>}
 */
async function fetchRouteSkills(build) {
  const ids = [
    build?.route_r3_item_id,
    build?.route_r10_item_id,
    build?.starting_bag_id,
  ].filter(Boolean);
  if (!ids.length) return { r3: null, r10: null, startingBag: null };

  const supabase = getSupabase();
  const { data, error } = await supabase.from('items').select(ITEM_SELECT).in('id', ids);
  if (error) throw error;

  const byId = new Map((data || []).map((row) => [row.id, mapItem(row)]));
  return {
    r3: byId.get(build.route_r3_item_id) || null,
    r10: byId.get(build.route_r10_item_id) || null,
    startingBag: byId.get(build.starting_bag_id) || null,
  };
}

/**
 * @param {HTMLElement} main
 * @param {object} build
 * @param {string} root
 * @param {Record<string, object> | null} spriteDisplay
 * @param {{ r3?: object | null, r10?: object | null, startingBag?: object | null }} routeSkills
 * @param {{ shapes?: object | null, sockets?: object | null, historyRun?: object | null, authorMore?: object | null }} gridMeta
 */
function renderPage(main, build, root, spriteDisplay, routeSkills, gridMeta = {}) {
  const getSpriteUrl = makeSpriteUrl(root, spriteDisplay);

  const placements = (build.placements || [])
    .filter((p) => p.item)
    .map((p, i) => ({
      id: p.item.id,
      x: Number(p.x) || 0,
      y: Number(p.y) || 0,
      r: Number(p.r) || 0,
      key: String(p.id ?? `${p.item.id}:${i}:${p.x},${p.y}:${p.r || 0}`),
      gems: Array.isArray(p.gems) ? p.gems : undefined,
    }));

  const itemsById = new Map();
  for (const p of build.placements || []) {
    const item = mapItem(p.item);
    if (item) itemsById.set(item.id, item);
  }
  for (const row of build._historyItems || []) {
    const item = mapItem(row);
    if (item) itemsById.set(item.id, item);
  }
  // Items for author “More builds” thumbnails (Supabase Hot)
  for (const row of gridMeta.authorMore?.items || []) {
    const item = mapItem(row);
    if (item && !itemsById.has(item.id)) itemsById.set(item.id, item);
  }
  for (const key of ['r3', 'r10']) {
    const skill = routeSkills?.[key];
    if (skill?.id) itemsById.set(skill.id, skill);
  }
  if (routeSkills?.startingBag?.id) {
    itemsById.set(routeSkills.startingBag.id, routeSkills.startingBag);
  }

  const historyFrames = framesFromHistoryRun(gridMeta.historyRun || null);

  const allItems = [...itemsById.values()];
  applyShapes(allItems, gridMeta.shapes || null);
  applySocketOffsets(allItems, gridMeta.sockets || null);
  // Stamp spriteW/H before first paint (createItemEl sizes from these)
  for (const item of allItems) getSpriteUrl(item);

  main.innerHTML = `
    <div class="build-layout">
      ${renderAuthorRail(build, root)}
      <div class="build-stage">
        ${renderStageHead(build, root)}
        <div class="build-stage__media" id="build-media">
          <div id="build-bag" class="build-bag" aria-label="${escapeAttr(build.title)} backpack"></div>
          ${renderBuildVideo(build)}
        </div>
        <div id="build-round" class="build-round-host"></div>
      </div>
      ${renderInfoRail(build, itemsById, getSpriteUrl, root, routeSkills, {
        historyRun: gridMeta.historyRun || null,
      })}
    </div>
  `;

  const bagHost = main.querySelector('#build-bag');
  const roundHost = main.querySelector('#build-round');
  const mediaHost = main.querySelector('#build-media');
  if (!bagHost || !roundHost) return;

  if (!placements.length && !historyFrames.length) {
    bagHost.innerHTML = `<p class="build-status">No backpack yet.</p>`;
    return;
  }

  const hasHistory = historyFrames.length > 0;
  const frames = hasHistory ? historyFrames : finalBoardFrames(placements);
  const start = frames[frames.length - 1];

  const grid = mountPlacedGrid(bagHost, {
    placements: start.placements,
    itemsById,
    cols: BOARD_COLS,
    rows: BOARD_ROWS,
    getSpriteUrl,
    fillWidth: true,
    exactBoard: true,
    reserveScrollGap: false,
    cellPx: 80,
    // Same AppearInLibrary wave as items catalog filter refresh
    appear: true,
  });

  const tip = createTooltipHover();
  const getTipItem = (el) => itemsById.get(el.dataset.itemId);
  const infoRail = main.querySelector('.build-info');
  // Showcase bag: pin over Build Info. Info icons: to the right of the hovered item.
  tip.bind(bagHost, {
    selector:
      '.bpb-bg__mark--gem[data-item-id], .bpb-bg__item[data-item-id]:not(.bpb-bg__item--parked)',
    getItem: getTipItem,
    place: infoRail ? 'overFilters' : 'near',
    filtersSelector: '.build-info',
    filtersScope: main,
  });
  if (infoRail) {
    tip.bind(infoRail, {
      selector: '[data-item-id]',
      getItem: getTipItem,
      place: 'itemRight',
    });
  }

  const authorRail = main.querySelector('.build-author');
  const moreThumbs = gridMeta.authorMore?.builds || [];
  if (authorRail instanceof HTMLElement && moreThumbs.length) {
    try {
      mountAuthorMoreBuilds(authorRail, {
        builds: moreThumbs,
        itemsById,
        getSpriteUrl,
        root,
        overEl: infoRail instanceof HTMLElement ? infoRail : null,
      });
    } catch (err) {
      console.warn('Author more-builds mount failed:', err);
    }
  }

  /** @param {boolean} visible */
  function applyItemsVisible(visible) {
    const board = bagHost.querySelector('.bpb-bg');
    if (board instanceof HTMLElement) {
      board.classList.toggle('bpb-bg--hide-items', !visible);
    }
  }

  /** @param {boolean} visible */
  function applyBagsVisible(visible) {
    const board = bagHost.querySelector('.bpb-bg');
    if (board instanceof HTMLElement) {
      board.classList.toggle('bpb-bg--hide-bags', !visible);
    }
  }

  mountRoundScrubber(roundHost, {
    frames,
    root,
    initialIndex: frames.length - 1,
    showHistory: hasHistory,
    itemsVisible: true,
    bagsVisible: true,
    hasVideo: hasBuildVideo(build),
    buildKey: build.slug || '',
    voteScore: Number(build.vote_score ?? build.like_count ?? 0) || 0,
    onItemsVisibleChange: applyItemsVisible,
    onBagsVisibleChange: applyBagsVisible,
    onChange(frame, _index, meta) {
      setStageShowingVideo(
        mediaHost instanceof HTMLElement ? mediaHost : null,
        Boolean(meta?.isVideo),
      );
      if (meta?.isVideo || !frame) return;
      // Same items-page AppearInLibrary wave when scrubbing history rounds
      grid.update(frame.placements, itemsById, { appear: true });
    },
  });

  syncRoundPanelToBoard(bagHost, roundHost);
}

/** Keep W/L strip + scrubber the same pixel width as the inventory board. */
function syncRoundPanelToBoard(bagHost, roundHost) {
  const board = bagHost.querySelector('.bpb-bg__board');
  const panel = roundHost.querySelector('.build-round-panel');
  if (!(board instanceof HTMLElement) || !(panel instanceof HTMLElement)) return;

  const apply = () => {
    const w = board.getBoundingClientRect().width;
    if (w > 1) panel.style.width = `${Math.round(w)}px`;
  };
  apply();
  const ro = new ResizeObserver(apply);
  ro.observe(board);
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Center-column identity: build title + optional OP badge above the backpack.
 * @param {object} build
 * @param {string} root
 */
function renderStageHead(build, root) {
  const title = String(build?.title || 'Build').trim() || 'Build';
  const base = root.endsWith('/') ? root : `${root}/`;
  const op = build?.is_op
    ? `<img
        class="build-stage__op"
        src="${escapeAttr(base)}assets/theme/ui/ui-badge-op.png"
        alt="OP"
        width="899"
        height="1130"
        draggable="false"
      />`
    : build?.op_requested
      ? `<span class="build-stage__op-pending" title="OP request pending review">OP pending</span>`
      : '';
  const authRaw =
    build?.build_tag === 'theorycraft' ? 'theory' : build?.build_tag;
  const authLabel =
    authRaw === 'feasible'
      ? 'Feasible'
      : authRaw === 'theory'
        ? 'Theory'
        : authRaw === 'real'
          ? 'Real'
          : '';
  const authFlair = authLabel
    ? `<span class="builds-post__flair builds-post__flair--${escapeAttr(String(authRaw))} build-stage__auth">${escapeHtml(authLabel)}</span>`
    : '';

  return `
    <header class="build-stage__head">
      <div class="build-stage__identity">
        <h1 class="build-stage__title">${escapeHtml(title)}</h1>
        ${op}
        ${authFlair}
      </div>
    </header>
  `;
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

/**
 * Open a history.db run from author-history-builds.json (?run=3708).
 * @param {HTMLElement} main
 * @param {string} root
 */
async function initHistoryRunPage(main, root) {
  const runId = Number(new URLSearchParams(location.search).get('run'));
  if (!Number.isFinite(runId)) {
    main.innerHTML = `<p class="build-status">Missing history run id. Use <code>?run=3708</code>.</p>`;
    return;
  }

  main.innerHTML = renderBuildLoadingShell();

  try {
    const [bundle, spriteDisplay, shapes, sockets] = await Promise.all([
      fetchJson(`${root}assets/data/author-history-builds.json`),
      fetchJson(`${root}assets/data/sprite-display.json`),
      fetchJson(`${root}assets/data/item-shapes.json`),
      fetchJson(`${root}assets/data/socket-offsets.json`),
    ]);

    if (!bundle?.builds?.length) {
      main.innerHTML = `<p class="build-status">Could not load history builds.</p>`;
      return;
    }

    const entry = bundle.builds.find((b) => Number(b.runId) === runId);
    if (!entry) {
      main.innerHTML = `<p class="build-status">History run ${escapeHtml(String(runId))} not found.</p>`;
      document.title = 'Build not found — Smojo Builds';
      return;
    }

    const byId = new Map((bundle.items || []).map((row) => [row.id, row]));
    const r3Id = entry.route_r3_item_id || null;
    const r10Id = entry.route_r10_item_id || null;
    const build = {
      slug: `history-${runId}`,
      title: entry.title || `${entry.hero_class || 'Build'} · run ${runId}`,
      hero_class: entry.hero_class,
      author_name: bundle.author_name || 'Smojo',
      rank: entry.rank,
      gold_count: entry.gold_count ?? null,
      notes: `Imported from history.db run ${runId}.`,
      blurb: entry.title || '',
      is_op: true,
      route_r3_item_id: r3Id,
      route_r10_item_id: r10Id,
      placements: (entry.placements || []).map((p, i) => ({
        id: i,
        x: p.x,
        y: p.y,
        r: p.r,
        gems: Array.isArray(p.gems) ? p.gems : [],
        priority: null,
        item_id: p.id,
        item: byId.get(p.id) || null,
      })),
      _historyItems: bundle.items || [],
    };

    const routeSkills = {
      r3: r3Id ? mapItem(byId.get(r3Id)) : null,
      r10: r10Id ? mapItem(byId.get(r10Id)) : null,
    };

    const historyRun =
      Array.isArray(entry.rounds) && entry.rounds.length
        ? {
            runId,
            skill1Gid: entry.skill1Gid ?? null,
            skill2Gid: entry.skill2Gid ?? null,
            rounds: entry.rounds,
          }
        : null;

    document.title = `${build.title} — Smojo Builds`;
    renderPage(main, build, root, spriteDisplay, routeSkills, {
      shapes,
      sockets,
      historyRun,
    });
  } catch (err) {
    console.error(err);
    main.innerHTML = `<p class="build-status">Could not load this history build.</p>`;
  }
}

export async function initBuildPage() {
  const main = document.getElementById('main');
  if (!main) return;

  const slug = slugFromPath();
  const root = rootPrefix();
  const isHistoryViewer =
    document.body?.dataset?.historyViewer === '1' || slug === 'history';

  if (isHistoryViewer) {
    await initHistoryRunPage(main, root);
    return;
  }

  if (!slug) {
    main.innerHTML = `<p class="build-status">Missing build slug.</p>`;
    return;
  }

  main.innerHTML = renderBuildLoadingShell();

  try {
    const [build, spriteDisplay, shapes, sockets] = await Promise.all([
      withTimeout(fetchBuild(slug), 10000),
      fetchJson(`${root}assets/data/sprite-display.json`),
      fetchJson(`${root}assets/data/item-shapes.json`),
      fetchJson(`${root}assets/data/socket-offsets.json`),
    ]);

    if (!build) {
      main.innerHTML = `<p class="build-status">Build not found.</p>`;
      document.title = 'Build not found — Smojo Builds';
      return;
    }

    const historyRun =
      build.history?.rounds?.length ? build.history : null;

    // Ensure every history-frame item is in the catalog map (not only final board)
    if (historyRun?.rounds?.length) {
      const have = new Set(
        (build.placements || []).map((p) => p.item?.id).filter(Boolean),
      );
      const need = new Set();
      for (const r of historyRun.rounds) {
        for (const p of r.placements || []) {
          if (p?.id && !have.has(p.id)) need.add(p.id);
          for (const gid of p?.gems || []) {
            if (gid && !have.has(gid)) need.add(gid);
          }
        }
      }
      if (need.size) {
        try {
          const supabase = getSupabase();
          const { data: extra } = await withTimeout(
            supabase.from('items').select(ITEM_SELECT).in('id', [...need]),
            8000,
          );
          for (const row of extra || []) {
            if (!row?.id) continue;
            build._historyItems = build._historyItems || [];
            build._historyItems.push(row);
          }
        } catch (err) {
          console.warn('Extra history items fetch failed:', err);
        }
      }
    }

    let routeSkills = { r3: null, r10: null, startingBag: null };
    try {
      routeSkills = await withTimeout(fetchRouteSkills(build), 8000);
    } catch (err) {
      console.warn('Route skills fetch failed:', err);
    }

    // Author rail: public Supabase builds by author_id (Hot, cap 6).
    let authorMore = null;
    if (build.author_id) {
      try {
        authorMore = await withTimeout(
          fetchAuthorMoreBuilds({
            authorId: build.author_id,
            excludeSlug: slug,
            limit: MORE_BUILDS_CAP,
          }),
          10000,
        );
      } catch (err) {
        console.warn('Author more-builds fetch failed:', err);
        authorMore = null;
      }
      if (!authorMore?.builds?.length) authorMore = null;
    }

    document.title = `${build.title} — Smojo Builds`;
    renderPage(main, build, root, spriteDisplay, routeSkills, {
      shapes,
      sockets,
      historyRun,
      authorMore,
    });
  } catch (err) {
    console.error(err);
    main.innerHTML = `<p class="build-status">Could not load this build.</p>`;
  }
}
