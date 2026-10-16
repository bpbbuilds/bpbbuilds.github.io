import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Shovel.gd', 'utf8');
const weaponSource = fs.readFileSync('tools/game-extract-full/Items/Weapon.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-onhit.js', 'utf8');
const shovelPort = port.slice(
  port.indexOf('const shovelPort'),
  port.indexOf('/** LuckyBow.gd', port.indexOf('const shovelPort')),
);

assert.equal(inventory.byId.shovel?.file, 'Shovel.gd');
assert.match(source, /extends Weapon/);
assert.match(source, /func onShopEntered\(\):[\s\S]*generateAndStorageItem/);
assert.match(
  source,
  /func onDealtDamage\(damageRes\):[\s\S]*damageRes\.hasHit\(\)[\s\S]*rollChance\(\)[\s\S]*inflictBlind\(1, damageRes\.event\)/,
);
assert.match(weaponSource, /func doCooldownEffect\(\):[\s\S]*useStamina\(\)[\s\S]*attack\(\)/);
assert.match(shovelPort, /handlerId: 'shovel'/);
assert.match(shovelPort, /weaponStrike\(piece, ctx, 'shovel'\)/);
assert.match(shovelPort, /onDealtDamage\(piece, ctx, hit\)/);
assert.match(shovelPort, /rollItemChance\(piece, ctx\.rng\)/);
assert.match(shovelPort, /grantStacks\(ctx\.dummy, 'blind', 1/);
assert.doesNotMatch(shovelPort, /onShopEntered/);

function makePiece(chance = 100) {
  return {
    itemId: 'shovel',
    placementKey: 'shovel',
    name: 'Shovel',
    kind: 'weapon',
    damageKind: 'melee',
    damageMin: 5,
    damageMax: 5,
    accuracy: 100,
    staminaCost: 1.7,
    cooldown: 2.4,
    baseCooldown: 2.4,
    chance,
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
  dummy._eventLog = events;
  dummy._simT = 3;
  const piece = makePiece();
  const ctx = { t: 3, player, dummy, events, rng: () => 0 };
  const handler = getScriptHandler('shovel');

  assert.equal(handler?.handlerId, 'shovel');
  assert.equal(handler.onCooldownEffect(piece, ctx), true);
  assert.ok(
    Math.abs(player.stamina - 0.3) < 1e-12,
    'Shovel uses the inherited Weapon stamina cost',
  );
  assert.equal(dummy.hp, 1195, 'Shovel performs the inherited melee strike');
  handler.onDealtDamage(piece, ctx, { hit: true });
  assert.equal(dummy.stacks.blind, 1, 'a successful chance proc inflicts one Blind');
}

{
  const player = createActor('player');
  const dummy = createActor('dummy');
  const piece = makePiece(0);
  const ctx = { t: 4, player, dummy, events: [], rng: () => 0 };
  getScriptHandler('shovel').onDealtDamage(piece, ctx, { hit: true });
  getScriptHandler('shovel').onDealtDamage(makePiece(100), ctx, { hit: false });
  assert.equal(dummy.stacks.blind, 0, 'misses and zero chance do not inflict Blind');
}

console.log('OK Shovel source and combat handler regression');
