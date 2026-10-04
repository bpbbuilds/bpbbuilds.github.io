/**
 * Staff-only community updates channel.
 * Hidden from @everyone. The Admin role can see it and post.
 * That role does not get server-wide administrator powers.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureGuildChannel } from './channel-reconcile.js';

const API = 'https://discord.com/api/v10';
const GOLD = 0xeac914;
const ROLE_COLOR = 0x3c261d;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const statePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'community.json');
const HEADER = path.join(ROOT, 'assets', 'brand', 'logo-bpb.png');
const CHANNEL_NAME = '🛡️│ᴄᴏᴍᴍᴜɴɪᴛʏ ᴜᴘᴅᴀᴛᴇꜱ™';
const ROLE_NAME = 'Admin';
const VIEW_CHANNEL = '1024';
const ADMIN_ALLOW = '117824';

let channelId = '';
let roleId = '';

export function communityChannelId() {
  return channelId;
}

export function adminRoleId() {
  return roleId;
}

/**
 * @returns {{ channelId: string, messageId: string, roleId: string }}
 */
function readState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return {
      channelId: String(parsed?.channelId || ''),
      messageId: String(parsed?.messageId || ''),
      roleId: String(parsed?.roleId || ''),
    };
  } catch {
    return { channelId: '', messageId: '', roleId: '' };
  }
}

/**
 * @param {{ channelId: string, messageId: string, roleId: string }} state
 */
function writeState(state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  channelId = state.channelId;
  roleId = state.roleId;
}

const saved = readState();
channelId = saved.channelId;
roleId = saved.roleId;

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
 * @param {string} token
 * @param {string} guildId
 * @param {string} existingId
 */
async function ensureRole(token, guildId, existingId) {
  const body = {
    name: ROLE_NAME,
    color: ROLE_COLOR,
    hoist: true,
    mentionable: true,
    permissions: '0',
  };
  if (existingId) {
    const patched = await discord(token, `/guilds/${guildId}/roles/${existingId}`, 'PATCH', body);
    if (patched.ok) return existingId;
  }
  const listed = await discord(token, `/guilds/${guildId}/roles`);
  if (listed.ok) {
    const roles = await listed.json();
    const found = (Array.isArray(roles) ? roles : []).find((role) => role?.name === ROLE_NAME);
    if (found?.id) {
      await discord(token, `/guilds/${guildId}/roles/${found.id}`, 'PATCH', body);
      return String(found.id);
    }
  }
  const created = await discord(token, `/guilds/${guildId}/roles`, 'POST', body);
  if (!created.ok) {
    const detail = await created.text();
    console.error(`Admin role failed (${created.status}): ${detail.slice(0, 180)}`);
    return '';
  }
  const row = await created.json();
  return String(row.id || '');
}

/**
 * @param {string} token
 * @param {string} guildId
 * @param {string} adminId
 */
async function grantOwner(token, guildId, adminId) {
  const guild = await discord(token, `/guilds/${guildId}`);
  if (!guild.ok) return;
  const ownerId = String((await guild.json())?.owner_id || '');
  if (!ownerId) return;
  const granted = await discord(
    token,
    `/guilds/${guildId}/members/${ownerId}/roles/${adminId}`,
    'PUT',
  );
  if (!granted.ok && granted.status !== 204) {
    const detail = await granted.text();
    console.error(`Admin role grant failed (${granted.status}): ${detail.slice(0, 160)}`);
  }
}

/**
 * @param {{ base: string, key: string }} config
 */
async function hostHeader(config) {
  const png = fs.readFileSync(HEADER);
  const objectPath = 'welcome/community.png';
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
  if (!res.ok) return '';
  return `${config.base}/storage/v1/object/public/discord-builds/${objectPath}?v=bpb`;
}

/**
 * @param {string} imageUrl
 */
function payload(imageUrl) {
  const description = [
    '**Staff only.**',
    '',
    'Discord community updates go here.',
    'Only the Admin role can see this channel. People with that role can type here.',
    'The Admin role does not grant control of the rest of the server.',
  ].join('\n');
  return {
    content: null,
    embeds: [{
      color: GOLD,
      title: 'Community updates',
      description,
      ...(imageUrl ? { image: { url: imageUrl } } : {}),
    }],
  };
}

/**
 * @param {string} token
 * @param {string} guildId
 * @param {string} adminId
 * @param {string} existingId
 */
async function ensureChannel(token, guildId, adminId, existingId) {
  const body = {
    name: CHANNEL_NAME,
    topic: 'Discord community updates. Only the Admin role can see this channel.',
    permission_overwrites: [
      { id: guildId, type: 0, allow: '0', deny: VIEW_CHANNEL },
      { id: adminId, type: 0, allow: ADMIN_ALLOW, deny: '0' },
    ],
  };
  return ensureGuildChannel({
    token,
    guildId,
    existingId,
    type: 0,
    name: CHANNEL_NAME,
    body,
    label: 'Community channel',
  });
}

/**
 * @param {Record<string, string>} env
 */
export async function syncCommunity(env) {
  const token = env.DISCORD_BOT_TOKEN || '';
  const guildId = env.DISCORD_GUILD_ID || '';
  const base = String(env.SUPABASE_PROJECT_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!token || !guildId || !base || !key) {
    console.error('Community channel skipped: missing Discord or Supabase env');
    return;
  }
  const state = readState();
  const nextRole = await ensureRole(token, guildId, state.roleId);
  if (!nextRole) return;
  await grantOwner(token, guildId, nextRole);
  const nextChannel = await ensureChannel(token, guildId, nextRole, state.channelId);
  if (!nextChannel) return;
  channelId = nextChannel;
  roleId = nextRole;
  const imageUrl = await hostHeader({ base, key });
  const body = payload(imageUrl);
  let messageId = state.messageId;
  if (messageId) {
    const patched = await discord(token, `/channels/${nextChannel}/messages/${messageId}`, 'PATCH', body);
    if (!patched.ok && patched.status !== 404) {
      const detail = await patched.text();
      console.error(`Community edit failed (${patched.status}): ${detail.slice(0, 180)}`);
      return;
    }
    if (!patched.ok) messageId = '';
  }
  if (!messageId) {
    const posted = await discord(token, `/channels/${nextChannel}/messages`, 'POST', body);
    if (!posted.ok) {
      const detail = await posted.text();
      console.error(`Community post failed (${posted.status}): ${detail.slice(0, 180)}`);
      return;
    }
    const row = await posted.json();
    messageId = String(row.id || '');
  }
  writeState({ channelId: nextChannel, messageId, roleId: nextRole });
  console.log('Community updates channel is limited to the Admin role');
}
