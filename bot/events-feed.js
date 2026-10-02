/**
 * Read-only events feed.
 * One card per current catalog event. A new event is posted on the next check.
 * Ended events, and events removed from the catalog, are deleted from the channel.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { listCatalogEvents } from '../js/pages/events/catalog-data.js';
import { tabsForEvent } from '../js/pages/events/event-features.js';

const API = 'https://discord.com/api/v10';
const GOLD = 0xeac914;
const SITE = 'https://bpbbuilds.github.io';
const READ_ONLY_DENY = '380104611840';
const CHANNEL_NAME = '🏆│ᴇᴠᴇɴᴛꜱ™';
const POLL_MS = 60_000;
const SOON_MS = 24 * 60 * 60 * 1000;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const statePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'events-feed.json');
const HEADER = path.join(ROOT, 'assets', 'theme', 'ui', 'ui-ranked-banner.png');

const STATUS_LINE = {
  upcoming: '**New event.** It has not started yet.',
  'accepting-entries': '**Entries are open.**',
  live: '**The event is live.**',
  voting: '**Voting is open.**',
  judging: '**Entries are closed.** Judging is underway.',
  ended: '**The event has ended.**',
};

let channelId = '';
let polling = false;
let botUserId = '';
/** @type {Map<string, string>} */
const bannerCache = new Map();

export function eventsChannelId() {
  return channelId;
}

/**
 * @returns {{ channelId: string, messageId: string, seen: Record<string, { status: string, messageId: string }> }}
 */
function readState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const raw = parsed?.seen && typeof parsed.seen === 'object' ? parsed.seen : {};
    /** @type {Record<string, { status: string, messageId: string }>} */
    const seen = {};
    for (const [slug, row] of Object.entries(raw)) {
      seen[slug] = {
        status: String(row?.status || ''),
        messageId: String(row?.messageId || ''),
      };
    }
    return {
      channelId: String(parsed?.channelId || ''),
      messageId: String(parsed?.messageId || ''),
      seen,
    };
  } catch {
    return { channelId: '', messageId: '', seen: {} };
  }
}

/**
 * @param {{ channelId: string, messageId: string, seen: Record<string, { status: string, messageId: string }> }} state
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {string} token
 */
async function botId(token) {
  if (botUserId) return botUserId;
  const res = await discord(token, '/users/@me');
  if (!res.ok) return '';
  const row = await res.json();
  botUserId = String(row.id || '');
  return botUserId;
}

/**
 * @param {{ base: string, key: string }} config
 */
/**
 * @param {{ base: string, key: string }} config
 * @param {string} objectPath
 * @param {string} filePath
 */
async function hostPng(config, objectPath, filePath) {
  if (!fs.existsSync(filePath)) return '';
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
  if (!res.ok) return '';
  return `${config.base}/storage/v1/object/public/discord-builds/${objectPath}`;
}

/**
 * @param {{ base: string, key: string }} config
 */
function hostHeader(config) {
  return hostPng(config, 'welcome/events.png', HEADER);
}

/**
 * @param {string} imageUrl
 */
function introPayload(imageUrl) {
  const description = [
    'This channel posts event updates: new events, starting soon, entries, live, judging, ended, and results.',
    'You can\'t type here.',
    '',
    `[Events](${SITE}/events/)`,
  ].join('\n');
  return {
    content: null,
    embeds: [{
      color: GOLD,
      title: 'Events',
      url: `${SITE}/events/`,
      description,
      ...(imageUrl ? { thumbnail: { url: imageUrl } } : {}),
    }],
  };
}

/**
 * Links that exist for this event: rules, enter, builds, voting, rewards.
 * @param {{ slug: string, status?: string, features?: { hasVoting?: boolean, hasBuilds?: boolean }, entry?: object }} event
 */
function eventLinks(event) {
  const base = `${SITE}/events/?e=${encodeURIComponent(event.slug)}`;
  const tabs = tabsForEvent(event);
  /** @type {string[]} */
  const links = [`[Event](${base})`];
  if (tabs.includes('rules')) links.push(`[Rules](${base}&tab=rules)`);
  if (event.status === 'accepting-entries') links.push(`[Enter](${base})`);
  if (tabs.includes('builds')) links.push(`[Builds](${base}&tab=builds)`);
  if (tabs.includes('voting')) links.push(`[Voting](${base}&tab=voting)`);
  if (tabs.includes('rewards')) links.push(`[Rewards](${base}&tab=rewards)`);
  return links.join(' · ');
}

/**
 * @param {string | { label?: string, title?: string, amount?: number }} item
 */
