/**
 * Combat board chrome: card face-down → reveal,
 * cooldown fill (Item.showCooldown + Shader/ItemProgress.gdshader).
 */

import { COMBAT_DELAY } from '../engine/simulate.js';
import { visualStateAt, visualVariantFor } from '../engine/visual-state.js';
import { setPotionLevel } from '../../../shared/item-live-art/index.js';

const CARD_BACK_FILE = {
  common: 'Cardback_common.png',
  rare: 'Cardback_rare.png',
  epic: 'Cardback_epic.png',
  legendary: 'Cardback_legendary.png',
  godly: 'Cardback_godly.png',
  unique: 'Cardback.png',
};

/**
 * Live you/opp bags only. Public-build thumbs share `.sim-field` + placement keys.
 * @param {ParentNode | null | undefined} root
 * @returns {NodeListOf<Element> | HTMLElement[]}
 */
export function queryLiveBagItems(root) {
  if (!(root instanceof Element)) return [];
  const bags = root.querySelectorAll('.sim-field__bag .bpb-bg__item');
  if (bags.length) return bags;
  return [...root.querySelectorAll('.bpb-bg__item')].filter(
    (n) => n instanceof HTMLElement && !n.closest('[data-sim-build-browser]'),
  );
}

/**
 * @param {ParentNode | null | undefined} root
 * @param {string | null | undefined} placementKey
 * @returns {HTMLElement | null}
 */
export function queryLivePlacement(root, placementKey) {
  if (!(root instanceof Element) || !placementKey) return null;
  const sel = `[data-placement-key="${CSS.escape(placementKey)}"]`;
  const inBag = root.querySelector(`.sim-field__bag ${sel}`);
  if (inBag instanceof HTMLElement) return inBag;
  const el = root.querySelector(sel);
  if (el instanceof HTMLElement && !el.closest('[data-sim-build-browser]')) {
    return el;
  }
  return null;
}

/**
 * @param {HTMLElement} el
 */
function isCardEl(el) {
  const type = String(el.dataset.itemType || '').toLowerCase();
  if (type === 'card') return true;
  const extra = String(el.dataset.extraTypes || '').toLowerCase();
  return extra.split(',').some((x) => x.trim() === 'card');
}

/**
 * @param {HTMLElement} el
 * @param {string} root
 */
function cardBackUrl(el, root) {
  const rarity = String(el.dataset.rarity || 'common').toLowerCase();
  const file = CARD_BACK_FILE[rarity] || CARD_BACK_FILE.common;
  const base = root.endsWith('/') ? root : `${root}/`;
  return `${base}assets/item-sprites/${file}`;
}

/**
 * @param {HTMLElement} el
 * @returns {HTMLImageElement[]}
 */
function itemSprites(el) {
  return [...el.querySelectorAll('img.bpb-bg__sprite, img.bpb-live__base')].filter(
    (n) => n instanceof HTMLImageElement,
  );
}

/**
 * Still sprite or live flask/base — same pixels ItemProgress shades.
 * @param {HTMLElement} el
 * @returns {HTMLImageElement | null}
 */
function spriteArtEl(el) {
  const live = el.querySelector('.bpb-live');
  if (live) {
    const layer = live.querySelector(
      'img.bpb-live__flask, img.bpb-live__base, img.bpb-live__layer',
    );
    if (layer instanceof HTMLImageElement) return layer;
  }
  const sprite = el.querySelector(
    'img.bpb-bg__sprite:not(.bpb-bg__sprite--shadow)',
  );
  return sprite instanceof HTMLImageElement ? sprite : null;
}

/**
 * @param {HTMLImageElement | null | undefined} img
 */
function artUrl(img) {
  if (!(img instanceof HTMLImageElement)) return '';
  return img.currentSrc || img.getAttribute('src') || img.dataset.src || '';
}

/**
 * @param {HTMLElement} cd
 * @param {string} url
 */
function setCdArt(cd, url) {
  cd.style.backgroundImage = url ? `url(${JSON.stringify(url)})` : 'none';
}

/**
 * @param {{
 *   boardEl: HTMLElement | null,
 *   run: import('../../sim-events.js').SimRun,
 *   assetRoot?: string,
 * }} opts
 */
