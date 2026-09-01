/**
 * Combat board chrome: card face-down → reveal, cooldown fill (Item.showCooldown).
 */

import { COMBAT_DELAY } from './engine/simulate.js';

const CARD_BACK_FILE = {
  common: 'Cardback_common.png',
  rare: 'Cardback_rare.png',
  epic: 'Cardback_epic.png',
  legendary: 'Cardback_legendary.png',
  godly: 'Cardback_godly.png',
  unique: 'Cardback.png',
};

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
  return [...el.querySelectorAll('img.bpb-bg__sprite')].filter(
    (n) => n instanceof HTMLImageElement,
  );
}

/**
 * @param {HTMLElement} cd
 * @param {string} url
 */
function setCdMask(cd, url) {
  const img = url ? `url("${url}")` : 'none';
  cd.style.webkitMaskImage = img;
  cd.style.maskImage = img;
}

/**
 * @param {{
 *   boardEl: HTMLElement | null,
 *   run: import('./sim-events.js').SimRun,
 *   assetRoot?: string,
 * }} opts
 */
export function createSimItemChrome(opts) {
  /** @type {WeakMap<HTMLElement, { cd: HTMLElement, frontSrc: string }>} */
  const layers = new WeakMap();
  /** @type {HTMLElement[]} */
  const attached = [];
  let lastT = 0;
  /** @type {number[]} */
  const timers = [];

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
    const sprite = spriteHost.querySelector(
      'img.bpb-bg__sprite:not(.bpb-bg__sprite--shadow)',
    );

    const cd = document.createElement('span');
    cd.className = 'sim-cd-shade';
    cd.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('span');
    fill.className = 'sim-cd-shade__fill';
    cd.appendChild(fill);
    if (sprite instanceof HTMLElement) {
      cd.style.cssText = sprite.getAttribute('style') || '';
      const src = sprite.getAttribute('src') || sprite.dataset.src || '';
      if (src) setCdMask(cd, src);
    }
    spriteHost.appendChild(cd);

    const front = sprite instanceof HTMLImageElement
      ? sprite.getAttribute('src') || sprite.dataset.src || ''
      : '';
    pack = { cd, frontSrc: front };
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
    if (pack) setCdMask(pack.cd, maskSrc);
  }

  /**
   * @param {import('./sim-events.js').SimRun['pieceSnapshots']} snaps
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
      // triggerTime is already wall-clock remaining (speed is baked into loopCd).
      trig = Math.max(0, trig - dt);
    }
    return { ...rec, triggerTime: trig, loopCd, cooldown: rec.cooldown };
  }

  /**
   * Fill hits 1.0 at the next real activate for this placement.
   * @param {object | null} live
   * @param {number} t
   * @param {import('./sim-events.js').SimEvent[] | undefined} events
   * @param {string} key
   */
  function cdFill(live, t, events, key) {
    if (!live) return 0;
    if (t + 1e-6 < COMBAT_DELAY) return 0;
    const period = Number(live.loopCd) || Number(live.cooldown) || 0;
    const trig = Number(live.triggerTime);
    if (!(period > 0) || period >= 500 || !Number.isFinite(trig) || trig >= 500) {
      return 0;
    }
    if (live.kind === 'card' && !live.revealing) return 0;

    let armedAt = COMBAT_DELAY;
    let nextAt = null;
    if (key && Array.isArray(events)) {
      for (const ev of events) {
        if (ev.placementKey !== key || ev.type !== 'activate') continue;
        if (ev.actor === 'dummy' && !String(key).startsWith('opp:')) continue;
        if (ev.meta?.miniActivate) continue;
        const et = Number(ev.t);
        if (!Number.isFinite(et)) continue;
        if (et <= t + 1e-4) armedAt = et;
        else if (nextAt == null) nextAt = et;
      }
    }
    if (nextAt != null && nextAt > armedAt) {
      return Math.max(0, Math.min(1, (t - armedAt) / (nextAt - armedAt)));
    }
    return Math.max(0, Math.min(1, 1 - trig / period));
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
    const items = board.querySelectorAll('.bpb-bg__item');
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
      const face = Number(node.dataset.face) || 0;
      pack.cd.style.setProperty('--sim-cd-unspin', `${-face * 90}deg`);
      const fill = cdFill(live, t, opts.run.events, key);
      pack.cd.style.setProperty('--sim-cd', String(fill));
      pack.cd.classList.toggle('is-on', fill > 0.002 && fill < 1);
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
        for (const img of itemSprites(el)) {
          const front = img.dataset.frontSrc;
          if (front) img.src = front;
          delete img.dataset.frontSrc;
        }
        el.classList.remove('sim-card', 'sim-card--revealed', 'sim-card--flip');
      }
      attached.length = 0;
    },
  };
}
