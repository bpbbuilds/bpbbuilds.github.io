/**
 * Enter-wizard history.db pick / round apply.
 */

import { decodeHistoryRun, openHistoryDb } from '../create/history-db.js';
import { newPlacementKey } from '../create/draft-io.js';
import { saveEnterWizardDb } from './enter-wizard-persist.js';

/**
 * @param {{
 *   getSelectedRun: () => import('../create/history-db.js').HistoryDecodedRun | null,
 *   getRoundIndex: () => number,
 *   setRoundIndex: (n: number) => void,
 *   setPlacements: (p: any[]) => void,
 *   catalog: () => { itemsById: Map<string, object> } | null,
 * }} ctx
 */
export function applyEnterWizardRound(ctx) {
  const selectedRun = ctx.getSelectedRun();
  if (!selectedRun) {
    ctx.setPlacements([]);
    return;
  }
  const idx = Math.max(0, Math.min(selectedRun.rounds.length - 1, ctx.getRoundIndex()));
  ctx.setRoundIndex(idx);
  const src = selectedRun.rounds[idx]?.placements || [];
  ctx.setPlacements(
    src
      .filter((p) => p.id && ctx.catalog()?.itemsById.has(p.id))
      .map((p) => ({
        ...p,
        key: p.key || newPlacementKey(),
        priority: null,
      })),
  );
}

/**
 * @param {{
 *   dbHandle: () => { db: any } | null,
 *   catalog: () => object | null,
 *   summaries: () => import('../create/history-db.js').HistoryRunSummary[],
 *   setStatus: (s: string) => void,
 *   paint: () => void,
 *   setSelectedRun: (r: any) => void,
 *   setRoundIndex: (n: number) => void,
 *   setPlacements: (p: any[]) => void,
 *   applyRound: () => void,
 *   refreshSimDps: () => Promise<void>,
 *   root: string,
 * }} ctx
 * @param {number} runId
 */
export async function selectEnterWizardRun(ctx, runId) {
  if (!ctx.dbHandle() || !ctx.catalog()) return;
  ctx.setStatus('Loading run…');
  ctx.paint();
  try {
    const summary = ctx.summaries().find((s) => s.runId === runId);
    if (!summary) throw new Error('Run not found.');
    const selectedRun = await decodeHistoryRun(ctx.dbHandle().db, summary, ctx.root);
    ctx.setSelectedRun(selectedRun);
    ctx.setRoundIndex(Math.max(0, selectedRun.rounds.length - 1));
    ctx.applyRound();
    ctx.setStatus('');
    await ctx.refreshSimDps();
    ctx.paint();
  } catch (err) {
    ctx.setSelectedRun(null);
    ctx.setPlacements([]);
    ctx.setStatus(err instanceof Error ? err.message : 'Could not decode run.');
    ctx.paint();
  }
}

/**
 * @param {{
 *   eventSlug: string,
 *   root: string,
 *   fileInput: HTMLInputElement,
 *   closeDb: () => void,
 *   setDbHandle: (h: any) => void,
 *   setSummaries: (s: any[]) => void,
 *   setSelectedRun: (r: null) => void,
 *   setPlacements: (p: any[]) => void,
 *   setFileName: (n: string) => void,
 *   setStep: (s: string) => void,
 *   setStatus: (s: string) => void,
 *   paint: () => void,
 * }} ctx
 */
export function bindEnterWizardFileInput(ctx) {
  ctx.fileInput.addEventListener('change', async () => {
    const file = ctx.fileInput.files?.[0];
    ctx.fileInput.value = '';
    if (!file) return;
    ctx.setStatus('Reading history.db…');
    ctx.paint();
    try {
      ctx.closeDb();
      const buffer = await file.arrayBuffer();
      const handle = await openHistoryDb(buffer, ctx.root);
      ctx.setDbHandle(handle);
      ctx.setSummaries(handle.runs || []);
      ctx.setSelectedRun(null);
      ctx.setPlacements([]);
      const name = file.name || 'history.db';
      ctx.setFileName(name);
      await saveEnterWizardDb(ctx.eventSlug, buffer, name);
      ctx.setStatus('');
      ctx.setStep('upload');
      ctx.paint();
    } catch (err) {
      ctx.setStatus(err instanceof Error ? err.message : 'Could not open history.db.');
      ctx.paint();
    }
  });
}
