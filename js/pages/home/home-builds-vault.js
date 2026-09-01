/**
 * Homepage builds vault — centered VH “Vault Gear” layout with live backpack thumbs.
 *
 *   import { initHomeBuildsVault } from './home-builds-vault.js';
 *   initHomeBuildsVault();
 */

import { getSupabase } from '../../shared/supabase.js';
import { mountPlacedGrid } from '../../shared/backpack-grid/index.js';
import { classIconPath } from '../../shared/class-icons.js';
import { skelBlock, skelRegion } from '../../shared/skeleton.js';
import {
  mapItem,
  makeSpriteUrl,
  applyShapes,
  applySocketOffsets,
} from '../build/map-item.js';
import {
  bindMoreBuildTips,
  registerMoreBuildTip,
} from '../build/more-build-tip.js';
import {
  buildViewHref,
  escapeAttr,
  escapeHtml,
  rootPrefix,
} from './home-build-media.js';
import { normalizePromoBuild } from './home-promo-caption.js';

const GRID_TARGET = 16;
const BOARD_COLS = 9;
const BOARD_ROWS = 7;
/** Large mini boards for the vault marquee (9×22 was tight; bump cell size). */
const THUMB_CELL_PX = 28;

const ITEM_SELECT =
  'id, gid, name, rarity, type, class, extra_types, tags, cost, effect, image, shape, sockets, accuracy, cooldown, stamina_cost, damage_min, damage_max, block, chance, chance_tag, params';

const LABEL_TONES = [
  'rose',
  'gold',
  'mist',
  'lime',
  'mint',
  'sky',
  'amber',
  'lilac',
];

/**
 * Prefer OP/featured, then fill with other public builds that have placements.
 * @returns {Promise<object[]>}
 */
async function fetchVaultBuilds() {
  const supabase = getSupabase();
  const select = `
    id, slug, title, hero_class, is_op, is_featured, updated_at,
    gold_count, rank, author_name, author_id,
    profile:profiles!builds_author_id_fkey (
      discord_id, display_name, avatar_url
    ),
    placements:build_placements (
      id, x, y, r, gems, priority,
      item:items ( ${ITEM_SELECT} )
    )
  `;

  const { data: featured, error: featErr } = await supabase
    .from('builds')
    .select(select)
    .eq('is_public', true)
    .or('is_op.eq.true,is_featured.eq.true')
    .order('updated_at', { ascending: false })
    .limit(GRID_TARGET);

  if (featErr) throw featErr;

  /** @type {object[]} */
  const list = (featured || []).filter((b) => (b.placements || []).length);
  const seen = new Set(list.map((b) => b.id));

  if (list.length < GRID_TARGET) {
    const { data: more, error: moreErr } = await supabase
      .from('builds')
      .select(select)
      .eq('is_public', true)
      .order('updated_at', { ascending: false })
      .limit(GRID_TARGET * 2);

    if (moreErr) throw moreErr;
    for (const b of more || []) {
      if (seen.has(b.id)) continue;
      if (!(b.placements || []).length) continue;
      list.push(b);
      seen.add(b.id);
      if (list.length >= GRID_TARGET) break;
    }
  }

  return list.slice(0, GRID_TARGET).map(normalizePromoBuild);
}

/**
 * @param {object} build
 * @param {{
 *   shapes?: object | null,
 *   sockets?: object | null,
 *   getSpriteUrl: (item: object) => string,
 * }} opts
 */
function placementsForBuild(build, opts) {
  /** @type {Map<string, object>} */
  const itemsById = new Map();
  const items = [];
  const placements = [];

  for (const [i, p] of (build.placements || []).entries()) {
    const item = mapItem(p.item);
    if (!item?.id) continue;
    items.push(item);
    itemsById.set(item.id, item);
    placements.push({
      id: item.id,
      x: Number(p.x) || 0,
      y: Number(p.y) || 0,
      r: Number(p.r) || 0,
      key: String(p.id ?? `${item.id}:${i}:${p.x},${p.y}:${p.r || 0}`),
      gems: Array.isArray(p.gems) ? p.gems : undefined,
    });
  }

  applyShapes(items, opts.shapes || null);
  applySocketOffsets(items, opts.sockets || null);
  for (const item of items) opts.getSpriteUrl(item);

  return { placements, itemsById };
}

