/**
 * Phase 243 living census: generic AUTO_PORTS MAP patterns + cd-then-consume.
 * Run: node scripts/build-sim-ap-census.mjs  (after npm run sim-inventory)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractPortHandlerIds } from './lib/sim-port-handler-ids.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const autoSrc = fs.readFileSync(path.join(root, 'js/pages/sim/engine/scripts/auto-ports.js'), 'utf8');
const scriptsDir = path.join(root, 'js/pages/sim/engine/scripts');

const start = autoSrc.indexOf('const MAP = {');
const end = autoSrc.indexOf('\n};', start);
const MAP = {};
for (const m of autoSrc.slice(start, end + 3).matchAll(/"([^"]+)": "([^"]+)"/g)) {
  MAP[m[1]] = m[2];
}

/** HAND overwrite list emitted into auto-ports.js (ids with PORT_HANDLERS only). */
const handMatch = autoSrc.match(/for \(const id of \[([^\]]+)\]\) \{\s*\n  if \(PORT_HANDLERS\[id\]\)/);
const HAND = new Set();
if (handMatch) {
  for (const m of handMatch[1].matchAll(/"([^"]+)"/g)) HAND.add(m[1]);
}

const portIds = extractPortHandlerIds(scriptsDir);

function hasWinningPort(id, pattern) {
  return pattern === 'hand_port' && portIds.has(id);
}

const consume = JSON.parse(
  fs.readFileSync(path.join(root, 'assets/data/sim-cd-then-consume.json'), 'utf8'),
);
const consumeSet = new Set(consume.ids || []);

const GENERIC_CD = new Set([
  'basic_cd',
  'cd_lucky',
  'cd_mana',
  'cd_regen',
  'cd_heat',
  'cd_cold',
  'cd_poison',
  'cd_activate',
]);

/** @type {Record<string, string[]>} */
const genericByPattern = {};
/** @type {string[]} */
const handPortMissing = [];

for (const [id, pattern] of Object.entries(MAP)) {
  const winning = hasWinningPort(id, pattern);
  if (pattern === 'hand_port') {
    if (!portIds.has(id)) handPortMissing.push(id);
    continue;
  }
  if (winning) continue;
  (genericByPattern[pattern] ||= []).push(id);
}

for (const k of Object.keys(genericByPattern)) genericByPattern[k].sort();
handPortMissing.sort();

const genericCd = [];
const genericOther = [];
for (const [pattern, ids] of Object.entries(genericByPattern)) {
  if (GENERIC_CD.has(pattern)) genericCd.push(...ids.map((id) => ({ id, pattern })));
  else genericOther.push(...ids.map((id) => ({ id, pattern })));
}

const consumeRows = [...consumeSet].sort().map((id) => {
  const pattern = MAP[id] || '(not in MAP)';
  const winning = pattern === '(not in MAP)' ? portIds.has(id) : hasWinningPort(id, pattern);
  const generic = Boolean(genericByPattern[pattern]?.includes(id));
  return {
    id,
    pattern,
    hasWinningPort: winning,
    genericAuto: generic || (pattern === 'hand_port' && !winning),
  };
});

const payload = {
  builtAt: new Date().toISOString(),
  mapSize: Object.keys(MAP).length,
  handListSize: HAND.size,
  portIdMentions: portIds.size,
  genericCdCount: genericCd.length,
  genericOtherCount: genericOther.length,
  handPortMissingCount: handPortMissing.length,
  cdThenConsumeCount: consumeRows.length,
  genericByPattern,
  handPortMissing,
  cdThenConsume: consumeRows,
  /** Phase 247: leftover MAP `basic_cd` were not Weapon-CD twins. */
  trueWeaponCdTwins: [],
};

if (HAND.size < 50) {
  throw new Error(`Failed to parse HAND overwrite list (size ${HAND.size}).`);
}

const portNotInHand = [...portIds].filter((id) => !HAND.has(id)).sort();
if (handPortMissing.length) {
  throw new Error(`MAP hand_port without PORT_HANDLERS key: ${handPortMissing.join(', ')}`);
}
if (portNotInHand.length) {
  throw new Error(`PORT_HANDLERS ids missing from auto-ports HAND loop: ${portNotInHand.join(', ')}`);
}
if (genericCd.length || genericOther.length) {
  throw new Error(
    `AP 252: leftover generic MAP (cd=${genericCd.length} other=${genericOther.length})`,
  );
}

function ticks(ids) {
  return ids.map((id) => `\`${id}\``).join(', ');
}

const cdPatternOrder = [...GENERIC_CD].filter((p) => genericByPattern[p]?.length);
const otherPatterns = Object.keys(genericByPattern)
  .filter((p) => !GENERIC_CD.has(p))
  .sort();

