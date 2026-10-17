import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { makeRng } from '../js/pages/sim/engine/rng.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/ChessBoard.gd', 'utf8');
const inventory = JSON.parse(fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8'));
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const itemsById = new Map(catalog.map((item) => [item.id, item]));
const handler = getScriptHandler('chess_board');

assert.equal(inventory.byId.chess_board?.file, 'Exclusive/ChessBoard.gd');
assert.deepEqual(inventory.byId.chess_board?.overrides, ['doCooldownEffect', 'onPrepare']);
assert.match(source, /func onPrepare\(\):[\s\S]*?activeBlackPieces\.clear\(\)[\s\S]*?turnColor = ChessPiece\.PieceColor\.White/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*?findBestPieceToCapture|func doCooldownEffect\(\):[\s\S]*?findPieceToCapture/);
assert.match(source, /func findSpaceToMove\(activePieces\):[\s\S]*?inventory\.isCellEmpty/);
assert.match(source, /turnColor = ChessPiece\.PieceColor\.White - turnColor/);
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');
assert.equal(handler?.onCombatStart, undefined, 'Chess Board has no source combat-start hook');

function context(placements, seed = 1) {
  const pieces = buildCombatPieces(placements, itemsById);
  const graph = buildBoardGraph(placements, itemsById);
  const player = createActor('player', { maxHp: 100, maxStamina: 10 });
  const dummy = createActor('dummy', { maxHp: 100, maxStamina: 10 });
  return {
    t: 2,
    player,
    dummy,
    pieces,
    graph,
    itemsById,
    events: [],
    rng: makeRng(seed),
    canAffect: null,
    board: { addSpeed(value) { this.speed = (this.speed || 0) + value; } },
    bus: { on() {} },
  };
}

function boardAndPieces(ctx) {
  const board = ctx.pieces.find((piece) => piece.itemId === 'chess_board');
  assert.ok(board, 'Chess Board fixture contains the board piece');
  handler.onPrepare(board, ctx);
  for (const piece of ctx.pieces) {
    getScriptHandler(piece.itemId)?.onPrepare?.(piece, ctx);
  }
  return board;
}

// White Pawn can capture Black Pawn at its source star cell, then the existing
// ChessPiece ports receive the exact capture/elimination lifecycle.
{
  const ctx = context([
    { id: 'chess_board', key: 'board', x: 0, y: 0, r: 0 },
    { id: 'white_pawn', key: 'white', x: 5, y: 5, r: 0 },
    { id: 'black_pawn', key: 'black', x: 6, y: 4, r: 0 },
  ]);
  const board = boardAndPieces(ctx);
  assert.equal(handler.onCooldownEffect(board, ctx), true);
  const white = ctx.pieces.find((piece) => piece.itemId === 'white_pawn');
  const black = ctx.pieces.find((piece) => piece.itemId === 'black_pawn');
  assert.equal(black.alive, false, 'Chess Board removes the captured piece');
  assert.equal(white.numCaptures, 1, 'Chess Board increments the capturing piece');
  assert.equal(ctx.player.stacks.regeneration, 2, 'White Pawn capture effect runs');
  assert.equal(ctx.dummy.stacks.poison, 2, 'Black Pawn elimination effect runs');
  assert.ok(ctx.events.some((event) => event.meta?.event === 'piece_captured'));
  assert.ok(ctx.events.some((event) => event.type === 'activate' && event.itemId === 'chess_board'));
  assert.ok(
    ctx.events.findIndex((event) => event.type === 'activate' && event.itemId === 'chess_board') <
      ctx.events.findIndex((event) => event.meta?.event === 'piece_captured'),
    'Chess Board activation precedes capture completion',
  );
  assert.equal(board._chessTurnColor, 0, 'Chess Board flips from White to Black');
  assert.ok(!ctx.events.some((event) => event.meta?.noop), 'Capture path has no simulator noop marker');
}

// With no capture, Chess Board moves one legal piece and does not fabricate an
// activation event; the next turn is still Black as in the source.
{
  const ctx = context([
    { id: 'chess_board', key: 'board', x: 0, y: 0, r: 0 },
    { id: 'white_pawn', key: 'white', x: 5, y: 5, r: 0 },
  ], 7);
  const board = boardAndPieces(ctx);
  const before = ctx.graph.pieces.get('white').cells[0];
  assert.equal(handler.onCooldownEffect(board, ctx), true);
  const after = ctx.graph.pieces.get('white').cells[0];
  assert.notEqual(after, before, 'Chess Board moves a legal White piece');
  assert.ok(ctx.events.some((event) => event.meta?.event === 'piece_moved'));
  assert.equal(ctx.events.filter((event) => event.type === 'activate' && event.itemId === 'chess_board').length, 0);
  assert.equal(board._chessTurnColor, 0, 'Chess Board flips after a move');
}

// Chess Master selects the highest-price legal capture and the line-blocking
// penalty remains in effect for non-knights.
{
  const seedCtx = context([
    { id: 'chess_board', key: 'board', x: 0, y: 0, r: 0 },
    { id: 'chess_master', key: 'master', x: 2, y: 0, r: 0 },
    { id: 'white_rook', key: 'rook', x: 10, y: 10, r: 0 },
  ]);
  const rookCells = buildBoardGraph(seedCtx.graph ? [
    { id: 'white_rook', key: 'rook', x: 10, y: 10, r: 0 },
  ] : [], itemsById).pieces.get('rook').affectCells.map((mark) => mark.cell);
  assert.ok(rookCells.length >= 2, 'Rook exposes multiple source capture cells');
  const [cheapCell, expensiveCell] = rookCells;
  const parse = (cell) => cell.split(',').map(Number);
  const [cheapX, cheapY] = parse(cheapCell);
  const [expensiveX, expensiveY] = parse(expensiveCell);
  const ctx = context([
    { id: 'chess_board', key: 'board', x: 0, y: 0, r: 0 },
    { id: 'chess_master', key: 'master', x: 2, y: 0, r: 0 },
    { id: 'white_rook', key: 'rook', x: 10, y: 10, r: 0 },
    { id: 'black_pawn', key: 'cheap', x: cheapX, y: cheapY, r: 0 },
    { id: 'black_queen', key: 'expensive', x: expensiveX, y: expensiveY, r: 0 },
  ]);
  const board = boardAndPieces(ctx);
  assert.equal(handler.onCooldownEffect(board, ctx), true);
  assert.equal(ctx.pieces.find((piece) => piece.itemId === 'black_queen').alive, false);
  assert.equal(ctx.pieces.find((piece) => piece.itemId === 'black_pawn').alive, true);
}

console.log('OK Chess Board source/movement/capture parity smoke');
