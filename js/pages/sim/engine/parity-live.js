/**
 * Phase 265 — live PvP / training-fight captures vs dummy sim `expect` bands.
 * Opponent HP is stored but never used to rewrite dummy expect.
 */

export const LIVE_STACK_KEYS = [
  'mana',
  'heat',
  'lucky',
  'regeneration',
  'poison',
  'cold',
  'empower',
  'spikes',
  'vampirism',
  'blind',
];

/**
 * @param {number} hp
 * @param {number} maxHp
 * @param {number} [frac]
 * @param {number} [minWidth]
 */
export function hpBand(hp, maxHp, frac = 0.15, minWidth = 25) {
  const h = Math.round(Number(hp) || 0);
  const cap = Math.max(1, Number(maxHp) || 200);
  const span = Math.max(minWidth, Math.round(cap * frac));
  const half = Math.ceil(span / 2);
  return {
    min: Math.max(0, h - half),
    max: h + half,
  };
}

/**
 * @param {object | null | undefined} live
 */
export function isLiveFilled(live) {
  if (!live || typeof live !== 'object') return false;
  if (!Number.isFinite(Number(live.playerEndHp))) return false;
  if (!live.capturedAt) return false;
  if (live.notes == null || String(live.notes).trim() === '') return false;
  return true;
}

/**
 * @param {object} live
 */
export function livePlayerBandHolds(live) {
  if (!isLiveFilled(live)) return false;
  const hp = Math.round(Number(live.playerEndHp));
  const min = live.playerEndHpMin;
  const max = live.playerEndHpMax;
  if (min == null || max == null) return false;
  return hp >= min && hp <= max;
}

/**
 * Merge a game-side capture into a parity fixture. Does not touch `expect`
 * (those stay dummy-sim baseline).
 * @param {object} fixture
 * @param {object} capture
 */
export function applyLiveCapture(fixture, capture) {
  if (!fixture || typeof fixture !== 'object') {
    throw new Error('fixture object required');
  }
  const hp = Number(capture?.playerEndHp);
  if (!Number.isFinite(hp)) {
    throw new Error('capture.playerEndHp required');
  }
  const notes = String(capture.notes ?? '').trim();
  if (!notes) {
    throw new Error('capture.notes required (opponent / fight length / max HP)');
  }
  const maxHp = Number(capture.playerMaxHp) > 0 ? Number(capture.playerMaxHp) : 200;
  const pb = hpBand(hp, maxHp);
  const opp = capture.dummyEndHp ?? capture.opponentEndHp ?? null;
  const stam = capture.playerStamina;
  fixture.live = {
    ...(fixture.live || {}),
    playerEndHp: hp,
    dummyEndHp: opp == null || opp === '' ? null : Number(opp),
    playerStamina: stam == null || stam === '' ? null : Number(stam),
    stacks: capture.stacks && typeof capture.stacks === 'object' ? capture.stacks : null,
    capturedAt: capture.capturedAt || new Date().toISOString(),
    notes,
    playerMaxHp: maxHp,
    fightDurationSec:
      capture.fightDurationSec == null || capture.fightDurationSec === ''
        ? null
        : Number(capture.fightDurationSec),
    opponentClass: capture.opponentClass || null,
    playerEndHpMin: pb.min,
    playerEndHpMax: pb.max,
    opponentHpComparable: false,
  };
  return fixture;
}

export function emptyLive() {
  return {
    playerEndHp: null,
    dummyEndHp: null,
    playerStamina: null,
    stacks: null,
    capturedAt: null,
    notes: null,
    playerMaxHp: null,
    fightDurationSec: null,
    opponentClass: null,
    playerEndHpMin: null,
    playerEndHpMax: null,
    opponentHpComparable: false,
  };
}
