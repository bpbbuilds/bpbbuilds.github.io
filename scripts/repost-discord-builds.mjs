#!/usr/bin/env node

/**
 * Replace explicitly named Builds forum threads with the current one-image
 * embed payload. Requires --apply so a target mismatch cannot delete a post.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../bot/env.js';
import { postBody, ensureForum } from '../bot/announce.js';
import {
  creatorCredit,
  loadClassEmojis,
  postDiscord,
} from '../bot/announce-author.js';
import { useHostedCreatorIcon } from '../bot/announce-icon.js';
import { buildThumbPng, hostBoardImage, stillUrl } from '../bot/board-thumb.js';

const API = 'https://discord.com/api/v10';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const statePath = path.join(root, 'bot', 'data', 'announced-slugs.json');
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const slugs = args.filter((arg) => arg !== '--apply').map((arg) => String(arg).trim()).filter(Boolean);

if (!apply || slugs.length !== 2 || new Set(slugs).size !== 2) {
  throw new Error('Usage: node scripts/repost-discord-builds.mjs --apply <latest-slug> <second-latest-slug>');
}

const env = loadEnv();
const token = String(env.DISCORD_BOT_TOKEN || '').trim();
const guildId = String(env.DISCORD_GUILD_ID || '').trim();
const forumId = String(env.DISCORD_BUILDS_FORUM_ID || '1553880481001644062').trim();
const base = String(env.SUPABASE_PROJECT_URL || '').replace(/\/$/, '');
const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const site = String(env.DISCORD_BUILDS_SITE_URL || 'https://bpbbuilds.com').replace(/\/$/, '');
if (!token || !guildId || !base || !key) throw new Error('Discord/Supabase runtime environment is incomplete');

const config = { token, guildId, forumId, base, key, site };
const discord = async (apiPath, method = 'GET', body) => {
  const response = await fetch(`${API}${apiPath}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const parsed = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Discord ${method} ${apiPath} failed (${response.status}): ${JSON.stringify(parsed).slice(0, 240)}`);
  return parsed;
};

const rest = async (query) => {
  const response = await fetch(`${base}/rest/v1/${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) throw new Error(`Supabase ${query} failed (${response.status})`);
  return response.json();
};

const starterSlug = (message) => String(message?.embeds?.[0]?.footer?.text || '').trim();
const createdAt = (thread) => String(thread?.thread_metadata?.create_timestamp || thread?.created_at || '');

const active = await discord(`/guilds/${guildId}/threads/active`);
const archived = await discord(`/channels/${forumId}/threads/archived/public?limit=100`);
const threads = [
  ...(active.threads || []).filter((thread) => thread.parent_id === forumId),
  ...(archived.threads || []),
];
const uniqueThreads = [...new Map(threads.map((thread) => [thread.id, thread])).values()];
const inspected = [];
for (const thread of uniqueThreads) {
  const message = await discord(`/channels/${thread.id}/messages/${thread.id}`);
  inspected.push({ thread, message, slug: starterSlug(message) });
}
const ordered = inspected.sort((a, b) => createdAt(b.thread).localeCompare(createdAt(a.thread)));
const newest = ordered.slice(0, 2).map((row) => row.slug);
if (new Set(newest).size !== 2 || slugs.some((slug) => !newest.includes(slug))) {
  throw new Error(`Refusing to delete: requested slugs are not the two newest forum posts (${newest.join(', ')})`);
}
const targets = slugs.map((slug) => ordered.find((row) => row.slug === slug));
if (targets.some((row) => !row)) throw new Error('Refusing to delete: a requested slug was not found');

const select = [
  'id', 'slug', 'title', 'hero_class', 'blurb', 'author_name', 'build_tag', 'is_op', 'rank',
  'board_still_path', 'youtube_url', 'vote_score', 'created_at',
  'profiles(display_name,avatar_url,equipped_avatar,discord_id)',
].join(',');
const builds = [];
for (const slug of slugs) {
  const rows = await rest(`builds?select=${encodeURIComponent(select)}&is_public=eq.true&slug=eq.${encodeURIComponent(slug)}`);
  const build = Array.isArray(rows) ? rows[0] : null;
  if (!build) throw new Error(`Public build not found for ${slug}`);
  builds.push(build);
}

console.log(JSON.stringify(targets.map(({ thread, message, slug }) => ({
  slug,
  threadId: thread.id,
  createdAt: createdAt(thread),
  title: message.embeds?.[0]?.title || thread.name || '',
  attachments: (message.attachments || []).map((file) => file.filename),
  embedImage: message.embeds?.[0]?.image?.url || '',
})), null, 2));

await loadClassEmojis(token, guildId);
const tagIds = await ensureForum(config);
const replacements = [];
for (const build of builds) {
  const slug = String(build.slug);
  const credit = await creatorCredit(config, build);
  await useHostedCreatorIcon(config, build, credit);
  const png = await buildThumbPng(config, build);
  const boardImage = png ? await hostBoardImage(config, slug, png) : stillUrl(config, build);
  credit.boardImage = boardImage || '';
  replacements.push({ slug, payload: await postBody(config, build, tagIds, credit) });
}

for (const target of targets) {
  await discord(`/channels/${target.thread.id}`, 'DELETE');
  console.log(`Deleted ${target.slug} (${target.thread.id})`);
}

const creationOrder = new Map(targets.map((target) => [target.slug, createdAt(target.thread)]));
const newIds = {};
for (const replacement of replacements.sort((a, b) => String(creationOrder.get(a.slug)).localeCompare(String(creationOrder.get(b.slug))))) {
  const posted = await postDiscord(token, `/channels/${forumId}/threads`, 'POST', replacement.payload, null);
  if (!posted.ok) throw new Error(`Repost failed for ${replacement.slug} (${posted.status})`);
  const thread = await posted.json();
  newIds[replacement.slug] = String(thread.id || '');
  console.log(`Reposted ${replacement.slug} as ${newIds[replacement.slug]}`);
}

const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
for (const [slug, id] of Object.entries(newIds)) state.slugs[slug] = id;
await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
console.log('Updated local bot announcement state.');
