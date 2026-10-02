/**
 * Item.tscn BottleOfBooze / glow / holo → assets/data/item-live-art.json
 * plus layer copies under assets/item-layers/.
 *
 *   node scripts/extract-live-art.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseExtResources, parseSceneNodes } from './lib/bake-item-sprite.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXTRACT = path.join(ROOT, 'tools', 'game-extract-full');
const ITEMS = path.join(EXTRACT, 'Items');
const OUT_JSON = path.join(ROOT, 'assets', 'data', 'item-live-art.json');
const OUT_LAYERS = path.join(ROOT, 'assets', 'item-layers');

const SKIP_DIR = /(?:^|\\|\/)(?:Animations|Particles|Preview)(?:\\|\/)/i;
const SKIP_GLOW_TEX = /(?:glowingdot|ringlight|divingphoenixlight|particle)/i;
const RAINBOW_GRADIENT = {
  offsets: [0, 0.2, 0.4, 0.6, 0.8, 1],
  colors: [
    [1, 0.15, 0.15, 0.95],
    [1, 0.65, 0.1, 0.95],
    [0.95, 0.9, 0.15, 0.95],
    [0.2, 0.85, 0.25, 0.95],
    [0.2, 0.45, 1, 0.95],
    [0.65, 0.2, 0.95, 0.95],
  ],
};

function slugify(name) {
  return (
    String(name || '')
      .toLowerCase()
      .replace(/['']/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 80) || 'item'
  );
}

function walkTscn(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIR.test(`${p}/`)) continue;
      walkTscn(p, out);
      continue;
    }
    if (ent.name.endsWith('.tscn')) out.push(p);
  }
  return out;
}

function resToAbs(resPath) {
  if (!resPath?.startsWith('res://')) return null;
  const abs = path.join(EXTRACT, resPath.slice('res://'.length).replace(/\//g, path.sep));
  return fs.existsSync(abs) ? abs : null;
}

function parseColor(raw) {
  const m = String(raw || '').match(
    /Color\s*\(\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*\)/,
  );
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
}

function parseVec2(raw) {
  const m = String(raw || '').match(
    /Vector2\s*\(\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*\)/,
  );
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
}

/** Godot Sprite draw center ≈ position + offset (Icon-local). */
function spriteDrawPos(node) {
  const p = parseVec2(node?.props?.position) || [0, 0];
  const o = parseVec2(node?.props?.offset) || [0, 0];
  return [p[0] + o[0], p[1] + o[1]];
}

function nodeVisible(node) {
  const v = node?.props?.visible;
  if (v === undefined || v === null || v === '') return true;
  return !/^(false|0)$/i.test(String(v).trim());
}

function parseNum(raw, fallback = 0) {
  const n = Number(String(raw ?? '').trim());
  return Number.isFinite(n) ? n : fallback;
}

function parseExtId(raw) {
  return String(raw || '').match(/ExtResource\s*\(\s*(\d+)\s*\)/)?.[1] || null;
}

function parseSubId(raw) {
  return String(raw || '').match(/SubResource\s*\(\s*(\d+)\s*\)/)?.[1] || null;
}

function parseGradients(text) {
  const gradients = new Map();
  for (const m of text.matchAll(
    /\[sub_resource type="Gradient" id=(\d+)\]([\s\S]*?)(?=\n\[|$)/g,
  )) {
    const offRaw = m[2].match(/offsets\s*=\s*PoolRealArray\s*\(([^)]*)\)/)?.[1] || '';
    const colRaw = m[2].match(/colors\s*=\s*PoolColorArray\s*\(([^)]*)\)/)?.[1] || '';
    const offsets = [...offRaw.matchAll(/[-\d.eE+]+/g)].map((x) => Number(x[0]));
    const nums = [...colRaw.matchAll(/[-\d.eE+]+/g)].map((x) => Number(x[0]));
    const colors = [];
    for (let i = 0; i + 3 < nums.length; i += 4) {
      colors.push([nums[i], nums[i + 1], nums[i + 2], nums[i + 3]]);
    }
    if (colors.length) gradients.set(m[1], { offsets, colors });
  }
  const gradTex = new Map();
  for (const m of text.matchAll(
    /\[sub_resource type="GradientTexture" id=(\d+)\]([\s\S]*?)(?=\n\[|$)/g,
  )) {
    const g = parseSubId(m[2].match(/gradient\s*=\s*(SubResource\([^)]+\))/)?.[1]);
    if (g) gradTex.set(m[1], g);
  }
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

