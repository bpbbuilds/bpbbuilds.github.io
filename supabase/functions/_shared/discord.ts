/**
 * Bot REST helpers for Edge Functions. Secrets: DISCORD_BOT_TOKEN,
 * DISCORD_GUILD_ID, DISCORD_ROLE_PREMIUM, DISCORD_ROLE_FOUNDING.
 */

const API = 'https://discord.com/api/v10';

function cfg() {
  return {
    token: Deno.env.get('DISCORD_BOT_TOKEN') || '',
    guildId: Deno.env.get('DISCORD_GUILD_ID') || '',
    premiumRoleId: Deno.env.get('DISCORD_ROLE_PREMIUM') || '',
    foundingRoleId: Deno.env.get('DISCORD_ROLE_FOUNDING') || '',
  };
}

export function discordConfigured() {
  const c = cfg();
  return Boolean(c.token && c.guildId && c.premiumRoleId && c.foundingRoleId);
}

async function discord(path: string, method = 'GET', body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${cfg().token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

/** Drop a previous ` | 🎒 3` (or older ` | 3`) so a chosen name is not stacked. */
export function nicknameBase(text: string, fallback = '') {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  const stripped = cleaned
    .replace(/\s*\|\s*🎒\s*\d+\s*$/u, '')
    .replace(/\s*\|\s*\d+\s*$/u, '')
    .trim();
  return stripped || String(fallback || '').replace(/\s+/g, ' ').trim() || 'user';
}

/** `Name | 🎒 3`, clipped to Discord's 32-character nickname limit. */
export function nicknameFor(discordName: string, count: number) {
  const suffix = ` | 🎒 ${Math.max(0, Number(count) || 0)}`;
  const room = 32 - [...suffix].length;
  const chars = [...String(discordName || 'user').replace(/\s+/g, ' ').trim() || 'user'];
  const cut = chars.length > room
    ? `${chars.slice(0, Math.max(1, room - 1)).join('').trimEnd()}…`
    : chars.join('');
  return `${cut}${suffix}`;
}

/** Mirror plan onto roles and nickname onto `Discord name | 🎒 build count`. */
export async function syncPlanRoles(discordId: string, plan: string, buildCount = 0) {
  const id = String(discordId || '').trim();
  if (!discordConfigured() || !id) return { inGuild: null as boolean | null };
  const { guildId, premiumRoleId, foundingRoleId } = cfg();
  const memberRes = await discord(`/guilds/${guildId}/members/${id}`);
  if (memberRes.status === 404) return { inGuild: false };
  if (!memberRes.ok) {
    console.error('discord member', memberRes.status, (await memberRes.text()).slice(0, 180));
    return { inGuild: null };
  }
  const member = await memberRes.json();
  await setRole(guildId, id, premiumRoleId, plan === 'premium');
  await setRole(guildId, id, foundingRoleId, plan === 'founding');
  const user = member?.user || {};
  const fallback = String(user.global_name || user.username || 'user');
  const nick = nicknameFor(nicknameBase(String(member.nick || ''), fallback), buildCount);
  if (!user.bot && String(member.nick || '') !== nick) {
    const nickRes = await discord(`/guilds/${guildId}/members/${id}`, 'PATCH', { nick });
    if (!nickRes.ok) {
      console.error('discord nick', nickRes.status, (await nickRes.text()).slice(0, 180));
    }
  }
  return { inGuild: true };
}

async function setRole(guildId: string, userId: string, roleId: string, want: boolean) {
  const res = await discord(
    `/guilds/${guildId}/members/${userId}/roles/${roleId}`,
    want ? 'PUT' : 'DELETE',
  );
  if (res.status === 204 || res.status === 404) return;
  console.error('discord role', want ? 'add' : 'remove', res.status, (await res.text()).slice(0, 180));
}
