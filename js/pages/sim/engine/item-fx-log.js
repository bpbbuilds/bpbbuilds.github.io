/**
 * Item overlay events (DamageBuff / CooldownAdvance) — game pops these on
 * the item via Util.spawnLabelOnItem, not as Combat Log sentences.
 */

/**
 * Character.stun / playStunAnimation — BuffLabel on the stunned fighter.
 * Dedupes a port that already logged the same stun this tick.
 * @param {import('./actor.js').SimActor} actor
 * @param {number} nowT
 * @param {number} dur
 * @param {object} opts
 * @param {'stunned' | 'stun_resisted'} kind
 */
export function pushStunLabel(actor, nowT, dur, opts, kind) {
  const log = actor._eventLog;
  if (!Array.isArray(log)) return;
  const t = Number(nowT) || 0;
  const target = actor.id;
  for (let i = log.length - 1; i >= Math.max(0, log.length - 8); i -= 1) {
    const e = log[i];
    if (e?.meta?.stack !== 'stun' || e.target !== target) continue;
    if (Math.abs((Number(e.t) || 0) - t) > 0.05) continue;
    if (kind === 'stun_resisted' && e.meta?.kind === 'stun_resisted') return;
    if (kind === 'stunned' && (e.meta?.kind === 'stunned' || !e.meta?.kind)) {
      e.meta = { ...e.meta, category: 'status', kind: 'stunned' };
      if (!e.amount) e.amount = dur;
      return;
    }
  }
  const origin = opts.origin || opts.piece || null;
  log.push({
    t,
    type: 'debuff',
    actor: origin?.side === 'them' ? 'dummy' : target === 'dummy' ? 'player' : 'dummy',
    target,
    amount: dur,
    itemId: origin?.itemId,
    placementKey: origin?.placementKey,
    label: kind === 'stun_resisted' ? 'Stun Resisted' : `Stun (${dur}s)`,
    meta: { category: 'status', stack: 'stun', kind },
  });
}

/**
 * @param {import('./pieces.js').CombatPiece | null | undefined} piece
 * @param {Partial<import('../sim-events.js').SimEvent>} partial
 */
export function pushItemOverlayEvent(piece, partial) {
  const log = piece?._eventLog;
  if (!Array.isArray(log) || !piece) return;
  const t = Number(piece._owner?._simT ?? partial.t) || 0;
  log.push({
    t,
    actor: piece.side === 'them' ? 'dummy' : 'player',
    itemId: piece.itemId,
    placementKey: piece.placementKey,
    ...partial,
    meta: { uiOnly: true, ...(partial.meta || {}) },
  });
}
