import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import { tickTimedResistances } from '../js/pages/sim/engine/timed-resistance.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync(
  'tools/game-extract-full/Items/EvilCap.gd',
  'utf8',
);
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /opponent\(\)\.reduceHealingEfficiency\(getP3\(\) \/ 100\.0\)/);
assert.match(source, /character\(\)\.changeDamageResistance\(damReduction\)/);
assert.match(source, /opponent\(\)\.changeBuffNullifyChances\(getChance\(\)\)/);
assert.match(source, /buffTimer\.start\(getP_m\("dur"\)\)/);
assert.match(source, /buffsActive \+= 1/);
assert.match(source, /func buffEnded\(\)/);
assert.match(source, /character\(\)\.changeDamageResistance\( - damReduction\)/);

const item = byId.get('evil_cap');
assert.equal(item?.chance, 15, 'catalog nullify chance');
assert.equal(getScriptHandler('evil_cap')?.handlerId, 'evil_cap');

function makeContext({ chance = 15, params = item.params } = {}) {
  const piece = {
    ...item,
    itemId: 'evil_cap',
    placementKey: 'evil-cap',
    name: item.name,
    kind: 'passive',
    side: 'you',
    alive: true,
    params: { ...params },
    chance,
  };
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const ctx = {
    t: 2.5,
    player,
    dummy,
    events: [],
    bus: createCombatBus(),
    itemsById: new Map([
      ['evil_cap', { ...item, chance }],
    ]),
    rng: () => 0,
  };
  return { piece, player, dummy, ctx };
}

const handler = getScriptHandler('evil_cap');
assert.equal(typeof handler?.onPrepare, 'function', 'source onPrepare is ported');
assert.equal(typeof handler?.onPreCombatStart, 'function', 'source onPreCombatStart is ported');
assert.equal(typeof handler?.onCombatStart, 'function', 'source onCombatStart is ported');

{
  const { piece, player, dummy, ctx } = makeContext();
  handler.onPrepare(piece, ctx);
  assert.equal(dummy._healAmp, -0.3, 'opponent healing efficiency is reduced');
  assert.equal(dummy.unhealing, 0, 'healing reduction is not unhealing damage');
  assert.equal(player._healAmp, 0, 'owner healing is unchanged');

  handler.onPreCombatStart(piece, ctx);
  assert.equal(player.damageResistancePct, 25, 'damage resistance begins in pre-combat');
  assert.equal(dummy.damageResistancePct, 0, 'opponent is not given resistance');

  handler.onCombatStart(piece, ctx);
  assert.equal(dummy.buffNullifyChance, 15, 'opponent receives the source nullify chance');
  assert.equal(piece._evilBuffsActive, 1, 'buff timer state is active');
  assert.equal(ctx.events.at(-1)?.label, 'Helmet: Evil Cap', 'activation projects helmet label');

  tickTimedResistances([player, dummy], 7.5);
  assert.equal(player.damageResistancePct, 0, 'damage resistance ends at source duration');
  assert.equal(piece._evilBuffsActive, 0, 'buff timer state ends with resistance');
}

{
  const { piece, player, dummy, ctx } = makeContext({
    chance: 0,
    params: { damagereduction: 0, p1: 0, dur: 0, p2: 0, healreduction: 0, p3: 0 },
  });
  handler.onPrepare(piece, ctx);
  handler.onPreCombatStart(piece, ctx);
  handler.onCombatStart(piece, ctx);
  assert.equal(dummy._healAmp, 0, 'typed zero healing reduction remains zero');
  assert.equal(dummy.buffNullifyChance, 0, 'typed zero chance remains zero');
  assert.equal(player.damageResistancePct, 0, 'typed zero resistance remains zero');
  assert.equal(piece._evilBuffsActive, 1, 'zero duration still records the source start state');
}

{
  const run = simulateEngine({
    placements: [{ id: 'evil_cap', key: 'evil', x: 0, y: 0, r: 0 }],
    itemsById: byId,
    durationSec: 8,
    dummyAttacks: false,
  });
  const start = run.snapshots.find((snapshot) => snapshot.t === 2.5);
  const end = run.snapshots.at(-1);
  assert.equal(start?.dummy?.healAmp, -0.3, 'full engine retains opponent healing reduction');
  assert.equal(start?.dummy?.unhealing, 0, 'full engine does not project unhealing');
  assert.equal(start?.player?.combatStats?.damage_resistance, 25, 'full engine projects timed resistance');
  assert.equal(end?.player?.combatStats?.damage_resistance, 0, 'full engine expires timed resistance');
  assert.ok(
    run.events.some((event) => event.itemId === 'evil_cap' && event.label === 'Helmet: Cap of Discomfort'),
    'full engine logs Evil Cap as a helmet activation',
  );
}

console.log('OK Evil Cap source and regression smoke');
