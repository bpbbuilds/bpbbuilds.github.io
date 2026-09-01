/**
 * Classify each inventory .gd as trivial / pattern / complex (Godot 3 indent syntax).
 *   node scripts/classify-sim-ports.mjs
 */
import fs from 'fs';
import path from 'path';

const INV = 'assets/data/sim-item-inventory.json';
const ITEMS = 'tools/game-extract-full/Items';
const OUT = 'assets/data/sim-port-classify.json';

const inv = JSON.parse(fs.readFileSync(INV, 'utf8'));

function findGd(file) {
  const direct = path.join(ITEMS, file);
  if (fs.existsSync(direct)) return direct;
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        const hit = walk(full);
        if (hit) return hit;
      } else if (ent.name === file) return full;
    }
    return null;
  }
  return walk(ITEMS);
}

/** @param {string} text @param {string} name */
function extractFunc(text, name) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const startRe = new RegExp(`^func\\s+${name}\\s*\\(`);
  let i = 0;
  while (i < lines.length && !startRe.test(lines[i])) i += 1;
  if (i >= lines.length) return '';
  i += 1;
  const body = [];
  while (i < lines.length) {
    const line = lines[i];
    if (/^(func|class_name|signal|const|var|onready|export)\s/.test(line)) break;
    if (line.trim() === '' && body.length && !/^\t| {2,}/.test(lines[i + 1] || '')) {
      // allow blank inside body; stop only on next top-level
    }
    if (
      line.length &&
      !/^\t/.test(line) &&
      !/^ /.test(line) &&
      !/^#/.test(line.trim())
    ) {
      break;
    }
    body.push(line);
    i += 1;
  }
  return body.join('\n');
}

