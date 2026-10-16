import assert from 'node:assert/strict';
import fs from 'node:fs';

import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { effectiveChance } from '../js/pages/sim/engine/chance.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
// The extracted canBlock predicate is represented by catalog block in the sim;
// give this shield fixture its source-visible block capability.
byId.set('wooden_buckler', { ...byId.get('wooden_buckler'), block: 1 });

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Shielded.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ao-skills.js', 'utf8');
const shieldedPort = port.slice(
  port.indexOf('const shieldedSkillPort'),
  port.indexOf('const smellyBarrierPort', port.indexOf('const shieldedSkillPort')),
);

assert.match(source, /extends Item/);
assert.match(source, /func getData\(\):[\s\S]*return boostedShields/);
assert.match(source, /func setData\(data\):[\s\S]*boostedShields = data/);
assert.match(source, /func onBought\(\):[\s\S]*boostedShields = 1/);
assert.match(source, /func canAffect\(item\):[\s\S]*hasType\(Type\.Shield\)[\s\S]*hasType\(Type\.Armor\).*hasCooldown/);
assert.match(source, /func onPrepare\(\):[\s\S]*addBonusChance_additive\(shieldChance, 0\)[\s\S]*addSpeed\(armorSpeed\)/);
assert.match(source, /func onItemRoll\(descr\):[\s\S]*multiplyWeight\(1\.5\)/);
assert.match(source, /func onItemRolled\(descr\):[\s\S]*boostedShields -= 1/);
assert.match(shieldedPort, /onPrepare\(piece, ctx\)/);
assert.match(shieldedPort, /bonusChanceAdd1/);
assert.match(shieldedPort, /getPName\(piece\.params, 'chance'/);
assert.match(shieldedPort, /getPName\(piece\.params, 'speed'/);
assert.doesNotMatch(shieldedPort, /onCombatStart\(piece, ctx\)/);

const piece = (id, placementKey, overrides = {}) => ({
  ...byId.get(id),
  itemId: id,
  placementKey,
  name: byId.get(id)?.name || id,
  params: byId.get(id)?.params || {},
  alive: true,
  kind: id === 'shielded' ? 'passive' : 'armor',
  cooldown: Number(byId.get(id)?.cooldown) || 0,
  speedScale: 0,
  chance: Number(byId.get(id)?.chance) || 30,
  bonusChanceAdd1: 0,
  bonusChanceAdd2: 0,
  ...overrides,
});

const shielded = piece('shielded', 'shielded', {
  params: { chance: 30, p1: 1, speed: 60, p2: 9 },
});
const shield = piece('wooden_buckler', 'shield', { chance: 30 });
const cooldownArmor = piece('holy_armor', 'cooldown-armor', { cooldown: 2.2 });
const passiveArmor = piece('leather_armor', 'passive-armor', { cooldown: 0 });
const graph = {
  pieces: new Map([
    ['shielded', { key: 'shielded', id: 'shielded', cells: [], affectCells: [
      { cell: 'shield-link', color: 'primary' },
      { cell: 'armor-link', color: 'primary' },
      { cell: 'passive-link', color: 'primary' },
    ] }],
    ['shield', { key: 'shield', id: 'wooden_buckler', cells: [], affectCells: [] }],
    ['cooldown-armor', { key: 'cooldown-armor', id: 'holy_armor', cells: [], affectCells: [] }],
    ['passive-armor', { key: 'passive-armor', id: 'leather_armor', cells: [], affectCells: [] }],
  ]),
  filled: new Map([
    ['shield-link', 'shield'],
    ['armor-link', 'cooldown-armor'],
    ['passive-link', 'passive-armor'],
  ]),
};
const ctx = {
  player: {},
  dummy: {},
  pieces: [shielded, shield, cooldownArmor, passiveArmor],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events: [],
  t: 0,
};

const handler = getScriptHandler('shielded');
assert.equal(handler?.handlerId, 'shielded');
assert.equal(typeof handler?.onPrepare, 'function');
handler.onPrepare(shielded, ctx);
assert.equal(shield.bonusChanceAdd1, 30, 'Shielded adds source additive chance to linked Shields');
assert.equal(shield.bonusChanceAdd2, 0, 'Shielded does not add secondary chance');
assert.equal(shield.chance, 30, 'Shielded preserves the target base chance');
assert.equal(effectiveChance(shield, 30), 60, 'additive chance is included in effective block chance');
assert.equal(cooldownArmor.speedScale, 0.6, 'Shielded speeds linked cooldown Armor');
assert.equal(passiveArmor.speedScale, 0, 'Shielded excludes Armor without a cooldown');

console.log('OK Shielded source and prepare regression');
