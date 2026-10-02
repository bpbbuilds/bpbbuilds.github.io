/**
 * Composite-bake an item's Icon tree (base + child sprites + potion liquid) to one PNG.
 */

import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const SKIP_NODE =
  /^(Sockets|GemSocket\d*|SpecificDragParticles|ActivationParticles|AnimationPlayer|ClickArea|CollisionPolygon2D|CollisionMap|BottomCenter|CircleLight|Light2D|TorchLight|Flames|Aura|RemoteTransform2D)$/i;
const SKIP_TYPE = /^(Particles2D|AnimationPlayer|Light2D|CPUParticles2D|RemoteTransform2D|Timer)$/i;
const FLUID_NAME = /^(BottleOfBooze|Fluid)$/i;
/** Glow/mask plates meant for additive shaders — bake as solid white if drawn normally. */
const SKIP_TEX =
  /(?:^|\/)(?:DivingPhoenixLight|.*Light|.*_mask\d*|GlowingDot|RingLight\d*)\.png$/i;
const ADDITIVE_MAT = /AdditiveCanvasItemMaterial/i;

const RAINBOW_GRADIENT = {
  offsets: [0, 0.2, 0.4, 0.6, 0.8, 1],
  colors: [
    { r: 1, g: 0.15, b: 0.15, a: 0.95 },
    { r: 1, g: 0.65, b: 0.1, a: 0.95 },
    { r: 0.95, g: 0.9, b: 0.15, a: 0.95 },
    { r: 0.2, g: 0.85, b: 0.25, a: 0.95 },
    { r: 0.2, g: 0.45, b: 1, a: 0.95 },
    { r: 0.65, g: 0.2, b: 0.95, a: 0.95 },
  ],
};

const LAB_FLUID = { r: 0.55, g: 0.2, b: 0.85, a: 0.9 };

export function parseExtResources(text) {
  const map = new Map();
  for (const m of text.matchAll(/\[ext_resource path="([^"]+)"[^\]]*id=(\d+)\]/g)) {
    map.set(m[2], m[1]);
  }
  return map;
}

function parseVector2(raw, fallback = { x: 0, y: 0 }) {
  if (raw == null) return { ...fallback };
  const m = String(raw).match(
    /Vector2\s*\(\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*\)/,
  );
  if (!m) return { ...fallback };
  return { x: Number(m[1]), y: Number(m[2]) };
}

function parseRect2(raw) {
  if (raw == null) return null;
  const m = String(raw).match(
    /Rect2\s*\(\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*\)/,
  );
  if (!m) return null;
  return {
    x: Number(m[1]),
    y: Number(m[2]),
    w: Number(m[3]),
    h: Number(m[4]),
  };
}

function parseColor(raw, fallback = { r: 1, g: 1, b: 1, a: 1 }) {
  if (raw == null) return { ...fallback };
  const m = String(raw).match(
    /Color\s*\(\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*\)/,
  );
  if (!m) return { ...fallback };
  return {
    r: Number(m[1]),
    g: Number(m[2]),
    b: Number(m[3]),
    a: Number(m[4]),
  };
}

function parseNumber(raw, fallback = 0) {
  if (raw == null || raw === '') return fallback;
  const n = Number(String(raw).trim());
  return Number.isFinite(n) ? n : fallback;
}

function parseBool(raw, fallback = false) {
  if (raw == null) return fallback;
  const s = String(raw).trim().toLowerCase();
  if (s === 'true') return true;
  if (s === 'false') return false;
  return fallback;
}

function parseExtId(raw) {
  const m = String(raw || '').match(/ExtResource\s*\(\s*(\d+)\s*\)/);
  return m ? m[1] : null;
}

function parseSubId(raw) {
  const m = String(raw || '').match(/SubResource\s*\(\s*(\d+)\s*\)/);
  return m ? m[1] : null;
}

