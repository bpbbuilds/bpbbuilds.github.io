/**
 * Read-only market feed. Reports land here once the market exists.
 * Members cannot type. The bot can post later.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureGuildChannel } from './channel-reconcile.js';

const API = 'https://discord.com/api/v10';
const GOLD = 0xeac914;
const SITE = 'https://bpbbuilds.com';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const statePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'market.json');
const HEADER = path.join(ROOT, 'assets', 'brand', 'logo-bpb.png');
const READ_ONLY_DENY = '380104611840';
const CHANNEL_NAME = '📈│ᴍᴀʀᴋᴇᴛ ᴍᴏᴠᴇᴍᴇɴᴛ™';

let channelId = '';

export function marketChannelId() {
  return channelId;
}

/**
 * @returns {{ channelId: string, messageId: string }}
 */
function readState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return {
      channelId: String(parsed?.channelId || ''),
      messageId: String(parsed?.messageId || ''),
    };
  } catch {
    return { channelId: '', messageId: '' };
  }
}

/**
 * @param {{ channelId: string, messageId: string }} state
 */
function writeState(state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  channelId = state.channelId;
}

const saved = readState();
channelId = saved.channelId;

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
 * @param {{ base: string, key: string }} config
 */
async function hostHeader(config) {
  const png = fs.readFileSync(HEADER);
  const objectPath = 'welcome/market-movement.png';
  const res = await fetch(`${config.base}/storage/v1/object/discord-builds/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: png,
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error(`Market image failed (${res.status}): ${detail.slice(0, 160)}`);
    return '';
  }
  return `${config.base}/storage/v1/object/public/discord-builds/${objectPath}?v=bpb`;
}

/**
 * @param {string} imageUrl
 */
function payload(imageUrl) {
  const description = [
    '**Not made yet. TBA.**',
    '',
    'This channel will report new listings, buys, and sales once the market exists.',
    'You can\'t type here.',
    '',
    `[Market](${SITE}/market/)`,
  ].join('\n');
  return {
    content: null,
    embeds: [{
      color: GOLD,
      title: 'Market movement',
      url: `${SITE}/market/`,
      description,
      ...(imageUrl ? { image: { url: imageUrl } } : {}),
    }],
  };
}

/**
 * @param {string} token
 * @param {string} guildId
 * @param {string} existingId
 */
async function ensureChannel(token, guildId, existingId) {
  const overwrites = [{ id: guildId, type: 0, allow: '0', deny: READ_ONLY_DENY }];
  const body = {
    name: CHANNEL_NAME,
    topic: 'Market listings, buys, and sales. Messages here are turned off.',
    permission_overwrites: overwrites,
  };
  return ensureGuildChannel({
    token,
    guildId,
    existingId,
    type: 0,
    name: CHANNEL_NAME,
    body,
    label: 'Market channel',
  });
}

/**
 * @param {Record<string, string>} env
 */
export async function syncMarket(env) {
  const token = env.DISCORD_BOT_TOKEN || '';
  const guildId = env.DISCORD_GUILD_ID || '';
  const base = String(env.SUPABASE_PROJECT_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!token || !guildId || !base || !key) {
    console.error('Market channel skipped: missing Discord or Supabase env');
    return;
  }
  const state = readState();
  const nextChannel = await ensureChannel(token, guildId, state.channelId);
  if (!nextChannel) return;
  channelId = nextChannel;
  const imageUrl = await hostHeader({ base, key });
  const body = payload(imageUrl);
  let messageId = state.messageId;
  if (messageId) {
    const patched = await discord(token, `/channels/${nextChannel}/messages/${messageId}`, 'PATCH', body);
    if (!patched.ok && patched.status !== 404) {
      const detail = await patched.text();
      console.error(`Market edit failed (${patched.status}): ${detail.slice(0, 180)}`);
      return;
    }
    if (!patched.ok) messageId = '';
  }
  if (!messageId) {
    const posted = await discord(token, `/channels/${nextChannel}/messages`, 'POST', body);
    if (!posted.ok) {
      const detail = await posted.text();
      console.error(`Market post failed (${posted.status}): ${detail.slice(0, 180)}`);
      return;
    }
    const row = await posted.json();
    messageId = String(row.id || '');
  }
  writeState({ channelId: nextChannel, messageId });
  console.log('Market movement channel is read-only');
}
