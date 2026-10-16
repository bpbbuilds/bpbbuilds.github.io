import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Broom.gd', 'utf8');
assert.match(source, /func onPrepare\(\)/);
assert.match(source, /connectForCombat\(character\(\), "character_attacked"/);
assert.match(source, /if not damageRes\.hasHit\(\)/);
assert.match(source, /reduceBonusDamage\(broomBonusDam, false\)/);

const handler = getScriptHandler('broom');
assert.equal(handler?.handlerId, 'broom');
assert.equal(typeof handler?.onPrepare, 'function');

const player = createActor('player');
const dummy = createActor('dummy');
const bus = createCombatBus();
const piece = {
  itemId: 'broom',
  name: 'Broom',
  placementKey: 'broom',
  side: 'you',
  kind: 'weapon',
  params: { p1: 2 },
  chance: 100,
  damageMin: 2,
  damageMax: 2,
  accuracy: 100,
  staminaCost: 1,
  baseStaminaCost: 1,
  alive: true,
  bonusDamage: 0,
};
const events = [];
const ctx = { player, dummy, bus, events, rng: () => 0, t: 2 };

handler.onPrepare(piece, ctx);
bus.emit('player_damaged', { actor: player, hit: false, t: 2 });
assert.equal(piece._broomBonus, 2, 'enemy miss arms source bonus damage');
assert.equal(piece.bonusDamage, 2, 'enemy miss adds source bonus damage');

handler.onCooldownEffect(piece, ctx);
assert.equal(piece._broomBonus, 0, 'attack clears the temporary broom bonus');
assert.equal(piece.bonusDamage, 0, 'attack removes the temporary broom bonus');
assert.equal(dummy.stacks.blind, 1, 'hit applies the source blind chance');
assert.equal(events.find((event) => event.type === 'debuff')?.actor, 'player');

console.log('OK Broom focused smoke');
