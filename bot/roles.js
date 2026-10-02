/**
 * Discord REST role mirror. Site plan is the source of truth.
 * premium → Premium role, founding → Founding role, free → neither.
 */

const API = 'https://discord.com/api/v10';

/**
 * @param {string} token
 * @param {string} path
 * @param {string} [method]
 */
async function discord(token, path, method = 'GET', body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

/** Discord display name, then username. */
export function discordName(user) {
  const name = String(user?.global_name || user?.username || 'user')
    .replace(/\s+/g, ' ')
    .trim();
  return name || 'user';
}

/** Drop a previous ` | 🎒 3` (or older ` | 3`) so a chosen name is not stacked. */
export function nicknameBase(text, fallback = '') {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  const stripped = cleaned
    .replace(/\s*\|\s*🎒\s*\d+\s*$/u, '')
    .replace(/\s*\|\s*\d+\s*$/u, '')
    .trim();
  return stripped || String(fallback || '').replace(/\s+/g, ' ').trim() || 'user';
}

/** `Name | 🎒 3`, clipped to Discord's 32-character nickname limit. */
export function nicknameFor(discordNameText, count) {
  const suffix = ` | 🎒 ${Math.max(0, Number(count) || 0)}`;
  const room = 32 - [...suffix].length;
  const chars = [...String(discordNameText || 'user')];
  const cut = chars.length > room ? `${chars.slice(0, Math.max(1, room - 1)).join('').trimEnd()}…` : chars.join('');
  return `${cut}${suffix}`;
}

/**
 * @param {{ token: string, guildId: string, premiumRoleId: string, foundingRoleId: string }} config
 * @param {string} discordId
 * @returns {Promise<'in' | 'out' | 'error'>}
 */
export async function guildMembership(config, discordId) {
  const res = await discord(
    config.token,
    `/guilds/${config.guildId}/members/${discordId}`,
  );
  if (res.status === 404) return 'out';
  if (res.ok) return 'in';
  const detail = await res.text();
  console.error(`Discord member lookup ${res.status}: ${detail.slice(0, 180)}`);
  return 'error';
}

/**
 * @param {{ token: string, guildId: string }} config
 * @param {string} discordId
 * @param {string} roleId
 * @param {boolean} want
 */
async function setRole(config, discordId, roleId, want) {
  const res = await discord(
    config.token,
    `/guilds/${config.guildId}/members/${discordId}/roles/${roleId}`,
    want ? 'PUT' : 'DELETE',
  );
  if (res.status === 204 || res.status === 404) return true;
  const detail = await res.text();
  console.error(`Discord role ${want ? 'add' : 'remove'} ${res.status}: ${detail.slice(0, 180)}`);
  return false;
}

/**
 * @param {{ token: string, guildId: string, premiumRoleId: string, foundingRoleId: string }} config
 * @param {string} discordId
 * @param {string} plan
 */
export async function syncPlanRoles(config, discordId, plan, buildCount = 0) {
  const res = await discord(
    config.token,
    `/guilds/${config.guildId}/members/${discordId}`,
  );
  if (res.status === 404) return { inGuild: false };
  if (!res.ok) {
    const detail = await res.text();
    console.error(`Discord member lookup ${res.status}: ${detail.slice(0, 180)}`);
    return { inGuild: null };
  }
  const member = await res.json();
  const premiumOk = await setRole(config, discordId, config.premiumRoleId, plan === 'premium');
  const foundingOk = await setRole(config, discordId, config.foundingRoleId, plan === 'founding');
  const nick = await setBuildNickname(config, member, buildCount);
  return { inGuild: true, roles: premiumOk && foundingOk, nick };
}

/**
 * @param {{ token: string, guildId: string }} config
 * @param {{ nick?: string | null, user?: { id?: string, bot?: boolean, global_name?: string, username?: string } }} member
 * @param {number} buildCount
 */
export async function setBuildNickname(config, member, buildCount) {
  if (member?.user?.bot || !member?.user?.id) return 'skip';
  const nick = nicknameFor(nicknameBase(member.nick, discordName(member.user)), buildCount);
  if ((member.nick || '') === nick) return 'same';
  const res = await discord(
    config.token,
    `/guilds/${config.guildId}/members/${member.user.id}`,
    'PATCH',
    { nick },
  );
  if (res.ok) return 'set';
  const detail = await res.text();
  console.error(`Nickname ${res.status}: ${detail.slice(0, 180)}`);
  return 'fail';
}

/** @param {{ token: string, guildId: string }} config */
export async function listGuildMembers(config) {
  /** @type {object[]} */
  const members = [];
  let after = '0';
  for (;;) {
    const res = await discord(
      config.token,
      `/guilds/${config.guildId}/members?limit=1000&after=${after}`,
    );
    if (!res.ok) {
      const detail = await res.text();
      return { ok: false, status: res.status, detail: detail.slice(0, 180), members };
    }
    const batch = await res.json();
    members.push(...batch);
    if (!Array.isArray(batch) || batch.length < 1000) break;
    after = batch[batch.length - 1]?.user?.id || after;
  }
  return { ok: true, members };
}
