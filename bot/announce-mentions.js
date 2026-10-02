/**
 * Build notes store item chips as [[item_id]].
 * Discord shows those as the item picture via the bot's own emoji list.
 * The server list is only 50. The bot list holds 2000, which covers the catalog.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const API = 'https://discord.com/api/v10';
const MENTION = /\[\[([a-z0-9_]+)\]\]/gi;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPRITES = path.join(ROOT, 'assets', 'item-sprites');

/** @type {Map<string, { name: string, image: string }> | null} */
let catalog = null;
/** @type {Map<string, string> | null} */
let emojis = null;
let appId = '';

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
 * @param {{ base: string, key: string }} config
 */
async function itemCatalog(config) {
  if (catalog) return catalog;
  const map = new Map();
  let from = 0;
  while (from < 5000) {
    const res = await fetch(`${config.base}/rest/v1/items?select=id,name,image&order=id.asc`, {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        Range: `${from}-${from + 499}`,
      },
    });
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) break;
    for (const row of rows) {
      const id = String(row?.id || '').toLowerCase();
      if (!id) continue;
      map.set(id, { name: String(row?.name || id), image: String(row?.image || '') });
    }
    if (rows.length < 500) break;
    from += 500;
  }
  catalog = map;
  return map;
}

/**
 * @param {string} token
 */
async function applicationId(token) {
  if (appId) return appId;
  const res = await discord(token, '/oauth2/applications/@me');
  if (!res.ok) return '';
  const row = await res.json();
  appId = String(row?.id || '');
  return appId;
}

/**
 * @param {{ name?: string, id?: string, animated?: boolean }} emoji
 */
function markup(emoji) {
  const name = String(emoji?.name || '');
  const id = String(emoji?.id || '');
  if (!name || !id) return '';
  return emoji?.animated ? `<a:${name}:${id}>` : `<:${name}:${id}>`;
}

/**
 * @param {string} token
 */
async function emojiMap(token) {
  if (emojis) return emojis;
  const id = await applicationId(token);
  emojis = new Map();
  if (!id) return emojis;
  const res = await discord(token, `/applications/${id}/emojis`);
  if (!res.ok) return emojis;
  const row = await res.json();
  for (const emoji of row?.items || []) {
    const name = String(emoji?.name || '');
    const tokenText = markup(emoji);
    if (name && tokenText) emojis.set(name, tokenText);
  }
  return emojis;
}

/**
 * @param {string} filePath
 */
async function emojiPng(filePath) {
  const img = await loadImage(fs.readFileSync(filePath));
  const canvas = createCanvas(128, 128);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const scale = Math.min(112 / img.width, 112 / img.height);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  ctx.drawImage(img, Math.round((128 - w) / 2), Math.round((128 - h) / 2), w, h);
  return canvas.toBuffer('image/png');
}

/**
 * @param {string} token
 * @param {string} itemId
 * @param {string} filePath
 */
async function ensureEmoji(token, itemId, filePath) {
  const map = await emojiMap(token);
  if (map.has(itemId)) return map.get(itemId) || '';
  if (!filePath || !fs.existsSync(filePath)) return '';
  const png = await emojiPng(filePath);
  if (png.length > 256 * 1024) return '';
  const id = await applicationId(token);
  if (!id) return '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await discord(token, `/applications/${id}/emojis`, 'POST', {
      name: itemId,
      image: `data:image/png;base64,${png.toString('base64')}`,
    });
    if (res.status === 429) {
      const retry = await res.json().catch(() => ({}));
      await sleep(Math.ceil(Number(retry.retry_after || 1) * 1000));
      emojis = null;
      const again = await emojiMap(token);
      if (again.has(itemId)) return again.get(itemId) || '';
      continue;
    }
    if (!res.ok) {
      const detail = await res.text();
      console.error(`Item emoji ${itemId} failed (${res.status}): ${detail.slice(0, 160)}`);
      emojis = null;
      const again = await emojiMap(token);
      return again.get(itemId) || '';
    }
    const row = await res.json();
    const tokenText = markup(row);
    if (tokenText) map.set(itemId, tokenText);
    await sleep(400);
    return tokenText;
  }
  return '';
}

/**
 * @param {{ token: string, base: string, key: string }} config
 * @param {string} text
 */
export async function withItemEmoji(config, text) {
  const raw = String(text || '');
  const ids = [...new Set([...raw.matchAll(new RegExp(MENTION.source, 'gi'))].map((hit) => hit[1].toLowerCase()))];
  if (!ids.length || !config.token || !config.base || !config.key) return raw;
  const items = await itemCatalog(config);
  /** @type {Map<string, string>} */
  const chosen = new Map();
  for (const id of ids) {
    const item = items.get(id);
    const file = item?.image ? path.join(SPRITES, item.image) : '';
    const emoji = await ensureEmoji(config.token, id, file);
    chosen.set(id, emoji || item?.name || id);
  }
  return raw.replace(new RegExp(MENTION.source, 'gi'), (_, id) => chosen.get(String(id).toLowerCase()) || id);
}

/**
 * Rewrite forum posts that still show [[item_id]].
 * @param {{ token: string, base: string, key: string }} config
 * @param {Record<string, string>} known
 * @param {Set<string>} done
 */
export async function refreshItemMentions(config, known, done) {
  let updated = 0;
  for (const [slug, threadId] of Object.entries(known)) {
    if (!threadId || done.has(slug)) continue;
    const current = await discord(config.token, `/channels/${threadId}/messages/${threadId}`);
    if (!current.ok) continue;
    const message = await current.json();
    const embed = message.embeds?.[0];
    const description = String(embed?.description || '');
    if (!MENTION.test(description)) {
      MENTION.lastIndex = 0;
      done.add(slug);
      continue;
    }
    MENTION.lastIndex = 0;
    const next = await withItemEmoji(config, description);
    if (!next || next === description) {
      done.add(slug);
      continue;
    }
    const patched = await discord(config.token, `/channels/${threadId}/messages/${threadId}`, 'PATCH', {
      embeds: [{
        title: embed.title,
        ...(embed.url ? { url: embed.url } : {}),
        ...(embed.color ? { color: embed.color } : {}),
        description: next,
        ...(embed.author?.name
          ? {
            author: {
              name: embed.author.name,
              ...(embed.author.icon_url ? { icon_url: embed.author.icon_url } : {}),
              ...(embed.author.url ? { url: embed.author.url } : {}),
            },
          }
          : {}),
        ...(embed.fields?.length
          ? { fields: embed.fields.map((field) => ({ name: field.name, value: field.value, inline: Boolean(field.inline) })) }
          : {}),
        ...(embed.image?.url ? { image: { url: embed.image.url } } : {}),
        ...(embed.thumbnail?.url ? { thumbnail: { url: embed.thumbnail.url } } : {}),
        ...(embed.footer?.text ? { footer: { text: embed.footer.text } } : {}),
      }],
    });
    if (!patched.ok) {
      const detail = await patched.text();
      console.error(`Item emoji post failed for ${slug} (${patched.status}): ${detail.slice(0, 160)}`);
      continue;
    }
    done.add(slug);
    updated += 1;
    await sleep(400);
  }
  if (updated) console.log(`Item emoji added on ${updated} build post${updated === 1 ? '' : 's'}`);
}