/** @returns {{ name: string, type: string|null, parent: string|null, instanceId: string|null, props: Record<string,string> }[]} */
export function parseSceneNodes(text) {
  const chunks = text.split(/(?=\[node )/g).filter((c) => c.startsWith('[node '));
  const nodes = [];
  for (const chunk of chunks) {
    const header = chunk.match(/\[node name="([^"]+)"([^\]]*)\]/);
    if (!header) continue;
    const name = header[1];
    const attrs = header[2];
    const typeM = attrs.match(/\btype="([^"]+)"/);
    const parentM = attrs.match(/\bparent="([^"]+)"/);
    const instanceM = attrs.match(/\binstance=ExtResource\(\s*(\d+)\s*\)/);
    const body = chunk.slice(header[0].length);
    const props = {};
    for (const line of body.split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
      if (!m) continue;
      props[m[1]] = m[2].trim();
    }
    nodes.push({
      name,
      type: typeM?.[1] || null,
      parent: parentM?.[1] ?? null,
      instanceId: instanceM?.[1] || null,
      props,
    });
  }
  return nodes;
}

function parseGradients(text) {
  /** @type {Map<string, { offsets: number[], colors: {r:number,g:number,b:number,a:number}[] }>} */
  const gradients = new Map();
  for (const m of text.matchAll(
    /\[sub_resource type="Gradient" id=(\d+)\]([\s\S]*?)(?=\n\[|$)/g,
  )) {
    const id = m[1];
    const body = m[2];
    const offRaw = body.match(/offsets\s*=\s*PoolRealArray\s*\(([^)]*)\)/)?.[1] || '';
    const colRaw = body.match(/colors\s*=\s*PoolColorArray\s*\(([^)]*)\)/)?.[1] || '';
    const offsets = [...offRaw.matchAll(/[-\d.eE+]+/g)].map((x) => Number(x[0]));
    const nums = [...colRaw.matchAll(/[-\d.eE+]+/g)].map((x) => Number(x[0]));
    const colors = [];
    for (let i = 0; i + 3 < nums.length; i += 4) {
      colors.push({ r: nums[i], g: nums[i + 1], b: nums[i + 2], a: nums[i + 3] });
    }
    if (colors.length) gradients.set(id, { offsets, colors });
  }

  /** @type {Map<string, string>} */
  const gradTex = new Map();
  for (const m of text.matchAll(
    /\[sub_resource type="GradientTexture" id=(\d+)\]([\s\S]*?)(?=\n\[|$)/g,
  )) {
    const g = parseSubId(m[2].match(/gradient\s*=\s*(SubResource\([^)]+\))/)?.[1]);
    if (g) gradTex.set(m[1], g);
  }

  /** @type {Map<string, string>} */
  const matGrad = new Map();
  for (const m of text.matchAll(
    /\[sub_resource type="ShaderMaterial" id=(\d+)\]([\s\S]*?)(?=\n\[|$)/g,
  )) {
    const g = parseSubId(
      m[2].match(/shader_param\/gradient\s*=\s*(SubResource\([^)]+\))/)?.[1],
    );
    if (g) matGrad.set(m[1], g);
  }

  return { gradients, gradTex, matGrad };
}

function sampleGradient(grad, t) {
  if (!grad?.colors?.length) return null;
  const offsets =
    grad.offsets?.length === grad.colors.length
      ? grad.offsets
      : grad.colors.map((_, i) => i / Math.max(1, grad.colors.length - 1));
  const x = Math.min(1, Math.max(0, t));
  if (x <= offsets[0]) return grad.colors[0];
  if (x >= offsets[offsets.length - 1]) return grad.colors[grad.colors.length - 1];
  for (let i = 0; i < offsets.length - 1; i += 1) {
    if (x >= offsets[i] && x <= offsets[i + 1]) {
      const u = (x - offsets[i]) / Math.max(1e-6, offsets[i + 1] - offsets[i]);
      const a = grad.colors[i];
      const b = grad.colors[i + 1];
      return {
        r: a.r + (b.r - a.r) * u,
        g: a.g + (b.g - a.g) * u,
        b: a.b + (b.b - a.b) * u,
        a: a.a + (b.a - a.a) * u,
      };
    }
  }
  return grad.colors[grad.colors.length - 1];
}

function mulColor(a, b) {
  return { r: a.r * b.r, g: a.g * b.g, b: a.b * b.b, a: a.a * b.a };
}

