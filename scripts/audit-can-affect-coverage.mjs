/**
 * Summarize canAffect rule coverage after extract.
 * Run: node scripts/audit-can-affect-coverage.mjs
 */
import fs from 'fs';

const RULES = 'assets/data/can-affect-rules.json';
const OUT = 'assets/data/can-affect-coverage.json';

const r = JSON.parse(fs.readFileSync(RULES, 'utf8'));

const ops = new Map();
const unsupported = [];

function walk(node, id, path) {
  if (!node || typeof node !== 'object') return;
  const op = node.op || '?';
  ops.set(op, (ops.get(op) || 0) + 1);
  if (op === 'unsupported' || node.unsupported) {
    unsupported.push({ id, path, raw: node.raw || null });
  }
  if (node.args) node.args.forEach((a, i) => walk(a, id, `${path}.${i}`));
  if (node.arg) walk(node.arg, id, `${path}.arg`);
}

for (const [id, e] of Object.entries(r.byId || {})) {
  for (const k of [
    'primary',
    'secondary',
    'tertiary',
    'lightning',
    'affectsEmpty',
    'distinct',
  ]) {
    if (e[k]) walk(e[k], id, k);
  }
}

/** Ops that need catalog fields beyond type/tags/rarity (soft gaps). */
const DATA_DEPENDENT = [
  'gainsBuffs',
  'usesBuffs',
  'gainsStack',
  'reactsToCharges',
  'hasInventoryDuration',
  'hasStartofBattle',
  'canStartNewRecipe',
  'isTreasure',
  'inflictsDebuffs',
];

const soft = {};
for (const op of DATA_DEPENDENT) {
  soft[op] = ops.get(op) || 0;
}

const out = {
  auditedAt: new Date().toISOString(),
  itemsWithRules: r.count,
  parsedFuncs: r.parsed,
  unsupportedInstances: unsupported.length,
  unsupportedDetails: unsupported,
  inheritedFields: r.inheritedFields,
  hasAttackEffectCount: r.hasAttackEffectCount,
  scriptFamilyCount: Object.keys(r.scriptFamilies || {}).length,
  keyFamilies: {
    DragonEgg: r.scriptFamilies?.DragonEgg || [],
    Dagger: r.scriptFamilies?.Dagger || [],
    Food: (r.scriptFamilies?.Food || []).length,
    ChessPiece: (r.scriptFamilies?.ChessPiece || []).length,
    Goobert: (r.scriptFamilies?.Goobert || []).length,
    Card: (r.scriptFamilies?.Card || []).length,
  },
  opCounts: Object.fromEntries([...ops.entries()].sort((a, b) => b[1] - a[1])),
  softDataGaps: soft,
  notes: [
    'unsupportedInstances should be 0 after full parse support.',
    'softDataGaps ops evaluate with heuristics or item flags when catalog lacks gainedStacks / randomUniquePool / etc.',
    'cardAffect approximates Card.gd chain/deck logic as hasType(Card) on build boards.',
    'isTreasure approximates Unique rarity until randomUniquePool is imported.',
  ],
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  unsupportedInstances: out.unsupportedInstances,
  itemsWithRules: out.itemsWithRules,
  hasAttackEffectCount: out.hasAttackEffectCount,
  keyFamilies: out.keyFamilies,
  softDataGaps: out.softDataGaps,
  topOps: Object.entries(out.opCounts).slice(0, 15),
}, null, 2));
console.log('wrote', OUT);
