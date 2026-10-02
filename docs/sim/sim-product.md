# Sim product vision (`/sim/`)

North star for the **paid combat sandbox** — UX, trust, and community loop.  
Engine fidelity detail stays in [`sim.md`](sim.md), [`sim-phases.md`](sim-phases.md), [`sim-debug-protocol.md`](sim-debug-protocol.md).  
Launch gate checklist: [`launch-phase-1.md`](../product/launch-phase-1.md) → Premium → Sim.

---

## Positioning

| Sell | Do not sell |
|---|---|
| Predictive **testing grounds** for bags (dummy / bag-vs-bag / mirror) | “1:1 replay of your ranked fight” |
| Game-feel Combat Log, meters, HUD, VFX where we can | Guaranteed parity with every live patch |
| Fast theorycraft + Premium polish | Silent black-box when an item is wrong |
| Community reports that ship fixes | Waiting for 100% alone before charging |

**Price intent:** ~$3/mo Premium hook (with founding). Worth it if the sandbox is useful, honest, and visibly improving — not if it claims to replace the game’s combat.

**Trust rails (always on in product UI):**

- Coverage / “not fully scripted” when items are thin
- Honest copy: predictive, seeded RNG, not history.db CombatLog replay
- **Report mismatch** → admin queue (permalink + debug JSON + notes)
- Optional public “known gaps / recently fixed” strip

---

## Design direction — testing grounds

This page is **not** parchment-journal chrome. It should feel like a **lab / proving ground**:

