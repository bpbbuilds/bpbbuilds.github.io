/**
 * Homepage dark textured class showcase (VH “mobs” layout, our content).
 *
 *   import { initHomeClassShowcase } from './home-class-showcase.js';
 *   initHomeClassShowcase();
 */

import { HERO_CLASSES } from '../items/filter-logic.js';
import { CLASS_STARTING_BAG_IDS, startingBagIdsForClass } from '../../shared/starting-bags.js';
import { getSupabase } from '../../shared/supabase.js';
import { createTooltipHover } from '../../shared/tooltip-hover.js';
import { mapItem, makeSpriteUrl } from '../build/map-item.js';
import { classCharacterPath } from '../../shared/class-icons.js';
import { escapeAttr, escapeHtml, rootPrefix } from './home-build-media.js';
import { skelSection } from '../../shared/skeleton.js';

/** @type {Record<string, string>} */
const CLASS_BLURB = {
  Ranger:
    'Poison, pets, and piercing shots — board space that snowballs the longer the fight lasts.',
  Reaper:
    'Darkness, harvest, and draining trades. High risk boards that pay off when the grind sticks.',
  Pyromancer:
    'Heat stacks, burn loops, and explosive finishers. Light the bag and never let the tempo cool.',
  Berserker:
    'Stamina, rage, and raw damage. Aggressive layouts that want to hit first and hit often.',
  Mage: 'Mana engines, spells, and control. Set up the board, then cast your way through the ladder.',
  Adventurer:
    'Flexible bags and opportunistic crafts. A toolkit class that remixes whatever the shop offers.',
  Engineer:
    'Machines, gadgets, and packed synergies. Build the engine, then let the board do the work.',
};

const BAG_ITEM_SELECT =
  'id, gid, name, rarity, type, class, extra_types, tags, cost, effect, image, shape, sockets, accuracy, cooldown, stamina_cost, damage_min, damage_max, block, chance, chance_tag, params';

// Generated from the extracted game's RangerChibiSprite Idle AnimationPlayer;
// the admin test preset opts into it without changing the live Home surface.
const RANGER_IDLE_ASSET = 'assets/characters/char-ranger-idle.webp?v=60fps-480q76-20261013';
// VP9/WebM keeps the same transparent 60fps motion but lets Chromium/Edge use
// the media pipeline instead of decoding a 900-frame animated WebP on the
// main thread. The WebP remains the compatibility fallback.
const RANGER_IDLE_VIDEO_ASSET = 'assets/characters/char-ranger-idle.webm?v=60fps-vp9-20261013a';

/** @returns {string[]} */
function allStartingBagIds() {
  const ids = new Set();
  for (const list of Object.values(CLASS_STARTING_BAG_IDS)) {
    for (const id of list) ids.add(id);
  }
  return [...ids];
}

/**
 * @param {string} name
 */
function bagButtonsHtml(name) {
  const ids = startingBagIdsForClass(name);
  if (!ids.length) return '';
  const btns = ids
    .map(
      (id) => `
        <button
          type="button"
          class="home-mobs__bag"
          data-item-id="${escapeAttr(id)}"
          aria-label="Starting bag"
        >
          <span class="home-mobs__bag-skel" aria-hidden="true"></span>
        </button>`,
    )
    .join('');
  return `<div class="home-mobs__bags" role="group" aria-label="${escapeAttr(name)} starting bags">${btns}</div>`;
}

/**
 * @param {string} root
 */
