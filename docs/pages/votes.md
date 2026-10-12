# Build votes

Reddit-style up / down on public builds. Stored in Supabase; catalog Hot / Top / Best / Rising use `vote_score`.

## Identity

- **Signed in (Discord) only:** the Edge Function authenticates the Discord JWT and uses the account id as the vote key; anonymous requests are rejected
- The browser may cache `my_vote` as `bpb-build-vote:{slug}` for the signed-in account's Liked filter and optimistic UI
- A short-lived `bpb-vote-intent` session entry carries the requested direction across the OAuth return; it contains only the build slug and `1` / `-1` direction

See [`docs/pages/auth.md`](auth.md).

## Flow

1. User clicks up/down (toggle again to clear).
2. If signed out, the site opens the shared sign-in confirm and saves the requested direction only after the user confirms.
3. Discord OAuth returns to the page that started the sign-in; the pending direction is replayed through the normal signed vote path.
4. Client `POST`s to Edge Function `vote-build` with `{ slug, vote }` and a Bearer JWT.
5. Function authenticates the account, upserts/deletes `build_votes`, recomputes `builds.vote_score`, and returns `{ vote_score, my_vote }`.
6. UI shows the **net** `vote_score` (not “base + myVote”).

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
