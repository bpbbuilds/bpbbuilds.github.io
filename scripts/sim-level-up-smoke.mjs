import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/LevelUp.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const data = byId.get('level_up');

assert.equal(inventory.byId.level_up?.file, 'Exclusive/LevelUp.gd');
assert.match(source, /func onPrepare\(\):[\s\S]*Game\.curRound - buyRound[\s\S]*addSpeed\(roundsPassed \* speedPerRound\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveMaxHealth\(getP_m\("maxhealth"\)\)[\s\S]*giveStamina\(stamina\)[\s\S]*giveMana\(mana\)[\s\S]*giveLucky\(luck\)[\s\S]*activate\(\)/);
assert.equal(getScriptHandler('level_up')?.handlerId, 'level_up');

function makeContext(params = data.params) {
  const piece = {
    ...data,
    itemId: 'level_up',
    placementKey: 'level-up',
    name: 'Level Up',
    kind: 'skill',
    side: 'you',
    alive: true,
    speedScale: 0,
    params: { ...params },
  };
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  const events = [];
  player.stamina = 0;
  player._combatBus = bus;
  dummy._combatBus = bus;
  player._eventLog = events;
  dummy._eventLog = [];
  return {
    piece,
    player,
    dummy,
    bus,
    events,
    t: 4,
    round: 8,
    pieces: [piece],
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: byId,
  };
}

const ctx = makeContext();
const handler = getScriptHandler('level_up');
handler.onPrepare(ctx.piece, ctx);
assert.equal(ctx.piece.speedScale, 0.5, 'Level Up adds source speed for rounds passed since purchase');
ctx.piece.paramAdd = { maxhealth: 5 };
ctx.piece.paramMult = { maxhealth: 2 };
assert.equal(handler.onCooldownEffect(ctx.piece, ctx), true);
assert.equal(ctx.player.maxHp, 230, 'Level Up uses the source modified max-health parameter');
assert.equal(ctx.player.hp, 230);
assert.equal(ctx.player.stamina, 1, 'Level Up grants source stamina through the actor cap');
assert.equal(ctx.player.stacks.mana, 1);
assert.equal(ctx.player.stacks.lucky, 1);
assert.ok(ctx.events.some((event) => event.type === 'activate' && event.itemId === 'level_up'));

const zero = makeContext({
  maxhealth: 0,
  p1: 0,
  stamina: 0,
  p2: 0,
  mana: 0,
  p3: 0,
  luck: 0,
  p4: 0,
  speed: 0,
  p5: 0,
  skillround: 3,
  p6: 3,
});
handler.onPrepare(zero.piece, zero);
handler.onCooldownEffect(zero.piece, zero);
assert.equal(zero.player.maxHp, 200, 'Level Up honors explicit zero max health');
assert.equal(zero.player.stamina, 0, 'Level Up honors explicit zero stamina');
assert.equal(zero.player.stacks.mana, 0, 'Level Up honors explicit zero Mana');
assert.equal(zero.player.stacks.lucky, 0, 'Level Up honors explicit zero Lucky');

console.log('OK Level Up source-backed round speed, modified max-health gain, stamina/Mana/Lucky ordering, activation, and zero parameters');
