/**
 * Welcome channel guide: site pages, this server, and the YouTube channel.
 * Each section is an embed with a banner image above the copy.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { rulesChannelId } from './rules.js';
import { newsChannelId } from './news.js';
import { premiumChannelId } from './premium.js';
import { marketChannelId } from './market.js';
import { statsCategoryId } from './stats.js';

const API = 'https://discord.com/api/v10';
const GOLD = 0xeac914;
const SITE = 'https://bpbbuilds.github.io';
const YOUTUBE = 'https://www.youtube.com/@SmojoWasTaken';
const INVITE = 'https://discord.gg/s5WghmrFSp';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const statePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'welcome-ids.json');

const MAIN = '1554346073974243448';
const BUILDS = '1553880481001644062';
const IDEAS = '1554346585729540096';
const COSMETICS = '1555344242690359387';
const BOTS = '1555306905067323402';
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
async function hostImage(config, name, filePath) {
  const bytes = fs.readFileSync(path.join(ROOT, filePath));
  const gif = path.extname(filePath).toLowerCase() === '.gif';
  const objectPath = `welcome/${name}${gif ? '.gif' : '.png'}`;
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
 * Banner embed, then the text embed, so the picture sits above the copy.
 * @param {string} imageUrl
 * @param {string} title
 * @param {string} url
 * @param {string} description
 */
function section(imageUrl, title, url, description) {
  return {
    color: GOLD,
    title,
    url,
    description,
    ...(imageUrl ? { image: { url: imageUrl } } : {}),
  };
}

/**
 * @param {Record<string, string>} images
 */
function messages(images) {
  const page = (key, title, href, description) => section(images[key] || '', title, href, description);
  const pages = [
    page(
      'items',
      'Items',
      `${SITE}/items/`,
      'The item library. Weapons, bags, skills, and treasures, with game-style tooltips.',
    ),
    page(
      'builds',
      'Builds',
      `${SITE}/builds/`,
      'Public builds. Open a guide for the board, the route, and a YouTube video when the author added one.',
    ),
    page(
      'create',
      'Create',
      `${SITE}/create/`,
      'The build editor. Lay out a board and publish it, or remix a build that is already loaded.',
    ),
    page(
      'events',
      'Events',
      `${SITE}/events/`,
      'Community events. DPS Stone scores a real ranked or unranked stone board from a history.db file against one shared dummy.',
    ),
    page(
      'market',
      'Market',
      `${SITE}/market/`,
      'Coming soon. A shop for blob cosmetics. Nothing is listed yet.',
    ),
    page(
      'quest',
      'Quest',
      `${SITE}/quest/`,
      'Coming soon. Quests that pay coins and cosmetics, including a sim-dummy task. Nothing to claim yet.',
    ),
    page(
      'sim',
      'Sim',
      `${SITE}/sim/`,
      'A fan-made fight against a dummy. Not official combat, and not a live match.',
    ),
    page(
      'profile',
      'Profile',
      `${SITE}/u/`,
      'Sign in with Discord. Your page has your builds, blob wardrobe, inventory, and settings.',
    ),
    page(
      'about',
      'About',
      `${SITE}/legal/about/`,
      `What this fan site is. Also see [Terms](${SITE}/legal/terms/) and [Privacy](${SITE}/legal/privacy/).`,
    ),
  ];

  return [
    {
      embeds: [
        section(
          images.welcome || '',
          'Welcome to BPB Builds',
          SITE,
          [
            `This channel is the welcome note. You can't type here. Say hello in <#${MAIN}>.`,
            '',
            '**BPB Builds** is an unofficial fan site for Backpack Battles: guides, an item library, a build creator, events, and a combat sandbox. It is not affiliated with the game or its developers and publishers.',
            '',
            'The next messages cover the site, this server, and the YouTube channel.',
          ].join('\n'),
        ),
      ],
    },
    { embeds: pages.slice(0, 5).flat() },
    { embeds: pages.slice(5).flat() },
    {
      embeds: [
        section(
          images.discord || '',
          'Discord',
          INVITE,
          [
            `<#${WELCOME}> is this note. Messages stay off.`,
            ...(rulesChannelId() ? [`<#${rulesChannelId()}> is the server rules. Messages stay off.`] : []),
            ...(newsChannelId() ? [`<#${newsChannelId()}> is for site and server news. Messages stay off.`] : []),
            ...(premiumChannelId() ? [`<#${premiumChannelId()}> explains Premium. Messages stay off.`] : []),
            ...(marketChannelId() ? [`<#${marketChannelId()}> is where market listings, buys, and sales will be posted. Messages stay off.`] : []),
            ...(statsCategoryId() ? [`<#${statsCategoryId()}> shows live website numbers. Uploaded builds is how many builds are saved on the site.`] : []),
            `<#${MAIN}> is general chat.`,
            `<#${BUILDS}> is the builds forum. The bot posts each public build from the site. You can reply under a post. You can't start a new post there.`,
            `<#${IDEAS}> is the item-ideas forum.`,
            `<#${COSMETICS}> is where you submit a new blob cosmetic. Include the art, the name, and a slot tag.`,
            `<#${BOTS}> is for bot commands. \`/test\` checks that the bot is online.`,
            '',
            'Archived Events and Current Events are empty shelves for event channels.',
            '',
            'Your nickname stays the name you set, then ` | 🎒 ` and your uploaded build count. Clearing it uses your Discord name plus that count. The backpack marks builds on the site.',
            '',
            `[Invite link](${INVITE})`,
          ].join('\n'),
        ),
      ],
    },
    {
      embeds: [
        section(
          images.youtube || '',
          'YouTube · smojo.',
          YOUTUBE,
          [
            'The channel is [@SmojoWasTaken](https://www.youtube.com/@SmojoWasTaken).',
            '',
            'The site is built around this channel. Guide videos on build pages play from YouTube, so a view on the site still counts there.',
          ].join('\n'),
        ),
      ],
    },
  ];
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
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify({ ids }, null, 2));
  for (const id of ids) remember(id);
}

