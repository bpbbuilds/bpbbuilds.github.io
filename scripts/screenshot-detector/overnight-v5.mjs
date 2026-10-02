/**
 * v5: synth + real labels (skills + loose jewels), train from v1.
 *
 *   node scripts/screenshot-detector/overnight-v5.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './sample-layouts.mjs';

const out = path.join(ROOT, 'scripts/_cache/synth-detector-v5');
const realOut = path.join(ROOT, 'scripts/_cache/synth-detector-v5-real');
const logPath = path.join(ROOT, 'scripts/_cache/overnight-v5.log');
const v1 = path.join(ROOT, 'scripts/_cache/synth-detector/runs/detect/weights/best.pt');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logPath, line);
  process.stderr.write(line);
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      ...opts,
    });
    child.stdout.on('data', (b) => {
      fs.appendFileSync(logPath, b);
      process.stdout.write(b);
    });
    child.stderr.on('data', (b) => {
      fs.appendFileSync(logPath, b);
      process.stderr.write(b);
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`));
    });
  });
}

fs.writeFileSync(logPath, '');
log('align fixtures');
await run(process.execPath, ['scripts/screenshot-detector/align-real-fixtures.mjs']);
log('label real train fixtures');
await run(process.execPath, [
  'scripts/screenshot-detector/label-fixture-items.mjs',
  '--out',
  realOut,
  '--copies',
  '70',
]);

const shards = [0, 1, 2, 3];
log('scene synth 4×2500');
await Promise.all(
  shards.map((shard) =>
    run(process.execPath, [
      'scripts/screenshot-detector/gen-synth-scene.mjs',
      '--count',
      '2500',
      '--shard',
      String(shard),
      '--out',
      out,
      '--battle',
      '0.4',
    ]),
  ),
);

log('mix real into synth');
await run(process.execPath, [
  'scripts/screenshot-detector/mix-item-real.mjs',
  '--synth',
  out,
  '--real',
  realOut,
]);

if (!fs.existsSync(v1)) throw new Error(`missing v1 weights: ${v1}`);
log('train from v1');
await run('python', [
  'scripts/screenshot-detector/train/train.py',
  '--data',
  path.join(out, 'data.yaml'),
  '--model',
  v1,
  '--epochs',
  '80',
  '--batch',
  '32',
  '--device',
  '0',
  '--project',
  path.join(out, 'runs'),
  '--name',
  'detect',
]);
log('done (not published — eval before go-live)');