function gradientForMat(gradInfo, matSubId) {
  if (!matSubId || !gradInfo.matGrad.has(matSubId)) return null;
  let gid = gradInfo.matGrad.get(matSubId);
  if (gradInfo.gradTex.has(gid)) gid = gradInfo.gradTex.get(gid);
  return gradInfo.gradients.get(gid) || null;
}

function synthGradient(color) {
  const [r, g, b] = color || [0.8, 0.1, 0.1];
  return {
    offsets: [0.43, 0.48, 0.58, 0.67, 1],
    colors: [
      [1, 1, 1, 0],
      [Math.min(1, r + 0.35), Math.min(1, g + 0.35), Math.min(1, b + 0.35), 1],
      [r, g, b, 0.67],
      [Math.min(1, r * 1.05), Math.min(1, g * 0.6 + 0.15), Math.min(1, b * 0.6 + 0.15), 0.74],
      [r * 0.48, g * 0.12, b * 0.12, 0.79],
    ],
  };
}

function copyLayer(abs, copied) {
  if (!abs || !fs.existsSync(abs)) return null;
  const base = path.basename(abs);
  if (!copied.has(base)) {
    fs.copyFileSync(abs, path.join(OUT_LAYERS, base));
    copied.add(base);
  }
  return base;
}

function layerUrl(resPath, ext, copied) {
  const id = parseExtId(resPath);
  if (!id || !ext.has(id)) return null;
  return copyLayer(resToAbs(ext.get(id)), copied);
}

function animPeriod(text, nameRe) {
  let best = null;
  for (const m of text.matchAll(
    /\[sub_resource type="Animation" id=\d+\]([\s\S]*?)(?=\n\[sub_resource|\n\[node |$)/g,
  )) {
    const body = m[1];
    const name = body.match(/resource_name\s*=\s*"([^"]+)"/)?.[1] || '';
    if (!nameRe.test(name)) continue;
    const len = parseNum(body.match(/length\s*=\s*([-\d.eE+]+)/)?.[1], 0);
    if (len > 0.5 && (!best || len > best)) best = len;
  }
  return best;
}

function loadGradientFromTres(absPath) {
  if (!absPath || !fs.existsSync(absPath)) return null;
  const text = fs.readFileSync(absPath, 'utf8');
  const offRaw = text.match(/offsets\s*=\s*PoolRealArray\s*\(([^)]*)\)/)?.[1] || '';
  const colRaw = text.match(/colors\s*=\s*PoolColorArray\s*\(([^)]*)\)/)?.[1] || '';
  const offsets = [...offRaw.matchAll(/[-\d.eE+]+/g)].map((x) => Number(x[0]));
  const nums = [...colRaw.matchAll(/[-\d.eE+]+/g)].map((x) => Number(x[0]));
  const colors = [];
  for (let i = 0; i + 3 < nums.length; i += 4) {
    colors.push([nums[i], nums[i + 1], nums[i + 2], nums[i + 3]]);
  }
  return colors.length ? { offsets, colors } : null;
}

function potionColorForKey(key, raw) {
  if (key.includes('divine')) return [0.98, 0.9, 0.55, 1];
  if (key.includes('demonic')) return [0.32, 0.06, 0.42, 1];
  if (key.includes('lightning')) return [0.12, 0.72, 0.62, 1];
  if (key.includes('stoneskin')) return [0.52, 0.48, 0.4, 1];
  return raw;
}