function sectionHtml(root) {
  const cards = HERO_CLASSES.map((name) => {
    const blurb = CLASS_BLURB[name] || `Browse ${name} builds from the catalog.`;
    const href = `${root}builds/?class=${encodeURIComponent(name)}`;
    const art = classCharacterPath(root, name);
    const isRanger = name === 'Ranger';
    const idleArt = `${root}${RANGER_IDLE_ASSET}`;

    return `
      <article class="home-mobs__snap" data-home-mobs-card data-hero-class="${escapeAttr(name)}">
        <div class="home-mobs__card">
          <a class="home-mobs__portrait" href="${escapeAttr(href)}" tabindex="-1" aria-hidden="true">
            <span class="home-mobs__image">
              <img
                src="${escapeAttr(art)}"
                alt=""
                width="320"
                height="420"
                ${isRanger ? `data-ranger-static-src="${escapeAttr(art)}" data-ranger-idle-src="${escapeAttr(idleArt)}" data-ranger-image="static"` : ''}
                loading="lazy"
                decoding="async"
                draggable="false"
              />
              ${isRanger ? `
                <video
                  class="home-mobs__image-ranger-video"
                  data-ranger-video
                  data-ranger-video-src="${escapeAttr(`${root}${RANGER_IDLE_VIDEO_ASSET}`)}"
                  muted
                  loop
                  playsinline
                  preload="none"
                  aria-hidden="true"
                  hidden
                ></video>
              ` : ''}
            </span>
          </a>
          <div class="home-mobs__content">
            <a class="home-mobs__name-link" href="${escapeAttr(href)}">
              <span class="home-mobs__name">${escapeHtml(name)}</span>
            </a>
            <div class="home-mobs__collapsible-wrap">
              <div class="home-mobs__collapsible">
                <p class="home-mobs__desc">${escapeHtml(blurb)}</p>
                ${bagButtonsHtml(name)}
              </div>
            </div>
          </div>
        </div>
      </article>`;
  }).join('');

  return `
    <div class="home-mobs">
      <div class="home-mobs__band">
        <header class="home-mobs__header">
          <h2 class="home-mobs__title home-mobs__shade">Choose your hero</h2>
          <p class="home-mobs__subtitle home-mobs__shade">
            Each class brings its own bag, synergies, and broken boards. Scroll the row, then jump into builds for the hero you play.
          </p>
        </header>
        <div class="home-mobs__cards" data-home-mobs-rail>
          ${cards}
        </div>
      </div>
    </div>`;
}

/**
 * @param {HTMLElement} host
 */
function bindRail(host) {
  const rail = host.querySelector('[data-home-mobs-rail]');
  if (!rail) return;

  requestAnimationFrame(() => {
    rail.scrollLeft = (rail.scrollWidth - rail.clientWidth) / 2;
  });

  rail.addEventListener('click', (ev) => {
    if (!(ev.target instanceof Element)) return;
    if (ev.target.closest('.home-mobs__bag')) return;
    const card = /** @type {HTMLElement | null} */ (
      ev.target.closest('[data-home-mobs-card]')
    );
    if (!card || !rail.contains(card)) return;

    const link = card.querySelector('.home-mobs__name-link');
    if (!(link instanceof HTMLAnchorElement) || !link.href) return;

    // Portrait / name links already navigate; card chrome should too.
    if (ev.target.closest('a[href]')) return;
    window.location.assign(link.href);
  });
}

/**
 * @param {HTMLElement} host
 * @param {string} root
 */
async function hydrateBags(host, root) {
  const ids = allStartingBagIds();
  if (!ids.length) return false;

  const base = root.endsWith('/') ? root : `${root}/`;
  let spriteDisplay = null;
  try {
    const res = await fetch(`${base}assets/data/sprite-display.json`);
    if (res.ok) spriteDisplay = await res.json();
  } catch {
    /* optional */
  }

  const { data, error } = await getSupabase()
    .from('items')
    .select(BAG_ITEM_SELECT)
    .in('id', ids);

  if (error) {
    console.warn('[home-class-showcase] bag fetch failed', error);
    return false;
  }

  const getSpriteUrl = makeSpriteUrl(base, spriteDisplay);
  /** @type {Map<string, object>} */
  const byId = new Map();
  for (const row of data || []) {
    const item = mapItem(row);
    if (!item?.id) continue;
    getSpriteUrl(item);
    byId.set(String(item.id), item);
  }

  host.querySelectorAll('.home-mobs__bag[data-item-id]').forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const id = btn.dataset.itemId || '';
    const item = byId.get(id);
    if (!item) return;
    const name = String(item.name || id);
    btn.setAttribute('aria-label', name);
    btn.title = name;
    const skel = btn.querySelector('.home-mobs__bag-skel');
    skel?.remove();
    const img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 68;
    img.height = 68;
    const fullSprite = getSpriteUrl(item) || '';
    // Starting-bag buttons are thumbnail-sized; avoid downloading the full
    // source PNG when the catalog already includes a compact WebP derivative.
    img.src = fullSprite
      .replace('/assets/item-sprites/', '/assets/item-thumbs/1x/')
      .replace(/\.png(?:\?.*)?$/i, '.webp');
    img.addEventListener('error', () => {
      if (img.src === fullSprite) return;
      img.src = fullSprite;
    }, { once: true });
    btn.append(img);
  });

  const tip = createTooltipHover();
  tip.bind(host, {
    selector: '.home-mobs__bag[data-item-id]',
    getItem: (el) => {
      if (!(el instanceof HTMLElement)) return null;
      return byId.get(el.dataset.itemId || '') || null;
    },
    place: 'near',
  });
  return true;
}