/**
 * @param {object} build
 * @param {string} root
 * @param {string} name
 */
function resolveVaultAvatar(build, root, name) {
  const custom = String(build?.author_avatar_url || '').trim();
  if (custom) return { src: custom, initials: '' };
  if (/^smojo$/i.test(name)) {
    return {
      src: `${root}assets/brand/logo-backpack-battles-builds.png`,
      initials: '',
    };
  }
  const parts = name.split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  return { src: '', initials: initials || '?' };
}

/**
 * @param {object} build
 * @param {string} root
 * @param {number} index
 */
function gridCellHtml(build, root, index) {
  const slug = String(build.slug || '').trim();
  const href = buildViewHref(slug, root);
  const title = String(build.title || 'Untitled');
  const tone = LABEL_TONES[index % LABEL_TONES.length];
  const icon = classIconPath(root, build.hero_class);
  const hero = String(build.hero_class || '').trim();
  const author = String(build.author_name || 'Unknown').trim() || 'Unknown';
  const avatar = resolveVaultAvatar(build, root, author);

  const avatarInner = avatar.src
    ? `<img class="home-vault__cell-avatar" src="${escapeAttr(avatar.src)}" alt="" width="22" height="22" draggable="false" />`
    : `<span class="home-vault__cell-avatar home-vault__cell-avatar--initials" aria-hidden="true">${escapeHtml(avatar.initials)}</span>`;

  return `
    <a
      class="home-vault__cell"
      href="${escapeAttr(href)}"
      data-vault-build-tip
      data-build-slug="${escapeAttr(slug)}"
    >
      <span class="home-vault__cell-media">
        <span
          class="home-vault__board"
          data-vault-board="${escapeAttr(slug)}"
          aria-hidden="true"
        ></span>
      </span>
      <span class="home-vault__cell-label home-vault__cell-label--${escapeAttr(tone)}">
        ${
          icon
            ? `<img class="home-vault__cell-class" src="${escapeAttr(icon)}" alt="" title="${escapeAttr(hero)}" width="20" height="20" />`
            : ''
        }
        <span class="home-vault__cell-name">${escapeHtml(title)}</span>
      </span>
      <span class="home-vault__cell-author">
        ${avatarInner}
        <span class="home-vault__cell-author-name">${escapeHtml(author)}</span>
      </span>
    </a>`;
}

/**
 * One marquee row — content duplicated for a seamless loop.
 * @param {object[]} builds
 * @param {string} root
 * @param {number} indexOffset
 * @param {'left' | 'right'} dir
 */
function marqueeRowHtml(builds, root, indexOffset, dir) {
  if (!builds.length) return '';
  const cells = builds
    .map((b, i) => gridCellHtml(b, root, indexOffset + i))
    .join('');
  // Two equal groups (padding-right = gap) so translateX(-50%) is seamless.
  return `
    <div class="home-vault__row home-vault__row--${dir}" data-vault-row>
      <div class="home-vault__track">
        <div class="home-vault__group">${cells}</div>
        <div class="home-vault__group" aria-hidden="true">${cells}</div>
      </div>
    </div>`;
}

/**
 * @param {string} root
 * @param {object[]} builds
 */