function findBoozeNode(nodes, ext) {
  return (
    nodes.find((n) => n.name === 'BottleOfBooze' || n.name === 'Fluid') ||
    nodes.find((n) => {
      if (!n.instanceId) return false;
      return /BottleOfBooze/i.test(ext.get(n.instanceId) || '');
    }) ||
    null
  );
}

function extractPotion(text, ext, nodes, copied) {
  const root = nodes.find((n) => !n.parent) || nodes[0];
  const booze = findBoozeNode(nodes, ext);
  if (!booze) return null;
  const overlay = nodes.find(
    (n) =>
      /overlay|front/i.test(n.name) &&
      n.type === 'Sprite' &&
      n.props.texture,
  );
  const icon = nodes.find((n) => n.name === 'Icon');
  const gradInfo = parseGradients(text);
  const matSub = parseSubId(booze.props.material);
  let gradient = gradientForMat(gradInfo, matSub);
  // Laboratory etc. point gradient at ExtResource GradientTexture .tres
  if (!gradient) {
    const matBody =
      text.match(
        new RegExp(
          `\\[sub_resource type="ShaderMaterial" id=${matSub}\\]([\\s\\S]*?)(?=\\n\\[sub_resource|\\n\\[node |$)`,
        ),
      )?.[1] || text;
    const gradExt = matBody.match(
      /shader_param\/gradient\s*=\s*ExtResource\(\s*(\d+)\s*\)/,
    )?.[1];
    if (gradExt && ext.has(gradExt)) {
      gradient = loadGradientFromTres(resToAbs(ext.get(gradExt)));
    }
  }
  const rawColor = parseColor(root?.props?.potionColor);
  const key = slugify(root?.name);
  const color = potionColorForKey(key.replace(/_/g, ''), rawColor);
  if (!gradient) {
    if (key.includes('rainbow') || (color && color[0] + color[1] + color[2] < 0.05)) {
      gradient = RAINBOW_GRADIENT;
    } else {
      gradient = synthGradient(color || [0.9, 0.08, 0.08]);
    }
  }
  const flask = layerUrl(icon?.props?.texture, ext, copied);
  const mask = layerUrl(booze.props.texture, ext, copied);
  const over = overlay ? layerUrl(overlay.props.texture, ext, copied) : null;
  const noiseExt =
    text.match(/shader_param\/bubbleNoise\s*=\s*ExtResource\(\s*(\d+)\s*\)/)?.[1] ||
    text.match(/path="(res:\/\/Assets\/Noise\/[^"]+)"/)?.[1];
  let noise = null;
  if (noiseExt && /^\d+$/.test(noiseExt) && ext.has(noiseExt)) {
    noise = copyLayer(resToAbs(ext.get(noiseExt)), copied);
  } else if (typeof noiseExt === 'string' && noiseExt.startsWith('res://')) {
    noise = copyLayer(resToAbs(noiseExt), copied);
  }
  if (!noise) noise = copyLayer(resToAbs('res://Assets/Noise/LavaNoise.png'), copied);
  if (!flask || !mask) return null;

  // Pestilence etc. hang a buff icon under Icon (not baked into Overlay).
  const badgeNode = nodes.find((n) => {
    if (n.type !== 'Sprite' || !n.props?.texture) return false;
    if (!nodeVisible(n)) return false;
    if (n === overlay || n === booze || n.name === 'Icon' || /socket/i.test(n.name)) {
      return false;
    }
    const parent = String(n.parent || '');
    if (parent !== 'Icon' && !parent.startsWith('Icon/')) return false;
    const tex = ext.get(parseExtId(n.props.texture) || '') || '';
    return /\/Buffs\//i.test(tex) || /^(Poison|Vampirism|Heal|Block|Mana)$/i.test(n.name);
  });
  const badge = badgeNode ? layerUrl(badgeNode.props.texture, ext, copied) : null;

  return {
    kind: 'potion',
    flask,
    mask,
    overlay: over,
    noise,
    potionColor: color,
    gradient,
    baseFoaminess: parseNum(booze.props.baseFoaminess, 0.05),
    baseScroll: parseNum(booze.props.baseScroll, 0.03),
    noiseScale: parseVec2(
      text.match(/shader_param\/noiseScale\s*=\s*(Vector2\([^)]+\))/)?.[1],
    ) || [1, 1],
    liquidPos: spriteDrawPos(booze),
    liquidScale: parseVec2(booze.props.scale) || [1, 1],
    overlayPos: overlay ? spriteDrawPos(overlay) : [0, 0],
    levelModification: parseNum(booze.props.levelModification, 0),
    ...(badge
      ? {
          badge,
          badgePos: spriteDrawPos(badgeNode),
          badgeScale: parseVec2(badgeNode.props.scale) || [1, 1],
        }
      : {}),
  };
}

