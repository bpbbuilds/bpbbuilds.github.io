/**
 * Build-post votes. Up and down use the same site score.
 * The arrows are the site vote icons. Discord still draws the button frame.
 * Only a Discord account that has signed in on the site can vote.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VOTE_ICONS = {
  vote_up: path.join(ROOT, 'assets', 'icons', 'history', 'VoteUp.png'),
  vote_down: path.join(ROOT, 'assets', 'icons', 'history', 'VoteDown.png'),
};

/** @type {string} */
let appId = '';
/** @type {{ up: { id: string, name: string } | null, down: { id: string, name: string } | null } | null} */
let voteEmoji = null;

/**
 * @param {{ base: string, key: string }} config
 */
function restHeaders(config) {
  return {
    apikey: config.key,
    Authorization: `Bearer ${config.key}`,
    'Content-Type': 'application/json',
  };
}

/**
 * @param {string} token
 */
async function applicationId(token) {
  if (appId) return appId;
  const res = await discord(token, '/oauth2/applications/@me', 'GET');
  if (!res.ok) return '';
  const row = await res.json();
  appId = String(row?.id || '');
  return appId;
}

/**
 * @param {string} token
 * @param {string} name
 * @param {string} filePath
 * @param {{ id?: string, name?: string }[]} items
 */
async function ensureIcon(token, name, filePath, items) {
  const found = items.find((emoji) => emoji?.name === name && emoji?.id);
  if (found?.id) return { id: String(found.id), name };
  if (!fs.existsSync(filePath)) return null;
  const png = fs.readFileSync(filePath);
  if (png.length > 256 * 1024) return null;
  const id = await applicationId(token);
  if (!id) return null;
  const res = await discord(token, `/applications/${id}/emojis`, 'POST', {
    name,
    image: `data:image/png;base64,${png.toString('base64')}`,
  });
  if (res.status === 429) {
    const retry = await res.json().catch(() => ({}));
    await new Promise((resolve) => setTimeout(resolve, Math.ceil(Number(retry.retry_after || 1) * 1000)));
    const again = await discord(token, `/applications/${id}/emojis`, 'GET');
    const row = again.ok ? await again.json() : {};
    const existing = (row?.items || []).find((emoji) => emoji?.name === name && emoji?.id);
    return existing?.id ? { id: String(existing.id), name } : null;
  }
  if (!res.ok) {
    const detail = await res.text();
    console.error(`Vote icon ${name} failed (${res.status}): ${detail.slice(0, 160)}`);
    return null;
  }
  const row = await res.json();
  return row?.id ? { id: String(row.id), name } : null;
}

/**
 * Site vote arrows, uploaded once to the bot's emoji list.
 * @param {string} token
 */
async function ensureVoteEmoji(token) {
  if (voteEmoji?.up && voteEmoji?.down) return voteEmoji;
  const id = await applicationId(token);
  /** @type {{ id?: string, name?: string }[]} */
  let items = [];
  if (id) {
    const res = await discord(token, `/applications/${id}/emojis`, 'GET');
    const row = res.ok ? await res.json() : {};
    items = Array.isArray(row?.items) ? row.items : [];
  }
  const up = await ensureIcon(token, 'vote_up', VOTE_ICONS.vote_up, items);
  const down = await ensureIcon(token, 'vote_down', VOTE_ICONS.vote_down, items);
  voteEmoji = { up, down };
  return voteEmoji;
}

/**
 * @param {{ id: string, name: string } | null | undefined} emoji
 * @param {string} customId
 * @param {string} fallback
 */
function arrowButton(emoji, customId, fallback) {
  if (emoji?.id) {
    return {
      type: 2,
      style: 2,
      custom_id: customId,
      emoji: { id: emoji.id, name: emoji.name },
    };
  }
  return { type: 2, style: 2, custom_id: customId, label: fallback };
}

/**
 * @param {string} slug
 * @param {number | string | null | undefined} score
 * @param {{ up: { id: string, name: string } | null, down: { id: string, name: string } | null } | null} [emoji]
 */
export function voteComponents(slug, score, emoji = null) {
  const label = String(Number(score) || 0);
  return [{
    type: 1,
    components: [
      arrowButton(emoji?.up, `vote:up:${slug}`, 'Up'),
      { type: 2, style: 2, custom_id: `vote:score:${slug}`, label, disabled: true },
      arrowButton(emoji?.down, `vote:down:${slug}`, 'Down'),
    ],
  }];
}

/**
 * @param {string} token
 * @param {string} slug
 * @param {number | string | null | undefined} score
 */
export async function voteComponentsFor(token, slug, score) {
  const emoji = token ? await ensureVoteEmoji(token) : null;
  return voteComponents(slug, score, emoji);
}

/**
 * @param {object[] | undefined} components
 */
function componentKey(components) {
  const row = Array.isArray(components?.[0]?.components) ? components[0].components : [];
  return row.map((button) => `${button.custom_id}|${button.label || ''}|${button.emoji?.id || ''}|${button.disabled ? 1 : 0}`).join(',');
}

/**
 * @param {string} token
 * @param {string} apiPath
 * @param {string} method
 * @param {object} [body]
 */
