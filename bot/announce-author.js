/**
 * Build-post credit: the name they use, plus the Discord picture or website blob
 * they picked in profile settings.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { useHostedCreatorIcon } from './announce-icon.js';
import { buildThumbPng } from './board-thumb.js';

const API = 'https://discord.com/api/v10';
const CLASS_EMOJI_NAMES = new Set([
  'adventurer',
  'berserker',
  'engineer',
  'mage',
  'pyromancer',
  'ranger',
  'reaper',
  'neutral',
]);

/** @type {Map<string, string>} */
let classEmojis = new Map();
/** @type {Map<string, string>} */
let classEmojiIds = new Map();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BLOB_BASE = path.join(ROOT, 'assets', 'blob', 'blob-base.png');
const SLOT_ORDER = ['hat', 'face', 'head', 'neck', 'body', 'hand'];

/** @type {Map<string, string> | null} */
let cosmeticFiles = null;

function cosmeticMap() {
  if (cosmeticFiles) return cosmeticFiles;
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data', 'blob-cosmetics.json'), 'utf8'));
  cosmeticFiles = new Map();
  for (const item of catalog.items || []) {
    const id = String(item?.id || '').trim();
    const image = String(item?.image || '').trim();
    if (id && image && !image.startsWith('http')) {
      cosmeticFiles.set(id, path.join(ROOT, image));
    }
  }
  return cosmeticFiles;
}

/**
 * @param {string | null | undefined} raw
 * @returns {'discord' | 'blob'}
 */
function identityMode(raw) {
  const equipped = String(raw || '').trim();
  if (!equipped || equipped === 'discord') return 'discord';
  if (equipped.startsWith('{')) {
    try {
      const parsed = JSON.parse(equipped);
      if (parsed?.v === 1) {
        return String(parsed.base || '').toLowerCase() === 'blob' ? 'blob' : 'discord';
      }
    } catch {
      /* use discord */
    }
  }
  if (equipped === 'blob' || equipped.startsWith('blob:')) return 'blob';
  return 'discord';
}

/**
 * @param {string | null | undefined} raw
 * @returns {Record<string, string | null> | null}
 */
function blobSlots(raw) {
  const equipped = String(raw || '').trim();
  if (!equipped.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(equipped);
    if (parsed?.v === 1 && parsed.slots && typeof parsed.slots === 'object') return parsed.slots;
  } catch {
    /* no slots */
  }
  return null;
}

/**
 * @param {string | null | undefined} equipped
 * @returns {Promise<Buffer>}
 */
async function blobPng(equipped) {
  const slots = blobSlots(equipped);
  /** @type {string[]} */
  const layers = [];
  if (slots) {
    const files = cosmeticMap();
    for (const slot of SLOT_ORDER) {
      const file = files.get(String(slots[slot] || ''));
      if (file && fs.existsSync(file)) layers.push(file);
    }
  }
  if (!layers.length) return fs.readFileSync(BLOB_BASE);
  const canvas = createCanvas(128, 128);
  const ctx = canvas.getContext('2d');
  const base = await loadImage(BLOB_BASE);
  ctx.drawImage(base, 0, 0, 128, 128);
  for (const layer of layers) {
    const img = await loadImage(layer);
    ctx.drawImage(img, 0, 0, 128, 128);
  }
  return canvas.toBuffer('image/png');
}

/**
 * @param {string} token
 * @param {string} guildId
 */
export async function loadClassEmojis(token, guildId) {
  const res = await fetch(`${API}/guilds/${guildId}/emojis`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!res.ok) return classEmojis;
  const list = await res.json();
  const next = new Map();
  const nextIds = new Map();
  for (const emoji of Array.isArray(list) ? list : []) {
    const name = String(emoji?.name || '');
    if (!CLASS_EMOJI_NAMES.has(name) || !emoji?.id) continue;
    next.set(name, emoji.animated ? `<a:${name}:${emoji.id}>` : `<:${name}:${emoji.id}>`);
    nextIds.set(name, String(emoji.id));
  }
  classEmojis = next;
  classEmojiIds = nextIds;
  return classEmojis;
}

/**
 * @param {string | null | undefined} heroClass
 */
export function classEmojiId(heroClass) {
  return classEmojiIds.get(String(heroClass || '').trim().toLowerCase()) || '';
}

/**
 * @param {string | null | undefined} heroClass
 * @param {string} [fallback]
 */
export function classFieldValue(heroClass, fallback = '') {
  const key = String(heroClass || '').trim().toLowerCase();
  return classEmojis.get(key) || fallback;
}

/**
 * @param {{ site: string }} config
 * @param {Record<string, unknown>} build
 */