function extractGlow(text, ext, nodes, copied) {
  const glowNode = nodes.find((n) => {
    if (n.type !== 'Sprite') return false;
    if (!/glow|torchlight/i.test(n.name)) return false;
    const tex = ext.get(parseExtId(n.props.texture) || '') || '';
    if (SKIP_GLOW_TEX.test(tex)) return false;
    return true;
  });
  if (!glowNode) return null;
  const glow = layerUrl(glowNode.props.texture, ext, copied);
  if (!glow) return null;
  const flicker = /FlickerAnimation|Flicker/i.test(text);
  const period =
    animPeriod(text, flicker ? /Flicker/i : /Pulse/i) || (flicker ? 4 : 5);
  // Prefer self_modulate (TorchLight tint) over modulate.
  const tint =
    parseColor(glowNode.props.self_modulate) || parseColor(glowNode.props.modulate);
  const scale = parseVec2(glowNode.props.scale) || [1, 1];
  const alpha = tint ? tint[3] : 1;
  return {
    kind: flicker ? 'flicker' : 'glow',
    glow,
    period,
    additive: /AdditiveCanvasItemMaterial/i.test(text),
    pos: parseVec2(glowNode.props.position) || [0, 0],
    scale,
    tint: tint ? [tint[0], tint[1], tint[2]] : undefined,
    opacity: [Math.min(1, alpha * 0.72), Math.min(1, alpha)],
  };
}