function sectionHtml(root, builds) {
  const opHref = `${root}builds/?tags=op`;
  const catalog = `${root}builds/`;
  const mid = Math.ceil(builds.length / 2) || 1;
  const top = builds.slice(0, mid);
  const bottom = builds.slice(mid);
  // Keep both rows populated even with a short list
  const topRow = top.length ? top : builds;
  const bottomRow = bottom.length ? bottom : builds;

  return `
    <div class="home-vault">
      <div class="home-vault__band">
        <div class="home-vault__inner">
          <h2 class="home-vault__title home-vault__shade">Curated build loadouts</h2>
          <p class="home-vault__lede home-vault__shade">
            Every featured board is a full loadout: route, backpack, and guide video.
            Mix the pieces, steal the synergies, and craft the run that climbs the ladder.
          </p>
          <div class="home-vault__marquee" data-vault-marquee aria-label="Featured build boards">
            ${marqueeRowHtml(topRow, root, 0, 'left')}
            ${marqueeRowHtml(bottomRow, root, topRow.length, 'right')}
          </div>
          <div class="home-vault__actions">
            <a class="home-vault__cta home-vault__cta--op" href="${escapeAttr(opHref)}">
              <span>Browse OP builds</span>
            </a>
            <a class="home-vault__cta home-vault__cta--catalog" href="${escapeAttr(catalog)}">
              <img
                class="home-vault__cta-icon"
                src="${escapeAttr(`${root}assets/icons/misc/Backpack_icon.png`)}"
                alt=""
                width="20"
                height="20"
                draggable="false"
              />
              <span>Explore the catalog</span>
            </a>
          </div>
          <p class="home-vault__footnote">Browse every featured board in the catalog</p>
        </div>
      </div>
    </div>`;
}

function skeletonHtml() {
  const skelCell = `
    <div class="home-vault__cell home-vault__cell--skel" aria-hidden="true">
      ${skelBlock({ className: 'home-vault__skel-media', width: '16.5rem', height: '12.9rem', radius: '0.55rem' })}
      ${skelBlock({ className: 'home-vault__skel-label', width: '8rem', height: '0.7rem', radius: '0.2rem' })}
      ${skelBlock({ className: 'home-vault__skel-author', width: '5.5rem', height: '0.65rem', radius: '0.2rem' })}
    </div>`;
  const group = `<div class="home-vault__group">${Array.from({ length: 6 }, () => skelCell).join('')}</div>`;

  return skelRegion(
    `
    <div class="home-vault">
      <div class="home-vault__band">
        <div class="home-vault__inner">
          <h2 class="home-vault__title home-vault__shade">Curated build loadouts</h2>
          <p class="home-vault__lede home-vault__shade">
            Every featured board is a full loadout: route, backpack, and guide video.
            Mix the pieces, steal the synergies, and craft the run that climbs the ladder.
          </p>
          <div class="home-vault__marquee">
            <div class="home-vault__row home-vault__row--left">
              <div class="home-vault__track">${group}${group}</div>
            </div>
            <div class="home-vault__row home-vault__row--right">
              <div class="home-vault__track">${group}${group}</div>
            </div>
          </div>
        </div>
      </div>
    </div>`,
    { label: 'Loading builds' },
  );
}

/**
 * @param {string} root
 */
async function loadAssetExtras(root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const [shapesRes, socketsRes, spriteRes] = await Promise.all([
    fetch(`${base}assets/data/item-shapes.json`).catch(() => null),
    fetch(`${base}assets/data/socket-offsets.json`).catch(() => null),
    fetch(`${base}assets/data/sprite-display.json`).catch(() => null),
  ]);
  return {
    shapes: shapesRes?.ok ? await shapesRes.json() : null,
    sockets: socketsRes?.ok ? await socketsRes.json() : null,
    spriteDisplay: spriteRes?.ok ? await spriteRes.json() : null,
  };
}

/**
 * @param {HTMLElement} host
 * @param {object[]} builds
 * @param {string} root
 * @returns {Promise<() => void>}
 */
