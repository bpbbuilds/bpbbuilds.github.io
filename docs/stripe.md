# Stripe — 0% → 100%

Todo ladder for paid Premium (**$3/mo**). Check boxes as you ship. Product gates and founding already exist; this file is **money path only**.

Related: [`launch-phase-1.md`](launch-phase-1.md) · [`sim-product.md`](sim-product.md) · [`auth.md`](auth.md) · [`docs/db/sql/014_profiles_premium.sql`](db/sql/014_profiles_premium.sql)

**Locked product decisions (do not reopen here):**

| Topic | Choice |
|---|---|
| Price | **$3/mo** |
| Founding 50 | Auto-grant on eligible Discord sign-in; lifetime; not revoked by Stripe cancel |
| Owner | Excluded from founding slots; client Premium bypass via `is_owner` |
| Free teaser | Upgrade-only at launch (no free sim run) |
| Gates | Create Play + build Play soft; `/sim/` hard — already shipped |

**Progress snapshot:** ~**25%** — schema + gates + offer UI; no live Checkout yet.

---

## 0% — Prerequisites (before Stripe Dashboard work)

Legal / trust blockers before taking a real card.

- [ ] Monetization + IP go-no-go written ([`todo.md`](todo.md) Legal / [`launch-phase-1.md`](launch-phase-1.md))
- [ ] Confirm public price copy stays **$3/mo** (offer UI already shows this)
- [x] Discord Auth + `profiles` rows
- [x] `plan` / `founding_slot` / `premium_until` / `stripe_customer_id` columns + protect trigger ([`014_profiles_premium.sql`](db/sql/014_profiles_premium.sql))
- [x] Founding RPCs + nav **N/50**
- [x] Shared offer panel + soft/hard Premium gates

---

## 25% — Stripe account + catalog

Dashboard setup only (no site code required yet).

- [ ] Stripe account (live + test) ready
- [ ] Product: **Premium** (or equivalent name)
- [ ] Recurring **Price**: $3/mo (USD); note Price ID for env
- [ ] Customer Portal enabled in Dashboard (cancel / invoices / payment method)
- [ ] Webhook endpoint placeholder URL decided (Supabase Edge Function path)
- [ ] Env names documented (do not commit secrets), e.g.:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_PUBLISHABLE_KEY` (if needed client-side)
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_ID_PREMIUM`
  - existing `SUPABASE_*` for service-role writes

---

## 40% — Customer + Checkout session (signed-in only)

Server creates Checkout; client never sets `profiles.plan`.

- [ ] Edge Function (or equivalent): **create Checkout Session**
  - Require Supabase JWT (Discord user)
  - Create or reuse Stripe Customer → store `profiles.stripe_customer_id` (service role)
  - `client_reference_id` / metadata = `profiles.id` (auth user UUID)
  - Success / cancel return URLs (build page, `/sim/`, or `/u/…` — pick one default + `?return=` optional)
- [ ] Wire offer **Upgrade — $3/mo** button → that function ([`js/shared/premium-offer.js`](../js/shared/premium-offer.js))
- [ ] Block Checkout if already `founding` or active `premium` (show Portal instead)
- [ ] Test mode: end-to-end Checkout with Stripe test card

---

## 55% — Webhooks → `profiles`

Source of truth for paid entitlement.

- [ ] Edge Function: **Stripe webhook** (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` as needed)
- [ ] Verify signature with `STRIPE_WEBHOOK_SECRET`
- [ ] Map events → `profiles`:
  - active sub → `plan = 'premium'`, set `premium_until` (period end), ensure `stripe_customer_id`
  - canceled / unpaid → `plan = 'free'` **only if** not `founding`; clear or keep `premium_until` honestly
  - **Never** clear `founding` / `founding_slot` on Stripe cancel
- [ ] Idempotent handling (replay-safe)
- [ ] Test: pay → profile premium; cancel → free (non-founding); founding user cancel Stripe → still founding

---

## 70% — Customer Portal + account UX

- [ ] Edge Function: **create Portal session** (signed-in + existing `stripe_customer_id`)
- [ ] Settings / billing entry (nav menu or `/u/{discord_id}/` when self) → Portal
- [ ] Offer panel: entitled paid users see **Manage billing** instead of Upgrade
- [ ] Profile flair: Free / Founding / Premium from `profiles.plan` ([`launch-phase-1.md`](launch-phase-1.md))

---

## 85% — Legal + Discord mirrors (ship with money)

- [ ] Privacy stub: Stripe customer/payment data, retention, contact ([`legal/privacy/`](../legal/privacy/index.html))
- [ ] Terms stub: paid plan, renewals, founding lifetime vs Portal cancel ([`legal/terms/`](../legal/terms/index.html))
- [ ] Footer / About: no false affiliation; founding one-liner matches Discord/videos
- [ ] Discord roles (if launching with bot): Premium add/remove on Stripe + founding grant ([`launch-phase-1.md`](launch-phase-1.md))

---

## 100% — Live + ops

- [ ] Switch Checkout + webhook to **live** keys / live Price ID
- [ ] Live webhook registered and delivering
- [ ] Smoke: real $3 checkout (refund OK) → `plan = premium` within a minute
- [ ] Smoke: Portal cancel → entitlement drops for non-founding
- [ ] Founding promo start timestamp / public URL policy aligned ([`launch-phase-1.md`](launch-phase-1.md))
- [ ] Watch entitlements a few days before cosmetics / more paid surfaces
- [ ] Check off Stripe bullets in [`launch-phase-1.md`](launch-phase-1.md) + [`sim-product.md`](sim-product.md)

**Done when:** a signed-in free user can pay $3/mo, run sim, manage/cancel in Portal, and founding users never lose Premium via Stripe cancel.

---

## Explicitly later (not required for 100%)

- Discord-native billing as primary (keep Stripe as source of truth)
- Annual price / coupons / trials
- Receipt emails beyond Stripe defaults
- Server-side Edge check before every `runSim` (nice hardening; client gates already ship)
- `/premium/` marketing page
