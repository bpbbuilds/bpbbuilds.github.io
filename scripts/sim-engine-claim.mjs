/**
 * Phase 268–270 — tech gates + marketing lock + honest closeout (not engine 1:1).
 *   node scripts/sim-engine-claim.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  allEngine11Gates,
  bannerTitleClaimsEngine11,
  engineBannerCopy,
  phase38AllowsEngine11Marketing,
} from '../js/pages/sim/shell/engine-claim.js';
import { isLiveFilled } from '../js/pages/sim/engine/parity-live.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'data', 'sim-engine-claim.json');
const FIX_DIR = path.join(__dirname, 'fixtures', 'parity');

const STAPLE_SLUGS = [
  'poison-garden-ranger',
  'pyro-furnace',
  'berserk-bloodline',
  'reaper-harvest',
  'history-3705',
  'history-3703',
];

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

const census = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'assets/data/sim-ap-census.json'), 'utf8'),
);
const aq = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/sim-aq-smoke.json'), 'utf8'));
const staple = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'assets/data/sim-staple-boards.json'), 'utf8'),
);

const gate252 =
  Number(census.genericCdCount) === 0 &&
  Number(census.genericOtherCount) === 0 &&
  Number(census.handPortMissingCount) === 0;

const gate258 = (aq.dumps || []).length >= 2 && (aq.dumps || []).every(
  (d) => (d.paramCheckCount || 0) === 0 && (d.mismatchCount || 0) === 0,
);

const gate264 =
  (staple.dumps || []).length === 6 &&
  (staple.dumps || []).every((d) => (d.mismatchCount || 0) === 0);

const gate265 = STAPLE_SLUGS.every((slug) => {
  const fp = path.join(FIX_DIR, `${slug}.json`);
  if (!fs.existsSync(fp)) return false;
  const fix = JSON.parse(fs.readFileSync(fp, 'utf8'));
  return isLiveFilled(fix.live);
});

const gates = {
  252: gate252,
  258: gate258,
  264: gate264,
  265: gate265,
};

ok(gate252, `gate 252 census leftover 0 (cd=${census.genericCdCount} other=${census.genericOtherCount})`);
ok(gate258, 'gate 258 AQ dumps empty flags');
ok(gate264, 'gate 264 staple ui.mismatches empty');
console.log(`gate 265 live staple captures: ${gate265}`);

const legal = {
  phase38CounselReview: false,
  allowPublicMatchesTheGameMarketing: false,
};

ok(!phase38AllowsEngine11Marketing(legal), 'Phase 38 marketing flags stay off');

const coverage = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'assets/data/sim-item-coverage.json'), 'utf8'),
);
const copy = engineBannerCopy(
  gates,
  {
    solidPct: coverage.goal?.solidPct,
    parityPct: coverage.goal?.parityPct,
  },
  legal,
);
ok(
  bannerTitleClaimsEngine11(copy.title) ===
    (allEngine11Gates(gates) && phase38AllowsEngine11Marketing(legal)),
  `banner title 1:1 iff tech gates + Phase 38 (${copy.title})`,
);
if (!bannerTitleClaimsEngine11(copy.title)) {
  ok(/partial \/ fixture subset/i.test(copy.detail), 'banner detail says partial / fixture subset');
}

{
  const tech = { 252: true, 258: true, 264: true, 265: true };
  const blocked = engineBannerCopy(tech, { solidPct: 100, parityPct: 100 }, legal);
  ok(
    !bannerTitleClaimsEngine11(blocked.title),
    'all tech gates without Phase 38 do not title Engine 1:1',
  );
  const allowed = engineBannerCopy(tech, { solidPct: 100, parityPct: 100 }, {
    phase38CounselReview: true,
    allowPublicMatchesTheGameMarketing: true,
  });
  ok(bannerTitleClaimsEngine11(allowed.title), 'tech gates + counsel flags → Engine 1:1 title');
}

const about = fs.readFileSync(path.join(ROOT, 'legal/about/index.html'), 'utf8');
const terms = fs.readFileSync(path.join(ROOT, 'legal/terms/index.html'), 'utf8');
ok(/Combat sandbox/i.test(about), 'About mentions Combat sandbox');
ok(/matches the game/i.test(about) || /not official combat/i.test(about), 'About blocks official combat claim');
ok(/combat sandbox/i.test(terms), 'Terms mention combat sandbox');

const privacy = fs.readFileSync(path.join(ROOT, 'legal/privacy/index.html'), 'utf8');
ok(/Combat sandbox/i.test(privacy), 'Privacy mentions Combat sandbox');

const footer = fs.readFileSync(path.join(ROOT, 'js/shared/footer.js'), 'utf8');
ok(/combat sandbox/i.test(footer) && /matching the live game/i.test(footer), 'Footer disclaimer mentions unofficial sandbox');

const ipDoc = fs.readFileSync(path.join(ROOT, 'docs/sim/sim-ip-marketing.md'), 'utf8');
ok(/No-go/i.test(ipDoc) && /Not a counsel sign-off/i.test(ipDoc), 'IP marketing note is a no-go, not a sign-off');

const leftoverParamChecks = (staple.dumps || []).reduce(
  (n, d) => n + (d.paramCheckCount || 0),
  0,
);
const blockers = {
  liveStapleCaptures: !gate265,
  phase38Counsel: !phase38AllowsEngine11Marketing(legal),
  chessBoardAi: true,
  leftoverStapleParamChecks: leftoverParamChecks > 0,
};
const engine11Achieved = false;

ok(!engine11Achieved, '270: engine11Achieved stays false');
ok(
  blockers.liveStapleCaptures || blockers.phase38Counsel || blockers.chessBoardAi,
  '270: at least one documented blocker remains',
);

const payload = {
  builtAt: new Date().toISOString(),
  phase: 270,
  claimEngine11: allEngine11Gates(gates) && phase38AllowsEngine11Marketing(legal),
  engine11Achieved,
  gates,
  legal,
  blockers,
  leftoverStapleParamChecks: leftoverParamChecks,
  bannerTitle: copy.title,
  note: 'AP–AS numbered ladder closed. Engine 1:1 is not claimed: need live staple captures, Phase 38 counsel, chess AI, leftover staple paramChecks.',
};

ok(!payload.claimEngine11, '270: claimEngine11 stays false');
ok(!bannerTitleClaimsEngine11(copy.title), '270: banner does not title Engine 1:1');

const phases = fs.readFileSync(path.join(ROOT, 'docs/sim/sim-phases.md'), 'utf8');
ok(/270 — Ladder closeout/i.test(phases), 'sim-phases 270 is ladder closeout, not a 1:1 claim');
ok(/Engine 1:1 is \*\*not\*\* claimed/i.test(phases), 'sim-phases says 1:1 is not claimed');

fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${path.relative(ROOT, OUT)} claimEngine11=${payload.claimEngine11}`);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nEngine-claim 268–270 passed');