const IMAGES = {
  welcome: 'assets/brand/logo-bpb.png',
  items: 'assets/theme/ui/items-catalog-scroll.gif',
  builds: 'assets/theme/ui/builds-grid-scroll.gif',
  create: 'assets/theme/ui/create-promo.gif',
  events: 'assets/theme/ui/ui-ranked-banner.png',
  market: 'assets/theme/ui/ui-shop-sign.png',
  quest: 'assets/theme/ui/ui-continue-banner.png',
  sim: 'assets/theme/ui/ui-character-sheet.png',
  profile: 'assets/brand/logo-bpb.png',
  about: 'assets/theme/ui/ui-label-banner-gold.png',
  discord: 'assets/theme/ui/ui-icon-discord.png',
  youtube: 'assets/theme/ui/ui-icon-youtube.png',
};

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
  const saved = readState();
  for (const id of saved.ids) remember(id);

  /** @type {Record<string, string>} */
  const images = {};
  for (const [name, filePath] of Object.entries(IMAGES)) {
    images[name] = await hostImage({ base, key }, name, filePath);
  }
  for (const name of ['welcome', 'items', 'builds', 'create']) {
    if (!images[name]) continue;
    const version = name === 'builds' ? 'grid' : 'slow';
    images[name] = `${images[name]}?v=${version}`;
  }

  const payloads = messages(images);
  /** @type {string[]} */
  const ids = saved.ids.length ? [...saved.ids] : [legacyId];

  for (let i = 0; i < payloads.length; i += 1) {
    const body = { content: null, embeds: payloads[i].embeds };
    const existing = ids[i];
    if (existing) {
      const patched = await discord(token, `/channels/${channelId}/messages/${existing}`, 'PATCH', body);
      if (patched.ok) {
        remember(existing);
        continue;
      }
      if (patched.status !== 404) {
        const detail = await patched.text();
        console.error(`Welcome edit failed (${patched.status}): ${detail.slice(0, 180)}`);
        continue;
      }
    }
    const posted = await discord(token, `/channels/${channelId}/messages`, 'POST', body);
    if (!posted.ok) {
      const detail = await posted.text();
      console.error(`Welcome post failed (${posted.status}): ${detail.slice(0, 180)}`);
      break;
    }
    const row = await posted.json();
    ids[i] = String(row.id || '');
    remember(ids[i]);
    writeState(ids.filter(Boolean));
    await sleep(400);
  }

  const keptIds = ids.slice(0, payloads.length).filter(Boolean);
  for (const extra of ids.slice(payloads.length)) {
    if (!extra || extra === legacyId) continue;
    await discord(token, `/channels/${channelId}/messages/${extra}`, 'DELETE');
  }
  writeState(keptIds);
  console.log(`Welcome guide updated (${keptIds.length} messages)`);
}
