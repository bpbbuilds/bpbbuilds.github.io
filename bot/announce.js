/**
 * Posts each public website build into the Discord builds forum.
 * Private and unreleased event builds stay off the forum (is_public only).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { moveCreatorIcons, useHostedCreatorIcon } from './announce-icon.js';
import { embedDescription, fieldsWithLinks, foldLinksIntoPosts, showBuildInEmbeds, applyLinkColumns } from './announce-links.js';
import { refreshItemMentions, withItemEmoji } from './announce-mentions.js';
import { applyVoteButtons, voteComponentsFor } from './announce-votes.js';
import { buildThumbPng, hostBoardImage, stillUrl } from './board-thumb.js';
import {
  classEmojiId,
  classFieldValue,
  creatorCredit,
  loadClassEmojis,
  postDiscord,
  refreshAuthorCredit,
  refreshBoardThumbs,
  refreshClassFields,
} from './announce-author.js';

const API = 'https://discord.com/api/v10';
const FORUM_ID_DEFAULT = '1553880481001644062';
const SITE_DEFAULT = 'https://bpbbuilds.github.io';
const POLL_MS = 60_000;
const POST_GAP_MS = 1500;
const MAX_POSTS_PER_POLL = 10;

const CLASS_LABELS = {
  adventurer: 'Adventurer',
  berserker: 'Berserker',
  engineer: 'Engineer',
  mage: 'Mage',
  pyromancer: 'Pyromancer',
  ranger: 'Ranger',
  reaper: 'Reaper',
  neutral: 'Neutral',
};

const TAG_LABELS = {
  theory: 'Theory',
  feasible: 'Feasible',
  real: 'Real',
};

const RANK_LABELS = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
  master: 'Master',
  grandmaster: 'Grandmaster',
  grandma: 'Grandma',
};

const FORUM_TOPIC = 'Builds published on the website are posted here automatically.';
const CLASS_KEYS = Object.keys(CLASS_LABELS);
const OTHER_TAG_NAMES = [...Object.values(TAG_LABELS), 'OP'];

const CLASS_TAG_MARKS = ['\u0301', '\u0302', '\u0303', '\u0304', '\u0306', '\u0307', '\u0308', '\u030A'];

/**
 * Discord drops blank tag names, and it still requires each name to be unique.
 * A dot keeps the class word off the tag. The class icon is the emoji on that tag.
 * @param {number} index
 */
function classTagName(index) {
  return `\u00B7${CLASS_TAG_MARKS[index] || ''}`;
}

const statePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'announced-slugs.json');

/**
 * @param {string} token
 * @param {string} apiPath
 * @param {string} [method]
 * @param {object} [body]
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
    if (res.status !== 429 || method !== 'GET') return res;
    const retry = await res.json().catch(() => ({}));
    const wait = Math.ceil(Number(retry.retry_after || 1) * 1000);
    await sleep(wait);
  }
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

function clip(text, max) {
  const chars = [...String(text || '')];
  if (chars.length <= max) return chars.join('');
  return `${chars.slice(0, Math.max(1, max - 1)).join('').trimEnd()}…`;
}

function labelOf(map, value) {
  const key = String(value || '').trim().toLowerCase();
  return map[key] || '';
}

/**
 * @param {Record<string, string>} env
 */
function publicSite(env) {
  const raw = String(env.DISCORD_BUILDS_SITE_URL || SITE_DEFAULT).trim();
  try {
    const url = new URL(raw);
    const host = url.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return SITE_DEFAULT;
    return url.origin;
  } catch {
    return SITE_DEFAULT;
  }
}

function announceConfig(env) {
  const base = String(env.SUPABASE_PROJECT_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const forumId = env.DISCORD_BUILDS_FORUM_ID || FORUM_ID_DEFAULT;
  return {
    token: env.DISCORD_BOT_TOKEN,
    guildId: env.DISCORD_GUILD_ID,
    forumId,
    base,
    key,
    site: publicSite(env),
  };
}

/**
 * @returns {{ slugs: Record<string, string>, linked: string[], credit: Record<string, string> }}
 */
function readState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const slugs = parsed?.slugs && typeof parsed.slugs === 'object' ? parsed.slugs : {};
    const linked = Array.isArray(parsed?.linked) ? parsed.linked.map(String) : [];
    const credit = parsed?.credit && typeof parsed.credit === 'object' ? parsed.credit : {};
    const classEmoji = Array.isArray(parsed?.classEmoji) ? parsed.classEmoji.map(String) : [];
    const thumbs = Array.isArray(parsed?.thumbs) ? parsed.thumbs.map(String) : [];
    const icons = Array.isArray(parsed?.icons) ? parsed.icons.map(String) : [];
    return { slugs, linked, credit, classEmoji, thumbs, icons };
  } catch {
    return { slugs: {}, linked: [], credit: {}, classEmoji: [], thumbs: [], icons: [] };
  }
}

