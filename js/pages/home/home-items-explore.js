/**
 * Homepage items explore — VH Skills layout (left copy, right orbiting sprites).
 *
 *   import { initHomeItemsExplore } from './home-items-explore.js';
 *   initHomeItemsExplore();
 */

import { getSupabase } from '../../shared/supabase.js';
import { createTooltipHover } from '../../shared/tooltip-hover.js';
import { skelBlock } from '../../shared/skeleton.js';
import { mapItem, makeSpriteUrl } from '../build/map-item.js';
import { itemMatchesCategory } from '../items/filter-logic.js';
import { escapeAttr, escapeHtml, rootPrefix } from './home-build-media.js';
import { bindExploreTabs, playOrbitAppear } from './home-items-explore-tabs.js';

const ITEM_SELECT =
  'id, gid, name, rarity, type, class, extra_types, tags, cost, effect, image, shape, sockets, accuracy, cooldown, stamina_cost, damage_min, damage_max, block, chance, chance_tag, params';

/** How many sprites to show per category (outer + inner rings). */
const PREVIEW_COUNT = 18;

/** @typedef {{ id: string, label: string, blurb: string }} ExploreTab */

/** @type {ExploreTab[]} */
const TABS = [
  {
    id: 'weapons',
    label: 'Weapons',
    blurb:
      'Weapons typically carry the fight: melee blades, bows, staves, and quirky shop picks. Stack damage, on-hit effects, and board space so your bag keeps hitting harder every round.',
  },
  {
    id: 'armor',
    label: 'Armor',
    blurb:
      'Armor, shields, helmets, and boots buy turns: block, spikes, and defensive loops that keep you alive while the rest of the board snowballs.',
  },
  {
    id: 'bags',
    label: 'Bags',
    blurb:
      'Bags reshape the board: starting pouches, expanders, and class satchels that decide how much space you get to play with. More slots means more synergies before the shop runs dry.',
  },
  {
    id: 'skills',
    label: 'Skills',
    blurb:
      'Skills lock in the route: Round 3 and Round 10 picks plus class powers that define the run. Specializations push mana engines, bag space, or raw stats as you climb the ladder.',
  },
  {
    id: 'treasures',
    label: 'Treasures',
    blurb:
      'Treasures bend the run around one strong Unique: pets, artifacts, and shop-shaking finds. When one drops, rebuild the board to amplify whatever that piece wants to do.',
  },
];

/**
 * @param {string} root
 * @param {string} categoryId
 */
function libraryHref(root, categoryId) {
  return `${root}items/?category=${encodeURIComponent(categoryId)}`;
}

/**
 * @template T
 * @param {T[]} list
 * @returns {T[]}
 */
function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

/**
 * Split ids into outer + inner rings for a denser VH-style cloud.
 * @param {string[]} ids
 * @returns {{ outer: string[], inner: string[] }}
 */
function ringSplit(ids) {
  const list = ids.slice(0, PREVIEW_COUNT);
  const outerN = Math.min(12, Math.ceil(list.length * 0.65));
  return { outer: list.slice(0, outerN), inner: list.slice(outerN) };
}

/**
 * Place slots with left/top % (transform-radius was unreliable on 0×0 boxes).
 * @param {string[]} ids
 * @param {'outer' | 'inner'} ring
 */
function orbitRingHtml(ids, ring) {
  const n = ids.length;
  if (!n) return '';
  const radiusPct = ring === 'outer' ? 42 : 22;
  const nodes = ids
    .map((id, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = 50 + Math.cos(angle) * radiusPct;
      const y = 50 + Math.sin(angle) * radiusPct;
      return `
        <div
          class="home-items__orbit-slot"
          style="left:${x.toFixed(3)}%;top:${y.toFixed(3)}%"
        >
          <button
            type="button"
            class="home-items__sprite"
            data-item-id="${escapeAttr(id)}"
            aria-label="Item"
          >
            <span class="home-items__sprite-face">
              ${skelBlock({ className: 'home-items__sprite-skel', radius: '0.4rem' })}
            </span>
          </button>
        </div>`;
    })
    .join('');
  return `<div class="home-items__orbit-ring home-items__orbit-ring--${ring}">${nodes}</div>`;
}

/**
 * @param {string[]} ids
 */
function orbitRingsHtml(ids) {
  const { outer, inner } = ringSplit(ids);
  return `${orbitRingHtml(outer, 'outer')}${orbitRingHtml(inner, 'inner')}`;
}

/**
 * @param {ExploreTab} tab
 * @param {number} index
 * @param {string} root
 */
function tabChromeHtml(tab, index, root) {
  const on = index === 0;
  return {
    tab: `
      <button
        type="button"
        class="home-items__tab${on ? ' is-active' : ''}"
        role="tab"
        id="home-items-tab-${escapeAttr(tab.id)}"
        aria-selected="${on ? 'true' : 'false'}"
        aria-controls="home-items-panel-${escapeAttr(tab.id)}"
        data-items-tab="${escapeAttr(tab.id)}"
      >${escapeHtml(tab.label)}</button>`,
    panel: `
      <div
        class="home-items__panel"
        id="home-items-panel-${escapeAttr(tab.id)}"
        role="tabpanel"
        aria-labelledby="home-items-tab-${escapeAttr(tab.id)}"
        data-items-panel="${escapeAttr(tab.id)}"
        ${on ? '' : 'hidden'}
      >
        <p class="home-items__blurb home-items__shade">${escapeHtml(tab.blurb)}</p>
        <a class="home-items__cta" href="${escapeAttr(libraryHref(root, tab.id))}">
          <img class="home-items__cta-icon" src="${escapeAttr(`${root}assets/icons/misc/Backpack_icon.png`)}" alt="" width="20" height="20" draggable="false" />
          <span>View items</span>
        </a>
      </div>`,
    orbit: `
      <div
        class="home-items__orbit-set${on ? ' is-active' : ''}"
        data-items-orbit="${escapeAttr(tab.id)}"
        aria-hidden="${on ? 'false' : 'true'}"
      ></div>`,
  };
}

