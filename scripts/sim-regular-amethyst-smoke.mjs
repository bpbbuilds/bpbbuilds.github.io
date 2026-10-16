import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const source = inventory.byId.regular_amethyst;
assert.equal(source.file, 'Gems/Amethyst.gd');
assert.equal(source.sceneFile, 'Gems/RegularAmethyst.tscn');
assert.equal(source.extends, 'Gem');

const handler = getScriptHandler('regular_amethyst');
assert.equal(typeof handler?.onCooldownEffect, 'function', 'Regular Amethyst retains the loose-gem cooldown hook');
const looseOwner = createActor('player');
looseOwner.stacks.cold = 1;
const loose = { itemId: 'regular_amethyst', placementKey: 'loose', name: 'Regular Amethyst', params: byId.get('regular_amethyst').params, alive: true };
handler.onCooldownEffect(loose, { player: looseOwner, dummy: createActor('dummy'), events: [], t: 5, rng: () => 0 });
assert.equal(looseOwner.stacks.cold, 0, 'Loose Regular Amethyst cleanses one random debuff');
assert.equal(loose.alive, true, 'Loose Regular Amethyst repeats instead of consuming');

for (const side of ['you', 'them']) {
  const [weapon] = buildCombatPieces([{ id: 'wooden_sword', key: `${side}:weapon`, x: 0, y: 0, r: 0, side, gems: ['regular_amethyst'] }], byId);
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const opponent = createActor(side === 'you' ? 'dummy' : 'player');
  opponent.stacks.lucky = 1;
  const weaponBus = createCombatBus();
  prepareGemSockets(weapon, { player: owner, dummy: opponent, bus: weaponBus, itemsById: byId, t: 0, rng: () => 0 });
  weaponBus.emit('piece_dealt_damage', { piece: weapon, hit: { hit: true, damage: 4 } });
  assert.equal(opponent.stacks.lucky, 0, `Regular Amethyst removes its source buff count on a weapon hit for ${side}`);

  const [armor] = buildCombatPieces([{ id: 'leather_armor', key: `${side}:armor`, x: 0, y: 0, r: 0, side, gems: ['regular_amethyst'] }], byId);
  const armorOwner = createActor(side === 'you' ? 'player' : 'dummy');
  const armorOpponent = createActor(side === 'you' ? 'dummy' : 'player');
  prepareGemSockets(armor, { player: armorOwner, dummy: armorOpponent, bus: createCombatBus(), itemsById: byId, t: 0, rng: () => 0 });
  assert.equal(armorOpponent._healAmp, -0.25, `Regular Amethyst applies its 25% armor healing reduction for ${side}`);
}

console.log('OK Regular Amethyst focused smoke');
