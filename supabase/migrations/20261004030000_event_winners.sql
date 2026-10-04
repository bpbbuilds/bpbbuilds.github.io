-- One owner-selected winner for each event that is judged without a public vote.
-- This table is intentionally private: the owner-only admin-builds Edge Function
-- validates both the selected build and its event_slug before writing it.

create table if not exists public.event_winners (
  event_slug text primary key,
  build_id bigint not null unique references public.builds(id) on delete restrict,
  selected_at timestamptz not null default now(),
  selected_by uuid references public.profiles(id) on delete set null,
  constraint event_winners_slug_chk
    check (event_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

comment on table public.event_winners is
  'One owner-selected winning build for an event judged without community voting.';
comment on column public.event_winners.selected_by is
  'Verified owner who last selected the winner; null only for an audited server emergency action.';

alter table public.event_winners enable row level security;
revoke all on table public.event_winners from anon, authenticated;

notify pgrst, 'reload schema';
