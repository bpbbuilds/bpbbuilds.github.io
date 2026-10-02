/**
 * Build info rail — right column (items-filters look): class, bag, round picks, essentials.
 */

import { classIconPath } from '../../shared/class-icons.js';
import { notesToHtml } from '../../shared/item-mentions.js';
import { skelBar, skelBlock, skelRegion } from '../../shared/skeleton.js';
import { startingBagIdsForClass } from '../../shared/starting-bags.js';
import { discussControlHtml } from './discuss.js';

/**
 * Parchment shimmer matching the real Build Info rail (before fetch).
 */
export function renderInfoRailSkeleton() {
  const icon = () =>
    skelBlock({
      className: 'build-info__skel-icon',
      width: '3.15rem',
      height: '3.15rem',
      radius: '0.35rem',
    });
  const divider = `<span class="build-info__divider" aria-hidden="true"></span>`;
  const tierIcons = (n = 3) =>
    `<div class="build-info__skel-row">${Array.from({ length: n }, icon).join('')}</div>`;
  const tier = (labelW, wide = false, n = 3) => `
    <div class="build-info__tier build-info__shade${wide ? ' build-info__tier--wide' : ''}">
      ${skelBar({ width: labelW, height: '1.05rem', radius: '0.2rem' })}
      ${tierIcons(n)}
    </div>`;
  const stat = (labelW) => `
    <div class="build-info__tier build-info__shade build-info__stat">
      ${skelBar({ width: labelW, height: '1.05rem', radius: '0.2rem' })}
      ${skelBlock({ width: '3.25rem', height: '2.35rem', radius: '0.3rem' })}
    </div>`;

  return `
    <aside class="build-info build-info--skel" aria-hidden="true">
      <header class="build-info__head">
        ${skelBar({ width: '8.5rem', height: '1.45rem', radius: '0.25rem' })}
      </header>
      <section class="build-info__section build-info__meta-wrap">
        <div class="build-info__meta">
          <div class="build-info__icons">${icon()}${divider}${icon()}</div>
          <div class="build-info__skills">${icon()}${divider}${icon()}</div>
        </div>
      </section>
      <section class="build-info__section build-info__ess">
        <div class="build-info__ess-grid">
          ${tier('4.2rem', false, 4)}
          ${tier('4.2rem', false, 3)}
          ${stat('3.5rem')}
          ${stat('3.5rem')}
          ${tier('7rem', true, 6)}
        </div>
      </section>
      <section class="build-info__section build-info__how">
        <div class="build-info__how-body build-info__shade build-info__skel-how">
          ${skelBar({ width: '100%', height: '0.85rem', radius: '0.2rem' })}
          ${skelBar({ width: '92%', height: '0.85rem', radius: '0.2rem' })}
          ${skelBar({ width: '78%', height: '0.85rem', radius: '0.2rem' })}
        </div>
      </section>
    </aside>
  `;
}

/**
 * Full build-page loading shell — holds column widths while data loads.
 */
export function renderBuildLoadingShell() {
  const thumb = () =>
    skelBlock({
      className: 'build-author__skel-thumb',
      width: '100%',
      height: '4.5rem',
      radius: '0.3rem',
    });
  return skelRegion(
    `<div class="build-layout build-layout--skel">
      <aside class="build-author build-author--skel" aria-hidden="true">
        <div class="build-author__card">
          <div class="build-author__avatar-wrap">
            ${skelBlock({ width: '100%', height: '100%', radius: '50%' })}
          </div>
          ${skelBar({ width: '5.5rem', height: '1.1rem', radius: '0.2rem' })}
          <section class="build-author__more">
            ${skelBar({ width: '7rem', height: '1rem', radius: '0.2rem' })}
            <div class="build-author__skel-thumbs">${thumb()}${thumb()}${thumb()}${thumb()}${thumb()}${thumb()}</div>
          </section>
        </div>
      </aside>
      <div class="build-stage">
        <header class="build-stage__head" aria-hidden="true">
          <div class="build-stage__identity">
            ${skelBar({ className: 'build-stage__skel-title', width: '70%', height: '1.65rem', radius: '0.25rem' })}
          </div>
        </header>
        <div class="build-bag build-bag--skel" aria-hidden="true">
          ${skelBlock({
            className: 'build-bag__skel-board',
            width: '100%',
            height: '100%',
            radius: '0.45rem',
          })}
        </div>
        <div class="build-round-host build-round-host--skel" aria-hidden="true">
          ${skelBar({ width: '14rem', height: '1.35rem', radius: '0.25rem' })}
          ${skelBar({ width: '100%', height: '1.1rem', radius: '0.2rem' })}
        </div>
      </div>
      ${renderInfoRailSkeleton()}
    </div>`,
    { className: 'build-skel-wrap', label: 'Loading build' },
  );
}

/**
 * @param {object} build
 * @param {Map<string, object>} itemsById
 * @param {(item: object) => string} getSpriteUrl
 * @param {string} root
 * @param {{ r3?: object | null, r10?: object | null }} [routeSkills]
 * @param {{ historyRun?: object | null }} [opts]
 */
