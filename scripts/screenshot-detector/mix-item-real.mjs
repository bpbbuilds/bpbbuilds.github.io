/**
 * Mix real-aug item images into a scene-synth train/val set (~12% of train).
 *
 *   node scripts/screenshot-detector/mix-item-real.mjs \
 *     --synth scripts/_cache/synth-detector-v5 \
 *     --real scripts/_cache/synth-detector-v5-real
 */
import fs from 'fs';
import path from 'path';
import { ROOT } from './sample-layouts.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const synthRoot = path.resolve(arg('--synth', path.join(ROOT, 'scripts/_cache/synth-detector-v5')));
const realRoot = path.resolve(arg('--real', path.join(ROOT, 'scripts/_cache/synth-detector-v5-real')));
const targetFrac = Number(arg('--frac', '0.12'));

function listStems(imgDir) {
  if (!fs.existsSync(imgDir)) return [];
  return fs
    .readdirSync(imgDir)
    .filter((f) => /\.(jpg|jpeg|png)$/i.test(f))
    .map((f) => path.basename(f, path.extname(f)));
}

function copyStem(stem, fromImg, fromLbl, toImg, toLbl, prefix) {
  const srcJpg = path.join(fromImg, `${stem}.jpg`);
  const srcPng = path.join(fromImg, `${stem}.png`);
  const srcImg = fs.existsSync(srcJpg) ? srcJpg : srcPng;
  const ext = path.extname(srcImg);
  const destStem = `${prefix}${stem}`;
  fs.copyFileSync(srcImg, path.join(toImg, `${destStem}${ext}`));
  const lbl = path.join(fromLbl, `${stem}.txt`);
  if (fs.existsSync(lbl)) fs.copyFileSync(lbl, path.join(toLbl, `${destStem}.txt`));
}

const trainStems = listStems(path.join(synthRoot, 'images/train'));
const realTrain = listStems(path.join(realRoot, 'images/train'));
const realVal = listStems(path.join(realRoot, 'images/val'));
if (!trainStems.length) throw new Error(`missing synth train at ${synthRoot}`);
if (!realTrain.length) throw new Error(`missing real train at ${realRoot}`);

const want = Math.max(1, Math.round(trainStems.length * targetFrac));
/** @type {string[]} */
const picks = [];
while (picks.length < want) {
  for (const s of realTrain) {
    picks.push(s);
    if (picks.length >= want) break;
  }
}

let copied = 0;
for (let i = 0; i < picks.length; i += 1) {
  copyStem(
    picks[i],
    path.join(realRoot, 'images/train'),
    path.join(realRoot, 'labels/train'),
    path.join(synthRoot, 'images/train'),
    path.join(synthRoot, 'labels/train'),
    `real_${i}_`,
  );
  copied += 1;
}
for (const s of realVal) {
  copyStem(
    s,
    path.join(realRoot, 'images/val'),
    path.join(realRoot, 'labels/val'),
    path.join(synthRoot, 'images/val'),
    path.join(synthRoot, 'labels/val'),
    'real_',
  );
}

const summary = {
  synthTrainBefore: trainStems.length,
  realCopiedTrain: copied,
  realVal: realVal.length,
  frac: Number((copied / (trainStems.length + copied)).toFixed(3)),
};
fs.writeFileSync(path.join(synthRoot, 'mix-real-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
