# Phase 1 — Launch todos

Things that must be done **before** the site URL goes public (videos, Discord, YouTube). Check off here when shipped.

North star: [`purpose.md`](purpose.md). Day-to-day leftovers: [`todo.md`](todo.md). Auth today: [`auth.md`](auth.md).

**Launch offer:** Discord sign-in, Stripe Premium, first **50** eligible sign-ins get **Premium forever**, light blob overlay, Discord Premium (+ Founding) roles.

**Already shipped (do not rebuild):** homepage, Itemiary, `/builds/`, build pages, `/create/` (history.db path), `/admin/`, Discord OAuth + `profiles`, legal stubs (must update when money exists), Premium Play **plaque** (visual only). `/sim/` exists as an engine sandbox — **not** launch-ready as a paid feature yet.

**Not this launch:** cosmetics shop, trading, currency, YouTube like/comment rewards, stream alert blobs, Steam link, native comments, contest/event system, AI board optimize, build DPS “Excellent” ratings, claiming sim is 1:1 with live PvP.

---

## Legal / IP (before taking money)

- [ ] **Monetization + IP go-no-go** — written call on selling membership while using game art/assets ([`todo.md`](todo.md) Legal)
- [ ] **Privacy** — Stripe, founding promo, overlay, Discord role sync
- [ ] **Terms** — accounts, paid plan, founding 50 (lifetime, not cancelable via Portal), conduct
- [ ] **About / footer** — same founding sentence as Discord + videos; no fake publisher affiliation

---

## Membership (Stripe)

Full ladder (0% → 100%): [`stripe.md`](stripe.md).

- [ ] Confirm price (todo lean: ~$2–3/mo) — **locked $3/mo** in offer UI; see stripe.md
- [ ] Stripe product + price in dashboard
- [x] `profiles` fields: `plan` (`free` | `founding` | `premium`), `premium_until`, `founding_slot`, `stripe_customer_id` + RLS
- [ ] Checkout from a **signed-in** Discord user
- [ ] Webhook updates `profiles` on pay / fail / cancel
- [ ] Customer Portal (manage / cancel / invoices)
- [ ] Settings / billing page (nav or profile when signed in)
- [x] Premium gate UX — Play / sim (and other premium controls): upgrade prompt, not a dead click
- [ ] Profile flair — Premium / Founding on `/u/{discord_id}/`
- [ ] Profile polish enough that Premium/Founding looks intentional (parchment, not a bare list)

---

## Premium features (must be worth paying)

Do not take money until these feel finished. Gate behind Discord + Premium/founding. Free users get a teaser or upgrade prompt, not a dead click.

### Sim (`/sim/`)

Engine work continues ([`sim-phases.md`](sim-phases.md)); launch needs a **sellable** sandbox, not live-PvP 1:1. Product UX vision: [`sim-product.md`](sim-product.md).

- [ ] Sim page UX/chrome finalized (load a board, run, log/meter readable, not a lab dump) — see sim-product Phase 1+
- [ ] Fidelity good enough to demo real boards without obvious fake fights (HAND deep + gates green; live `live.*` fill-in still nice-to-have)
- [ ] Premium gate: full run (e.g. 30s) + log; decide free teaser (short run / locked log) vs upgrade-only
- [ ] Play CTAs on build + create actually open this gated sim
- [ ] Honest copy: predictive dummy sim, not “replays your ranked fight”; no public “matches the game” until Phase 38 counsel (269 flags stay off)
- [ ] Report mismatch → admin triage (sim-product Phase 4) — nice for launch trust; can slip slightly after gate if Phase 1–2 ship first

### Screenshot → build (`/create/`)

- [ ] Drop/upload a backpack screenshot on create → detected layout on the board (vision)
- [ ] Premium-only (founding included); free users see the drop target + upgrade prompt
- [ ] Privacy: screenshots not kept longer than needed; legal stubs mention the upload
- [ ] Fail state: “couldn’t read this image” — no silent wrong board

---

## Create / site leftovers (launch polish)

Nice if they ship with launch; do not block Stripe if sim + screenshot are the paid hooks. Still check off if done before URL go-live.

- [ ] Create: arrow keys stay in title/notes when those fields are focused (don’t steal for round scrubber)
- [ ] Create: drag socketed gems onto Needs / Wants / Good to have
- [ ] Mobile side nav + a usable small-screen pass on home / items / create / builds (can slip if desktop launch is the video audience)

---

## Founding 50 (free Premium forever)

Rules: first 50 **eligible** Discord sign-ins **after** promo start. Atomic slot 1–50 (no race). Exclude `is_owner` + test Discord IDs. Grant does **not** expire and is **not** removed by Stripe cancel. After 50, sign-in still works; paid path is Stripe.

- [ ] Promo start timestamp (flip the day the URL goes public)
- [ ] Atomic grant on first eligible sign-in
- [ ] Admin: slots used + founding names (owner-only)
- [ ] Same one-line offer on site + Discord; after 50, CTA becomes Stripe

---

## Discord

- [ ] Bot in the community server
- [ ] Sync **Premium** role on founding grant / Stripe change (add + remove)
- [ ] **Founding** role for slots 1–50
- [ ] Auto-join on site Sign in (`guilds.join`) — optional; can slip to 1.1 if bot-on-existing-members is enough for launch

---

## Light blobs (OBS)

Original art only. No shop / trade / coins.

- [ ] One peeking base blob
- [ ] **Five** cosmetics + equip UI (profile/settings)
- [ ] Transparent overlay page for OBS browser source
- [ ] Overlay shows current premium/founding loadouts (snapshot OK for recorded videos)

---

## Site go-live

- [ ] Public host URL is the real one (GitHub Pages or chosen host)
- [ ] Enough real OP / catalog builds that a new visitor is not on an empty site
- [ ] Un-hide URL in videos / Discord / YouTube **after** Stripe + founding grants work
- [ ] Flip founding promo start when that URL is public

---

## After launch (not blockers)

- [ ] Watch entitlements (founding vs Stripe) for a bit before more cosmetics
- [ ] More blobs / live follow-sub alerts — later
- [ ] Keep iterating create / builds / sim
