import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Laboratory.gd', 'utf8');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const data = byId.get('laboratory');

assert.equal(inventory.byId.laboratory?.file, 'Exclusive/Laboratory.gd');
assert.match(source, /func canAffect\(item\):[\s\S]*Type\.Fire[\s\S]*Type\.Nature[\s\S]*Type\.Holy[\s\S]*Type\.Vampiric[\s\S]*Classes_Full\.Engineer/);
assert.match(source, /func onPreCombatStart\(\):[\s\S]*setState\(0\)[\s\S]*countTypes\(getAffectedItems\(\)\)/);
assert.match(source, /func trigger\(\):[\s\S]*setState\(phase \+ 1\)[\s\S]*\.trigger\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*useLucky[\s\S]*giveHeat[\s\S]*useHeat[\s\S]*giveSpikes[\s\S]*useSpikes[\s\S]*giveRegeneration[\s\S]*useRegeneration[\s\S]*giveVampirism[\s\S]*useVampirism[\s\S]*giveEmpower/);
assert.equal(getScriptHandler('laboratory')?.handlerId, 'laboratory');

function piece(id, key, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item?.displayName || item?.name || id,
    params: { ...(item?.params || {}) },
    kind: id === 'laboratory' ? 'gadget' : 'weapon',
    side: 'you',
    alive: true,
    baseCooldown: item?.cooldown || 0,
    cooldown: item?.cooldown || 0,
    triggerTime: item?.cooldown || 0,
    ...overrides,
  };
}

const lab = piece('laboratory', 'lab');
const fire = piece('burning_blade', 'fire');
const nature = piece('forest_dragon', 'nature');
const holy = piece('holy_armor', 'holy');
const vamp = piece('vampiric_armor', 'vamp');
const engineer = piece('engineer_box', 'engineer', { kind: 'bag' });
const graph = {
  pieces: new Map([
    ['lab', { key: 'lab', id: 'laboratory', cells: ['0,0'], affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
      { cell: '3,0', color: 'primary' },
      { cell: '4,0', color: 'primary' },
      { cell: '5,0', color: 'primary' },
    ] }],
    ['fire', { key: 'fire', id: 'burning_blade', cells: ['1,0'], affectCells: [] }],
    ['nature', { key: 'nature', id: 'forest_dragon', cells: ['2,0'], affectCells: [] }],
    ['holy', { key: 'holy', id: 'holy_armor', cells: ['3,0'], affectCells: [] }],
    ['vamp', { key: 'vamp', id: 'vampiric_armor', cells: ['4,0'], affectCells: [] }],
    ['engineer', { key: 'engineer', id: 'engineer_box', cells: ['5,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', 'lab'],
    ['1,0', 'fire'],
    ['2,0', 'nature'],
    ['3,0', 'holy'],
    ['4,0', 'vamp'],
    ['5,0', 'engineer'],
  ]),
};
const player = createActor('player');
const dummy = createActor('dummy');
const bus = createCombatBus();
const events = [];
player._combatBus = bus;
dummy._combatBus = bus;
player._eventLog = events;
dummy._eventLog = [];
const ctx = {
  player,
  dummy,
  bus,
  events,
  t: 6,
  rng: () => 0,
  pieces: [lab, fire, nature, holy, vamp, engineer],
  allPieces: [lab, fire, nature, holy, vamp, engineer],
  graph,
  itemsById: byId,
  canAffect: { rulesById: rules.byId },
};
const handler = getScriptHandler('laboratory');

handler.onPreCombatStart(lab, ctx);
assert.equal(lab._labPhase, 0, 'Laboratory starts at phase zero');
assert.deepEqual(lab._labTypes, { fire: 1, nature: 1, holy: 1, vampiric: 1, engineer: 1 });

grantStacks(player, 'lucky', 1);
assert.equal(handler.onCooldownEffect(lab, ctx), true);
assert.equal(lab._labPhase, 1);
assert.equal(player.stacks.lucky, 0);
assert.equal(player.stacks.heat, 5, 'Laboratory phase one adds Fire-scaled Heat');
assert.equal(lab.baseCooldown, 2);

assert.equal(handler.onCooldownEffect(lab, ctx), true);
assert.equal(lab._labPhase, 2);
assert.equal(player.stacks.heat, 1);
assert.equal(player.stacks.spikes, 9, 'Laboratory phase two adds Nature-scaled Spikes');

assert.equal(handler.onCooldownEffect(lab, ctx), true);
assert.equal(lab._labPhase, 3);
assert.equal(player.stacks.spikes, 3);
assert.equal(player.stacks.regeneration, 11, 'Laboratory phase three adds Holy-scaled Regeneration');

assert.equal(handler.onCooldownEffect(lab, ctx), true);
assert.equal(lab._labPhase, 4);
assert.equal(player.stacks.regeneration, 3);
assert.equal(player.stacks.vampirism, 13, 'Laboratory phase four adds Vampiric-scaled Vampirism');
assert.equal(lab.baseCooldown, 4, 'Laboratory uses the source final transition cooldown');

assert.equal(handler.onCooldownEffect(lab, ctx), true);
assert.equal(lab._labPhase, 5);
assert.equal(player.stacks.vampirism, 3);
assert.equal(player.stacks.empower, 15, 'Laboratory phase five adds Engineer-scaled Empower');
assert.equal(lab.alive, false, 'Laboratory consumes itself after phase five');
assert.equal(lab._cdLocked, true);
assert.ok(events.some((event) => event.type === 'activate' && event.itemId === 'laboratory'));

const empty = piece('laboratory', 'empty-lab');
const emptyCtx = { ...ctx, player: createActor('player'), events: [], pieces: [empty], allPieces: [empty] };
emptyCtx.player._combatBus = bus;
emptyCtx.player._eventLog = emptyCtx.events;
handler.onPreCombatStart(empty, emptyCtx);
handler.onCooldownEffect(empty, emptyCtx);
assert.equal(empty._labPhase, 1, 'Laboratory still advances its source phase when a spend gate fails');
assert.equal(emptyCtx.player.stacks.heat, 0);

console.log('OK Laboratory source-backed typed target snapshot, five-phase spend/conversion order, phase cooldown transition, final consumption, and failed-gate behavior');
