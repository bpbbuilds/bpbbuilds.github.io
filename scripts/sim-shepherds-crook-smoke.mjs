import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/ShepherdsCrook.gd',
  'utf8',
);
const port = fs.readFileSync(
  'js/pages/sim/engine/scripts/ports-ap-aura.js',
  'utf8',
);
const crookPort = port.slice(
  port.indexOf('const shepherdsCrookPort'),
  port.indexOf('const manananaPort', port.indexOf('const shepherdsCrookPort')),
);

assert.match(source, /extends Item/);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.canBeEmpowered\(\)/);
assert.match(
  source,
  /func onPrepare\(\):[\s\S]*changeBuffProtectionChance\(getChance\(\)\)[\s\S]*changeResistChance\(Game\.EventType\.Blind, getChance2\(\)\)[\s\S]*changeResistChance\(Game\.EventType\.Cold, getChance2\(\)/,
);
assert.match(
  source,
  /func onCombatStart\(\):[\s\S]*getAffectedItems\(\)[\s\S]*addBonusDamage\(getP1\(\)\)[\s\S]*activate\(\)/,
);
assert.match(crookPort, /onPrepare\(piece, ctx\)/);
assert.match(crookPort, /stackResist\.blind/);
assert.match(crookPort, /stackResist\.cold/);
assert.match(crookPort, /canBeEmpoweredPiece/);
assert.match(crookPort, /getPName\(piece\.params, 'dam', getP1\(/);
assert.match(crookPort, /pushActivate/);
assert.ok(
  crookPort.indexOf('auraDamage(') < crookPort.indexOf('pushActivate('),
  'Shepherds Crook activates after applying its damage aura',
);
assert.match(crookPort, /piece\.chance != null/);
assert.match(crookPort, /piece\.chance2 != null/);

const itemsById = new Map([
  [
    'shepherds_crook',
    { id: 'shepherds_crook', type: 'Accessory', chance: 35, chance2: 50 },
  ],
  [
    'wooden_sword',
    { id: 'wooden_sword', type: 'Weapon', damageMin: 4, damageMax: 8 },
  ],
  ['wooden_buckler', { id: 'wooden_buckler', type: 'Shield', block: 8 }],
]);
const piece = {
  itemId: 'shepherds_crook',
  placementKey: 'crook',
  name: 'Shepherds Crook',
  kind: 'accessory',
  chance: 35,
  chance2: 50,
  params: { dam: 3, p1: 1 },
};
const empowered = {
  itemId: 'wooden_sword',
  placementKey: 'sword',
  name: 'Wooden Sword',
  kind: 'weapon',
  damageMin: 4,
  damageMax: 8,
  bonusDamage: 0,
};
const notEmpowered = {
  itemId: 'wooden_buckler',
  placementKey: 'buckler',
  name: 'Wooden Buckler',
  kind: 'shield',
  damageMin: 0,
  damageMax: 0,
  bonusDamage: 0,
};
const player = createActor('player');
const ctx = {
  t: 7,
  player,
  events: [],
  pieces: [piece, empowered, notEmpowered],
  itemsById,
  graph: {
    pieces: new Map([
      [
        'crook',
        {
          key: 'crook',
          id: 'shepherds_crook',
          cells: ['0,0'],
          affectCells: [
            { cell: '1,0', color: 'primary' },
            { cell: '2,0', color: 'primary' },
          ],
        },
      ],
      ['sword', { key: 'sword', id: 'wooden_sword', cells: ['1,0'], affectCells: [] }],
      ['buckler', { key: 'buckler', id: 'wooden_buckler', cells: ['2,0'], affectCells: [] }],
    ]),
    filled: new Map([
      ['0,0', 'crook'],
      ['1,0', 'sword'],
      ['2,0', 'buckler'],
    ]),
  },
  canAffect: {
    rulesById: {
      shepherds_crook: { primary: { op: 'canBeEmpowered' } },
    },
  },
};

const handler = getScriptHandler('shepherds_crook');
assert.equal(handler?.handlerId, 'shepherds_crook');
handler.onPrepare(piece, ctx);
assert.equal(player.buffCleanseProtectChance, 35);
assert.equal(player.stackResist.blind, 50);
assert.equal(player.stackResist.cold, 50);

handler.onCombatStart(piece, ctx);
assert.equal(empowered.bonusDamage, 3, 'only the Empower-eligible link receives getP1 damage');
assert.equal(notEmpowered.bonusDamage, 0, 'non-Empowerable links are ignored');
assert.equal(ctx.events.at(-1)?.type, 'activate', 'activation follows the damage aura');

const zeroPiece = {
  ...piece,
  placementKey: 'crook-zero',
  chance: 0,
  chance2: 0,
};
const zeroPlayer = createActor('player');
const zeroCtx = { ...ctx, player: zeroPlayer, events: [], pieces: [zeroPiece] };
handler.onPrepare(zeroPiece, zeroCtx);
assert.equal(zeroPlayer.buffCleanseProtectChance, 0, 'explicit zero chance is not replaced by catalog chance');
assert.equal(zeroPlayer.stackResist.blind, 0, 'explicit zero Blind resistance is preserved');
assert.equal(zeroPlayer.stackResist.cold, 0, 'explicit zero Cold resistance is preserved');

console.log('OK Shepherds Crook source and handler regression');
