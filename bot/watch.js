/**
 * Keeps nicknames as the name someone sets, plus ` | 🎒 uploaded builds`.
 * Posts public website builds into the builds forum.
 * When someone joins or changes their nickname, the build count is put back on.
 */
import { Client, GatewayIntentBits } from 'discord.js';
import { startBuildAnnounce } from './announce.js';
import { loadEnv, requireBotEnv } from './env.js';
import { nicknameFor, nicknameBase, discordName } from './roles.js';
import { isWelcomeMessage, syncWelcome } from './welcome.js';
import { isRulesMessage, rulesChannelId, syncRules } from './rules.js';
import { syncNews } from './news.js';
import { syncPremium } from './premium.js';
import { syncMarket } from './market.js';
import { syncStats } from './stats.js';
import { syncLayout } from './layout.js';
import { handleCommand, handleInvButton } from './commands/index.js';

const env = loadEnv();
const config = requireBotEnv(env);
const base = String(env.SUPABASE_PROJECT_URL || '').replace(/\/$/, '');
const key = env.SUPABASE_SERVICE_ROLE_KEY || '';

const honeypotId = env.DISCORD_HONEYPOT_CHANNEL_ID || '';
const honeypotMessageId = env.DISCORD_HONEYPOT_MESSAGE_ID || '';
const welcomeId = env.DISCORD_WELCOME_CHANNEL_ID || '1554348212423368835';
const welcomeMessageId = env.DISCORD_WELCOME_MESSAGE_ID || '1555306729808597093';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

async function buildCount(discordId) {
  if (!base || !key) return 0;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const profileRes = await fetch(
    `${base}/rest/v1/profiles?select=id&discord_id=eq.${encodeURIComponent(discordId)}`,
    { headers },
  );
  if (!profileRes.ok) return 0;
  const profiles = await profileRes.json();
  const id = profiles?.[0]?.id;
  if (!id) return 0;
  const countRes = await fetch(
    `${base}/rest/v1/builds?select=id&author_id=eq.${id}`,
    { headers: { ...headers, Prefer: 'count=exact', Range: '0-0' } },
  );
  const range = countRes.headers.get('content-range') || '';
  const total = Number(range.split('/')[1]);
  return Number.isFinite(total) ? total : 0;
}

async function enforce(member) {
  if (!member || member.user?.bot) return;
  if (member.guild.id !== config.guildId) return;
  if (member.id === member.guild.ownerId) return;
  const count = await buildCount(member.id);
  const nick = nicknameFor(nicknameBase(member.nickname, discordName(member.user)), count);
  if ((member.nickname || '') === nick) return;
  try {
    await member.setNickname(nick);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
  }
}

async function bumpHoneypotCount(channel) {
  if (!honeypotMessageId) return;
  const warning = await channel.messages.fetch(honeypotMessageId).catch(() => null);
  const embed = warning?.embeds?.[0];
  if (!warning || !embed) return;
  const current = Number(embed.fields?.[0]?.value);
  const next = (Number.isFinite(current) ? current : 0) + 1;
  await warning.edit({
    embeds: [{
      title: embed.title || 'DO NOT SEND MESSAGES IN THIS CHANNEL',
      description: embed.description || 'This channel is used to catch spam bots. Any messages sent here will result in a ban.',
      color: embed.color ?? 16098816,
      fields: [{ name: '🍯 Bans', value: String(next), inline: true }],
    }],
  });
}

async function onHoneypot(message) {
  if (!honeypotId || message.channelId !== honeypotId) return;
  if (!message.guild || !message.author || message.author.bot || message.system) return;
  if (message.author.id === message.guild.ownerId) return;
  const perms = message.member?.permissions;
  if (perms?.has('Administrator') || perms?.has('BanMembers')) return;
  await message.guild.members.ban(message.author.id, {
    deleteMessageSeconds: 60 * 60 * 24 * 7,
    reason: 'Sent a message in the honeypot channel',
  });
  console.log(`Banned ${message.author.tag} for posting in the honeypot`);
  await bumpHoneypotCount(message.channel);
}

async function onWelcome(message) {
  if (!welcomeId || message.channelId !== welcomeId) return;
  if (message.author?.id === client.user?.id) return;
  if (message.id === welcomeMessageId || isWelcomeMessage(message.id)) return;
  await message.delete().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
  });
}

async function onRules(message) {
  const rulesId = rulesChannelId();
  if (!rulesId || message.channelId !== rulesId) return;
  if (message.author?.id === client.user?.id) return;
  if (isRulesMessage(message.id)) return;
  await message.delete().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
  });
}

client.on('interactionCreate', (interaction) => {
  const run = interaction.isChatInputCommand()
    ? handleCommand(interaction)
    : interaction.isButton() && interaction.customId.startsWith('inv:')
      ? handleInvButton(interaction)
      : null;
  if (!run) return;
  Promise.resolve(run).catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    const payload = { content: 'That command failed.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  });
});

client.on('messageCreate', (message) => {
  onHoneypot(message).catch((err) => console.error(err instanceof Error ? err.message : err));
  onWelcome(message).catch((err) => console.error(err instanceof Error ? err.message : err));
  onRules(message).catch((err) => console.error(err instanceof Error ? err.message : err));
});

client.on('guildMemberAdd', (member) => {
  enforce(member).catch((err) => console.error(err));
});

client.on('guildMemberUpdate', (_old, member) => {
  enforce(member).catch((err) => console.error(err));
});

client.once('clientReady', () => {
  console.log(`Watching nicknames as ${client.user?.tag}`);
  if (honeypotId) console.log('Honeypot channel is armed');
  if (welcomeId) console.log('Welcome channel is read-only');
  syncNews(env)
    .then(() => syncRules(env))
    .then(() => syncPremium(env))
    .then(() => syncMarket(env))
    .then(() => syncStats(env))
    .then(() => syncWelcome(env))
    .then(() => syncLayout(env))
    .catch((err) => console.error(err instanceof Error ? err.message : err));
  startBuildAnnounce(env);
});

await client.login(config.token);
