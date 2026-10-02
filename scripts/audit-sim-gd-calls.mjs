/**
 * Call-level .gd → JS port parity.
 *
 *   node scripts/audit-sim-gd-calls.mjs
 *
 * Hook-level parity (audit-sim-gd-parity.mjs) only proves a port runs at the
 * right time. This walks each game script's *combat effect calls* (giveHeat,
 * purgeDamage, stun, dealEffectDamage, …) and checks the JS port that owns the
 * item mentions a matching engine helper. Anything unmatched is a candidate
 * gap for human review, not a verdict.
 *
 * Writes scripts/_cache/sim-gd-calls-report.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ITEMS = path.join(ROOT, 'tools/game-extract-full/Items');
const PORT_DIR = path.join(ROOT, 'js/pages/sim/engine/scripts');

/**
 * gd call → JS tokens that count as an implementation. Tokens are matched as
 * substrings of the port block (plus the helpers it imports by name).
 */
const CALL_MAP = {
  giveBlock: ['block'],
  giveLucky: ['lucky'],
  giveRegeneration: ['regeneration'],
  giveMana: ['mana'],
  giveHeat: ['heat'],
  giveEmpower: ['empower'],
  giveSpikes: ['spikes'],
  giveVampirism: ['vampirism'],
  giveStamina: ['stamina'],
  giveMaxHealth: ['maxHealth', 'max_health', 'maxHp', 'giveMaxHealth'],
  giveMaxStaminaTemporary: ['maxStamina', 'stamina'],
  giveStacks: ['gainStacks', 'giveStacks', 'grantStacks'],
  giveStacksTemporary: ['Temporary', 'temp'],
  giveRandomBuffs: ['randomBuff', 'RandomBuff'],
  giveMostBuffs: ['mostBuff', 'MostBuff'],
  giveLeastBuffs: ['leastBuff', 'LeastBuff'],
  giveAllBuffs: ['allBuff', 'AllBuff'],
  giveReflectStacks: ['reflect'],
  giveCritTokens: ['crit'],
  heal: ['heal'],
  stealLife: ['heal', 'steal'],
  inflictPoison: ['poison'],
  inflictCold: ['cold'],
  inflictBlind: ['blind'],
  inflictRandomDebuffs: ['randomDebuff', 'RandomDebuff'],
  inflictFatigueDamage: ['fatigue'],
  selfInflictPoison: ['poison'],
  useMana: ['useMana'],
  tryUseMana: ['useMana'],
  useRegeneration: ['useRegeneration'],
  useLucky: ['useLucky'],
  useHeat: ['useHeat', 'spendStacks'],
  useSpikes: ['useSpikes', 'spendStacks'],
  useStamina: ['stamina'],
  drainStamina: ['stamina'],
  addSpeed: ['addSpeed'],
  reduceSpeed: ['addSpeed', 'reduceSpeed', 'slow'],
  addBonusDamage: ['addBonusDamage'],
  reduceBonusDamage: ['addBonusDamage', 'reduceBonus'],
  purgeDamage: ['purgeDamage', 'purge'],
  addAccuracy: ['addAccuracy'],
  addCritChancePercent: ['crit'],
  changeVaryingDamage: ['varying', 'damageMin', 'damageMax', 'changeVarying'],
  dealEffectDamage: ['dealEffectDamage', 'effectDamage'],
  removeBlock: ['removeBlock'],
  removeRandomBuffs: ['removeRandomBuffs'],
  removeMostBuffs: ['removeMostBuffs', 'removeBuff'],
  removeLucky: ['lucky'],
  stealRandomBuff: ['stealRandomBuff', 'steal'],
  stealStack: ['steal'],
  stealBuffsFraction: ['steal'],
  removeBuffsFraction: ['removeBuff', 'strip'],
  stun: ['stun'],
  cleanseRandomDebuffs: ['cleanse'],
  cleanseBlind: ['cleanse', 'blind'],
  cleanseCold: ['cleanse', 'cold'],
  cleansePoison: ['cleanse', 'poison'],
  advanceCooldownPercent: ['advanceCooldown', 'cdAdvance', 'advance'],
  adjustCooldown: ['cooldown'],
  deactivateCooldown: ['consume', 'deactivateCooldown', 'cdThenConsume'],
  emitCharge: ['emitCharge', 'charge'],
  sendCharge: ['charge'],
  zapItem: ['charge', 'zap'],
  healthToBlock: ['block'],
  changeStaminaFactor: ['stamina'],
  multiplyBuffsLimit: ['buffsLimit', 'limit'],
  changeAllItemsCritRate: ['crit'],
  changeChargedItemStat: ['charge'],
  changeResistChance: ['resist'],
  changeEffectDamageFactor: ['effectDmgFactor', 'effectDamageFactor'],
  giveGold: [],
  consume: ['consume'],
};

