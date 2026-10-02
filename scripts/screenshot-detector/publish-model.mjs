/**
 * Publish ONNX + classes to Supabase Storage and write detector-manifest.json.
 *
 *   node scripts/screenshot-detector/publish-model.mjs \
 *     --onnx scripts/_cache/synth-detector/screenshot-detector.onnx \
 *     --version v1
 *
 * Env: SUPABASE_PROJECT_URL + SUPABASE_SERVICE_ROLE_KEY (or publishable if bucket public write — prefer service role).
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { loadEnv, ROOT } from './sample-layouts.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const version = String(arg('--version', 'v1'));
const onnxPath = path.resolve(
  arg('--onnx', path.join(ROOT, 'scripts/_cache/synth-detector/screenshot-detector.onnx')),
);
const classesPath = path.resolve(
  arg('--classes', path.join(ROOT, 'assets/data/detector-classes.json')),
);
const inputSize = Number(arg('--imgsz', '640')) | 0;
const dryRun = process.argv.includes('--dry-run');

if (!fs.existsSync(onnxPath)) {
  console.error(`missing onnx: ${onnxPath}`);
  process.exit(1);
}
if (!fs.existsSync(classesPath)) {
  console.error(`missing classes: ${classesPath}`);
  process.exit(1);
}

const onnxBuf = fs.readFileSync(onnxPath);
const classesBuf = fs.readFileSync(classesPath);
const sha256 = crypto.createHash('sha256').update(onnxBuf).digest('hex');

const env = loadEnv();
const projectUrl = String(env.SUPABASE_PROJECT_URL || '').replace(/\/$/, '');
const key =
  env.SUPABASE_SERVICE_ROLE_KEY ||
  env.SUPABASE_SECRET_KEY ||
  env.SUPABASE_PUBLISHABLE_KEY ||
  '';

const bucket = 'ml';
const onnxKey = `screenshot-detector/${version}/screenshot-detector.onnx`;
const classesKey = `screenshot-detector/${version}/classes.json`;

/**
 * @param {string} objectPath
 * @param {Buffer} body
 * @param {string} contentType
 */
async function upload(objectPath, body, contentType) {
  const url = `${projectUrl}/storage/v1/object/${bucket}/${objectPath}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`upload ${objectPath} failed ${res.status}: ${text.slice(0, 300)}`);
  }
}

const publicOnnx = `${projectUrl}/storage/v1/object/public/${bucket}/${onnxKey}`;
const publicClasses = `${projectUrl}/storage/v1/object/public/${bucket}/${classesKey}`;

const manifest = {
  version,
  inputSize,
  sha256,
  url: publicOnnx,
  classesUrl: publicClasses,
  classCount: JSON.parse(classesBuf.toString('utf8')).count,
  updatedAt: new Date().toISOString(),
};

if (dryRun || !projectUrl || !key) {
  console.error(
    dryRun
      ? 'dry-run: writing local assets manifest'
      : 'missing SUPABASE_PROJECT_URL / service key — writing local assets manifest',
  );
  const localDir = path.join(ROOT, 'assets/ml/screenshot-detector', version);
  fs.mkdirSync(localDir, { recursive: true });
  fs.copyFileSync(onnxPath, path.join(localDir, 'screenshot-detector.onnx'));
  manifest.url = `/assets/ml/screenshot-detector/${version}/screenshot-detector.onnx`;
  manifest.classesUrl = '/assets/data/detector-classes.json';
  manifest.local = true;
} else {
  console.error(`uploading to ${bucket}/${onnxKey}…`);
  try {
    await upload(onnxKey, onnxBuf, 'application/octet-stream');
    await upload(classesKey, classesBuf, 'application/json');
  } catch (err) {
    console.error(String(err));
    console.error('Upload failed — falling back to local assets/ml copy');
    const localDir = path.join(ROOT, 'assets/ml/screenshot-detector', version);
    fs.mkdirSync(localDir, { recursive: true });
    fs.copyFileSync(onnxPath, path.join(localDir, 'screenshot-detector.onnx'));
    manifest.url = `/assets/ml/screenshot-detector/${version}/screenshot-detector.onnx`;
    manifest.classesUrl = '/assets/data/detector-classes.json';
    manifest.local = true;
    manifest.uploadError = String(err instanceof Error ? err.message : err);
  }
}

const manifestPath = path.join(ROOT, 'assets/data/detector-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
console.error(`wrote ${manifestPath}`);
