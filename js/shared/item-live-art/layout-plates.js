/**
 * Glow / liquid plate layout (Godot Icon-child Sprite sizes + positions).
 */

const LIGHT_GLOW = /(?:CircleLight|TorchLight|StarLight)\.png$/i;

export function containScale(img) {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!(nw > 0 && nh > 0)) return 0;
  const bw = img.clientWidth;
  const bh = img.clientHeight;
  if (!(bw > 0 && bh > 0)) return 0;
  return Math.min(bw / nw, bh / nh);
}

/** Prefer the visible art spin — shadow node is first in the DOM. */
export function readItemFaceRad(st) {
  const item = st.el.closest?.('.bpb-bg__item');
  if (!item) return st.faceRad || 0;
  const spin =
    item.querySelector(':scope > .bpb-bg__spin:not(.bpb-bg__spin--shadow)') ||
    item.querySelector(':scope > .bpb-bg__spin');
  if (spin instanceof HTMLElement) {
    const inline = spin.style.rotate || '';
    const deg2 = inline.match(/(-?[\d.]+)deg/);
    if (deg2) return (Number(deg2[1]) * Math.PI) / 180;
    const rot = getComputedStyle(spin).rotate || '';
    const degM = rot.match(/(-?[\d.]+)deg/);
    if (degM) return (Number(degM[1]) * Math.PI) / 180;
  }
  const face = ((Number(item.getAttribute('data-face')) || 0) % 4 + 4) % 4;
  return face * (Math.PI / 2);
}

/**
 * @param {{ el: HTMLElement, spec: object, maskNw?: number, maskNh?: number }} st
 */
export function layoutLiquidPlate(st) {
  const wrap = st.el;
  const flask = wrap.querySelector('img.bpb-live__flask');
  const liquid = wrap.querySelector('canvas.bpb-live__liquid');
  if (!(flask instanceof HTMLImageElement) || !(liquid instanceof HTMLCanvasElement)) return;
  if (!flask.naturalWidth) return;
  const s = containScale(flask);
  if (!(s > 0)) return;
  const nw = st.maskNw || flask.naturalWidth;
  const nh = st.maskNh || flask.naturalHeight;
  const sc = Array.isArray(st.spec?.liquidScale) ? st.spec.liquidScale : [1, 1];
  const sx = Number(sc[0]);
  const sy = Number(sc[1]);
  const scaleX = Number.isFinite(sx) && sx > 0 ? sx : 1;
  const scaleY = Number.isFinite(sy) && sy > 0 ? sy : 1;
  const w = nw * scaleX * s;
  const h = nh * scaleY * s;
  const pos = Array.isArray(st.spec?.liquidPos) ? st.spec.liquidPos : [0, 0];
  const gx = (Number(pos[0]) || 0) * s;
  const gy = (Number(pos[1]) || 0) * s;
  liquid.style.width = `${w}px`;
  liquid.style.height = `${h}px`;
  liquid.style.left = '50%';
  liquid.style.top = '50%';
  liquid.style.translate = `calc(-50% + ${gx}px) calc(-50% + ${gy}px)`;
  const overlay = wrap.querySelector('img.bpb-live__overlay--plate');
  if (overlay instanceof HTMLImageElement) {
    const op = Array.isArray(st.spec?.overlayPos) ? st.spec.overlayPos : pos;
    const ox = (Number(op[0]) || 0) * s;
    const oy = (Number(op[1]) || 0) * s;
    const onw = overlay.naturalWidth || nw;
    const onh = overlay.naturalHeight || nh;
    overlay.style.width = `${onw * scaleX * s}px`;
    overlay.style.height = `${onh * scaleY * s}px`;
    overlay.style.left = '50%';
    overlay.style.top = '50%';
    overlay.style.translate = `calc(-50% + ${ox}px) calc(-50% + ${oy}px)`;
  }
  const badge = wrap.querySelector('img.bpb-live__badge--plate');
  if (badge instanceof HTMLImageElement) {
    const bp = Array.isArray(st.spec?.badgePos) ? st.spec.badgePos : [0, 0];
    const bx = (Number(bp[0]) || 0) * s;
    const by = (Number(bp[1]) || 0) * s;
    const bsc = Array.isArray(st.spec?.badgeScale) ? st.spec.badgeScale : [1, 1];
    const bsx = Number(bsc[0]);
    const bsy = Number(bsc[1]);
    const badgeSx = Number.isFinite(bsx) && bsx > 0 ? bsx : 1;
    const badgeSy = Number.isFinite(bsy) && bsy > 0 ? bsy : badgeSx;
    const bnw = badge.naturalWidth || nw;
    const bnh = badge.naturalHeight || nh;
    badge.style.width = `${bnw * badgeSx * s}px`;
    badge.style.height = `${bnh * badgeSy * s}px`;
    badge.style.left = '50%';
    badge.style.top = '50%';
    badge.style.translate = `calc(-50% + ${bx}px) calc(-50% + ${by}px)`;
  }
}

