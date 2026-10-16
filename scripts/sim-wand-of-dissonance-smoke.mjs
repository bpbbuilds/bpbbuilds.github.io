import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import { formatLogLine } from '../js/pages/sim/log/sim-log-sentences.js';
import { buildMetricSources } from '../js/pages/sim/log/sim-meter-metrics.js';

const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/WandofDissonance.gd',
  'utf8',
);
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const wand = catalog.find((row) => row.id === 'wand_of_dissonance');
const darkSpell = {
  id: 'dark_spell',
  name: 'Dark Spell',
  displayName: 'Dark Spell',
  type: 'Spell',
  extraTypes: ['Dark'],
  cooldown: 999,
  damageMin: 0,
  damageMax: 0,
  params: {},
  shape: [[1]],
};

assert.equal(inventory.byId.wand_of_dissonance?.file, 'Exclusive/WandofDissonance.gd');
assert.match(source, /func canAffect\(item\):[\s\S]*return item\.hasType\(Type\.Dark\)/);
assert.match(
  source,
  /func onPrepare\(\):[\s\S]*changeEffectDamageFactor\(bonusEffectDmg\)/,
);
assert.match(
  source,
  /func doCooldownEffect\(\):[\s\S]*loseHealth\(healthUsed, self\)[\s\S]*dealEffectDamage\(dam, event\)[\s\S]*getMostStacks\(character\(\), availableBuffs\.keys\(\)\)[\s\S]*giveStacks\(character\(\), buffToGive, amount, event\)[\s\S]*activate\(\)/,
);

const itemsById = new Map([['wand_of_dissonance', wand], [darkSpell.id, darkSpell]]);
const wandFixture = { ...wand, shape: [[1]] };
const fixtureItems = new Map([['wand_of_dissonance', wandFixture], [darkSpell.id, darkSpell]]);
const run = simulateEngine({
  placements: [
    { id: 'wand_of_dissonance', key: 'wand', x: 0, y: 0, r: 0 },
    { id: darkSpell.id, key: 'spell', x: 1, y: 0, r: 0 },
  ],
  itemsById: fixtureItems,
  durationSec: 10,
  seed: 7,
  dummyAttacks: false,
});
const factor = run.events.find(
  (event) => event.itemId === 'wand_of_dissonance' && event.type === 'stat' && event.meta?.stat === 'effect_dmg_factor',
);
assert.ok(factor, 'prepare must apply the Dark Spell effect-damage factor');
assert.equal(factor.amount, 10, '5% effect damage doubles for the linked Spell');
const healthCost = run.events.find(
  (event) => event.itemId === 'wand_of_dissonance' && event.meta?.kind === 'self_health_cost',
);
assert.ok(healthCost, 'cooldown must log the self-health cost');
assert.equal(healthCost.amount, 7);
const effectDamage = run.events.find(
  (event) => event.itemId === 'wand_of_dissonance' && event.meta?.effect === true,
);
assert.ok(effectDamage, 'cooldown must deal effect damage');
assert.equal(effectDamage.amount, 9, '8 base damage scaled by the 10% factor');
assert.equal(effectDamage.meta.parentId, healthCost.meta.eventId);
const buffGrant = run.events.find(
  (event) => event.itemId === 'wand_of_dissonance' && event.type === 'buff' && event.meta?.stack,
);
assert.ok(buffGrant, 'cooldown must grant one of the max-stack buffs');
assert.equal(buffGrant.amount, 3);
assert.equal(buffGrant.meta.parentId, healthCost.meta.eventId);
assert.ok(
  run.events.indexOf(healthCost) < run.events.indexOf(effectDamage) &&
    run.events.indexOf(effectDamage) < run.events.indexOf(buffGrant),
  'source causal order must be health cost, effect damage, then buff',
);
assert.match(formatLogLine(healthCost, { itemsById: fixtureItems }).plain, /Lost 7 health \(Wand of Dissonance\)/);
assert.equal(
  buildMetricSources(run.events, fixtureItems, 'damage').reduce((sum, sourceRow) => sum + sourceRow.total, 0),
  18,
  'self-health costs must not count as Damage Dealt',
);

console.log('OK Wand of Dissonance source prepare/effect chain and engine regression');
