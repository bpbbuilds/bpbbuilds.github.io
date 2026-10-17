import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { tickTimedResistances } from '../js/pages/sim/engine/timed-resistance.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/SpiritBells.gd',
  'utf8',
);
const parentSource = fs.readFileSync('tools/game-extract-full/Items/LeatherHelm.gd', 'utf8');
const portSource = fs.readFileSync(
  'js/pages/sim/engine/scripts/ports-ai-d.js',
  'utf8',
);
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const sourceItem = catalog.find((item) => item.id === 'spirit_bells');
const catSpirit = catalog.find((item) => item.id === 'cat_spirit');
const owlSpirit = catalog.find((item) => item.id === 'owl_spirit');
const unrelated = catalog.find((item) => item.id === 'stone');

assert.ok(sourceItem && catSpirit && owlSpirit && unrelated, 'Spirit Bells: extracted catalog rows');
assert.match(source, /extends "res:\/\/Items\/LeatherHelm\.gd"/);
assert.match(source, /func isAffectingDistinct\(color = Affected\.Primary\) -> bool:[\s\S]*return color == Affected\.Primary/);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Pet\)/);
assert.match(source, /func getBuffDur\(\) -> float:[\s\S]*getP_m\("dur_base"\)[\s\S]*getP_m\("dur_bonus"\) \* getNumDistinctAffectedItems/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*multiplyBuffsLimit\(buffFactor, 1000\)[\s\S]*onAfterEffectFinished\(\)/);
assert.match(parentSource, /func onPrepare\(\):[\s\S]*changeCritResistance\(getChance\(\)\)[\s\S]*changeStunResistance\(getStunProtectChance\(\)/);
assert.match(parentSource, /func onPreCombatStart\(\):[\s\S]*changeDamageResistance\(damReduction\)[\s\S]*buffTimer\.start\(getBuffDur\(\)/);

const port = portSource.match(/export const spiritBellsPort = \{[\s\S]*?\n\};/u)?.[0] || '';
assert.match(port, /onPrepare\(piece, ctx\)/);
assert.match(port, /onPreCombatStart\(piece, ctx\)/);
assert.match(port, /grantTimedResistancePct/);
assert.ok(
  port.indexOf('multiplyBuffsLimit(') < port.lastIndexOf('afterEffectFinished('),
  'Spirit Bells consumes and activates after the source buff-limit effect',
);
assert.doesNotMatch(port, /grantTimedSpeed\(piece, 1e-6/);

const handler = getScriptHandler('spirit_bells');
assert.equal(handler?.handlerId, 'spirit_bells');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onPreCombatStart, 'function');

const piece = {
  itemId: 'spirit_bells',
  placementKey: 'bells',
  name: 'Spirit Bells',
  kind: 'armor',
  side: 'you',
  chance: 17,
  alive: true,
  charges: null,
  params: { ...sourceItem.params },
};
const petA = { itemId: 'cat_spirit', placementKey: 'cat', kind: 'pet', side: 'you' };
const petB = { itemId: 'owl_spirit', placementKey: 'owl', kind: 'pet', side: 'you' };
const duplicatePetA = { itemId: 'cat_spirit', placementKey: 'cat-2', kind: 'pet', side: 'you' };
const stone = { itemId: 'stone', placementKey: 'stone', kind: 'passive', side: 'you' };
const graph = {
  pieces: new Map([
    ['bells', {
      key: 'bells',
      id: 'spirit_bells',
      affectCells: [
        { cell: 'cat-cell', color: 'primary' },
        { cell: 'owl-cell', color: 'primary' },
        { cell: 'cat-2-cell', color: 'primary' },
        { cell: 'stone-cell', color: 'primary' },
      ],
      cells: [],
    }],
    ['cat', { key: 'cat', id: 'cat_spirit', affectCells: [], cells: ['cat-cell'] }],
    ['owl', { key: 'owl', id: 'owl_spirit', affectCells: [], cells: ['owl-cell'] }],
    ['cat-2', { key: 'cat-2', id: 'cat_spirit', affectCells: [], cells: ['cat-2-cell'] }],
    ['stone', { key: 'stone', id: 'stone', affectCells: [], cells: ['stone-cell'] }],
  ]),
  filled: new Map([
    ['cat-cell', 'cat'],
    ['owl-cell', 'owl'],
    ['cat-2-cell', 'cat-2'],
    ['stone-cell', 'stone'],
  ]),
};
const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
const itemsById = new Map([
  ['spirit_bells', sourceItem],
  ['cat_spirit', catSpirit],
  ['owl_spirit', owlSpirit],
  ['stone', unrelated],
]);
const canAffect = {
  rulesById: rules.byId,
  craftedIds: new Set(rules.craftedIds),
  classMasks: rules.classMasks,
  classBits: rules.classBits,
  rarityRank: rules.rarityRank,
  gainedStacksById: rules.gainedStacksById,
  gainsBuffsIds: new Set(rules.gainsBuffsIds),
};
const ctx = {
  t: 0,
  player,
  dummy,
  events,
  graph,
  pieces: [piece, petA, petB, duplicatePetA, stone],
  itemsById,
  canAffect,
};

handler.onPrepare(piece, ctx);
assert.equal(player.critResistance, 17, 'Leather Helm preparation adds crit resistance');
assert.equal(player.stunResistance, 17, 'Leather Helm preparation adds stun resistance');

handler.onPreCombatStart(piece, ctx);
assert.equal(player.damageResistancePct, 30, 'Leather Helm pre-combat adds damage resistance');
assert.equal(piece._spiritBellsDuration, 4, 'duration uses two distinct affected pets');
assert.equal(player._timedResists?.[0]?.untilT, 4);
assert.equal(piece.state, 1, 'Leather Helm combat state is active during the timed resistance');

handler.onCombatStart(piece, ctx);
assert.equal(events.at(-1)?.type, 'activate', 'combat start activates inherited Leather Helm effect');

grantStacks(player, 'lucky', 10, { originKey: 'seed', originId: 'seed' });
grantStacks(player, 'mana', 5, { originKey: 'seed', originId: 'seed' });
grantStacks(player, 'heat', 1, { originKey: 'seed', originId: 'seed' });
handler.onCooldownEffect(piece, ctx);
assert.equal(player.stacks.lucky, 13, 'buff limit grants source proportional Lucky');
assert.equal(player.stacks.mana, 7, 'buff limit rounds overflow like source');
assert.equal(player.stacks.heat, 1, 'zero-floor source buff does not invent a stack');
assert.equal(piece.alive, false, 'onAfterEffectFinished consumes Spirit Bells');
assert.equal(events.at(-1)?.type, 'activate', 'cooldown activates after buff multiplication');

tickTimedResistances([player], 4);
assert.equal(player.damageResistancePct, 0, 'Leather Helm damage resistance expires at source duration');
assert.equal(piece.state, 0, 'Leather Helm combat state ends with the timed resistance');

console.log('OK Spirit Bells source/parity smoke');
