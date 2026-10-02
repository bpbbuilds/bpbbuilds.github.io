/**
 * Apply screenshot-vision items onto the create draft.
 */

import { getSession, signInWithDiscord } from '../../shared/auth.js';
import { config } from '../../shared/config.js';
import { confirmDialog } from '../../shared/confirm-dialog.js';
import { BOARD_COLS, BOARD_ROWS, isBagItem } from './collision.js';
import { newPlacementKey } from './draft-io.js';
import {
  detectScreenshotBags,
  detectScreenshotItems,
  MIN_CONF_BAG,
  wantEdgeVisionFallback,
} from '../../shared/screenshot-detector.js?v=grid97';
import { placeFromDetections } from './screenshot-direct.js?v=grid97';
import {
  isUnrecognizedId,
  UNRECOGNIZED_ID,
  unrecognizedCatalogItem,
} from './screenshot-unrecognized.js?v=fa3633b';
import {
  preprocessScreenshotForVision,
  clampScreenshotItem,
} from './screenshot-preprocess.js?v=grid97';
import { pruneScreenshotPriors, solveBoardPuzzle } from './screenshot-solver.js?v=fa3633b';
import { refinePaintCompare } from './screenshot-refine.js?v=grid97';
import { SCREENSHOT_PIPELINE_VER } from './screenshot-pipeline-ver.js?v=grid97';
import { SCREENSHOT_IMPORT_ENABLED } from '../../shared/feature-flags.js';

/**
 * @typedef {{
 *   id: string,
 *   name?: string,
 *   x: number,
 *   y: number,
 *   r: number,
 *   sizeW?: number,
 *   sizeH?: number,
 *   confidence?: number,
 * }} ScreenshotItem
 */

/**
 * @param {File | Blob} file
 * @returns {Promise<string>}
 */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string' && result.startsWith('data:image/')) {
        resolve(result);
        return;
      }
      reject(new Error('Could not read that image.'));
    };
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Call screenshot-to-build Edge Function.
 * @param {string} imageDataUrl
 * @returns {Promise<ScreenshotItem[]>}
 */
export async function fetchScreenshotItems(imageDataUrl) {
  const url = String(config.screenshotToBuildUrl || '').trim();
  if (!url || url.includes('YOUR_')) {
    throw new Error(
      'Screenshot import is not configured. Run node scripts/write-config.mjs after deploying screenshot-to-build.',
    );
  }

  let session = await getSession();
  if (!session?.access_token) {
    await signInWithDiscord();
    throw new Error('Sign in with Discord to import a screenshot — returning after login.');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ imageDataUrl }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (res.status === 403 && data?.code === 'premium_required') {
    const err = new Error('Premium required for screenshot import.');
    /** @type {any} */ (err).code = 'premium_required';
    throw err;
  }
  if (res.status === 401) {
    await signInWithDiscord();
    throw new Error('Sign in with Discord to import a screenshot — returning after login.');
  }
  if (!res.ok) {
    throw new Error(
      typeof data?.error === 'string' ? data.error : "Couldn't read this image.",
    );
  }

  const items = Array.isArray(data?.items) ? data.items : [];
  if (!items.length) {
    throw new Error("Couldn't read this image.");
  }
  return items
    .map((it) => {
      const base = clampScreenshotItem({
        id: String(it.id || ''),
        name: it.name ? String(it.name) : undefined,
        x: Number(it.x) || 0,
        y: Number(it.y) || 0,
        r: Number(it.r) || 0,
      });
      const sizeW = Math.max(1, Math.round(Number(it.sizeW) || 1));
      const sizeH = Math.max(1, Math.round(Number(it.sizeH) || 1));
      const confidence = Number(it.confidence);
      return {
        ...base,
        sizeW,
        sizeH,
        ...(Number.isFinite(confidence) ? { confidence } : {}),
      };
    })
    .filter((it) => it.id);
}

/**
 * @param {{
 *   state: ReturnType<import('./editor-state.js').createEditorState>,
 *   itemsById: Map<string, object>,
 *   items: ScreenshotItem[],
 *   rejected?: number,
 *   visionCount?: number,
 *   bags?: ScreenshotItem[],
 * }} opts
 * @returns {Promise<{ placed: number, cancelled?: boolean, rejected?: number, visionCount?: number }>}
 */
