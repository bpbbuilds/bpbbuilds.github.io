import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { BUFF_KEYS } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/RainbowBadge.gd',
  'utf8',
);
const port = fs.readFileSync(
  'js/pages/sim/engine/scripts/ports-outliers.js',
  'utf8',
);
const rainbowPort = port.slice(
  port.indexOf('export const rainbowBadgePort'),
  port.indexOf('export const recombobulatorPort', port.indexOf('export const rainbowBadgePort')),
);

assert.equal(inventory.byId.rainbow_badge?.file, 'Exclusive/RainbowBadge.gd');
assert.match(source, /func doCooldownEffect\(\):[\s\S]*for buff in Game\.getBuffs\(\):[\s\S]*giveStacks\(character\(\), buff, 1\)[\s\S]*onAfterEffectFinished\(\)/);
assert.match(rainbowPort, /giveAllBuffs\(player, 1/);
assert.match(rainbowPort, /afterEffectFinished\(piece, ctx, 'rainbow_badge'\);/);
assert.doesNotMatch(rainbowPort, /pushActivate\(piece/);

const badgeData = byId.get('rainbow_badge');
assert.ok(badgeData, 'Rainbow Badge catalog item exists');
const badge = {
  ...badgeData,
  itemId: 'rainbow_badge',
  placementKey: 'badge',
  name: 'Rainbow Badge',
  kind: 'accessory',
  alive: true,
};
const player = createActor('player');
const events = [];
const handler = getScriptHandler('rainbow_badge');
const ctx = { player, events, t: 7 };

assert.equal(handler?.handlerId, 'rainbow_badge');
handler.onCooldownEffect(badge, ctx);

for (const key of BUFF_KEYS) {
  assert.equal(player.stacks[key], 1, `Rainbow Badge grants one ${key}`);
}
assert.equal(events.filter((event) => event.type === 'buff').length, BUFF_KEYS.length);
assert.equal(events.at(-1)?.type, 'activate', 'source activation occurs after all buffs');
assert.equal(events.at(-1)?.itemId, 'rainbow_badge');
assert.equal(badge.alive, false, 'source onAfterEffectFinished consumes the badge');

console.log('OK Rainbow Badge source and handler regression');
