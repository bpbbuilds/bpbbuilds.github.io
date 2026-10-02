/**
 * Create / view / catalog links inside the forum post embed.
 */
import { buildThumbPng, hostBoardImage } from './board-thumb.js';
const API = 'https://discord.com/api/v10';

/**
 * @param {string} token
 * @param {string} apiPath
 * @param {string} [method]
 * @param {object} [body]
 */
async function discord(token, apiPath, method = 'GET', body) {
  /** @type {Record<string, string>} */
  const headers = { Authorization: `Bot ${token}` };
  if (body) headers['Content-Type'] = 'application/json';
  return fetch(`${API}${apiPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * @param {{ site: string }} config
 * @param {string} slug
 */
function buildUrl(config, slug) {
  return `${config.site}/builds/view/?slug=${encodeURIComponent(slug)}`;
}

/**
 * @param {{ site: string }} config
 * @param {string} slug
 */
function linkLines(config, slug) {
  return [
    `[If you want to create your own build](${config.site}/create/)`,
    `[View this build](${buildUrl(config, slug)})`,
    `[View other builds](${config.site}/builds/)`,
  ].join('\n');
}

/**
 * @param {{ site: string }} config
 * @param {string} slug
 * @param {string} blurb
 */
export function embedDescription(config, slug, blurb) {
  const links = linkLines(config, slug);
  const text = String(blurb || '').trim();
  return text ? `${text}\n\n${links}` : links;
}

/**
 * @param {string} text
 */
function clip(text) {
  const chars = [...String(text || '')];
  if (chars.length <= 500) return chars.join('');
  return `${chars.slice(0, 499).join('').trimEnd()}…`;
}

/**
 * Move the create / view / other-builds links into the starter embed
 * and remove the old follow-up message.
 * @param {{ token: string, site: string }} config
 * @param {Record<string, string>} known
 * @param {Set<string>} linked
 * @param {Record<string, unknown>[]} builds
 * @param {() => void} persist
 */
export async function foldLinksIntoPosts(config, known, linked, builds, persist) {
  if (!linked.size) return;
  const bySlug = new Map(builds.map((build) => [String(build.slug || ''), build]));
  let folded = 0;
  for (const [slug, threadId] of Object.entries(known)) {
    if (!threadId || !linked.has(threadId)) continue;
    const current = await discord(config.token, `/channels/${threadId}/messages/${threadId}`);
    if (!current.ok) continue;
    const message = await current.json();
    const embed = message.embeds?.[0];
    if (!embed) continue;
    const blurb = clip(String(bySlug.get(slug)?.blurb || '').replace(/\s+/g, ' ').trim());
    const description = embedDescription(config, slug, blurb);
    const next = {
      title: embed.title,
      ...(embed.url ? { url: embed.url } : {}),
      ...(embed.color ? { color: embed.color } : {}),
      description,
      ...(embed.author?.name
        ? {
          author: {
            name: embed.author.name,
            ...(embed.author.icon_url ? { icon_url: embed.author.icon_url } : {}),
            ...(embed.author.url ? { url: embed.author.url } : {}),
          },
        }
        : {}),
      ...(embed.fields?.length
        ? { fields: embed.fields.map((field) => ({ name: field.name, value: field.value, inline: Boolean(field.inline) })) }
        : {}),
      ...(embed.image?.url ? { image: { url: embed.image.url } } : {}),
      ...(embed.thumbnail?.url ? { thumbnail: { url: embed.thumbnail.url } } : {}),
      ...(embed.footer?.text ? { footer: { text: embed.footer.text } } : {}),
    };
    const patched = await discord(
      config.token,
      `/channels/${threadId}/messages/${threadId}`,
      'PATCH',
      { embeds: [next] },
    );
    if (!patched.ok) {
      const detail = await patched.text();
      console.error(`Build links failed for ${slug} (${patched.status}): ${detail.slice(0, 180)}`);
      continue;
    }
    const listed = await discord(config.token, `/channels/${threadId}/messages?limit=10`);
    const messages = listed.ok ? await listed.json() : [];
    let removed = true;
    for (const row of Array.isArray(messages) ? messages : []) {
      if (row.id === threadId) continue;
      if (!String(row.content || '').includes('/create/')) continue;
      const deleted = await discord(config.token, `/channels/${threadId}/messages/${row.id}`, 'DELETE');
      if (!deleted.ok && deleted.status !== 404) removed = false;
    }
    if (!removed) continue;
    linked.delete(threadId);
    persist();
    folded += 1;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  if (folded) console.log(`Build links moved into ${folded} post${folded === 1 ? '' : 's'}`);
}

/**
 * Put the build picture in the embed and drop the loose file above it.
 * @param {{ token: string }} config
 * @param {Record<string, string>} known
 * @param {Set<string>} done
 * @param {Record<string, unknown>[]} builds
 */
export async function showBuildInEmbeds(config, known, done, builds) {
  const bySlug = new Map((builds || []).map((build) => [String(build.slug || ''), build]));
  let shown = 0;
  for (const [slug, threadId] of Object.entries(known)) {
    if (!threadId || done.has(slug)) continue;
    const current = await discord(config.token, `/channels/${threadId}/messages/${threadId}`);
    if (!current.ok) continue;
    const message = await current.json();
    const embed = message.embeds?.[0];
    if (!embed) continue;
    const imageUrlNow = String(embed.image?.url || '');
    const loose = (message.attachments || []).some((item) => item.filename === 'build.png');
    const hosted = imageUrlNow.includes('/discord-builds/');
    const stamped = imageUrlNow.includes('v=face');
    if (hosted && !loose && !stamped) {
      done.add(slug);
      continue;
    }
    const build = bySlug.get(slug);
    const png = build ? await buildThumbPng(config, build) : null;
    const imageUrl = png ? await hostBoardImage(config, slug, png) : '';
    if (!imageUrl) continue;
    const patched = await discord(
      config.token,
      `/channels/${threadId}/messages/${threadId}`,
      'PATCH',
      {
        embeds: [{
          title: embed.title,
          ...(embed.url ? { url: embed.url } : {}),
          ...(embed.color ? { color: embed.color } : {}),
          ...(embed.description ? { description: embed.description } : {}),
          ...(embed.author?.name
            ? {
              author: {
                name: embed.author.name,
                ...(embed.author.icon_url ? { icon_url: embed.author.icon_url } : {}),
                ...(embed.author.url ? { url: embed.author.url } : {}),
              },
            }
            : {}),
          ...(embed.fields?.length
            ? { fields: embed.fields.map((field) => ({ name: field.name, value: field.value, inline: Boolean(field.inline) })) }
            : {}),
          image: { url: imageUrl },
          ...(embed.thumbnail?.url ? { thumbnail: { url: embed.thumbnail.url } } : {}),
          ...(embed.footer?.text ? { footer: { text: embed.footer.text } } : {}),
        }],
        attachments: [],
      },
    );
    if (!patched.ok) {
      const detail = await patched.text();
      console.error(`Build embed image failed for ${slug} (${patched.status}): ${detail.slice(0, 180)}`);
      continue;
    }
    done.add(slug);
    shown += 1;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  if (shown) console.log(`Build image added inside ${shown} embed${shown === 1 ? '' : 's'}`);
}
