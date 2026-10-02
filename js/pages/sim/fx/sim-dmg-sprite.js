/**
 * Fighter reactions — Character.playHitAnimation (tint + squash),
 * playAttackAnimation (lunge) and playActivateAnimation (hop).
 *
 * The label layer in sim-dmg-numbers.js owns the rAF loop and the body-box
 * geometry; this module only holds per-side state and paints one sprite.
 */

import * as G from './sim-dmg-geo.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** @param {number} a @param {number} b @param {number} t */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** @param {number} r @param {number} g @param {number} b */
function matrixValues(r, g, b) {
  return `${r} 0 0 0 0 0 ${g} 0 0 0 0 0 ${b} 0 0 0 0 0 1 0`;
}

/**
 * @param {{
 *   defsHost: () => HTMLElement | null,
 *   spriteEl: (side: 'you' | 'foe') => HTMLImageElement | null,
 *   bodyBox: (side: 'you' | 'foe') => { k: number } | null,
 *   inwardFor: (side: 'you' | 'foe') => number,
 *   kick: () => void,
 * }} opts
 */
export function createSpriteReactions(opts) {
  /** @type {SVGSVGElement | null} */
  let tintSvg = null;

  const sides = {
    you: sideState(),
    foe: sideState(),
  };

  function sideState() {
    return {
      /** @type {any} */ move: null,
      /** @type {any} */ hit: null,
      /** @type {SVGFEColorMatrixElement | null} */ matrix: null,
    };
  }

  /** Godot `modulate` multiplies in sRGB — linearRGB washes the tint out. */
  function ensureTint() {
    if (tintSvg && tintSvg.isConnected) return;
    const host = opts.defsHost();
    if (!host) return;
    tintSvg = document.createElementNS(SVG_NS, 'svg');
    tintSvg.setAttribute('class', 'sim-dn-tint-defs');
    tintSvg.setAttribute('aria-hidden', 'true');
    for (const side of /** @type {const} */ (['you', 'foe'])) {
      const filter = document.createElementNS(SVG_NS, 'filter');
      filter.setAttribute('id', `sim-dn-tint-${side}`);
      filter.setAttribute('color-interpolation-filters', 'sRGB');
      const mat = document.createElementNS(SVG_NS, 'feColorMatrix');
      mat.setAttribute('type', 'matrix');
      mat.setAttribute('values', matrixValues(1, 1, 1));
      filter.appendChild(mat);
      tintSvg.appendChild(filter);
      sides[side].matrix = /** @type {SVGFEColorMatrixElement} */ (mat);
    }
    host.appendChild(tintSvg);
  }

  /**
   * @param {'you' | 'foe'} side
   * @param {number} dt seconds, already scaled by playback rate
   * @returns {boolean} still animating
   */
  function step(side, dt) {
    const st = sides[side];
    const img = opts.spriteEl(side);
    if (!img) return false;
    let busy = false;

    const m = st.move;
    if (m) {
      m.t += dt;
      if (m.t < m.fwd) {
        m.cur = lerp(m.from, m.to, m.fwd <= 0 ? 1 : m.t / m.fwd);
        busy = true;
      } else {
        m.forward = false;
        const bt = m.back <= 0 ? 1 : (m.t - m.fwd) / m.back;
        m.cur = lerp(m.to, 0, Math.min(1, bt));
        if (bt >= 1) st.move = null;
        else busy = true;
      }
      img.style.setProperty(m.axis === 'y' ? '--sim-av-dy' : '--sim-av-dx', `${m.cur}px`);
      if (!st.move) {
        img.style.removeProperty('--sim-av-dx');
        img.style.removeProperty('--sim-av-dy');
      }
    }

    const h = st.hit;
    if (h) {
      h.t += dt * h.speed;
      if (h.t >= G.HIT_ANIM.len) {
        st.hit = null;
        img.style.removeProperty('--sim-av-tint');
        img.style.removeProperty('--sim-av-sx');
        img.style.removeProperty('--sim-av-sy');
        if (st.matrix) st.matrix.setAttribute('values', matrixValues(1, 1, 1));
      } else {
        const tint = G.sampleTrack(h.tintTrack, h.t);
        const squash = G.sampleTrack(h.squashTrack, h.t);
        if (st.matrix) {
          st.matrix.setAttribute('values', matrixValues(tint[0], tint[1], tint[2]));
        }
        img.style.setProperty('--sim-av-tint', `url(#sim-dn-tint-${side})`);
        img.style.setProperty('--sim-av-sx', String(squash[0]));
        img.style.setProperty('--sim-av-sy', String(squash[1]));
        busy = true;
      }
    }
    return busy;
  }

  /**
   * HitAnimation — Hit / Block / Fatigue / Poison on the fighter that was hit.
   * @param {'you' | 'foe'} side
   * @param {keyof typeof G.HIT_ANIMS} variant
   */
  function hit(side, variant) {
    const st = sides[side];
    const tint = G.HIT_ANIMS[variant] || G.HIT_ANIMS.Hit;
    // Character.takeDamage lets a running Poison tint finish instead of
    // restarting the animation with a weaker colour.
    if (st.hit?.variant === 'Poison' && variant !== 'Poison') return;
    ensureTint();
    if (!opts.spriteEl(side)) return;
    st.hit = {
      variant,
      t: 0,
      speed: G.rand(G.HIT_ANIM.speedMin, G.HIT_ANIM.speedMax),
      tintTrack: [
        { t: 0, v: [1, 1, 1], tr: -2 },
        { t: G.HIT_ANIM.tintAt, v: tint, tr: -2 },
        { t: G.HIT_ANIM.len, v: [1, 1, 1] },
      ],
      squashTrack: [
        { t: 0, v: [1, 1], tr: -2 },
        { t: G.HIT_ANIM.squash.t, v: [G.HIT_ANIM.squash.x, G.HIT_ANIM.squash.y], tr: -2 },
        { t: G.HIT_ANIM.len, v: [1, 1] },
      ],
    };
    opts.kick();
  }

  /**
   * playAttackAnimation — lunge inward 100–160 px at 2600 px/s, back at
   * 1000 px/s. A new swing is ignored while the forward leg is still running.
   * @param {'you' | 'foe'} side
   */
  function lunge(side) {
    const st = sides[side];
    if (st.move?.forward) return;
    const box = opts.bodyBox(side);
    if (!box) return;
    const dist = G.rand(G.LUNGE.distMin, G.LUNGE.distMax) * box.k * opts.inwardFor(side);
    const from = st.move?.axis === 'x' ? st.move.cur : 0;
    opts.spriteEl(side)?.style.removeProperty('--sim-av-dy');
    st.move = {
      axis: 'x',
      t: 0,
      from,
      to: dist,
      cur: from,
      fwd: legTime(Math.abs(dist - from), G.LUNGE.fwdSpeed * box.k),
      back: legTime(Math.abs(dist), G.LUNGE.backSpeed * box.k),
      forward: true,
    };
    opts.kick();
  }

  /**
   * playActivateAnimation — 40 px hop at 300 px/s, skipped mid-swing exactly
   * like the game's `attackMovingForward` guard.
   * @param {'you' | 'foe'} side
   */
  function hop(side) {
    const st = sides[side];
    if (st.move?.forward) return;
    const box = opts.bodyBox(side);
    if (!box) return;
    const to = -G.HOP.height * box.k;
    const from = st.move?.axis === 'y' ? st.move.cur : 0;
    opts.spriteEl(side)?.style.removeProperty('--sim-av-dx');
    const speed = G.HOP.speed * box.k;
    st.move = {
      axis: 'y',
      t: 0,
      from,
      to,
      cur: from,
      fwd: legTime(Math.abs(to - from), speed),
      back: legTime(Math.abs(to), speed),
      forward: true,
    };
    opts.kick();
  }

  /** @param {number} dist @param {number} speed */
  function legTime(dist, speed) {
    return (dist / speed) * G.rand(G.LUNGE.jitterMin, G.LUNGE.jitterMax);
  }

  /** @param {'you' | 'foe'} side */
  function reset(side) {
    const st = sides[side];
    st.hit = null;
    st.move = null;
    const img = opts.spriteEl(side);
    if (img) {
      img.style.removeProperty('--sim-av-tint');
      img.style.removeProperty('--sim-av-sx');
      img.style.removeProperty('--sim-av-sy');
      img.style.removeProperty('--sim-av-dx');
      img.style.removeProperty('--sim-av-dy');
    }
    if (st.matrix) st.matrix.setAttribute('values', matrixValues(1, 1, 1));
  }

  function dropDefs() {
    tintSvg = null;
    sides.you.matrix = null;
    sides.foe.matrix = null;
  }

  return { step, hit, lunge, hop, reset, dropDefs };
}
