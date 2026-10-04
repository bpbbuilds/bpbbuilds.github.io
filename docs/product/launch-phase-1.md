# Phase 1 — Launch todos

Things that must be done **before** the site URL goes public (videos, Discord, YouTube). Check off here when shipped.

North star: [`purpose.md`](../purpose.md). Day-to-day leftovers: [`todo.md`](../todo.md). Auth today: [`auth.md`](../pages/auth.md).

**Launch offer:** Discord sign-in, Stripe Premium, first **50** eligible sign-ins get **Premium forever**, light blob + **three grant cosmetics** (Premium / Founding / event win), Discord Premium (+ Founding) roles, and a **thin launch event** so go-live has a community moment.

**Already shipped (do not rebuild):** homepage, Itemiary, `/builds/`, build pages, `/create/` (history.db path), `/admin/`, Discord OAuth + `profiles`, legal stubs (must update when money exists), Premium Play **plaque** (visual only), profile Blob / Inventory shell. `/sim/` exists as an engine sandbox — **not** launch-ready as a paid feature yet.

**Not this launch:** cosmetics shop, trading, currency, YouTube like/comment rewards, stream alert blobs, Steam link, native comments, **full events hub / multi-event admin**, auto `history.db` DPS scoring pipeline, AI board optimize, build DPS “Excellent” ratings, claiming sim is 1:1 with live PvP, community cosmetic submit pipeline.

---

## Legal / IP (before taking money)

- [x] **Monetization + IP go-no-go** — conditional go on tools membership; see [`monetization-ip.md`](monetization-ip.md) ([`todo.md`](../todo.md) Legal)
- [x] **Privacy** — Stripe, founding promo (overlay / Discord role sync still deferred)
- [x] **Terms** — accounts, paid plan, founding 50 (lifetime, not cancelable via Portal), conduct
- [x] **About / footer** — founding / Premium mentioned; no fake publisher affiliation

---

## Membership (Stripe)

Full ladder (0% → 100%): [`stripe.md`](../pages/stripe.md).

- [x] Confirm price (todo lean: ~$2–3/mo) — **locked $3/mo** in offer UI; see stripe.md
- [x] Stripe product + price in dashboard
- [x] `profiles` fields: `plan` (`free` | `founding` | `premium`), `premium_until`, `founding_slot`, `stripe_customer_id` + RLS
- [x] Checkout from a **signed-in** Discord user
- [x] Webhook updates `profiles` on pay / fail / cancel
- [x] Customer Portal (manage / cancel / invoices)
- [x] Settings / billing page (nav or profile when signed in)
- [x] Premium gate UX — Play / sim (and other premium controls): upgrade prompt, not a dead click
- [x] Profile flair — Premium / Founding on `/u/{discord_id}/`
- [x] Profile polish enough that Premium/Founding looks intentional (parchment, not a bare list) — Patch3 header + sticker flair ([`js/pages/u/profile.css`](../../js/pages/u/profile.css))
- [ ] **Brainstorm Premium profile presence** — beyond the flair chip: a clear “this person is Premium” look on `/u/` (and maybe bylines later). Ideas only for now — pick one before shipping: animated / shimmer name, display-face treatment, Discord-style profile decoration (banner / nameplate / avatar ring), soft gold ink wash, etc. Keep parchment/leather; honor `prefers-reduced-motion`. Detail / todos: [`profile/profile.md`](../pages/profile/profile.md)
- [ ] **Profile background cosmetics (idea)** — deferred past launch thin event; default town scene. See [`profile/profile.md`](../pages/profile/profile.md)

---

## Premium features (must be worth paying)

Do not take money until these feel finished. Gate behind Discord + Premium/founding. Free users get a teaser or upgrade prompt, not a dead click.

### Sim (`/sim/`)

Engine work continues ([`sim-phases.md`](../sim/sim-phases.md)); launch needs a **sellable** sandbox, not live-PvP 1:1. Product UX vision: [`sim-product.md`](../sim/sim-product.md) (Phases **2–3** + combat-report redesign are launch must-haves).

**Phase 1 shell (done)**

- [x] Sim page UX/chrome finalized (load a board, run, log/meter readable, not a lab dump) — sim-product Phase 1
- [x] Premium gate: full run + log; **upgrade-only** (no free teaser) — soft/hard gates + shared offer
- [x] Play CTAs on build + create open gated sim
- [x] Honest copy: predictive dummy sim, not ranked replay; no public “matches the game” until Phase 38 ([`sim-ip-marketing.md`](../sim/sim-ip-marketing.md))

