# Project todos

Open follow-ups. Check off when done.

## Done (shipped)

- [x] **Items page** — Itemiary catalog, filters, grouping, spotlight, tooltips, load preview
  - [x] Spotlight right panel — crafted from / crafts into (`spotlight-recipes.js`)
  - [x] **Spotlight builds carousel (bottom)** — horizontal strip of builds that use the focused item; recipes stay on the right (`spotlight-builds.js`)
  - [x] **Spotlight builds ranking (smarter picks)** — essentials tier + placement density first, then `vote_score` / OP / featured (`sortScoreForItem` in `spotlight-builds.js`)
    - True combat synergy parked with **Solo board combat sandbox** (needs item scripts / sim)
- [x] Homepage featured video carousel (Twitch-style stage from `builds` / `is_featured`)
- [x] `builds` table + RLS + seed featured rows
- [x] Homepage “View build” → `/builds/{slug}/`
- [x] **Builds catalog** `/builds/` browse v1 — sort/view, tag/class/rank filters, Liked, card + compact boards, shared search (`?q=` / `@user` / `[Item]`) (see Next pages)
- [x] **Admin** `/admin/` portal — overview metrics, reports queue, builds curation (`docs/pages/admin.md`)
- [x] **Create board core** `/create/` — drag-drop 9×7 board, catalog, localStorage draft (`docs/pages/create-placement.md`)
  - Soft **Parked** strip (MVP bare sprites; theme polish open under Create page polish)
  - **Sell / discard** Chestnut bin (fixed bottom-right; cargo/gems → Parked)
  - Layer modes All / Bags / Items / Clear (functional; UI polish open under Create page polish)
- [x] **Filter rail short-screen scroll** — `max-height` + overflow on `.items-filters`; wheel scrolls rail first then bag (`wheel-to-grid.js`)

## Next pages (product)

Priority follows `docs/purpose.md` main jobs.

- [x] **Build guide pages** `/builds/{slug}/` — board + round scrubber + right info rail
  - [x] Info rail: class, bag, round picks (R3/R10), Needs / Wants / Good to have
  - [x] Title + OP badge above board; video as last scrubber step (bag ↔ video swap)
  - [x] Vote + Share on round bar (MVP / local vote)
  - [x] **Rank display** — league badge on info rail; missing/unknown shows — (no fake Gold); Title Case labels
  - [x] **Amulets** — no dedicated route slot (multi-amulet boards); use board + Needs/Wants (`015_drop_route_amulet.sql`)
  - [x] **Remix** — `/create/?remix={slug}` preloads board + meta (`js/pages/create/remix.js`)
  - [x] **Discuss CTA** — YouTube if video linked, else Discord (under Build Info)
  - [ ] **Comments section** — auth later
  - [ ] Related / discuss sections when we put them back around the board
- [x] **Builds catalog** `/builds/` — Reddit-inspired feed (browse + filters; links to `/builds/{slug}/` / view)
  - [x] **Sort** — Best / Hot / New / Top / Rising (proxy scores until stored votes)
  - [x] **View** — Card vs Compact (`?view=compact`); compact build-preview tip on hover
  - [x] **Filters** — tags (multi OR), class icons (Neutral = any), rank league icons (default all; greyscale unselected)
  - [x] **Liked** — local-vote filter (`?liked=1`); **My builds** — Discord auth filter (`?mine=1`)
  - [x] Post chrome — byline / title / flair / Build Info OptionsFont; vote · comment · remix · share row
  - [x] Board thumbs — fixed cell + visible overflow so edge bags/items extrude (not clipped)
  - [x] Real **Top** / Hot scores from stored `vote_score` (see Social / [`docs/pages/votes.md`](pages/votes.md))
- [x] **Build creator** `/create/` — board + catalog + park + sell (see Done); **Filter | Build** rail + meta pane mounted
  - Nav CREATE points here
  - Later: gate publish behind Steam (see Auth)
  - [x] Mount **meta pane** (title, class, tags, rank, R3/R10 slots, essentials)
  - [x] **Build tags** — Feasible ↔ Theorycraft (exclusive); OP request path
  - [x] **Authenticity tags (3-way)** — Theory · Feasible · Real on `build_tag`; Real tied to attached history; filters + create meta + catalog/build badges
  - [x] **Rank selector** on create meta — league badge (bronze … grandma) for the build
  - [x] **Submit build** — Edge Function `submit-build` + `/builds/view/?slug=`; OP → `op_requested` until owner approval (`docs/pages/create-submit.md`)
  - [x] No fake combat history on published boards (scrubber strip only when real history exists)
  - [x] Remix preload from build pages (`?remix=` → board + meta; clears OP / YouTube)
  - Placement rules vs game: [`docs/pages/create-placement.md`](pages/create-placement.md)