export function renderInfoRail(
  build,
  itemsById,
  getSpriteUrl,
  root,
  routeSkills = {},
  opts = {},
) {
  const className = build.hero_class || 'Unknown';
  const classIcon = classIconPath(root, build.hero_class);
  const bag = findBagItem(build, itemsById, opts.historyRun || null);
  const bagSrc = bag ? getSpriteUrl(bag) : '';
  const r3 = routeSkills.r3;
  const r10 = routeSkills.r10;
  const r3Src = r3 ? getSpriteUrl(r3) : '';
  const r10Src = r10 ? getSpriteUrl(r10) : '';
  const tiers = essentialsByTier(build, itemsById);
  const howText = String(build.notes || build.blurb || '').trim();

  return `
    <aside class="build-info" aria-label="Build info">
      <header class="build-info__head">
        <h2 class="build-info__title build-info__ui-text">Build Info</h2>
      </header>

      <section class="build-info__section build-info__meta-wrap" aria-label="Class, bag, and round skills">
        <div class="build-info__meta">
          <div class="build-info__icons">
            ${
              classIcon
                ? `<img class="build-info__icon" src="${escapeAttr(classIcon)}" alt="${escapeAttr(className)}" title="${escapeAttr(className)}" width="48" height="48" />`
                : `<span class="build-info__icon build-info__icon--empty" aria-hidden="true"></span>`
            }
            <span class="build-info__divider" aria-hidden="true"></span>
            ${
              bagSrc
                ? `<img class="build-info__icon" data-item-id="${escapeAttr(bag.id)}" src="${escapeAttr(bagSrc)}" alt="${escapeAttr(bag.name)}" title="Starting bag: ${escapeAttr(bag.name)}" width="48" height="48" />`
                : `<span class="build-info__icon build-info__icon--empty" title="No starting bag" aria-label="No starting bag"></span>`
            }
          </div>
          <div class="build-info__skills" aria-label="Round 3 and Round 10 skills">
            ${
              r3Src
                ? `<img class="build-info__icon" data-item-id="${escapeAttr(r3.id)}" src="${escapeAttr(r3Src)}" alt="${escapeAttr(r3.name)}" width="48" height="48" />`
                : `<span class="build-info__icon build-info__icon--empty" title="Round 3" aria-label="Round 3 skill missing"></span>`
            }
            <span class="build-info__divider" aria-hidden="true"></span>
            ${
              r10Src
                ? `<img class="build-info__icon" data-item-id="${escapeAttr(r10.id)}" src="${escapeAttr(r10Src)}" alt="${escapeAttr(r10.name)}" width="48" height="48" />`
                : `<span class="build-info__icon build-info__icon--empty" title="Round 10" aria-label="Round 10 skill missing"></span>`
            }
          </div>
        </div>
      </section>

      <section class="build-info__section build-info__ess" aria-label="Essentials">
        <div class="build-info__ess-grid">
          ${essentialsBlock('Needs', tiers.needed, getSpriteUrl)}
          ${essentialsBlock('Wants', tiers.nice, getSpriteUrl)}
          ${statBlock('Gold', formatGold(build.gold_count, root), 'build-info__stat--gold')}
          ${statBlock('Rank', formatRank(build.rank, root), 'build-info__stat--rank')}
          ${essentialsBlock('Good to have', tiers.optional, getSpriteUrl, 'build-info__tier--wide')}
        </div>
      </section>

      ${howItWorksBlock(howText, itemsById, getSpriteUrl)}

      <section class="build-info__section build-info__discuss-wrap" aria-label="Discuss this build">
        ${discussControlHtml(build, root)}
      </section>
    </aside>
  `;
}

/**
 * Notes body only (no heading) — Patch3 shade + ruled strip.
 * @param {string} text
 * @param {Map<string, object>} itemsById
 * @param {(item: object) => string} getSpriteUrl
 */
function howItWorksBlock(text, itemsById, getSpriteUrl) {
  if (!text) return '';
  const body = notesToHtml(text, itemsById, getSpriteUrl);
  if (!body) return '';
  return `
    <section class="build-info__section build-info__how" aria-label="Build description">
      <div class="build-info__how-body build-info__shade">
        <p class="build-info__how-text">${body}</p>
      </div>
    </section>
  `;
}

/**
 * Game BuildHistory StartingBag: class starting bag, not the first Bag on the late board.
 * @param {object} build
 * @param {Map<string, object>} itemsById
 * @param {object | null} [historyRun]
 */
