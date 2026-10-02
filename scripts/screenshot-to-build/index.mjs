/**
 * Screenshot → build pipeline orchestration.
 * CLI: node scripts/screenshot-to-build.mjs path/to/shot.png
 */
import fs from 'fs';
import path from 'path';
import { loadImage } from '@napi-rs/canvas';
import {
  loadEnv,
  loadCatalog,
  resolveToCatalog,
  normName,
} from './catalog.mjs';
import { loadShapeIndex, validateFootprint, buildShortlist, catalogFootprint, isWingedSword } from './shapes.mjs';
import {
  imageToGray,
  matchSprite,
  matchSpriteInCell,
  maskRegion,
  cropRegionDataUrl,
  NCC_OK,
} from './sprite.mjs';
import {
  detectGridFromShot,
  scaleGridToImage,
  knownScalesForStem,
  writeGridDebugOverlay,
} from './grid-bridge.mjs';
import {
  visionIdentify,
  visionShortlistPick,
  extractJson,
  estimateUsd,
  sumCost,
} from './vision.mjs';

const MAX_SHORTLIST_REASKS = 10;
const SHORTLIST_MIN_GAIN = 0.05;

const SPRITE_SCALES = [0.12, 0.18, 0.24, 0.32, 0.4, 0.5, 0.62];
const THUMB_SCALES = [0.7, 0.9, 1.1, 1.35, 1.6, 1.9, 2.3, 2.8];

/** @type {import('../../js/shared/screenshot-grid.js').BagGrid | null} */
let activeGrid = null;

/**
 * @param {import('./catalog.mjs').CatalogItem} item
 * @param {{ w: number, h: number, gray: Float32Array, alpha: Uint8Array }} shotGray
 * @param {number} [area] footprint sizeW*sizeH — large items try full sprite first
 * @param {{ cellCol?: number, cellRow?: number, sizeW?: number, sizeH?: number } | null} [cellCues]
 */
async function bestSpriteHit(item, shotGray, area = 1, cellCues = null) {
  const empty = { score: -1, x: 0, y: 0, scale: 1, rot: 0, tw: 0, th: 0 };
  if (!item.thumbPath && !item.spritePath) return empty;

  const winged = isWingedSword(item.name);
  // Falcon body is 1×3 but art+stars span ~5×5 — treat as large for sprite-first + cell pad
  const treatLarge = area >= 4 || winged;

  const stem = String(item.image || item.id || '').replace(/\.(png|webp)$/i, '');
  const gridOk = activeGrid && activeGrid.cellW > 0;
  const knownSpr = gridOk ? knownScalesForStem(stem, activeGrid.cellW, { thumb: false }) : null;
  const knownThumb = gridOk
    ? (() => {
        // 1x thumbs ≈ 68px/cell in build-sprite-thumbs
        const center = activeGrid.cellW / 68;
        if (!(center > 0.2) || !(center < 8)) return null;
        return [0.85, 0.95, 1, 1.05, 1.15].map((m) => Math.round(center * m * 1000) / 1000);
      })()
    : null;

  const thumbOpts = {
    scales: knownThumb || THUMB_SCALES,
    rotations: [0, 90, 180, 270],
    stride: winged ? 3 : 4,
  };
  const spriteOpts = {
    scales: knownSpr || (winged
      ? [0.08, 0.12, 0.16, 0.2, 0.28, 0.36, 0.45, 0.55, 0.62]
      : SPRITE_SCALES),
    rotations: [0, 90, 180, 270],
    stride: winged ? 3 : 5,
  };

  const matchThumb = async () => {
    if (!item.thumbPath) return empty;
    return matchSprite(shotGray, item.thumbPath, thumbOpts);
  };
  const matchFull = async () => {
    if (!item.spritePath) return empty;
    return matchSprite(shotGray, item.spritePath, spriteOpts);
  };

  /** @type {any} */
  let hit;
  if (treatLarge && item.spritePath) {
    hit = await matchFull();
    if (hit.score < NCC_OK && item.thumbPath) {
      const thumbHit = await matchThumb();
      if (thumbHit.score > hit.score) hit = thumbHit;
    }
  } else {
    hit = item.thumbPath ? await matchThumb() : empty;
    if ((!item.thumbPath || hit.score < NCC_OK) && item.spritePath) {
      const sprHit = await matchFull();
      if (sprHit.score > hit.score) hit = sprHit;
    }
  }

  // Full-bag NCC often false-peaks on tall swords — rematch inside cell crop when weak
  if (
    hit.score < NCC_OK &&
    cellCues &&
    Number.isFinite(cellCues.cellCol) &&
    Number.isFinite(cellCues.cellRow)
  ) {
    const cropW = Math.max(Number(cellCues.sizeW) || 1, winged ? 3 : 1);
    const cropH = Math.max(Number(cellCues.sizeH) || 1, winged ? 3 : 1);
    const pad = winged ? 2.2 : area >= 4 ? 2.0 : 1.8;
    const cues = {
      cellCol: cellCues.cellCol,
      cellRow: cellCues.cellRow,
      sizeW: cropW,
      sizeH: cropH,
      pad,
      grid: activeGrid,
    };
    if (item.spritePath) {
      const cellHit = await matchSpriteInCell(shotGray, item.spritePath, cues, spriteOpts);
      if (cellHit.score > hit.score) hit = cellHit;
    }
    if (hit.score < NCC_OK && item.thumbPath) {
      const cellThumb = await matchSpriteInCell(shotGray, item.thumbPath, cues, thumbOpts);
      if (cellThumb.score > hit.score) hit = cellThumb;
    }
  }

  return hit;
}

