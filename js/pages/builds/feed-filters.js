/**
 * Builds feed filter rail — same Item Library chrome (il-filter / Patch3).
 */

import { HERO_CLASSES } from '../items/filter-logic.js';

/** @typedef {'best' | 'hot' | 'new' | 'top' | 'rising'} FeedSort */
/** @typedef {'card' | 'compact'} FeedView */
/** @typedef {'op' | 'feasible' | 'theory' | 'real' | 'featured'} FeedTag */
/** @typedef {{ sort: FeedSort, view: FeedView, tags: FeedTag[], liked: boolean, mine: boolean, heroClass: string | null, ranks: string[] }} FeedFilterState */

export const FEED_SORTS = /** @type {const} */ ([
  'best',
  'hot',
  'new',
  'top',
  'rising',
]);

export const FEED_VIEWS = /** @type {const} */ (['card', 'compact']);

export const FEED_TAGS = /** @type {const} */ ([
  'op',
  'feasible',
  'theory',
  'real',
  'featured',
]);

export const FEED_RANKS = /** @type {const} */ ([
  { id: 'bronze', label: 'Bronze', file: 'League_Bronze.png' },
  { id: 'silver', label: 'Silver', file: 'League_Silver.png' },
  { id: 'gold', label: 'Gold', file: 'League_Gold.png' },
  { id: 'platinum', label: 'Platinum', file: 'League_Platinum.png' },
  { id: 'diamond', label: 'Diamond', file: 'League_Diamond.png' },
  { id: 'master', label: 'Master', file: 'League_Master.png' },
  { id: 'grandmaster', label: 'Grandmaster', file: 'League_Grandmaster.png' },
  { id: 'grandma', label: 'Grandma', file: 'League_Grandma.png' },
]);

export const FEED_RANK_IDS = FEED_RANKS.map((r) => r.id);

/** @returns {string[]} */
export function allFeedRanks() {
  return FEED_RANK_IDS.slice();
}

/** @param {string[]} ranks */
export function isAllFeedRanks(ranks) {
  return ranks.length === FEED_RANK_IDS.length && FEED_RANK_IDS.every((id) => ranks.includes(id));
}

/**
 * Rank multi-select: all on by default; first click from “all” keeps only that rank.
 * @param {string[]} current
 * @param {string} clicked
 * @returns {string[]}
 */
export function toggleFeedRank(current, clicked) {
  if (!FEED_RANK_IDS.includes(clicked)) return current.slice();
  if (isAllFeedRanks(current)) return [clicked];
  if (current.includes(clicked)) {
    const next = current.filter((r) => r !== clicked);
    return next.length ? next : allFeedRanks();
  }
  return [...current, clicked];
}

export const FEED_SORT_LABELS = {
  best: 'Best',
  hot: 'Hot',
  new: 'New',
  top: 'Top',
  rising: 'Rising',
};

export const FEED_VIEW_LABELS = {
  card: 'Card',
  compact: 'Compact',
};

export const FEED_TAG_LABELS = {
  op: 'OP',
  feasible: 'Feasible',
  theory: 'Theory',
  real: 'Real',
  featured: 'Featured',
};

/** @returns {FeedFilterState} */
export function defaultFeedFilterState() {
  return {
    sort: 'hot',
    view: 'card',
    tags: [],
    liked: false,
    mine: false,
    heroClass: null,
    ranks: allFeedRanks(),
  };
}

/**
 * @param {string} root
 * @param {FeedFilterState} state
 * @param {number} shown
 * @param {{ canMine?: boolean }} [opts]
 */
