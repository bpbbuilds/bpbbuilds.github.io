import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Twine.gd', 'utf8');
const itemSource = fs.readFileSync('tools/game-extract-full/Items/Item.gd', 'utf8');
const fedoraSource = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Fedora.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-an-accessories.js', 'utf8');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));

assert.match(source, /func canAffect\(item\):[\s\S]*item\.canActivate\(\)/);
assert.match(source, /func canAffect_secondary\(item\):[\s\S]*item\.isNeutral\(\)/);
assert.match(source, /onready var maxHealth:[\s\S]*int\(getP\("health"\)\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(triggerItem, "activated", "onTriggerItemActivated"\)/);
assert.match(source, /getNumAffectedItems\(Affected\.Secondary\) \* getBaseChance2\(\)/);
assert.match(source, /if rollChance\(totalChance\):/);
assert.match(source, /giveMaxHealth\(maxHealth, event\)[\s\S]*activate\(\)/);
assert.match(itemSource, /func rollChance\(chance = getBaseChance\(\)\) -> bool:\s*return chanceRng\.rollPercent\(applyBonusChance\(chance, 1\)\)/);
assert.match(fedoraSource, /func canAffect_secondary\(item\):[\s\S]*item\.canModifyChance\(\)/);
assert.match(fedoraSource, /item\.addBonusChance\(bonusChance\)/);
assert.match(portSource, /twinePort[\s\S]*onPrepare\(piece, ctx\)/);
assert.match(portSource, /twinePort[\s\S]*onPeerActivated\(listener, activated, ctx\)/);
assert.match(portSource, /getP1\(listener\.params/);

const baseTwine = byId.get('twine');
const weapon = byId.get('wooden_sword');
const neutral = byId.get('shield_of_valor');
assert.ok(baseTwine && weapon && neutral);

const makePiece = (item, placementKey, overrides = {}) => ({
  ...item,
  itemId: item.id,
  placementKey,
  name: item.name,
  alive: true,
  side: 'you',
  params: { ...(item.params || {}) },
  ...overrides,
});

const twineCatalog = {
  ...baseTwine,
  chance: 20,
  chance2: 20,
};
const twine = makePiece(twineCatalog, 'twine', {
  params: { health: 99, p1: 2 },
  chance: 0,
  chance2: 0,
});
const trigger = makePiece({ ...weapon, cooldown: 9 }, 'trigger');
const secondary = makePiece(neutral, 'secondary');
const graph = {
  pieces: new Map([
    ['twine', { key: 'twine', id: 'twine', cells: ['0,0'], affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'secondary' },
    ] }],
    ['trigger', { key: 'trigger', id: 'wooden_sword', cells: ['1,0'], affectCells: [] }],
    ['secondary', { key: 'secondary', id: 'shield_of_valor', cells: ['2,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', 'twine'],
    ['1,0', 'trigger'],
    ['2,0', 'secondary'],
  ]),
};
const player = createActor('player');
const events = [];
const ctx = {
  t: 3,
  player,
  dummy: createActor('dummy'),
  events,
  graph,
  pieces: [twine, trigger, secondary],
  itemsById: new Map([
    ['twine', twineCatalog],
    ['wooden_sword', { ...weapon, cooldown: 9 }],
    ['shield_of_valor', neutral],
  ]),
  canAffect: { rulesById: rules.byId },
  rng: () => 0,
};

const handler = getScriptHandler('twine');
assert.equal(handler?.handlerId, 'twine');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onPeerActivated, 'function');

handler.onPrepare(twine, ctx);
assert.deepEqual([...twine._twineTriggers], ['trigger'], 'Twine listens only to primary can-activate targets');
assert.equal(twine._twineSecondaryCount, 1, 'Twine counts one neutral secondary target');

const beforeMaxHp = player.maxHp;
handler.onPeerActivated(twine, trigger, ctx);
assert.equal(player.maxHp, beforeMaxHp + 2, 'Twine uses source p1 integer health, not a named fallback');
assert.equal(player.hp, player.maxHp, 'Twine fills the temporary max-health gain');
assert.equal(events.at(-1)?.type, 'activate', 'Twine activates after granting max health');
assert.equal(events.at(-1)?.meta?.handler, 'twine');

const beforeIgnored = player.maxHp;
handler.onPeerActivated(twine, secondary, ctx);
assert.equal(player.maxHp, beforeIgnored, 'secondary activation does not trigger Twine');

const zeroCatalog = { ...twineCatalog, chance: 0, chance2: 0 };
const zero = makePiece(zeroCatalog, 'zero-twine', { params: { p1: 2 } });
const zeroCtx = {
  ...ctx,
  player: createActor('player'),
  events: [],
  pieces: [zero, trigger, secondary],
  itemsById: new Map([
    ['twine', zeroCatalog],
    ['wooden_sword', { ...weapon, cooldown: 9 }],
    ['shield_of_valor', neutral],
  ]),
};
handler.onPrepare(zero, zeroCtx);
handler.onPeerActivated(zero, trigger, zeroCtx);
assert.equal(zeroCtx.player.maxHp, 200, 'zero base chances remain inert');
assert.equal(zeroCtx.events.length, 0, 'zero base chances do not activate');

const fedoraCatalog = byId.get('fedora');
assert.ok(fedoraCatalog, 'Fedora catalog row exists');
assert.match(
  portSource,
  /const totalChance = baseChanceOf\(listener, ctx, 'chance'\) \+ n2 \* baseChanceOf\(listener, ctx, 'chance2'\);[\s\S]*rollItemChance\(listener, ctx\.rng, totalChance\)/,
  'Twine must pass its full base total through Item.rollChance parity, including Fedora bonus chance and per-item balanced RNG',
);

const makeFedoraScenario = (withFedora) => {
  const scenarioTwine = makePiece(twineCatalog, withFedora ? 'buffed-twine' : 'plain-twine', {
    params: { health: 2, p1: 2 },
  });
  const scenarioTrigger = makePiece({ ...weapon, cooldown: 9 }, 'smelly-wall');
  const neutralOne = makePiece(neutral, 'neutral-one');
  const neutralTwo = makePiece(neutral, 'neutral-two');
  const fedora = makePiece(fedoraCatalog, 'fedora');
  const pieces = [scenarioTwine, scenarioTrigger, neutralOne, neutralTwo];
  const graphPieces = [
    [scenarioTwine.placementKey, {
      key: scenarioTwine.placementKey,
      id: 'twine',
      cells: ['10,0'],
      affectCells: [
        { cell: '11,0', color: 'primary' },
        { cell: '12,0', color: 'secondary' },
        { cell: '13,0', color: 'secondary' },
      ],
    }],
    [scenarioTrigger.placementKey, { key: scenarioTrigger.placementKey, id: 'wooden_sword', cells: ['11,0'], affectCells: [] }],
    [neutralOne.placementKey, { key: neutralOne.placementKey, id: 'shield_of_valor', cells: ['12,0'], affectCells: [] }],
    [neutralTwo.placementKey, { key: neutralTwo.placementKey, id: 'shield_of_valor', cells: ['13,0'], affectCells: [] }],
  ];
  if (withFedora) {
    pieces.push(fedora);
    graphPieces.push([
      'fedora',
      { key: 'fedora', id: 'fedora', cells: ['14,0'], affectCells: [{ cell: '10,0', color: 'secondary' }] },
    ]);
  }
  const graph = {
    pieces: new Map(graphPieces),
    filled: new Map([
      ['10,0', scenarioTwine.placementKey],
      ['11,0', scenarioTrigger.placementKey],
      ['12,0', neutralOne.placementKey],
      ['13,0', neutralTwo.placementKey],
      ...(withFedora ? [['14,0', 'fedora']] : []),
    ]),
  };
  return {
    twine: scenarioTwine,
    trigger: scenarioTrigger,
    fedora,
    ctx: {
      t: 0,
      player: createActor('player'),
      dummy: createActor('dummy'),
      events: [],
      graph,
      pieces,
      itemsById: new Map([
        ['twine', twineCatalog],
        ['wooden_sword', { ...weapon, cooldown: 9 }],
        ['shield_of_valor', neutral],
        ['fedora', fedoraCatalog],
      ]),
      canAffect: null,
      rng: () => 0.8,
    },
  };
};

const plainScenario = makeFedoraScenario(false);
handler.onPrepare(plainScenario.twine, plainScenario.ctx);
handler.onPeerActivated(plainScenario.twine, plainScenario.trigger, plainScenario.ctx);
assert.equal(
  plainScenario.ctx.events.length,
  0,
  'at a deterministic 80% roll, Twine’s unmodified 20% + 20% + 20% base total does not activate',
);

const fedoraScenario = makeFedoraScenario(true);
const fedoraHandler = getScriptHandler('fedora');
fedoraHandler.onPrepare(fedoraScenario.fedora, fedoraScenario.ctx);
assert.equal(fedoraScenario.twine.bonusChanceMult, 20, 'Fedora applies its +20% chance multiplier to Twine');
handler.onPrepare(fedoraScenario.twine, fedoraScenario.ctx);
assert.equal(fedoraScenario.twine._twineSecondaryCount, 2, 'Twine counts both neutral diamond targets');
handler.onPeerActivated(fedoraScenario.twine, fedoraScenario.trigger, fedoraScenario.ctx);
assert.equal(
  fedoraScenario.ctx.player.maxHp,
  202,
  'Fedora multiplies Twine’s full 60% base total to 72%, matching Item.rollChance(totalChance)',
);
assert.equal(fedoraScenario.twine.chanceRolls, 1, 'Twine uses its per-item balanced chance roll');
assert.equal(fedoraScenario.twine.chanceProcs, 1, 'the 72% Fedora-modified Twine roll succeeds at the deterministic test roll');

console.log('OK Twine source can-affect rules, primary activation listener, neutral secondary chance, Fedora total-chance multiplier, balanced RNG, p1 health, ordering, and zero-safe regression');
