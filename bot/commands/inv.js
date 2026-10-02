/**
 * /inv — one owned blob cosmetic per page, with Previous / Next.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { loadEnv } from '../env.js';

const SITE = 'https://bpbbuilds.github.io';
const GOLD = 0xeac914;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BLOB_BASE = path.join(ROOT, 'assets', 'blob', 'blob-base.png');
const SLOT_ORDER = ['hat', 'face', 'head', 'neck', 'body', 'hand'];
const SLOT_LABEL = {
  hat: 'Hat',
  face: 'Face',
  head: 'Full head',
  neck: 'Neck',
  body: 'Body',
  hand: 'Hand',
};

/** @type {object[] | null} */
let catalog = null;

export const invCommand = {
  name: 'inv',
  description: 'Page through a member’s blob inventory, one item image at a time.',
  options: [
    {
      name: 'user',
      description: 'Whose inventory to open. Defaults to you.',
      type: 6,
      required: false,
    },
  ],
};

function loadCatalog() {
  if (catalog) return catalog;
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data', 'blob-cosmetics.json'), 'utf8'));
  catalog = (Array.isArray(raw.items) ? raw.items : [])
    .map((item) => {
      const id = String(item?.id || '').trim();
      const slot = String(item?.slot || '').trim();
      if (!id || !SLOT_ORDER.includes(slot)) return null;
      const image = String(item?.image || '').trim();
      const file = image && !image.startsWith('http') ? path.join(ROOT, image) : '';
      return {
        id,
        name: String(item?.name || id).trim() || id,
        slot,
        starter: item?.starter === true,
        grant: String(item?.grant || (item?.starter ? 'starter' : '')).trim().toLowerCase(),
        rarity: String(item?.rarity || 'Common').trim() || 'Common',
        file,
      };
    })
    .filter(Boolean);
  return catalog;
}

/**
 * @param {ReturnType<typeof loadCatalog>[number]} item
 * @param {Record<string, unknown> | null} profile
 */
function owns(item, profile) {
  if (profile?.is_owner) return true;
  if (item.starter || item.grant === 'starter') return true;
  const plan = String(profile?.plan || 'free').toLowerCase();
  if (item.grant === 'premium') return plan === 'premium' || plan === 'founding';
  if (item.grant === 'founding') return plan === 'founding';
  if (item.grant === 'event') {
    const grants = Array.isArray(profile?.cosmetic_grants) ? profile.cosmetic_grants : [];
    return grants.map((id) => String(id || '').trim()).includes(item.id);
  }
  return false;
}

/**
 * @param {string} discordId
 */
async function loadProfile(discordId) {
  const env = loadEnv();
  const base = String(env.SUPABASE_PROJECT_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!base || !key) return null;
  const url = `${base}/rest/v1/profiles?select=display_name,plan,is_owner,cosmetic_grants&discord_id=eq.${encodeURIComponent(discordId)}`;
  const res = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

/**
 * @param {string} file
 */
async function itemPng(file) {
  const base = await loadImage(fs.readFileSync(BLOB_BASE));
  const canvas = createCanvas(base.width, base.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(base, 0, 0);
  if (file && fs.existsSync(file)) {
    const overlay = await loadImage(fs.readFileSync(file));
    ctx.drawImage(overlay, 0, 0, base.width, base.height);
  }
  return canvas.toBuffer('image/png');
}

/**
 * @param {import('discord.js').BaseInteraction} interaction
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
 * @param {string} discordId
 * @param {number} page
 * @param {number} total
 */
function pageRow(discordId, page, total) {
  const prev = new ButtonBuilder()
    .setCustomId(`inv:${discordId}:${page - 1}`)
    .setLabel('Previous')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page <= 0);
  const next = new ButtonBuilder()
    .setCustomId(`inv:${discordId}:${page + 1}`)
    .setLabel('Next')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page >= total - 1);
  return new ActionRowBuilder().addComponents(prev, next);
}

/**
 * @param {import('discord.js').BaseInteraction} interaction
 * @param {string} discordId
 * @param {number} page
 * @param {boolean} update
 */
async function showPage(interaction, discordId, page, update) {
  if (update) await interaction.deferUpdate();
  else await interaction.deferReply();

  const profile = await loadProfile(discordId);
  const name = await displayName(interaction, discordId, profile?.display_name);
  const title = `${name}'s inventory`;
  if (!profile) {
    const embed = new EmbedBuilder()
      .setColor(GOLD)
      .setTitle(title)
      .setDescription('No site inventory for that account yet.')
      .setURL(`${SITE}/u/?d=${encodeURIComponent(discordId)}`);
    await interaction.editReply({ embeds: [embed], components: [] });
    return;
  }

  const items = loadCatalog()
    .filter((item) => owns(item, profile))
    .sort((a, b) => {
      const slot = SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot);
      if (slot) return slot;
      return a.name.localeCompare(b.name);
    });
  if (!items.length) {
    const embed = new EmbedBuilder().setColor(GOLD).setTitle(title).setDescription('The wardrobe is empty.');
    await interaction.editReply({ embeds: [embed], components: [] });
    return;
  }

  const index = Math.min(Math.max(0, page), items.length - 1);
  const item = items[index];
  const png = await itemPng(item.file);
  const slot = SLOT_LABEL[item.slot] || item.slot;
  const embed = new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(title)
    .setURL(`${SITE}/u/?d=${encodeURIComponent(discordId)}`)
    .setDescription(`**${item.name}**\n${slot} · ${item.rarity}`)
    .setImage('attachment://inv.png')
    .setFooter({ text: `Page ${index + 1} of ${items.length}` });
  await interaction.editReply({
    embeds: [embed],
    components: [pageRow(discordId, index, items.length)],
    files: [new AttachmentBuilder(png, { name: 'inv.png' })],
    attachments: [],
  });
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export function handleInv(interaction) {
  const user = interaction.options.getUser('user') || interaction.user;
  return showPage(interaction, user.id, 0, false);
}

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export function handleInvButton(interaction) {
  const [, discordId, pageRaw] = String(interaction.customId || '').split(':');
  const page = Number(pageRaw);
  if (!/^\d{15,22}$/.test(discordId || '') || !Number.isFinite(page)) {
    return interaction.reply({ content: 'That inventory page is gone.', ephemeral: true });
  }
  return showPage(interaction, discordId, page, true);
}
