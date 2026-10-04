import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import {
  combatStartGemSockets,
  prepareGemSockets,
} from '../js/pages/sim/engine/gem-sockets.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { tickTimedResistances } from '../js/pages/sim/engine/timed-resistance.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(
  catalog
    .map((item) => [item.id, { ...item, shape: item.shape || [[1]] }])
    .filter(([id]) => id),
);

function piece(id, key, side = 'you') {
  const item = byId.get(id);
  return {
    itemId: id,
    placementKey: key,
    name: item?.name || id,
    params: item?.params || {},
    kind: id === 'darkest_lotus' ? 'card' : id === 'elephant_rune' ? 'gem' : 'gadget',
    side,
    alive: true,
    speedScale: 0,
    bonusDamageFactor: 1,
    _revealed: false,
    _revealing: true,
  };
}

function withCombatLog(events, dummy, fn) {
  bindBuffCombatLog({ events, getT: () => 5, dummy });
  try {
    return fn();
  } finally {
    unbindBuffCombatLog();
  }
}

function source(id, file, sceneFile, extendsName) {
  const row = inventory.byId[id];
  assert.ok(row, `${id} has a source inventory row`);
  assert.equal(row.file, file);
  assert.equal(row.sceneFile, sceneFile);
  assert.equal(row.extends, extendsName);
  return row;
}

const emeraldSource = source(
  'chipped_emerald',
  'Gems/Emerald.gd',
  'Gems/ChippedEmerald.tscn',
  'Gem',
);
const rubySource = source(
  'chipped_ruby',
  'Gems/Ruby.gd',
  'Gems/ChippedRuby.tscn',
  'Gem',
);
const sapphireSource = source(
  'chipped_sapphire',
  'Gems/Sapphire.gd',
  'Gems/ChippedSapphire.tscn',
  'Gem',
);
const topazSource = source(
  'chipped_topaz',
  'Gems/Topaz.gd',
  'Gems/ChippedTopaz.tscn',
  'Gem',
);
const lotusSource = source('darkest_lotus', 'DarkestLotus.gd', 'DarkestLotus.tscn', 'Card');
const elephantSource = source(
  'elephant_rune',
  'Exclusive/ElephantRune.gd',
  'Exclusive/ElephantRune.tscn',
  'Gem',
);

assert.deepEqual(emeraldSource.overrides, ['doCooldownEffect']);
assert.deepEqual(rubySource.overrides, ['doCooldownEffect']);
assert.deepEqual(sapphireSource.overrides, ['doCooldownEffect']);
assert.deepEqual(topazSource.overrides, []);
assert.ok(topazSource.sourceMethods.includes('prepareInventory'));
assert.ok(topazSource.sourceMethods.includes('prepareWeapon'));
assert.ok(topazSource.sourceMethods.includes('prepareArmor'));
assert.deepEqual(lotusSource.overrides, ['doRevealEffect']);
assert.ok(elephantSource.overrides.includes('combatStartInventory'));
assert.ok(elephantSource.sourceMethods.includes('prepareArmor'));
assert.ok(elephantSource.sourceMethods.includes('combatStartArmor'));
assert.ok(elephantSource.sourceMethods.includes('hasCooldown'));

for (const id of [
  'chipped_emerald',
  'chipped_ruby',
  'chipped_sapphire',
  'chipped_topaz',
  'darkest_lotus',
  'elephant_rune',
]) {
  assert.equal(getScriptHandler(id)?.handlerId, id, `${id} has an explicit handler`);
}

