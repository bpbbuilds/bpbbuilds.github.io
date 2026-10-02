/**
 * Empty / error status resolution for /sim/.
 *   node scripts/sim-empty-state-smoke.mjs
 */
import {
  resolveSimBoardStatus,
  simStatusShellHtml,
} from '../js/pages/sim/shell/sim-status.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

/** @param {Partial<import('../js/pages/sim/shell/board-load.js').SimBoardLoad>} board */
function status(board) {
  return resolveSimBoardStatus(/** @type {import('../js/pages/sim/shell/board-load.js').SimBoardLoad} */ (board));
}

ok(status(null)?.kind === 'error', 'null board → error');
ok(
  status({ placements: [], error: 'Could not load build “foo”.' })?.kind === 'error',
  'load error → error status',
);
ok(
  status({ placements: [], slug: 'my-build' })?.kind === 'empty' &&
    status({ placements: [], slug: 'my-build' })?.message.includes('my-build'),
  'empty slug build → empty status with slug',
);
ok(
  status({ placements: [], slug: 'my-build', round: 4 })?.message.includes('Round 4'),
  'empty round → round-specific message',
);
ok(
  status({ placements: [] })?.kind === 'empty' &&
    !status({ placements: [] })?.message.includes('“'),
  'no draft/slug → generic empty message',
);
ok(status({ placements: [{ id: 'x', x: 0, y: 0, r: 0, key: 'k' }] }) === null, 'board with items → no status');

const shell = simStatusShellHtml('../', {
  kind: 'error',
  message: 'Bad <script> input',
});
ok(!shell.includes('bpb-skel'), 'status shell has no skeleton markup');
ok(shell.includes('role="alert"'), 'error shell uses alert role');
ok(shell.includes('create/') && shell.includes('builds/'), 'status shell links Create + Builds');
ok(shell.includes('&lt;script&gt;'), 'status shell escapes HTML in message');

if (failed) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log('\nAll empty-state smoke checks passed.');
