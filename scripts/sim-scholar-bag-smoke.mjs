import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/ScholarBag.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-b.js', 'utf8');
const scholarPort = port.slice(
  port.indexOf('export const scholarBagPort'),
  port.indexOf('/** burning_spikes'),
);

assert.match(source, /extends Bag/);
assert.match(source, /onready var mana: = int\(getP\("mana"\)\)/);
assert.match(source, /func canApplyEffect\(toItem\):[\s\S]*return toItem\.gainsStack\(Stack\.Mana\)/);
assert.match(
  source,
  /func onPrepare\(\):[\s\S]*getAffectedItemsInside\(\)[\s\S]*changeAmplificiationChancePercent\(Game\.EventType\.Mana, getChance\(\)\)[\s\S]*changeProtectionChance\(Game\.EventType\.Mana, getChance2\(\)/,
);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveMana\(mana\)[\s\S]*activate\(\)/);
assert.match(scholarPort, /onPrepare\(piece, ctx\)/);
assert.match(scholarPort, /buffAmplificationChances\.mana/);
assert.match(scholarPort, /changeBuffCleanseProtectChance\(player, 'mana', prot\)/);
assert.match(scholarPort, /getPName\(piece\.params, 'mana', getP1\(piece\.params, 0\)\)/);
assert.match(scholarPort, /Math\.trunc\(/);
assert.match(scholarPort, /pushActivate\(piece, ctx, 'scholar_bag'/);
assert.doesNotMatch(scholarPort, /buffProtect/);
assert.doesNotMatch(scholarPort, /Math\.max\(1, Math\.round\(getPName\(piece\.params, 'mana'/);

byId.set('scholar_mana_target', { id: 'scholar_mana_target', type: 'Weapon', name: 'Mana Target' });
byId.set('scholar_lucky_target', { id: 'scholar_lucky_target', type: 'Weapon', name: 'Lucky Target' });

const bag = {
  ...byId.get('scholar_bag'),
  itemId: 'scholar_bag',
  name: 'Scholar Bag',
  placementKey: 'scholar-bag',
  chance: 40,
  chance2: 50,
  params: { mana: 5.9, p1: 9 },
  kind: 'bag',
  alive: true,
};
const manaTarget = {
  itemId: 'scholar_mana_target',
  name: 'Mana Target',
  placementKey: 'mana-target',
  params: {},
};
const luckyTarget = {
  itemId: 'scholar_lucky_target',
  name: 'Lucky Target',
  placementKey: 'lucky-target',
  params: {},
};
const graph = {
  pieces: new Map([
    ['scholar-bag', { key: 'scholar-bag', cells: ['0,0'] }],
    ['mana-target', { key: 'mana-target', cells: ['0,0'] }],
    ['lucky-target', { key: 'lucky-target', cells: ['2,2'] }],
  ]),
  filled: new Map([
    ['0,0', 'mana-target'],
    ['2,2', 'lucky-target'],
  ]),
};
const player = createActor('player');
const ctx = {
  player,
  dummy: createActor('dummy'),
  events: [],
  graph,
  pieces: [bag, manaTarget, luckyTarget],
  itemsById: byId,
  canAffect: {
    gainedStacksById: {
      scholar_mana_target: ['Mana'],
      scholar_lucky_target: ['Lucky'],
    },
  },
  t: 4,
  rng: () => 0,
};

const handler = getScriptHandler('scholar_bag');
assert.equal(handler?.handlerId, 'scholar_bag');
assert.equal(typeof handler?.onPrepare, 'function');

handler.onPrepare(bag, ctx);
assert.equal(manaTarget.buffAmplificationChances?.mana, 40, 'only Mana-gaining cargo receives Mana amplification');
assert.equal(luckyTarget.buffAmplificationChances?.mana || 0, 0, 'outside/non-Mana cargo is not amplified');
assert.equal(player.buffCleanseProtectChanceByStack?.mana, 50, 'protection is stored only for Mana removal');
assert.equal(player.buffCleanseProtectChance || 0, 0, 'Scholar Bag does not grant global buff protection');

handler.onCombatStart(bag, ctx);
assert.equal(player.stacks.mana, 5, 'source int(getP("mana")) truncates the named Mana parameter');
assert.equal(ctx.events.at(-1)?.type, 'activate', 'Mana is applied before Scholar Bag activation');
assert.equal(ctx.events.at(-1)?.itemId, 'scholar_bag');

const amplified = grantStacks(player, 'mana', 1, {
  origin: manaTarget,
  rng: () => 0,
});
assert.equal(amplified.gained, 1, 'Mana amplification remains attached to the matching cargo item');

const protectedMana = spendStacks(player, 'mana', 5, {
  hostileStrip: true,
  rng: () => 0,
});
assert.equal(protectedMana.spent, 0, 'Scholar Bag protects Mana from hostile removal at the source chance');
assert.equal(player.stacks.mana, 6, 'protected Mana remains available');

player.stacks.lucky = 1;
const unprotectedLucky = spendStacks(player, 'lucky', 1, {
  hostileStrip: true,
  rng: () => 0,
});
assert.equal(unprotectedLucky.spent, 1, 'Scholar Bag does not protect unrelated buff types');

const sparse = {
  ...bag,
  placementKey: 'sparse-scholar-bag',
  params: {},
};
const sparseCtx = { ...ctx, player: createActor('player'), events: [], pieces: [sparse] };
handler.onCombatStart(sparse, sparseCtx);
assert.equal(sparseCtx.player.stacks.mana || 0, 0, 'missing named Mana does not fabricate a stack');
assert.equal(sparseCtx.events.at(-1)?.type, 'activate', 'activation still follows the source start hook');

console.log('OK Scholar Bag source and handler regression');
