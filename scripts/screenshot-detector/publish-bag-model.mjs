/**
 * Publish bag-only ONNX + classes (local assets by default).
 *
 *   node scripts/screenshot-detector/publish-bag-model.mjs \
 *     --onnx scripts/_cache/synth-detector-bags/screenshot-detector-bags.onnx \
 *     --version bags-v1
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

const version = String(arg('--version', 'bags-v1'));
const onnxPath = path.resolve(
  arg(
    '--onnx',
    path.join(ROOT, 'scripts/_cache/synth-detector-bags/screenshot-detector-bags.onnx'),
  ),
);
const classesPath = path.resolve(
  arg('--classes', path.join(ROOT, 'assets/data/detector-bag-classes.json')),
);
const inputSize = Number(arg('--imgsz', '640')) | 0;
const dryRun = process.argv.includes('--dry-run');
const localOnly = process.argv.includes('--local') || dryRun;

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
const classCount = JSON.parse(classesBuf.toString('utf8')).count;

const env = loadEnv();
const projectUrl = String(env.SUPABASE_PROJECT_URL || '').replace(/\/$/, '');
const key =
  env.SUPABASE_SERVICE_ROLE_KEY ||
  env.SUPABASE_SECRET_KEY ||
  env.SUPABASE_PUBLISHABLE_KEY ||
  '';

const bucket = 'ml';
const onnxKey = `screenshot-detector/${version}/screenshot-detector-bags.onnx`;
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

/** @type {Record<string, any>} */
const manifest = {
  version,
  inputSize,
  sha256,
  url: `/assets/ml/screenshot-detector/${version}/screenshot-detector-bags.onnx`,
  classesUrl: '/assets/data/detector-bag-classes.json',
  classCount,
  updatedAt: new Date().toISOString(),
  local: true,
};

const localDir = path.join(ROOT, 'assets/ml/screenshot-detector', version);
fs.mkdirSync(localDir, { recursive: true });
fs.copyFileSync(onnxPath, path.join(localDir, 'screenshot-detector-bags.onnx'));
fs.copyFileSync(classesPath, path.join(localDir, 'classes.json'));

if (!localOnly && projectUrl && key) {
  try {
    console.error(`uploading to ${bucket}/${onnxKey}…`);
    await upload(onnxKey, onnxBuf, 'application/octet-stream');
    await upload(classesKey, classesBuf, 'application/json');
    manifest.url = `${projectUrl}/storage/v1/object/public/${bucket}/${onnxKey}`;
    manifest.classesUrl = `${projectUrl}/storage/v1/object/public/${bucket}/${classesKey}`;
    manifest.local = false;
  } catch (err) {
    console.error(String(err));
    console.error('Upload failed — keeping local assets/ml copy');
    manifest.uploadError = String(err instanceof Error ? err.message : err);
  }
} else {
  console.error('local bag model publish (no Storage upload)');
}

const manifestPath = path.join(ROOT, 'assets/data/detector-bag-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
console.error(`wrote ${manifestPath}`);
