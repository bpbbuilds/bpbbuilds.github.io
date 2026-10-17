import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/MagicBadge.gd', 'utf8');
const portFile = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-b.js', 'utf8');
const magicBadgePort = portFile.slice(
  portFile.indexOf('export const magicBadgePort'),
  portFile.indexOf('/** scholar_bag', portFile.indexOf('export const magicBadgePort')),
);

assert.equal(inventory.byId.magic_badge?.file, 'Exclusive/MagicBadge.gd');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.gainsStack\(Stack\.Mana\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*changeAmplificiationChancePercent\(Game\.EventType\.Mana, getChance\(\)\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveMana\(mana\)[\s\S]*activate\(\)/);
assert.match(magicBadgePort, /onPrepare\(piece, ctx\)/);
assert.match(magicBadgePort, /buffAmplificationChances\.mana/);
assert.doesNotMatch(magicBadgePort, /other\.buffAmpChance/);
assert.match(magicBadgePort, /onCombatStart\(piece, ctx\)/);
assert.match(magicBadgePort, /Math\.trunc\(getPName\(piece\.params, 'mana'/);
assert.match(magicBadgePort, /pushActivate\(piece, ctx, 'magic_badge'/);

const badge = { id: 'magic_badge', name: 'Magic Badge', type: 'Accessory' };
const manaTarget = { id: 'mana_target', name: 'Mana Target', type: 'Accessory' };
const nonManaTarget = { id: 'non_mana_target', name: 'Non-Mana Target', type: 'Weapon' };
const itemsById = new Map([badge, manaTarget, nonManaTarget].map((item) => [item.id, item]));
const badgePiece = {
  placementKey: 'badge',
  itemId: 'magic_badge',
  name: 'Magic Badge',
  kind: 'accessory',
  side: 'you',
  chance: 30,
  params: { mana: 5, p1: 5 },
};
const manaPiece = { placementKey: 'mana', itemId: 'mana_target', buffAmplificationChances: {} };
const nonManaPiece = { placementKey: 'non-mana', itemId: 'non_mana_target' };
const graph = {
  pieces: new Map([
    ['badge', { key: 'badge', id: 'magic_badge', affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
    ] }],
    ['mana', { key: 'mana', id: 'mana_target', affectCells: [] }],
    ['non-mana', { key: 'non-mana', id: 'non_mana_target', affectCells: [] }],
  ]),
  filled: new Map([
    ['1,0', 'mana'],
    ['2,0', 'non-mana'],
  ]),
};
const canAffect = {
  rulesById: {
    magic_badge: { primary: { op: 'gainsStack', stack: 'Mana' } },
  },
  gainedStacksById: { mana_target: ['Mana'] },
};

const handler = getScriptHandler('magic_badge');
assert.equal(handler?.handlerId, 'magic_badge');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCombatStart, 'function');

const ctx = {
  t: 0,
  player: createActor('player'),
  events: [],
  graph,
  itemsById,
  pieces: [badgePiece, manaPiece, nonManaPiece],
  canAffect,
};
handler.onPrepare(badgePiece, ctx);
assert.equal(manaPiece.buffAmplificationChances.mana, 30, 'prepare applies Mana amplification to the eligible target');
assert.equal(nonManaPiece.buffAmplificationChances, undefined, 'prepare does not amplify a non-Mana target');
assert.equal(manaPiece.buffAmpChance, undefined, 'prepare does not use the all-buff amplification field');

handler.onCombatStart(badgePiece, ctx);
assert.equal(ctx.player.stacks.mana, 5, 'combat start grants the exact named Mana amount');
const buffIndex = ctx.events.findIndex((event) => event.type === 'buff');
const activationIndex = ctx.events.findIndex((event) => event.type === 'activate' && event.meta?.handler === 'magic_badge');
assert.ok(buffIndex >= 0 && activationIndex > buffIndex, 'Magic Badge activation follows its Mana grant');

const zeroBadge = { ...badgePiece, chance: 0, params: { mana: 0, p1: 0 } };
const zeroTarget = { placementKey: 'mana', itemId: 'mana_target', buffAmplificationChances: {} };
const zeroCtx = {
  ...ctx,
  player: createActor('player'),
  events: [],
  pieces: [zeroBadge, zeroTarget],
};
handler.onPrepare(zeroBadge, zeroCtx);
handler.onCombatStart(zeroBadge, zeroCtx);
assert.equal(zeroTarget.buffAmplificationChances?.mana, undefined, 'zero chance does not add a Mana amplification entry');
assert.equal(zeroCtx.player.stacks.mana, 0, 'zero Mana remains zero instead of being clamped to one');
assert.equal(zeroCtx.events.filter((event) => event.type === 'activate').length, 1, 'zero-value Magic Badge still activates at combat start');

console.log('OK Magic Badge source-backed Mana target filtering, prepare timing, combat-start Mana, activation, and zero-value regression');
