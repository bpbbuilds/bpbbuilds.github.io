import assert from 'node:assert/strict';
import fs from 'node:fs';

import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/RainbowPotion.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-d-unique.js', 'utf8');
const potionPort = port.slice(
  port.indexOf('export const rainbowPotionPort'),
  port.indexOf('/** PerpetuumMobile.gd */'),
);

assert.equal(canAffectRules.byId.rainbow_potion?.file, 'Exclusive/RainbowPotion.gd');
assert.match(source, /canAffect_global\(item\)[\s\S]*hasType\(Type\.Potion\)[\s\S]*item != self/);
assert.match(source, /getNumDistinctAffectedItems\(Affected\.Secondary\)[\s\S]*getNumDistinctAffectedItems\(Affected\.Tertiary\)/);
assert.match(source, /giveMana\(books \* manaPerBook\)[\s\S]*giveMaxStaminaTemporary\(books \* staminaPerBook\)/);
assert.match(source, /giveRandomBuffs\(buffsPerStaff \* staffs\)[\s\S]*activate\(null, false, false, null, false\)/);
assert.match(source, /usedBuffs > buffsNeeded[\s\S]*consumePotion\(event\)/);
assert.match(potionPort, /onPrepare\(piece, ctx\)/);
assert.match(potionPort, /link\.color === 'secondary'/);
assert.match(potionPort, /link\.color === 'tertiary'/);
assert.match(potionPort, /getPName\(piece\.params, 'stamina', getP2\(piece\.params, 0\)\)/);
assert.match(potionPort, /getPName\(piece\.params, 'buffs', getP3\(piece\.params, 0\)\)/);
assert.match(port, /triggerFirstAffectedPotion\(piece, ctx, t\)/);
assert(
  potionPort.indexOf('pushActivate(piece, ctx, \'rainbow_potion\'') >
    potionPort.indexOf('pushBuffGrants(ctx.events, piece, ctx.player, ctx.t, \'rainbow_potion\''),
  'combat-start grants finish before Rainbow Potion activation',
);

function addProbe(id, item, placementKey, cell, trigger) {
  byId.set(id, { id, name: id, shape: [[1]], ...item });
  return {
    ...byId.get(id),
    itemId: id,
    placementKey,
    cells: [cell],
    alive: true,
    charges: 1,
    ...(trigger ? { _potionTrigger: trigger } : {}),
  };
}

const rainbow = {
  ...structuredClone(byId.get('rainbow_potion')),
  itemId: 'rainbow_potion',
  placementKey: 'rainbow',
  cells: ['rainbow-cell'],
  alive: true,
  charges: 1,
};
const triggered = [];
const potionA = addProbe(
  'probe-potion-a',
  { type: 'Potion' },
  'potion-a',
  'potion-a-cell',
  () => triggered.push('a'),
);
const potionADuplicate = addProbe(
  'probe-potion-a',
  { type: 'Potion' },
  'potion-a-duplicate',
  'potion-a-duplicate-cell',
  () => triggered.push('a-duplicate'),
);
const potionB = addProbe(
  'probe-potion-b',
  { type: 'Potion' },
  'potion-b',
  'potion-b-cell',
  () => triggered.push('b'),
);
const book = addProbe('probe-book', { type: 'Book' }, 'book', 'book-cell');
const staff = addProbe('probe-staff', { type: 'Accessory', tags: ['Staff'] }, 'staff', 'staff-cell');

const pieces = [rainbow, potionA, potionADuplicate, potionB, book, staff];
const graph = {
  pieces: new Map([
    ['rainbow', {
      key: 'rainbow',
      id: 'rainbow_potion',
      cells: rainbow.cells,
      affectCells: [
        { cell: 'potion-a-cell', color: 'primary' },
        { cell: 'book-cell', color: 'secondary' },
        { cell: 'staff-cell', color: 'tertiary' },
      ],
    }],
    ...pieces.slice(1).map((piece) => [piece.placementKey, {
      key: piece.placementKey,
      id: piece.itemId,
      cells: piece.cells,
      affectCells: [],
    }]),
  ]),
  filled: new Map([
    ['potion-a-cell', 'potion-a'],
    ['book-cell', 'book'],
    ['staff-cell', 'staff'],
  ]),
};

const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
const busEvents = [];
const ctx = {
  player,
  dummy,
  pieces,
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  t: 9,
  rng: () => 0,
  bus: { emit: (name, payload) => busEvents.push({ name, payload }) },
};
const handler = getScriptHandler('rainbow_potion');
assert.equal(handler?.handlerId, 'rainbow_potion');

handler.onPrepare(rainbow, ctx);
handler.onCombatStart(rainbow, ctx);
assert.equal(player.stacks.mana, 1, 'one distinct secondary Book grants named Mana');
assert.equal(player.temporaryMaxStamina, 1, 'one distinct secondary Book grants named temporary stamina');
assert.equal(player.stamina, 6, 'temporary stamina is filled immediately');
const totalBuffs = Object.values(player.stacks).reduce((sum, amount) => sum + amount, 0) - player.stacks.mana;
assert.equal(totalBuffs, 7, 'one distinct tertiary Staff grants named random buffs');
assert.equal(rainbow.alive, true, 'combat-start effect does not consume Rainbow Potion');
assert.equal(rainbow.charges, 1, 'combat-start effect preserves potion charges');
assert.equal(events.at(-1)?.type, 'activate', 'combat-start effects finish before activation');
assert.equal(events.at(-1)?.itemId, 'rainbow_potion');

triggered.length = 0;
rainbow._potionTrigger({ t: 10 });
assert.equal(triggered.length, 2, 'trigger selects the configured number of potions');
assert.equal(new Set(triggered.map((value) => value.replace('-duplicate', ''))).size, 2, 'trigger selection is descriptor-distinct');
assert.equal(events.filter((event) => event.meta?.miniActivate).length, 2, 'each selected potion gets a mini activation projection');

player.stacks.lucky = 25;
ctx.t = 11;
spendStacks(player, 'lucky', 20);
assert.equal(rainbow.alive, true, 'threshold is strict: exactly buffst used does not consume');
spendStacks(player, 'lucky', 1);
assert.equal(rainbow.alive, false, 'using more than buffst consumes the potion');
assert.equal(rainbow.charges, 0, 'consumed potion is empty');
assert.equal(busEvents.at(-1)?.name, 'potion_emptied');
assert.equal(events.at(-1)?.type, 'activate');
assert.equal(events.at(-1)?.meta?.consume, true, 'consumption activation is marked as consume');
assert.equal(triggered.length >= 4, true, 'consumption triggers Rainbow Potion effects before empty activation');

console.log('OK Rainbow Potion source and handler regression');
