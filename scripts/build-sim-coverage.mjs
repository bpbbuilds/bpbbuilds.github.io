/**
 * Build assets/data/sim-item-coverage.json from inventory + port registry.
 * Run after extract-sim-item-inventory.mjs and gen-sim-dedicated-ports.mjs
 *   node scripts/build-sim-coverage.mjs
 */
import fs from 'fs';

const INV = 'assets/data/sim-item-inventory.json';
const REG = 'assets/data/sim-port-registry.json';
const PARITY_INV = 'assets/data/sim-parity-inventory.json';
const OUT = 'assets/data/sim-item-coverage.json';

const FAMILY_HANDLER = {
  basic_weapon: 'basic_cd',
  weapon_base: 'basic_cd',
  custom_cd: 'basic_cd',
  synergy_aura: 'empower_aura',
  start_buff: 'start_regen',
  on_hit: 'basic_cd',
  pet_like: 'pet_strike',
  food: 'start_regen',
  unique: 'basic_cd',
};

const inv = JSON.parse(fs.readFileSync(INV, 'utf8'));
/** @type {object | null} */
let registry = null;
if (fs.existsSync(REG)) {
  registry = JSON.parse(fs.readFileSync(REG, 'utf8'));
}

/** @type {Record<string, object>} */
const byId = {};
let dedicated = 0;
let dedicatedReviewed = 0;
let dedicatedApprox = 0;
let dedicatedStub = 0;
let dedicatedParity = 0;
let familyOnly = 0;
let catalogFallback = 0;

const autoMeta = fs.existsSync('assets/data/sim-auto-ports.json')
  ? JSON.parse(fs.readFileSync('assets/data/sim-auto-ports.json', 'utf8'))
  : { byId: {} };

/** @type {{ parityIds?: string[], byId?: Record<string, { depth?: string }> } | null} */
const parityInv = fs.existsSync(PARITY_INV)
  ? JSON.parse(fs.readFileSync(PARITY_INV, 'utf8'))
  : null;
const PARITY_IDS = new Set(parityInv?.parityIds || []);

const SKIP_BASE = new Set(registry?.skipIds || ['weapon', 'item', 'bow', 'food', 'pet', 'card', 'gem']);

for (const [id, entry] of Object.entries(inv.byId || {})) {
  if (SKIP_BASE.has(id)) {
    byId[id] = {
      id,
      family: entry.family,
      handlerId: null,
      status: 'skipped_base',
      fidelity: 'n/a',
      overrides: entry.overrides,
    };
    continue;
  }
  const reg = registry?.byId?.[id];
  if (reg) {
    let fidelity = reg.fidelity || 'stub';
    const notes = autoMeta.byId?.[id]?.notes || '';
    const approx = /approx|fallback|unknown/i.test(notes);
    if (fidelity === 'reviewed' && approx) fidelity = 'reviewed_approx';
    if (PARITY_IDS.has(id)) fidelity = 'parity';
    dedicated += 1;
    if (fidelity === 'parity') {
      dedicatedReviewed += 1;
      dedicatedParity += 1;
    } else if (fidelity === 'reviewed') dedicatedReviewed += 1;
    else if (fidelity === 'reviewed_approx') {
      dedicatedReviewed += 1;
      dedicatedApprox += 1;
    } else dedicatedStub += 1;
    const depth = parityInv?.byId?.[id]?.depth || null;
    byId[id] = {
      id,
      family: entry.family,
      handlerId: reg.handlerId || id,
      status: 'dedicated',
      fidelity,
      depth,
      band: reg.band,
      template: reg.template || autoMeta.byId?.[id]?.pattern,
      notes: notes || null,
      overrides: entry.overrides,
    };
    continue;
  }

  const handlerId = FAMILY_HANDLER[entry.family] || null;
  if (handlerId) {
    familyOnly += 1;
    byId[id] = {
      id,
      family: entry.family,
      handlerId,
      status: 'family',
      fidelity: 'family',
      overrides: entry.overrides,
    };
  } else {
    catalogFallback += 1;
    byId[id] = {
      id,
      family: entry.family,
      handlerId: null,
      status: 'catalog_fallback',
      fidelity: 'none',
      overrides: entry.overrides,
    };
  }
}

