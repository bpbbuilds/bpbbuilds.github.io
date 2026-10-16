import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/VampiricArmor.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-threshold.js', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));

assert.equal(inventory.byId.vampiric_armor?.file, 'VampiricArmor.gd');
assert.deepEqual(inventory.byId.vampiric_armor?.overrides, ['doCooldownEffect', 'onCombatStart']);
assert.match(source, /func onCombatStart\(\):[\s\S]*healthToBlock\(getP1\(\), getBlock\(\)\)[\s\S]*giveVampirism\(getP2\(\)\)[\s\S]*activate\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*healthToBlock\(getP3\(\), getP4\(\)\)[\s\S]*activate\(\)/);
assert.match(portSource, /handlerId: 'vampiric_armor'/);
assert.match(portSource, /const healthCap = getP1\(piece\.params, 0\)/);
assert.match(portSource, /const vamp = getP2\(piece\.params, 0\)/);
assert.match(portSource, /const healthCap = getP3\(piece\.params, 0\)/);
assert.match(portSource, /const blockCap = getP4\(piece\.params, 0\)/);

const handler = getScriptHandler('vampiric_armor');
assert.equal(handler?.handlerId, 'vampiric_armor');
const armorCatalog = byId.get('vampiric_armor');
assert.ok(armorCatalog);

function makePiece(side = 'you', key = 'armor') {
  return {
    ...armorCatalog,
    itemId: 'vampiric_armor',
    placementKey: key,
    name: 'Vampiric Armor',
    kind: 'armor',
    side,
    alive: true,
    blockGrant: 100,
    params: {
      healtht: 1, p1: 50,
      vampirism: 1, p2: 5,
      p3: 10, p4: 20,
    },
  };
}

const player = createActor('player', { maxHp: 100 });
const dummy = createActor('dummy', { maxHp: 100 });
const events = [];
const piece = makePiece();
const ctx = { t: 2.5, player, dummy, events, itemsById: new Map([['vampiric_armor', armorCatalog]]) };

handler.onCombatStart(piece, ctx);
assert.equal(player.hp, 50, 'combat-start p1 health conversion leaves the source health amount');
assert.equal(player.block, 100, 'combat-start uses the item Block value');
assert.equal(player.stacks.vampirism, 5, 'combat-start uses p2 Vampirism');
assert.equal(events.at(-1)?.type, 'activate', 'combat-start activation follows both source effects');

player.hp = 100;
player.block = 0;
events.length = 0;
assert.equal(handler.onCooldownEffect(piece, ctx), true);
assert.equal(player.hp, 90, 'cooldown p3 health conversion spends the source amount');
assert.equal(player.block, 20, 'cooldown p4 controls the converted Block');
assert.equal(events.at(-1)?.type, 'activate', 'cooldown activation follows health-to-Block');

const zeroPlayer = createActor('player', { maxHp: 100 });
const zero = { ...makePiece(), placementKey: 'zero', params: { p1: 0, p2: 0, p3: 0, p4: 0 } };
const zeroEvents = [];
handler.onCombatStart(zero, { ...ctx, player: zeroPlayer, events: zeroEvents });
assert.equal(zeroPlayer.hp, 100, 'zero p1 does not spend health');
assert.equal(zeroPlayer.block, 0, 'zero p1/piece Block produces no Block');
assert.equal(zeroPlayer.stacks.vampirism, 0, 'zero p2 produces no Vampirism');
assert.equal(zeroEvents.at(-1)?.type, 'activate');

const opponent = createActor('dummy', { maxHp: 100 });
const opponentEvents = [];
handler.onCombatStart(makePiece('them', 'opponent-armor'), {
  ...ctx,
  player: opponent,
  dummy: player,
  events: opponentEvents,
});
assert.equal(opponentEvents.at(-1)?.actor, 'dummy', 'opponent armor activation projects to the opponent side');
assert.equal(opponentEvents.find((event) => event.type === 'buff')?.target, 'dummy');

console.log('OK Vampiric Armor source p1-p4 conversions, Block/Vampirism effects, activation order, opponent-side projection, and zero-safe regression');
