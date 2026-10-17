import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/WingedBoots.gd', 'utf8');
const inventory = JSON.parse(fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8'));
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'winged_boots');
const handler = getScriptHandler('winged_boots');

assert.ok(sourceItem, 'Winged Boots catalog row exists');
assert.equal(inventory.byId.winged_boots?.file, 'Exclusive/WingedBoots.gd');
assert.deepEqual(inventory.byId.winged_boots?.overrides, ['onPrepare']);
assert.match(source, /healthThreshold = getP\("healtht"\) \/ 100\.0 - 0\.0001/);
assert.match(source, /connectForCombat\(character\(\), "character_damaged", "onDamaged"\)/);
assert.match(source, /giveEmpower\(empower, event\)[\s\S]*cleanseRandomDebuffs\(debuffs\)[\s\S]*changeDodgeStacks\(dodges\)[\s\S]*consume\(\)/);
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(handler?.onCombatStart, undefined, 'Winged Boots only connects during source prepare');

function run(params = sourceItem.params) {
  const player = createActor('player', { maxHp: 100, maxStamina: 10 });
  const dummy = createActor('dummy', { maxHp: 100 });
  player.hp = 70;
  player.stacks.poison = 2;
  player.stacks.blind = 1;
  player.stacks.cold = 1;
  const piece = {
    itemId: 'winged_boots',
    placementKey: 'you:winged',
    side: 'you',
    kind: 'passive',
    name: 'Winged Boots',
    alive: true,
    params,
  };
  const events = [];
  const bus = createCombatBus();
  const ctx = {
    t: 4,
    player,
    dummy,
    events,
    bus,
    rng: () => 0,
  };
  handler.onPrepare(piece, ctx);
  return { player, piece, events, bus, ctx };
}

// The source epsilon makes exactly 70% health safe, while the first damage
// that leaves the actor below it consumes the boots once.
{
  const fixture = run();
  fixture.bus.emit('character_damaged', { actor: fixture.player, hit: true });
  assert.equal(fixture.piece.alive, true, 'Winged Boots does not trigger at exact threshold');
  fixture.player.hp = 69;
  fixture.bus.emit('character_damaged', { actor: fixture.player, hit: true });
  assert.equal(fixture.player.stacks.empower, 1, 'Winged Boots grants source Empower');
  assert.equal(fixture.player.dodgeStacks, 3, 'Winged Boots grants source Dodge stacks');
  assert.equal(fixture.player.stacks.poison, 0, 'Winged Boots cleanses source debuffs');
  assert.equal(fixture.player.stacks.blind, 0, 'Winged Boots cleanses multiple debuff types');
  assert.equal(fixture.piece.alive, false, 'Winged Boots consumes after triggering');
  assert.equal(fixture.events.filter((event) => event.type === 'activate').length, 1);
  assert.equal(fixture.events.find((event) => event.type === 'activate').meta.consume, true);
  fixture.bus.emit('character_damaged', { actor: fixture.player, hit: true });
  assert.equal(fixture.events.filter((event) => event.type === 'activate').length, 1, 'Winged Boots is once-only');
}

// int(getP()) and changeDodgeStacks preserve explicit zero values rather than
// inventing a minimum grant.
{
  const fixture = run({ healtht: 70, empower: 0, cleanse: 0, dodge: 0 });
  fixture.player.hp = 69;
  fixture.bus.emit('character_damaged', { actor: fixture.player, hit: true });
  assert.equal(fixture.player.stacks.empower, 0);
  assert.equal(fixture.player.dodgeStacks, 0);
  assert.equal(fixture.player.stacks.poison, 2);
  assert.equal(fixture.piece.alive, false);
}

console.log('OK Winged Boots source/threshold/consume parity smoke');