const STAPLES = [
  'wooden_buckler',
  'leather_boots',
  'boots_of_speed',
];
for (const id of STAPLES) {
  if (byId[id]) {
    if (PARITY_IDS.has(id) && byId[id].status === 'dedicated' && byId[id].fidelity !== 'parity') {
      if (byId[id].fidelity === 'reviewed' || byId[id].fidelity === 'reviewed_approx') {
        // already counted as reviewed
      }
      byId[id].fidelity = 'parity';
      dedicatedParity += 1;
    }
    continue;
  }
  // Band P: catalog staples without inventory GD override still get dedicated ports
  const fidelity = PARITY_IDS.has(id) ? 'parity' : 'reviewed';
  byId[id] = {
    id,
    family: 'catalog',
    handlerId: id,
    status: 'dedicated',
    fidelity,
    band: 'P',
    template: 'catalog_staple',
    overrides: [],
  };
  dedicated += 1;
  dedicatedReviewed += 1;
  if (fidelity === 'parity') dedicatedParity += 1;
}

// HAND ports that never entered inventory (shop/gems/chess noops, some potions)
for (const id of Object.keys(autoMeta.byId || {})) {
  if (byId[id] || SKIP_BASE.has(id)) continue;
  if (autoMeta.byId[id]?.pattern !== 'hand_port') continue;
  const fidelity = PARITY_IDS.has(id) ? 'parity' : 'reviewed';
  const depth = parityInv?.byId?.[id]?.depth || null;
  byId[id] = {
    id,
    family: 'catalog',
    handlerId: id,
    status: 'dedicated',
    fidelity,
    depth,
    band: 'AK',
    template: 'hand_port',
    notes: autoMeta.byId[id]?.notes || null,
    overrides: [],
  };
  dedicated += 1;
  dedicatedReviewed += 1;
  if (fidelity === 'parity') dedicatedParity += 1;
}

const payload = {
  builtAt: new Date().toISOString(),
  inventoryExtractedAt: inv.extractedAt,
  portRegistryGeneratedAt: registry?.generatedAt || null,
  totals: {
    entries: Object.keys(byId).length,
    dedicated,
    dedicatedReviewed,
    dedicatedApprox,
    dedicatedSolid: dedicatedReviewed - dedicatedApprox,
    dedicatedParity,
    dedicatedStub,
    family: familyOnly,
    catalogFallback,
    /** Legacy: dedicated + family (anything with a handler) */
    scripted: dedicated + familyOnly,
    depthDeep: parityInv?.totals?.deep ?? null,
    depthShallow: parityInv?.totals?.shallow ?? null,
    depthNoop: parityInv?.totals?.noop ?? null,
  },
  goal: {
    /** Placeable combat items that have a dedicated handlerId */
    dedicatedPct:
      dedicated + familyOnly > 0
        ? Math.round((dedicated / (dedicated + familyOnly)) * 100)
        : 0,
    reviewedPct: dedicated
      ? Math.round((dedicatedReviewed / dedicated) * 100)
      : 0,
    solidPct: dedicated
      ? Math.round(((dedicatedReviewed - dedicatedApprox) / dedicated) * 100)
      : 0,
    parityPct: dedicated ? Math.round((dedicatedParity / dedicated) * 100) : 0,
    target:
      'Solid 100% shipped (AC–AE). Climb reviewed → parity (Band AF–AH).',
  },
  familyDefaults: FAMILY_HANDLER,
  byId,
};

fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
console.log(
  `Wrote ${OUT}: ${payload.totals.entries} entries · dedicated=${dedicated} (reviewed=${dedicatedReviewed} stub=${dedicatedStub}) family=${familyOnly} fallback=${catalogFallback}`,
);
console.log(
  `Goal progress: ${payload.goal.dedicatedPct}% have dedicated handlers; ${payload.goal.reviewedPct}% of those reviewed`,
);
