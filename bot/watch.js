/**
 * Keeps nicknames as the name someone sets, plus ` | 🎒 uploaded builds`.
 * Posts public website builds into the builds forum.
 * When someone joins or changes their nickname, the build count is put back on.
 */
import http from 'node:http';
import { Client, GatewayIntentBits } from 'discord.js';
import { startBuildAnnounce } from './announce.js';
import { loadEnv, requireBotEnv, requireWatcherEnv } from './env.js';
import { nicknameFor, nicknameBase, discordName } from './roles.js';
import { isWelcomeMessage, syncWelcome } from './welcome.js';
import { isRulesMessage, rulesChannelId, syncRules } from './rules.js';
import { syncNews } from './news.js';
import { syncPremium } from './premium.js';
import { syncMarket } from './market.js';
import { syncQuest } from './quest.js';
import { syncCosmeticDrops } from './cosmetic-drops.js';
import { syncCommunity } from './community.js';
import { syncEvents } from './events-feed.js';
import { syncPastEvents } from './past-events.js';
import { syncOnboarding } from './onboarding.js';
import { syncStats } from './stats.js';
import { syncLayout } from './layout.js';
import { handleCommand, handleInvButton } from './commands/index.js';
import { handleVoteButton } from './announce-votes.js';

const env = loadEnv();
const config = requireBotEnv(env);
requireWatcherEnv(env);
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

const healthPort = Number(env.BOT_HEALTH_PORT || 0);
if (env.BOT_HEALTH_PORT && (!Number.isInteger(healthPort) || healthPort < 1 || healthPort > 65535)) {
  throw new Error('BOT_HEALTH_PORT must be an integer between 1 and 65535');
}

/** @type {import('node:http').Server | null} */
let healthServer = null;
if (healthPort) {
  healthServer = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' });
      res.end();
      return;
    }
    if (req.url !== '/healthz') {
      res.writeHead(404);
      res.end();
      return;
    }
    const ready = client.isReady();
    const body = JSON.stringify({ status: ready ? 'ready' : 'starting' });
    res.writeHead(ready ? 200 : 503, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(body),
    });
    if (req.method === 'HEAD') res.end();
    else res.end(body);
  });
  healthServer.on('error', (err) => {
    console.error(`Health server failed: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  });
  healthServer.listen(healthPort, '0.0.0.0', () => {
    console.log(`Health endpoint listening on /healthz (port ${healthPort})`);
  });
}

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; closing Discord Gateway`);
  const forceExit = setTimeout(() => process.exit(0), 5000);
  forceExit.unref();
  if (healthServer?.listening) {
    await new Promise((resolve) => healthServer.close(resolve));
  }
  await client.destroy();
  clearTimeout(forceExit);
  process.exit(0);
}

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    shutdown(signal).catch((err) => {
      console.error(`Shutdown failed: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    });
  });
}

client.on('error', (err) => console.error(`Discord client error: ${err instanceof Error ? err.message : err}`));
client.on('shardError', (err, shardId) => {
  console.error(`Discord shard ${shardId} error: ${err instanceof Error ? err.message : err}`);
});
client.on('shardDisconnect', (_event, shardId) => {
  console.warn(`Discord shard ${shardId} disconnected; discord.js will reconnect`);
});
client.on('shardReconnecting', (shardId) => {
  console.log(`Discord shard ${shardId} reconnecting`);
});
client.on('shardReady', (shardId) => {
  console.log(`Discord shard ${shardId} ready`);
});
client.on('invalidated', () => {
  console.error('Discord session invalidated; restarting the worker');
  shutdown('DISCORD_INVALIDATED').catch((err) => {
    console.error(`Invalidated-session shutdown failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  });
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
      : interaction.isButton() && interaction.customId.startsWith('vote:')
        ? handleVoteButton(interaction, env)
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
  console.log(`Discord Gateway ready as ${client.user?.tag}`);
  console.log(`Watching nicknames as ${client.user?.tag}`);
  if (honeypotId) console.log('Honeypot channel is armed');
  if (welcomeId) console.log('Welcome channel is read-only');
  syncNews(env)
    .then(() => syncRules(env))
    .then(() => syncPremium(env))
    .then(() => syncMarket(env))
    .then(() => syncQuest(env))
    .then(() => syncCosmeticDrops(env))
    .then(() => syncCommunity(env))
    .then(() => syncStats(env))
    .then(() => syncEvents(env))
    .then(() => syncPastEvents(env))
    .then(() => syncWelcome(env))
    .then(() => syncOnboarding(env))
    .then(() => syncLayout(env))
    .catch((err) => console.error(err instanceof Error ? err.message : err));
  startBuildAnnounce(env);
});

await client.login(config.token);
