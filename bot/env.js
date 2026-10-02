import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** @returns {Record<string, string>} */
export function loadEnv() {
  const text = fs.readFileSync(path.join(root, '.env'), 'utf8');
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter((line) => line && !line.trim().startsWith('#') && line.includes('='))
      .map((line) => {
        const i = line.indexOf('=');
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
      }),
  );
}

/**
 * @param {Record<string, string>} env
 */
export function requireBotEnv(env) {
  const keys = [
    'DISCORD_BOT_TOKEN',
    'DISCORD_GUILD_ID',
    'DISCORD_ROLE_PREMIUM',
    'DISCORD_ROLE_FOUNDING',
  ];
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Missing ${missing.join(', ')} in .env`);
  }
  return {
    token: env.DISCORD_BOT_TOKEN,
    guildId: env.DISCORD_GUILD_ID,
    premiumRoleId: env.DISCORD_ROLE_PREMIUM,
    foundingRoleId: env.DISCORD_ROLE_FOUNDING,
  };
}
