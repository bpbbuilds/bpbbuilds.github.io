#!/usr/bin/env node

/** Regression contract for Admin Builds uploaded board thumbnails. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const edge = fs.readFileSync(path.join(root, 'supabase/functions/admin-builds/index.ts'), 'utf8');
const thumbs = fs.readFileSync(path.join(root, 'js/pages/builds/board-thumbs.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(/const BUILD_COLS\s*=\s*\n?\s*['"`][^'"`]*\bboard_still_path\b/.test(edge), 'Admin Builds list must preserve board_still_path');
assert(/const hasBakedStill\s*=/.test(thumbs), 'board thumbnail renderer must detect baked stills');
assert(/!placements\.length\s*&&\s*!hasBakedStill/.test(thumbs), 'baked stills must bypass the No board fallback');
assert(/bakedUrl\s*=\s*boardStillPublicUrl\(build\.board_still_path\)/.test(thumbs), 'baked still path must be passed to the board renderer');
console.log('admin builds board thumbnail smoke passed');
