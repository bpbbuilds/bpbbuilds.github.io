/**
 * Creator pictures stay on the post, but not as a forum-card image.
 * The card uses the board file. The face is a normal image link.
 */
/**
 * @param {{ base: string, key: string }} config
 * @param {Record<string, unknown>} build
 * @param {Buffer} png
 * @returns {Promise<string>}
 */
export async function hostCreatorIcon(config, build, png) {
  const profile = build.profiles && typeof build.profiles === 'object' ? build.profiles : {};
  const id = String(profile.discord_id || build.slug || 'creator').replace(/[^\w.-]/g, '') || 'creator';
  const objectPath = `discord-creators/${id}.png`;
  const res = await fetch(`${config.base}/storage/v1/object/board-stills/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: png,
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error(`Creator icon upload failed (${res.status}): ${detail.slice(0, 160)}`);
    return '';
  }
  return `${config.base}/storage/v1/object/public/board-stills/${objectPath}`;
}

/**
 * @param {{ base: string, key: string }} config
 * @param {Record<string, unknown>} build
 * @param {{ author: object | null, file: Buffer | null }} credit
 */
export async function useHostedCreatorIcon(config, build, credit) {
  if (!credit?.file || !credit.author) return credit;
  const url = await hostCreatorIcon(config, build, credit.file);
  if (url) credit.author.icon_url = url;
  credit.file = null;
  return credit;
}

/**
 * @param {object} embed
 * @param {object | null} author
 */
function embedWithAuthor(embed, author) {
  return {
    title: embed.title,
    ...(embed.url ? { url: embed.url } : {}),
    ...(embed.color ? { color: embed.color } : {}),
    ...(embed.description ? { description: embed.description } : {}),
    ...(author ? { author } : {}),
    ...(embed.fields?.length
      ? { fields: embed.fields.map((field) => ({ name: field.name, value: field.value, inline: Boolean(field.inline) })) }
      : {}),
    ...(embed.image?.url ? { image: { url: embed.image.url } } : {}),
    ...(embed.thumbnail?.url ? { thumbnail: { url: embed.thumbnail.url } } : {}),
    ...(embed.footer?.text ? { footer: { text: embed.footer.text } } : {}),
  };
}

/**
 * Point existing posts at the hosted face so the forum card is only the board.
 * @param {{ token: string, base: string, key: string }} config
 * @param {Record<string, string>} known
 * @param {Set<string>} done
 * @param {Record<string, unknown>[]} builds
 * @param {(done: Set<string>) => void} persist
 * @param {{ creatorCredit: Function, postDiscord: Function }} deps
 */
export async function moveCreatorIcons(config, known, done, builds, persist, deps) {
  const bySlug = new Map(builds.map((build) => [String(build.slug || ''), build]));
  let moved = 0;
  for (const [slug, threadId] of Object.entries(known)) {
    if (!threadId) continue;
    const build = bySlug.get(slug);
    if (!build) continue;
    const current = await deps.postDiscord(config.token, `/channels/${threadId}/messages/${threadId}`, 'GET');
    if (!current.ok) continue;
    const message = await current.json();
    const embed = message.embeds?.[0];
    if (!embed) continue;
    const files = Array.isArray(message.attachments) ? message.attachments : [];
    const creatorFile = files.find((file) => file.filename === 'creator.png');
    const icon = String(embed.author?.icon_url || '');
    const attached = icon.includes('creator.png') || icon.startsWith('attachment://');
    if (done.has(slug) && !creatorFile && !attached) continue;
    if (!creatorFile && !attached) {
      done.add(slug);
      persist(done);
      continue;
    }
    const credit = await deps.creatorCredit(config, build);
    await useHostedCreatorIcon(config, build, credit);
    const nextIcon = String(credit.author?.icon_url || '');
    if (!nextIcon || nextIcon.includes('creator.png') || nextIcon.startsWith('attachment://')) continue;
    const board = files.find((file) => file.filename === 'build.png');
    const next = embedWithAuthor(embed, credit.author);
    if (board?.url) {
      next.image = { url: board.url };
      next.thumbnail = { url: board.url };
    }
    const patched = await deps.postDiscord(
      config.token,
      `/channels/${threadId}/messages/${threadId}`,
      'PATCH',
      {
        embeds: [next],
        ...(creatorFile ? { attachments: board?.id ? [{ id: board.id }] : [] } : {}),
      },
    );
    if (!patched.ok) {
      const detail = await patched.text();
      console.error(`Creator icon move failed for ${slug} (${patched.status}): ${detail.slice(0, 180)}`);
      continue;
    }
    done.add(slug);
    persist(done);
    moved += 1;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  if (moved) console.log(`Creator icon kept off the forum thumbnail on ${moved} post${moved === 1 ? '' : 's'}`);
}
