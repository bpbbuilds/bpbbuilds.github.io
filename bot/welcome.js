/**
 * Welcome channel guide. One message, one embed: the site, this server, and YouTube.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { rulesChannelId } from './rules.js';
import { newsChannelId } from './news.js';
import { premiumChannelId } from './premium.js';
import { marketChannelId } from './market.js';
import { questChannelId } from './quest.js';
import { eventsChannelId } from './events-feed.js';
import { cosmeticDropsChannelId } from './cosmetic-drops.js';
import { pastEventsForumId } from './past-events.js';
import { foundingStatsChannelId } from './stats.js';

const API = 'https://discord.com/api/v10';
const GOLD = 0xeac914;
const SITE = 'https://bpbbuilds.com';
const YOUTUBE = 'https://www.youtube.com/@SmojoWasTaken';
const INVITE = 'https://discord.gg/s5WghmrFSp';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOGO = 'assets/brand/logo-bpb.png';
const statePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'welcome-ids.json');

const MAIN = '1554346073974243448';
const BUILDS = '1553880481001644062';
const IDEAS = '1554346585729540096';
const COSMETICS = '1555344242690359387';
const BOTS = '1555306905067323402';
const UPLOADED = '1555346503395053568';
const WELCOME = '1554348212423368835';

/** @type {Set<string>} */
const kept = new Set();

/**
 * @param {string} id
 */
export function isWelcomeMessage(id) {
  return kept.has(String(id || ''));
}

function remember(id) {
  if (id) kept.add(String(id));
}

/** @type {Map<string, string>} */
const savedMessageMap = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {string} token
 * @param {string} apiPath
 * @param {string} [method]
 * @param {object | null} [body]
 */
async function discord(token, apiPath, method = 'GET', body) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(`${API}${apiPath}`, {
      method,
      headers: {
        Authorization: `Bot ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status !== 429 || method === 'POST') return res;
    const retry = await res.json().catch(() => ({}));
    await sleep(Math.ceil(Number(retry.retry_after || 1) * 1000));
  }
  return fetch(`${API}${apiPath}`, {
    method,
    headers: { Authorization: `Bot ${token}` },
  });
}

/**
 * @param {{ base: string, key: string }} config
 * @param {string} name
 * @param {string} filePath
 */
async function hostImage(config, name, filePath, version = '') {
  const bytes = fs.readFileSync(path.join(ROOT, filePath));
  const gif = path.extname(filePath).toLowerCase() === '.gif';
  const suffix = version ? `-${version}` : '';
  const objectPath = `welcome/${name}${suffix}${gif ? '.gif' : '.png'}`;
  if (gif) {
    await fetch(`${config.base}/storage/v1/bucket/discord-builds`, {
      method: 'PUT',
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        public: true,
        file_size_limit: 10485760,
        allowed_mime_types: ['image/png', 'image/gif'],
      }),
    });
  }
  const res = await fetch(`${config.base}/storage/v1/object/discord-builds/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': gif ? 'image/gif' : 'image/png',
      'x-upsert': 'true',
    },
    body: bytes,
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error(`Welcome image ${name} failed (${res.status}): ${detail.slice(0, 160)}`);
    return '';
  }
  return `${config.base}/storage/v1/object/public/discord-builds/${objectPath}`;
}

/**
 * @param {Array<string | false>} parts
 */
function lines(parts) {
  return parts.filter((part) => part !== false).join('\n');
}

/**
 * @param {string} name
 * @param {string} value
 */
function column(name, value) {
  return { name, value, inline: true };
}

/**
 * @param {string[]} ids
 */
function mentions(ids) {
  return ids.filter(Boolean).map((id) => `<#${id}>`).join('\n');
}

/**
 * One embed. Inline fields are the columns. Channel lists are the category, then the tags.
 * @param {string} imageUrl
 */
function guide(imageUrl) {
  const blank = '\u200b';
  return {
    color: GOLD,
    title: 'Welcome to BPB Builds',
    url: SITE,
    description: lines([
      `This channel is the welcome note. You can't type here. Say hello in <#${MAIN}>.`,
      '',
      '**BPB Builds** is an unofficial fan site for Backpack Battles: guides, an item library, a build creator, events, and a combat sandbox. It is not affiliated with the game or its developers and publishers.',
      '',
      'Your nickname keeps the name you set, then ` | 🎒 ` and your uploaded build count.',
      '',
      `[Invite](${INVITE})`,
    ]),
    fields: [
      column('The site', lines([
        `[Items](${SITE}/items/)`,
        `[Builds](${SITE}/builds/)`,
        `[Create](${SITE}/create/)`,
      ])),
      column(blank, lines([
        `[Events](${SITE}/events/)`,
        `[Market](${SITE}/market/)`,
        `[Quest](${SITE}/quest/)`,
      ])),
      column(blank, lines([
        `[Sim](${SITE}/sim/)`,
        `[Profile](${SITE}/u/)`,
        `[About](${SITE}/legal/about/)`,
        `[Terms](${SITE}/legal/terms/)`,
        `[Privacy](${SITE}/legal/privacy/)`,
      ])),
      column('Information', mentions([
        WELCOME,
        rulesChannelId(),
        newsChannelId(),
        premiumChannelId(),
      ])),
      column('Community info', mentions([
        questChannelId(),
        marketChannelId(),
        eventsChannelId(),
        cosmeticDropsChannelId(),
      ])),
      column('Chat', mentions([MAIN, BOTS])),
      column('Forums', mentions([
        BUILDS,
        IDEAS,
        COSMETICS,
        pastEventsForumId(),
      ])),
      column('Website Stats', mentions([UPLOADED, foundingStatsChannelId()])),
      column('YouTube', `[@SmojoWasTaken](${YOUTUBE})`),
    ],
    ...(imageUrl ? { image: { url: imageUrl } } : {}),
  };
}

