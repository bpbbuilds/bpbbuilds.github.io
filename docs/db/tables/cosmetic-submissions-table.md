# Cosmetic submissions table

Private, moderated player-created blob cosmetics from the profile Blob / Inventory “Submit cosmetic” form.

SQL: [`../../../supabase/migrations/20261004000000_cosmetic_submissions.sql`](../../../supabase/migrations/20261004000000_cosmetic_submissions.sql)

## Schema

| Column | Purpose |
|---|---|
| `id` | Submission UUID |
| `created_at` | Submission time |
| `status` | `pending`, `approved`, or `rejected` |
| `submitter_id` / `submitter_label` | Signed-in Discord profile and immutable display-credit snapshot |
| `cosmetic_id` | Proposed public catalog id; checked again before approval |
| `name`, `slot`, `rarity`, `description` | Moderated cosmetic metadata |
| `image_path`, `image_mime` | Private Storage object path and validated image type |
| `reviewed_at`, `reviewed_by` | Owner moderation record |
| `published_cosmetic_id` | The public `cosmetic_drops.id` created on approval |

## Access and lifecycle

1. A signed-in Discord user submits PNG/WebP art through the `cosmetic-submissions` Edge Function. The function validates the JWT, metadata, file signature, and a three-per-day account limit.
2. The source file is written only to private `cosmetic-submissions` Storage. There are no browser RLS policies for its table or objects.
3. Owners list pending/approved/rejected entries through that Edge Function. Preview URLs are short-lived signed URLs.
4. On approval, the function copies the validated asset to public `cosmetic-assets`, creates a published `cosmetic_drops` row, and records the reviewer. The existing bot then announces it once.
5. Rejection retains the private record/art for moderation and deletion handling; it is never public.

No client can approve, publish, grant a different access tier, or choose the credited artist. Approved player submissions are Starter cosmetics.
