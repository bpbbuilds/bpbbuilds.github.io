-- Drop unused route amulet column (amulets live on board + essentials).
-- Supersedes 014_route_amulet.sql. Safe to re-run.

drop index if exists public.builds_route_amulet_item_id_idx;

alter table public.builds
  drop column if exists route_amulet_item_id;
