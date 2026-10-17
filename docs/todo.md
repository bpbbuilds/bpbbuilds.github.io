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
- [x] **Votes ↔ account** — voting now requires a signed-in account; server-side account limits prevent anonymous voter-key manipulation
- [x] My builds filter + public profile builds list
- [x] **Legacy author backfill** — `scripts/_backfill-build-authors.mjs` linked null `author_id` seed/test builds to owner profile (`smojowastaken`) so More by / `/u/` / My builds populate
- [x] Admin uses owner Discord JWT; browser access never receives a shared secret, and the build-submit shared-secret fallback was removed
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
- [x] **Membership (~$2–3/mo)** — Stripe Checkout, Customer Portal, verified webhooks, and `profiles.plan` entitlement are shipped; Stripe remains source of truth
- [x] **Discord billing? (secondary only)** — Discord Premium roles mirror website entitlement; Discord does not grant paid access on its own
- [x] **Premium gate UX** — premium controls show the shared upgrade prompt rather than a dead click
- [x] **Upgrade CTA on promise surfaces** — Premium upgrade entries route to checkout from the supported Play/export surfaces
- [ ] **Settings / billing page** — account settings with Stripe Customer Portal (manage plan, cancel, invoices); link from nav / profile when signed in — **nav + profile links shipped**; full settings page still optional
- [x] **Premium status on profile** — badge / plan label on `/u/{discord_id}/` (and own profile) from `profiles.plan`
- [x] **Profile page visual polish** — `/u/` Patch3 hierarchy + sticker plan badges (free + Premium)
- [x] **Export board PNG (Premium)** — download a PNG of the create-page backpack; free users get upgrade prompt (same gate as Play / sim)
- [ ] **Export history.db (Premium, Phase 2)** — synthetic History file from create / published build so people can practice that board in-game. Detail: [`launch-phase-2.md`](product/launch-phase-2.md). Not Phase 1.
- [ ] **Build combat stats (Phase 2)** — DPS, heal / s, max HP / s, block / s, etc. on build pages, sim, and build tips. Sim-derived, not live PvP. Detail: [`launch-phase-2.md`](product/launch-phase-2.md).
- [ ] **Character builder / pose export (Premium, back burner)** — tall order (sim-scale). Compose game character sprites from parts (head / arms / body / …), optionally hold catalog items, export PNG for thumbnails / videos. Research game part assets first; Premium-only like board PNG. Not Phase 1.
- [ ] **AI: Screenshot → build** — paid or free-tier?; backpack image → detected layout in `/create/` (vision)
- [ ] **AI: Optimize** — reorder / pack someone’s board for a more optimal legal layout (same item set or guided swaps — define scope); likely AI + rules
- [x] **Solo combat sandbox / sim** — dummy-target board sim (`/sim/`; initial sandbox and engine shipped — see [`sim-phases.md`](sim/sim-phases.md) Band F). Future monetization, auth gating, and legal/IP review remain separate follow-up work.
- [ ] Gate paid AI / sim behind auth; never auto-publish optimized boards as OP

## Items polish

- [x] **Disable click-hold to highlight** on the items catalog — Itemiary `user-select` / `-webkit-user-drag: none` (`backpack-grid.css`)
- [x] **Filters cut off on the right** — widened filter rail + create panel pad; buff/stack icons no longer clipped

## Create / Itemiary performance

DevTools on `/create/` showed weak Core Web Vitals mostly from full-catalog sprite load — not a mystery JS hotspot. Tackle in this order when we care about speed:

- [ ] **Page CSS bundles** — add one CSS entry per page and a production bundle/minify step so each page loads one deduplicated stylesheet rather than several `<link>` files. Do not use chained runtime `@import` as the performance solution.

