import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');
const extract = path.join(root, 'tools/game-extract-full');
const noops = JSON.parse(readFileSync(path.join(root, 'assets/data/sim-intentional-noops.json'), 'utf8'));
const shopRows = [...noops.shopNoCombat, ...noops.wearablesShopOnly];
assert.equal(shopRows.length, 14);
for (const row of shopRows) {
  if (!row.gd) continue;
  const file = path.join(extract, row.gd);
  assert.ok(existsSync(file), `${row.id}: source exists`);
  const source = readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /^func (doCooldownEffect|onCombatStart)\s*\(/m, `${row.id}: no independent combat hook`);
  assert.ok(row.why?.length > 10, `${row.id}: reason recorded`);
}
for (const id of ['coins', 'amulet_unidentified', 'unidentified_skill', 'leather_bag', 'engineer_bag_2', 'random_loadout_bag']) {
  const row = shopRows.find((item) => item.id === id);
  assert.ok(row?.why?.length > 10, `${id}: catalog-only reason recorded`);
}

const chessIds = noops.chessPieces;
assert.equal(chessIds.length, 12);
for (const id of chessIds) {
  const stem = id.replace(/(^|_)([a-z])/g, (_, _sep, c) => c.toUpperCase());
  const color = stem.startsWith('Black') ? 'Black' : 'White';
  const piece = stem.replace(/^(Black|White)/, '');
  const file = path.join(extract, 'Items', 'Exclusive', 'Chess', `${color}${piece}.gd`);
  const source = readFileSync(file, 'utf8');
  assert.match(source, /^extends ChessPiece\s*$/m, `${id}: ChessPiece inheritance`);
  assert.doesNotMatch(source, /^func doCooldownEffect\s*\(/m, `${id}: no independent cooldown`);
  assert.match(source, /^func do(Capturing|Eliminated)Effect\s*\(/m, `${id}: board-owned effect`);
}

const board = readFileSync(path.join(extract, 'Items/Exclusive/ChessBoard.gd'), 'utf8');
assert.match(board, /^func doCooldownEffect\s*\(/m, 'Chess Board owns the combat turn');
assert.equal(noops.chessBoard.sim, 'unsupported_mode');
console.log('26 no-combat source rows audited: shop/wearable sources and ChessPiece inheritance/effects verified.');
