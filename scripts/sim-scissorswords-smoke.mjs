import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { tickTemporaryStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Scissorswords.gd', 'utf8');
const lightsaber = fs.readFileSync('tools/game-extract-full/Items/Lightsaber.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-aura.js', 'utf8');
const scissorsPort = port.slice(
  port.indexOf('export const scissorswordsPort'),
  port.indexOf('/** @type {ScriptHandler} */', port.indexOf('export const scissorswordsPort') + 1),
);

assert.match(source, /extends "res:\/\/Items\/Lightsaber\.gd"/);
assert.match(source, /onready var luckNeeded: = int\(getP\("luckt"\)\)/);
assert.match(source, /onready var bonusDam: = getP\("dam"\)/);
assert.match(source, /onready var luck: = int\(getP\("luck"\)\)/);
assert.match(source, /onready var regen: = int\(getP\("regen"\)\)/);
assert.match(source, /func inflict\(duration, event\):[\s\S]*\.inflict\(duration, event\)[\s\S]*giveStacksTemporary\(character\(\), Game\.EventType\.Blind/);
assert.match(source, /func onDealtDamage\(damageRes: DamageResult\):[\s\S]*useLucky\(luckNeeded, damageRes\.event\)[\s\S]*addBonusDamage\(bonusDam\)[\s\S]*giveRegeneration\(regen, event\)/);
assert.match(lightsaber, /func onPrepare\(\):[\s\S]*onBlindingLightEnded[\s\S]*onOpponentBlindChanged[\s\S]*onRegenChanged/);
assert.match(lightsaber, /func onRegenChanged\(amount, triggerEvent\):[\s\S]*useRegeneration\(regenNeeded, triggerEvent\)[\s\S]*inflict\(duration, event\)[\s\S]*activate\(null, false\)/);

assert.match(scissorsPort, /onPrepare\(piece, ctx\)/);
assert.match(scissorsPort, /grantTemporaryStacks\(dummy/);
assert.match(scissorsPort, /grantTemporaryStacks\(player/);
assert.match(scissorsPort, /onDealtDamage\(piece, ctx, hit\)/);
assert.match(scissorsPort, /useLucky\(ctx\.player/);
assert.match(scissorsPort, /pushActivate\(piece, .*'scissorswords'/);
assert.doesNotMatch(scissorsPort, /onCombatStart\(piece, ctx\)/);

const player = createActor('player');
const dummy = createActor('dummy');
const bus = createCombatBus();
player._combatBus = bus;
dummy._combatBus = bus;
const ctx = { t: 1, player, dummy, bus, events: [], rng: () => 0 };
const sword = {
  itemId: 'scissorswords',
  placementKey: 'scissorswords-1',
  name: 'Scissorswords',
  kind: 'weapon',
  alive: true,
  params: {
    regent: 2.9,
    p1: 9,
    dam_blind: 1.5,
    p2: 8,
    blind: 4.9,
    p3: 8,
    dur_blind: 2.5,
    p4: 8,
    luckt: 2.9,
    p5: 8,
    dam: 3.75,
    p6: 8,
    luck: 5.9,
    p7: 8,
    regen: 1.9,
    p8: 8,
  },
  bonusDamage: 0,
  removableBonusDamage: 0,
  damageMin: 10,
  damageMax: 10,
  staminaCost: 1,
  cooldown: 1.4,
  baseCooldown: 1.4,
};

const handler = getScriptHandler('scissorswords');
assert.equal(handler?.handlerId, 'scissorswords');
assert.equal(typeof handler?.onPrepare, 'function');
handler.onPrepare(sword, ctx);

grantStacks(player, 'regeneration', 3, { originId: 'regen-source' });
assert.equal(player.stacks.regeneration, 1, 'Lightsaber consumes truncated named regeneration threshold');
assert.equal(dummy.stacks.blind, 4, 'Scissorswords inherits opponent Blind from Lightsaber');
assert.equal(player.stacks.blind, 4, 'Scissorswords adds matching self Blind in its inflict override');
assert.equal(sword.bonusDamage, 6, 'opponent Blind changes add non-removable varying damage');
assert.equal(sword._lsLit, true);
assert.equal(ctx.events.filter((event) => event.type === 'activate').length, 1, 'source activate(null, false) is retained');

player.stacks.lucky = 3;
handler.onDealtDamage(sword, ctx, { hit: true });
assert.equal(player.stacks.lucky, 1, 'hit branch spends the truncated named Lucky threshold');
assert.equal(player.stacks.regeneration, 2, 'hit branch grants truncated named regeneration');
assert.equal(sword.bonusDamage, 9.75, 'hit branch adds the named bonus damage without rounding');
assert.equal(dummy.stacks.blind, 4, 'hit branch does not blindly add another Blind pair');
assert.equal(player.stacks.blind, 4);

handler.onDealtDamage(sword, ctx, { hit: false });
assert.equal(player.stacks.lucky, 6, 'miss branch grants truncated named Lucky');

tickTemporaryStacks(player, 3.5, ctx.events);
tickTemporaryStacks(dummy, 3.5, ctx.events);
handler.onTick(sword, { ...ctx, t: 3.5 });
assert.equal(sword._lsLit, true, 'source light-end callback can retrigger while enough regeneration remains');
assert.equal(player.stacks.regeneration, 0);
assert.equal(dummy.stacks.blind, 4);
assert.equal(player.stacks.blind, 4);

const missOnlyPlayer = createActor('player');
const missOnlyDummy = createActor('dummy');
const missOnlyCtx = { ...ctx, player: missOnlyPlayer, dummy: missOnlyDummy, events: [] };
const missOnlySword = { ...sword, placementKey: 'scissorswords-2', params: { ...sword.params, luckt: 2, p5: 2 } };
handler.onPrepare(missOnlySword, missOnlyCtx);
missOnlyPlayer.stacks.lucky = 1;
handler.onDealtDamage(missOnlySword, missOnlyCtx, { hit: true });
assert.equal(missOnlyDummy.stacks.blind, 0, 'a hit without enough Lucky does not add inherited Blind');
assert.equal(missOnlyPlayer.stacks.blind, 0);

console.log('OK Scissorswords source and handler regression');
