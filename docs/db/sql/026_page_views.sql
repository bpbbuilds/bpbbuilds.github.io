-- Daily page-visit counts. No user id, IP, or cookie.
-- Apply in the Supabase SQL editor after 013_profiles.sql.
-- 027_member_daily.sql replaces record_page_view so the first visit of a UTC day
-- also stores membership totals. Re-apply 027 if you re-apply this file.

create table if not exists public.page_views (
  path text not null,
  day date not null,
  hits integer not null default 0 check (hits >= 0),
  primary key (path, day)
);

comment on table public.page_views is
  'Anonymous daily hit counts for public site sections. Owner reads via page_view_stats().';

revoke all on table public.page_views from public;

create or replace function public.record_page_view(p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := (timezone('utc', now()))::date;
  allowed constant text[] := array[
    '/',
    '/items/',
    '/builds/',
    '/builds/history/',
    '/builds/view/',
    '/builds/*',
    '/create/',
    '/events/',
    '/challenges/',
    '/quest/',
    '/market/',
    '/sim/',
    '/u/',
    '/legal/about/',
    '/legal/privacy/',
    '/legal/terms/',
    '/overlay/'
  ];
begin
  if p_path is null or not (p_path = any (allowed)) then
    return;
  end if;

  insert into public.page_views (path, day, hits)
  values (p_path, d, 1)
  on conflict (path, day)
  do update set hits = public.page_views.hits + 1;
end;
$$;

revoke all on function public.record_page_view(text) from public;
grant execute on function public.record_page_view(text) to anon, authenticated;

create or replace function public.page_view_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  owner boolean;
begin
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_owner
  ) into owner;

  if not owner then
    raise exception 'not owner';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'path', path,
          'day', day,
          'hits', hits
        )
        order by day desc, path
      )
      from public.page_views
      where day >= (timezone('utc', now()))::date - 29
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.page_view_stats() from public;
grant execute on function public.page_view_stats() to authenticated;
