-- Contest entries stay private to the author until the gallery opens.
-- Vote events open at voting start. Scored events stay private through judging
-- and open when the event ends. Keep these timestamps in step with
-- supabase/functions/submit-build/event-gallery.json.

alter table public.builds
  add column if not exists event_held boolean not null default false;

comment on column public.builds.event_held is
  'True while an event entry is hidden until its gallery opens. Cleared on release so a later admin hide sticks.';

drop policy if exists "Authors read own builds" on public.builds;
create policy "Authors read own builds"
  on public.builds
  for select
  to authenticated
  using (author_id = auth.uid());

drop policy if exists "Authors read placements of own builds" on public.build_placements;
create policy "Authors read placements of own builds"
  on public.build_placements
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.builds b
      where b.id = build_id
        and b.author_id = auth.uid()
    )
  );

create or replace function public.sync_event_build_visibility()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.builds b
  set is_public = false,
      event_held = true
  from (
    values
      ('highest-dps', timestamptz '2026-10-12 17:00:00+00'),
      ('ember-forge', timestamptz '2026-10-20 17:00:00+00'),
      ('night-market', timestamptz '2026-10-01 17:00:00+00'),
      ('crown-vote', timestamptz '2026-09-20 17:00:00+00'),
      ('winter-relic', timestamptz '2026-11-16 17:00:00+00')
  ) as windows(slug, opens_at)
  where b.event_slug = windows.slug
    and now() < windows.opens_at;

  update public.builds b
  set is_public = true,
      event_held = false
  from (
    values
      ('highest-dps', timestamptz '2026-10-12 17:00:00+00'),
      ('ember-forge', timestamptz '2026-10-20 17:00:00+00'),
      ('night-market', timestamptz '2026-10-01 17:00:00+00'),
      ('crown-vote', timestamptz '2026-09-20 17:00:00+00'),
      ('winter-relic', timestamptz '2026-11-16 17:00:00+00')
  ) as windows(slug, opens_at)
  where b.event_slug = windows.slug
    and b.event_held = true
    and now() >= windows.opens_at;
end;
$$;

revoke all on function public.sync_event_build_visibility() from public;
grant execute on function public.sync_event_build_visibility() to anon, authenticated, service_role;

select public.sync_event_build_visibility();

notify pgrst, 'reload schema';
