import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/ShellTotem.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-b-heal.js', 'utf8');
const shellPort = port.slice(
  port.indexOf('export const shellTotemPort'),
  port.indexOf('/** Shelly.gd', port.indexOf('export const shellTotemPort')),
);

assert.match(source, /extends Item/);
assert.match(source, /onready var healthThreshold = getP\("healtht"\) \/ 100\.0/);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Holy\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*changeStaminaFactor\( - getP\("stamina"\) \* getNumAffectedItems\(\)\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*useStamina\(\) == Character\.StaminaResult\.Sufficient[\s\S]*giveEmpower\(1\)[\s\S]*heal\(\)[\s\S]*activate\(\)/);
assert.match(shellPort, /onPrepare\(piece, ctx\)/);
assert.match(shellPort, /getPName\(piece\.params, 'stamina', getP3\(/);
assert.match(shellPort, /getPName\(piece\.params, 'healtht', getP1\(/);
assert.match(shellPort, /getPName\(piece\.params, 'heal', getP2\(/);
assert.ok(
  shellPort.indexOf('tryUseStamina') < shellPort.indexOf('pushActivate'),
  'stamina must be spent before Shell Totem activates',
);
assert.doesNotMatch(shellPort, /onCombatStart\(piece, ctx\)/);
assert.doesNotMatch(shellPort, /Math\.max\(1, Math\.round\(piece\.staminaCost/);

const itemsById = new Map([
  ['shell_totem', { id: 'shell_totem', type: 'Weapon', extraTypes: ['Holy'] }],
  ['holy_ally', { id: 'holy_ally', type: 'Accessory', extraTypes: ['Holy'] }],
  ['plain_ally', { id: 'plain_ally', type: 'Accessory', extraTypes: [] }],
]);

function makePiece(params, placementKey = 'shell-totem') {
  return {
    itemId: 'shell_totem',
    placementKey,
    name: 'Shell Totem',
    kind: 'weapon',
    params,
    staminaCost: 2,
    baseStaminaCost: 2,
    staminaFactor: 1,
    speedScale: 0,
  };
}

function makeContext(piece, player) {
  const holy = `${piece.placementKey}-holy`;
  const plain = `${piece.placementKey}-plain`;
  return {
    t: 3.6,
    player,
    events: [],
    pieces: [
      piece,
      { itemId: 'holy_ally', placementKey: holy, name: 'Holy Ally' },
      { itemId: 'plain_ally', placementKey: plain, name: 'Plain Ally' },
    ],
    itemsById,
    graph: {
      pieces: new Map([
        [piece.placementKey, {
          key: piece.placementKey,
          id: 'shell_totem',
          cells: ['0,0'],
          affectCells: [
            { cell: '1,0', color: 'primary' },
            { cell: '2,0', color: 'primary' },
          ],
        }],
        [holy, { key: holy, id: 'holy_ally', cells: ['1,0'], affectCells: [] }],
        [plain, { key: plain, id: 'plain_ally', cells: ['2,0'], affectCells: [] }],
      ]),
      filled: new Map([
        ['1,0', holy],
        ['2,0', plain],
      ]),
    },
    canAffect: {
      rulesById: {
        shell_totem: {
          primary: { op: 'hasType', type: 'Holy' },
        },
      },
    },
  };
}

const handler = getScriptHandler('shell_totem');
assert.equal(handler?.handlerId, 'shell_totem');

const highPlayer = createActor('player');
highPlayer.hp = 180;
highPlayer.stamina = 5;
const highPiece = makePiece(
  { healtht: 70, p1: 10, heal: 8, p2: 3, stamina: 15, p3: 9 },
  'shell-high',
);
const highCtx = makeContext(highPiece, highPlayer);
handler.onPrepare(highPiece, highCtx);
assert.equal(highPiece.staminaFactor, 0.85, 'one affected Holy item reduces stamina cost by the named 15%');
handler.onCooldownEffect(highPiece, highCtx);
assert.equal(highPlayer.stamina, 3.3, 'the exact effective stamina cost is spent');
assert.equal(highPlayer.stacks.empower, 1, 'health above the named threshold grants Empower');
assert.equal(highPlayer.hp, 180, 'the healthy branch does not heal');
assert.equal(highCtx.events.at(-1)?.type, 'activate', 'activation follows the successful effect');

const lowPlayer = createActor('player');
lowPlayer.hp = 100;
lowPlayer.stamina = 5;
const lowPiece = makePiece(
  { healtht: 70, p1: 10, heal: 8, p2: 3, stamina: 15, p3: 9 },
  'shell-low',
);
const lowCtx = makeContext(lowPiece, lowPlayer);
handler.onPrepare(lowPiece, lowCtx);
handler.onCooldownEffect(lowPiece, lowCtx);
assert.equal(lowPlayer.stamina, 3.3);
assert.equal(lowPlayer.stacks.empower, 0, 'the low-health branch does not grant Empower');
assert.equal(lowPlayer.hp, 108, 'the low-health branch uses the named heal amount');
assert.equal(lowCtx.events.at(-1)?.type, 'activate');

const fallbackPlayer = createActor('player');
fallbackPlayer.hp = 100;
fallbackPlayer.stamina = 5;
const fallbackPiece = makePiece({ p1: 50, p2: 6, p3: 20 }, 'shell-fallback');
const fallbackCtx = makeContext(fallbackPiece, fallbackPlayer);
handler.onPrepare(fallbackPiece, fallbackCtx);
handler.onCooldownEffect(fallbackPiece, fallbackCtx);
assert.equal(fallbackPiece.staminaFactor, 0.8, 'indexed stamina fallback uses p3');
assert.equal(fallbackPlayer.stamina, 3.4);
assert.equal(fallbackPlayer.hp, 106, 'indexed health and heal fallbacks use p1 and p2');

const starvedPlayer = createActor('player');
starvedPlayer.hp = 100;
starvedPlayer.stamina = 1;
const starvedPiece = makePiece(
  { healtht: 70, heal: 8, stamina: 15, p3: 9 },
  'shell-starved',
);
const starvedCtx = makeContext(starvedPiece, starvedPlayer);
handler.onPrepare(starvedPiece, starvedCtx);
handler.onCooldownEffect(starvedPiece, starvedCtx);
assert.equal(starvedPlayer.hp, 100, 'insufficient stamina skips the effect');
assert.equal(starvedPlayer.stacks.empower, 0);
assert.equal(starvedCtx.events.some((event) => event.type === 'activate'), false, 'insufficient stamina does not activate');

console.log('OK Shell Totem source and handler regression');
