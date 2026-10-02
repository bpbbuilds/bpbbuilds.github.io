/**
 * Play Item.ActivationAni clips on live board sprites.
 */

import { queryLivePlacement } from './sim-item-chrome.js';

/** @type {ReadonlySet<string>} */
export const ACTIVATION_ANI = new Set([
  'Scale',
  'Jump',
  'SquishyJump',
  'VerySquishyJump',
  'Slash',
  'Stab',
  'Bonk',
  'ReverseBonk',
  'Chop',
  'Squish',
  'Block',
  'Wave',
  'Potion',
  'Sweep',
  'Spin',
  'Throw',
  'Shoot',
  'Struggle',
  'ReverseStab',
  'Hiss',
  'Tackle',
  'DoubleSlash',
  'Flash',
]);

/** Clip length in seconds (Item.tscn / queued Consume). */
export const ANI_DURATION = {
  Scale: 0.5,
  Jump: 0.5,
  SquishyJump: 0.5,
  VerySquishyJump: 0.5,
  Slash: 0.5,
  Stab: 0.5,
  Bonk: 0.5,
  ReverseBonk: 0.5,
  Chop: 0.5,
  Squish: 0.5,
  Block: 0.5,
  Wave: 0.5,
  Potion: 1,
  Sweep: 0.5,
  Spin: 0.5,
  Throw: 0.5,
  Shoot: 0.5,
  Struggle: 0.5,
  ReverseStab: 0.3,
  Hiss: 0.5,
  Tackle: 0.5,
  DoubleSlash: 0.5,
  Flash: 0.5,
  mini: 0.3,
  consume: 0.1,
  nostamina: 0.35,
};

const CLIP_CLASS = {
  Scale: 'sim-ani--Scale',
  Jump: 'sim-ani--Jump',
  SquishyJump: 'sim-ani--SquishyJump',
  VerySquishyJump: 'sim-ani--VerySquishyJump',
  Slash: 'sim-ani--Slash',
  Stab: 'sim-ani--Stab',
  Bonk: 'sim-ani--Bonk',
  ReverseBonk: 'sim-ani--ReverseBonk',
  Chop: 'sim-ani--Chop',
  Squish: 'sim-ani--Squish',
  Block: 'sim-ani--Block',
  Wave: 'sim-ani--Wave',
  Potion: 'sim-ani--Potion',
  Sweep: 'sim-ani--Sweep',
  Spin: 'sim-ani--Spin',
  Throw: 'sim-ani--Throw',
  Shoot: 'sim-ani--Shoot',
  Struggle: 'sim-ani--Struggle',
  ReverseStab: 'sim-ani--ReverseStab',
  Hiss: 'sim-ani--Hiss',
  Tackle: 'sim-ani--Tackle',
  DoubleSlash: 'sim-ani--DoubleSlash',
  Flash: 'sim-ani--Flash',
};

const ALL_CLIP = [
  ...Object.values(CLIP_CLASS),
  'sim-ani',
  'sim-ani--mini',
  'sim-ani--mini-consumed',
  'sim-ani--consume',
  'sim-ani--nostamina',
];

/** @type {Record<string, string> | null} */
let aniMap = null;
/** @type {Promise<Record<string, string>> | null} */
let aniLoad = null;

/**
 * @param {string} [assetRoot]
 * @returns {Promise<Record<string, string>>}
 */
export function loadActivationAniMap(assetRoot = '../') {
  if (aniMap) return Promise.resolve(aniMap);
  if (aniLoad) return aniLoad;
  const base = assetRoot.endsWith('/') ? assetRoot : `${assetRoot}/`;
  aniLoad = fetch(`${base}assets/data/sim-activation-ani.json`)
    .then((r) => (r.ok ? r.json() : { items: {} }))
    .then((j) => {
      aniMap = j?.items && typeof j.items === 'object' ? j.items : {};
      return aniMap;
    })
    .catch(() => {
      aniMap = {};
      return aniMap;
    });
  return aniLoad;
}

