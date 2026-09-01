/**
 * Audit canAffect / affectsEmpty / isAffectingDistinct inheritance:
 * walk every Items/*.gd extends chain and report gaps vs extracted rules.
 *
 * Run: node scripts/audit-can-affect-parents.mjs
 */
import fs from 'fs';
import path from 'path';

const ITEMS_DIR = 'tools/game-extract-full/Items';
const GAME_ITEMS = 'scripts/_cache/game-items.json';
const RULES = 'assets/data/can-affect-rules.json';
const OUT = 'assets/data/can-affect-parent-audit.json';

const FN_RE =
  /^func (canAffect(?:_secondary|_tertiary|_lightning)?|affectsEmpty|isAffectingDistinct)\s*\(/m;

const RULE_KEYS = [
  'primary',
  'secondary',
  'tertiary',
  'lightning',
  'affectsEmpty',
  'distinct',
];

const FN_TO_KEY = {
  canAffect: 'primary',
  canAffect_secondary: 'secondary',
  canAffect_tertiary: 'tertiary',
  canAffect_lightning: 'lightning',
  affectsEmpty: 'affectsEmpty',
  isAffectingDistinct: 'distinct',
};

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (ent.name.endsWith('.gd') && ent.name !== 'Item.gd') out.push(full);
  }
  return out;
}

function slugify(name) {
  return (
    String(name || '')
      .toLowerCase()
      .replace(/['']/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 80) || 'item'
  );
}

function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

function loadItemIndex() {
  const raw = JSON.parse(fs.readFileSync(GAME_ITEMS, 'utf8'));
  const arr = Array.isArray(raw) ? raw : raw.items || [];
  /** @type {Map<string, string>} */
  const byStem = new Map();
  /** @type {Map<string, string>} */
  const byNorm = new Map();
  for (const it of arr) {
    if (!it?.id) continue;
    byNorm.set(normKey(it.id), it.id);
    byNorm.set(normKey(it.name), it.id);
    byNorm.set(normKey(it.displayName || ''), it.id);
    if (it.image) {
      const stem = path.basename(String(it.image), path.extname(it.image));
      byStem.set(stem, it.id);
      byStem.set(normKey(stem), it.id);
    }
  }
  return { byStem, byNorm, ids: new Set(arr.map((i) => i.id)) };
}

function resolveItemId(filePath, index) {
  const stem = path.basename(filePath, '.gd');
  if (index.byStem.has(stem)) return index.byStem.get(stem);
  if (index.byStem.has(normKey(stem))) return index.byStem.get(normKey(stem));
  const slug = slugify(stem);
  if (index.byNorm.has(slug)) return index.byNorm.get(slug);
  if (index.byNorm.has(normKey(slug))) return index.byNorm.get(normKey(slug));
  return slug;
}

const index = loadItemIndex();
const rules = JSON.parse(fs.readFileSync(RULES, 'utf8'));
const rulesById = rules.byId || {};

/** @type {Map<string, object>} */
const scripts = new Map();