**Launch must-haves (sim-product Phase 2–3 + report UX)** — `/sim/` only; UI first, art swaps in. Detail: [`sim-product.md`](../sim/sim-product.md) Core UX + Phase 2–3 slice order.

- [x] Sim foe modes UI (v1): Dummy / Public build / Mirror — [`sim-foe-mode.js`](../../js/pages/sim/foe/sim-foe-mode.js); `?foe=` + slug Apply; Mirror clones you-board
- [x] Dummy settings panel + persist last preset (HP, defence/block, attack on/off, damage + interval) — [`sim-dummy-settings.js`](../../js/pages/sim/foe/sim-dummy-settings.js); `localStorage` + URL
- [x] Stage avatar slots (placeholder art OK)
- [x] You avatar pick (v1): board class vs equipped profile (under-sprite pills)
- [x] Foe avatar pick (v1): dummy fixed; public build = class vs author profile; mirror = independent pick — superseded by mode-implied avatars in side-rail UX
- [x] Profiles: public equipped avatar field (schema when built) — [`017_profiles_equipped_avatar.sql`](../db/sql/017_profiles_equipped_avatar.sql); apply in Supabase
- [x] Swap final dummy art ([ChatGPT dummy](../sim/sim-product.md#chatgpt-dummy-art-prompt) → [`assets/sim/dummy/dummy.png`](../../assets/sim/dummy/dummy.png)); profile base / blob still owner WIP
- [x] **Side rails (avatar + foe)** — painted person icon left of you sprite (+ empty slots); painted target icon right of foe sprite; gap from sword / bag / film — [`sim-product.md`](../sim/sim-product.md) Side rails; [`sim-side-rails.js`](../../js/pages/sim/foe/sim-side-rails.js); art [`PersonToggle.png`](../../assets/icons/history/PersonToggle.png) / [`OpponentToggle.png`](../../assets/icons/history/OpponentToggle.png)
- [x] You person popover: class sprite vs equipped profile; retire under-sprite Class / Profile pills — [`sim-side-rails.js`](../../js/pages/sim/foe/sim-side-rails.js) `mountYouPersonRail`
- [x] Foe opponent popover: Dummy / Public build / Mirror; mode-implied avatars; retire opp-column mode tabs — [`sim-foe-rail.js`](../../js/pages/sim/foe/sim-foe-rail.js)
- [x] Public build scoped browser (open before mode switch; on select load board + author avatar); 3-col grid; shared build search in the filter rail (`@user` / `[Item]` / free text); same `/builds/` filter rail on the right — [`sim-build-browser.js`](../../js/pages/sim/foe/sim-build-browser.js)
- [x] Dummy settings in the empty opponent bag slot when foe = Dummy (same visibility / persist as today) — [`sim-opp-column.js`](../../js/pages/sim/foe/sim-opp-column.js) + [`sim-dummy-settings.css`](../../js/pages/sim/foe/sim-dummy-settings.css)
- [ ] **Combat report redesign** — floating / post-run report reads as game chrome (scannable hierarchy), not a debug dump; keep export/debug for triage (not the Phase 4 admin queue)
- [ ] Light blobs / cosmetics deepen avatar pick later ([Light blobs](#light-blobs--launch-cosmetics), [`profile/profile.md`](../pages/profile/profile.md)) — same equip path, no separate shop)

**Still open**

- [ ] Fidelity good enough to demo real boards without obvious fake fights (HAND deep + gates green; live `live.*` fill-in still nice-to-have)
- [x] Report mismatch → admin triage (sim-product Phase 4) — `/admin/` Sim reports queue

### Screenshot → build (`/create/`)

- [ ] Drop/upload a backpack screenshot on create → detected layout on the board (vision)
- [ ] Premium-only (founding included); free users see the drop target + upgrade prompt
- [ ] Privacy: screenshots not kept longer than needed; legal stubs mention the upload
- [ ] Fail state: “couldn’t read this image” — no silent wrong board

### Export board PNG (`/create/`)

- [x] Export / download PNG of the current create board (bag + items)
- [x] Premium-only (founding included); free users get shared upgrade offer, not a silent no-op

---

## Create / site leftovers (launch polish)

Nice if they ship with launch; do not block Stripe if sim + screenshot are the paid hooks. Still check off if done before URL go-live.

- [ ] Create: arrow keys stay in title/notes when those fields are focused (don’t steal for round scrubber)
- [ ] Create: drag socketed gems onto Needs / Wants / Good to have
- [ ] Mobile side nav + a usable small-screen pass on home / items / create / builds (can slip if desktop launch is the video audience)

---

## Founding 10 (free Premium forever)

Rules: first 10 **eligible** Discord sign-ins **after** promo start. Atomic slot 1–10 (no race). Exclude `is_owner` + test Discord IDs. Grant does **not** expire and is **not** removed by Stripe cancel. After 10, sign-in still works; paid path is Stripe.

**Public URL:** `https://bpbbuilds.com`
**Gate:** `public.founding_promo.started_at` ([`docs/db/sql/016_founding_promo_start.sql`](../db/sql/016_founding_promo_start.sql)) — leave `null` until that URL is advertised; then:

```sql
update public.founding_promo set started_at = now() where id = true;
```

Until then: Stripe Premium works; **no new** founding grants (existing founding rows stay).

- [x] Promo start timestamp (flip the day the URL goes public) — table + RPC gate shipped; `started_at` still **null** until announce
- [ ] Atomic grant on first eligible sign-in
- [ ] Admin: slots used + founding names (owner-only)
- [ ] Same one-line offer on site + Discord; after 50, CTA becomes Stripe

---

## Discord

Plan: [`../features/discord-bot.md`](../features/discord-bot.md) — Oracle always-free VPS (slash commands), phases + setup checklist.

- [ ] Bot in the community server
- [ ] Sync **Premium** role on founding grant / Stripe change (add + remove)
- [ ] **Founding** role for slots (cap 10 today)
- [ ] Auto-join on site Sign in (`guilds.join`) — optional; can slip to 1.1 if bot-on-existing-members is enough for launch

---

## Launch event (thin)

Ship **one** public event with go-live so the site opens with a community moment. Detail: [`launch-event.md`](../pages/events/launch-event.md). Theme lean: Highest DPS ([`highestDPS.md`](../pages/events/eventIdeas/highestDPS.md)) — **vision**, not auto-scoring for v1.

**v1 bar (thin):**

- [x] Public `/events/` page — rules, dates, how to enter, prize cosmetic
- [ ] Entry via Discord pin (or a one-line form later); **you** judge
- [ ] Winner cosmetic grant by hand (`profiles.cosmetic_grants`) — no upload pipeline yet
- [x] Nav Events banner points at `/events/` (not `#events` coming-soon)

**Not v1:** history.db auto ingest, 15s dummy leaderboard, multi-event owner hub → Phase 2 / 1.1.

---

## Light blobs + launch cosmetics

Original art only. No shop / trade / coins. Profile hub: [`profile/profile.md`](../pages/profile/profile.md). Art / overlay contract: [`blob-cosmetics-pipeline.md`](../pages/profile/blob-cosmetics-pipeline.md).

**Universal (free for every signed-in profile):** base Light blob, wardrobe, Identity Discord↔blob, Inventory, and `starter` cosmetics.

- [ ] One peeking **base** blob (final art)
- [x] Starter cosmetics free for everyone (hats / face / neck / head / hand / body placeholders)
- [x] Exclusive grant cosmetics (still Premium / Founding / event flair — not required to use blobs):
  - **Premium** — `premium_crown`, `grant_premium_badge` when `plan` is `premium` or `founding`
  - **Founding** — `grant_founding_crown` when `plan` is `founding`
  - **Event winner** — `grant_event_trophy` via `profiles.cosmetic_grants`
- [x] Equip UI (profile Blob / Inventory tabs) — ownership wired to starter + plan + grants
- [x] Inventory tiles = **blob + that cosmetic** (dunkbin-style composite) — swap placeholder PNGs for final art
- [ ] Transparent overlay page for OBS browser source
- [ ] Overlay shows current premium/founding loadouts (snapshot OK for recorded videos)

---

## Site go-live

- [ ] Public host URL is the real one (GitHub Pages or chosen host) — target **`https://bpbbuilds.com`**
- [ ] Enough real OP / catalog builds that a new visitor is not on an empty site
- [ ] Thin launch event page live + prize cosmetic ready to grant
- [ ] Un-hide URL in videos / Discord / YouTube **after** Stripe + founding grants work
- [x] Flip founding promo start when that URL is public — policy + SQL gate ready; run the `started_at` update at announce (see Founding 50)

---

## After launch (not blockers)

Tracked in [`launch-phase-2.md`](launch-phase-2.md).

- [ ] Watch entitlements (founding vs Stripe) for a bit before more cosmetics
- [ ] More blobs / live follow-sub alerts — later
- [ ] Keep iterating create / builds / sim
- [ ] Export `history.db` (Premium) — Phase 2
- [ ] Build combat stats (DPS / heal / s / … on pages, sim, tips) — Phase 2
- [ ] Cosmetics marketplace (player buy / sell blob cosmetics) — Phase 2
- [ ] Events **hub** (owner manage multiple runs) + auto DPS scoring — Phase 2