async function discord(token, apiPath, method, body) {
  return fetch(`https://discord.com/api/v10${apiPath}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Put the score buttons on forum posts and refresh the number from the site.
 * @param {{ token: string, base: string, key: string }} config
 * @param {Record<string, string>} known
 * @param {Record<string, unknown>[]} builds
 */
export async function applyVoteButtons(config, known, builds) {
  const bySlug = new Map((builds || []).map((build) => [String(build.slug || ''), build]));
  const emoji = await ensureVoteEmoji(config.token);
  let updated = 0;
  for (const [slug, threadId] of Object.entries(known)) {
    if (!threadId || !slug) continue;
    const score = Number(bySlug.get(slug)?.vote_score) || 0;
    const wanted = voteComponents(slug, score, emoji);
    const current = await discord(config.token, `/channels/${threadId}/messages/${threadId}`, 'GET');
    if (!current.ok) continue;
    const message = await current.json();
    if (componentKey(message.components) === componentKey(wanted)) continue;
    const patched = await discord(
      config.token,
      `/channels/${threadId}/messages/${threadId}`,
      'PATCH',
      { components: wanted },
    );
    if (!patched.ok) {
      const detail = await patched.text();
      console.error(`Vote buttons failed for ${slug} (${patched.status}): ${detail.slice(0, 180)}`);
      continue;
    }
    updated += 1;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  if (updated) console.log(`Vote buttons updated on ${updated} post${updated === 1 ? '' : 's'}`);
}

/**
 * @param {{ base: string, key: string }} config
 * @param {string} discordId
 * @returns {Promise<{ voterKey?: string, text?: string }>}
 */
async function voterKeyFor(config, discordId) {
  const headers = restHeaders(config);
  const res = await fetch(
    `${config.base}/rest/v1/profiles?select=id,voter_key&discord_id=eq.${encodeURIComponent(discordId)}`,
    { headers },
  );
  if (!res.ok) return { text: 'Could not check your site account.' };
  const rows = await res.json();
  const profile = Array.isArray(rows) ? rows[0] : null;
  if (!profile?.id) return { text: 'Sign in on the site to vote.' };
  const existing = String(profile.voter_key || '').toLowerCase();
  if (UUID_RE.test(existing)) return { voterKey: existing };
  const voterKey = crypto.randomUUID();
  const patched = await fetch(`${config.base}/rest/v1/profiles?id=eq.${profile.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ voter_key: voterKey, updated_at: new Date().toISOString() }),
  });
  if (!patched.ok) return { text: 'Could not prepare your vote.' };
  return { voterKey };
}

/**
 * @param {{ base: string, key: string }} config
 * @param {string} slug
 * @param {string} voterKey
 * @param {-1 | 0 | 1} vote
 */
async function submitVote(config, slug, voterKey, vote) {
  const res = await fetch(`${config.base}/functions/v1/vote-build`, {
    method: 'POST',
    headers: {
      apikey: config.key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ slug, vote, voter_key: voterKey }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Vote failed for ${slug} (${res.status}): ${String(data?.error || '').slice(0, 160)}`);
    return { text: 'That vote did not save.' };
  }
  const score = Number(data.vote_score) || 0;
  if (vote === 1) return { score, text: `Upvoted. Score is ${score}.` };
  if (vote === -1) return { score, text: `Downvoted. Score is ${score}.` };
  return { score, text: `Vote removed. Score is ${score}.` };
}

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {Record<string, string>} env
 */
export async function handleVoteButton(interaction, env) {
  const match = /^vote:(up|down):(.+)$/.exec(String(interaction.customId || ''));
  if (!match) return;
  const base = String(env.SUPABASE_PROJECT_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!base || !key) {
    await interaction.reply({ content: 'Voting is not available right now.', ephemeral: true });
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  const config = { token: env.DISCORD_BOT_TOKEN, base, key };
  const slug = match[2];
  const direction = match[1] === 'up' ? 1 : -1;
  const who = await voterKeyFor(config, interaction.user.id);
  if (!who.voterKey) {
    await interaction.editReply({ content: who.text || 'Sign in on the site to vote.' });
    return;
  }
  const buildRes = await fetch(
    `${base}/rest/v1/builds?select=id,is_public&slug=eq.${encodeURIComponent(slug)}`,
    { headers: restHeaders(config) },
  );
  const builds = buildRes.ok ? await buildRes.json() : [];
  const build = Array.isArray(builds) ? builds[0] : null;
  if (!build?.id || build.is_public !== true) {
    await interaction.editReply({ content: 'That build is not open for votes.' });
    return;
  }
  const mineRes = await fetch(
    `${base}/rest/v1/build_votes?select=vote&build_id=eq.${build.id}&voter_key=eq.${who.voterKey}`,
    { headers: restHeaders(config) },
  );
  const mineRows = mineRes.ok ? await mineRes.json() : [];
  const current = Number(mineRows?.[0]?.vote);
  const next = current === direction ? 0 : direction;
  const saved = await submitVote(config, slug, who.voterKey, /** @type {-1 | 0 | 1} */ (next));
  if (saved.score === undefined) {
    await interaction.editReply({ content: saved.text });
    return;
  }
  const messageId = interaction.message?.id;
  const channelId = interaction.channelId;
  if (messageId && channelId) {
    const patched = await discord(
      config.token,
      `/channels/${channelId}/messages/${messageId}`,
      'PATCH',
      { components: await voteComponentsFor(config.token, slug, saved.score) },
    );
    if (!patched.ok) {
      const detail = await patched.text();
      console.error(`Vote score button failed for ${slug} (${patched.status}): ${detail.slice(0, 180)}`);
    }
  }
  await interaction.editReply({ content: saved.text });
}
