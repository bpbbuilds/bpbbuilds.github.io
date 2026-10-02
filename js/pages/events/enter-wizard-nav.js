/**
 * Enter-wizard Next-step transitions.
 */

/**
 * @param {{
 *   getStep: () => string,
 *   setStep: (s: string) => void,
 *   setStatus: (s: string) => void,
 *   paint: () => void,
 *   getSession: () => Promise<any>,
 *   signInWithDiscord: () => Promise<any>,
 *   myEntriesLen: () => number,
 *   maxEntries: number,
 *   hasDb: () => boolean,
 *   gateState: () => { ok: boolean, errors: string[] },
 *   titleTrim: () => string,
 *   refreshSimDps: () => Promise<void>,
 * }} ctx
 */
export async function advanceEnterWizard(ctx) {
  ctx.setStatus('');
  const step = ctx.getStep();
  if (step === 'account') {
    try {
      await ctx.signInWithDiscord();
    } catch (err) {
      ctx.setStatus(err instanceof Error ? err.message : 'Sign-in failed.');
      ctx.paint();
    }
    return;
  }
  if (step === 'upload') {
    if (ctx.myEntriesLen() >= ctx.maxEntries) {
      ctx.setStatus('Entry cap reached.');
      ctx.paint();
      return;
    }
    if (!ctx.hasDb()) {
      ctx.setStatus('Upload a history.db first.');
      ctx.paint();
      return;
    }
    const gate = ctx.gateState();
    if (!gate.ok) {
      ctx.setStatus(gate.errors[0] || 'Fix board gates first.');
      ctx.paint();
      return;
    }
    ctx.setStep('details');
    await ctx.refreshSimDps();
    ctx.paint();
  }
}
