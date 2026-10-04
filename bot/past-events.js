/**
 * Forum for events that have finished.
 * People can reply under a post. New posts are the finished-event record.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureGuildChannel } from './channel-reconcile.js';

const API = 'https://discord.com/api/v10';
const FORUMS = '1554348111340511315';
const statePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'past-events.json');
const CHANNEL_NAME = 'past-events';
const TOPIC = 'Finished events. Each past event gets a post. Replies stay under that post.';

let channelId = '';

export function pastEventsForumId() {
  return channelId;
}

/**
 * @returns {{ channelId: string, threadId: string }}
 */
function readState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return {
      channelId: String(parsed?.channelId || ''),
      threadId: String(parsed?.threadId || ''),
    };
  } catch {
    return { channelId: '', threadId: '' };
  }
}

/**
 * @param {{ channelId: string, threadId: string }} state
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
 * @param {string} token
 * @param {string} guildId
 * @param {string} existingId
 */
async function ensureForum(token, guildId, existingId) {
  const body = {
    name: CHANNEL_NAME,
    topic: TOPIC,
    parent_id: FORUMS,
    default_sort_order: 1,
    default_auto_archive_duration: 10080,
  };
  return ensureGuildChannel({
    token,
    guildId,
    existingId,
    type: 15,
    name: CHANNEL_NAME,
    body,
    label: 'Past events forum',
  });
}

/**
 * @param {string} token
 * @param {string} forumId
 * @param {string} existingThreadId
 */
async function ensureIntro(token, forumId, existingThreadId) {
  if (existingThreadId) {
    const current = await discord(token, `/channels/${existingThreadId}`);
    if (current.ok) return existingThreadId;
  }
  const posted = await discord(token, `/channels/${forumId}/threads`, 'POST', {
    name: 'How past events works',
    auto_archive_duration: 10080,
    message: {
      content: [
        'This forum is for events that have finished.',
        'Each past event gets its own post. Talk about that event in the replies.',
      ].join('\n'),
    },
  });
  if (!posted.ok) {
    const detail = await posted.text();
    console.error(`Past events intro failed (${posted.status}): ${detail.slice(0, 180)}`);
    return '';
  }
  const row = await posted.json();
  return String(row.id || '');
}

/**
 * @param {Record<string, string>} env
 */
export async function syncPastEvents(env) {
  const token = env.DISCORD_BOT_TOKEN || '';
  const guildId = env.DISCORD_GUILD_ID || '';
  if (!token || !guildId) {
    console.error('Past events forum skipped: missing Discord env');
    return;
  }
  const state = readState();
  const nextChannel = await ensureForum(token, guildId, state.channelId);
  if (!nextChannel) return;
  const threadId = await ensureIntro(token, nextChannel, state.threadId);
  writeState({ channelId: nextChannel, threadId });
  console.log('Past events forum is ready');
}
