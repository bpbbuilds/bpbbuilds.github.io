import { getSupabase } from '../../supabase.js';
import { mountPlacedGrid } from '../../backpack-grid/index.js';
import {
  applyShapes,
  applySocketOffsets,
  makeSpriteUrl,
  mapItem,
} from '../../../pages/build/map-item.js';

const BOARD_COLS = 9;
const BOARD_ROWS = 7;
const BOARD_ITEMS = [
  { x: 1, y: 0 },
  { x: 4, y: 0 },
  { x: 7, y: 0 },
  { x: 0, y: 2 },
  { x: 3, y: 2 },
  { x: 6, y: 2 },
  { x: 2, y: 5 },
  { x: 5, y: 4 },
];
const FLY_MS = 620;
const FLY_STAGGER_MS = 45;
const HOLD_MS = 1500;
const RETURN_STAGGER_MS = 45;
const CHEST_LID_MS = 280;
const MAX_BUILD_ITEMS = 72;
const ITEM_SELECT =
  'id, gid, name, rarity, type, class, extra_types, tags, cost, effect, image, shape, sockets, accuracy, cooldown, stamina_cost, damage_min, damage_max, block, chance, chance_tag, params';

function baseRoot(root) {
  return String(root || './').endsWith('/') ? String(root || './') : `${root}/`;
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function loadEntries(root) {
  try {
    const response = await fetch(`${root}assets/data/sprite-display.json`, { cache: 'force-cache' });
    if (!response.ok) return [];
    const payload = await response.json();
    return Object.entries(payload?.byImage || {})
      .filter(([file, meta]) => (
        !/potion|flask|hatchparticles/i.test(file) &&
        Number(meta?.w) > 0 &&
        Number(meta?.h) > 0
      ))
      .map(([file, meta]) => ({
        file,
        width: Number(meta.w),
        height: Number(meta.h),
        cellSize: Number(payload.cellSize) > 0 ? Number(payload.cellSize) : 80,
      }));
  } catch {
    return [];
  }
}

async function loadGridMeta(root) {
  const fetchJson = async (file) => {
    try {
      const response = await fetch(`${root}assets/data/${file}`, { cache: 'force-cache' });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  };
  const [shapes, sockets, spriteDisplay] = await Promise.all([
    fetchJson('item-shapes.json'),
    fetchJson('socket-offsets.json'),
    fetchJson('sprite-display.json'),
  ]);
  return { shapes, sockets, spriteDisplay };
}

/**
 * Select one real, public player build. This is best-effort so the loading
 * screen still works when the catalog or Supabase is unavailable.
 * @param {Array<{file:string,width:number,height:number,cellSize:number}>} entries
 * @returns {Promise<{title:string,placements:Array<object>}|null>}
 */
async function loadRandomPlayerBuild(entries) {
  try {
    const supabase = getSupabase();
    const select = `
      id, title, updated_at,
      placements:build_placements (
        id, x, y, r, gems,
        item:items ( ${ITEM_SELECT} )
      )
    `;
    const { data, error } = await supabase
      .from('builds')
      .select(select)
      .eq('is_public', true)
      .eq('build_tag', 'real')
      .order('updated_at', { ascending: false })
      .limit(30);
    if (error) throw error;

    const builds = (data || [])
      .map((build) => {
        const placements = (build.placements || [])
          .map((placement) => {
            const item = Array.isArray(placement.item) ? placement.item[0] : placement.item;
            const x = Number(placement.x);
            const y = Number(placement.y);
            if (!item?.image || !Number.isFinite(x) || !Number.isFinite(y)) return null;
            if (x < 0 || y < 0 || x >= BOARD_COLS || y >= BOARD_ROWS) return null;
            return {
              id: placement.id,
              item,
              x,
              y,
              r: Number.isFinite(Number(placement.r)) ? Number(placement.r) : 0,
              gems: Array.isArray(placement.gems) ? placement.gems : undefined,
            };
          })
          .filter(Boolean)
          // Keep the complete normal build footprint (current public builds are
          // below this ceiling) so the animation does not silently omit bags or
          // gear from the real board.
          .slice(0, MAX_BUILD_ITEMS);
        return placements.length ? { title: String(build.title || 'Player build'), placements } : null;
      })
      .filter(Boolean);

    if (!builds.length) return null;
    return builds[Math.floor(Math.random() * builds.length)];
  } catch {
    return null;
  }
}

function pickEntries(entries) {
  if (!entries.length) return [];
  const stride = Math.max(1, Math.floor(entries.length / BOARD_ITEMS.length));
  return BOARD_ITEMS.map((_, index) => entries[(index * stride) % entries.length]);
}

function setChestOpen(chest, open) {
  chest?.classList.toggle('is-open', open);
}

/**
 * Build-creator loading preset: Chestnut opens, a real player build assembles on
 * the center board, holds, then returns to the chest.
 */
export function createBuildCreatorLoadingScreen({ host, root = './' } = {}) {
  if (!(host instanceof HTMLElement)) return null;
  const base = baseRoot(root);
  host.innerHTML = `
    <section class="bpb-loading-screen bpb-loading-screen--build-creator" role="status" aria-live="polite" aria-busy="true">
      <div class="bpb-build-loader__heading">
        <p class="bpb-loading-screen__eyebrow">Backpack Battles Builds</p>
        <h1 class="bpb-loading-screen__title">Building your backpack</h1>
        <p class="bpb-loading-screen__subtitle" data-build-loader-status>Gathering items…</p>
      </div>
      <div class="bpb-build-loader__board" data-build-loader-board aria-label="Build being assembled">
        <div class="bpb-build-loader__cells" aria-hidden="true"></div>
        <div class="bpb-build-loader__grid" data-build-loader-grid></div>
      </div>
      <div class="bpb-build-loader__chest" data-build-loader-chest aria-hidden="true">
        <img class="bpb-build-loader__chest-bottom" src="${base}assets/theme/ui/sellbox/bottom.png" alt="" draggable="false" />
        <img class="bpb-build-loader__chest-top" src="${base}assets/theme/ui/sellbox/top.png" alt="" draggable="false" />
      </div>
      <div class="bpb-build-loader__progress" aria-hidden="true">
        <span class="bpb-loading-screen__bar" data-build-loader-bar></span>
      </div>
    </section>
  `;

  const screen = host.querySelector('.bpb-loading-screen');
  const board = host.querySelector('[data-build-loader-board]');
  const gridHost = host.querySelector('[data-build-loader-grid]');
  const chest = host.querySelector('[data-build-loader-chest]');
  const status = host.querySelector('[data-build-loader-status]');
  const bar = host.querySelector('[data-build-loader-bar]');
  let items = [];
  let activeRun = 0;
  let loaded = false;
  let loadPromise;
  let loadedBuildTitle = '';
  let grid = null;

  const setProgress = (value, message = '') => {
    const progress = Math.min(100, Math.max(0, Number(value) || 0));
    if (bar) bar.style.width = `${progress}%`;
    if (status && message) status.textContent = message;
    screen?.setAttribute('aria-busy', String(progress < 100));
  };

  const buildItems = (entries, playerBuild = null, meta = {}) => {
    grid?.destroy?.({ keepHost: true });
    grid = null;
    gridHost?.replaceChildren();

    const getSpriteUrl = makeSpriteUrl(base, meta.spriteDisplay);
    const mappedItems = [];
    const placements = [];
    const itemsById = new Map();

    if (playerBuild?.placements?.length) {
      for (const [index, placement] of playerBuild.placements.entries()) {
        const item = mapItem(placement.item);
        if (!item?.id) continue;
        mappedItems.push(item);
        itemsById.set(item.id, item);
        placements.push({
          id: item.id,
          x: Number(placement.x) || 0,
          y: Number(placement.y) || 0,
          r: Number(placement.r) || 0,
          gems: Array.isArray(placement.gems) ? placement.gems : undefined,
          key: String(placement.id ?? `${item.id}:${index}:${placement.x},${placement.y}:${placement.r || 0}`),
        });
      }
    }

    if (!placements.length) {
      loadedBuildTitle = 'Sample build';
      for (const [index, entry] of pickEntries(entries).entries()) {
        const width = Math.max(1, Math.ceil(Number(entry.width) || 1));
        const height = Math.max(1, Math.ceil(Number(entry.height) || 1));
        const item = {
          id: `__loader-${index}`,
          name: entry.file,
          image: entry.file,
          type: 'Item',
          rarity: 'Common',
          shape: Array.from({ length: height }, () => Array(width).fill(1)),
        };
        mappedItems.push(item);
        itemsById.set(item.id, item);
        placements.push({ ...BOARD_ITEMS[index], id: item.id, r: 0, key: item.id });
      }
    } else {
      loadedBuildTitle = playerBuild?.title || 'Player build';
    }

    applyShapes(mappedItems, meta.shapes);
    applySocketOffsets(mappedItems, meta.sockets);
    mappedItems.forEach((item) => getSpriteUrl(item));

    if (!gridHost) return;
    grid = mountPlacedGrid(gridHost, {
      placements: [],
      itemsById: new Map(),
      cols: BOARD_COLS,
      rows: BOARD_ROWS,
      cellPx: Math.max(1, (board?.getBoundingClientRect().width || 306) / BOARD_COLS),
      fillWidth: false,
      exactBoard: true,
      getSpriteUrl,
      promo: true,
    });
    grid?.update(placements, itemsById);

    items = [...gridHost.querySelectorAll('.bpb-bg__item')];
    items.forEach((item, index) => {
      item.dataset.index = String(index);
      item.style.opacity = '0';
      item.style.visibility = 'hidden';
      item.style.willChange = 'transform, opacity';
    });
    gridHost.querySelectorAll('.bpb-bg__under-item, .bpb-bg__fabric').forEach((layer) => {
      layer.style.opacity = '0';
    });
  };

  const resetItems = () => {
    items.forEach((item) => {
      item.getAnimations().forEach((animation) => animation.cancel());
      item.style.opacity = '0';
      item.style.visibility = 'hidden';
      item.style.removeProperty('transform');
    });
    gridHost?.querySelectorAll('.bpb-bg__under-item, .bpb-bg__fabric').forEach((layer) => {
      layer.style.opacity = '0';
    });
  };

  const flyItems = (returning = false) => {
    if (!items.length || !board || !chest) return Promise.resolve();
    const chestRect = chest.getBoundingClientRect();
    const originX = chestRect.left + chestRect.width * 0.8;
    const originY = chestRect.top + chestRect.height * 0.28;
    const animations = items.map((item, index) => {
      const rect = item.getBoundingClientRect();
      const targetX = rect.left + rect.width / 2;
      const targetY = rect.top + rect.height / 2;
      const dx = originX - targetX;
      const dy = originY - targetY;
      const delay = (returning ? (items.length - 1 - index) * RETURN_STAGGER_MS : index * FLY_STAGGER_MS);
      const from = returning
        ? 'translate3d(0, 0, 0) scale(1)'
        : `translate3d(${dx}px, ${dy}px, 0) scale(0.34)`;
      const to = returning
        ? `translate3d(${dx}px, ${dy}px, 0) scale(0.34)`
        : 'translate3d(0, 0, 0) scale(1)';
      item.style.visibility = 'visible';
      const animation = item.animate(
        [{ opacity: returning ? 1 : 0, transform: from }, { opacity: returning ? 0 : 1, transform: to }],
        { duration: FLY_MS, delay, easing: 'cubic-bezier(0.22, 0.8, 0.28, 1)', fill: 'both' },
      );
      return animation.finished
        .then(() => {
          item.style.opacity = returning ? '0' : '1';
          item.style.visibility = returning ? 'hidden' : 'visible';
          item.style.removeProperty('transform');
          if (!returning) {
            gridHost?.querySelectorAll('.bpb-bg__under-item, .bpb-bg__fabric').forEach((layer) => {
              layer.style.opacity = '1';
            });
          }
        })
        .catch(() => {});
    });
    return Promise.all(animations);
  };

  const reset = () => {
    activeRun += 1;
    setChestOpen(chest, false);
    resetItems();
    setProgress(0, 'Gathering items…');
  };

  const play = async () => {
    const run = ++activeRun;
    resetItems();
    setChestOpen(chest, true);
    setProgress(8, 'Opening the Chestnut…');
    await sleep(CHEST_LID_MS);
    if (run !== activeRun) return;
    setProgress(58, `Placing ${loadedBuildTitle || 'the build'}…`);
    await flyItems(false);
    if (run !== activeRun) return;
    setProgress(82, 'Build ready');
    await sleep(HOLD_MS);
    if (run !== activeRun) return;
    setProgress(92, 'Packing it away…');
    await flyItems(true);
    if (run !== activeRun) return;
    setChestOpen(chest, false);
    await sleep(CHEST_LID_MS);
    if (run !== activeRun) return;
    setProgress(100, 'Ready to play');
  };

  const destroy = () => {
    activeRun += 1;
    resetItems();
    grid?.destroy?.();
    grid = null;
    host.replaceChildren();
  };

  loadPromise = loadEntries(base).then(async (entries) => {
    if (!host.isConnected) return;
    const [playerBuild, meta] = await Promise.all([
      loadRandomPlayerBuild(entries),
      loadGridMeta(base),
    ]);
    buildItems(entries, playerBuild, meta);
    loaded = true;
  });

  return {
    host,
    screen,
    reset,
    setProgress,
    complete: () => setProgress(100, 'Ready to play'),
    play: async () => {
      if (!loaded) await loadPromise;
      return play();
    },
    destroy,
  };
}
