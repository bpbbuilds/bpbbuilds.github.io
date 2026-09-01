-- Stored up/down votes: net score on builds + per-voter rows (anonymous voter_key until auth).

alter table public.builds
  add column if not exists vote_score integer not null default 0;

comment on column public.builds.vote_score is
  'Net vote score (sum of build_votes.vote). Updated by vote-build Edge Function.';

create table if not exists public.build_votes (
  build_id bigint not null references public.builds (id) on delete cascade,
  voter_key uuid not null,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (build_id, voter_key)
);

create index if not exists build_votes_build_id_idx
  on public.build_votes (build_id);

comment on table public.build_votes is
  'One vote per anonymous voter_key per build (−1 or +1). Writes via service role only.';

alter table public.build_votes enable row level security;

-- No public policies: anon/authenticated cannot read or write rows.
-- Service role bypasses RLS for Edge Function upsert/sum.
