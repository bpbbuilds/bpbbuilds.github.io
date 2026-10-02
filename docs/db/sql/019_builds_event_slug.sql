-- Optional community-event tag on a published build.
-- Null = not submitted for an event. Slug matches the Events hub catalog later.

alter table public.builds
  add column if not exists event_slug text;

comment on column public.builds.event_slug is
  'Community event slug when this build was an event submission; null = not an event entry.';

create index if not exists builds_event_slug_idx
  on public.builds (event_slug)
  where event_slug is not null;

notify pgrst, 'reload schema';
