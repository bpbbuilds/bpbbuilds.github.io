import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import {
  grantStacks,
  tickTemporaryStacks,
} from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };

const source = fs.readFileSync('tools/game-extract-full/Items/Lightsaber.gd', 'utf8');
const portFile = fs.readFileSync('js/pages/sim/engine/scripts/ports-al-weapons.js', 'utf8');
const lightsaberPort = portFile.slice(
  portFile.indexOf('export const lightsaberPort'),
  portFile.indexOf('/** Pandamonium.gd', portFile.indexOf('export const lightsaberPort')),
);

assert.equal(inventory.byId.lightsaber?.file, 'Lightsaber.gd');
assert.match(source, /func onPrepare\(\):[\s\S]*setState\(false\)[\s\S]*blinding_light_ended[\s\S]*character_blind_changed[\s\S]*character_regeneration_changed/);
assert.match(source, /func onRegenChanged\(amount, triggerEvent\):[\s\S]*amount < 0[\s\S]*getRegeneration\(\) >= regenNeeded[\s\S]*useRegeneration\(regenNeeded, triggerEvent\)[\s\S]*getP_m\("dur_blind"\)[\s\S]*activate\(null, false\)/);
assert.match(source, /func onOpponentBlindChanged\(amount, event\):[\s\S]*changeVaryingDamage\(damPerBlind \* amount\)/);
assert.match(source, /func onBlindingLightTimeout\(\):[\s\S]*setState\(false\)[\s\S]*endBlindingLight/);

assert.match(lightsaberPort, /onPrepare\(piece, ctx\)/);
assert.match(lightsaberPort, /changeVaryingDamageFromBuffChange/);
assert.match(lightsaberPort, /onTick\(piece, ctx\)/);
assert.match(lightsaberPort, /modifiedParamValue\(/);
assert.doesNotMatch(lightsaberPort, /onCombatStart\(piece, ctx\)/);

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const placements = [{ id: 'lightsaber', key: 'saber', x: 0, y: 0, r: 0 }];
const sword = buildCombatPieces(placements, byId)[0];
sword.side = 'you';
sword.paramMult = { dur_blind: 0.5 };
const player = createActor('player');
const dummy = createActor('dummy');
const bus = createCombatBus();
const events = [];
player._combatBus = bus;
dummy._combatBus = bus;
const ctx = { t: 1, player, dummy, bus, events, rng: () => 0 };
const handler = getScriptHandler('lightsaber');

assert.equal(handler?.handlerId, 'lightsaber');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onTick, 'function');
handler.onPrepare(sword, ctx);
assert.equal(sword._lsLit, false, 'onPrepare resets the source state');

grantStacks(player, 'regeneration', 6, { originId: 'setup' });
assert.equal(player.stacks.regeneration, 3, 'the source spends exactly its named regeneration threshold');
assert.equal(dummy.stacks.blind, 8, 'the source inflicts exact named Blind');
assert.equal(sword.bonusDamage, 8, 'opponent Blind changes live varying damage by the source delta');
assert.equal(sword.removableBonusDamage, 0, 'varying damage is non-removable like changeVaryingDamage');
assert.equal(sword._lsLit, true);
assert.equal(sword._lsBlindUntil, 4, 'the source applies modified dur_blind');
assert.equal(events.filter((event) => event.type === 'activate').length, 1);

tickTemporaryStacks(dummy, 4, events);
handler.onTick(sword, { ...ctx, t: 4 });
assert.equal(dummy.stacks.blind, 8, 'the light-end path rechecks regeneration and reactivates');
assert.equal(player.stacks.regeneration, 0);
assert.equal(sword._lsLit, true);
assert.equal(events.filter((event) => event.type === 'activate').length, 2);

const zeroPlayer = createActor('player');
const zeroDummy = createActor('dummy');
const zeroBus = createCombatBus();
zeroPlayer._combatBus = zeroBus;
zeroDummy._combatBus = zeroBus;
const zeroCtx = { t: 0, player: zeroPlayer, dummy: zeroDummy, bus: zeroBus, events: [], rng: () => 0 };
const zeroSword = { ...sword, placementKey: 'zero-saber', params: { regent: 0, p1: 0, dam_blind: 0, p2: 0, blind: 0, p3: 0, dur_blind: 0, p4: 0 }, bonusDamage: 0, removableBonusDamage: 0 };
handler.onPrepare(zeroSword, zeroCtx);
grantStacks(zeroPlayer, 'regeneration', 1, { originId: 'zero-setup' });
assert.equal(zeroPlayer.stacks.regeneration, 1, 'explicit zero threshold does not spend unrelated regeneration');
assert.equal(zeroDummy.stacks.blind, 0, 'explicit zero Blind remains zero');
assert.equal(zeroSword._lsBlindUntil, 0, 'explicit zero duration remains zero');

console.log('OK Lightsaber source-backed prepare listeners, exact regen/Blind/damage, modified timer, reactivation, and zero parameters regression');
