import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import {
  bindBuffPowerPieces,
  unbindBuffPowerPieces,
} from '../js/pages/sim/engine/buff-power.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const source = fs.readFileSync('tools/game-extract-full/Items/ShieldofValor.gd', 'utf8');
const shieldSource = fs.readFileSync('tools/game-extract-full/Items/Shield.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ao-shields.js', 'utf8');
const valorPort = port.slice(
  port.indexOf('const shieldOfValorPort'),
  port.indexOf('const spikedShieldPort', port.indexOf('const shieldOfValorPort')),
);
const registerShield = port.slice(
  port.indexOf('function registerShield'),
  port.indexOf('const frozenBucklerPort'),
);

assert.match(source, /extends Shield/);
assert.match(source, /onready var blockFactor = getP3\(\) \/ 100\.0/);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.canBlock\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*giveBuffPower\(Game\.EventType\.Block, blockFactor\)/);
assert.match(source, /func afterBlock\(\):[\s\S]*drainStamina\(getP2\(\)[\s\S]*activate\(\)/);
assert.match(shieldSource, /func afterBlock\(\):[\s\S]*pass/);
assert.match(valorPort, /onPrepare\(piece, ctx\)/);
assert.match(valorPort, /giveBuffPower\(o, 'block'/);
assert.doesNotMatch(valorPort, /o\.blockGrant = Math\.round/);
assert.match(valorPort, /registerShield\(piece, ctx, \{\}\)/);
assert.match(registerShield, /drainStamina/);
assert.doesNotMatch(registerShield, /tryUseStamina/);
assert.match(registerShield, /getP2\(piece\.params/);

const piece = (id, placementKey, overrides = {}) => ({
  ...byId.get(id),
  itemId: id,
  placementKey,
  name: byId.get(id)?.name || id,
  params: byId.get(id)?.params || {},
  alive: true,
  kind: id === 'shield_of_valor' || id === 'wooden_buckler' ? 'armor' : 'gadget',
  chance: byId.get(id)?.chance ?? 30,
  blockGrant: Number(byId.get(id)?.block) || 0,
  ...overrides,
});

const valor = piece('shield_of_valor', 'valor', {
  params: { block: 999, p1: 14, stamina: 9, p2: 0.7, p3: 30 },
});
const holyArmor = piece('holy_armor', 'holy-armor', { blockGrant: 65 });
const graph = {
  pieces: new Map([
    ['valor', { key: 'valor', id: 'shield_of_valor', cells: [], affectCells: [
      { cell: 'holy-link', color: 'primary' },
    ] }],
    ['holy-armor', { key: 'holy-armor', id: 'holy_armor', cells: [], affectCells: [] }],
  ]),
  filled: new Map([['holy-link', 'holy-armor']]),
};
const player = createActor('player');
const events = [];
const ctx = {
  player,
  dummy: createActor('dummy'),
  pieces: [valor, holyArmor],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  t: 2,
  rng: () => 0,
};

const handler = getScriptHandler('shield_of_valor');
assert.equal(handler?.handlerId, 'shield_of_valor');
assert.equal(typeof handler?.onPrepare, 'function');
handler.onPrepare(valor, ctx);
assert.equal(holyArmor.buffPowers.block, 1.3, 'p3 applies Block buff power to linked blockers');
assert.equal(holyArmor.blockGrant, 65, 'prepare does not mutate the target static block field');

bindBuffPowerPieces([holyArmor]);
grantStacks(player, 'block', 10, { originKey: holyArmor.placementKey, originId: holyArmor.itemId });
assert.equal(player.block, 13, 'future Block grants are scaled by the target buff power');
unbindBuffPowerPieces();

handler.onCombatStart(valor, ctx);
assert.equal(player._shields.length, 1);
assert.equal(player._shields[0].chance, 30);
player.stamina = 0.5;
player._simT = 4.25;
player._eventLog = events;
player._staminaItem = valor;
player._shields[0].afterBlock({});
assert.equal(player.stamina, 0, 'afterBlock drains available stamina without a sufficient-stamina gate');
assert.equal(events.at(-1)?.type, 'activate', 'Shield of Valor activates after its stamina drain');

const zeroValor = piece('shield_of_valor', 'valor-zero', { chance: 0 });
const zeroCtx = { ...ctx, pieces: [zeroValor], events: [] };
handler.onCombatStart(zeroValor, zeroCtx);
assert.equal(zeroCtx.player._shields.at(-1)?.chance, 0, 'explicit zero block chance is preserved');

console.log('OK Shield of Valor source and shield lifecycle regression');
