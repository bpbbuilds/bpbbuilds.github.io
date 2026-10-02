/**
 * Logs in, confirms the community server, and checks the bot can assign
 * Premium and Founding. Exits when the check finishes.
 */
import { Client, GatewayIntentBits } from 'discord.js';
import { loadEnv, requireBotEnv } from './env.js';

const config = requireBotEnv(loadEnv());
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
  try {
    const guild = await client.guilds.fetch(config.guildId);
    const roles = await guild.roles.fetch();
    const me = await guild.members.fetchMe();
    const botTop = me.roles.highest.position;

    console.log(`Logged in as ${client.user?.tag} in ${guild.name}`);
    for (const [label, id] of [
      ['Premium', config.premiumRoleId],
      ['Founding', config.foundingRoleId],
    ]) {
      const role = roles.get(id);
      if (!role) {
        console.log(`${label}: missing`);
        continue;
      }
      const canAssign = role.position < botTop;
      console.log(
        `${label}: ${role.name}, bot can assign: ${canAssign ? 'yes' : 'no'}`,
      );
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

await client.login(config.token);
