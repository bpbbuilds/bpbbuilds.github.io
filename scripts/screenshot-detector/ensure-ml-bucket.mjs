/**
 * Ensure public Supabase Storage bucket `ml` exists for detector ONNX.
 *
 *   node scripts/screenshot-detector/ensure-ml-bucket.mjs
 *
 * Prefers Storage API with SUPABASE_SERVICE_ROLE_KEY.
 * Falls back to applying docs/db/sql/023_storage_ml_bucket.sql via SUPABASE_DB_URL.
 */
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { loadEnv, ROOT } from './sample-layouts.mjs';

const env = loadEnv();
const projectUrl = String(env.SUPABASE_PROJECT_URL || '').replace(/\/$/, '');
const serviceKey = String(
  env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || '',
).trim();

/**
 * @param {string} key
 */
async function viaStorageApi(key) {
  const headers = {
    Authorization: `Bearer ${key}`,
    apikey: key,
    'Content-Type': 'application/json',
  };
  const listRes = await fetch(`${projectUrl}/storage/v1/bucket`, { headers });
  const listText = await listRes.text();
  if (!listRes.ok) throw new Error(`list ${listRes.status}: ${listText.slice(0, 300)}`);
  const buckets = JSON.parse(listText);
  const names = Array.isArray(buckets) ? buckets.map((b) => b.id || b.name) : [];
  if (names.includes('ml')) {
    return { ok: true, method: 'storage-api', existed: true };
  }
  const res = await fetch(`${projectUrl}/storage/v1/bucket`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: 'ml',
      name: 'ml',
      public: true,
      file_size_limit: 52428800,
      allowed_mime_types: [
        'application/octet-stream',
        'application/json',
        'application/onnx',
      ],
    }),
  });
  const text = await res.text();
  if (!res.ok && res.status !== 409 && !/already|exists/i.test(text)) {
    throw new Error(`create ${res.status}: ${text.slice(0, 300)}`);
  }
  return { ok: true, method: 'storage-api', created: true };
}

async function viaSql() {
  if (!env.SUPABASE_DB_URL || !env.SUPABASE_DB_PASSWORD) {
    throw new Error('missing SUPABASE_DB_URL / SUPABASE_DB_PASSWORD');
  }
  const sqlPath = path.join(ROOT, 'docs/db/sql/023_storage_ml_bucket.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const base = new URL(env.SUPABASE_DB_URL);
  const connectionString =
    `postgresql://${encodeURIComponent(base.username)}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}` +
    `@${base.hostname}:${base.port || 5432}${base.pathname}`;
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(sql);
    const { rows } = await client.query(
      `select id, public from storage.buckets where id = 'ml'`,
    );
    return {
      ok: true,
      method: 'sql',
      bucket: rows[0] || null,
    };
  } finally {
    await client.end();
  }
}

let result;
try {
  if (projectUrl && serviceKey) {
    result = await viaStorageApi(serviceKey);
  } else {
    throw new Error('no service role — try SQL');
  }
} catch (err) {
  console.error(`storage-api: ${err instanceof Error ? err.message : err}`);
  result = await viaSql();
}

console.log(JSON.stringify(result, null, 2));
