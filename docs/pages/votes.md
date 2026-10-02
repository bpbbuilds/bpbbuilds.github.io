# Build votes

Reddit-style up / down on public builds. Stored in Supabase; catalog Hot / Top / Best / Rising use `vote_score`.

## Identity

- **Anonymous:** browser UUID in `localStorage` (`bpb-voter-id`); one vote per `(build, voter_key)`
- **Signed in (Discord):** Edge uses `profiles.voter_key` (bound on first `SIGNED_IN` via RPC `bind_my_voter_key`)
- If the anon key is already owned by another profile, that bind stays; client gets a reissued key
- `my_vote` also cached as `bpb-build-vote:{slug}` for Liked filter + optimistic UI

See [`docs/pages/auth.md`](auth.md).

## Flow

1. User clicks up/down (toggle again to clear).
2. Client `POST`s to Edge Function `vote-build` with `{ slug, vote, voter_key }` (and Bearer JWT when signed in).
3. Function resolves voter key (profile if JWT, else body), upserts/deletes `build_votes`, recomputes `builds.vote_score`, returns `{ vote_score, my_vote }`.
4. UI shows the **net** `vote_score` (not “base + myVote”).

## Discord

The builds forum post has Up and Down buttons. They call the same `vote-build` function with that member’s `profiles.voter_key`. Clicking the active choice again clears it. The middle button shows `builds.vote_score`. A site vote updates that number on the next bot check. A Discord account with no site profile cannot vote.

## Deploy

```bash
# Schema (profiles + bind RPC)
# apply docs/db/sql/013_profiles.sql

# Function (CLI logged into BPB project owner)
supabase functions deploy vote-build --project-ref xklkysmakrmgtiztsqug --no-verify-jwt --use-api

# Config
node scripts/write-config.mjs
```

No `BPB_SUBMIT_SECRET` for votes. Publish uses Discord JWT (secret = break-glass); admin prefers owner JWT.
