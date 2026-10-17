import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/MoreStats.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-start.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'more_stats');
const weaponItem = catalog.find((item) => item.id === 'hero_sword');

assert.ok(sourceItem, 'More Stats: extracted catalog row');
assert.ok(weaponItem, 'More Stats: weapon fixture');
assert.match(source, /func canAffect_global\(item\):[\s\S]*item\.canBeEmpowered\(\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*addBonusDamageFactor\(damageFactor\)[\s\S]*giveMaxHealth\(round\(getP_m\("maxhealth"\) \/ 100\.0 \* character\(\)\.getMaxHealth\(\)\)\)[\s\S]*activate\(\)/);
assert.match(port, /handlerId: 'more_stats'/);
const moreStatsPort = port.match(/const moreStatsPort[\s\S]*?\n\};/u)?.[0] || '';
assert.match(port, /itemHasType\(item, 'weapon'\)/);
assert.match(port, /damageMin|damageMax/);
assert.doesNotMatch(moreStatsPort, /canBeEmpoweredPiece\(o\)/,
  'More Stats: handler must use the source weapon-only predicate');

const handler = getScriptHandler('more_stats');
assert.equal(handler?.handlerId, 'more_stats');

function makeContext(params = sourceItem.params) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const moreStats = {
    itemId: 'more_stats',
    placementKey: 'more-stats',
    name: 'More Stats',
    params: { ...params },
    side: 'you',
    kind: 'skill',
    alive: true,
  };
  const weapon = {
    itemId: 'hero_sword',
    placementKey: 'weapon',
    name: 'Hero Sword',
    side: 'you',
    kind: 'weapon',
    alive: true,
    damageMin: weaponItem.damageMin,
    damageMax: weaponItem.damageMax,
    bonusDamageFactor: 1,
  };
  const pet = {
    itemId: 'fixture_pet',
    placementKey: 'pet',
    name: 'Fixture Pet',
    side: 'you',
    kind: 'pet',
    alive: true,
    damageMin: 8,
    damageMax: 8,
    bonusDamageFactor: 1,
  };
  return {
    t: 0,
    player,
    dummy,
    events: [],
    pieces: [moreStats, weapon, pet],
    itemsById: new Map([
      ['more_stats', sourceItem],
      ['hero_sword', weaponItem],
      ['fixture_pet', {
        id: 'fixture_pet',
        type: 'Pet',
        damageMin: 8,
        damageMax: 8,
      }],
    ]),
  };
}

const ctx = makeContext();
handler.onCombatStart(ctx.pieces[0], ctx);
assert.equal(ctx.player.maxHp, 224,
  'More Stats: source gives rounded 12% temporary max health');
assert.equal(ctx.player.hp, 224,
  'More Stats: max-health gain also raises current health');
assert.equal(ctx.pieces[1].bonusDamageFactor, 1.05,
  'More Stats: source empowers the weapon by the exact 5% factor');
assert.equal(ctx.pieces[2].bonusDamageFactor, 1,
  'More Stats: source does not empower a non-weapon pet');
assert.equal(ctx.events.filter((event) => event.type === 'activate').length, 1,
  'More Stats: combat-start activation is projected once');

const zero = makeContext({ maxhealth: 0, p1: 0, dam: 0, p2: 0 });
handler.onCombatStart(zero.pieces[0], zero);
assert.equal(zero.player.maxHp, 200, 'More Stats: explicit zero max-health bonus is preserved');
assert.equal(zero.pieces[1].bonusDamageFactor, 1,
  'More Stats: explicit zero damage factor is preserved');
assert.equal(zero.events.filter((event) => event.type === 'activate').length, 1,
  'More Stats: zero values do not suppress source activation');

console.log('More Stats source/parity smoke passed.');