- [x] **Admin page** `/admin/` portal — overview, sim reports, OP / feature / hide (`docs/pages/admin.md`)
  - Edge Function `admin-builds` + `BPB_SUBMIT_SECRET` (same as submit)
- [x] **User profiles** `/u/{discord_id}/` — Discord persona + public builds; nav link when signed in (`docs/pages/auth.md`)
  - [x] **Profile polish** — Patch3 persona + Builds bands, sticker Founding/Premium flair (`js/pages/u/`)
  - [x] **Premium status on profile** — show plan / Premium flair when `profiles.plan` is paid
- [x] **OP builds linkage** — catalog + admin curation for `is_op` / `is_featured` (homepage carousel already reads `is_featured`)
  - [x] **Submit for OP UX** — Request OP label, Submit for OP review CTA, OP pending on build page; Steam owner gate later
- [x] **Legal pages** — `/legal/about/`, `/legal/terms/`, `/legal/privacy/` + shared footer (`js/shared/footer.js`)

## Create — class bags & item access rules

- [x] **Class starting bags (2 per class)** — Build-tab loadout pick required; auto-place once; may sell off board; `starting_bag_id` on draft + `builds` (`js/shared/starting-bags.js`, `009_starting_bag.sql`)
  - [x] Shared starter ids + create picker / validate / remix / submit-build
  - [x] Build page prefers stored `starting_bag_id` (fallbacks for older rows)
- [x] **Loose class access** — hard-block wrong-class Class Uniques + skills; soft-warn other-class shop items (badge sold OK). No unlocker ownership tracking. See [`docs/pages/create-item-access.md`](pages/create-item-access.md) (`js/shared/item-access.js`)
  - [x] Create drag / route slots / submit-validate + submit-build hard mirror
- [ ] **Full unlocker graph** (later / out of scope for loose v1) — `gateItem` edges, `storage_coffin` lockouts, temporary next-shop crafts

## Create page polish

- [x] **Board layer toolbar UI** — All / Bags / Items / Clear as build-page icon toggles; dimmed layer blocks hover hits
- [x] **Parked section visuals** — Patch3 shade panel (filter/Build look); mode hint line removed; chips still bare sprites
- [x] **Build board cell art** — restored original game `FilledSlot.png` (shared with catalog / build viewer)
- [x] **Run economy readout** — gold + cost/max + game Stamina Usage tier (Very low→Very high icons) on create toolbar; layer icons stay centered
- [x] **Build uploader + selector** — empty-board onboard (class → bag); drop/`history.db` → full History UI (list + bag preview + round scrubber); Load applies the scrubbed round into the create draft
- [x] **History overlay theme + layout polish** — transparent board-minus-park shell; rankingDif / league %; grouping-style filters; gold scrollbar; X close; Trophy·Watch·Heart stats; W/L strip inside Patch3; preview bag center + protrusion; Load CTA (`scripts/_test-history-picker.mjs`, `_test-history-wl-clip.mjs`)
- [ ] **Screenshot → build** — Paused for launch; implementation and research are preserved behind a default-off gate. Detail: [Create image upload documentation](pages/create/feature/imageUpload/README.md).
- [x] **Export board PNG** — button on `/create/` to download a PNG of the current backpack (sprites + bag); **Premium-only** (founding included) via shared gate / offer panel
- [x] **Why it works — item mentions** — reference items inline in notes for readers
  - [x] Drag a catalog/board item onto the notes field to insert an item chip / icon
  - [x] Type `[` then letters → dropdown under the caret with ~5 closest item matches; click (or Enter) to insert `[Item Name]` (or equivalent token that renders as icon + name on the build page)
- [x] **Text focus vs round picker keys** — while a create text field (title, notes, etc.) is focused, arrow keys move the caret in that field; do not steal them for history round scrubber / board shift
- [ ] **Essentials from socketed gems** — allow dragging a gem/item seated in an armor (or other) socket onto Needs / Wants / Good to have (e.g. Corrupted Crystal in a socket); today only free board items can be tier-assigned

## Build page polish