for (const file of walk(ITEMS_DIR)) {
  const text = fs.readFileSync(file, 'utf8');
  const stem = path.basename(file, '.gd');
  const itemId = resolveItemId(file, index);
  const parent = (text.match(/^extends\s+(\w+)/m) || [])[1] || null;
  const className = (text.match(/^class_name\s+(\w+)/m) || [])[1] || stem;
  /** @type {Set<string>} */
  const localFns = new Set();
  const fnRe =
    /^func (canAffect(?:_secondary|_tertiary|_lightning)?|affectsEmpty|isAffectingDistinct)\s*\(/gm;
  let m;
  while ((m = fnRe.exec(text))) localFns.add(m[1]);

  const entry = {
    id: itemId,
    stem,
    className,
    file: path.relative(ITEMS_DIR, file).replace(/\\/g, '/'),
    parentScript: parent && parent !== 'Item' ? parent : null,
    localFns: [...localFns],
    inCatalog: index.ids.has(itemId),
  };
  scripts.set(stem, entry);
  scripts.set(className, entry);
  scripts.set(normKey(stem), entry);
  scripts.set(normKey(className), entry);
  scripts.set(itemId, entry);
}

function resolveScript(name) {
  if (!name) return null;
  return scripts.get(name) || scripts.get(normKey(name)) || null;
}

function walkParents(entry) {
  const chain = [];
  const guard = new Set([entry.id]);
  let name = entry.parentScript;
  while (name) {
    const p = resolveScript(name);
    if (!p || guard.has(p.id)) break;
    chain.push({ id: p.id, stem: p.stem, className: p.className, file: p.file });
    guard.add(p.id);
    name = p.parentScript;
  }
  return chain;
}

/** Effective rules after walking parents (mirrors extract-can-affect-rules.mjs). */
function effectiveFromParents(entry) {
  /** @type {Record<string, { source: string, local: boolean }>} */
  const eff = {};
  for (const fn of entry.localFns) {
    const key = FN_TO_KEY[fn];
    if (key) eff[key] = { source: entry.id, local: true };
  }
  for (const p of walkParents(entry)) {
    const pe = resolveScript(p.id) || resolveScript(p.stem);
    if (!pe) continue;
    for (const fn of pe.localFns) {
      const key = FN_TO_KEY[fn];
      if (key && !eff[key]) eff[key] = { source: pe.id, local: false };
    }
  }
  return eff;
}

const byId = new Map();
for (const entry of scripts.values()) {
  if (!byId.has(entry.id)) byId.set(entry.id, entry);
}

/** Parents that define at least one affect fn */
const parentDefs = new Map();
for (const entry of byId.values()) {
  if (!entry.localFns.length) continue;
  const kids = [];
  for (const child of byId.values()) {
    const chain = walkParents(child);
    if (chain.some((c) => c.id === entry.id || c.stem === entry.stem)) {
      kids.push(child.id);
    }
  }
  if (kids.length) {
    parentDefs.set(entry.id, {
      id: entry.id,
      file: entry.file,
      localFns: entry.localFns,
      childCount: kids.length,
      children: kids.sort(),
    });
  }
}

const gaps = [];
const inheritedOk = [];
const unsupported = [];
const missingFromRules = [];

for (const entry of byId.values()) {
  if (!entry.inCatalog) continue;
  const chain = walkParents(entry);
  const eff = effectiveFromParents(entry);
  const rule = rulesById[entry.id];

  for (const key of RULE_KEYS) {
    const expect = eff[key];
    if (!expect) continue;
    if (!rule || rule[key] == null) {
      gaps.push({
        id: entry.id,
        field: key,
        shouldInheritFrom: expect.source,
        parentChain: chain.map((c) => c.id),
        reason: 'missing_in_extracted_rules',
      });
    } else if (!expect.local && expect.source !== entry.id) {
      inheritedOk.push({
        id: entry.id,
        field: key,
        from: expect.source,
      });
      if (rule[key]?.op === 'unsupported') {
        unsupported.push({
          id: entry.id,
          field: key,
          from: expect.source,
          raw: rule[key].raw || null,
        });
      }
    } else if (rule[key]?.op === 'unsupported') {
      unsupported.push({
        id: entry.id,
        field: key,
        from: entry.id,
        raw: rule[key].raw || null,
      });
    }
  }

  // Has parent with rules but child has zero extracted fields
  if (chain.length && Object.keys(eff).length && !rule) {
    missingFromRules.push({
      id: entry.id,
      parentChain: chain.map((c) => c.id),
      expectedFields: Object.keys(eff),
    });
  }
}

// Spot-check known inheritance families
const families = {};
for (const [id, def] of parentDefs) {
  families[id] = {
    file: def.file,
    localFns: def.localFns,
    childCount: def.childCount,
    childrenMissingRule: def.children.filter((cid) => {
      const r = rulesById[cid];
      return !r || !RULE_KEYS.some((k) => r[k] != null);
    }),
  };
}

const out = {
  auditedAt: new Date().toISOString(),
  catalogItems: index.ids.size,
  scriptsWithAffectFns: [...byId.values()].filter((e) => e.localFns.length).length,
  parentScriptsWithChildren: parentDefs.size,
  inheritedFieldsOk: inheritedOk.length,
  gaps: gaps.length,
  unsupportedExprs: unsupported.length,
  missingEntirelyFromRules: missingFromRules.length,
  gapDetails: gaps,
  missingDetails: missingFromRules,
  unsupportedDetails: unsupported.slice(0, 80),
  families,
  samples: {
    light_goobert: {
      chain: walkParents(byId.get('light_goobert') || resolveScript('LightGoobert')).map(
        (c) => c.id,
      ),
      effective: effectiveFromParents(
        byId.get('light_goobert') || resolveScript('LightGoobert'),
      ),
      extracted: rulesById.light_goobert || null,
    },
    goobert: {
      localFns: (byId.get('goobert') || {}).localFns,
      childCount: (parentDefs.get('goobert') || {}).childCount,
      extracted: rulesById.goobert || null,
    },
  },
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

console.log(`wrote ${OUT}`);
console.log(
  JSON.stringify(
    {
      gaps: out.gaps,
      missingEntirelyFromRules: out.missingEntirelyFromRules,
      inheritedFieldsOk: out.inheritedFieldsOk,
      unsupportedExprs: out.unsupportedExprs,
      parentScriptsWithChildren: out.parentScriptsWithChildren,
      light_goobert: out.samples.light_goobert,
      families: Object.fromEntries(
        Object.entries(families).map(([k, v]) => [
          k,
          {
            fns: v.localFns,
            kids: v.childCount,
            missingKids: v.childrenMissingRule.length,
          },
        ]),
      ),
    },
    null,
    2,
  ),
);
