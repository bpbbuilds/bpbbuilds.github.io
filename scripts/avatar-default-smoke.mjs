/**
 * Blob is the default public identity for profiles with no saved choice.
 * An explicit Discord choice remains opt-in and stable.
 *
 *   node scripts/avatar-default-smoke.mjs
 */
import assert from 'node:assert/strict';
import {
  resolveEquippedAvatarUrl,
  resolveIdentityMode,
} from '../js/shared/profile-avatar.js';
import { faceHtml, parseFaceLoadout } from '../js/shared/blob-face.js';
import {
  emptyLoadout,
  parseLoadout,
  serializeLoadout,
} from '../js/pages/u/blob/loadout.js';
import { readYouAvatarMode } from '../js/pages/sim/hud/sim-avatars.js';

const root = '/';

assert.equal(resolveIdentityMode({}), 'blob');
assert.equal(resolveIdentityMode({ equipped_avatar: null }), 'blob');
assert.equal(resolveIdentityMode(null), 'discord');
assert.equal(resolveEquippedAvatarUrl({ avatar_url: 'https://cdn.test/pfp.png' }, root), '/assets/blob/blob-base.png');
assert.equal(resolveIdentityMode({ equipped_avatar: 'discord' }), 'discord');
assert.equal(
  resolveEquippedAvatarUrl({ avatar_url: 'https://cdn.test/pfp.png', equipped_avatar: 'discord' }, root),
  'https://cdn.test/pfp.png',
);
assert.match(faceHtml({ avatar_url: 'https://cdn.test/pfp.png' }, root), /assets\/blob\/blob-base\.png/);
assert.match(
  faceHtml({ avatar_url: 'https://cdn.test/pfp.png', equipped_avatar: 'discord' }, root),
  /https:\/\/cdn\.test\/pfp\.png/,
);

assert.equal(emptyLoadout().base, 'blob');
assert.equal(parseLoadout(null).base, 'blob');
assert.equal(parseLoadout('discord').base, 'discord');
assert.equal(serializeLoadout(parseLoadout(null)).includes('"base":"blob"'), true);
assert.equal(readYouAvatarMode(), 'blob');
assert.equal(parseFaceLoadout('{"v":1,"slots":{}}')?.base, 'blob');

console.log('avatar default smoke: ok');
