import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const item = catalog.find((row) => row.id === 'pumpkin');
const source = fs.readFileSync('tools/game-extract-full/Items/Pumpkin.gd', 'utf8');

assert.equal(inventory.byId.pumpkin?.file, 'Pumpkin.gd');
assert.match(source, /extends Food/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*useStamina\(\)[\s\S]*dealDamage\(\)[\s\S]*activate\(res\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*fatigue_start[\s\S]*onFatigueStarted/);
assert.match(source, /func onDealtDamage\(damageRes: DamageResult\):[\s\S]*hasHit\(\)[\s\S]*rollChance\(\)[\s\S]*stun\(getP_m\("dur_stun"\)/);
assert.match(source, /func onFatigueStarted\(\):[\s\S]*setTexture\(glowingTexture\)[\s\S]*giveHeat\(heat\)[\s\S]*activate\(\)/);

const pumpkin = {
  ...item,
  itemId: 'pumpkin',
  placementKey: 'pumpkin',
  name: 'Pumpkin',
  params: item.params,
  kind: 'weapon',
  side: 'you',
};
const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
const bus = createCombatBus();
const ctx = { player, dummy, events, bus, t: 3, rng: () => 0 };
const handler = getScriptHandler('pumpkin');

assert.equal(handler?.handlerId, 'pumpkin');
handler.onPrepare(pumpkin, ctx);
bus.emit('fatigue_start', { t: 3 });
assert.equal(player.stacks.heat, 10, 'fatigue uses the source integer Heat amount');
assert.equal(pumpkin._pumpkinGlowing, true);
assert.equal(events.at(-1)?.type, 'activate', 'fatigue effect activates after Heat');

handler.onDealtDamage(pumpkin, ctx, { hit: true });
assert.equal(dummy.stunnedUntil, 3.5, 'hit chance applies source duration stun');
const beforeMiss = dummy.stunnedUntil;
handler.onDealtDamage(pumpkin, ctx, { hit: false });
assert.equal(dummy.stunnedUntil, beforeMiss, 'misses do not stun');

const zeroPumpkin = { ...pumpkin, params: { dur_stun: 0.5, heat: 0 } };
const zeroPlayer = createActor('player');
const zeroEvents = [];
const zeroBus = createCombatBus();
handler.onPrepare(zeroPumpkin, { ...ctx, player: zeroPlayer, events: zeroEvents, bus: zeroBus });
zeroBus.emit('fatigue_start', { t: 3 });
assert.equal(zeroPlayer.stacks.heat, 0, 'zero Heat does not force a stack');
assert.equal(zeroEvents.at(-1)?.type, 'activate');

console.log('OK Pumpkin source and handler regression');