function prizeName(item) {
  if (typeof item === 'string') return item.trim();
  if (item.label === '$10 GC') return '$10 Amazon gift card';
  if (item.label) return String(item.label);
  if (item.amount != null) return `${item.amount} gold`;
  return '';
}

/**
 * Place rewards from the event. The short prize label is only a fallback.
 * @param {{ prize?: string, prizePlaces?: { label?: string, place?: string, prizes?: (string | { label?: string, title?: string, amount?: number })[] }[] }} event
 */
function rewardLines(event) {
  const places = Array.isArray(event.prizePlaces) ? event.prizePlaces : [];
  if (!places.length) {
    const label = String(event.prize || '').trim();
    return label ? [`**Prize.** ${label}`] : [];
  }
  return places.flatMap((place) => {
    const name = String(place.label || place.place || 'Prize');
    const items = (place.prizes || []).map(prizeName).filter(Boolean);
    return items.length ? [`**${name}.** ${items.join(', ')}`] : [];
  });
}

/**
 * @param {{ slug: string, title: string, status?: string, datesLabel?: string, prize?: string, prizePlaces?: { label?: string, place?: string, prizes?: (string | { label?: string, amount?: number })[] }[], schedule?: { startsAt?: string | null } }} event
 */
function cardText(event) {
  const status = String(event.status || 'upcoming');
  const soon = status === 'upcoming' && startsSoon(event.schedule?.startsAt);
  const line = soon ? soonText(event.schedule?.startsAt) : (STATUS_LINE[status] || STATUS_LINE.upcoming);
  /** @type {string[]} */
  const bits = [line];
  if (event.datesLabel) bits.push('', event.datesLabel);
  const rewards = rewardLines(event);
  if (rewards.length) bits.push('', ...rewards);
  const links = eventLinks(event);
  if (links) bits.push('', links);
  return bits.join('\n');
}

/**
 * @param {{ slug: string, title: string }} event
 * @param {string} text
 * @param {string} thumbUrl
 */
function eventPayload(event, text, thumbUrl) {
  const url = `${SITE}/events/?e=${encodeURIComponent(event.slug)}`;
  return {
    content: null,
    embeds: [{
      color: GOLD,
      title: event.title,
      url,
      description: text,
      ...(thumbUrl ? { thumbnail: { url: thumbUrl } } : {}),
    }],
  };
}

/**
 * @param {{ base: string, key: string }} config
 * @param {{ slug: string, image?: string }} event
 */
async function bannerUrl(config, event) {
  const cached = bannerCache.get(event.slug);
  if (cached) return cached;
  const image = String(event.image || '');
  const url = /^https?:\/\//i.test(image)
    ? image
    : await hostPng(config, `events/${event.slug}.png`, path.join(ROOT, image));
  if (url) bannerCache.set(event.slug, url);
  return url;
}

/**
 * Catalog rows used to test the events page stay off this channel.
 * @param {{ blurb?: string }} event
 */
function isRealEvent(event) {
  return !/filler event for catalog tests/i.test(String(event.blurb || ''));
}

/**
 * @param {string | null | undefined} iso
 */
function startsSoon(iso) {
  const at = new Date(String(iso || '')).getTime();
  if (!Number.isFinite(at)) return false;
  const delta = at - Date.now();
  return delta > 0 && delta <= SOON_MS;
}

/**
 * @param {string | null | undefined} iso
 */
function soonText(iso) {
  const at = new Date(String(iso || '')).getTime();
  const hours = Math.max(1, Math.round((at - Date.now()) / 3600000));
  const unit = hours === 1 ? 'hour' : 'hours';
  return `**Starting soon.** It starts in about ${hours} ${unit}.`;
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
    topic: 'New events, starting soon, endings, and results. Messages here are turned off.',
    permission_overwrites: overwrites,
  };
  if (existingId) {
    const patched = await discord(token, `/channels/${existingId}`, 'PATCH', body);
    if (patched.ok) return existingId;
  }
  const created = await discord(token, `/guilds/${guildId}/channels`, 'POST', { ...body, type: 0 });
  if (!created.ok) {
    const detail = await created.text();
    console.error(`Events channel failed (${created.status}): ${detail.slice(0, 180)}`);
    return '';
  }
  const row = await created.json();
  return String(row.id || '');
}

/**
 * @param {string} token
 * @param {string} channelId
 * @param {string} messageId
 */
async function deleteMessage(token, channelId, messageId) {
  if (!messageId) return;
  const removed = await discord(token, `/channels/${channelId}/messages/${messageId}`, 'DELETE');
  if (!removed.ok && removed.status !== 404) {
    const detail = await removed.text();
    console.error(`Events delete failed (${removed.status}): ${detail.slice(0, 180)}`);
  }
  await sleep(350);
}