/**
 * @param {string | null | undefined} raw
 * @returns {string}
 */
export function normalizeAni(raw) {
  const s = String(raw || '').trim();
  if (ACTIVATION_ANI.has(s)) return s;
  const key = s.toLowerCase().replace(/[^a-z]/g, '');
  for (const name of ACTIVATION_ANI) {
    if (name.toLowerCase().replace(/[^a-z]/g, '') === key) return name;
  }
  return 'Jump';
}

/**
 * @param {HTMLElement} el
 */
function isCardEl(el) {
  const type = String(el.dataset.itemType || '').toLowerCase();
  if (type === 'card') return true;
  return String(el.dataset.extraTypes || '')
    .toLowerCase()
    .split(',')
    .some((x) => x.trim() === 'card');
}

/**
 * @param {HTMLElement} el
 */
function isBagEl(el) {
  return el.classList.contains('bpb-bg__item--bag');
}

/**
 * @param {HTMLElement} el
 * @returns {HTMLElement | null}
 */
function liveSprite(el) {
  const n = el.querySelector('.bpb-bg__sprite:not(.bpb-bg__sprite--shadow)');
  return n instanceof HTMLElement ? n : null;
}

/**
 * Jump / Block / SquishyJump use Item.gd `sprite.global_position:y`
 * (screen-up). AnimationPlayer clips (Slash, Stab, …) stay local on Icon.
 * @param {string} ani
 */
function isWorldUpAni(ani) {
  return (
    ani === 'Jump' ||
    ani === 'Block' ||
    ani === 'SquishyJump' ||
    ani === 'VerySquishyJump' ||
    ani === 'Struggle'
  );
}

/**
 * Nodes that play the clip.
 * - World-up hops: the item root (outside face rotate) so upside-down food
 *   still jumps up, and the BuildViewer shadow rides along.
 * - Local clips: hit (sprite + CD shade) + shadow spin (Item.updateShadow)
 *   + socket / gem layers (Falcon Blade DoubleSlash must move jewels with the blade).
 * @param {HTMLElement} el
 * @param {string} ani
 * @returns {HTMLElement[]}
 */
function motionTargets(el, ani) {
  if (isWorldUpAni(ani)) return [el];
  /** @type {HTMLElement[]} */
  const out = [];
  const hit = el.querySelector('.bpb-bg__hit');
  if (hit instanceof HTMLElement) out.push(hit);
  else {
    const sp = liveSprite(el);
    if (sp) out.push(sp);
  }
  const shadow = el.querySelector('.bpb-bg__spin--shadow');
  if (shadow instanceof HTMLElement) out.push(shadow);
  // Siblings of .bpb-bg__hit under .bpb-bg__spin — same AABB, same ActivationAni.
  for (const sel of ['.bpb-bg__sockets', '.bpb-bg__gems']) {
    const layer = el.querySelector(sel);
    if (layer instanceof HTMLElement) out.push(layer);
  }
  return out;
}

function prefersReduced() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

/**
 * @param {HTMLElement} el
 * @param {string | null | undefined} itemId
 */
export function resolveAni(el, itemId) {
  if (isCardEl(el)) return 'Flash';
  const id = String(itemId || el.getAttribute('data-item-id') || '');
  return normalizeAni(aniMap?.[id] || 'Jump');
}

/**
 * @param {{
 *   boardEl: HTMLElement | null | undefined,
 *   assetRoot?: string,
 * }} opts
 */
