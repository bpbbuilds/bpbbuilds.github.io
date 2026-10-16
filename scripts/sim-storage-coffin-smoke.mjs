import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getStackAmount } from '../js/pages/sim/engine/stacks.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/StorageCoffin.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ak-bags.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('export const storageCoffinPort'),
  handlerSource.indexOf('/**\n * EngineerBox.gd', handlerSource.indexOf('export const storageCoffinPort')),
);

assert.equal(inventory.byId.storage_coffin?.file, 'StorageCoffin.gd');
assert.equal(inventory.byId.storage_coffin?.extends, 'Bag');
assert.deepEqual(inventory.byId.storage_coffin?.overrides, ['onPrepare']);
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(item, "activated", "onItemActivated"\)/);
assert.match(source, /func onItemActivated\(event\):[\s\S]*rollChance\(\)[\s\S]*inflictPoison\(1\)[\s\S]*activate\(\)/);
assert.match(source, /func canApplyEffect\(toItem\):[\s\S]*toItem\.canActivate\(\)[\s\S]*not toItem\.isBag\(\)/);
assert.match(portBlock, /onPrepare\(piece, ctx\)/);
assert.match(portBlock, /piece_activated/);
assert.match(portBlock, /rollItemChance/);
assert.match(portBlock, /isBagLike/);
assert.doesNotMatch(portBlock, /piece_dealt_damage/);

function buildContext(rng) {
  const coffin = {
    ...byId.get('storage_coffin'),
    itemId: 'storage_coffin',
    placementKey: 'coffin',
    name: 'Storage Coffin',
    kind: 'bag',
    chance: 22,
  };
  const sword = {
    ...byId.get('wooden_sword'),
    itemId: 'wooden_sword',
    placementKey: 'sword',
    name: 'Wooden Sword',
    canActivate: true,
  };
  const nestedBag = {
    ...byId.get('fanny_pack'),
    itemId: 'fanny_pack',
    placementKey: 'nested_bag',
    name: 'Nested Bag',
    canActivate: true,
  };
  const disabled = {
    ...byId.get('wooden_sword'),
    itemId: 'wooden_sword',
    placementKey: 'disabled',
    name: 'Disabled Sword',
    canActivate: false,
  };
  const outside = {
    ...byId.get('wooden_sword'),
    itemId: 'wooden_sword',
    placementKey: 'outside',
    name: 'Outside Sword',
    canActivate: true,
  };
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    coffin,
    sword,
    nestedBag,
    disabled,
    outside,
    player,
    dummy,
    bus,
    ctx: {
      player,
      dummy,
      pieces: [coffin, sword, nestedBag, disabled, outside],
      itemsById: byId,
      graph: {
        pieces: new Map([
          ['coffin', { key: 'coffin', id: 'storage_coffin', cells: ['0,0'], affectCells: [] }],
          ['sword', { key: 'sword', id: 'wooden_sword', cells: ['0,0'], affectCells: [] }],
          ['nested_bag', { key: 'nested_bag', id: 'fanny_pack', cells: ['0,0'], affectCells: [] }],
          ['disabled', { key: 'disabled', id: 'wooden_sword', cells: ['0,0'], affectCells: [] }],
          ['outside', { key: 'outside', id: 'wooden_sword', cells: ['1,0'], affectCells: [] }],
        ]),
        filled: new Map([
          ['0,0', 'sword'],
          ['1,0', 'outside'],
        ]),
      },
      events: [],
      bus,
      rng,
      t: 2,
    },
  };
}

const handler = getScriptHandler('storage_coffin');
assert.equal(handler?.handlerId, 'storage_coffin');

const pass = buildContext(() => 0);
handler.onPrepare(pass.coffin, pass.ctx);
handler.onCombatStart(pass.coffin, pass.ctx);
pass.bus.emit('piece_activated', { piece: pass.sword, t: 3 });
assert.equal(getStackAmount(pass.dummy, 'poison'), 1, 'an eligible inside activation inflicts one Poison');
assert.ok(pass.ctx.events.some((event) =>
  event.meta?.handler === 'storage_coffin' && event.target === 'dummy' && event.amount === 1,
));

pass.bus.emit('piece_activated', { piece: pass.nestedBag, t: 3.1 });
pass.bus.emit('piece_activated', { piece: pass.disabled, t: 3.2 });
pass.bus.emit('piece_activated', { piece: pass.outside, t: 3.3 });
assert.equal(getStackAmount(pass.dummy, 'poison'), 1, 'bags, canActivate=false items, and outside items are excluded');

const fail = buildContext(() => 0.99);
handler.onPrepare(fail.coffin, fail.ctx);
fail.bus.emit('piece_activated', { piece: fail.sword, t: 3 });
assert.equal(getStackAmount(fail.dummy, 'poison'), 0, 'the source chance gate is respected');

console.log('OK Storage Coffin source preparation, eligible inside activation filtering, chance-gated Poison, and target/log projection regression');
