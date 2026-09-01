-- DEPRECATED: added optional route_amulet_item_id; dropped by 015_drop_route_amulet.sql.
-- Amulets live on the board + Needs/Wants. Kept for migration history only.
-- Safe to re-run (no-op if column already dropped by 015 first — prefer running 015).

alter table public.builds
  add column if not exists route_amulet_item_id text
    references public.items (id) on delete set null;

comment on column public.builds.route_amulet_item_id is
  'Optional guide amulet (items.id); amulet_* or blood_amulet';

create index if not exists builds_route_amulet_item_id_idx
  on public.builds (route_amulet_item_id);
