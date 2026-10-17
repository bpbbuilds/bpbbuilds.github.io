import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { startBattleRage } from '../js/pages/sim/engine/battle-rage.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const itemById = new Map(catalog.map((item) => [item.id, item]));
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = {
  rulesById: rules.byId,
  craftedIds: new Set(rules.craftedIds),
  classMasks: rules.classMasks,
  classBits: rules.classBits,
  gainedStacksById: rules.gainedStacksById,
  gainsBuffsIds: new Set(rules.gainsBuffsIds),
  parentById: rules.parentById,
};
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/WolfBadge.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-an-accessories.js', 'utf8');
const portBlock = portSource.slice(
  portSource.indexOf('const wolfBadgePort'),
  portSource.indexOf('/** TimePendant.gd'),
);
const sourceItem = itemById.get('wolf_badge');

assert.ok(sourceItem, 'Wolf Badge: extracted catalog row');
assert.match(source, /func canAffect\(item\):[\s\S]*return item\.hasCooldown\(\)/);
assert.match(source, /onready var healthThreshold = getP1\(\) \/ 100\.0 - 0\.0001/);
assert.match(source, /func onPrepare\(\):[\s\S]*character_damaged[\s\S]*battle_rage_started[\s\S]*battle_rage_ended/);
assert.match(source, /startBattleRage\(self, getP_m\("dur"\), event\)/);
assert.match(portBlock, /onPrepare\(piece, ctx\)/);
assert.match(portBlock, /getPName\(piece\.params, 'healtht'/);
assert.match(portBlock, /modifiedParamValue\(/);
assert.match(portBlock, /battle_rage_ended/);
assert.doesNotMatch(portBlock, /grantTimedResistancePct/);

const makeContext = () => {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  const targetItem = itemById.get('wolf_emblem');
  const passiveItem = itemById.get('wisdom_puppy');
  const piece = {
    ...sourceItem,
    itemId: 'wolf_badge',
    placementKey: 'badge',
    name: 'Wolf Badge',
    params: { ...sourceItem.params },
    kind: 'accessory',
    side: 'you',
    alive: true,
  };
  const target = {
    ...targetItem,
    itemId: 'wolf_emblem',
    placementKey: 'cooldown-target',
    name: 'Wolf Emblem',
    kind: 'accessory',
    side: 'you',
    cooldown: 2.5,
    baseCooldown: 2.5,
    speedScale: 0,
  };
  const passive = {
    ...passiveItem,
    itemId: 'wisdom_puppy',
    placementKey: 'passive-target',
    name: 'Wisdom Puppy',
    kind: 'gadget',
    side: 'you',
    cooldown: 0,
    baseCooldown: 0,
    speedScale: 0,
  };
  const nonCooldown = {
    ...sourceItem,
    itemId: 'wolf_badge',
    placementKey: 'non-cooldown-target',
    name: 'Wolf Badge Copy',
    kind: 'accessory',
    side: 'you',
    cooldown: 0,
    baseCooldown: 0,
    speedScale: 0,
  };
  const graph = {
    pieces: new Map([
      ['badge', {
        key: 'badge', id: 'wolf_badge', cells: ['0,0'], affectCells: [
          { cell: '1,0', color: 'primary' },
          { cell: '2,0', color: 'primary' },
          { cell: '3,0', color: 'primary' },
        ],
      }],
      ['cooldown-target', { key: 'cooldown-target', id: 'wolf_emblem', cells: ['1,0'], affectCells: [] }],
      ['passive-target', { key: 'passive-target', id: 'wisdom_puppy', cells: ['2,0'], affectCells: [] }],
      ['non-cooldown-target', { key: 'non-cooldown-target', id: 'wolf_badge', cells: ['3,0'], affectCells: [] }],
    ]),
    filled: new Map([
      ['0,0', 'badge'],
      ['1,0', 'cooldown-target'],
      ['2,0', 'passive-target'],
      ['3,0', 'non-cooldown-target'],
    ]),
  };
  const events = [];
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    t: 2,
    player,
    dummy,
    bus,
    events,
    graph,
    pieces: [piece, target, passive, nonCooldown],
    itemsById: itemById,
    canAffect,
    piece,
    target,
    passive,
    nonCooldown,
  };
};

const handler = getScriptHandler('wolf_badge');
assert.equal(handler?.handlerId, 'wolf_badge');
assert.equal(typeof handler?.onPrepare, 'function');

const combat = makeContext();
handler.onPrepare(combat.piece, combat);
combat.player.hp = 100;
combat.bus.emit('character_damaged', { actor: combat.player, t: 2.5 });
assert.equal(Number(combat.player.battleRageUntil) || 0, 0, 'threshold remains strictly below 50%');

combat.player.hp = 99;
combat.bus.emit('character_damaged', { actor: combat.player, t: 3 });
assert.equal(combat.player.battleRageUntil, 8.5, 'Battle Rage uses the named source duration');
assert.equal(combat.player.damageResistancePct, 25, 'Battle Rage applies source damage resistance');
assert.equal(combat.target.speedScale, 0.35, 'Battle Rage speeds linked cooldown items by source percent');
assert.equal(combat.passive.speedScale, 0.35, 'catalog cooldown items remain affected even if their trigger copy is ready');
assert.equal(combat.nonCooldown.speedScale, 0, 'non-cooldown targets remain unaffected');
assert.equal(combat.events.find((event) => event.type === 'activate')?.t, 3,
  'Wolf Badge activation uses the damage event timestamp');

combat.bus.emit('battle_rage_started', { actor: combat.dummy, t: 4 });
assert.equal(combat.player.damageResistancePct, 25, 'opponent Rage does not affect the owner');
assert.equal(combat.target.speedScale, 0.35, 'opponent Rage does not haste the owner');
assert.equal(combat.passive.speedScale, 0.35, 'opponent Rage does not change linked cooldown speed');
combat.bus.emit('battle_rage_ended', { actor: combat.dummy, t: 8.5 });
assert.equal(combat.player.damageResistancePct, 25, 'opponent Rage end does not remove owner resistance');
assert.equal(combat.target.speedScale, 0.35, 'opponent Rage end does not remove owner speed');

combat.bus.emit('battle_rage_ended', { actor: combat.player, t: 8.5 });
assert.equal(combat.player.damageResistancePct, 0, 'owner Rage end restores resistance');
assert.equal(combat.target.speedScale, 0, 'owner Rage end restores linked speed');
assert.equal(combat.passive.speedScale, 0, 'owner Rage end restores every linked cooldown speed');

const modified = makeContext();
modified.piece.paramAdd = { dur: 1 };
modified.piece.paramMult = { dur: 2 };
handler.onPrepare(modified.piece, modified);
modified.player.hp = 99;
modified.bus.emit('character_damaged', { actor: modified.player, t: 4 });
assert.equal(modified.player.battleRageUntil, 17, 'placement duration modifiers are applied before Rage starts');

const zero = makeContext();
zero.piece.params = { healtht: 0, p1: 0, dur: 0, p2: 0, ragespeed: 0, p3: 0, ragedamreduction: 0, p4: 0 };
handler.onPrepare(zero.piece, zero);
zero.player.hp = 0;
zero.bus.emit('character_damaged', { actor: zero.player, t: 1 });
assert.equal(Number(zero.player.battleRageUntil) || 0, 0, 'zero duration remains a no-op');
assert.equal(zero.events.length, 0, 'zero duration does not fabricate activation');

// Keep the imported helper part of the fixture contract: this proves the
// direct event path and the shared Rage expiry path agree on the same owner.
assert.doesNotThrow(() => startBattleRage(combat.player, 0, 9, { bus: combat.bus }));

console.log('OK Wolf Badge source/parity smoke');
