import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };

const source = fs.readFileSync('tools/game-extract-full/Items/LuckyBow.gd', 'utf8');
const portFile = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-onhit.js', 'utf8');
const luckyBowPort = portFile.slice(
  portFile.indexOf('const luckyBowPort'),
  portFile.indexOf('/** PoisonDagger.gd', portFile.indexOf('const luckyBowPort')),
);

assert.equal(inventory.byId.lucky_bow?.file, 'LuckyBow.gd');
assert.match(source, /func onPrepare\(\):[\s\S]*setState\(false\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveLucky\(getP1\(\)\)[\s\S]*activate\(null, false\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*useStamina\(\)[\s\S]*dealDamage\(\)[\s\S]*if extraAttack:[\s\S]*dealDamage\(res\.event\)[\s\S]*setState\(false/);
assert.match(source, /func onWeaponAttacked\(damageRes: DamageResult\):[\s\S]*wasCriticalHit\(\)[\s\S]*setState\(true/);
assert.match(luckyBowPort, /onPrepare\(piece, ctx\)/);
assert.match(luckyBowPort, /Math\.trunc\(getPName\(piece\.params, 'luck'/);
assert.match(luckyBowPort, /piece\._luckyExtra = false/);

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const [piece] = buildCombatPieces([{ id: 'lucky_bow', key: 'bow', x: 0, y: 0, r: 0 }], byId);
piece.side = 'you';
const player = createActor('player');
const dummy = createActor('dummy');
const bus = createCombatBus();
player._combatBus = bus;
dummy._combatBus = bus;
const ctx = {
  t: 1,
  player,
  dummy,
  events: [],
  rng: () => 0,
  bus,
  pieces: [piece],
  itemsById: byId,
  graph: {
    pieces: new Map([['bow', { key: 'bow', id: 'lucky_bow', cells: ['0,0'], affectCells: [] }]]),
    filled: new Map(),
  },
};
const handler = getScriptHandler('lucky_bow');
assert.equal(handler?.handlerId, 'lucky_bow');
handler.onPrepare(piece, ctx);
assert.equal(piece._luckyExtra, false, 'onPrepare clears the extra-attack state');

piece.params = { luck: 2.9, p1: 2.9 };
handler.onCombatStart(piece, ctx);
assert.equal(player.stacks.lucky, 2, 'giveLucky(getP1()) uses source integer semantics');
assert.equal(ctx.events.filter((event) => event.type === 'activate').length, 1, 'combat start activates once');

piece._luckyExtra = true;
ctx.t = 2;
const before = ctx.events.length;
handler.onCooldownEffect(piece, ctx);
const activationEvents = ctx.events.slice(before).filter((event) => event.type === 'activate');
assert.equal(activationEvents.length, 2, 'a primed Lucky Bow performs and activates both strikes');
assert.equal(piece._luckyExtra, false, 'the extra-attack state clears after the second strike');

const zeroPlayer = createActor('player');
const zeroDummy = createActor('dummy');
const zeroCtx = { ...ctx, player: zeroPlayer, dummy: zeroDummy, events: [], t: 0 };
const zeroPiece = { ...piece, placementKey: 'zero-bow', params: { luck: 0, p1: 0 }, _luckyExtra: false };
handler.onCombatStart(zeroPiece, zeroCtx);
assert.equal(zeroPlayer.stacks.lucky, 0, 'explicit zero Lucky remains zero');
assert.equal(zeroCtx.events.filter((event) => event.type === 'activate').length, 1, 'zero Lucky still preserves source activation');

console.log('OK Lucky Bow source-backed prepare reset, exact Lucky grant, two-strike activation, post-second-strike reset, and zero parameters regression');
