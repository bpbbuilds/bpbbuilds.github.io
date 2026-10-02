/**
 * Living idle item art — potions (WebGL liquid), glow/flicker CSS, holo scroll.
 */

import {
  MAX_DRAW,
  drawPotion,
  drawHolo,
  preloadPotionMaps,
  preloadHoloMaps,
  layerSrc,
  loadImage,
} from './potion-liquid.js';
import {
  LIGHT_GLOW,
  bakeLightPlate,
  layoutGlowPlate,
  layoutLiquidPlate,
  readItemFaceRad,
} from './layout-plates.js';

/** @type {Record<string, object> | null} */
let specMap = null;
/** @type {Promise<Record<string, object>> | null} */
let specLoad = null;
/** @type {Map<HTMLElement, LiveState>} */
const live = new Map();
let raf = 0;
let lastT = 0;
let io = null;
let watching = false;

/**
 * @typedef {{
 *   el: HTMLElement,
 *   spec: object,
 *   kind: string,
 *   canvas: HTMLCanvasElement | null,
 *   visible: boolean,
 *   angle: number,
 *   foam: number,
 *   foamOffset: number[],
 *   level: number,
 *   targetLevel: number,
 *   dragBoost: number,
 *   tiltRad: number,
 *   faceRad: number,
 *   agitation: number,
 *   maskNw: number,
 *   maskNh: number,
 *   frozen: boolean,
 *   holoMask: HTMLImageElement | null,
 *   ro: ResizeObserver | null,
 * }} LiveState
 */