async function mountBoards(host, builds, root) {
  const extras = await loadAssetExtras(root);
  const getSpriteUrl = makeSpriteUrl(root, extras.spriteDisplay);
  const bySlug = new Map(builds.map((b) => [String(b.slug || ''), b]));
  /** @type {Map<string, object>} */
  const tipItemsById = new Map();

  host.querySelectorAll('[data-vault-board]').forEach((boardHost) => {
    if (!(boardHost instanceof HTMLElement)) return;
    const slug = boardHost.getAttribute('data-vault-board') || '';
    const build = bySlug.get(slug);
    if (!build) return;

    const { placements, itemsById } = placementsForBuild(build, {
      shapes: extras.shapes,
      sockets: extras.sockets,
      getSpriteUrl,
    });
    if (!placements.length) {
      boardHost.innerHTML = `<span class="home-vault__board-empty">Empty</span>`;
      return;
    }

    for (const [id, item] of itemsById) tipItemsById.set(id, item);

    boardHost.replaceChildren();
    mountPlacedGrid(boardHost, {
      placements,
      itemsById,
      cols: BOARD_COLS,
      rows: BOARD_ROWS,
      getSpriteUrl,
      fillWidth: false,
      exactBoard: true,
      reserveScrollGap: false,
      cellPx: THUMB_CELL_PX,
    });
    const bg = boardHost.querySelector(':scope > .bpb-bg');
    if (bg instanceof HTMLElement) {
      bg.classList.add('bpb-bg--feed-thumb');
      bg.style.overflow = 'visible';
      bg.style.maxHeight = 'none';
      bg.style.setProperty('--bpb-bg-scroll-gap', '0px');
    }

    const tipEl = boardHost.closest('[data-vault-build-tip]');
    if (tipEl instanceof HTMLElement) {
      registerMoreBuildTip(tipEl, build, placements);
    }
  });

  const marquee = host.querySelector('[data-vault-marquee]');
  if (!(marquee instanceof HTMLElement)) return () => {};

  return bindMoreBuildTips(marquee, {
    itemsById: tipItemsById,
    getSpriteUrl,
    root,
    overEl: null,
    thumbSelector: '[data-vault-build-tip]',
  });
}

/** Keep footer on body (full-bleed under screen frame) — never nest in vault. */
function parkHomeFooter() {
  const footerHost = document.getElementById('site-footer');
  if (footerHost && footerHost.parentElement !== document.body) {
    document.body.appendChild(footerHost);
  }
}

/**
 * @param {HTMLElement} host
 * @param {string} html
 */
function paintVault(host, html) {
  parkHomeFooter();
  host.innerHTML = html;
  parkHomeFooter();
}

/**
 * @param {string | Element} [selector='#home-builds-vault']
 */
export async function initHomeBuildsVault(selector = '#home-builds-vault') {
  const host =
    typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!host) return;

  const root = rootPrefix();
  paintVault(host, skeletonHtml());

  try {
    const builds = await fetchVaultBuilds();
    if (!builds.length) {
      paintVault(
        host,
        `
        <div class="home-vault">
          <div class="home-vault__band">
            <div class="home-vault__inner">
              <h2 class="home-vault__title home-vault__shade">Curated build loadouts</h2>
              <p class="home-vault__lede home-vault__shade">
                Featured boards land here as they ship: full backpacks you can open and remix.
              </p>
              <a class="home-vault__cta home-vault__cta--catalog" href="${escapeAttr(`${root}builds/`)}">
                <img
                  class="home-vault__cta-icon"
                  src="${escapeAttr(`${root}assets/icons/misc/Backpack_icon.png`)}"
                  alt=""
                  width="20"
                  height="20"
                  draggable="false"
                />
                <span>Explore the catalog</span>
              </a>
            </div>
          </div>
        </div>`,
      );
      return;
    }
    paintVault(host, sectionHtml(root, builds));
    await mountBoards(host, builds, root);
    // Tips stay bound until next init / navigation (static homepage section).
  } catch (err) {
    console.error('[home] builds vault failed', err);
    paintVault(
      host,
      `
      <div class="home-vault">
        <div class="home-vault__band">
          <div class="home-vault__inner">
            <h2 class="home-vault__title home-vault__shade">Curated build loadouts</h2>
            <p class="home-vault__lede home-vault__shade">Could not load builds right now.</p>
            <a class="home-vault__cta home-vault__cta--catalog" href="${escapeAttr(`${root}builds/`)}">
              <img
                class="home-vault__cta-icon"
                src="${escapeAttr(`${root}assets/icons/misc/Backpack_icon.png`)}"
                alt=""
                width="20"
                height="20"
                draggable="false"
              />
              <span>Explore the catalog</span>
            </a>
          </div>
        </div>
      </div>`,
    );
  }
}