- [x] **Hover bug** — Girl Power highlighting: inbound tint uses distinct CanAffect cells (same as outbound stars)
- [x] **Better visuals** for upvote / downvote and Share controls (icon assets)
- [x] **More builds rail** — 3-column grid; author column matches Build Info width
- [x] **Author More builds (Hot)** — when build has `author_id`, up to 6 public builds by that author (Hot sort), OP flair, View all → `/u/{discord_id}/`; legacy/history pages keep history-JSON thumbs (cap 6)
- [x] **Round strip** — fixed slot width so triangles don’t resize when round count changes
- [ ] **Class sprite background** (optional) — character art behind stage; research game idle/pose anim if reusable
- [x] **More builds tooltips** — build preview tip (larger board + class/gold/rank) instead of item tooltips
- [x] **Gold count** — history More builds / `?run=` pages now get `gold_count` from final-board item prices
- [x] **Premium Play CTA** — rectangular Play plaque under round counter (`PlayButton.png` + `.bpb-premium-cta`); create toolbar parity
- [ ] **Share link OG / embed image** — Discord, Twitter/X, iMessage, etc. preview shows the **build board PNG** (not a generic site card). Likely needs pre-rendered (or on-demand) board images + `og:image` / Twitter card meta; static GH Pages may need **Cloudflare** (Workers / Image) or similar for crawler-friendly HTML. Wire from every Share button + canonical build URL.

## Social / history (after showcase exists)

- [x] **Likes / votes** on builds + stored `vote_score` / `build_votes`; catalog Hot/Top/Best/Rising use quality (`docs/pages/votes.md`)
  - [x] **Bind votes to auth** — Discord sign-in binds `bpb-voter-id` → `profiles.voter_key` (RPC + vote-build JWT); merge when safe. See [`docs/pages/auth.md`](pages/auth.md) + [`docs/pages/votes.md`](pages/votes.md)
  - [ ] **Vote abuse soft-guards (later)** — light rate limits on `vote-build`; optional captcha only if farming shows up (anonymous MVP is fine until auth)
- [x] **Discuss CTA** on build pages — YouTube if video, else Discord
- [ ] **Comments** on build pages (auth required)
- [x] **history.db** upload in creator → pick run → real per-round boards on scrubber (board + W/L; not shop/opponent ledger)
  - [x] Round scrubber UI under build grid (demo progressive frames until history.db)
  - [x] W/L round strip above scrubber (click to jump; demo results until history.db)
  - [x] Video step after last round + stage swap + video toggle icon
  - [x] Create-page **History overlay** — board-minus-park transparent shell; BuildEntry rows (class / league % over emblem / rankingDif / Trophy·Watch·Heart stats / key items / W/L); filter-style Class dropdown; gold scrollbar; preview bag + `previewMode` scrubber; Load = current frame; X close
  - [x] History overlay **theme + layout polish** (see Create page polish)
  - [x] Manual QA on real Steam `history.db`: class filter, long W/L strips, rankingDif vs game, old versions, gem sockets on scrub, Load mid-round vs last, Clear board re-onboard
  - [x] **Publish with history** — draft keeps attached run; submit stores `builds.history` jsonb + last-round `build_placements`; build page scrubber reads DB history (demo JSON fallback for showcase slug). Apply `010_build_history.sql` in Supabase + redeploy `submit-build`.
  - [x] **Create-page history scrubber** — when `draft.history` is set (History Load or remix of a build with history), show build-page W/L scrubber under the board (`previewMode`); board edits still detach history
  - [x] **History edit confirm** — attempting to edit while history is attached shows a board overlay (“Clear run history?”); Cancel keeps history, Edit board clears it then allows edits
  - [x] **History edit lock chrome** — soft stage veil + toolbar Unlock → existing clear-history confirm (Real → Feasible)
  - [x] **History lock chrome polish** — gold outline on locked bag (no dark veil); open-lock icon unlock control (`assets/icons/create/history-unlock.svg`); same confirm flow; scrubber + Parked untouched
  - [x] **Real builds** — attaching history marks the build **Real**; catalog filter + badge for Real vs Feasible vs Theory

## Legal / compliance

- [x] **Terms of Service** — stub at `/legal/terms/` (UGC, history uploads, conduct); footer link
- [x] **Privacy Policy** — stub at `/legal/privacy/` (votes, Supabase, no ads email yet)
- [x] **Data policy (history.db)** — covered in Privacy (what we store, retention, clear-on-unlock, contact for deletion)
- [x] **Fan-made disclaimer** — footer line + `/legal/about/` non-affiliation notice
- [x] **Monetization + IP risk** — owner **conditional go** on $3/mo tools membership; combat “matches the game” stays no-go ([`monetization-ip.md`](product/monetization-ip.md), [`sim-ip-marketing.md`](sim/sim-ip-marketing.md))

## Auth