/** @param {HTMLElement} host @param {boolean} ready */
function settleSectionSkeleton(host, ready) {
  const region = host.querySelector('.home-mobs__section-skeleton')?.closest('.bpb-skel-region');
  if (!(region instanceof HTMLElement)) return;
  if (ready) {
    region.remove();
    return;
  }
  region.setAttribute('aria-busy', 'false');
  region.innerHTML = '<p class="home-mobs__section-status">Starting bags are unavailable right now.</p>';
}

/**
 * @param {string | Element} [selector='#home-class-showcase']
 * @returns {{ setRangerAnimation: (enabled: boolean) => boolean } | undefined}
 */
export function initHomeClassShowcase(selector = '#home-class-showcase') {
  const host =
    typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!host) return;

  const root = rootPrefix();
  host.innerHTML = `${sectionHtml(root)}${skelSection({
    className: 'home-mobs__section-skeleton',
    label: 'Loading hero classes',
  })}`;

  /**
   * Swap only the Ranger card between the normal composite sprite and the
   * game-extracted animated media. The optional test preset owns this switch;
   * the live Home caller leaves it disabled. VP9/WebM is preferred when the
   * browser can play it; the animated WebP remains a compatibility fallback.
   * @param {boolean} enabled
   */
  const setRangerAnimation = (enabled) => {
    const image = host.querySelector('[data-ranger-image]');
    if (!(image instanceof HTMLImageElement)) return false;
    const video = host.querySelector('[data-ranger-video]');
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    const active = enabled === true && !reduced;
    const next = active ? image.dataset.rangerIdleSrc : image.dataset.rangerStaticSrc;
    if (!next) return false;

    if (!active) {
      if (video instanceof HTMLVideoElement) {
        video.pause();
        video.currentTime = 0;
        video.hidden = true;
      }
      image.hidden = false;
      if (image.getAttribute('src') !== next) image.setAttribute('src', next);
      image.dataset.rangerImage = 'static';
      host.dataset.rangerAnimated = 'false';
      return false;
    }

    const videoSrc = video instanceof HTMLVideoElement
      ? video.dataset.rangerVideoSrc
      : '';
    const canUseVideo = video instanceof HTMLVideoElement
      && Boolean(videoSrc)
      && Boolean(video.canPlayType('video/webm; codecs="vp9"'));
    image.dataset.rangerImage = 'idle';
    host.dataset.rangerAnimated = 'true';

    if (canUseVideo) {
      if (video.getAttribute('src') !== videoSrc) {
        video.setAttribute('src', videoSrc);
        video.load();
      }
      const startVideo = () => {
        if (host.dataset.rangerAnimated !== 'true') return;
        image.hidden = true;
        video.hidden = false;
        video.currentTime = 0;
        const playResult = video.play();
        playResult?.catch(() => {
          // Autoplay can still be denied by an embedding policy. Keep the
          // tested WebP fallback visible instead of leaving the card blank.
          video.pause();
          video.hidden = true;
          image.hidden = false;
          if (image.getAttribute('src') !== next) image.setAttribute('src', next);
        });
      };
      // Keep the already-visible static sprite until the first video frame is ready;
      // this avoids a blank flash while the media decoder warms up.
      video.hidden = true;
      image.hidden = false;
      if (video.readyState >= 2) startVideo();
      else video.addEventListener('canplay', startVideo, { once: true });
    } else {
      image.hidden = false;
      if (image.getAttribute('src') !== next) image.setAttribute('src', next);
      if (video instanceof HTMLVideoElement) video.hidden = true;
    }

    return active;
  };

  setRangerAnimation(false);
  bindRail(host);
  void hydrateBags(host, root).then((ready) => settleSectionSkeleton(host, ready));
  return { setRangerAnimation };
}
