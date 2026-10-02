-- Server-only break-glass use is auditable and rate-limited by Edge Functions.
create table if not exists public.admin_emergency_access_log (
  id bigint generated always as identity primary key,
  used_at timestamptz not null default now(),
  endpoint text not null check (endpoint in ('admin-builds', 'admin-reports')),
  action text not null default ''
);

create index if not exists admin_emergency_access_log_endpoint_used_at_idx
  on public.admin_emergency_access_log (endpoint, used_at desc);

alter table public.admin_emergency_access_log enable row level security;
revoke all on table public.admin_emergency_access_log from anon, authenticated;

notify pgrst, 'reload schema';