/**
 * @param {Record<string, string>} slugs
 * @param {Set<string>} linked
 * @param {Record<string, string>} credit
 */
function writeState(slugs, linked, credit, classDone, thumbDone, iconDone) {
  let kept = [];
  let keptThumbs = [];
  let keptIcons = [];
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    if (Array.isArray(parsed?.classEmoji)) kept = parsed.classEmoji.map(String);
    if (Array.isArray(parsed?.thumbs)) keptThumbs = parsed.thumbs.map(String);
    if (Array.isArray(parsed?.icons)) keptIcons = parsed.icons.map(String);
  } catch {
    /* new file */
  }
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const tmp = `${statePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({
    slugs,
    linked: [...linked],
    credit,
    classEmoji: classDone ? [...classDone] : kept,
    thumbs: thumbDone ? [...thumbDone] : keptThumbs,
    icons: iconDone ? [...iconDone] : keptIcons,
  }, null, 2));
  fs.renameSync(tmp, statePath);
}

function slugFromMessage(message) {
  const footer = String(message?.embeds?.[0]?.footer?.text || '');
  if (footer && !footer.includes(' ')) return footer;
  const url = String(message?.embeds?.[0]?.url || '');
  try {
    const slug = new URL(url).searchParams.get('slug');
    return slug ? decodeURIComponent(slug) : '';
  } catch {
    return '';
  }
}

/**
 * @param {ReturnType<typeof announceConfig>} config
 * @param {Record<string, string>} known
 */
async function rememberExistingThreads(config, known) {
  const knownIds = new Set(Object.values(known));
  /** @type {{ id: string }[]} */
  const threads = [];
  const activeRes = await discord(config.token, `/guilds/${config.guildId}/threads/active`);
  if (activeRes.ok) {
    const active = await activeRes.json();
    for (const thread of active.threads || []) {
      if (thread.parent_id === config.forumId) threads.push(thread);
    }
  }
  let before = '';
  for (let page = 0; page < 20; page += 1) {
    const query = before ? `?limit=100&before=${encodeURIComponent(before)}` : '?limit=100';
    const res = await discord(
      config.token,
      `/channels/${config.forumId}/threads/archived/public${query}`,
    );
    if (!res.ok) break;
    const body = await res.json();
    const batch = body.threads || [];
    threads.push(...batch);
    if (!body.has_more || !batch.length) break;
    before = batch[batch.length - 1]?.thread_metadata?.archive_timestamp || '';
    if (!before) break;
  }

  for (const thread of threads) {
    if (knownIds.has(thread.id)) continue;
    const res = await discord(config.token, `/channels/${thread.id}/messages/${thread.id}`);
    if (!res.ok) continue;
    const slug = slugFromMessage(await res.json());
    if (!slug || known[slug]) continue;
    known[slug] = thread.id;
    knownIds.add(thread.id);
  }
}

/**
 * @param {ReturnType<typeof announceConfig>} config
 */
/**
 * @param {ReturnType<typeof announceConfig>} config
 */
export async function ensureForum(config) {
  const res = await discord(config.token, `/channels/${config.forumId}`);
  if (!res.ok) {
    console.error(`Builds forum lookup failed (${res.status})`);
    return new Map();
  }
  const channel = await res.json();
  const current = channel.available_tags || [];
  /** @type {{ id?: string, name: string, moderated: boolean, emoji_id?: string | null, label: string }[]} */
  const planned = [];
  CLASS_KEYS.forEach((key, index) => {
    const label = CLASS_LABELS[key];
    const emojiId = classEmojiId(key);
    const name = emojiId ? classTagName(index) : label;
    const existing = current.find((tag) => tag.name === label || tag.name === name || (emojiId && tag.emoji_id === emojiId));
    planned.push({
      ...(existing?.id ? { id: existing.id } : {}),
      name,
      moderated: false,
      ...(emojiId ? { emoji_id: emojiId } : {}),
      label,
    });
  });
  for (const name of OTHER_TAG_NAMES) {
    const existing = current.find((tag) => tag.name === name);
    planned.push({
      ...(existing?.id ? { id: existing.id } : {}),
      name,
      moderated: false,
      label: name,
    });
  }
  const tagsMatch = planned.every((tag) => current.some((row) => (
    row.name === tag.name
    && String(row.emoji_id || '') === String(tag.emoji_id || '')
  )));
  /** @type {Map<string, string>} */
  const tagIds = new Map();
  for (const tag of current) {
    const plannedTag = planned.find((row) => row.id && row.id === tag.id);
    if (plannedTag) tagIds.set(plannedTag.label, tag.id);
    else if (tag.name) tagIds.set(tag.name, tag.id);
  }
  const topicMatch = channel.topic === FORUM_TOPIC;
  const sortMatch = channel.default_sort_order === 1;
  if (topicMatch && tagsMatch && sortMatch && tagIds.size >= planned.length) return tagIds;

  const available_tags = planned.map(({ label, ...tag }) => tag);
  const patched = await discord(config.token, `/channels/${config.forumId}`, 'PATCH', {
    topic: FORUM_TOPIC,
    available_tags,
    default_sort_order: 1,
  });
  if (!patched.ok) {
    const detail = await patched.text();
    console.error(`Builds forum update failed (${patched.status}): ${detail.slice(0, 180)}`);
    return tagIds;
  }
  const next = await patched.json();
  const ids = new Map();
  for (const tag of next.available_tags || []) {
    const plannedTag = planned.find((row) => (row.id && row.id === tag.id) || row.name === tag.name);
    if (plannedTag) ids.set(plannedTag.label, tag.id);
  }
  console.log('Builds forum class tags use the class icons');
  return ids;
}

/**
 * @param {ReturnType<typeof announceConfig>} config
 */
async function listPublicBuilds(config) {
  const headers = { apikey: config.key, Authorization: `Bearer ${config.key}` };
  const select = [
    'id',
    'slug',
    'title',
    'hero_class',
    'blurb',
    'author_name',
    'build_tag',
    'is_op',
    'rank',
    'board_still_path',
    'youtube_url',
    'vote_score',
    'created_at',
    'profiles(display_name,avatar_url,equipped_avatar,discord_id)',
  ].join(',');
  const res = await fetch(
    `${config.base}/rest/v1/builds?select=${select}&is_public=eq.true&order=created_at.asc`,
    { headers },
  );
  if (!res.ok) throw new Error(`builds list failed (${res.status})`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

function buildUrl(config, slug) {
  return `${config.site}/builds/view/?slug=${encodeURIComponent(slug)}`;
}

/**
 * @param {ReturnType<typeof announceConfig>} config
 * @param {Record<string, unknown>} build
 * @param {Map<string, string>} tagIds
 */
async function postBody(config, build, tagIds, credit) {
  const slug = String(build.slug || '');
  const title = clip(String(build.title || 'Build').replace(/\s+/g, ' ').trim() || 'Build', 100);
  const className = labelOf(CLASS_LABELS, build.hero_class);
  const tagName = labelOf(TAG_LABELS, build.build_tag);
  const rank = labelOf(RANK_LABELS, build.rank);
  const fields = [];
  const classValue = classFieldValue(build.hero_class, className);
  if (classValue) fields.push({ name: 'Class', value: classValue, inline: true });
  if (tagName) fields.push({ name: 'Tag', value: tagName, inline: true });
  if (rank) fields.push({ name: 'Rank', value: rank, inline: true });
  if (build.is_op) fields.push({ name: 'OP', value: 'Yes', inline: true });
  const blurb = clip(await withItemEmoji(config, String(build.blurb || '').replace(/\s+/g, ' ').trim()), 500);
  const description = embedDescription(config, slug, blurb);
  const author = credit?.author || (String(build.author_name || '').trim()
    ? { name: clip(String(build.author_name || '').trim(), 256) }
    : null);
  const image = stillUrl(config, build);
  const boardImage = credit?.boardUrl || (credit?.thumb ? '' : image);
  const faceUrl = String(credit?.author?.icon_url || '');
  const faceThumb = /^https?:\/\//i.test(faceUrl) ? faceUrl : '';
  const applied = [];
  for (const name of [className, tagName, build.is_op ? 'OP' : '']) {
    const id = name ? tagIds.get(name) : '';
    if (id && applied.length < 5) applied.push(id);
  }
  return {
    name: title,
    ...(applied.length ? { applied_tags: applied } : {}),
    message: {
      embeds: [{
        title: clip(String(build.title || 'Build').trim() || 'Build', 256),
        url: buildUrl(config, slug),
        ...(description ? { description } : {}),
        color: 0xeac914,
        ...(author ? { author } : {}),
        fields: fieldsWithLinks(config, build, fields),
        ...(boardImage ? { image: { url: boardImage } } : {}),
        ...(faceThumb ? { thumbnail: { url: faceThumb } } : {}),
        footer: { text: slug },
      }],
      components: await voteComponentsFor(config.token, slug, build.vote_score),
      ...(credit?.thumb ? { attachments: [{ id: 0, filename: 'build.png' }] } : {}),
    },
  };
}

/**
 * @param {ReturnType<typeof announceConfig>} config
 * @param {Record<string, string>} known
 * @param {Map<string, string>} tagIds
 * @param {Set<string>} linked
 */
async function postPending(config, known, tagIds, linked, creditState, thumbDone) {
  const builds = await listPublicBuilds(config);
  const pending = builds.filter((build) => build?.slug && !known[String(build.slug)]);
  if (!pending.length) return 0;
  let posted = 0;
  for (const build of pending.slice(0, MAX_POSTS_PER_POLL)) {
    const slug = String(build.slug);
    const credit = await creatorCredit(config, build);
    await useHostedCreatorIcon(config, build, credit);
    const thumb = await buildThumbPng(config, build);
    credit.boardUrl = thumb ? await hostBoardImage(config, slug, thumb) : '';
    credit.thumb = false;
    const files = [];
    const res = await postDiscord(
      config.token,
      `/channels/${config.forumId}/threads`,
      'POST',
      await postBody(config, build, tagIds, credit),
      files.length ? files : null,
    );
    if (!res.ok) {
      const detail = await res.text();
      console.error(`Build post failed for ${slug} (${res.status}): ${detail.slice(0, 180)}`);
      await sleep(POST_GAP_MS);
      continue;
    }
    const thread = await res.json();
    const threadId = String(thread.id || '');
    known[slug] = threadId;
    if (credit.key) creditState[slug] = credit.key;
    if (thumb) thumbDone.add(slug);
    writeState(known, linked, creditState, null, thumbDone);
    posted += 1;
    console.log(`Posted build ${slug}`);
    if (posted < pending.length && posted < MAX_POSTS_PER_POLL) await sleep(POST_GAP_MS);
  }
  console.log(`Build announce posted ${posted} this pass`);
  return posted;
}

/**
 * Poll while the watch process runs.
 * @param {Record<string, string>} env
 */
export function startBuildAnnounce(env) {
  const config = announceConfig(env);
  if (!config.token || !config.guildId || !config.base || !config.key) {
    console.error('Build announce skipped: missing Discord or Supabase env');
    return;
  }
  const loop = async () => {
    const saved = readState();
    const known = saved.slugs;
    const linked = new Set(saved.linked);
    const credit = saved.credit;
    const classDone = new Set(saved.classEmoji);
    const mentionDone = new Set();
    const thumbDone = new Set(saved.thumbs);
    const iconDone = new Set(saved.icons);
    const embedShown = new Set();
    await loadClassEmojis(config.token, config.guildId);
    await rememberExistingThreads(config, known);
    writeState(known, linked, credit, classDone, thumbDone);
    const tagIds = await ensureForum(config);
    console.log(`Build announce watching ${config.forumId}`);
    for (;;) {
      try {
        await rememberExistingThreads(config, known);
        const builds = await listPublicBuilds(config);
        writeState(known, linked, credit, classDone, thumbDone);
        await postPending(config, known, tagIds, linked, credit, thumbDone);
        await foldLinksIntoPosts(config, known, linked, builds, () => {
          writeState(known, linked, credit, classDone, thumbDone);
        });
        await applyLinkColumns(config, known, builds);
        await applyVoteButtons(config, known, builds);
        await refreshAuthorCredit(config, known, credit, builds, writeState, linked);
        await refreshClassFields(config, known, classDone, (done) => {
          writeState(known, linked, credit, done, thumbDone);
        });
        await refreshBoardThumbs(config, known, thumbDone, builds, (done) => {
          writeState(known, linked, credit, classDone, done, iconDone);
        });
        await moveCreatorIcons(config, known, iconDone, builds, (done) => {
          writeState(known, linked, credit, classDone, thumbDone, done);
        }, { creatorCredit, postDiscord });
        await showBuildInEmbeds(config, known, embedShown, builds);
        await refreshItemMentions(config, known, mentionDone);
      } catch (err) {
        console.error(err instanceof Error ? err.message : err);
      }
      await sleep(POLL_MS);
    }
  };
  loop().catch((err) => console.error(err instanceof Error ? err.message : err));
}
