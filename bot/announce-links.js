/**
 * Create / view / catalog links inside the forum post embed.
 */
import { youtubeId } from '../js/shared/youtube.js';
import { buildThumbPng, hostBoardImage } from './board-thumb.js';
import { withItemEmoji } from './announce-mentions.js';
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

const FACT_NAMES = new Set(['Class', 'Tag', 'Rank', 'OP']);

/**
 * @param {string} name
 */
function creatorLabel(name) {
  const clean = String(name || 'this creator').replace(/[\[\]()]/g, '').replace(/\s+/g, ' ').trim() || 'this creator';
  const chars = [...`More from ${clean}`];
  return chars.length <= 80 ? chars.join('') : `${chars.slice(0, 79).join('').trimEnd()}…`;
}

/**
 * @param {{ site: string }} config
 * @param {Record<string, unknown>} build
 */
export function linkFields(config, build) {
  const slug = String(build?.slug || '');
  const profile = build?.profiles && typeof build.profiles === 'object' ? build.profiles : {};
  const name = String(profile.display_name || build?.author_name || '').trim();
  const discordId = String(profile.discord_id || '').trim();
  const site = String(config.site || '').replace(/\/$/, '');
  /** @type {{ name: string, value: string, inline: boolean }[]} */
  const videoId = youtubeId(build?.youtube_url);
  const fields = [
    { name: '\u200b', value: `[Create your own](${site}/create/)`, inline: true },
    { name: '\u200b', value: `[View](${buildUrl(config, slug)})`, inline: true },
    ...(videoId ? [{ name: '\u200b', value: `[Watch](https://www.youtube.com/watch?v=${videoId})`, inline: true }] : []),
    { name: '\u200b', value: `[More builds](${site}/builds/)`, inline: true },
  ];
  if (discordId) {
    fields.push({
      name: '\u200b',
      value: `[${creatorLabel(name)}](${site}/u/?d=${encodeURIComponent(discordId)})`,
      inline: true,
    });
  }
  return fields;
}

/**
 * Fact columns, then a fresh row of link columns.
 * @param {{ site: string }} config
 * @param {Record<string, unknown>} build
 * @param {{ name: string, value: string, inline?: boolean }[]} fields
 */
export function fieldsWithLinks(config, build, fields) {
  const facts = (fields || [])
    .filter((field) => FACT_NAMES.has(field.name))
    .map((field) => ({ name: field.name, value: field.value, inline: true }));
  const pad = (3 - (facts.length % 3)) % 3;
  const blanks = Array.from({ length: pad }, () => ({ name: '\u200b', value: '\u200b', inline: true }));
  return [...facts, ...blanks, ...linkFields(config, build)];
}

/**
 * @param {string} description
 */
function blurbOnly(description) {
  const lines = String(description || '').split('\n').filter((line) => {
    const text = line.trim();
    if (!text) return false;
    return !(text.startsWith('[') && text.includes('](http'));
  });
  return lines.join('\n').trim();
}

/**
 * @param {{ site: string }} config
 * @param {string} slug
 * @param {string} blurb
 */
export function embedDescription(config, slug, blurb) {
  return String(blurb || '').trim();
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
    const build = bySlug.get(slug) || { slug };
    const blurb = clip(await withItemEmoji(config, String(build.blurb || '').replace(/\s+/g, ' ').trim()));
    const description = embedDescription(config, slug, blurb);
    const next = {
      title: embed.title,
      ...(embed.url ? { url: embed.url } : {}),
      ...(embed.color ? { color: embed.color } : {}),
      ...(description ? { description } : {}),
      ...(embed.author?.name
        ? {
          author: {
            name: embed.author.name,
            ...(embed.author.icon_url ? { icon_url: embed.author.icon_url } : {}),
            ...(embed.author.url ? { url: embed.author.url } : {}),
          },
        }
        : {}),
      fields: fieldsWithLinks(config, build, embed.fields || []),
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
 * Put the link columns on posts that already exist.
 * @param {{ token: string, site: string }} config
 * @param {Record<string, string>} known
 * @param {Record<string, unknown>[]} builds
 */
export async function applyLinkColumns(config, known, builds) {
  const bySlug = new Map((builds || []).map((build) => [String(build.slug || ''), build]));
  let updated = 0;
  for (const [slug, threadId] of Object.entries(known)) {
    if (!threadId) continue;
    const current = await discord(config.token, `/channels/${threadId}/messages/${threadId}`);
    if (!current.ok) continue;
    const message = await current.json();
    const embed = message.embeds?.[0];
    if (!embed) continue;
    const build = bySlug.get(slug) || { slug, author_name: embed.author?.name || '' };
    if (!build.profiles && embed.author?.url) {
      try {
        const discordId = new URL(embed.author.url).searchParams.get('d') || '';
        if (discordId) build.profiles = { discord_id: discordId, display_name: embed.author.name || '' };
      } catch {
        /* author link is not a profile */
      }
    }
    const fields = fieldsWithLinks(config, build, embed.fields || []);
    const description = blurbOnly(embed.description);
    const sameFields = JSON.stringify(fields) === JSON.stringify((embed.fields || []).map((field) => ({
      name: field.name,
      value: field.value,
      inline: Boolean(field.inline),
    })));
    if (sameFields && description === String(embed.description || '').trim()) continue;
    const patched = await discord(
      config.token,
      `/channels/${threadId}/messages/${threadId}`,
      'PATCH',
      {
        embeds: [{
          title: embed.title,
          ...(embed.url ? { url: embed.url } : {}),
          ...(embed.color ? { color: embed.color } : {}),
          ...(description ? { description } : {}),
          ...(embed.author?.name
            ? {
              author: {
                name: embed.author.name,
                ...(embed.author.icon_url ? { icon_url: embed.author.icon_url } : {}),
                ...(embed.author.url ? { url: embed.author.url } : {}),
              },
            }
            : {}),
          fields,
          ...(embed.image?.url ? { image: { url: embed.image.url } } : {}),
          ...(embed.thumbnail?.url ? { thumbnail: { url: embed.thumbnail.url } } : {}),
          ...(embed.footer?.text ? { footer: { text: embed.footer.text } } : {}),
        }],
      },
    );
    if (!patched.ok) {
      const detail = await patched.text();
      console.error(`Build link columns failed for ${slug} (${patched.status}): ${detail.slice(0, 180)}`);
      continue;
    }
    updated += 1;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  if (updated) console.log(`Build link columns updated on ${updated} post${updated === 1 ? '' : 's'}`);
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
    const face = String(embed.author?.icon_url || '');
    const faceUrl = /^https?:\/\//i.test(face) ? face : '';
    const thumbUrl = String(embed.thumbnail?.url || '');
    if (hosted && !loose && !stamped) {
      if (faceUrl && thumbUrl !== faceUrl) {
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
              image: { url: imageUrlNow },
              thumbnail: { url: faceUrl },
              ...(embed.footer?.text ? { footer: { text: embed.footer.text } } : {}),
            }],
          },
        );
        if (!patched.ok) {
          const detail = await patched.text();
          console.error(`Creator thumbnail failed for ${slug} (${patched.status}): ${detail.slice(0, 180)}`);
          continue;
        }
        shown += 1;
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
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
          ...(faceUrl ? { thumbnail: { url: faceUrl } } : embed.thumbnail?.url ? { thumbnail: { url: embed.thumbnail.url } } : {}),
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
  if (shown) console.log(`Build embed picture updated on ${shown} post${shown === 1 ? '' : 's'}`);
}