export async function applyScreenshotItemsToDraft(opts) {
  const { state, itemsById, items } = opts;
  if (!itemsById.has(UNRECOGNIZED_ID)) {
    itemsById.set(UNRECOGNIZED_ID, unrecognizedCatalogItem());
  }
  const toPlacement = (it) => ({
    id: it.id,
    x: it.x,
    y: it.y,
    r: it.r,
    key: newPlacementKey(),
    gems: [],
    priority: null,
  });
  const itemPlacements = items
    .filter((it) => it.id && itemsById.has(it.id))
    .map(toPlacement);

  const prev = state.getDraft();
  const detectedBags = (opts.bags || [])
    .filter((b) => b.id && itemsById.has(b.id))
    .map(toPlacement);
  if (!itemPlacements.length && !detectedBags.length) {
    throw new Error("Couldn't map detected items to the catalog.");
  }
  const bagPlacements = detectedBags.length
    ? detectedBags
    : (prev.placements || []).filter((p) => isBagItem(itemsById.get(p.id)));
  const placements = [...bagPlacements, ...itemPlacements];
  const unrecN = itemPlacements.filter((p) => isUnrecognizedId(p.id)).length;

  const hadBoard = (prev.placements || []).length > 0;
  if (hadBoard) {
    const bagNote = detectedBags.length
      ? 'Bags are replaced with the ones found in the screenshot. Your class stays the same.'
      : 'Your class and bags stay the same.';
    const unrecNote = unrecN
      ? ` ${unrecN} unrecognized — replace or delete before publish.`
      : '';
    const ok = await confirmDialog({
      title: 'Replace board?',
      body: prev.history
        ? `Screenshot import will replace the board and clear attached run history. ${bagNote}${unrecNote}`
        : `Screenshot import will replace the items currently on the board. ${bagNote}${unrecNote}`,
      confirmLabel: 'Replace',
      cancelLabel: 'Cancel',
      danger: true,
    });
    if (!ok) return { placed: 0, cancelled: true };
  } else if (unrecN) {
    console.info(
      '[screenshot]',
      `${unrecN} unrecognized — replace or delete before publish`,
    );
  }

  state.replaceDraft({
    ...prev,
    placements,
    parked: [],
    history: null,
    build_tag:
      prev.build_tag === 'real' || prev.history
        ? 'feasible'
        : prev.build_tag || 'theory',
  });

  return {
    placed: placements.length,
    rejected: opts.rejected ?? 0,
    visionCount: opts.visionCount ?? placements.length,
    unrecognized: unrecN,
  };
}

/**
 * Full path: data URL → grid crop → vision → local NCC tile → draft.
 * @param {{
 *   state: ReturnType<import('./editor-state.js').createEditorState>,
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   root?: string,
 *   file: File | Blob,
 *   allowOffsizeGrid?: boolean,
 * }} opts
 */
export function offsizeBoardMessage(cols, rows) {
  return `This photo's grid reads as ${cols}×${rows}. The board is ${BOARD_COLS}×${BOARD_ROWS}, so nothing was placed.`;
}

