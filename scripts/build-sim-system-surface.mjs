/**
 * Package A: shared combat source surface -> simulator ownership map.
 *
 *   node scripts/build-sim-system-surface.mjs
 *   node scripts/build-sim-system-surface.mjs --check
 *
 * This does not infer parity from a matching name. It makes each reviewed
 * source surface explicit and fails if the extract no longer contains a
 * manifest symbol. `partial` and `unmapped` rows are deliberate findings.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/data/sim-system-surface.json');

/** @typedef {'implemented'|'partial'|'unmapped'|'unsupported'} Disposition */

/**
 * All rows below are shared game systems, not individual item ports. Keep a
 * source reference even when a mode is intentionally unsupported so an
 * extract patch turns into a visible review task.
 */
const SURFACE = [
  {
    id: 'game-combat-transition',
    category: 'lifecycle',
    source: 'Core/Game.gd',
    functions: ['switchToCombat', 'prepareItems', 'activateItems'],
    simOwners: ['js/pages/sim/engine/simulate.js', 'js/pages/sim/engine/combat-start-priority.js'],
    disposition: 'partial',
    note: 'Opening order is source-traced; the complete preparation and end-of-combat graph still needs the scheduler audit.',
  },
  {
    id: 'game-combat-end',
    category: 'lifecycle',
    source: 'Core/Game.gd',
    functions: ['endCombat', 'combatEndDeferred'],
    simOwners: ['js/pages/sim/engine/simulate.js'],
    disposition: 'partial',
    note: 'Simulation ends fights, but source-level cleanup, delayed work, and result ordering need conformance coverage.',
  },
  {
    id: 'game-round-health',
    category: 'round-rules',
    source: 'Core/Game.gd',
    functions: ['getMaxHealthInRound', 'getHealthGain'],
    simOwners: ['js/pages/sim/engine/round-health.js'],
    disposition: 'partial',
    note: 'Round health is modeled; class/mode and live-round validation remain open.',
  },
  {
    id: 'character-lifecycle',
    category: 'character',
    source: 'Core/Character.gd',
    functions: ['prepare', 'combatStart', 'combatEnd', 'death', 'win', 'lose'],
    simOwners: ['js/pages/sim/engine/actor.js', 'js/pages/sim/engine/simulate.js'],
    disposition: 'partial',
    note: 'Opening and basic death paths exist; complete cleanup and same-time death behavior are unproven.',
  },
  {
    id: 'character-tick',
    category: 'timing',
    source: 'Core/Character.gd',
    functions: ['onTick', 'takeFatigueDamage'],
    simOwners: ['js/pages/sim/engine/ticks.js', 'js/pages/sim/engine/fatigue.js'],
    disposition: 'partial',
    note: 'Tick/fatigue logic exists but has no source-complete cadence boundary suite.',
  },
  {
    id: 'character-damage',
    category: 'damage',
    source: 'Core/Character.gd',
    functions: ['dealDamage', 'takeDamage', 'applySpikes', 'applyVampirism'],
    simOwners: ['js/pages/sim/engine/damage.js', 'js/pages/sim/engine/combat-activate.js'],
    disposition: 'partial',
    note: 'Shared damage paths are implemented in part; late hooks, tokens, and all combined phases remain open.',
  },
  {
    id: 'character-health',
    category: 'state',
    source: 'Core/Character.gd',
    functions: ['heal', 'loseHealth', 'giveMaxHealth', 'changeMaxHealthTemporary', 'reincarnate'],
    simOwners: ['js/pages/sim/engine/actor.js', 'js/pages/sim/engine/unhealing.js'],
    disposition: 'partial',
    note: 'Health/heal/Unhealing paths exist; temporary maximum health and reincarnation need source-led tests.',
  },
  {
    id: 'character-stamina',
    category: 'state',
    source: 'Core/Character.gd',
    functions: ['gainStamina', 'useStamina', 'drainStamina', 'gainMaxStaminaTemporary', 'recalculateMaxStamina'],
    simOwners: ['js/pages/sim/engine/actor.js', 'js/pages/sim/engine/actor-stats.js'],
    disposition: 'partial',
    note: 'Core stamina exists; cancellation, timer cadence, and all maximum-change paths need invariant tests.',
  },
  {
    id: 'character-status',
    category: 'state',
    source: 'Core/Character.gd',
    functions: ['makeInvulnerable', 'stun', 'startBattleRage', 'endBattleRage'],
    simOwners: ['js/pages/sim/engine/actor.js', 'js/pages/sim/engine/battle-rage.js'],
    disposition: 'partial',
    note: 'Status helpers exist; stacking/resistance/cleanse interactions are not fully source-audited.',
  },
  {
    id: 'character-stacks',
    category: 'state',
    source: 'Core/Character.gd',
    functions: ['gainStacks', 'gainStacksTemporary', 'loseStacks', 'useStacks'],
    simOwners: ['js/pages/sim/engine/stacks.js', 'js/pages/sim/engine/buff-economy.js', 'js/pages/sim/engine/temp-stacks.js'],
    disposition: 'partial',
    note: 'Shared stack paths are present; every stack event and cleanup permutation needs the invariant suite.',
  },
  {
    id: 'buff-object',
    category: 'state',
    source: 'Core/Buff.gd',
    functions: ['gainStacks', 'gainTemporary', 'loseStacks', 'onTimeout', 'combatEnd'],
    simOwners: ['js/pages/sim/engine/stacks.js', 'js/pages/sim/engine/temp-stacks.js', 'js/pages/sim/engine/buff-economy.js'],
    disposition: 'partial',
    note: 'Caps/resist/reflect are partial; timeout/protection/nullification combinations require source-linked tests.',
  },
  {
    id: 'combat-event',
    category: 'event-contract',
    source: 'Core/CombatEvent.gd',
    functions: ['_init', 'setTarget', 'setParam', 'getDepth', 'asText'],
    simOwners: ['js/pages/sim/sim-events.js', 'js/pages/sim/engine/log-chain.js'],
    disposition: 'partial',
    note: 'Causal ids exist for some paths, but the complete origin/parameter/phase contract is not required by all events.',
  },
  {
    id: 'combat-log',
    category: 'projection',
    source: 'Core/CombatLog.gd',
    functions: ['createEvent', 'logEvent', 'snapshotStack', 'snapshotMetric', 'createEvent_Activation', 'createEvent_Damage'],
    simOwners: ['js/pages/sim/log/sim-log-sentences.js', 'js/pages/sim/engine/buff-log.js', 'js/pages/sim/engine/log-export.js'],
    disposition: 'partial',
    note: 'Selected log/meter sentences are tested; full EventType and snapshot projection equivalence is open.',
  },
  {
    id: 'combat-snapshot',
    category: 'projection',
    source: 'Core/CombatSnapshot.gd',
    functions: ['_init', 'apply'],
    simOwners: ['js/pages/sim/engine/simulate.js', 'js/pages/sim/controls/sim-scrubber.js'],
    disposition: 'partial',
    note: 'Snapshots feed the scrubber but cannot yet restore/replay a full simulation state.',
  },
  {
    id: 'combat-stat-logger',
    category: 'projection',
    source: 'Core/CombatStatLogger.gd',
    functions: ['logCharacterStat', 'logStack', 'logItemMetric', 'getMetricAt'],
    simOwners: ['js/pages/sim/engine/report-status.js', 'js/pages/sim/log/sim-damage-meter.js'],
    disposition: 'partial',
    note: 'The simulator summarizes selected metrics; game-equivalent historic metric state is not fully modeled.',
  },
  {
    id: 'combat-timer',
    category: 'timing',
    source: 'Interface/CombatTimer/CombatTimer.gd',
    functions: ['start', 'getEffectiveTime', 'startFatigue', 'dealFatigueDamage', 'advanceTime'],
    simOwners: ['js/pages/sim/engine/fatigue.js', 'js/pages/sim/engine/simulate.js'],
    disposition: 'partial',
    note: 'Fatigue is modeled, but timer semantics and time advance are an explicit open issue.',
  },
  {
    id: 'item-lifecycle',
    category: 'item-base',
    source: 'Items/Item.gd',
    functions: ['prepare', 'preCombatStart', 'combatStart', 'postCombatStart', 'trigger', 'doCooldownEffect', 'onAfterEffectFinished'],
    simOwners: ['js/pages/sim/engine/simulate.js', 'js/pages/sim/engine/combat-activate.js', 'js/pages/sim/engine/cooldown.js'],
    disposition: 'partial',
    note: 'Opening passes are traced; prepare, signal, consumption, and cleanup coverage remains incomplete.',
  },
  {
    id: 'item-effects',
    category: 'item-base',
    source: 'Items/Item.gd',
    functions: ['giveBlock', 'giveStacks', 'stealStack', 'giveRandomBuffs', 'inflictRandomDebuffs', 'sendCharge', 'chargeReceived'],
    simOwners: ['js/pages/sim/engine/buff-economy.js', 'js/pages/sim/engine/charge-delivery.js', 'js/pages/sim/engine/scripts'],
    disposition: 'partial',
    note: 'The helpers are distributed across ports; a helper-to-event completeness audit is still required.',
  },
  {
    id: 'gem-lifecycle',
    category: 'item-base',
    source: 'Items/Gems/Gem.gd',
    functions: ['prepareInventory', 'prepareWeapon', 'prepareArmor', 'combatStart', 'combatEnd'],
    simOwners: ['js/pages/sim/engine/gems.js', 'js/pages/sim/engine/gem-sockets.js'],
    disposition: 'partial',
    note: 'Socket preparation/start ordering is fixed; inventory modes, gem cooldowns, and combat end still need full coverage.',
  },
  {
    id: 'card-lifecycle',
    category: 'item-base',
    source: 'Items/Card.gd',
    functions: ['prepare', 'preCombatStart', 'getNextCard', 'startActivation', 'trigger', 'combatEnd'],
    simOwners: ['js/pages/sim/engine/scripts/card-chain.js', 'js/pages/sim/engine/pieces.js'],
    disposition: 'partial',
    note: 'Card chain handling exists; reveal/state transitions and full deck semantics need source tests.',
  },
  {
    id: 'chess-board-ai',
    category: 'unsupported-mode',
    source: 'Items/Exclusive/ChessBoard.gd',
    functions: ['doCooldownEffect'],
    simOwners: ['assets/data/sim-intentional-noops.json'],
    disposition: 'unsupported',
    note: 'The simulator intentionally defers Chess Board AI; this must remain visible in coverage and user-facing mode truth.',
  },
];