export function feedFiltersHtml(root, state, shown, opts = {}) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const countLabel = shown === 1 ? '1 build found.' : `${shown} builds found.`;
  const sortLabel = FEED_SORT_LABELS[state.sort] || 'Hot';
  const viewLabel = FEED_VIEW_LABELS[state.view] || 'Card';
  const canMine = opts.canMine === true;
  const mineOn = canMine && state.mine;

  const sortOptions = FEED_SORTS.map(
    (s) =>
      `<button type="button" class="il-filter__group-option${state.sort === s ? ' is-active' : ''}" data-feed-sort="${s}" role="option" aria-selected="${state.sort === s}">${FEED_SORT_LABELS[s]}</button>`,
  ).join('');

  const viewOptions = FEED_VIEWS.map(
    (v) =>
      `<button type="button" class="il-filter__group-option${state.view === v ? ' is-active' : ''}" data-feed-view="${v}" role="option" aria-selected="${state.view === v}">${FEED_VIEW_LABELS[v]}</button>`,
  ).join('');

  const tagBtns = FEED_TAGS.map((t) => {
    const on = state.tags.includes(t);
    return `<button type="button" class="il-filter__check${on ? ' is-on' : ''}" data-feed-tag="${t}" aria-pressed="${on}">
      <span class="il-filter__box" aria-hidden="true"></span>
      <span class="il-filter__check-label">${FEED_TAG_LABELS[t]}</span>
    </button>`;
  }).join('');

  const classBtns = HERO_CLASSES.map((c) => {
    const on = state.heroClass === c;
    return `<button type="button" class="il-filter__icon-btn${on ? ' is-on' : ''}" data-feed-class="${escapeAttr(c)}" title="${escapeAttr(c)}" aria-pressed="${on}">
      <img src="${escapeAttr(base)}assets/icons/classes/${escapeAttr(c)}Icon.png" alt="" draggable="false" />
    </button>`;
  }).join('');

  const rankBtns = FEED_RANKS.map((r) => {
    const on = state.ranks.includes(r.id);
    return `<button type="button" class="il-filter__icon-btn${on ? ' is-on' : ''}" data-feed-rank="${escapeAttr(r.id)}" title="${escapeAttr(r.label)}" aria-pressed="${on}">
      <img src="${escapeAttr(base)}assets/icons/leagues/${escapeAttr(r.file)}" alt="" draggable="false" />
    </button>`;
  }).join('');

  const anyClassOn = !state.heroClass;

  return `
    <aside class="items-filters il-filter builds-feed-filters" aria-label="Filter builds">
      <div class="il-filter__head">
        <p class="il-filter__count" data-filter-count>${escapeHtml(countLabel)}</p>
        <button type="button" class="il-filter__reset" data-feed-reset title="Reset filters" aria-label="Reset filters">
          <img src="${escapeAttr(base)}assets/icons/filters/ResetButton.png" alt="" draggable="false" />
        </button>
      </div>

      <div class="il-filter__shade builds-feed-filters__menus">
        <div class="il-filter__grouping" data-feed-sort-root>
          <button type="button" class="il-filter__group-trigger" data-feed-sort-trigger aria-haspopup="listbox" aria-expanded="false">
            <img class="il-filter__group-arrow" src="${escapeAttr(base)}assets/icons/filters/DropdownArrow.png" alt="" draggable="false" />
            <span class="il-filter__sticker" data-feed-sort-label>${escapeHtml(sortLabel)}</span>
          </button>
          <div class="il-filter__group-menu" data-feed-sort-menu hidden role="listbox" aria-label="Sort builds">
            ${sortOptions}
          </div>
        </div>
        <div class="il-filter__grouping" data-feed-view-root>
          <button type="button" class="il-filter__group-trigger" data-feed-view-trigger aria-haspopup="listbox" aria-expanded="false">
            <img class="il-filter__group-arrow" src="${escapeAttr(base)}assets/icons/filters/DropdownArrow.png" alt="" draggable="false" />
            <span class="il-filter__sticker" data-feed-view-label>${escapeHtml(viewLabel)}</span>
          </button>
          <div class="il-filter__group-menu" data-feed-view-menu hidden role="listbox" aria-label="Feed view">
            ${viewOptions}
          </div>
        </div>
      </div>

      <div class="il-filter__shade">
        <div class="il-filter__checks" role="group" aria-label="Library filters">
          <button
            type="button"
            class="il-filter__check${mineOn ? ' is-on' : ''}${canMine ? '' : ' is-disabled'}"
            data-feed-mine
            ${canMine ? '' : 'disabled'}
            aria-disabled="${canMine ? 'false' : 'true'}"
            aria-pressed="${mineOn}"
            title="${canMine ? 'Show only your builds' : 'Sign in to filter your builds'}"
          >
            <span class="il-filter__box" aria-hidden="true"></span>
            <span class="il-filter__check-label">My builds</span>
          </button>
          <button
            type="button"
            class="il-filter__check${state.liked ? ' is-on' : ''}"
            data-feed-liked
            aria-pressed="${state.liked}"
          >
            <span class="il-filter__box" aria-hidden="true"></span>
            <span class="il-filter__check-label">Liked</span>
          </button>
        </div>
      </div>

      <div class="il-filter__shade">
        <p class="il-filter__sticker">Tags</p>
        <div class="il-filter__checks" role="group" aria-label="Build tags">${tagBtns}</div>
      </div>

      <div class="il-filter__shade">
        <div class="il-filter__classes" role="group" aria-label="Hero class">
          <button type="button" class="il-filter__icon-btn${anyClassOn ? ' is-on' : ''}" data-feed-class="" title="Any class" aria-pressed="${anyClassOn}">
            <img src="${escapeAttr(base)}assets/icons/classes/NeutralIcon.png" alt="" draggable="false" />
          </button>
          ${classBtns}
        </div>
      </div>

      <div class="il-filter__shade builds-feed-filters__ranks">
        <div class="il-filter__classes" role="group" aria-label="League rank">
          ${rankBtns}
        </div>
      </div>
    </aside>`;
}

