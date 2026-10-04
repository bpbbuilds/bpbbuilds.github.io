const CRAWLER_RE = /discordbot|twitterbot|facebookexternalhit|facebot|slackbot|linkedinbot|pinterest|whatsapp|telegrambot|googlebot|bingbot|applebot|skypeuripreview/i;
const SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,119}$/i;
const DEFAULT_SITE = 'https://bpbbuilds.com';
const DEFAULT_SUPABASE = 'https://xklkysmakrmgtiztsqug.supabase.co';
const FALLBACK_IMAGE = '/assets/brand/logo-backpack-battles-builds.png';

export default {
  /**
   * @param {Request} request
   * @param {{ SITE_URL?: string, SUPABASE_URL?: string, SUPABASE_PUBLISHABLE_KEY?: string }} env
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    const slug = readSlug(url);
    if (!slug) return text('Not found', 404);

    const build = await loadPublicBuild(slug, env);
    if (!build) return text('Build not found', 404);

    const site = cleanOrigin(env.SITE_URL || DEFAULT_SITE);
    const canonical = `${site}/builds/view/?slug=${encodeURIComponent(slug)}`;
    const title = `${cleanText(build.title, 'Backpack Battles build')} — BPB Builds`;
    const description = buildDescription(build);
    const image = buildImage(build, env, site);
    const crawler = CRAWLER_RE.test(request.headers.get('user-agent') || '');
    const preview = url.searchParams.get('preview') === '1';

    // Browsers go straight to the existing client-rendered page. Crawler
    // requests stay on this worker so Discord/social clients receive HTML
    // metadata without needing to execute the app's JavaScript.
    if (!crawler && !preview) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: canonical,
          'Cache-Control': 'public, max-age=60, s-maxage=300',
        },
      });
    }

    const html = metadataPage({
      title,
      description,
      canonical,
      image,
      shareUrl: `${url.origin}/build/${encodeURIComponent(slug)}`,
      build,
    });
    const headers = new Headers({
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Robots-Tag': 'index,follow',
    });
    return new Response(html, { status: 200, headers });
  },
};

function readSlug(url) {
  const match = url.pathname.match(/^\/build\/([^/]+)\/?$/i);
  if (!match) return '';
  let slug = '';
  try {
    slug = decodeURIComponent(match[1]);
  } catch {
    return '';
  }
  return SLUG_RE.test(slug) ? slug : '';
}

async function loadPublicBuild(slug, env) {
  const base = cleanOrigin(env.SUPABASE_URL || DEFAULT_SUPABASE);
  const key = String(env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!base || !key) return null;

  const params = new URLSearchParams({
    select: 'slug,title,hero_class,blurb,author_name,build_tag,rank,gold_count,board_still_path,updated_at,is_public',
    slug: `eq.${slug}`,
    is_public: 'eq.true',
    limit: '1',
  });
  const response = await fetch(`${base}/rest/v1/builds?${params}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) return null;
  const rows = await response.json().catch(() => null);
  const build = Array.isArray(rows) ? rows[0] : null;
  return build && build.is_public === true ? build : null;
}

function buildDescription(build) {
  const pieces = [];
  const hero = cleanText(build.hero_class, '');
  const tag = cleanText(build.build_tag, '');
  const rank = cleanText(build.rank, '');
  const author = cleanText(build.author_name, '');
  if (hero) pieces.push(hero);
  if (tag) pieces.push(tag);
  if (rank) pieces.push(rank);
  if (author) pieces.push(`by ${author}`);
  const blurb = cleanText(build.blurb, '');
  if (blurb) pieces.push(blurb);
  return truncate(pieces.join(' · ') || 'A public Backpack Battles build on BPB Builds.', 240);
}

function buildImage(build, env, site) {
  const raw = String(build.board_still_path || '').trim();
  const base = cleanOrigin(env.SUPABASE_URL || DEFAULT_SUPABASE);
  if (raw && !raw.includes('..') && !raw.includes('\\') && !/^https?:\/\//i.test(raw)) {
    const path = raw.replace(/^\/+/, '').replace(/^board-stills\//i, '');
    const parts = path.split('/');
    if (parts.length && parts.every((part) => /^[^?#]+$/.test(part) && part !== '.' && part !== '..')) {
      return `${base}/storage/v1/object/public/board-stills/${parts.map(encodeURIComponent).join('/')}`;
    }
  }
  return `${site}${FALLBACK_IMAGE}`;
}

function metadataPage({ title, description, canonical, image, shareUrl, build }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCanonical = escapeAttr(canonical);
  const safeImage = escapeAttr(image);
  const safeShare = escapeAttr(shareUrl);
  const safeBuildTitle = escapeHtml(cleanText(build.title, 'Build'));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}">
  <link rel="canonical" href="${safeCanonical}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="BPB Builds">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:url" content="${safeShare}">
  <meta property="og:image" content="${safeImage}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${safeImage}">
</head>
<body>
  <main>
    <h1>${safeBuildTitle}</h1>
    <p>${safeDescription}</p>
    <p><a href="${safeCanonical}">Open this build on BPB Builds</a></p>
  </main>
</body>
</html>`;
}

function cleanOrigin(value) {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  return /^https:\/\//i.test(raw) ? raw : '';
}

function cleanText(value, fallback) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function truncate(value, max) {
  const text = String(value || '');
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function text(value, status) {
  return new Response(String(value || ''), {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': status === 404 ? 'public, max-age=30' : 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
