/**
 * Website Stats category. Locked voice channels show live counts in the name.
 * Uploaded builds is every build saved on the site.
 * Founding members is the used count out of the founding cap.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureGuildChannel } from './channel-reconcile.js';

const API = 'https://discord.com/api/v10';
const statePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'stats.json');
const NEWS = '1555345920000000000';
const POLL_MS = 60_000;

let categoryId = '';
let buildsChannelId = '';
let foundingChannelId = '';
let polling = false;

export function statsCategoryId() {
  return categoryId;
}

export function foundingStatsChannelId() {
  return foundingChannelId;
}

/**
 * @returns {{ categoryId: string, buildsChannelId: string, foundingChannelId: string }}
 */
function readState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return {
      categoryId: String(parsed?.categoryId || ''),
      buildsChannelId: String(parsed?.buildsChannelId || ''),
      foundingChannelId: String(parsed?.foundingChannelId || ''),
    };
  } catch {
    return { categoryId: '', buildsChannelId: '', foundingChannelId: '' };
  }
}

/**
 * @param {{ categoryId: string, buildsChannelId: string, foundingChannelId: string }} state
 */
function writeState(state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  categoryId = state.categoryId;
  buildsChannelId = state.buildsChannelId;
  foundingChannelId = state.foundingChannelId;
}

const saved = readState();
categoryId = saved.categoryId;
buildsChannelId = saved.buildsChannelId;
foundingChannelId = saved.foundingChannelId;

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
 * @param {number} used
 * @param {number} total
 */
function foundingName(used, total) {
  return `👑 Founding members: ${used}/${total}`;
}

/**
 * @param {string} base
 * @param {string} key
 * @returns {Promise<{ used: number, total: number } | null>}
 */
async function foundingCount(base, key) {
  const res = await fetch(`${base}/rest/v1/rpc/get_founding_status`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!res.ok) return null;
  const row = await res.json();
  const used = Number(row?.used);
  const total = Number(row?.total);
  if (!Number.isFinite(used)) return null;
  return { used, total: Number.isFinite(total) && total > 0 ? total : 10 };
}

const STATS_CATEGORY_NAME = '📊 Website Stats';

/**
 * Reuse a stats category or counter that is already on the server.
 * @param {string} token
 * @param {string} guildId
 * @param {number} type
 * @param {string} [parentId]
 * @returns {Promise<string | null>}
 */
async function findExisting(token, guildId, type, parentId = '', prefix = '') {
  const res = await discord(token, `/guilds/${guildId}/channels`);
  if (!res.ok) return null;
  const rows = await res.json();
  const found = (Array.isArray(rows) ? rows : []).find((row) => {
    if (row?.type !== type) return false;
    if (type === 4) return row.name === STATS_CATEGORY_NAME;
    if (parentId && row.parent_id !== parentId) return false;
    return prefix && String(row.name || '').startsWith(prefix);
  });
  return found?.id ? String(found.id) : '';
}

/**
 * @param {string} token
 * @param {string} guildId
 * @param {string} category
 * @param {string} existingId
 * @param {string} prefix
 * @param {string} name
 * @param {number} position
 */
async function ensureCounter(token, guildId, category, existingId, prefix, name, position) {
  let id = existingId;
  if (id) {
    const current = await discord(token, `/channels/${id}`);
    if (!current.ok) id = '';
  }
  if (!id) {
    const found = await findExisting(token, guildId, 2, category, prefix);
    if (found === null) return { id: '', created: false, renamed: false };
    id = found;
  }
  if (!id) {
    console.error(`Website stats counter ${prefix} is missing; channel creation is disabled`);
    return { id: '', created: false, renamed: false };
  }
  if (!name) return { id, created: false, renamed: false };
  const current = await discord(token, `/channels/${id}`);
  if (!current.ok) return { id, created, renamed: false };
  const row = await current.json();
  if (row.name === name) return { id, created, renamed: false };
  const patched = await discord(token, `/channels/${id}`, 'PATCH', { name, position });
  if (!patched.ok) {
    const detail = await patched.text();
    console.error(`Stats rename failed (${patched.status}): ${detail.slice(0, 160)}`);
  }
  return { id, created: false, renamed: patched.ok };
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
  const nextCategory = await ensureGuildChannel({
    token,
    guildId,
    existingId: state.categoryId,
    type: 4,
    name: STATS_CATEGORY_NAME,
    body: {
      ...(Number.isFinite(anchor?.position) ? { position: anchor.position + 1 } : {}),
    },
    label: 'Website stats category',
  });
  if (!nextCategory) return;

  const count = await uploadedBuildCount(base, key);
  const builds = await ensureCounter(
    token,
    guildId,
    nextCategory,
    state.buildsChannelId,
    '🎒 Uploaded builds',
    count == null ? '' : buildsName(count),
    0,
  );
  if (!builds.id) return;
  const founding = await foundingCount(base, key);
  const foundingCounter = await ensureCounter(
    token,
    guildId,
    nextCategory,
    state.foundingChannelId,
    '👑 Founding members',
    founding ? foundingName(founding.used, founding.total) : '',
    1,
  );
  writeState({
    categoryId: nextCategory,
    buildsChannelId: builds.id,
    foundingChannelId: foundingCounter.id,
  });
  if (builds.created || builds.renamed) console.log(`Website stats: ${buildsName(count == null ? 0 : count)}`);
  if (founding && (foundingCounter.created || foundingCounter.renamed)) {
    console.log(`Website stats: ${foundingName(founding.used, founding.total)}`);
  }

  if (!polling) {
    polling = true;
    setInterval(() => {
      syncStats(env).catch((err) => console.error(err instanceof Error ? err.message : err));
    }, POLL_MS);
  }
}