- [x] **Lazy-load catalog sprites** — Itemiary deferred `data-src` + decode warm near viewport / before AppearInLibrary; pool prewarm is geom-only (`item-pieces.js` / `item-pool.js`)
- [x] **Reserve catalog / board / nav space** — HTML nav/create shells + board 9/7 skel until mount; catalog swaps filters in place (no shell wipe)
- [x] **Production cache lifetimes** — see [`docs/features/deploy-cache.md`](features/deploy-cache.md); `npm run stamp-assets` for `?v=` stamps (GH Pages needs Cloudflare for long TTL)
- [x] **Font-display / font loading** — tooltip `@font-face` `swap`; preload Milonga + Baskerville woff2 on home/items/create
- [x] **Forced reflow audit** — Itemiary paintNow: pass viewport metrics, cull once, single appear flush, defer sprite IO (`item-pool.js` / `item-pieces.js`)
- [ ] **DOM size trim (later)** — Itemiary pool keeps many nodes; only worth it after lazy sprites if Interaction/memory still hurts
- [x] **Image delivery polish** — Items catalog sprites now have committed 1x/2x WebP derivatives with proportional fallback sizing for unmeasured source sprites; PNGs remain available to full-resolution board/export consumers.

## Nav / chrome

- [x] **Mobile: side nav** — drawer on small screens with a dedicated large avatar/blob footer; desktop shelf/banner remains separate
- [x] Mobile polish pass for homepage once side nav landed
- [x] Wire `/create/` for real when creator exists (link already reserved)

## Layout / responsive (deep pass)

First attempt at site-wide `zoom` / `--bpb-ui-scale` was reverted — do this properly later, not as a drive-by.

- [ ] **Deep UI scaling** — desktop sizes (1440p → 1080p / scaled Windows) so board, catalog, filters, parked, build chrome shrink **together** without crushing only the item picker; keep OptionsFont proportions
- [x] **Mobile view** — responsive pass shipped for `/`, `/items/`, `/create/`, `/builds/`, `/builds/{slug}/`, and Events: touch drag, filter drawers, build-card layout, nav, and board/grid sizing
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

