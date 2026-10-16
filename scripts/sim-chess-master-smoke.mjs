import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const itemsById = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/ChessMaster.gd', 'utf8');

assert.match(source, /func\s+onPrepare\(\):[\s\S]*?getAllInInventoryOfType\(ItemBook\.chessboardDescriptor\)[\s\S]*?chessboards\[0\]\.addSpeed\(speed\)/);
assert.match(source, /onready var speed: = getP\("speed"\) \/ 100\.0/);

const handler = getScriptHandler('chess_master');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(handler?.onCombatStart, undefined, 'Chess Master should not defer its source preparation effect');

const placements = [
  { id: 'chess_master', key: 'master', x: 0, y: 0, r: 0 },
  { id: 'chess_board', key: 'first-board', x: 1, y: 0, r: 0 },
  { id: 'chess_board', key: 'second-board', x: 2, y: 0, r: 0 },
];
const pieces = buildCombatPieces(placements, itemsById);
const master = pieces.find((piece) => piece.itemId === 'chess_master');
const boards = pieces.filter((piece) => piece.itemId === 'chess_board');
assert.ok(master && boards.length === 2, 'Chess Master fixture should include two Chess Boards');

handler.onPrepare(master, { pieces, itemsById, events: [], t: 0 });
assert.equal(boards[0].speedScale, 0.4, 'Chess Master should speed the first inventory Chess Board');
assert.equal(boards[1].speedScale, 0, 'Chess Master should affect only the first Chess Board');

console.log('Chess Master simulator parity smoke passed.');
