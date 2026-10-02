# Sim reports table

User-filed combat sandbox issues from `/sim/`. Description is the only client-authored field; session facts (seed, user label, opponent, permalink) are frozen at submit.

SQL: [`docs/db/sql/018_sim_reports.sql`](../sql/018_sim_reports.sql)

## Schema

| Column | Purpose |
|---|---|
| `id` | Report UUID |
| `created_at` | Submit time |
| `status` | `open` / `fixed` / `wontfix` (admin triage) |
| `reporter_id` | `profiles.id` when signed in; else null |
| `reporter_label` | Frozen display (“Guest” or Discord name) |
| `description` | Free-text note (1–4000 chars) |
| `seed` | Fight seed |
| `you_title` / `you_slug` / `you_round` | Your board |
| `foe_mode` / `foe_label` | Dummy / public build / mirror |
| `permalink` | Sim query string at submit |
| `coverage_pct` | Script coverage on that board |
| `session` | Extra frozen snapshot JSON |

## Writes

| Who | How |
|---|---|
| Public | No (RLS on, no policies) |
| Site | Edge Function `report-sim` (service role insert) |
| Owner | Edge Function `admin-reports` (owner JWT or submit secret) — list, `stats`, set status |

Reports may include a Discord profile id when the reporter is signed in. See Privacy. Admin list is not public.