function stripComments(text) {
  return text.replace(/#.*$/gm, '');
}

/**
 * @param {string} text
 * @param {object} entry
 */
function classify(text, entry) {
  const overrides = entry.overrides || [];
  const cd = stripComments(extractFunc(text, 'doCooldownEffect'));
  const start = stripComments(extractFunc(text, 'onCombatStart'));
  const preStart = stripComments(extractFunc(text, 'onPreCombatStart'));
  const onHit = stripComments(extractFunc(text, 'onDealtDamage'));
  const preEarly = stripComments(extractFunc(text, 'onPreDealDamage_early'));
  const reasons = [];

  const only = (...names) =>
    overrides.length === names.length && names.every((n) => overrides.includes(n));

  const dealCount = (cd.match(/dealDamage\s*\(/g) || []).length;
  const complexCdBits =
    /for\s+|while\s+|inflict|gain[A-Z]|give[A-Z]|heal\s*\(|addBonus|addSpeed|dealEffect|spawn|connect|getP|changeVarying|damageAcc|rollChance|activate\s*\([^)]+,/.test(
      cd,
    );

  const trivialCd =
    overrides.includes('doCooldownEffect') &&
    !overrides.includes('onDealtDamage') &&
    !overrides.includes('onPreDealDamage_early') &&
    !overrides.includes('onPreDealDamage_late') &&
    !overrides.includes('onCombatStart') &&
    /useStamina/.test(cd) &&
    dealCount === 1 &&
    !complexCdBits;

  const trivialDouble =
    overrides.includes('doCooldownEffect') &&
    !onHit &&
    !preEarly &&
    dealCount === 2 &&
    /useStamina/.test(cd) &&
    !/inflict|gain[A-Z]|give[A-Z]|heal\s*\(|getP1|getP2/.test(cd);

  const trivialStartRegen =
    /giveRegeneration\s*\(\s*getP1\s*\(/.test(start) &&
    /consume\s*\(/.test(start) &&
    !overrides.includes('doCooldownEffect') &&
    start.split('\n').filter((l) => l.trim()).length <= 6;

  const trivialAuraDmg =
    /getAffectedItems/.test(start) &&
    /addBonusDamage\s*\(\s*getP1/.test(start) &&
    !overrides.includes('doCooldownEffect') &&
    !/addSpeed|giveRegeneration|heal\s*\(/.test(start);

  const trivialAuraSpeedOnly =
    /getAffectedItems/.test(start) &&
    /addSpeed\s*\(\s*getP1/.test(start) &&
    !overrides.includes('doCooldownEffect');

  const falconLike =
    /getAffectedItems/.test(start) &&
    /addSpeed\s*\(\s*getP1/.test(start) &&
    dealCount >= 2;

  const foodHealStam =
    /heal\s*\(/.test(cd) &&
    /giveStamina|gainStamina/.test(cd) &&
    dealCount === 0 &&
    only('doCooldownEffect');

  let kind = 'complex';
  let template = 'basic_cd';

  if (trivialCd) {
    kind = 'trivial';
    template = 'basic_cd';
    reasons.push('stamina→dealDamage');
  } else if (trivialDouble && !falconLike) {
    kind = 'trivial';
    template = 'double_strike';
    reasons.push('double dealDamage');
  } else if (trivialStartRegen) {
    kind = 'trivial';
    template = 'start_regen';
    reasons.push('regen+consume');
  } else if (foodHealStam) {
    kind = 'pattern';
    template = 'banana';
    reasons.push('food heal+stamina');
  } else if (falconLike) {
    kind = 'pattern';
    template = 'falcon_blade';
    reasons.push('haste aura + multi hit');
  } else if (trivialAuraDmg) {
    kind = 'pattern';
    template = 'hero_longsword';
    reasons.push('damage aura');
  } else if (trivialAuraSpeedOnly) {
    kind = 'pattern';
    template = 'speed_aura';
    reasons.push('speed aura only');
  } else {
    kind = 'complex';
    if (/poison|Poison/.test(text)) reasons.push('poison');
    if (/Blind|blind/.test(text)) reasons.push('blind');
    if (/Heat|heat/.test(text)) reasons.push('heat');
    if (/heal\s*\(/.test(text)) reasons.push('heal');
    if (/giveStamina|gainStamina/.test(text)) reasons.push('stamina');
    if (/getAffectedItems|addBonusDamage|addSpeed/.test(text)) reasons.push('aura');
    if (/onDealtDamage|onPreDealDamage/.test(text)) reasons.push('onhit');
    if (/getP\d|getP\s*\(/.test(text)) reasons.push('params');
    if (dealCount > 1) reasons.push('multi_hit');
    if (preStart) reasons.push('pre_combat');
    if (!reasons.length) reasons.push('other');
  }

  return {
    kind,
    template,
    reasons,
    overrides,
    dealCount,
    cdLines: cd.split('\n').filter((l) => l.trim()).length,
    startLines: start.split('\n').filter((l) => l.trim()).length,
  };
}

/** @type {Record<string, object>} */
const byId = {};
const summary = {
  trivial: 0,
  pattern: 0,
  complex: 0,
  missingGd: 0,
  byBand: {},
};

const registry = fs.existsSync('assets/data/sim-port-registry.json')
  ? JSON.parse(fs.readFileSync('assets/data/sim-port-registry.json', 'utf8'))
  : { byId: {} };

for (const [id, entry] of Object.entries(inv.byId || {})) {
  if (['weapon', 'card', 'item', 'bow', 'food', 'pet', 'gem'].includes(id)) continue;
  const gdPath = findGd(entry.file);
  const band = registry.byId?.[id]?.band || '?';
  if (!gdPath) {
    byId[id] = { id, kind: 'missing', band, file: entry.file };
    summary.missingGd += 1;
    continue;
  }
  const text = fs.readFileSync(gdPath, 'utf8');
  const c = classify(text, entry);
  byId[id] = { id, band, file: entry.file, family: entry.family, ...c };
  summary[c.kind] = (summary[c.kind] || 0) + 1;
  summary.byBand[band] = summary.byBand[band] || {
    trivial: 0,
    pattern: 0,
    complex: 0,
  };
  summary.byBand[band][c.kind] = (summary.byBand[band][c.kind] || 0) + 1;
}

const complexIds = Object.values(byId)
  .filter((r) => r.kind === 'complex' || r.kind === 'missing')
  .map((r) => r.id)
  .sort();
const autoReviewIds = Object.values(byId)
  .filter((r) => r.kind === 'trivial' || r.kind === 'pattern')
  .map((r) => r.id)
  .sort();

const payload = {
  classifiedAt: new Date().toISOString(),
  summary: {
    ...summary,
    total: Object.keys(byId).length,
    complexCount: complexIds.length,
    autoReviewCount: autoReviewIds.length,
  },
  autoReviewIds,
  complexIds,
  byId,
};

fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
console.log(JSON.stringify(payload.summary, null, 2));
console.log('Auto-reviewable:', autoReviewIds.length);
console.log('Complex:', complexIds.length);
console.log('Complex sample:', complexIds.slice(0, 50).join(', '));