export async function creatorCredit(config, build) {
  const profile = build.profiles && typeof build.profiles === 'object' ? build.profiles : {};
  const name = String(profile.display_name || build.author_name || '').replace(/\s+/g, ' ').trim();
  const mode = identityMode(profile.equipped_avatar);
  const discordId = String(profile.discord_id || '').trim();
  const profileUrl = discordId ? `${config.site}/u/?d=${encodeURIComponent(discordId)}` : '';
  /** @type {Buffer | null} */
  let file = null;
  let iconUrl = '';
  if (mode === 'blob') {
    file = await blobPng(profile.equipped_avatar);
    iconUrl = 'attachment://creator.png';
  } else {
    const avatar = String(profile.avatar_url || '').trim();
    if (/^https?:\/\//i.test(avatar)) iconUrl = avatar;
  }
  const author = name
    ? {
      name: [...name].slice(0, 256).join(''),
      ...(iconUrl ? { icon_url: iconUrl } : {}),
      ...(profileUrl ? { url: profileUrl } : {}),
    }
    : null;
  return {
    author,
    file,
    key: `${mode}|${name}|${mode === 'blob' ? `v3|${String(profile.equipped_avatar || '')}` : iconUrl}`,
  };
}

/**
 * @param {string} token
 * @param {string} apiPath
 * @param {string} method
 * @param {object} payload
 * @param {Buffer | null} [file]
 */
export async function postDiscord(token, apiPath, method, payload, file) {
  /** @type {Record<string, string>} */
  const headers = { Authorization: `Bot ${token}` };
  /** @type {BodyInit} */
  let body;
  const files = !file ? [] : Array.isArray(file) ? file : [{ filename: 'creator.png', bytes: file }];
  if (files.length) {
    const form = new FormData();
    form.append('payload_json', JSON.stringify(payload));
    files.forEach((entry, index) => {
      form.append(
        `files[${index}]`,
        new Blob([entry.bytes], { type: 'image/png' }),
        entry.filename || 'file.png',
      );
    });
    body = form;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(payload);
  }
  return fetch(`${API}${apiPath}`, { method, headers, body });
}

/**
 * @param {object} embed
 * @param {object | null} author
 */
function withAuthor(embed, author) {
  const next = {
    title: embed.title,
    url: embed.url,
    color: embed.color,
    ...(embed.description ? { description: embed.description } : {}),
    ...(author ? { author } : {}),
    ...(embed.fields?.length
      ? { fields: embed.fields.map((field) => ({ name: field.name, value: field.value, inline: Boolean(field.inline) })) }
      : {}),
    ...(embed.image?.url ? { image: { url: embed.image.url } } : {}),
    ...(embed.thumbnail?.url ? { thumbnail: { url: embed.thumbnail.url } } : {}),
    ...(embed.footer?.text ? { footer: { text: embed.footer.text } } : {}),
  };
  return next;
}

/**
 * Put the creator credit on posts that are already in the forum.
 * @param {{ token: string, site: string }} config
 * @param {Record<string, string>} known
 * @param {Record<string, string>} saved
 * @param {Record<string, unknown>[]} builds
 * @param {(slugs: Record<string, string>, linked: Set<string>, credit: Record<string, string>) => void} persist
 * @param {Set<string>} linked
 */
export async function refreshAuthorCredit(config, known, saved, builds, persist, linked) {
  let updated = 0;
  for (const build of builds) {
    const slug = String(build.slug || '');
    const threadId = known[slug];
    if (!slug || !threadId) continue;
    const credit = await creatorCredit(config, build);
    if (!credit.author || saved[slug] === credit.key) continue;
    await useHostedCreatorIcon(config, build, credit);
    const current = await postDiscord(config.token, `/channels/${threadId}/messages/${threadId}`, 'GET');
    if (!current.ok) continue;
    const message = await current.json();
    const embed = message.embeds?.[0];
    if (!embed) continue;
    const next = withAuthor(embed, credit.author);
    if (/^https?:\/\//i.test(String(credit.author.icon_url || ''))) next.thumbnail = { url: credit.author.icon_url };
    else delete next.thumbnail;
    const kept = (message.attachments || [])
      .filter((file) => file.filename === 'build.png' && file.id)
      .map((file) => ({ id: file.id }));
    const patched = await postDiscord(
      config.token,
      `/channels/${threadId}/messages/${threadId}`,
      'PATCH',
      {
        embeds: [next],
        ...(kept.length ? { attachments: kept } : {}),
      },
    );
    if (!patched.ok) {
      const detail = await patched.text();
      console.error(`Build credit failed for ${slug} (${patched.status}): ${detail.slice(0, 180)}`);
      continue;
    }
    saved[slug] = credit.key;
    persist(known, linked, saved);
    updated += 1;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  if (updated) console.log(`Build credit updated on ${updated} post${updated === 1 ? '' : 's'}`);
}

/**
 * @param {object} embed
 * @param {object[]} fields
 */
function embedWithFields(embed, fields) {
  return {
    title: embed.title,
    url: embed.url,
    color: embed.color,
    ...(embed.description ? { description: embed.description } : {}),
    ...(embed.author?.name
      ? {
        author: {
          name: embed.author.name,
          ...(embed.author.icon_url ? { icon_url: embed.author.icon_url } : {}),
          ...(embed.author.url ? { url: embed.author.url } : {}),
        },
      }
      : {}),
    ...(fields.length ? { fields } : {}),
    ...(embed.image?.url ? { image: { url: embed.image.url } } : {}),
    ...(embed.thumbnail?.url ? { thumbnail: { url: embed.thumbnail.url } } : {}),
    ...(embed.footer?.text ? { footer: { text: embed.footer.text } } : {}),
  };
}

/**
 * Swap the Class field from a name to the server emoji.
 * @param {{ token: string }} config
 * @param {Record<string, string>} known
 * @param {Set<string>} done
 * @param {(done: Set<string>) => void} persist
 */
export async function refreshClassFields(config, known, done, persist) {
  let updated = 0;
  for (const [slug, threadId] of Object.entries(known)) {
    if (!threadId || done.has(slug)) continue;
    const current = await postDiscord(config.token, `/channels/${threadId}/messages/${threadId}`, 'GET');
    if (!current.ok) continue;
    const message = await current.json();
    const embed = message.embeds?.[0];
    const fields = Array.isArray(embed?.fields) ? embed.fields : [];
    let changed = false;
    const nextFields = fields.map((field) => {
      const inline = Boolean(field.inline);
      if (field.name !== 'Class') return { name: field.name, value: field.value, inline };
      const emoji = classFieldValue(field.value, '');
      if (!emoji || emoji === field.value) return { name: field.name, value: field.value, inline };
      changed = true;
      return { name: 'Class', value: emoji, inline: true };
    });
    if (!changed) {
      done.add(slug);
      persist(done);
      continue;
    }
    const patched = await postDiscord(
      config.token,
      `/channels/${threadId}/messages/${threadId}`,
      'PATCH',
      { embeds: [embedWithFields(embed, nextFields)] },
    );
    if (!patched.ok) {
      const detail = await patched.text();
      console.error(`Class emoji failed for ${slug} (${patched.status}): ${detail.slice(0, 180)}`);
      continue;
    }
    done.add(slug);
    persist(done);
    updated += 1;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  if (updated) console.log(`Class emoji updated on ${updated} post${updated === 1 ? '' : 's'}`);
}

/**
 * Put the board picture on posts that are already in the forum.
 * The creator face stays the small image on the right.
 * @param {{ token: string, base: string, key: string }} config
 * @param {Record<string, string>} known
 * @param {Set<string>} done
 * @param {Record<string, unknown>[]} builds
 * @param {(done: Set<string>) => void} persist
 */
export async function refreshBoardThumbs(config, known, done, builds, persist) {
  const bySlug = new Map(builds.map((build) => [String(build.slug || ''), build]));
  let updated = 0;
  for (const [slug, threadId] of Object.entries(known)) {
    if (!threadId || done.has(slug)) continue;
    const build = bySlug.get(slug);
    if (!build) continue;
    const png = await buildThumbPng(config, build);
    if (!png) continue;
    const current = await postDiscord(config.token, `/channels/${threadId}/messages/${threadId}`, 'GET');
    if (!current.ok) continue;
    const message = await current.json();
    const embed = message.embeds?.[0];
    if (!embed) continue;
    const next = embedWithFields(embed, Array.isArray(embed.fields) ? embed.fields : []);
    const face = String(embed.author?.icon_url || '');
    delete next.image;
    if (/^https?:\/\//i.test(face)) next.thumbnail = { url: face };
    else delete next.thumbnail;
    const files = [{ filename: 'build.png', bytes: png }];
    const attachments = [{ id: 0, filename: 'build.png' }];
    const patched = await postDiscord(
      config.token,
      `/channels/${threadId}/messages/${threadId}`,
      'PATCH',
      { embeds: [next], attachments },
      files,
    );
    if (!patched.ok) {
      const detail = await patched.text();
      console.error(`Board thumbnail failed for ${slug} (${patched.status}): ${detail.slice(0, 180)}`);
      continue;
    }
    const saved = await patched.json().catch(() => null);
    const attached = (saved?.attachments || []).some((file) => file.filename === 'build.png');
    if (!attached) {
      console.error(`Board thumbnail did not stick for ${slug}`);
      continue;
    }
    done.add(slug);
    persist(done);
    updated += 1;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  if (updated) console.log(`Board thumbnail added on ${updated} post${updated === 1 ? '' : 's'}`);
}