- **Surface:** pure white → light grey gradient; **math-paper grid** (faint ruled lines)
- **Depth:** soft 3D room cues (floor plane, subtle walls/corners, light falloff) — “you’re standing in a test chamber,” not a flat SaaS card stack
- **Combat UI:** match the **game** as closely as practical (log, meters, bags, characters, number popups); parchment tokens only where shared site chrome (nav/footer) requires it
- **Simple vs Advanced (later):** optional toggle — see [Simple / Advanced view](#simple--advanced-view-deferred) below. **Current ship:** one layout; run details (seed, permalink, export) stay visible.

Exception to site-wide parchment rules is **intentional** for `/sim/` only. Do not “fix” this page back to leather journal without an explicit product change.

---

## Modes

### Current ship (no toggle)

One layout: fight stage, scrubber, HUDs, log/meters, script-coverage chip, and run details (seed, permalink, copy/download report). Good enough until **Advanced** surfaces exist.

### Simple / Advanced view (deferred)

**Not Phase 1.** Revisit when we have real “advanced-only” UI to show — not just hiding what’s already there.

| Mode | Intent |
|---|---|
| **Simple** (default when toggle lands) | What we ship today: clean fight + log/meters; minimal chrome |
| **Advanced** | Simple **plus** extras we haven’t built yet — live stacks, heal amp, vamp limits, fireT / CD remainders, param / HUD mismatch hints, richer coverage detail, etc. |

When implemented: toggle in UI, `localStorage` preference, optional `?advanced=1` deep-link. **Do not** add the toggle until Advanced has something worth showing beyond today’s run-details bar.

---

## Core UX surfaces

**Scope:** `/sim/` only — not create.

### Stage

- Two sides: **you** and **foe** (dummy, public build, or mirror)
- **Avatars** under each bag at combat-character scale; weapons/procs can later show **damage numbers** and short **hit/react** motion on the character
- Bags with game-like cells; activation rings / flashes where we already have them (dummy mode: you-board only)
- Bag tool strip (sword / bag / film) stays **where it is** — not part of the avatar/foe side rails

### Side rails (avatar + foe chrome)

**Target UX** (supersedes opp-column Dummy / Public build / Mirror **tabs** and under-sprite Class / Profile **pills** once shipped). Mode switches still remount the opp board in place (no full page reload).

| Rail | Placement | Contents |
|---|---|---|
| **You** | Vertical column **left of your sprite**, with a clear gap from the sword / bag / film tools | **Person** icon + empty placeholder slots for later |
| **Foe** | **One opponent icon** **right of the foe sprite** | Opens Dummy / Public build / Mirror (not a permanent three-icon stack) |

**You — person icon**

- Click → popover toward the sprite with two choices:
  - Board **class** sprite (`classCharacterPath` → `assets/characters/char-*.png`)
  - Signed-in **equipped profile** (blob → else Discord `avatar_url` via `resolveEquippedAvatarUrl`)
- Persist pick in `localStorage` (`bpb-sim-you-avatar`) as today

**Foe — opponent icon**

- Click → popover: Dummy / Public build / Mirror
- **No foe class/profile picker** — avatar is implied by mode:

| Mode | Board | Avatar |
|---|---|---|
| **Training dummy** | None — configurable stats (below) | Dummy art (`assets/sim/dummy/dummy.png`) |
| **Public build** | Selected public board | Author equipped look (blob → Discord); publish requires Discord, so profile picture is the fallback when they have no blob |
| **Mirror** | Clone the current you-board | **Your** equipped look (sim is auth + Premium only — always signed in) |

**Public build browser**

1. Choosing Public build opens the browser **immediately** (do **not** switch `foe=` yet).
2. On build select → set `foe=build`, load that board, apply author avatar, remount once.
3. Chrome: **scoped overlay** over the **opp bag column + middle field** (you-side bag stays visible — not a full-page modal).
4. Layout: **3–4 column** scrollable build **grid**; **filters on the right** of the overlay (minified browse, not a clone of `/builds/` list layout).

### Dummy settings (when foe = dummy)

Same visibility rule as today: panel only when foe = Dummy.

User-tunable UI (not only URL hacks):

- Max HP
- Flat / % defence (or block) as we support in engine
- Whether it attacks
- Attack damage + interval (and later accuracy if useful)
- Optional starting block (for strip tests)

Persist last dummy preset in `localStorage`; deep-link when practical.

**Placement:** in the **empty opponent bag slot** when foe = Dummy (that space is unused without a backpack). Hidden when Public / Mirror fill the bag. Same Apply / `localStorage` / URL as [`sim-dummy-settings.js`](../../js/pages/sim/foe/sim-dummy-settings.js).

### Avatars (art)

- Class full-body sprites: `assets/characters/char-{class}.png` via `classCharacterPath`
- Equipped profile: `profiles.equipped_avatar` → Discord `avatar_url` ([`profile-avatar.js`](../../js/shared/profile-avatar.js)); Light blobs deepen the same path later
- Dummy: [`assets/sim/dummy/dummy.png`](../../assets/sim/dummy/dummy.png)

**v1 shipped (superseded chrome):** opp-column mode tabs ([`sim-foe-mode.js`](../../js/pages/sim/foe/sim-foe-mode.js)), under-sprite Class / Profile pills ([`sim-avatars.js`](../../js/pages/sim/hud/sim-avatars.js)), dummy settings banner above the bag / rail dock. Replaced by side rails + settings in the empty dummy bag slot.

### Report mismatch

One control: “Something’s wrong” → short note + auto-attach:

- Permalink (`slug`, `oppSlug`, `round`, `seed`, `mode`, `t`)
- `bpb-sim-debug` export (or server-stored blob)
- Coverage summary

Admin: report list, status (open / fixed / wontfix), link back into sim. Legal/privacy: retention + who can see reports (owner/admin).

---

## Item VFX / presentation fidelity

Goal: **best-effort game VFX**, not pixel-perfect every particle. Inventory work, don’t boil the ocean.

### Approach

1. Keep engine/ports as source of combat truth.
2. Add a **presentation catalog** (JSON or doc table) keyed by `itemId`:

   | Field | Meaning |
   |---|---|
   | `vfx` | `none` / `partial` / `solid` |
   | `notes` | e.g. “charge spark only”, “no Manathirst bar” |
   | `refs` | game scene / sprite / particles path under extract |
   | `priority` | how often players notice it |

3. Walk catalog (or coverage list) and mark gaps; ship VFX in **priority bands** (common class items, cards, engineer charge, potions), not random order.

### Examples to track (non-exhaustive)

- Card reveal / chain connect
- Engineer **charge** path + charged item state
- Progress meters (e.g. Manathirst toward mana threshold)
- Potion drink / consume FX
- **Piggybank** / consume-at-start pops
- **Nekio**-style arms + cost readout
- Class items that **visually change with stacks / power**
- Weapon swing / hit flash on the avatar

Replicate what exists in `tools/game-extract-full` assets when licensing/IP allows; otherwise simplified stand-ins that read clearly.

---

## Build order (foundation first)

Do **one vertical slice at a time**. Engine bugfixes continue in parallel when a report or audit demands them — they are not blocked by UX phases.

| Phase | Ship | Done when |
|---|---|---|
| **0 — Keep foundation** | Current engine + log/meters + export + coverage | Already largely here |
| **1 — Product shell** | Testing-grounds chrome (grid room), honest copy, Premium soft/hard gate + shared offer | **Done** for launch chrome bar — see Phase 1 checklist; [`launch-phase-1.md`](../product/launch-phase-1.md) checked |
| **2 — Foe + dummy** | Side-rail opponent icon + Dummy / Public / Mirror; scoped build browser; dummy settings near rail | Can run three foe modes without URL surgery — **launch must-have** (v1 tabs shipped; side-rail follow-up open) |
| **3 — Avatars** | Side characters (class / profile / dummy); you person popover; mode-implied foe art; damage numbers later; blob cosmetics later | Fight has a “who” not only bags — **launch must-have** (v1 pills shipped; side-rail follow-up open) |
| **4 — Report loop** | Report button → store → admin list | **Done** for note + session snapshot + `/admin/` queue (debug JSON blob still later) |
| **5 — VFX band A** | Charge FX polish + card reveal + 5–10 high-visibility items from catalog | Fight feels alive in Simple view |
| **6 — VFX catalog grind** | Systematic item-by-item `vfx` marks + fill gaps by priority | Progress measurable; no mystery list |
| **7+** | Deeper cosmetics, richer dummy AI knobs, compare runs, clip export for YouTube | Only after 1–4 feel solid |

**Launch must-haves** (beyond Phase 1 shell): Phase **2**, Phase **3**, plus **combat report redesign** (scannable game chrome — not Phase 4 admin triage). Tracked in [`launch-phase-1.md`](../product/launch-phase-1.md) Sim section.

### Phase 2–3 slice order (v1 shipped; UI first)

1. [x] Foe mode switch + public build slug + mirror (promote URL-driven paths to UI) — [`sim-foe-mode.js`](../../js/pages/sim/foe/sim-foe-mode.js)
2. [x] Dummy settings panel + persist preset — [`sim-dummy-settings.js`](../../js/pages/sim/foe/sim-dummy-settings.js)
3. [x] Stage avatar slots — large figures under bag columns ([`sim-avatars.js`](../../js/pages/sim/hud/sim-avatars.js)); class character sprites + `assets/sim/dummy/dummy.png`
4. [x] You avatar pick (class vs Discord profile) — localStorage `bpb-sim-you-avatar`; pills under sprite
5. [x] Foe avatar pick (v1) — dummy fixed; build / mirror class-vs-profile pills (`bpb-sim-foe-avatar`) — **superseded** by mode-implied avatars in side-rail UX
6. [x] `profiles.equipped_avatar` public field — [`017_profiles_equipped_avatar.sql`](../db/sql/017_profiles_equipped_avatar.sql); resolve via [`profile-avatar.js`](../../js/shared/profile-avatar.js) (NULL → Discord `avatar_url`)
7. Art swap: profile base / blob cosmetics later (Light blobs); **dummy PNG shipped** (`assets/sim/dummy/dummy.png`)

### Phase 2–3 follow-up — side rails (launch; unchecked)

Target: [Side rails (avatar + foe chrome)](#side-rails-avatar--foe-chrome). Implement after docs lock.

1. [x] You + foe side rails (person icon + empty slots; one opponent icon) — gap from sword / bag / film — [`sim-side-rails.js`](../../js/pages/sim/foe/sim-side-rails.js) (inert until popovers)
2. [x] You person popover: class sprite vs equipped profile; retire under-sprite pills — [`mountYouPersonRail`](../../js/pages/sim/foe/sim-side-rails.js); rails at bag-column edges (sword x / mirrored)
3. [x] Foe opponent popover: Dummy / Public build / Mirror; mode-implied avatars (no foe class/profile pick); retire opp-column mode tabs — [`mountFoeOpponentRail`](../../js/pages/sim/foe/sim-foe-rail.js)
4. [x] Public build: open scoped browser first → on select set `foe=build` + load board + author avatar (one remount); 3–4 col grid + filters on the right — [`sim-build-browser.js`](../../js/pages/sim/foe/sim-build-browser.js)
5. [x] Dummy settings in the empty opponent bag slot when foe = Dummy; keep persist / URL behavior — [`sim-dummy-settings.js`](../../js/pages/sim/foe/sim-dummy-settings.js)

---

## Phase 1 — Product shell (checklist)

**Goal:** `/sim/` looks and reads like a **testing grounds product**, not an engine dump. Layout + visuals + honesty. Simple/Advanced toggle is **deferred** (see below).  
**Launch status:** Phase 1 chrome bar is **accepted** ([`launch-phase-1.md`](../product/launch-phase-1.md)). Next launch product work is Phase **2–3** + combat-report redesign.  
**Not in this phase:** foe picker, mirror, avatars/blobs, report queue, item VFX catalog (Phases 2–5).

### Visuals / atmosphere

- [x] Page background: white → light grey gradient (not parchment) — CSS in `js/pages/sim/sim.css`
- [x] Math-paper **grid lines** (subtle; readable, not busy) — pure CSS `repeating` grids (no image gen)
- [x] Shared nav/footer still work; sim stage chrome does not fight them — nav wash + footer lift; floor wash stops above footer
- [x] Desktop layout reads as one composition (stage + controls + log/meters), not a random dashboard pile — game combat field: bag titles on boards, Open Log mid, HUDs bottom, lab rail under; floating combat report from book
- [ ] Mobile: usable pass (stage readable; controls don’t obscure the fight) — stacks bags → mid → hud → rail under 1100px; tighten further if needed

### Layout / chrome

- [x] Clear regions: **stage**, **run controls**, **HUD / bags**, **combat log + meters** — `sim-region--*` sections in `page.js` + stage band in `sim.css`
- [x] Existing engine playback still works (seed, scrubber, speed, load board from slug/draft) — `initialT` includes `0` on round change; round-picker teardown on `pagehide`; `npm run sim-playback-smoke`
- [x] Coverage / fidelity chip stays visible without looking like a debug dump — “Script coverage N%” on this board (not phase / fixture dump)
- [x] Lab clutter trimmed for product shell — Engine/Demo + save-run/compare removed; seed/permalink/export in run-details bar (no separate mode toggle)

### Honest product copy

- [x] Short blurb: predictive sandbox, seeded RNG — **not** a ranked CombatLog replay — fidelity chip hint
- [x] No public “matches the game 1:1” claim ([`sim-ip-marketing.md`](sim-ip-marketing.md)) — avoid “Game accuracy”; use script coverage
- [x] Empty / error states stay plain and honest (no stuck skeletons) — `sim-status.js` + try/catch in `initSimPage`/`mountRun`; slug load errors; opponent fallback note; `npm run sim-empty-state-smoke`

### Simple / Advanced view (deferred)

**Decision (Aug 2026):** Run details (seed, permalink, export) always visible. **Advanced view** only toggles tooltip **“Changed by”** attribution (`showChangedBy` in `tooltip.js`). Settings cog → panel.

- [x] Toggle in the UI (default = **Simple**) — settings panel → Advanced view
- [x] Preference persisted (`localStorage`) — `bpb-sim-advanced-view`
- [x] Optional deep-link `?advanced=1` (or `?advanced=0`)
- [x] **Simple:** tooltips omit “Changed by” / combat attribution block
- [x] **Advanced:** tooltip “Changed by” sidecar (vertically centered on main card); sim hover opens **screen-center**; Alt pins · Esc releases

### Premium gate (soft CTA + hard URL + shared offer)

**Intent:** Upgrade prompt, not a dead click. Reusable across sim, create Play, screenshot→build, and later paid tools. Client UI is marketing; **entitlement** (session / `profiles.plan`) is the real lock — DevTools-deleting a modal must not unlock a full run.

**Pattern**

| Surface | Behavior |
|---|---|
| Soft gate | Premium CTA on another page (create/build **Play**, screenshot drop, …) → open shared offer **on that page** |
| Hard gate | Direct `/sim/` (and later paid routes) without entitlement → **locked shell** + same offer (not a silent full lab) |
| Real lock | Check plan before valuable work (`simulateEngine` full run, log export, vision parse, …) |

**Checklist**

#### Shared offer module

- [x] One reusable Premium / founding offer UI ($3/mo, founding **N/50**, Discord sign-in, Stripe “coming soon” CTA) — [`js/shared/premium-offer.js`](../../js/shared/premium-offer.js)
- [x] Mountable as Patch3-style panel from any page — [`js/shared/premium-offer.css`](../../js/shared/premium-offer.css) via [`css/shared.css`](../../css/shared.css)
- [x] Honest copy: predictive sandbox + founding/Stripe — no “matches ranked 1:1”
- [x] Same module for nav founding pill + create gate (no second upsell UI)
- [x] Nav **N/50** founding pill (top-right, click → founding offer) — [`js/shared/nav.js`](../../js/shared/nav.js)

#### Soft gate (CTAs elsewhere)

- [x] Create **Play** → sign-in → founding auto-grant → offer if still not entitled — [`js/pages/create/board-editor.js`](../../js/pages/create/board-editor.js) + [`js/shared/premium-gate.js`](../../js/shared/premium-gate.js)
- [x] Build page **Play** → same — [`js/pages/build/round-scrubber.js`](../../js/pages/build/round-scrubber.js) (`build-play-sim` intent)
- [x] After entitled, Create Play opens `/sim/` (draft via localStorage as today)

#### Hard gate (`/sim/` direct URL)

- [x] Non-entitled visit: locked product shell (lab chrome + offer), not the interactive full run — [`js/pages/sim/controls/sim-premium-gate.js`](../../js/pages/sim/controls/sim-premium-gate.js) + [`page.js`](../../js/pages/sim/page.js)
- [x] Entitled visit: current sim as today
- [x] Owner bypass via `profiles.is_owner` in [`js/shared/entitlements.js`](../../js/shared/entitlements.js)
- [x] OAuth resume intent `sim-hard-gate` → reload — [`js/pages/sim/index.js`](../../js/pages/sim/index.js)

#### Entitlement (anti–inspect-element)

- [x] Source of truth: `profiles.plan` + RPCs in [`docs/db/sql/014_profiles_premium.sql`](../db/sql/014_profiles_premium.sql) — **apply in Supabase before testing**
- [x] Auto founding grant on sign-in via `claim_founding_slot()` from [`js/shared/auth.js`](../../js/shared/auth.js)
- [x] Gate **before** full sim run / log export — `mountRun()` / `runSim()` skipped when locked (client); server/Edge check still deferred
- [x] Stripe Checkout live — upgrade CTA + webhook → `profiles.plan`

#### Free teaser vs upgrade-only

- [x] **Decision:** **upgrade-only at launch** — no free sim teaser; non-members get sign-in → offer
- [ ] Revisit teaser only if we change mind after full gate ships

#### Stripe / founding (lands with membership work)

Full ladder: [`stripe.md`](../pages/stripe.md) (0% → 100%).

- [x] Founding 50 RPC + nav counter (client)
- [x] Checkout + webhook update `profiles` — [`stripe.md`](../pages/stripe.md)
- [x] Offer upgrade button → Stripe Checkout — [`js/shared/premium-offer.js`](../../js/shared/premium-offer.js)
- [x] Customer Portal + **Manage billing** (nav, profile, offer panel) — [`js/shared/stripe-portal.js`](../../js/shared/stripe-portal.js)
- [x] Profile plan badge (Founding / Premium) on `/u/{discord_id}/` — [`js/pages/u/index.js`](../../js/pages/u/index.js)

#### Back burner (documented, not this pass)

- Founding **blob cosmetic** (exclusive overlay item; grant on founding)
- Cosmetics inventory / equip system
- Nav pill blob preview (replace ♛ placeholder)
- Optional `/premium/` marketing page
- Screenshot→build Premium gate
- **Character builder / pose export** — part-based hero sprites + held items → PNG (creator thumbnails); see [`todo.md`](../todo.md) Monetization
- Legal stubs update when Stripe ships (Privacy/Terms)
- Server-side / Edge entitlement before sim run

### Done when

- [x] A cold visitor can tell in ~5 seconds: this is a **lab to test bags**, not a parchment journal page — Phase 1 shell accepted for launch chrome bar ([`launch-phase-1.md`](../product/launch-phase-1.md))
- [x] No Presentation/Debug toggle required for Phase 1 — current run-details bar is acceptable
- [x] Soft + hard gates use the **same** offer module; non-entitled users cannot get a full sim run via DOM tweaks alone _(create + build soft gates + `/sim/` hard gate)_
- [x] Phase 2 can start without ripping the shell out again

---

## Out of scope (for this doc)

- Claiming live ranked 1:1 (needs Phase 38 / counsel flags elsewhere)
- Full cosmetics shop / trading economy (blobs in-sim only first)
- Replacing create/history.db as the build source of truth
- Boiling every particle in the game before Premium ships

---

## Related

- [`sim.md`](sim.md) — route, modules, engine overview  
- [`sim-phases.md`](sim-phases.md) — engine phase checklist  
- [`sim-debug-protocol.md`](sim-debug-protocol.md) — debug JSON / audit  
- [`sim-ip-marketing.md`](sim-ip-marketing.md) — IP / “matches the game” claims  
- [`launch-phase-1.md`](../product/launch-phase-1.md) — Premium launch gate  

---

## ChatGPT dummy art prompt

Owner-generated asset (swap in after UI). Inspired by scarecrow / chest-target training dummies; **Backpack Battles–like** soft fantasy, not Minecraft voxels.

Copy-paste:

```text
Create a single 2D game character sprite of a training dummy / scarecrow practice target for a cozy fantasy auto-battler (Backpack Battles–like art). Front-facing, full figure on a transparent background, roughly 256–512px tall. Soft painted pixel-friendly style: warm parchment browns, cream highlights, dark ink outlines — not Minecraft voxels, not photoreal, not anime. Burlap sack head with simple dot eyes and a small mouth; straw/hay stubs for arms; frayed brown tunic; clear red bullseye on the chest; wooden post into a round wood base. Readable silhouette at small size. No text, no UI, no background scene.
```

When ready, save under e.g. `assets/sim/dummy/` and point the sim stage placeholder at it.

**Shipped:** ChatGPT output lives at [`assets/sim/dummy/dummy.png`](../../assets/sim/dummy/dummy.png) (used by Dummy foe avatar). Re-export with transparency later if the black studio ground bothers the HUD.