/**
 * @param {{ score: number, shapeOk: boolean }} e
 */
function needsShortlist(e) {
  return e.score < NCC_OK || (!e.shapeOk && e.score < 0.5);
}

/**
 * @param {import('./catalog.mjs').CatalogItem} proposed
 * @param {import('./catalog.mjs').CatalogItem} alt
 * @param {any} origHit
 * @param {any} altHit
 * @param {boolean} shapeOk
 * @param {ReturnType<typeof loadShapeIndex>} shapeIndex
 * @param {number | null | undefined} [preferredRot]
 */
function acceptShortlistSwap(proposed, alt, origHit, altHit, shapeOk, shapeIndex, preferredRot) {
  const sameName = alt.id === proposed.id || alt.name === proposed.name;
  if (sameName) {
    return { accept: true, rejected: false, minGain: 0, ratio: 1, gain: 0 };
  }

  const propFp = catalogFootprint(shapeIndex, proposed.id, preferredRot);
  const altFp = catalogFootprint(shapeIndex, alt.id, preferredRot);
  const propArea = Math.max(1, propFp ? propFp.w * propFp.h : 1);
  const altArea = Math.max(1, altFp ? altFp.w * altFp.h : 1);
  const ratio = altArea / propArea;

  let minGain = SHORTLIST_MIN_GAIN;
  if (propArea >= 4 && ratio < 0.25) minGain = 0.25;
  else if (propArea >= 4 && ratio < 0.5) minGain = 0.15;

  const gain = altHit.score - origHit.score;
  const clearWeakOrig =
    ratio >= 0.5 && altHit.score >= NCC_OK && origHit.score < NCC_OK && gain > 0;
  const accept = gain >= minGain || clearWeakOrig;
  void shapeOk;
  return { accept, rejected: !accept, minGain, ratio, gain };
}

/**
 * @param {any} p
 * @param {import('./catalog.mjs').CatalogItem} used
 * @param {any} hit
 * @param {boolean} shortlistTried
 * @param {string | null} shortlistPick
 * @param {boolean} [shortlistRejected]
 * @param {ReturnType<typeof loadShapeIndex>} shapeIndex
 */
