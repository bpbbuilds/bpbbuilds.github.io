-- Account-bound write limits and private board-still access.
create table if not exists public.security_rate_limit_events (
  id bigint generated always as identity primary key,
  endpoint text not null check (endpoint in ('vote-build', 'report-sim', 'submit-build', 'screenshot-to-build')),
  subject_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists security_rate_limit_events_lookup_idx
  on public.security_rate_limit_events (endpoint, subject_id, created_at desc);
alter table public.security_rate_limit_events enable row level security;
revoke all on table public.security_rate_limit_events from anon, authenticated;

create or replace function public.consume_security_rate_limit(p_endpoint text, p_subject_id uuid, p_limit integer, p_window interval)
returns boolean language plpgsql security definer set search_path = '' as $$
declare recent_count integer;
begin
  if p_endpoint not in ('vote-build', 'report-sim', 'submit-build', 'screenshot-to-build') or p_subject_id is null or p_limit < 1 or p_window <= interval '0 seconds' then
    raise exception 'invalid rate-limit request';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_endpoint || ':' || p_subject_id::text, 0));
  delete from public.security_rate_limit_events where created_at < now() - greatest(p_window, interval '7 days');
  select count(*) into recent_count from public.security_rate_limit_events where endpoint = p_endpoint and subject_id = p_subject_id and created_at >= now() - p_window;
  if recent_count >= p_limit then return false; end if;
  insert into public.security_rate_limit_events (endpoint, subject_id) values (p_endpoint, p_subject_id);
  return true;
end;
$$;
revoke all on function public.consume_security_rate_limit(text, uuid, integer, interval) from public, anon, authenticated;

update storage.buckets set public = false where id = 'board-stills';
drop policy if exists "Public read board-stills" on storage.objects;
drop policy if exists "Site access read board-stills" on storage.objects;
create policy "Site access read board-stills" on storage.objects for select to anon, authenticated using (bucket_id = 'board-stills' and (select private.site_access_allowed()));
notify pgrst, 'reload schema';