**Shape:** **Supabase Auth** = session. **Discord** = v1 login + persona (no email/password). **Steam** = link while signed in later. **Stripe** = memberships later (see Monetization). Detail: [`docs/pages/auth.md`](pages/auth.md).

- [x] **Supabase Auth + profiles** — `013_profiles.sql`, RLS, Discord trigger, owner flag
- [x] **Discord login** — OAuth; nav Sign in / avatar → `/u/{discord_id}/` + Sign out
- [ ] **Steam login / link** — OpenID + persona; useful for history.db SteamID (link while signed in, not second signup)
- [x] Publish at Submit requires Discord; draft/create stays anonymous
- [x] **Votes ↔ account** — bind anonymous `voter_key` on sign-in
- [x] My builds filter + public profile builds list
- [x] **Legacy author backfill** — `scripts/_backfill-build-authors.mjs` linked null `author_id` seed/test builds to owner profile (`smojowastaken`) so More by / `/u/` / My builds populate
- [x] Admin prefers owner Discord JWT; `BPB_SUBMIT_SECRET` break-glass
- [x] **Nav Login plaque** — shop Inventory sign (`ui-shop-sign.png`) + “Login” (Milonga); signed-in uses same hanging sign (avatar + name + Sign out)
- [ ] Comments / richer profile stats; history.db attach prefers SteamID when available
- [ ] Mobile side-nav auth chrome (with full mobile nav pass)

## Discord integration (research)

Dedicated plan: [`features/discord-bot.md`](features/discord-bot.md) — hosting (Oracle always-free VPS), phases, setup checklist.

