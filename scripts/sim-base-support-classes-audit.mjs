import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const read = (file) => fs.readFileSync(`tools/game-extract-full/${file}`, 'utf8');
const doc = fs.readFileSync('docs/sim/sim-base-support-classes.md', 'utf8');
const source = {
  dragonegg: read('Items/DragonEgg.gd'),
  chesspiece: read('Items/Exclusive/Chess/ChessPiece.gd'),
  forestfriend: read('Items/Exclusive/ForestFriend.gd'),
  goldcounter: read('Interface/GoldCounter.gd'),
  rotationspring: read('Items/Exclusive/RotationSpring.gd'),
  food: read('Items/Food.gd'),
  gemsocket: read('Items/GemSocket.gd'),
  itempushzone: read('Items/ItemPushZone.gd'),
  socketsnode: read('Items/SocketsNode.gd'),
  bagborder: read('Items/Tiles/BagBorder.gd'),
};

for (const name of ['DragonEgg', 'ChessPiece', 'ForestFriend', 'GoldCounter', 'RotationSpring', 'Food', 'GemSocket', 'ItemPushZone', 'SocketsNode', 'BagBorder']) {
  assert.ok(doc.includes('`' + name + '`'), `${name} is documented`);
}
assert.match(source.dragonegg, /func shopEntered/);
assert.match(source.chesspiece, /func onPieceCaptured/);
assert.match(source.forestfriend, /addSpeed/);
assert.match(source.goldcounter, /extends "res:\/\/Interface\/MovingCounter.gd"/);
assert.match(source.rotationspring, /extends Sprite/);
assert.match(source.food, /addSpeed\(getNumAffectedItems\(\) \* 0\.1\)/);
assert.match(source.gemsocket, /func onDropGem/);
assert.match(source.itempushzone, /func onBodyEntered/);
assert.match(source.socketsnode, /scale = Vector2.ONE/);
assert.match(source.bagborder, /func onItemPickedUp/);

for (const id of ['amethyst_egg', 'ruby_egg', 'emerald_egg', 'sapphire_egg', 'squirrel_archer']) {
  assert.ok(getScriptHandler(id), `${id} has a combat port`);
}

console.log('OK base/support-class decisions and source evidence');
