# Stripe — 0% → 100%

Todo ladder for paid Premium (**$3/mo**). Check boxes as you ship. Product gates and founding already exist; this file is **money path only**.

Related: [`launch-phase-1.md`](../product/launch-phase-1.md) · [`monetization-ip.md`](../product/monetization-ip.md) · [`sim-product.md`](../sim/sim-product.md) · [`auth.md`](auth.md) · [`docs/db/sql/014_profiles_premium.sql`](../db/sql/014_profiles_premium.sql)

**Locked product decisions (do not reopen here):**

| Topic | Choice |
|---|---|
| Price | **$3/mo** |
| Founding 50 | Auto-grant on eligible Discord sign-in; lifetime; not revoked by Stripe cancel |
| Owner | Excluded from founding slots; client Premium bypass via `is_owner` |
| Free teaser | Upgrade-only at launch (no free sim run) |
| Gates | Create Play + build Play soft; `/sim/` hard — already shipped |

**Progress snapshot:** ~**92%** — live Checkout + Portal + cancel smoke; Privacy/Terms; IP go-no-go; founding promo start gate documented ([`016_founding_promo_start.sql`](../db/sql/016_founding_promo_start.sql)). Left: Discord roles, ops watch, apply `016` + flip `started_at` at announce.

**Public business URL (Stripe account / landing):** https://bpbbuilds.github.io  
(Full app stays in private [`bpbbuilds/website`](https://github.com/bpbbuilds/website) until launch. Pages site repo: [`bpbbuilds/bpbbuilds.github.io`](https://github.com/bpbbuilds/bpbbuilds.github.io).)

**Mode:** **Live** Stripe keys in local `.env` and Supabase secrets (not committed).

### Env (local `.env` + Supabase secrets)

| Name | Where |
|---|---|
| `STRIPE_SECRET_KEY` | Supabase secrets |
| `STRIPE_WEBHOOK_SECRET` | Supabase secrets (per webhook endpoint in Dashboard) |
| `STRIPE_PRICE_ID_PREMIUM` | Supabase secrets (`price_…`) |
| `SITE_URL` | Supabase secrets — `https://bpbbuilds.github.io` (Checkout return URLs) |
| `SUPABASE_*` | Already used by Edge Functions |

Client: `node scripts/write-config.mjs` → `createCheckoutUrl` + `createPortalUrl` in `js/shared/config.js`.

Deploy: `node scripts/_deploy-stripe.mjs` (requires `supabase login` with access to the BPB project)

If CLI lacks project access, set secrets in [Supabase Dashboard](https://supabase.com/dashboard) → Project → Edge Functions → Secrets, then deploy functions from a linked machine:

```bash
supabase functions deploy create-checkout --project-ref YOUR_REF --no-verify-jwt --use-api
supabase functions deploy create-portal --project-ref YOUR_REF --no-verify-jwt --use-api
supabase functions deploy stripe-webhook --project-ref YOUR_REF --no-verify-jwt --use-api
```

Webhook URL (register in Stripe Dashboard after deploy):

`{SUPABASE_PROJECT_URL}/functions/v1/stripe-webhook`

---

## 0% — Prerequisites (before Stripe Dashboard work)

Legal / trust blockers before taking a real card.

- [x] Monetization + IP go-no-go written ([`monetization-ip.md`](../product/monetization-ip.md) · [`todo.md`](../todo.md) Legal / [`launch-phase-1.md`](../product/launch-phase-1.md))
- [x] Confirm public price copy stays **$3/mo** (`PREMIUM_PRICE_LABEL` + Terms/About)
- [x] Discord Auth + `profiles` rows
- [x] `plan` / `founding_slot` / `premium_until` / `stripe_customer_id` columns + protect trigger ([`014_profiles_premium.sql`](../db/sql/014_profiles_premium.sql))
- [x] Founding RPCs + nav **N/50**
- [x] Shared offer panel + soft/hard Premium gates

---

## 25% — Stripe account + catalog

Dashboard setup only (no site code required yet).

- [x] Stripe account **live** ready (test mode optional later)
- [x] Product: **Premium**
- [x] Recurring **Price**: $3/mo (USD) — `STRIPE_PRICE_ID_PREMIUM` in `.env` / secrets
- [x] Customer Portal enabled in Dashboard (cancel / invoices / payment method)
- [x] Webhook endpoint URL: `{SUPABASE_PROJECT_URL}/functions/v1/stripe-webhook`
- [x] Env names documented (see table above); secrets via `scripts/_deploy-stripe.mjs`

---

## 40% — Customer + Checkout session (signed-in only)

Server creates Checkout; client never sets `profiles.plan`.

- [x] Edge Function **create-checkout** — [`supabase/functions/create-checkout/`](../supabase/functions/create-checkout/)
- [x] Wire offer **Upgrade — $3/mo** → Checkout — [`js/shared/stripe-checkout.js`](../../js/shared/stripe-checkout.js) + [`premium-offer.js`](../../js/shared/premium-offer.js)
- [x] Block Checkout if `founding` or active `premium` (409)
- [x] Live smoke: $3 checkout → `plan = premium` (refund OK)

---

## 55% — Webhooks → `profiles`

Source of truth for paid entitlement.

- [x] Edge Function **stripe-webhook** — [`supabase/functions/stripe-webhook/`](../supabase/functions/stripe-webhook/)
- [x] Verify signature with `STRIPE_WEBHOOK_SECRET`
- [x] Map events → `profiles` (founding never downgraded)
- [x] Idempotent replay-safe updates
- [x] Stripe Dashboard webhook registered + delivering — confirm in Stripe → Webhooks (URL below)
- [x] Live smoke: pay → premium
- [x] Live smoke: cancel → free (non-founding)

---

## 70% — Customer Portal + account UX

- [x] Edge Function: **create-portal** — [`supabase/functions/create-portal/`](../supabase/functions/create-portal/)
- [x] Settings / billing entry (nav + `/u/{discord_id}/` when self) → Portal — [`js/shared/stripe-portal.js`](../../js/shared/stripe-portal.js), [`nav.js`](../../js/shared/nav.js), [`js/pages/u/index.js`](../../js/pages/u/index.js)
- [x] Offer panel: entitled paid users see **Manage billing** instead of Upgrade — [`premium-offer.js`](../../js/shared/premium-offer.js)
- [x] Profile flair: Founding / Premium from `profiles.plan` on `/u/{discord_id}/` — [`js/pages/u/index.js`](../../js/pages/u/index.js)

---

## 85% — Legal + Discord mirrors (ship with money)

- [x] Privacy stub: Stripe customer/payment data, retention, contact ([`legal/privacy/`](../legal/privacy/index.html))
- [x] Terms stub: paid plan, renewals, founding lifetime vs Portal cancel ([`legal/terms/`](../legal/terms/index.html))
- [x] Footer / About: no false affiliation; founding / Premium one-liner
- [ ] Discord roles (if launching with bot): Premium add/remove on Stripe + founding grant ([`launch-phase-1.md`](../product/launch-phase-1.md))

---

## 100% — Live + ops

- [x] Switch Checkout + webhook to **live** keys / live Price ID
- [x] Live webhook registered and delivering
- [x] Smoke: real $3 checkout (refund OK) → `plan = premium` within a minute
- [x] Smoke: Portal cancel → entitlement drops for non-founding
- [x] Founding promo start timestamp / public URL policy aligned ([`launch-phase-1.md`](../product/launch-phase-1.md) · [`016_founding_promo_start.sql`](../db/sql/016_founding_promo_start.sql) — apply SQL; leave `started_at` null until `https://bpbbuilds.github.io` is public)
- [ ] Watch entitlements a few days before cosmetics / more paid surfaces
- [ ] Check off Stripe bullets in [`launch-phase-1.md`](../product/launch-phase-1.md) + [`sim-product.md`](../sim/sim-product.md)

**Done when:** a signed-in free user can pay $3/mo, run sim, manage/cancel in Portal, and founding users never lose Premium via Stripe cancel.

---

## Explicitly later (not required for 100%)

- Discord-native billing as primary (keep Stripe as source of truth)
- Annual price / coupons / trials
- Receipt emails beyond Stripe defaults
- Server-side Edge check before every `runSim` (nice hardening; client gates already ship)
- `/premium/` marketing page