/**
 * Drop old status posts. Leave the intro, current event cards, and anything a person wrote.
 * @param {string} token
 * @param {string} channelId
 * @param {Set<string>} keep
 */
async function removeStrays(token, channelId, keep) {
  const me = await botId(token);
  if (!me) return;
  const listed = await discord(token, `/channels/${channelId}/messages?limit=100`);
  if (!listed.ok) return;
  const rows = await listed.json();
  if (!Array.isArray(rows)) return;
  for (const row of rows) {
    const id = String(row?.id || '');
    if (!id || keep.has(id) || String(row?.author?.id || '') !== me) continue;
    await deleteMessage(token, channelId, id);
  }
}

/**
 * @param {string} token
 * @param {string} id
 * @param {{ base: string, key: string }} config
 * @param {{ channelId: string, messageId: string, seen: Record<string, { status: string, messageId: string }> }} state
 */
async function publishUpdates(token, id, config, state) {
  const events = listCatalogEvents().filter(isRealEvent);
  const current = new Set(events.filter((event) => event.status !== 'ended').map((event) => event.slug));
  for (const event of events) {
    const status = String(event.status || 'upcoming');
    const prior = state.seen[event.slug];
    if (status === 'ended') {
      if (prior?.messageId) await deleteMessage(token, id, prior.messageId);
      delete state.seen[event.slug];
      continue;
    }
    const body = eventPayload(event, cardText(event), await bannerUrl(config, event));
    let messageId = prior?.messageId || '';
    if (messageId) {
      const patched = await discord(token, `/channels/${id}/messages/${messageId}`, 'PATCH', body);
      if (patched.ok) {
        state.seen[event.slug] = { status, messageId };
        continue;
      }
      if (patched.status !== 404) {
        const detail = await patched.text();
        console.error(`Events edit failed (${patched.status}): ${detail.slice(0, 180)}`);
        continue;
      }
      messageId = '';
    }
    const posted = await discord(token, `/channels/${id}/messages`, 'POST', body);
    if (!posted.ok) {
      const detail = await posted.text();
      console.error(`Events post failed (${posted.status}): ${detail.slice(0, 180)}`);
      continue;
    }
    const row = await posted.json();
    state.seen[event.slug] = { status, messageId: String(row.id || '') };
    await sleep(400);
  }
  for (const slug of Object.keys(state.seen)) {
    if (current.has(slug)) continue;
    await deleteMessage(token, id, state.seen[slug]?.messageId || '');
    delete state.seen[slug];
  }
  writeState(state);
  const keep = new Set([state.messageId, ...Object.values(state.seen).map((row) => row.messageId)].filter(Boolean));
  await removeStrays(token, id, keep);
}

/**
 * @param {Record<string, string>} env
 */
export async function syncEvents(env) {
  const token = env.DISCORD_BOT_TOKEN || '';
  const guildId = env.DISCORD_GUILD_ID || '';
  const base = String(env.SUPABASE_PROJECT_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!token || !guildId || !base || !key) {
    console.error('Events channel skipped: missing Discord or Supabase env');
    return;
  }
  const state = readState();
  const nextChannel = await ensureChannel(token, guildId, state.channelId);
  if (!nextChannel) return;
  state.channelId = nextChannel;
  channelId = nextChannel;
  const config = { base, key };
  const imageUrl = await hostHeader(config);
  const body = introPayload(imageUrl);
  let messageId = state.messageId;
  if (messageId) {
    const patched = await discord(token, `/channels/${nextChannel}/messages/${messageId}`, 'PATCH', body);
    if (!patched.ok && patched.status !== 404) {
      const detail = await patched.text();
      console.error(`Events intro edit failed (${patched.status}): ${detail.slice(0, 180)}`);
      return;
    }
    if (!patched.ok) messageId = '';
  }
  if (!messageId) {
    const posted = await discord(token, `/channels/${nextChannel}/messages`, 'POST', body);
    if (!posted.ok) {
      const detail = await posted.text();
      console.error(`Events intro failed (${posted.status}): ${detail.slice(0, 180)}`);
      return;
    }
    const row = await posted.json();
    messageId = String(row.id || '');
  }
  state.messageId = messageId;
  writeState(state);
  await publishUpdates(token, nextChannel, config, state);
  if (!polling) {
    polling = true;
    setInterval(() => {
      publishUpdates(token, nextChannel, config, readState()).catch((err) => {
        console.error(err instanceof Error ? err.message : err);
      });
    }, POLL_MS);
  }
  console.log('Events channel is read-only');
}