- [ ] **Auto-join Discord server on site Sign in?** — possible via OAuth `guilds.join` + bot in server (see the bot plan's Phase A notes)
- [x] **Discord bot — build announce** — public site builds post into the Discord builds forum (title, class, author, link, Real/Feasible/Theory, board still when saved). OG share image is still separate
- [ ] **Share link OG / embed image** — see Build page polish; crawlers need board PNG in meta (Cloudflare or similar likely)
- [ ] **Discord ↔ site comments (maybe)** — optional: messages in a build thread / under announce posts appear as site comments (or link-out only); decide sync vs “Discuss on Discord” CTA
- [ ] Bot permissions, channel mapping, rate limits, moderation

## Monetization (brainstorm — don’t block core pages)

Channel growth is the north star. Paid features likely need AI + legal green light (see Legal / IP). Come back when auth + a paid surface (e.g. sim) exist.

- [ ] Brainstorm options that don’t fight trust (affiliates / cosmetics / tip jar / membership) vs ads
- [ ] Decide “maybe never” vs a light experiment after build pages + traffic exist
- [ ] **Membership (~$2–3/mo)** — unlock “everything” (sim full runs, deeper tools, etc.). **Stripe** = source of truth (Checkout + Customer Portal + webhooks → `profiles.plan`). Supabase Auth user → Stripe Customer.
- [ ] **Discord billing? (secondary only)** — server subscriptions/roles can grant the same perk via bot sync, but don’t rely on Discord alone (smaller funnel, messier entitlements). Prefer Discord as community + login; paid role as a mirror of Stripe.
- [ ] **Premium gate UX** — when a non-member hits a premium control (Play / sim / future AI), show an upgrade prompt (dialog or soft overlay) instead of a dead click; keep free teaser path where we decide one exists
- [ ] **Upgrade CTA on promise surfaces** — clear “Upgrade to Premium” entry near premium CTAs (build Play row, create Play, sim entry) that routes to checkout / settings billing
- [ ] **Settings / billing page** — account settings with Stripe Customer Portal (manage plan, cancel, invoices); link from nav / profile when signed in — **nav + profile links shipped**; full settings page still optional
- [x] **Premium status on profile** — badge / plan label on `/u/{discord_id}/` (and own profile) from `profiles.plan`
- [x] **Profile page visual polish** — `/u/` Patch3 hierarchy + sticker plan badges (free + Premium)
- [x] **Export board PNG (Premium)** — download a PNG of the create-page backpack; free users get upgrade prompt (same gate as Play / sim)
- [ ] **Export history.db (Premium, Phase 2)** — synthetic History file from create / published build so people can practice that board in-game. Detail: [`launch-phase-2.md`](product/launch-phase-2.md). Not Phase 1.
- [ ] **Build combat stats (Phase 2)** — DPS, heal / s, max HP / s, block / s, etc. on build pages, sim, and build tips. Sim-derived, not live PvP. Detail: [`launch-phase-2.md`](product/launch-phase-2.md).
- [ ] **Character builder / pose export (Premium, back burner)** — tall order (sim-scale). Compose game character sprites from parts (head / arms / body / …), optionally hold catalog items, export PNG for thumbnails / videos. Research game part assets first; Premium-only like board PNG. Not Phase 1.
- [ ] **AI: Screenshot → build** — paid or free-tier?; backpack image → detected layout in `/create/` (vision)
- [ ] **AI: Optimize** — reorder / pack someone’s board for a more optimal legal layout (same item set or guided swaps — define scope); likely AI + rules
- [ ] **Solo combat sandbox / sim** — dummy-target board sim (`/sim/`; Band A shipped — see [`sim-phases.md`](sim/sim-phases.md) Band F). Strong monetize candidate: free short preview vs paid full 30s runs, deeper logs, save/compare sims, or membership unlock. Gate behind auth when paid; legal/IP check before selling game-like combat.
- [ ] Gate paid AI / sim behind auth; never auto-publish optimized boards as OP

## Items polish

- [x] **Disable click-hold to highlight** on the items catalog — Itemiary `user-select` / `-webkit-user-drag: none` (`backpack-grid.css`)
- [x] **Filters cut off on the right** — widened filter rail + create panel pad; buff/stack icons no longer clipped

## Create / Itemiary performance

DevTools on `/create/` showed weak Core Web Vitals mostly from full-catalog sprite load — not a mystery JS hotspot. Tackle in this order when we care about speed:

- [x] **Lazy-load catalog sprites** — Itemiary deferred `data-src` + decode warm near viewport / before AppearInLibrary; pool prewarm is geom-only (`item-pieces.js` / `item-pool.js`)
- [x] **Reserve catalog / board / nav space** — HTML nav/create shells + board 9/7 skel until mount; catalog swaps filters in place (no shell wipe)
- [x] **Production cache lifetimes** — see [`docs/features/deploy-cache.md`](features/deploy-cache.md); `npm run stamp-assets` for `?v=` stamps (GH Pages needs Cloudflare for long TTL)
- [x] **Font-display / font loading** — tooltip `@font-face` `swap`; preload Milonga + Baskerville woff2 on home/items/create
- [x] **Forced reflow audit** — Itemiary paintNow: pass viewport metrics, cull once, single appear flush, defer sprite IO (`item-pool.js` / `item-pieces.js`)
- [ ] **DOM size trim (later)** — Itemiary pool keeps many nodes; only worth it after lazy sprites if Interaction/memory still hurts
- [ ] **Image delivery polish (later)** — formats/sizes for sprites if we ever leave raw PNGs; minor vs “don’t fetch all at once”

## Nav / chrome

- [ ] **Mobile: side nav** — drawer on small screens; keep shelf/banner on desktop
- [ ] Mobile polish pass for homepage once side nav lands
- [x] Wire `/create/` for real when creator exists (link already reserved)

## Layout / responsive (deep pass)

First attempt at site-wide `zoom` / `--bpb-ui-scale` was reverted — do this properly later, not as a drive-by.

- [ ] **Deep UI scaling** — desktop sizes (1440p → 1080p / scaled Windows) so board, catalog, filters, parked, build chrome shrink **together** without crushing only the item picker; keep OptionsFont proportions
- [ ] **Mobile view** — full responsive pass for `/`, `/items/`, `/create/`, `/builds/`, `/builds/{slug}/` (beyond side nav); touch targets, stack order, filter rail, board size
- [ ] **Layout sandbox / dummy page** — wireframe page of outlined boxes for real site regions (nav, board, item picker, filters, parked, sell bin, build info rail, featured stage) to prototype scale + breakpoints before touching production CSS
  - Route lean: `/dev/layout/` or similar; not linked from public nav
  - Boxes labeled + show current breakpoint / scale readout while testing
  - Not linked from public nav
  - Match Itemiary Filter / Item Info tab chrome

## Database

- [x] `build_placements` + RLS + `priority` essentials tier + demo seeds
- [x] Builds `route_r3` / `route_r10` for guide page
- [x] Builds `starting_bag_id` (chosen class bag, even if sold)
- [x] Builds `rank` + `vote_score` shipped; rank display polish on build info rail
- [ ] Confirm items + sprites pipeline docs still match production
- [x] Wipe demo builds + retire local showcase JSON fallback (empty DB; seed real OP next)
- [ ] Seed curated real OP boards into Supabase

## Later / research

- [ ] **Patch notes page + home “Latest update”** (parked — see below)
- [ ] **Class icons** — Adventurer / Neutral-style art beyond press-kit set
- [ ] **AI endgame board drafts** (research only — see below)
- [ ] **Build quality / power score** (parked — see below)

### Patch notes (parked)

Game already ships a Patch Notes popup. Source in extract:

- UI: `tools/game-extract-full/Interface/PatchNotes.gd` + `PatchNotes.tscn`
- Version: `Game.VERSION` / `SUBVERSION` in `Core/Game.gd` (extract snapshot e.g. `1.1.7`)
- Body: **one current** BBCode blob on the RichTextLabel in the `.tscn` (EN + exported CN/JA) — **not** a full historical archive
- Shows once when local “seen patch” &lt; current version; reopen via version click

**Not auto-synced to the site.** Each game update rewrites that scene text; we only see it after re-extract. No public API.

Future modular lean (when we want it):

- [ ] Manual/curated entries in repo JSON or Supabase (`version`, `title`, `summary`, `body`, `published_at`)
- [ ] `/patch-notes/` archive page (newest first)
- [ ] Home “Latest update” band reads the newest entry (reuse promo-band chrome)
- [ ] Optional later: script that pulls BBCode from a fresh extract into a draft entry (still human-reviewed)

**Why later:** purpose is OP builds → guides → catalog; patch notes are nice meta, not a main job. Manual curation is the honest MVP — full auto-from-game is extract-pipeline work.

### Build quality / power score (parked)

Idea: a site-generated score for how “good” a build is — feasibility, how OP it is, how countable it is.

**Not for now.** Needs deep meta knowledge (items, synergies, counters, patch), which is its own product (AI +/or combat eval), not a feed badge. Keep using curated OP, tags, and votes.

Possible future ladder (only if we revisit):

- [ ] Transparent **guide completeness** proxy first (Needs, R3/R10, video, notes) — not marketed as power
- [ ] Social/curated signals wired into Hot/Top (votes, `is_op`, featured)
- [ ] Research real strength scoring later (history.db win rates, maintained ruleset, or AI) — never auto-badge OP from a model alone

### Creator tooling (build suggestions)

Helpers for `/create/` and remix — not auto-publish. Overlaps Monetization AI bullets.

- [ ] **Build suggestions** — recommend items / synergies while editing (catalog + rules; optional AI later)
- [ ] **Screenshot upload → replicate build** — see Monetization **AI: Screenshot → build**
- [ ] **Optimize board** — see Monetization **AI: Optimize** (pack / reorder; define whether item set is frozen)

### Solo board combat sandbox (`/sim/`)

Predictive fight sim — dedicated page (not bolted onto `/create/`). Aim as close to 1:1 game combat over time.

**Launch foe / avatar UX** (Dummy · Public build · Mirror; class vs profile sprites; UI first): [`launch-phase-1.md`](product/launch-phase-1.md) Sim · [`sim-product.md`](sim/sim-product.md) Core UX.

**Docs:** [`sim.md`](sim/sim.md) · [`sim-combat-audit.md`](sim/sim-combat-audit.md) · full roadmap [`sim-phases.md`](sim/sim-phases.md) (phases 1–110).

**North stars:** combat rules → **1:1 GDScript**; fight HUD → **Health / Stamina / Buffs / Debuffs**; fight log → **Combat Log + Damage Dealt 1:1** (Band Q).

#### Band A — Foundation (shipped)

- [x] **Sim page** `/sim/` — load board from create draft or `?slug=` published build
- [x] **Play entry points** — build guide action row + create toolbar → `/sim/`
- [x] **Cap ~30s demo timeline** — scrubbable time slider + event log (catalog CD/damage only)
- [x] **Board in action (demo FX)** — activation pulse + dummy damage floats
- [x] **Game file audit** + `SimEvent` contract for later engine

#### Band B — Core engine (shipped)

- [x] **`runSim()` seam** — `mode: 'engine' | 'demo'`; shared `SimEvent[]`
- [x] **Partial engine** — combat delay, tick, stamina, CD, damage/accuracy/block, pre-combat block, regen/poison, dummy AI
- [x] **Engine UI** — You + dummy HP, coverage meter, Demo/Engine toggle, `?seed=` / `?mode=`

#### Band C — Combat systems (shipped)

- [x] **Adjacency / canAffect links**, gems, armor DR + spikes
- [x] **Lifesteal, DoT/HoT, trigger priority**
- [x] **Cards / pets / consumables**
- [x] **Log filters + export run JSON**

#### Band D — Item script ports (shipped)

- [x] **Inventory extract** + `sim-item-coverage.json` + `npm run sim-harness`
- [x] **Handler registry** — basic CD, double strike, empower/haste auras, poison, start regen/HP/spikes, pets
- [x] **Coverage milestone** — ≥80% scripted or catalog fallback (see harness)

#### Band E — Product polish + HUD (shipped)

- [x] **Combat HUD 1:1** — Health / Stamina + Buffs / Debuffs stack counters (`sim-hud.js`)
- [x] **Visual fight pass** — activation rings, speed 1×/2×/4×, banner + bar art
- [x] **Save / compare runs** — localStorage summaries + delta panel
- [x] **Deep-link** — `?slug=&seed=&mode=&t=&speed=` + Copy link
- [x] **Validation notes** — [`sim-validation.md`](sim/sim-validation.md)

#### Band G — GDScript 1:1 foundations (shipped)

- [x] Handler audit appendix [`sim-validation.md`](sim/sim-validation.md)
- [x] `getP*` param wiring + `damage.js` / `stacks.js` foundations
- [x] First reviewed ports (broom, banana, poison bow, hero longsword, falcon, herbs, …)

#### Band H — Full catalog factory (shipped)

- [x] **Every combat item has a dedicated handler** — `npm run sim-ports` → 341 ids in `sim-port-registry.json` (stubs + reviewed)
- [x] Coverage tracks dedicated / reviewed / stub (`npm run sim-catalog`)

#### Bands I–P — Full catalog reviewed (shipped)

- [x] **100% dedicated + reviewed** — `npm run sim-catalog` / `sim-auto-ports` (solid patterns + `reviewed_approx` fallbacks)
- [x] Catalog staples — wooden_buckler, leather_armor, gloves_of_haste, leather_boots
- [x] Band Y Phase 134 wave 1 — buff converters (`ports-buff.js`; solidPct ≈43%, harness floor 42)
- [x] Band Y Phases 135–143 — theme ports (`ports-luck`…`ports-consumable`; harness floor **58**)
- [x] Band Y Phase 144 — outlier ports + hard deferrals documented (`ports-outliers*`; harness floor **60**)
- [x] Band Z 147–155 — temp stacks, fatigue, combat-bus, food/aura/on-hit depth + pilots (`npm run sim-band-z-smoke`; floor stays **60**, solid ~69%)
- [x] Phase **159** — HUD temp stacks (`snapshotActor.temp` + countdown chips; smoke in `sim-band-z-smoke`)
- [x] Solid patterns → 100% + harness floor ratchets — Waves A–D **shipped** (floor **100**) — [`sim-phases.md`](sim/sim-phases.md) Band AC–AE

#### Engine 1:1 leftovers (after Phase 270)

Numbered AP–AS is closed. Do **not** title `/sim/` **Engine 1:1** or flip `engine11Achieved` until these are done (and Phase 38 for public copy). Detail: [`sim-phases.md`](sim/sim-phases.md) · flags: [`sim-validation.md`](sim/sim-validation.md) · claim JSON: `assets/data/sim-engine-claim.json`.

- [ ] **Bag vs bag, then live compare** — first slice shipped: `/sim/?slug=A&oppSlug=B` (optional `oppRound`). Dummy auto-attack is off; both bags run. Smoke: `npm run sim-vs-board-smoke`. Next: fight the same two boards in-game and compare end HP / log (do **not** paste ranked HP onto dummy `live.*`). Cross-bag steal/charge still thin.
- [x] **Reaper Unhealing paramCheck** — `heal()` at full HP still unheals and now logs the Heal tab amount (`flushUnloggedHeal`); Unhealing uses `takeDamage`. `reaper-harvest` staple `paramChecks` empty. Smoke: `npm run sim-ar-milestone`.
- [ ] **Adventurer catalog-key paramChecks** — `history-3705`: Emerald poison-on-hit vs catalog `poison`; Frog Prince luck/mana vs catalog `blind`; keep FBP `item.block` vs `params.block` honest. Same smoke.
- [ ] **Chess board combat AI** — `ChessBoard.gd` has CD capture/move; sim still defers. Pieces should act when the board’s cooldown runs. List: `assets/data/sim-intentional-noops.json`. Smoke: `npm run sim-noop-audit`.
- [ ] **Phase 38 counsel** — written go/no-go on public “matches the game” / paid 1:1 combat (game art + derived rules). Stubs + marketing lock already shipped (**269**). Only then set `legal.phase38CounselReview` + `allowPublicMatchesTheGameMarketing` and re-run `npm run sim-engine-claim`.

Follow-ons (not 270 blockers, still lying around):

- [ ] **Parity band: infinite-combo dummy HP** — fixture expect max **90**, sim **95** (`sim-parity-fixtures`).
- [ ] **Wildcard dump flags** — history 3708 / 3709 / 3706 / 3704 `paramChecks` / `ui.mismatches` (Bloodthorne vamp-cap, Mecha Bat grant, etc.). `npm run sim-wildcard-boards`.
- [ ] **Shallow HAND count** — `npm run sim-ai-shallow-count` still reports a large shallow set; burn with dumps, not census %.

#### Bands U–X — Tip fidelity + spotlight ports (shipped)

- [x] **Live tip rows** — Damage / CD / Accuracy from combat mutators + stacks (no Live blurb)
- [x] **Bag insides + Fanny Pack** `addSpeed`
- [x] **Buff economy** — `useLucky` / `giveMostBuffs` / buff-change bus
- [x] **Miss Fortune, Toad, Oil Lamp** hand ports — `npm run sim-spotlight-smoke`

#### Band Q — Combat Log UI 1:1 (shipped)

Game reference: post-fight **Damage Dealt** (left) + **Combat Log** (right). Modules: `sim-combat-results.js`, `sim-combat-log.js`, `sim-damage-meter.js`, `sim-log-sentences.js`.

- [x] **97–104** Chrome, row skins, sentences/icons, You/Opponent + activations + search, log replay, meters, graph, line scrub

#### Band R — Log event fidelity (mostly shipped)

- [x] **105–108, 110** — `LOG_*` map, parent indent, activation Hide default, `npm run sim-log-smoke`
- [x] **109** — DamageMeter metric dropdown (Damage / Heal / Stam / Activations / stacks)

#### Later

- [ ] **Band F — Monetize / legal** — Phase **38** is on the Engine 1:1 leftover list; then auth gate → optional Stripe

Note: `history.db` only has boards + W/L — this is a **predictive** engine, not a replay of saved CombatLog.  
Monetization brainstorm: see Monetization → **Solo combat sandbox / sim**.

### Build attribute ratings + specialty (after sim)

**Depends on:** combat sandbox fidelity — website needs item interaction knowledge from the sim (or shared engine) before scores are trustworthy.

- [ ] **Attribute rating algorithm** — compute Bad / Poor / Medium / Good / Great / Excellent for build attributes such as:
  - DPS
  - HPS
  - Synergy
  - Block per second
  - Survivability
  - Other attributes as we define them
- [ ] **Site-side calculation** — ratings produced by the website (not hand-entered); sim runs / engine outputs should feed the math so interactions are accounted for
- [ ] **Build specialty classification** — use those ratings to tag / group builds by what they’re good at (opens specialty filters and more UI)
- [ ] **UI surfaces** — rating badges, radar/bars, specialty chips on build pages / catalog / homepage (design after the numbers exist)
- [ ] **Timing** — do this **after** the simulator page is solid enough that combat math is reliable; do not ship misleading “Excellent DPS” labels early

### AI endgame build drafts (research)

Goal: propose **last-round / endgame boards** that synergize — not full shop routes. OP badge still human-approved.

- [ ] Inspect local battle history (game AppData) — fields / viability
- [ ] Catalog-only drafts — legal boards, not reliably good alone
- [ ] Seed from known OP builds — few-shot from featured boards
- [ ] Optional private history mining — your wins only
- [ ] Positioning — draft/remix helper; never auto-publish as OP
- [ ] Skip for v1: full combat engine / route AI — see **Solo board combat sandbox** above (community history upload is in-product now)

### added by me
- [ ] **Phase 1 public launch** — founding 50 Premium forever, Stripe, Discord roles, light blobs: [`docs/product/launch-phase-1.md`](product/launch-phase-1.md)
- [ ] some form of a promotion for free premium for first x users (see Phase 1 founding 50)
- [ ] funded contest for specific build type with prize money. event system arqitecture would have to exsist, voting system ect. discord tags, on website tags, discount off website ect. — Phase 2 Events hub: [`launch-phase-2.md`](product/launch-phase-2.md)
- [ ] **DPS Stone Phase 2:** auto `history.db` → dummy score → leaderboard; then **top‑3 highlight video** from those boards — [`highestDPS.md`](pages/events/eventIdeas/highestDPS.md) (needs accurate sim)
- [ ] **Create filters: Alt-click = only this** — Alt-click a filter (rarity / shop / crafted / gated / etc.) to select that one alone (clear the rest of that group)
- [ ] **Builds reverse / forward** — game-style back and forward buttons on build pages (round / history navigation like the in-game UI)
- [ ] **Create drag lag** — fix the slight delay when moving items (board ↔ board and Parked ↔ board) 
