/**
 * Register guild slash commands. Add a command in bot/command-list.js, then
 * run `npm run bot:commands`. The bot process has to be online to answer them.
 */
import { loadEnv, requireBotEnv } from './env.js';
import { commands } from './command-list.js';

const env = loadEnv();
const { token, guildId } = requireBotEnv(env);

const me = await fetch('https://discord.com/api/v10/oauth2/applications/@me', {
  headers: { Authorization: `Bot ${token}` },
});
if (!me.ok) {
  console.error(`Could not read the Discord application (${me.status})`);
  process.exit(1);
}
const app = await me.json();
const res = await fetch(
  `https://discord.com/api/v10/applications/${app.id}/guilds/${guildId}/commands`,
  {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  },
);
if (!res.ok) {
  console.error(`Command register failed (${res.status})`);
  process.exit(1);
}
const registered = await res.json();
console.log(`Registered ${registered.length} slash command${registered.length === 1 ? '' : 's'}.`);
