/**
 * Restart-safe Discord channel reconciliation.
 *
 * State files are a useful fast path, but they are not the source of truth:
 * they can be missing after a deploy, stale after a restore, or unavailable
 * when a persistent volume was not mounted. Before creating a resource, find
 * the existing channel/category by its exact type and name.
 */

const API = 'https://discord.com/api/v10';

/** @param {string} value */
function snowflakeOrder(value) {
  const text = String(value || '');
  return text.length ? text : '0';
}

/**
 * @param {string} token
 * @param {string} apiPath
 * @param {string} method
 * @param {object | undefined} body
 * @param {typeof fetch} fetchImpl
 */
async function request(token, apiPath, method, body, fetchImpl) {
  return fetchImpl(`${API}${apiPath}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * @param {Response} response
 * @returns {Promise<any>}
 */
async function json(response) {
  return response.json().catch(() => null);
}

/**
 * Reuse or create one managed guild channel.
 *
 * The list request intentionally fails closed. If Discord cannot tell us what
 * already exists, creating another channel would be the least safe choice.
 * Existing resources are never deleted by this helper.
 *
 * @param {{
 *   token: string,
 *   guildId: string,
 *   existingId?: string,
 *   type: number,
 *   name: string,
 *   body?: Record<string, unknown>,
 *   label?: string,
 *   fetchImpl?: typeof fetch,
 * }} options
 * @returns {Promise<string>}
 */
export async function ensureGuildChannel(options) {
  const {
    token,
    guildId,
    existingId = '',
    type,
    name,
    body = {},
    label = 'Discord channel',
    fetchImpl = globalThis.fetch,
  } = options;
  if (!token || !guildId || !name || !fetchImpl) return '';

  if (existingId) {
    const current = await request(token, `/channels/${encodeURIComponent(existingId)}`, 'GET', undefined, fetchImpl);
    if (current.ok) {
      const row = await json(current);
      if (
        String(row?.guild_id || guildId) === String(guildId)
        && Number(row?.type) === Number(type)
        && String(row?.name || '') === String(name)
      ) {
        const patched = await request(
          token,
          `/channels/${encodeURIComponent(existingId)}`,
          'PATCH',
          { name, ...body },
          fetchImpl,
        );
        if (!patched.ok) {
          console.error(`${label} update failed (${patched.status}); reusing existing channel`);
        }
        return String(existingId);
      }
    }
  }

  const listed = await request(token, `/guilds/${encodeURIComponent(guildId)}/channels`, 'GET', undefined, fetchImpl);
  if (!listed.ok) {
    const detail = await listed.text().catch(() => '');
    console.error(`${label} lookup failed (${listed.status}): ${detail.slice(0, 180)}`);
    return '';
  }
  const channels = await json(listed);
  const matches = (Array.isArray(channels) ? channels : [])
    .filter((row) => Number(row?.type) === Number(type) && String(row?.name || '') === String(name))
    .sort((a, b) => snowflakeOrder(a.id).localeCompare(snowflakeOrder(b.id)));
  const found = matches[0];
  if (found?.id) {
    const id = String(found.id);
    const patched = await request(token, `/channels/${encodeURIComponent(id)}`, 'PATCH', { name, ...body }, fetchImpl);
    if (!patched.ok) {
      console.error(`${label} update failed (${patched.status}); reusing matching channel`);
    }
    return id;
  }

  const created = await request(
    token,
    `/guilds/${encodeURIComponent(guildId)}/channels`,
    'POST',
    { ...body, name, type },
    fetchImpl,
  );
  if (!created.ok) {
    const detail = await created.text().catch(() => '');
    console.error(`${label} creation failed (${created.status}): ${detail.slice(0, 180)}`);
    return '';
  }
  const row = await json(created);
  return String(row?.id || '');
}
