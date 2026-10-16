import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const item = catalog.find((row) => row.id === 'prismatic_wand');
const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/PrismaticWand.gd',
  'utf8',
);

assert.equal(inventory.byId.prismatic_wand?.file, 'Exclusive/PrismaticWand.gd');
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveAllBuffs\(\)[\s\S]*character\(\)\.getMana\(\)[\s\S]*removeMostBuffs\(buffsToUse, null, true, buffs\)[\s\S]*giveEmpower\(empower, event\)[\s\S]*activate\(\)/);
assert.match(source, /onready var manaNeeded: = int\(getP\("manat"\)\)/);
assert.match(source, /onready var luckNeeded: = int\(getP\("luckt"\)\)/);
assert.match(source, /onready var regenNeeded: = int\(getP\("regent"\)\)/);
assert.match(source, /onready var empower: = int\(getP\("empower"\)\)/);
assert.match(source, /onready var buffsToUse: = int\(getP\("use"\)\)/);

const piece = {
  ...item,
  itemId: 'prismatic_wand',
  placementKey: 'wand',
  name: 'Prismatic Wand',
  params: item.params,
  kind: 'accessory',
  side: 'you',
};
const player = createActor('player');
player.stacks.mana = 20;
const events = [];
const ctx = { player, events, t: 6, rng: () => 0 };
const handler = getScriptHandler('prismatic_wand');

assert.equal(handler?.handlerId, 'prismatic_wand');
handler.onCooldownEffect(piece, ctx);
assert.equal(player.stacks.mana, 16, 'eligible Mana threshold removes the source use amount');
assert.equal(player.stacks.lucky, 1);
assert.equal(player.stacks.regeneration, 1);
assert.equal(player.stacks.empower, 6, 'all-buffs grant plus source Empower amount');
assert.equal(events.at(-1)?.type, 'activate', 'activation follows all source effects');
assert.equal(events.at(-1)?.itemId, 'prismatic_wand');

const zeroPiece = {
  ...piece,
  placementKey: 'zero-wand',
  params: { manat: 0, luckt: 0, regent: 0, empower: 0, use: 0 },
};
const zeroPlayer = createActor('player');
const zeroEvents = [];
handler.onCooldownEffect(zeroPiece, { ...ctx, player: zeroPlayer, events: zeroEvents });
assert.equal(zeroPlayer.stacks.empower, 1, 'zero Empower does not force an extra stack');
assert.equal(zeroEvents.at(-1)?.type, 'activate');

console.log('OK Prismatic Wand source and handler regression');