function extractHolo(text, ext, nodes, copied) {
  // Idle holo: wobbliness material on Icon child (Aura/Flames) — NOT on
  // Connector / Particles (cards put shimmer only on the chain connector).
  if (!/shader_param\/(?:noise1Scale|wobbliness)\s*=/.test(text)) return null;
  if (!/adjustedTime\s*=\s*TIME|scroll1\s*=/.test(text)) return null;
  const holoMats = new Set();
  for (const m of text.matchAll(
    /\[sub_resource type="ShaderMaterial" id=(\d+)\]([\s\S]*?)(?=\n\[sub_resource|\n\[node |$)/g,
  )) {
    if (/wobbliness|noise1Scale|NOISE_PATTERN/.test(m[2])) holoMats.add(m[1]);
  }
  if (!holoMats.size) return null;
  let idleOwner = null;
  for (const n of nodes) {
    const mat = parseSubId(n.props.material);
    if (!mat || !holoMats.has(mat)) continue;
    if (/connector|particle|activation|drag/i.test(n.name)) continue;
    const underIcon =
      n.parent === 'Icon' ||
      (typeof n.parent === 'string' && n.parent.startsWith('Icon/'));
    if (underIcon || (n.type === 'Sprite' && n.parent === '.' && n.name !== 'Icon')) {
      idleOwner = n;
      break;
    }
  }
  if (!idleOwner) return null;
  const gradInfo = parseGradients(text);
  let gradient = null;
  for (const g of gradInfo.gradients.values()) {
    gradient = g;
    break;
  }
  const noiseRes =
    text.match(/shader_param\/NOISE_PATTERN\s*=\s*ExtResource\(\s*(\d+)\s*\)/)?.[1] ||
    text.match(/path="(res:\/\/Assets\/Noise\/[^"]+)"/)?.[1];
  let noise = null;
  if (noiseRes && /^\d+$/.test(noiseRes)) {
    noise = copyLayer(resToAbs(ext.get(noiseRes)), copied);
  } else if (typeof noiseRes === 'string' && noiseRes.startsWith('res://')) {
    noise = copyLayer(resToAbs(noiseRes), copied);
  }
  if (!noise) noise = copyLayer(resToAbs('res://Assets/Noise/SparkleNoise.png'), copied);
  const wobbliness = parseNum(
    text.match(/shader_param\/wobbliness\s*=\s*([-\d.eE+]+)/)?.[1],
    2.5,
  );
  const scroll1 =
    parseVec2(text.match(/shader_param\/scroll1\s*=\s*(Vector2\([^)]+\))/)?.[1]) || [
      0.003, 0.22,
    ];
  const scroll2 =
    parseVec2(text.match(/shader_param\/scroll2\s*=\s*(Vector2\([^)]+\))/)?.[1]) || [
      -0.01, 0.34,
    ];
  const noise1Scale = parseNum(
    text.match(/shader_param\/noise1Scale\s*=\s*([-\d.eE+]+)/)?.[1],
    0.5,
  );
  const noise2Scale = parseNum(
    text.match(/shader_param\/noise2Scale\s*=\s*([-\d.eE+]+)/)?.[1],
    0.7,
  );
  return {
    kind: 'holo',
    noise,
    gradient: gradient || {
      offsets: [0, 0.2, 0.9, 1],
      colors: [
        [0, 0.15, 0.47, 0],
        [0.25, 0.43, 0.55, 1],
        [0.69, 0.89, 0.97, 1],
        [1, 1, 1, 1],
      ],
    },
    wobbliness,
    scroll1,
    scroll2,
    noise1Scale,
    noise2Scale,
  };
}

function main() {
  if (!fs.existsSync(ITEMS)) {
    console.error('missing', ITEMS);
    process.exit(1);
  }
  fs.mkdirSync(OUT_LAYERS, { recursive: true });
  const copied = new Set();
  const items = {};
  const counts = { potion: 0, glow: 0, flicker: 0, holo: 0 };
  for (const file of walkTscn(ITEMS)) {
    const text = fs.readFileSync(file, 'utf8');
    if (/Animation\.tscn$/i.test(file)) continue;
    if (/CraftingPreview|UnidentifiedSkill|ElectricalCharge/i.test(file)) continue;
    const ext = parseExtResources(text);
    const nodes = parseSceneNodes(text);
    const root = nodes.find((n) => !n.parent);
    const id = slugify(root?.name || path.basename(file, '.tscn'));
    if (!id || id === 'item') continue;
    const potion = /BottleOfBooze|potionColor\s*=/.test(text)
      ? extractPotion(text, ext, nodes, copied)
      : null;
    if (potion) {
      items[id] = potion;
      counts.potion += 1;
      continue;
    }
    const glow = extractGlow(text, ext, nodes, copied);
    const holo = extractHolo(text, ext, nodes, copied);
    if (glow && holo) {
      items[id] = { ...glow, holo };
      counts[glow.kind] += 1;
      counts.holo += 1;
    } else if (glow) {
      items[id] = glow;
      counts[glow.kind] += 1;
    } else if (holo) {
      items[id] = holo;
      counts.holo += 1;
    }
  }
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(
    OUT_JSON,
    `${JSON.stringify({ source: 'Items/*.tscn', extractedAt: new Date().toISOString(), items }, null, 2)}\n`,
  );
  console.log(
    JSON.stringify(
      { wrote: OUT_JSON, layers: copied.size, count: Object.keys(items).length, counts },
      null,
      2,
    ),
  );
}

main();
