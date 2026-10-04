/**
 * Read-only Premium channel. One embed explains what Premium includes.
 * Staff can still post later. Members cannot.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureGuildChannel } from './channel-reconcile.js';

const API = 'https://discord.com/api/v10';
const GOLD = 0xeac914;
const SITE = 'https://bpbbuilds.com';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const statePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'premium.json');
const HEADER = path.join(ROOT, 'assets', 'brand', 'logo-bpb.png');
const NEWS = '1555346068298924052';
const READ_ONLY_DENY = '380104611840';
const CHANNEL_NAME = '👑│ᴘʀᴇᴍɪᴜᴍ™';

let channelId = '';

export function premiumChannelId() {
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
  const objectPath = 'welcome/premium.png';
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
    console.error(`Premium image failed (${res.status}): ${detail.slice(0, 160)}`);
    return '';
  }
  return `${config.base}/storage/v1/object/public/discord-builds/${objectPath}?v=bpb`;
}

/**
 * @param {string} imageUrl
 */
function payload(imageUrl) {
  const description = [
    'Premium on [BPB Builds](https://bpbbuilds.com/) is **$3 a month**. Founding members keep it forever.',
    'You can\'t type in this channel.',
    '',
    '**Free**',
    '• Item Library, builds, and the board editor',
    '',
    '**Premium**',
    '• Combat sandbox, log, and damage meters',
    '• Export board image',
    '• Premium Crown',
    '',
    'Sign in with Discord on the site, then upgrade from your profile.',
  ].join('\n');
  return {
    content: null,
    embeds: [{
      color: GOLD,
      title: 'Premium',
      url: `${SITE}/`,
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
  const news = await discord(token, `/channels/${NEWS}`);
  const newsRow = news.ok ? await news.json() : null;
  const overwrites = [{ id: guildId, type: 0, allow: '0', deny: READ_ONLY_DENY }];
  const body = {
    name: CHANNEL_NAME,
    topic: 'What Premium includes. Messages here are turned off.',
    permission_overwrites: overwrites,
    ...(newsRow?.parent_id ? { parent_id: newsRow.parent_id } : {}),
    ...(Number.isFinite(newsRow?.position) ? { position: newsRow.position + 1 } : {}),
  };
  return ensureGuildChannel({
    token,
    guildId,
    existingId,
    type: 0,
    name: CHANNEL_NAME,
    body,
    label: 'Premium channel',
  });
}

/**
 * @param {Record<string, string>} env
 */
export async function syncPremium(env) {
  const token = env.DISCORD_BOT_TOKEN || '';
  const guildId = env.DISCORD_GUILD_ID || '';
  const base = String(env.SUPABASE_PROJECT_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!token || !guildId || !base || !key) {
    console.error('Premium channel skipped: missing Discord or Supabase env');
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
      console.error(`Premium edit failed (${patched.status}): ${detail.slice(0, 180)}`);
      return;
    }
    if (!patched.ok) messageId = '';
  }
  if (!messageId) {
    const posted = await discord(token, `/channels/${nextChannel}/messages`, 'POST', body);
    if (!posted.ok) {
      const detail = await posted.text();
      console.error(`Premium post failed (${posted.status}): ${detail.slice(0, 180)}`);
      return;
    }
    const row = await posted.json();
    messageId = String(row.id || '');
  }
  writeState({ channelId: nextChannel, messageId });
  console.log('Premium channel is read-only');
}
