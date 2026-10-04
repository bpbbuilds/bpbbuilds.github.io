/**
 * /blob — the member’s equipped blob as one image embed.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { loadEnv } from '../env.js';

const SITE = 'https://bpbbuilds.com';
const GOLD = 0xeac914;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BLOB_BASE = path.join(ROOT, 'assets', 'blob', 'blob-base.png');
const SLOT_ORDER = ['hat', 'face', 'head', 'neck', 'body', 'hand'];

/** @type {Map<string, string> | null} */
let cosmeticFiles = null;

export const blobCommand = {
  name: 'blob',
  description: 'Show a member’s equipped blob.',
  options: [
    {
      name: 'user',
      description: 'Whose blob to show. Defaults to you.',
      type: 6,
      required: false,
    },
  ],
};

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
 * @param {unknown} raw
 * @returns {Record<string, string | null> | null}
 */
function blobSlots(raw) {
  let parsed = raw;
  if (typeof raw === 'string') {
    const equipped = raw.trim();
    if (!equipped.startsWith('{')) return null;
    try {
      parsed = JSON.parse(equipped);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const slots = /** @type {{ v?: unknown, slots?: unknown }} */ (parsed).slots;
  if (/** @type {{ v?: unknown }} */ (parsed).v === 1 && slots && typeof slots === 'object') {
    return /** @type {Record<string, string | null>} */ (slots);
  }
  return null;
}

/**
 * @param {unknown} equipped
 */
export async function equippedBlobPng(equipped) {
  const slots = blobSlots(equipped);
  const files = cosmeticMap();
  /** @type {string[]} */
  const layers = [];
  if (slots) {
    for (const slot of SLOT_ORDER) {
      const file = files.get(String(slots[slot] || ''));
      if (file && fs.existsSync(file)) layers.push(file);
    }
  }
  const base = await loadImage(fs.readFileSync(BLOB_BASE));
  const scale = 8;
  const canvas = createCanvas(base.width * scale, base.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, 0, 0, base.width * scale, base.height * scale);
  for (const file of layers) {
    const overlay = await loadImage(fs.readFileSync(file));
    ctx.drawImage(overlay, 0, 0, base.width * scale, base.height * scale);
  }
  return canvas.toBuffer('image/png');
}

/**
 * @param {string} discordId
 */
async function loadProfile(discordId) {
  const env = loadEnv();
  const base = String(env.SUPABASE_PROJECT_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!base || !key) return null;
  const url = `${base}/rest/v1/profiles?select=display_name,equipped_avatar&discord_id=eq.${encodeURIComponent(discordId)}`;
  const res = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {string} discordId
 * @param {string} fallback
 */
async function displayName(interaction, discordId, fallback) {
  const named = String(fallback || '').replace(/\s+/g, ' ').trim();
  if (named) return named;
  const user = await interaction.client.users.fetch(discordId).catch(() => null);
  return user?.globalName || user?.username || 'Member';
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function handleBlob(interaction) {
  const user = interaction.options.getUser('user') || interaction.user;
  await interaction.deferReply();
  const profile = await loadProfile(user.id);
  const name = await displayName(interaction, user.id, profile?.display_name);
  const png = await equippedBlobPng(profile?.equipped_avatar);
  const embed = new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(`${name}'s blob`)
    .setURL(`${SITE}/u/?d=${encodeURIComponent(user.id)}`)
    .setImage('attachment://blob.png');
  await interaction.editReply({
    embeds: [embed],
    files: [new AttachmentBuilder(png, { name: 'blob.png' })],
  });
}