- [ ] **Item ideas page** — a public page for player item ideas, the same pile as the Discord item-ideas forum. Not built.
- [ ] **Patch notes page** — archive + home “Latest update”; backlog and new-note matching from [BPBのビ](https://www.univ-bpb.tech/) (see below)
- [ ] **Class icons** — Adventurer / Neutral-style art beyond press-kit set
- [ ] **AI endgame board drafts** (research only — see below)
- [ ] **Build quality / power score** (parked — see below)

### Patch notes

Game popup only keeps the **current** note, not history. Source in extract:

- UI: `tools/game-extract-full/Interface/PatchNotes.gd` + `PatchNotes.tscn`
- Version: `Game.VERSION` / `SUBVERSION` in `Core/Game.gd` (extract snapshot e.g. `1.1.7`)
- Body: **one current** BBCode blob on the RichTextLabel in the `.tscn` (EN + exported CN/JA)
- Shows once when local “seen patch” &lt; current version; reopen via version click

Each game update rewrites that scene text. We only see it after re-extract. No public API.

Historical backlog: [BPBのビ](https://www.univ-bpb.tech/) (Japanese fan site). Its home page lists patch notes from ver1.1.1 through ver1.1.9, plus a balance-adjustment note. Use those pages to fill our archive. Do not copy the site’s wording wholesale; store version, date, and a short summary, and link the source.

- [ ] Curated entries (`version`, `title`, `summary`, `body`, `published_at`, source URL) in repo JSON or Supabase
- [ ] Backfill from [BPBのビ](https://www.univ-bpb.tech/) patch-note list (ver1.1.1 → current)
- [ ] `/patch-notes/` archive page (newest first)
- [ ] Home “Latest update” band reads the newest entry (reuse promo-band chrome)
- [ ] **Automatch new notes** — detect a new version on BPBのビ and/or a fresh game extract, match it to a version we do not have yet, and open a draft entry for review (not a silent publish)

**Why later:** purpose is OP builds → guides → catalog; patch notes are meta, not a main job. The fan site is the history the game files do not keep. Auto-match should draft, not publish.

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

- [x] **Source-backed item parity audit** — generated Admin item/mechanic dashboard, strict `verified_1to1` evidence rules, and focused regressions are shipped; the current retained item verdict is 451 / 519, with the remaining queue intentionally still listed below.
- [x] **Truthful sim coverage chip** — `/sim/` now reports verified source-backed item proof for the current board instead of treating any registered handler as 1:1 coverage.
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
- [x] **Phase 1 public launch** — founding Premium, Stripe, Discord-role mirroring, and light blobs are shipped (founding cap is currently 10; see [`docs/product/launch-phase-1.md`](product/launch-phase-1.md))
- [ ] some form of a promotion for free premium for first x users (see Phase 1 founding 50)
- [ ] funded contest for specific build type with prize money. event system arqitecture would have to exsist, voting system ect. discord tags, on website tags, discount off website ect. — Phase 2 Events hub: [`launch-phase-2.md`](product/launch-phase-2.md)
- [ ] **DPS Stone Phase 2:** auto `history.db` → dummy score → leaderboard; then **top‑3 highlight video** from those boards — [`highestDPS.md`](pages/events/eventIdeas/highestDPS.md) (needs accurate sim)
- [ ] **Create filters: Alt-click = only this** — Alt-click a filter (rarity / shop / crafted / gated / etc.) to select that one alone (clear the rest of that group)
- [ ] **Builds reverse / forward** — game-style back and forward buttons on build pages (round / history navigation like the in-game UI)
- [ ] **Create drag lag** — fix the slight delay when moving items (board ↔ board and Parked ↔ board) 

- [ ] when user enters event, get dm from bot basically saying thansk for entering. your entered build is private until the event ends. However you can still view it on the website in the builds page, profile page, events page. Only your able to see your build on these pages until the event is over.
- [x] Broken image for discord image on website — failed Discord CDN avatars now fall back to initials or the existing empty state.
- [ ] Creating a universal cusor and scroll bar
- [x] PREMIUM popup during popup needs to make other sections of the website not interactable. Other page layers are now inert and pointer-blocked while the shared offer is open.
- [x] New design for the premium pop up to make it less ugly — reset-button-inspired Premium offer treatment is shipped.
- [ ] Loading screen over skeletons
- [ ] 1080p screen fixes
- [x] Tool tips for builds, cosmetics, and items size be dynamic with screen size
- [ ] Build page scroll on filters tab
- [x] Move search bar to the top of filters — Create-only Filter tab order now places Search before Grouping and keeps Debuffs last.
- [x] Create a bag button to auto fill board with default bags
- [x] Disable the ability to move items into the build info without having a item in the build grid — item-derived Build Info edits are guarded until the board has an item.
- [x] Require items in the needs, wants, good to have — client and submit-build validation require one item in each tier for every submitted build.
- [ ] I items to be dynamic with page size and weary of the nav section
- [x] Time melting item import also make sure star items works — audited against `TimeMelting.gd`/`Item.hasInventoryDuration()`: named duration targets such as `dur_stun` now light correctly and share the simulator's prepared duration multiplier.
- [ ] Import stone cosmetic item and link it to the reward for the stone dps event
- [ ] Make the nav dynamic with screensize so 1440p looks same on 1080p ect.
- [x] Reduce size of mouse pointer and make it dynamic with screensize — desktop follower is viewport-scaled; mobile and text cursors remain native.
- [x] Make rule that anytime any visual code is altered or changed keep in mind othe rscreen sizes and make the change compatible with that
- [ ] Premium stats and filters for sim dps, hps, bps, maxhpps
- [x] disable liked and my builds on builds page for non logged in users — hidden from anonymous users across Builds, profile Builds, and the simulator build picker; event-detail “View my entry” is auth-gated.
- [x] non logged in user tries to upvote prompt sign in module — anonymous votes open the shared sign-in confirm and resume the requested vote after OAuth.
- [ ] admin only page for preset website elements that can be reused across the page
- [ ] chang i on rings to be in the top right corner of the rings. stays int he top right regardless of rotation. the design of the i is the same design used on the one next to the submit button
- [x] use different icon for the create default bag button — backpack asset with a fill/add badge and clearer accessible label shipped on `/create/`.
### plugins to download
- [ ] superpowers
- [ ] kaparthy skills
- [ ] i have adhd
- [ ] claude octopus
- [ ] supabase plugin
- [ ] oh my claude code
- [ ] chome dev tools mcp
[x] preset button design — default-bag control now uses the game backpack icon with a gold fill/add badge instead of the lock-shaped SVG.
[x] button remove the box shadow but show it on hover instead — Shared preset buttons keep the inner yellow ring visible and show the outer yellow ring/depth shadow on hover.
[x] user hovers over build animation user is able to hover over the items instead of the bags, item tool tips, star slots ect. will show — Home Player Info build animation now exposes item/gem tooltips, rarity markers, affect slots, and hover sparks while preserving pause-on-hover.
[x] add remix build button which will be blue — Home build animation now shows a smaller blue Remix action beneath the primary Create button and points it at the active build.
[x] choose hero section is scroll able — Choose Your Hero now hides its scrollbar and supports click-drag/touch horizontal scrolling without stealing normal card or bag clicks.
[x] Change all buttons on homepage to new preset — Featured, Create/Remix, Explore Items View Items, and Curated Builds controls now share the responsive pill preset with crimson, blue, forest, and gold variants, one consistent hover treatment, an always-visible inner rim, and a hover-only outer shadow; Explore Items category tabs retain their original flat yellow text treatment.
[x] add potion lines animation for the potions — live create/sim boards now mirror the extracted PotionConnector affected-cell rule with a reduced-motion-safe filled blue triangle, and flattened board stills render the same connector statically.
[x] change footer buttons to use new preset buttons
[x] fix the home page footer situation, believe it is caused by the drop shadow on the footer section, remove the drop shadow and make it where it respects the dip thats on the footer
[x] home page background loads as different background until fully loaded, suspects is a fallback background thats being shown — The static Night frame and a paused windmill now paint together on first load; the windmill starts spinning only after both mask assets are ready.
[x] for the build tool tip show a alt button with play icon, when pressed will animated the build tool tip to show board animation — Build tooltips now replace the cached still with a no-stats, simulator-driven activation/cooldown preview; the visible Alt keycap activates it without moving the pointer, bags stay static, and the indicator is centered on the board's top-right corner.
[x] increase the size of the nav on 1080p screens by 15% — Shared desktop nav now eases a 15% density boost into the 1080p tier while preserving the 2560×1440 reference and separate mobile navigation.
[x] text hover for hyper links is yellow, mainly used for like hovering over someens profile name — Shared text links now use the navigation Patches gold (`#eac914`) on hover.
[x] some reason the top part of the items page is not clickable on 1080p screens, like the first row of items, the grouping section — The fixed navigation host no longer captures clicks in its transparent overflow area; the Items grouping controls and first row remain reachable at 1080p.
[x] cursor indication of being clickable needs to be updated on the items page — Items catalog hit pads, filter controls, recipe items, and responsive filter-drawer controls now fall back to the native pointer cursor; disabled filter options retain the default cursor.
[x] items page when clicking on a item and the item showcase appears, the tool tip that appears needs to be module with page size. currently it looks fine on 1440p screens but way too big on 1080p, also should respect the boundaties of the "builds with this item" section, and the nav bar — The locked item tooltip now scales and clamps to the live space between the navigation and Builds using this item panel across desktop sizes.
[x] all sections of the item showcase module on the item page when item is clicked needs to be modular to page size — The focused item, recipe panel, and Builds using this item strip now share the 2560×1440 desktop composition scale, with the existing stacked mobile layout preserved.
[x] on the item showcase module, the module that appears when you click a item on the items page, for the hover effect used when hovering over the combination items, and the builds using this item section, use a different hover effect. — Recipe items now scale and brighten slightly; build cards lift, scale, and brighten without the old outline or gold glow.
[x] On the builds using this item section, update the scroll bar to be our signature scroll bar preset that we use — The horizontal Builds using this item strip now uses rotated derivatives of the shared image-based signature track/thumb, with hidden scrollbar buttons and a standards fallback.
[x] reduce the height of the slim footer — Slim footer padding now keeps the content gap equal above and below the usable page area, while preserving the desktop frame clearance and safe-area padding.
[x] remove the potion animation on the items page, only static image for the potions — Items catalog and clicked-item spotlight art now opt out of live layers and use the static WebP catalog derivatives; Create/Sim/Home placed boards retain their live-art behavior.
[x] the item combinations section needs to respect the nav section and the builds with this item section — The clicked-item combinations panel now uses the live navigation/Builds safe bounds, including a relayout after asynchronous Builds data appears; verified at 1440p, 1080p, short desktop, tablet, and mobile sizes.
[x] builds page remove the black background from the line items on all view, and implement the darked shadow background instead. — Builds card, compact, and grid listings now use the Items page's responsive Patch3 dark shade with transparent surfaces.
[x] create a new tags visual preset that will be #(tagName) and for the background of the tags it will use that same scribble background that is used on the items page filters such as the common, rare, epic, ect. filtering options, they have that scribble background. id like to use that same background for the tags, and the color will change depending on the tags category. So OP tag is a different category of tag then tags for events, regular tags, ect. For the background i believe its a image which might not be the best performance wise, might be best to convert the image to a svg and/or creating a css version of the background if the css version is 1:1 of the image or close to 1:1. Tags are also clickable with a hover effect, clicking the tag will take use to the builds page with that tag auto applied for filtering — Builds now render hashtag links with category-colored Patch3 scribble plates, responsive hover/focus affordances, and Builds `tags=`/`event=` filter navigation.
[x] for the filtering section on all pages that have the filters section i think we should create a preset filtering section so they all basically look the same visually. reason being im noticing the background of the filtering section on the items page is different then that of the builds page. The one of the items page is the one that is correct, so lets page a filters page preset and use the items page filtering panel as the base for the preset, and then apply that preset to all pages that have a filtering panel/section — Added the shared Items-derived `bpb-filter-preset` with the Patch3 section-band surface to Items, Builds, Create, Events, Admin, Sim, and profile filter rails; page-specific layout and drawer behavior remain intact.
[x] For the builds page filtering section for the tags, can utilize columns for this section, similar to that of the items page, like a 2 column situation, along with the background thats used for each of the filtering tags like op, feasible, theory ect. — Builds Tags now use an Items-style two-column responsive grid with category-colored Patch3 surfaces matching the build-card hashtags.
[x] on the builds page filtering section we have two section at the bottom, one filtering for the class and another filtering for the rank. We can possibly use the same visual method thats used on the items page for this, For example the way the items page filtering section for the buffs, and class of item. How the buffs is a 3x3 grid stle and the class of item is a 1 row style. only IF this makes sense, i think it makes sense on the items page because of the extra filtering with the shop items, crafted items, gated items. The builds page lacks that unless we add extra filtering for that. Maybe instead of a drop down for the events we can add the check marks for the events and use that as the additional filtering so it makes more sense. — Builds now show hero classes in one Items-style icon row, league ranks in a readable four-column grid, and the event selector as checkmark controls while preserving the existing filter state and URL semantics.
[x] on the builds page, in card view only if the users cursor is hovering over a card, use will see a element appear on the top right of the builds view section which will be the alt + play icon. if a use holds down the alt button the builds animation will play. — Builds card view now reveals a responsive Alt + Play indicator on hover and replaces the original board host with the shared simulator-driven activation/cooldown preview while Alt activates it; bags remain static and compact/grid views remain unchanged.
[x] On the builds page, the nav section seems to be larger than the visual nav which is overlapping over the contents of the page making that content unclickable, fix this and make sure its fixed on every page, considering this is a nav problem and not a page problem i assume fixing the nav will fix this on every page — Verified the shared transparent `#site-nav` host and interactive `.site-nav-shell` across all 18 nav-bearing pages; content hit-tests pass at desktop, 1080p, short desktop, tablet, and mobile sizes.
[x] on builds page for the scroll bar add some left padding/margin/spacing so it separated itself from the contents slighyly — Added responsive inline-end spacing to the Builds feed scroll container so cards no longer touch the scrollbar track; existing scrollbar chrome and scrolling remain unchanged.
[x] on the builds view page make the sections/contents on the page modular, the page looks good on 1440p however on 1080 user has to scroll to see full contents — Builds view now scales its complete desktop composition from the 2560×1440 reference, keeping the author rail, board, controls, and info rail in proportion while leaving shared nav/footer and stacked tablet/mobile layouts unchanged.
[x] on builds view page remove the justify content space between that is on the header/tag section. — Removed the forced `space-between` distribution so the title and tags stay naturally grouped across desktop and stacked layouts.
[ ] on the builds view page for the user info section add a little space between the users blob/pfp and their name
[x] on the builds view page increase the size of the creators pfp/blob by 50% — Creator avatars/blobs are now 50% larger at the desktop reference size and in the stacked tablet/mobile layout, while preserving their circular shape and responsive composition.
[x] on the builds view page lets add a feature where when a user click and holds on the rounds and drags the cursor to the left or right itll change the contents of the build to the contents for that round so it looks like the round picker changes the contents on the page as the user is click and holding on the rounds picker. For this, remove the appear and disappear animation the items/bags have. — Build view round results now support click-and-hold horizontal pointer scrubbing, with immediate board swaps and no item/bag appear wave during round changes; normal clicks and keyboard arrows remain available.
[x] Found a bug on the builds view page, when i hae round 1 picked and then i use the back arrow, the text hcanges to round 18/18 however the picker doesn't highlight round 18 and the build view section doesn't show the round 18 build — Previous navigation now wraps to the final history frame, keeping the label, selected picker triangle, and Build-view board synchronized.
[x] On the builds view page on the section for more by creator, for the grid id like for this to be modular depending on page size so it looks better on smaller screens. looks fine on 1440p screens however on 1080 builds are touching each other so might be better to do 2 columns instead of 3, add spacing between the builds, or make builds visually smaller. They are already super small so id prefer the other two options, you can choose whichever one youd believe to be better — The More by creator rail keeps three columns at the 1440p reference and switches to a spaced two-column layout at 1080p, short desktop, tablet, and mobile widths.
[x] On the builds view page for the build info, as you know users are able to place items in this area on the creator page which shows up here. When users are on th builds view page they can use their cursor to hover over the items for their item tool tips. For that tool tip as it gets closer to the edge it gets smaller, instead of this i believe it would be better for the tool tip to just appear on the left side of the cursor so it can retain its size vs getting smaller and ultimately unreadable if its too small. — Build Info item tooltips now prefer the left side of the hovered item, preserving full desktop scale near the right edge while still clamping safely on narrower screens.
[x] For the builds view page on the build info sometimes the item tool tip is so big that it will appear off screen noticibly at the bottom, to combat this make it respect the footer, bottom of screen, and the pages border so itll adjust its size to accomidate for these. — Build Info item tooltips now use live Build-view frame/footer bounds and scale/clamp oversized cards into the available safe area.
[x] New preset divider, we currently use a diver thats used on the item tool tips. Seems like depending on the rariety of the item, i say the different dividers can be considered their own presets or elements so that we are able to reuse them on other parts of the website. First part being used on build info, when it comes to this im not sure if they are images or not, if they are id prefer the presets we use be css elements due to css being easier to use in multiple places vs a image of a diverder, Going this route try to create the css divider as close as possible to the images. If they are already css elemnts thats even better. Id like you to alter the build info sections dividers to utilize the gold divider. Builds info seems to have 4 different divers already, so just replace those 4. — Added reusable CSS divider presets with rarity color variants, applied the gold vertical preset to all four Build Info live/loading divider instances, and cache-busted Build view/History.
[x] I would like for you to do another audit over the game, this audit will be over the visual design the game has for its bags when the bag has synergy with a item that is currently being held by the player. I would like to take that design and implement it across multiple pages. First page being the create page, when a user is holding a object that have synergy with a bag, that bag will have its synergy indicator active, just like how it happens in the game. — Audited the extracted BagBorder.gd behavior and verified Create mirrors compatible 1.3×, hovered 2.5×, per-bag border assets/tints, incompatible hiding, drop cleanup, and visible fabric coverage.
[ ] I have a feature that would be pretty neat to implement on the build view page, Which is a slight version of the simulator. Essentially the build that the user is view will be simulated, So the animations of the items will play and all of the effects of the items will be working and active just like the sim. The idea is that this will simulate up to 20 seconds. Right above the build the user will have simulator options such as a scrubber, and a play button that combos as a pause button. The idea is on page load this wont auto play, user has to press the play button for it to simulate. Up to 20 seconds. For this simulation the build wont actually be going against an opponent like the actual simulator does. As an addition to this the simulators stats for this build will also be displayed on this page, The idea is that on build info we add a new header to the right of build info, it will have slightly lower opacity than build info. Build info header will still be centered and "Build Stats" will be to the right of it, when a user click it, it will now be centered and build info will move to the left and become less opacity. By doing this we can alter the contents that shows in the info section. Build info stays the same however build stats will show additional stats about the build. Main ones will be build score. The build score is basically a score depicting how good a build is. Im not sure how this score will be calculated, but for now it could just be taking the dps, hps, bps adding them together and dividing it by 3 and maybe adding more weight to the dps cause its more important. But yeah the build stats will show that score along with the individual amounts of the dps(damage per second), hps(heal per second and health gained per second), and bps(block gained per second). Further more it can also show the amount of buffs that was gained at the 20s mark, and debuffs influcted at the 20s mark. Further more when it coems to these numbers i think it would be nice to see them grow overtime as the sim simulates, because remeber its from 0-20s and we have that scrubber so the number effectivly should change as the battle goes on. for the battle stats this should be a premium member only feature. So for non premium members they can still use the scrubber and the items would still simulate so they see the animatiosn and such, they will also be able to see and click on the build stats stab. however when they go to the build stats tab the values of the numbers will be encrypted for them. For this i am in favor of using the minecraft enchanted font, i think that would be really cool. Further more i tihnk it would also be really cool if the text changes values every x seconds so it really look encrypted. And somewhere on the tab we can show like Becoming a premium member to unlock this feature. Now because implimenting this would be allot, i am in favor of creating a md file for this feature and planning its implimentation before we fully impliment it.
[x] When it comes to the prismatic orbs, on the item tool tip for this item it should should the amount of items that fall into each of its sections. Do a game audit on the item tool tips of this item in the game and see how the game handles it so we can fully impliment this for its item tool tip. — Audited `RainbowOrb.gd`: Magic, Vampiric, Holy, and Dark counts now render in the Items tooltip from the full catalog, while Create/Sim tooltips retain affected-board counts using the same game-shaped parenthetical format; counts follow the game's primary/extra type rules and ignore custom tags.
[x] On the user page for the inventory tab when a user is hovering over the items, for the cosmetic tool tip it appears that the tool tip has a large amount of shadow arround it. im not sure if its only happening on the user page or on other pages as well however i would like for this to be fixed. — Cosmetic tooltip hosts now use the game frame without the extra floating-card drop-shadow across profile inventory and other cosmetic-tooltip surfaces; ordinary item tooltips retain their shadow.
[x] On the user page in the inventory tab when it comes to the filters panel for the view section we currently have a check mark for the blob, instead of a check mark can we make it a on/off switch. the the ones with the circle that just moves to the left and right to represent on/off, i think it would be cleaner, for this i think we keep the same design theme we have going currently utilizing that green and artstyle for the squares. — Inventory View now uses an accessible Patch2-shaped green switch with a sliding cream thumb for Blob previews.
[ ] For the users page sections for all tabs id like to go ahead and make this page modular so it looks the same universally regardless of screen size except for mobile screens. so 1440p screens look good, thatll be our basis, However for 1080 currently users have to scroll on the builds page due to the filtering section being too large i think its due to it not being modular.
[ ] For the builds page i think what id like more is instead of that section being scrollable, lets make the page itself scrollable and while scrolling the filters section is sticky and the contents of the page just scrolls. This currently happens on the users page on the builds tab, i think id like the same concept to applpy on the builds page, i believe this would looko better.
[ ] For the create page i think i would like to move the location of the trashcan, right now its on the bottom right side but that kinda sucks because the filter section is on that side and we have to reduce the height of it to make room for the trashcan. So what it would like to do is move the trash to the left bottom side of the screen to be to the left of parked and under the build creator. We will probably have to reduce the size of the trash so it can fit there which is fine, and lets reduce the length of the parked area to accomidate for the trashcan. And now that its moved lets extend the length of the filter section all the way down so it lines up with everything else.
[ ] When it comes to the trashcan i would like a new highlight that happens when a user is hovering a item of it. currently we have that yellow outline that shows over the trashcan and the item. Instead i think it like for the item to have a red tint and for the trashcan to just increase in brightness. i think this would be better.
[ ] For the parked section i think we need to increase the size of it from 18 to 60, and add some bottom padding or margin to the section or to the scroll bar because the scroll bar seems to crop the contents thats in parked and thats just looks bad.
[ ] For the create pages parked sections scroll bar lets update that to our signature scroll bar preset so its consistent with the rest of the website.
[ ] For the create page, for the puzzle bag of love item it seems that its boundaries are a 2x3, like for the highlighting and like when your moving the item or trying to grab the bag basically. Not when your placing a item on the bag but the boundaries of where the bag is clickable is a 2x3. As you know the bag is an irregular shape so this issue needs to be fixed. And could you double check all of the bags to make sure the problem is fixed for those bags as well, thanks.
[ ] For the parked area, because a user can have allot of items inside of their parked section, i would like to impliment a module that a user is able to open that will be a larger view of their parked section. Next to the trash icon thats on the parked section lets add a up arrow which will indicate basically opening in a larger view, when clicked a module will appear on the page right in the center of the page, when it appears everything on the bag will become darked except for the build creator and the trash can, the user is then able to drag items like normal from the parked to the build creator or the trash can.
[ ] On the create page for the item catalog section, some of the items clip off on the left and right side can we make it where its ok if the item clips through that?
[ ] For the premium module that shows the benefits of premium and the founing members module can we update the buttons on there to be our preset buttons
[ ] Add version numbers as a filter on the builds page along with on the buidsl view page
[ ] On sim add a setting that can enable or disable coverage markers. A coverage marker is a check or x that will be placed in the top right corner of every item on the board, not bags. Itll specificy weather that item is 100% verified and 1:1 with the game or not.

## Planned feature specs

- Build-view simulator: [design spec](superpowers/specs/2026-10-16-build-view-simulator-design.md) and [implementation plan](superpowers/plans/2026-10-16-build-view-simulator.md). Implementation has not started.