function sourceText(rel) {
  return fs.readFileSync(path.join(ROOT, 'tools/game-extract-full', rel), 'utf8');
}

function sourceHash(rel) {
  return crypto.createHash('sha256').update(sourceText(rel)).digest('hex');
}

function requireSymbol(text, symbol, rel) {
  if (symbol === '_init') {
    if (/func\s+_init\s*\(/.test(text)) return;
  } else if (new RegExp(`func\\s+${symbol}\\s*\\(`).test(text)) {
    return;
  }
  throw new Error(`Source surface stale: ${rel} has no function ${symbol}`);
}

function functionBody(text, symbol, rel) {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(`^func\\s+${escaped}\\s*\\([^\\n]*`, 'm');
  const match = matcher.exec(text);
  if (!match) throw new Error(`Cannot hash missing function ${rel}:${symbol}`);
  const next = text.slice(match.index + match[0].length).search(/^func\s+|^class\s+|^enum\s+/m);
  return next < 0
    ? text.slice(match.index)
    : text.slice(match.index, match.index + match[0].length + next);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function uniqueMatches(text, expression) {
  return [...new Set([...text.matchAll(expression)].map((match) => match[1]))].sort();
}

function inspectFunction(text, symbol, rel) {
  const body = functionBody(text, symbol, rel);
  return {
    name: symbol,
    bodyHash: sha256(body),
    emittedSignals: uniqueMatches(body, /(?:emit_signal\s*\(|\.emit\s*\()\s*["']([^"']+)["']/g),
    eventTypes: uniqueMatches(body, /(?:Game\.)?EventType\.([A-Za-z0-9_]+)/g),
    logConstants: uniqueMatches(body, /\b(LOG_[A-Z0-9_]+)/g),
  };
}

function parseEnumMembers(text, name) {
  const match = new RegExp(`enum\\s+${name}\\s*\\{([\\s\\S]*?)\\}`, 'm').exec(text);
  if (!match) throw new Error(`Source surface stale: enum ${name} not found`);
  return [...new Set(
    [...match[1].replace(/#.*/g, '').matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\b/gm)]
      .map((entry) => entry[1]),
  )];
}

function allFunctions(text) {
  return [...text.matchAll(/^func\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm)].map((match) => match[1]);
}

const sourceFiles = [...new Set(SURFACE.map((row) => row.source))].sort();
const sourceByFile = new Map(sourceFiles.map((rel) => [rel, sourceText(rel)]));
for (const row of SURFACE) {
  const text = sourceByFile.get(row.source);
  for (const symbol of row.functions) requireSymbol(text, symbol, row.source);
}

const count = (disposition) => SURFACE.filter((row) => row.disposition === disposition).length;
const reviewedFunctions = new Set(SURFACE.flatMap((row) => row.functions.map((name) => `${row.source}:${name}`)));
const sourceFunctionInventory = Object.fromEntries(sourceFiles.map((rel) => [
  rel,
  allFunctions(sourceByFile.get(rel)).map((name) => ({
    name,
    bodyHash: sha256(functionBody(sourceByFile.get(rel), name, rel)),
    reviewed: reviewedFunctions.has(`${rel}:${name}`),
  })),
]));
const unreviewedFunctions = Object.entries(sourceFunctionInventory).flatMap(([source, functions]) =>
  functions.filter((entry) => !entry.reviewed).map((entry) => `${source}:${entry.name}`),
);
const output = {
  schema: 1,
  note: 'Generated Package A shared combat source surface. It records ownership and visible gaps; partial is not a parity claim.',
  source: {
    extractFiles: Object.fromEntries(sourceFiles.map((rel) => [rel, sourceHash(rel)])),
    eventTypes: parseEnumMembers(sourceByFile.get('Core/Game.gd'), 'EventType'),
    functions: sourceFunctionInventory,
  },
  totals: {
    surfaces: SURFACE.length,
    implemented: count('implemented'),
    partial: count('partial'),
    unmapped: count('unmapped'),
    unsupported: count('unsupported'),
    sourceFunctions: reviewedFunctions.size + unreviewedFunctions.length,
    reviewedFunctions: reviewedFunctions.size,
    unreviewedFunctions: unreviewedFunctions.length,
  },
  rows: SURFACE.map((row) => ({
    ...row,
    sourceFunctions: row.functions.map((symbol) => inspectFunction(sourceByFile.get(row.source), symbol, row.source)),
  })),
};

const rendered = `${JSON.stringify(output, null, 2)}\n`;
if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current !== rendered) {
    console.error('FAIL sim-system-surface is stale; run node scripts/build-sim-system-surface.mjs');
    process.exit(1);
  }
  console.log(`OK sim-system-surface: ${output.totals.surfaces} shared surfaces`);
} else {
  fs.writeFileSync(OUT, rendered);
  console.log(JSON.stringify(output.totals, null, 2));
  console.log(`Wrote ${path.relative(ROOT, OUT)}`);
}
