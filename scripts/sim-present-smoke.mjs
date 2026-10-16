import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const presentData = catalog.find((item) => item.id === 'present');
const source = fs.readFileSync('tools/game-extract-full/Items/Present.gd', 'utf8');

assert.equal(inventory.byId.present?.file, 'Present.gd');
assert.match(source, /func onCombatStart\(\):[\s\S]*giveRandomBuffs\(getP1\(\)\)[\s\S]*activate\(\)/);
assert.match(source, /func onShopEntered\(\):[\s\S]*Game\.spendGold\(g\)[\s\S]*ceil\(g \* getP2\(\)\)[\s\S]*generateAndStorageItem/);
assert.match(source, /func getShopPriority\(\) -> int:/);

const piece = {
  ...presentData,
  itemId: 'present',
  placementKey: 'present',
  name: 'Present',
  params: presentData.params,
  kind: 'accessory',
  side: 'you',
};
const player = createActor('player');
const events = [];
const ctx = { player, events, t: 2, rng: () => 0 };
const handler = getScriptHandler('present');

assert.equal(handler?.handlerId, 'present');
handler.onCombatStart(piece, ctx);
assert.equal(player.stacks.lucky, 5, 'source p1 gives five deterministic random buffs');
assert.equal(events.filter((event) => event.type === 'buff').length, 1);
assert.equal(events.at(-1)?.type, 'activate', 'source activation follows the random buffs');
assert.equal(events.at(-1)?.itemId, 'present');

const zeroPiece = { ...piece, params: { p1: 0 }, placementKey: 'zero-present' };
const zeroEvents = [];
const zeroPlayer = createActor('player');
handler.onCombatStart(zeroPiece, { ...ctx, player: zeroPlayer, events: zeroEvents });
assert.equal(zeroEvents.filter((event) => event.type === 'buff').length, 0, 'zero source p1 does not force a buff');
assert.equal(zeroEvents.at(-1)?.type, 'activate');

console.log('OK Present source and handler regression');
