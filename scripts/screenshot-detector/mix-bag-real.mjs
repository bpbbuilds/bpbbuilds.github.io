/**
 * Mix real-aug bag images into synth-detector-bags-v2 train/val (~12% of train lines).
 *
 *   node scripts/screenshot-detector/mix-bag-real.mjs
 */
import fs from 'fs';
import path from 'path';
import { ROOT } from './sample-layouts.mjs';

const synthRoot = path.join(ROOT, 'scripts/_cache/synth-detector-bags-v2');
const realRoot = path.join(ROOT, 'scripts/_cache/synth-detector-bags-real');
const targetFrac = 0.12;

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
  if (fs.existsSync(lbl)) {
    fs.copyFileSync(lbl, path.join(toLbl, `${destStem}.txt`));
  }
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
for (let i = 0; i < picks.length; i++) {
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
fs.writeFileSync(
  path.join(synthRoot, 'mix-real-summary.json'),
  JSON.stringify(summary, null, 2),
);
console.log(JSON.stringify(summary, null, 2));