export function createSimItemChrome(opts) {
  /** @type {WeakMap<HTMLElement, { cd: HTMLElement, frontSrc: string, art: string, visualState?: string | null, originalSprites: Array<{ img: HTMLImageElement, src: string | null, dataSrc: string | null }> }>} */
  const layers = new WeakMap();
  /** @type {HTMLElement[]} */
  const attached = [];
  let lastT = 0;
  /** @type {number[]} */
  const timers = [];
  /** @type {Map<string, number>} */
  const consumeTimes = new Map();
  for (const ev of opts.run.events || []) {
    if (ev?.type !== 'activate' || !ev.meta?.consume || !ev.placementKey) continue;
    const at = Number(ev.t);
    if (!Number.isFinite(at)) continue;
    const previous = consumeTimes.get(ev.placementKey);
    if (previous == null || at < previous) consumeTimes.set(ev.placementKey, at);
  }

  function reduced() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  }

  /** @param {HTMLElement} el */
  function ensure(el) {
    let pack = layers.get(el);
    if (pack) return pack;
    const spin = el.querySelector('.bpb-bg__spin:not(.bpb-bg__spin--shadow)');
    const hit =
      spin instanceof HTMLElement ? spin.querySelector('.bpb-bg__hit') : null;
    const spriteHost = hit instanceof HTMLElement ? hit : el;
    const liveWrap = spriteHost.querySelector('.bpb-live');
    const sprite = spriteHost.querySelector(
      'img.bpb-bg__sprite:not(.bpb-bg__sprite--shadow)',
    );

    const cd = document.createElement('span');
    cd.className = 'sim-cd-shade';
    cd.setAttribute('aria-hidden', 'true');
    if (liveWrap instanceof HTMLElement) {
      cd.classList.add('sim-cd-shade--live');
      const above = liveWrap.querySelector(
        '.bpb-live__overlay, .bpb-live__glow, .bpb-live__holo',
      );
      if (above) liveWrap.insertBefore(cd, above);
      else liveWrap.appendChild(cd);
    } else {
      if (sprite instanceof HTMLElement) {
        cd.style.cssText = sprite.getAttribute('style') || '';
        if (!cd.style.width || !cd.style.height) {
          const box = getComputedStyle(sprite);
          cd.style.width = box.width;
          cd.style.height = box.height;
        }
      }
      spriteHost.appendChild(cd);
    }
    const art = artUrl(spriteArtEl(el));
    if (art) setCdArt(cd, art);

    const front = sprite instanceof HTMLImageElement
      ? sprite.getAttribute('src') || sprite.dataset.src || ''
      : art;
    const originalSprites = itemSprites(el).map((img) => ({
      img,
      src: img.getAttribute('src'),
      dataSrc: img.getAttribute('data-src'),
    }));
    pack = { cd, frontSrc: front, art, originalSprites };
    layers.set(el, pack);
    attached.push(el);
    return pack;
  }

  /**
   * Catalog face → `{stem}_active.png` when Card.cardSecondaryEffectActive.
   * @param {string} front
   * @param {boolean} secondary
   */
  function faceUrl(front, secondary) {
    if (!front || !secondary) return front;
    return front.replace(/(\.[a-z0-9]+)(?:[?#].*)?$/i, '_active$1');
  }

  /**
   * Same Icon node as the game (setTexture) — keeps card-back on the sprite box.
   * @param {HTMLElement} el
   * @param {boolean} faceUp
   * @param {boolean} [secondaryActive]
   */
  function applyCardArt(el, faceUp, secondaryActive) {
    const pack = layers.get(el);
    const back = cardBackUrl(el, opts.assetRoot || '../');
    let maskSrc = back;
    for (const img of itemSprites(el)) {
      if (!img.dataset.frontSrc) {
        img.dataset.frontSrc = img.getAttribute('src') || img.dataset.src || '';
      }
      const def = img.dataset.frontSrc;
      const next = faceUp ? faceUrl(def, !!secondaryActive) : back;
      if (next && img.getAttribute('src') !== next) {
        if (faceUp && secondaryActive && next !== def) {
          img.onerror = () => {
            img.onerror = null;
            if (def) img.src = def;
          };
        } else {
          img.onerror = null;
        }
        img.src = next;
      }
      if (faceUp) maskSrc = next || def || back;
    }
    if (pack) {
      pack.art = maskSrc;
      setCdArt(pack.cd, maskSrc);
    }
  }

  /**
   * Game `setTexture` also updates the shadow texture. Mirror that persistent
   * state on every item sprite, then keep the cooldown shade on the same art.
   * @param {HTMLElement} el
   * @param {string | null} state
   */
  function applyVisualArt(el, state) {
    const pack = layers.get(el);
    if (!pack || isCardEl(el)) return;
    if (pack.visualState === state) return;
    pack.visualState = state;
    const file = visualVariantFor(el.dataset.itemId || '', state);
    const root = opts.assetRoot || '../';
    const base = root.endsWith('/') ? root : `${root}/`;
    const src = file ? `${base}assets/item-sprites/${file}` : null;
    for (const original of pack.originalSprites) {
      const img = original.img;
      if (!img.isConnected) continue;
      if (src) {
        img.src = src;
        img.removeAttribute('data-src');
      } else {
        if (original.src == null) img.removeAttribute('src');
        else img.setAttribute('src', original.src);
        if (original.dataSrc == null) img.removeAttribute('data-src');
        else img.setAttribute('data-src', original.dataSrc);
      }
    }
    const art = artUrl(spriteArtEl(el));
    if (art && art !== pack.art) {
      pack.art = art;
      setCdArt(pack.cd, art);
    }
  }

  /**
   * @param {import('../../sim-events.js').SimEvent[] | undefined} events
   * @param {string} key
   * @returns {number | null}
   */
  function consumedAt(events, key) {
    void events;
    return consumeTimes.get(key) ?? null;
  }

  /**
   * @param {import('../../sim-events.js').SimRun['pieceSnapshots']} snaps
   * @param {number} t
   * @param {string} key
   */
  function liveAt(snaps, t, key) {
    if (!key || !Array.isArray(snaps) || !snaps.length) return null;
    let prev = null;
    for (const s of snaps) {
      if (s.t <= t + 1e-6) prev = s;
      else break;
    }
    const rec = prev?.byKey?.[key];
    if (!rec) return null;
    const loopCd = Number(rec.loopCd) || Number(rec.cooldown) || 0;
    let trig = Number(rec.triggerTime);
    if (!Number.isFinite(trig)) trig = loopCd;
    const dt = Math.max(0, t - (prev?.t || 0));
    if (loopCd > 0 && loopCd < 500 && trig < 500) {
      // Snapshots store wall-clock remaining; bleed down between snaps.
      trig = Math.max(0, trig - dt);
    }
    return { ...rec, triggerTime: trig, loopCd, cooldown: rec.cooldown };
  }

  /**
   * Fill hits 1.0 at the next real activate. `on` stays true at 0% so the
   * shader's +0.05 strip still paints (Item.showCooldown(0) is the only off).
   * @param {object | null} live
   * @param {number} t
   * @param {import('../../sim-events.js').SimEvent[] | undefined} events
   * @param {string} key
   * @returns {{ on: boolean, fill: number }}
   */
  function cdFill(live, t, events, key) {
    if (!live) return { on: false, fill: 0 };
    if (t + 1e-6 < COMBAT_DELAY) return { on: false, fill: 0 };
    const period = Number(live.loopCd) || Number(live.cooldown) || 0;
    const trig = Number(live.triggerTime);
    if (!(period > 0) || period >= 500 || !Number.isFinite(trig) || trig >= 500) {
      return { on: false, fill: 0 };
    }
    if (live.kind === 'card' && !live.revealing) return { on: false, fill: 0 };

    // Prefer wall-clock span between activates (order-safe min/max). Skip
    // combat-start-only arms so the first real CD cycle still starts at delay.
    let armedAt = COMBAT_DELAY;
    let nextAt = null;
    if (key && Array.isArray(events)) {
      let latestPast = -Infinity;
      let earliestFuture = Infinity;
      for (const ev of events) {
        if (ev.placementKey !== key || ev.type !== 'activate') continue;
        if (ev.actor === 'dummy' && !String(key).startsWith('opp:')) continue;
        if (ev.meta?.miniActivate) continue;
        if (ev.meta?.combatStart) continue;
        const et = Number(ev.t);
        if (!Number.isFinite(et)) continue;
        if (et <= t + 1e-4) {
          if (et >= latestPast) latestPast = et;
        } else if (et < earliestFuture) {
          earliestFuture = et;
        }
      }
      if (Number.isFinite(latestPast) && latestPast > -Infinity) armedAt = latestPast;
      if (Number.isFinite(earliestFuture) && earliestFuture < Infinity) nextAt = earliestFuture;
    }
    let fill = 0;
    if (nextAt != null && nextAt > armedAt) {
      fill = Math.max(0, Math.min(1, (t - armedAt) / (nextAt - armedAt)));
    } else {
      fill = Math.max(0, Math.min(1, 1 - trig / period));
    }
    return { on: true, fill };
  }

  /**
   * @param {HTMLElement} el
   * @param {boolean} faceUp
   * @param {boolean} animate
   */
  function setRevealed(el, faceUp, animate, secondaryActive) {
    const isUp = el.classList.contains('sim-card--revealed');
    if (faceUp === isUp) {
      applyCardArt(el, faceUp, secondaryActive);
      return;
    }
    if (!faceUp) {
      el.classList.remove('sim-card--revealed', 'sim-card--flip');
      applyCardArt(el, false, secondaryActive);
      return;
    }
    if (animate && !reduced()) {
      el.classList.add('sim-card--flip');
      const mid = window.setTimeout(() => {
        el.classList.add('sim-card--revealed');
        applyCardArt(el, true, secondaryActive);
      }, 150);
      const end = window.setTimeout(() => {
        el.classList.remove('sim-card--flip');
      }, 320);
      timers.push(mid, end);
      return;
    }
    el.classList.add('sim-card--revealed');
    el.classList.remove('sim-card--flip');
    applyCardArt(el, true, secondaryActive);
  }

  /**
   * @param {number} t
   */
  function seek(t) {
    const board = opts.boardEl;
    const snaps = opts.run.pieceSnapshots;
    if (!(board instanceof HTMLElement)) {
      lastT = t;
      return;
    }
    const jump = Math.abs(t - lastT) > 0.18;
    const items = queryLiveBagItems(board);
    for (const node of items) {
      if (!(node instanceof HTMLElement)) continue;
      const parked = node.classList.contains('bpb-bg__item--parked');
      const card = isCardEl(node);
      if (parked && !card) continue;
      const pack = ensure(node);
      const key = node.dataset.placementKey || '';
      const live = liveAt(snaps, t, key);
      const isCard = card || live?.kind === 'card';
      if (isCard) {
        node.classList.add('sim-card');
        const preCombat = t + 1e-6 < COMBAT_DELAY;
        const faceUp = preCombat || !!live?.revealed;
        setRevealed(node, faceUp, !jump && !preCombat, !!live?.secondaryActive);
      } else {
        node.classList.remove('sim-card', 'sim-card--revealed', 'sim-card--flip');
      }
      applyVisualArt(node, visualStateAt(snaps, t, key));
      const potion = node.querySelector('.bpb-live[data-live-kind="potion"]');
      if (potion) {
        const drankAt = consumedAt(opts.run.events, key);
        setPotionLevel(node, drankAt != null && t + 1e-6 >= drankAt ? -1 : 0, { ms: 0 });
      }
      const face = Number(node.dataset.face) || 0;
      pack.cd.style.setProperty('--sim-cd-unspin', `${-face * 90}deg`);
      const clock = cdFill(live, t, opts.run.events, key);
      pack.cd.style.setProperty('--sim-cd', String(clock.fill));
      const nextArt = artUrl(spriteArtEl(node));
      if (nextArt && nextArt !== pack.art) {
        pack.art = nextArt;
        setCdArt(pack.cd, nextArt);
      }
      pack.cd.classList.toggle('is-on', clock.on);
    }
    lastT = t;
  }

  seek(0);

  return {
    seek,
    destroy() {
      for (const id of timers) window.clearTimeout(id);
      timers.length = 0;
      for (const el of attached) {
        const pack = layers.get(el);
        pack?.cd.remove();
        for (const original of pack?.originalSprites || []) {
          if (original.src == null) original.img.removeAttribute('src');
          else original.img.setAttribute('src', original.src);
          if (original.dataSrc == null) original.img.removeAttribute('data-src');
          else original.img.setAttribute('data-src', original.dataSrc);
        }
        el.classList.remove('sim-card', 'sim-card--revealed', 'sim-card--flip');
      }
      attached.length = 0;
    },
  };
}
