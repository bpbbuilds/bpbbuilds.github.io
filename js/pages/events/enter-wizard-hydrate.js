/**
 * Restore enter-wizard session (history.db + step) after refresh.
 */

import { openHistoryDb } from '../create/history-db.js';
import { loadEnterWizardDb } from './enter-wizard-persist.js';

/** @type {import('./enter-wizard.js').WizardStep[] | string[]} */
const STEP_ORDER = ['account', 'upload', 'details'];

/**
 * @param {{
 *   eventSlug: string,
 *   root: string,
 *   restore: import('./enter-wizard-persist.js').EnterWizardMeta,
 *   getStep: () => string,
 *   setStep: (s: string) => void,
 *   setDbHandle: (h: any) => void,
 *   setSummaries: (s: any[]) => void,
 *   setFileName: (n: string) => void,
 *   selectRun: (runId: number) => Promise<void>,
 *   setRoundIndex: (n: number) => void,
 *   applyRound: () => void,
 *   refreshSimDps: () => Promise<void>,
 * }} ctx
 * @returns {Promise<string>} status message
 */
export async function hydrateEnterWizardFromSession(ctx) {
  const stored = await loadEnterWizardDb(ctx.eventSlug);
  if (stored?.buffer) {
    try {
      const handle = await openHistoryDb(stored.buffer, ctx.root);
      ctx.setDbHandle(handle);
      ctx.setSummaries(handle.runs || []);
      ctx.setFileName(stored.fileName || ctx.restore.fileName || 'history.db');
      const runId = Number(ctx.restore.selectedRunId);
      if (Number.isFinite(runId) && runId > 0) {
        await ctx.selectRun(runId);
        await ctx.refreshSimDps();
      }
    } catch (err) {
      console.warn('[event-enter] restore db failed', err);
      if (STEP_ORDER.indexOf(ctx.getStep()) > STEP_ORDER.indexOf('upload')) {
        ctx.setStep('upload');
      }
    }
  } else if (STEP_ORDER.indexOf(ctx.getStep()) > STEP_ORDER.indexOf('upload')) {
    ctx.setStep('upload');
  }
  return 'Restored your in-progress entry.';
}