function identity() {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

function mulMat(p, l) {
  return {
    a: p.a * l.a + p.c * l.b,
    b: p.b * l.a + p.d * l.b,
    c: p.a * l.c + p.c * l.d,
    d: p.b * l.c + p.d * l.d,
    e: p.a * l.e + p.c * l.f + p.e,
    f: p.b * l.e + p.d * l.f + p.f,
  };
}

function localMat(pos, rot, scale) {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return {
    a: cos * scale.x,
    b: sin * scale.x,
    c: -sin * scale.y,
    d: cos * scale.y,
    e: pos.x,
    f: pos.y,
  };
}

function xformPoint(m, x, y) {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

function resToAbs(extractRoot, resPath) {
  if (!resPath?.startsWith('res://')) return null;
  const abs = path.join(
    extractRoot,
    resPath.slice('res://'.length).replace(/\//g, path.sep),
  );
  return fs.existsSync(abs) ? abs : null;
}

function colorLuma(c) {
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
}

function colorSat(c) {
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  return max < 1e-6 ? 0 : (max - min) / max;
}

/** Game foam stops are often white/near-white — unusable for a flat catalog fill. */
function isFoamOrWhiteStop(c) {
  if (!c) return true;
  if (c.a < 0.25) return true;
  if (colorLuma(c) > 0.9 && colorSat(c) < 0.35) return true;
  if (colorLuma(c) > 0.85 && colorSat(c) < 0.2) return true;
  return false;
}

/** Drop transparent/white foam stops; keep saturated liquid colors. */
function filterLiquidGradient(grad) {
  if (!grad?.colors?.length) return null;
  const offsets =
    grad.offsets?.length === grad.colors.length
      ? grad.offsets
      : grad.colors.map((_, i) => i / Math.max(1, grad.colors.length - 1));
  const kept = [];
  for (let i = 0; i < grad.colors.length; i += 1) {
    const c = grad.colors[i];
    if (isFoamOrWhiteStop(c)) continue;
    kept.push({ offset: offsets[i], color: { ...c, a: 1 } });
  }
  if (kept.length < 2) return null;
  const o0 = kept[0].offset;
  const o1 = kept[kept.length - 1].offset;
  const span = Math.max(1e-6, o1 - o0);
  return {
    offsets: kept.map((k) => (k.offset - o0) / span),
    colors: kept.map((k) => k.color),
  };
}

/**
 * Map pale/special potionColors to catalog-readable fills matching in-game look.
 * @param {{ r:number,g:number,b:number,a?:number }|null} c
 * @param {string} itemKey root node / file stem
 */
function enrichPotionColor(c, itemKey = '') {
  const key = String(itemKey || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

  // Stone Skin handled as textured fill (see resolveFluidStyle)
  // Divine / Holy: luminous pale gold (not muddy mustard)
  if (key.includes('divine') || key.includes('holypotion')) {
    return { r: 0.98, g: 0.9, b: 0.55, a: 1 };
  }
  // Demonic: deep purple so the star emblem reads like the game
  if (key.includes('demonic')) {
    return { r: 0.32, g: 0.06, b: 0.42, a: 1 };
  }
  // Lightning bottle liquid is teal; bolt is a separate shader (wiki composite preferred)
  if (key.includes('lightning')) {
    return { r: 0.12, g: 0.72, b: 0.62, a: 1 };
  }

  if (!c) return LAB_FLUID;
  let { r, g, b } = c;
  let lum = colorLuma({ r, g, b });
  let sat = colorSat({ r, g, b });

  // Only gently lift near-white fills — don't crush saturated potion colors
  if (lum > 0.85 && sat < 0.25) {
    const f = 0.62 / lum;
    r *= f;
    g *= f;
    b *= f;
  } else if (lum > 0.78 && sat < 0.2) {
    r = Math.min(1, r * 0.85);
    g = Math.min(1, g * 0.85);
    b = Math.min(1, b * 0.9);
  }

  return {
    r: Math.min(1, Math.max(0, r)),
    g: Math.min(1, Math.max(0, g)),
    b: Math.min(1, Math.max(0, b)),
    a: 1,
  };
}

function resolveFluidStyle(node, potionColor, gradInfo, itemKey = '') {
  const keyNorm = String(itemKey || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

  // Stone Skin uses StoneSkinPotion.material (rocky slurry) — flat silver looks empty.
  if (keyNorm.includes('stoneskin')) {
    return {
      kind: 'stone',
      color: { r: 0.52, g: 0.48, b: 0.4, a: 1 },
      light: { r: 0.78, g: 0.74, b: 0.62, a: 1 },
      textureRes: 'res://Items/Sprites/Stone.png',
    };
  }

  const nearBlack =
    potionColor && potionColor.r + potionColor.g + potionColor.b < 0.05;
  if (nearBlack) return { kind: 'gradient', gradient: RAINBOW_GRADIENT };

  // Prefer ItemData potionColor — scene gradients include white foam bands that
  // bake as blank flask interiors when sampled as a simple vertical fill.
  if (potionColor && !nearBlack) {
    const linked = (() => {
      const subMat = parseSubId(node.props.material);
      if (!subMat || !gradInfo.matGrad.has(subMat)) return null;
      let gid = gradInfo.matGrad.get(subMat);
      if (gradInfo.gradTex.has(gid)) gid = gradInfo.gradTex.get(gid);
      return filterLiquidGradient(gradInfo.gradients.get(gid));
    })();

    // Use scene gradient only when it's clearly colorful (e.g. Mana); else solid.
    if (
      linked &&
      linked.colors.every((c) => colorSat(c) > 0.25) &&
      !/divine|demonic|lightning/.test(keyNorm)
    ) {
      return { kind: 'gradient', gradient: linked };
    }
    return { kind: 'liquid', color: enrichPotionColor(potionColor, itemKey) };
  }

  const subMat = parseSubId(node.props.material);
  if (subMat && gradInfo.matGrad.has(subMat)) {
    let gid = gradInfo.matGrad.get(subMat);
    if (gradInfo.gradTex.has(gid)) gid = gradInfo.gradTex.get(gid);
    const filtered = filterLiquidGradient(gradInfo.gradients.get(gid));
    if (filtered) return { kind: 'gradient', gradient: filtered };
  }

  if (node.name === 'Fluid') return { kind: 'liquid', color: LAB_FLUID };

  return {
    kind: 'liquid',
    color: enrichPotionColor(potionColor, itemKey) || LAB_FLUID,
  };
}

/**
 * @param {import('@napi-rs/canvas').Image|null} [textureImg]
 */
function tintMaskImage(maskImg, style, modulate, textureImg = null) {
  const w = maskImg.width;
  const h = maskImg.height;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.drawImage(maskImg, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  // Game uses modulate 1.4 on fluids for bloom — that blows pale fills to white.
  const fluidMod = {
    r: Math.min(1, modulate.r),
    g: Math.min(1, modulate.g),
    b: Math.min(1, modulate.b),
    a: 1,
  };

  let texData = null;
  let tw = 0;
  let th = 0;
  if (textureImg && style.kind === 'stone') {
    const tc = createCanvas(textureImg.width, textureImg.height);
    const tctx = tc.getContext('2d');
    tctx.drawImage(textureImg, 0, 0);
    texData = tctx.getImageData(0, 0, textureImg.width, textureImg.height).data;
    tw = textureImg.width;
    th = textureImg.height;
  }

  for (let y = 0; y < h; y += 1) {
    const t = h <= 1 ? 0 : y / (h - 1);
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const a = d[i + 3];
      if (a < 10) {
        d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
        continue;
      }

      let col;
      if (style.kind === 'gradient') {
        col = sampleGradient(style.gradient, t) || { r: 1, g: 1, b: 1, a: 1 };
        if (isFoamOrWhiteStop(col)) {
          col = sampleGradient(style.gradient, Math.min(1, t + 0.35)) || col;
        }
        if (isFoamOrWhiteStop(col)) {
          col = sampleGradient(style.gradient, 0.55) || col;
        }
      } else if (style.kind === 'stone') {
        const base = style.color || { r: 0.5, g: 0.48, b: 0.4 };
        const light = style.light || { r: 0.78, g: 0.74, b: 0.62 };
        const shade = 0.65 + 0.35 * (1 - t);
        // Cheap crackle so the fill isn't flat glass
        const n =
          (Math.sin(x * 0.21 + y * 0.17) * Math.cos(x * 0.09 - y * 0.23) + 1) *
          0.5;
        const n2 = (Math.sin(x * 0.55 - y * 0.4) + 1) * 0.5;
        const mix = Math.min(1, Math.max(0, 0.35 + n * 0.45 + n2 * 0.2));
        col = {
          r: (base.r * (1 - mix) + light.r * mix) * shade,
          g: (base.g * (1 - mix) + light.g * mix) * shade,
          b: (base.b * (1 - mix) + light.b * mix) * shade,
          a: 1,
        };
        if (texData && tw && th) {
          const u = Math.floor((x / w) * tw * 1.35 + y * 0.08) % tw;
          const v = Math.floor((y / h) * th * 1.35 + x * 0.05) % th;
          const ui = ((u + tw) % tw) + ((v + th) % th) * tw;
          const ti = ui * 4;
          const ta = texData[ti + 3];
          const tr = texData[ti] / 255;
          const tg = texData[ti + 1] / 255;
          const tb = texData[ti + 2] / 255;
          const tlum = colorLuma({ r: tr, g: tg, b: tb });
          // Skip stone sprite's black matte / thick outlines
          if (ta > 40 && tlum > 0.18) {
            const blend = 0.55;
            col = {
              r: col.r * (1 - blend) + tr * col.r * 1.35 * blend,
              g: col.g * (1 - blend) + tg * col.g * 1.35 * blend,
              b: col.b * (1 - blend) + tb * col.b * 1.25 * blend,
              a: 1,
            };
          }
        }
      } else {
        const base = style.color || LAB_FLUID;
        const shade = 0.72 + 0.28 * (1 - t);
        const topGlow = t < 0.18 ? 0.92 + 0.08 * (t / 0.18) : 1;
        col = {
          r: base.r * shade * topGlow,
          g: base.g * shade * topGlow,
          b: base.b * shade * topGlow,
          a: 1,
        };
      }

      col = mulColor({ ...col, a: 1 }, fluidMod);
      d[i] = Math.min(255, Math.round(col.r * 255));
      d[i + 1] = Math.min(255, Math.round(col.g * 255));
      d[i + 2] = Math.min(255, Math.round(col.b * 255));
      d[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function applyModulate(baseImg, mod) {
  if (mod.r === 1 && mod.g === 1 && mod.b === 1 && mod.a === 1) return baseImg;
  const c = createCanvas(baseImg.width, baseImg.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(baseImg, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < data.data.length; i += 4) {
    data.data[i] = Math.min(255, data.data[i] * mod.r);
    data.data[i + 1] = Math.min(255, data.data[i + 1] * mod.g);
    data.data[i + 2] = Math.min(255, data.data[i + 2] * mod.b);
    data.data[i + 3] = Math.min(255, data.data[i + 3] * mod.a);
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

/**
 * @param {object} opts
 * @param {string} opts.scenePath absolute .tscn
 * @param {string} opts.extractRoot game-extract-full root
 * @param {string} opts.outPath destination png
 */
/** Draw a simple catalog lightning bolt (game uses a Pixel + Lightning.gdshader). */
function paintLightningBolt(ctx, width, height) {
  const cx = width * 0.5;
  const top = height * 0.18;
  const bot = height * 0.78;
  const pts = [
    [cx + width * 0.02, top],
    [cx - width * 0.08, height * 0.38],
    [cx + width * 0.04, height * 0.4],
    [cx - width * 0.1, bot],
    [cx + width * 0.02, height * 0.58],
    [cx + width * 0.1, height * 0.56],
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = 'rgba(180, 255, 255, 0.55)';
  ctx.lineWidth = Math.max(6, width * 0.06);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = Math.max(2.5, width * 0.025);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  ctx.restore();
}

export async function bakeItemSprite({ scenePath, extractRoot, outPath }) {
  const text = fs.readFileSync(scenePath, 'utf8');
  const ext = parseExtResources(text);
  const nodes = parseSceneNodes(text);
  const gradInfo = parseGradients(text);

  const root = nodes.find((n) => n.parent == null) || nodes[0];
  const itemKey = `${root?.name || ''} ${path.basename(scenePath, '.tscn')}`;
  const potionColor = root?.props?.potionColor
    ? parseColor(root.props.potionColor)
    : null;

  const icon = nodes.find(
    (n) => n.name === 'Icon' && (n.parent === '.' || n.parent == null),
  );
  if (!icon) return { ok: false, reason: 'no-icon' };

  const imageCache = new Map();
  async function loadTex(resPath) {
    if (!resPath) return null;
    if (imageCache.has(resPath)) return imageCache.get(resPath);
    const abs = resToAbs(extractRoot, resPath);
    if (!abs) {
      imageCache.set(resPath, null);
      return null;
    }
    const img = await loadImage(abs);
    imageCache.set(resPath, img);
    return img;
  }

  /** @type {{ mat: object, img: any, offset: {x:number,y:number}, centered: boolean, flipH: boolean, flipV: boolean }[]} */
  const drawList = [];

  async function visit(node, parentMat, nodePath) {
    if (SKIP_NODE.test(node.name) && node.name !== 'Icon') return;
    if (node.type && SKIP_TYPE.test(node.type)) return;
    if (parseBool(node.props.visible, true) === false) return;
    // VFX subtrees (Lightning Potion zap bolt, etc.) — not catalog art
    if (/^Zap$/i.test(node.name) || /(^|\/)Zap(\/|$)/i.test(nodePath)) return;

    const pos = parseVector2(node.props.position);
    const rot = parseNumber(node.props.rotation, 0);
    const isIcon = node.name === 'Icon';
    // Ignore Icon display scale — bake at native texel size; keep child scales.
    const scale = isIcon
      ? { x: 1, y: 1 }
      : parseVector2(node.props.scale, { x: 1, y: 1 });
    // Huge scaled sprites are shader quads / VFX, not item art
    if (!isIcon && (Math.abs(scale.x) > 8 || Math.abs(scale.y) > 8)) return;
    const mat = mulMat(parentMat, localMat(pos, rot, scale));
    const mod = mulColor(
      parseColor(node.props.modulate),
      parseColor(node.props.self_modulate),
    );
    const offset = parseVector2(node.props.offset);
    const centered = parseBool(node.props.centered, true);
    const flipH = parseBool(node.props.flip_h, false);
    const flipV = parseBool(node.props.flip_v, false);

    const texId = parseExtId(node.props.texture);
    const resPath = texId ? ext.get(texId) : null;
    const matRef =
      node.props.material &&
      (parseExtId(node.props.material)
        ? ext.get(parseExtId(node.props.material))
        : null);
    const isFluid =
      FLUID_NAME.test(node.name) ||
      (node.instanceId && /BottleOfBooze/i.test(ext.get(node.instanceId) || ''));

    // Skip additive glow plates / shader masks (bake as chalk-white otherwise)
    const bloomMod = Math.max(mod.r, mod.g, mod.b) > 2.01;
    const behindParent = parseBool(node.props.show_behind_parent, false);
    const skipFxTex = !isIcon && !isFluid && resPath && SKIP_TEX.test(resPath);
    const skipAdditive = matRef && ADDITIVE_MAT.test(matRef);
    // Bloom + show_behind_parent is often the real color plate (PrismaticSword
    // glass). Still skip pure additive materials; draw other bloom fills.
    const skipBloom =
      !isIcon && !isFluid && bloomMod && (skipAdditive || !behindParent);
    // Resting alpha ~0 is an activation overlay the animation fades in
    // (Heart of Darkness fill). Do not force it on. Glass keeps a real alpha.
    const restingHidden = !isIcon && !isFluid && mod.a < 0.02;
    const drawSelf = !(skipFxTex || skipAdditive || skipBloom || restingHidden);

    // Icon texture *_outline.png + sibling finished .png (PrismaticSword): use
    // the finished still — in-game color comes from a bloom glass child we can't
    // fully recreate, but the extract ships a composite next to the outline.
    let iconUsesFinishedStill = false;
    let texPath = resPath;
    if (isIcon && texPath && /_outline\.png$/i.test(texPath)) {
      const finished = texPath.replace(/_outline\.png$/i, '.png');
      if (finished !== texPath && (await loadTex(finished))) {
        texPath = finished;
        iconUsesFinishedStill = true;
      }
    }

    const behindKids = [];
    const frontKids = [];
    for (const kid of nodes) {
      if (kid.parent !== nodePath) continue;
      // Finished still already includes glass/fill — don't double-draw it.
      if (
        iconUsesFinishedStill &&
        parseBool(kid.props.show_behind_parent, false)
      ) {
        continue;
      }
      if (parseBool(kid.props.show_behind_parent, false)) behindKids.push(kid);
      else frontKids.push(kid);
    }

    for (const kid of behindKids) {
      await visit(kid, mat, `${nodePath}/${kid.name}`);
    }

    let img = null;
    if (drawSelf && texPath && /\.png$/i.test(texPath)) {
      const baseImg = await loadTex(texPath);
      if (baseImg) {
        if (isFluid) {
          const style = resolveFluidStyle(
            node,
            potionColor,
            gradInfo,
            itemKey,
          );
          const texImg = style.textureRes
            ? await loadTex(style.textureRes)
            : null;
          img = tintMaskImage(baseImg, style, mod, texImg);
        } else if (behindParent && bloomMod) {
          // Catalog still: keep glass color, boost alpha (game uses ~0.2 + bloom)
          img = applyModulate(baseImg, {
            r: 1,
            g: 1,
            b: 1,
            a: Math.min(1, Math.max(0.9, mod.a * 5)),
          });
        } else {
          img = applyModulate(baseImg, {
            r: Math.min(1.15, mod.r),
            g: Math.min(1.15, mod.g),
            b: Math.min(1.15, mod.b),
            a: Math.min(1, mod.a),
          });
        }
      }
    }

    if (img && (isIcon || node.type === 'Sprite' || isFluid)) {
      // Godot flip_h/flip_v mirrors pixels inside the texture rect — it does
      // NOT scale around the node origin (that misplaces centered=false sprites
      // like ManathirstInner).
      let drawImg = img;
      const regionOn = parseBool(node.props.region_enabled, false);
      const region = regionOn ? parseRect2(node.props.region_rect) : null;
      if (region && region.w > 0 && region.h > 0) {
        const sx = Math.max(0, Math.floor(region.x));
        const sy = Math.max(0, Math.floor(region.y));
        const sw = Math.min(img.width - sx, Math.ceil(region.w));
        const sh = Math.min(img.height - sy, Math.ceil(region.h));
        if (sw > 0 && sh > 0) {
          const cropped = createCanvas(sw, sh);
          const cctx = cropped.getContext('2d');
          cctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
          drawImg = cropped;
        }
      }
      drawList.push({
        mat,
        img: drawImg,
        offset,
        centered,
        flipH,
        flipV,
      });
    }

    for (const kid of frontKids) {
      await visit(kid, mat, `${nodePath}/${kid.name}`);
    }
  }

  // Bake in Icon-local space (ignore in-game Icon position / backpack scale).
  const iconLocal = {
    ...icon,
    props: {
      ...icon.props,
      position: 'Vector2( 0, 0 )',
      scale: 'Vector2( 1, 1 )',
    },
  };
  await visit(iconLocal, identity(), 'Icon');

  if (!drawList.length) return { ok: false, reason: 'nothing-to-draw' };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const d of drawList) {
    const w = d.img.width;
    const h = d.img.height;
    const ox = d.offset.x - (d.centered ? w / 2 : 0);
    const oy = d.offset.y - (d.centered ? h / 2 : 0);
    for (const [x, y] of [
      [ox, oy],
      [ox + w, oy],
      [ox, oy + h],
      [ox + w, oy + h],
    ]) {
      const p = xformPoint(d.mat, x, y);
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }

  const pad = 2;
  const width = Math.max(1, Math.ceil(maxX - minX) + pad * 2);
  const height = Math.max(1, Math.ceil(maxY - minY) + pad * 2);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  for (const d of drawList) {
    const w = d.img.width;
    const h = d.img.height;
    const ox = d.offset.x - (d.centered ? w / 2 : 0);
    const oy = d.offset.y - (d.centered ? h / 2 : 0);
    ctx.save();
    ctx.setTransform(
      d.mat.a,
      d.mat.b,
      d.mat.c,
      d.mat.d,
      d.mat.e - minX + pad,
      d.mat.f - minY + pad,
    );
    if (d.flipH || d.flipV) {
      const cx = ox + w / 2;
      const cy = oy + h / 2;
      ctx.translate(cx, cy);
      ctx.scale(d.flipH ? -1 : 1, d.flipV ? -1 : 1);
      ctx.translate(-cx, -cy);
    }
    ctx.drawImage(d.img, ox, oy);
    ctx.restore();
  }

  // Lightning Potion bolt is a runtime Pixel+shader — approximate for catalog.
  // Do NOT match Lightning Staff (its PNG is already the finished still; a
  // painted bolt made it look wrong vs game / BPB CDN).
  if (
    /lightning\s*potion|lightningpotion|lightning\s*in\s*a\s*bottle|lightninginabottle/i.test(
      itemKey,
    )
  ) {
    paintLightningBolt(ctx, width, height);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));

  return {
    ok: true,
    layers: drawList.length,
    width,
    height,
    layered: drawList.length > 1,
  };
}
