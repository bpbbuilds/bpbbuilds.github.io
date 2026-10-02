# Discord bot — hosting + development plan

**Status:** bot is in the BPB Builds server. `npm run bot:sync` mirrors `profiles.plan` onto Premium and Founding, and sets nicknames to `chosen name | 🎒 uploaded builds`. A nickname change is kept, and the build count is added back onto it. `npm run bot:watch` keeps resetting those nicknames and posts each public website build into the **builds** forum. Sign-in calls `discord-guild` and offers the invite when the account is not in the server. Guild slash commands are registered from `bot/command-list.js` with `npm run bot:commands`. `/test` replies that the bot is online. `/inv` pages through a member’s blob inventory, one item image at a time.

**Locked decisions:**

- Host: **Oracle Cloud always-free VPS** — we want **slash commands**, so the bot is a real gateway bot (persistent websocket), not Edge-only. Supabase Edge Functions cannot hold the gateway connection.
- **Supabase stays the source of truth** for entitlements (`profiles.plan` / `founding_slot`). The bot *mirrors* it to Discord roles; it never decides who is Premium.
- Bot code lives in this repo under **`bot/`** (created when work starts); the VPS runs from a checkout. Secrets live only in the VPS env (`.env` is already gitignored).
- Reuse the **existing site Discord OAuth application** (the Client ID already in Supabase Auth → Discord provider): add its Bot user in the [Developer Portal](https://discord.com/developers/applications). Same app = required for `guilds.join` auto-join, and keeps site ↔ bot identity unified.
- Discord stays the community/support channel; the bot is glue, not a product surface.

Related: [`launch-phase-1.md`](../product/launch-phase-1.md) (Discord section = launch blockers) · [`stripe.md`](../pages/stripe.md) · [`auth.md`](../pages/auth.md) · [`votes.md`](../pages/votes.md) · [`todo.md`](../todo.md) (Discord research)

---

## Why a VPS

| Bot ability | Needs gateway (VPS)? | Notes |
|---|---|---|
| Grant/remove **Premium** / **Founding** role | No — REST is enough | Possible from an Edge Function, but the VPS makes it one code path |
| **Slash commands** | **Yes** | The reason we chose the VPS |
| Build announce posts | No (REST), but natural on the bot | Needs board PNG (Phase C) |
| `guilds.join` auto-join on site Sign in | No (REST) | Optional launch slip — see [auth notes](../pages/auth.md) |
| Nightly role reconcile | No — cron on the VPS is simplest | Fixes drift (leave/rejoin wipes roles) |

Oracle **Always Free** tier is enough for a small gateway bot: 2× AMD micro VMs (1 GB each) or the much roomier **Ampere A1** arm64 (4 OCPU / 24 GB shared). Take a single A1 VM (e.g. 1 OCPU / 6 GB) if capacity is available; AMD micro works but is snug (add swap). "Out of host capacity" errors are common on A1 in busy regions — retry later or pick a quiet home region at signup (region can't change later).

## Repo layout (when work starts)

Follows the project file rules (entry file, one feature per file, ~500-line cap):

```text
bot/
  index.js            # gateway client + login (entry)
  deploy-commands.mjs # REST slash-command registration (run on change; no gateway needed)
  roles.js            # grant/revoke + full reconcile (shared logic)
  supabase.js         # read-only client for role snapshots
  commands/           # one file per slash command
.env                  # VPS only — never committed
```

Env names (VPS `EnvironmentFile`, mode 600):

| Name | Use |
|---|---|
| `DISCORD_BOT_TOKEN` | Bot login — full control of the bot; treat like a password |
| `DISCORD_GUILD_ID` | Our community server |
| `DISCORD_ROLE_PREMIUM` / `DISCORD_ROLE_FOUNDING` | Role IDs to mirror |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | **Read-only** role snapshot + reconcile |
| `BOT_WEBHOOK_SECRET` | Shared secret for the DB-trigger push (below) |
| `BOT_WEBHOOK_PORT` | Only if the push webhook is enabled |

---

## Phase A — role sync (launch blocker, ship with money)

Everything in [`launch-phase-1.md`](../product/launch-phase-1.md) → Discord. Roles: **Premium** (paid, added on Stripe pay; removed on cancel/expire), **Founding** (slots — cap 10 today, never removed).

### Sync paths

| Path | How | Covers |
|---|---|---|
| **Push (lean)** | DB trigger on `profiles.plan` change → `pg_net` POST `{ discord_id, plan }` to the bot webhook (secret-verified). | Stripe pay/cancel (`stripe-webhook` already writes `plan`), founding grant (`claim_founding_slot`), manual fixes — one path for all |
| **Reconcile (safety net)** | Nightly cron on the VPS: snapshot `(discord_id, plan)` → diff vs guild member roles → fix. Also on-demand `/roles sync` (owner-only). | Drift: member left/rejoined, missed push, manual role edits |

Push is best-effort (`pg_net` is async); the reconcile is what guarantees correctness. Start with both from day one — the backfill *is* the first reconcile run.

Founding grant nuance: `claim_founding_slot` runs at sign-in, so a founding member may have the site plan before the bot ever saw them — the reconcile/backfill handles existing members.

### `guilds.join` auto-join (optional, can slip to 1.1)

1. Add `guilds.join` to the Supabase Discord OAuth scopes in [`js/shared/auth.js`](../../js/shared/auth.js) (`scopes: 'identify'` today)
2. Bot (same application as the OAuth app) needs the **Create Invite** permission in the server
3. Users see a join prompt at site Sign in — acceptable friction, but it must be conscious opt-in copy

### Setup checklist (when starting)

- [ ] **Dev Portal:** add Bot user to the existing site OAuth app; copy token; disable **Public Bot** (no need for it in other servers)
- [ ] **Invite:** OAuth2 URL generator with `bot` scope; permissions: Manage Roles, View Channels, Send Messages, Create Invite (auto-join only)
- [ ] **Server:** create **Premium** + **Founding** roles; drag them **below** the bot's role in the role list (bot can only grant roles under itself)
- [ ] **Oracle:** Always Free VM (A1 if available), Ubuntu LTS, Node 20 LTS, `systemd` unit for `bot/index.js`; keep **zero inbound ports** unless the push webhook is enabled — then open the port in both the OCI Security List and OS firewall, secret-gated
- [ ] **Supabase:** enable `pg_net`; trigger on `profiles.plan`; service-role key into VPS env
- [ ] **Backfill:** one reconcile run grants roles to existing members; verify by hand
- [ ] **Legal:** one-liner in Privacy + Terms that membership status syncs to Discord roles (see [legal rule](../../.cursor/rules/legal.md); [`stripe.md`](../pages/stripe.md) 85% section already tracks it)

## Phase B — slash commands (why we chose a VPS)

Register via `bot/deploy-commands.mjs`; use **guild-scoped** commands while iterating (instant) — global takes up to an hour to propagate.

- [ ] `/roles sync` — owner-only reconcile trigger (ships with Phase A, really)
- [ ] `/build search <text>` — public builds from Supabase (read via REST/RPC), reply as embed + link
- [ ] `/build random` — random public build (nice for the community)
- [ ] `/premium` — what Premium gets + site link (static reply, cheapest win)
- [x] `/test` — replies that the bot is online
- [x] `/inv` — pages through a member’s blob inventory, one worn item image at a time

## Phase C — build announce

- [x] Auto-post when a build is public: the **builds** forum gets a post with title, class, author, Real/Feasible/Theory, rank, link, and the saved board still when `board_still_path` is set. Private builds stay off the forum. `npm run bot:watch` polls about once a minute (`bot/announce.js`). Already-posted slugs are remembered in `bot/data/` (gitignored) and by reading existing forum posts.

## Phase D — maybe later (do not build at launch)

- Discord ↔ site comment sync (decide sync vs "Discuss on Discord" link-out first)
- Moderation extras beyond built-in AutoMod; reaction roles; starboard
- Stream-alert blobs / YouTube notifications (Phase 2 ideas in [`launch-phase-2.md`](../product/launch-phase-2.md))

## Out of scope

- Music / generic bot features; a second bot application; Discord as an auth *replacement*
- The bot writing to `profiles` (Supabase is the source of truth; bot reads only)
- Committing tokens / service keys anywhere — VPS env only