function assetPrefix() {
  const raw = document.body?.dataset?.root ?? './';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function prefersReduced() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

export function loadLiveArt() {
  if (specMap) return Promise.resolve(specMap);
  if (specLoad) return specLoad;
  specLoad = fetch(`${assetPrefix()}assets/data/item-live-art.json`)
    .then((r) => (r.ok ? r.json() : { items: {} }))
    .then((j) => {
      specMap = j?.items && typeof j.items === 'object' ? j.items : {};
      return specMap;
    })
    .catch(() => {
      specMap = {};
      return specMap;
    });
  return specLoad;
}

void loadLiveArt();

export function liveArtSpec(itemId) {
  return specMap?.[String(itemId || '')] || null;
}

function imgTag(cls, file, defer, extra = '') {
  const src = `${assetPrefix()}${layerSrc(file)}`;
  return defer
    ? `<img class="${cls}" data-src="${escapeAttr(src)}" alt="" draggable="false" decoding="async"${extra} />`
    : `<img class="${cls}" src="${escapeAttr(src)}" alt="" draggable="false" decoding="async"${extra} />`;
}

function glowOpacityRange(spec) {
  const light = LIGHT_GLOW.test(spec.glow || '');
  let a = Number(spec.opacity?.[0]);
  let b = Number(spec.opacity?.[1]);
  if (!Number.isFinite(a)) a = spec.additive === false ? 0.72 : 0.28;
  if (!Number.isFinite(b)) b = spec.additive === false ? 1 : 0.45;
  if (spec.additive !== false) {
    // Parchment washes easily — keep soft lights quieter than Godot-on-dark.
    a = Math.min(a, light ? 0.28 : 0.38);
    b = Math.min(b, light ? 0.48 : 0.5);
  }
  return [a, b];
}

function glowImgExtra(spec, kind) {
  const [op0, op1] = glowOpacityRange(spec);
  return ` style="--bpb-live-period:${Number(spec.period) || (kind === 'flicker' ? 4 : 5)}s;--bpb-live-op0:${op0};--bpb-live-op1:${op1}"`;
}

function glowLayerHtml(spec, kind, defer) {
  const light = LIGHT_GLOW.test(spec.glow || '');
  const cls = `bpb-live__glow bpb-live__layer${
    kind === 'flicker' ? ' bpb-live__glow--flicker' : ' bpb-live__glow--pulse'
  }${light ? ' bpb-live__glow--light' : ''}`;
  // Soft lights are the alpha disc PNG itself (no solid-bg mask plate —
  // that painted gray/blue rectangles with plus-lighter).
  return imgTag(cls, spec.glow, defer, glowImgExtra(spec, kind));
}

function cropStyle(cropSrc) {
  if (!cropSrc) return '';
  const u = `url(${escapeAttr(cropSrc)})`;
  return `-webkit-mask-image:${u};mask-image:${u};-webkit-mask-source-type:alpha;mask-mode:alpha;`;
}

function layerUrl(file) {
  const rel = `${assetPrefix()}${layerSrc(file)}`;
  try {
    return new URL(rel, document.baseURI || window.location.href).href;
  } catch {
    return rel;
  }
}

/**
 * Layered sprite inner HTML, or null to keep the baked still.
 * @param {object} item
 * @param {{ src?: string, defer?: boolean, anchorStyle?: string, sizeStyle?: string }} opts
 */
export function liveInnerHtml(item, opts = {}) {
  const spec = liveArtSpec(item?.id);
  if (!spec) return null;
  const style = `${opts.anchorStyle || ''}${opts.sizeStyle || ''}`;
  const defer = opts.defer === true;
  const still = opts.src || '';
  const kind = spec.kind === 'flicker' ? 'flicker' : spec.kind;
  if (kind === 'potion') {
    const maskU = spec.mask ? layerUrl(spec.mask) : layerUrl(spec.flask);
    const badge = spec.badge
      ? imgTag('bpb-live__badge bpb-live__layer bpb-live__badge--plate', spec.badge, defer)
      : '';
    return `<span class="bpb-bg__sprite bpb-live" data-live-kind="potion" data-item-id="${escapeAttr(item.id)}" style="${style}">
      ${imgTag('bpb-live__flask bpb-live__layer', spec.flask, defer)}
      <canvas class="bpb-live__liquid bpb-live__liquid--plate bpb-live--crop" aria-hidden="true" style="${cropStyle(maskU)}"></canvas>
      ${spec.overlay ? imgTag('bpb-live__overlay bpb-live__layer bpb-live__overlay--plate', spec.overlay, defer) : ''}
      ${badge}
    </span>`;
  }
  const glow = spec.glow ? glowLayerHtml(spec, kind, defer) : '';
  const holo = spec.kind === 'holo' || spec.holo
    ? `<canvas class="bpb-live__holo" aria-hidden="true"></canvas>`
    : '';
  if (!glow && !holo) return null;
  const base = still
    ? defer
      ? `<img class="bpb-live__base bpb-live__layer" data-src="${escapeAttr(still)}" alt="" draggable="false" decoding="async" />`
      : `<img class="bpb-live__base bpb-live__layer" src="${escapeAttr(still)}" alt="" draggable="false" decoding="async" />`
    : '';
  // Do not mask the glow/holo wrap with the item sprite — dark steel can
  // luminance-punch itself out. Soft lights may bleed outside the sprite box
  // (overflow:visible); potions keep overflow:hidden for liquid crop.
  return `<span class="bpb-bg__sprite bpb-live" data-live-kind="${escapeAttr(kind)}" data-item-id="${escapeAttr(item.id)}" style="${style}">
    ${base}${holo}${glow}
  </span>`;
}

function ensureIo() {
  if (io) return io;
  io = new IntersectionObserver(
    (entries) => {
      for (const ent of entries) {
        const st = live.get(ent.target);
        if (st) st.visible = ent.isIntersecting;
      }
      kick();
    },
    { root: null, rootMargin: '80px', threshold: 0.01 },
  );
  return io;
}

function kick() {
  if (raf) return;
  raf = requestAnimationFrame(tick);
}

function tick(now) {
  raf = 0;
  const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016;
  lastT = now;
  const reduced = prefersReduced();
  const tSec = now / 1000;
  const visible = [];
  for (const st of live.values()) {
    if (!st.el.isConnected) {
      live.delete(st.el);
      continue;
    }
    if (st.visible) visible.push(st);
  }
  visible.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const drawList = visible.slice(0, MAX_DRAW);
  for (const st of drawList) {
    if (st.kind === 'potion' && st.canvas) {
      const speed = 60 * dt;
      if (st.targetLevel !== st.level) {
        const dir = st.targetLevel < st.level ? -1 : 1;
        st.level += dir * dt * 2;
        if ((dir < 0 && st.level <= st.targetLevel) || (dir > 0 && st.level >= st.targetLevel)) {
          st.level = st.targetLevel;
        }
      }
      // BottleOfBooze.gd: targetAngle = -global_rotation + PI/2.
      // Web CSS rotate() + canvas Y-flip need the opposite face sign so liquid
      // settles to screen-bottom (not the ceiling) when the flask spins.
      st.faceRad = readItemFaceRad(st);
      if (!reduced) {
        st.dragBoost *= Math.exp(-10 * dt);
        st.agitation = (st.agitation || 0) * Math.exp(-4.5 * dt);
        const baseFoam = st.spec.baseFoaminess || 0.05;
        st.foam = baseFoam + st.agitation;
        st.angle =
          Math.PI / 2 +
          (st.faceRad || 0) +
          (st.tiltRad || 0) +
          st.dragBoost +
          Math.sin(tSec * 0.38) * 0.045;
        st.foamOffset[1] += 0.01 * (st.foam + (st.spec.baseScroll || 0.03)) * speed;
      } else if (!st.frozen) {
        st.angle = Math.PI / 2 + (st.faceRad || 0);
        st.foam = st.spec.baseFoaminess || 0.05;
      }
      drawPotion(st.canvas, st.spec, {
        angle: st.angle,
        foaminess: st.foam,
        foamOffset: st.foamOffset,
        levelOffset: st.level,
      });
      st.frozen = reduced;
    } else if ((st.kind === 'holo' || st.spec.holo) && st.canvas) {
      const spec = st.spec.holo || st.spec;
      if (reduced && st.frozen) continue;
      drawHolo(st.canvas, spec, st.holoMask, reduced ? 0 : tSec);
      st.frozen = reduced;
    }
  }
  if (visible.length && !reduced) kick();
  else if (visible.some((s) => s.level !== s.targetLevel)) kick();
}

function whenImgReady(img, fn) {
  if (!(img instanceof HTMLImageElement)) return;
  if (img.complete && img.naturalWidth) {
    fn();
    return;
  }
  img.addEventListener('load', fn, { once: true });
}

function bindState(wrap, spec) {
  if (live.has(wrap)) return live.get(wrap);
  const canvas =
    wrap.querySelector('canvas.bpb-live__liquid, canvas.bpb-live__holo') || null;
  const kind = wrap.getAttribute('data-live-kind') || spec.kind;
  /** @type {LiveState} */
  const st = {
    el: wrap,
    spec,
    kind,
    canvas: canvas instanceof HTMLCanvasElement ? canvas : null,
    visible: true,
    angle: Math.PI / 2,
    foam: spec.baseFoaminess || 0.05,
    foamOffset: [0, 0],
    level: Number(spec.levelModification) || 0,
    targetLevel: Number(spec.levelModification) || 0,
    dragBoost: 0,
    tiltRad: 0,
    faceRad: 0,
    agitation: 0,
    frozen: false,
    holoMask: null,
    maskNw: 0,
    maskNh: 0,
    ro: null,
  };
  live.set(wrap, st);
  st.priority = wrap.closest?.('.create-board__cursor') ? 1 : 0;
  if (!st.priority) ensureIo().observe(wrap);
  else st.visible = true;
  st.faceRad = readItemFaceRad(st);

  const layout = () => {
    layoutGlowPlate(st);
    layoutLiquidPlate(st);
    kick();
  };
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(layout);
    ro.observe(wrap);
    st.ro = ro;
  }
  if (kind === 'potion') {
    void preloadPotionMaps(spec);
    const flask = wrap.querySelector('img.bpb-live__flask');
    const overlay = wrap.querySelector('img.bpb-live__overlay');
    const badge = wrap.querySelector('img.bpb-live__badge');
    whenImgReady(flask, layout);
    whenImgReady(overlay, layout);
    whenImgReady(badge, layout);
    if (spec.mask) {
      void loadImage(layerSrc(spec.mask)).then((img) => {
        if (img?.naturalWidth) {
          st.maskNw = img.naturalWidth;
          st.maskNh = img.naturalHeight;
          layout();
        }
      });
    }
    layout();
  }
  if (kind === 'holo' || spec.holo) {
    void preloadHoloMaps(spec.holo || spec);
    const base = wrap.querySelector('img.bpb-live__base');
    if (base instanceof HTMLImageElement) {
      const apply = () => {
        st.holoMask = base;
        kick();
      };
      if (base.complete && base.naturalWidth) apply();
      else base.addEventListener('load', apply, { once: true });
    }
  }
  if (kind === 'glow' || kind === 'flicker' || spec.glow) {
    const base = wrap.querySelector('img.bpb-live__base');
    const glow = wrap.querySelector('img.bpb-live__glow');
    const prepGlow = () => {
      if (
        glow instanceof HTMLImageElement &&
        !glow.dataset.bpbLightBaked &&
        (glow.classList.contains('bpb-live__glow--light') || LIGHT_GLOW.test(String(spec.glow || '')))
      ) {
        bakeLightPlate(glow, Array.isArray(spec.tint) ? spec.tint : null);
        whenImgReady(glow, layout);
        return;
      }
      layout();
    };
    whenImgReady(base, layout);
    whenImgReady(glow, prepGlow);
    layout();
  }
  kick();
  return st;
}