/**
 * @param {{ el: HTMLElement, spec: object }} st
 */
export function layoutGlowPlate(st) {
  const wrap = st.el;
  const base = wrap.querySelector('img.bpb-live__base');
  const glow = wrap.querySelector('img.bpb-live__glow');
  if (!(base instanceof HTMLImageElement) || !(glow instanceof HTMLImageElement)) return;
  if (!base.naturalWidth || !glow.naturalWidth) return;
  const s = containScale(base);
  if (!(s > 0)) return;
  const pos = Array.isArray(st.spec?.pos) ? st.spec.pos : [0, 0];
  const gx = (Number(pos[0]) || 0) * s;
  const gy = (Number(pos[1]) || 0) * s;
  const light =
    glow.classList.contains('bpb-live__glow--light') ||
    LIGHT_GLOW.test(String(st.spec?.glow || ''));
  const sc = Array.isArray(st.spec?.scale) ? st.spec.scale : [1, 1];
  const sx = Number(sc[0]);
  const sy = Number(sc[1]);
  const scaleX = Number.isFinite(sx) && sx > 0 ? sx : light ? 0.7 : 1;
  const scaleY = Number.isFinite(sy) && sy > 0 ? sy : scaleX;
  glow.style.width = `${glow.naturalWidth * scaleX * s}px`;
  glow.style.height = `${glow.naturalHeight * scaleY * s}px`;
  glow.style.translate = `calc(-50% + ${gx}px) calc(-50% + ${gy}px)`;
}

/**
 * Tint + tighten soft light falloff for parchment (Godot Additive on dark boards).
 * @param {HTMLImageElement} img
 * @param {number[] | null | undefined} tint
 */
export function bakeLightPlate(img, tint) {
  if (!(img instanceof HTMLImageElement) || img.dataset.bpbLightBaked) return;
  if (!img.naturalWidth) return;
  const r = Number(tint?.[0]);
  const g = Number(tint?.[1]);
  const b = Number(tint?.[2]);
  const tr = Number.isFinite(r) ? r : 1;
  const tg = Number.isFinite(g) ? g : 1;
  const tb = Number.isFinite(b) ? b : 1;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, c.width, c.height);
  const d = id.data;
  const cx = c.width * 0.5;
  const cy = c.height * 0.5;
  const maxR = Math.min(cx, cy) || 1;
  for (let i = 0; i < d.length; i += 4) {
    const px = (i / 4) % c.width;
    const py = ((i / 4) / c.width) | 0;
    const dist = Math.hypot(px - cx, py - cy) / maxR;
    let a = d[i + 3] / 255;
    if (dist > 0.9) a = 0;
    else if (dist > 0.62) a *= 1 - (dist - 0.62) / 0.28;
    a **= 1.45;
    d[i] = Math.round(d[i] * tr);
    d[i + 1] = Math.round(d[i + 1] * tg);
    d[i + 2] = Math.round(d[i + 2] * tb);
    d[i + 3] = Math.round(Math.min(255, a * 255));
  }
  ctx.putImageData(id, 0, 0);
  img.dataset.bpbLightBaked = '1';
  img.src = c.toDataURL('image/png');
}

export { LIGHT_GLOW };