/**
 * @returns {{ ids: string[] }}
 */
function readState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const ids = Array.isArray(parsed?.ids) ? parsed.ids.map(String).filter(Boolean) : [];
    return { ids };
  } catch {
    return { ids: [] };
  }
}

/**
 * @param {string[]} ids
 */
function writeState(ids) {
  ids = ids.filter(Boolean).map(String);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  // Save only the IDs we need to track (last posted message per payload slot)
  const stateIds = ids.slice(0, 2); // We track up to 2 messages max
  fs.writeFileSync(statePath, JSON.stringify({ ids: stateIds }, null, 2));
  for (const id of ids) remember(id);
}

/** @type {Set<string>} */
const keptIds = new Set();

/**
 * @param {string} id
 * @param {string} [channelId]
 */
function rememberId(id, channelId) {
  if (id) {
    keptIds.add(id);
    // Also track in a map keyed by channel for cross-restart safety
    savedMessageMap.set(channelId || 'welcome', id);
  }
}


/**
 * @param {Record<string, string>} env
 */
export async function syncWelcome(env) {
  const token = env.DISCORD_BOT_TOKEN || '';
  const channelId = env.DISCORD_WELCOME_CHANNEL_ID || WELCOME;
  const legacyId = env.DISCORD_WELCOME_MESSAGE_ID || '1555306729808597093';
  const base = String(env.SUPABASE_PROJECT_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!token || !channelId || !base || !key) {
    console.error('Welcome guide skipped: missing Discord or Supabase env');
    return;
  }

  remember(legacyId);
  const { ids: savedIds } = readState();

  // Build a map of saved message IDs by channel for cross-restart safety
  for (const id of savedIds) {
    savedMessageMap.set(channelId || 'welcome', id);
  }

  // Track the legacy/message ID we always want to keep
  const idsToTrack = new Set();
  if (savedIds.length > 0) {
    for (const id of savedIds) {
      idsToTrack.add(id);
    }
  }
  idsToTrack.add(legacyId);

  const logo = await hostImage({ base, key }, 'welcome', LOGO, '24b');
  const payloads = [{ embeds: [guide(logo)] }];
  /** @type {string[]} */
  const ids = new Array(payloads.length).fill('');

  for (let i = 0; i < payloads.length; i += 1) {
    const body = { content: null, embeds: payloads[i].embeds };
    const existingId = savedIds[i] || savedMessageMap.get(channelId || 'welcome') || '';

    // Try to patch the existing message first
    if (existingId) {
      const patched = await discord(token, `/channels/${channelId}/messages/${existingId}`, 'PATCH', body);
      if (patched.ok) {
        rememberId(existingId, channelId);
        ids[i] = existingId;
        continue;
      }
      if (patched.status !== 404) {
        const detail = await patched.text();
        console.error(`Welcome edit failed (${patched.status}): ${detail.slice(0, 180)}`);
      }
    }

    // Post new message if patch failed or no existing ID
    const posted = await discord(token, `/channels/${channelId}/messages`, 'POST', body);
    if (!posted.ok) {
      const detail = await posted.text();
      console.error(`Welcome post failed (${posted.status}): ${detail.slice(0, 180)}`);
      break;
    }
    const row = await posted.json();
    ids[i] = String(row.id || '');
    rememberId(ids[i], channelId);
  }

  // Write state: track up to 2 messages for cross-restart safety
  const stateIds = [...new Set([...savedIds, ...ids])].slice(0, 2);
  writeState(stateIds);

  // Delete any other messages in the welcome channel that aren't our tracked ones
  if (ids.length > 0) {
    const keepId = ids[0] || '';
    await deleteOtherMessages(token, channelId, keepId);
  }

  // Update the kept set for isWelcomeMessage checks
  keptIds.clear();
  for (const id of savedIds) keptIds.add(id);
  for (const id of ids) keptIds.add(id);

  console.log('Welcome guide updated (1 message)');
}

/**
 * @param {string} token
 * @param {string} channelId
 * @param {string} keepId
 */
async function deleteOtherMessages(token, channelId, keepId) {
  let before = '';
  for (;;) {
    const query = before ? `?limit=100&before=${before}` : '?limit=100';
    const listed = await discord(token, `/channels/${channelId}/messages${query}`);
    if (!listed.ok) {
      const detail = await listed.text();
      console.error(`Welcome list failed (${listed.status}): ${detail.slice(0, 180)}`);
      return;
    }
    const rows = await listed.json();
    if (!Array.isArray(rows) || !rows.length) return;
    for (const row of rows) {
      const id = String(row?.id || '');
      if (!id || id === keepId) continue;
      const removed = await discord(token, `/channels/${channelId}/messages/${id}`, 'DELETE');
      if (!removed.ok && removed.status !== 404) {
        const detail = await removed.text();
        console.error(`Welcome delete failed (${removed.status}): ${detail.slice(0, 180)}`);
      }
      await sleep(350);
    }
    if (rows.length < 100) return;
    before = String(rows[rows.length - 1]?.id || '');
    if (!before) return;
  }
}
