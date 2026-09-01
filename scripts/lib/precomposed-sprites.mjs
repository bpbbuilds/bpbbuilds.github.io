/**
 * Prefetch finished catalog stills (BPB CDN WebPs / local wiki composites)
 * for items whose in-game look is shader-driven (potions).
 *
 * We host the result under assets/item-sprites/{SceneStem}.png — no hotlink.
 */

import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const CDN_BASE = 'https://awerc.github.io/bpb-cdn/i';

/** Scene stem / node name → CDN WebP stem(s) when names diverge. */
const CDN_ALIASES = {
  LightningPotion: ['LightninginaBottle'],
  'Lightning Potion': ['LightninginaBottle'],
};

function isPartialSpriteName(name) {
  return /^(Flask\d+|.*_flask|.*_front|.*_mask\d*|.*_overlay|.*_Mask)\.png$/i.test(
    name,
  );
}

/**
 * Potion liquid is BottleOfBooze + shaders — bake cannot match finished stills.
 * PotionBelt / bags that mention "potion" in the name are excluded.
 */
export function needsPrecomposedSprite(sceneText) {
  if (!sceneText) return false;
  if (/BottleOfBooze/i.test(sceneText)) return true;
  if (/^\s*potionColor\s*=/m.test(sceneText)) return true;
  return false;
}

export function cdnCandidateStems(fileStem, nodeName) {
  const stems = [];
  const push = (s) => {
    const t = String(s || '').trim();
    if (!t) return;
    if (!stems.includes(t)) stems.push(t);
  };

  for (const a of CDN_ALIASES[fileStem] || []) push(a);
  for (const a of CDN_ALIASES[nodeName] || []) push(a);
  push(fileStem);
  push(String(nodeName || '').replace(/\s+/g, ''));
  // e.g. "Stone Skin Potion" → StoneSkinPotion (already), also Title Case collapse
  push(
    String(nodeName || '')
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(''),
  );
  return stems;
}

function localWikiCandidates(outDir, fileStem, nodeName) {
  const names = new Set([
    ...(CDN_ALIASES[fileStem] || []).map((s) => `${s}.png`),
    ...(CDN_ALIASES[nodeName] || []).map((s) => `${s}.png`),
    `${fileStem}.png`,
    `${String(nodeName || '').replace(/\s+/g, '')}.png`,
    `${nodeName}.png`,
    'LightninginaBottle.png',
  ]);
  const hits = [];
  for (const name of names) {
    if (isPartialSpriteName(name)) continue;
    const p = path.join(outDir, name);
    if (!fs.existsSync(p)) continue;
    hits.push(p);
  }
  return hits;
}

async function webpBufferToPngFile(buf, destPng) {
  const img = await loadImage(buf);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  fs.writeFileSync(destPng, canvas.toBuffer('image/png'));
}

async function fetchCdnWebp(stem, cacheDir) {
  const cachePath = path.join(cacheDir, `${stem}.webp`);
  if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 64) {
    return { buf: fs.readFileSync(cachePath), stem, fromCache: true };
  }

  const url = `${CDN_BASE}/${encodeURIComponent(stem)}.webp`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 64) return null;
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cachePath, buf);
  return { buf, stem, fromCache: false };
}

/**
 * Write a finished still to destPng.
 * Preference: BPB CDN WebP → PNG, else local wiki composite copy.
 *
 * @returns {{ ok: true, source: string, stem?: string } | { ok: false, reason: string }}
 */
export async function resolvePrecomposedSprite({
  sceneText,
  fileStem,
  nodeName,
  destPng,
  outDir,
  cacheDir,
  allowNetwork = true,
}) {
  if (!needsPrecomposedSprite(sceneText)) {
    return { ok: false, reason: 'not-precomposed-item' };
  }

  if (allowNetwork) {
    for (const stem of cdnCandidateStems(fileStem, nodeName)) {
      try {
        const hit = await fetchCdnWebp(stem, cacheDir);
        if (!hit) continue;
        await webpBufferToPngFile(hit.buf, destPng);
        return {
          ok: true,
          source: hit.fromCache ? 'bpb-cdn-cache' : 'bpb-cdn',
          stem: hit.stem,
        };
      } catch {
        // try next stem
      }
    }
  } else {
    // Offline: only use already-cached WebPs
    for (const stem of cdnCandidateStems(fileStem, nodeName)) {
      const cachePath = path.join(cacheDir, `${stem}.webp`);
      if (!fs.existsSync(cachePath)) continue;
      try {
        await webpBufferToPngFile(fs.readFileSync(cachePath), destPng);
        return { ok: true, source: 'bpb-cdn-cache', stem };
      } catch {
        // try next
      }
    }
  }

  // Local wiki leftover with a different filename (e.g. LightninginaBottle.png)
  const destAbs = path.resolve(destPng);
  let best = null;
  let bestSize = -1;
  for (const p of localWikiCandidates(outDir, fileStem, nodeName)) {
    if (path.resolve(p) === destAbs) continue;
    const size = fs.statSync(p).size;
    if (size > bestSize) {
      bestSize = size;
      best = p;
    }
  }
  if (best) {
    fs.copyFileSync(best, destPng);
    return { ok: true, source: 'wiki-local', stem: path.basename(best) };
  }

  return { ok: false, reason: 'no-precomposed' };
}
