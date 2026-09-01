# `build_votes`

One up/down vote per anonymous `voter_key` per build. Net score lives on `builds.vote_score`.

## Schema

```sql
create table public.build_votes (
  build_id bigint not null references public.builds (id) on delete cascade,
  voter_key uuid not null,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (build_id, voter_key)
);
```

| Column | Purpose |
|---|---|
| `build_id` | Parent build |
| `voter_key` | Anonymous UUID from browser `localStorage` until auth |
| `vote` | `1` upvote or `-1` downvote (clear = delete row) |

## Writes

Only via Edge Function `vote-build` (service role). RLS enabled with **no** public policies.

## Related

- `builds.vote_score` — denormalized sum; public readable with the build
- Client: [`js/pages/build/vote.js`](../../../js/pages/build/vote.js)
- Docs: [`docs/votes.md`](../../votes.md)

SQL: [`docs/db/sql/012_build_votes.sql`](../sql/012_build_votes.sql)  
Apply: `node scripts/_apply-build-votes.mjs`
