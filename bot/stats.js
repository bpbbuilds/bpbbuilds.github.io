/**
 * Website Stats category. Locked voice channels show live counts in the name.
 * Uploaded builds is every build saved on the site.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const API = 'https://discord.com/api/v10';
const statePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'stats.json');
const NEWS = '1555345920000000000';
const CONNECT_DENY = '1048576';
const POLL_MS = 60_000;

let categoryId = '';
let buildsChannelId = '';
let polling = false;

export function statsCategoryId() {
  return categoryId;
}

/**
 * @returns {{ categoryId: string, buildsChannelId: string }}
 */
function readState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return {
      categoryId: String(parsed?.categoryId || ''),
      buildsChannelId: String(parsed?.buildsChannelId || ''),
    };
  } catch {
    return { categoryId: '', buildsChannelId: '' };
  }
}

/**
 * @param {{ categoryId: string, buildsChannelId: string }} state
 */
function writeState(state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  categoryId = state.categoryId;
  buildsChannelId = state.buildsChannelId;
}

const saved = readState();
categoryId = saved.categoryId;
buildsChannelId = saved.buildsChannelId;

/**
 * @param {string} token
 * @param {string} apiPath
 * @param {string} [method]
 * @param {object | null} [body]
 */
async function discord(token, apiPath, method = 'GET', body) {
  return fetch(`${API}${apiPath}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * @param {string} base
 * @param {string} key
 */
async function uploadedBuildCount(base, key) {
  const res = await fetch(`${base}/rest/v1/builds?select=id`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });
  if (!res.ok) return null;
  const total = Number((res.headers.get('content-range') || '').split('/')[1]);
  return Number.isFinite(total) ? total : null;
}

/**
 * @param {number} count
 */
function buildsName(count) {
  return `🎒 Uploaded builds: ${count}`;
}

/**
 * Keep the honeypot at the bottom of the server list.
 * @param {string} token
 * @param {string} guildId
 * @param {string} honeypotId
 */
async function keepHoneypotLast(token, guildId, honeypotId) {
  if (!honeypotId) return;
  const res = await discord(token, `/guilds/${guildId}/channels`);
  if (!res.ok) return;
  const rows = await res.json();
  if (!Array.isArray(rows)) return;
  const honeypot = rows.find((row) => row.id === honeypotId);
  if (!honeypot) return;
  const maxOther = rows
    .filter((row) => row.id !== honeypotId)
    .reduce((top, row) => Math.max(top, Number(row.position) || 0), 0);
  if (Number(honeypot.position) > maxOther) return;
  await discord(token, `/channels/${honeypotId}`, 'PATCH', { position: maxOther + 1 });
}

/**
 * @param {string} token
 * @param {string} guildId
 * @param {string} existingId
 * @param {number} type
 * @param {object} body
 */
async function ensureChannel(token, guildId, existingId, type, body) {
  if (existingId) {
    const current = await discord(token, `/channels/${existingId}`);
    if (current.ok) return existingId;
  }
  const created = await discord(token, `/guilds/${guildId}/channels`, 'POST', { ...body, type });
  if (!created.ok) {
    const detail = await created.text();
    console.error(`Stats channel failed (${created.status}): ${detail.slice(0, 180)}`);
    return '';
  }
  const row = await created.json();
  return String(row.id || '');
}

/**
 * @param {Record<string, string>} env
 */
export async function syncStats(env) {
  const token = env.DISCORD_BOT_TOKEN || '';
  const guildId = env.DISCORD_GUILD_ID || '';
  const base = String(env.SUPABASE_PROJECT_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!token || !guildId || !base || !key) {
    console.error('Website stats skipped: missing Discord or Supabase env');
    return;
  }

  const newsPath = path.join(path.dirname(statePath), 'news.json');
  let newsId = '';
  try {
    newsId = String(JSON.parse(fs.readFileSync(newsPath, 'utf8'))?.channelId || '');
  } catch {
    newsId = '';
  }
  const premiumPath = path.join(path.dirname(statePath), 'premium.json');
  let premiumId = '';
  try {
    premiumId = String(JSON.parse(fs.readFileSync(premiumPath, 'utf8'))?.channelId || '');
  } catch {
    premiumId = '';
  }
  const anchorId = premiumId || newsId || NEWS;
  const anchorRes = await discord(token, `/channels/${anchorId}`);
  const anchor = anchorRes.ok ? await anchorRes.json() : null;
  const state = readState();
  const nextCategory = await ensureChannel(token, guildId, state.categoryId, 4, {
    name: '📊 Website Stats',
    ...(Number.isFinite(anchor?.position) ? { position: anchor.position + 1 } : {}),
  });
  if (!nextCategory) return;

  const count = await uploadedBuildCount(base, key);
  const name = buildsName(count == null ? 0 : count);
  let nextBuilds = state.buildsChannelId;
  let renamed = false;
  if (nextBuilds) {
    const current = await discord(token, `/channels/${nextBuilds}`);
    if (!current.ok) nextBuilds = '';
    else {
      const row = await current.json();
      if (row.name !== name && count != null) {
        const patched = await discord(token, `/channels/${nextBuilds}`, 'PATCH', { name });
        renamed = patched.ok;
        if (!patched.ok) {
          const detail = await patched.text();
          console.error(`Stats rename failed (${patched.status}): ${detail.slice(0, 160)}`);
        }
      }
    }
  }
  const created = !nextBuilds;
  if (!nextBuilds) {
    nextBuilds = await ensureChannel(token, guildId, '', 2, {
      name,
      parent_id: nextCategory,
      permission_overwrites: [{ id: guildId, type: 0, allow: '0', deny: CONNECT_DENY }],
    });
  }
  if (!nextBuilds) return;
  writeState({ categoryId: nextCategory, buildsChannelId: nextBuilds });
  if (created || nextCategory !== state.categoryId) {
    await keepHoneypotLast(token, guildId, env.DISCORD_HONEYPOT_CHANNEL_ID || '');
  }
  if (created || renamed) console.log(`Website stats: ${name}`);

  if (!polling) {
    polling = true;
    setInterval(() => {
      syncStats(env).catch((err) => console.error(err instanceof Error ? err.message : err));
    }, POLL_MS);
  }
}
