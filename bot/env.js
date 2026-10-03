import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** @returns {Record<string, string | undefined>} */
export function loadEnv() {
  // Northflank injects runtime configuration through process.env. Keep the
  // local .env fallback for development, but never let that file override an
  // explicitly supplied runtime variable.
  const env = { ...process.env };
  let text = '';
  try {
    text = fs.readFileSync(path.join(root, '.env'), 'utf8');
  } catch {
    /* Production deployments do not need a local .env file. */
  }
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i).trim();
    if (!key || Object.prototype.hasOwnProperty.call(env, key)) continue;
    env[key] = line.slice(i + 1).trim();
  }
  return env;
}

/**
 * @param {Record<string, string | undefined>} env
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
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }
  return {
    token: env.DISCORD_BOT_TOKEN,
    guildId: env.DISCORD_GUILD_ID,
    premiumRoleId: env.DISCORD_ROLE_PREMIUM,
    foundingRoleId: env.DISCORD_ROLE_FOUNDING,
  };
}

/**
 * The persistent watcher needs the Supabase service role to run its channel,
 * stats, and build-announcement loops. Fail before connecting to Discord when
 * those runtime secrets are absent instead of starting a partially-working
 * worker.
 *
 * @param {Record<string, string | undefined>} env
 */
export function requireWatcherEnv(env) {
  const keys = ['SUPABASE_PROJECT_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }
}