const md = `### AP census (Phase 243, living)

Regenerate after extract / MAP changes: \`npm run sim-inventory && npm run sim-ap-census\`. Machine JSON: [\`sim-ap-census.json\`](../assets/data/sim-ap-census.json). Consume extract: [\`sim-cd-then-consume.json\`](../assets/data/sim-cd-then-consume.json).

A \`PORT_HANDLERS\` entry wins when \`MAP\` is \`hand_port\` **and** that id is a real port key (Phase **251**). HAND in \`build-sim-auto-ports.mjs\` must list every port; ids without \`PORT_HANDLERS\` stay on the classifier pattern (not silent \`basic_cd\` via \`PATTERNS.hand_port\`). Last run: **${genericCd.length}** generic CD, **${genericOther.length}** other generic, **${handPortMissing.length}** \`hand_port\` with no port key, **${consumeRows.length}** \`cdThenConsume\` ids.

| Bucket | Count |
|---|---|
| Generic CD templates | ${genericCd.length} |
| Other generic MAP | ${genericOther.length} |
| \`hand_port\` missing port key | ${handPortMissing.length} |
| Extract \`cdThenConsume\` | ${consumeRows.length} |
| Documented true Weapon-CD twins (247) | ${payload.trueWeaponCdTwins.length} |

Phase **247:** leftover \`basic_cd\` MAP ids were **not** Weapon-only CDs. Dedicated ports: \`phoenix\` (self-dmg + reincarnate), \`pumpkin\` (on-hit stun + fatigue heat), \`ruby_chonk\` (on-hit heat/stun), \`squirrel_archer\` (ForestFriend speed + steal on hit), \`thorn_bow\` (start spikes → temp bonus). \`stone\` already had \`stonePort\` and is on HAND so MAP \`basic_cd\` does not win. **No** true Weapon-CD twins were kept on \`bindPattern\`.

Phase **248:** leftover \`start_*\` MAP ids were **not** grant-only twins. Dedicated ports in \`ports-ap-start.js\` (plus HAND \`piggybank\`). Weapons still strike; Dark Lantern is % HP loss + reincarnate, not \`start_max_hp\`.

Phase **249:** leftover on-hit / perm-bonus / \`double_strike\` MAP ids were **not** family recipes. Dedicated ports in \`ports-ap-perm.js\` / \`ports-ap-onhit.js\`. Lucky Bow is crit-gated extra strike, not every-CD double.

Phase **250:** leftover aura / food / link MAP ids were **not** Hero Longsword / Banana twins. Dedicated ports in \`ports-ap-aura.js\`. Census other-generic should be 0 after this wave.

Phase **251:** \`MAP\` \`hand_port\` only when \`PORT_HANDLERS[id]\` exists. Builder throws if a port id is missing from HAND.

Phase **252:** census ratchet **0** generic CD / start / on-hit stand-ins. \`wooden_sword\` is an explicit \`WoodenSword.gd\` port (\`weaponStrike\`), not \`bindPattern\` \`basic_cd\`. Smoke: \`npm run sim-ap-smoke\`.

#### Generic CD (still \`bindPattern\`)

| Pattern | Count | Ids |
|---|---|---|
${
  cdPatternOrder.length
    ? cdPatternOrder
        .map((p) => `| \`${p}\` | ${genericByPattern[p].length} | ${ticks(genericByPattern[p])} |`)
        .join('\n')
    : '| — | 0 | *(none)* |'
}

#### Other generic MAP

| Pattern | Count | Ids |
|---|---|---|
${
  otherPatterns.length
    ? otherPatterns
        .map((p) => `| \`${p}\` | ${genericByPattern[p].length} | ${ticks(genericByPattern[p])} |`)
        .join('\n')
    : '| — | 0 | *(none)* |'
}
${
  handPortMissing.length
    ? `\n**\`hand_port\` not in HAND and no port key:** ${ticks(handPortMissing)}\n`
    : ''
}
#### CD-then-consume (\`onAfterEffectFinished\` one-shots)

Game: first CD effect then consume — not a repeating \`activate()\`. Sim loops if the winning handler is still a generic CD recipe.

| Id | MAP | Winning port | Generic auto |
|---|---|---|---|
${consumeRows
  .map(
    (r) =>
      `| \`${r.id}\` | \`${r.pattern}\` | ${r.hasWinningPort ? 'yes' : 'no'} | ${r.genericAuto ? 'yes' : 'no'} |`,
  )
  .join('\n')}
`;

const outJson = path.join(root, 'assets/data/sim-ap-census.json');
fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`);
console.log(
  `Wrote ${outJson}: genericCd=${genericCd.length} genericOther=${genericOther.length} ` +
    `handMissing=${handPortMissing.length} cdThenConsume=${consumeRows.length}`,
);
// Human-readable census used to patch docs/sim/sim-phases.md; that burn-down
// doc was removed — JSON + sim-phases.md are the living sources.
