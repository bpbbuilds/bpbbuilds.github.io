import assert from 'node:assert/strict';
import {
  buildAuditDashboard,
  buildPublicFidelitySummary,
} from './build-sim-audit-dashboard.mjs';

const source = {
  items: {
    source: { extractSha256: 'extract-a' },
    rows: [
      { id: 'ported', name: 'Ported', type: 'Weapon', class: 'Ranger', status: 'source_ported', fidelity: 'source_ported', source: { script: 'Items/Ported.gd' }, sim: { runtimeHandler: 'ported-handler', handlerModules: ['sim/ported.js'] }, evidence: null },
      { id: 'gap', name: 'Gap', type: 'Weapon', class: 'Ranger', status: 'source_ported', fidelity: 'source_ported', knownDelta: 'late hook missing', source: { script: 'Items/Gap.gd' }, sim: {}, evidence: null },
      { id: 'shop', name: 'Shop', type: 'Accessory', class: 'Ranger', status: 'no_combat', fidelity: 'no_combat', source: {}, sim: {}, evidence: null },
      { id: 'chess', name: 'Chess Board', type: 'Board', class: 'Ranger', status: 'unsupported_mode', fidelity: 'unsupported_mode', knownDelta: 'AI deferred', source: {}, sim: {}, evidence: null },
      { id: 'proof', name: 'Proof', type: 'Weapon', class: 'Ranger', status: 'source_ported', fidelity: 'source_ported', source: { script: 'Items/Proof.gd' }, sim: { runtimeHandler: 'proof-handler' }, evidence: { sourceHash: 'extract-a', regression: 'sim-proof-smoke', fixture: 'proof-fixture', projections: ['log', 'meter', 'hud'], liveRequired: false } },
      { id: 'shop-proof', name: 'Shop Proof', type: 'Chess Piece', class: 'Neutral', status: 'no_combat', fidelity: 'no_combat', source: { script: 'Items/ShopProof.gd' }, sim: { runtimeHandler: 'shop-proof-handler' }, evidence: { sourceHash: 'extract-a', regression: 'sim-shop-proof-smoke', fixture: 'source shop-only effect fixture', projections: ['log', 'meter', 'hud'], liveRequired: false } },
      { id: 'prepare-proof', name: 'Preparation Proof', type: 'Skill', class: 'Ranger', status: 'source_ported', fidelity: 'source_ported', source: { script: 'Items/Preparation.gd' }, sim: { runtimeHandler: 'prepare-handler' }, evidence: { sourceHash: 'extract-a', regression: 'sim-prepare-smoke', fixture: 'prepared stat fixture', projections: ['hud'], requiredProjections: ['hud'], liveRequired: false } },
    ],
  },
  mechanics: {
    source: { extractFiles: { 'Core/Character.gd': 'character-a' } },
    rows: [
      { id: 'status', category: 'state', source: 'Core/Character.gd', functions: ['stun', 'makeInvulnerable'], simOwners: ['sim/actor.js'], disposition: 'implemented', note: 'owner exists' },
      { id: 'damage', category: 'damage', source: 'Core/Character.gd', functions: ['takeDamage'], simOwners: ['sim/damage.js'], disposition: 'partial', note: 'not complete' },
      { id: 'chess-ai', category: 'unsupported-mode', source: 'Items/Chess.gd', functions: ['tick'], simOwners: [], disposition: 'unsupported', note: 'deferred' },
    ],
  },
};

const dashboard = buildAuditDashboard(source.items, source.mechanics);

assert.equal(dashboard.items.length, 7, 'every item is retained');
assert.equal(dashboard.mechanics.length, 3, 'every shared surface is retained');
assert.equal(dashboard.items.find((row) => row.id === 'ported').verdict, 'evidence_pending');
assert.equal(dashboard.mechanics.find((row) => row.id === 'status').verdict, 'evidence_pending');
assert.equal(dashboard.items.find((row) => row.id === 'gap').verdict, 'confirmed_gap');
assert.equal(dashboard.items.find((row) => row.id === 'shop').verdict, 'no_independent_combat');
assert.equal(dashboard.items.find((row) => row.id === 'shop-proof').verdict, 'verified_1to1', 'retained proof can check a no-combat item with source mechanics');
assert.equal(dashboard.items.find((row) => row.id === 'chess').verdict, 'confirmed_gap');
assert.equal(dashboard.mechanics.find((row) => row.id === 'damage').verdict, 'evidence_pending');
assert.equal(dashboard.mechanics.find((row) => row.id === 'chess-ai').verdict, 'confirmed_gap');
assert.equal(dashboard.items.find((row) => row.id === 'proof').verdict, 'verified_1to1');
assert.equal(dashboard.items.find((row) => row.id === 'prepare-proof').verdict, 'verified_1to1');
assert.equal(dashboard.totals.verified_1to1, 3, 'only retained, applicable proof earns a check');

const publicSummary = buildPublicFidelitySummary(dashboard, 'dashboard-hash');
assert.equal(publicSummary.totals.items, 7);
assert.equal(publicSummary.totals.verified_1to1, 3);
assert.equal(publicSummary.byId.proof, 'verified_1to1');
assert.equal(publicSummary.byId.ported, 'evidence_pending');

console.log('OK sim audit dashboard: conservative verdict contract');
