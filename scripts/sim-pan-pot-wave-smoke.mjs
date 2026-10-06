import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor, grantStun } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

const CASES = [
  ['pan', 'Pan.gd'],
  ['phoenix', 'Exclusive/Phoenix.gd'],
  ['piggy_of_riches', 'Exclusive/PiggyofRiches.gd'],
  ['piggybank', 'Piggybank.gd'],
  ['poison_dagger', 'PoisonDagger.gd'],
  ['poison_grenade', 'Exclusive/PoisonGrenade.gd'],
  ['poison_shortbow', 'Exclusive/PoisonShortbow.gd'],
  ['pot', 'Exclusive/Pot.gd'],
];

function piece(id, key, side, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    side,
    name: item?.name || id,
    params: item?.params || {},
    alive: true,
    kind: /weapon/i.test(item?.type || '') ? 'weapon' : 'passive',
    cooldown: item?.cooldown ?? 4,
    triggerTime: item?.cooldown ?? 4,
    baseCooldown: item?.cooldown ?? 4,
    damageMin: item?.damageMin || 2,
    damageMax: item?.damageMax || 2,
    accuracy: item?.accuracy ?? 100,
    staminaCost: item?.staminaCost || 0,
    ...overrides,
  };
}

function graph(source, targets = []) {
  const pieces = new Map([[source.placementKey, {
    key: source.placementKey,
    id: source.itemId,
    cells: [],
    affectCells: targets.map((_, i) => ({ cell: `link-${i}`, color: 'primary' })),
  }]]);
  const filled = new Map();
  targets.forEach((target, i) => {
    pieces.set(target.placementKey, { key: target.placementKey, id: target.itemId, cells: [], affectCells: [] });
    filled.set(`link-${i}`, target.placementKey);
  });
  return { pieces, filled };
}

function context(owner, foe, pieces, board) {
  const bus = createCombatBus();
  owner._combatBus = foe._combatBus = bus;
  const ctx = {
    player: owner, dummy: foe, pieces, graph: board, itemsById: byId, canAffect: null,
    events: [], bus, rng: () => 0, t: 5, round: 5, activatePiece: () => true,
  };
  ctx.notifyPreDealDamageEarly = (attacker, hitCtx, res) =>
    getScriptHandler(attacker.itemId)?.onPreDealDamageEarly?.(attacker, hitCtx, res);
  return ctx;
}

for (const [id, source] of CASES) {
  assert.equal(inventory.byId[id]?.file, source, `${id} exact source alias`);
  assert.equal(getScriptHandler(id)?.handlerId, id, `${id} dedicated runtime handler`);
}