function findBagItem(build, itemsById, historyRun = null) {
  const hero = String(build.hero_class || '');
  const startingIds = startingBagIdsForClass(hero);

  // Prefer stored loadout pick (may be sold off the final board)
  const explicit =
    build.starting_bag_id || build.bag_item_id || build.bag_id || null;
  if (explicit) {
    const item = itemsById.get(explicit);
    if (item) return item;
  }

  // Prefer class starting bag still on the board
  for (const id of startingIds) {
    if (placementHasItem(build, id)) {
      const item = itemsById.get(id);
      if (item) return item;
    }
  }

  // History round 1: first class starting bag (matches sold/replaced starters)
  if (historyRun?.rounds?.length) {
    const r1 = historyRun.rounds[0];
    for (const p of r1?.placements || []) {
      const id = p?.id;
      if (!id || !startingIds.includes(id)) continue;
      const item = itemsById.get(id);
      if (item) return item;
    }
  }

  // Any bag whose item.class matches the hero (e.g. leftover class bag)
  for (const p of build.placements || []) {
    const id = p.item?.id;
    if (!id) continue;
    const item = itemsById.get(id);
    if (!item || String(item.type || '') !== 'Bag') continue;
    if (String(item.class || '') === hero) return item;
  }

  // Universal starter if present
  if (placementHasItem(build, 'leather_bag')) {
    const item = itemsById.get('leather_bag');
    if (item) return item;
  }

  // Last resort: first bag on the board
  for (const p of build.placements || []) {
    const id = p.item?.id;
    if (!id) continue;
    const item = itemsById.get(id);
    if (item && String(item.type || '') === 'Bag') return item;
  }
  return null;
}

/** @param {object} build @param {string} itemId */
function placementHasItem(build, itemId) {
  return (build.placements || []).some((p) => p.item?.id === itemId);
}

/**
 * @param {object} build
 * @param {Map<string, object>} itemsById
 */
function essentialsByTier(build, itemsById) {
  /** @type {{ needed: object[], nice: object[], optional: object[] }} */
  const tiers = { needed: [], nice: [], optional: [] };
  const seen = { needed: new Set(), nice: new Set(), optional: new Set() };
  for (const p of build.placements || []) {
    const key = p.priority;
    if (key !== 'needed' && key !== 'nice' && key !== 'optional') continue;
    const item = itemsById.get(p.item?.id);
    if (!item || String(item.type || '') === 'Bag') continue;
    if (seen[key].has(item.id)) continue;
    seen[key].add(item.id);
    tiers[key].push(item);
  }
  return tiers;
}

/**
 * @param {string} label
 * @param {object[]} items
 * @param {(item: object) => string} getSpriteUrl
 * @param {string} [extraClass]
 */
function essentialsBlock(label, items, getSpriteUrl, extraClass = '') {
  const body = items.length
    ? `<ul class="build-info__list">${items
        .map((item) => {
          const src = getSpriteUrl(item);
          if (!src) return '';
          return `<li class="build-info__list-item" data-item-id="${escapeAttr(item.id)}">
            <img src="${escapeAttr(src)}" alt="${escapeAttr(item.name)}" />
          </li>`;
        })
        .join('')}</ul>`
    : `<p class="build-info__empty">—</p>`;

  const cls = ['build-info__tier', 'build-info__shade', extraClass].filter(Boolean).join(' ');
  return `
    <div class="${cls}" aria-label="${escapeAttr(label)}">
      <h4 class="build-info__tier-label build-info__ui-text">${escapeHtml(label)}</h4>
      ${body}
    </div>
  `;
}

/**
 * @param {string} label
 * @param {string} valueHtml
 * @param {string} [extraClass]
 */
function statBlock(label, valueHtml, extraClass = '') {
  const cls = ['build-info__tier', 'build-info__shade', 'build-info__stat', extraClass]
    .filter(Boolean)
    .join(' ');
  return `
    <div class="${cls}" aria-label="${escapeAttr(label)}">
      <h4 class="build-info__tier-label build-info__ui-text">${escapeHtml(label)}</h4>
      <p class="build-info__stat-value">${valueHtml}</p>
    </div>
  `;
}

/** Game league badge files under assets/icons/leagues/ */
const LEAGUE_ICONS = {
  bronze: 'League_Bronze.png',
  silver: 'League_Silver.png',
  gold: 'League_Gold.png',
  platinum: 'League_Platinum.png',
  diamond: 'League_Diamond.png',
  master: 'League_Master.png',
  grandmaster: 'League_Grandmaster.png',
  grandma: 'League_Grandma.png',
};

/**
 * @param {unknown} n
 * @param {string} root
 */
function formatGold(n, root) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '<span class="build-info__empty">—</span>';
  const icon = `${root}assets/tooltips/icons/Gold.png`;
  return `<span class="build-info__gold">
    <span class="build-info__gold-num build-info__ui-text">${escapeHtml(String(Math.round(v)))}</span>
    <img class="build-info__gold-icon" src="${escapeAttr(icon)}" alt="" width="28" height="28" aria-hidden="true" />
  </span>`;
}

/**
 * @param {unknown} rank
 * @param {string} root
 */
function formatRank(rank, root) {
  const key = String(rank ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  const file = LEAGUE_ICONS[key];
  if (!file) return '<span class="build-info__empty">—</span>';
  const label = titleCaseLeague(key);
  const src = `${root}assets/icons/leagues/${file}`;
  return `<img class="build-info__rank-icon" src="${escapeAttr(src)}" alt="${escapeAttr(label)}" title="${escapeAttr(label)}" width="56" height="56" />`;
}

/** @param {string} key */
function titleCaseLeague(key) {
  if (key === 'grandma') return 'Grandma';
  if (key === 'grandmaster') return 'Grandmaster';
  return key.charAt(0).toUpperCase() + key.slice(1);
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
