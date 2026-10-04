/**
 * Read-only Cosmetic drops channel under Community info.
 * A cosmetic is announced here only after an owner publishes it on the site.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureGuildChannel } from './channel-reconcile.js';

const API = 'https://discord.com/api/v10';
const GOLD = 0xeac914;
const SITE = 'https://bpbbuilds.com';
const READ_ONLY_DENY = '380104611840';
const CHANNEL_NAME = '🎀│ᴄᴏꜱᴍᴇᴛɪᴄ ᴅʀᴏᴘꜱ™';
const POLL_MS = 60_000;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const statePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'cosmetic-drops.json');
const HEADER = path.join(ROOT, 'assets', 'brand', 'logo-bpb.png');

let channelId = '';
let polling = false;

export function cosmeticDropsChannelId() {
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
 * @returns {string}
 */
function communityParent() {
  try {
    const layoutPath = path.join(path.dirname(statePath), 'layout.json');
    return String(JSON.parse(fs.readFileSync(layoutPath, 'utf8'))?.communityInfoId || '');
  } catch {
    return '';
  }
}

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
 * @param {string} grant
 */
function whoLine(grant) {
  const key = String(grant || '').toLowerCase();
  if (key === 'starter') return 'Everyone';
  if (key === 'premium') return 'Premium and Founding';
  if (key === 'founding') return 'Founding only';
  if (key === 'event') return 'Event grant';
  return 'Held until it is granted';
}

/**
 * @param {string} slot
 */
function slotLabel(slot) {
  const key = String(slot || '').toLowerCase();
  const labels = {
    hat: 'Hat',
    face: 'Face',
    neck: 'Neck',
    head: 'Full head',
    body: 'Body',
    hand: 'Hand',
  };
  return labels[key] || slot || '—';
}

/**
 * @param {{ base: string, key: string }} config
 * @param {string} id
 * @param {string} image
 */
