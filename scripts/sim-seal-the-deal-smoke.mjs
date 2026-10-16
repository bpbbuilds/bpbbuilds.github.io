import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SealtheDeal.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-luck.js', 'utf8');
const sealPort = port.slice(
  port.indexOf('export const sealTheDealPort'),
  port.indexOf('/** @type {ScriptHandler} */', port.indexOf('export const sealTheDealPort') + 1),
);

assert.match(source, /extends Item/);
assert.match(source, /onready var regenNeeded: = int\(getP\("regent"\)\)/);
assert.match(source, /onready var vampirism: = int\(getP\("vamp"\)\)/);
assert.match(source, /onready var luckNeeded: = int\(getP\("luckt"\)\)/);
assert.match(source, /onready var spikes: = int\(getP\("spikes"\)\)/);
assert.match(source, /onready var manaNeeded: = int\(getP\("manat"\)\)/);
assert.match(source, /onready var empower: = int\(getP\("empower"\)\)/);
assert.match(source, /onready var tradeBonusValue: = int\(getP\("gold"\)\)/);
assert.match(source, /func onCalcTradeChance\(\):[\s\S]*tradeChance[\s\S]*tradeBonusValue/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*useRegeneration\(regenNeeded\)[\s\S]*giveVampirism\(vampirism/);
assert.match(source, /useLucky\(luckNeeded\)[\s\S]*giveSpikes\(spikes/);
assert.match(source, /useMana\(manaNeeded\)[\s\S]*giveEmpower\(empower/);
assert.match(source, /giveEmpower\(empower, event\)[\s\S]*activate\(\)/);

assert.match(sealPort, /onCalcTradeChance\(piece, ctx\)/);
assert.match(sealPort, /Math\.trunc\(getPName\(piece\.params/);
assert.match(sealPort, /pushActivate\(piece, .*'seal_the_deal'/);
assert.doesNotMatch(sealPort, /Math\.max\(1, Math\.round\(getPName\(piece\.params, 'regent'/);

const params = {
  gold: 1.9,
  p1: 9,
  regent: 2.9,
  p2: 9,
  vamp: 3.9,
  p3: 9,
  luckt: 2.9,
  p4: 9,
  spikes: 3.9,
  p5: 9,
  manat: 2.9,
  p6: 9,
  empower: 2.9,
  p7: 9,
};
const player = createActor('player');
const piece = {
  itemId: 'seal_the_deal',
  placementKey: 'seal-the-deal-1',
  name: 'Seal the Deal',
  kind: 'skill',
  alive: true,
  params,
  shopChance: 30,
  cooldown: 5.2,
  baseCooldown: 5.2,
};
const ctx = { t: 4, player, dummy: createActor('dummy'), events: [], itemsById: new Map() };
const handler = getScriptHandler('seal_the_deal');
assert.equal(handler?.handlerId, 'seal_the_deal');
assert.equal(typeof handler?.onCalcTradeChance, 'function');

const sellBox = { tradeChance: 0, tradeBonusValue: 0 };
handler.onCalcTradeChance(piece, { ...ctx, sellBox });
assert.equal(sellBox.tradeChance, 0.3, 'source shop chance is projected as a fraction');
assert.equal(sellBox.tradeBonusValue, 1, 'source gold parameter is integer-truncated and named-first');

player.stacks.regeneration = 2;
player.stacks.lucky = 2;
player.stacks.mana = 2;
assert.equal(handler.onCooldownEffect(piece, ctx), true);
assert.equal(player.stacks.regeneration, 0, 'regeneration threshold is named-first and truncated');
assert.equal(player.stacks.lucky, 0, 'Lucky threshold is named-first and truncated');
assert.equal(player.stacks.mana, 0, 'Mana threshold is named-first and truncated');
assert.equal(player.stacks.vampirism, 3, 'Vampirism grant is named-first and truncated');
assert.equal(player.stacks.spikes, 3, 'Spikes grant is named-first and truncated');
assert.equal(player.stacks.empower, 2, 'Empower grant is named-first and truncated');
assert.equal(ctx.events.at(-1)?.type, 'activate', 'Seal the Deal activates after every conversion');

const zeroPlayer = createActor('player');
const zeroPiece = { ...piece, placementKey: 'seal-the-deal-zero', params: {
  regent: 0,
  vamp: 0,
  luckt: 0,
  spikes: 0,
  manat: 0,
  empower: 0,
} };
const zeroCtx = { ...ctx, player: zeroPlayer, events: [] };
handler.onCooldownEffect(zeroPiece, zeroCtx);
assert.equal(zeroPlayer.stacks.vampirism || 0, 0, 'zero source grants do not fabricate Vampirism');
assert.equal(zeroPlayer.stacks.spikes || 0, 0, 'zero source grants do not fabricate Spikes');
assert.equal(zeroPlayer.stacks.empower || 0, 0, 'zero source grants do not fabricate Empower');
assert.equal(zeroCtx.events.at(-1)?.type, 'activate', 'activation remains unconditional with zero values');

console.log('OK Seal the Deal source and handler regression');
