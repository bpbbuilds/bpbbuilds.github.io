# Shared-build previews

The static GitHub Pages app renders build pages in the browser, so crawlers such
as Discord's link preview fetcher cannot depend on that JavaScript to discover
Open Graph metadata. The small Cloudflare Worker in
`infra/cloudflare/share-worker/` provides a crawler-safe front door without
proxying the production site.

## URL and behavior

The public share URL is:

```text
https://share.bpbbuilds.com/build/<build-slug>
```

The slug is the existing public `builds.slug`; no new build identifier or
database table is introduced. A normal browser receives a short redirect to:

```text
https://bpbbuilds.com/builds/view/?slug=<build-slug>
```

Known crawler user agents receive server-rendered HTML with escaped `title`,
`description`, canonical URL, `og:*`, and Twitter card metadata. Only rows with
`is_public = true` are queried. Private, missing, or malformed slugs return
404 without revealing build data. A public `board_still_path` is used as the
preview image; otherwise the BPB logo is used.

Responses are cached for 5 minutes at the edge and may be served stale for up to
one hour while revalidation runs. The source build can change without leaving a
permanent preview in the cache.

## Deploy

From this directory, after authenticating Wrangler to the Cloudflare account:

```powershell
cd infra/cloudflare/share-worker
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npx wrangler deploy
```

Enter the existing Supabase **publishable/anon** key only at the local Wrangler
prompt. Never use the Supabase service-role key here and never commit a secret.
`wrangler.toml` contains only the public project URL, production site URL, and
the scoped `share.bpbbuilds.com/*` Worker route. It does not define a wildcard
route and does not overlap `ai.bpbbuilds.com`.

The route requires the `share` hostname to be proxied by Cloudflare. If Wrangler
does not create the DNS record automatically, create a proxied DNS record for
`share` in the Cloudflare zone and point it at the Worker route from the
Cloudflare dashboard; do not point it at the FreeLLMAPI tunnel.

## Verification

Use a real public slug after deployment:

```powershell
curl.exe -I https://share.bpbbuilds.com/build/<slug>
curl.exe -A Discordbot https://share.bpbbuilds.com/build/<slug>
curl.exe -A Discordbot -I https://share.bpbbuilds.com/build/<slug>
```

The browser request should be a 302 to `bpbbuilds.com`. The crawler request
should be 200 and contain `og:title`, `og:description`, `og:url`, and
`og:image`. Test a private/nonexistent slug and confirm 404. Test a slug with
quotes or HTML characters and confirm it is rejected or escaped. Test the image
URL independently. Keep the original GitHub Pages build URL working for people
who have older links.

## Discord bot architecture

The repository already uses a Discord Gateway process (`npm run bot:watch`) for
slash commands, buttons, forum announcements, and member events. That process
does not need an inbound HTTPS interaction endpoint; Discord delivers gateway
events over its outbound WebSocket. We therefore do **not** create a second
HTTP-interactions Worker at `discord.bpbbuilds.com`, which would duplicate the
bot application and require a second command/credential path. If the bot is
ever intentionally migrated to Discord HTTP Interactions, signature verification
and a separately deployed Worker must be designed as a new, reviewed feature.
