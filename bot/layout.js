/**
 * Puts the server channels in a stable order.
 * Definitely-post-here sits in its own category at the bottom.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const API = 'https://discord.com/api/v10';
const statePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'layout.json');

const CHAT = '1553880035906162738';
const FORUMS = '1554348111340511315';
const ARCHIVED = '1554345936711327794';
const CURRENT = '1554345978952421436';
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
 * @returns {{ infoId: string, bottomId: string }}
 */
function readState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return {
      infoId: String(parsed?.infoId || ''),
      bottomId: String(parsed?.bottomId || ''),
    };
  } catch {
    return { infoId: '', bottomId: '' };
  }
}

/**
 * @param {{ infoId: string, bottomId: string }} state
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
 * @param {string} name
 */
async function ensureCategory(token, guildId, existingId, name) {
  if (existingId) {
    const current = await discord(token, `/channels/${existingId}`);
    if (current.ok) {
      await discord(token, `/channels/${existingId}`, 'PATCH', { name });
      return existingId;
    }
  }
  const created = await discord(token, `/guilds/${guildId}/channels`, 'POST', { name, type: 4 });
  if (!created.ok) {
    const detail = await created.text();
    console.error(`Channel category failed (${created.status}): ${detail.slice(0, 160)}`);
    return '';
  }
  const row = await created.json();
  return String(row.id || '');
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
  try {
    const marketPath = path.join(path.dirname(statePath), 'market.json');
    marketId = String(JSON.parse(fs.readFileSync(marketPath, 'utf8'))?.channelId || '');
  } catch {
    marketId = '';
  }
  if (!token || !guildId) return;

  const state = readState();
  const infoId = await ensureCategory(token, guildId, state.infoId, 'Information');
  const bottomId = await ensureCategory(token, guildId, state.bottomId, '🍯 Definitely post here');
  if (!infoId || !bottomId) return;
  writeState({ infoId, bottomId });

  await discord(token, `/channels/${CHAT}`, 'PATCH', { name: 'Chat' });
  await discord(token, `/channels/${FORUMS}`, 'PATCH', { name: 'Forums' });
  await discord(token, `/channels/${ARCHIVED}`, 'PATCH', { name: 'Archived Events' });

  const moves = [
    [WELCOME, infoId, 0],
    [RULES, infoId, 1],
    [NEWS, infoId, 2],
    [PREMIUM, infoId, 3],
    ...(marketId ? [[marketId, infoId, 4]] : []),
    [MAIN, CHAT, 0],
    [BOTS, CHAT, 1],
    [BUILDS, FORUMS, 0],
    [IDEAS, FORUMS, 1],
    [COSMETICS, FORUMS, 2],
    [UPLOADED, STATS, 0],
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
    slot(infoId, 0),
    slot(CHAT, 1),
    slot(FORUMS, 2),
    slot(ARCHIVED, 3),
    slot(CURRENT, 4),
    slot(STATS, 5),
    slot(bottomId, 6),
  ];
  const ordered = await discord(token, `/guilds/${guildId}/channels`, 'PATCH', rows);
  if (!ordered.ok) {
    const detail = await ordered.text();
    console.error(`Channel order failed (${ordered.status}): ${detail.slice(0, 180)}`);
    return;
  }
  console.log('Channel order updated');
}
