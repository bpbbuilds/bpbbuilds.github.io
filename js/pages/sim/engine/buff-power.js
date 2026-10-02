/**
 * Item.buffPowers — Game starts each stack at 1.0; giveBuffPower adds.
 * giveStacks / inflictPoison then round(amount * buffPowers[type]).
 */

/** @type {Map<string, object> | null} */
let piecesByKey = null;

/**
 * @param {object[] | null | undefined} pieces
 */
export function bindBuffPowerPieces(pieces) {
  piecesByKey = new Map();
  for (const p of pieces || []) {
    const key = p?.placementKey;
    if (key) piecesByKey.set(key, p);
  }
}

export function unbindBuffPowerPieces() {
  piecesByKey = null;
}

/**
 * @param {object | null | undefined} piece
 * @param {string} stack
 * @param {number} power
 */
export function giveBuffPower(piece, stack, power) {
  if (!piece || !stack) return;
  if (!piece.buffPowers) piece.buffPowers = {};
  const key = String(stack).toLowerCase();
  const cur = Number(piece.buffPowers[key]);
  const add = Number(power);
  if (!Number.isFinite(add) || add === 0) return;
  piece.buffPowers[key] = (Number.isFinite(cur) ? cur : 1) + add;
}

/**
 * @param {object | null | undefined} piece
 * @param {string} stack
 */
export function buffPowerOf(piece, stack) {
  if (!piece?.buffPowers) return 1;
  const n = Number(piece.buffPowers[String(stack).toLowerCase()]);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * @param {object | null | undefined} opts
 */
export function originPieceFromOpts(opts) {
  if (opts?.piece) return opts.piece;
  const key = opts?.originKey;
  if (key && piecesByKey) return piecesByKey.get(key) || null;
  return null;
}

/**
 * Game Item.giveStacks: round(amount * buffPowers[type]).
 * @param {number} amount
 * @param {string} stack
 * @param {object} [opts]
 */
export function scaleByBuffPower(amount, stack, opts = {}) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n === 0) return n;
  const piece = originPieceFromOpts(opts);
  if (!piece) return n;
  const pow = buffPowerOf(piece, stack);
  if (pow === 1) return n;
  return Math.round(n * pow);
}
