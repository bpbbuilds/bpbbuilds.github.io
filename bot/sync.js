/**
 * One-shot reconcile: every profile with a Discord id gets the role that
 * matches profiles.plan. People who are not in the server are skipped.
 */
import { loadEnv, requireBotEnv } from './env.js';
import { listGuildMembers, setBuildNickname, syncPlanRoles } from './roles.js';

const env = loadEnv();
const config = requireBotEnv(env);
const base = String(env.SUPABASE_PROJECT_URL || '').replace(/\/$/, '');
const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!base || !key) {
  console.error('Missing SUPABASE_PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function rest(path) {
  const res = await fetch(`${base}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`${path} failed (${res.status})`);
  return res.json();
}

/** @type {{ id: string, discord_id: string, plan: string }[]} */
const profiles = await rest('profiles?select=id,discord_id,plan&discord_id=not.is.null');
/** @type {{ author_id: string }[]} */
const builds = await rest('builds?select=author_id&author_id=not.is.null');
/** @type {Map<string, number>} */
const buildsByAuthor = new Map();
for (const row of builds) {
  const id = String(row.author_id || '');
  if (!id) continue;
  buildsByAuthor.set(id, (buildsByAuthor.get(id) || 0) + 1);
}
/** @type {Map<string, { plan: string, count: number }>} */
const byDiscord = new Map();
for (const row of profiles) {
  const discordId = String(row.discord_id || '').trim();
  if (!discordId) continue;
  byDiscord.set(discordId, {
    plan: String(row.plan || 'free'),
    count: buildsByAuthor.get(row.id) || 0,
  });
}

let inGuild = 0;
let absent = 0;
let failed = 0;
let nicks = 0;

for (const [discordId, info] of byDiscord) {
  const result = await syncPlanRoles(config, discordId, info.plan, info.count);
  if (result.inGuild === true) inGuild += 1;
  else if (result.inGuild === false) absent += 1;
  else failed += 1;
  if (result.nick === 'set') nicks += 1;
}

const listed = await listGuildMembers(config);
if (!listed.ok) {
  console.error(`Could not list members (${listed.status}). Nickname pass covered site profiles only.`);
} else {
  for (const member of listed.members) {
    if (member?.user?.bot) continue;
    const discordId = String(member.user?.id || '');
    if (byDiscord.has(discordId)) continue;
    const nick = await setBuildNickname(config, member, 0);
    if (nick === 'set') nicks += 1;
    if (nick === 'fail') failed += 1;
  }
}

console.log(
  `Synced ${inGuild} member${inGuild === 1 ? '' : 's'}, ${absent} not in the server, ${nicks} nickname${nicks === 1 ? '' : 's'} set, ${failed} failed (${profiles.length} profiles).`,
);
if (failed) process.exitCode = 1;