/**
 * @param {string} root
 */
function sectionHtml(root) {
  const parts = TABS.map((tab, i) => tabChromeHtml(tab, i, root));
  return `
    <div class="home-items">
      <div class="home-items__band">
        <div class="home-items__inner">
          <div class="home-items__copy">
            <h2 class="home-items__title home-items__shade">Explore 500+ items</h2>
            <p class="home-items__lede home-items__shade">
              Browse the full Item Library with game tooltips: weapons, bags, skills, and treasures that shape every board.
            </p>
            <div class="home-items__tabs" role="tablist" aria-label="Item categories">
              ${parts.map((p) => p.tab).join('')}
            </div>
            ${parts.map((p) => p.panel).join('')}
          </div>
          <div class="home-items__visual" aria-label="Item previews">
            <div class="home-items__orbit-stage">
              ${parts.map((p) => p.orbit).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

/**
 * @param {object[]} items
 * @param {string} category
 * @param {Set<string>} treasureIds
 * @param {number} n
 * @returns {string[]}
 */
function pickRandomIds(items, category, treasureIds, n) {
  const matched = items.filter((item) =>
    itemMatchesCategory(item, category, treasureIds),
  );
  return shuffle(matched)
    .slice(0, n)
    .map((item) => String(item.id));
}

/**
 * Paint sprite imgs + labels inside an orbit that already has slot markup.
 * @param {HTMLElement} orbit
 * @param {Map<string, object>} byId
 * @param {(item: object) => string} getSpriteUrl
 */
function paintOrbitSprites(orbit, byId, getSpriteUrl) {
  orbit.querySelectorAll('.home-items__sprite[data-item-id]').forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const id = btn.dataset.itemId || '';
    const item = byId.get(id);
    if (!item) {
      btn.closest('.home-items__orbit-slot')?.remove();
      return;
    }
    const name = String(item.name || id);
    btn.setAttribute('aria-label', name);
    btn.title = name;
    const face = btn.querySelector('.home-items__sprite-face');
    face?.querySelector('.home-items__sprite-skel')?.remove();
    face?.querySelector('img')?.remove();
    const img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
    img.src = getSpriteUrl(item) || '';
    (face || btn).append(img);
  });
}

/**
 * @param {HTMLElement} host
 * @param {string} root
 */
async function hydrateSprites(host, root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  let spriteDisplay = null;
  /** @type {Set<string>} */
  let treasureIds = new Set();
  try {
    const [spriteRes, originsRes] = await Promise.all([
      fetch(`${base}assets/data/sprite-display.json`),
      fetch(`${base}assets/data/item-origins.json`),
    ]);
    if (spriteRes.ok) spriteDisplay = await spriteRes.json();
    if (originsRes.ok) {
      const origins = await originsRes.json();
      treasureIds = new Set(
        Array.isArray(origins?.treasure) ? origins.treasure.filter(Boolean) : [],
      );
    }
  } catch {
    /* optional */
  }

  const { data, error } = await getSupabase()
    .from('items')
    .select(ITEM_SELECT)
    .order('gid', { ascending: true, nullsFirst: false });

  if (error) {
    console.warn('[home-items-explore] item fetch failed', error);
    return null;
  }

  const getSpriteUrl = makeSpriteUrl(base, spriteDisplay);
  /** @type {Map<string, object>} */
  const byId = new Map();
  /** @type {object[]} */
  const allItems = [];
  for (const row of data || []) {
    const item = mapItem(row);
    if (!item?.id) continue;
    if (treasureIds.has(String(item.id))) item.isTreasure = true;
    getSpriteUrl(item);
    byId.set(String(item.id), item);
    allItems.push(item);
  }

  /**
   * Fresh random set for a category orbit (called on every tab press).
   * @param {HTMLElement} orbit
   * @param {string} categoryId
   */
  function refillOrbit(orbit, categoryId) {
    const ids = pickRandomIds(allItems, categoryId, treasureIds, PREVIEW_COUNT);
    orbit.innerHTML = ids.length ? orbitRingsHtml(ids) : '';
    paintOrbitSprites(orbit, byId, getSpriteUrl);
  }

  // Initial fill for every category shell (inactive ones wait until selected too)
  for (const tab of TABS) {
    const orbit = host.querySelector(`[data-items-orbit="${CSS.escape(tab.id)}"]`);
    if (!(orbit instanceof HTMLElement)) continue;
    refillOrbit(orbit, tab.id);
  }

  const tip = createTooltipHover();
  tip.bind(host, {
    selector: '.home-items__sprite[data-item-id]',
    getItem: (el) => {
      if (!(el instanceof HTMLElement)) return null;
      return byId.get(el.dataset.itemId || '') || null;
    },
    place: 'near',
  });

  const active = host.querySelector('[data-items-orbit].is-active');
  playOrbitAppear(active instanceof HTMLElement ? active : null);

  return { refillOrbit };
}

/**
 * @param {string | Element} [selector='#home-items-explore']
 */
export function initHomeItemsExplore(selector = '#home-items-explore') {
  const host =
    typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!host) return;

  const root = rootPrefix();
  host.innerHTML = sectionHtml(root);

  void hydrateSprites(host, root).then((catalog) => {
    bindExploreTabs(host, {
      refillOrbit: catalog?.refillOrbit,
    });
  });
}