/**
 * @param {HTMLElement} rail
 * @param {FeedFilterState} state
 * @param {number} shown
 */
export function syncFeedFiltersUi(rail, state, shown) {
  const countEl = rail.querySelector('[data-filter-count]');
  if (countEl) {
    countEl.textContent = shown === 1 ? '1 build found.' : `${shown} builds found.`;
  }

  const sortLabel = rail.querySelector('[data-feed-sort-label]');
  if (sortLabel) sortLabel.textContent = FEED_SORT_LABELS[state.sort] || 'Hot';

  const viewLabel = rail.querySelector('[data-feed-view-label]');
  if (viewLabel) viewLabel.textContent = FEED_VIEW_LABELS[state.view] || 'Card';

  rail.querySelectorAll('[data-feed-sort]').forEach((el) => {
    const on = el.getAttribute('data-feed-sort') === state.sort;
    el.classList.toggle('is-active', on);
    el.setAttribute('aria-selected', on ? 'true' : 'false');
  });

  rail.querySelectorAll('[data-feed-view]').forEach((el) => {
    const on = el.getAttribute('data-feed-view') === state.view;
    el.classList.toggle('is-active', on);
    el.setAttribute('aria-selected', on ? 'true' : 'false');
  });

  const likedBtn = rail.querySelector('[data-feed-liked]');
  if (likedBtn instanceof HTMLElement) {
    likedBtn.classList.toggle('is-on', state.liked);
    likedBtn.setAttribute('aria-pressed', state.liked ? 'true' : 'false');
  }

  const mineBtn = rail.querySelector('[data-feed-mine]');
  if (mineBtn instanceof HTMLElement) {
    const canMine = !mineBtn.hasAttribute('disabled');
    const mineOn = canMine && state.mine;
    mineBtn.classList.toggle('is-on', mineOn);
    mineBtn.setAttribute('aria-pressed', mineOn ? 'true' : 'false');
  }

  rail.querySelectorAll('[data-feed-tag]').forEach((el) => {
    const tag = /** @type {FeedTag} */ (el.getAttribute('data-feed-tag'));
    const on = state.tags.includes(tag);
    el.classList.toggle('is-on', on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  rail.querySelectorAll('[data-feed-class]').forEach((el) => {
    const raw = el.getAttribute('data-feed-class') || '';
    const on = raw ? state.heroClass === raw : !state.heroClass;
    el.classList.toggle('is-on', on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  rail.querySelectorAll('[data-feed-rank]').forEach((el) => {
    const raw = el.getAttribute('data-feed-rank') || '';
    const on = Boolean(raw) && state.ranks.includes(raw);
    el.classList.toggle('is-on', on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

/**
 * @param {HTMLElement} rail
 * @param {{
 *   getState: () => FeedFilterState,
 *   onChange: (next: FeedFilterState) => void,
 *   defaultState: () => FeedFilterState,
 * }} opts
 * @returns {() => void}
 */
export function bindFeedFilters(rail, opts) {
  /** @type {{ root: Element | null, trigger: Element | null, menu: Element | null }[]} */
  const menus = [
    {
      root: rail.querySelector('[data-feed-sort-root]'),
      trigger: rail.querySelector('[data-feed-sort-trigger]'),
      menu: rail.querySelector('[data-feed-sort-menu]'),
    },
    {
      root: rail.querySelector('[data-feed-view-root]'),
      trigger: rail.querySelector('[data-feed-view-trigger]'),
      menu: rail.querySelector('[data-feed-view-menu]'),
    },
  ];

  /** @param {{ menu: Element | null, trigger: Element | null }} m */
  function closeMenu(m) {
    if (!(m.menu instanceof HTMLElement) || !(m.trigger instanceof HTMLElement)) return;
    m.menu.hidden = true;
    m.trigger.setAttribute('aria-expanded', 'false');
    m.menu.style.removeProperty('top');
    m.menu.style.removeProperty('left');
    m.menu.style.removeProperty('min-width');
  }

  /** @param {{ menu: Element | null, trigger: Element | null }} m */
  function openMenu(m) {
    for (const other of menus) {
      if (other !== m) closeMenu(other);
    }
    if (!(m.menu instanceof HTMLElement) || !(m.trigger instanceof HTMLElement)) return;
    m.menu.hidden = false;
    m.trigger.setAttribute('aria-expanded', 'true');
    // Rail uses overflow:hidden so menus are position:fixed — pin under trigger.
    const r = m.trigger.getBoundingClientRect();
    m.menu.style.top = `${Math.round(r.bottom + 4)}px`;
    m.menu.style.left = `${Math.round(r.left)}px`;
    m.menu.style.minWidth = `${Math.round(Math.max(r.width, 10.5 * 16))}px`;
  }

  function closeAllMenus() {
    for (const m of menus) closeMenu(m);
  }

  /** @param {Event} e */
  function onClick(e) {
    const t = e.target;
    if (!(t instanceof Element)) return;

    const reset = t.closest('[data-feed-reset]');
    if (reset && rail.contains(reset)) {
      closeAllMenus();
      opts.onChange(opts.defaultState());
      return;
    }

    const sortTrig = t.closest('[data-feed-sort-trigger]');
    if (sortTrig && rail.contains(sortTrig)) {
      const m = menus[0];
      if (m.menu instanceof HTMLElement && !m.menu.hidden) closeMenu(m);
      else openMenu(m);
      return;
    }

    const viewTrig = t.closest('[data-feed-view-trigger]');
    if (viewTrig && rail.contains(viewTrig)) {
      const m = menus[1];
      if (m.menu instanceof HTMLElement && !m.menu.hidden) closeMenu(m);
      else openMenu(m);
      return;
    }

    const sortOpt = t.closest('[data-feed-sort]');
    if (sortOpt instanceof HTMLElement && rail.contains(sortOpt)) {
      const sort = /** @type {FeedSort} */ (sortOpt.getAttribute('data-feed-sort'));
      if (!FEED_SORTS.includes(sort)) return;
      closeAllMenus();
      const cur = opts.getState();
      if (sort === cur.sort) return;
      opts.onChange({ ...cur, sort });
      return;
    }

    const viewOpt = t.closest('[data-feed-view]');
    if (viewOpt instanceof HTMLElement && rail.contains(viewOpt)) {
      const view = /** @type {FeedView} */ (viewOpt.getAttribute('data-feed-view'));
      if (!FEED_VIEWS.includes(view)) return;
      closeAllMenus();
      const cur = opts.getState();
      if (view === cur.view) return;
      opts.onChange({ ...cur, view });
      return;
    }

    const likedBtn = t.closest('[data-feed-liked]');
    if (likedBtn instanceof HTMLElement && rail.contains(likedBtn)) {
      const cur = opts.getState();
      opts.onChange({ ...cur, liked: !cur.liked });
      return;
    }

    const mineBtn = t.closest('[data-feed-mine]');
    if (mineBtn instanceof HTMLElement && rail.contains(mineBtn)) {
      if (mineBtn.hasAttribute('disabled')) return;
      const cur = opts.getState();
      opts.onChange({ ...cur, mine: !cur.mine });
      return;
    }

    const tagBtn = t.closest('[data-feed-tag]');
    if (tagBtn instanceof HTMLElement && rail.contains(tagBtn)) {
      const tag = /** @type {FeedTag} */ (tagBtn.getAttribute('data-feed-tag'));
      if (!FEED_TAGS.includes(tag)) return;
      const cur = opts.getState();
      const tags = cur.tags.includes(tag)
        ? cur.tags.filter((x) => x !== tag)
        : [...cur.tags, tag];
      opts.onChange({ ...cur, tags });
      return;
    }

    const classBtn = t.closest('[data-feed-class]');
    if (classBtn instanceof HTMLElement && rail.contains(classBtn)) {
      const raw = classBtn.getAttribute('data-feed-class') || '';
      const heroClass = HERO_CLASSES.includes(raw) ? raw : null;
      const cur = opts.getState();
      if (heroClass === cur.heroClass) return;
      opts.onChange({ ...cur, heroClass });
      return;
    }

    const rankBtn = t.closest('[data-feed-rank]');
    if (rankBtn instanceof HTMLElement && rail.contains(rankBtn)) {
      const raw = rankBtn.getAttribute('data-feed-rank') || '';
      if (!FEED_RANK_IDS.includes(raw)) return;
      const cur = opts.getState();
      opts.onChange({ ...cur, ranks: toggleFeedRank(cur.ranks, raw) });
    }
  }

  /** @param {MouseEvent} e */
  function onDocPointer(e) {
    const t = e.target;
    if (!(t instanceof Node)) return;
    const inside = menus.some(
      (m) => m.root instanceof HTMLElement && m.root.contains(t),
    );
    if (inside) return;
    closeAllMenus();
  }

  rail.addEventListener('click', onClick);
  document.addEventListener('pointerdown', onDocPointer);
  return () => {
    rail.removeEventListener('click', onClick);
    document.removeEventListener('pointerdown', onDocPointer);
  };
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
