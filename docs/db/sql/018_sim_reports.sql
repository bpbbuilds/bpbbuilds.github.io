-- Combat sandbox issue reports. Insert via Edge Function `report-sim` (service role).
-- No public RLS policies — clients cannot read or write rows directly.

create table if not exists public.sim_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'open',
  reporter_id uuid references public.profiles (id) on delete set null,
  reporter_label text not null,
  description text not null,
  seed text,
  you_title text,
  you_slug text,
  you_round integer,
  foe_mode text,
  foe_label text,
  permalink text,
  coverage_pct integer,
  session jsonb not null default '{}'::jsonb,
  constraint sim_reports_status_chk check (status in ('open', 'fixed', 'wontfix')),
  constraint sim_reports_description_len check (
    char_length(btrim(description)) between 1 and 4000
  )
);

comment on table public.sim_reports is
  'Combat sandbox mismatch reports. Insert via report-sim; owner triage later.';

comment on column public.sim_reports.session is
  'Frozen snapshot (permalink fields, coverage, foe mode) at submit time.';

create index if not exists sim_reports_created_at_idx
  on public.sim_reports (created_at desc);

create index if not exists sim_reports_status_idx
  on public.sim_reports (status, created_at desc);

alter table public.sim_reports enable row level security;