async function hostCosmetic(config, id, image) {
  const rel = String(image || '').replace(/^\/+/, '');
  if (!rel || rel.startsWith('http')) return rel.startsWith('http') ? rel : '';
  const filePath = path.join(ROOT, rel);
  if (!fs.existsSync(filePath)) return '';
  const objectPath = `cosmetic-drops/${id}.png`;
  const res = await fetch(`${config.base}/storage/v1/object/discord-builds/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: fs.readFileSync(filePath),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error(`Cosmetic image failed for ${id} (${res.status}): ${detail.slice(0, 160)}`);
    return '';
  }
  return `${config.base}/storage/v1/object/public/discord-builds/${objectPath}`;
}

/**
 * @param {{ base: string, key: string }} config
 */
async function hostHeader(config) {
  const res = await fetch(`${config.base}/storage/v1/object/discord-builds/welcome/cosmetic-drops.png`, {
    method: 'POST',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: fs.readFileSync(HEADER),
  });
  if (!res.ok) return '';
  return `${config.base}/storage/v1/object/public/discord-builds/welcome/cosmetic-drops.png`;
}

/**
 * @param {string} imageUrl
 */
function introPayload(imageUrl) {
  return {
    content: null,
    embeds: [{
      color: GOLD,
      title: 'Cosmetic drops',
      description: [
        'New blob cosmetics show up here when they are published from the site.',
        'You can\'t type here.',
      ].join('\n\n'),
      ...(imageUrl ? { thumbnail: { url: imageUrl } } : {}),
    }],
  };
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} imageUrl
 */
function dropPayload(row, imageUrl) {
  const name = String(row.name || row.id || 'Cosmetic');
  const blurb = String(row.description || '').replace(/\s+/g, ' ').trim();
  const lines = [
    blurb,
    '',
    `**Slot.** ${slotLabel(String(row.slot || ''))}`,
    `**Rarity.** ${String(row.rarity || 'Common')}`,
    `**Who.** ${whoLine(String(row.grant || ''))}`,
  ].filter((line, index) => line || index > 0);
  return {
    content: null,
    embeds: [{
      color: GOLD,
      title: name,
      url: `${SITE}/u/`,
      description: lines.join('\n').slice(0, 4096),
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
  const parent = communityParent();
  const body = {
    name: CHANNEL_NAME,
    topic: 'New blob cosmetics published from the site. Messages here are turned off.',
    permission_overwrites: [{ id: guildId, type: 0, allow: '0', deny: READ_ONLY_DENY }],
    ...(parent ? { parent_id: parent } : {}),
  };
  return ensureGuildChannel({
    token,
    guildId,
    existingId,
    type: 0,
    name: CHANNEL_NAME,
    body,
    label: 'Cosmetic drops channel',
  });
}

/**
 * @param {{ token: string, base: string, key: string }} config
 * @param {string} forumId
 */
async function postPending(config, forumId) {
  const headers = {
    apikey: config.key,
    Authorization: `Bearer ${config.key}`,
    'Content-Type': 'application/json',
  };
  const listed = await fetch(
    `${config.base}/rest/v1/cosmetic_drops?select=id,name,slot,rarity,grant,description,image&published=eq.true&discord_message_id=is.null&order=published_at.asc&limit=5`,
    { headers },
  );
  if (!listed.ok) return;
  const rows = await listed.json();
  if (!Array.isArray(rows) || !rows.length) return;
  let posted = 0;
  for (const row of rows) {
    const id = String(row.id || '');
    if (!id) continue;
    const imageUrl = await hostCosmetic(config, id, String(row.image || ''));
    const res = await discord(config.token, `/channels/${forumId}/messages`, 'POST', dropPayload(row, imageUrl));
    if (!res.ok) {
      const detail = await res.text();
      console.error(`Cosmetic drop failed for ${id} (${res.status}): ${detail.slice(0, 180)}`);
      continue;
    }
    const message = await res.json();
    const messageId = String(message.id || '');
    if (!messageId) continue;
    const saved = await fetch(`${config.base}/rest/v1/cosmetic_drops?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ discord_message_id: messageId }),
    });
    if (!saved.ok) {
      console.error(`Cosmetic drop message id failed for ${id} (${saved.status})`);
      continue;
    }
    posted += 1;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  if (posted) console.log(`Cosmetic drops posted ${posted}`);
}

/**
 * @param {Record<string, string>} env
 */
export async function syncCosmeticDrops(env) {
  const token = env.DISCORD_BOT_TOKEN || '';
  const guildId = env.DISCORD_GUILD_ID || '';
  const base = String(env.SUPABASE_PROJECT_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!token || !guildId || !base || !key) {
    console.error('Cosmetic drops skipped: missing Discord or Supabase env');
    return;
  }
  const state = readState();
  const nextChannel = await ensureChannel(token, guildId, state.channelId);
  if (!nextChannel) return;
  channelId = nextChannel;
  const imageUrl = await hostHeader({ base, key });
  const body = introPayload(imageUrl);
  let messageId = state.messageId;
  if (messageId) {
    const patched = await discord(token, `/channels/${nextChannel}/messages/${messageId}`, 'PATCH', body);
    if (!patched.ok && patched.status !== 404) {
      const detail = await patched.text();
      console.error(`Cosmetic drops intro failed (${patched.status}): ${detail.slice(0, 180)}`);
    }
    if (!patched.ok) messageId = '';
  }
  if (!messageId) {
    const posted = await discord(token, `/channels/${nextChannel}/messages`, 'POST', body);
    if (!posted.ok) {
      const detail = await posted.text();
      console.error(`Cosmetic drops intro failed (${posted.status}): ${detail.slice(0, 180)}`);
      return;
    }
    const row = await posted.json();
    messageId = String(row.id || '');
  }
  writeState({ channelId: nextChannel, messageId });
  console.log('Cosmetic drops channel is read-only');
  const config = { token, base, key };
  await postPending(config, nextChannel);
  if (!polling) {
    polling = true;
    setInterval(() => {
      postPending(config, nextChannel).catch((err) => console.error(err instanceof Error ? err.message : err));
    }, POLL_MS);
  }
}
