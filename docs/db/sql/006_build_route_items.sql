-- Round skill picks as item ids (join to items — no duplicated skill text).
-- Safe to re-run.

alter table public.builds
  add column if not exists route_r3_item_id text
    references public.items (id) on delete set null;

alter table public.builds
  add column if not exists route_r10_item_id text
    references public.items (id) on delete set null;

create index if not exists builds_route_r3_item_id_idx
  on public.builds (route_r3_item_id);

create index if not exists builds_route_r10_item_id_idx
  on public.builds (route_r10_item_id);