export function mountLiveArt(itemEl) {
  if (!(itemEl instanceof HTMLElement)) return;
  const wrap = itemEl.querySelector('.bpb-live');
  if (!(wrap instanceof HTMLElement)) return;
  const id = wrap.getAttribute('data-item-id') || itemEl.getAttribute('data-item-id');
  const spec = liveArtSpec(id);
  if (!spec) return;
  wrap.classList.add('is-live');
  bindState(wrap, spec);
}

/**
 * Drop rAF / IO / ResizeObserver for a parked Itemiary piece.
 * @param {HTMLElement | null | undefined} itemEl
 */
export function unmountLiveArt(itemEl) {
  if (!(itemEl instanceof HTMLElement)) return;
  const wrap = itemEl.querySelector('.bpb-live');
  if (!(wrap instanceof HTMLElement)) return;
  wrap.classList.remove('is-live');
  const st = live.get(wrap);
  if (!st) return;
  io?.unobserve(wrap);
  st.ro?.disconnect();
  live.delete(wrap);
}

export function refreshLiveArt(root) {
  const host = root instanceof Element ? root : document;
  host.querySelectorAll?.('.bpb-live').forEach((n) => {
    if (n instanceof HTMLElement) {
      const item = n.closest('.bpb-bg__item');
      mountLiveArt(item instanceof HTMLElement ? item : n);
    }
  });
}

