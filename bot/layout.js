/**
 * Puts the server channels in a stable order.
 * The Admin category is last. Community updates lives there.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureGuildChannel } from './channel-reconcile.js';

const statePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'layout.json');

const CHAT = '1555401802663592097';
const FORUMS = '1554348111340511315';
const STATS = '1555346501612601386';
const WELCOME = '1554348212423368835';
const RULES = '1555345682678943829';
const NEWS = '1555346068298924052';
const PREMIUM = '1555374702069948486';
const MAIN = '1554346073974243448';
const BOTS = '1555306905067323402';
const BUILDS = '1553880481001644062';
const IDEAS = '1554346585729540096';
const COSMETICS = '1555344242690359387';
const UPLOADED = '1555346503395053568';

/**
 * @returns {{ infoId: string, bottomId: string, adminId: string, communityInfoId: string }}
 */
function readState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return {
      infoId: String(parsed?.infoId || ''),
      bottomId: String(parsed?.bottomId || ''),
      adminId: String(parsed?.adminId || ''),
      communityInfoId: String(parsed?.communityInfoId || ''),
    };
  } catch {
    return { infoId: '', bottomId: '', adminId: '', communityInfoId: '' };
  }
}

/**
 * @param {{ infoId: string, bottomId: string, adminId: string, communityInfoId: string }} state
 */
function writeState(state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

/**
 * @param {string} token
 * @param {string} apiPath
 * @param {string} [method]
 * @param {object | null} [body]
 */
async function discord(token, apiPath, method = 'GET', body) {
  return fetch(`https://discord.com/api/v10${apiPath}`, {
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
 * @param {string} name
 */
/**
 * @param {string} token
 * @param {string} guildId
 * @param {string} existingId
 * @param {string} name
 * @param {object} [extra]
 */
async function ensureCategory(token, guildId, existingId, name, extra = {}) {
  return ensureGuildChannel({
    token,
    guildId,
    existingId,
    type: 4,
    name,
    body: extra,
    label: `${name} category`,
  });
}

/**
 * @param {string} id
 * @param {number} position
 * @param {string | null} [parentId]
 */
function slot(id, position, parentId) {
  return parentId ? { id, position, parent_id: parentId } : { id, position };
}

/**
 * @param {Record<string, string>} env
 */
export async function syncLayout(env) {
  const token = env.DISCORD_BOT_TOKEN || '';
  const guildId = env.DISCORD_GUILD_ID || '';
  const honeypotId = env.DISCORD_HONEYPOT_CHANNEL_ID || '';
  let marketId = '';
  let questId = '';
  let communityId = '';
  let eventsId = '';
  let pastEventsId = '';
  try {
    const marketPath = path.join(path.dirname(statePath), 'market.json');
    marketId = String(JSON.parse(fs.readFileSync(marketPath, 'utf8'))?.channelId || '');
  } catch {
    marketId = '';
  }
  try {
    const questPath = path.join(path.dirname(statePath), 'quest.json');
    questId = String(JSON.parse(fs.readFileSync(questPath, 'utf8'))?.channelId || '');
  } catch {
    questId = '';
  }
  try {
    const communityPath = path.join(path.dirname(statePath), 'community.json');
    communityId = String(JSON.parse(fs.readFileSync(communityPath, 'utf8'))?.channelId || '');
  } catch {
    communityId = '';
  }
  try {
    const eventsPath = path.join(path.dirname(statePath), 'events-feed.json');
    eventsId = String(JSON.parse(fs.readFileSync(eventsPath, 'utf8'))?.channelId || '');
  } catch {
    eventsId = '';
  }
  try {
    const pastPath = path.join(path.dirname(statePath), 'past-events.json');
    pastEventsId = String(JSON.parse(fs.readFileSync(pastPath, 'utf8'))?.channelId || '');
  } catch {
    pastEventsId = '';
  }
  if (!token || !guildId) return;

  let adminRoleId = '';
  try {
    const communityPath = path.join(path.dirname(statePath), 'community.json');
    adminRoleId = String(JSON.parse(fs.readFileSync(communityPath, 'utf8'))?.roleId || '');
  } catch {
    adminRoleId = '';
  }
  const state = readState();
  const infoId = await ensureCategory(token, guildId, state.infoId, 'Information');
  const communityInfoId = await ensureCategory(token, guildId, state.communityInfoId, 'Community info');
  const bottomId = await ensureCategory(token, guildId, state.bottomId, '🍯 Definitely post here');
  const adminId = await ensureCategory(token, guildId, state.adminId, 'Admin', {
    permission_overwrites: [
      { id: guildId, type: 0, allow: '0', deny: '1024' },
      ...(adminRoleId ? [{ id: adminRoleId, type: 0, allow: '1024', deny: '0' }] : []),
    ],
  });
  if (!infoId || !communityInfoId || !bottomId || !adminId) return;
  writeState({ infoId, bottomId, adminId, communityInfoId });

  await discord(token, `/channels/${CHAT}`, 'PATCH', { name: 'Chat' });
  await discord(token, `/channels/${FORUMS}`, 'PATCH', { name: 'Forums' });

  const moves = [
    [WELCOME, infoId, 0],
    [RULES, infoId, 1],
    [NEWS, infoId, 2],
    [PREMIUM, infoId, 3],
    ...(questId ? [[questId, communityInfoId, 0]] : []),
    ...(marketId ? [[marketId, communityInfoId, 1]] : []),
    ...(eventsId ? [[eventsId, communityInfoId, 2]] : []),
    ...(() => {
      try {
        const dropsPath = path.join(path.dirname(statePath), 'cosmetic-drops.json');
        const dropsId = String(JSON.parse(fs.readFileSync(dropsPath, 'utf8'))?.channelId || '');
        return dropsId ? [[dropsId, communityInfoId, 3]] : [];
      } catch {
        return [];
      }
    })(),
    ...(communityId ? [[communityId, adminId, 0]] : []),
    [MAIN, null, 0],
    [BOTS, CHAT, 0],
    [BUILDS, FORUMS, 0],
    [IDEAS, FORUMS, 1],
    [COSMETICS, FORUMS, 2],
    ...(pastEventsId ? [[pastEventsId, FORUMS, 3]] : []),
    [UPLOADED, STATS, 0],
    ...(() => {
      try {
        const statsPath = path.join(path.dirname(statePath), 'stats.json');
        const foundingId = String(JSON.parse(fs.readFileSync(statsPath, 'utf8'))?.foundingChannelId || '');
        return foundingId ? [[foundingId, STATS, 1]] : [];
      } catch {
        return [];
      }
    })(),
    ...(honeypotId ? [[honeypotId, bottomId, 0]] : []),
  ];
  for (const [id, parentId, position] of moves) {
    const moved = await discord(token, `/channels/${id}`, 'PATCH', {
      parent_id: parentId,
      position,
    });
    if (!moved.ok) {
      const detail = await moved.text();
      console.error(`Channel move failed (${moved.status}): ${detail.slice(0, 160)}`);
      return;
    }
  }

  const rows = [
    slot(MAIN, 0),
    slot(STATS, 1),
    slot(infoId, 2),
    slot(communityInfoId, 3),
    slot(CHAT, 4),
    slot(FORUMS, 5),
    slot(bottomId, 6),
    slot(adminId, 7),
  ];
  const ordered = await discord(token, `/guilds/${guildId}/channels`, 'PATCH', rows);
  if (!ordered.ok) {
    const detail = await ordered.text();
    console.error(`Channel order failed (${ordered.status}): ${detail.slice(0, 180)}`);
    return;
  }
  console.log('Channel order updated');
}
