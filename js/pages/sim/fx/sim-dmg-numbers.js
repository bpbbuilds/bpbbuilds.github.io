/**
 * Combat labels over the fighters — port of the game's DamageNumber and
 * BuffLabel scenes (spawn physics + Godot animation tracks). Owns the rAF
 * loop that also drives the sprite reactions in sim-dmg-sprite.js.
 *
 * Geometry and timings live in sim-dmg-geo.js; this file only renders them.
 */

import * as G from './sim-dmg-geo.js';
import { createSpriteReactions } from './sim-dmg-sprite.js';

const TAU = Math.PI * 2;
const MAX_LABELS = 36;
const RECT_TTL = 200;
const rand = G.rand;

/** @param {number} a @param {number} b @param {number} t */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * @param {{
 *   fieldEl: () => HTMLElement | null,
 *   boardEl?: HTMLElement | null,
 *   labelsEnabled?: boolean,
 * }} opts
 */
export function createDamageNumbers(opts) {
  /** @type {HTMLElement | null} */
  let layer = null;
  let rate = 1;
  let raf = 0;
  let lastTs = 0;
  let disposed = false;
  /** Floating text over fighters / items (settings toggle). Hit/lunge/hop stay on. */
  let labelsOn = opts.labelsEnabled !== false;

  /** @type {any[]} */
  const labels = [];

  /** @type {Record<'you' | 'foe', any>} */
  const sides = {
    you: sideState(),
    foe: sideState(),
  };

  function sideState() {
    return {
      /** @type {HTMLImageElement | null} */ img: null,
      rect: null,
      rectAt: 0,
    };
  }

  function ensureLayer() {
    if (layer && layer.isConnected) return layer;
    const field = opts.fieldEl();
    if (!field) return null;
    layer = field.querySelector('.sim-dn-layer');
    if (!(layer instanceof HTMLElement)) {
      layer = document.createElement('div');
      layer.className = 'sim-dn-layer';
      layer.setAttribute('aria-hidden', 'true');
      field.appendChild(layer);
    }
    return layer;
  }

  /** @param {'you' | 'foe'} side */
  function spriteEl(side) {
    const st = sides[side];
    if (st.img && st.img.isConnected) return st.img;
    const field = opts.fieldEl();
    const img = field?.querySelector(
      `[data-sim-avatar="${side}"] [data-sim-avatar-img]`,
    );
    st.img = img instanceof HTMLImageElement ? img : null;
    return st.img;
  }

  /**
   * Body box in layer px + the game→web px factor (game body is 336 tall).
   * @param {'you' | 'foe'} side
   */
  function bodyBox(side) {
    const st = sides[side];
    const now = performance.now();
    if (st.rect && now - st.rectAt < RECT_TTL) return st.rect;
    const host = ensureLayer();
    const img = spriteEl(side);
    if (!host || !img) return null;
    const lr = host.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    if (!ir.height) return null;
    st.rect = {
      cx: ir.left + ir.width / 2 - lr.left,
      cy: ir.top + ir.height / 2 - lr.top,
      w: ir.width,
      h: ir.height,
      k: ir.height / G.BODY.h,
    };
    st.rectAt = now;
    return st.rect;
  }

  /**
   * +1 when the other fighter is to the right (the game mirrors the opponent).
   * @param {'you' | 'foe'} side
   */
  function inwardFor(side) {
    const me = bodyBox(side);
    const other = bodyBox(side === 'you' ? 'foe' : 'you');
    if (me && other && Math.abs(other.cx - me.cx) > 8) {
      return other.cx > me.cx ? 1 : -1;
    }
    return side === 'you' ? 1 : -1;
  }

  const sprite = createSpriteReactions({
    defsHost: ensureLayer,
    spriteEl,
    bodyBox,
    inwardFor,
    kick,
  });

  function kick() {
    if (raf || disposed) return;
    lastTs = 0;
    raf = requestAnimationFrame(frame);
  }

  /** @param {number} ts */
  function frame(ts) {
    raf = 0;
    if (disposed) return;
    const dt = Math.min(0.05, lastTs ? (ts - lastTs) / 1000 : 1 / 60) * rate;
    lastTs = ts;

    for (let i = labels.length - 1; i >= 0; i--) {
      const l = labels[i];
      stepLabel(l, dt);
      if (l.t >= l.anim.len) {
        l.el.remove();
        labels.splice(i, 1);
      } else {
        paintLabel(l);
      }
    }
    let busy = labels.length > 0;
    for (const side of /** @type {const} */ (['you', 'foe'])) {
      if (sprite.step(side, dt)) busy = true;
    }
    if (busy) raf = requestAnimationFrame(frame);
    else lastTs = 0;
  }

  /** @param {any} l @param {number} dt */
  function stepLabel(l, dt) {
    l.vy += G.G * l.gravity * dt;
    l.x += l.vx * dt;
    l.y += l.vy * dt;
    l.t += dt;
  }

  /** @param {any} l */
  function paintLabel(l) {
    const a = l.anim;
    const [bright, alpha] = G.sampleTrack(a.mod, l.t);
    let sx;
    let sy;
    if (a.scale) {
      const s = G.sampleTrack(a.scale, l.t);
      sx = s[0];
      sy = s[1];
    } else {
      sx = G.sampleTrack(a.scaleX, l.t)[0];
      sy = G.sampleTrack(a.scaleY, l.t)[0];
    }
    let rot = l.rot;
    if (a.rotDeg) {
      rot = (G.sampleTrack(a.rotDeg, l.t)[0] * Math.PI) / 180;
    }
    l.el.style.transform =
      `translate(${l.px + l.x * l.k}px, ${l.py + l.y * l.k}px)` +
      ` rotate(${rot}rad) scale(${sx}, ${sy})`;
    l.inner.style.opacity = String(alpha);
    l.inner.style.filter = bright === 1 ? '' : `brightness(${bright})`;
    if (l.glyphs) paintShake(l);
  }

  /** RichTextLabel `[shake rate=20 level=50]` — per glyph, strength/10 px. */
  /** @param {any} l */
  function paintShake(l) {
    const { rate: shakeRate, level } = l.anim.shake;
    const iv = 1 / shakeRate;
    const dur = 0.5 / shakeRate;
    const amp = (level / 10) * l.k;
    for (const g of l.glyphs) {
      if (l.t >= g.next) {
        g.prev = g.cur;
        g.cur = Math.random() * TAU;
        g.start = l.t;
        g.next = l.t + iv;
      }
      const n = Math.min(1, (l.t - g.start) / dur);
      const dx = lerp(Math.sin(g.prev), Math.sin(g.cur), n) * amp;
      const dy = lerp(Math.cos(g.prev), Math.cos(g.cur), n) * amp;
      g.el.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  }

  /**
   * @param {{
   *   side: 'you' | 'foe',
   *   anim: any,
   *   px: number,
   *   py: number,
   *   k: number,
   *   vx: number,
   *   vy: number,
   *   gravity: number,
   *   rot: number,
   *   color: string,
   *   fontSize: number,
   *   outline: number,
   *   box: { left: number, top: number, w: number },
   *   text?: string,
   *   iconSrc?: string | null,
   *   shake?: boolean,
   *   outlineColor?: string,
   *   iconSize?: number,
   * }} spec
   */
  function push(spec) {
    if (!labelsOn || disposed) return null;
    const host = ensureLayer();
    if (!host) return null;
    while (labels.length >= MAX_LABELS) {
      const old = labels.shift();
      old?.el.remove();
    }
    const el = document.createElement('div');
    el.className = 'sim-dn';
    const inner = document.createElement('div');
    inner.className = 'sim-dn__txt';
    inner.style.left = `${spec.box.left * spec.k}px`;
    inner.style.top = `${spec.box.top * spec.k}px`;
    inner.style.width = `${spec.box.w * spec.k}px`;
    inner.style.fontSize = `${spec.fontSize * spec.k}px`;
    inner.style.color = spec.color;
    inner.style.setProperty('--dn-stroke', `${spec.outline * 2 * spec.k}px`);
    if (spec.outlineColor) inner.style.setProperty('--dn-ink', spec.outlineColor);

    /** @type {any[] | null} */
    let glyphs = null;
    const text = spec.text ?? '';
    if (spec.shake) {
      glyphs = [];
      for (const ch of text) {
        const g = document.createElement('span');
        g.className = 'sim-dn__g';
        g.textContent = ch;
        inner.appendChild(g);
        glyphs.push({ el: g, prev: Math.random() * TAU, cur: Math.random() * TAU, start: 0, next: 0 });
      }
    } else {
      inner.textContent = text;
    }
    if (spec.iconSrc) {
      const icon = document.createElement('img');
      icon.className = 'sim-dn__icon';
      icon.src = spec.iconSrc;
      icon.alt = '';
      icon.style.height = `${(spec.iconSize || G.BUFF_LABEL.icon) * spec.k}px`;
      inner.appendChild(icon);
    }
    el.appendChild(inner);
    host.appendChild(el);

    const l = {
      el,
      inner,
      glyphs,
      anim: spec.anim,
      px: spec.px,
      py: spec.py,
      k: spec.k,
      x: 0,
      y: 0,
      vx: spec.vx,
      vy: spec.vy,
      gravity: spec.gravity,
      rot: spec.rot,
      t: 0,
    };
    labels.push(l);
    paintLabel(l);
    kick();
    return l;
  }

  /**
   * randDmgNumberDir: (0, −660) rotated 3°…21° away from the other fighter.
   * @param {'you' | 'foe'} side
   */
  function outwardDir(side) {
    const theta = (rand(G.DIR.minDeg, G.DIR.maxDeg) * Math.PI) / 180;
    const out = -inwardFor(side);
    return { vx: out * G.DIR.speed * Math.sin(theta), vy: -G.DIR.speed * Math.cos(theta) };
  }

  /**
   * @param {'you' | 'foe'} side
   * @param {'damage' | 'heal' | 'buff'} anchor
   */
  function anchorPoint(side, anchor) {
    const box = bodyBox(side);
    if (!box) return null;
    const s = G.SPAWN[anchor];
    const inward = inwardFor(side);
    const gx = s.dx * inward + rand(-s.jx, s.jx);
    const gy = s.dy + rand(-s.jy, s.jy);
    return { box, px: box.cx + gx * box.k, py: box.cy + gy * box.k };
  }

  /**
   * Character.spawnLabel — DealDamage / CriticalDamage / Poison / Spikes /
   * Fatigue / LoseHealth / Health.
   * @param {'you' | 'foe'} side
   * @param {keyof typeof G.NUMBER_TYPES} type
   * @param {number} amount
   */
  function number(side, type, amount) {
    const def = G.NUMBER_TYPES[type] || G.NUMBER_TYPES.damage;
    const anim = G.ANIMS[def.anim];
    const heal = def.anim === 'Heal';
    const at = anchorPoint(side, heal ? 'heal' : 'damage');
    if (!at) return;
    const value = Math.round(Number(amount) || 0);
    const fontSize = G.numberFontSize(Math.abs(value));
    const dir = heal ? { vx: anim.velocity[0], vy: anim.velocity[1] } : outwardDir(side);
    push({
      side,
      anim,
      px: at.px,
      py: at.py,
      k: at.box.k,
      vx: dir.vx,
      vy: dir.vy,
      gravity: anim.gravity,
      rot: heal ? 0 : dir.vx * G.ROT_PER_VX,
      color: def.color,
      fontSize,
      outline: G.outlineSize(fontSize),
      box: G.NUM_BOX,
      text: `${def.sign}${value}`,
      shake: Boolean(anim.shake),
    });
  }

  /**
   * Util.spawnMissLabel — BuffLabel at the damage spot, direction × 0.8,
   * gravity_scale 5.
   * @param {'you' | 'foe'} side
   */
  function miss(side) {
    const at = anchorPoint(side, 'damage');
    if (!at) return;
    const dir = outwardDir(side);
    push({
      side,
      anim: G.ANIMS.Buff,
      px: at.px,
      py: at.py,
      k: at.box.k,
      vx: dir.vx * 0.8,
      vy: dir.vy * 0.8,
      gravity: 5,
      rot: 0,
      color: G.BUFF_LABEL.white,
      fontSize: G.BUFF_LABEL.font,
      outline: G.BUFF_LABEL.outline,
      box: G.BUFF_BOX,
      text: G.LABEL_TEXT.miss,
    });
  }

  /**
   * Util.spawnBuffLabel — stun / resisted / protected / reflected, low on the
   * body, drifting up at 75…120 px/s with gravity_scale 1.
   * @param {'you' | 'foe'} side
   * @param {{ text: string, tone?: 'positive' | 'negative' | 'white', icon?: string | null }} spec
   */
  function statusLabel(side, spec) {
    const at = anchorPoint(side, 'buff');
    if (!at) return;
    const tone = spec.tone || 'white';
    push({
      side,
      anim: G.ANIMS.Buff,
      px: at.px,
      py: at.py,
      k: at.box.k,
      vx: 0,
      vy: -rand(G.BUFF_LABEL.riseMin, G.BUFF_LABEL.riseMax),
      gravity: 1,
      rot: 0,
      color: G.BUFF_LABEL[tone],
      fontSize: G.BUFF_LABEL.font,
      outline: G.BUFF_LABEL.outline,
      box: G.BUFF_BOX,
      text: spec.text,
      iconSrc: spec.icon || null,
    });
  }

  /** Item.getNextFreeLabelPosition — five slots, each reserved 0.5 s. */
  const slotHeld = new WeakMap();

  /** @param {HTMLElement} itemEl */
  function readItemCellPx(itemEl) {
    const nodes = [itemEl, itemEl.closest('.bpb-bg'), opts.boardEl];
    for (const n of nodes) {
      if (!(n instanceof Element)) continue;
      const v = Number.parseFloat(
        getComputedStyle(n).getPropertyValue('--bpb-bg-cell'),
      );
      if (v > 0) return v;
    }
    return G.ITEM_LABEL.cell;
  }

  /**
   * Util.spawnLabelOnItem / spawnBuffLabel_item — parented to Game.UINode, so
   * the font matches character buff labels (body scale), not the bag cell.
   * @param {HTMLElement} itemEl
   * @param {{
   *   text: string,
   *   color: string,
   *   anim?: 'ItemBuff' | 'ItemDamage' | 'StatChange' | 'OutOfStamina',
   *   icon?: string | null,
   *   shake?: boolean,
   *   iconSize?: number,
   *   face?: 'body' | 'display',
   *   box?: { left: number, top: number, w: number },
   *   centered?: boolean,
   *   outlineColor?: string,
   * }} spec
   */
  function itemLabel(itemEl, spec) {
    const host = ensureLayer();
    if (!host || !(itemEl instanceof HTMLElement)) return;
    const lr = host.getBoundingClientRect();
    const ir = itemEl.getBoundingClientRect();
    if (!ir.width) return;
    const cellPx = readItemCellPx(itemEl);
    const side = itemEl.closest('.sim-field__bag--opp') ? 'foe' : 'you';
    const boxScale = bodyBox(side) || bodyBox(side === 'you' ? 'foe' : 'you');
    const { cellK, k } = G.itemLabelScales(cellPx, boxScale?.k);

    let off = [0, 0];
    if (!spec.centered) {
      const now = performance.now() / 1000;
      let held = slotHeld.get(itemEl);
      if (!held) {
        held = [0, 0, 0, 0, 0];
        slotHeld.set(itemEl, held);
      }
      let slotted = null;
      for (let i = 0; i < held.length; i++) {
        if (now >= held[i]) {
          held[i] = now + G.ITEM_LABEL.hold;
          const o = G.ITEM_LABEL.offsets[i];
          const j = G.ITEM_LABEL.jitter;
          slotted = [o[0] + rand(-j, j), o[1] + rand(-j, j)];
          break;
        }
      }
      if (!slotted) {
        const j = G.ITEM_LABEL.fallbackJitter;
        slotted = [rand(-j, j), rand(-j, j)];
      }
      off = slotted;
    }

    const animName =
      spec.anim === 'ItemDamage'
        ? 'ItemDamage'
        : spec.anim === 'StatChange'
          ? 'StatChange'
          : spec.anim === 'OutOfStamina'
            ? 'OutOfStamina'
            : 'ItemBuff';
    const anim = G.ANIMS[animName];
    const label = push({
      side: 'you',
      anim,
      px: ir.left + ir.width / 2 - lr.left + off[0] * cellK,
      py: ir.top + ir.height / 2 - lr.top + off[1] * cellK,
      k,
      vx: 0,
      vy: anim.velocity?.[1] || 0,
      gravity: anim.gravity ?? 1,
      rot: 0,
      color: spec.color,
      fontSize: G.BUFF_LABEL.font,
      outline: G.BUFF_LABEL.outline,
      box: spec.box || G.BUFF_BOX,
      text: spec.text,
      iconSrc: spec.icon || null,
      iconSize: spec.iconSize,
      shake: Boolean(spec.shake),
      outlineColor: spec.outlineColor || G.tintInk(spec.color),
    });
    if (label && spec.face === 'display') {
      label.inner.classList.add('sim-dn__txt--display');
    }
  }

  function invalidate() {
    sides.you.rect = null;
    sides.foe.rect = null;
    sides.you.img = null;
    sides.foe.img = null;
  }

  window.addEventListener('resize', invalidate, { passive: true });

  function clear() {
    for (const l of labels) l.el.remove();
    labels.length = 0;
    for (const side of /** @type {const} */ (['you', 'foe'])) {
      sides[side].rect = null;
      sprite.reset(side);
    }
  }

  return {
    number,
    miss,
    statusLabel,
    itemLabel,
    hit: sprite.hit,
    lunge: sprite.lunge,
    hop: sprite.hop,
    /** @param {number} next playback speed — labels run in game seconds */
    setRate(next) {
      const v = Number(next);
      rate = Number.isFinite(v) && v > 0 ? v : 1;
    },
    /** @param {boolean} on */
    setLabelsEnabled(on) {
      labelsOn = Boolean(on);
      if (!labelsOn) clear();
    },
    clear,
    /** Drop cached rects after a resize / relayout. */
    invalidate,
    destroy() {
      disposed = true;
      window.removeEventListener('resize', invalidate);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clear();
      layer?.remove();
      layer = null;
      sprite.dropDefs();
    },
  };
}