export async function importScreenshotFile(opts) {
  if (!SCREENSHOT_IMPORT_ENABLED) {
    throw new Error('Image import is intentionally paused for launch.');
  }
  console.info('[screenshot] pipeline', `v=${SCREENSHOT_PIPELINE_VER}`);
  const dataUrl = await fileToDataUrl(opts.file);
  const pre = await preprocessScreenshotForVision(dataUrl);
  if (pre.gridOk) {
    console.info(
      '[screenshot] grid ok',
      `cell=${pre.grid?.cellW?.toFixed?.(1)}`,
      `${pre.grid?.cols}x${pre.grid?.rows}`,
    );
  } else {
    console.info('[screenshot] grid fallback — sending full image');
  }
  if (
    pre.gridOk &&
    pre.grid &&
    (pre.grid.cols !== BOARD_COLS || pre.grid.rows !== BOARD_ROWS) &&
    !opts.allowOffsizeGrid
  ) {
    const err = new Error(offsizeBoardMessage(pre.grid.cols, pre.grid.rows));
    /** @type {any} */ (err).code = 'offsize_grid';
    throw err;
  }
  const root = opts.root || '/';
  const getSpriteUrl =
    opts.getSpriteUrl ||
    ((item) => {
      const stem = String(item?.image || '')
        .replace(/^.*\//, '')
        .replace(/\.(png|webp)$/i, '');
      return stem ? `/assets/item-thumbs/1x/${stem}.webp` : '';
    });

  /** @type {Awaited<ReturnType<typeof fetchScreenshotItems>>} */
  let visionItems;
  if (wantEdgeVisionFallback()) {
    console.info('[screenshot] vision=edge fallback');
    visionItems = await fetchScreenshotItems(pre.dataUrl);
  } else {
    /** @type {Awaited<ReturnType<typeof detectScreenshotItems>>} */
    let detections;
    try {
      detections = await detectScreenshotItems(pre.dataUrl, {
        root,
        grid: pre.grid,
      });
      if (!detections.length) {
        // Tight crops / small boards often need a lower floor.
        detections = await detectScreenshotItems(pre.dataUrl, {
          root,
          grid: pre.grid,
          conf: 0.12,
        });
        if (detections.length) {
          console.info('[screenshot] detector retry conf=0.12', `n=${detections.length}`);
        }
      }
      // Prefer dedicated bag model for Pass A; drop item-model bag IDs only when
      // at least one bag hint clears the placement floor (avoid wiping both sources).
      const bagDets = await detectScreenshotBags(pre.dataUrl, {
        root,
        grid: pre.grid,
      });
      if (!detections.length && !bagDets.length) {
        throw new Error('Detector returned no items');
      }
      const strongBags = bagDets.filter(
        (d) => (Number(d.confidence) || 0) >= MIN_CONF_BAG,
      );
      if (strongBags.length) {
        detections = [
          ...detections.filter((d) => !isBagItem(opts.itemsById.get(String(d.id)))),
          ...bagDets,
        ];
        console.info('[screenshot] bag-model hints', bagDets.length, `strong=${strongBags.length}`);
      } else if (bagDets.length) {
        detections = [...detections, ...bagDets];
        console.info(
          '[screenshot] bag-model weak',
          bagDets.length,
          `(kept item-model bags; none ≥${MIN_CONF_BAG})`,
        );
      }
    } catch (err) {
      console.warn('[screenshot] detector failed', err);
      throw new Error(
        err instanceof Error && /manifest|unavailable|Failed to load onnx|404/i.test(err.message)
          ? 'Detector unavailable. Train/publish the model, or add ?vision=edge for the OpenAI fallback.'
          : err instanceof Error
            ? err.message
            : "Couldn't read this image.",
      );
    }

    // Detector boxes are the placement source; NCC only breaks rotation ties.
    const direct = await placeFromDetections({
      cropDataUrl: pre.dataUrl,
      grid: pre.grid,
      detections,
      itemsById: opts.itemsById,
      root,
      getSpriteUrl,
    });
    if (direct.items.length || direct.bags.length) {
      return applyScreenshotItemsToDraft({
        state: opts.state,
        itemsById: opts.itemsById,
        items: direct.items,
        bags: direct.bags,
        rejected: direct.rejected,
        visionCount: direct.visionCount,
      });
    }
    visionItems = pruneScreenshotPriors(detections);
  }

  let solved;
  try {
    solved = await solveBoardPuzzle({
      cropDataUrl: pre.dataUrl,
      grid: pre.grid,
      visionItems,
      itemsById: opts.itemsById,
      getSpriteUrl,
      root,
      draftPlacements: opts.state.getDraft()?.placements || [],
    });
  } catch (err) {
    console.warn('[screenshot] solver failed; using vision poses', err);
    solved = {
      items: visionItems,
      visionCount: visionItems.length,
      rejected: 0,
    };
  }

  if (!solved.items.length) {
    throw new Error("Couldn't read this image.");
  }

  let items = solved.items;
  try {
    const refined = await refinePaintCompare({
      cropDataUrl: pre.dataUrl,
      grid: pre.grid,
      items: solved.items,
      visionItems,
      itemsById: opts.itemsById,
      getSpriteUrl,
      root,
      draftPlacements: opts.state.getDraft()?.placements || [],
    });
    if (refined.items?.length) items = refined.items;
  } catch (err) {
    console.warn('[screenshot] paint refine failed; keeping NCC board', err);
  }

  return applyScreenshotItemsToDraft({
    state: opts.state,
    itemsById: opts.itemsById,
    items,
    rejected: solved.rejected,
    visionCount: solved.visionCount,
  });
}