for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy', { maxHp: 100 });
  const foe = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 100 });

  const pan = piece('pan', `${side}:pan`, side, { kind: 'weapon' });
  const food = piece('banana', `${side}:food`, side);
  const panCtx = context(owner, foe, [pan, food], graph(pan, [food]));
  getScriptHandler('pan').onPreCombatStart(pan, panCtx);
  assert.ok((pan.bonusDamage || 0) > 0, `Pan food damage at pre-combat on ${side}`);

  const phoenix = piece('phoenix', `${side}:phoenix`, side, { kind: 'weapon' });
  const phoenixCtx = context(owner, foe, [phoenix], graph(phoenix));
  getScriptHandler('phoenix').onPrepare(phoenix, phoenixCtx);
  owner.hp = 0; owner.dead = true; owner.stacks.heat = 2;
  phoenixCtx.bus.emit('character_damaged', { actor: owner, attacker: foe, t: phoenixCtx.t });
  assert.equal(phoenix._phxUsed, true, `Phoenix arms before combat on ${side}`);
  assert.equal(owner.dead, false, `Phoenix source reincarnation on ${side}`);
  assert.equal(owner.stacks.heat, 0, `Phoenix spends all Heat on ${side}`);

  const riches = piece('piggy_of_riches', `${side}:riches`, side);
  const gemHost = piece('pan', `${side}:gem-host`, side, { gemIds: ['chipped_emerald', 'chipped_ruby'] });
  const richesCtx = context(owner, foe, [riches, gemHost], graph(riches));
  const beforeRiches = owner.maxHp;
  getScriptHandler('piggy_of_riches').onCombatStart(riches, richesCtx);
  assert.ok(owner.maxHp > beforeRiches && !riches.alive, `Piggy of Riches counts socketed gems and consumes on ${side}`);

  const bank = piece('piggybank', `${side}:bank`, side);
  const starter = piece('just_stats', `${side}:starter`, side);
  const bankCtx = context(owner, foe, [bank, starter], graph(bank, [starter]));
  const beforeBank = owner.maxHp;
  getScriptHandler('piggybank').onCombatStart(bank, bankCtx);
  assert.ok(owner.maxHp > beforeBank && !bank.alive, `Piggybank counts start-of-battle items and consumes on ${side}`);

  const dagger = piece('poison_dagger', `${side}:dagger`, side, { kind: 'weapon', damageMin: 2, damageMax: 2 });
  const daggerCtx = context(owner, foe, [dagger], graph(dagger));
  getScriptHandler('poison_dagger').onPrepare(dagger, daggerCtx);
  const hpBeforeStun = foe.hp;
  grantStun(foe, 1, daggerCtx.t, { rng: daggerCtx.rng });
  assert.ok(foe.hp < hpBeforeStun && foe.stacks.poison > 0, `Poison Dagger inherits free stun attack on ${side}`);
  assert.equal(daggerCtx.events.at(-1)?.type, 'activate', `Dagger activates after free attack on ${side}`);

  const grenade = piece('poison_grenade', `${side}:grenade`, side);
  const grenadeCtx = context(owner, foe, [grenade], graph(grenade));
  getScriptHandler('poison_grenade').onPrepare(grenade, grenadeCtx);
  const critBefore = foe.poisonCritChance || 0;
  grantStacks(owner, 'lucky', 99, { originKey: grenade.placementKey, originId: grenade.itemId });
  assert.ok((foe.poisonCritChance || 0) > critBefore, `Poison Grenade prepare listener on ${side}`);
  getScriptHandler('poison_grenade').onCooldownEffect(grenade, grenadeCtx);
  assert.ok(foe.stacks.poison > 0 && owner.stacks.poison > 0 && !grenade.alive, `Poison Grenade effect then consume on ${side}`);

  const shortbow = piece('poison_shortbow', `${side}:shortbow`, side, { kind: 'weapon' });
  const shortbowCtx = context(owner, foe, [shortbow], graph(shortbow));
  getScriptHandler('poison_shortbow').onPreDealDamageEarly(shortbow, shortbowCtx, { hit: true });
  assert.ok(foe.stacks.poison > 0, `Poison Shortbow hit debuff path on ${side}`);

  const pot = piece('pot', `${side}:pot`, side);
  const potion = piece('mana_potion', `${side}:potion`, side);
  const potCtx = context(owner, foe, [pot, potion], graph(pot, [potion]));
  getScriptHandler('pot').onPrepare(pot, potCtx);
  assert.ok((pot.speedScale || 0) > 0, `Pot link speed prepares before combat on ${side}`);
  owner.hp = Math.min(owner.hp, owner.maxHp - 25);
  const hpBeforePotion = owner.hp;
  potCtx.bus.emit('potion_emptied', { piece: potion, t: potCtx.t });
  assert.ok(owner.hp > hpBeforePotion, `Pot reacts to linked potion on ${side}`);
  getScriptHandler('pot').onCooldownEffect(pot, potCtx);
  assert.ok(owner.stacks.heat > 0 && owner.stacks.regeneration > 0 && !pot.alive, `Pot cooldown effect and consume on ${side}`);
}

console.log('OK Pan through Pot source-port wave');
