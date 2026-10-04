import assert from 'node:assert/strict';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { takeDamage } from '../js/pages/sim/engine/damage.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const aceSource = inventory.byId.ace_of_spades;
assert.equal(aceSource.file, 'AceofSpades.gd');
assert.equal(aceSource.extends, 'Card');
assert.deepEqual(aceSource.directOverrides, ['doRevealEffect']);
assert.deepEqual(aceSource.inheritedFiles, ['Card.gd', 'Item.gd']);
assert.ok(aceSource.sourceMethods.includes('cardSecondaryEffectActive'));

const puppySource = inventory.byId.armored_courage_puppy;
assert.equal(puppySource.file, 'Exclusive/ArmoredCouragePuppy.gd');
assert.equal(puppySource.extends, 'CouragePuppy');
assert.deepEqual(puppySource.inheritedFiles, ['Exclusive/CouragePuppy.gd', 'Item.gd']);
assert.deepEqual(puppySource.inheritedOverrides, ['doCooldownEffect', 'onPreCombatStart']);
assert.deepEqual(puppySource.sourceSetup.sort(), ['CanTriggerItems', 'CanTriggerSpikes']);

const ace = {
  id: 'ace_of_spades',
  name: 'Ace of Spades',
  type: 'Card',
  cooldown: 1,
  params: { luck: 2, spikes: 3 },
  shape: [[1]],
};
const aceItems = new Map([[ace.id, ace]]);
const aceHandler = getScriptHandler(ace.id);
assert.ok(aceHandler?.onPrepare && aceHandler?.onCooldownEffect);

const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
const first = {
  itemId: ace.id,
  name: ace.name,
  placementKey: 'ace:first',
  _chainPos: 0,
  _deckKey: 'deck',
  _revealed: false,
  params: ace.params,
};
const second = {
  itemId: ace.id,
  name: ace.name,
  placementKey: 'ace:second',
  _chainPos: 1,
  _deckKey: 'deck',
  _revealed: false,
  params: ace.params,
};
const deck = { itemId: 'deck_of_cards', placementKey: 'deck', _cards: [first, second] };
const aceCtx = {
  player,
  dummy,
  pieces: [deck, first, second],
  itemsById: aceItems,
  events,
  t: 0,
  rng: () => 0.5,
};

aceHandler.onPrepare(first, aceCtx);
aceHandler.onCooldownEffect(first, aceCtx);
assert.equal(player.critStacks, 1, 'Ace reveal grants one actor crit token');
assert.equal(first._revealed, true, 'Ace reveal pauses the card until its next chain pass');
assert.equal(events.filter((event) => event.type === 'activate').length, 1);

aceHandler.onPrepare(second, aceCtx);
aceHandler.onCooldownEffect(second, aceCtx);
assert.equal(player.critStacks, 2, 'Each Ace reveal grants exactly one actor crit token');
assert.equal(player.stacks.lucky, 2, 'Odd-chain Ace grants lucky');
assert.equal(player.stacks.spikes, 3, 'Odd-chain Ace grants spikes');
assert.equal(
  events.filter((event) => event.type === 'stat' && event.meta?.stat === 'crit_stacks').length,
  2,
  'Ace token grants are visible to the HUD/stat event stream',
);

const opponentActor = createActor('dummy');
const opponentFirst = {
  itemId: ace.id,
  name: ace.name,
  placementKey: 'opp:ace',
  side: 'them',
  _chainPos: 0,
  _deckKey: 'opp:deck',
  _revealed: false,
  params: ace.params,
};
const opponentDeck = {
  itemId: 'deck_of_cards',
  placementKey: 'opp:deck',
  side: 'them',
  _cards: [opponentFirst],
};
aceHandler.onPrepare(opponentFirst, {
  ...aceCtx,
  player: opponentActor,
  dummy: createActor('player'),
  pieces: [opponentDeck, opponentFirst],
});
aceHandler.onCooldownEffect(opponentFirst, {
  ...aceCtx,
  player: opponentActor,
  dummy: createActor('player'),
  pieces: [opponentDeck, opponentFirst],
});
assert.equal(opponentActor.critStacks, 1, 'Opponent Ace grants its own actor token');

const tokenDefender = createActor('dummy');
const tokenAttacker = createActor('player');
tokenAttacker.critStacks = 1;
const tokenHit = takeDamage(tokenDefender, tokenAttacker, {
  amount: 10,
  canMiss: false,
  canCrit: true,
  critChance: 0,
  isAttack: true,
  isMelee: true,
  rng: () => 0.99,
});
assert.equal(tokenHit.critical, true, 'Crit token forces the next attack to crit');
assert.equal(tokenHit.criticalSource, 'token');
assert.equal(tokenAttacker.critStacks, 0, 'Crit token is consumed by the attack');
assert.equal(tokenHit.damage, 20);

const armored = {
  id: 'armored_courage_puppy',
  name: 'Armored Courage Puppy',
  type: 'Pet',
  cooldown: 1,
  damageMin: 5,
  damageMax: 5,
  params: { p1: 2 },
  shape: [[1]],
};
const armoredItems = new Map([[armored.id, armored]]);
const [armoredPiece] = buildCombatPieces(
  [{ id: armored.id, key: 'armored', x: 0, y: 0, r: 0 }],
  armoredItems,
);
const armoredPlayer = createActor('player');
const armoredDummy = createActor('dummy');
armoredDummy.stacks.spikes = 50;
const armoredEvents = [];
let itemTriggerCount = 0;
armoredPiece._owner = armoredPlayer;
armoredPiece._eventLog = armoredEvents;
const armoredHandler = getScriptHandler(armored.id);
assert.ok(armoredHandler?.onCombatStart && armoredHandler?.onCooldownEffect);
armoredHandler.onCooldownEffect(armoredPiece, {
  player: armoredPlayer,
  dummy: armoredDummy,
  pieces: [armoredPiece],
  allPieces: [armoredPiece],
  itemsById: armoredItems,
  events: armoredEvents,
  t: 0,
  rng: () => 0.5,
  notifyDealtDamage: () => {
    itemTriggerCount += 1;
  },
});
assert.equal(armoredPlayer.hp, armoredPlayer.maxHp, 'Armored puppy damage does not trigger spikes');
assert.equal(itemTriggerCount, 0, 'Armored puppy damage does not trigger item listeners');

const supportPet = {
  id: 'support_pet',
  name: 'Support Pet',
  type: 'Pet',
  cooldown: 999,
  damageMin: 0,
  damageMax: 0,
  params: {},
  shape: [[1]],
};
const puppyRun = simulateEngine({
  placements: [
    { id: armored.id, key: 'armored', x: 0, y: 0, r: 0 },
    { id: supportPet.id, key: 'pet', x: 1, y: 0, r: 0 },
  ],
  itemsById: new Map([[armored.id, armored], [supportPet.id, supportPet]]),
  durationSec: 6,
  seed: 3,
  dummyAttacks: false,
});
const puppyDamage = puppyRun.events.find(
  (event) => event.type === 'damage' && event.itemId === armored.id && event.actor === 'player',
);
assert.ok(puppyDamage, 'Armored Puppy must strike in a real engine run');
assert.equal(puppyDamage.amount, 7, 'Armored Puppy inherits Courage Puppy bonus damage per linked pet');

console.log('OK Ace of Spades / Armored Courage Puppy focused smoke');