/** Calls that are shop / UI / animation only. */
const IGNORE = new Set([
  'getP', 'getP1', 'getP2', 'getP3', 'getP4', 'getP5', 'getP6', 'getP_m', 'getP_check',
  'preload', 'character', 'opponent', 'activate', 'miniActivate', 'setState',
  'onStateChanged', 'onShopEntered', 'connectForCombat', 'canAffect', 'getAffectedItems',
  'getNumAffectedItems', 'rollChance', 'rollChance2', 'getChance', 'getChance2',
  'onAfterEffectFinished', 'return', 'get_parent', 'call_deferred', 'set_physics_process',
  'export', 'playPickupSound', 'playDropSound', 'insertParameter', 'insertParameters',
  'insertCounter', 'getDescription', 'getBaseDescription', 'getCardDescription',
  'getModeDescription', 'create_tween', 'add_child', 'emit_signal', 'connect',
  'has_method', 'is_instance_valid', 'range', 'round', 'floor', 'ceil', 'clamp', 'sign',
  'sqrt', 'lerp', 'stepify', 'float', 'int', 'str', 'assert', 'print', 'empty', 'fill',
  'size', 'keys', 'values', 'push_back', 'append', 'clear', 'erase', 'shuffle', 'sort',
]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Split a ports file into top-level `const x = { … };` blocks. */
function portBlocks(src) {
  const lines = src.split(/\r?\n/);
  const blocks = [];
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!cur && /^(?:const|export const)\s+[A-Za-z0-9_]+\s*[:=]/.test(line)) {
      cur = { start: i, text: [line] };
      if (/^};?\s*$/.test(line)) cur = null;
      continue;
    }
    if (cur) {
      cur.text.push(line);
      if (/^\};?\s*$/.test(line)) {
        blocks.push({ start: cur.start, text: cur.text.join('\n') });
        cur = null;
      }
    }
  }
  return blocks;
}

const portFiles = walk(PORT_DIR).filter((f) => f.endsWith('.js'));
/** id → { file, text }[] (later files win at runtime, both kept for review) */
const portsById = new Map();
/** shared helper source, so a port that calls a helper still counts */
const helperSrc = new Map();
for (const file of portFiles) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  helperSrc.set(rel, src);
  for (const b of portBlocks(src)) {
    const m = /handlerId:\s*'([a-z0-9_]+)'/.exec(b.text);
    if (!m) continue;
    const list = portsById.get(m[1]) || [];
    list.push({ file: rel, text: b.text });
    portsById.set(m[1], list);
  }
}

/**
 * Ports built by a factory (potions, bags, socket gems) have no literal
 * `handlerId:` block — fall back to whichever module registers the id as a key
 * and audit against that whole module.
 */
function moduleFallback(id) {
  const out = [];
  const key = new RegExp(`(?:^|[^\\w'"])'?${id}'?\\s*:`, 'm');
  for (const [rel, src] of helperSrc) {
    if (key.test(src)) out.push({ file: rel, text: src });
  }
  return out;
}

const inv = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'assets/data/sim-item-inventory.json'), 'utf8'),
);

/** `Exclusive/AcornAce.gd` and `AcornAce.gd` both resolve */
const gdByFile = new Map();
for (const p of walk(ITEMS)) {
  if (!p.endsWith('.gd')) continue;
  const src = fs.readFileSync(p, 'utf8');
  gdByFile.set(path.basename(p), src);
  gdByFile.set(path.relative(ITEMS, p).replace(/\\/g, '/'), src);
}

const rows = [];
for (const [id, entry] of Object.entries(inv.byId || {})) {
  const gd = gdByFile.get(entry.file || '');
  if (!gd) continue;
  /** @type {Set<string>} */
  const calls = new Set();
  // Receiver calls count too: `character().giveBlock(…)`, `opponent().stun(…)`.
  for (const m of gd.matchAll(/([a-z][A-Za-z0-9_]{2,})\s*\(/g)) {
    const name = m[1];
    if (IGNORE.has(name)) continue;
    if (CALL_MAP[name]) calls.add(name);
  }
  const ports = portsById.get(id) || moduleFallback(id);
  const blob = ports.map((p) => p.text).join('\n') +
    // count helpers in the owning module too (weaponStrike etc. live there)
    ports.map((p) => helperSrc.get(p.file) || '').join('\n');
  const missing = [];
  for (const call of calls) {
    const tokens = CALL_MAP[call];
    if (!tokens.length) continue;
    if (!ports.length) {
      missing.push({ call, why: 'no port block found' });
      continue;
    }
    const hit = tokens.some((t) => blob.toLowerCase().includes(t.toLowerCase()));
    if (!hit) missing.push({ call, why: `no token of ${tokens.join('/')}` });
  }
  rows.push({
    id,
    file: entry.file,
    ports: ports.map((p) => p.file),
    calls: [...calls],
    missing,
  });
}

const gaps = rows.filter((r) => r.missing.length);
const report = {
  generatedAt: new Date().toISOString(),
  note: 'candidate gaps for review — token heuristic, not a verdict',
  totals: { items: rows.length, withCandidateGaps: gaps.length },
  byCall: gaps.reduce((acc, r) => {
    for (const m of r.missing) acc[m.call] = (acc[m.call] || 0) + 1;
    return acc;
  }, /** @type {Record<string, number>} */ ({})),
  gaps: gaps.sort((a, b) => b.missing.length - a.missing.length),
};

const out = path.join(ROOT, 'scripts/_cache/sim-gd-calls-report.json');
fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.totals, null, 1));
console.log('by call:', JSON.stringify(report.byCall, null, 1));
for (const g of gaps) {
  console.log(`${g.id} (${g.file}) → ${g.missing.map((m) => m.call).join(', ')}  [${g.ports.join(', ') || 'NO PORT'}]`);
}
console.log(`wrote ${path.relative(ROOT, out)}`);