function finalizeEntry(
  p,
  used,
  hit,
  shortlistTried,
  shortlistPick,
  shortlistRejected,
  shapeIndex,
) {
  const confirmed = hit.score >= NCC_OK;
  const visionSize = { w: p.sizeW, h: p.sizeH };
  let size = visionSize;
  let shapeOk = p.shapeOk;
  let shapeReason = p.shapeReason;
  let catalogRot = p.rotation ?? null;

  if (confirmed && shapeIndex) {
    const fp = catalogFootprint(shapeIndex, used.id, hit.rot ?? p.rotation);
    if (fp) {
      size = { w: fp.w, h: fp.h };
      shapeOk = true;
      shapeReason = 'catalog_size';
      catalogRot = fp.rot;
    }
  }

  let reason = 'ok';
  if (confirmed && shapeReason === 'catalog_size' && (visionSize.w !== size.w || visionSize.h !== size.h)) {
    reason = shortlistPick && used.name !== p.visionName ? 'ok_shortlist' : 'ok_catalog_size';
  } else if (confirmed && !p.shapeOk && shapeReason !== 'catalog_size') {
    reason = 'ok_sprite_shape_cue_wrong';
  } else if (!confirmed && !p.shapeOk) reason = 'shape_mismatch';
  else if (!confirmed && shortlistTried) reason = 'shortlist_unresolved';
  else if (!confirmed) reason = 'low_sprite_score';
  else if (shortlistPick && used.name !== p.visionName && !shortlistRejected) reason = 'ok_shortlist';
  else reason = 'ok';

  if (shortlistRejected) {
    // Keep telemetry; reason stays based on final identity
  }

  return {
    id: used.id,
    name: used.name,
    visionName: p.visionName,
    visionConfidence: p.confidence ?? null,
    visionNotes: p.notes || '',
    visionRotation: p.rotation ?? null,
    cell: { col: p.cellCol, row: p.cellRow },
    size,
    visionSize,
    catalogRotation: catalogRot,
    shapeOk,
    shapeReason,
    spriteScore: hit.score < 0 ? null : Number(hit.score.toFixed(3)),
    spriteAt: hit.score < 0 ? null : { x: hit.x, y: hit.y, scale: hit.scale, rot: hit.rot },
    confirmed,
    reason,
    shortlistTried,
    shortlistPick,
    shortlistRejected: Boolean(shortlistRejected),
  };
}

/**
 * @param {string[]} args
 */
