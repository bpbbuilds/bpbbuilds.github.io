/**
 * /blob picture, then the member’s name and how many builds they have uploaded.
 */
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { loadEnv } from '../env.js';
import { equippedBlobPng } from './blob.js';

const SITE = 'https://bpbbuilds.com';
const GOLD = 0xeac914;

export const profileCommand = {
  name: 'profile',
  description: 'Show a member’s blob, name, and uploaded builds.',
  options: [
    {
      name: 'user',
      description: 'Whose profile to show. Defaults to you.',
      type: 6,
      required: false,
    },
  ],
};

/**
 * @param {string} discordId
 * @returns {Promise<{ display_name?: string, equipped_avatar?: unknown, id?: string } | null>}
 */
async function loadProfile(discordId) {
  const env = loadEnv();
  const base = String(env.SUPABASE_PROJECT_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!base || !key) return null;
  const url = `${base}/rest/v1/profiles?select=id,display_name,equipped_avatar&discord_id=eq.${encodeURIComponent(discordId)}`;
  const res = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

/**
 * Every build that profile has saved. Same count as the nickname.
 * @param {string} authorId
 */
async function uploadedBuilds(authorId) {
  const env = loadEnv();
  const base = String(env.SUPABASE_PROJECT_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!base || !key || !authorId) return 0;
  const res = await fetch(
    `${base}/rest/v1/builds?select=id&author_id=eq.${encodeURIComponent(authorId)}`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'count=exact',
        Range: '0-0',
      },
    },
  );
  const total = Number((res.headers.get('content-range') || '').split('/')[1]);
  return Number.isFinite(total) ? total : 0;
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
export async function handleProfile(interaction) {
  const user = interaction.options.getUser('user') || interaction.user;
  await interaction.deferReply();
  const profile = await loadProfile(user.id);
  const name = await displayName(interaction, user.id, profile?.display_name);
  const count = await uploadedBuilds(String(profile?.id || ''));
  const png = await equippedBlobPng(profile?.equipped_avatar);
  const profileUrl = `${SITE}/u/?d=${encodeURIComponent(user.id)}`;
  const label = count === 1 ? '1 uploaded build' : `${count} uploaded builds`;
  await interaction.editReply({
    embeds: [
      new EmbedBuilder().setColor(GOLD).setURL(profileUrl).setImage('attachment://blob.png'),
      new EmbedBuilder().setColor(GOLD).setTitle(name).setURL(profileUrl).setDescription(label),
    ],
    files: [new AttachmentBuilder(png, { name: 'blob.png' })],
  });
}
