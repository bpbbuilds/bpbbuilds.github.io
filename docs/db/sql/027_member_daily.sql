-- Daily membership totals for the admin Members tab.
-- Users on the chart come from profiles.created_at.
-- Paid Premium, founding, and revenue are a once-a-day snapshot.
-- Revenue is paid Premium × $3/mo (300 cents). Founding is not charged.
-- Apply after 013_profiles.sql and 026_page_views.sql.

create table if not exists public.member_daily (
  day date primary key,
  users integer not null check (users >= 0),
  premium integer not null check (premium >= 0),
  founding integer not null check (founding >= 0),
  revenue_cents integer not null check (revenue_cents >= 0)
);

comment on table public.member_daily is
  'Daily account totals. premium is paid and still active. revenue_cents is premium × 300. Owner reads via member_stats().';

revoke all on table public.member_daily from public;

create or replace function public.snapshot_member_daily(p_refresh boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := (timezone('utc', now()))::date;
  n_users integer;
  n_premium integer;
  n_founding integer;
begin
  if not p_refresh and exists (select 1 from public.member_daily where day = d) then
    return;
  end if;

  select
    count(*)::integer,
    count(*) filter (
      where plan = 'premium'
        and (premium_until is null or premium_until > now())
    )::integer,
    count(*) filter (where plan = 'founding')::integer
  into n_users, n_premium, n_founding
  from public.profiles;

  insert into public.member_daily (day, users, premium, founding, revenue_cents)
  values (d, n_users, n_premium, n_founding, n_premium * 300)
  on conflict (day) do update set
    users = excluded.users,
    premium = excluded.premium,
    founding = excluded.founding,
    revenue_cents = excluded.revenue_cents;
end;
$$;

revoke all on function public.snapshot_member_daily(boolean) from public;

-- Same body as 026, plus the daily snapshot on the first counted visit of the UTC day.
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

  perform public.snapshot_member_daily(false);
end;
$$;

revoke all on function public.record_page_view(text) from public;
grant execute on function public.record_page_view(text) to anon, authenticated;

create or replace function public.member_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner boolean;
  today date := (timezone('utc', now()))::date;
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

  perform public.snapshot_member_daily(true);

  return (
    select jsonb_build_object(
      'users', m.users,
      'premium', m.premium,
      'founding', m.founding,
      'revenueCents', m.revenue_cents,
      'series', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'day', s.day,
            'users', s.users,
            'premium', s.premium,
            'founding', s.founding,
            'revenueCents', s.revenue_cents
          )
          order by s.day
        )
        from (
          select
            g.ts::date as day,
            (
              select count(*)::integer
              from public.profiles p
              where (p.created_at at time zone 'utc')::date <= g.ts::date
            ) as users,
            snap.premium,
            snap.founding,
            snap.revenue_cents
          from generate_series(
            (today - 29)::timestamp,
            today::timestamp,
            interval '1 day'
          ) as g(ts)
          left join public.member_daily snap on snap.day = g.ts::date
        ) s
      ), '[]'::jsonb)
    )
    from public.member_daily m
    where m.day = today
  );
end;
$$;

revoke all on function public.member_stats() from public;
grant execute on function public.member_stats() to authenticated;
