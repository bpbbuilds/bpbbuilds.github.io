import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  COMBAT_START_PRIORITY,
  PRIORITY,
  combatStartPriority,
} from '../js/pages/sim/engine/combat-start-priority.js';

const inventory = JSON.parse(fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8'));
const sourceRoot = 'tools/game-extract-full/Items';
const base = {
  Lowest: PRIORITY.Lowest,
  Low: PRIORITY.Low,
  Normal: PRIORITY.Normal,
  High: PRIORITY.High,
  Highest: PRIORITY.Highest,
};

function sourcePriority(file) {
  const source = fs.readFileSync(`${sourceRoot}/${file}`, 'utf8');
  const method = source.match(/func getTriggerPriority\s*\([^)]*\)\s*(?:->[^:]+)?\s*:([\s\S]*?)(?=\nfunc |$)/);
  if (!method) return null;
  const returned = method[1].match(/return Priority\.([A-Za-z]+)(?:\s*\+\s*(\d+))?/);
  assert.ok(returned, `${file}: getTriggerPriority must return a Priority value`);
  return base[returned[1]] + Number(returned[2] || 0);
}

const sourcePriorities = new Map();
for (const [id, info] of Object.entries(inventory.byId || {})) {
  if (!info.file) continue;
  const file = `${sourceRoot}/${info.file}`;
  if (!fs.existsSync(file)) continue;
  const value = sourcePriority(info.file);
  if (value != null) sourcePriorities.set(id, value);
}

for (const [id, expected] of sourcePriorities) {
  assert.equal(
    combatStartPriority(id),
    expected,
    `${id}: simulator combat-start priority matches extracted getTriggerPriority`,
  );
}

for (const [id, actual] of Object.entries(COMBAT_START_PRIORITY)) {
  assert.equal(
    sourcePriorities.get(id),
    actual,
    `${id}: simulator priority map contains only extracted trigger priorities`,
  );
}

console.log(`OK combat-start priority parity: ${sourcePriorities.size} source overrides`);
