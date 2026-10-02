/**
 * Read-only rules channel. One embed, with a banner image above the rules.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { newsChannelId } from './news.js';

const API = 'https://discord.com/api/v10';
const GOLD = 0xeac914;
const SITE = 'https://bpbbuilds.github.io';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const statePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'rules.json');
const HEADER = path.join(ROOT, 'assets', 'brand', 'logo-bpb.png');
const WELCOME = '1554348212423368835';
const MAIN = '1554346073974243448';
const BUILDS = '1553880481001644062';
const IDEAS = '1554346585729540096';
const COSMETICS = '1555344242690359387';
const READ_ONLY_DENY = '380104611840';
const CHANNEL_NAME = '📜│ʀᴜʟᴇꜱ™';

/** @type {Set<string>} */
const kept = new Set();
let channelId = '';

/**
 * @param {string} id
 */
export function isRulesMessage(id) {
  return kept.has(String(id || ''));
}

export function rulesChannelId() {
  return channelId;
}

function remember(id) {
  if (id) kept.add(String(id));
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
  remember(state.messageId);
}

const saved = readState();
channelId = saved.channelId;
remember(saved.messageId);

/**
 * @param {string} token
 * @param {string} apiPath
 * @param {string} [method]
 * @param {object | null} [body]
 */
async function discord(token, apiPath, method = 'GET', body) {
  const res = await fetch(`${API}${apiPath}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

/**
 * @param {{ base: string, key: string }} config
 */
async function hostHeader(config) {
  const png = fs.readFileSync(HEADER);
  const objectPath = 'welcome/rules.png';
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
    console.error(`Rules image failed (${res.status}): ${detail.slice(0, 160)}`);
    return '';
  }
  return `${config.base}/storage/v1/object/public/discord-builds/${objectPath}?v=bpb`;
}

/**
 * @param {string} imageUrl
 */
function payload(imageUrl) {
  const description = [
    '**BPB Builds** is an unofficial fan server for Backpack Battles. It is not affiliated with the game or its developers and publishers.',
    '',
    '**Be decent**',
    'No harassment, hate, slurs, threats, spam, scams, or NSFW. Don\'t post someone else\'s private information.',
    '',
    '**Channels**',
    `<#${WELCOME}> and this channel are notes only. You can't type here.`,
    ...(newsChannelId() ? [`<#${newsChannelId()}> is for site and server news. You can't type there.`] : []),
    `Talk in <#${MAIN}>.`,
    `<#${BUILDS}> is filled by the bot from public site builds. You can reply. You can't start a post.`,
    `<#${IDEAS}> is for item ideas.`,
    `<#${COSMETICS}> is for blob cosmetics you have the right to share. Include the art, the name, and a slot tag.`,
    '',
    '**The site**',
    'Don\'t upload malware, impersonate people, or abuse votes and submissions. A public build is posted in the builds forum. Your nickname keeps the name you set, plus 🎒 and your uploaded build count.',
    '',
    `Staff can remove messages and ban. Site terms: [Terms](${SITE}/legal/terms/).`,
  ].join('\n');
  return {
    content: null,
    embeds: [{
      color: GOLD,
      title: 'Rules',
      url: `${SITE}/legal/terms/`,
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
  const welcome = await discord(token, `/channels/${WELCOME}`);
  const welcomeRow = welcome.ok ? await welcome.json() : null;
  const overwrites = [{ id: guildId, type: 0, allow: '0', deny: READ_ONLY_DENY }];
  const body = {
    name: CHANNEL_NAME,
    topic: 'Server rules. Messages here are turned off.',
    permission_overwrites: overwrites,
    ...(welcomeRow?.parent_id ? { parent_id: welcomeRow.parent_id } : {}),
    ...(Number.isFinite(welcomeRow?.position) ? { position: welcomeRow.position + 1 } : {}),
  };
  if (existingId) {
    const patched = await discord(token, `/channels/${existingId}`, 'PATCH', body);
    if (patched.ok) return existingId;
  }
  const created = await discord(token, `/guilds/${guildId}/channels`, 'POST', { ...body, type: 0 });
  if (!created.ok) {
    const detail = await created.text();
    console.error(`Rules channel failed (${created.status}): ${detail.slice(0, 180)}`);
    return '';
  }
  const row = await created.json();
  return String(row.id || '');
}

/**
 * @param {Record<string, string>} env
 */
export async function syncRules(env) {
  const token = env.DISCORD_BOT_TOKEN || '';
  const guildId = env.DISCORD_GUILD_ID || '';
  const base = String(env.SUPABASE_PROJECT_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!token || !guildId || !base || !key) {
    console.error('Rules channel skipped: missing Discord or Supabase env');
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
      console.error(`Rules edit failed (${patched.status}): ${detail.slice(0, 180)}`);
      return;
    }
    if (!patched.ok) messageId = '';
  }
  if (!messageId) {
    const posted = await discord(token, `/channels/${nextChannel}/messages`, 'POST', body);
    if (!posted.ok) {
      const detail = await posted.text();
      console.error(`Rules post failed (${posted.status}): ${detail.slice(0, 180)}`);
      return;
    }
    const row = await posted.json();
    messageId = String(row.id || '');
  }
  writeState({ channelId: nextChannel, messageId });
  console.log('Rules channel is read-only');
}
