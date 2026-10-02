/**
 * Detector smoke: ONNX Node infer if available, else prior→NCC path check.
 *
 *   node scripts/screenshot-detector/detect-smoke.mjs [shot.png]
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { ROOT } from './sample-layouts.mjs';

const shotArg = process.argv[2];
const shot =
  shotArg ||
  path.join(
    process.env.USERPROFILE || '',
    '.cursor/projects/d-SMOJO-Online-Buisness-BPBWebsite/assets',
    'c__Users_Justin_AppData_Roaming_Cursor_User_workspaceStorage_fcafc5aecf3daf29cd692b4a8d718545_images_image-79a5afb4-8c4c-4e66-925c-c0497c4ed2de.png',
  );

const onnx = path.join(ROOT, 'scripts/_cache/synth-detector/screenshot-detector.onnx');
const classesPath = path.join(ROOT, 'assets/data/detector-classes.json');
const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'assets/data/detector-manifest.json'), 'utf8'),
);

const report = {
  onnxExists: fs.existsSync(onnx),
  classes: JSON.parse(fs.readFileSync(classesPath, 'utf8')).count,
  manifest,
  shotExists: fs.existsSync(shot),
  applyDefaultUsesDetector: true,
  edgeFallback: '?vision=edge',
};

// Prefer paint-smoke / solve-smoke for Falcon/Darksaber placement gate
if (report.shotExists) {
  const sm = spawnSync(
    process.execPath,
    [path.join(ROOT, 'scripts/screenshot-to-build/paint-smoke.mjs'), shot],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
  );
  const out = (sm.stdout || '').replace(/^\uFEFF/, '');
  const i = out.indexOf('{');
  if (i >= 0) {
    try {
      const painted = JSON.parse(out.slice(i));
      report.paintSmoke = {
        Darksaber: painted.Darksaber,
        Falcon: painted.Falcon,
        placed: painted.placed,
        swapRejects: painted.swap?.rejects,
        rmFlameRejects: painted.removeFlame?.rejects,
      };
    } catch {
      report.paintSmokeError = 'json parse failed';
    }
  } else {
    report.paintSmokeError = (sm.stderr || '').slice(-500);
  }
}

// Optional: python eval on shot if weights exist
const weights = path.join(
  ROOT,
  'scripts/_cache/synth-detector/runs/detect/weights/best.pt',
);
if (fs.existsSync(weights) && report.shotExists) {
  const ev = spawnSync(
    'python',
    [
      path.join(ROOT, 'scripts/screenshot-detector/train/eval.py'),
      '--weights',
      weights,
      '--source',
      shot,
      '--conf',
      '0.1',
    ],
    { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 },
  );
  report.evalPredict = (ev.stdout || ev.stderr || '').trim().slice(0, 800);
}

console.log(JSON.stringify(report, null, 2));
console.error(
  [
    `onnx=${report.onnxExists}`,
    `classes=${report.classes}`,
    report.paintSmoke
      ? `Darksaber=${report.paintSmoke.Darksaber} Falcon=${report.paintSmoke.Falcon}`
      : 'paintSmoke=skip',
  ].join(' | '),
);
