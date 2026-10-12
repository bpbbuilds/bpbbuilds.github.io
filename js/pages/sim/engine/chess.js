/** Board-owned ChessPiece event dispatch; Chess Board movement remains separate. */

import { ctxForPiece } from './vs-board.js';
import { getScriptHandler } from './scripts/registry.js';

function allPieces(world) {
  return [...(world.youPieces || []), ...(world.themPieces || [])];
}

/**
 * Dispatch ChessPiece.onPieceCaptured's source effects without inventing board
 * movement. A future Chess Board AI can call this after choosing a legal move.
 */
export function dispatchChessCapture(capturingPiece, eliminatedPiece, world) {
  capturingPiece.numCaptures = (Number(capturingPiece.numCaptures) || 0) + 1;
  capturingPiece._chessCaptures = capturingPiece.numCaptures;
  const captureCtx = ctxForPiece(capturingPiece, world);
  getScriptHandler(capturingPiece.itemId)?.onChessCapture?.(
    capturingPiece,
    captureCtx,
    eliminatedPiece,
  );
  eliminatedPiece.alive = false;
  for (const listener of allPieces(world)) {
    getScriptHandler(listener.itemId)?.onChessAnyPieceCaptured?.(
      listener,
      ctxForPiece(listener, world),
      capturingPiece,
      eliminatedPiece,
    );
  }
  return { captureCtx };
}

/** Dispatch ChessPiece.onEliminatedBy's source effect. */
export function dispatchChessElimination(eliminatedPiece, capturingPiece, world) {
  const ctx = ctxForPiece(eliminatedPiece, world);
  getScriptHandler(eliminatedPiece.itemId)?.onChessEliminated?.(
    eliminatedPiece,
    ctx,
    capturingPiece,
  );
  return { ctx };
}
