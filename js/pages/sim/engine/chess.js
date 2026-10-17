/** Board-owned ChessPiece event dispatch. */

import { ctxForPiece } from './vs-board.js';
import { getScriptHandler } from './scripts/registry.js';

function allPieces(world) {
  return [...(world.youPieces || []), ...(world.themPieces || [])];
}

/**
 * Dispatch the source capture lifecycle after the board has moved the
 * capturing piece and removed the eliminated piece's occupied cells.
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

/**
 * Dispatch the complete ChessBoard.capture() order: capture effect, eliminated
 * effect, then the board's piece_captured listeners.
 */
export function dispatchChessCaptureSequence(capturingPiece, eliminatedPiece, world) {
  capturingPiece.numCaptures = (Number(capturingPiece.numCaptures) || 0) + 1;
  capturingPiece._chessCaptures = capturingPiece.numCaptures;
  const captureCtx = ctxForPiece(capturingPiece, world);
  getScriptHandler(capturingPiece.itemId)?.onChessCapture?.(
    capturingPiece,
    captureCtx,
    eliminatedPiece,
  );
  eliminatedPiece.alive = false;
  const eliminationCtx = ctxForPiece(eliminatedPiece, world);
  getScriptHandler(eliminatedPiece.itemId)?.onChessEliminated?.(
    eliminatedPiece,
    eliminationCtx,
    capturingPiece,
  );
  for (const listener of allPieces(world)) {
    getScriptHandler(listener.itemId)?.onChessAnyPieceCaptured?.(
      listener,
      ctxForPiece(listener, world),
      capturingPiece,
      eliminatedPiece,
    );
  }
  return { captureCtx, eliminationCtx };
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
