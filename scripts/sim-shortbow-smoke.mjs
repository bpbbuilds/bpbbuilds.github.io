import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Weapon.gd', 'utf8');
const scene = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Shortbow.tscn', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-al-weapons.js', 'utf8');
const shortbowPort = port.slice(
  port.indexOf('export const shortbowPort'),
  port.indexOf('/** Bow.gd', port.indexOf('export const shortbowPort')),
);

assert.equal(inventory.byId.shortbow?.file, 'Weapon.gd');
assert.equal(inventory.byId.shortbow?.sceneFile, 'Exclusive/Shortbow.tscn');
assert.match(scene, /res:\/\/Items\/Weapon\.gd/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*useStamina\(\)[\s\S]*attack\(\)/);
assert.match(shortbowPort, /handlerId: 'shortbow'/);
assert.match(shortbowPort, /weaponStrike\(piece, ctx, 'shortbow'\)/);
assert.doesNotMatch(shortbowPort, /onDealtDamage|onPreDealDamageEarly/);

function makePiece() {
  return {
    itemId: 'shortbow',
    placementKey: 'shortbow',
    name: 'Shortbow',
    kind: 'weapon',
    damageKind: 'ranged',
    damageMin: 7,
    damageMax: 7,
    accuracy: 100,
    staminaCost: 1,
    cooldown: 1.5,
    baseCooldown: 1.5,
    alive: true,
  };
}

{
  const player = createActor('player');
  const dummy = createActor('dummy');
  player.stamina = 2;
  const events = [];
  player._eventLog = events;
  player._simT = 3;
  const handled = getScriptHandler('shortbow').onCooldownEffect(makePiece(), {
    t: 3,
    player,
    dummy,
    events,
    rng: () => 0,
  });
  assert.equal(handled, true, 'Shortbow fires when stamina is sufficient');
  assert.equal(player.stamina, 1);
  assert.equal(dummy.hp, 1193, 'Shortbow uses the inherited ranged weapon strike');
  assert.equal(events.at(-1)?.type, 'activate');
  assert.equal(events.at(-1)?.itemId, 'shortbow');
}

{
  const player = createActor('player');
  const dummy = createActor('dummy');
  player.stamina = 0.5;
  const events = [];
  player._eventLog = events;
  player._simT = 4;
  const handled = getScriptHandler('shortbow').onCooldownEffect(makePiece(), {
    t: 4,
    player,
    dummy,
    events,
    rng: () => 0,
  });
  assert.equal(handled, false, 'Shortbow does not attack when stamina is insufficient');
  assert.equal(dummy.hp, 1200);
  assert.equal(events.some((event) => event.type === 'activate'), false);
  assert.equal(events.find((event) => event.meta?.starved)?.meta?.handler, 'shortbow');
}

console.log('OK Shortbow source and inherited Weapon regression');
