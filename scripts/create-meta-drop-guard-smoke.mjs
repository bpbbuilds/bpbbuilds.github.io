import assert from 'node:assert/strict';
import { hasBoardItems } from '../js/pages/create/meta-drop-guards.js';

assert.equal(hasBoardItems([]), false);
assert.equal(hasBoardItems([{ id: 'wooden_sword' }]), true);
assert.equal(hasBoardItems(null), false);

console.log('create meta drop guard smoke: ok');
