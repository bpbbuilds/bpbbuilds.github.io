import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { takeDamage } from '../js/pages/sim/engine/damage.js';
import { warScythePort } from '../js/pages/sim/engine/scripts/ports-wave-c-scale.js';

const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const itemsById = new Map(catalog.map((item) => [item.id, item]));
const canAffect = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/WarScythe.gd', 'utf8');

assert.match(source, /func\s+canAffect\(item\):[\s\S]*?gainsStack\(Stack\.Poison\)/);
assert.match(source, /func\s+onPrepare\(\):/);
assert.match(source, /func\s+onPreDealDamage_early\(damageRes: DamageResult\):/);
assert.match(source, /opponent\(\)\.getPoison\(\)\s+>=\s+poisonNeeded/);

assert.equal(typeof warScythePort.onPrepare, 'function');
assert.equal(typeof warScythePort.onPreDealDamageEarly, 'function');
assert.equal(warScythePort.onCombatStart, undefined);
assert.equal(warScythePort.onDealtDamage, undefined);

const placements = [
  { id: 'war_scythe', key: 'war', x: 0, y: 0, r: 0 },
  { id: 'poison_dagger', key: 'poison', x: 1, y: 1, r: 0 },
];
const graph = buildBoardGraph(placements, itemsById);
const pieces = buildCombatPieces(placements, itemsById);
const war = pieces.find((piece) => piece.itemId === 'war_scythe');
const poison = pieces.find((piece) => piece.itemId === 'poison_dagger');
assert.ok(war && poison, 'War Scythe fixture pieces should build');
const ctx = {
  t: 1,
  player: createActor('player'),
  dummy: createActor('dummy'),
  events: [],
  graph,
  itemsById,
  canAffect,
  pieces,
  rng: () => 0,
};

warScythePort.onPrepare(war, ctx);
assert.equal(poison.buffPowers.poison, 2, 'War Scythe should add one linked poison power');
assert.equal(war.critSeverity, 2, 'combat pieces should start at game base crit severity');

ctx.dummy.stacks.poison = 5;
warScythePort.onPreDealDamageEarly(war, ctx, { hit: true });
assert.equal(ctx.dummy.stacks.poison, 0, 'War Scythe should spend the poison threshold before damage');
assert.equal(war.critChance, 10, 'War Scythe should add its crit chance before damage');
assert.equal(war.critSeverity, 2.2, 'War Scythe should add 20% critical severity');
assert.ok(ctx.events.some((event) => event.meta?.handler === 'war_scythe'));

ctx.dummy.stacks.poison = 5;
warScythePort.onPreDealDamageEarly(war, ctx, { hit: false });
assert.equal(ctx.dummy.stacks.poison, 5, 'a miss must not consume War Scythe poison');

const defender = createActor('dummy', { maxHp: 100 });
const attacker = createActor('player');
const critical = takeDamage(defender, attacker, {
  amount: 10,
  originPiece: war,
  canMiss: false,
  canCrit: true,
  critChance: 100,
  isAttack: true,
  isMelee: true,
  skipSpikes: true,
  nowT: 0,
  events: [],
  rng: () => 0,
});
assert.equal(critical.critical, true);
assert.equal(critical.damage, 22, 'critical damage should use the live item severity');

console.log('War Scythe simulator parity smoke passed.');