export function createItemAnims(opts) {
  void loadActivationAniMap(opts.assetRoot);
  let rate = 1;
  /** @type {Map<string, { t: number, n: number }>} */
  const frameCap = new Map();
  /** @type {Map<string, number>} */
  const consumeAt = new Map();
  /** @type {Set<ReturnType<typeof window.setTimeout>>} */
  const timers = new Set();

  /** @param {number} ms */
  function later(ms, fn) {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  }

  function clearTimers() {
    for (const id of timers) window.clearTimeout(id);
    timers.clear();
  }

  /**
   * @param {HTMLElement} sprite
   */
  function stripMotion(sprite) {
    sprite.classList.remove(...ALL_CLIP);
    sprite.style.removeProperty('--sim-ani-rate');
  }

  /**
   * @param {HTMLElement} itemEl
   */
  function stripLift(itemEl) {
    itemEl.classList.remove('sim-ani-lift');
  }

  /**
   * @param {string} placementKey
   * @param {number} t
   */
  function underCap(placementKey, t) {
    const stamp = Math.round(t / 0.05);
    const prev = frameCap.get(placementKey);
    if (!prev || prev.t !== stamp) {
      frameCap.set(placementKey, { t: stamp, n: 1 });
      return true;
    }
    if (prev.n >= 3) return false;
    prev.n += 1;
    return true;
  }

  /**
   * @param {HTMLElement} sprite
   */
  function bindEnd(sprite) {
    if (sprite.dataset.simAniEnd === '1') return;
    sprite.dataset.simAniEnd = '1';
    sprite.addEventListener('animationend', (ev) => {
      if (ev.target !== sprite) return;
      if (sprite.classList.contains('sim-ani--consume')) return;
      if (sprite.classList.contains('sim-ani--mini-consumed')) return;
      const keep = sprite.classList.contains('sim-ani--consumed');
      stripMotion(sprite);
      if (keep) sprite.classList.add('sim-ani--consumed');
    });
  }

  /**
   * @param {HTMLElement[]} hosts
   * @param {string} clipClass
   * @param {number} dur
   */
  function restartAll(hosts, clipClass, dur) {
    for (const host of hosts) {
      stripMotion(host);
      if (host.classList.contains('sim-ani--consumed') && clipClass !== 'sim-ani--mini-consumed') {
        host.classList.remove('sim-ani--consumed');
      }
    }
    for (const host of hosts) void host.offsetWidth;
    for (const host of hosts) {
      host.style.setProperty('--sim-ani-rate', String(rate || 1));
      host.classList.add('sim-ani', clipClass);
      bindEnd(host);
    }
    return dur / (rate || 1);
  }

  /**
   * @param {HTMLElement[]} hosts
   * @param {string} clipClass
   */
  function addClip(hosts, clipClass) {
    for (const host of hosts) {
      stripMotion(host);
      void host.offsetWidth;
      host.style.setProperty('--sim-ani-rate', String(rate || 1));
      host.classList.add('sim-ani', clipClass);
      bindEnd(host);
    }
  }

  /**
   * @param {string | undefined} placementKey
   */
  function itemOf(placementKey) {
    if (!placementKey || !opts.boardEl) return null;
    return queryLivePlacement(opts.boardEl, placementKey);
  }

  /**
   * @param {string | undefined} placementKey
   * @param {{
   *   itemId?: string,
   *   consume?: boolean,
   *   t?: number,
   *   ani?: string,
   * }} [info]
   */
  function play(placementKey, info = {}) {
    const el = itemOf(placementKey);
    if (!el) return;
    const t = Number(info.t) || 0;
    if (!underCap(placementKey, t)) return;
    const sprite = liveSprite(el);
    if (!sprite) return;
    const ani = prefersReduced()
      ? 'Flash'
      : normalizeAni(info.ani || resolveAni(el, info.itemId));
    const hosts = motionTargets(el, ani);
    if (!hosts.length) return;
    const cls = CLIP_CLASS[ani] || CLIP_CLASS.Jump;
    const wait = restartAll(hosts, cls, ANI_DURATION[ani] || 0.5);
    if (!isBagEl(el)) {
      el.classList.add('sim-ani-lift');
      later(400 / (rate || 1), () => stripLift(el));
    }
    if (info.consume) {
      consumeAt.set(placementKey, t);
      later(wait * 1000, () => {
        if (!el.isConnected) return;
        addClip(hosts.filter((h) => h.isConnected), 'sim-ani--consume');
        later((ANI_DURATION.consume / (rate || 1)) * 1000, () => {
          for (const h of hosts) {
            if (h.isConnected) stripMotion(h);
          }
          sprite.classList.add('sim-ani--consumed');
        });
      });
    }
  }

  /**
   * @param {string | undefined} placementKey
   */
  function mini(placementKey) {
    const el = itemOf(placementKey);
    if (!el) return;
    const sprite = liveSprite(el);
    if (!sprite) return;
    const hosts = motionTargets(el, 'Flash');
    if (!hosts.length) return;
    const dim = sprite.classList.contains('sim-ani--consumed') || consumeAt.has(placementKey);
    restartAll(hosts, dim ? 'sim-ani--mini-consumed' : 'sim-ani--mini', ANI_DURATION.mini);
    if (dim) {
      later((ANI_DURATION.mini / (rate || 1)) * 1000, () => {
        for (const h of hosts) {
          if (h.isConnected) stripMotion(h);
        }
        sprite.classList.add('sim-ani--consumed');
      });
    }
  }

  /**
   * @param {string | undefined} placementKey
   */
  function noStamina(placementKey) {
    const el = itemOf(placementKey);
    if (!el) return;
    const clipName = prefersReduced() ? 'Flash' : 'nostamina';
    const hosts = motionTargets(el, clipName === 'Flash' ? 'Flash' : 'Slash');
    if (!hosts.length) return;
    const clip = clipName === 'Flash' ? 'sim-ani--Flash' : 'sim-ani--nostamina';
    restartAll(hosts, clip, ANI_DURATION.nostamina);
  }

  /**
   * @param {string | undefined} placementKey
   * @param {boolean} on
   */
  function setConsumed(placementKey, on) {
    const el = itemOf(placementKey);
    const sprite = el && liveSprite(el);
    if (!sprite) return;
    if (on) sprite.classList.add('sim-ani--consumed');
    else sprite.classList.remove('sim-ani--consumed');
  }

  /**
   * @param {number} t
   */
  function syncConsumed(t) {
    for (const [key, at] of consumeAt) {
      setConsumed(key, t + 1e-6 >= at);
    }
  }

  /**
   * @param {import('../../sim-events.js').SimEvent[] | undefined} events
   */
  function indexConsumes(events) {
    consumeAt.clear();
    for (const ev of events || []) {
      if (ev.type === 'activate' && ev.meta?.consume && ev.placementKey) {
        consumeAt.set(ev.placementKey, ev.t);
      }
    }
  }

  function clearInFlight() {
    clearTimers();
    opts.boardEl?.querySelectorAll('.sim-ani-lift').forEach((n) => {
      if (n instanceof HTMLElement) stripLift(n);
    });
    opts.boardEl
      ?.querySelectorAll(
        '.bpb-bg__item.sim-ani, .bpb-bg__hit.sim-ani, .bpb-bg__spin--shadow.sim-ani, .bpb-bg__sockets.sim-ani, .bpb-bg__gems.sim-ani, .bpb-bg__sprite.sim-ani',
      )
      .forEach((n) => {
        if (n instanceof HTMLElement) {
          const keep = n.classList.contains('sim-ani--consumed');
          stripMotion(n);
          if (keep) n.classList.add('sim-ani--consumed');
        }
      });
  }

  return {
    play,
    mini,
    noStamina,
    setConsumed,
    indexConsumes,
    syncConsumed,
    consumedEntries() {
      return consumeAt;
    },
    clearInFlight,
    setRate(next) {
      const n = Number(next);
      rate = Number.isFinite(n) && n > 0 ? n : 1;
    },
    destroy() {
      clearInFlight();
      consumeAt.clear();
      frameCap.clear();
      opts.boardEl?.querySelectorAll('.sim-ani--consumed').forEach((n) => {
        n.classList.remove('sim-ani--consumed');
      });
    },
  };
}
