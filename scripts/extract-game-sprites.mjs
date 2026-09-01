/**
 * Bake item Icon trees from game .tscn → assets/item-sprites/
 * and write scripts/_cache/game-sprites.json for extract-game-items.
 *
 * Potions (BottleOfBooze / potionColor): prefer finished stills from the BPB
 * CDN (cached as WebP, written as PNG) — same approach as BPB Builds.
 * Other layered items (googly eyes, Con-Trap-Tron, …) are composite-baked.
 * Simple items bake/copy the Icon texture alone.
 *
 * Usage:
 *   node scripts/extract-game-sprites.mjs
 *   BPB_CDN_SPRITES=0  # offline: cache / wiki only for potions
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { bakeItemSprite, parseExtResources } from './lib/bake-item-sprite.mjs';
import {
  needsPrecomposedSprite,
  resolvePrecomposedSprite,
} from './lib/precomposed-sprites.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ITEMS_DIR_CANDIDATES = [
  path.join(ROOT, 'tools', 'game-extract-full', 'Items'),
  path.join(ROOT, 'tools', 'game-extract', 'Items'),
];
const ITEMS_DIR = ITEMS_DIR_CANDIDATES.find((d) => fs.existsSync(d));
const EXTRACT_ROOT = ITEMS_DIR ? path.dirname(ITEMS_DIR) : null;
const OUT_JSON = path.join(__dirname, '_cache', 'game-sprites.json');
const OUT_DIR = path.join(ROOT, 'assets', 'item-sprites');
const CDN_CACHE = path.join(__dirname, '_cache', 'bpb-cdn');
const ALLOW_CDN_NETWORK = process.env.BPB_CDN_SPRITES !== '0';

if (!ITEMS_DIR || !EXTRACT_ROOT) {
  console.error('missing Items extract — run keyed GDRE recover first');
  process.exit(1);
}

const RES_PREFIX = 'res://';
const fileCache = new Map();

function readFile(abs) {
  if (!fileCache.has(abs)) fileCache.set(abs, fs.readFileSync(abs, 'utf8'));
  return fileCache.get(abs);
}

function resToAbs(resPath) {
  if (!resPath?.startsWith(RES_PREFIX)) return null;
  const rel = resPath.slice(RES_PREFIX.length).replace(/\//g, path.sep);
  const abs = path.join(EXTRACT_ROOT, rel);
  return fs.existsSync(abs) ? abs : null;
}

function rootInstanceParent(text) {
  const m = text.match(
    /\[node name="([^"]+)"\s+instance=ExtResource\(\s*(\d+)\s*\)\]/,
  );
  if (!m) return null;
  const ext = parseExtResources(text);
  return { nodeName: m[1], parentRes: ext.get(m[2]) || null };
}

function ownIconTextureId(text) {
  const m = text.match(
    /\[node name="Icon"[^\]]*\][\s\S]*?texture\s*=\s*ExtResource\(\s*(\d+)\s*\)/,
  );
  return m ? m[1] : null;
}

function resolveIconTexture(absPath, seen = new Set()) {
  if (!absPath || seen.has(absPath)) return null;
  seen.add(absPath);
  const text = readFile(absPath);
  const ext = parseExtResources(text);

  const iconId = ownIconTextureId(text);
  if (iconId && ext.has(iconId)) {
    const res = ext.get(iconId);
    if (/\.png$/i.test(res)) {
      return {
        resPath: res,
        abs: resToAbs(res),
        source: absPath,
        inherited: seen.size > 1,
      };
    }
  }

  const pngs = [...ext.values()].filter((p) => /\.png$/i.test(p));
  const preferred = pngs.find(
    (p) =>
      /\/Sprites\//i.test(p) &&
      !/_(Mask|Front|Outline|outline|Back|Glow|Shadow)\.png$/i.test(p),
  );
  if (preferred) {
    return {
      resPath: preferred,
      abs: resToAbs(preferred),
      source: absPath,
      inherited: seen.size > 1,
    };
  }

  const root = rootInstanceParent(text);
  if (root?.parentRes) {
    const parentAbs = resToAbs(root.parentRes);
    if (parentAbs) return resolveIconTexture(parentAbs, seen);
  }
  return null;
}

function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

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

/** Catalog filename: scene stem (unique per item; avoids shared Flask1.png). */
function catalogImageName(fileStem) {
  return `${fileStem}.png`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.mkdirSync(CDN_CACHE, { recursive: true });

  const files = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (
          /^(Animations|Materials|Particles|Sprites|Tiles|Masks)$/i.test(ent.name)
        ) {
          continue;
        }
        walk(full);
      } else if (ent.name.endsWith('.tscn')) {
        files.push(full);
      }
    }
  }
  walk(ITEMS_DIR);

  const skipFiles = new Set([
    'item.tscn',
    'bag.tscn',
    'weapon.tscn',
    'potion.tscn',
    'food.tscn',
    'card.tscn',
    'shield.tscn',
    'gem.tscn',
    'gemsocket.tscn',
    'socketsnode.tscn',
    'shadow.tscn',
    'catalystbond.tscn',
    'craftingbond.tscn',
    'craftingpreviewbond.tscn',
    'electricalcharge.tscn',
  ]);

  const sprites = [];
  const missing = [];
  let baked = 0;
  let layered = 0;
  let precomposed = 0;
  let fallbackCopied = 0;
  let skippedMissingPng = 0;
  let inherited = 0;
  let bakeFail = 0;

  for (const full of files) {
    const base = path.basename(full);
    if (skipFiles.has(base.toLowerCase())) continue;

    const text = readFile(full);
    const root = rootInstanceParent(text);
    const nodeName = root?.nodeName || path.basename(full, '.tscn');
    const fileStem = path.basename(full, '.tscn');
    const image = catalogImageName(fileStem);
    const dest = path.join(OUT_DIR, image);

    const tex = resolveIconTexture(full);
    if (tex?.inherited) inherited += 1;

    const baseEntry = {
      id: slugify(nodeName),
      fileStem,
      nodeName,
      image,
      resPath: tex?.resPath || null,
      normKeys: [
        normKey(nodeName),
        normKey(fileStem),
        normKey(image.replace(/\.png$/i, '')),
        tex?.resPath
          ? normKey(path.basename(tex.resPath).replace(/\.png$/i, ''))
          : null,
      ].filter(Boolean),
    };

    // Potions: finished stills beat shader reconstruction
    if (needsPrecomposedSprite(text)) {
      const pref = await resolvePrecomposedSprite({
        sceneText: text,
        fileStem,
        nodeName,
        destPng: dest,
        outDir: OUT_DIR,
        cacheDir: CDN_CACHE,
        allowNetwork: ALLOW_CDN_NETWORK,
      });
      if (pref.ok) {
        precomposed += 1;
        sprites.push({
          ...baseEntry,
          baked: false,
          precomposed: true,
          precomposedSource: pref.source,
          precomposedStem: pref.stem || null,
          layered: false,
        });
        continue;
      }
    }

    const bake = await bakeItemSprite({
      scenePath: full,
      extractRoot: EXTRACT_ROOT,
      outPath: dest,
    });

    if (bake.ok) {
      baked += 1;
      if (bake.layered) layered += 1;
      sprites.push({
        ...baseEntry,
        baked: true,
        precomposed: false,
        layers: bake.layers,
        layered: bake.layered,
      });
      continue;
    }

    // Fallback: copy Icon texture if bake failed
    if (!tex?.resPath) {
      missing.push({ fileStem, nodeName, reason: bake.reason || 'no-texture' });
      continue;
    }
    if (!tex.abs) {
      skippedMissingPng += 1;
      missing.push({
        fileStem,
        nodeName,
        reason: 'png-missing',
        resPath: tex.resPath,
        image,
      });
      sprites.push({
        ...baseEntry,
        image: path.basename(tex.resPath),
        baked: false,
        precomposed: false,
        normKeys: [
          normKey(nodeName),
          normKey(fileStem),
          normKey(path.basename(tex.resPath).replace(/\.png$/i, '')),
        ],
      });
      continue;
    }

    fs.copyFileSync(tex.abs, dest);
    fallbackCopied += 1;
    bakeFail += 1;
    sprites.push({
      ...baseEntry,
      baked: false,
      precomposed: false,
      bakeReason: bake.reason,
    });
  }

  const payload = {
    extractedAt: new Date().toISOString(),
    source: path.relative(ROOT, ITEMS_DIR).replace(/\\/g, '/'),
    mode: 'precomposed-potions+composite-bake',
    count: sprites.length,
    baked,
    layered,
    precomposed,
    cdnNetwork: ALLOW_CDN_NETWORK,
    fallbackCopied,
    bakeFail,
    inherited,
    skippedMissingPng,
    missingTexture: missing.filter((m) => m.reason === 'no-texture').length,
    sprites,
    missing,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2));
  console.log(
    `sprites: ${sprites.length} mapped, ${precomposed} precomposed potions, ${baked} baked (${layered} layered) → ${path.relative(ROOT, OUT_DIR)}`,
  );
  console.log(
    `  fallback copy: ${fallbackCopied}, png missing: ${skippedMissingPng}, no texture: ${payload.missingTexture}`,
  );
  console.log('wrote', path.relative(ROOT, OUT_JSON));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