// Chipped Emerald: give regeneration, then consume/activate. Verify the
// opponent-side context uses the same source path.
{
  const handler = getScriptHandler('chipped_emerald');
  const player = createActor('player');
  const dummy = createActor('dummy');
  const events = [];
  withCombatLog(events, dummy, () =>
    handler.onCooldownEffect(piece('chipped_emerald', 'emerald'), {
      player,
      dummy,
      events,
      rng: () => 0,
      t: 5,
    }),
  );
  assert.equal(player.stacks.regeneration, 1);
  assert.equal(events.at(-1)?.type, 'activate');
  assert.equal(events.at(-1)?.actor, 'player');

  const opponent = createActor('dummy');
  const yourActor = createActor('player');
  const opponentEvents = [];
  // The global combat-log binding always treats the world `dummy` actor as
  // the opponent board.  For an opponent-owned piece, ctx.player is that
  // dummy actor while ctx.dummy is our player actor.
  withCombatLog(opponentEvents, opponent, () =>
    handler.onCooldownEffect(piece('chipped_emerald', 'opp:emerald', 'them'), {
      player: opponent,
      dummy: yourActor,
      events: opponentEvents,
      rng: () => 0,
      t: 5,
    }),
  );
  assert.equal(opponent.stacks.regeneration, 1);
  assert.equal(opponentEvents.at(-1)?.actor, 'dummy');
}

// Chipped Ruby must use the shared effect-damage + nested stealLife helper,
// including effect damage modifiers and side-correct causal events.
{
  const handler = getScriptHandler('chipped_ruby');
  const player = createActor('player');
  const dummy = createActor('dummy');
  player.hp = 100;
  player.effectDmgFactor = 1;
  const events = [];
  withCombatLog(events, dummy, () =>
    handler.onCooldownEffect(piece('chipped_ruby', 'ruby'), {
      player,
      dummy,
      events,
      rng: () => 0,
      t: 5,
    }),
  );
  const damage = events.find((event) => event.type === 'damage' && event.itemId === 'chipped_ruby');
  const heal = events.find((event) => event.type === 'heal' && event.itemId === 'chipped_ruby');
  assert.equal(damage?.amount, 8, 'ruby effect damage receives effect multiplier');
  assert.equal(heal?.amount, 12, 'ruby lifesteal uses post-effect damage × 150%');
  assert.ok(events.indexOf(damage) < events.indexOf(heal));

  const opponent = createActor('dummy');
  const yourActor = createActor('player');
  opponent.hp = 100;
  const opponentEvents = [];
  withCombatLog(opponentEvents, opponent, () =>
    handler.onCooldownEffect(piece('chipped_ruby', 'opp:ruby', 'them'), {
      player: opponent,
      dummy: yourActor,
      events: opponentEvents,
      rng: () => 0,
      t: 5,
    }),
  );
  const opponentDamage = opponentEvents.find((event) => event.type === 'damage' && event.itemId === 'chipped_ruby');
  const opponentHeal = opponentEvents.find((event) => event.type === 'heal' && event.itemId === 'chipped_ruby');
  assert.equal(opponentDamage?.actor, 'dummy');
  assert.equal(opponentDamage?.target, 'player');
  assert.equal(opponentHeal?.actor, 'dummy');
}

// Chipped Sapphire: cold is applied before the one-shot activation and the
// target flips when the item belongs to the opponent board.
{
  const handler = getScriptHandler('chipped_sapphire');
  const player = createActor('player');
  const dummy = createActor('dummy');
  const events = [];
  withCombatLog(events, dummy, () =>
    handler.onCooldownEffect(piece('chipped_sapphire', 'sapphire'), {
      player,
      dummy,
      events,
      rng: () => 0,
      t: 5,
    }),
  );
  assert.equal(dummy.stacks.cold, 2);
  const cold = events.find((event) => event.type === 'debuff' && event.itemId === 'chipped_sapphire');
  const activate = events.find((event) => event.type === 'activate' && event.itemId === 'chipped_sapphire');
  assert.ok(cold && activate && events.indexOf(cold) < events.indexOf(activate));

  const opponent = createActor('dummy');
  const yourActor = createActor('player');
  const opponentEvents = [];
  withCombatLog(opponentEvents, opponent, () =>
    handler.onCooldownEffect(piece('chipped_sapphire', 'opp:sapphire', 'them'), {
      player: opponent,
      dummy: yourActor,
      events: opponentEvents,
      rng: () => 0,
      t: 5,
    }),
  );
  assert.equal(yourActor.stacks.cold, 2);
  const opponentCold = opponentEvents.find(
    (event) => event.type === 'debuff' && event.itemId === 'chipped_sapphire',
  );
  assert.equal(opponentCold?.target, 'player');
}

