# Northflank Discord Bot Deployment

This is the deployment record for the existing BPB Builds Discord Gateway
worker. It keeps the current bot behavior and runs one persistent process; it
does not replace the bot with an HTTP interaction endpoint and does not touch
the separate Cloudflare `ai.bpbbuilds.com` work.

## Existing bot audit

- **Bot directory:** `bot/`
- **Persistent entry point:** `bot/watch.js`
- **One-shot entry point:** `bot/index.js` (login/check, then exits)
- **Runtime:** Node.js ESM (`package.json` has `"type": "module"`)
- **Discord library:** `discord.js` 14.27.0 (the locked dependency)
- **Current local command:** `npm run bot:watch` → `node bot/watch.js`
- **Gateway:** yes; `Client` uses `Guilds`, `GuildMembers`, and `GuildMessages` intents
- **HTTP application endpoint:** none. The bot only makes outbound Discord and Supabase requests.
- **Database:** Supabase REST/Storage using the service-role key; there is no direct Postgres connection in the watcher.
- **Local assets:** board thumbnails, item emoji conversion, blob rendering, and Discord headers read selected files under `assets/`. The Dockerfile copies those files explicitly.
- **Runtime state:** `bot/data/*.json` is an ignored cache of Discord channel/message IDs and posted-build state. It is not a secret and is not committed. The bot can reconcile missing state from Discord, but a persistent volume prevents unnecessary re-discovery or duplicate introductory work after restarts.
- **Docker:** `bot/Dockerfile` is provided for this deployment. It installs production dependencies and copies only the bot's required code/assets.
- **Single-process safety:** yes, when run as one replica. Do not run the Northflank replica and the local PC watcher at the same time; both would process the same Gateway events and polling work.

The watcher now reads Northflank's `process.env` first, falls back to the local
`.env` only for development, exposes an optional internal `/healthz` check,
logs Gateway reconnect events, and handles `SIGTERM`/`SIGINT` cleanly.

## Northflank settings

Create a **Combined Service** from the GitHub repository and use the Dockerfile
build method.

| Setting | Value |
|---|---|
| Service type | Combined Service |
| Service name | `bpb-discord-bot` (or another unique name) |
| Repository | `https://github.com/bpbbuilds/bpbbuilds.github.io.git` |
| Branch | `main` |
| Build type | Dockerfile |
| Build context | Repository root (`/`) |
| Dockerfile path | `/bot/Dockerfile` |
| Build command | Leave blank; the Dockerfile runs `npm ci --omit=dev` |
| Start command | `node bot/watch.js` (or leave the override blank to use the Dockerfile CMD) |
| Public port needed | **NO** |
| Internal health port | `8787` only if configuring the health check; do not mark it public |
| Minimum instances | `1` |
| Autoscaling | Disabled |
| Recommended RAM | Start at `256 MB` only when Northflank clearly applies the free Sandbox allocation; raise to `512 MB` only if Northflank reports an out-of-memory restart. |

The Docker build context is the repository root because the existing bot imports
shared board/event modules and static assets. The Dockerfile uses explicit
`COPY` statements, so it does not package the website pages, screenshot models,
or unrelated development files into the image.

### Environment variables

Add these as **runtime environment variables** in Northflank. Put secret values
in Northflank's secret/environment-variable UI; never commit them or place them
in the Dockerfile.

Required:

- `DISCORD_BOT_TOKEN` — secret
- `DISCORD_GUILD_ID`
- `DISCORD_ROLE_PREMIUM`
- `DISCORD_ROLE_FOUNDING`
- `SUPABASE_PROJECT_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — secret
- `BOT_HEALTH_PORT=8787` — non-secret internal health port (the Dockerfile also sets this default)

Optional existing overrides (the code has safe defaults for these where
applicable):

- `DISCORD_BUILDS_FORUM_ID`
- `DISCORD_BUILDS_SITE_URL` (use `https://bpbbuilds.com`)
- `DISCORD_HONEYPOT_CHANNEL_ID`
- `DISCORD_HONEYPOT_MESSAGE_ID`
- `DISCORD_WELCOME_CHANNEL_ID`
- `DISCORD_WELCOME_MESSAGE_ID`

The bot does **not** need `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_URL`, Stripe
secrets, OpenAI keys, or the website's publishable browser key. Do not add those
to this service unless a future bot feature explicitly requires them.

### Health check

Configure an internal HTTP readiness check:

- Protocol: `HTTP`
- Port: `8787`
- Path: `/healthz`
- Initial delay: `15` seconds
- Period: `30` seconds
- Timeout: `5` seconds
- Failure threshold: `3`
- Success threshold: `1`

The endpoint returns `503` while the process is starting and `200` only after
the Discord client is ready. The Dockerfile also includes a container
`HEALTHCHECK` against this endpoint. It binds inside the container; it is not a
public website/API port. If Northflank offers a liveness check separately, use
the same endpoint with a generous failure threshold so a normal Discord
reconnect is not restarted too aggressively.

### State volume

Attach a small **single read/write** persistent volume before the first deploy:

- Volume name: `bpb-discord-bot-state`
- Container mount path: `/app/bot/data`
- One replica only

This preserves the ignored `bot/data/*.json` cache between redeploys. The files
contain IDs and polling state, not credentials. An empty volume is still
recoverable: the watcher searches existing Discord channels/threads and
rebuilds the cache.

## Deploy and verify

1. Stop the local `npm run bot:watch` process before enabling the Northflank service.
2. Add the runtime variables above, with secrets stored only in Northflank.
3. Attach the `/app/bot/data` volume and configure the internal readiness check.
4. Deploy one instance from `main`.
5. In Northflank logs, confirm lines similar to:

   ```text
   Discord Gateway ready as <bot tag>
   Watching nicknames as <bot tag>
   Health endpoint listening on /healthz (port 8787)
   ```

6. Confirm the internal health check is green and run `/test` in the Discord
   server. Then verify a harmless existing build/event poll in the logs.
7. To redeploy, push the intended commit to `main` or use Northflank's manual
   redeploy. Northflank sends `SIGTERM`; the watcher closes its health server
   and Discord session before the replacement instance starts.

Slash-command registration is a separate one-shot operation. If
`bot/command-list.js` changes, run `npm run bot:commands` once with the same
Discord variables; do not use that command as the Combined Service start
command.

Northflank is the only runtime host for this worker after cutover. The GitHub
Pages website and the Cloudflare tunnel remain separate services.

## Deployment checklist

```text
NORTHFLANK SETTINGS

Service name: bpb-discord-bot
Repository: https://github.com/bpbbuilds/bpbbuilds.github.io.git
Branch: main
Build type: Dockerfile
Build context: /
Dockerfile path: /bot/Dockerfile
Build command: (leave blank; Dockerfile runs npm ci --omit=dev)
Start command: node bot/watch.js (or leave the override blank to use the Dockerfile CMD)
Public port needed: NO
Health check: Internal HTTP readiness, port 8787, path /healthz
Minimum instances: 1
Environment variables required: DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DISCORD_ROLE_PREMIUM, DISCORD_ROLE_FOUNDING, SUPABASE_PROJECT_URL, SUPABASE_SERVICE_ROLE_KEY, BOT_HEALTH_PORT=8787
Estimated RAM: Start at 256 MB only under the free Sandbox allocation; increase to 512 MB only after an out-of-memory restart.
Anything that must be fixed before deployment: Confirm the service is using the free Sandbox allocation before accepting any billable configuration, add the runtime variables, attach /app/bot/data as a single-read/write volume, configure the internal health check, and stop the local watcher before cutover. No code blocker remains.
```