function watchDom() {
  if (watching) return;
  watching = true;
  refreshLiveArt(document);
}

export function ensureLiveArt() {
  void loadLiveArt().then(() => {
    const start = () => watchDom();
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
  });
}

/**
 * @param {HTMLElement | null | undefined} itemEl
 * @param {number} level 0 = full, -1 = empty
 * @param {{ ms?: number }} [opts]
 */
export function setPotionLevel(itemEl, level, opts = {}) {
  if (!(itemEl instanceof HTMLElement)) return;
  const wrap = itemEl.querySelector('.bpb-live[data-live-kind="potion"]') || itemEl;
  const st = live.get(wrap) || (liveArtSpec(itemEl.getAttribute('data-item-id')) ? bindState(wrap, liveArtSpec(itemEl.getAttribute('data-item-id'))) : null);
  if (!st) return;
  st.targetLevel = Number(level) || 0;
  if (opts.ms === 0) st.level = st.targetLevel;
  itemEl.toggleAttribute('data-potion-empty', st.targetLevel < -0.4);
  kick();
}

/**
 * Pointer slosh for BottleOfBooze — liquid stays world-level while the flask
 * tilts (Item.gd bonusRotation), plus foam from motion.
 * @param {HTMLElement | null | undefined} itemEl
 * @param {number} dx
 * @param {number} dy
 * @param {{ tiltDeg?: number }} [opts]
 */
export function feedLiveDrag(itemEl, dx, dy, opts = {}) {
  if (!(itemEl instanceof HTMLElement)) return;
  const wrap = itemEl.querySelector('.bpb-live') || (itemEl.classList.contains('bpb-live') ? itemEl : null);
  const st = wrap && live.get(wrap);
  if (!st || st.kind !== 'potion') return;
  const x = Number(dx) || 0;
  const y = Number(dy) || 0;
  st.dragBoost = Math.max(-0.7, Math.min(0.7, st.dragBoost + x * 0.0024 - y * 0.0006));
  st.agitation = Math.min(0.55, (st.agitation || 0) + Math.hypot(x, y) * 0.0014);
  const tilt = Number(opts.tiltDeg);
  if (Number.isFinite(tilt)) st.tiltRad = (tilt * Math.PI) / 180;
  const face = Number(opts.faceDeg);
  if (Number.isFinite(face)) st.faceRad = (face * Math.PI) / 180;
  kick();
}

/**
 * Face spin (0–3) — match BottleOfBooze.gd targetAngle vs global_rotation.
 * Call when data-face changes so liquid counter-rotates with the flask.
 * @param {HTMLElement | null | undefined} itemEl
 */
export function syncLiveArtFace(itemEl) {
  if (!(itemEl instanceof HTMLElement)) return;
  const wrap = itemEl.querySelector('.bpb-live[data-live-kind="potion"]');
  const st = wrap && live.get(wrap);
  if (!st) return;
  const next = readItemFaceRad(st);
  const prev = st.faceRad || 0;
  let d = next - prev;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) > 0.05) {
    st.agitation = Math.min(0.55, (st.agitation || 0) + Math.min(0.4, Math.abs(d) * 0.35));
    st.dragBoost = Math.max(-0.55, Math.min(0.55, st.dragBoost + d * 0.2));
  }
  st.faceRad = next;
  kick();
}

ensureLiveArt();