async function main(args) {
  const shotPath = args[0];
  if (!shotPath || !fs.existsSync(shotPath)) {
    console.error('Usage: node scripts/screenshot-to-build.mjs <screenshot.png>');
    process.exit(1);
  }

  const env = loadEnv();
  console.error('loading catalog…');
  const catalog = await loadCatalog(env);
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const byNorm = new Map(catalog.map((c) => [normName(c.name), c]));
  const catalogNames = [...new Set(catalog.map((c) => c.name))];
  console.error(`catalog: ${catalog.length} items with sprites/thumbs`);

  const shapeIndex = loadShapeIndex(catalog);
  console.error(`shapes: ${shapeIndex.byId.size} items indexed`);

  const shotBuf = fs.readFileSync(shotPath);
  const dataUrl = `data:image/png;base64,${shotBuf.toString('base64')}`;
  const shotImg = await loadImage(shotPath);
  const shotGray = imageToGray(shotImg, 900);
  console.error(
    `shot: ${shotImg.width}x${shotImg.height} → match canvas ${shotGray.w}x${shotGray.h}`,
  );

  const { grid: matchGrid } = await detectGridFromShot(shotPath, 900);
  activeGrid = matchGrid;
  const fullGrid = scaleGridToImage(
    matchGrid,
    shotGray.w,
    shotGray.h,
    shotImg.width,
    shotImg.height,
  );
  console.error(
    `grid: ${matchGrid.ok ? 'ok' : 'fallback'} cell=${matchGrid.cellW.toFixed(1)}x${matchGrid.cellH.toFixed(1)} ` +
      `origin=(${matchGrid.originX.toFixed(1)},${matchGrid.originY.toFixed(1)}) ` +
      `${matchGrid.cols}x${matchGrid.rows} score=${matchGrid.score.toFixed(3)}`,
  );
  if (env.STB_GRID_DEBUG || process.env.STB_GRID_DEBUG) {
    const out = path.join(path.dirname(shotPath), '_stb-grid-debug.png');
    // Prefer repo scripts/ when shot is elsewhere
    const debugOut = path.join(process.cwd(), 'scripts', '_stb-grid-debug.png');
    await writeGridDebugOverlay(shotPath, fullGrid, debugOut);
    console.error(`grid debug overlay: ${debugOut}`);
    void out;
  }

  let vision;
  const cachePath = env.STB_VISION_CACHE || process.env.STB_VISION_CACHE;
  if (cachePath && fs.existsSync(cachePath)) {
    console.error(`using vision cache: ${cachePath}`);
    const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const msg = cached.message || {};
    const content = msg.content || null;
    const reasoning = msg.reasoning || null;
    vision = {
      ok: true,
      status: 200,
      ms: cached.ms || 0,
      model: cached.model || 'cache',
      provider: cached.provider || null,
      responseMode: cached.responseMode || 'cache',
      error: null,
      usage: cached.usage || null,
      cost: cached.cost || estimateUsd(cached.model || 'cache', cached.usage || null),
      rawContent: content,
      parsed: extractJson(content) || extractJson(reasoning),
    };
  } else {
    vision = await visionIdentify(catalog, dataUrl, env);
  }

  if (!vision.ok || vision.error) {
    console.log(JSON.stringify({ ok: false, stage: 'vision', vision }, null, 2));
    process.exit(1);
  }

  /** @type {any[]} */
  const proposed = [];
  const rawItems = Array.isArray(vision.parsed?.items) ? vision.parsed.items : [];
  for (const p of rawItems) {
    const visionName = String(p?.name || p?.id || '').trim();
    const sizeW = Math.max(1, Math.round(Number(p?.sizeW) || 1));
    const sizeH = Math.max(1, Math.round(Number(p?.sizeH) || 1));
    const cellCol = Math.max(0, Math.round(Number(p?.cellCol) || 0));
    const cellRow = Math.max(0, Math.round(Number(p?.cellRow) || 0));
    const rotation = Number(p?.rotation) || 0;
    const resolved = resolveToCatalog(visionName, catalog, byNorm);
    if (!resolved) {
      proposed.push({
        id: '',
        name: visionName,
        confidence: p.confidence,
        rotation,
        notes: p.notes,
        visionName,
        sizeW,
        sizeH,
        cellCol,
        cellRow,
        shapeOk: false,
        shapeReason: 'not_in_catalog',
        unresolved: true,
      });
      continue;
    }
    const shape = validateFootprint(shapeIndex, resolved.id, sizeW, sizeH, rotation);
    proposed.push({
      id: resolved.id,
      name: resolved.name,
      confidence: p.confidence,
      rotation: shape.matchedRot ?? rotation,
      notes: p.notes,
      visionName,
      sizeW,
      sizeH,
      cellCol,
      cellRow,
      shapeOk: shape.ok,
      shapeReason: shape.reason,
    });
  }

  const unresolved = proposed.filter((p) => !p.id);
  const toMatch = proposed.filter((p) => p.id);
  const skipSprite = String(env.STB_SKIP_SPRITE || process.env.STB_SKIP_SPRITE || '') === '1';
  console.error(
    `vision raw ${rawItems.length} → catalog ${toMatch.length} (unresolved ${unresolved.length}; shape fail ${
      toMatch.filter((p) => !p.shapeOk).length
    })${skipSprite ? '; skip sprite' : '; sprite-matching…'}`,
  );

  /** @type {any[]} */
  const matched = [];
  /** @type {any} */
  let totalCost = vision.cost || null;
  let reasksUsed = 0;

  for (const u of unresolved) {
    matched.push({
      id: null,
      name: u.visionName || u.name,
      visionName: u.visionName,
      visionConfidence: u.confidence ?? null,
      cell: { col: u.cellCol, row: u.cellRow },
      size: { w: u.sizeW, h: u.sizeH },
      shapeOk: false,
      spriteScore: null,
      confirmed: false,
      reason: 'not_in_catalog',
      shortlistTried: false,
      shortlistPick: null,
    });
  }

  if (skipSprite) {
    /** @type {any[]} */
    const entries = toMatch.map((p, idx) => {
      const item = byId.get(String(p.id));
      return {
        idx,
        p,
        item,
        used: item,
        hit: { score: -1, x: 0, y: 0, scale: 1, rot: 0, tw: 0, th: 0 },
        score: -1,
        shapeOk: p.shapeOk,
        shortlistTried: false,
        shortlistPick: null,
        shortlistRejected: false,
      };
    });

    const queue = entries
      .filter((e) => e.item && !e.p.shapeOk)
      .sort((a, b) => a.score - b.score)
      .slice(0, MAX_SHORTLIST_REASKS);

    console.error(`shortlist queue (skip-sprite): ${queue.length} shape mismatches…`);
    for (const e of queue) {
      if (!env.OPENAI_API_KEY || !e.item) continue;
      e.shortlistTried = true;
      reasksUsed += 1;
      const shortlist = buildShortlist(
        shapeIndex,
        { name: e.p.name, sizeW: e.p.sizeW, sizeH: e.p.sizeH },
        catalogNames,
      );
      try {
        const crop = await cropRegionDataUrl(shotPath, e.hit, {
          cellCol: e.p.cellCol,
          cellRow: e.p.cellRow,
          sizeW: e.p.sizeW,
          sizeH: e.p.sizeH,
          matchW: shotGray.w,
          matchH: shotGray.h,
          grid: activeGrid,
        });
        console.error(`  re-ask ${e.p.name} crop=${crop.mode}`);
        const pick = await visionShortlistPick(shortlist, crop.dataUrl, env);
        totalCost = sumCost(totalCost, pick.cost) || totalCost;
        if (pick.pick) {
          e.shortlistPick = pick.pick;
          const alt = byNorm.get(normName(pick.pick));
          if (alt) {
            const sameName = alt.id === e.item.id || alt.name === e.p.visionName;
            const fp = catalogFootprint(shapeIndex, alt.id, pick.rotation ?? e.p.rotation);
            // No NCC: accept same-name, or pick whose catalog footprint exists (trust crop ID when shape was wrong)
            const accept = sameName || Boolean(fp);
            if (!accept) {
              e.shortlistRejected = true;
            } else {
              e.used = alt;
              if (fp) {
                e.p = {
                  ...e.p,
                  id: alt.id,
                  name: alt.name,
                  sizeW: fp.w,
                  sizeH: fp.h,
                  shapeOk: true,
                  shapeReason: 'catalog_size',
                  rotation: fp.rot,
                };
                e.shapeOk = true;
              } else {
                e.p = {
                  ...e.p,
                  id: alt.id,
                  name: alt.name,
                  shapeOk: true,
                  shapeReason: 'shortlist_same_name',
                };
                e.shapeOk = true;
              }
            }
          }
        }
      } catch (err) {
        console.error(`    shortlist failed: ${err?.message || err}`);
      }
    }

    for (const e of entries) {
      if (!e.item) continue;
      const visionSize = { w: e.p.sizeW, h: e.p.sizeH };
      let size = visionSize;
      let shapeOk = e.p.shapeOk;
      let shapeReason = e.p.shapeReason;
      if (shapeOk) {
        const fp = catalogFootprint(shapeIndex, e.used.id, e.p.rotation);
        if (fp) {
          size = { w: fp.w, h: fp.h };
          shapeOk = true;
          shapeReason = 'catalog_size';
        }
      }
      matched.push({
        id: e.used.id,
        name: e.used.name,
        visionName: e.p.visionName,
        visionConfidence: e.p.confidence ?? null,
        visionNotes: e.p.notes || '',
        visionRotation: e.p.rotation ?? null,
        cell: { col: e.p.cellCol, row: e.p.cellRow },
        size,
        visionSize,
        shapeOk,
        shapeReason,
        spriteScore: null,
        confirmed: shapeOk,
        reason: shapeOk ? 'vision_catalog_only' : 'shape_mismatch',
        shortlistTried: e.shortlistTried,
        shortlistPick: e.shortlistPick,
        shortlistRejected: Boolean(e.shortlistRejected),
      });
    }
  } else {
    // —— Phase A: NCC everyone ——
    /** @type {any[]} */
    const entries = [];
    for (let i = 0; i < toMatch.length; i++) {
      const p = toMatch[i];
      const item = byId.get(String(p.id));
      if (!item) continue;
      const area = p.sizeW * p.sizeH;
      console.error(
        `  match ${i + 1}/${toMatch.length}: ${item.name} (${p.sizeW}x${p.sizeH}, shape=${p.shapeReason})…`,
      );
      if (!item.thumbPath && !item.spritePath) {
        entries.push({
          idx: i,
          p,
          item,
          used: item,
          hit: { score: -1, x: 0, y: 0, scale: 1, rot: 0, tw: 0, th: 0 },
          score: -1,
          shapeOk: p.shapeOk,
        shortlistTried: false,
        shortlistPick: null,
        shortlistRejected: false,
        noSprite: true,
      });
        continue;
      }
      const hit = await bestSpriteHit(item, shotGray, area, {
        cellCol: p.cellCol,
        cellRow: p.cellRow,
        sizeW: p.sizeW,
        sizeH: p.sizeH,
      });
      // Progressive mask for strong hits so duplicates (Flame×3) resolve separately.
      // Weak hits stay unmasked for Phase B rematch.
      if (hit.score >= NCC_OK) {
        maskRegion(shotGray, hit.x, hit.y, hit.tw || 40, hit.th || 40);
      }
      entries.push({
        idx: i,
        p,
        item,
        used: item,
        hit,
        score: hit.score,
        shapeOk: p.shapeOk,
        shortlistTried: false,
        shortlistPick: null,
        shortlistRejected: false,
        noSprite: false,
        masked: hit.score >= NCC_OK,
      });
    }

    // —— Phase B: shortlist weakest first ——
    const queue = entries
      .filter((e) => !e.noSprite && needsShortlist(e))
      .sort((a, b) => a.score - b.score)
      .slice(0, MAX_SHORTLIST_REASKS);

    console.error(
      `shortlist queue: ${queue.length}/${entries.filter((e) => needsShortlist(e)).length} (cap ${MAX_SHORTLIST_REASKS}) — ${queue
        .map((e) => `${e.p.name}@${e.score.toFixed(2)}`)
        .join(', ')}`,
    );

    for (const e of queue) {
      if (!env.OPENAI_API_KEY) break;
      e.shortlistTried = true;
      reasksUsed += 1;
      const area = e.p.sizeW * e.p.sizeH;
      const shortlist = buildShortlist(
        shapeIndex,
        { name: e.used.name, sizeW: e.p.sizeW, sizeH: e.p.sizeH },
        catalogNames,
      );
      try {
        const crop = await cropRegionDataUrl(shotPath, e.hit, {
          cellCol: e.p.cellCol,
          cellRow: e.p.cellRow,
          sizeW: isWingedSword(e.used.name) ? Math.max(e.p.sizeW, 3) : e.p.sizeW,
          sizeH: isWingedSword(e.used.name) ? Math.max(e.p.sizeH, 3) : e.p.sizeH,
          matchW: shotGray.w,
          matchH: shotGray.h,
          pad: isWingedSword(e.used.name) ? 2.2 : undefined,
          grid: activeGrid,
        });
        console.error(
          `  re-ask #${reasksUsed} ${e.p.name} (ncc=${e.score.toFixed(3)}) crop=${crop.mode} ${crop.box.w}x${crop.box.h}`,
        );
        const pick = await visionShortlistPick(shortlist, crop.dataUrl, env);
        totalCost = sumCost(totalCost, pick.cost) || totalCost;
        if (pick.pick) {
          e.shortlistPick = pick.pick;
          const alt = byNorm.get(normName(pick.pick));
          if (alt) {
            const altFp = catalogFootprint(shapeIndex, alt.id, pick.rotation ?? e.p.rotation);
            const altArea = altFp ? altFp.w * altFp.h : area;
            const altHit = await bestSpriteHit(alt, shotGray, altArea, {
              cellCol: e.p.cellCol,
              cellRow: e.p.cellRow,
              sizeW: e.p.sizeW,
              sizeH: e.p.sizeH,
            });
            const gate = acceptShortlistSwap(
              e.item,
              alt,
              e.hit,
              altHit,
              e.p.shapeOk,
              shapeIndex,
              pick.rotation ?? e.p.rotation,
            );
            if (!gate.accept) {
              e.shortlistRejected = true;
              console.error(
                `    reject ${pick.pick} (gain=${gate.gain.toFixed(3)} ratio=${gate.ratio.toFixed(2)} need=${gate.minGain})`,
              );
            } else {
              // same-name: keep proposal identity, optionally refresh hit if rematch better
              const sameName = alt.id === e.item.id || alt.name === e.p.visionName;
              if (sameName) {
                if (altHit.score > e.hit.score) {
                  e.hit = altHit;
                  e.score = altHit.score;
                }
              } else {
                e.hit = altHit;
                e.score = altHit.score;
                e.used = alt;
                if (altFp) {
                  e.p = {
                    ...e.p,
                    id: alt.id,
                    name: alt.name,
                    sizeW: altFp.w,
                    sizeH: altFp.h,
                    shapeOk: true,
                    shapeReason: 'catalog_size',
                  };
                } else {
                  const shape = validateFootprint(
                    shapeIndex,
                    alt.id,
                    e.p.sizeW,
                    e.p.sizeH,
                    pick.rotation ?? e.p.rotation,
                  );
                  e.p = {
                    ...e.p,
                    id: alt.id,
                    name: alt.name,
                    shapeOk: shape.ok,
                    shapeReason: shape.reason,
                  };
                }
                e.shapeOk = e.p.shapeOk;
              }
              if (e.hit.score >= NCC_OK && !e.masked) {
                maskRegion(shotGray, e.hit.x, e.hit.y, e.hit.tw || 40, e.hit.th || 40);
                e.masked = true;
              }
            }
          }
        }
      } catch (err) {
        console.error(`    shortlist failed: ${err?.message || err}`);
      }
    }

    // Mask confirmed hits in original order, then emit
    entries.sort((a, b) => a.idx - b.idx);
    for (const e of entries) {
      if (e.noSprite) {
        matched.push({
          id: e.item.id,
          name: e.item.name,
          visionName: e.p.visionName,
          visionConfidence: e.p.confidence ?? null,
          cell: { col: e.p.cellCol, row: e.p.cellRow },
          size: { w: e.p.sizeW, h: e.p.sizeH },
          visionSize: { w: e.p.sizeW, h: e.p.sizeH },
          shapeOk: e.p.shapeOk,
          spriteScore: null,
          confirmed: false,
          reason: 'no local sprite',
          shortlistTried: false,
          shortlistPick: null,
          shortlistRejected: false,
        });
        continue;
      }
      if (e.hit.score >= NCC_OK && !e.masked) {
        maskRegion(shotGray, e.hit.x, e.hit.y, e.hit.tw || 40, e.hit.th || 40);
      }
      matched.push(
        finalizeEntry(
          e.p,
          e.used,
          e.hit,
          e.shortlistTried,
          e.shortlistPick,
          e.shortlistRejected,
          shapeIndex,
        ),
      );
    }
  }

  /** @type {Record<string, number>} */
  const counts = {};
  for (const m of matched.filter((x) => x.confirmed)) {
    counts[m.name] = (counts[m.name] || 0) + 1;
  }

  const out = {
    ok: true,
    shot: path.basename(shotPath),
    visionMs: vision.ms,
    model: vision.model,
    provider: vision.provider || null,
    responseMode: vision.responseMode || null,
    usage: vision.usage || null,
    cost: totalCost,
    proposedCount: rawItems.length,
    catalogMapped: toMatch.length,
    unresolvedCount: unresolved.length,
    shapeMismatchCount: matched.filter((m) => m.shapeOk === false && m.id).length,
    shortlistReasks: reasksUsed,
    confirmedCount: matched.filter((m) => m.confirmed).length,
    confirmedCounts: counts,
    unresolved: unresolved.map((u) => u.visionName || u.name),
    items: matched,
  };

  console.log(JSON.stringify(out, null, 2));
}

main(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
