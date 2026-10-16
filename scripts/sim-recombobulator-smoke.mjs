import assert from 'node:assert/strict';
import fs from 'node:fs';

import { DEBUFF_KEYS, BUFF_KEYS, grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Recombobulator.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-an-gadgets.js', 'utf8');
const recombPort = port.slice(
  port.indexOf('function recombPort'),
  port.indexOf('/** @type {Record<string, import', port.indexOf('function recombPort')),
);

assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveRandomBuffs\(1\)[\s\S]*cleanseRandomDebuffs\(1\)[\s\S]*activate\(\)/);
assert.match(recombPort, /giveRandomBuffs\(ctx\.player, 1, ctx\.rng/);
assert.match(recombPort, /cleanseRandomDebuffs\(ctx\.player, 1, ctx\.rng/);
assert.match(recombPort, /pushActivate\(piece, ctx, id, `Accessory: \$\{piece\.name\}`\)/);
assert(
  recombPort.indexOf('pushActivate(piece, ctx, id') >
    recombPort.indexOf('cleanseRandomDebuffs(ctx.player, 1, ctx.rng'),
  'Recombobulator activation follows the buff and cleanse effects',
);

for (const id of ['stable_recombobulator', 'unstable_recombobulator']) {
  const base = byId.get(id);
  assert.ok(base, `${id} exists in the game catalog`);
  const piece = {
    ...base,
    itemId: id,
    placementKey: id,
    cells: [id],
    alive: true,
  };
  const player = createActor('player');
  const dummy = createActor('dummy');
  const events = [];
  player._eventLog = events;
  dummy._eventLog = events;
  grantStacks(player, 'poison', 3, { originKey: 'setup', originId: 'setup' });
  grantStacks(player, 'blind', 2, { originKey: 'setup', originId: 'setup' });
  events.length = 0;
  const beforeDebuffs = DEBUFF_KEYS.reduce((sum, key) => sum + (player.stacks[key] || 0), 0);
  const beforeBuffs = BUFF_KEYS.reduce((sum, key) => sum + (player.stacks[key] || 0), 0);
  const ctx = { player, dummy, events, t: 8, rng: () => 0, itemsById: byId };
  const handler = getScriptHandler(id);
  assert.equal(handler?.handlerId, id);
  handler.onCooldownEffect(piece, ctx);
  const afterDebuffs = DEBUFF_KEYS.reduce((sum, key) => sum + (player.stacks[key] || 0), 0);
  const afterBuffs = BUFF_KEYS.reduce((sum, key) => sum + (player.stacks[key] || 0), 0);
  assert.equal(afterBuffs, beforeBuffs + 1, `${id} gives one random buff`);
  assert.equal(afterDebuffs, beforeDebuffs - 1, `${id} cleanses one random debuff`);
  assert.equal(events.at(-1)?.type, 'activate', `${id} activates after combat effects`);
  assert.equal(events.at(-1)?.itemId, id);
  assert.match(events.at(-1)?.label || '', /^Accessory: /);
}

console.log('OK Stable/Unstable Recombobulator source and handler regression');