// Chipped Topaz is prepareInventory, not a combat cooldown: stamina regen is
// installed in the prepare pass and remains a stat/HUD event.
{
  const handler = getScriptHandler('chipped_topaz');
  assert.equal(handler.presenceOnly, true);
  const player = createActor('player');
  const events = [];
  handler.onPrepare(piece('chipped_topaz', 'topaz'), {
    player,
    dummy: createActor('dummy'),
    events,
    t: 0,
  });
  assert.equal(player.staminaRegen, 1.08);
  assert.equal(events[0]?.type, 'stat');
  assert.equal(events[0]?.meta?.stat, 'stamina_regen');
}

// Darkest Lotus uses Card.trigger ordering: next-card state first, then the
// chain-scaled mana/hostile strip, then activate().
{
  const handler = getScriptHandler('darkest_lotus');
  const player = createActor('player');
  const dummy = createActor('dummy');
  dummy.stacks.lucky = 1;
  dummy.stacks.regeneration = 2;
  const lotus = piece('darkest_lotus', 'lotus');
  lotus._chainPos = 2;
  lotus._deckKey = 'deck';
  const deck = { placementKey: 'deck', _cards: [lotus] };
  const events = [];
  withCombatLog(events, dummy, () =>
    handler.onCooldownEffect(lotus, {
      player,
      dummy,
      pieces: [deck, lotus],
      events,
      rng: () => 0,
      t: 5,
    }),
  );
  assert.equal(player.stacks.mana, 8);
  assert.equal(dummy.stacks.lucky + dummy.stacks.regeneration, 0);
  const mana = events.find((event) => event.type === 'buff' && event.itemId === 'darkest_lotus');
  const activate = events.find((event) => event.type === 'activate' && event.itemId === 'darkest_lotus');
  assert.ok(mana && activate && events.indexOf(mana) < events.indexOf(activate));
  assert.equal(lotus._revealed, true);
}

// Elephant Rune inventory grants max health once and consumes; its armor mode
// grants temporary all-debuff resistance and expires after dur_resist.
{
  const handler = getScriptHandler('elephant_rune');
  const player = createActor('player');
  const dummy = createActor('dummy');
  const events = [];
  const elephant = piece('elephant_rune', 'elephant');
  withCombatLog(events, dummy, () =>
    handler.onCombatStart(elephant, { player, dummy, events, t: 2.5 }),
  );
  assert.equal(player.maxHp, 250);
  assert.equal(player.hp, 250);
  const maxHp = events.find((event) => event.meta?.kind === 'maxHp');
  const activate = events.find((event) => event.type === 'activate' && event.itemId === 'elephant_rune');
  assert.ok(maxHp && activate && events.indexOf(maxHp) < events.indexOf(activate));
  assert.equal(elephant.alive, false);

  const [armor] = buildCombatPieces(
    [{ id: 'leather_armor', key: 'armor', x: 0, y: 0, r: 0, gems: ['elephant_rune'] }],
    byId,
  );
  const armorPlayer = createActor('player');
  const armorDummy = createActor('dummy');
  const armorCtx = {
    player: armorPlayer,
    dummy: armorDummy,
    bus: createCombatBus(),
    t: 0,
    itemsById: byId,
    rng: () => 0,
  };
  prepareGemSockets(armor, armorCtx);
  assert.equal(armorPlayer.stackResist.poison, 40);
  assert.equal(armorPlayer.stackResist.blind, 40);
  assert.equal(armorPlayer.stackResist.cold, 40);
  combatStartGemSockets(armor, { ...armorCtx, t: 2.5 });
  assert.equal(armorPlayer.stackResist.poison, 40);
  assert.equal(armorPlayer.stackResist.blind, 40);
  assert.equal(armorPlayer.stackResist.cold, 40);
  tickTimedResistances([armorPlayer], 6.5);
  assert.equal(armorPlayer.stackResist.poison, undefined);
  assert.equal(armorPlayer.stackResist.cold, undefined);
}

console.log('OK Chipped Emerald/Ruby/Sapphire/Topaz, Darkest Lotus, Elephant Rune focused smoke');
